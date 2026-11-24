import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './config';
import {
  ANIMAL_SPECIES,
  createWildlifeState,
  getAnimalSpecies,
  markAnimalHunted,
  stepWildlifeSystem,
} from './wildlife';
import { generateIslandWorld, groundHeightAt } from './world';

test('wildlife catalog contains at least 30 distinct species across day, coastal, night_predator, and strange categories', () => {
  assert.ok(ANIMAL_SPECIES.length >= 30, `expected >= 30 animal species, got ${ANIMAL_SPECIES.length}`);

  const ids = new Set(ANIMAL_SPECIES.map((s) => s.id));
  assert.equal(ids.size, ANIMAL_SPECIES.length, 'every species id must be unique');

  const categories = new Set(ANIMAL_SPECIES.map((s) => s.category));
  assert.ok(categories.has('day'));
  assert.ok(categories.has('coastal'));
  assert.ok(categories.has('night_predator'));
  assert.ok(categories.has('strange'));
});

test('daytime animals sleep/hide at night while night predators hide in daytime and emerge at night', () => {
  const world = generateIslandWorld('wildlife-day-night');
  const wildlife = createWildlifeState(world, world.seed);

  // Step during daytime
  stepWildlifeSystem(wildlife, 0.25, false, 0, 0, false, 1, false, world);
  const dayActiveDuringDay = wildlife.actors.filter((a) => a.category === 'day' && !a.sleeping);
  const predatorsHiddenDuringDay = wildlife.actors.filter((a) => a.category === 'night_predator' && !a.visible);
  assert.ok(dayActiveDuringDay.length > 0);
  assert.equal(
    predatorsHiddenDuringDay.length,
    wildlife.actors.filter((a) => a.category === 'night_predator').length,
    'night predators must stay hidden during day'
  );

  // Step during night
  stepWildlifeSystem(wildlife, 0.25, true, 0, 0, false, 1, false, world);
  const daySleepingAtNight = wildlife.actors.filter((a) => a.category === 'day' && a.sleeping);
  const predatorsActiveAtNight = wildlife.actors.filter(
    (a) => a.category === 'night_predator' && a.visible && !a.sleeping
  );
  assert.equal(
    daySleepingAtNight.length,
    wildlife.actors.filter((a) => a.category === 'day').length,
    'all daytime animals must sleep or hide at night'
  );
  assert.ok(predatorsActiveAtNight.length > 0, 'night predators must emerge at night');
});

test('marine fish stay strictly offshore in water and beach crabs stay near sandy shoreline', () => {
  const world = generateIslandWorld('wildlife-habitats');
  const wildlife = createWildlifeState(world, world.seed);

  for (let i = 0; i < 40; i += 1) {
    stepWildlifeSystem(wildlife, 0.15, false, 0, 0, false, 1, false, world);
  }

  for (const actor of wildlife.actors) {
    const spec = getAnimalSpecies(actor.speciesId);
    assert.ok(spec);
    const h = groundHeightAt(actor.x, actor.z, world);
    if (spec.aquatic) {
      assert.ok(h <= -0.35, `marine species ${spec.id} must stay offshore in water, got h=${h}`);
    } else if (spec.homeBiome === 'beach') {
      assert.ok(
        h >= -0.25 && h <= 1.45,
        `beach species ${spec.id} must remain on sandy beach, got h=${h}`
      );
    }
  }
});

test('wildlife discovery records species when explorer approaches', () => {
  const world = generateIslandWorld('wildlife-discover');
  const wildlife = createWildlifeState(world, world.seed);
  const sampleActor = wildlife.actors.find((a) => a.category === 'day');
  assert.ok(sampleActor);

  const res = stepWildlifeSystem(
    wildlife,
    0.1,
    false,
    sampleActor.x,
    sampleActor.z,
    false,
    1,
    false,
    world
  );
  assert.ok(res.discoveredNew.includes(sampleActor.speciesId));
  assert.ok(wildlife.discoveredSpecies.includes(sampleActor.speciesId));
});

test('huntable species support KO topple animation and respawn cleanly after cooldown', () => {
  const huntableSpecies = ANIMAL_SPECIES.filter((s) => s.huntable);
  assert.ok(huntableSpecies.length >= 6, 'expected multiple huntable day, coastal & predator species');

  const world = generateIslandWorld('wildlife-hunt-respawn');
  const wildlife = createWildlifeState(world, world.seed);
  const rabbit = wildlife.actors.find((a) => a.speciesId === 'rabbit');
  assert.ok(rabbit);

  rabbit.x = rabbit.homeX + 3;
  rabbit.z = rabbit.homeZ + 3;
  markAnimalHunted(rabbit);

  assert.ok(rabbit.koTimer > 0);
  assert.equal(rabbit.visible, true);
  assert.equal(rabbit.respawnTimer, CONFIG.SURVIVAL.RESPAWN_HUNT_SEC);

  // Mid KO topple remains visible briefly, then disappears during respawn cooldown
  stepWildlifeSystem(wildlife, 0.25, false, 0, 0, false, 1, false, world);
  assert.ok(rabbit.koTimer > 0);
  assert.equal(rabbit.visible, true);

  stepWildlifeSystem(wildlife, 0.5, false, 0, 0, false, 1, false, world);
  assert.equal(rabbit.koTimer, 0);
  assert.equal(rabbit.visible, false);

  // Advance past respawn timer
  stepWildlifeSystem(wildlife, CONFIG.SURVIVAL.RESPAWN_HUNT_SEC + 0.5, false, 0, 0, false, 1, false, world);
  assert.equal(rabbit.respawnTimer, 0);
  assert.equal(rabbit.visible, true);
  assert.equal(rabbit.x, rabbit.homeX);
  assert.equal(rabbit.z, rabbit.homeZ);
});

