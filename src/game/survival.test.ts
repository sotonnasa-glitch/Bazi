import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './config';
import {
  activateLandmarkPower,
  craftSpear,
  createSurvivalState,
  eatBestFoodFromInventory,
  getBackpackUsed,
  getPlayerSpeedScale,
  getSurvivalHudView,
  stepSurvivalSystem,
  stokeCampfire,
  upgradeSkill,
} from './survival';
import { generateIslandWorld } from './world';

test('survival state creates nodes for trees, banana trees, bushes, shells, and fishing spots with zero stone mining', () => {
  const world = generateIslandWorld('survival-nodes-v3');
  const state = createSurvivalState(world);

  const kinds = new Set(state.nodes.map((n) => n.kind));
  assert.ok(kinds.has('wood'));
  assert.ok(kinds.has('banana'));
  assert.ok(kinds.has('berries'));
  assert.ok(kinds.has('shell'));
  assert.ok(kinds.has('fish'));
  assert.equal(kinds.has('stone' as never), false);
  assert.equal(state.buildPads.length, 3);
  assert.equal(state.landmarkSites.length, 5);
  assert.equal(getBackpackUsed(state), 0);
});

test('auto-chop wood pushes to carriedStack, respects backpack limit, and banana trees use climb action', () => {
  const world = generateIslandWorld('survival-chop-climb');
  const state = createSurvivalState(world);
  const tree = state.nodes.find((n) => n.kind === 'wood');
  const bananaTree = state.nodes.find((n) => n.kind === 'banana');
  assert.ok(tree);
  assert.ok(bananaTree);

  const r1 = stepSurvivalSystem(state, tree.x + 0.8, tree.z, false, 0.35);
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
  const b1 = stepSurvivalSystem(state, bananaTree.x + 0.6, bananaTree.z, false, 0.45);
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
  const rFull = stepSurvivalSystem(state, secondNode.x + 0.4, secondNode.z, false, 1.0);
  assert.equal(rFull.harvested, undefined);
  assert.equal(state.backpackFullBlocked, true);
});

test('ocean fishing requires crafting a spear first, then catches raw fish and campfire cooks fish & banks resources', () => {
  const world = generateIslandWorld('survival-spear-fish');
  const state = createSurvivalState(world);
  const spot = state.nodes.find((n) => n.kind === 'fish');
  assert.ok(spot);

  // Without spear, standing in surf blocks fishing and sets needSpearBlocked
  const blockedRes = stepSurvivalSystem(state, spot.x, spot.z, false, 0.8);
  assert.equal(blockedRes.harvested, undefined);
  assert.equal(state.needSpearBlocked, true);
  assert.equal(state.activeAction, 'idle');

  // Craft spear with 2 wood
  state.carried.wood = 2;
  state.carriedStack.push('wood', 'wood');
  assert.equal(craftSpear(state), true);
  assert.equal(state.hasSpear, true);
  assert.equal(state.carried.wood, 0);

  // Now spearfishing succeeds!
  const f1 = stepSurvivalSystem(state, spot.x, spot.z, false, 0.5);
  assert.equal(f1.harvested, undefined);
  assert.equal(state.activeAction, 'spear_fish');

  const f2 = stepSurvivalSystem(state, spot.x, spot.z, false, 0.8);
  assert.ok(f2.harvested);
  assert.equal(f2.harvested.kind, 'fish');
  assert.equal(state.carried.fish, 1);
  assert.deepEqual(state.carriedStack, ['fish']);

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
  assert.equal(state.carried.fish, 0);
  assert.equal(state.cookedFish, 1);
  assert.equal(getBackpackUsed(state), 0);
  assert.equal(state.coins, 3);
});

test('feeding wood to campfire levels up fire, unlocks roasted banana, and skill tree upgrades stats', () => {
  const world = generateIslandWorld('survival-fire-skills');
  const state = createSurvivalState(world);
  const camp = CONFIG.ISLAND.CAMPFIRE;

  // Move near campfire and stoke fire to Lv 2
  state.stashed.wood = 8;
  stepSurvivalSystem(state, camp.CX + 1, camp.CZ, false, 0.1);
  assert.equal(state.nearCampfire, true);
  assert.equal(stokeCampfire(state), true);
  assert.equal(state.fireLevel, 2);

  // At fireLevel >= 2, carrying banana near campfire roasts it!
  state.carried.banana = 1;
  state.carriedStack.push('banana');
  const rRoast = stepSurvivalSystem(state, camp.CX + 1, camp.CZ, false, CONFIG.SURVIVAL.COOK_DURATION_SEC + 0.15);
  assert.equal(rRoast.roastedBananaCount, 1);
  assert.equal(state.roastedBanana, 1);

  // Upgrade skills via skillPoints and wood
  const baseCap = state.backpackCapacity;
  assert.equal(upgradeSkill(state, 'backpacker'), true);
  assert.equal(state.backpackCapacity, baseCap + 4);

  const baseMaxEnergy = state.maxEnergy;
  assert.equal(upgradeSkill(state, 'pyromancer'), true);
  assert.equal(state.maxEnergy, baseMaxEnergy + 20);
});

