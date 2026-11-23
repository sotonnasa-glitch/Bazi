import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function setLinearAttrColors(
  geo: THREE.BufferGeometry,
  rSrgb: number,
  gSrgb: number,
  bSrgb: number
): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color().setRGB(rSrgb, gSrgb, bSrgb, THREE.SRGBColorSpace);
  for (let i = 0; i < pos.count; i += 1) {
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}

function safeMerge(parts: THREE.BufferGeometry[], fallback: THREE.BufferGeometry): THREE.BufferGeometry {
  if (parts.length === 0) return fallback;
  const anyColor = parts.some((p) => Boolean(p.attributes.color));
  const allIndexed = parts.every((p) => Boolean(p.index));

  const normalized = parts.map((orig) => {
    const g = allIndexed ? orig : orig.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      const count = g.attributes.position.count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    if (anyColor && !g.attributes.color) {
      setLinearAttrColors(g, 1, 1, 1);
    }
    return g;
  });

  const merged = mergeGeometries(normalized, false);
  for (const g of normalized) g.dispose();
  for (const p of parts) {
    if (!normalized.includes(p)) p.dispose();
  }
  if (merged) {
    fallback.dispose();
    return merged;
  }
  return fallback;
}

function buildTaperedCurveTube(
  points: THREE.Vector3[],
  rBottom: number,
  rTop: number,
  tubularSegments = 10,
  radialSegments = 8,
  ringRipple = 0
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, tubularSegments, 1, radialSegments, false);
  const pos = geo.attributes.position;
  const ringStride = radialSegments + 1;

  for (let i = 0; i <= tubularSegments; i += 1) {
    const t = i / tubularSegments;
    const center = curve.getPointAt(t);
    const flare = t < 0.18 ? (1 - t / 0.18) * 0.28 : 0;
    const ripple = ringRipple > 0 ? Math.sin(t * 32) * ringRipple : 0;
    const radius = THREE.MathUtils.lerp(rBottom, rTop, t) * (1 + flare + ripple);

    for (let j = 0; j < ringStride; j += 1) {
      const idx = i * ringStride + j;
      if (idx >= pos.count) break;
      const dx = pos.getX(idx) - center.x;
      const dy = pos.getY(idx) - center.y;
      const dz = pos.getZ(idx) - center.z;
      pos.setXYZ(idx, center.x + dx * radius, center.y + dy * radius, center.z + dz * radius);
    }
  }

  geo.computeVertexNormals();
  return geo;
}

function buildCurvedLeafStrip(width: number, height: number, bend: number, segments = 5): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const y = t * height;
    const z = Math.pow(t, 1.7) * bend;
    const halfW = width * 0.5 * Math.sin((1 - t * 0.88) * Math.PI * 0.5 + 0.15) * (1 - Math.pow(t, 2.2));
    const archY = y - halfW * 0.12;

    positions.push(-halfW, archY, z);
    positions.push(0, y, z + 0.008);
    positions.push(halfW, archY, z);
    uvs.push(0, t, 0.5, t, 1, t);

    if (i < segments) {
      const base = i * 3;
      const next = (i + 1) * 3;
      indices.push(base, base + 1, next);
      indices.push(base + 1, next + 1, next);
      indices.push(base + 1, base + 2, next + 1);
      indices.push(base + 2, next + 2, next + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildSculptedBoulderGeometry(
  radius: number,
  seedNum: number,
  withVertexColor = true
): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(radius, 18, 13);
  const pos = geo.attributes.position;
  const colors = withVertexColor ? new Float32Array(pos.count * 3) : null;
  const tmpColor = new THREE.Color();

  for (let i = 0; i < pos.count; i += 1) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const n =
      1 +
      0.11 * Math.sin(vx * 2.9 + seedNum) * Math.cos(vz * 2.6 - seedNum * 0.5) +
      0.07 * Math.cos(vy * 3.8 + vx * 2.0);
    const flatBottom = vy < -radius * 0.35 ? 0.72 : 1.0;
    const ny = vy * n * flatBottom;
    pos.setXYZ(i, vx * n, ny, vz * n);

    if (colors) {
      const hNorm = THREE.MathUtils.clamp((ny / Math.max(0.1, radius) + 1) * 0.5, 0, 1);
      const shade = 0.78 + hNorm * 0.28;
      tmpColor.setRGB(
        Math.min(1, shade * (0.96 + hNorm * 0.06)),
        Math.min(1, shade * (0.98 + hNorm * 0.04)),
        Math.min(1, shade * (0.94 - hNorm * 0.03)),
        THREE.SRGBColorSpace
      );
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
  }

  if (colors) {
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildCurvedPalmFrondMeshGeometry(
  length: number,
  width: number,
  droop: number
): THREE.BufferGeometry {
  const segments = 8;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const c = new THREE.Color();

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const x = t * length;
    const y = Math.sin(t * Math.PI * 0.65) * 0.42 - Math.pow(t, 1.9) * droop;
    const halfW = width * Math.sin(Math.pow(t, 0.62) * Math.PI * 0.92 + 0.14);
    const sagY = y - halfW * 0.24;

    positions.push(x, sagY, -halfW);
    positions.push(x, y + 0.045, 0);
    positions.push(x, sagY, halfW);
    uvs.push(t, 0, t, 0.5, t, 1);

    c.setRGB(0.68 + t * 0.28, 0.85 + t * 0.14, 0.72 + t * 0.08, THREE.SRGBColorSpace);
    colors.push(c.r * 0.94, c.g * 0.94, c.b * 0.94);
    colors.push(c.r * 1.04, c.g * 1.04, c.b);
    colors.push(c.r * 0.94, c.g * 0.94, c.b * 0.94);

    if (i < segments) {
      const base = i * 3;
      const next = (i + 1) * 3;
      indices.push(base, next, base + 1);
      indices.push(base + 1, next, next + 1);
      indices.push(base + 1, next + 1, base + 2);
      indices.push(base + 2, next + 1, next + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildCurvedPalmTrunkGeometry(): THREE.BufferGeometry {
  return buildTaperedCurveTube(
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.14, 1.15, 0),
      new THREE.Vector3(0.42, 2.55, 0),
      new THREE.Vector3(0.74, 3.84, 0),
    ],
    0.34,
    0.16,
    12,
    10,
    0.045
  );
}

export function buildPalmCanopyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const crownX = 0.74;
  const crownY = 3.82;

  const bud = new THREE.SphereGeometry(0.24, 10, 8);
  setLinearAttrColors(bud, 0.74, 0.9, 0.74);
  bud.translate(crownX, crownY + 0.08, 0);
  parts.push(bud);

  for (let i = 0; i < 6; i += 1) {
    const yaw = (i / 6) * Math.PI * 2 + 0.12;
    const blade = buildCurvedPalmFrondMeshGeometry(2.45, 0.56, 1.18);
    blade.rotateY(yaw);
    blade.translate(crownX, crownY, 0);
    parts.push(blade);
  }
  for (let i = 0; i < 4; i += 1) {
    const yaw = (i / 4) * Math.PI * 2 + 0.52;
    const blade = buildCurvedPalmFrondMeshGeometry(1.78, 0.45, 0.55);
    blade.rotateZ(0.24);
    blade.rotateY(yaw);
    blade.translate(crownX, crownY + 0.12, 0);
    parts.push(blade);
  }

  return safeMerge(parts, new THREE.SphereGeometry(1.1, 10, 8));
}

export function buildCoconutClusterGeometry(): THREE.BufferGeometry {
  const crownX = 0.69;
  const crownY = 3.56;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const nut = new THREE.SphereGeometry(0.16, 10, 8);
    nut.scale(0.95, 1.12, 0.95);
    nut.translate(crownX + Math.cos(a) * 0.22, crownY - (i % 2) * 0.05, Math.sin(a) * 0.22);
    parts.push(nut);
  }
  return safeMerge(parts, new THREE.SphereGeometry(0.16, 8, 7));
}

export function buildJungleTrunkGeometry(): THREE.BufferGeometry {
  const main = buildTaperedCurveTube(
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.06, 0.9, 0.04),
      new THREE.Vector3(-0.04, 1.85, -0.02),
      new THREE.Vector3(0.02, 2.55, 0),
    ],
    0.42,
    0.2,
    9,
    9
  );
  const branchA = buildTaperedCurveTube(
    [
      new THREE.Vector3(-0.02, 1.45, 0.02),
      new THREE.Vector3(-0.32, 1.95, 0.14),
      new THREE.Vector3(-0.62, 2.38, 0.24),
    ],
    0.19,
    0.1,
    6,
    7
  );
  const branchB = buildTaperedCurveTube(
    [
      new THREE.Vector3(0.02, 1.5, -0.02),
      new THREE.Vector3(0.32, 1.98, -0.15),
      new THREE.Vector3(0.58, 2.42, -0.22),
    ],
    0.18,
    0.1,
    6,
    7
  );
  return safeMerge([main, branchA, branchB], new THREE.CapsuleGeometry(0.3, 2.0, 6, 10));
}

