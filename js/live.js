const LIVE_CLIENT_KEY = "thom.live.client.v1";
const LIVE_BANNED_KEY = "thom.live.banned.v1";
const LIVE_HEARTBEAT_MS = 8000;
const LIVE_STALE_MS = 30000;
const LIVE_NAMESPACE = String((window.THOM_CONFIG || {}).realtimeNamespace || "thomcall-v1").replace(/\/+$/, "");
const LIVE_PRESENCE_ROOT = `${LIVE_NAMESPACE}/presence`;
const LIVE_SIGNAL_ROOT = `${LIVE_NAMESPACE}/signal`;
const LIVE_POLICY_TOPIC = `${LIVE_NAMESPACE}/policy`;

function liveClientId() {
  let id = "";
  try {
    id = sessionStorage.getItem(LIVE_CLIENT_KEY) || "";
  } catch {
    id = "";
  }
  if (!id) {
    const random =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().replaceAll("-", "").slice(0, 12)
        : Math.random().toString(36).slice(2, 14);
    id = `u${random}`;
    try {
      sessionStorage.setItem(LIVE_CLIENT_KEY, id);
    } catch {
    }
  }
  return id;
}

const live = {
  clientId: liveClientId(),
  client: null,
  connected: false,
  connecting: false,
  started: false,
  banned: false,
  brokerIndex: 0,
  brokerUrl: "",
  users: new Map(),
  peers: new Map(),
  localStream: null,
  audioPromise: null,
  selfSpeaking: false,
  callServerId: "",
  callChannelId: "",
  muteTimer: 0,
  heartbeat: 0,
  pruneTimer: 0,
  renderTimer: 0,
  presenceTimer: 0,
  reconnectTimer: 0,
  audioContext: null,
  analysers: new Map(),
};

function liveIsActive() {
  return typeof getAuthSession === "function" && Boolean(getAuthSession());
}

function liveIsConnected() {
  return live.connected;
}

function liveRealtimeUrls() {
  const config = window.THOM_CONFIG || {};
  const urls = [];
  if (Array.isArray(config.realtimeUrls)) urls.push(...config.realtimeUrls);
  if (config.realtimeUrl) urls.push(config.realtimeUrl);
  return [...new Set(urls.map((url) => String(url || "").trim()).filter(Boolean))];
}

function liveSelfPresence() {
  const session = typeof getAuthSession === "function" ? getAuthSession() : null;
  const inCall = Boolean(state.call);
  return {
    id: live.clientId,
    name: session?.name || "Convidado",
    initials: session?.initials || "C",
    gradient: localUser.gradient,
    serverId: inCall ? state.call.serverId : state.serverId,
    channelId: inCall ? state.call.channelId : state.selectedChannelId || "",
    inCall,
    muted: isMutedLocally(),
    camera: Boolean(state.cameraStream),
    screen: Boolean(state.screenStream),
    screenSource: state.screenStream ? state.screenSource || "display" : "",
    ts: Date.now(),
  };
}

function livePublishPresence(immediate = false) {
  if (!live.connected || !live.client) return;
  if (!immediate) {
    if (live.presenceTimer) return;
    live.presenceTimer = window.setTimeout(() => {
      live.presenceTimer = 0;
      livePublishPresence(true);
    }, 80);
    return;
  }
  try {
    live.client.publish(`${LIVE_PRESENCE_ROOT}/${live.clientId}`, JSON.stringify(liveSelfPresence()), {
      qos: 0,
      retain: true,
    });
  } catch {
  }
}

function livePublishMediaPolicy() {
  if (!live.connected || !live.client || typeof isOwnerMode !== "function" || !isOwnerMode()) return false;
  const payload = {
    camera: state.mediaPolicy?.camera !== false,
    screen: state.mediaPolicy?.screen !== false,
    at: Date.now(),
  };
  try {
    live.client.publish(LIVE_POLICY_TOPIC, JSON.stringify(payload), { qos: 0, retain: true });
    return true;
  } catch {
    return false;
  }
}

function liveHandleMediaPolicy(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return;
  }
  if (!data || typeof data !== "object") return;
  const next = {
    camera: data.camera !== false,
    screen: data.screen !== false,
  };
  if (state.mediaPolicy?.camera === next.camera && state.mediaPolicy?.screen === next.screen) return;
  state.mediaPolicy = next;
  if (typeof applyMediaPolicy === "function") applyMediaPolicy();
}

