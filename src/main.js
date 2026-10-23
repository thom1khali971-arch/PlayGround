import './style.css'
import { TYPE_LIST, TYPES, MATERIALS, FINISHES, METALS, buildModel, computeEstimate } from './furniture.js'
import { createViewport } from './scene.js'
import { registerPwa, setupInstallPrompt } from './pwa.js'

const STORAGE_KEY = 'marcenaria-studio.v1'
const MAX_PROJECTS = 12

const typeIcons = {
  estante: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M4 9h16M4 15h16"/></svg>',
  mesa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18M6 8v13M18 8v13M6 14h12"/></svg>',
  armario: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M12 3v18M9 10v3M15 10v3"/></svg>',
  criado: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="13" rx="1.5"/><path d="M4 11h16M10 8.5h4M15 13.5h3"/></svg>',
  banco: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5h18M5 8.5V20M19 8.5V20M8 14h8"/></svg>',
}

const fmtInt = new Intl.NumberFormat('pt-BR')
const fmtMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtMoneyCents = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtKg = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

const GROUP_COLORS = {
  Estrutura: 'rgba(230, 168, 92, 0.22)',
  Prateleiras: 'rgba(230, 168, 92, 0.36)',
  Portas: 'rgba(139, 172, 184, 0.24)',
  Gavetas: 'rgba(178, 148, 196, 0.22)',
  Fundo: 'rgba(138, 126, 112, 0.2)',
  Ferragens: 'rgba(200, 200, 200, 0.18)',
}

const el = (id) => document.getElementById(id)
const stage = document.querySelector('.stage')
const tooltip = el('tooltip')

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function defaultConfigs() {
  return Object.fromEntries(TYPE_LIST.map((type) => [type.key, { ...type.defaults }]))
}

function normalizeConfig(typeKey, input) {
  const type = TYPES[typeKey]
  const config = { ...type.defaults, ...(input || {}) }
  for (const control of type.controls) {
    if (control.kind === 'range') {
      const num = Number(config[control.id])
      config[control.id] = Number.isFinite(num) ? Math.min(control.max, Math.max(control.min, num)) : type.defaults[control.id]
    } else if (control.kind === 'choice') {
      if (!control.options.some((option) => String(option.value) === String(config[control.id]))) {
        config[control.id] = type.defaults[control.id]
      } else {
        config[control.id] = control.options.find((option) => String(option.value) === String(config[control.id])).value
      }
    } else if (control.kind === 'toggle') {
      config[control.id] = Boolean(config[control.id])
    }
  }
  return config
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

const stored = loadStore()
const configs = defaultConfigs()
if (stored?.state?.configs) {
  for (const type of TYPE_LIST) {
    if (stored.state.configs[type.key]) configs[type.key] = normalizeConfig(type.key, stored.state.configs[type.key])
  }
}
const validType = TYPE_LIST.some((type) => type.key === stored?.state?.type) ? stored.state.type : 'estante'

const state = {
  type: validType,
  configs,
  material: MATERIALS[stored?.state?.material] ? stored.state.material : 'carvalho',
  finish: FINISHES[stored?.state?.finish] ? stored.state.finish : 'natural',
  metal: METALS[stored?.state?.metal] ? stored.state.metal : 'latao',
  name: typeof stored?.state?.name === 'string' ? stored.state.name : '',
}

let projects = Array.isArray(stored?.projects)
  ? stored.projects.filter((project) => project && project.snapshot && TYPE_LIST.some((type) => type.key === project.snapshot.type))
  : []

let lastModel = null
let lastEstimate = null
let pendingFrame = 0
let persistTimer = 0
let toastTimer = 0
let fitOnNext = false
let modalReturnFocus = null

const viewport = createViewport(el('viewport'), { onHover: handleHover })

function currentType() {
  return TYPES[state.type]
}

function currentConfig() {
  return state.configs[state.type]
}

function scheduleUpdate({ resetView = false } = {}) {
  if (resetView) fitOnNext = true
  if (pendingFrame) return
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = 0
    updateProject(fitOnNext)
    fitOnNext = false
  })
}

function persistSoon() {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(persistNow, 220)
}

function persistNow() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          type: state.type,
          configs: state.configs,
          material: state.material,
          finish: state.finish,
          metal: state.metal,
          name: state.name,
        },
        projects,
      }),
    )
  } catch {
    /* storage can be unavailable */
  }
}

