import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CONFIG, type AppScreenState, type BiomeId, type GameMode } from './config';
import { createProceduralTextureSet } from './textures';
import { createSeededRandom, getSeedForMode, resetNormalSeed } from './utils';
import {
  contourScaleAtAngle,
  detectBiomeAt,
  generateIslandWorld,
  getContourPoints,
  groundHeightAt,
  isNearAnyConnector,
  stepPlayerPhysics,
  type BridgeOrRampSpec,
  type IslandProp,
  type IslandWorldData,
} from './world';

export interface ActiveRunInfo {
  mode: GameMode;
  seed: string;
}

export interface HudSnapshot {
  coins: number;
  wood: number;
  stone: number;
  berries: number;
  energy: number;
  maxEnergy: number;
  backpackUsed: number;
  backpackCapacity: number;
  biome: BiomeId;
}

export interface ThreeSceneCallbacks {
  onScreenChange: (screen: AppScreenState, runInfo?: ActiveRunInfo) => void;
  onHudUpdate: (hud: HudSnapshot) => void;
}

export interface ThreeIslandController {
  startRun: (mode: GameMode, forceNewIsland?: boolean) => void;
  returnToMenu: () => void;
  setJoystickInput: (dx: number, dy: number) => void;
  destroy: () => void;
}

function createContourShape(
  rx: number,
  rz: number,
  phaseA: number,
  phaseB: number,
  multiplier = 1
): THREE.Shape {
  const pts = getContourPoints(rx, rz, phaseA, phaseB, 72, multiplier);
  const shape = new THREE.Shape();
  pts.forEach((p, idx) => {
    if (idx === 0) {
      shape.moveTo(p.x, -p.z);
    } else {
      shape.lineTo(p.x, -p.z);
    }
  });
  shape.closePath();
  return shape;
}

function createContourPath(
  rx: number,
  rz: number,
  phaseA: number,
  phaseB: number,
  multiplier: number
): THREE.Path {
  const pts = getContourPoints(rx, rz, phaseA, phaseB, 72, multiplier);
  const path = new THREE.Path();
  pts.forEach((p, idx) => {
    if (idx === 0) {
      path.moveTo(p.x, -p.z);
    } else {
      path.lineTo(p.x, -p.z);
    }
  });
  path.closePath();
  return path;
}

function buildSkyDome(): { mesh: THREE.Mesh; dispose: () => void } {
  const geo = new THREE.SphereGeometry(260, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(CONFIG.COLORS.SKY_ZENITH) },
      bottomColor: { value: new THREE.Color(CONFIG.COLORS.SKY_HORIZON) },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos).y;
        float t = smoothstep(0.0, 0.55, max(h, 0.0));
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return {
    mesh,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

function buildSculptedBoulderGeometry(
  radius: number,
  seedNum: number,
  withVertexColor = true
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, 2);
  const pos = geo.attributes.position;
  const colors = withVertexColor ? new Float32Array(pos.count * 3) : null;

  for (let i = 0; i < pos.count; i += 1) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const n =
      1 +
      0.14 * Math.sin(vx * 3.1 + seedNum) * Math.cos(vz * 2.7 - seedNum * 0.5) +
      0.08 * Math.cos(vy * 4.2 + vx * 2.1);
    const flatBottom = vy < -radius * 0.35 ? 0.72 : 1.0;
    const ny = vy * n * flatBottom;
    pos.setXYZ(i, vx * n, ny, vz * n);

    if (colors) {
      const hNorm = THREE.MathUtils.clamp((ny / Math.max(0.1, radius) + 1) * 0.5, 0, 1);
      const shade = 0.74 + hNorm * 0.38;
      colors[i * 3] = shade * (0.95 + hNorm * 0.08);
      colors[i * 3 + 1] = shade * (0.98 + hNorm * 0.04);
      colors[i * 3 + 2] = shade * (0.94 - hNorm * 0.04);
    }
  }

  if (colors) {
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  geo.computeVertexNormals();
  return geo;
}

function buildCurvedPalmFrondMeshGeometry(length: number, width: number, droop: number): THREE.BufferGeometry {
  // Smooth 8-segment bent V-spine frond blade with UV + sunlight vertex gradient
  const segments = 8;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

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

    // Stem deeper emerald -> sunlit tropical tips
    const r = 0.72 + t * 0.42;
    const g = 0.88 + t * 0.24;
    const b = 0.78 + t * 0.1;
    colors.push(r * 0.94, g * 0.94, b * 0.94);
    colors.push(r * 1.05, g * 1.05, b);
    colors.push(r * 0.94, g * 0.94, b * 0.94);

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

function buildCurvedPalmTrunkGeometry(): THREE.BufferGeometry {
  const segments = 7;
  const parts: THREE.BufferGeometry[] = [];
  const totalHeight = 3.7;
  const segH = totalHeight / segments;

  for (let i = 0; i < segments; i += 1) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const rBottom = 0.35 - t0 * 0.16;
    const rTop = 0.33 - t1 * 0.16;
    const cyl = new THREE.CylinderGeometry(rTop, rBottom, segH * 1.07, 10);
    const leanX = Math.pow(t0, 1.45) * 0.72;
    const tiltZ = -0.13 * (0.3 + t0);
    cyl.rotateZ(tiltZ);
    cyl.translate(leanX, i * segH + segH * 0.5, 0);
    parts.push(cyl);
  }

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return merged ?? new THREE.CylinderGeometry(0.18, 0.35, 3.7, 10);
}

function buildPalmCanopyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const crownX = 0.7;
  const crownY = 3.62;

  const bud = new THREE.SphereGeometry(0.24, 10, 8);
  const budCount = bud.attributes.position.count;
  const budColors = new Float32Array(budCount * 3);
  for (let i = 0; i < budCount; i += 1) {
    budColors[i * 3] = 0.78;
    budColors[i * 3 + 1] = 0.92;
    budColors[i * 3 + 2] = 0.78;
  }
  bud.setAttribute('color', new THREE.BufferAttribute(budColors, 3));
  bud.translate(crownX, crownY + 0.08, 0);
  parts.push(bud);

  // Lower tier: 6 long arching fronds
  for (let i = 0; i < 6; i += 1) {
    const yaw = (i / 6) * Math.PI * 2 + 0.12;
    const blade = buildCurvedPalmFrondMeshGeometry(2.35, 0.56, 1.15);
    blade.rotateY(yaw);
    blade.translate(crownX, crownY, 0);
    parts.push(blade);
  }
  // Upper tier: 4 perky sun-catching fronds
  for (let i = 0; i < 4; i += 1) {
    const yaw = (i / 4) * Math.PI * 2 + 0.52;
    const blade = buildCurvedPalmFrondMeshGeometry(1.72, 0.45, 0.55);
    blade.rotateZ(0.24);
    blade.rotateY(yaw);
    blade.translate(crownX, crownY + 0.12, 0);
    parts.push(blade);
  }

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return merged ?? new THREE.SphereGeometry(1.1, 10, 8);
}

function buildCoconutClusterGeometry(): THREE.BufferGeometry {
  const crownX = 0.65;
  const crownY = 3.38;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const nut = new THREE.SphereGeometry(0.16, 9, 8);
    nut.translate(crownX + Math.cos(a) * 0.22, crownY - (i % 2) * 0.05, Math.sin(a) * 0.22);
    parts.push(nut);
  }
  return mergeGeometries(parts, false) ?? new THREE.SphereGeometry(0.16, 8, 7);
}

function buildJungleTrunkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const main = new THREE.CylinderGeometry(0.22, 0.42, 2.2, 10);
  main.translate(0, 1.1, 0);
  parts.push(main);

  const branchA = new THREE.CylinderGeometry(0.12, 0.2, 1.1, 8);
  branchA.rotateZ(0.45);
  branchA.translate(-0.35, 1.9, 0.15);
  parts.push(branchA);

  const branchB = new THREE.CylinderGeometry(0.12, 0.18, 1.0, 8);
  branchB.rotateZ(-0.42);
  branchB.rotateY(0.6);
  branchB.translate(0.32, 1.85, -0.18);
  parts.push(branchB);

  return mergeGeometries(parts, false) ?? main;
}

function buildJungleCanopyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const lobes = [
    { x: 0, y: 2.85, z: 0, r: 1.25 },
    { x: -0.78, y: 2.45, z: 0.35, r: 0.92 },
    { x: 0.72, y: 2.52, z: -0.25, r: 0.96 },
    { x: 0.12, y: 2.42, z: 0.78, r: 0.85 },
    { x: -0.22, y: 3.35, z: -0.25, r: 0.88 },
  ];
  for (let i = 0; i < lobes.length; i += 1) {
    const l = lobes[i];
    const puff = buildSculptedBoulderGeometry(l.r, i * 2.1);
    puff.scale(1.12, 0.82, 1.08);
    puff.translate(l.x, l.y, l.z);
    parts.push(puff);
  }
  return mergeGeometries(parts, false) ?? new THREE.SphereGeometry(1.3, 12, 10);
}

function buildFernTuftGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const leaf = buildCurvedPalmFrondMeshGeometry(0.46, 0.14, 0.14);
    leaf.rotateZ(0.38);
    leaf.rotateY(a);
    leaf.translate(0, 0.04, 0);
    parts.push(leaf);
  }
  return mergeGeometries(parts, false) ?? new THREE.ConeGeometry(0.25, 0.4, 5);
}

interface SurvivorRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
}

