/**
 * All sound is synthesised. No audio files, so nothing can fail to load on a
 * conference-room wifi connection five minutes before the demo, and there is
 * nothing to license.
 *
 * Every method is a no-op if the WebAudio context is unavailable or blocked by
 * autoplay policy, so the game stays playable and silent rather than throwing.
 */

export type Ambience = 'rain' | 'room' | 'night' | 'none'
export type Sting = 'clue' | 'deduction' | 'deny' | 'confirm' | 'locked' | 'win' | 'lose'
/** `tense` is the theme with a heartbeat under it. */
export type Music = 'off' | 'theme' | 'tense'

/** 56 beats a minute, four to the bar: slow enough to think over. */
const BEAT = 60 / 56
const BAR = BEAT * 4

/** Four bars in D minor that never quite resolve. Bass root, then the chord above it. */
const CHORDS: { root: number; notes: number[] }[] = [
  { root: 73.42, notes: [174.61, 220.0, 261.63, 329.63] }, // Dm9
  { root: 98.0, notes: [174.61, 233.08, 293.66] }, // Gm7
  { root: 116.54, notes: [220.0, 293.66, 349.23] }, // Bbmaj7
  { root: 110.0, notes: [196.0, 233.08, 277.18] }, // A7b9
]

/** D minor pentatonic, for the few high notes that drift over the top. */
const MELODY = [440.0, 523.25, 587.33, 698.46, 783.99, 880.0]