export function buildJungleCanopyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const lobes = [
    { x: 0, y: 2.9, z: 0, r: 1.28 },
    { x: -0.78, y: 2.48, z: 0.35, r: 0.94 },
    { x: 0.72, y: 2.54, z: -0.25, r: 0.96 },
    { x: 0.12, y: 2.44, z: 0.78, r: 0.86 },
    { x: -0.22, y: 3.38, z: -0.25, r: 0.9 },
  ];
  for (let i = 0; i < lobes.length; i += 1) {
    const l = lobes[i];
    const puff = buildSculptedBoulderGeometry(l.r, i * 2.1);
    puff.scale(1.12, 0.82, 1.08);
    puff.translate(l.x, l.y, l.z);
    parts.push(puff);
  }
  return safeMerge(parts, new THREE.SphereGeometry(1.3, 12, 10));
}

// Organic sculpted pine bough clusters — zero geometric cones!
export function buildPineTrunkGeometry(): THREE.BufferGeometry {
  return buildTaperedCurveTube(
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.05, 0.9, 0.03),
      new THREE.Vector3(-0.04, 1.85, -0.02),
      new THREE.Vector3(0, 2.7, 0),
    ],
    0.34,
    0.15,
    8,
    9
  );
}

function buildSculptedBoughTier(
  radius: number,
  height: number,
  lobes: number,
  seed: number,
  srgb: [number, number, number]
): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 22, 14);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const phi = Math.atan2(z, x);
    // y in [-1, 1] -> t in [0 (bottom), 1 (top)]
    const t = (y + 1) * 0.5;
    // Soft organic teardrop / flared bell silhouette with scalloped pine bough lobes
    const bellTaper = Math.pow(Math.max(0.02, 1 - t * 0.86), 0.72);
    const radialLobe = 1 + 0.16 * Math.cos(phi * lobes + seed) + 0.08 * Math.sin(phi * (lobes + 2) - seed);
    const skirtSag = t < 0.35 ? (0.35 - t) * 0.25 * Math.cos(phi * lobes + seed) : 0;

    const nx = x * radius * bellTaper * radialLobe;
    const nz = z * radius * bellTaper * radialLobe;
    const ny = (y * 0.5 + 0.5) * height - skirtSag;

    pos.setXYZ(i, nx, ny, nz);

    const light = 0.84 + t * 0.26;
    tmpColor.setRGB(
      Math.min(1, srgb[0] * light),
      Math.min(1, srgb[1] * light),
      Math.min(1, srgb[2] * light),
      THREE.SRGBColorSpace
    );
    cols[i * 3] = tmpColor.r;
    cols[i * 3 + 1] = tmpColor.g;
    cols[i * 3 + 2] = tmpColor.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}