function liveParticipant(user) {
  return {
    id: user.id,
    name: user.name || "Convidado",
    initials: user.initials || "C",
    gradient: user.gradient || AV_GRADIENTS[0],
    muted: Boolean(user.muted),
    speaking: Boolean(user.speaking),
    screen: Boolean(user.screen),
    screenSource: user.screenSource === "camera" ? "camera" : user.screen ? "display" : "",
    camera: Boolean(user.camera),
    host: false,
    live: true,
    inCall: Boolean(user.inCall),
    channelId: user.channelId || "",
  };
}

function liveUsersInChannel(serverId, channelId) {
  if (!serverId || !channelId) return [];
  return [...live.users.values()]
    .filter(
      (user) =>
        user.inCall &&
        user.serverId === serverId &&
        user.channelId === channelId &&
        !(typeof bannedIds !== "undefined" && bannedIds.has(user.id)),
    )
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function liveOnlineUsers(serverId) {
  return [...live.users.values()]
    .filter(
      (user) =>
        user.serverId === serverId &&
        !(typeof bannedIds !== "undefined" && bannedIds.has(user.id)),
    )
    .sort((a, b) => Number(b.inCall) - Number(a.inCall) || String(a.name).localeCompare(String(b.name)));
}

function livePeopleForChannel(serverId, channelId, includeLocal = false) {
  if (!liveIsActive()) {
    const channel = getChannel(serverId, channelId);
    const fallback = channel?.participants || [];
    return includeLocal ? [localParticipant(), ...fallback] : fallback;
  }
  const remote = liveUsersInChannel(serverId, channelId).map(liveParticipant);
  return includeLocal ? [localParticipant(), ...remote] : remote;
}

function liveScheduleRender() {
  if (live.renderTimer) return;
  live.renderTimer = window.setTimeout(() => {
    live.renderTimer = 0;
    if (typeof renderAll === "function") renderAll();
  }, 120);
}

function livePrune() {
  const now = Date.now();
  let changed = false;
  for (const [id, user] of live.users) {
    if (now - (user._seen || 0) > LIVE_STALE_MS) {
      live.users.delete(id);
      liveClosePeer(id);
      changed = true;
    }
  }
  if (changed) liveScheduleRender();
}

function liveHandlePresence(topic, text) {
  const id = topic.slice(LIVE_PRESENCE_ROOT.length + 1);
  if (!id || id === live.clientId) return;
  if (!text) {
    if (live.users.delete(id)) {
      liveClosePeer(id);
      liveScheduleRender();
    }
    return;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return;
  }
  if (!data || typeof data !== "object" || data.id !== id) return;
  if (typeof bannedIds !== "undefined" && bannedIds.has(id)) {
    if (live.users.delete(id)) liveClosePeer(id);
    return;
  }
  const previous = live.users.get(id);
  const next = { ...data, _seen: Date.now() };
  live.users.set(id, next);
  if (
    state.call &&
    next.inCall &&
    next.serverId === state.call.serverId &&
    next.channelId === state.call.channelId
  ) {
    liveEnsurePeer(id);
    if (!next.screen) {
      const entry = live.peers.get(id);
      if (entry?.remoteScreenStream) {
        entry.remoteScreenStream = null;
        liveNotifyScreen(id);
      }
    }
  } else {
    liveClosePeer(id);
  }
  const fields = ["name", "initials", "gradient", "serverId", "channelId", "inCall", "muted", "camera", "screen", "screenSource"];
  const changed = !previous || fields.some((field) => previous[field] !== next[field]);
  if (changed) liveScheduleRender();
}

function liveSendSignal(to, payload) {
  if (!live.connected || !live.client || !to) return;
  try {
    live.client.publish(
      `${LIVE_SIGNAL_ROOT}/${to}`,
      JSON.stringify({ ...payload, from: live.clientId, to }),
      { qos: 0 },
    );
  } catch {
  }
}

function liveConnect() {
  if (!liveIsActive() || live.client || live.connecting) return;
  if (typeof mqtt === "undefined" || typeof mqtt.connect !== "function") {
    toast("Biblioteca de conexão online indisponível.", { type: "error", icon: "globe" });
    return;
  }
  const urls = liveRealtimeUrls();
  if (!urls.length) return;
  live.connecting = true;
  live.brokerIndex = 0;
  liveTryBroker(urls);
}

function liveTryBroker(urls) {
  if (live.brokerIndex >= urls.length) {
    live.connecting = false;
    live.brokerUrl = "";
    toast("Não foi possível conectar aos usuários online. Tentando novamente.", {
      type: "error",
      icon: "globe",
    });
    liveScheduleRender();
    if (!live.reconnectTimer) {
      live.reconnectTimer = window.setTimeout(() => {
        live.reconnectTimer = 0;
        if (live.started && !live.client) liveConnect();
      }, 15000);
    }
    return;
  }
  const url = urls[live.brokerIndex];
  let settled = false;
  const client = mqtt.connect(url, {
    clientId: `thom_${live.clientId}`,
    clean: true,
    connectTimeout: 8000,
    reconnectPeriod: 4000,
    keepalive: 30,
    will: {
      topic: `${LIVE_PRESENCE_ROOT}/${live.clientId}`,
      payload: "",
      qos: 0,
      retain: true,
    },
  });
  live.brokerUrl = url;

  const fail = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    try {
      client.end(true);
    } catch {
    }
    live.brokerIndex += 1;
    liveTryBroker(urls);
  };
  const timer = window.setTimeout(fail, 9000);

  client.on("connect", () => {
    if (live.client && live.client !== client) return;
    settled = true;
    window.clearTimeout(timer);
    live.client = client;
    live.connected = true;
    live.connecting = false;
    client.subscribe(
      [`${LIVE_PRESENCE_ROOT}/+`, `${LIVE_SIGNAL_ROOT}/${live.clientId}`, LIVE_POLICY_TOPIC],
      { qos: 0 },
    );
    livePublishPresence(true);
    if (typeof livePublishMediaPolicy === "function") livePublishMediaPolicy();
    liveSyncVoice();
    liveScheduleRender();
  });

  client.on("message", (topic, payload) => {
    if (live.client !== client) return;
    if (topic.startsWith(`${LIVE_PRESENCE_ROOT}/`)) {
      liveHandlePresence(topic, payload.toString());
      return;
    }
    if (topic === LIVE_POLICY_TOPIC) {
      liveHandleMediaPolicy(payload.toString());
      return;
    }
    if (topic === `${LIVE_SIGNAL_ROOT}/${live.clientId}`) {
      let data;
      try {
        data = JSON.parse(payload.toString());
      } catch {
        return;
      }
      liveHandleSignal(data);
    }
  });

  client.on("error", () => {
    if (!settled) fail();
  });

  client.on("close", () => {
    if (live.client !== client) return;
    live.connected = false;
    liveScheduleRender();
  });

  client.on("offline", () => {
    if (live.client !== client) return;
    live.connected = false;
    liveScheduleRender();
  });
}

