export const CONFIG = {
  GAME_TITLE: 'جزیره بقا',
  GAME_URL: 'https://survival-island.example.com',
  VIEWPORT_ASPECT_W: 540,
  VIEWPORT_ASPECT_H: 960,

  RENDER: {
    MAX_PIXEL_RATIO: 1.5,
    SHADOW_MAP_SIZE: 1024,
    SHADOW_FRUSTUM_HALF: 24,
    FOG_DENSITY: 0.0029,
  },

  CAMERA: {
    FOV_DEG: 42,
    PITCH_DEG: 44,
    DISTANCE: 27,
    FOLLOW_DAMP: 7.5,
    LOOK_HEIGHT: 1.0,
    TITLE_ORBIT_SPEED: 0.1,
    TITLE_DISTANCE: 76,
  },

  WORLD: {
    TERRAIN_SIZE: 232,
    TERRAIN_SEGMENTS: 204,
    ISLAND_RX: 94,
    ISLAND_RZ: 80,
    MIN_WADE_HEIGHT: -0.46,
    MIN_SWIM_HEIGHT: -2.2,
    MAX_CLIMB_SLOPE: 1.35,
    SPAWN_X: 0,
    SPAWN_Z: 6.5,
    SPAWN_CLEAR_RADIUS: 5.2,
    MIN_PROP_SPACING: 1.62,
  },

  DAY_NIGHT: {
    CYCLE_DURATION_SEC: 72,
    DAWN_START: 0.16,
    DAY_START: 0.27,
    DUSK_START: 0.62,
    NIGHT_START: 0.80,
  },

  WEATHER: {
    MIN_DURATION_SEC: 24,
    MAX_DURATION_SEC: 42,
    RAIN_SPEED_SCALE: 0.85,
    STORM_SPEED_SCALE: 0.74,
    FOG_SPEED_SCALE: 0.9,
    RAIN_REGROW_MULT: 1.85,
    STORM_REGROW_MULT: 2.3,
    RAIN_FISHING_SPEED_MULT: 1.55,
    STORM_FISHING_SPEED_MULT: 1.85,
  },

  ISLAND: {
    CENTER: {
      CX: 0,
      CZ: 5,
      KNOLL_CX: -13.5,
      KNOLL_CZ: -5.5,
    },
    RUINS: {
      CX: -48,
      CZ: -29,
      RADIUS: 14.0,
      ALTAR_R: 2.3,
    },
    VOLCANO: {
      CX: 50,
      CZ: -31,
      BASE_RADIUS: 27,
      CRATER_RADIUS: 4.8,
      CALDERA_COLLIDER_R: 4.8,
    },
    MUSHROOM: {
      CX: -48,
      CZ: 29,
      RADIUS: 17.0,
    },
    SHIPWRECK: {
      CX: 46,
      CZ: 31,
      HULL_CX: 40.5,
      HULL_CZ: 36.5,
      HULL_COLLIDER_R: 2.9,
      HEADLAND_CX: 58,
      HEADLAND_CZ: 19,
      LIGHTHOUSE_CX: 58.5,
      LIGHTHOUSE_CZ: 18.5,
    },
    SPRING: {
      CX: 0,
      CZ: -47,
      POOL_RADIUS: 5.4,
      COLLIDER_R: 4.2,
    },
    CAMPFIRE: {
      CX: 3.4,
      CZ: 4.4,
      COLLIDER_R: 1.05,
      AURA_RADIUS: 4.3,
    },
    AIRPLANE_WRECK: {
      CX: -21,
      CZ: 19,
      COLLIDER_R: 3.1,
    },
  },

  PROPS: {
    PALM_COUNT: 150,
    JUNGLE_TREE_COUNT: 260,
    PINE_TREE_COUNT: 125,
    BANANA_TREE_COUNT: 52,
    BANYAN_TREE_COUNT: 38,
    WILLOW_TREE_COUNT: 26,
    ROCK_COUNT: 38,
    BUSH_COUNT: 130,
    SHELL_COUNT: 56,
    GRASS_TUFT_COUNT: 5400,
    CLOVER_PATCH_COUNT: 1850,
    PLUME_GRASS_COUNT: 920,
    FLOWER_COUNT: 1550,
    HIBISCUS_FLOWER_COUNT: 760,
    BELLFLOWER_COUNT: 680,
    SPORE_BLOOM_COUNT: 240,
    LOTUS_COUNT: 26,
    FERN_TUFT_COUNT: 1120,
    REED_COUNT: 210,
    PEBBLE_COUNT: 420,
    DRIFTWOOD_COUNT: 32,
    STARFISH_PROP_COUNT: 44,
    CRYSTAL_COUNT: 26,
    GIANT_MUSHROOM_COUNT: 16,
    SEA_STACK_COUNT: 16,
    PALM_COLLIDER_RADIUS: 0.54,
    JUNGLE_COLLIDER_RADIUS: 0.68,
    PINE_COLLIDER_RADIUS: 0.62,
    BANANA_COLLIDER_RADIUS: 0.52,
    BANYAN_COLLIDER_RADIUS: 0.78,
    WILLOW_COLLIDER_RADIUS: 0.62,
    ROCK_COLLIDER_RADIUS: 0.9,
    BUSH_COLLIDER_RADIUS: 0.6,
    MUSHROOM_COLLIDER_RADIUS: 0.88,
    CRYSTAL_COLLIDER_RADIUS: 0.62,
  },

  PLAYER: {
    RADIUS: 0.52,
    MOVE_SPEED: 8.6,
    MAX_ENERGY: 100,
    MAX_LEVEL: 10,
    LEVEL_XP_THRESHOLDS: [0, 35, 85, 155, 245, 360, 500, 670, 870, 1100],
    BACKPACK_CAPACITY: 12,
    UPGRADED_BACKPACK_CAPACITY: 20,
    TURN_DAMP: 14,
    WALK_CYCLE_SPEED: 13.5,
  },

  SURVIVAL: {
    HARVEST_RANGE_TREE: 2.65,
    HARVEST_RANGE_BANANA: 2.55,
    HARVEST_RANGE_BUSH: 2.25,
    HARVEST_RANGE_SHELL: 2.15,
    HARVEST_RANGE_FISHING: 4.8,
    HARVEST_RANGE_HUNT: 2.85,
    HARVEST_RANGE_COMBAT: 3.35,
    HARVEST_RANGE_BOW: 10.5,
    MELEE_STRIKE_COOLDOWN_SEC: 0.36,
    HAMMER_AOE_RANGE: 4.0,
    HAMMER_STUN_SEC: 4.8,
    HARVEST_RANGE_BUILD: 2.55,
    HARVEST_RANGE_LANDMARK: 4.8,
    HARVEST_RANGE_SECRET: 2.5,
    HARVEST_RANGE_MYSTERY: 2.4,
    HARVEST_RANGE_WRECK: 3.6,
    HARVEST_RANGE_BONE: 2.6,
    HARVEST_RANGE_TEMPLE: 4.5,
    HARVEST_DURATION_TREE: 0.85,
    HARVEST_DURATION_BANANA: 1.0,
    HARVEST_DURATION_BUSH: 0.45,
    HARVEST_DURATION_SHELL: 0.35,
    HARVEST_DURATION_FISHING: 1.05,
    HARVEST_DURATION_HUNT: 0.85,
    COOK_DURATION_SEC: 1.0,
    BUILD_DURATION_SEC: 2.0,
    REGROW_TREE_SEC: 16,
    REGROW_BANANA_SEC: 12,
    REGROW_BUSH_SEC: 9,
    REGROW_SHELL_SEC: 14,
    REGROW_FISHING_SEC: 5.0,
    RESPAWN_HUNT_SEC: 22,
    LANDMARK_COOLDOWN_SEC: 24,
    LANDMARK_SPECIAL_COOLDOWN_SEC: 14,
    WALK_ENERGY_DRAIN_PER_SEC: 0.85,
    SWIM_ENERGY_DRAIN_PER_SEC: 2.4,
    NIGHT_COLD_DRAIN_PER_SEC: 1.05,
    VENOM_DRAIN_PER_SEC: 2.8,
    SWIM_SPEED_SCALE: 0.75,
    HARVEST_ENERGY_COST_TREE: 3.2,
    HARVEST_ENERGY_COST_BANANA: 2.2,
    HARVEST_ENERGY_COST_FISHING: 2.2,
    HARVEST_ENERGY_COST_HUNT: 3.2,
    HARVEST_ENERGY_COST_BUSH: 0.8,
    BERRY_ENERGY_RESTORE: 14,
    BANANA_ENERGY_RESTORE: 20,
    COOKED_FISH_ENERGY_RESTORE: 40,
    ROASTED_BANANA_ENERGY_RESTORE: 48,
    COOKED_MEAT_ENERGY_RESTORE: 56,
    CAMPFIRE_ENERGY_REGEN_PER_SEC: 9.5,
    EXHAUSTED_SPEED_SCALE: 0.68,
    SPEAR_CRAFT_WOOD_COST: 2,
    FIRE_IGNITE_WOOD_COST: 2,
    FIRE_FUEL_WOOD_COST: 2,
    MAX_FIRE_LEVEL: 10,
    XP_PER_SKILL_POINT: 28,
    WEAPON_UPGRADE_WOOD_COST: 4,
    MAX_WEAPON_LEVEL: 5,
    WEAPON_XP_PER_LEVEL: [0, 30, 75, 135, 220],
    SECRETS_COUNT: 5,
    MYSTERY_SPOTS_COUNT: 7,
    VICTORY_MIN_LEVEL: 5,
    BUILD_COSTS: {
      shelter: 9,
      rack: 11,
      pier: 13,
      boat: 18,
    },
    WORLD_EVENTS: {
      MIN_INTERVAL_SEC: 64,
      MAX_INTERVAL_SEC: 96,
      WARNING_SEC: 5.5,
      LOW_TIDE_DURATION_SEC: 15,
      TSUNAMI_DURATION_SEC: 12,
      VOLCANO_DURATION_SEC: 13,
      METEOR_DURATION_SEC: 15,
      FISH_FRENZY_DURATION_SEC: 15,
      AUTUMN_DURATION_SEC: 15,
      WINTER_DURATION_SEC: 15,
      EARTHQUAKE_DURATION_SEC: 12,
      LIGHTNING_STORM_DURATION_SEC: 12,
      LOW_TIDE_OFFSET: -0.62,
      TSUNAMI_OFFSET: 2.15,
    },
  },

  WORKSHOP_RECIPES: [
    {
      id: 'antidote',
      nameFa: 'پادزهر زهر مار',
      costFa: '۲ توت + ۲ سکه (یا ۵ سکه)',
      effectFa: '+۱ پادزهر فوری برای خنثی‌سازی سم',
    },
    {
      id: 'elixir',
      nameFa: 'معجون چابکی استوایی',
      costFa: '۱ موز + ۲ توت',
      effectFa: '۲۴ ثانیه سرعت بیشتر و بازیابی انرژی',
    },
    {
      id: 'shell_armor',
      nameFa: 'طلسم دفاعی صدف',
      costFa: '۳ صدف',
      effectFa: 'کاهش ۵۰٪ آسیب ۲ ضربه بعدی',
    },
    {
      id: 'golden_bait',
      nameFa: 'طعمه طلایی ماهی‌گیری',
      costFa: '۱ ماهی + ۱ توت',
      effectFa: '۳ صید تضمینی ۱۰۰٪ + ماهی اضافه',
    },
    {
      id: 'ward_torch',
      nameFa: 'مشعل محافظ کمپ',
      costFa: '۲ چوب + ۲ سکه',
      effectFa: '۳۸ ثانیه دفع شکارچیان شب و مارها',
    },
    {
      id: 'supply_pack',
      nameFa: 'بسته انرژی کمپ',
      costFa: '۱۰ سکه',
      effectFa: '+۴۵ انرژی فوری برای کاوش',
    },
    {
      id: 'xp_tome',
      nameFa: 'تومار تجربه سلاح',
      costFa: '۱۲ سکه',
      effectFa: '+۲۴ تجربه شخصیت و +۱۵ تجربه سلاح',
    },
  ] as const,

  WEAPON_SPECS: [
    {
      id: 'axe',
      nameFa: 'تبر جنگل',
      descFa: 'قطع سریع درختان، ضربه دوتایی (س۲) و موج شوک چوب‌بری (س۳+)',
      unlockFireLevel: 1,
    },
    {
      id: 'spear',
      nameFa: 'نیزه شکار',
      descFa: 'شکار جانوران بزرگ و صید ماهی با نیزه (س۳ صید چندتایی، س۴ آتشین)',
      unlockFireLevel: 1,
    },
    {
      id: 'bow',
      nameFa: 'کمان صیاد',
      descFa: 'شکار از راه دور با تیر (س۳ دوتیر هم‌زمان، س۴+ تیر آتشین)',
      unlockFireLevel: 3,
    },
    {
      id: 'hammer',
      nameFa: 'چکش توفان',
      descFa: 'ضربه موجی، ساخت‌وساز سریع و صاعقه توفان روی دشمنان (س۳+)',
      unlockFireLevel: 4,
    },
  ] as const,

  SKILL_TREE: [
    {
      id: 'lumberjack',
      name: 'تبر تیزتر',
      desc: 'سرعت قطع درخت، چیدن موز و بوته (+۲۵٪ در هر سطح)',
      maxLevel: 3,
      woodCost: 3,
    },
    {
      id: 'backpacker',
      name: 'کوله‌پشتی جادار',
      desc: 'افزایش ظرفیت حمل کوله (+۴ جا در هر سطح)',
      maxLevel: 3,
      woodCost: 4,
    },
    {
      id: 'pathfinder',
      name: 'چابکی جزیره',
      desc: 'سرعت حرکت بیشتر و کاهش اثر باران، توفان و مه (+۱۲٪)',
      maxLevel: 3,
      woodCost: 3,
    },
    {
      id: 'angler',
      name: 'ماهی‌گیر چیره‌دست',
      desc: 'سرعت ماهی‌گیری با قلاب و نیزه و شانس صید دوتایی',
      maxLevel: 3,
      woodCost: 4,
    },
    {
      id: 'pyromancer',
      name: 'نگهبان شعله',
      desc: 'افزایش حداکثر انرژی (+۲۰) و گرمای بیشتر آتش',
      maxLevel: 3,
      woodCost: 4,
    },
  ] as const,

  JOYSTICK: {
    MAX_RADIUS_PX: 72,
    DEADZONE_RATIO: 0.12,
  },

  COLORS: {
    SKY_ZENITH: 0x2b86d4,
    SKY_HORIZON: 0xbfefff,
    FOG: 0xaee6fc,
    SEA_DEEP: 0x0b598a,
    SEA_SHALLOW: 0x2cd4df,
    SEA_FOAM: 0xf4fcff,
    WOOD_PLANK: 0xb2743f,
    WOOD_DARK: 0x73441e,
    PALM_TRUNK: 0x9c5b2b,
    PALM_FROND: 0x389c4c,
    JUNGLE_LEAF: 0x3b8f42,
    MUSHROOM_STEM: 0xf2e7d2,
    MUSHROOM_CAP_A: 0xd13b6e,
    MUSHROOM_CAP_B: 0x7a4be6,
    MUSHROOM_SPOT: 0x76f8ff,
    COCONUT: 0x5c3216,
    ROCK_MAIN: 0x7c8591,
    ROCK_LIGHT: 0x9ea8b6,
    BUSH_LEAF: 0x3ea348,
    BERRY_RED: 0xff3b56,
    OBELISK_GLOW: 0x3ef0ff,
    LAVA_CORE: 0xff5a1f,
    LAVA_GLOW: 0xffc842,
    SKIN: 0xffcfa3,
    HAIR: 0x523420,
    CHEEK: 0xff8c82,
    SHIRT: 0x2482e0,
    SHORTS: 0x2a3f5f,
    CAP: 0xf59e2d,
    BACKPACK: 0xaa622e,
    BOOTS: 0x472e1e,
  },

  WILDLIFE_DIFFICULTY_MULTIPLIERS: {
    easy: 0.6,
    normal: 1.0,
    hard: 1.5,
  },

  STORAGE_KEYS: {
    CURRENT_ISLAND_SEED: 'survival_island_3d_normal_seed_v3',
    SAVED_RUN: 'survival_island_saved_run_v1',
    BEST_SCORE: 'survival_island_best_score_v1',
    DAILY_BEST_PREFIX: 'survival_island_daily_v1_',
    WILDLIFE_DIFFICULTY: 'survival_island_wildlife_difficulty_v1',
  },
} as const;

