import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './config';
import {
  activateLandmarkPower,
  activateLandmarkSpecial,
  craftSpear,
  createSurvivalState,
  eatBestFoodFromInventory,
  getBackpackUsed,
  getFishingSpeedMultiplier,
  getPlayerSpeedScale,
  getSurvivalHudView,
  openSecretSpot,
  selectWeapon,
  stepSurvivalSystem,
  stokeCampfire,
  triggerSeasonEvent,
  triggerVictoryVoyage,
  triggerWorldEvent,
  upgradeSkill,
  upgradeWeapon,
} from './survival';
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

  // Bring wood, shell, and fish to campfire
  state.carried.wood = 3;
  state.carried.shell = 1;
  state.carriedStack.push('wood', 'wood', 'wood', 'shell');
  state.energy = 40;

  const camp = CONFIG.ISLAND.CAMPFIRE;
  const c1 = stepSurvivalSystem(state, camp.CX + 1.2, camp.CZ, false, 0.6);
  assert.equal(state.nearCampfire, true);
  assert.equal(c1.depositedToCamp, 4);
  assert.equal(state.stashed.wood, 3);
  assert.equal(state.stashed.shell, 1);
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

  // Move near campfire and stoke to Lv 5
  state.stashed.wood = 30;
  stepSurvivalSystem(state, camp.CX + 1, camp.CZ, false, 0.1);
  assert.equal(state.nearCampfire, true);

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
  const bDone = stepSurvivalSystem(state, boatPad.x, boatPad.z, false, 0.8);
  assert.ok(bDone.builtUpgrade);
  assert.equal(bDone.builtUpgrade.id, 'boat');
  assert.equal(state.buildings.boat, true);

  // After building boat, interacting at boat pad launches a sea voyage!
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

  // Stoke campfire to Lv 4 to unlock bow & hammer
  stepSurvivalSystem(state, camp.CX, camp.CZ, false, 0.1);
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
  const b2 = stepSurvivalSystem(state, rackPad.x, rackPad.z, false, 0.7);
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

