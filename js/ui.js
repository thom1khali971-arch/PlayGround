function renderAll() {
  renderRail();
  renderSidebar();
  renderHeader();
  renderStage();
  renderMembers();
  renderDock();
  renderUserPanel();
  updateChrome();
}

function renderRail() {
  const callServerId = state.call?.serverId;
  serverRail.innerHTML = servers
    .map((server) => {
      const active = server.id === state.serverId;
      return `<button class="rail-btn${active ? " is-active" : ""}" type="button"
        style="--srv:${server.gradient}" data-server-id="${escapeAttr(server.id)}"
        data-tip="${escapeAttr(server.name)}" aria-label="${escapeAttr(server.name)}"
        ${active ? 'aria-current="true"' : ""}>
        <span class="rail-icon">${icon(server.glyph)}</span>
        ${callServerId === server.id ? '<span class="rail-call"></span>' : ""}
      </button>`;
    })
    .join("");
}

function renderSidebar() {
  const server = getServer(state.serverId);
  if (!server) return;

  serverNameEl.textContent = server.name;
  serverKindEl.textContent = server.kind || "Espaço de voz";
  serverMini.style.setProperty("--srv", server.gradient);
  serverMini.innerHTML = icon(server.glyph);

  channelList.innerHTML = server.channels
    .map((channel) => {
      const joined = state.call?.serverId === server.id && state.call?.channelId === channel.id;
      const selected = !joined && !state.call && state.selectedChannelId === channel.id;
      const people = joined ? [localParticipant(), ...channel.participants] : channel.participants;
      const count = people.length;
      const peopleHtml = people.length
        ? `<div class="channel-people">${people
            .map((p) => {
              const muted = p.isLocal ? isMutedLocally() : p.muted;
              return `<div class="channel-person${p.isLocal ? " is-local" : ""}${p.speaking ? " is-speaking" : ""}"
                data-participant="${escapeAttr(p.id)}">
                <span class="mini-avatar" style="--av:${p.gradient}">${p.initials}</span>
                <span class="person-name">${p.isLocal ? "Você" : escapeHtml(p.name)}</span>
                ${muted ? icon("mic-off", "is-muted") : ""}
                <span class="mini-eq" aria-hidden="true"><i></i><i></i><i></i></span>
              </div>`;
            })
            .join("")}</div>`
        : "";

      return `<div class="channel-block">
        <button class="channel${joined ? " is-joined" : ""}${selected ? " is-selected" : ""}" type="button"
          data-channel-id="${escapeAttr(channel.id)}"
          aria-label="${escapeAttr(joined ? `Você está em ${channel.name}` : `Entrar em ${channel.name}`)}">
          <span class="channel-icon">${icon("volume")}</span>
          <span class="channel-name">${escapeHtml(channel.name)}</span>
          ${count ? `<span class="channel-count">${count}</span>` : ""}
          <span class="channel-join">${icon(joined ? "check" : "phone")}</span>
        </button>
        ${peopleHtml}
      </div>`;
    })
    .join("");
}

function renderHeader() {
  const channel = displayChannel();
  const server = displayedServer();
  if (!channel || !server) return;

  callNameEl.textContent = channel.name;
  callServerChip.textContent = server.name;
  headerIconEl.innerHTML = icon("volume");

  if (state.call) {
    const count = callPeople().length;
    callMetaEl.innerHTML = `<span class="live-dot"></span><span class="meta-call">${
      count === 1 ? "Chamada ativa · 1 pessoa" : `Chamada ativa · ${count} pessoas`
    }</span><span class="meta-compact">${count} ${count === 1 ? "pessoa" : "pessoas"}</span><span class="call-timer" id="callTimer">${formatDuration(Date.now() - state.call.joinedAt)}</span>`;
  } else {
    const count = channel.participants.length;
    callMetaEl.innerHTML = `<span>Chamada de voz · ${count} ${count === 1 ? "pessoa" : "pessoas"} na sala</span>`;
  }

  qualityPill.classList.toggle("hidden", !state.call);
  $$("[data-ping]").forEach((el) => {
    el.textContent = state.ping;
  });
}

