/* ============================================================
   Gás Solidário — lógica da campanha
   - pedidos salvos no navegador + link compartilhável
   - contato direto por WhatsApp (wa.me)
   - cartaz A4 / panfleto A5 com QR Code dinâmico
   ============================================================ */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const KEYS = {
    config: 'gas-solidario:config:v1',
    requests: 'gas-solidario:requests:v1',
    done: 'gas-solidario:done:v1',
    demo: 'gas-solidario:demo-removed:v1'
  };

  const DEFAULT_CONFIG = {
    name: 'Gás Solidário',
    city: 'São Paulo — SP',
    whatsapp: '5511999999999',
    pix: ''
  };

  const URGENCY = {
    urgente: { label: 'Urgente', cls: 'badge-urgent', icon: 'i-flame', rank: 0 },
    semana: { label: 'Esta semana', cls: 'badge-week', icon: 'i-clock', rank: 1 },
    espera: { label: 'Pode esperar', cls: 'badge-wait', icon: 'i-clock', rank: 2 }
  };

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (_) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* modo privado */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
    }
  };

  const state = {
    config: Object.assign({}, DEFAULT_CONFIG, store.get(KEYS.config, {})),
    requests: Array.isArray(store.get(KEYS.requests, [])) ? store.get(KEYS.requests, []) : [],
    done: new Set(Array.isArray(store.get(KEYS.done, [])) ? store.get(KEYS.done, []) : []),
    demoRemoved: store.get(KEYS.demo, false) === true,
    filter: 'todos',
    query: '',
    shared: null,
    highlightId: null,
    sheet: 'poster'
  };

  state.requests = state.requests
    .filter((req) => req && typeof req === 'object' && req.id && req.name && req.hood && req.phone)
    .map((req) => ({
      id: String(req.id).slice(0, 12),
      name: String(req.name).slice(0, 60),
      phone: digits(req.phone),
      hood: String(req.hood).slice(0, 50),
      city: String(req.city || '').slice(0, 50),
      people: Math.min(9, Math.max(1, Number(req.people) || 1)),
      urgency: URGENCY[req.urgency] ? req.urgency : 'semana',
      reason: String(req.reason || '').slice(0, 160),
      createdAt: Number(req.createdAt) || Date.now(),
      demo: false
    }));

  /* ---------------- utils ---------------- */

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function digits(value) {
    return String(value == null ? '' : value).replace(/\D/g, '');
  }

  function waNumber(value) {
    let d = digits(value);
    if (d.length > 11 && d.startsWith('55')) return d;
    if (d.length === 10 || d.length === 11) return '55' + d;
    return d;
  }

  function isValidLocalPhone(value) {
    let d = digits(value);
    if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
    return d.length === 10 || d.length === 11;
  }

  function formatPhone(value) {
    let d = digits(value);
    if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return value || '';
  }

  function maskPhone(value) {
    let d = digits(value);
    if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
    return d.length >= 4 ? `••••-${d.slice(-4)}` : '••••';
  }

  function formatPhoneInput(value) {
    let d = digits(value);
    if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
    d = d.slice(0, 11);
    if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || 'amigo(a)';
  }

  function shortName(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'Família';
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'GS';
    const first = parts[0].charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toUpperCase();
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function timeAgo(timestamp) {
    const diff = Math.max(0, Date.now() - Number(timestamp || Date.now()));
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora mesmo';
    if (min < 60) return `há ${min} min`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `há ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'ontem';
    if (days < 30) return `há ${days} dias`;
    const months = Math.floor(days / 30);
    return months <= 1 ? 'há 1 mês' : `há ${months} meses`;
  }

  function makeId() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function base64UrlEncode(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64UrlDecode(value) {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function campaignWa(message) {
    return `https://wa.me/${waNumber(state.config.whatsapp)}?text=${encodeURIComponent(message)}`;
  }

  function waLink(phone, message) {
    return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(message)}`;
  }

  const generalMessage = () => `Olá! Quero ajudar a campanha ${state.config.name} com um botijão de gás. Como funciona?`;
  const collectMessage = () => `Olá! Quero ser um ponto de coleta da campanha ${state.config.name}. Como posso participar?`;

  function donorMessage(req) {
    const where = req.hood ? ` (${req.hood})` : '';
    return `Olá, ${firstName(req.name)}! Vi seu pedido de gás no ${state.config.name}${where} e quero ajudar com um botijão. Podemos combinar a entrega?`;
  }

  function requesterMessage(req) {
    return `Olá! Acabei de publicar meu pedido de gás no ${state.config.name}. Meu nome é ${req.name}, moro em ${req.hood}${req.city ? `, ${req.city}` : ''}. Pedido ${req.id}.`;
  }

  /* ---------------- seeds ---------------- */

  function seedRequests() {
    const now = Date.now();
    const day = 86400000;
    return [
      {
        id: 'EX01', name: 'Marli Souza', phone: '5511999990001', hood: 'Jardim Aurora', city: '',
        people: 4, urgency: 'urgente',
        reason: 'O gás acabou na sexta e estou desempregada. Tenho duas crianças pequenas em casa.',
        createdAt: now - 2 * day, demo: true
      },
      {
        id: 'EX02', name: 'Rafael Oliveira', phone: '5511999990002', hood: 'Vila Nova', city: '',
        people: 2, urgency: 'semana',
        reason: 'Estou cuidando da minha mãe acamada e o botijão está no fim. A troca ficou fora do orçamento.',
        createdAt: now - 4 * day, demo: true
      },
      {
        id: 'EX03', name: 'Joana Pereira', phone: '5511999990003', hood: 'Centro', city: '',
        people: 3, urgency: 'semana',
        reason: 'Trabalho como diarista e esta semana não teve serviço. Preciso cozinhar para meus filhos.',
        createdAt: now - 5 * day, demo: true
      },
      {
        id: 'EX04', name: 'Antônio Costa', phone: '5511999990004', hood: 'Bairro Esperança', city: '',
        people: 1, urgency: 'espera',
        reason: 'Moro sozinho e recebo um salário mínimo. Consigo esperar até o próximo mês, mas qualquer ajuda é bem-vinda.',
        createdAt: now - 9 * day, demo: true
      }
    ];
  }

  /* ---------------- data ---------------- */

  function allRequests() {
    const list = [];
    if (state.shared) list.push(state.shared);
    state.requests.forEach((req) => {
      if (!list.some((item) => item.id === req.id)) list.push(req);
    });
    if (!state.demoRemoved) {
      seedRequests().forEach((req) => {
        if (!list.some((item) => item.id === req.id)) list.push(req);
      });
    }
    return list;
  }

  function requestById(id) {
    return allRequests().find((req) => req.id === id) || null;
  }

  function requestShareUrl(req) {
    const payload = {
      v: 1,
      i: req.id,
      n: req.name,
      w: digits(req.phone),
      b: req.hood,
      c: req.city || '',
      p: req.people,
      u: req.urgency,
      r: req.reason || '',
      t: req.createdAt
    };
    const base = location.origin && location.origin !== 'null'
      ? location.origin + location.pathname
      : location.href.split('#')[0];
    return `${base}#p=${base64UrlEncode(JSON.stringify(payload))}`;
  }

  function parseShareHash() {
    const hash = location.hash || '';
    if (!hash.startsWith('#p=')) return null;
    try {
      const data = JSON.parse(base64UrlDecode(hash.slice(3)));
      if (!data || !data.n || !data.b) return null;
      const phone = digits(data.w);
      if (phone.length < 10 || phone.length > 13) return null;
      return {
        id: String(data.i || 'SHARE').slice(0, 10),
        name: String(data.n).slice(0, 60),
        phone,
        hood: String(data.b).slice(0, 50),
        city: String(data.c || '').slice(0, 50),
        people: Math.min(9, Math.max(1, Number(data.p) || 1)),
        urgency: URGENCY[data.u] ? data.u : 'semana',
        reason: String(data.r || '').slice(0, 160),
        createdAt: Number(data.t) || Date.now(),
        shared: true
      };
    } catch (_) { return null; }
  }

  function saveRequests() { store.set(KEYS.requests, state.requests); }
  function saveDone() { store.set(KEYS.done, Array.from(state.done)); }
  function saveConfig() { store.set(KEYS.config, state.config); }

  /* ---------------- config / QR ---------------- */

  function applyConfig() {
    const cfg = state.config;
    $$('[data-cfg="name"]').forEach((el) => { el.textContent = cfg.name; });
    $$('[data-cfg="city"]').forEach((el) => { el.textContent = cfg.city; });
    $$('[data-cfg="phone"]').forEach((el) => { el.textContent = formatPhone(cfg.whatsapp); });
    $$('[data-cfg-link="wa"]').forEach((el) => { el.href = campaignWa(generalMessage()); });
    $$('[data-cfg-link="wa-collect"]').forEach((el) => { el.href = campaignWa(collectMessage()); });

    const pixCard = $('#pix-card');
    if (pixCard) {
      const hasPix = Boolean(String(cfg.pix || '').trim());
      pixCard.hidden = !hasPix;
      if (hasPix) $('#pix-key').textContent = cfg.pix;
    }

    const cityInput = $('#f-city');
    if (cityInput && !cityInput.value) {
      cityInput.value = cfg.city.split(/[—–-]/)[0].trim();
    }

    document.title = `${cfg.name} — doe um botijão, acenda uma vida`;
    const metaDesc = $('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', `Campanha de doação de gás de cozinha em ${cfg.city}: veja pedidos de famílias, fale direto no WhatsApp e ajude com um botijão. Cartaz e panfleto prontos para imprimir.`);
    }
  }

  function makeQrDataUrl() {
    try {
      if (typeof window.qrcode !== 'function') return '';
      const qr = window.qrcode(0, 'M');
      qr.addData(campaignWa(generalMessage()));
      qr.make();
      return qr.createDataURL(8, 16);
    } catch (_) { return ''; }
  }

  function setupQr() {
    const url = makeQrDataUrl();
    if (!url) return;
    $$('.qr-img').forEach((img) => {
      img.src = url;
      if (!img.getAttribute('alt')) img.alt = 'QR Code para falar com a campanha no WhatsApp';
    });
  }

  /* ---------------- stats ---------------- */

  function renderStats() {
    const active = allRequests().filter((req) => !state.done.has(req.id));
    const people = active.reduce((sum, req) => sum + (Number(req.people) || 1), 0);
    const hoods = new Set(active.map((req) => normalizeText(req.hood)).filter(Boolean));
    const set = (key, value) => {
      const el = $(`[data-stat="${key}"]`);
      if (el) el.textContent = value;
    };
    set('open', active.length);
    set('people', people);
    set('hoods', hoods.size);
  }

  /* ---------------- board ---------------- */

  function sortRequests(list) {
    const sharedId = state.shared ? state.shared.id : '';
    return list.slice().sort((a, b) => {
      if (a.id === sharedId) return -1;
      if (b.id === sharedId) return 1;
      const rank = (URGENCY[a.urgency] ? URGENCY[a.urgency].rank : 9) - (URGENCY[b.urgency] ? URGENCY[b.urgency].rank : 9);
      if (rank !== 0) return rank;
      return Number(b.createdAt) - Number(a.createdAt);
    });
  }

  function filteredRequests() {
    const all = allRequests();
    const q = normalizeText(state.query);
    let list;
    if (state.filter === 'atendidos') {
      list = all.filter((req) => state.done.has(req.id));
    } else {
      list = all.filter((req) => !state.done.has(req.id));
      if (state.filter !== 'todos') {
        list = list.filter((req) => req.urgency === state.filter);
      }
    }
    if (q) {
      list = list.filter((req) => normalizeText(`${req.hood} ${req.city || state.config.city} ${req.name}`).includes(q));
    }
    return sortRequests(list);
  }

  function cardHtml(req) {
    const urgency = URGENCY[req.urgency] || URGENCY.semana;
    const done = state.done.has(req.id);
    const city = req.city || state.config.city;
    const classes = ['req-card'];
    if (done) classes.push('is-done');
    if (req.id === state.highlightId) classes.push('is-new');
    if (req.shared) classes.push('is-shared');

    const topBadge = done
      ? '<span class="badge badge-done"><svg aria-hidden="true"><use href="#i-check"/></svg>Atendido</span>'
      : `<span class="badge ${urgency.cls}"><svg aria-hidden="true"><use href="#${urgency.icon}"/></svg>${urgency.label}</span>`;

    const idChips = [];
    if (req.shared) idChips.push('<span class="req-tag is-shared">compartilhado</span>');
    if (req.demo) idChips.push('<span class="req-tag">exemplo</span>');

    const reason = req.reason
      ? escapeHtml(req.reason)
      : 'Sem detalhes adicionais. Combine os detalhes direto no WhatsApp.';

    const deleteBtn = req.demo
      ? ''
      : `<button class="icon-btn" type="button" data-action="delete" data-id="${escapeHtml(req.id)}" aria-label="Apagar pedido" title="Apagar pedido"><svg aria-hidden="true"><use href="#i-trash"/></svg></button>`;

    const tools = `
      <div class="req-tools">
        <button class="icon-btn" type="button" data-action="copy" data-id="${escapeHtml(req.id)}" aria-label="Copiar link do pedido" title="Copiar link do pedido"><svg aria-hidden="true"><use href="#i-share"/></svg></button>
        <button class="icon-btn" type="button" data-action="done" data-id="${escapeHtml(req.id)}" aria-label="${done ? 'Reabrir pedido' : 'Marcar como atendido'}" title="${done ? 'Reabrir pedido' : 'Marcar como atendido'}"><svg aria-hidden="true"><use href="#${done ? 'i-clock' : 'i-check'}"/></svg></button>
        ${deleteBtn}
      </div>`;

    const mainAction = done
      ? '<span class="req-done-label"><svg aria-hidden="true"><use href="#i-check"/></svg> Pedido atendido</span>'
      : `
        <button class="btn btn-wa req-help" type="button" data-action="help" data-id="${escapeHtml(req.id)}">
          <svg aria-hidden="true"><use href="#i-wa"/></svg> Ajudar no WhatsApp
        </button>`;

    return `
      <article class="${classes.join(' ')}" data-id="${escapeHtml(req.id)}" data-urgency="${escapeHtml(req.urgency)}">
        <div class="req-top">
          <span class="avatar" aria-hidden="true">${escapeHtml(initials(req.name))}</span>
          <div>
            <p class="req-id-line"><span class="req-id">Pedido #${escapeHtml(String(req.id).slice(0, 4))}</span>${idChips.join('')}</p>
            <h3 class="req-name">${escapeHtml(shortName(req.name))}</h3>
          </div>
          <div class="req-badges">${topBadge}</div>
        </div>
        <div class="req-meta">
          <span><svg aria-hidden="true"><use href="#i-pin"/></svg>${escapeHtml(req.hood)} · ${escapeHtml(city)}</span>
          <span><svg aria-hidden="true"><use href="#i-users"/></svg>${Number(req.people) || 1} ${Number(req.people) === 1 ? 'pessoa' : 'pessoas'}</span>
          <span><svg aria-hidden="true"><use href="#i-wa"/></svg>${escapeHtml(maskPhone(req.phone))}</span>
        </div>
        <p class="req-quote">${reason}</p>
        <div class="req-foot">
          ${mainAction}
          <span class="req-time">${timeAgo(req.createdAt)}</span>
          ${tools}
        </div>
      </article>
    `;
  }

  function renderBoard() {
    const grid = $('#board-grid');
    const empty = $('#board-empty');
    const list = filteredRequests();
    if (grid) grid.innerHTML = list.map(cardHtml).join('');
    if (empty) empty.hidden = list.length > 0;
    if (grid) grid.hidden = list.length === 0;

    const demoNote = $('#demo-note');
    if (demoNote) demoNote.hidden = state.demoRemoved;

    const activeChip = $(`.chip[data-filter="${state.filter}"]`);
    $$('.chip').forEach((chip) => chip.classList.toggle('is-active', chip === activeChip));
  }

  function renderAll() {
    renderStats();
    renderBoard();
  }

  /* ---------------- toast ---------------- */

  let toastTimer = 0;
  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-on');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.classList.remove('is-on'), 3600);
  }

  async function copyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch (_) {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); toast(message); }
      catch (__) { toast('Não foi possível copiar. Selecione o link manualmente.'); }
      area.remove();
    }
  }

  /* ---------------- form ---------------- */

  function setError(input, message) {
    if (!input) return;
    const field = input.closest('.field') || input.closest('.consent');
    const error = field ? field.parentElement.querySelector(`[data-error-for="${input.id}"]`) : null;
    if (input.type !== 'checkbox') {
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
    }
    if (error) error.textContent = message || '';
  }

  function clearError(input) {
    setError(input, '');
  }

  function validateForm() {
    const name = $('#f-name');
    const phone = $('#f-phone');
    const hood = $('#f-hood');
    const city = $('#f-city');
    const consent = $('#f-consent');
    let firstInvalid = null;

    const fail = (input, message) => {
      setError(input, message);
      if (!firstInvalid) firstInvalid = input;
    };

    if (!name.value.trim() || name.value.trim().length < 2) fail(name, 'Escreva como você quer ser chamado(a).');
    if (!isValidLocalPhone(phone.value)) fail(phone, 'Informe um WhatsApp válido com DDD.');
    if (!hood.value.trim() || hood.value.trim().length < 2) fail(hood, 'Informe o seu bairro.');
    if (!city.value.trim() || city.value.trim().length < 2) fail(city, 'Informe a sua cidade.');
    if (!consent.checked) {
      const error = $('.consent-error');
      if (error) error.textContent = 'Precisamos da sua autorização para publicar o pedido.';
      if (!firstInvalid) firstInvalid = consent;
    } else {
      const error = $('.consent-error');
      if (error) error.textContent = '';
    }

    if (firstInvalid) {
      firstInvalid.focus({ preventScroll: false });
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return null;
    }

    const urgency = $('input[name="urgency"]:checked');
    return {
      id: makeId(),
      name: name.value.trim(),
      phone: digits(phone.value),
      hood: hood.value.trim(),
      city: city.value.trim(),
      people: Number($('#f-people').value) || 1,
      urgency: urgency ? urgency.value : 'semana',
      reason: $('#f-reason').value.trim(),
      createdAt: Date.now(),
      demo: false
    };
  }

  function handleSubmit(event) {
    event.preventDefault();
    const req = validateForm();
    if (!req) return;

    state.requests.unshift(req);
    state.shared = null;
    state.filter = 'todos';
    state.query = '';
    const searchInput = $('#board-search');
    if (searchInput) searchInput.value = '';
    saveRequests();
    state.highlightId = req.id;
    renderAll();

    const form = $('#request-form');
    form.reset();
    const cityBase = state.config.city.split(/[—–-]/)[0].trim();
    if (cityBase) $('#f-city').value = cityBase;

    const dialog = $('#success-dialog');
    const linkInput = $('#share-link');
    if (linkInput) linkInput.value = requestShareUrl(req);
    const successWa = $('#success-wa');
    if (successWa) successWa.href = campaignWa(requesterMessage(req));
    if (dialog && typeof dialog.showModal === 'function') {
      dialog.showModal();
      window.setTimeout(() => { if (linkInput) linkInput.select(); }, 120);
    } else {
      toast('Pedido publicado. Copie o link na lista de pedidos.');
    }

    toast('Pedido publicado! Compartilhe o link com quem pode ajudar.');

    if (location.hash.startsWith('#p=')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    window.setTimeout(() => {
      state.highlightId = null;
    }, 3200);
  }

  /* ---------------- board actions ---------------- */

  function handleBoardClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const req = requestById(button.dataset.id);
    if (!req) return;
    const action = button.dataset.action;

    if (action === 'help') {
      if (req.demo) {
        toast('Pedido de exemplo com número fictício. Publique um pedido real para testar o WhatsApp.');
        return;
      }
      window.open(waLink(req.phone, donorMessage(req)), '_blank', 'noopener');
      return;
    }

    if (action === 'copy') {
      copyText(requestShareUrl(req), 'Link do pedido copiado. Envie para quem pode ajudar.');
      return;
    }

    if (action === 'done') {
      if (state.done.has(req.id)) {
        state.done.delete(req.id);
        toast('Pedido reaberto na lista.');
      } else {
        state.done.add(req.id);
        toast('Pedido marcado como atendido. Obrigado por ajudar!');
      }
      saveDone();
      renderAll();
      return;
    }

    if (action === 'delete') {
      if (!window.confirm('Apagar este pedido deste aparelho? O link compartilhado continua valendo em outros celulares.')) return;
      state.requests = state.requests.filter((item) => item.id !== req.id);
      state.done.delete(req.id);
      if (state.shared && state.shared.id === req.id) state.shared = null;
      saveRequests();
      saveDone();
      renderAll();
      toast('Pedido apagado deste aparelho.');
    }
  }

  /* ---------------- materials / print ---------------- */

  const MATERIALS = {
    poster: {
      title: 'Cartaz A4',
      desc: 'Uma página A4 para prender no comércio, no elevador ou no mural do bairro. Já vem com QR Code, telefone e sete tiras para destacar.',
      size: '210 × 297 mm · 1 por folha',
      print: 'Imprimir cartaz',
      tip: 'Dica: no celular, use “Imprimir” e escolha “Salvar como PDF”. O tamanho A4 é mantido.'
    },
    flyer: {
      title: 'Panfleto A5',
      desc: 'Meia folha para entregar de porta em porta ou deixar no balcão. Imprima duas páginas por folha A4 para economizar papel.',
      size: '148 × 210 mm · A5',
      print: 'Imprimir panfleto',
      tip: 'Dica: na impressora, escolha “2 páginas por folha” para sair dois panfletos em uma A4.'
    }
  };

  function fitSheet(frame) {
    if (!frame || frame.hidden) return;
    const sheet = frame.querySelector('.sheet');
    if (!sheet) return;
    const width = frame.clientWidth;
    if (!width) return;
    const scale = width / sheet.offsetWidth;
    sheet.style.transform = `scale(${scale})`;
    frame.style.height = `${sheet.offsetHeight * scale}px`;
  }

  function fitAllSheets() {
    $$('.sheet-frame').forEach(fitSheet);
  }

  function setSheet(kind) {
    state.sheet = kind;
    $$('.mat-tab').forEach((tab) => {
      const active = tab.dataset.sheet === kind;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $$('.sheet-frame').forEach((frame) => {
      frame.hidden = !frame.querySelector(`.sheet-${kind}`);
    });
    const meta = MATERIALS[kind];
    if (meta) {
      $('#materials-title').textContent = meta.title;
      $('#materials-desc').textContent = meta.desc;
      $('#spec-size').textContent = meta.size;
      $('#print-label').textContent = meta.print;
      const tip = $('#tip-text');
      if (tip) tip.textContent = meta.tip;
    }
    window.requestAnimationFrame(() => fitSheet($(`#panel-${kind}`)));
  }

  function printSheet(kind) {
    const sheet = document.querySelector(`.sheet-${kind}`);
    const stage = $('#print-stage');
    if (!sheet || !stage) return;
    stage.innerHTML = '';
    const clone = sheet.cloneNode(true);
    clone.style.transform = 'none';
    stage.appendChild(clone);
    document.body.dataset.print = kind;

    const cleanup = () => {
      delete document.body.dataset.print;
      stage.innerHTML = '';
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(cleanup, 3000);
    }, 80);
  }

  /* ---------------- dialogs ---------------- */

  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  function setupDialogs() {
    $$('[data-open]').forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openDialog(`${trigger.dataset.open}-dialog`);
      });
    });
    $$('[data-close]').forEach((button) => {
      button.addEventListener('click', () => closeDialog(button.closest('dialog')));
    });
    $$('.modal').forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) closeDialog(dialog);
      });
    });
  }

  function setupSettings() {
    const dialog = $('#settings-dialog');
    const form = $('#settings-form');
    if (!dialog || !form) return;

    const fill = () => {
      $('#s-name').value = state.config.name;
      $('#s-city').value = state.config.city;
      $('#s-wa').value = digits(state.config.whatsapp);
      $('#s-pix').value = state.config.pix || '';
      setError($('#s-wa'), '');
    };

    $$('[data-open="settings"]').forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        fill();
        openDialog('settings-dialog');
      });
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = $('#s-name').value.trim();
      const city = $('#s-city').value.trim();
      const phone = digits($('#s-wa').value);
      const pix = $('#s-pix').value.trim();

      if (!name) { toast('Dê um nome para a campanha.'); $('#s-name').focus(); return; }
      if (!city) { toast('Informe a cidade da campanha.'); $('#s-city').focus(); return; }
      if (phone.length < 10 || phone.length > 13 || (phone.length > 11 && !phone.startsWith('55'))) {
        setError($('#s-wa'), 'Use DDI + DDD + número. Ex.: 5511999999999.');
        $('#s-wa').focus();
        return;
      }

      state.config = { name, city, whatsapp: waNumber(phone), pix };
      saveConfig();
      applyConfig();
      setupQr();
      renderAll();
      closeDialog(dialog);
      toast('Configuração salva. Cartaz, panfleto e WhatsApp atualizados.');
    });

    const resetDemo = $('#reset-demo');
    if (resetDemo) {
      resetDemo.addEventListener('click', () => {
        state.demoRemoved = false;
        store.remove(KEYS.demo);
        renderAll();
        toast('Pedidos de exemplo restaurados.');
      });
    }

    const wipe = $('#wipe-data');
    if (wipe) {
      wipe.addEventListener('click', () => {
        if (!window.confirm('Apagar todos os pedidos e configurações deste aparelho? Esta ação não pode ser desfeita.')) return;
        state.requests = [];
        state.done = new Set();
        state.shared = null;
        state.demoRemoved = true;
        saveRequests();
        saveDone();
        store.set(KEYS.demo, true);
        store.remove(KEYS.config);
        state.config = Object.assign({}, DEFAULT_CONFIG);
        saveConfig();
        applyConfig();
        setupQr();
        history.replaceState(null, '', location.pathname + location.search);
        renderAll();
        closeDialog(dialog);
        toast('Dados apagados deste aparelho.');
      });
    }
  }

  /* ---------------- misc UI ---------------- */

  function setupReveal() {
    const items = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('in'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach((item) => observer.observe(item));

    // Rede de segurança: nunca deixe conteúdo invisível se o observer não disparar.
    window.setTimeout(() => {
      items.forEach((item) => item.classList.add('in'));
    }, 3000);
  }

  function setupHeader() {
    const header = $('.site-header');
    if (!header) return;
    const update = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* ---------------- init ---------------- */

  function init() {
    document.documentElement.classList.add('js');

    state.shared = parseShareHash();

    applyConfig();
    setupQr();
    renderAll();
    setupDialogs();
    setupSettings();
    setupReveal();
    setupHeader();

    const form = $('#request-form');
    if (form) form.addEventListener('submit', handleSubmit);

    const phone = $('#f-phone');
    if (phone) {
      phone.addEventListener('input', () => {
        phone.value = formatPhoneInput(phone.value);
        clearError(phone);
      });
    }

    ['f-name', 'f-hood', 'f-city', 'f-reason'].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.addEventListener('input', () => clearError(input));
    });
    const consent = $('#f-consent');
    if (consent) {
      consent.addEventListener('change', () => {
        const error = $('.consent-error');
        if (error) error.textContent = '';
      });
    }

    const grid = $('#board-grid');
    if (grid) grid.addEventListener('click', handleBoardClick);

    $$('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.filter = chip.dataset.filter;
        renderBoard();
      });
    });

    const search = $('#board-search');
    if (search) {
      search.addEventListener('input', () => {
        state.query = search.value;
        renderBoard();
      });
    }

    const removeDemo = $('#remove-demo');
    if (removeDemo) {
      removeDemo.addEventListener('click', () => {
        state.demoRemoved = true;
        store.set(KEYS.demo, true);
        renderAll();
        toast('Pedidos de exemplo removidos. Publique o primeiro pedido real.');
      });
    }

    const materialTabs = $$('.mat-tab');
    materialTabs.forEach((tab, index) => {
      tab.addEventListener('click', () => setSheet(tab.dataset.sheet));
      tab.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const target = materialTabs[(index + (event.key === 'ArrowRight' ? 1 : materialTabs.length - 1)) % materialTabs.length];
        target.focus();
        setSheet(target.dataset.sheet);
      });
    });
    const printBtn = $('#print-btn');
    if (printBtn) printBtn.addEventListener('click', () => printSheet(state.sheet));
    const pdfBtn = $('#pdf-btn');
    if (pdfBtn) pdfBtn.addEventListener('click', () => {
      toast('Na janela de impressão, escolha “Salvar como PDF”.');
      printSheet(state.sheet);
    });

    const copyShare = $('#copy-share');
    if (copyShare) {
      copyShare.addEventListener('click', () => {
        const value = $('#share-link').value;
        if (value) copyText(value, 'Link copiado! Envie nos grupos e no status.');
      });
    }
    const viewRequest = $('#view-request');
    if (viewRequest) {
      viewRequest.addEventListener('click', () => {
        closeDialog($('#success-dialog'));
        const section = $('#pedidos');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    const copyPix = $('#copy-pix');
    if (copyPix) {
      copyPix.addEventListener('click', () => {
        if (state.config.pix) copyText(state.config.pix, 'Chave PIX copiada.');
      });
    }

    const year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());

    fitAllSheets();
    window.addEventListener('resize', fitAllSheets);
    window.addEventListener('load', fitAllSheets);
    if ('ResizeObserver' in window) {
      const preview = $('.materials-preview');
      if (preview) new ResizeObserver(fitAllSheets).observe(preview);
    }

    window.addEventListener('hashchange', () => {
      const shared = parseShareHash();
      if (shared) {
        state.shared = shared;
        state.highlightId = shared.id;
        renderAll();
        window.setTimeout(() => {
          const section = $('#pedidos');
          if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
      }
    });

    if (state.shared) {
      window.setTimeout(() => {
        const section = $('#pedidos');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        toast('Pedido compartilhado aberto. Fale com a família pelo WhatsApp.');
      }, 700);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
