import {
  CONFIG,
  type BiomeId,
  type CampUpgradeId,
  type DayPhase,
  type GameMode,
  type GameOutcome,
  type SeasonKind,
  type SkillId,
  type StrangeLandmarkId,
  type WeaponId,
  type WeatherKind,
  type WildlifeDifficulty,
  type WorkshopRecipeId,
  type WorldEventKind,
} from './config';
import { toPersianDigits } from './utils';
import {
  createWildlifeState,
  damageAnimalActor,
  enrageAnimal,
  getAnimalSpecies,
  getSpeciesMaxHp,
  isHostilePredatorActor,
  markAnimalHunted,
  stepWildlifeSystem,
  type AnimalActorState,
  type PredatorStrikeEvent,
  type WildlifeState,
} from './wildlife';
import type {
  AncientBoneSite,
  BuildPadSite,
  FishingSpot,
  IslandProp,
  IslandWorldData,
  LandmarkActionSite,
  MysterySpot,
  MysterySpotKind,
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
  | 'mystery_open'
  | 'salvage'
  | 'inspect'
  | 'temple_open'
  | 'voyage';

export type FocusedTargetKind =
  | 'node'
  | 'prey'
  | 'pad'
  | 'secret'
  | 'mystery'
  | 'landmark'
  | 'boat_voyage'
  | 'wreck'
  | 'bone_shrine'
  | 'temple_door'
  | 'campfire_ignite';
export type BlockedReason =
  | 'backpack_full'
  | 'low_energy'
  | 'need_spear'
  | 'need_fire_level'
  | 'need_wood'
  | 'need_bones'
  | 'cooldown';

export interface DisasterChallengeState {
  event: Exclude<WorldEventKind, 'none'>;
  titleFa: string;
  goalFa: string;
  status: 'active' | 'completed' | 'failed';
  dodgedCount: number;
  hitsTaken: number;
  rewardCoins: number;
  rewardXp: number;
}

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
  kind: 'lightning' | 'lava' | 'meteor' | 'boulder' | 'whirlwind';
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
  fireLit: boolean;
  fireLevel: number;
  fireStokedCount: number;
  venomTimer: number;
  antidotes: number;
  shellArmorCharges: number;
  elixirTimer: number;
  torchTimer: number;
  baitCharges: number;
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
  mysterySpots: MysterySpot[];
  discoveredMysteries: string[];
  ancientBoneSites: AncientBoneSite[];
  inspectedBones: string[];
  templeUnlocked: boolean;
  templeRelicClaimed: boolean;
  templeDoorProgress: number;
  wreckSite: { x: number; y: number; z: number; rotationY: number } | null;
  wreckLooted: boolean;
  disasterChallenge: DisasterChallengeState | null;
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
  lavaPools: Array<{ x: number; z: number; radius: number; timer: number }>;
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
  meleeCombatCooldown: number;
  postEventBreatherTimer: number;
  combatSwingTimer: number;
  wildlifeDifficulty: WildlifeDifficulty;
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
  meleeStrike?: {
    actorId: string;
    speciesId: string;
    nameFa: string;
    damage: number;
    defeated: boolean;
    x: number;
    y: number;
    z: number;
    hp: number;
    maxHp: number;
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
    isTrap: boolean;
    energyDelta: number;
    coinsDelta: number;
    notice: string;
  };
  openedMystery?: {
    id: string;
    kind: MysterySpotKind;
    nameFa: string;
    x: number;
    y: number;
    z: number;
    isHarmful: boolean;
    energyDelta: number;
    coinsDelta: number;
    poisonedSec?: number;
    notice: string;
  };
  wreckSalvaged?: {
    x: number;
    y: number;
    z: number;
  };
  boneInspected?: {
    id: string;
    nameFa: string;
    loreFa: string;
    x: number;
    y: number;
    z: number;
  };
  templeOpened?: {
    x: number;
    y: number;
    z: number;
    notice: string;
  };
  templeLockedNotice?: string;
  fireLitNow?: boolean;
  poisonedSec?: number;
  disasterChallengeOutcome?: {
    titleFa: string;
    completed: boolean;
    rewardCoins: number;
  };
  eventStarted?: {
    kind: WorldEventKind;
    phase: 'warning' | 'active';
    notice: string;
  };
  eventEndedNotice?: string;
  campfireExtinguishedNotice?: string;
  boatVoyageNotice?: string;
  boatVoyageVictoryReady?: boolean;
  weaponLevelUps: WeaponLevelUpEvent[];
  playerLevelUp?: number;
  hazardStrikes: Array<{
    id: string;
    kind: 'lightning' | 'lava' | 'meteor' | 'boulder' | 'whirlwind';
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
  fireLit: boolean;
  fireLevel: number;
  canIgniteFire: boolean;
  canStokeFire: boolean;
  venomTimer: number;
  antidotes: number;
  shellArmorCharges: number;
  elixirTimer: number;
  torchTimer: number;
  baitCharges: number;
  wreckLooted: boolean;
  bonesFound: number;
  bonesTotal: number;
  templeUnlocked: boolean;
  templeRelicClaimed: boolean;
  disasterChallenge: DisasterChallengeState | null;
  xp: number;
  playerLevel: number;
  playerXp: number;
  playerXpToNext: number;
  skillPoints: number;
  skills: Record<SkillId, number>;
  discoveredAnimals: string[];
  secretsFound: number;
  secretsTotal: number;
  mysteriesFound: number;
  mysteriesTotal: number;
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
  wildlifeDifficulty: WildlifeDifficulty;
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
    fireLit: false,
    fireLevel: 0,
    fireStokedCount: 0,
    venomTimer: 0,
    antidotes: 1,
    shellArmorCharges: 0,
    elixirTimer: 0,
    torchTimer: 0,
    baitCharges: 0,
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
    nextEventTimer: 44,
    eventTick: 0,
    seaLevelOffset: 0,
    boatVoyageCooldown: 0,
    nodes: createHarvestNodesFromWorld(world),
    buildPads: world.buildPads.map((p) => ({ ...p })),
    landmarkSites: world.landmarkSites.map((l) => ({ ...l })),
    secretSpots: world.secretSpots ? world.secretSpots.map((s) => ({ ...s })) : [],
    discoveredSecrets: [],
    mysterySpots: world.mysterySpots ? world.mysterySpots.map((m) => ({ ...m })) : [],
    discoveredMysteries: [],
    ancientBoneSites: world.ancientBoneSites ? world.ancientBoneSites.map((b) => ({ ...b })) : [],
    inspectedBones: [],
    templeUnlocked: false,
    templeRelicClaimed: false,
    templeDoorProgress: 0,
    wreckSite: world.wreckSite ? { ...world.wreckSite } : null,
    wreckLooted: false,
    disasterChallenge: null,
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
    lavaPools: [],
    hazardSpawnTimer: 1.4,
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
    meleeCombatCooldown: 0,
    postEventBreatherTimer: 0,
    combatSwingTimer: 0,
    wildlifeDifficulty: 'normal',
  };
}

