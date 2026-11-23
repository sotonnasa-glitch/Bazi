import { CONFIG, type BiomeId, type CampUpgradeId, type StrangeLandmarkId } from './config';
import { createSeededRandom } from './utils';

export type PropKind =
  | 'palm'
  | 'jungle'
  | 'pine'
  | 'banana'
  | 'banyan'
  | 'willow'
  | 'rock'
  | 'bush'
  | 'shell'
  | 'mushroom'
  | 'column'
  | 'crystal';

export interface IslandProp {
  id: string;
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  radius: number;
  scale: number;
  rotationY: number;
  variant: number;
}

export interface FishingSpot {
  id: string;
  x: number;
  y: number;
  z: number;
  waterX: number;
  waterZ: number;
  waterAngle: number;
}

export interface BuildPadSite {
  id: CampUpgradeId;
  x: number;
  y: number;
  z: number;
  rotationY: number;
}

export interface LandmarkActionSite {
  id: StrangeLandmarkId;
  x: number;
  y: number;
  z: number;
}

export interface IslandWorldData {
  seed: string;
  lobePhaseA: number;
  lobePhaseB: number;
  lobePhaseC: number;
  obstacles: Array<{ id: string; x: number; z: number; radius: number }>;
  props: IslandProp[];
  fishingSpots: FishingSpot[];
  buildPads: BuildPadSite[];
  landmarkSites: LandmarkActionSite[];
}

export interface Vector2 {
  x: number;
  z: number;
}

