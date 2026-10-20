/** Teammates in the kitchen: chef bodies, name tags and held items, smoothed between snapshots. */
import * as THREE from '../../vendor/three.module.min.js';
import {buildPerson} from './people.js';
import {disposeGroup} from './food.js';
import {heldMeshFor} from './sync.js';
import {createSign} from './labels.js';

const SMOOTHING = 12;

export function createAvatars(scene) {
  const avatars = new Map();

  function spawn(p) {
    const person = buildPerson({seed: p.id.charCodeAt(0) + p.id.charCodeAt(1), chef: p.color});
    person.group.position.set(p.x, 0, p.z);
    const tag = createSign({width: .7, height: .16, size: 64, bg: p.color});
    tag.sprite.position.y = 2.25;
    tag.sprite.raycast = () => {};
    tag.update(p.name);
    person.group.add(tag.sprite);
    person.group.traverse(o => { o.raycast = () => {}; });
    scene.add(person.group);
    return {person, heldKey: null, held: null, last: new THREE.Vector3(p.x, 0, p.z)};
  }

  function remove(id) {
    const a = avatars.get(id);
    if (!a) return;
    scene.remove(a.person.group);
    disposeGroup(a.person.group);
    avatars.delete(id);
  }

  /** Teammates reach toward a station when they use it. */
  function reach(id) {
    avatars.get(id)?.person.wave();
  }

  function update(snap, selfId, dt) {
    const present = new Set();
    for (const p of snap.players) {
      if (p.id === selfId) continue;
      present.add(p.id);
      const a = avatars.get(p.id) ?? spawn(p);
      avatars.set(p.id, a);
      const g = a.person.group;
      const k = 1 - Math.exp(-SMOOTHING * dt);
      const before = g.position.clone();
      g.position.x += (p.x - g.position.x) * k;
      g.position.z += (p.z - g.position.z) * k;
      // Player yaw faces -z at 0; people face +z at 0.
      const targetYaw = p.yaw + Math.PI;
      const diff = Math.atan2(Math.sin(targetYaw - g.rotation.y), Math.cos(targetYaw - g.rotation.y));
      g.rotation.y += diff * k;
      const speed = dt > 0 ? before.distanceTo(g.position) / dt : 0;
      a.person.head.rotation.x = -p.pitch * .6;
      const key = p.held ? `${JSON.stringify(p.held)}|${JSON.stringify(snap.game[p.held.kind]?.ingredients ?? '')}` : '';
      if (key !== a.heldKey) {
        a.heldKey = key;
        if (a.held) { a.person.hands.remove(a.held); disposeGroup(a.held); }
        a.held = heldMeshFor(p.held, snap.game);
        if (a.held) a.person.hands.add(a.held);
        a.person.setCarrying(Boolean(a.held));
      }
      a.person.animate(dt, speed);
    }
    for (const id of [...avatars.keys()]) if (!present.has(id)) remove(id);
  }

  return {update, reach, clear: () => [...avatars.keys()].forEach(remove)};
}
