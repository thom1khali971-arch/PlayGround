const MODERATION_KEY = "thom.moderation.v1";
const bannedIds = loadBannedIds();

function loadBannedIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(MODERATION_KEY) || "{}");
    return new Set(Array.isArray(saved.banned) ? saved.banned : []);
  } catch {
    return new Set();
  }
}

function persistBannedIds() {
  try {
    localStorage.setItem(MODERATION_KEY, JSON.stringify({ banned: [...bannedIds] }));
  } catch {
    return;
  }
}

function moderationNormalize(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const MUTE_MAX_MS = 7 * 24 * 60 * 60 * 1000;
const muteExpiryTimers = new Map();

function persistMediaPolicy() {
  try {
    localStorage.setItem(MEDIA_POLICY_KEY, JSON.stringify(state.mediaPolicy));
  } catch {
    return;
  }
}

function setMediaPermission(kind, allowed) {
  if (!isOwnerMode()) {
    return { ok: false, tone: "error", icon: "lock", text: "Apenas o dono pode alterar as permissões." };
  }
  if (!["camera", "screen"].includes(kind)) {
    return { ok: false, tone: "error", icon: "lock", text: "Permissão inválida. Use câmera ou tela." };
  }
  state.mediaPolicy[kind] = Boolean(allowed);
  persistMediaPolicy();
  if (typeof livePublishMediaPolicy === "function") livePublishMediaPolicy();
  if (typeof applyMediaPolicy === "function") applyMediaPolicy();
  else if (typeof renderAll === "function") renderAll();
  const label = kind === "camera" ? "Câmera" : "Tela";
  return {
    ok: true,
    tone: "success",
    icon: allowed ? "lock-open" : "lock",
    sfx: allowed ? "unmute" : "mute",
    text: `${label} ${allowed ? "liberada" : "bloqueada"} para os participantes.`,
  };
}

function toggleMediaPermission(kind) {
  return setMediaPermission(kind, state.mediaPolicy?.[kind] === false);
}

function parseMuteDuration(raw) {
  const source = moderationNormalize(raw);
  if (!source.trim() || /\d\s+\d/.test(source)) return 0;
  let text = source.replace(/[\s,]+/g, "");
  text = text.replace(/(?<=[a-z])e(?=\d)/g, "");
  text = text.replace(/^(\d+)h(\d{1,2})$/, "$1h$2m");
  const units = {
    s: 1000,
    seg: 1000,
    segundos: 1000,
    m: 60000,
    min: 60000,
    minutos: 60000,
    h: 3600000,
    hora: 3600000,
    horas: 3600000,
    d: 86400000,
    dia: 86400000,
    dias: 86400000,
  };
  const pattern = /(\d+)(segundos?|seg|s|minutos?|min|m|horas?|h|dias?|d)/g;
  let total = 0;
  let index = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index !== index) return 0;
    index = pattern.lastIndex;
    total += Number(match[1]) * (units[match[2]] || 0);
  }
  return index === text.length ? total : 0;
}