function updateProject(resetView = false) {
  const type = currentType()
  const config = currentConfig()
  const model = buildModel(state.type, config)
  const estimate = computeEstimate(model, state.material, state.finish)
  lastModel = model
  lastEstimate = estimate

  viewport.setModel(model, {
    materialKey: state.material,
    finishKey: state.finish,
    metalKey: state.metal,
    resetView,
  })

  updateHeader(model, config, estimate)
  renderSummary(model, estimate)
  persistSoon()
}

function updateHeader(model, config, estimate) {
  const type = currentType()
  const [W, H, D] = model.footprint
  el('objectTag').textContent = type.label
  el('objectTitle').textContent = `${type.label} ${fmtInt.format(Math.round(W))} × ${fmtInt.format(Math.round(H))} × ${fmtInt.format(Math.round(D))} mm`
  const thickness = config.espessura || config.tampo
  el('objectSub').textContent = `${estimate.material.label} · ${estimate.finish.label}${thickness ? ` · ${thickness} mm` : ''}`
  el('badgeSwatch').style.background = materialGradient(state.material)
  el('badgeText').textContent = `${estimate.material.label} · ${estimate.finish.label}`
  el('materialNote').textContent = `${estimate.material.label} · ${fmtMoney.format(estimate.material.price)}/m² · ${pluralBoard(estimate.material)} de ${fmtInt.format(estimate.material.board[0])} × ${fmtInt.format(estimate.material.board[1])} mm`
}

function pluralBoard(material) {
  return material.boardLabel === 'chapa' ? 'chapas' : 'pranchas'
}

function materialGradient(key) {
  const material = MATERIALS[key]
  return `radial-gradient(circle at 30% 26%, ${material.grainLight} 0%, ${material.base} 45%, ${material.grainDark} 100%)`
}

function renderSummary(model, estimate) {
  const total = Math.max(estimate.total, 1)
  el('costValue').textContent = fmtMoney.format(Math.round(estimate.total / 10) * 10)
  el('costNote').textContent = `${pluralBoard(estimate.material)} + ferragens + acabamento + mão de obra`
  el('pieceValue').textContent = fmtInt.format(estimate.pieces)
  el('boardValue').textContent = fmtInt.format(estimate.pack.count)
  el('boardLabel').textContent = estimate.material.boardLabel === 'chapa' ? 'Chapas' : 'Pranchas'
  el('boardNote').textContent = `${fmtInt.format(estimate.material.board[0])} × ${fmtInt.format(estimate.material.board[1])} mm${estimate.pack.oversized.length ? ' · peça excede' : ''}`
  el('weightValue').textContent = `${fmtKg.format(estimate.weight)} kg`

  const woodPct = (estimate.wood / total) * 100
  const hwPct = (estimate.hardwareCost / total) * 100
  const finishPct = (estimate.finishCost / total) * 100
  const p1 = woodPct
  const p2 = p1 + hwPct
  const p3 = p2 + finishPct
  el('costBarFill').style.background = `linear-gradient(90deg, #e6a85c 0 ${p1}%, #c47c3f ${p1}% ${p2}%, #8b6a4f ${p2}% ${p3}%, #574338 ${p3}% 100%)`

  const breakdown = [
    { label: 'Madeira', note: `${estimate.area.toFixed(2)} m² com 16% de perda`, value: estimate.wood, color: '#e6a85c' },
    { label: 'Ferragens', note: `${model.hardware.reduce((sum, item) => sum + item.qty, 0)} itens`, value: estimate.hardwareCost, color: '#c47c3f' },
    { label: 'Acabamento', note: estimate.finish.label, value: estimate.finishCost, color: '#8b6a4f' },
    { label: 'Mão de obra', note: 'montagem e ajustes', value: estimate.labor, color: '#574338' },
  ]
  el('breakdown').innerHTML = breakdown
    .map(
      (row) => `<div class="break-row">
        <div class="break-top"><span>${row.label}<small>${row.note}</small></span><strong>${fmtMoney.format(row.value)}</strong></div>
        <div class="break-track"><i style="width:${Math.max(3, (row.value / total) * 100)}%;background:${row.color}"></i></div>
      </div>`,
    )
    .join('')

  const totalPieces = estimate.rows.reduce((sum, group) => sum + group.rows.reduce((acc, row) => acc + row.qty, 0), 0)
  el('cutlist').innerHTML = `
    <div class="cut-table-head"><span>Peça</span><span>Comp × Larg × Esp</span><span>Qtd</span></div>
    ${estimate.rows
      .map(
        (group) => `<div class="cut-group">
          <div class="cut-group-label">${group.group}<span>${group.rows.reduce((sum, row) => sum + row.qty, 0)} peças</span></div>
          ${group.rows
            .map(
              (row) => `<div class="cut-row">
                <span class="cut-name">${row.name}</span>
                <span class="cut-dims">${row.dims.map((n) => fmtInt.format(n)).join(' × ')}</span>
                <span class="cut-qty">${row.qty}×</span>
              </div>`,
            )
            .join('')}
        </div>`,
      )
      .join('')}
    <div class="cut-total"><span>Total</span><strong>${fmtInt.format(totalPieces)} peças</strong></div>
  `

  if (!el('planModal').hidden) renderPlan(estimate)
}

