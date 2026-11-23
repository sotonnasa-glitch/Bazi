import {
  CONFIG,
  type BiomeId,
  type CampUpgradeId,
  type DayPhase,
  type GameOutcome,
  type SeasonKind,
  type SkillId,
  type StrangeLandmarkId,
  type WeaponId,
  type WeatherKind,
  type WorldEventKind,
} from './config';
import {
  createWildlifeState,
  enrageAnimal,
  getAnimalSpecies,
  markAnimalHunted,
  stepWildlifeSystem,
  type AnimalActorState,
  type PredatorStrikeEvent,
  type WildlifeState,
} from './wildlife';
import type {
  BuildPadSite,
  FishingSpot,
  IslandProp,
  IslandWorldData,
  LandmarkActionSite,
  PropKind,
  SecretSpot,
} from './world';

export type ResourceKind = 'wood' | 'fish' | 'berries' | 'shell' | 'banana' | 'meat';
export type SurvivalActionKind =
  | 'idle'
  | 'chop'
  | 'climb'
  | 'spear_fish'
  | 'cast_fish'
  | 'forage'
  | 'hunt'
  | 'bow_hunt'
  | 'hammer_slam'
  | 'cook'
  | 'build'
  | 'secret_open'
  | 'voyage';

export type FocusedTargetKind = 'node' | 'prey' | 'pad' | 'secret' | 'landmark' | 'boat_voyage';
export type BlockedReason =
  | 'backpack_full'
  | 'low_energy'
  | 'need_spear'
  | 'need_fire_level'
  | 'need_wood'
  | 'cooldown';

export interface FocusedTargetInfo {
  kind: FocusedTargetKind;
  id: string;
  action: SurvivalActionKind;
  labelFa: string;
  x: number;
  y: number;
  z: number;
  blockedReason?: BlockedReason;
  woodCost?: number;
}

export interface HarvestNodeState {
  id: string;
  kind: ResourceKind;
  propKind: PropKind | 'fishing';
  x: number;
  y: number;
  z: number;
  waterX?: number;
  waterZ?: number;
  waterAngle?: number;
  range: number;
  duration: number;
  energyCost: number;
  regrowDuration: number;
  cooldownRemaining: number;
}

export interface HazardImpact {
  id: string;
  kind: 'lightning' | 'lava' | 'meteor';
  x: number;
  z: number;
  radius: number;
  delayTimer: number;
  maxDelay: number;
  resolved: boolean;
  resolveTimer: number;
}

export interface TargetInteractRequest {
  kind: FocusedTargetKind;
  id: string;
}

export interface WeaponLevelUpEvent {
  weaponId: WeaponId;
  newLevel: number;
}

export interface SurvivalState {
  carried: {
    wood: number;
    fish: number;
    berries: number;
    shell: number;
    banana: number;
    meat: number;
  };
  carriedStack: ResourceKind[];
  stashed: {
    wood: number;
    shell: number;
  };
  cookedFish: number;
  roastedBanana: number;
  cookedMeat: number;
  huntedCount: number;
  coins: number;
  energy: number;
  maxEnergy: number;
  backpackCapacity: number;
  hasSpear: boolean;
  hasFireSpear: boolean;
  equippedWeapon: WeaponId;
  unlockedWeapons: Record<WeaponId, boolean>;
  weaponLevels: Record<WeaponId, number>;
  weaponXp: Record<WeaponId, number>;
  fireLevel: number;
  fireStokedCount: number;
  xp: number;
  playerLevel: number;
  playerXp: number;
  playerXpToNext: number;
  skillPoints: number;
  skills: Record<SkillId, number>;
  timeOfDay: number;
  dayCount: number;
  phase: DayPhase;
  isNight: boolean;
  weather: WeatherKind;
  weatherTimer: number;
  weatherTick: number;
  groundWetness: number;
  season: SeasonKind;
  seasonMix: number;
  isSwimming: boolean;
  gameOutcome: GameOutcome;
  activeEvent: WorldEventKind;
  eventPhase: 'idle' | 'warning' | 'active';
  eventTimer: number;
  nextEventTimer: number;
  eventTick: number;
  seaLevelOffset: number;
  boatVoyageCooldown: number;
  nodes: HarvestNodeState[];
  buildPads: BuildPadSite[];
  landmarkSites: LandmarkActionSite[];
  secretSpots: SecretSpot[];
  discoveredSecrets: string[];
  landmarkCooldowns: Record<StrangeLandmarkId, number>;
  landmarkSpecialCooldowns: Record<StrangeLandmarkId, number>;
  buildings: Record<CampUpgradeId, boolean>;
  buildProgress: Record<CampUpgradeId, number>;
  wildlife: WildlifeState;
  focusedTarget: FocusedTargetInfo | null;
  interactTriggerQueued: boolean;
  queuedTargetInteract: TargetInteractRequest | null;
  rangedShotTarget: { x: number; z: number; actorId?: string } | null;
  hazardImpacts: HazardImpact[];
  hazardSpawnTimer: number;
  tsunamiDamageTimer: number;
  autoFishIdleTimer: number;
  autoFishCooldown: number;
  activeNodeId: string | null;
  activeHuntActorId: string | null;
  activeBuildId: CampUpgradeId | null;
  activeAction: SurvivalActionKind;
  actionTargetX: number;
  actionTargetZ: number;
  harvestProgress: number;
  huntProgress: number;
  actionProgress: number;
  cookProgress: number;
  nearCampfire: boolean;
  backpackFullBlocked: boolean;
  lowEnergyBlocked: boolean;
  needSpearBlocked: boolean;
  needSpearHuntBlocked: boolean;
  predatorAlert: boolean;
  nearbyPad: { id: CampUpgradeId; cost: number; totalWood: number } | null;
  nearbyLandmark: { id: StrangeLandmarkId; cooldown: number; specialCooldown: number } | null;
  stashedTotalForCoin: number;
  fireStokeAnimTimer: number;
  hammerSlamCooldown: number;
}

export interface SurvivalStepResult {
  hudChanged: boolean;
  harvested?: {
    nodeId: string;
    kind: ResourceKind;
    propKind: PropKind | 'fishing';
    amount: number;
    x: number;
    y: number;
    z: number;
  };
  fishingMissed?: {
    nodeId: string;
    x: number;
    z: number;
    notice: string;
  };
  hunted?: {
    actorId: string;
    speciesId: string;
    amount: number;
    x: number;
    y: number;
    z: number;
    ranged?: boolean;
  };
  arrowShot?: {
    fromX: number;
    fromY: number;
    fromZ: number;
    toX: number;
    toY: number;
    toZ: number;
  };
  hammerSlam?: {
    x: number;
    y: number;
    z: number;
    stunnedCount: number;
    lightningStrike?: boolean;
  };
  builtUpgrade?: {
    id: CampUpgradeId;
    x: number;
    y: number;
    z: number;
  };
  openedSecret?: {
    id: string;
    nameFa: string;
    x: number;
    y: number;
    z: number;
  };
  eventStarted?: {
    kind: WorldEventKind;
    phase: 'warning' | 'active';
    notice: string;
  };
  eventEndedNotice?: string;
  boatVoyageNotice?: string;
  weaponLevelUps: WeaponLevelUpEvent[];
  playerLevelUp?: number;
  hazardStrikes: Array<{
    id: string;
    kind: 'lightning' | 'lava' | 'meteor';
    x: number;
    z: number;
    hitPlayer: boolean;
    damage: number;
  }>;
  predatorStrikes: PredatorStrikeEvent[];
  damageTaken: number;
  cookedCount: number;
  roastedBananaCount: number;
  cookedMeatCount: number;
  depositedToCamp: number;
  earnedCoins: number;
  discoveredSpecies: string[];
}

export interface SurvivalHudView {
  coins: number;
  wood: number;
  fish: number;
  cookedFish: number;
  banana: number;
  roastedBanana: number;
  meat: number;
  cookedMeat: number;
  huntedCount: number;
  berries: number;
  shells: number;
  energy: number;
  maxEnergy: number;
  backpackUsed: number;
  backpackCapacity: number;
  biome: BiomeId;
  timeOfDay: number;
  dayCount: number;
  phase: DayPhase;
  isNight: boolean;
  weather: WeatherKind;
  groundWetness: number;
  season: SeasonKind;
  seasonMix: number;
  isSwimming: boolean;
  activeEvent: WorldEventKind;
  eventPhase: 'idle' | 'warning' | 'active';
  eventTimer: number;
  hasSpear: boolean;
  hasFireSpear: boolean;
  canCraftSpear: boolean;
  equippedWeapon: WeaponId;
  unlockedWeapons: Record<WeaponId, boolean>;
  weaponLevels: Record<WeaponId, number>;
  weaponXp: Record<WeaponId, number>;
  weaponXpToNext: Record<WeaponId, number>;
  fireLevel: number;
  canStokeFire: boolean;
  xp: number;
  playerLevel: number;
  playerXp: number;
  playerXpToNext: number;
  skillPoints: number;
  skills: Record<SkillId, number>;
  discoveredAnimals: string[];
  secretsFound: number;
  secretsTotal: number;
  canVictoryVoyage: boolean;
  gameOutcome: GameOutcome;
  nearCampfire: boolean;
  backpackFullBlocked: boolean;
  lowEnergyBlocked: boolean;
  needSpearBlocked: boolean;
  needSpearHuntBlocked: boolean;
  predatorAlert: boolean;
  canEatFood: boolean;
  bestFoodKind: 'cookedMeat' | 'roastedBanana' | 'cookedFish' | 'banana' | 'berries' | null;
  activeAction: SurvivalActionKind;
  focusedTarget: FocusedTargetInfo | null;
  buildings: Record<CampUpgradeId, boolean>;
  nearbyPad: { id: CampUpgradeId; cost: number; totalWood: number } | null;
  nearbyLandmark: { id: StrangeLandmarkId; cooldown: number; specialCooldown: number } | null;
}

export function getDayPhase(timeOfDay: number): DayPhase {
  const t = ((timeOfDay % 1) + 1) % 1;
  const { DAWN_START, DAY_START, DUSK_START, NIGHT_START } = CONFIG.DAY_NIGHT;
  if (t >= NIGHT_START || t < DAWN_START) return 'night';
  if (t < DAY_START) return 'dawn';
  if (t < DUSK_START) return 'day';
  return 'dusk';
}

function mapPropToHarvestConfig(
  prop: IslandProp
): Omit<HarvestNodeState, 'id' | 'x' | 'y' | 'z' | 'cooldownRemaining'> | null {
  if (
    prop.kind === 'palm' ||
    prop.kind === 'jungle' ||
    prop.kind === 'pine' ||
    prop.kind === 'banyan' ||
    prop.kind === 'willow'
  ) {
    return {
      kind: 'wood',
      propKind: prop.kind,
      range: CONFIG.SURVIVAL.HARVEST_RANGE_TREE + (prop.scale - 1) * 0.35,
      duration: CONFIG.SURVIVAL.HARVEST_DURATION_TREE,
      energyCost: CONFIG.SURVIVAL.HARVEST_ENERGY_COST_TREE,
      regrowDuration: CONFIG.SURVIVAL.REGROW_TREE_SEC,
    };
  }
  if (prop.kind === 'banana') {
    return {
      kind: 'banana',
      propKind: 'banana',
      range: CONFIG.SURVIVAL.HARVEST_RANGE_BANANA + (prop.scale - 1) * 0.25,
      duration: CONFIG.SURVIVAL.HARVEST_DURATION_BANANA,
      energyCost: CONFIG.SURVIVAL.HARVEST_ENERGY_COST_BANANA,
      regrowDuration: CONFIG.SURVIVAL.REGROW_BANANA_SEC,
    };
  }
  if (prop.kind === 'bush') {
    return {
      kind: 'berries',
      propKind: prop.kind,
      range: CONFIG.SURVIVAL.HARVEST_RANGE_BUSH + (prop.scale - 1) * 0.25,
      duration: CONFIG.SURVIVAL.HARVEST_DURATION_BUSH,
      energyCost: CONFIG.SURVIVAL.HARVEST_ENERGY_COST_BUSH,
      regrowDuration: CONFIG.SURVIVAL.REGROW_BUSH_SEC,
    };
  }
  if (prop.kind === 'shell') {
    return {
      kind: 'shell',
      propKind: prop.kind,
      range: CONFIG.SURVIVAL.HARVEST_RANGE_SHELL,
      duration: CONFIG.SURVIVAL.HARVEST_DURATION_SHELL,
      energyCost: 0.2,
      regrowDuration: CONFIG.SURVIVAL.REGROW_SHELL_SEC,
    };
  }
  return null;
}

function mapFishingSpotToNode(spot: FishingSpot): HarvestNodeState {
  return {
    id: spot.id,
    kind: 'fish',
    propKind: 'fishing',
    x: spot.x,
    y: spot.y,
    z: spot.z,
    waterX: spot.waterX,
    waterZ: spot.waterZ,
    waterAngle: spot.waterAngle,
    range: CONFIG.SURVIVAL.HARVEST_RANGE_FISHING,
    duration: CONFIG.SURVIVAL.HARVEST_DURATION_FISHING,
    energyCost: CONFIG.SURVIVAL.HARVEST_ENERGY_COST_FISHING,
    regrowDuration: CONFIG.SURVIVAL.REGROW_FISHING_SEC,
    cooldownRemaining: 0,
  };
}

