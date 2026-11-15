// Procedural sound (Web Audio, no files). Call sfx.init() from a click.
let ctx: AudioContext | null = null, master: GainNode | null = null, muted = false, buf: AudioBuffer | null = null
const layers: Record<string, { g: GainNode }> = {}
const LAYERS: Record<string, [BiquadFilterType, number, number]> = { // type, frequency, peak gain
  wind: ['bandpass', 500, 0.10], space: ['lowpass', 140, 0.14], rumble: ['lowpass', 190, 1.0], hiss: ['highpass', 3500, 0.35], burn: ['lowpass', 420, 0.7],
}
function noise() {
  if (!ctx) return null
  if (!buf) { buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1 }
  const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s
}
export const sfx = {
  init() {
    if (!ctx) { ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.45; master.connect(ctx.destination) }
    void ctx.resume()
  },
  setMuted(m: boolean) { muted = m; if (master) master.gain.value = m ? 0 : 0.45 },
  /** Fade a looping noise layer to a level 0..1 (0 stops it audibly). */
  layer(name: keyof typeof LAYERS, level: number, secs = 0.4) {
    if (!ctx || !master) return
    let l = layers[name]
    if (!l) {
      const [type, f, peak] = LAYERS[name], s = noise()!, flt = ctx.createBiquadFilter(), g = ctx.createGain()
      flt.type = type; flt.frequency.value = f; flt.Q.value = name === 'wind' ? 0.6 : 0.7; g.gain.value = 0
      s.connect(flt); flt.connect(g); g.connect(master); s.start()
      if (name === 'space') { const o = ctx.createOscillator(); o.frequency.value = 52; o.connect(g); o.start() }
      l = layers[name] = { g }; (l as any).peak = peak
    }
    l.g.gain.setTargetAtTime(level * (l as any).peak, ctx.currentTime, secs / 3)
  },
  /** Lower sound effects while a voice line plays. */
  duck(on: boolean) { if (ctx && master && !muted) master.gain.setTargetAtTime(on ? 0.2 : 0.45, ctx.currentTime, 0.15) },
  stopAll() { Object.keys(layers).forEach(k => this.layer(k as any, 0, 0.3)) },
  beep(freq = 880, dur = 0.12, vol = 0.25) {
    if (!ctx || !master) return
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = freq
    g.gain.setValueAtTime(vol, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur)
  },
  thunk() {
    if (!ctx || !master) return
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.4)
    g.gain.setValueAtTime(0.7, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + 0.55)
  },
  radio() { [1200, 1600, 1000].forEach((f, i) => setTimeout(() => this.beep(f, 0.07, 0.15), i * 90)) },
  /** Run a layer at a level for a while then fade it out. */
  burst(name: keyof typeof LAYERS, level: number, ms: number) { this.layer(name, level, 0.3); setTimeout(() => this.layer(name, 0, 0.6), ms) },
}
