import http from "node:http";
import https from "node:https";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.RELAY_PORT || 3003);
const HOST = process.env.RELAY_HOST || "0.0.0.0";
const REGION = process.env.RELAY_REGION || "us-east-1";
const ACCESS_KEY = process.env.RELAY_KEY || "";
const TLS_CERT = process.env.RELAY_TLS_CERT || "";
const TLS_KEY = process.env.RELAY_TLS_KEY || "";
const MAX_FRAME = 6 * 1024 * 1024;
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const rooms = new Map();
const startedAt = Date.now();

function sanitizeRoom(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64) || "default";
}

function getRoom(id) {
  if (!rooms.has(id)) rooms.set(id, { publisher: null, viewers: new Set() });
  return rooms.get(id);
}

function roomState(room) {
  return {
    type: "state",
    region: REGION,
    publisher: Boolean(room.publisher),
    viewers: room.viewers.size,
  };
}

function notifyRoom(room) {
  const message = roomState(room);
  room.publisher?.sendJSON(message);
  room.viewers.forEach((viewer) => viewer.sendJSON(message));
}

function broadcast(room, payload) {
  if (!room.publisher) return;
  room.viewers.forEach((viewer) => viewer.sendBinary(payload));
}

function detach(client) {
  if (client.detached) return;
  client.detached = true;
  const room = rooms.get(client.room);
  if (!room) return;
  if (room.publisher === client) room.publisher = null;
  room.viewers.delete(client);
  if (!room.publisher && room.viewers.size === 0) {
    rooms.delete(client.room);
    return;
  }
  notifyRoom(room);
}

function attach(client) {
  const room = getRoom(client.room);
  if (client.role === "publisher") {
    const previous = room.publisher;
    room.publisher = client;
    if (previous && previous !== client) previous.terminate(4000, "Replaced");
  } else {
    room.viewers.add(client);
  }
  client.sendJSON({
    type: "ready",
    region: REGION,
    role: client.role,
    room: client.room,
  });
  notifyRoom(room);
  console.log(`[relay] ${client.role} joined ${client.room} (${REGION})`);
}

function encodeFrame(opcode, payload) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
  const length = body.length;
  let header;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  header[0] = 0x80 | opcode;
  return Buffer.concat([header, body]);
}