export function createHarvestNodesFromWorld(world: IslandWorldData): HarvestNodeState[] {
  const nodes: HarvestNodeState[] = [];
  for (const prop of world.props) {
    const cfg = mapPropToHarvestConfig(prop);
    if (!cfg) continue;
    nodes.push({
      id: prop.id,
      x: prop.x,
      y: prop.y,
      z: prop.z,
      cooldownRemaining: 0,
      ...cfg,
    });
  }
  for (const spot of world.fishingSpots) {
    nodes.push(mapFishingSpotToNode(spot));
  }
  return nodes;
}

export function recomputeMaxEnergy(
  state: Pick<SurvivalState, 'skills'> & { playerLevel?: number }
): number {
  const lvlBonus = Math.max(0, (state.playerLevel ?? 1) - 1) * 5;
  return CONFIG.PLAYER.MAX_ENERGY + state.skills.pyromancer * 20 + lvlBonus;
}

export function recomputeBackpackCapacity(
  state: Pick<SurvivalState, 'buildings' | 'skills'> & { playerLevel?: number }
): number {
  const base = state.buildings.rack
    ? CONFIG.PLAYER.UPGRADED_BACKPACK_CAPACITY
    : CONFIG.PLAYER.BACKPACK_CAPACITY;
  const lvlBonus = Math.floor(Math.max(0, (state.playerLevel ?? 1) - 1) / 2);
  return base + state.skills.backpacker * 4 + lvlBonus;
}

export function getWeaponXpThreshold(level: number): number {
  const thresholds = CONFIG.SURVIVAL.WEAPON_XP_PER_LEVEL;
  const idx = Math.max(0, Math.min(thresholds.length - 1, level));
  return thresholds[idx];
}

function getPlayerXpThreshold(level: number): number {
  const thresholds = CONFIG.PLAYER.LEVEL_XP_THRESHOLDS;
  const idx = Math.max(0, Math.min(thresholds.length - 1, level));
  return thresholds[idx];
}

function awardXp(state: SurvivalState, baseAmount: number): number | undefined {
  const fireXpMult = state.fireLevel >= 7 ? 1.75 : state.fireLevel >= 4 ? 1.5 : 1;
  const gained = Math.round(baseAmount * fireXpMult);
  state.xp += gained;
  state.playerXp += gained;
  const threshold = CONFIG.SURVIVAL.XP_PER_SKILL_POINT;
  while (state.xp >= threshold) {
    state.xp -= threshold;
    state.skillPoints += 1;
  }

  let leveledUpTo: number | undefined;
  while (
    state.playerLevel < CONFIG.PLAYER.MAX_LEVEL &&
    state.playerXp >= getPlayerXpThreshold(state.playerLevel)
  ) {
    state.playerLevel += 1;
    leveledUpTo = state.playerLevel;
    state.skillPoints += 1;
    state.coins += 6;
    state.maxEnergy = recomputeMaxEnergy(state);
    state.backpackCapacity = recomputeBackpackCapacity(state);
    state.energy = Math.min(state.maxEnergy, state.energy + 20);
  }
  state.playerXpToNext =
    state.playerLevel >= CONFIG.PLAYER.MAX_LEVEL
      ? getPlayerXpThreshold(CONFIG.PLAYER.MAX_LEVEL - 1)
      : getPlayerXpThreshold(state.playerLevel);
  return leveledUpTo;
}

function awardWeaponXp(
  state: SurvivalState,
  weaponId: WeaponId,
  amount: number
): WeaponLevelUpEvent | null {
  if (!state.unlockedWeapons[weaponId] || amount <= 0) return null;
  const maxLvl = CONFIG.SURVIVAL.MAX_WEAPON_LEVEL;
  if (state.weaponLevels[weaponId] >= maxLvl) return null;
  state.weaponXp[weaponId] += amount;
  let newLevel: number | null = null;
  while (
    state.weaponLevels[weaponId] < maxLvl &&
    state.weaponXp[weaponId] >= getWeaponXpThreshold(state.weaponLevels[weaponId])
  ) {
    state.weaponLevels[weaponId] += 1;
    newLevel = state.weaponLevels[weaponId];
  }
  return newLevel ? { weaponId, newLevel } : null;
}

export function createSurvivalState(
  world: IslandWorldData,
  initialTimeOfDay = 0.38
): SurvivalState {
  const normalizedT = ((initialTimeOfDay % 1) + 1) % 1;
  const phase = getDayPhase(normalizedT);
  return {
    carried: { wood: 0, fish: 0, berries: 0, shell: 0, banana: 0, meat: 0 },
    carriedStack: [],
    stashed: { wood: 0, shell: 0 },
    cookedFish: 0,
    roastedBanana: 0,
    cookedMeat: 0,
    huntedCount: 0,
    coins: 0,
    energy: CONFIG.PLAYER.MAX_ENERGY,
    maxEnergy: CONFIG.PLAYER.MAX_ENERGY,
    backpackCapacity: CONFIG.PLAYER.BACKPACK_CAPACITY,
    hasSpear: false,
    hasFireSpear: false,
    equippedWeapon: 'axe',
    unlockedWeapons: { axe: true, spear: false, bow: false, hammer: false },
    weaponLevels: { axe: 1, spear: 1, bow: 1, hammer: 1 },
    weaponXp: { axe: 0, spear: 0, bow: 0, hammer: 0 },
    fireLevel: 1,
    fireStokedCount: 0,
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
    timeOfDay: normalizedT,
    dayCount: 1,
    phase,
    isNight: phase === 'night',
    weather: 'clear',
    weatherTimer: 22,
    weatherTick: 0,
    groundWetness: 0,
    season: 'summer',
    seasonMix: 0,
    isSwimming: false,
    gameOutcome: 'playing',
    activeEvent: 'none',
    eventPhase: 'idle',
    eventTimer: 0,
    nextEventTimer: CONFIG.SURVIVAL.WORLD_EVENTS.MIN_INTERVAL_SEC,
    eventTick: 0,
    seaLevelOffset: 0,
    boatVoyageCooldown: 0,
    nodes: createHarvestNodesFromWorld(world),
    buildPads: world.buildPads.map((p) => ({ ...p })),
    landmarkSites: world.landmarkSites.map((l) => ({ ...l })),
    secretSpots: world.secretSpots ? world.secretSpots.map((s) => ({ ...s })) : [],
    discoveredSecrets: [],
    landmarkCooldowns: { ruins: 0, volcano: 0, mushroom: 0, shipwreck: 0, spring: 0 },
    landmarkSpecialCooldowns: { ruins: 0, volcano: 0, mushroom: 0, shipwreck: 0, spring: 0 },
    buildings: { shelter: false, rack: false, pier: false, boat: false },
    buildProgress: { shelter: 0, rack: 0, pier: 0, boat: 0 },
    wildlife: createWildlifeState(world, world.seed),
    focusedTarget: null,
    interactTriggerQueued: false,
    queuedTargetInteract: null,
    rangedShotTarget: null,
    hazardImpacts: [],
    hazardSpawnTimer: 1.6,
    tsunamiDamageTimer: 0,
    autoFishIdleTimer: 0,
    autoFishCooldown: 0,
    activeNodeId: null,
    activeHuntActorId: null,
    activeBuildId: null,
    activeAction: 'idle',
    actionTargetX: 0,
    actionTargetZ: 0,
    harvestProgress: 0,
    huntProgress: 0,
    actionProgress: 0,
    cookProgress: 0,
    nearCampfire: false,
    backpackFullBlocked: false,
    lowEnergyBlocked: false,
    needSpearBlocked: false,
    needSpearHuntBlocked: false,
    predatorAlert: false,
    nearbyPad: null,
    nearbyLandmark: null,
    stashedTotalForCoin: 0,
    fireStokeAnimTimer: 0,
    hammerSlamCooldown: 0,
  };
}

export function getBackpackUsed(state: Pick<SurvivalState, 'carried'>): number {
  return (
    state.carried.wood +
    state.carried.fish +
    state.carried.berries +
    state.carried.shell +
    state.carried.banana +
    state.carried.meat
  );
}

export function getPlayerSpeedScale(
  state: Pick<SurvivalState, 'energy' | 'weather' | 'skills' | 'fireLevel' | 'nearCampfire'> & {
    playerLevel?: number;
    isSwimming?: boolean;
  }
): number {
  if (state.energy <= 1) return CONFIG.SURVIVAL.EXHAUSTED_SPEED_SCALE;

  const skillBonus = 1 + state.skills.pathfinder * 0.12;
  const levelBonus = 1 + Math.max(0, (state.playerLevel ?? 1) - 1) * 0.025;
  const fireAuraBonus = state.fireLevel >= 6 ? 1.16 : state.fireLevel >= 3 ? 1.1 : 1.0;

  // Weather effect softened by pathfinder skill
  let weatherScale = 1.0;
  const resistance = state.skills.pathfinder * 0.3;
  if (state.weather === 'rain') {
    weatherScale =
      CONFIG.WEATHER.RAIN_SPEED_SCALE +
      (1 - CONFIG.WEATHER.RAIN_SPEED_SCALE) * resistance;
  } else if (state.weather === 'storm') {
    weatherScale =
      CONFIG.WEATHER.STORM_SPEED_SCALE +
      (1 - CONFIG.WEATHER.STORM_SPEED_SCALE) * resistance;
  } else if (state.weather === 'fog') {
    weatherScale =
      CONFIG.WEATHER.FOG_SPEED_SCALE +
      (1 - CONFIG.WEATHER.FOG_SPEED_SCALE) * resistance;
  }

  const swimScale = state.isSwimming ? CONFIG.SURVIVAL.SWIM_SPEED_SCALE : 1.0;

  return skillBonus * levelBonus * fireAuraBonus * weatherScale * swimScale;
}

export function getFishingSpeedMultiplier(
  state: Pick<SurvivalState, 'weather' | 'skills' | 'activeEvent' | 'eventPhase'>
): number {
  let mult = 1 + state.skills.angler * 0.25;
  if (state.weather === 'rain') {
    mult *= CONFIG.WEATHER.RAIN_FISHING_SPEED_MULT;
  } else if (state.weather === 'storm') {
    mult *= CONFIG.WEATHER.STORM_FISHING_SPEED_MULT;
  }
  if (state.activeEvent === 'fish_frenzy' && state.eventPhase === 'active') {
    mult *= 1.65;
  }
  return mult;
}

export function getFishingCatchChance(
  state: Pick<
    SurvivalState,
    'weather' | 'skills' | 'activeEvent' | 'eventPhase' | 'weaponLevels' | 'buildings'
  >,
  node?: Pick<HarvestNodeState, 'id'>
): number {
  let chance = 0.68;
  chance += state.skills.angler * 0.08;
  chance += Math.max(0, state.weaponLevels.spear - 1) * 0.05;
  if (state.weather === 'rain' || state.weather === 'storm') chance += 0.1;
  if (state.activeEvent === 'fish_frenzy' && state.eventPhase === 'active') chance += 0.12;
  if (node?.id === 'fish-spot-0' && state.buildings.pier) chance += 0.08;
  return Math.max(0.62, Math.min(0.96, chance));
}

function removeFromStack(stack: ResourceKind[], kind: ResourceKind, count: number): void {
  let remaining = count;
  for (let i = stack.length - 1; i >= 0 && remaining > 0; i -= 1) {
    if (stack[i] === kind) {
      stack.splice(i, 1);
      remaining -= 1;
    }
  }
}

function spendWood(state: SurvivalState, cost: number): boolean {
  const totalWood = state.stashed.wood + state.carried.wood;
  if (totalWood < cost) return false;
  let remaining = cost;
  const fromStash = Math.min(state.stashed.wood, remaining);
  state.stashed.wood -= fromStash;
  remaining -= fromStash;
  if (remaining > 0) {
    state.carried.wood = Math.max(0, state.carried.wood - remaining);
    removeFromStack(state.carriedStack, 'wood', remaining);
  }
  return true;
}

export function craftSpear(state: SurvivalState): boolean {
  if (state.hasSpear) return false;
  if (!spendWood(state, CONFIG.SURVIVAL.SPEAR_CRAFT_WOOD_COST)) return false;
  state.hasSpear = true;
  state.unlockedWeapons.spear = true;
  state.equippedWeapon = 'spear';
  state.needSpearBlocked = false;
  state.needSpearHuntBlocked = false;
  awardXp(state, 10);
  return true;
}

export function selectWeapon(state: SurvivalState, weaponId: WeaponId): boolean {
  if (!state.unlockedWeapons[weaponId]) return false;
  state.equippedWeapon = weaponId;
  return true;
}

