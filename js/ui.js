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
      const people =
        typeof livePeopleForChannel === "function"
          ? livePeopleForChannel(server.id, channel.id, joined)
          : joined
            ? [localParticipant(), ...channel.participants]
            : channel.participants;
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
    const count =
      typeof livePeopleForChannel === "function"
        ? livePeopleForChannel(server.id, channel.id, false).length
        : channel.participants.length;
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
  const screenSource = local ? state.screenSource : p.screenSource;
  const remoteScreen = !local && p.screen;
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
    ? `<span class="tile-badge">${screenSource === "camera" ? "Compartilhando câmera" : "Compartilhando tela"}</span>`
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
      ${remoteScreen ? `<button class="tile-watch" type="button" data-watch-screen="${escapeAttr(p.id)}">${icon(p.screenSource === "camera" ? "video" : "screen")} ${p.screenSource === "camera" ? "Ver câmera" : "Ver tela"}</button>` : ""}
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
  const server = displayedServer();
  const people =
    typeof livePeopleForChannel === "function"
      ? livePeopleForChannel(server?.id || state.serverId, channel.id, false)
      : channel.participants;
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
  if (p.live && !p.inCall) return "Online";
  if (p.speaking) return "Falando agora";
  if (p.screen) return p.screenSource === "camera" ? "Compartilhando câmera" : "Compartilhando tela";
  if (p.muted) return "Microfone mutado";
  return "Na escuta";
}

