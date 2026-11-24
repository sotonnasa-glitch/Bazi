import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './config';
import {
  activateLandmarkPower,
  activateLandmarkSpecial,
  craftSpear,
  craftWorkshopItem,
  createSurvivalState,
  eatBestFoodFromInventory,
  exportSavedRunSnapshot,
  getBackpackUsed,
  getFishingSpeedMultiplier,
  getPlayerSpeedScale,
  getSurvivalHudView,
  inspectAncientBones,
  inspectMysterySpot,
  lightCampfire,
  openBuriedTempleDoor,
  openSecretSpot,
  restoreSavedRunSnapshot,
  salvagePlaneWreck,
  selectWeapon,
  setWildlifeDifficulty,
  stepSurvivalSystem,
  stokeCampfire,
  triggerSeasonEvent,
  triggerVictoryVoyage,
  triggerWorldEvent,
  upgradeSkill,
  upgradeWeapon,
  useAntidote,
} from './survival';
import { stepWildlifeSystem } from './wildlife';
import { generateIslandWorld } from './world';

test('survival state creates nodes for trees, banana trees, bushes, shells, and fishing spots with 4 build pads and 5 landmarks', () => {
  const world = generateIslandWorld('survival-nodes-v4');
  const state = createSurvivalState(world);

  const kinds = new Set(state.nodes.map((n) => n.kind));
  assert.ok(kinds.has('wood'));
  assert.ok(kinds.has('banana'));
  assert.ok(kinds.has('berries'));
  assert.ok(kinds.has('shell'));
  assert.ok(kinds.has('fish'));
  assert.equal(kinds.has('stone' as never), false);
  assert.equal(state.buildPads.length, 4);
  assert.ok(state.buildPads.some((p) => p.id === 'boat'));
  assert.equal(state.landmarkSites.length, 5);
  assert.equal(getBackpackUsed(state), 0);
});

test('walking past trees, bushes, or build pads does NOT auto-chop or auto-build without intentional interact', () => {
  const world = generateIslandWorld('survival-intentional-only');
  const state = createSurvivalState(world);
  const tree = state.nodes.find((n) => n.kind === 'wood')!;
  const rackPad = state.buildPads.find((p) => p.id === 'rack')!;
  state.stashed.wood = CONFIG.SURVIVAL.BUILD_COSTS.rack;

  // Walk past tree without pressing interact -> focuses target but stays idle and does not chop
  const passTree = stepSurvivalSystem(state, tree.x + 0.8, tree.z, true, 0.8, undefined, false);
  assert.equal(passTree.harvested, undefined);
  assert.equal(state.activeAction, 'idle');
  assert.equal(state.activeNodeId, null);
  assert.equal(state.focusedTarget?.id, tree.id);
  assert.equal(state.carried.wood, 0);

  // Walk past build pad without pressing interact -> focuses pad but does not build
  const passPad = stepSurvivalSystem(state, rackPad.x, rackPad.z, true, 0.8, undefined, false);
  assert.equal(passPad.builtUpgrade, undefined);
  assert.equal(state.activeAction, 'idle');
  assert.equal(state.focusedTarget?.id, 'rack');
  assert.equal(state.buildings.rack, false);
});

test('intentional chop pushes to carriedStack, respects backpack limit, and banana trees use climb action', () => {
  const world = generateIslandWorld('survival-chop-climb');
  const state = createSurvivalState(world);
  const tree = state.nodes.find((n) => n.kind === 'wood');
  const bananaTree = state.nodes.find((n) => n.kind === 'banana');
  assert.ok(tree);
  assert.ok(bananaTree);

  const r1 = stepSurvivalSystem(state, tree.x + 0.8, tree.z, false, 0.35, undefined, true);
  assert.equal(r1.harvested, undefined);
  assert.equal(state.activeAction, 'chop');
  assert.equal(state.activeNodeId, tree.id);

  const r2 = stepSurvivalSystem(state, tree.x + 0.8, tree.z, false, 0.65);
  assert.ok(r2.harvested);
  assert.equal(r2.harvested.kind, 'wood');
  assert.equal(state.carried.wood, 1);
  assert.deepEqual(state.carriedStack, ['wood']);
  assert.ok(tree.cooldownRemaining > 0);

  // Banana tree: climbs without chopping!
  const b1 = stepSurvivalSystem(state, bananaTree.x + 0.6, bananaTree.z, false, 0.45, undefined, true);
  assert.equal(b1.harvested, undefined);
  assert.equal(state.activeAction, 'climb');

  const b2 = stepSurvivalSystem(state, bananaTree.x + 0.6, bananaTree.z, false, 0.7);
  assert.ok(b2.harvested);
  assert.equal(b2.harvested.kind, 'banana');
  assert.equal(state.carried.banana, 2);

  // Fill backpack to capacity and verify further harvesting is blocked
  state.carried.berries = CONFIG.PLAYER.BACKPACK_CAPACITY - 3;
  const secondNode = state.nodes.find((n) => n.id !== tree.id && n.id !== bananaTree.id);
  assert.ok(secondNode);
  const rFull = stepSurvivalSystem(state, secondNode.x + 0.4, secondNode.z, false, 1.0, undefined, true);
  assert.equal(rFull.harvested, undefined);
  assert.equal(state.backpackFullBlocked, true);
});

