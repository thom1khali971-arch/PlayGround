let screenPending = false;
let miniDrag = null;

function switchServer(serverId) {
  if (!getServer(serverId) || state.serverId === serverId) return;
  state.serverId = serverId;
  const server = getServer(serverId);
  state.selectedChannelId = server.channels[0]?.id || "";
  state.sidebarOpen = false;
  renderAll();
  if (typeof livePublishPresence === "function") livePublishPresence();
}

function joinChannel(serverId, channelId, options = {}) {
  const channel = getChannel(serverId, channelId);
  if (!channel) return;
  if (state.call?.serverId === serverId && state.call?.channelId === channelId) return;

  const wasInCall = Boolean(state.call);
  stopScreen();
  stopCamera();

  state.call = { serverId, channelId, joinedAt: Date.now() };
  state.selectedChannelId = channelId;
  state.serverId = serverId;
  state.sidebarOpen = false;
  channel.participants.forEach((p) => {
    p.speaking = false;
  });
  if (channel.participants[0]) channel.participants[0].speaking = true;

  renderAll();
  if (typeof startLiveVoice === "function") startLiveVoice(serverId, channelId);

  if (!options.silent) {
    playSfx(wasInCall ? "switch" : "join");
    toast(wasInCall ? `Você entrou em ${channel.name}` : `Conectado a ${channel.name}`, {
      type: "success",
      icon: "phone",
    });
    if (!channel.participants.length) {
      window.setTimeout(() => toast("Sala vazia — copie o convite para chamar alguém.", { type: "info", icon: "link" }), 500);
    }
  }
}

function leaveCall(options = {}) {
  if (!state.call) return;
  const channel = callChannel();
  const callServerId = state.call.serverId;
  if (typeof stopLiveVoice === "function") stopLiveVoice();
  stopScreen();
  stopCamera();
  state.call = null;
  state.mini.open = false;
  state.selectedChannelId =
    callServerId === state.serverId
      ? channel?.id || state.selectedChannelId
      : getServer(state.serverId)?.channels[0]?.id || state.selectedChannelId;
  renderAll();
  if (typeof livePublishPresence === "function") livePublishPresence();
  if (options.silent) return;
  playSfx("leave");
  toast(channel ? `Você saiu de ${channel.name}` : "Você saiu da chamada", { type: "info", icon: "phone-off" });
}

async function toggleMic() {
  if (!state.call) {
    toast("Entre em uma chamada para usar o microfone.", { type: "info", icon: "mic" });
    return;
  }
  if (state.micMuted && typeof liveEnsureLocalAudio === "function" && !live.localStream) {
    try {
      await liveEnsureLocalAudio();
    } catch {
      playSfx("error");
      toast("Não foi possível acessar o microfone. Verifique a permissão do navegador.", { type: "error" });
      return;
    }
    if (!state.call) {
      if (live.localStream) {
        live.localStream.getTracks().forEach((track) => track.stop());
        live.localStream = null;
      }
      return;
    }
  }
  state.micMuted = !state.micMuted;
  if (!state.micMuted && state.deafened) state.deafened = false;
  if (typeof liveApplyMicState === "function") liveApplyMicState();
  playSfx(state.micMuted ? "mute" : "unmute");
  syncAudioUI();
  if (typeof livePublishPresence === "function") livePublishPresence();
}

async function toggleDeafen() {
  if (!state.call) {
    toast("Entre em uma chamada para controlar o áudio.", { type: "info", icon: "headphones" });
    return;
  }
  state.deafened = !state.deafened;
  state.micMuted = state.deafened;
  if (!state.deafened && typeof liveEnsureLocalAudio === "function" && !live.localStream) {
    try {
      await liveEnsureLocalAudio();
    } catch {
      state.micMuted = true;
      if (typeof liveApplyMicState === "function") liveApplyMicState();
      playSfx("error");
      syncAudioUI();
      toast("Não foi possível acessar o microfone. Verifique a permissão do navegador.", { type: "error" });
      return;
    }
    if (!state.call) {
      if (live.localStream) {
        live.localStream.getTracks().forEach((track) => track.stop());
        live.localStream = null;
      }
      return;
    }
  }
  if (typeof liveApplyMicState === "function") liveApplyMicState();
  playSfx(state.deafened ? "mute" : "unmute");
  syncAudioUI();
  if (typeof livePublishPresence === "function") livePublishPresence();
}