function memberMarkup(p) {
  const local = p.isLocal;
  const muted = local ? isMutedLocally() : p.muted;
  const screenOn = local ? state.screenStream : p.screen;
  const screenSource = local ? state.screenSource : p.screenSource;
  const icons = [
    muted ? icon("mic-off", "is-muted") : "",
    local && state.cameraStream ? icon("video") : "",
    screenOn ? icon(screenSource === "camera" ? "video" : "screen", "is-sharing") : "",
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
  const online = !inCall && typeof liveIsActive === "function" && liveIsActive();
  const server = displayedServer();
  const people = inCall
    ? callPeople()
    : online
      ? liveOnlineUsers(server?.id || state.serverId).map(liveParticipant)
      : channel.participants;
  const label = inCall ? "Na chamada" : online ? "Pessoas online" : "Pessoas na sala";
  const screener = people.find((p) => !p.isLocal && p.screen);
  const screenerCamera = screener?.screenSource === "camera";
  const cameraAllowed = state.mediaPolicy?.camera !== false;
  const screenAllowed = state.mediaPolicy?.screen !== false;

  view.innerHTML = `<header class="members-head">
      <div>
        <h3>${label}</h3>
        <p>${people.length} ${people.length === 1 ? "pessoa" : "pessoas"}</p>
      </div>
      ${isOwnerMode() ? `<span class="mod-badge">${icon("shield")} Modo dono</span>` : ""}
    </header>
    <div class="members-list">
      ${people.map(memberMarkup).join("") || `<p class="members-empty">${online ? "Ninguém online agora." : "Ninguém por aqui ainda."}</p>`}
    </div>
    <div class="members-foot">
      ${
        isOwnerMode()
          ? `<div class="media-permissions">
              <div class="media-permissions-head">
                <span>${icon("shield")} Permissões</span>
                <small>Você mantém acesso</small>
              </div>
              <button class="media-permission${cameraAllowed ? " is-on" : ""}" type="button"
                data-media-permission="camera" aria-pressed="${cameraAllowed}">
                <span>${icon("video")} Câmera</span>
                <b>${cameraAllowed ? "Permitida" : "Bloqueada"}</b>
              </button>
              <button class="media-permission${screenAllowed ? " is-on" : ""}" type="button"
                data-media-permission="screen" aria-pressed="${screenAllowed}">
                <span>${icon("screen")} Tela</span>
                <b>${screenAllowed ? "Permitida" : "Bloqueada"}</b>
              </button>
            </div>`
          : ""
      }
      <div class="invite-card">
        <span class="invite-orb">${icon("link")}</span>
        <strong>Convide para a sala</strong>
        <p>Qualquer pessoa com o link pode entrar nesta chamada.</p>
        <button class="btn-primary" id="inviteCardBtn" type="button">${icon("copy")} Copiar convite</button>
      </div>
      <button class="relay-watch" id="watchScreenBtn" type="button">
        <span class="relay-watch-icon">${icon(screenerCamera ? "video" : "screen")}</span>
        <span class="relay-watch-copy">
          <strong>${screener ? `Ver ${screenerCamera ? "câmera" : "tela"} de ${escapeHtml(screener.name)}` : "Assistir transmissão"}</strong>
          <small>${
            screener
              ? '<i class="relay-dot is-online"></i> P2P · ao vivo'
              : `<i class="relay-dot${relayDotClass()}" data-relay-dot></i> Proxy <span data-relay-region>${escapeHtml(relayRegionLabel())}</span>`
          }</small>
        </span>
        <span class="relay-watch-go">${icon("chevron-right")}</span>
      </button>
      ${
        inCall
          ? `<div class="call-stats">
            <div class="stat"><span>${icon("signal")} Latência</span><strong class="good"><b data-ping>${state.ping}</b> ms</strong></div>
            <div class="stat"><span>${icon("lock")} Criptografia</span><strong class="good">Ativa</strong></div>
            <div class="stat"><span>${icon("globe")} Conexão</span><strong>P2P</strong></div>
          </div>`
          : ""
      }
    </div>`;
}

function renderMiniCall() {
  const el = $("#callMini");
  if (!el) return;
  const open = Boolean(state.call && state.mini?.open);
  const previousVideo = $("#miniVideo", el);
  el.hidden = !open;
  if (!open) {
    if (previousVideo) previousVideo.srcObject = null;
    el.innerHTML = "";
    return;
  }
  const channel = callChannel();
  const people = callPeople();
  const remoteScreen = people.find((p) => !p.isLocal && p.screen) || null;
  const localStream = state.screenStream || state.cameraStream;
  const remoteStream =
    remoteScreen && typeof liveScreenStream === "function" ? liveScreenStream(remoteScreen.id) : null;
  const stream = localStream || remoteStream;
  const source = localStream
    ? state.screenSource === "camera"
      ? "camera"
      : "screen"
    : remoteScreen
      ? remoteScreen.screenSource === "camera"
        ? "camera"
        : "screen"
      : "";
  const speaker = people.find((p) => p.speaking) || people[0] || localParticipant();
  const ownerLabel = localStream
    ? source === "camera"
      ? "Sua câmera"
      : "Sua tela"
    : remoteScreen
      ? `${source === "camera" ? "Câmera" : "Tela"} de ${escapeHtml(remoteScreen.name)}`
      : "";
  const muted = isMutedLocally();
  const cameraAllowed = mediaPolicyAllows("camera");
  const screenAllowed = mediaPolicyAllows("screen");
  const localScreenCamera = state.screenStream && state.screenSource === "camera";

  el.innerHTML = `<div class="mini-head" data-mini-drag>
      <span class="mini-brand">${icon("wave")}</span>
      <div class="mini-title">
        <strong>Thom Call</strong>
        <small>${escapeHtml(channel?.name || "Chamada")}</small>
      </div>
      ${isNativeApp() ? `<button class="mini-icon" type="button" data-mini-action="overlay" aria-label="Sobreposição de tela" title="Sobreposição de tela">${icon("external")}</button>` : ""}
      <button class="mini-icon" type="button" data-mini-action="close" aria-label="Fechar mini janela">${icon("x")}</button>
    </div>
    <div class="mini-stage${stream ? " has-media" : ""}">
      ${
        stream
          ? '<video id="miniVideo" class="mini-video" autoplay playsinline muted></video>'
          : `<div class="mini-fallback">
              <span class="mini-orb" style="--av:${speaker.gradient}">${speaker.initials}</span>
              <strong>${speaker.isLocal ? "Você" : escapeHtml(speaker.name)}</strong>
              <small>${people.length} ${people.length === 1 ? "pessoa" : "pessoas"} na chamada</small>
            </div>`
      }
      ${ownerLabel ? `<span class="mini-badge">${icon(source === "camera" ? "video" : "screen")} ${ownerLabel}</span>` : ""}
    </div>
    <div class="mini-controls">
      <button class="mini-btn${muted ? " is-off" : ""}" type="button" data-mini-action="mic"
        aria-label="${muted ? "Ativar microfone" : "Silenciar microfone"}" title="${muted ? "Ativar microfone" : "Silenciar microfone"}">
        ${icon(muted ? "mic-off" : "mic")}
      </button>
      <button class="mini-btn${state.cameraStream ? " is-on" : ""}${cameraAllowed ? "" : " is-locked"}" type="button" data-mini-action="camera"
        aria-label="${cameraAllowed ? (state.cameraStream ? "Desligar câmera" : "Ligar câmera") : "Câmera bloqueada pelo dono"}"
        title="${cameraAllowed ? (state.cameraStream ? "Desligar câmera" : "Ligar câmera") : "Câmera bloqueada pelo dono"}">
        ${icon(cameraAllowed ? (state.cameraStream ? "video" : "video-off") : "lock")}
      </button>
      <button class="mini-btn${state.screenStream ? " is-sharing" : ""}${screenAllowed ? "" : " is-locked"}" type="button" data-mini-action="screen"
        aria-label="${screenAllowed ? (state.screenStream ? "Parar transmissão" : "Compartilhar tela") : "Tela bloqueada pelo dono"}"
        title="${screenAllowed ? (state.screenStream ? "Parar transmissão" : "Compartilhar tela") : "Tela bloqueada pelo dono"}">
        ${icon(screenAllowed ? (localScreenCamera ? "video" : "screen") : "lock")}
      </button>
      <span class="mini-spacer"></span>
      <button class="mini-btn danger" type="button" data-mini-action="leave" aria-label="Sair da chamada" title="Sair da chamada">
        ${icon("phone-off")}
      </button>
    </div>`;
  const video = $("#miniVideo", el);
  if (video && stream) {
    if (video.srcObject !== stream) video.srcObject = stream;
    video.play?.().catch(() => {});
  }
}

function renderDock() {
  const miniBtn = $("#miniBtn");
  if (miniBtn) {
    miniBtn.hidden = !state.call;
    miniBtn.classList.toggle("is-active", Boolean(state.call && state.mini?.open));
  }
  if (!state.call) {
    dockWrap.classList.add("is-hidden");
    dockEl.innerHTML = "";
    renderMiniCall();
    return;
  }
  dockWrap.classList.remove("is-hidden");
  const muted = state.micMuted;
  const cameraAllowed = mediaPolicyAllows("camera");
  const screenAllowed = mediaPolicyAllows("screen");

  dockEl.innerHTML = `<button class="dock-btn${muted ? " is-off" : ""}" type="button" data-action="mic"
      data-tip="${muted ? "Ativar microfone" : "Silenciar microfone"}" aria-pressed="${muted}">
      ${icon(muted ? "mic-off" : "mic")}<span class="dock-label">${muted ? "Mudo" : "Microfone"}</span>
    </button>
    <button class="dock-btn${state.deafened ? " is-off" : ""}" type="button" data-action="deafen"
      data-tip="${state.deafened ? "Ativar áudio" : "Desativar áudio"}" aria-pressed="${state.deafened}">
      ${icon(state.deafened ? "headphones-off" : "headphones")}<span class="dock-label">${state.deafened ? "Surdo" : "Áudio"}</span>
    </button>
    <button class="dock-btn${state.cameraStream ? " is-on" : ""}${cameraAllowed ? "" : " is-locked"}" type="button" data-action="camera"
      data-tip="${cameraAllowed ? (state.cameraStream ? "Desligar câmera" : "Ligar câmera") : "Câmera bloqueada pelo dono"}" aria-pressed="${Boolean(state.cameraStream)}">
      ${icon(cameraAllowed ? (state.cameraStream ? "video" : "video-off") : "lock")}<span class="dock-label">Câmera</span>
    </button>
    <button class="dock-btn${state.screenStream ? " is-sharing" : ""}${screenAllowed ? "" : " is-locked"}" type="button" data-action="screen"
      data-tip="${screenAllowed ? (state.screenStream ? (state.screenSource === "camera" ? "Parar câmera" : "Parar transmissão") : "Compartilhar tela") : "Tela bloqueada pelo dono"}" aria-pressed="${Boolean(state.screenStream)}">
      ${icon(screenAllowed ? (state.screenStream && state.screenSource === "camera" ? "video" : "screen") : "lock")}<span class="dock-label">${screenAllowed && state.screenStream && state.screenSource === "camera" ? "Câmera" : "Tela"}</span>
    </button>
    <span class="dock-sep" aria-hidden="true"></span>
    <button class="dock-btn danger" type="button" data-action="leave" data-tip="Sair da chamada">
      ${icon("phone-off")}<span class="dock-label">Sair</span>
    </button>`;
  renderMiniCall();
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