test('rod fishing works immediately without spear, rain boosts fishing speed & yield, spear unlocks spear_fish, and campfire cooks fish', () => {
  const world = generateIslandWorld('survival-rod-and-spear-fish');
  const state = createSurvivalState(world);
  const spots = state.nodes.filter((n) => n.kind === 'fish');
  assert.ok(spots.length >= 2);
  const spotA = spots[0];
  const spotB = spots[1];

  // Without spear, rod fishing (cast_fish) works intentionally!
  const rodStart = stepSurvivalSystem(state, spotA.x, spotA.z, false, 0.5, undefined, true);
  assert.equal(rodStart.harvested, undefined);
  assert.equal(state.needSpearBlocked, false);
  assert.equal(state.activeAction, 'cast_fish');

  const rodCatch = stepSurvivalSystem(state, spotA.x, spotA.z, false, 0.8, undefined, false, false, () => 0.1);
  assert.ok(rodCatch.harvested);
  assert.equal(rodCatch.harvested.kind, 'fish');
  assert.equal(state.carried.fish, 1);

  // Rain boosts fishing speed multiplier and grants bonus fish catch!
  state.weather = 'rain';
  state.weatherTimer = 25;
  assert.ok(getFishingSpeedMultiplier(state) > 1.4, 'rain must boost fishing speed multiplier');

  // Craft spear and catch fish in rain at spotB -> spear_fish action & +2 fish yield
  state.carried.wood = 2;
  state.carriedStack.push('wood', 'wood');
  assert.equal(craftSpear(state), true);
  assert.equal(state.hasSpear, true);
  assert.equal(state.equippedWeapon, 'spear');

  const f1 = stepSurvivalSystem(state, spotB.x, spotB.z, false, 0.2, undefined, true);
  assert.equal(f1.harvested, undefined);
  assert.equal(state.activeAction, 'spear_fish');

  const f2 = stepSurvivalSystem(state, spotB.x, spotB.z, false, 0.65, undefined, false, false, () => 0.1);
  assert.ok(f2.harvested);
  assert.equal(f2.harvested.kind, 'fish');
  assert.equal(f2.harvested.amount, 2, 'rain weather grants bonus fish');
  assert.equal(state.carried.fish, 3);

  // Bring wood, shell, and fish to unlit campfire -> deposits wood & shell, does not cook until lit!
  state.carried.wood = 3;
  state.carried.shell = 1;
  state.carriedStack.push('wood', 'wood', 'wood', 'shell');
  state.energy = 40;

  const camp = CONFIG.ISLAND.CAMPFIRE;
  const c0 = stepSurvivalSystem(state, camp.CX + 1.2, camp.CZ, false, 0.6);
  assert.equal(state.nearCampfire, true);
  assert.equal(state.fireLit, false);
  assert.equal(c0.depositedToCamp, 4);
  assert.equal(state.stashed.wood, 3);
  assert.equal(state.stashed.shell, 1);
  assert.equal(c0.cookedCount, 0, 'unlit campfire must not cook fish');

  // Now ignite the campfire with 2 wood -> fireLit = true, fireLevel = 1, cooking starts!
  assert.equal(lightCampfire(state), true);
  assert.equal(state.fireLit, true);
  assert.equal(state.fireLevel, 1);

  const c1 = stepSurvivalSystem(state, camp.CX + 1.2, camp.CZ, false, 0.6);
  assert.equal(state.activeAction, 'cook');

  const c2 = stepSurvivalSystem(state, camp.CX + 1.2, camp.CZ, false, 0.6);
  assert.equal(c2.cookedCount, 1);
  assert.equal(state.carried.fish, 2);
  assert.equal(state.cookedFish, 1);
});

test('campfire levels 1 to 5 unlock roasted banana, bow, hammer, and wooden boat build & sea voyage', () => {
  const world = generateIslandWorld('survival-fire-lv5-boat');
  const state = createSurvivalState(world);
  const camp = CONFIG.ISLAND.CAMPFIRE;
  const boatPad = state.buildPads.find((p) => p.id === 'boat')!;
  assert.ok(boatPad);

  // Campfire starts unlit -> move near campfire, ignite (Lv 1), then stoke to Lv 5
  assert.equal(state.fireLit, false);
  assert.equal(state.fireLevel, 0);
  state.stashed.wood = 42;
  stepSurvivalSystem(state, camp.CX + 1, camp.CZ, false, 0.1);
  assert.equal(state.nearCampfire, true);
  assert.equal(stokeCampfire(state), false, 'must ignite unlit campfire before stoking');
  assert.equal(lightCampfire(state), true);
  assert.equal(state.fireLit, true);
  assert.equal(state.fireLevel, 1);

  assert.equal(stokeCampfire(state), true); // Lv 2
  assert.equal(state.fireLevel, 2);
  assert.equal(state.unlockedWeapons.bow, false);

  // At fireLevel >= 2, carrying banana near campfire roasts it!
  state.carried.banana = 1;
  state.carriedStack.push('banana');
  const rRoast = stepSurvivalSystem(state, camp.CX + 1, camp.CZ, false, CONFIG.SURVIVAL.COOK_DURATION_SEC + 0.15);
  assert.equal(rRoast.roastedBananaCount, 1);
  assert.equal(state.roastedBanana, 1);

  assert.equal(stokeCampfire(state), true); // Lv 3 -> unlocks bow
  assert.equal(state.fireLevel, 3);
  assert.equal(state.unlockedWeapons.bow, true);
  assert.equal(state.unlockedWeapons.hammer, false);

  assert.equal(stokeCampfire(state), true); // Lv 4 -> unlocks hammer
  assert.equal(state.fireLevel, 4);
  assert.equal(state.unlockedWeapons.hammer, true);

  // Boat pad before Lv 5 is blocked with need_fire_level
  stepSurvivalSystem(state, boatPad.x, boatPad.z, false, 0.1, undefined, false);
  assert.equal(state.focusedTarget?.id, 'boat');
  assert.equal(state.focusedTarget?.blockedReason, 'need_fire_level');

  // Return to campfire and stoke to Lv 5, then up to MAX_FIRE_LEVEL (10)
  stepSurvivalSystem(state, camp.CX + 1, camp.CZ, false, 0.1);
  assert.equal(stokeCampfire(state), true); // Lv 5!
  assert.equal(state.fireLevel, 5);
  while (state.fireLevel < CONFIG.SURVIVAL.MAX_FIRE_LEVEL) {
    assert.equal(stokeCampfire(state), true);
  }
  assert.equal(state.fireLevel, CONFIG.SURVIVAL.MAX_FIRE_LEVEL);
  assert.equal(stokeCampfire(state), false, 'cannot exceed max fire level 10');

  // Now stand at boat pad and build the wooden boat!
  const bStart = stepSurvivalSystem(state, boatPad.x, boatPad.z, false, 0.4, undefined, true);
  assert.equal(bStart.builtUpgrade, undefined);
  assert.equal(state.activeAction, 'build');
  const bDone = stepSurvivalSystem(state, boatPad.x, boatPad.z, false, 1.8);
  assert.ok(bDone.builtUpgrade);
  assert.equal(bDone.builtUpgrade.id, 'boat');
  assert.equal(state.buildings.boat, true);

  // After building boat below VICTORY_MIN_LEVEL, interacting at boat pad launches a repeatable sea voyage!
  state.playerLevel = CONFIG.SURVIVAL.VICTORY_MIN_LEVEL - 1;
  state.playerXp = 160;
  state.playerXpToNext = CONFIG.PLAYER.LEVEL_XP_THRESHOLDS[CONFIG.SURVIVAL.VICTORY_MIN_LEVEL - 1];
  const coinsBefore = state.coins;
  const voyageRes = stepSurvivalSystem(state, boatPad.x, boatPad.z, false, 0.1, undefined, true);
  assert.ok(voyageRes.boatVoyageNotice);
  assert.equal(state.coins, coinsBefore + 10);
  assert.ok(state.carried.fish >= 2);
});

