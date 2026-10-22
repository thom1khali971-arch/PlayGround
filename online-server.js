'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.apk': 'application/vnd.android.package-archive',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

function sendFile(res, file, st) {
  res.writeHead(200, {
    'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'content-length': st.size,
    'cache-control': 'no-store'
  });
  fs.createReadStream(file).pipe(res);
}

function serveStatic(req, res) {
  let pathname = '/';
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch {}
  if (pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({
      ok: true,
      online: clients.size,
      queue: queue.length,
      rooms: rooms.size
    }));
    return;
  }
  if (pathname === '/') pathname = '/index.html';
  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) {
      const indexFile = path.join(file, 'index.html');
      fs.stat(indexFile, (err2, st2) => {
        if (err2 || !st2.isFile()) {
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('Not found');
          return;
        }
        sendFile(res, indexFile, st2);
      });
      return;
    }
    if (err || !st.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    sendFile(res, file, st);
  });
}

const server = http.createServer(serveStatic);
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

server.on('upgrade', (req, socket, head) => {
  let pathname = '';
  try { pathname = new URL(req.url, 'http://localhost').pathname; } catch {}
  if (pathname !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

const clients = new Set();
const queue = [];
const rooms = new Map();
let playerSeq = 0;
let roomSeq = 0;

function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(data)); } catch {}
  }
}

function onlineCount() {
  return clients.size;
}

function broadcastCount() {
  const data = { type: 'online', count: onlineCount(), queue: queue.length };
  for (const ws of clients) send(ws, data);
}

function cleanText(value, max) {
  return String(value || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);
}

function isGmail(value) {
  return /^[^\s@]+@gmail\.com$/i.test(String(value || '').trim());
}

function removeFromQueue(ws) {
  const i = queue.indexOf(ws);
  if (i >= 0) queue.splice(i, 1);
  ws.queued = false;
  queue.forEach((socket, index) => send(socket, { type: 'queued', position: index + 1, queue: queue.length }));
}

function randomMove() {
  return ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
}

function moveIndex(move) {
  return move === 'rock' ? 0 : move === 'paper' ? 1 : 2;
}

function startRound(room) {
  if (room.ended) return;
  room.round += 1;
  room.moves = [null, null];
  room.resolving = false;
  room.deadline = Date.now() + 4000;
  const payload = {
    type: 'round',
    round: room.round,
    scores: room.scores.slice(),
    duration: 4000,
    deadline: room.deadline
  };
  send(room.players[0], payload);
  send(room.players[1], payload);
  clearTimeout(room.timer);
  room.timer = setTimeout(() => resolveRound(room, true), 4000);
}

function resolveRound(room, auto) {
  if (room.ended || room.resolving) return;
  room.resolving = true;
  clearTimeout(room.timer);
  room.timer = null;

  room.moves = room.moves.map((move) => move || randomMove());
  const a = moveIndex(room.moves[0]);
  const b = moveIndex(room.moves[1]);
  const diff = (a - b + 3) % 3;
  let results = ['draw', 'draw'];
  if (diff === 1) {
    room.scores[0] += 1;
    results = ['win', 'lose'];
  } else if (diff === 2) {
    room.scores[1] += 1;
    results = ['lose', 'win'];
  }

  const payload = {
    type: 'reveal',
    round: room.round,
    moves: room.moves.slice(),
    result: results,
    scores: room.scores.slice(),
    auto: !!auto
  };
  send(room.players[0], payload);
  send(room.players[1], payload);

  if (room.scores[0] >= 3 || room.scores[1] >= 3) {
    room.timer = setTimeout(() => endRoom(room), 1400);
  } else {
    room.timer = setTimeout(() => startRound(room), 1600);
  }
}

function endRoom(room, reason) {
  if (room.ended) return;
  room.ended = true;
  clearTimeout(room.timer);
  room.timer = null;
  const winner = reason === 'disconnect' ? null : (room.scores[0] >= 3 ? 0 : 1);
  room.players.forEach((ws, i) => {
    if (!ws) return;
    send(ws, {
      type: 'end',
      scores: room.scores.slice(),
      winner: winner === null ? null : (winner === i ? 1 : 0),
      youWon: winner === null ? null : winner === i,
      reason: reason || 'finished'
    });
    ws.room = null;
    ws.seat = null;
  });
  rooms.delete(room.id);
  if (reason === 'disconnect') {
    room.players.forEach((ws) => {
      if (ws && ws.readyState === WebSocket.OPEN) send(ws, { type: 'opponentLeft' });
    });
  }
}

function leaveRoom(ws, reason) {
  const room = ws.room;
  ws.room = null;
  ws.seat = null;
  if (!room) return;
  clearTimeout(room.timer);
  room.timer = null;
  room.ended = true;
  const other = room.players.find((p) => p && p !== ws);
  if (other) {
    other.room = null;
    other.seat = null;
    send(other, { type: 'opponentLeft' });
  }
  rooms.delete(room.id);
}

