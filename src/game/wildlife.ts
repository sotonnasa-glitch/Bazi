import { CONFIG, type BiomeId } from './config';
import { createSeededRandom } from './utils';
import { groundHeightAt, type IslandWorldData } from './world';

export type AnimalCategory = 'day' | 'coastal' | 'night_predator' | 'strange';
export type AnimalBodyArchetype =
  | 'quadruped'
  | 'rabbit'
  | 'deer'
  | 'bird'
  | 'crab'
  | 'turtle'
  | 'fish'
  | 'serpent'
  | 'scorpion'
  | 'starfish'
  | 'golem'
  | 'butterfly';

export interface AnimalSpeciesSpec {
  id: string;
  nameFa: string;
  category: AnimalCategory;
  archetype: AnimalBodyArchetype;
  habitatFa: string;
  homeBiome: BiomeId | 'beach' | 'ocean';
  speed: number;
  scale: number;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  flying?: boolean;
  aquatic?: boolean;
  amphibious?: boolean;
  fishable?: boolean;
  huntable?: boolean;
  meatYield?: number;
  huntDuration?: number;
  requiresSpear?: boolean;
}

export const ANIMAL_SPECIES: AnimalSpeciesSpec[] = [
  // 1-12: Daytime Island Wildlife (sleep or hide in bushes at night)
  {
    id: 'rabbit',
    nameFa: 'خرگوش جزیره',
    category: 'day',
    archetype: 'rabbit',
    habitatFa: 'چمنزار مرکزی',
    homeBiome: 'center',
    speed: 2.3,
    scale: 0.78,
    primaryColor: 0xf4ece1,
    secondaryColor: 0xffb3c1,
    accentColor: 0x3b2a20,
    huntable: true,
    meatYield: 1,
    huntDuration: 0.65,
    requiresSpear: false,
  },
  {
    id: 'deer',
    nameFa: 'آهوی خال‌دار',
    category: 'day',
    archetype: 'deer',
    habitatFa: 'جنگل میانی',
    homeBiome: 'center',
    speed: 2.6,
    scale: 1.15,
    primaryColor: 0xc97b3e,
    secondaryColor: 0xfff0d4,
    accentColor: 0x543118,
    huntable: true,
    meatYield: 2,
    huntDuration: 0.95,
    requiresSpear: true,
  },
  {
    id: 'fox',
    nameFa: 'روباه طلایی',
    category: 'day',
    archetype: 'quadruped',
    habitatFa: 'بیشه آفتابی',
    homeBiome: 'center',
    speed: 2.8,
    scale: 0.88,
    primaryColor: 0xeb6e24,
    secondaryColor: 0xfff7ea,
    accentColor: 0x2a1d17,
  },
  {
    id: 'boar',
    nameFa: 'گراز جنگلی',
    category: 'day',
    archetype: 'quadruped',
    habitatFa: 'جنگل انبوه',
    homeBiome: 'center',
    speed: 2.0,
    scale: 1.05,
    primaryColor: 0x6b4b3e,
    secondaryColor: 0x997362,
    accentColor: 0xf5ecd8,
    huntable: true,
    meatYield: 2,
    huntDuration: 1.0,
    requiresSpear: true,
  },
  {
    id: 'monkey',
    nameFa: 'میمون موزخوار',
    category: 'day',
    archetype: 'quadruped',
    habitatFa: 'درختان موز',
    homeBiome: 'center',
    speed: 2.7,
    scale: 0.85,
    primaryColor: 0x8f562e,
    secondaryColor: 0xf2c89b,
    accentColor: 0x3a2010,
  },
  {
    id: 'parrot',
    nameFa: 'طوطی رنگین‌کمان',
    category: 'day',
    archetype: 'bird',
    habitatFa: 'تاج درختان',
    homeBiome: 'center',
    speed: 3.4,
    scale: 0.8,
    primaryColor: 0xff3b47,
    secondaryColor: 0x26b5ff,
    accentColor: 0xffe042,
    flying: true,
  },
  {
    id: 'toucan',
    nameFa: 'توکان نوک‌بزرگ',
    category: 'day',
    archetype: 'bird',
    habitatFa: 'جنگل استوایی',
    homeBiome: 'center',
    speed: 3.1,
    scale: 0.86,
    primaryColor: 0x212936,
    secondaryColor: 0xff9f1c,
    accentColor: 0xfff566,
    flying: true,
  },
  {
    id: 'tortoise',
    nameFa: 'لاک‌پشت خشکی',
    category: 'day',
    archetype: 'turtle',
    habitatFa: 'چمنزار شرقی',
    homeBiome: 'center',
    speed: 0.85,
    scale: 0.92,
    primaryColor: 0x588c3a,
    secondaryColor: 0x9e743b,
    accentColor: 0xd6b569,
  },
  {
    id: 'squirrel',
    nameFa: 'سنجاب دم‌پشمالو',
    category: 'day',
    archetype: 'rabbit',
    habitatFa: 'کاجستان جزیره',
    homeBiome: 'center',
    speed: 2.9,
    scale: 0.65,
    primaryColor: 0xb85e28,
    secondaryColor: 0xf7dec2,
    accentColor: 0x3d2212,
    huntable: true,
    meatYield: 1,
    huntDuration: 0.6,
    requiresSpear: false,
  },
  {
    id: 'iguana',
    nameFa: 'ایگوانای سبز',
    category: 'day',
    archetype: 'serpent',
    habitatFa: 'تخته‌سنگ‌های گرم',
    homeBiome: 'center',
    speed: 1.65,
    scale: 0.85,
    primaryColor: 0x45c44f,
    secondaryColor: 0xa6f056,
    accentColor: 0x1d5c28,
    huntable: true,
    meatYield: 1,
    huntDuration: 0.72,
    requiresSpear: true,
  },
  {
    id: 'flamingo',
    nameFa: 'فلامینگوی صورتی',
    category: 'day',
    archetype: 'bird',
    habitatFa: 'حاشیه چشمه',
    homeBiome: 'spring',
    speed: 1.5,
    scale: 1.05,
    primaryColor: 0xff7096,
    secondaryColor: 0xffb3c6,
    accentColor: 0x241d21,
  },
  {
    id: 'butterfly',
    nameFa: 'پروانه سلطنتی',
    category: 'day',
    archetype: 'butterfly',
    habitatFa: 'گلزارهای وحشی',
    homeBiome: 'center',
    speed: 2.4,
    scale: 0.75,
    primaryColor: 0xff9914,
    secondaryColor: 0x2e1e14,
    accentColor: 0xfff5d6,
    flying: true,
  },
  {
    id: 'jungle_cobra',
    nameFa: 'مار کبرا طلایی',
    category: 'day',
    archetype: 'serpent',
    habitatFa: 'علفزار و سنگلاخ جزیره',
    homeBiome: 'center',
    speed: 2.15,
    scale: 1.02,
    primaryColor: 0xc28f27,
    secondaryColor: 0x3b2611,
    accentColor: 0xffe46b,
    huntable: true,
    meatYield: 1,
    huntDuration: 0.72,
    requiresSpear: false,
  },
  {
    id: 'island_python',
    nameFa: 'مار پیتون جنگل',
    category: 'day',
    archetype: 'serpent',
    habitatFa: 'جنگل استوایی مرطوب',
    homeBiome: 'center',
    speed: 1.75,
    scale: 1.15,
    primaryColor: 0x5c7f34,
    secondaryColor: 0x2f3b19,
    accentColor: 0xd9c26f,
    huntable: true,
    meatYield: 2,
    huntDuration: 0.8,
    requiresSpear: false,
  },
  {
    id: 'venomous_snake',
    nameFa: 'مار سمی افعی',
    category: 'day',
    archetype: 'serpent',
    habitatFa: 'سنگلاخ و بیشه‌زار جزیره',
    homeBiome: 'center',
    speed: 2.4,
    scale: 1.06,
    primaryColor: 0x2d8a3e,
    secondaryColor: 0x9ef01a,
    accentColor: 0xfff033,
    huntable: true,
    meatYield: 1,
    huntDuration: 0.72,
    requiresSpear: false,
  },

  // 13-18: Coastal & Marine Wildlife (crabs on big sandy beach, fish strictly offshore!)
  {
    id: 'red_crab',
    nameFa: 'خرچنگ قرمز ساحلی',
    category: 'coastal',
    archetype: 'crab',
    habitatFa: 'ماسه ساحل بزرگ',
    homeBiome: 'beach',
    speed: 1.75,
    scale: 0.9,
    primaryColor: 0xff4633,
    secondaryColor: 0xff8a61,
    accentColor: 0x1e293b,
    amphibious: true,
    huntable: true,
    meatYield: 1,
    huntDuration: 0.6,
    requiresSpear: false,
  },
  {
    id: 'hermit_crab',
    nameFa: 'خرچنگ گوشه‌گیر',
    category: 'coastal',
    archetype: 'crab',
    habitatFa: 'ساحل شنی مرطوب',
    homeBiome: 'beach',
    speed: 1.25,
    scale: 0.82,
    primaryColor: 0xe67c4c,
    secondaryColor: 0xffc4db,
    accentColor: 0x4a291a,
    amphibious: true,
  },
  {
    id: 'starfish',
    nameFa: 'ستاره دریایی مرجانی',
    category: 'coastal',
    archetype: 'starfish',
    habitatFa: 'لب آب ساحل',
    homeBiome: 'beach',
    speed: 0.2,
    scale: 0.85,
    primaryColor: 0xff6b52,
    secondaryColor: 0xffc76e,
    accentColor: 0xffeacc,
  },
  {
    id: 'sea_turtle',
    nameFa: 'لاک‌پشت دریایی',
    category: 'coastal',
    archetype: 'turtle',
    habitatFa: 'آب‌های کم‌عمق دریا',
    homeBiome: 'ocean',
    speed: 1.45,
    scale: 1.08,
    primaryColor: 0x2ea682,
    secondaryColor: 0x80d49f,
    accentColor: 0x1c5c4a,
    aquatic: true,
  },
  {
    id: 'coral_fish',
    nameFa: 'ماهی مرجانی',
    category: 'coastal',
    archetype: 'fish',
    habitatFa: 'دریای فیروزه‌ای',
    homeBiome: 'ocean',
    speed: 2.35,
    scale: 1.05,
    primaryColor: 0xff7a2e,
    secondaryColor: 0xfff2cc,
    accentColor: 0x1e293b,
    aquatic: true,
    fishable: true,
  },
  {
    id: 'golden_snapper',
    nameFa: 'ماهی طلایی دریا',
    category: 'coastal',
    archetype: 'fish',
    habitatFa: 'آب‌های عمیق‌تر',
    homeBiome: 'ocean',
    speed: 2.7,
    scale: 1.18,
    primaryColor: 0xffc824,
    secondaryColor: 0xfff59d,
    accentColor: 0xd9480f,
    aquatic: true,
    fishable: true,
  },

  // 19-25: Night Predators (emerge & hunt at night, hide/rest during day!)
  {
    id: 'night_wolf',
    nameFa: 'گرگ شب',
    category: 'night_predator',
    archetype: 'quadruped',
    habitatFa: 'شکارچی شبانه جنگل',
    homeBiome: 'center',
    speed: 3.35,
    scale: 1.12,
    primaryColor: 0x3f4759,
    secondaryColor: 0x76839c,
    accentColor: 0xffb703,
    huntable: true,
    meatYield: 2,
    huntDuration: 0.9,
    requiresSpear: true,
  },
  {
    id: 'black_panther',
    nameFa: 'پلنگ سیاه',
    category: 'night_predator',
    archetype: 'quadruped',
    habitatFa: 'سایه‌های شب جزیره',
    homeBiome: 'center',
    speed: 3.7,
    scale: 1.16,
    primaryColor: 0x20222e,
    secondaryColor: 0x383c52,
    accentColor: 0x52ff96,
    huntable: true,
    meatYield: 2,
    huntDuration: 0.95,
    requiresSpear: true,
  },
  {
    id: 'hyena',
    nameFa: 'کفتار شکارچی',
    category: 'night_predator',
    archetype: 'quadruped',
    habitatFa: 'حاشیه تپه‌ها در شب',
    homeBiome: 'center',
    speed: 3.15,
    scale: 1.04,
    primaryColor: 0x8a6d4b,
    secondaryColor: 0x3b2c1d,
    accentColor: 0xff5a36,
    huntable: true,
    meatYield: 2,
    huntDuration: 0.9,
    requiresSpear: true,
  },
  {
    id: 'night_viper',
    nameFa: 'مار افعی شب',
    category: 'night_predator',
    archetype: 'serpent',
    habitatFa: 'بوته‌زار شبانه',
    homeBiome: 'center',
    speed: 2.55,
    scale: 0.95,
    primaryColor: 0x432b5e,
    secondaryColor: 0xc74bff,
    accentColor: 0xffe047,
    huntable: true,
    meatYield: 1,
    huntDuration: 0.75,
    requiresSpear: true,
  },
  {
    id: 'giant_owl',
    nameFa: 'جغد شکارچی غول‌پیکر',
    category: 'night_predator',
    archetype: 'bird',
    habitatFa: 'آسمان شب جزیره',
    homeBiome: 'center',
    speed: 3.9,
    scale: 1.1,
    primaryColor: 0x4d3b32,
    secondaryColor: 0xc2ab93,
    accentColor: 0xffcc29,
    flying: true,
    huntable: true,
    meatYield: 1,
    huntDuration: 0.72,
  },
  {
    id: 'scorpion',
    nameFa: 'عقرب زهرآگین',
    category: 'night_predator',
    archetype: 'scorpion',
    habitatFa: 'ساحل و دامنه کوه در شب',
    homeBiome: 'beach',
    speed: 2.35,
    scale: 0.92,
    primaryColor: 0x2b1d2e,
    secondaryColor: 0xa62639,
    accentColor: 0xff6e40,
    huntable: true,
    meatYield: 1,
    huntDuration: 0.75,
    requiresSpear: true,
  },
  {
    id: 'vampire_bat',
    nameFa: 'خفاش شب‌گرد',
    category: 'night_predator',
    archetype: 'butterfly',
    habitatFa: 'غار و شب‌هنگام',
    homeBiome: 'center',
    speed: 4.1,
    scale: 0.95,
    primaryColor: 0x2d2238,
    secondaryColor: 0x5c3c6e,
    accentColor: 0xff3b5c,
    flying: true,
    huntable: true,
    meatYield: 1,
    huntDuration: 0.68,
  },

  // 26-32: Strange / Mythic Creatures in Weird Landmarks
  {
    id: 'lava_salamander',
    nameFa: 'سمندر گدازه',
    category: 'strange',
    archetype: 'serpent',
    habitatFa: 'قله آتشفشان',
    homeBiome: 'volcano',
    speed: 2.1,
    scale: 1.15,
    primaryColor: 0xd9381e,
    secondaryColor: 0xffb703,
    accentColor: 0xfff1a8,
  },
  {
    id: 'ember_phoenix',
    nameFa: 'ققنوس خاکستر',
    category: 'strange',
    archetype: 'bird',
    habitatFa: 'دهانه آتشفشان',
    homeBiome: 'volcano',
    speed: 3.2,
    scale: 1.25,
    primaryColor: 0xff5a1f,
    secondaryColor: 0xffd23f,
    accentColor: 0xfff7cc,
    flying: true,
  },
  {
    id: 'mushroom_stag',
    nameFa: 'گوزن قارچی شب‌تاب',
    category: 'strange',
    archetype: 'deer',
    habitatFa: 'جنگل قارچ‌ها',
    homeBiome: 'mushroom',
    speed: 2.0,
    scale: 1.28,
    primaryColor: 0x6a4be6,
    secondaryColor: 0x66f7ff,
    accentColor: 0xff66b3,
  },
  {
    id: 'spore_toad',
    nameFa: 'وزغ اسپور نورانی',
    category: 'strange',
    archetype: 'rabbit',
    habitatFa: 'جنگل قارچ‌ها',
    homeBiome: 'mushroom',
    speed: 1.5,
    scale: 1.1,
    primaryColor: 0xd13b6e,
    secondaryColor: 0x76f8ff,
    accentColor: 0xffe680,
  },
  {
    id: 'crystal_golem',
    nameFa: 'نگهبان بلورین',
    category: 'strange',
    archetype: 'golem',
    habitatFa: 'خرابه‌های باستانی',
    homeBiome: 'ruins',
    speed: 1.4,
    scale: 1.25,
    primaryColor: 0x3edbf0,
    secondaryColor: 0x9bf6ff,
    accentColor: 0xffd166,
  },
  {
    id: 'spirit_otter',
    nameFa: 'سمور روحانی چشمه',
    category: 'strange',
    archetype: 'quadruped',
    habitatFa: 'چشمه بلورین',
    homeBiome: 'spring',
    speed: 2.4,
    scale: 0.95,
    primaryColor: 0x72efdd,
    secondaryColor: 0xe0fbfc,
    accentColor: 0x4ea8de,
    amphibious: true,
  },
  {
    id: 'pirate_crab',
    nameFa: 'خرچنگ غول‌پیکر خلیج استخوان',
    category: 'strange',
    archetype: 'crab',
    habitatFa: 'خلیج جمجمه و استخوان',
    homeBiome: 'shipwreck',
    speed: 1.85,
    scale: 1.45,
    primaryColor: 0xb8292f,
    secondaryColor: 0xffc83d,
    accentColor: 0x1b2432,
    amphibious: true,
    huntable: true,
    meatYield: 2,
    huntDuration: 0.85,
  },
];