export function buildPineCanopyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const tiers: Array<{ y: number; r: number; h: number; lobes: number; shade: [number, number, number] }> = [
    { y: 1.5, r: 1.52, h: 1.55, lobes: 7, shade: [0.22, 0.56, 0.26] },
    { y: 2.38, r: 1.24, h: 1.42, lobes: 6, shade: [0.27, 0.63, 0.27] },
    { y: 3.18, r: 0.94, h: 1.28, lobes: 5, shade: [0.33, 0.7, 0.29] },
    { y: 3.86, r: 0.62, h: 1.05, lobes: 4, shade: [0.4, 0.76, 0.31] },
  ];
  tiers.forEach((t, idx) => {
    const bough = buildSculptedBoughTier(t.r, t.h, t.lobes, idx * 1.4, t.shade);
    bough.translate(0, t.y, 0);
    parts.push(bough);
  });
  return safeMerge(parts, new THREE.SphereGeometry(1.1, 14, 10));
}

// Organic bioluminescent crystal pods (curved mineral bulbs, zero pyramid cones!)
export function buildCrystalClusterGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const specs = [
    { x: 0, y: 0.75, z: 0, rx: 0.3, ry: 0.92, rz: 0.28, rotX: 0.08, rotZ: -0.06 },
    { x: -0.28, y: 0.48, z: 0.16, rx: 0.22, ry: 0.65, rz: 0.2, rotX: 0.22, rotZ: 0.32 },
    { x: 0.27, y: 0.42, z: -0.14, rx: 0.2, ry: 0.58, rz: 0.19, rotX: -0.24, rotZ: -0.28 },
  ];
  specs.forEach((s, idx) => {
    const pod = new THREE.SphereGeometry(1, 12, 10);
    const pos = pod.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      const taper = 1 - Math.max(0, py) * 0.45;
      const rib = 1 + 0.1 * Math.cos(Math.atan2(pz, px) * 5 + idx);
      pos.setXYZ(i, px * s.rx * taper * rib, py * s.ry, pz * s.rz * taper * rib);
    }
    pod.computeVertexNormals();
    pod.rotateX(s.rotX);
    pod.rotateZ(s.rotZ);
    pod.translate(s.x, s.y, s.z);
    parts.push(pod);
  });
  return safeMerge(parts, new THREE.SphereGeometry(0.4, 10, 8));
}

// Organic curved volcano basalt outcrop (replaces sharp cone spires!)
export function buildOrganicBasaltCragGeometry(radius = 0.9, height = 2.6, seed = 1.7): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 16, 12);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp((y + 1) * 0.5, 0, 1);
    const taper = Math.pow(1 - t * 0.72, 0.65);
    const crag = 1 + 0.18 * Math.sin(Math.atan2(z, x) * 4 + seed) + 0.1 * Math.cos(y * 5 + seed);
    const bendX = t * t * 0.25;
    pos.setXYZ(i, x * radius * taper * crag + bendX, t * height, z * radius * taper * crag);
  }
  geo.computeVertexNormals();
  return geo;
}

// Organic weathered stone slab / pillar for Ancient Ruins (zero raw BoxGeometry!)
export function buildSculptedStoneSlabGeometry(
  width: number,
  height: number,
  depth: number,
  seed = 0.9
): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 16, 12);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Superellipsoid-like soft rounded block + subtle carved weathering
    const sx = Math.sign(x) * Math.pow(Math.abs(x), 0.58) * (width * 0.5);
    const sy = Math.sign(y) * Math.pow(Math.abs(y), 0.58) * (height * 0.5);
    const sz = Math.sign(z) * Math.pow(Math.abs(z), 0.58) * (depth * 0.5);
    const wear = 1 + 0.04 * Math.sin(x * 6 + seed) * Math.cos(y * 5 - seed);
    pos.setXYZ(i, sx * wear, sy, sz * wear);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildSculptedSunCrystalGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0, -1.25),
    new THREE.Vector2(0.32, -0.78),
    new THREE.Vector2(0.68, -0.12),
    new THREE.Vector2(0.56, 0.58),
    new THREE.Vector2(0.24, 1.05),
    new THREE.Vector2(0.0, 1.32),
  ];
  const geo = new THREE.LatheGeometry(pts, 14);
  geo.computeVertexNormals();
  return geo;
}

export function buildWeatheredRuinsPillarGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 16, 14);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp((y + 1) * 0.5, 0, 1);
    const entasis = 0.44 - t * 0.08 + Math.sin(t * Math.PI) * 0.04;
    const capFlare = t > 0.86 ? (t - 0.86) * 0.85 : 0;
    const baseFlare = t < 0.14 ? (0.14 - t) * 0.9 : 0;
    const r = entasis + capFlare + baseFlare;
    const flute = 1 + 0.045 * Math.cos(Math.atan2(z, x) * 8);
    pos.setXYZ(i, x * r * flute, t * 2.35, z * r * flute);
  }
  geo.computeVertexNormals();
  return geo;
}

