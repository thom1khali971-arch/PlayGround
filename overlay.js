import {
  PHASES,
  ROLES,
  OBJECTIVES,
  THREATS
} from './data.js'
import {
  formatClock,
  getPhase,
  getNextWave,
  getObjectiveState,
  getNextObjective,
  getEffectiveThreats,
  getLiveAdvice,
  getObjectiveWindows,
  getRole
} from './engine.js'

const STORAGE_KEY = 'onmyoji-live-coach/overlay-v1'
const SETTINGS_KEY = 'onmyoji-live-coach/v1'
const MAX_ENEMIES = 5
const MAX_SNAPSHOT_AGE = 2 * 60 * 60 * 1000
const bridge = window.AndroidCoach || null
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
  advice: [],
  adviceKey: ''
}

let lastRemote = 0
let lastRemoteControl = ''
let lastPublish = 0
let lastFrame = performance.now()
let lastSecond = 0
let toastTimer = 0
let audioContext = null

const SITUATION_LABELS = {
  noVision: 'Sem visão',
  enemyMissing: 'Sumido',
  ultReady: 'Ult pronta',
  allyDead: 'Aliado morto'
}

function makeObjectives() {
  return Object.fromEntries(OBJECTIVES.map((objective) => [objective.id, { nextSpawn: objective.time }]))
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return map[char]
  })
}

function roleName() {
  return getRole(state.role).name
}

function numberIn(value, min, max, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
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

function alertKey(objectiveId, nextSpawn, kind) {
  return `${objectiveId}:${nextSpawn}:${kind}`
}

function controlSignature(payload) {
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

/* ---------- Snapshot sync ---------- */

function buildSnapshot() {
  return {
    v: 1,
    source: 'overlay',
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

function applySnapshot(raw, boot = false) {
  let payload
  try {
    payload = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return false
  }
  if (!payload || payload.v !== 1) return false
  if (!boot && (payload.source === 'overlay' || !Number.isFinite(Number(payload.updatedAt)))) return false

  const updatedAt = Number(payload.updatedAt) || 0
  if (!boot && updatedAt <= lastRemote) return false
  if (boot && updatedAt && Date.now() - updatedAt > MAX_SNAPSHOT_AGE) return false

  const signature = controlSignature(payload)
  if (!boot && signature === lastRemoteControl) {
    lastRemote = updatedAt || Date.now()
    return false
  }

  const previousRole = state.role
  const previousTeam = state.team
  const previousLevel = state.level

  state.role = ROLES.some((role) => role.id === payload.role) ? payload.role : state.role
  state.level = oneOf(Number(payload.level), [1, 2, 3], state.level)
  state.running = Boolean(payload.running)
  state.speed = oneOf(Number(payload.speed), [1, 2, 4], 1)
  state.sound = Boolean(payload.sound)
  state.voice = Boolean(payload.voice)
  state.team = oneOf(payload.team, ['behind', 'even', 'ahead'], state.team)

  const seconds = numberIn(payload.seconds, 0, 86_400, state.seconds)
  const age = boot && state.running ? Math.max(0, (Date.now() - updatedAt) / 1000) : 0
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
        .filter((name) => typeof name === 'string' && name.length > 0 && name.length < 50)
        .slice(0, MAX_ENEMIES)
    : []

  for (const objective of OBJECTIVES) {
    const rawValue = payload.objectives?.[objective.id]
    const value = rawValue && typeof rawValue === 'object' ? rawValue.nextSpawn : rawValue
    state.objectives[objective.id] = {
      nextSpawn: value == null ? null : numberIn(value, 0, 86_400, objective.time)
    }
  }

  const incomingAlerts = Array.isArray(payload.alerted)
    ? payload.alerted.filter((key) => typeof key === 'string' && key.length < 100)
    : null
  state.alerted = new Set(incomingAlerts || [])
  if (!incomingAlerts) seedCurrentAlerts()

  lastRemote = updatedAt || Date.now()
  lastRemoteControl = signature
  lastFrame = performance.now()
  lastSecond = Math.floor(state.seconds)
  state.adviceKey = ''
  syncBubbleClock()

  if (previousRole !== state.role || previousTeam !== state.team || previousLevel !== state.level) {
    renderContext()
  }
  renderAll()
  return true
}

function syncBubbleClock() {
  if (!bridge) return
  try {
    bridge.syncClock(state.seconds, state.running)
  } catch {
    /* ignore */
  }
}

function publish(force = false) {
  if (!bridge) {
    if (force) saveLocal()
    return
  }
  const now = performance.now()
  if (!force && now - lastPublish < 850) return
  lastPublish = now
  const snapshot = buildSnapshot()
  try {
    bridge.publishOverlayState(JSON.stringify(snapshot))
    lastRemoteControl = controlSignature(snapshot)
  } catch {
    /* bridge can disappear while the service is stopping */
  }
  saveLocal(snapshot)
}

function saveLocal(snapshot = buildSnapshot()) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    /* storage can be unavailable */
  }
}

function loadBootState() {
  let applied = false
  if (bridge) {
    try {
      const mainRaw = bridge.readMainState()
      const overlayRaw = bridge.readOverlayState()
      const newest = newestSnapshot(mainRaw, overlayRaw)
      applied = applySnapshot(newest, true)
    } catch {
      applied = false
    }
  }
  if (applied) return

  try {
    const local = localStorage.getItem(STORAGE_KEY)
    if (local && applySnapshot(local, true)) {
      syncBubbleClock()
      return
    }
  } catch {
    /* ignore */
  }

  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
    if (settings) {
      if (ROLES.some((role) => role.id === settings.role)) state.role = settings.role
      state.level = oneOf(Number(settings.level), [1, 2, 3], state.level)
      state.sound = Boolean(settings.sound)
      state.voice = Boolean(settings.voice)
    }
  } catch {
    /* ignore */
  }

  lastFrame = performance.now()
  lastSecond = 0
  renderAll()
  seedCurrentAlerts()
  publish(true)
}

function newestSnapshot(first, second) {
  const parse = (raw) => {
    try {
      const value = typeof raw === 'string' ? JSON.parse(raw) : raw
      return value && value.v === 1 ? value : null
    } catch {
      return null
    }
  }
  const a = parse(first)
  const b = parse(second)
  if (!a) return b
  if (!b) return a
  return Number(b.updatedAt) > Number(a.updatedAt) ? b : a
}

function syncNow() {
  if (!bridge) return
  try {
    const raw = bridge.readMainState()
    if (raw) applySnapshot(raw, false)
  } catch {
    /* ignore */
  }
}

/* ---------- Rendering ---------- */

function renderAll() {
  renderContext()
  renderClock()
  renderSpeed()
  renderRole()
  renderSound()
  renderDerived(true)
  renderSync()
}

function renderContext() {
  const phase = getPhase(state.seconds)
  $('#ovContext').textContent = `${roleName()} · ${phase.name}`
}

function renderClock() {
  const phase = getPhase(state.seconds)
  const wave = getNextWave(state.seconds)
  const button = $('#ovStartPause')

  $('#ovTime').textContent = formatClock(state.seconds)
  $('#ovPhase').textContent = phase.name
  $('#ovWave').textContent = `Onda em ${formatClock(wave.remaining)}`
  button.classList.toggle('is-running', state.running)
  button.setAttribute('aria-label', state.running ? 'Pausar relógio da partida' : 'Iniciar relógio da partida')
  button.title = state.running ? 'Pausar relógio' : 'Iniciar relógio'
}

function renderSpeed() {
  document.querySelectorAll('[data-speed]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === state.speed))
  })
}