function updateHeaderNote(text) {
  el('objectSub').textContent = text
}

function handleHover(part, event) {
  if (!part) {
    tooltip.classList.remove('show')
    return
  }
  const dims = [...part.size].sort((a, b) => b - a).map((n) => Math.round(n))
  tooltip.innerHTML = `<strong>${escapeHtml(part.name)}</strong><span>${dims.map((n) => fmtInt.format(n)).join(' × ')} mm</span>`
  if (event && stage) {
    const rect = stage.getBoundingClientRect()
    const x = Math.min(Math.max(event.clientX - rect.left + 16, 12), rect.width - 190)
    const y = Math.min(Math.max(event.clientY - rect.top + 18, 12), rect.height - 74)
    tooltip.style.transform = `translate(${x}px, ${y}px)`
  }
  tooltip.classList.add('show')
}

function updatePresetActive() {
  const presetButtons = el('presetRow').querySelectorAll('[data-preset]')
  const config = currentConfig()
  const type = currentType()
  presetButtons.forEach((button) => {
    const preset = type.presets[Number(button.dataset.preset)]
    const active = preset && Object.entries(preset.values).every(([key, value]) => String(config[key]) === String(value))
    button.classList.toggle('active', Boolean(active))
  })
}

function renderTypeGrid() {
  el('typeGrid').innerHTML = TYPE_LIST.map(
    (type) => `<button type="button" class="type-card${type.key === state.type ? ' active' : ''}" data-type="${type.key}" aria-pressed="${type.key === state.type}">
      <span class="type-icon">${typeIcons[type.key]}</span>
      <span>${type.label}</span>
    </button>`,
  ).join('')
}

function renderPresets() {
  const type = currentType()
  el('presetRow').innerHTML = `<span class="preset-label">Receitas</span>${type.presets
    .map(
      (preset, index) => `<button type="button" class="preset-chip" data-preset="${index}">${preset.name}</button>`,
    )
    .join('')}`
  updatePresetActive()
}

function controlMarkup(control) {
  const config = currentConfig()
  const value = config[control.id]
  if (control.kind === 'range') {
    const pct = ((value - control.min) / (control.max - control.min)) * 100
    return `<div class="field range-field">
      <div class="field-head">
        <label for="range-${control.id}">${control.label}</label>
        <div class="num-wrap">
          <input type="number" inputmode="numeric" id="num-${control.id}" data-number="${control.id}" min="${control.min}" max="${control.max}" step="${control.step}" value="${value}" aria-label="${control.label} em ${control.unit}" />
          <span>${control.unit}</span>
        </div>
      </div>
      <input type="range" class="range" id="range-${control.id}" data-slider="${control.id}" data-id="${control.id}" min="${control.min}" max="${control.max}" step="${control.step}" value="${value}" style="--fill:${pct}%" aria-label="${control.label}" />
      <div class="range-scale"><span>${fmtInt.format(control.min)}</span><span>${fmtInt.format(control.max)} ${control.unit}</span></div>
    </div>`
  }
  if (control.kind === 'choice') {
    return `<div class="field">
      <span class="field-label">${control.label}</span>
      <div class="segmented" role="group" aria-label="${control.label}">
        ${control.options
          .map(
            (option) => `<button type="button" class="${String(option.value) === String(value) ? 'active' : ''}" data-choice="${control.id}" data-value="${option.value}" aria-pressed="${String(option.value) === String(value)}">${option.label}</button>`,
          )
          .join('')}
      </div>
    </div>`
  }
  return `<div class="field toggle-field">
    <div class="toggle-copy">
      <span class="field-label">${control.label}</span>
      ${control.hint ? `<small>${control.hint}</small>` : ''}
    </div>
    <label class="switch">
      <input type="checkbox" data-toggle="${control.id}" ${value ? 'checked' : ''} aria-label="${control.label}" />
      <span aria-hidden="true"></span>
    </label>
  </div>`
}

