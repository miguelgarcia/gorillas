import type { Explosion, PlayerId } from './core';

const MUSIC_STEP_SECONDS = 60 / 112 / 2;
const MUSIC_LOOKAHEAD_SECONDS = 0.16;
const MUSIC_CHORDS = [
  [48, 55, 60, 63],
  [44, 51, 56, 60],
  [46, 53, 58, 62],
  [43, 50, 55, 58],
] as const;
const ARPEGGIO = [0, 1, 2, 1, 3, 2, 1, 2] as const;

type AudioContextConstructor = new () => AudioContext;
export type AudioPlaybackState =
  | 'waiting'
  | 'playing'
  | 'muted'
  | 'unavailable';

function midiToFrequency(note: number) {
  return 440 * 2 ** ((note - 69) / 12);
}

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const browserWindow = window as typeof window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return window.AudioContext ?? browserWindow.webkitAudioContext ?? null;
}

/** A small, asset-free Web Audio score and effects engine. */
export class GameAudio {
  private context: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private scheduler: ReturnType<typeof setInterval> | null = null;
  private nextMusicNote = 0;
  private musicStep = 0;
  private enabled = true;
  private destroyed = false;
  private unavailable = false;
  private listeners = new Set<(state: AudioPlaybackState) => void>();

  get isEnabled() {
    return this.enabled;
  }

  get playbackState(): AudioPlaybackState {
    if (this.unavailable || this.destroyed) return 'unavailable';
    if (!this.enabled) return 'muted';
    return this.context?.state === 'running' && this.scheduler !== null
      ? 'playing'
      : 'waiting';
  }