function tileMarkup(p, index) {
  const local = p.isLocal;
  const screen = local && state.screenStream;
  const camera = local && state.cameraStream && !screen;
  const muted = local ? isMutedLocally() : p.muted;
  const hasMedia = Boolean(screen || camera);
  const classes = ["tile"];
  if (p.speaking) classes.push("is-speaking");
  if (local) classes.push("is-local");
  if (screen) classes.push("is-screen");
  if (camera) classes.push("is-camera");

  const role = p.host ? `<span class="tile-role">${icon("crown")} Anfitriã</span>` : "";
  const badge = screen
    ? '<span class="tile-badge">Compartilhando tela</span>'
    : camera
      ? '<span class="tile-badge">Câmera ativa</span>'
      : "";
  const micIcon = local
    ? `<span data-mic-local>${icon(muted ? "mic-off" : "mic", muted ? "is-muted" : "")}</span>`
    : muted
      ? icon("mic-off", "is-muted")
      : "";

  return `<article class="${classes.join(" ")}" data-participant="${escapeAttr(p.id)}"
      style="--av:${p.gradient};animation-delay:${Math.min(index * 45, 220)}ms">
      ${hasMedia ? '<video class="tile-video" id="selfVideo" autoplay playsinline muted></video>' : ""}
      ${hasMedia ? "" : `<div class="tile-body"><span class="big-avatar" style="--av:${p.gradient}">${p.initials}</span></div>`}
      ${role}${badge}
      <div class="tile-name">
        <span class="tile-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span>${local ? "Você" : escapeHtml(p.name)}</span>
        ${micIcon}
      </div>
    </article>`;
}

function layoutStage(count) {
  const grid = $("#callGrid");
  if (!grid) return;
  const tiles = [...grid.children];
  if (!tiles.length) return;

  if (window.innerWidth <= 640) {
    grid.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
    grid.style.gridAutoRows = "minmax(0, 1fr)";
    tiles.forEach((tile, index) => {
      tile.style.gridColumn = count % 2 === 1 && index === count - 1 ? "span 2" : "";
    });
    return;
  }

  const columns = count <= 1 ? 1 : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / columns);

  if (rows === 1) {
    grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    grid.style.gridAutoRows = "minmax(0, 1fr)";
    tiles.forEach((tile) => {
      tile.style.gridColumn = "";
    });
    return;
  }

  const lastRow = count - columns * (rows - 1);
  const unit = columns * lastRow;
  grid.style.gridTemplateColumns = `repeat(${unit}, minmax(0, 1fr))`;
  grid.style.gridAutoRows = "minmax(0, 1fr)";
  tiles.forEach((tile, index) => {
    const inLastRow = index >= (rows - 1) * columns;
    tile.style.gridColumn = `span ${inLastRow ? columns : lastRow}`;
  });
}

function idleMarkup(channel) {
  const people = channel.participants;
  const avatars = people
    .slice(0, 4)
    .map(
      (p) =>
        `<span class="avatar avatar-38" style="--av:${p.gradient}" title="${escapeAttr(p.name)}">${p.initials}</span>`,
    )
    .join("");
  const extra = people.length > 4 ? `<span class="idle-more">+${people.length - 4}</span>` : "";
  const description = people.length
    ? `${people.length} ${people.length === 1 ? "pessoa já está" : "pessoas já estão"} nesta sala. Entre para conversar por voz.`
    : "Ninguém por aqui ainda. Entre e ocupe a sala — depois é só chamar alguém.";

  return `<div class="idle-wrap">
    <div class="idle-card">
      <span class="idle-icon">${icon("volume")}</span>
      <span class="idle-eyebrow">Chamada de voz</span>
      <h3>${escapeHtml(channel.name)}</h3>
      <p>${escapeHtml(description)}</p>
      ${people.length ? `<div class="idle-people">${avatars}${extra}</div>` : '<div class="idle-people"></div>'}
      <button class="join-btn" id="joinBtn" type="button">${icon("phone")} Entrar na chamada</button>
      <span class="idle-hint">Seu microfone só é ativado quando você entrar.</span>
    </div>
  </div>`;
}

function renderStage() {
  const channel = displayChannel();
  if (!channel) {
    stageEl.innerHTML = "";
    return;
  }

  if (!state.call) {
    stageEl.innerHTML = idleMarkup(channel);
    return;
  }

  const people = callPeople();
  stageEl.innerHTML = `<div class="call-grid" id="callGrid">${people.map((p, i) => tileMarkup(p, i)).join("")}</div>`;
  layoutStage(people.length);

  const video = $("#selfVideo", stageEl);
  if (video) {
    const stream = state.screenStream || state.cameraStream;
    if (stream) {
      video.srcObject = stream;
      video.play?.().catch(() => {});
    }
  }
}

function statusFor(p) {
  if (p.isLocal) {
    if (state.deafened) return "Áudio desativado";
    if (state.micMuted) return "Microfone mutado";
    return "Na escuta";
  }
  if (p.speaking) return "Falando agora";
  if (p.muted) return "Microfone mutado";
  return "Na escuta";
}

