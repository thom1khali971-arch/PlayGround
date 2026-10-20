const INSTALL_DISMISS_KEY = "thom.install.dismissed.v1";
const INSTALL_DONE_KEY = "thom.install.installed.v1";
const INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

let deferredInstallPrompt = null;
let installOfferShown = false;
let installModalOpen = false;
let installOfferProceeding = false;

function isAndroidDevice() {
  return /Android/i.test(navigator.userAgent) || navigator.userAgentData?.platform === "Android";
}

function isStandaloneApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    navigator.standalone === true
  );
}

function installDismissedRecently() {
  try {
    const at = Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0);
    return Boolean(at) && Date.now() - at < INSTALL_DISMISS_MS;
  } catch {
    return false;
  }
}

function installAlreadyDone() {
  try {
    return localStorage.getItem(INSTALL_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function markInstallDismissed() {
  try {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
  } catch {
    return;
  }
}

function markInstallDone() {
  try {
    localStorage.setItem(INSTALL_DONE_KEY, "1");
  } catch {
    return;
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

function showInstallOffer(force = false) {
  if (isStandaloneApp()) return;
  if (force && !getAuthSession()) return;
  if (!force) {
    if (!isAndroidDevice()) return;
    if (!getAuthSession()) return;
    if (document.body.classList.contains("auth-locked")) return;
    if (installAlreadyDone() || installDismissedRecently()) return;
    if (installOfferShown || modalRoot.classList.contains("is-open")) return;
  }
  installOfferShown = true;
  openInstallOffer();
}

function openInstallOffer() {
  const canPrompt = Boolean(deferredInstallPrompt);
  installOfferProceeding = false;
  openModal({
    small: true,
    content: `<div class="modal-head">
        <div>
          <h3>Instalar o ThomCall</h3>
          <p>Tenha o app na tela inicial do Android</p>
        </div>
        <button class="icon-btn small" type="button" data-close aria-label="Fechar">${icon("x")}</button>
      </div>
      <div class="modal-body">
        <div class="install-hero">
          <img class="install-app-icon" src="assets/icons/icon-192.png" alt="" width="56" height="56" />
          <p>Abra o ThomCall direto pelo ícone, em tela cheia e sem a barra do navegador.</p>
        </div>
        <div class="install-benefits">
          <span>${icon("check")} Acesso rápido pela tela inicial</span>
          <span>${icon("check")} Experiência em tela cheia</span>
          <span>${icon("check")} Carregamento mais rápido nas próximas visitas</span>
        </div>
      </div>
      <div class="modal-foot install-foot">
        <button class="btn-ghost" id="installLaterBtn" type="button">Agora não</button>
        <button class="btn-primary" id="installNowBtn" type="button">${icon("download")} ${
          canPrompt ? "Instalar" : "Como instalar"
        }</button>
      </div>`,
    onOpen(root) {
      installModalOpen = true;
      root.querySelector("#installLaterBtn")?.addEventListener("click", () => {
        markInstallDismissed();
        closeModal();
      });
      root.querySelector("#installNowBtn")?.addEventListener("click", () => {
        installOfferProceeding = true;
        startInstall();
      });
    },
    onClose() {
      installModalOpen = false;
      if (!installOfferProceeding) markInstallDismissed();
      installOfferProceeding = false;
    },
  });
}

async function startInstall() {
  if (!deferredInstallPrompt) {
    closeModal();
    window.setTimeout(() => showManualInstallSteps(), 200);
    return;
  }
  const prompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  const button = $("#installNowBtn");
  if (button) {
    button.disabled = true;
    button.innerHTML = `${icon("download")} Abrindo…`;
  }
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice?.outcome === "accepted") {
      markInstallDone();
      toast("Instalando o ThomCall…", { type: "success", icon: "download" });
    } else {
      markInstallDismissed();
    }
  } catch {
    closeModal();
    window.setTimeout(() => showManualInstallSteps(), 200);
    return;
  }
  closeModal();
}

function showManualInstallSteps() {
  openModal({
    small: true,
    content: `<div class="modal-head">
        <div>
          <h3>Instalar no Android</h3>
          <p>Use o Chrome para adicionar o app</p>
        </div>
        <button class="icon-btn small" type="button" data-close aria-label="Fechar">${icon("x")}</button>
      </div>
      <div class="modal-body">
        <ol class="install-steps">
          <li>Abra o ThomCall no Chrome do Android.</li>
          <li>Toque no menu de três pontos no canto superior.</li>
          <li>Escolha “Instalar app” ou “Adicionar à tela inicial”.</li>
          <li>Confirme em “Instalar”.</li>
        </ol>
      </div>
      <div class="modal-foot">
        <button class="btn-primary" type="button" data-close>Entendi</button>
      </div>`,
    onOpen() {
      installModalOpen = true;
    },
    onClose() {
      installModalOpen = false;
      markInstallDismissed();
    },
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (installModalOpen) {
    const button = $("#installNowBtn");
    if (button) button.innerHTML = `${icon("download")} Instalar`;
    return;
  }
  if (
    !installOfferShown &&
    getAuthSession() &&
    isAndroidDevice() &&
    !document.body.classList.contains("auth-locked") &&
    !installAlreadyDone() &&
    !installDismissedRecently()
  ) {
    window.setTimeout(() => showInstallOffer(), 600);
  }
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installOfferShown = true;
  markInstallDone();
  if (installModalOpen) closeModal();
  toast("ThomCall instalado!", { type: "success", icon: "check" });
});

window.addEventListener("thom:authchange", (event) => {
  if (!event.detail?.session) {
    installOfferShown = false;
    return;
  }
  window.setTimeout(() => showInstallOffer(), 1100);
});

registerServiceWorker();
window.setTimeout(() => showInstallOffer(), 1600);
