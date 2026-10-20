/**
 * First-person arms attached to the camera. They hold the carried item between them,
 * reach forward when you use something, and sway as you walk.
 */
import * as THREE from '../../vendor/three.module.min.js';

const SKIN = 0xe9b892;
const SLEEVE = 0xfbfbf7;
const REACH_TIME = .28;

function arm(side) {
  const g = new THREE.Group();
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(.055, .065, .32, 12), new THREE.MeshStandardMaterial({color: SLEEVE, roughness: .9}));
  sleeve.rotation.x = Math.PI / 2;
  sleeve.position.z = .1;
  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, .22, 12), new THREE.MeshStandardMaterial({color: SKIN, roughness: .7}));
  forearm.rotation.x = Math.PI / 2;
  forearm.position.z = -.15;
  const hand = new THREE.Mesh(new THREE.SphereGeometry(.055, 12, 10), forearm.material);
  hand.scale.set(1, .7, 1.3);
  hand.position.z = -.28;
  g.add(sleeve, forearm, hand);
  g.position.set(side * .26, -.34, -.32);
  g.traverse(o => { o.raycast = () => {}; });
  return g;
}

export function createHands(camera) {
  const root = new THREE.Group();
  const left = arm(-1), right = arm(1);
  const item = new THREE.Group();
  item.position.set(0, -.33, -.68);
  item.scale.setScalar(.7);
  item.rotation.x = .25;
  root.add(left, right, item);
  camera.add(root);
  let reachT = 1, walkPhase = 0, holding = false;

  return {
    item,
    reach() { reachT = 0; },
    setHolding(value) { holding = value; },
    /** World position of the held item, for fly-in/fly-out animations. */
    itemWorldPosition() { return item.getWorldPosition(new THREE.Vector3()); },
    update(dt, walkSpeed) {
      reachT = Math.min(1, reachT + dt / REACH_TIME);
      const push = Math.sin(reachT * Math.PI) * .18;
      walkPhase += dt * walkSpeed * 3.2;
      const swayX = Math.sin(walkPhase) * .012 * Math.min(walkSpeed, 1.5);
      const swayY = Math.abs(Math.cos(walkPhase)) * .012 * Math.min(walkSpeed, 1.5);
      // Holding: hands come together under the item. Empty: relaxed at the sides, a little lower.
      const spread = holding ? .17 : .26;
      const drop = holding ? 0 : -.06;
      left.position.set(-spread + swayX, -.34 + drop + swayY, -.32 - push);
      right.position.set(spread + swayX, -.34 + drop - swayY * .5, -.32 - push * 1.2);
      left.rotation.y = holding ? -.35 : -.08;
      right.rotation.y = holding ? .35 : .08;
      item.position.set(swayX, -.33 + swayY, -.68 - push * .6);
    },
  };
}