function renderRole() {
  $('#ovRole').textContent = roleName()
  $('#ovRole').title = `Papel: ${roleName()} — toque para trocar`
}

function renderSound() {
  $('#ovSound').setAttribute('aria-pressed', String(state.sound))
  $('#ovSound').title = state.sound ? 'Desativar alertas sonoros' : 'Ativar alertas sonoros'
  $('#ovVoice').setAttribute('aria-pressed', String(state.voice))
  $('#ovVoice').title = state.voice ? 'Desativar avisos por voz' : 'Ativar avisos por voz'
}

function renderSync() {
  const element = $('#ovSync')
  const wrapper = element.parentElement
  wrapper.classList.toggle('is-local', !bridge)
  element.textContent = bridge ? 'Sincronizado' : 'Prévia local'
}

function renderDerived(force = false) {
  renderNext()
  renderObjectives()
  renderSituations()
  renderAdvice(force)
  renderContext()
}

function renderNext() {
  const container = $('#ovNext')
  const next = getNextObjective(state.objectives, state.seconds)

  if (!next) {
    container.dataset.state = 'done'
    $('#ovNextKicker').textContent = 'Mapa livre'
    $('#ovNextName').textContent = 'Objetivos concluídos'
    $('#ovNextTime').textContent = 'fim de jogo'
    return
  }

  const objective = OBJECTIVES.find((item) => item.id === next.id)
  container.dataset.state = next.state
  $('#ovNextKicker').textContent =
    next.state === 'live' ? 'No mapa' : next.state === 'soon' ? 'Prepare-se' : 'Próximo'
  $('#ovNextName').textContent = objective?.name || next.id
  $('#ovNextTime').textContent =
    next.state === 'live' ? `há ${formatClock(next.seconds)}` : `em ${formatClock(next.seconds)}`
}