function memberMarkup(p) {
  const local = p.isLocal;
  const muted = local ? isMutedLocally() : p.muted;
  const icons = [
    muted ? icon("mic-off", "is-muted") : "",
    local && state.cameraStream ? icon("video") : "",
    local && state.screenStream ? icon("screen", "is-sharing") : "",
  ].join("");
  const moderation =
    isOwnerMode() && !local
      ? `<div class="member-mod">
          <button class="member-mod-btn" type="button" data-mod-action="${muted ? "unmute" : "mute"}"
            data-tip="${muted ? "Permitir que fale" : "Mutar"}" aria-label="${muted ? "Permitir que fale" : "Mutar"}">
            ${icon(muted ? "mic" : "mic-off")}
          </button>
          <button class="member-mod-btn" type="button" data-mod-action="kick"
            data-tip="Expulsar da sala" aria-label="Expulsar da sala">${icon("user-x")}</button>
          <button class="member-mod-btn is-danger" type="button" data-mod-action="ban"
            data-tip="Banir do Thom Call" aria-label="Banir do Thom Call">${icon("ban")}</button>
        </div>`
      : "";

  return `<div class="member${p.speaking ? " is-speaking" : ""}" data-participant="${escapeAttr(p.id)}">
    <span class="avatar avatar-36 member-avatar" style="--av:${p.gradient}">${p.initials}</span>
    <div class="member-info">
      <div class="member-name"><span>${local ? "Você" : escapeHtml(p.name)}</span>${
        p.host ? '<span class="host-tag">Anfitriã</span>' : ""
      }</div>
      <span class="member-status" data-status>${statusFor(p)}</span>
    </div>
    <div class="member-icons">${icons}</div>
    ${moderation}
  </div>`;
}

function renderMembers() {
  const view = $("#membersView");
  if (!view) return;
  const channel = displayChannel();
  if (!channel) {
    view.innerHTML = "";
    return;
  }
  const inCall = Boolean(state.call);
  const people = inCall ? callPeople() : channel.participants;
  const label = inCall ? "Na chamada" : "Pessoas na sala";

  view.innerHTML = `<header class="members-head">
      <div>
        <h3>${label}</h3>
        <p>${people.length} ${people.length === 1 ? "pessoa" : "pessoas"}</p>
      </div>
      ${isOwnerMode() ? `<span class="mod-badge">${icon("shield")} Modo dono</span>` : ""}
    </header>
    <div class="members-list">
      ${people.map(memberMarkup).join("") || '<p class="members-empty">Ninguém por aqui ainda.</p>'}
    </div>
    <div class="members-foot">
      <div class="invite-card">
        <span class="invite-orb">${icon("link")}</span>
        <strong>Convide para a sala</strong>
        <p>Qualquer pessoa com o link pode entrar nesta chamada.</p>
        <button class="btn-primary" id="inviteCardBtn" type="button">${icon("copy")} Copiar convite</button>
      </div>
      ${
        inCall
          ? `<div class="call-stats">
            <div class="stat"><span>${icon("signal")} Latência</span><strong class="good"><b data-ping>${state.ping}</b> ms</strong></div>
            <div class="stat"><span>${icon("lock")} Criptografia</span><strong class="good">Ativa</strong></div>
            <div class="stat"><span>${icon("globe")} Região</span><strong>Brasil</strong></div>
          </div>`
          : ""
      }
    </div>`;
}

function renderDock() {
  if (!state.call) {
    dockWrap.classList.add("is-hidden");
    dockEl.innerHTML = "";
    return;
  }
  dockWrap.classList.remove("is-hidden");
  const muted = state.micMuted;

  dockEl.innerHTML = `<button class="dock-btn${muted ? " is-off" : ""}" type="button" data-action="mic"
      data-tip="${muted ? "Ativar microfone" : "Silenciar microfone"}" aria-pressed="${muted}">
      ${icon(muted ? "mic-off" : "mic")}<span class="dock-label">${muted ? "Mudo" : "Microfone"}</span>
    </button>
    <button class="dock-btn${state.deafened ? " is-off" : ""}" type="button" data-action="deafen"
      data-tip="${state.deafened ? "Ativar áudio" : "Desativar áudio"}" aria-pressed="${state.deafened}">
      ${icon(state.deafened ? "headphones-off" : "headphones")}<span class="dock-label">${state.deafened ? "Surdo" : "Áudio"}</span>
    </button>
    <button class="dock-btn${state.cameraStream ? " is-on" : ""}" type="button" data-action="camera"
      data-tip="${state.cameraStream ? "Desligar câmera" : "Ligar câmera"}" aria-pressed="${Boolean(state.cameraStream)}">
      ${icon(state.cameraStream ? "video" : "video-off")}<span class="dock-label">Câmera</span>
    </button>
    <button class="dock-btn${state.screenStream ? " is-sharing" : ""}" type="button" data-action="screen"
      data-tip="${state.screenStream ? "Parar transmissão" : "Compartilhar tela"}" aria-pressed="${Boolean(state.screenStream)}">
      ${icon("screen")}<span class="dock-label">Tela</span>
    </button>
    <span class="dock-sep" aria-hidden="true"></span>
    <button class="dock-btn danger" type="button" data-action="leave" data-tip="Sair da chamada">
      ${icon("phone-off")}<span class="dock-label">Sair</span>
    </button>`;
}

