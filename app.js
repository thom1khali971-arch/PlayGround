import {
  ROLES,
  PHASES,
  OBJECTIVES,
  THREATS,
  ROSTER,
  KEYBOARD_HINTS,
  FACT_STRIP
} from './data.js'
import {
  formatClock,
  getPhase,
  getNextWave,
  getObjectiveState,
  getNextObjective,
  getEffectiveThreats,
  getLiveAdvice,
  getVisibleTips,
  getThreatBreakdown,
  getObjectiveWindows,
  getRole,
  threatName,
  rosterEntry
} from './engine.js'

const STORAGE_KEY = 'onmyoji-live-coach/v1'
const TRACK_NODES = [
  { time: 0, label: 'Saída' },
  { time: 240, label: 'Rio' },
  { time: 480, label: 'Orochi' },
  { time: 720, label: 'Torres' },
  { time: 1080, label: 'Nen' }
]
const MAX_ENEMIES = 5
const bridge = typeof window !== 'undefined' && window.AndroidCoach ? window.AndroidCoach : null
const MAX_SHARED_AGE = 2 * 60 * 60 * 1000

const $ = (selector) => document.querySelector(selector)

const state = {
  role: 'mid',
  level: 2,
  seconds: 0,
  running: false,
  speed: 1,
  sound: false,
  voice: false,
  team: 'even',
  situation: {
    noVision: false,
    enemyMissing: false,
    ultReady: false,
    allyDead: false
  },
  manualThreats: new Set(),
  enemies: [],
  objectives: makeObjectives(),
  alerted: new Set(),
  phaseId: null,
  feed: [],
  checklist: {},
  filters: { phase: 'all', kind: 'all', search: '' },
  rosterSearch: '',
  rosterOpen: false,
  adviceKey: '',
  advice: [],
  lastFrame: 0,
  lastUi: 0,
  lastSecond: -1
}

let audioContext = null
let lastSharedAt = 0
let lastSharedPublish = 0
let lastRemoteControl = ''

function makeObjectives() {
  return Object.fromEntries(
    OBJECTIVES.map((objective) => [
      objective.id,
      { nextSpawn: objective.time }
    ])
  )
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return map[char]
  })
}

function icon(name) {
  return `<svg aria-hidden="true"><use href="#i-${name}" /></svg>`
}

function roleLabel(roleId) {
  return ROLES.find((role) => role.id === roleId)?.name || roleId
}

function phaseLabel(tip) {
  const phases = Array.isArray(tip.phases) ? tip.phases : []
  if (!phases.length) return 'Toda a partida'
  const names = PHASES.filter((phase) => phases.includes(phase.id)).map((phase) => phase.name)
  return names.length > 2 ? `${names.slice(0, 2).join(' · ')} +` : names.join(' · ')
}

function threatTags(tip) {
  return (tip.threats || []).slice(0, 2).map((id) => `vs ${threatName(id)}`)
}

function teamSituation() {
  return {
    ...state.situation,
    behind: state.team === 'behind',
    ahead: state.team === 'ahead'
  }
}

function effectiveThreats() {
  return [...getEffectiveThreats(state.manualThreats, state.enemies)]
}

/* ---------- Persistence ---------- */

function saveSettings() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        role: state.role,
        level: state.level,
        sound: state.sound,
        voice: state.voice,
        checklist: state.checklist
      })
    )
  } catch {
    /* storage may be unavailable */
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const saved = JSON.parse(raw)
    if (ROLES.some((role) => role.id === saved.role)) state.role = saved.role
    if ([1, 2, 3].includes(saved.level)) state.level = saved.level
    state.sound = Boolean(saved.sound)
    state.voice = Boolean(saved.voice)
    if (saved.checklist && typeof saved.checklist === 'object') state.checklist = saved.checklist
  } catch {
    /* ignore corrupted storage */
  }
}

/* ---------- Android bridge and shared match state ---------- */

function buildSharedSnapshot() {
  return {
    v: 1,
    source: 'main',
    updatedAt: Date.now(),
    role: state.role,
    level: state.level,
    seconds: state.seconds,
    running: state.running,
    speed: state.speed,
    sound: state.sound,
    voice: state.voice,
    team: state.team,
    situation: { ...state.situation },
    manualThreats: [...state.manualThreats],
    enemies: [...state.enemies],
    objectives: Object.fromEntries(
      Object.entries(state.objectives).map(([id, objective]) => [id, objective.nextSpawn])
    ),
    alerted: [...state.alerted]
  }
}

function publishSharedState(force = false) {
  if (!bridge) return
  const now = performance.now()
  if (!force && now - lastSharedPublish < 900) return
  lastSharedPublish = now
  const snapshot = buildSharedSnapshot()
  try {
    bridge.publishMainState(JSON.stringify(snapshot))
    lastRemoteControl = sharedControlSignature(snapshot)
  } catch {
    /* bridge can disappear while the app closes */
  }
}

function sharedControlSignature(payload) {
  return JSON.stringify({
    role: payload.role,
    level: payload.level,
    running: payload.running,
    speed: payload.speed,
    sound: payload.sound,
    voice: payload.voice,
    team: payload.team,
    situation: payload.situation || {},
    manualThreats: Array.isArray(payload.manualThreats) ? [...payload.manualThreats].sort() : [],
    enemies: Array.isArray(payload.enemies) ? [...payload.enemies].sort() : [],
    objectives: payload.objectives || {}
  })
}