function buildCartoonSurvivor(
  clayMat: (color: number, roughness?: number) => THREE.MeshStandardMaterial,
  shadowMat: THREE.MeshBasicMaterial
): SurvivorRig {
  const root = new THREE.Group();

  const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 22), shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.025;
  root.add(shadowDisc);

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const skinMat = clayMat(CONFIG.COLORS.SKIN, 0.76);
  const hairMat = clayMat(CONFIG.COLORS.HAIR, 0.88);
  const shirtMat = clayMat(CONFIG.COLORS.SHIRT, 0.8);
  const shortsMat = clayMat(CONFIG.COLORS.SHORTS, 0.84);
  const bootsMat = clayMat(CONFIG.COLORS.BOOTS, 0.86);
  const capMat = clayMat(CONFIG.COLORS.CAP, 0.8);
  const packMat = clayMat(CONFIG.COLORS.BACKPACK, 0.84);
  const cheekMat = clayMat(CONFIG.COLORS.CHEEK, 0.8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.05 });
  const eyeHighlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const buildLeg = (xOffset: number): THREE.Group => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOffset, 0.45, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.22, 10), shortsMat);
    thigh.position.y = -0.1;
    thigh.castShadow = true;
    legPivot.add(thigh);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.075, 0.16, 10), skinMat);
    shin.position.y = -0.25;
    legPivot.add(shin);

    const boot = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), bootsMat);
    boot.scale.set(1, 0.78, 1.32);
    boot.position.set(0, -0.36, 0.04);
    boot.castShadow = true;
    legPivot.add(boot);

    return legPivot;
  };

  const leftLeg = buildLeg(-0.14);
  const rightLeg = buildLeg(0.14);
  bodyPivot.add(leftLeg, rightLeg);

  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.23, 0.2, 14), shortsMat);
  pelvis.position.y = 0.5;
  pelvis.castShadow = true;
  bodyPivot.add(pelvis);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.46, 14), shirtMat);
  torso.position.y = 0.78;
  torso.castShadow = true;
  bodyPivot.add(torso);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 8, 16), clayMat(0xffffff, 0.8));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.01;
  bodyPivot.add(collar);

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.22), packMat);
  pack.position.set(0, 0.79, -0.25);
  pack.castShadow = true;
  bodyPivot.add(pack);

  const bedroll = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.42, 10), capMat);
  bedroll.rotation.z = Math.PI / 2;
  bedroll.position.set(0, 1.02, -0.25);
  bedroll.castShadow = true;
  bodyPivot.add(bedroll);

  const buildArm = (xOffset: number): THREE.Group => {
    const armPivot = new THREE.Group();
    armPivot.position.set(xOffset, 0.94, 0);

    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.22, 10), shirtMat);
    sleeve.position.y = -0.11;
    sleeve.castShadow = true;
    armPivot.add(sleeve);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), skinMat);
    hand.position.y = -0.25;
    hand.castShadow = true;
    armPivot.add(hand);

    return armPivot;
  };

  const leftArm = buildArm(-0.32);
  const rightArm = buildArm(0.32);
  bodyPivot.add(leftArm, rightArm);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.26, 0.02);
  bodyPivot.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 16), skinMat);
  head.scale.set(1.02, 0.98, 0.98);
  head.castShadow = true;
  headGroup.add(head);

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMat
  );
  hairCap.rotation.x = -0.22;
  hairCap.position.set(0, 0.02, -0.02);
  hairCap.castShadow = true;
  headGroup.add(hairCap);

  const capDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
    capMat
  );
  capDome.rotation.x = -0.35;
  capDome.position.set(0, 0.06, -0.03);
  capDome.castShadow = true;
  headGroup.add(capDome);

  const capVisor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.3, 0.04, 14, 1, false, -0.9, 1.8),
    capMat
  );
  capVisor.position.set(0, 0.21, 0.17);
  capVisor.rotation.x = -0.18;
  capVisor.castShadow = true;
  headGroup.add(capVisor);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 8), skinMat);
  nose.position.set(0, -0.02, 0.33);
  headGroup.add(nose);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), eyeMat);
    eye.position.set(side * 0.12, 0.03, 0.3);
    headGroup.add(eye);

    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), eyeHighlightMat);
    glint.position.set(side * 0.12 + 0.015, 0.046, 0.34);
    headGroup.add(glint);

    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), cheekMat);
    cheek.scale.set(1.2, 0.75, 0.45);
    cheek.position.set(side * 0.19, -0.06, 0.27);
    headGroup.add(cheek);
  }

  return {
    root,
    bodyPivot,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
  };
}

interface FloatingParticle {
  mesh: THREE.Mesh;
  active: boolean;
  age: number;
  life: number;
  vx: number;
  vy: number;
  vz: number;
  baseScale: number;
}


interface NatureTreeModelPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}

interface NatureTreeModel {
  parts: NatureTreeModelPart[];
}

interface NatureTreeAssets {
  palms: NatureTreeModel[];
  jungle: NatureTreeModel[];
  dispose: () => void;
}

async function loadNatureTreeModel(fileName: string): Promise<NatureTreeModel> {
  const response = await fetch(`/assets/nature/${fileName}`);
  if (!response.ok) {
    throw new Error(`Nature Kit asset request failed (${response.status}): ${fileName}`);
  }
  const compressed = await response.arrayBuffer();
  const decompressedStream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const glbData = await new Response(decompressedStream).arrayBuffer();
  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(glbData, '/assets/nature/');
  gltf.scene.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  if (bounds.isEmpty()) {
    throw new Error(`Nature Kit model is empty: ${fileName}`);
  }

  const centerX = (bounds.min.x + bounds.max.x) * 0.5;
  const centerZ = (bounds.min.z + bounds.max.z) * 0.5;
  const normalize = new THREE.Matrix4().makeTranslation(-centerX, -bounds.min.y, -centerZ);
  const parts: NatureTreeModelPart[] = [];
  const originalGeometries = new Set<THREE.BufferGeometry>();

  gltf.scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    originalGeometries.add(node.geometry);

    const geometry = node.geometry.clone();
    geometry.applyMatrix4(normalize.clone().multiply(node.matrixWorld));
    geometry.computeBoundingSphere();
    parts.push({ geometry, material: node.material });
  });

  for (const geometry of originalGeometries) geometry.dispose();
  if (parts.length === 0) {
    throw new Error(`Nature Kit model contains no meshes: ${fileName}`);
  }

  return { parts };
}

async function loadNatureTreeAssets(): Promise<NatureTreeAssets> {
  const files = ['tree_palm.glb.gz', 'tree_default.glb.gz'];
  const loaded: NatureTreeModel[] = [];
  try {
    for (const file of files) {
      loaded.push(await loadNatureTreeModel(file));
    }
  } catch (error) {
    const materials = new Set<THREE.Material>();
    for (const model of loaded) {
      for (const part of model.parts) {
        part.geometry.dispose();
        const list = Array.isArray(part.material) ? part.material : [part.material];
        list.forEach((material) => materials.add(material));
      }
    }
    const textures = new Set<THREE.Texture>();
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value && typeof value === 'object' && (value as THREE.Texture).isTexture) {
          textures.add(value as THREE.Texture);
        }
      }
      material.dispose();
    }
    textures.forEach((texture) => texture.dispose());
    throw error;
  }

  const allMaterials = new Set<THREE.Material>();
  for (const model of loaded) {
    for (const part of model.parts) {
      const list = Array.isArray(part.material) ? part.material : [part.material];
      list.forEach((material) => allMaterials.add(material));
    }
  }

  return {
    palms: loaded.slice(0, 1),
    jungle: loaded.slice(1, 2),
    dispose: () => {
      const textures = new Set<THREE.Texture>();
      for (const material of allMaterials) {
        for (const value of Object.values(material)) {
          if (value && typeof value === 'object' && (value as THREE.Texture).isTexture) {
            textures.add(value as THREE.Texture);
          }
        }
        material.dispose();
      }
      textures.forEach((texture) => texture.dispose());
      for (const model of loaded) {
        for (const part of model.parts) part.geometry.dispose();
      }
    },
  };
}

