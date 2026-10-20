function switchServer(serverId) {
  if (!getServer(serverId) || state.serverId === serverId) return;
  state.serverId = serverId;
  const server = getServer(serverId);
  state.selectedChannelId = server.channels[0]?.id || "";
  state.sidebarOpen = false;
  renderAll();
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

function leaveCall() {
  if (!state.call) return;
  const channel = callChannel();
  const callServerId = state.call.serverId;
  stopScreen();
  stopCamera();
  state.call = null;
  state.selectedChannelId =
    callServerId === state.serverId
      ? channel?.id || state.selectedChannelId
      : getServer(state.serverId)?.channels[0]?.id || state.selectedChannelId;
  renderAll();
  playSfx("leave");
  toast(channel ? `Você saiu de ${channel.name}` : "Você saiu da chamada", { type: "info", icon: "phone-off" });
}

function toggleMic() {
  if (!state.call) {
    toast("Entre em uma chamada para usar o microfone.", { type: "info", icon: "mic" });
    return;
  }
  state.micMuted = !state.micMuted;
  if (!state.micMuted && state.deafened) state.deafened = false;
  playSfx(state.micMuted ? "mute" : "unmute");
  syncAudioUI();
}

function toggleDeafen() {
  if (!state.call) {
    toast("Entre em uma chamada para controlar o áudio.", { type: "info", icon: "headphones" });
    return;
  }
  state.deafened = !state.deafened;
  state.micMuted = state.deafened;
  playSfx(state.deafened ? "mute" : "unmute");
  syncAudioUI();
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
    playSfx("camera");
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
    if (!state.call || state.cameraStream) {
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
      }
    });
    renderStage();
    renderDock();
    renderMembers();
    playSfx("camera");
    toast("Câmera ligada", { type: "success", icon: "video" });
  } catch {
    playSfx("error");
    toast("Não foi possível acessar a câmera. Verifique a permissão do navegador.", { type: "error" });
  }
}

async function toggleScreen() {
  if (!state.call) {
    toast("Entre em uma chamada para compartilhar a tela.", { type: "info", icon: "screen" });
    return;
  }
  if (state.screenStream) {
    stopScreen();
    renderStage();
    renderDock();
    renderMembers();
    playSfx("screen");
    toast("Compartilhamento encerrado", { type: "info", icon: "screen" });
    return;
  }
  if (!navigator.mediaDevices?.getDisplayMedia) {
    playSfx("error");
    toast("Este navegador não permite compartilhar a tela.", { type: "error" });
    return;
  }
  if (state.cameraStream) {
    stopCamera();
    renderStage();
  }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    if (!state.call || state.screenStream) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    state.screenStream = stream;
    const track = stream.getVideoTracks()[0];
    track?.addEventListener("ended", () => {
      if (state.screenStream === stream) {
        state.screenStream = null;
        renderStage();
        renderDock();
        renderMembers();
        toast("Compartilhamento encerrado", { type: "info", icon: "screen" });
      }
    });
    renderStage();
    renderDock();
    renderMembers();
    playSfx("screen");
    toast("Você está compartilhando a tela", { type: "success", icon: "screen" });
  } catch {
    playSfx("error");
    toast("Compartilhamento de tela cancelado.", { type: "error" });
  }
}

function stopCamera() {
  if (!state.cameraStream) return;
  const stream = state.cameraStream;
  state.cameraStream = null;
  stream.getTracks().forEach((track) => track.stop());
}

function stopScreen() {
  if (!state.screenStream) return;
  const stream = state.screenStream;
  state.screenStream = null;
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
