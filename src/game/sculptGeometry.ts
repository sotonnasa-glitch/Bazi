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
    const g = allIndexed ? orig : orig.index ? orig.toNonIndexed() : orig;
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

function buildSerratedPalmFrondMeshGeometry(
  length: number,
  width: number,
  droop: number
): THREE.BufferGeometry {
  const segments = 12;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const c = new THREE.Color();

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const x = t * length;
    const y = Math.sin(t * Math.PI * 0.65) * 0.44 - Math.pow(t, 1.92) * droop;
    // Alternating leaflet serration notches along the frond edge for natural palm silhouette
    const notch = i > 1 && i < segments ? (i % 2 === 0 ? 1.08 : 0.68) : 1.0;
    const halfW = width * Math.sin(Math.pow(t, 0.58) * Math.PI * 0.94 + 0.12) * notch;
    const sagY = y - halfW * 0.34;

    positions.push(x, sagY, -halfW);
    positions.push(x, y + 0.055, 0);
    positions.push(x, sagY, halfW);
    uvs.push(t, 0, t, 0.5, t, 1);

    c.setRGB(0.62 + t * 0.32, 0.84 + t * 0.15, 0.64 + t * 0.1, THREE.SRGBColorSpace);
    colors.push(c.r * 0.9, c.g * 0.9, c.b * 0.9);
    colors.push(c.r * 1.06, c.g * 1.06, c.b);
    colors.push(c.r * 0.9, c.g * 0.9, c.b * 0.9);

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

export function buildCurvedPalmFrondMeshGeometry(
  length: number,
  width: number,
  droop: number
): THREE.BufferGeometry {
  return buildSerratedPalmFrondMeshGeometry(length, width, droop);
}

export function buildCurvedPalmTrunkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(
    buildTaperedCurveTube(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.14, 1.15, 0.04),
        new THREE.Vector3(0.42, 2.55, -0.04),
        new THREE.Vector3(0.74, 3.84, 0),
      ],
      0.35,
      0.15,
      13,
      10,
      0.048
    )
  );
  // Subtle exposed basal roots
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + 0.35;
    const r = buildTaperedCurveTube(
      [
        new THREE.Vector3(Math.cos(a) * 0.56, -0.05, Math.sin(a) * 0.56),
        new THREE.Vector3(Math.cos(a) * 0.3, 0.16, Math.sin(a) * 0.3),
        new THREE.Vector3(Math.cos(a) * 0.14, 0.42, Math.sin(a) * 0.14),
      ],
      0.11,
      0.06,
      4,
      6
    );
    parts.push(r);
  }
  return safeMerge(parts, new THREE.CapsuleGeometry(0.24, 3.6, 5, 8));
}

export function buildPalmCanopyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const crownX = 0.74;
  const crownY = 3.82;

  for (let i = 0; i < 7; i += 1) {
    const yaw = (i / 7) * Math.PI * 2 + (i % 2) * 0.14;
    const blade = buildSerratedPalmFrondMeshGeometry(2.38 + (i % 3) * 0.14, 0.56, 1.16 + (i % 2) * 0.16);
    blade.rotateX((i % 2 === 0 ? 1 : -1) * 0.06);
    blade.rotateY(yaw);
    blade.translate(crownX, crownY, 0);
    parts.push(blade);
  }
  for (let i = 0; i < 5; i += 1) {
    const yaw = (i / 5) * Math.PI * 2 + 0.48;
    const blade = buildSerratedPalmFrondMeshGeometry(1.75, 0.44, 0.52);
    blade.rotateZ(0.26);
    blade.rotateY(yaw);
    blade.translate(crownX, crownY + 0.1, 0);
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

// Organic multi-leaf ruffled foliage tuft (replaces round geometric spheres on trees!)
function buildOrganicLeafSprayTuple(
  radius: number,
  seed: number,
  leafBlades = 9,
  flatness = 0.64
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Irregular crinkled inner foliage core
  const core = new THREE.IcosahedronGeometry(radius * 0.72, 1);
  const pos = core.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n =
      0.86 +
      0.24 * Math.sin(x * 4.5 + seed) * Math.cos(z * 4.1 - seed) +
      0.14 * Math.cos(y * 5.2 + seed * 1.7);
    const ny = y * flatness * n;
    pos.setXYZ(i, x * n * 1.08, ny, z * n * 1.04);
    const shade = 0.74 + THREE.MathUtils.clamp((ny / Math.max(0.1, radius) + 0.8) * 0.25, 0, 0.34);
    c.setRGB(shade * 0.94, shade * 1.02, shade * 0.9, THREE.SRGBColorSpace);
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  core.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  core.computeVertexNormals();
  parts.push(core);

  // Overlapping curved organic leaf sprays jutting outward for ragged leafy edge silhouettes
  for (let i = 0; i < leafBlades; i += 1) {
    const a = (i / leafBlades) * Math.PI * 2 + seed * 0.65;
    const tier = i % 3;
    const bladeLen = radius * (0.78 + (i % 2) * 0.24);
    const blade = buildCurvedLeafStrip(radius * 0.44, bladeLen, radius * 0.28, 4);
    const bPos = blade.attributes.position;
    const bCols = new Float32Array(bPos.count * 3);
    for (let v = 0; v < bPos.count; v += 1) {
      const t = THREE.MathUtils.clamp(bPos.getY(v) / Math.max(0.1, bladeLen), 0, 1);
      c.setRGB(0.8 + t * 0.22, 0.88 + t * 0.14, 0.76 + t * 0.1, THREE.SRGBColorSpace);
      bCols[v * 3] = c.r;
      bCols[v * 3 + 1] = c.g;
      bCols[v * 3 + 2] = c.b;
    }
    blade.setAttribute('color', new THREE.BufferAttribute(bCols, 3));
    blade.rotateZ(0.65 + tier * 0.24);
    blade.rotateY(a);
    blade.translate(
      Math.cos(a) * radius * 0.32,
      (tier - 1) * radius * 0.22,
      Math.sin(a) * radius * 0.32
    );
    parts.push(blade);
  }

  return safeMerge(parts, core);
}

export function buildJungleTrunkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(
    buildTaperedCurveTube(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.08, 0.85, 0.05),
        new THREE.Vector3(-0.07, 1.78, -0.03),
        new THREE.Vector3(0.04, 2.62, 0.02),
      ],
      0.42,
      0.18,
      10,
      9
    )
  );
  // Exposed gnarled buttress roots
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + 0.5;
    parts.push(
      buildTaperedCurveTube(
        [
          new THREE.Vector3(Math.cos(a) * 0.68, -0.05, Math.sin(a) * 0.68),
          new THREE.Vector3(Math.cos(a) * 0.38, 0.24, Math.sin(a) * 0.38),
          new THREE.Vector3(Math.cos(a) * 0.16, 0.65, Math.sin(a) * 0.16),
        ],
        0.13,
        0.07,
        5,
        6
      )
    );
  }
  // Forked gnarled branches + secondary sub-limbs
  parts.push(
    buildTaperedCurveTube(
      [
        new THREE.Vector3(-0.04, 1.38, 0.02),
        new THREE.Vector3(-0.42, 1.92, 0.2),
        new THREE.Vector3(-0.88, 2.48, 0.36),
      ],
      0.18,
      0.08,
      7,
      7
    ),
    buildTaperedCurveTube(
      [
        new THREE.Vector3(0.04, 1.52, -0.03),
        new THREE.Vector3(0.44, 2.02, -0.22),
        new THREE.Vector3(0.86, 2.55, -0.34),
      ],
      0.17,
      0.08,
      7,
      7
    ),
    buildTaperedCurveTube(
      [
        new THREE.Vector3(0.0, 1.72, 0.04),
        new THREE.Vector3(0.18, 2.18, 0.44),
        new THREE.Vector3(0.32, 2.54, 0.82),
      ],
      0.14,
      0.06,
      6,
      6
    )
  );
  return safeMerge(parts, new THREE.CapsuleGeometry(0.3, 2.0, 6, 10));
}

export function buildJungleCanopyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const clusters = [
    { x: -0.08, y: 2.95, z: 0.04, r: 1.18, blades: 10 },
    { x: -0.92, y: 2.55, z: 0.38, r: 0.88, blades: 8 },
    { x: 0.88, y: 2.62, z: -0.34, r: 0.92, blades: 8 },
    { x: 0.34, y: 2.58, z: 0.84, r: 0.82, blades: 7 },
    { x: -0.32, y: 3.45, z: -0.28, r: 0.84, blades: 8 },
    { x: 0.42, y: 3.22, z: 0.25, r: 0.72, blades: 7 },
  ];
  clusters.forEach((cl, idx) => {
    const spray = buildOrganicLeafSprayTuple(cl.r, idx * 1.9 + 0.4, cl.blades, 0.58);
    spray.rotateY(idx * 0.85);
    spray.translate(cl.x, cl.y, cl.z);
    parts.push(spray);
  });
  return safeMerge(parts, new THREE.SphereGeometry(1.3, 12, 10));
}

