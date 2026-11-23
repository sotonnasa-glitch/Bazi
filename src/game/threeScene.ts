import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CONFIG,
  type AppScreenState,
  type BiomeId,
  type CampUpgradeId,
  type GameMode,
  type SkillId,
  type StrangeLandmarkId,
} from './config';
import {
  buildSculptedAnimalRig,
  createAnimalGeometryLibrary,
  type AnimalVisualRig,
} from './animalModels';
import {
  buildAxeToolGeometry,
  buildBananaBunchGeometry,
  buildBananaCanopyGeometry,
  buildBananaItemGeometry,
  buildBananaTrunkGeometry,
  buildBanyanCanopyGeometry,
  buildBanyanTrunkGeometry,
  buildCampShelterGeometry,
  buildCampfireLogsGeometry,
  buildCanopyBlossomsGeometry,
  buildCoastalReedGeometry,
  buildCoconutClusterGeometry,
  buildCrystalClusterGeometry,
  buildCurvedBoatHullGeometry,
  buildCurvedGullWingGeometry,
  buildCurvedPalmTrunkGeometry,
  buildFernTuftGeometry,
  buildFishGeometry,
  buildFishingPierGeometry,
  buildFishingRodPoleGeometry,
  buildFlameTongueGeometry,
  buildGrassClumpGeometry,
  buildJungleCanopyGeometry,
  buildJungleTrunkGeometry,
  buildOrganicBasaltCragGeometry,
  buildPalmCanopyGeometry,
  buildPineCanopyGeometry,
  buildPineTrunkGeometry,
  buildRoundedChestGeometry,
  buildSculptedBoulderGeometry,
  buildSculptedStoneSlabGeometry,
  buildSculptedSunCrystalGeometry,
  buildSeashellGeometry,
  buildSpearToolGeometry,
  buildStorageRackGeometry,
  buildTinyMushroomGeometry,
  buildTreeStumpGeometry,
  buildWeatheredBarrelGeometry,
  buildWeatheredRuinsPillarGeometry,
  buildWildflowerGeometry,
  buildWillowCanopyGeometry,
  buildWillowTrunkGeometry,
  buildWoodLogGeometry,
} from './sculptGeometry';
import {
  activateLandmarkPower,
  craftSpear,
  createSurvivalState,
  eatBestFoodFromInventory,
  getPlayerSpeedScale,
  getSurvivalHudView,
  stepSurvivalSystem,
  stokeCampfire,
  upgradeSkill,
  type ResourceKind,
  type SurvivalHudView,
  type SurvivalState,
} from './survival';
import { getAnimalSpecies } from './wildlife';
import { createProceduralTextureSet } from './textures';
import { createSeededRandom, getSeedForMode, resetNormalSeed } from './utils';
import {
  computeTerrainVertexColor,
  detectBiomeAt,
  generateIslandWorld,
  groundHeightAt,
  stepPlayerPhysics,
  type IslandProp,
  type IslandWorldData,
} from './world';

export interface ActiveRunInfo {
  mode: GameMode;
  seed: string;
}

export type HudSnapshot = SurvivalHudView;

export interface FlyingResourceEvent {
  id: number;
  kind: ResourceKind | 'cookedFish' | 'roastedBanana' | 'coin';
  startX: number;
  startY: number;
}

export interface ThreeSceneCallbacks {
  onScreenChange: (screen: AppScreenState, runInfo?: ActiveRunInfo) => void;
  onHudUpdate: (hud: HudSnapshot) => void;
  onResourceFly?: (event: FlyingResourceEvent) => void;
  onNotice?: (text: string) => void;
}

export interface ThreeIslandController {
  startRun: (mode: GameMode, forceNewIsland?: boolean) => void;
  returnToMenu: () => void;
  setJoystickInput: (dx: number, dy: number) => void;
  eatFood: () => boolean;
  craftSpear: () => boolean;
  stokeFire: () => boolean;
  upgradeSkill: (skillId: SkillId) => boolean;
  triggerLandmark: (id: StrangeLandmarkId) => { triggered: boolean; label: string };
  destroy: () => void;
}

function buildSkyDome(): { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; dispose: () => void } {
  const geo = new THREE.SphereGeometry(420, 28, 18);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(CONFIG.COLORS.SKY_ZENITH) },
      horizonColor: { value: new THREE.Color(CONFIG.COLORS.SKY_HORIZON) },
      sunDir: { value: new THREE.Vector3(0.55, 0.55, 0.4).normalize() },
      starMix: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vDir = normalize(worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 sunDir;
      uniform float starMix;
      uniform float uTime;
      varying vec3 vDir;

      float starHash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 dir = normalize(vDir);
        float h = max(dir.y, 0.0);
        float t = smoothstep(0.0, 0.58, h);
        vec3 sky = mix(horizonColor, topColor, t);
        float sunAmt = max(dot(dir, sunDir), 0.0);
        sky += vec3(1.0, 0.92, 0.72) * pow(sunAmt, 14.0) * (1.0 - starMix * 0.75) * 0.32;

        if (starMix > 0.02 && dir.y > 0.04) {
          vec3 grid = floor(dir * 95.0);
          float n = starHash(grid);
          if (n > 0.978) {
            float twinkle = 0.65 + 0.35 * sin(uTime * 3.2 + n * 120.0);
            sky += vec3(0.85, 0.94, 1.0) * starMix * twinkle * smoothstep(0.04, 0.25, dir.y);
          }
        }
        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return {
    mesh,
    mat,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

function buildOceanDepthTexture(world: IslandWorldData): THREE.DataTexture {
  const N = 192;
  const data = new Uint8Array(N * N * 4);
  const size = CONFIG.WORLD.TERRAIN_SIZE;

  for (let iz = 0; iz < N; iz += 1) {
    const wz = (iz / (N - 1) - 0.5) * size;
    for (let ix = 0; ix < N; ix += 1) {
      const wx = (ix / (N - 1) - 0.5) * size;
      const h = groundHeightAt(wx, wz, world);
      const norm = THREE.MathUtils.clamp((h + 3.5) / 8.0, 0, 1);
      const val = Math.round(norm * 255);
      const idx = (iz * N + ix) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

interface BackStackSlot {
  group: THREE.Group;
  wood: THREE.Mesh;
  fish: THREE.Mesh;
  berries: THREE.Mesh;
  shell: THREE.Mesh;
  banana: THREE.Mesh;
}

interface SurvivorRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  axeMesh: THREE.Mesh;
  spearMesh: THREE.Mesh;
  fireSpearMesh: THREE.Mesh;
  rodGroup: THREE.Group;
  rodTipLocal: THREE.Vector3;
  backStackSlots: BackStackSlot[];
  dispose: () => void;
}

function buildCartoonSurvivor(
  clayMat: (color: number, roughness?: number) => THREE.MeshStandardMaterial,
  shadowMat: THREE.MeshBasicMaterial,
  stackGeos: {
    woodGeo: THREE.BufferGeometry;
    fishGeo: THREE.BufferGeometry;
    berryGeo: THREE.BufferGeometry;
    shellGeo: THREE.BufferGeometry;
    bananaGeo: THREE.BufferGeometry;
    stackMat: THREE.MeshStandardMaterial;
    berryMat: THREE.MeshStandardMaterial;
  }
): SurvivorRig {
  const root = new THREE.Group();
  const rigDisposables: Array<{ dispose: () => void }> = [];

  const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 22), shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.03;
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
  rigDisposables.push(eyeMat, eyeHighlightMat);

  const buildLeg = (xOffset: number): THREE.Group => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOffset, 0.45, 0);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.14, 5, 10), shortsMat);
    thigh.position.y = -0.1;
    thigh.castShadow = true;
    legPivot.add(thigh);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.1, 4, 10), skinMat);
    shin.position.y = -0.25;
    legPivot.add(shin);

    const boot = new THREE.Mesh(new THREE.SphereGeometry(0.118, 12, 10), bootsMat);
    boot.scale.set(1, 0.78, 1.32);
    boot.position.set(0, -0.36, 0.04);
    boot.castShadow = true;
    legPivot.add(boot);

    return legPivot;
  };

  const leftLeg = buildLeg(-0.14);
  const rightLeg = buildLeg(0.14);
  bodyPivot.add(leftLeg, rightLeg);

  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10), shortsMat);
  pelvis.scale.set(1.04, 0.72, 0.96);
  pelvis.position.y = 0.5;
  pelvis.castShadow = true;
  bodyPivot.add(pelvis);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.245, 0.28, 6, 14), shirtMat);
  torso.scale.set(1.04, 1, 0.94);
  torso.position.y = 0.78;
  torso.castShadow = true;
  bodyPivot.add(torso);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 8, 16), clayMat(0xffffff, 0.8));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.01;
  bodyPivot.add(collar);

  // Soft sculpted clay explorer backpack (zero BoxGeometry!)
  const packGeo = buildSculptedBoulderGeometry(0.24, 3.1, false);
  packGeo.scale(1.02, 1.08, 0.72);
  const pack = new THREE.Mesh(packGeo, packMat);
  pack.position.set(0, 0.78, -0.24);
  pack.castShadow = true;
  bodyPivot.add(pack);

  const bedroll = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.26, 5, 10), capMat);
  bedroll.rotation.z = Math.PI / 2;
  bedroll.position.set(0, 1.02, -0.24);
  bedroll.castShadow = true;
  bodyPivot.add(bedroll);

  // 3D Back Stack Group: carried wood logs, fish, berries & shells visually stack on the explorer's back!
  const backStackGroup = new THREE.Group();
  backStackGroup.position.set(0, 0.64, -0.44);
  bodyPivot.add(backStackGroup);

  const backStackSlots: BackStackSlot[] = [];
  for (let i = 0; i < 32; i += 1) {
    const slotGroup = new THREE.Group();
    const row = Math.floor(i / 2);
    const col = i % 2;
    slotGroup.position.set((col - 0.5) * 0.22, row * 0.13, -(row % 2) * 0.03);
    slotGroup.rotation.y = (col === 0 ? 0.08 : -0.08) + (row % 2) * 0.05;
    slotGroup.visible = false;

    const wood = new THREE.Mesh(stackGeos.woodGeo, stackGeos.stackMat);
    wood.scale.setScalar(0.85);
    wood.visible = false;

    const fish = new THREE.Mesh(stackGeos.fishGeo, stackGeos.stackMat);
    fish.rotation.y = Math.PI * 0.5;
    fish.scale.setScalar(0.75);
    fish.visible = false;

    const berries = new THREE.Mesh(stackGeos.berryGeo, stackGeos.berryMat);
    berries.scale.setScalar(1.25);
    berries.visible = false;

    const shell = new THREE.Mesh(stackGeos.shellGeo, stackGeos.stackMat);
    shell.rotation.x = Math.PI * 0.45;
    shell.scale.setScalar(0.65);
    shell.visible = false;

    const banana = new THREE.Mesh(stackGeos.bananaGeo, stackGeos.stackMat);
    banana.scale.setScalar(1.1);
    banana.visible = false;

    slotGroup.add(wood, fish, berries, shell, banana);
    backStackGroup.add(slotGroup);
    backStackSlots.push({ group: slotGroup, wood, fish, berries, shell, banana });
  }

  const buildArm = (xOffset: number): THREE.Group => {
    const armPivot = new THREE.Group();
    armPivot.position.set(xOffset, 0.94, 0);

    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.14, 5, 10), shirtMat);
    sleeve.position.y = -0.11;
    sleeve.castShadow = true;
    armPivot.add(sleeve);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.092, 10, 8), skinMat);
    hand.position.y = -0.25;
    hand.castShadow = true;
    armPivot.add(hand);

    return armPivot;
  };

  const leftArm = buildArm(-0.32);
  const rightArm = buildArm(0.32);
  bodyPivot.add(leftArm, rightArm);

  // Equipable 3D Chopping Axe, Fishing Spear, Fire Spear & Fishing Rod attached to right hand
  const toolMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0.12,
    vertexColors: true,
  });
  const axeGeo = buildAxeToolGeometry();
  const spearGeo = buildSpearToolGeometry(false);
  const fireSpearGeo = buildSpearToolGeometry(true);
  const rodGeo = buildFishingRodPoleGeometry();
  rigDisposables.push(toolMat, axeGeo, spearGeo, fireSpearGeo, rodGeo, packGeo);

  const axeMesh = new THREE.Mesh(axeGeo, toolMat);
  axeMesh.position.set(0, -0.24, 0.05);
  axeMesh.rotation.x = Math.PI * 0.42;
  axeMesh.castShadow = true;
  axeMesh.visible = false;
  rightArm.add(axeMesh);

  const spearMesh = new THREE.Mesh(spearGeo, toolMat);
  spearMesh.position.set(0, -0.24, 0.05);
  spearMesh.rotation.x = Math.PI * 0.48;
  spearMesh.castShadow = true;
  spearMesh.visible = false;
  rightArm.add(spearMesh);

  const fireSpearMesh = new THREE.Mesh(fireSpearGeo, toolMat);
  fireSpearMesh.position.set(0, -0.24, 0.05);
  fireSpearMesh.rotation.x = Math.PI * 0.48;
  fireSpearMesh.castShadow = true;
  fireSpearMesh.visible = false;
  rightArm.add(fireSpearMesh);

  const rodGroup = new THREE.Group();
  rodGroup.position.set(0, -0.24, 0.05);
  rodGroup.rotation.x = Math.PI * 0.28;
  rodGroup.visible = false;
  const rodPole = new THREE.Mesh(rodGeo, toolMat);
  rodPole.castShadow = true;
  rodGroup.add(rodPole);
  rightArm.add(rodGroup);

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

  const capVisor = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8), capMat);
  capVisor.scale.set(1.12, 0.22, 0.95);
  capVisor.position.set(0, 0.21, 0.24);
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

    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), cheekMat);
    cheek.scale.set(1.2, 0.72, 0.55);
    cheek.position.set(side * 0.19, -0.05, 0.26);
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
    axeMesh,
    spearMesh,
    fireSpearMesh,
    rodGroup,
    rodTipLocal: new THREE.Vector3(0, 1.48, 0.86),
    backStackSlots,
    dispose: () => {
      for (const d of rigDisposables) d.dispose();
    },
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

interface FlyingPropArc {
  mesh: THREE.Mesh;
  active: boolean;
  age: number;
  duration: number;
  start: THREE.Vector3;
}

interface InstancedTreeBinding {
  instMesh: THREE.InstancedMesh;
  extraMeshes: THREE.InstancedMesh[];
  shadowMesh: THREE.InstancedMesh;
  stumpMesh: THREE.InstancedMesh;
  stumpIndex: number;
  index: number;
  prop: IslandProp;
  wobble: number;
  fallDirAngle: number;
  dirty: boolean;
}