function renderFields() {
  const type = currentType()
  el('measureFields').innerHTML = type.controls.filter((control) => control.kind !== 'toggle').map(controlMarkup).join('')
  el('detailFields').innerHTML = type.controls.filter((control) => control.kind === 'toggle').map(controlMarkup).join('')
}

function renderMaterials() {
  el('materialGrid').innerHTML = Object.entries(MATERIALS)
    .map(
      ([key, material]) => `<button type="button" class="material${key === state.material ? ' active' : ''}" data-material="${key}" aria-pressed="${key === state.material}" title="${material.label} · ${fmtMoney.format(material.price)}/m²">
        <span class="material-swatch" style="background:${materialGradient(key)}"></span>
        <span class="material-name">${material.label}</span>
      </button>`,
    )
    .join('')
}

function renderFinishes() {
  el('finishRow').innerHTML = Object.entries(FINISHES)
    .map(
      ([key, finish]) => `<button type="button" class="finish${key === state.finish ? ' active' : ''}" data-finish="${key}" aria-pressed="${key === state.finish}">
        <span class="finish-dot" style="background:${finish.paint || (finish.sheen ? 'linear-gradient(135deg,#f6e6ca,#b8895c)' : finish.label === 'Óleo' ? 'linear-gradient(135deg,#d7a96e,#8a5a2d)' : 'linear-gradient(135deg,#c79a6b,#7d5636)')}"></span>
        ${finish.label}
      </button>`,
    )
    .join('')
}

function renderMetals() {
  el('metalRow').innerHTML = Object.entries(METALS)
    .map(
      ([key, metal]) => `<button type="button" class="metal${key === state.metal ? ' active' : ''}" data-metal="${key}" aria-pressed="${key === state.metal}" title="${metal.label}">
        <span style="background:${metal.color}"></span>${metal.label}
      </button>`,
    )
    .join('')
}

function renderAllFields() {
  renderTypeGrid()
  renderPresets()
  renderFields()
  renderMaterials()
  renderFinishes()
  renderMetals()
  updatePresetActive()
}

function parseChoiceValue(control, raw) {
  const option = control.options.find((candidate) => String(candidate.value) === String(raw))
  return option ? option.value : control.options[0].value
}

function applyControl(id, value) {
  const type = currentType()
  const config = currentConfig()
  const control = type.controls.find((candidate) => candidate.id === id)
  if (!control) return

  if (control.kind === 'range') {
    const num = Number(value)
    if (!Number.isFinite(num)) return
    const clamped = Math.min(control.max, Math.max(control.min, num))
    config[id] = clamped
    const slider = el('measureFields').querySelector(`[data-slider="${id}"]`)
    const number = el('measureFields').querySelector(`[data-number="${id}"]`)
    if (slider) {
      slider.value = clamped
      slider.style.setProperty('--fill', `${((clamped - control.min) / (control.max - control.min)) * 100}%`)
    }
    if (number) number.value = clamped
  } else if (control.kind === 'choice') {
    config[id] = parseChoiceValue(control, value)
    el('measureFields')
      .querySelectorAll(`[data-choice="${id}"]`)
      .forEach((button) => {
        const active = String(button.dataset.value) === String(config[id])
        button.classList.toggle('active', active)
        button.setAttribute('aria-pressed', String(active))
      })
  } else if (control.kind === 'toggle') {
    config[id] = Boolean(value)
  }

  updatePresetActive()
  scheduleUpdate()
  persistSoon()
}

el('measureFields').addEventListener('input', (event) => {
  const target = event.target
  if (target.matches('[data-slider]')) applyControl(target.dataset.slider, target.value)
})

el('measureFields').addEventListener('change', (event) => {
  const target = event.target
  if (target.matches('[data-number]')) applyControl(target.dataset.number, target.value)
})

el('measureFields').addEventListener('click', (event) => {
  const button = event.target.closest('[data-choice]')
  if (button) applyControl(button.dataset.choice, button.dataset.value)
})

el('detailFields').addEventListener('change', (event) => {
  const target = event.target
  if (target.matches('[data-toggle]')) applyControl(target.dataset.toggle, target.checked)
})