export interface JoystickVector {
  dx: number;
  dy: number;
  knobX: number;
  knobY: number;
  magnitude: number;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function contourScaleAtAngle(phi: number, phaseA: number, phaseB: number): number {
  return (
    1 +
    0.095 * Math.cos(3 * phi + phaseA) +
    0.065 * Math.sin(5 * phi + phaseB) +
    0.045 * Math.cos(2 * phi - 0.6)
  );
}

export function normalizedCoastDistance(
  x: number,
  z: number,
  world: Pick<IslandWorldData, 'lobePhaseA' | 'lobePhaseB'>
): number {
  const nx = x / CONFIG.WORLD.ISLAND_RX;
  const nz = z / CONFIG.WORLD.ISLAND_RZ;
  const phi = Math.atan2(nz, nx);
  const scale = contourScaleAtAngle(phi, world.lobePhaseA, world.lobePhaseB);
  return Math.hypot(nx, nz) / scale;
}

export function groundHeightAt(
  x: number,
  z: number,
  world: Pick<IslandWorldData, 'lobePhaseA' | 'lobePhaseB' | 'lobePhaseC'>
): number {
  const pA = world.lobePhaseA;
  const pB = world.lobePhaseB;
  const pC = world.lobePhaseC;
  const { CENTER, RUINS, VOLCANO, MUSHROOM, SHIPWRECK, SPRING } = CONFIG.ISLAND;

  const rCoast = normalizedCoastDistance(x, z, world);

  let h = 1.95;
  if (rCoast > 0.63) {
    const beachT = smoothstep(0.63, 0.93, rCoast);
    const seaT = smoothstep(0.93, 1.25, rCoast);
    h = lerp(1.95, 0.16, beachT);
    h = lerp(h, -2.75, seaT);
  }

  const undulation =
    0.42 * Math.sin(x * 0.085 + pA) * Math.cos(z * 0.09 + pB) +
    0.24 * Math.sin((x + z) * 0.14 + pC) +
    0.16 * Math.cos(x * 0.22 - z * 0.18);

  const inlandMask = 1 - smoothstep(0.69, 0.94, rCoast);
  h += undulation * inlandMask;

  const dSouthBay = Math.hypot((x - 5) / 22, (z - 63) / 16);
  h -= (1 - smoothstep(0.25, 1.0, dSouthBay)) * 1.5;

  const dShipCove = Math.hypot((x - 42) / 18, (z - 37) / 14);
  h = lerp(h, 0.62, (1 - smoothstep(0.25, 0.95, dShipCove)) * 0.78);

  const dHeadland = Math.hypot((x - SHIPWRECK.HEADLAND_CX) / 11.5, (z - SHIPWRECK.HEADLAND_CZ) / 10.0);
  h += (1 - smoothstep(0.18, 1.0, dHeadland)) * 2.35;

  const dKnoll = Math.hypot((x - CENTER.KNOLL_CX) / 13.0, (z - CENTER.KNOLL_CZ) / 11.0);
  h += (1 - smoothstep(0.15, 1.0, dKnoll)) * 1.9;
  const dEastHill = Math.hypot((x - 19) / 14.0, (z - 12) / 12.0);
  h += (1 - smoothstep(0.15, 1.0, dEastHill)) * 1.35;

  const dRuins = Math.hypot((x - RUINS.CX) / 16.0, (z - RUINS.CZ) / 14.0);
  const ruinsWeight = 1 - smoothstep(0.58, 1.0, dRuins);
  h = lerp(h, 3.35, ruinsWeight);

  const dMush = Math.hypot((x - MUSHROOM.CX) / 18.0, (z - MUSHROOM.CZ) / 16.0);
  h = lerp(h, 1.85 + undulation * 0.35, (1 - smoothstep(0.35, 1.0, dMush)) * 0.7);

  const dSpring = Math.hypot(x - SPRING.CX, z - SPRING.CZ);
  const springRim = Math.exp(-Math.pow((dSpring - 6.8) / 2.4, 2)) * 1.1;
  const springBasin = (1 - smoothstep(3.8, 6.2, dSpring)) * 1.15;
  h += springRim - springBasin;

  const dVolc = Math.hypot(x - VOLCANO.CX, z - VOLCANO.CZ);
  if (dVolc < VOLCANO.BASE_RADIUS) {
    const outerSlope = 1 - smoothstep(5.4, VOLCANO.BASE_RADIUS, dVolc);
    const craterPit = 1 - smoothstep(3.0, 5.4, dVolc);
    const coneHeight = outerSlope * 6.3 - craterPit * 2.95;
    const volcPhi = Math.atan2(z - VOLCANO.CZ, x - VOLCANO.CX);
    const flankMask = smoothstep(5.5, 10.5, dVolc) * outerSlope;
    const flankRib = (0.38 * Math.cos(volcPhi * 6 + pC) + 0.2 * Math.sin(volcPhi * 4)) * flankMask;
    const bowlBlend = 1 - smoothstep(3.6, 5.6, dVolc);
    const rawH = h + coneHeight + flankRib;
    h = lerp(rawH, 4.4 + (dVolc / 4.2) * 0.45, bowlBlend * 0.88);
  }

  return h;
}

export function detectBiomeAt(
  x: number,
  z: number,
  _world?: Pick<IslandWorldData, 'lobePhaseA' | 'lobePhaseB' | 'lobePhaseC'>
): BiomeId {
  const { RUINS, VOLCANO, MUSHROOM, SHIPWRECK, SPRING } = CONFIG.ISLAND;
  if (Math.hypot(x - RUINS.CX, z - RUINS.CZ) <= 21.0) return 'ruins';
  if (Math.hypot(x - VOLCANO.CX, z - VOLCANO.CZ) <= 26.0) return 'volcano';
  if (Math.hypot(x - MUSHROOM.CX, z - MUSHROOM.CZ) <= 22.0) return 'mushroom';
  if (Math.hypot(x - SHIPWRECK.CX, z - SHIPWRECK.CZ) <= 25.0) return 'shipwreck';
  if (Math.hypot(x - SPRING.CX, z - SPRING.CZ) <= 17.5) return 'spring';
  return 'center';
}

export interface SurfaceRGB {
  r: number;
  g: number;
  b: number;
}

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const lenSq = vx * vx + vz * vz;
  const t = lenSq > 1e-6 ? Math.max(0, Math.min(1, (wx * vx + wz * vz) / lenSq)) : 0;
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

export function computeTerrainVertexColor(
  x: number,
  y: number,
  z: number,
  normalY: number,
  world: Pick<IslandWorldData, 'lobePhaseA' | 'lobePhaseB' | 'lobePhaseC'>
): SurfaceRGB {
  const { RUINS, VOLCANO, MUSHROOM, SHIPWRECK, SPRING } = CONFIG.ISLAND;

  const wetSand: [number, number, number] = [0.78, 0.64, 0.38];
  const warmSand: [number, number, number] = [0.97, 0.86, 0.56];
  const grassRich: [number, number, number] = [0.27, 0.64, 0.21];
  const grassSunny: [number, number, number] = [0.46, 0.78, 0.24];

  const sandToGrass = smoothstep(1.08, 1.62, y);
  const wetToDry = smoothstep(-0.18, 0.42, y);
  const macroNoise =
    0.5 + 0.5 * Math.sin(x * 0.13 + world.lobePhaseA) * Math.cos(z * 0.13 - world.lobePhaseB);

  let r = lerp(lerp(wetSand[0], warmSand[0], wetToDry), lerp(grassRich[0], grassSunny[0], macroNoise), sandToGrass);
  let g = lerp(lerp(wetSand[1], warmSand[1], wetToDry), lerp(grassRich[1], grassSunny[1], macroNoise), sandToGrass);
  let b = lerp(lerp(wetSand[2], warmSand[2], wetToDry), lerp(grassRich[2], grassSunny[2], macroNoise), sandToGrass);

  if (y > 1.25 && y < 3.6) {
    const wiggle = Math.sin((x + z) * 0.17 + world.lobePhaseC) * 1.4;
    const minTrail = Math.min(
      distToSegment(x + wiggle * 0.5, z, 0, 4, RUINS.CX + 6, RUINS.CZ + 5),
      distToSegment(x, z + wiggle * 0.5, 0, 4, VOLCANO.CX - 13, VOLCANO.CZ + 7),
      distToSegment(x + wiggle * 0.5, z, 0, 4, MUSHROOM.CX + 6, MUSHROOM.CZ - 5),
      distToSegment(x, z + wiggle * 0.5, 0, 4, SHIPWRECK.CX - 6, SHIPWRECK.CZ - 5),
      distToSegment(x + wiggle * 0.6, z, 0, 2, SPRING.CX, SPRING.CZ + 8),
      distToSegment(x + wiggle * 0.4, z, 0, 6, 4, 48)
    );
    const trailMask = (1 - smoothstep(1.3, 3.0, minTrail)) * smoothstep(1.25, 1.65, y);
    r = lerp(r, 0.78, trailMask * 0.68);
    g = lerp(g, 0.65, trailMask * 0.68);
    b = lerp(b, 0.42, trailMask * 0.68);
  }

  if (y > 0.75) {
    const cliffBlend = 1 - smoothstep(0.74, 0.91, normalY);
    r = lerp(r, 0.48, cliffBlend * 0.92);
    g = lerp(g, 0.41, cliffBlend * 0.92);
    b = lerp(b, 0.35, cliffBlend * 0.92);
  }

  const dRuins = Math.hypot((x - RUINS.CX) / 16.0, (z - RUINS.CZ) / 14.0);
  const ruinsMix = (1 - smoothstep(0.55, 0.98, dRuins)) * smoothstep(2.0, 2.9, y);
  r = lerp(r, 0.56, ruinsMix);
  g = lerp(g, 0.61, ruinsMix);
  b = lerp(b, 0.65, ruinsMix);

  const dVolc = Math.hypot(x - VOLCANO.CX, z - VOLCANO.CZ);
  const volcMix = (1 - smoothstep(13.0, 24.5, dVolc)) * smoothstep(2.0, 3.5, y);
  const emberRim = Math.exp(-Math.pow((dVolc - 5.2) / 1.9, 2));
  r = lerp(r, 0.22, volcMix);
  g = lerp(g, 0.19, volcMix);
  b = lerp(b, 0.25, volcMix);
  r = lerp(r, 0.78, emberRim * 0.78);
  g = lerp(g, 0.28, emberRim * 0.78);
  b = lerp(b, 0.11, emberRim * 0.78);

  const dMush = Math.hypot((x - MUSHROOM.CX) / 18.0, (z - MUSHROOM.CZ) / 16.0);
  const mushMix = (1 - smoothstep(0.32, 0.95, dMush)) * smoothstep(0.95, 1.45, y);
  r = lerp(r, 0.15, mushMix * 0.86);
  g = lerp(g, 0.54, mushMix * 0.86);
  b = lerp(b, 0.35, mushMix * 0.86);

  const dSpring = Math.hypot(x - SPRING.CX, z - SPRING.CZ);
  const springMix = 1 - smoothstep(5.5, 12.5, dSpring);
  r = lerp(r, 0.32, springMix * 0.72);
  g = lerp(g, 0.58, springMix * 0.72);
  b = lerp(b, 0.62, springMix * 0.72);

  return { r, g, b };
}

export function generateIslandWorld(seed: string): IslandWorldData {
  const rng = createSeededRandom(seed);
  const lobePhaseA = rng() * Math.PI * 2;
  const lobePhaseB = rng() * Math.PI * 2;
  const lobePhaseC = rng() * Math.PI * 2;
  const meta = { lobePhaseA, lobePhaseB, lobePhaseC };
  const props: IslandProp[] = [];

  const { RUINS, VOLCANO, MUSHROOM, SHIPWRECK, SPRING, CAMPFIRE } = CONFIG.ISLAND;

  const obstacles: Array<{ id: string; x: number; z: number; radius: number }> = [
    { id: 'obs-obelisk', x: RUINS.CX, z: RUINS.CZ, radius: 1.9 },
    { id: 'obs-caldera', x: VOLCANO.CX, z: VOLCANO.CZ, radius: VOLCANO.CALDERA_COLLIDER_R },
    { id: 'obs-shipwreck', x: SHIPWRECK.HULL_CX, z: SHIPWRECK.HULL_CZ, radius: SHIPWRECK.HULL_COLLIDER_R },
    { id: 'obs-lighthouse', x: SHIPWRECK.LIGHTHOUSE_CX, z: SHIPWRECK.LIGHTHOUSE_CZ, radius: 1.35 },
    { id: 'obs-spring', x: SPRING.CX, z: SPRING.CZ, radius: SPRING.COLLIDER_R },
    { id: 'obs-campfire', x: CAMPFIRE.CX, z: CAMPFIRE.CZ, radius: CAMPFIRE.COLLIDER_R },
  ];

  // 6 Scenic Coastal Fishing Spots: wade slightly into shallow ocean water to spear fish swimming offshore!
  const fishingAngles = [
    Math.PI * 0.48, // South Lagoon cove (closest to Campfire!)
    Math.PI * 0.16, // SE near Shipwreck
    -Math.PI * 0.14, // East beach
    -Math.PI * 0.52, // North coast near Spring
    Math.PI * 0.86, // West cove
    Math.PI * 0.68, // SW Mushroom cove
  ];
  const fishingSpots: FishingSpot[] = [];
  fishingAngles.forEach((ang, idx) => {
    const dirX = Math.cos(ang);
    const dirZ = Math.sin(ang);
    let r = 40;
    let foundX = dirX * 72;
    let foundZ = dirZ * 62;
    for (let step = 0; step < 95; step += 1) {
      const tx = dirX * r;
      const tz = dirZ * r * (CONFIG.WORLD.ISLAND_RZ / CONFIG.WORLD.ISLAND_RX);
      const hy = groundHeightAt(tx, tz, meta);
      // Place spot right in the ankle-deep surf edge so player steps slightly into water!
      if (hy <= 0.02 && hy >= -0.3) {
        foundX = tx;
        foundZ = tz;
        break;
      }
      r += 0.9;
    }
    const spotY = groundHeightAt(foundX, foundZ, meta);
    // Keep fish schools well offshore in deep turquoise water (never onto the sand!)
    const waterDist = 4.6;
    fishingSpots.push({
      id: `fish-spot-${idx}`,
      x: foundX,
      y: spotY,
      z: foundZ,
      waterX: foundX + dirX * waterDist,
      waterZ: foundZ + dirZ * waterDist,
      waterAngle: Math.atan2(dirX, dirZ),
    });
  });

  const landmarkSites: LandmarkActionSite[] = [
    {
      id: 'ruins',
      x: RUINS.CX,
      y: groundHeightAt(RUINS.CX, RUINS.CZ, meta),
      z: RUINS.CZ,
    },
    {
      id: 'volcano',
      x: VOLCANO.CX - 6.8,
      y: groundHeightAt(VOLCANO.CX - 6.8, VOLCANO.CZ + 2.5, meta),
      z: VOLCANO.CZ + 2.5,
    },
    {
      id: 'mushroom',
      x: MUSHROOM.CX,
      y: groundHeightAt(MUSHROOM.CX, MUSHROOM.CZ, meta),
      z: MUSHROOM.CZ,
    },
    {
      id: 'shipwreck',
      x: SHIPWRECK.HULL_CX - 3.6,
      y: groundHeightAt(SHIPWRECK.HULL_CX - 3.6, SHIPWRECK.HULL_CZ - 1.2, meta),
      z: SHIPWRECK.HULL_CZ - 1.2,
    },
    {
      id: 'spring',
      x: SPRING.CX,
      y: groundHeightAt(SPRING.CX, SPRING.CZ + 6.4, meta),
      z: SPRING.CZ + 6.4,
    },
  ];

  // 3 Interactive Camp Build Pads (Shelter, Backpack Rack, South Fishing Pier)
  const southSpot = fishingSpots[0];
  const buildPads: BuildPadSite[] = [
    {
      id: 'shelter',
      x: 7.4,
      y: groundHeightAt(7.4, 2.2, meta),
      z: 2.2,
      rotationY: -0.35,
    },
    {
      id: 'rack',
      x: -2.4,
      y: groundHeightAt(-2.4, 2.0, meta),
      z: 2.0,
      rotationY: 0.35,
    },
    {
      id: 'pier',
      x: southSpot.x + Math.cos(southSpot.waterAngle) * 2.8 - Math.sin(southSpot.waterAngle) * 0.6,
      y: groundHeightAt(
        southSpot.x + Math.cos(southSpot.waterAngle) * 2.8 - Math.sin(southSpot.waterAngle) * 0.6,
        southSpot.z - Math.sin(southSpot.waterAngle) * 2.8 - Math.cos(southSpot.waterAngle) * 0.6,
        meta
      ),
      z: southSpot.z - Math.sin(southSpot.waterAngle) * 2.8 - Math.cos(southSpot.waterAngle) * 0.6,
      rotationY: southSpot.waterAngle,
    },
  ];

  // Spatial Hash Grid for ultra-fast O(1) prop placement checks across 650+ props!
  const cellSize = 4.0;
  const grid = new Map<string, IslandProp[]>();
  const cellKey = (cx: number, cz: number) => `${cx},${cz}`;
  const addProp = (prop: IslandProp) => {
    props.push(prop);
    const gx = Math.floor(prop.x / cellSize);
    const gz = Math.floor(prop.z / cellSize);
    const key = cellKey(gx, gz);
    const list = grid.get(key);
    if (list) list.push(prop);
    else grid.set(key, [prop]);
  };

  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + 0.22;
    const rx = RUINS.CX + Math.cos(a) * 6.8;
    const rz = RUINS.CZ + Math.sin(a) * 6.0;
    addProp({
      id: `column-${i}`,
      kind: 'column',
      x: rx,
      y: groundHeightAt(rx, rz, meta),
      z: rz,
      radius: 0.72,
      scale: i % 2 === 0 ? 1.08 : 0.85,
      rotationY: a,
      variant: i % 3,
    });
  }

  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + 0.45;
    const mx = SPRING.CX + Math.cos(a) * 7.6;
    const mz = SPRING.CZ + Math.sin(a) * 7.4;
    addProp({
      id: `monolith-${i}`,
      kind: 'column',
      x: mx,
      y: groundHeightAt(mx, mz, meta),
      z: mz,
      radius: 0.7,
      scale: 0.9 + (i % 2) * 0.22,
      rotationY: a,
      variant: 0,
    });
  }

  const slopeAt = (x: number, z: number): number => {
    const h0 = groundHeightAt(x, z, meta);
    const d = 0.8;
    const dx = Math.abs(groundHeightAt(x + d, z, meta) - h0) / d;
    const dz = Math.abs(groundHeightAt(x, z + d, meta) - h0) / d;
    return Math.max(dx, dz);
  };

  const canPlace = (
    x: number,
    z: number,
    radius: number,
    minY: number,
    maxY: number,
    maxSlope = 0.54,
    keepTrailsClear = false
  ): boolean => {
    const y = groundHeightAt(x, z, meta);
    if (y < minY || y > maxY) return false;
    if (slopeAt(x, z) > maxSlope) return false;

    const distSpawn = Math.hypot(x - CONFIG.WORLD.SPAWN_X, z - CONFIG.WORLD.SPAWN_Z);
    if (distSpawn < CONFIG.WORLD.SPAWN_CLEAR_RADIUS + radius) return false;

    // Keep central Campfire clearing & build pads clear of trees/rocks
    const distCamp = Math.hypot(x - CAMPFIRE.CX, z - CAMPFIRE.CZ);
    if (distCamp < 4.6 + radius) return false;

    for (const pad of buildPads) {
      if (Math.hypot(x - pad.x, z - pad.z) < 2.6 + radius) return false;
    }
    for (const spot of fishingSpots) {
      if (Math.hypot(x - spot.x, z - spot.z) < 2.8 + radius) return false;
    }

    if (keepTrailsClear) {
      const minTrail = Math.min(
        distToSegment(x, z, 0, 4, RUINS.CX + 6, RUINS.CZ + 5),
        distToSegment(x, z, 0, 4, VOLCANO.CX - 13, VOLCANO.CZ + 7),
        distToSegment(x, z, 0, 4, MUSHROOM.CX + 6, MUSHROOM.CZ - 5),
        distToSegment(x, z, 0, 4, SHIPWRECK.CX - 6, SHIPWRECK.CZ - 5),
        distToSegment(x, z, 0, 2, SPRING.CX, SPRING.CZ + 8),
        distToSegment(x, z, 0, 6, southSpot.x, southSpot.z)
      );
      if (minTrail < 2.3 + radius) return false;
    }

    for (const obs of obstacles) {
      if (Math.hypot(x - obs.x, z - obs.z) < obs.radius + radius + 1.45) {
        return false;
      }
    }

    const gx = Math.floor(x / cellSize);
    const gz = Math.floor(z / cellSize);
    for (let ox = -1; ox <= 1; ox += 1) {
      for (let oz = -1; oz <= 1; oz += 1) {
        const bucket = grid.get(cellKey(gx + ox, gz + oz));
        if (!bucket) continue;
        for (const existing of bucket) {
          const minGap = Math.max(CONFIG.WORLD.MIN_PROP_SPACING, existing.radius + radius + 0.72);
          if (Math.hypot(x - existing.x, z - existing.z) < minGap) {
            return false;
          }
        }
      }
    }
    return true;
  };

  const scatterDisk = (
    kind: PropKind,
    count: number,
    colliderRadius: number,
    cx: number,
    cz: number,
    rx: number,
    rz: number,
    rMin: number,
    rMax: number,
    minY: number,
    maxY: number,
    scaleMin: number,
    scaleMax: number,
    variants = 3,
    maxSlope = 0.54,
    keepTrailsClear = false
  ) => {
    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 38;
    while (placed < count && attempts < maxAttempts) {
      attempts += 1;
      const phi = rng() * Math.PI * 2;
      const r = rMin + Math.sqrt(rng()) * (rMax - rMin);
      const x = cx + Math.cos(phi) * rx * r;
      const z = cz + Math.sin(phi) * rz * r;
      const scale = scaleMin + rng() * (scaleMax - scaleMin);
      const scaledRadius = colliderRadius * scale;

      if (!canPlace(x, z, scaledRadius, minY, maxY, maxSlope, keepTrailsClear)) continue;

      addProp({
        id: `${kind}-${props.length}`,
        kind,
        x,
        y: groundHeightAt(x, z, meta),
        z,
        radius: scaledRadius,
        scale,
        rotationY: rng() * Math.PI * 2,
        variant: Math.floor(rng() * variants),
      });
      placed += 1;
    }
  };

  // Dense Coastal Palms ringing the expanded beaches & bays
  scatterDisk('palm', CONFIG.PROPS.PALM_COUNT, CONFIG.PROPS.PALM_COLLIDER_RADIUS, 0, 0, CONFIG.WORLD.ISLAND_RX, CONFIG.WORLD.ISLAND_RZ, 0.62, 0.94, 0.25, 1.75, 0.96, 1.44, 3, 0.56, true);

  // Climbable Banana Trees (never felled — player climbs trunk to pick bananas!)
  scatterDisk('banana', Math.floor(CONFIG.PROPS.BANANA_TREE_COUNT * 0.55), CONFIG.PROPS.BANANA_COLLIDER_RADIUS, 0, 4, 42, 36, 0.14, 0.88, 1.25, 3.6, 0.95, 1.28, 3, 0.52, true);
  scatterDisk('banana', Math.ceil(CONFIG.PROPS.BANANA_TREE_COUNT * 0.45), CONFIG.PROPS.BANANA_COLLIDER_RADIUS, 0, 0, 74, 62, 0.42, 0.84, 1.15, 3.4, 0.95, 1.28, 3, 0.52, true);

  // Sprawling Ancient Banyan Trees with hanging roots — concentrated in the Center Forest!
  scatterDisk('banyan', CONFIG.PROPS.BANYAN_TREE_COUNT, CONFIG.PROPS.BANYAN_COLLIDER_RADIUS, 0, 2, 46, 40, 0.12, 0.92, 1.45, 3.9, 0.95, 1.32, 3, 0.48, true);

  // Mystic Luminous Willow Trees near Crystal Spring & Mushroom Forest
  scatterDisk('willow', Math.floor(CONFIG.PROPS.WILLOW_TREE_COUNT * 0.55), CONFIG.PROPS.WILLOW_COLLIDER_RADIUS, SPRING.CX, SPRING.CZ, 22, 20, 0.38, 0.95, 1.25, 3.6, 0.92, 1.3, 2, 0.52, false);
  scatterDisk('willow', Math.ceil(CONFIG.PROPS.WILLOW_TREE_COUNT * 0.45), CONFIG.PROPS.WILLOW_COLLIDER_RADIUS, MUSHROOM.CX, MUSHROOM.CZ, 22, 20, 0.25, 0.95, 1.25, 3.5, 0.92, 1.3, 2, 0.52, false);

  // Lush Dense Broadleaf & Flowering Jungle Trees (extra inner ring so center of map is rich!)
  scatterDisk('jungle', 95, CONFIG.PROPS.JUNGLE_COLLIDER_RADIUS, 0, 3, 38, 34, 0.16, 0.94, 1.35, 4.1, 0.92, 1.38, 5, 0.5, true);
  scatterDisk('jungle', CONFIG.PROPS.JUNGLE_TREE_COUNT - 95, CONFIG.PROPS.JUNGLE_COLLIDER_RADIUS, 0, 2, 78, 66, 0.25, 0.88, 1.35, 4.3, 0.96, 1.45, 5, 0.5, true);

  // Tall Sculpted Tropical Pine / Evergreen Groves
  scatterDisk('pine', CONFIG.PROPS.PINE_TREE_COUNT, CONFIG.PROPS.PINE_COLLIDER_RADIUS, 0, -4, 74, 62, 0.16, 0.88, 1.6, 5.2, 0.96, 1.42, 3, 0.54, true);

  // Decorative Natural Boulders (scenery only — stone mining removed!)
  scatterDisk('rock', CONFIG.PROPS.ROCK_COUNT, CONFIG.PROPS.ROCK_COLLIDER_RADIUS, 0, 0, 80, 68, 0.14, 0.94, 0.7, 7.2, 0.85, 1.42, 3, 0.68, true);

  // Abundant Berry Bushes across center meadows & sunlit clearings
  scatterDisk('bush', 48, CONFIG.PROPS.BUSH_COLLIDER_RADIUS, 0, 3, 36, 32, 0.12, 0.95, 1.3, 3.9, 0.88, 1.24, 2, 0.5, false);
  scatterDisk('bush', CONFIG.PROPS.BUSH_COUNT - 48, CONFIG.PROPS.BUSH_COLLIDER_RADIUS, 0, 2, 74, 62, 0.25, 0.85, 1.35, 3.9, 0.88, 1.24, 2, 0.5, false);

  // Foragable Beach Seashells & Conches along the wider sandy coastlines (zero collision!)
  scatterDisk('shell', CONFIG.PROPS.SHELL_COUNT, 0, 0, 0, CONFIG.WORLD.ISLAND_RX, CONFIG.WORLD.ISLAND_RZ, 0.64, 0.95, 0.08, 1.25, 0.9, 1.35, 3, 0.55, false);

  // Giant Bioluminescent Mushrooms in Mushroom Forest
  scatterDisk('mushroom', CONFIG.PROPS.GIANT_MUSHROOM_COUNT, CONFIG.PROPS.MUSHROOM_COLLIDER_RADIUS, MUSHROOM.CX, MUSHROOM.CZ, MUSHROOM.RADIUS, MUSHROOM.RADIUS * 0.9, 0.08, 0.9, 1.3, 3.4, 0.95, 1.44, 2, 0.48, false);

  // Glowing Crystal Clusters near Crystal Spring and Mushroom Grove
  scatterDisk('crystal', 12, CONFIG.PROPS.CRYSTAL_COLLIDER_RADIUS, SPRING.CX, SPRING.CZ, 14.5, 13.5, 0.42, 0.95, 1.3, 3.6, 0.9, 1.4, 2, 0.65, false);
  scatterDisk('crystal', 12, CONFIG.PROPS.CRYSTAL_COLLIDER_RADIUS, MUSHROOM.CX, MUSHROOM.CZ, 15.5, 14.5, 0.22, 0.92, 1.3, 3.4, 0.85, 1.3, 2, 0.62, false);

  return {
    seed,
    lobePhaseA,
    lobePhaseB,
    lobePhaseC,
    obstacles,
    props,
    fishingSpots,
    buildPads,
    landmarkSites,
  };
}