test('upgradable weapons: bow shoots ranged arrows and hammer slams AoE shockwave stunning predators', () => {
  const world = generateIslandWorld('survival-weapons-bow-hammer');
  const state = createSurvivalState(world, 0.38);
  const camp = CONFIG.ISLAND.CAMPFIRE;

  // Move all nodes far out so prey & weapon interactions are isolated
  for (const node of state.nodes) {
    node.x = 999;
    node.z = 999;
  }

  // Upgrade axe via skillPoint & stashed wood
  state.stashed.wood = 20;
  assert.equal(upgradeWeapon(state, 'axe'), true);
  assert.equal(state.weaponLevels.axe, 2);

  // Ignite and stoke campfire to Lv 4 to unlock bow & hammer
  stepSurvivalSystem(state, camp.CX, camp.CZ, false, 0.1);
  lightCampfire(state); // Lv 1
  stokeCampfire(state); // Lv 2
  stokeCampfire(state); // Lv 3 (bow)
  stokeCampfire(state); // Lv 4 (hammer)
  assert.equal(state.unlockedWeapons.bow, true);
  assert.equal(state.unlockedWeapons.hammer, true);

  // Equip Hunting Bow and shoot a deer from 6.5m away!
  assert.equal(selectWeapon(state, 'bow'), true);
  const deer = state.wildlife.actors.find((a) => a.speciesId === 'deer')!;
  assert.ok(deer);
  deer.x = 18;
  deer.z = 12;
  deer.visible = true;

  const bowStep = stepSurvivalSystem(state, 12, 12, false, 0.1, world, true);
  assert.ok(bowStep.arrowShot, 'bow must fire a ranged arrow');
  assert.ok(bowStep.hunted, 'bow arrow hunts target cleanly');
  assert.equal(bowStep.hunted.ranged, true);
  assert.ok(state.carried.meat >= 2);

  // Equip Storm Hammer and trigger AoE slam near night wolf!
  assert.equal(selectWeapon(state, 'hammer'), true);
  const wolf = state.wildlife.actors.find((a) => a.speciesId === 'night_wolf')!;
  assert.ok(wolf);
  wolf.x = 24;
  wolf.z = 10;
  wolf.visible = true;
  wolf.koTimer = 0;
  wolf.respawnTimer = 0;
  state.timeOfDay = 0.85; // night so wolf stays visible

  const slamStep = stepSurvivalSystem(state, 22.5, 10, false, 0.1, world, true);
  assert.ok(slamStep.hammerSlam, 'hammer must trigger AoE shockwave slam');
  assert.ok(slamStep.hammerSlam.stunnedCount >= 1);
  assert.ok(wolf.stunTimer > 1.0, 'wolf must be stunned by hammer shockwave');
});

test('weather rain wets ground, slows movement, speeds flora growth; all 5 surprise world events function', () => {
  const world = generateIslandWorld('survival-weather-events');
  const state = createSurvivalState(world, 0.25);

  const tree = state.nodes.find((n) => n.kind === 'wood')!;
  tree.cooldownRemaining = 10;
  state.weather = 'storm';
  state.weatherTimer = 25;
  stepSurvivalSystem(state, 0, 0, false, 2.5);
  assert.ok(state.groundWetness > 0.5, 'storm must wet the ground');
  assert.ok(
    Math.abs(tree.cooldownRemaining - (10 - 2.5 * CONFIG.WEATHER.STORM_REGROW_MULT)) < 0.05,
    'storm must speed up tree regrow'
  );
  assert.ok(getPlayerSpeedScale(state) < 0.85, 'storm slows un-upgraded movement');

  // 1. Low tide lowers seaLevelOffset & grants shells
  const evLow = triggerWorldEvent(state, 'low_tide', true);
  assert.equal(evLow.phase, 'active');
  stepSurvivalSystem(state, 0, 0, false, 2.0);
  assert.ok(state.seaLevelOffset < -0.35, 'low tide lowers sea level offset');

  // 2. Tsunami starts with warning then surges high sea level and washes up wood on end
  const evTsu = triggerWorldEvent(state, 'tsunami', false);
  assert.equal(evTsu.phase, 'warning');
  const rTsuActive = stepSurvivalSystem(
    state,
    0,
    0,
    false,
    CONFIG.SURVIVAL.WORLD_EVENTS.WARNING_SEC + 0.1
  );
  assert.equal(rTsuActive.eventStarted?.phase, 'active');
  stepSurvivalSystem(state, 0, 0, false, 2.0);
  assert.ok(state.seaLevelOffset > 0.8, 'tsunami raises sea level surge');

  const woodBeforeEnd = state.stashed.wood;
  const rTsuEnd = stepSurvivalSystem(
    state,
    0,
    0,
    false,
    CONFIG.SURVIVAL.WORLD_EVENTS.TSUNAMI_DURATION_SEC
  );
  assert.ok(rTsuEnd.eventEndedNotice);
  assert.ok(state.stashed.wood >= woodBeforeEnd + 3);

  // 3. Volcano eruption, 4. Meteor shower, 5. Fish frenzy
  const coinsBeforeVolc = state.coins;
  triggerWorldEvent(state, 'volcano_eruption', true);
  assert.ok(state.coins > coinsBeforeVolc);

  const coinsBeforeMeteor = state.coins;
  triggerWorldEvent(state, 'meteor_shower', true);
  assert.ok(state.coins > coinsBeforeMeteor);

  state.weather = 'clear';
  const clearFishMult = getFishingSpeedMultiplier(state);
  triggerWorldEvent(state, 'fish_frenzy', true);
  assert.ok(getFishingSpeedMultiplier(state) > clearFishMult * 1.4);
});

test('all 5 strange landmarks support primary and secondary special interactions', () => {
  const world = generateIslandWorld('survival-landmark-specials');
  const state = createSurvivalState(world, 0.85); // night

  // Ruins primary restores daylight
  const ruinsPower = activateLandmarkPower(state, 'ruins');
  assert.equal(ruinsPower.triggered, true);
  assert.equal(state.isNight, false);

  // Volcano primary grants Fire Spear & cooks raw items
  state.carried.fish = 1;
  state.carried.meat = 1;
  state.carriedStack.push('fish', 'meat');
  const volcPower = activateLandmarkPower(state, 'volcano');
  assert.equal(volcPower.triggered, true);
  assert.equal(state.hasFireSpear, true);
  assert.equal(state.cookedFish, 1);
  assert.equal(state.cookedMeat, 1);

  // Ruins secondary offering requires 2 shells
  assert.equal(activateLandmarkSpecial(state, 'ruins').triggered, false);
  state.stashed.shell = 2;
  assert.equal(activateLandmarkSpecial(state, 'ruins').triggered, true);
  assert.equal(state.stashed.shell, 0);

  // Mushroom, Shipwreck, Spring primary & special
  assert.equal(activateLandmarkPower(state, 'mushroom').triggered, true);
  assert.equal(activateLandmarkSpecial(state, 'mushroom').triggered, true);
  assert.equal(activateLandmarkPower(state, 'shipwreck').triggered, true);
  assert.equal(activateLandmarkPower(state, 'spring').triggered, true);
  assert.equal(activateLandmarkSpecial(state, 'spring').triggered, true);

  // Skill upgrade check
  const baseCap = state.backpackCapacity;
  assert.equal(upgradeSkill(state, 'backpacker'), true);
  assert.equal(state.backpackCapacity, baseCap + 4);
});