el('typeGrid').addEventListener('click', (event) => {
  const button = event.target.closest('[data-type]')
  if (!button) return
  const nextType = button.dataset.type
  if (nextType === state.type) return
  state.type = nextType
  state.configs[nextType] = normalizeConfig(nextType, state.configs[nextType])
  renderTypeGrid()
  renderPresets()
  renderFields()
  updatePresetActive()
  scheduleUpdate({ resetView: true })
  persistSoon()
})

el('presetRow').addEventListener('click', (event) => {
  const button = event.target.closest('[data-preset]')
  if (!button) return
  const preset = currentType().presets[Number(button.dataset.preset)]
  if (!preset) return
  state.configs[state.type] = normalizeConfig(state.type, { ...currentConfig(), ...preset.values })
  renderFields()
  updatePresetActive()
  scheduleUpdate({ resetView: true })
  persistSoon()
  toast(`Receita “${preset.name}” aplicada`)
})

el('materialGrid').addEventListener('click', (event) => {
  const button = event.target.closest('[data-material]')
  if (!button) return
  state.material = button.dataset.material
  renderMaterials()
  updateProject()
})

el('finishRow').addEventListener('click', (event) => {
  const button = event.target.closest('[data-finish]')
  if (!button) return
  state.finish = button.dataset.finish
  renderFinishes()
  updateProject()
})

el('metalRow').addEventListener('click', (event) => {
  const button = event.target.closest('[data-metal]')
  if (!button) return
  state.metal = button.dataset.metal
  renderMetals()
  updateProject()
})

document.querySelector('.stage-tools').addEventListener('click', (event) => {
  const button = event.target.closest('[data-tool]')
  if (!button) return
  const tool = button.dataset.tool
  if (tool === 'reset') {
    viewport.resetView()
  } else if (tool === 'explode') {
    const next = button.getAttribute('aria-pressed') !== 'true'
    button.setAttribute('aria-pressed', String(next))
    button.classList.toggle('active', next)
    viewport.setOptions({ explode: next })
  } else if (tool === 'dims') {
    const next = button.getAttribute('aria-pressed') !== 'true'
    button.setAttribute('aria-pressed', String(next))
    button.classList.toggle('active', next)
    viewport.setOptions({ dims: next })
  } else if (tool === 'image') {
    const name = `${slug(currentType().label)}-${footprintLabel()}.png`
    viewport.downloadImage(name).then((ok) => {
      if (ok) toast('Imagem do projeto baixada')
    })
  }
})

function footprintLabel() {
  if (!lastModel) return ''
  return lastModel.footprint.map((n) => Math.round(n)).join('x')
}

function slug(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function toast(message) {
  const node = el('toast')
  node.textContent = message
  node.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => node.classList.remove('show'), 2600)
}

function openModal(id, focusSelector) {
  modalReturnFocus = document.activeElement
  const modal = el(id)
  modal.hidden = false
  requestAnimationFrame(() => modal.classList.add('open'))
  if (focusSelector) setTimeout(() => el(focusSelector)?.focus(), 120)
}

function closeModal(id) {
  const modal = el(id)
  if (!modal || modal.hidden) return
  modal.classList.remove('open')
  setTimeout(() => {
    modal.hidden = true
  }, 180)
  if (modalReturnFocus && typeof modalReturnFocus.focus === 'function') modalReturnFocus.focus()
}

document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => closeModal(button.dataset.close))
})

document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) closeModal(backdrop.id)
  })
})

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return
  document.querySelectorAll('.modal-backdrop:not([hidden])').forEach((modal) => closeModal(modal.id))
})

function snapshot() {
  return {
    type: state.type,
    configs: JSON.parse(JSON.stringify(state.configs)),
    material: state.material,
    finish: state.finish,
    metal: state.metal,
    name: state.name,
  }
}

function autoProjectName() {
  const type = currentType()
  return `${type.label} ${footprintLabel()}`
}

function openProjects(focusSave = false) {
  renderProjectList()
  openModal('projectsModal', focusSave ? 'projectName' : undefined)
}

el('projectsBtn').addEventListener('click', () => openProjects())
el('saveBtn').addEventListener('click', () => openProjects(true))

