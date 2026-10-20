const RELAY_DEFAULT_REGION = "us-east-1";
const RELAY_FRAME_INTERVAL = 200;
const RELAY_MAX_WIDTH = 1152;
const RELAY_QUALITY = 0.6;

const screenRelay = {
  region: RELAY_DEFAULT_REGION,
  online: null,
  room: "",
  publishing: false,
  publishedFrames: 0,
  publisherSocket: null,
  publishTimer: 0,
  publishTimeout: 0,
  publishWarned: false,
  publishConnected: false,
  video: null,
  canvas: null,
  context: null,
  encoding: false,
  viewerSocket: null,
  viewerActive: false,
  viewerRoom: "",
  viewerLastFrame: 0,
  viewerWatchdog: 0,
  viewerTimeout: 0,
  liveViewerPeer: "",
  liveViewerSource: "",
};

function relayConfig() {
  const config = window.THOM_CONFIG || {};
  const settings = state.settings || {};
  return {
    url: String(settings.screenRelayUrl || config.screenRelayUrl || "").trim(),
    region: String(settings.screenRelayRegion || config.screenRelayRegion || RELAY_DEFAULT_REGION).trim(),
    key: String(config.screenRelayKey || "").trim(),
  };
}

function relayWsUrl(room, role) {
  const config = relayConfig();
  if (!config.url) return "";
  try {
    const url = new URL(config.url, window.location.href);
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol === "https:") url.protocol = "wss:";
    if (!url.pathname.endsWith("/ws")) {
      url.pathname = `${url.pathname.replace(/\/$/, "")}/ws`;
    }
    url.searchParams.set("room", room);
    url.searchParams.set("role", role);
    if (config.key) url.searchParams.set("key", config.key);
    return url.toString();
  } catch {
    return "";
  }
}

function relayRegionLabel() {
  const config = relayConfig();
  const region = screenRelay.region || config.region || RELAY_DEFAULT_REGION;
  return screenRelay.online === false ? `${region} · offline` : region;
}

function relayRoomId() {
  return state.call?.channelId || displayChannel()?.id || state.selectedChannelId || "thom-call";
}

function updateRelayBadges() {
  const label = relayRegionLabel();
  $$("[data-relay-region]").forEach((element) => {
    element.textContent = label;
  });
  $$("[data-relay-dot]").forEach((element) => {
    element.classList.toggle("is-online", screenRelay.online === true);
    element.classList.toggle("is-offline", screenRelay.online === false);
  });
}

function relayDotClass() {
  if (screenRelay.online === true) return " is-online";
  if (screenRelay.online === false) return " is-offline";
  return "";
}

function stopPublishLoop() {
  if (screenRelay.publishTimer) {
    window.clearInterval(screenRelay.publishTimer);
    screenRelay.publishTimer = 0;
  }
}

function cleanupPublisherMedia() {
  stopPublishLoop();
  if (screenRelay.video) {
    try {
      screenRelay.video.pause();
    } catch {
    }
    screenRelay.video.srcObject = null;
    screenRelay.video.remove();
  }
  screenRelay.video = null;
  screenRelay.canvas = null;
  screenRelay.context = null;
  screenRelay.encoding = false;
}

function sendScreenFrame() {
  const socket = screenRelay.publisherSocket;
  const video = screenRelay.video;
  const canvas = screenRelay.canvas;
  const context = screenRelay.context;
  if (!screenRelay.publishing || !socket || socket.readyState !== WebSocket.OPEN) return;
  if (!video || !canvas || !context || video.readyState < 2) return;
  if (screenRelay.encoding) return;
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) return;
  const width = Math.min(RELAY_MAX_WIDTH, sourceWidth);
  const height = Math.max(1, Math.round((sourceHeight / sourceWidth) * width));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  try {
    context.drawImage(video, 0, 0, width, height);
  } catch {
    return;
  }
  screenRelay.encoding = true;
  canvas.toBlob(
    (blob) => {
      screenRelay.encoding = false;
      if (!blob || !screenRelay.publishing) return;
      if (socket.readyState !== WebSocket.OPEN) return;
      try {
        socket.send(blob);
        screenRelay.publishedFrames += 1;
      } catch {
      }
    },
    "image/jpeg",
    RELAY_QUALITY,
  );
}