class RelayClient {
  constructor(socket, room, role) {
    this.socket = socket;
    this.room = room;
    this.role = role;
    this.closed = false;
    this.detached = false;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.fragmentSize = 0;
    this.fragmentOpcode = 0;
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 30000);
    socket.on("data", (chunk) => this.receive(chunk));
    socket.on("close", () => this.cleanup());
    socket.on("end", () => this.cleanup());
    socket.on("error", () => {
      this.socket.destroy();
      this.cleanup();
    });
  }

  receive(chunk) {
    if (this.closed) return;
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.parse();
  }

  parse() {
    while (!this.closed) {
      const buffer = this.buffer;
      if (buffer.length < 2) return;
      const first = buffer[0];
      const second = buffer[1];
      const fin = (first & 0x80) !== 0;
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let length = second & 0x7f;
      let offset = 2;

      if (!masked) {
        this.terminate(1002, "Unmasked frame");
        return;
      }
      if (length === 126) {
        if (buffer.length < 4) return;
        length = buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (buffer.length < 10) return;
        const bigLength = buffer.readBigUInt64BE(2);
        if (bigLength > BigInt(MAX_FRAME)) {
          this.terminate(1009, "Frame too large");
          return;
        }
        length = Number(bigLength);
        offset = 10;
      }
      if (length > MAX_FRAME) {
        this.terminate(1009, "Frame too large");
        return;
      }
      if (buffer.length < offset + 4 + length) return;
      const mask = buffer.subarray(offset, offset + 4);
      offset += 4;
      const payload = Buffer.from(buffer.subarray(offset, offset + length));
      this.buffer = buffer.subarray(offset + length);
      for (let index = 0; index < payload.length; index += 1) {
        payload[index] ^= mask[index % 4];
      }
      this.handleFrame(fin, opcode, payload);
    }
  }

  handleFrame(fin, opcode, payload) {
    if (opcode === 0x0) {
      if (!this.fragmentOpcode) {
        this.terminate(1002, "Unexpected continuation");
        return;
      }
      this.fragments.push(payload);
      this.fragmentSize += payload.length;
      if (this.fragmentSize > MAX_FRAME) {
        this.terminate(1009, "Frame too large");
        return;
      }
      if (fin) {
        const complete = Buffer.concat(this.fragments);
        const fullOpcode = this.fragmentOpcode;
        this.fragments = [];
        this.fragmentSize = 0;
        this.fragmentOpcode = 0;
        this.handleFrame(true, fullOpcode, complete);
      }
      return;
    }
    if (opcode === 0x1 || opcode === 0x2) {
      if (!fin) {
        this.fragments = [payload];
        this.fragmentSize = payload.length;
        this.fragmentOpcode = opcode;
        if (this.fragmentSize > MAX_FRAME) this.terminate(1009, "Frame too large");
        return;
      }
      this.handleData(opcode, payload);
      return;
    }
    if (opcode === 0x8) {
      this.terminate(1000, "");
      return;
    }
    if (opcode === 0x9) {
      this.send(0xa, payload);
      return;
    }
    if (opcode === 0xa) return;
    this.terminate(1002, "Unsupported opcode");
  }

  handleData(opcode, payload) {
    if (opcode === 0x2 && this.role === "publisher") {
      const room = rooms.get(this.room);
      if (room?.publisher === this) broadcast(room, payload);
      return;
    }
    if (opcode === 0x1) {
      let message;
      try {
        message = JSON.parse(payload.toString("utf8"));
      } catch {
        return;
      }
      if (message?.type === "ping") this.sendJSON({ type: "pong", at: Date.now() });
    }
  }

  send(opcode, payload) {
    if (this.closed || this.socket.destroyed) return false;
    try {
      this.socket.write(encodeFrame(opcode, payload));
      return true;
    } catch {
      this.cleanup();
      return false;
    }
  }

  sendJSON(value) {
    this.send(0x1, Buffer.from(JSON.stringify(value)));
  }

  sendBinary(payload) {
    if (this.socket.writableLength > 8 * 1024 * 1024) return;
    this.send(0x2, payload);
  }

  terminate(code, reason) {
    if (this.closed) return;
    this.closed = true;
    try {
      const body = Buffer.alloc(2 + Buffer.byteLength(reason));
      body.writeUInt16BE(code, 0);
      body.write(reason, 2);
      this.socket.write(encodeFrame(0x8, body));
    } catch {
    }
    try {
      this.socket.end();
    } catch {
    }
    detach(this);
  }

  cleanup() {
    if (this.closed && this.detached) return;
    this.closed = true;
    detach(this);
  }
}

function handleRequest(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "no-store");
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.url?.startsWith("/health") || request.url === "/") {
    const body = JSON.stringify({
      ok: true,
      service: "thom-screen-relay",
      region: REGION,
      uptime: Math.round((Date.now() - startedAt) / 1000),
      rooms: [...rooms.entries()].map(([id, room]) => ({
        room: id,
        publisher: Boolean(room.publisher),
        viewers: room.viewers.size,
      })),
    });
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(body);
    return;
  }
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

const server =
  TLS_CERT && TLS_KEY
    ? https.createServer(
        { cert: readFileSync(TLS_CERT), key: readFileSync(TLS_KEY) },
        handleRequest,
      )
    : http.createServer(handleRequest);

server.on("upgrade", (request, socket, head) => {
  let url;
  try {
    url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  } catch {
    socket.destroy();
    return;
  }
  if (!url.pathname.endsWith("/ws")) {
    socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  if (ACCESS_KEY && url.searchParams.get("key") !== ACCESS_KEY) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  const key = request.headers["sec-websocket-key"];
  if (!key || request.headers["sec-websocket-version"] !== "13") {
    socket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  const accept = crypto.createHash("sha1").update(`${key}${WS_GUID}`).digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  const room = sanitizeRoom(url.searchParams.get("room"));
  const role = url.searchParams.get("role") === "publisher" ? "publisher" : "viewer";
  const client = new RelayClient(socket, room, role);
  attach(client);
  if (head?.length) client.receive(head);
});

server.listen(PORT, HOST, () => {
  console.log(
    `[relay] screen proxy listening on ${HOST}:${PORT} (${REGION}, ${TLS_CERT ? "wss" : "ws"})`,
  );
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
