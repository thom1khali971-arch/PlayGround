const CHAT_KEY = "thom.chat.v1";
const OWNER_KEY = "thom.chat.owner";
const OWNER_PIN = "2468";
const WELCOME_TEXT = "Seja bem vindo ao Thom Call";
const MAX_RECORDING_MS = 30000;

function welcomeMessage() {
  return {
    id: "welcome",
    at: Date.now(),
    text: WELCOME_TEXT,
    welcome: true,
  };
}

function loadChatMessages() {
  let messages = [];
  try {
    messages = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
  } catch {
    messages = [];
  }
  if (!Array.isArray(messages)) messages = [];
  messages = messages.filter((message) => message && typeof message === "object");
  if (!messages.some((message) => message.id === "welcome")) messages.unshift(welcomeMessage());
  return messages;
}

let chatMessages = loadChatMessages();

const chatState = {
  unlocked: false,
  mediaRecorder: null,
  recordStream: null,
  recordChunks: [],
  recordTimeout: 0,
  recordTimer: 0,
  recordStartedAt: 0,
};

try {
  chatState.unlocked = sessionStorage.getItem(OWNER_KEY) === "1";
} catch {
  chatState.unlocked = false;
}

function persistChat() {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(chatMessages));
    return true;
  } catch {
    toast("A memória do chat está cheia. Envie uma mídia menor.", { type: "error", icon: "image" });
    return false;
  }
}

