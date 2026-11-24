import type { WeaponId, WeatherKind, WorldEventKind } from './config';

export interface DynamicAudioEnv {
  dangerLevel?: number;
  mysticLevel?: number;
  activeEvent?: WorldEventKind;
  fireLevel?: number;
  screen?: 'loading' | 'title' | 'cutscene' | 'ending_cutscene' | 'playing';
}

export interface WeatherAmbienceProfile {
  effectiveWeather: WeatherKind;
  rainIntensity: number;
  rainGain: number;
  rainFilterHz: number;
  windGain: number;
  windFilterHz: number;
  windGustSpeed: number;
  windGustDepth: number;
  windHowlGain: number;
  windHowlHz: number;
  surfGain: number;
  surfCycleSpeed: number;
  surfFilterBaseHz: number;
  surfFilterSpanHz: number;
  surfFoamGain: number;
  surfFoamFilterHz: number;
}

export function computeWeatherAmbienceProfile(
  weather: WeatherKind,
  opts: {
    nearShore: boolean;
    isPlaying: boolean;
    dangerLevel?: number;
    activeEvent?: WorldEventKind;
  }
): WeatherAmbienceProfile {
  const effectiveWeather: WeatherKind =
    opts.activeEvent === 'lightning_storm' && weather !== 'storm' ? 'storm' : weather;
  const danger = Math.max(0, Math.min(1, opts.dangerLevel ?? 0));
  const shoreBoost = opts.nearShore ? 1.65 : 0.72;
  const coastWindBoost = opts.nearShore ? 1.18 : 0.94;
  const playScale = opts.isPlaying ? 1.0 : 0.68;
  const isTsunami = opts.activeEvent === 'tsunami';
  const isAutumnBreeze = opts.activeEvent === 'autumn_breeze';

  let rainIntensity = 0;
  let rainGain = 0.0001;
  let rainFilterHz = 1650;

  let baseWind = 0.015;
  let windFilterHz = 420;
  let windGustSpeed = 0.48;
  let windGustDepth = 0.22;
  let windHowlGain = 0.0001;
  let windHowlHz = 440;

  let surfWeatherMult = 1.0;
  let surfCycleSpeed = 0.58;
  let surfFilterBaseHz = 250;
  let surfFilterSpanHz = 190;
  let surfFoamGain = 0.004;
  let surfFoamFilterHz = 1250;

  if (effectiveWeather === 'rain') {
    rainIntensity = 0.65;
    rainGain = 0.092;
    rainFilterHz = 2350;

    baseWind = 0.048;
    windFilterHz = 640;
    windGustSpeed = 0.95;
    windGustDepth = 0.36;
    windHowlGain = 0.0065;
    windHowlHz = 510;

    surfWeatherMult = 1.42;
    surfCycleSpeed = 0.88;
    surfFilterBaseHz = 320;
    surfFilterSpanHz = 270;
    surfFoamGain = 0.014;
    surfFoamFilterHz = 1520;
  } else if (effectiveWeather === 'storm') {
    rainIntensity = 1.0;
    rainGain = 0.155;
    rainFilterHz = 2950;

    baseWind = 0.118;
    windFilterHz = 860;
    windGustSpeed = 1.55;
    windGustDepth = 0.48;
    windHowlGain = 0.024;
    windHowlHz = 650;

    surfWeatherMult = 1.95;
    surfCycleSpeed = 1.32;
    surfFilterBaseHz = 410;
    surfFilterSpanHz = 440;
    surfFoamGain = 0.032;
    surfFoamFilterHz = 1850;
  } else if (effectiveWeather === 'fog') {
    baseWind = 0.028;
    windFilterHz = 340;
    windGustSpeed = 0.34;
    windGustDepth = 0.16;

    surfWeatherMult = 0.84;
    surfCycleSpeed = 0.46;
    surfFilterBaseHz = 210;
    surfFilterSpanHz = 140;
    surfFoamGain = 0.002;
    surfFoamFilterHz = 1050;
  }

  if (isAutumnBreeze) {
    baseWind *= 1.32;
    windFilterHz += 110;
    windGustDepth = Math.min(0.55, windGustDepth + 0.12);
    windHowlGain = Math.max(windHowlGain, 0.005);
  }

  if (isTsunami) {
    surfWeatherMult *= 1.48;
    surfCycleSpeed *= 1.35;
    surfFilterBaseHz += 110;
    surfFilterSpanHz += 180;
    surfFoamGain *= 1.65;
  }

  const windGain =
    (baseWind * coastWindBoost + danger * (effectiveWeather === 'clear' ? 0.018 : 0.012)) *
    (opts.isPlaying ? 1.0 : 0.72);
  const surfGain = (opts.isPlaying ? 0.052 * shoreBoost : 0.036) * surfWeatherMult;

  return {
    effectiveWeather,
    rainIntensity,
    rainGain: opts.isPlaying ? rainGain : rainGain * 0.65,
    rainFilterHz,
    windGain,
    windFilterHz: windFilterHz + danger * 180,
    windGustSpeed,
    windGustDepth,
    windHowlGain: windHowlGain * playScale,
    windHowlHz,
    surfGain,
    surfCycleSpeed,
    surfFilterBaseHz,
    surfFilterSpanHz,
    surfFoamGain: surfFoamGain * (opts.nearShore ? 1.35 : 0.75) * playScale,
    surfFoamFilterHz,
  };
}

