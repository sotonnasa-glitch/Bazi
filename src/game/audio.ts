import type { WeatherKind, WorldEventKind } from './config';

export interface DynamicAudioEnv {
  dangerLevel?: number;
  mysticLevel?: number;
  activeEvent?: WorldEventKind;
}

class IslandAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private surfGain: GainNode | null = null;
  private surfFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private fireGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private calmLayerGain: GainNode | null = null;
  private mysticLayerGain: GainNode | null = null;
  private dangerLayerGain: GainNode | null = null;
  private dangerFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private ambientStarted = false;
  private nextChirpTimer = 0;
  private nextCrackleTimer = 0;
  private nextMusicNoteTimer = 0.6;
  private musicStepIdx = 0;
  private surfPhase = 0;
  private currentDanger = 0;
  private currentMystic = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      try {
        const ctx = new AudioCtx();
        this.ctx = ctx;

        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -16;
        compressor.knee.value = 18;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.008;
        compressor.release.value = 0.22;

        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.78;
        this.masterGain.connect(compressor);
        compressor.connect(ctx.destination);

        // Dry SFX bus + subtle warm feedback delay reverb bus
        this.sfxBus = ctx.createGain();
        this.sfxBus.gain.value = 1.0;
        this.sfxBus.connect(this.masterGain);

        const delayL = ctx.createDelay(0.5);
        delayL.delayTime.value = 0.085;
        const delayFb = ctx.createGain();
        delayFb.gain.value = 0.24;
        const revLp = ctx.createBiquadFilter();
        revLp.type = 'lowpass';
        revLp.frequency.value = 2400;
        const revOut = ctx.createGain();
        revOut.gain.value = 0.22;

        this.reverbSend = ctx.createGain();
        this.reverbSend.gain.value = 0.35;
        this.reverbSend.connect(delayL);
        delayL.connect(revLp);
        revLp.connect(delayFb);
        delayFb.connect(delayL);
        revLp.connect(revOut);
        revOut.connect(this.masterGain);

        // Precompute 2.5-second warm pink/brown noise buffer for waves, wind, crackle & impacts
        const sampleRate = ctx.sampleRate;
        const len = Math.floor(sampleRate * 2.5);
        const buf = ctx.createBuffer(1, len, sampleRate);
        const data = buf.getChannelData(0);
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        for (let i = 0; i < len; i += 1) {
          const white = Math.random() * 2 - 1;
          b0 = 0.997 * b0 + white * 0.029;
          b1 = 0.985 * b1 + white * 0.032;
          b2 = 0.95 * b2 + white * 0.048;
          data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2) * 1.9));
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
      // 1. Ocean surf loop (modulated low-pass wave swells)
      const surfSrc = ctx.createBufferSource();
      surfSrc.buffer = this.noiseBuffer;
      surfSrc.loop = true;

      const surfFilter = ctx.createBiquadFilter();
      surfFilter.type = 'lowpass';
      surfFilter.frequency.value = 360;
      surfFilter.Q.value = 0.85;

      const surfGain = ctx.createGain();
      surfGain.gain.value = 0.05;

      surfSrc.connect(surfFilter);
      surfFilter.connect(surfGain);
      surfGain.connect(this.masterGain);
      surfSrc.start();
      this.surfGain = surfGain;
      this.surfFilter = surfFilter;

      // 2. Rain shimmer loop
      const rainSrc = ctx.createBufferSource();
      rainSrc.buffer = this.noiseBuffer;
      rainSrc.loop = true;

      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'bandpass';
      rainFilter.frequency.value = 2100;
      rainFilter.Q.value = 0.5;

      const rainGain = ctx.createGain();
      rainGain.gain.value = 0.0001;

      rainSrc.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(this.masterGain);
      rainSrc.start();
      this.rainGain = rainGain;
      this.rainFilter = rainFilter;

      // 3. Island breeze / storm wind bed
      const windSrc = ctx.createBufferSource();
      windSrc.buffer = this.noiseBuffer;
      windSrc.loop = true;

      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 460;
      windFilter.Q.value = 1.6;

      const windGain = ctx.createGain();
      windGain.gain.value = 0.0001;

      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(this.masterGain);
      windSrc.start();
      this.windGain = windGain;
      this.windFilter = windFilter;

      // 4. Campfire warm bed
      const fireSrc = ctx.createBufferSource();
      fireSrc.buffer = this.noiseBuffer;
      fireSrc.loop = true;

      const fireFilter = ctx.createBiquadFilter();
      fireFilter.type = 'bandpass';
      fireFilter.frequency.value = 920;
      fireFilter.Q.value = 0.9;

      const fireGain = ctx.createGain();
      fireGain.gain.value = 0.0001;

      fireSrc.connect(fireFilter);
      fireFilter.connect(fireGain);
      fireGain.connect(this.masterGain);
      fireSrc.start();
      this.fireGain = fireGain;

      // 5. Dynamic Adaptive Music Bed (Calm Tropical Pad + Night/Temple Mystic Layer + Danger Tension Layer)
      const musicFilter = ctx.createBiquadFilter();
      musicFilter.type = 'lowpass';
      musicFilter.frequency.value = 2400;
      const musicBus = ctx.createGain();
      musicBus.gain.value = 0.65;
      musicFilter.connect(musicBus);
      musicBus.connect(this.masterGain);
      if (this.reverbSend) {
        musicBus.connect(this.reverbSend);
      }
      this.musicFilter = musicFilter;
      this.musicBus = musicBus;

      // Calm daytime warm chord pad (D3 + A3)
      const calmLayerGain = ctx.createGain();
      calmLayerGain.gain.value = 0.0001;
      calmLayerGain.connect(musicFilter);
      for (const freq of [146.83, 220.0]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = freq < 180 ? 0.55 : 0.35;
        osc.connect(g);
        g.connect(calmLayerGain);
        osc.start();
      }
      this.calmLayerGain = calmLayerGain;

      // Night / Ancient Temple mystical fifth pad (A2 + E3)
      const mysticLayerGain = ctx.createGain();
      mysticLayerGain.gain.value = 0.0001;
      mysticLayerGain.connect(musicFilter);
      for (const freq of [110.0, 164.81]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = 0.38;
        osc.connect(g);
        g.connect(mysticLayerGain);
        osc.start();
      }
      this.mysticLayerGain = mysticLayerGain;

      // Danger proximity low tension drone (D2 + F2)
      const dangerFilter = ctx.createBiquadFilter();
      dangerFilter.type = 'lowpass';
      dangerFilter.frequency.value = 320;
      const dangerLayerGain = ctx.createGain();
      dangerLayerGain.gain.value = 0.0001;
      dangerFilter.connect(dangerLayerGain);
      dangerLayerGain.connect(musicFilter);
      for (const freq of [73.42, 87.31]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = 0.32;
        osc.connect(g);
        g.connect(dangerFilter);
        osc.start();
      }
      this.dangerFilter = dangerFilter;
      this.dangerLayerGain = dangerLayerGain;
    } catch {
      this.ambientStarted = false;
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.78, this.ctx.currentTime, 0.06);
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

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    peakGain: number,
    startTimeOffset = 0,
    sendReverb = true,
    filterHz = 5200
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted) return;
    const t0 = ctx.currentTime + startTimeOffset;
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(24, freqStart), t0);
    if (Math.abs(freqEnd - freqStart) > 0.5) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, freqEnd), t0 + duration);
    }

    lp.type = 'lowpass';
    lp.frequency.value = filterHz;

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peakGain, t0 + Math.min(0.015, duration * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(lp);
    lp.connect(g);
    g.connect(this.sfxBus);
    if (sendReverb && this.reverbSend) {
      g.connect(this.reverbSend);
    }
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  public updateAmbience(
    dt: number,
    weather: WeatherKind,
    nearShore: boolean,
    isNight: boolean,
    isPlaying: boolean,
    nearCampfire = false,
    env?: DynamicAudioEnv
  ): void {
    if (!this.ctx || !this.ambientStarted || this.ctx.state !== 'running' || this.muted) return;

    const now = this.ctx.currentTime;
    const rawDanger = Math.max(0, Math.min(1, env?.dangerLevel ?? 0));
    const rawMystic = Math.max(0, Math.min(1, env?.mysticLevel ?? (isNight ? 0.55 : 0)));
    this.currentDanger += (rawDanger - this.currentDanger) * Math.min(1, dt * 2.5);
    this.currentMystic += (rawMystic - this.currentMystic) * Math.min(1, dt * 2.0);

    const rainIntensity = weather === 'storm' ? 1.0 : weather === 'rain' ? 0.62 : 0;
    this.surfPhase += dt * (weather === 'storm' ? 1.15 : 0.62);
    const waveCycle = 0.5 + 0.5 * Math.sin(this.surfPhase);
    const shoreBoost = nearShore ? 1.65 : 0.72;
    const baseSurf = isPlaying ? 0.05 * shoreBoost : 0.028;

    if (this.surfGain) {
      this.surfGain.gain.setTargetAtTime(baseSurf * (0.62 + waveCycle * 0.75), now, 0.2);
    }
    if (this.surfFilter) {
      this.surfFilter.frequency.setTargetAtTime(260 + waveCycle * 220, now, 0.25);
    }

    if (this.rainGain) {
      const targetRain = weather === 'storm' ? 0.145 : weather === 'rain' ? 0.088 : 0.0001;
      this.rainGain.gain.setTargetAtTime(targetRain, now, 0.35);
    }
    if (this.rainFilter) {
      this.rainFilter.frequency.setTargetAtTime(1650 + rainIntensity * 1150, now, 0.35);
    }

    if (this.windGain) {
      const targetWind =
        weather === 'storm'
          ? 0.09
          : weather === 'fog'
            ? 0.032
            : isPlaying
              ? 0.014 + this.currentDanger * 0.018
              : 0.006;
      this.windGain.gain.setTargetAtTime(targetWind, now, 0.35);
    }
    if (this.windFilter) {
      this.windFilter.frequency.setTargetAtTime(420 + this.currentDanger * 220 + rainIntensity * 180, now, 0.4);
    }

    if (this.fireGain) {
      this.fireGain.gain.setTargetAtTime(nearCampfire && isPlaying ? 0.048 : 0.0001, now, 0.2);
    }

    // Dynamic music bus mixing based on weather intensity, time of day, mystic temple proximity & danger
    if (this.musicBus && this.musicFilter) {
      const targetBus = isPlaying ? 0.68 : 0.28;
      this.musicBus.gain.setTargetAtTime(targetBus, now, 0.4);
      const filterHz = Math.max(850, 2600 - rainIntensity * 950 - (isNight ? 320 : 0) + this.currentDanger * 420);
      this.musicFilter.frequency.setTargetAtTime(filterHz, now, 0.45);
    }

    if (this.calmLayerGain) {
      const calmTarget =
        isPlaying && !isNight
          ? Math.max(0.002, 0.032 * (1 - this.currentDanger * 0.85) * (1 - this.currentMystic * 0.45))
          : 0.008;
      this.calmLayerGain.gain.setTargetAtTime(calmTarget, now, 0.5);
    }

    if (this.mysticLayerGain) {
      const nightFactor = isNight ? 0.72 : 0;
      const mysticMix = Math.max(nightFactor, this.currentMystic);
      const mysticTarget = isPlaying ? Math.max(0.0001, mysticMix * 0.036 * (1 - this.currentDanger * 0.4)) : 0.004;
      this.mysticLayerGain.gain.setTargetAtTime(mysticTarget, now, 0.45);
    }

    if (this.dangerLayerGain && this.dangerFilter) {
      const dangerTarget = isPlaying && this.currentDanger > 0.08 ? this.currentDanger * 0.055 : 0.0001;
      this.dangerLayerGain.gain.setTargetAtTime(dangerTarget, now, 0.28);
      const pulse = 0.5 + 0.5 * Math.sin(this.surfPhase * 4.5);
      this.dangerFilter.frequency.setTargetAtTime(220 + this.currentDanger * 460 + pulse * 180 * this.currentDanger, now, 0.15);
    }

    // Procedural Adaptive Music Motifs (Tropical Marimba by day / Mystical Temple chimes by night / Urgent pulse in danger)
    if (isPlaying) {
      this.nextMusicNoteTimer -= dt;
      if (this.nextMusicNoteTimer <= 0) {
        this.musicStepIdx += 1;
        if (this.currentDanger >= 0.45) {
          this.nextMusicNoteTimer = 0.46 + (1 - this.currentDanger) * 0.24;
          const dangerScale = [146.83, 155.56, 174.61, 220.0];
          const note = dangerScale[this.musicStepIdx % dangerScale.length];
          this.playMusicNote(note, 0.28, 'triangle', 0.026 * (0.6 + this.currentDanger * 0.6), 1100);
        } else if (isNight || this.currentMystic >= 0.45) {
          this.nextMusicNoteTimer = 0.95 + Math.random() * 0.65;
          const mysticScale = [329.63, 392.0, 440.0, 493.88, 659.25];
          const note = mysticScale[(this.musicStepIdx * 3) % mysticScale.length];
          this.playMusicNote(note, 0.65, 'sine', 0.022, 2400);
        } else {
          this.nextMusicNoteTimer = 0.8 + Math.random() * 0.55;
          const dayScale = [293.66, 329.63, 392.0, 440.0, 587.33];
          const note = dayScale[(this.musicStepIdx * 2) % dayScale.length];
          const rainSoft = 1 - rainIntensity * 0.35;
          this.playMusicNote(note, 0.42, 'sine', 0.024 * rainSoft, 2800 - rainIntensity * 900);
        }
      }
    }

    // Campfire spark pop
    if (nearCampfire && isPlaying) {
      this.nextCrackleTimer -= dt;
      if (this.nextCrackleTimer <= 0) {
        this.nextCrackleTimer = 0.25 + Math.random() * 0.75;
        this.playTone(
          1400 + Math.random() * 1400,
          420,
          0.032,
          'triangle',
          0.025,
          0,
          true,
          2800
        );
      }
    }

    // Tropical birds in daylight or soft cricket chorus at night
    this.nextChirpTimer -= dt;
    if (this.nextChirpTimer <= 0 && isPlaying) {
      this.nextChirpTimer = 3.0 + Math.random() * 4.2;
      if (weather === 'clear' || weather === 'fog') {
        if (isNight) {
          this.playCricketChirp();
        } else {
          this.playBirdChirp();
        }
      }
    }
  }

  private playMusicNote(
    freq: number,
    duration: number,
    type: OscillatorType,
    peakGain: number,
    filterHz: number
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || this.muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    lp.type = 'lowpass';
    lp.frequency.value = filterHz;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peakGain, t0 + 0.035);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.musicBus);
    osc.start(t0);
    osc.stop(t0 + duration + 0.04);
  }

  private playBirdChirp(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted) return;
    const base = 1650 + Math.random() * 520;
    const phrase = [1, 1.25, 1.12];
    phrase.forEach((mult, idx) => {
      this.playTone(base * mult, base * mult * 1.18, 0.075, 'sine', 0.026, idx * 0.085, true, 4800);
    });
  }

  private playCricketChirp(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted) return;
    for (let i = 0; i < 4; i += 1) {
      this.playTone(3250, 3180, 0.036, 'sine', 0.015, i * 0.052, true, 4400);
    }
  }

  public playClick(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playTone(760, 480, 0.05, 'sine', 0.09, 0, false, 3200);
    this.playTone(1140, 880, 0.035, 'triangle', 0.04, 0.008, false, 3600);
  }

  public playChop(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted) return;
    const now = ctx.currentTime;

    // Warm hollow wood body knock + sub punch
    const pitchJitter = 0.92 + Math.random() * 0.16;
    this.playTone(195 * pitchJitter, 68, 0.12, 'triangle', 0.24, 0, true, 1600);
    this.playTone(390 * pitchJitter, 160, 0.065, 'sine', 0.12, 0, true, 2200);

    // Crisp wood splinter crack
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1420 * pitchJitter;
      bp.Q.value = 1.2;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.15, now);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(this.sfxBus);
      src.start(now, Math.random() * 0.8, 0.075);
    }
  }

  public playPickup(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    // Warm marimba-like major arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      this.playTone(freq, freq * 1.005, 0.16, 'sine', 0.095, idx * 0.042, true, 4200);
      this.playTone(freq * 2, freq * 2, 0.07, 'triangle', 0.025, idx * 0.042, true, 4800);
    });
  }

  public playSplash(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1150, now);
    filter.frequency.exponentialRampToValueAtTime(360, now + 0.28);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    if (this.reverbSend) g.connect(this.reverbSend);
    src.start(now, Math.random() * 0.8, 0.32);

    // Cheerful water-drop plop + catch chime
    this.playTone(420, 860, 0.1, 'sine', 0.09, 0.04, true, 3200);
    this.playTone(783.99, 1046.5, 0.14, 'sine', 0.06, 0.08, true, 3800);
  }

  public playCastRod(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playTone(280, 840, 0.13, 'sine', 0.075, 0, true, 3200);
    this.playTone(620, 340, 0.07, 'sine', 0.045, 0.13, true, 2400);
  }

  public playWeaponStrike(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted) return;
    const now = ctx.currentTime;
    this.playTone(420, 125, 0.11, 'triangle', 0.14, 0, true, 2400);
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(2200, now);
      hp.frequency.exponentialRampToValueAtTime(600, now + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.11, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
      src.connect(hp);
      hp.connect(g);
      g.connect(this.sfxBus);
      src.start(now, Math.random() * 0.6, 0.1);
    }
  }

  public playBowShot(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playTone(540, 175, 0.16, 'triangle', 0.14, 0, true, 2800);
    this.playTone(980, 420, 0.08, 'sine', 0.06, 0.02, true, 3600);
  }

  public playHammerSlam(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted) return;
    const now = ctx.currentTime;
    this.playTone(150, 38, 0.34, 'sine', 0.34, 0, true, 900);
    this.playTone(220, 62, 0.22, 'triangle', 0.16, 0, true, 1200);
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(750, now);
      lp.frequency.exponentialRampToValueAtTime(140, now + 0.28);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      src.connect(lp);
      lp.connect(g);
      g.connect(this.sfxBus);
      src.start(now, 0, 0.3);
    }
  }

  public playCook(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playTone(587.33, 587.33, 0.12, 'sine', 0.09, 0, true, 3600);
    this.playTone(880, 880, 0.18, 'sine', 0.11, 0.07, true, 3800);
  }

  public playLevelUp(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    const freqs = [440, 554.37, 659.25, 880, 1108.73];
    freqs.forEach((f, idx) => {
      this.playTone(f, f * 1.003, 0.32, 'triangle', 0.11, idx * 0.072, true, 4600);
      this.playTone(f * 0.5, f * 0.5, 0.28, 'sine', 0.08, idx * 0.072, true, 2400);
    });
  }

  public playThunder(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(280, now);
    lp.frequency.exponentialRampToValueAtTime(65, now + 1.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(0.28, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.sfxBus);
    if (this.reverbSend) g.connect(this.reverbSend);
    src.start(now, 0, 1.55);
  }

  public playEarthquake(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    this.playTone(68, 36, 0.85, 'sine', 0.24, 0, true, 320);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 140;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.sfxBus);
    src.start(now, 0.2, 1.0);
  }

  public playPredatorGrowl(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playTone(135, 78, 0.28, 'sawtooth', 0.085, 0, true, 780);
    this.playTone(195, 110, 0.22, 'triangle', 0.06, 0.02, true, 900);
  }

  public playEventAlert(kind: WorldEventKind): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    const isDanger =
      kind === 'tsunami' ||
      kind === 'volcano_eruption' ||
      kind === 'earthquake' ||
      kind === 'lightning_storm';
    const notes = isDanger ? [329.63, 293.66, 220] : [523.25, 659.25, 783.99];
    notes.forEach((f, idx) => {
      this.playTone(f, f, 0.32, isDanger ? 'triangle' : 'sine', 0.13, idx * 0.13, true, 2600);
      this.playTone(f * 0.5, f * 0.5, 0.34, 'sine', 0.08, idx * 0.13, true, 1600);
    });
  }

  public playHitDamage(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playTone(175, 52, 0.2, 'triangle', 0.24, 0, true, 1100);
    this.playTone(260, 88, 0.14, 'sawtooth', 0.09, 0, false, 950);
  }

  public playSecretOpen(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, idx) => {
      this.playTone(f, f, 0.36, 'sine', 0.13, idx * 0.075, true, 4800);
      this.playTone(f * 1.5, f * 1.5, 0.2, 'triangle', 0.035, idx * 0.075, true, 4800);
    });
  }

  public playSwimSplash(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(680, now);
    filter.frequency.exponentialRampToValueAtTime(290, now + 0.19);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    src.start(now, Math.random() * 0.6, 0.22);
    this.playTone(340, 210, 0.1, 'sine', 0.04, 0.02, true, 1600);
  }

  public playFishEscape(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playTone(520, 220, 0.22, 'sine', 0.09, 0, true, 2400);
  }

  public playLightningStrike(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    this.playTone(190, 48, 0.22, 'sawtooth', 0.14, 0, true, 1400);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(1900, now);
    hp.frequency.exponentialRampToValueAtTime(120, now + 0.62);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.64);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.sfxBus);
    if (this.reverbSend) g.connect(this.reverbSend);
    src.start(now, 0, 0.66);
  }

  public playFireIgnite(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    // Flint spark strike
    this.playTone(1850, 920, 0.06, 'triangle', 0.11, 0, false, 4800);
    // Warm rising flame whoosh
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, now + 0.04);
    filter.frequency.exponentialRampToValueAtTime(1400, now + 0.36);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    src.start(now + 0.02, 0.1, 0.54);
    [392, 493.88, 587.33].forEach((f, idx) => {
      this.playTone(f, f * 1.02, 0.28, 'sine', 0.08, 0.08 + idx * 0.05, true, 2600);
    });
  }

  public playPlaneCutscene(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    // Sputtering twin propeller engine + cabin warning beeps
    for (let i = 0; i < 6; i += 1) {
      const delay = i * 0.44;
      this.playTone(96 - i * 4, 68 - i * 3, 0.36, 'sawtooth', 0.085, delay, false, 420);
      if (i % 2 === 0) {
        this.playTone(880, 660, 0.14, 'square', 0.035, delay + 0.1, false, 1800);
      }
    }
  }

  public playPlaneCrash(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    this.playTone(112, 32, 0.48, 'sawtooth', 0.26, 0, true, 850);
    this.playTone(480, 140, 0.22, 'square', 0.08, 0.04, false, 1400);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.72);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.76);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    if (this.reverbSend) g.connect(this.reverbSend);
    src.start(now, 0, 0.78);
  }

  public playPoisonHiss(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3200, now);
    bp.frequency.exponentialRampToValueAtTime(1800, now + 0.34);
    bp.Q.value = 3.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxBus);
    src.start(now, 0.2, 0.38);
    this.playTone(620, 290, 0.2, 'sawtooth', 0.06, 0.04, false, 2200);
  }

  public playCraftSuccess(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    [523.25, 659.25, 987.77].forEach((f, idx) => {
      this.playTone(f, f, 0.24, 'triangle', 0.11, idx * 0.065, true, 4200);
    });
  }

  public playTempleUnlock(): void {
    this.unlockAndStartAmbience();
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted) return;
    const now = ctx.currentTime;
    // Ancient stone slab sliding rumble
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(160, now);
      lp.frequency.linearRampToValueAtTime(240, now + 0.9);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.01, now);
      g.gain.linearRampToValueAtTime(0.24, now + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);
      src.connect(lp);
      lp.connect(g);
      g.connect(this.sfxBus);
      if (this.reverbSend) g.connect(this.reverbSend);
      src.start(now, 0, 1.3);
    }
    // Mystic golden sanctuary arpeggio
    [293.66, 440, 587.33, 659.25, 880, 1174.66].forEach((freq, idx) => {
      this.playTone(freq, freq * 1.004, 0.48, 'triangle', 0.12, 0.16 + idx * 0.095, true, 4800);
    });
  }
}

export const soundEngine = new IslandAudioEngine();
export const audioManager = soundEngine;