export function upgradeWeapon(state: SurvivalState, weaponId: WeaponId): boolean {
  if (!state.unlockedWeapons[weaponId]) return false;
  const current = state.weaponLevels[weaponId];
  if (current >= CONFIG.SURVIVAL.MAX_WEAPON_LEVEL) return false;

  if (state.skillPoints > 0) {
    state.skillPoints -= 1;
  } else if (!spendWood(state, CONFIG.SURVIVAL.WEAPON_UPGRADE_WOOD_COST)) {
    return false;
  }

  state.weaponLevels[weaponId] = current + 1;
  return true;
}

export function stokeCampfire(state: SurvivalState): boolean {
  if (!state.nearCampfire) return false;
  if (state.fireLevel >= CONFIG.SURVIVAL.MAX_FIRE_LEVEL) return false;
  if (!spendWood(state, CONFIG.SURVIVAL.FIRE_FUEL_WOOD_COST)) return false;
  state.fireStokedCount += 1;
  state.fireLevel = Math.min(CONFIG.SURVIVAL.MAX_FIRE_LEVEL, state.fireLevel + 1);
  if (state.fireLevel >= 3) {
    state.unlockedWeapons.bow = true;
  }
  if (state.fireLevel >= 4) {
    state.unlockedWeapons.hammer = true;
  }
  state.energy = Math.min(state.maxEnergy, state.energy + 18);
  state.fireStokeAnimTimer = 0.65;
  state.coins += 2;
  awardXp(state, 14);
  return true;
}

export function upgradeSkill(state: SurvivalState, skillId: SkillId): boolean {
  const spec = CONFIG.SKILL_TREE.find((s) => s.id === skillId);
  if (!spec) return false;
  const currentLvl = state.skills[skillId];
  if (currentLvl >= spec.maxLevel) return false;

  if (state.skillPoints > 0) {
    state.skillPoints -= 1;
  } else if (!spendWood(state, spec.woodCost)) {
    return false;
  }

  state.skills[skillId] = currentLvl + 1;
  state.maxEnergy = recomputeMaxEnergy(state);
  state.backpackCapacity = recomputeBackpackCapacity(state);
  if (skillId === 'pyromancer') {
    state.energy = Math.min(state.maxEnergy, state.energy + 20);
  }
  return true;
}

export function requestPlayerInteract(state: SurvivalState): void {
  state.interactTriggerQueued = true;
}

export function requestTargetInteract(
  state: SurvivalState,
  kind: FocusedTargetKind,
  id: string
): void {
  state.queuedTargetInteract = { kind, id };
}

export function requestBowShotAt(
  state: SurvivalState,
  x: number,
  z: number,
  actorId?: string
): void {
  state.rangedShotTarget = { x, z, actorId };
}

export function openSecretSpot(
  state: SurvivalState,
  secretId: string,
  playerX?: number,
  playerZ?: number
): { opened: boolean; secret?: SecretSpot; reason?: string } {
  if (state.discoveredSecrets.includes(secretId)) {
    return { opened: false, reason: 'already_opened' };
  }
  const secret = state.secretSpots.find((s) => s.id === secretId);
  if (!secret) return { opened: false, reason: 'not_found' };
  if (
    playerX !== undefined &&
    playerZ !== undefined &&
    Math.hypot(playerX - secret.x, playerZ - secret.z) > CONFIG.SURVIVAL.HARVEST_RANGE_SECRET + 0.55
  ) {
    return { opened: false, reason: 'too_far' };
  }
  state.discoveredSecrets.push(secret.id);
  state.coins += 15;
  state.skillPoints += 1;
  state.energy = Math.min(state.maxEnergy, state.energy + 25);
  awardXp(state, 30);
  return { opened: true, secret };
}

export function triggerVictoryVoyage(state: SurvivalState): boolean {
  if (!state.buildings.boat || state.playerLevel < CONFIG.SURVIVAL.VICTORY_MIN_LEVEL) {
    return false;
  }
  state.gameOutcome = 'victory';
  state.coins += 25 + state.discoveredSecrets.length * 10;
  return true;
}

function getWorldEventActiveDuration(kind: WorldEventKind): number {
  const ev = CONFIG.SURVIVAL.WORLD_EVENTS;
  if (kind === 'low_tide') return ev.LOW_TIDE_DURATION_SEC;
  if (kind === 'tsunami') return ev.TSUNAMI_DURATION_SEC;
  if (kind === 'volcano_eruption') return ev.VOLCANO_DURATION_SEC;
  if (kind === 'meteor_shower') return ev.METEOR_DURATION_SEC;
  if (kind === 'fish_frenzy') return ev.FISH_FRENZY_DURATION_SEC;
  if (kind === 'autumn_breeze') return ev.AUTUMN_DURATION_SEC;
  if (kind === 'winter_frost') return ev.WINTER_DURATION_SEC;
  return 0;
}

export function getWorldEventNoticeText(
  kind: WorldEventKind,
  phase: 'warning' | 'active'
): string {
  if (kind === 'tsunami') {
    return phase === 'warning'
      ? 'هشدار سونامی! موج عظیم به ساحل نزدیک می‌شود — به بلندی برو!'
      : 'سونامی رسید! موج بلند سواحل جزیره را درنوردید!';
  }
  if (kind === 'low_tide') {
    return 'جزر و مد پایین! آب دریا عقب نشست و صدف‌های بستر نمایان شدند!';
  }
  if (kind === 'volcano_eruption') {
    return phase === 'warning'
      ? 'لرزش آتشفشان! قله آتشفشان آماده فوران است!'
      : 'فوران آتشفشان! سنگ‌های گدازه نزدیک شما فرود می‌آیند — جاخالی بده!';
  }
  if (kind === 'meteor_shower') {
    return 'بارش شهاب‌سنگ! از دایره‌های قرمز برخورد جاخالی بده و سکه بگیر!';
  }
  if (kind === 'fish_frenzy') {
    return 'رونق ماهی‌گیری! دسته‌های ماهی در خلیج جمع شدند (+سرعت و صید بیشتر)!';
  }
  if (kind === 'autumn_breeze') {
    return 'فصل نادر پاییز! برگ‌های نارنجی جزیره را پوشاندند و گیاهان سریع‌تر می‌رویند!';
  }
  if (kind === 'winter_frost') {
    return 'فصل نادر زمستان! برف قله‌ها و دامنه‌ها را سفیدپوش کرد!';
  }
  return '';
}

export function triggerWorldEvent(
  state: SurvivalState,
  kind: Exclude<WorldEventKind, 'none'>,
  skipWarning = false
): { kind: WorldEventKind; phase: 'warning' | 'active'; notice: string } {
  const evCfg = CONFIG.SURVIVAL.WORLD_EVENTS;
  state.activeEvent = kind;
  const needsWarning = !skipWarning && (kind === 'tsunami' || kind === 'volcano_eruption');
  state.eventPhase = needsWarning ? 'warning' : 'active';
  state.eventTimer = needsWarning ? evCfg.WARNING_SEC : getWorldEventActiveDuration(kind);

  if (state.eventPhase === 'active') {
    applyWorldEventActiveEffects(state, kind);
  }
  return {
    kind,
    phase: state.eventPhase,
    notice: getWorldEventNoticeText(kind, state.eventPhase),
  };
}

export function triggerSeasonEvent(
  state: SurvivalState,
  season: 'autumn' | 'winter'
): { kind: WorldEventKind; phase: 'warning' | 'active'; notice: string } {
  const ev = triggerWorldEvent(
    state,
    season === 'autumn' ? 'autumn_breeze' : 'winter_frost',
    true
  );
  state.season = season;
  state.seasonMix = 1;
  return ev;
}

function applyWorldEventActiveEffects(state: SurvivalState, kind: WorldEventKind): void {
  if (kind === 'fish_frenzy') {
    for (const node of state.nodes) {
      if (node.propKind === 'fishing') {
        node.cooldownRemaining = 0;
      }
    }
  } else if (kind === 'low_tide') {
    state.stashed.shell += 2;
    for (const node of state.nodes) {
      if (node.propKind === 'shell') {
        node.cooldownRemaining = 0;
      }
    }
  } else if (kind === 'volcano_eruption') {
    state.coins += 6;
    awardXp(state, 15);
  } else if (kind === 'meteor_shower') {
    state.coins += 5;
    state.energy = Math.min(state.maxEnergy, state.energy + 15);
    awardXp(state, 18);
  } else if (kind === 'autumn_breeze') {
    state.season = 'autumn';
    state.coins += 4;
    awardXp(state, 12);
  } else if (kind === 'winter_frost') {
    state.season = 'winter';
    state.coins += 4;
    awardXp(state, 12);
  }
}

function spendShells(state: SurvivalState, cost: number): boolean {
  const total = state.stashed.shell + state.carried.shell;
  if (total < cost) return false;
  let remaining = cost;
  const fromStash = Math.min(state.stashed.shell, remaining);
  state.stashed.shell -= fromStash;
  remaining -= fromStash;
  if (remaining > 0) {
    state.carried.shell = Math.max(0, state.carried.shell - remaining);
    removeFromStack(state.carriedStack, 'shell', remaining);
  }
  return true;
}

export function activateLandmarkPower(
  state: SurvivalState,
  landmarkId: StrangeLandmarkId
): { triggered: boolean; label: string } {
  if (state.landmarkCooldowns[landmarkId] > 0) {
    return { triggered: false, label: '' };
  }
  state.landmarkCooldowns[landmarkId] = CONFIG.SURVIVAL.LANDMARK_COOLDOWN_SEC;

  if (landmarkId === 'ruins') {
    state.timeOfDay = 0.42;
    state.phase = getDayPhase(state.timeOfDay);
    state.isNight = false;
    state.coins += 5;
    awardXp(state, 15);
    return { triggered: true, label: 'آیین خورشید: روشنایی روز بازگشت (+۵ سکه)' };
  }
  if (landmarkId === 'volcano') {
    state.hasSpear = true;
    state.unlockedWeapons.spear = true;
    state.hasFireSpear = true;
    if (state.carried.fish > 0) {
      state.cookedFish += state.carried.fish;
      removeFromStack(state.carriedStack, 'fish', state.carried.fish);
      state.carried.fish = 0;
    }
    if (state.carried.banana > 0) {
      state.roastedBanana += state.carried.banana;
      removeFromStack(state.carriedStack, 'banana', state.carried.banana);
      state.carried.banana = 0;
    }
    if (state.carried.meat > 0) {
      state.cookedMeat += state.carried.meat;
      removeFromStack(state.carriedStack, 'meat', state.carried.meat);
      state.carried.meat = 0;
    }
    awardXp(state, 18);
    return { triggered: true, label: 'آهنگری گدازه: نیزه آتشین فعال و غذاها کباب شدند!' };
  }
  if (landmarkId === 'mushroom') {
    state.energy = state.maxEnergy;
    for (const node of state.nodes) {
      if (node.cooldownRemaining > 0) {
        node.cooldownRemaining *= 0.25;
      }
    }
    awardXp(state, 14);
    return { triggered: true, label: 'معجون اسپور: انرژی کامل و رشد سریع گیاهان!' };
  }
  if (landmarkId === 'shipwreck') {
    state.coins += 8;
    state.stashed.wood += 3;
    state.stashed.shell += 2;
    awardXp(state, 14);
    return { triggered: true, label: 'گنج کاپیتان: +۸ سکه، ۳ چوب و ۲ صدف به کمپ رفت!' };
  }
  state.energy = state.maxEnergy;
  state.weather = 'clear';
  state.weatherTimer = CONFIG.WEATHER.MAX_DURATION_SEC;
  state.predatorAlert = false;
  awardXp(state, 14);
  return { triggered: true, label: 'چشمه بلورین: انرژی کامل و هوای صاف آفتابی!' };
}