export function setWildlifeDifficulty(
  state: SurvivalState,
  difficulty: WildlifeDifficulty
): void {
  state.wildlifeDifficulty = difficulty;
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
    elixirTimer?: number;
  }
): number {
  if (state.energy <= 1) return CONFIG.SURVIVAL.EXHAUSTED_SPEED_SCALE;

  const skillBonus = 1 + state.skills.pathfinder * 0.12;
  const levelBonus = 1 + Math.max(0, (state.playerLevel ?? 1) - 1) * 0.025;
  const fireAuraBonus = state.fireLevel >= 6 ? 1.16 : state.fireLevel >= 3 ? 1.1 : 1.0;
  const elixirBonus = (state.elixirTimer ?? 0) > 0 ? 1.18 : 1.0;

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

  return skillBonus * levelBonus * fireAuraBonus * elixirBonus * weatherScale * swimScale;
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
  > & { baitCharges?: number },
  node?: Pick<HarvestNodeState, 'id'>
): number {
  if ((state.baitCharges ?? 0) > 0) return 1.0;
  let chance = 0.8;
  chance += state.skills.angler * 0.06;
  chance += Math.max(0, state.weaponLevels.spear - 1) * 0.04;
  if (state.weather === 'rain' || state.weather === 'storm') chance += 0.08;
  if (state.activeEvent === 'fish_frenzy' && state.eventPhase === 'active') chance += 0.12;
  if (node?.id === 'fish-spot-0' && state.buildings.pier) chance += 0.07;
  return Math.max(0.75, Math.min(0.97, chance));
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

export function lightCampfire(state: SurvivalState): boolean {
  if (!state.nearCampfire || state.fireLit) return false;
  if (!spendWood(state, CONFIG.SURVIVAL.FIRE_IGNITE_WOOD_COST)) return false;
  state.fireLit = true;
  state.fireLevel = Math.max(1, state.fireLevel);
  state.fireStokeAnimTimer = 0.8;
  state.energy = Math.min(state.maxEnergy, state.energy + 12);
  state.coins += 2;
  awardXp(state, 12);
  return true;
}

export function stokeCampfire(state: SurvivalState): boolean {
  if (!state.nearCampfire || !state.fireLit) return false;
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

export function useAntidote(state: SurvivalState): boolean {
  if (state.venomTimer <= 0 || state.antidotes <= 0) return false;
  state.antidotes -= 1;
  state.venomTimer = 0;
  state.energy = Math.min(state.maxEnergy, state.energy + 10);
  return true;
}

function spendCarriedItem(state: SurvivalState, kind: ResourceKind, count: number): boolean {
  if (state.carried[kind] < count) return false;
  state.carried[kind] -= count;
  removeFromStack(state.carriedStack, kind, count);
  return true;
}

export function craftWorkshopItem(
  state: SurvivalState,
  recipeId: WorkshopRecipeId
): { crafted: boolean; notice: string } {
  if (recipeId === 'antidote') {
    if (state.carried.berries >= 2 && state.coins >= 2) {
      spendCarriedItem(state, 'berries', 2);
      state.coins -= 2;
    } else if (state.coins >= 5) {
      state.coins -= 5;
    } else {
      return { crafted: false, notice: 'برای پادزهر به ۲ توت + ۲ سکه (یا ۵ سکه) نیاز دارید' };
    }
    state.antidotes += 1;
    awardXp(state, 8);
    return { crafted: true, notice: 'پادزهر زهر مار ساخته شد (+۱ پادزهر)' };
  }

  if (recipeId === 'elixir') {
    if (state.carried.banana < 1 || state.carried.berries < 2) {
      return { crafted: false, notice: 'برای معجون چابکی به ۱ موز و ۲ توت نیاز دارید' };
    }
    spendCarriedItem(state, 'banana', 1);
    spendCarriedItem(state, 'berries', 2);
    state.elixirTimer = Math.max(state.elixirTimer, 24);
    state.energy = Math.min(state.maxEnergy, state.energy + 15);
    awardXp(state, 10);
    return { crafted: true, notice: 'معجون چابکی نوشیده شد! سرعت +۱۸٪ و بازیابی انرژی' };
  }

  if (recipeId === 'shell_armor') {
    if (!spendShells(state, 3)) {
      return { crafted: false, notice: 'برای طلسم صدف به ۳ صدف نیاز دارید' };
    }
    state.shellArmorCharges += 2;
    awardXp(state, 10);
    return { crafted: true, notice: 'طلسم دفاعی صدف فعال شد (+۲ محافظ ضربه)' };
  }

  if (recipeId === 'golden_bait') {
    if (state.carried.fish < 1 || state.carried.berries < 1) {
      return { crafted: false, notice: 'برای طعمه طلایی به ۱ ماهی خام و ۱ توت نیاز دارید' };
    }
    spendCarriedItem(state, 'fish', 1);
    spendCarriedItem(state, 'berries', 1);
    state.baitCharges += 3;
    awardXp(state, 10);
    return { crafted: true, notice: 'طعمه طلایی آماده شد (+۳ صید ۱۰۰٪ و ماهی اضافه)' };
  }

  if (recipeId === 'ward_torch') {
    if (state.coins < 2 || state.stashed.wood + state.carried.wood < 2) {
      return { crafted: false, notice: 'برای مشعل محافظ به ۲ چوب و ۲ سکه نیاز دارید' };
    }
    spendWood(state, 2);
    state.coins -= 2;
    state.torchTimer = Math.max(state.torchTimer, 38);
    awardXp(state, 10);
    return { crafted: true, notice: 'مشعل محافظ روشن شد! مارها و شکارچیان شب دور می‌مانند' };
  }

  if (recipeId === 'supply_pack') {
    if (state.coins < 10) {
      return { crafted: false, notice: 'برای بسته انرژی به ۱۰ سکه نیاز دارید' };
    }
    state.coins -= 10;
    state.energy = Math.min(state.maxEnergy, state.energy + 45);
    state.lowEnergyBlocked = false;
    return { crafted: true, notice: 'بسته انرژی کمپ باز شد (+۴۵ انرژی)' };
  }

  if (state.coins < 12) {
    return { crafted: false, notice: 'برای تومار تجربه به ۱۲ سکه نیاز دارید' };
  }
  state.coins -= 12;
  awardXp(state, 24);
  awardWeaponXp(state, state.equippedWeapon, 15);
  return { crafted: true, notice: 'تومار تجربه خوانده شد! (+۲۴ تجربه و +۱۵ مهارت سلاح)' };
}

export function salvagePlaneWreck(
  state: SurvivalState,
  playerX?: number,
  playerZ?: number
): { salvaged: boolean; notice: string } {
  if (state.wreckLooted || !state.wreckSite) {
    return { salvaged: false, notice: 'تجهیزات لاشه هواپیما قبلاً جمع‌آوری شده است' };
  }
  if (
    playerX !== undefined &&
    playerZ !== undefined &&
    Math.hypot(playerX - state.wreckSite.x, playerZ - state.wreckSite.z) >
      CONFIG.SURVIVAL.HARVEST_RANGE_WRECK + 0.8
  ) {
    return { salvaged: false, notice: 'برای جست‌وجو به لاشه هواپیما نزدیک‌تر شوید' };
  }
  state.wreckLooted = true;
  const freeSlots = Math.max(0, state.backpackCapacity - getBackpackUsed(state));
  const toCarry = Math.min(3, freeSlots);
  const toStash = 3 - toCarry;
  if (toCarry > 0) {
    state.carried.wood += toCarry;
    for (let i = 0; i < toCarry; i += 1) state.carriedStack.push('wood');
  }
  if (toStash > 0) {
    state.stashed.wood += toStash;
  }
  state.coins += 8;
  state.antidotes += 1;
  awardXp(state, 18);
  return {
    salvaged: true,
    notice: 'جعبه‌سیاه و تدارکات هواپیما پیدا شد! (+۳ چوب، +۸ سکه و ۱ پادزهر)',
  };
}

export function inspectAncientBones(
  state: SurvivalState,
  boneId: string,
  playerX?: number,
  playerZ?: number
): { inspected: boolean; bone?: AncientBoneSite; notice: string } {
  const bone = state.ancientBoneSites.find((b) => b.id === boneId);
  if (!bone) return { inspected: false, notice: 'محراب استخوان پیدا نشد' };
  if (state.inspectedBones.includes(boneId)) {
    return { inspected: false, bone, notice: bone.loreFa };
  }
  if (
    playerX !== undefined &&
    playerZ !== undefined &&
    Math.hypot(playerX - bone.x, playerZ - bone.z) > CONFIG.SURVIVAL.HARVEST_RANGE_BONE + 0.6
  ) {
    return { inspected: false, bone, notice: 'به استخوان‌های باستانی نزدیک‌تر شوید' };
  }
  state.inspectedBones.push(boneId);
  state.coins += 5;
  if (state.inspectedBones.length === 1 || boneId === 'bone-jungle-trail') {
    state.antidotes += 1;
  }
  awardXp(state, 12);
  return {
    inspected: true,
    bone,
    notice: `${bone.nameFa}: ${bone.loreFa} (+۵ سکه و تجربه)`,
  };
}

export function openBuriedTempleDoor(
  state: SurvivalState,
  playerX?: number,
  playerZ?: number
): { opened: boolean; lockedReason?: 'need_bones' | 'already_claimed' | 'too_far'; notice: string } {
  if (state.templeRelicClaimed) {
    return {
      opened: false,
      lockedReason: 'already_claimed',
      notice: 'گنجینه و آیتم مخفی معبد سنگی قبلاً دریافت شده است',
    };
  }
  const templeX = CONFIG.ISLAND.SHIPWRECK.HULL_CX;
  const templeZ = CONFIG.ISLAND.SHIPWRECK.HULL_CZ;
  if (
    playerX !== undefined &&
    playerZ !== undefined &&
    Math.hypot(playerX - templeX, playerZ - templeZ) > CONFIG.SURVIVAL.HARVEST_RANGE_TEMPLE + 0.85
  ) {
    return {
      opened: false,
      lockedReason: 'too_far',
      notice: 'به درب معبد سنگی نیمه‌مدفون نزدیک‌تر شوید',
    };
  }

  const requiredBones = Math.max(1, state.ancientBoneSites.length);
  const collectedBones = state.inspectedBones.length;
  if (collectedBones < requiredBones) {
    return {
      opened: false,
      lockedReason: 'need_bones',
      notice: `درب معبد سنگی قفل است! ابتدا استخوان‌های باستانی جزیره را جمع کن (${collectedBones} از ${requiredBones})`,
    };
  }

  state.templeUnlocked = true;
  state.templeRelicClaimed = true;
  state.templeDoorProgress = 1;
  state.coins += 40;
  state.skillPoints += 2;
  state.hasSpear = true;
  state.hasFireSpear = true;
  state.unlockedWeapons.spear = true;
  state.unlockedWeapons.bow = true;
  state.unlockedWeapons.hammer = true;
  state.antidotes += 2;
  state.shellArmorCharges += 3;
  state.elixirTimer = Math.max(state.elixirTimer, 40);
  state.energy = state.maxEnergy;
  awardXp(state, 55);

  return {
    opened: true,
    notice:
      'درب معبد سنگی گشوده شد! آیتم مخفی باستانی (تاج خورشید، نیزه آتشین و +۴۰ سکه) دریافت شد!',
  };
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
  playerZ?: number,
  randomFn: () => number = Math.random
): {
  opened: boolean;
  secret?: SecretSpot;
  isTrap?: boolean;
  energyDelta?: number;
  coinsDelta?: number;
  notice?: string;
  reason?: string;
} {
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

  // First grotto chest stays a safe welcome reward; later secret chests can hide traps!
  const roll = randomFn();
  const isTrap = secret.id !== 'waterfall_grotto' && roll < 0.32;
  if (isTrap) {
    let rawDmg = secret.id === 'volcano_alcove' ? 22 : 18;
    if (state.shellArmorCharges > 0) {
      rawDmg = Math.ceil(rawDmg * 0.5);
      state.shellArmorCharges -= 1;
    }
    state.energy = Math.max(0, state.energy - rawDmg);
    if (secret.id === 'ruins_crypt' || secret.id === 'mushroom_hollow') {
      state.venomTimer = Math.max(state.venomTimer, 5);
    }
    const scrapCoins = roll < 0.18 ? 6 : 0;
    if (scrapCoins > 0) {
      state.coins += scrapCoins;
    }
    awardXp(state, 12);
    if (state.energy <= 0) {
      state.gameOutcome = 'defeat';
    }
    const dmgFa = toPersianDigits(rawDmg);
    const notice =
      scrapCoins > 0
        ? `تله پنهان در ${secret.nameFa}! -${dmgFa} انرژی کم شد (اما ${toPersianDigits(scrapCoins)} سکه افتاد)`
        : `تله نفرین‌شده در ${secret.nameFa}! -${dmgFa} انرژی از دست دادی!`;
    return {
      opened: true,
      secret,
      isTrap: true,
      energyDelta: -rawDmg,
      coinsDelta: scrapCoins,
      notice,
    };
  }

  state.coins += 15;
  state.skillPoints += 1;
  state.energy = Math.min(state.maxEnergy, state.energy + 25);
  awardXp(state, 30);
  return {
    opened: true,
    secret,
    isTrap: false,
    energyDelta: 25,
    coinsDelta: 15,
    notice: `گنج مخفی کشف شد: ${secret.nameFa} (+۱۵ سکه و +۲۵ انرژی)`,
  };
}

export function inspectMysterySpot(
  state: SurvivalState,
  mysteryId: string,
  playerX?: number,
  playerZ?: number,
  randomFn?: () => number
): {
  opened: boolean;
  mystery?: MysterySpot;
  isHarmful?: boolean;
  energyDelta?: number;
  coinsDelta?: number;
  poisonedSec?: number;
  notice?: string;
  reason?: string;
} {
  if (state.discoveredMysteries.includes(mysteryId)) {
    return { opened: false, reason: 'already_opened' };
  }
  const mystery = state.mysterySpots.find((m) => m.id === mysteryId);
  if (!mystery) return { opened: false, reason: 'not_found' };
  if (
    playerX !== undefined &&
    playerZ !== undefined &&
    Math.hypot(playerX - mystery.x, playerZ - mystery.z) > CONFIG.SURVIVAL.HARVEST_RANGE_MYSTERY + 0.55
  ) {
    return { opened: false, reason: 'too_far' };
  }

  state.discoveredMysteries.push(mystery.id);
  const roll = randomFn ? randomFn() : (mystery.trapRoll + Math.random()) * 0.5;
  const harmful = roll < 0.38;

  if (harmful) {
    let dmg =
      mystery.kind === 'cursed_casket'
        ? 26
        : mystery.kind === 'unstable_crystal'
          ? 20
          : mystery.kind === 'mystery_urn'
            ? 18
            : 15;
    if (state.shellArmorCharges > 0) {
      dmg = Math.ceil(dmg * 0.5);
      state.shellArmorCharges -= 1;
    }
    state.energy = Math.max(0, state.energy - dmg);
    let poisonedSec: number | undefined;
    if (mystery.kind === 'glowing_shroom' || mystery.kind === 'mystery_urn') {
      poisonedSec = 5;
      state.venomTimer = Math.max(state.venomTimer, poisonedSec);
    }
    awardXp(state, 10);
    if (state.energy <= 0) {
      state.gameOutcome = 'defeat';
    }
    const dmgFa = toPersianDigits(dmg);
    const harmMessages: Record<MysterySpotKind, string> = {
      glowing_shroom: `اسپور سمی قارچ پخش شد! -${dmgFa} انرژی و مسمومیت!`,
      ancient_totem: `توتم باستانی خشمگین شد و صاعقه زد! -${dmgFa} انرژی!`,
      message_bottle: `در بطری یک عروس دریایی گزنده بود! -${dmgFa} انرژی!`,
      mystery_urn: `مار پنهان در کوزه نیش زد! -${dmgFa} انرژی و سم!`,
      unstable_crystal: `کریستال منفجر شد! موج گرما -${dmgFa} انرژی کم کرد!`,
      shadow_pool: `آب سرد سایه جانت را مکید! -${dmgFa} انرژی!`,
      cursed_casket: `نفرین صندوقچه مرموز فعال شد! -${dmgFa} انرژی!`,
    };
    return {
      opened: true,
      mystery,
      isHarmful: true,
      energyDelta: -dmg,
      coinsDelta: 0,
      poisonedSec,
      notice: harmMessages[mystery.kind],
    };
  }

  let coins = 12;
  let energyGain = 15;
  let notice = '';
  if (mystery.kind === 'glowing_shroom') {
    energyGain = 24;
    state.elixirTimer = Math.max(state.elixirTimer, 16);
    notice = 'قارچ جادویی انرژی‌ات را پر کرد (+۲۴ انرژی و چابکی)!';
  } else if (mystery.kind === 'ancient_totem') {
    coins = 18;
    energyGain = 15;
    state.skillPoints += 1;
    notice = 'توتم باستانی تو را برکت داد (+۱۸ سکه و +۱۵ انرژی)!';
  } else if (mystery.kind === 'message_bottle') {
    coins = 14;
    state.stashed.shell += 2;
    notice = 'نقشه گنج در بطری! (+۱۴ سکه و +۲ صدف در کمپ)';
  } else if (mystery.kind === 'mystery_urn') {
    coins = 12;
    state.antidotes += 1;
    notice = 'در کوزه سکه‌های قدیمی و یک پادزهر پیدا شد (+۱۲ سکه و +۱ پادزهر)!';
  } else if (mystery.kind === 'unstable_crystal') {
    coins = 14;
    awardWeaponXp(state, state.equippedWeapon, 22);
    notice = 'انرژی کریستال سلاح را تقویت کرد (+۲۲ تجربه سلاح و +۱۴ سکه)!';
  } else if (mystery.kind === 'shadow_pool') {
    coins = 10;
    energyGain = 28;
    state.venomTimer = 0;
    notice = 'آب زلال پنهان خستگی و سم را شست (+۲۸ انرژی و +۱۰ سکه)!';
  } else {
    coins = 24;
    state.skillPoints += 1;
    notice = 'گنج نایاب دزدان دریایی! (+۲۴ سکه و +۱۵ انرژی)';
  }

  state.coins += coins;
  state.energy = Math.min(state.maxEnergy, state.energy + energyGain);
  awardXp(state, 20);
  return {
    opened: true,
    mystery,
    isHarmful: false,
    energyDelta: energyGain,
    coinsDelta: coins,
    notice,
  };
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
  if (kind === 'earthquake') return ev.EARTHQUAKE_DURATION_SEC;
  if (kind === 'lightning_storm') return ev.LIGHTNING_STORM_DURATION_SEC;
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
  if (kind === 'earthquake') {
    return phase === 'warning'
      ? 'لرزش شدید زمین! زلزله در راه است — مراقب سقوط صخره‌ها باش!'
      : 'زلزله بزرگ جزیره! زمین می‌لرزد و صخره‌ها فرود می‌آیند — جاخالی بده!';
  }
  if (kind === 'lightning_storm') {
    return phase === 'warning'
      ? 'ابرهای تیره جمع شدند! توفان صاعقه نزدیک است!'
      : 'توفان سهمگین صاعقه! رعدوبرق پی‌درپی بر جزیره می‌کوبد!';
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
  const needsWarning =
    !skipWarning &&
    (kind === 'tsunami' ||
      kind === 'volcano_eruption' ||
      kind === 'earthquake' ||
      kind === 'lightning_storm');
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

function createChallengeForEvent(kind: WorldEventKind): DisasterChallengeState | null {
  if (kind === 'tsunami') {
    return {
      event: 'tsunami',
      titleFa: 'چالش موج عظیم سونامی',
      goalFa: 'تا پایان موج، وارد آب عمیق نشو و در بلندی بمان',
      status: 'active',
      dodgedCount: 0,
      hitsTaken: 0,
      rewardCoins: 10,
      rewardXp: 20,
    };
  }
  if (kind === 'volcano_eruption') {
    return {
      event: 'volcano_eruption',
      titleFa: 'چالش فوران آتشفشان',
      goalFa: 'از برخورد سنگ‌های گدازه بدون آسیب جان سالم ببر',
      status: 'active',
      dodgedCount: 0,
      hitsTaken: 0,
      rewardCoins: 12,
      rewardXp: 24,
    };
  }
  if (kind === 'earthquake') {
    return {
      event: 'earthquake',
      titleFa: 'چالش زلزله جزیره',
      goalFa: 'از سقوط تخته سنگ‌ها جاخالی بده و آسیب نبین',
      status: 'active',
      dodgedCount: 0,
      hitsTaken: 0,
      rewardCoins: 11,
      rewardXp: 22,
    };
  }
  if (kind === 'lightning_storm') {
    return {
      event: 'lightning_storm',
      titleFa: 'چالش توفان صاعقه',
      goalFa: 'از دایره‌های صاعقه بدون برخورد عبور کن',
      status: 'active',
      dodgedCount: 0,
      hitsTaken: 0,
      rewardCoins: 12,
      rewardXp: 24,
    };
  }
  if (kind === 'meteor_shower') {
    return {
      event: 'meteor_shower',
      titleFa: 'چالش بارش شهاب‌سنگ',
      goalFa: 'در بارش شهاب‌ها آسیب نبین تا پاداش ویژه بگیری',
      status: 'active',
      dodgedCount: 0,
      hitsTaken: 0,
      rewardCoins: 10,
      rewardXp: 20,
    };
  }
  return null;
}

function applyWorldEventActiveEffects(state: SurvivalState, kind: WorldEventKind): void {
  const challenge = createChallengeForEvent(kind);
  if (challenge) {
    state.disasterChallenge = challenge;
  }
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
  } else if (kind === 'earthquake') {
    state.coins += 5;
    awardXp(state, 14);
  } else if (kind === 'lightning_storm') {
    state.coins += 5;
    awardXp(state, 15);
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
    state.elixirTimer = Math.max(state.elixirTimer, 18);
    for (const node of state.nodes) {
      if (node.cooldownRemaining > 0) {
        node.cooldownRemaining *= 0.25;
      }
    }
    awardXp(state, 14);
    return { triggered: true, label: 'معجون اسپور: انرژی کامل، چابکی ۱۸ ثانیه و رشد سریع گیاهان!' };
  }
  if (landmarkId === 'shipwreck') {
    state.coins += 8;
    state.stashed.wood += 3;
    state.stashed.shell += 2;
    awardXp(state, 14);
    return { triggered: true, label: 'محراب معبد مدفون: +۸ سکه، ۳ چوب و ۲ صدف به کمپ رفت!' };
  }
  state.energy = state.maxEnergy;
  state.venomTimer = 0;
  state.weather = 'clear';
  state.weatherTimer = CONFIG.WEATHER.MAX_DURATION_SEC;
  state.predatorAlert = false;
  awardXp(state, 14);
  return { triggered: true, label: 'چشمه بلورین: انرژی کامل، خنثی‌سازی سم و هوای آفتابی!' };
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
      return { triggered: false, label: 'برای پیشکش در معبد مدفون، ۱ گوشت یا ماهی خام بیاور' };
    }
    state.landmarkSpecialCooldowns.shipwreck = CONFIG.SURVIVAL.LANDMARK_SPECIAL_COOLDOWN_SEC;
    state.coins += 9;
    awardXp(state, 15);
    return { triggered: true, label: 'پیشکش معبد سنگی مدفون: +۹ سکه و درخشش سنگ‌نوشته‌ها!' };
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
    fireLit: state.fireLit,
    fireLevel: state.fireLevel,
    canIgniteFire:
      state.nearCampfire &&
      !state.fireLit &&
      totalWood >= CONFIG.SURVIVAL.FIRE_IGNITE_WOOD_COST,
    canStokeFire:
      state.nearCampfire &&
      state.fireLit &&
      state.fireLevel < CONFIG.SURVIVAL.MAX_FIRE_LEVEL &&
      totalWood >= CONFIG.SURVIVAL.FIRE_FUEL_WOOD_COST,
    venomTimer: Math.ceil(state.venomTimer),
    antidotes: state.antidotes,
    shellArmorCharges: state.shellArmorCharges,
    elixirTimer: Math.ceil(state.elixirTimer),
    torchTimer: Math.ceil(state.torchTimer),
    baitCharges: state.baitCharges,
    wreckLooted: state.wreckLooted,
    bonesFound: state.inspectedBones.length,
    bonesTotal: state.ancientBoneSites.length,
    templeUnlocked: state.templeUnlocked,
    templeRelicClaimed: state.templeRelicClaimed,
    disasterChallenge: state.disasterChallenge ? { ...state.disasterChallenge } : null,
    xp: state.xp,
    playerLevel: state.playerLevel,
    playerXp: state.playerXp,
    playerXpToNext: state.playerXpToNext,
    skillPoints: state.skillPoints,
    skills: { ...state.skills },
    discoveredAnimals: [...state.wildlife.discoveredSpecies],
    secretsFound: state.discoveredSecrets.length,
    secretsTotal: Math.max(CONFIG.SURVIVAL.SECRETS_COUNT, state.secretSpots.length),
    mysteriesFound: state.discoveredMysteries.length,
    mysteriesTotal: Math.max(CONFIG.SURVIVAL.MYSTERY_SPOTS_COUNT, state.mysterySpots.length),
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
    wildlifeDifficulty: state.wildlifeDifficulty,
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
  const prevMysteriesFound = state.discoveredMysteries.length;
  const prevFireLit = state.fireLit;
  const prevVenomSec = Math.ceil(state.venomTimer);
  const prevAntidotes = state.antidotes;
  const prevShellArmor = state.shellArmorCharges;
  const prevElixirSec = Math.ceil(state.elixirTimer);
  const prevTorchSec = Math.ceil(state.torchTimer);
  const prevBait = state.baitCharges;
  const prevWreckLooted = state.wreckLooted;
  const prevBonesFound = state.inspectedBones.length;
  const prevTempleUnlocked = state.templeUnlocked;
  const prevTempleRelicClaimed = state.templeRelicClaimed;
  const prevChallengeStatus = state.disasterChallenge?.status ?? null;
  const prevChallengeDodged = state.disasterChallenge?.dodgedCount ?? 0;

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
  if (state.meleeCombatCooldown > 0) {
    state.meleeCombatCooldown = Math.max(0, state.meleeCombatCooldown - dt);
  }
  if (state.postEventBreatherTimer > 0) {
    state.postEventBreatherTimer = Math.max(0, state.postEventBreatherTimer - dt);
  }
  if (state.combatSwingTimer > 0) {
    state.combatSwingTimer = Math.max(0, state.combatSwingTimer - dt);
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
  if (state.elixirTimer > 0) {
    state.elixirTimer = Math.max(0, state.elixirTimer - dt);
    state.energy = Math.min(state.maxEnergy, state.energy + dt * 1.2);
  }
  if (state.torchTimer > 0) {
    state.torchTimer = Math.max(0, state.torchTimer - dt);
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
    const rawWeather: WeatherKind =
      roll < 0.42 ? 'clear' : roll < 0.68 ? 'rain' : roll < 0.84 ? 'storm' : 'fog';
    const nextWeather: WeatherKind =
      state.postEventBreatherTimer > 0 && rawWeather === 'storm' ? 'clear' : rawWeather;
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
  let disasterChallengeOutcome: SurvivalStepResult['disasterChallengeOutcome'];

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
      state.postEventBreatherTimer = 30;
      if (
        (ended === 'tsunami' ||
          ended === 'volcano_eruption' ||
          ended === 'earthquake' ||
          ended === 'lightning_storm') &&
        state.weather === 'storm'
      ) {
        state.weather = 'clear';
        state.weatherTimer = Math.max(state.weatherTimer, 28);
      }

      if (state.disasterChallenge && state.disasterChallenge.event === ended) {
        if (state.disasterChallenge.status === 'active') {
          state.disasterChallenge.status = 'completed';
          state.coins += state.disasterChallenge.rewardCoins;
          state.skillPoints += 1;
          pushXp(state.disasterChallenge.rewardXp);
          disasterChallengeOutcome = {
            titleFa: state.disasterChallenge.titleFa,
            completed: true,
            rewardCoins: state.disasterChallenge.rewardCoins,
          };
        } else {
          disasterChallengeOutcome = {
            titleFa: state.disasterChallenge.titleFa,
            completed: false,
            rewardCoins: 0,
          };
        }
        state.disasterChallenge = null;
      }

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
      } else if (ended === 'earthquake') {
        eventEndedNotice = 'لرزش زمین آرام گرفت و جزیره استوار شد';
      } else if (ended === 'lightning_storm') {
        eventEndedNotice = 'توفان صاعقه فروکش کرد و آسمان آرام شد';
      }
    }
  } else {
    state.nextEventTimer -= dt;
    if (state.nextEventTimer <= 0) {
      state.eventTick += 1;
      const evRoll =
        Math.abs(Math.sin(state.eventTick * 17.31 + state.dayCount * 3.17) * 43758.5453) % 1;
      let chosen: Exclude<WorldEventKind, 'none'>;
      if (evRoll < 0.12) chosen = 'low_tide';
      else if (evRoll < 0.25) chosen = 'tsunami';
      else if (evRoll < 0.38) chosen = 'volcano_eruption';
      else if (evRoll < 0.5) chosen = 'meteor_shower';
      else if (evRoll < 0.62) chosen = 'fish_frenzy';
      else if (evRoll < 0.74) chosen = 'earthquake';
      else if (evRoll < 0.86) chosen = 'lightning_storm';
      else if (evRoll < 0.93) chosen = 'autumn_breeze';
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

  // 0D. Localized Disaster Hazards Around Player (Storm Lightning, Lightning Storm, Earthquake Rockfalls, Volcano Lava Boulders, Meteor Shower)
  const hazardStrikes: SurvivalStepResult['hazardStrikes'] = [];
  let damageTaken = 0;
  let campfireExtinguishedNotice: string | undefined;

  const activeHazardKind: HazardImpact['kind'] | null =
    state.eventPhase === 'active' && state.activeEvent === 'volcano_eruption'
      ? 'lava'
      : state.eventPhase === 'active' && state.activeEvent === 'meteor_shower'
        ? 'meteor'
        : state.eventPhase === 'active' && state.activeEvent === 'earthquake'
          ? 'boulder'
          : state.eventPhase === 'active' && state.activeEvent === 'lightning_storm'
            ? 'lightning'
            : state.weather === 'storm' && state.postEventBreatherTimer <= 0
              ? 'lightning'
              : null;

  if (activeHazardKind && state.gameOutcome === 'playing') {
    state.hazardSpawnTimer -= dt;
    if (state.hazardSpawnTimer <= 0 && state.hazardImpacts.length < 4) {
      state.hazardSpawnTimer =
        state.activeEvent === 'lightning_storm'
          ? 1.08
          : activeHazardKind === 'boulder'
            ? 1.15
            : activeHazardKind === 'lava'
              ? 1.25
              : activeHazardKind === 'meteor'
                ? 1.25
                : 3.1;
      const spawnBatch =
        state.eventPhase === 'active' &&
        (state.activeEvent === 'earthquake' || state.activeEvent === 'volcano_eruption') &&
        state.hazardImpacts.length <= 2
          ? 2
          : 1;
      for (let b = 0; b < spawnBatch; b += 1) {
        const ang = randomFn() * Math.PI * 2;
        const dist = b === 0 ? 0.6 + randomFn() * 3.8 : 2.6 + randomFn() * 5.4;
        const hx = playerX + Math.cos(ang) * dist;
        const hz = playerZ + Math.sin(ang) * dist;
        const delay = activeHazardKind === 'lava' || activeHazardKind === 'meteor' ? 1.12 : 1.02;
        state.hazardImpacts.push({
          id: `hz-${Date.now()}-${b}-${Math.floor(randomFn() * 10000)}`,
          kind: activeHazardKind,
          x: hx,
          z: hz,
          radius: activeHazardKind === 'boulder' ? 2.55 : activeHazardKind === 'lava' ? 2.45 : 2.3,
          delayTimer: delay,
          maxDelay: delay,
          resolved: false,
          resolveTimer: 0.48,
        });
      }
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
        let dmg = hitPlayer
          ? h.kind === 'lava'
            ? 22
            : h.kind === 'boulder'
              ? 19
              : h.kind === 'lightning'
                ? 20
                : 18
          : 0;
        if (hitPlayer) {
          if (state.shellArmorCharges > 0) {
            dmg = Math.ceil(dmg * 0.5);
            state.shellArmorCharges -= 1;
          }
          state.energy = Math.max(0, state.energy - dmg);
          damageTaken += dmg;
          if (state.disasterChallenge && state.disasterChallenge.status === 'active') {
            state.disasterChallenge.hitsTaken += 1;
            state.disasterChallenge.status = 'failed';
          }
        } else {
          // Reward dodging natural disaster strike!
          state.coins += 1;
          pushXp(3);
          if (state.disasterChallenge && state.disasterChallenge.status === 'active') {
            state.disasterChallenge.dodgedCount += 1;
          }
        }
        // Molten magma bombs leave lingering burning lava pools for several seconds!
        if (h.kind === 'lava' && state.activeEvent === 'volcano_eruption') {
          if (state.lavaPools.length >= 6) state.lavaPools.shift();
          state.lavaPools.push({ x: h.x, z: h.z, radius: 1.65, timer: 4.0 });
        }
        // Lightning storm squall can douse an unsheltered low campfire!
        if (
          h.kind === 'lightning' &&
          state.activeEvent === 'lightning_storm' &&
          state.eventPhase === 'active' &&
          !state.buildings.shelter &&
          state.fireLit &&
          state.fireLevel <= 2
        ) {
          const dCamp = Math.hypot(
            h.x - CONFIG.ISLAND.CAMPFIRE.CX,
            h.z - CONFIG.ISLAND.CAMPFIRE.CZ
          );
          if (dCamp < 10.5) {
            state.fireLit = false;
            campfireExtinguishedNotice =
              'توفان صاعقه آتش بدون پناهگاه کمپ را خاموش کرد!';
          }
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

  // Step lingering molten lava scorch pools from volcano eruption
  for (let i = state.lavaPools.length - 1; i >= 0; i -= 1) {
    const lp = state.lavaPools[i];
    lp.timer -= dt;
    if (lp.timer <= 0) {
      state.lavaPools.splice(i, 1);
      continue;
    }
    const distPool = Math.hypot(playerX - lp.x, playerZ - lp.z);
    if (distPool <= lp.radius) {
      const burn = 9.5 * dt;
      state.energy = Math.max(0, state.energy - burn);
      damageTaken += burn;
      if (state.disasterChallenge && state.disasterChallenge.status === 'active') {
        state.disasterChallenge.hitsTaken += 1;
        state.disasterChallenge.status = 'failed';
      }
    }
  }

  // Tsunami surge drains energy if player stays caught in deep floodwater & douses unsheltered fire
  if (
    state.eventPhase === 'active' &&
    state.activeEvent === 'tsunami' &&
    state.seaLevelOffset >= 1.78 &&
    !state.buildings.shelter &&
    state.fireLit
  ) {
    state.fireLit = false;
    state.fireLevel = Math.max(0, state.fireLevel - 1);
    campfireExtinguishedNotice =
      'موج عظیم سونامی آتش کمپ بی‌سرپناه را خاموش کرد! (پناهگاه از آتش محافظت می‌کند)';
  }
  if (
    state.eventPhase === 'active' &&
    state.activeEvent === 'tsunami' &&
    isSwimming
  ) {
    if (state.disasterChallenge?.event === 'tsunami' && state.disasterChallenge.status === 'active') {
      state.disasterChallenge.status = 'failed';
    }
    if (state.tsunamiDamageTimer <= 0) {
      state.tsunamiDamageTimer = 0.95;
      state.energy = Math.max(0, state.energy - 12);
      damageTaken += 12;
    }
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
  const auraRadius = state.fireLit
    ? camp.AURA_RADIUS + Math.max(0, state.fireLevel - 1) * 1.1
    : camp.AURA_RADIUS;
  const distCamp = Math.hypot(playerX - camp.CX, playerZ - camp.CZ);
  state.nearCampfire = distCamp <= auraRadius;

  let depositedToCamp = 0;
  let earnedCoins = 0;
  let cookedCount = 0;
  let roastedBananaCount = 0;
  let cookedMeatCount = 0;

  if (state.nearCampfire) {
    if (state.fireLit && state.energy < state.maxEnergy) {
      const shelterMult = state.buildings.shelter ? 1.35 : 1.0;
      const fireMult =
        state.fireLevel >= 5
          ? 2.2
          : 1 + Math.max(0, state.fireLevel - 1) * 0.25 + state.skills.pyromancer * 0.15;
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

    const canRoastBanana = state.fireLit && state.fireLevel >= 2 && state.carried.banana > 0;
    if (state.fireLit && (state.carried.fish > 0 || state.carried.meat > 0 || canRoastBanana)) {
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
  }

  if (!state.nearCampfire || !state.fireLit) {
    if (state.energy > 1) {
      let drainRate = 0;
      if (moved) {
        drainRate += isSwimming
          ? CONFIG.SURVIVAL.SWIM_ENERGY_DRAIN_PER_SEC
          : CONFIG.SURVIVAL.WALK_ENERGY_DRAIN_PER_SEC;
      }
      if (state.isNight && !state.buildings.shelter) {
        drainRate += CONFIG.SURVIVAL.NIGHT_COLD_DRAIN_PER_SEC * (state.torchTimer > 0 ? 0.3 : 1.0);
      }
      if (drainRate > 0) {
        state.energy = Math.max(1, state.energy - drainRate * dt);
      }
    }
  }

  // Active snake/scorpion venom DoT (warmth of Lv 3+ lit campfire gently burns off poison)
  const wildlifeDmgMult = CONFIG.WILDLIFE_DIFFICULTY_MULTIPLIERS[state.wildlifeDifficulty ?? 'normal'];
  if (state.venomTimer > 0) {
    const campCleanse = state.nearCampfire && state.fireLit && state.fireLevel >= 3;
    state.venomTimer = Math.max(0, state.venomTimer - dt * (campCleanse ? 2.5 : 1.0));
    const venomDrain =
      CONFIG.SURVIVAL.VENOM_DRAIN_PER_SEC * wildlifeDmgMult * dt * (campCleanse ? 0.25 : 1.0);
    state.energy = Math.max(0, state.energy - venomDrain);
    damageTaken += venomDrain;
  }

  // 2B. Step Wildlife AI & Predator Windup/Strike Attacks
  let discoveredSpecies: string[] = [];
  let predatorStrikes: PredatorStrikeEvent[] = [];
  let poisonedSec: number | undefined;
  if (world) {
    const wRes = stepWildlifeSystem(
      state.wildlife,
      dt,
      state.isNight,
      playerX,
      playerZ,
      state.nearCampfire,
      state.fireLit ? state.fireLevel : 0,
      state.hasFireSpear,
      world,
      state.activeHuntActorId,
      state.torchTimer > 0,
      state.timeOfDay,
      state.phase
    );
    discoveredSpecies = wRes.discoveredNew;
    state.predatorAlert = wRes.predatorNearby;
    predatorStrikes = wRes.predatorStrikes;
    for (const ps of wRes.predatorStrikes) {
      let dmg = Math.max(1, Math.round(ps.damage * wildlifeDmgMult));
      if (state.shellArmorCharges > 0) {
        dmg = Math.ceil(dmg * 0.5);
        state.shellArmorCharges -= 1;
      }
      state.energy = Math.max(0, state.energy - dmg);
      damageTaken += dmg;
      if (ps.venomSec && ps.venomSec > 0) {
        state.venomTimer = Math.max(state.venomTimer, ps.venomSec);
        poisonedSec = Math.max(poisonedSec ?? 0, ps.venomSec);
      }
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

  const getNodeDist = (n: HarvestNodeState): number => {
    const dShore = Math.hypot(playerX - n.x, playerZ - n.z);
    if (n.propKind === 'fishing' && n.waterX !== undefined && n.waterZ !== undefined) {
      return Math.min(dShore, Math.hypot(playerX - n.waterX, playerZ - n.waterZ));
    }
    return dShore;
  };

  let bestNode: HarvestNodeState | null = null;
  let bestNodeDist = Infinity;
  for (const node of state.nodes) {
    if (node.cooldownRemaining > 0) continue;
    const d = getNodeDist(node);
    if (d <= node.range && d < bestNodeDist) {
      bestNodeDist = d;
      bestNode = node;
    }
  }

  let bestPrey: AnimalActorState | null = null;
  let bestPreyScore = Infinity;
  const bowEquipped = state.equippedWeapon === 'bow' && state.unlockedWeapons.bow;
  const huntRange = bowEquipped
    ? CONFIG.SURVIVAL.HARVEST_RANGE_BOW
    : state.hasSpear
      ? CONFIG.SURVIVAL.HARVEST_RANGE_COMBAT
      : Math.max(CONFIG.SURVIVAL.HARVEST_RANGE_HUNT, CONFIG.SURVIVAL.HARVEST_RANGE_COMBAT * 0.92);
  for (const actor of state.wildlife.actors) {
    if (!actor.visible || actor.koTimer > 0 || actor.respawnTimer > 0) continue;
    const spec = getAnimalSpecies(actor.speciesId);
    const hostile = isHostilePredatorActor(actor);
    if (!spec || (!spec.huntable && !spec.fishable && !hostile)) continue;
    const effRange = spec.fishable
      ? Math.max(huntRange, CONFIG.SURVIVAL.HARVEST_RANGE_FISHING)
      : bowEquipped
        ? huntRange
        : hostile
          ? Math.max(huntRange, CONFIG.SURVIVAL.HARVEST_RANGE_COMBAT)
          : state.hasSpear
            ? CONFIG.SURVIVAL.HARVEST_RANGE_HUNT
            : CONFIG.SURVIVAL.HARVEST_RANGE_HUNT * 0.84;
    const d = Math.hypot(playerX - actor.x, playerZ - actor.z);
    // Prioritize hostile attackers over passive prey (especially when backpack is full) so defense always takes precedence
    const hostilePriority = hostile
      ? d <= CONFIG.SURVIVAL.HARVEST_RANGE_COMBAT
        ? 2.5
        : !backpackHasRoom
          ? 6.0
          : 1.2
      : 0;
    const score = d - hostilePriority;
    if (d <= effRange && score < bestPreyScore) {
      bestPreyScore = score;
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

  // Check nearby uninspected Mystery Spot
  let bestMystery: MysterySpot | null = null;
  let bestMysteryDist = Infinity;
  for (const mys of state.mysterySpots) {
    if (state.discoveredMysteries.includes(mys.id)) continue;
    const d = Math.hypot(playerX - mys.x, playerZ - mys.z);
    if (d <= CONFIG.SURVIVAL.HARVEST_RANGE_MYSTERY && d < bestMysteryDist) {
      bestMysteryDist = d;
      bestMystery = mys;
    }
  }

  // Check nearby uninspected Ancient Bone Shrine & Crash Wreck
  let bestBone: AncientBoneSite | null = null;
  let bestBoneDist = Infinity;
  for (const bone of state.ancientBoneSites) {
    if (state.inspectedBones.includes(bone.id)) continue;
    const d = Math.hypot(playerX - bone.x, playerZ - bone.z);
    if (d <= CONFIG.SURVIVAL.HARVEST_RANGE_BONE && d < bestBoneDist) {
      bestBoneDist = d;
      bestBone = bone;
    }
  }
  const nearWreck =
    !state.wreckLooted &&
    state.wreckSite &&
    Math.hypot(playerX - state.wreckSite.x, playerZ - state.wreckSite.z) <=
      CONFIG.SURVIVAL.HARVEST_RANGE_WRECK;
  const templeX = CONFIG.ISLAND.SHIPWRECK.HULL_CX;
  const templeZ = CONFIG.ISLAND.SHIPWRECK.HULL_CZ;
  const nearTempleDoor =
    !state.templeRelicClaimed &&
    Math.hypot(playerX - templeX, playerZ - templeZ) <= CONFIG.SURVIVAL.HARVEST_RANGE_TEMPLE;
  const canIgniteHere =
    !state.fireLit && distCamp <= camp.COLLIDER_R + 1.95;

  const activeThreatInMelee = Boolean(
    bestPrey &&
    isHostilePredatorActor(bestPrey) &&
    Math.hypot(playerX - bestPrey.x, playerZ - bestPrey.z) <= CONFIG.SURVIVAL.HARVEST_RANGE_COMBAT &&
    (bestPrey.attackState !== 'idle' ||
      Boolean(bestPrey.enraged) ||
      Math.hypot(playerX - bestPrey.x, playerZ - bestPrey.z) <= 2.9)
  );

  // Compute focused target (priority: Active Threat -> Pad -> Secret -> Temple Door -> Wreck -> Bone -> Built Boat Voyage -> Prey in bow range -> Node -> Melee Prey -> Campfire Ignite)
  let focused: FocusedTargetInfo | null = null;
  if (activeThreatInMelee && bestPrey && !bowEquipped) {
    const spec = getAnimalSpecies(bestPrey.speciesId);
    const maxHp = bestPrey.maxHp ?? getSpeciesMaxHp(bestPrey.speciesId);
    const hp = bestPrey.hp ?? maxHp;
    focused = {
      kind: 'prey',
      id: bestPrey.id,
      action: 'hunt',
      labelFa:
        hp < maxHp
          ? `دفاع و نبرد با ${spec?.nameFa ?? 'دشمن'} (${hp}/${maxHp})`
          : `دفاع و نبرد با ${spec?.nameFa ?? 'دشمن'}`,
      x: bestPrey.x,
      y: bestPrey.y,
      z: bestPrey.z,
      blockedReason:
        state.energy < CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT * 0.5 ? 'low_energy' : undefined,
    };
  } else if (closestPad) {
    const cost = CONFIG.SURVIVAL.BUILD_COSTS[closestPad.id];
    const boatNeedsFire = closestPad.id === 'boat' && (!state.fireLit || state.fireLevel < 5);
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
  } else if (bestMystery) {
    focused = {
      kind: 'mystery',
      id: bestMystery.id,
      action: 'mystery_open',
      labelFa: `بررسی ${bestMystery.nameFa} (پاداش یا خطر!)`,
      x: bestMystery.x,
      y: bestMystery.y,
      z: bestMystery.z,
    };
  } else if (nearTempleDoor) {
    const totalBones = Math.max(1, state.ancientBoneSites.length);
    const hasAllBones = state.inspectedBones.length >= totalBones;
    focused = {
      kind: 'temple_door',
      id: 'buried_temple_door',
      action: 'temple_open',
      labelFa: hasAllBones
        ? 'گشودن درب معبد سنگی و دریافت آیتم مخفی'
        : `درب معبد قفل است (${state.inspectedBones.length}/${totalBones} استخوان)`,
      x: templeX,
      y: 0.4,
      z: templeZ,
      blockedReason: hasAllBones ? undefined : 'need_bones',
    };
  } else if (nearWreck && state.wreckSite) {
    focused = {
      kind: 'wreck',
      id: 'airplane_wreck',
      action: 'salvage',
      labelFa: 'جست‌وجوی لاشه هواپیما (+چوب، سکه و پادزهر)',
      x: state.wreckSite.x,
      y: state.wreckSite.y,
      z: state.wreckSite.z,
    };
  } else if (bestBone) {
    focused = {
      kind: 'bone_shrine',
      id: bestBone.id,
      action: 'inspect',
      labelFa: `بررسی ${bestBone.nameFa}`,
      x: bestBone.x,
      y: bestBone.y,
      z: bestBone.z,
    };
  } else if (builtBoatPad) {
    const canWinVoyage = state.playerLevel >= CONFIG.SURVIVAL.VICTORY_MIN_LEVEL;
    focused = {
      kind: 'boat_voyage',
      id: 'boat_voyage',
      action: 'voyage',
      labelFa: canWinVoyage
        ? 'سفر پیروزمندانه به خانه با قایق'
        : state.boatVoyageCooldown > 0
          ? `آماده‌سازی سفر دریایی (${Math.ceil(state.boatVoyageCooldown)} ث)`
          : 'سفر دریایی با قایق (+سکه و ماهی)',
      x: builtBoatPad.x,
      y: builtBoatPad.y,
      z: builtBoatPad.z,
      blockedReason: canWinVoyage ? undefined : state.boatVoyageCooldown > 0 ? 'cooldown' : undefined,
    };
  } else if (bowEquipped && bestPrey) {
    const spec = getAnimalSpecies(bestPrey.speciesId);
    const isHostile = isHostilePredatorActor(bestPrey);
    focused = {
      kind: 'prey',
      id: bestPrey.id,
      action: 'bow_hunt',
      labelFa: `${isHostile ? 'نبرد با کمان' : 'شکار با کمان'}: ${spec?.nameFa ?? 'جانور'}`,
      x: bestPrey.x,
      y: bestPrey.y,
      z: bestPrey.z,
      blockedReason: !isHostile && !backpackHasRoom
        ? 'backpack_full'
        : state.energy < CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT
          ? 'low_energy'
          : undefined,
    };
  } else if (bestPrey && isHostilePredatorActor(bestPrey) && Math.hypot(playerX - bestPrey.x, playerZ - bestPrey.z) <= CONFIG.SURVIVAL.HARVEST_RANGE_COMBAT) {
    const spec = getAnimalSpecies(bestPrey.speciesId);
    const maxHp = bestPrey.maxHp ?? getSpeciesMaxHp(bestPrey.speciesId);
    const hp = bestPrey.hp ?? maxHp;
    focused = {
      kind: 'prey',
      id: bestPrey.id,
      action: 'hunt',
      labelFa:
        hp < maxHp
          ? `نبرد با ${spec?.nameFa ?? 'دشمن'} (${hp}/${maxHp})`
          : `نبرد با ${spec?.nameFa ?? 'دشمن'}`,
      x: bestPrey.x,
      y: bestPrey.y,
      z: bestPrey.z,
      blockedReason:
        state.energy < CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT * 0.5 ? 'low_energy' : undefined,
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
    const isFishActor = Boolean(spec?.fishable);
    const hostile = isHostilePredatorActor(bestPrey);
    const needsSpear = Boolean(!isFishActor && !hostile && spec?.requiresSpear && !state.hasSpear);
    const fishAct: SurvivalActionKind =
      state.equippedWeapon === 'spear' && state.hasSpear ? 'spear_fish' : 'cast_fish';
    focused = {
      kind: 'prey',
      id: bestPrey.id,
      action: isFishActor ? fishAct : 'hunt',
      labelFa: isFishActor
        ? `صید ${spec?.nameFa ?? 'ماهی'}`
        : hostile
          ? `نبرد با ${spec?.nameFa ?? 'شکارچی'}`
          : `شکار ${spec?.nameFa ?? 'جانور'}`,
      x: bestPrey.x,
      y: bestPrey.y,
      z: bestPrey.z,
      blockedReason:
        !hostile && !backpackHasRoom
          ? 'backpack_full'
          : needsSpear
            ? 'need_spear'
            : state.energy < (hostile ? CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT * 0.5 : CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT)
              ? 'low_energy'
              : undefined,
    };
  } else if (canIgniteHere) {
    const needCost = CONFIG.SURVIVAL.FIRE_IGNITE_WOOD_COST;
    focused = {
      kind: 'campfire_ignite',
      id: 'campfire_ignite',
      action: 'cook',
      labelFa: `روشن کردن آتش کمپ (${needCost} چوب)`,
      x: camp.CX,
      y: 0,
      z: camp.CZ,
      blockedReason: totalWood < needCost ? 'need_wood' : undefined,
      woodCost: needCost,
    };
  }

  // Override focused target if the player explicitly clicked a specific 3D object in range!
  if (targetRequest) {
    if (targetRequest.kind === 'node') {
      const n = state.nodes.find((item) => item.id === targetRequest.id && item.cooldownRemaining <= 0);
      if (n && getNodeDist(n) <= n.range + 0.65) {
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
          labelFa: n.kind === 'wood' ? 'قطع درخت با تبر' : n.kind === 'fish' ? 'صید ماهی' : 'جمع‌آوری منبع',
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
      const hostile = a ? isHostilePredatorActor(a) : false;
      const effRange = spec?.fishable
        ? Math.max(huntRange, CONFIG.SURVIVAL.HARVEST_RANGE_FISHING)
        : hostile
          ? Math.max(huntRange, CONFIG.SURVIVAL.HARVEST_RANGE_COMBAT)
          : huntRange;
      if (a && spec && (spec.huntable || spec.fishable || hostile) && Math.hypot(playerX - a.x, playerZ - a.z) <= effRange + 0.95) {
        const isFishActor = Boolean(spec.fishable);
        const needsSpear = Boolean(!isFishActor && !hostile && !bowEquipped && spec.requiresSpear && !state.hasSpear);
        const fishAct: SurvivalActionKind =
          state.equippedWeapon === 'spear' && state.hasSpear ? 'spear_fish' : 'cast_fish';
        focused = {
          kind: 'prey',
          id: a.id,
          action: isFishActor ? fishAct : bowEquipped ? 'bow_hunt' : 'hunt',
          labelFa: isFishActor
            ? `صید ${spec.nameFa}`
            : hostile
              ? `نبرد با ${spec.nameFa}`
              : `شکار ${spec.nameFa}`,
          x: a.x,
          y: a.y,
          z: a.z,
          blockedReason:
            !hostile && !backpackHasRoom
              ? 'backpack_full'
              : needsSpear
                ? 'need_spear'
                : state.energy < (hostile ? CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT * 0.5 : CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT)
                  ? 'low_energy'
                  : undefined,
        };
      }
    } else if (targetRequest.kind === 'pad') {
      const p = state.buildPads.find((pad) => pad.id === targetRequest.id && !state.buildings[pad.id]);
      if (p && Math.hypot(playerX - p.x, playerZ - p.z) <= CONFIG.SURVIVAL.HARVEST_RANGE_BUILD + 0.5) {
        const cost = CONFIG.SURVIVAL.BUILD_COSTS[p.id];
        const boatNeedsFire = p.id === 'boat' && (!state.fireLit || state.fireLevel < 5);
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
    } else if (targetRequest.kind === 'mystery') {
      const mys = state.mysterySpots.find(
        (m) => m.id === targetRequest.id && !state.discoveredMysteries.includes(m.id)
      );
      if (mys && Math.hypot(playerX - mys.x, playerZ - mys.z) <= CONFIG.SURVIVAL.HARVEST_RANGE_MYSTERY + 0.5) {
        focused = {
          kind: 'mystery',
          id: mys.id,
          action: 'mystery_open',
          labelFa: `بررسی ${mys.nameFa} (پاداش یا خطر!)`,
          x: mys.x,
          y: mys.y,
          z: mys.z,
        };
      }
    } else if (targetRequest.kind === 'wreck' && state.wreckSite && !state.wreckLooted) {
      if (Math.hypot(playerX - state.wreckSite.x, playerZ - state.wreckSite.z) <= CONFIG.SURVIVAL.HARVEST_RANGE_WRECK + 0.8) {
        focused = {
          kind: 'wreck',
          id: 'airplane_wreck',
          action: 'salvage',
          labelFa: 'جست‌وجوی لاشه هواپیما',
          x: state.wreckSite.x,
          y: state.wreckSite.y,
          z: state.wreckSite.z,
        };
      }
    } else if (targetRequest.kind === 'bone_shrine') {
      const b = state.ancientBoneSites.find(
        (site) => site.id === targetRequest.id && !state.inspectedBones.includes(site.id)
      );
      if (b && Math.hypot(playerX - b.x, playerZ - b.z) <= CONFIG.SURVIVAL.HARVEST_RANGE_BONE + 0.6) {
        focused = {
          kind: 'bone_shrine',
          id: b.id,
          action: 'inspect',
          labelFa: `بررسی ${b.nameFa}`,
          x: b.x,
          y: b.y,
          z: b.z,
        };
      }
    } else if (targetRequest.kind === 'temple_door' && !state.templeRelicClaimed) {
      if (Math.hypot(playerX - templeX, playerZ - templeZ) <= CONFIG.SURVIVAL.HARVEST_RANGE_TEMPLE + 0.85) {
        const totalBones = Math.max(1, state.ancientBoneSites.length);
        const hasAllBones = state.inspectedBones.length >= totalBones;
        focused = {
          kind: 'temple_door',
          id: 'buried_temple_door',
          action: 'temple_open',
          labelFa: hasAllBones
            ? 'گشودن درب معبد سنگی و دریافت آیتم مخفی'
            : `درب معبد قفل است (${state.inspectedBones.length}/${totalBones} استخوان)`,
          x: templeX,
          y: 0.4,
          z: templeZ,
          blockedReason: hasAllBones ? undefined : 'need_bones',
        };
      }
    } else if (targetRequest.kind === 'campfire_ignite' && !state.fireLit && state.nearCampfire) {
      const needCost = CONFIG.SURVIVAL.FIRE_IGNITE_WOOD_COST;
      focused = {
        kind: 'campfire_ignite',
        id: 'campfire_ignite',
        action: 'cook',
        labelFa: `روشن کردن آتش کمپ (${needCost} چوب)`,
        x: camp.CX,
        y: 0,
        z: camp.CZ,
        blockedReason: totalWood < needCost ? 'need_wood' : undefined,
        woodCost: needCost,
      };
    }
  }

  state.focusedTarget = focused;
  state.backpackFullBlocked = Boolean(focused && focused.blockedReason === 'backpack_full');
  state.needSpearBlocked = false;
  state.needSpearHuntBlocked = Boolean(focused && focused.blockedReason === 'need_spear');

  // 4. Weapon Special: Auto-Fishing near water + Hammer AoE Shockwave + Bow Ranged Shot + Active Combat / Interact
  let harvested: SurvivalStepResult['harvested'];
  let fishingMissed: SurvivalStepResult['fishingMissed'];
  let hunted: SurvivalStepResult['hunted'];
  let meleeStrike: SurvivalStepResult['meleeStrike'];
  let builtUpgrade: SurvivalStepResult['builtUpgrade'];
  let openedSecret: SurvivalStepResult['openedSecret'];
  let openedMystery: SurvivalStepResult['openedMystery'];
  let wreckSalvaged: SurvivalStepResult['wreckSalvaged'];
  let boneInspected: SurvivalStepResult['boneInspected'];
  let templeOpened: SurvivalStepResult['templeOpened'];
  let templeLockedNotice: string | undefined;
  let fireLitNow: boolean | undefined;
  let arrowShot: SurvivalStepResult['arrowShot'];
  let hammerSlam: SurvivalStepResult['hammerSlam'];
  let boatVoyageNotice: string | undefined;
  let boatVoyageVictoryReady: boolean | undefined;

  const grantPreyKillRewards = (
    preyActor: AnimalActorState,
    weaponUsed: WeaponId,
    isRanged = false
  ): number => {
    const preySpec = getAnimalSpecies(preyActor.speciesId);
    const bowLvl = state.weaponLevels.bow;
    const spearLvl = state.weaponLevels.spear;
    const baseYield =
      (preySpec?.meatYield ?? 1) +
      (weaponUsed === 'bow' && bowLvl >= 3 ? 1 : 0);
    const amount = Math.min(baseYield, Math.max(0, state.backpackCapacity - getBackpackUsed(state)));
    const cookedDrop =
      state.hasFireSpear ||
      (weaponUsed === 'bow' && bowLvl >= 4) ||
      (weaponUsed === 'spear' && state.hasSpear && spearLvl >= 4);
    if (amount > 0) {
      if (cookedDrop) {
        state.cookedMeat += amount;
      } else {
        state.carried.meat += amount;
        for (let i = 0; i < amount; i += 1) state.carriedStack.push('meat');
      }
    }
    state.huntedCount += 1;
    const hostile = isHostilePredatorActor(preyActor);
    const bonusCoins =
      (hostile || preyActor.category === 'night_predator' ? 4 : 1) +
      (state.weaponLevels[weaponUsed] >= 5 ? 2 : 0);
    state.coins += bonusCoins;
    earnedCoins += bonusCoins;
    pushXp(hostile || preyActor.category === 'night_predator' ? 14 : 9);
    hunted = {
      actorId: preyActor.id,
      speciesId: preyActor.speciesId,
      amount,
      x: preyActor.x,
      y: preyActor.y,
      z: preyActor.z,
      ranged: isRanged,
    };
    return amount;
  };

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

  // 4B. Direct Ranged Bow Shot or Storm Hammer Slam or Active Combat from click/tap anywhere
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
        if (!spec?.huntable && !isHostilePredatorActor(a)) continue;
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
    state.combatSwingTimer = 0.32;
    pushWeaponXp('bow', targetActor ? 10 : 3);

    if (targetActor) {
      const preySpec = getAnimalSpecies(targetActor.speciesId);
      const bowDmg = 2 + (bowLvl >= 3 ? 1 : 0);
      const hitRes = damageAnimalActor(targetActor, bowDmg, playerX, playerZ);
      state.energy = Math.max(0, state.energy - CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT * 0.75);
      meleeStrike = {
        actorId: targetActor.id,
        speciesId: targetActor.speciesId,
        nameFa: preySpec?.nameFa ?? 'جانور',
        damage: bowDmg,
        defeated: hitRes.defeated,
        x: targetActor.x,
        y: targetActor.y,
        z: targetActor.z,
        hp: hitRes.hp,
        maxHp: hitRes.maxHp,
      };
      if (hitRes.defeated) {
        grantPreyKillRewards(targetActor, 'bow', true);
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
      const hammerDmg = 2 + (hammerLvl >= 3 ? 2 : 0);
      for (const actor of state.wildlife.actors) {
        if (!actor.visible || actor.koTimer > 0 || actor.respawnTimer > 0) continue;
        const d = Math.hypot(actor.x - playerX, actor.z - playerZ);
        if (d <= aoeRange) {
          stunnedCount += 1;
          if (isHostilePredatorActor(actor)) {
            const preySpec = getAnimalSpecies(actor.speciesId);
            const hitRes = damageAnimalActor(actor, hammerDmg, playerX, playerZ);
            if (!meleeStrike) {
              meleeStrike = {
                actorId: actor.id,
                speciesId: actor.speciesId,
                nameFa: preySpec?.nameFa ?? 'دشمن',
                damage: hammerDmg,
                defeated: hitRes.defeated,
                x: actor.x,
                y: actor.y,
                z: actor.z,
                hp: hitRes.hp,
                maxHp: hitRes.maxHp,
              };
            }
            if (hitRes.defeated) {
              grantPreyKillRewards(actor, 'hammer', false);
            } else {
              actor.stunTimer = Math.max(actor.stunTimer, CONFIG.SURVIVAL.HAMMER_STUN_SEC + (hammerLvl - 1) * 1.2);
            }
          } else {
            actor.stunTimer = CONFIG.SURVIVAL.HAMMER_STUN_SEC + (hammerLvl - 1) * 1.2;
          }
        }
      }
      state.activeAction = 'hammer_slam';
      state.actionProgress = 1;
      state.combatSwingTimer = 0.36;
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
        const res = openSecretSpot(state, focused.id, playerX, playerZ, randomFn);
        if (res.opened && res.secret) {
          const coinsDelta = res.coinsDelta ?? 0;
          const energyDelta = res.energyDelta ?? 0;
          if (coinsDelta > 0) earnedCoins += coinsDelta;
          if (energyDelta < 0) damageTaken += Math.abs(energyDelta);
          openedSecret = {
            id: res.secret.id,
            nameFa: res.secret.nameFa,
            x: res.secret.x,
            y: res.secret.y,
            z: res.secret.z,
            isTrap: Boolean(res.isTrap),
            energyDelta,
            coinsDelta,
            notice: res.notice ?? res.secret.nameFa,
          };
          state.activeAction = 'secret_open';
          state.actionProgress = 1;
        }
      } else if (focused.kind === 'mystery') {
        const res = inspectMysterySpot(state, focused.id, playerX, playerZ, randomFn);
        if (res.opened && res.mystery) {
          const coinsDelta = res.coinsDelta ?? 0;
          const energyDelta = res.energyDelta ?? 0;
          if (coinsDelta > 0) earnedCoins += coinsDelta;
          if (energyDelta < 0) damageTaken += Math.abs(energyDelta);
          if (res.poisonedSec) {
            poisonedSec = Math.max(poisonedSec ?? 0, res.poisonedSec);
          }
          openedMystery = {
            id: res.mystery.id,
            kind: res.mystery.kind,
            nameFa: res.mystery.nameFa,
            x: res.mystery.x,
            y: res.mystery.y,
            z: res.mystery.z,
            isHarmful: Boolean(res.isHarmful),
            energyDelta,
            coinsDelta,
            poisonedSec: res.poisonedSec,
            notice: res.notice ?? res.mystery.nameFa,
          };
          state.activeAction = 'mystery_open';
          state.actionProgress = 1;
        }
      } else if (focused.kind === 'wreck') {
        const res = salvagePlaneWreck(state, playerX, playerZ);
        if (res.salvaged && state.wreckSite) {
          earnedCoins += 8;
          wreckSalvaged = {
            x: state.wreckSite.x,
            y: state.wreckSite.y,
            z: state.wreckSite.z,
          };
          state.activeAction = 'salvage';
          state.actionProgress = 1;
        }
      } else if (focused.kind === 'bone_shrine') {
        const res = inspectAncientBones(state, focused.id, playerX, playerZ);
        if (res.inspected && res.bone) {
          earnedCoins += 5;
          boneInspected = {
            id: res.bone.id,
            nameFa: res.bone.nameFa,
            loreFa: res.bone.loreFa,
            x: res.bone.x,
            y: res.bone.y,
            z: res.bone.z,
          };
          state.activeAction = 'inspect';
          state.actionProgress = 1;
        }
      } else if (focused.kind === 'temple_door') {
        const res = openBuriedTempleDoor(state, playerX, playerZ);
        if (res.opened) {
          earnedCoins += 40;
          templeOpened = {
            x: templeX,
            y: 0.4,
            z: templeZ,
            notice: res.notice,
          };
          state.activeAction = 'temple_open';
          state.actionProgress = 1;
        }
      } else if (focused.kind === 'campfire_ignite') {
        if (lightCampfire(state)) {
          earnedCoins += 2;
          fireLitNow = true;
          state.activeAction = 'cook';
          state.actionProgress = 1;
        }
      } else if (focused.kind === 'boat_voyage') {
        if (state.playerLevel >= CONFIG.SURVIVAL.VICTORY_MIN_LEVEL) {
          boatVoyageVictoryReady = true;
        } else {
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
        }
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
          const bowDmg = 2 + (bowLvl >= 3 ? 1 : 0);
          const hitRes = damageAnimalActor(preyActor, bowDmg, playerX, playerZ);
          state.energy = Math.max(0, state.energy - CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT * 0.8);
          pushWeaponXp('bow', 11);
          arrowShot = {
            fromX: playerX,
            fromY: 1.15,
            fromZ: playerZ,
            toX: preyActor.x,
            toY: preyActor.y + 0.45,
            toZ: preyActor.z,
          };
          meleeStrike = {
            actorId: preyActor.id,
            speciesId: preyActor.speciesId,
            nameFa: preySpec.nameFa,
            damage: bowDmg,
            defeated: hitRes.defeated,
            x: preyActor.x,
            y: preyActor.y,
            z: preyActor.z,
            hp: hitRes.hp,
            maxHp: hitRes.maxHp,
          };
          if (hitRes.defeated) {
            grantPreyKillRewards(preyActor, 'bow', true);
          }
          // Bow Lv 3+ double-arrow volley hits a second nearby huntable prey if within 4.5m!
          if (bowLvl >= 3) {
            const secondPrey = state.wildlife.actors.find(
              (a) =>
                a.id !== preyActor.id &&
                a.visible &&
                a.koTimer <= 0 &&
                a.respawnTimer <= 0 &&
                (getAnimalSpecies(a.speciesId)?.huntable || isHostilePredatorActor(a)) &&
                Math.hypot(a.x - preyActor.x, a.z - preyActor.z) <= 4.5
            );
            if (secondPrey) {
              const secHit = damageAnimalActor(secondPrey, bowDmg, playerX, playerZ);
              if (secHit.defeated) {
                state.huntedCount += 1;
                state.coins += 2;
                earnedCoins += 2;
              }
            }
          }
          state.activeAction = 'bow_hunt';
          state.actionTargetX = preyActor.x;
          state.actionTargetZ = preyActor.z;
          state.actionProgress = 1;
          state.combatSwingTimer = 0.32;
        } else if (preyActor && isHostilePredatorActor(preyActor) && !preySpec?.fishable) {
          // Active instant melee combat strike against hostile attackers!
          if (state.meleeCombatCooldown <= 0) {
            const activeWeapon = state.equippedWeapon === 'bow' ? 'axe' : state.equippedWeapon;
            const dmg =
              activeWeapon === 'spear' && state.hasSpear
                ? 2 + (state.hasFireSpear ? 1 : 0) + (state.weaponLevels.spear >= 4 ? 1 : 0)
                : activeWeapon === 'hammer' && state.unlockedWeapons.hammer
                  ? 2 + (state.weaponLevels.hammer >= 3 ? 1 : 0)
                  : 1 + (state.weaponLevels.axe >= 3 ? 1 : 0);
            const hitRes = damageAnimalActor(preyActor, dmg, playerX, playerZ);
            state.meleeCombatCooldown = CONFIG.SURVIVAL.MELEE_STRIKE_COOLDOWN_SEC;
            state.energy = Math.max(1, state.energy - CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT * 0.5);
            state.activeBuildId = null;
            state.activeNodeId = null;
            state.activeHuntActorId = null;
            state.activeAction = 'hunt';
            state.actionTargetX = preyActor.x;
            state.actionTargetZ = preyActor.z;
            state.actionProgress = 1;
            state.combatSwingTimer = 0.32;
            const xpWeapon: WeaponId =
              activeWeapon === 'spear' && state.hasSpear
                ? 'spear'
                : activeWeapon === 'hammer' && state.unlockedWeapons.hammer
                  ? 'hammer'
                  : 'axe';
            pushWeaponXp(xpWeapon, hitRes.defeated ? 13 : 7);
            meleeStrike = {
              actorId: preyActor.id,
              speciesId: preyActor.speciesId,
              nameFa: preySpec?.nameFa ?? 'دشمن',
              damage: dmg,
              defeated: hitRes.defeated,
              x: preyActor.x,
              y: preyActor.y,
              z: preyActor.z,
              hp: hitRes.hp,
              maxHp: hitRes.maxHp,
            };
            if (hitRes.defeated) {
              grantPreyKillRewards(preyActor, xpWeapon, false);
            }
          }
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
    } else if (focused && focused.kind === 'temple_door' && focused.blockedReason === 'need_bones') {
      const res = openBuriedTempleDoor(state, playerX, playerZ);
      templeLockedNotice = res.notice;
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
      getNodeDist(node) > node.range + 0.65
    ) {
      state.activeNodeId = null;
      state.harvestProgress = 0;
      state.actionProgress = 0;
    }
  }

  if (state.activeHuntActorId) {
    const prey = state.wildlife.actors.find((a) => a.id === state.activeHuntActorId);
    const spec = prey ? getAnimalSpecies(prey.speciesId) : undefined;
    const effRange = spec?.fishable
      ? Math.max(huntRange, CONFIG.SURVIVAL.HARVEST_RANGE_FISHING)
      : huntRange;
    if (
      !prey ||
      !prey.visible ||
      prey.koTimer > 0 ||
      prey.respawnTimer > 0 ||
      !spec ||
      !backpackHasRoom ||
      (!spec.fishable && spec.requiresSpear && !state.hasSpear) ||
      state.energy < CONFIG.SURVIVAL.HARVEST_ENERGY_COST_HUNT ||
      Math.hypot(playerX - prey.x, playerZ - prey.z) > effRange + 1.0
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
          const baitBonus = state.baitCharges > 0 ? 1 : 0;
          if (state.baitCharges > 0) state.baitCharges -= 1;
          rawYield = 1 + rainBonus + frenzyBonus + pierOrFireBonus + spearLv3Bonus + baitBonus;
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
    const isFishActor = Boolean(spec.fishable);
    state.lowEnergyBlocked = false;
    state.activeAction = isFishActor
      ? state.equippedWeapon === 'spear' && state.hasSpear
        ? 'spear_fish'
        : 'cast_fish'
      : 'hunt';
    state.actionTargetX = prey.x;
    state.actionTargetZ = prey.z;

    if (isFishActor) {
      const speedMult = getFishingSpeedMultiplier(state) * (state.equippedWeapon === 'spear' && state.hasSpear ? 1.2 : 1.0);
      state.huntProgress += (dt * speedMult) / Math.max(0.2, CONFIG.SURVIVAL.HARVEST_DURATION_FISHING);
      state.actionProgress = Math.min(1, state.huntProgress);

      if (state.huntProgress >= 1) {
        const rainBonus = state.weather === 'rain' || state.weather === 'storm' ? 1 : 0;
        const frenzyBonus = state.activeEvent === 'fish_frenzy' && state.eventPhase === 'active' ? 1 : 0;
        const rawYield =
          (prey.speciesId === 'golden_snapper' ? 2 : 1) + rainBonus + frenzyBonus;
        const amount = Math.min(rawYield, freeSlots);
        state.carried.fish += amount;
        for (let i = 0; i < amount; i += 1) {
          state.carriedStack.push('fish');
        }
        state.energy = Math.max(1, state.energy - CONFIG.SURVIVAL.HARVEST_ENERGY_COST_FISHING);
        const fishCoins = prey.speciesId === 'golden_snapper' ? 4 : 2;
        state.coins += fishCoins;
        earnedCoins += fishCoins;
        pushXp(10);
        if (state.hasSpear) pushWeaponXp('spear', 10);
        markAnimalHunted(prey);
        harvested = {
          nodeId: prey.id,
          kind: 'fish',
          propKind: 'fishing',
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
    } else {
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
    }
  } else if (
    state.combatSwingTimer <= 0 &&
    !arrowShot &&
    !hammerSlam &&
    !openedSecret &&
    !openedMystery &&
    !wreckSalvaged &&
    !boneInspected &&
    !templeOpened &&
    !fireLitNow
  ) {
    const canRoastAny =
      state.nearCampfire &&
      state.fireLit &&
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

  // Check Defeat Condition (predator strikes / disaster hazards / venom / drowning brought energy to 0!)
  if (state.energy <= 0) {
    state.energy = 0;
    state.gameOutcome = 'defeat';
  }

  const hudChanged =
    Boolean(harvested) ||
    Boolean(fishingMissed) ||
    Boolean(hunted) ||
    Boolean(meleeStrike) ||
    Boolean(builtUpgrade) ||
    Boolean(openedSecret) ||
    Boolean(openedMystery) ||
    Boolean(wreckSalvaged) ||
    Boolean(boneInspected) ||
    Boolean(templeOpened) ||
    Boolean(templeLockedNotice) ||
    Boolean(fireLitNow) ||
    Boolean(poisonedSec) ||
    Boolean(disasterChallengeOutcome) ||
    Boolean(arrowShot) ||
    Boolean(hammerSlam) ||
    Boolean(eventStarted) ||
    Boolean(eventEndedNotice) ||
    Boolean(campfireExtinguishedNotice) ||
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
    state.fireLit !== prevFireLit ||
    Math.ceil(state.venomTimer) !== prevVenomSec ||
    state.antidotes !== prevAntidotes ||
    state.shellArmorCharges !== prevShellArmor ||
    Math.ceil(state.elixirTimer) !== prevElixirSec ||
    Math.ceil(state.torchTimer) !== prevTorchSec ||
    state.baitCharges !== prevBait ||
    state.wreckLooted !== prevWreckLooted ||
    state.inspectedBones.length !== prevBonesFound ||
    state.templeUnlocked !== prevTempleUnlocked ||
    state.templeRelicClaimed !== prevTempleRelicClaimed ||
    (state.disasterChallenge?.status ?? null) !== prevChallengeStatus ||
    (state.disasterChallenge?.dodgedCount ?? 0) !== prevChallengeDodged ||
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
    state.discoveredMysteries.length !== prevMysteriesFound ||
    (state.nearbyPad?.id ?? null) !== prevNearbyPadId ||
    (state.nearbyLandmark?.id ?? null) !== prevNearbyLandmarkId ||
    (state.focusedTarget?.id ?? null) !== prevFocusedId ||
    (state.focusedTarget?.blockedReason ?? null) !== prevFocusedReason;

  return {
    hudChanged,
    harvested,
    fishingMissed,
    hunted,
    meleeStrike,
    arrowShot,
    hammerSlam,
    builtUpgrade,
    openedSecret,
    openedMystery,
    wreckSalvaged,
    boneInspected,
    templeOpened,
    templeLockedNotice,
    fireLitNow,
    poisonedSec,
    disasterChallengeOutcome,
    eventStarted,
    eventEndedNotice,
    campfireExtinguishedNotice,
    boatVoyageNotice,
    boatVoyageVictoryReady,
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

export interface SavedRunSnapshot {
  version: 1;
  savedAt: number;
  mode: GameMode;
  seed: string;
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
  };
  state: {
    carried: SurvivalState['carried'];
    carriedStack: ResourceKind[];
    stashed: SurvivalState['stashed'];
    cookedFish: number;
    roastedBanana: number;
    cookedMeat: number;
    huntedCount: number;
    coins: number;
    energy: number;
    hasSpear: boolean;
    hasFireSpear: boolean;
    equippedWeapon: WeaponId;
    unlockedWeapons: Record<WeaponId, boolean>;
    weaponLevels: Record<WeaponId, number>;
    weaponXp: Record<WeaponId, number>;
    fireLit: boolean;
    fireLevel: number;
    fireStokedCount: number;
    venomTimer: number;
    antidotes: number;
    shellArmorCharges: number;
    elixirTimer: number;
    torchTimer: number;
    baitCharges: number;
    xp: number;
    playerLevel: number;
    playerXp: number;
    playerXpToNext: number;
    skillPoints: number;
    skills: Record<SkillId, number>;
    timeOfDay: number;
    dayCount: number;
    weather: WeatherKind;
    weatherTimer: number;
    groundWetness: number;
    discoveredSecrets: string[];
    discoveredMysteries?: string[];
    inspectedBones: string[];
    wreckLooted: boolean;
    templeUnlocked: boolean;
    templeRelicClaimed: boolean;
    buildings: Record<CampUpgradeId, boolean>;
    discoveredAnimals: string[];
    nodeCooldowns: Record<string, number>;
  };
}

export function exportSavedRunSnapshot(
  state: SurvivalState,
  player: { x: number; y: number; z: number; yaw: number },
  mode: GameMode,
  seed: string
): SavedRunSnapshot {
  const nodeCooldowns: Record<string, number> = {};
  for (const node of state.nodes) {
    if (node.cooldownRemaining > 0.2) {
      nodeCooldowns[node.id] = Number(node.cooldownRemaining.toFixed(2));
    }
  }
  return {
    version: 1,
    savedAt: Date.now(),
    mode,
    seed,
    player: {
      x: Number(player.x.toFixed(3)),
      y: Number(player.y.toFixed(3)),
      z: Number(player.z.toFixed(3)),
      yaw: Number(player.yaw.toFixed(3)),
    },
    state: {
      carried: { ...state.carried },
      carriedStack: [...state.carriedStack],
      stashed: { ...state.stashed },
      cookedFish: state.cookedFish,
      roastedBanana: state.roastedBanana,
      cookedMeat: state.cookedMeat,
      huntedCount: state.huntedCount,
      coins: state.coins,
      energy: Number(state.energy.toFixed(2)),
      hasSpear: state.hasSpear,
      hasFireSpear: state.hasFireSpear,
      equippedWeapon: state.equippedWeapon,
      unlockedWeapons: { ...state.unlockedWeapons },
      weaponLevels: { ...state.weaponLevels },
      weaponXp: { ...state.weaponXp },
      fireLit: state.fireLit,
      fireLevel: state.fireLevel,
      fireStokedCount: state.fireStokedCount,
      venomTimer: state.venomTimer,
      antidotes: state.antidotes,
      shellArmorCharges: state.shellArmorCharges,
      elixirTimer: state.elixirTimer,
      torchTimer: state.torchTimer,
      baitCharges: state.baitCharges,
      xp: state.xp,
      playerLevel: state.playerLevel,
      playerXp: state.playerXp,
      playerXpToNext: state.playerXpToNext,
      skillPoints: state.skillPoints,
      skills: { ...state.skills },
      timeOfDay: state.timeOfDay,
      dayCount: state.dayCount,
      weather: state.weather,
      weatherTimer: state.weatherTimer,
      groundWetness: state.groundWetness,
      discoveredSecrets: [...state.discoveredSecrets],
      discoveredMysteries: [...state.discoveredMysteries],
      inspectedBones: [...state.inspectedBones],
      wreckLooted: state.wreckLooted,
      templeUnlocked: state.templeUnlocked,
      templeRelicClaimed: state.templeRelicClaimed,
      buildings: { ...state.buildings },
      discoveredAnimals: [...state.wildlife.discoveredSpecies],
      nodeCooldowns,
    },
  };
}

export function restoreSavedRunSnapshot(
  snapshot: unknown,
  world: IslandWorldData
): { state: SurvivalState; player: { x: number; y: number; z: number; yaw: number } } | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const snap = snapshot as Partial<SavedRunSnapshot>;
  if (snap.version !== 1 || !snap.state || !snap.player || typeof snap.seed !== 'string') {
    return null;
  }

  const saved = snap.state;
  const state = createSurvivalState(world, typeof saved.timeOfDay === 'number' ? saved.timeOfDay : 0.38);

  if (saved.carried) {
    state.carried = {
      wood: Math.max(0, Number(saved.carried.wood) || 0),
      fish: Math.max(0, Number(saved.carried.fish) || 0),
      berries: Math.max(0, Number(saved.carried.berries) || 0),
      shell: Math.max(0, Number(saved.carried.shell) || 0),
      banana: Math.max(0, Number(saved.carried.banana) || 0),
      meat: Math.max(0, Number(saved.carried.meat) || 0),
    };
  }
  if (Array.isArray(saved.carriedStack)) {
    state.carriedStack = saved.carriedStack.filter(
      (k): k is ResourceKind =>
        k === 'wood' || k === 'fish' || k === 'berries' || k === 'shell' || k === 'banana' || k === 'meat'
    );
  }
  if (saved.stashed) {
    state.stashed = {
      wood: Math.max(0, Number(saved.stashed.wood) || 0),
      shell: Math.max(0, Number(saved.stashed.shell) || 0),
    };
  }

  state.cookedFish = Math.max(0, Number(saved.cookedFish) || 0);
  state.roastedBanana = Math.max(0, Number(saved.roastedBanana) || 0);
  state.cookedMeat = Math.max(0, Number(saved.cookedMeat) || 0);
  state.huntedCount = Math.max(0, Number(saved.huntedCount) || 0);
  state.coins = Math.max(0, Number(saved.coins) || 0);

  state.hasSpear = Boolean(saved.hasSpear);
  state.hasFireSpear = Boolean(saved.hasFireSpear);
  if (saved.unlockedWeapons) {
    state.unlockedWeapons = {
      axe: true,
      spear: Boolean(saved.unlockedWeapons.spear),
      bow: Boolean(saved.unlockedWeapons.bow),
      hammer: Boolean(saved.unlockedWeapons.hammer),
    };
  }
  if (saved.weaponLevels) {
    state.weaponLevels = {
      axe: Math.max(1, Number(saved.weaponLevels.axe) || 1),
      spear: Math.max(1, Number(saved.weaponLevels.spear) || 1),
      bow: Math.max(1, Number(saved.weaponLevels.bow) || 1),
      hammer: Math.max(1, Number(saved.weaponLevels.hammer) || 1),
    };
  }
  if (saved.weaponXp) {
    state.weaponXp = {
      axe: Math.max(0, Number(saved.weaponXp.axe) || 0),
      spear: Math.max(0, Number(saved.weaponXp.spear) || 0),
      bow: Math.max(0, Number(saved.weaponXp.bow) || 0),
      hammer: Math.max(0, Number(saved.weaponXp.hammer) || 0),
    };
  }
  if (
    saved.equippedWeapon &&
    state.unlockedWeapons[saved.equippedWeapon]
  ) {
    state.equippedWeapon = saved.equippedWeapon;
  }

  state.fireLit = Boolean(saved.fireLit);
  state.fireLevel = state.fireLit ? Math.max(1, Number(saved.fireLevel) || 1) : 0;
  state.fireStokedCount = Math.max(0, Number(saved.fireStokedCount) || 0);
  state.venomTimer = Math.max(0, Number(saved.venomTimer) || 0);
  state.antidotes = Math.max(0, Number(saved.antidotes) || 0);
  state.shellArmorCharges = Math.max(0, Number(saved.shellArmorCharges) || 0);
  state.elixirTimer = Math.max(0, Number(saved.elixirTimer) || 0);
  state.torchTimer = Math.max(0, Number(saved.torchTimer) || 0);
  state.baitCharges = Math.max(0, Number(saved.baitCharges) || 0);

  state.xp = Math.max(0, Number(saved.xp) || 0);
  state.playerLevel = Math.max(1, Math.min(CONFIG.PLAYER.MAX_LEVEL, Number(saved.playerLevel) || 1));
  state.playerXp = Math.max(0, Number(saved.playerXp) || 0);
  state.playerXpToNext =
    state.playerLevel >= CONFIG.PLAYER.MAX_LEVEL
      ? getPlayerXpThreshold(CONFIG.PLAYER.MAX_LEVEL - 1)
      : getPlayerXpThreshold(state.playerLevel);
  state.skillPoints = Math.max(0, Number(saved.skillPoints) || 0);

  if (saved.skills) {
    state.skills = {
      lumberjack: Math.max(0, Number(saved.skills.lumberjack) || 0),
      backpacker: Math.max(0, Number(saved.skills.backpacker) || 0),
      pathfinder: Math.max(0, Number(saved.skills.pathfinder) || 0),
      angler: Math.max(0, Number(saved.skills.angler) || 0),
      pyromancer: Math.max(0, Number(saved.skills.pyromancer) || 0),
    };
  }
  if (saved.buildings) {
    state.buildings = {
      shelter: Boolean(saved.buildings.shelter),
      rack: Boolean(saved.buildings.rack),
      pier: Boolean(saved.buildings.pier),
      boat: Boolean(saved.buildings.boat),
    };
    state.buildProgress = {
      shelter: state.buildings.shelter ? 1 : 0,
      rack: state.buildings.rack ? 1 : 0,
      pier: state.buildings.pier ? 1 : 0,
      boat: state.buildings.boat ? 1 : 0,
    };
  }

  state.maxEnergy = recomputeMaxEnergy(state);
  state.backpackCapacity = recomputeBackpackCapacity(state);
  state.energy = Math.max(10, Math.min(state.maxEnergy, Number(saved.energy) || state.maxEnergy));

  state.dayCount = Math.max(1, Number(saved.dayCount) || 1);
  if (
    saved.weather === 'clear' ||
    saved.weather === 'rain' ||
    saved.weather === 'storm' ||
    saved.weather === 'fog'
  ) {
    state.weather = saved.weather;
  }
  if (typeof saved.weatherTimer === 'number') {
    state.weatherTimer = Math.max(2, saved.weatherTimer);
  }
  if (typeof saved.groundWetness === 'number') {
    state.groundWetness = Math.max(0, Math.min(1, saved.groundWetness));
  }

  if (Array.isArray(saved.discoveredSecrets)) {
    state.discoveredSecrets = saved.discoveredSecrets.filter((id) =>
      state.secretSpots.some((s) => s.id === id)
    );
  }
  if (Array.isArray(saved.discoveredMysteries)) {
    state.discoveredMysteries = saved.discoveredMysteries.filter((id) =>
      state.mysterySpots.some((m) => m.id === id)
    );
  }
  if (Array.isArray(saved.inspectedBones)) {
    state.inspectedBones = saved.inspectedBones.filter((id) =>
      state.ancientBoneSites.some((b) => b.id === id)
    );
  }
  state.wreckLooted = Boolean(saved.wreckLooted);
  state.templeUnlocked = Boolean(saved.templeUnlocked);
  state.templeRelicClaimed = Boolean(saved.templeRelicClaimed);
  state.templeDoorProgress = state.templeUnlocked ? 1 : 0;

  if (Array.isArray(saved.discoveredAnimals)) {
    for (const sp of saved.discoveredAnimals) {
      if (!state.wildlife.discoveredSpecies.includes(sp)) {
        state.wildlife.discoveredSpecies.push(sp);
      }
    }
  }
  if (saved.nodeCooldowns && typeof saved.nodeCooldowns === 'object') {
    for (const node of state.nodes) {
      const cd = saved.nodeCooldowns[node.id];
      if (typeof cd === 'number' && cd > 0) {
        node.cooldownRemaining = cd;
      }
    }
  }

  return {
    state,
    player: {
      x: Number.isFinite(snap.player.x) ? snap.player.x : CONFIG.WORLD.SPAWN_X,
      y: Number.isFinite(snap.player.y) ? snap.player.y : 1.9,
      z: Number.isFinite(snap.player.z) ? snap.player.z : CONFIG.WORLD.SPAWN_Z,
      yaw: Number.isFinite(snap.player.yaw) ? snap.player.yaw : 0,
    },
  };
}