function applySharedState(raw, boot = false, forceClock = false) {
  if (!bridge || !raw) return false
  let payload
  try {
    payload = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return false
  }
  if (!payload || payload.v !== 1 || payload.source !== 'overlay') return false

  const updatedAt = Number(payload.updatedAt) || 0
  if (!boot && updatedAt <= lastSharedAt) return false
  if (!boot && !forceClock && sharedControlSignature(payload) === lastRemoteControl) {
    lastSharedAt = updatedAt
    return false
  }
  if (boot && updatedAt && Date.now() - updatedAt > MAX_SHARED_AGE) return false

  lastSharedAt = updatedAt || Date.now()
  lastRemoteControl = sharedControlSignature(payload)

  const seconds = Math.min(
    86_400,
    Math.max(0, Number.isFinite(Number(payload.seconds)) ? Number(payload.seconds) : state.seconds)
  )
  const age = boot && payload.running ? Math.max(0, (Date.now() - updatedAt) / 1000) : 0

  state.role = ROLES.some((role) => role.id === payload.role) ? payload.role : state.role
  state.level = [1, 2, 3].includes(Number(payload.level)) ? Number(payload.level) : state.level
  state.running = Boolean(payload.running)
  state.speed = [1, 2, 4].includes(Number(payload.speed)) ? Number(payload.speed) : 1
  state.sound = Boolean(payload.sound)
  state.voice = Boolean(payload.voice)
  state.team = ['behind', 'even', 'ahead'].includes(payload.team) ? payload.team : state.team
  state.seconds = Math.min(86_400, seconds + age)

  for (const key of Object.keys(state.situation)) {
    state.situation[key] = Boolean(payload.situation?.[key])
  }

  const validThreats = new Set(THREATS.map((threat) => threat.id))
  state.manualThreats = new Set(
    Array.isArray(payload.manualThreats)
      ? payload.manualThreats.filter((threat) => validThreats.has(threat))
      : []
  )

  state.enemies = Array.isArray(payload.enemies)
    ? payload.enemies
        .filter((name) => typeof name === 'string' && rosterEntry(name))
        .slice(0, MAX_ENEMIES)
    : []

  for (const objective of OBJECTIVES) {
    const saved = state.objectives[objective.id]
    const rawValue = payload.objectives?.[objective.id]
    const value = rawValue && typeof rawValue === 'object' ? rawValue.nextSpawn : rawValue
    saved.nextSpawn = value == null ? null : Math.min(86_400, Math.max(0, Number(value)))
  }

  if (Array.isArray(payload.alerted)) {
    state.alerted = new Set(
      payload.alerted.filter((key) => typeof key === 'string' && key.length < 100)
    )
  }

  state.phaseId = getPhase(state.seconds).id
  state.lastFrame = performance.now()
  state.lastSecond = Math.floor(state.seconds)
  state.adviceKey = ''
  saveSettings()
  renderAll()
  return true
}

function updateBubbleButton() {
  if (!bridge) return
  const button = $('#bubbleToggle')
  if (!button) return
  let running = false
  try {
    running = Boolean(bridge.isBubbleRunning())
  } catch {
    running = false
  }
  button.hidden = false
  button.setAttribute('aria-pressed', String(running))
  button.querySelector('span').textContent = running ? 'Bolha ativa' : 'Bolha'
  button.title = running ? 'Encerrar bolha flutuante' : 'Ativar bolha flutuante'
}

function setupAndroidBridge() {
  if (!bridge) return
  const button = $('#bubbleToggle')
  if (button) {
    button.hidden = false
    button.addEventListener('click', () => {
      try {
        bridge.toggleBubble()
      } catch {
        /* ignore */
      }
      window.setTimeout(updateBubbleButton, 700)
    })
  }

  updateBubbleButton()
  window.setInterval(updateBubbleButton, 1_500)

  try {
    applySharedState(bridge.readOverlayState(), true)
  } catch {
    /* ignore */
  }

  window.setInterval(() => {
    try {
      const raw = bridge.readOverlayState()
      if (raw) applySharedState(raw)
    } catch {
      /* ignore */
    }
  }, 1_000)

  document.addEventListener('visibilitychange', () => {
    if (!bridge) return
    if (!document.hidden) {
      try {
        applySharedState(bridge.readOverlayState(), false, true)
      } catch {
        /* ignore */
      }
    }
    publishSharedState(true)
  })

  window.addEventListener('pagehide', () => publishSharedState(true))
  publishSharedState(true)
}

/* ---------- Audio and voice ---------- */

function ensureAudio() {
  if (!('AudioContext' in window || 'webkitAudioContext' in window)) return null
  if (!audioContext) {
    const Context = window.AudioContext || window.webkitAudioContext
    audioContext = new Context()
  }
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {})
  return audioContext
}

function beep(kind = 'soon') {
  if (!state.sound) return
  const ctx = ensureAudio()
  if (!ctx) return

  const patterns = {
    soon: [880, 1174],
    live: [660, 880, 1174],
    phase: [523, 659],
    success: [784, 1046]
  }
  const notes = patterns[kind] || patterns.soon
  const start = ctx.currentTime + 0.02

  notes.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = kind === 'live' ? 'triangle' : 'sine'
    oscillator.frequency.value = frequency
    const at = start + index * 0.11
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.055, at + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(at)
    oscillator.stop(at + 0.14)
  })
}

