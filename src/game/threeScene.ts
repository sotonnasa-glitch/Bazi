import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CONFIG,
  type AppScreenState,
  type BiomeId,
  type CampUpgradeId,
  type GameMode,
  type GameOutcome,
  type SkillId,
  type StrangeLandmarkId,
  type WeaponId,
} from './config';
import { soundEngine } from './audio';
import {
  buildSculptedAnimalRig,
  createAnimalGeometryLibrary,
  type AnimalVisualRig,
} from './animalModels';
import {
  buildAnchorGeometry,
  buildAnvilGeometry,
  buildArrowGeometry,
  buildAxeToolGeometry,
  buildBananaBunchGeometry,
  buildBananaCanopyGeometry,
  buildBananaItemGeometry,
  buildBananaTrunkGeometry,
  buildBanyanCanopyGeometry,
  buildBanyanTrunkGeometry,
  buildBeachStarfishGeometry,
  buildBellflowerSpikeGeometry,
  buildBoatCradleGeometry,
  buildBowToolGeometry,
  buildBrazierGeometry,
  buildCampShelterGeometry,
  buildCampfireLogsGeometry,
  buildCanopyBlossomsGeometry,
  buildClawSlashGeometry,
  buildCloverPatchGeometry,
  buildCoastalReedGeometry,
  buildCoconutClusterGeometry,
  buildCrystalClusterGeometry,
  buildCurvedBoatHullGeometry,
  buildCurvedGullWingGeometry,
  buildCurvedPalmTrunkGeometry,
  buildDriftwoodLogGeometry,
  buildFernTuftGeometry,
  buildFishGeometry,
  buildFishingPierGeometry,
  buildFishingRodPoleGeometry,
  buildFlameTongueGeometry,
  buildGrassClumpGeometry,
  buildHammerToolGeometry,
  buildJungleCanopyGeometry,
  buildJungleCanopyVariantBGeometry,
  buildJungleTrunkGeometry,
  buildLeafSnowQuadGeometry,
  buildLightningBoltGeometry,
  buildLotusBloomGeometry,
  buildMeatCutGeometry,
  buildOrganicBasaltCragGeometry,
  buildPalmCanopyGeometry,
  buildPineCanopyGeometry,
  buildPineTrunkGeometry,
  buildRoundedChestGeometry,
  buildSavannaPlumeGrassGeometry,
  buildSculptedBoulderGeometry,
  buildSculptedStoneSlabGeometry,
  buildSculptedSunCrystalGeometry,
  buildSeashellGeometry,
  buildSecretChestBaseGeometry,
  buildSecretChestLidGeometry,
  buildSpearToolGeometry,
  buildSporeBloomGeometry,
  buildStorageRackGeometry,
  buildTinyMushroomGeometry,
  buildTreeStumpGeometry,
  buildTropicalHibiscusGeometry,
  buildWeatheredBarrelGeometry,
  buildWeatheredRuinsPillarGeometry,
  buildWildflowerGeometry,
  buildWillowCanopyGeometry,
  buildWillowTrunkGeometry,
  buildWoodLogGeometry,
} from './sculptGeometry';
import {
  activateLandmarkPower,
  activateLandmarkSpecial,
  craftSpear,
  createSurvivalState,
  eatBestFoodFromInventory,
  getPlayerSpeedScale,
  getSurvivalHudView,
  requestBowShotAt,
  requestPlayerInteract,
  requestTargetInteract,
  selectWeapon,
  stepSurvivalSystem,
  stokeCampfire,
  triggerSeasonEvent,
  triggerVictoryVoyage,
  triggerWorldEvent,
  upgradeSkill,
  upgradeWeapon,
  type FocusedTargetKind,
  type ResourceKind,
  type SurvivalHudView,
  type SurvivalState,
} from './survival';
import { getAnimalSpecies } from './wildlife';
import { createProceduralTextureSet } from './textures';
import { createSeededRandom, getSeedForMode, resetNormalSeed, toPersianDigits } from './utils';
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
  kind: ResourceKind | 'cookedFish' | 'roastedBanana' | 'cookedMeat' | 'coin';
  startX: number;
  startY: number;
}

export interface ThreeSceneCallbacks {
  onScreenChange: (screen: AppScreenState, runInfo?: ActiveRunInfo) => void;
  onHudUpdate: (hud: HudSnapshot) => void;
  onResourceFly?: (event: FlyingResourceEvent) => void;
  onNotice?: (text: string) => void;
  onDamageTaken?: (damage: number, screenX: number, screenY: number) => void;
  onOutcomeChange?: (outcome: GameOutcome) => void;
}

export interface ThreeIslandController {
  startRun: (mode: GameMode, forceNewIsland?: boolean) => void;
  returnToMenu: () => void;
  setJoystickInput: (dx: number, dy: number) => void;
  interact: () => void;
  eatFood: () => boolean;
  craftSpear: () => boolean;
  selectWeapon: (id: WeaponId) => boolean;
  upgradeWeapon: (id: WeaponId) => boolean;
  stokeFire: () => boolean;
  upgradeSkill: (skillId: SkillId) => boolean;
  triggerLandmark: (id: StrangeLandmarkId) => { triggered: boolean; label: string };
  triggerLandmarkSpecial: (id: StrangeLandmarkId) => { triggered: boolean; label: string };
  triggerVictoryVoyage: () => boolean;
  toggleMute: () => boolean;
  isMuted: () => boolean;
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
  meat: THREE.Mesh;
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
  bowMesh: THREE.Mesh;
  hammerMesh: THREE.Mesh;
  rodGroup: THREE.Group;
  toolMats: {
    axe: THREE.MeshStandardMaterial;
    spear: THREE.MeshStandardMaterial;
    bow: THREE.MeshStandardMaterial;
    hammer: THREE.MeshStandardMaterial;
  };
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
    meatGeo: THREE.BufferGeometry;
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

    const meat = new THREE.Mesh(stackGeos.meatGeo, stackGeos.stackMat);
    meat.scale.setScalar(0.95);
    meat.visible = false;

    slotGroup.add(wood, fish, berries, shell, banana, meat);
    backStackGroup.add(slotGroup);
    backStackSlots.push({ group: slotGroup, wood, fish, berries, shell, banana, meat });
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

