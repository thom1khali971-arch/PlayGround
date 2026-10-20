const AUTH_KEY = "thom.session.v2";
const AUTH_LEGACY_KEY = "thom.session.v1";
const AUTH_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

const GOOGLE_G_MARKUP = `<svg viewBox="0 0 48 48" aria-hidden="true">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
</svg>`;

let authSession = loadAuthSession();
let googleReady = false;
let googleLoading = false;
let googleInitialized = false;
let googleScriptPromise = null;
let configuredClientId = "";

function isGuestSession(session) {
  return session?.provider === "guest" && session.guest === true;
}

function loadAuthSession() {
  try {
    localStorage.removeItem(AUTH_LEGACY_KEY);
  } catch {
    return null;
  }
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    const at = Number(session?.at);
    const guest = isGuestSession(session);
    const validGoogle =
      session?.provider === "google" &&
      session.sub &&
      session.emailVerified === true &&
      session.email &&
      session.exp;
    if (
      !session ||
      typeof session !== "object" ||
      !Number.isFinite(at) ||
      Date.now() - at > AUTH_MAX_AGE ||
      (!guest && !validGoogle) ||
      (guest && (!session.name || !session.sub))
    ) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
    if (guest) {
      if (!session.initials) session.initials = "V";
      return session;
    }
    if (!session.name) session.name = nameFromEmail(session.email);
    if (!session.initials) session.initials = initialsFrom(session.name, session.email);
    return session;
  } catch {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch {
    }
    return null;
  }
}

function getAuthSession() {
  return authSession;
}