el('saveForm').addEventListener('submit', (event) => {
  event.preventDefault()
  const input = el('projectName')
  const name = (input.value || autoProjectName()).trim().slice(0, 60)
  if (!name) return
  state.name = name
  projects.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    date: new Date().toISOString(),
    summary: lastEstimate
      ? {
          type: currentType().label,
          material: lastEstimate.material.label,
          finish: lastEstimate.finish.label,
          total: lastEstimate.total,
          footprint: lastModel.footprint.map((n) => Math.round(n)),
        }
      : null,
    snapshot: snapshot(),
  })
  projects = projects.slice(0, MAX_PROJECTS)
  persistNow()
  input.value = ''
  renderProjectList()
  toast('Projeto salvo na biblioteca')
})

function renderProjectList() {
  const list = el('projectList')
  if (!projects.length) {
    list.innerHTML = `<div class="empty-state"><span>Nenhum projeto salvo ainda.</span><small>Dê um nome acima e salve a configuração atual.</small></div>`
    return
  }
  list.innerHTML = projects
    .map((project) => {
      const meta = project.summary
      const date = new Date(project.date)
      const dateLabel = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR')
      return `<div class="project-item">
        <button type="button" class="project-open" data-open="${project.id}">
          <span class="project-thumb">${typeIcons[project.snapshot.type] || typeIcons.estante}</span>
          <span class="project-copy">
            <strong>${escapeHtml(project.name)}</strong>
            <small>${meta ? `${meta.type} · ${meta.material} · ${meta.footprint.join(' × ')} mm` : 'Configuração salva'}</small>
            <small class="project-date">${dateLabel}${meta ? ` · ${fmtMoney.format(meta.total)}` : ''}</small>
          </span>
          <span class="project-arrow" aria-hidden="true">→</span>
        </button>
        <button type="button" class="project-delete" data-delete="${project.id}" aria-label="Excluir ${escapeHtml(project.name)}">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2M6.5 6l.7 10h5.6l.7-10" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" /></svg>
        </button>
      </div>`
    })
    .join('')
}

el('projectList').addEventListener('click', (event) => {
  const deleteButton = event.target.closest('[data-delete]')
  if (deleteButton) {
    projects = projects.filter((project) => project.id !== deleteButton.dataset.delete)
    persistNow()
    renderProjectList()
    toast('Projeto removido')
    return
  }
  const openButton = event.target.closest('[data-open]')
  if (!openButton) return
  const project = projects.find((candidate) => candidate.id === openButton.dataset.open)
  if (!project) return
  applySnapshot(project.snapshot)
  closeModal('projectsModal')
  toast(`Projeto “${project.name}” aberto`)
})

function applySnapshot(saved) {
  if (!saved || !TYPES[saved.type]) return
  state.type = saved.type
  for (const type of TYPE_LIST) {
    state.configs[type.key] = normalizeConfig(type.key, saved.configs?.[type.key])
  }
  state.material = MATERIALS[saved.material] ? saved.material : 'carvalho'
  state.finish = FINISHES[saved.finish] ? saved.finish : 'natural'
  state.metal = METALS[saved.metal] ? saved.metal : 'latao'
  state.name = typeof saved.name === 'string' ? saved.name : ''
  renderAllFields()
  updateProject(true)
  persistNow()
}

el('planBtn').addEventListener('click', () => {
  if (lastEstimate) renderPlan(lastEstimate)
  openModal('planModal')
})

function renderPlan(estimate) {
  const pack = estimate.pack
  const material = estimate.material
  el('planMeta').innerHTML = `
    <span class="plan-pill">${fmtInt.format(pack.count)} ${material.boardLabel === 'chapa' ? 'chapas' : 'pranchas'}</span>
    <span class="plan-pill">${Math.round(pack.utilization * 100)}% de aproveitamento</span>
    <span class="plan-pill">${material.label} · ${fmtInt.format(pack.boardW)} × ${fmtInt.format(pack.boardH)} mm</span>
    ${pack.oversized.length ? `<span class="plan-pill warn">${pack.oversized.length} peça(s) maior(es) que o padrão</span>` : ''}
  `
  if (!pack.count) {
    el('planBoards').innerHTML = `<div class="empty-state"><span>Sem peças para cortar.</span></div>`
    return
  }
  el('planBoards').innerHTML = pack.boards
    .map((board, index) => {
      const pct = Math.round((board.placedArea / (pack.boardW * pack.boardH)) * 100)
      return `<figure class="plan-board">
        <figcaption><span>${material.boardLabel === 'chapa' ? 'Chapa' : 'Prancha'} ${index + 1}</span><span>${pct}%</span></figcaption>
        ${boardSvg(board, pack, material)}
      </figure>`
    })
    .join('')
}