test('hunting prey yields raw meat, campfire roasts meat, and building rack expands backpack', () => {
  const world = generateIslandWorld('survival-hunting-and-build');
  const state = createSurvivalState(world, 0.38);

  for (const node of state.nodes) {
    node.x = 999;
    node.z = 999;
  }

  const rabbit = state.wildlife.actors.find((a) => a.speciesId === 'rabbit')!;
  const deer = state.wildlife.actors.find((a) => a.speciesId === 'deer')!;
  deer.x = 200;
  deer.z = 200;
  rabbit.x = 16;
  rabbit.z = 16;

  const h1 = stepSurvivalSystem(state, rabbit.x + 0.5, rabbit.z, false, 0.3, world, true);
  assert.equal(state.activeAction, 'hunt');
  assert.equal(h1.hunted, undefined);

  const h2 = stepSurvivalSystem(state, rabbit.x, rabbit.z, false, 0.5, world);
  assert.ok(h2.hunted);
  assert.equal(state.carried.meat, 1);

  // Deer requires spear when using melee
  deer.x = 22;
  deer.z = 22;
  stepSurvivalSystem(state, deer.x + 0.5, deer.z, false, 0.25, world, true);
  assert.equal(state.needSpearHuntBlocked, true);

  state.hasSpear = true;
  state.unlockedWeapons.spear = true;
  stepSurvivalSystem(state, deer.x + 0.5, deer.z, false, 0.4, world, true);
  assert.equal(state.activeAction, 'hunt');
  const d2 = stepSurvivalSystem(state, deer.x, deer.z, false, 0.7, world);
  assert.ok(d2.hunted);
  assert.equal(state.carried.meat, 3);

  // Build backpack rack intentionally
  const rackPad = state.buildPads.find((p) => p.id === 'rack')!;
  state.stashed.wood = CONFIG.SURVIVAL.BUILD_COSTS.rack;
  stepSurvivalSystem(state, rackPad.x, rackPad.z, false, 0.4, undefined, true);
  assert.equal(state.activeAction, 'build');
  const b2 = stepSurvivalSystem(state, rackPad.x, rackPad.z, false, 1.8);
  assert.ok(b2.builtUpgrade);
  assert.equal(state.backpackCapacity, CONFIG.PLAYER.UPGRADED_BACKPACK_CAPACITY);

  // Eating cookedMeat priority
  state.cookedMeat = 1;
  state.cookedFish = 1;
  state.energy = 10;
  const eatRes = eatBestFoodFromInventory(state);
  assert.equal(eatRes.ate, true);
  assert.equal(eatRes.kind, 'cookedMeat');
  assert.equal(state.energy, 10 + CONFIG.SURVIVAL.COOKED_MEAT_ENERGY_RESTORE);

  const hud = getSurvivalHudView(state, 'center');
  assert.equal(hud.backpackCapacity, CONFIG.PLAYER.UPGRADED_BACKPACK_CAPACITY);
});

test('auto-fishing triggers when standing idle near water and handles probabilistic escape', () => {
  const world = generateIslandWorld('survival-auto-fish');
  const state = createSurvivalState(world);
  const spot = state.nodes.find((n) => n.propKind === 'fishing')!;
  assert.ok(spot);

  // Standing idle near water spot starts auto-fishing after 0.35s
  stepSurvivalSystem(state, spot.x, spot.z, false, 0.4, undefined, false, false, () => 0.1);
  assert.equal(state.activeNodeId, spot.id);
  assert.equal(state.activeAction, 'cast_fish');

  // Force RNG > catch chance -> fish escapes cleanly with notice
  const missRes = stepSurvivalSystem(state, spot.x, spot.z, false, 1.5, undefined, false, false, () => 0.99);
  assert.ok(missRes.fishingMissed);
  assert.equal(missRes.harvested, undefined);
  assert.equal(state.carried.fish, 0);
});

test('weapon XP leveling, player level 1..10 progression, seasons, localized disasters, secrets, victory & defeat', () => {
  const world = generateIslandWorld('survival-full-progression');
  const state = createSurvivalState(world);

  // 1. Seasonal transitions
  const aut = triggerSeasonEvent(state, 'autumn');
  assert.equal(aut.kind, 'autumn_breeze');
  assert.equal(state.season, 'autumn');
  const win = triggerSeasonEvent(state, 'winter');
  assert.equal(win.kind, 'winter_frost');
  assert.equal(state.season, 'winter');

  // 2. Secret spots (5 hidden chests)
  assert.equal(state.secretSpots.length, CONFIG.SURVIVAL.SECRETS_COUNT);
  const sec0 = state.secretSpots[0];
  const secRes = openSecretSpot(state, sec0.id, sec0.x, sec0.z);
  assert.equal(secRes.opened, true);
  assert.equal(state.discoveredSecrets.length, 1);
  assert.ok(state.coins >= 15);
  assert.ok(state.playerLevel >= 1);

  // 3. Weapon XP auto-levels axe from 1 -> 2 when chopping trees
  const tree = state.nodes.find((n) => n.kind === 'wood')!;
  for (let i = 0; i < 4; i += 1) {
    tree.cooldownRemaining = 0;
    state.carried.wood = 0;
    state.carriedStack = [];
    stepSurvivalSystem(state, tree.x + 0.5, tree.z, false, 0.2, undefined, true);
    stepSurvivalSystem(state, tree.x + 0.5, tree.z, false, 1.2);
  }
  assert.ok(state.weaponLevels.axe >= 2, `expected axe mastery >= 2 from XP, got ${state.weaponLevels.axe}`);

  // 4. Localized storm lightning hazard spawns near player and deals damage if standing inside strike radius
  state.weather = 'storm';
  state.weatherTimer = 25;
  state.hazardSpawnTimer = 0.05;
  stepSurvivalSystem(state, 10, 10, false, 0.1, undefined, false, false, () => 0.01);
  assert.ok(state.hazardImpacts.length >= 1);
  const hz = state.hazardImpacts[0];
  const energyBeforeHit = state.energy;
  const hitRes = stepSurvivalSystem(state, hz.x, hz.z, false, hz.maxDelay + 0.1);
  assert.ok(hitRes.hazardStrikes.some((s) => s.hitPlayer));
  assert.ok(state.energy < energyBeforeHit);

  // 5. Victory Voyage requires boat + playerLevel >= VICTORY_MIN_LEVEL (5)
  state.buildings.boat = true;
  state.playerLevel = 4;
  assert.equal(triggerVictoryVoyage(state), false);
  state.playerLevel = CONFIG.SURVIVAL.VICTORY_MIN_LEVEL;
  assert.equal(triggerVictoryVoyage(state), true);
  assert.equal(state.gameOutcome, 'victory');

  // 6. Defeat triggers when energy hits 0 during active play
  const loseState = createSurvivalState(world);
  loseState.energy = 5;
  loseState.weather = 'storm';
  loseState.hazardImpacts.push({
    id: 'test-bolt',
    kind: 'lightning',
    x: 0,
    z: 0,
    radius: 3,
    delayTimer: 0.05,
    maxDelay: 1,
    resolved: false,
    resolveTimer: 0.4,
  });
  stepSurvivalSystem(loseState, 0, 0, false, 0.2);
  assert.equal(loseState.energy, 0);
  assert.equal(loseState.gameOutcome, 'defeat');
});

