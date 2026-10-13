/** Kitchen stations: crates, oven, griddle, boards, fridge, pass with bell, trash, extinguisher, pantry. */
import * as THREE from '../../vendor/three.module.min.js';
import {INGREDIENTS} from '../core.js';
import {buildItem} from './food.js';
import {createTicket} from './labels.js';
import {CRATE_ITEMS, PIZZA_ITEMS} from './interactions.js';
import {COUNTER_TOP, M, box, tag, sign, hinge} from './primitives.js';

export const WINDOW = {minZ: -.2, maxZ: 2.6, minY: 1.0, maxY: 2.4};
export const PASS_TOP = 1.0;

const slotAt = (scene, target, x, y, z) => {
  const slot = new THREE.Group();
  slot.position.set(x, y, z);
  slot.userData.target = target;
  scene.add(slot);
  return slot;
};

export function buildBackCounter(scene) {
  scene.add(box(9.2, COUNTER_TOP - .04, .8, M.counter, 0, (COUNTER_TOP - .04) / 2, -3.6));
  scene.add(box(9.3, .04, .84, M.top, 0, COUNTER_TOP - .02, -3.6));
  const crates = {};
  CRATE_ITEMS.forEach((id, i) => {
    const x = (i < 5 ? -2.9 : -2.4) + i * .6, target = `crate:${id}`;
    const crate = box(.46, .16, .42, M.wood, x, COUNTER_TOP + .08, -3.55, target);
    const item = tag(buildItem(id), target);
    item.position.y = .09;
    crate.add(item);
    scene.add(crate);
    const label = sign(scene, `${INGREDIENTS[id].icon} ${INGREDIENTS[id].name}`, x, COUNTER_TOP + .42, -3.55,
      {width: .55, height: .13, size: 54, bg: PIZZA_ITEMS.includes(id) ? 'rgba(160,62,40,.9)' : 'rgba(33,62,49,.9)'});
    crates[id] = {crate, item, label, name: `${INGREDIENTS[id].icon} ${INGREDIENTS[id].name}`, position: new THREE.Vector3(x, COUNTER_TOP + .2, -3.55)};
  });
  return crates;
}

export function buildOven(scene) {
  const g = new THREE.Group();
  g.position.set(-3.95, COUNTER_TOP, -3.6);
  const parts = [[1.0, .08, .76, 0, .04, 0], [1.0, .08, .76, 0, .66, 0], [1.0, .7, .06, 0, .35, -.35], [.08, .7, .76, -.46, .35, 0], [.08, .7, .76, .46, .35, 0]];
  for (const [w, h, d, x, y, z] of parts) g.add(box(w, h, d, M.steel, x, y, z, 'oven'));
  // The door swings down toward the cook from a hinge along its bottom edge.
  const door = hinge(0, .08, .38);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(.84, .54, .02), new THREE.MeshStandardMaterial({color: 0x2a2018, transparent: true, opacity: .4, emissive: 0x000000}));
  glass.position.y = .27;
  const handle = box(.6, .03, .04, M.steel, 0, .5, .04);
  door.add(tag(glass, 'oven'), tag(handle, 'oven'));
  g.add(door);
  const slot = new THREE.Group();
  slot.position.set(0, .09, 0);
  slot.userData.target = 'oven';
  g.add(slot);
  const light = new THREE.PointLight(0xff8a3c, 0, 1.6);
  light.position.set(0, .4, .1);
  g.add(light);
  scene.add(g);
  const s = sign(scene, '♨ Oven', -3.95, COUNTER_TOP + .95, -3.4, {width: .8, height: .17});
  return {slot, light, door, glass, sign: s, smokePoint: new THREE.Vector3(-3.95, COUNTER_TOP + .75, -3.25)};
}

export function buildGriddle(scene) {
  const plate = box(1.0, .06, .7, M.dark, 3.95, COUNTER_TOP + .03, -3.6, 'griddle');
  scene.add(plate);
  const slot = slotAt(scene, 'griddle', 3.75, COUNTER_TOP + .06, -3.6);
  const rest = slotAt(scene, 'griddle', 4.25, COUNTER_TOP + .06, -3.6);
  const s = sign(scene, '▤ Griddle', 3.95, COUNTER_TOP + .95, -3.4, {width: .8, height: .17});
  return {slot, rest, plate, sign: s, center: new THREE.Vector3(3.85, COUNTER_TOP + .08, -3.6)};
}

export function buildIsland(scene) {
  scene.add(box(4.2, COUNTER_TOP - .04, 1.1, M.counter, 0, (COUNTER_TOP - .04) / 2, -1.0));
  scene.add(box(4.3, .04, 1.16, M.top, 0, COUNTER_TOP - .02, -1.0));
  const boards = {};
  for (const [station, x] of [['pizza', -1.1], ['burger', 1.1]]) {
    const target = `board:${station}`;
    scene.add(box(.72, .03, .6, M.board, x, COUNTER_TOP + .015, -1.0, target));
    const slot = slotAt(scene, target, x, COUNTER_TOP + .03, -1.0);
    const s = sign(scene, station === 'pizza' ? '🍕 Pizza board' : '🍔 Burger board', x, COUNTER_TOP + .62, -1.0, {width: .75, height: .16});
    boards[station] = {slot, sign: s};
  }
  return boards;
}

