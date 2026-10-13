/**
 * The walkable kitchen and the street outside the serving window.
 * Units are meters. +x is east, -z is the back wall, y is up. The window is in the west wall.
 */
import * as THREE from '../../vendor/three.module.min.js';
import {COUNTER_TOP, M, material, box, plaque} from './primitives.js';
import {WINDOW, buildBackCounter, buildOven, buildGriddle, buildIsland, buildFridge, buildPass, buildTrash, buildExtinguisher, buildPantry} from './stations.js';

export {COUNTER_TOP};
export const ROOM = {minX: -5, maxX: 5, minZ: -4, maxZ: 4, height: 3};
const SKY = 0xbfe0f0;

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    ctx.fillStyle = (i + j) % 2 ? '#e7c9a4' : '#f4e3c8';
    ctx.fillRect(i * 64, j * 64, 64, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 4);
  return t;
}

function buildRoom(scene) {
  const {minX, maxX, minZ, maxZ, height} = ROOM, w = maxX - minX, d = maxZ - minZ;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material(0xffffff, {map: floorTexture()}));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material(0xfaf6ea));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  scene.add(ceiling);
  scene.add(box(w, height, .1, M.wall, 0, height / 2, minZ - .05));
  scene.add(box(w, height, .1, M.wall, 0, height / 2, maxZ + .05));
  scene.add(box(.1, height, d, M.wall, maxX + .05, height / 2, 0));
  // West wall with the serving window cut out.
  const westX = minX - .05, wz = WINDOW.maxZ - WINDOW.minZ, mid = (WINDOW.minZ + WINDOW.maxZ) / 2;
  scene.add(box(.1, height, WINDOW.minZ - minZ, M.wall, westX, height / 2, (minZ + WINDOW.minZ) / 2));
  scene.add(box(.1, height, maxZ - WINDOW.maxZ, M.wall, westX, height / 2, (WINDOW.maxZ + maxZ) / 2));
  scene.add(box(.1, WINDOW.minY, wz, M.wall, westX, WINDOW.minY / 2, mid));
  scene.add(box(.1, height - WINDOW.maxY, wz, M.wall, westX, (height + WINDOW.maxY) / 2, mid));
  scene.add(box(w, .12, .02, M.trim, 0, 1.0, minZ + .01));
  const sign = plaque('SIZZLE KITCHEN ✳', 2.4, .4);
  sign.position.set(0, 2.55, minZ + .02);
  scene.add(sign);
}

/** Sidewalk, road and simple buildings seen through the window, where customers walk. */
function buildStreet(scene) {
  const ground = (w, d, mat, x, z, y = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
  };
  ground(4, 30, M.pavement, -7.1, 1, .005);
  ground(6, 30, M.road, -12, 1, .002);
  ground(30, 40, M.grass, -20.1, 1, 0);
  for (let z = -12; z <= 14; z += 3) ground(.15, 1.4, material(0xf2efe6), -12, z, .006);
  for (const [z, w, h] of [[-9, 5, 6], [-2.5, 6, 4.5], [4, 5, 7], [10, 6, 5]]) {
    const building = box(2.5, h, w, M.brick, -17, h / 2, z);
    scene.add(building);
    for (let fy = 1.2; fy < h - .5; fy += 1.4) for (let fz = -w / 2 + .8; fz < w / 2 - .4; fz += 1.2) {
      scene.add(box(.05, .7, .6, M.glass, -15.73, fy, z + fz));
    }
  }
  for (const z of [-5, 7]) {
    const trunk = box(.18, 1.6, .18, M.wood, -8.6, .8, z);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(.9, 12, 10), material(0x6f9e57));
    crown.position.set(-8.6, 2.1, z);
    crown.castShadow = true;
    scene.add(trunk, crown);
  }
}

function buildLights(scene) {
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0xd8c7a8, 1.5));
  scene.add(new THREE.AmbientLight(0xfff4e0, .35));
  const lamps = [-2.5, 2.5].map(x => {
    const lamp = new THREE.PointLight(0xffe2b8, 2.5, 8, 1.6);
    lamp.position.set(x, 2.7, -.5);
    scene.add(lamp);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(.12, .3, .2, 20), M.trim);
    shade.position.set(x, 2.85, -.5);
    scene.add(shade);
    return lamp;
  });
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.4);
  sun.position.set(-3, 6, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {left: -9, right: 6, top: 7, bottom: -7});
  scene.add(sun);
  return {lamps};
}

/** Axis-aligned footprints the player cannot walk through. */
export const COLLIDERS = [
  {minX: -4.6, maxX: 4.6, minZ: -4, maxZ: -3.2},
  {minX: -2.15, maxX: 2.15, minZ: -1.58, maxZ: -.42},
  {minX: 4.2, maxX: 5, minZ: -2.05, maxZ: -1.15},
  {minX: -5, maxX: -4.2, minZ: WINDOW.minZ, maxZ: WINDOW.maxZ},
  {minX: 4.2, maxX: 4.8, minZ: 1.3, maxZ: 1.9},
  {minX: -3.0, maxX: -1.4, minZ: 3.45, maxZ: 4},
];

export function buildWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  buildRoom(scene);
  buildStreet(scene);
  const lights = buildLights(scene);
  const crates = buildBackCounter(scene);
  buildTrash(scene);
  const world = {
    scene, lights, crates,
    oven: buildOven(scene), griddle: buildGriddle(scene), boards: buildIsland(scene), fridge: buildFridge(scene),
    pass: buildPass(scene), extinguisher: buildExtinguisher(scene), pantry: buildPantry(scene),
  };
  world.tickets = world.pass.tickets;
  world.targetPoints = targetPoints(world);
  return world;
}

/** Where each target "is", for item fly-in animations and teammates' reach. */
function targetPoints(world) {
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const points = {
    'board:pizza': v(-1.1, COUNTER_TOP + .05, -1.0), 'board:burger': v(1.1, COUNTER_TOP + .05, -1.0),
    oven: v(-3.95, COUNTER_TOP + .15, -3.5), griddle: world.griddle.center.clone(), fridge: v(4.2, 1.1, -1.6),
    window: world.pass.windowPoint.clone(), bell: v(-4.4, 1.05, 2.3), trash: v(4.5, .85, 1.6),
    pantry: v(-2.2, 1.1, 3.5), extinguisher: v(4.85, 1.0, 2.6),
  };
  for (const [id, crate] of Object.entries(world.crates)) points[`crate:${id}`] = crate.position.clone();
  return points;
}
