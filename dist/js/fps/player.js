/** First-person movement: pointer-lock mouse look, WASD walking, circle-vs-box collision. */
import * as THREE from '../../vendor/three.module.min.js';

const EYE_HEIGHT = 1.62;
const RADIUS = .3;
const WALK_SPEED = 2.6;
const SPRINT_SPEED = 4.2;
const LOOK_SENSITIVITY = .0022;
const MAX_PITCH = Math.PI / 2 - .05;
const BOB_FREQUENCY = 3.4;
const BOB_HEIGHT = .035;
const BOB_ROLL = .006;
const MOVE_KEYS = {KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right'};

/** Push a point out of every collider and clamp it inside the room. Returns a new {x, z}. */
export function resolveCollisions(pos, colliders, room, radius = RADIUS) {
  let {x, z} = pos;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX)), nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx, dz = z - nz, dist = Math.hypot(dx, dz);
    if (dist >= radius) continue;
    if (dist > 1e-6) {
      x = nx + dx / dist * radius;
      z = nz + dz / dist * radius;
    } else {
      // Centre inside the box: exit through the nearest face.
      const exits = [[c.minX - radius - x, 0], [c.maxX + radius - x, 0], [0, c.minZ - radius - z], [0, c.maxZ + radius - z]];
      const [ex, ez] = exits.reduce((a, b) => Math.hypot(...a) < Math.hypot(...b) ? a : b);
      x += ex;
      z += ez;
    }
  }
  return {
    x: Math.max(room.minX + radius, Math.min(room.maxX - radius, x)),
    z: Math.max(room.minZ + radius, Math.min(room.maxZ - radius, z)),
  };
}

export function createPlayer(camera, {colliders, room, element}) {
  const pressed = {forward: false, back: false, left: false, right: false, sprint: false};
  let yaw = 0, pitch = -.12, position = {x: 0, z: 2.6}, bobPhase = 0, bobAmount = 0;
  camera.rotation.order = 'YXZ';

  const onMouseMove = e => {
    if (document.pointerLockElement !== element) return;
    yaw -= e.movementX * LOOK_SENSITIVITY;
    pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch - e.movementY * LOOK_SENSITIVITY));
  };
  const setKey = (e, down) => {
    if (MOVE_KEYS[e.code]) pressed[MOVE_KEYS[e.code]] = down;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') pressed.sprint = down;
  };
  document.addEventListener('mousemove', onMouseMove);
  window.addEventListener('keydown', e => setKey(e, true));
  window.addEventListener('keyup', e => setKey(e, false));
  window.addEventListener('blur', () => Object.keys(pressed).forEach(k => { pressed[k] = false; }));

  const forward = new THREE.Vector3(), right = new THREE.Vector3();
  return {
    reset() { yaw = 0; pitch = -.12; position = {x: 0, z: 2.6}; },
    /** Teleport and aim. Used by the ?debug test hook. */
    place(next) {
      position = resolveCollisions({x: next.x ?? position.x, z: next.z ?? position.z}, colliders, room);
      yaw = next.yaw ?? yaw;
      pitch = next.pitch ?? pitch;
    },
    pose: () => ({x: position.x, z: position.z, yaw, pitch}),
    /** Moves the camera and returns {speed, step}; step is true on each footfall. */
    update(dt, canMove) {
      const before = position;
      if (canMove) {
        forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        right.set(Math.cos(yaw), 0, -Math.sin(yaw));
        const move = new THREE.Vector3()
          .addScaledVector(forward, Number(pressed.forward) - Number(pressed.back))
          .addScaledVector(right, Number(pressed.right) - Number(pressed.left));
        if (move.lengthSq() > 0) move.normalize().multiplyScalar((pressed.sprint ? SPRINT_SPEED : WALK_SPEED) * dt);
        position = resolveCollisions({x: position.x + move.x, z: position.z + move.z}, colliders, room);
      }
      const speed = dt > 0 ? Math.hypot(position.x - before.x, position.z - before.z) / dt : 0;
      // Head bob: a gentle up-down at walking pace, settling when you stop.
      const prevPhase = bobPhase;
      bobPhase += dt * speed * BOB_FREQUENCY;
      bobAmount += ((speed > .1 ? 1 : 0) - bobAmount) * Math.min(1, dt * 8);
      const bob = Math.sin(bobPhase) * BOB_HEIGHT * bobAmount;
      camera.position.set(position.x, EYE_HEIGHT + bob, position.z);
      camera.rotation.set(pitch, yaw, Math.cos(bobPhase * .5) * BOB_ROLL * bobAmount);
      const step = speed > .1 && Math.floor(prevPhase / Math.PI) !== Math.floor(bobPhase / Math.PI);
      return {speed, step};
    },
  };
}