test('earthquake boulder hazards, lightning_storm, fishable ocean fish, and daytime snakes work properly', () => {
  const world = generateIslandWorld('survival-earthquake-snakes-fish');
  const state = createSurvivalState(world, 0.35);

  // Daytime snakes exist in wildlife
  const cobra = state.wildlife.actors.find((a) => a.speciesId === 'jungle_cobra');
  const python = state.wildlife.actors.find((a) => a.speciesId === 'island_python');
  assert.ok(cobra && python, 'jungle_cobra and island_python snakes should populate the island');

  // Catching a fishable ocean fish directly yields fish (not meat)
  for (const node of state.nodes) {
    node.x = 999;
    node.z = 999;
  }
  const coralFish = state.wildlife.actors.find((a) => a.speciesId === 'coral_fish')!;
  assert.ok(coralFish);
  coralFish.visible = true;
  coralFish.koTimer = 0;
  coralFish.respawnTimer = 0;

  stepSurvivalSystem(state, coralFish.x + 0.6, coralFish.z, false, 0.2, undefined, true);
  assert.equal(state.activeAction, 'cast_fish');
  const fishRes = stepSurvivalSystem(state, coralFish.x + 0.6, coralFish.z, false, 1.4, undefined, false, false, () => 0.1);
  assert.equal(fishRes.harvested?.kind, 'fish', 'fishable coral_fish should yield fish via prey interaction');
  assert.ok(state.carried.fish >= 1);

  // Earthquake triggers warning -> active boulder hazards -> end reward
  const eqWarn = triggerWorldEvent(state, 'earthquake', false);
  assert.equal(eqWarn.phase, 'warning');
  const eqActive = stepSurvivalSystem(
    state,
    0,
    0,
    false,
    CONFIG.SURVIVAL.WORLD_EVENTS.WARNING_SEC + 0.1
  );
  assert.equal(eqActive.eventStarted?.phase, 'active');
  state.hazardSpawnTimer = 0.05;
  stepSurvivalSystem(state, 0, 0, false, 0.1, world, false, false, () => 0.1);
  assert.ok(
    state.hazardImpacts.some((h) => h.kind === 'boulder'),
    'earthquake must spawn falling boulder hazards'
  );

  // Lightning storm triggers warning -> active lightning strikes
  const lsWarn = triggerWorldEvent(state, 'lightning_storm', false);
  assert.equal(lsWarn.phase, 'warning');
  const lsActive = stepSurvivalSystem(
    state,
    0,
    0,
    false,
    CONFIG.SURVIVAL.WORLD_EVENTS.WARNING_SEC + 0.1
  );
  assert.equal(lsActive.eventStarted?.phase, 'active');
  state.hazardSpawnTimer = 0.05;
  stepSurvivalSystem(state, 0, 0, false, 0.1, world, false, false, () => 0.1);
  assert.ok(
    state.hazardImpacts.some((h) => h.kind === 'lightning'),
    'lightning_storm must spawn lightning strikes'
  );
});

test('venomous snake bite applies knockback + poison DoT cured by antidote, and disaster challenges reward survival', () => {
  const world = generateIslandWorld('survival-venom-challenge-v1');
  const state = createSurvivalState(world, 0.35);

  const viper = state.wildlife.actors.find((a) => a.speciesId === 'venomous_snake')!;
  assert.ok(viper, 'venomous_snake must spawn on island');
  viper.x = 12;
  viper.z = 12;
  viper.visible = true;
  viper.attackCooldown = 0;

  // Step wildlife until snake winds up & strikes player at (13, 12)
  let strikeResult = stepWildlifeSystem(state.wildlife, 0.25, false, 13, 12, false, 0, false, world);
  assert.equal(viper.attackState, 'windup');
  strikeResult = stepWildlifeSystem(state.wildlife, 0.5, false, 13, 12, false, 0, false, world);
  assert.equal(strikeResult.predatorStrikes.length, 1);
  const strike = strikeResult.predatorStrikes[0];
  assert.equal(strike.speciesId, 'venomous_snake');
  assert.ok(strike.knockbackForce > 0, 'predator strike must emit physical knockback force');
  assert.ok((strike.venomSec ?? 0) >= 8, 'venomous snake bite must carry timed venom');

  // Apply venom via stepSurvivalSystem & cure via antidote
  state.venomTimer = 8;
  const eBeforeVenom = state.energy;
  stepSurvivalSystem(state, 50, 50, false, 1.0);
  assert.ok(state.energy < eBeforeVenom - 1.5, 'venom must drain energy over time');
  assert.equal(useAntidote(state), true);
  assert.equal(state.venomTimer, 0);

  // Disaster challenge completes & awards coins + skillPoint when survived cleanly
  triggerWorldEvent(state, 'tsunami', true);
  assert.ok(state.disasterChallenge);
  assert.equal(state.disasterChallenge?.status, 'active');
  const coinsBefore = state.coins;
  const spBefore = state.skillPoints;
  const endRes = stepSurvivalSystem(
    state,
    0,
    0,
    false,
    CONFIG.SURVIVAL.WORLD_EVENTS.TSUNAMI_DURATION_SEC + 0.1,
    undefined,
    false,
    false
  );
  assert.equal(endRes.disasterChallengeOutcome?.completed, true);
  assert.ok(state.coins > coinsBefore);
  assert.equal(state.skillPoints, spBefore + 1);
});