function liveHandleSignal(data) {
  if (!data || typeof data !== "object" || data.to !== live.clientId) return;
  const from = typeof data.from === "string" ? data.from : "";
  if (!from || from === live.clientId) return;
  if (data.type === "description") {
    liveOnDescription(from, data.description);
    return;
  }
  if (data.type === "candidate") {
    liveOnCandidate(from, data.candidate);
    return;
  }
  if (data.type === "bye") {
    liveClosePeer(from);
    return;
  }
  if (data.type === "moderate") {
    liveHandleModeration(data);
  }
}

function liveClearMuteTimer() {
  if (!live.muteTimer) return;
  window.clearTimeout(live.muteTimer);
  live.muteTimer = 0;
}

function liveMuteExpired() {
  live.muteTimer = 0;
  if (!state.call || !state.micMuted) return;
  state.micMuted = false;
  liveEnsureLocalAudio().then(() => {
    if (!state.call) return;
    if (typeof liveApplyMicState === "function") liveApplyMicState();
    if (typeof syncAudioUI === "function") syncAudioUI();
    livePublishPresence();
    toast("Seu mute temporário terminou.", { type: "info", icon: "mic" });
  }).catch(() => {
    state.micMuted = true;
    if (typeof syncAudioUI === "function") syncAudioUI();
  });
}