// Curved wooden galleon hull with fitted curved deck & scaled ribs (zero poking edges!)
export function buildCurvedBoatHullGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const lengthSegs = 14;
  const profileSegs = 10;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const hullBeamAt = (u: number) => 1.32 * Math.sin(Math.pow(u, 0.58) * Math.PI * 0.94 + 0.14);
  const hullSheerAt = (u: number) => 0.78 + Math.pow(Math.abs(u - 0.44) * 1.4, 2) * 0.42;

  for (let i = 0; i <= lengthSegs; i += 1) {
    const u = i / lengthSegs;
    const x = THREE.MathUtils.lerp(-2.7, 3.25, u);
    const beam = hullBeamAt(u);
    const sheerY = hullSheerAt(u);

    for (let j = 0; j <= profileSegs; j += 1) {
      const v = j / profileSegs;
      const angle = (v - 0.5) * Math.PI;
      const py = sheerY * (1 - Math.cos(angle)) * 0.95 + 0.08;
      const pz = Math.sin(angle) * beam;
      positions.push(x, py, pz);
      uvs.push(u * 2, v);
    }
  }

  const stride = profileSegs + 1;
  for (let i = 0; i < lengthSegs; i += 1) {
    for (let j = 0; j < profileSegs; j += 1) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      // Outward-facing winding for U-shaped boat hull exterior
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  hullGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  hullGeo.setIndex(indices);
  hullGeo.computeVertexNormals();
  parts.push(hullGeo);

  // Fitted curved interior deck matching exact boat beam profile
  const deckPos: number[] = [];
  const deckUvs: number[] = [];
  const deckIdx: number[] = [];
  for (let i = 0; i <= lengthSegs; i += 1) {
    const u = i / lengthSegs;
    const x = THREE.MathUtils.lerp(-2.6, 3.05, u);
    const w = hullBeamAt(u) * 0.9;
    const y = 0.7 + Math.pow(Math.abs(u - 0.45) * 1.2, 2) * 0.2;
    deckPos.push(x, y, -w, x, y + 0.04, 0, x, y, w);
    deckUvs.push(u * 2, 0, u * 2, 0.5, u * 2, 1);
    if (i < lengthSegs) {
      const base = i * 3;
      const next = (i + 1) * 3;
      // Upward (+Y) normals for boat deck
      deckIdx.push(base, next, base + 1, base + 1, next, next + 1);
      deckIdx.push(base + 1, next + 1, base + 2, base + 2, next + 1, next + 2);
    }
  }
  const fittedDeck = new THREE.BufferGeometry();
  fittedDeck.setAttribute('position', new THREE.Float32BufferAttribute(deckPos, 3));
  fittedDeck.setAttribute('uv', new THREE.Float32BufferAttribute(deckUvs, 2));
  fittedDeck.setIndex(deckIdx);
  fittedDeck.computeVertexNormals();
  parts.push(fittedDeck);

  // Fitted curved ribs inside the hull walls (scaled tightly to local beam!)
  for (let r = 0; r < 4; r += 1) {
    const u = 0.25 + r * 0.16;
    const rx = THREE.MathUtils.lerp(-2.7, 3.25, u);
    const localBeam = hullBeamAt(u) * 0.86;
    const rib = new THREE.TorusGeometry(localBeam, 0.075, 7, 14, Math.PI);
    rib.rotateZ(Math.PI);
    rib.rotateY(Math.PI / 2);
    rib.scale(1, 0.56, 1.0);
    rib.translate(rx, 0.72, 0);
    parts.push(rib);
  }

  return safeMerge(parts, new THREE.CapsuleGeometry(1.1, 3.6, 8, 12));
}

export function buildWeatheredBarrelGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0, -0.34),
    new THREE.Vector2(0.24, -0.34),
    new THREE.Vector2(0.32, -0.12),
    new THREE.Vector2(0.34, 0.0),
    new THREE.Vector2(0.32, 0.12),
    new THREE.Vector2(0.24, 0.34),
    new THREE.Vector2(0.0, 0.34),
  ];
  return new THREE.LatheGeometry(pts, 14);
}

export function buildRoundedChestGeometry(): THREE.BufferGeometry {
  const base = buildSculptedStoneSlabGeometry(0.84, 0.44, 0.56, 2.1);
  base.translate(0, 0.22, 0);
  const lid = new THREE.CylinderGeometry(0.27, 0.27, 0.8, 12, 1, false, 0, Math.PI);
  lid.rotateZ(Math.PI / 2);
  lid.rotateX(-Math.PI / 2);
  lid.translate(0, 0.42, 0);
  return safeMerge([base, lid], buildSculptedBoulderGeometry(0.45, 2.1, false));
}

export function buildFernTuftGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const leaf = buildCurvedPalmFrondMeshGeometry(0.55, 0.16, 0.16);
    leaf.rotateZ(0.38);
    leaf.rotateY(a);
    leaf.translate(0, 0.04, 0);
    parts.push(leaf);
  }
  return safeMerge(parts, buildCurvedLeafStrip(0.2, 0.45, 0.15));
}

export function buildGrassClumpGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const tmpColor = new THREE.Color();
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + (i % 2) * 0.22;
    const h = 0.36 + (i % 3) * 0.09;
    const blade = buildCurvedLeafStrip(0.09, h, 0.12, 4);
    const pos = blade.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    for (let v = 0; v < pos.count; v += 1) {
      const t = THREE.MathUtils.clamp(pos.getY(v) / h, 0, 1);
      tmpColor.setRGB(0.2 + t * 0.34, 0.5 + t * 0.36, 0.16 + t * 0.1, THREE.SRGBColorSpace);
      cols[v * 3] = tmpColor.r;
      cols[v * 3 + 1] = tmpColor.g;
      cols[v * 3 + 2] = tmpColor.b;
    }
    blade.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    blade.rotateY(a);
    blade.translate(Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06);
    parts.push(blade);
  }
  return safeMerge(parts, buildCurvedLeafStrip(0.1, 0.35, 0.1));
}

export function buildWildflowerGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const stemA = buildTaperedCurveTube(
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.02, 0.18, 0), new THREE.Vector3(0, 0.35, 0)],
    0.028,
    0.018,
    4,
    5
  );
  setLinearAttrColors(stemA, 0.26, 0.62, 0.22);
  parts.push(stemA);

  const leafL = buildCurvedLeafStrip(0.09, 0.18, 0.06, 3);
  leafL.rotateZ(0.92);
  leafL.translate(-0.02, 0.1, 0);
  setLinearAttrColors(leafL, 0.3, 0.68, 0.24);
  parts.push(leafL);

  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    const petal = new THREE.SphereGeometry(0.085, 7, 5);
    petal.scale(1.15, 0.35, 0.8);
    petal.rotateY(-a);
    petal.translate(Math.cos(a) * 0.095, 0.35, Math.sin(a) * 0.095);
    setLinearAttrColors(petal, 0.98, 0.98, 0.98);
    parts.push(petal);
  }

  const center = new THREE.SphereGeometry(0.06, 7, 5);
  center.scale(1, 0.65, 1);
  center.translate(0, 0.36, 0);
  setLinearAttrColors(center, 0.98, 0.82, 0.22);
  parts.push(center);

  return safeMerge(parts, new THREE.SphereGeometry(0.15, 6, 5));
}

