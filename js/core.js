const ICONS = {
  brand: '<path d="M4.5 5.5h15M12 5.5V20" stroke-width="3.4"/>',
  wave: '<path d="M2 12c2.3-5 4.6-5 6.9 0s4.6 5 6.9 0 4.6-5 6.9 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.3 9a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.5-2.7 4"/><path d="M12 17h.01"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  "mic-off": '<path d="M9 9v3a3 3 0 0 0 5.1 2.1"/><path d="M15 9.3V5a3 3 0 0 0-5.7-1.3"/><path d="M19 10v2a7 7 0 0 1-11.3 5.6"/><path d="M5 10v2a7 7 0 0 0 3 5.7"/><path d="M12 19v3"/><path d="m2 2 20 20"/>',
  headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  "headphones-off": '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/><path d="m3 3 18 18"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  signal: '<path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 20V4"/>',
  "user-plus": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  "phone-off": '<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><path d="m22 2-20 20"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
  screen: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M12 13V7"/><path d="m9 10 3-3 3 3"/>',
  "screen-off": '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="m2 2 20 20"/>',
  video: '<path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  "video-off": '<path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8"/><path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l10 10Z"/><path d="m2 2 20 20"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  "lock-open": '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  "log-out": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  "log-in": '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  "user-x": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5"/><path d="m22 8-5 5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9 15 15 0 0 1-4-9 15 15 0 0 1 4-9Z"/>',
  crown: '<path d="M3 7l4 3 5-6 5 6 4-3-2 11H5L3 7Z"/><path d="M5 18h14"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  gamepad: '<path d="M6 11h4M8 9v4"/><path d="M15 12h.01"/><path d="M18 10h.01"/><rect x="2" y="6" width="20" height="12" rx="4"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/><path d="m5 17 .8 2.2L8 20l-2.2.8L5 23l-.8-2.2L2 20l2.2-.8L5 17Z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  pip: '<rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="12" width="7" height="5" rx="1"/>',
};

