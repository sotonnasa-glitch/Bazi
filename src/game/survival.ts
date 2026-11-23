import {
  CONFIG,
  type BiomeId,
  type CampUpgradeId,
  type DayPhase,
  type SkillId,
  type StrangeLandmarkId,
  type WeatherKind,
} from './config';
import {
  createWildlifeState,
  stepWildlifeSystem,
  type WildlifeState,
} from './wildlife';
import type {
  BuildPadSite,
  FishingSpot,
  IslandProp,
  IslandWorldData,
  LandmarkActionSite,
  PropKind,
} from './world';

export type ResourceKind = 'wood' | 'fish' | 'berries' | 'shell' | 'banana';
export type SurvivalActionKind =
  | 'idle'
  | 'chop'
  | 'climb'
  | 'spear_fish'
  | 'forage'
  | 'cook'
  | 'build';

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

export interface SurvivalState {
  carried: {
    wood: number;
    fish: number;
    berries: number;
    shell: number;
    banana: number;
  };
  carriedStack: ResourceKind[];
  stashed: {
    wood: number;
    shell: number;
  };
  cookedFish: number;
  roastedBanana: number;
  coins: number;
  energy: number;
  maxEnergy: number;
  backpackCapacity: number;
  hasSpear: boolean;
  hasFireSpear: boolean;
  fireLevel: number;
  fireStokedCount: number;
  xp: number;
  skillPoints: number;
  skills: Record<SkillId, number>;
  timeOfDay: number;
  dayCount: number;
  phase: DayPhase;
  isNight: boolean;
  weather: WeatherKind;
  weatherTimer: number;
  weatherTick: number;
  nodes: HarvestNodeState[];
  buildPads: BuildPadSite[];
  landmarkSites: LandmarkActionSite[];
  landmarkCooldowns: Record<StrangeLandmarkId, number>;
  buildings: Record<CampUpgradeId, boolean>;
  buildProgress: Record<CampUpgradeId, number>;
  wildlife: WildlifeState;
  activeNodeId: string | null;
  activeBuildId: CampUpgradeId | null;
  activeAction: SurvivalActionKind;
  actionTargetX: number;
  actionTargetZ: number;
  harvestProgress: number;
  actionProgress: number;
  cookProgress: number;
  nearCampfire: boolean;
  backpackFullBlocked: boolean;
  lowEnergyBlocked: boolean;
  needSpearBlocked: boolean;
  predatorAlert: boolean;
  nearbyPad: { id: CampUpgradeId; cost: number; totalWood: number } | null;
  nearbyLandmark: { id: StrangeLandmarkId; cooldown: number } | null;
  stashedTotalForCoin: number;
  fireStokeAnimTimer: number;
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
  builtUpgrade?: {
    id: CampUpgradeId;
    x: number;
    y: number;
    z: number;
  };
  cookedCount: number;
  roastedBananaCount: number;
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
  hasSpear: boolean;
  hasFireSpear: boolean;
  canCraftSpear: boolean;
  fireLevel: number;
  canStokeFire: boolean;
  xp: number;
  skillPoints: number;
  skills: Record<SkillId, number>;
  discoveredAnimals: string[];
  nearCampfire: boolean;
  backpackFullBlocked: boolean;
  lowEnergyBlocked: boolean;
  needSpearBlocked: boolean;
  predatorAlert: boolean;
  canEatFood: boolean;
  bestFoodKind: 'roastedBanana' | 'cookedFish' | 'banana' | 'berries' | null;
  activeAction: SurvivalActionKind;
  buildings: Record<CampUpgradeId, boolean>;
  nearbyPad: { id: CampUpgradeId; cost: number; totalWood: number } | null;
  nearbyLandmark: { id: StrangeLandmarkId; cooldown: number } | null;
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
  if (prop.kind === 'palm' || prop.kind === 'jungle' || prop.kind === 'pine' || prop.kind === 'banyan' || prop.kind === 'willow') {
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

export function recomputeMaxEnergy(state: Pick<SurvivalState, 'skills'>): number {
  return CONFIG.PLAYER.MAX_ENERGY + state.skills.pyromancer * 20;
}

export function recomputeBackpackCapacity(state: Pick<SurvivalState, 'buildings' | 'skills'>): number {
  const base = state.buildings.rack
    ? CONFIG.PLAYER.UPGRADED_BACKPACK_CAPACITY
    : CONFIG.PLAYER.BACKPACK_CAPACITY;
  return base + state.skills.backpacker * 4;
}

function awardXp(state: SurvivalState, baseAmount: number): void {
  const mult = state.fireLevel >= 4 ? 1.5 : 1;
  state.xp += Math.round(baseAmount * mult);
  const threshold = CONFIG.SURVIVAL.XP_PER_SKILL_POINT;
  while (state.xp >= threshold) {
    state.xp -= threshold;
    state.skillPoints += 1;
  }
}

export function createSurvivalState(world: IslandWorldData, initialTimeOfDay = 0.38): SurvivalState {
  const normalizedT = ((initialTimeOfDay % 1) + 1) % 1;
  const phase = getDayPhase(normalizedT);
  return {
    carried: { wood: 0, fish: 0, berries: 0, shell: 0, banana: 0 },
    carriedStack: [],
    stashed: { wood: 0, shell: 0 },
    cookedFish: 0,
    roastedBanana: 0,
    coins: 0,
    energy: CONFIG.PLAYER.MAX_ENERGY,
    maxEnergy: CONFIG.PLAYER.MAX_ENERGY,
    backpackCapacity: CONFIG.PLAYER.BACKPACK_CAPACITY,
    hasSpear: false,
    hasFireSpear: false,
    fireLevel: 1,
    fireStokedCount: 0,
    xp: 0,
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
    nodes: createHarvestNodesFromWorld(world),
    buildPads: world.buildPads.map((p) => ({ ...p })),
    landmarkSites: world.landmarkSites.map((l) => ({ ...l })),
    landmarkCooldowns: { ruins: 0, volcano: 0, mushroom: 0, shipwreck: 0, spring: 0 },
    buildings: { shelter: false, rack: false, pier: false },
    buildProgress: { shelter: 0, rack: 0, pier: 0 },
    wildlife: createWildlifeState(world, world.seed),
    activeNodeId: null,
    activeBuildId: null,
    activeAction: 'idle',
    actionTargetX: 0,
    actionTargetZ: 0,
    harvestProgress: 0,
    actionProgress: 0,
    cookProgress: 0,
    nearCampfire: false,
    backpackFullBlocked: false,
    lowEnergyBlocked: false,
    needSpearBlocked: false,
    predatorAlert: false,
    nearbyPad: null,
    nearbyLandmark: null,
    stashedTotalForCoin: 0,
    fireStokeAnimTimer: 0,
  };
}

export function getBackpackUsed(state: Pick<SurvivalState, 'carried'>): number {
  return (
    state.carried.wood +
    state.carried.fish +
    state.carried.berries +
    state.carried.shell +
    state.carried.banana
  );
}

export function getPlayerSpeedScale(
  state: Pick<SurvivalState, 'energy' | 'weather' | 'skills' | 'fireLevel' | 'nearCampfire'>
): number {
  if (state.energy <= 1) return CONFIG.SURVIVAL.EXHAUSTED_SPEED_SCALE;

  const skillBonus = 1 + state.skills.pathfinder * 0.12;
  const fireAuraBonus = state.fireLevel >= 3 ? 1.1 : 1.0;

  // Weather effect softened by pathfinder skill
  let weatherScale = 1.0;
  const resistance = state.skills.pathfinder * 0.3;
  if (state.weather === 'rain') {
    weatherScale = CONFIG.WEATHER.RAIN_SPEED_SCALE + (1 - CONFIG.WEATHER.RAIN_SPEED_SCALE) * resistance;
  } else if (state.weather === 'fog') {
    weatherScale = CONFIG.WEATHER.FOG_SPEED_SCALE + (1 - CONFIG.WEATHER.FOG_SPEED_SCALE) * resistance;
  }

  return skillBonus * fireAuraBonus * weatherScale;
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
  state.needSpearBlocked = false;
  awardXp(state, 10);
  return true;
}

export function stokeCampfire(state: SurvivalState): boolean {
  if (!state.nearCampfire) return false;
  if (!spendWood(state, CONFIG.SURVIVAL.FIRE_FUEL_WOOD_COST)) return false;
  state.fireStokedCount += 1;
  state.fireLevel = Math.min(CONFIG.SURVIVAL.MAX_FIRE_LEVEL, state.fireLevel + 1);
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

export function activateLandmarkPower(
  state: SurvivalState,
  landmarkId: StrangeLandmarkId
): { triggered: boolean; label: string } {
  if (state.landmarkCooldowns[landmarkId] > 0) {
    return { triggered: false, label: '' };
  }
  state.landmarkCooldowns[landmarkId] = CONFIG.SURVIVAL.LANDMARK_COOLDOWN_SEC;

  if (landmarkId === 'ruins') {
    // Sun Ritual: pull time toward bright midday & grant XP + coins
    state.timeOfDay = 0.42;
    state.phase = getDayPhase(state.timeOfDay);
    state.isNight = false;
    state.coins += 5;
    awardXp(state, 15);
    return { triggered: true, label: 'آیین خورشید: روشنایی روز بازگشت (+۵ سکه)' };
  }
  if (landmarkId === 'volcano') {
    // Magma Forge: enchant spear into Fire Spear & instant roast raw food!
    state.hasSpear = true;
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
    awardXp(state, 18);
    return { triggered: true, label: 'آهنگری گدازه: نیزه آتشین فعال و غذاها کباب شدند!' };
  }
  if (landmarkId === 'mushroom') {
    // Spore Bloom: 100% energy + accelerates all plant & tree regrow!
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
    // Pirate Treasure: bonus coins, shells & wood planks
    state.coins += 8;
    state.stashed.wood += 3;
    state.stashed.shell += 2;
    awardXp(state, 14);
    return { triggered: true, label: 'گنج کاپیتان: +۸ سکه، ۳ چوب و ۲ صدف به کمپ رفت!' };
  }
  // Crystal Spring: full energy + clear stormy/foggy sky
  state.energy = state.maxEnergy;
  state.weather = 'clear';
  state.weatherTimer = CONFIG.WEATHER.MAX_DURATION_SEC;
  state.predatorAlert = false;
  awardXp(state, 14);
  return { triggered: true, label: 'چشمه بلورین: انرژی کامل و هوای صاف آفتابی!' };
}

export function eatBestFoodFromInventory(
  state: SurvivalState
): { ate: boolean; kind: 'roastedBanana' | 'cookedFish' | 'banana' | 'berries' | null; restored: number } {
  if (state.energy >= state.maxEnergy) {
    return { ate: false, kind: null, restored: 0 };
  }
  if (state.roastedBanana > 0) {
    const before = state.energy;
    state.roastedBanana -= 1;
    state.energy = Math.min(state.maxEnergy, state.energy + CONFIG.SURVIVAL.ROASTED_BANANA_ENERGY_RESTORE);
    state.lowEnergyBlocked = false;
    return { ate: true, kind: 'roastedBanana', restored: state.energy - before };
  }
  if (state.cookedFish > 0) {
    const before = state.energy;
    state.cookedFish -= 1;
    state.energy = Math.min(state.maxEnergy, state.energy + CONFIG.SURVIVAL.COOKED_FISH_ENERGY_RESTORE);
    state.lowEnergyBlocked = false;
    return { ate: true, kind: 'cookedFish', restored: state.energy - before };
  }
  if (state.carried.banana > 0) {
    const before = state.energy;
    state.carried.banana -= 1;
    removeFromStack(state.carriedStack, 'banana', 1);
    state.energy = Math.min(state.maxEnergy, state.energy + CONFIG.SURVIVAL.BANANA_ENERGY_RESTORE);
    state.lowEnergyBlocked = false;
    return { ate: true, kind: 'banana', restored: state.energy - before };
  }
  if (state.carried.berries > 0) {
    const before = state.energy;
    state.carried.berries -= 1;
    removeFromStack(state.carriedStack, 'berries', 1);
    state.energy = Math.min(state.maxEnergy, state.energy + CONFIG.SURVIVAL.BERRY_ENERGY_RESTORE);
    state.lowEnergyBlocked = false;
    return { ate: true, kind: 'berries', restored: state.energy - before };
  }
  return { ate: false, kind: null, restored: 0 };
}

export function getSurvivalHudView(state: SurvivalState, biome: BiomeId): SurvivalHudView {
  const roundedEnergy = Math.max(0, Math.min(state.maxEnergy, Math.round(state.energy)));
  const bestFoodKind: SurvivalHudView['bestFoodKind'] =
    state.energy < state.maxEnergy
      ? state.roastedBanana > 0
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

  return {
    coins: state.coins,
    wood: totalWood,
    fish: state.carried.fish,
    cookedFish: state.cookedFish,
    banana: state.carried.banana,
    roastedBanana: state.roastedBanana,
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
    hasSpear: state.hasSpear,
    hasFireSpear: state.hasFireSpear,
    canCraftSpear: !state.hasSpear && totalWood >= CONFIG.SURVIVAL.SPEAR_CRAFT_WOOD_COST,
    fireLevel: state.fireLevel,
    canStokeFire:
      state.nearCampfire &&
      state.fireLevel < CONFIG.SURVIVAL.MAX_FIRE_LEVEL &&
      totalWood >= CONFIG.SURVIVAL.FIRE_FUEL_WOOD_COST,
    xp: state.xp,
    skillPoints: state.skillPoints,
    skills: { ...state.skills },
    discoveredAnimals: [...state.wildlife.discoveredSpecies],
    nearCampfire: state.nearCampfire,
    backpackFullBlocked: state.backpackFullBlocked,
    lowEnergyBlocked: state.lowEnergyBlocked,
    needSpearBlocked: state.needSpearBlocked,
    predatorAlert: state.predatorAlert,
    canEatFood: bestFoodKind !== null,
    bestFoodKind,
    activeAction: state.activeAction,
    buildings: { ...state.buildings },
    nearbyPad: state.nearbyPad ? { ...state.nearbyPad } : null,
    nearbyLandmark: state.nearbyLandmark ? { ...state.nearbyLandmark } : null,
  };
}

export function stepSurvivalSystem(
  state: SurvivalState,
  playerX: number,
  playerZ: number,
  moved: boolean,
  dt: number,
  world?: IslandWorldData
): SurvivalStepResult {
  if (dt <= 0) {
    return {
      hudChanged: false,
      cookedCount: 0,
      roastedBananaCount: 0,
      depositedToCamp: 0,
      earnedCoins: 0,
      discoveredSpecies: [],
    };
  }

  const prevRoundedEnergy = Math.round(state.energy);
  const prevNearCamp = state.nearCampfire;
  const prevFullBlocked = state.backpackFullBlocked;
  const prevLowBlocked = state.lowEnergyBlocked;
  const prevNeedSpear = state.needSpearBlocked;
  const prevPredatorAlert = state.predatorAlert;
  const prevAction = state.activeAction;
  const prevNearbyPadId = state.nearbyPad?.id ?? null;
  const prevNearbyLandmarkId = state.nearbyLandmark?.id ?? null;
  const prevPhase = state.phase;
  const prevWeather = state.weather;

  if (state.fireStokeAnimTimer > 0) {
    state.fireStokeAnimTimer = Math.max(0, state.fireStokeAnimTimer - dt);
  }

  // 0A. Advance Day / Night Cycle
  const prevT = state.timeOfDay;
  state.timeOfDay = (state.timeOfDay + dt / CONFIG.DAY_NIGHT.CYCLE_DURATION_SEC) % 1;
  if (state.timeOfDay < prevT) {
    state.dayCount += 1;
  }
  state.phase = getDayPhase(state.timeOfDay);
  state.isNight = state.phase === 'night';

  // 0B. Advance Random Weather Transitions (Clear / Rain / Fog)
  state.weatherTimer -= dt;
  if (state.weatherTimer <= 0) {
    state.weatherTick += 1;
    const roll = Math.abs(Math.sin(state.weatherTick * 12.9898 + state.dayCount * 4.14) * 43758.5453) % 1;
    const nextWeather: WeatherKind = roll < 0.45 ? 'clear' : roll < 0.75 ? 'rain' : 'fog';
    state.weather = nextWeather;
    state.weatherTimer =
      CONFIG.WEATHER.MIN_DURATION_SEC +
      ((roll * 7.3) % 1) * (CONFIG.WEATHER.MAX_DURATION_SEC - CONFIG.WEATHER.MIN_DURATION_SEC);
  }

  // 1. Tick regrow cooldowns (Rain accelerates flora growth!)
  const floraRegrowRate = state.weather === 'rain' ? CONFIG.WEATHER.RAIN_REGROW_MULT : 1.0;
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
  }

  // 2. Campfire warmth aura, wood/shell banking, fish & banana roasting
  const camp = CONFIG.ISLAND.CAMPFIRE;
  const auraRadius = camp.AURA_RADIUS + (state.fireLevel - 1) * 1.1;
  const distCamp = Math.hypot(playerX - camp.CX, playerZ - camp.CZ);
  state.nearCampfire = distCamp <= auraRadius;

  let depositedToCamp = 0;
  let earnedCoins = 0;
  let cookedCount = 0;
  let roastedBananaCount = 0;

  if (state.nearCampfire) {
    if (state.energy < state.maxEnergy) {
      const shelterMult = state.buildings.shelter ? 1.35 : 1.0;
      const fireMult = 1 + (state.fireLevel - 1) * 0.25 + state.skills.pyromancer * 0.15;
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
    if (state.carried.fish > 0 || canRoastBanana) {
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
          awardXp(state, 5);
        } else if (canRoastBanana) {
          state.carried.banana -= 1;
          removeFromStack(state.carriedStack, 'banana', 1);
          state.roastedBanana += 1;
          roastedBananaCount += 1;
          earnedCoins += 1;
          state.coins += 1;
          awardXp(state, 5);
        }
      }
    } else {
      state.cookProgress = 0;
    }
  } else {
    state.cookProgress = 0;
    if (moved && state.energy > 0) {
      state.energy = Math.max(0, state.energy - CONFIG.SURVIVAL.WALK_ENERGY_DRAIN_PER_SEC * dt);
    }
  }

  // 2B. Step 32-species Wildlife AI & Night Predators
  let discoveredSpecies: string[] = [];
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
      world
    );
    discoveredSpecies = wRes.discoveredNew;
    state.predatorAlert = wRes.predatorNearby;
    if (wRes.ambushEnergyLoss > 0) {
      state.energy = Math.max(0, state.energy - wRes.ambushEnergyLoss);
    }
    if (discoveredSpecies.length > 0) {
      awardXp(state, discoveredSpecies.length * 4);
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
    ? { id: closestLandmark.id, cooldown: Math.ceil(state.landmarkCooldowns[closestLandmark.id]) }
    : null;

  // 3. Camp Build Pads check (Shelter, Backpack Rack, South Fishing Pier)
  let closestPad: BuildPadSite | null = null;
  let closestPadDist = Infinity;
  for (const pad of state.buildPads) {
    if (state.buildings[pad.id]) continue;
    const d = Math.hypot(playerX - pad.x, playerZ - pad.z);
    if (d <= CONFIG.SURVIVAL.HARVEST_RANGE_BUILD && d < closestPadDist) {
      closestPadDist = d;
      closestPad = pad;
    }
  }

  const totalWood = state.stashed.wood + state.carried.wood;
  let builtUpgrade: SurvivalStepResult['builtUpgrade'];

  if (closestPad) {
    const cost = CONFIG.SURVIVAL.BUILD_COSTS[closestPad.id];
    state.nearbyPad = { id: closestPad.id, cost, totalWood };
    if (totalWood >= cost) {
      state.activeBuildId = closestPad.id;
      state.activeNodeId = null;
      state.harvestProgress = 0;
      state.activeAction = 'build';
      state.actionTargetX = closestPad.x;
      state.actionTargetZ = closestPad.z;
      state.buildProgress[closestPad.id] += dt / Math.max(0.1, CONFIG.SURVIVAL.BUILD_DURATION_SEC);
      state.actionProgress = Math.min(1, state.buildProgress[closestPad.id]);

      if (state.buildProgress[closestPad.id] >= 1) {
        spendWood(state, cost);
        state.buildings[closestPad.id] = true;
        state.buildProgress[closestPad.id] = 1;
        state.backpackCapacity = recomputeBackpackCapacity(state);
        state.coins += 5;
        earnedCoins += 5;
        awardXp(state, 20);
        builtUpgrade = {
          id: closestPad.id,
          x: closestPad.x,
          y: closestPad.y,
          z: closestPad.z,
        };
        state.activeBuildId = null;
        state.activeAction = 'idle';
        state.actionProgress = 0;
        state.nearbyPad = null;
      }
    } else {
      state.activeBuildId = null;
    }
  } else {
    state.nearbyPad = null;
    state.activeBuildId = null;
  }

  // 4. Proximity auto-harvesting (Chop trees, Climb banana trees, Spear-fish in ocean, Forage berries/shells)
  let harvested: SurvivalStepResult['harvested'];

  if (!state.activeBuildId && !builtUpgrade) {
    let bestNode: HarvestNodeState | null = null;
    let bestDist = Infinity;
    for (const node of state.nodes) {
      if (node.cooldownRemaining > 0) continue;
      const d = Math.hypot(playerX - node.x, playerZ - node.z);
      if (d <= node.range && d < bestDist) {
        bestDist = d;
        bestNode = node;
      }
    }

    const backpackUsed = getBackpackUsed(state);
    const freeSlots = Math.max(0, state.backpackCapacity - backpackUsed);
    const backpackHasRoom = freeSlots > 0;
    state.backpackFullBlocked = Boolean(bestNode && !backpackHasRoom);
    state.needSpearBlocked = Boolean(bestNode && bestNode.propKind === 'fishing' && !state.hasSpear);

    const canRoastAny = state.nearCampfire && (state.carried.fish > 0 || (state.fireLevel >= 2 && state.carried.banana > 0));

    if (!bestNode) {
      state.activeNodeId = null;
      state.harvestProgress = 0;
      if (canRoastAny) {
        state.activeAction = 'cook';
        state.actionTargetX = camp.CX;
        state.actionTargetZ = camp.CZ;
        state.actionProgress = state.cookProgress;
      } else {
        state.activeAction = 'idle';
        state.actionProgress = 0;
      }
      state.lowEnergyBlocked = state.energy <= 0.5 && moved;
    } else if (!backpackHasRoom) {
      state.activeNodeId = null;
      state.harvestProgress = 0;
      state.activeAction = canRoastAny ? 'cook' : 'idle';
      state.actionProgress = state.activeAction === 'cook' ? state.cookProgress : 0;
    } else if (bestNode.propKind === 'fishing' && !state.hasSpear) {
      // Player must craft a Spear first before spearfishing in water!
      state.activeNodeId = null;
      state.harvestProgress = 0;
      state.activeAction = 'idle';
      state.actionProgress = 0;
    } else if (state.energy < bestNode.energyCost) {
      state.activeNodeId = null;
      state.harvestProgress = 0;
      state.activeAction = 'idle';
      state.actionProgress = 0;
      state.lowEnergyBlocked = true;
    } else {
      state.lowEnergyBlocked = false;
      if (state.activeNodeId !== bestNode.id) {
        state.activeNodeId = bestNode.id;
        state.harvestProgress = 0;
      }

      state.activeAction =
        bestNode.kind === 'wood'
          ? 'chop'
          : bestNode.kind === 'banana'
            ? 'climb'
            : bestNode.kind === 'fish'
              ? 'spear_fish'
              : 'forage';

      state.actionTargetX =
        bestNode.propKind === 'fishing' && bestNode.waterX !== undefined ? bestNode.waterX : bestNode.x;
      state.actionTargetZ =
        bestNode.propKind === 'fishing' && bestNode.waterZ !== undefined ? bestNode.waterZ : bestNode.z;

      const speedMult =
        bestNode.kind === 'fish'
          ? 1 + state.skills.angler * 0.25
          : 1 + state.skills.lumberjack * 0.25;

      state.harvestProgress += (dt * speedMult) / Math.max(0.1, bestNode.duration);
      state.actionProgress = Math.min(1, state.harvestProgress);

      if (state.harvestProgress >= 1) {
        let rawYield = 1;
        if (bestNode.propKind === 'fishing') {
          if (state.hasFireSpear || (bestNode.id === 'fish-spot-0' && state.buildings.pier)) {
            rawYield = 2;
          } else if (state.skills.angler > 0 && state.dayCount + state.xp % 3 === 0) {
            rawYield = 2;
          }
        } else if (bestNode.kind === 'banana') {
          rawYield = 2;
        }
        const amount = Math.min(rawYield, freeSlots);
        state.carried[bestNode.kind] += amount;
        for (let i = 0; i < amount; i += 1) {
          state.carriedStack.push(bestNode.kind);
        }
        state.energy = Math.max(0, state.energy - bestNode.energyCost);
        bestNode.cooldownRemaining = bestNode.regrowDuration;
        awardXp(state, bestNode.kind === 'wood' || bestNode.kind === 'fish' ? 8 : 6);
        harvested = {
          nodeId: bestNode.id,
          kind: bestNode.kind,
          propKind: bestNode.propKind,
          amount,
          x: bestNode.x,
          y: bestNode.y,
          z: bestNode.z,
        };
        state.activeNodeId = null;
        state.harvestProgress = 0;
        state.actionProgress = 0;
        state.activeAction = 'idle';
      }
    }
  }

  const hudChanged =
    Boolean(harvested) ||
    Boolean(builtUpgrade) ||
    cookedCount > 0 ||
    roastedBananaCount > 0 ||
    depositedToCamp > 0 ||
    discoveredSpecies.length > 0 ||
    Math.round(state.energy) !== prevRoundedEnergy ||
    state.nearCampfire !== prevNearCamp ||
    state.backpackFullBlocked !== prevFullBlocked ||
    state.lowEnergyBlocked !== prevLowBlocked ||
    state.needSpearBlocked !== prevNeedSpear ||
    state.predatorAlert !== prevPredatorAlert ||
    state.activeAction !== prevAction ||
    state.phase !== prevPhase ||
    state.weather !== prevWeather ||
    (state.nearbyPad?.id ?? null) !== prevNearbyPadId ||
    (state.nearbyLandmark?.id ?? null) !== prevNearbyLandmarkId;

  return {
    hudChanged,
    harvested,
    builtUpgrade,
    cookedCount,
    roastedBananaCount,
    depositedToCamp,
    earnedCoins,
    discoveredSpecies,
  };
}