function startScreenRelay(stream, room) {
  stopScreenRelay();
  const config = relayConfig();
  if (!config.url) {
    toast("Proxy de transmissão não configurado. A tela ficará apenas local.", {
      type: "info",
      icon: "globe",
    });
    return false;
  }
  const roomId = room || relayRoomId();
  const wsUrl = relayWsUrl(roomId, "publisher");
  if (!wsUrl) {
    toast("Endereço do proxy de transmissão inválido.", { type: "error", icon: "globe" });
    return false;
  }

  screenRelay.region = config.region || RELAY_DEFAULT_REGION;
  screenRelay.online = null;
  updateRelayBadges();
  screenRelay.room = roomId;
  screenRelay.publishing = true;
  screenRelay.publishedFrames = 0;
  screenRelay.publishWarned = false;
  screenRelay.publishConnected = false;
  screenRelay.encoding = false;

  const video = document.createElement("video");
  video.className = "relay-video-source";
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.srcObject = stream;
  document.body.append(video);
  video.play().catch(() => {});
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  screenRelay.video = video;
  screenRelay.canvas = canvas;
  screenRelay.context = context;
  screenRelay.publishTimer = window.setInterval(sendScreenFrame, RELAY_FRAME_INTERVAL);

  const socket = new WebSocket(wsUrl);
  screenRelay.publisherSocket = socket;
  screenRelay.publishTimeout = window.setTimeout(() => {
    if (socket.readyState === WebSocket.CONNECTING) socket.close();
  }, 7000);

  socket.addEventListener("open", () => {
    if (screenRelay.publisherSocket !== socket) return;
    window.clearTimeout(screenRelay.publishTimeout);
    screenRelay.publishConnected = true;
    screenRelay.online = true;
    updateRelayBadges();
    toast(`Proxy ${screenRelay.region} conectado. Transmitindo tela.`, {
      type: "success",
      icon: "globe",
    });
  });

  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") return;
    try {
      const message = JSON.parse(event.data);
      if (message.type === "ready" && message.region) {
        screenRelay.region = message.region;
        updateRelayBadges();
      }
    } catch {
    }
  });

  socket.addEventListener("close", () => {
    window.clearTimeout(screenRelay.publishTimeout);
    if (screenRelay.publisherSocket !== socket) return;
    screenRelay.publisherSocket = null;
    if (!screenRelay.publishing) return;
    screenRelay.publishing = false;
    cleanupPublisherMedia();
    screenRelay.online = false;
    updateRelayBadges();
    if (screenRelay.publishWarned) return;
    screenRelay.publishWarned = true;
    toast(
      screenRelay.publishConnected
        ? "Conexão com o proxy caiu. A tela continua apenas local."
        : `Não foi possível conectar ao proxy ${screenRelay.region}. A tela continua apenas local.`,
      { type: "error", icon: "globe" },
    );
  });

  return true;
}

function stopScreenRelay() {
  screenRelay.publishing = false;
  screenRelay.publishConnected = false;
  window.clearTimeout(screenRelay.publishTimeout);
  cleanupPublisherMedia();
  const socket = screenRelay.publisherSocket;
  screenRelay.publisherSocket = null;
  if (socket) {
    try {
      socket.close(1000, "screen stopped");
    } catch {
    }
  }
}

function setViewerStatus(text, liveText) {
  const status = $("#viewerStatus");
  if (status) status.textContent = text;
  const live = $("#viewerLiveText");
  if (live && liveText) live.textContent = liveText;
}

function setViewerEmpty(visible) {
  const empty = $("#viewerEmpty");
  if (empty) empty.hidden = !visible;
  const canvas = $("#viewerCanvas");
  if (canvas) canvas.classList.toggle("is-live", !visible);
}

function setViewerRetry(visible) {
  const retry = $("#viewerRetryBtn");
  if (retry) retry.hidden = !visible;
}

function stopViewerSocket() {
  const socket = screenRelay.viewerSocket;
  screenRelay.viewerSocket = null;
  if (!socket) return;
  try {
    socket.close(1000, "viewer closed");
  } catch {
  }
}

function stopViewer() {
  screenRelay.viewerActive = false;
  screenRelay.viewerRoom = "";
  window.clearTimeout(screenRelay.viewerTimeout);
  window.clearInterval(screenRelay.viewerWatchdog);
  screenRelay.viewerWatchdog = 0;
  stopViewerSocket();
}

