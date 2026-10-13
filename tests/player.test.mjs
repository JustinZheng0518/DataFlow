/** Collision resolution keeps the player out of counters and inside the room. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveCollisions} from '../dist/js/fps/player.js';

const room = {minX: -5, maxX: 5, minZ: -4, maxZ: 4};
const box = {minX: -1, maxX: 1, minZ: -1, maxZ: 1};

test('free space is left untouched', () => {
  assert.deepEqual(resolveCollisions({x: 3, z: 3}, [box], room, .3), {x: 3, z: 3});
});

test('walking into a counter edge is pushed back to the radius', () => {
  const p = resolveCollisions({x: 0, z: 1.1}, [box], room, .3);
  assert.equal(p.x, 0);
  assert.ok(Math.abs(p.z - 1.3) < 1e-9);
});

test('a centre inside a box exits through the nearest face', () => {
  const p = resolveCollisions({x: .9, z: 0}, [box], room, .3);
  assert.ok(Math.abs(p.x - 1.3) < 1e-9);
  assert.equal(p.z, 0);
});

test('the player stays inside the room walls', () => {
  assert.deepEqual(resolveCollisions({x: 9, z: -9}, [], room, .3), {x: 4.7, z: -3.7});
});