function makeRoom(one, two) {
  const room = {
    id: 'r' + (++roomSeq),
    players: [one, two],
    scores: [0, 0],
    round: 0,
    moves: [null, null],
    ready: [false, false],
    timer: null,
    started: false,
    ended: false
  };
  one.room = room;
  two.room = room;
  one.seat = 0;
  two.seat = 1;
  rooms.set(room.id, room);
  send(one, { type: 'matched', roomId: room.id, opponent: { name: two.name || 'JOGADOR' }, seat: 0, bestOf: 5 });
  send(two, { type: 'matched', roomId: room.id, opponent: { name: one.name || 'JOGADOR' }, seat: 1, bestOf: 5 });
  room.timer = setTimeout(() => {
    if (!room.started && !room.ended) {
      room.started = true;
      startRound(room);
    }
  }, 2200);
}

function matchmake() {
  while (queue.length >= 2) {
    const one = queue.shift();
    const two = queue.shift();
    one.queued = false;
    two.queued = false;
    if (!one || !two || one.readyState !== WebSocket.OPEN || two.readyState !== WebSocket.OPEN) {
      if (one && one.readyState === WebSocket.OPEN) queue.unshift(one);
      if (two && two.readyState === WebSocket.OPEN) queue.unshift(two);
      return;
    }
    makeRoom(one, two);
  }
  queue.forEach((ws, index) => send(ws, { type: 'queued', position: index + 1, queue: queue.length }));
  broadcastCount();
}

function handleMessage(ws, raw) {
  if (raw.length > 4096) return;
  let msg;
  try { msg = JSON.parse(raw.toString()); } catch { return; }
  if (!msg || typeof msg.type !== 'string') return;

  if (msg.type === 'hello') {
    ws.name = cleanText(msg.name, 18) || 'JOGADOR';
    ws.email = cleanText(msg.email, 80);
    send(ws, { type: 'hello', id: ws.playerId, name: ws.name, online: onlineCount() });
    return;
  }

  if (msg.type === 'queue') {
    if (msg.name) ws.name = cleanText(msg.name, 18) || ws.name;
    if (!ws.name) ws.name = 'JOGADOR';
    if (msg.email) ws.email = cleanText(msg.email, 80);
    if (!isGmail(ws.email)) {
      removeFromQueue(ws);
      send(ws, { type: 'error', code: 'GMAIL_REQUIRED', message: 'Faça login com Gmail para jogar online.' });
      return;
    }
    if (ws.room) { send(ws, { type: 'error', message: 'Você já está em uma partida.' }); return; }
    if (ws.queued) { send(ws, { type: 'queued', position: queue.indexOf(ws) + 1, queue: queue.length }); return; }
    ws.queued = true;
    queue.push(ws);
    send(ws, { type: 'queued', position: queue.length, queue: queue.length });
    matchmake();
    return;
  }

  if (msg.type === 'cancel') {
    removeFromQueue(ws);
    send(ws, { type: 'cancelled' });
    broadcastCount();
    return;
  }

  if (msg.type === 'ready') {
    const room = ws.room;
    if (!room || room.started || room.ended) return;
    room.ready[ws.seat] = true;
    if (room.ready[0] && room.ready[1]) {
      clearTimeout(room.timer);
      room.started = true;
      startRound(room);
    }
    return;
  }

  if (msg.type === 'move') {
    const room = ws.room;
    if (!isGmail(ws.email)) return;
    if (!room || room.ended || room.resolving || ws.seat === null) return;
    if (room.round < 1 || room.moves[ws.seat] !== null) return;
    if (!['rock', 'paper', 'scissors'].includes(msg.move)) return;
    room.moves[ws.seat] = msg.move;
    if (room.moves[0] && room.moves[1]) resolveRound(room, false);
    return;
  }

  if (msg.type === 'leave') {
    leaveRoom(ws, 'leave');
    send(ws, { type: 'left' });
    return;
  }

  if (msg.type === 'ping') {
    send(ws, { type: 'pong', t: Date.now() });
  }
}

wss.on('connection', (ws) => {
  ws.playerId = 'p' + (++playerSeq);
  ws.name = 'JOGADOR';
  ws.email = '';
  ws.room = null;
  ws.seat = null;
  ws.queued = false;
  ws.isAlive = true;
  clients.add(ws);
  send(ws, { type: 'hello', id: ws.playerId, name: ws.name, online: onlineCount() });
  broadcastCount();

  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw) => handleMessage(ws, raw));
  ws.on('close', () => {
    clients.delete(ws);
    removeFromQueue(ws);
    if (ws.room) leaveRoom(ws, 'disconnect');
    broadcastCount();
  });
  ws.on('error', () => {});
});

const heartbeat = setInterval(() => {
  for (const ws of clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 30000);
heartbeat.unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log('PXT online server on :' + PORT + ' (HTTP + WS /ws)');
});
