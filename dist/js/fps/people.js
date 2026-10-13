/**
 * Low-poly people built from primitives, with a procedural walk cycle.
 * Used for customers on the street and for teammates in the kitchen.
 */
import * as THREE from '../../vendor/three.module.min.js';

const SKIN_TONES = [0xf1c9a5, 0xe0ac85, 0xc68a62, 0x9c6644, 0x6f4a32];
const HAIR = [0x2b1d14, 0x5a3825, 0x9a6b3c, 0xd9b26f, 0x1c1c1c, 0x8c8c8c];
const SHIRTS = [0x3d7fe2, 0xe2733d, 0x6aa84f, 0x9b59b6, 0xd94f6b, 0x2fa3a3, 0xf2be2c, 0x55606b];
const PANTS = [0x2d3a4a, 0x4a3b2d, 0x3b3b3b, 0x5a6b7d];
const mats = new Map();
const mat = color => {
  if (!mats.has(color)) mats.set(color, new THREE.MeshStandardMaterial({color, roughness: .85}));
  return mats.get(color);
};

/** Deterministic pick so a customer looks the same on every screen. */
export const pick = (list, seed) => list[Math.abs(Math.floor(seed)) % list.length];

function limb(radius, length, color) {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), mat(color));
  mesh.position.y = -length / 2 - radius;
  mesh.castShadow = true;
  pivot.add(mesh);
  return pivot;
}

/**
 * Build a person. Options: seed (looks), shirt/skin overrides, chef (hat + apron colour), critic.
 * Returns {group, hands, head, animate(dt, speed), setPose(name)}.
 */
export function buildPerson({seed = 0, shirt, chef = null, critic = false} = {}) {
  const skin = pick(SKIN_TONES, seed * 7 + 3);
  const shirtColor = shirt ?? (critic ? 0x222222 : pick(SHIRTS, seed * 3 + 1));
  const group = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = .9;
  group.add(hips);

  const legL = limb(.075, .62, pick(PANTS, seed + 2)), legR = limb(.075, .62, pick(PANTS, seed + 2));
  legL.position.set(-.1, 0, 0);
  legR.position.set(.1, 0, 0);
  hips.add(legL, legR);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.19, .38, 4, 10), mat(chef ? 0xfbfbf7 : shirtColor));
  torso.position.y = .36;
  torso.scale.z = .75;
  torso.castShadow = true;
  hips.add(torso);
  if (chef) {
    const apron = new THREE.Mesh(new THREE.BoxGeometry(.3, .5, .02), mat(new THREE.Color(chef).getHex()));
    apron.position.set(0, .2, .15);
    hips.add(apron);
  }

  const shoulders = new THREE.Group();
  shoulders.position.y = .62;
  hips.add(shoulders);
  const sleeve = chef ? 0xfbfbf7 : shirtColor;
  const armL = limb(.06, .5, sleeve), armR = limb(.06, .5, sleeve);
  armL.position.set(-.26, 0, 0);
  armR.position.set(.26, 0, 0);
  shoulders.add(armL, armR);
  for (const arm of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.06, 10, 8), mat(skin));
    hand.position.y = -.66;
    arm.add(hand);
  }

  const head = new THREE.Group();
  head.position.y = .9;
  hips.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(.15, 16, 12), mat(skin));
  face.castShadow = true;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.155, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), mat(pick(HAIR, seed * 5)));
  hair.position.y = .02;
  head.add(face, hair);
  for (const x of [-.05, .05]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), mat(0x1b1b1b));
    eye.position.set(x, .02, .135);
    head.add(eye);
  }
  if (chef) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .08, 16), mat(0xffffff));
    band.position.y = .14;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(.17, 16, 10), mat(0xffffff));
    puff.position.y = .26;
    puff.scale.y = .8;
    head.add(band, puff);
  }
  if (critic) {
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(.2, .05, .02), mat(0x111111));
    glasses.position.set(0, .03, .145);
    const beret = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .05, 16), mat(0x7a1f2b));
    beret.position.set(.02, .13, 0);
    beret.rotation.z = .2;
    head.add(glasses, beret);
  }

  // Items carried in both hands sit here, in front of the chest.
  const hands = new THREE.Group();
  hands.position.set(0, .25, .32);
  hips.add(hands);

  let phase = seed, carrying = false, wave = 0;
  return {
    group, hands, head,
    setCarrying(value) { carrying = value; },
    wave() { wave = 1.2; },
    /** speed in m/s drives the walk cycle; 0 idles with a gentle sway. */
    animate(dt, speed) {
      phase += dt * (speed > .05 ? 2.2 + speed * 2.2 : 1.2);
      const stride = Math.min(speed, 2) * .35;
      legL.rotation.x = Math.sin(phase * Math.PI) * stride;
      legR.rotation.x = -Math.sin(phase * Math.PI) * stride;
      hips.position.y = .9 + Math.abs(Math.cos(phase * Math.PI)) * stride * .08;
      const carryAngle = carrying ? -1.1 : 0;
      armL.rotation.x = carrying ? carryAngle : -Math.sin(phase * Math.PI) * stride * .9;
      armR.rotation.x = carrying ? carryAngle : Math.sin(phase * Math.PI) * stride * .9;
      if (wave > 0) {
        wave -= dt;
        armR.rotation.x = -2.6;
        armR.rotation.z = Math.sin(wave * 12) * .4;
      } else {
        armR.rotation.z = 0;
      }
      head.rotation.z = speed > .05 ? 0 : Math.sin(phase * .7) * .04;
    },
  };
}