function icon(name, cls = "") {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.wave}</svg>`;
}

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const app = $("#app");
const serverRail = $("#serverRail");
const channelList = $("#channelList");
const serverMini = $("#serverMini");
const serverNameEl = $("#serverName");
const serverKindEl = $("#serverKind");
const callNameEl = $("#callName");
const callServerChip = $("#callServerChip");
const callMetaEl = $("#callMeta");
const headerIconEl = $("#headerIcon");
const stageEl = $("#stage");
const dockEl = $("#dock");
const dockWrap = $("#dockWrap");
const membersEl = $("#members");
const modalRoot = $("#modalRoot");
const toastStack = $("#toastStack");
const qualityPill = $("#qualityPill");

const AV_GRADIENTS = [
  "linear-gradient(150deg,#ffb37b,#ff5f7e)",
  "linear-gradient(150deg,#5eead4,#3b82f6)",
  "linear-gradient(150deg,#c4b5fd,#8b5cf6)",
  "linear-gradient(150deg,#bef264,#22c55e)",
  "linear-gradient(150deg,#fda4af,#f43f5e)",
  "linear-gradient(150deg,#fcd34d,#f59e0b)",
  "linear-gradient(150deg,#67e8f9,#06b6d4)",
  "linear-gradient(150deg,#f0abfc,#a855f7)",
  "linear-gradient(150deg,#fdba74,#fb7185)",
  "linear-gradient(150deg,#93c5fd,#6366f1)",
  "linear-gradient(150deg,#6ee7b7,#10b981)",
  "linear-gradient(150deg,#e9d5ff,#c084fc)",
];

const SERVER_GRADIENTS = [
  "linear-gradient(145deg,#7c6cff,#3f7cff)",
  "linear-gradient(145deg,#ff9d5c,#ff4f81)",
  "linear-gradient(145deg,#2bd98b,#0ea5e9)",
  "linear-gradient(145deg,#f472b6,#a855f7)",
  "linear-gradient(145deg,#fbbf24,#f97316)",
  "linear-gradient(145deg,#38bdf8,#6366f1)",
];

let paletteIndex = 0;

function person(id, name, extra = {}) {
  const words = name.trim().split(/\s+/);
  const initials = (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
  return {
    id,
    name,
    initials,
    gradient: AV_GRADIENTS[paletteIndex++ % AV_GRADIENTS.length],
    muted: false,
    speaking: false,
    host: false,
    ...extra,
  };
}

const servers = [
  {
    id: "onda",
    name: "Thom Call's",
    kind: "Espaço de voz",
    glyph: "wave",
    gradient: SERVER_GRADIENTS[0],
    channels: [
      {
        id: "thom-call",
        name: "Thom Call",
        participants: [
          person("marina", "Marina Costa", { host: true, speaking: true }),
          person("rafael", "Rafael Lima"),
          person("bia", "Bia Nunes", { muted: true }),
          person("theo", "Theo Alves"),
        ],
      },
      {
        id: "foco-estudo",
        name: "Foco & Estudo",
        participants: [person("clara", "Clara Reis"), person("nico", "Nico Santos")],
      },
      {
        id: "musica-ideias",
        name: "Música & Ideias",
        participants: [person("leo", "Léo Prado", { muted: true }), person("sami", "Sami Rocha"), person("iris", "Iris Melo")],
      },
      { id: "sala-espera", name: "Sala de Espera", participants: [] },
    ],
  },
  {
    id: "estudio",
    name: "Estúdio 27",
    kind: "Espaço criativo",
    glyph: "monitor",
    gradient: SERVER_GRADIENTS[1],
    channels: [
      {
        id: "reuniao-design",
        name: "Reunião de Design",
        participants: [
          person("nina", "Nina Alves", { host: true, speaking: true }),
          person("caio", "Caio Ferraz"),
          person("lia", "Lia Monte", { muted: true }),
        ],
      },
      {
        id: "daily",
        name: "Daily rápida",
        participants: [person("igor", "Igor Sena"), person("mari", "Mari Lopes")],
      },
      { id: "foco-criativo", name: "Foco criativo", participants: [person("duda", "Duda Reis")] },
    ],
  },
  {
    id: "guilda",
    name: "Guilda Pixel",
    kind: "Espaço de jogos",
    glyph: "gamepad",
    gradient: SERVER_GRADIENTS[2],
    channels: [
      {
        id: "squad-party",
        name: "Squad Party",
        participants: [
          person("kiko", "Kiko Duarte", { host: true }),
          person("luna", "Luna Pires", { speaking: true }),
          person("rafa", "Rafa Moura"),
          person("vini", "Vini Costa", { muted: true }),
        ],
      },
      {
        id: "ranqueada",
        name: "Ranqueada",
        participants: [
          person("ghost", "Ghost"),
          person("zed", "Zed"),
          person("nox", "Nox", { muted: true }),
          person("yuri", "Yuri"),
          person("kira", "Kira", { speaking: true }),
        ],
      },
      { id: "afk", name: "AFK", participants: [] },
    ],
  },
  {
    id: "lofi",
    name: "Lo-fi Club",
    kind: "Espaço de música",
    glyph: "music",
    gradient: SERVER_GRADIENTS[3],
    channels: [
      {
        id: "chill-cafe",
        name: "Chill & Café",
        participants: [person("milo", "Milo"), person("sena", "Sena", { host: true }), person("yuki", "Yuki", { muted: true })],
      },
      {
        id: "estudo-noturno",
        name: "Estudo noturno",
        participants: [person("ari", "Ari"), person("bia-lofi", "Bia")],
      },
    ],
  },
];

const localUser = {
  id: "local",
  name: "Você",
  initials: "V",
  gradient: "linear-gradient(150deg,#8b7bff,#5b6cff)",
  isLocal: true,
  muted: false,
  speaking: false,
  host: false,
};

const SETTINGS_KEY = "onda.settings.v1";
const MEDIA_POLICY_KEY = "thom.mediaPolicy.v1";
const DEFAULT_SETTINGS = {
  input: "",
  output: "",
  noise: true,
  echo: true,
  agc: true,
  volume: 80,
  screenRelayUrl: "",
  screenRelayRegion: "",
};

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persistSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  } catch {
    return;
  }
}

function loadMediaPolicy() {
  try {
    const saved = JSON.parse(localStorage.getItem(MEDIA_POLICY_KEY) || "{}");
    return {
      camera: saved.camera !== false,
      screen: saved.screen !== false,
    };
  } catch {
    return { camera: true, screen: true };
  }
}

const state = {
  serverId: "onda",
  selectedChannelId: "thom-call",
  call: null,
  micMuted: false,
  deafened: false,
  cameraStream: null,
  screenStream: null,
  screenSource: "",
  mediaPolicy: loadMediaPolicy(),
  mini: { open: false, x: null, y: null },
  membersOpen: window.innerWidth > 1180,
  panelTab: "chat",
  sidebarOpen: false,
  ping: 24,
  settings: loadSettings(),
};

function mediaPolicyAllows(kind) {
  if (typeof isOwnerMode === "function" && isOwnerMode()) return true;
  return state.mediaPolicy?.[kind] !== false;
}

function isNativeApp() {
  try {
    return Boolean(window.ThomAndroid?.isNative?.());
  } catch {
    return false;
  }
}

let audioCtx = null;
let modalHooks = {};

function getServer(id) {
  return servers.find((server) => server.id === id);
}

function getChannel(serverId, channelId) {
  return getServer(serverId)?.channels.find((channel) => channel.id === channelId);
}

function callChannel() {
  return state.call ? getChannel(state.call.serverId, state.call.channelId) : null;
}

function displayChannel() {
  return (
    callChannel() ||
    getChannel(state.serverId, state.selectedChannelId) ||
    getServer(state.serverId)?.channels[0] ||
    null
  );
}

function displayedServer() {
  return getServer(state.call?.serverId || state.serverId);
}

function isMutedLocally() {
  return state.micMuted || state.deafened;
}

function localParticipant() {
  return {
    ...localUser,
    muted: isMutedLocally(),
    speaking: typeof live !== "undefined" ? Boolean(live.selfSpeaking) : false,
  };
}

function callPeople() {
  const channel = callChannel();
  if (!channel) return [];
  if (typeof livePeopleForChannel === "function") {
    return livePeopleForChannel(state.call.serverId, channel.id, true);
  }
  return [localParticipant(), ...channel.participants];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function ensureAudio() {
  if (!audioCtx) {
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) audioCtx = new AudioCtor();
    } catch {
      audioCtx = null;
    }
  }
  if (audioCtx?.state === "suspended") audioCtx.resume().catch(() => {});
}

function beep(freq, delay = 0, duration = 0.12, gain = 0.04, type = "sine") {
  if (!audioCtx) return;
  const volume = state.settings.volume / 100;
  if (volume <= 0) return;
  const t = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(gain * volume, t + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(amp).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.03);
}

function playSfx(name) {
  ensureAudio();
  if (!audioCtx) return;
  if (name === "join") {
    beep(430, 0, 0.1);
    beep(650, 0.08, 0.16);
  } else if (name === "switch") {
    beep(520, 0, 0.08);
    beep(700, 0.07, 0.1);
  } else if (name === "leave") {
    beep(520, 0, 0.1);
    beep(340, 0.08, 0.16);
  } else if (name === "mute") {
    beep(300, 0, 0.06, 0.03, "triangle");
  } else if (name === "unmute") {
    beep(520, 0, 0.07, 0.03, "triangle");
  } else if (name === "camera") {
    beep(660, 0, 0.07, 0.03);
  } else if (name === "screen") {
    beep(600, 0, 0.06, 0.03);
    beep(860, 0.06, 0.1, 0.03);
  } else if (name === "error") {
    beep(220, 0, 0.12, 0.035, "triangle");
    beep(180, 0.1, 0.15, 0.03, "triangle");
  }
}

function toast(message, options = {}) {
  const type = options.type || "success";
  const iconName = options.icon || (type === "error" ? "x" : type === "info" ? "link" : "check");
  const el = document.createElement("div");
  el.className = `toast${type === "error" ? " is-error" : type === "info" ? " is-info" : ""}`;
  el.innerHTML = `<span class="toast-icon">${icon(iconName)}</span><span>${escapeHtml(message)}</span>`;
  toastStack.appendChild(el);
  while (toastStack.children.length > 3) toastStack.firstElementChild.remove();
  window.setTimeout(() => {
    el.classList.add("is-leaving");
    window.setTimeout(() => el.remove(), 260);
  }, 3000);
}

function openModal({ content, small = false, wide = false, onOpen, onClose }) {
  closeModal(true);
  modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal${small ? " modal-sm" : ""}${wide ? " modal-wide" : ""}" role="dialog" aria-modal="true">${content}</div></div>`;
  modalRoot.classList.add("is-open");
  document.body.classList.add("modal-open");
  modalHooks = { onOpen, onClose };

  const backdrop = $(".modal-backdrop", modalRoot);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeModal();
  });
  $$("[data-close]", modalRoot).forEach((button) => button.addEventListener("click", () => closeModal()));
  window.requestAnimationFrame(() => {
    modalHooks.onOpen?.(modalRoot);
    $("input, select", modalRoot)?.focus?.();
  });
}

function closeModal(instant = false) {
  if (!modalRoot.classList.contains("is-open")) return;
  modalHooks.onClose?.();
  modalHooks = {};
  modalRoot.classList.remove("is-open");
  document.body.classList.remove("modal-open");
  const root = modalRoot;
  window.setTimeout(() => {
    if (!root.classList.contains("is-open")) root.innerHTML = "";
  }, instant ? 0 : 180);
}