function speak(text) {
  if (!state.voice) return
  if (bridge) {
    try {
      bridge.speak(text)
      return
    } catch {
      /* fall back to the WebView voice below */
    }
  }
  if (!('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'pt-BR'
    utterance.rate = 1.04
    utterance.pitch = 0.95
    utterance.volume = 0.9
    window.speechSynthesis.speak(utterance)
  } catch {
    /* speech is optional */
  }
}

/* ---------- Shell renders ---------- */

function renderTicker() {
  const items = FACT_STRIP.concat(FACT_STRIP)
  $('#tickerTrack').innerHTML = items.map((fact) => `<span>${esc(fact)}</span>`).join('')
}

function renderRoles() {
  $('#roleStrip').innerHTML = ROLES.map(
    (role) => `
      <button class="role-card" type="button" data-role="${role.id}" aria-pressed="${state.role === role.id}">
        <span class="role-kanji">${esc(role.kanji)}</span>
        <strong>${esc(role.name)}</strong>
        <small>${esc(role.className)}</small>
      </button>`
  ).join('')
}

function renderRoleContext() {
  const role = getRole(state.role)
  $('#laneChip').textContent = role.lane
  $('#roleBlurb').textContent = `${role.className} · ${role.short}`
}

function renderLevel() {
  document.querySelectorAll('[data-level]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.level) === state.level))
  })
}

function renderTeam() {
  document.querySelectorAll('[data-team]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.team === state.team))
  })
}

function renderSpeed() {
  document.querySelectorAll('[data-speed]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === state.speed))
  })
}

function renderSituation() {
  document.querySelectorAll('[data-situation]').forEach((button) => {
    const key = button.dataset.situation
    button.setAttribute('aria-pressed', String(Boolean(state.situation[key])))
  })
}

function renderSound() {
  const sound = $('#soundToggle')
  const voice = $('#voiceToggle')
  sound.setAttribute('aria-pressed', String(state.sound))
  sound.querySelector('use').setAttribute('href', state.sound ? '#i-volume' : '#i-volume-off')
  sound.title = state.sound ? 'Desativar alertas sonoros' : 'Ativar alertas sonoros'
  voice.setAttribute('aria-pressed', String(state.voice))
  voice.querySelector('use').setAttribute('href', state.voice ? '#i-mic' : '#i-mic-off')
  voice.title = state.voice ? 'Desativar avisos por voz' : 'Ativar avisos por voz'
}

function renderPhaseTrack() {
  $('#phaseTrack').innerHTML = TRACK_NODES.map(
    (node) => `
      <button class="phase-node" type="button" data-seek="${node.time}" title="Pular para ${formatClock(node.time)}">
        <span class="node-dot"></span>
        <span class="node-name">${esc(node.label)}</span>
        <span class="node-time">${formatClock(node.time)}</span>
      </button>`
  ).join('')
  updatePhaseTrack()
}

function updatePhaseTrack() {
  const currentIndex = TRACK_NODES.reduce((index, node, nodeIndex) => (state.seconds >= node.time ? nodeIndex : index), 0)
  document.querySelectorAll('.phase-node').forEach((node, index) => {
    node.classList.toggle('is-past', index < currentIndex)
    node.classList.toggle('is-current', index === currentIndex)
  })
}

/* ---------- Clock and objectives ---------- */

function renderClock() {
  const phase = getPhase(state.seconds)
  const wave = getNextWave(state.seconds)

  $('#clockTime').textContent = formatClock(state.seconds)
  $('#phaseBadge').textContent = phase.name
  $('#waveInfo').textContent = `Onda em ${formatClock(wave.remaining)}`
  $('#phaseDescription').textContent = phase.description

  const startPause = $('#startPause')
  const label = startPause.querySelector('span')
  const use = startPause.querySelector('use')

  startPause.classList.toggle('is-running', state.running)
  if (state.running) {
    label.textContent = 'Pausar'
    use.setAttribute('href', '#i-pause')
    startPause.setAttribute('aria-label', 'Pausar relógio da partida')
  } else {
    label.textContent = state.seconds > 0 ? 'Continuar' : 'Iniciar partida'
    use.setAttribute('href', '#i-play')
    startPause.setAttribute('aria-label', 'Iniciar ou continuar relógio da partida')
  }

  updatePhaseTrack()
}

function renderNextObjective() {
  const container = $('#nextObjective')
  const next = getNextObjective(state.objectives, state.seconds)

  if (!next) {
    container.dataset.state = 'done'
    container.innerHTML = `
      <div class="next-ring" style="--p:100;--ring:var(--teal)">${icon('check')}</div>
      <div>
        <p class="next-kicker">Mapa livre</p>
        <p class="next-name">Objetivos concluídos</p>
        <p class="next-time">fim de jogo</p>
        <p class="next-sub">Agrupe, pressione a base ou defenda com visão.</p>
      </div>`
    return
  }

  const objective = OBJECTIVES.find((item) => item.id === next.id)
  const isLive = next.state === 'live'
  const isSoon = next.state === 'soon'
  const progress = isLive ? 100 : Math.max(4, Math.min(100, 100 - (next.seconds / 120) * 100))
  const ring = isLive || isSoon ? 'var(--red-bright)' : 'var(--gold)'
  const stateLabel = isLive ? 'No mapa' : isSoon ? 'Prepare-se' : 'Próximo objetivo'

  container.dataset.state = next.state
  container.innerHTML = `
    <div class="next-ring" style="--p:${progress.toFixed(0)};--ring:${ring}">${icon(objective.icon)}</div>
    <div>
      <p class="next-kicker">${stateLabel}</p>
      <p class="next-name">${esc(objective.name)}</p>
      <p class="next-time">${isLive ? `há ${formatClock(next.seconds)}` : `em ${formatClock(next.seconds)}`}</p>
      <p class="next-sub">${isLive ? 'Marque “abatido” quando o time pegar.' : objective.detail}</p>
    </div>`
}

