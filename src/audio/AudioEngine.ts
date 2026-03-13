import * as Tone from 'tone'

/**
 * AudioEngine — spatial audio for the experience.
 *
 * Sound is a first-class channel:
 * - Ambient hum of global trade
 * - Rupture: pressure buildup → silence → tension
 * - Domain crossings: tonal shifts
 * - Connection discovery: resonant harmonics
 * - Compression: walls closing sound
 */

type LayerId = 'ambient' | 'rupture' | 'cascade' | 'compression' | 'discovery' | 'fork'

export class AudioEngine {
  private started = false
  private muted = false
  private masterGain: Tone.Gain | null = null
  private layers: Map<LayerId, Tone.ToneAudioNode> = new Map()
  private synths: Map<string, Tone.Synth | Tone.FMSynth | Tone.AMSynth> = new Map()

  async init(): Promise<void> {
    if (this.started) return
    await Tone.start()
    this.started = true

    this.masterGain = new Tone.Gain(0.3).toDestination()

    // Ambient drone — low hum of global trade
    const ambientSynth = new Tone.FMSynth({
      harmonicity: 0.5,
      modulationIndex: 1,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 2, decay: 0, sustain: 1, release: 4 },
      volume: -20,
    }).connect(this.masterGain)
    this.synths.set('ambient', ambientSynth)

    // Tension synth for rupture
    const tensionSynth = new Tone.AMSynth({
      harmonicity: 1.5,
      oscillator: { type: 'triangle' },
      modulation: { type: 'square' },
      envelope: { attack: 0.5, decay: 0.3, sustain: 0.8, release: 2 },
      volume: -15,
    }).connect(this.masterGain)
    this.synths.set('tension', tensionSynth)

    // Discovery chord synth
    const discoverySynth = new Tone.FMSynth({
      harmonicity: 2,
      modulationIndex: 3,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.1, decay: 1, sustain: 0.3, release: 3 },
      volume: -12,
    }).connect(this.masterGain)
    this.synths.set('discovery', discoverySynth)

    // Compression — low rumble
    const compressionSynth = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 1, decay: 0.5, sustain: 0.7, release: 2 },
      volume: -18,
    }).connect(this.masterGain)
    this.synths.set('compression', compressionSynth)
  }

  playAmbient(): void {
    if (!this.started || this.muted) return
    const synth = this.synths.get('ambient') as Tone.FMSynth
    if (synth) synth.triggerAttack('C1')
  }

  stopAmbient(): void {
    const synth = this.synths.get('ambient') as Tone.FMSynth
    if (synth) synth.triggerRelease()
  }

  playRupture(): void {
    if (!this.started || this.muted) return
    // Silence ambient briefly
    const ambient = this.synths.get('ambient') as Tone.FMSynth
    if (ambient) ambient.triggerRelease()

    // Tension tone
    const tension = this.synths.get('tension') as Tone.AMSynth
    if (tension) {
      tension.triggerAttackRelease('E1', 3)
    }

    // Resume ambient after
    setTimeout(() => {
      if (ambient && !this.muted) ambient.triggerAttack('C1')
    }, 3500)
  }

  playDomainCrossing(domain: string): void {
    if (!this.started || this.muted) return
    const notes: Record<string, string> = {
      shipping: 'C3',
      freight: 'E3',
      medicine: 'G3',
      household: 'A3',
    }
    const tension = this.synths.get('tension') as Tone.AMSynth
    if (tension) {
      tension.triggerAttackRelease(notes[domain] || 'C3', 1)
    }
  }

  playDiscoveryChord(): void {
    if (!this.started || this.muted) return
    const synth = this.synths.get('discovery') as Tone.FMSynth
    if (synth) {
      synth.triggerAttackRelease('C4', 2)
      // Delayed second tone — creates the resonant harmonic
      setTimeout(() => {
        synth.triggerAttackRelease('E4', 1.5)
      }, 200)
    }
  }

  playCompression(): void {
    if (!this.started || this.muted) return
    const synth = this.synths.get('compression') as Tone.Synth
    if (synth) {
      synth.triggerAttackRelease('C1', 4)
    }
  }

  playForkSplit(): void {
    if (!this.started || this.muted) return
    const tension = this.synths.get('tension') as Tone.AMSynth
    if (tension) {
      tension.triggerAttackRelease('F#2', 1.5)
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (muted) {
      this.synths.forEach(s => {
        try { s.triggerRelease() } catch { /* ignore */ }
      })
    }
  }

  setVolume(vol: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, vol))
    }
  }

  dispose(): void {
    this.synths.forEach(s => s.dispose())
    this.masterGain?.dispose()
    this.synths.clear()
    this.started = false
  }
}