function liveScheduleMuteTimer(durationMs) {
  liveClearMuteTimer();
  const ms = Math.max(0, Number(durationMs) || 0);
  if (!ms) return;
  live.muteTimer = window.setTimeout(liveMuteExpired, Math.min(ms, 2147483647));
}

function liveHandleModeration(data) {
  const action = String(data.action || "");
  if (action === "mute") {
    const durationMs = Math.max(0, Number(data.durationMs) || 0);
    state.micMuted = true;
    if (typeof liveApplyMicState === "function") liveApplyMicState();
    if (typeof syncAudioUI === "function") syncAudioUI();
    if (durationMs) liveScheduleMuteTimer(durationMs);
    else liveClearMuteTimer();
    livePublishPresence();
    toast(
      durationMs
        ? `O dono silenciou seu microfone por ${formatMuteDuration(durationMs)}.`
        : "O dono silenciou seu microfone.",
      { type: "info", icon: "mic-off" },
    );
    return;
  }
  if (action === "unmute") {
    liveClearMuteTimer();
    if (!state.call) return;
    state.micMuted = false;
    liveEnsureLocalAudio().then(() => {
      liveApplyMicState();
      if (typeof syncAudioUI === "function") syncAudioUI();
      livePublishPresence();
    }).catch(() => {
      state.micMuted = true;
      if (typeof syncAudioUI === "function") syncAudioUI();
    });
    toast("O dono liberou seu microfone.", { type: "info", icon: "mic" });
    return;
  }
  if (action === "kick" || action === "ban") {
    liveClearMuteTimer();
    if (action === "ban") {
      live.banned = true;
      try {
        sessionStorage.setItem(LIVE_BANNED_KEY, "1");
      } catch {
      }
    }
    if (state.call && typeof leaveCall === "function") leaveCall({ silent: true });
    toast(
      action === "ban"
        ? "Você foi removido do Thom Call pelo dono."
        : "Você foi removido da sala pelo dono.",
      { type: "error", icon: "shield" },
    );
  }
}

function liveModerate(action, targetId, options = {}) {
  if (!live.connected || !targetId) return false;
  const payload = { type: "moderate", action, fromName: getAuthSession()?.name || "Dono" };
  const durationMs = Math.max(0, Number(options.durationMs) || 0);
  if (action === "mute" && durationMs) payload.durationMs = durationMs;
  liveSendSignal(targetId, payload);
  return true;
}

function liveSetMuted(userId, muted) {
  const user = live.users.get(userId);
  if (!user) return;
  user.muted = Boolean(muted);
  user.speaking = false;
  liveScheduleRender();
}

function liveRemoveUser(userId) {
  const removed = live.users.delete(userId);
  liveClosePeer(userId);
  if (removed) liveScheduleRender();
  return removed;
}