export function getSpeciesMaxHp(speciesId: string): number {
  if (speciesId === 'black_panther' || speciesId === 'pirate_crab' || speciesId === 'night_wolf') {
    return 3;
  }
  if (
    speciesId === 'hyena' ||
    speciesId === 'scorpion' ||
    speciesId === 'venomous_snake' ||
    speciesId === 'night_viper' ||
    speciesId === 'boar' ||
    speciesId === 'giant_owl' ||
    speciesId === 'vampire_bat'
  ) {
    return 2;
  }
  return 1;
}

export interface AnimalActorState {
  id: string;
  speciesId: string;
  category: AnimalCategory;
  x: number;
  y: number;
  z: number;
  homeX: number;
  homeZ: number;
  roamRadius: number;
  vx: number;
  vz: number;
  yaw: number;
  phase: number;
  decisionTimer: number;
  sleeping: boolean;
  hidden: boolean;
  visible: boolean;
  koTimer: number;
  respawnTimer: number;
  stunTimer: number;
  attackState: 'idle' | 'windup' | 'strike';
  attackTimer: number;
  attackCooldown: number;
  attackTargetX: number;
  attackTargetZ: number;
  enraged?: boolean;
  pauseTimer?: number;
  turnBank?: number;
  hp?: number;
  maxHp?: number;
}