export function stepPlayerPhysics(
  pos: Vector2,
  inputDx: number,
  inputDz: number,
  dt: number,
  world: IslandWorldData,
  speedScale = 1
): { x: number; y: number; z: number; moved: boolean } {
  const len = Math.hypot(inputDx, inputDz);
  if (len <= 1e-4 || dt <= 0) {
    return {
      x: pos.x,
      y: groundHeightAt(pos.x, pos.z, world),
      z: pos.z,
      moved: false,
    };
  }

  const clampedScale = (len > 1 ? 1 / len : 1) * Math.max(0.2, speedScale);
  const vx = inputDx * clampedScale * CONFIG.PLAYER.MOVE_SPEED;
  const vz = inputDz * clampedScale * CONFIG.PLAYER.MOVE_SPEED;

  const currY = groundHeightAt(pos.x, pos.z, world);
  let nextX = pos.x + vx * dt;
  let nextZ = pos.z + vz * dt;

  const resolveCircle = (cx: number, cz: number, r: number) => {
    if (r <= 0) return;
    const minDist = CONFIG.PLAYER.RADIUS + r;
    const dx = nextX - cx;
    const dz = nextZ - cz;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist) {
      const dist = Math.sqrt(distSq);
      if (dist > 1e-5) {
        const push = minDist - dist;
        nextX += (dx / dist) * push;
        nextZ += (dz / dist) * push;
      } else {
        nextX += minDist;
      }
    }
  };

  for (let pass = 0; pass < 2; pass += 1) {
    for (const obs of world.obstacles) {
      resolveCircle(obs.x, obs.z, obs.radius);
    }
    for (const prop of world.props) {
      resolveCircle(prop.x, prop.z, prop.radius);
    }
  }

  const isTerrainBlocked = (tx: number, tz: number): boolean => {
    const halfSpan = CONFIG.WORLD.TERRAIN_SIZE * 0.47;
    if (Math.abs(tx) > halfSpan || Math.abs(tz) > halfSpan) return true;
    const targetY = groundHeightAt(tx, tz, world);
    if (targetY < CONFIG.WORLD.MIN_WADE_HEIGHT) return true;
    const stepDist = Math.max(0.05, Math.hypot(tx - pos.x, tz - pos.z));
    const slope = (targetY - currY) / stepDist;
    if (slope > CONFIG.WORLD.MAX_CLIMB_SLOPE) return true;
    return false;
  };

  if (isTerrainBlocked(nextX, nextZ)) {
    const canSlideX = !isTerrainBlocked(nextX, pos.z);
    const canSlideZ = !isTerrainBlocked(pos.x, nextZ);
    if (canSlideX) {
      nextZ = pos.z;
    } else if (canSlideZ) {
      nextX = pos.x;
    } else {
      nextX = pos.x;
      nextZ = pos.z;
    }
  }

  const finalY = groundHeightAt(nextX, nextZ, world);
  const moved = Math.hypot(nextX - pos.x, nextZ - pos.z) > 1e-4;

  return {
    x: nextX,
    y: finalY,
    z: nextZ,
    moved,
  };
}