async function toggleCamera() {
  if (!state.call) {
    toast("Entre em uma chamada para ligar a câmera.", { type: "info", icon: "video" });
    return;
  }
  if (state.cameraStream) {
    stopCamera();
    renderStage();
    renderDock();
    renderMembers();
    if (typeof livePublishPresence === "function") livePublishPresence();
    playSfx("camera");
    return;
  }
  if (!mediaPolicyAllows("camera")) {
    playSfx("error");
    toast("O dono bloqueou a câmera para os participantes.", { type: "info", icon: "lock" });
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    playSfx("error");
    toast("Este navegador não disponibiliza acesso à câmera.", { type: "error" });
    return;
  }
  if (state.screenStream) {
    stopScreen();
    renderStage();
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    if (!state.call || state.cameraStream || !mediaPolicyAllows("camera")) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    state.cameraStream = stream;
    const track = stream.getVideoTracks()[0];
    track?.addEventListener("ended", () => {
      if (state.cameraStream === stream) {
        state.cameraStream = null;
        renderStage();
        renderDock();
        renderMembers();
        if (typeof livePublishPresence === "function") livePublishPresence();
      }
    });
    renderStage();
    renderDock();
    renderMembers();
    if (typeof livePublishPresence === "function") livePublishPresence();
    playSfx("camera");
    toast("Câmera ligada", { type: "success", icon: "video" });
  } catch {
    playSfx("error");
    toast("Não foi possível acessar a câmera. Verifique a permissão do navegador.", { type: "error" });
  }
}

function isAndroidDevice() {
  return /Android/i.test(navigator.userAgent) || navigator.userAgentData?.platform === "Android";
}

function legacyScreenCaptureApi() {
  if (!isAndroidDevice() || !navigator.mediaDevices?.getUserMedia) return null;
  return () =>
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { mandatory: { chromeMediaSource: "screen" } },
    });
}

function isScreenStream(stream) {
  const track = stream.getVideoTracks()[0];
  if (!track) return false;
  const settings = typeof track.getSettings === "function" ? track.getSettings() : {};
  if (["monitor", "window", "browser"].includes(settings.displaySurface)) return true;
  const label = String(track.label || "").toLowerCase();
  if (/screen|display|tela/.test(label)) return true;
  return !settings.facingMode && !/camera|front|back|facing/.test(label);
}

function applyMediaPolicy() {
  let changed = false;
  if (!mediaPolicyAllows("camera") && state.cameraStream) {
    stopCamera();
    changed = true;
  }
  if (!mediaPolicyAllows("screen") && state.screenStream) {
    stopScreen();
    changed = true;
  }
  if (changed && typeof livePublishPresence === "function") livePublishPresence();
  if (typeof renderAll === "function") renderAll();
}

function applyMiniPosition() {
  const el = $("#callMini");
  if (!el || el.hidden) return;
  if (!Number.isFinite(state.mini.x) || !Number.isFinite(state.mini.y)) return;
  el.classList.add("is-positioned");
  const rect = el.getBoundingClientRect();
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxY = Math.max(margin, window.innerHeight - rect.height - margin);
  state.mini.x = Math.min(Math.max(state.mini.x, margin), maxX);
  state.mini.y = Math.min(Math.max(state.mini.y, margin), maxY);
  el.style.left = `${state.mini.x}px`;
  el.style.top = `${state.mini.y}px`;
  el.style.right = "auto";
  el.style.bottom = "auto";
}

function toggleMiniCall(force) {
  if (!state.call) {
    toast("Entre em uma chamada para abrir a mini janela.", { type: "info", icon: "pip" });
    return false;
  }
  const open = typeof force === "boolean" ? force : !state.mini.open;
  state.mini.open = open;
  renderMiniCall();
  renderDock();
  if (open && Number.isFinite(state.mini.x) && Number.isFinite(state.mini.y)) {
    window.requestAnimationFrame(applyMiniPosition);
  }
  return open;
}

function startNativeOverlay() {
  if (!isNativeApp()) return;
  if (typeof toggleMiniCall === "function") toggleMiniCall(false);
  window.setTimeout(() => {
    try {
      window.ThomAndroid.startOverlay();
      toast("Bolha flutuante ativada.", { type: "info", icon: "external" });
    } catch {
      toast("Não foi possível ativar a bolha flutuante.", { type: "error", icon: "x" });
    }
  }, 120);
}

