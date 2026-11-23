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
    nameFa: 'خرچنگ غول‌پیکر دزدان',
    category: 'strange',
    archetype: 'crab',
    habitatFa: 'خلیج کشتی‌شکسته',
    homeBiome: 'shipwreck',
    speed: 1.85,
    scale: 1.45,
    primaryColor: 0xb8292f,
    secondaryColor: 0xffc83d,
    accentColor: 0x1b2432,
    amphibious: true,
  },
];

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

export function stepWildlifeSystem(
  state: WildlifeState,
  dt: number,
  isNight: boolean,
  playerX: number,
  playerZ: number,
  nearCampfire: boolean,
  fireLevel: number,
  hasFireSpear: boolean,
  world: IslandWorldData
): WildlifeStepResult {
  if (dt <= 0) {
    return { discoveredNew: [], predatorNearby: false, ambushEnergyLoss: 0 };
  }

  if (state.ambushCooldown > 0) {
    state.ambushCooldown = Math.max(0, state.ambushCooldown - dt);
  }

  const discoveredNew: string[] = [];
  let predatorNearby = false;
  let ambushEnergyLoss = 0;
  const camp = CONFIG.ISLAND.CAMPFIRE;
  const wardRadius = CONFIG.ISLAND.CAMPFIRE.AURA_RADIUS + (fireLevel - 1) * 2.2;

  for (const actor of state.actors) {
    const spec = SPECIES_BY_ID.get(actor.speciesId);
    if (!spec) continue;

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

    // 3. Movement AI
    actor.decisionTimer -= dt;
    actor.phase += dt * (2.5 + spec.speed * 1.4);

    if (actor.category === 'night_predator') {
      const distToCamp = Math.hypot(actor.x - camp.CX, actor.z - camp.CZ);
      const playerSafe = nearCampfire || hasFireSpear;
      if (distToCamp < wardRadius + 1.5) {
        // Campfire scares predators away from camp!
        const awayAngle = Math.atan2(actor.z - camp.CZ, actor.x - camp.CX);
        actor.vx = Math.cos(awayAngle) * spec.speed;
        actor.vz = Math.sin(awayAngle) * spec.speed;
      } else if (distToPlayer < 13.5 && !playerSafe) {
        predatorNearby = true;
        const chaseAngle = Math.atan2(playerZ - actor.z, playerX - actor.x);
        actor.vx = Math.cos(chaseAngle) * spec.speed * 0.78;
        actor.vz = Math.sin(chaseAngle) * spec.speed * 0.78;

        if (distToPlayer < 1.35 && state.ambushCooldown <= 0) {
          ambushEnergyLoss = 6;
          state.ambushCooldown = 4.5;
        }
      } else if (actor.decisionTimer <= 0) {
        actor.decisionTimer = 1.6 + Math.abs(Math.sin(actor.phase)) * 2.2;
        const toHome = Math.atan2(actor.homeZ - actor.z, actor.homeX - actor.x);
        const wobble = (Math.sin(actor.phase * 1.7) - 0.5) * 2.4;
        const distHome = Math.hypot(actor.x - actor.homeX, actor.z - actor.homeZ);
        const angle = distHome > actor.roamRadius ? toHome : toHome + wobble;
        actor.vx = Math.cos(angle) * spec.speed * 0.65;
        actor.vz = Math.sin(angle) * spec.speed * 0.65;
      }
    } else if (actor.decisionTimer <= 0) {
      actor.decisionTimer = 1.4 + Math.abs(Math.cos(actor.phase)) * 2.6;
      const distHome = Math.hypot(actor.x - actor.homeX, actor.z - actor.homeZ);
      const angle =
        distHome > actor.roamRadius
          ? Math.atan2(actor.homeZ - actor.z, actor.homeX - actor.x)
          : actor.yaw + Math.sin(actor.phase * 2.3) * 1.9;
      actor.vx = Math.cos(angle) * spec.speed * 0.65;
      actor.vz = Math.sin(angle) * spec.speed * 0.65;
    }

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

    if (Math.hypot(actor.vx, actor.vz) > 0.05) {
      actor.yaw = Math.atan2(actor.vx, actor.vz);
    }
  }

  return {
    discoveredNew,
    predatorNearby,
    ambushEnergyLoss,
  };
}