function liveEnsurePeer(peerId, force = false) {
  if (live.peers.has(peerId)) return live.peers.get(peerId);
  if (typeof RTCPeerConnection !== "function") return null;
  const user = live.users.get(peerId);
  if (!force && (!user || !user.inCall || !state.call)) return null;
  if (!state.call) return null;

  const config = window.THOM_CONFIG || {};
  const iceServers = Array.isArray(config.iceServers) && config.iceServers.length
    ? config.iceServers
    : [{ urls: "stun:stun.l.google.com:19302" }];
  const pc = new RTCPeerConnection({ iceServers });
  const audio = document.createElement("audio");
  audio.className = "live-audio";
  audio.autoplay = true;
  audio.playsInline = true;
  audio.muted = state.deafened;
  audio.style.display = "none";
  audio.dataset.peer = peerId;
  document.body.append(audio);

  const entry = {
    pc,
    audioEl: audio,
    remoteStream: null,
    remoteScreenStream: null,
    audioSender: null,
    audioTransceiver: null,
    videoSender: null,
    videoTransceiver: null,
    candidates: [],
    makingOffer: false,
    ignoreOffer: false,
    polite: live.clientId > peerId,
    restarted: false,
  };
  live.peers.set(peerId, entry);

  pc.onnegotiationneeded = async () => {
    if (!live.peers.has(peerId)) return;
    try {
      entry.makingOffer = true;
      await pc.setLocalDescription();
      liveSendSignal(peerId, { type: "description", description: pc.localDescription });
    } catch {
    } finally {
      entry.makingOffer = false;
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      liveSendSignal(peerId, { type: "candidate", candidate: event.candidate });
    }
  };

  pc.ontrack = (event) => {
    if (event.track.kind === "video") {
      entry.remoteScreenStream = event.streams[0] || new MediaStream([event.track]);
      event.track.addEventListener("ended", () => {
        if (entry.remoteScreenStream?.getVideoTracks().includes(event.track)) {
          entry.remoteScreenStream = null;
          liveNotifyScreen(peerId);
        }
      });
      liveNotifyScreen(peerId);
      return;
    }
    if (event.track.kind !== "audio") return;
    const stream = event.streams[0] || new MediaStream([event.track]);
    entry.remoteStream = stream;
    entry.audioEl.srcObject = stream;
    entry.audioEl.muted = state.deafened;
    entry.audioEl.play?.().catch(() => {
    });
    liveAttachAnalyser(`peer:${peerId}`, stream);
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" && !entry.restarted) {
      entry.restarted = true;
      try {
        pc.restartIce();
      } catch {
      }
    }
  };

  if (live.localStream?.getAudioTracks().length) {
    const track = live.localStream.getAudioTracks()[0];
    entry.audioSender = pc.addTrack(track, live.localStream);
    entry.audioTransceiver = pc.getTransceivers().find((item) => item.sender === entry.audioSender) || null;
  } else {
    entry.audioTransceiver = pc.addTransceiver("audio", { direction: "recvonly" });
    entry.audioSender = entry.audioTransceiver.sender;
  }

  entry.videoTransceiver = pc.addTransceiver("video", { direction: "recvonly" });
  entry.videoSender = entry.videoTransceiver.sender;
  if (state.screenStream) liveAttachScreenToPeer(entry, state.screenStream);

  return entry;
}

function liveAttachScreenToPeer(entry, stream) {
  const track = stream?.getVideoTracks()[0];
  if (!entry || !track) return;
  if (!entry.videoSender) {
    entry.videoSender = entry.pc.addTrack(track, stream);
    entry.videoTransceiver = entry.pc.getTransceivers().find((item) => item.sender === entry.videoSender) || null;
  } else if (entry.videoSender.track !== track) {
    entry.videoSender.replaceTrack(track).catch(() => {
    });
  }
  if (entry.videoTransceiver && !["sendrecv", "sendonly"].includes(entry.videoTransceiver.direction)) {
    entry.videoTransceiver.direction = "sendrecv";
  }
}

function liveDetachScreenFromPeer(entry) {
  if (!entry) return;
  if (entry.videoSender?.track) {
    try {
      entry.pc.removeTrack(entry.videoSender);
    } catch {
    }
  }
  if (entry.videoTransceiver && entry.videoTransceiver.direction !== "recvonly") {
    entry.videoTransceiver.direction = "recvonly";
  }
}

function liveSyncScreen() {
  for (const entry of live.peers.values()) {
    if (state.call && state.screenStream) liveAttachScreenToPeer(entry, state.screenStream);
    else liveDetachScreenFromPeer(entry);
  }
}

function startLiveScreen(stream) {
  if (!stream || !state.call) return false;
  liveSyncScreen();
  return true;
}

function stopLiveScreen() {
  for (const entry of live.peers.values()) liveDetachScreenFromPeer(entry);
}

function liveScreenStream(peerId) {
  return live.peers.get(peerId)?.remoteScreenStream || null;
}

function liveNotifyScreen(peerId) {
  if (typeof refreshLiveScreenViewer === "function") refreshLiveScreenViewer(peerId);
  liveScheduleRender();
}

function liveAttachLocalToPeer(entry) {
  if (!live.localStream) return;
  const track = live.localStream.getAudioTracks()[0];
  if (!track) return;
  if (entry.audioSender) {
    if (entry.audioSender.track !== track) entry.audioSender.replaceTrack(track).catch(() => {
    });
    if (entry.audioTransceiver && !["sendrecv", "sendonly"].includes(entry.audioTransceiver.direction)) {
      entry.audioTransceiver.direction = "sendrecv";
    }
    return;
  }
  entry.audioSender = entry.pc.addTrack(track, live.localStream);
  entry.audioTransceiver = entry.pc.getTransceivers().find((item) => item.sender === entry.audioSender) || null;
}

