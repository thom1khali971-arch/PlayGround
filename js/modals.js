function openCreateChannel() {
  const server = getServer(state.serverId);
  if (!server) return;
  openModal({
    small: true,
    content: `<div class="modal-head">
        <div>
          <h3>Novo canal de voz</h3>
          <p>Crie uma sala dentro de ${escapeHtml(server.name)}</p>
        </div>
        <button class="icon-btn small" type="button" data-close aria-label="Fechar">${icon("x")}</button>
      </div>
      <form id="createChannelForm">
        <div class="modal-body">
          <label class="field"><span>Nome do canal</span>
            <input class="modal-input" id="channelName" maxlength="28" placeholder="Ex.: Café da manhã" autocomplete="off" required />
          </label>
          <p class="modal-note">O canal ficará visível para todos que têm acesso a este espaço.</p>
        </div>
        <div class="modal-foot">
          <button class="btn-ghost" type="button" data-close>Cancelar</button>
          <button class="btn-primary" type="submit">${icon("plus")} Criar canal</button>
        </div>
      </form>`,
    onOpen(root) {
      $("#channelName", root).focus();
      $("#createChannelForm", root).addEventListener("submit", (event) => {
        event.preventDefault();
        const name = $("#channelName", root).value.trim();
        if (!name) return;
        const id = `canal-${Date.now()}`;
        server.channels.push({ id, name, participants: [] });
        state.selectedChannelId = id;
        renderAll();
        closeModal();
        playSfx("join");
        toast(`Canal “${name}” criado`, { type: "success", icon: "volume" });
      });
    },
  });
}

function openCreateServer() {
  openModal({
    small: true,
    content: `<div class="modal-head">
        <div>
          <h3>Criar um espaço</h3>
          <p>Um novo lugar para conversas por voz</p>
        </div>
        <button class="icon-btn small" type="button" data-close aria-label="Fechar">${icon("x")}</button>
      </div>
      <form id="createServerForm">
        <div class="modal-body">
          <label class="field"><span>Nome do espaço</span>
            <input class="modal-input" id="serverNameInput" maxlength="32" placeholder="Ex.: Café dos Amigos" autocomplete="off" required />
          </label>
          <p class="modal-note">Você será a primeira pessoa do novo espaço. Crie canais e convide quem quiser.</p>
        </div>
        <div class="modal-foot">
          <button class="btn-ghost" type="button" data-close>Cancelar</button>
          <button class="btn-primary" type="submit">${icon("sparkles")} Criar espaço</button>
        </div>
      </form>`,
    onOpen(root) {
      $("#serverNameInput", root).focus();
      $("#createServerForm", root).addEventListener("submit", (event) => {
        event.preventDefault();
        const name = $("#serverNameInput", root).value.trim();
        if (!name) return;
        const id = `espaco-${Date.now()}`;
        const channelId = `sala-${Date.now()}`;
        servers.push({
          id,
          name,
          kind: "Novo espaço de voz",
          glyph: "wave",
          gradient: SERVER_GRADIENTS[servers.length % SERVER_GRADIENTS.length],
          channels: [{ id: channelId, name: "Thom Call", participants: [] }],
        });
        state.serverId = id;
        state.selectedChannelId = channelId;
        state.sidebarOpen = false;
        renderAll();
        closeModal();
        playSfx("join");
        toast(`Espaço “${name}” criado`, { type: "success", icon: "sparkles" });
      });
    },
  });
}

function openShortcuts() {
  const shortcut = (label, key) => `<div class="shortcut"><span>${label}</span><kbd>${key}</kbd></div>`;
  openModal({
    small: true,
    content: `<div class="modal-head">
        <div>
          <h3>Atalhos</h3>
          <p>Controle a chamada sem tirar as mãos do teclado</p>
        </div>
        <button class="icon-btn small" type="button" data-close aria-label="Fechar">${icon("x")}</button>
      </div>
      <div class="modal-body">
        <div class="shortcut-list">
          ${shortcut("Silenciar microfone", "M")}
          ${shortcut("Ativar / desativar áudio", "D")}
          ${shortcut("Ligar / desligar câmera", "V")}
          ${shortcut("Compartilhar tela", "S")}
          ${shortcut("Fechar janelas", "Esc")}
        </div>
        <p class="modal-note">Os atalhos ficam ativos quando você está em uma chamada e nenhum campo de texto está em foco.</p>
      </div>
      <div class="modal-foot">
        <span class="muted-hint">Thom Call · voz e chat oficial</span>
        <button class="btn-primary" type="button" data-close>Fechar</button>
      </div>`,
  });
}