export function buildCoastalReedGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const h = 0.85 + (i % 2) * 0.25;
    const stalk = buildTaperedCurveTube(
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, h * 0.5, 0), new THREE.Vector3(0.12, h, 0)],
      0.036,
      0.018,
      5,
      5
    );
    stalk.rotateY(a);
    stalk.translate(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08);
    setLinearAttrColors(stalk, 0.34, 0.64, 0.26);
    parts.push(stalk);

    if (i < 2) {
      const head = new THREE.CapsuleGeometry(0.052, 0.16, 4, 6);
      head.translate(0.1, h * 0.88, 0);
      head.rotateY(a);
      head.translate(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08);
      setLinearAttrColors(head, 0.46, 0.28, 0.14);
      parts.push(head);
    }
  }
  return safeMerge(parts, new THREE.CapsuleGeometry(0.04, 0.8, 4, 5));
}

export function buildTinyMushroomGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const specs = [
    { x: 0, z: 0, s: 1.0 },
    { x: 0.16, z: 0.11, s: 0.65 },
    { x: -0.13, z: 0.14, s: 0.52 },
  ];
  for (const sp of specs) {
    const st = new THREE.CapsuleGeometry(0.04 * sp.s, 0.12 * sp.s, 4, 6);
    st.translate(sp.x, 0.09 * sp.s, sp.z);
    setLinearAttrColors(st, 0.92, 0.88, 0.8);
    parts.push(st);

    const cp = new THREE.SphereGeometry(0.12 * sp.s, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.58);
    cp.scale(1.1, 0.75, 1.1);
    cp.translate(sp.x, 0.18 * sp.s, sp.z);
    setLinearAttrColors(cp, 0.45, 0.95, 1.0);
    parts.push(cp);
  }
  return safeMerge(parts, new THREE.SphereGeometry(0.12, 7, 5));
}

export function buildCurvedGullWingGeometry(): THREE.BufferGeometry {
  const wing = buildCurvedLeafStrip(0.22, 0.64, 0.08, 4);
  wing.rotateZ(-Math.PI / 2);
  wing.rotateX(Math.PI / 2);
  return wing;
}

export function buildCampfireLogsGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const log = new THREE.CapsuleGeometry(0.11, 0.95, 5, 8);
    log.rotateZ(Math.PI * 0.36);
    log.rotateY(a);
    log.translate(Math.cos(a) * 0.16, 0.22, Math.sin(a) * 0.16);
    parts.push(log);
  }
  return safeMerge(parts, new THREE.CapsuleGeometry(0.12, 0.8, 5, 8));
}

export function buildFlameTongueGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.32, 0.14),
    new THREE.Vector2(0.28, 0.42),
    new THREE.Vector2(0.14, 0.72),
    new THREE.Vector2(0.0, 0.96),
  ];
  return new THREE.LatheGeometry(pts, 12);
}

export function buildWoodLogGeometry(radius = 0.085, length = 0.56): THREE.BufferGeometry {
  const half = length * 0.5;
  const pts = [
    new THREE.Vector2(0.0, -half),
    new THREE.Vector2(radius * 0.76, -half),
    new THREE.Vector2(radius * 0.96, -half * 0.88),
    new THREE.Vector2(radius * 1.02, -half * 0.3),
    new THREE.Vector2(radius * 0.98, 0.0),
    new THREE.Vector2(radius * 1.03, half * 0.35),
    new THREE.Vector2(radius * 0.95, half * 0.88),
    new THREE.Vector2(radius * 0.76, half),
    new THREE.Vector2(0.0, half),
  ];
  const geo = new THREE.LatheGeometry(pts, 12);
  geo.rotateZ(Math.PI / 2);

  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const isCutFace = Math.abs(px) >= half * 0.89;
    if (isCutFace) {
      c.setRGB(0.94, 0.78, 0.52, THREE.SRGBColorSpace);
    } else {
      const barkShade = 0.86 + 0.14 * Math.sin(py * 24 + pz * 24);
      c.setRGB(0.56 * barkShade, 0.34 * barkShade, 0.17 * barkShade, THREE.SRGBColorSpace);
    }
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}

export function buildTreeStumpGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.56, 0.0),
    new THREE.Vector2(0.42, 0.14),
    new THREE.Vector2(0.32, 0.36),
    new THREE.Vector2(0.3, 0.56),
    new THREE.Vector2(0.24, 0.58),
    new THREE.Vector2(0.0, 0.58),
  ];
  const stump = new THREE.LatheGeometry(pts, 14);
  const pos = stump.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const phi = Math.atan2(pz, px);
    if (py < 0.32) {
      const rootFlare = 1 + 0.18 * Math.cos(phi * 4) * (1 - py / 0.32);
      pos.setXYZ(i, px * rootFlare, py, pz * rootFlare);
    }
    if (py >= 0.55) {
      c.setRGB(0.93, 0.77, 0.49, THREE.SRGBColorSpace);
    } else {
      c.setRGB(0.54, 0.33, 0.16, THREE.SRGBColorSpace);
    }
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  stump.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  stump.computeVertexNormals();
  return stump;
}

export function buildAxeToolGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const handle = buildTaperedCurveTube(
    [
      new THREE.Vector3(0, -0.08, 0),
      new THREE.Vector3(0, 0.25, 0.03),
      new THREE.Vector3(0, 0.58, 0.0),
      new THREE.Vector3(0, 0.78, -0.04),
    ],
    0.042,
    0.036,
    8,
    8
  );
  setLinearAttrColors(handle, 0.62, 0.36, 0.16);
  parts.push(handle);

  const collar = new THREE.SphereGeometry(0.068, 10, 8);
  collar.scale(0.9, 1.1, 1.35);
  collar.translate(0, 0.7, -0.02);
  setLinearAttrColors(collar, 0.35, 0.41, 0.48);
  parts.push(collar);

  // Curved smooth axe blade (deformed sphere, zero boxes!)
  const blade = new THREE.SphereGeometry(0.2, 14, 10);
  const pos = blade.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const edgeThin = z > 0 ? Math.max(0.14, 1 - (z / 0.2) * 0.85) : 0.75;
    const fan = 1 + Math.max(0, z / 0.2) * 0.42;
    pos.setXYZ(i, x * 0.26 * edgeThin, y * 0.82 * fan, z * 1.28);
  }
  blade.computeVertexNormals();
  blade.translate(0, 0.72, 0.15);
  setLinearAttrColors(blade, 0.84, 0.9, 0.96);
  parts.push(blade);

  return safeMerge(parts, new THREE.CapsuleGeometry(0.04, 0.7, 5, 8));
}