export type WildlifeDifficulty = 'easy' | 'normal' | 'hard';
export type GameMode = 'normal' | 'daily';
export type AppScreenState = 'loading' | 'title' | 'cutscene' | 'ending_cutscene' | 'playing';
export type GameOutcome = 'playing' | 'victory' | 'defeat';
export type SeasonKind = 'summer' | 'autumn' | 'winter';
export type BiomeId = 'center' | 'ruins' | 'volcano' | 'mushroom' | 'shipwreck' | 'spring';
export type StrangeLandmarkId = 'ruins' | 'volcano' | 'mushroom' | 'shipwreck' | 'spring';
export type CampUpgradeId = 'shelter' | 'rack' | 'pier' | 'boat';
export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';
export type WeatherKind = 'clear' | 'rain' | 'storm' | 'fog';
export type WeaponId = 'axe' | 'spear' | 'bow' | 'hammer';
export type WorkshopRecipeId =
  | 'antidote'
  | 'elixir'
  | 'shell_armor'
  | 'golden_bait'
  | 'ward_torch'
  | 'supply_pack'
  | 'xp_tome';
export type WorldEventKind =
  | 'none'
  | 'low_tide'
  | 'tsunami'
  | 'volcano_eruption'
  | 'meteor_shower'
  | 'fish_frenzy'
  | 'autumn_breeze'
  | 'winter_frost'
  | 'earthquake'
  | 'lightning_storm';
export type SkillId = 'lumberjack' | 'backpacker' | 'pathfinder' | 'angler' | 'pyromancer';