test('day/night cycle, weather transitions, rain flora regrow boost, and 5 strange landmark powers work', () => {
  const world = generateIslandWorld('survival-cycle-weather-landmarks');
  const state = createSurvivalState(world, 0.25);

  // Rain accelerates flora regrow rate vs clear weather
  const tree = state.nodes.find((n) => n.kind === 'wood')!;
  tree.cooldownRemaining = 10;
  state.weather = 'rain';
  state.weatherTimer = 20;
  stepSurvivalSystem(state, 0, 0, false, 2.0);
  assert.ok(
    Math.abs(tree.cooldownRemaining - (10 - 2.0 * CONFIG.WEATHER.RAIN_REGROW_MULT)) < 0.05,
    'rain must speed up tree regrow'
  );
  assert.ok(getPlayerSpeedScale(state) < 1, 'rain slows un-upgraded movement slightly');

  // Day transitions to night after advancing timeOfDay
  stepSurvivalSystem(state, 0, 0, false, CONFIG.DAY_NIGHT.CYCLE_DURATION_SEC * 0.58);
  assert.equal(state.isNight, true);

  // Ruins Sun Ritual restores daytime & grants +5 coins
  const coinsBefore = state.coins;
  const ruinsPower = activateLandmarkPower(state, 'ruins');
  assert.equal(ruinsPower.triggered, true);
  assert.equal(state.isNight, false);
  assert.equal(state.coins, coinsBefore + 5);

  // Volcano Magma Forge grants Fire Spear & cooks raw fish/bananas
  state.carried.fish = 1;
  state.carried.banana = 1;
  state.carriedStack.push('fish', 'banana');
  const volcanoPower = activateLandmarkPower(state, 'volcano');
  assert.equal(volcanoPower.triggered, true);
  assert.equal(state.hasFireSpear, true);
  assert.equal(state.cookedFish, 1);
  assert.equal(state.roastedBanana, 1);

  // Mushroom Spore accelerates regrowing nodes & restores full energy
  state.energy = 12;
  tree.cooldownRemaining = 8;
  const mushPower = activateLandmarkPower(state, 'mushroom');
  assert.equal(mushPower.triggered, true);
  assert.equal(state.energy, state.maxEnergy);
  assert.ok(tree.cooldownRemaining <= 2.1);

  // Shipwreck Treasure grants coins, wood, and shells
  const shipPower = activateLandmarkPower(state, 'shipwreck');
  assert.equal(shipPower.triggered, true);
  assert.ok(state.stashed.wood >= 3);

  // Crystal Spring clears rain/fog & restores energy
  state.weather = 'rain';
  state.energy = 20;
  const springPower = activateLandmarkPower(state, 'spring');
  assert.equal(springPower.triggered, true);
  assert.equal(state.weather, 'clear');
  assert.equal(state.energy, state.maxEnergy);
});

test('building backpack rack expands capacity and eating cooked fish restores +45 energy', () => {
  const world = generateIslandWorld('survival-build');
  const state = createSurvivalState(world);
  const rackPad = state.buildPads.find((p) => p.id === 'rack');
  assert.ok(rackPad);

  state.stashed.wood = CONFIG.SURVIVAL.BUILD_COSTS.rack;
  const b1 = stepSurvivalSystem(state, rackPad.x, rackPad.z, false, 0.4);
  assert.equal(state.activeAction, 'build');
  assert.equal(b1.builtUpgrade, undefined);

  const b2 = stepSurvivalSystem(state, rackPad.x, rackPad.z, false, 0.7);
  assert.ok(b2.builtUpgrade);
  assert.equal(b2.builtUpgrade.id, 'rack');
  assert.equal(state.buildings.rack, true);
  assert.equal(state.backpackCapacity, CONFIG.PLAYER.UPGRADED_BACKPACK_CAPACITY);
  assert.equal(state.stashed.wood, 0);

  // Eating cooked fish takes priority over berries
  state.energy = 0;
  state.cookedFish = 1;
  state.carried.berries = 2;
  assert.ok(getPlayerSpeedScale(state) < 1);

  const eatRes = eatBestFoodFromInventory(state);
  assert.equal(eatRes.ate, true);
  assert.equal(eatRes.kind, 'cookedFish');
  assert.equal(state.energy, CONFIG.SURVIVAL.COOKED_FISH_ENERGY_RESTORE);
  assert.equal(getPlayerSpeedScale(state), 1);

  const hud = getSurvivalHudView(state, 'center');
  assert.equal(hud.backpackCapacity, CONFIG.PLAYER.UPGRADED_BACKPACK_CAPACITY);
});