function renderUserPanel() {
  const inCall = Boolean(state.call);
  const muted = isMutedLocally();
  if (typeof applyAuthToUI === "function") applyAuthToUI();
  $("#userStatus").textContent = inCall ? "Em chamada" : "Disponível";
  $(".user-panel").classList.toggle("in-call", inCall);

  const micBtn = $("#panelMicBtn");
  micBtn.classList.toggle("is-off", muted);
  micBtn.innerHTML = icon(muted ? "mic-off" : "mic");
  micBtn.dataset.tip = muted ? "Ativar microfone" : "Silenciar microfone";
  micBtn.setAttribute("aria-label", muted ? "Ativar microfone" : "Silenciar microfone");
  micBtn.setAttribute("aria-pressed", String(muted));

  const deafBtn = $("#panelDeafenBtn");
  deafBtn.classList.toggle("is-off", state.deafened);
  deafBtn.innerHTML = icon(state.deafened ? "headphones-off" : "headphones");
  deafBtn.dataset.tip = state.deafened ? "Ativar áudio" : "Desativar áudio";
  deafBtn.setAttribute("aria-label", state.deafened ? "Ativar áudio" : "Desativar áudio");
  deafBtn.setAttribute("aria-pressed", String(state.deafened));
}

function setPanelTab(tab, open = true) {
  const nextTab = tab === "members" ? "members" : "chat";
  if (state.panelTab === "chat" && nextTab !== "chat") stopChatRecording();
  state.panelTab = nextTab;
  if (open) state.membersOpen = true;
  if (window.innerWidth <= 900) state.sidebarOpen = false;
  if (nextTab === "members") renderMembers();
  updateChrome();
}

function updateChrome() {
  const activeTab = state.panelTab === "members" ? "members" : "chat";
  state.panelTab = activeTab;
  app.classList.toggle("members-closed", !state.membersOpen);
  app.classList.toggle("sidebar-open", state.sidebarOpen);
  const narrowMembers = window.innerWidth <= 1180 && state.membersOpen;
  const narrowSidebar = window.innerWidth <= 900 && state.sidebarOpen;
  app.classList.toggle("scrim-on", narrowMembers || narrowSidebar);
  membersEl.dataset.tab = activeTab;

  const chatActive = state.membersOpen && activeTab === "chat";
  const membersActive = state.membersOpen && activeTab === "members";

  $("#chatBtn").classList.toggle("is-active", chatActive);
  $("#chatBtn").setAttribute("aria-label", chatActive ? "Ocultar chat do dono" : "Abrir chat do dono");
  $("#membersBtn").classList.toggle("is-active", membersActive);
  $("#membersBtn").setAttribute("aria-label", membersActive ? "Ocultar participantes" : "Mostrar participantes");
  $("#chatTabBtn").classList.toggle("is-active", activeTab === "chat");
  $("#membersTabBtn").classList.toggle("is-active", activeTab === "members");
  $("#chatTabBtn").setAttribute("aria-selected", String(activeTab === "chat"));
  $("#membersTabBtn").setAttribute("aria-selected", String(activeTab === "members"));
}

function syncAudioUI() {
  const muted = isMutedLocally();
  renderDock();
  renderSidebar();
  renderMembers();
  renderUserPanel();
  $$("[data-mic-local]").forEach((el) => {
    el.innerHTML = icon(muted ? "mic-off" : "mic", muted ? "is-muted" : "");
  });
}

function updateSpeakingUI() {
  const people = state.call ? callPeople() : [];
  const byId = new Map(people.map((p) => [p.id, p]));
  $$("[data-participant]").forEach((el) => {
    const participant = byId.get(el.dataset.participant);
    if (!participant) return;
    el.classList.toggle("is-speaking", Boolean(participant.speaking));
    if (el.classList.contains("member")) {
      const status = $("[data-status]", el);
      if (status) status.textContent = statusFor(participant);
    }
  });
}
