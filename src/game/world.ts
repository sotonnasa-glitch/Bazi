import { CONFIG, type BiomeId } from './config';
import { createSeededRandom } from './utils';

export type PropKind = 'palm' | 'jungle' | 'rock' | 'bush' | 'mushroom' | 'column';

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

export interface BridgeOrRampSpec {
  id: string;
  kind: 'ramp' | 'bridge' | 'pier';
  style: 'wood' | 'stone' | 'rope';
  x0: number;
  z0: number;
  y0: number;
  x1: number;
  z1: number;
  y1: number;
  halfWidth: number;
  arch: number;
}

export interface IslandWorldData {
  seed: string;
  lobePhaseA: number;
  lobePhaseB: number;
  connectors: BridgeOrRampSpec[];
  obstacles: Array<{ id: string; x: number; z: number; radius: number }>;
  props: IslandProp[];
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

export function contourScaleAtAngle(phi: number, phaseA: number, phaseB: number): number {
  return (
    1 +
    0.045 * Math.cos(4 * phi + phaseA) +
    0.03 * Math.sin(3 * phi + phaseB) +
    0.02 * Math.cos(2 * phi - 0.45)
  );
}

export function getContourPoints(
  rx: number,
  rz: number,
  phaseA: number,
  phaseB: number,
  segments = 72,
  multiplier = 1
): Array<{ x: number; z: number }> {
  const pts: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < segments; i += 1) {
    const phi = (i / segments) * Math.PI * 2;
    const scale = contourScaleAtAngle(phi, phaseA, phaseB) * multiplier;
    pts.push({
      x: Math.cos(phi) * rx * scale,
      z: Math.sin(phi) * rz * scale,
    });
  }
  return pts;
}

