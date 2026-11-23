import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './config';
import {
  computeVirtualJoystickVector,
  detectBiomeAt,
  generateIslandWorld,
  groundHeightAt,
  isPointInsideWalkableShore,
  stepPlayerPhysics,
} from './world';

test('generateIslandWorld produces large deterministic 5-biome archipelago with weird props', () => {
  const worldA = generateIslandWorld('archipelago-seed-a');
  const worldB = generateIslandWorld('archipelago-seed-a');
  const worldC = generateIslandWorld('archipelago-seed-b');

  assert.deepEqual(worldA, worldB);
  assert.notDeepEqual(worldA.props, worldC.props);
  assert.ok(worldA.props.length >= 60);
  assert.ok(worldA.props.some((p) => p.kind === 'mushroom'));
  assert.ok(worldA.props.some((p) => p.kind === 'column'));
  assert.ok(worldA.props.some((p) => p.kind === 'jungle'));
  assert.equal(worldA.connectors.length, 11);

  for (const prop of worldA.props) {
    const distFromSpawn = Math.hypot(prop.x - CONFIG.WORLD.SPAWN_X, prop.z - CONFIG.WORLD.SPAWN_Z);
    assert.ok(
      distFromSpawn >= CONFIG.WORLD.SPAWN_CLEAR_RADIUS + prop.radius - 0.01,
      `Prop ${prop.id} too close to spawn: ${distFromSpawn}`
    );
    assert.ok(isPointInsideWalkableShore(prop.x, prop.z, worldA));
  }
});

test('groundHeightAt returns accurate heights across all 5 biomes, sea, and bridges', () => {
  const world = generateIslandWorld('biome-heights');

  assert.equal(groundHeightAt(95, 95, world), 0);
  assert.equal(groundHeightAt(0, 0, world), CONFIG.ISLAND.CENTER.GRASS_TOP_Y);
  assert.equal(
    groundHeightAt(CONFIG.ISLAND.CENTER.KNOLL_CX, CONFIG.ISLAND.CENTER.KNOLL_CZ, world),
    CONFIG.ISLAND.CENTER.KNOLL_TOP_Y
  );
  assert.equal(
    groundHeightAt(CONFIG.ISLAND.RUINS.CX + 2.5, CONFIG.ISLAND.RUINS.CZ, world),
    CONFIG.ISLAND.RUINS.PLAZA_TOP_Y
  );
  assert.equal(
    groundHeightAt(CONFIG.ISLAND.VOLCANO.CX - 3.0, CONFIG.ISLAND.VOLCANO.CZ + 2.5, world),
    CONFIG.ISLAND.VOLCANO.CRATER_TOP_Y
  );
  assert.equal(
    groundHeightAt(CONFIG.ISLAND.MUSHROOM.CX, CONFIG.ISLAND.MUSHROOM.CZ, world),
    CONFIG.ISLAND.MUSHROOM.GROVE_TOP_Y
  );
  assert.equal(
    groundHeightAt(CONFIG.ISLAND.SHIPWRECK.SPIT_CX, CONFIG.ISLAND.SHIPWRECK.SPIT_CZ, world),
    CONFIG.ISLAND.SHIPWRECK.SPIT_TOP_Y
  );

  // Every bridge and ramp midpoint must be walkable and elevated above sea level
  for (const conn of world.connectors) {
    const midX = (conn.x0 + conn.x1) * 0.5;
    const midZ = (conn.z0 + conn.z1) * 0.5;
    const midY = groundHeightAt(midX, midZ, world);
    assert.ok(midY >= CONFIG.ISLAND.BEACH_HEIGHT, `Connector ${conn.id} sank to ${midY}`);
    assert.equal(isPointInsideWalkableShore(midX, midZ, world), true, `Connector ${conn.id} not walkable`);
  }
});

test('stepPlayerPhysics walks across bridges into outer biomes and detects biomes accurately', () => {
  const world = generateIslandWorld('traversal-test');
  const start = { x: CONFIG.WORLD.SPAWN_X, z: CONFIG.WORLD.SPAWN_Z };
  assert.equal(detectBiomeAt(start.x, start.z, world), 'center');

  // Verify walking across south ramp and onto wooden fishing pier works smoothly
  const southRamp = world.connectors.find((c) => c.id === 'ramp-center-south')!;
  let cur = { x: southRamp.x0, z: southRamp.z0 - 0.3 };
  for (let i = 0; i < 30; i += 1) {
    const next = stepPlayerPhysics(cur, 0, 1, 0.05, world);
    cur = { x: next.x, z: next.z };
  }
  assert.ok(cur.z > southRamp.z1, `Failed to descend south ramp: stuck at z=${cur.z}`);

  // Verify walking across Ruins Stone Bridge reaches the Ruins Island beach
  const ruinsBridge = world.connectors.find((c) => c.id === 'bridge-center-ruins')!;
  const dirX = ruinsBridge.x1 - ruinsBridge.x0;
  const dirZ = ruinsBridge.z1 - ruinsBridge.z0;
  const dirLen = Math.hypot(dirX, dirZ);
  let bridgeWalk = { x: ruinsBridge.x0, z: ruinsBridge.z0 };
  for (let i = 0; i < 35; i += 1) {
    const next = stepPlayerPhysics(bridgeWalk, dirX / dirLen, dirZ / dirLen, 0.05, world);
    bridgeWalk = { x: next.x, z: next.z };
  }
  assert.equal(detectBiomeAt(bridgeWalk.x, bridgeWalk.z, world), 'ruins');
});

test('stepPlayerPhysics resolves solid prop & caldera obstacle collisions without clipping', () => {
  const world = generateIslandWorld('collision-test');
  const targetProp = world.props.find((p) => p.kind === 'rock' || p.kind === 'palm')!;
  const nearProp = {
    x: targetProp.x - (CONFIG.PLAYER.RADIUS + targetProp.radius + 0.05),
    z: targetProp.z,
  };
  const pushed = stepPlayerPhysics(nearProp, 1, 0, 0.5, world);
  const distToProp = Math.hypot(pushed.x - targetProp.x, pushed.z - targetProp.z);
  assert.ok(distToProp >= CONFIG.PLAYER.RADIUS + targetProp.radius - 0.02);
});

test('computeVirtualJoystickVector handles deadzone, direction, and maxRadius clamping', () => {
  const idle = computeVirtualJoystickVector(100, 100, 102, 102, 50, 0.15);
  assert.equal(idle.dx, 0);
  assert.equal(idle.dy, 0);
  assert.equal(idle.magnitude, 0);

  const fullRight = computeVirtualJoystickVector(100, 100, 220, 100, 50, 0.1);
  assert.ok(Math.abs(fullRight.dx - 1) < 1e-6);
  assert.ok(Math.abs(fullRight.dy) < 1e-6);
  assert.equal(fullRight.knobX, 50);
  assert.equal(fullRight.knobY, 0);
  assert.ok(Math.abs(fullRight.magnitude - 1) < 1e-6);
});