export class Audio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bed: GainNode | null = null
  private noise: AudioBuffer | null = null
  private nodes: { disconnect(): void; stop?: () => void }[] = []
  private lastTick = 0
  private current: Ambience = 'none'
  private music: GainNode | null = null
  private echo: DelayNode | null = null
  private musicMode: Music = 'off'
  private musicTimer: number | null = null
  private nextBar = 0
  private bar = 0
  private lastThunder = -10

  muted = false

  /** Must be called from a user gesture or the context stays suspended. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return

    try {
      this.ctx = new Ctor()
    } catch {
      this.ctx = null
      return
    }

    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.5
    this.master.connect(this.ctx.destination)

    this.bed = this.ctx.createGain()
    this.bed.gain.value = 0
    this.bed.connect(this.master)

    const seconds = 2
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

    void this.ctx.resume()
    // Music may have been asked for before there was a context to play it in.
    this.startMusic()
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05)
    }
    return this.muted
  }

  /** Swap the ambient bed. Idempotent, so calling it per frame is free. */
  setAmbience(kind: Ambience): void {
    if (kind === this.current) return
    this.current = kind
    const ctx = this.ctx
    const bed = this.bed
    if (!ctx || !bed) return

    for (const node of this.nodes) {
      try {
        node.stop?.()
      } catch {
        /* already stopped */
      }
      node.disconnect()
    }
    this.nodes = []

    bed.gain.cancelScheduledValues(ctx.currentTime)
    bed.gain.setTargetAtTime(0, ctx.currentTime, 0.12)
    if (kind === 'none') return

    if (kind === 'rain' || kind === 'night') this.addRain(kind === 'night' ? 0.05 : 0.1)
    this.addDrone(kind === 'room' ? 78 : 52, kind === 'room' ? 0.05 : 0.035)

    bed.gain.setTargetAtTime(1, ctx.currentTime + 0.15, 0.5)
  }

  private addRain(level: number): void {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true

    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 1400
    band.Q.value = 0.35

    const gain = ctx.createGain()
    gain.gain.value = level

    src.connect(band).connect(gain).connect(this.bed!)
    src.start()
    this.nodes.push(src, band, gain)
  }

  /** Two slightly detuned voices. The beating is what makes it feel uneasy. */
  private addDrone(hz: number, level: number): void {
    const ctx = this.ctx!
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 320
    const gain = ctx.createGain()
    gain.gain.value = level
    lp.connect(gain).connect(this.bed!)

    for (const [freq, detune] of [
      [hz, 0],
      [hz, 7],
      [hz * 2, -5],
    ] as const) {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = freq
      osc.detune.value = detune
      osc.connect(lp)
      osc.start()
      this.nodes.push(osc)
    }
    this.nodes.push(lp, gain)
  }

  /** Typewriter tick. Throttled, or fast text turns into a buzz. */
  tick(): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const now = ctx.currentTime
    if (now - this.lastTick < 0.035) return
    this.lastTick = now

    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2400
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.05, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03)
    src.connect(hp).connect(gain).connect(this.master)
    src.start(now)
    src.stop(now + 0.04)
  }

  /** One-shot tone. Frequencies are hand-picked, not generated. */
  private blip(freq: number, dur: number, level: number, type: OscillatorType, delay = 0): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(level, t + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  sting(kind: Sting): void {
    if (!this.ctx) return
    switch (kind) {
      case 'clue':
        this.blip(620, 0.07, 0.06, 'square')
        this.blip(930, 0.09, 0.05, 'square', 0.07)
        break
      case 'deduction':
        this.blip(180, 0.5, 0.07, 'sawtooth')
        this.blip(268, 0.42, 0.04, 'triangle', 0.03)
        break
      case 'deny':
        this.blip(196, 0.16, 0.06, 'square')
        this.blip(203, 0.16, 0.05, 'square')
        break
      case 'confirm':
        this.blip(392, 0.12, 0.06, 'triangle')
        this.blip(587, 0.24, 0.05, 'triangle', 0.09)
        break
      case 'locked':
        this.blip(110, 0.22, 0.06, 'square')
        break
      case 'win':
        this.blip(262, 0.5, 0.05, 'triangle')
        this.blip(392, 0.6, 0.045, 'triangle', 0.12)
        this.blip(523, 0.9, 0.04, 'triangle', 0.26)
        break
      case 'lose':
        this.blip(147, 1.1, 0.06, 'sawtooth')
        this.blip(139, 1.2, 0.05, 'sawtooth', 0.05)
        break
    }
  }

  // ---- thunder ---------------------------------------------------------------

  /**
   * One roll of thunder: a crack, then a long rumble that falls in pitch as it
   * fades. Call it when the lightning flashes. It arrives a moment late, as
   * thunder does, and ignores a second flash that comes too soon after, unless
   * `force` says this one matters.
   */
  thunder(force = false): void {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.noise) return
    if (!force && ctx.currentTime - this.lastThunder < 6) return
    this.lastThunder = ctx.currentTime
    const t = ctx.currentTime + 0.35 + Math.random() * 0.5
    const length = 3.4 + Math.random() * 1.2

    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(1100, t)
    lp.frequency.exponentialRampToValueAtTime(90, t + length)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.55, t + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.35)
    // The rumble swells once or twice on its way out.
    gain.gain.linearRampToValueAtTime(0.26, t + length * 0.35)
    gain.gain.linearRampToValueAtTime(0.1, t + length * 0.55)
    gain.gain.linearRampToValueAtTime(0.15, t + length * 0.7)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
    src.connect(lp).connect(gain).connect(this.master)
    src.start(t)
    src.stop(t + length + 0.1)

    // Something felt more than heard, underneath.
    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(58, t)
    sub.frequency.exponentialRampToValueAtTime(34, t + length)
    const subGain = ctx.createGain()
    subGain.gain.setValueAtTime(0.0001, t)
    subGain.gain.exponentialRampToValueAtTime(0.22, t + 0.08)
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + length * 0.8)
    sub.connect(subGain).connect(this.master)
    sub.start(t)
    sub.stop(t + length)
  }

  // ---- music ---------------------------------------------------------------------

  /**
   * Background music, generated a bar at a time: a slow bass, a soft chord, and
   * now and then a high note with an echo on it. Idempotent, and safe to call
   * before the first click; it starts as soon as the browser allows sound.
   */
  setMusic(mode: Music): void {
    if (mode === this.musicMode) return
    this.musicMode = mode
    if (mode === 'off') this.stopMusic()
    else this.startMusic()
  }

  private startMusic(): void {
    const ctx = this.ctx
    if (!ctx || !this.master || this.musicMode === 'off' || this.musicTimer !== null) return

    if (!this.music) {
      this.music = ctx.createGain()
      this.music.gain.value = 0
      this.music.connect(this.master)
      // A single repeating echo, which is most of what makes it sound like a room.
      this.echo = ctx.createDelay(1)
      this.echo.delayTime.value = BEAT * 0.75
      const feedback = ctx.createGain()
      feedback.gain.value = 0.34
      this.echo.connect(feedback).connect(this.echo)
      this.echo.connect(this.music)
    }
    this.music.gain.cancelScheduledValues(ctx.currentTime)
    this.music.gain.setTargetAtTime(0.9, ctx.currentTime, 1.2)

    this.nextBar = ctx.currentTime + 0.2
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 200)
    this.scheduleMusic()
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer)
    this.musicTimer = null
    if (this.music && this.ctx) {
      this.music.gain.cancelScheduledValues(this.ctx.currentTime)
      this.music.gain.setTargetAtTime(0, this.ctx.currentTime, 0.6)
    }
  }

  /** Keep a little more than half a second of music queued ahead of the clock. */
  private scheduleMusic(): void {
    const ctx = this.ctx
    if (!ctx) return
    // A tab left in the background falls behind. Skip ahead instead of catching up in a burst.
    if (this.nextBar < ctx.currentTime - BAR) this.nextBar = ctx.currentTime + 0.1
    while (this.nextBar < ctx.currentTime + 0.6) {
      this.scheduleBar(this.nextBar, this.bar)
      this.nextBar += BAR
      this.bar += 1
    }
  }

  private scheduleBar(t: number, bar: number): void {
    const chord = CHORDS[bar % CHORDS.length]!

    // The chord: slow in, held, gone by the next bar.
    for (const freq of chord.notes) this.voice(freq, t, BAR * 0.98, 0.016, 'triangle', 0.9, 700)

    // Bass on one and three, with a pickup every other bar.
    this.voice(chord.root, t, BEAT * 1.8, 0.11, 'sine', 0.02, 400)
    this.voice(chord.root * 1.5, t + BEAT * 2, BEAT * 1.5, 0.07, 'sine', 0.02, 400)
    if (bar % 2 === 1) this.voice(chord.root * 2, t + BEAT * 3.5, BEAT * 0.5, 0.05, 'sine', 0.02, 400)

    // A high note or two, chosen by the bar number so the tune is the same each time round.
    const pattern = (bar * 7 + 3) % 16
    if (pattern % 3 !== 0) {
      this.voice(MELODY[pattern % MELODY.length]!, t + BEAT * (0.5 + (pattern % 2)), 2.4, 0.03, 'sine', 0.01, 2600, true)
    }
    if (pattern % 5 === 1) {
      this.voice(MELODY[(pattern + 2) % MELODY.length]!, t + BEAT * 2.5, 2.0, 0.022, 'sine', 0.01, 2600, true)
    }

    // Once the case has locked: a heartbeat under everything.
    if (this.musicMode === 'tense') {
      for (const at of [0, BEAT * 2]) {
        this.thump(t + at, 0.13)
        this.thump(t + at + 0.3, 0.08)
      }
    }
  }

  /** One note of the music, with its own envelope. `wet` sends it through the echo. */
  private voice(
    freq: number,
    t: number,
    dur: number,
    level: number,
    type: OscillatorType,
    attack: number,
    cutoff: number,
    wet = false,
  ): void {
    const ctx = this.ctx
    if (!ctx || !this.music) return
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = cutoff
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(level, t + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(lp).connect(gain).connect(this.music)
    if (wet && this.echo) gain.connect(this.echo)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  private thump(t: number, level: number): void {
    const ctx = this.ctx
    if (!ctx || !this.music) return
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(62, t)
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.16)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(level, t + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    osc.connect(gain).connect(this.music)
    osc.start(t)
    osc.stop(t + 0.26)
  }
}

export const audio = new Audio()