export function buildJungleCanopyVariantBGeometry(): THREE.BufferGeometry {
  // Taller, wind-swept rainforest twin-crown silhouette for canopy diversity
  const parts: THREE.BufferGeometry[] = [];
  const clusters = [
    { x: 0.14, y: 3.42, z: -0.08, r: 1.08, blades: 10 },
    { x: -0.82, y: 2.75, z: 0.28, r: 0.84, blades: 8 },
    { x: 0.76, y: 2.35, z: 0.35, r: 0.82, blades: 8 },
    { x: -0.18, y: 3.92, z: 0.16, r: 0.78, blades: 7 },
    { x: 0.24, y: 2.86, z: -0.78, r: 0.84, blades: 7 },
  ];
  clusters.forEach((cl, idx) => {
    const spray = buildOrganicLeafSprayTuple(cl.r, idx * 2.3 + 4.1, cl.blades, 0.54);
    spray.rotateY(idx * 1.15);
    spray.translate(cl.x, cl.y, cl.z);
    parts.push(spray);
  });
  return safeMerge(parts, new THREE.SphereGeometry(1.2, 10, 8));
}

// Organic gnarled pine tree — irregular wind-swept needle bough pads (zero cones!)
export function buildPineTrunkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(
    buildTaperedCurveTube(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.08, 0.95, 0.04),
        new THREE.Vector3(-0.07, 2.0, -0.05),
        new THREE.Vector3(0.06, 3.15, 0.03),
      ],
      0.34,
      0.11,
      9,
      8
    )
  );
  // Root flare & two gnarled lower branch stubs
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + 0.2;
    parts.push(
      buildTaperedCurveTube(
        [
          new THREE.Vector3(Math.cos(a) * 0.55, -0.04, Math.sin(a) * 0.55),
          new THREE.Vector3(Math.cos(a) * 0.18, 0.38, Math.sin(a) * 0.18),
        ],
        0.1,
        0.05,
        4,
        5
      )
    );
  }
  return safeMerge(parts, new THREE.CapsuleGeometry(0.24, 2.6, 5, 8));
}

function buildAsymmetricPineBoughPad(
  radius: number,
  seed: number,
  srgb: [number, number, number]
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const needleFans = 7;
  const c = new THREE.Color();
  for (let i = 0; i < needleFans; i += 1) {
    const a = (i / needleFans) * Math.PI * 2 + seed * 0.4;
    const len = radius * (0.85 + Math.sin(i * 2.1 + seed) * 0.22);
    const fan = buildCurvedLeafStrip(radius * 0.52, len, radius * 0.3, 4);
    const pos = fan.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    for (let v = 0; v < pos.count; v += 1) {
      const t = THREE.MathUtils.clamp(pos.getY(v) / Math.max(0.1, len), 0, 1);
      const lit = 0.8 + t * 0.3;
      c.setRGB(
        Math.min(1, srgb[0] * lit),
        Math.min(1, srgb[1] * lit),
        Math.min(1, srgb[2] * lit),
        THREE.SRGBColorSpace
      );
      cols[v * 3] = c.r;
      cols[v * 3 + 1] = c.g;
      cols[v * 3 + 2] = c.b;
    }
    fan.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    fan.rotateZ(1.08 + (i % 2) * 0.18);
    fan.rotateY(a);
    parts.push(fan);
  }
  const hub = buildOrganicLeafSprayTuple(radius * 0.55, seed, 5, 0.48);
  setLinearAttrColors(hub, srgb[0] * 0.92, srgb[1] * 0.95, srgb[2] * 0.92);
  parts.push(hub);
  return safeMerge(parts, new THREE.SphereGeometry(radius * 0.5, 8, 6));
}

export function buildPineCanopyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const pads: Array<{ x: number; y: number; z: number; r: number; rot: number; shade: [number, number, number] }> = [
    { x: -0.22, y: 1.72, z: 0.14, r: 1.38, rot: 0.2, shade: [0.22, 0.54, 0.26] },
    { x: 0.24, y: 2.18, z: -0.18, r: 1.24, rot: 1.4, shade: [0.25, 0.59, 0.27] },
    { x: -0.14, y: 2.68, z: -0.1, r: 1.12, rot: 2.6, shade: [0.28, 0.64, 0.28] },
    { x: 0.16, y: 3.16, z: 0.12, r: 0.94, rot: 0.7, shade: [0.33, 0.69, 0.29] },
    { x: -0.05, y: 3.64, z: 0.02, r: 0.72, rot: 1.9, shade: [0.38, 0.75, 0.32] },
    { x: 0.04, y: 4.05, z: 0.02, r: 0.48, rot: 3.1, shade: [0.43, 0.8, 0.34] },
  ];
  pads.forEach((p, idx) => {
    const pad = buildAsymmetricPineBoughPad(p.r, idx * 1.7 + 0.8, p.shade);
    pad.rotateY(p.rot);
    pad.translate(p.x, p.y, p.z);
    parts.push(pad);
  });
  return safeMerge(parts, new THREE.SphereGeometry(1.1, 12, 8));
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
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2 + (i % 2) * 0.26;
    const h = 0.34 + (i % 3) * 0.12;
    const blade = buildCurvedLeafStrip(0.085, h, 0.14 + (i % 2) * 0.05, 4);
    const pos = blade.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    for (let v = 0; v < pos.count; v += 1) {
      const t = THREE.MathUtils.clamp(pos.getY(v) / h, 0, 1);
      tmpColor.setRGB(0.22 + t * 0.36, 0.52 + t * 0.38, 0.16 + t * 0.12, THREE.SRGBColorSpace);
      cols[v * 3] = tmpColor.r;
      cols[v * 3 + 1] = tmpColor.g;
      cols[v * 3 + 2] = tmpColor.b;
    }
    blade.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    blade.rotateZ(0.14 + (i % 2) * 0.1);
    blade.rotateY(a);
    blade.translate(Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06);
    parts.push(blade);
  }
  return safeMerge(parts, buildCurvedLeafStrip(0.1, 0.35, 0.1));
}

export function buildCloverPatchGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const spots = [
    { x: 0, z: 0, y: 0.09, s: 1.0, rot: 0.2 },
    { x: 0.16, z: 0.1, y: 0.07, s: 0.82, rot: 1.3 },
    { x: -0.14, z: 0.12, y: 0.08, s: 0.88, rot: 2.4 },
  ];
  for (const sp of spots) {
    for (let l = 0; l < 3; l += 1) {
      const a = (l / 3) * Math.PI * 2 + sp.rot;
      const leaflet = buildCurvedLeafStrip(0.11 * sp.s, 0.14 * sp.s, 0.04, 2);
      leaflet.rotateX(1.22);
      leaflet.rotateY(a);
      leaflet.translate(sp.x, sp.y, sp.z);
      setLinearAttrColors(leaflet, 0.26, 0.68 + (l % 2) * 0.08, 0.24);
      parts.push(leaflet);
    }
  }
  return safeMerge(parts, new THREE.SphereGeometry(0.12, 6, 5));
}

export function buildSavannaPlumeGrassGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const tmpColor = new THREE.Color();
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + 0.35;
    const h = 0.72 + (i % 2) * 0.24;
    const stalk = buildCurvedLeafStrip(0.065, h, 0.28, 5);
    const pos = stalk.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    for (let v = 0; v < pos.count; v += 1) {
      const t = THREE.MathUtils.clamp(pos.getY(v) / h, 0, 1);
      // Green base transitioning to sunlit golden plume tips
      tmpColor.setRGB(
        THREE.MathUtils.lerp(0.32, 0.96, Math.pow(t, 1.5)),
        THREE.MathUtils.lerp(0.62, 0.86, t),
        THREE.MathUtils.lerp(0.2, 0.42, Math.pow(t, 1.8)),
        THREE.SRGBColorSpace
      );
      cols[v * 3] = tmpColor.r;
      cols[v * 3 + 1] = tmpColor.g;
      cols[v * 3 + 2] = tmpColor.b;
    }
    stalk.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    stalk.rotateZ(0.12);
    stalk.rotateY(a);
    stalk.translate(Math.cos(a) * 0.07, 0, Math.sin(a) * 0.07);
    parts.push(stalk);
  }
  return safeMerge(parts, buildCurvedLeafStrip(0.08, 0.7, 0.2));
}

export function buildWildflowerGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const stemA = buildTaperedCurveTube(
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.03, 0.2, 0.01), new THREE.Vector3(0, 0.4, 0)],
    0.024,
    0.016,
    4,
    5
  );
  setLinearAttrColors(stemA, 0.26, 0.62, 0.22);
  parts.push(stemA);

  for (const s of [-1, 1]) {
    const leaf = buildCurvedLeafStrip(0.085, 0.18, 0.06, 3);
    leaf.rotateZ(s * 0.95);
    leaf.translate(s * 0.02, 0.1 + (s > 0 ? 0.03 : 0), 0);
    setLinearAttrColors(leaf, 0.3, 0.68, 0.24);
    parts.push(leaf);
  }

  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const petal = buildCurvedLeafStrip(0.075, 0.14, 0.035, 3);
    petal.rotateX(1.32);
    petal.rotateY(a);
    petal.translate(0, 0.39, 0);
    setLinearAttrColors(petal, 0.98, 0.98, 0.98);
    parts.push(petal);
  }

  const center = new THREE.SphereGeometry(0.052, 7, 5);
  center.scale(1, 0.65, 1);
  center.translate(0, 0.4, 0);
  setLinearAttrColors(center, 0.98, 0.82, 0.22);
  parts.push(center);

  return safeMerge(parts, new THREE.SphereGeometry(0.15, 6, 5));
}

