import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VirtualJoystick } from './components/VirtualJoystick';
import {
  CONFIG,
  type AppScreenState,
  type BiomeId,
  type CampUpgradeId,
  type DayPhase,
  type GameMode,
  type SkillId,
  type StrangeLandmarkId,
  type WeatherKind,
} from './game/config';
import {
  createThreeIslandGame,
  type ActiveRunInfo,
  type FlyingResourceEvent,
  type HudSnapshot,
  type ThreeIslandController,
} from './game/threeScene';
import { formatDailyLabel, toPersianDigits } from './game/utils';
import { ANIMAL_SPECIES, type AnimalCategory } from './game/wildlife';

const BIOME_LABELS: Record<BiomeId, string> = {
  center: 'ساحل و جنگل مرکزی',
  ruins: 'خرابه‌های باستانی',
  volcano: 'قله آتشفشان',
  mushroom: 'جنگل قارچ‌ها',
  shipwreck: 'خلیج کشتی‌شکسته',
  spring: 'چشمه بلورین',
};

const PAD_LABELS: Record<CampUpgradeId, string> = {
  shelter: 'پناهگاه چوبی',
  rack: 'ارتقای کوله',
  pier: 'اسکله ماهیگیری',
};

const PHASE_LABELS: Record<DayPhase, string> = {
  dawn: 'سپیده‌دم',
  day: 'روز',
  dusk: 'غروب',
  night: 'شب',
};

const WEATHER_LABELS: Record<WeatherKind, string> = {
  clear: 'آفتابی',
  rain: 'بارانی',
  fog: 'مه‌آلود',
};

const LANDMARK_ACTION_LABELS: Record<StrangeLandmarkId, string> = {
  ruins: 'اجرای آیین خورشید',
  volcano: 'آهنگری گدازه (نیزه آتشین)',
  mushroom: 'جذب معجون اسپور',
  shipwreck: 'گشودن گنج کاپیتان',
  spring: 'نوشیدن از چشمه بلورین',
};

const FIRE_UNLOCK_HINTS: Record<number, string> = {
  1: 'سطح ۲: موز کبابی در کمپ',
  2: 'سطح ۳: دفع شکارچی شب + سرعت بیشتر',
  3: 'سطح ۴: شعله ابدی + ۱.۵ برابر تجربه',
  4: 'شعله به حداکثر قدرت رسید',
};

const CATEGORY_LABELS: Record<AnimalCategory | 'all', string> = {
  all: 'همه',
  day: 'روزگرد',
  coastal: 'ساحل و دریا',
  night_predator: 'شکارچی شب',
  strange: 'موجودات عجیب',
};

const INITIAL_HUD: HudSnapshot = {
  coins: 0,
  wood: 0,
  fish: 0,
  cookedFish: 0,
  banana: 0,
  roastedBanana: 0,
  berries: 0,
  shells: 0,
  energy: CONFIG.PLAYER.MAX_ENERGY,
  maxEnergy: CONFIG.PLAYER.MAX_ENERGY,
  backpackUsed: 0,
  backpackCapacity: CONFIG.PLAYER.BACKPACK_CAPACITY,
  biome: 'center',
  timeOfDay: 0.38,
  dayCount: 1,
  phase: 'day',
  isNight: false,
  weather: 'clear',
  hasSpear: false,
  hasFireSpear: false,
  canCraftSpear: false,
  fireLevel: 1,
  canStokeFire: false,
  xp: 0,
  skillPoints: 1,
  skills: {
    lumberjack: 0,
    backpacker: 0,
    pathfinder: 0,
    angler: 0,
    pyromancer: 0,
  },
  discoveredAnimals: [],
  nearCampfire: false,
  backpackFullBlocked: false,
  lowEnergyBlocked: false,
  needSpearBlocked: false,
  predatorAlert: false,
  canEatFood: false,
  bestFoodKind: null,
  activeAction: 'idle',
  buildings: { shelter: false, rack: false, pier: false },
  nearbyPad: null,
  nearbyLandmark: null,
};

interface FlyingIconAnim {
  id: number;
  kind: FlyingResourceEvent['kind'];
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  launched: boolean;
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ThreeIslandController | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const counterRefs = useRef<
    Record<
      'coin' | 'wood' | 'fish' | 'cookedFish' | 'banana' | 'roastedBanana' | 'berries' | 'shell',
      HTMLDivElement | null
    >
  >({
    coin: null,
    wood: null,
    fish: null,
    cookedFish: null,
    banana: null,
    roastedBanana: null,
    berries: null,
    shell: null,
  });

  const [screen, setScreen] = useState<AppScreenState>('loading');
  const [activeRun, setActiveRun] = useState<ActiveRunInfo | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [flyingIcons, setFlyingIcons] = useState<FlyingIconAnim[]>([]);
  const [toastText, setToastText] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'skills' | 'wildlife' | null>(null);
  const [wildlifeFilter, setWildlifeFilter] = useState<AnimalCategory | 'all'>('all');

  const dailyLabel = useMemo(() => formatDailyLabel(), []);

  useEffect(() => {
    document.body.dataset.state = screen;
  }, [screen]);

