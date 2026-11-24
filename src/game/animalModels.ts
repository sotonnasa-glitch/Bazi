import * as THREE from 'three';
import {
  buildBatWingGeometry,
  buildBirdTorsoGeometry,
  buildCurvedGullWingGeometry,
  buildFeatherPlumeGeometry,
  buildFishFinGeometry,
  buildFishGeometry,
  buildQuadrupedTorsoGeometry,
  buildSculptedSunCrystalGeometry,
  buildSeashellGeometry,
} from './sculptGeometry';
import type { AnimalSpeciesSpec } from './wildlife';

export interface AnimalVisualRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup?: THREE.Object3D;
  legs: THREE.Object3D[];
  leftWing?: THREE.Object3D;
  rightWing?: THREE.Object3D;
  leftWingTip?: THREE.Object3D;
  rightWingTip?: THREE.Object3D;
  tailGroup?: THREE.Object3D;
  clawL?: THREE.Object3D;
  clawR?: THREE.Object3D;
  haloGroup?: THREE.Object3D;
  segments?: THREE.Object3D[];
  tongueGroup?: THREE.Object3D;
  sleepTag?: THREE.Mesh;
  shadowMesh?: THREE.Mesh;
  dispose: () => void;
}

function buildOrganicTorsoLathe(): THREE.BufferGeometry {
  return buildQuadrupedTorsoGeometry();
}

function buildTaperedLegLathe(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0, -0.24),
    new THREE.Vector2(0.044, -0.23),
    new THREE.Vector2(0.036, -0.14),
    new THREE.Vector2(0.048, -0.04),
    new THREE.Vector2(0.068, 0.05),
    new THREE.Vector2(0.0, 0.07),
  ];
  const geo = new THREE.LatheGeometry(pts, 10);
  geo.computeVertexNormals();
  return geo;
}

function buildSnoutGeo(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0, -0.1),
    new THREE.Vector2(0.11, -0.08),
    new THREE.Vector2(0.085, 0.03),
    new THREE.Vector2(0.052, 0.12),
    new THREE.Vector2(0.0, 0.145),
  ];
  const geo = new THREE.LatheGeometry(pts, 10);
  geo.rotateX(Math.PI / 2);
  geo.scale(1.0, 0.84, 1.0);
  geo.computeVertexNormals();
  return geo;
}

function buildCurvedTailGeo(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.09, -0.12),
    new THREE.Vector3(0, 0.2, -0.22),
    new THREE.Vector3(0, 0.25, -0.32),
  ]);
  const geo = new THREE.TubeGeometry(curve, 10, 0.058, 8, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp(-z / 0.32, 0, 1);
    const swell = 0.65 + Math.sin(t * Math.PI) * 0.72;
    pos.setX(i, pos.getX(i) * swell);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildAntlerBranchGeo(): THREE.BufferGeometry {
  const main = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.05, 0.12, -0.02),
      new THREE.Vector3(0.12, 0.25, -0.05),
      new THREE.Vector3(0.16, 0.36, 0.02),
    ]),
    8,
    0.02,
    6,
    false
  );
  const tine = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.06, 0.14, -0.02),
      new THREE.Vector3(0.04, 0.22, 0.09),
    ]),
    4,
    0.014,
    5,
    false
  );
  // Combine non-indexed attributes manually so there's zero external dependency overhead
  const g1 = main.index ? main.toNonIndexed() : main;
  const g2 = tine.index ? tine.toNonIndexed() : tine;
  const p1 = g1.attributes.position.array as Float32Array;
  const p2 = g2.attributes.position.array as Float32Array;
  const n1 = g1.attributes.normal.array as Float32Array;
  const n2 = g2.attributes.normal.array as Float32Array;
  const mergedPos = new Float32Array(p1.length + p2.length);
  mergedPos.set(p1, 0);
  mergedPos.set(p2, p1.length);
  const mergedNorm = new Float32Array(n1.length + n2.length);
  mergedNorm.set(n1, 0);
  mergedNorm.set(n2, n1.length);
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
  main.dispose();
  tine.dispose();
  g1.dispose();
  g2.dispose();
  return out;
}

