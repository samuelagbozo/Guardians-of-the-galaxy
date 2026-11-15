// Pure, generic engine: no DOM, no content-id branching. Randomness comes from a seeded RNG.
import { OBJECTIVES, ORBITS, INSTRUMENTS, POWER, ANTENNAS, BUSES, LAUNCHERS, Part } from './data'

export type Sel = { objectiveId: string; orbitId: string; instrumentIds: string[]; powerId: string; antennaId: string; busId: string; launchId: string }
export type Margin = { key: string; label: string; required: number; available: number; text: string }
export type Level = 'green' | 'yellow' | 'red'
export type Review = {
  margins: Margin[]; blockers: string[]; warnings: string[]; level: Level
  worst: { label: string; pct: number }; canLaunch: boolean
}
export type Roll = { event: string; probability: number; roll: number; triggered: boolean }
export type LaunchResult = {
  seed: string; rolls: Roll[]; outcome: 'success' | 'partial-success' | 'failure'
  score: { total: number; cats: { label: string; points: number; note: string }[] }
  verdict: { title: string; text: string }; causeChain: string[]
}

export const usd = (x: number) => `$${Math.round(x / 1e6)}M`
const n = (x: number) => Math.round(x * 100) / 100
type Key = 'massKg' | 'powerW' | 'dataRateMbps' | 'volumeM3' | 'costUsd'
const sum = (a: Part[], k: Key) => a.reduce((s, x) => s + x[k], 0)

function resolve(s: Sel) {
  const obj = OBJECTIVES.find(o => o.id === s.objectiveId)!
  const orbit = ORBITS.find(o => o.id === s.orbitId)!
  const ins = s.instrumentIds.map(id => INSTRUMENTS.find(i => i.id === id)!).filter(Boolean)
  const pw = POWER.find(x => x.id === s.powerId)!
  const ant = ANTENNAS.find(x => x.id === s.antennaId)!
  const bus = BUSES.find(x => x.id === s.busId)!
  const lv = LAUNCHERS.find(x => x.id === s.launchId)!
  return { obj, orbit, ins, pw, ant, bus, lv }
}

export function evaluate(s: Sel): Review {
  const { obj, orbit, ins, pw, ant, bus, lv } = resolve(s)
  const parts = [...ins, pw, ant, bus]
  const mass = sum(parts, 'massKg'), vol = sum(parts, 'volumeM3'), cost = sum(parts, 'costUsd') + lv.costUsd
  const pReq = sum(ins, 'powerW') + ant.powerW + bus.powerW, dReq = sum(ins, 'dataRateMbps')
  const capKg = lv.capKg! * orbit.factor
  const margins: Margin[] = [
    { key: 'mass', label: 'Mass vs launch capacity', required: mass, available: capKg, text: `${n(mass)} / ${n(capKg)} kg` },
    { key: 'volume', label: 'Volume vs fairing', required: vol, available: lv.capM3!, text: `${n(vol)} / ${n(lv.capM3!)} m³` },
    { key: 'power', label: 'Power balance', required: pReq, available: pw.powerW, text: `${n(pReq)} / ${n(pw.powerW)} W` },
    { key: 'data', label: 'Data balance', required: dReq, available: ant.dataRateMbps, text: `${n(dReq)} / ${n(ant.dataRateMbps)} Mbps` },
    { key: 'cost', label: 'Budget', required: cost, available: obj.budgetUsd, text: `${usd(cost)} / ${usd(obj.budgetUsd)}` },
  ]
  const blockers: string[] = [], warnings: string[] = []
  if (!ins.length) blockers.push('No instruments selected. The mission has nothing to measure.')
  if (mass > capKg) blockers.push(`Launch fit: ${lv.name} can lift only ${n(capKg)} kg to ${orbit.name}, but the spacecraft weighs ${n(mass)} kg (${n(mass - capKg)} kg too heavy).`)
  if (vol > lv.capM3!) blockers.push(`Launch fit: spacecraft volume ${n(vol)} m³ exceeds the fairing of ${n(lv.capM3!)} m³ by ${n(vol - lv.capM3!)} m³.`)
  const payKg = sum(ins, 'massKg') + pw.massKg + ant.massKg, payM3 = sum(ins, 'volumeM3') + pw.volumeM3 + ant.volumeM3
  if (payKg > bus.payKg!) blockers.push(`Bus capacity: payload mass ${n(payKg)} kg exceeds ${bus.name} limit of ${bus.payKg} kg by ${n(payKg - bus.payKg!)} kg.`)
  if (payM3 > bus.payM3!) blockers.push(`Bus capacity: payload volume ${n(payM3)} m³ exceeds ${bus.name} limit of ${bus.payM3} m³ by ${n(payM3 - bus.payM3!)} m³.`)
  if (cost > obj.budgetUsd) blockers.push(`Budget: total cost ${usd(cost)} exceeds the ${usd(obj.budgetUsd)} budget by ${usd(cost - obj.budgetUsd)}.`)
  if (pReq > pw.powerW) warnings.push(`Power balance: demand ${n(pReq)} W exceeds supply ${n(pw.powerW)} W by ${n(pReq - pw.powerW)} W. Instruments will run at reduced duty.`)
  if (dReq > ant.dataRateMbps) warnings.push(`Data balance: instruments produce ${n(dReq)} Mbps but the antenna sends only ${n(ant.dataRateMbps)} Mbps (${n(dReq - ant.dataRateMbps)} Mbps lost).`)
  const ratio = (m: Margin) => (m.available > 0 ? (m.available - m.required) / m.available : -1)
  const rs = ['mass', 'power', 'data'].map(k => margins.find(m => m.key === k)!).map(m => ({ m, r: m.key === 'data' && dReq === 0 ? 1 : ratio(m) }))
  const w = rs.reduce((a, b) => (b.r < a.r ? b : a))
  if (w.r >= 0 && w.r < 0.15) warnings.push(`Thin margin: ${w.m.label} has only ${n(w.r * 100)}% spare. Small surprises could hurt.`)
  const level: Level = w.r < 0.05 ? 'red' : w.r < 0.15 ? 'yellow' : 'green'
  return { margins, blockers, warnings, level, worst: { label: w.m.label, pct: n(w.r * 100) }, canLaunch: blockers.length === 0 }
}

