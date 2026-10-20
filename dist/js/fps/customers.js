/**
 * Customers outside the serving window, one per open ticket. View-only: driven by the
 * order list in each snapshot plus "served" / "missed" / "reset" effects.
 * Lifecycle: arriving → waiting → (bell) collecting → leaving, or waiting → leaving angry.
 */
import * as THREE from '../../vendor/three.module.min.js';
import {buildPerson} from './people.js';
import {buildPlated, disposeGroup} from './food.js';
import {createSign} from './labels.js';

const QUEUE_X = -6.7;
const QUEUE_Z = [2.0, 1.2, .4];
const WINDOW_SPOT = new THREE.Vector3(-5.5, 0, 1.2);
const WALK_SPEED = 1.3;
const HURRY_SPEED = 2.0;
const URGENT_SECONDS = 25;
const CUSTOMER_SCALE = .92;

const spawnPoint = seed => new THREE.Vector3(-7.4, 0, seed % 2 ? 15 : -13);
const faceToward = (group, dx, dz) => { group.rotation.y = Math.atan2(dx, dz); };

export function createCustomers(scene, pass) {
  const customers = new Map();
  const dishes = new Map();

  function emote(c, text, seconds = 2.5) {
    c.emote.update(text, {bg: 'rgba(255,255,255,.92)', fg: '#213e31'});
    c.emoteTimer = seconds;
  }

  function spawn(order) {
    const person = buildPerson({seed: order.id * 13 + order.recipeId.length});
    person.group.scale.setScalar(CUSTOMER_SCALE);
    const start = spawnPoint(order.id);
    person.group.position.copy(start);
    person.group.traverse(o => { o.raycast = () => {}; });
    scene.add(person.group);
    const emoteSign = createSign({width: .5, height: .3, size: 150});
    emoteSign.sprite.position.y = 2.15;
    emoteSign.sprite.raycast = () => {};
    emoteSign.update('');
    person.group.add(emoteSign.sprite);
    const c = {orderId: order.id, person, state: 'arriving', target: start.clone(), emote: emoteSign, emoteTimer: 0, pause: 0, critic: false};
    customers.set(order.id, c);
    return c;
  }

  function remove(c) {
    scene.remove(c.person.group);
    disposeGroup(c.person.group);
    customers.delete(c.orderId);
  }

  function leave(c, hurry) {
    c.state = 'leaving';
    c.hurry = hurry;
    c.target = new THREE.Vector3(-7.6, 0, c.orderId % 2 ? -14 : 16);
  }

  function placeDish(orderId, dish) {
    const plated = buildPlated(dish);
    plated.position.z = (dishes.size % 3 - 1) * .3;
    pass.dishSpot.add(plated);
    dishes.set(orderId, plated);
  }

  function handleFx(effect) {
    if (effect.kind === 'served') {
      placeDish(effect.orderId, effect.dish);
      const c = customers.get(effect.orderId);
      if (c) {
        c.state = 'collecting';
        c.target = WINDOW_SPOT.clone();
        emote(c, '🙂', 1.5);
      } else {
        setTimeout(() => takeDish(effect.orderId, null), 1500);
      }
    }
    if (effect.kind === 'missed') {
      const c = customers.get(effect.orderId);
      if (c) { emote(c, '💢', 3); leave(c, true); }
    }
    if (effect.kind === 'reset') reset();
  }

  function takeDish(orderId, c) {
    const plated = dishes.get(orderId);
    dishes.delete(orderId);
    if (!plated) return;
    pass.dishSpot.remove(plated);
    if (!c) { disposeGroup(plated); return; }
    plated.position.set(0, 0, 0);
    plated.scale.setScalar(.8);
    c.person.hands.add(plated);
    c.person.setCarrying(true);
  }

  function reset() {
    for (const c of [...customers.values()]) remove(c);
    for (const plated of dishes.values()) { pass.dishSpot.remove(plated); disposeGroup(plated); }
    dishes.clear();
  }

  function step(c, dt) {
    const pos = c.person.group.position;
    const to = c.target.clone().sub(pos);
    to.y = 0;
    const dist = to.length();
    const speed = c.state === 'leaving' && c.hurry ? HURRY_SPEED : WALK_SPEED;
    if (dist > .05) {
      const move = Math.min(dist, speed * dt);
      pos.addScaledVector(to.normalize(), move);
      faceToward(c.person.group, to.x, to.z);
      c.person.animate(dt, speed);
      return false;
    }
    c.person.animate(dt, 0);
    return true;
  }

  function update(snap, dt) {
    const {orders, mode} = snap.game;
    const criticId = snap.ctx?.criticOrderId;
    const open = new Set(orders.map(o => o.id));
    orders.forEach((order, i) => {
      const c = customers.get(order.id) ?? spawn(order);
      if (c.state === 'arriving' || c.state === 'waiting') c.target = new THREE.Vector3(QUEUE_X, 0, QUEUE_Z[i] ?? 0);
      const urgent = mode === 'shift' && order.remaining < URGENT_SECONDS;
      if (c.state === 'waiting' && c.emoteTimer <= 0) c.emote.update(order.id === criticId ? '★' : urgent ? '⏰' : '', {bg: 'rgba(255,255,255,.92)', fg: '#b4532a'});
    });
    for (const c of [...customers.values()]) {
      if (!open.has(c.orderId) && (c.state === 'arriving' || c.state === 'waiting')) leave(c, false);
      if (c.emoteTimer > 0 && (c.emoteTimer -= dt) <= 0) c.emote.update('');
      const arrived = step(c, dt);
      if (!arrived) continue;
      if (c.state === 'arriving') c.state = 'waiting';
      if (c.state === 'waiting') faceToward(c.person.group, 1, 0);
      if (c.state === 'collecting') {
        faceToward(c.person.group, 1, 0);
        if ((c.pause += dt) > .5) {
          takeDish(c.orderId, c);
          emote(c, '😋', 2.5);
          c.person.wave();
          leave(c, false);
        }
      }
      if (c.state === 'leaving') remove(c);
    }
  }

  return {update, handleFx, reset};
}