  const showToast = useCallback((text: string) => {
    setToastText(text);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastText(null);
      toastTimerRef.current = null;
    }, 3200);
  }, []);

  const triggerFlyIcon = useCallback((evt: FlyingResourceEvent) => {
    const frameEl = frameRef.current;
    const targetEl = counterRefs.current[evt.kind];
    if (!frameEl || !targetEl) return;

    const frameRect = frameEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const targetX = targetRect.left - frameRect.left + targetRect.width * 0.5;
    const targetY = targetRect.top - frameRect.top + targetRect.height * 0.5;

    const item: FlyingIconAnim = {
      id: evt.id,
      kind: evt.kind,
      startX: evt.startX,
      startY: evt.startY,
      targetX,
      targetY,
      launched: false,
    };

    setFlyingIcons((prev) => [...prev.slice(-10), item]);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFlyingIcons((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, launched: true } : p))
        );
      });
    });

    window.setTimeout(() => {
      setFlyingIcons((prev) => prev.filter((p) => p.id !== item.id));
    }, 560);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart') === '1';

    const controller = createThreeIslandGame(
      container,
      {
        onScreenChange: (nextScreen, runInfo) => {
          setScreen(nextScreen);
          setActiveModal(null);
          if (runInfo) {
            setActiveRun(runInfo);
          } else if (nextScreen === 'title') {
            setActiveRun(null);
          }
        },
        onHudUpdate: (snapshot) => {
          setHud(snapshot);
        },
        onResourceFly: (evt) => {
          triggerFlyIcon(evt);
        },
        onNotice: (text) => {
          showToast(text);
        },
      },
      'normal',
      autostart
    );

    controllerRef.current = controller;

    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      controller.destroy();
      controllerRef.current = null;
    };
  }, [triggerFlyIcon, showToast]);

  const handleStartMode = useCallback((mode: GameMode, forceNewIsland = false) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    controllerRef.current?.startRun(mode, forceNewIsland);
  }, []);

  const handleReturnToMenu = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setActiveModal(null);
    controllerRef.current?.returnToMenu();
  }, []);

  const handleJoystickChange = useCallback((dx: number, dy: number) => {
    controllerRef.current?.setJoystickInput(dx, dy);
  }, []);

  const handleEatFood = useCallback(() => {
    controllerRef.current?.eatFood();
  }, []);

  const handleCraftSpear = useCallback(() => {
    controllerRef.current?.craftSpear();
  }, []);

  const handleStokeFire = useCallback(() => {
    controllerRef.current?.stokeFire();
  }, []);

  const handleUpgradeSkill = useCallback((skillId: SkillId) => {
    controllerRef.current?.upgradeSkill(skillId);
  }, []);

  const handleTriggerLandmark = useCallback((id: StrangeLandmarkId) => {
    controllerRef.current?.triggerLandmark(id);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (screen === 'title' && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        handleStartMode('normal', false);
      } else if (screen === 'playing' && event.key === 'Escape') {
        event.preventDefault();
        if (activeModal) {
          setActiveModal(null);
        } else {
          handleReturnToMenu();
        }
      } else if (screen === 'playing' && !activeModal && (event.code === 'KeyE' || event.code === 'Space')) {
        handleEatFood();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, activeModal, handleStartMode, handleReturnToMenu, handleEatFood]);

  const energyRatio = Math.max(0, Math.min(1, hud.energy / Math.max(1, hud.maxEnergy)));
  const backpackFull = hud.backpackUsed >= hud.backpackCapacity;
  const discoveredSet = useMemo(() => new Set(hud.discoveredAnimals), [hud.discoveredAnimals]);

  const filteredSpecies = useMemo(
    () =>
      wildlifeFilter === 'all'
        ? ANIMAL_SPECIES
        : ANIMAL_SPECIES.filter((s) => s.category === wildlifeFilter),
    [wildlifeFilter]
  );

  let survivalNotice: { text: string; tone: 'warn' | 'warm' } | null = null;
  if (toastText) {
    survivalNotice = { text: toastText, tone: 'warm' };
  } else if (hud.predatorAlert) {
    survivalNotice = {
      text: 'خطر شکارچی شب! به آتش نزدیک شو یا نیزه آتشین بساز',
      tone: 'warn',
    };
  } else if (hud.needSpearBlocked) {
    survivalNotice = {
      text: 'برای ماهی‌گیری در آب، اول نیزه بساز (۲ چوب)',
      tone: 'warn',
    };
  } else if (hud.backpackFullBlocked) {
    survivalNotice = { text: 'کوله پر شد! کنار آتش کمپ خالی کن', tone: 'warn' };
  } else if (hud.lowEnergyBlocked) {
    survivalNotice = { text: 'انرژی کم است! غذا بخور یا کنار آتش بمان', tone: 'warn' };
  } else if (hud.activeAction === 'chop') {
    survivalNotice = { text: 'در حال قطع درخت با تبر...', tone: 'warm' };
  } else if (hud.activeAction === 'climb') {
    survivalNotice = { text: 'در حال بالا رفتن از درخت موز...', tone: 'warm' };
  } else if (hud.activeAction === 'spear_fish') {
    survivalNotice = { text: 'در حال شکار ماهی با نیزه در آب...', tone: 'warm' };
  } else if (hud.activeAction === 'forage') {
    survivalNotice = { text: 'در حال جمع‌آوری از طبیعت...', tone: 'warm' };
  } else if (hud.activeAction === 'build' && hud.nearbyPad) {
    survivalNotice = { text: `در حال ساخت ${PAD_LABELS[hud.nearbyPad.id]}...`, tone: 'warm' };
  } else if (hud.nearbyPad && hud.nearbyPad.totalWood < hud.nearbyPad.cost) {
    survivalNotice = {
      text: `${PAD_LABELS[hud.nearbyPad.id]} · نیاز به ${toPersianDigits(hud.nearbyPad.cost)} چوب`,
      tone: 'warn',
    };
  } else if (hud.activeAction === 'cook') {
    survivalNotice = { text: 'در حال کباب کردن روی آتش...', tone: 'warm' };
  } else if (hud.nearCampfire) {
    survivalNotice = {
      text: `آتش کمپ سطح ${toPersianDigits(hud.fireLevel)} · ${FIRE_UNLOCK_HINTS[hud.fireLevel] ?? ''}`,
      tone: 'warm',
    };
  }

  return (
    <main className="game-stage-shell" dir="rtl" lang="fa">
      <div ref={frameRef} className="game-viewport-frame" data-testid="game-viewport">
        {/* Three.js 3D Island Viewport */}
        <div
          ref={mountRef}
          className="three-mount absolute inset-0 w-full h-full"
          data-testid="three-canvas-container"
        />

        {/* Lower-Half Virtual Joystick Overlay */}
        <VirtualJoystick enabled={screen === 'playing' && !activeModal} onChange={handleJoystickChange} />

        {/* Flying Resource Icons into HUD Counters */}
        {screen === 'playing' &&
          flyingIcons.map((item) => (
            <div
              key={item.id}
              className="pointer-events-none fixed sm:absolute z-30 w-8 h-8 -ml-4 -mt-4 flex items-center justify-center rounded-full bg-[#fffbe8] shadow-md transition-all duration-500 ease-out"
              style={{
                left: 0,
                top: 0,
                transform: `translate3d(${item.launched ? item.targetX : item.startX}px, ${
                  item.launched ? item.targetY : item.startY
                }px, 0) scale(${item.launched ? 0.65 : 1.15})`,
                opacity: item.launched ? 0.25 : 1,
              }}
              aria-hidden="true"
            >
              {item.kind === 'coin' && <CoinSvg />}
              {item.kind === 'wood' && <WoodSvg />}
              {item.kind === 'fish' && <FishSvg />}
              {item.kind === 'cookedFish' && <CookedFishSvg />}
              {item.kind === 'banana' && <BananaSvg />}
              {item.kind === 'roastedBanana' && <RoastedBananaSvg />}
              {item.kind === 'berries' && <BerrySvg />}
              {item.kind === 'shell' && <ShellSvg />}
            </div>
          ))}

        {/* Title Screen Overlay */}
        {screen === 'title' && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between px-5 pt-7 pb-5">
            <div className="flex flex-col items-center text-center">
              <h1
                className="text-4xl font-extrabold text-white leading-tight tracking-tight"
                style={{
                  textShadow: '0 4px 0 #1875ad, 0 10px 22px rgba(8, 52, 88, 0.52)',
                }}
              >
                {CONFIG.GAME_TITLE}
              </h1>
              <p className="mt-2 px-3.5 py-1 rounded-full bg-[#fef7e4]/95 border border-white/80 shadow-sm text-[11px] font-extrabold text-[#114f78]">
                چرخه شب‌وروز، باران و مه، درخت مهارت و ۳۲ جانور جزیره
              </p>
            </div>

            <div className="pointer-events-auto self-center w-full max-w-[280px] flex flex-col gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={() => handleStartMode('normal', false)}
                className="wood-btn-primary w-full min-h-[54px] px-5 py-3 rounded-2xl text-white font-extrabold text-lg transition-all cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                style={{ textShadow: '0 2px 0 rgba(153, 62, 6, 0.7)' }}
              >
                <PlayArrowIcon className="w-6 h-6 shrink-0" />
                <span>شروع بازی</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStartMode('daily', false)}
                  className="wood-btn flex-1 min-h-[44px] px-3 py-2 rounded-xl text-[#fff8eb] font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  style={{ textShadow: '0 1px 0 rgba(94, 41, 10, 0.7)' }}
                >
                  <SunMiniIcon className="w-4 h-4 shrink-0 text-[#ffe066]" />
                  <span>چالش روز ({dailyLabel})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartMode('normal', true)}
                  className="wood-btn min-h-[44px] px-3 py-2 rounded-xl text-[#fff8eb] font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                  style={{ textShadow: '0 1px 0 rgba(94, 41, 10, 0.7)' }}
                  title="ساخت جزیره تصادفی جدید"
                >
                  <RefreshMiniIcon className="w-4 h-4 shrink-0 text-[#ffe066]" />
                  <span>جزیره جدید</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Survival RTL HTML HUD Overlay over Canvas */}
        {screen === 'playing' && activeRun && (
          <div className="pointer-events-none absolute inset-0 z-20">
            {/* Top-Right: Coins, Resources & Day/Weather indicator */}
            <div
              className="absolute top-2.5 right-2.5 flex flex-col items-start gap-1.5"
              data-testid="hud-top-right"
            >
              <div className="flex items-center gap-1 flex-wrap max-w-[196px] sm:max-w-[540px]">
                <HudCounterPill
                  ref={(el) => {
                    counterRefs.current.coin = el;
                  }}
                  label="سکه"
                  value={hud.coins}
                  icon={<CoinSvg />}
                  accentClass="text-[#a15c07]"
                />
                <HudCounterPill
                  ref={(el) => {
                    counterRefs.current.wood = el;
                  }}
                  label="چوب"
                  value={hud.wood}
                  icon={<WoodSvg />}
                />
                <HudCounterPill
                  ref={(el) => {
                    counterRefs.current.fish = el;
                  }}
                  label="ماهی"
                  value={hud.fish}
                  icon={<FishSvg />}
                />
                <HudCounterPill
                  ref={(el) => {
                    counterRefs.current.cookedFish = el;
                  }}
                  label="ماهی کبابی"
                  value={hud.cookedFish}
                  icon={<CookedFishSvg />}
                  accentClass="text-[#9e3f08]"
                />
                <HudCounterPill
                  ref={(el) => {
                    counterRefs.current.banana = el;
                  }}
                  label="موز"
                  value={hud.banana}
                  icon={<BananaSvg />}
                />
                {hud.roastedBanana > 0 && (
                  <HudCounterPill
                    ref={(el) => {
                      counterRefs.current.roastedBanana = el;
                    }}
                    label="موز کبابی"
                    value={hud.roastedBanana}
                    icon={<RoastedBananaSvg />}
                    accentClass="text-[#9e3f08]"
                  />
                )}
                <HudCounterPill
                  ref={(el) => {
                    counterRefs.current.berries = el;
                  }}
                  label="توت"
                  value={hud.berries}
                  icon={<BerrySvg />}
                />
                <HudCounterPill
                  ref={(el) => {
                    counterRefs.current.shell = el;
                  }}
                  label="صدف"
                  value={hud.shells}
                  icon={<ShellSvg />}
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <div
                  className={`hud-card rounded-xl px-2 py-1 flex items-center gap-1.5 text-[10px] font-extrabold ${
                    hud.isNight ? 'text-[#1c2b59]' : 'text-[#4b3010]'
                  }`}
                  data-testid="hud-day-weather"
                >
                  <PhaseWeatherIcon phase={hud.phase} weather={hud.weather} />
                  <span>
                    روز {toPersianDigits(hud.dayCount)} · {PHASE_LABELS[hud.phase]} · {WEATHER_LABELS[hud.weather]}
                  </span>
                </div>

                {hud.hasSpear && (
                  <div
                    className={`hud-card rounded-xl px-2 py-1 flex items-center gap-1 text-[10px] font-extrabold ${
                      hud.hasFireSpear ? 'text-[#b5380d]' : 'text-[#3a4d1a]'
                    }`}
                    data-testid="hud-spear-badge"
                  >
                    <SpearMiniSvg fire={hud.hasFireSpear} />
                    <span>{hud.hasFireSpear ? 'نیزه آتشین' : 'نیزه'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Top-Left: Energy Bar + Skills + Wildlife Guide + Biome + Menu */}
            <div
              className="absolute top-2.5 left-2.5 flex flex-col items-end gap-1.5"
              data-testid="hud-top-left"
            >
              <div className="hud-card rounded-2xl px-2.5 py-1.5 flex items-center gap-2 min-w-[136px]">
                <EnergyBoltSvg />
                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between text-[10px] font-extrabold text-[#5a3b14]">
                    <span>انرژی</span>
                    <span className="tabular-nums">
                      {toPersianDigits(hud.energy)} / {toPersianDigits(hud.maxEnergy)}
                    </span>
                  </div>
                  <div className="w-24 h-2.5 rounded-full wood-well p-0.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-transform duration-200 origin-right ${
                        energyRatio < 0.28
                          ? 'bg-gradient-to-l from-[#ff5e3a] to-[#ffb703]'
                          : 'bg-gradient-to-l from-[#74e344] to-[#ffd233]'
                      }`}
                      style={{ transform: `scaleX(${Math.max(0.04, energyRatio)})` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:flex sm:items-center gap-1 sm:flex-wrap sm:justify-end">
                <button
                  type="button"
                  data-testid="open-skills-btn"
                  onClick={() => setActiveModal((m) => (m === 'skills' ? null : 'skills'))}
                  className="pointer-events-auto wood-btn px-2 py-1 rounded-xl text-[#fff8eb] text-[10px] font-extrabold cursor-pointer flex items-center justify-center gap-1"
                  style={{ textShadow: '0 1px 0 rgba(94, 41, 10, 0.7)' }}
                >
                  <SkillStarSvg />
                  <span>مهارت‌ها</span>
                  {hud.skillPoints > 0 && (
                    <span className="px-1 rounded-full bg-[#ffe055] text-[#69320e] text-[9px] font-black tabular-nums">
                      {toPersianDigits(hud.skillPoints)}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  data-testid="open-wildlife-btn"
                  onClick={() => setActiveModal((m) => (m === 'wildlife' ? null : 'wildlife'))}
                  className="pointer-events-auto wood-btn px-2 py-1 rounded-xl text-[#fff8eb] text-[10px] font-extrabold cursor-pointer flex items-center justify-center gap-1"
                  style={{ textShadow: '0 1px 0 rgba(94, 41, 10, 0.7)' }}
                >
                  <PawMiniSvg />
                  <span>
                    جانوران ({toPersianDigits(hud.discoveredAnimals.length)}/
                    {toPersianDigits(ANIMAL_SPECIES.length)})
                  </span>
                </button>

                <div
                  className="hud-card rounded-xl px-2 py-1 flex items-center justify-center gap-1 text-[10px] font-extrabold text-[#4b3010] truncate max-w-[110px] sm:max-w-none"
                  data-testid="hud-biome"
                >
                  <CompassMiniSvg />
                  <span className="truncate">{BIOME_LABELS[hud.biome]}</span>
                </div>

                <button
                  type="button"
                  onClick={handleReturnToMenu}
                  className="pointer-events-auto wood-btn px-2 py-1 rounded-xl text-[#fff8eb] text-[10px] font-extrabold cursor-pointer flex items-center justify-center gap-1"
                  style={{ textShadow: '0 1px 0 rgba(94, 41, 10, 0.7)' }}
                >
                  <HomeMiniSvg />
                  <span>منو</span>
                </button>
              </div>
            </div>

            {/* Contextual Survival Status Pill */}
            {survivalNotice && !activeModal && (
              <div className="absolute top-[118px] sm:top-[76px] left-1/2 -translate-x-1/2 max-w-[92%] pointer-events-none">
                <div
                  data-testid="survival-notice"
                  className={`px-3.5 py-1 rounded-full text-[11px] font-extrabold shadow-md text-center whitespace-nowrap overflow-hidden text-ellipsis ${
                    survivalNotice.tone === 'warn'
                      ? 'bg-[#fff0e0]/95 text-[#b5380d] border border-[#ffb370]'
                      : 'bg-[#fff7dc]/95 text-[#8a4f0a] border border-[#ffd670]'
                  }`}
                >
                  {survivalNotice.text}
                </div>
              </div>
            )}

            {/* Bottom-Left: Backpack Capacity */}
            <div className="absolute bottom-3.5 left-3" data-testid="hud-bottom-left">
              <div
                className={`hud-card rounded-2xl px-2.5 py-1.5 flex items-center gap-2 ${
                  backpackFull ? 'ring-2 ring-[#ff7b29]' : ''
                }`}
              >
                <BackpackSvg />
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] font-bold text-[#755326]">
                    {backpackFull ? 'کوله پر شد!' : 'کوله'}
                  </span>
                  <span
                    dir="ltr"
                    className={`text-xs font-extrabold tabular-nums ${
                      backpackFull ? 'text-[#c9410e]' : 'text-[#3d2508]'
                    }`}
                  >
                    {toPersianDigits(hud.backpackUsed)} / {toPersianDigits(hud.backpackCapacity)}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom-Right: Contextual Interactive Survival Actions */}
            <div
              className="absolute bottom-3.5 right-3 flex flex-col items-start gap-1.5 max-w-[175px] sm:max-w-[260px]"
              data-testid="hud-bottom-right"
            >
              {hud.canEatFood && hud.bestFoodKind && (
                <button
                  type="button"
                  data-testid="eat-food-btn"
                  onClick={handleEatFood}
                  className="pointer-events-auto wood-btn-primary px-2.5 py-1.5 rounded-xl text-white text-[11px] font-extrabold cursor-pointer flex items-center gap-1.5"
                  style={{ textShadow: '0 1px 0 rgba(153, 62, 6, 0.7)' }}
                >
                  {hud.bestFoodKind === 'roastedBanana' && <RoastedBananaSvg />}
                  {hud.bestFoodKind === 'cookedFish' && <CookedFishSvg />}
                  {hud.bestFoodKind === 'banana' && <BananaSvg />}
                  {hud.bestFoodKind === 'berries' && <BerrySvg />}
                  <span>
                    {hud.bestFoodKind === 'roastedBanana'
                      ? `موز کبابی (+${toPersianDigits(CONFIG.SURVIVAL.ROASTED_BANANA_ENERGY_RESTORE)})`
                      : hud.bestFoodKind === 'cookedFish'
                        ? `ماهی کبابی (+${toPersianDigits(CONFIG.SURVIVAL.COOKED_FISH_ENERGY_RESTORE)})`
                        : hud.bestFoodKind === 'banana'
                          ? `خوردن موز (+${toPersianDigits(CONFIG.SURVIVAL.BANANA_ENERGY_RESTORE)})`
                          : `خوردن توت (+${toPersianDigits(CONFIG.SURVIVAL.BERRY_ENERGY_RESTORE)})`}
                  </span>
                </button>
              )}

              {!hud.hasSpear && (hud.canCraftSpear || hud.needSpearBlocked || hud.wood > 0) && (
                <button
                  type="button"
                  data-testid="craft-spear-btn"
                  disabled={!hud.canCraftSpear}
                  onClick={handleCraftSpear}
                  className={`pointer-events-auto px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 transition-all ${
                    hud.canCraftSpear
                      ? 'wood-btn-primary text-white cursor-pointer'
                      : 'hud-card text-[#7a5a32] opacity-80 cursor-not-allowed'
                  }`}
                >
                  <SpearMiniSvg fire={false} />
                  <span>
                    ساخت نیزه ({toPersianDigits(CONFIG.SURVIVAL.SPEAR_CRAFT_WOOD_COST)} چوب)
                  </span>
                </button>
              )}

              {hud.nearCampfire && hud.fireLevel < CONFIG.SURVIVAL.MAX_FIRE_LEVEL && (
                <button
                  type="button"
                  data-testid="stoke-fire-btn"
                  disabled={!hud.canStokeFire}
                  onClick={handleStokeFire}
                  className={`pointer-events-auto px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 transition-all ${
                    hud.canStokeFire
                      ? 'wood-btn-primary text-white cursor-pointer'
                      : 'hud-card text-[#7a5a32] opacity-80 cursor-not-allowed'
                  }`}
                >
                  <FlameMiniSvg />
                  <span>
                    چوب در آتش (سطح {toPersianDigits(hud.fireLevel + 1)} ·{' '}
                    {toPersianDigits(CONFIG.SURVIVAL.FIRE_FUEL_WOOD_COST)} چوب)
                  </span>
                </button>
              )}

              {hud.nearbyLandmark && (
                <button
                  type="button"
                  data-testid="landmark-power-btn"
                  disabled={hud.nearbyLandmark.cooldown > 0}
                  onClick={() => handleTriggerLandmark(hud.nearbyLandmark!.id)}
                  className={`pointer-events-auto px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 transition-all ${
                    hud.nearbyLandmark.cooldown <= 0
                      ? 'wood-btn-primary text-white cursor-pointer'
                      : 'hud-card text-[#7a5a32] opacity-85 cursor-not-allowed'
                  }`}
                >
                  <SparkMiniSvg />
                  <span>
                    {hud.nearbyLandmark.cooldown <= 0
                      ? LANDMARK_ACTION_LABELS[hud.nearbyLandmark.id]
                      : `آماده‌سازی آیین (${toPersianDigits(hud.nearbyLandmark.cooldown)} ث)`}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Skill Tree Modal (درخت مهارت) */}
        {screen === 'playing' && activeModal === 'skills' && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center p-3 bg-[#092842]/55"
            onClick={() => setActiveModal(null)}
            data-testid="skills-modal"
          >
            <div
              className="hud-card w-full max-w-[440px] max-h-[86vh] rounded-3xl p-4 flex flex-col gap-3 overflow-hidden text-[#3d2508]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold">درخت مهارت بقا</h2>
                  <p className="text-[11px] font-bold text-[#755326]">
                    امتیاز مهارت: {toPersianDigits(hud.skillPoints)} · تجربه:{' '}
                    {toPersianDigits(hud.xp)}/{toPersianDigits(CONFIG.SURVIVAL.XP_PER_SKILL_POINT)}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="close-modal-btn"
                  onClick={() => setActiveModal(null)}
                  className="wood-btn px-3 py-1.5 rounded-xl text-[#fff8eb] text-xs font-extrabold cursor-pointer"
                >
                  بستن
                </button>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto pr-0.5">
                {CONFIG.SKILL_TREE.map((spec) => {
                  const lvl = hud.skills[spec.id];
                  const maxed = lvl >= spec.maxLevel;
                  const canAfford = !maxed && (hud.skillPoints > 0 || hud.wood >= spec.woodCost);
                  return (
                    <div
                      key={spec.id}
                      className="rounded-2xl bg-white/80 border border-[#e6cda1] p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="flex flex-col gap-0.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-[#3d2508]">{spec.name}</span>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: spec.maxLevel }).map((_, idx) => (
                              <span
                                key={idx}
                                className={`w-2.5 h-2.5 rounded-full ${
                                  idx < lvl ? 'bg-[#f5941d]' : 'bg-[#e3cfa8]'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-[10px] font-bold text-[#6e4e24] leading-snug">
                          {spec.desc}
                        </p>
                      </div>

                      <button
                        type="button"
                        data-testid={`upgrade-skill-${spec.id}`}
                        disabled={!canAfford}
                        onClick={() => handleUpgradeSkill(spec.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all ${
                          maxed
                            ? 'bg-[#d9ebc4] text-[#3c6e18] cursor-default'
                            : canAfford
                              ? 'wood-btn-primary text-white cursor-pointer'
                              : 'bg-[#ead9bc] text-[#8d704a] cursor-not-allowed'
                        }`}
                      >
                        {maxed
                          ? 'تکمیل'
                          : hud.skillPoints > 0
                            ? 'ارتقا (۱ امتیاز)'
                            : `ارتقا (${toPersianDigits(spec.woodCost)} چوب)`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Wildlife Field Guide Modal (۳۲ گونه جانور جزیره) */}
        {screen === 'playing' && activeModal === 'wildlife' && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center p-3 bg-[#092842]/55"
            onClick={() => setActiveModal(null)}
            data-testid="wildlife-modal"
          >
            <div
              className="hud-card w-full max-w-[520px] max-h-[86vh] rounded-3xl p-4 flex flex-col gap-2.5 overflow-hidden text-[#3d2508]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold">دانشنامه جانوران جزیره</h2>
                  <p className="text-[11px] font-bold text-[#755326]">
                    {toPersianDigits(hud.discoveredAnimals.length)} از{' '}
                    {toPersianDigits(ANIMAL_SPECIES.length)} گونه مشاهده شده (روزگرد، ساحلی، شکارچی شب، اسرارآمیز)
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="close-modal-btn"
                  onClick={() => setActiveModal(null)}
                  className="wood-btn px-3 py-1.5 rounded-xl text-[#fff8eb] text-xs font-extrabold cursor-pointer"
                >
                  بستن
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {(['all', 'day', 'coastal', 'night_predator', 'strange'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setWildlifeFilter(cat)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold cursor-pointer transition-all ${
                      wildlifeFilter === cat
                        ? 'wood-btn-primary text-white'
                        : 'bg-[#f5e7ca] text-[#5e4018]'
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto pr-0.5">
                {filteredSpecies.map((spec) => {
                  const seen = discoveredSet.has(spec.id);
                  const swatchHex = `#${spec.primaryColor.toString(16).padStart(6, '0')}`;
                  const accentHex = `#${spec.secondaryColor.toString(16).padStart(6, '0')}`;
                  return (
                    <div
                      key={spec.id}
                      className={`rounded-2xl p-2 flex flex-col gap-1 border ${
                        seen
                          ? 'bg-[#fffdf4] border-[#f2b84b]'
                          : 'bg-[#f5ead4]/85 border-[#dfc99e] opacity-85'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-5 h-5 rounded-full shrink-0 border border-white shadow-sm"
                          style={{
                            background: `linear-gradient(135deg, ${swatchHex} 0%, ${accentHex} 100%)`,
                          }}
                          aria-hidden="true"
                        />
                        <span className="text-[11px] font-extrabold truncate">{spec.nameFa}</span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-bold text-[#755326]">
                        <span className="truncate">{spec.habitatFa}</span>
                        <span className={seen ? 'text-[#2b7a1f]' : 'text-[#9c7848]'}>
                          {seen ? 'دیده شد' : 'نایافته'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

const HudCounterPill = forwardRef<
  HTMLDivElement,
  {
    label: string;
    value: number;
    icon: React.ReactNode;
    accentClass?: string;
  }
>(function HudCounterPill({ label, value, icon, accentClass = 'text-[#3d2508]' }, ref) {
  return (
    <div
      ref={ref}
      className="hud-card rounded-xl px-2 py-1 flex items-center gap-1"
      aria-label={`${label}: ${toPersianDigits(value)}`}
    >
      <span className="w-4 h-4 flex items-center justify-center shrink-0">{icon}</span>
      <span className={`text-xs font-extrabold tabular-nums min-w-[10px] text-center ${accentClass}`}>
        {toPersianDigits(value)}
      </span>
    </div>
  );
});

function PhaseWeatherIcon({ phase, weather }: { phase: DayPhase; weather: WeatherKind }) {
  if (weather === 'rain') {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
        <path d="M6 14a4 4 0 0 1 1-7.8A5 5 0 0 1 17 7a3.5 3.5 0 0 1 1 6.8H6Z" fill="#6aa8d8" />
        <path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="#2d8be0" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (weather === 'fog') {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
        <path d="M4 9h16M6 13h12M4 17h14" stroke="#6c8fa8" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (phase === 'night') {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
        <path d="M15.5 4.5a7.5 7.5 0 1 0 4 13.8A6.2 6.2 0 0 1 15.5 4.5Z" fill="#5e72eb" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="5" fill={phase === 'dusk' || phase === 'dawn' ? '#ff8b3d' : '#ffb822'} />
      <path d="M12 3V5M12 19V21M3 12H5M19 12H21" stroke="#f5941d" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CoinSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="#ffb822" />
      <circle cx="12" cy="12" r="6.8" fill="#ffd95a" />
      <rect x="10.8" y="8" width="2.4" height="8" rx="1.2" fill="#d97f0a" />
    </svg>
  );
}

function WoodSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <rect x="3.5" y="7.5" width="17" height="9" rx="4.5" fill="#c77a3b" />
      <ellipse cx="17" cy="12" rx="2.6" ry="3.8" fill="#f7cb82" />
      <rect x="6" y="9.2" width="7" height="2" rx="1" fill="#e69e5c" />
    </svg>
  );
}

function FishSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path d="M5 12 L2 8.5 V15.5 L5 12 Z" fill="#ff8438" />
      <ellipse cx="12.5" cy="12" rx="7" ry="4.6" fill="#ff732e" />
      <ellipse cx="13" cy="12" rx="4.2" ry="2.2" fill="#ffe1a8" opacity="0.45" />
      <circle cx="16.5" cy="11" r="1.1" fill="#1e293b" />
    </svg>
  );
}

function CookedFishSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path d="M5 13 L2 9.5 V16.5 L5 13 Z" fill="#b85414" />
      <ellipse cx="12.5" cy="13" rx="7" ry="4.5" fill="#d96c23" />
      <path d="M10 9.5 L11.5 16.5 M14 9.2 L15.5 16.2" stroke="#7c3208" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M10 6 C9.5 4.5, 11 4, 10.5 2.5 M14 6 C13.5 4.5, 15 4, 14.5 2.5" stroke="#ff9d42" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function BananaSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path
        d="M5.5 16.5 C10 19, 17.5 14.5, 18.5 6.5 C17 5.5, 15.8 6, 15.5 7.5 C14.5 12.2, 10.2 14.8, 6.2 14.2 C5 14, 4.5 15.8, 5.5 16.5 Z"
        fill="#ffd43b"
      />
      <circle cx="17.5" cy="6.2" r="1.2" fill="#7c4d1a" />
    </svg>
  );
}

function RoastedBananaSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path
        d="M5.5 17 C10 19.5, 17.5 15, 18.5 7 C17 6, 15.8 6.5, 15.5 8 C14.5 12.7, 10.2 15.3, 6.2 14.7 C5 14.5, 4.5 16.3, 5.5 17 Z"
        fill="#e07a16"
      />
      <path d="M10 5 C9.6 3.8, 11 3.4, 10.5 2.2 M14 5 C13.6 3.8, 15 3.4, 14.5 2.2" stroke="#ff9d42" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function ShellSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path
        d="M12 19 C7.5 19, 4.2 14.5, 5.2 9.8 C6.2 6, 17.8 6, 18.8 9.8 C19.8 14.5, 16.5 19, 12 19 Z"
        fill="#ffa3b8"
      />
      <path d="M12 19 V7 M9 18 L7.5 8 M15 18 L16.5 8" stroke="#ffdbe6" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function BerrySvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path d="M12 4 Q15 3 16 6 Q13 7 12 4 Z" fill="#5fd145" />
      <circle cx="9.2" cy="13.8" r="4.5" fill="#ff3b54" />
      <circle cx="14.8" cy="13.8" r="4.5" fill="#e02b43" />
      <circle cx="8.2" cy="12" r="1.2" fill="#ffd6dc" />
    </svg>
  );
}

function SpearMiniSvg({ fire }: { fire: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <path d="M4 20 L16 8" stroke="#b06a2e" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M14 6 L20 4 L18 10 Z" fill={fire ? '#ff5a1f' : '#cad6e0'} />
    </svg>
  );
}

function FlameMiniSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <path
        d="M12 3 C14.5 7, 18 10, 17.5 14.8 C17 18.2, 14.8 20.5, 12 20.5 C9.2 20.5, 6.8 18.2, 6.5 14.8 C6 11, 8.8 8.5, 12 3 Z"
        fill="#ff7b1c"
      />
      <path d="M12 10.5 C13.5 12.8, 14.8 14.5, 14.2 17 C13.8 18.5, 10.2 18.5, 9.8 17 C9.2 14.5, 10.5 12.8, 12 10.5 Z" fill="#ffe066" />
    </svg>
  );
}

function SparkMiniSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <path d="M12 2 L14.5 9.5 L22 12 L14.5 14.5 L12 22 L9.5 14.5 L2 12 L9.5 9.5 Z" fill="#fff3b0" />
    </svg>
  );
}

function SkillStarSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <path
        d="M12 3 L14.8 8.8 L21 9.7 L16.5 14 L17.6 20.2 L12 17.2 L6.4 20.2 L7.5 14 L3 9.7 L9.2 8.8 Z"
        fill="#ffe055"
      />
    </svg>
  );
}

function PawMiniSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <circle cx="7.5" cy="9.5" r="2" fill="#ffe0b5" />
      <circle cx="12" cy="7.2" r="2.1" fill="#ffe0b5" />
      <circle cx="16.5" cy="9.5" r="2" fill="#ffe0b5" />
      <path d="M8.5 14.5 C8.5 12, 15.5 12, 15.5 14.5 C16.2 17.2, 14 19, 12 19 C10 19, 7.8 17.2, 8.5 14.5 Z" fill="#ffe0b5" />
    </svg>
  );
}

function EnergyBoltSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#ffe156" />
      <path d="M13 5L7.5 13H12L11 19L16.5 11H12L13 5Z" fill="#f07810" />
    </svg>
  );
}

function BackpackSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-5.5 h-5.5 shrink-0" aria-hidden="true">
      <path d="M9 6 C9 4, 15 4, 15 6" stroke="#8f4f1d" strokeWidth="2.2" fill="none" />
      <rect x="5.5" y="6.5" width="13" height="13.5" rx="4" fill="#c77a3b" />
      <rect x="7.5" y="12.5" width="9" height="5.5" rx="2" fill="#e39d5b" />
      <rect x="10.5" y="10.5" width="3" height="2.2" rx="0.8" fill="#ffd447" />
    </svg>
  );
}

function PlayArrowIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="rgba(255,255,255,0.22)" />
      <path d="M10 8.5L16.5 12L10 15.5V8.5Z" fill="#ffffff" />
    </svg>
  );
}

function SunMiniIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="5" fill="currentColor" />
      <path
        d="M12 3V5M12 19V21M3 12H5M19 12H21"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RefreshMiniIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M19 12A7 7 0 1 1 16.9 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M17 3.5V7.5H13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HomeMiniSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true">
      <path d="M4.5 11.5L12 5L19.5 11.5V19H4.5V11.5Z" fill="currentColor" />
    </svg>
  );
}

function CompassMiniSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="#d99a3a" />
      <circle cx="12" cy="12" r="7" fill="#fff6e0" />
      <path d="M14.8 9.2L13 13.4L9.2 14.8L11 10.6L14.8 9.2Z" fill="#d94426" />
    </svg>
  );
}