export function createThreeIslandGame(
  container: HTMLElement,
  callbacks: ThreeSceneCallbacks,
  initialMode: GameMode,
  autostart = false
): ThreeIslandController {
  const renderer = new THREE.WebGLRenderer({
    powerPreference: 'high-performance',
    antialias: true,
    alpha: false,
  });

  const rawGl = renderer.getContext();
  const debugExt = rawGl.getExtension('WEBGL_DEBUG_RENDERER_INFO');
  const glRenderer = debugExt
    ? String(rawGl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL))
    : '';
  const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(glRenderer);

  const pixelRatio = isSoftwareGl
    ? 1
    : Math.min(window.devicePixelRatio || 1, CONFIG.RENDER.MAX_PIXEL_RATIO);

  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(container.clientWidth || 390, container.clientHeight || 844);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.COLORS.SKY_HORIZON);
  scene.fog = new THREE.FogExp2(CONFIG.COLORS.FOG, CONFIG.RENDER.FOG_DENSITY);

  const skyDome = buildSkyDome();
  scene.add(skyDome.mesh);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envTex = pmrem.fromScene(roomEnv, 0.04).texture;
  roomEnv.dispose();
  scene.environment = envTex;
  scene.environmentIntensity = 0.34;

  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  const camera = new THREE.PerspectiveCamera(
    CONFIG.CAMERA.FOV_DEG,
    width / height,
    0.5,
    340
  );

  // Warm Sunny Archipelago Lighting
  const hemiLight = new THREE.HemisphereLight(0xf0fbff, 0xffe0ad, 0.92);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff5d6, 1.55);
  sunLight.position.set(18, 26, 12);
  sunLight.castShadow = !isSoftwareGl;
  sunLight.shadow.mapSize.set(CONFIG.RENDER.SHADOW_MAP_SIZE, CONFIG.RENDER.SHADOW_MAP_SIZE);
  const frustum = CONFIG.RENDER.SHADOW_FRUSTUM_HALF;
  sunLight.shadow.camera.left = -frustum;
  sunLight.shadow.camera.right = frustum;
  sunLight.shadow.camera.top = frustum;
  sunLight.shadow.camera.bottom = -frustum;
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 78;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.035;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const textures = createProceduralTextureSet();
  const disposables: Array<{ dispose: () => void }> = [
    pmrem,
    envTex,
    skyDome,
    { dispose: () => textures.disposeAll() },
  ];

  const materialCache = new Map<string, THREE.MeshStandardMaterial>();
  const getPbrMat = (
    color: number,
    roughness = 0.86,
    map?: THREE.Texture,
    bumpMap?: THREE.Texture,
    bumpScale = 0.04
  ): THREE.MeshStandardMaterial => {
    const key = `${color}-${roughness}-${map ? map.uuid : 'none'}-${bumpMap ? bumpMap.uuid : 'none'}`;
    const cached = materialCache.get(key);
    if (cached) return cached;
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: 0.02,
      map: map ?? null,
      bumpMap: bumpMap ?? null,
      bumpScale: bumpMap ? bumpScale : 0,
    });
    materialCache.set(key, mat);
    disposables.push(mat);
    return mat;
  };

  const shadowDiscMat = new THREE.MeshBasicMaterial({
    color: 0x10361e,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });
  disposables.push(shadowDiscMat);

  // Shimmering Ocean Plane with Procedural Caustics & Bump
  const seaMat = new THREE.MeshStandardMaterial({
    map: textures.seaDiffuse,
    bumpMap: textures.seaBump,
    bumpScale: 0.09,
    roughness: 0.28,
    metalness: 0.08,
  });
  const seaGeo = new THREE.PlaneGeometry(540, 540);
  seaGeo.rotateX(-Math.PI / 2);
  const seaMesh = new THREE.Mesh(seaGeo, seaMat);
  seaMesh.receiveShadow = true;
  scene.add(seaMesh);
  disposables.push(seaMat, seaGeo);

  const islandGroup = new THREE.Group();
  scene.add(islandGroup);

  const foamMeshes: THREE.Mesh[] = [];
  const rippleMeshes: THREE.Mesh[] = [];
  let obeliskCrystal: THREE.Mesh | null = null;
  let obeliskHalo: THREE.Mesh | null = null;
  let lavaPoolMesh: THREE.Mesh | null = null;
  let beaconFlameMesh: THREE.Mesh | null = null;
  let fireflyGroup: THREE.Group | null = null;
  let islandDisposables: Array<{ dispose: () => void }> = [];
  let natureTreeAssets: NatureTreeAssets | null = null;

  // Survivor Rig + Pooled Dust / Steam Particles
  const survivor = buildCartoonSurvivor(
    (color, roughness) => getPbrMat(color, roughness),
    shadowDiscMat
  );
  scene.add(survivor.root);

  const puffGeo = new THREE.SphereGeometry(0.16, 8, 7);
  const dustMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  const steamMat = new THREE.MeshBasicMaterial({
    color: 0xffe4cc,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  disposables.push(puffGeo, dustMat, steamMat);

  const dustPool: FloatingParticle[] = [];
  for (let i = 0; i < 8; i += 1) {
    const mesh = new THREE.Mesh(puffGeo, dustMat);
    mesh.visible = false;
    scene.add(mesh);
    dustPool.push({ mesh, active: false, age: 0, life: 0.4, vx: 0, vy: 0, vz: 0, baseScale: 1 });
  }
  const steamPool: FloatingParticle[] = [];
  for (let i = 0; i < 6; i += 1) {
    const mesh = new THREE.Mesh(puffGeo, steamMat);
    mesh.visible = false;
    scene.add(mesh);
    steamPool.push({ mesh, active: false, age: 0, life: 1.4, vx: 0, vy: 0, vz: 0, baseScale: 2.2 });
  }
  let dustTimer = 0;
  let steamTimer = 0;

  let currentMode: GameMode = initialMode;
  let currentSeed = getSeedForMode(currentMode);
  let worldData: IslandWorldData = generateIslandWorld(currentSeed);
  let screenState: AppScreenState = autostart ? 'playing' : 'title';
  let currentBiome: BiomeId = 'center';

  const playerState: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    walkPhase: number;
  } = {
    x: CONFIG.WORLD.SPAWN_X,
    y: CONFIG.ISLAND.CENTER.GRASS_TOP_Y,
    z: CONFIG.WORLD.SPAWN_Z,
    yaw: 0,
    walkPhase: 0,
  };

  const joystickInput = { dx: 0, dy: 0 };
  const activeKeys = new Set<string>();
  const camLookAt = new THREE.Vector3(playerState.x, playerState.y + CONFIG.CAMERA.LOOK_HEIGHT, playerState.z);
  const targetLookAt = new THREE.Vector3();
  const desiredCamPos = new THREE.Vector3();

  const pitchRad = THREE.MathUtils.degToRad(CONFIG.CAMERA.PITCH_DEG);
  const camHeightOffset = Math.sin(pitchRad) * CONFIG.CAMERA.DISTANCE;
  const camDepthOffset = Math.cos(pitchRad) * CONFIG.CAMERA.DISTANCE;

  const disposeIslandMeshes = () => {
    while (islandGroup.children.length > 0) {
      islandGroup.remove(islandGroup.children[0]);
    }
    for (const item of islandDisposables) {
      item.dispose();
    }
    islandDisposables = [];
    foamMeshes.length = 0;
    rippleMeshes.length = 0;
    obeliskCrystal = null;
    obeliskHalo = null;
    lavaPoolMesh = null;
    beaconFlameMesh = null;
    fireflyGroup = null;
  };

  const buildConnectorMesh = (
    c: BridgeOrRampSpec,
    woodMat: THREE.Material,
    railMat: THREE.Material,
    stoneMat: THREE.Material,
    stoneDarkMat: THREE.Material
  ) => {
    const dx = c.x1 - c.x0;
    const dz = c.z1 - c.z0;
    const horizLen = Math.hypot(dx, dz);
    const dy = c.y1 - c.y0;
    const yaw = Math.atan2(dx, dz);
    const pitch = -Math.atan2(dy, horizLen);
    const widthUnits = c.halfWidth * 1.92;

    const group = new THREE.Group();
    group.position.set((c.x0 + c.x1) * 0.5, (c.y0 + c.y1) * 0.5, (c.z0 + c.z1) * 0.5);
    group.rotation.y = yaw;

    const isStone = c.style === 'stone';
    const deckMat = isStone ? stoneMat : woodMat;
    const trimMat = isStone ? stoneDarkMat : railMat;

    // Solid under-deck stringers extending 0.55 units inside both ends so zero floating seam ever shows
    const beamLen = Math.hypot(horizLen, dy) + 1.1;
    const beamGeo = new THREE.BoxGeometry(0.24, 0.24, beamLen);
    islandDisposables.push(beamGeo);
    for (const side of [-1, 1]) {
      const beam = new THREE.Mesh(beamGeo, trimMat);
      beam.position.set(side * (widthUnits * 0.44), c.arch * 0.35 - 0.06, 0);
      beam.rotation.x = pitch;
      beam.castShadow = true;
      group.add(beam);
    }

    // Continuous sloped sub-deck core on ramps & piers so plank gaps never expose raw cliff rims
    if (c.kind !== 'bridge') {
      const coreGeo = new THREE.BoxGeometry(widthUnits * 0.96, 0.18, beamLen - 0.1);
      islandDisposables.push(coreGeo);
      const coreMesh = new THREE.Mesh(coreGeo, trimMat);
      coreMesh.position.set(0, -0.05, 0);
      coreMesh.rotation.x = pitch;
      coreMesh.receiveShadow = true;
      group.add(coreMesh);
    }

    // Individual slatted planks or carved stone slabs cleanly raised (+0.05) over endpoint edges
    const segmentCount = c.kind === 'bridge' ? 11 : 8;
    const slatDepth = ((horizLen + 0.55) / segmentCount) * (isStone ? 0.92 : 0.84);
    const slatGeo = new THREE.BoxGeometry(widthUnits, 0.14, slatDepth);
    islandDisposables.push(slatGeo);

    for (let i = 0; i < segmentCount; i += 1) {
      const u = i / (segmentCount - 1);
      const frac = -0.5 + u;
      const archY = c.arch > 0 ? Math.sin(u * Math.PI) * c.arch : 0;
      const slat = new THREE.Mesh(slatGeo, deckMat);
      slat.position.set(0, frac * dy + archY + 0.05, frac * (horizLen + 0.35));
      slat.rotation.x = pitch;
      slat.castShadow = true;
      slat.receiveShadow = true;
      group.add(slat);
    }

    // Support pillars standing down into water/beach + handrail posts
    const postCount = c.kind === 'bridge' ? 4 : 2;
    const postH = c.kind === 'ramp' ? 0.72 : 1.45;
    const postGeo = isStone
      ? new THREE.BoxGeometry(0.28, postH, 0.28)
      : new THREE.CylinderGeometry(0.12, 0.15, postH, 8);
    islandDisposables.push(postGeo);

    for (const side of [-1, 1]) {
      for (let i = 0; i < postCount; i += 1) {
        const u = 0.1 + (i / (postCount - 1)) * 0.8;
        const frac = -0.5 + u;
        const archY = c.arch > 0 ? Math.sin(u * Math.PI) * c.arch : 0;
        const post = new THREE.Mesh(postGeo, trimMat);
        post.position.set(
          side * (widthUnits * 0.48),
          frac * dy + archY + (c.kind === 'ramp' ? 0.04 : -0.22),
          frac * horizLen
        );
        post.castShadow = true;
        group.add(post);
      }
    }

    // Add side rope rails on suspension / water bridges
    if (c.kind === 'bridge' && c.style === 'rope') {
      const ropeGeo = new THREE.CylinderGeometry(0.045, 0.045, horizLen * 0.88, 6);
      ropeGeo.rotateX(Math.PI / 2);
      islandDisposables.push(ropeGeo);
      for (const side of [-1, 1]) {
        const rope = new THREE.Mesh(ropeGeo, woodMat);
        rope.position.set(side * (widthUnits * 0.48), c.arch * 0.55 + 0.44, 0);
        group.add(rope);
      }
    }

    islandGroup.add(group);
  };

  const buildIslandPad = (
    cx: number,
    cz: number,
    beachRx: number,
    beachRz: number,
    topRx: number,
    topRz: number,
    topY: number,
    phaseA: number,
    phaseB: number,
    sandMat: THREE.Material,
    sandSideMat: THREE.Material,
    topMat: THREE.Material,
    cliffMat: THREE.Material
  ) => {
    const padGroup = new THREE.Group();
    padGroup.position.set(cx, 0, cz);

    // Shallow glowing aquamarine halo
    const shallowShape = createContourShape(beachRx, beachRz, phaseA, phaseB, 1.16);
    const shallowGeo = new THREE.ShapeGeometry(shallowShape);
    shallowGeo.rotateX(-Math.PI / 2);
    const shallowMat = new THREE.MeshBasicMaterial({
      color: CONFIG.COLORS.SEA_SHALLOW,
      transparent: true,
      opacity: 0.68,
    });
    const shallowMesh = new THREE.Mesh(shallowGeo, shallowMat);
    shallowMesh.position.y = 0.015;
    padGroup.add(shallowMesh);
    islandDisposables.push(shallowGeo, shallowMat);

    // White coastal foam rim
    const foamShape = createContourShape(beachRx, beachRz, phaseA, phaseB, 1.045);
    foamShape.holes.push(createContourPath(beachRx, beachRz, phaseA, phaseB, 0.96));
    const foamGeo = new THREE.ShapeGeometry(foamShape);
    foamGeo.rotateX(-Math.PI / 2);
    const foamMat = new THREE.MeshBasicMaterial({
      color: CONFIG.COLORS.SEA_FOAM,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const foamMesh = new THREE.Mesh(foamGeo, foamMat);
    foamMesh.position.y = 0.036;
    padGroup.add(foamMesh);
    foamMeshes.push(foamMesh);
    islandDisposables.push(foamGeo, foamMat);

    // Outer gentle wave ripple
    const rippleShape = createContourShape(beachRx, beachRz, phaseA, phaseB, 1.095);
    rippleShape.holes.push(createContourPath(beachRx, beachRz, phaseA, phaseB, 1.07));
    const rippleGeo = new THREE.ShapeGeometry(rippleShape);
    rippleGeo.rotateX(-Math.PI / 2);
    const rippleMat = new THREE.MeshBasicMaterial({
      color: CONFIG.COLORS.SEA_FOAM,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
    rippleMesh.position.y = 0.028;
    padGroup.add(rippleMesh);
    rippleMeshes.push(rippleMesh);
    islandDisposables.push(rippleGeo, rippleMat);

    // Beach Base Slab
    const beachShape = createContourShape(beachRx, beachRz, phaseA, phaseB, 1);
    const beachGeo = new THREE.ExtrudeGeometry(beachShape, {
      depth: CONFIG.ISLAND.BEACH_HEIGHT + 0.2,
      bevelEnabled: true,
      bevelThickness: 0.14,
      bevelSize: 0.24,
      bevelSegments: 2,
    });
    beachGeo.rotateX(-Math.PI / 2);
    const beachMesh = new THREE.Mesh(beachGeo, [sandMat, sandSideMat]);
    beachMesh.position.y = -0.34;
    beachMesh.receiveShadow = true;
    padGroup.add(beachMesh);
    islandDisposables.push(beachGeo);

    // Cliff Wall + Thick Overhanging Biome Turf/Stone Cap
    const cliffShape = createContourShape(topRx, topRz, phaseA, phaseB, 0.99);
    const cliffH = topY - CONFIG.ISLAND.BEACH_HEIGHT;
    const cliffGeo = new THREE.ExtrudeGeometry(cliffShape, {
      depth: cliffH - 0.14,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.1,
      bevelSegments: 2,
    });
    cliffGeo.rotateX(-Math.PI / 2);
    const cliffMesh = new THREE.Mesh(cliffGeo, cliffMat);
    cliffMesh.position.y = CONFIG.ISLAND.BEACH_HEIGHT - 0.04;
    cliffMesh.receiveShadow = true;
    cliffMesh.castShadow = true;
    padGroup.add(cliffMesh);

    const topShape = createContourShape(topRx, topRz, phaseA, phaseB, 1.018);
    const topGeo = new THREE.ExtrudeGeometry(topShape, {
      depth: 0.24,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.14,
      bevelSegments: 2,
    });
    topGeo.rotateX(-Math.PI / 2);
    const topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.position.y = topY - 0.32;
    topMesh.receiveShadow = true;
    padGroup.add(topMesh);
    islandDisposables.push(cliffGeo, topGeo);

    islandGroup.add(padGroup);
  };

  const buildWeirdLandmarks = (world: IslandWorldData) => {
    const { RUINS, VOLCANO, SHIPWRECK } = CONFIG.ISLAND;
    const stoneMat = getPbrMat(CONFIG.COLORS.STONE_RUIN, 0.86, textures.ruinStoneDiffuse, textures.ruinStoneBump, 0.05);
    const stoneDarkMat = getPbrMat(CONFIG.COLORS.STONE_SIDE, 0.9);
    const basaltMat = getPbrMat(CONFIG.COLORS.BASALT, 0.92, textures.basaltDiffuse);
    const woodMat = getPbrMat(CONFIG.COLORS.WOOD_PLANK, 0.84, textures.woodDiffuse, textures.woodBump, 0.03);
    const woodDarkMat = getPbrMat(CONFIG.COLORS.WOOD_DARK, 0.88);
    const boneMat = getPbrMat(0xf4ecd8, 0.78);
    const sailMat = getPbrMat(0xfff4de, 0.9);

    // 1. ANCIENT RUINS: Stepped Altar + Glowing Floating Cyan Obelisk + Broken Fluted Columns
    const ruinsGroup = new THREE.Group();
    ruinsGroup.position.set(RUINS.CX, RUINS.PLAZA_TOP_Y, RUINS.CZ);

    const altarBaseGeo = new THREE.CylinderGeometry(2.3, 2.6, 0.32, 8);
    const altarTopGeo = new THREE.CylinderGeometry(1.5, 1.8, 0.28, 8);
    const obeliskGeo = new THREE.OctahedronGeometry(0.95, 0);
    obeliskGeo.scale(0.68, 2.35, 0.68);
    const haloGeo = new THREE.TorusGeometry(1.55, 0.07, 8, 24);
    const obeliskMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.OBELISK_GLOW,
      emissive: CONFIG.COLORS.OBELISK_GLOW,
      emissiveIntensity: 0.75,
      roughness: 0.2,
      metalness: 0.25,
    });
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x9ef9ff,
      transparent: true,
      opacity: 0.75,
    });
    islandDisposables.push(altarBaseGeo, altarTopGeo, obeliskGeo, haloGeo, obeliskMat, haloMat);

    const altarBase = new THREE.Mesh(altarBaseGeo, stoneDarkMat);
    altarBase.position.y = 0.16;
    altarBase.receiveShadow = true;
    altarBase.castShadow = true;

    const altarTop = new THREE.Mesh(altarTopGeo, stoneMat);
    altarTop.position.y = 0.44;
    altarTop.castShadow = true;

    obeliskCrystal = new THREE.Mesh(obeliskGeo, obeliskMat);
    obeliskCrystal.position.y = 2.65;
    obeliskCrystal.castShadow = true;

    obeliskHalo = new THREE.Mesh(haloGeo, haloMat);
    obeliskHalo.rotation.x = Math.PI / 2;
    obeliskHalo.position.y = 1.65;

    ruinsGroup.add(altarBase, altarTop, obeliskCrystal, obeliskHalo);
    islandGroup.add(ruinsGroup);

    // Fluted Ruin Columns around altar
    const colBaseGeo = new THREE.CylinderGeometry(0.45, 0.52, 0.35, 8);
    const colShaftGeo = new THREE.CylinderGeometry(0.36, 0.4, 2.2, 10);
    islandDisposables.push(colBaseGeo, colShaftGeo);
    for (const p of world.props.filter((pr) => pr.kind === 'column')) {
      const cg = new THREE.Group();
      cg.position.set(p.x, p.y, p.z);
      cg.rotation.y = p.rotationY;
      cg.scale.setScalar(p.scale);

      const cb = new THREE.Mesh(colBaseGeo, stoneDarkMat);
      cb.position.y = 0.17;
      cb.castShadow = true;
      cg.add(cb);

      const shaft = new THREE.Mesh(colShaftGeo, stoneMat);
      shaft.position.y = 1.3;
      if (p.variant === 1) {
        shaft.scale.y = 0.62;
        shaft.position.y = 0.92;
      } else if (p.variant === 2) {
        shaft.rotation.z = 0.25;
      }
      shaft.castShadow = true;
      cg.add(shaft);
      islandGroup.add(cg);
    }

    // 2. VOLCANO CRATER: Caldera Rim + Glowing Lava Pool + Giant Magma Crystal Spires
    const volcGroup = new THREE.Group();
    volcGroup.position.set(VOLCANO.CALDERA_CX, VOLCANO.CRATER_TOP_Y, VOLCANO.CALDERA_CZ);

    const rimGeo = new THREE.TorusGeometry(2.55, 0.85, 8, 16);
    rimGeo.rotateX(Math.PI / 2);
    const lavaGeo = new THREE.CircleGeometry(2.1, 20);
    lavaGeo.rotateX(-Math.PI / 2);
    const lavaCoreGeo = new THREE.CircleGeometry(1.15, 16);
    lavaCoreGeo.rotateX(-Math.PI / 2);
    const lavaMat = new THREE.MeshStandardMaterial({
      color: 0xff4512,
      emissive: 0xff5a14,
      emissiveIntensity: 0.9,
      roughness: 0.35,
    });
    const lavaHotMat = new THREE.MeshBasicMaterial({
      color: 0xffe46b,
    });
    const spireGeo = new THREE.ConeGeometry(0.45, 2.2, 5);
    const spireMat = new THREE.MeshStandardMaterial({
      color: 0xff6d2e,
      emissive: 0xff4512,
      emissiveIntensity: 0.6,
      roughness: 0.22,
    });
    islandDisposables.push(rimGeo, lavaGeo, lavaCoreGeo, lavaMat, lavaHotMat, spireGeo, spireMat);

    const calderaRim = new THREE.Mesh(rimGeo, basaltMat);
    calderaRim.position.y = 0.36;
    calderaRim.scale.set(1.08, 0.85, 1.0);
    calderaRim.castShadow = true;
    calderaRim.receiveShadow = true;

    lavaPoolMesh = new THREE.Mesh(lavaGeo, lavaMat);
    lavaPoolMesh.position.y = 0.44;
    const lavaHotCore = new THREE.Mesh(lavaCoreGeo, lavaHotMat);
    lavaHotCore.position.y = 0.46;
    volcGroup.add(calderaRim, lavaPoolMesh, lavaHotCore);

    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const spire = new THREE.Mesh(spireGeo, spireMat);
      spire.position.set(Math.cos(a) * 2.65, 0.95, Math.sin(a) * 2.55);
      spire.rotation.set((i % 2 === 0 ? 1 : -1) * 0.22, a, 0.18);
      spire.scale.setScalar(0.75 + (i % 3) * 0.25);
      spire.castShadow = true;
      volcGroup.add(spire);
    }
    islandGroup.add(volcGroup);

    // 3. GIANT BIOLUMINESCENT MUSHROOMS + FAIRY FIREFLIES
    const stemMat = getPbrMat(CONFIG.COLORS.MUSHROOM_STEM, 0.84);
    const capMatA = getPbrMat(CONFIG.COLORS.MUSHROOM_CAP_A, 0.68);
    const capMatB = getPbrMat(CONFIG.COLORS.MUSHROOM_CAP_B, 0.68);
    const spotMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.MUSHROOM_SPOT,
      emissive: CONFIG.COLORS.MUSHROOM_SPOT,
      emissiveIntensity: 0.95,
      roughness: 0.2,
    });
    const stemGeo = new THREE.CylinderGeometry(0.24, 0.38, 2.2, 10);
    const capGeo = new THREE.SphereGeometry(1.18, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56);
    const gillRingGeo = new THREE.TorusGeometry(0.42, 0.08, 6, 12);
    gillRingGeo.rotateX(Math.PI / 2);
    const spotGeo = new THREE.SphereGeometry(0.2, 10, 8);
    islandDisposables.push(spotMat, stemGeo, capGeo, gillRingGeo, spotGeo);

    for (const mush of world.props.filter((p) => p.kind === 'mushroom')) {
      const mg = new THREE.Group();
      mg.position.set(mush.x, mush.y, mush.z);
      mg.rotation.y = mush.rotationY;
      mg.scale.setScalar(mush.scale * 1.15);

      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 1.05;
      stem.rotation.z = 0.08;
      stem.castShadow = true;
      mg.add(stem);

      const collar = new THREE.Mesh(gillRingGeo, stemMat);
      collar.position.set(-0.05, 1.55, 0);
      mg.add(collar);

      const capMat = mush.variant === 0 ? capMatA : capMatB;
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(-0.08, 1.98, 0);
      cap.scale.set(1.1, 0.85, 1.1);
      cap.castShadow = true;
      mg.add(cap);

      // Crown center + upper ring spots sitting cleanly ON TOP of the dome surface
      const apexSpot = new THREE.Mesh(spotGeo, spotMat);
      apexSpot.position.set(-0.08, 2.95, 0);
      apexSpot.scale.set(1.05, 0.55, 1.05);
      mg.add(apexSpot);

      const spotAngles = [0.25, 1.48, 2.72, 3.98, 5.18];
      spotAngles.forEach((sa, idx) => {
        const sp = new THREE.Mesh(spotGeo, spotMat);
        const r = idx % 2 === 0 ? 0.62 : 0.86;
        const yOff = idx % 2 === 0 ? 2.83 : 2.68;
        sp.position.set(-0.08 + Math.cos(sa) * r, yOff, Math.sin(sa) * r);
        sp.scale.set(0.88, 0.48, 0.88);
        mg.add(sp);
      });

      // Mini companion toadstool at stem base
      const miniStem = new THREE.Mesh(stemGeo, stemMat);
      miniStem.position.set(0.45, 0.34, 0.35);
      miniStem.scale.setScalar(0.32);
      const miniCap = new THREE.Mesh(capGeo, capMat);
      miniCap.position.set(0.45, 0.64, 0.35);
      miniCap.scale.set(0.36, 0.28, 0.36);
      mg.add(miniStem, miniCap);

      islandGroup.add(mg);
    }

    // Floating fairy fireflies in Mushroom Grove
    fireflyGroup = new THREE.Group();
    fireflyGroup.position.set(CONFIG.ISLAND.MUSHROOM.CX, CONFIG.ISLAND.MUSHROOM.GROVE_TOP_Y + 1.2, CONFIG.ISLAND.MUSHROOM.CZ);
    const ffGeo = new THREE.SphereGeometry(0.09, 6, 6);
    const ffMat = new THREE.MeshBasicMaterial({ color: 0x8efeff });
    islandDisposables.push(ffGeo, ffMat);
    for (let i = 0; i < 14; i += 1) {
      const ff = new THREE.Mesh(ffGeo, ffMat);
      const a = (i / 14) * Math.PI * 2;
      const dist = 2.0 + (i % 4) * 1.6;
      ff.position.set(Math.cos(a) * dist, (i % 3) * 0.55, Math.sin(a) * dist);
      fireflyGroup.add(ff);
    }
    islandGroup.add(fireflyGroup);

    // 4. SHIPWRECK COVE: Tilted Wooden Hull + Deck + Mast & Sail + Giant Leviathan Ribcage + Stone Beacon
    const shipGroup = new THREE.Group();
    shipGroup.position.set(SHIPWRECK.HULL_CX, CONFIG.ISLAND.BEACH_HEIGHT - 0.08, SHIPWRECK.HULL_CZ);
    shipGroup.rotation.set(0.12, -0.52, 0.22);

    const hullGeo = new THREE.CylinderGeometry(1.55, 1.05, 5.2, 10, 1, false, 0, Math.PI);
    hullGeo.rotateZ(Math.PI / 2);
    hullGeo.rotateX(Math.PI / 2);
    const deckGeo = new THREE.BoxGeometry(4.8, 0.14, 2.35);
    const mastGeo = new THREE.CylinderGeometry(0.12, 0.17, 4.4, 8);
    const yardGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.7, 7);
    yardGeo.rotateZ(Math.PI / 2);
    const sailGeo = new THREE.BoxGeometry(2.3, 1.85, 0.08);
    const crateGeo = new THREE.BoxGeometry(0.62, 0.62, 0.62);
    islandDisposables.push(hullGeo, deckGeo, mastGeo, yardGeo, sailGeo, crateGeo);

    const hull = new THREE.Mesh(hullGeo, woodMat);
    hull.position.y = 0.52;
    hull.castShadow = true;
    hull.receiveShadow = true;

    const deck = new THREE.Mesh(deckGeo, woodDarkMat);
    deck.position.y = 0.56;
    deck.receiveShadow = true;

    const mast = new THREE.Mesh(mastGeo, woodDarkMat);
    mast.position.set(0.2, 2.35, 0);
    mast.rotation.z = -0.18;
    mast.castShadow = true;

    const yard = new THREE.Mesh(yardGeo, woodDarkMat);
    yard.position.set(0.55, 3.65, 0);
    yard.rotation.y = 0.25;

    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0.55, 2.7, 0.12);
    sail.rotation.y = 0.25;
    sail.castShadow = true;

    const crateA = new THREE.Mesh(crateGeo, woodMat);
    crateA.position.set(-2.3, 0.35, 1.4);
    crateA.rotation.y = 0.4;
    crateA.castShadow = true;

    const crateB = new THREE.Mesh(crateGeo, woodDarkMat);
    crateB.position.set(-2.7, 0.3, 0.6);
    crateB.rotation.y = -0.3;
    crateB.castShadow = true;

    shipGroup.add(hull, deck, mast, yard, sail, crateA, crateB);
    islandGroup.add(shipGroup);

    // Giant Bleached Leviathan Ribcage Arches cleanly planted on Shipwreck's golden south beach
    const ribGeo = new THREE.TorusGeometry(2.05, 0.17, 7, 14, Math.PI * 0.72);
    islandDisposables.push(ribGeo);
    for (let i = 0; i < 4; i += 1) {
      const rib = new THREE.Mesh(ribGeo, boneMat);
      rib.position.set(SHIPWRECK.CX - 2.6 + i * 1.15, CONFIG.ISLAND.BEACH_HEIGHT - 0.12, SHIPWRECK.CZ + 8.35);
      rib.rotation.set(0.16, Math.PI * 0.5 + 0.2, -0.32);
      rib.scale.setScalar(1.0 - i * 0.08);
      rib.castShadow = true;
      islandGroup.add(rib);
    }

    // Glowing Coastal Lighthouse Beacon on Shipwreck Rocky Spit
    const beaconGroup = new THREE.Group();
    beaconGroup.position.set(SHIPWRECK.SPIT_CX + 1.8, SHIPWRECK.SPIT_TOP_Y, SHIPWRECK.SPIT_CZ - 0.8);
    const towerGeo = new THREE.CylinderGeometry(0.62, 0.94, 3.1, 12);
    const galleryGeo = new THREE.CylinderGeometry(0.86, 0.72, 0.22, 12);
    const strutGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.95, 6);
    const lanternCapGeo = new THREE.ConeGeometry(0.88, 0.72, 12);
    const flameGeo = new THREE.SphereGeometry(0.52, 14, 12);
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xffe878,
      emissive: 0xffa81c,
      emissiveIntensity: 1.1,
      roughness: 0.15,
    });
    islandDisposables.push(towerGeo, galleryGeo, strutGeo, lanternCapGeo, flameGeo, flameMat);

    const tower = new THREE.Mesh(towerGeo, stoneMat);
    tower.position.y = 1.55;
    tower.castShadow = true;
    const gallery = new THREE.Mesh(galleryGeo, stoneDarkMat);
    gallery.position.y = 3.15;
    const cap = new THREE.Mesh(lanternCapGeo, stoneDarkMat);
    cap.position.y = 4.42;
    beaconFlameMesh = new THREE.Mesh(flameGeo, flameMat);
    beaconFlameMesh.position.y = 3.68;

    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const strut = new THREE.Mesh(strutGeo, stoneDarkMat);
      strut.position.set(Math.cos(a) * 0.62, 3.68, Math.sin(a) * 0.62);
      beaconGroup.add(strut);
    }
    beaconGroup.add(tower, gallery, cap, beaconFlameMesh);
    islandGroup.add(beaconGroup);

    // 5. OFFSHORE SEA STACKS with White Surf Foam Rings
    const seaStackSeeded = createSeededRandom(`${world.seed}-stacks`);
    const stackFoamGeo = new THREE.RingGeometry(1.75, 2.35, 22);
    stackFoamGeo.rotateX(-Math.PI / 2);
    const stackFoamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    islandDisposables.push(stackFoamGeo, stackFoamMat);

    for (let i = 0; i < CONFIG.PROPS.SEA_STACK_COUNT; i += 1) {
      const a = (i / CONFIG.PROPS.SEA_STACK_COUNT) * Math.PI * 2 + 0.38;
      const dist = 48 + seaStackSeeded() * 14;
      const sx = Math.cos(a) * dist;
      const sz = Math.sin(a) * dist * 0.82;
      const stackH = 2.4 + seaStackSeeded() * 2.8;

      const sg = new THREE.Group();
      sg.position.set(sx, 0, sz);

      const foam = new THREE.Mesh(stackFoamGeo, stackFoamMat);
      foam.position.y = 0.04;
      foamMeshes.push(foam);
      sg.add(foam);

      const stackGeo = buildSculptedBoulderGeometry(1.8, i * 3.7, false);
      stackGeo.scale(1.0, stackH * 0.55, 0.9);
      islandDisposables.push(stackGeo);
      const rockMesh = new THREE.Mesh(stackGeo, i % 2 === 0 ? basaltMat : stoneDarkMat);
      rockMesh.position.y = stackH * 0.4;
      rockMesh.castShadow = true;
      rockMesh.receiveShadow = true;
      sg.add(rockMesh);

      islandGroup.add(sg);
    }
  };

  const buildArchipelagoGeometry = (world: IslandWorldData) => {
    disposeIslandMeshes();

    // Neutral white base tint (0xffffff) on diffuse-textured terrain so colors never double-multiply dark/red
    const sandMat = getPbrMat(0xffffff, 0.9, textures.sandDiffuse, textures.sandBump, 0.03);
    const sandSideMat = getPbrMat(CONFIG.COLORS.SAND_SIDE, 0.9);
    const grassMat = getPbrMat(0xffffff, 0.88, textures.grassDiffuse, textures.grassBump, 0.04);
    const mossMat = getPbrMat(0xffffff, 0.86, textures.mossDiffuse);
    const dirtMat = getPbrMat(0xffffff, 0.9, textures.dirtCliffDiffuse, textures.dirtCliffBump, 0.055);
    const ruinStoneMat = getPbrMat(0xffffff, 0.86, textures.ruinStoneDiffuse, textures.ruinStoneBump, 0.05);
    const ruinSideMat = getPbrMat(CONFIG.COLORS.STONE_SIDE, 0.9);
    const basaltMat = getPbrMat(0xffffff, 0.92, textures.basaltDiffuse);
    const basaltDarkMat = getPbrMat(CONFIG.COLORS.BASALT_DARK, 0.94);
    const woodMat = getPbrMat(0xffffff, 0.84, textures.woodDiffuse, textures.woodBump, 0.03);
    const railMat = getPbrMat(CONFIG.COLORS.WOOD_DARK, 0.88);

    const { CENTER, RUINS, VOLCANO, MUSHROOM, SHIPWRECK } = CONFIG.ISLAND;
    const pA = world.lobePhaseA;
    const pB = world.lobePhaseB;

    // 1. Central Tropical Haven + Upper Knoll
    buildIslandPad(
      CENTER.CX,
      CENTER.CZ,
      CENTER.BEACH_RX,
      CENTER.BEACH_RZ,
      CENTER.GRASS_RX,
      CENTER.GRASS_RZ,
      CENTER.GRASS_TOP_Y,
      pA,
      pB,
      sandMat,
      sandSideMat,
      grassMat,
      dirtMat
    );

    // Upper Knoll on Central Haven
    const knollDirtShape = createContourShape(CENTER.KNOLL_RX, CENTER.KNOLL_RZ, pA + 0.8, pB - 0.6, 0.99);
    const knollH = CENTER.KNOLL_TOP_Y - CENTER.GRASS_TOP_Y;
    const knollDirtGeo = new THREE.ExtrudeGeometry(knollDirtShape, {
      depth: knollH - 0.1,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.09,
      bevelSegments: 2,
    });
    knollDirtGeo.rotateX(-Math.PI / 2);
    const knollDirtMesh = new THREE.Mesh(knollDirtGeo, dirtMat);
    knollDirtMesh.position.set(CENTER.KNOLL_CX, CENTER.GRASS_TOP_Y - 0.04, CENTER.KNOLL_CZ);
    knollDirtMesh.receiveShadow = true;
    knollDirtMesh.castShadow = true;
    islandGroup.add(knollDirtMesh);

    const knollGrassShape = createContourShape(CENTER.KNOLL_RX, CENTER.KNOLL_RZ, pA + 0.8, pB - 0.6, 1.018);
    const knollGrassGeo = new THREE.ExtrudeGeometry(knollGrassShape, {
      depth: 0.2,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.12,
      bevelSegments: 2,
    });
    knollGrassGeo.rotateX(-Math.PI / 2);
    const knollGrassMesh = new THREE.Mesh(knollGrassGeo, grassMat);
    knollGrassMesh.position.set(CENTER.KNOLL_CX, CENTER.KNOLL_TOP_Y - 0.26, CENTER.KNOLL_CZ);
    knollGrassMesh.receiveShadow = true;
    islandGroup.add(knollGrassMesh);
    islandDisposables.push(knollDirtGeo, knollGrassGeo);

    // 2. Ancient Ruins Island (NW)
    buildIslandPad(
      RUINS.CX,
      RUINS.CZ,
      RUINS.BEACH_RX,
      RUINS.BEACH_RZ,
      RUINS.PLAZA_RX,
      RUINS.PLAZA_RZ,
      RUINS.PLAZA_TOP_Y,
      pA + 0.5,
      pB + 0.3,
      sandMat,
      sandSideMat,
      ruinStoneMat,
      ruinSideMat
    );

    // 3. Obsidian Volcano Island (NE)
    buildIslandPad(
      VOLCANO.CX,
      VOLCANO.CZ,
      VOLCANO.BEACH_RX,
      VOLCANO.BEACH_RZ,
      VOLCANO.CRATER_RX,
      VOLCANO.CRATER_RZ,
      VOLCANO.CRATER_TOP_Y,
      pA + 1.1,
      pB - 0.4,
      sandMat,
      sandSideMat,
      basaltMat,
      basaltDarkMat
    );

    // 4. Giant Mushroom Grove (SW)
    buildIslandPad(
      MUSHROOM.CX,
      MUSHROOM.CZ,
      MUSHROOM.BEACH_RX,
      MUSHROOM.BEACH_RZ,
      MUSHROOM.GROVE_RX,
      MUSHROOM.GROVE_RZ,
      MUSHROOM.GROVE_TOP_Y,
      pA - 0.7,
      pB + 0.9,
      sandMat,
      sandSideMat,
      mossMat,
      dirtMat
    );

    // 5. Shipwreck Cove (SE)
    buildIslandPad(
      SHIPWRECK.CX,
      SHIPWRECK.CZ,
      SHIPWRECK.BEACH_RX,
      SHIPWRECK.BEACH_RZ,
      SHIPWRECK.SPIT_RX,
      SHIPWRECK.SPIT_RZ,
      SHIPWRECK.SPIT_TOP_Y,
      pA + 1.6,
      pB + 0.2,
      sandMat,
      sandSideMat,
      grassMat,
      dirtMat
    );
    // Offset rocky spit center slightly relative to beach if needed — align spit visually at (SPIT_CX, SPIT_CZ):
    // Note: in buildIslandPad above, top plateau centered on (SHIPWRECK.CX, SHIPWRECK.CZ) matches; let's verify!
    // Wait: world.ts checks SPIT_CX/SPIT_CZ! Let's shift the last island's top plateau? Wait: SPIT_CX = 32.2 vs CX = 30.0.
    // Let's keep them centered at (SHIPWRECK.CX, SHIPWRECK.CZ) or align both identically! Wait - let's check:
    // Better yet, let's adjust the Shipwreck Spit pad by moving the last pad's cliff+top group by (SPIT_CX - CX, SPIT_CZ - CZ)!
    const shipwreckPad = islandGroup.children[islandGroup.children.length - 1];
    if (shipwreckPad && shipwreckPad.children.length >= 2) {
      const cliffChild = shipwreckPad.children[shipwreckPad.children.length - 2];
      const topChild = shipwreckPad.children[shipwreckPad.children.length - 1];
      cliffChild.position.x = SHIPWRECK.SPIT_CX - SHIPWRECK.CX;
      cliffChild.position.z = SHIPWRECK.SPIT_CZ - SHIPWRECK.CZ;
      topChild.position.x = SHIPWRECK.SPIT_CX - SHIPWRECK.CX;
      topChild.position.z = SHIPWRECK.SPIT_CZ - SHIPWRECK.CZ;
    }

    // 6. All 11 Bridges, Piers & Ramps (1:1 with world.ts connectors!)
    for (const conn of world.connectors) {
      buildConnectorMesh(conn, woodMat, railMat, ruinStoneMat, ruinSideMat);
    }

    // 7. Weird Landmarks (Obelisk, Volcano Lava/Crystals, Giant Mushrooms, Shipwreck, Ribcage, Beacon, Sea Stacks)
    buildWeirdLandmarks(world);

    if (!natureTreeAssets) {
    // 8. Instanced Tropical Palms (Curved V-Blade Fronds!)
    const palmProps = world.props.filter((p) => p.kind === 'palm');
    if (palmProps.length > 0) {
      const trunkGeo = buildCurvedPalmTrunkGeometry();
      const frondGeo = buildPalmCanopyGeometry();
      const coconutGeo = buildCoconutClusterGeometry();
      const palmShadowGeo = new THREE.CircleGeometry(1.28, 16);
      palmShadowGeo.rotateX(-Math.PI / 2);

      const trunkMat = getPbrMat(CONFIG.COLORS.PALM_TRUNK, 0.88);
      const frondMat = new THREE.MeshStandardMaterial({
        color: CONFIG.COLORS.PALM_FROND,
        roughness: 0.78,
        metalness: 0.02,
        side: THREE.DoubleSide,
        vertexColors: true,
      });
      islandDisposables.push(frondMat);
      const coconutMat = getPbrMat(CONFIG.COLORS.COCONUT, 0.82);

      const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, palmProps.length);
      const frondInst = new THREE.InstancedMesh(frondGeo, frondMat, palmProps.length);
      const coconutInst = new THREE.InstancedMesh(coconutGeo, coconutMat, palmProps.length);
      const shadowInst = new THREE.InstancedMesh(palmShadowGeo, shadowDiscMat, palmProps.length);

      trunkInst.castShadow = !isSoftwareGl;
      frondInst.castShadow = !isSoftwareGl;
      trunkInst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      palmProps.forEach((p: IslandProp, idx: number) => {
        dummy.position.set(p.x, p.y - 0.04, p.z);
        dummy.rotation.set(0, p.rotationY, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        trunkInst.setMatrixAt(idx, dummy.matrix);
        frondInst.setMatrixAt(idx, dummy.matrix);
        coconutInst.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(p.x + 0.4 * p.scale, p.y + 0.02, p.z + 0.15 * p.scale);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        shadowInst.setMatrixAt(idx, dummy.matrix);
      });

      trunkInst.instanceMatrix.needsUpdate = true;
      frondInst.instanceMatrix.needsUpdate = true;
      coconutInst.instanceMatrix.needsUpdate = true;
      shadowInst.instanceMatrix.needsUpdate = true;

      trunkInst.computeBoundingSphere();
      frondInst.computeBoundingSphere();
      coconutInst.computeBoundingSphere();
      shadowInst.computeBoundingSphere();

      islandGroup.add(shadowInst, trunkInst, frondInst, coconutInst);
      islandDisposables.push(trunkGeo, frondGeo, coconutGeo, palmShadowGeo);
    }

    // 9. Instanced Broadleaf Jungle Trees
    const jungleProps = world.props.filter((p) => p.kind === 'jungle');
    if (jungleProps.length > 0) {
      const jTrunkGeo = buildJungleTrunkGeometry();
      const jCanopyGeo = buildJungleCanopyGeometry();
      const jShadowGeo = new THREE.CircleGeometry(1.45, 16);
      jShadowGeo.rotateX(-Math.PI / 2);

      const jTrunkMat = getPbrMat(0x7c4b27, 0.9);
      const jCanopyMat = new THREE.MeshStandardMaterial({
        color: CONFIG.COLORS.JUNGLE_LEAF,
        roughness: 0.84,
        metalness: 0.02,
        vertexColors: true,
      });
      islandDisposables.push(jCanopyMat);

      const jTrunkInst = new THREE.InstancedMesh(jTrunkGeo, jTrunkMat, jungleProps.length);
      const jCanopyInst = new THREE.InstancedMesh(jCanopyGeo, jCanopyMat, jungleProps.length);
      const jShadowInst = new THREE.InstancedMesh(jShadowGeo, shadowDiscMat, jungleProps.length);

      jTrunkInst.castShadow = !isSoftwareGl;
      jCanopyInst.castShadow = !isSoftwareGl;

      const dummy = new THREE.Object3D();
      jungleProps.forEach((p: IslandProp, idx: number) => {
        dummy.position.set(p.x, p.y - 0.04, p.z);
        dummy.rotation.set(0, p.rotationY, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        jTrunkInst.setMatrixAt(idx, dummy.matrix);
        jCanopyInst.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(p.x + 0.25 * p.scale, p.y + 0.02, p.z + 0.1 * p.scale);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        jShadowInst.setMatrixAt(idx, dummy.matrix);
      });

      jTrunkInst.instanceMatrix.needsUpdate = true;
      jCanopyInst.instanceMatrix.needsUpdate = true;
      jShadowInst.instanceMatrix.needsUpdate = true;
      jTrunkInst.computeBoundingSphere();
      jCanopyInst.computeBoundingSphere();
      jShadowInst.computeBoundingSphere();

      islandGroup.add(jShadowInst, jTrunkInst, jCanopyInst);
      islandDisposables.push(jTrunkGeo, jCanopyGeo, jShadowGeo);
    }

    } else {
      const addInstancedNatureTrees = (
        props: IslandProp[],
        models: NatureTreeModel[],
        heightScale: number
      ) => {
        if (props.length === 0) return;

        for (let variant = 0; variant < models.length; variant += 1) {
          const selected = props.filter((prop) => prop.variant % models.length === variant);
          if (selected.length === 0) continue;

          for (const part of models[variant].parts) {
            const instanced = new THREE.InstancedMesh(part.geometry, part.material, selected.length);
            instanced.castShadow = !isSoftwareGl;
            instanced.receiveShadow = true;
            instanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);

            const dummy = new THREE.Object3D();
            selected.forEach((prop, index) => {
              dummy.position.set(prop.x, prop.y - 0.025, prop.z);
              dummy.rotation.set(0, prop.rotationY, 0);
              dummy.scale.setScalar(prop.scale * heightScale);
              dummy.updateMatrix();
              instanced.setMatrixAt(index, dummy.matrix);
            });

            instanced.instanceMatrix.needsUpdate = true;
            instanced.computeBoundingSphere();
            islandGroup.add(instanced);
          }
        }

        const shadowGeo = new THREE.CircleGeometry(1.05, 12);
        shadowGeo.rotateX(-Math.PI / 2);
        const shadows = new THREE.InstancedMesh(shadowGeo, shadowDiscMat, props.length);
        shadows.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        const dummy = new THREE.Object3D();
        props.forEach((prop, index) => {
          dummy.position.set(prop.x + 0.12 * prop.scale, prop.y + 0.018, prop.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(prop.scale * 1.12);
          dummy.updateMatrix();
          shadows.setMatrixAt(index, dummy.matrix);
        });
        shadows.instanceMatrix.needsUpdate = true;
        shadows.computeBoundingSphere();
        islandGroup.add(shadows);
        islandDisposables.push(shadowGeo);
      };

      addInstancedNatureTrees(palmProps, natureTreeAssets.palms, 3.05);
      addInstancedNatureTrees(jungleProps, natureTreeAssets.jungle, 3.0);
    }

    // 10. Sculpted Displaced Rocks with Vertex Ambient Shading
    const rockMainMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ROCK_MAIN,
      roughness: 0.92,
      metalness: 0.02,
      vertexColors: true,
    });
    const rockLightMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ROCK_LIGHT,
      roughness: 0.88,
      metalness: 0.02,
      vertexColors: true,
    });
    const rockGeoA = buildSculptedBoulderGeometry(0.72, 1.3);
    const rockGeoB = buildSculptedBoulderGeometry(0.44, 4.7);
    const rockGeoC = buildSculptedBoulderGeometry(0.28, 7.9);
    const propShadowGeo = new THREE.CircleGeometry(0.88, 16);
    propShadowGeo.rotateX(-Math.PI / 2);
    islandDisposables.push(rockMainMat, rockLightMat, rockGeoA, rockGeoB, rockGeoC, propShadowGeo);

    for (const rock of world.props.filter((p) => p.kind === 'rock')) {
      const group = new THREE.Group();
      group.position.set(rock.x, rock.y, rock.z);
      group.rotation.y = rock.rotationY;
      group.scale.setScalar(rock.scale);

      const shadow = new THREE.Mesh(propShadowGeo, shadowDiscMat);
      shadow.position.y = 0.02;
      group.add(shadow);

      const mainBoulder = new THREE.Mesh(rockGeoA, rockMainMat);
      mainBoulder.scale.set(1.12, 0.78, 0.96);
      mainBoulder.position.set(-0.08, 0.4, 0);
      mainBoulder.castShadow = true;
      mainBoulder.receiveShadow = true;
      group.add(mainBoulder);

      const sideBoulder = new THREE.Mesh(rockGeoB, rockLightMat);
      sideBoulder.position.set(0.48, 0.26, 0.22);
      sideBoulder.castShadow = true;
      group.add(sideBoulder);

      const pebble = new THREE.Mesh(rockGeoC, rockMainMat);
      pebble.position.set(-0.46, 0.16, 0.42);
      group.add(pebble);

      islandGroup.add(group);
    }

    // 11. Sculpted Berry Bushes with Vertex Ambient Shading
    const bushLeafMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.BUSH_LEAF,
      roughness: 0.84,
      metalness: 0.02,
      vertexColors: true,
    });
    const bushTopMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.PALM_FROND,
      roughness: 0.82,
      metalness: 0.02,
      vertexColors: true,
    });
    const berryMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.BERRY_RED,
      roughness: 0.24,
      metalness: 0.05,
    });
    const bushGeo = buildSculptedBoulderGeometry(0.48, 2.5);
    const berryGeo = new THREE.SphereGeometry(0.11, 8, 8);
    islandDisposables.push(bushLeafMat, bushTopMat, berryMat, bushGeo, berryGeo);

    for (const bush of world.props.filter((p) => p.kind === 'bush')) {
      const group = new THREE.Group();
      group.position.set(bush.x, bush.y, bush.z);
      group.rotation.y = bush.rotationY;
      group.scale.setScalar(bush.scale);

      const shadow = new THREE.Mesh(propShadowGeo, shadowDiscMat);
      shadow.scale.setScalar(0.86);
      shadow.position.y = 0.02;
      group.add(shadow);

      const puffOffsets = [
        { x: 0, y: 0.44, z: 0, s: 1.05, m: bushTopMat },
        { x: -0.32, y: 0.3, z: 0.18, s: 0.78, m: bushLeafMat },
        { x: 0.34, y: 0.32, z: 0.12, s: 0.76, m: bushLeafMat },
        { x: 0.05, y: 0.34, z: -0.32, s: 0.8, m: bushLeafMat },
      ];
      for (const puff of puffOffsets) {
        const mesh = new THREE.Mesh(bushGeo, puff.m);
        mesh.position.set(puff.x, puff.y, puff.z);
        mesh.scale.setScalar(puff.s);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }

      const berryOffsets = [
        [0.18, 0.56, 0.4],
        [-0.22, 0.48, 0.44],
        [0.42, 0.38, 0.28],
        [-0.38, 0.35, -0.05],
        [0.08, 0.72, 0.15],
      ];
      for (const [bx, by, bz] of berryOffsets) {
        const berry = new THREE.Mesh(berryGeo, berryMat);
        berry.position.set(bx, by, bz);
        group.add(berry);
      }

      islandGroup.add(group);
    }

    // 12. Instanced Meadow Ferns & Grass Tufts across Central Haven + Mushroom Grove
    const fernGeo = buildFernTuftGeometry();
    const fernMat = new THREE.MeshStandardMaterial({
      color: 0x56b946,
      roughness: 0.85,
      metalness: 0.02,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    islandDisposables.push(fernMat);
    const fernRng = createSeededRandom(`${world.seed}-ferns`);
    const fernMatrices: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < CONFIG.PROPS.FERN_TUFT_COUNT; i += 1) {
      const inGrove = i % 3 === 0;
      const rx = inGrove ? MUSHROOM.GROVE_RX * 0.8 : CENTER.GRASS_RX * 0.84;
      const rz = inGrove ? MUSHROOM.GROVE_RZ * 0.8 : CENTER.GRASS_RZ * 0.84;
      const cx = inGrove ? MUSHROOM.CX : CENTER.CX;
      const cz = inGrove ? MUSHROOM.CZ : CENTER.CZ;
      const phi = fernRng() * Math.PI * 2;
      const rad = Math.sqrt(fernRng());
      const fx = cx + Math.cos(phi) * rx * rad;
      const fz = cz + Math.sin(phi) * rz * rad;
      const fy = groundHeightAt(fx, fz, world);
      if (fy < 1.2) continue;
      if (isNearAnyConnector(fx, fz, world.connectors, 1.35)) continue;

      dummy.position.set(fx, fy - 0.02, fz);
      dummy.rotation.set(0, fernRng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.75 + fernRng() * 0.65);
      dummy.updateMatrix();
      fernMatrices.push(dummy.matrix.clone());
    }

    if (fernMatrices.length > 0) {
      const fernInst = new THREE.InstancedMesh(fernGeo, fernMat, fernMatrices.length);
      fernMatrices.forEach((m, idx) => fernInst.setMatrixAt(idx, m));
      fernInst.instanceMatrix.needsUpdate = true;
      fernInst.computeBoundingSphere();
      islandGroup.add(fernInst);
    }
    islandDisposables.push(fernGeo);
  };

  const resetPlayerToSpawn = () => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const biomeParam = params?.get('biome');
    let sx = CONFIG.WORLD.SPAWN_X;
    let sz = CONFIG.WORLD.SPAWN_Z;

    if (biomeParam === 'ruins') {
      sx = CONFIG.ISLAND.RUINS.CX + 2.4;
      sz = CONFIG.ISLAND.RUINS.CZ + 2.2;
    } else if (biomeParam === 'volcano') {
      sx = CONFIG.ISLAND.VOLCANO.CX - 2.6;
      sz = CONFIG.ISLAND.VOLCANO.CZ + 2.2;
    } else if (biomeParam === 'mushroom') {
      sx = CONFIG.ISLAND.MUSHROOM.CX + 2.0;
      sz = CONFIG.ISLAND.MUSHROOM.CZ - 2.0;
    } else if (biomeParam === 'shipwreck') {
      sx = CONFIG.ISLAND.SHIPWRECK.CX - 2.0;
      sz = CONFIG.ISLAND.SHIPWRECK.CZ - 2.4;
    }

    playerState.x = sx;
    playerState.z = sz;
    playerState.y = groundHeightAt(playerState.x, playerState.z, worldData);
    playerState.yaw = 0;
    playerState.walkPhase = 0;
    currentBiome = detectBiomeAt(playerState.x, playerState.z, worldData);

    survivor.root.position.set(playerState.x, playerState.y, playerState.z);
    survivor.root.rotation.y = 0;
    camLookAt.set(playerState.x, playerState.y + CONFIG.CAMERA.LOOK_HEIGHT, playerState.z);
  };

  const emitHud = (biome: BiomeId = currentBiome) => {
    callbacks.onHudUpdate({
      coins: 0,
      wood: 0,
      stone: 0,
      berries: 0,
      energy: CONFIG.PLAYER.MAX_ENERGY,
      maxEnergy: CONFIG.PLAYER.MAX_ENERGY,
      backpackUsed: 0,
      backpackCapacity: CONFIG.PLAYER.BACKPACK_CAPACITY,
      biome,
    });
  };

  const loadSeedWorld = (seed: string) => {
    currentSeed = seed;
    worldData = generateIslandWorld(seed);
    buildArchipelagoGeometry(worldData);
    resetPlayerToSpawn();
  };

  loadSeedWorld(currentSeed);
  emitHud(currentBiome);

  if (autostart) {
    callbacks.onScreenChange('playing', { mode: currentMode, seed: currentSeed });
  } else {
    callbacks.onScreenChange('title', { mode: currentMode, seed: currentSeed });
  }

  const onKeyDown = (e: KeyboardEvent) => {
    activeKeys.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    activeKeys.delete(e.code);
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const onResize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);
  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  const onContextLost = (event: Event) => {
    event.preventDefault();
  };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

  let disposed = false;
  void loadNatureTreeAssets()
    .then((assets) => {
      if (disposed) {
        assets.dispose();
        return;
      }
      natureTreeAssets = assets;
      // Rebuild the current seed with the GLB trees; procedural trees remain as a safe fallback.
      buildArchipelagoGeometry(worldData);
      resetPlayerToSpawn();
    })
    .catch((error: unknown) => {
      console.warn('[Nature Kit] Could not load tree models; keeping procedural trees.', error);
    });
  let elapsedTime = 0;
  let lastTimeMs = performance.now();
  let rafId = 0;

  const spawnDustPuff = (x: number, y: number, z: number) => {
    for (const puff of dustPool) {
      if (!puff.active) {
        puff.active = true;
        puff.age = 0;
        puff.life = 0.36;
        puff.vx = (Math.random() - 0.5) * 0.65;
        puff.vy = 0.65 + Math.random() * 0.35;
        puff.vz = (Math.random() - 0.5) * 0.65;
        puff.mesh.position.set(x, y + 0.12, z);
        puff.mesh.scale.setScalar(0.95);
        puff.mesh.visible = true;
        break;
      }
    }
  };

  const spawnVolcanoSteam = () => {
    const { VOLCANO } = CONFIG.ISLAND;
    for (const puff of steamPool) {
      if (!puff.active) {
        puff.active = true;
        puff.age = 0;
        puff.life = 1.45;
        puff.vx = (Math.random() - 0.5) * 0.45;
        puff.vy = 1.45 + Math.random() * 0.6;
        puff.vz = (Math.random() - 0.5) * 0.45;
        puff.mesh.position.set(
          VOLCANO.CALDERA_CX + (Math.random() - 0.5) * 1.4,
          VOLCANO.CRATER_TOP_Y + 0.55,
          VOLCANO.CALDERA_CZ + (Math.random() - 0.5) * 1.4
        );
        puff.mesh.scale.setScalar(1.8);
        puff.mesh.visible = true;
        break;
      }
    }
  };

  const updateFrame = (nowMs: number) => {
    const rawDt = (nowMs - lastTimeMs) * 0.001;
    lastTimeMs = nowMs;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    elapsedTime += dt;

    // Animated sea caustics & shoreline surf
    textures.seaDiffuse.offset.x = (textures.seaDiffuse.offset.x + dt * 0.018) % 1;
    textures.seaDiffuse.offset.y = (textures.seaDiffuse.offset.y + dt * 0.012) % 1;
    textures.seaBump.offset.x = (textures.seaBump.offset.x - dt * 0.013) % 1;
    textures.seaBump.offset.y = (textures.seaBump.offset.y + dt * 0.015) % 1;

    const foamPulse = 1 + Math.sin(elapsedTime * 2.0) * 0.014;
    for (const mesh of foamMeshes) {
      mesh.scale.set(foamPulse, 1, foamPulse);
    }
    const rippleScale = 1 + Math.sin(elapsedTime * 1.6 + 1.2) * 0.022;
    const rippleAlpha = 0.22 + 0.14 * (0.5 + 0.5 * Math.sin(elapsedTime * 1.6));
    for (const mesh of rippleMeshes) {
      mesh.scale.set(rippleScale, 1, rippleScale);
      (mesh.material as THREE.MeshBasicMaterial).opacity = rippleAlpha;
    }

    // Animate weird landmarks (Obelisk float/spin, Lava pulse, Fireflies drift, Volcano steam)
    if (obeliskCrystal) {
      obeliskCrystal.rotation.y += dt * 0.85;
      obeliskCrystal.position.y = 2.65 + Math.sin(elapsedTime * 2.1) * 0.22;
    }
    if (obeliskHalo) {
      obeliskHalo.rotation.z -= dt * 1.1;
      obeliskHalo.scale.setScalar(1 + Math.sin(elapsedTime * 2.6) * 0.06);
    }
    if (lavaPoolMesh) {
      const m = lavaPoolMesh.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.8 + Math.sin(elapsedTime * 3.2) * 0.22;
    }
    if (beaconFlameMesh) {
      const m = beaconFlameMesh.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.85 + Math.sin(elapsedTime * 5.0) * 0.25;
      beaconFlameMesh.scale.setScalar(1 + Math.sin(elapsedTime * 6.5) * 0.07);
    }
    if (fireflyGroup) {
      fireflyGroup.rotation.y += dt * 0.25;
      fireflyGroup.position.y = CONFIG.ISLAND.MUSHROOM.GROVE_TOP_Y + 1.2 + Math.sin(elapsedTime * 1.8) * 0.18;
    }

    steamTimer += dt;
    if (steamTimer >= 0.35) {
      steamTimer = 0;
      spawnVolcanoSteam();
    }

    const updateParticles = (pool: FloatingParticle[]) => {
      for (const p of pool) {
        if (!p.active) continue;
        p.age += dt;
        const t = p.age / p.life;
        if (t >= 1) {
          p.active = false;
          p.mesh.visible = false;
        } else {
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.mesh.scale.setScalar(Math.max(0.05, p.baseScale * (1 - t)));
        }
      }
    };
    updateParticles(dustPool);
    updateParticles(steamPool);

    if (screenState === 'playing') {
      let moveX = joystickInput.dx;
      let moveZ = joystickInput.dy;

      if (activeKeys.has('KeyA') || activeKeys.has('ArrowLeft')) moveX -= 1;
      if (activeKeys.has('KeyD') || activeKeys.has('ArrowRight')) moveX += 1;
      if (activeKeys.has('KeyW') || activeKeys.has('ArrowUp')) moveZ -= 1;
      if (activeKeys.has('KeyS') || activeKeys.has('ArrowDown')) moveZ += 1;

      const mag = Math.hypot(moveX, moveZ);
      if (mag > 1) {
        moveX /= mag;
        moveZ /= mag;
      }

      const nextPos = stepPlayerPhysics(
        { x: playerState.x, z: playerState.z },
        moveX,
        moveZ,
        dt,
        worldData
      );
      playerState.x = nextPos.x;
      playerState.y = nextPos.y;
      playerState.z = nextPos.z;

      survivor.root.position.set(playerState.x, playerState.y, playerState.z);

      const nextBiome = detectBiomeAt(playerState.x, playerState.z, worldData);
      if (nextBiome !== currentBiome) {
        currentBiome = nextBiome;
        emitHud(nextBiome);
      }

      if (nextPos.moved && mag > 0.05) {
        const targetYaw = Math.atan2(moveX, moveZ);
        let diff = targetYaw - playerState.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turnFactor = 1 - Math.exp(-CONFIG.PLAYER.TURN_DAMP * dt);
        playerState.yaw += diff * turnFactor;
        survivor.root.rotation.y = playerState.yaw;

        playerState.walkPhase += dt * CONFIG.PLAYER.WALK_CYCLE_SPEED * Math.min(1, mag);
        const swing = Math.sin(playerState.walkPhase);
        const bounce = Math.abs(Math.sin(playerState.walkPhase)) * 0.095;

        survivor.leftLeg.rotation.x = swing * 0.72;
        survivor.rightLeg.rotation.x = -swing * 0.72;
        survivor.leftArm.rotation.x = -swing * 0.65;
        survivor.rightArm.rotation.x = swing * 0.65;
        survivor.bodyPivot.position.y = bounce;
        survivor.bodyPivot.rotation.z = Math.cos(playerState.walkPhase) * 0.055;
        survivor.headGroup.rotation.z = -Math.cos(playerState.walkPhase) * 0.045;

        dustTimer += dt;
        if (dustTimer >= 0.14) {
          dustTimer = 0;
          spawnDustPuff(
            playerState.x - Math.sin(playerState.yaw) * 0.2,
            playerState.y,
            playerState.z - Math.cos(playerState.yaw) * 0.2
          );
        }
      } else {
        const idleDecay = 1 - Math.exp(-12 * dt);
        survivor.leftLeg.rotation.x *= 1 - idleDecay;
        survivor.rightLeg.rotation.x *= 1 - idleDecay;
        survivor.leftArm.rotation.x *= 1 - idleDecay;
        survivor.rightArm.rotation.x *= 1 - idleDecay;
        survivor.bodyPivot.rotation.z *= 1 - idleDecay;
        survivor.headGroup.rotation.z *= 1 - idleDecay;
        survivor.bodyPivot.position.y = Math.sin(elapsedTime * 3.1) * 0.025;
      }

      targetLookAt.set(playerState.x, playerState.y + CONFIG.CAMERA.LOOK_HEIGHT, playerState.z);
      const followAlpha = 1 - Math.exp(-CONFIG.CAMERA.FOLLOW_DAMP * dt);
      camLookAt.lerp(targetLookAt, followAlpha);
      desiredCamPos.set(
        camLookAt.x,
        camLookAt.y + camHeightOffset,
        camLookAt.z + camDepthOffset
      );
      camera.position.copy(desiredCamPos);
      camera.lookAt(camLookAt);
    } else {
      const orbitAngle = elapsedTime * CONFIG.CAMERA.TITLE_ORBIT_SPEED;
      const orbitDist = CONFIG.CAMERA.TITLE_DISTANCE;
      const orbitHeight = Math.sin(pitchRad) * orbitDist;
      const orbitHoriz = Math.cos(pitchRad) * orbitDist;
      targetLookAt.set(0, 1.2, 0);
      camera.position.set(
        Math.sin(orbitAngle) * orbitHoriz * 0.55,
        orbitHeight,
        Math.cos(orbitAngle) * orbitHoriz
      );
      camera.lookAt(targetLookAt);

      survivor.bodyPivot.position.y = Math.sin(elapsedTime * 3.1) * 0.028;
    }

    if (!isSoftwareGl) {
      sunLight.position.set(playerState.x + 18, 26, playerState.z + 12);
      sunLight.target.position.set(playerState.x, playerState.y, playerState.z);
      sunLight.target.updateMatrixWorld();
    }

    renderer.render(scene, camera);
  };

  const afterDraw = (cb: () => void) => {
    const gl2 = rawGl as WebGL2RenderingContext;
    const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
    rawGl.flush();
    if (!sync) {
      setTimeout(cb, 80);
      return;
    }
    const wait = () => {
      if (disposed) return;
      const status = gl2.clientWaitSync(sync, 0, 0);
      if (status === gl2.TIMEOUT_EXPIRED) {
        setTimeout(wait, 10);
      } else {
        gl2.deleteSync(sync);
        cb();
      }
    };
    setTimeout(wait, 80);
  };

  const loop = () => {
    if (disposed) return;
    updateFrame(performance.now());
    if (isSoftwareGl && typeof (rawGl as WebGL2RenderingContext).fenceSync === 'function') {
      afterDraw(loop);
    } else {
      rafId = requestAnimationFrame(loop);
    }
  };

  updateFrame(performance.now());
  if (isSoftwareGl && typeof (rawGl as WebGL2RenderingContext).fenceSync === 'function') {
    afterDraw(loop);
  } else {
    rafId = requestAnimationFrame(loop);
  }

  return {
    startRun: (mode: GameMode, forceNewIsland = false) => {
      currentMode = mode;
      if (mode === 'normal' && forceNewIsland) {
        resetNormalSeed();
      }
      const nextSeed = getSeedForMode(mode);
      if (nextSeed !== currentSeed) {
        loadSeedWorld(nextSeed);
      } else {
        resetPlayerToSpawn();
      }
      screenState = 'playing';
      emitHud('center');
      callbacks.onScreenChange('playing', { mode: currentMode, seed: currentSeed });
    },
    returnToMenu: () => {
      screenState = 'title';
      joystickInput.dx = 0;
      joystickInput.dy = 0;
      callbacks.onScreenChange('title', { mode: currentMode, seed: currentSeed });
    },
    setJoystickInput: (dx: number, dy: number) => {
      joystickInput.dx = dx;
      joystickInput.dy = dy;
    },
    destroy: () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      disposeIslandMeshes();
      natureTreeAssets?.dispose();
      natureTreeAssets = null;
      for (const item of disposables) {
        item.dispose();
      }
      renderer.dispose();
    },
  };
}