export interface PredatorStrikeEvent {
  actorId: string;
  speciesId: string;
  x: number;
  z: number;
  damage: number;
  knockbackX: number;
  knockbackZ: number;
  knockbackForce: number;
  venomSec?: number;
}

export interface WildlifeState {
  actors: AnimalActorState[];
  discoveredSpecies: string[];
  ambushCooldown: number;
}

export interface WildlifeStepResult {
  discoveredNew: string[];
  predatorNearby: boolean;
  ambushEnergyLoss: number;
  predatorStrikes: PredatorStrikeEvent[];
}

export function createWildlifeState(world: IslandWorldData, seed: string): WildlifeState {
  const rng = createSeededRandom(`${seed}-wildlife-32`);
  const actors: AnimalActorState[] = [];
  const { RUINS, VOLCANO, MUSHROOM, SHIPWRECK, SPRING } = CONFIG.ISLAND;

  const pickLandPointNear = (
    cx: number,
    cz: number,
    rMin: number,
    rMax: number,
    minY = 1.0,
    maxY = 5.5
  ): { x: number; y: number; z: number } => {
    for (let i = 0; i < 40; i += 1) {
      const a = rng() * Math.PI * 2;
      const r = rMin + rng() * (rMax - rMin);
      const tx = cx + Math.cos(a) * r;
      const tz = cz + Math.sin(a) * r;
      const hy = groundHeightAt(tx, tz, world);
      if (hy >= minY && hy <= maxY) {
        return { x: tx, y: hy, z: tz };
      }
    }
    const fy = groundHeightAt(cx, cz, world);
    return { x: cx, y: fy, z: cz };
  };

  const pickBeachPoint = (): { x: number; y: number; z: number } => {
    for (let i = 0; i < 60; i += 1) {
      const a = rng() * Math.PI * 2;
      const rFrac = 0.72 + rng() * 0.2;
      const tx = Math.cos(a) * CONFIG.WORLD.ISLAND_RX * rFrac;
      const tz = Math.sin(a) * CONFIG.WORLD.ISLAND_RZ * rFrac;
      const hy = groundHeightAt(tx, tz, world);
      if (hy >= 0.08 && hy <= 1.15) {
        return { x: tx, y: hy, z: tz };
      }
    }
    return { x: 0, y: 0.4, z: 68 };
  };

  const pickOceanPoint = (): { x: number; y: number; z: number } => {
    for (let i = 0; i < 60; i += 1) {
      const a = rng() * Math.PI * 2;
      const rFrac = 0.98 + rng() * 0.14;
      const tx = Math.cos(a) * CONFIG.WORLD.ISLAND_RX * rFrac;
      const tz = Math.sin(a) * CONFIG.WORLD.ISLAND_RZ * rFrac;
      const hy = groundHeightAt(tx, tz, world);
      if (hy <= -0.55 && hy >= -2.3) {
        return { x: tx, y: 0.02, z: tz };
      }
    }
    return { x: 0, y: 0.02, z: 86 };
  };

  for (const spec of ANIMAL_SPECIES) {
    // Spawn 2 instances for most common species, 3 for beach crabs/fish, 1-2 for strange bosses
    const count =
      spec.id === 'red_crab' || spec.id === 'coral_fish' || spec.id === 'rabbit'
        ? 3
        : spec.category === 'strange'
          ? 2
          : 2;

    for (let copy = 0; copy < count; copy += 1) {
      let pt = { x: 0, y: 1.9, z: 0 };
      let roamRadius = 11;

      if (spec.homeBiome === 'beach') {
        pt = pickBeachPoint();
        roamRadius = 7.5;
      } else if (spec.homeBiome === 'ocean') {
        pt = pickOceanPoint();
        roamRadius = 9.0;
      } else if (spec.homeBiome === 'volcano') {
        pt = pickLandPointNear(VOLCANO.CX, VOLCANO.CZ, 6.2, 13.5, 2.2, 7.2);
        roamRadius = 8.5;
      } else if (spec.homeBiome === 'mushroom') {
        pt = pickLandPointNear(MUSHROOM.CX, MUSHROOM.CZ, 3.0, 12.0, 1.1, 3.6);
        roamRadius = 9.0;
      } else if (spec.homeBiome === 'ruins') {
        pt = pickLandPointNear(RUINS.CX, RUINS.CZ, 3.2, 10.5, 2.2, 4.2);
        roamRadius = 8.0;
      } else if (spec.homeBiome === 'spring') {
        pt = pickLandPointNear(SPRING.CX, SPRING.CZ, 4.5, 9.5, 0.8, 3.2);
        roamRadius = 7.5;
      } else if (spec.homeBiome === 'shipwreck') {
        pt = pickLandPointNear(SHIPWRECK.HULL_CX, SHIPWRECK.HULL_CZ, 3.2, 9.5, 0.1, 1.8);
        roamRadius = 7.5;
      } else {
        pt = pickLandPointNear(0, 2, 8.5, 42, 1.1, 4.5);
        roamRadius = 12.5;
      }

      const yaw = rng() * Math.PI * 2;
      const maxHp = getSpeciesMaxHp(spec.id);
      actors.push({
        id: `${spec.id}-${copy}`,
        speciesId: spec.id,
        category: spec.category,
        x: pt.x,
        y: spec.flying ? pt.y + 2.4 : spec.aquatic ? 0.02 : pt.y,
        z: pt.z,
        homeX: pt.x,
        homeZ: pt.z,
        roamRadius,
        vx: Math.cos(yaw) * spec.speed * 0.4,
        vz: Math.sin(yaw) * spec.speed * 0.4,
        yaw,
        phase: rng() * Math.PI * 2,
        decisionTimer: rng() * 3.0,
        sleeping: false,
        hidden: false,
        visible: true,
        koTimer: 0,
        respawnTimer: 0,
        stunTimer: 0,
        attackState: 'idle',
        attackTimer: 0,
        attackCooldown: 0,
        attackTargetX: pt.x,
        attackTargetZ: pt.z,
        enraged: false,
        pauseTimer: 0,
        turnBank: 0,
        hp: maxHp,
        maxHp,
      });
    }
  }

  return {
    actors,
    discoveredSpecies: [],
    ambushCooldown: 0,
  };
}

