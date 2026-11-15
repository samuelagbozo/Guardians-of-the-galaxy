// Voiceover system. Drop recorded files in public/audio/vo/<id>.mp3 and they play automatically.
// Without a file, the caption alone is shown for the line's duration (no browser text-to-speech).
import { sfx } from './audio'
export const VO: Record<string, { text: string; ms: number }> = {
  open: { text: 'Orbit Architect. Design a robotic science mission, then fly it.', ms: 4500 },
  define: { text: 'Mission definition. Choose what you want to learn and where to fly.', ms: 4500 },
  design: { text: 'Spacecraft design. Every instrument costs mass, power, data and money.', ms: 4500 },
  review: { text: 'Flight readiness review. Blockers must clear before launch.', ms: 4000 },
  countdown: { text: 'Main engine start sequence.', ms: 2500 },
  liftoff: { text: 'Liftoff.', ms: 1500 },
  insertion: { text: 'Orbit insertion.', ms: 2000 },
  deploy: { text: 'Deploying spacecraft.', ms: 2500 },
  success: { text: 'Instruments active. Downlink established.', ms: 3000 },
  failure: { text: 'We have lost the signal. Review the cause chain.', ms: 3500 },
}
let busy = false, cur: HTMLAudioElement | null = null
/** Plays one line at a time (no overlapping voiceover) and ducks the sound effects under it. */
export function speak(id: string, caption: (t: string | null) => void) {
  const line = VO[id]; if (!line || busy) return
  busy = true; caption(line.text); sfx.duck(true)
  let finished = false
  const end = () => { if (finished) return; finished = true; busy = false; cur = null; caption(null); sfx.duck(false) }
  const a = new Audio(`/audio/vo/${id}.mp3`); cur = a
  a.onloadedmetadata = () => { a.play().catch(() => {}); setTimeout(end, (a.duration || line.ms / 1000) * 1000 + 200) }
  a.onerror = () => setTimeout(end, line.ms)
}
export const stopVoice = () => { cur?.pause(); busy = false }