function formatChatTime(at) {
  try {
    return new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function isOwnerMode() {
  return Boolean(chatState.unlocked);
}

function addSystemMessage(text, tone = "info") {
  chatMessages.push({
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    system: true,
    tone,
    text,
  });
  persistChat();
  renderChat();
}

function chatMessageMarkup(message) {
  if (message.system) {
    const systemIcon = message.tone === "error" ? "ban" : message.tone === "success" ? "shield" : "message";
    return `<div class="chat-system ${message.tone || "info"}">
      ${icon(systemIcon)}
      <span>${escapeHtml(message.text).replaceAll("\n", "<br>")}</span>
      <time>${formatChatTime(message.at)}</time>
    </div>`;
  }
  const text = message.text
    ? `<p class="chat-text">${escapeHtml(message.text).replaceAll("\n", "<br>")}</p>`
    : "";
  const image = message.image
    ? `<img class="chat-image" src="${escapeAttr(message.image)}" alt="Imagem enviada por Thom" loading="lazy" />`
    : "";
  const audio = message.audio
    ? `<audio class="chat-audio" src="${escapeAttr(message.audio)}" controls preload="metadata"></audio>`
    : "";

  return `<article class="chat-msg${message.welcome ? " is-welcome" : ""}">
    <span class="chat-msg-avatar">T</span>
    <div class="chat-bubble">
      <div class="chat-msg-meta">
        <strong>Thom</strong>
        <span class="owner-badge">Dono</span>
        <time>${formatChatTime(message.at)}</time>
      </div>
      ${text}${image}${audio}
    </div>
  </article>`;
}

function renderChat() {
  const list = $("#chatMessages");
  if (!list) return;
  list.innerHTML = chatMessages.map(chatMessageMarkup).join("");
  const gate = $("#chatGate");
  const composer = $("#chatComposer");
  if (gate) gate.hidden = chatState.unlocked;
  if (composer) composer.hidden = !chatState.unlocked;
  requestAnimationFrame(() => {
    list.scrollTop = list.scrollHeight;
  });
}

function addChatMessage(payload) {
  if (!chatState.unlocked) return false;
  const message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    ...payload,
  };
  chatMessages.push(message);
  if (!persistChat()) {
    chatMessages.pop();
    return false;
  }
  renderChat();
  playSfx("camera");
  return true;
}

function unlockOwner(pin) {
  if (pin !== OWNER_PIN) return false;
  chatState.unlocked = true;
  try {
    sessionStorage.setItem(OWNER_KEY, "1");
  } catch {
  }
  if (typeof renderMembers === "function") renderMembers();
  return true;
}

function resetOwnerAccess() {
  stopChatRecording();
  chatState.unlocked = false;
  try {
    sessionStorage.removeItem(OWNER_KEY);
  } catch {
    chatState.unlocked = false;
  }
  renderChat();
  if (typeof renderMembers === "function") renderMembers();
}

function lockOwner() {
  resetOwnerAccess();
  playSfx("mute");
  toast("Modo dono bloqueado.", { type: "info", icon: "lock" });
}

function growChatInput() {
  const input = $("#chatText");
  if (!input) return;
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 108)}px`;
}

function sendChatText() {
  if (!chatState.unlocked) return;
  const input = $("#chatText");
  if (!input) return;
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }
  if (text.startsWith("/")) {
    input.value = "";
    growChatInput();
    if (typeof handleOwnerCommand === "function") handleOwnerCommand(text);
    input.focus();
    return;
  }
  if (addChatMessage({ text })) {
    input.value = "";
    growChatInput();
    input.focus();
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = src;
  });
}

async function prepareImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("type");
  if (file.size > 8 * 1024 * 1024) throw new Error("size");
  const source = await readFileAsDataURL(file);
  if (file.size <= 500 * 1024) return source;

  const image = await loadImageElement(source);
  const maxSide = 1100;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  if (scale === 1 && source.length <= 1800000) return source;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

async function sendChatImage(file) {
  if (!chatState.unlocked || !file) return;
  try {
    const data = await prepareImage(file);
    if (data.length > 2600000) throw new Error("large");
    if (!addChatMessage({ image: data })) return;
    toast("Imagem enviada.", { type: "success", icon: "image" });
  } catch (error) {
    const message =
      error?.message === "size" || error?.message === "large"
        ? "Imagem muito grande. Escolha um arquivo menor."
        : "Não foi possível enviar esta imagem.";
    toast(message, { type: "error", icon: "image" });
  }
}

async function sendChatAudioFile(file) {
  if (!chatState.unlocked || !file) return;
  if (!file.type.startsWith("audio/")) {
    toast("Escolha um arquivo de áudio válido.", { type: "error", icon: "music" });
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    toast("Áudio muito grande. Escolha um arquivo menor.", { type: "error", icon: "music" });
    return;
  }
  try {
    const data = await readFileAsDataURL(file);
    if (data.length > 2800000) throw new Error("large");
    if (!addChatMessage({ audio: data })) return;
    toast("Áudio enviado.", { type: "success", icon: "music" });
  } catch {
    toast("Não foi possível enviar este áudio.", { type: "error", icon: "music" });
  }
}

function updateRecordingUI() {
  const recording = Boolean(chatState.mediaRecorder && chatState.mediaRecorder.state === "recording");
  const recordBtn = $("#chatRecordBtn");
  const state = $("#recordingState");
  const time = $("#recordingTime");
  if (recordBtn) recordBtn.classList.toggle("is-recording", recording);
  if (state) state.hidden = !recording;
  if (!recording) {
    if (time) time.textContent = "00:00";
    return;
  }
  if (time) time.textContent = formatDuration(Date.now() - chatState.recordStartedAt);
}

function stopChatRecording() {
  const recorder = chatState.mediaRecorder;
  if (!recorder) return;
  window.clearTimeout(chatState.recordTimeout);
  window.clearInterval(chatState.recordTimer);
  chatState.recordTimeout = 0;
  chatState.recordTimer = 0;
  if (recorder.state !== "inactive") {
    try {
      recorder.stop();
    } catch {
      return;
    }
  }
}

async function toggleChatRecording() {
  if (!chatState.unlocked) return;
  if (chatState.mediaRecorder && chatState.mediaRecorder.state === "recording") {
    stopChatRecording();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    toast("Este navegador não permite gravar áudio.", { type: "error", icon: "mic" });
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!chatState.unlocked) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find(
      (type) => MediaRecorder.isTypeSupported?.(type),
    );
    const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
    chatState.mediaRecorder = recorder;
    chatState.recordStream = stream;
    chatState.recordChunks = [];
    chatState.recordStartedAt = Date.now();

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size) chatState.recordChunks.push(event.data);
    });

    recorder.addEventListener("stop", async () => {
      window.clearTimeout(chatState.recordTimeout);
      window.clearInterval(chatState.recordTimer);
      chatState.recordTimeout = 0;
      chatState.recordTimer = 0;
      stream.getTracks().forEach((track) => track.stop());
      const chunks = chatState.recordChunks;
      const type = recorder.mimeType || "audio/webm";
      chatState.mediaRecorder = null;
      chatState.recordStream = null;
      chatState.recordChunks = [];
      updateRecordingUI();
      if (!chunks.length) return;
      const blob = new Blob(chunks, { type });
      if (blob.size > 2600000) {
        toast("A gravação ficou muito grande.", { type: "error", icon: "mic" });
        return;
      }
      try {
        const data = await readFileAsDataURL(blob);
        if (chatState.unlocked && addChatMessage({ audio: data })) {
          toast("Áudio enviado.", { type: "success", icon: "mic" });
        }
      } catch {
        toast("Não foi possível enviar a gravação.", { type: "error", icon: "mic" });
      }
    });

    recorder.start();
    updateRecordingUI();
    chatState.recordTimer = window.setInterval(updateRecordingUI, 500);
    chatState.recordTimeout = window.setTimeout(stopChatRecording, MAX_RECORDING_MS);
  } catch {
    toast("Não foi possível acessar o microfone. Verifique a permissão.", { type: "error", icon: "mic" });
  }
}

function initChat() {
  renderChat();
  persistChat();

  $("#chatGate")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#ownerPin");
    if (!input) return;
    const pin = input.value.trim();
    if (unlockOwner(pin)) {
      input.value = "";
      renderChat();
      playSfx("join");
      toast("Modo dono liberado.", { type: "success", icon: "lock-open" });
      return;
    }
    input.value = "";
    input.focus();
    const gate = $("#chatGate");
    gate?.classList.add("is-error");
    window.setTimeout(() => gate?.classList.remove("is-error"), 420);
    playSfx("error");
    toast("PIN incorreto. Tente novamente.", { type: "error", icon: "lock" });
  });

  $("#chatComposer")?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendChatText();
  });

  $("#chatText")?.addEventListener("input", growChatInput);
  $("#chatText")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendChatText();
    }
  });

  $("#chatImageBtn")?.addEventListener("click", () => $("#chatImageInput")?.click());
  $("#chatAudioBtn")?.addEventListener("click", () => $("#chatAudioInput")?.click());
  $("#chatRecordBtn")?.addEventListener("click", toggleChatRecording);
  $("#chatStopRecordBtn")?.addEventListener("click", stopChatRecording);
  $("#chatLockBtn")?.addEventListener("click", lockOwner);

  $("#chatImageInput")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    sendChatImage(file);
  });

  $("#chatAudioInput")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    sendChatAudioFile(file);
  });

  window.addEventListener("beforeunload", stopChatRecording);
}

initChat();
