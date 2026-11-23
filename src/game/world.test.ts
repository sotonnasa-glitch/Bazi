import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './config';
import {
  computeVirtualJoystickVector,
  detectBiomeAt,
  generateIslandWorld,
  groundHeightAt,
  stepPlayerPhysics,
} from './world';

test('generateIslandWorld produces large deterministic 6-region bridge-free island with 6 tree species & landmarks', () => {
  const w1 = generateIslandWorld('continuous-seed-a');
  const w2 = generateIslandWorld('continuous-seed-a');
  const w3 = generateIslandWorld('continuous-seed-b');

  assert.equal(w1.props.length, w2.props.length);
  assert.deepEqual(w1.obstacles, w2.obstacles);
  assert.notEqual(w1.lobePhaseA, w3.lobePhaseA);

  const kinds = new Set(w1.props.map((p) => p.kind));
  assert.ok(kinds.has('palm'));
  assert.ok(kinds.has('jungle'));
  assert.ok(kinds.has('pine'));
  assert.ok(kinds.has('banana'));
  assert.ok(kinds.has('banyan'));
  assert.ok(kinds.has('willow'));
  assert.ok(kinds.has('rock'));
  assert.ok(kinds.has('bush'));
  assert.ok(kinds.has('shell'));
  assert.ok(kinds.has('mushroom'));
  assert.ok(kinds.has('column'));
  assert.ok(kinds.has('crystal'));

  assert.equal(w1.fishingSpots.length, 6);
  // Every offshore fish school sits in ocean water, NOT up on the beach!
  for (const spot of w1.fishingSpots) {
    assert.ok(
      groundHeightAt(spot.waterX, spot.waterZ, w1) <= -0.4,
      `fishing school ${spot.id} must be offshore in water`
    );
    assert.ok(
      groundHeightAt(spot.x, spot.z, w1) >= CONFIG.WORLD.MIN_WADE_HEIGHT,
      `fishing wade spot ${spot.id} must be reachable in shallow surf`
    );
  }

  assert.equal(w1.buildPads.length, 3);
  assert.equal(w1.landmarkSites.length, 5);
  assert.ok(w1.props.length >= 520, `expected >= 520 dense props across huge island, got ${w1.props.length}`);
});

test('groundHeightAt returns accurate heights across sea, beach, hills, volcano peak, and ruins', () => {
  const world = generateIslandWorld('height-test');
  const { RUINS, VOLCANO, MUSHROOM, SPRING } = CONFIG.ISLAND;

  assert.ok(groundHeightAt(0, 0, world) > 1.4, 'center meadow must be elevated land');
  assert.ok(groundHeightAt(125, 125, world) < -1.5, 'far ocean must be deep seabed');
  assert.ok(groundHeightAt(RUINS.CX, RUINS.CZ, world) > 2.8, 'ruins temple plateau must be raised');
  assert.ok(groundHeightAt(VOLCANO.CX + 5.2, VOLCANO.CZ, world) > 5.5, 'volcano rim must rise into a peak');
  assert.ok(
    groundHeightAt(VOLCANO.CX, VOLCANO.CZ, world) < groundHeightAt(VOLCANO.CX + 5.2, VOLCANO.CZ, world),
    'volcano caldera center must dip below crater rim'
  );
  assert.ok(groundHeightAt(MUSHROOM.CX, MUSHROOM.CZ, world) > 1.2, 'mushroom forest must be dry land');
  assert.ok(groundHeightAt(SPRING.CX, SPRING.CZ, world) < groundHeightAt(SPRING.CX + 6.8, SPRING.CZ, world), 'crystal spring basin must sit below its stone rim');
});

test('stepPlayerPhysics traverses seamlessly from center to outer biomes without bridges', () => {
  const world = generateIslandWorld('walk-continuous');
  const { RUINS, MUSHROOM, SPRING } = CONFIG.ISLAND;

  const walkToward = (startX: number, startZ: number, targetX: number, targetZ: number, steps: number) => {
    let pos = { x: startX, z: startZ };
    for (let i = 0; i < steps; i += 1) {
      const dx = targetX - pos.x;
      const dz = targetZ - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5) break;
      const res = stepPlayerPhysics(pos, dx / d, dz / d, 0.05, world);
      pos = { x: res.x, z: res.z };
    }
    return pos;
  };

  // Walk smoothly from Center Spawn to Ancient Ruins Plaza entrance
  const nearRuins = walkToward(CONFIG.WORLD.SPAWN_X, CONFIG.WORLD.SPAWN_Z, RUINS.CX + 5, RUINS.CZ + 5, 220);
  assert.equal(detectBiomeAt(nearRuins.x, nearRuins.z, world), 'ruins');

  // Walk smoothly from Center Spawn to Mushroom Forest
  const nearMush = walkToward(CONFIG.WORLD.SPAWN_X, CONFIG.WORLD.SPAWN_Z, MUSHROOM.CX + 4, MUSHROOM.CZ - 3, 220);
  assert.equal(detectBiomeAt(nearMush.x, nearMush.z, world), 'mushroom');

  // Walk smoothly North to Crystal Spring rim
  const nearSpring = walkToward(CONFIG.WORLD.SPAWN_X, CONFIG.WORLD.SPAWN_Z, SPRING.CX, SPRING.CZ + 7.5, 220);
  assert.equal(detectBiomeAt(nearSpring.x, nearSpring.z, world), 'spring');
});

test('stepPlayerPhysics allows shallow wading up to MIN_WADE_HEIGHT and blocks deep ocean', () => {
  const world = generateIslandWorld('collision-test');

  // Walk straight South off the coast until shoreline wading clamp holds
  let pos = { x: 0, z: 45 };
  for (let i = 0; i < 160; i += 1) {
    const res = stepPlayerPhysics(pos, 0, 1, 0.05, world);
    pos = { x: res.x, z: res.z };
  }
  const h = groundHeightAt(pos.x, pos.z, world);
  assert.ok(h >= CONFIG.WORLD.MIN_WADE_HEIGHT - 0.02);
  assert.ok(h <= 0.05, `expected player able to wade slightly into water, got h=${h}`);

  // Caldera lava collider pushback
  const obs = world.obstacles[1]; // obs-caldera
  const stepIntoLava = stepPlayerPhysics(
    { x: obs.x + obs.radius + CONFIG.PLAYER.RADIUS + 0.08, z: obs.z },
    -1,
    0,
    0.05,
    world
  );
  assert.ok(
    Math.hypot(stepIntoLava.x - obs.x, stepIntoLava.z - obs.z) >= CONFIG.PLAYER.RADIUS + obs.radius - 0.01
  );
});

test('computeVirtualJoystickVector handles deadzone, direction, and maxRadius clamping', () => {
  const idle = computeVirtualJoystickVector(100, 100, 102, 102, 54, 0.12);
  assert.equal(idle.dx, 0);
  assert.equal(idle.dy, 0);
  assert.equal(idle.magnitude, 0);

  const clamped = computeVirtualJoystickVector(100, 100, 220, 100, 54, 0.12);
  assert.ok(Math.abs(clamped.knobX - 54) < 1e-4);
  assert.ok(Math.abs(clamped.dx - 1) < 1e-4);
  assert.equal(clamped.magnitude, 1);
});