export function buildTropicalHibiscusGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const stem = buildTaperedCurveTube(
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.02, 0.22, 0.02), new THREE.Vector3(0, 0.42, 0)],
    0.028,
    0.018,
    4,
    5
  );
  setLinearAttrColors(stem, 0.22, 0.56, 0.2);
  parts.push(stem);

  for (let i = 0; i < 3; i += 1) {
    const la = (i / 3) * Math.PI * 2 + 0.4;
    const leaf = buildCurvedLeafStrip(0.11, 0.2, 0.07, 3);
    leaf.rotateZ(1.05);
    leaf.rotateY(la);
    leaf.translate(0, 0.14, 0);
    setLinearAttrColors(leaf, 0.24, 0.64, 0.22);
    parts.push(leaf);
  }

  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    const petal = buildCurvedLeafStrip(0.13, 0.18, 0.06, 3);
    petal.rotateX(1.08);
    petal.rotateY(a);
    petal.translate(0, 0.41, 0);
    setLinearAttrColors(petal, 0.98, 0.96, 0.98);
    parts.push(petal);
  }

  const stamen = buildTaperedCurveTube(
    [new THREE.Vector3(0, 0.41, 0), new THREE.Vector3(0.02, 0.56, 0)],
    0.02,
    0.014,
    3,
    5
  );
  setLinearAttrColors(stamen, 1.0, 0.85, 0.28);
  parts.push(stamen);

  return safeMerge(parts, new THREE.SphereGeometry(0.16, 6, 5));
}

export function buildBellflowerSpikeGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const stalk = buildTaperedCurveTube(
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.04, 0.3, 0.02),
      new THREE.Vector3(0.11, 0.62, 0),
    ],
    0.026,
    0.012,
    6,
    5
  );
  setLinearAttrColors(stalk, 0.24, 0.58, 0.24);
  parts.push(stalk);

  for (let i = 0; i < 4; i += 1) {
    const t = 0.35 + i * 0.17;
    const a = i * 1.9;
    const bell = new THREE.SphereGeometry(0.068 - i * 0.008, 7, 6, 0, Math.PI * 2, 0, Math.PI * 0.65);
    bell.rotateX(Math.PI * 0.78);
    bell.rotateY(a);
    bell.translate(0.04 + t * 0.08 + Math.cos(a) * 0.06, t * 0.62, Math.sin(a) * 0.06);
    setLinearAttrColors(bell, 0.96, 0.94, 1.0);
    parts.push(bell);
  }
  return safeMerge(parts, new THREE.CapsuleGeometry(0.04, 0.5, 4, 5));
}

export function buildLotusBloomGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const pad = new THREE.CylinderGeometry(0.42, 0.42, 0.03, 14, 1, false, 0.2, Math.PI * 1.82);
  setLinearAttrColors(pad, 0.24, 0.72, 0.34);
  parts.push(pad);

  for (let ring = 0; ring < 2; ring += 1) {
    const count = ring === 0 ? 7 : 5;
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + ring * 0.3;
      const petal = buildCurvedLeafStrip(0.1, ring === 0 ? 0.22 : 0.16, 0.05, 3);
      petal.rotateX(ring === 0 ? 1.05 : 0.68);
      petal.rotateY(a);
      petal.translate(0, 0.04, 0);
      setLinearAttrColors(petal, 1.0, 0.74 + ring * 0.14, 0.86 + ring * 0.1);
      parts.push(petal);
    }
  }
  const core = new THREE.SphereGeometry(0.065, 8, 6);
  core.translate(0, 0.09, 0);
  setLinearAttrColors(core, 1.0, 0.86, 0.24);
  parts.push(core);
  return safeMerge(parts, new THREE.CylinderGeometry(0.35, 0.35, 0.05, 10));
}

export function buildSporeBloomGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const stem = buildTaperedCurveTube(
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.03, 0.18, 0), new THREE.Vector3(0, 0.34, 0)],
    0.025,
    0.018,
    4,
    5
  );
  setLinearAttrColors(stem, 0.26, 0.72, 0.76);
  parts.push(stem);
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    const petal = buildCurvedLeafStrip(0.11, 0.2, 0.08, 3);
    petal.rotateX(0.85);
    petal.rotateY(a);
    petal.translate(0, 0.32, 0);
    setLinearAttrColors(petal, 0.62, 0.96, 1.0);
    parts.push(petal);
  }
  const glow = new THREE.SphereGeometry(0.058, 7, 6);
  glow.translate(0, 0.4, 0);
  setLinearAttrColors(glow, 1.0, 0.54, 0.92);
  parts.push(glow);
  return safeMerge(parts, new THREE.SphereGeometry(0.14, 6, 5));
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

function reverseTriangleWinding(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const idx = geo.getIndex();
  if (idx) {
    const arr = idx.array as Uint16Array | Uint32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i + 1];
      arr[i + 1] = arr[i + 2];
      arr[i + 2] = tmp;
    }
    idx.needsUpdate = true;
  } else {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 3) {
      const x1 = pos.getX(i + 1);
      const y1 = pos.getY(i + 1);
      const z1 = pos.getZ(i + 1);
      pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
      pos.setXYZ(i + 2, x1, y1, z1);
    }
    pos.needsUpdate = true;
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildCurvedGullWingGeometry(side: 1 | -1 = 1): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // 1. Cambered inner & outer wing airfoil membrane spanning along +X (shoulder at x=0 -> tip at x=0.82)
  const spanSegs = 10;
  const chordSegs = 4;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const cTmp = new THREE.Color();

  // Top & bottom surface vertices for real 3D airfoil thickness (zero culling flaws!)
  for (let surface = 0; surface < 2; surface += 1) {
    const isTop = surface === 0;
    for (let i = 0; i <= spanSegs; i += 1) {
      const u = i / spanSegs; // 0 = shoulder, 1 = tip
      const x = u * 0.78;
      // Classic gull/eagle dihedral: arches up near wrist (u=0.45), sweeps gracefully back
      const gullLift = Math.sin(u * Math.PI * 0.92) * 0.095 - Math.pow(u, 2.2) * 0.04;
      const sweepZ = 0.05 - Math.pow(u, 1.45) * 0.28;
      const chord = 0.34 * (1 - Math.pow(u, 1.55) * 0.68);
      const thickness = 0.042 * (1 - u * 0.72);

      for (let j = 0; j <= chordSegs; j += 1) {
        const v = j / chordSegs; // 0 = leading edge, 1 = trailing edge
        const zLocal = (0.35 - v) * chord;
        const camber = Math.sin(v * Math.PI) * 0.032 * (1 - u * 0.5);
        const foilThick = Math.sin(v * Math.PI) * thickness * (isTop ? 0.68 : -0.32);
        const y = gullLift + camber + foilThick;
        const z = sweepZ + zLocal;
        positions.push(x * side, y, z);
        uvs.push(u, v);

        // Subtle wing shading: darker primary tips & trailing edge, bright covert shoulder
        const tipShade = 1.0 - u * 0.24 - v * 0.14 + (isTop ? 0.04 : -0.06);
        cTmp.setRGB(
          THREE.MathUtils.clamp(tipShade, 0.45, 1.0),
          THREE.MathUtils.clamp(tipShade * 0.98, 0.45, 1.0),
          THREE.MathUtils.clamp(tipShade * 0.96, 0.45, 1.0),
          THREE.SRGBColorSpace
        );
        colors.push(cTmp.r, cTmp.g, cTmp.b);
      }
    }
  }

  const stride = chordSegs + 1;
  const ringOffset = (spanSegs + 1) * stride;
  for (let i = 0; i < spanSegs; i += 1) {
    for (let j = 0; j < chordSegs; j += 1) {
      const a = i * stride + j;
      const b = a + 1;
      const c = (i + 1) * stride + j;
      const d = c + 1;
      if (side > 0) {
        indices.push(a, c, b, b, c, d);
        const ba = ringOffset + a;
        const bb = ringOffset + b;
        const bc = ringOffset + c;
        const bd = ringOffset + d;
        indices.push(ba, bb, bc, bb, bd, bc);
      } else {
        indices.push(a, b, c, b, d, c);
        const ba = ringOffset + a;
        const bb = ringOffset + b;
        const bc = ringOffset + c;
        const bd = ringOffset + d;
        indices.push(ba, bc, bb, bb, bc, bd);
      }
    }
  }
  // Stitch leading & trailing edge rims
  for (let i = 0; i < spanSegs; i += 1) {
    const tLead0 = i * stride;
    const tLead1 = (i + 1) * stride;
    const bLead0 = ringOffset + tLead0;
    const bLead1 = ringOffset + tLead1;
    if (side > 0) {
      indices.push(tLead0, bLead0, tLead1, tLead1, bLead0, bLead1);
    } else {
      indices.push(tLead0, tLead1, bLead0, tLead1, bLead1, bLead0);
    }
    const tTrail0 = i * stride + chordSegs;
    const tTrail1 = (i + 1) * stride + chordSegs;
    const bTrail0 = ringOffset + tTrail0;
    const bTrail1 = ringOffset + tTrail1;
    if (side > 0) {
      indices.push(tTrail0, tTrail1, bTrail0, tTrail1, bTrail1, bTrail0);
    } else {
      indices.push(tTrail0, bTrail0, tTrail1, tTrail1, bTrail0, bTrail1);
    }
  }

  const airfoilGeo = new THREE.BufferGeometry();
  airfoilGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  airfoilGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  airfoilGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  airfoilGeo.setIndex(indices);
  airfoilGeo.computeVertexNormals();
  parts.push(airfoilGeo);

  // 2. Five fanned primary flight feathers extending from outer wingtip
  for (let f = 0; f < 5; f += 1) {
    const t = f / 4;
    const fLen = 0.24 - t * 0.07;
    const feather = new THREE.CapsuleGeometry(0.022 - t * 0.004, fLen, 3, 6);
    feather.scale(1.0, 1.0, 0.36);
    feather.rotateZ(Math.PI * 0.5);
    feather.rotateY((0.12 - t * 0.52) * side);
    feather.rotateX(-0.08 + t * 0.05);
    feather.translate(
      (0.71 - t * 0.14) * side,
      0.036 - t * 0.018,
      -0.16 - t * 0.06
    );
    const shade = 0.72 + t * 0.12;
    setLinearAttrColors(feather, shade, shade * 0.98, shade * 0.95);
    parts.push(feather);
  }

  // 3. Layered upper wing covert ridge at shoulder
  const covert = new THREE.CapsuleGeometry(0.052, 0.34, 4, 8);
  covert.scale(1.0, 0.52, 0.85);
  covert.rotateZ(Math.PI * 0.5);
  covert.rotateY(-0.18 * side);
  covert.translate(0.24 * side, 0.048, -0.02);
  setLinearAttrColors(covert, 0.96, 0.96, 0.98);
  parts.push(covert);

  return safeMerge(parts, new THREE.BoxGeometry(0.5, 0.05, 0.2));
}

