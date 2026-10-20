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
  bannedIds.add(participant.id);
  persistBannedIds();
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

function muteParticipant(participant) {
  if (!isOwnerMode()) {
    return { ok: false, tone: "error", icon: "lock", text: "Apenas o dono pode mutar participantes." };
  }
  if (!participant || participant.isLocal) {
    return { ok: false, tone: "error", icon: "mic-off", text: "Escolha um participante para mutar." };
  }
  if (participant.muted) {
    return { ok: false, tone: "info", icon: "mic-off", text: `O microfone de ${participant.name} já está silenciado.` };
  }
  participant.muted = true;
  participant.speaking = false;
  renderAll();
  return {
    ok: true,
    tone: "success",
    icon: "mic-off",
    sfx: "mute",
    text: `Microfone de ${participant.name} silenciado.`,
  };
}

function unmuteParticipant(participant) {
  if (!isOwnerMode()) {
    return { ok: false, tone: "error", icon: "lock", text: "Apenas o dono pode desmutar participantes." };
  }
  if (!participant || participant.isLocal) {
    return { ok: false, tone: "error", icon: "mic", text: "Escolha um participante para desmutar." };
  }
  if (!participant.muted) {
    return { ok: false, tone: "info", icon: "mic", text: `O microfone de ${participant.name} já está liberado.` };
  }
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
  return channel ? channel.participants : [];
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
  };
  const action = aliases[command];

  if (action === "help") {
    addSystemMessage(
      "Comandos do dono:\n/banir Nome — remove e bloqueia a pessoa\n/mutar Nome — silencia a pessoa\n/desmutar Nome — libera o microfone\n/expulsar Nome — remove da sala",
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
      mute: "/mutar Nome",
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

  const resolved = resolveModerationTarget(argument, channel);
  if (resolved.error) {
    respondModeration(resolved.error);
    return;
  }

  const participant = resolved.participant;
  const handlers = {
    ban: banParticipant,
    mute: muteParticipant,
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
  const participant = channel?.participants.find((person) => person.id === participantId);
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
