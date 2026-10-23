import { PHASES, ROLES, THREATS, TIPS, ROSTER } from './data.js'

export const SOON_WINDOW = 45

export function clampTime(seconds) {
  return Math.max(0, Number.isFinite(seconds) ? seconds : 0)
}

export function formatClock(seconds) {
  const total = Math.floor(clampTime(seconds))
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function getPhase(seconds) {
  const value = clampTime(seconds)
  return PHASES.find((phase) => value >= phase.start && value < phase.end) || PHASES[PHASES.length - 1]
}

export function getPhaseIndex(seconds) {
  return PHASES.indexOf(getPhase(seconds))
}

export function getPhaseProgress(seconds) {
  const phase = getPhase(seconds)
  if (!Number.isFinite(phase.end)) return 1
  const span = phase.end - phase.start
  return Math.min(1, Math.max(0, (clampTime(seconds) - phase.start) / span))
}

export function getNextWave(seconds) {
  const value = clampTime(seconds)
  const elapsed = value % 30
  const remaining = elapsed === 0 ? 30 : 30 - elapsed
  return {
    remaining,
    number: Math.floor(value / 30) + 1
  }
}

export function getObjectiveState(nextSpawn, seconds, soonWindow = SOON_WINDOW) {
  if (nextSpawn == null) return { state: 'done', seconds: 0 }
  const delta = nextSpawn - clampTime(seconds)
  if (delta > soonWindow) return { state: 'upcoming', seconds: delta }
  if (delta > 0) return { state: 'soon', seconds: delta }
  return { state: 'live', seconds: Math.abs(delta) }
}

export function getObjectiveWindows(objectives, seconds) {
  const windows = {}
  for (const [id, objective] of Object.entries(objectives)) {
    windows[id] = getObjectiveState(objective.nextSpawn, seconds)
  }
  return windows
}

const OBJECTIVE_IMPORTANCE = { riverboss: 1, orochi: 2, nen: 3 }

export function getNextObjective(objectives, seconds) {
  const entries = Object.entries(objectives)
    .map(([id, objective]) => ({ id, ...getObjectiveState(objective.nextSpawn, seconds) }))
    .filter((entry) => entry.state !== 'done')

  if (!entries.length) return null

  const live = entries
    .filter((entry) => entry.state === 'live')
    .sort(
      (a, b) =>
        (OBJECTIVE_IMPORTANCE[b.id] || 0) - (OBJECTIVE_IMPORTANCE[a.id] || 0) ||
        a.seconds - b.seconds
    )
  if (live.length) return live[0]

  const soon = entries.filter((entry) => entry.state === 'soon').sort((a, b) => a.seconds - b.seconds)
  if (soon.length) return soon[0]

  return entries.filter((entry) => entry.state === 'upcoming').sort((a, b) => a.seconds - b.seconds)[0] || null
}

export function getRole(roleId) {
  return ROLES.find((role) => role.id === roleId) || ROLES[0]
}

export function getRoleName(roleId) {
  return getRole(roleId).name
}

export function rosterEntry(name) {
  return ROSTER.find((entry) => entry.name === name) || null
}

export function getEnemyThreats(enemyNames) {
  const threats = new Set()
  for (const name of enemyNames) {
    const entry = rosterEntry(name)
    if (!entry) continue
    for (const tag of entry.tags) threats.add(tag)
  }
  return threats
}

export function getEffectiveThreats(manualThreats, enemyNames) {
  const threats = new Set(manualThreats || [])
  for (const tag of getEnemyThreats(enemyNames || [])) threats.add(tag)
  return threats
}

export function threatName(id) {
  const threat = THREATS.find((entry) => entry.id === id)
  return threat ? threat.name : id
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function matchesTip(tip, context) {
  const { phase, role, level, threats, situation, objectiveWindows } = context
  const roles = list(tip.roles)
  const phases = list(tip.phases)
  const tipThreats = list(tip.threats)
  const conditions = list(tip.conditions)

  if (tip.minLevel && level < tip.minLevel) return false
  if (roles.length && !roles.includes(role)) return false
  if (phases.length && !phases.includes(phase.id)) return false
  if (tipThreats.length && !tipThreats.some((id) => threats.includes(id))) return false
  if (conditions.length && !conditions.every((key) => Boolean(situation[key]))) return false

  if (tip.objective) {
    const window = objectiveWindows[tip.objective]
    if (!window) return false
    if (tip.window === 'soon' && window.state !== 'soon') return false
    if (tip.window === 'live' && window.state !== 'live') return false
    if (tip.window === 'any' && !['soon', 'live'].includes(window.state)) return false
    if (!tip.window && !['soon', 'live'].includes(window.state)) return false
  }

  return true
}

function scoreTip(tip, context, objectiveWindows) {
  let score = tip.priority || 50
  const tipThreats = list(tip.threats)
  const phases = list(tip.phases)
  const roles = list(tip.roles)

  if (tipThreats.some((id) => context.threats.includes(id))) score += 4
  if (list(tip.conditions).length) score += 3
  if (tip.objective) {
    const window = objectiveWindows[tip.objective]
    score += window?.state === 'live' ? 18 : 12
  }
  if (phases.includes(context.phase.id)) score += 2
  if (roles.includes(context.role)) score += 2
  return score
}

export function getLiveAdvice(input, limit = 3) {
  const context = {
    phase: getPhase(input.seconds),
    role: input.role,
    level: input.level || 1,
    threats: input.threats || [],
    situation: input.situation || {},
    objectiveWindows: input.objectiveWindows || {}
  }

  const candidates = TIPS.filter((tip) => matchesTip(tip, context))
    .map((tip) => ({ ...tip, score: scoreTip(tip, context, context.objectiveWindows) }))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'pt-BR'))

  const picked = candidates.slice(0, Math.max(1, limit))

  if (picked.length >= 3) {
    const kinds = new Set(picked.map((tip) => tip.kind))
    if (kinds.size === 1) {
      const opposite = candidates.find((tip) => tip.kind !== picked[0].kind && !picked.includes(tip))
      if (opposite) picked[picked.length - 1] = opposite
    }
  }

  return picked.map((tip) => ({
    ...tip,
    phaseName: context.phase.name
  }))
}