export function buildBatWingGeometry(side: 1 | -1 = 1): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.04);
  shape.bezierCurveTo(0.22, 0.16, 0.48, 0.18, 0.78, 0.08);
  shape.quadraticCurveTo(0.62, -0.08, 0.54, -0.22);
  shape.quadraticCurveTo(0.42, -0.1, 0.32, -0.25);
  shape.quadraticCurveTo(0.2, -0.08, 0.1, -0.2);
  shape.quadraticCurveTo(0.04, -0.06, 0, -0.06);
  const membrane = new THREE.ExtrudeGeometry(shape, {
    depth: 0.016,
    bevelEnabled: false,
    curveSegments: 8,
  });
  membrane.rotateX(-Math.PI * 0.5);
  membrane.translate(0, 0.01, -0.02);
  if (side < 0) {
    membrane.scale(-1, 1, 1);
    reverseTriangleWinding(membrane);
  }
  setLinearAttrColors(membrane, 0.78, 0.74, 0.84);
  parts.push(membrane);

  // Scalloped bat wing-arm and phalange struts
  for (const [len, yaw, xOff, zOff] of [
    [0.74, -0.08, 0.36, 0.05],
    [0.44, 0.42, 0.42, -0.06],
    [0.36, 0.78, 0.26, -0.1],
  ] as const) {
    const strut = new THREE.CapsuleGeometry(0.016, len, 3, 6);
    strut.rotateZ(Math.PI * 0.5);
    strut.rotateY(yaw * side);
    strut.translate(xOff * side, 0.024, zOff);
    setLinearAttrColors(strut, 0.55, 0.5, 0.62);
    parts.push(strut);
  }

  return safeMerge(parts, new THREE.BoxGeometry(0.5, 0.03, 0.24));
}

export function buildBirdTorsoGeometry(): THREE.BufferGeometry {
  // Aerodynamic teardrop breast-to-tail torso oriented along +Z (beak forward)
  const pts = [
    new THREE.Vector2(0.0, -0.36),
    new THREE.Vector2(0.055, -0.32),
    new THREE.Vector2(0.115, -0.2),
    new THREE.Vector2(0.165, -0.04),
    new THREE.Vector2(0.185, 0.1),
    new THREE.Vector2(0.155, 0.22),
    new THREE.Vector2(0.09, 0.29),
    new THREE.Vector2(0.0, 0.31),
  ];
  const geo = new THREE.LatheGeometry(pts, 16);
  geo.rotateX(Math.PI / 2);
  geo.scale(0.92, 0.96, 1.0);
  geo.computeVertexNormals();
  return geo;
}

export function buildFeatherPlumeGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const blade = new THREE.CapsuleGeometry(0.042, 0.28, 4, 8);
  blade.scale(1.15, 1.0, 0.28);
  blade.rotateX(Math.PI * 0.5);
  blade.translate(0, 0, -0.15);
  parts.push(blade);
  return safeMerge(parts, new THREE.CapsuleGeometry(0.03, 0.24, 3, 6));
}

export function buildQuadrupedTorsoGeometry(): THREE.BufferGeometry {
  // Sculpted mammal torso with deep ribcage, sleek waist & rounded hindquarters along +Z
  const pts = [
    new THREE.Vector2(0.0, -0.36),
    new THREE.Vector2(0.11, -0.33),
    new THREE.Vector2(0.205, -0.22),
    new THREE.Vector2(0.195, -0.08),
    new THREE.Vector2(0.182, 0.03),
    new THREE.Vector2(0.222, 0.17),
    new THREE.Vector2(0.205, 0.28),
    new THREE.Vector2(0.135, 0.35),
    new THREE.Vector2(0.0, 0.37),
  ];
  const geo = new THREE.LatheGeometry(pts, 16);
  geo.rotateX(Math.PI / 2);
  geo.scale(0.92, 0.98, 1.0);
  geo.computeVertexNormals();
  return geo;
}

export function buildFishFinGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.08, 0.14, 0.2, 0.16, 0.26, 0.05);
  shape.bezierCurveTo(0.2, -0.04, 0.09, -0.05, 0, -0.02);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.014,
    bevelEnabled: false,
    curveSegments: 6,
  });
  geo.computeVertexNormals();
  return geo;
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
    [0.58, 3.68, 0.56, 1.15, [1.0, 0.48, 0.68]],
    [-0.86, 3.05, 0.72, 1.05, [1.0, 0.84, 0.3]],
    [0.98, 3.1, -0.45, 1.1, [1.0, 0.56, 0.76]],
    [-0.25, 3.92, -0.32, 1.0, [1.0, 0.94, 0.58]],
    [0.14, 3.12, 1.24, 1.0, [1.0, 0.52, 0.72]],
    [-1.12, 2.86, -0.32, 1.05, [1.0, 0.8, 0.28]],
    [0.05, 3.82, 0.42, 0.95, [0.98, 0.64, 0.95]],
  ];
  spots.forEach(([x, y, z, s, rgb], sIdx) => {
    for (let p = 0; p < 5; p += 1) {
      const a = (p / 5) * Math.PI * 2 + sIdx * 0.5;
      const petal = buildCurvedLeafStrip(0.14 * s, 0.26 * s, 0.06, 3);
      petal.rotateX(1.18);
      petal.rotateY(a);
      petal.translate(x, y, z);
      setLinearAttrColors(petal, rgb[0], rgb[1], rgb[2]);
      parts.push(petal);
    }
  });
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

// Sprawling Banyan Tree with hanging aerial roots & irregular layered organic leaf boughs
export function buildBanyanTrunkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const main = buildTaperedCurveTube(
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.1, 0.95, 0.08),
      new THREE.Vector3(0.08, 1.95, -0.05),
      new THREE.Vector3(-0.02, 2.75, 0.02),
    ],
    0.58,
    0.26,
    10,
    9
  );
  parts.push(main);

  // Sweeping horizontal boughs + aerial prop roots anchoring outward
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + 0.45;
    const bough = buildTaperedCurveTube(
      [
        new THREE.Vector3(0, 1.9, 0),
        new THREE.Vector3(Math.cos(a) * 0.65, 2.35, Math.sin(a) * 0.65),
        new THREE.Vector3(Math.cos(a) * 1.18, 2.68, Math.sin(a) * 1.18),
      ],
      0.18,
      0.08,
      6,
      6
    );
    parts.push(bough);

    const root = buildTaperedCurveTube(
      [
        new THREE.Vector3(Math.cos(a) * 0.92, -0.05, Math.sin(a) * 0.92),
        new THREE.Vector3(Math.cos(a) * 0.72, 1.15, Math.sin(a) * 0.72),
        new THREE.Vector3(Math.cos(a) * 0.62, 2.28, Math.sin(a) * 0.62),
      ],
      0.1,
      0.065,
      6,
      6
    );
    parts.push(root);
  }
  return safeMerge(parts, new THREE.CapsuleGeometry(0.45, 2.2, 6, 8));
}

export function buildBanyanCanopyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const clusters = [
    { x: 0, y: 3.12, z: 0, r: 1.42, blades: 11 },
    { x: -1.16, y: 2.68, z: 0.44, r: 0.98, blades: 8 },
    { x: 1.14, y: 2.74, z: -0.36, r: 1.0, blades: 8 },
    { x: 0.25, y: 2.64, z: 1.08, r: 0.94, blades: 7 },
    { x: -0.34, y: 2.78, z: -1.04, r: 0.92, blades: 7 },
    { x: 0.14, y: 3.68, z: -0.1, r: 0.95, blades: 8 },
  ];
  clusters.forEach((cl, idx) => {
    const spray = buildOrganicLeafSprayTuple(cl.r, idx * 2.7 + 1.4, cl.blades, 0.5);
    spray.rotateY(idx * 0.9);
    spray.translate(cl.x, cl.y, cl.z);
    parts.push(spray);
  });
  return safeMerge(parts, new THREE.SphereGeometry(1.5, 12, 10));
}