export function normalizedContourDistance(
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
  rx: number,
  rz: number,
  phaseA: number,
  phaseB: number
): number {
  const lx = x - centerX;
  const lz = z - centerZ;
  const nx = lx / rx;
  const nz = lz / rz;
  const phi = Math.atan2(nz, nx);
  const scale = contourScaleAtAngle(phi, phaseA, phaseB);
  return Math.hypot(nx, nz) / scale;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function projectOntoConnector(
  px: number,
  pz: number,
  c: BridgeOrRampSpec
): { inside: boolean; t: number; dist: number; height: number } {
  const vx = c.x1 - c.x0;
  const vz = c.z1 - c.z0;
  const lenSq = vx * vx + vz * vz;
  if (lenSq <= 1e-6) {
    return { inside: false, t: 0, dist: 999, height: c.y0 };
  }
  const rawT = ((px - c.x0) * vx + (pz - c.z0) * vz) / lenSq;
  const len = Math.sqrt(lenSq);
  // Allow slight 0.25 unit overlap at entry/exit caps for seamless transitions
  const marginT = 0.25 / len;
  if (rawT < -marginT || rawT > 1 + marginT) {
    return { inside: false, t: clamp01(rawT), dist: 999, height: c.y0 };
  }
  const t = clamp01(rawT);
  const projX = c.x0 + vx * t;
  const projZ = c.z0 + vz * t;
  const perpDist = Math.hypot(px - projX, pz - projZ);
  const inside = perpDist <= c.halfWidth;
  const archOffset = c.arch > 0 ? Math.sin(t * Math.PI) * c.arch : 0;
  const height = c.y0 + (c.y1 - c.y0) * t + archOffset;
  return { inside, t, dist: perpDist, height };
}

export function buildArchipelagoConnectors(
  phaseA: number,
  phaseB: number
): BridgeOrRampSpec[] {
  const { BEACH_HEIGHT, CENTER, RUINS, VOLCANO, MUSHROOM, SHIPWRECK } = CONFIG.ISLAND;

  // Compute exact contour edge points so every ramp/bridge starts cleanly from its terrace rim
  const southScale = contourScaleAtAngle(Math.PI / 2, phaseA, phaseB);
  const southGrassEdgeZ = CENTER.GRASS_RZ * southScale;

  const knollEastScale = contourScaleAtAngle(0, phaseA + 0.8, phaseB - 0.6);
  const knollEdgeX = CENTER.KNOLL_CX + CENTER.KNOLL_RX * knollEastScale;

  // Angle helpers from center toward each outer island
  const edgePoint = (
    cx: number,
    cz: number,
    rx: number,
    rz: number,
    pA: number,
    pB: number,
    targetX: number,
    targetZ: number,
    inset = 0.2
  ) => {
    const dx = targetX - cx;
    const dz = targetZ - cz;
    const phi = Math.atan2(dz / rz, dx / rx);
    const scale = contourScaleAtAngle(phi, pA, pB);
    return {
      x: cx + Math.cos(phi) * (rx * scale - inset),
      z: cz + Math.sin(phi) * (rz * scale - inset),
    };
  };

  // Central Beach <-> Ruins Beach (Stone Causeway)
  const cToRuins = edgePoint(CENTER.CX, CENTER.CZ, CENTER.BEACH_RX, CENTER.BEACH_RZ, phaseA, phaseB, RUINS.CX, RUINS.CZ, 0.9);
  const ruinsToC = edgePoint(RUINS.CX, RUINS.CZ, RUINS.BEACH_RX, RUINS.BEACH_RZ, phaseA + 0.5, phaseB + 0.3, CENTER.CX, CENTER.CZ, 0.9);
  const ruinsPlazaEdge = edgePoint(RUINS.CX, RUINS.CZ, RUINS.PLAZA_RX, RUINS.PLAZA_RZ, phaseA + 0.5, phaseB + 0.3, CENTER.CX, CENTER.CZ, -0.24);

  // Central Beach <-> Volcano Beach (Rope & Timber Bridge)
  const cToVolc = edgePoint(CENTER.CX, CENTER.CZ, CENTER.BEACH_RX, CENTER.BEACH_RZ, phaseA, phaseB, VOLCANO.CX, VOLCANO.CZ, 0.9);
  const volcToC = edgePoint(VOLCANO.CX, VOLCANO.CZ, VOLCANO.BEACH_RX, VOLCANO.BEACH_RZ, phaseA + 1.1, phaseB - 0.4, CENTER.CX, CENTER.CZ, 0.9);
  const volcCraterEdge = edgePoint(VOLCANO.CX, VOLCANO.CZ, VOLCANO.CRATER_RX, VOLCANO.CRATER_RZ, phaseA + 1.1, phaseB - 0.4, CENTER.CX, CENTER.CZ, -0.24);

  // Central Beach <-> Mushroom Grove Beach (Driftwood Boardwalk)
  const cToMush = edgePoint(CENTER.CX, CENTER.CZ, CENTER.BEACH_RX, CENTER.BEACH_RZ, phaseA, phaseB, MUSHROOM.CX, MUSHROOM.CZ, 0.9);
  const mushToC = edgePoint(MUSHROOM.CX, MUSHROOM.CZ, MUSHROOM.BEACH_RX, MUSHROOM.BEACH_RZ, phaseA - 0.7, phaseB + 0.9, CENTER.CX, CENTER.CZ, 0.9);
  const mushGroveEdge = edgePoint(MUSHROOM.CX, MUSHROOM.CZ, MUSHROOM.GROVE_RX, MUSHROOM.GROVE_RZ, phaseA - 0.7, phaseB + 0.9, CENTER.CX, CENTER.CZ, -0.24);

  // Central Beach <-> Shipwreck Cove Beach (Weathered Pier Bridge)
  const cToShip = edgePoint(CENTER.CX, CENTER.CZ, CENTER.BEACH_RX, CENTER.BEACH_RZ, phaseA, phaseB, SHIPWRECK.CX, SHIPWRECK.CZ, 0.9);
  const shipToC = edgePoint(SHIPWRECK.CX, SHIPWRECK.CZ, SHIPWRECK.BEACH_RX, SHIPWRECK.BEACH_RZ, phaseA + 1.6, phaseB + 0.2, CENTER.CX, CENTER.CZ, 0.9);
  const spitEdge = edgePoint(SHIPWRECK.SPIT_CX, SHIPWRECK.SPIT_CZ, SHIPWRECK.SPIT_RX, SHIPWRECK.SPIT_RZ, phaseA + 1.6, phaseB + 0.2, CENTER.CX, CENTER.CZ, -0.24);

  return [
    // Center Plateau -> South Beach Ramp
    {
      id: 'ramp-center-south',
      kind: 'ramp',
      style: 'wood',
      x0: 0,
      z0: southGrassEdgeZ + 0.14,
      y0: CENTER.GRASS_TOP_Y,
      x1: 0,
      z1: southGrassEdgeZ + 3.45,
      y1: BEACH_HEIGHT,
      halfWidth: 1.85,
      arch: 0,
    },
    // Center South Wooden Fishing Pier jutting into bay
    {
      id: 'pier-center-south',
      kind: 'pier',
      style: 'wood',
      x0: 0,
      z0: CENTER.BEACH_RZ * southScale - 1.2,
      y0: BEACH_HEIGHT + 0.12,
      x1: 0,
      z1: CENTER.BEACH_RZ * southScale + 5.2,
      y1: BEACH_HEIGHT + 0.22,
      halfWidth: 1.5,
      arch: 0,
    },
    // Center Upper Knoll -> Main Meadow Ramp
    {
      id: 'ramp-center-knoll',
      kind: 'ramp',
      style: 'wood',
      x0: knollEdgeX + 0.16,
      z0: CENTER.KNOLL_CZ,
      y0: CENTER.KNOLL_TOP_Y,
      x1: knollEdgeX + 2.95,
      z1: CENTER.KNOLL_CZ,
      y1: CENTER.GRASS_TOP_Y,
      halfWidth: 1.45,
      arch: 0,
    },
    // Bridge 1: Center Beach <-> Ancient Ruins Beach + Stone Steps onto Ruins Plaza
    {
      id: 'bridge-center-ruins',
      kind: 'bridge',
      style: 'stone',
      x0: cToRuins.x,
      z0: cToRuins.z,
      y0: BEACH_HEIGHT,
      x1: ruinsToC.x,
      z1: ruinsToC.z,
      y1: BEACH_HEIGHT,
      halfWidth: 1.65,
      arch: 0.45,
    },
    {
      id: 'ramp-ruins-plaza',
      kind: 'ramp',
      style: 'stone',
      x0: ruinsPlazaEdge.x,
      z0: ruinsPlazaEdge.z,
      y0: RUINS.PLAZA_TOP_Y,
      x1: ruinsPlazaEdge.x + (CENTER.CX - RUINS.CX) * 0.08,
      z1: ruinsPlazaEdge.z + (CENTER.CZ - RUINS.CZ) * 0.08,
      y1: BEACH_HEIGHT,
      halfWidth: 1.75,
      arch: 0,
    },
    // Bridge 2: Center Beach <-> Volcano Beach + Ramp onto Basalt Crater
    {
      id: 'bridge-center-volcano',
      kind: 'bridge',
      style: 'rope',
      x0: cToVolc.x,
      z0: cToVolc.z,
      y0: BEACH_HEIGHT,
      x1: volcToC.x,
      z1: volcToC.z,
      y1: BEACH_HEIGHT,
      halfWidth: 1.6,
      arch: 0.52,
    },
    {
      id: 'ramp-volcano-crater',
      kind: 'ramp',
      style: 'stone',
      x0: volcCraterEdge.x,
      z0: volcCraterEdge.z,
      y0: VOLCANO.CRATER_TOP_Y,
      x1: volcCraterEdge.x + (CENTER.CX - VOLCANO.CX) * 0.085,
      z1: volcCraterEdge.z + (CENTER.CZ - VOLCANO.CZ) * 0.085,
      y1: BEACH_HEIGHT,
      halfWidth: 1.75,
      arch: 0,
    },
    // Bridge 3: Center Beach <-> Mushroom Grove + Boardwalk Ramp into Grove
    {
      id: 'bridge-center-mushroom',
      kind: 'bridge',
      style: 'wood',
      x0: cToMush.x,
      z0: cToMush.z,
      y0: BEACH_HEIGHT,
      x1: mushToC.x,
      z1: mushToC.z,
      y1: BEACH_HEIGHT,
      halfWidth: 1.6,
      arch: 0.4,
    },
    {
      id: 'ramp-mushroom-grove',
      kind: 'ramp',
      style: 'wood',
      x0: mushGroveEdge.x,
      z0: mushGroveEdge.z,
      y0: MUSHROOM.GROVE_TOP_Y,
      x1: mushGroveEdge.x + (CENTER.CX - MUSHROOM.CX) * 0.08,
      z1: mushGroveEdge.z + (CENTER.CZ - MUSHROOM.CZ) * 0.08,
      y1: BEACH_HEIGHT,
      halfWidth: 1.7,
      arch: 0,
    },
    // Bridge 4: Center Beach <-> Shipwreck Cove + Ramp up Rocky Lighthouse Spit
    {
      id: 'bridge-center-shipwreck',
      kind: 'bridge',
      style: 'wood',
      x0: cToShip.x,
      z0: cToShip.z,
      y0: BEACH_HEIGHT,
      x1: shipToC.x,
      z1: shipToC.z,
      y1: BEACH_HEIGHT,
      halfWidth: 1.65,
      arch: 0.42,
    },
    {
      id: 'ramp-shipwreck-spit',
      kind: 'ramp',
      style: 'wood',
      x0: spitEdge.x,
      z0: spitEdge.z,
      y0: SHIPWRECK.SPIT_TOP_Y,
      x1: spitEdge.x + (CENTER.CX - SHIPWRECK.SPIT_CX) * 0.075,
      z1: spitEdge.z + (CENTER.CZ - SHIPWRECK.SPIT_CZ) * 0.075,
      y1: BEACH_HEIGHT,
      halfWidth: 1.6,
      arch: 0,
    },
  ];
}

export function detectBiomeAt(
  x: number,
  z: number,
  world: Pick<IslandWorldData, 'lobePhaseA' | 'lobePhaseB' | 'connectors'>
): BiomeId {
  for (const c of world.connectors) {
    if (c.kind === 'bridge' && projectOntoConnector(x, z, c).inside) {
      return 'bridge';
    }
  }
  const { RUINS, VOLCANO, MUSHROOM, SHIPWRECK } = CONFIG.ISLAND;
  if (
    normalizedContourDistance(x, z, RUINS.CX, RUINS.CZ, RUINS.BEACH_RX, RUINS.BEACH_RZ, world.lobePhaseA + 0.5, world.lobePhaseB + 0.3) <= 1.05
  ) {
    return 'ruins';
  }
  if (
    normalizedContourDistance(x, z, VOLCANO.CX, VOLCANO.CZ, VOLCANO.BEACH_RX, VOLCANO.BEACH_RZ, world.lobePhaseA + 1.1, world.lobePhaseB - 0.4) <= 1.05
  ) {
    return 'volcano';
  }
  if (
    normalizedContourDistance(x, z, MUSHROOM.CX, MUSHROOM.CZ, MUSHROOM.BEACH_RX, MUSHROOM.BEACH_RZ, world.lobePhaseA - 0.7, world.lobePhaseB + 0.9) <= 1.05
  ) {
    return 'mushroom';
  }
  if (
    normalizedContourDistance(x, z, SHIPWRECK.CX, SHIPWRECK.CZ, SHIPWRECK.BEACH_RX, SHIPWRECK.BEACH_RZ, world.lobePhaseA + 1.6, world.lobePhaseB + 0.2) <= 1.05
  ) {
    return 'shipwreck';
  }
  return 'center';
}

export function isOnAnyConnector(
  x: number,
  z: number,
  world: Pick<IslandWorldData, 'connectors'>
): boolean {
  for (const c of world.connectors) {
    if (projectOntoConnector(x, z, c).inside) {
      return true;
    }
  }
  return false;
}

export function groundHeightAt(
  x: number,
  z: number,
  world: Pick<IslandWorldData, 'lobePhaseA' | 'lobePhaseB' | 'connectors'>
): number {
  const { BEACH_HEIGHT, CENTER, RUINS, VOLCANO, MUSHROOM, SHIPWRECK } = CONFIG.ISLAND;
  const pA = world.lobePhaseA;
  const pB = world.lobePhaseB;

  let height = 0;

  // Check Central Island
  if (normalizedContourDistance(x, z, CENTER.CX, CENTER.CZ, CENTER.BEACH_RX, CENTER.BEACH_RZ, pA, pB) <= 1) {
    height = Math.max(height, BEACH_HEIGHT);
    if (normalizedContourDistance(x, z, CENTER.CX, CENTER.CZ, CENTER.GRASS_RX, CENTER.GRASS_RZ, pA, pB) <= 1) {
      height = Math.max(height, CENTER.GRASS_TOP_Y);
    }
    if (normalizedContourDistance(x, z, CENTER.KNOLL_CX, CENTER.KNOLL_CZ, CENTER.KNOLL_RX, CENTER.KNOLL_RZ, pA + 0.8, pB - 0.6) <= 1) {
      height = Math.max(height, CENTER.KNOLL_TOP_Y);
    }
  }

  // Check Ancient Ruins Island
  if (normalizedContourDistance(x, z, RUINS.CX, RUINS.CZ, RUINS.BEACH_RX, RUINS.BEACH_RZ, pA + 0.5, pB + 0.3) <= 1) {
    height = Math.max(height, BEACH_HEIGHT);
    if (normalizedContourDistance(x, z, RUINS.CX, RUINS.CZ, RUINS.PLAZA_RX, RUINS.PLAZA_RZ, pA + 0.5, pB + 0.3) <= 1) {
      height = Math.max(height, RUINS.PLAZA_TOP_Y);
    }
  }

  // Check Volcano Crater Island
  if (normalizedContourDistance(x, z, VOLCANO.CX, VOLCANO.CZ, VOLCANO.BEACH_RX, VOLCANO.BEACH_RZ, pA + 1.1, pB - 0.4) <= 1) {
    height = Math.max(height, BEACH_HEIGHT);
    if (normalizedContourDistance(x, z, VOLCANO.CX, VOLCANO.CZ, VOLCANO.CRATER_RX, VOLCANO.CRATER_RZ, pA + 1.1, pB - 0.4) <= 1) {
      height = Math.max(height, VOLCANO.CRATER_TOP_Y);
    }
  }

  // Check Mushroom Grove Island
  if (normalizedContourDistance(x, z, MUSHROOM.CX, MUSHROOM.CZ, MUSHROOM.BEACH_RX, MUSHROOM.BEACH_RZ, pA - 0.7, pB + 0.9) <= 1) {
    height = Math.max(height, BEACH_HEIGHT);
    if (normalizedContourDistance(x, z, MUSHROOM.CX, MUSHROOM.CZ, MUSHROOM.GROVE_RX, MUSHROOM.GROVE_RZ, pA - 0.7, pB + 0.9) <= 1) {
      height = Math.max(height, MUSHROOM.GROVE_TOP_Y);
    }
  }

  // Check Shipwreck Cove Island
  if (normalizedContourDistance(x, z, SHIPWRECK.CX, SHIPWRECK.CZ, SHIPWRECK.BEACH_RX, SHIPWRECK.BEACH_RZ, pA + 1.6, pB + 0.2) <= 1) {
    height = Math.max(height, BEACH_HEIGHT);
    if (normalizedContourDistance(x, z, SHIPWRECK.SPIT_CX, SHIPWRECK.SPIT_CZ, SHIPWRECK.SPIT_RX, SHIPWRECK.SPIT_RZ, pA + 1.6, pB + 0.2) <= 1) {
      height = Math.max(height, SHIPWRECK.SPIT_TOP_Y);
    }
  }

  // Bridges, Piers & Ramps take smooth precedence inside their corridors
  for (const c of world.connectors) {
    const proj = projectOntoConnector(x, z, c);
    if (proj.inside) {
      height = Math.max(height, proj.height);
    }
  }

  return height;
}

export function isPointInsideWalkableShore(
  x: number,
  z: number,
  world: Pick<IslandWorldData, 'lobePhaseA' | 'lobePhaseB' | 'connectors'>,
  margin: number = CONFIG.WORLD.SHORE_MARGIN
): boolean {
  if (isOnAnyConnector(x, z, world)) {
    return true;
  }

  const pA = world.lobePhaseA;
  const pB = world.lobePhaseB;
  const { CENTER, RUINS, VOLCANO, MUSHROOM, SHIPWRECK } = CONFIG.ISLAND;

  const islands: Array<[number, number, number, number, number, number]> = [
    [CENTER.CX, CENTER.CZ, CENTER.BEACH_RX, CENTER.BEACH_RZ, pA, pB],
    [RUINS.CX, RUINS.CZ, RUINS.BEACH_RX, RUINS.BEACH_RZ, pA + 0.5, pB + 0.3],
    [VOLCANO.CX, VOLCANO.CZ, VOLCANO.BEACH_RX, VOLCANO.BEACH_RZ, pA + 1.1, pB - 0.4],
    [MUSHROOM.CX, MUSHROOM.CZ, MUSHROOM.BEACH_RX, MUSHROOM.BEACH_RZ, pA - 0.7, pB + 0.9],
    [SHIPWRECK.CX, SHIPWRECK.CZ, SHIPWRECK.BEACH_RX, SHIPWRECK.BEACH_RZ, pA + 1.6, pB + 0.2],
  ];

  for (const [cx, cz, rx, rz, a, b] of islands) {
    if (normalizedContourDistance(x, z, cx, cz, Math.max(2, rx - margin), Math.max(2, rz - margin), a, b) <= 1) {
      return true;
    }
  }
  return false;
}

export function isNearAnyConnector(
  x: number,
  z: number,
  connectors: BridgeOrRampSpec[],
  pad = 1.4
): boolean {
  for (const c of connectors) {
    const vx = c.x1 - c.x0;
    const vz = c.z1 - c.z0;
    const lenSq = vx * vx + vz * vz;
    if (lenSq <= 1e-6) continue;
    const len = Math.sqrt(lenSq);
    const t = clamp01(((x - c.x0) * vx + (z - c.z0) * vz) / lenSq);
    const px = c.x0 + vx * t;
    const pz = c.z0 + vz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d <= c.halfWidth + pad && len > 0.1) {
      return true;
    }
  }
  return false;
}

