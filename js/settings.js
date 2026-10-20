let micTest = { stream: null, ctx: null, raf: 0 };

function stopMicTest() {
  window.cancelAnimationFrame(micTest.raf);
  micTest.raf = 0;
  micTest.stream?.getTracks().forEach((track) => track.stop());
  micTest.stream = null;
  micTest.ctx?.close?.()?.catch?.(() => {});
  micTest.ctx = null;
  const level = $("#micLevel");
  if (level) level.style.width = "0%";
  const button = $("#testMicBtn");
  if (button) {
    button.classList.remove("is-testing");
    button.innerHTML = `${icon("mic")} Testar microfone`;
  }
}

async function startMicTest(root) {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Este navegador não disponibiliza acesso ao microfone.", { type: "error" });
    return;
  }
  try {
    const deviceId = $("#setInput", root)?.value;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    });
    if (!root.isConnected) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    micTest.stream = stream;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    micTest.ctx = new AudioCtor();
    const source = micTest.ctx.createMediaStreamSource(stream);
    const analyser = micTest.ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const level = $("#micLevel");
    const button = $("#testMicBtn");
    button?.classList.add("is-testing");
    if (button) button.innerHTML = `${icon("mic-off")} Parar teste`;

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const value = (data[i] - 128) / 128;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / data.length);
      if (level) level.style.width = `${Math.min(100, Math.round(rms * 460))}%`;
      micTest.raf = window.requestAnimationFrame(tick);
    };
    tick();
    playSfx("camera");
  } catch {
    playSfx("error");
    toast("Não foi possível acessar o microfone. Verifique a permissão.", { type: "error" });
  }
}

function openSettings() {
  const settings = state.settings;
  const session = getAuthSession();
  const toggle = (id, label, hint, checked) => `<label class="switch-row" for="${id}">
      <span class="switch-text"><strong>${label}</strong><small>${hint}</small></span>
      <input class="switch" type="checkbox" id="${id}" ${checked ? "checked" : ""} />
    </label>`;
  const accountSection = session
    ? `<section class="settings-section">
          <h4>Conta</h4>
          <div class="account-card">
            <span class="avatar avatar-38 brand-avatar">${escapeHtml(session.initials)}</span>
            <div class="account-info">
              <strong>${escapeHtml(session.name)}</strong>
              <span>${escapeHtml(session.email)}</span>
            </div>
            <button class="btn-ghost account-logout" id="logoutBtn" type="button">${icon("log-out")} Sair</button>
          </div>
        </section>`
    : "";

  openModal({
    content: `<div class="modal-head">
        <div>
          <h3>Configurações</h3>
          <p>Voz e vídeo da sua chamada</p>
        </div>
        <button class="icon-btn small" type="button" data-close aria-label="Fechar">${icon("x")}</button>
      </div>
      <div class="modal-body">
        ${accountSection}
        <section class="settings-section">
          <h4>Dispositivos</h4>
          <label class="field"><span>Microfone</span><select id="setInput"><option value="">Padrão do sistema</option></select></label>
          <label class="field"><span>Saída de áudio</span><select id="setOutput"><option value="">Padrão do sistema</option></select></label>
          <div class="mic-test">
            <button class="btn-secondary" id="testMicBtn" type="button">${icon("mic")} Testar microfone</button>
            <div class="level"><span id="micLevel"></span></div>
          </div>
        </section>
        <section class="settings-section">
          <h4>Processamento de áudio</h4>
          ${toggle("setNoise", "Supressão de ruído", "Remove ruídos de fundo do microfone", settings.noise)}
          ${toggle("setEcho", "Cancelamento de eco", "Evita que o áudio retorne pela chamada", settings.echo)}
          ${toggle("setAgc", "Ajuste automático de ganho", "Mantém sua voz em um volume constante", settings.agc)}
        </section>
        <section class="settings-section">
          <h4>Transmissão de tela</h4>
          <label class="field"><span>URL do proxy</span><input class="modal-input" id="setRelayUrl" type="text" value="${escapeAttr(relayConfig().url)}" placeholder="wss://seu-relay/ws" autocomplete="off" /></label>
          <label class="field"><span>Região do proxy</span><input class="modal-input" id="setRelayRegion" type="text" value="${escapeAttr(relayConfig().region)}" placeholder="us-east-1" autocomplete="off" /></label>
          <p class="modal-note">Use um relay fora do Brasil. Em páginas HTTPS, informe uma URL wss://.</p>
        </section>
        <section class="settings-section">
          <h4>Volume de saída</h4>
          <div class="range-row">
            <input type="range" id="outVol" min="0" max="100" value="${settings.volume}" style="--val:${settings.volume}%" />
            <b id="volValue">${settings.volume}%</b>
          </div>
        </section>
      </div>
      <div class="modal-foot">
        <span class="muted-hint">Salvo automaticamente neste dispositivo</span>
        <button class="btn-primary" type="button" data-close>Concluir</button>
      </div>`,
    onOpen(root) {
      $("#logoutBtn", root)?.addEventListener("click", () => {
        stopMicTest();
        logoutAccount();
      });
      const input = $("#setInput", root);
      const output = $("#setOutput", root);
      const fill = (select, devices, selected, fallback) => {
        const options = devices
          .map(
            (device, index) =>
              `<option value="${escapeAttr(device.deviceId)}">${escapeHtml(
                device.label || `${fallback} ${index + 1}`,
              )}</option>`,
          )
          .join("");
        select.innerHTML = `<option value="">Padrão do sistema</option>${options}`;
        select.value = selected || "";
        if (select.value !== selected) select.value = "";
      };
      navigator.mediaDevices
        ?.enumerateDevices()
        .then((devices) => {
          fill(input, devices.filter((d) => d.kind === "audioinput"), state.settings.input, "Microfone");
          fill(output, devices.filter((d) => d.kind === "audiooutput"), state.settings.output, "Saída");
        })
        .catch(() => {});

      input.addEventListener("change", () => {
        state.settings.input = input.value;
        persistSettings();
        if (micTest.stream) {
          stopMicTest();
          startMicTest(root);
        }
      });
      output.addEventListener("change", () => {
        state.settings.output = output.value;
        persistSettings();
      });
      $("#setNoise", root).addEventListener("change", (event) => {
        state.settings.noise = event.target.checked;
        persistSettings();
      });
      $("#setEcho", root).addEventListener("change", (event) => {
        state.settings.echo = event.target.checked;
        persistSettings();
      });
      $("#setAgc", root).addEventListener("change", (event) => {
        state.settings.agc = event.target.checked;
        persistSettings();
      });
      const relayUrl = $("#setRelayUrl", root);
      relayUrl.addEventListener("change", () => {
        state.settings.screenRelayUrl = relayUrl.value.trim();
        screenRelay.online = null;
        persistSettings();
        updateRelayBadges();
      });
      const relayRegion = $("#setRelayRegion", root);
      relayRegion.addEventListener("change", () => {
        state.settings.screenRelayRegion = relayRegion.value.trim();
        screenRelay.region = relayRegion.value.trim() || RELAY_DEFAULT_REGION;
        persistSettings();
        updateRelayBadges();
      });
      const volume = $("#outVol", root);
      volume.addEventListener("input", () => {
        state.settings.volume = Number(volume.value);
        volume.style.setProperty("--val", `${volume.value}%`);
        $("#volValue", root).textContent = `${volume.value}%`;
        persistSettings();
      });
      $("#testMicBtn", root).addEventListener("click", () => {
        if (micTest.stream) {
          stopMicTest();
          return;
        }
        startMicTest(root);
      });
    },
    onClose() {
      stopMicTest();
    },
  });
}