// Luminous Mystic Willow Tree (twisted gnarled trunk + irregular crown & cascading leaf curtains)
export function buildWillowTrunkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(
    buildTaperedCurveTube(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-0.14, 1.0, 0.1),
        new THREE.Vector3(0.12, 2.1, -0.08),
        new THREE.Vector3(0.02, 3.05, 0.04),
      ],
      0.38,
      0.15,
      10,
      8
    )
  );
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    parts.push(
      buildTaperedCurveTube(
        [
          new THREE.Vector3(0.02, 2.25, 0),
          new THREE.Vector3(Math.cos(a) * 0.55, 2.8, Math.sin(a) * 0.55),
          new THREE.Vector3(Math.cos(a) * 0.95, 3.12, Math.sin(a) * 0.95),
        ],
        0.13,
        0.06,
        5,
        6
      )
    );
  }
  return safeMerge(parts, new THREE.CapsuleGeometry(0.28, 2.4, 5, 8));
}

export function buildWillowCanopyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const crownA = buildOrganicLeafSprayTuple(1.08, 4.2, 9, 0.52);
  crownA.translate(0.1, 3.25, 0);
  setLinearAttrColors(crownA, 0.42, 0.86, 0.74);
  parts.push(crownA);

  const crownB = buildOrganicLeafSprayTuple(0.86, 7.1, 7, 0.55);
  crownB.translate(-0.48, 3.02, 0.32);
  setLinearAttrColors(crownB, 0.48, 0.92, 0.8);
  parts.push(crownB);

  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2 + (i % 2) * 0.14;
    const rad = 0.92 + (i % 3) * 0.22;
    const vine = buildCurvedLeafStrip(0.32, 1.85 + (i % 2) * 0.35, 0.24, 5);
    vine.rotateX(Math.PI * 0.94);
    vine.rotateY(a);
    vine.translate(Math.cos(a) * rad, 3.15, Math.sin(a) * rad);
    setLinearAttrColors(vine, 0.44 + (i % 2) * 0.08, 0.88, 0.78);
    parts.push(vine);
  }
  return safeMerge(parts, new THREE.SphereGeometry(1.1, 10, 8));
}

// 3D Wooden/Shell Spear & Fire Spear for Ocean Spearfishing & Hunting!
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

  const wrap = new THREE.SphereGeometry(0.055, 8, 6);
  wrap.scale(1, 1.4, 1);
  wrap.translate(0, 1.42, 0);
  setLinearAttrColors(wrap, 0.92, 0.8, 0.54);
  parts.push(wrap);

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

// Sculpted bone-in meat cut for hunting rewards & campfire roasting
export function buildMeatCutGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const bone = new THREE.CapsuleGeometry(0.032, 0.24, 4, 6);
  bone.rotateZ(Math.PI / 2);
  bone.translate(-0.14, 0, 0);
  setLinearAttrColors(bone, 0.96, 0.92, 0.82);
  parts.push(bone);

  const knob = new THREE.SphereGeometry(0.048, 7, 6);
  knob.translate(-0.26, 0.015, 0);
  setLinearAttrColors(knob, 0.96, 0.92, 0.82);
  parts.push(knob);

  const haunch = new THREE.SphereGeometry(0.135, 11, 9);
  haunch.scale(1.28, 0.88, 0.94);
  haunch.translate(0.06, 0.01, 0);
  setLinearAttrColors(haunch, 0.86, 0.28, 0.22);
  parts.push(haunch);

  return safeMerge(parts, new THREE.SphereGeometry(0.14, 8, 6));
}

// Landmark decorative forge anvil & ship anchor & temple brazier
export function buildAnvilGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const base = buildSculptedStoneSlabGeometry(0.95, 0.36, 0.65, 1.4);
  base.translate(0, 0.18, 0);
  const waist = buildSculptedStoneSlabGeometry(0.54, 0.42, 0.44, 2.1);
  waist.translate(0, 0.52, 0);
  const top = buildSculptedStoneSlabGeometry(1.18, 0.28, 0.52, 3.2);
  top.translate(0.08, 0.82, 0);
  const horn = buildOrganicBasaltCragGeometry(0.2, 0.55, 1.1);
  horn.rotateZ(-Math.PI * 0.48);
  horn.translate(0.58, 0.82, 0);
  parts.push(base, waist, top, horn);
  return safeMerge(parts, new THREE.CapsuleGeometry(0.4, 0.7, 5, 8));
}

export function buildBrazierGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.48, 0.05),
    new THREE.Vector2(0.32, 0.35),
    new THREE.Vector2(0.26, 0.72),
    new THREE.Vector2(0.56, 0.98),
    new THREE.Vector2(0.42, 0.92),
    new THREE.Vector2(0.0, 0.84),
  ];
  const geo = new THREE.LatheGeometry(pts, 12);
  geo.computeVertexNormals();
  return geo;
}

export function buildAnchorGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const shank = new THREE.CapsuleGeometry(0.065, 1.1, 4, 7);
  shank.translate(0, 0.65, 0);
  const stock = new THREE.CapsuleGeometry(0.05, 0.68, 4, 6);
  stock.rotateZ(Math.PI / 2);
  stock.translate(0, 1.08, 0);
  const flukeArc = new THREE.TorusGeometry(0.45, 0.065, 7, 14, Math.PI);
  flukeArc.rotateZ(Math.PI);
  flukeArc.translate(0, 0.52, 0);
  const ring = new THREE.TorusGeometry(0.14, 0.04, 6, 12);
  ring.translate(0, 1.34, 0);
  parts.push(shank, stock, flukeArc, ring);
  return safeMerge(parts, new THREE.CapsuleGeometry(0.2, 1.0, 4, 6));
}

// Camp Wooden Sailboat resting on timber cradle beside the campfire (Campfire Lv 5 reward!)
export function buildBoatCradleGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Timber chocks supporting the hull
  for (const zOff of [-0.85, 0.85]) {
    const chock = buildSculptedStoneSlabGeometry(1.35, 0.24, 0.28, zOff + 2.0);
    chock.translate(0, 0.14, zOff);
    setLinearAttrColors(chock, 0.44, 0.26, 0.12);
    parts.push(chock);
  }

  // Sculpted curved wooden boat hull
  const hull = new THREE.SphereGeometry(0.95, 16, 12, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.52);
  const pos = hull.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const keelT = THREE.MathUtils.clamp(Math.abs(z) / 0.95, 0, 1);
    const bowTaper = 1 - Math.pow(keelT, 1.8) * 0.86;
    const sheerLift = Math.pow(keelT, 1.7) * 0.24;
    pos.setXYZ(i, x * 0.88 * bowTaper, y * 0.72 + sheerLift, z * 1.85);
  }
  hull.computeVertexNormals();
  hull.translate(0, 0.84, 0);
  setLinearAttrColors(hull, 0.68, 0.42, 0.21);
  parts.push(hull);

  // Gunwale rim planks & benches
  const rim = new THREE.TorusGeometry(0.84, 0.065, 6, 20);
  rim.rotateX(Math.PI / 2);
  rim.scale(0.84, 1, 1.76);
  rim.translate(0, 0.96, 0);
  setLinearAttrColors(rim, 0.82, 0.56, 0.3);
  parts.push(rim);

  for (const zSeat of [-0.45, 0.35]) {
    const bench = buildSculptedStoneSlabGeometry(1.12, 0.1, 0.26, zSeat + 5);
    bench.translate(0, 0.78, zSeat);
    setLinearAttrColors(bench, 0.78, 0.52, 0.28);
    parts.push(bench);
  }

  // Wooden mast & yardarm
  const mast = new THREE.CapsuleGeometry(0.065, 2.35, 5, 8);
  mast.translate(0, 1.78, 0.15);
  setLinearAttrColors(mast, 0.52, 0.31, 0.15);
  parts.push(mast);

  const boom = new THREE.CapsuleGeometry(0.042, 1.38, 4, 7);
  boom.rotateZ(Math.PI / 2);
  boom.translate(0, 2.55, 0.18);
  setLinearAttrColors(boom, 0.56, 0.35, 0.18);
  parts.push(boom);

  // Billowing warm cream sail
  const sail = buildCurvedLeafStrip(1.32, 1.55, 0.26, 7);
  sail.rotateX(-Math.PI * 0.46);
  sail.translate(0, 1.78, 0.28);
  setLinearAttrColors(sail, 0.98, 0.93, 0.8);
  parts.push(sail);

  // Bow lantern & pair of oars
  const lantern = new THREE.SphereGeometry(0.15, 9, 8);
  lantern.translate(0, 1.15, 1.52);
  setLinearAttrColors(lantern, 1.0, 0.86, 0.38);
  parts.push(lantern);

  for (const side of [-1, 1]) {
    const oar = new THREE.CapsuleGeometry(0.03, 1.25, 4, 6);
    oar.rotateX(Math.PI * 0.45);
    oar.rotateZ(side * 0.18);
    oar.translate(side * 0.54, 0.9, -0.2);
    setLinearAttrColors(oar, 0.74, 0.48, 0.24);
    parts.push(oar);
  }

  return safeMerge(parts, new THREE.CapsuleGeometry(0.7, 2.0, 6, 8));
}