function boardSvg(board, pack, material) {
  const { boardW, boardH } = pack
  const grid = []
  for (let x = 500; x < boardW; x += 500) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${boardH}" />`)
  for (let y = 500; y < boardH; y += 500) grid.push(`<line x1="0" y1="${y}" x2="${boardW}" y2="${y}" />`)
  const pieces = board.shelves.flatMap((shelf) => shelf.items)
  return `<svg viewBox="0 0 ${boardW} ${boardH}" class="board-svg" role="img" aria-label="Plano de corte de ${material.label}">
    <rect x="0" y="0" width="${boardW}" height="${boardH}" fill="#1d1713" />
    <g stroke="rgba(230,168,92,0.08)" stroke-width="2" stroke-dasharray="12 16">${grid.join('')}</g>
    ${pieces
      .map((piece) => {
        const color = GROUP_COLORS[piece.group] || 'rgba(230,168,92,0.2)'
        const label = piece.w > 520 && piece.h > 150
        return `<g>
          <rect x="${piece.x}" y="${piece.y}" width="${piece.w - 2}" height="${piece.h - 2}" rx="8" fill="${color}" stroke="rgba(230,168,92,0.65)" stroke-width="3">
            <title>${escapeHtml(piece.name)} · ${piece.w} × ${piece.h} mm</title>
          </rect>
          ${label ? `<text x="${piece.x + 24}" y="${piece.y + 62}" fill="rgba(246,231,209,0.82)" font-size="58" font-family="ui-monospace, monospace">${escapeHtml(piece.name)}</text>` : ''}
          ${label ? `<text x="${piece.x + 24}" y="${piece.y + 122}" fill="rgba(246,231,209,0.5)" font-size="48" font-family="ui-monospace, monospace">${piece.w} × ${piece.h}</text>` : ''}
        </g>`
      })
      .join('')}
    <rect x="1" y="1" width="${boardW - 2}" height="${boardH - 2}" fill="none" stroke="rgba(230,168,92,0.4)" stroke-width="4" />
  </svg>`
}

el('csvBtn').addEventListener('click', () => {
  if (!lastEstimate || !lastModel) return
  const estimate = lastEstimate
  const rows = [
    ['Projeto', state.name || autoProjectName()],
    ['Tipo', currentType().label],
    ['Medidas (mm)', lastModel.footprint.map((n) => Math.round(n)).join(' x ')],
    ['Material', estimate.material.label],
    ['Acabamento', estimate.finish.label],
    ['Ferragens', METALS[state.metal].label],
    [],
    ['Grupo', 'Peça', 'Comprimento (mm)', 'Largura (mm)', 'Espessura (mm)', 'Qtd'],
  ]
  for (const group of estimate.rows) {
    for (const row of group.rows) {
      rows.push([group.group, row.name, row.dims[0], row.dims[1], row.dims[2], row.qty])
    }
  }
  rows.push([], ['Ferragem', 'Qtd', 'Unitário (R$)', 'Total (R$)'])
  for (const item of estimate.hardwareRows) {
    rows.push([item.name, item.qty, numberCsv(item.unit), numberCsv(item.total)])
  }
  rows.push(
    [],
    ['Resumo', 'Valor (R$)'],
    ['Madeira', numberCsv(estimate.wood)],
    ['Ferragens', numberCsv(estimate.hardwareCost)],
    ['Acabamento', numberCsv(estimate.finishCost)],
    ['Mão de obra', numberCsv(estimate.labor)],
    ['Total', numberCsv(estimate.total)],
    ['Peso (kg)', numberCsv(estimate.weight)],
  )
  const csv = '\ufeff' + rows.map((row) => row.map((cell) => `${cell ?? ''}`).join(';')).join('\r\n')
  downloadFile(`lista-de-corte-${slug(currentType().label)}-${footprintLabel()}.csv`, csv, 'text/csv;charset=utf-8')
  toast('Lista de corte exportada em CSV')
})

