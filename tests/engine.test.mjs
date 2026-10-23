import assert from 'node:assert/strict'
import test from 'node:test'
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
  getObjectiveWindows
} from '../engine.js'
import { TIPS, ROSTER, ROLES, PHASES, THREATS, OBJECTIVES, ROSTER as ROSTER_LIST } from '../data.js'

function objectivesAt(seconds, overrides = {}) {
  return Object.fromEntries(
    OBJECTIVES.map((objective) => [
      objective.id,
      { nextSpawn: objective.time, ...(overrides[objective.id] || {}) }
    ])
  )
}

test('formatClock pads minutes and seconds', () => {
  assert.equal(formatClock(0), '00:00')
  assert.equal(formatClock(65), '01:05')
  assert.equal(formatClock(1080), '18:00')
  assert.equal(formatClock(-4), '00:00')
})

test('getPhase respects boundaries', () => {
  assert.equal(getPhase(0).id, 'prep')
  assert.equal(getPhase(29.9).id, 'prep')
  assert.equal(getPhase(30).id, 'lane')
  assert.equal(getPhase(240).id, 'river')
  assert.equal(getPhase(480).id, 'mid')
  assert.equal(getPhase(720).id, 'late')
  assert.equal(getPhase(1080).id, 'end')
  assert.equal(getPhase(9999).id, 'end')
})

test('getNextWave counts down and never returns zero', () => {
  assert.deepEqual(getNextWave(0), { remaining: 30, number: 1 })
  assert.deepEqual(getNextWave(10), { remaining: 20, number: 1 })
  assert.deepEqual(getNextWave(30), { remaining: 30, number: 2 })
})

test('getObjectiveState distinguishes upcoming, soon, live and done', () => {
  assert.equal(getObjectiveState(240, 100).state, 'upcoming')
  assert.equal(getObjectiveState(240, 200).state, 'soon')
  assert.equal(getObjectiveState(240, 240).state, 'live')
  assert.equal(getObjectiveState(240, 260).state, 'live')
  assert.equal(getObjectiveState(null, 260).state, 'done')
})

test('getNextObjective prefers a live objective over an upcoming one', () => {
  const next = getNextObjective(
    {
      riverboss: { nextSpawn: 240 },
      orochi: { nextSpawn: 480 },
      nen: { nextSpawn: 1080 }
    },
    250
  )
  assert.equal(next.id, 'riverboss')
  assert.equal(next.state, 'live')
})

test('getNextObjective prioritizes Orochi and Nen among live objectives', () => {
  const atOrochi = getNextObjective(
    {
      riverboss: { nextSpawn: 240 },
      orochi: { nextSpawn: 480 },
      nen: { nextSpawn: 1080 }
    },
    500
  )
  assert.equal(atOrochi.id, 'orochi')

  const atNen = getNextObjective(
    {
      riverboss: { nextSpawn: 240 },
      orochi: { nextSpawn: 480 },
      nen: { nextSpawn: 1080 }
    },
    1090
  )
  assert.equal(atNen.id, 'nen')
})

test('getEffectiveThreats merges manual and roster threats', () => {
  const threats = getEffectiveThreats(['poke'], ['Kubinashi', 'Bakekujira'])
  assert.ok(threats.has('poke'))
  assert.ok(threats.has('burst'))
  assert.ok(threats.has('tank'))
  assert.ok(threats.has('cc'))
})

test('live advice is contextual, limited and mixes do and dont', () => {
  const seconds = 250
  const windows = getObjectiveWindows(objectivesAt(seconds), seconds)
  const advice = getLiveAdvice({
    seconds,
    role: 'jungle',
    level: 3,
    threats: ['dive', 'cc'],
    situation: { noVision: true },
    objectiveWindows: windows
  })
  assert.ok(advice.length > 0)
  assert.ok(advice.length <= 3)
  assert.ok(advice.some((tip) => tip.kind === 'do'))
  assert.ok(advice.some((tip) => tip.kind === 'dont'))
  assert.ok(advice.every((tip) => tip.roles.length === 0 || tip.roles.includes('jungle')))
})

test('river boss window unlocks objective advice for every role', () => {
  const seconds = 235
  const windows = getObjectiveWindows(objectivesAt(seconds), seconds)
  const advice = getLiveAdvice({
    seconds,
    role: 'adc',
    level: 2,
    threats: [],
    situation: {},
    objectiveWindows: windows
  })
  assert.ok(advice.some((tip) => tip.objective === 'riverboss'))
})

test('the live Orochi warning appears when Orochi is on the map', () => {
  const seconds = 500
  const windows = getObjectiveWindows(objectivesAt(seconds), seconds)
  const advice = getLiveAdvice({
    seconds,
    role: 'mid',
    level: 3,
    threats: [],
    situation: {},
    objectiveWindows: windows
  })
  assert.ok(advice.some((tip) => tip.id === 'obj-dont-5050-orochi'))
})

test('advanced tips are hidden below advanced level', () => {
  const beginner = getVisibleTips({ role: 'top', level: 1 })
  const advanced = getVisibleTips({ role: 'top', level: 3 })
  assert.ok(!beginner.some((tip) => tip.id === 'adv-slow-push'))
  assert.ok(advanced.some((tip) => tip.id === 'adv-slow-push'))
})

test('visible tips filter by role, phase, kind and search', () => {
  const tips = getVisibleTips({ role: 'support', level: 3, phase: 'river', kind: 'do' })
  assert.ok(tips.length > 0)
  assert.ok(tips.every((tip) => tip.kind === 'do'))
  assert.ok(tips.every((tip) => tip.roles.length === 0 || tip.roles.includes('support')))
  assert.ok(tips.every((tip) => tip.phases.includes('river')))

  const found = getVisibleTips({ role: 'adc', level: 3, search: 'posição' })
  assert.ok(found.some((tip) => tip.id === 'adc-frontline'))
})

test('threat breakdown reports manual and detected sources', () => {
  const breakdown = getThreatBreakdown(['poke'], ['Bakekujira'])
  const cc = breakdown.find((threat) => threat.id === 'cc')
  const poke = breakdown.find((threat) => threat.id === 'poke')
  assert.equal(poke.manual, true)
  assert.equal(poke.active, true)
  assert.equal(cc.detected, true)
  assert.equal(cc.manual, false)
})

test('data keeps ids unique and references valid', () => {
  const ids = TIPS.map((tip) => tip.id)
  assert.equal(new Set(ids).size, ids.length)

  const roleIds = new Set(ROLES.map((role) => role.id))
  const phaseIds = new Set(PHASES.map((phase) => phase.id))
  const threatIds = new Set(THREATS.map((threat) => threat.id))

  for (const tip of TIPS) {
    for (const role of tip.roles || []) assert.ok(roleIds.has(role), `unknown role ${role} in ${tip.id}`)
    for (const phase of tip.phases || []) assert.ok(phaseIds.has(phase), `unknown phase ${phase} in ${tip.id}`)
    for (const threat of tip.threats || []) assert.ok(threatIds.has(threat), `unknown threat ${threat} in ${tip.id}`)
  }

  for (const entry of ROSTER_LIST) {
    assert.ok(roleIds.has(entry.role), `unknown roster role ${entry.role} for ${entry.name}`)
    for (const threat of entry.tags) assert.ok(threatIds.has(threat), `unknown tag ${threat} for ${entry.name}`)
  }

  assert.ok(TIPS.length >= 60)
  assert.ok(ROSTER.length >= 50)
})
