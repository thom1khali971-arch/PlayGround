const AUTH_KEY = "thom.session.v1";

const GOOGLE_G_MARKUP = `<svg viewBox="0 0 48 48" aria-hidden="true">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
</svg>`;

let authSession = loadAuthSession();
let googleReady = false;

function loadAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || typeof session !== "object" || !session.email) return null;
    if (!session.name) session.name = nameFromEmail(session.email);
    if (!session.initials) session.initials = initialsFrom(session.name, session.email);
    return session;
  } catch {
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
    return true;
  } catch {
    return false;
  }
}

function applyAuthToUI() {
  const name = $("#userName");
  const initial = $("#userInitial");
  const avatar = $("#userAvatar");
  const profile = $("#profileBtn");
  if (!name || !initial) return;
  if (authSession) {
    name.textContent = authSession.name;
    initial.textContent = authSession.initials;
    paintAvatar(avatar, authSession);
    if (profile) {
      profile.title = `${authSession.name} · ${authSession.email}`;
      profile.setAttribute("aria-label", `Seu perfil: ${authSession.name}, ${authSession.email}`);
    }
    return;
  }
  name.textContent = "Você";
  initial.textContent = "V";
  paintAvatar(avatar, null);
  if (profile) {
    profile.removeAttribute("title");
    profile.setAttribute("aria-label", "Seu perfil");
  }
}

function showAuthScreen() {
  document.body.classList.add("auth-locked");
  if (typeof app !== "undefined") app.inert = true;
}

function hideAuthScreen() {
  document.body.classList.remove("auth-locked");
  if (typeof app !== "undefined") app.inert = false;
}

function setProfilePhoto(picture) {
  if (!authSession) return false;
  authSession.picture = safeAvatarPicture(picture);
  const saved = saveAuthSession(authSession);
  applyAuthToUI();
  if (typeof livePublishPresence === "function") livePublishPresence(true);
  if (typeof renderAll === "function") renderAll();
  return saved;
}

function establishAuthSession(data) {
  const email = String(data.email || "").trim().toLowerCase();
  if (!email) return false;
  const name = String(data.name || "").trim() || nameFromEmail(email);
  const session = {
    name,
    email,
    initials: initialsFrom(name, email),
    picture: data.picture || "",
    provider: data.provider || "gmail",
    at: Date.now(),
  };
  saveAuthSession(session);
  if (state.call) state.call.joinedAt = Date.now();
  applyAuthToUI();
  hideAuthScreen();
  closeModal(true);
  if (typeof startLive === "function") startLive();
  if (typeof joinHashChannel === "function") joinHashChannel({ silent: true });
  playSfx("join");
  toast(`Bem vindo, ${name.split(/\s+/)[0]}!`, { type: "success", icon: "check" });
  return true;
}

function fillGoogleLogos(root = document) {
  $$(".google-g", root).forEach((element) => {
    element.innerHTML = GOOGLE_G_MARKUP;
  });
}

function openGmailLogin() {
  openModal({
    small: true,
    content: `<div class="modal-head">
        <div>
          <h3>Entrar com Gmail</h3>
          <p>Acesse o Thom Call com sua conta</p>
        </div>
        <button class="icon-btn small" type="button" data-close aria-label="Fechar">${icon("x")}</button>
      </div>
      <form id="gmailLoginForm">
        <div class="modal-body">
          <div class="google-preview">
            <span class="google-g" aria-hidden="true"></span>
            <div>
              <strong>Fazer login com o Google</strong>
              <small>Continuar no Thom Call</small>
            </div>
          </div>
          <label class="field"><span>Seu nome</span>
            <input class="modal-input" id="gmailName" maxlength="48" placeholder="Como devemos chamar você" autocomplete="name" />
          </label>
          <label class="field"><span>E-mail do Gmail</span>
            <input class="modal-input" id="gmailEmail" type="email" maxlength="80" placeholder="voce@gmail.com" autocomplete="email" required />
          </label>
          <p class="modal-note">Entre com um endereço @gmail.com. Seus dados ficam salvos somente neste navegador.</p>
        </div>
        <div class="modal-foot">
          <button class="btn-ghost" type="button" data-close>Cancelar</button>
          <button class="btn-primary" type="submit">${icon("log-in")} Entrar com Gmail</button>
        </div>
      </form>`,
    onOpen(root) {
      fillGoogleLogos(root);
      const email = $("#gmailEmail", root);
      email?.focus();
      $("#gmailLoginForm", root).addEventListener("submit", (event) => {
        event.preventDefault();
        const emailValue = $("#gmailEmail", root)?.value.trim().toLowerCase() || "";
        const nameValue = $("#gmailName", root)?.value.trim() || "";
        if (!/^[^\s@]+@(gmail|googlemail)\.com$/.test(emailValue)) {
          playSfx("error");
          toast("Informe um endereço de Gmail válido.", { type: "error", icon: "mail" });
          email?.focus();
          return;
        }
        establishAuthSession({ name: nameValue, email: emailValue, provider: "gmail-demo" });
      });
    },
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

function handleGoogleCredential(response) {
  try {
    const profile = decodeGoogleCredential(response.credential);
    if (!profile.email) throw new Error("email");
    establishAuthSession({
      name: profile.name || profile.given_name || "",
      email: profile.email,
      picture: profile.picture || "",
      provider: "google",
    });
  } catch {
    playSfx("error");
    toast("Não foi possível concluir o login com o Google.", { type: "error", icon: "lock" });
  }
}

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("google"));
    document.head.appendChild(script);
  });
}

async function setupGoogleLogin() {
  const clientId = String(window.THOM_CONFIG?.googleClientId || "").trim();
  if (!clientId) return;
  try {
    await loadGoogleIdentity();
    if (!window.google?.accounts?.id) throw new Error("google");
    google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    const slot = $("#googleButtonSlot");
    const fallback = $("#gmailBtn");
    if (!slot || !fallback) return;
    slot.hidden = false;
    try {
      google.accounts.id.renderButton(slot, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: 300,
      });
    } catch {
      slot.hidden = true;
      throw new Error("render");
    }
    fallback.hidden = true;
    googleReady = true;
  } catch {
    googleReady = false;
    toast("Não foi possível conectar ao Google. Use o acesso local.", { type: "error", icon: "lock" });
  }
}

function logoutAccount() {
  const hadSession = Boolean(authSession);
  authSession = null;
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    authSession = null;
  }
  if (typeof resetOwnerAccess === "function") resetOwnerAccess();
  if (state.call) leaveCall();
  else {
    stopScreen();
    stopCamera();
  }
  if (typeof stopLive === "function") stopLive();
  closeModal(true);
  applyAuthToUI();
  showAuthScreen();
  playSfx("leave");
  if (hadSession) toast("Você saiu da conta.", { type: "info", icon: "log-out" });
}

function initAuth() {
  fillGoogleLogos();
  applyAuthToUI();
  if (authSession) hideAuthScreen();
  else showAuthScreen();
  $("#gmailBtn")?.addEventListener("click", () => {
    if (!googleReady) openGmailLogin();
  });
  setupGoogleLogin();
}

initAuth();