export function activateLandmarkSpecial(
  state: SurvivalState,
  landmarkId: StrangeLandmarkId
): { triggered: boolean; label: string } {
  if (state.landmarkSpecialCooldowns[landmarkId] > 0) {
    return { triggered: false, label: '' };
  }

  if (landmarkId === 'ruins') {
    if (!spendShells(state, 2)) {
      return { triggered: false, label: 'برای پیشکش آفتاب به ۲ صدف نیاز داری' };
    }
    state.landmarkSpecialCooldowns.ruins = CONFIG.SURVIVAL.LANDMARK_SPECIAL_COOLDOWN_SEC;
    state.coins += 10;
    state.energy = state.maxEnergy;
    awardXp(state, 18);
    return { triggered: true, label: 'پیشکش معبد آفتاب: +۱۰ سکه و انرژی کامل!' };
  }

  if (landmarkId === 'volcano') {
    if (!spendWood(state, 2)) {
      return { triggered: false, label: 'برای کوره مذاب به ۲ چوب نیاز داری' };
    }
    state.landmarkSpecialCooldowns.volcano = CONFIG.SURVIVAL.LANDMARK_SPECIAL_COOLDOWN_SEC;
    state.coins += 7;
    state.energy = Math.min(state.maxEnergy, state.energy + 20);
    awardXp(state, 12);
    return { triggered: true, label: 'کوره مذاب: طلا گداخته شد (+۷ سکه)!' };
  }

  if (landmarkId === 'mushroom') {
    state.landmarkSpecialCooldowns.mushroom = CONFIG.SURVIVAL.LANDMARK_SPECIAL_COOLDOWN_SEC;
    const freeSlots = Math.max(0, state.backpackCapacity - getBackpackUsed(state));
    const berryAdd = Math.min(2, freeSlots);
    if (berryAdd > 0) {
      state.carried.berries += berryAdd;
      for (let i = 0; i < berryAdd; i += 1) state.carriedStack.push('berries');
    }
    const bananaAdd = freeSlots - berryAdd > 0 ? 1 : 0;
    if (bananaAdd > 0) {
      state.carried.banana += 1;
      state.carriedStack.push('banana');
    }
    state.coins += 4;
    awardXp(state, 12);
    return {
      triggered: true,
      label:
        berryAdd > 0
          ? 'برداشت شهد اسپور: توت جادویی، موز و +۴ سکه!'
          : 'برکت اسپور: +۴ سکه و +۱۲ تجربه (کوله پر بود)',
    };
  }

  if (landmarkId === 'shipwreck') {
    if (state.carried.meat > 0) {
      state.carried.meat -= 1;
      removeFromStack(state.carriedStack, 'meat', 1);
    } else if (state.carried.fish > 0) {
      state.carried.fish -= 1;
      removeFromStack(state.carriedStack, 'fish', 1);
    } else {
      return { triggered: false, label: 'برای معامله در کشتی، ۱ گوشت یا ماهی خام بیاور' };
    }
    state.landmarkSpecialCooldowns.shipwreck = CONFIG.SURVIVAL.LANDMARK_SPECIAL_COOLDOWN_SEC;
    state.coins += 9;
    awardXp(state, 15);
    return { triggered: true, label: 'تجارت ملوانان: +۹ سکه و روشن‌شدن فانوس دریایی!' };
  }

  state.landmarkSpecialCooldowns.spring = CONFIG.SURVIVAL.LANDMARK_SPECIAL_COOLDOWN_SEC;
  state.stashed.shell += 2;
  state.coins += 5;
  awardXp(state, 14);
  return { triggered: true, label: 'آرزوی چشمه بلورین: +۲ صدف درخشان و +۵ سکه!' };
}

export function eatBestFoodFromInventory(
  state: SurvivalState
): {
  ate: boolean;
  kind: 'cookedMeat' | 'roastedBanana' | 'cookedFish' | 'banana' | 'berries' | null;
  restored: number;
} {
  if (state.energy >= state.maxEnergy) {
    return { ate: false, kind: null, restored: 0 };
  }
  if (state.cookedMeat > 0) {
    const before = state.energy;
    state.cookedMeat -= 1;
    state.energy = Math.min(
      state.maxEnergy,
      state.energy + CONFIG.SURVIVAL.COOKED_MEAT_ENERGY_RESTORE
    );
    state.lowEnergyBlocked = false;
    return { ate: true, kind: 'cookedMeat', restored: state.energy - before };
  }
  if (state.roastedBanana > 0) {
    const before = state.energy;
    state.roastedBanana -= 1;
    state.energy = Math.min(
      state.maxEnergy,
      state.energy + CONFIG.SURVIVAL.ROASTED_BANANA_ENERGY_RESTORE
    );
    state.lowEnergyBlocked = false;
    return { ate: true, kind: 'roastedBanana', restored: state.energy - before };
  }
  if (state.cookedFish > 0) {
    const before = state.energy;
    state.cookedFish -= 1;
    state.energy = Math.min(
      state.maxEnergy,
      state.energy + CONFIG.SURVIVAL.COOKED_FISH_ENERGY_RESTORE
    );
    state.lowEnergyBlocked = false;
    return { ate: true, kind: 'cookedFish', restored: state.energy - before };
  }
  if (state.carried.banana > 0) {
    const before = state.energy;
    state.carried.banana -= 1;
    removeFromStack(state.carriedStack, 'banana', 1);
    state.energy = Math.min(
      state.maxEnergy,
      state.energy + CONFIG.SURVIVAL.BANANA_ENERGY_RESTORE
    );
    state.lowEnergyBlocked = false;
    return { ate: true, kind: 'banana', restored: state.energy - before };
  }
  if (state.carried.berries > 0) {
    const before = state.energy;
    state.carried.berries -= 1;
    removeFromStack(state.carriedStack, 'berries', 1);
    state.energy = Math.min(
      state.maxEnergy,
      state.energy + CONFIG.SURVIVAL.BERRY_ENERGY_RESTORE
    );
    state.lowEnergyBlocked = false;
    return { ate: true, kind: 'berries', restored: state.energy - before };
  }
  return { ate: false, kind: null, restored: 0 };
}

export function getSurvivalHudView(state: SurvivalState, biome: BiomeId): SurvivalHudView {
  const roundedEnergy = Math.max(0, Math.min(state.maxEnergy, Math.round(state.energy)));
  const bestFoodKind: SurvivalHudView['bestFoodKind'] =
    state.energy < state.maxEnergy
      ? state.cookedMeat > 0
        ? 'cookedMeat'
        : state.roastedBanana > 0
          ? 'roastedBanana'
          : state.cookedFish > 0
            ? 'cookedFish'
            : state.carried.banana > 0
              ? 'banana'
              : state.carried.berries > 0
                ? 'berries'
                : null
      : null;

  const totalWood = state.stashed.wood + state.carried.wood;

  const weaponXpToNext: Record<WeaponId, number> = {
    axe: getWeaponXpThreshold(Math.min(CONFIG.SURVIVAL.MAX_WEAPON_LEVEL, state.weaponLevels.axe)),
    spear: getWeaponXpThreshold(Math.min(CONFIG.SURVIVAL.MAX_WEAPON_LEVEL, state.weaponLevels.spear)),
    bow: getWeaponXpThreshold(Math.min(CONFIG.SURVIVAL.MAX_WEAPON_LEVEL, state.weaponLevels.bow)),
    hammer: getWeaponXpThreshold(Math.min(CONFIG.SURVIVAL.MAX_WEAPON_LEVEL, state.weaponLevels.hammer)),
  };

  return {
    coins: state.coins,
    wood: totalWood,
    fish: state.carried.fish,
    cookedFish: state.cookedFish,
    banana: state.carried.banana,
    roastedBanana: state.roastedBanana,
    meat: state.carried.meat,
    cookedMeat: state.cookedMeat,
    huntedCount: state.huntedCount,
    berries: state.carried.berries,
    shells: state.carried.shell + state.stashed.shell,
    energy: roundedEnergy,
    maxEnergy: state.maxEnergy,
    backpackUsed: getBackpackUsed(state),
    backpackCapacity: state.backpackCapacity,
    biome,
    timeOfDay: state.timeOfDay,
    dayCount: state.dayCount,
    phase: state.phase,
    isNight: state.isNight,
    weather: state.weather,
    groundWetness: state.groundWetness,
    season: state.season,
    seasonMix: state.seasonMix,
    isSwimming: state.isSwimming,
    activeEvent: state.activeEvent,
    eventPhase: state.eventPhase,
    eventTimer: Math.ceil(state.eventTimer),
    hasSpear: state.hasSpear,
    hasFireSpear: state.hasFireSpear,
    canCraftSpear: !state.hasSpear && totalWood >= CONFIG.SURVIVAL.SPEAR_CRAFT_WOOD_COST,
    equippedWeapon: state.equippedWeapon,
    unlockedWeapons: { ...state.unlockedWeapons },
    weaponLevels: { ...state.weaponLevels },
    weaponXp: { ...state.weaponXp },
    weaponXpToNext,
    fireLevel: state.fireLevel,
    canStokeFire:
      state.nearCampfire &&
      state.fireLevel < CONFIG.SURVIVAL.MAX_FIRE_LEVEL &&
      totalWood >= CONFIG.SURVIVAL.FIRE_FUEL_WOOD_COST,
    xp: state.xp,
    playerLevel: state.playerLevel,
    playerXp: state.playerXp,
    playerXpToNext: state.playerXpToNext,
    skillPoints: state.skillPoints,
    skills: { ...state.skills },
    discoveredAnimals: [...state.wildlife.discoveredSpecies],
    secretsFound: state.discoveredSecrets.length,
    secretsTotal: Math.max(CONFIG.SURVIVAL.SECRETS_COUNT, state.secretSpots.length),
    canVictoryVoyage:
      state.buildings.boat &&
      state.playerLevel >= CONFIG.SURVIVAL.VICTORY_MIN_LEVEL &&
      state.gameOutcome === 'playing',
    gameOutcome: state.gameOutcome,
    nearCampfire: state.nearCampfire,
    backpackFullBlocked: state.backpackFullBlocked,
    lowEnergyBlocked: state.lowEnergyBlocked,
    needSpearBlocked: state.needSpearBlocked,
    needSpearHuntBlocked: state.needSpearHuntBlocked,
    predatorAlert: state.predatorAlert,
    canEatFood: bestFoodKind !== null,
    bestFoodKind,
    activeAction: state.activeAction,
    focusedTarget: state.focusedTarget ? { ...state.focusedTarget } : null,
    buildings: { ...state.buildings },
    nearbyPad: state.nearbyPad ? { ...state.nearbyPad } : null,
    nearbyLandmark: state.nearbyLandmark ? { ...state.nearbyLandmark } : null,
  };
}

const PAD_NAMES_FA: Record<CampUpgradeId, string> = {
  shelter: 'پناهگاه چوبی',
  rack: 'ارتقای کوله',
  pier: 'اسکله ماهیگیری',
  boat: 'قایق چوبی کمپ',
};