export function createThreeIslandGame(
  container: HTMLElement,
  callbacks: ThreeSceneCallbacks,
  initialMode: GameMode = 'normal',
  autostart = false
): ThreeIslandController {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  const gl = renderer.getContext();
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const glRendererStr = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : '';
  const isSoftwareGl = /SwiftShader|llvmpipe|Software/i.test(glRendererStr);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.RENDER.MAX_PIXEL_RATIO));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.COLORS.SKY_HORIZON);
  scene.fog = new THREE.FogExp2(CONFIG.COLORS.FOG, CONFIG.RENDER.FOG_DENSITY);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.36;

  const skyDome = buildSkyDome();
  scene.add(skyDome.mesh);

  const camera = new THREE.PerspectiveCamera(CONFIG.CAMERA.FOV_DEG, width / height, 0.5, 560);

  const hemiLight = new THREE.HemisphereLight(0xdef5ff, 0x769a5c, 0.86);
  scene.add(hemiLight);

  const fillLight = new THREE.DirectionalLight(0xa3e2ff, 0.4);
  fillLight.position.set(-28, 18, -22);
  scene.add(fillLight);

  const sunLight = new THREE.DirectionalLight(0xfff1d4, 1.85);
  sunLight.position.set(22, 30, 14);
  sunLight.castShadow = !isSoftwareGl;
  sunLight.shadow.mapSize.set(CONFIG.RENDER.SHADOW_MAP_SIZE, CONFIG.RENDER.SHADOW_MAP_SIZE);
  const frustum = CONFIG.RENDER.SHADOW_FRUSTUM_HALF;
  sunLight.shadow.camera.left = -frustum;
  sunLight.shadow.camera.right = frustum;
  sunLight.shadow.camera.top = frustum;
  sunLight.shadow.camera.bottom = -frustum;
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 96;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.035;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Glowing Moon Orb & Warm Campfire Point Light (1 dynamic unshadowed PointLight within Three.js budget!)
  const moonOrbGeo = new THREE.SphereGeometry(7.5, 16, 12);
  const moonOrbMat = new THREE.MeshBasicMaterial({ color: 0xe6f2ff });
  const moonOrb = new THREE.Mesh(moonOrbGeo, moonOrbMat);
  scene.add(moonOrb);

  const campPointLight = new THREE.PointLight(0xff8c32, 2.2, 24, 1.4);
  campPointLight.position.set(CONFIG.ISLAND.CAMPFIRE.CX, 3.2, CONFIG.ISLAND.CAMPFIRE.CZ);
  scene.add(campPointLight);

  // 3D Instanced Rain Streaks for Weather System
  const rainCount = 220;
  const rainDropGeo = new THREE.CapsuleGeometry(0.016, 0.42, 3, 5);
  const rainDropMat = new THREE.MeshBasicMaterial({
    color: 0xd4f0ff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const rainInst = new THREE.InstancedMesh(rainDropGeo, rainDropMat, rainCount);
  rainInst.frustumCulled = false;
  rainInst.visible = false;
  scene.add(rainInst);
  const rainOffsets: Array<{ x: number; y: number; z: number; spd: number }> = [];
  for (let i = 0; i < rainCount; i += 1) {
    rainOffsets.push({
      x: ((Math.sin(i * 19.3) * 0.5) * 44),
      y: ((i * 0.37) % 1) * 18,
      z: ((Math.cos(i * 27.7) * 0.5) * 38),
      spd: 17 + (i % 5) * 2.2,
    });
  }
  const rainDummy = new THREE.Object3D();

  const textures = createProceduralTextureSet();
  const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  textures.terrainDetailDiffuse.anisotropy = maxAniso;
  textures.terrainDetailBump.anisotropy = maxAniso;

  const disposables: Array<{ dispose: () => void }> = [
    pmrem,
    envTex,
    skyDome,
    moonOrbGeo,
    moonOrbMat,
    rainDropGeo,
    rainDropMat,
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
    color: 0x0f2e18,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  disposables.push(shadowDiscMat);

  // GPU Ocean Shader
  let heightTex: THREE.DataTexture | null = null;
  const oceanMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uHeightTex: { value: null },
      uTerrainSize: { value: CONFIG.WORLD.TERRAIN_SIZE },
      uDeepColor: { value: new THREE.Color(CONFIG.COLORS.SEA_DEEP) },
      uShallowColor: { value: new THREE.Color(CONFIG.COLORS.SEA_SHALLOW) },
      uFoamColor: { value: new THREE.Color(CONFIG.COLORS.SEA_FOAM) },
      uFogColor: { value: new THREE.Color(CONFIG.COLORS.FOG) },
      uFogDensity: { value: CONFIG.RENDER.FOG_DENSITY },
      uSunDir: { value: new THREE.Vector3(0.55, 0.65, 0.35).normalize() },
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
      uniform float uTime;
      uniform sampler2D uHeightTex;
      uniform float uTerrainSize;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uFoamColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform vec3 uSunDir;
      varying vec3 vWorldPos;

      float wavePattern(vec2 p, float t) {
        float w1 = sin(p.x * 0.55 + t * 1.3 + sin(p.y * 0.42 - t * 0.8));
        float w2 = cos(p.y * 0.65 - t * 1.1 + sin(p.x * 0.38 + t * 0.9));
        return (w1 + w2) * 0.5;
      }

      void main() {
        vec2 uv = vWorldPos.xz / uTerrainSize + 0.5;
        float terrainH = -3.5;
        if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
          terrainH = texture2D(uHeightTex, uv).r * 8.0 - 3.5;
        }
        float waterDepth = max(0.0, -terrainH);

        float shallowMask = exp(-waterDepth * 0.82);
        vec3 col = mix(uDeepColor, uShallowColor, shallowMask);

        float ripple = wavePattern(vWorldPos.xz * 1.1, uTime);
        float caustic = smoothstep(0.35, 0.92, wavePattern(vWorldPos.xz * 0.72 + vec2(uTime * 0.25, -uTime * 0.18), uTime * 1.2));
        col += vec3(0.09, 0.2, 0.22) * caustic * (0.35 + 0.65 * shallowMask);

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 waveN = normalize(vec3(ripple * 0.06, 1.0, wavePattern(vWorldPos.xz * 1.3 + 4.2, -uTime) * 0.06));
        vec3 halfVec = normalize(uSunDir + viewDir);
        float spec = pow(max(dot(waveN, halfVec), 0.0), 42.0);
        col += vec3(1.0, 0.96, 0.86) * spec * 0.45;

        float foamZone = 1.0 - smoothstep(0.02, 0.92, waterDepth);
        float surfWave = sin(waterDepth * 19.0 - uTime * 2.5 + ripple * 1.8);
        float shoreLine = 1.0 - smoothstep(0.0, 0.19, waterDepth);
        float foamAmt = clamp(shoreLine * 0.88 + foamZone * smoothstep(0.35, 0.85, surfWave) * 0.65, 0.0, 1.0);
        col = mix(col, uFoamColor, foamAmt * 0.88);

        float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
        col = mix(col, uFogColor, fresnel * 0.35);

        float dist = length(cameraPosition - vWorldPos);
        float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
        col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

        float alpha = mix(0.95, 0.72, shallowMask * (1.0 - foamAmt * 0.5));
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const oceanGeo = new THREE.PlaneGeometry(860, 860);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.position.y = 0.0;
  oceanMesh.renderOrder = 1;
  scene.add(oceanMesh);
  disposables.push(oceanMat, oceanGeo);

  // Drifting stylized puffy clouds & sculpted curved-wing seagulls
  const cloudGroup = new THREE.Group();
  const cloudPuffGeo = new THREE.SphereGeometry(2.6, 10, 8);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0,
    transparent: true,
    opacity: 0.92,
  });
  disposables.push(cloudPuffGeo, cloudMat);
  for (let i = 0; i < 12; i += 1) {
    const cg = new THREE.Group();
    const a = (i / 12) * Math.PI * 2;
    const r = 72 + (i % 3) * 28;
    cg.position.set(Math.cos(a) * r, 26 + (i % 4) * 3.2, Math.sin(a) * r);
    cg.rotation.y = a;
    cg.scale.set(1.3, 0.55, 0.95);
    const puffs = [
      [0, 0, 0, 1.15],
      [-2.1, -0.3, 0.4, 0.85],
      [2.2, -0.25, -0.3, 0.9],
      [0.4, 0.35, 1.3, 0.72],
    ];
    for (const [px, py, pz, ps] of puffs) {
      const m = new THREE.Mesh(cloudPuffGeo, cloudMat);
      m.position.set(px, py, pz);
      m.scale.setScalar(ps);
      cg.add(m);
    }
    cloudGroup.add(cg);
  }
  scene.add(cloudGroup);

  const birdGroup = new THREE.Group();
  const gullBodyGeo = new THREE.CapsuleGeometry(0.075, 0.22, 4, 6);
  gullBodyGeo.rotateX(Math.PI / 2);
  const wingGeo = buildCurvedGullWingGeometry();
  const birdMat = new THREE.MeshBasicMaterial({ color: 0xfffaf0, side: THREE.DoubleSide });
  disposables.push(gullBodyGeo, wingGeo, birdMat);
  for (let i = 0; i < 6; i += 1) {
    const bg = new THREE.Group();
    const a = (i / 6) * Math.PI * 2;
    const r = 24 + (i % 3) * 14;
    bg.position.set(Math.cos(a) * r, 15 + (i % 2) * 2.5, Math.sin(a) * r);
    bg.rotation.y = -a;
    const wl = new THREE.Mesh(wingGeo, birdMat);
    wl.scale.x = -1;
    wl.rotation.z = 0.28;
    const wr = new THREE.Mesh(wingGeo, birdMat);
    wr.rotation.z = -0.28;
    const body = new THREE.Mesh(gullBodyGeo, birdMat);
    bg.add(wl, wr, body);
    birdGroup.add(bg);
  }
  scene.add(birdGroup);

  const islandGroup = new THREE.Group();
  scene.add(islandGroup);

  // Harvest Ring Indicator (tracks player's active auto-harvest target!)
  const harvestRingMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uProgress: { value: 0 },
      uColor: { value: new THREE.Color(0xffe14d) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uProgress;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float r = length(vUv);
        float ring = smoothstep(0.62, 0.72, r) * (1.0 - smoothstep(0.9, 1.0, r));
        float angle = (atan(vUv.y, vUv.x) + 3.14159265) / 6.2831853;
        float fill = step(angle, clamp(uProgress, 0.0, 1.0));
        vec3 col = mix(vec3(1.0), uColor, fill);
        float alpha = ring * mix(0.28, 0.95, fill);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const harvestRingGeo = new THREE.PlaneGeometry(2.8, 2.8);
  harvestRingGeo.rotateX(-Math.PI / 2);
  const harvestRingMesh = new THREE.Mesh(harvestRingGeo, harvestRingMat);
  harvestRingMesh.visible = false;
  harvestRingMesh.renderOrder = 3;
  scene.add(harvestRingMesh);
  disposables.push(harvestRingGeo, harvestRingMat);

  let obeliskCrystal: THREE.Mesh | null = null;
  let obeliskHalo: THREE.Mesh | null = null;
  let lavaPoolMesh: THREE.Mesh | null = null;
  let springWaterMesh: THREE.Mesh | null = null;
  let beaconFlameMesh: THREE.Mesh | null = null;
  let fireflyGroup: THREE.Group | null = null;
  let campFlames: THREE.Mesh[] = [];
  let campAuraRing: THREE.Mesh | null = null;
  let windUniformTime: { value: number } | null = null;
  let islandDisposables: Array<{ dispose: () => void }> = [];

  // Interactive harvest, fishing, shell & camp build pad visual bindings
  const bushNodeVisuals = new Map<string, { group: THREE.Group; berries: THREE.Mesh[]; baseScale: number }>();
  const shellNodeVisuals = new Map<string, { mesh: THREE.Mesh; baseScale: number }>();
  const fishingVisuals = new Map<string, { fishA: THREE.Mesh; fishB: THREE.Mesh; ripple: THREE.Mesh; waterX: number; waterZ: number }>();
  const buildPadVisuals = new Map<CampUpgradeId, { padGroup: THREE.Group; builtGroup: THREE.Group; popAge: number }>();
  const landmarkRingVisuals = new Map<StrangeLandmarkId, THREE.Mesh>();
  const treeNodeVisuals = new Map<string, InstancedTreeBinding>();
  const bananaBunchVisuals = new Map<string, { trunkMesh: THREE.InstancedMesh; canopyMesh: THREE.InstancedMesh; bunchMesh: THREE.InstancedMesh; index: number; prop: IslandProp }>();
  const animalGeoLib = createAnimalGeometryLibrary();
  const animalRigBindings = new Map<string, AnimalVisualRig>();
  let campRoastGroup: THREE.Group | null = null;
  let campRoastFish: THREE.Mesh | null = null;
  let campRoastBanana: THREE.Mesh | null = null;

  // Shared geometries & materials for survivor back-stack + flying 3D item arcs
  const stackWoodGeo = buildWoodLogGeometry(0.085, 0.52);
  const stackFishGeo = buildFishGeometry();
  const stackBerryGeo = new THREE.SphereGeometry(0.09, 8, 7);
  const stackShellGeo = buildSeashellGeometry();
  const stackBananaGeo = buildBananaItemGeometry(1.0);
  const stackVertexMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.04,
    vertexColors: true,
  });
  const stackBerryMat = getPbrMat(CONFIG.COLORS.BERRY_RED, 0.28);
  disposables.push(
    stackWoodGeo,
    stackFishGeo,
    stackBerryGeo,
    stackShellGeo,
    stackBananaGeo,
    stackVertexMat,
    animalGeoLib
  );

  const survivor = buildCartoonSurvivor(
    (color, roughness) => getPbrMat(color, roughness),
    shadowDiscMat,
    {
      woodGeo: stackWoodGeo,
      fishGeo: stackFishGeo,
      berryGeo: stackBerryGeo,
      shellGeo: stackShellGeo,
      bananaGeo: stackBananaGeo,
      stackMat: stackVertexMat,
      berryMat: stackBerryMat,
    }
  );
  scene.add(survivor.root);
  disposables.push(survivor);

  // Fishing bobber & curved fishing line in world space
  const bobberGeo = new THREE.SphereGeometry(0.11, 10, 8);
  const bobberMat = new THREE.MeshStandardMaterial({ color: 0xff3b47, roughness: 0.35 });
  const bobberMesh = new THREE.Mesh(bobberGeo, bobberMat);
  bobberMesh.visible = false;
  scene.add(bobberMesh);

  const linePositions = new Float32Array(12 * 3);
  const fishingLineGeo = new THREE.BufferGeometry();
  fishingLineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  const fishingLineMat = new THREE.LineBasicMaterial({ color: 0xf4fcff, transparent: true, opacity: 0.85 });
  const fishingLine = new THREE.Line(fishingLineGeo, fishingLineMat);
  fishingLine.visible = false;
  scene.add(fishingLine);
  disposables.push(bobberGeo, bobberMat, fishingLineGeo, fishingLineMat);

  // Flying 3D Item Arcs (logs & fish visibly leap into the character's back stack!)
  const flyingArcPool: FlyingPropArc[] = [];
  for (let i = 0; i < 8; i += 1) {
    const mesh = new THREE.Mesh(stackWoodGeo, stackVertexMat);
    mesh.visible = false;
    mesh.castShadow = true;
    scene.add(mesh);
    flyingArcPool.push({ mesh, active: false, age: 0, duration: 0.38, start: new THREE.Vector3() });
  }

  const puffGeo = new THREE.SphereGeometry(0.16, 8, 7);
  const dustMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  const steamMat = new THREE.MeshBasicMaterial({
    color: 0xffe4cc,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  const chipWoodMat = new THREE.MeshBasicMaterial({ color: 0xd99248 });
  const chipLeafMat = new THREE.MeshBasicMaterial({ color: 0x6ce858 });
  const chipWaterMat = new THREE.MeshBasicMaterial({ color: 0x8ef8ff });
  const chipBerryMat = new THREE.MeshBasicMaterial({ color: 0xff4764 });
  const chipShellMat = new THREE.MeshBasicMaterial({ color: 0xffb3c7 });
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xffa62b });
  disposables.push(
    puffGeo,
    dustMat,
    steamMat,
    chipWoodMat,
    chipLeafMat,
    chipWaterMat,
    chipBerryMat,
    chipShellMat,
    emberMat
  );

  const dustPool: FloatingParticle[] = [];
  for (let i = 0; i < 8; i += 1) {
    const mesh = new THREE.Mesh(puffGeo, dustMat);
    mesh.visible = false;
    scene.add(mesh);
    dustPool.push({ mesh, active: false, age: 0, life: 0.36, vx: 0, vy: 0, vz: 0, baseScale: 1 });
  }
  const steamPool: FloatingParticle[] = [];
  for (let i = 0; i < 10; i += 1) {
    const mesh = new THREE.Mesh(puffGeo, steamMat);
    mesh.visible = false;
    scene.add(mesh);
    steamPool.push({ mesh, active: false, age: 0, life: 1.5, vx: 0, vy: 0, vz: 0, baseScale: 2.2 });
  }
  const harvestChipPool: FloatingParticle[] = [];
  for (let i = 0; i < 20; i += 1) {
    const mesh = new THREE.Mesh(puffGeo, chipLeafMat);
    mesh.visible = false;
    scene.add(mesh);
    harvestChipPool.push({ mesh, active: false, age: 0, life: 0.55, vx: 0, vy: 0, vz: 0, baseScale: 0.65 });
  }
  let dustTimer = 0;
  let steamTimer = 0;
  let emberTimer = 0;
  let chopSwingChipCooldown = 0;
  let flyEventSeq = 1;
  let lastStackSignature = '';

  let currentMode: GameMode = initialMode;
  let currentSeed = getSeedForMode(currentMode);
  let worldData: IslandWorldData = generateIslandWorld(currentSeed);
  let survivalState: SurvivalState = createSurvivalState(worldData);
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
    y: 1.9,
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
    bushNodeVisuals.clear();
    shellNodeVisuals.clear();
    fishingVisuals.clear();
    buildPadVisuals.clear();
    landmarkRingVisuals.clear();
    treeNodeVisuals.clear();
    bananaBunchVisuals.clear();
    for (const rig of animalRigBindings.values()) {
      rig.dispose();
    }
    animalRigBindings.clear();
    if (heightTex) {
      heightTex.dispose();
      heightTex = null;
    }
    obeliskCrystal = null;
    obeliskHalo = null;
    lavaPoolMesh = null;
    springWaterMesh = null;
    beaconFlameMesh = null;
    fireflyGroup = null;
    campFlames = [];
    campAuraRing = null;
    campRoastGroup = null;
    campRoastFish = null;
    campRoastBanana = null;
  };

  const buildWeirdLandmarks = (world: IslandWorldData) => {
    const { RUINS, VOLCANO, MUSHROOM, SHIPWRECK, SPRING, CAMPFIRE } = CONFIG.ISLAND;
    const stoneMat = getPbrMat(0xffffff, 0.85, textures.stoneColumnDiffuse, textures.stoneColumnBump, 0.05);
    const stoneDarkMat = getPbrMat(0x5c6672, 0.9);
    const basaltMat = getPbrMat(0x3b3542, 0.92);
    const woodMat = getPbrMat(0xffffff, 0.84, textures.woodDiffuse, textures.woodBump, 0.03);
    const woodDarkMat = getPbrMat(CONFIG.COLORS.WOOD_DARK, 0.88);
    const boneMat = getPbrMat(0xf4ecd8, 0.78);
    const sailMat = getPbrMat(0xfff5e0, 0.9);

    // 0. CENTRAL SURVIVAL CAMPFIRE HAVEN (Stone Ring, Driftwood Logs, Multi-Tongue Flame, Stash Chest)
    const campY = groundHeightAt(CAMPFIRE.CX, CAMPFIRE.CZ, world);
    const campGroup = new THREE.Group();
    campGroup.position.set(CAMPFIRE.CX, campY - 0.04, CAMPFIRE.CZ);

    const campStoneGeo = buildSculptedBoulderGeometry(0.24, 5.2);
    const campLogsGeo = buildCampfireLogsGeometry();
    const campFlameGeo = buildFlameTongueGeometry();
    const campChestGeo = buildRoundedChestGeometry();
    const auraGeo = new THREE.RingGeometry(CAMPFIRE.AURA_RADIUS - 0.22, CAMPFIRE.AURA_RADIUS, 44);
    auraGeo.rotateX(-Math.PI / 2);

    const flameOuterMat = new THREE.MeshStandardMaterial({
      color: 0xff7718,
      emissive: 0xff5a0a,
      emissiveIntensity: 1.3,
      roughness: 0.25,
    });
    const flameInnerMat = new THREE.MeshStandardMaterial({
      color: 0xffe45e,
      emissive: 0xffc425,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xffcf5c,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    islandDisposables.push(
      campStoneGeo,
      campLogsGeo,
      campFlameGeo,
      campChestGeo,
      auraGeo,
      flameOuterMat,
      flameInnerMat,
      auraMat
    );

    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2;
      const st = new THREE.Mesh(campStoneGeo, i % 2 === 0 ? stoneMat : stoneDarkMat);
      st.position.set(Math.cos(a) * 0.82, 0.14, Math.sin(a) * 0.82);
      st.scale.set(1.15, 0.72, 0.95);
      st.rotation.y = a;
      st.castShadow = true;
      campGroup.add(st);
    }

    const logs = new THREE.Mesh(campLogsGeo, woodDarkMat);
    logs.castShadow = true;
    campGroup.add(logs);

    const flameMain = new THREE.Mesh(campFlameGeo, flameOuterMat);
    flameMain.position.y = 0.18;
    flameMain.scale.set(0.95, 1.05, 0.95);
    const flameCore = new THREE.Mesh(campFlameGeo, flameInnerMat);
    flameCore.position.y = 0.22;
    flameCore.scale.set(0.62, 0.78, 0.62);
    const flameSide = new THREE.Mesh(campFlameGeo, flameOuterMat);
    flameSide.position.set(0.14, 0.18, -0.08);
    flameSide.rotation.z = -0.18;
    flameSide.scale.set(0.55, 0.68, 0.55);
    campFlames = [flameMain, flameCore, flameSide];
    campGroup.add(flameMain, flameCore, flameSide);

    const campChest = new THREE.Mesh(campChestGeo, woodMat);
    campChest.position.set(1.25, 0.02, -0.75);
    campChest.rotation.y = -0.55;
    campChest.castShadow = true;
    campGroup.add(campChest);

    campAuraRing = new THREE.Mesh(auraGeo, auraMat);
    campAuraRing.position.y = 0.08;
    campGroup.add(campAuraRing);

    // Roasting Skewer Rack over Campfire Flame (appears when cooking/holding fish!)
    campRoastGroup = new THREE.Group();
    const spitPostGeo = new THREE.CapsuleGeometry(0.038, 0.92, 4, 6);
    const spitBarGeo = new THREE.CapsuleGeometry(0.024, 1.35, 4, 6);
    spitBarGeo.rotateZ(Math.PI / 2);
    islandDisposables.push(spitPostGeo, spitBarGeo);
    const postL = new THREE.Mesh(spitPostGeo, woodDarkMat);
    postL.position.set(-0.62, 0.45, 0);
    const postR = new THREE.Mesh(spitPostGeo, woodDarkMat);
    postR.position.set(0.62, 0.45, 0);
    const crossbar = new THREE.Mesh(spitBarGeo, woodMat);
    crossbar.position.set(0, 0.88, 0);
    campRoastFish = new THREE.Mesh(stackFishGeo, stackVertexMat);
    campRoastFish.position.set(0, 0.86, 0);
    campRoastFish.scale.setScalar(1.35);
    campRoastFish.rotation.y = Math.PI * 0.5;
    campRoastBanana = new THREE.Mesh(stackBananaGeo, stackVertexMat);
    campRoastBanana.position.set(0, 0.86, 0);
    campRoastBanana.scale.setScalar(1.45);
    campRoastBanana.visible = false;
    campRoastGroup.add(postL, postR, crossbar, campRoastFish, campRoastBanana);
    campRoastGroup.visible = false;
    campGroup.add(campRoastGroup);

    islandGroup.add(campGroup);

    // 0B. 3 INTERACTIVE CAMP BUILD PADS (Shelter Hut, Backpack Supply Rack, South Lagoon Fishing Pier)
    const padRingGeo = new THREE.RingGeometry(1.15, 1.45, 32);
    padRingGeo.rotateX(-Math.PI / 2);
    const padMarkerGeo = new THREE.CapsuleGeometry(0.08, 0.72, 4, 7);
    const padRingMat = new THREE.MeshBasicMaterial({
      color: 0x7df5a2,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const builtStructureMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.04,
      vertexColors: true,
    });
    const shelterGeo = buildCampShelterGeometry();
    const rackGeo = buildStorageRackGeometry();
    const pierGeo = buildFishingPierGeometry();
    islandDisposables.push(
      padRingGeo,
      padMarkerGeo,
      padRingMat,
      builtStructureMat,
      shelterGeo,
      rackGeo,
      pierGeo
    );

    for (const pad of world.buildPads) {
      const padGroup = new THREE.Group();
      padGroup.position.set(pad.x, pad.y + 0.05, pad.z);
      padGroup.rotation.y = pad.rotationY;

      const padRing = new THREE.Mesh(padRingGeo, padRingMat);
      const stakeA = new THREE.Mesh(padMarkerGeo, woodMat);
      stakeA.position.set(-0.35, 0.32, 0);
      stakeA.rotation.z = -0.28;
      stakeA.castShadow = true;
      const stakeB = new THREE.Mesh(padMarkerGeo, woodMat);
      stakeB.position.set(0.35, 0.32, 0);
      stakeB.rotation.z = 0.28;
      stakeB.castShadow = true;
      padGroup.add(padRing, stakeA, stakeB);
      islandGroup.add(padGroup);

      const builtGroup = new THREE.Group();
      builtGroup.position.set(pad.x, pad.y - 0.05, pad.z);
      builtGroup.rotation.y = pad.rotationY;
      builtGroup.visible = false;

      const structGeo =
        pad.id === 'shelter' ? shelterGeo : pad.id === 'rack' ? rackGeo : pierGeo;
      const structMesh = new THREE.Mesh(structGeo, builtStructureMat);
      structMesh.castShadow = true;
      structMesh.receiveShadow = true;
      builtGroup.add(structMesh);
      islandGroup.add(builtGroup);

      buildPadVisuals.set(pad.id, { padGroup, builtGroup, popAge: 0 });
    }

    // 0C. STRANGE LANDMARK INTERACTION SHRINE RINGS
    const shrineRingGeo = new THREE.RingGeometry(1.75, 2.15, 36);
    shrineRingGeo.rotateX(-Math.PI / 2);
    islandDisposables.push(shrineRingGeo);
    const shrineColors: Record<StrangeLandmarkId, number> = {
      ruins: 0x4df5ff,
      volcano: 0xff6d2e,
      mushroom: 0xd966ff,
      shipwreck: 0xffcb45,
      spring: 0x72f7ff,
    };
    for (const lm of world.landmarkSites) {
      const lmMat = new THREE.MeshBasicMaterial({
        color: shrineColors[lm.id],
        transparent: true,
        opacity: 0.68,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const lmRing = new THREE.Mesh(shrineRingGeo, lmMat);
      lmRing.position.set(lm.x, lm.y + 0.08, lm.z);
      islandGroup.add(lmRing);
      islandDisposables.push(lmMat);
      landmarkRingVisuals.set(lm.id, lmRing);
    }

    // 1. ANCIENT RUINS: Sculpted Weathered Altar + Curved Sun-Crystal + Monolith Arch (Zero Boxes/Octahedrons!)
    const ruinsBaseY = groundHeightAt(RUINS.CX, RUINS.CZ, world);
    const ruinsGroup = new THREE.Group();
    ruinsGroup.position.set(RUINS.CX, ruinsBaseY - 0.08, RUINS.CZ);

    const altarBaseGeo = buildSculptedBoulderGeometry(2.6, 1.2, false);
    altarBaseGeo.scale(1.05, 0.19, 1.05);
    const altarTopGeo = buildSculptedBoulderGeometry(1.75, 2.7, false);
    altarTopGeo.scale(1.0, 0.2, 1.0);
    const obeliskGeo = buildSculptedSunCrystalGeometry();
    const haloGeo = new THREE.TorusGeometry(1.75, 0.085, 10, 32);
    const archPillarGeo = buildSculptedStoneSlabGeometry(1.05, 3.6, 1.05, 1.5);
    const archLintelGeo = buildSculptedStoneSlabGeometry(5.6, 0.92, 1.2, 2.8);
    const obeliskMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.OBELISK_GLOW,
      emissive: CONFIG.COLORS.OBELISK_GLOW,
      emissiveIntensity: 0.82,
      roughness: 0.18,
      metalness: 0.25,
    });
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xa2faff,
      transparent: true,
      opacity: 0.78,
    });
    islandDisposables.push(
      altarBaseGeo,
      altarTopGeo,
      obeliskGeo,
      haloGeo,
      archPillarGeo,
      archLintelGeo,
      obeliskMat,
      haloMat
    );

    const altarBase = new THREE.Mesh(altarBaseGeo, stoneDarkMat);
    altarBase.position.y = 0.18;
    altarBase.receiveShadow = true;
    altarBase.castShadow = true;

    const altarTop = new THREE.Mesh(altarTopGeo, stoneMat);
    altarTop.position.y = 0.48;
    altarTop.castShadow = true;

    obeliskCrystal = new THREE.Mesh(obeliskGeo, obeliskMat);
    obeliskCrystal.position.y = 2.85;
    obeliskCrystal.castShadow = true;

    obeliskHalo = new THREE.Mesh(haloGeo, haloMat);
    obeliskHalo.rotation.x = Math.PI / 2;
    obeliskHalo.position.y = 1.75;

    const archL = new THREE.Mesh(archPillarGeo, stoneMat);
    archL.position.set(-2.1, 1.75, -5.2);
    archL.castShadow = true;
    const archR = new THREE.Mesh(archPillarGeo, stoneMat);
    archR.position.set(2.1, 1.75, -5.2);
    archR.castShadow = true;
    const archTop = new THREE.Mesh(archLintelGeo, stoneDarkMat);
    archTop.position.set(0, 3.85, -5.2);
    archTop.rotation.z = 0.04;
    archTop.castShadow = true;

    ruinsGroup.add(altarBase, altarTop, obeliskCrystal, obeliskHalo, archL, archR, archTop);
    islandGroup.add(ruinsGroup);

    // Organic Weathered Standing Pillars & Rune Monoliths
    const colBaseGeo = buildSculptedBoulderGeometry(0.56, 6.2, false);
    colBaseGeo.scale(1.0, 0.36, 1.0);
    const colShaftGeo = buildWeatheredRuinsPillarGeometry();
    const runeBandGeo = new THREE.TorusGeometry(0.39, 0.045, 8, 18);
    runeBandGeo.rotateX(Math.PI / 2);
    const runeMat = new THREE.MeshBasicMaterial({ color: 0x5bf4ff });
    islandDisposables.push(colBaseGeo, colShaftGeo, runeBandGeo, runeMat);

    for (const p of world.props.filter((pr) => pr.kind === 'column')) {
      const cg = new THREE.Group();
      cg.position.set(p.x, p.y - 0.08, p.z);
      cg.rotation.y = p.rotationY;
      cg.scale.setScalar(p.scale);

      const cb = new THREE.Mesh(colBaseGeo, stoneDarkMat);
      cb.position.y = 0.14;
      cb.castShadow = true;
      cg.add(cb);

      const shaft = new THREE.Mesh(colShaftGeo, stoneMat);
      shaft.position.y = 0.18;
      if (p.variant === 1) {
        shaft.scale.y = 0.62;
      } else if (p.variant === 2) {
        shaft.rotation.z = 0.22;
      }
      shaft.castShadow = true;
      cg.add(shaft);

      if (p.id.startsWith('monolith-')) {
        const band = new THREE.Mesh(runeBandGeo, runeMat);
        band.position.y = 1.48;
        cg.add(band);
      }

      islandGroup.add(cg);
    }

    // 2. VOLCANO CALDERA: Animated GPU Molten Lava Lake + Sculpted Basalt & Magma Crags (Zero Cones!)
    const pitGroundY = groundHeightAt(VOLCANO.CX, VOLCANO.CZ, world);
    const rimLevel = groundHeightAt(VOLCANO.CX + 5.3, VOLCANO.CZ, world);
    const volcGroup = new THREE.Group();
    volcGroup.position.set(VOLCANO.CX, pitGroundY + 0.52, VOLCANO.CZ);

    const lavaGeo = new THREE.CircleGeometry(3.45, 28);
    lavaGeo.rotateX(-Math.PI / 2);
    const lavaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv * 2.0 - 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float r = length(vUv);
          float angle = atan(vUv.y, vUv.x);
          float swirl = sin(r * 10.0 - uTime * 2.2 + sin(angle * 3.0 + uTime * 0.9)) * 0.5 + 0.5;
          float cells = cos(vUv.x * 7.5 + uTime * 1.1) * sin(vUv.y * 7.5 - uTime * 1.3);
          float heat = clamp(0.65 - r * 0.35 + swirl * 0.38 + cells * 0.18, 0.0, 1.0);
          vec3 crust = vec3(0.24, 0.07, 0.04);
          vec3 magma = vec3(1.0, 0.32, 0.05);
          vec3 core = vec3(1.0, 0.9, 0.35);
          vec3 col = mix(crust, magma, smoothstep(0.15, 0.55, heat));
          col = mix(col, core, smoothstep(0.62, 0.96, heat));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const spireOuterGeo = buildOrganicBasaltCragGeometry(0.95, 2.75, 2.3);
    const spireCoreGeo = buildOrganicBasaltCragGeometry(0.46, 2.1, 5.1);
    const spireMat = new THREE.MeshStandardMaterial({
      color: 0xff6d2e,
      emissive: 0xff4512,
      emissiveIntensity: 0.72,
      roughness: 0.2,
    });
    islandDisposables.push(lavaGeo, lavaMat, spireOuterGeo, spireCoreGeo, spireMat);

    lavaPoolMesh = new THREE.Mesh(lavaGeo, lavaMat);
    volcGroup.add(lavaPoolMesh);
    islandGroup.add(volcGroup);

    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + 0.35;
      const sx = VOLCANO.CX + Math.cos(a) * 5.25;
      const sz = VOLCANO.CZ + Math.sin(a) * 5.25;
      const sy = groundHeightAt(sx, sz, world);
      const baseY = Math.max(sy, rimLevel - 0.25);

      const sg = new THREE.Group();
      sg.position.set(sx, baseY - 0.22, sz);
      sg.rotation.y = a;
      sg.scale.setScalar(0.85 + (i % 3) * 0.22);

      const obsRock = new THREE.Mesh(spireOuterGeo, basaltMat);
      obsRock.rotation.set(0.12, 0.4, 0.14);
      obsRock.castShadow = true;

      const magmaCrystal = new THREE.Mesh(spireCoreGeo, spireMat);
      magmaCrystal.position.set(0.22, 0.28, 0.12);
      magmaCrystal.rotation.set(-0.18, 0.2, -0.22);
      magmaCrystal.castShadow = true;

      sg.add(obsRock, magmaCrystal);
      islandGroup.add(sg);
    }

    // 3. NORTHERN CRYSTAL HOT SPRING
    const springGroundY = groundHeightAt(SPRING.CX, SPRING.CZ, world);
    const springPoolGeo = new THREE.CircleGeometry(4.45, 32);
    springPoolGeo.rotateX(-Math.PI / 2);
    const springPoolMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv * 2.0 - 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float r = length(vUv);
          float pulse = sin(r * 16.0 - uTime * 2.6) * 0.5 + 0.5;
          float shimmer = sin(vUv.x * 12.0 + uTime * 1.8) * cos(vUv.y * 12.0 - uTime * 1.5);
          vec3 deepPool = vec3(0.06, 0.56, 0.72);
          vec3 glowPool = vec3(0.32, 0.96, 1.0);
          vec3 col = mix(deepPool, glowPool, clamp((1.0 - r * 0.6) * 0.65 + pulse * 0.25 + shimmer * 0.1, 0.0, 1.0));
          float alpha = mix(0.95, 0.74, smoothstep(0.6, 1.0, r));
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    islandDisposables.push(springPoolGeo, springPoolMat);
    springWaterMesh = new THREE.Mesh(springPoolGeo, springPoolMat);
    springWaterMesh.position.set(SPRING.CX, springGroundY + 0.5, SPRING.CZ);
    islandGroup.add(springWaterMesh);

    // 4. GIANT BIOLUMINESCENT MUSHROOMS + FIREFLIES
    const stemMat = getPbrMat(CONFIG.COLORS.MUSHROOM_STEM, 0.82);
    const gillMat = getPbrMat(0xd6b5c8, 0.86);
    const capMatA = getPbrMat(CONFIG.COLORS.MUSHROOM_CAP_A, 0.58);
    const capMatB = getPbrMat(CONFIG.COLORS.MUSHROOM_CAP_B, 0.58);
    const spotMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.MUSHROOM_SPOT,
      emissive: CONFIG.COLORS.MUSHROOM_SPOT,
      emissiveIntensity: 0.95,
      roughness: 0.2,
    });
    const stemGeo = new THREE.CapsuleGeometry(0.28, 1.65, 6, 12);
    const capGeo = new THREE.SphereGeometry(1.18, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.58);
    const gillConeGeo = new THREE.SphereGeometry(1.12, 18, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
    const gillRingGeo = new THREE.TorusGeometry(0.42, 0.08, 8, 16);
    gillRingGeo.rotateX(Math.PI / 2);
    const spotGeo = new THREE.SphereGeometry(0.17, 12, 10);
    islandDisposables.push(spotMat, stemGeo, capGeo, gillConeGeo, gillRingGeo, spotGeo);

    for (const mush of world.props.filter((p) => p.kind === 'mushroom')) {
      const mg = new THREE.Group();
      mg.position.set(mush.x, mush.y - 0.1, mush.z);
      mg.rotation.y = mush.rotationY;
      mg.scale.setScalar(mush.scale * 1.15);

      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 1.05;
      stem.rotation.z = 0.07;
      stem.castShadow = true;
      mg.add(stem);

      const collar = new THREE.Mesh(gillRingGeo, stemMat);
      collar.position.set(-0.04, 1.56, 0);
      mg.add(collar);

      const gill = new THREE.Mesh(gillConeGeo, gillMat);
      gill.position.set(-0.08, 1.98, 0);
      gill.scale.set(1.06, 0.28, 1.06);
      mg.add(gill);

      const capMat = mush.variant === 0 ? capMatA : capMatB;
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(-0.08, 1.98, 0);
      cap.scale.set(1.12, 0.84, 1.12);
      cap.castShadow = true;
      mg.add(cap);

      const capCenterX = -0.08;
      const capCenterY = 1.98;
      const rx = 1.18 * 1.12;
      const ry = 1.18 * 0.84;
      const spotCoords: Array<[number, number]> = [
        [0, 0.08],
        [0.45, 0.35],
        [1.7, 0.42],
        [2.9, 0.38],
        [4.1, 0.45],
        [5.3, 0.36],
      ];
      for (const [phi, theta] of spotCoords) {
        const sp = new THREE.Mesh(spotGeo, spotMat);
        const sx = capCenterX + Math.sin(theta) * Math.cos(phi) * rx * 0.97;
        const sy = capCenterY + Math.cos(theta) * ry * 0.97;
        const sz = Math.sin(theta) * Math.sin(phi) * rx * 0.97;
        sp.position.set(sx, sy, sz);
        sp.lookAt(capCenterX, capCenterY, 0);
        sp.scale.set(0.95, 0.95, 0.35);
        mg.add(sp);
      }

      const miniStem = new THREE.Mesh(stemGeo, stemMat);
      miniStem.position.set(0.46, 0.34, 0.36);
      miniStem.scale.setScalar(0.32);
      const miniCap = new THREE.Mesh(capGeo, capMat);
      miniCap.position.set(0.46, 0.64, 0.36);
      miniCap.scale.set(0.36, 0.28, 0.36);
      mg.add(miniStem, miniCap);

      islandGroup.add(mg);
    }

    fireflyGroup = new THREE.Group();
    fireflyGroup.position.set(MUSHROOM.CX, groundHeightAt(MUSHROOM.CX, MUSHROOM.CZ, world) + 1.5, MUSHROOM.CZ);
    const ffGeo = new THREE.SphereGeometry(0.1, 6, 6);
    const ffMat = new THREE.MeshBasicMaterial({ color: 0x8efeff });
    islandDisposables.push(ffGeo, ffMat);
    for (let i = 0; i < 20; i += 1) {
      const ff = new THREE.Mesh(ffGeo, ffMat);
      const a = (i / 20) * Math.PI * 2;
      const dist = 2.5 + (i % 5) * 2.1;
      ff.position.set(Math.cos(a) * dist, (i % 3) * 0.65, Math.sin(a) * dist);
      fireflyGroup.add(ff);
    }
    islandGroup.add(fireflyGroup);

    // 5. SHIPWRECK COVE: Sculpted Curved Wooden Hull + Arched Deckhouse + Rounded Chest & Barrel + Lighthouse
    const hullGroundY = groundHeightAt(SHIPWRECK.HULL_CX, SHIPWRECK.HULL_CZ, world);
    const shipGroup = new THREE.Group();
    shipGroup.position.set(SHIPWRECK.HULL_CX, hullGroundY - 0.02, SHIPWRECK.HULL_CZ);
    shipGroup.rotation.set(0.05, -0.58, 0.1);

    const hullGeo = buildCurvedBoatHullGeometry();
    const hullMat = woodMat.clone();
    hullMat.side = THREE.DoubleSide;
    const cabinGeo = buildSculptedStoneSlabGeometry(1.45, 0.92, 1.65, 3.2);
    const mastGeo = new THREE.CapsuleGeometry(0.15, 4.5, 6, 10);
    const yardGeo = new THREE.CapsuleGeometry(0.075, 2.8, 5, 8);
    yardGeo.rotateZ(Math.PI / 2);
    const sailGeo = new THREE.CylinderGeometry(1.5, 1.5, 2.15, 12, 1, true, -0.55, 1.1);
    const chestGeo = buildRoundedChestGeometry();
    const barrelGeo = buildWeatheredBarrelGeometry();
    islandDisposables.push(hullGeo, hullMat, cabinGeo, mastGeo, yardGeo, sailGeo, chestGeo, barrelGeo);

    const hullMesh = new THREE.Mesh(hullGeo, hullMat);
    hullMesh.castShadow = true;
    hullMesh.receiveShadow = true;

    const sternCabin = new THREE.Mesh(cabinGeo, woodDarkMat);
    sternCabin.position.set(-1.55, 1.0, 0);
    sternCabin.castShadow = true;

    const mast = new THREE.Mesh(mastGeo, woodDarkMat);
    mast.position.set(0.45, 2.55, 0);
    mast.rotation.z = -0.22;
    mast.castShadow = true;

    const yard = new THREE.Mesh(yardGeo, woodDarkMat);
    yard.position.set(0.9, 4.05, 0);
    yard.rotation.y = 0.25;

    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0.95, 2.95, -0.95);
    sail.rotation.y = 0.25;
    sail.castShadow = true;
    (sailMat as THREE.MeshStandardMaterial).side = THREE.DoubleSide;

    shipGroup.add(hullMesh, sternCabin, mast, yard, sail);
    islandGroup.add(shipGroup);

    const chestX = SHIPWRECK.HULL_CX - 3.0;
    const chestZ = SHIPWRECK.HULL_CZ + 0.6;
    const chestA = new THREE.Mesh(chestGeo, woodMat);
    chestA.position.set(chestX, groundHeightAt(chestX, chestZ, world) - 0.04, chestZ);
    chestA.rotation.y = 0.4;
    chestA.castShadow = true;
    islandGroup.add(chestA);

    const barrelX = SHIPWRECK.HULL_CX - 3.6;
    const barrelZ = SHIPWRECK.HULL_CZ - 0.5;
    const barrelA = new THREE.Mesh(barrelGeo, woodDarkMat);
    barrelA.position.set(barrelX, groundHeightAt(barrelX, barrelZ, world) + 0.22, barrelZ);
    barrelA.rotation.z = 0.9;
    barrelA.castShadow = true;
    islandGroup.add(barrelA);

    const ribGeo = new THREE.TorusGeometry(2.3, 0.2, 10, 16, Math.PI * 0.78);
    islandDisposables.push(ribGeo);
    for (let i = 0; i < 4; i += 1) {
      const rx = 33.8 + i * 1.35;
      const rz = 39.2;
      const ry = groundHeightAt(rx, rz, world);
      const rib = new THREE.Mesh(ribGeo, boneMat);
      rib.position.set(rx, ry - 0.12, rz);
      rib.rotation.set(0.15, Math.PI * 0.5 + 0.25, -0.28);
      rib.scale.setScalar(1.06 - i * 0.09);
      rib.castShadow = true;
      islandGroup.add(rib);
    }

    // Sculpted Coastal Lighthouse Dome Beacon
    const lhGroundY = groundHeightAt(SHIPWRECK.LIGHTHOUSE_CX, SHIPWRECK.LIGHTHOUSE_CZ, world);
    const beaconGroup = new THREE.Group();
    beaconGroup.position.set(SHIPWRECK.LIGHTHOUSE_CX, lhGroundY - 0.15, SHIPWRECK.LIGHTHOUSE_CZ);
    const towerPts = [
      new THREE.Vector2(1.08, 0.0),
      new THREE.Vector2(0.96, 1.4),
      new THREE.Vector2(0.8, 2.8),
      new THREE.Vector2(0.72, 3.6),
      new THREE.Vector2(0.96, 3.74),
      new THREE.Vector2(0.82, 3.9),
    ];
    const towerGeo = new THREE.LatheGeometry(towerPts, 16);
    const strutGeo = new THREE.CapsuleGeometry(0.055, 0.88, 4, 6);
    const lanternCapGeo = new THREE.SphereGeometry(0.92, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const flameGeo = new THREE.SphereGeometry(0.54, 14, 12);
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xffe878,
      emissive: 0xffa81c,
      emissiveIntensity: 1.15,
      roughness: 0.15,
    });
    islandDisposables.push(towerGeo, strutGeo, lanternCapGeo, flameGeo, flameMat);

    const tower = new THREE.Mesh(towerGeo, stoneMat);
    tower.castShadow = true;
    const cap = new THREE.Mesh(lanternCapGeo, stoneDarkMat);
    cap.position.y = 4.65;
    cap.scale.set(1, 0.85, 1);
    beaconFlameMesh = new THREE.Mesh(flameGeo, flameMat);
    beaconFlameMesh.position.y = 4.25;

    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const strut = new THREE.Mesh(strutGeo, stoneDarkMat);
      strut.position.set(Math.cos(a) * 0.68, 4.25, Math.sin(a) * 0.68);
      beaconGroup.add(strut);
    }
    beaconGroup.add(tower, cap, beaconFlameMesh);
    islandGroup.add(beaconGroup);

    // 6. OFFSHORE SEA STACKS
    const stackRng = createSeededRandom(`${world.seed}-stacks`);
    for (let i = 0; i < CONFIG.PROPS.SEA_STACK_COUNT; i += 1) {
      const a = (i / CONFIG.PROPS.SEA_STACK_COUNT) * Math.PI * 2 + 0.32;
      const dist = 104 + stackRng() * 22;
      const sx = Math.cos(a) * dist;
      const sz = Math.sin(a) * dist * 0.85;
      const stackH = 2.8 + stackRng() * 3.8;

      const stackGeo = buildSculptedBoulderGeometry(2.3, i * 3.7, false);
      stackGeo.scale(1.0, stackH * 0.58, 0.92);
      islandDisposables.push(stackGeo);
      const rockMesh = new THREE.Mesh(stackGeo, i % 2 === 0 ? basaltMat : stoneDarkMat);
      rockMesh.position.set(sx, stackH * 0.32, sz);
      rockMesh.castShadow = true;
      rockMesh.receiveShadow = true;
      islandGroup.add(rockMesh);
    }
  };

  const buildContinuousIslandScene = (world: IslandWorldData) => {
    disposeIslandMeshes();

    heightTex = buildOceanDepthTexture(world);
    oceanMat.uniforms.uHeightTex.value = heightTex;

    // 1. CONTINUOUS HEIGHTMAP TERRAIN MESH
    const size = CONFIG.WORLD.TERRAIN_SIZE;
    const segs = CONFIG.WORLD.TERRAIN_SEGMENTS;
    const terrainGeo = new THREE.PlaneGeometry(size, size, segs, segs);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      pos.setY(i, groundHeightAt(vx, vz, world));
    }
    terrainGeo.computeVertexNormals();

    const normAttr = terrainGeo.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    const tmpColor = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const ny = normAttr.getY(i);
      const rgb = computeTerrainVertexColor(vx, vy, vz, ny, world);
      tmpColor.setRGB(rgb.r, rgb.g, rgb.b, THREE.SRGBColorSpace);
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.terrainDetailDiffuse,
      bumpMap: textures.terrainDetailBump,
      bumpScale: 0.055,
      roughness: 0.88,
      metalness: 0.02,
      vertexColors: true,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    islandGroup.add(terrainMesh);
    islandDisposables.push(terrainGeo, terrainMat);

    // 2. WEIRD LANDMARKS & CAMPFIRE
    buildWeirdLandmarks(world);

    // 3. INSTANCED TROPICAL PALMS (with Stumps for Falling Trees!)
    const treeStumpGeo = buildTreeStumpGeometry();
    const treeStumpMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.02,
      vertexColors: true,
    });
    islandDisposables.push(treeStumpGeo, treeStumpMat);

    const hideDummy = new THREE.Object3D();
    hideDummy.scale.setScalar(0);
    hideDummy.updateMatrix();

    const palmProps = world.props.filter((p) => p.kind === 'palm');
    if (palmProps.length > 0) {
      const trunkGeo = buildCurvedPalmTrunkGeometry();
      const frondGeo = buildPalmCanopyGeometry();
      const coconutGeo = buildCoconutClusterGeometry();
      const palmShadowGeo = new THREE.CircleGeometry(1.32, 16);
      palmShadowGeo.rotateX(-Math.PI / 2);

      const trunkMat = getPbrMat(CONFIG.COLORS.PALM_TRUNK, 0.88);
      const frondMat = new THREE.MeshStandardMaterial({
        color: CONFIG.COLORS.PALM_FROND,
        roughness: 0.72,
        metalness: 0.02,
        side: THREE.DoubleSide,
        vertexColors: true,
      });
      const coconutMat = getPbrMat(CONFIG.COLORS.COCONUT, 0.82);

      const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, palmProps.length);
      const frondInst = new THREE.InstancedMesh(frondGeo, frondMat, palmProps.length);
      const coconutInst = new THREE.InstancedMesh(coconutGeo, coconutMat, palmProps.length);
      const shadowInst = new THREE.InstancedMesh(palmShadowGeo, shadowDiscMat, palmProps.length);
      const stumpInst = new THREE.InstancedMesh(treeStumpGeo, treeStumpMat, palmProps.length);

      trunkInst.castShadow = !isSoftwareGl;
      frondInst.castShadow = !isSoftwareGl;

      const dummy = new THREE.Object3D();
      palmProps.forEach((p: IslandProp, idx: number) => {
        dummy.position.set(p.x, p.y - 0.14, p.z);
        dummy.rotation.set(0, p.rotationY, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        trunkInst.setMatrixAt(idx, dummy.matrix);
        frondInst.setMatrixAt(idx, dummy.matrix);
        coconutInst.setMatrixAt(idx, dummy.matrix);
        stumpInst.setMatrixAt(idx, hideDummy.matrix);

        treeNodeVisuals.set(p.id, {
          instMesh: trunkInst,
          extraMeshes: [frondInst, coconutInst],
          shadowMesh: shadowInst,
          stumpMesh: stumpInst,
          stumpIndex: idx,
          index: idx,
          prop: p,
          wobble: 0,
          fallDirAngle: p.rotationY + 0.8,
          dirty: false,
        });

        dummy.position.set(p.x + 0.4 * p.scale, p.y + 0.05, p.z + 0.15 * p.scale);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        shadowInst.setMatrixAt(idx, dummy.matrix);
      });

      trunkInst.instanceMatrix.needsUpdate = true;
      frondInst.instanceMatrix.needsUpdate = true;
      coconutInst.instanceMatrix.needsUpdate = true;
      shadowInst.instanceMatrix.needsUpdate = true;
      stumpInst.instanceMatrix.needsUpdate = true;
      trunkInst.computeBoundingSphere();
      frondInst.computeBoundingSphere();
      coconutInst.computeBoundingSphere();
      shadowInst.computeBoundingSphere();
      stumpInst.computeBoundingSphere();

      islandGroup.add(shadowInst, stumpInst, trunkInst, frondInst, coconutInst);
      islandDisposables.push(frondMat, trunkGeo, frondGeo, coconutGeo, palmShadowGeo);
    }

    // 4. INSTANCED FLOWERING & LUSH JUNGLE TREES
    const jungleProps = world.props.filter((p) => p.kind === 'jungle');
    if (jungleProps.length > 0) {
      const jTrunkGeo = buildJungleTrunkGeometry();
      const jCanopyGeo = buildJungleCanopyGeometry();
      const jBlossomGeo = buildCanopyBlossomsGeometry();
      const jShadowGeo = new THREE.CircleGeometry(1.5, 16);
      jShadowGeo.rotateX(-Math.PI / 2);

      const jTrunkMat = getPbrMat(0x7c4b27, 0.9);
      const jCanopyMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.78,
        metalness: 0.02,
        vertexColors: true,
      });
      const jBlossomMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.52,
        metalness: 0.02,
        vertexColors: true,
      });

      const jTrunkInst = new THREE.InstancedMesh(jTrunkGeo, jTrunkMat, jungleProps.length);
      const jCanopyInst = new THREE.InstancedMesh(jCanopyGeo, jCanopyMat, jungleProps.length);
      const jBlossomInst = new THREE.InstancedMesh(jBlossomGeo, jBlossomMat, jungleProps.length);
      const jShadowInst = new THREE.InstancedMesh(jShadowGeo, shadowDiscMat, jungleProps.length);
      const jStumpInst = new THREE.InstancedMesh(treeStumpGeo, treeStumpMat, jungleProps.length);

      jTrunkInst.castShadow = !isSoftwareGl;
      jCanopyInst.castShadow = !isSoftwareGl;

      const palette = [
        new THREE.Color(0x3ba845),
        new THREE.Color(0x52c445),
        new THREE.Color(0x2d8a4b),
        new THREE.Color(0x6ed142),
        new THREE.Color(0x46b85a),
      ];
      const dummy = new THREE.Object3D();
      jungleProps.forEach((p: IslandProp, idx: number) => {
        dummy.position.set(p.x, p.y - 0.14, p.z);
        dummy.rotation.set(0, p.rotationY, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        jTrunkInst.setMatrixAt(idx, dummy.matrix);
        jCanopyInst.setMatrixAt(idx, dummy.matrix);
        jCanopyInst.setColorAt(idx, palette[p.variant % palette.length]);
        jStumpInst.setMatrixAt(idx, hideDummy.matrix);

        // Give ~60% of jungle trees vivid blossoms/fruits
        if (p.variant >= 2) {
          jBlossomInst.setMatrixAt(idx, dummy.matrix);
        } else {
          jBlossomInst.setMatrixAt(idx, hideDummy.matrix);
        }

        treeNodeVisuals.set(p.id, {
          instMesh: jTrunkInst,
          extraMeshes: p.variant >= 2 ? [jCanopyInst, jBlossomInst] : [jCanopyInst],
          shadowMesh: jShadowInst,
          stumpMesh: jStumpInst,
          stumpIndex: idx,
          index: idx,
          prop: p,
          wobble: 0,
          fallDirAngle: p.rotationY + 1.1,
          dirty: false,
        });

        dummy.position.set(p.x + 0.25 * p.scale, p.y + 0.05, p.z + 0.1 * p.scale);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        jShadowInst.setMatrixAt(idx, dummy.matrix);
      });

      jTrunkInst.instanceMatrix.needsUpdate = true;
      jCanopyInst.instanceMatrix.needsUpdate = true;
      jBlossomInst.instanceMatrix.needsUpdate = true;
      jStumpInst.instanceMatrix.needsUpdate = true;
      if (jCanopyInst.instanceColor) jCanopyInst.instanceColor.needsUpdate = true;
      jShadowInst.instanceMatrix.needsUpdate = true;
      jTrunkInst.computeBoundingSphere();
      jCanopyInst.computeBoundingSphere();
      jBlossomInst.computeBoundingSphere();
      jShadowInst.computeBoundingSphere();
      jStumpInst.computeBoundingSphere();

      islandGroup.add(jShadowInst, jStumpInst, jTrunkInst, jCanopyInst, jBlossomInst);
      islandDisposables.push(jCanopyMat, jBlossomMat, jTrunkGeo, jCanopyGeo, jBlossomGeo, jShadowGeo);
    }

    // 4B. INSTANCED SCULPTED ORGANIC PINE TREES (Zero Cones!)
    const pineProps = world.props.filter((p) => p.kind === 'pine');
    if (pineProps.length > 0) {
      const pTrunkGeo = buildPineTrunkGeometry();
      const pCanopyGeo = buildPineCanopyGeometry();
      const pShadowGeo = new THREE.CircleGeometry(1.35, 14);
      pShadowGeo.rotateX(-Math.PI / 2);

      const pTrunkMat = getPbrMat(0x6b3e1f, 0.9);
      const pCanopyMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.8,
        metalness: 0.02,
        vertexColors: true,
      });

      const pTrunkInst = new THREE.InstancedMesh(pTrunkGeo, pTrunkMat, pineProps.length);
      const pCanopyInst = new THREE.InstancedMesh(pCanopyGeo, pCanopyMat, pineProps.length);
      const pShadowInst = new THREE.InstancedMesh(pShadowGeo, shadowDiscMat, pineProps.length);
      const pStumpInst = new THREE.InstancedMesh(treeStumpGeo, treeStumpMat, pineProps.length);

      pTrunkInst.castShadow = !isSoftwareGl;
      pCanopyInst.castShadow = !isSoftwareGl;

      const pinePalette = [
        new THREE.Color(0xdcf7df),
        new THREE.Color(0xc8f0cb),
        new THREE.Color(0xe5fad0),
      ];
      const dummy = new THREE.Object3D();
      pineProps.forEach((p: IslandProp, idx: number) => {
        dummy.position.set(p.x, p.y - 0.14, p.z);
        dummy.rotation.set(0, p.rotationY, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        pTrunkInst.setMatrixAt(idx, dummy.matrix);
        pCanopyInst.setMatrixAt(idx, dummy.matrix);
        pCanopyInst.setColorAt(idx, pinePalette[p.variant % pinePalette.length]);
        pStumpInst.setMatrixAt(idx, hideDummy.matrix);

        treeNodeVisuals.set(p.id, {
          instMesh: pTrunkInst,
          extraMeshes: [pCanopyInst],
          shadowMesh: pShadowInst,
          stumpMesh: pStumpInst,
          stumpIndex: idx,
          index: idx,
          prop: p,
          wobble: 0,
          fallDirAngle: p.rotationY - 0.9,
          dirty: false,
        });

        dummy.position.set(p.x + 0.2 * p.scale, p.y + 0.05, p.z + 0.1 * p.scale);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        pShadowInst.setMatrixAt(idx, dummy.matrix);
      });

      pTrunkInst.instanceMatrix.needsUpdate = true;
      pCanopyInst.instanceMatrix.needsUpdate = true;
      pStumpInst.instanceMatrix.needsUpdate = true;
      if (pCanopyInst.instanceColor) pCanopyInst.instanceColor.needsUpdate = true;
      pShadowInst.instanceMatrix.needsUpdate = true;
      pTrunkInst.computeBoundingSphere();
      pCanopyInst.computeBoundingSphere();
      pShadowInst.computeBoundingSphere();
      pStumpInst.computeBoundingSphere();

      islandGroup.add(pShadowInst, pStumpInst, pTrunkInst, pCanopyInst);
      islandDisposables.push(pCanopyMat, pTrunkGeo, pCanopyGeo, pShadowGeo);
    }

    // 4C. CLIMBABLE BANANA TREES (Never Chopped — Explorer Climbs Trunk for Bananas!)
    const bananaProps = world.props.filter((p) => p.kind === 'banana');
    if (bananaProps.length > 0) {
      const baTrunkGeo = buildBananaTrunkGeometry();
      const baCanopyGeo = buildBananaCanopyGeometry();
      const baBunchGeo = buildBananaBunchGeometry();
      const baShadowGeo = new THREE.CircleGeometry(1.22, 14);
      baShadowGeo.rotateX(-Math.PI / 2);

      const baTrunkMat = getPbrMat(0x6e8537, 0.86);
      const baCanopyMat = new THREE.MeshStandardMaterial({
        color: 0x45b849,
        roughness: 0.72,
        metalness: 0.02,
        side: THREE.DoubleSide,
        vertexColors: true,
      });
      const baBunchMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.42,
        metalness: 0.04,
        vertexColors: true,
      });

      const baTrunkInst = new THREE.InstancedMesh(baTrunkGeo, baTrunkMat, bananaProps.length);
      const baCanopyInst = new THREE.InstancedMesh(baCanopyGeo, baCanopyMat, bananaProps.length);
      const baBunchInst = new THREE.InstancedMesh(baBunchGeo, baBunchMat, bananaProps.length);
      const baShadowInst = new THREE.InstancedMesh(baShadowGeo, shadowDiscMat, bananaProps.length);
      baTrunkInst.castShadow = !isSoftwareGl;
      baCanopyInst.castShadow = !isSoftwareGl;

      const dummy = new THREE.Object3D();
      bananaProps.forEach((p: IslandProp, idx: number) => {
        dummy.position.set(p.x, p.y - 0.14, p.z);
        dummy.rotation.set(0, p.rotationY, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        baTrunkInst.setMatrixAt(idx, dummy.matrix);
        baCanopyInst.setMatrixAt(idx, dummy.matrix);
        baBunchInst.setMatrixAt(idx, dummy.matrix);
        bananaBunchVisuals.set(p.id, {
          trunkMesh: baTrunkInst,
          canopyMesh: baCanopyInst,
          bunchMesh: baBunchInst,
          index: idx,
          prop: p,
        });

        dummy.position.set(p.x + 0.2 * p.scale, p.y + 0.05, p.z + 0.1 * p.scale);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        baShadowInst.setMatrixAt(idx, dummy.matrix);
      });

      baTrunkInst.instanceMatrix.needsUpdate = true;
      baCanopyInst.instanceMatrix.needsUpdate = true;
      baBunchInst.instanceMatrix.needsUpdate = true;
      baShadowInst.instanceMatrix.needsUpdate = true;
      baTrunkInst.computeBoundingSphere();
      baCanopyInst.computeBoundingSphere();
      baBunchInst.computeBoundingSphere();
      baShadowInst.computeBoundingSphere();

      islandGroup.add(baShadowInst, baTrunkInst, baCanopyInst, baBunchInst);
      islandDisposables.push(baCanopyMat, baBunchMat, baTrunkGeo, baCanopyGeo, baBunchGeo, baShadowGeo);
    }

    // 4D. SPRAWLING CENTER BANYAN TREES (Dense Center Canopy Variety!)
    const banyanProps = world.props.filter((p) => p.kind === 'banyan');
    if (banyanProps.length > 0) {
      const byTrunkGeo = buildBanyanTrunkGeometry();
      const byCanopyGeo = buildBanyanCanopyGeometry();
      const byShadowGeo = new THREE.CircleGeometry(1.75, 16);
      byShadowGeo.rotateX(-Math.PI / 2);

      const byTrunkMat = getPbrMat(0x6b4528, 0.9);
      const byCanopyMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.78,
        metalness: 0.02,
        vertexColors: true,
      });

      const byTrunkInst = new THREE.InstancedMesh(byTrunkGeo, byTrunkMat, banyanProps.length);
      const byCanopyInst = new THREE.InstancedMesh(byCanopyGeo, byCanopyMat, banyanProps.length);
      const byShadowInst = new THREE.InstancedMesh(byShadowGeo, shadowDiscMat, banyanProps.length);
      const byStumpInst = new THREE.InstancedMesh(treeStumpGeo, treeStumpMat, banyanProps.length);
      byTrunkInst.castShadow = !isSoftwareGl;
      byCanopyInst.castShadow = !isSoftwareGl;

      const byPalette = [
        new THREE.Color(0x2e9444),
        new THREE.Color(0x3ca842),
        new THREE.Color(0x287a46),
      ];
      const dummy = new THREE.Object3D();
      banyanProps.forEach((p: IslandProp, idx: number) => {
        dummy.position.set(p.x, p.y - 0.14, p.z);
        dummy.rotation.set(0, p.rotationY, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        byTrunkInst.setMatrixAt(idx, dummy.matrix);
        byCanopyInst.setMatrixAt(idx, dummy.matrix);
        byCanopyInst.setColorAt(idx, byPalette[p.variant % byPalette.length]);
        byStumpInst.setMatrixAt(idx, hideDummy.matrix);

        treeNodeVisuals.set(p.id, {
          instMesh: byTrunkInst,
          extraMeshes: [byCanopyInst],
          shadowMesh: byShadowInst,
          stumpMesh: byStumpInst,
          stumpIndex: idx,
          index: idx,
          prop: p,
          wobble: 0,
          fallDirAngle: p.rotationY + 0.6,
          dirty: false,
        });

        dummy.position.set(p.x + 0.28 * p.scale, p.y + 0.05, p.z + 0.12 * p.scale);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        byShadowInst.setMatrixAt(idx, dummy.matrix);
      });

      byTrunkInst.instanceMatrix.needsUpdate = true;
      byCanopyInst.instanceMatrix.needsUpdate = true;
      byStumpInst.instanceMatrix.needsUpdate = true;
      if (byCanopyInst.instanceColor) byCanopyInst.instanceColor.needsUpdate = true;
      byShadowInst.instanceMatrix.needsUpdate = true;
      byTrunkInst.computeBoundingSphere();
      byCanopyInst.computeBoundingSphere();
      byShadowInst.computeBoundingSphere();
      byStumpInst.computeBoundingSphere();

      islandGroup.add(byShadowInst, byStumpInst, byTrunkInst, byCanopyInst);
      islandDisposables.push(byCanopyMat, byTrunkGeo, byCanopyGeo, byShadowGeo);
    }

    // 4E. LUMINOUS MYSTIC WILLOW TREES
    const willowProps = world.props.filter((p) => p.kind === 'willow');
    if (willowProps.length > 0) {
      const wTrunkGeo = buildWillowTrunkGeometry();
      const wCanopyGeo = buildWillowCanopyGeometry();
      const wShadowGeo = new THREE.CircleGeometry(1.4, 14);
      wShadowGeo.rotateX(-Math.PI / 2);

      const wTrunkMat = getPbrMat(0x5b445e, 0.88);
      const wCanopyMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x165e54,
        emissiveIntensity: 0.25,
        roughness: 0.72,
        side: THREE.DoubleSide,
        vertexColors: true,
      });

      const wTrunkInst = new THREE.InstancedMesh(wTrunkGeo, wTrunkMat, willowProps.length);
      const wCanopyInst = new THREE.InstancedMesh(wCanopyGeo, wCanopyMat, willowProps.length);
      const wShadowInst = new THREE.InstancedMesh(wShadowGeo, shadowDiscMat, willowProps.length);
      const wStumpInst = new THREE.InstancedMesh(treeStumpGeo, treeStumpMat, willowProps.length);

      const dummy = new THREE.Object3D();
      willowProps.forEach((p: IslandProp, idx: number) => {
        dummy.position.set(p.x, p.y - 0.14, p.z);
        dummy.rotation.set(0, p.rotationY, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        wTrunkInst.setMatrixAt(idx, dummy.matrix);
        wCanopyInst.setMatrixAt(idx, dummy.matrix);
        wStumpInst.setMatrixAt(idx, hideDummy.matrix);

        treeNodeVisuals.set(p.id, {
          instMesh: wTrunkInst,
          extraMeshes: [wCanopyInst],
          shadowMesh: wShadowInst,
          stumpMesh: wStumpInst,
          stumpIndex: idx,
          index: idx,
          prop: p,
          wobble: 0,
          fallDirAngle: p.rotationY - 0.5,
          dirty: false,
        });

        dummy.position.set(p.x + 0.2 * p.scale, p.y + 0.05, p.z + 0.1 * p.scale);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        wShadowInst.setMatrixAt(idx, dummy.matrix);
      });

      wTrunkInst.instanceMatrix.needsUpdate = true;
      wCanopyInst.instanceMatrix.needsUpdate = true;
      wStumpInst.instanceMatrix.needsUpdate = true;
      wShadowInst.instanceMatrix.needsUpdate = true;
      wTrunkInst.computeBoundingSphere();
      wCanopyInst.computeBoundingSphere();
      wShadowInst.computeBoundingSphere();
      wStumpInst.computeBoundingSphere();

      islandGroup.add(wShadowInst, wStumpInst, wTrunkInst, wCanopyInst);
      islandDisposables.push(wCanopyMat, wTrunkGeo, wCanopyGeo, wShadowGeo);
    }

    // 5. INSTANCED ORGANIC CRYSTAL CLUSTERS
    const crystalProps = world.props.filter((p) => p.kind === 'crystal');
    if (crystalProps.length > 0) {
      const cGeo = buildCrystalClusterGeometry();
      const cMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x35c9ff,
        emissiveIntensity: 0.45,
        roughness: 0.2,
        metalness: 0.18,
      });
      const cInst = new THREE.InstancedMesh(cGeo, cMat, crystalProps.length);
      cInst.castShadow = !isSoftwareGl;

      const cPalette = [new THREE.Color(0x52f2ff), new THREE.Color(0xc27aff)];
      const dummy = new THREE.Object3D();
      crystalProps.forEach((p: IslandProp, idx: number) => {
        dummy.position.set(p.x, p.y - 0.1, p.z);
        dummy.rotation.set(0, p.rotationY, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        cInst.setMatrixAt(idx, dummy.matrix);
        cInst.setColorAt(idx, cPalette[p.variant % cPalette.length]);
      });
      cInst.instanceMatrix.needsUpdate = true;
      if (cInst.instanceColor) cInst.instanceColor.needsUpdate = true;
      cInst.computeBoundingSphere();
      islandGroup.add(cInst);
      islandDisposables.push(cGeo, cMat);
    }

    // 6. DECORATIVE NATURAL BOULDERS (Purely Scenery — Stone Mining Removed)
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
    const rockGeoA = buildSculptedBoulderGeometry(0.74, 1.3);
    const rockGeoB = buildSculptedBoulderGeometry(0.45, 4.7);
    const rockGeoC = buildSculptedBoulderGeometry(0.28, 7.9);
    const propShadowGeo = new THREE.CircleGeometry(0.9, 16);
    propShadowGeo.rotateX(-Math.PI / 2);
    islandDisposables.push(rockMainMat, rockLightMat, rockGeoA, rockGeoB, rockGeoC, propShadowGeo);

    for (const rock of world.props.filter((p) => p.kind === 'rock')) {
      const group = new THREE.Group();
      group.position.set(rock.x, rock.y - 0.12, rock.z);
      group.rotation.y = rock.rotationY;
      group.scale.setScalar(rock.scale);

      const shadow = new THREE.Mesh(propShadowGeo, shadowDiscMat);
      shadow.position.y = 0.06;
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

    // 6B. FORAGABLE BEACH SEASHELLS
    const shellGeo = buildSeashellGeometry();
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.36,
      metalness: 0.08,
      vertexColors: true,
    });
    islandDisposables.push(shellGeo, shellMat);
    for (const sh of world.props.filter((p) => p.kind === 'shell')) {
      const mesh = new THREE.Mesh(shellGeo, shellMat);
      mesh.position.set(sh.x, sh.y + 0.01, sh.z);
      mesh.rotation.y = sh.rotationY;
      mesh.scale.setScalar(sh.scale * 1.15);
      mesh.castShadow = true;
      islandGroup.add(mesh);
      shellNodeVisuals.set(sh.id, { mesh, baseScale: sh.scale * 1.15 });
    }

    // 6C. COASTAL OCEAN FISHING SPOTS WITH ANIMATED SWIMMING FISH
    const fishSpotMarkerGeo = new THREE.CapsuleGeometry(0.055, 0.52, 4, 6);
    const fishRippleGeo = new THREE.RingGeometry(0.55, 0.78, 24);
    fishRippleGeo.rotateX(-Math.PI / 2);
    const fishRippleMat = new THREE.MeshBasicMaterial({
      color: 0xe6fbff,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const fishMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.32,
      metalness: 0.05,
      vertexColors: true,
    });
    const spotWoodMat = getPbrMat(CONFIG.COLORS.WOOD_DARK, 0.88);
    islandDisposables.push(fishSpotMarkerGeo, fishRippleGeo, fishRippleMat, fishMat);

    for (const spot of world.fishingSpots) {
      const stake = new THREE.Mesh(fishSpotMarkerGeo, spotWoodMat);
      stake.position.set(spot.x, spot.y + 0.24, spot.z);
      stake.rotation.z = 0.08;
      stake.castShadow = true;
      islandGroup.add(stake);

      const ripple = new THREE.Mesh(fishRippleGeo, fishRippleMat);
      ripple.position.set(spot.waterX, 0.05, spot.waterZ);
      islandGroup.add(ripple);

      const fishA = new THREE.Mesh(stackFishGeo, fishMat);
      fishA.position.set(spot.waterX + 0.4, 0.02, spot.waterZ);
      fishA.scale.setScalar(1.1);

      const fishB = new THREE.Mesh(stackFishGeo, fishMat);
      fishB.position.set(spot.waterX - 0.4, -0.02, spot.waterZ + 0.3);
      fishB.scale.setScalar(0.88);

      islandGroup.add(fishA, fishB);
      fishingVisuals.set(spot.id, {
        fishA,
        fishB,
        ripple,
        waterX: spot.waterX,
        waterZ: spot.waterZ,
      });
    }

    // 7. SCULPTED BERRY BUSHES (Tracked for Berry Picking Visuals)
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
      group.position.set(bush.x, bush.y - 0.1, bush.z);
      group.rotation.y = bush.rotationY;
      group.scale.setScalar(bush.scale);

      const shadow = new THREE.Mesh(propShadowGeo, shadowDiscMat);
      shadow.scale.setScalar(0.86);
      shadow.position.y = 0.05;
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
      const berries: THREE.Mesh[] = [];
      for (const [bx, by, bz] of berryOffsets) {
        const berry = new THREE.Mesh(berryGeo, berryMat);
        berry.position.set(bx, by, bz);
        group.add(berry);
        berries.push(berry);
      }

      islandGroup.add(group);
      bushNodeVisuals.set(bush.id, { group, berries, baseScale: bush.scale });
    }

    // Shared Wind Sway Hook
    windUniformTime = { value: 0 };
    const applyWindSway = (mat: THREE.MeshStandardMaterial) => {
      const timeRef = windUniformTime!;
      mat.customProgramCacheKey = () => 'tropical-wind-sway-v1';
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uWindTime = timeRef;
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
             uniform float uWindTime;`
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             #ifdef USE_INSTANCING
               vec3 instPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
               float sway = sin(uWindTime * 2.2 + instPos.x * 0.35 + instPos.z * 0.28) * 0.095;
               transformed.x += sway * max(0.0, transformed.y);
               transformed.z += cos(uWindTime * 1.7 + instPos.z * 0.3) * 0.05 * max(0.0, transformed.y);
             #endif`
          );
      };
    };

    const dummy = new THREE.Object3D();
    const floraRng = createSeededRandom(`${world.seed}-dense-flora`);
    const isClearOfStructures = (fx: number, fz: number): boolean => {
      if (Math.hypot(fx - CONFIG.ISLAND.CAMPFIRE.CX, fz - CONFIG.ISLAND.CAMPFIRE.CZ) < 3.4) return false;
      for (const pad of world.buildPads) {
        if (Math.hypot(fx - pad.x, fz - pad.z) < 2.2) return false;
      }
      if (Math.hypot(fx - CONFIG.ISLAND.RUINS.CX, fz - CONFIG.ISLAND.RUINS.CZ) < 11.5) return false;
      if (Math.hypot(fx - CONFIG.ISLAND.SPRING.CX, fz - CONFIG.ISLAND.SPRING.CZ) < 5.6) return false;
      if (Math.hypot(fx - CONFIG.ISLAND.VOLCANO.CX, fz - CONFIG.ISLAND.VOLCANO.CZ) < 14.0) return false;
      if (Math.hypot(fx - CONFIG.ISLAND.SHIPWRECK.HULL_CX, fz - CONFIG.ISLAND.SHIPWRECK.HULL_CZ) < 4.5) return false;
      return true;
    };

    // 8. INSTANCED MEADOW FERNS & CURVED GRASS BLADES
    const fernGeo = buildFernTuftGeometry();
    const fernMat = new THREE.MeshStandardMaterial({
      color: 0x4db844,
      roughness: 0.85,
      metalness: 0.02,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    const fernMatrices: THREE.Matrix4[] = [];
    for (let i = 0; i < CONFIG.PROPS.FERN_TUFT_COUNT; i += 1) {
      const phi = floraRng() * Math.PI * 2;
      const rad = Math.sqrt(floraRng());
      const fx = Math.cos(phi) * 80 * rad;
      const fz = Math.sin(phi) * 66 * rad;
      const fy = groundHeightAt(fx, fz, world);
      if (fy < 1.3 || fy > 4.4 || !isClearOfStructures(fx, fz)) continue;
      dummy.position.set(fx, fy - 0.04, fz);
      dummy.rotation.set(0, floraRng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.85 + floraRng() * 0.85);
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
    islandDisposables.push(fernMat, fernGeo);

    const grassGeo = buildGrassClumpGeometry();
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.84,
      metalness: 0.02,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    applyWindSway(grassMat);
    const grassMatrices: THREE.Matrix4[] = [];
    const grassColors: THREE.Color[] = [];
    const grassPalette = [
      new THREE.Color(0x9ff08a),
      new THREE.Color(0xb4f584),
      new THREE.Color(0x88dc84),
    ];
    for (let i = 0; i < CONFIG.PROPS.GRASS_TUFT_COUNT; i += 1) {
      const phi = floraRng() * Math.PI * 2;
      const rad = Math.sqrt(floraRng());
      const gx = Math.cos(phi) * 84 * rad;
      const gz = Math.sin(phi) * 70 * rad;
      const gy = groundHeightAt(gx, gz, world);
      if (gy < 1.25 || gy > 4.5 || !isClearOfStructures(gx, gz)) continue;
      dummy.position.set(gx, gy - 0.04, gz);
      dummy.rotation.set(0, floraRng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.8 + floraRng() * 0.85);
      dummy.updateMatrix();
      grassMatrices.push(dummy.matrix.clone());
      grassColors.push(grassPalette[i % grassPalette.length]);
    }
    if (grassMatrices.length > 0) {
      const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, grassMatrices.length);
      grassMatrices.forEach((m, idx) => {
        grassInst.setMatrixAt(idx, m);
        grassInst.setColorAt(idx, grassColors[idx]);
      });
      grassInst.instanceMatrix.needsUpdate = true;
      if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
      grassInst.computeBoundingSphere();
      islandGroup.add(grassInst);
    }
    islandDisposables.push(grassMat, grassGeo);

    // 9. INSTANCED WILDFLOWERS
    const flowerGeo = buildWildflowerGeometry();
    const flowerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.02,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    applyWindSway(flowerMat);
    const flowerPalette = [
      new THREE.Color(0xff6b8b),
      new THREE.Color(0xffd447),
      new THREE.Color(0xfff5e8),
      new THREE.Color(0xc58aff),
      new THREE.Color(0xff8e42),
    ];
    const flowerMatrices: THREE.Matrix4[] = [];
    const flowerColors: THREE.Color[] = [];
    for (let i = 0; i < CONFIG.PROPS.FLOWER_COUNT; i += 1) {
      const phi = floraRng() * Math.PI * 2;
      const rad = Math.sqrt(floraRng());
      const fx = Math.cos(phi) * 80 * rad;
      const fz = Math.sin(phi) * 66 * rad;
      const fy = groundHeightAt(fx, fz, world);
      if (fy < 1.35 || fy > 4.2 || !isClearOfStructures(fx, fz)) continue;
      dummy.position.set(fx, fy - 0.03, fz);
      dummy.rotation.set(0, floraRng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.85 + floraRng() * 0.7);
      dummy.updateMatrix();
      flowerMatrices.push(dummy.matrix.clone());
      flowerColors.push(flowerPalette[i % flowerPalette.length]);
    }
    if (flowerMatrices.length > 0) {
      const flowerInst = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerMatrices.length);
      flowerMatrices.forEach((m, idx) => {
        flowerInst.setMatrixAt(idx, m);
        flowerInst.setColorAt(idx, flowerColors[idx]);
      });
      flowerInst.instanceMatrix.needsUpdate = true;
      if (flowerInst.instanceColor) flowerInst.instanceColor.needsUpdate = true;
      flowerInst.computeBoundingSphere();
      islandGroup.add(flowerInst);
    }
    islandDisposables.push(flowerMat, flowerGeo);

    // 10. COASTAL REEDS, MINI GLOWING MUSHROOMS & BEACH PEBBLES
    const reedGeo = buildCoastalReedGeometry();
    const reedMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      vertexColors: true,
    });
    const reedMatrices: THREE.Matrix4[] = [];
    for (let i = 0; i < CONFIG.PROPS.REED_COUNT; i += 1) {
      let rx = 0;
      let rz = 0;
      if (i < 34) {
        const a = floraRng() * Math.PI * 2;
        const r = 4.6 + floraRng() * 2.2;
        rx = CONFIG.ISLAND.SPRING.CX + Math.cos(a) * r;
        rz = CONFIG.ISLAND.SPRING.CZ + Math.sin(a) * r;
      } else {
        const a = floraRng() * Math.PI * 2;
        const r = 0.78 + floraRng() * 0.16;
        rx = Math.cos(a) * CONFIG.WORLD.ISLAND_RX * r;
        rz = Math.sin(a) * CONFIG.WORLD.ISLAND_RZ * r;
      }
      const ry = groundHeightAt(rx, rz, world);
      if (ry < 0.08 || ry > 2.4) continue;
      dummy.position.set(rx, ry - 0.06, rz);
      dummy.rotation.set(0, floraRng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.85 + floraRng() * 0.55);
      dummy.updateMatrix();
      reedMatrices.push(dummy.matrix.clone());
    }
    if (reedMatrices.length > 0) {
      const reedInst = new THREE.InstancedMesh(reedGeo, reedMat, reedMatrices.length);
      reedMatrices.forEach((m, idx) => reedInst.setMatrixAt(idx, m));
      reedInst.instanceMatrix.needsUpdate = true;
      reedInst.computeBoundingSphere();
      islandGroup.add(reedInst);
    }
    islandDisposables.push(reedMat, reedGeo);

    const miniMushGeo = buildTinyMushroomGeometry();
    const miniMushMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x2299b8,
      emissiveIntensity: 0.35,
      roughness: 0.5,
      vertexColors: true,
    });
    const miniMushMatrices: THREE.Matrix4[] = [];
    for (let i = 0; i < 140; i += 1) {
      const a = floraRng() * Math.PI * 2;
      const r = Math.sqrt(floraRng()) * CONFIG.ISLAND.MUSHROOM.RADIUS * 1.15;
      const mx = CONFIG.ISLAND.MUSHROOM.CX + Math.cos(a) * r;
      const mz = CONFIG.ISLAND.MUSHROOM.CZ + Math.sin(a) * r;
      const my = groundHeightAt(mx, mz, world);
      if (my < 1.2 || my > 3.6) continue;
      dummy.position.set(mx, my - 0.03, mz);
      dummy.rotation.set(0, floraRng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.85 + floraRng() * 0.85);
      dummy.updateMatrix();
      miniMushMatrices.push(dummy.matrix.clone());
    }
    if (miniMushMatrices.length > 0) {
      const mmInst = new THREE.InstancedMesh(miniMushGeo, miniMushMat, miniMushMatrices.length);
      miniMushMatrices.forEach((m, idx) => mmInst.setMatrixAt(idx, m));
      mmInst.instanceMatrix.needsUpdate = true;
      mmInst.computeBoundingSphere();
      islandGroup.add(mmInst);
    }
    islandDisposables.push(miniMushMat, miniMushGeo);

    const pebbleGeo = buildSculptedBoulderGeometry(0.18, 9.2);
    pebbleGeo.scale(1.25, 0.58, 1.0);
    const pebbleMat = new THREE.MeshStandardMaterial({
      color: 0x9aa4b0,
      roughness: 0.88,
      vertexColors: true,
    });
    const pebbleMatrices: THREE.Matrix4[] = [];
    for (let i = 0; i < CONFIG.PROPS.PEBBLE_COUNT; i += 1) {
      const a = floraRng() * Math.PI * 2;
      const r = 0.72 + floraRng() * 0.24;
      const px = Math.cos(a) * CONFIG.WORLD.ISLAND_RX * r;
      const pz = Math.sin(a) * CONFIG.WORLD.ISLAND_RZ * r;
      const py = groundHeightAt(px, pz, world);
      if (py < 0.02 || py > 1.3) continue;
      dummy.position.set(px, py - 0.03, pz);
      dummy.rotation.set(0, floraRng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.75 + floraRng() * 0.9);
      dummy.updateMatrix();
      pebbleMatrices.push(dummy.matrix.clone());
    }
    if (pebbleMatrices.length > 0) {
      const pebInst = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleMatrices.length);
      pebbleMatrices.forEach((m, idx) => pebInst.setMatrixAt(idx, m));
      pebInst.instanceMatrix.needsUpdate = true;
      pebInst.computeBoundingSphere();
      islandGroup.add(pebInst);
    }
    islandDisposables.push(pebbleMat, pebbleGeo);

    // 11. 32-SPECIES ISLAND WILDLIFE, COASTAL CRABS, MARINE FISH, NIGHT PREDATORS & STRANGE CREATURES
    for (const actor of survivalState.wildlife.actors) {
      const spec = getAnimalSpecies(actor.speciesId);
      if (!spec) continue;
      const rig = buildSculptedAnimalRig(spec, animalGeoLib, shadowDiscMat);
      rig.group.position.set(actor.x, actor.y, actor.z);
      rig.group.rotation.y = actor.yaw;
      rig.group.visible = actor.visible;
      islandGroup.add(rig.group);
      animalRigBindings.set(actor.id, rig);
    }
  };

  const emitHud = (biome: BiomeId = currentBiome) => {
    callbacks.onHudUpdate(getSurvivalHudView(survivalState, biome));
  };

  const resetPlayerToSpawn = () => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const biomeParam = params?.get('biome');
    let sx: number = CONFIG.WORLD.SPAWN_X;
    let sz: number = CONFIG.WORLD.SPAWN_Z;

    if (biomeParam === 'ruins') {
      sx = CONFIG.ISLAND.RUINS.CX + 3.2;
      sz = CONFIG.ISLAND.RUINS.CZ + 3.0;
    } else if (biomeParam === 'volcano') {
      sx = CONFIG.ISLAND.VOLCANO.CX - 7.5;
      sz = CONFIG.ISLAND.VOLCANO.CZ + 5.5;
    } else if (biomeParam === 'mushroom') {
      sx = CONFIG.ISLAND.MUSHROOM.CX + 2.5;
      sz = CONFIG.ISLAND.MUSHROOM.CZ - 2.5;
    } else if (biomeParam === 'shipwreck') {
      sx = CONFIG.ISLAND.SHIPWRECK.CX - 1.5;
      sz = CONFIG.ISLAND.SHIPWRECK.CZ - 2.0;
    } else if (biomeParam === 'spring') {
      sx = CONFIG.ISLAND.SPRING.CX + 2.2;
      sz = CONFIG.ISLAND.SPRING.CZ + 6.2;
    } else if (biomeParam === 'fishing' && worldData.fishingSpots.length > 0) {
      sx = worldData.fishingSpots[0].x;
      sz = worldData.fishingSpots[0].z;
    } else if (biomeParam === 'banana') {
      const bt = worldData.props.find((p) => p.kind === 'banana');
      if (bt) {
        sx = bt.x - 1.4;
        sz = bt.z + 1.2;
      }
    } else if (biomeParam === 'beach') {
      // Pick golden sandy beach point (0.28..0.85m elevation) avoiding South Bay water
      sx = -28;
      sz = 58;
      for (let a = 0; a < 24; a += 1) {
        const ang = 0.55 + a * 0.22;
        const tx = Math.cos(ang) * CONFIG.WORLD.ISLAND_RX * 0.84;
        const tz = Math.sin(ang) * CONFIG.WORLD.ISLAND_RZ * 0.84;
        const hy = groundHeightAt(tx, tz, worldData);
        if (hy >= 0.3 && hy <= 0.85) {
          sx = tx;
          sz = tz;
          break;
        }
      }
    }

    playerState.x = sx;
    playerState.z = sz;
    playerState.y = groundHeightAt(playerState.x, playerState.z, worldData);
    playerState.yaw = 0;
    playerState.walkPhase = 0;
    currentBiome = detectBiomeAt(playerState.x, playerState.z, worldData);

    survivor.root.position.set(playerState.x, playerState.y, playerState.z);
    survivor.root.rotation.y = 0;
    survivor.axeMesh.visible = false;
    survivor.spearMesh.visible = false;
    survivor.fireSpearMesh.visible = false;
    survivor.rodGroup.visible = false;
    bobberMesh.visible = false;
    fishingLine.visible = false;
    for (const pVis of buildPadVisuals.values()) {
      pVis.padGroup.visible = true;
      pVis.builtGroup.visible = false;
      pVis.popAge = 0;
    }
    camLookAt.set(playerState.x, playerState.y + CONFIG.CAMERA.LOOK_HEIGHT, playerState.z);
    harvestRingMesh.visible = false;
  };

  const loadSeedWorld = (seed: string) => {
    currentSeed = seed;
    worldData = generateIslandWorld(seed);
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const timeParam = params?.get('time');
    const initialTime =
      timeParam === 'night' ? 0.88 : timeParam === 'dusk' ? 0.72 : timeParam === 'dawn' ? 0.22 : 0.38;
    survivalState = createSurvivalState(worldData, initialTime);
    const weatherParam = params?.get('weather');
    if (weatherParam === 'rain' || weatherParam === 'fog' || weatherParam === 'clear') {
      survivalState.weather = weatherParam;
      survivalState.weatherTimer = 30;
    }
    buildContinuousIslandScene(worldData);
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
    renderer.render(scene, camera);
  };
  window.addEventListener('resize', onResize);
  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  const onContextLost = (event: Event) => {
    event.preventDefault();
  };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

  let disposed = false;
  let elapsedTime = 0;
  let lastTimeMs = performance.now();
  let rafId = 0;
  const projVec = new THREE.Vector3();
  const treeDummy = new THREE.Object3D();

  const projectWorldToViewport = (wx: number, wy: number, wz: number): { x: number; y: number } => {
    projVec.set(wx, wy, wz).project(camera);
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    return {
      x: (projVec.x * 0.5 + 0.5) * w,
      y: (-projVec.y * 0.5 + 0.5) * h,
    };
  };

  const tipWorldVec = new THREE.Vector3();
  const stackWorldVec = new THREE.Vector3();

  const spawnBurstChips = (wx: number, wy: number, wz: number, kind: ResourceKind | 'ember' | 'chipWood') => {
    const mat =
      kind === 'wood'
        ? chipLeafMat
        : kind === 'chipWood'
          ? chipWoodMat
          : kind === 'fish'
            ? chipWaterMat
            : kind === 'berries'
              ? chipBerryMat
              : kind === 'banana'
                ? emberMat
                : kind === 'shell'
                  ? chipShellMat
                  : emberMat;
    const count = kind === 'ember' ? 1 : kind === 'chipWood' ? 3 : 5;
    let spawned = 0;
    for (const p of harvestChipPool) {
      if (p.active) continue;
      p.active = true;
      p.age = 0;
      p.life = kind === 'ember' ? 1.1 : 0.48;
      const a = Math.random() * Math.PI * 2;
      const spd = kind === 'ember' ? 0.35 : 1.6 + Math.random() * 1.4;
      p.vx = Math.cos(a) * spd;
      p.vy = kind === 'ember' ? 1.4 + Math.random() * 0.8 : 2.6 + Math.random() * 1.4;
      p.vz = Math.sin(a) * spd;
      p.baseScale = kind === 'ember' ? 0.38 : 0.65;
      p.mesh.material = mat;
      p.mesh.position.set(wx, wy + (kind === 'ember' ? 0.35 : 0.75), wz);
      p.mesh.scale.setScalar(p.baseScale);
      p.mesh.visible = true;
      spawned += 1;
      if (spawned >= count) break;
    }
  };

  const spawnFlyingPropToBack = (kind: ResourceKind, wx: number, wy: number, wz: number) => {
    for (const arc of flyingArcPool) {
      if (arc.active) continue;
      arc.active = true;
      arc.age = 0;
      arc.duration = 0.38;
      arc.start.set(wx, wy + 0.65, wz);
      arc.mesh.geometry =
        kind === 'wood'
          ? stackWoodGeo
          : kind === 'fish'
            ? stackFishGeo
            : kind === 'shell'
              ? stackShellGeo
              : kind === 'banana'
                ? stackBananaGeo
                : stackBerryGeo;
      arc.mesh.material = kind === 'berries' ? stackBerryMat : stackVertexMat;
      arc.mesh.scale.setScalar(kind === 'berries' ? 1.3 : 1.0);
      arc.mesh.position.copy(arc.start);
      arc.mesh.visible = true;
      break;
    }
  };

  const syncSurvivorBackStack = () => {
    const sig = survivalState.carriedStack.join(',');
    if (sig === lastStackSignature) return;
    lastStackSignature = sig;
    for (let i = 0; i < survivor.backStackSlots.length; i += 1) {
      const slot = survivor.backStackSlots[i];
      const item = survivalState.carriedStack[i];
      if (!item) {
        slot.group.visible = false;
        slot.wood.visible = false;
        slot.fish.visible = false;
        slot.berries.visible = false;
        slot.shell.visible = false;
        slot.banana.visible = false;
      } else {
        slot.group.visible = true;
        slot.wood.visible = item === 'wood';
        slot.fish.visible = item === 'fish';
        slot.berries.visible = item === 'berries';
        slot.shell.visible = item === 'shell';
        slot.banana.visible = item === 'banana';
      }
    }
  };

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
    const baseLavaY = groundHeightAt(VOLCANO.CX, VOLCANO.CZ, worldData) + 0.9;
    for (const puff of steamPool) {
      if (!puff.active) {
        puff.active = true;
        puff.age = 0;
        puff.life = 1.5;
        puff.vx = (Math.random() - 0.5) * 0.55;
        puff.vy = 1.85 + Math.random() * 0.7;
        puff.vz = (Math.random() - 0.5) * 0.55;
        puff.mesh.position.set(
          VOLCANO.CX + (Math.random() - 0.5) * 2.4,
          baseLavaY,
          VOLCANO.CZ + (Math.random() - 0.5) * 2.4
        );
        puff.mesh.scale.setScalar(2.2);
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

    oceanMat.uniforms.uTime.value = elapsedTime;
    if (windUniformTime) {
      windUniformTime.value = elapsedTime;
    }
    cloudGroup.rotation.y += dt * 0.009;
    birdGroup.rotation.y += dt * 0.14;
    birdGroup.children.forEach((bg, idx) => {
      const flap = Math.sin(elapsedTime * 5.8 + idx * 1.4) * 0.32;
      if (bg.children[0]) bg.children[0].rotation.z = 0.2 + flap;
      if (bg.children[1]) bg.children[1].rotation.z = -0.2 - flap;
    });

    if (obeliskCrystal) {
      obeliskCrystal.rotation.y += dt * 0.85;
      obeliskCrystal.position.y = 2.85 + Math.sin(elapsedTime * 2.1) * 0.24;
    }
    if (obeliskHalo) {
      obeliskHalo.rotation.z -= dt * 1.1;
      obeliskHalo.scale.setScalar(1 + Math.sin(elapsedTime * 2.6) * 0.06);
    }
    if (lavaPoolMesh) {
      const m = lavaPoolMesh.material as THREE.ShaderMaterial;
      m.uniforms.uTime.value = elapsedTime;
    }
    if (springWaterMesh) {
      const m = springWaterMesh.material as THREE.ShaderMaterial;
      m.uniforms.uTime.value = elapsedTime;
    }
    if (beaconFlameMesh) {
      const m = beaconFlameMesh.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.9 + Math.sin(elapsedTime * 5.0) * 0.28;
      beaconFlameMesh.scale.setScalar(1 + Math.sin(elapsedTime * 6.5) * 0.08);
    }
    if (fireflyGroup) {
      fireflyGroup.rotation.y += dt * 0.22;
      fireflyGroup.position.y =
        groundHeightAt(CONFIG.ISLAND.MUSHROOM.CX, CONFIG.ISLAND.MUSHROOM.CZ, worldData) +
        1.5 +
        Math.sin(elapsedTime * 1.8) * 0.22;
    }

    // Animate cozy survival campfire flames (scales with Fire Level!) & skewer
    const fireLevelScale = 1 + (survivalState.fireLevel - 1) * 0.28;
    campFlames.forEach((flame, idx) => {
      const flicker = 1 + Math.sin(elapsedTime * (7.5 + idx * 2.1) + idx) * 0.14;
      flame.scale.set(
        (idx === 0 ? 0.95 : 0.6) * fireLevelScale,
        (idx === 1 ? 0.78 : idx === 2 ? 0.68 : 1.05) * flicker * fireLevelScale,
        (idx === 0 ? 0.95 : 0.6) * fireLevelScale
      );
      flame.rotation.y = elapsedTime * (idx % 2 === 0 ? 1.4 : -1.8);
    });
    if (campAuraRing) {
      const mat = campAuraRing.material as THREE.MeshBasicMaterial;
      mat.opacity = survivalState.nearCampfire ? 0.56 + Math.sin(elapsedTime * 4) * 0.14 : 0.24;
      campAuraRing.scale.setScalar(1 + (survivalState.fireLevel - 1) * 0.24);
    }
    if (campRoastGroup && campRoastFish && campRoastBanana) {
      const roastFish = survivalState.nearCampfire && survivalState.carried.fish > 0;
      const roastBanana =
        !roastFish &&
        survivalState.nearCampfire &&
        survivalState.fireLevel >= 2 &&
        survivalState.carried.banana > 0;
      campRoastGroup.visible = roastFish || roastBanana;
      campRoastFish.visible = roastFish;
      campRoastBanana.visible = roastBanana;
      if (roastFish) campRoastFish.rotation.x = elapsedTime * 2.6;
      if (roastBanana) campRoastBanana.rotation.x = elapsedTime * 2.4;
    }

    // Pulse Strange Landmark interaction rings
    for (const [lmId, lmRing] of landmarkRingVisuals.entries()) {
      const ready = survivalState.landmarkCooldowns[lmId] <= 0;
      const mat = lmRing.material as THREE.MeshBasicMaterial;
      mat.opacity = ready ? 0.55 + Math.sin(elapsedTime * 3.5) * 0.22 : 0.18;
      lmRing.scale.setScalar(ready ? 1 + Math.sin(elapsedTime * 2.8) * 0.06 : 0.9);
    }

    // Animate coastal swimming fish strictly offshore
    let fIdx = 0;
    for (const [spotId, fVis] of fishingVisuals.entries()) {
      const node = survivalState.nodes.find((n) => n.id === spotId);
      const ready = !node || node.cooldownRemaining <= 0;
      fVis.fishA.visible = ready;
      fVis.fishB.visible = ready;
      fVis.ripple.visible = ready;
      if (ready) {
        const angA = elapsedTime * 1.65 + fIdx * 1.3;
        const angB = -elapsedTime * 1.3 + fIdx * 2.1;
        fVis.fishA.position.set(fVis.waterX + Math.cos(angA) * 0.55, 0.02, fVis.waterZ + Math.sin(angA) * 0.42);
        fVis.fishA.rotation.y = -angA;
        fVis.fishB.position.set(fVis.waterX + Math.cos(angB) * 0.35, -0.02, fVis.waterZ + Math.sin(angB) * 0.55);
        fVis.fishB.rotation.y = -angB + Math.PI;
        const pulse = 1 + Math.sin(elapsedTime * 3.2 + fIdx) * 0.16;
        fVis.ripple.scale.setScalar(pulse);
      }
      fIdx += 1;
    }

    // Sync Day/Night Sky, Sun/Moon Lighting, Weather Rain & Fog!
    const tDay = survivalState.timeOfDay;
    const sunAngle = (tDay - 0.25) * Math.PI * 2;
    const sunElev = Math.sin(sunAngle); // +1 noon, 0 horizon, -1 midnight
    const sunHoriz = Math.cos(sunAngle);
    const dayAmount = THREE.MathUtils.smoothstep(sunElev, -0.18, 0.28);
    const twilightAmount =
      Math.max(0, 1 - Math.abs(sunElev) / 0.28) * (1 - dayAmount * 0.5);
    const nightAmount = 1 - dayAmount;

    const skyTopDay = new THREE.Color(CONFIG.COLORS.SKY_ZENITH);
    const skyTopDusk = new THREE.Color(0x52468c);
    const skyTopNight = new THREE.Color(0x0b1633);
    const skyHorDay = new THREE.Color(CONFIG.COLORS.SKY_HORIZON);
    const skyHorDusk = new THREE.Color(0xff8c5a);
    const skyHorNight = new THREE.Color(0x16294a);

    const skyTop = skyTopNight.clone().lerp(skyTopDay, dayAmount).lerp(skyTopDusk, twilightAmount * 0.65);
    const skyHor = skyHorNight.clone().lerp(skyHorDay, dayAmount).lerp(skyHorDusk, twilightAmount * 0.78);

    // Overcast / Rain / Fog atmosphere blend
    const isRain = survivalState.weather === 'rain';
    const isFog = survivalState.weather === 'fog';
    if (isRain) {
      skyTop.lerp(new THREE.Color(0x3a4f66), 0.55);
      skyHor.lerp(new THREE.Color(0x6b8299), 0.62);
    } else if (isFog) {
      skyTop.lerp(new THREE.Color(0x9fb8c9), 0.48);
      skyHor.lerp(new THREE.Color(0xd2e6ef), 0.68);
    }

    skyDome.mat.uniforms.topColor.value.copy(skyTop);
    skyDome.mat.uniforms.horizonColor.value.copy(skyHor);
    skyDome.mat.uniforms.sunDir.value.set(sunHoriz, Math.max(-0.2, sunElev), 0.35).normalize();
    skyDome.mat.uniforms.starMix.value = nightAmount * (isRain || isFog ? 0.2 : 1.0);
    skyDome.mat.uniforms.uTime.value = elapsedTime;

    const moonAngle = sunAngle + Math.PI;
    moonOrb.position.set(
      Math.cos(moonAngle) * 260,
      Math.sin(moonAngle) * 220,
      -90
    );
    moonOrb.visible = nightAmount > 0.15;

    scene.background = skyHor;
    const targetFogDensity = isFog ? 0.0115 : isRain ? 0.0054 : nightAmount > 0.5 ? 0.0042 : CONFIG.RENDER.FOG_DENSITY;
    const expFog = scene.fog as THREE.FogExp2;
    expFog.color.copy(skyHor);
    expFog.density = THREE.MathUtils.lerp(expFog.density, targetFogDensity, Math.min(1, dt * 1.8));
    oceanMat.uniforms.uFogColor.value.copy(skyHor);
    oceanMat.uniforms.uFogDensity.value = expFog.density;
    oceanMat.uniforms.uDeepColor.value
      .setHex(0x05203b)
      .lerp(new THREE.Color(CONFIG.COLORS.SEA_DEEP), dayAmount);
    oceanMat.uniforms.uShallowColor.value
      .setHex(0x135975)
      .lerp(new THREE.Color(CONFIG.COLORS.SEA_SHALLOW), dayAmount);

    const weatherDim = isRain ? 0.72 : isFog ? 0.82 : 1.0;
    scene.environmentIntensity = (0.07 + dayAmount * 0.29) * weatherDim;
    sunLight.color
      .setHex(0x7c9eff)
      .lerp(new THREE.Color(0xfff1d4), dayAmount)
      .lerp(new THREE.Color(0xffa45b), twilightAmount * 0.65);
    sunLight.intensity = (0.24 + dayAmount * 1.66) * weatherDim;
    hemiLight.color.setHex(0x284378).lerp(new THREE.Color(0xdef5ff), dayAmount);
    hemiLight.groundColor.setHex(0x192830).lerp(new THREE.Color(0x769a5c), dayAmount);
    hemiLight.intensity = (0.24 + dayAmount * 0.66) * weatherDim;
    fillLight.intensity = 0.09 + dayAmount * 0.31;

    campPointLight.intensity =
      (1.6 + nightAmount * 7.5) * (1 + (survivalState.fireLevel - 1) * 0.45) +
      Math.sin(elapsedTime * 9) * 0.35;
    campPointLight.distance = 24 + survivalState.fireLevel * 6;

    // 3D Rain streaks around player
    rainInst.visible = isRain;
    if (isRain) {
      for (let i = 0; i < rainCount; i += 1) {
        const ro = rainOffsets[i];
        ro.y -= ro.spd * dt;
        if (ro.y < 0) ro.y = 18;
        rainDummy.position.set(playerState.x + ro.x, playerState.y + ro.y, playerState.z + ro.z);
        rainDummy.rotation.set(0.08, 0, 0.1);
        rainDummy.updateMatrix();
        rainInst.setMatrixAt(i, rainDummy.matrix);
      }
      rainInst.instanceMatrix.needsUpdate = true;
    }

    emberTimer += dt;
    if (emberTimer >= 0.45) {
      emberTimer = 0;
      const campY = groundHeightAt(CONFIG.ISLAND.CAMPFIRE.CX, CONFIG.ISLAND.CAMPFIRE.CZ, worldData);
      spawnBurstChips(CONFIG.ISLAND.CAMPFIRE.CX, campY, CONFIG.ISLAND.CAMPFIRE.CZ, 'ember');
    }

    steamTimer += dt;
    if (steamTimer >= 0.35) {
      steamTimer = 0;
      spawnVolcanoSteam();
    }

    const updateParticles = (pool: FloatingParticle[], gravity = 0) => {
      for (const p of pool) {
        if (!p.active) continue;
        p.age += dt;
        const t = p.age / p.life;
        if (t >= 1) {
          p.active = false;
          p.mesh.visible = false;
        } else {
          p.vy -= gravity * dt;
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.mesh.scale.setScalar(Math.max(0.04, p.baseScale * (1 - t)));
        }
      }
    };
    updateParticles(dustPool, 0);
    updateParticles(steamPool, 0);
    updateParticles(harvestChipPool, 4.8);

    // Animate 3D Flying Prop Arcs onto player's back stack
    stackWorldVec.set(playerState.x, playerState.y + 1.05, playerState.z);
    for (const arc of flyingArcPool) {
      if (!arc.active) continue;
      arc.age += dt;
      const t = arc.age / arc.duration;
      if (t >= 1) {
        arc.active = false;
        arc.mesh.visible = false;
      } else {
        const ease = 1 - Math.pow(1 - t, 2);
        arc.mesh.position.lerpVectors(arc.start, stackWorldVec, ease);
        arc.mesh.position.y += Math.sin(t * Math.PI) * 1.45;
        arc.mesh.rotation.x += dt * 8;
        arc.mesh.rotation.y += dt * 6;
      }
    }

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

      const speedScale = getPlayerSpeedScale(survivalState);
      const nextPos = stepPlayerPhysics(
        { x: playerState.x, z: playerState.z },
        moveX,
        moveZ,
        dt,
        worldData,
        speedScale
      );
      playerState.x = nextPos.x;
      playerState.y = nextPos.y;
      playerState.z = nextPos.z;

      const survivalRes = stepSurvivalSystem(
        survivalState,
        playerState.x,
        playerState.z,
        nextPos.moved,
        dt,
        worldData
      );

      // Update Harvest / Build Progress Ring
      const activeNode = survivalState.activeNodeId
        ? survivalState.nodes.find((n) => n.id === survivalState.activeNodeId)
        : undefined;
      const activePad = survivalState.activeBuildId
        ? survivalState.buildPads.find((p) => p.id === survivalState.activeBuildId)
        : undefined;

      if (activePad) {
        harvestRingMesh.visible = true;
        harvestRingMesh.position.set(activePad.x, activePad.y + 0.08, activePad.z);
        harvestRingMat.uniforms.uProgress.value = survivalState.actionProgress;
        harvestRingMat.uniforms.uColor.value.setHex(0x63f28e);
      } else if (activeNode) {
        harvestRingMesh.visible = true;
        harvestRingMesh.position.set(activeNode.x, activeNode.y + 0.08, activeNode.z);
        harvestRingMat.uniforms.uProgress.value = survivalState.harvestProgress;
        harvestRingMat.uniforms.uColor.value.setHex(activeNode.kind === 'banana' ? 0xffe042 : 0xffe14d);
      } else {
        harvestRingMesh.visible = false;
      }

      if (survivalRes.harvested) {
        const h = survivalRes.harvested;
        spawnBurstChips(h.x, h.y, h.z, h.kind);
        spawnFlyingPropToBack(h.kind, h.x, h.y, h.z);
        const treeBind = treeNodeVisuals.get(h.nodeId);
        if (treeBind) {
          treeBind.wobble = 0.45;
          treeBind.fallDirAngle = Math.atan2(h.x - playerState.x, h.z - playerState.z);
          treeBind.dirty = true;
        }
        if (callbacks.onResourceFly) {
          const pt = projectWorldToViewport(h.x, h.y + 1.4, h.z);
          callbacks.onResourceFly({
            id: flyEventSeq++,
            kind: h.kind,
            startX: pt.x,
            startY: pt.y,
          });
        }
      }

      if (survivalRes.cookedCount > 0 && callbacks.onResourceFly) {
        const campY = groundHeightAt(CONFIG.ISLAND.CAMPFIRE.CX, CONFIG.ISLAND.CAMPFIRE.CZ, worldData);
        const pt = projectWorldToViewport(CONFIG.ISLAND.CAMPFIRE.CX, campY + 1.1, CONFIG.ISLAND.CAMPFIRE.CZ);
        callbacks.onResourceFly({
          id: flyEventSeq++,
          kind: 'cookedFish',
          startX: pt.x,
          startY: pt.y,
        });
      }

      if (survivalRes.roastedBananaCount > 0 && callbacks.onResourceFly) {
        const campY = groundHeightAt(CONFIG.ISLAND.CAMPFIRE.CX, CONFIG.ISLAND.CAMPFIRE.CZ, worldData);
        const pt = projectWorldToViewport(CONFIG.ISLAND.CAMPFIRE.CX, campY + 1.1, CONFIG.ISLAND.CAMPFIRE.CZ);
        callbacks.onResourceFly({
          id: flyEventSeq++,
          kind: 'roastedBanana',
          startX: pt.x,
          startY: pt.y,
        });
      }

      if (survivalRes.builtUpgrade) {
        const b = survivalRes.builtUpgrade;
        spawnBurstChips(b.x, b.y + 0.4, b.z, 'chipWood');
      }

      if (survivalRes.earnedCoins > 0 && callbacks.onResourceFly) {
        const campY = groundHeightAt(CONFIG.ISLAND.CAMPFIRE.CX, CONFIG.ISLAND.CAMPFIRE.CZ, worldData);
        const pt = projectWorldToViewport(CONFIG.ISLAND.CAMPFIRE.CX, campY + 1.2, CONFIG.ISLAND.CAMPFIRE.CZ);
        callbacks.onResourceFly({
          id: flyEventSeq++,
          kind: 'coin',
          startX: pt.x,
          startY: pt.y,
        });
      }

      if (survivalRes.discoveredSpecies.length > 0 && callbacks.onNotice) {
        const sp = getAnimalSpecies(survivalRes.discoveredSpecies[0]);
        if (sp) {
          callbacks.onNotice(`گونه جدید کشف شد: ${sp.nameFa}`);
        }
      }

      // Sync 3D Camp Build Pads vs Built Structures
      for (const [padId, pVis] of buildPadVisuals.entries()) {
        const isBuilt = survivalState.buildings[padId];
        pVis.padGroup.visible = !isBuilt;
        pVis.builtGroup.visible = isBuilt;
        if (isBuilt && pVis.popAge < 0.45) {
          pVis.popAge += dt;
          const t = Math.min(1, pVis.popAge / 0.45);
          const spring = 1 + Math.sin(t * Math.PI) * 0.16;
          pVis.builtGroup.scale.setScalar(t * spring);
        } else if (isBuilt) {
          pVis.builtGroup.scale.setScalar(1);
        }
      }

      // Sync 32-Species Wildlife Visual Rigs (gait, wings, claws, sleeping tags, day/night visibility)
      for (const actor of survivalState.wildlife.actors) {
        const rig = animalRigBindings.get(actor.id);
        const spec = getAnimalSpecies(actor.speciesId);
        if (!rig || !spec) continue;
        rig.group.visible = actor.visible;
        if (!actor.visible) continue;

        rig.group.position.set(actor.x, actor.y, actor.z);
        rig.group.rotation.y = actor.yaw;

        if (actor.sleeping) {
          rig.bodyGroup.scale.set(1.08, 0.72, 1.08);
          rig.bodyGroup.position.y = -0.05;
          if (rig.sleepTag) {
            rig.sleepTag.visible = true;
            rig.sleepTag.position.y = 0.68 + Math.sin(elapsedTime * 2.5 + actor.phase) * 0.08;
          }
        } else {
          rig.bodyGroup.scale.set(1, 1, 1);
          if (rig.sleepTag) rig.sleepTag.visible = false;
          if (spec.archetype === 'rabbit') {
            rig.bodyGroup.position.y = Math.abs(Math.sin(actor.phase * 2.2)) * 0.22;
          } else if (spec.archetype === 'crab') {
            rig.group.rotation.y = actor.yaw + Math.PI * 0.5;
            rig.bodyGroup.position.y = Math.abs(Math.sin(actor.phase * 3.5)) * 0.05;
            if (rig.clawL) rig.clawL.rotation.x = Math.sin(actor.phase * 3) * 0.35;
            if (rig.clawR) rig.clawR.rotation.x = -Math.sin(actor.phase * 3) * 0.35;
          } else if (spec.flying) {
            const flap = Math.sin(actor.phase * 3.4) * 0.52;
            if (rig.leftWing) rig.leftWing.rotation.z = 0.18 + flap;
            if (rig.rightWing) rig.rightWing.rotation.z = -0.18 - flap;
          } else {
            rig.bodyGroup.position.y = Math.abs(Math.sin(actor.phase * 2.2)) * 0.06;
          }
        }
      }

      // Sync Back Stack 3D Models
      syncSurvivorBackStack();

      // Sync visual cooldown, falling trees -> stumps, banana bunches, shells & bushes
      for (const node of survivalState.nodes) {
        const isHarvestingThis = survivalState.activeNodeId === node.id;
        if (node.propKind === 'banana') {
          const bVis = bananaBunchVisuals.get(node.id);
          if (bVis) {
            const ready = node.cooldownRemaining <= 0;
            const p = bVis.prop;
            if (isHarvestingThis || !ready) {
              const sway = isHarvestingThis ? Math.sin(elapsedTime * 16) * 0.06 : 0;
              treeDummy.position.set(p.x, p.y - 0.14, p.z);
              treeDummy.rotation.set(sway, p.rotationY, sway * 0.6);
              treeDummy.scale.setScalar(p.scale);
              treeDummy.updateMatrix();
              bVis.trunkMesh.setMatrixAt(bVis.index, treeDummy.matrix);
              bVis.canopyMesh.setMatrixAt(bVis.index, treeDummy.matrix);
              bVis.trunkMesh.instanceMatrix.needsUpdate = true;
              bVis.canopyMesh.instanceMatrix.needsUpdate = true;
            }
            if (ready) {
              treeDummy.position.set(p.x, p.y - 0.14, p.z);
              treeDummy.rotation.set(0, p.rotationY, 0);
              treeDummy.scale.setScalar(p.scale);
              treeDummy.updateMatrix();
              bVis.bunchMesh.setMatrixAt(bVis.index, treeDummy.matrix);
            } else {
              treeDummy.position.set(p.x, p.y - 0.14, p.z);
              treeDummy.scale.setScalar(0);
              treeDummy.updateMatrix();
              bVis.bunchMesh.setMatrixAt(bVis.index, treeDummy.matrix);
            }
            bVis.bunchMesh.instanceMatrix.needsUpdate = true;
          }
        } else if (node.propKind === 'bush') {
          const vis = bushNodeVisuals.get(node.id);
          if (vis) {
            const ready = node.cooldownRemaining <= 0;
            for (const b of vis.berries) {
              b.visible = ready;
            }
            const jiggle = isHarvestingThis ? 1 + Math.sin(elapsedTime * 26) * 0.08 : 1;
            vis.group.scale.setScalar(vis.baseScale * jiggle);
          }
        } else if (node.propKind === 'shell') {
          const vis = shellNodeVisuals.get(node.id);
          if (vis) {
            const ready = node.cooldownRemaining <= 0;
            vis.mesh.visible = ready;
            if (ready) {
              const jiggle = isHarvestingThis ? 1 + Math.sin(elapsedTime * 24) * 0.12 : 1;
              vis.mesh.scale.setScalar(vis.baseScale * jiggle);
            }
          }
        } else if (node.kind === 'wood') {
          const treeBind = treeNodeVisuals.get(node.id);
          if (!treeBind) continue;
          const cooling = node.cooldownRemaining > 0;
          if (isHarvestingThis || cooling || treeBind.wobble > 0 || treeBind.dirty) {
            if (!isHarvestingThis && treeBind.wobble > 0) {
              treeBind.wobble = Math.max(0, treeBind.wobble - dt);
            }
            const p = treeBind.prop;
            if (cooling) {
              const elapsedSinceChop = node.regrowDuration - node.cooldownRemaining;
              // Stump pops cleanly while tree is felled
              const stumpGrow = elapsedSinceChop < 0.25 ? elapsedSinceChop / 0.25 : 1;
              const stumpFade = node.cooldownRemaining < 1.2 ? Math.max(0, node.cooldownRemaining / 1.2) : 1;
              treeDummy.position.set(p.x, p.y - 0.1, p.z);
              treeDummy.rotation.set(0, p.rotationY, 0);
              treeDummy.scale.setScalar(p.scale * stumpGrow * stumpFade);
              treeDummy.updateMatrix();
              treeBind.stumpMesh.setMatrixAt(treeBind.stumpIndex, treeDummy.matrix);
              treeBind.stumpMesh.instanceMatrix.needsUpdate = true;

              if (elapsedSinceChop < 1.35) {
                // Phase 1: Tree topples dramatically sideways, then sinks cleanly!
                const fallT = Math.min(1, elapsedSinceChop / 0.72);
                const fallEase = Math.pow(fallT, 1.85);
                const fallAngle = fallEase * (Math.PI * 0.47);
                const sinkT = elapsedSinceChop > 0.85 ? (elapsedSinceChop - 0.85) / 0.5 : 0;
                const treeScale = p.scale * Math.max(0, 1 - sinkT);

                treeDummy.position.set(p.x, p.y - 0.08 - sinkT * 0.35, p.z);
                treeDummy.rotation.set(
                  Math.cos(treeBind.fallDirAngle) * fallAngle,
                  p.rotationY,
                  -Math.sin(treeBind.fallDirAngle) * fallAngle
                );
                treeDummy.scale.setScalar(treeScale);
              } else if (node.cooldownRemaining < 1.4) {
                // Phase 3: Fresh young sapling sprouts smoothly back to full height!
                const regrowT = 1 - node.cooldownRemaining / 1.4;
                const spring = regrowT < 0.8 ? regrowT / 0.8 : 1 + Math.sin(((regrowT - 0.8) / 0.2) * Math.PI) * 0.08;
                treeDummy.position.set(p.x, p.y - 0.14, p.z);
                treeDummy.rotation.set(0, p.rotationY, 0);
                treeDummy.scale.setScalar(p.scale * Math.max(0.05, spring));
              } else {
                treeDummy.scale.setScalar(0);
              }
              treeDummy.updateMatrix();
              treeBind.dirty = true;
            } else {
              // Hide stump when tree is back upright
              treeDummy.scale.setScalar(0);
              treeDummy.updateMatrix();
              treeBind.stumpMesh.setMatrixAt(treeBind.stumpIndex, treeDummy.matrix);
              treeBind.stumpMesh.instanceMatrix.needsUpdate = true;

              const amp = isHarvestingThis ? 0.075 : treeBind.wobble * 0.14;
              const tilt = Math.sin(elapsedTime * 28) * amp;
              treeDummy.position.set(p.x, p.y - 0.14, p.z);
              treeDummy.rotation.set(tilt, p.rotationY, tilt * 0.7);
              treeDummy.scale.setScalar(p.scale);
              treeDummy.updateMatrix();
              if (!isHarvestingThis && treeBind.wobble <= 0) {
                treeBind.dirty = false;
              } else {
                treeBind.dirty = true;
              }
            }

            treeBind.instMesh.setMatrixAt(treeBind.index, treeDummy.matrix);
            treeBind.instMesh.instanceMatrix.needsUpdate = true;
            for (const extra of treeBind.extraMeshes) {
              extra.setMatrixAt(treeBind.index, treeDummy.matrix);
              extra.instanceMatrix.needsUpdate = true;
            }
          }
        }
      }

      const nextBiome = detectBiomeAt(playerState.x, playerState.z, worldData);
      if (nextBiome !== currentBiome || survivalRes.hudChanged) {
        currentBiome = nextBiome;
        emitHud(nextBiome);
      }

      // Realistic Character Pose, Movement, Banana Climbing, & Spear/Axe Animations
      const action = survivalState.activeAction;
      const climbBoostY =
        action === 'climb' && !nextPos.moved
          ? Math.sin(Math.min(1, survivalState.actionProgress) * Math.PI) * 1.48
          : 0;
      survivor.root.position.set(playerState.x, playerState.y + climbBoostY, playerState.z);

      if (nextPos.moved && mag > 0.05) {
        const targetYaw = Math.atan2(moveX, moveZ);
        let diff = targetYaw - playerState.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turnFactor = 1 - Math.exp(-CONFIG.PLAYER.TURN_DAMP * dt);
        playerState.yaw += diff * turnFactor;
        survivor.root.rotation.y = playerState.yaw;

        playerState.walkPhase += dt * CONFIG.PLAYER.WALK_CYCLE_SPEED * Math.min(1, mag) * speedScale;
        const swing = Math.sin(playerState.walkPhase);
        const bounce = Math.abs(Math.sin(playerState.walkPhase)) * 0.095;

        survivor.leftLeg.rotation.x = swing * 0.72;
        survivor.rightLeg.rotation.x = -swing * 0.72;
        survivor.leftArm.rotation.x = -swing * 0.65;
        survivor.rightArm.rotation.x = swing * 0.65;
        survivor.bodyPivot.position.y = bounce;
        survivor.bodyPivot.rotation.x = 0;
        survivor.bodyPivot.rotation.z = Math.cos(playerState.walkPhase) * 0.055;
        survivor.headGroup.rotation.z = -Math.cos(playerState.walkPhase) * 0.045;

        survivor.axeMesh.visible = false;
        survivor.spearMesh.visible = survivalState.hasSpear && !survivalState.hasFireSpear;
        survivor.fireSpearMesh.visible = survivalState.hasFireSpear;
        survivor.rodGroup.visible = false;
        bobberMesh.visible = false;
        fishingLine.visible = false;

        dustTimer += dt;
        if (dustTimer >= 0.14) {
          dustTimer = 0;
          if (playerState.y < 0.02) {
            spawnBurstChips(playerState.x, 0.02, playerState.z, 'fish');
          } else {
            spawnDustPuff(
              playerState.x - Math.sin(playerState.yaw) * 0.2,
              playerState.y,
              playerState.z - Math.cos(playerState.yaw) * 0.2
            );
          }
        }
      } else {
        const idleDecay = 1 - Math.exp(-12 * dt);
        survivor.leftLeg.rotation.x *= 1 - idleDecay;
        survivor.rightLeg.rotation.x *= 1 - idleDecay;
        survivor.bodyPivot.rotation.z *= 1 - idleDecay;
        survivor.headGroup.rotation.z *= 1 - idleDecay;

        if (action !== 'idle' && action !== 'cook') {
          const faceYaw = Math.atan2(
            survivalState.actionTargetX - playerState.x,
            survivalState.actionTargetZ - playerState.z
          );
          let diff = faceYaw - playerState.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          playerState.yaw += diff * (1 - Math.exp(-14 * dt));
          survivor.root.rotation.y = playerState.yaw;
        }

        if (action === 'chop' || action === 'build') {
          survivor.axeMesh.visible = true;
          survivor.spearMesh.visible = false;
          survivor.fireSpearMesh.visible = false;
          survivor.rodGroup.visible = false;
          bobberMesh.visible = false;
          fishingLine.visible = false;

          const chopCycle = elapsedTime * 10.5;
          const strike = Math.sin(chopCycle);
          survivor.rightArm.rotation.x = -1.1 + strike * 1.15;
          survivor.leftArm.rotation.x = -0.35 + strike * 0.25;
          survivor.bodyPivot.rotation.x = 0.14 + Math.max(0, strike) * 0.14;
          survivor.bodyPivot.position.y = Math.abs(strike) * 0.04;

          chopSwingChipCooldown -= dt;
          if (strike > 0.85 && chopSwingChipCooldown <= 0 && activeNode) {
            chopSwingChipCooldown = 0.28;
            spawnBurstChips(activeNode.x, activeNode.y + 0.4, activeNode.z, 'chipWood');
          }
        } else if (action === 'climb') {
          // Climbing Banana Tree trunk!
          survivor.axeMesh.visible = false;
          survivor.spearMesh.visible = false;
          survivor.fireSpearMesh.visible = false;
          survivor.rodGroup.visible = false;
          bobberMesh.visible = false;
          fishingLine.visible = false;

          const cl = Math.sin(elapsedTime * 14);
          survivor.rightArm.rotation.x = -1.65 + cl * 0.55;
          survivor.leftArm.rotation.x = -1.65 - cl * 0.55;
          survivor.leftLeg.rotation.x = cl * 0.6;
          survivor.rightLeg.rotation.x = -cl * 0.6;
          survivor.bodyPivot.rotation.x = 0.18;
        } else if (action === 'spear_fish') {
          // Wading in shallow surf and thrusting 3D Spear toward offshore fish!
          survivor.axeMesh.visible = false;
          survivor.spearMesh.visible = !survivalState.hasFireSpear;
          survivor.fireSpearMesh.visible = survivalState.hasFireSpear;
          survivor.rodGroup.visible = false;
          bobberMesh.visible = false;
          fishingLine.visible = false;

          const thrust = Math.sin(elapsedTime * 9.5);
          survivor.rightArm.rotation.x = -0.85 + Math.max(0, thrust) * 0.72;
          survivor.leftArm.rotation.x = -0.45;
          survivor.bodyPivot.rotation.x = 0.18 + Math.max(0, thrust) * 0.14;
          survivor.bodyPivot.position.y = Math.sin(elapsedTime * 2.5) * 0.025;

          chopSwingChipCooldown -= dt;
          if (thrust > 0.86 && chopSwingChipCooldown <= 0) {
            chopSwingChipCooldown = 0.35;
            spawnBurstChips(survivalState.actionTargetX, 0.05, survivalState.actionTargetZ, 'fish');
          }
        } else if (action === 'forage') {
          survivor.axeMesh.visible = false;
          survivor.spearMesh.visible = false;
          survivor.fireSpearMesh.visible = false;
          survivor.rodGroup.visible = false;
          bobberMesh.visible = false;
          fishingLine.visible = false;
          const reach = Math.sin(elapsedTime * 11);
          survivor.rightArm.rotation.x = -0.75 + reach * 0.35;
          survivor.leftArm.rotation.x = -0.65 - reach * 0.3;
          survivor.bodyPivot.rotation.x = 0.24;
          survivor.bodyPivot.position.y = -0.04;
        } else {
          survivor.axeMesh.visible = false;
          survivor.spearMesh.visible = survivalState.hasSpear && !survivalState.hasFireSpear;
          survivor.fireSpearMesh.visible = survivalState.hasFireSpear;
          survivor.rodGroup.visible = false;
          bobberMesh.visible = false;
          fishingLine.visible = false;
          survivor.leftArm.rotation.x *= 1 - idleDecay;
          survivor.rightArm.rotation.x *= 1 - idleDecay;
          survivor.bodyPivot.rotation.x *= 1 - idleDecay;
          survivor.bodyPivot.position.y = Math.sin(elapsedTime * 3.1) * 0.025;
        }
      }

      targetLookAt.set(playerState.x, playerState.y + CONFIG.CAMERA.LOOK_HEIGHT + climbBoostY * 0.5, playerState.z);
      const followAlpha = 1 - Math.exp(-CONFIG.CAMERA.FOLLOW_DAMP * dt);
      camLookAt.lerp(targetLookAt, followAlpha);
      desiredCamPos.set(camLookAt.x, camLookAt.y + camHeightOffset, camLookAt.z + camDepthOffset);
      camera.position.copy(desiredCamPos);
      camera.lookAt(camLookAt);
    } else {
      survivor.axeMesh.visible = false;
      survivor.spearMesh.visible = false;
      survivor.fireSpearMesh.visible = false;
      survivor.rodGroup.visible = false;
      bobberMesh.visible = false;
      fishingLine.visible = false;

      const orbitAngle = elapsedTime * CONFIG.CAMERA.TITLE_ORBIT_SPEED + 0.35;
      const orbitDist = CONFIG.CAMERA.TITLE_DISTANCE * 1.12;
      const orbitHeight = Math.sin(pitchRad) * orbitDist;
      const orbitHoriz = Math.cos(pitchRad) * orbitDist;
      targetLookAt.set(0, 2.0, 2.0);
      camera.position.set(
        Math.sin(orbitAngle) * orbitHoriz * 0.65,
        orbitHeight,
        Math.cos(orbitAngle) * orbitHoriz
      );
      camera.lookAt(targetLookAt);

      survivor.bodyPivot.position.y = Math.sin(elapsedTime * 3.1) * 0.028;
    }

    if (!isSoftwareGl) {
      sunLight.position.set(playerState.x + 22, 32, playerState.z + 14);
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

  const rawGl = renderer.getContext();

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
        survivalState = createSurvivalState(worldData);
        resetPlayerToSpawn();
      }
      lastStackSignature = '';
      syncSurvivorBackStack();
      screenState = 'playing';
      emitHud(currentBiome);
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
    eatFood: () => {
      const res = eatBestFoodFromInventory(survivalState);
      if (res.ate) {
        lastStackSignature = '';
        syncSurvivorBackStack();
        emitHud(currentBiome);
      }
      return res.ate;
    },
    craftSpear: () => {
      const ok = craftSpear(survivalState);
      if (ok) {
        lastStackSignature = '';
        syncSurvivorBackStack();
        emitHud(currentBiome);
        callbacks.onNotice?.('نیزه ماهی‌گیری ساخته شد! در آب کم‌عمق ماهی بگیر');
      }
      return ok;
    },
    stokeFire: () => {
      const ok = stokeCampfire(survivalState);
      if (ok) {
        lastStackSignature = '';
        syncSurvivorBackStack();
        const campY = groundHeightAt(CONFIG.ISLAND.CAMPFIRE.CX, CONFIG.ISLAND.CAMPFIRE.CZ, worldData);
        spawnBurstChips(CONFIG.ISLAND.CAMPFIRE.CX, campY + 0.5, CONFIG.ISLAND.CAMPFIRE.CZ, 'ember');
        emitHud(currentBiome);
        const unlockMsg =
          survivalState.fireLevel === 2
            ? 'آتش سطح ۲: کباب‌کردن موز باز شد!'
            : survivalState.fireLevel === 3
              ? 'آتش سطح ۳: دفع شکارچیان و سرعت بیشتر!'
              : 'آتش جاودان (سطح ۴): +۵۰٪ امتیاز مهارت!';
        callbacks.onNotice?.(unlockMsg);
      }
      return ok;
    },
    upgradeSkill: (skillId: SkillId) => {
      const ok = upgradeSkill(survivalState, skillId);
      if (ok) {
        lastStackSignature = '';
        syncSurvivorBackStack();
        emitHud(currentBiome);
      }
      return ok;
    },
    triggerLandmark: (id: StrangeLandmarkId) => {
      const res = activateLandmarkPower(survivalState, id);
      if (res.triggered) {
        lastStackSignature = '';
        syncSurvivorBackStack();
        emitHud(currentBiome);
        callbacks.onNotice?.(res.label);
      }
      return res;
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
      for (const item of disposables) {
        item.dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}