function startViewerWatchdog() {
  window.clearInterval(screenRelay.viewerWatchdog);
  screenRelay.viewerWatchdog = window.setInterval(() => {
    if (!screenRelay.viewerActive) return;
    if (screenRelay.viewerLastFrame && Date.now() - screenRelay.viewerLastFrame > 4000) {
      setViewerStatus("Aguardando novos quadros...", "Sem novos quadros");
    }
  }, 1000);
}

async function drawViewerFrame(data) {
  const socket = screenRelay.viewerSocket;
  if (!socket) return;
  try {
    const bitmap = await createImageBitmap(data);
    if (screenRelay.viewerSocket !== socket) {
      bitmap.close();
      return;
    }
    const canvas = $("#viewerCanvas");
    if (!canvas) {
      bitmap.close();
      return;
    }
    if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
    }
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      bitmap.close();
      return;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    screenRelay.viewerLastFrame = Date.now();
    setViewerEmpty(false);
    setViewerStatus("Ao vivo", "Ao vivo");
    setViewerRetry(false);
  } catch {
  }
}

function connectViewer(room) {
  stopViewerSocket();
  window.clearTimeout(screenRelay.viewerTimeout);
  const config = relayConfig();
  if (!config.url) {
    setViewerStatus("Proxy de transmissão não configurado.", "Indisponível");
    setViewerRetry(false);
    return;
  }
  const roomId = room || relayRoomId();
  const wsUrl = relayWsUrl(roomId, "viewer");
  if (!wsUrl) {
    setViewerStatus("Endereço do proxy inválido.", "Indisponível");
    setViewerRetry(false);
    return;
  }
  screenRelay.viewerActive = true;
  screenRelay.viewerRoom = roomId;
  screenRelay.viewerLastFrame = 0;
  screenRelay.region = config.region || RELAY_DEFAULT_REGION;
  screenRelay.online = null;
  updateRelayBadges();
  setViewerEmpty(true);
  setViewerRetry(false);
  setViewerStatus("Conectando ao proxy...", "Conectando");
  const count = $("#viewerCount");
  if (count) count.textContent = "";
  const socket = new WebSocket(wsUrl);
  socket.binaryType = "blob";
  screenRelay.viewerSocket = socket;
  startViewerWatchdog();
  screenRelay.viewerTimeout = window.setTimeout(() => {
    if (socket.readyState === WebSocket.CONNECTING) socket.close();
  }, 8000);

  socket.addEventListener("open", () => {
    if (screenRelay.viewerSocket !== socket) return;
    window.clearTimeout(screenRelay.viewerTimeout);
    screenRelay.online = true;
    updateRelayBadges();
    setViewerStatus("Conectado. Aguardando transmissão...", "Conectado");
  });

  socket.addEventListener("message", (event) => {
    if (screenRelay.viewerSocket !== socket) return;
    if (typeof event.data === "string") {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.region) {
        screenRelay.region = message.region;
        updateRelayBadges();
      }
      if (message.type === "state") {
        const viewerCount = $("#viewerCount");
        if (viewerCount) {
          viewerCount.textContent =
            message.viewers === 1 ? "1 pessoa assistindo" : `${message.viewers} pessoas assistindo`;
        }
        if (!message.publisher && !screenRelay.viewerLastFrame) {
          setViewerEmpty(true);
          setViewerStatus("Aguardando uma transmissão nesta sala...", "Aguardando");
        } else if (message.publisher && !screenRelay.viewerLastFrame) {
          setViewerStatus("Transmissão ativa. Aguardando quadros...", "Conectado");
        }
      }
      return;
    }
    drawViewerFrame(event.data);
  });

  socket.addEventListener("close", () => {
    window.clearTimeout(screenRelay.viewerTimeout);
    if (screenRelay.viewerSocket !== socket) return;
    screenRelay.viewerSocket = null;
    screenRelay.online = false;
    updateRelayBadges();
    setViewerEmpty(true);
    setViewerRetry(true);
    setViewerStatus(`Não foi possível conectar ao proxy ${screenRelay.region}.`, "Conexão encerrada");
  });
}