function renderObjectiveCards() {
  $('#objectiveRow').innerHTML = OBJECTIVES.map(
    (objective) => `
      <div class="objective-card" data-objective="${objective.id}">
        <div class="objective-icon">${icon(objective.icon)}</div>
        <div class="objective-copy">
          <p class="objective-name">${esc(objective.name)}</p>
          <p class="objective-status" data-objective-status></p>
        </div>
        <button class="mark-button" type="button" data-mark="${objective.id}"></button>
      </div>`
  ).join('')
  updateObjectiveCards()
}

function updateObjectiveCards() {
  for (const objective of OBJECTIVES) {
    const card = document.querySelector(`[data-objective="${objective.id}"]`)
    if (!card) continue
    const saved = state.objectives[objective.id]
    const status = getObjectiveState(saved.nextSpawn, state.seconds)
    let statusText = ''
    let markDisabled = true

    if (status.state === 'upcoming') statusText = `em ${formatClock(status.seconds)}`
    if (status.state === 'soon') statusText = `prepare · ${formatClock(status.seconds)}`
    if (status.state === 'live') {
      statusText = `no mapa · ${formatClock(status.seconds)}`
      markDisabled = false
    }
    if (status.state === 'done') statusText = 'concluído'

    const markLabel = objective.respawn
      ? `Marcar abatido · respawn ${formatClock(objective.respawn)}`
      : 'Marcar concluído'
    const button = card.querySelector('[data-mark]')

    card.dataset.state = status.state
    card.querySelector('[data-objective-status]').textContent = statusText
    button.disabled = markDisabled
    button.textContent = markDisabled ? 'Aguardando' : 'Abatido'
    button.title = markLabel
  }
}

/* ---------- Live advice ---------- */

function computeAdvice() {
  return getLiveAdvice(
    {
      seconds: state.seconds,
      role: state.role,
      level: state.level,
      threats: effectiveThreats(),
      situation: teamSituation(),
      objectiveWindows: getObjectiveWindows(state.objectives, state.seconds)
    },
    3
  )
}

function adviceKey(advice) {
  const phase = getPhase(state.seconds)
  const objectives = Object.entries(state.objectives)
    .map(([id, objective]) => `${id}:${objective.nextSpawn}:${getObjectiveState(objective.nextSpawn, state.seconds).state}`)
    .join(',')
  const situation = Object.entries(teamSituation())
    .filter(([, value]) => value)
    .map(([key]) => key)
    .sort()
    .join(',')
  const threats = effectiveThreats().sort().join(',')
  return `${phase.id}|${state.role}|${state.level}|${threats}|${situation}|${objectives}|${advice.map((tip) => tip.id).join('>')}`
}

function refreshAdvice(force = false) {
  const advice = computeAdvice()
  const key = adviceKey(advice)
  if (!force && key === state.adviceKey) return
  state.advice = advice
  state.adviceKey = key
  renderAdvice()
  renderContextMeter()
}

function renderAdvice() {
  const stack = $('#adviceStack')
  if (!state.advice.length) {
    stack.innerHTML = `
      <div class="empty-state">
        ${icon('target')}
        <span>Nenhum conselho para este contexto. Marque seu papel e o estado da partida.</span>
      </div>`
    return
  }

  stack.innerHTML = state.advice
    .map(
      (tip, index) => `
        <article class="advice-card ${tip.kind}" data-tip-id="${esc(tip.id)}" style="animation-delay:${index * 45}ms">
          <div class="advice-kind">${tip.kind === 'do' ? 'Faça agora' : 'Não faça'}</div>
          <h3>${esc(tip.title)}</h3>
          <p>${esc(tip.body)}</p>
          ${tip.why ? `<div class="advice-why"><strong>Por quê:</strong> ${esc(tip.why)}</div>` : ''}
          <div class="advice-meta">
            <span class="advice-tag">${esc(tip.phaseName)}</span>
            ${threatTags(tip)
              .map((tag) => `<span class="advice-tag">${esc(tag)}</span>`)
              .join('')}
            ${tip.objective ? `<span class="advice-tag">${esc(OBJECTIVES.find((objective) => objective.id === tip.objective)?.name || 'objetivo')}</span>` : ''}
          </div>
        </article>`
    )
    .join('')
}

function renderContextMeter() {
  const role = getRole(state.role)
  const phase = getPhase(state.seconds)
  const threats = effectiveThreats().length
  const markers = Object.values(state.situation).filter(Boolean).length

  $('#contextMeter').innerHTML = `
    <span class="context-chip">${esc(role.name)} · ${esc(phase.name)}</span>
    <span class="context-chip ${threats ? 'accent' : ''}">${threats} ameaça${threats === 1 ? '' : 's'}</span>
    ${markers ? `<span class="context-chip teal">${markers} contexto${markers === 1 ? '' : 's'}</span>` : ''}`

  const objectiveCount = Object.values(state.objectives).filter(
    (objective) => getObjectiveState(objective.nextSpawn, state.seconds).state !== 'done'
  ).length

  $('#adviceFooterText').textContent = `3 cartas priorizadas para ${role.name} · ${phase.name} · ${objectiveCount} objetivo${objectiveCount === 1 ? '' : 's'} em jogo.`
}

/* ---------- Draft ---------- */

function renderThreats() {
  const breakdown = getThreatBreakdown([...state.manualThreats], state.enemies)
  $('#threatGrid').innerHTML = breakdown
    .map((threat) => {
      const classes = ['threat-button']
      if (threat.manual) classes.push('is-manual')
      if (threat.detected) classes.push('is-detected')
      const note = threat.manual && threat.detected
        ? 'manual + draft'
        : threat.manual
          ? 'marcada'
          : threat.detected
            ? `${threat.count} no draft`
            : 'marcar'
      return `
        <button class="${classes.join(' ')}" type="button" data-threat="${threat.id}" aria-pressed="${threat.manual}" title="${esc(`${threat.description} ${threat.counter}`)}">
          <span class="threat-icon">${icon(threat.icon)}</span>
          <span>
            <span class="threat-name">${esc(threat.name)}</span>
            <span class="threat-note">${esc(note)}</span>
          </span>
          <span class="threat-count">${threat.count || (threat.manual ? '✓' : '—')}</span>
        </button>`
    })
    .join('')
}