  // Equipable 3D Chopping Axe, Fishing Spear, Fire Spear, Hunting Bow, Storm Hammer & Fishing Rod
  const makeToolMat = () =>
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.14,
      vertexColors: true,
    });
  const axeMat = makeToolMat();
  const spearMat = makeToolMat();
  const bowMat = makeToolMat();
  const hammerMat = makeToolMat();
  const rodMat = makeToolMat();
  const axeGeo = buildAxeToolGeometry();
  const spearGeo = buildSpearToolGeometry(false);
  const fireSpearGeo = buildSpearToolGeometry(true);
  const bowGeo = buildBowToolGeometry();
  const hammerGeo = buildHammerToolGeometry();
  const rodGeo = buildFishingRodPoleGeometry();
  rigDisposables.push(
    axeMat,
    spearMat,
    bowMat,
    hammerMat,
    rodMat,
    axeGeo,
    spearGeo,
    fireSpearGeo,
    bowGeo,
    hammerGeo,
    rodGeo,
    packGeo
  );

  const axeMesh = new THREE.Mesh(axeGeo, axeMat);
  axeMesh.position.set(0, -0.24, 0.05);
  axeMesh.rotation.x = Math.PI * 0.42;
  axeMesh.castShadow = true;
  axeMesh.visible = false;
  rightArm.add(axeMesh);

  const spearMesh = new THREE.Mesh(spearGeo, spearMat);
  spearMesh.position.set(0, -0.24, 0.05);
  spearMesh.rotation.x = Math.PI * 0.48;
  spearMesh.castShadow = true;
  spearMesh.visible = false;
  rightArm.add(spearMesh);

  const fireSpearMesh = new THREE.Mesh(fireSpearGeo, spearMat);
  fireSpearMesh.position.set(0, -0.24, 0.05);
  fireSpearMesh.rotation.x = Math.PI * 0.48;
  fireSpearMesh.castShadow = true;
  fireSpearMesh.visible = false;
  rightArm.add(fireSpearMesh);

  const bowMesh = new THREE.Mesh(bowGeo, bowMat);
  bowMesh.position.set(0, -0.24, 0.08);
  bowMesh.rotation.z = 0.15;
  bowMesh.castShadow = true;
  bowMesh.visible = false;
  leftArm.add(bowMesh);

  const hammerMesh = new THREE.Mesh(hammerGeo, hammerMat);
  hammerMesh.position.set(0, -0.24, 0.05);
  hammerMesh.rotation.x = Math.PI * 0.42;
  hammerMesh.castShadow = true;
  hammerMesh.visible = false;
  rightArm.add(hammerMesh);

  const rodGroup = new THREE.Group();
  rodGroup.position.set(0, -0.24, 0.05);
  rodGroup.rotation.x = Math.PI * 0.28;
  rodGroup.visible = false;
  const rodPole = new THREE.Mesh(rodGeo, rodMat);
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
    bowMesh,
    hammerMesh,
    rodGroup,
    toolMats: {
      axe: axeMat,
      spear: spearMat,
      bow: bowMat,
      hammer: hammerMat,
    },
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
  shadowOffsetX: number;
  shadowOffsetZ: number;
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

  // 3D Instanced Rain Streaks & Ground Raindrop Ripples for Dynamic Weather
  const rainCount = 240;
  const rainDropGeo = new THREE.CapsuleGeometry(0.016, 0.45, 3, 5);
  const rainDropMat = new THREE.MeshBasicMaterial({
    color: 0xd4f0ff,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  const rainInst = new THREE.InstancedMesh(rainDropGeo, rainDropMat, rainCount);
  rainInst.frustumCulled = false;
  rainInst.visible = false;
  scene.add(rainInst);
  const rainOffsets: Array<{ x: number; y: number; z: number; spd: number }> = [];
  for (let i = 0; i < rainCount; i += 1) {
    rainOffsets.push({
      x: Math.sin(i * 19.3) * 0.5 * 44,
      y: ((i * 0.37) % 1) * 18,
      z: Math.cos(i * 27.7) * 0.5 * 38,
      spd: 18 + (i % 5) * 2.4,
    });
  }
  const rainDummy = new THREE.Object3D();

  const rippleCount = 24;
  const rainRippleGeo = new THREE.RingGeometry(0.18, 0.25, 16);
  rainRippleGeo.rotateX(-Math.PI / 2);
  const rainRippleMat = new THREE.MeshBasicMaterial({
    color: 0xdaf4ff,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const rainRippleInst = new THREE.InstancedMesh(rainRippleGeo, rainRippleMat, rippleCount);
  rainRippleInst.frustumCulled = false;
  rainRippleInst.visible = false;
  scene.add(rainRippleInst);
  const ripplePool: Array<{ x: number; y: number; z: number; age: number; life: number }> = [];
  for (let i = 0; i < rippleCount; i += 1) {
    ripplePool.push({ x: 0, y: 0, z: 0, age: (i / rippleCount) * 0.7, life: 0.65 });
  }

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
    rainRippleGeo,
    rainRippleMat,
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

  // GPU Ocean Shader with dynamic tide level, richer lagoon caustics & crisp dual-band surf foam
  let heightTex: THREE.DataTexture | null = null;
  const oceanMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uSeaLevel: { value: 0 },
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
      uniform float uSeaLevel;
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
        float waterDepth = max(0.0, uSeaLevel - terrainH);

        float shallowMask = exp(-waterDepth * 0.72);
        vec3 col = mix(uDeepColor, uShallowColor, shallowMask);

        float ripple = wavePattern(vWorldPos.xz * 1.15, uTime);
        float causticA = smoothstep(0.32, 0.92, wavePattern(vWorldPos.xz * 0.76 + vec2(uTime * 0.25, -uTime * 0.18), uTime * 1.25));
        float causticB = smoothstep(0.45, 0.95, wavePattern(vWorldPos.xz * 1.18 - vec2(uTime * 0.14, uTime * 0.22), uTime * 0.9));
        col += vec3(0.11, 0.24, 0.27) * (causticA * 0.75 + causticB * 0.45) * (0.35 + 0.65 * shallowMask);

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 waveN = normalize(vec3(ripple * 0.09, 1.0, wavePattern(vWorldPos.xz * 1.35 + 4.2, -uTime) * 0.09));
        vec3 halfVec = normalize(uSunDir + viewDir);
        float spec = pow(max(dot(waveN, halfVec), 0.0), 48.0);
        col += vec3(1.0, 0.97, 0.88) * spec * 0.56;

        float foamZone = 1.0 - smoothstep(0.02, 1.08, waterDepth);
        float surfWave = sin(waterDepth * 21.0 - uTime * 2.8 + ripple * 2.0);
        float shoreLine = 1.0 - smoothstep(0.0, 0.22, waterDepth);
        float foamAmt = clamp(shoreLine * 0.92 + foamZone * smoothstep(0.28, 0.84, surfWave) * 0.72, 0.0, 1.0);
        col = mix(col, uFoamColor, foamAmt * 0.9);

        float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 2.8);
        col = mix(col, uFogColor, fresnel * 0.34);

        float dist = length(cameraPosition - vWorldPos);
        float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
        col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

        float alpha = mix(0.95, 0.68, shallowMask * (1.0 - foamAmt * 0.52));
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

  // Focus Target Reticle (shows what F / Space / Action Button will target before interacting)
  const focusRingGeo = new THREE.RingGeometry(0.95, 1.24, 32);
  focusRingGeo.rotateX(-Math.PI / 2);
  const focusRingMat = new THREE.MeshBasicMaterial({
    color: 0x52f2ff,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const focusRingMesh = new THREE.Mesh(focusRingGeo, focusRingMat);
  focusRingMesh.visible = false;
  focusRingMesh.renderOrder = 3;
  scene.add(focusRingMesh);

  // Hammer AoE Shockwave Ring
  const hammerRingGeo = new THREE.RingGeometry(0.65, 1.0, 36);
  hammerRingGeo.rotateX(-Math.PI / 2);
  const hammerRingMat = new THREE.MeshBasicMaterial({
    color: 0xffd24d,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const hammerRingMesh = new THREE.Mesh(hammerRingGeo, hammerRingMat);
  hammerRingMesh.visible = false;
  hammerRingMesh.renderOrder = 4;
  scene.add(hammerRingMesh);
  let hammerWaveAge = -1;

  // Flying Bow Arrow Pool & World Event Projectiles (Meteors + Volcano Magma Bombs)
  const arrowGeoProj = buildArrowGeometry();
  const arrowProjMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
    vertexColors: true,
  });
  const arrowPool: Array<{
    mesh: THREE.Mesh;
    active: boolean;
    age: number;
    duration: number;
    start: THREE.Vector3;
    end: THREE.Vector3;
  }> = [];
  for (let i = 0; i < 6; i += 1) {
    const mesh = new THREE.Mesh(arrowGeoProj, arrowProjMat);
    mesh.visible = false;
    scene.add(mesh);
    arrowPool.push({
      mesh,
      active: false,
      age: 0,
      duration: 0.24,
      start: new THREE.Vector3(),
      end: new THREE.Vector3(),
    });
  }

  const eventProjGeo = new THREE.SphereGeometry(0.28, 10, 8);
  const lavaBombMat = new THREE.MeshBasicMaterial({ color: 0xff6a1f });
  const meteorMat = new THREE.MeshBasicMaterial({ color: 0x9ef8ff });
  const eventProjPool: Array<{
    mesh: THREE.Mesh;
    active: boolean;
    age: number;
    life: number;
    vx: number;
    vy: number;
    vz: number;
    gravity: number;
  }> = [];
  for (let i = 0; i < 10; i += 1) {
    const mesh = new THREE.Mesh(eventProjGeo, lavaBombMat);
    mesh.visible = false;
    scene.add(mesh);
    eventProjPool.push({ mesh, active: false, age: 0, life: 1.4, vx: 0, vy: 0, vz: 0, gravity: 9.8 });
  }

  // Click Target Pulse Ring + Localized Hazard Rings / Falling Meteors / Lightning Bolts / Predator Telegraphs & Claw Slashes
  const clickRingGeo = new THREE.RingGeometry(0.45, 0.72, 24);
  clickRingGeo.rotateX(-Math.PI / 2);
  const clickRingMat = new THREE.MeshBasicMaterial({
    color: 0x62f8ff,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const clickRingMesh = new THREE.Mesh(clickRingGeo, clickRingMat);
  clickRingMesh.visible = false;
  clickRingMesh.renderOrder = 4;
  scene.add(clickRingMesh);

  const hazardRingGeo = new THREE.RingGeometry(0.84, 1.0, 28);
  hazardRingGeo.rotateX(-Math.PI / 2);
  const hazardDiscGeo = new THREE.CircleGeometry(0.92, 24);
  hazardDiscGeo.rotateX(-Math.PI / 2);
  const hazardMeteorGeo = new THREE.SphereGeometry(0.45, 10, 8);
  const hazardVisPool: Array<{
    ring: THREE.Mesh;
    disc: THREE.Mesh;
    proj: THREE.Mesh;
    ringMat: THREE.MeshBasicMaterial;
    discMat: THREE.MeshBasicMaterial;
    projMat: THREE.MeshBasicMaterial;
  }> = [];
  for (let i = 0; i < 10; i += 1) {
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff3b2f,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const discMat = new THREE.MeshBasicMaterial({
      color: 0xff6230,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const projMat = new THREE.MeshBasicMaterial({ color: 0xffa62b });
    const ring = new THREE.Mesh(hazardRingGeo, ringMat);
    const disc = new THREE.Mesh(hazardDiscGeo, discMat);
    const proj = new THREE.Mesh(hazardMeteorGeo, projMat);
    ring.visible = false;
    disc.visible = false;
    proj.visible = false;
    ring.renderOrder = 4;
    disc.renderOrder = 4;
    scene.add(ring, disc, proj);
    disposables.push(ringMat, discMat, projMat);
    hazardVisPool.push({ ring, disc, proj, ringMat, discMat, projMat });
  }

  const boltGeo = buildLightningBoltGeometry();
  const boltMat = new THREE.MeshBasicMaterial({
    color: 0xbef6ff,
    transparent: true,
    opacity: 0.95,
    vertexColors: true,
  });
  const boltPool: Array<{ mesh: THREE.Mesh; age: number; active: boolean }> = [];
  for (let i = 0; i < 4; i += 1) {
    const mesh = new THREE.Mesh(boltGeo, boltMat);
    mesh.visible = false;
    scene.add(mesh);
    boltPool.push({ mesh, age: 0, active: false });
  }

  const clawSlashGeo = buildClawSlashGeometry();
  const clawSlashPool: Array<{
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    age: number;
    active: boolean;
  }> = [];
  for (let i = 0; i < 4; i += 1) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      vertexColors: true,
    });
    const mesh = new THREE.Mesh(clawSlashGeo, mat);
    mesh.visible = false;
    mesh.renderOrder = 5;
    scene.add(mesh);
    disposables.push(mat);
    clawSlashPool.push({ mesh, mat, age: 0, active: false });
  }

  const predWarnRingGeo = new THREE.RingGeometry(0.75, 1.02, 24);
  predWarnRingGeo.rotateX(-Math.PI / 2);
  const predWarnRingMat = new THREE.MeshBasicMaterial({
    color: 0xff2b2b,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const predWarnPool: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i += 1) {
    const m = new THREE.Mesh(predWarnRingGeo, predWarnRingMat);
    m.visible = false;
    m.renderOrder = 4;
    scene.add(m);
    predWarnPool.push(m);
  }

  // Seasonal Instanced Falling Leaf / Snowflake Particle Pool (120 motes)
  const seasonParticleCount = 120;
  const leafSnowGeo = buildLeafSnowQuadGeometry();
  const leafSnowMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
  });
  const leafSnowInst = new THREE.InstancedMesh(leafSnowGeo, leafSnowMat, seasonParticleCount);
  leafSnowInst.frustumCulled = false;
  leafSnowInst.visible = false;
  scene.add(leafSnowInst);
  const seasonParticleData: Array<{
    x: number;
    y: number;
    z: number;
    spd: number;
    phase: number;
    spin: number;
    tintIdx: number;
  }> = [];
  for (let i = 0; i < seasonParticleCount; i += 1) {
    seasonParticleData.push({
      x: Math.sin(i * 17.7) * 20,
      y: ((i * 0.43) % 1) * 14,
      z: Math.cos(i * 23.1) * 18,
      spd: 1.6 + (i % 5) * 0.42,
      phase: i * 0.71,
      spin: (i % 2 === 0 ? 1 : -1) * (1.8 + (i % 4) * 0.5),
      tintIdx: i % 4,
    });
  }
  const autumnPalette = [
    new THREE.Color(0xff7b1c),
    new THREE.Color(0xffa62b),
    new THREE.Color(0xe3451e),
    new THREE.Color(0xffcf40),
  ];
  const winterColor = new THREE.Color(0xf4fbff);
  const seasonDummy = new THREE.Object3D();

  disposables.push(
    harvestRingGeo,
    harvestRingMat,
    focusRingGeo,
    focusRingMat,
    hammerRingGeo,
    hammerRingMat,
    arrowGeoProj,
    arrowProjMat,
    eventProjGeo,
    lavaBombMat,
    meteorMat,
    clickRingGeo,
    clickRingMat,
    hazardRingGeo,
    hazardDiscGeo,
    hazardMeteorGeo,
    boltGeo,
    boltMat,
    clawSlashGeo,
    predWarnRingGeo,
    predWarnRingMat,
    leafSnowGeo,
    leafSnowMat
  );

  let obeliskCrystal: THREE.Mesh | null = null;
  let obeliskHalo: THREE.Mesh | null = null;
  let obeliskHaloInner: THREE.Mesh | null = null;
  let lavaPoolMesh: THREE.Mesh | null = null;
  let springWaterMesh: THREE.Mesh | null = null;
  let waterfallMat: THREE.ShaderMaterial | null = null;
  let beaconFlameMesh: THREE.Mesh | null = null;
  let beaconBeamMesh: THREE.Mesh | null = null;
  let fireflyGroup: THREE.Group | null = null;
  let campFlames: THREE.Mesh[] = [];
  let campAuraRing: THREE.Mesh | null = null;
  let campCoalBed: THREE.Mesh | null = null;
  let campEmberInst: THREE.InstancedMesh | null = null;
  const campEmberSeeds: Array<{ ang: number; rad: number; spd: number; phase: number }> = [];
  for (let i = 0; i < 48; i += 1) {
    campEmberSeeds.push({
      ang: (i / 48) * Math.PI * 2 * 3,
      rad: 0.14 + (i % 5) * 0.11,
      spd: 0.7 + (i % 4) * 0.25,
      phase: (i / 48) * 1.0,
    });
  }
  let windUniformTime: { value: number } | null = null;
  const seasonUniformMix = { value: 0 };
  const seasonUniformKind = { value: 0 };
  let activeTerrainMesh: THREE.Mesh | null = null;
  let activeTerrainMat: THREE.MeshStandardMaterial | null = null;
  let activeRockMainMat: THREE.MeshStandardMaterial | null = null;
  let activeRockLightMat: THREE.MeshStandardMaterial | null = null;
  let activePebbleMat: THREE.MeshStandardMaterial | null = null;
  let islandDisposables: Array<{ dispose: () => void }> = [];

  // Interactive harvest, fishing, shell, secret chests & camp build pad visual bindings
  const bushNodeVisuals = new Map<string, { group: THREE.Group; berries: THREE.Mesh[]; baseScale: number }>();
  const shellNodeVisuals = new Map<string, { mesh: THREE.Mesh; baseScale: number }>();
  const fishingVisuals = new Map<string, { fishA: THREE.Mesh; fishB: THREE.Mesh; ripple: THREE.Mesh; waterX: number; waterZ: number }>();
  const buildPadVisuals = new Map<CampUpgradeId, { padGroup: THREE.Group; builtGroup: THREE.Group; popAge: number }>();
  const landmarkRingVisuals = new Map<StrangeLandmarkId, THREE.Mesh>();
  const secretSpotVisuals = new Map<
    string,
    { group: THREE.Group; lid: THREE.Mesh; glowRing: THREE.Mesh; sparkles: THREE.Mesh[]; openAnim: number }
  >();
  const treeNodeVisuals = new Map<string, InstancedTreeBinding>();
  const bananaBunchVisuals = new Map<string, { trunkMesh: THREE.InstancedMesh; canopyMesh: THREE.InstancedMesh; bunchMesh: THREE.InstancedMesh; index: number; prop: IslandProp }>();
  const animalGeoLib = createAnimalGeometryLibrary();
  const animalRigBindings = new Map<string, AnimalVisualRig>();
  let campRoastGroup: THREE.Group | null = null;
  let campRoastFish: THREE.Mesh | null = null;
  let campRoastBanana: THREE.Mesh | null = null;
  let campRoastMeat: THREE.Mesh | null = null;

  // Shared geometries & materials for survivor back-stack + flying 3D item arcs
  const stackWoodGeo = buildWoodLogGeometry(0.085, 0.52);
  const stackFishGeo = buildFishGeometry();
  const stackBerryGeo = new THREE.SphereGeometry(0.09, 8, 7);
  const stackShellGeo = buildSeashellGeometry();
  const stackBananaGeo = buildBananaItemGeometry(1.0);
  const stackMeatGeo = buildMeatCutGeometry();
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
    stackMeatGeo,
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
      meatGeo: stackMeatGeo,
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
  const chipMeatMat = new THREE.MeshBasicMaterial({ color: 0xe64538 });
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
    chipMeatMat,
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
    secretSpotVisuals.clear();
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
    obeliskHaloInner = null;
    lavaPoolMesh = null;
    springWaterMesh = null;
    waterfallMat = null;
    beaconFlameMesh = null;
    beaconBeamMesh = null;
    fireflyGroup = null;
    campFlames = [];
    campAuraRing = null;
    campCoalBed = null;
    campEmberInst = null;
    campRoastGroup = null;
    campRoastFish = null;
    campRoastBanana = null;
    campRoastMeat = null;
    activeTerrainMesh = null;
    activeTerrainMat = null;
    activeRockMainMat = null;
    activeRockLightMat = null;
    activePebbleMat = null;
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

    const coalBedGeo = new THREE.CircleGeometry(0.64, 16);
    coalBedGeo.rotateX(-Math.PI / 2);
    const coalBedMat = new THREE.MeshStandardMaterial({
      color: 0xff5a12,
      emissive: 0xff4200,
      emissiveIntensity: 1.5,
      roughness: 0.4,
    });
    campCoalBed = new THREE.Mesh(coalBedGeo, coalBedMat);
    campCoalBed.position.y = 0.05;
    campGroup.add(campCoalBed);

    const flameWhiteCoreMat = new THREE.MeshStandardMaterial({
      color: 0xfff8d6,
      emissive: 0xffea88,
      emissiveIntensity: 1.85,
      roughness: 0.15,
    });
    const campEmberGeo = new THREE.SphereGeometry(0.05, 6, 5);
    const campEmberMat = new THREE.MeshBasicMaterial({ color: 0xffbc42 });
    campEmberInst = new THREE.InstancedMesh(campEmberGeo, campEmberMat, campEmberSeeds.length);
    campEmberInst.frustumCulled = false;
    campGroup.add(campEmberInst);
    islandDisposables.push(coalBedGeo, coalBedMat, flameWhiteCoreMat, campEmberGeo, campEmberMat);

    const flameMain = new THREE.Mesh(campFlameGeo, flameOuterMat);
    flameMain.position.y = 0.2;
    flameMain.scale.set(1.05, 1.15, 1.05);
    const flameCore = new THREE.Mesh(campFlameGeo, flameInnerMat);
    flameCore.position.y = 0.24;
    flameCore.scale.set(0.68, 0.88, 0.68);
    const flameTip = new THREE.Mesh(campFlameGeo, flameWhiteCoreMat);
    flameTip.position.y = 0.28;
    flameTip.scale.set(0.38, 0.56, 0.38);
    const flameSide = new THREE.Mesh(campFlameGeo, flameOuterMat);
    flameSide.position.set(0.18, 0.19, -0.09);
    flameSide.rotation.z = -0.22;
    flameSide.scale.set(0.58, 0.72, 0.58);
    const flameSideL = new THREE.Mesh(campFlameGeo, flameInnerMat);
    flameSideL.position.set(-0.17, 0.2, 0.1);
    flameSideL.rotation.z = 0.2;
    flameSideL.scale.set(0.52, 0.66, 0.52);
    campFlames = [flameMain, flameCore, flameSide, flameSideL, flameTip];
    campGroup.add(flameMain, flameCore, flameTip, flameSide, flameSideL);

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
    campRoastMeat = new THREE.Mesh(stackMeatGeo, stackVertexMat);
    campRoastMeat.position.set(0, 0.86, 0);
    campRoastMeat.scale.setScalar(1.42);
    campRoastMeat.visible = false;
    campRoastGroup.add(postL, postR, crossbar, campRoastFish, campRoastBanana, campRoastMeat);
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
    const boatGeo = buildBoatCradleGeometry();
    islandDisposables.push(
      padRingGeo,
      padMarkerGeo,
      padRingMat,
      builtStructureMat,
      shelterGeo,
      rackGeo,
      pierGeo,
      boatGeo
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
        pad.id === 'shelter'
          ? shelterGeo
          : pad.id === 'rack'
            ? rackGeo
            : pad.id === 'pier'
              ? pierGeo
              : boatGeo;
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

    // 0D. 5 HIDDEN SECRET PLACE CHESTS (With hinged animated lid + firefly halo!)
    if (world.secretSpots && world.secretSpots.length > 0) {
      const secretBaseGeo = buildSecretChestBaseGeometry();
      const secretLidGeo = buildSecretChestLidGeometry();
      const secretMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.5,
        metalness: 0.18,
        vertexColors: true,
      });
      const secretGlowGeo = new THREE.RingGeometry(0.95, 1.32, 28);
      secretGlowGeo.rotateX(-Math.PI / 2);
      const secretSparkGeo = new THREE.SphereGeometry(0.08, 7, 6);
      const secretSparkMat = new THREE.MeshBasicMaterial({ color: 0xffea75 });
      islandDisposables.push(secretBaseGeo, secretLidGeo, secretMat, secretGlowGeo, secretSparkGeo, secretSparkMat);

      for (const sec of world.secretSpots) {
        const sGroup = new THREE.Group();
        sGroup.position.set(sec.x, sec.y - 0.03, sec.z);
        sGroup.rotation.y = Math.atan2(-sec.x, -sec.z);

        const baseMesh = new THREE.Mesh(secretBaseGeo, secretMat);
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        sGroup.add(baseMesh);

        const lidMesh = new THREE.Mesh(secretLidGeo, secretMat);
        lidMesh.position.set(0, 0.66, -0.32);
        lidMesh.castShadow = true;
        sGroup.add(lidMesh);

        const glowMat = new THREE.MeshBasicMaterial({
          color: 0xffd24d,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const glowRing = new THREE.Mesh(secretGlowGeo, glowMat);
        glowRing.position.y = 0.08;
        sGroup.add(glowRing);
        islandDisposables.push(glowMat);

        const sparkles: THREE.Mesh[] = [];
        for (let k = 0; k < 3; k += 1) {
          const sp = new THREE.Mesh(secretSparkGeo, secretSparkMat);
          const ang = (k / 3) * Math.PI * 2;
          sp.position.set(Math.cos(ang) * 0.75, 1.05 + k * 0.14, Math.sin(ang) * 0.75);
          sGroup.add(sp);
          sparkles.push(sp);
        }

        islandGroup.add(sGroup);
        secretSpotVisuals.set(sec.id, { group: sGroup, lid: lidMesh, glowRing, sparkles, openAnim: 0 });
      }
    }

    // 1. ANCIENT RUINS: Stepped Sun Dais + Dual Rune Halos + 4 Glowing Braziers + Monolith Arch
    const ruinsBaseY = groundHeightAt(RUINS.CX, RUINS.CZ, world);
    const ruinsGroup = new THREE.Group();
    ruinsGroup.position.set(RUINS.CX, ruinsBaseY - 0.08, RUINS.CZ);

    const altarBaseGeo = buildSculptedBoulderGeometry(2.6, 1.2, false);
    altarBaseGeo.scale(1.05, 0.19, 1.05);
    const altarTopGeo = buildSculptedBoulderGeometry(1.75, 2.7, false);
    altarTopGeo.scale(1.0, 0.2, 1.0);
    const obeliskGeo = buildSculptedSunCrystalGeometry();
    const haloGeo = new THREE.TorusGeometry(1.85, 0.085, 10, 36);
    const haloInnerGeo = new THREE.TorusGeometry(1.25, 0.055, 8, 28);
    const sunDialRingGeo = new THREE.RingGeometry(2.45, 2.72, 36);
    sunDialRingGeo.rotateX(-Math.PI / 2);
    const brazierGeo = buildBrazierGeometry();
    const brazierFlameGeo = buildFlameTongueGeometry();
    const archPillarGeo = buildSculptedStoneSlabGeometry(1.05, 3.6, 1.05, 1.5);
    const archLintelGeo = buildSculptedStoneSlabGeometry(5.6, 0.92, 1.2, 2.8);
    const obeliskMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.OBELISK_GLOW,
      emissive: CONFIG.COLORS.OBELISK_GLOW,
      emissiveIntensity: 0.92,
      roughness: 0.16,
      metalness: 0.25,
    });
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xa2faff,
      transparent: true,
      opacity: 0.8,
    });
    const sunGoldMat = new THREE.MeshStandardMaterial({
      color: 0xffd24d,
      emissive: 0xffaa1c,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.45,
      side: THREE.DoubleSide,
    });
    const brazierFlameMat = new THREE.MeshStandardMaterial({
      color: 0xffb838,
      emissive: 0xff6a00,
      emissiveIntensity: 1.45,
      roughness: 0.15,
    });
    islandDisposables.push(
      altarBaseGeo,
      altarTopGeo,
      obeliskGeo,
      haloGeo,
      haloInnerGeo,
      sunDialRingGeo,
      brazierGeo,
      brazierFlameGeo,
      archPillarGeo,
      archLintelGeo,
      obeliskMat,
      haloMat,
      sunGoldMat,
      brazierFlameMat
    );

    const altarBase = new THREE.Mesh(altarBaseGeo, stoneDarkMat);
    altarBase.position.y = 0.18;
    altarBase.receiveShadow = true;
    altarBase.castShadow = true;

    const altarTop = new THREE.Mesh(altarTopGeo, stoneMat);
    altarTop.position.y = 0.48;
    altarTop.castShadow = true;

    const sunDialRing = new THREE.Mesh(sunDialRingGeo, sunGoldMat);
    sunDialRing.position.y = 0.14;

    obeliskCrystal = new THREE.Mesh(obeliskGeo, obeliskMat);
    obeliskCrystal.position.y = 2.85;
    obeliskCrystal.castShadow = true;

    obeliskHalo = new THREE.Mesh(haloGeo, haloMat);
    obeliskHalo.rotation.x = Math.PI / 2;
    obeliskHalo.position.y = 1.75;

    obeliskHaloInner = new THREE.Mesh(haloInnerGeo, sunGoldMat);
    obeliskHaloInner.rotation.x = Math.PI * 0.36;
    obeliskHaloInner.position.y = 2.55;

    for (let b = 0; b < 4; b += 1) {
      const ba = (b / 4) * Math.PI * 2 + Math.PI * 0.25;
      const brazier = new THREE.Mesh(brazierGeo, stoneDarkMat);
      brazier.position.set(Math.cos(ba) * 3.85, 0.08, Math.sin(ba) * 3.85);
      brazier.castShadow = true;
      const bFlame = new THREE.Mesh(brazierFlameGeo, brazierFlameMat);
      bFlame.position.set(Math.cos(ba) * 3.85, 0.96, Math.sin(ba) * 3.85);
      bFlame.scale.setScalar(0.68);
      ruinsGroup.add(brazier, bFlame);
    }

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

    ruinsGroup.add(
      altarBase,
      altarTop,
      sunDialRing,
      obeliskCrystal,
      obeliskHalo,
      obeliskHaloInner,
      archL,
      archR,
      archTop
    );
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

    // 2. VOLCANO CALDERA: Animated Molten Lava Lake + Obsidian Magma Forge Anvil + Basalt Crags
    const pitGroundY = groundHeightAt(VOLCANO.CX, VOLCANO.CZ, world);
    const rimLevel = groundHeightAt(VOLCANO.CX + 5.3, VOLCANO.CZ, world);
    const volcGroup = new THREE.Group();
    volcGroup.position.set(VOLCANO.CX, pitGroundY + 0.52, VOLCANO.CZ);

    const lavaGeo = new THREE.CircleGeometry(3.55, 28);
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
    const anvilGeo = buildAnvilGeometry();
    const anvilMat = getPbrMat(0x2a2d36, 0.45);
    const spireMat = new THREE.MeshStandardMaterial({
      color: 0xff6d2e,
      emissive: 0xff4512,
      emissiveIntensity: 0.78,
      roughness: 0.2,
    });
    islandDisposables.push(lavaGeo, lavaMat, spireOuterGeo, spireCoreGeo, anvilGeo, spireMat);

    lavaPoolMesh = new THREE.Mesh(lavaGeo, lavaMat);
    volcGroup.add(lavaPoolMesh);
    islandGroup.add(volcGroup);

    // Obsidian Magma Forge Anvil beside the Volcano Shrine site!
    const forgeX = VOLCANO.CX - 6.8;
    const forgeZ = VOLCANO.CZ + 2.5;
    const forgeY = groundHeightAt(forgeX, forgeZ, world);
    const anvilMesh = new THREE.Mesh(anvilGeo, anvilMat);
    anvilMesh.position.set(forgeX, forgeY - 0.05, forgeZ);
    anvilMesh.rotation.y = 0.65;
    anvilMesh.scale.setScalar(1.18);
    anvilMesh.castShadow = true;
    islandGroup.add(anvilMesh);
    const forgeGlow = new THREE.Mesh(brazierFlameGeo, spireMat);
    forgeGlow.position.set(forgeX + 0.1, forgeY + 0.94, forgeZ);
    forgeGlow.scale.setScalar(0.36);
    islandGroup.add(forgeGlow);

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

    // 3. NORTHERN CRYSTAL HOT SPRING + TERRACED WATERFALL + CRYSTAL SPIRES
    const springGroundY = groundHeightAt(SPRING.CX, SPRING.CZ, world);
    const springPoolGeo = new THREE.CircleGeometry(4.55, 32);
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
    const wfRockGeo = buildSculptedBoulderGeometry(1.75, 4.4);
    wfRockGeo.scale(1.35, 1.45, 0.95);
    const waterfallGeo = new THREE.PlaneGeometry(2.1, 3.2, 6, 10);
    waterfallMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float streak = sin(vUv.x * 22.0) * 0.5 + 0.5;
          float flow = sin(vUv.y * 18.0 + uTime * 7.5 + streak * 2.0) * 0.5 + 0.5;
          float foamEdge = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
          vec3 waterCol = mix(vec3(0.28, 0.9, 1.0), vec3(0.94, 1.0, 1.0), flow * 0.65 + (1.0 - foamEdge) * 0.45);
          gl_FragColor = vec4(waterCol, 0.84);
        }
      `,
    });
    const springSpireGeo = buildCrystalClusterGeometry();
    const springSpireMat = new THREE.MeshStandardMaterial({
      color: 0x72f7ff,
      emissive: 0x3ee5ff,
      emissiveIntensity: 0.55,
      roughness: 0.18,
      metalness: 0.18,
    });
    const wfSpoutGeo = buildSculptedStoneSlabGeometry(1.4, 0.36, 0.85, 2.2);
    const wfFoamGeo = new THREE.TorusGeometry(0.95, 0.22, 6, 16);
    wfFoamGeo.rotateX(Math.PI / 2);
    const wfFoamMat = new THREE.MeshStandardMaterial({
      color: 0xe6ffff,
      emissive: 0x8ef7ff,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      transparent: true,
      opacity: 0.85,
    });
    islandDisposables.push(
      springPoolGeo,
      springPoolMat,
      wfRockGeo,
      waterfallGeo,
      waterfallMat,
      wfSpoutGeo,
      wfFoamGeo,
      wfFoamMat,
      springSpireGeo,
      springSpireMat
    );
    springWaterMesh = new THREE.Mesh(springPoolGeo, springPoolMat);
    springWaterMesh.position.set(SPRING.CX, springGroundY + 0.5, SPRING.CZ);
    islandGroup.add(springWaterMesh);

    const wfRock = new THREE.Mesh(wfRockGeo, stoneDarkMat);
    wfRock.position.set(SPRING.CX, springGroundY + 1.45, SPRING.CZ - 5.95);
    wfRock.castShadow = true;
    const wfSpout = new THREE.Mesh(wfSpoutGeo, stoneMat);
    wfSpout.position.set(SPRING.CX, springGroundY + 2.75, SPRING.CZ - 4.45);
    wfSpout.castShadow = true;
    const wfSheet = new THREE.Mesh(waterfallGeo, waterfallMat);
    wfSheet.position.set(SPRING.CX, springGroundY + 1.72, SPRING.CZ - 3.74);
    wfSheet.rotation.x = -0.18;
    const wfFoam = new THREE.Mesh(wfFoamGeo, wfFoamMat);
    wfFoam.position.set(SPRING.CX, springGroundY + 0.56, SPRING.CZ - 3.42);
    wfFoam.scale.set(1.25, 0.45, 0.72);
    islandGroup.add(wfRock, wfSpout, wfSheet, wfFoam);

    for (let i = 0; i < 4; i += 1) {
      const sa = (i / 4) * Math.PI * 2 + 0.65;
      const spire = new THREE.Mesh(springSpireGeo, springSpireMat);
      spire.position.set(
        SPRING.CX + Math.cos(sa) * 4.85,
        springGroundY + 0.1,
        SPRING.CZ + Math.sin(sa) * 4.85
      );
      spire.scale.setScalar(1.25 + (i % 2) * 0.35);
      spire.rotation.y = sa;
      islandGroup.add(spire);
    }

    // 4. GIANT BIOLUMINESCENT MUSHROOMS + SPORE LANTERN CLUSTERS + FIREFLIES
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
    const sporeOrbGeo = new THREE.SphereGeometry(0.13, 8, 7);
    const sporeOrbMat = new THREE.MeshStandardMaterial({
      color: 0xffa8f5,
      emissive: 0xd966ff,
      emissiveIntensity: 1.1,
      roughness: 0.2,
    });
    islandDisposables.push(
      spotMat,
      stemGeo,
      capGeo,
      gillConeGeo,
      gillRingGeo,
      spotGeo,
      sporeOrbGeo,
      sporeOrbMat
    );

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

      // Hanging glowing spore lanterns under giant cap edge
      for (let h = 0; h < 3; h += 1) {
        const ha = (h / 3) * Math.PI * 2 + 0.5;
        const orb = new THREE.Mesh(sporeOrbGeo, h % 2 === 0 ? spotMat : sporeOrbMat);
        orb.position.set(capCenterX + Math.cos(ha) * 1.02, 1.62 - (h % 2) * 0.18, Math.sin(ha) * 1.02);
        mg.add(orb);
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
    const ffGeo = new THREE.SphereGeometry(0.11, 6, 6);
    const ffMat = new THREE.MeshBasicMaterial({ color: 0x8efeff });
    islandDisposables.push(ffGeo, ffMat);
    for (let i = 0; i < 30; i += 1) {
      const ff = new THREE.Mesh(ffGeo, ffMat);
      const a = (i / 30) * Math.PI * 2;
      const dist = 2.2 + (i % 6) * 2.0;
      ff.position.set(Math.cos(a) * dist, (i % 4) * 0.55, Math.sin(a) * dist);
      fireflyGroup.add(ff);
    }
    islandGroup.add(fireflyGroup);

    // 5. SHIPWRECK COVE: Sculpted Hull + Pirate Pennant + Ship Wheel + Iron Anchor + Rotating Lighthouse Beam
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
    const pennantGeo = new THREE.ConeGeometry(0.32, 0.95, 4);
    pennantGeo.rotateZ(-Math.PI / 2);
    const pennantMat = getPbrMat(0xd93025, 0.65);
    const wheelRimGeo = new THREE.TorusGeometry(0.38, 0.045, 7, 16);
    const anchorGeo = buildAnchorGeometry();
    const ironMat = getPbrMat(0x3a434d, 0.55);
    const chestGeo = buildRoundedChestGeometry();
    const barrelGeo = buildWeatheredBarrelGeometry();
    islandDisposables.push(
      hullGeo,
      hullMat,
      cabinGeo,
      mastGeo,
      yardGeo,
      sailGeo,
      pennantGeo,
      wheelRimGeo,
      anchorGeo,
      chestGeo,
      barrelGeo
    );

    const hullMesh = new THREE.Mesh(hullGeo, hullMat);
    hullMesh.castShadow = true;
    hullMesh.receiveShadow = true;

    const sternCabin = new THREE.Mesh(cabinGeo, woodDarkMat);
    sternCabin.position.set(-1.55, 1.0, 0);
    sternCabin.castShadow = true;

    const shipWheel = new THREE.Mesh(wheelRimGeo, woodMat);
    shipWheel.position.set(-0.78, 1.48, 0);
    shipWheel.rotation.y = Math.PI / 2;

    const mast = new THREE.Mesh(mastGeo, woodDarkMat);
    mast.position.set(0.45, 2.55, 0);
    mast.rotation.z = -0.22;
    mast.castShadow = true;

    const yard = new THREE.Mesh(yardGeo, woodDarkMat);
    yard.position.set(0.9, 4.05, 0);
    yard.rotation.y = 0.25;

    const pennant = new THREE.Mesh(pennantGeo, pennantMat);
    pennant.position.set(1.25, 4.78, 0);

    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0.95, 2.95, -0.95);
    sail.rotation.y = 0.25;
    sail.castShadow = true;
    (sailMat as THREE.MeshStandardMaterial).side = THREE.DoubleSide;

    shipGroup.add(hullMesh, sternCabin, shipWheel, mast, yard, pennant, sail);
    islandGroup.add(shipGroup);

    const anchorX = SHIPWRECK.HULL_CX + 3.25;
    const anchorZ = SHIPWRECK.HULL_CZ - 1.25;
    const anchorMesh = new THREE.Mesh(anchorGeo, ironMat);
    anchorMesh.position.set(anchorX, groundHeightAt(anchorX, anchorZ, world) + 0.04, anchorZ);
    anchorMesh.rotation.set(1.15, 0.4, -0.35);
    anchorMesh.castShadow = true;
    islandGroup.add(anchorMesh);

    const chestX = SHIPWRECK.HULL_CX - 3.0;
    const chestZ = SHIPWRECK.HULL_CZ + 0.6;
    const chestA = new THREE.Mesh(chestGeo, woodMat);
    chestA.position.set(chestX, groundHeightAt(chestX, chestZ, world) - 0.04, chestZ);
    chestA.rotation.y = 0.4;
    chestA.castShadow = true;
    islandGroup.add(chestA);

    const goldCoinGeo = new THREE.SphereGeometry(0.11, 8, 6);
    islandDisposables.push(goldCoinGeo);
    for (let g = 0; g < 4; g += 1) {
      const glint = new THREE.Mesh(goldCoinGeo, sunGoldMat);
      glint.scale.set(1, 0.45, 1);
      glint.position.set(
        chestX + (g - 1.5) * 0.22,
        groundHeightAt(chestX, chestZ, world) + 0.08,
        chestZ + 0.42 + (g % 2) * 0.14
      );
      islandGroup.add(glint);
    }

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

    // Sculpted Coastal Lighthouse Dome Beacon + Rotating Spotlight Cone
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
    const beamGeo = new THREE.ConeGeometry(2.1, 11.5, 16, 1, true);
    beamGeo.translate(0, -5.75, 0);
    beamGeo.rotateX(Math.PI * 0.5);
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xffe878,
      emissive: 0xffa81c,
      emissiveIntensity: 1.15,
      roughness: 0.15,
    });
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff3a8,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    islandDisposables.push(
      towerGeo,
      strutGeo,
      lanternCapGeo,
      flameGeo,
      beamGeo,
      flameMat,
      beamMat
    );

    const tower = new THREE.Mesh(towerGeo, stoneMat);
    tower.castShadow = true;
    const cap = new THREE.Mesh(lanternCapGeo, stoneDarkMat);
    cap.position.y = 4.65;
    cap.scale.set(1, 0.85, 1);
    beaconFlameMesh = new THREE.Mesh(flameGeo, flameMat);
    beaconFlameMesh.position.y = 4.25;
    beaconBeamMesh = new THREE.Mesh(beamGeo, beamMat);
    beaconBeamMesh.position.y = 4.25;

    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const strut = new THREE.Mesh(strutGeo, stoneDarkMat);
      strut.position.set(Math.cos(a) * 0.68, 4.25, Math.sin(a) * 0.68);
      beaconGroup.add(strut);
    }
    beaconGroup.add(tower, cap, beaconFlameMesh, beaconBeamMesh);
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

    // Shared Wind Sway + Seasonal Autumn/Winter Hook
    windUniformTime = { value: 0 };
    const applySeasonAndWind = (
      mat: THREE.MeshStandardMaterial,
      mode: 'terrain' | 'foliage',
      minY = 0,
      ampScale = 0
    ) => {
      const timeRef = windUniformTime!;
      const mixRef = seasonUniformMix;
      const kindRef = seasonUniformKind;
      mat.customProgramCacheKey = () => `tropical-season-wind-v3-${mode}-${minY}-${ampScale}`;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uWindTime = timeRef;
        shader.uniforms.uSeasonMix = mixRef;
        shader.uniforms.uSeasonKind = kindRef;
        const windCode =
          ampScale > 0
            ? `
             #ifdef USE_INSTANCING
               vec3 instPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
               float hWeight = max(0.0, transformed.y - float(${minY.toFixed(2)}));
               float sway = sin(uWindTime * 2.1 + instPos.x * 0.35 + instPos.z * 0.28) * ${Number(0.095 * ampScale).toFixed(4)};
               transformed.x += sway * hWeight;
               transformed.z += cos(uWindTime * 1.65 + instPos.z * 0.3) * ${Number(0.05 * ampScale).toFixed(4)} * hWeight;
             #endif`
            : '';

        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
             uniform float uWindTime;
             varying vec3 vSeasonWPos;
             varying vec3 vSeasonWNorm;`
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             ${windCode}
             vec4 sWPos = modelMatrix * vec4(transformed, 1.0);
             #ifdef USE_INSTANCING
               sWPos = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
             #endif
             vSeasonWPos = sWPos.xyz;
             vSeasonWNorm = normalize(mat3(modelMatrix) * objectNormal);`
          );

        const fragSeasonCode =
          mode === 'terrain'
            ? `
             if (uSeasonMix > 0.01) {
               if (uSeasonKind > 0.5 && uSeasonKind < 1.5) {
                 float grassBand = smoothstep(0.95, 1.8, vSeasonWPos.y) * smoothstep(0.45, 0.9, vSeasonWNorm.y);
                 float autumnHue = 0.5 + 0.5 * sin(vSeasonWPos.x * 0.14 + vSeasonWPos.z * 0.16);
                 vec3 autumnGround = mix(vec3(0.74, 0.48, 0.14), vec3(0.84, 0.34, 0.12), autumnHue);
                 diffuseColor.rgb = mix(diffuseColor.rgb, autumnGround, uSeasonMix * grassBand * 0.62);
               } else if (uSeasonKind >= 1.5) {
                 float snowMask = smoothstep(1.25, 3.8, vSeasonWPos.y) * smoothstep(0.32, 0.85, vSeasonWNorm.y);
                 diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.97, 1.0), uSeasonMix * (0.28 + snowMask * 0.68));
               }
             }`
            : `
             if (uSeasonMix > 0.01) {
               if (uSeasonKind > 0.5 && uSeasonKind < 1.5) {
                 float leafMix = 0.5 + 0.5 * sin(vSeasonWPos.x * 0.32 - vSeasonWPos.z * 0.27);
                 vec3 autumnCol = mix(vec3(0.96, 0.45, 0.08), vec3(0.82, 0.22, 0.08), leafMix);
                 diffuseColor.rgb = mix(diffuseColor.rgb, autumnCol, uSeasonMix * 0.86);
               } else if (uSeasonKind >= 1.5) {
                 float topFrost = smoothstep(-0.1, 0.78, vSeasonWNorm.y);
                 diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.95, 1.0), uSeasonMix * (0.38 + topFrost * 0.48));
               }
             }`;

        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
             uniform float uSeasonMix;
             uniform float uSeasonKind;
             varying vec3 vSeasonWPos;
             varying vec3 vSeasonWNorm;`
          )
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
             ${fragSeasonCode}`
          );
      };
    };

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.terrainDetailDiffuse,
      bumpMap: textures.terrainDetailBump,
      bumpScale: 0.055,
      roughness: 0.88,
      metalness: 0.02,
      vertexColors: true,
    });
    applySeasonAndWind(terrainMat, 'terrain', 0, 0);
    activeTerrainMat = terrainMat;
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    activeTerrainMesh = terrainMesh;
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
      applySeasonAndWind(frondMat, 'foliage', 2.0, 0.25);
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
          shadowOffsetX: 0.4,
          shadowOffsetZ: 0.15,
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

    const applyWindSway = (mat: THREE.MeshStandardMaterial, minY = 0, ampScale = 1.0) => {
      applySeasonAndWind(mat, 'foliage', minY, ampScale);
    };

    // 4. INSTANCED ORGANIC FLOWERING & LUSH JUNGLE TREES (Two Canopy Variants + Blossom Sprays!)
    const jungleProps = world.props.filter((p) => p.kind === 'jungle');
    if (jungleProps.length > 0) {
      const jTrunkGeo = buildJungleTrunkGeometry();
      const jCanopyGeoA = buildJungleCanopyGeometry();
      const jCanopyGeoB = buildJungleCanopyVariantBGeometry();
      const jBlossomGeo = buildCanopyBlossomsGeometry();
      const jShadowGeo = new THREE.CircleGeometry(1.5, 16);
      jShadowGeo.rotateX(-Math.PI / 2);

      const jTrunkMat = getPbrMat(0x7c4b27, 0.9);
      const jCanopyMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.78,
        metalness: 0.02,
        side: THREE.DoubleSide,
        vertexColors: true,
      });
      applyWindSway(jCanopyMat, 2.0, 0.35);
      const jBlossomMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.52,
        metalness: 0.02,
        side: THREE.DoubleSide,
        vertexColors: true,
      });
      applyWindSway(jBlossomMat, 2.0, 0.35);

      const jTrunkInst = new THREE.InstancedMesh(jTrunkGeo, jTrunkMat, jungleProps.length);
      const jCanopyInstA = new THREE.InstancedMesh(jCanopyGeoA, jCanopyMat, jungleProps.length);
      const jCanopyInstB = new THREE.InstancedMesh(jCanopyGeoB, jCanopyMat, jungleProps.length);
      const jBlossomInst = new THREE.InstancedMesh(jBlossomGeo, jBlossomMat, jungleProps.length);
      const jShadowInst = new THREE.InstancedMesh(jShadowGeo, shadowDiscMat, jungleProps.length);
      const jStumpInst = new THREE.InstancedMesh(treeStumpGeo, treeStumpMat, jungleProps.length);

      jTrunkInst.castShadow = !isSoftwareGl;
      jCanopyInstA.castShadow = !isSoftwareGl;
      jCanopyInstB.castShadow = !isSoftwareGl;

      const palette = [
        new THREE.Color(0x88e878),
        new THREE.Color(0x9ff27a),
        new THREE.Color(0x70cf82),
        new THREE.Color(0xb2f574),
        new THREE.Color(0x7ee092),
      ];
      const dummy = new THREE.Object3D();
      jungleProps.forEach((p: IslandProp, idx: number) => {
        dummy.position.set(p.x, p.y - 0.14, p.z);
        dummy.rotation.set(0, p.rotationY, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        jTrunkInst.setMatrixAt(idx, dummy.matrix);

        const useB = p.variant % 2 === 1;
        jCanopyInstA.setMatrixAt(idx, useB ? hideDummy.matrix : dummy.matrix);
        jCanopyInstB.setMatrixAt(idx, useB ? dummy.matrix : hideDummy.matrix);
        jCanopyInstA.setColorAt(idx, palette[p.variant % palette.length]);
        jCanopyInstB.setColorAt(idx, palette[p.variant % palette.length]);
        jStumpInst.setMatrixAt(idx, hideDummy.matrix);

        if (p.variant >= 2) {
          jBlossomInst.setMatrixAt(idx, dummy.matrix);
        } else {
          jBlossomInst.setMatrixAt(idx, hideDummy.matrix);
        }

        const canopyMesh = useB ? jCanopyInstB : jCanopyInstA;
        treeNodeVisuals.set(p.id, {
          instMesh: jTrunkInst,
          extraMeshes: p.variant >= 2 ? [canopyMesh, jBlossomInst] : [canopyMesh],
          shadowMesh: jShadowInst,
          shadowOffsetX: 0.25,
          shadowOffsetZ: 0.1,
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
      jCanopyInstA.instanceMatrix.needsUpdate = true;
      jCanopyInstB.instanceMatrix.needsUpdate = true;
      jBlossomInst.instanceMatrix.needsUpdate = true;
      jStumpInst.instanceMatrix.needsUpdate = true;
      if (jCanopyInstA.instanceColor) jCanopyInstA.instanceColor.needsUpdate = true;
      if (jCanopyInstB.instanceColor) jCanopyInstB.instanceColor.needsUpdate = true;
      jShadowInst.instanceMatrix.needsUpdate = true;
      jTrunkInst.computeBoundingSphere();
      jCanopyInstA.computeBoundingSphere();
      jCanopyInstB.computeBoundingSphere();
      jBlossomInst.computeBoundingSphere();
      jShadowInst.computeBoundingSphere();
      jStumpInst.computeBoundingSphere();

      islandGroup.add(jShadowInst, jStumpInst, jTrunkInst, jCanopyInstA, jCanopyInstB, jBlossomInst);
      islandDisposables.push(
        jCanopyMat,
        jBlossomMat,
        jTrunkGeo,
        jCanopyGeoA,
        jCanopyGeoB,
        jBlossomGeo,
        jShadowGeo
      );
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
      applySeasonAndWind(pCanopyMat, 'foliage', 2.0, 0.2);

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
          shadowOffsetX: 0.2,
          shadowOffsetZ: 0.1,
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
      applySeasonAndWind(byCanopyMat, 'foliage', 2.0, 0.2);

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
          shadowOffsetX: 0.28,
          shadowOffsetZ: 0.12,
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
      applySeasonAndWind(wCanopyMat, 'foliage', 1.8, 0.3);

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
          shadowOffsetX: 0.2,
          shadowOffsetZ: 0.1,
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
    activeRockMainMat = rockMainMat;
    activeRockLightMat = rockLightMat;
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

    // 8. INSTANCED DIVERSE GRASSES, CLOVER PATCHES, PLUME GRASS & FERNS
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
    applyWindSway(grassMat, 0, 1.0);
    const grassMatrices: THREE.Matrix4[] = [];
    const grassColors: THREE.Color[] = [];
    const grassPalette = [
      new THREE.Color(0x9ff08a),
      new THREE.Color(0xb4f584),
      new THREE.Color(0x88dc84),
      new THREE.Color(0xa6ea96),
    ];
    for (let i = 0; i < CONFIG.PROPS.GRASS_TUFT_COUNT; i += 1) {
      const phi = floraRng() * Math.PI * 2;
      const rad = Math.sqrt(floraRng());
      const gx = Math.cos(phi) * 84 * rad;
      const gz = Math.sin(phi) * 70 * rad;
      const gy = groundHeightAt(gx, gz, world);
      if (gy < 1.2 || gy > 4.6 || !isClearOfStructures(gx, gz)) continue;
      dummy.position.set(gx, gy - 0.04, gz);
      dummy.rotation.set(0, floraRng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.82 + floraRng() * 0.88);
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

    // 8B. CLOVER PATCHES & SAVANNA GOLDEN-TIPPED PLUME GRASS
    const cloverGeo = buildCloverPatchGeometry();
    const cloverMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.02,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    const cloverMatrices: THREE.Matrix4[] = [];
    for (let i = 0; i < CONFIG.PROPS.CLOVER_PATCH_COUNT; i += 1) {
      const phi = floraRng() * Math.PI * 2;
      const rad = Math.sqrt(floraRng());
      const cx = Math.cos(phi) * 78 * rad;
      const cz = Math.sin(phi) * 64 * rad;
      const cy = groundHeightAt(cx, cz, world);
      if (cy < 1.35 || cy > 4.2 || !isClearOfStructures(cx, cz)) continue;
      dummy.position.set(cx, cy - 0.02, cz);
      dummy.rotation.set(0, floraRng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.9 + floraRng() * 0.9);
      dummy.updateMatrix();
      cloverMatrices.push(dummy.matrix.clone());
    }
    if (cloverMatrices.length > 0) {
      const cloverInst = new THREE.InstancedMesh(cloverGeo, cloverMat, cloverMatrices.length);
      cloverMatrices.forEach((m, idx) => cloverInst.setMatrixAt(idx, m));
      cloverInst.instanceMatrix.needsUpdate = true;
      cloverInst.computeBoundingSphere();
      islandGroup.add(cloverInst);
    }
    islandDisposables.push(cloverMat, cloverGeo);

    const plumeGeo = buildSavannaPlumeGrassGeometry();
    const plumeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0.02,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    applyWindSway(plumeMat, 0, 1.35);
    const plumeMatrices: THREE.Matrix4[] = [];
    for (let i = 0; i < CONFIG.PROPS.PLUME_GRASS_COUNT; i += 1) {
      const phi = floraRng() * Math.PI * 2;
      const rad = 0.28 + floraRng() * 0.65;
      const px = Math.cos(phi) * 82 * rad;
      const pz = Math.sin(phi) * 68 * rad;
      const py = groundHeightAt(px, pz, world);
      if (py < 1.1 || py > 4.5 || !isClearOfStructures(px, pz)) continue;
      dummy.position.set(px, py - 0.04, pz);
      dummy.rotation.set(0, floraRng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.85 + floraRng() * 0.7);
      dummy.updateMatrix();
      plumeMatrices.push(dummy.matrix.clone());
    }
    if (plumeMatrices.length > 0) {
      const plumeInst = new THREE.InstancedMesh(plumeGeo, plumeMat, plumeMatrices.length);
      plumeMatrices.forEach((m, idx) => plumeInst.setMatrixAt(idx, m));
      plumeInst.instanceMatrix.needsUpdate = true;
      plumeInst.computeBoundingSphere();
      islandGroup.add(plumeInst);
    }
    islandDisposables.push(plumeMat, plumeGeo);

    // 9. INSTANCED DIVERSE FLOWERS: WILDFLOWERS, TROPICAL HIBISCUS, BELLFLOWER SPIKES, SPORE BLOOMS & LOTUSES
    const flowerGeo = buildWildflowerGeometry();
    const flowerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.02,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    applyWindSway(flowerMat, 0, 1.0);
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
      if (fy < 1.3 || fy > 4.3 || !isClearOfStructures(fx, fz)) continue;
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

    // 9B. Tropical Hibiscus Blooms
    const hibiscusGeo = buildTropicalHibiscusGeometry();
    const hibiscusMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.65,
      metalness: 0.02,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    applyWindSway(hibiscusMat, 0, 1.0);
    const hibiscusPalette = [
      new THREE.Color(0xff3864),
      new THREE.Color(0xff729f),
      new THREE.Color(0xff9f2e),
      new THREE.Color(0xff4d4d),
    ];
    const hibiscusMatrices: THREE.Matrix4[] = [];
    const hibiscusColors: THREE.Color[] = [];
    for (let i = 0; i < CONFIG.PROPS.HIBISCUS_FLOWER_COUNT; i += 1) {
      const phi = floraRng() * Math.PI * 2;
      const rad = Math.sqrt(floraRng());
      const hx = Math.cos(phi) * 76 * rad;
      const hz = Math.sin(phi) * 62 * rad;
      const hy = groundHeightAt(hx, hz, world);
      if (hy < 1.2 || hy > 3.9 || !isClearOfStructures(hx, hz)) continue;
      dummy.position.set(hx, hy - 0.03, hz);
      dummy.rotation.set(0, floraRng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.9 + floraRng() * 0.65);
      dummy.updateMatrix();
      hibiscusMatrices.push(dummy.matrix.clone());
      hibiscusColors.push(hibiscusPalette[i % hibiscusPalette.length]);
    }
    if (hibiscusMatrices.length > 0) {
      const hibInst = new THREE.InstancedMesh(hibiscusGeo, hibiscusMat, hibiscusMatrices.length);
      hibiscusMatrices.forEach((m, idx) => {
        hibInst.setMatrixAt(idx, m);
        hibInst.setColorAt(idx, hibiscusColors[idx]);
      });
      hibInst.instanceMatrix.needsUpdate = true;
      if (hibInst.instanceColor) hibInst.instanceColor.needsUpdate = true;
      hibInst.computeBoundingSphere();
      islandGroup.add(hibInst);
    }
    islandDisposables.push(hibiscusMat, hibiscusGeo);

    // 9C. Bellflower Spikes
    const bellGeo = buildBellflowerSpikeGeometry();
    const bellMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.68,
      metalness: 0.02,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    applyWindSway(bellMat, 0, 1.15);
    const bellPalette = [
      new THREE.Color(0x9d7eff),
      new THREE.Color(0x63c5ff),
      new THREE.Color(0xf49eff),
      new THREE.Color(0xfff1a8),
    ];
    const bellMatrices: THREE.Matrix4[] = [];
    const bellColors: THREE.Color[] = [];
    for (let i = 0; i < CONFIG.PROPS.BELLFLOWER_COUNT; i += 1) {
      const phi = floraRng() * Math.PI * 2;
      const rad = Math.sqrt(floraRng());
      const bx = Math.cos(phi) * 78 * rad;
      const bz = Math.sin(phi) * 64 * rad;
      const by = groundHeightAt(bx, bz, world);
      if (by < 1.35 || by > 4.4 || !isClearOfStructures(bx, bz)) continue;
      dummy.position.set(bx, by - 0.03, bz);
      dummy.rotation.set(0, floraRng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.85 + floraRng() * 0.7);
      dummy.updateMatrix();
      bellMatrices.push(dummy.matrix.clone());
      bellColors.push(bellPalette[i % bellPalette.length]);
    }
    if (bellMatrices.length > 0) {
      const bellInst = new THREE.InstancedMesh(bellGeo, bellMat, bellMatrices.length);
      bellMatrices.forEach((m, idx) => {
        bellInst.setMatrixAt(idx, m);
        bellInst.setColorAt(idx, bellColors[idx]);
      });
      bellInst.instanceMatrix.needsUpdate = true;
      if (bellInst.instanceColor) bellInst.instanceColor.needsUpdate = true;
      bellInst.computeBoundingSphere();
      islandGroup.add(bellInst);
    }
    islandDisposables.push(bellMat, bellGeo);

    // 9D. Mushroom Forest Glowing Spore-Blooms
    const sporeBloomGeo = buildSporeBloomGeometry();
    const sporeBloomMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x26b4cc,
      emissiveIntensity: 0.42,
      roughness: 0.55,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    const sporeMatrices: THREE.Matrix4[] = [];
    for (let i = 0; i < CONFIG.PROPS.SPORE_BLOOM_COUNT; i += 1) {
      const a = floraRng() * Math.PI * 2;
      const r = Math.sqrt(floraRng()) * CONFIG.ISLAND.MUSHROOM.RADIUS * 1.15;
      const sx = CONFIG.ISLAND.MUSHROOM.CX + Math.cos(a) * r;
      const sz = CONFIG.ISLAND.MUSHROOM.CZ + Math.sin(a) * r;
      const sy = groundHeightAt(sx, sz, world);
      if (sy < 1.1 || sy > 3.8) continue;
      dummy.position.set(sx, sy - 0.02, sz);
      dummy.rotation.set(0, floraRng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.9 + floraRng() * 0.75);
      dummy.updateMatrix();
      sporeMatrices.push(dummy.matrix.clone());
    }
    if (sporeMatrices.length > 0) {
      const sporeInst = new THREE.InstancedMesh(sporeBloomGeo, sporeBloomMat, sporeMatrices.length);
      sporeMatrices.forEach((m, idx) => sporeInst.setMatrixAt(idx, m));
      sporeInst.instanceMatrix.needsUpdate = true;
      sporeInst.computeBoundingSphere();
      islandGroup.add(sporeInst);
    }
    islandDisposables.push(sporeBloomMat, sporeBloomGeo);

    // 9E. Crystal Spring & Cove Water Lotuses
    const lotusGeo = buildLotusBloomGeometry();
    const lotusMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.48,
      metalness: 0.02,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    const lotusMatrices: THREE.Matrix4[] = [];
    const springSurfY = groundHeightAt(CONFIG.ISLAND.SPRING.CX, CONFIG.ISLAND.SPRING.CZ, world) + 0.52;
    for (let i = 0; i < CONFIG.PROPS.LOTUS_COUNT; i += 1) {
      if (i < 12) {
        const a = (i / 12) * Math.PI * 2 + floraRng() * 0.3;
        const r = 1.4 + floraRng() * 2.5;
        dummy.position.set(
          CONFIG.ISLAND.SPRING.CX + Math.cos(a) * r,
          springSurfY,
          CONFIG.ISLAND.SPRING.CZ + Math.sin(a) * r
        );
      } else {
        const a = floraRng() * Math.PI * 2;
        const lx = Math.cos(a) * (CONFIG.WORLD.ISLAND_RX * 0.94);
        const lz = Math.sin(a) * (CONFIG.WORLD.ISLAND_RZ * 0.94);
        const ly = groundHeightAt(lx, lz, world);
        if (ly > -0.25 || ly < -1.1) continue;
        dummy.position.set(lx, 0.04, lz);
      }
      dummy.rotation.set(0, floraRng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.85 + floraRng() * 0.45);
      dummy.updateMatrix();
      lotusMatrices.push(dummy.matrix.clone());
    }
    if (lotusMatrices.length > 0) {
      const lotusInst = new THREE.InstancedMesh(lotusGeo, lotusMat, lotusMatrices.length);
      lotusMatrices.forEach((m, idx) => lotusInst.setMatrixAt(idx, m));
      lotusInst.instanceMatrix.needsUpdate = true;
      lotusInst.computeBoundingSphere();
      islandGroup.add(lotusInst);
    }
    islandDisposables.push(lotusMat, lotusGeo);

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
    activePebbleMat = pebbleMat;
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

    // 10B. PRETTIER BEACHES: WEATHERED DRIFTWOOD LOGS & DECORATIVE STARFISH
    const driftwoodGeo = buildDriftwoodLogGeometry(1.5);
    const driftwoodMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.02,
      vertexColors: true,
    });
    const driftwoodMatrices: THREE.Matrix4[] = [];
    for (let i = 0; i < CONFIG.PROPS.DRIFTWOOD_COUNT; i += 1) {
      const a = floraRng() * Math.PI * 2;
      const r = 0.76 + floraRng() * 0.19;
      const dx = Math.cos(a) * CONFIG.WORLD.ISLAND_RX * r;
      const dz = Math.sin(a) * CONFIG.WORLD.ISLAND_RZ * r;
      const dy = groundHeightAt(dx, dz, world);
      if (dy < 0.1 || dy > 1.05 || !isClearOfStructures(dx, dz)) continue;
      dummy.position.set(dx, dy - 0.02, dz);
      dummy.rotation.set(0, floraRng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.85 + floraRng() * 0.55);
      dummy.updateMatrix();
      driftwoodMatrices.push(dummy.matrix.clone());
    }
    if (driftwoodMatrices.length > 0) {
      const dwInst = new THREE.InstancedMesh(driftwoodGeo, driftwoodMat, driftwoodMatrices.length);
      driftwoodMatrices.forEach((m, idx) => dwInst.setMatrixAt(idx, m));
      dwInst.instanceMatrix.needsUpdate = true;
      dwInst.computeBoundingSphere();
      islandGroup.add(dwInst);
    }
    islandDisposables.push(driftwoodGeo, driftwoodMat);

    const starfishGeo = buildBeachStarfishGeometry();
    const starfishMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.48,
      metalness: 0.04,
    });
    const starfishPalette = [
      new THREE.Color(0xff7256),
      new THREE.Color(0xff9f3f),
      new THREE.Color(0xff5978),
      new THREE.Color(0xffc84a),
    ];
    const starfishMatrices: THREE.Matrix4[] = [];
    const starfishColors: THREE.Color[] = [];
    for (let i = 0; i < CONFIG.PROPS.STARFISH_PROP_COUNT; i += 1) {
      const a = floraRng() * Math.PI * 2;
      const r = 0.79 + floraRng() * 0.18;
      const sx = Math.cos(a) * CONFIG.WORLD.ISLAND_RX * r;
      const sz = Math.sin(a) * CONFIG.WORLD.ISLAND_RZ * r;
      const sy = groundHeightAt(sx, sz, world);
      if (sy < 0.05 || sy > 0.78) continue;
      dummy.position.set(sx, sy + 0.015, sz);
      dummy.rotation.set(0, floraRng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.75 + floraRng() * 0.55);
      dummy.updateMatrix();
      starfishMatrices.push(dummy.matrix.clone());
      starfishColors.push(starfishPalette[i % starfishPalette.length]);
    }
    if (starfishMatrices.length > 0) {
      const sfInst = new THREE.InstancedMesh(starfishGeo, starfishMat, starfishMatrices.length);
      starfishMatrices.forEach((m, idx) => {
        sfInst.setMatrixAt(idx, m);
        sfInst.setColorAt(idx, starfishColors[idx]);
      });
      sfInst.instanceMatrix.needsUpdate = true;
      if (sfInst.instanceColor) sfInst.instanceColor.needsUpdate = true;
      sfInst.computeBoundingSphere();
      islandGroup.add(sfInst);
    }
    islandDisposables.push(starfishGeo, starfishMat);

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
    survivor.bowMesh.visible = false;
    survivor.hammerMesh.visible = false;
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
    focusRingMesh.visible = false;
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
    if (
      weatherParam === 'rain' ||
      weatherParam === 'storm' ||
      weatherParam === 'fog' ||
      weatherParam === 'clear'
    ) {
      survivalState.weather = weatherParam;
      survivalState.weatherTimer = 30;
      if (weatherParam === 'rain' || weatherParam === 'storm') {
        survivalState.groundWetness = 0.92;
      }
    }
    const eventParam = params?.get('event');
    if (
      eventParam === 'low_tide' ||
      eventParam === 'tsunami' ||
      eventParam === 'volcano_eruption' ||
      eventParam === 'meteor_shower' ||
      eventParam === 'fish_frenzy' ||
      eventParam === 'autumn_breeze' ||
      eventParam === 'winter_frost'
    ) {
      triggerWorldEvent(survivalState, eventParam, true);
      if (eventParam === 'low_tide') {
        survivalState.seaLevelOffset = CONFIG.SURVIVAL.WORLD_EVENTS.LOW_TIDE_OFFSET;
      } else if (eventParam === 'tsunami') {
        survivalState.seaLevelOffset = CONFIG.SURVIVAL.WORLD_EVENTS.TSUNAMI_OFFSET;
      } else if (eventParam === 'autumn_breeze' || eventParam === 'winter_frost') {
        survivalState.seasonMix = 1;
      }
    }
    const seasonParam = params?.get('season');
    if (seasonParam === 'autumn' || seasonParam === 'winter') {
      triggerSeasonEvent(survivalState, seasonParam);
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

  let clickWalkTarget: {
    x: number;
    z: number;
    kind?: FocusedTargetKind;
    id?: string;
    range: number;
    markerTimer: number;
  } | null = null;
  let lastNotifiedOutcome: GameOutcome = 'playing';

  const onKeyDown = (e: KeyboardEvent) => {
    activeKeys.add(e.code);
    soundEngine.unlockAndStartAmbience();
    if (screenState === 'playing') {
      if (e.code === 'KeyF' || e.code === 'Space') {
        if (e.code === 'Space') e.preventDefault();
        requestPlayerInteract(survivalState);
      } else if (e.code === 'Digit1') {
        if (selectWeapon(survivalState, 'axe')) emitHud(currentBiome);
      } else if (e.code === 'Digit2') {
        if (selectWeapon(survivalState, 'spear')) emitHud(currentBiome);
      } else if (e.code === 'Digit3') {
        if (selectWeapon(survivalState, 'bow')) emitHud(currentBiome);
      } else if (e.code === 'Digit4') {
        if (selectWeapon(survivalState, 'hammer')) emitHud(currentBiome);
      }
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    activeKeys.delete(e.code);
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const raycaster = new THREE.Raycaster();
  const ndcVec = new THREE.Vector2();
  const fallbackPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const planeHitVec = new THREE.Vector3();
  let pointerDownX = 0;
  let pointerDownY = 0;
  const onCanvasPointerDown = (e: PointerEvent) => {
    pointerDownX = e.clientX;
    pointerDownY = e.clientY;
    soundEngine.unlockAndStartAmbience();
  };
  const onCanvasPointerUp = (e: PointerEvent) => {
    if (screenState !== 'playing' || survivalState.gameOutcome !== 'playing') return;
    if (Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY) >= 9) return;

    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    ndcVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndcVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndcVec, camera);

    let hx = playerState.x;
    let hz = playerState.z;
    let gotHit = false;
    if (activeTerrainMesh) {
      const hits = raycaster.intersectObject(activeTerrainMesh, false);
      if (hits.length > 0) {
        hx = hits[0].point.x;
        hz = hits[0].point.z;
        gotHit = true;
      }
    }
    if (!gotHit) {
      if (raycaster.ray.intersectPlane(fallbackPlane, planeHitVec)) {
        hx = planeHitVec.x;
        hz = planeHitVec.z;
        gotHit = true;
      }
    }
    if (!gotHit) return;

    // Pick exact clicked 3D entity near (hx, hz)
    let picked: { kind: FocusedTargetKind; id: string; x: number; z: number; range: number; score: number } | null = null;
    const consider = (kind: FocusedTargetKind, id: string, tx: number, tz: number, range: number, maxClickDist: number, priorityBias = 0) => {
      const d = Math.hypot(tx - hx, tz - hz);
      if (d <= maxClickDist) {
        const score = d - priorityBias;
        if (!picked || score < picked.score) {
          picked = { kind, id, x: tx, z: tz, range, score };
        }
      }
    };

    for (const sec of survivalState.secretSpots) {
      if (survivalState.discoveredSecrets.includes(sec.id)) continue;
      consider('secret', sec.id, sec.x, sec.z, CONFIG.SURVIVAL.HARVEST_RANGE_SECRET, 2.5, 0.35);
    }
    for (const pad of survivalState.buildPads) {
      if (survivalState.buildings[pad.id]) continue;
      consider('pad', pad.id, pad.x, pad.z, CONFIG.SURVIVAL.HARVEST_RANGE_BUILD, 2.5, 0.25);
    }
    for (const act of survivalState.wildlife.actors) {
      if (!act.visible || act.koTimer > 0 || act.respawnTimer > 0) continue;
      const spec = getAnimalSpecies(act.speciesId);
      if (!spec?.huntable) continue;
      consider('prey', act.id, act.x, act.z, CONFIG.SURVIVAL.HARVEST_RANGE_HUNT, 2.4, 0.3);
    }
    for (const node of survivalState.nodes) {
      if (node.cooldownRemaining > 0) continue;
      consider('node', node.id, node.x, node.z, node.range, node.kind === 'wood' ? 2.5 : 2.1, 0);
    }

    const bowEquipped = survivalState.equippedWeapon === 'bow' && survivalState.unlockedWeapons.bow;
    if (bowEquipped && (!picked || (picked as { kind: FocusedTargetKind }).kind === 'prey')) {
      const targetPreyId =
        picked && (picked as { kind: FocusedTargetKind }).kind === 'prey'
          ? (picked as { id: string }).id
          : undefined;
      requestBowShotAt(survivalState, hx, hz, targetPreyId);
      clickRingMesh.position.set(hx, Math.max(0.06, groundHeightAt(hx, hz, worldData) + 0.08), hz);
      clickRingMesh.visible = true;
      clickWalkTarget = { x: playerState.x, z: playerState.z, range: 99, markerTimer: 0.45 };
      return;
    }

    const hammerEquipped = survivalState.equippedWeapon === 'hammer' && survivalState.unlockedWeapons.hammer;
    const distFromPlayer = Math.hypot(hx - playerState.x, hz - playerState.z);
    if (hammerEquipped && !picked && distFromPlayer < 3.2) {
      requestPlayerInteract(survivalState);
      return;
    }

    if (picked) {
      const p = picked as { kind: FocusedTargetKind; id: string; x: number; z: number; range: number };
      const dist = Math.hypot(p.x - playerState.x, p.z - playerState.z);
      if (dist <= p.range + 0.2) {
        requestTargetInteract(survivalState, p.kind, p.id);
        clickWalkTarget = null;
      } else {
        clickWalkTarget = {
          x: p.x,
          z: p.z,
          kind: p.kind,
          id: p.id,
          range: Math.max(0.6, p.range - 0.15),
          markerTimer: 0.9,
        };
      }
      clickRingMesh.position.set(p.x, Math.max(0.06, groundHeightAt(p.x, p.z, worldData) + 0.08), p.z);
      clickRingMesh.visible = true;
    } else {
      clickWalkTarget = { x: hx, z: hz, range: 0.48, markerTimer: 0.7 };
      clickRingMesh.position.set(hx, Math.max(0.06, groundHeightAt(hx, hz, worldData) + 0.08), hz);
      clickRingMesh.visible = true;
    }
  };
  renderer.domElement.addEventListener('pointerdown', onCanvasPointerDown);
  renderer.domElement.addEventListener('pointerup', onCanvasPointerUp);

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

  let lightningFlash = 0;
  let nextLightningTimer = 4.5;
  let eventProjSpawnTimer = 0;
  let castRodSoundQueued = false;

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
                  : kind === 'meat'
                    ? chipMeatMat
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
                : kind === 'meat'
                  ? stackMeatGeo
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
        slot.meat.visible = false;
      } else {
        slot.group.visible = true;
        slot.wood.visible = item === 'wood';
        slot.fish.visible = item === 'fish';
        slot.berries.visible = item === 'berries';
        slot.shell.visible = item === 'shell';
        slot.banana.visible = item === 'banana';
        slot.meat.visible = item === 'meat';
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
    if (obeliskHaloInner) {
      obeliskHaloInner.rotation.z += dt * 1.45;
      obeliskHaloInner.rotation.y += dt * 0.6;
    }
    if (lavaPoolMesh) {
      const m = lavaPoolMesh.material as THREE.ShaderMaterial;
      m.uniforms.uTime.value = elapsedTime;
    }
    if (springWaterMesh) {
      const m = springWaterMesh.material as THREE.ShaderMaterial;
      m.uniforms.uTime.value = elapsedTime;
    }
    if (waterfallMat) {
      waterfallMat.uniforms.uTime.value = elapsedTime;
    }
    if (beaconFlameMesh) {
      const m = beaconFlameMesh.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.9 + Math.sin(elapsedTime * 5.0) * 0.28;
      beaconFlameMesh.scale.setScalar(1 + Math.sin(elapsedTime * 6.5) * 0.08);
    }
    if (beaconBeamMesh) {
      beaconBeamMesh.rotation.y += dt * 0.85;
    }
    if (fireflyGroup) {
      fireflyGroup.rotation.y += dt * 0.22;
      fireflyGroup.position.y =
        groundHeightAt(CONFIG.ISLAND.MUSHROOM.CX, CONFIG.ISLAND.MUSHROOM.CZ, worldData) +
        1.5 +
        Math.sin(elapsedTime * 1.8) * 0.22;
    }

    // Animate cozy survival campfire flames (scales Lv 1..10!), glowing coal bed & 48 spiraling embers
    const fireScaleCap = Math.min(2.6, 1 + (survivalState.fireLevel - 1) * 0.22);
    campFlames.forEach((flame, idx) => {
      const flicker = 1 + Math.sin(elapsedTime * (7.5 + idx * 2.1) + idx) * 0.14;
      const baseXZ = idx === 0 ? 1.05 : idx === 4 ? 0.38 : 0.58;
      const baseY = idx === 4 ? 0.56 : idx === 1 ? 0.88 : 1.08;
      flame.scale.set(baseXZ * fireScaleCap, baseY * flicker * fireScaleCap, baseXZ * fireScaleCap);
      flame.rotation.y = elapsedTime * (idx % 2 === 0 ? 1.4 : -1.8);
    });
    if (campCoalBed) {
      const coalMat = campCoalBed.material as THREE.MeshStandardMaterial;
      coalMat.emissiveIntensity = 1.2 + Math.sin(elapsedTime * 6.5) * 0.35 + (survivalState.fireLevel - 1) * 0.15;
    }
    if (campEmberInst) {
      const activeEmbers = Math.min(campEmberSeeds.length, 16 + survivalState.fireLevel * 3);
      for (let i = 0; i < campEmberSeeds.length; i += 1) {
        if (i >= activeEmbers) {
          seasonDummy.scale.setScalar(0);
        } else {
          const es = campEmberSeeds[i];
          const prog = (elapsedTime * es.spd + es.phase) % 1;
          const swirl = es.ang + prog * 4.2;
          const rad = es.rad * (1 + prog * 0.9) * Math.min(1.6, 0.9 + survivalState.fireLevel * 0.08);
          seasonDummy.position.set(
            Math.cos(swirl) * rad,
            0.2 + prog * (1.8 + survivalState.fireLevel * 0.24),
            Math.sin(swirl) * rad
          );
          seasonDummy.scale.setScalar(Math.max(0.05, (1 - prog) * 1.15));
        }
        seasonDummy.rotation.set(0, 0, 0);
        seasonDummy.updateMatrix();
        campEmberInst.setMatrixAt(i, seasonDummy.matrix);
      }
      campEmberInst.instanceMatrix.needsUpdate = true;
    }
    if (campAuraRing) {
      const mat = campAuraRing.material as THREE.MeshBasicMaterial;
      mat.opacity = survivalState.nearCampfire ? 0.56 + Math.sin(elapsedTime * 4) * 0.14 : 0.24;
      mat.color.setHex(survivalState.fireLevel >= 5 ? 0x62f8ff : 0xffcf5c);
      campAuraRing.scale.setScalar(1 + Math.min(6, survivalState.fireLevel - 1) * 0.2);
    }
    if (campRoastGroup && campRoastFish && campRoastBanana && campRoastMeat) {
      const roastFish = survivalState.nearCampfire && survivalState.carried.fish > 0;
      const roastMeat = !roastFish && survivalState.nearCampfire && survivalState.carried.meat > 0;
      const roastBanana =
        !roastFish &&
        !roastMeat &&
        survivalState.nearCampfire &&
        survivalState.fireLevel >= 2 &&
        survivalState.carried.banana > 0;
      campRoastGroup.visible = roastFish || roastMeat || roastBanana;
      campRoastFish.visible = roastFish;
      campRoastMeat.visible = roastMeat;
      campRoastBanana.visible = roastBanana;
      if (roastFish) campRoastFish.rotation.x = elapsedTime * 2.6;
      if (roastMeat) campRoastMeat.rotation.x = elapsedTime * 2.5;
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

    // Sync Ocean Tide / Surge Level
    oceanMat.uniforms.uSeaLevel.value = survivalState.seaLevelOffset;
    oceanMesh.position.y = survivalState.seaLevelOffset;

    // Sync Day/Night Sky, Sun/Moon Lighting, Wet Ground, Storm Lightning, Rain & Fog!
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

    const isRain = survivalState.weather === 'rain';
    const isStorm = survivalState.weather === 'storm';
    const isPrecipitation = isRain || isStorm;
    const isFog = survivalState.weather === 'fog';

    if (isStorm) {
      skyTop.lerp(new THREE.Color(0x212f42), 0.76);
      skyHor.lerp(new THREE.Color(0x46586e), 0.76);
      nextLightningTimer -= dt;
      if (nextLightningTimer <= 0) {
        nextLightningTimer = 4.5 + Math.random() * 6.5;
        lightningFlash = 1.0;
        if (screenState === 'playing') soundEngine.playThunder();
      }
    } else if (isRain) {
      skyTop.lerp(new THREE.Color(0x3a4f66), 0.55);
      skyHor.lerp(new THREE.Color(0x6b8299), 0.62);
    } else if (isFog) {
      skyTop.lerp(new THREE.Color(0x9fb8c9), 0.48);
      skyHor.lerp(new THREE.Color(0xd2e6ef), 0.68);
    }

    if (lightningFlash > 0) {
      lightningFlash = Math.max(0, lightningFlash - dt * 3.8);
      skyTop.lerp(new THREE.Color(0xdcefff), lightningFlash * 0.65);
      skyHor.lerp(new THREE.Color(0xeef7ff), lightningFlash * 0.65);
    }

    skyDome.mat.uniforms.topColor.value.copy(skyTop);
    skyDome.mat.uniforms.horizonColor.value.copy(skyHor);
    skyDome.mat.uniforms.sunDir.value.set(sunHoriz, Math.max(-0.2, sunElev), 0.35).normalize();
    skyDome.mat.uniforms.starMix.value = nightAmount * (isPrecipitation || isFog ? 0.15 : 1.0);
    skyDome.mat.uniforms.uTime.value = elapsedTime;

    const moonAngle = sunAngle + Math.PI;
    moonOrb.position.set(
      Math.cos(moonAngle) * 260,
      Math.sin(moonAngle) * 220,
      -90
    );
    moonOrb.visible = nightAmount > 0.15;

    scene.background = skyHor;
    const targetFogDensity = isFog
      ? 0.0115
      : isStorm
        ? 0.0072
        : isRain
          ? 0.0054
          : nightAmount > 0.5
            ? 0.0042
            : CONFIG.RENDER.FOG_DENSITY;
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

    const weatherDim = isStorm ? 0.56 : isRain ? 0.72 : isFog ? 0.82 : 1.0;
    scene.environmentIntensity = (0.07 + dayAmount * 0.29) * weatherDim + lightningFlash * 0.35;
    sunLight.color
      .setHex(0x7c9eff)
      .lerp(new THREE.Color(0xfff1d4), dayAmount)
      .lerp(new THREE.Color(0xffa45b), twilightAmount * 0.65);
    sunLight.intensity = (0.24 + dayAmount * 1.66) * weatherDim + lightningFlash * 2.4;
    hemiLight.color.setHex(0x284378).lerp(new THREE.Color(0xdef5ff), dayAmount);
    hemiLight.groundColor.setHex(0x192830).lerp(new THREE.Color(0x769a5c), dayAmount);
    hemiLight.intensity = (0.24 + dayAmount * 0.66) * weatherDim;
    fillLight.intensity = 0.09 + dayAmount * 0.31;

    campPointLight.intensity =
      (1.6 + nightAmount * 7.5) * (1 + (survivalState.fireLevel - 1) * 0.45) +
      Math.sin(elapsedTime * 9) * 0.35;
    campPointLight.distance = 24 + survivalState.fireLevel * 6;

    // Wet Ground Shader / PBR Roughness Sheen during Rain & Storm!
    const wet = survivalState.groundWetness;
    if (activeTerrainMat) {
      activeTerrainMat.roughness = THREE.MathUtils.lerp(0.88, 0.24, wet);
      activeTerrainMat.metalness = THREE.MathUtils.lerp(0.02, 0.14, wet);
      const dryShade = THREE.MathUtils.lerp(1.0, 0.78, wet);
      activeTerrainMat.color.setRGB(dryShade * 0.98, dryShade, dryShade * 1.04);
    }
    if (activeRockMainMat) {
      activeRockMainMat.roughness = THREE.MathUtils.lerp(0.92, 0.26, wet);
      activeRockMainMat.color.setHex(CONFIG.COLORS.ROCK_MAIN).multiplyScalar(THREE.MathUtils.lerp(1.0, 0.74, wet));
    }
    if (activeRockLightMat) {
      activeRockLightMat.roughness = THREE.MathUtils.lerp(0.88, 0.28, wet);
      activeRockLightMat.color.setHex(CONFIG.COLORS.ROCK_LIGHT).multiplyScalar(THREE.MathUtils.lerp(1.0, 0.76, wet));
    }
    if (activePebbleMat) {
      activePebbleMat.roughness = THREE.MathUtils.lerp(0.88, 0.22, wet);
    }

    // 3D Rain streaks + ground raindrop splash ripples around player
    rainInst.visible = isPrecipitation;
    rainRippleInst.visible = isPrecipitation || wet > 0.35;
    if (isPrecipitation) {
      const spdMult = isStorm ? 1.45 : 1.0;
      const slant = isStorm ? 0.26 : 0.1;
      for (let i = 0; i < rainCount; i += 1) {
        const ro = rainOffsets[i];
        ro.y -= ro.spd * spdMult * dt;
        if (ro.y < 0) ro.y = 18;
        rainDummy.position.set(playerState.x + ro.x, playerState.y + ro.y, playerState.z + ro.z);
        rainDummy.rotation.set(slant, 0, slant * 1.1);
        rainDummy.scale.set(1, isStorm ? 1.35 : 1.0, 1);
        rainDummy.updateMatrix();
        rainInst.setMatrixAt(i, rainDummy.matrix);
      }
      rainInst.instanceMatrix.needsUpdate = true;
    }
    if (rainRippleInst.visible) {
      for (let i = 0; i < rippleCount; i += 1) {
        const rp = ripplePool[i];
        rp.age += dt;
        if (rp.age >= rp.life) {
          rp.age = 0;
          const a = Math.random() * Math.PI * 2;
          const rad = 1.2 + Math.random() * 14.0;
          rp.x = playerState.x + Math.cos(a) * rad;
          rp.z = playerState.z + Math.sin(a) * rad;
          rp.y = Math.max(survivalState.seaLevelOffset + 0.04, groundHeightAt(rp.x, rp.z, worldData) + 0.04);
        }
        const t = rp.age / rp.life;
        rainDummy.position.set(rp.x, rp.y, rp.z);
        rainDummy.rotation.set(0, 0, 0);
        rainDummy.scale.setScalar(0.35 + t * 1.5);
        rainDummy.updateMatrix();
        rainRippleInst.setMatrixAt(i, rainDummy.matrix);
      }
      rainRippleInst.instanceMatrix.needsUpdate = true;
      rainRippleMat.opacity = isPrecipitation ? 0.44 : wet * 0.24;
    }

    // Update soundEngine ambient surf / birds / crickets / rain
    soundEngine.updateAmbience(
      dt,
      survivalState.weather,
      playerState.y < 1.1,
      survivalState.isNight,
      screenState === 'playing'
    );

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

    // Update Seasonal Shader Uniforms + Falling Leaves / Snowflakes
    seasonUniformMix.value = survivalState.seasonMix;
    seasonUniformKind.value =
      survivalState.season === 'autumn' ? 1 : survivalState.season === 'winter' ? 2 : 0;
    const showSeasonParticles = survivalState.season !== 'summer' && survivalState.seasonMix > 0.08;
    leafSnowInst.visible = showSeasonParticles;
    if (showSeasonParticles) {
      const isAutumn = survivalState.season === 'autumn';
      for (let i = 0; i < seasonParticleCount; i += 1) {
        const sp = seasonParticleData[i];
        sp.y -= sp.spd * (isAutumn ? 1.05 : 0.75) * dt;
        if (sp.y < 0) sp.y = 14;
        const driftX = Math.sin(elapsedTime * 1.4 + sp.phase) * (isAutumn ? 1.3 : 0.65);
        const driftZ = Math.cos(elapsedTime * 1.1 + sp.phase) * (isAutumn ? 1.1 : 0.55);
        seasonDummy.position.set(
          playerState.x + sp.x + driftX,
          playerState.y + sp.y,
          playerState.z + sp.z + driftZ
        );
        seasonDummy.rotation.set(
          elapsedTime * sp.spin,
          elapsedTime * sp.spin * 0.7,
          elapsedTime * sp.spin * 0.5
        );
        seasonDummy.scale.setScalar((isAutumn ? 1.15 : 0.85) * survivalState.seasonMix);
        seasonDummy.updateMatrix();
        leafSnowInst.setMatrixAt(i, seasonDummy.matrix);
        leafSnowInst.setColorAt(i, isAutumn ? autumnPalette[sp.tintIdx] : winterColor);
      }
      leafSnowInst.instanceMatrix.needsUpdate = true;
      if (leafSnowInst.instanceColor) leafSnowInst.instanceColor.needsUpdate = true;
    }

    // Animate Hidden Secret Place Chests (lid hinge + sparkles)
    for (const [secId, sVis] of secretSpotVisuals.entries()) {
      const discovered = survivalState.discoveredSecrets.includes(secId);
      if (discovered && sVis.openAnim < 1) {
        sVis.openAnim = Math.min(1, sVis.openAnim + dt * 2.8);
      } else if (!discovered) {
        sVis.openAnim = 0;
      }
      sVis.lid.rotation.x = -sVis.openAnim * Math.PI * 0.48;
      const gMat = sVis.glowRing.material as THREE.MeshBasicMaterial;
      gMat.opacity = discovered ? 0.14 : 0.58 + Math.sin(elapsedTime * 3.8) * 0.22;
      sVis.sparkles.forEach((sp, kIdx) => {
        sp.visible = !discovered;
        if (!discovered) {
          const ang = elapsedTime * 2.1 + (kIdx / 3) * Math.PI * 2;
          sp.position.set(
            Math.cos(ang) * 0.78,
            1.0 + Math.sin(elapsedTime * 3 + kIdx) * 0.18,
            Math.sin(ang) * 0.78
          );
        }
      });
    }

    // Update Weapon Mastery 3D Glow Materials (Lv 2..5)
    const applyWeaponGlow = (mat: THREE.MeshStandardMaterial, lvl: number, hex: number) => {
      if (lvl <= 1) {
        mat.emissiveIntensity = 0;
      } else {
        mat.emissive.setHex(hex);
        mat.emissiveIntensity = 0.2 + (lvl - 2) * 0.32 + Math.sin(elapsedTime * 4) * 0.08;
      }
    };
    applyWeaponGlow(survivor.toolMats.axe, survivalState.weaponLevels.axe, 0x3bf572);
    applyWeaponGlow(
      survivor.toolMats.spear,
      survivalState.weaponLevels.spear,
      survivalState.hasFireSpear ? 0xff5a1f : 0x42e3ff
    );
    applyWeaponGlow(survivor.toolMats.bow, survivalState.weaponLevels.bow, 0x9eff3d);
    applyWeaponGlow(survivor.toolMats.hammer, survivalState.weaponLevels.hammer, 0xffc833);

    // Update Lightning Bolts & Claw Slash Arcs
    for (const bp of boltPool) {
      if (!bp.active) continue;
      bp.age += dt;
      if (bp.age >= 0.28) {
        bp.active = false;
        bp.mesh.visible = false;
      } else {
        const s = 1 - bp.age / 0.28;
        bp.mesh.scale.set(s, 1, s);
      }
    }
    for (const cs of clawSlashPool) {
      if (!cs.active) continue;
      cs.age += dt;
      const t = cs.age / 0.26;
      if (t >= 1) {
        cs.active = false;
        cs.mesh.visible = false;
      } else {
        cs.mesh.scale.setScalar(0.85 + t * 0.7);
        cs.mat.opacity = 0.95 * (1 - t);
      }
    }

    // Update Click Target Ground Ring
    if (clickWalkTarget && clickWalkTarget.markerTimer > 0) {
      clickWalkTarget.markerTimer -= dt;
      clickRingMesh.scale.setScalar(1 + Math.sin(elapsedTime * 10) * 0.14);
      if (clickWalkTarget.markerTimer <= 0 && clickRingMesh.visible) {
        clickRingMesh.visible = false;
      }
    }

    if (screenState === 'playing' && survivalState.gameOutcome === 'playing') {
      let moveX = joystickInput.dx;
      let moveZ = joystickInput.dy;

      if (activeKeys.has('KeyA') || activeKeys.has('ArrowLeft')) moveX -= 1;
      if (activeKeys.has('KeyD') || activeKeys.has('ArrowRight')) moveX += 1;
      if (activeKeys.has('KeyW') || activeKeys.has('ArrowUp')) moveZ -= 1;
      if (activeKeys.has('KeyS') || activeKeys.has('ArrowDown')) moveZ += 1;

      let mag = Math.hypot(moveX, moveZ);
      if (mag > 0.05) {
        clickWalkTarget = null;
        clickRingMesh.visible = false;
      } else if (clickWalkTarget) {
        const dx = clickWalkTarget.x - playerState.x;
        const dz = clickWalkTarget.z - playerState.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= clickWalkTarget.range) {
          if (clickWalkTarget.kind && clickWalkTarget.id) {
            requestTargetInteract(survivalState, clickWalkTarget.kind, clickWalkTarget.id);
          }
          clickWalkTarget = null;
          clickRingMesh.visible = false;
        } else {
          moveX = dx / dist;
          moveZ = dz / dist;
          mag = 1;
        }
      }

      if (mag > 1) {
        moveX /= mag;
        moveZ /= mag;
      }

      const prevSwimming = survivalState.isSwimming;
      const speedScale = getPlayerSpeedScale(survivalState);
      const nextPos = stepPlayerPhysics(
        { x: playerState.x, z: playerState.z },
        moveX,
        moveZ,
        dt,
        worldData,
        speedScale,
        survivalState.seaLevelOffset
      );
      playerState.x = nextPos.x;
      playerState.y = nextPos.y;
      playerState.z = nextPos.z;

      if (!prevSwimming && nextPos.isSwimming) {
        soundEngine.playSwimSplash();
      }

      // Gentle inward tsunami surf push if standing on low beach during tsunami active phase
      if (
        survivalState.activeEvent === 'tsunami' &&
        survivalState.eventPhase === 'active' &&
        playerState.y < 0.95
      ) {
        const distCenter = Math.hypot(playerState.x, playerState.z);
        if (distCenter > 5) {
          const pushPos = stepPlayerPhysics(
            { x: playerState.x, z: playerState.z },
            (-playerState.x / distCenter) * 0.38,
            (-playerState.z / distCenter) * 0.38,
            dt,
            worldData,
            0.55,
            survivalState.seaLevelOffset
          );
          playerState.x = pushPos.x;
          playerState.y = pushPos.y;
          playerState.z = pushPos.z;
        }
      }

      const survivalRes = stepSurvivalSystem(
        survivalState,
        playerState.x,
        playerState.z,
        nextPos.moved,
        dt,
        worldData,
        false,
        nextPos.isSwimming
      );

      // Update Localized Hazard Warning Rings & Falling Projectiles
      for (let i = 0; i < hazardVisPool.length; i += 1) {
        const hv = hazardVisPool[i];
        const hz = survivalState.hazardImpacts[i];
        if (!hz) {
          hv.ring.visible = false;
          hv.disc.visible = false;
          hv.proj.visible = false;
          continue;
        }
        const hy = Math.max(survivalState.seaLevelOffset + 0.06, groundHeightAt(hz.x, hz.z, worldData) + 0.08);
        const prog = 1 - Math.max(0, hz.delayTimer) / Math.max(0.1, hz.maxDelay);
        const colorHex = hz.kind === 'lightning' ? 0x62f6ff : hz.kind === 'meteor' ? 0xc27aff : 0xff451a;
        hv.ringMat.color.setHex(colorHex);
        hv.discMat.color.setHex(colorHex);
        hv.projMat.color.setHex(colorHex);

        hv.ring.visible = !hz.resolved;
        hv.disc.visible = !hz.resolved;
        hv.ring.position.set(hz.x, hy, hz.z);
        hv.disc.position.set(hz.x, hy - 0.01, hz.z);
        hv.ring.scale.setScalar(hz.radius);
        hv.disc.scale.setScalar(hz.radius * (0.2 + prog * 0.8));

        if (!hz.resolved && hz.kind !== 'lightning') {
          hv.proj.visible = true;
          hv.proj.position.set(hz.x, hy + (1 - prog) * 18, hz.z);
          hv.proj.scale.setScalar(0.85 + prog * 0.45);
        } else {
          hv.proj.visible = false;
        }
      }

      // Trigger Lightning Bolt Flash & Impact Chips on Hazard Strikes
      for (const hs of survivalRes.hazardStrikes) {
        const sy = Math.max(survivalState.seaLevelOffset, groundHeightAt(hs.x, hs.z, worldData));
        if (hs.kind === 'lightning') {
          soundEngine.playLightningStrike();
          lightningFlash = 0.85;
          for (const bp of boltPool) {
            if (!bp.active) {
              bp.active = true;
              bp.age = 0;
              bp.mesh.position.set(hs.x, sy, hs.z);
              bp.mesh.scale.set(1, 1, 1);
              bp.mesh.visible = true;
              break;
            }
          }
        } else {
          soundEngine.playHammerSlam();
          spawnBurstChips(hs.x, sy + 0.3, hs.z, 'ember');
        }
      }

      // Predator Melee Strikes & Damage Feedback
      if (survivalRes.predatorStrikes.length > 0) {
        const ps = survivalRes.predatorStrikes[0];
        const clawY = Math.max(playerState.y, survivalState.seaLevelOffset) + 0.88;
        for (const cs of clawSlashPool) {
          if (!cs.active) {
            cs.active = true;
            cs.age = 0;
            cs.mesh.position.set(playerState.x, clawY, playerState.z);
            cs.mesh.rotation.y = Math.atan2(ps.x - playerState.x, ps.z - playerState.z);
            cs.mesh.scale.setScalar(0.95);
            cs.mat.opacity = 0.95;
            cs.mesh.visible = true;
            break;
          }
        }
      }
      if (survivalRes.damageTaken > 0) {
        soundEngine.playHitDamage();
        const pt = projectWorldToViewport(playerState.x, playerState.y + 1.45, playerState.z);
        callbacks.onDamageTaken?.(Math.round(survivalRes.damageTaken), pt.x, pt.y);
      }

      // Update Harvest / Build / Hunt Progress Ring + Focus Target Reticle
      const activeNode = survivalState.activeNodeId
        ? survivalState.nodes.find((n) => n.id === survivalState.activeNodeId)
        : undefined;
      const activePad = survivalState.activeBuildId
        ? survivalState.buildPads.find((p) => p.id === survivalState.activeBuildId)
        : undefined;
      const activePrey = survivalState.activeHuntActorId
        ? survivalState.wildlife.actors.find((a) => a.id === survivalState.activeHuntActorId)
        : undefined;

      if (activePad) {
        harvestRingMesh.visible = true;
        harvestRingMesh.position.set(activePad.x, activePad.y + 0.08, activePad.z);
        harvestRingMat.uniforms.uProgress.value = survivalState.actionProgress;
        harvestRingMat.uniforms.uColor.value.setHex(0x63f28e);
        focusRingMesh.visible = false;
      } else if (activeNode) {
        harvestRingMesh.visible = true;
        harvestRingMesh.position.set(activeNode.x, activeNode.y + 0.08, activeNode.z);
        harvestRingMat.uniforms.uProgress.value = survivalState.harvestProgress;
        harvestRingMat.uniforms.uColor.value.setHex(activeNode.kind === 'banana' ? 0xffe042 : 0xffe14d);
        focusRingMesh.visible = false;
      } else if (activePrey) {
        harvestRingMesh.visible = true;
        harvestRingMesh.position.set(activePrey.x, activePrey.y + 0.08, activePrey.z);
        harvestRingMat.uniforms.uProgress.value = survivalState.huntProgress;
        harvestRingMat.uniforms.uColor.value.setHex(0xff5e3a);
        focusRingMesh.visible = false;
      } else {
        harvestRingMesh.visible = false;
        const ft = survivalState.focusedTarget;
        if (ft) {
          focusRingMesh.visible = true;
          focusRingMesh.position.set(ft.x, ft.y + 0.09, ft.z);
          focusRingMesh.scale.setScalar(1 + Math.sin(elapsedTime * 5.2) * 0.08);
          focusRingMat.color.setHex(
            ft.blockedReason ? 0xff7854 : ft.kind === 'prey' ? 0xffcb45 : 0x52f2ff
          );
        } else {
          focusRingMesh.visible = false;
        }
      }

      if (survivalRes.harvested) {
        const h = survivalRes.harvested;
        if (h.kind === 'fish') soundEngine.playSplash();
        else soundEngine.playPickup();
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

      if (survivalRes.arrowShot) {
        soundEngine.playBowShot();
        const ar = survivalRes.arrowShot;
        for (const p of arrowPool) {
          if (!p.active) {
            p.active = true;
            p.age = 0;
            p.duration = 0.22;
            p.start.set(ar.fromX, ar.fromY, ar.fromZ);
            p.end.set(ar.toX, ar.toY, ar.toZ);
            p.mesh.position.copy(p.start);
            p.mesh.lookAt(p.end);
            p.mesh.visible = true;
            break;
          }
        }
      }

      if (survivalRes.hammerSlam) {
        soundEngine.playHammerSlam();
        const hs = survivalRes.hammerSlam;
        hammerWaveAge = 0;
        hammerRingMesh.position.set(hs.x, playerState.y + 0.14, hs.z);
        hammerRingMesh.scale.setScalar(0.6);
        hammerRingMesh.visible = true;
        spawnBurstChips(hs.x, playerState.y + 0.1, hs.z, 'chipWood');
        if (hs.lightningStrike) {
          soundEngine.playLightningStrike();
          for (const bp of boltPool) {
            if (!bp.active) {
              bp.active = true;
              bp.age = 0;
              bp.mesh.position.set(hs.x, playerState.y, hs.z);
              bp.mesh.scale.set(1, 1, 1);
              bp.mesh.visible = true;
              break;
            }
          }
        }
      }

      if (survivalRes.fishingMissed) {
        soundEngine.playFishEscape();
        callbacks.onNotice?.(survivalRes.fishingMissed.notice);
      }

      if (survivalRes.openedSecret) {
        const sec = survivalRes.openedSecret;
        soundEngine.playSecretOpen();
        spawnBurstChips(sec.x, sec.y + 0.6, sec.z, 'ember');
        callbacks.onNotice?.(`گنج مخفی کشف شد: ${sec.nameFa} (+۱۵ سکه و ۱ امتیاز مهارت)`);
        if (callbacks.onResourceFly) {
          const pt = projectWorldToViewport(sec.x, sec.y + 1.2, sec.z);
          callbacks.onResourceFly({
            id: flyEventSeq++,
            kind: 'coin',
            startX: pt.x,
            startY: pt.y,
          });
        }
      }

      if (survivalRes.playerLevelUp !== undefined) {
        soundEngine.playLevelUp();
        callbacks.onNotice?.(
          `تبریک! سطح ماجراجو به ${toPersianDigits(survivalRes.playerLevelUp)} ارتقا یافت!`
        );
      }

      if (survivalRes.weaponLevelUps.length > 0) {
        soundEngine.playLevelUp();
        const up = survivalRes.weaponLevelUps[0];
        const wSpec = CONFIG.WEAPON_SPECS.find((w) => w.id === up.weaponId);
        if (wSpec) {
          callbacks.onNotice?.(
            `سلاح ${wSpec.nameFa} به سطح مهارت ${toPersianDigits(up.newLevel)} رسید!`
          );
        }
      }

      if (survivalRes.hunted) {
        const ht = survivalRes.hunted;
        soundEngine.playPickup();
        spawnBurstChips(ht.x, ht.y + 0.2, ht.z, 'meat');
        spawnFlyingPropToBack('meat', ht.x, ht.y + 0.2, ht.z);
        if (callbacks.onResourceFly) {
          const pt = projectWorldToViewport(ht.x, ht.y + 0.9, ht.z);
          callbacks.onResourceFly({
            id: flyEventSeq++,
            kind: 'meat',
            startX: pt.x,
            startY: pt.y,
          });
        }
      }

      if (survivalRes.cookedCount > 0) {
        soundEngine.playCook();
        if (callbacks.onResourceFly) {
          const campY = groundHeightAt(CONFIG.ISLAND.CAMPFIRE.CX, CONFIG.ISLAND.CAMPFIRE.CZ, worldData);
          const pt = projectWorldToViewport(CONFIG.ISLAND.CAMPFIRE.CX, campY + 1.1, CONFIG.ISLAND.CAMPFIRE.CZ);
          callbacks.onResourceFly({
            id: flyEventSeq++,
            kind: 'cookedFish',
            startX: pt.x,
            startY: pt.y,
          });
        }
      }

      if (survivalRes.cookedMeatCount > 0) {
        soundEngine.playCook();
        if (callbacks.onResourceFly) {
          const campY = groundHeightAt(CONFIG.ISLAND.CAMPFIRE.CX, CONFIG.ISLAND.CAMPFIRE.CZ, worldData);
          const pt = projectWorldToViewport(CONFIG.ISLAND.CAMPFIRE.CX, campY + 1.1, CONFIG.ISLAND.CAMPFIRE.CZ);
          callbacks.onResourceFly({
            id: flyEventSeq++,
            kind: 'cookedMeat',
            startX: pt.x,
            startY: pt.y,
          });
        }
      }

      if (survivalRes.roastedBananaCount > 0) {
        soundEngine.playCook();
        if (callbacks.onResourceFly) {
          const campY = groundHeightAt(CONFIG.ISLAND.CAMPFIRE.CX, CONFIG.ISLAND.CAMPFIRE.CZ, worldData);
          const pt = projectWorldToViewport(CONFIG.ISLAND.CAMPFIRE.CX, campY + 1.1, CONFIG.ISLAND.CAMPFIRE.CZ);
          callbacks.onResourceFly({
            id: flyEventSeq++,
            kind: 'roastedBanana',
            startX: pt.x,
            startY: pt.y,
          });
        }
      }

      if (survivalRes.builtUpgrade) {
        soundEngine.playLevelUp();
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

      if (survivalRes.eventStarted) {
        soundEngine.playEventAlert(survivalRes.eventStarted.kind);
        callbacks.onNotice?.(survivalRes.eventStarted.notice);
      }
      if (survivalRes.eventEndedNotice) {
        callbacks.onNotice?.(survivalRes.eventEndedNotice);
      }
      if (survivalRes.boatVoyageNotice) {
        soundEngine.playSplash();
        callbacks.onNotice?.(survivalRes.boatVoyageNotice);
      }

      if (survivalRes.discoveredSpecies.length > 0 && callbacks.onNotice) {
        const sp = getAnimalSpecies(survivalRes.discoveredSpecies[0]);
        if (sp) {
          callbacks.onNotice(`گونه جدید کشف شد: ${sp.nameFa}`);
        }
      }

      // Animate Arrow Projectiles, Hammer Shockwave & World Event Projectiles (Meteors / Lava Bombs)
      for (const ar of arrowPool) {
        if (!ar.active) continue;
        ar.age += dt;
        const t = ar.age / ar.duration;
        if (t >= 1) {
          ar.active = false;
          ar.mesh.visible = false;
        } else {
          ar.mesh.position.lerpVectors(ar.start, ar.end, t);
          ar.mesh.position.y += Math.sin(t * Math.PI) * 0.42;
        }
      }
      if (hammerWaveAge >= 0) {
        hammerWaveAge += dt;
        const ht = hammerWaveAge / 0.42;
        if (ht >= 1) {
          hammerWaveAge = -1;
          hammerRingMesh.visible = false;
        } else {
          hammerRingMesh.scale.setScalar(0.6 + ht * CONFIG.SURVIVAL.HAMMER_AOE_RANGE);
          hammerRingMat.opacity = 0.85 * (1 - ht);
        }
      }

      if (
        survivalState.eventPhase === 'active' &&
        (survivalState.activeEvent === 'volcano_eruption' ||
          survivalState.activeEvent === 'meteor_shower')
      ) {
        eventProjSpawnTimer -= dt;
        if (eventProjSpawnTimer <= 0) {
          eventProjSpawnTimer = survivalState.activeEvent === 'volcano_eruption' ? 0.28 : 0.35;
          for (const ep of eventProjPool) {
            if (ep.active) continue;
            ep.active = true;
            ep.age = 0;
            if (survivalState.activeEvent === 'volcano_eruption') {
              ep.mesh.material = lavaBombMat;
              ep.life = 1.6;
              ep.gravity = 12.5;
              const a = Math.random() * Math.PI * 2;
              const spd = 4.5 + Math.random() * 5.5;
              const volcY = groundHeightAt(CONFIG.ISLAND.VOLCANO.CX, CONFIG.ISLAND.VOLCANO.CZ, worldData);
              ep.mesh.position.set(CONFIG.ISLAND.VOLCANO.CX, volcY + 2.2, CONFIG.ISLAND.VOLCANO.CZ);
              ep.vx = Math.cos(a) * spd;
              ep.vy = 11.5 + Math.random() * 4.5;
              ep.vz = Math.sin(a) * spd;
            } else {
              ep.mesh.material = meteorMat;
              ep.life = 1.1;
              ep.gravity = 0;
              ep.mesh.position.set(
                playerState.x + (Math.random() - 0.5) * 42,
                22,
                playerState.z + (Math.random() - 0.5) * 32
              );
              ep.vx = -10.5;
              ep.vy = -17.5;
              ep.vz = 5.5;
            }
            ep.mesh.scale.setScalar(1.0);
            ep.mesh.visible = true;
            break;
          }
        }
      }
      for (const ep of eventProjPool) {
        if (!ep.active) continue;
        ep.age += dt;
        const t = ep.age / ep.life;
        if (t >= 1) {
          ep.active = false;
          ep.mesh.visible = false;
        } else {
          ep.vy -= ep.gravity * dt;
          ep.mesh.position.x += ep.vx * dt;
          ep.mesh.position.y += ep.vy * dt;
          ep.mesh.position.z += ep.vz * dt;
          ep.mesh.scale.setScalar(Math.max(0.25, 1.15 - t * 0.75));
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

      // Sync 32-Species Wildlife Visual Rigs (articulated legs, heads, tails, attack windup/lunge, KO topple, sleeping tags)
      let predRingIdx = 0;
      for (const actor of survivalState.wildlife.actors) {
        const rig = animalRigBindings.get(actor.id);
        const spec = getAnimalSpecies(actor.speciesId);
        if (!rig || !spec) continue;
        rig.group.visible = actor.visible;
        if (!actor.visible) continue;

        rig.group.position.set(actor.x, actor.y, actor.z);
        rig.group.rotation.y = actor.yaw;

        if (actor.koTimer > 0) {
          const koT = 1 - actor.koTimer / 0.55;
          rig.bodyGroup.rotation.z = koT * Math.PI * 0.48;
          rig.bodyGroup.position.y = -koT * 0.08;
          rig.bodyGroup.scale.setScalar(Math.max(0.15, 1 - koT * 0.72));
          if (rig.sleepTag) rig.sleepTag.visible = false;
          continue;
        }
        rig.bodyGroup.rotation.z = 0;

        if (actor.attackState === 'windup' && predRingIdx < predWarnPool.length) {
          const wr = predWarnPool[predRingIdx];
          predRingIdx += 1;
          wr.visible = true;
          wr.position.set(actor.x, actor.y + 0.08, actor.z);
          wr.scale.setScalar(0.95 + Math.sin(elapsedTime * 22) * 0.16);
        }

        if (actor.sleeping) {
          rig.bodyGroup.scale.set(1.08, 0.72, 1.08);
          rig.bodyGroup.position.y = -0.05;
          for (const leg of rig.legs) leg.rotation.x = 0;
          if (rig.sleepTag) {
            rig.sleepTag.visible = true;
            rig.sleepTag.position.y = 0.72 + Math.sin(elapsedTime * 2.5 + actor.phase) * 0.08;
          }
        } else {
          if (actor.attackState === 'windup') {
            rig.bodyGroup.scale.set(1.14, 0.82, 1.12);
            rig.bodyGroup.rotation.x = -0.22;
            rig.bodyGroup.position.x = Math.sin(elapsedTime * 42) * 0.04;
          } else if (actor.attackState === 'strike') {
            rig.bodyGroup.scale.set(0.94, 1.1, 1.18);
            rig.bodyGroup.rotation.x = 0.28;
            rig.bodyGroup.position.x = 0;
          } else {
            rig.bodyGroup.scale.set(1, 1, 1);
            rig.bodyGroup.rotation.x = 0;
            rig.bodyGroup.position.x = 0;
          }
          if (rig.sleepTag) rig.sleepTag.visible = false;
          const stride = Math.sin(actor.phase * 2.6);
          if (rig.legs.length > 0 && spec.archetype !== 'crab' && spec.archetype !== 'scorpion' && spec.archetype !== 'golem') {
            rig.legs.forEach((leg, lIdx) => {
              const phaseFlip = lIdx === 0 || lIdx === 3 ? 1 : -1;
              leg.rotation.x = stride * 0.48 * phaseFlip;
            });
          } else if (rig.legs.length > 0 && (spec.archetype === 'crab' || spec.archetype === 'scorpion')) {
            rig.legs.forEach((leg, lIdx) => {
              leg.rotation.z = (lIdx % 2 === 0 ? 1 : -1) * Math.sin(actor.phase * 4.0 + lIdx) * 0.24;
            });
          } else if (rig.legs.length > 0 && spec.archetype === 'golem') {
            rig.legs.forEach((arm, aIdx) => {
              arm.rotation.x = Math.sin(actor.phase * 1.8 + aIdx * Math.PI) * 0.35;
            });
          }

          if (rig.headGroup) {
            rig.headGroup.rotation.x = Math.sin(actor.phase * 1.4) * 0.1;
            rig.headGroup.rotation.y = Math.cos(actor.phase * 0.85) * 0.12;
          }
          if (rig.tailGroup) {
            rig.tailGroup.rotation.y = Math.sin(actor.phase * 3.1) * 0.28;
          }
          if (rig.haloGroup) {
            rig.haloGroup.rotation.y += dt * 1.6;
            rig.haloGroup.position.y = 1.32 + Math.sin(elapsedTime * 2.8 + actor.phase) * 0.08;
          }

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
      for (let i = predRingIdx; i < predWarnPool.length; i += 1) {
        predWarnPool[i].visible = false;
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

                // Sync tree shadow while toppling/sinking!
                const shDummy = new THREE.Object3D();
                shDummy.position.set(
                  p.x + treeBind.shadowOffsetX * p.scale,
                  p.y + 0.05,
                  p.z + treeBind.shadowOffsetZ * p.scale
                );
                shDummy.scale.setScalar(treeScale);
                shDummy.updateMatrix();
                treeBind.shadowMesh.setMatrixAt(treeBind.index, shDummy.matrix);
                treeBind.shadowMesh.instanceMatrix.needsUpdate = true;
              } else if (node.cooldownRemaining < 1.4) {
                // Phase 3: Fresh young sapling sprouts smoothly back to full height!
                const regrowT = 1 - node.cooldownRemaining / 1.4;
                const spring = regrowT < 0.8 ? regrowT / 0.8 : 1 + Math.sin(((regrowT - 0.8) / 0.2) * Math.PI) * 0.08;
                treeDummy.position.set(p.x, p.y - 0.14, p.z);
                treeDummy.rotation.set(0, p.rotationY, 0);
                treeDummy.scale.setScalar(p.scale * Math.max(0.05, spring));

                const shDummy = new THREE.Object3D();
                shDummy.position.set(
                  p.x + treeBind.shadowOffsetX * p.scale,
                  p.y + 0.05,
                  p.z + treeBind.shadowOffsetZ * p.scale
                );
                shDummy.scale.setScalar(p.scale * Math.max(0.05, spring));
                shDummy.updateMatrix();
                treeBind.shadowMesh.setMatrixAt(treeBind.index, shDummy.matrix);
                treeBind.shadowMesh.instanceMatrix.needsUpdate = true;
              } else {
                treeDummy.scale.setScalar(0);
                treeDummy.updateMatrix();
                treeBind.shadowMesh.setMatrixAt(treeBind.index, treeDummy.matrix);
                treeBind.shadowMesh.instanceMatrix.needsUpdate = true;
              }
              treeDummy.updateMatrix();
              treeBind.dirty = true;
            } else {
              // Hide stump when tree is back upright & restore shadow
              treeDummy.scale.setScalar(0);
              treeDummy.updateMatrix();
              treeBind.stumpMesh.setMatrixAt(treeBind.stumpIndex, treeDummy.matrix);
              treeBind.stumpMesh.instanceMatrix.needsUpdate = true;

              const shDummy = new THREE.Object3D();
              shDummy.position.set(
                p.x + treeBind.shadowOffsetX * p.scale,
                p.y + 0.05,
                p.z + treeBind.shadowOffsetZ * p.scale
              );
              shDummy.scale.setScalar(p.scale);
              shDummy.updateMatrix();
              treeBind.shadowMesh.setMatrixAt(treeBind.index, shDummy.matrix);
              treeBind.shadowMesh.instanceMatrix.needsUpdate = true;

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
      if (survivalState.gameOutcome !== lastNotifiedOutcome) {
        lastNotifiedOutcome = survivalState.gameOutcome;
        activeKeys.clear();
        joystickInput.dx = 0;
        joystickInput.dy = 0;
        clickWalkTarget = null;
        if (survivalState.gameOutcome === 'victory') {
          soundEngine.playLevelUp();
        } else if (survivalState.gameOutcome === 'defeat') {
          soundEngine.playHitDamage();
        }
        callbacks.onOutcomeChange?.(survivalState.gameOutcome);
      }

      // Realistic Character Pose, Swimming, Movement, Banana Climbing, & Spear/Axe Animations
      const action = survivalState.activeAction;
      const climbBoostY =
        action === 'climb' && !nextPos.moved
          ? Math.sin(Math.min(1, survivalState.actionProgress) * Math.PI) * 1.48
          : 0;
      const swimSurfaceY = survivalState.isSwimming
        ? Math.max(playerState.y, survivalState.seaLevelOffset - 0.56 + Math.sin(elapsedTime * 3.8) * 0.04)
        : playerState.y + climbBoostY;
      survivor.root.position.set(playerState.x, swimSurfaceY, playerState.z);

      if (survivalState.isSwimming) {
        if (nextPos.moved && mag > 0.05) {
          const targetYaw = Math.atan2(moveX, moveZ);
          let diff = targetYaw - playerState.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          playerState.yaw += diff * (1 - Math.exp(-CONFIG.PLAYER.TURN_DAMP * dt));
          survivor.root.rotation.y = playerState.yaw;
        }
        const stroke = nextPos.moved ? Math.sin(elapsedTime * 7.2) : Math.sin(elapsedTime * 2.8) * 0.35;
        const kick = nextPos.moved ? Math.sin(elapsedTime * 11.2) * 0.55 : Math.sin(elapsedTime * 3.2) * 0.18;
        survivor.bodyPivot.rotation.x = 1.12;
        survivor.bodyPivot.rotation.z = stroke * 0.12;
        survivor.bodyPivot.position.y = 0.08;
        survivor.leftArm.rotation.x = -1.35 + stroke * 1.05;
        survivor.rightArm.rotation.x = -1.35 - stroke * 1.05;
        survivor.leftLeg.rotation.x = kick;
        survivor.rightLeg.rotation.x = -kick;
        survivor.headGroup.rotation.z = 0;
        survivor.axeMesh.visible = false;
        survivor.spearMesh.visible = false;
        survivor.fireSpearMesh.visible = false;
        survivor.bowMesh.visible = false;
        survivor.hammerMesh.visible = false;
        survivor.rodGroup.visible = false;
        bobberMesh.visible = false;
        fishingLine.visible = false;
        dustTimer += dt;
        if (dustTimer >= (nextPos.moved ? 0.16 : 0.42)) {
          dustTimer = 0;
          spawnBurstChips(playerState.x, survivalState.seaLevelOffset + 0.03, playerState.z, 'fish');
        }
      } else if (nextPos.moved && mag > 0.05) {
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

        const eq = survivalState.equippedWeapon;
        survivor.axeMesh.visible = eq === 'axe';
        survivor.spearMesh.visible = eq === 'spear' && survivalState.hasSpear && !survivalState.hasFireSpear;
        survivor.fireSpearMesh.visible = eq === 'spear' && survivalState.hasFireSpear;
        survivor.bowMesh.visible = eq === 'bow' && survivalState.unlockedWeapons.bow;
        survivor.hammerMesh.visible = eq === 'hammer' && survivalState.unlockedWeapons.hammer;
        survivor.rodGroup.visible = false;
        bobberMesh.visible = false;
        fishingLine.visible = false;
        castRodSoundQueued = false;

        dustTimer += dt;
        if (dustTimer >= 0.14) {
          dustTimer = 0;
          if (playerState.y < survivalState.seaLevelOffset + 0.02) {
            spawnBurstChips(playerState.x, survivalState.seaLevelOffset + 0.02, playerState.z, 'fish');
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

        if (action !== 'cast_fish') {
          castRodSoundQueued = false;
        }

        if (action === 'chop' || action === 'build') {
          const useHammer =
            action === 'build' &&
            survivalState.equippedWeapon === 'hammer' &&
            survivalState.unlockedWeapons.hammer;
          survivor.axeMesh.visible = !useHammer;
          survivor.hammerMesh.visible = useHammer;
          survivor.spearMesh.visible = false;
          survivor.fireSpearMesh.visible = false;
          survivor.bowMesh.visible = false;
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
          if (strike > 0.85 && chopSwingChipCooldown <= 0) {
            chopSwingChipCooldown = 0.28;
            if (useHammer) soundEngine.playWeaponStrike();
            else soundEngine.playChop();
            if (activeNode) {
              spawnBurstChips(activeNode.x, activeNode.y + 0.4, activeNode.z, 'chipWood');
            }
          }
        } else if (action === 'climb') {
          // Climbing Banana Tree trunk!
          survivor.axeMesh.visible = false;
          survivor.spearMesh.visible = false;
          survivor.fireSpearMesh.visible = false;
          survivor.bowMesh.visible = false;
          survivor.hammerMesh.visible = false;
          survivor.rodGroup.visible = false;
          bobberMesh.visible = false;
          fishingLine.visible = false;

          const cl = Math.sin(elapsedTime * 14);
          survivor.rightArm.rotation.x = -1.65 + cl * 0.55;
          survivor.leftArm.rotation.x = -1.65 - cl * 0.55;
          survivor.leftLeg.rotation.x = cl * 0.6;
          survivor.rightLeg.rotation.x = -cl * 0.6;
          survivor.bodyPivot.rotation.x = 0.18;
        } else if (action === 'cast_fish') {
          // Rod fishing with bobber & curved fishing line in ocean water!
          survivor.axeMesh.visible = false;
          survivor.spearMesh.visible = false;
          survivor.fireSpearMesh.visible = false;
          survivor.bowMesh.visible = false;
          survivor.hammerMesh.visible = false;
          survivor.rodGroup.visible = true;

          if (!castRodSoundQueued) {
            castRodSoundQueued = true;
            soundEngine.playCastRod();
          }

          const rodLift = -0.82 + Math.sin(elapsedTime * 3.4) * 0.08;
          survivor.rightArm.rotation.x = rodLift;
          survivor.leftArm.rotation.x = -0.35;
          survivor.bodyPivot.rotation.x = 0.08;

          survivor.root.updateMatrixWorld(true);
          tipWorldVec.copy(survivor.rodTipLocal);
          survivor.rodGroup.localToWorld(tipWorldVec);

          const bobY = survivalState.seaLevelOffset + 0.04 + Math.sin(elapsedTime * 5.2) * 0.045;
          bobberMesh.position.set(survivalState.actionTargetX, bobY, survivalState.actionTargetZ);
          bobberMesh.visible = true;

          const posArr = fishingLineGeo.attributes.position.array as Float32Array;
          for (let i = 0; i < 12; i += 1) {
            const t = i / 11;
            const lx = THREE.MathUtils.lerp(tipWorldVec.x, bobberMesh.position.x, t);
            const lz = THREE.MathUtils.lerp(tipWorldVec.z, bobberMesh.position.z, t);
            const ly =
              THREE.MathUtils.lerp(tipWorldVec.y, bobberMesh.position.y, t) -
              Math.sin(t * Math.PI) * 0.35;
            posArr[i * 3] = lx;
            posArr[i * 3 + 1] = ly;
            posArr[i * 3 + 2] = lz;
          }
          fishingLineGeo.attributes.position.needsUpdate = true;
          fishingLine.visible = true;
        } else if (action === 'spear_fish') {
          // Wading in shallow surf and thrusting 3D Spear toward offshore fish!
          survivor.axeMesh.visible = false;
          survivor.spearMesh.visible = !survivalState.hasFireSpear;
          survivor.fireSpearMesh.visible = survivalState.hasFireSpear;
          survivor.bowMesh.visible = false;
          survivor.hammerMesh.visible = false;
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
            soundEngine.playWeaponStrike();
            spawnBurstChips(
              survivalState.actionTargetX,
              survivalState.seaLevelOffset + 0.05,
              survivalState.actionTargetZ,
              'fish'
            );
          }
        } else if (action === 'hunt') {
          survivor.axeMesh.visible = false;
          survivor.spearMesh.visible = survivalState.hasSpear && !survivalState.hasFireSpear;
          survivor.fireSpearMesh.visible = survivalState.hasFireSpear;
          survivor.bowMesh.visible = false;
          survivor.hammerMesh.visible = false;
          survivor.rodGroup.visible = false;
          bobberMesh.visible = false;
          fishingLine.visible = false;

          const jab = Math.sin(elapsedTime * 11.5);
          survivor.rightArm.rotation.x = -0.95 + Math.max(0, jab) * 0.85;
          survivor.leftArm.rotation.x = -0.45 - Math.max(0, jab) * 0.25;
          survivor.bodyPivot.rotation.x = 0.2 + Math.max(0, jab) * 0.16;
          survivor.bodyPivot.position.y = Math.abs(jab) * 0.05;
        } else if (action === 'forage') {
          survivor.axeMesh.visible = false;
          survivor.spearMesh.visible = false;
          survivor.fireSpearMesh.visible = false;
          survivor.bowMesh.visible = false;
          survivor.hammerMesh.visible = false;
          survivor.rodGroup.visible = false;
          bobberMesh.visible = false;
          fishingLine.visible = false;
          const reach = Math.sin(elapsedTime * 11);
          survivor.rightArm.rotation.x = -0.75 + reach * 0.35;
          survivor.leftArm.rotation.x = -0.65 - reach * 0.3;
          survivor.bodyPivot.rotation.x = 0.24;
          survivor.bodyPivot.position.y = -0.04;
        } else {
          const eq = survivalState.equippedWeapon;
          survivor.axeMesh.visible = eq === 'axe';
          survivor.spearMesh.visible = eq === 'spear' && survivalState.hasSpear && !survivalState.hasFireSpear;
          survivor.fireSpearMesh.visible = eq === 'spear' && survivalState.hasFireSpear;
          survivor.bowMesh.visible = eq === 'bow' && survivalState.unlockedWeapons.bow;
          survivor.hammerMesh.visible = eq === 'hammer' && survivalState.unlockedWeapons.hammer;
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
    } else if (screenState === 'playing' && survivalState.gameOutcome !== 'playing') {
      // Frozen outcome beat while Victory/Defeat modal is displayed
      targetLookAt.set(playerState.x, playerState.y + CONFIG.CAMERA.LOOK_HEIGHT, playerState.z);
      const followAlpha = 1 - Math.exp(-CONFIG.CAMERA.FOLLOW_DAMP * dt);
      camLookAt.lerp(targetLookAt, followAlpha);
      desiredCamPos.set(camLookAt.x, camLookAt.y + camHeightOffset, camLookAt.z + camDepthOffset);
      camera.position.copy(desiredCamPos);
      camera.lookAt(camLookAt);
    } else {
      survivor.axeMesh.visible = false;
      survivor.spearMesh.visible = false;
      survivor.fireSpearMesh.visible = false;
      survivor.bowMesh.visible = false;
      survivor.hammerMesh.visible = false;
      survivor.rodGroup.visible = false;
      bobberMesh.visible = false;
      fishingLine.visible = false;
      focusRingMesh.visible = false;

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
      lastNotifiedOutcome = 'playing';
      clickWalkTarget = null;
      clickRingMesh.visible = false;
      lastStackSignature = '';
      syncSurvivorBackStack();
      screenState = 'playing';
      emitHud(currentBiome);
      callbacks.onOutcomeChange?.('playing');
      callbacks.onScreenChange('playing', { mode: currentMode, seed: currentSeed });
    },
    returnToMenu: () => {
      screenState = 'title';
      lastNotifiedOutcome = 'playing';
      clickWalkTarget = null;
      clickRingMesh.visible = false;
      joystickInput.dx = 0;
      joystickInput.dy = 0;
      callbacks.onOutcomeChange?.('playing');
      callbacks.onScreenChange('title', { mode: currentMode, seed: currentSeed });
    },
    setJoystickInput: (dx: number, dy: number) => {
      joystickInput.dx = dx;
      joystickInput.dy = dy;
    },
    interact: () => {
      soundEngine.unlockAndStartAmbience();
      requestPlayerInteract(survivalState);
    },
    eatFood: () => {
      const res = eatBestFoodFromInventory(survivalState);
      if (res.ate) {
        soundEngine.playPickup();
        lastStackSignature = '';
        syncSurvivorBackStack();
        emitHud(currentBiome);
      }
      return res.ate;
    },
    craftSpear: () => {
      const ok = craftSpear(survivalState);
      if (ok) {
        soundEngine.playLevelUp();
        lastStackSignature = '';
        syncSurvivorBackStack();
        emitHud(currentBiome);
        callbacks.onNotice?.('نیزه شکار ساخته شد! در ساحل ماهی بگیر یا جانوران بزرگ را شکار کن');
      }
      return ok;
    },
    selectWeapon: (id: WeaponId) => {
      const ok = selectWeapon(survivalState, id);
      if (ok) {
        soundEngine.playClick();
        emitHud(currentBiome);
      }
      return ok;
    },
    upgradeWeapon: (id: WeaponId) => {
      const ok = upgradeWeapon(survivalState, id);
      if (ok) {
        soundEngine.playLevelUp();
        lastStackSignature = '';
        syncSurvivorBackStack();
        emitHud(currentBiome);
      }
      return ok;
    },
    stokeFire: () => {
      const ok = stokeCampfire(survivalState);
      if (ok) {
        soundEngine.playLevelUp();
        lastStackSignature = '';
        syncSurvivorBackStack();
        const campY = groundHeightAt(CONFIG.ISLAND.CAMPFIRE.CX, CONFIG.ISLAND.CAMPFIRE.CZ, worldData);
        spawnBurstChips(CONFIG.ISLAND.CAMPFIRE.CX, campY + 0.5, CONFIG.ISLAND.CAMPFIRE.CZ, 'ember');
        emitHud(currentBiome);
        const lv = survivalState.fireLevel;
        const unlockMsg =
          lv === 2
            ? 'آتش سطح ۲: کباب‌کردن موز باز شد!'
            : lv === 3
              ? 'آتش سطح ۳: کمان صیاد باز شد + دفع شکارچیان!'
              : lv === 4
                ? 'آتش سطح ۴: چکش توفان باز شد + ۱.۵ برابر تجربه!'
                : lv === 5
                  ? 'آتش سطح ۵: ساخت قایق چوبی کنار کمپ باز شد!'
                  : lv === 7
                    ? 'آتش سطح ۷: شعله باستانی (+۷۵٪ تجربه)!'
                    : lv === CONFIG.SURVIVAL.MAX_FIRE_LEVEL
                      ? 'آتش به اوج اسطوره‌ای سطح ۱۰ رسید!'
                      : `شعله کمپ به سطح ${toPersianDigits(lv)} ارتقا یافت!`;
        callbacks.onNotice?.(unlockMsg);
      }
      return ok;
    },
    upgradeSkill: (skillId: SkillId) => {
      const ok = upgradeSkill(survivalState, skillId);
      if (ok) {
        soundEngine.playLevelUp();
        lastStackSignature = '';
        syncSurvivorBackStack();
        emitHud(currentBiome);
      }
      return ok;
    },
    triggerLandmark: (id: StrangeLandmarkId) => {
      const res = activateLandmarkPower(survivalState, id);
      if (res.triggered) {
        soundEngine.playLevelUp();
        lastStackSignature = '';
        syncSurvivorBackStack();
        emitHud(currentBiome);
        callbacks.onNotice?.(res.label);
      }
      return res;
    },
    triggerLandmarkSpecial: (id: StrangeLandmarkId) => {
      const res = activateLandmarkSpecial(survivalState, id);
      if (res.triggered) {
        soundEngine.playPickup();
        lastStackSignature = '';
        syncSurvivorBackStack();
        emitHud(currentBiome);
      }
      if (res.label) {
        callbacks.onNotice?.(res.label);
      }
      return res;
    },
    triggerVictoryVoyage: () => {
      const ok = triggerVictoryVoyage(survivalState);
      if (ok) {
        lastNotifiedOutcome = 'victory';
        soundEngine.playLevelUp();
        emitHud(currentBiome);
        callbacks.onOutcomeChange?.('victory');
      }
      return ok;
    },
    toggleMute: () => {
      return soundEngine.toggleMute();
    },
    isMuted: () => {
      return soundEngine.isMuted();
    },
    destroy: () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onCanvasPointerDown);
      renderer.domElement.removeEventListener('pointerup', onCanvasPointerUp);
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