function openSpaceInfo() {
  const server = getServer(state.serverId);
  if (!server) return;
  const channelCount = server.channels.length;
  const peopleCount = server.channels.reduce((total, channel) => total + channel.participants.length, 0);

  openModal({
    small: true,
    content: `<div class="modal-head">
        <div class="space-summary">
          <span class="server-mini" style="--srv:${server.gradient}">${icon(server.glyph)}</span>
          <div>
            <h3>${escapeHtml(server.name)}</h3>
            <p>${escapeHtml(server.kind || "Espaço de voz")}</p>
          </div>
        </div>
        <button class="icon-btn small" type="button" data-close aria-label="Fechar">${icon("x")}</button>
      </div>
      <div class="modal-body">
        <div class="space-stats">
          <div class="space-stat"><strong>${channelCount}</strong><span>canais de voz</span></div>
          <div class="space-stat"><strong>${peopleCount}</strong><span>pessoas por aqui</span></div>
        </div>
        <p class="modal-note">Escolha um canal, entre e converse por voz. O chat oficial do dono fica no painel lateral.</p>
      </div>
      <div class="modal-foot">
        <button class="btn-ghost" type="button" data-close>Fechar</button>
        <button class="btn-primary" type="button" id="spaceInviteBtn">${icon("copy")} Copiar convite</button>
      </div>`,
    onOpen(root) {
      $("#spaceInviteBtn", root).addEventListener("click", () => copyInvite(server.channels[0]));
    },
  });
}

function tickSpeaking() {
  if (!state.call) return;
  const channel = callChannel();
  if (!channel) return;
  const candidates = channel.participants.filter((p) => !p.muted);
  channel.participants.forEach((p) => {
    p.speaking = false;
  });
  if (candidates.length) {
    const amount = Math.random() < 0.24 ? 2 : Math.random() < 0.18 ? 0 : 1;
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    shuffled.slice(0, amount).forEach((p) => {
      p.speaking = true;
    });
  }
  updateSpeakingUI();
}

