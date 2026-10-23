(() => {
  const { roles, itemCategories, items, shikigami, onmyoji, spells, seedBuilds } = window.ONMYO;
  const STORAGE_KEY = 'shikigami-forge:v1';
  const $ = (id) => document.getElementById(id);

  const roleList = Object.values(roles);
  const itemList = Object.values(itemCategories);
  const shikiById = new Map(shikigami.map((s) => [s.id, s]));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const onmyojiById = new Map(onmyoji.map((o) => [o.id, o]));
  const spellById = new Map(spells.map((s) => [s.id, s]));

  const state = {
    view: 'explore',
    role: 'all',
    scope: 'all',
    sort: 'popular',
    query: '',
    shikiRole: 'all',
    shikiQuery: '',
    itemCat: 'all',
    itemQuery: '',
    modalBuildId: null,
    editor: null
  };

  let store = loadStore();

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { custom: [], liked: {} };
      const parsed = JSON.parse(raw);
      return {
        custom: Array.isArray(parsed.custom) ? parsed.custom.filter((b) => b && b.id && b.shikigamiId) : [],
        liked: parsed.liked && typeof parsed.liked === 'object' ? parsed.liked : {}
      };
    } catch {
      return { custom: [], liked: {} };
    }
  }

  function saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      toast('Não foi possível salvar no navegador.', 'error');
    }
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function icon(name, cls = 'icon') {
    return `<svg class="${cls}"><use href="#i-${name}"/></svg>`;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function setInput(id, value) {
    const input = $(id);
    if (input && input.value !== value) input.value = value;
  }

  function roleOf(shiki) {
    return roles[shiki ? shiki.role : 'lutador'] || roles.lutador;
  }

  function allBuilds() {
    return [
      ...store.custom.map((build) => ({ ...build, isCustom: true })),
      ...seedBuilds.map((build) => ({ ...build, isCustom: false }))
    ];
  }

  function getBuild(id) {
    return allBuilds().find((build) => build.id === id) || null;
  }

  function likesOf(build) {
    return (build.likes || 0) + (store.liked[build.id] ? 1 : 0);
  }

  function formatLikes(n) {
    return n > 999 ? `${(n / 1000).toFixed(1).replace('.', ',')}k` : String(n);
  }

  function formatDate(value) {
    if (!value) return 'agora';
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return 'agora';
    const days = Math.max(0, Math.floor((Date.now() - then) / 86400000));
    if (days === 0) return 'hoje';
    if (days === 1) return 'ontem';
    if (days < 30) return `há ${days} dias`;
    const months = Math.floor(days / 30);
    if (months < 12) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
    return `há ${Math.floor(months / 12)} ano(s)`;
  }

  function itemColor(item) {
    return itemCategories[item.category] ? itemCategories[item.category].color : '#8b8fa3';
  }

  function itemIcon(item, extra = '') {
    if (!item) {
      return `<span class="item-icon empty ${extra}">◇</span>`;
    }
    return `<span class="item-icon ${extra}" style="--c:${itemColor(item)}" title="${esc(item.name)}">${esc(item.glyph)}</span>`;
  }

  function portrait(shiki, extra = '') {
    const role = roleOf(shiki);
    const long = shiki.kanji.length > 2 ? ' long' : '';
    return `<div class="shiki-portrait" style="--accent:${role.color}">
      <span class="portrait-halo"></span>
      <span class="portrait-glyph${long}">${esc(shiki.kanji)}</span>
      ${extra}
    </div>`;
  }

  function calcStats(ids) {
    const totals = { atk: 0, mag: 0, def: 0, hp: 0, spd: 0, crit: 0, util: 0 };
    ids.filter(Boolean).forEach((id) => {
      const item = itemById.get(id);
      if (!item) return;
      Object.keys(totals).forEach((key) => {
        totals[key] += item.stats[key] || 0;
      });
    });
    return totals;
  }

  function axesFromStats(totals) {
    return {
      atk: clamp(((totals.atk + totals.crit * 0.8) / 220) * 100, 0, 100),
      mag: clamp((totals.mag / 200) * 100, 0, 100),
      def: clamp(((totals.def + totals.hp * 0.35) / 200) * 100, 0, 100),
      hp: clamp((totals.hp / 250) * 100, 0, 100),
      mob: clamp((totals.spd / 70) * 100, 0, 100),
      util: clamp((totals.util / 90) * 100, 0, 100)
    };
  }

  function synergyOf(build) {
    const shiki = shikiById.get(build.shikigamiId);
    if (!shiki) return 0;
    const prefs = roles[shiki.role].prefs;
    const filled = (build.items || []).map((id) => itemById.get(id)).filter(Boolean);
    if (!filled.length) return 0;
    const avg = filled.reduce((sum, item) => sum + (prefs[item.category] || 0.2), 0) / filled.length;
    let score = 37 + avg * 55;
    if (build.onmyoji) score += 2;
    score += Math.min((build.spells || []).length, 2);
    score += (filled.length / 6) * 3;
    return Math.round(clamp(score, 30, 99));
  }

  function radarSVG(axes) {
    const cx = 100;
    const cy = 100;
    const radius = 70;
    const keys = ['atk', 'mag', 'def', 'hp', 'mob', 'util'];
    const labels = ['Dano', 'Magia', 'Defesa', 'Vida', 'Móvel', 'Util'];
    const angle = (i) => (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const point = (i, r) => {
      const a = angle(i);
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };
    const polygon = (r) => keys.map((_, i) => point(i, r).map((n) => n.toFixed(1)).join(',')).join(' ');
    const dataPoints = keys.map((key, i) => point(i, (radius * clamp(axes[key] || 0, 0, 100)) / 100).map((n) => n.toFixed(1)).join(',')).join(' ');

    let grid = '';
    [0.34, 0.67, 1].forEach((level) => {
      grid += `<polygon points="${polygon(radius * level)}" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1"/>`;
    });
    let spokes = '';
    labels.forEach((label, i) => {
      const end = point(i, radius);
      spokes += `<line x1="${cx}" y1="${cy}" x2="${end[0].toFixed(1)}" y2="${end[1].toFixed(1)}" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>`;
      const pos = point(i, radius + 17);
      const anchor = Math.abs(pos[0] - cx) < 4 ? 'middle' : pos[0] > cx ? 'start' : 'end';
      spokes += `<text class="radar-label" x="${pos[0].toFixed(1)}" y="${(pos[1] + 3).toFixed(1)}" text-anchor="${anchor}">${label}</text>`;
    });

    return `<svg class="radar-svg" viewBox="0 0 200 200" role="img" aria-label="Perfil estimado da build">
      ${grid}${spokes}
      <polygon class="radar-shape" points="${dataPoints}"/>
      ${keys.map((key, i) => {
        const p = point(i, (radius * clamp(axes[key] || 0, 0, 100)) / 100);
        return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.1" fill="#e05360"/>`;
      }).join('')}
    </svg>`;
  }

  function emptyAxes() {
    return { atk: 0, mag: 0, def: 0, hp: 0, mob: 0, util: 0 };
  }

  function roleChips(container, active, handler, withAll = true) {
    const html = (withAll ? `<button class="chip ${active === 'all' ? 'is-active' : ''}" data-role="all"><span class="chip-glyph">全</span> Todos</button>` : '') +
      roleList.map((role) => `<button class="chip ${active === role.id ? 'is-active' : ''}" data-role="${role.id}"><span class="chip-glyph">${role.glyph}</span> ${role.name}</button>`).join('');
    container.innerHTML = html;
    container.onclick = (event) => {
      const chip = event.target.closest('[data-role]');
      if (!chip) return;
      handler(chip.dataset.role);
    };
  }

  function renderHeroFeature() {
    const build = seedBuilds.slice().sort((a, b) => likesOf(b) - likesOf(a))[0];
    if (!build) return;
    const shiki = shikiById.get(build.shikigamiId);
    if (!shiki) return;
    const role = roleOf(shiki);
    const score = synergyOf(build);
    $('heroFeature').innerHTML = `
      <div class="feature-card">
        <span class="feature-flag">${icon('spark')} Em destaque</span>
        <div class="feature-main">
          <div class="detail-avatar" style="--accent:${role.color}"><span class="${shiki.kanji.length > 2 ? 'long' : ''}">${esc(shiki.kanji)}</span></div>
          <div class="feature-info">
            <h3>${esc(build.name)}</h3>
            <div class="feature-shiki">${esc(shiki.name)}<span class="dot"></span>${role.name}</div>
            <div class="feature-statline">
              <div><b>${formatLikes(likesOf(build))}</b>favoritos</div>
              <div><b>${score}%</b>sinergia</div>
              <div><b>${formatDate(build.createdAt)}</b>publicada</div>
            </div>
          </div>
        </div>
        <div class="feature-items">
          ${(build.items || []).map((id) => itemIcon(itemById.get(id), 'lg')).join('')}
        </div>
        <button class="feature-cta" data-detail="${esc(build.id)}">
          <span>Ver build completa</span>${icon('arrow')}
        </button>
      </div>`;
  }

  function filteredBuilds() {
    const query = state.query.trim().toLowerCase();
    let list = allBuilds();
    if (state.scope === 'favorites') list = list.filter((build) => store.liked[build.id]);
    if (state.scope === 'mine') list = list.filter((build) => build.isCustom);
    if (state.role !== 'all') list = list.filter((build) => {
      const shiki = shikiById.get(build.shikigamiId);
      return shiki && shiki.role === state.role;
    });
    if (query) {
      list = list.filter((build) => {
        const shiki = shikiById.get(build.shikigamiId);
        const haystack = [
          build.name,
          build.author,
          shiki ? shiki.name : '',
          shiki ? shiki.title : '',
          ...(shiki ? shiki.tags : [])
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      });
    }
    if (state.sort === 'popular') list.sort((a, b) => likesOf(b) - likesOf(a));
    if (state.sort === 'recent') list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (state.sort === 'synergy') list.sort((a, b) => synergyOf(b) - synergyOf(a));
    return list;
  }

  function buildCard(build, index) {
    const shiki = shikiById.get(build.shikigamiId);
    if (!shiki) return '';
    const role = roleOf(shiki);
    const score = synergyOf(build);
    const liked = !!store.liked[build.id];
    return `<article class="build-card" data-build="${esc(build.id)}" tabindex="0" role="button" aria-label="Abrir build ${esc(build.name)}" style="--accent:${role.color};--d:${Math.min(index * 35, 350)}ms">
      <div class="build-media">
        ${portrait(shiki)}
        <span class="media-fade"></span>
        <span class="media-tier">${esc(shiki.tier)}</span>
        <span class="media-role">${role.name}</span>
        <button class="like-btn ${liked ? 'is-liked' : ''}" data-like="${esc(build.id)}" aria-label="Favoritar build" aria-pressed="${liked}">
          ${icon('heart')}<span data-like-count="${esc(build.id)}">${formatLikes(likesOf(build))}</span>
        </button>
      </div>
      <div class="build-body">
        <div class="build-title-row">
          <div>
            <h3 class="build-title">${esc(build.name)}</h3>
            <div class="build-shiki">${esc(shiki.name)}<span class="dot"></span>${esc(shiki.title)}</div>
          </div>
          ${build.isCustom ? `<div class="card-menu">
            <button class="mini-btn" data-edit="${esc(build.id)}" title="Editar build">${icon('edit')}</button>
            <button class="mini-btn danger" data-delete="${esc(build.id)}" title="Excluir build">${icon('trash')}</button>
          </div>` : ''}
        </div>
        <div class="build-items">
          ${Array.from({ length: 6 }, (_, i) => itemIcon(itemById.get((build.items || [])[i]))).join('')}
        </div>
        <div class="build-foot">
          <div class="author">
            <span class="author-avatar">${esc((build.author || 'V').slice(0, 1).toUpperCase())}</span>
            <span>${build.isCustom ? 'Você' : esc(build.author)}</span>
          </div>
          <div class="synergy">
            <span class="synergy-bar"><i style="width:${score}%"></i></span>
            <b>${score}%</b> sinergia
          </div>
        </div>
      </div>
    </article>`;
  }

  function renderBuilds() {
    roleChips($('roleChips'), state.role, (value) => {
      state.role = value;
      renderBuilds();
    });
    document.querySelectorAll('#scopeTabs .scope-tab').forEach((tab) => {
      tab.classList.toggle('is-active', tab.dataset.scope === state.scope);
    });
    const list = filteredBuilds();
    $('buildGrid').classList.toggle('no-anim', state.query.trim() !== '');
    $('buildGrid').innerHTML = list.map((build, index) => buildCard(build, index)).join('');
    $('buildCount').textContent = `${list.length} build${list.length === 1 ? '' : 's'}`;
    $('buildEmpty').hidden = list.length > 0;
    const hasFilters = state.role !== 'all' || state.scope !== 'all' || state.query.trim() !== '';
    $('clearFilters').hidden = !hasFilters;
    setInput('buildSearch', state.query);
    $('buildSort').value = state.sort;
    updateCounts();
  }

  function renderShiki() {
    roleChips($('shikiRoleChips'), state.shikiRole, (value) => {
      state.shikiRole = value;
      renderShiki();
    });
    const query = state.shikiQuery.trim().toLowerCase();
    const list = shikigami.filter((shiki) => {
      if (state.shikiRole !== 'all' && shiki.role !== state.shikiRole) return false;
      if (!query) return true;
      return [shiki.name, shiki.title, shiki.kanji, ...shiki.tags].join(' ').toLowerCase().includes(query);
    });
    $('shikiGrid').classList.toggle('no-anim', query !== '');
    $('shikiGrid').innerHTML = list.map((shiki, index) => {
      const role = roleOf(shiki);
      const dots = Array.from({ length: 5 }, (_, i) => `<i class="${i < shiki.difficulty ? 'on' : ''}"></i>`).join('');
      return `<button class="shiki-card" data-shiki="${esc(shiki.id)}" style="--accent:${role.color};--d:${Math.min(index * 24, 300)}ms">
        <span class="shiki-tier">${esc(shiki.tier)}</span>
        <span class="shiki-avatar"><span class="${shiki.kanji.length > 2 ? 'long' : ''}">${esc(shiki.kanji)}</span></span>
        <span class="shiki-info">
          <h3>${esc(shiki.name)}</h3>
          <p>${esc(shiki.title)}</p>
          <span class="shiki-meta"><span class="shiki-role">${role.name}</span><span class="shiki-diff">${dots}</span></span>
        </span>
      </button>`;
    }).join('');
    $('shikiCount').textContent = `${list.length} shikigami`;
    $('shikiEmpty').hidden = list.length > 0;
    setInput('shikiSearch', state.shikiQuery);
  }

  function statPills(item) {
    const labels = { atk: 'ATQ', mag: 'MAG', def: 'DEF', hp: 'VID', spd: 'VEL', crit: 'CRIT', util: 'UTIL' };
    return Object.entries(labels)
      .filter(([key]) => item.stats[key])
      .map(([key, label]) => `<span class="stat-pill">${label} <b>+${item.stats[key]}</b></span>`)
      .join('');
  }

  function renderItems() {
    const allChip = `<button class="chip ${state.itemCat === 'all' ? 'is-active' : ''}" data-cat="all"><span class="chip-glyph">全</span> Todos</button>`;
    $('itemChips').innerHTML = allChip + itemList.map((cat) => `<button class="chip ${state.itemCat === cat.id ? 'is-active' : ''}" data-cat="${cat.id}"><span class="chip-glyph">${cat.glyph}</span> ${cat.name}</button>`).join('');
    $('itemChips').onclick = (event) => {
      const chip = event.target.closest('[data-cat]');
      if (!chip) return;
      state.itemCat = chip.dataset.cat;
      renderItems();
    };
    const query = state.itemQuery.trim().toLowerCase();
    const list = items.filter((item) => {
      if (state.itemCat !== 'all' && item.category !== state.itemCat) return false;
      if (!query) return true;
      return [item.name, item.passive, ...item.tags].join(' ').toLowerCase().includes(query);
    });
    $('itemGrid').classList.toggle('no-anim', query !== '');
    $('itemGrid').innerHTML = list.map((item, index) => {
      const cat = itemCategories[item.category];
      return `<article class="item-card" style="--c:${cat.color};--d:${Math.min(index * 20, 260)}ms">
        <div class="item-card-head">
          ${itemIcon(item, 'lg')}
          <div>
            <h3>${esc(item.name)}</h3>
            <div class="item-cat">${cat.name}</div>
          </div>
        </div>
        <div class="stat-pills">${statPills(item)}</div>
        <p class="item-passive">${esc(item.passive)}</p>
      </article>`;
    }).join('');
    $('itemCount').textContent = `${list.length} itens`;
    $('itemEmpty').hidden = list.length > 0;
    setInput('itemSearch', state.itemQuery);
  }

  function updateCounts() {
    const builds = allBuilds();
    const favs = builds.filter((build) => store.liked[build.id]).length;
    $('favCount').textContent = favs;
    $('mineCount').textContent = store.custom.length;
    $('statBuilds').textContent = builds.length;
    $('statShiki').textContent = shikigami.length;
    $('statItems').textContent = items.length;
  }

  function switchView(view) {
    state.view = view;
    document.querySelectorAll('.view').forEach((section) => {
      section.hidden = section.dataset.view !== view;
    });
    document.querySelectorAll('[data-nav]').forEach((button) => {
      if (button.classList.contains('nav-link')) button.classList.toggle('is-active', button.dataset.nav === view);
    });
    if (view === 'shikigami') renderShiki();
    if (view === 'items') renderItems();
    if (view === 'explore') renderBuilds();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openModal(html) {
    state.modalBuildId = null;
    $('modalContent').innerHTML = html;
    $('modal').hidden = false;
    $('modal').scrollTop = 0;
    $('modalContent').parentElement.scrollTop = 0;
    lockBody();
  }

  function closeModal() {
    $('modal').hidden = true;
    $('modalContent').innerHTML = '';
    state.modalBuildId = null;
    lockBody();
  }

  function lockBody() {
    const locked = !$('modal').hidden || !$('editor').hidden;
    document.body.classList.toggle('is-locked', locked);
  }

  function detailItemRow(id) {
    const item = itemById.get(id);
    if (!item) return '';
    const cat = itemCategories[item.category];
    return `<div class="detail-item">
      ${itemIcon(item, 'lg')}
      <div class="detail-item-info">
        <b>${esc(item.name)}</b>
        <small>${cat.name} · ${esc(item.tags.slice(0, 2).join(' · '))}</small>
      </div>
    </div>`;
  }

  function openDetail(id) {
    const build = getBuild(id);
    if (!build) return;
    const shiki = shikiById.get(build.shikigamiId);
    if (!shiki) return;
    const role = roleOf(shiki);
    const totals = calcStats(build.items || []);
    const axes = axesFromStats(totals);
    const score = synergyOf(build);
    const liked = !!store.liked[build.id];
    const onmyojiData = onmyojiById.get(build.onmyoji);
    const buildSpells = (build.spells || []).map((sid) => spellById.get(sid)).filter(Boolean);
    const itemRows = (build.items || []).filter(Boolean).map(detailItemRow).join('');
    const runeChips = [
      onmyojiData ? `<span class="rune-chip"><span class="onmyoji-glyph">${esc(onmyojiData.glyph)}</span><span>${esc(onmyojiData.name)}<small>Onmyoji</small></span></span>` : '',
      ...buildSpells.map((spell) => `<span class="rune-chip"><span class="spell-glyph">${esc(spell.glyph)}</span><span>${esc(spell.name)}<small>${esc(spell.tag)}</small></span></span>`)
    ].filter(Boolean).join('');

    state.modalBuildId = build.id;
    $('modalContent').innerHTML = `
      <div class="detail-hero" style="--accent:${role.color}" data-kanji="${esc(shiki.kanji)}">
        <div class="detail-avatar" style="--accent:${role.color}"><span class="${shiki.kanji.length > 2 ? 'long' : ''}">${esc(shiki.kanji)}</span></div>
        <div class="detail-head-info">
          <div class="detail-badges">
            <span class="badge role">${role.name}</span>
            <span class="badge tier">Tier ${esc(shiki.tier)}</span>
            ${build.isCustom ? '<span class="badge">Sua build</span>' : ''}
          </div>
          <h2>${esc(build.name)}</h2>
          <div class="detail-shiki">${esc(shiki.name)} · ${esc(shiki.title)}</div>
          <div class="detail-author">
            <span class="author-avatar">${esc((build.author || 'V').slice(0, 1).toUpperCase())}</span>
            ${build.isCustom ? 'por você' : `por ${esc(build.author)}`} · ${formatDate(build.createdAt)}
            <span>·</span>
            <span data-like-count="${esc(build.id)}">${formatLikes(likesOf(build))}</span> favoritos
          </div>
        </div>
      </div>
      <div class="detail-body">
        <div class="detail-left">
          <div class="detail-block">
            <h3>Arsenal</h3>
            <div class="detail-items">
              ${itemRows || '<p class="detail-notes">Nenhum item adicionado a esta build.</p>'}
            </div>
          </div>
          <div class="detail-block">
            <h3>Onmyoji e feitiços</h3>
            <div class="detail-runeline">${runeChips || '<span class="muted">Não definidos.</span>'}</div>
          </div>
          ${build.notes ? `<div class="detail-block"><h3>Notas do autor</h3><p class="detail-notes">${esc(build.notes)}</p></div>` : ''}
        </div>
        <div class="detail-side">
          <div class="side-card">
            <div class="card-kicker">Desempenho estimado</div>
            <div class="radar-wrap">${radarSVG(axes)}</div>
          </div>
          <div class="side-card">
            <div class="card-kicker">Sinergia com a função</div>
            <div class="synergy-big"><b>${score}</b><span>%</span></div>
            <div class="progress"><i style="width:${score}%"></i></div>
            <div style="margin-top:12px">
              <div class="side-stat"><span>Itens equipados</span><b>${(build.items || []).filter(Boolean).length}/6</b></div>
              <div class="side-stat"><span>Feitiços</span><b>${buildSpells.length}/2</b></div>
              <div class="side-stat"><span>Favoritos</span><b data-like-count="${esc(build.id)}">${formatLikes(likesOf(build))}</b></div>
            </div>
          </div>
          <div class="detail-actions">
            <button class="btn btn-primary" data-clone="${esc(build.id)}">Usar como base ${icon('arrow')}</button>
            <div class="detail-actions-row">
              <button class="btn btn-outline ${liked ? 'is-liked' : ''}" data-like="${esc(build.id)}" aria-pressed="${liked}">
                ${icon('heart')}<span>Favoritar</span>
              </button>
              <button class="btn btn-outline" data-share="${esc(build.id)}">${icon('copy')} Código</button>
            </div>
            ${build.isCustom ? `<div class="detail-actions-row">
              <button class="btn btn-outline" data-edit="${esc(build.id)}">${icon('edit')} Editar</button>
              <button class="btn btn-outline" data-delete="${esc(build.id)}">${icon('trash')} Excluir</button>
            </div>` : ''}
          </div>
        </div>
      </div>`;
    $('modal').hidden = false;
    document.querySelector('.modal-panel').scrollTop = 0;
    lockBody();
  }

  function openShikiDetail(id) {
    const shiki = shikiById.get(id);
    if (!shiki) return;
    const role = roleOf(shiki);
    const builds = allBuilds().filter((build) => build.shikigamiId === id).sort((a, b) => synergyOf(b) - synergyOf(a));
    const dots = Array.from({ length: 5 }, (_, i) => `<i class="${i < shiki.difficulty ? 'on' : ''}"></i>`).join('');
    const core = (shiki.coreItems || []).map((itemId) => itemById.get(itemId)).filter(Boolean);
    const buildRows = builds.slice(0, 3).map((build) => {
      const score = synergyOf(build);
      return `<button class="build-mini" data-detail="${esc(build.id)}">
        <span class="build-mini-name">${esc(build.name)}</span>
        <span class="build-mini-meta">${formatLikes(likesOf(build))} favoritos · ${score}%</span>
      </button>`;
    }).join('');

    openModal(`
      <div class="detail-hero" style="--accent:${role.color}" data-kanji="${esc(shiki.kanji)}">
        <div class="detail-avatar" style="--accent:${role.color}"><span class="${shiki.kanji.length > 2 ? 'long' : ''}">${esc(shiki.kanji)}</span></div>
        <div class="detail-head-info">
          <div class="detail-badges">
            <span class="badge role">${role.name}</span>
            <span class="badge tier">Tier ${esc(shiki.tier)}</span>
            <span class="badge">Dificuldade ${shiki.difficulty}/5</span>
          </div>
          <h2>${esc(shiki.name)}</h2>
          <div class="detail-shiki">${esc(shiki.title)} · <span class="shiki-diff" style="display:inline-flex;vertical-align:middle">${dots}</span></div>
        </div>
      </div>
      <div class="detail-body">
        <div class="detail-left">
          <div class="detail-block">
            <h3>Sobre</h3>
            <p class="detail-notes">${esc(shiki.summary)}</p>
          </div>
          <div class="detail-block">
            <h3>Itens centrais sugeridos</h3>
            <div class="detail-runeline">
              ${core.map((item) => `<span class="rune-chip">${itemIcon(item)}<span>${esc(item.name)}<small>${itemCategories[item.category].name}</small></span></span>`).join('')}
            </div>
          </div>
          <div class="detail-block">
            <h3>Builds da comunidade</h3>
            ${buildRows ? `<div class="build-mini-list">${buildRows}</div>` : '<p class="muted">Ainda não há builds para este shikigami. Seja o primeiro.</p>'}
          </div>
        </div>
        <div class="detail-side">
          <div class="side-card">
            <div class="card-kicker">Ficha</div>
            <div class="side-stat"><span>Função</span><b>${role.name}</b></div>
            <div class="side-stat"><span>Tier</span><b>${esc(shiki.tier)}</b></div>
            <div class="side-stat"><span>Dificuldade</span><b>${shiki.difficulty}/5</b></div>
            <div class="side-stat"><span>Builds</span><b>${builds.length}</b></div>
            <div class="preview-badges" style="margin-top:10px">${shiki.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}</div>
          </div>
          <div class="detail-actions">
            <button class="btn btn-primary" data-create-shiki="${esc(shiki.id)}">Criar build ${icon('plus')}</button>
            <button class="btn btn-outline" data-view-shiki="${esc(shiki.id)}">Ver todas as builds</button>
          </div>
        </div>
      </div>`);
  }

  function openEditor(base = null, editId = null) {
    const editing = editId ? store.custom.find((build) => build.id === editId) : null;
    const source = editing || base || null;
    state.editor = {
      id: editing ? editing.id : null,
      name: source ? source.name || '' : '',
      shikigamiId: source ? source.shikigamiId : null,
      items: source ? (source.items || []).filter((id) => itemById.has(id)).slice(0, 6) : [],
      onmyoji: source ? source.onmyoji : null,
      spells: source ? (source.spells || []).filter((id) => spellById.has(id)).slice(0, 2) : [],
      notes: source ? source.notes || '' : '',
      itemTab: 'all',
      shikiQuery: ''
    };
    $('buildName').value = state.editor.name;
    $('buildNotes').value = state.editor.notes;
    $('editorShikiSearch').value = '';
    $('editorEyebrow').textContent = editing ? 'Editando composição' : 'Nova composição';
    $('editorTitle').textContent = editing ? 'Refinar build' : 'Forjar build';
    $('modal').hidden = true;
    $('editor').hidden = false;
    lockBody();
    renderEditor();
    $('editor').scrollTop = 0;
    const body = $('editor').querySelector('.editor-body');
    if (body) body.scrollTop = 0;
  }

  function closeEditor() {
    $('editor').hidden = true;
    state.editor = null;
    lockBody();
  }

  function editorBuild() {
    const editor = state.editor;
    return {
      shikigamiId: editor.shikigamiId,
      items: editor.items,
      onmyoji: editor.onmyoji,
      spells: editor.spells
    };
  }

  function renderEditor() {
    const editor = state.editor;
    if (!editor) return;
    const shiki = editor.shikigamiId ? shikiById.get(editor.shikigamiId) : null;
    const role = shiki ? roleOf(shiki) : null;
    const score = shiki ? synergyOf(editorBuild()) : 0;

    if (shiki) {
      const long = shiki.kanji.length > 2 ? ' long' : '';
      $('editorPreview').innerHTML = `
        <div class="preview-inner" style="--accent:${role.color}">
          <div class="preview-art">
            <span class="portrait-halo"></span>
            <span class="portrait-glyph${long}">${esc(shiki.kanji)}</span>
          </div>
          <div class="preview-body">
            <h3 id="previewBuildName">${esc(editor.name || shiki.name)}</h3>
            <div class="preview-sub"><span>${esc(shiki.title)}</span><span>·</span><span style="color:${role.color}">${role.name}</span></div>
            <div class="preview-badges">
              <span class="tag">Tier ${esc(shiki.tier)}</span>
              ${shiki.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}
            </div>
          </div>
        </div>`;
    } else {
      $('editorPreview').innerHTML = `<div class="preview-placeholder"><div><span>空</span><p>Escolha um shikigami para revelar o espírito da build.</p></div></div>`;
    }

    $('editorRadar').innerHTML = radarSVG(shiki ? axesFromStats(calcStats(editor.items)) : emptyAxes());

    const query = editor.shikiQuery.trim().toLowerCase();
    const shikiList = shikigami.filter((item) => !query || [item.name, item.title, item.kanji].join(' ').toLowerCase().includes(query));
    $('editorShikiGrid').innerHTML = shikiList.map((item) => {
      const itemRole = roleOf(item);
      return `<button type="button" class="editor-shiki ${editor.shikigamiId === item.id ? 'is-selected' : ''}" data-pick-shiki="${esc(item.id)}" style="--accent:${itemRole.color}">
        <span class="editor-shiki-art ${item.kanji.length > 2 ? 'long' : ''}">${esc(item.kanji)}</span>
        <span class="editor-shiki-info"><b>${esc(item.name)}</b><small>${itemRole.name}</small></span>
      </button>`;
    }).join('') || '<p class="muted" style="padding:8px">Nenhum shikigami encontrado.</p>';

    $('slotGrid').innerHTML = Array.from({ length: 6 }, (_, index) => {
      const item = itemById.get(editor.items[index]);
      if (item) {
        const color = itemColor(item);
        return `<div class="slot filled" style="--c:${color}">
          <span class="slot-index">0${index + 1}</span>
          <button type="button" class="slot-remove" data-remove-slot="${index}" aria-label="Remover ${esc(item.name)}">${icon('close')}</button>
          ${itemIcon(item)}
          <span class="slot-name">${esc(item.name)}</span>
        </div>`;
      }
      return `<div class="slot"><span class="slot-index">0${index + 1}</span><span class="item-icon empty">+</span></div>`;
    }).join('');

    const tabs = ['all', ...itemList.map((cat) => cat.id)];
    $('editorItemTabs').innerHTML = tabs.map((tab) => {
      const label = tab === 'all' ? 'Todos' : itemCategories[tab].name;
      return `<button type="button" class="editor-item-tab ${editor.itemTab === tab ? 'is-active' : ''}" data-item-tab="${tab}">${label}</button>`;
    }).join('');

    const available = items.filter((item) => editor.itemTab === 'all' || item.category === editor.itemTab);
    $('editorItemGrid').innerHTML = available.map((item) => {
      const used = editor.items.includes(item.id);
      return `<button type="button" class="editor-item ${used ? 'is-used' : ''}" data-add-item="${esc(item.id)}">
        ${itemIcon(item)}
        <span class="editor-item-info"><b>${esc(item.name)}</b><small>${itemCategories[item.category].name}</small></span>
      </button>`;
    }).join('');

    $('onmyojiRow').innerHTML = onmyoji.map((entry) => `<button type="button" class="onmyoji-chip ${editor.onmyoji === entry.id ? 'is-selected' : ''}" data-onmyoji="${esc(entry.id)}">
      <span class="onmyoji-glyph">${esc(entry.glyph)}</span>
      <span><b>${esc(entry.name)}</b><small>${esc(entry.tags.join(' · '))}</small></span>
    </button>`).join('');

    $('spellRow').innerHTML = spells.map((spell) => `<button type="button" class="spell-chip ${editor.spells.includes(spell.id) ? 'is-selected' : ''}" data-spell="${esc(spell.id)}">
      <span class="spell-glyph">${esc(spell.glyph)}</span>
      <b>${esc(spell.name)}</b>
    </button>`).join('');

    $('itemSlotsLabel').textContent = `${editor.items.length}/6`;
    $('spellLabel').textContent = `${editor.spells.length}/2`;
    $('savebarInfo').innerHTML = shiki
      ? `<b>${score}%</b> de sinergia · ${editor.items.length}/6 itens · ${(editor.spells || []).length}/2 feitiços${editor.items.length < 6 ? ' · complete os slots para liberar todo o potencial' : ''}`
      : 'Selecione um shikigami para começar.';
    $('editorSave').disabled = !shiki;
    if (document.activeElement !== $('buildName')) $('buildName').placeholder = shiki ? `Ex.: ${shiki.name} — ${role.name}` : 'Ex.: Lâmina do Vazio';
  }

  function toggleItem(id) {
    const editor = state.editor;
    const index = editor.items.indexOf(id);
    if (index >= 0) {
      editor.items.splice(index, 1);
    } else if (editor.items.length >= 6) {
      toast('Os seis slots já estão ocupados. Remova um item primeiro.', 'error');
      return;
    } else {
      editor.items.push(id);
    }
    renderEditor();
  }

  function saveEditor() {
    const editor = state.editor;
    const shiki = editor && shikiById.get(editor.shikigamiId);
    if (!shiki) {
      toast('Escolha um shikigami antes de salvar.', 'error');
      return;
    }
    if (editor.items.length === 0) {
      toast('Adicione pelo menos um item à build.', 'error');
      return;
    }
    const isEdit = !!editor.id;
    const existing = isEdit ? store.custom.find((build) => build.id === editor.id) : null;
    const name = $('buildName').value.trim() || `${shiki.name} — ${roleOf(shiki).name}`;
    const payload = {
      id: existing ? existing.id : `user-${Date.now()}`,
      name,
      shikigamiId: shiki.id,
      author: existing ? existing.author : 'Você',
      likes: existing ? existing.likes || 0 : 0,
      createdAt: existing ? existing.createdAt : new Date().toISOString().slice(0, 10),
      items: editor.items.slice(0, 6),
      onmyoji: editor.onmyoji,
      spells: editor.spells.slice(0, 2),
      notes: $('buildNotes').value.trim().slice(0, 280)
    };
    if (existing) {
      store.custom = store.custom.map((build) => (build.id === existing.id ? payload : build));
    } else {
      store.custom.unshift(payload);
    }
    saveStore();
    closeEditor();
    state.scope = 'mine';
    state.query = '';
    state.role = 'all';
    state.sort = 'popular';
    switchView('explore');
    renderBuilds();
    toast(isEdit ? 'Build atualizada.' : 'Build salva na sua coleção.');
    openDetail(payload.id);
  }

  function deleteBuild(id) {
    const build = getBuild(id);
    if (!build || !build.isCustom) return;
    openConfirm(
      'Excluir esta build?',
      `“${build.name}” será removida da sua coleção local. Essa ação não pode ser desfeita.`,
      'Excluir build',
      () => {
        store.custom = store.custom.filter((item) => item.id !== id);
        delete store.liked[id];
        saveStore();
        closeModal();
        renderBuilds();
        toast('Build excluída.');
      }
    );
  }

  function openConfirm(title, message, actionLabel, onConfirm) {
    openModal(`<div class="import-panel">
      <h2>${esc(title)}</h2>
      <p>${esc(message)}</p>
      <div class="import-actions">
        <button class="btn btn-outline" data-cancel>Cancelar</button>
        <button class="btn btn-primary" data-confirm>${esc(actionLabel)}</button>
      </div>
    </div>`);
    $('modalContent').querySelector('[data-cancel]').onclick = closeModal;
    $('modalContent').querySelector('[data-confirm]').onclick = onConfirm;
  }

  function toggleLike(id) {
    const build = getBuild(id);
    if (!build) return;
    const wasLiked = !!store.liked[id];
    if (wasLiked) delete store.liked[id];
    else store.liked[id] = true;
    saveStore();
    document.querySelectorAll(`[data-like="${CSS.escape(id)}"]`).forEach((button) => {
      button.classList.toggle('is-liked', !wasLiked);
      button.setAttribute('aria-pressed', String(!wasLiked));
    });
    document.querySelectorAll(`[data-like-count="${CSS.escape(id)}"]`).forEach((node) => {
      node.textContent = formatLikes(likesOf(build));
    });
    updateCounts();
    if (state.view === 'explore' && state.scope === 'favorites') renderBuilds();
    toast(wasLiked ? 'Removida das favoritas.' : 'Adicionada às favoritas.');
  }

  function encodeBuild(build) {
    const payload = {
      v: 1,
      n: build.name,
      s: build.shikigamiId,
      i: (build.items || []).filter(Boolean),
      o: build.onmyoji || null,
      p: (build.spells || []).filter(Boolean),
      t: build.notes || ''
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return `SHF1-${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;
  }

  function decodeBuild(code) {
    const clean = String(code || '').trim();
    if (!clean.startsWith('SHF1-')) throw new Error('Código inválido. Ele deve começar com SHF1-.');
    let payload;
    try {
      let base64 = clean.slice(5).replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Error('Código inválido ou corrompido. Verifique se copiou por completo.');
    }
    if (!payload || !shikiById.has(payload.s)) throw new Error('Shikigami desconhecido neste código.');
    return {
      name: typeof payload.n === 'string' ? payload.n.slice(0, 48) : '',
      shikigamiId: payload.s,
      items: Array.isArray(payload.i) ? [...new Set(payload.i.filter((id) => itemById.has(id)))].slice(0, 6) : [],
      onmyoji: onmyojiById.has(payload.o) ? payload.o : null,
      spells: Array.isArray(payload.p) ? [...new Set(payload.p.filter((id) => spellById.has(id)))].slice(0, 2) : [],
      notes: typeof payload.t === 'string' ? payload.t.slice(0, 280) : ''
    };
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      area.remove();
      return ok;
    }
  }

  async function shareBuild(id) {
    const build = getBuild(id);
    if (!build) return;
    const ok = await copyText(encodeBuild(build));
    toast(ok ? 'Código copiado. Cole no botão Importar.' : 'Não foi possível copiar o código.', ok ? 'ok' : 'error');
  }

  function openImport() {
    openModal(`<div class="import-panel">
      <h2>Importar build</h2>
      <p>Cole um código <strong>SHF1</strong> compartilhado por outro jogador. A build será aberta no editor como uma nova composição sua.</p>
      <textarea id="importCode" placeholder="SHF1-..." spellcheck="false"></textarea>
      <div class="import-error" id="importError" hidden></div>
      <div class="import-actions">
        <button class="btn btn-outline" data-cancel>Cancelar</button>
        <button class="btn btn-primary" data-import-submit>${icon('import')} Importar</button>
      </div>
    </div>`);
    $('modalContent').querySelector('[data-cancel]').onclick = closeModal;
    $('modalContent').querySelector('[data-import-submit]').onclick = () => {
      const error = $('importError');
      try {
        const parsed = decodeBuild($('importCode').value);
        closeModal();
        openEditor(parsed);
        toast('Código importado. Ajuste e salve sua versão.');
      } catch (err) {
        error.hidden = false;
        error.textContent = err && err.message ? err.message : 'Não foi possível ler este código.';
      }
    };
    setTimeout(() => {
      const area = $('importCode');
      if (area) area.focus();
    }, 40);
  }

  function toast(message, variant = 'ok') {
    const stack = $('toastStack');
    const node = document.createElement('div');
    node.className = `toast ${variant === 'error' ? 'error' : ''}`;
    node.innerHTML = `${icon(variant === 'error' ? 'close' : 'check')}<span>${esc(message)}</span>`;
    stack.appendChild(node);
    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 260);
    }, 2700);
  }

  function bindEvents() {
    document.querySelectorAll('[data-nav]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        switchView(button.dataset.nav);
      });
    });

    document.querySelectorAll('[data-scroll="builds"]').forEach((button) => {
      button.addEventListener('click', () => {
        switchView('explore');
        setTimeout(() => $('builds').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      });
    });

    $('createBtn').addEventListener('click', () => openEditor());
    $('heroCreate').addEventListener('click', () => openEditor());
    $('importBtn').addEventListener('click', openImport);
    $('editorClose').addEventListener('click', closeEditor);
    $('editorCancel').addEventListener('click', closeEditor);
    $('editorSave').addEventListener('click', saveEditor);
    $('editorReset').addEventListener('click', () => {
      if (!state.editor) return;
      state.editor.shikigamiId = null;
      state.editor.items = [];
      state.editor.onmyoji = null;
      state.editor.spells = [];
      state.editor.name = '';
      state.editor.notes = '';
      $('buildName').value = '';
      $('buildNotes').value = '';
      renderEditor();
      toast('Editor limpo.');
    });

    $('editorShikiSearch').addEventListener('input', (event) => {
      if (!state.editor) return;
      state.editor.shikiQuery = event.target.value;
      const query = state.editor.shikiQuery.trim().toLowerCase();
      const shikiList = shikigami.filter((item) => !query || [item.name, item.title, item.kanji].join(' ').toLowerCase().includes(query));
      $('editorShikiGrid').innerHTML = shikiList.map((item) => {
        const itemRole = roleOf(item);
        return `<button type="button" class="editor-shiki ${state.editor.shikigamiId === item.id ? 'is-selected' : ''}" data-pick-shiki="${esc(item.id)}" style="--accent:${itemRole.color}">
          <span class="editor-shiki-art ${item.kanji.length > 2 ? 'long' : ''}">${esc(item.kanji)}</span>
          <span class="editor-shiki-info"><b>${esc(item.name)}</b><small>${itemRole.name}</small></span>
        </button>`;
      }).join('') || '<p class="muted" style="padding:8px">Nenhum shikigami encontrado.</p>';
    });

    $('buildName').addEventListener('input', (event) => {
      if (!state.editor) return;
      state.editor.name = event.target.value;
      const target = $('previewBuildName');
      if (target) {
        const shiki = shikiById.get(state.editor.shikigamiId);
        target.textContent = state.editor.name || (shiki ? shiki.name : '');
      }
    });

    $('buildNotes').addEventListener('input', (event) => {
      if (state.editor) state.editor.notes = event.target.value;
    });

    $('clearItems').addEventListener('click', () => {
      if (!state.editor) return;
      state.editor.items = [];
      renderEditor();
    });

    $('buildSearch').addEventListener('input', (event) => {
      state.query = event.target.value;
      renderBuilds();
    });
    $('buildSort').addEventListener('change', (event) => {
      state.sort = event.target.value;
      renderBuilds();
    });
    $('shikiSearch').addEventListener('input', (event) => {
      state.shikiQuery = event.target.value;
      renderShiki();
    });
    $('itemSearch').addEventListener('input', (event) => {
      state.itemQuery = event.target.value;
      renderItems();
    });

    $('scopeTabs').addEventListener('click', (event) => {
      const tab = event.target.closest('[data-scope]');
      if (!tab) return;
      state.scope = tab.dataset.scope;
      renderBuilds();
    });

    $('clearFilters').addEventListener('click', () => {
      state.role = 'all';
      state.scope = 'all';
      state.query = '';
      $('buildSearch').value = '';
      renderBuilds();
    });

    $('buildGrid').addEventListener('keydown', (event) => {
      const card = event.target.closest('.build-card');
      if (!card) return;
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.target.closest('[data-like],[data-edit],[data-delete]')) return;
        event.preventDefault();
        openDetail(card.dataset.build);
      }
    });

    $('editorShikiGrid').addEventListener('click', (event) => {
      const button = event.target.closest('[data-pick-shiki]');
      if (!button || !state.editor) return;
      state.editor.shikigamiId = button.dataset.pickShiki;
      renderEditor();
    });

    $('slotGrid').addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-slot]');
      if (!button || !state.editor) return;
      state.editor.items.splice(Number(button.dataset.removeSlot), 1);
      renderEditor();
    });

    $('editorItemTabs').addEventListener('click', (event) => {
      const tab = event.target.closest('[data-item-tab]');
      if (!tab || !state.editor) return;
      state.editor.itemTab = tab.dataset.itemTab;
      renderEditor();
    });

    $('editorItemGrid').addEventListener('click', (event) => {
      const item = event.target.closest('[data-add-item]');
      if (!item) return;
      toggleItem(item.dataset.addItem);
    });

    $('onmyojiRow').addEventListener('click', (event) => {
      const chip = event.target.closest('[data-onmyoji]');
      if (!chip || !state.editor) return;
      state.editor.onmyoji = state.editor.onmyoji === chip.dataset.onmyoji ? null : chip.dataset.onmyoji;
      renderEditor();
    });

    $('spellRow').addEventListener('click', (event) => {
      const chip = event.target.closest('[data-spell]');
      if (!chip || !state.editor) return;
      const id = chip.dataset.spell;
      const index = state.editor.spells.indexOf(id);
      if (index >= 0) state.editor.spells.splice(index, 1);
      else if (state.editor.spells.length >= 2) {
        toast('Você já escolheu dois feitiços.', 'error');
        return;
      } else state.editor.spells.push(id);
      renderEditor();
    });

    $('modalClose').addEventListener('click', closeModal);
    $('modal').addEventListener('click', (event) => {
      if (event.target === $('modal')) closeModal();
    });
    $('editor').addEventListener('click', (event) => {
      if (event.target === $('editor')) closeEditor();
    });

    document.addEventListener('click', (event) => {
      const like = event.target.closest('[data-like]');
      if (like) {
        event.preventDefault();
        event.stopPropagation();
        toggleLike(like.dataset.like);
        return;
      }
      const share = event.target.closest('[data-share]');
      if (share) {
        event.preventDefault();
        shareBuild(share.dataset.share);
        return;
      }
      const clone = event.target.closest('[data-clone]');
      if (clone) {
        event.preventDefault();
        const build = getBuild(clone.dataset.clone);
        if (build) {
          closeModal();
          openEditor(build);
        }
        return;
      }
      const edit = event.target.closest('[data-edit]');
      if (edit) {
        event.preventDefault();
        const build = getBuild(edit.dataset.edit);
        if (build && build.isCustom) {
          closeModal();
          openEditor(build, build.id);
        }
        return;
      }
      const remove = event.target.closest('[data-delete]');
      if (remove) {
        event.preventDefault();
        deleteBuild(remove.dataset.delete);
        return;
      }
      const detail = event.target.closest('[data-detail]');
      if (detail) {
        event.preventDefault();
        openDetail(detail.dataset.detail);
        return;
      }
      const createShiki = event.target.closest('[data-create-shiki]');
      if (createShiki) {
        event.preventDefault();
        const shiki = shikiById.get(createShiki.dataset.createShiki);
        if (!shiki) return;
        closeModal();
        openEditor({ shikigamiId: shiki.id, items: [], onmyoji: null, spells: [], name: '', notes: '' });
        return;
      }
      const viewShiki = event.target.closest('[data-view-shiki]');
      if (viewShiki) {
        event.preventDefault();
        const shiki = shikiById.get(viewShiki.dataset.viewShiki);
        if (!shiki) return;
        state.query = shiki.name;
        state.role = 'all';
        state.scope = 'all';
        state.sort = 'popular';
        closeModal();
        switchView('explore');
        renderBuilds();
        setTimeout(() => $('builds').scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
        return;
      }
      const card = event.target.closest('.build-card');
      if (card) {
        openDetail(card.dataset.build);
        return;
      }
      const shikiCard = event.target.closest('[data-shiki]');
      if (shikiCard) {
        openShikiDetail(shikiCard.dataset.shiki);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (!$('editor').hidden) closeEditor();
        else if (!$('modal').hidden) closeModal();
      }
      if (event.key === '/' && document.activeElement === document.body && state.view === 'explore') {
        event.preventDefault();
        $('buildSearch').focus();
      }
    });
  }

  function init() {
    if (location.host === 'appassets.androidplatform.net') {
      document.documentElement.classList.add('is-android-app');
    }
    renderHeroFeature();
    renderBuilds();
    updateCounts();
    bindEvents();
  }

  init();
})();