export function generateIslandWorld(seed: string): IslandWorldData {
  const rng = createSeededRandom(seed);
  const lobePhaseA = rng() * Math.PI * 2;
  const lobePhaseB = rng() * Math.PI * 2;
  const connectors = buildArchipelagoConnectors(lobePhaseA, lobePhaseB);
  const meta = { lobePhaseA, lobePhaseB, connectors };
  const props: IslandProp[] = [];

  const { RUINS, VOLCANO, MUSHROOM, SHIPWRECK, CENTER } = CONFIG.ISLAND;

  // Solid landmark obstacles (Obelisk, Magma Caldera, Shipwreck Hull, Beacon)
  const obstacles: Array<{ id: string; x: number; z: number; radius: number }> = [
    { id: 'obs-obelisk', x: RUINS.CX, z: RUINS.CZ, radius: 1.55 },
    { id: 'obs-caldera', x: VOLCANO.CALDERA_CX, z: VOLCANO.CALDERA_CZ, radius: VOLCANO.CALDERA_COLLIDER_R },
    { id: 'obs-shipwreck', x: SHIPWRECK.HULL_CX, z: SHIPWRECK.HULL_CZ, radius: SHIPWRECK.HULL_COLLIDER_R },
    { id: 'obs-lighthouse', x: SHIPWRECK.SPIT_CX + 1.8, z: SHIPWRECK.SPIT_CZ - 0.8, radius: 1.25 },
  ];

  // Add Ancient Ruin Columns around the Obelisk
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + 0.35;
    const rx = RUINS.CX + Math.cos(a) * 4.9;
    const rz = RUINS.CZ + Math.sin(a) * 4.3;
    props.push({
      id: `column-${i}`,
      kind: 'column',
      x: rx,
      y: groundHeightAt(rx, rz, meta),
      z: rz,
      radius: 0.72,
      scale: i % 2 === 0 ? 1.05 : 0.82,
      rotationY: a,
      variant: i % 3,
    });
  }

  const canPlace = (x: number, z: number, radius: number): boolean => {
    if (!isPointInsideWalkableShore(x, z, meta, 1.35)) return false;
    if (isNearAnyConnector(x, z, connectors, 1.45)) return false;
    const distSpawn = Math.hypot(x - CONFIG.WORLD.SPAWN_X, z - CONFIG.WORLD.SPAWN_Z);
    if (distSpawn < CONFIG.WORLD.SPAWN_CLEAR_RADIUS + radius) return false;

    const hCenter = groundHeightAt(x, z, meta);
    const checkPad = radius + 0.35;
    if (
      Math.abs(groundHeightAt(x + checkPad, z, meta) - hCenter) > 0.05 ||
      Math.abs(groundHeightAt(x - checkPad, z, meta) - hCenter) > 0.05 ||
      Math.abs(groundHeightAt(x, z + checkPad, meta) - hCenter) > 0.05 ||
      Math.abs(groundHeightAt(x, z - checkPad, meta) - hCenter) > 0.05
    ) {
      return false;
    }

    for (const obs of obstacles) {
      if (Math.hypot(x - obs.x, z - obs.z) < obs.radius + radius + 1.2) {
        return false;
      }
    }

    for (const existing of props) {
      const minGap = Math.max(CONFIG.WORLD.MIN_PROP_SPACING, existing.radius + radius + 0.9);
      if (Math.hypot(x - existing.x, z - existing.z) < minGap) {
        return false;
      }
    }
    return true;
  };

  const scatterOnRegion = (
    kind: PropKind,
    count: number,
    colliderRadius: number,
    cx: number,
    cz: number,
    rx: number,
    rz: number,
    pA: number,
    pB: number,
    tMin: number,
    tMax: number,
    scaleMin: number,
    scaleMax: number,
    variants = 3
  ) => {
    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 45;
    while (placed < count && attempts < maxAttempts) {
      attempts += 1;
      const phi = rng() * Math.PI * 2;
      const t = tMin + Math.sqrt(rng()) * (tMax - tMin);
      const scaleContour = contourScaleAtAngle(phi, pA, pB);
      const x = cx + Math.cos(phi) * rx * scaleContour * t;
      const z = cz + Math.sin(phi) * rz * scaleContour * t;
      const scale = scaleMin + rng() * (scaleMax - scaleMin);
      const scaledRadius = colliderRadius * scale;

      if (!canPlace(x, z, scaledRadius)) continue;

      props.push({
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

  // Central Tropical Haven
  scatterOnRegion('palm', 18, CONFIG.PROPS.PALM_COLLIDER_RADIUS, CENTER.CX, CENTER.CZ, CENTER.BEACH_RX, CENTER.BEACH_RZ, lobePhaseA, lobePhaseB, 0.72, 0.92, 0.92, 1.25);
  scatterOnRegion('jungle', 10, CONFIG.PROPS.JUNGLE_COLLIDER_RADIUS, CENTER.CX, CENTER.CZ, CENTER.GRASS_RX, CENTER.GRASS_RZ, lobePhaseA, lobePhaseB, 0.32, 0.86, 0.9, 1.22);
  scatterOnRegion('rock', 8, CONFIG.PROPS.ROCK_COLLIDER_RADIUS, CENTER.CX, CENTER.CZ, CENTER.GRASS_RX, CENTER.GRASS_RZ, lobePhaseA, lobePhaseB, 0.25, 0.86, 0.85, 1.18);
  scatterOnRegion('bush', 12, CONFIG.PROPS.BUSH_COLLIDER_RADIUS, CENTER.CX, CENTER.CZ, CENTER.GRASS_RX, CENTER.GRASS_RZ, lobePhaseA, lobePhaseB, 0.24, 0.86, 0.9, 1.15);

  // Ancient Ruins Island (mossy rocks, jungle trees, edge palms)
  scatterOnRegion('palm', 6, CONFIG.PROPS.PALM_COLLIDER_RADIUS, RUINS.CX, RUINS.CZ, RUINS.BEACH_RX, RUINS.BEACH_RZ, lobePhaseA + 0.5, lobePhaseB + 0.3, 0.75, 0.91, 0.9, 1.2);
  scatterOnRegion('jungle', 5, CONFIG.PROPS.JUNGLE_COLLIDER_RADIUS, RUINS.CX, RUINS.CZ, RUINS.PLAZA_RX, RUINS.PLAZA_RZ, lobePhaseA + 0.5, lobePhaseB + 0.3, 0.55, 0.86, 0.85, 1.15);
  scatterOnRegion('rock', 5, CONFIG.PROPS.ROCK_COLLIDER_RADIUS, RUINS.CX, RUINS.CZ, RUINS.PLAZA_RX, RUINS.PLAZA_RZ, lobePhaseA + 0.5, lobePhaseB + 0.3, 0.5, 0.88, 0.85, 1.15);

  // Volcano Crater Island (jagged basalt rocks & perimeter palms)
  scatterOnRegion('palm', 5, CONFIG.PROPS.PALM_COLLIDER_RADIUS, VOLCANO.CX, VOLCANO.CZ, VOLCANO.BEACH_RX, VOLCANO.BEACH_RZ, lobePhaseA + 1.1, lobePhaseB - 0.4, 0.76, 0.92, 0.9, 1.15);
  scatterOnRegion('rock', 7, CONFIG.PROPS.ROCK_COLLIDER_RADIUS, VOLCANO.CX, VOLCANO.CZ, VOLCANO.CRATER_RX, VOLCANO.CRATER_RZ, lobePhaseA + 1.1, lobePhaseB - 0.4, 0.48, 0.88, 0.9, 1.28);

  // Giant Mushroom Grove (giant toadstools + lush bushes + jungle trees)
  scatterOnRegion('mushroom', CONFIG.PROPS.GIANT_MUSHROOM_COUNT, CONFIG.PROPS.MUSHROOM_COLLIDER_RADIUS, MUSHROOM.CX, MUSHROOM.CZ, MUSHROOM.GROVE_RX, MUSHROOM.GROVE_RZ, lobePhaseA - 0.7, lobePhaseB + 0.9, 0.2, 0.82, 0.95, 1.35, 2);
  scatterOnRegion('jungle', 6, CONFIG.PROPS.JUNGLE_COLLIDER_RADIUS, MUSHROOM.CX, MUSHROOM.CZ, MUSHROOM.GROVE_RX, MUSHROOM.GROVE_RZ, lobePhaseA - 0.7, lobePhaseB + 0.9, 0.4, 0.88, 0.9, 1.18);
  scatterOnRegion('bush', 6, CONFIG.PROPS.BUSH_COLLIDER_RADIUS, MUSHROOM.CX, MUSHROOM.CZ, MUSHROOM.GROVE_RX, MUSHROOM.GROVE_RZ, lobePhaseA - 0.7, lobePhaseB + 0.9, 0.28, 0.85, 0.9, 1.15);
  scatterOnRegion('palm', 5, CONFIG.PROPS.PALM_COLLIDER_RADIUS, MUSHROOM.CX, MUSHROOM.CZ, MUSHROOM.BEACH_RX, MUSHROOM.BEACH_RZ, lobePhaseA - 0.7, lobePhaseB + 0.9, 0.75, 0.92, 0.9, 1.18);

  // Shipwreck Cove (beach palms, boulders, bushes)
  scatterOnRegion('palm', 8, CONFIG.PROPS.PALM_COLLIDER_RADIUS, SHIPWRECK.CX, SHIPWRECK.CZ, SHIPWRECK.BEACH_RX, SHIPWRECK.BEACH_RZ, lobePhaseA + 1.6, lobePhaseB + 0.2, 0.72, 0.92, 0.92, 1.24);
  scatterOnRegion('rock', 4, CONFIG.PROPS.ROCK_COLLIDER_RADIUS, SHIPWRECK.CX, SHIPWRECK.CZ, SHIPWRECK.BEACH_RX, SHIPWRECK.BEACH_RZ, lobePhaseA + 1.6, lobePhaseB + 0.2, 0.65, 0.88, 0.85, 1.18);
  scatterOnRegion('bush', 4, CONFIG.PROPS.BUSH_COLLIDER_RADIUS, SHIPWRECK.SPIT_CX, SHIPWRECK.SPIT_CZ, SHIPWRECK.SPIT_RX, SHIPWRECK.SPIT_RZ, lobePhaseA + 1.6, lobePhaseB + 0.2, 0.3, 0.8, 0.9, 1.1);

  return {
    seed,
    lobePhaseA,
    lobePhaseB,
    connectors,
    obstacles,
    props,
  };
}

export function stepPlayerPhysics(
  pos: Vector2,
  inputDx: number,
  inputDz: number,
  dt: number,
  world: IslandWorldData
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

  const clampedScale = len > 1 ? 1 / len : 1;
  const vx = inputDx * clampedScale * CONFIG.PLAYER.MOVE_SPEED;
  const vz = inputDz * clampedScale * CONFIG.PLAYER.MOVE_SPEED;

  const currY = groundHeightAt(pos.x, pos.z, world);
  let nextX = pos.x + vx * dt;
  let nextZ = pos.z + vz * dt;

  const resolveCircle = (cx: number, cz: number, r: number) => {
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

  const checkLedgeBlocked = (tx: number, tz: number): boolean => {
    if (!isPointInsideWalkableShore(tx, tz, world)) return true;
    const targetY = groundHeightAt(tx, tz, world);
    const stepDiff = Math.abs(targetY - currY);
    if (
      stepDiff > CONFIG.WORLD.MAX_STEP_CLIMB &&
      !isOnAnyConnector(tx, tz, world) &&
      !isOnAnyConnector(pos.x, pos.z, world)
    ) {
      return true;
    }
    return false;
  };

  if (checkLedgeBlocked(nextX, nextZ)) {
    const canSlideX = !checkLedgeBlocked(nextX, pos.z);
    const canSlideZ = !checkLedgeBlocked(pos.x, nextZ);
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