function nameFromEmail(email) {
  return String(email)
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initialsFrom(name, email) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return String(email || "V")[0].toUpperCase();
  return `${parts[0][0] || ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
}

function saveAuthSession(session) {
  authSession = session;
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  } catch {
    return;
  }
}

function applyAuthToUI() {
  const name = $("#userName");
  const initial = $("#userInitial");
  const profile = $("#profileBtn");
  if (!name || !initial) return;
  if (authSession) {
    name.textContent = authSession.name;
    initial.textContent = authSession.initials;
    if (profile) {
      const detail = authSession.email
        ? `${authSession.name} · ${authSession.email}`
        : authSession.name;
      profile.title = detail;
      profile.setAttribute("aria-label", `Seu perfil: ${detail}`);
    }
    return;
  }
  name.textContent = "Você";
  initial.textContent = "V";
  if (profile) {
    profile.removeAttribute("title");
    profile.setAttribute("aria-label", "Seu perfil");
  }
}

function notifyAuthChange() {
  window.dispatchEvent(new CustomEvent("thom:authchange", { detail: { session: authSession } }));
}

function isLocalPreview() {
  return (
    window.location.protocol === "file:" ||
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
  );
}

function loginUnavailableMessage(detail) {
  return isLocalPreview()
    ? detail
    : "O login com Google está temporariamente indisponível. Entre como visitante para usar o ThomCall agora.";
}

function setAuthStatus(message, tone = "info") {
  const status = $("#authStatus");
  if (!status) return;
  if (!message) {
    status.hidden = true;
    status.textContent = "";
    status.removeAttribute("data-tone");
    return;
  }
  status.hidden = false;
  status.textContent = message;
  status.dataset.tone = tone;
}

function setFallbackLoginButton(label, disabled) {
  const button = $("#gmailBtn");
  if (!button) return;
  button.hidden = false;
  button.disabled = disabled;
  const text = button.querySelector(".gmail-btn-label");
  if (text) text.textContent = label;
}

function hideFallbackLoginButton() {
  const button = $("#gmailBtn");
  if (button) button.hidden = true;
}

function setGuestButton(visible) {
  const button = $("#guestBtn");
  if (button) button.hidden = !visible;
}

function setAuthHint(text) {
  const hint = $("#authHint");
  if (hint) hint.textContent = text;
}

function setAuthSubtitle(text) {
  const subtitle = $("#authSubtitle");
  if (subtitle) subtitle.textContent = text;
}

function setAuthFooter(text) {
  const foot = $("#authFoot");
  if (!foot) return;
  foot.hidden = !text;
  const label = $("#authFootLabel");
  if (label) label.textContent = text;
}

const GOOGLE_AUTH_HINT = "A autenticação é feita pelo Google. O ThomCall não acessa sua senha.";
const GUEST_AUTH_HINT = "O acesso de visitante fica salvo apenas neste navegador. Entre com Google quando estiver disponível.";
const GOOGLE_AUTH_FOOTER = "Login seguro com Google";
const GOOGLE_AUTH_SUBTITLE = "Use sua conta Google para acessar as chamadas e o chat oficial do dono.";
const GUEST_AUTH_SUBTITLE = "Entre como visitante para usar as chamadas e o chat. O login com Google volta quando estiver disponível.";

function showAuthScreen() {
  document.body.classList.add("auth-locked");
  if (typeof app !== "undefined") app.inert = true;
}

function hideAuthScreen() {
  document.body.classList.remove("auth-locked");
  if (typeof app !== "undefined") app.inert = false;
}

function startGuestSession() {
  const session = {
    name: "Visitante",
    email: "",
    initials: "V",
    picture: "",
    provider: "guest",
    guest: true,
    sub: `guest-${Date.now()}`,
    emailVerified: false,
    exp: 0,
    at: Date.now(),
  };
  saveAuthSession(session);
  if (state.call) state.call.joinedAt = Date.now();
  setAuthStatus("");
  setGuestButton(false);
  setAuthHint(GUEST_AUTH_HINT);
  setAuthFooter("");
  setAuthSubtitle(GUEST_AUTH_SUBTITLE);
  applyAuthToUI();
  hideAuthScreen();
  notifyAuthChange();
  closeModal(true);
  playSfx("join");
  toast("Bem-vindo, Visitante!", { type: "success", icon: "check" });
}

function establishAuthSession(data) {
  const email = String(data.email || "").trim().toLowerCase();
  const sub = String(data.sub || "").trim();
  if (!email || !sub || data.emailVerified !== true) return false;
  const name = String(data.name || "").trim() || nameFromEmail(email);
  const session = {
    name,
    email,
    initials: initialsFrom(name, email),
    picture: data.picture || "",
    provider: "google",
    sub,
    emailVerified: true,
    exp: Number(data.exp || 0),
    at: Date.now(),
  };
  saveAuthSession(session);
  if (state.call) state.call.joinedAt = Date.now();
  setAuthStatus("");
  setGuestButton(false);
  setAuthHint(GOOGLE_AUTH_HINT);
  setAuthFooter(GOOGLE_AUTH_FOOTER);
  setAuthSubtitle(GOOGLE_AUTH_SUBTITLE);
  applyAuthToUI();
  hideAuthScreen();
  notifyAuthChange();
  closeModal(true);
  playSfx("join");
  toast(`Bem vindo, ${name.split(/\s+/)[0]}!`, { type: "success", icon: "check" });
  return true;
}

function fillGoogleLogos(root = document) {
  $$(".google-g", root).forEach((element) => {
    element.innerHTML = GOOGLE_G_MARKUP;
  });
}

function decodeGoogleCredential(credential) {
  const payload = credential.split(".")[1];
  if (!payload) throw new Error("token");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function validateGoogleProfile(profile) {
  if (!configuredClientId) throw new Error("client");
  if (!profile || typeof profile !== "object") throw new Error("profile");
  if (!profile.email || profile.email_verified !== true) throw new Error("email");
  if (!profile.sub) throw new Error("subject");
  const audiences = Array.isArray(profile.aud) ? profile.aud : [profile.aud];
  if (!audiences.includes(configuredClientId)) throw new Error("audience");
  if (profile.iss !== "accounts.google.com" && profile.iss !== "https://accounts.google.com") {
    throw new Error("issuer");
  }
  if (!profile.exp || Number(profile.exp) <= Math.floor(Date.now() / 1000)) {
    throw new Error("expired");
  }
  return profile;
}

function handleGoogleCredential(response) {
  try {
    const credential = String(response?.credential || "");
    if (!credential) throw new Error("credential");
    const profile = validateGoogleProfile(decodeGoogleCredential(credential));
    const established = establishAuthSession({
      name: profile.name || profile.given_name || "",
      email: profile.email,
      picture: profile.picture || "",
      sub: profile.sub,
      emailVerified: profile.email_verified,
      exp: profile.exp,
    });
    if (!established) throw new Error("session");
  } catch {
    playSfx("error");
    toast("Não foi possível validar sua conta Google. Tente novamente.", {
      type: "error",
      icon: "lock",
    });
    setAuthStatus("Não foi possível validar sua conta Google. Tente novamente.", "error");
  }
}

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client?hl=pt-BR";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      googleScriptPromise = null;
      script.remove();
      reject(new Error("google"));
    };
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

async function setupGoogleLogin() {
  if (googleLoading) return;
  googleReady = false;
  configuredClientId = String(window.THOM_CONFIG?.googleClientId || "").trim();
  setGuestButton(false);

  if (!configuredClientId) {
    const slot = $("#googleButtonSlot");
    if (slot) slot.hidden = true;
    hideFallbackLoginButton();
    setGuestButton(true);
    setAuthHint(GUEST_AUTH_HINT);
    setAuthFooter("");
    setAuthSubtitle(GUEST_AUTH_SUBTITLE);
    setAuthStatus(
      loginUnavailableMessage(
        "Login com Google não configurado. Adicione googleClientId em js/config.js ou entre como visitante.",
      ),
      "info",
    );
    return;
  }
  if (!/\.apps\.googleusercontent\.com$/.test(configuredClientId)) {
    const slot = $("#googleButtonSlot");
    if (slot) slot.hidden = true;
    hideFallbackLoginButton();
    setGuestButton(true);
    setAuthHint(GUEST_AUTH_HINT);
    setAuthFooter("");
    setAuthSubtitle(GUEST_AUTH_SUBTITLE);
    setAuthStatus(
      loginUnavailableMessage("O googleClientId configurado não parece válido."),
      "info",
    );
    return;
  }

  googleLoading = true;
  setFallbackLoginButton("Conectando…", true);
  setAuthStatus("Conectando ao Google…", "info");
  setAuthHint(GOOGLE_AUTH_HINT);
  setAuthFooter(GOOGLE_AUTH_FOOTER);
  setAuthSubtitle(GOOGLE_AUTH_SUBTITLE);

  try {
    await loadGoogleIdentity();
    if (!window.google?.accounts?.id) {
      googleScriptPromise = null;
      throw new Error("google");
    }
    if (!googleInitialized) {
      google.accounts.id.initialize({
        client_id: configuredClientId,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      googleInitialized = true;
    }
    const slot = $("#googleButtonSlot");
    const fallback = $("#gmailBtn");
    if (!slot || !fallback) throw new Error("slot");
    slot.innerHTML = "";
    slot.hidden = false;
    const buttonWidth = Math.max(200, Math.min(300, slot.clientWidth || 300));
    google.accounts.id.renderButton(slot, {
      theme: "filled_black",
      size: "large",
      shape: "pill",
      text: "continue_with",
      logo_alignment: "left",
      width: buttonWidth,
    });
    fallback.hidden = true;
    setGuestButton(false);
    setAuthStatus("");
    setAuthSubtitle(GOOGLE_AUTH_SUBTITLE);
    googleReady = true;
  } catch {
    googleReady = false;
    const slot = $("#googleButtonSlot");
    if (slot) slot.hidden = true;
    setGuestButton(true);
    setAuthHint(GUEST_AUTH_HINT);
    setAuthFooter("");
    setAuthSubtitle(GUEST_AUTH_SUBTITLE);
    setAuthStatus(
      loginUnavailableMessage(
        "Não foi possível carregar o login Google. Confira o Client ID, a origem autorizada e sua conexão.",
      ),
      "error",
    );
    setFallbackLoginButton("Tentar novamente", false);
  } finally {
    googleLoading = false;
  }
}

function logoutAccount() {
  const hadSession = Boolean(authSession);
  const wasGuest = isGuestSession(authSession);
  authSession = null;
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    authSession = null;
  }
  try {
    window.google?.accounts?.id?.cancel?.();
    window.google?.accounts?.id?.disableAutoSelect?.();
  } catch {
  }
  if (typeof resetOwnerAccess === "function") resetOwnerAccess();
  if (state.call) leaveCall();
  else {
    stopScreen();
    stopCamera();
  }
  closeModal(true);
  applyAuthToUI();
  showAuthScreen();
  setAuthStatus("");
  setGuestButton(false);
  if (!googleReady) {
    setupGoogleLogin();
  } else {
    setAuthHint(GOOGLE_AUTH_HINT);
    setAuthFooter(GOOGLE_AUTH_FOOTER);
    setAuthSubtitle(GOOGLE_AUTH_SUBTITLE);
  }
  notifyAuthChange();
  playSfx("leave");
  if (hadSession) {
    toast(wasGuest ? "Você saiu do modo visitante." : "Você saiu da conta.", {
      type: "info",
      icon: "log-out",
    });
  }
}

function initAuth() {
  fillGoogleLogos();
  applyAuthToUI();
  if (authSession) {
    hideAuthScreen();
  } else {
    showAuthScreen();
    setFallbackLoginButton("Conectando…", true);
    setupGoogleLogin();
  }
  notifyAuthChange();
  $("#gmailBtn")?.addEventListener("click", () => {
    if (!googleReady) setupGoogleLogin();
  });
  $("#guestBtn")?.addEventListener("click", startGuestSession);
}

initAuth();