function refreshLiveScreenViewer(peerId) {
  if (screenRelay.liveViewerPeer !== peerId) return;
  const video = $("#liveViewerVideo");
  const empty = $("#liveViewerEmpty");
  const status = $("#liveViewerStatus");
  if (!video) return;
  const stream = typeof liveScreenStream === "function" ? liveScreenStream(peerId) : null;
  const camera = screenRelay.liveViewerSource === "camera";
  if (stream) {
    if (video.srcObject !== stream) video.srcObject = stream;
    video.play?.().catch(() => {
    });
    if (empty) empty.hidden = true;
    if (status) status.textContent = "Ao vivo";
  } else {
    video.srcObject = null;
    if (empty) empty.hidden = false;
    if (status) status.textContent = camera ? "Aguardando a câmera..." : "Aguardando a tela...";
  }
}

function openLiveScreenViewer(peerId) {
  if (typeof live === "undefined" || typeof liveScreenStream !== "function") {
    toast("Conexão ao vivo indisponível.", { type: "error", icon: "screen" });
    return;
  }
  const user = live.users.get(peerId);
  if (!user) {
    toast("Participante não encontrado.", { type: "info", icon: "screen" });
    return;
  }
  const camera = user.screenSource === "camera";
  const mediaLabel = camera ? "câmera" : "tela";
  openModal({
    wide: true,
    content: `<div class="modal-head">
        <div>
          <h3>${camera ? "Câmera" : "Tela"} de ${escapeHtml(user.name)}</h3>
          <p>Compartilhamento direto entre vocês · conexão P2P</p>
        </div>
        <button class="icon-btn" type="button" data-close aria-label="Fechar">${icon("x")}</button>
      </div>
      <div class="modal-body screen-viewer-body">
        <div class="screen-viewer-stage">
          <video id="liveViewerVideo" class="screen-viewer-video" autoplay playsinline></video>
          <div class="screen-viewer-empty" id="liveViewerEmpty">
            <span class="viewer-orb">${icon(camera ? "video" : "screen")}</span>
            <strong id="liveViewerStatus">Aguardando a ${mediaLabel}...</strong>
            <p>A transmissão aparece aqui assim que os quadros chegarem.</p>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <span class="viewer-live"><i class="viewer-dot is-online"></i><span id="liveViewerLiveText">P2P</span></span>
      </div>`,
    onOpen: () => {
      screenRelay.liveViewerPeer = peerId;
      screenRelay.liveViewerSource = camera ? "camera" : "display";
      refreshLiveScreenViewer(peerId);
    },
    onClose: () => {
      screenRelay.liveViewerPeer = "";
      screenRelay.liveViewerSource = "";
    },
  });
}

function openScreenViewer(room) {
  const config = relayConfig();
  if (!config.url) {
    toast("Proxy de transmissão não configurado.", { type: "info", icon: "globe" });
    return;
  }
  const roomId = room || relayRoomId();
  const channel = getChannel(state.call?.serverId || state.serverId, roomId);
  const region = escapeHtml(relayRegionLabel());
  openModal({
    wide: true,
    content: `<div class="modal-head">
        <div>
          <h3>Transmissão de tela</h3>
          <p>${escapeHtml(channel?.name || "Sala")} · recebida pelo proxy <span data-relay-region>${region}</span></p>
        </div>
        <button class="icon-btn" type="button" data-close aria-label="Fechar">${icon("x")}</button>
      </div>
      <div class="modal-body screen-viewer-body">
        <div class="screen-viewer-stage">
          <canvas id="viewerCanvas"></canvas>
          <div class="screen-viewer-empty" id="viewerEmpty">
            <span class="viewer-orb">${icon("screen")}</span>
            <strong id="viewerStatus">Conectando ao proxy...</strong>
            <p>Região do proxy: <span data-relay-region>${region}</span></p>
            <button class="btn-secondary" id="viewerRetryBtn" type="button" hidden>${icon("refresh")} Tentar novamente</button>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <span class="viewer-live"><i class="viewer-dot" data-relay-dot></i><span id="viewerLiveText">Conectando</span></span>
        <span class="viewer-count" id="viewerCount"></span>
      </div>`,
    onOpen: (root) => {
      $("#viewerRetryBtn", root)?.addEventListener("click", () => connectViewer(roomId));
      connectViewer(roomId);
    },
    onClose: stopViewer,
  });
}

function initScreenRelay() {
  const config = relayConfig();
  screenRelay.region = config.region || RELAY_DEFAULT_REGION;
  updateRelayBadges();
  window.addEventListener("beforeunload", () => {
    stopScreenRelay();
    stopViewer();
  });
}

initScreenRelay();
