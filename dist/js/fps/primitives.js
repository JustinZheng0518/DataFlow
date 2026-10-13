/** Shared low-poly building blocks for the kitchen scene. */
import * as THREE from '../../vendor/three.module.min.js';
import {createSign} from './labels.js';

export const COUNTER_TOP = .9;

export const material = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: .8, ...extra});

export const M = {
  wall: material(0xf3ecd9), trim: material(0x2f5443), counter: material(0x8fae8a), top: material(0xefe6cf, {roughness: .5}),
  wood: material(0xb98552), steel: material(0xb9c0bd, {metalness: .6, roughness: .35}), dark: material(0x2b2f2d, {roughness: .4}),
  board: material(0xd9a86c), fridge: material(0xe8ecea, {metalness: .2, roughness: .4}), red: material(0xc8322b, {roughness: .45}),
  brass: material(0xd4a63a, {metalness: .8, roughness: .25}), grass: material(0x93b86f), pavement: material(0xcfc8bb), road: material(0x5c5f63),
  brick: material(0xb7684a), glass: material(0x9fc6d8, {metalness: .3, roughness: .1}),
};

/** A box mesh with shadows. `target` makes it interactive. */
export function box(w, h, d, mat, x, y, z, target) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (target) mesh.userData.target = target;
  return mesh;
}

/** Tag every mesh under an object as part of one interactive target. */
export function tag(object, target) {
  object.traverse(o => { o.userData.target = target; });
  return object;
}

/** A camera-facing label that never blocks the interaction ray. */
export function sign(parent, text, x, y, z, opts) {
  const s = createSign(opts);
  s.sprite.position.set(x, y, z);
  s.sprite.raycast = () => {};
  s.update(text);
  parent.add(s.sprite);
  return s;
}

/** Flat sign on a wall; a sprite would turn toward the camera and clip into the wall. */
export function plaque(text, width, height, size = 96) {
  const s = createSign({width, height, size});
  s.update(text);
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({map: s.sprite.material.map, transparent: true}));
}

/** A group positioned at a hinge so children can swing open. */
export function hinge(x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  return pivot;
}