const SPECIES_BY_ID = new Map<string, AnimalSpeciesSpec>(ANIMAL_SPECIES.map((s) => [s.id, s]));

export function getAnimalSpecies(speciesId: string): AnimalSpeciesSpec | undefined {
  return SPECIES_BY_ID.get(speciesId);
}

export function isHostilePredatorActor(actor: AnimalActorState): boolean {
  return (
    actor.category === 'night_predator' ||
    actor.speciesId === 'venomous_snake' ||
    actor.speciesId === 'jungle_cobra' ||
    actor.speciesId === 'pirate_crab' ||
    Boolean(actor.enraged) ||
    actor.attackState !== 'idle'
  );
}

export function markAnimalHunted(actor: AnimalActorState): void {
  actor.koTimer = 0.55;
  actor.respawnTimer = CONFIG.SURVIVAL.RESPAWN_HUNT_SEC;
  actor.vx = 0;
  actor.vz = 0;
  actor.sleeping = false;
  actor.hidden = false;
  actor.visible = true;
  actor.attackState = 'idle';
  actor.attackTimer = 0;
  actor.enraged = false;
  actor.hp = 0;
}

export function damageAnimalActor(
  actor: AnimalActorState,
  damage: number,
  fromX: number,
  fromZ: number
): { defeated: boolean; hp: number; maxHp: number; knockedX: number; knockedZ: number } {
  const maxHp = actor.maxHp ?? getSpeciesMaxHp(actor.speciesId);
  actor.maxHp = maxHp;
  const currentHp = actor.hp ?? maxHp;
  const nextHp = Math.max(0, currentHp - Math.max(1, damage));
  actor.hp = nextHp;

  const dx = actor.x - fromX;
  const dz = actor.z - fromZ;
  const dist = Math.max(0.05, Math.hypot(dx, dz));
  const nx = dx / dist;
  const nz = dz / dist;

  if (nextHp <= 0) {
    markAnimalHunted(actor);
    return { defeated: true, hp: 0, maxHp, knockedX: nx, knockedZ: nz };
  }

  // Interrupt active lunge windup & stagger predator backwards
  actor.attackState = 'idle';
  actor.attackTimer = 0;
  actor.attackCooldown = Math.max(actor.attackCooldown, 1.15);
  actor.stunTimer = Math.max(actor.stunTimer, 0.72);
  actor.enraged = true;
  actor.x += nx * 1.05;
  actor.z += nz * 1.05;
  actor.vx = nx * 2.2;
  actor.vz = nz * 2.2;
  return { defeated: false, hp: nextHp, maxHp, knockedX: nx, knockedZ: nz };
}