  subscribe(listener: (state: AudioPlaybackState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.playbackState));
  }

  async unlock() {
    if (!this.enabled || this.destroyed || this.unavailable) return false;

    try {
      if (!this.context) {
        const AudioContextClass = audioContextConstructor();
        if (!AudioContextClass) {
          this.unavailable = true;
          this.notify();
          return false;
        }

        const context = new AudioContextClass();
        this.context = context;
        const master = context.createGain();
        const compressor = context.createDynamicsCompressor();
        this.musicBus = context.createGain();
        this.effectsBus = context.createGain();

        master.gain.value = 0.72;
        this.musicBus.gain.value = 0.16;
        this.effectsBus.gain.value = 0.7;
        compressor.threshold.value = -14;
        compressor.knee.value = 12;
        compressor.ratio.value = 5;
        compressor.attack.value = 0.004;
        compressor.release.value = 0.18;

        this.musicBus.connect(master);
        this.effectsBus.connect(master);
        master.connect(compressor);
        compressor.connect(context.destination);
        context.onstatechange = () => {
          if (this.destroyed || this.context !== context) return;
          if (context.state === 'running' && this.enabled) this.startMusic();
          else this.stopMusic();
          this.notify();
        };
      }
    } catch {
      this.unavailable = true;
      this.stopMusic();
      if (this.context) {
        this.context.onstatechange = null;
        void this.context.close().catch(() => {});
      }
      this.context = null;
      this.musicBus = null;
      this.effectsBus = null;
      this.notify();
      return false;
    }

    const context = this.context;
    if (context.state !== 'running' && context.state !== 'closed') {
      try {
        // Retry from each gesture: an autoplay resume may remain pending until
        // the browser receives user activation.
        await context.resume();
      } catch {
        if (!this.destroyed) this.notify();
        return false;
      }
    }

    if (this.destroyed || !this.enabled || this.context !== context)
      return false;
    if (context.state !== 'running') {
      this.notify();
      return false;
    }
    this.startMusic();
    this.notify();
    return true;
  }

  setEnabled(enabled: boolean) {
    if (this.destroyed) return;
    this.enabled = enabled;
    const context = this.context;
    const musicBus = this.musicBus;
    const effectsBus = this.effectsBus;
    if (!context || !musicBus || !effectsBus) {
      this.notify();
      return;
    }

    const now = context.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    effectsBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(Math.max(musicBus.gain.value, 0.0001), now);
    effectsBus.gain.setValueAtTime(
      Math.max(effectsBus.gain.value, 0.0001),
      now,
    );
    musicBus.gain.linearRampToValueAtTime(enabled ? 0.16 : 0.0001, now + 0.08);
    effectsBus.gain.linearRampToValueAtTime(enabled ? 0.7 : 0.0001, now + 0.04);

    if (enabled) {
      if (context.state === 'running') this.startMusic();
    } else {
      this.stopMusic();
    }
    this.notify();
  }

  playShot() {
    void this.withRunningContext((context, effectsBus) => {
      const start = context.currentTime;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const filter = context.createBiquadFilter();

      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(760, start);
      oscillator.frequency.exponentialRampToValueAtTime(135, start + 0.24);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2100, start);
      filter.frequency.exponentialRampToValueAtTime(520, start + 0.24);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(0.24, start + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);

      oscillator.connect(filter);
      filter.connect(envelope);
      envelope.connect(effectsBus);
      oscillator.start(start);
      oscillator.stop(start + 0.26);

      this.scheduleTone(95, start, 0.12, 0.16, 'square', effectsBus, 145);
    });
  }

  playExplosion(kind: Explosion['kind']) {
    void this.withRunningContext((context, effectsBus) => {
      const start = context.currentTime;
      const duration = kind === 'gorilla' ? 0.72 : 0.52;
      const noise = context.createBufferSource();
      const noiseFilter = context.createBiquadFilter();
      const noiseEnvelope = context.createGain();
      const frameCount = Math.ceil(context.sampleRate * duration);
      const buffer = context.createBuffer(1, frameCount, context.sampleRate);
      const samples = buffer.getChannelData(0);

      for (let index = 0; index < samples.length; index += 1) {
        const decay = 1 - index / samples.length;
        samples[index] = (Math.random() * 2 - 1) * decay;
      }

      noise.buffer = buffer;
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(
        kind === 'gorilla' ? 1800 : 1250,
        start,
      );
      noiseFilter.frequency.exponentialRampToValueAtTime(100, start + duration);
      noiseEnvelope.gain.setValueAtTime(0.0001, start);
      noiseEnvelope.gain.exponentialRampToValueAtTime(
        kind === 'gorilla' ? 0.78 : 0.58,
        start + 0.008,
      );
      noiseEnvelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseEnvelope);
      noiseEnvelope.connect(effectsBus);
      noise.start(start);

      this.scheduleTone(
        kind === 'gorilla' ? 82 : 70,
        start,
        duration * 0.82,
        kind === 'gorilla' ? 0.72 : 0.56,
        'sine',
        effectsBus,
        34,
      );
      if (kind === 'gorilla') {
        this.scheduleTone(
          390,
          start + 0.025,
          0.22,
          0.18,
          'square',
          effectsBus,
          92,
        );
      }
    });
  }

  playVictory(winner: PlayerId) {
    void this.withRunningContext((context, effectsBus) => {
      const start = context.currentTime + 0.035;
      const transpose = winner === 0 ? 0 : 2;
      const melody = [60, 64, 67, 72, 67, 72, 76];
      const lengths = [0.14, 0.14, 0.18, 0.28, 0.14, 0.18, 0.48];
      let cursor = start;

      this.duckMusic(start, 1.75);
      melody.forEach((note, index) => {
        const duration = lengths[index];
        this.scheduleTone(
          midiToFrequency(note + transpose),
          cursor,
          duration,
          0.25,
          'square',
          effectsBus,
        );
        if (index === 3 || index === melody.length - 1) {
          this.scheduleTone(
            midiToFrequency(note - 12 + transpose),
            cursor,
            duration,
            0.22,
            'triangle',
            effectsBus,
          );
        }
        cursor += duration;
      });
    });
  }

  destroy() {
    this.destroyed = true;
    this.stopMusic();
    if (this.context && this.context.state !== 'closed') {
      this.context.onstatechange = null;
      void this.context.close().catch(() => {});
    }
    this.context = null;
    this.musicBus = null;
    this.effectsBus = null;
    this.listeners.clear();
  }

  private async withRunningContext(
    effect: (context: AudioContext, effectsBus: GainNode) => void,
  ) {
    if (!(await this.unlock())) return;
    if (!this.context || !this.effectsBus || !this.enabled) return;
    effect(this.context, this.effectsBus);
  }

  private startMusic() {
    if (
      this.scheduler !== null ||
      !this.context ||
      !this.enabled ||
      this.destroyed
    )
      return;
    this.nextMusicNote = this.context.currentTime + 0.045;
    this.scheduleMusic();
    this.scheduler = setInterval(() => this.scheduleMusic(), 50);
  }

  private stopMusic() {
    if (this.scheduler !== null) clearInterval(this.scheduler);
    this.scheduler = null;
  }

  private scheduleMusic() {
    const context = this.context;
    const musicBus = this.musicBus;
    if (!context || !musicBus || context.state !== 'running' || !this.enabled) {
      return;
    }

    // Background tabs may throttle timers; resume at the present rather than
    // scheduling an entire backlog of notes in the past.
    this.nextMusicNote = Math.max(this.nextMusicNote, context.currentTime);

    while (this.nextMusicNote < context.currentTime + MUSIC_LOOKAHEAD_SECONDS) {
      const chord =
        MUSIC_CHORDS[Math.floor(this.musicStep / 8) % MUSIC_CHORDS.length];
      const chordStep = this.musicStep % 8;
      const lead = chord[ARPEGGIO[chordStep]];

      this.scheduleTone(
        midiToFrequency(lead + 12),
        this.nextMusicNote,
        MUSIC_STEP_SECONDS * 0.72,
        chordStep === 0 ? 0.09 : 0.06,
        'square',
        musicBus,
      );
      if (chordStep % 2 === 0) {
        this.scheduleTone(
          midiToFrequency(chord[0] - 12),
          this.nextMusicNote,
          MUSIC_STEP_SECONDS * 1.45,
          0.14,
          'triangle',
          musicBus,
        );
      }

      this.musicStep = (this.musicStep + 1) % 32;
      this.nextMusicNote += MUSIC_STEP_SECONDS;
    }
  }

  private scheduleTone(
    frequency: number,
    start: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    destination: AudioNode,
    endFrequency = frequency,
  ) {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const attackEnd = start + Math.min(0.012, duration * 0.2);
    const releaseStart = start + duration * 0.62;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);
    if (endFrequency !== frequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, endFrequency),
        start + duration,
      );
    }
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, volume),
      attackEnd,
    );
    envelope.gain.setValueAtTime(Math.max(0.0001, volume * 0.82), releaseStart);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  private duckMusic(start: number, duration: number) {
    const musicBus = this.musicBus;
    if (!musicBus) return;
    musicBus.gain.cancelScheduledValues(start);
    musicBus.gain.setValueAtTime(Math.max(0.0001, musicBus.gain.value), start);
    musicBus.gain.linearRampToValueAtTime(0.035, start + 0.04);
    musicBus.gain.setValueAtTime(0.035, start + duration - 0.25);
    musicBus.gain.linearRampToValueAtTime(0.16, start + duration);
  }
}