function rng(seed: string) {
  let h = 1779033703
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function runLaunch(s: Sel, ev: Review, seed: string): LaunchResult {
  const { obj, ins, pw, ant, lv } = resolve(s)
  const rnd = rng(seed)
  const p = ev.level === 'green' ? 0.05 : ev.level === 'yellow' ? 0.15 : 0.3
  const defs = [
    { event: 'Launch vehicle anomaly', probability: 1 - lv.rel! },
    { event: 'Power dip', probability: p },
    { event: 'Instrument fault', probability: p },
    { event: 'Comms loss', probability: p },
  ]
  const rolls: Roll[] = defs.map(d => { const roll = rnd(); return { ...d, roll, triggered: roll < d.probability } })
  const launchFail = rolls[0].triggered
  const hits = rolls.slice(1).filter(r => r.triggered).length
  const outcome = launchFail || hits >= 2 ? 'failure' : hits === 1 ? 'partial-success' : 'success'
  const mult = outcome === 'success' ? 1 : outcome === 'partial-success' ? 0.6 : 0.1
  const sci = sum(ins.map(i => ({ ...i, massKg: i.science ?? 0 })), 'massKg')
  const pReq = sum(ins, 'powerW') + ant.powerW + resolve(s).bus.powerW, dReq = sum(ins, 'dataRateMbps')
  const pf = pReq > 0 ? Math.min(1, pw.powerW / pReq) : 0, df = dReq > 0 ? Math.min(1, ant.dataRateMbps / dReq) : 0
  const cost = evaluate(s).margins.find(m => m.key === 'cost')!.required
  const cats = [
    { label: 'Science return', points: Math.round(sci * pf * df * mult), note: `Instrument value × power ${Math.round(pf * 100)}% × data ${Math.round(df * 100)}% × outcome ${mult}` },
    { label: 'Budget efficiency', points: Math.round(20 * Math.max(0, Math.min(1, 1 - cost / obj.budgetUsd))), note: `Spent ${usd(cost)} of ${usd(obj.budgetUsd)}` },
    { label: 'Margin discipline', points: ev.level === 'green' ? 20 : ev.level === 'yellow' ? 10 : 0, note: `Worst margin ${ev.worst.pct}% (${ev.worst.label})` },
    { label: 'Mission outcome', points: outcome === 'success' ? 30 : outcome === 'partial-success' ? 10 : 0, note: outcome },
  ]
  const sound = ev.level !== 'red'
  const verdict = sound && hits === 0 && !launchFail ? { title: 'Skill', text: 'Sound design and no bad luck. You earned this result.' }
    : sound ? { title: 'Sound design, unlucky roll', text: 'Your margins were healthy. Spaceflight is risky even for good designs.' }
    : outcome === 'success' ? { title: 'Lucky escape', text: 'Reckless margins survived on luck. Do not rely on that.' }
    : { title: 'Reckless design', text: 'Thin margins raised the odds of failure and they caught up with you.' }
  const causeChain = [
    `Smallest margin: ${ev.worst.label} at ${ev.worst.pct}% → ${ev.level.toUpperCase()} zone → each event odds ${Math.round(p * 100)}%.`,
    ...rolls.map(r => `${r.event}: odds ${(r.probability * 100).toFixed(1)}%, rolled ${r.roll.toFixed(3)} → ${r.triggered ? 'TRIGGERED' : 'avoided'}.`),
    `Result: ${outcome.replace('-', ' ')}.`,
  ]
  return { seed, rolls, outcome, score: { total: cats.reduce((a, c) => a + c.points, 0), cats }, verdict, causeChain }
}