test('camp workshop recipes, airplane wreck salvage, and ancient bone shrines give utility to all resources', () => {
  const world = generateIslandWorld('survival-workshop-wreck-bones');
  const state = createSurvivalState(world, 0.38);

  // Salvage airplane wreck once
  assert.ok(state.wreckSite);
  const wreckRes = salvagePlaneWreck(state, state.wreckSite!.x, state.wreckSite!.z);
  assert.equal(wreckRes.salvaged, true);
  assert.equal(state.wreckLooted, true);
  assert.ok(state.coins >= 8);
  assert.equal(salvagePlaneWreck(state, state.wreckSite!.x, state.wreckSite!.z).salvaged, false);

  // Inspect all 4 ancient bone shrines
  assert.equal(state.ancientBoneSites.length, 4);
  const b0 = state.ancientBoneSites[0];
  const boneRes = inspectAncientBones(state, b0.id, b0.x, b0.z);
  assert.equal(boneRes.inspected, true);
  assert.equal(state.inspectedBones.length, 1);

  // Craft every workshop recipe using banana, berries, shells, fish, wood, and coins
  state.carried.banana = 2;
  state.carried.berries = 6;
  state.carried.fish = 2;
  state.carriedStack.push('banana', 'banana', 'berries', 'berries', 'berries', 'berries', 'berries', 'berries', 'fish', 'fish');
  state.stashed.shell = 3;
  state.stashed.wood = 4;
  state.coins = 30;
  state.energy = 40;

  assert.equal(craftWorkshopItem(state, 'antidote').crafted, true);
  assert.equal(craftWorkshopItem(state, 'elixir').crafted, true);
  assert.ok(state.elixirTimer > 0);
  assert.equal(craftWorkshopItem(state, 'shell_armor').crafted, true);
  assert.equal(state.shellArmorCharges, 2);
  assert.equal(craftWorkshopItem(state, 'golden_bait').crafted, true);
  assert.equal(state.baitCharges, 3);
  assert.equal(craftWorkshopItem(state, 'ward_torch').crafted, true);
  assert.ok(state.torchTimer > 0);
  assert.equal(craftWorkshopItem(state, 'supply_pack').crafted, true);
  assert.equal(craftWorkshopItem(state, 'xp_tome').crafted, true);
});

test('buried stone temple door stays locked until all 4 ancient bones are collected and run snapshot round-trips cleanly', () => {
  const world = generateIslandWorld('survival-temple-save-test');
  const state = createSurvivalState(world, 0.42);
  const templeX = CONFIG.ISLAND.SHIPWRECK.HULL_CX;
  const templeZ = CONFIG.ISLAND.SHIPWRECK.HULL_CZ;

  // Cannot open temple door before collecting all 4 bones
  const lockedRes = openBuriedTempleDoor(state, templeX, templeZ);
  assert.equal(lockedRes.opened, false);
  assert.equal(lockedRes.lockedReason, 'need_bones');
  assert.equal(state.templeUnlocked, false);

  // Collect all 4 scattered ancient bone shrines
  for (const bone of state.ancientBoneSites) {
    const res = inspectAncientBones(state, bone.id, bone.x, bone.z);
    assert.equal(res.inspected, true);
  }
  assert.equal(state.inspectedBones.length, 4);

  // Now open buried temple door & claim hidden relic
  const coinsBefore = state.coins;
  const openRes = openBuriedTempleDoor(state, templeX, templeZ);
  assert.equal(openRes.opened, true);
  assert.equal(state.templeUnlocked, true);
  assert.equal(state.templeRelicClaimed, true);
  assert.equal(state.hasFireSpear, true);
  assert.ok(state.coins >= coinsBefore + 40);

  // Cannot claim twice
  const repeatRes = openBuriedTempleDoor(state, templeX, templeZ);
  assert.equal(repeatRes.opened, false);
  assert.equal(repeatRes.lockedReason, 'already_claimed');

  // Snapshot save/restore round-trip
  state.fireLit = true;
  state.fireLevel = 3;
  state.buildings.shelter = true;
  state.carried.wood = 2;
  state.carriedStack.push('wood', 'wood');
  const snap = exportSavedRunSnapshot(state, { x: 14.5, y: 2.1, z: -8.25, yaw: 1.2 }, 'normal', world.seed);
  const restored = restoreSavedRunSnapshot(snap, world);
  assert.ok(restored);
  assert.equal(restored!.player.x, 14.5);
  assert.equal(restored!.player.z, -8.25);
  assert.equal(restored!.state.templeUnlocked, true);
  assert.equal(restored!.state.templeRelicClaimed, true);
  assert.equal(restored!.state.inspectedBones.length, 4);
  assert.equal(restored!.state.fireLit, true);
  assert.equal(restored!.state.fireLevel, 3);
  assert.equal(restored!.state.buildings.shelter, true);
  assert.equal(restored!.state.carried.wood, 2);
});

test('post-event breather calms storms, predators can be fought with full backpack, and Lv5+ boat voyage readies victory', () => {
  const world = generateIslandWorld('survival-breather-combat-victory');
  const state = createSurvivalState(world, 0.38);

  // Isolate from nodes/pads
  for (const node of state.nodes) {
    node.x = 999;
    node.z = 999;
  }

  // 1. Post-event breather window suppresses storm & storm lightning right after a disaster ends
  state.weather = 'storm';
  state.weatherTimer = 15;
  triggerWorldEvent(state, 'lightning_storm', true);
  stepSurvivalSystem(
    state,
    0,
    0,
    false,
    CONFIG.SURVIVAL.WORLD_EVENTS.LIGHTNING_STORM_DURATION_SEC + 0.1
  );
  assert.ok(state.postEventBreatherTimer >= 25, 'breather timer must activate after event ends');
  assert.equal(state.weather, 'clear', 'storm must calm down right after major disaster');
  assert.ok(
    state.nextEventTimer >= CONFIG.SURVIVAL.WORLD_EVENTS.MIN_INTERVAL_SEC - 1,
    'next event interval must give player long breathing room'
  );

  // Even if storm is set manually while breather is active, ambient storm lightning is suppressed
  state.weather = 'storm';
  state.hazardSpawnTimer = 0.01;
  state.hazardImpacts = [];
  stepSurvivalSystem(state, 0, 0, false, 0.1, undefined, false, false, () => 0.01);
  assert.equal(state.hazardImpacts.length, 0, 'ambient storm lightning stays suppressed during breather');

  // 2. Hostile predator can be fought in melee & with bow even when backpack is completely full
  state.carried.wood = state.backpackCapacity;
  for (let i = 0; i < state.backpackCapacity; i += 1) state.carriedStack.push('wood');
  const wolf = state.wildlife.actors.find((a) => a.speciesId === 'night_wolf')!;
  assert.ok(wolf);
  state.timeOfDay = 0.85;
  wolf.x = 12;
  wolf.z = 12;
  wolf.visible = true;
  wolf.koTimer = 0;
  wolf.respawnTimer = 0;
  wolf.hp = 3;
  wolf.maxHp = 3;

  const fStep = stepSurvivalSystem(state, 13.5, 12, false, 0.1, world, false);
  assert.equal(fStep.hudChanged || state.focusedTarget?.id === wolf.id, true);
  assert.equal(state.focusedTarget?.kind, 'prey');
  assert.equal(state.focusedTarget?.blockedReason, undefined, 'full backpack must never block predator self-defense');

  const strike1 = stepSurvivalSystem(state, 13.5, 12, false, 0.1, world, true);
  assert.ok(strike1.meleeStrike, 'player must strike predator in melee');
  assert.equal(state.activeAction, 'hunt', 'combat swing pose persists right after strike');

  // Bow self-defense also works with full backpack
  state.unlockedWeapons.bow = true;
  selectWeapon(state, 'bow');
  wolf.hp = 2;
  const bowDefense = stepSurvivalSystem(state, 16, 12, false, 0.1, world, true);
  assert.equal(state.focusedTarget?.blockedReason, undefined, 'full backpack must not block bow defense against hostile predator');
  assert.ok(bowDefense.arrowShot, 'bow should shoot hostile predator even with full backpack');

  // 3. Build progress increases gradually so piece-by-piece animation is visible
  const boatPad = state.buildPads.find((p) => p.id === 'boat')!;
  state.fireLit = true;
  state.fireLevel = 5;
  state.stashed.wood = 20;
  selectWeapon(state, 'axe');
  stepSurvivalSystem(state, boatPad.x, boatPad.z, false, 0.2, undefined, true);
  stepSurvivalSystem(state, boatPad.x, boatPad.z, false, 0.6);
  assert.ok(
    state.buildProgress.boat > 0.25 && state.buildProgress.boat < 0.8,
    `expected gradual boat buildProgress around 0.4, got ${state.buildProgress.boat}`
  );
  const bFinish = stepSurvivalSystem(state, boatPad.x, boatPad.z, false, 1.5);
  assert.ok(bFinish.builtUpgrade);
  assert.equal(state.buildings.boat, true);

  // 4. Boat voyage at playerLevel >= VICTORY_MIN_LEVEL sets boatVoyageVictoryReady
  state.playerLevel = CONFIG.SURVIVAL.VICTORY_MIN_LEVEL;
  const vReady = stepSurvivalSystem(state, boatPad.x, boatPad.z, false, 0.1, undefined, true);
  assert.equal(vReady.boatVoyageVictoryReady, true);
});