test('night predator stops to telegraph windup attack then strikes player with damage', () => {
  const world = generateIslandWorld('wildlife-predator-strike');
  const wildlife = createWildlifeState(world, world.seed);
  const wolf = wildlife.actors.find((a) => a.speciesId === 'night_wolf');
  assert.ok(wolf);

  // Move wolf right next to player away from campfire at night
  const px = 22;
  const pz = 18;
  wolf.x = px + 1.2;
  wolf.z = pz;
  wolf.attackCooldown = 0;
  wolf.attackState = 'idle';

  // Step 1: enters windup telegraph
  const windupRes = stepWildlifeSystem(wildlife, 0.1, true, px, pz, false, 1, false, world);
  assert.equal(wolf.attackState, 'windup');
  assert.equal(windupRes.ambushEnergyLoss, 0);
  assert.equal(windupRes.predatorStrikes.length, 0);

  // Step 2: completes windup and triggers strike + real energy damage
  const strikeRes = stepWildlifeSystem(wildlife, 0.5, true, px, pz, false, 1, false, world);
  assert.equal(wolf.attackState, 'strike');
  assert.ok(strikeRes.ambushEnergyLoss > 0, 'predator strike must deal energy damage');
  assert.equal(strikeRes.predatorStrikes.length, 1);
  assert.equal(strikeRes.predatorStrikes[0].speciesId, 'night_wolf');
});

test('flying birds soar high above terrain and tree canopies', () => {
  const world = generateIslandWorld('wildlife-flying-altitude');
  const wildlife = createWildlifeState(world, world.seed);

  for (let i = 0; i < 12; i += 1) {
    stepWildlifeSystem(wildlife, 0.2, false, 0, 0, false, 1, false, world);
  }

  const birds = wildlife.actors.filter((a) => {
    const spec = getAnimalSpecies(a.speciesId);
    return spec?.flying && spec.archetype === 'bird';
  });
  assert.ok(birds.length > 0);
  for (const bird of birds) {
    const h = groundHeightAt(bird.x, bird.z, world);
    assert.ok(
      bird.y - h >= 4.5,
      `flying bird ${bird.speciesId} should soar >= 4.5m above terrain, got ${bird.y - h}`
    );
    assert.ok(Number.isFinite(bird.flyPitch ?? 0), `flying bird ${bird.speciesId} should have finite flyPitch`);
  }
});

test('night predators emerge gradually and staggered during dusk instead of popping in all at once', () => {
  const world = generateIslandWorld('wildlife-dusk-stagger');
  const wildlife = createWildlifeState(world, world.seed);

  // Daytime first: all night predators hidden
  stepWildlifeSystem(wildlife, 0.25, false, 0, 0, false, 1, false, world, null, false, 0.45, 'day');
  const totalPredators = wildlife.actors.filter((a) => a.category === 'night_predator').length;
  assert.ok(totalPredators >= 4);
  assert.equal(
    wildlife.actors.filter((a) => a.category === 'night_predator' && a.visible).length,
    0,
    'all night predators must be hidden in daytime'
  );

  // Early dusk: partial staggered emergence (some visible & ramping emergeAlpha, others still hidden)
  const earlyDuskT = CONFIG.DAY_NIGHT.DUSK_START + (CONFIG.DAY_NIGHT.NIGHT_START - CONFIG.DAY_NIGHT.DUSK_START) * 0.28;
  stepWildlifeSystem(wildlife, 0.35, false, 0, 0, false, 1, false, world, null, false, earlyDuskT, 'dusk');
  const visibleEarly = wildlife.actors.filter((a) => a.category === 'night_predator' && a.visible);
  assert.ok(
    visibleEarly.length > 0 && visibleEarly.length < totalPredators,
    `expected staggered partial emergence in early dusk (${visibleEarly.length}/${totalPredators})`
  );
  assert.ok(
    visibleEarly.some((a) => (a.emergeAlpha ?? 1) < 0.9),
    'emerging predators should ramp emergeAlpha smoothly during dusk'
  );

  // Emerging predator should not immediately windup/ambush until emergence completes
  const emergingWolf = visibleEarly.find((a) => (a.emergeAlpha ?? 1) < 0.5);
  if (emergingWolf) {
    emergingWolf.x = 20;
    emergingWolf.z = 20;
    emergingWolf.attackCooldown = 0;
    stepWildlifeSystem(wildlife, 0.1, false, 21, 20, false, 1, false, world, null, false, earlyDuskT, 'dusk');
    assert.equal(emergingWolf.attackState, 'idle', 'emerging predator should not attack while still fading in');
  }

  // Late dusk -> full night: all predators emerge
  const nightT = CONFIG.DAY_NIGHT.NIGHT_START + 0.04;
  for (let i = 0; i < 8; i += 1) {
    stepWildlifeSystem(wildlife, 0.3, true, 0, 0, false, 1, false, world, null, false, nightT, 'night');
  }
  const visibleNight = wildlife.actors.filter((a) => a.category === 'night_predator' && a.visible);
  assert.equal(visibleNight.length, totalPredators, 'all night predators must finish emerging by nightfall');
});