export function getVisibleTips(options = {}) {
  const {
    role = 'mid',
    level = 3,
    phase = 'all',
    kind = 'all',
    search = '',
    threats = []
  } = options

  const query = search.trim().toLocaleLowerCase('pt-BR')

  return TIPS.filter((tip) => {
    const roles = list(tip.roles)
    const phases = list(tip.phases)
    const tipThreats = list(tip.threats)

    if (tip.minLevel && level < tip.minLevel) return false
    if (roles.length && !roles.includes(role)) return false
    if (phase !== 'all' && !phases.includes(phase)) return false
    if (kind !== 'all' && tip.kind !== kind) return false
    if (threats.length && tipThreats.length && !tipThreats.some((id) => threats.includes(id))) return false
    if (!query) return true
    const haystack = `${tip.title} ${tip.body} ${list(tip.tags).join(' ')}`.toLocaleLowerCase('pt-BR')
    return haystack.includes(query)
  }).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'do' ? -1 : 1
    return (b.priority || 0) - (a.priority || 0) || a.title.localeCompare(b.title, 'pt-BR')
  })
}

export function getRoleCounts(tips) {
  return tips.reduce(
    (acc, tip) => {
      acc[tip.kind] = (acc[tip.kind] || 0) + 1
      return acc
    },
    { do: 0, dont: 0 }
  )
}

export function getThreatBreakdown(threats, rosterNames = []) {
  const manual = new Set(threats || [])
  const detected = getEnemyThreats(rosterNames)
  return THREATS.map((threat) => ({
    ...threat,
    manual: manual.has(threat.id),
    detected: detected.has(threat.id),
    active: manual.has(threat.id) || detected.has(threat.id),
    count: rosterNames.filter((name) => (rosterEntry(name)?.tags || []).includes(threat.id)).length
  }))
}

export function situationSummary(situation = {}) {
  const labels = {
    behind: 'Atrás no jogo',
    ahead: 'À frente',
    noVision: 'Sem visão no rio',
    enemyMissing: 'Inimigo sumido',
    ultReady: 'Ultimate pronta',
    allyDead: 'Aliado morto'
  }
  return Object.entries(labels)
    .filter(([key]) => situation[key])
    .map(([, label]) => label)
}