test('hidden secrets and 7 mystery curios can reward OR drain player energy/HP and trigger defeat', () => {
  const world = generateIslandWorld('risky-secrets-and-mysteries');
  const state = createSurvivalState(world);

  assert.equal(world.mysterySpots.length, CONFIG.SURVIVAL.MYSTERY_SPOTS_COUNT);
  assert.equal(state.mysterySpots.length, CONFIG.SURVIVAL.MYSTERY_SPOTS_COUNT);

  // 1. Rewarding mystery curio
  const bottle = state.mysterySpots.find((m) => m.kind === 'message_bottle')!;
  const rewardRes = inspectMysterySpot(state, bottle.id, bottle.x, bottle.z, () => 0.9);
  assert.equal(rewardRes.opened, true);
  assert.equal(rewardRes.isHarmful, false);
  assert.ok((rewardRes.coinsDelta ?? 0) > 0);
  assert.equal(state.discoveredMysteries.includes(bottle.id), true);

  // 2. Harmful mystery curio reduces player energy & applies venom when venomous kind
  const urn = state.mysterySpots.find((m) => m.kind === 'mystery_urn')!;
  const eBeforeHarm = state.energy;
  const harmRes = inspectMysterySpot(state, urn.id, urn.x, urn.z, () => 0.1);
  assert.equal(harmRes.opened, true);
  assert.equal(harmRes.isHarmful, true);
  assert.ok((harmRes.energyDelta ?? 0) < 0);
  assert.ok(state.energy < eBeforeHarm);
  assert.ok(state.venomTimer > 0);

  // 3. Shell armor halves mystery curio trap damage
  const casket = state.mysterySpots.find((m) => m.kind === 'cursed_casket')!;
  state.energy = 100;
  state.shellArmorCharges = 1;
  const armoredRes = inspectMysterySpot(state, casket.id, casket.x, casket.z, () => 0.05);
  assert.equal(armoredRes.isHarmful, true);
  assert.equal(armoredRes.energyDelta, -13);
  assert.equal(state.shellArmorCharges, 0);

  // 4. Non-first secret chest can trigger a cursed trap draining energy & causing defeat at low energy
  const nonFirstSecret = state.secretSpots.find((s) => s.id !== 'waterfall_grotto')!;
  state.energy = 10;
  const trapRes = openSecretSpot(state, nonFirstSecret.id, nonFirstSecret.x, nonFirstSecret.z, () => 0.1);
  assert.equal(trapRes.opened, true);
  assert.equal(trapRes.isTrap, true);
  assert.ok((trapRes.energyDelta ?? 0) < 0);
  assert.equal(state.energy, 0);
  assert.equal(state.gameOutcome, 'defeat');

  // 5. Snapshot preserves discoveredMysteries
  const snap = exportSavedRunSnapshot(state, { x: 0, y: 1, z: 0, yaw: 0 }, 'normal', world.seed);
  const restored = restoreSavedRunSnapshot(snap, world);
  assert.ok(restored);
  assert.equal(restored.state.discoveredMysteries.length, 3);
});

test('volcano eruption leaves lingering lava pools that burn and high tsunami douses unsheltered campfire', () => {
  const world = generateIslandWorld('survival-disasters-hardcore-v1');
  const state = createSurvivalState(world, 0.38);

  // 1. Volcano eruption lava impact leaves lingering molten lava pool that scorches player
  triggerWorldEvent(state, 'volcano_eruption', true);
  state.hazardImpacts.push({
    id: 'test-lava-pool-strike',
    kind: 'lava',
    x: 15,
    z: 15,
    radius: 3.1,
    delayTimer: 0.05,
    maxDelay: 1.0,
    resolved: false,
    resolveTimer: 0.4,
  });
  // Step once far away so strike resolves into lavaPools without instant hit damage
  stepSurvivalSystem(state, 50, 50, false, 0.15);
  assert.ok(state.lavaPools.length >= 1, 'resolved lava impact during eruption must leave a molten lava pool');
  const pool = state.lavaPools[0];
  const eBeforeBurn = state.energy;
  stepSurvivalSystem(state, pool.x, pool.z, false, 0.6);
  assert.ok(state.energy < eBeforeBurn - 4, 'standing in lingering molten lava pool must burn energy');

  // 2. High tsunami wave extinguishes an unprotected lit campfire, whereas wooden shelter protects it
  state.lavaPools = [];
  state.fireLit = true;
  state.fireLevel = 3;
  state.buildings.shelter = false;
  triggerWorldEvent(state, 'tsunami', true);
  state.seaLevelOffset = 1.95;
  const douseRes = stepSurvivalSystem(state, 0, 0, false, 0.4);
  assert.equal(state.fireLit, false, 'high tsunami must extinguish unsheltered campfire');
  assert.equal(state.fireLevel, 2);
  assert.ok(douseRes.campfireExtinguishedNotice, 'must notify player when tsunami douses campfire');

  // With wooden shelter built, high tsunami does not douse the campfire
  state.fireLit = true;
  state.fireLevel = 3;
  state.buildings.shelter = true;
  state.seaLevelOffset = 2.1;
  const protectedRes = stepSurvivalSystem(state, 0, 0, false, 0.4);
  assert.equal(state.fireLit, true, 'wooden shelter must protect campfire from tsunami surge');
  assert.equal(protectedRes.campfireExtinguishedNotice, undefined);
});