function renderDraftSummary() {
  const role = getRole(state.role)
  const active = effectiveThreats().length
  $('#draftSummary').innerHTML = `
    <span class="summary-chip">Papel <strong>${esc(role.name)}</strong></span>
    <span class="summary-chip"><strong>${state.enemies.length}</strong>/${MAX_ENEMIES} picks</span>
    <span class="summary-chip"><strong>${active}</strong> ameaça${active === 1 ? '' : 's'} ativa${active === 1 ? '' : 's'}</span>
    ${state.enemies.length ? '' : '<span class="summary-chip">sem picks · use as ameaças manuais</span>'}`
}

function renderSelectedEnemies() {
  const container = $('#selectedEnemies')
  if (!state.enemies.length) {
    container.innerHTML = '<span class="selected-empty">Nenhum inimigo adicionado. O coach usa as ameaças manuais.</span>'
    return
  }

  container.innerHTML = state.enemies
    .map((name) => {
      const entry = rosterEntry(name)
      const role = entry ? roleLabel(entry.role) : ''
      return `
        <span class="enemy-chip">
          ${esc(name)} <small>${esc(role)}</small>
          <button type="button" data-remove-enemy="${esc(name)}" aria-label="Remover ${esc(name)}">
            ${icon('x')}
          </button>
        </span>`
    })
    .join('')
}

function renderRosterResults() {
  const container = $('#rosterResults')
  const query = state.rosterSearch.trim().toLocaleLowerCase('pt-BR')
  const isOpen = state.rosterOpen || Boolean(query)
  container.classList.toggle('is-open', isOpen)
  if (!isOpen) {
    container.innerHTML = ''
    return
  }

  if (state.enemies.length >= MAX_ENEMIES) {
    container.innerHTML = '<div class="roster-empty">Limite de 5 inimigos atingido. Remova um pick para adicionar outro.</div>'
    return
  }

  const results = ROSTER.filter((entry) => !state.enemies.includes(entry.name))
    .filter((entry) => {
      if (!query) return true
      const role = roleLabel(entry.role)
      const tags = entry.tags.map(threatName).join(' ')
      return `${entry.name} ${role} ${tags}`.toLocaleLowerCase('pt-BR').includes(query)
    })
    .slice(0, 14)

  if (!results.length) {
    container.innerHTML = '<div class="roster-empty">Nenhum shikigami encontrado com esse filtro.</div>'
    return
  }

  container.innerHTML = results
    .map(
      (entry) => `
        <button class="roster-option" type="button" data-enemy="${esc(entry.name)}">
          <span>
            <strong>${esc(entry.name)}</strong>
            <small>${esc(roleLabel(entry.role))}</small>
          </span>
          <span class="option-tags">
            ${entry.tags.slice(0, 2).map((tag) => `<span class="option-tag">${esc(tag)}</span>`).join('')}
          </span>
        </button>`
    )
    .join('')
}

/* ---------- Library ---------- */

function renderLibraryControls() {
  const phaseOptions = [{ id: 'all', name: 'Todas' }, ...PHASES.map((phase) => ({ id: phase.id, name: phase.name }))]
  $('#phaseFilters').innerHTML = phaseOptions
    .map(
      (phase) => `
        <button type="button" data-filter-phase="${phase.id}" aria-pressed="${state.filters.phase === phase.id}">
          ${esc(phase.name)}
        </button>`
    )
    .join('')

  const kindOptions = [
    { id: 'all', name: 'Tudo' },
    { id: 'do', name: 'Faça' },
    { id: 'dont', name: 'Não faça' }
  ]
  $('#kindFilters').innerHTML = kindOptions
    .map(
      (kind) => `
        <button type="button" data-filter-kind="${kind.id}" aria-pressed="${state.filters.kind === kind.id}">
          ${esc(kind.name)}
        </button>`
    )
    .join('')

  $('#librarySearch').value = state.filters.search
}

