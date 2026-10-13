/**
 * Reacts to session effects ("fx") with animation, particles, sound and HUD notices,
 * and animates moving parts: oven door, fridge door, bell and items flying to/from hands.
 */
import * as THREE from '../../vendor/three.module.min.js';
import {heldMeshFor} from './sync.js';
import {disposeGroup} from './food.js';
import {RECIPES} from '../core.js';

const DOORS = {oven: {axis: 'x', open: 1.25}, fridge: {axis: 'y', open: -1.4}};
const DOOR_OPEN_SECONDS = .9;
const FLIGHT_SECONDS = .32;
const ONE = new THREE.Vector3(1, 1, 1);

export function createEffects({world, hands, particles, tweens, sound, customers, avatars, hud}) {
  const doors = {oven: {angle: 0, timer: 0, pivot: world.oven.door}, fridge: {angle: 0, timer: 0, pivot: world.fridge.door}};
  let bellBob = 0;

  function openDoor(name) {
    if (doors[name].timer <= 0) sound.play('door');
    doors[name].timer = DOOR_OPEN_SECONDS;
  }

  /** Animate an item flying between the player's hands and a station. */
  function fly(held, game, target, direction) {
    const point = world.targetPoints[target];
    const mesh = heldMeshFor(held, game);
    if (!point || !mesh) return;
    mesh.scale.setScalar(.7);
    world.scene.add(mesh);
    const handPos = hands.itemWorldPosition();
    const [from, to] = direction === 'out' ? [handPos, point] : [point, handPos];
    if (direction === 'in') hands.item.visible = false;
    tweens.add({
      duration: FLIGHT_SECONDS,
      update: t => {
        mesh.position.lerpVectors(from, to, t);
        mesh.position.y += Math.sin(t * Math.PI) * .18;
        mesh.rotation.y = t * 1.5;
      },
      done: () => {
        world.scene.remove(mesh);
        disposeGroup(mesh);
        hands.item.visible = true;
      },
    });
  }

  function onUsed(effect, selfId, prevHeld, newHeld, game) {
    if (effect.target === 'oven') openDoor('oven');
    if (effect.target === 'fridge') openDoor('fridge');
    if (effect.target.startsWith('crate:')) world.crates[effect.target.slice(6)]?.crate.scale.set(1.08, .9, 1.08);
    if (effect.by !== selfId) { avatars.reach(effect.by); return; }
    hands.reach();
    const sameItem = JSON.stringify(prevHeld) === JSON.stringify(newHeld);
    if (sameItem) return;
    if (prevHeld && !newHeld) fly(prevHeld, game, effect.target, 'out');
    else if (!prevHeld && newHeld) fly(newHeld, game, effect.target, 'in');
    sound.play(newHeld ? 'pickup' : 'ingredient');
  }

  function onEvent(effect) {
    const {event} = effect;
    if (effect.kind === 'event-start') {
      hud.toast(`${event.type === 'fire' ? '🔥' : '⚡'} ${event.title}`, event.type === 'fire' || event.type === 'rush' ? 'bad' : 'info');
      sound.play(event.type === 'fire' ? 'alarm' : 'sting');
    } else if (effect.reason === 'resolved') {
      hud.toast(event.type === 'fire' ? '✓ Fire is out!' : event.type === 'shortage' ? '✓ Restocked!' : '✓ Event cleared', 'good');
    }
  }

  return {
    /** prevHeld/newHeld are this player's hands before and after the batch of effects. */
    handle(fxList, snap, selfId, prevHeld) {
      const newHeld = snap.players.find(p => p.id === selfId)?.held ?? null;
      for (const effect of fxList) {
        switch (effect.kind) {
          case 'used': onUsed(effect, selfId, prevHeld, newHeld, snap.game); break;
          case 'bell':
            bellBob = 1;
            sound.play('bell');
            particles.emit('sparkle', world.targetPoints.bell, 6);
            break;
          case 'served': {
            customers.handleFx(effect);
            const price = RECIPES.find(r => r.id === effect.recipeId)?.price ?? 0;
            hud.toast(`Order up! +¥${price}`, 'good');
            setTimeout(() => sound.play('happy'), 900);
            break;
          }
          case 'missed':
            customers.handleFx(effect);
            hud.toast('A customer gave up and left 💢', 'bad');
            sound.play('sad');
            break;
          case 'extinguish':
            for (let i = 0; i < 4; i++) particles.emit('foam', world.griddle.center, 12, new THREE.Vector3(0, .6, .6));
            sound.play('whoosh');
            break;
          case 'event-start': case 'event-end': onEvent(effect); break;
          case 'bonus': hud.toast(effect.text, 'good'); break;
          case 'joined': if (effect.id !== selfId) hud.toast(`${effect.name} joined the kitchen`, 'info'); break;
          case 'left': hud.toast(`${effect.name} left the kitchen`, 'info'); break;
          case 'reset': customers.handleFx(effect); break;
          default: break;
        }
      }
    },
    update(dt) {
      for (const [name, door] of Object.entries(doors)) {
        door.timer -= dt;
        const goal = door.timer > 0 ? DOORS[name].open : 0;
        door.angle += (goal - door.angle) * (1 - Math.exp(-10 * dt));
        door.pivot.rotation[DOORS[name].axis] = door.angle;
      }
      bellBob = Math.max(0, bellBob - dt * 3);
      world.pass.bell.dome.position.y = .025 - Math.sin(bellBob * Math.PI * 4) * .008 * bellBob;
      world.pass.bell.knob.position.y = .095 - bellBob * .02;
      for (const crate of Object.values(world.crates)) crate.crate.scale.lerp(ONE, 1 - Math.exp(-12 * dt));
    },
  };
}