async function liveOnDescription(from, description) {
  if (!description || typeof description !== "object") return;
  const entry = liveEnsurePeer(from, true);
  if (!entry) return;
  const pc = entry.pc;
  try {
    const collision =
      description.type === "offer" && (entry.makingOffer || pc.signalingState !== "stable");
    entry.ignoreOffer = !entry.polite && collision;
    if (entry.ignoreOffer) return;
    if (collision) {
      await Promise.all([
        pc.setLocalDescription({ type: "rollback" }),
        pc.setRemoteDescription(description),
      ]);
    } else {
      await pc.setRemoteDescription(description);
    }
    if (description.type === "offer") {
      await pc.setLocalDescription();
      liveSendSignal(from, { type: "description", description: pc.localDescription });
    }
    for (const candidate of entry.candidates.splice(0)) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
      }
    }
  } catch {
    if (!entry.polite) liveClosePeer(from);
  }
}

function liveOnCandidate(from, candidate) {
  if (!candidate) return;
  const entry = liveEnsurePeer(from, true);
  if (!entry) return;
  if (entry.pc.remoteDescription) {
    entry.pc.addIceCandidate(candidate).catch(() => {
    });
  } else {
    entry.candidates.push(candidate);
  }
}

function liveClosePeer(peerId, sendBye = false) {
  const entry = live.peers.get(peerId);
  if (!entry) return;
  if (sendBye) liveSendSignal(peerId, { type: "bye" });
  if (entry.remoteScreenStream) {
    entry.remoteScreenStream = null;
    liveNotifyScreen(peerId);
  }
  live.peers.delete(peerId);
  try {
    entry.pc.onnegotiationneeded = null;
    entry.pc.onicecandidate = null;
    entry.pc.ontrack = null;
    entry.pc.onconnectionstatechange = null;
    entry.pc.close();
  } catch {
  }
  if (entry.audioEl) {
    entry.audioEl.srcObject = null;
    entry.audioEl.remove();
  }
  liveDetachAnalyser(`peer:${peerId}`);
}

function liveCloseAllPeers(sendBye = false) {
  for (const peerId of [...live.peers.keys()]) liveClosePeer(peerId, sendBye);
}

function liveSyncVoice() {
  const call = state.call;
  if (!call) {
    liveCloseAllPeers();
    return;
  }
  for (const [id, user] of live.users) {
    if (user.inCall && user.serverId === call.serverId && user.channelId === call.channelId) {
      liveEnsurePeer(id);
    } else {
      liveClosePeer(id);
    }
  }
  for (const id of [...live.peers.keys()]) {
    if (!live.users.has(id)) liveClosePeer(id);
  }
  liveSyncScreen();
}

function liveEnsureLocalAudio() {
  if (live.localStream) return Promise.resolve(live.localStream);
  if (live.audioPromise) return live.audioPromise;
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error("microphone unavailable"));
  }
  const settings = state.settings || {};
  const audio = {
    echoCancellation: settings.echo !== false,
    noiseSuppression: settings.noise !== false,
    autoGainControl: settings.agc !== false,
  };
  if (settings.input) audio.deviceId = { exact: settings.input };
  const request = (async () => {
    try {
      live.localStream = await navigator.mediaDevices.getUserMedia({ audio });
    } catch (error) {
      if (!settings.input) throw error;
      delete audio.deviceId;
      live.localStream = await navigator.mediaDevices.getUserMedia({ audio });
    }
    liveApplyMicState();
    for (const entry of live.peers.values()) liveAttachLocalToPeer(entry);
    liveAttachAnalyser("self", live.localStream);
    const track = live.localStream.getAudioTracks()[0];
    track?.addEventListener("ended", () => {
      if (live.localStream?.getAudioTracks().includes(track)) {
        liveDetachAnalyser("self");
        live.localStream = null;
      }
    });
    return live.localStream;
  })();
  live.audioPromise = request.finally(() => {
    live.audioPromise = null;
  });
  return live.audioPromise;
}