function renderObjectives() {
  const container = $('#ovObjectives')
  container.innerHTML = OBJECTIVES.map((objective) => {
    const saved = state.objectives[objective.id]
    const status = getObjectiveState(saved.nextSpawn, state.seconds)
    let statusText = ''
    if (status.state === 'upcoming') statusText = `em ${formatClock(status.seconds)}`
    if (status.state === 'soon') statusText = `prepare · ${formatClock(status.seconds)}`
    if (status.state === 'live') statusText = `no mapa · ${formatClock(status.seconds)}`
    if (status.state === 'done') statusText = 'concluído'

    return `
      <div class="ov-objective" data-state="${status.state}" data-objective="${objective.id}">
        <div class="ov-obj-copy">
          <strong>${esc(objective.name)}</strong>
          <span>${esc(statusText)}</span>
        </div>
        <button type="button" data-mark="${objective.id}" ${status.state === 'live' ? '' : 'disabled'}>
          ${status.state === 'live' ? 'Pegou' : '—'}
        </button>
      </div>`
  }).join('')
}

function renderSituations() {
  const container = $('#ovSituations')
  container.innerHTML = Object.entries(SITUATION_LABELS)
    .map(
      ([key, label]) => `
        <button type="button" data-situation="${key}" aria-pressed="${Boolean(state.situation[key])}">
          ${esc(label)}
        </button>`
    )
    .join('')
}

function renderAdvice(force = false) {
  const context = {
    seconds: state.seconds,
    role: state.role,
    level: state.level,
    threats: effectiveThreats(),
    situation: teamSituation(),
    objectiveWindows: getObjectiveWindows(state.objectives, state.seconds)
  }
  const tips = getLiveAdvice(context, 2)
  const key = [
    getPhase(state.seconds).id,
    state.role,
    state.level,
    state.team,
    tips.map((tip) => tip.id).join(','),
    [...state.manualThreats].sort().join(','),
    state.enemies.slice().sort().join(','),
    Object.values(state.situation).map(Boolean).join(',')
  ].join('|')

  if (!force && key === state.adviceKey) return
  state.adviceKey = key
  state.advice = tips

  const container = $('#ovAdvice')
  if (!tips.length) {
    container.innerHTML = '<div class="ov-empty">Sem conselho específico. Marque papel, time e contexto no app.</div>'
    return
  }

  container.innerHTML = tips
    .map(
      (tip) => `
        <article class="ov-tip ${tip.kind === 'dont' ? 'is-dont' : 'is-do'}">
          <div class="ov-tip-head">
            <span class="ov-tip-kind">${tip.kind === 'do' ? 'Faça agora' : 'Não faça'}</span>
            <span class="ov-tip-objective">${esc(tip.phaseName)}</span>
          </div>
          <h3>${esc(tip.title)}</h3>
          <p>${esc(tip.body)}</p>
        </article>`
    )
    .join('')
}

/* ---------- Actions ---------- */

function startPause() {
  state.running = !state.running
  lastFrame = performance.now()
  if (state.running) {
    ensureAudio()
    nativeBeep('phase')
    showToast(state.seconds === 0 ? 'Partida iniciada' : 'Relógio retomado', 'gold')
  } else {
    showToast(`Relógio pausado em ${formatClock(state.seconds)}`, 'gold')
  }
  renderClock()
  renderDerived(true)
  publish(true)
}

function cycleRole() {
  const index = ROLES.findIndex((role) => role.id === state.role)
  const next = ROLES[(index + 1) % ROLES.length]
  state.role = next.id
  state.adviceKey = ''
  renderRole()
  renderContext()
  renderDerived(true)
  publish(true)
  showToast(`Papel: ${next.name}`, 'teal')
}

function changeSpeed(speed) {
  state.speed = speed
  renderSpeed()
  publish(true)
  showToast(`Velocidade ${speed}×`, 'gold')
}

function toggleSituation(key) {
  if (!(key in state.situation)) return
  state.situation[key] = !state.situation[key]
  state.adviceKey = ''
  renderSituations()
  renderDerived(true)
  publish(true)
}

function toggleSound() {
  state.sound = !state.sound
  renderSound()
  publish(true)
  if (state.sound) {
    nativeBeep('success')
    showToast('Alertas sonoros ativados', 'gold')
  } else {
    showToast('Alertas sonoros desativados')
  }
}

function toggleVoice() {
  state.voice = !state.voice
  renderSound()
  publish(true)
  if (state.voice) speak('Avisos por voz ativados.')
  else stopSpeaking()
}

function markObjective(id) {
  const objective = OBJECTIVES.find((item) => item.id === id)
  if (!objective) return
  const saved = state.objectives[id]
  const status = getObjectiveState(saved.nextSpawn, state.seconds)
  if (status.state !== 'live') return

  if (objective.respawn) {
    saved.nextSpawn = state.seconds + objective.respawn
    showToast(`${objective.name} abatido · respawn ${formatClock(objective.respawn)}`, 'teal')
  } else {
    saved.nextSpawn = null
    showToast(`${objective.name} concluído`, 'teal')
  }
  nativeBeep('success')
  renderDerived(true)
  publish(true)
}