// Hunting Bow, Arrow, and Storm Hammer for the 4-Weapon Arsenal
export function buildBowToolGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const stave = buildTaperedCurveTube(
    [
      new THREE.Vector3(0, -0.58, -0.18),
      new THREE.Vector3(0, -0.28, 0.16),
      new THREE.Vector3(0, 0, 0.24),
      new THREE.Vector3(0, 0.28, 0.16),
      new THREE.Vector3(0, 0.58, -0.18),
    ],
    0.036,
    0.028,
    10,
    7
  );
  setLinearAttrColors(stave, 0.64, 0.38, 0.16);
  parts.push(stave);

  const grip = new THREE.CapsuleGeometry(0.044, 0.22, 4, 7);
  grip.translate(0, 0, 0.23);
  setLinearAttrColors(grip, 0.86, 0.66, 0.34);
  parts.push(grip);

  const bowString = new THREE.CapsuleGeometry(0.011, 1.14, 3, 6);
  bowString.translate(0, 0, -0.18);
  setLinearAttrColors(bowString, 0.96, 0.94, 0.86);
  parts.push(bowString);

  return safeMerge(parts, new THREE.CapsuleGeometry(0.04, 1.1, 4, 6));
}

export function buildArrowGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const shaft = new THREE.CapsuleGeometry(0.022, 0.72, 4, 6);
  shaft.rotateX(Math.PI / 2);
  setLinearAttrColors(shaft, 0.68, 0.44, 0.2);
  parts.push(shaft);

  const tip = new THREE.SphereGeometry(0.068, 8, 6);
  tip.scale(0.65, 0.42, 1.65);
  tip.translate(0, 0, 0.42);
  setLinearAttrColors(tip, 0.92, 0.96, 1.0);
  parts.push(tip);

  const fletch = new THREE.SphereGeometry(0.06, 6, 5);
  fletch.scale(0.28, 0.85, 1.4);
  fletch.translate(0, 0, -0.34);
  setLinearAttrColors(fletch, 0.98, 0.35, 0.21);
  parts.push(fletch);

  return safeMerge(parts, new THREE.CapsuleGeometry(0.025, 0.7, 4, 6));
}

export function buildHammerToolGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const handle = new THREE.CapsuleGeometry(0.04, 1.18, 5, 7);
  handle.translate(0, 0.5, 0);
  setLinearAttrColors(handle, 0.56, 0.34, 0.16);
  parts.push(handle);

  const head = buildSculptedStoneSlabGeometry(0.28, 0.26, 0.54, 4.2);
  head.translate(0, 1.08, 0);
  setLinearAttrColors(head, 0.54, 0.62, 0.74);
  parts.push(head);

  const goldBand = new THREE.TorusGeometry(0.14, 0.032, 6, 12);
  goldBand.translate(0, 1.08, 0);
  setLinearAttrColors(goldBand, 0.98, 0.78, 0.24);
  parts.push(goldBand);

  return safeMerge(parts, new THREE.CapsuleGeometry(0.06, 1.1, 4, 6));
}

// Weathered Driftwood Log & Coastal Starfish for Prettier Beaches
export function buildDriftwoodLogGeometry(seed = 1): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const main = buildTaperedCurveTube(
    [
      new THREE.Vector3(-0.62, 0.08, -0.06),
      new THREE.Vector3(-0.1, 0.11, 0.04),
      new THREE.Vector3(0.56, 0.09, -0.04),
    ],
    0.11,
    0.075,
    8,
    7,
    seed * 0.03
  );
  setLinearAttrColors(main, 0.76, 0.67, 0.56);
  parts.push(main);

  const snag = buildTaperedCurveTube(
    [
      new THREE.Vector3(0.08, 0.1, 0.02),
      new THREE.Vector3(0.28, 0.22, 0.18),
    ],
    0.055,
    0.025,
    5,
    6
  );
  setLinearAttrColors(snag, 0.72, 0.62, 0.52);
  parts.push(snag);

  return safeMerge(parts, new THREE.CapsuleGeometry(0.09, 1.0, 4, 6));
}

export function buildBeachStarfishGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    const arm = buildTaperedCurveTube(
      [
        new THREE.Vector3(0, 0.035, 0),
        new THREE.Vector3(Math.sin(a) * 0.12, 0.03, Math.cos(a) * 0.12),
        new THREE.Vector3(Math.sin(a) * 0.23, 0.015, Math.cos(a) * 0.23),
      ],
      0.045,
      0.015,
      4,
      6
    );
    parts.push(arm);
  }
  const hub = new THREE.SphereGeometry(0.062, 8, 6);
  hub.scale(1.1, 0.55, 1.1);
  hub.translate(0, 0.032, 0);
  parts.push(hub);
  return safeMerge(parts, new THREE.SphereGeometry(0.14, 8, 6));
}

// Hidden Secret Place Treasure Shrine (Sculpted Stone Pedestal + Carved Wooden Chest Base & Hinged Lid)
export function buildSecretChestBaseGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const plinth = buildSculptedStoneSlabGeometry(1.35, 0.24, 1.05, 5.4);
  plinth.translate(0, 0.12, 0);
  setLinearAttrColors(plinth, 0.45, 0.48, 0.52);
  parts.push(plinth);

  const chestBody = buildSculptedStoneSlabGeometry(0.92, 0.42, 0.64, 2.7);
  chestBody.translate(0, 0.45, 0);
  setLinearAttrColors(chestBody, 0.56, 0.32, 0.14);
  parts.push(chestBody);

  for (const xOff of [-0.32, 0.32]) {
    const band = buildSculptedStoneSlabGeometry(0.08, 0.44, 0.67, xOff + 3);
    band.translate(xOff, 0.45, 0);
    setLinearAttrColors(band, 0.96, 0.78, 0.28);
    parts.push(band);
  }

  const lock = new THREE.SphereGeometry(0.09, 8, 6);
  lock.scale(1.0, 1.2, 0.6);
  lock.translate(0, 0.54, 0.34);
  setLinearAttrColors(lock, 1.0, 0.86, 0.32);
  parts.push(lock);

  return safeMerge(parts, new THREE.CapsuleGeometry(0.45, 0.6, 5, 8));
}

export function buildSecretChestLidGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const dome = new THREE.CylinderGeometry(0.32, 0.32, 0.92, 10, 1, false, 0, Math.PI);
  dome.rotateZ(Math.PI / 2);
  dome.rotateX(-Math.PI / 2);
  dome.scale(1, 0.68, 1);
  dome.translate(0, 0.0, 0.32);
  setLinearAttrColors(dome, 0.64, 0.36, 0.16);
  parts.push(dome);

  for (const xOff of [-0.32, 0.32]) {
    const strap = new THREE.TorusGeometry(0.33, 0.032, 5, 10, Math.PI);
    strap.rotateY(Math.PI / 2);
    strap.scale(1, 0.68, 1);
    strap.translate(xOff, 0.0, 0.32);
    setLinearAttrColors(strap, 0.98, 0.8, 0.3);
    parts.push(strap);
  }

  return safeMerge(parts, new THREE.CapsuleGeometry(0.25, 0.7, 4, 7));
}

// Predator 3D Claw Slash Crescent Arc
export function buildClawSlashGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = -1; i <= 1; i += 1) {
    const arc = buildTaperedCurveTube(
      [
        new THREE.Vector3(-0.75, i * 0.24, -0.35),
        new THREE.Vector3(0, i * 0.2, 0.28),
        new THREE.Vector3(0.75, i * 0.24, -0.35),
      ],
      0.045,
      0.015,
      8,
      6
    );
    setLinearAttrColors(arc, 1.0, 0.28, 0.24);
    parts.push(arc);
  }
  return safeMerge(parts, new THREE.TorusGeometry(0.6, 0.04, 6, 12, Math.PI));
}

// Falling Autumn Leaf / Winter Snowflake Diamond Quad
export function buildLeafSnowQuadGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.14);
  shape.bezierCurveTo(0.09, 0.08, 0.11, -0.02, 0, -0.14);
  shape.bezierCurveTo(-0.11, -0.02, -0.09, 0.08, 0, 0.14);
  const geo = new THREE.ShapeGeometry(shape, 4);
  geo.computeVertexNormals();
  return geo;
}

// Jagged 3D Lightning Bolt for Storms & Storm Hammer
export function buildLightningBoltGeometry(): THREE.BufferGeometry {
  const bolt = buildTaperedCurveTube(
    [
      new THREE.Vector3(0, 14.0, 0),
      new THREE.Vector3(0.75, 10.5, -0.4),
      new THREE.Vector3(-0.65, 7.2, 0.45),
      new THREE.Vector3(0.45, 3.8, -0.2),
      new THREE.Vector3(0, 0.0, 0),
    ],
    0.26,
    0.08,
    12,
    6
  );
  setLinearAttrColors(bolt, 0.82, 0.96, 1.0);
  return bolt;
}