function requestNativeOverlay() {
  if (!isNativeApp()) {
    toast("A bolha flutuante está disponível no app Android do Thom Call.", { type: "info", icon: "external" });
    return;
  }
  let granted = false;
  try {
    granted = Boolean(window.ThomAndroid.hasOverlayPermission());
  } catch {
    granted = false;
  }
  if (granted) {
    startNativeOverlay();
    return;
  }
  toast("Permita “Sobrepor a outros apps” para continuar.", { type: "info", icon: "external" });
  try {
    window.ThomAndroid.requestOverlayPermission();
  } catch {
    toast("Não foi possível abrir a permissão de sobreposição.", { type: "error", icon: "x" });
  }
}

window.thomNativeOverlayPermission = (granted) => {
  if (!isNativeApp()) return;
  if (granted) {
    toast("Bolha flutuante liberada.", { type: "info", icon: "external" });
    startNativeOverlay();
  } else {
    toast("Permissão de sobreposição negada.", { type: "error", icon: "x" });
  }
};

function setupMiniCall() {
  const el = $("#callMini");
  if (!el || el.dataset.bound === "1") return;
  el.dataset.bound = "1";
  el.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mini-action]");
    if (!button) return;
    const action = button.dataset.miniAction;
    if (action === "close") toggleMiniCall(false);
    else if (action === "overlay") requestNativeOverlay();
    else if (action === "mic") toggleMic();
    else if (action === "camera") toggleCamera();
    else if (action === "screen") toggleScreen();
    else if (action === "leave") leaveCall();
  });
  el.addEventListener("pointerdown", (event) => {
    const head = event.target.closest("[data-mini-drag]");
    if (!head || event.target.closest("button")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = el.getBoundingClientRect();
    state.mini.x = rect.left;
    state.mini.y = rect.top;
    miniDrag = {
      id: event.pointerId,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
    };
    el.classList.add("is-dragging");
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
    }
    event.preventDefault();
  });
  el.addEventListener("pointermove", (event) => {
    if (!miniDrag || event.pointerId !== miniDrag.id) return;
    state.mini.x = event.clientX - miniDrag.dx;
    state.mini.y = event.clientY - miniDrag.dy;
    applyMiniPosition();
  });
  const endDrag = (event) => {
    if (!miniDrag || event.pointerId !== miniDrag.id) return;
    miniDrag = null;
    el.classList.remove("is-dragging");
    try {
      el.releasePointerCapture(event.pointerId);
    } catch {
    }
    applyMiniPosition();
  };
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);
  window.addEventListener("resize", () => {
    if (state.mini.open && Number.isFinite(state.mini.x)) applyMiniPosition();
  });
}

function adoptScreenStream(stream, source) {
  if (!state.call || state.screenStream || !mediaPolicyAllows("screen")) {
    stream.getTracks().forEach((track) => track.stop());
    return false;
  }
  state.screenStream = stream;
  state.screenSource = source;
  const track = stream.getVideoTracks()[0];
  track?.addEventListener("ended", () => {
    if (state.screenStream !== stream) return;
    const camera = state.screenSource === "camera";
    stopScreen();
    renderStage();
    renderDock();
    renderMembers();
    if (typeof livePublishPresence === "function") livePublishPresence();
    playSfx("screen");
    toast(camera ? "Câmera encerrada" : "Compartilhamento encerrado", {
      type: "info",
      icon: camera ? "video" : "screen",
    });
  });
  renderStage();
  renderDock();
  renderMembers();
  if (typeof startLiveScreen === "function" && typeof liveIsActive === "function" && liveIsActive() && live.connected) {
    startLiveScreen(stream);
  } else {
    startScreenRelay(stream, state.call.channelId);
  }
  if (typeof livePublishPresence === "function") livePublishPresence();
  return true;
}

async function startAndroidCameraShare() {
  if (!state.call) {
    toast("Entre em uma chamada para compartilhar a câmera.", { type: "info", icon: "video" });
    return;
  }
  if (state.screenStream || screenPending) return;
  if (!mediaPolicyAllows("screen")) {
    playSfx("error");
    toast("O dono bloqueou a tela para os participantes.", { type: "info", icon: "lock" });
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Este navegador não oferece acesso à câmera.", { type: "error", icon: "video" });
    return;
  }
  if (state.cameraStream) {
    stopCamera();
    renderStage();
  }
  screenPending = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    if (!adoptScreenStream(stream, "camera")) return;
    playSfx("screen");
    toast("Câmera traseira compartilhada. Aponte para a tela desejada.", {
      type: "success",
      icon: "video",
    });
  } catch {
    playSfx("error");
    toast("Não foi possível acessar a câmera traseira. Verifique a permissão.", {
      type: "error",
      icon: "video",
    });
  } finally {
    screenPending = false;
  }
}

