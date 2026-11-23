import type { WeatherKind, WorldEventKind } from './config';

class IslandAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private surfGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private ambientStarted = false;
  private nextChirpTimer = 0;
  private surfPhase = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.72;
        this.masterGain.connect(this.ctx.destination);

        // Precompute 2-second filtered noise buffer for surf waves, rain & impacts
        const sampleRate = this.ctx.sampleRate;
        const len = Math.floor(sampleRate * 2);
        const buf = this.ctx.createBuffer(1, len, sampleRate);
        const data = buf.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < len; i += 1) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.04 * white) / 1.04;
          data[i] = lastOut * 2.8;
        }
        this.noiseBuffer = buf;
      } catch {
        return null;
      }
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlockAndStartAmbience(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer || this.ambientStarted) return;
    this.ambientStarted = true;

    try {
      // 1. Ocean surf loop (low-pass modulated brown noise)
      const surfSrc = ctx.createBufferSource();
      surfSrc.buffer = this.noiseBuffer;
      surfSrc.loop = true;

      const surfFilter = ctx.createBiquadFilter();
      surfFilter.type = 'lowpass';
      surfFilter.frequency.value = 340;
      surfFilter.Q.value = 0.7;

      const surfGain = ctx.createGain();
      surfGain.gain.value = 0.06;

      surfSrc.connect(surfFilter);
      surfFilter.connect(surfGain);
      surfGain.connect(this.masterGain);
      surfSrc.start();
      this.surfGain = surfGain;

      // 2. Rain hiss loop (bandpass noise, faded up during rain/storm)
      const rainSrc = ctx.createBufferSource();
      rainSrc.buffer = this.noiseBuffer;
      rainSrc.loop = true;

      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'bandpass';
      rainFilter.frequency.value = 1850;
      rainFilter.Q.value = 0.45;

      const rainGain = ctx.createGain();
      rainGain.gain.value = 0.0001;

      rainSrc.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(this.masterGain);
      rainSrc.start();
      this.rainGain = rainGain;
    } catch {
      this.ambientStarted = false;
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.72, this.ctx.currentTime, 0.06);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.unlockAndStartAmbience();
      this.playClick();
    }
    return this.muted;
  }

  public updateAmbience(
    dt: number,
    weather: WeatherKind,
    nearShore: boolean,
    isNight: boolean,
    isPlaying: boolean
  ): void {
    if (!this.ctx || !this.ambientStarted || this.ctx.state !== 'running' || this.muted) return;

    this.surfPhase += dt * (weather === 'storm' ? 1.15 : 0.65);
    const waveCycle = 0.5 + 0.5 * Math.sin(this.surfPhase);
    const shoreBoost = nearShore ? 1.75 : 0.75;
    const baseSurf = isPlaying ? 0.055 * shoreBoost : 0.032;
    if (this.surfGain) {
      this.surfGain.gain.setTargetAtTime(
        baseSurf * (0.65 + waveCycle * 0.7),
        this.ctx.currentTime,
        0.18
      );
    }

    if (this.rainGain) {
      const targetRain =
        weather === 'storm' ? 0.16 : weather === 'rain' ? 0.095 : 0.0001;
      this.rainGain.gain.setTargetAtTime(targetRain, this.ctx.currentTime, 0.35);
    }

    // Occasional gentle island bird chirp (day) or cricket trill (night)
    this.nextChirpTimer -= dt;
    if (this.nextChirpTimer <= 0 && isPlaying) {
      this.nextChirpTimer = 3.2 + Math.random() * 4.5;
      if (weather === 'clear' || weather === 'fog') {
        if (isNight) {
          this.playCricketChirp();
        } else {
          this.playBirdChirp();
        }
      }
    }
  }

  private playBirdChirp(): void {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;
    const base = 1750 + Math.random() * 550;
    for (let i = 0; i < 2; i += 1) {
      const t = now + i * 0.11;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base * 1.38, t + 0.05);
      osc.frequency.exponentialRampToValueAtTime(base * 0.92, t + 0.09);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.032, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.095);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.1);
    }
  }

  private playCricketChirp(): void {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i += 1) {
      const t = now + i * 0.055;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(3400, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.016, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.042);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.045);
    }
  }

  public playClick(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.055);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playChop(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;

    // Resonant wood thud
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210 + Math.random() * 35, now);
    osc.frequency.exponentialRampToValueAtTime(72, now + 0.11);
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);

    // Crisp wood splinter transient
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1150;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.18, now);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(this.masterGain);
      src.start(now, Math.random() * 0.5, 0.08);
    }
  }

  public playPickup(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.05;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  public playSplash(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(420, now + 0.24);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now, Math.random() * 0.5, 0.27);
  }

  public playCastRod(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(740, now + 0.12);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playWeaponStrike(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playBowShot(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.18);
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playHammerSlam(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.3);
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  public playCook(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(880, now + 0.08);
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playLevelUp(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;
    const freqs = [440, 554.37, 659.25, 880];
    freqs.forEach((f, idx) => {
      const t = now + idx * 0.075;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playThunder(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(220, now);
    lp.frequency.exponentialRampToValueAtTime(75, now + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0, 1.4);
  }

  public playEventAlert(kind: WorldEventKind): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;
    const notes =
      kind === 'tsunami' || kind === 'volcano_eruption'
        ? [293.66, 261.63, 220]
        : [523.25, 659.25, 783.99];
    notes.forEach((f, idx) => {
      const t = now + idx * 0.14;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = kind === 'tsunami' || kind === 'volcano_eruption' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }

  public playHitDamage(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(54, now + 0.18);
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playSecretOpen(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      const t = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  public playSwimSplash(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(640, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now, Math.random() * 0.5, 0.2);
  }

  public playFishEscape(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.22);
    g.gain.setValueAtTime(0.1, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playLightningStrike(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || this.muted || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(1600, now);
    hp.frequency.exponentialRampToValueAtTime(140, now + 0.55);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0, 0.6);
  }
}

export const soundEngine = new IslandAudioEngine();