// Sculpted Human Skull (Cranium + Cheekbones + Jaw + Dark Eye Sockets & Nasal Hollow)
export function buildHumanSkullGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const cranium = new THREE.SphereGeometry(0.28, 14, 12);
  cranium.scale(0.95, 1.02, 1.12);
  cranium.translate(0, 0.24, -0.02);
  setLinearAttrColors(cranium, 0.94, 0.89, 0.78);
  parts.push(cranium);

  const brow = new THREE.CapsuleGeometry(0.065, 0.22, 4, 8);
  brow.rotateZ(Math.PI * 0.5);
  brow.translate(0, 0.25, 0.22);
  setLinearAttrColors(brow, 0.9, 0.85, 0.74);
  parts.push(brow);

  const jaw = new THREE.SphereGeometry(0.16, 10, 8);
  jaw.scale(0.92, 0.78, 1.05);
  jaw.translate(0, 0.08, 0.14);
  setLinearAttrColors(jaw, 0.88, 0.82, 0.7);
  parts.push(jaw);

  for (const side of [-1, 1]) {
    const cheek = new THREE.SphereGeometry(0.085, 8, 6);
    cheek.scale(1.1, 0.85, 0.9);
    cheek.translate(side * 0.14, 0.15, 0.2);
    setLinearAttrColors(cheek, 0.91, 0.86, 0.75);
    parts.push(cheek);

    const eyeSocket = new THREE.SphereGeometry(0.068, 8, 8);
    eyeSocket.scale(1.05, 0.95, 0.6);
    eyeSocket.translate(side * 0.1, 0.2, 0.25);
    setLinearAttrColors(eyeSocket, 0.16, 0.14, 0.12);
    parts.push(eyeSocket);
  }

  const noseHole = new THREE.ConeGeometry(0.036, 0.08, 5);
  noseHole.rotateX(-0.25);
  noseHole.translate(0, 0.14, 0.27);
  setLinearAttrColors(noseHole, 0.18, 0.15, 0.13);
  parts.push(noseHole);

  for (let t = -2; t <= 2; t += 1) {
    const tooth = new THREE.BoxGeometry(0.032, 0.04, 0.03);
    tooth.translate(t * 0.042, 0.045, 0.27 - Math.abs(t) * 0.018);
    setLinearAttrColors(tooth, 0.96, 0.92, 0.83);
    parts.push(tooth);
  }

  return safeMerge(parts, new THREE.SphereGeometry(0.24, 10, 8));
}

// Sculpted Weathered Bone (Femur shaft + double condyle knobs on both ends)
export function buildFemurBoneGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const shaft = new THREE.CapsuleGeometry(0.042, 0.56, 4, 8);
  shaft.rotateZ(Math.PI * 0.5);
  setLinearAttrColors(shaft, 0.93, 0.88, 0.77);
  parts.push(shaft);

  for (const endSide of [-1, 1]) {
    for (const knobSide of [-1, 1]) {
      const knob = new THREE.SphereGeometry(0.058, 7, 6);
      knob.translate(endSide * 0.3, knobSide * 0.035, 0.01 * knobSide);
      setLinearAttrColors(knob, 0.9, 0.84, 0.72);
      parts.push(knob);
    }
  }

  return safeMerge(parts, new THREE.CapsuleGeometry(0.045, 0.55, 4, 8));
}

// Bush / Explorer Propeller Airplane Fuselage + Wings + Tail (facing +Z)
export function buildAirplaneFuselageWingGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Main fuselage body (capsule along Z)
  const hull = new THREE.CapsuleGeometry(0.62, 2.3, 6, 12);
  hull.rotateX(Math.PI * 0.5);
  hull.scale(0.95, 1.0, 1.15);
  setLinearAttrColors(hull, 0.94, 0.38, 0.24);
  parts.push(hull);

  // Cream/white racing stripe band along mid hull
  const stripe = new THREE.CylinderGeometry(0.635, 0.635, 1.5, 12);
  stripe.rotateX(Math.PI * 0.5);
  stripe.scale(0.98, 0.34, 1.0);
  stripe.translate(0, 0.02, -0.05);
  setLinearAttrColors(stripe, 0.98, 0.95, 0.88);
  parts.push(stripe);

  // Nose cowling (dark metallic slate)
  const cowl = new THREE.CylinderGeometry(0.42, 0.58, 0.55, 12);
  cowl.rotateX(Math.PI * 0.5);
  cowl.translate(0, -0.02, 1.65);
  setLinearAttrColors(cowl, 0.28, 0.33, 0.38);
  parts.push(cowl);

  // Glass cockpit canopy
  const canopy = new THREE.SphereGeometry(0.48, 12, 10);
  canopy.scale(0.86, 0.72, 1.55);
  canopy.translate(0, 0.5, 0.32);
  setLinearAttrColors(canopy, 0.56, 0.84, 0.96);
  parts.push(canopy);

  // Main swept high wings
  for (const side of [-1, 1]) {
    const wing = new THREE.BoxGeometry(2.55, 0.12, 0.92);
    wing.rotateY(side * -0.1);
    wing.rotateZ(side * 0.04);
    wing.translate(side * 1.52, 0.38, 0.24);
    setLinearAttrColors(wing, 0.97, 0.78, 0.28);
    parts.push(wing);

    const wingTip = new THREE.BoxGeometry(0.32, 0.14, 0.72);
    wingTip.rotateY(side * -0.1);
    wingTip.translate(side * 2.86, 0.42, 0.1);
    setLinearAttrColors(wingTip, 0.9, 0.25, 0.2);
    parts.push(wingTip);

    // Wing strut
    const strut = new THREE.CylinderGeometry(0.035, 0.035, 0.82, 6);
    strut.rotateZ(side * -0.58);
    strut.translate(side * 0.95, 0.05, 0.28);
    setLinearAttrColors(strut, 0.32, 0.36, 0.4);
    parts.push(strut);
  }

  // Tail fin (vertical stabilizer)
  const tailFin = new THREE.BoxGeometry(0.11, 0.95, 0.72);
  tailFin.rotateX(-0.22);
  tailFin.translate(0, 0.68, -1.62);
  setLinearAttrColors(tailFin, 0.9, 0.25, 0.2);
  parts.push(tailFin);

  // Horizontal stabilizers
  const hTail = new THREE.BoxGeometry(1.75, 0.09, 0.48);
  hTail.translate(0, 0.22, -1.66);
  setLinearAttrColors(hTail, 0.97, 0.78, 0.28);
  parts.push(hTail);

  // Landing gear struts + wheels
  for (const side of [-1, 1]) {
    const gear = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6);
    gear.rotateZ(side * 0.32);
    gear.translate(side * 0.46, -0.68, 0.55);
    setLinearAttrColors(gear, 0.3, 0.34, 0.38);
    parts.push(gear);

    const tire = new THREE.CylinderGeometry(0.2, 0.2, 0.14, 10);
    tire.rotateZ(Math.PI * 0.5);
    tire.translate(side * 0.56, -0.94, 0.55);
    setLinearAttrColors(tire, 0.14, 0.15, 0.17);
    parts.push(tire);
  }

  return safeMerge(parts, new THREE.BoxGeometry(2.5, 0.9, 3.2));
}

// Airplane Propeller (centered at origin, rotates around Z)
export function buildAirplanePropellerGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const spinner = new THREE.ConeGeometry(0.22, 0.36, 10);
  spinner.rotateX(Math.PI * 0.5);
  spinner.translate(0, 0, 0.12);
  setLinearAttrColors(spinner, 0.88, 0.24, 0.2);
  parts.push(spinner);

  for (const side of [-1, 1]) {
    const blade = new THREE.BoxGeometry(0.18, 1.05, 0.045);
    blade.rotateY(side * 0.22);
    blade.translate(0, side * 0.54, 0.02);
    setLinearAttrColors(blade, 0.24, 0.26, 0.3);
    parts.push(blade);

    const tip = new THREE.BoxGeometry(0.18, 0.16, 0.05);
    tip.rotateY(side * 0.22);
    tip.translate(0, side * 1.04, 0.02);
    setLinearAttrColors(tip, 0.98, 0.8, 0.18);
    parts.push(tip);
  }

  return safeMerge(parts, new THREE.BoxGeometry(0.2, 1.8, 0.1));
}

// Rescue Parachute Canopy & Suspension Cords (centered above player)
export function buildParachuteCanopyGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const dome = new THREE.SphereGeometry(1.15, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52);
  dome.scale(1.05, 0.72, 1.05);
  dome.translate(0, 1.45, 0);
  setLinearAttrColors(dome, 0.98, 0.54, 0.16);
  parts.push(dome);

  const band = new THREE.SphereGeometry(1.165, 16, 6, 0, Math.PI * 2, Math.PI * 0.26, Math.PI * 0.18);
  band.scale(1.05, 0.72, 1.05);
  band.translate(0, 1.45, 0);
  setLinearAttrColors(band, 0.98, 0.96, 0.9);
  parts.push(band);

  for (let i = 0; i < 4; i += 1) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    const tx = Math.cos(ang) * 0.85;
    const tz = Math.sin(ang) * 0.85;
    const cord = buildTaperedCurveTube(
      [new THREE.Vector3(tx * 0.2, 0.05, tz * 0.2), new THREE.Vector3(tx, 1.44, tz)],
      0.018,
      0.018,
      4,
      5
    );
    setLinearAttrColors(cord, 0.88, 0.86, 0.8);
    parts.push(cord);
  }

  return safeMerge(parts, new THREE.SphereGeometry(1.0, 12, 8));
}