function renderLibrary() {
  const tips = getVisibleTips({
    role: state.role,
    level: state.level,
    phase: state.filters.phase,
    kind: state.filters.kind,
    search: state.filters.search,
    threats: effectiveThreats()
  })

  $('#libraryCount').textContent = `${tips.length} carta${tips.length === 1 ? '' : 's'}`

  if (!tips.length) {
    $('#tipGrid').innerHTML = `
      <div class="empty-state">
        ${icon('map')}
        <span>Nenhuma carta com esses filtros. Tente outra fase, tipo ou busca.</span>
      </div>`
    return
  }

  $('#tipGrid').innerHTML = tips
    .map(
      (tip) => `
        <article class="tip-card ${tip.kind}" data-tip-id="${esc(tip.id)}">
          <div class="tip-head">
            <span class="tip-kind">${tip.kind === 'do' ? 'Faça' : 'Não faça'}</span>
            <span class="tip-phase">${esc(phaseLabel(tip))}</span>
          </div>
          <h3>${esc(tip.title)}</h3>
          <p>${esc(tip.body)}</p>
          <div class="tip-foot">
            ${(tip.tags || []).slice(0, 2).map((tag) => `<span>#${esc(tag)}</span>`).join('')}
            ${threatTags(tip).map((tag) => `<span>${esc(tag)}</span>`).join('')}
          </div>
        </article>`
    )
    .join('')
}

/* ---------- Checklist and feed ---------- */

function checklistState() {
  if (!Array.isArray(state.checklist[state.role])) state.checklist[state.role] = []
  return state.checklist[state.role]
}

function renderChecklist() {
  const role = getRole(state.role)
  const checked = checklistState()

  $('#checklist').innerHTML = role.plan
    .map(
      (item, index) => `
        <label class="checklist-item">
          <input type="checkbox" data-check="${index}" ${checked[index] ? 'checked' : ''} />
          <span class="checkmark" aria-hidden="true"></span>
          <span>${esc(item)}</span>
        </label>`
    )
    .join('')

  const done = role.plan.filter((_, index) => checked[index]).length
  $('#checklistCount').textContent = `${done}/${role.plan.length}`
  $('#checklistBar').style.width = `${(done / role.plan.length) * 100}%`
}

function logFeed(type, title, detail = '') {
  state.feed.unshift({ type, title, detail, time: state.seconds })
  state.feed = state.feed.slice(0, 14)
  renderFeed()
}

function renderFeed() {
  const container = $('#feed')
  if (!state.feed.length) {
    container.innerHTML = '<div class="feed-empty">O coach registra fases, objetivos e mudanças de contexto aqui.</div>'
    return
  }

  const icons = {
    phase: 'clock',
    objective: 'flag',
    state: 'target'
  }

  container.innerHTML = state.feed
    .map(
      (event) => `
        <div class="feed-item" data-type="${event.type}">
          <span class="feed-time">${formatClock(event.time)}</span>
          <span class="feed-icon">${icon(icons[event.type] || 'target')}</span>
          <span class="feed-copy">
            <strong>${esc(event.title)}</strong>
            ${event.detail ? `<span>${esc(event.detail)}</span>` : ''}
          </span>
        </div>`
    )
    .join('')
}

/* ---------- Toasts ---------- */

function toast({ title, detail = '', tone = 'red', iconName = 'warning', duration = 5200 }) {
  const container = $('#toasts')
  const node = document.createElement('div')
  node.className = 'toast'
  node.dataset.tone = tone
  node.innerHTML = `
    <span class="toast-icon">${icon(iconName)}</span>
    <span>
      <strong>${esc(title)}</strong>
      ${detail ? `<span>${esc(detail)}</span>` : ''}
    </span>`

  node.addEventListener('click', () => removeToast(node))
  container.appendChild(node)

  while (container.children.length > 3) {
    container.firstElementChild?.remove()
  }

  window.setTimeout(() => removeToast(node), duration)
}

function removeToast(node) {
  if (!node.isConnected) return
  node.classList.add('is-leaving')
  window.setTimeout(() => node.remove(), 260)
}

/* ---------- Alerts ---------- */

function overlayOwnsAlerts() {
  if (!bridge) return false
  try {
    return Boolean(bridge.isBubbleRunning())
  } catch {
    return false
  }
}

function alertObjective(objective, status, kind) {
  const isSoon = kind === 'soon'
  const title = isSoon
    ? `${objective.name} em ${formatClock(status.seconds)}`
    : `${objective.name} está no mapa`
  const detail = isSoon
    ? 'Prepare a onda e a visão. Não inicie sem vantagem.'
    : 'Dispute com visão ou troque por torre. Não faça 50/50.'
  const voiceText = isSoon
    ? `${objective.name} em ${Math.max(1, Math.ceil(status.seconds / 10) * 10)} segundos. Prepare onda e visão.`
    : `${objective.name} no mapa. Dispute com visão ou troque por torre.`

  toast({ title, detail, tone: 'red', iconName: objective.icon, duration: 6500 })
  if (!overlayOwnsAlerts()) {
    beep(kind)
    speak(voiceText)
  }
  logFeed('objective', title, detail)
}

function updateAlerts() {
  const phase = getPhase(state.seconds)

  if (state.phaseId == null) {
    state.phaseId = phase.id
  } else if (phase.id !== state.phaseId) {
    const previous = PHASES.find((item) => item.id === state.phaseId)
    state.phaseId = phase.id
    const title = `${previous ? previous.name : 'Partida'} → ${phase.name}`
    toast({
      title,
      detail: phase.description,
      tone: 'gold',
      iconName: 'clock',
      duration: 6200
    })
    if (!overlayOwnsAlerts()) {
      beep('phase')
      speak(`${phase.name}. ${phase.tagline}.`)
    }
    logFeed('phase', title, phase.description)
  }

  for (const objective of OBJECTIVES) {
    const saved = state.objectives[objective.id]
    const status = getObjectiveState(saved.nextSpawn, state.seconds)

    for (const kind of ['soon', 'live']) {
      if (status.state !== kind) continue
      const key = `${objective.id}:${saved.nextSpawn}:${kind}`
      if (state.alerted.has(key)) continue
      state.alerted.add(key)
      alertObjective(objective, status, kind)
    }
  }
}

/* ---------- Actions ---------- */

function startPause() {
  state.running = !state.running
  state.lastFrame = performance.now()
  if (state.running) {
    ensureAudio()
    logFeed(
      'state',
      state.seconds === 0 ? 'Partida iniciada' : 'Relógio retomado',
      `Papel ${getRole(state.role).name} · ${getPhase(state.seconds).name}`
    )
    state.phaseId = getPhase(state.seconds).id
    lastSecondReset()
  } else {
    logFeed('state', 'Relógio pausado', `Aos ${formatClock(state.seconds)}`)
  }
  renderClock()
  refreshAdvice(true)
  publishSharedState(true)
}

function resetMatch() {
  state.seconds = 0
  state.running = false
  state.objectives = makeObjectives()
  state.alerted.clear()
  state.phaseId = null
  state.feed = []
  state.checklist[state.role] = []
  state.adviceKey = ''
  saveSettings()
  renderAll()
  logFeed('state', 'Partida reiniciada', 'Relógio, objetivos e checklist zerados.')
  toast({
    title: 'Nova partida',
    detail: 'Relógio e objetivos zerados. O draft foi mantido.',
    tone: 'gold',
    iconName: 'reset'
  })
  beep('success')
  publishSharedState(true)
}

function seekTo(seconds) {
  state.seconds = seconds
  state.running = true
  state.phaseId = getPhase(seconds).id
  state.lastFrame = performance.now()
  lastSecondReset()
  logFeed('state', `Simulação em ${formatClock(seconds)}`, `${getPhase(seconds).name} · relógio em andamento`)
  renderClock()
  renderNextObjective()
  updateObjectiveCards()
  updateAlerts()
  refreshAdvice(true)
  publishSharedState(true)
}

function markObjective(id) {
  const objective = OBJECTIVES.find((item) => item.id === id)
  if (!objective) return
  const saved = state.objectives[id]
  const status = getObjectiveState(saved.nextSpawn, state.seconds)
  if (status.state !== 'live') return

  if (objective.respawn) {
    saved.nextSpawn = state.seconds + objective.respawn
    toast({
      title: `${objective.name} abatido`,
      detail: `Respawn estimado em ${formatClock(objective.respawn)}.`,
      tone: 'teal',
      iconName: 'check'
    })
    logFeed('objective', `${objective.name} abatido`, `Próximo em ${formatClock(objective.respawn)}`)
  } else {
    saved.nextSpawn = null
    toast({
      title: `${objective.name} concluído`,
      detail: 'Objetivo de decisão encerrado.',
      tone: 'teal',
      iconName: 'check'
    })
    logFeed('objective', `${objective.name} concluído`, 'Objetivo de decisão encerrado.')
  }

  beep('success')
  updateObjectiveCards()
  renderNextObjective()
  refreshAdvice(true)
  publishSharedState(true)
}

function toggleSituation(key) {
  state.situation[key] = !state.situation[key]
  renderSituation()
  const labels = {
    noVision: 'Sem visão no rio',
    enemyMissing: 'Inimigo sumido',
    ultReady: 'Ultimate pronta',
    allyDead: 'Aliado morto'
  }
  logFeed('state', `${labels[key]} ${state.situation[key] ? 'ativado' : 'desativado'}`)
  refreshAdvice(true)
  publishSharedState(true)
}

function toggleThreat(id) {
  if (state.manualThreats.has(id)) state.manualThreats.delete(id)
  else state.manualThreats.add(id)
  const threat = THREATS.find((item) => item.id === id)
  logFeed('state', `Ameaça ${state.manualThreats.has(id) ? 'marcada' : 'removida'}`, threat?.name || id)
  renderThreats()
  renderDraftSummary()
  renderLibrary()
  refreshAdvice(true)
  publishSharedState(true)
}

function addEnemy(name) {
  if (state.enemies.length >= MAX_ENEMIES || state.enemies.includes(name)) return
  const entry = rosterEntry(name)
  if (!entry) return
  state.enemies.push(name)
  state.rosterSearch = ''
  $('#rosterSearch').value = ''
  renderSelectedEnemies()
  renderThreats()
  renderDraftSummary()
  renderRosterResults()
  renderLibrary()
  refreshAdvice(true)
  logFeed('state', `${name} adicionado ao draft`, `${roleLabel(entry.role)} · ${entry.tags.map(threatName).join(', ')}`)
  publishSharedState(true)
}

function removeEnemy(name) {
  state.enemies = state.enemies.filter((enemy) => enemy !== name)
  renderSelectedEnemies()
  renderThreats()
  renderDraftSummary()
  renderRosterResults()
  renderLibrary()
  refreshAdvice(true)
  logFeed('state', `${name} removido do draft`)
  publishSharedState(true)
}

function clearDraft() {
  if (!state.enemies.length && !state.manualThreats.size) return
  state.enemies = []
  state.manualThreats.clear()
  renderSelectedEnemies()
  renderThreats()
  renderDraftSummary()
  renderRosterResults()
  renderLibrary()
  refreshAdvice(true)
  logFeed('state', 'Draft limpo', 'Ameaças manuais e picks removidos.')
  publishSharedState(true)
}

function changeRole(roleId) {
  if (state.role === roleId) return
  state.role = roleId
  state.adviceKey = ''
  renderRoles()
  renderRoleContext()
  renderChecklist()
  renderLibrary()
  refreshAdvice(true)
  saveSettings()
  logFeed('state', `Papel alterado para ${getRole(roleId).name}`, getRole(roleId).lane)
  publishSharedState(true)
}

function changeLevel(level) {
  if (state.level === level) return
  state.level = level
  renderLevel()
  renderLibrary()
  refreshAdvice(true)
  saveSettings()
  publishSharedState(true)
}

function changeTeam(team) {
  if (state.team === team) return
  state.team = team
  renderTeam()
  refreshAdvice(true)
  const labels = { behind: 'Atrás no jogo', even: 'Equilibrado', ahead: 'À frente no jogo' }
  logFeed('state', `Estado: ${labels[team]}`)
  publishSharedState(true)
}

function toggleSound() {
  state.sound = !state.sound
  renderSound()
  saveSettings()
  if (state.sound) {
    ensureAudio()
    beep('success')
    toast({
      title: 'Alertas sonoros ativados',
      detail: 'Você ouvirá avisos 45s antes e quando o objetivo nascer.',
      tone: 'gold',
      iconName: 'volume'
    })
  }
  publishSharedState(true)
}

function toggleVoice() {
  state.voice = !state.voice
  renderSound()
  saveSettings()
  if (state.voice) speak('Avisos por voz ativados.')
  else {
    if (bridge) {
      try {
        bridge.stopSpeaking()
      } catch {
        /* ignore */
      }
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }
  publishSharedState(true)
}

/* ---------- Render orchestration ---------- */

function renderAll() {
  renderTicker()
  renderRoles()
  renderRoleContext()
  renderLevel()
  renderTeam()
  renderSpeed()
  renderSituation()
  renderSound()
  renderPhaseTrack()
  renderClock()
  renderNextObjective()
  renderObjectiveCards()
  renderThreats()
  renderDraftSummary()
  renderSelectedEnemies()
  renderRosterResults()
  renderLibraryControls()
  renderLibrary()
  renderChecklist()
  renderFeed()
  refreshAdvice(true)
  renderContextMeter()
}

function lastSecondReset() {
  state.lastSecond = -1
}

/* ---------- Event wiring ---------- */

function wireEvents() {
  $('#roleStrip').addEventListener('click', (event) => {
    const button = event.target.closest('[data-role]')
    if (button) changeRole(button.dataset.role)
  })

  document.querySelectorAll('[data-level]').forEach((button) => {
    button.addEventListener('click', () => changeLevel(Number(button.dataset.level)))
  })

  document.querySelectorAll('[data-team]').forEach((button) => {
    button.addEventListener('click', () => changeTeam(button.dataset.team))
  })

  document.querySelectorAll('[data-speed]').forEach((button) => {
    button.addEventListener('click', () => {
      state.speed = Number(button.dataset.speed)
      renderSpeed()
      publishSharedState(true)
    })
  })

  $('#situationStrip').addEventListener('click', (event) => {
    const button = event.target.closest('[data-situation]')
    if (button) toggleSituation(button.dataset.situation)
  })

  $('#startPause').addEventListener('click', startPause)
  $('#resetMatch').addEventListener('click', resetMatch)

  $('#phaseTrack').addEventListener('click', (event) => {
    const button = event.target.closest('[data-seek]')
    if (button) seekTo(Number(button.dataset.seek))
  })

  $('#objectiveRow').addEventListener('click', (event) => {
    const button = event.target.closest('[data-mark]')
    if (button) markObjective(button.dataset.mark)
  })

  $('#threatGrid').addEventListener('click', (event) => {
    const button = event.target.closest('[data-threat]')
    if (button) toggleThreat(button.dataset.threat)
  })

  $('#rosterResults').addEventListener('click', (event) => {
    const button = event.target.closest('[data-enemy]')
    if (button) addEnemy(button.dataset.enemy)
  })

  $('#rosterSearch').addEventListener('focus', () => {
    state.rosterOpen = true
    renderRosterResults()
  })

  $('#rosterSearch').addEventListener('input', (event) => {
    state.rosterSearch = event.target.value
    state.rosterOpen = true
    renderRosterResults()
  })

  $('#selectedEnemies').addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-enemy]')
    if (button) removeEnemy(button.dataset.removeEnemy)
  })

  $('#clearDraft').addEventListener('click', clearDraft)

  $('#phaseFilters').addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter-phase]')
    if (!button) return
    state.filters.phase = button.dataset.filterPhase
    renderLibraryControls()
    renderLibrary()
  })

  $('#kindFilters').addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter-kind]')
    if (!button) return
    state.filters.kind = button.dataset.filterKind
    renderLibraryControls()
    renderLibrary()
  })

  $('#librarySearch').addEventListener('input', (event) => {
    state.filters.search = event.target.value
    renderLibrary()
  })

  $('#checklist').addEventListener('change', (event) => {
    const input = event.target.closest('[data-check]')
    if (!input) return
    const index = Number(input.dataset.check)
    const checked = checklistState()
    checked[index] = input.checked
    saveSettings()
    renderChecklist()
  })

  $('#soundToggle').addEventListener('click', toggleSound)
  $('#voiceToggle').addEventListener('click', toggleVoice)

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.picker')) {
      state.rosterOpen = false
      renderRosterResults()
    }
  })

  document.addEventListener('keydown', (event) => {
    const target = event.target
    const typing = target instanceof HTMLElement && target.matches('input, textarea, select')

    if (event.code === 'Space' && !typing && !target.closest('button, a')) {
      event.preventDefault()
      startPause()
      return
    }

    if (typing) return

    if (event.key.toLowerCase() === 'r') {
      event.preventDefault()
      resetMatch()
    }

    if (/^[1-5]$/.test(event.key)) {
      const role = ROLES[Number(event.key) - 1]
      if (role) changeRole(role.id)
    }
  })
}

/* ---------- Main loop ---------- */

function frame(now) {
  const delta = Math.min(0.5, Math.max(0, (now - state.lastFrame) / 1000))
  state.lastFrame = now

  if (state.running) {
    state.seconds += delta * state.speed
    if (now - state.lastUi > 100) {
      state.lastUi = now
      renderClock()
      updateAlerts()
    }

    const whole = Math.floor(state.seconds)
    if (whole !== state.lastSecond) {
      state.lastSecond = whole
      updateObjectiveCards()
      renderNextObjective()
      refreshAdvice()
    }
  }

  requestAnimationFrame(frame)
}

/* ---------- Boot ---------- */

loadSettings()
renderAll()
wireEvents()
setupAndroidBridge()
state.lastFrame = performance.now()
requestAnimationFrame(frame)

$('#footerHints').textContent = KEYBOARD_HINTS

if (state.sound) {
  renderSound()
}
