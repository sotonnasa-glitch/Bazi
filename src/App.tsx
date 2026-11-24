import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VirtualJoystick } from './components/VirtualJoystick';
import { soundEngine } from './game/audio';
import {
  CONFIG,
  type AppScreenState,
  type BiomeId,
  type CampUpgradeId,
  type DayPhase,
  type GameMode,
  type GameOutcome,
  type StrangeLandmarkId,
  type WeaponId,
  type WeatherKind,
  type WildlifeDifficulty,
  type WorkshopRecipeId,
  type WorldEventKind,
} from './game/config';
import {
  createThreeIslandGame,
  type ActiveRunInfo,
  type FlyingResourceEvent,
  type HudSnapshot,
  type SavedRunSummary,
  type ThreeIslandController,
} from './game/threeScene';
import { toPersianDigits } from './game/utils';
import { ANIMAL_SPECIES, type AnimalCategory } from './game/wildlife';

const BIOME_LABELS: Record<BiomeId, string> = {
  center: 'ساحل و جنگل مرکزی',
  ruins: 'خرابه‌های باستانی',
  volcano: 'قله آتشفشان',
  mushroom: 'جنگل قارچ‌ها',
  shipwreck: 'معبد مدفون در شن',
  spring: 'چشمه بلورین',
};

const PAD_LABELS: Record<CampUpgradeId, string> = {
  shelter: 'پناهگاه چوبی',
  rack: 'ارتقای کوله',
  pier: 'اسکله ماهیگیری',
  boat: 'قایق چوبی',
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
  storm: 'توفانی',
  fog: 'مه‌آلود',
};

const WORLD_EVENT_LABELS: Record<
  Exclude<WorldEventKind, 'none'>,
  { title: string; detail: string; tone: 'danger' | 'magic' | 'gold' }
> = {
  low_tide: {
    title: 'جزر بزرگ دریا',
    detail: 'آب عقب رفت؛ صدف‌ها و کف دریا آشکار شدند!',
    tone: 'magic',
  },
  tsunami: {
    title: 'هشدار سونامی!',
    detail: 'موج بلند اقیانوس بالا می‌آید — به بلندی پناه ببر!',
    tone: 'danger',
  },
  volcano_eruption: {
    title: 'فوران آتشفشان!',
    detail: 'گدازه و سنگ‌های داغ از دهانه قله می‌بارند!',
    tone: 'danger',
  },
  meteor_shower: {
    title: 'بارش شهاب‌سنگ',
    detail: 'شهاب‌های آسمان سکه و گنج به جزیره آوردند!',
    tone: 'magic',
  },
  fish_frenzy: {
    title: 'جشن ماهی‌ها در خلیج',
    detail: 'صید در خلیج بسیار سریع و پربرکت شد!',
    tone: 'gold',
  },
  autumn_breeze: {
    title: 'نسیم طلایی پاییز',
    detail: 'برگ‌های نارنجی جزیره را پوشاندند و رشد گیاهان سریع‌تر شد!',
    tone: 'gold',
  },
  winter_frost: {
    title: 'یخبندان زمستانی',
    detail: 'برف سفید قله آتشفشان و دامنه‌ها را پوشاند!',
    tone: 'magic',
  },
  earthquake: {
    title: 'زلزله بزرگ جزیره!',
    detail: 'زمین می‌لرزد و صخره‌ها از آسمان فرود می‌آیند — جاخالی بده!',
    tone: 'danger',
  },
  lightning_storm: {
    title: 'توفان سهمگین صاعقه!',
    detail: 'آذرخش‌های پیاپی به سطح جزیره برخورد می‌کنند!',
    tone: 'danger',
  },
};

const LANDMARK_ACTION_LABELS: Record<StrangeLandmarkId, string> = {
  ruins: 'اجرای آیین خورشید',
  volcano: 'آهنگری گدازه (نیزه آتشین)',
  mushroom: 'جذب معجون اسپور',
  shipwreck: 'نیایش معبد مدفون',
  spring: 'نوشیدن از چشمه بلورین',
};

const LANDMARK_SPECIAL_LABELS: Record<StrangeLandmarkId, string> = {
  ruins: 'پیشکش آفتاب (۲ صدف←۱۰ سکه)',
  volcano: 'کوره مذاب (۲ چوب←۷ سکه)',
  mushroom: 'شهد اسپور (توت و موز)',
  shipwreck: 'پیشکش سنگ‌نوشته (۱ صید←۹ سکه)',
  spring: 'آرزوی چشمه (+۲ صدف و ۵ سکه)',
};

const FIRE_UNLOCK_HINTS: Record<number, string> = {
  1: 'سطح ۲: موز کبابی در کمپ',
  2: 'سطح ۳: کمان صیاد + دفع شکارچی + سرعت بیشتر',
  3: 'سطح ۴: چکش توفان + ۱.۵ برابر تجربه',
  4: 'سطح ۵: شعله ابدی + باز شدن ساخت قایق چوبی',
  5: 'سطح ۶: گرمای برتر کمپ و مقاومت سونامی',
  6: 'سطح ۷: هاله طلایی و احیای سریع‌تر انرژی',
  7: 'سطح ۸: شعله فیروزه‌ای و ۱.۶ برابر تجربه',
  8: 'سطح ۹: نگهبان باستانی جزیره',
  9: 'سطح ۱۰: اوج شعله جاودان',
  10: 'شعله جاودان به حداکثر سطح ۱۰ رسید!',
};

const CATEGORY_LABELS: Record<AnimalCategory | 'all', string> = {
  all: 'همه',
  day: 'روزگرد',
  coastal: 'ساحل و دریا',
  night_predator: 'شکارچی شب',
  strange: 'موجودات عجیب',
};

const WEAPON_ANIM_CLASS: Record<WeaponId, string> = {
  axe: 'anim-axe-chop',
  spear: 'anim-spear-jab',
  bow: 'anim-bow-draw',
  hammer: 'anim-hammer-slam',
};

