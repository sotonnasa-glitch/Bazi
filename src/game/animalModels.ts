import * as THREE from 'three';
import { buildCurvedGullWingGeometry, buildFishGeometry, buildSeashellGeometry } from './sculptGeometry';
import type { AnimalSpeciesSpec } from './wildlife';

export interface AnimalVisualRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  leftWing?: THREE.Object3D;
  rightWing?: THREE.Object3D;
  tailGroup?: THREE.Object3D;
  clawL?: THREE.Object3D;
  clawR?: THREE.Object3D;
  sleepTag?: THREE.Mesh;
  dispose: () => void;
}

export function createAnimalGeometryLibrary() {
  const sphere = new THREE.SphereGeometry(0.28, 12, 9);
  const smallSphere = new THREE.SphereGeometry(0.14, 9, 7);
  const capsule = new THREE.CapsuleGeometry(0.11, 0.28, 4, 8);
  const legCap = new THREE.CapsuleGeometry(0.052, 0.16, 4, 6);
  const earCap = new THREE.CapsuleGeometry(0.042, 0.18, 4, 6);
  const wingGeo = buildCurvedGullWingGeometry();
  const fishGeo = buildFishGeometry();
  const shellGeo = buildSeashellGeometry();
  const eyeGeo = new THREE.SphereGeometry(0.036, 7, 6);
  const sleepBubbleGeo = new THREE.SphereGeometry(0.11, 8, 6);

  return {
    sphere,
    smallSphere,
    capsule,
    legCap,
    earCap,
    wingGeo,
    fishGeo,
    shellGeo,
    eyeGeo,
    sleepBubbleGeo,
    dispose: () => {
      sphere.dispose();
      smallSphere.dispose();
      capsule.dispose();
      legCap.dispose();
      earCap.dispose();
      wingGeo.dispose();
      fishGeo.dispose();
      shellGeo.dispose();
      eyeGeo.dispose();
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

  const shadowGeo = new THREE.CircleGeometry(0.38 * spec.scale, 12);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(shadowGeo, shadowDiscMat);
  shadow.position.y = 0.03;
  if (!spec.aquatic) root.add(shadow);
  disposables.push(shadowGeo);

  const primaryMat = new THREE.MeshStandardMaterial({
    color: spec.primaryColor,
    roughness: 0.72,
    metalness: 0.04,
    emissive: spec.category === 'strange' ? spec.secondaryColor : 0x000000,
    emissiveIntensity: spec.category === 'strange' ? 0.28 : 0,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: spec.secondaryColor,
    roughness: 0.65,
    metalness: 0.04,
    emissive: spec.category === 'strange' ? spec.secondaryColor : 0x000000,
    emissiveIntensity: spec.category === 'strange' ? 0.35 : 0,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: spec.accentColor,
    roughness: 0.25,
    emissive: spec.category === 'night_predator' ? spec.accentColor : 0x000000,
    emissiveIntensity: spec.category === 'night_predator' ? 1.15 : 0,
  });
  const sleepMat = new THREE.MeshBasicMaterial({
    color: 0xd9ecff,
    transparent: true,
    opacity: 0.85,
  });
  disposables.push(primaryMat, secondaryMat, eyeMat, sleepMat);

  let leftWing: THREE.Object3D | undefined;
  let rightWing: THREE.Object3D | undefined;
  let tailGroup: THREE.Object3D | undefined;
  let clawL: THREE.Object3D | undefined;
  let clawR: THREE.Object3D | undefined;

  const arch = spec.archetype;

  if (arch === 'crab') {
    // Wide oval shell + 6 scuttling legs + 2 pincer claws + stalked eyes (+ hermit spiral shell if hermit)
    const body = new THREE.Mesh(geoLib.sphere, primaryMat);
    body.scale.set(1.25, 0.56, 0.96);
    body.position.y = 0.24;
    body.castShadow = true;
    bodyGroup.add(body);

    if (spec.id === 'hermit_crab') {
      const shell = new THREE.Mesh(geoLib.shellGeo, secondaryMat);
      shell.scale.setScalar(1.35);
      shell.position.set(0, 0.38, -0.05);
      shell.rotation.x = -0.35;
      bodyGroup.add(shell);
    }

    for (const side of [-1, 1]) {
      for (let l = 0; l < 3; l += 1) {
        const leg = new THREE.Mesh(geoLib.legCap, secondaryMat);
        leg.position.set(side * 0.34, 0.14, (l - 1) * 0.16);
        leg.rotation.z = side * 0.95;
        bodyGroup.add(leg);
      }
      const clawArm = new THREE.Group();
      clawArm.position.set(side * 0.34, 0.25, 0.26);
      const pincer = new THREE.Mesh(geoLib.smallSphere, secondaryMat);
      pincer.scale.set(1.25, 0.85, 1.35);
      pincer.position.set(side * 0.08, 0.04, 0.12);
      clawArm.add(pincer);
      bodyGroup.add(clawArm);
      if (side < 0) clawL = clawArm;
      else clawR = clawArm;

      const eye = new THREE.Mesh(geoLib.eyeGeo, eyeMat);
      eye.position.set(side * 0.12, 0.38, 0.22);
      bodyGroup.add(eye);
    }
  } else if (arch === 'starfish') {
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      const arm = new THREE.Mesh(geoLib.capsule, i % 2 === 0 ? primaryMat : secondaryMat);
      arm.rotation.x = Math.PI / 2;
      arm.rotation.z = a;
      arm.scale.set(0.75, 0.95, 0.45);
      arm.position.set(Math.sin(a) * 0.15, 0.08, Math.cos(a) * 0.15);
      bodyGroup.add(arm);
    }
    const hub = new THREE.Mesh(geoLib.smallSphere, primaryMat);
    hub.scale.set(1.3, 0.65, 1.3);
    hub.position.y = 0.1;
    bodyGroup.add(hub);
  } else if (arch === 'fish') {
    const fishMesh = new THREE.Mesh(geoLib.fishGeo, primaryMat);
    fishMesh.scale.setScalar(1.35);
    fishMesh.castShadow = true;
    bodyGroup.add(fishMesh);
    const fin = new THREE.Mesh(geoLib.smallSphere, secondaryMat);
    fin.scale.set(0.3, 0.6, 0.9);
    fin.position.set(0, 0.12, -0.05);
    bodyGroup.add(fin);
    tailGroup = fin;
  } else if (arch === 'turtle') {
    const shell = new THREE.Mesh(geoLib.sphere, secondaryMat);
    shell.scale.set(1.15, 0.68, 1.32);
    shell.position.y = 0.24;
    shell.castShadow = true;
    bodyGroup.add(shell);

    const head = new THREE.Mesh(geoLib.smallSphere, primaryMat);
    head.scale.set(0.95, 0.85, 1.15);
    head.position.set(0, 0.24, 0.42);
    bodyGroup.add(head);

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const flipper = new THREE.Mesh(geoLib.legCap, primaryMat);
        flipper.position.set(sx * 0.34, 0.12, sz * 0.24);
        flipper.rotation.z = sx * (spec.aquatic ? 1.2 : 0.45);
        bodyGroup.add(flipper);
      }
      const eye = new THREE.Mesh(geoLib.eyeGeo, eyeMat);
      eye.position.set(sx * 0.08, 0.28, 0.52);
      bodyGroup.add(eye);
    }
  } else if (arch === 'bird' || arch === 'butterfly') {
    const torso = new THREE.Mesh(geoLib.capsule, primaryMat);
    torso.rotation.x = Math.PI * 0.35;
    torso.scale.set(arch === 'butterfly' ? 0.5 : 0.95, 0.95, arch === 'butterfly' ? 0.5 : 0.95);
    torso.position.y = 0.3;
    torso.castShadow = true;
    bodyGroup.add(torso);

    const head = new THREE.Mesh(geoLib.smallSphere, secondaryMat);
    head.position.set(0, 0.44, 0.22);
    bodyGroup.add(head);

    if (arch === 'bird') {
      const beak = new THREE.Mesh(geoLib.earCap, secondaryMat);
      beak.rotation.x = Math.PI * 0.52;
      beak.scale.set(0.75, spec.id === 'toucan' ? 1.4 : 0.8, 0.75);
      beak.position.set(0, 0.43, 0.36);
      bodyGroup.add(beak);
    }

    const wl = new THREE.Mesh(geoLib.wingGeo, arch === 'butterfly' ? primaryMat : secondaryMat);
    wl.scale.set(-1.1, 1.1, 1.1);
    wl.position.set(-0.08, 0.34, 0.02);
    const wr = new THREE.Mesh(geoLib.wingGeo, arch === 'butterfly' ? primaryMat : secondaryMat);
    wr.scale.set(1.1, 1.1, 1.1);
    wr.position.set(0.08, 0.34, 0.02);
    bodyGroup.add(wl, wr);
    leftWing = wl;
    rightWing = wr;

    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(geoLib.eyeGeo, eyeMat);
      eye.position.set(sx * 0.08, 0.48, 0.29);
      bodyGroup.add(eye);
    }
  } else if (arch === 'serpent') {
    for (let s = 0; s < 4; s += 1) {
      const seg = new THREE.Mesh(geoLib.smallSphere, s % 2 === 0 ? primaryMat : secondaryMat);
      const rScale = 1.05 - s * 0.16;
      seg.scale.set(rScale, rScale * 0.78, 1.35 * rScale);
      seg.position.set(Math.sin(s * 1.1) * 0.1, 0.14, 0.24 - s * 0.22);
      seg.castShadow = true;
      bodyGroup.add(seg);
    }
    const head = new THREE.Mesh(geoLib.smallSphere, primaryMat);
    head.scale.set(1.15, 0.85, 1.3);
    head.position.set(0, 0.22, 0.38);
    bodyGroup.add(head);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(geoLib.eyeGeo, eyeMat);
      eye.position.set(sx * 0.09, 0.26, 0.48);
      bodyGroup.add(eye);
    }
  } else if (arch === 'scorpion') {
    const body = new THREE.Mesh(geoLib.capsule, primaryMat);
    body.rotation.x = Math.PI / 2;
    body.position.y = 0.18;
    bodyGroup.add(body);

    const tail = new THREE.Group();
    tail.position.set(0, 0.22, -0.2);
    const st1 = new THREE.Mesh(geoLib.earCap, secondaryMat);
    st1.position.set(0, 0.14, -0.05);
    st1.rotation.x = -0.5;
    const stinger = new THREE.Mesh(geoLib.smallSphere, eyeMat);
    stinger.scale.setScalar(0.55);
    stinger.position.set(0, 0.28, 0.05);
    tail.add(st1, stinger);
    bodyGroup.add(tail);
    tailGroup = tail;

    for (const sx of [-1, 1]) {
      for (let l = 0; l < 3; l += 1) {
        const leg = new THREE.Mesh(geoLib.legCap, primaryMat);
        leg.position.set(sx * 0.22, 0.1, (l - 1) * 0.12);
        leg.rotation.z = sx * 0.85;
        bodyGroup.add(leg);
      }
      const pincer = new THREE.Mesh(geoLib.smallSphere, secondaryMat);
      pincer.scale.set(0.9, 0.65, 1.25);
      pincer.position.set(sx * 0.22, 0.2, 0.3);
      bodyGroup.add(pincer);
    }
  } else if (arch === 'golem') {
    const torso = new THREE.Mesh(geoLib.sphere, primaryMat);
    torso.scale.set(1.05, 1.25, 0.95);
    torso.position.y = 0.62;
    torso.castShadow = true;
    bodyGroup.add(torso);

    const halo = new THREE.Mesh(geoLib.smallSphere, secondaryMat);
    halo.scale.set(0.75, 0.75, 0.75);
    halo.position.set(0, 1.15, 0);
    bodyGroup.add(halo);

    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(geoLib.capsule, secondaryMat);
      arm.position.set(sx * 0.42, 0.62, 0.05);
      arm.rotation.z = sx * 0.22;
      bodyGroup.add(arm);
      const eye = new THREE.Mesh(geoLib.eyeGeo, eyeMat);
      eye.scale.setScalar(1.3);
      eye.position.set(sx * 0.12, 0.76, 0.28);
      bodyGroup.add(eye);
    }
  } else {
    // 'quadruped' | 'rabbit' | 'deer'
    const torso = new THREE.Mesh(geoLib.capsule, primaryMat);
    torso.rotation.x = Math.PI / 2;
    torso.scale.set(1.05, 1.0, 1.05);
    torso.position.set(0, 0.38, 0);
    torso.castShadow = true;
    bodyGroup.add(torso);

    const belly = new THREE.Mesh(geoLib.smallSphere, secondaryMat);
    belly.scale.set(1.0, 0.75, 1.4);
    belly.position.set(0, 0.31, 0);
    bodyGroup.add(belly);

    const head = new THREE.Mesh(geoLib.smallSphere, primaryMat);
    head.scale.set(1.15, 1.05, 1.2);
    head.position.set(0, arch === 'deer' ? 0.68 : 0.54, 0.3);
    head.castShadow = true;
    bodyGroup.add(head);

    const tail = new THREE.Mesh(geoLib.smallSphere, secondaryMat);
    tail.scale.setScalar(arch === 'rabbit' ? 0.65 : 0.85);
    tail.position.set(0, 0.42, -0.32);
    bodyGroup.add(tail);
    tailGroup = tail;

    for (const sx of [-1, 1]) {
      // Ears / antlers
      const ear = new THREE.Mesh(geoLib.earCap, arch === 'deer' ? secondaryMat : primaryMat);
      ear.scale.set(0.75, arch === 'rabbit' ? 1.55 : arch === 'deer' ? 1.35 : 0.75, 0.75);
      ear.position.set(sx * 0.1, (arch === 'deer' ? 0.85 : 0.68), 0.26);
      ear.rotation.z = -sx * 0.28;
      bodyGroup.add(ear);

      // Eyes
      const eye = new THREE.Mesh(geoLib.eyeGeo, eyeMat);
      eye.position.set(sx * 0.1, (arch === 'deer' ? 0.72 : 0.58), 0.42);
      bodyGroup.add(eye);

      // 4 legs
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(geoLib.legCap, primaryMat);
        leg.position.set(sx * 0.14, 0.16, sz * 0.2);
        leg.castShadow = true;
        bodyGroup.add(leg);
      }
    }
  }

  // Sleeping moon/bubble tag shown only when daytime animal is curled up at night
  const sleepTag = new THREE.Mesh(geoLib.sleepBubbleGeo, sleepMat);
  sleepTag.position.set(0, 0.78, 0.1);
  sleepTag.visible = false;
  root.add(sleepTag);

  root.scale.setScalar(spec.scale);

  return {
    group: root,
    bodyGroup,
    leftWing,
    rightWing,
    tailGroup,
    clawL,
    clawR,
    sleepTag,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