export function buildFridge(scene) {
  scene.add(box(.8, 2.0, .9, M.fridge, 4.6, 1.0, -1.6, 'fridge'));
  // Door hinged on its back edge, swinging out into the room.
  const door = hinge(4.18, 0, -2.04);
  const panel = box(.05, 1.94, .86, M.fridge, 0, 1.0, .43);
  const handle = box(.04, .5, .04, M.steel, -.05, 1.25, .78);
  door.add(tag(panel, 'fridge'), tag(handle, 'fridge'));
  scene.add(door);
  sign(scene, '❄ Fridge · raw patties', 4.1, 2.2, -1.6, {width: .9, height: .17, size: 50});
  return {door};
}

export function buildPass(scene) {
  const depth = WINDOW.maxZ - WINDOW.minZ, mid = (WINDOW.minZ + WINDOW.maxZ) / 2;
  scene.add(box(.8, PASS_TOP, depth, M.steel, -4.6, PASS_TOP / 2, mid, 'window'));
  sign(scene, '↗ Serve here', -4.3, 1.35, mid - .3, {width: .7, height: .15});
  scene.add(box(.06, .06, depth, M.trim, -4.94, 2.45, mid));
  const tickets = [2.0, 1.2, .4].map((z, i) => {
    const t = createTicket();
    t.mesh.userData.target = `ticket:${i}`;
    t.mesh.position.set(-4.92, 2.68, z);
    t.mesh.rotation.y = Math.PI / 2;
    scene.add(t.mesh);
    return t;
  });
  // Service bell: a brass dome on a dark base. The dome bobs when rung.
  const bell = new THREE.Group();
  bell.position.set(-4.4, PASS_TOP, 2.3);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.075, .085, .025, 24), M.dark);
  base.position.y = .0125;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(.065, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.brass);
  dome.position.y = .025;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.012, 10, 8), M.brass);
  knob.position.y = .095;
  bell.add(base, dome, knob);
  tag(bell, 'bell');
  scene.add(bell);
  sign(scene, '🔔 Bell', -4.4, 1.3, 2.3, {width: .4, height: .11});
  const dishSpot = new THREE.Group();
  dishSpot.position.set(-4.78, PASS_TOP, mid);
  scene.add(dishSpot);
  return {tickets, bell: {group: bell, dome, knob}, dishSpot, windowPoint: new THREE.Vector3(-4.6, PASS_TOP + .1, mid)};
}

export function buildTrash(scene) {
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(.28, .24, .8, 20), M.trim);
  bin.position.set(4.5, .4, 1.6);
  bin.castShadow = true;
  bin.userData.target = 'trash';
  scene.add(bin);
  sign(scene, '🗑 Trash', 4.5, 1.1, 1.6, {width: .5, height: .13});
}

export function buildExtinguisher(scene) {
  const g = new THREE.Group();
  g.position.set(4.86, .75, 2.6);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .45, 18), M.red);
  tank.position.y = .225;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.03, .05, .08, 12), M.dark);
  top.position.y = .49;
  const nozzle = box(.03, .03, .14, M.dark, 0, .5, -.06);
  const bracket = box(.04, .12, .2, M.steel, .08, .2, 0);
  g.add(tank, top, nozzle, bracket);
  tag(g, 'extinguisher');
  scene.add(g);
  sign(scene, '🧯 Extinguisher', 4.7, 1.55, 2.6, {width: .65, height: .13});
  return {group: g, tank};
}

export function buildPantry(scene) {
  const g = new THREE.Group();
  g.position.set(-2.2, 0, 3.72);
  g.add(box(1.6, .04, .5, M.wood, 0, .02, 0), box(.04, 1.8, .5, M.wood, -.78, .9, 0), box(.04, 1.8, .5, M.wood, .78, .9, 0));
  const palette = [0xd9a86c, 0xc8a27a, 0xe0c08f, 0xb98552];
  [.45, 1.0, 1.55].forEach((y, row) => {
    g.add(box(1.56, .03, .48, M.wood, 0, y, 0));
    for (let i = 0; i < 4; i++) g.add(box(.3, .26, .32, new THREE.MeshStandardMaterial({color: palette[(i + row) % 4], roughness: .9}), -.54 + i * .36, y + .145, 0));
  });
  tag(g, 'pantry');
  scene.add(g);
  const label = sign(scene, '📦 Pantry', -2.2, 2.05, 3.6, {width: .6, height: .14});
  return {group: g, label};
}