function formatMuteDuration(ms) {
  const total = Math.max(1, Math.round(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts = [];
  if (days) parts.push(`${days} ${days === 1 ? "dia" : "dias"}`);
  if (hours) parts.push(`${hours} ${hours === 1 ? "hora" : "horas"}`);
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? "minuto" : "minutos"}`);
  if (seconds) parts.push(`${seconds} ${seconds === 1 ? "segundo" : "segundos"}`);
  return parts.join(" e ");
}

function parseMuteCommand(argument) {
  const trimmed = String(argument).trim();
  for (let index = 0; index < trimmed.length; index += 1) {
    if (!/\d/.test(trimmed[index])) continue;
    if (index > 0 && !/\s/.test(trimmed[index - 1])) continue;
    const durationMs = parseMuteDuration(trimmed.slice(index));
    if (!durationMs) continue;
    if (durationMs > MUTE_MAX_MS) {
      return { error: "O tempo máximo de mute é 7 dias." };
    }
    const query = trimmed.slice(0, index).trim();
    if (!query) {
      return { error: "Informe o nome de quem deseja mutar." };
    }
    return { query, durationMs };
  }
  return { error: "Informe o nome e um tempo válido. Ex.: /mutar Ana 10m, 30s ou 1h30m." };
}

function clearMuteExpiry(participantId) {
  const timer = muteExpiryTimers.get(participantId);
  if (!timer) return;
  window.clearTimeout(timer);
  muteExpiryTimers.delete(participantId);
}

function scheduleMuteExpiry(participant, durationMs) {
  clearMuteExpiry(participant.id);
  if (!(durationMs > 0)) return;
  const timer = window.setTimeout(() => {
    muteExpiryTimers.delete(participant.id);
    if (!isOwnerMode()) return;
    const channel = currentModerationChannel();
    const target = channel
      ? moderationTargets(channel).find((person) => person.id === participant.id)
      : null;
    if (!target || !target.muted) return;
    const result = unmuteParticipant(target);
    if (result?.ok) result.text = `Mute temporário de ${target.name} encerrado.`;
    respondModeration(result);
  }, Math.min(durationMs, MUTE_MAX_MS));
  muteExpiryTimers.set(participant.id, timer);
}

function applyBans() {
  servers.forEach((server) => {
    server.channels.forEach((channel) => {
      channel.participants = channel.participants.filter((participant) => !bannedIds.has(participant.id));
    });
  });
}

function currentModerationChannel() {
  return callChannel() || displayChannel();
}

function removeParticipantFromChannel(channel, participantId) {
  if (typeof liveRemoveUser === "function" && liveRemoveUser(participantId)) return true;
  const index = channel.participants.findIndex((participant) => participant.id === participantId);
  if (index === -1) return false;
  channel.participants.splice(index, 1);
  return true;
}

function removeParticipantEverywhere(participantId) {
  let removed = false;
  servers.forEach((server) => {
    server.channels.forEach((channel) => {
      if (removeParticipantFromChannel(channel, participantId)) removed = true;
    });
  });
  return removed;
}

function banParticipant(participant) {
  if (!isOwnerMode()) {
    return { ok: false, tone: "error", icon: "lock", text: "Apenas o dono pode banir participantes." };
  }
  if (!participant || participant.isLocal) {
    return { ok: false, tone: "error", icon: "ban", text: "Escolha um participante para banir." };
  }
  const name = participant.name;
  clearMuteExpiry(participant.id);
  bannedIds.add(participant.id);
  persistBannedIds();
  if (participant.live && typeof liveModerate === "function") liveModerate("ban", participant.id);
  removeParticipantEverywhere(participant.id);
  renderAll();
  return {
    ok: true,
    tone: "success",
    icon: "ban",
    sfx: "leave",
    text: `Banimento aplicado: ${name} não pode mais entrar no Thom Call.`,
  };
}

function kickParticipant(participant) {
  if (!isOwnerMode()) {
    return { ok: false, tone: "error", icon: "lock", text: "Apenas o dono pode expulsar participantes." };
  }
  const channel = currentModerationChannel();
  if (!channel || !participant || participant.isLocal) {
    return { ok: false, tone: "error", icon: "user-x", text: "Escolha um participante para expulsar." };
  }
  const name = participant.name;
  clearMuteExpiry(participant.id);
  if (participant.live && typeof liveModerate === "function") liveModerate("kick", participant.id);
  if (!removeParticipantFromChannel(channel, participant.id)) {
    return { ok: false, tone: "error", icon: "user-x", text: `${name} não está mais nesta sala.` };
  }
  renderAll();
  return {
    ok: true,
    tone: "info",
    icon: "user-x",
    sfx: "leave",
    text: `Expulsão aplicada: ${name} saiu da sala.`,
  };
}

function muteParticipant(participant, options = {}) {
  if (!isOwnerMode()) {
    return { ok: false, tone: "error", icon: "lock", text: "Apenas o dono pode mutar participantes." };
  }
  if (!participant || participant.isLocal) {
    return { ok: false, tone: "error", icon: "mic-off", text: "Escolha um participante para mutar." };
  }
  const durationMs = Math.max(0, Number(options.durationMs) || 0);
  if (participant.muted && !durationMs) {
    return { ok: false, tone: "info", icon: "mic-off", text: `O microfone de ${participant.name} já está silenciado.` };
  }
  if (participant.live && typeof liveModerate === "function") {
    liveModerate("mute", participant.id, { durationMs });
  }
  if (participant.live && typeof liveSetMuted === "function") liveSetMuted(participant.id, true);
  participant.muted = true;
  participant.speaking = false;
  if (durationMs) scheduleMuteExpiry(participant, durationMs);
  else clearMuteExpiry(participant.id);
  renderAll();
  return {
    ok: true,
    tone: "success",
    icon: "mic-off",
    sfx: "mute",
    text: durationMs
      ? `Microfone de ${participant.name} silenciado por ${formatMuteDuration(durationMs)}.`
      : `Microfone de ${participant.name} silenciado.`,
  };
}

function unmuteParticipant(participant) {
  if (!isOwnerMode()) {
    return { ok: false, tone: "error", icon: "lock", text: "Apenas o dono pode desmutar participantes." };
  }
  if (!participant || participant.isLocal) {
    return { ok: false, tone: "error", icon: "mic", text: "Escolha um participante para desmutar." };
  }
  clearMuteExpiry(participant.id);
  if (!participant.muted) {
    return { ok: false, tone: "info", icon: "mic", text: `O microfone de ${participant.name} já está liberado.` };
  }
  if (participant.live && typeof liveModerate === "function") liveModerate("unmute", participant.id);
  if (participant.live && typeof liveSetMuted === "function") liveSetMuted(participant.id, false);
  participant.muted = false;
  renderAll();
  return {
    ok: true,
    tone: "success",
    icon: "mic",
    sfx: "unmute",
    text: `Microfone de ${participant.name} liberado.`,
  };
}

function moderationTargets(channel) {
  if (!channel) return [];
  if (typeof livePeopleForChannel === "function" && typeof liveIsActive === "function" && liveIsActive()) {
    return livePeopleForChannel(state.call?.serverId || state.serverId, channel.id, false);
  }
  return channel.participants;
}

function resolveModerationTarget(query, channel) {
  if (!query) {
    return {
      error: { ok: false, tone: "error", icon: "shield", text: "Informe o nome de quem deseja moderar." },
    };
  }
  const people = moderationTargets(channel);
  const normalized = moderationNormalize(query);
  const exact = people.filter((participant) => moderationNormalize(participant.name) === normalized);
  if (exact.length === 1) return { participant: exact[0] };
  if (exact.length > 1) {
    return {
      error: {
        ok: false,
        tone: "error",
        icon: "shield",
        text: "Mais de uma pessoa corresponde a esse nome. Use o nome completo.",
      },
    };
  }
  const firstName = people.filter(
    (participant) => moderationNormalize(participant.name).split(/\s+/)[0] === normalized,
  );
  const startsWith = people.filter((participant) =>
    moderationNormalize(participant.name).startsWith(normalized),
  );
  const matches = firstName.length ? firstName : startsWith;
  if (matches.length === 1) return { participant: matches[0] };
  if (!matches.length) {
    return {
      error: {
        ok: false,
        tone: "error",
        icon: "shield",
        text: `Não encontrei "${query}" nesta sala.`,
      },
    };
  }
  return {
    error: {
      ok: false,
      tone: "error",
      icon: "shield",
      text: `Mais de uma pessoa corresponde a "${query}": ${matches
        .map((participant) => participant.name)
        .join(", ")}.`,
    },
  };
}

function respondModeration(result, options = {}) {
  if (!result) return;
  if (result.sfx) playSfx(result.sfx);
  addSystemMessage(result.text, result.tone);
  if (options.toast === false) return;
  toast(result.text, {
    type: result.tone === "success" ? "success" : result.tone === "error" ? "error" : "info",
    icon: result.icon || "shield",
  });
}

function handleOwnerCommand(raw) {
  if (!isOwnerMode()) {
    toast("Apenas o dono pode usar comandos de moderação.", {
      type: "error",
      icon: "lock",
    });
    return;
  }

  const match = String(raw).trim().match(/^\/([^\s]+)\s*(.*)$/);
  if (!match) return;
  const command = moderationNormalize(match[1]);
  const argument = match[2].trim();
  const aliases = {
    ajuda: "help",
    help: "help",
    comandos: "help",
    banir: "ban",
    ban: "ban",
    mutar: "mute",
    mute: "mute",
    desmutar: "unmute",
    unmute: "unmute",
    expulsar: "kick",
    kick: "kick",
    permitir: "allow",
    liberar: "allow",
    bloquear: "block",
  };
  const action = aliases[command];

  if (action === "help") {
    addSystemMessage(
      "Comandos do dono:\n/banir Nome — remove e bloqueia a pessoa\n/mutar Nome 10m — silencia por um tempo (30s, 10m, 1h)\n/desmutar Nome — libera o microfone\n/expulsar Nome — remove da sala\n/permitir camera|tela — libera câmera ou tela para os participantes\n/bloquear camera|tela — bloqueia câmera ou tela para os participantes",
      "info",
    );
    return;
  }

  if (!action) {
    respondModeration({
      ok: false,
      tone: "error",
      icon: "shield",
      text: "Comando desconhecido. Use /ajuda para ver os comandos do dono.",
    });
    return;
  }

  if (action === "allow" || action === "block") {
    const target = moderationNormalize(argument);
    const kind =
      target === "camera" || target === "cameras"
        ? "camera"
        : target === "tela" || target === "telas"
          ? "screen"
          : "";
    if (!kind) {
      respondModeration({
        ok: false,
        tone: "error",
        icon: "shield",
        text: `Use /${action === "allow" ? "permitir" : "bloquear"} camera ou /${action === "allow" ? "permitir" : "bloquear"} tela.`,
      });
      return;
    }
    respondModeration(setMediaPermission(kind, action === "allow"));
    return;
  }

  const channel = currentModerationChannel();
  if (!channel) {
    respondModeration({
      ok: false,
      tone: "error",
      icon: "shield",
      text: "Entre em uma sala para moderar participantes.",
    });
    return;
  }

  if (!argument) {
    const usages = {
      ban: "/banir Nome",
      mute: "/mutar Nome 10m",
      unmute: "/desmutar Nome",
      kick: "/expulsar Nome",
    };
    respondModeration({
      ok: false,
      tone: "error",
      icon: "shield",
      text: `Use ${usages[action]}.`,
    });
    return;
  }

  let query = argument;
  let durationMs = 0;
  if (action === "mute") {
    const parsed = parseMuteCommand(argument);
    if (parsed.error) {
      respondModeration({ ok: false, tone: "error", icon: "shield", text: parsed.error });
      return;
    }
    query = parsed.query;
    durationMs = parsed.durationMs;
  }

  const resolved = resolveModerationTarget(query, channel);
  if (resolved.error) {
    respondModeration(resolved.error);
    return;
  }

  const participant = resolved.participant;
  if (action === "mute") {
    respondModeration(muteParticipant(participant, { durationMs }));
    return;
  }
  const handlers = {
    ban: banParticipant,
    unmute: unmuteParticipant,
    kick: kickParticipant,
  };
  respondModeration(handlers[action](participant));
}

function handleModerationAction(action, participantId) {
  if (!isOwnerMode()) {
    toast("Apenas o dono pode moderar participantes.", { type: "error", icon: "lock" });
    return;
  }
  const channel = currentModerationChannel();
  const online = typeof liveOnlineUsers === "function" ? liveOnlineUsers(displayedServer()?.id || state.serverId).map(liveParticipant) : [];
  const participant = online.find((person) => person.id === participantId) ||
    channel?.participants.find((person) => person.id === participantId);
  if (!participant) {
    toast("Participante não encontrado nesta sala.", { type: "error", icon: "shield" });
    return;
  }
  const handlers = {
    ban: banParticipant,
    mute: muteParticipant,
    unmute: unmuteParticipant,
    kick: kickParticipant,
  };
  const handler = handlers[action];
  if (!handler) return;
  respondModeration(handler(participant));
}

applyBans();