async function toggleScreen() {
  if (!state.call) {
    toast("Entre em uma chamada para compartilhar a tela.", { type: "info", icon: "screen" });
    return;
  }
  if (state.screenStream) {
    const camera = state.screenSource === "camera";
    stopScreen();
    renderStage();
    renderDock();
    renderMembers();
    if (typeof livePublishPresence === "function") livePublishPresence();
    playSfx("screen");
    toast(camera ? "Câmera encerrada" : "Compartilhamento encerrado", {
      type: "info",
      icon: camera ? "video" : "screen",
    });
    return;
  }
  if (!mediaPolicyAllows("screen")) {
    playSfx("error");
    toast("O dono bloqueou a tela para os participantes.", { type: "info", icon: "lock" });
    return;
  }
  if (screenPending) {
    toast("Escolha uma tela na janela do navegador.", { type: "info", icon: "screen" });
    return;
  }
  const problem = screenCaptureProblem();
  if (problem) {
    playSfx("error");
    openScreenShareHelp(problem);
    return;
  }
  const requestScreen = screenCaptureApi();
  const legacyScreen = legacyScreenCaptureApi();
  if (!requestScreen && !legacyScreen) {
    playSfx("error");
    openScreenShareHelp(isAndroidDevice() ? "android" : "unsupported");
    return;
  }
  if (state.cameraStream) {
    stopCamera();
    renderStage();
  }
  screenPending = true;
  try {
    let stream = null;
    if (requestScreen) {
      try {
        stream = await requestScreen({ video: true, audio: false });
      } catch (error) {
        if (error?.name === "AbortError" || !legacyScreen) throw error;
        stream = await legacyScreen();
        if (!isScreenStream(stream)) {
          stream.getTracks().forEach((track) => track.stop());
          throw new Error("android-screen-unavailable");
        }
      }
    } else {
      stream = await legacyScreen();
      if (!isScreenStream(stream)) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("android-screen-unavailable");
      }
    }
    if (!adoptScreenStream(stream, "display")) return;
    playSfx("screen");
    toast("Você está compartilhando a tela", { type: "success", icon: "screen" });
  } catch (error) {
    playSfx("error");
    if (error?.name === "AbortError") {
      toast("Compartilhamento de tela cancelado.", { type: "info", icon: "screen" });
      return;
    }
    openScreenShareHelp(isAndroidDevice() ? "android" : screenShareHelpReason(error));
  } finally {
    screenPending = false;
  }
}

function screenCapturePolicy() {
  try {
    const policy = document.permissionsPolicy || document.featurePolicy;
    if (policy && typeof policy.allowsFeature === "function") {
      if (typeof policy.features === "function" && !policy.features().includes("display-capture")) return true;
      return policy.allowsFeature("display-capture");
    }
  } catch {
  }
  return true;
}

function screenCaptureApi() {
  if (navigator.mediaDevices?.getDisplayMedia) {
    return (constraints) => navigator.mediaDevices.getDisplayMedia(constraints);
  }
  for (const method of ["getDisplayMedia", "webkitGetDisplayMedia"]) {
    if (typeof navigator[method] === "function") {
      return (constraints) => navigator[method].call(navigator, constraints);
    }
  }
  return null;
}

function screenCaptureProblem() {
  if (!window.isSecureContext) return "insecure";
  if (!screenCapturePolicy()) return "policy";
  if (!screenCaptureApi() && !legacyScreenCaptureApi()) return isAndroidDevice() ? "android" : "unsupported";
  return "";
}

function screenShareHelpReason(error) {
  const name = error?.name || "";
  if (name === "NotSupportedError" || name === "TypeError") return "unsupported";
  if (name === "NotFoundError") return "unavailable";
  if (!screenCapturePolicy()) return "policy";
  return "denied";
}

function screenShareTabUrl() {
  const channelId = state.call?.channelId || state.selectedChannelId || "thom-call";
  const url = new URL(location.href);
  url.hash = `sala=${encodeURIComponent(channelId)}`;
  return url.toString();
}