export function buildFishingRodPoleGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const grip = new THREE.CapsuleGeometry(0.046, 0.22, 5, 8);
  grip.translate(0, 0.08, 0);
  setLinearAttrColors(grip, 0.45, 0.24, 0.11);
  parts.push(grip);

  const reel = new THREE.SphereGeometry(0.065, 10, 8);
  reel.scale(0.85, 1.0, 1.15);
  reel.translate(0, 0.22, 0.055);
  setLinearAttrColors(reel, 0.92, 0.72, 0.22);
  parts.push(reel);

  const pole = buildTaperedCurveTube(
    [
      new THREE.Vector3(0, 0.16, 0),
      new THREE.Vector3(0, 0.65, 0.14),
      new THREE.Vector3(0, 1.16, 0.42),
      new THREE.Vector3(0, 1.48, 0.86),
    ],
    0.032,
    0.011,
    10,
    7
  );
  setLinearAttrColors(pole, 0.78, 0.62, 0.34);
  parts.push(pole);

  return safeMerge(parts, new THREE.CapsuleGeometry(0.03, 1.2, 5, 8));
}

export function buildFishGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const body = new THREE.SphereGeometry(0.16, 14, 10);
  const pos = body.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nz = z * 1.65;
    const taper = z < 0 ? Math.max(0.28, 1 + z * 3.4) : 1 - z * 0.25;
    pos.setXYZ(i, x * 0.62 * taper, y * 0.92 * taper, nz);
    const stripe = Math.sin(nz * 22) > 0.35 ? 1.0 : 0.0;
    c.setRGB(
      THREE.MathUtils.lerp(0.98, 1.0, stripe),
      THREE.MathUtils.lerp(0.45, 0.92, stripe),
      THREE.MathUtils.lerp(0.18, 0.78, stripe),
      THREE.SRGBColorSpace
    );
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  body.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  body.computeVertexNormals();
  parts.push(body);

  const tail = buildCurvedLeafStrip(0.2, 0.22, 0.03, 3);
  tail.rotateX(-Math.PI / 2);
  tail.rotateZ(Math.PI / 2);
  tail.translate(0, 0, -0.22);
  setLinearAttrColors(tail, 0.98, 0.68, 0.18);
  parts.push(tail);

  const dorsal = buildCurvedLeafStrip(0.11, 0.14, 0.05, 3);
  dorsal.rotateX(-0.45);
  dorsal.translate(0, 0.1, -0.02);
  setLinearAttrColors(dorsal, 0.98, 0.68, 0.18);
  parts.push(dorsal);

  return safeMerge(parts, new THREE.SphereGeometry(0.14, 10, 8));
}

export function buildSeashellGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.26, 16, 12);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const phi = Math.atan2(x, z + 0.26);
    const fan = 1 + 0.14 * Math.cos(phi * 10);
    const flattenZ = z < 0 ? z * 0.42 : z * 1.15;
    const ny = y * 0.42 + (z > 0 ? 0.04 : 0);
    pos.setXYZ(i, x * 1.18 * fan, ny, flattenZ);

    const t = THREE.MathUtils.clamp((z / 0.26 + 1) * 0.5, 0, 1);
    const ribShade = 0.9 + 0.1 * Math.cos(phi * 10);
    c.setRGB(
      Math.min(1, THREE.MathUtils.lerp(0.98, 1.0, t) * ribShade),
      Math.min(1, THREE.MathUtils.lerp(0.68, 0.92, t) * ribShade),
      Math.min(1, THREE.MathUtils.lerp(0.76, 0.88, t) * ribShade),
      THREE.SRGBColorSpace
    );
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  geo.translate(0, 0.09, 0);
  return geo;
}

export function buildCanopyBlossomsGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const spots: Array<[number, number, number, number, [number, number, number]]> = [
    [0.58, 3.85, 0.56, 0.28, [1.0, 0.48, 0.68]],
    [-0.86, 3.22, 0.72, 0.26, [1.0, 0.84, 0.3]],
    [0.98, 3.24, -0.45, 0.27, [1.0, 0.56, 0.76]],
    [-0.25, 4.18, -0.32, 0.25, [1.0, 0.94, 0.58]],
    [0.14, 3.28, 1.38, 0.24, [1.0, 0.52, 0.72]],
    [-1.22, 2.95, -0.32, 0.25, [1.0, 0.8, 0.28]],
    [0.05, 4.02, 0.42, 0.23, [0.98, 0.64, 0.95]],
  ];
  for (const [x, y, z, r, rgb] of spots) {
    const blossom = new THREE.SphereGeometry(r, 9, 8);
    blossom.scale(1.15, 0.85, 1.15);
    blossom.translate(x, y, z);
    setLinearAttrColors(blossom, rgb[0], rgb[1], rgb[2]);
    parts.push(blossom);
  }
  return safeMerge(parts, new THREE.SphereGeometry(0.24, 8, 6));
}