// Ancient Bone Shrine (Weathered skull + crossed femurs + curved rib fragment on a stone slab)
export function buildAncientBoneShrineGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const slab = new THREE.CylinderGeometry(0.68, 0.82, 0.18, 9);
  slab.translate(0, 0.09, 0);
  setLinearAttrColors(slab, 0.39, 0.41, 0.44);
  parts.push(slab);

  const skull = buildHumanSkullGeometry();
  skull.scale(0.95, 0.95, 0.95);
  skull.rotateY(0.28);
  skull.rotateX(-0.12);
  skull.translate(0.02, 0.2, 0.06);
  parts.push(skull);

  const femurA = buildFemurBoneGeometry();
  femurA.scale(1.05, 1.05, 1.05);
  femurA.rotateY(0.55);
  femurA.rotateZ(0.08);
  femurA.translate(-0.18, 0.22, -0.14);
  parts.push(femurA);

  const femurB = buildFemurBoneGeometry();
  femurB.scale(0.92, 0.92, 0.92);
  femurB.rotateY(-0.68);
  femurB.rotateZ(-0.1);
  femurB.translate(0.2, 0.2, -0.1);
  parts.push(femurB);

  const rib = buildTaperedCurveTube(
    [
      new THREE.Vector3(-0.34, 0.16, 0.22),
      new THREE.Vector3(-0.42, 0.46, 0.05),
      new THREE.Vector3(-0.24, 0.62, -0.18),
    ],
    0.04,
    0.025,
    8,
    6
  );
  setLinearAttrColors(rib, 0.9, 0.85, 0.74);
  parts.push(rib);

  return safeMerge(parts, new THREE.SphereGeometry(0.4, 10, 8));
}

// Half-Buried Stone Temple in Sand with Ancient Human Bone Inscriptions (سنگ‌نوشته‌های باستانی با استخوان‌های آدم)
export function buildBuriedStoneTempleGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Sand dune bank wrapping & half-burying the temple base/rear
  const sandMound = new THREE.SphereGeometry(4.3, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
  sandMound.scale(1.18, 0.36, 1.15);
  sandMound.translate(0, -0.18, -0.55);
  setLinearAttrColors(sandMound, 0.92, 0.81, 0.56);
  parts.push(sandMound);

  // Tilted/sunken temple stone terrace plinth
  const plinth = buildSculptedStoneSlabGeometry(5.6, 0.62, 5.2, 3.1);
  plinth.translate(0, 0.16, 0);
  setLinearAttrColors(plinth, 0.66, 0.58, 0.44);
  parts.push(plinth);

  const innerFloor = buildSculptedStoneSlabGeometry(4.2, 0.28, 3.8, 5.7);
  innerFloor.translate(0, 0.52, -0.15);
  setLinearAttrColors(innerFloor, 0.58, 0.5, 0.38);
  parts.push(innerFloor);

  // Dark inner sanctuary chamber walls (back + left + right + roof) leaving +Z doorway open
  const backWall = buildSculptedStoneSlabGeometry(4.4, 3.1, 0.72, 6.4);
  backWall.translate(0, 1.95, -1.75);
  setLinearAttrColors(backWall, 0.45, 0.4, 0.32);
  parts.push(backWall);

  for (const side of [-1, 1]) {
    const sideWall = buildSculptedStoneSlabGeometry(0.74, 3.0, 3.8, 7.2 + side);
    sideWall.translate(side * 1.95, 1.9, -0.05);
    setLinearAttrColors(sideWall, 0.54, 0.47, 0.37);
    parts.push(sideWall);

    // Fluted weathered front temple pillars
    const pillar = buildWeatheredRuinsPillarGeometry();
    pillar.scale(0.95, 1.2, 0.95);
    pillar.translate(side * 1.48, 0.45, 1.65);
    setLinearAttrColors(pillar, 0.71, 0.63, 0.49);
    parts.push(pillar);

    // Stone inscription stele flanking the entrance inlaid with human bone & skull carvings
    const stele = buildSculptedStoneSlabGeometry(0.95, 1.85, 0.34, 9.1 + side);
    stele.rotateY(side * -0.26);
    stele.translate(side * 2.48, 1.15, 1.38);
    setLinearAttrColors(stele, 0.62, 0.55, 0.43);
    parts.push(stele);

    const steleSkull = buildHumanSkullGeometry();
    steleSkull.scale(0.86, 0.86, 0.65);
    steleSkull.rotateY(side * -0.26);
    steleSkull.translate(side * 2.46, 1.48, 1.56);
    parts.push(steleSkull);

    const steleFemurA = buildFemurBoneGeometry();
    steleFemurA.scale(0.85, 0.85, 0.85);
    steleFemurA.rotateZ(0.55);
    steleFemurA.rotateY(side * -0.26);
    steleFemurA.translate(side * 2.46, 1.0, 1.56);
    parts.push(steleFemurA);

    const steleFemurB = buildFemurBoneGeometry();
    steleFemurB.scale(0.85, 0.85, 0.85);
    steleFemurB.rotateZ(-0.55);
    steleFemurB.rotateY(side * -0.26);
    steleFemurB.translate(side * 2.46, 1.0, 1.56);
    parts.push(steleFemurB);
  }

  // Massive carved lintel & broken sandstone pediment roof
  const lintel = buildSculptedStoneSlabGeometry(4.6, 0.86, 1.35, 8.3);
  lintel.translate(0, 3.55, 1.48);
  setLinearAttrColors(lintel, 0.69, 0.61, 0.47);
  parts.push(lintel);

  const roofSlab = buildSculptedStoneSlabGeometry(4.5, 0.62, 3.6, 10.4);
  roofSlab.rotateX(0.06);
  roofSlab.translate(0, 3.52, -0.25);
  setLinearAttrColors(roofSlab, 0.56, 0.49, 0.39);
  parts.push(roofSlab);

  // Ancient Bone Inscription Reliefs across the upper lintel (central skull + flanking skulls + femurs)
  const centerSkull = buildHumanSkullGeometry();
  centerSkull.scale(1.18, 1.18, 0.85);
  centerSkull.translate(0, 3.42, 2.08);
  parts.push(centerSkull);

  for (const side of [-1, 1]) {
    const lintelSkull = buildHumanSkullGeometry();
    lintelSkull.scale(0.76, 0.76, 0.65);
    lintelSkull.translate(side * 1.25, 3.46, 2.04);
    parts.push(lintelSkull);

    const lintelBone = buildFemurBoneGeometry();
    lintelBone.scale(0.95, 0.95, 0.95);
    lintelBone.rotateZ(side * 0.2);
    lintelBone.translate(side * 0.62, 3.54, 2.08);
    parts.push(lintelBone);
  }

  // Interior sanctuary pedestal for the hidden temple relic
  const altarPedestal = buildSculptedStoneSlabGeometry(1.1, 0.85, 1.1, 12.2);
  altarPedestal.translate(0, 0.88, -0.35);
  setLinearAttrColors(altarPedestal, 0.48, 0.44, 0.37);
  parts.push(altarPedestal);

  return safeMerge(parts, new THREE.BoxGeometry(4.2, 3.2, 3.6));
}

// Heavy Carved Stone Door Slab sealing the Buried Temple (slides open when all 4 bones are collected)
export function buildTempleDoorSlabGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const doorSlab = buildSculptedStoneSlabGeometry(2.35, 2.75, 0.38, 15.6);
  doorSlab.translate(0, 1.38, 0);
  setLinearAttrColors(doorSlab, 0.52, 0.46, 0.36);
  parts.push(doorSlab);

  // Carved bone-cross seal in the center of the stone door
  const sealRing = new THREE.TorusGeometry(0.56, 0.065, 7, 18);
  sealRing.translate(0, 1.48, 0.19);
  setLinearAttrColors(sealRing, 0.82, 0.68, 0.32);
  parts.push(sealRing);

  const sealSkull = buildHumanSkullGeometry();
  sealSkull.scale(0.85, 0.85, 0.65);
  sealSkull.translate(0, 1.38, 0.24);
  parts.push(sealSkull);

  for (const side of [-1, 1]) {
    const crossBone = buildFemurBoneGeometry();
    crossBone.scale(0.95, 0.95, 0.95);
    crossBone.rotateZ(side * 0.68);
    crossBone.translate(0, 1.42, 0.21);
    parts.push(crossBone);
  }

  return safeMerge(parts, new THREE.BoxGeometry(2.2, 2.6, 0.36));
}

// Hidden Ancient Temple Relic: Golden Sun-Bone Crown & Emerald Core
export function buildTempleRelicCrownGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const baseRing = new THREE.TorusGeometry(0.32, 0.065, 8, 18);
  baseRing.rotateX(Math.PI * 0.5);
  baseRing.translate(0, 0.12, 0);
  setLinearAttrColors(baseRing, 1.0, 0.82, 0.24);
  parts.push(baseRing);

  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const spike = new THREE.ConeGeometry(0.065, 0.34, 6);
    spike.translate(Math.cos(a) * 0.28, 0.3, Math.sin(a) * 0.28);
    setLinearAttrColors(spike, 1.0, 0.88, 0.35);
    parts.push(spike);
  }

  const gem = new THREE.OctahedronGeometry(0.24, 0);
  gem.scale(0.9, 1.35, 0.9);
  gem.translate(0, 0.38, 0);
  setLinearAttrColors(gem, 0.22, 0.96, 0.84);
  parts.push(gem);

  return safeMerge(parts, new THREE.OctahedronGeometry(0.3, 0));
}