export function computeVirtualJoystickVector(
  originX: number,
  originY: number,
  currentX: number,
  currentY: number,
  maxRadius: number = CONFIG.JOYSTICK.MAX_RADIUS_PX,
  deadzoneRatio: number = CONFIG.JOYSTICK.DEADZONE_RATIO
): JoystickVector {
  const rawDx = currentX - originX;
  const rawDy = currentY - originY;
  const dist = Math.hypot(rawDx, rawDy);

  if (dist <= 1e-5 || maxRadius <= 0) {
    return { dx: 0, dy: 0, knobX: 0, knobY: 0, magnitude: 0 };
  }

  const clampedDist = Math.min(dist, maxRadius);
  const knobX = (rawDx / dist) * clampedDist;
  const knobY = (rawDy / dist) * clampedDist;
  const ratio = clampedDist / maxRadius;

  if (ratio < deadzoneRatio) {
    return { dx: 0, dy: 0, knobX, knobY, magnitude: 0 };
  }

  const normalizedMag = (ratio - deadzoneRatio) / Math.max(1e-5, 1 - deadzoneRatio);
  return {
    dx: (rawDx / dist) * normalizedMag,
    dy: (rawDy / dist) * normalizedMag,
    knobX,
    knobY,
    magnitude: normalizedMag,
  };
}