function numberCsv(value) {
  return Number(value).toFixed(2).replace('.', ',')
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

el('printBtn').addEventListener('click', () => {
  if (!lastEstimate || !lastModel) return
  updateProject()
  preparePrintSheet(lastEstimate)
  setTimeout(() => window.print(), 120)
})

function preparePrintSheet(estimate) {
  const image = viewport.snapshotDataUrl('#ece4d8')
  const type = currentType()
  const config = currentConfig()
  const thickness = config.espessura || config.tampo
  const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const totalPieces = estimate.rows.reduce((sum, group) => sum + group.rows.reduce((acc, row) => acc + row.qty, 0), 0)
  el('printSheet').innerHTML = `<article class="print-page">
    <header class="print-head">
      <div><span class="print-brand">Marcenaria Studio</span><h1>Ficha do projeto</h1></div>
      <div class="print-date">${date}</div>
    </header>
    <div class="print-hero">
      <figure><img src="${image}" alt="Vista do projeto" /></figure>
      <div class="print-specs">
        <p class="print-eyebrow">${type.label}</p>
        <h2>${escapeHtml(state.name || autoProjectName())}</h2>
        <dl>
          <div><dt>Medidas</dt><dd>${lastModel.footprint.map((n) => fmtInt.format(Math.round(n))).join(' × ')} mm</dd></div>
          <div><dt>Material</dt><dd>${estimate.material.label} · ${thickness} mm</dd></div>
          <div><dt>Acabamento</dt><dd>${estimate.finish.label}</dd></div>
          <div><dt>Ferragens</dt><dd>${METALS[state.metal].label}</dd></div>
          <div><dt>Peças</dt><dd>${fmtInt.format(totalPieces)}</dd></div>
          <div><dt>Peso</dt><dd>${fmtKg.format(estimate.weight)} kg</dd></div>
        </dl>
        <div class="print-cost">
          <span>Custo estimado</span>
          <strong>${fmtMoneyCents.format(estimate.total)}</strong>
        </div>
      </div>
    </div>
    <section class="print-section">
      <h3>Lista de corte</h3>
      <table>
        <thead><tr><th>Grupo</th><th>Peça</th><th>Compr. (mm)</th><th>Larg. (mm)</th><th>Esp. (mm)</th><th>Qtd</th></tr></thead>
        <tbody>
          ${estimate.rows
            .flatMap((group) => group.rows.map((row) => `<tr><td>${group.group}</td><td>${row.name}</td><td>${fmtInt.format(row.dims[0])}</td><td>${fmtInt.format(row.dims[1])}</td><td>${fmtInt.format(row.dims[2])}</td><td>${row.qty}</td></tr>`))
            .join('')}
        </tbody>
      </table>
    </section>
    <section class="print-section print-columns">
      <div>
        <h3>Ferragens</h3>
        <table><thead><tr><th>Item</th><th>Qtd</th><th>Total</th></tr></thead><tbody>
          ${estimate.hardwareRows.map((item) => `<tr><td>${item.name}</td><td>${item.qty}</td><td>${fmtMoneyCents.format(item.total)}</td></tr>`).join('')}
        </tbody></table>
      </div>
      <div>
        <h3>Orçamento</h3>
        <table><tbody>
          <tr><td>Madeira</td><td class="num">${fmtMoneyCents.format(estimate.wood)}</td></tr>
          <tr><td>Ferragens</td><td class="num">${fmtMoneyCents.format(estimate.hardwareCost)}</td></tr>
          <tr><td>Acabamento</td><td class="num">${fmtMoneyCents.format(estimate.finishCost)}</td></tr>
          <tr><td>Mão de obra</td><td class="num">${fmtMoneyCents.format(estimate.labor)}</td></tr>
          <tr class="total"><td>Total estimado</td><td class="num">${fmtMoneyCents.format(estimate.total)}</td></tr>
        </tbody></table>
      </div>
    </section>
    <footer class="print-foot">
      <span>${estimate.pack.count} ${estimate.material.boardLabel === 'chapa' ? 'chapas' : 'pranchas'} de ${estimate.material.board[0]} × ${estimate.material.board[1]} mm · ${Math.round(estimate.pack.utilization * 100)}% de aproveitamento</span>
      <span>Orçamento estimativo. Confirme medidas e materiais antes do corte.</span>
    </footer>
  </article>`
}

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    openProjects(true)
  }
})

renderAllFields()
updateProject(true)
setupInstallPrompt()
registerPwa()
window.addEventListener('marcenaria:installed', () => {
  toast('Aplicativo instalado. Abra pelo ícone na tela inicial.')
})
requestAnimationFrame(() => {
  setTimeout(() => el('loader').classList.add('hidden'), 320)
})

window.addEventListener('beforeunload', persistNow)