const INITIAL_HUD: HudSnapshot = {
  coins: 0,
  wood: 0,
  fish: 0,
  cookedFish: 0,
  banana: 0,
  roastedBanana: 0,
  meat: 0,
  cookedMeat: 0,
  huntedCount: 0,
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
  groundWetness: 0,
  season: 'summer',
  seasonMix: 0,
  isSwimming: false,
  activeEvent: 'none',
  eventPhase: 'idle',
  eventTimer: 0,
  hasSpear: false,
  hasFireSpear: false,
  canCraftSpear: false,
  equippedWeapon: 'axe',
  unlockedWeapons: { axe: true, spear: false, bow: false, hammer: false },
  weaponLevels: { axe: 1, spear: 1, bow: 1, hammer: 1 },
  weaponXp: { axe: 0, spear: 0, bow: 0, hammer: 0 },
  weaponXpToNext: {
    axe: CONFIG.SURVIVAL.WEAPON_XP_PER_LEVEL[1],
    spear: CONFIG.SURVIVAL.WEAPON_XP_PER_LEVEL[1],
    bow: CONFIG.SURVIVAL.WEAPON_XP_PER_LEVEL[1],
    hammer: CONFIG.SURVIVAL.WEAPON_XP_PER_LEVEL[1],
  },
  fireLit: false,
  fireLevel: 0,
  canIgniteFire: false,
  canStokeFire: false,
  venomTimer: 0,
  antidotes: 0,
  shellArmorCharges: 0,
  elixirTimer: 0,
  torchTimer: 0,
  baitCharges: 0,
  wreckLooted: false,
  bonesFound: 0,
  bonesTotal: 4,
  templeUnlocked: false,
  templeRelicClaimed: false,
  disasterChallenge: null,
  xp: 0,
  playerLevel: 1,
  playerXp: 0,
  playerXpToNext: CONFIG.PLAYER.LEVEL_XP_THRESHOLDS[1],
  skillPoints: 1,
  skills: {
    lumberjack: 0,
    backpacker: 0,
    pathfinder: 0,
    angler: 0,
    pyromancer: 0,
  },
  discoveredAnimals: [],
  secretsFound: 0,
  secretsTotal: CONFIG.SURVIVAL.SECRETS_COUNT,
  mysteriesFound: 0,
  mysteriesTotal: CONFIG.SURVIVAL.MYSTERY_SPOTS_COUNT,
  canVictoryVoyage: false,
  gameOutcome: 'playing',
  nearCampfire: false,
  backpackFullBlocked: false,
  lowEnergyBlocked: false,
  needSpearBlocked: false,
  needSpearHuntBlocked: false,
  predatorAlert: false,
  canEatFood: false,
  bestFoodKind: null,
  activeAction: 'idle',
  focusedTarget: null,
  buildings: { shelter: false, rack: false, pier: false, boat: false },
  nearbyPad: null,
  nearbyLandmark: null,
  wildlifeDifficulty: 'normal',
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
      | 'coin'
      | 'wood'
      | 'fish'
      | 'cookedFish'
      | 'banana'
      | 'roastedBanana'
      | 'meat'
      | 'cookedMeat'
      | 'berries'
      | 'shell',
      HTMLDivElement | null
    >
  >({
    coin: null,
    wood: null,
    fish: null,
    cookedFish: null,
    banana: null,
    roastedBanana: null,
    meat: null,
    cookedMeat: null,
    berries: null,
    shell: null,
  });

  const [screen, setScreen] = useState<AppScreenState>('loading');
  const [outcome, setOutcome] = useState<GameOutcome>('playing');
  const [activeRun, setActiveRun] = useState<ActiveRunInfo | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [flyingIcons, setFlyingIcons] = useState<FlyingIconAnim[]>([]);
  const [toastText, setToastText] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'wildlife' | 'workshop' | 'settings' | null>(null);
  const [wildlifeFilter, setWildlifeFilter] = useState<AnimalCategory | 'all'>('all');
  const [wildlifeDifficulty, setWildlifeDifficultyState] = useState<WildlifeDifficulty>('normal');
  const [muted, setMuted] = useState(false);
  const [savedRun, setSavedRun] = useState<SavedRunSummary | null>(null);
  const [damageFlash, setDamageFlash] = useState(false);
  const [damageNumbers, setDamageNumbers] = useState<
    Array<{ id: number; amount: number; x: number; y: number }>
  >([]);
  const [combatPopups, setCombatPopups] = useState<
    Array<{ id: number; damage: number; x: number; y: number; nameFa: string; defeated: boolean }>
  >([]);
  const damageIdRef = useRef(0);
  const damageFlashTimerRef = useRef<number | null>(null);

  useEffect(() => {
    document.body.dataset.state = outcome !== 'playing' ? 'gameover' : screen;
  }, [screen, outcome]);

  const showToast = useCallback((text: string) => {
    setToastText(text);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastText(null);
      toastTimerRef.current = null;
    }, 3400);
  }, []);

  const triggerFlyIcon = useCallback((evt: FlyingResourceEvent) => {
    const frameEl = frameRef.current;
    const targetEl = counterRefs.current[evt.kind] ?? counterRefs.current.coin;
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
          if (nextScreen === 'title') {
            setOutcome('playing');
          }
          if (runInfo) {
            setActiveRun(runInfo);
          } else if (nextScreen === 'title') {
            setActiveRun(null);
          }
        },
        onHudUpdate: (snapshot) => {
          setHud(snapshot);
          if (snapshot.gameOutcome !== 'playing') {
            setOutcome(snapshot.gameOutcome);
          }
        },
        onResourceFly: (evt) => {
          triggerFlyIcon(evt);
        },
        onNotice: (text) => {
          showToast(text);
        },
        onDamageTaken: (damage, screenX, screenY) => {
          setDamageFlash(true);
          if (damageFlashTimerRef.current !== null) {
            window.clearTimeout(damageFlashTimerRef.current);
          }
          damageFlashTimerRef.current = window.setTimeout(() => {
            setDamageFlash(false);
            damageFlashTimerRef.current = null;
          }, 340);
          const id = (damageIdRef.current += 1);
          setDamageNumbers((prev) => [
            ...prev.slice(-6),
            { id, amount: Math.max(1, Math.round(damage)), x: screenX, y: screenY },
          ]);
          window.setTimeout(() => {
            setDamageNumbers((prev) => prev.filter((item) => item.id !== id));
          }, 880);
        },
        onCombatHit: (damage, screenX, screenY, nameFa, defeated) => {
          const id = (damageIdRef.current += 1);
          setCombatPopups((prev) => [
            ...prev.slice(-6),
            { id, damage: Math.max(1, Math.round(damage)), x: screenX, y: screenY, nameFa, defeated },
          ]);
          window.setTimeout(() => {
            setCombatPopups((prev) => prev.filter((item) => item.id !== id));
          }, 840);
        },
        onOutcomeChange: (nextOutcome) => {
          setOutcome(nextOutcome);
          if (nextOutcome !== 'playing') {
            setActiveModal(null);
          }
        },
      },
      'normal',
      autostart
    );

    controllerRef.current = controller;
    setWildlifeDifficultyState(controller.getWildlifeDifficulty());
    setSavedRun(controller.getSavedRunSummary());

    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (damageFlashTimerRef.current !== null) {
        window.clearTimeout(damageFlashTimerRef.current);
      }
      controller.destroy();
      controllerRef.current = null;
    };
  }, [triggerFlyIcon, showToast]);

  const handleStartMode = useCallback((mode: GameMode, forceNewIsland = false) => {
    soundEngine.playClick();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setOutcome('playing');
    controllerRef.current?.startRun(mode, forceNewIsland);
    setSavedRun(null);
  }, []);

  const handleResumeSavedRun = useCallback(() => {
    soundEngine.playClick();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setOutcome('playing');
    const ok = controllerRef.current?.resumeSavedRun() ?? false;
    if (!ok) {
      soundEngine.playError();
      setSavedRun(null);
      showToast('فایل ذخیره معتبری پیدا نشد');
    }
  }, [showToast]);

  const handleReturnToMenu = useCallback(() => {
    soundEngine.playModalClose();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setActiveModal(null);
    setOutcome('playing');
    controllerRef.current?.returnToMenu();
    setSavedRun(controllerRef.current?.getSavedRunSummary() ?? null);
  }, []);

  const handleJoystickChange = useCallback((dx: number, dy: number) => {
    controllerRef.current?.setJoystickInput(dx, dy);
  }, []);

  const handleVictoryVoyage = useCallback(() => {
    soundEngine.playClick();
    controllerRef.current?.triggerVictoryVoyage();
  }, []);

  const handleEatFood = useCallback(() => {
    if (!controllerRef.current?.eatFood()) {
      soundEngine.playError();
    }
  }, []);

  const handleCraftSpear = useCallback(() => {
    if (!controllerRef.current?.craftSpear()) {
      soundEngine.playError();
    }
  }, []);

  const handleSelectWeapon = useCallback((id: WeaponId) => {
    controllerRef.current?.selectWeapon(id);
  }, []);

  const handleUpgradeWeapon = useCallback((id: WeaponId) => {
    if (!controllerRef.current?.upgradeWeapon(id)) {
      soundEngine.playError();
    }
  }, []);

  const handleSkipCutscene = useCallback(() => {
    soundEngine.playClick();
    controllerRef.current?.skipCutscene();
  }, []);

  const handleLightFire = useCallback(() => {
    if (!controllerRef.current?.lightFire()) {
      soundEngine.playError();
    }
  }, []);

  const handleStokeFire = useCallback(() => {
    if (!controllerRef.current?.stokeFire()) {
      soundEngine.playError();
    }
  }, []);

  const handleUseAntidote = useCallback(() => {
    if (!controllerRef.current?.useAntidote()) {
      soundEngine.playError();
    }
  }, []);

  const handleCraftWorkshop = useCallback((recipeId: WorkshopRecipeId) => {
    const res = controllerRef.current?.craftWorkshop(recipeId);
    if (!res?.crafted) {
      soundEngine.playError();
    }
  }, []);

  const handleInteract = useCallback(() => {
    soundEngine.playClick();
    controllerRef.current?.interact();
  }, []);

  const handleTriggerLandmark = useCallback((id: StrangeLandmarkId) => {
    const res = controllerRef.current?.triggerLandmark(id);
    if (!res?.triggered) {
      soundEngine.playError();
    }
  }, []);

  const handleTriggerLandmarkSpecial = useCallback((id: StrangeLandmarkId) => {
    const res = controllerRef.current?.triggerLandmarkSpecial(id);
    if (!res?.triggered) {
      soundEngine.playError();
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    const nextMuted = controllerRef.current?.toggleMute() ?? false;
    setMuted(nextMuted);
  }, []);

  const handleChangeDifficulty = useCallback((diff: WildlifeDifficulty) => {
    soundEngine.playClick();
    setWildlifeDifficultyState(diff);
    controllerRef.current?.setWildlifeDifficulty(diff);
  }, []);

  const toggleModal = useCallback((modal: 'wildlife' | 'workshop' | 'settings') => {
    setActiveModal((prev) => {
      if (prev === modal) {
        soundEngine.playModalClose();
        return null;
      }
      soundEngine.playModalOpen();
      return modal;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (activeModal && event.key === 'Escape') {
        event.preventDefault();
        soundEngine.playModalClose();
        setActiveModal(null);
      } else if (screen === 'title' && !activeModal && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        handleStartMode('normal', false);
      } else if (screen === 'playing' && event.key === 'Escape') {
        event.preventDefault();
        handleReturnToMenu();
      } else if (screen === 'playing' && !activeModal && event.code === 'KeyE') {
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
  } else if (hud.venomTimer > 0) {
    survivalNotice = {
      text: `سم مار فعال است (${toPersianDigits(hud.venomTimer)} ث) · پادزهر یا چشمه بلورین`,
      tone: 'warn',
    };
  } else if (hud.predatorAlert) {
    survivalNotice = {
      text: 'خطر شکارچی شب! به آتش روشن نزدیک شو یا مشعل بساز',
      tone: 'warn',
    };
  } else if (hud.needSpearBlocked) {
    survivalNotice = {
      text: 'برای ماهی‌گیری در آب، اول نیزه بساز (۲ چوب)',
      tone: 'warn',
    };
  } else if (hud.needSpearHuntBlocked) {
    survivalNotice = {
      text: 'برای شکار این جانور اول نیزه بساز (۲ چوب)',
      tone: 'warn',
    };
  } else if (hud.backpackFullBlocked) {
    survivalNotice = { text: 'کوله پر شد! کنار آتش کمپ خالی کن', tone: 'warn' };
  } else if (hud.lowEnergyBlocked) {
    survivalNotice = { text: 'انرژی کم است! غذا بخور یا کنار آتش روشن بمان', tone: 'warn' };
  } else if (hud.activeAction === 'chop') {
    survivalNotice = { text: 'در حال قطع درخت با تبر...', tone: 'warm' };
  } else if (hud.activeAction === 'climb') {
    survivalNotice = { text: 'در حال بالا رفتن از درخت موز...', tone: 'warm' };
  } else if (hud.activeAction === 'cast_fish') {
    survivalNotice = { text: 'در حال ماهی‌گیری با قلاب...', tone: 'warm' };
  } else if (hud.activeAction === 'spear_fish') {
    survivalNotice = { text: 'در حال صید ماهی با نیزه در آب...', tone: 'warm' };
  } else if (hud.activeAction === 'hunt') {
    survivalNotice = { text: 'در حال شکار و تعقیب جانور...', tone: 'warm' };
  } else if (hud.activeAction === 'bow_hunt') {
    survivalNotice = { text: 'شلیک تیر با کمان صیاد!', tone: 'warm' };
  } else if (hud.activeAction === 'hammer_slam') {
    survivalNotice = { text: 'موج ضربه چکش توفان!', tone: 'warm' };
  } else if (hud.activeAction === 'forage') {
    survivalNotice = { text: 'در حال جمع‌آوری از طبیعت...', tone: 'warm' };
  } else if (hud.activeAction === 'secret_open') {
    survivalNotice = { text: 'گشودن صندوق مخفی جزیره...', tone: 'warm' };
  } else if (hud.activeAction === 'mystery_open') {
    survivalNotice = { text: 'بررسی شیء مرموز جزیره...', tone: 'warm' };
  } else if (hud.activeAction === 'salvage') {
    survivalNotice = { text: 'در حال جست‌وجو در لاشه هواپیما...', tone: 'warm' };
  } else if (hud.activeAction === 'inspect') {
    survivalNotice = { text: 'در حال بررسی استخوان‌های باستانی...', tone: 'warm' };
  } else if (hud.activeAction === 'build' && hud.nearbyPad) {
    survivalNotice = { text: `در حال ساخت ${PAD_LABELS[hud.nearbyPad.id]}...`, tone: 'warm' };
  } else if (hud.nearbyPad && hud.nearbyPad.totalWood < hud.nearbyPad.cost) {
    survivalNotice = {
      text: `${PAD_LABELS[hud.nearbyPad.id]} · نیاز به ${toPersianDigits(hud.nearbyPad.cost)} چوب`,
      tone: 'warn',
    };
  } else if (hud.activeAction === 'cook') {
    survivalNotice = { text: 'در حال کباب کردن روی آتش...', tone: 'warm' };
  } else if (hud.nearCampfire && !hud.fireLit) {
    survivalNotice = {
      text: `آتش کمپ خاموش است · ${toPersianDigits(CONFIG.SURVIVAL.FIRE_IGNITE_WOOD_COST)} چوب جمع کن`,
      tone: 'warn',
    };
  } else if (hud.nearCampfire && hud.fireLit) {
    survivalNotice = {
      text: `آتش سطح ${toPersianDigits(hud.fireLevel)} · ${FIRE_UNLOCK_HINTS[hud.fireLevel] ?? ''}`,
      tone: 'warm',
    };
  } else if (hud.focusedTarget && !hud.focusedTarget.blockedReason) {
    survivalNotice = {
      text: `${hud.focusedTarget.labelFa} (ضربه یا F)`,
      tone: 'warm',
    };
  }

  const activeEventInfo =
    hud.activeEvent !== 'none' ? WORLD_EVENT_LABELS[hud.activeEvent] : null;
  const isWetWeather = hud.weather === 'rain' || hud.weather === 'storm';
  const playerXpRatio =
    hud.playerLevel >= CONFIG.PLAYER.MAX_LEVEL
      ? 1
      : Math.max(0, Math.min(1, hud.playerXp / Math.max(1, hud.playerXpToNext)));

  const quickIsCombat =
    hud.focusedTarget?.kind === 'prey' &&
    (hud.focusedTarget.action === 'hunt' || hud.focusedTarget.action === 'bow_hunt');
  const quickIsSecretOrMystery =
    hud.focusedTarget?.kind === 'secret' || hud.focusedTarget?.kind === 'mystery';

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
        <VirtualJoystick
          enabled={screen === 'playing' && outcome === 'playing' && !activeModal}
          onChange={handleJoystickChange}
        />

        {/* Damage Screen Red Vignette & Floating Damage Numbers */}
        {screen === 'playing' && (
          <div
            className="pointer-events-none absolute inset-0 z-25 transition-opacity duration-200"
            style={{
              opacity: damageFlash ? 1 : 0,
              boxShadow: 'inset 0 0 84px rgba(214, 34, 34, 0.78)',
            }}
            aria-hidden="true"
          />
        )}
        {screen === 'playing' &&
          damageNumbers.map((dmg) => (
            <div
              key={dmg.id}
              data-testid="damage-popup"
              className="pointer-events-none fixed sm:absolute z-30 text-lg font-black text-[#ff3b30] damage-float-anim tabular-nums"
              style={{
                left: `${dmg.x}px`,
                top: `${dmg.y}px`,
                textShadow: '0 2px 0 #590a06, 0 0 8px rgba(255, 255, 255, 0.9)',
              }}
            >
              -{toPersianDigits(dmg.amount)}
            </div>
          ))}
        {screen === 'playing' &&
          combatPopups.map((hit) => (
            <div
              key={hit.id}
              data-testid="combat-hit-popup"
              className={`pointer-events-none fixed sm:absolute z-30 font-black damage-float-anim tabular-nums ${
                hit.defeated ? 'text-base text-[#ffe066]' : 'text-lg text-[#ff9f1c]'
              }`}
              style={{
                left: `${hit.x}px`,
                top: `${hit.y}px`,
                textShadow: '0 2px 0 #4a1c03, 0 0 8px rgba(255, 240, 180, 0.9)',
              }}
            >
              -{toPersianDigits(hit.damage)}
              {hit.defeated ? ' ✕' : ''}
            </div>
          ))}

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
              {item.kind === 'meat' && <MeatSvg />}
              {item.kind === 'cookedMeat' && <CookedMeatSvg />}
              {item.kind === 'berries' && <BerrySvg />}
              {item.kind === 'shell' && <ShellSvg />}
            </div>
          ))}

        {/* Title Screen Overlay */}
        {screen === 'title' && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between px-5 pt-5 pb-6">
            <div className="flex flex-col items-center">
              <div className="w-full flex items-center justify-end">
                <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    data-testid="open-settings-btn"
                    onClick={() => toggleModal('settings')}
                    aria-label="تنظیمات"
                    title="تنظیمات"
                    className="btn-game btn-wood w-10 h-10 rounded-xl text-[#fff8eb] cursor-pointer flex items-center justify-center shrink-0"
                  >
                    <SettingsGearSvg className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    data-testid="toggle-mute-btn"
                    onClick={handleToggleMute}
                    aria-label={muted ? 'وصل صدا' : 'قطع صدا'}
                    className="btn-game btn-wood w-10 h-10 rounded-xl text-[#fff8eb] cursor-pointer flex items-center justify-center shrink-0"
                  >
                    <span className={!muted ? 'anim-sound-wave inline-flex' : 'inline-flex'}>
                      <VolumeIcon muted={muted} />
                    </span>
                  </button>
                </div>
              </div>

              <div className="relative mt-3 sm:mt-4 flex flex-col items-center text-center anim-title-float">
                <div
                  className="pointer-events-none absolute -inset-x-10 -inset-y-4 rounded-full blur-xl opacity-55"
                  style={{
                    background:
                      'radial-gradient(ellipse at center, rgba(12, 46, 74, 0.72) 0%, rgba(12, 46, 74, 0) 72%)',
                  }}
                  aria-hidden="true"
                />
                <div className="relative flex items-center gap-2 mb-1 opacity-95" aria-hidden="true">
                  <span className="w-8 h-[2px] rounded-full bg-gradient-to-l from-[#ffe066] to-transparent" />
                  <CompassMiniSvg className="w-4 h-4 drop-shadow-[0_2px_4px_rgba(8,36,60,0.6)]" />
                  <span className="w-8 h-[2px] rounded-full bg-gradient-to-r from-[#ffe066] to-transparent" />
                </div>
                <div className="relative select-none">
                  <span
                    aria-hidden="true"
                    className="font-display text-6xl sm:text-7xl leading-none block text-[#114d78]"
                    style={{
                      textShadow:
                        '0 4px 0 #0a3454, 0 8px 18px rgba(5, 28, 48, 0.68), 0 0 28px rgba(255, 214, 102, 0.35)',
                    }}
                  >
                    جزیره بقا
                  </span>
                  <h1
                    className="font-display text-6xl sm:text-7xl leading-none absolute inset-0 bg-gradient-to-b from-[#fffef8] via-[#ffeaa3] to-[#ffb938] bg-clip-text text-transparent"
                  >
                    جزیره بقا
                  </h1>
                </div>
              </div>
            </div>

            <div className="pointer-events-auto self-center w-full max-w-[300px] flex flex-col gap-2.5">
              {savedRun && (
                <button
                  type="button"
                  data-testid="resume-saved-btn"
                  onClick={handleResumeSavedRun}
                  className="btn-game btn-emerald anim-btn-sheen w-full min-h-[52px] px-4 py-2.5 rounded-2xl text-white font-extrabold text-sm cursor-pointer flex items-center justify-between gap-2"
                  style={{ textShadow: '0 1px 2px rgba(6, 78, 59, 0.7)' }}
                >
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <PlayArrowIcon className="w-5 h-5 shrink-0 anim-play-nudge" />
                    <span>ادامه بازی</span>
                  </span>
                  <span className="text-[11px] font-black tabular-nums text-[#ecfdf5] whitespace-nowrap">
                    روز {toPersianDigits(savedRun.dayCount)} · سطح {toPersianDigits(savedRun.playerLevel)}
                  </span>
                </button>
              )}

              <button
                type="button"
                data-start="true"
                onClick={() => handleStartMode('normal', false)}
                className="btn-game btn-primary-amber anim-btn-sheen w-full min-h-[56px] px-5 py-3 rounded-2xl text-white font-black text-lg cursor-pointer flex items-center justify-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                style={{ textShadow: '0 2px 0 rgba(145, 58, 5, 0.7)' }}
              >
                <PlayArrowIcon className="w-6 h-6 shrink-0 anim-play-nudge" />
                <span className="whitespace-nowrap">
                  {savedRun ? 'بازی جدید' : 'شروع بازی'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleStartMode('normal', true)}
                className="btn-game btn-wood w-full min-h-[44px] px-4 py-2 rounded-xl text-[#fff8eb] font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                style={{ textShadow: '0 1px 0 rgba(88, 38, 9, 0.7)' }}
                title="ساخت جزیره تصادفی جدید"
              >
                <RefreshMiniIcon className="w-4 h-4 shrink-0 text-[#ffe066] anim-compass-wiggle" />
                <span>جزیره جدید</span>
              </button>
            </div>
          </div>
        )}

        {/* 3D Airplane Crash Intro Cutscene Overlay (Clean Cinematic HUD) */}
        {screen === 'cutscene' && (
          <div
            data-testid="cutscene-overlay"
            className="pointer-events-none absolute inset-0 z-25 flex flex-col justify-between p-3.5 sm:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="hud-glass-dark px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#fff3d6] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#ffb822] animate-pulse shrink-0" />
                <span className="whitespace-nowrap">سقوط بر فراز جزیره ناشناخته</span>
              </div>

              <button
                type="button"
                data-testid="toggle-mute-btn"
                onClick={handleToggleMute}
                aria-label={muted ? 'وصل صدا' : 'قطع صدا'}
                className="pointer-events-auto btn-game btn-wood w-10 h-10 rounded-xl text-[#fff8eb] cursor-pointer flex items-center justify-center shrink-0"
              >
                <span className={!muted ? 'anim-sound-wave inline-flex' : 'inline-flex'}>
                  <VolumeIcon muted={muted} />
                </span>
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 pb-3">
              <p className="hud-glass-dark max-w-[460px] px-4 py-3 rounded-2xl text-center text-xs sm:text-sm font-semibold leading-relaxed text-[#f8fafc] text-balance">
                موتور هواپیما از کار افتاد! با چتر نجات روی جزیره فرود بیا، لاشه هواپیما را بگرد و برای روشن کردن آتش کمپ ۲ چوب جمع کن.
              </p>

              <button
                type="button"
                data-testid="skip-cutscene-btn"
                onClick={handleSkipCutscene}
                className="pointer-events-auto btn-game btn-primary-amber anim-btn-sheen min-h-[44px] px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-extrabold cursor-pointer flex items-center gap-2 whitespace-nowrap"
                style={{ textShadow: '0 1px 1px rgba(145, 58, 5, 0.7)' }}
              >
                <span>ورود فوری به جزیره</span>
                <SkipChevronsSvg className="w-4 h-4 anim-skip-glide" />
              </button>
            </div>
          </div>
        )}

        {/* 3D Ending Boat Launch & Rowing Cutscene Overlay */}
        {screen === 'ending_cutscene' && (
          <div
            data-testid="ending-cutscene-overlay"
            className="pointer-events-none absolute inset-0 z-25 flex flex-col justify-between p-3.5 sm:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="hud-glass-dark px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#bdeeff] flex items-center gap-2">
                <BoatMiniSvg className="anim-boat-rock" />
                <span className="whitespace-nowrap">به سوی خانه · قایق به آب انداخته شد</span>
              </div>

              <button
                type="button"
                data-testid="toggle-mute-btn"
                onClick={handleToggleMute}
                aria-label={muted ? 'وصل صدا' : 'قطع صدا'}
                className="pointer-events-auto btn-game btn-wood w-10 h-10 rounded-xl text-[#fff8eb] cursor-pointer flex items-center justify-center shrink-0"
              >
                <span className={!muted ? 'anim-sound-wave inline-flex' : 'inline-flex'}>
                  <VolumeIcon muted={muted} />
                </span>
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 pb-3">
              <p className="hud-glass-dark max-w-[460px] px-4 py-3 rounded-2xl text-center text-xs sm:text-sm font-semibold leading-relaxed text-[#f8fafc] text-balance">
                قایق چوبی آماده شد! بازمانده قایق را به آب می‌اندازد و با پاروزدن میان موج‌ها جزیره را به سوی خانه ترک می‌کند.
              </p>

              <button
                type="button"
                data-testid="skip-ending-btn"
                onClick={handleSkipCutscene}
                className="pointer-events-auto btn-game btn-primary-amber anim-btn-sheen min-h-[44px] px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-extrabold cursor-pointer flex items-center gap-2 whitespace-nowrap"
                style={{ textShadow: '0 1px 1px rgba(145, 58, 5, 0.7)' }}
              >
                <span>نمایش نتیجه پیروزی</span>
                <SkipChevronsSvg className="w-4 h-4 anim-skip-glide" />
              </button>
            </div>
          </div>
        )}

        {/* Clean Zero-Overlap Survival HUD Overlay */}
        {screen === 'playing' && activeRun && (
          <div className="pointer-events-none absolute inset-0 z-20">
            {/* Unified Top Stack: Header Bar -> Resource Ribbon -> Status Line -> Event/Notice Banners */}
            <div className="pointer-events-none absolute top-2 inset-x-2 sm:inset-x-3 flex flex-col gap-1.5">
              {/* Row 1: Level & Energy (Right) + Menu & Modals Toolbar (Left) */}
              <div
                className="flex items-center justify-between gap-1.5 flex-wrap"
                data-testid="hud-top-left"
              >
                {/* Player Level & Energy Card */}
                <div className="hud-glass-warm rounded-2xl px-2.5 py-1.5 flex items-center gap-2.5 shrink-0">
                  <div
                    className="flex flex-col gap-0.5 min-w-[66px] sm:min-w-[82px]"
                    data-testid="hud-player-level"
                  >
                    <div className="flex items-center justify-between gap-1.5 text-[10px] font-extrabold text-[#4b3010] whitespace-nowrap">
                      <span>سطح {toPersianDigits(hud.playerLevel)}</span>
                      <span className="tabular-nums text-[9px] text-[#8a5d1f]">
                        {hud.playerLevel >= CONFIG.PLAYER.MAX_LEVEL
                          ? 'اوج'
                          : `${toPersianDigits(hud.playerXp)}/${toPersianDigits(hud.playerXpToNext)}`}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full wood-well overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-[#3bc9db] to-[#ffd233] transition-transform duration-200 origin-right"
                        style={{ transform: `scaleX(${Math.max(0.05, playerXpRatio)})` }}
                      />
                    </div>
                  </div>

                  <div className="w-px h-6 bg-[#dec79c] shrink-0" aria-hidden="true" />

                  <div className="flex items-center gap-1.5 min-w-[92px] sm:min-w-[114px]">
                    <EnergyBoltSvg />
                    <div className="flex-1 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-1 text-[10px] font-extrabold text-[#4b3010] whitespace-nowrap">
                        <span>انرژی</span>
                        <span className="tabular-nums">
                          {toPersianDigits(hud.energy)}/{toPersianDigits(hud.maxEnergy)}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full wood-well p-[1px] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-transform duration-200 origin-right ${
                            energyRatio < 0.28
                              ? 'bg-gradient-to-l from-[#ff5e3a] to-[#ffb703]'
                              : 'bg-gradient-to-l from-[#6ee040] to-[#ffd233]'
                          }`}
                          style={{ transform: `scaleX(${Math.max(0.04, energyRatio)})` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compact Animated Toolbar: Workshop, Wildlife, Mute, Menu */}
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <button
                    type="button"
                    data-testid="open-workshop-btn"
                    onClick={() => toggleModal('workshop')}
                    className="pointer-events-auto btn-game btn-wood min-h-[38px] px-2.5 py-1.5 rounded-xl text-[#fff8eb] text-[10.5px] font-extrabold cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
                    style={{ textShadow: '0 1px 0 rgba(88, 38, 9, 0.7)' }}
                  >
                    <FlameMiniSvg className="w-3.5 h-3.5 shrink-0 anim-flame-dance" />
                    <span>کارگاه</span>
                  </button>

                  <button
                    type="button"
                    data-testid="open-wildlife-btn"
                    onClick={() => toggleModal('wildlife')}
                    className="pointer-events-auto btn-game btn-wood min-h-[38px] px-2.5 py-1.5 rounded-xl text-[#fff8eb] text-[10.5px] font-extrabold cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
                    style={{ textShadow: '0 1px 0 rgba(88, 38, 9, 0.7)' }}
                  >
                    <PawMiniSvg className="w-3.5 h-3.5 shrink-0 anim-paw-step" />
                    <span className="tabular-nums">
                      {toPersianDigits(hud.discoveredAnimals.length)}/{toPersianDigits(ANIMAL_SPECIES.length)}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="open-settings-btn"
                    onClick={() => toggleModal('settings')}
                    aria-label="تنظیمات"
                    title="تنظیمات"
                    className="pointer-events-auto btn-game btn-wood min-h-[38px] w-9 rounded-xl text-[#fff8eb] cursor-pointer flex items-center justify-center shrink-0"
                  >
                    <SettingsGearSvg className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    data-testid="toggle-mute-btn"
                    onClick={handleToggleMute}
                    aria-label={muted ? 'وصل صدا' : 'قطع صدا'}
                    title={muted ? 'وصل صدا' : 'قطع صدا'}
                    className="pointer-events-auto btn-game btn-wood min-h-[38px] w-9 rounded-xl text-[#fff8eb] cursor-pointer flex items-center justify-center shrink-0"
                  >
                    <span className={!muted ? 'anim-sound-wave inline-flex' : 'inline-flex'}>
                      <VolumeIcon muted={muted} />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReturnToMenu}
                    aria-label="منوی اصلی"
                    title="منوی اصلی"
                    className="pointer-events-auto btn-game btn-wood min-h-[38px] px-2.5 py-1.5 rounded-xl text-[#fff8eb] text-[10.5px] font-extrabold cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
                    style={{ textShadow: '0 1px 0 rgba(88, 38, 9, 0.7)' }}
                  >
                    <HomeMiniSvg />
                    <span className="hidden sm:inline">منو</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Unified Resource Ribbon + Crisp Unboxed Status Metadata */}
              <div className="flex flex-col items-start gap-1" data-testid="hud-top-right">
                <div className="hud-glass-warm rounded-xl px-2.5 py-1 flex items-center gap-2.5 flex-wrap max-w-full">
                  <HudResourceItem
                    ref={(el) => {
                      counterRefs.current.coin = el;
                    }}
                    label="سکه"
                    value={hud.coins}
                    icon={<CoinSvg />}
                    accentClass="text-[#a15c07]"
                  />
                  <HudResourceItem
                    ref={(el) => {
                      counterRefs.current.wood = el;
                    }}
                    label="چوب"
                    value={hud.wood}
                    icon={<WoodSvg />}
                  />
                  <HudResourceItem
                    ref={(el) => {
                      counterRefs.current.fish = el;
                    }}
                    label="ماهی"
                    value={hud.fish}
                    icon={<FishSvg />}
                  />
                  <HudResourceItem
                    ref={(el) => {
                      counterRefs.current.cookedFish = el;
                    }}
                    label="ماهی کبابی"
                    value={hud.cookedFish}
                    icon={<CookedFishSvg />}
                    accentClass="text-[#9e3f08]"
                  />
                  <HudResourceItem
                    ref={(el) => {
                      counterRefs.current.banana = el;
                    }}
                    label="موز"
                    value={hud.banana}
                    icon={<BananaSvg />}
                  />
                  {hud.roastedBanana > 0 && (
                    <HudResourceItem
                      ref={(el) => {
                        counterRefs.current.roastedBanana = el;
                      }}
                      label="موز کبابی"
                      value={hud.roastedBanana}
                      icon={<RoastedBananaSvg />}
                      accentClass="text-[#9e3f08]"
                    />
                  )}
                  {hud.meat > 0 && (
                    <HudResourceItem
                      ref={(el) => {
                        counterRefs.current.meat = el;
                      }}
                      label="گوشت خام"
                      value={hud.meat}
                      icon={<MeatSvg />}
                      accentClass="text-[#9b2c1a]"
                    />
                  )}
                  {(hud.cookedMeat > 0 || hud.huntedCount > 0) && (
                    <HudResourceItem
                      ref={(el) => {
                        counterRefs.current.cookedMeat = el;
                      }}
                      label="گوشت کبابی"
                      value={hud.cookedMeat}
                      icon={<CookedMeatSvg />}
                      accentClass="text-[#9e3f08]"
                    />
                  )}
                  <HudResourceItem
                    ref={(el) => {
                      counterRefs.current.berries = el;
                    }}
                    label="توت"
                    value={hud.berries}
                    icon={<BerrySvg />}
                  />
                  <HudResourceItem
                    ref={(el) => {
                      counterRefs.current.shell = el;
                    }}
                    label="صدف"
                    value={hud.shells}
                    icon={<ShellSvg />}
                  />
                </div>

                {/* Unboxed Status Metadata Strip (Zero-Pill Rule) */}
                <div
                  className="px-1.5 flex items-center gap-x-2 gap-y-0.5 flex-wrap text-[10.5px] font-bold text-[#fffdf5]"
                  style={{ textShadow: '0 1px 4px rgba(5, 28, 52, 0.85)' }}
                >
                  <span className="inline-flex items-center gap-1 whitespace-nowrap" data-testid="hud-day-weather">
                    <PhaseWeatherIcon phase={hud.phase} weather={hud.weather} />
                    <span>
                      روز {toPersianDigits(hud.dayCount)} · {PHASE_LABELS[hud.phase]} ·{' '}
                      {WEATHER_LABELS[hud.weather]}
                    </span>
                  </span>

                  <span className="opacity-65">·</span>

                  <span className="inline-flex items-center gap-1 whitespace-nowrap" data-testid="hud-biome">
                    <CompassMiniSvg className="w-3.5 h-3.5 shrink-0 anim-compass-wiggle" />
                    <span>{BIOME_LABELS[hud.biome]}</span>
                  </span>

                  <span className="opacity-65">·</span>

                  <span
                    className="inline-flex items-center gap-1 tabular-nums whitespace-nowrap"
                    data-testid="hud-secrets-badge"
                  >
                    <SecretChestMiniSvg />
                    <span>
                      اسرار {toPersianDigits(hud.secretsFound)}/{toPersianDigits(hud.secretsTotal)}
                    </span>
                  </span>

                  <span className="opacity-65">·</span>

                  <span
                    className="inline-flex items-center gap-1 tabular-nums whitespace-nowrap text-[#e0f2fe]"
                    data-testid="hud-mysteries-badge"
                  >
                    <span>
                      مرموز {toPersianDigits(hud.mysteriesFound)}/{toPersianDigits(hud.mysteriesTotal)}
                    </span>
                  </span>

                  <span className="opacity-65">·</span>

                  <span
                    className={`tabular-nums whitespace-nowrap ${
                      hud.templeRelicClaimed
                        ? 'text-[#fde68a]'
                        : hud.bonesFound >= hud.bonesTotal
                          ? 'text-[#5eead4]'
                          : ''
                    }`}
                    data-testid="hud-bones-badge"
                  >
                    {hud.templeRelicClaimed
                      ? 'گنج معبد یافت شد'
                      : hud.bonesFound >= hud.bonesTotal
                        ? '۴/۴ استخوان · معبد آماده!'
                        : `استخوان ${toPersianDigits(hud.bonesFound)}/${toPersianDigits(hud.bonesTotal)}`}
                  </span>

                  {(isWetWeather || hud.groundWetness >= 0.35) && (
                    <span className="text-[#bae6fd] whitespace-nowrap" data-testid="hud-weather-effect">
                      · {hud.weather === 'storm' ? 'توفان (صید ۲×)' : 'زمین خیس'}
                    </span>
                  )}

                  {hud.season !== 'summer' && (
                    <span
                      className={`inline-flex items-center gap-1 whitespace-nowrap ${
                        hud.season === 'autumn' ? 'text-[#fed7aa]' : 'text-[#bae6fd]'
                      }`}
                      data-testid="hud-season-badge"
                    >
                      · <SeasonMiniSvg season={hud.season} />
                      <span>{hud.season === 'autumn' ? 'پاییز' : 'زمستان'}</span>
                    </span>
                  )}

                  {hud.isSwimming && (
                    <span className="text-[#7dd3fc] whitespace-nowrap" data-testid="hud-swim-badge">
                      · در حال شنا
                    </span>
                  )}

                  {hud.hasSpear && (
                    <span
                      className={`inline-flex items-center gap-1 whitespace-nowrap ${
                        hud.hasFireSpear ? 'text-[#fdba74]' : ''
                      }`}
                      data-testid="hud-spear-badge"
                    >
                      · {hud.hasFireSpear ? 'نیزه آتشین' : 'نیزه'}
                    </span>
                  )}

                  {hud.buildings.boat && (
                    <span className="text-[#bae6fd] whitespace-nowrap" data-testid="hud-boat-badge">
                      ·{' '}
                      {hud.playerLevel >= CONFIG.SURVIVAL.VICTORY_MIN_LEVEL
                        ? 'قایق آماده بازگشت'
                        : `قایق (سطح ${toPersianDigits(CONFIG.SURVIVAL.VICTORY_MIN_LEVEL)})`}
                    </span>
                  )}

                  {hud.venomTimer > 0 && (
                    <span
                      className="text-[#86efac] font-black tabular-nums whitespace-nowrap"
                      data-testid="hud-venom-badge"
                    >
                      · مسموم {toPersianDigits(hud.venomTimer)} ث
                    </span>
                  )}

                  {hud.shellArmorCharges > 0 && (
                    <span className="text-[#7dd3fc] tabular-nums whitespace-nowrap">
                      · سپر صدف ×{toPersianDigits(hud.shellArmorCharges)}
                    </span>
                  )}
                  {hud.elixirTimer > 0 && (
                    <span className="text-[#e9d5ff] tabular-nums whitespace-nowrap">
                      · چابکی {toPersianDigits(hud.elixirTimer)} ث
                    </span>
                  )}
                  {hud.torchTimer > 0 && (
                    <span className="text-[#fed7aa] tabular-nums whitespace-nowrap">
                      · مشعل {toPersianDigits(hud.torchTimer)} ث
                    </span>
                  )}
                  {hud.baitCharges > 0 && (
                    <span className="text-[#fde68a] tabular-nums whitespace-nowrap">
                      · طعمه ×{toPersianDigits(hud.baitCharges)}
                    </span>
                  )}
                </div>
              </div>

              {/* Event / Disaster Challenge / Notice Stack (in natural flow -> NEVER overlaps header!) */}
              {(activeEventInfo || hud.disasterChallenge || survivalNotice) && !activeModal && (
                <div className="self-center max-w-[94%] sm:max-w-[520px] flex flex-col items-center gap-1 mt-0.5">
                  {activeEventInfo && (
                    <div
                      data-testid="world-event-banner"
                      className={`px-3.5 py-1 rounded-xl shadow-md flex items-center gap-2 text-center border ${
                        activeEventInfo.tone === 'danger'
                          ? 'bg-[#fff0ec]/95 text-[#991b1b] border-[#fca5a5]'
                          : activeEventInfo.tone === 'magic'
                            ? 'bg-[#ecf8ff]/95 text-[#0e5682] border-[#7dd3fc]'
                            : 'bg-[#fff7dc]/95 text-[#8a4f0a] border-[#fcd34d]'
                      }`}
                    >
                      <SparkMiniSvg />
                      <div className="flex items-center gap-1.5 text-[11px] font-extrabold whitespace-nowrap">
                        <span>{activeEventInfo.title}</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-white/75 text-[9.5px] font-black tabular-nums">
                          {hud.eventPhase === 'warning' ? 'هشدار' : 'در جریان'} ·{' '}
                          {toPersianDigits(hud.eventTimer)} ث
                        </span>
                      </div>
                    </div>
                  )}

                  {hud.disasterChallenge && (
                    <div
                      data-testid="disaster-challenge-banner"
                      className={`px-3 py-1 rounded-xl shadow-sm border text-[10.5px] font-extrabold flex items-center gap-2 text-center ${
                        hud.disasterChallenge.status === 'failed'
                          ? 'bg-[#fee2e2]/95 text-[#991b1b] border-[#fca5a5]'
                          : 'bg-[#fef3c7]/95 text-[#78350f] border-[#fbbf24]'
                      }`}
                    >
                      <span>
                        {hud.disasterChallenge.titleFa}: {hud.disasterChallenge.goalFa}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-white/80 text-[9.5px] tabular-nums shrink-0">
                        {hud.disasterChallenge.status === 'failed'
                          ? 'آسیب دیده'
                          : `+${toPersianDigits(hud.disasterChallenge.rewardCoins)} سکه`}
                      </span>
                    </div>
                  )}

                  {survivalNotice && (
                    <div
                      data-testid="survival-notice"
                      className={`px-3.5 py-1 rounded-xl text-[11px] font-bold shadow-md text-center max-w-full truncate ${
                        survivalNotice.tone === 'warn'
                          ? 'bg-[#7c1d13]/90 text-[#fff5f2] border border-[#fca5a5]/50'
                          : 'bg-[#0e263d]/86 text-[#fff9e6] border border-white/20'
                      }`}
                    >
                      {survivalNotice.text}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom-Left: Weapon Dock with Per-Weapon Animations + Backpack Meter */}
            <div
              className="absolute bottom-3 left-2.5 sm:bottom-3.5 sm:left-3 flex flex-col items-end gap-1.5"
              data-testid="hud-bottom-left"
            >
              <div
                className="pointer-events-auto hud-glass-warm rounded-2xl p-1 grid grid-cols-2 sm:flex sm:items-center gap-1"
                data-testid="weapon-bar"
              >
                {CONFIG.WEAPON_SPECS.map((spec) => {
                  const unlocked = hud.unlockedWeapons[spec.id];
                  const lvl = hud.weaponLevels[spec.id];
                  const wXp = hud.weaponXp[spec.id];
                  const wXpMax = Math.max(1, hud.weaponXpToNext[spec.id]);
                  const wXpRatio =
                    lvl >= CONFIG.SURVIVAL.MAX_WEAPON_LEVEL
                      ? 1
                      : Math.max(0, Math.min(1, wXp / wXpMax));
                  const active = hud.equippedWeapon === spec.id;
                  const canUpgrade =
                    unlocked &&
                    lvl < CONFIG.SURVIVAL.MAX_WEAPON_LEVEL &&
                    hud.wood >= CONFIG.SURVIVAL.WEAPON_UPGRADE_WOOD_COST;
                  const lockHint =
                    spec.id === 'spear'
                      ? '۲ چوب'
                      : `آتش ${toPersianDigits(spec.unlockFireLevel)}`;

                  return (
                    <div key={spec.id} className="flex items-center gap-0.5">
                      <button
                        type="button"
                        data-testid={`weapon-btn-${spec.id}`}
                        title={spec.descFa}
                        onClick={() => {
                          if (unlocked) {
                            handleSelectWeapon(spec.id);
                          } else if (spec.id === 'spear' && hud.canCraftSpear) {
                            handleCraftSpear();
                          } else {
                            soundEngine.playError();
                            showToast(
                              spec.id === 'spear'
                                ? 'برای ساخت نیزه ۲ چوب لازم است'
                                : `برای باز کردن ${spec.nameFa}، آتش کمپ را به سطح ${toPersianDigits(spec.unlockFireLevel)} برسان`
                            );
                          }
                        }}
                        className={`btn-game px-2 py-1 rounded-xl flex flex-col gap-0.5 text-[10px] font-extrabold cursor-pointer whitespace-nowrap ${
                          active
                            ? 'btn-primary-amber text-white'
                            : unlocked
                              ? 'bg-[#fff9e8] text-[#4b3010] hover:bg-[#ffefc9]'
                              : 'bg-[#ead9bc]/75 text-[#8b6f47]'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span
                            className={
                              active || unlocked
                                ? `${WEAPON_ANIM_CLASS[spec.id]} inline-flex`
                                : 'inline-flex'
                            }
                          >
                            <WeaponMiniSvg id={spec.id} fireSpear={hud.hasFireSpear} />
                          </span>
                          <span className="hidden sm:inline">{spec.nameFa}</span>
                          <span
                            className={`text-[9px] tabular-nums px-1 rounded-md ${
                              active
                                ? 'bg-white/25 text-white'
                                : unlocked
                                  ? 'bg-[#f1dfba] text-[#6d4515]'
                                  : 'bg-[#dfd0b0] text-[#7c613c]'
                            }`}
                          >
                            {unlocked ? `س${toPersianDigits(lvl)}` : lockHint}
                          </span>
                        </div>

                        {unlocked && (
                          <div
                            data-testid={`weapon-xp-${spec.id}`}
                            className={`w-full h-1 rounded-full overflow-hidden ${
                              active ? 'bg-black/25' : 'bg-[#e3cfa8]'
                            }`}
                          >
                            <div
                              className={`h-full rounded-full origin-right transition-transform duration-200 ${
                                lvl >= 4
                                  ? 'bg-gradient-to-l from-[#3ef0ff] to-[#ffe066]'
                                  : active
                                    ? 'bg-[#fff3a6]'
                                    : 'bg-[#e8871e]'
                              }`}
                              style={{ transform: `scaleX(${Math.max(0.05, wXpRatio)})` }}
                            />
                          </div>
                        )}
                      </button>

                      {canUpgrade && (
                        <button
                          type="button"
                          data-testid={`upgrade-weapon-${spec.id}`}
                          onClick={() => handleUpgradeWeapon(spec.id)}
                          title={`ارتقای ${spec.nameFa} (${toPersianDigits(CONFIG.SURVIVAL.WEAPON_UPGRADE_WOOD_COST)} چوب)`}
                          className="btn-game btn-emerald anim-upgrade-bounce w-6 h-6 rounded-lg text-white text-xs font-black flex items-center justify-center cursor-pointer"
                        >
                          +
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div
                className={`hud-glass-warm rounded-xl px-2.5 py-1.5 flex items-center gap-2 ${
                  backpackFull ? 'ring-2 ring-[#ff7b29]' : ''
                }`}
              >
                <BackpackSvg />
                <div className="flex items-center gap-1.5 leading-tight whitespace-nowrap">
                  <span className="text-[10.5px] font-bold text-[#6e4c21]">
                    {backpackFull ? 'کوله پر شد!' : 'کوله'}
                  </span>
                  <span
                    dir="ltr"
                    className={`text-xs font-black tabular-nums ${
                      backpackFull ? 'text-[#c9410e]' : 'text-[#3d2508]'
                    }`}
                  >
                    {toPersianDigits(hud.backpackUsed)}/{toPersianDigits(hud.backpackCapacity)}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom-Right (above Virtual Joystick): Contextual Survival Actions with Bespoke Animations */}
            <div
              className="absolute bottom-[198px] sm:bottom-[220px] right-2.5 sm:right-3 flex flex-col items-start gap-1.5 max-w-[240px] sm:max-w-[310px]"
              data-testid="hud-bottom-right"
            >
              {hud.canVictoryVoyage && (
                <button
                  type="button"
                  data-testid="victory-voyage-btn"
                  onClick={handleVictoryVoyage}
                  className="pointer-events-auto btn-game btn-primary-amber anim-btn-sheen min-h-[44px] px-3.5 py-2 rounded-xl text-white text-xs font-extrabold cursor-pointer flex items-center gap-2 whitespace-nowrap"
                  style={{ textShadow: '0 1px 1px rgba(145, 58, 5, 0.7)' }}
                >
                  <BoatMiniSvg className="w-4 h-4 shrink-0 anim-boat-rock" />
                  <span>سفر پیروزمندانه به خانه</span>
                </button>
              )}

              {hud.canEatFood && hud.bestFoodKind && (
                <button
                  type="button"
                  data-testid="eat-food-btn"
                  onClick={handleEatFood}
                  className="pointer-events-auto btn-game btn-primary-amber min-h-[42px] px-3 py-1.5 rounded-xl text-white text-[11px] font-extrabold cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                  style={{ textShadow: '0 1px 0 rgba(145, 58, 5, 0.7)' }}
                >
                  <span className="anim-steam-wisp inline-flex shrink-0">
                    {hud.bestFoodKind === 'cookedMeat' && <CookedMeatSvg />}
                    {hud.bestFoodKind === 'roastedBanana' && <RoastedBananaSvg />}
                    {hud.bestFoodKind === 'cookedFish' && <CookedFishSvg />}
                    {hud.bestFoodKind === 'banana' && <BananaSvg />}
                    {hud.bestFoodKind === 'berries' && <BerrySvg />}
                  </span>
                  <span>
                    {hud.bestFoodKind === 'cookedMeat'
                      ? `گوشت کبابی (+${toPersianDigits(CONFIG.SURVIVAL.COOKED_MEAT_ENERGY_RESTORE)})`
                      : hud.bestFoodKind === 'roastedBanana'
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
                  className={`pointer-events-auto btn-game min-h-[42px] px-3 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 whitespace-nowrap ${
                    hud.canCraftSpear
                      ? 'btn-primary-amber text-white cursor-pointer'
                      : 'hud-glass-warm text-[#7a5a32] opacity-80 cursor-not-allowed'
                  }`}
                >
                  <span className={hud.canCraftSpear ? 'anim-spear-jab inline-flex' : 'inline-flex'}>
                    <SpearMiniSvg fire={false} />
                  </span>
                  <span>
                    ساخت نیزه ({toPersianDigits(CONFIG.SURVIVAL.SPEAR_CRAFT_WOOD_COST)} چوب)
                  </span>
                </button>
              )}

              {hud.focusedTarget && !hud.focusedTarget.blockedReason && (
                <button
                  type="button"
                  data-testid="quick-interact-btn"
                  onClick={handleInteract}
                  className={`pointer-events-auto btn-game min-h-[44px] px-3.5 py-2 rounded-xl text-white text-[11.5px] font-extrabold cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    quickIsCombat
                      ? 'btn-crimson'
                      : quickIsSecretOrMystery
                        ? 'btn-violet'
                        : 'btn-primary-amber'
                  }`}
                  style={{ textShadow: '0 1px 1px rgba(40, 12, 12, 0.55)' }}
                >
                  {quickIsCombat ? (
                    <span className="anim-attack-pulse inline-flex shrink-0">
                      <WeaponMiniSvg id={hud.equippedWeapon} fireSpear={hud.hasFireSpear} />
                    </span>
                  ) : quickIsSecretOrMystery ? (
                    <span className="anim-chest-wiggle inline-flex shrink-0">
                      <SecretChestMiniSvg />
                    </span>
                  ) : (
                    <span className="anim-star-twinkle inline-flex shrink-0">
                      <SparkMiniSvg />
                    </span>
                  )}
                  <span>{hud.focusedTarget.labelFa} (F)</span>
                </button>
              )}

              {hud.venomTimer > 0 && hud.antidotes > 0 && (
                <button
                  type="button"
                  data-testid="use-antidote-btn"
                  onClick={handleUseAntidote}
                  className="pointer-events-auto btn-game btn-emerald min-h-[42px] px-3 py-1.5 rounded-xl text-white text-[11px] font-extrabold cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#bbf7d0] anim-potion-pulse shrink-0" />
                  <span>استفاده از پادزهر ({toPersianDigits(hud.antidotes)})</span>
                </button>
              )}

              {hud.nearCampfire && !hud.fireLit && (
                <button
                  type="button"
                  data-testid="light-fire-btn"
                  disabled={!hud.canIgniteFire}
                  onClick={handleLightFire}
                  className={`pointer-events-auto btn-game min-h-[44px] px-3.5 py-2 rounded-xl text-[11.5px] font-extrabold flex items-center gap-1.5 whitespace-nowrap ${
                    hud.canIgniteFire
                      ? 'btn-primary-amber anim-btn-sheen text-white cursor-pointer'
                      : 'hud-glass-warm text-[#7a5a32] opacity-85 cursor-not-allowed'
                  }`}
                >
                  <FlameMiniSvg className="w-4 h-4 shrink-0 anim-flame-dance" />
                  <span>
                    روشن کردن آتش کمپ ({toPersianDigits(CONFIG.SURVIVAL.FIRE_IGNITE_WOOD_COST)} چوب)
                  </span>
                </button>
              )}

              {hud.nearCampfire && hud.fireLit && hud.fireLevel < CONFIG.SURVIVAL.MAX_FIRE_LEVEL && (
                <button
                  type="button"
                  data-testid="stoke-fire-btn"
                  disabled={!hud.canStokeFire}
                  onClick={handleStokeFire}
                  className={`pointer-events-auto btn-game min-h-[42px] px-3 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 whitespace-nowrap ${
                    hud.canStokeFire
                      ? 'btn-primary-amber text-white cursor-pointer'
                      : 'hud-glass-warm text-[#7a5a32] opacity-85 cursor-not-allowed'
                  }`}
                >
                  <FlameMiniSvg className="w-3.5 h-3.5 shrink-0 anim-flame-dance" />
                  <span>
                    چوب در آتش (سطح {toPersianDigits(hud.fireLevel + 1)} ·{' '}
                    {toPersianDigits(CONFIG.SURVIVAL.FIRE_FUEL_WOOD_COST)} چوب)
                  </span>
                </button>
              )}

              {hud.nearbyLandmark && (
                <div className="flex flex-col items-start gap-1">
                  <button
                    type="button"
                    data-testid="landmark-power-btn"
                    disabled={hud.nearbyLandmark.cooldown > 0}
                    onClick={() => handleTriggerLandmark(hud.nearbyLandmark!.id)}
                    className={`pointer-events-auto btn-game min-h-[42px] px-3 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 whitespace-nowrap ${
                      hud.nearbyLandmark.cooldown <= 0
                        ? 'btn-ocean text-white cursor-pointer'
                        : 'hud-glass-warm text-[#7a5a32] opacity-85 cursor-not-allowed'
                    }`}
                  >
                    <SparkMiniSvg className="w-3.5 h-3.5 shrink-0 anim-star-twinkle" />
                    <span>
                      {hud.nearbyLandmark.cooldown <= 0
                        ? LANDMARK_ACTION_LABELS[hud.nearbyLandmark.id]
                        : `آماده‌سازی آیین (${toPersianDigits(hud.nearbyLandmark.cooldown)} ث)`}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="landmark-special-btn"
                    disabled={hud.nearbyLandmark.specialCooldown > 0}
                    onClick={() => handleTriggerLandmarkSpecial(hud.nearbyLandmark!.id)}
                    className={`pointer-events-auto btn-game min-h-[40px] px-3 py-1.5 rounded-xl text-[10.5px] font-extrabold flex items-center gap-1.5 whitespace-nowrap ${
                      hud.nearbyLandmark.specialCooldown <= 0
                        ? 'btn-wood text-[#fff8eb] cursor-pointer'
                        : 'hud-glass-warm text-[#7a5a32] opacity-85 cursor-not-allowed'
                    }`}
                  >
                    <CompassMiniSvg className="w-3.5 h-3.5 shrink-0 anim-compass-wiggle" />
                    <span>
                      {hud.nearbyLandmark.specialCooldown <= 0
                        ? LANDMARK_SPECIAL_LABELS[hud.nearbyLandmark.id]
                        : `آماده‌سازی کار ویژه (${toPersianDigits(hud.nearbyLandmark.specialCooldown)} ث)`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Camp Workshop & Resource Exchange Modal */}
        {screen === 'playing' && activeModal === 'workshop' && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center p-3 bg-[#082238]/60"
            onClick={() => {
              soundEngine.playModalClose();
              setActiveModal(null);
            }}
            data-testid="workshop-modal"
          >
            <div
              className="hud-card anim-modal-in w-full max-w-[460px] max-h-[86vh] rounded-3xl p-4 flex flex-col gap-3 overflow-hidden text-[#3d2508]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl leading-tight">کارگاه و مبادله منابع</h2>
                  <p className="text-[11px] font-bold text-[#755326] tabular-nums">
                    سکه: {toPersianDigits(hud.coins)} · چوب: {toPersianDigits(hud.wood)} · موز:{' '}
                    {toPersianDigits(hud.banana)} · توت: {toPersianDigits(hud.berries)} · صدف:{' '}
                    {toPersianDigits(hud.shells)} · پادزهر: {toPersianDigits(hud.antidotes)}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="close-modal-btn"
                  onClick={() => {
                    soundEngine.playModalClose();
                    setActiveModal(null);
                  }}
                  className="btn-game btn-wood min-h-[38px] px-3.5 py-1.5 rounded-xl text-[#fff8eb] text-xs font-extrabold cursor-pointer"
                >
                  بستن
                </button>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto pr-0.5">
                {CONFIG.WORKSHOP_RECIPES.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="rounded-2xl bg-white/85 border border-[#e6cda1] p-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="flex flex-col gap-0.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-[#3d2508]">{recipe.nameFa}</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#fef3c7] text-[#92400e] text-[9.5px] font-extrabold">
                          {recipe.costFa}
                        </span>
                      </div>
                      <p className="text-[10.5px] font-semibold text-[#6e4e24] leading-snug">
                        {recipe.effectFa}
                      </p>
                    </div>
                    <button
                      type="button"
                      data-testid={`craft-${recipe.id}`}
                      onClick={() => handleCraftWorkshop(recipe.id)}
                      className="btn-game btn-primary-amber shrink-0 min-h-[38px] px-3.5 py-1.5 rounded-xl text-white text-[11px] font-extrabold cursor-pointer whitespace-nowrap"
                    >
                      ساخت
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Wildlife Field Guide Modal */}
        {screen === 'playing' && activeModal === 'wildlife' && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center p-3 bg-[#082238]/60"
            onClick={() => {
              soundEngine.playModalClose();
              setActiveModal(null);
            }}
            data-testid="wildlife-modal"
          >
            <div
              className="hud-card anim-modal-in w-full max-w-[520px] max-h-[86vh] rounded-3xl p-4 flex flex-col gap-2.5 overflow-hidden text-[#3d2508]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl leading-tight">دانشنامه جانوران جزیره</h2>
                  <p className="text-[11px] font-bold text-[#755326] tabular-nums">
                    {toPersianDigits(hud.discoveredAnimals.length)} از{' '}
                    {toPersianDigits(ANIMAL_SPECIES.length)} گونه مشاهده شده
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="close-modal-btn"
                  onClick={() => {
                    soundEngine.playModalClose();
                    setActiveModal(null);
                  }}
                  className="btn-game btn-wood min-h-[38px] px-3.5 py-1.5 rounded-xl text-[#fff8eb] text-xs font-extrabold cursor-pointer"
                >
                  بستن
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {(['all', 'day', 'coastal', 'night_predator', 'strange'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setWildlifeFilter(cat);
                    }}
                    className={`btn-game px-2.5 py-1.5 rounded-xl text-[10.5px] font-extrabold cursor-pointer whitespace-nowrap ${
                      wildlifeFilter === cat
                        ? 'btn-primary-amber text-white'
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
                        <span className="text-[11px] font-extrabold truncate flex-1">{spec.nameFa}</span>
                        {spec.huntable && (
                          <span className="px-1.5 py-0.5 rounded-md bg-[#ffe4db] text-[#9b2c1a] text-[8.5px] font-extrabold shrink-0">
                            شکارپذیر
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[9.5px] font-bold text-[#755326]">
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

        {/* Victory / Defeat Game Over Modal */}
        {screen === 'playing' && outcome !== 'playing' && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[#071f36]/68"
            data-testid="gameover-modal"
            data-outcome={outcome}
          >
            <div className="hud-card anim-modal-in w-full max-w-[390px] rounded-3xl p-5 flex flex-col items-center text-center gap-3.5 text-[#3d2508]">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-md ${
                  outcome === 'victory'
                    ? 'bg-gradient-to-b from-[#ffe066] to-[#f59f00]'
                    : 'bg-gradient-to-b from-[#ff7a6b] to-[#d93829]'
                }`}
              >
                {outcome === 'victory' ? <TrophyVictorySvg /> : <DefeatSkullSvg />}
              </div>

              <div>
                <h2 className="font-display text-2xl">
                  {outcome === 'victory' ? 'پیروزی! جزیره را فتح کردی' : 'انرژی تمام شد!'}
                </h2>
                <p className="mt-1 text-xs font-semibold text-[#6e4e24] leading-relaxed text-balance">
                  {outcome === 'victory'
                    ? 'با قایق دست‌ساز خود پیروزمندانه به خانه بازگشتی!'
                    : 'در نبرد با بلایای جزیره، تله‌های پنهان و شکارچیان انرژی‌ات پایان یافت. دوباره تلاش کن!'}
                </p>
              </div>

              <div className="w-full grid grid-cols-3 gap-2 text-center">
                {[
                  {
                    label: 'روز بقا',
                    value: toPersianDigits(hud.dayCount),
                    accent: '',
                  },
                  {
                    label: 'سطح',
                    value: toPersianDigits(hud.playerLevel),
                    accent: '',
                  },
                  {
                    label: 'سکه',
                    value: toPersianDigits(hud.coins),
                    accent: 'text-[#a15c07]',
                  },
                  {
                    label: 'اسرار و مرموز',
                    value: `${toPersianDigits(hud.secretsFound + hud.mysteriesFound)}/${toPersianDigits(
                      hud.secretsTotal + hud.mysteriesTotal
                    )}`,
                    accent: '',
                  },
                  {
                    label: 'جانوران',
                    value: `${toPersianDigits(hud.discoveredAnimals.length)}/${toPersianDigits(
                      ANIMAL_SPECIES.length
                    )}`,
                    accent: '',
                  },
                  {
                    label: 'شکار',
                    value: toPersianDigits(hud.huntedCount),
                    accent: '',
                  },
                ].map((stat, idx) => (
                  <div
                    key={stat.label}
                    className={`rounded-2xl border p-2 transition-shadow ${
                      outcome === 'victory'
                        ? 'bg-[#fffdf2] stat-card-glow-victory'
                        : 'bg-[#fff7f7] stat-card-glow-defeat'
                    }`}
                    style={{ animationDelay: `${idx * 0.14}s` }}
                  >
                    <div className="text-[10px] font-bold text-[#755326]">{stat.label}</div>
                    <div className={`text-sm font-black tabular-nums ${stat.accent}`}>{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="w-full flex flex-col gap-2">
                <button
                  type="button"
                  data-start="true"
                  data-testid="restart-game-btn"
                  onClick={() => handleStartMode(activeRun?.mode ?? 'normal', false)}
                  className="btn-game btn-primary-amber anim-btn-sheen w-full min-h-[46px] py-2.5 rounded-2xl text-white font-extrabold text-sm cursor-pointer flex items-center justify-center gap-2"
                  style={{ textShadow: '0 1px 0 rgba(145, 58, 5, 0.7)' }}
                >
                  <RefreshMiniIcon className="w-4 h-4 anim-compass-wiggle" />
                  <span>بازی دوباره</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="new-island-btn"
                    onClick={() => handleStartMode('normal', true)}
                    className="btn-game btn-wood flex-1 min-h-[42px] py-2 rounded-xl text-[#fff8eb] font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CompassMiniSvg className="w-3.5 h-3.5 anim-compass-wiggle" />
                    <span>جزیره جدید</span>
                  </button>
                  <button
                    type="button"
                    data-testid="gameover-menu-btn"
                    onClick={handleReturnToMenu}
                    className="btn-game btn-wood flex-1 min-h-[42px] py-2 rounded-xl text-[#fff8eb] font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <HomeMiniSvg />
                    <span>منوی اصلی</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Simple Settings Modal (Title & Playing) */}
        {activeModal === 'settings' && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center p-3 bg-[#082238]/60"
            onClick={() => {
              soundEngine.playModalClose();
              setActiveModal(null);
            }}
            data-testid="settings-modal"
          >
            <div
              className="hud-card anim-modal-in w-full max-w-[380px] rounded-3xl p-4 flex flex-col gap-3.5 text-[#3d2508]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-[#f5e7ca] text-[#8e4816] flex items-center justify-center">
                    <SettingsGearSvg className="w-4 h-4" />
                  </span>
                  <h2 className="font-display text-xl leading-tight">تنظیمات بازی</h2>
                </div>
                <button
                  type="button"
                  data-testid="close-modal-btn"
                  onClick={() => {
                    soundEngine.playModalClose();
                    setActiveModal(null);
                  }}
                  className="btn-game btn-wood min-h-[36px] px-3.5 py-1.5 rounded-xl text-[#fff8eb] text-xs font-extrabold cursor-pointer"
                >
                  بستن
                </button>
              </div>

              <div className="rounded-2xl bg-white/85 border border-[#e6cda1] p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#3d2508]">
                    ضریب آسیب حیوانات وحشی
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#fef3c7] text-[#92400e] text-[10px] font-extrabold tabular-nums">
                    ×{toPersianDigits(CONFIG.WILDLIFE_DIFFICULTY_MULTIPLIERS[wildlifeDifficulty])}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'easy', label: 'آسان', sub: '۶۰٪ آسیب' },
                      { id: 'normal', label: 'نرمال', sub: '۱۰۰٪ آسیب' },
                      { id: 'hard', label: 'سخت', sub: '۱۵۰٪ آسیب' },
                    ] as const
                  ).map((opt) => {
                    const selected = wildlifeDifficulty === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid={`difficulty-${opt.id}`}
                        onClick={() => handleChangeDifficulty(opt.id)}
                        className={`btn-game rounded-xl py-2 px-2 flex flex-col items-center justify-center gap-0.5 cursor-pointer border ${
                          selected
                            ? 'btn-primary-amber text-white border-[#d97706]'
                            : 'bg-[#f6ead0] text-[#5e4018] border-[#dfc697]'
                        }`}
                      >
                        <span className="text-xs font-black">{opt.label}</span>
                        <span
                          className={`text-[9.5px] font-bold tabular-nums ${
                            selected ? 'text-[#fffbeb]' : 'text-[#8a6534]'
                          }`}
                        >
                          {opt.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl bg-white/85 border border-[#e6cda1] p-3 flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[#3d2508]">صدا و موسیقی بازی</span>
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className={`btn-game min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer flex items-center gap-1.5 ${
                    muted ? 'bg-[#e7d6b5] text-[#5e4018]' : 'btn-emerald text-white'
                  }`}
                >
                  <VolumeIcon muted={muted} />
                  <span>{muted ? 'قطع' : 'فعال'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

const HudResourceItem = forwardRef<
  HTMLDivElement,
  {
    label: string;
    value: number;
    icon: React.ReactNode;
    accentClass?: string;
  }
>(function HudResourceItem({ label, value, icon, accentClass = 'text-[#3d2508]' }, ref) {
  return (
    <div
      ref={ref}
      className="flex items-center gap-1 shrink-0"
      aria-label={`${label}: ${toPersianDigits(value)}`}
    >
      <span className="w-4 h-4 flex items-center justify-center shrink-0">{icon}</span>
      <span className={`text-[11.5px] font-extrabold tabular-nums min-w-[10px] text-center ${accentClass}`}>
        {toPersianDigits(value)}
      </span>
    </div>
  );
});

function SkipChevronsSvg({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M13 6L7 12L13 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 6L12 12L18 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhaseWeatherIcon({ phase, weather }: { phase: DayPhase; weather: WeatherKind }) {
  if (weather === 'storm') {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
        <path d="M5 13a4 4 0 0 1 1-7.8A5 5 0 0 1 16.5 6a3.5 3.5 0 0 1 1 6.8H5Z" fill="#64748b" />
        <path d="M12.5 13.5 L9.5 18 H12 L10.8 22 L15 16.8 H12.4 Z" fill="#ffd233" />
      </svg>
    );
  }
  if (weather === 'rain') {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
        <path d="M6 14a4 4 0 0 1 1-7.8A5 5 0 0 1 17 7a3.5 3.5 0 0 1 1 6.8H6Z" fill="#93c5fd" />
        <path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (weather === 'fog') {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
        <path d="M4 9h16M6 13h12M4 17h14" stroke="#cbd5e1" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (phase === 'night') {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
        <path d="M15.5 4.5a7.5 7.5 0 1 0 4 13.8A6.2 6.2 0 0 1 15.5 4.5Z" fill="#a5b4fc" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="5" fill={phase === 'dusk' || phase === 'dawn' ? '#fb923c' : '#fde047'} />
      <path d="M12 3V5M12 19V21M3 12H5M19 12H21" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
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

function MeatSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <ellipse cx="11.5" cy="12.5" rx="7" ry="5.5" fill="#d9483b" />
      <ellipse cx="10.5" cy="12" rx="4.2" ry="3.1" fill="#f27d72" />
      <circle cx="17.5" cy="8.5" r="2.2" fill="#f7ebd9" />
      <rect x="13" y="10" width="4.5" height="2.4" rx="1.2" transform="rotate(-32 13 10)" fill="#f7ebd9" />
    </svg>
  );
}

function CookedMeatSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <ellipse cx="11.5" cy="13.2" rx="7" ry="5.2" fill="#9c4218" />
      <ellipse cx="10.8" cy="12.8" rx="4.4" ry="2.8" fill="#c9652c" />
      <circle cx="17.5" cy="9.2" r="2.1" fill="#f5e3c6" />
      <path d="M9 6 C8.5 4.5, 10 4, 9.5 2.5 M13 6 C12.5 4.5, 14 4, 13.5 2.5" stroke="#ff9d42" strokeWidth="1.5" strokeLinecap="round" fill="none" />
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

function FlameMiniSvg({ className = 'w-3.5 h-3.5 shrink-0' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 3 C14.5 7, 18 10, 17.5 14.8 C17 18.2, 14.8 20.5, 12 20.5 C9.2 20.5, 6.8 18.2, 6.5 14.8 C6 11, 8.8 8.5, 12 3 Z"
        fill="#ff7b1c"
      />
      <path d="M12 10.5 C13.5 12.8, 14.8 14.5, 14.2 17 C13.8 18.5, 10.2 18.5, 9.8 17 C9.2 14.5, 10.5 12.8, 12 10.5 Z" fill="#ffe066" />
    </svg>
  );
}

function SparkMiniSvg({ className = 'w-3.5 h-3.5 shrink-0' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 2 L14.5 9.5 L22 12 L14.5 14.5 L12 22 L9.5 14.5 L2 12 L9.5 9.5 Z" fill="#fff3b0" />
    </svg>
  );
}

function PawMiniSvg({ className = 'w-3.5 h-3.5 shrink-0' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
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
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
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
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <path d="M4.5 11.5L12 5L19.5 11.5V19H4.5V11.5Z" fill="currentColor" />
    </svg>
  );
}

function CompassMiniSvg({ className = 'w-3.5 h-3.5 shrink-0' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="#d99a3a" />
      <circle cx="12" cy="12" r="7" fill="#fff6e0" />
      <path d="M14.8 9.2L13 13.4L9.2 14.8L11 10.6L14.8 9.2Z" fill="#d94426" />
    </svg>
  );
}

function BoatMiniSvg({ className = 'w-3.5 h-3.5 shrink-0' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 4 V14 L18 13 Z" fill="#fff3d1" />
      <path d="M4 15 H20 L17.5 19.5 H6.5 Z" fill="#9c5b2b" />
    </svg>
  );
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
      <path d="M4 9.5 H8 L13 5.5 V18.5 L8 14.5 H4 Z" fill="currentColor" />
      <path d="M16 9 L20 15 M20 9 L16 15" stroke="#ffd466" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
      <path d="M4 9.5 H8 L13 5.5 V18.5 L8 14.5 H4 Z" fill="currentColor" />
      <path d="M16 9 A4.5 4.5 0 0 1 16 15 M18.5 6.8 A7.5 7.5 0 0 1 18.5 17.2" stroke="#ffe066" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function WeaponMiniSvg({ id, fireSpear }: { id: WeaponId; fireSpear: boolean }) {
  if (id === 'spear') {
    return <SpearMiniSvg fire={fireSpear} />;
  }
  if (id === 'bow') {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
        <path d="M6 19 C13 18, 18 13, 19 6" stroke="#8f4e1c" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <path d="M6 19 L19 6" stroke="#e8e2d0" strokeWidth="1.2" />
        <path d="M7 10 L17 4 L14 14" stroke="#d9532b" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  if (id === 'hammer') {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
        <path d="M5 19 L14 10" stroke="#78421a" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="11" y="4" width="8.5" height="6" rx="1.5" transform="rotate(42 15 7)" fill="#6a7f91" />
        <circle cx="17" cy="6" r="1.4" fill="#ffe066" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <path d="M5 19 L15 9" stroke="#8f4e1c" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12 6 L19 4 L18 11 L13 10 Z" fill="#9fb2c2" />
    </svg>
  );
}

function SeasonMiniSvg({ season }: { season: 'autumn' | 'winter' }) {
  if (season === 'autumn') {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
        <path
          d="M12 3 L14 8 L19 7 L16 12 L20 15 L14 16 L13 21 L11 21 L10 16 L4 15 L8 12 L5 7 L10 8 Z"
          fill="#fb923c"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <path
        d="M12 3V21M3 12H21M5.6 5.6L18.4 18.4M18.4 5.6L5.6 18.4"
        stroke="#7dd3fc"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SecretChestMiniSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <rect x="4" y="9" width="16" height="10" rx="2" fill="#9c5b2b" />
      <path d="M4 10 C4 6.5, 20 6.5, 20 10 Z" fill="#c77a3b" />
      <rect x="10.2" y="10.5" width="3.6" height="3.8" rx="0.8" fill="#ffd43b" />
    </svg>
  );
}

function TrophyVictorySvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-9 h-9" aria-hidden="true">
      <path d="M7 5 H17 V11 C17 14, 14.8 16, 12 16 C9.2 16, 7 14, 7 11 Z" fill="#fff7d1" />
      <path d="M7 7 H4.5 C4.5 10, 5.5 11.5, 7 11.5 M17 7 H19.5 C19.5 10, 18.5 11.5, 17 11.5" stroke="#fff7d1" strokeWidth="2" fill="none" />
      <rect x="10.5" y="16" width="3" height="3" fill="#fff7d1" />
      <rect x="8" y="19" width="8" height="2" rx="1" fill="#fff7d1" />
    </svg>
  );
}

function DefeatSkullSvg() {
  return (
    <svg viewBox="0 0 24 24" className="w-9 h-9" aria-hidden="true">
      <path d="M13 4 L7 13 H12 L11 20 L17 11 H12 Z" fill="#fff5f5" />
    </svg>
  );
}

function SettingsGearSvg({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
        stroke="currentColor"
        strokeWidth="2.1"
      />
      <path
        d="M19.4 13.5a7.7 7.7 0 0 0 .06-1.5c0-.51-.02-1.01-.06-1.5l2.03-1.58a.48.48 0 0 0 .12-.62l-1.92-3.32a.49.49 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-2.6-1.5l-.36-2.54A.49.49 0 0 0 13.2 1h-3.84a.49.49 0 0 0-.48.42l-.36 2.54a7.3 7.3 0 0 0-2.6 1.5l-2.39-.96a.49.49 0 0 0-.6.22L1.01 8.04a.48.48 0 0 0 .12.62l2.03 1.58c-.04.49-.06.99-.06 1.5s.02 1.01.06 1.5L1.13 14.82a.48.48 0 0 0-.12.62l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.78.63 1.66 1.14 2.6 1.5l.36 2.54c.05.24.25.42.48.42h3.84c.23 0 .44-.18.48-.42l.36-2.54c.94-.36 1.82-.87 2.6-1.5l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.48.48 0 0 0-.12-.62l-2.03-1.58Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}