export function enrageAnimal(actor: AnimalActorState): void {
  actor.enraged = true;
}

export function stepWildlifeSystem(
  state: WildlifeState,
  dt: number,
  isNight: boolean,
  playerX: number,
  playerZ: number,
  nearCampfire: boolean,
  fireLevel: number,
  hasFireSpear: boolean,
  world: IslandWorldData,
  activeHuntActorId: string | null = null,
  torchActive = false
): WildlifeStepResult {
  if (dt <= 0) {
    return { discoveredNew: [], predatorNearby: false, ambushEnergyLoss: 0, predatorStrikes: [] };
  }

  if (state.ambushCooldown > 0) {
    state.ambushCooldown = Math.max(0, state.ambushCooldown - dt);
  }

  const discoveredNew: string[] = [];
  const predatorStrikes: PredatorStrikeEvent[] = [];
  let predatorNearby = false;
  let ambushEnergyLoss = 0;
  const camp = CONFIG.ISLAND.CAMPFIRE;
  const fireLit = fireLevel > 0;
  const wardRadius = fireLit ? CONFIG.ISLAND.CAMPFIRE.AURA_RADIUS + (fireLevel - 1) * 2.2 : 0;

  for (const actor of state.actors) {
    const spec = SPECIES_BY_ID.get(actor.speciesId);
    if (!spec) continue;

    if (actor.stunTimer > 0) {
      actor.stunTimer = Math.max(0, actor.stunTimer - dt);
    }
    if (actor.attackCooldown > 0) {
      actor.attackCooldown = Math.max(0, actor.attackCooldown - dt);
    }

    // 0. Hunted KO topple & respawn lifecycle
    if (actor.koTimer > 0) {
      actor.koTimer = Math.max(0, actor.koTimer - dt);
      actor.visible = actor.koTimer > 0;
      actor.hidden = !actor.visible;
      actor.vx = 0;
      actor.vz = 0;
      actor.attackState = 'idle';
      continue;
    }
    if (actor.respawnTimer > 0) {
      actor.respawnTimer = Math.max(0, actor.respawnTimer - dt);
      if (actor.respawnTimer <= 0) {
        actor.x = actor.homeX;
        actor.z = actor.homeZ;
        const hy = groundHeightAt(actor.homeX, actor.homeZ, world);
        actor.y = spec.flying ? hy + 2.4 : spec.aquatic ? 0.02 : hy;
        actor.hidden = false;
        actor.visible = true;
        actor.attackState = 'idle';
        actor.attackTimer = 0;
        actor.enraged = false;
        const maxHp = actor.maxHp ?? getSpeciesMaxHp(actor.speciesId);
        actor.maxHp = maxHp;
        actor.hp = maxHp;
        continue;
      } else {
        actor.visible = false;
        actor.hidden = true;
        continue;
      }
    }

    // 1. Day/Night Activity Rules
    if (actor.category === 'day') {
      if (isNight) {
        actor.sleeping = true;
        // Flying birds/butterflies & small critters hide in trees/bushes at night
        actor.hidden = Boolean(spec.flying || spec.id === 'squirrel' || spec.id === 'rabbit');
        actor.visible = !actor.hidden;
        actor.vx = 0;
        actor.vz = 0;
        continue;
      } else {
        actor.sleeping = false;
        actor.hidden = false;
        actor.visible = true;
      }
    } else if (actor.category === 'night_predator') {
      if (!isNight) {
        actor.sleeping = true;
        actor.hidden = true;
        actor.visible = false;
        actor.vx = 0;
        actor.vz = 0;
        continue;
      } else {
        actor.sleeping = false;
        actor.hidden = false;
        actor.visible = true;
      }
    } else {
      actor.sleeping = false;
      actor.hidden = false;
      actor.visible = true;
    }

    // 2. Species Discovery when explorer comes within 10.5m
    const distToPlayer = Math.hypot(playerX - actor.x, playerZ - actor.z);
    if (distToPlayer <= 10.5 && !state.discoveredSpecies.includes(actor.speciesId)) {
      state.discoveredSpecies.push(actor.speciesId);
      discoveredNew.push(actor.speciesId);
    }

    const speedMag = Math.hypot(actor.vx, actor.vz);
    actor.decisionTimer -= dt;
    actor.phase += dt * (1.8 + speedMag * 1.9);

    if (actor.stunTimer > 0) {
      actor.vx = 0;
      actor.vz = 0;
      actor.attackState = 'idle';
      actor.attackTimer = 0;
      actor.turnBank = 0;
      continue;
    }

    const protectedByCamp = nearCampfire && fireLit;
    const isVenomousSnake = actor.speciesId === 'venomous_snake';
    const isCobra = actor.speciesId === 'jungle_cobra';
    const isAggressiveHostile =
      actor.category === 'night_predator' ||
      (isVenomousSnake && !torchActive && (Boolean(actor.enraged) || (distToPlayer < 4.2 && !protectedByCamp))) ||
      (isCobra && !torchActive && (Boolean(actor.enraged) || (distToPlayer < 2.8 && !protectedByCamp))) ||
      (actor.speciesId === 'pirate_crab' && !torchActive && (Boolean(actor.enraged) || (distToPlayer < 4.5 && !protectedByCamp))) ||
      (actor.speciesId === 'boar' && !torchActive && (Boolean(actor.enraged) || (distToPlayer < 2.4 && !protectedByCamp)));

    // Smooth locomotion target velocity (keeps movement natural instead of instant snapping)
    let desiredVx = actor.vx;
    let desiredVz = actor.vz;
    let velBlendRate = spec.flying ? 5.2 : 6.8;

    // Handle active melee windup -> strike sequence (predator stops, telegraphs, then lunges & physically knocks back!)
    if (actor.attackState === 'windup') {
      actor.attackTimer -= dt;
      desiredVx = 0;
      desiredVz = 0;
      velBlendRate = 16.0;
      actor.yaw = Math.atan2(actor.attackTargetX - actor.x, actor.attackTargetZ - actor.z);
      if (actor.attackTimer <= 0) {
        actor.attackState = 'strike';
        actor.attackTimer = 0.26;
        const lungeAng = Math.atan2(playerZ - actor.z, playerX - actor.x);
        actor.attackTargetX = playerX;
        actor.attackTargetZ = playerZ;
        actor.vx = Math.cos(lungeAng) * spec.speed * 1.78;
        actor.vz = Math.sin(lungeAng) * spec.speed * 1.78;
        desiredVx = actor.vx;
        desiredVz = actor.vz;
        actor.attackCooldown = 1.55;
        if (distToPlayer <= 2.6) {
          const strikeDamage =
            actor.speciesId === 'black_panther' || actor.speciesId === 'pirate_crab'
              ? 24
              : actor.speciesId === 'night_wolf' || actor.speciesId === 'hyena'
                ? 18
                : actor.speciesId === 'scorpion'
                  ? 17
                  : isVenomousSnake || isCobra
                    ? 14
                    : 16;
          const venomSec = isVenomousSnake
            ? 9.0
            : isCobra || actor.speciesId === 'night_viper'
              ? 4.0
              : actor.speciesId === 'scorpion'
                ? 4.5
                : undefined;
          const kDist = Math.max(0.05, distToPlayer);
          const knockbackX = (playerX - actor.x) / kDist;
          const knockbackZ = (playerZ - actor.z) / kDist;
          const knockbackForce =
            actor.speciesId === 'black_panther' ||
            actor.speciesId === 'pirate_crab' ||
            actor.speciesId === 'night_wolf'
              ? 9.5
              : actor.speciesId === 'boar'
                ? 8.5
                : 6.2;
          ambushEnergyLoss += strikeDamage;
          state.ambushCooldown = 1.25;
          predatorStrikes.push({
            actorId: actor.id,
            speciesId: actor.speciesId,
            x: playerX,
            z: playerZ,
            damage: strikeDamage,
            knockbackX,
            knockbackZ,
            knockbackForce,
            venomSec,
          });
        }
      }
    } else if (actor.attackState === 'strike') {
      actor.attackTimer -= dt;
      desiredVx = actor.vx * 0.85;
      desiredVz = actor.vz * 0.85;
      velBlendRate = 5.0;
      if (actor.attackTimer <= 0) {
        actor.attackState = 'idle';
        actor.attackTimer = 0;
        desiredVx = 0;
        desiredVz = 0;
      }
    } else if (actor.id === activeHuntActorId) {
      // Prey braces/slows slightly while actively locked in combat/hunt
      desiredVx = actor.vx * 0.25;
      desiredVz = actor.vz * 0.25;
      velBlendRate = 10.0;
    } else if (isAggressiveHostile) {
      const distToCamp = Math.hypot(actor.x - camp.CX, actor.z - camp.CZ);
      const playerSafe =
        (actor.category === 'night_predator' && (protectedByCamp || (hasFireSpear && fireLevel >= 3))) ||
        torchActive;
      if (actor.category === 'night_predator' && fireLit && distToCamp < wardRadius + 1.5) {
        // Lit campfire scares predators away from camp!
        const awayAngle = Math.atan2(actor.z - camp.CZ, actor.x - camp.CX);
        desiredVx = Math.cos(awayAngle) * spec.speed;
        desiredVz = Math.sin(awayAngle) * spec.speed;
      } else if (distToPlayer < 17.0 && !playerSafe) {
        predatorNearby = true;
        if (distToPlayer <= 1.95 && actor.attackCooldown <= 0) {
          // Stop in front of player and telegraph visible attack!
          actor.attackState = 'windup';
          actor.attackTimer = 0.42;
          actor.attackTargetX = playerX;
          actor.attackTargetZ = playerZ;
          desiredVx = 0;
          desiredVz = 0;
          velBlendRate = 18.0;
          actor.yaw = Math.atan2(playerX - actor.x, playerZ - actor.z);
        } else if (distToPlayer <= 1.95) {
          // Hold menacing stance while cooldown ticks
          desiredVx = 0;
          desiredVz = 0;
          velBlendRate = 12.0;
          actor.yaw = Math.atan2(playerX - actor.x, playerZ - actor.z);
        } else {
          const chaseAngle = Math.atan2(playerZ - actor.z, playerX - actor.x);
          desiredVx = Math.cos(chaseAngle) * spec.speed * 0.96;
          desiredVz = Math.sin(chaseAngle) * spec.speed * 0.96;
          velBlendRate = 8.5;
        }
      } else if (actor.decisionTimer <= 0) {
        actor.enraged = false;
        actor.decisionTimer = 1.6 + Math.abs(Math.sin(actor.phase)) * 2.2;
        const toHome = Math.atan2(actor.homeZ - actor.z, actor.homeX - actor.x);
        const wobble = (Math.sin(actor.phase * 1.7) - 0.5) * 2.4;
        const distHome = Math.hypot(actor.x - actor.homeX, actor.z - actor.homeZ);
        const angle = distHome > actor.roamRadius ? toHome : toHome + wobble;
        desiredVx = Math.cos(angle) * spec.speed * 0.65;
        desiredVz = Math.sin(angle) * spec.speed * 0.65;
      }
    } else if (
      (actor.speciesId === 'rabbit' || actor.speciesId === 'deer' || actor.speciesId === 'squirrel') &&
      distToPlayer < 4.2 &&
      distToPlayer > 1.2
    ) {
      // Timid prey gracefully bounds away if explorer sprints up close
      const fleeAngle = Math.atan2(actor.z - playerZ, actor.x - playerX);
      desiredVx = Math.cos(fleeAngle) * spec.speed * 1.05;
      desiredVz = Math.sin(fleeAngle) * spec.speed * 1.05;
      velBlendRate = 9.0;
      actor.pauseTimer = 0;
      actor.decisionTimer = 0.7;
    } else if ((actor.pauseTimer ?? 0) > 0) {
      actor.pauseTimer = Math.max(0, (actor.pauseTimer ?? 0) - dt);
      desiredVx = 0;
      desiredVz = 0;
      velBlendRate = 5.5;
    } else if (actor.decisionTimer <= 0) {
      const pauseRoll = Math.abs(Math.sin(actor.phase * 3.17));
      if (!spec.flying && !spec.aquatic && pauseRoll > 0.72) {
        actor.pauseTimer = 1.0 + pauseRoll * 1.2;
        actor.decisionTimer = actor.pauseTimer + 0.5;
        desiredVx = 0;
        desiredVz = 0;
      } else {
        actor.decisionTimer = 1.4 + Math.abs(Math.cos(actor.phase)) * 2.6;
        const distHome = Math.hypot(actor.x - actor.homeX, actor.z - actor.homeZ);
        const angle =
          distHome > actor.roamRadius
            ? Math.atan2(actor.homeZ - actor.z, actor.homeX - actor.x)
            : actor.yaw + Math.sin(actor.phase * 2.3) * 1.75;
        const roamScale = spec.aquatic || spec.flying ? 0.85 : 0.7;
        desiredVx = Math.cos(angle) * spec.speed * roamScale;
        desiredVz = Math.sin(angle) * spec.speed * roamScale;
      }
    }

    const blend = 1 - Math.exp(-velBlendRate * dt);
    actor.vx += (desiredVx - actor.vx) * blend;
    actor.vz += (desiredVz - actor.vz) * blend;

    const nextX = actor.x + actor.vx * dt;
    const nextZ = actor.z + actor.vz * dt;
    const nextH = groundHeightAt(nextX, nextZ, world);

    // Enforce habitat bounds strictly!
    let validMove = true;
    if (spec.aquatic) {
      // Marine fish & sea turtles NEVER enter the sandy beach!
      if (nextH > -0.4) validMove = false;
    } else if (spec.homeBiome === 'beach') {
      // Crabs & starfish stay on beach sand / surf edge
      if (nextH < -0.15 || nextH > 1.35) validMove = false;
    } else if (!spec.flying && !spec.amphibious) {
      if (nextH < 0.1) validMove = false;
    }

    if (validMove) {
      actor.x = nextX;
      actor.z = nextZ;
      actor.y = spec.flying
        ? Math.max(1.2, nextH) + 2.1 + Math.sin(actor.phase * 1.3) * 0.35
        : spec.aquatic
          ? 0.02
          : nextH;
    } else {
      actor.vx = -actor.vx;
      actor.vz = -actor.vz;
      actor.decisionTimer = 0.25;
    }

    if (Math.hypot(actor.vx, actor.vz) > 0.06) {
      const targetYaw = Math.atan2(actor.vx, actor.vz);
      let diff = targetYaw - actor.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnRate = spec.flying || spec.aquatic ? 7.5 : 9.0;
      actor.yaw += diff * Math.min(1, dt * turnRate);
      actor.turnBank = Math.max(-0.45, Math.min(0.45, diff * 0.65));
    } else {
      actor.turnBank = (actor.turnBank ?? 0) * Math.max(0, 1 - dt * 8);
    }
  }

  return {
    discoveredNew,
    predatorNearby,
    ambushEnergyLoss,
    predatorStrikes,
  };
}