test('full end-to-end playthrough scenario from island landing through boat escape victory works without blockers', () => {
  const world = generateIslandWorld('full-e2e-scenario-publish');
  const state = createSurvivalState(world, 0.38);
  const camp = CONFIG.ISLAND.CAMPFIRE;

  // 1. Spawn near campfire, salvage plane wreck for starter supplies
  assert.ok(state.wreckSite);
  const wreckStep = stepSurvivalSystem(state, state.wreckSite!.x, state.wreckSite!.z, false, 0.1, world, true);
  assert.ok(wreckStep.wreckSalvaged);
  assert.equal(state.wreckLooted, true);

  // 2. Return to campfire -> deposits wood -> light campfire Lv 1
  stepSurvivalSystem(state, camp.CX + 1, camp.CZ, false, 0.1, world);
  assert.equal(state.nearCampfire, true);
  assert.equal(lightCampfire(state), true);
  assert.equal(state.fireLevel, 1);

  // 3. Chop trees to gather wood & earn XP -> craft spear -> stoke campfire to Lv 5
  const trees = state.nodes.filter((n) => n.kind === 'wood');
  for (let i = 0; i < 12; i += 1) {
    const t = trees[i % trees.length];
    t.cooldownRemaining = 0;
    stepSurvivalSystem(state, t.x + 0.5, t.z, false, 0.1, world, true);
    stepSurvivalSystem(state, t.x + 0.5, t.z, false, CONFIG.SURVIVAL.HARVEST_DURATION_TREE + 0.1, world);
    if (getBackpackUsed(state) >= state.backpackCapacity - 1) {
      stepSurvivalSystem(state, camp.CX + 1, camp.CZ, false, 0.1, world);
    }
  }
  stepSurvivalSystem(state, camp.CX + 1, camp.CZ, false, 0.1, world);
  assert.equal(craftSpear(state), true);
  assert.equal(state.hasSpear, true);

  // Supply wood from continued chopping & stoke fire Lv 2..5 (unlocks bow & hammer & boat)
  state.stashed.wood += 40;
  for (let lv = 2; lv <= 5; lv += 1) {
    assert.equal(stokeCampfire(state), true);
    assert.equal(state.fireLevel, lv);
  }
  assert.equal(state.unlockedWeapons.bow, true);
  assert.equal(state.unlockedWeapons.hammer, true);

  // 4. Build all 4 camp structures (shelter -> rack -> pier -> boat)
  for (const padId of ['shelter', 'rack', 'pier', 'boat'] as const) {
    const pad = state.buildPads.find((p) => p.id === padId)!;
    stepSurvivalSystem(state, pad.x, pad.z, false, 0.1, world, true);
    const done = stepSurvivalSystem(state, pad.x, pad.z, false, CONFIG.SURVIVAL.BUILD_DURATION_SEC + 0.2, world);
    assert.equal(done.builtUpgrade?.id, padId, `expected ${padId} to finish building cleanly`);
    assert.equal(state.buildings[padId], true);
  }

  // 5. Inspect all 4 ancient bones -> open buried temple door
  for (const bone of state.ancientBoneSites) {
    const bRes = stepSurvivalSystem(state, bone.x, bone.z, false, 0.1, world, true);
    assert.ok(bRes.boneInspected, `expected bone ${bone.id} to be inspectable`);
  }
  const templeDoor = stepSurvivalSystem(
    state,
    CONFIG.ISLAND.SHIPWRECK.HULL_CX,
    CONFIG.ISLAND.SHIPWRECK.HULL_CZ,
    false,
    0.1,
    world,
    true
  );
  assert.ok(templeDoor.templeOpened, 'buried temple door must open once all 4 bones are inspected');
  assert.equal(state.templeRelicClaimed, true);

  // 6. Player is >= VICTORY_MIN_LEVEL (5) with boat built -> launch victory voyage!
  assert.ok(
    state.playerLevel >= CONFIG.SURVIVAL.VICTORY_MIN_LEVEL,
    `expected playerLevel >= ${CONFIG.SURVIVAL.VICTORY_MIN_LEVEL}, got ${state.playerLevel}`
  );
  const boatPad = state.buildPads.find((p) => p.id === 'boat')!;
  const voyageStep = stepSurvivalSystem(state, boatPad.x, boatPad.z, false, 0.1, world, true);
  assert.equal(voyageStep.boatVoyageVictoryReady, true, 'boat pad interact should trigger victory voyage cutscene');
  assert.equal(triggerVictoryVoyage(state), true);
  assert.equal(state.gameOutcome, 'victory');
});

test('wildlife difficulty multiplier scales predator melee strikes and venom drain across easy, normal, and hard', () => {
  const world = generateIslandWorld('wildlife-diff-test');

  const runStrikeForDifficulty = (diff: 'easy' | 'normal' | 'hard'): number => {
    const state = createSurvivalState(world, 0.92);
    setWildlifeDifficulty(state, diff);
    assert.equal(getSurvivalHudView(state, 'center').wildlifeDifficulty, diff);
    const wolf = state.wildlife.actors.find((a) => a.speciesId === 'night_wolf')!;
    wolf.visible = true;
    wolf.x = 20;
    wolf.z = 20;
    wolf.attackState = 'windup';
    wolf.attackTimer = 0.05;
    wolf.attackTargetX = 20.8;
    wolf.attackTargetZ = 20;

    const beforeEnergy = state.energy;
    const res = stepSurvivalSystem(state, 20.8, 20, false, 0.1, world);
    assert.equal(res.predatorStrikes.length, 1);
    return beforeEnergy - state.energy;
  };

  const dmgEasy = runStrikeForDifficulty('easy');
  const dmgNormal = runStrikeForDifficulty('normal');
  const dmgHard = runStrikeForDifficulty('hard');

  assert.ok(dmgEasy < dmgNormal, `expected easy (${dmgEasy}) < normal (${dmgNormal})`);
  assert.ok(dmgNormal < dmgHard, `expected normal (${dmgNormal}) < hard (${dmgHard})`);
});