export function buildCampShelterGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Cozy curved floor rug
  const rug = new THREE.SphereGeometry(1.55, 16, 10);
  rug.scale(1.05, 0.07, 1.2);
  rug.translate(0, 0.05, 0);
  setLinearAttrColors(rug, 0.88, 0.66, 0.36);
  parts.push(rug);

  // Curved driftwood A-frame arches (front & back)
  for (const zPos of [-1.2, 1.2]) {
    const arch = buildTaperedCurveTube(
      [
        new THREE.Vector3(-1.35, 0, zPos),
        new THREE.Vector3(-0.75, 1.35, zPos),
        new THREE.Vector3(0, 2.15, zPos),
        new THREE.Vector3(0.75, 1.35, zPos),
        new THREE.Vector3(1.35, 0, zPos),
      ],
      0.13,
      0.12,
      12,
      8
    );
    setLinearAttrColors(arch, 0.58, 0.34, 0.16);
    parts.push(arch);
  }

  // Ridge beam
  const ridge = new THREE.CapsuleGeometry(0.1, 2.65, 5, 8);
  ridge.rotateX(Math.PI / 2);
  ridge.translate(0, 2.12, 0);
  setLinearAttrColors(ridge, 0.52, 0.3, 0.14);
  parts.push(ridge);

  // Lush layered thatch canopy sides
  for (const side of [-1, 1]) {
    for (let row = 0; row < 4; row += 1) {
      const zOff = -1.05 + row * 0.7;
      const frond = buildCurvedPalmFrondMeshGeometry(1.75, 0.52, 0.55);
      frond.rotateZ(-0.62);
      if (side < 0) frond.rotateY(Math.PI);
      frond.translate(0, 2.1, zOff);
      setLinearAttrColors(frond, 0.84, 0.72, 0.34);
      parts.push(frond);
    }
  }

  // Warm glowing camp lantern hanging from front peak
  const lantern = new THREE.SphereGeometry(0.19, 10, 8);
  lantern.translate(0, 1.72, 1.15);
  setLinearAttrColors(lantern, 1.0, 0.88, 0.42);
  parts.push(lantern);

  return safeMerge(parts, new THREE.CapsuleGeometry(0.8, 1.2, 6, 10));
}

export function buildStorageRackGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  for (const xPos of [-0.72, 0.72]) {
    const post = buildTaperedCurveTube(
      [
        new THREE.Vector3(xPos, 0, -0.35),
        new THREE.Vector3(xPos * 0.94, 0.85, -0.25),
        new THREE.Vector3(xPos * 0.9, 1.55, 0.0),
      ],
      0.11,
      0.08,
      6,
      7
    );
    setLinearAttrColors(post, 0.56, 0.33, 0.15);
    parts.push(post);
  }

  // Crossbar shelf beams
  for (const yPos of [0.55, 1.15]) {
    const bar = new THREE.CapsuleGeometry(0.075, 1.55, 5, 8);
    bar.rotateZ(Math.PI / 2);
    bar.translate(0, yPos, -0.1);
    setLinearAttrColors(bar, 0.66, 0.41, 0.2);
    parts.push(bar);
  }

  // Neatly stacked logs on the rack
  for (let i = 0; i < 4; i += 1) {
    const log = buildWoodLogGeometry(0.095, 0.78);
    log.rotateY(Math.PI / 2);
    log.translate(-0.35 + i * 0.23, 0.7, -0.1);
    parts.push(log);
  }

  // Woven supply basket on top shelf
  const basket = buildWeatheredBarrelGeometry();
  basket.scale(0.95, 0.75, 0.95);
  basket.translate(0.28, 1.38, -0.05);
  setLinearAttrColors(basket, 0.88, 0.68, 0.35);
  parts.push(basket);

  return safeMerge(parts, new THREE.CapsuleGeometry(0.5, 1.0, 5, 8));
}

export function buildFishingPierGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // 4 rounded wooden pilings driven into lagoon seabed
  for (const [px, pz] of [
    [-0.95, 0.8],
    [0.95, 0.8],
    [-0.95, 3.6],
    [0.95, 3.6],
  ]) {
    const piling = new THREE.CapsuleGeometry(0.14, 1.75, 5, 8);
    piling.translate(px, 0.15, pz);
    setLinearAttrColors(piling, 0.48, 0.29, 0.14);
    parts.push(piling);
  }

  // Sculpted weathered driftwood pier planks extending over water (+Z)
  for (let i = 0; i < 9; i += 1) {
    const plank = buildSculptedStoneSlabGeometry(2.35, 0.16, 0.44, i * 1.1);
    plank.translate(0, 0.62, 0.2 + i * 0.46);
    const shade = 0.92 + (i % 2) * 0.08;
    setLinearAttrColors(plank, 0.74 * shade, 0.49 * shade, 0.26 * shade);
    parts.push(plank);
  }

  // Cozy dock lantern post at the end of the pier
  const lanternBulb = new THREE.SphereGeometry(0.17, 10, 8);
  lanternBulb.translate(0.95, 1.38, 3.6);
  setLinearAttrColors(lanternBulb, 1.0, 0.86, 0.38);
  parts.push(lanternBulb);

  return safeMerge(parts, new THREE.CapsuleGeometry(0.8, 3.2, 5, 8));
}

// Climbable Banana Tree (curved leafy stalk, wide lush tropical leaves, hanging golden banana bunches!)
export function buildBananaTrunkGeometry(): THREE.BufferGeometry {
  return buildTaperedCurveTube(
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.06, 0.9, 0.04),
      new THREE.Vector3(0.14, 1.9, 0.08),
      new THREE.Vector3(0.18, 2.75, 0.06),
    ],
    0.26,
    0.15,
    10,
    9,
    0.03
  );
}

export function buildBananaCanopyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const crownX = 0.18;
  const crownY = 2.75;
  const crownZ = 0.06;

  for (let i = 0; i < 6; i += 1) {
    const yaw = (i / 6) * Math.PI * 2 + 0.2;
    const blade = buildCurvedPalmFrondMeshGeometry(2.05, 0.66, 0.92);
    blade.rotateZ(0.18);
    blade.rotateY(yaw);
    blade.translate(crownX, crownY, crownZ);
    parts.push(blade);
  }
  for (let i = 0; i < 3; i += 1) {
    const yaw = (i / 3) * Math.PI * 2 + 0.7;
    const blade = buildCurvedPalmFrondMeshGeometry(1.45, 0.52, 0.38);
    blade.rotateZ(0.45);
    blade.rotateY(yaw);
    blade.translate(crownX, crownY + 0.15, crownZ);
    parts.push(blade);
  }
  return safeMerge(parts, new THREE.SphereGeometry(0.9, 10, 8));
}