function handleShortcut(event) {
  if (event.key === "Escape") {
    if (modalRoot.classList.contains("is-open")) {
      closeModal();
      return;
    }
    if (document.body.classList.contains("auth-locked")) return;
    if (state.sidebarOpen || state.membersOpen) {
      state.sidebarOpen = false;
      if (state.membersOpen) stopChatRecording();
      state.membersOpen = false;
      updateChrome();
      return;
    }
  }

  if (document.body.classList.contains("auth-locked")) return;

  const active = document.activeElement;
  const typing =
    active &&
    (["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName) || active.isContentEditable);
  if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
  if (!state.call) return;
  if (modalRoot.classList.contains("is-open")) return;

  const key = event.key.toLowerCase();
  if (key === "m") {
    event.preventDefault();
    toggleMic();
  } else if (key === "d") {
    event.preventDefault();
    toggleDeafen();
  } else if (key === "v") {
    event.preventDefault();
    toggleCamera();
  } else if (key === "s") {
    event.preventDefault();
    toggleScreen();
  }
}

function bindEvents() {
  $("#addServerBtn").addEventListener("click", openCreateServer);
  $("#addChannelBtn").addEventListener("click", openCreateChannel);
  $("#settingsBtn").addEventListener("click", openSettings);
  $("#profileBtn").addEventListener("click", openSettings);
  $("#helpBtn").addEventListener("click", openShortcuts);
  $("#serverMenuBtn").addEventListener("click", openSpaceInfo);
  $("#inviteBtn").addEventListener("click", copyInvite);
  $("#panelMicBtn").addEventListener("click", toggleMic);
  $("#panelDeafenBtn").addEventListener("click", toggleDeafen);

  $("#chatBtn").addEventListener("click", () => {
    if (state.membersOpen && state.panelTab === "chat") {
      stopChatRecording();
      state.membersOpen = false;
      updateChrome();
      return;
    }
    setPanelTab("chat");
  });

  $("#membersBtn").addEventListener("click", () => {
    if (state.membersOpen && state.panelTab === "members") {
      state.membersOpen = false;
      updateChrome();
      return;
    }
    setPanelTab("members");
  });

  $("#closePanelBtn").addEventListener("click", () => {
    stopChatRecording();
    state.membersOpen = false;
    updateChrome();
  });

  $("#menuBtn").addEventListener("click", () => {
    state.sidebarOpen = !state.sidebarOpen;
    if (state.sidebarOpen && window.innerWidth <= 1180) {
      if (state.membersOpen) stopChatRecording();
      state.membersOpen = false;
    }
    updateChrome();
  });

  $("#scrim").addEventListener("click", () => {
    state.sidebarOpen = false;
    if (state.membersOpen) stopChatRecording();
    state.membersOpen = false;
    updateChrome();
  });

  serverRail.addEventListener("click", (event) => {
    const button = event.target.closest("[data-server-id]");
    if (button) switchServer(button.dataset.serverId);
  });

  channelList.addEventListener("click", (event) => {
    const button = event.target.closest(".channel[data-channel-id]");
    if (!button) return;
    joinChannel(state.serverId, button.dataset.channelId);
  });

  stageEl.addEventListener("click", (event) => {
    if (!event.target.closest("#joinBtn")) return;
    const channel = displayChannel();
    if (channel) joinChannel(state.serverId, channel.id);
  });

  membersEl.addEventListener("click", (event) => {
    const modAction = event.target.closest("[data-mod-action]");
    if (modAction) {
      const member = modAction.closest(".member");
      if (member) handleModerationAction(modAction.dataset.modAction, member.dataset.participant);
      return;
    }
    const tab = event.target.closest("[data-panel-tab]");
    if (tab) {
      setPanelTab(tab.dataset.panelTab);
      return;
    }
    if (event.target.closest("#closeMembersBtn")) {
      state.membersOpen = false;
      updateChrome();
      return;
    }
    if (event.target.closest("#inviteCardBtn")) copyInvite();
  });

  dockEl.addEventListener("click", (event) => {
    const button = event.target.closest(".dock-btn[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "mic") toggleMic();
    else if (action === "deafen") toggleDeafen();
    else if (action === "camera") toggleCamera();
    else if (action === "screen") toggleScreen();
    else if (action === "leave") leaveCall();
  });

  document.addEventListener("keydown", handleShortcut);
  document.addEventListener("pointerdown", ensureAudio, { once: true });
  document.addEventListener("keydown", ensureAudio, { once: true });

  let lastWidth = window.innerWidth;
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const width = window.innerWidth;
      if (width <= 1180 && lastWidth > 1180) {
        if (state.membersOpen) stopChatRecording();
        state.membersOpen = false;
      }
      if (width > 1180 && lastWidth <= 1180) state.membersOpen = true;
      if (width > 900) state.sidebarOpen = false;
      lastWidth = width;
      if (state.call) renderStage();
      updateChrome();
    }, 140);
  });
}

function startIntervals() {
  window.setInterval(() => {
    const timer = $("#callTimer");
    if (timer && state.call) timer.textContent = formatDuration(Date.now() - state.call.joinedAt);
  }, 1000);

  window.setInterval(() => {
    state.ping = 18 + Math.floor(Math.random() * 12);
    $$("[data-ping]").forEach((el) => {
      el.textContent = state.ping;
    });
  }, 6000);

  window.setInterval(tickSpeaking, 2900);
}

function init() {
  $$("[data-icon]").forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });
  bindEvents();
  renderAll();
  joinChannel("onda", "thom-call", { silent: true });
  startIntervals();
  updateChrome();
}

init();