export type FootstepSurface = 'sand' | 'grass' | 'rock' | 'water' | 'wood';

class IslandAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private surfGain: GainNode | null = null;
  private surfFilter: BiquadFilterNode | null = null;
  private surfFoamGain: GainNode | null = null;
  private surfFoamFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windHowlGain: GainNode | null = null;
  private windHowlFilter: BiquadFilterNode | null = null;
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
  private nextMusicNoteTimer = 0.5;
  private nextBassTimer = 0.25;
  private musicStepIdx = 0;
  private surfPhase = 0;
  private gustPhase = 0;
  private smoothWindLevel = 0.015;
  private smoothSurfLevel = 0.04;
  private smoothRainLevel = 0.0001;
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
        compressor.threshold.value = -15;
        compressor.knee.value = 18;
        compressor.ratio.value = 3.8;
        compressor.attack.value = 0.006;
        compressor.release.value = 0.22;

        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.8;
        this.masterGain.connect(compressor);
        compressor.connect(ctx.destination);

        this.sfxBus = ctx.createGain();
        this.sfxBus.gain.value = 1.0;
        this.sfxBus.connect(this.masterGain);

        // Stereo-feeling warm feedback delay reverb bus
        const delayL = ctx.createDelay(0.6);
        delayL.delayTime.value = 0.095;
        const delayR = ctx.createDelay(0.6);
        delayR.delayTime.value = 0.145;
        const delayFb = ctx.createGain();
        delayFb.gain.value = 0.22;
        const revLp = ctx.createBiquadFilter();
        revLp.type = 'lowpass';
        revLp.frequency.value = 2600;
        const revOut = ctx.createGain();
        revOut.gain.value = 0.24;

        this.reverbSend = ctx.createGain();
        this.reverbSend.gain.value = 0.36;
        this.reverbSend.connect(delayL);
        this.reverbSend.connect(delayR);
        delayL.connect(revLp);
        delayR.connect(revLp);
        revLp.connect(delayFb);
        delayFb.connect(delayL);
        revLp.connect(revOut);
        revOut.connect(this.masterGain);

        // Precompute 3-second warm pink/brown noise buffer for ocean surf, rain, wind, fire & foley
        const sampleRate = ctx.sampleRate;
        const len = Math.floor(sampleRate * 3.0);
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
      // 1. Ocean surf loop + wave crest foam hiss
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

      const surfFoamFilter = ctx.createBiquadFilter();
      surfFoamFilter.type = 'bandpass';
      surfFoamFilter.frequency.value = 1350;
      surfFoamFilter.Q.value = 0.9;
      const surfFoamGain = ctx.createGain();
      surfFoamGain.gain.value = 0.002;
      surfSrc.connect(surfFoamFilter);
      surfFoamFilter.connect(surfFoamGain);
      surfFoamGain.connect(this.masterGain);

      surfSrc.start();
      this.surfGain = surfGain;
      this.surfFilter = surfFilter;
      this.surfFoamGain = surfFoamGain;
      this.surfFoamFilter = surfFoamFilter;

      // 2. Rain patter loop
      const rainSrc = ctx.createBufferSource();
      rainSrc.buffer = this.noiseBuffer;
      rainSrc.loop = true;
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'bandpass';
      rainFilter.frequency.value = 2100;
      rainFilter.Q.value = 0.55;
      const rainGain = ctx.createGain();
      rainGain.gain.value = 0.0001;
      rainSrc.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(this.masterGain);
      rainSrc.start();
      this.rainGain = rainGain;
      this.rainFilter = rainFilter;

      // 3. Island breeze / storm wind bed + resonant wind gust howl
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

      const windHowlFilter = ctx.createBiquadFilter();
      windHowlFilter.type = 'bandpass';
      windHowlFilter.frequency.value = 560;
      windHowlFilter.Q.value = 5.2;
      const windHowlGain = ctx.createGain();
      windHowlGain.gain.value = 0.0001;
      windSrc.connect(windHowlFilter);
      windHowlFilter.connect(windHowlGain);
      windHowlGain.connect(this.masterGain);

      windSrc.start();
      this.windGain = windGain;
      this.windFilter = windFilter;
      this.windHowlGain = windHowlGain;
      this.windHowlFilter = windHowlFilter;

      // 4. Campfire hearth crackle bed
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

      // 5. Adaptive Multi-Layer Soundtrack Bus
      const musicFilter = ctx.createBiquadFilter();
      musicFilter.type = 'lowpass';
      musicFilter.frequency.value = 2500;
      const musicBus = ctx.createGain();
      musicBus.gain.value = 0.68;
      musicFilter.connect(musicBus);
      musicBus.connect(this.masterGain);
      if (this.reverbSend) {
        musicBus.connect(this.reverbSend);
      }
      this.musicFilter = musicFilter;
      this.musicBus = musicBus;

      const calmLayerGain = ctx.createGain();
      calmLayerGain.gain.value = 0.0001;
      calmLayerGain.connect(musicFilter);
      for (const freq of [146.83, 220.0, 293.66]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = freq < 180 ? 0.48 : 0.24;
        osc.connect(g);
        g.connect(calmLayerGain);
        osc.start();
      }
      this.calmLayerGain = calmLayerGain;

      const mysticLayerGain = ctx.createGain();
      mysticLayerGain.gain.value = 0.0001;
      mysticLayerGain.connect(musicFilter);
      for (const freq of [110.0, 164.81, 246.94]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = freq < 180 ? 0.34 : 0.18;
        osc.connect(g);
        g.connect(mysticLayerGain);
        osc.start();
      }
      this.mysticLayerGain = mysticLayerGain;

      const dangerFilter = ctx.createBiquadFilter();
      dangerFilter.type = 'lowpass';
      dangerFilter.frequency.value = 340;
      const dangerLayerGain = ctx.createGain();
      dangerLayerGain.gain.value = 0.0001;
      dangerFilter.connect(dangerLayerGain);
      dangerLayerGain.connect(musicFilter);
      for (const freq of [73.42, 87.31]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = 0.3;
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
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
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
    g.gain.linearRampToValueAtTime(peakGain, t0 + Math.min(0.014, duration * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(lp);
    lp.connect(g);
    g.connect(this.sfxBus);
    if (sendReverb && this.reverbSend) {
      g.connect(this.reverbSend);
    }
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  private playNoiseBurst(
    duration: number,
    filterType: BiquadFilterType,
    freqStart: number,
    freqEnd: number,
    peakGain: number,
    q = 1.0,
    offset = 0,
    sendReverb = false
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || !this.noiseBuffer || this.muted) return;
    const t0 = ctx.currentTime + offset;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(Math.max(40, freqStart), t0);
    if (Math.abs(freqEnd - freqStart) > 1) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + duration);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peakGain, t0 + Math.min(0.02, duration * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    if (sendReverb && this.reverbSend) {
      g.connect(this.reverbSend);
    }
    src.start(t0, Math.random() * 1.4, duration + 0.03);
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

    // Synchronize wind, ocean surf, and rain dynamically with current weather state
    const profile = computeWeatherAmbienceProfile(weather, {
      nearShore,
      isPlaying,
      dangerLevel: this.currentDanger,
      activeEvent: env?.activeEvent,
    });
    const weatherSmoothing = Math.min(1, dt * 1.45);
    this.smoothWindLevel += (profile.windGain - this.smoothWindLevel) * weatherSmoothing;
    this.smoothSurfLevel += (profile.surfGain - this.smoothSurfLevel) * weatherSmoothing;
    this.smoothRainLevel += (profile.rainGain - this.smoothRainLevel) * weatherSmoothing;

    const rainIntensity = profile.rainIntensity;
    this.surfPhase += dt * profile.surfCycleSpeed;
    this.gustPhase += dt * profile.windGustSpeed;

    const waveCycle = 0.5 + 0.5 * Math.sin(this.surfPhase);
    const waveCrest = waveCycle * waveCycle;
    const gustWave =
      0.5 +
      0.34 * Math.sin(this.gustPhase) +
      0.16 * Math.sin(this.gustPhase * 2.37 + 1.1);

    if (this.surfGain) {
      this.surfGain.gain.setTargetAtTime(
        this.smoothSurfLevel * (0.58 + waveCycle * 0.82),
        now,
        0.22
      );
    }
    if (this.surfFilter) {
      this.surfFilter.frequency.setTargetAtTime(
        profile.surfFilterBaseHz + waveCycle * profile.surfFilterSpanHz,
        now,
        0.25
      );
    }
    if (this.surfFoamGain && this.surfFoamFilter) {
      this.surfFoamGain.gain.setTargetAtTime(
        Math.max(0.0001, profile.surfFoamGain * (0.25 + waveCrest * 1.15)),
        now,
        0.22
      );
      this.surfFoamFilter.frequency.setTargetAtTime(
        profile.surfFoamFilterHz + waveCrest * 480,
        now,
        0.25
      );
    }

    if (this.rainGain) {
      this.rainGain.gain.setTargetAtTime(Math.max(0.0001, this.smoothRainLevel), now, 0.35);
    }
    if (this.rainFilter) {
      this.rainFilter.frequency.setTargetAtTime(profile.rainFilterHz, now, 0.35);
    }

    if (this.windGain) {
      const gustMod = 1 - profile.windGustDepth * 0.45 + gustWave * profile.windGustDepth;
      this.windGain.gain.setTargetAtTime(Math.max(0.0001, this.smoothWindLevel * gustMod), now, 0.28);
    }
    if (this.windFilter) {
      this.windFilter.frequency.setTargetAtTime(
        profile.windFilterHz + gustWave * 210,
        now,
        0.35
      );
    }
    if (this.windHowlGain && this.windHowlFilter) {
      const howlPulse = Math.max(0, gustWave - 0.35) / 0.65;
      this.windHowlGain.gain.setTargetAtTime(
        Math.max(0.0001, profile.windHowlGain * (0.3 + howlPulse * 1.1)),
        now,
        0.28
      );
      this.windHowlFilter.frequency.setTargetAtTime(
        profile.windHowlHz + gustWave * 190,
        now,
        0.32
      );
    }

    if (this.fireGain) {
      const fireBoost = Math.min(1.65, 1 + Math.max(0, (env?.fireLevel ?? 1) - 1) * 0.14);
      this.fireGain.gain.setTargetAtTime(nearCampfire && isPlaying ? 0.048 * fireBoost : 0.0001, now, 0.2);
    }

    if (this.musicBus && this.musicFilter) {
      const targetBus = isPlaying ? 0.7 : 0.44;
      this.musicBus.gain.setTargetAtTime(targetBus, now, 0.4);
      const filterHz = Math.max(
        850,
        2650 - rainIntensity * 950 - (isNight ? 320 : 0) + this.currentDanger * 420
      );
      this.musicFilter.frequency.setTargetAtTime(filterHz, now, 0.45);
    }

    if (this.calmLayerGain) {
      const calmTarget =
        !isNight
          ? Math.max(
              0.004,
              (isPlaying ? 0.032 : 0.022) *
                (1 - this.currentDanger * 0.85) *
                (1 - this.currentMystic * 0.45)
            )
          : 0.008;
      this.calmLayerGain.gain.setTargetAtTime(calmTarget, now, 0.5);
    }

    if (this.mysticLayerGain) {
      const nightFactor = isNight ? 0.72 : 0;
      const mysticMix = Math.max(nightFactor, this.currentMystic);
      const mysticTarget = isPlaying
        ? Math.max(0.0001, mysticMix * 0.038 * (1 - this.currentDanger * 0.4))
        : 0.005;
      this.mysticLayerGain.gain.setTargetAtTime(mysticTarget, now, 0.45);
    }

    if (this.dangerLayerGain && this.dangerFilter) {
      const dangerTarget =
        isPlaying && this.currentDanger > 0.08 ? this.currentDanger * 0.058 : 0.0001;
      this.dangerLayerGain.gain.setTargetAtTime(dangerTarget, now, 0.28);
      const pulse = 0.5 + 0.5 * Math.sin(this.surfPhase * 4.5);
      this.dangerFilter.frequency.setTargetAtTime(
        220 + this.currentDanger * 460 + pulse * 180 * this.currentDanger,
        now,
        0.15
      );
    }

    // Procedural Adaptive Music Motifs (plays gently on title too once user interacts)
    const activeMusic = isPlaying || env?.screen === 'title';
    if (activeMusic) {
      this.nextMusicNoteTimer -= dt;
      if (this.nextMusicNoteTimer <= 0) {
        this.musicStepIdx += 1;
        if (isPlaying && this.currentDanger >= 0.45) {
          this.nextMusicNoteTimer = 0.42 + (1 - this.currentDanger) * 0.22;
          const dangerScale = [146.83, 155.56, 174.61, 220.0, 233.08];
          const note = dangerScale[this.musicStepIdx % dangerScale.length];
          this.playMusicNote(
            note,
            0.28,
            'triangle',
            0.028 * (0.6 + this.currentDanger * 0.6),
            1200
          );
        } else if (isPlaying && (isNight || this.currentMystic >= 0.45)) {
          this.nextMusicNoteTimer = 0.92 + Math.random() * 0.58;
          const mysticScale = [329.63, 392.0, 440.0, 493.88, 659.25, 587.33];
          const note = mysticScale[(this.musicStepIdx * 3) % mysticScale.length];
          this.playMusicNote(note, 0.68, 'sine', 0.024, 2400);
        } else {
          this.nextMusicNoteTimer = isPlaying ? 0.74 + Math.random() * 0.5 : 0.9 + Math.random() * 0.55;
          // D major pentatonic tropical kalimba / marimba
          const dayScale = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33];
          const note = dayScale[(this.musicStepIdx * 2 + (this.musicStepIdx % 3)) % dayScale.length];
          const rainSoft = 1 - rainIntensity * 0.35;
          const titleSoft = isPlaying ? 1 : 0.72;
          this.playMusicNote(
            note,
            0.44,
            'sine',
            0.025 * rainSoft * titleSoft,
            2900 - rainIntensity * 900
          );
        }
      }

      // Warm sub-percussion / bass anchor every few beats during play
      if (isPlaying) {
        this.nextBassTimer -= dt;
        if (this.nextBassTimer <= 0) {
          this.nextBassTimer = this.currentDanger >= 0.45 ? 0.48 : 1.55;
          const bassFreq = this.currentDanger >= 0.45 ? 87.31 : isNight ? 110.0 : 146.83;
          this.playMusicNote(
            bassFreq,
            this.currentDanger >= 0.45 ? 0.22 : 0.52,
            'sine',
            this.currentDanger >= 0.45 ? 0.042 : 0.02,
            420
          );
        }
      }
    }

    if (nearCampfire && isPlaying) {
      this.nextCrackleTimer -= dt;
      if (this.nextCrackleTimer <= 0) {
        this.nextCrackleTimer = 0.24 + Math.random() * 0.7;
        this.playTone(
          1350 + Math.random() * 1450,
          420,
          0.032,
          'triangle',
          0.026,
          0,
          true,
          2800
        );
      }
    }

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
    g.gain.linearRampToValueAtTime(peakGain, t0 + 0.03);
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

  // --- UI & Tactile Foley ---

  public playClick(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playTone(740, 470, 0.045, 'sine', 0.085, 0, false, 3200);
    this.playTone(1180, 880, 0.03, 'triangle', 0.038, 0.006, false, 3600);
  }

  public playModalOpen(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playTone(392, 587.33, 0.09, 'sine', 0.075, 0, true, 3200);
    this.playTone(587.33, 783.99, 0.11, 'triangle', 0.045, 0.045, true, 3800);
  }

  public playModalClose(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playTone(620, 370, 0.08, 'sine', 0.065, 0, false, 2800);
  }

  public playError(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playTone(230, 170, 0.09, 'triangle', 0.09, 0, false, 1400);
    this.playTone(180, 130, 0.11, 'triangle', 0.08, 0.08, false, 1200);
  }

  public playFootstep(surface: FootstepSurface): void {
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const jitter = 0.88 + Math.random() * 0.24;
    if (surface === 'water') {
      this.playNoiseBurst(0.11, 'bandpass', 950 * jitter, 420, 0.055, 1.2, 0, false);
      this.playTone(310 * jitter, 180, 0.06, 'sine', 0.025, 0, false, 1600);
    } else if (surface === 'sand') {
      this.playNoiseBurst(0.065, 'bandpass', 1800 * jitter, 1100, 0.038, 0.9, 0, false);
      this.playTone(135 * jitter, 85, 0.04, 'sine', 0.022, 0, false, 700);
    } else if (surface === 'rock') {
      this.playTone(220 * jitter, 115, 0.045, 'triangle', 0.04, 0, false, 1400);
      this.playNoiseBurst(0.035, 'highpass', 1400, 900, 0.025, 1.1, 0, false);
    } else if (surface === 'wood') {
      this.playTone(185 * jitter, 92, 0.055, 'triangle', 0.05, 0, false, 1200);
    } else {
      // Soft grass rustle
      this.playNoiseBurst(0.055, 'bandpass', 2400 * jitter, 1500, 0.028, 1.1, 0, false);
      this.playTone(125 * jitter, 78, 0.038, 'sine', 0.02, 0, false, 680);
    }
  }

  // --- Harvesting, Cooking, Eating & Building ---

  public playChop(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const pitchJitter = 0.92 + Math.random() * 0.16;
    this.playTone(195 * pitchJitter, 68, 0.12, 'triangle', 0.24, 0, true, 1600);
    this.playTone(390 * pitchJitter, 160, 0.065, 'sine', 0.12, 0, true, 2200);
    this.playNoiseBurst(0.075, 'bandpass', 1420 * pitchJitter, 980, 0.15, 1.2, 0, false);
  }

  public playForage(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playNoiseBurst(0.09, 'bandpass', 2600, 1400, 0.07, 1.1, 0, false);
    this.playTone(620, 880, 0.08, 'sine', 0.065, 0.02, true, 3600);
  }

  public playShellPickup(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    [880, 1174.66, 1567.98].forEach((f, idx) => {
      this.playTone(f, f * 1.01, 0.15, 'sine', 0.07, idx * 0.04, true, 4800);
    });
  }

  public playPickup(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      this.playTone(freq, freq * 1.005, 0.16, 'sine', 0.09, idx * 0.04, true, 4200);
      this.playTone(freq * 2, freq * 2, 0.07, 'triangle', 0.025, idx * 0.04, true, 4800);
    });
  }

  public playEat(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    // Crisp bite crunch + warm energy restoration chime
    this.playNoiseBurst(0.07, 'bandpass', 1850, 950, 0.11, 1.3, 0, false);
    this.playNoiseBurst(0.065, 'bandpass', 2100, 1050, 0.09, 1.3, 0.11, false);
    this.playTone(523.25, 783.99, 0.18, 'sine', 0.09, 0.16, true, 3600);
    this.playTone(783.99, 1046.5, 0.22, 'sine', 0.075, 0.24, true, 4200);
  }

  public playCook(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playNoiseBurst(0.16, 'highpass', 3200, 2200, 0.055, 0.8, 0, false);
    this.playTone(587.33, 587.33, 0.12, 'sine', 0.09, 0.02, true, 3600);
    this.playTone(880, 880, 0.18, 'sine', 0.11, 0.09, true, 3800);
  }

  public playBuildTick(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    const j = 0.94 + Math.random() * 0.12;
    this.playTone(250 * j, 105, 0.09, 'triangle', 0.15, 0, true, 1800);
    this.playNoiseBurst(0.045, 'bandpass', 1800, 900, 0.08, 1.2, 0, false);
  }

  // --- Fishing & Swimming ---

  public playSplash(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    this.playNoiseBurst(0.3, 'bandpass', 1150, 360, 0.16, 0.9, 0, true);
    this.playTone(420, 860, 0.1, 'sine', 0.09, 0.04, true, 3200);
    this.playTone(783.99, 1046.5, 0.14, 'sine', 0.06, 0.08, true, 3800);
  }

  public playSwimSplash(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    this.playNoiseBurst(0.2, 'bandpass', 680, 290, 0.11, 0.9, 0, false);
    this.playTone(340, 210, 0.1, 'sine', 0.04, 0.02, true, 1600);
  }

  public playOarStroke(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playNoiseBurst(0.24, 'bandpass', 780, 280, 0.13, 1.0, 0, true);
    this.playTone(185, 110, 0.12, 'sine', 0.06, 0.02, true, 900);
  }

  public playCastRod(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playTone(280, 840, 0.13, 'sine', 0.075, 0, true, 3200);
    this.playNoiseBurst(0.11, 'bandpass', 1600, 750, 0.06, 1.2, 0.02, false);
    this.playTone(620, 340, 0.07, 'sine', 0.045, 0.13, true, 2400);
  }

  public playFishEscape(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playNoiseBurst(0.15, 'bandpass', 900, 400, 0.09, 1.0, 0, false);
    this.playTone(520, 220, 0.22, 'sine', 0.09, 0, true, 2400);
  }

  // --- Weapons & Combat ---

  public playWeaponStrike(weaponId?: WeaponId): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    if (weaponId === 'bow') {
      this.playBowShot();
      return;
    }
    if (weaponId === 'hammer') {
      this.playTone(190, 62, 0.2, 'triangle', 0.22, 0, true, 1300);
      this.playNoiseBurst(0.14, 'lowpass', 950, 220, 0.14, 1.0, 0, true);
      return;
    }
    if (weaponId === 'spear') {
      this.playTone(520, 175, 0.1, 'triangle', 0.14, 0, true, 2800);
      this.playNoiseBurst(0.08, 'bandpass', 2600, 950, 0.11, 1.1, 0, false);
      return;
    }
    this.playTone(420, 125, 0.11, 'triangle', 0.14, 0, true, 2400);
    this.playNoiseBurst(0.095, 'bandpass', 2200, 600, 0.11, 1.0, 0, false);
  }

  public playBowShot(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playTone(540, 175, 0.16, 'triangle', 0.14, 0, true, 2800);
    this.playTone(980, 420, 0.08, 'sine', 0.06, 0.02, true, 3600);
    this.playNoiseBurst(0.09, 'bandpass', 3000, 1200, 0.065, 1.4, 0.01, false);
  }

  public playHammerSlam(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    this.playTone(150, 38, 0.34, 'sine', 0.34, 0, true, 900);
    this.playTone(220, 62, 0.22, 'triangle', 0.16, 0, true, 1200);
    this.playNoiseBurst(0.28, 'lowpass', 750, 140, 0.2, 0.8, 0, true);
  }

  public playPredatorGrowl(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playTone(135, 78, 0.28, 'sawtooth', 0.085, 0, true, 780);
    this.playTone(195, 110, 0.22, 'triangle', 0.06, 0.02, true, 900);
  }

  public playHitDamage(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playTone(175, 52, 0.2, 'triangle', 0.24, 0, true, 1100);
    this.playTone(260, 88, 0.14, 'sawtooth', 0.09, 0, false, 950);
  }

  public playPoisonHiss(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    this.playNoiseBurst(0.36, 'bandpass', 3200, 1800, 0.18, 3.2, 0, false);
    this.playTone(620, 290, 0.2, 'sawtooth', 0.06, 0.04, false, 2200);
  }

  // --- Secrets, Mysteries, Progression & World Events ---

  public playSecretOpen(): void {
    this.playSecretReward();
  }

  public playSecretReward(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, idx) => {
      this.playTone(f, f, 0.36, 'sine', 0.13, idx * 0.072, true, 4800);
      this.playTone(f * 1.5, f * 1.5, 0.2, 'triangle', 0.035, idx * 0.072, true, 4800);
    });
  }

  public playSecretTrap(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    // Trap mechanical snap + cursed descending dissonant sting
    this.playNoiseBurst(0.12, 'bandpass', 2400, 620, 0.2, 1.4, 0, false);
    this.playTone(392, 110, 0.28, 'sawtooth', 0.15, 0.02, true, 1600);
    this.playTone(277.18, 92, 0.34, 'triangle', 0.18, 0.08, true, 1200);
    this.playTone(130, 52, 0.36, 'sine', 0.22, 0.1, true, 600);
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

  public playCraftSuccess(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    [523.25, 659.25, 987.77].forEach((f, idx) => {
      this.playTone(f, f, 0.24, 'triangle', 0.11, idx * 0.065, true, 4200);
    });
  }

  public playFireIgnite(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    this.playTone(1850, 920, 0.06, 'triangle', 0.11, 0, false, 4800);
    this.playNoiseBurst(0.52, 'bandpass', 300, 1400, 0.22, 0.85, 0.02, true);
    [392, 493.88, 587.33].forEach((f, idx) => {
      this.playTone(f, f * 1.02, 0.28, 'sine', 0.08, 0.08 + idx * 0.05, true, 2600);
    });
  }

  public playStokeFire(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    this.playNoiseBurst(0.32, 'bandpass', 420, 1300, 0.15, 0.9, 0, true);
    [440, 587.33, 739.99].forEach((f, idx) => {
      this.playTone(f, f * 1.01, 0.22, 'triangle', 0.09, idx * 0.055, true, 3200);
    });
  }

  public playThunder(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    this.playNoiseBurst(1.5, 'lowpass', 280, 65, 0.28, 0.7, 0, true);
  }

  public playEarthquake(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    this.playTone(68, 36, 0.85, 'sine', 0.24, 0, true, 320);
    this.playNoiseBurst(0.95, 'lowpass', 140, 85, 0.22, 0.8, 0, false);
  }

  public playLightningStrike(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    this.playTone(190, 48, 0.22, 'sawtooth', 0.14, 0, true, 1400);
    this.playNoiseBurst(0.64, 'bandpass', 1900, 120, 0.3, 0.8, 0, true);
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

  public playTempleUnlock(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    this.playNoiseBurst(1.25, 'lowpass', 160, 240, 0.24, 0.8, 0, true);
    [293.66, 440, 587.33, 659.25, 880, 1174.66].forEach((freq, idx) => {
      this.playTone(freq, freq * 1.004, 0.48, 'triangle', 0.12, 0.16 + idx * 0.095, true, 4800);
    });
  }

  // --- Cutscene & Outcome Soundscapes ---

  public playPlaneCutscene(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    for (let i = 0; i < 6; i += 1) {
      const delay = i * 0.44;
      this.playTone(96 - i * 4, 68 - i * 3, 0.36, 'sawtooth', 0.085, delay, false, 420);
      if (i % 2 === 0) {
        this.playTone(880, 660, 0.14, 'square', 0.035, delay + 0.1, false, 1800);
      }
    }
    // Parachute canopy deployment wind whoosh at t=1.85s
    this.playNoiseBurst(1.4, 'bandpass', 620, 320, 0.09, 1.2, 1.85, true);
  }

  public playPlaneCrash(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || !this.sfxBus || this.muted) return;
    this.playTone(112, 32, 0.48, 'sawtooth', 0.26, 0, true, 850);
    this.playTone(480, 140, 0.22, 'square', 0.08, 0.04, false, 1400);
    this.playNoiseBurst(0.76, 'lowpass', 1600, 140, 0.32, 0.8, 0, true);
  }

  public playVictoryFanfare(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    const fanfare = [
      { f: 392.0, t: 0, d: 0.18 },
      { f: 523.25, t: 0.16, d: 0.18 },
      { f: 659.25, t: 0.32, d: 0.18 },
      { f: 783.99, t: 0.48, d: 0.34 },
      { f: 659.25, t: 0.78, d: 0.16 },
      { f: 1046.5, t: 0.94, d: 0.65 },
    ];
    fanfare.forEach((n) => {
      this.playTone(n.f, n.f * 1.002, n.d, 'triangle', 0.13, n.t, true, 4600);
      this.playTone(n.f * 0.5, n.f * 0.5, n.d, 'sine', 0.08, n.t, true, 2200);
    });
  }

  public playDefeatSting(): void {
    this.unlockAndStartAmbience();
    if (!this.ctx || this.muted) return;
    [329.63, 293.66, 261.63, 196.0].forEach((f, idx) => {
      this.playTone(f, f * 0.96, 0.38, 'triangle', 0.13, idx * 0.22, true, 1600);
      this.playTone(f * 0.5, f * 0.48, 0.4, 'sine', 0.09, idx * 0.22, true, 900);
    });
  }
}

export const soundEngine = new IslandAudioEngine();
export const audioManager = soundEngine;