/* ---------- Alerts ---------- */

function seedCurrentAlerts() {
  for (const objective of OBJECTIVES) {
    const saved = state.objectives[objective.id]
    if (!saved || saved.nextSpawn == null) continue
    const status = getObjectiveState(saved.nextSpawn, state.seconds)
    if (status.state === 'soon' || status.state === 'live') {
      state.alerted.add(alertKey(objective.id, saved.nextSpawn, status.state))
    }
  }
}

function updateAlerts() {
  let fired = false
  for (const objective of OBJECTIVES) {
    const saved = state.objectives[objective.id]
    if (!saved || saved.nextSpawn == null) continue
    const status = getObjectiveState(saved.nextSpawn, state.seconds)

    for (const kind of ['soon', 'live']) {
      if (status.state !== kind) continue
      const key = alertKey(objective.id, saved.nextSpawn, kind)
      if (state.alerted.has(key)) continue
      state.alerted.add(key)
      fireAlert(objective, status, kind)
      fired = true
    }
  }
  if (fired) publish(true)
}

function fireAlert(objective, status, kind) {
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

  if (bridge) {
    try {
      bridge.notifyAlert(title, detail, kind)
    } catch {
      /* ignore */
    }
  }
  showToast(title, isSoon ? 'gold' : 'red')
  if (state.sound) nativeBeep(kind)
  if (state.voice) speak(voiceText)
}

/* ---------- Audio fallback ---------- */

function ensureAudio() {
  if (!('AudioContext' in window || 'webkitAudioContext' in window)) return null
  if (!audioContext) {
    const Context = window.AudioContext || window.webkitAudioContext
    audioContext = new Context()
  }
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {})
  return audioContext
}

function webBeep(kind) {
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
    gain.gain.exponentialRampToValueAtTime(0.05, at + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(at)
    oscillator.stop(at + 0.14)
  })
}

function nativeBeep(kind) {
  if (bridge) {
    try {
      bridge.beep(kind)
      return
    } catch {
      /* fall back below */
    }
  }
  webBeep(kind)
}

function speak(text) {
  if (bridge) {
    try {
      bridge.speak(text)
      return
    } catch {
      /* fall back below */
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

function stopSpeaking() {
  if (bridge) {
    try {
      bridge.stopSpeaking()
    } catch {
      /* ignore */
    }
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

/* ---------- Toast ---------- */

function showToast(text, tone = 'gold') {
  const node = $('#ovToast')
  node.textContent = text
  node.dataset.tone = tone
  node.classList.add('is-show')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => node.classList.remove('is-show'), 1900)
}

/* ---------- Clock ---------- */

function tick() {
  const now = performance.now()
  const delta = Math.min(2, Math.max(0, (now - lastFrame) / 1000))
  lastFrame = now

  if (!state.running) return

  state.seconds += delta * state.speed
  renderClock()
  updateAlerts()

  const whole = Math.floor(state.seconds)
  if (whole !== lastSecond) {
    lastSecond = whole
    renderDerived()
    publish()
  }
}

/* ---------- Events ---------- */

function wireEvents() {
  $('#ovStartPause').addEventListener('click', startPause)
  $('#ovRole').addEventListener('click', cycleRole)
  $('#ovSound').addEventListener('click', toggleSound)
  $('#ovVoice').addEventListener('click', toggleVoice)

  document.querySelectorAll('[data-speed]').forEach((button) => {
    button.addEventListener('click', () => changeSpeed(Number(button.dataset.speed)))
  })

  $('#ovObjectives').addEventListener('click', (event) => {
    const button = event.target.closest('[data-mark]')
    if (button) markObjective(button.dataset.mark)
  })

  $('#ovSituations').addEventListener('click', (event) => {
    const button = event.target.closest('[data-situation]')
    if (button) toggleSituation(button.dataset.situation)
  })

  $('#ovClose').addEventListener('click', () => {
    if (bridge) {
      try {
        bridge.collapsePanel()
      } catch {
        /* ignore */
      }
    } else {
      showToast('No APK, este botão recolhe a bolha.')
    }
  })

  $('#ovOpen').addEventListener('click', () => {
    if (bridge) {
      try {
        bridge.openApp()
      } catch {
        /* ignore */
      }
    } else {
      showToast('Disponível no APK Android.')
    }
  })

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncNow()
  })
}

/* ---------- Boot ---------- */

wireEvents()
loadBootState()
lastFrame = performance.now()
lastSecond = Math.floor(state.seconds)
window.setInterval(tick, 250)
window.setInterval(syncNow, 650)