function liveApplyMicState() {
  const track = live.localStream?.getAudioTracks()[0];
  if (track) track.enabled = !isMutedLocally();
  for (const entry of live.peers.values()) {
    if (entry.audioEl) entry.audioEl.muted = state.deafened;
  }
}

function liveAttachAnalyser(key, stream) {
  liveDetachAnalyser(key);
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    if (!live.audioContext) live.audioContext = new AudioCtor();
    const source = live.audioContext.createMediaStreamSource(stream);
    const analyser = live.audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const holder = { source, analyser, data, raf: 0 };
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let index = 0; index < data.length; index += 1) {
        const value = (data[index] - 128) / 128;
        sum += value * value;
      }
      const speaking = Math.sqrt(sum / data.length) > 0.035;
      if (key === "self") {
        live.selfSpeaking = speaking;
      } else {
        const user = live.users.get(key.slice(5));
        if (user) user.speaking = speaking;
      }
      holder.raf = window.requestAnimationFrame(tick);
    };
    tick();
    live.analysers.set(key, holder);
  } catch {
  }
}

function liveDetachAnalyser(key) {
  const holder = live.analysers.get(key);
  if (!holder) return;
  window.cancelAnimationFrame(holder.raf);
  try {
    holder.source.disconnect();
    holder.analyser.disconnect();
  } catch {
  }
  live.analysers.delete(key);
  if (key === "self") live.selfSpeaking = false;
}

async function startLiveVoice(serverId, channelId) {
  if (!liveIsActive()) return;
  if (live.banned || sessionStorage.getItem(LIVE_BANNED_KEY) === "1") {
    live.banned = true;
    toast("Você foi banido do Thom Call pelo dono.", { type: "error", icon: "ban" });
    if (typeof leaveCall === "function") leaveCall({ silent: true });
    return;
  }
  live.callServerId = serverId;
  live.callChannelId = channelId;
  livePublishPresence();
  try {
    await liveEnsureLocalAudio();
  } catch {
    state.micMuted = true;
    if (typeof syncAudioUI === "function") syncAudioUI();
    toast("Não foi possível acessar o microfone. Você entrou em modo ouvinte.", {
      type: "info",
      icon: "mic-off",
    });
  }
  if (!state.call) {
    stopLiveVoice();
    return;
  }
  if (state.call.serverId !== serverId || state.call.channelId !== channelId) return;
  liveSyncVoice();
  livePublishPresence();
}

function stopLiveVoice() {
  liveCloseAllPeers(true);
  if (live.localStream) {
    live.localStream.getTracks().forEach((track) => track.stop());
    live.localStream = null;
  }
  liveDetachAnalyser("self");
  live.callServerId = "";
  live.callChannelId = "";
  livePublishPresence();
}

function startLive() {
  if (!liveIsActive() || live.started) return;
  live.started = true;
  liveConnect();
  if (!live.heartbeat) {
    live.heartbeat = window.setInterval(() => livePublishPresence(true), LIVE_HEARTBEAT_MS);
  }
  if (!live.pruneTimer) {
    live.pruneTimer = window.setInterval(livePrune, 5000);
  }
  liveScheduleRender();
}

function stopLive() {
  live.started = false;
  window.clearInterval(live.heartbeat);
  window.clearInterval(live.pruneTimer);
  window.clearTimeout(live.reconnectTimer);
  window.clearTimeout(live.presenceTimer);
  live.heartbeat = 0;
  live.pruneTimer = 0;
  live.reconnectTimer = 0;
  live.presenceTimer = 0;
  if (live.client) {
    try {
      live.client.publish(`${LIVE_PRESENCE_ROOT}/${live.clientId}`, "", { qos: 0, retain: true });
    } catch {
    }
    try {
      live.client.end(true);
    } catch {
    }
  }
  live.client = null;
  live.connected = false;
  live.connecting = false;
  live.brokerUrl = "";
  live.users.clear();
  stopLiveVoice();
  liveScheduleRender();
}

function initLive() {
  try {
    if (sessionStorage.getItem(LIVE_BANNED_KEY) === "1") live.banned = true;
  } catch {
  }
  if (liveIsActive()) startLive();
  window.addEventListener("beforeunload", () => {
    if (live.started) stopLive();
  });
}