function openScreenShareHelp(reason) {
  const copy = {
    policy: {
      title: "O navegador bloqueou a captura de tela",
      text: "A pré-visualização incorporada não libera compartilhamento de tela. Abra o Thom Call em uma aba própria para transmitir.",
      hint: "A chamada abre no mesmo canal automaticamente.",
      action: "tab",
    },
    insecure: {
      title: "A conexão não é segura",
      text: "Compartilhar tela exige HTTPS ou localhost. Abra o Thom Call por uma conexão segura.",
      hint: "Endereços de rede local em HTTP não têm acesso à captura de tela.",
      action: "retry",
    },
    unsupported: {
      title: "Navegador sem captura de tela",
      text: "Este navegador ou dispositivo não oferece compartilhamento de tela.",
      hint: "Use Chrome, Edge ou Firefox atualizado em um computador.",
      action: "retry",
    },
    android: {
      title: "Captura de tela no Android",
      text: "O navegador Android não libera a captura da tela do celular para sites. Em tablets e versões compatíveis do Chrome, o Thom Call tenta automaticamente.",
      hint: "Como alternativa, transmita a câmera traseira apontada para a tela que deseja mostrar. Para capturar a tela do próprio celular, use um computador.",
      action: "androidCamera",
    },
    unavailable: {
      title: "Nenhuma tela disponível",
      text: "O navegador não encontrou uma tela ou janela para compartilhar.",
      hint: "Feche outros seletores de captura e tente novamente.",
      action: "retry",
    },
    denied: {
      title: "Permissão de tela negada",
      text: "O navegador negou o acesso à tela.",
      hint: "No Chrome, clique no ícone de cadeado ou câmera na barra de endereço e permita a captura de tela.",
      action: "retry",
    },
  }[reason] || {
    title: "Não foi possível compartilhar a tela",
    text: "O navegador recusou a captura de tela.",
    hint: "Verifique as permissões do site e tente novamente.",
    action: "retry",
  };
  const primary =
    copy.action === "tab"
      ? `<button class="btn-primary" id="screenShareTabBtn" type="button">${icon("external")} Abrir em nova aba</button>`
      : copy.action === "androidCamera"
        ? `<button class="btn-primary" id="screenShareCameraBtn" type="button">${icon("video")} Usar câmera traseira</button>`
        : `<button class="btn-primary" id="screenShareRetryBtn" type="button">${icon("refresh")} Tentar novamente</button>`;
  openModal({
    small: true,
    content: `<div class="modal-head">
        <div>
          <h3>${copy.title}</h3>
          <p>${copy.text}</p>
        </div>
        <button class="icon-btn small" type="button" data-close aria-label="Fechar">${icon("x")}</button>
      </div>
      <div class="modal-body">
        <p class="modal-note">${copy.hint}</p>
      </div>
      <div class="modal-foot">
        <button class="btn-ghost" type="button" data-close>Fechar</button>
        ${primary}
      </div>`,
    onOpen(root) {
      $("#screenShareTabBtn", root)?.addEventListener("click", () => {
        const win = window.open(screenShareTabUrl(), "_blank");
        if (!win) {
          toast("Permita pop-ups para abrir a transmissão em outra aba.", { type: "error", icon: "external" });
          return;
        }
        try {
          win.opener = null;
        } catch {
        }
        closeModal();
        toast("Nova aba aberta. Clique em Tela para transmitir.", { type: "info", icon: "screen" });
      });
      $("#screenShareCameraBtn", root)?.addEventListener("click", () => {
        closeModal();
        window.setTimeout(() => startAndroidCameraShare(), 120);
      });
      $("#screenShareRetryBtn", root)?.addEventListener("click", () => {
        closeModal();
        window.setTimeout(() => toggleScreen(), 120);
      });
    },
  });
}

function stopCamera() {
  if (!state.cameraStream) return;
  const stream = state.cameraStream;
  state.cameraStream = null;
  stream.getTracks().forEach((track) => track.stop());
}

function stopScreen() {
  if (typeof stopLiveScreen === "function") stopLiveScreen();
  stopScreenRelay();
  if (!state.screenStream) {
    state.screenSource = "";
    return;
  }
  const stream = state.screenStream;
  state.screenStream = null;
  state.screenSource = "";
  stream.getTracks().forEach((track) => track.stop());
}

async function copyInvite(inviteChannel) {
  const channel = inviteChannel || (state.call ? callChannel() : displayChannel());
  if (!channel) return;
  const base = location.href.split("#")[0];
  const url = `${base}#sala=${encodeURIComponent(channel.id)}`;
  let copied = false;
  try {
    await navigator.clipboard.writeText(url);
    copied = true;
  } catch {
    const input = document.createElement("textarea");
    input.value = url;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    input.remove();
  }
  if (copied) {
    playSfx("camera");
    toast("Link de convite copiado", { type: "success", icon: "link" });
  } else {
    toast("Não foi possível copiar o link.", { type: "error" });
  }
}