function buildCurvedBeakGeo(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.02, 0),
    new THREE.Vector3(0, 0.01, 0.11),
    new THREE.Vector3(0, -0.04, 0.2),
  ]);
  const geo = new THREE.TubeGeometry(curve, 8, 0.048, 7, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp(z / 0.2, 0, 1);
    const taper = Math.max(0.14, 1 - t * 0.86);
    pos.setX(i, pos.getX(i) * taper * 0.85);
    pos.setY(i, pos.getY(i) * taper + (1 - taper) * -0.02);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildTurtleDomeGeo(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.32, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const scute = 1 + 0.04 * Math.sin(x * 16) * Math.cos(z * 14);
    pos.setXYZ(i, x * 1.08 * scute, y * 0.78 * scute, z * 1.24 * scute);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildButterflyWingGeo(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.18, 0.24, 0.48, 0.28, 0.44, 0.06);
  shape.bezierCurveTo(0.4, -0.06, 0.24, -0.04, 0.18, -0.08);
  shape.bezierCurveTo(0.32, -0.18, 0.26, -0.34, 0.06, -0.24);
  shape.bezierCurveTo(0.02, -0.16, 0, -0.06, 0, 0);
  const geo = new THREE.ShapeGeometry(shape, 10);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export function createAnimalGeometryLibrary() {
  const sphere = new THREE.SphereGeometry(0.28, 14, 11);
  const smallSphere = new THREE.SphereGeometry(0.14, 11, 9);
  const capsule = new THREE.CapsuleGeometry(0.11, 0.26, 5, 10);
  const legGeo = buildTaperedLegLathe();
  const torsoGeo = buildOrganicTorsoLathe();
  const snoutGeo = buildSnoutGeo();
  const curvedTailGeo = buildCurvedTailGeo();
  const antlerGeo = buildAntlerBranchGeo();
  const beakGeo = buildCurvedBeakGeo();
  const turtleShellGeo = buildTurtleDomeGeo();
  const butterflyWingGeo = buildButterflyWingGeo();
  const birdTorsoGeo = buildBirdTorsoGeometry();
  const featherPlumeGeo = buildFeatherPlumeGeometry();
  const fishFinGeo = buildFishFinGeometry();
  const earCap = new THREE.CapsuleGeometry(0.042, 0.18, 4, 8);
  const wingRightGeo = buildCurvedGullWingGeometry(1);
  const wingLeftGeo = buildCurvedGullWingGeometry(-1);
  const batWingRightGeo = buildBatWingGeometry(1);
  const batWingLeftGeo = buildBatWingGeometry(-1);
  const fishGeo = buildFishGeometry();
  const shellGeo = buildSeashellGeometry();
  const crystalShardGeo = buildSculptedSunCrystalGeometry();
  const eyeScleraGeo = new THREE.SphereGeometry(0.044, 9, 8);
  const eyePupilGeo = new THREE.SphereGeometry(0.028, 8, 7);
  const eyeGlintGeo = new THREE.SphereGeometry(0.011, 6, 5);
  const sleepBubbleGeo = new THREE.SphereGeometry(0.11, 8, 6);

  return {
    sphere,
    smallSphere,
    capsule,
    legGeo,
    torsoGeo,
    birdTorsoGeo,
    featherPlumeGeo,
    fishFinGeo,
    snoutGeo,
    curvedTailGeo,
    antlerGeo,
    beakGeo,
    turtleShellGeo,
    butterflyWingGeo,
    earCap,
    wingRightGeo,
    wingLeftGeo,
    batWingRightGeo,
    batWingLeftGeo,
    fishGeo,
    shellGeo,
    crystalShardGeo,
    eyeScleraGeo,
    eyePupilGeo,
    eyeGlintGeo,
    sleepBubbleGeo,
    dispose: () => {
      sphere.dispose();
      smallSphere.dispose();
      capsule.dispose();
      legGeo.dispose();
      torsoGeo.dispose();
      birdTorsoGeo.dispose();
      featherPlumeGeo.dispose();
      fishFinGeo.dispose();
      snoutGeo.dispose();
      curvedTailGeo.dispose();
      antlerGeo.dispose();
      beakGeo.dispose();
      turtleShellGeo.dispose();
      butterflyWingGeo.dispose();
      earCap.dispose();
      wingRightGeo.dispose();
      wingLeftGeo.dispose();
      batWingRightGeo.dispose();
      batWingLeftGeo.dispose();
      fishGeo.dispose();
      shellGeo.dispose();
      crystalShardGeo.dispose();
      eyeScleraGeo.dispose();
      eyePupilGeo.dispose();
      eyeGlintGeo.dispose();
      sleepBubbleGeo.dispose();
    },
  };
}

export type AnimalGeoLib = ReturnType<typeof createAnimalGeometryLibrary>;

export function buildSculptedAnimalRig(
  spec: AnimalSpeciesSpec,
  geoLib: AnimalGeoLib,
  shadowDiscMat: THREE.MeshBasicMaterial
): AnimalVisualRig {
  const disposables: Array<{ dispose: () => void }> = [];
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const shadowGeo = new THREE.CircleGeometry(0.42 * spec.scale, 14);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(shadowGeo, shadowDiscMat);
  shadow.position.y = 0.03;
  if (!spec.aquatic) root.add(shadow);
  disposables.push(shadowGeo);

  const primaryMat = new THREE.MeshStandardMaterial({
    color: spec.primaryColor,
    roughness: spec.archetype === 'crab' || spec.archetype === 'turtle' ? 0.42 : 0.72,
    metalness: spec.archetype === 'golem' ? 0.18 : 0.04,
    emissive: spec.category === 'strange' ? spec.secondaryColor : 0x000000,
    emissiveIntensity: spec.category === 'strange' ? 0.24 : 0,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: spec.secondaryColor,
    roughness: 0.58,
    metalness: 0.04,
    emissive:
      spec.category === 'strange' || spec.id === 'night_viper' ? spec.secondaryColor : 0x000000,
    emissiveIntensity: spec.category === 'strange' ? 0.42 : spec.id === 'night_viper' ? 0.3 : 0,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: spec.accentColor,
    roughness: 0.45,
    metalness: 0.08,
    emissive: spec.category === 'night_predator' ? spec.accentColor : 0x000000,
    emissiveIntensity: spec.category === 'night_predator' ? 0.85 : 0,
  });
  const scleraMat = new THREE.MeshStandardMaterial({
    color: 0xfffdf8,
    roughness: 0.25,
    emissive: spec.category === 'night_predator' ? spec.accentColor : 0x000000,
    emissiveIntensity: spec.category === 'night_predator' ? 0.35 : 0,
  });
  const pupilMat = new THREE.MeshStandardMaterial({
    color: spec.category === 'night_predator' ? spec.accentColor : 0x161b24,
    roughness: 0.15,
    emissive: spec.category === 'night_predator' ? spec.accentColor : 0x000000,
    emissiveIntensity: spec.category === 'night_predator' ? 1.25 : 0,
  });
  const sleepMat = new THREE.MeshBasicMaterial({
    color: 0xd9ecff,
    transparent: true,
    opacity: 0.85,
  });
  disposables.push(primaryMat, secondaryMat, accentMat, scleraMat, pupilMat, sleepMat);

  const wingTranslucentMat =
    spec.archetype === 'butterfly'
      ? new THREE.MeshStandardMaterial({
          color: spec.primaryColor,
          roughness: 0.35,
          metalness: 0.08,
          transparent: true,
          opacity: 0.88,
          side: THREE.DoubleSide,
          emissive: spec.secondaryColor,
          emissiveIntensity: spec.category === 'strange' ? 0.38 : 0.14,
        })
      : primaryMat;
  if (wingTranslucentMat !== primaryMat) disposables.push(wingTranslucentMat);

  const addLayeredEye = (
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    scale = 1.0
  ) => {
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(x, y, z);
    const sclera = new THREE.Mesh(geoLib.eyeScleraGeo, scleraMat);
    sclera.scale.setScalar(scale);
    const pupil = new THREE.Mesh(geoLib.eyePupilGeo, pupilMat);
    pupil.scale.setScalar(scale);
    pupil.position.set(0, 0, 0.022 * scale);
    const glint = new THREE.Mesh(geoLib.eyeGlintGeo, scleraMat);
    glint.scale.setScalar(scale);
    glint.position.set(0.01 * scale, 0.012 * scale, 0.044 * scale);
    // Expressive brow ridge / upper eyelid
    const brow = new THREE.Mesh(geoLib.smallSphere, primaryMat);
    brow.scale.set(0.32 * scale, 0.14 * scale, 0.24 * scale);
    brow.position.set(0, 0.038 * scale, 0.01 * scale);
    brow.rotation.z = x < 0 ? 0.16 : -0.16;
    eyeGroup.add(sclera, pupil, glint, brow);
    parent.add(eyeGroup);
  };

  let headGroup: THREE.Object3D | undefined;
  const legs: THREE.Object3D[] = [];
  let leftWing: THREE.Object3D | undefined;
  let rightWing: THREE.Object3D | undefined;
  let leftWingTip: THREE.Object3D | undefined;
  let rightWingTip: THREE.Object3D | undefined;
  let tailGroup: THREE.Object3D | undefined;
  let clawL: THREE.Object3D | undefined;
  let clawR: THREE.Object3D | undefined;
  let haloGroup: THREE.Object3D | undefined;
  const segments: THREE.Object3D[] = [];
  let tongueGroup: THREE.Object3D | undefined;

  const wingFeatheredMat = new THREE.MeshStandardMaterial({
    color: spec.id === 'vampire_bat' ? spec.secondaryColor : spec.primaryColor,
    roughness: spec.id === 'vampire_bat' ? 0.56 : 0.62,
    metalness: 0.04,
    vertexColors: true,
    emissive: spec.category === 'strange' ? spec.secondaryColor : 0x000000,
    emissiveIntensity: spec.category === 'strange' ? 0.28 : 0,
  });
  disposables.push(wingFeatheredMat);

  const arch = spec.archetype;

  if (arch === 'crab') {
    // Sculpted wide domed carapace + dorsal ridges + 6 jointed legs + asymmetric pincer claws + stalked eyes
    const carapace = new THREE.Mesh(geoLib.sphere, primaryMat);
    carapace.scale.set(1.32, 0.52, 1.0);
    carapace.position.y = 0.24;
    carapace.castShadow = true;
    bodyGroup.add(carapace);

    // Sculpted dorsal ridges & speckles on crab carapace
    for (const [rx, rz, rs] of [
      [-0.14, -0.04, 0.48],
      [0.14, -0.04, 0.48],
      [0, -0.1, 0.58],
    ]) {
      const ridge = new THREE.Mesh(geoLib.smallSphere, accentMat);
      ridge.scale.set(rs, rs * 0.45, rs * 0.72);
      ridge.position.set(rx, 0.36, rz);
      bodyGroup.add(ridge);
    }

    const apron = new THREE.Mesh(geoLib.smallSphere, secondaryMat);
    apron.scale.set(1.5, 0.55, 0.72);
    apron.position.set(0, 0.23, 0.12);
    bodyGroup.add(apron);

    if (spec.id === 'hermit_crab') {
      const shell = new THREE.Mesh(geoLib.shellGeo, secondaryMat);
      shell.scale.setScalar(1.48);
      shell.position.set(0, 0.39, -0.06);
      shell.rotation.x = -0.38;
      shell.castShadow = true;
      bodyGroup.add(shell);
    } else if (spec.id === 'pirate_crab') {
      // Golden captain crown on pirate crab!
      const crown = new THREE.Mesh(geoLib.smallSphere, secondaryMat);
      crown.scale.set(0.85, 0.5, 0.85);
      crown.position.set(0, 0.4, 0.04);
      bodyGroup.add(crown);
    }

    for (const side of [-1, 1]) {
      for (let l = 0; l < 3; l += 1) {
        const legPivot = new THREE.Group();
        legPivot.position.set(side * 0.28, 0.2, (l - 1) * 0.16);
        const legUpper = new THREE.Mesh(geoLib.legGeo, secondaryMat);
        legUpper.rotation.z = side * 0.92;
        legUpper.scale.set(0.8, 0.88, 0.8);
        legUpper.position.set(side * 0.1, -0.06, 0);
        legPivot.add(legUpper);
        bodyGroup.add(legPivot);
        legs.push(legPivot);
      }

      const clawArm = new THREE.Group();
      clawArm.position.set(side * 0.34, 0.26, 0.24);
      const isGiantLeft = spec.id === 'pirate_crab' && side > 0;
      const armSeg = new THREE.Mesh(geoLib.legGeo, primaryMat);
      armSeg.rotation.x = Math.PI * 0.42;
      armSeg.scale.setScalar(isGiantLeft ? 1.05 : 0.75);
      clawArm.add(armSeg);

      const pincerTop = new THREE.Mesh(geoLib.snoutGeo, secondaryMat);
      pincerTop.scale.set(isGiantLeft ? 1.55 : 1.05, 0.78, isGiantLeft ? 1.55 : 1.05);
      pincerTop.position.set(side * 0.06, 0.06, 0.18);
      const pincerBot = new THREE.Mesh(geoLib.snoutGeo, primaryMat);
      pincerBot.scale.set(isGiantLeft ? 1.25 : 0.85, 0.52, isGiantLeft ? 1.25 : 0.85);
      pincerBot.position.set(side * 0.06, 0.0, 0.16);
      // Serrated pincer tooth nubs for crisp silhouette detail
      for (const tz of [0.22, 0.27]) {
        const tooth = new THREE.Mesh(geoLib.smallSphere, accentMat);
        tooth.scale.setScalar(isGiantLeft ? 0.22 : 0.15);
        tooth.position.set(side * 0.04, 0.032, tz);
        clawArm.add(tooth);
      }
      clawArm.add(pincerTop, pincerBot);
      bodyGroup.add(clawArm);
      if (side < 0) clawL = clawArm;
      else clawR = clawArm;

      // Eye stalks
      const stalk = new THREE.Mesh(geoLib.earCap, secondaryMat);
      stalk.scale.set(0.45, 0.55, 0.45);
      stalk.position.set(side * 0.12, 0.37, 0.22);
      bodyGroup.add(stalk);
      addLayeredEye(bodyGroup, side * 0.12, 0.44, 0.24, 0.95);
    }
  } else if (arch === 'starfish') {
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      const arm = new THREE.Mesh(geoLib.snoutGeo, i % 2 === 0 ? primaryMat : secondaryMat);
      arm.rotation.y = a;
      arm.scale.set(0.95, 0.58, 1.55);
      arm.position.set(Math.sin(a) * 0.16, 0.075, Math.cos(a) * 0.16);
      bodyGroup.add(arm);

      const bump = new THREE.Mesh(geoLib.smallSphere, accentMat);
      bump.scale.setScalar(0.28);
      bump.position.set(Math.sin(a) * 0.2, 0.125, Math.cos(a) * 0.2);
      bodyGroup.add(bump);
    }
    const hub = new THREE.Mesh(geoLib.smallSphere, primaryMat);
    hub.scale.set(1.35, 0.65, 1.35);
    hub.position.y = 0.095;
    bodyGroup.add(hub);
  } else if (arch === 'fish') {
    const fishMesh = new THREE.Mesh(geoLib.fishGeo, primaryMat);
    fishMesh.scale.setScalar(1.42);
    fishMesh.castShadow = true;
    bodyGroup.add(fishMesh);

    const dorsal = new THREE.Mesh(geoLib.fishFinGeo, secondaryMat);
    dorsal.rotation.y = Math.PI * 0.5;
    dorsal.rotation.z = 0.22;
    dorsal.scale.set(1.25, 1.35, 1.2);
    dorsal.position.set(0, 0.14, 0.08);
    bodyGroup.add(dorsal);

    // Paired pectoral fins + gill accent bands
    for (const sx of [-1, 1]) {
      const pec = new THREE.Mesh(geoLib.fishFinGeo, secondaryMat);
      pec.rotation.x = Math.PI * 0.42;
      pec.rotation.y = sx * 0.55;
      pec.scale.set(sx * 0.85, 0.85, 0.9);
      pec.position.set(sx * 0.12, -0.02, 0.08);
      bodyGroup.add(pec);
    }

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.01, -0.34);
    for (const ang of [0.36, -0.36]) {
      const fork = new THREE.Mesh(geoLib.fishFinGeo, secondaryMat);
      fork.rotation.y = Math.PI * 0.5;
      fork.rotation.x = ang;
      fork.scale.set(0.95, 0.85, 1.0);
      tailPivot.add(fork);
    }
    bodyGroup.add(tailPivot);
    tailGroup = tailPivot;

    for (const sx of [-1, 1]) {
      addLayeredEye(bodyGroup, sx * 0.1, 0.04, 0.22, 0.85);
    }
  } else if (arch === 'turtle') {
    // Patterned domed carapace + ventral plastron + tapered head + articulated flippers
    const dome = new THREE.Mesh(geoLib.turtleShellGeo, secondaryMat);
    dome.position.y = 0.16;
    dome.castShadow = true;
    bodyGroup.add(dome);

    // Raised hexagonal scute plates along dorsal ridge
    for (const [sx, sy, sz] of [
      [0, 0.38, 0.08],
      [0, 0.36, -0.12],
      [-0.14, 0.31, -0.02],
      [0.14, 0.31, -0.02],
    ]) {
      const scute = new THREE.Mesh(geoLib.smallSphere, primaryMat);
      scute.scale.set(0.55, 0.28, 0.62);
      scute.position.set(sx, sy, sz);
      bodyGroup.add(scute);
    }

    const rim = new THREE.Mesh(geoLib.sphere, accentMat);
    rim.scale.set(1.25, 0.22, 1.44);
    rim.position.y = 0.16;
    bodyGroup.add(rim);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.23, 0.38);
    const head = new THREE.Mesh(geoLib.snoutGeo, primaryMat);
    head.scale.set(0.95, 0.92, 1.08);
    head.castShadow = true;
    headPivot.add(head);
    for (const sx of [-1, 1]) {
      addLayeredEye(headPivot, sx * 0.078, 0.045, 0.075, 0.85);
    }
    bodyGroup.add(headPivot);
    headGroup = headPivot;

    const tail = new THREE.Mesh(geoLib.snoutGeo, primaryMat);
    tail.rotation.y = Math.PI;
    tail.scale.set(0.45, 0.4, 0.65);
    tail.position.set(0, 0.16, -0.4);
    bodyGroup.add(tail);
    tailGroup = tail;

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const flipPivot = new THREE.Group();
        flipPivot.position.set(sx * 0.28, 0.15, sz * 0.22);
        const flipper = new THREE.Mesh(geoLib.legGeo, primaryMat);
        flipper.rotation.z = sx * (spec.aquatic ? 1.28 : 0.42);
        flipper.scale.set(0.85, 0.9, 1.15);
        flipPivot.add(flipper);
        bodyGroup.add(flipPivot);
        legs.push(flipPivot);
      }
    }
  } else if (arch === 'bird' || arch === 'butterfly') {
    const isFlamingo = spec.id === 'flamingo';
    const isOwl = spec.id === 'giant_owl';
    const isPhoenix = spec.id === 'ember_phoenix';
    const isToucan = spec.id === 'toucan';
    const isParrot = spec.id === 'parrot';
    const isButterfly = arch === 'butterfly';
    const isBat = spec.id === 'vampire_bat';

    // Streamlined aerodynamic bird torso + feathered keel + shoulder mantle
    const torso = new THREE.Mesh(
      isButterfly ? geoLib.torsoGeo : geoLib.birdTorsoGeo,
      primaryMat
    );
    torso.rotation.x = isFlamingo ? -0.18 : isOwl ? -0.14 : -0.1;
    torso.scale.set(
      isButterfly ? 0.34 : isOwl ? 1.18 : isPhoenix ? 0.92 : 0.84,
      isButterfly ? 0.34 : isOwl ? 1.14 : 0.86,
      isButterfly ? 0.85 : isPhoenix ? 1.08 : 0.94
    );
    torso.position.y = isFlamingo ? 0.56 : 0.34;
    torso.castShadow = true;
    bodyGroup.add(torso);

    if (!isButterfly) {
      const breast = new THREE.Mesh(geoLib.smallSphere, isBat ? primaryMat : secondaryMat);
      breast.scale.set(isOwl ? 1.14 : 0.82, 0.88, 1.08);
      breast.position.set(0, isFlamingo ? 0.54 : 0.31, 0.08);
      bodyGroup.add(breast);

      const rump = new THREE.Mesh(geoLib.smallSphere, isParrot ? accentMat : primaryMat);
      rump.scale.set(0.64, 0.54, 0.9);
      rump.position.set(0, isFlamingo ? 0.53 : 0.33, -0.18);
      bodyGroup.add(rump);
    }

    const headPivot = new THREE.Group();
    headPivot.position.set(
      0,
      isFlamingo ? 0.94 : isButterfly ? 0.38 : 0.46,
      isFlamingo ? 0.24 : 0.24
    );

    if (!isButterfly) {
      // Feathered neck transition joining head seamlessly to shoulders
      const neckCollar = new THREE.Mesh(
        geoLib.smallSphere,
        isParrot || isToucan ? accentMat : secondaryMat
      );
      neckCollar.scale.set(isOwl ? 1.08 : 0.72, 0.65, 0.76);
      neckCollar.position.set(0, -0.09, -0.05);
      headPivot.add(neckCollar);
    }

    const head = new THREE.Mesh(
      geoLib.smallSphere,
      isButterfly || isBat || isFlamingo || isToucan ? primaryMat : isParrot ? primaryMat : secondaryMat
    );
    head.scale.set(isOwl ? 1.3 : 0.94, isOwl ? 1.12 : 0.92, 0.98);
    head.castShadow = true;
    headPivot.add(head);

    if (isFlamingo) {
      // Graceful S-neck for flamingo
      const neck = new THREE.Mesh(geoLib.curvedTailGeo, primaryMat);
      neck.rotation.y = Math.PI;
      neck.scale.set(0.58, 1.32, 0.62);
      neck.position.set(0, -0.32, -0.05);
      headPivot.add(neck);
    }

    if (arch === 'bird') {
      // Sculpted upper & lower beak with species-accurate proportions
      const upperBeak = new THREE.Mesh(
        geoLib.beakGeo,
        isToucan ? accentMat : isParrot ? accentMat : secondaryMat
      );
      upperBeak.scale.set(
        isToucan ? 1.35 : isOwl ? 0.78 : 0.88,
        isToucan ? 1.45 : isOwl ? 0.88 : 0.85,
        isToucan ? 2.15 : isFlamingo ? 1.2 : isOwl ? 0.82 : 0.98
      );
      upperBeak.position.set(0, 0.0, 0.09);
      headPivot.add(upperBeak);

      if (isToucan) {
        const beakTip = new THREE.Mesh(geoLib.smallSphere, secondaryMat);
        beakTip.scale.set(0.42, 0.56, 0.68);
        beakTip.position.set(0, -0.03, 0.44);
        headPivot.add(beakTip);
      } else if (!isFlamingo) {
        const lowerBeak = new THREE.Mesh(geoLib.snoutGeo, accentMat);
        lowerBeak.scale.set(0.45, 0.34, 0.65);
        lowerBeak.position.set(0, -0.045, 0.13);
        headPivot.add(lowerBeak);
      }
    } else if (isBat) {
      for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(geoLib.earCap, secondaryMat);
        ear.scale.set(0.56, 0.98, 0.48);
        ear.position.set(sx * 0.085, 0.14, -0.01);
        ear.rotation.z = -sx * 0.28;
        headPivot.add(ear);
      }
    }

    if (isPhoenix || isParrot) {
      // Layered crown plume feathers
      for (let c = 0; c < (isPhoenix ? 3 : 2); c += 1) {
        const crest = new THREE.Mesh(
          geoLib.featherPlumeGeo,
          c === 0 ? accentMat : secondaryMat
        );
        crest.scale.set(0.75, 0.75, isPhoenix ? 1.25 - c * 0.16 : 0.85);
        crest.rotation.x = 0.48 + c * 0.2;
        crest.position.set(0, 0.1 + c * 0.015, -0.02);
        headPivot.add(crest);
      }
    } else if (isOwl) {
      // Feathered facial discs + sweeping horn ear tufts
      for (const sx of [-1, 1]) {
        const disc = new THREE.Mesh(geoLib.smallSphere, primaryMat);
        disc.scale.set(0.62, 0.62, 0.25);
        disc.position.set(sx * 0.072, 0.015, 0.098);
        headPivot.add(disc);

        const tuft = new THREE.Mesh(geoLib.featherPlumeGeo, secondaryMat);
        tuft.scale.set(0.72, 0.72, 0.82);
        tuft.position.set(sx * 0.1, 0.11, -0.02);
        tuft.rotation.set(0.52, sx * 0.42, -sx * 0.32);
        headPivot.add(tuft);
      }
    }

    for (const sx of [-1, 1]) {
      addLayeredEye(
        headPivot,
        sx * (isOwl ? 0.075 : 0.074),
        0.026,
        isOwl ? 0.118 : 0.085,
        isOwl ? 1.12 : 0.8
      );
    }
    bodyGroup.add(headPivot);
    headGroup = headPivot;

    // Articulated Left & Right Wings with outer primary feather hinge (fixes left-side inside-out normals!)
    const wingY = isFlamingo ? 0.6 : 0.38;
    const wScale = isButterfly ? 1.35 : isPhoenix ? 1.48 : isOwl ? 1.42 : isFlamingo ? 1.36 : 1.32;
    const wingShoulderX = isButterfly ? 0.05 : 0.1;

    const wl = new THREE.Group();
    wl.position.set(-wingShoulderX, wingY, 0.05);
    const wlMesh = new THREE.Mesh(
      isButterfly
        ? geoLib.butterflyWingGeo
        : isBat
          ? geoLib.batWingLeftGeo
          : geoLib.wingLeftGeo,
      isButterfly ? wingTranslucentMat : wingFeatheredMat
    );
    if (isButterfly) {
      wlMesh.scale.set(-wScale, wScale, wScale);
    } else {
      wlMesh.scale.setScalar(wScale);
    }
    wlMesh.castShadow = !isButterfly;
    wl.add(wlMesh);

    const wr = new THREE.Group();
    wr.position.set(wingShoulderX, wingY, 0.05);
    const wrMesh = new THREE.Mesh(
      isButterfly
        ? geoLib.butterflyWingGeo
        : isBat
          ? geoLib.batWingRightGeo
          : geoLib.wingRightGeo,
      isButterfly ? wingTranslucentMat : wingFeatheredMat
    );
    wrMesh.scale.setScalar(wScale);
    wrMesh.castShadow = !isButterfly;
    wr.add(wrMesh);

    if (arch === 'bird') {
      // Secondary accent covert patch & outer wingtip flex group
      const wlTip = new THREE.Group();
      wlTip.position.set(-0.56 * wScale, 0.02 * wScale, -0.06 * wScale);
      const lTipFeather = new THREE.Mesh(geoLib.featherPlumeGeo, secondaryMat);
      lTipFeather.scale.set(0.75 * wScale, 0.65 * wScale, 0.95 * wScale);
      lTipFeather.rotation.y = 0.72;
      wlTip.add(lTipFeather);
      wl.add(wlTip);
      leftWingTip = wlTip;

      const wrTip = new THREE.Group();
      wrTip.position.set(0.56 * wScale, 0.02 * wScale, -0.06 * wScale);
      const rTipFeather = new THREE.Mesh(geoLib.featherPlumeGeo, secondaryMat);
      rTipFeather.scale.set(0.75 * wScale, 0.65 * wScale, 0.95 * wScale);
      rTipFeather.rotation.y = -0.72;
      wrTip.add(rTipFeather);
      wr.add(wrTip);
      rightWingTip = wrTip;
    }

    bodyGroup.add(wl, wr);
    leftWing = wl;
    rightWing = wr;

    // Wide 5-feather fanned tail plumes for birds
    if (arch === 'bird') {
      const tailFan = new THREE.Group();
      tailFan.position.set(0, isFlamingo ? 0.5 : 0.31, -0.25);
      for (const yaw of [-0.46, -0.22, 0, 0.22, 0.46]) {
        const feather = new THREE.Mesh(
          geoLib.featherPlumeGeo,
          isPhoenix
            ? yaw === 0
              ? accentMat
              : secondaryMat
            : Math.abs(yaw) < 0.1
              ? secondaryMat
              : isParrot
                ? accentMat
                : primaryMat
        );
        const fLen = isPhoenix ? 2.1 - Math.abs(yaw) * 1.1 : 1.15 - Math.abs(yaw) * 0.45;
        feather.scale.set(isPhoenix ? 1.05 : 0.85, 0.85, fLen);
        feather.rotation.x = -0.14;
        feather.rotation.y = yaw;
        tailFan.add(feather);
      }
      bodyGroup.add(tailFan);
      tailGroup = tailFan;
    }

    // Tucked talons for flying birds or long legs for Flamingo
    if (isFlamingo) {
      for (const sx of [-1, 1]) {
        const legPivot = new THREE.Group();
        legPivot.position.set(sx * 0.08, 0.44, -0.04);
        const leg = new THREE.Mesh(geoLib.legGeo, secondaryMat);
        leg.scale.set(0.42, 1.95, 0.42);
        leg.rotation.x = -1.1; // gracefully swept back while soaring!
        legPivot.add(leg);
        bodyGroup.add(legPivot);
        legs.push(legPivot);
      }
    } else if (arch === 'bird') {
      for (const sx of [-1, 1]) {
        const talon = new THREE.Mesh(geoLib.legGeo, accentMat);
        talon.scale.set(0.4, 0.55, 0.4);
        talon.rotation.x = -1.25;
        talon.position.set(sx * 0.07, 0.21, -0.08);
        bodyGroup.add(talon);
      }
    }
  } else if (arch === 'serpent') {
    // Articulated sinuous snake/lizard/salamander body with slithering segments, cobra hood, venom fangs & forked tongue
    const isIguana = spec.id === 'iguana';
    const isSalamander = spec.id === 'lava_salamander';
    const isTrueSnake = !isIguana && !isSalamander;
    const isVenomSnake = spec.id === 'venomous_snake';
    const isCobra = spec.id === 'jungle_cobra' || spec.id === 'night_viper' || isVenomSnake;
    const segCount = isTrueSnake ? 9 : 6;
    for (let s = 0; s < segCount; s += 1) {
      const segPivot = new THREE.Group();
      const zPos = (isTrueSnake ? 0.34 : 0.24) - s * (isTrueSnake ? 0.145 : 0.17);
      segPivot.position.set(0, isTrueSnake ? 0.085 : 0.13, zPos);

      const t = s / Math.max(1, segCount - 1);
      const rScale = isTrueSnake ? 0.96 - t * 0.66 : 1.08 - s * 0.14;
      const segMat = s % 2 === 0 ? primaryMat : secondaryMat;
      const seg = new THREE.Mesh(geoLib.smallSphere, segMat);
      seg.scale.set(rScale * (isTrueSnake ? 0.85 : 1.0), rScale * 0.7, (isTrueSnake ? 1.45 : 1.35) * rScale);
      seg.castShadow = true;
      segPivot.add(seg);

      if (isTrueSnake && s % 2 === 1 && s < segCount - 1) {
        const band = new THREE.Mesh(geoLib.smallSphere, accentMat);
        band.scale.set(rScale * 0.9, rScale * 0.55, rScale * 0.6);
        band.position.y = 0.02;
        segPivot.add(band);
      }

      if ((isIguana || isSalamander) && s < 4) {
        const spine = new THREE.Mesh(geoLib.earCap, isSalamander ? accentMat : secondaryMat);
        spine.scale.set(0.35, 0.55 - s * 0.06, 0.45);
        spine.position.set(0, 0.12, 0);
        segPivot.add(spine);
      }
      bodyGroup.add(segPivot);
      segments.push(segPivot);
    }

    if (isIguana || isSalamander) {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const legPivot = new THREE.Group();
          legPivot.position.set(sx * 0.14, 0.14, sz * 0.14);
          const leg = new THREE.Mesh(geoLib.legGeo, primaryMat);
          leg.rotation.z = sx * 0.85;
          leg.scale.set(0.65, 0.72, 0.65);
          legPivot.add(leg);
          bodyGroup.add(legPivot);
          legs.push(legPivot);
        }
      }
    }

    const headPivot = new THREE.Group();
    headPivot.position.set(0, isTrueSnake ? 0.24 : 0.2, isTrueSnake ? 0.44 : 0.36);
    const head = new THREE.Mesh(geoLib.snoutGeo, primaryMat);
    head.scale.set(1.08, 0.82, 1.22);
    head.castShadow = true;
    headPivot.add(head);
    if (isCobra) {
      const hood = new THREE.Mesh(geoLib.smallSphere, isVenomSnake ? accentMat : secondaryMat);
      hood.scale.set(isVenomSnake ? 1.85 : 1.65, 0.48, 0.98);
      hood.position.set(0, -0.02, -0.08);
      headPivot.add(hood);
    }
    if (isVenomSnake) {
      const fangMat = new THREE.MeshBasicMaterial({ color: 0xbef264 });
      const fangGeo = new THREE.ConeGeometry(0.02, 0.095, 6);
      disposables.push(fangMat, fangGeo);
      for (const sx of [-1, 1]) {
        const fang = new THREE.Mesh(fangGeo, fangMat);
        fang.rotation.x = Math.PI + 0.18;
        fang.position.set(sx * 0.056, -0.045, 0.145);
        headPivot.add(fang);
      }
    }
    if (isTrueSnake) {
      const tongueMat = new THREE.MeshBasicMaterial({ color: isVenomSnake ? 0xa3e635 : 0xff2b4f });
      disposables.push(tongueMat);
      const tongue = new THREE.Group();
      tongue.position.set(0, -0.02, 0.16);
      const tStem = new THREE.Mesh(geoLib.earCap, tongueMat);
      tStem.rotation.x = Math.PI * 0.5;
      tStem.scale.set(0.24, 0.55, 0.24);
      tStem.position.set(0, 0, 0.05);
      const forkL = new THREE.Mesh(geoLib.earCap, tongueMat);
      forkL.rotation.set(Math.PI * 0.5, 0.42, 0);
      forkL.scale.set(0.18, 0.3, 0.18);
      forkL.position.set(-0.022, 0, 0.11);
      const forkR = new THREE.Mesh(geoLib.earCap, tongueMat);
      forkR.rotation.set(Math.PI * 0.5, -0.42, 0);
      forkR.scale.set(0.18, 0.3, 0.18);
      forkR.position.set(0.022, 0, 0.11);
      tongue.add(tStem, forkL, forkR);
      headPivot.add(tongue);
      tongueGroup = tongue;
    }
    for (const sx of [-1, 1]) {
      addLayeredEye(headPivot, sx * 0.08, 0.055, 0.075, 0.92);
    }
    bodyGroup.add(headPivot);
    headGroup = headPivot;
  } else if (arch === 'scorpion') {
    const carapace = new THREE.Mesh(geoLib.torsoGeo, primaryMat);
    carapace.scale.set(0.88, 0.55, 0.82);
    carapace.position.y = 0.18;
    carapace.castShadow = true;
    bodyGroup.add(carapace);

    const tail = new THREE.Group();
    tail.position.set(0, 0.22, -0.22);
    for (let s = 0; s < 3; s += 1) {
      const seg = new THREE.Mesh(geoLib.smallSphere, s % 2 === 0 ? secondaryMat : primaryMat);
      seg.scale.setScalar(0.55 - s * 0.08);
      seg.position.set(0, 0.09 + s * 0.1, -0.06 + s * 0.08);
      tail.add(seg);
    }
    const stinger = new THREE.Mesh(geoLib.beakGeo, accentMat);
    stinger.scale.set(0.75, 0.75, 0.95);
    stinger.position.set(0, 0.34, 0.12);
    tail.add(stinger);
    bodyGroup.add(tail);
    tailGroup = tail;

    for (const sx of [-1, 1]) {
      for (let l = 0; l < 3; l += 1) {
        const legPivot = new THREE.Group();
        legPivot.position.set(sx * 0.18, 0.15, (l - 1) * 0.12);
        const leg = new THREE.Mesh(geoLib.legGeo, primaryMat);
        leg.rotation.z = sx * 0.88;
        leg.scale.set(0.65, 0.78, 0.65);
        legPivot.add(leg);
        bodyGroup.add(legPivot);
        legs.push(legPivot);
      }
      const clawArm = new THREE.Group();
      clawArm.position.set(sx * 0.2, 0.2, 0.22);
      const pincer = new THREE.Mesh(geoLib.snoutGeo, secondaryMat);
      pincer.scale.set(0.95, 0.68, 1.15);
      pincer.position.set(sx * 0.05, 0, 0.14);
      clawArm.add(pincer);
      bodyGroup.add(clawArm);
      if (sx < 0) clawL = clawArm;
      else clawR = clawArm;

      addLayeredEye(bodyGroup, sx * 0.07, 0.24, 0.24, 0.75);
    }
  } else if (arch === 'golem') {
    // Faceted Crystal Guardian with orbiting crystal crown & heavy floating arms
    const torso = new THREE.Mesh(geoLib.crystalShardGeo, primaryMat);
    torso.scale.set(0.95, 0.65, 0.85);
    torso.position.y = 0.22;
    torso.castShadow = true;
    bodyGroup.add(torso);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.96, 0.04);
    const head = new THREE.Mesh(geoLib.sphere, secondaryMat);
    head.scale.set(0.85, 0.95, 0.85);
    headPivot.add(head);
    for (const sx of [-1, 1]) {
      addLayeredEye(headPivot, sx * 0.1, 0.02, 0.2, 1.18);
    }
    bodyGroup.add(headPivot);
    headGroup = headPivot;

    const halo = new THREE.Group();
    halo.position.set(0, 1.32, 0);
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2;
      const shard = new THREE.Mesh(geoLib.crystalShardGeo, i % 2 === 0 ? secondaryMat : accentMat);
      shard.scale.setScalar(0.24);
      shard.position.set(Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34);
      shard.rotation.z = Math.cos(a) * 0.3;
      halo.add(shard);
    }
    bodyGroup.add(halo);
    haloGroup = halo;

    for (const sx of [-1, 1]) {
      const armPivot = new THREE.Group();
      armPivot.position.set(sx * 0.44, 0.76, 0.04);
      const arm = new THREE.Mesh(geoLib.legGeo, secondaryMat);
      arm.scale.set(1.5, 1.5, 1.5);
      armPivot.add(arm);
      bodyGroup.add(armPivot);
      legs.push(armPivot);
    }
  } else {
    // 'quadruped' | 'rabbit' | 'deer' — organic Lathe torso, tapered legs, muzzle/snout, species anatomy
    const isRabbit = spec.id === 'rabbit' || spec.id === 'squirrel';
    const isToad = spec.id === 'spore_toad';
    const isDeer = arch === 'deer';
    const isBoar = spec.id === 'boar';
    const isFox = spec.id === 'fox';
    const isMonkey = spec.id === 'monkey';
    const isOtter = spec.id === 'spirit_otter';
    const isPanther = spec.id === 'black_panther';
    const isWolf = spec.id === 'night_wolf' || spec.id === 'hyena';

    const torso = new THREE.Mesh(geoLib.torsoGeo, primaryMat);
    torso.scale.set(
      isToad ? 1.22 : isBoar ? 1.18 : isDeer || isPanther ? 0.88 : 1.0,
      isToad ? 0.95 : isBoar ? 1.1 : 0.96,
      isToad ? 0.88 : isPanther || isOtter ? 1.18 : 1.02
    );
    torso.position.set(0, isDeer ? 0.56 : isToad ? 0.24 : 0.38, 0);
    torso.castShadow = true;
    bodyGroup.add(torso);

    const belly = new THREE.Mesh(geoLib.smallSphere, secondaryMat);
    belly.scale.set(0.92, 0.58, 1.52);
    belly.position.set(0, isDeer ? 0.48 : isToad ? 0.18 : 0.3, 0);
    bodyGroup.add(belly);

    // Muscular sculpted shoulder & hip haunches for quadruped silhouette depth
    if (!isToad) {
      const haunchY = isDeer ? 0.54 : 0.37;
      for (const sx of [-1, 1]) {
        const shoulder = new THREE.Mesh(geoLib.smallSphere, primaryMat);
        shoulder.scale.set(0.56, 0.74, 0.72);
        shoulder.position.set(sx * 0.125, haunchY, 0.18);
        bodyGroup.add(shoulder);

        const hip = new THREE.Mesh(geoLib.smallSphere, primaryMat);
        hip.scale.set(0.6, 0.76, 0.78);
        hip.position.set(sx * 0.13, haunchY - 0.01, -0.2);
        bodyGroup.add(hip);
      }
    }

    // Dorsal fur ridge / boar bristles / hyena & panther spots
    if (isBoar || isWolf) {
      for (let d = 0; d < 4; d += 1) {
        const ridge = new THREE.Mesh(
          geoLib.smallSphere,
          isBoar ? accentMat : secondaryMat
        );
        ridge.scale.set(0.3, 0.48 - d * 0.05, 0.52);
        ridge.position.set(0, 0.54 - d * 0.015, 0.22 - d * 0.14);
        bodyGroup.add(ridge);
      }
    } else if (isPanther || spec.id === 'hyena') {
      for (const [sx, sy, sz] of [
        [-0.14, 0.44, 0.06],
        [0.14, 0.45, -0.02],
        [-0.12, 0.42, -0.15],
        [0.13, 0.43, 0.13],
      ]) {
        const rosette = new THREE.Mesh(
          geoLib.smallSphere,
          spec.id === 'hyena' ? accentMat : secondaryMat
        );
        rosette.scale.set(0.24, 0.22, 0.28);
        rosette.position.set(sx, sy, sz);
        bodyGroup.add(rosette);
      }
    }

    if (spec.id === 'deer' || spec.id === 'mushroom_stag') {
      // Iconic white spots on deer / glowing spots on mushroom stag
      for (const [sx, sy, sz] of [
        [-0.14, 0.64, 0.05],
        [0.14, 0.65, -0.04],
        [-0.12, 0.62, -0.14],
        [0.12, 0.63, 0.1],
        [0, 0.68, -0.05],
      ]) {
        const spot = new THREE.Mesh(geoLib.smallSphere, secondaryMat);
        spot.scale.setScalar(0.25);
        spot.position.set(sx, sy, sz);
        bodyGroup.add(spot);
      }
    }

    if (isToad) {
      // Glowing spore bulbs on spore_toad back
      for (const [sx, sz] of [
        [-0.12, -0.05],
        [0.13, 0.02],
        [0, -0.14],
      ]) {
        const wart = new THREE.Mesh(geoLib.smallSphere, secondaryMat);
        wart.scale.setScalar(0.32);
        wart.position.set(sx, 0.39, sz);
        bodyGroup.add(wart);
      }
    }

    // Neck + Head Group
    const headPivot = new THREE.Group();
    const headY = isDeer ? 0.8 : isToad ? 0.36 : isPanther || isWolf ? 0.56 : 0.52;
    const headZ = isDeer ? 0.3 : isToad ? 0.22 : 0.31;
    headPivot.position.set(0, headY, headZ);

    if (isDeer) {
      const neck = new THREE.Mesh(geoLib.legGeo, primaryMat);
      neck.scale.set(1.2, 1.0, 1.2);
      neck.rotation.x = 0.28;
      neck.position.set(0, -0.14, -0.06);
      headPivot.add(neck);
    } else if (isFox || isWolf || isPanther) {
      // Fluffy neck fur ruff / mane + cheek tufts
      const ruff = new THREE.Mesh(
        geoLib.smallSphere,
        isFox || isWolf ? secondaryMat : primaryMat
      );
      ruff.scale.set(1.42, 1.18, 1.05);
      ruff.position.set(0, -0.12, -0.06);
      headPivot.add(ruff);
      for (const sx of [-1, 1]) {
        const cheekTuft = new THREE.Mesh(
          geoLib.smallSphere,
          isFox ? secondaryMat : primaryMat
        );
        cheekTuft.scale.set(0.56, 0.44, 0.52);
        cheekTuft.position.set(sx * 0.13, -0.03, 0.01);
        headPivot.add(cheekTuft);
      }
    }

    const headSkull = new THREE.Mesh(
      geoLib.smallSphere,
      isMonkey ? secondaryMat : primaryMat
    );
    headSkull.scale.set(isBoar || isToad ? 1.28 : 1.08, isToad ? 0.85 : 1.02, 1.12);
    headSkull.castShadow = true;
    headPivot.add(headSkull);

    // Tapered Muzzle/Snout + Dark/Pink Nose Tip
    if (!isToad) {
      const muzzle = new THREE.Mesh(
        geoLib.snoutGeo,
        isFox || isMonkey || isOtter ? secondaryMat : primaryMat
      );
      muzzle.scale.set(
        isRabbit ? 0.72 : isBoar ? 0.95 : 0.76,
        isRabbit ? 0.68 : 0.75,
        isWolf || isFox ? 1.08 : 0.85
      );
      muzzle.position.set(0, -0.03, 0.11);
      headPivot.add(muzzle);

      const nose = new THREE.Mesh(geoLib.smallSphere, isRabbit ? secondaryMat : accentMat);
      nose.scale.setScalar(0.24);
      nose.position.set(0, -0.015, isWolf || isFox ? 0.24 : 0.21);
      headPivot.add(nose);

      // Nostrils on snout for close-up detail
      for (const nx of [-0.022, 0.022]) {
        const nostril = new THREE.Mesh(geoLib.smallSphere, accentMat);
        nostril.scale.setScalar(0.08);
        nostril.position.set(nx, -0.01, (isWolf || isFox ? 0.25 : 0.22));
        headPivot.add(nostril);
      }
    }

    // Boar curved tusks
    if (isBoar) {
      for (const sx of [-1, 1]) {
        const tusk = new THREE.Mesh(geoLib.beakGeo, accentMat);
        tusk.rotation.x = -Math.PI * 0.42;
        tusk.rotation.z = -sx * 0.35;
        tusk.scale.set(0.42, 0.42, 0.7);
        tusk.position.set(sx * 0.09, -0.04, 0.17);
        headPivot.add(tusk);
      }
    }

    // Species-specific Ears or Antlers
    for (const sx of [-1, 1]) {
      if (isDeer) {
        const antler = new THREE.Mesh(geoLib.antlerGeo, spec.id === 'mushroom_stag' ? secondaryMat : accentMat);
        antler.scale.set(sx * 1.15, 1.15, 1.15);
        antler.position.set(sx * 0.06, 0.11, -0.02);
        headPivot.add(antler);
        if (spec.id === 'mushroom_stag') {
          const glowTip = new THREE.Mesh(geoLib.smallSphere, accentMat);
          glowTip.scale.setScalar(0.22);
          glowTip.position.set(sx * 0.22, 0.48, 0.0);
          headPivot.add(glowTip);
        }
      } else if (!isToad) {
        const ear = new THREE.Mesh(
          geoLib.earCap,
          isRabbit ? primaryMat : isFox || isWolf ? primaryMat : secondaryMat
        );
        ear.scale.set(
          isMonkey ? 0.85 : 0.68,
          isRabbit ? 1.55 : isMonkey ? 0.6 : 0.82,
          isMonkey ? 0.4 : 0.68
        );
        ear.position.set(
          sx * (isMonkey ? 0.15 : 0.095),
          isRabbit ? 0.16 : isMonkey ? 0.03 : 0.13,
          -0.02
        );
        ear.rotation.z = -sx * (isRabbit ? 0.2 : isMonkey ? 1.25 : 0.32);
        headPivot.add(ear);
      }

      addLayeredEye(
        headPivot,
        sx * (isToad ? 0.1 : 0.088),
        isToad ? 0.06 : 0.038,
        isToad ? 0.11 : 0.125,
        isToad ? 1.1 : 0.92
      );
    }

    bodyGroup.add(headPivot);
    headGroup = headPivot;

    // Tail (with multi-tuft bushy plume for foxes, squirrels, and wolves)
    if (isRabbit) {
      const puffGroup = new THREE.Group();
      puffGroup.position.set(0, 0.42, -0.34);
      const puff = new THREE.Mesh(geoLib.smallSphere, secondaryMat);
      puff.scale.setScalar(spec.id === 'squirrel' ? 1.15 : 0.62);
      puffGroup.add(puff);
      if (spec.id === 'squirrel') {
        const plumeTop = new THREE.Mesh(geoLib.curvedTailGeo, primaryMat);
        plumeTop.scale.set(1.2, 1.35, 1.15);
        plumeTop.position.set(0, 0.04, 0.04);
        puffGroup.add(plumeTop);
      }
      bodyGroup.add(puffGroup);
      tailGroup = puffGroup;
    } else if (!isToad) {
      const tailHolder = new THREE.Group();
      tailHolder.position.set(0, isDeer ? 0.56 : 0.38, -0.3);
      const tail = new THREE.Mesh(
        geoLib.curvedTailGeo,
        isFox ? secondaryMat : primaryMat
      );
      tail.scale.set(
        isFox ? 1.25 : isPanther || isMonkey ? 0.68 : 0.85,
        isFox || isMonkey ? 1.25 : 0.85,
        isPanther || isMonkey || isOtter ? 1.35 : 0.95
      );
      tailHolder.add(tail);
      if (isFox || isWolf) {
        const tailTip = new THREE.Mesh(geoLib.smallSphere, secondaryMat);
        tailTip.scale.set(0.62, 0.62, 0.9);
        tailTip.position.set(0, 0.25, -0.34);
        tailHolder.add(tailTip);
      }
      bodyGroup.add(tailHolder);
      tailGroup = tailHolder;
    }

    // 4 Articulated Tapered Legs with Paws / Hooves
    const legY = isDeer ? 0.36 : isToad ? 0.16 : 0.24;
    const legHeightScale = isDeer ? 1.48 : isToad ? 0.68 : 1.0;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const legPivot = new THREE.Group();
        legPivot.position.set(sx * (isToad ? 0.19 : 0.13), legY, sz * 0.21);
        const leg = new THREE.Mesh(geoLib.legGeo, primaryMat);
        leg.scale.set(isDeer ? 0.82 : 1.0, legHeightScale, isDeer ? 0.82 : 1.0);
        leg.castShadow = true;
        legPivot.add(leg);

        const paw = new THREE.Mesh(
          geoLib.smallSphere,
          isDeer || isBoar || (isFox && sz > 0) ? accentMat : secondaryMat
        );
        paw.scale.set(0.38, 0.24, 0.48);
        paw.position.set(0, -0.22 * legHeightScale, 0.03);
        legPivot.add(paw);

        bodyGroup.add(legPivot);
        legs.push(legPivot);
      }
    }
  }

  // Sleeping moon/bubble tag shown only when daytime animal is curled up at night
  const sleepTag = new THREE.Mesh(geoLib.sleepBubbleGeo, sleepMat);
  sleepTag.position.set(0, 0.82, 0.1);
  sleepTag.visible = false;
  root.add(sleepTag);

  root.scale.setScalar(spec.scale);

  return {
    group: root,
    bodyGroup,
    headGroup,
    legs,
    leftWing,
    rightWing,
    leftWingTip,
    rightWingTip,
    tailGroup,
    clawL,
    clawR,
    haloGroup,
    segments,
    tongueGroup,
    sleepTag,
    shadowMesh: !spec.aquatic ? shadow : undefined,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