export function stepSurvivalSystem(
  state: SurvivalState,
  playerX: number,
  playerZ: number,
  moved: boolean,
  dt: number,
  world?: IslandWorldData,
  interactPressed = false,
  isSwimming = false,
  randomFn: () => number = Math.random
): SurvivalStepResult {
  const emptyResult = (): SurvivalStepResult => ({
    hudChanged: false,
    weaponLevelUps: [],
    hazardStrikes: [],
    predatorStrikes: [],
    damageTaken: 0,
    cookedCount: 0,
    roastedBananaCount: 0,
    cookedMeatCount: 0,
    depositedToCamp: 0,
    earnedCoins: 0,
    discoveredSpecies: [],
  });

  if (dt <= 0 || state.gameOutcome !== 'playing') {
    return emptyResult();
  }

  state.isSwimming = isSwimming;

  const triggerInteract = interactPressed || state.interactTriggerQueued;
  state.interactTriggerQueued = false;
  const targetRequest = state.queuedTargetInteract;
  state.queuedTargetInteract = null;
  const rangedShot = state.rangedShotTarget;
  state.rangedShotTarget = null;

  const prevRoundedEnergy = Math.round(state.energy);
  const prevNearCamp = state.nearCampfire;
  const prevFullBlocked = state.backpackFullBlocked;
  const prevLowBlocked = state.lowEnergyBlocked;
  const prevNeedSpear = state.needSpearBlocked;
  const prevNeedSpearHunt = state.needSpearHuntBlocked;
  const prevPredatorAlert = state.predatorAlert;
  const prevAction = state.activeAction;
  const prevNearbyPadId = state.nearbyPad?.id ?? null;
  const prevNearbyLandmarkId = state.nearbyLandmark?.id ?? null;
  const prevFocusedId = state.focusedTarget?.id ?? null;
  const prevFocusedReason = state.focusedTarget?.blockedReason ?? null;
  const prevPhase = state.phase;
  const prevWeather = state.weather;
  const prevEvent = state.activeEvent;
  const prevEventPhase = state.eventPhase;
  const prevSeason = state.season;
  const prevSwimming = state.isSwimming;
  const prevOutcome = state.gameOutcome;
  const prevPlayerLevel = state.playerLevel;
  const prevSecretsFound = state.discoveredSecrets.length;

  const weaponLevelUps: WeaponLevelUpEvent[] = [];
  let playerLevelUp: number | undefined;
  const pushXp = (base: number) => {
    const lvl = awardXp(state, base);
    if (lvl !== undefined) playerLevelUp = lvl;
  };
  const pushWeaponXp = (wId: WeaponId, amt: number) => {
    const up = awardWeaponXp(state, wId, amt);
    if (up) weaponLevelUps.push(up);
  };

  if (state.fireStokeAnimTimer > 0) {
    state.fireStokeAnimTimer = Math.max(0, state.fireStokeAnimTimer - dt);
  }
  if (state.hammerSlamCooldown > 0) {
    state.hammerSlamCooldown = Math.max(0, state.hammerSlamCooldown - dt);
  }
  if (state.boatVoyageCooldown > 0) {
    state.boatVoyageCooldown = Math.max(0, state.boatVoyageCooldown - dt);
  }
  if (state.autoFishCooldown > 0) {
    state.autoFishCooldown = Math.max(0, state.autoFishCooldown - dt);
  }
  if (state.tsunamiDamageTimer > 0) {
    state.tsunamiDamageTimer = Math.max(0, state.tsunamiDamageTimer - dt);
  }

  // 0A. Advance Day / Night Cycle
  const prevT = state.timeOfDay;
  state.timeOfDay = (state.timeOfDay + dt / CONFIG.DAY_NIGHT.CYCLE_DURATION_SEC) % 1;
  if (state.timeOfDay < prevT) {
    state.dayCount += 1;
  }
  state.phase = getDayPhase(state.timeOfDay);
  state.isNight = state.phase === 'night';

  // 0B. Advance Random Weather Transitions (Clear / Rain / Storm / Fog) + Ground Wetness
  state.weatherTimer -= dt;
  if (state.weatherTimer <= 0) {
    state.weatherTick += 1;
    const roll =
      Math.abs(Math.sin(state.weatherTick * 12.9898 + state.dayCount * 4.14) * 43758.5453) % 1;
    const nextWeather: WeatherKind =
      roll < 0.42 ? 'clear' : roll < 0.68 ? 'rain' : roll < 0.84 ? 'storm' : 'fog';
    state.weather = nextWeather;
    state.weatherTimer =
      CONFIG.WEATHER.MIN_DURATION_SEC +
      ((roll * 7.3) % 1) * (CONFIG.WEATHER.MAX_DURATION_SEC - CONFIG.WEATHER.MIN_DURATION_SEC);
  }

  if (state.weather === 'rain' || state.weather === 'storm') {
    const wetRate = state.weather === 'storm' ? 0.36 : 0.22;
    state.groundWetness = Math.min(1, state.groundWetness + dt * wetRate);
  } else {
    state.groundWetness = Math.max(0, state.groundWetness - dt * 0.08);
  }

  // 0C. Surprise World Events Scheduler & Lifecycle
  let eventStarted: SurvivalStepResult['eventStarted'];
  let eventEndedNotice: string | undefined;

  if (state.activeEvent !== 'none') {
    state.eventTimer -= dt;
    if (state.eventPhase === 'warning' && state.eventTimer <= 0) {
      state.eventPhase = 'active';
      state.eventTimer = getWorldEventActiveDuration(state.activeEvent);
      applyWorldEventActiveEffects(state, state.activeEvent);
      eventStarted = {
        kind: state.activeEvent,
        phase: 'active',
        notice: getWorldEventNoticeText(state.activeEvent, 'active'),
      };
    } else if (state.eventPhase === 'active' && state.eventTimer <= 0) {
      const ended = state.activeEvent;
      state.activeEvent = 'none';
      state.eventPhase = 'idle';
      state.eventTimer = 0;
      const evCfg = CONFIG.SURVIVAL.WORLD_EVENTS;
      state.eventTick += 1;
      const intervalRoll = Math.abs(Math.sin(state.eventTick * 9.71) * 43758.5) % 1;
      state.nextEventTimer =
        evCfg.MIN_INTERVAL_SEC +
        intervalRoll * (evCfg.MAX_INTERVAL_SEC - evCfg.MIN_INTERVAL_SEC);

      if (ended === 'tsunami') {
        state.stashed.wood += 3;
        state.stashed.shell += 2;
        eventEndedNotice = 'آب سونامی فروکش کرد! موج‌ها ۳ چوب و ۲ صدف به ساحل آوردند';
      } else if (ended === 'low_tide') {
        eventEndedNotice = 'مد دریا بازگشت و سطح آب عادی شد';
      } else if (ended === 'volcano_eruption') {
        eventEndedNotice = 'فوران آتشفشان آرام گرفت';
      } else if (ended === 'meteor_shower') {
        eventEndedNotice = 'بارش شهاب‌سنگ پایان یافت';
      } else if (ended === 'fish_frenzy') {
        eventEndedNotice = 'موج رونق ماهی‌گیری پایان یافت';
      } else if (ended === 'autumn_breeze') {
        eventEndedNotice = 'نسیم پاییزی فرونشست و تابستان جزیره بازگشت';
      } else if (ended === 'winter_frost') {
        eventEndedNotice = 'برف زمستانی آب شد و گرمای آفتاب بازگشت';
      }
    }
  } else {
    state.nextEventTimer -= dt;
    if (state.nextEventTimer <= 0) {
      state.eventTick += 1;
      const evRoll =
        Math.abs(Math.sin(state.eventTick * 17.31 + state.dayCount * 3.17) * 43758.5453) % 1;
      let chosen: Exclude<WorldEventKind, 'none'>;
      if (evRoll < 0.16) chosen = 'low_tide';
      else if (evRoll < 0.34) chosen = 'tsunami';
      else if (evRoll < 0.52) chosen = 'volcano_eruption';
      else if (evRoll < 0.68) chosen = 'meteor_shower';
      else if (evRoll < 0.82) chosen = 'fish_frenzy';
      else if (evRoll < 0.91) chosen = 'autumn_breeze';
      else chosen = 'winter_frost';
      eventStarted = triggerWorldEvent(state, chosen, false);
    }
  }

  // Smoothly interpolate rare seasonal visual state
  const targetSeason: SeasonKind =
    state.activeEvent === 'autumn_breeze'
      ? 'autumn'
      : state.activeEvent === 'winter_frost'
        ? 'winter'
        : 'summer';
  if (targetSeason !== 'summer') {
    state.season = targetSeason;
    state.seasonMix = Math.min(1, state.seasonMix + dt * 0.65);
  } else {
    state.seasonMix = Math.max(0, state.seasonMix - dt * 0.55);
    if (state.seasonMix <= 0.04) {
      state.season = 'summer';
    }
  }

  // Smoothly interpolate ocean level offset for Low Tide and Tsunami
  const targetSeaOffset =
    state.eventPhase === 'active' && state.activeEvent === 'low_tide'
      ? CONFIG.SURVIVAL.WORLD_EVENTS.LOW_TIDE_OFFSET
      : state.eventPhase === 'active' && state.activeEvent === 'tsunami'
        ? CONFIG.SURVIVAL.WORLD_EVENTS.TSUNAMI_OFFSET
        : 0;
  state.seaLevelOffset += (targetSeaOffset - state.seaLevelOffset) * Math.min(1, dt * 1.45);

  // 0D. Localized Disaster Hazards Around Player (Storm Lightning, Volcano Lava Boulders, Meteor Shower)
  const hazardStrikes: SurvivalStepResult['hazardStrikes'] = [];
  let damageTaken = 0;

  const activeHazardKind: HazardImpact['kind'] | null =
    state.eventPhase === 'active' && state.activeEvent === 'volcano_eruption'
      ? 'lava'
      : state.eventPhase === 'active' && state.activeEvent === 'meteor_shower'
        ? 'meteor'
        : state.weather === 'storm'
          ? 'lightning'
          : null;

  if (activeHazardKind && state.gameOutcome === 'playing') {
    state.hazardSpawnTimer -= dt;
    if (state.hazardSpawnTimer <= 0 && state.hazardImpacts.length < 4) {
      state.hazardSpawnTimer = activeHazardKind === 'lightning' ? 2.8 : 2.25;
      const ang = randomFn() * Math.PI * 2;
      const dist = 0.8 + randomFn() * 4.4;
      const hx = playerX + Math.cos(ang) * dist;
      const hz = playerZ + Math.sin(ang) * dist;
      const delay = activeHazardKind === 'lava' ? 1.15 : 1.05;
      state.hazardImpacts.push({
        id: `hz-${Date.now()}-${Math.floor(randomFn() * 10000)}`,
        kind: activeHazardKind,
        x: hx,
        z: hz,
        radius: activeHazardKind === 'lava' ? 2.4 : 2.25,
        delayTimer: delay,
        maxDelay: delay,
        resolved: false,
        resolveTimer: 0.48,
      });
    }
  }

  for (let i = state.hazardImpacts.length - 1; i >= 0; i -= 1) {
    const h = state.hazardImpacts[i];
    if (!h.resolved) {
      h.delayTimer -= dt;
      if (h.delayTimer <= 0) {
        h.resolved = true;
        const distPlayer = Math.hypot(playerX - h.x, playerZ - h.z);
        const hitPlayer = distPlayer <= h.radius;
        const dmg = hitPlayer
          ? h.kind === 'lava'
            ? 15
            : h.kind === 'lightning'
              ? 14
              : 12
          : 0;
        if (hitPlayer) {
          state.energy = Math.max(0, state.energy - dmg);
          damageTaken += dmg;
        } else {
          // Reward dodging natural disaster strike!
          state.coins += 1;
          pushXp(3);
        }
        hazardStrikes.push({
          id: h.id,
          kind: h.kind,
          x: h.x,
          z: h.z,
          hitPlayer,
          damage: dmg,
        });
      }
    } else {
      h.resolveTimer -= dt;
      if (h.resolveTimer <= 0) {
        state.hazardImpacts.splice(i, 1);
      }
    }
  }

  // Tsunami surge drains energy if player stays caught in deep floodwater
  if (
    state.eventPhase === 'active' &&
    state.activeEvent === 'tsunami' &&
    isSwimming &&
    state.tsunamiDamageTimer <= 0
  ) {
    state.tsunamiDamageTimer = 1.25;
    state.energy = Math.max(0, state.energy - 6);
    damageTaken += 6;
  }

  // 1. Tick regrow cooldowns (Rain/Storm/Autumn accelerates flora growth!)
  const seasonFloraMult = state.season === 'autumn' ? 1.25 : 1.0;
  const floraRegrowRate =
    (state.weather === 'storm'
      ? CONFIG.WEATHER.STORM_REGROW_MULT
      : state.weather === 'rain'
        ? CONFIG.WEATHER.RAIN_REGROW_MULT
        : 1.0) * seasonFloraMult;
  for (const node of state.nodes) {
    if (node.cooldownRemaining > 0) {
      const rate =
        node.kind === 'wood' || node.kind === 'berries' || node.kind === 'banana'
          ? floraRegrowRate
          : 1.0;
      node.cooldownRemaining = Math.max(0, node.cooldownRemaining - dt * rate);
    }
  }
  for (const key of Object.keys(state.landmarkCooldowns) as StrangeLandmarkId[]) {
    if (state.landmarkCooldowns[key] > 0) {
      state.landmarkCooldowns[key] = Math.max(0, state.landmarkCooldowns[key] - dt);
    }
    if (state.landmarkSpecialCooldowns[key] > 0) {
      state.landmarkSpecialCooldowns[key] = Math.max(0, state.landmarkSpecialCooldowns[key] - dt);
    }
  }

  // 2. Campfire warmth aura, wood/shell banking, fish/meat/banana roasting
  const camp = CONFIG.ISLAND.CAMPFIRE;
  const auraRadius = camp.AURA_RADIUS + (state.fireLevel - 1) * 1.1;
  const distCamp = Math.hypot(playerX - camp.CX, playerZ - camp.CZ);
  state.nearCampfire = distCamp <= auraRadius;

  let depositedToCamp = 0;
  let earnedCoins = 0;
  let cookedCount = 0;
  let roastedBananaCount = 0;
  let cookedMeatCount = 0;

  if (state.nearCampfire) {
    if (state.energy < state.maxEnergy) {
      const shelterMult = state.buildings.shelter ? 1.35 : 1.0;
      const fireMult =
        state.fireLevel >= 5
          ? 2.2
          : 1 + (state.fireLevel - 1) * 0.25 + state.skills.pyromancer * 0.15;
      state.energy = Math.min(
        state.maxEnergy,
        state.energy + CONFIG.SURVIVAL.CAMPFIRE_ENERGY_REGEN_PER_SEC * shelterMult * fireMult * dt
      );
      if (state.energy >= 12) {
        state.lowEnergyBlocked = false;
      }
    }

    const depositWood = state.carried.wood;
    const depositShell = state.carried.shell;
    const depositAmount = depositWood + depositShell;
    if (depositAmount > 0) {
      state.stashed.wood += depositWood;
      state.stashed.shell += depositShell;
      state.carried.wood = 0;
      state.carried.shell = 0;
      removeFromStack(state.carriedStack, 'wood', depositWood);
      removeFromStack(state.carriedStack, 'shell', depositShell);
      depositedToCamp = depositAmount;

      const prevBonusCount = Math.floor(state.stashedTotalForCoin / 2);
      state.stashedTotalForCoin += depositAmount;
      const newBonusCount = Math.floor(state.stashedTotalForCoin / 2);
      const depositCoins = Math.max(0, newBonusCount - prevBonusCount);
      earnedCoins += depositCoins;
      state.coins += depositCoins;
    }

    const canRoastBanana = state.fireLevel >= 2 && state.carried.banana > 0;
    if (state.carried.fish > 0 || state.carried.meat > 0 || canRoastBanana) {
      state.cookProgress += dt / Math.max(0.1, CONFIG.SURVIVAL.COOK_DURATION_SEC);
      if (state.cookProgress >= 1) {
        state.cookProgress -= 1;
        if (state.carried.fish > 0) {
          state.carried.fish -= 1;
          removeFromStack(state.carriedStack, 'fish', 1);
          state.cookedFish += 1;
          cookedCount += 1;
          earnedCoins += 1;
          state.coins += 1;
          pushXp(5);
        } else if (state.carried.meat > 0) {
          state.carried.meat -= 1;
          removeFromStack(state.carriedStack, 'meat', 1);
          state.cookedMeat += 1;
          cookedMeatCount += 1;
          earnedCoins += 2;
          state.coins += 2;
          pushXp(6);
        } else if (canRoastBanana) {
          state.carried.banana -= 1;
          removeFromStack(state.carriedStack, 'banana', 1);
          state.roastedBanana += 1;
          roastedBananaCount += 1;
          earnedCoins += 1;
          state.coins += 1;
          pushXp(5);
        }
      }
    } else {
      state.cookProgress = 0;
    }
  } else {
    state.cookProgress = 0;
    if (moved && state.energy > 1) {
      const drainRate = isSwimming
        ? CONFIG.SURVIVAL.SWIM_ENERGY_DRAIN_PER_SEC
        : CONFIG.SURVIVAL.WALK_ENERGY_DRAIN_PER_SEC;
      state.energy = Math.max(1, state.energy - drainRate * dt);
    }
  }

  // 2B. Step 32-species Wildlife AI & Predator Windup/Strike Attacks
  let discoveredSpecies: string[] = [];
  let predatorStrikes: PredatorStrikeEvent[] = [];
  if (world) {
    const wRes = stepWildlifeSystem(
      state.wildlife,
      dt,
      state.isNight,
      playerX,
      playerZ,
      state.nearCampfire,
      state.fireLevel,
      state.hasFireSpear,
      world,
      state.activeHuntActorId
    );
    discoveredSpecies = wRes.discoveredNew;
    state.predatorAlert = wRes.predatorNearby;
    predatorStrikes = wRes.predatorStrikes;
    if (wRes.ambushEnergyLoss > 0) {
      state.energy = Math.max(0, state.energy - wRes.ambushEnergyLoss);
      damageTaken += wRes.ambushEnergyLoss;
    }
    if (discoveredSpecies.length > 0) {
      pushXp(discoveredSpecies.length * 4);
    }
  }

  // 2C. Strange Landmark Proximity Check
  let closestLandmark: LandmarkActionSite | null = null;
  let closestLandmarkDist = Infinity;
  for (const lm of state.landmarkSites) {
    const d = Math.hypot(playerX - lm.x, playerZ - lm.z);
    if (d <= CONFIG.SURVIVAL.HARVEST_RANGE_LANDMARK && d < closestLandmarkDist) {
      closestLandmarkDist = d;
      closestLandmark = lm;
    }
  }
  state.nearbyLandmark = closestLandmark
    ? {
        id: closestLandmark.id,
        cooldown: Math.ceil(state.landmarkCooldowns[closestLandmark.id]),
        specialCooldown: Math.ceil(state.landmarkSpecialCooldowns[closestLandmark.id]),
      }
    : null;

  // 3. Scan nearby targets for Focused Target (NO silent auto-chopping or auto-building!)
  const totalWood = state.stashed.wood + state.carried.wood;
  const backpackUsed = getBackpackUsed(state);
  const freeSlots = Math.max(0, state.backpackCapacity - backpackUsed);
  const backpackHasRoom = freeSlots > 0;

  let closestPad: BuildPadSite | null = null;
  let closestPadDist = Infinity;
  let builtBoatPad: BuildPadSite | null = null;
  for (const pad of state.buildPads) {
    const d = Math.hypot(playerX - pad.x, playerZ - pad.z);
    if (pad.id === 'boat' && state.buildings.boat && d <= CONFIG.SURVIVAL.HARVEST_RANGE_BUILD + 0.4) {
      builtBoatPad = pad;
    }
    if (state.buildings[pad.id]) continue;
    if (d <= CONFIG.SURVIVAL.HARVEST_RANGE_BUILD && d < closestPadDist) {
      closestPadDist = d;
      closestPad = pad;
    }
  }

  state.nearbyPad = closestPad
    ? { id: closestPad.id, cost: CONFIG.SURVIVAL.BUILD_COSTS[closestPad.id], totalWood }
    : null;

  let bestNode: HarvestNodeState | null = null;
  let bestNodeDist = Infinity;
  for (const node of state.nodes) {
    if (node.cooldownRemaining > 0) continue;
    const d = Math.hypot(playerX - node.x, playerZ - node.z);
    if (d <= node.range && d < bestNodeDist) {
      bestNodeDist = d;
      bestNode = node;
    }
  }

  let bestPrey: AnimalActorState | null = null;
  let bestPreyDist = Infinity;
  const bowEquipped = state.equippedWeapon === 'bow' && state.unlockedWeapons.bow;
  const huntRange = bowEquipped
    ? CONFIG.SURVIVAL.HARVEST_RANGE_BOW
    : state.hasSpear
      ? CONFIG.SURVIVAL.HARVEST_RANGE_HUNT
      : CONFIG.SURVIVAL.HARVEST_RANGE_HUNT * 0.84;
  for (const actor of state.wildlife.actors) {
    if (!actor.visible || actor.koTimer > 0 || actor.respawnTimer > 0) continue;
    const spec = getAnimalSpecies(actor.speciesId);
    if (!spec || !spec.huntable) continue;
    const d = Math.hypot(playerX - actor.x, playerZ - actor.z);
    if (d <= huntRange && d < bestPreyDist) {
      bestPreyDist = d;
      bestPrey = actor;
    }
  }

  // Check nearby unopened Secret Chest
  let bestSecret: SecretSpot | null = null;
  let bestSecretDist = Infinity;
  for (const sec of state.secretSpots) {
    if (state.discoveredSecrets.includes(sec.id)) continue;
    const d = Math.hypot(playerX - sec.x, playerZ - sec.z);
    if (d <= CONFIG.SURVIVAL.HARVEST_RANGE_SECRET && d < bestSecretDist) {
      bestSecretDist = d;
      bestSecret = sec;
    }
  }

  // Compute focused target (priority: Pad -> Secret -> Built Boat Voyage -> Prey in bow range -> Node -> Melee Prey)
  let focused: FocusedTargetInfo | null = null;
  if (closestPad) {
    const cost = CONFIG.SURVIVAL.BUILD_COSTS[closestPad.id];
    const boatNeedsFire = closestPad.id === 'boat' && state.fireLevel < 5;
    const blockedReason: BlockedReason | undefined = boatNeedsFire
      ? 'need_fire_level'
      : totalWood < cost
        ? 'need_wood'
        : undefined;
    focused = {
      kind: 'pad',
      id: closestPad.id,
      action: 'build',
      labelFa: boatNeedsFire
        ? 'قایق چوبی (نیاز به آتش سطح ۵)'
        : `ساخت ${PAD_NAMES_FA[closestPad.id]} (${cost} چوب)`,
      x: closestPad.x,
      y: closestPad.y,
      z: closestPad.z,
      blockedReason,
      woodCost: cost,
    };
  } else if (bestSecret) {
    focused = {
      kind: 'secret',
      id: bestSecret.id,
      action: 'secret_open',
      labelFa: `گشودن راز: ${bestSecret.nameFa}`,
      x: bestSecret.x,
      y: bestSecret.y,
      z: bestSecret.z,
    };
  } else if (builtBoatPad) {
    focused = {
      kind: 'boat_voyage',
      id: 'boat_voyage',
      action: 'voyage',
      labelFa:
        state.boatVoyageCooldown > 0
          ? `آماده‌سازی سفر دریایی (${Math.ceil(state.boatVoyageCooldown)} ث)`
          : 'سفر دریایی با قایق (+سکه و ماهی)',
      x: builtBoatPad.x,
      y: builtBoatPad.y,
      z: builtBoatPad.z,
      blockedReason: state.boatVoyageCooldown > 0 ? 'cooldown' : undefined,
    };
  } else if (bowEquipped && bestPrey) {
    const spec = getAnimalSpecies(bestPrey.speciesId);
    focused = {
      kind: 'prey',
      id: bestPrey.id,
      action: 'bow_hunt',
      labelFa: `شکار با کمان: ${spec?.nameFa ?? 'جانور'}`,
      x: bestPrey.x,
      y: bestPrey.y,
      z: bestPrey.z,
      blockedReason: !backpackHasRoom
        ? 'backpack_full'
        : state.energy < CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT
          ? 'low_energy'
          : undefined,
    };
  } else if (bestNode) {
    const fishingAction: SurvivalActionKind =
      state.equippedWeapon === 'spear' && state.hasSpear ? 'spear_fish' : 'cast_fish';
    const action: SurvivalActionKind =
      bestNode.kind === 'wood'
        ? 'chop'
        : bestNode.kind === 'banana'
          ? 'climb'
          : bestNode.kind === 'fish'
            ? fishingAction
            : 'forage';
    const labelFa =
      bestNode.kind === 'wood'
        ? 'قطع درخت با تبر'
        : bestNode.kind === 'banana'
          ? 'بالا رفتن و چیدن موز'
          : bestNode.kind === 'fish'
            ? action === 'spear_fish'
              ? 'صید ماهی با نیزه'
              : 'ماهی‌گیری با قلاب'
            : bestNode.kind === 'shell'
              ? 'جمع‌آوری صدف ساحلی'
              : 'چیدن توت جنگلی';
    focused = {
      kind: 'node',
      id: bestNode.id,
      action,
      labelFa,
      x: bestNode.x,
      y: bestNode.y,
      z: bestNode.z,
      blockedReason: !backpackHasRoom
        ? 'backpack_full'
        : state.energy < bestNode.energyCost
          ? 'low_energy'
          : undefined,
    };
  } else if (bestPrey) {
    const spec = getAnimalSpecies(bestPrey.speciesId);
    const needsSpear = Boolean(spec?.requiresSpear && !state.hasSpear);
    focused = {
      kind: 'prey',
      id: bestPrey.id,
      action: 'hunt',
      labelFa: `شکار ${spec?.nameFa ?? 'جانور'}`,
      x: bestPrey.x,
      y: bestPrey.y,
      z: bestPrey.z,
      blockedReason: !backpackHasRoom
        ? 'backpack_full'
        : needsSpear
          ? 'need_spear'
          : state.energy < CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT
            ? 'low_energy'
            : undefined,
    };
  }

  // Override focused target if the player explicitly clicked a specific 3D object in range!
  if (targetRequest) {
    if (targetRequest.kind === 'node') {
      const n = state.nodes.find((item) => item.id === targetRequest.id && item.cooldownRemaining <= 0);
      if (n && Math.hypot(playerX - n.x, playerZ - n.z) <= n.range + 0.55) {
        const fishingAction: SurvivalActionKind =
          state.equippedWeapon === 'spear' && state.hasSpear ? 'spear_fish' : 'cast_fish';
        focused = {
          kind: 'node',
          id: n.id,
          action:
            n.kind === 'wood'
              ? 'chop'
              : n.kind === 'banana'
                ? 'climb'
                : n.kind === 'fish'
                  ? fishingAction
                  : 'forage',
          labelFa: n.kind === 'wood' ? 'قطع درخت با تبر' : 'جمع‌آوری منبع',
          x: n.x,
          y: n.y,
          z: n.z,
          blockedReason: !backpackHasRoom
            ? 'backpack_full'
            : state.energy < n.energyCost
              ? 'low_energy'
              : undefined,
        };
      }
    } else if (targetRequest.kind === 'prey') {
      const a = state.wildlife.actors.find(
        (act) => act.id === targetRequest.id && act.visible && act.koTimer <= 0 && act.respawnTimer <= 0
      );
      const spec = a ? getAnimalSpecies(a.speciesId) : undefined;
      if (a && spec && spec.huntable && Math.hypot(playerX - a.x, playerZ - a.z) <= huntRange + 0.8) {
        const needsSpear = Boolean(!bowEquipped && spec.requiresSpear && !state.hasSpear);
        focused = {
          kind: 'prey',
          id: a.id,
          action: bowEquipped ? 'bow_hunt' : 'hunt',
          labelFa: `شکار ${spec.nameFa}`,
          x: a.x,
          y: a.y,
          z: a.z,
          blockedReason: !backpackHasRoom
            ? 'backpack_full'
            : needsSpear
              ? 'need_spear'
              : state.energy < CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT
                ? 'low_energy'
                : undefined,
        };
      }
    } else if (targetRequest.kind === 'pad') {
      const p = state.buildPads.find((pad) => pad.id === targetRequest.id && !state.buildings[pad.id]);
      if (p && Math.hypot(playerX - p.x, playerZ - p.z) <= CONFIG.SURVIVAL.HARVEST_RANGE_BUILD + 0.5) {
        const cost = CONFIG.SURVIVAL.BUILD_COSTS[p.id];
        const boatNeedsFire = p.id === 'boat' && state.fireLevel < 5;
        focused = {
          kind: 'pad',
          id: p.id,
          action: 'build',
          labelFa: `ساخت ${PAD_NAMES_FA[p.id]}`,
          x: p.x,
          y: p.y,
          z: p.z,
          blockedReason: boatNeedsFire ? 'need_fire_level' : totalWood < cost ? 'need_wood' : undefined,
          woodCost: cost,
        };
      }
    } else if (targetRequest.kind === 'secret') {
      const sec = state.secretSpots.find(
        (s) => s.id === targetRequest.id && !state.discoveredSecrets.includes(s.id)
      );
      if (sec && Math.hypot(playerX - sec.x, playerZ - sec.z) <= CONFIG.SURVIVAL.HARVEST_RANGE_SECRET + 0.5) {
        focused = {
          kind: 'secret',
          id: sec.id,
          action: 'secret_open',
          labelFa: `گشودن راز: ${sec.nameFa}`,
          x: sec.x,
          y: sec.y,
          z: sec.z,
        };
      }
    }
  }

  state.focusedTarget = focused;
  state.backpackFullBlocked = Boolean(focused && focused.blockedReason === 'backpack_full');
  state.needSpearBlocked = false;
  state.needSpearHuntBlocked = Boolean(focused && focused.blockedReason === 'need_spear');

  // 4. Weapon Special: Auto-Fishing near water + Hammer AoE Shockwave + Bow Ranged Shot + Intentional Target Interact
  let harvested: SurvivalStepResult['harvested'];
  let fishingMissed: SurvivalStepResult['fishingMissed'];
  let hunted: SurvivalStepResult['hunted'];
  let builtUpgrade: SurvivalStepResult['builtUpgrade'];
  let openedSecret: SurvivalStepResult['openedSecret'];
  let arrowShot: SurvivalStepResult['arrowShot'];
  let hammerSlam: SurvivalStepResult['hammerSlam'];
  let boatVoyageNotice: string | undefined;

  // 4A. Auto-equip rod/spear & fish automatically when standing idle right beside a ready fishing spot!
  const idleNearFish =
    !moved &&
    !state.activeNodeId &&
    !state.activeBuildId &&
    !state.activeHuntActorId &&
    bestNode?.propKind === 'fishing' &&
    bestNode.cooldownRemaining <= 0 &&
    backpackHasRoom &&
    state.energy >= bestNode.energyCost &&
    state.autoFishCooldown <= 0;
  if (idleNearFish && bestNode) {
    state.autoFishIdleTimer += dt;
    if (state.autoFishIdleTimer >= 0.35) {
      state.activeNodeId = bestNode.id;
      state.harvestProgress = 0;
      state.autoFishIdleTimer = 0;
    }
  } else {
    state.autoFishIdleTimer = 0;
  }

  // 4B. Direct Ranged Bow Shot or Storm Hammer Slam from click/tap anywhere
  if (rangedShot && bowEquipped) {
    const bowLvl = state.weaponLevels.bow;
    let targetActor = rangedShot.actorId
      ? state.wildlife.actors.find(
          (a) =>
            a.id === rangedShot.actorId &&
            a.visible &&
            a.koTimer <= 0 &&
            a.respawnTimer <= 0 &&
            Math.hypot(a.x - playerX, a.z - playerZ) <= CONFIG.SURVIVAL.HARVEST_RANGE_BOW + 1.5
        )
      : undefined;
    if (!targetActor) {
      let bestDist = 2.6;
      for (const a of state.wildlife.actors) {
        if (!a.visible || a.koTimer > 0 || a.respawnTimer > 0) continue;
        const spec = getAnimalSpecies(a.speciesId);
        if (!spec?.huntable) continue;
        const distFromClick = Math.hypot(a.x - rangedShot.x, a.z - rangedShot.z);
        const distFromPlayer = Math.hypot(a.x - playerX, a.z - playerZ);
        if (distFromPlayer <= CONFIG.SURVIVAL.HARVEST_RANGE_BOW + 1.5 && distFromClick < bestDist) {
          bestDist = distFromClick;
          targetActor = a;
        }
      }
    }
    arrowShot = {
      fromX: playerX,
      fromY: 1.15,
      fromZ: playerZ,
      toX: targetActor ? targetActor.x : rangedShot.x,
      toY: targetActor ? targetActor.y + 0.45 : 0.4,
      toZ: targetActor ? targetActor.z : rangedShot.z,
    };
    state.activeAction = 'bow_hunt';
    state.actionTargetX = arrowShot.toX;
    state.actionTargetZ = arrowShot.toZ;
    state.actionProgress = 1;
    pushWeaponXp('bow', targetActor ? 10 : 3);

    if (targetActor) {
      const preySpec = getAnimalSpecies(targetActor.speciesId);
      if (preySpec) {
        enrageAnimal(targetActor);
        const baseYield = (preySpec.meatYield ?? 1) + (bowLvl >= 3 ? 1 : 0);
        const amount = Math.min(baseYield, freeSlots);
        if (state.hasFireSpear || bowLvl >= 4) {
          state.cookedMeat += amount;
        } else {
          state.carried.meat += amount;
          for (let i = 0; i < amount; i += 1) state.carriedStack.push('meat');
        }
        state.huntedCount += 1;
        state.energy = Math.max(0, state.energy - CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT * 0.75);
        const bonusCoins =
          (targetActor.category === 'night_predator' ? 3 : 1) + (bowLvl >= 5 ? 2 : 0);
        state.coins += bonusCoins;
        earnedCoins += bonusCoins;
        pushXp(targetActor.category === 'night_predator' ? 14 : 9);
        markAnimalHunted(targetActor);
        hunted = {
          actorId: targetActor.id,
          speciesId: targetActor.speciesId,
          amount,
          x: targetActor.x,
          y: targetActor.y,
          z: targetActor.z,
          ranged: true,
        };
      }
    }
  } else if (triggerInteract || targetRequest) {
    // Hammer special: if Hammer is equipped and not interacting with a build pad/node/secret
    if (
      state.equippedWeapon === 'hammer' &&
      state.unlockedWeapons.hammer &&
      (!focused || focused.kind === 'prey') &&
      state.hammerSlamCooldown <= 0
    ) {
      const hammerLvl = state.weaponLevels.hammer;
      state.hammerSlamCooldown = Math.max(0.85, 1.6 - (hammerLvl - 1) * 0.14);
      const aoeRange = CONFIG.SURVIVAL.HAMMER_AOE_RANGE + (hammerLvl - 1) * 0.65;
      let stunnedCount = 0;
      for (const actor of state.wildlife.actors) {
        if (!actor.visible || actor.koTimer > 0 || actor.respawnTimer > 0) continue;
        const d = Math.hypot(actor.x - playerX, actor.z - playerZ);
        if (d <= aoeRange) {
          actor.stunTimer = CONFIG.SURVIVAL.HAMMER_STUN_SEC + (hammerLvl - 1) * 1.2;
          stunnedCount += 1;
          if (hammerLvl >= 3 && actor.category === 'night_predator') {
            // Lv 3 Storm Lightning Slam defeats stunned night predator!
            markAnimalHunted(actor);
            state.coins += 3 + (hammerLvl >= 5 ? 2 : 0);
            earnedCoins += 3 + (hammerLvl >= 5 ? 2 : 0);
            state.huntedCount += 1;
          } else if (actor.category === 'night_predator' && d > 0.05) {
            actor.x += ((actor.x - playerX) / d) * 1.35;
            actor.z += ((actor.z - playerZ) / d) * 1.35;
          }
        }
      }
      state.activeAction = 'hammer_slam';
      state.actionProgress = 1;
      pushXp(stunnedCount > 0 ? 10 : 3);
      pushWeaponXp('hammer', stunnedCount > 0 ? 12 : 5);
      hammerSlam = {
        x: playerX,
        y: 0,
        z: playerZ,
        stunnedCount,
        lightningStrike: hammerLvl >= 3,
      };
    } else if (focused && !focused.blockedReason) {
      if (focused.kind === 'pad') {
        state.activeBuildId = focused.id as CampUpgradeId;
        state.activeNodeId = null;
        state.activeHuntActorId = null;
        state.harvestProgress = 0;
        state.huntProgress = 0;
      } else if (focused.kind === 'secret') {
        const res = openSecretSpot(state, focused.id, playerX, playerZ);
        if (res.opened && res.secret) {
          earnedCoins += 15;
          openedSecret = {
            id: res.secret.id,
            nameFa: res.secret.nameFa,
            x: res.secret.x,
            y: res.secret.y,
            z: res.secret.z,
          };
          state.activeAction = 'secret_open';
          state.actionProgress = 1;
        }
      } else if (focused.kind === 'boat_voyage') {
        state.boatVoyageCooldown = 20;
        state.coins += 10;
        earnedCoins += 10;
        const bonusFish = Math.min(2, freeSlots);
        if (bonusFish > 0) {
          state.carried.fish += bonusFish;
          for (let i = 0; i < bonusFish; i += 1) state.carriedStack.push('fish');
        }
        state.stashed.shell += 2;
        pushXp(20);
        boatVoyageNotice = 'سفر دریایی با قایق: +۱۰ سکه، +۲ صدف و صید تازه!';
      } else if (focused.kind === 'node') {
        state.activeNodeId = focused.id;
        state.activeBuildId = null;
        state.activeHuntActorId = null;
        state.harvestProgress = 0;
        state.huntProgress = 0;
      } else if (focused.kind === 'prey') {
        const preyActor = state.wildlife.actors.find((a) => a.id === focused!.id);
        const preySpec = preyActor ? getAnimalSpecies(preyActor.speciesId) : undefined;
        if (bowEquipped && preyActor && preySpec) {
          const bowLvl = state.weaponLevels.bow;
          const baseYield = (preySpec.meatYield ?? 1) + (bowLvl >= 3 ? 1 : 0);
          const amount = Math.min(baseYield, freeSlots);
          if (state.hasFireSpear || bowLvl >= 4) {
            state.cookedMeat += amount;
          } else {
            state.carried.meat += amount;
            for (let i = 0; i < amount; i += 1) {
              state.carriedStack.push('meat');
            }
          }
          state.huntedCount += 1;
          state.energy = Math.max(0, state.energy - CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT * 0.8);
          const bonusCoins =
            (preyActor.category === 'night_predator' ? 3 : 1) + (bowLvl >= 5 ? 2 : 0);
          state.coins += bonusCoins;
          earnedCoins += bonusCoins;
          pushXp(preyActor.category === 'night_predator' ? 14 : 9);
          pushWeaponXp('bow', 11);
          markAnimalHunted(preyActor);
          arrowShot = {
            fromX: playerX,
            fromY: 1.15,
            fromZ: playerZ,
            toX: preyActor.x,
            toY: preyActor.y + 0.45,
            toZ: preyActor.z,
          };
          hunted = {
            actorId: preyActor.id,
            speciesId: preyActor.speciesId,
            amount,
            x: preyActor.x,
            y: preyActor.y,
            z: preyActor.z,
            ranged: true,
          };
          // Bow Lv 3+ double-arrow volley hits a second nearby huntable prey if within 4.5m!
          if (bowLvl >= 3) {
            const secondPrey = state.wildlife.actors.find(
              (a) =>
                a.id !== preyActor.id &&
                a.visible &&
                a.koTimer <= 0 &&
                a.respawnTimer <= 0 &&
                getAnimalSpecies(a.speciesId)?.huntable &&
                Math.hypot(a.x - preyActor.x, a.z - preyActor.z) <= 4.5
            );
            if (secondPrey) {
              markAnimalHunted(secondPrey);
              state.huntedCount += 1;
              state.coins += 2;
              earnedCoins += 2;
            }
          }
          state.activeAction = 'bow_hunt';
          state.actionTargetX = preyActor.x;
          state.actionTargetZ = preyActor.z;
          state.actionProgress = 1;
        } else {
          if (preyActor && (preyActor.speciesId === 'boar' || preyActor.speciesId === 'pirate_crab')) {
            enrageAnimal(preyActor);
          }
          state.activeHuntActorId = focused.id;
          state.activeBuildId = null;
          state.activeNodeId = null;
          state.huntProgress = 0;
          state.harvestProgress = 0;
        }
      }
    } else if (focused && focused.blockedReason === 'low_energy') {
      state.lowEnergyBlocked = true;
    }
  }

  // Cancel active tasks if player walked out of range or target disappeared or backpack filled
  if (state.activeBuildId) {
    const pad = state.buildPads.find((p) => p.id === state.activeBuildId);
    const cost = pad ? CONFIG.SURVIVAL.BUILD_COSTS[pad.id] : 999;
    const boatNeedsFire = pad?.id === 'boat' && state.fireLevel < 5;
    if (
      !pad ||
      state.buildings[pad.id] ||
      boatNeedsFire ||
      totalWood < cost ||
      Math.hypot(playerX - pad.x, playerZ - pad.z) > CONFIG.SURVIVAL.HARVEST_RANGE_BUILD + 0.45
    ) {
      state.activeBuildId = null;
      state.actionProgress = 0;
    }
  }

  if (state.activeNodeId) {
    const node = state.nodes.find((n) => n.id === state.activeNodeId);
    if (
      !node ||
      node.cooldownRemaining > 0 ||
      !backpackHasRoom ||
      state.energy < node.energyCost ||
      Math.hypot(playerX - node.x, playerZ - node.z) > node.range + 0.45
    ) {
      state.activeNodeId = null;
      state.harvestProgress = 0;
      state.actionProgress = 0;
    }
  }

  if (state.activeHuntActorId) {
    const prey = state.wildlife.actors.find((a) => a.id === state.activeHuntActorId);
    const spec = prey ? getAnimalSpecies(prey.speciesId) : undefined;
    if (
      !prey ||
      !prey.visible ||
      prey.koTimer > 0 ||
      prey.respawnTimer > 0 ||
      !spec ||
      !backpackHasRoom ||
      (spec.requiresSpear && !state.hasSpear) ||
      state.energy < CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT ||
      Math.hypot(playerX - prey.x, playerZ - prey.z) > huntRange + 0.9
    ) {
      state.activeHuntActorId = null;
      state.huntProgress = 0;
      state.actionProgress = 0;
    }
  }

  // 5. Advance Active Intentional Work (Build / Harvest / Melee Hunt / Cook)
  if (state.activeBuildId) {
    const pad = state.buildPads.find((p) => p.id === state.activeBuildId)!;
    const cost = CONFIG.SURVIVAL.BUILD_COSTS[pad.id];
    const hammerBonus =
      state.equippedWeapon === 'hammer' && state.unlockedWeapons.hammer
        ? 2.0 + (state.weaponLevels.hammer - 1) * 0.45
        : 1.0;
    state.activeAction = 'build';
    state.actionTargetX = pad.x;
    state.actionTargetZ = pad.z;
    state.buildProgress[pad.id] +=
      (dt * hammerBonus) / Math.max(0.1, CONFIG.SURVIVAL.BUILD_DURATION_SEC);
    state.actionProgress = Math.min(1, state.buildProgress[pad.id]);

    if (state.buildProgress[pad.id] >= 1) {
      spendWood(state, cost);
      state.buildings[pad.id] = true;
      state.buildProgress[pad.id] = 1;
      state.backpackCapacity = recomputeBackpackCapacity(state);
      const reward = pad.id === 'boat' ? 12 : 5;
      state.coins += reward;
      earnedCoins += reward;
      pushXp(pad.id === 'boat' ? 30 : 20);
      if (state.equippedWeapon === 'hammer' && state.unlockedWeapons.hammer) {
        pushWeaponXp('hammer', 12);
      }
      builtUpgrade = { id: pad.id, x: pad.x, y: pad.y, z: pad.z };
      state.activeBuildId = null;
      state.activeAction = 'idle';
      state.actionProgress = 0;
      state.nearbyPad = null;
    }
  } else if (state.activeNodeId) {
    const node = state.nodes.find((n) => n.id === state.activeNodeId)!;
    state.lowEnergyBlocked = false;
    const isSpearFish =
      node.propKind === 'fishing' && state.equippedWeapon === 'spear' && state.hasSpear;
    state.activeAction =
      node.kind === 'wood'
        ? 'chop'
        : node.kind === 'banana'
          ? 'climb'
          : node.kind === 'fish'
            ? isSpearFish
              ? 'spear_fish'
              : 'cast_fish'
            : 'forage';

    state.actionTargetX =
      node.propKind === 'fishing' && node.waterX !== undefined ? node.waterX : node.x;
    state.actionTargetZ =
      node.propKind === 'fishing' && node.waterZ !== undefined ? node.waterZ : node.z;

    let speedMult = 1.0;
    if (node.kind === 'fish') {
      speedMult = getFishingSpeedMultiplier(state) * (isSpearFish ? 1.2 : 1.0);
    } else if (node.kind === 'wood') {
      const axeBonus =
        state.equippedWeapon === 'axe' ? 1 + (state.weaponLevels.axe - 1) * 0.3 : 1.0;
      speedMult = (1 + state.skills.lumberjack * 0.25) * axeBonus;
    } else {
      speedMult = 1 + state.skills.lumberjack * 0.25;
    }

    state.harvestProgress += (dt * speedMult) / Math.max(0.1, node.duration);
    state.actionProgress = Math.min(1, state.harvestProgress);

    if (state.harvestProgress >= 1) {
      if (node.propKind === 'fishing' && randomFn() > getFishingCatchChance(state, node)) {
        // Probabilistic escape when fishing!
        node.cooldownRemaining = 3.0;
        state.autoFishCooldown = 2.0;
        state.energy = Math.max(1, state.energy - node.energyCost * 0.45);
        fishingMissed = {
          nodeId: node.id,
          x: node.x,
          z: node.z,
          notice: 'ماهی قلاب را رها کرد و فرار کرد!',
        };
        if (state.hasSpear) pushWeaponXp('spear', 4);
      } else {
        let rawYield = 1;
        if (node.propKind === 'fishing') {
          const rainBonus = state.weather === 'rain' || state.weather === 'storm' ? 1 : 0;
          const frenzyBonus =
            state.activeEvent === 'fish_frenzy' && state.eventPhase === 'active' ? 1 : 0;
          const pierOrFireBonus =
            state.hasFireSpear || (node.id === 'fish-spot-0' && state.buildings.pier) ? 1 : 0;
          const spearLv3Bonus =
            state.hasSpear && state.weaponLevels.spear >= 3 ? 1 : 0;
          rawYield = 1 + rainBonus + frenzyBonus + pierOrFireBonus + spearLv3Bonus;
          if (rawYield === 1 && state.skills.angler > 0 && (state.dayCount + state.xp) % 2 === 0) {
            rawYield = 2;
          }
          if (state.hasSpear) {
            pushWeaponXp('spear', 9);
          }
          state.autoFishCooldown = 2.2;
        } else if (node.kind === 'banana') {
          rawYield = 2;
        } else if (node.kind === 'wood') {
          const axeLvl = state.weaponLevels.axe;
          if (state.equippedWeapon === 'axe' && axeLvl >= 2) {
            rawYield = axeLvl >= 3 ? 2 : state.xp % 2 === 0 ? 2 : 1;
          }
          if (axeLvl >= 5) {
            state.coins += 1;
            earnedCoins += 1;
          }
          pushWeaponXp('axe', 10);
          // Axe Lv 3+ Shock-Chop hits 1 adjacent ready tree within 3.2m
          if (state.equippedWeapon === 'axe' && axeLvl >= 3) {
            const adj = state.nodes.find(
              (other) =>
                other.id !== node.id &&
                other.kind === 'wood' &&
                other.cooldownRemaining <= 0 &&
                Math.hypot(other.x - node.x, other.z - node.z) <= 3.2
            );
            if (adj && freeSlots - rawYield > 0) {
              adj.cooldownRemaining = adj.regrowDuration;
              rawYield += 1;
            }
          }
        }
        const amount = Math.min(rawYield, freeSlots);
        state.carried[node.kind] += amount;
        for (let i = 0; i < amount; i += 1) {
          state.carriedStack.push(node.kind);
        }
        state.energy = Math.max(1, state.energy - node.energyCost);
        node.cooldownRemaining = node.regrowDuration;
        pushXp(node.kind === 'wood' || node.kind === 'fish' ? 8 : 6);
        harvested = {
          nodeId: node.id,
          kind: node.kind,
          propKind: node.propKind,
          amount,
          x: node.x,
          y: node.y,
          z: node.z,
        };
      }
      state.activeNodeId = null;
      state.harvestProgress = 0;
      state.actionProgress = 0;
      state.activeAction = 'idle';
    }
  } else if (state.activeHuntActorId) {
    const prey = state.wildlife.actors.find((a) => a.id === state.activeHuntActorId)!;
    const spec = getAnimalSpecies(prey.speciesId)!;
    state.lowEnergyBlocked = false;
    state.activeAction = 'hunt';
    state.actionTargetX = prey.x;
    state.actionTargetZ = prey.z;

    const spearLvlBonus = state.hasSpear ? 1 + (state.weaponLevels.spear - 1) * 0.28 : 1.0;
    const huntSpeed =
      (1 + state.skills.angler * 0.2) *
      (state.hasFireSpear ? 1.4 : state.hasSpear ? 1.15 : 1.0) *
      spearLvlBonus;
    const dur = spec.huntDuration ?? CONFIG.SURVIVAL.HARVEST_DURATION_HUNT;
    state.huntProgress += (dt * huntSpeed) / Math.max(0.15, dur);
    state.actionProgress = Math.min(1, state.huntProgress);

    if (state.huntProgress >= 1) {
      const baseYield = spec.meatYield ?? 1;
      const amount = Math.min(baseYield, freeSlots);
      const spearFiery = state.hasFireSpear || (state.hasSpear && state.weaponLevels.spear >= 4);
      if (spearFiery) {
        state.cookedMeat += amount;
      } else {
        state.carried.meat += amount;
        for (let i = 0; i < amount; i += 1) {
          state.carriedStack.push('meat');
        }
      }
      state.huntedCount += 1;
      state.energy = Math.max(1, state.energy - CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT);
      const bonusCoins =
        (prey.category === 'night_predator' ? 3 : 1) +
        (state.hasSpear && state.weaponLevels.spear >= 5 ? 2 : 0);
      state.coins += bonusCoins;
      earnedCoins += bonusCoins;
      pushXp(prey.category === 'night_predator' ? 14 : 9);
      if (state.equippedWeapon === 'spear' && state.hasSpear) {
        pushWeaponXp('spear', 12);
      } else {
        pushWeaponXp('axe', 8);
      }
      markAnimalHunted(prey);
      hunted = {
        actorId: prey.id,
        speciesId: prey.speciesId,
        amount,
        x: prey.x,
        y: prey.y,
        z: prey.z,
      };
      state.activeHuntActorId = null;
      state.huntProgress = 0;
      state.actionProgress = 0;
      state.activeAction = 'idle';
    }
  } else if (!arrowShot && !hammerSlam && !openedSecret) {
    const canRoastAny =
      state.nearCampfire &&
      (state.carried.fish > 0 ||
        state.carried.meat > 0 ||
        (state.fireLevel >= 2 && state.carried.banana > 0));
    if (canRoastAny) {
      state.activeAction = 'cook';
      state.actionTargetX = camp.CX;
      state.actionTargetZ = camp.CZ;
      state.actionProgress = state.cookProgress;
    } else {
      state.activeAction = 'idle';
      state.actionProgress = 0;
    }
    state.lowEnergyBlocked = state.energy <= 1 && moved;
  }

  // Check Defeat Condition (predator strikes / disaster hazards / drowning brought energy to 0!)
  if (state.energy <= 0) {
    state.energy = 0;
    state.gameOutcome = 'defeat';
  }

  const hudChanged =
    Boolean(harvested) ||
    Boolean(fishingMissed) ||
    Boolean(hunted) ||
    Boolean(builtUpgrade) ||
    Boolean(openedSecret) ||
    Boolean(arrowShot) ||
    Boolean(hammerSlam) ||
    Boolean(eventStarted) ||
    Boolean(eventEndedNotice) ||
    Boolean(boatVoyageNotice) ||
    weaponLevelUps.length > 0 ||
    playerLevelUp !== undefined ||
    hazardStrikes.length > 0 ||
    predatorStrikes.length > 0 ||
    cookedCount > 0 ||
    roastedBananaCount > 0 ||
    cookedMeatCount > 0 ||
    depositedToCamp > 0 ||
    discoveredSpecies.length > 0 ||
    Math.round(state.energy) !== prevRoundedEnergy ||
    state.nearCampfire !== prevNearCamp ||
    state.backpackFullBlocked !== prevFullBlocked ||
    state.lowEnergyBlocked !== prevLowBlocked ||
    state.needSpearBlocked !== prevNeedSpear ||
    state.needSpearHuntBlocked !== prevNeedSpearHunt ||
    state.predatorAlert !== prevPredatorAlert ||
    state.activeAction !== prevAction ||
    state.phase !== prevPhase ||
    state.weather !== prevWeather ||
    state.activeEvent !== prevEvent ||
    state.eventPhase !== prevEventPhase ||
    state.season !== prevSeason ||
    state.isSwimming !== prevSwimming ||
    state.gameOutcome !== prevOutcome ||
    state.playerLevel !== prevPlayerLevel ||
    state.discoveredSecrets.length !== prevSecretsFound ||
    (state.nearbyPad?.id ?? null) !== prevNearbyPadId ||
    (state.nearbyLandmark?.id ?? null) !== prevNearbyLandmarkId ||
    (state.focusedTarget?.id ?? null) !== prevFocusedId ||
    (state.focusedTarget?.blockedReason ?? null) !== prevFocusedReason;

  return {
    hudChanged,
    harvested,
    fishingMissed,
    hunted,
    arrowShot,
    hammerSlam,
    builtUpgrade,
    openedSecret,
    eventStarted,
    eventEndedNotice,
    boatVoyageNotice,
    weaponLevelUps,
    playerLevelUp,
    hazardStrikes,
    predatorStrikes,
    damageTaken,
    cookedCount,
    roastedBananaCount,
    cookedMeatCount,
    depositedToCamp,
    earnedCoins,
    discoveredSpecies,
  };
}