export function buildBananaItemGeometry(scale = 1): THREE.BufferGeometry {
  const bananaCurve = buildTaperedCurveTube(
    [
      new THREE.Vector3(-0.14 * scale, 0.04 * scale, 0),
      new THREE.Vector3(0, 0.12 * scale, 0),
      new THREE.Vector3(0.15 * scale, 0.02 * scale, 0),
    ],
    0.048 * scale,
    0.038 * scale,
    6,
    7
  );
  setLinearAttrColors(bananaCurve, 1.0, 0.86, 0.22);
  return bananaCurve;
}

export function buildBananaBunchGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const b = buildBananaItemGeometry(1.1);
    b.rotateZ(-Math.PI * 0.42);
    b.rotateY(a);
    b.translate(0.18 + Math.cos(a) * 0.22, 2.42 - (i % 2) * 0.08, 0.06 + Math.sin(a) * 0.22);
    parts.push(b);
  }
  return safeMerge(parts, new THREE.SphereGeometry(0.2, 8, 6));
}

// Sprawling Banyan Tree with hanging aerial roots & wide layered canopy
export function buildBanyanTrunkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const main = buildTaperedCurveTube(
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.08, 0.95, 0.06),
      new THREE.Vector3(0.05, 1.95, -0.04),
      new THREE.Vector3(0, 2.75, 0),
    ],
    0.58,
    0.28,
    10,
    9
  );
  parts.push(main);

  // Aerial roots anchoring outward
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const root = buildTaperedCurveTube(
      [
        new THREE.Vector3(Math.cos(a) * 0.82, 0, Math.sin(a) * 0.82),
        new THREE.Vector3(Math.cos(a) * 0.65, 1.15, Math.sin(a) * 0.65),
        new THREE.Vector3(Math.cos(a) * 0.45, 2.15, Math.sin(a) * 0.45),
      ],
      0.11,
      0.08,
      6,
      6
    );
    parts.push(root);
  }
  return safeMerge(parts, new THREE.CapsuleGeometry(0.45, 2.2, 6, 8));
}

export function buildBanyanCanopyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const lobes = [
    { x: 0, y: 3.1, z: 0, r: 1.55 },
    { x: -1.18, y: 2.65, z: 0.45, r: 1.05 },
    { x: 1.15, y: 2.7, z: -0.35, r: 1.08 },
    { x: 0.25, y: 2.6, z: 1.1, r: 0.98 },
    { x: -0.35, y: 2.75, z: -1.05, r: 0.95 },
    { x: 0.1, y: 3.72, z: -0.1, r: 1.02 },
  ];
  for (let i = 0; i < lobes.length; i += 1) {
    const l = lobes[i];
    const puff = buildSculptedBoulderGeometry(l.r, i * 3.1 + 1.4);
    puff.scale(1.24, 0.72, 1.18);
    puff.translate(l.x, l.y, l.z);
    parts.push(puff);
  }
  return safeMerge(parts, new THREE.SphereGeometry(1.5, 12, 10));
}

// Luminous Mystic Willow Tree (drooping cascading leaf curtains near Crystal Spring & Mushroom Grove)
export function buildWillowTrunkGeometry(): THREE.BufferGeometry {
  return buildTaperedCurveTube(
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.12, 1.0, 0.08),
      new THREE.Vector3(0.08, 2.1, -0.05),
      new THREE.Vector3(0, 3.05, 0),
    ],
    0.36,
    0.16,
    9,
    8
  );
}

export function buildWillowCanopyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const crown = buildSculptedBoulderGeometry(1.18, 4.2);
  crown.scale(1.28, 0.68, 1.28);
  crown.translate(0, 3.25, 0);
  parts.push(crown);

  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const vine = buildCurvedLeafStrip(0.36, 1.85, 0.22, 5);
    vine.rotateX(Math.PI * 0.94);
    vine.rotateY(a);
    vine.translate(Math.cos(a) * 1.18, 3.15, Math.sin(a) * 1.18);
    setLinearAttrColors(vine, 0.45, 0.88, 0.78);
    parts.push(vine);
  }
  return safeMerge(parts, new THREE.SphereGeometry(1.1, 10, 8));
}

// 3D Wooden/Shell Spear & Fire Spear for Ocean Spearfishing!
export function buildSpearToolGeometry(isFireSpear = false): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const shaft = buildTaperedCurveTube(
    [
      new THREE.Vector3(0, -0.45, 0),
      new THREE.Vector3(0, 0.45, 0.01),
      new THREE.Vector3(0, 1.48, 0),
    ],
    0.036,
    0.028,
    8,
    7
  );
  setLinearAttrColors(shaft, 0.56, 0.34, 0.16);
  parts.push(shaft);

  // Lash binding
  const wrap = new THREE.SphereGeometry(0.055, 8, 6);
  wrap.scale(1, 1.4, 1);
  wrap.translate(0, 1.42, 0);
  setLinearAttrColors(wrap, 0.92, 0.8, 0.54);
  parts.push(wrap);

  // Sculpted leaf-shaped spearhead (bone/shell or glowing ember!)
  const tip = new THREE.SphereGeometry(0.095, 10, 8);
  const pos = tip.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp((y / 0.095 + 1) * 0.5, 0, 1);
    const taper = Math.max(0.08, 1 - t * 0.92);
    pos.setXYZ(i, x * 0.72 * taper, y * 2.4, z * 0.34 * taper);
  }
  tip.computeVertexNormals();
  tip.translate(0, 1.62, 0);
  if (isFireSpear) {
    setLinearAttrColors(tip, 1.0, 0.46, 0.12);
  } else {
    setLinearAttrColors(tip, 0.88, 0.94, 0.98);
  }
  parts.push(tip);

  return safeMerge(parts, new THREE.CapsuleGeometry(0.03, 1.8, 5, 7));
}

