/**
 * Mirrors a snapshot into the 3D world every frame: food on boards, oven, griddle,
 * the local player's hands, sold-out crates, the extinguisher, fire, steam and tickets.
 */
import * as THREE from '../../vendor/three.module.min.js';
import {buildPizza, buildBurger, buildItem, buildPlated, pattyColor, disposeGroup} from './food.js';
import {ticketView} from './hud.js';

const STEAM_RATE = 6, SMOKE_RATE = 8, FIRE_RATE = 40;

/** Replace a slot's contents only when its signature changes. */
function slotUpdater(slot) {
  let key = null;
  return (nextKey, build) => {
    if (nextKey === key) return;
    key = nextKey;
    for (const child of [...slot.children]) {
      slot.remove(child);
      disposeGroup(child);
    }
    const content = build();
    if (content) slot.add(content);
  };
}

/** Emit particles at a steady rate regardless of frame rate. */
function emitter(particles) {
  const acc = {};
  return (name, kind, rate, position, dt) => {
    acc[name] = (acc[name] ?? 0) + rate * dt;
    const n = Math.floor(acc[name]);
    if (n > 0) {
      acc[name] -= n;
      particles.emit(kind, position, n);
    }
  };
}

export function heldMeshFor(held, game) {
  if (!held) return null;
  if (held.kind === 'pizza' || held.kind === 'burger') return buildPlated({...game[held.kind], type: held.kind});
  if (held.kind === 'extinguisher') {
    const g = new THREE.Group();
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .45, 16), new THREE.MeshStandardMaterial({color: 0xc8322b, roughness: .45}));
    const hose = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .3, 8), new THREE.MeshStandardMaterial({color: 0x222222}));
    hose.rotation.x = Math.PI / 2;
    hose.position.set(0, .2, -.15);
    g.add(tank, hose);
    return g;
  }
  if (held.kind === 'restock') {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(.34, .22, .3), new THREE.MeshStandardMaterial({color: 0xd9a86c, roughness: .9}));
    const item = buildItem(held.id);
    item.position.y = .13;
    crate.add(item);
    return crate;
  }
  return buildItem(held.kind === 'rawPatty' ? 'rawPatty' : held.id);
}

function applianceText(name, slot, burned, readyText) {
  if (!slot) return `${name} · idle`;
  if (burned) return `${name} · burnt!`;
  if (slot.elapsed >= slot.duration) return readyText;
  return `${name} · ${Math.ceil(slot.duration - slot.elapsed)}s`;
}

const dishKey = d => `${d.ingredients.join()}|${d.cooked}|${d.burned}`;

export function createSync(world, hands, particles) {
  const updates = {
    pizza: slotUpdater(world.boards.pizza.slot), burger: slotUpdater(world.boards.burger.slot),
    oven: slotUpdater(world.oven.slot), griddle: slotUpdater(world.griddle.slot),
    rest: slotUpdater(world.griddle.rest), hand: slotUpdater(hands.item),
  };
  const emit = emitter(particles);
  const fireLight = new THREE.PointLight(0xff6a1a, 0, 3);
  fireLight.position.copy(world.griddle.center).add(new THREE.Vector3(0, .3, .2));
  world.scene.add(fireLight);
  let pattyMesh = null;

  function boards(game, anyHolds) {
    for (const kind of ['pizza', 'burger']) {
      const carried = anyHolds(h => h.kind === kind);
      const build = kind === 'pizza' ? buildPizza : buildBurger;
      updates[kind](carried ? 'held' : dishKey(game[kind]), () => (carried ? null : build(game[kind])));
    }
  }

  function oven(game, dt, time, slowOven) {
    const o = game.oven, ready = o && o.elapsed >= o.duration;
    updates.oven(o ? `${dishKey(o.dish)}|${ready}` : 'empty', () => (o ? buildPizza({...o.dish, cooked: ready}) : null));
    const flicker = slowOven && Math.sin(time * 37) > .6 ? .2 : 1;
    world.oven.light.intensity = (o && !ready ? 2.2 + Math.sin(time * 9) * .4 : o ? .8 : 0) * flicker;
    world.oven.glass.material.emissive.setHex(o && !ready ? 0x5a2a0a : 0x000000);
    if (ready && !o.dish.burned) emit('ovenSteam', 'steam', STEAM_RATE, world.oven.smokePoint, dt);
    if (o?.dish.burned) emit('ovenSmoke', 'smoke', SMOKE_RATE, world.oven.smokePoint, dt);
    if (slowOven) emit('ovenSpark', 'ember', 2, world.oven.smokePoint, dt);
    const text = slowOven ? '♨ Oven · on the fritz' : applianceText('♨ Oven', o, o?.dish.burned, o?.dish.burned ? '♨ Burnt pizza' : '♨ Pizza ready!');
    const colors = ready ? {bg: o.dish.burned ? 'rgba(80,40,30,.92)' : 'rgba(226,115,61,.95)'} : slowOven ? {bg: 'rgba(120,90,20,.92)'} : {};
    world.oven.sign.update(text, colors);
  }

  function griddle(game, ctx, anyHolds, dt, time) {
    const g = game.grill;
    updates.griddle(g ? 'patty' : 'empty', () => {
      pattyMesh = g ? buildItem('rawPatty') : null;
      if (pattyMesh) pattyMesh.material = pattyMesh.material.clone();
      return pattyMesh;
    });
    if (g && pattyMesh) {
      pattyMesh.material.color.copy(pattyColor(g.elapsed / g.duration, g.burned));
      pattyMesh.position.y = .015 + (g.elapsed < g.duration ? Math.abs(Math.sin(time * 14)) * .004 : 0);
      const above = world.griddle.slot.position.clone().add(new THREE.Vector3(0, .05, 0));
      emit('grillSteam', g.burned ? 'smoke' : 'steam', g.burned ? SMOKE_RATE : STEAM_RATE, above, dt);
    }
    const restShows = game.pattyReady && !anyHolds(h => h.kind === 'ingredient' && h.id === 'patty');
    updates.rest(restShows ? 'patty' : 'empty', () => (restShows ? buildItem('patty') : null));
    if (ctx.fire) {
      emit('fire', 'fire', FIRE_RATE, world.griddle.center, dt);
      emit('ember', 'ember', 8, world.griddle.center, dt);
      emit('fireSmoke', 'smoke', SMOKE_RATE, world.griddle.center.clone().add(new THREE.Vector3(0, .5, 0)), dt);
    }
    fireLight.intensity = ctx.fire ? 3 + Math.sin(time * 23) * 1.2 + Math.sin(time * 7) : 0;
    const ready = g && g.elapsed >= g.duration;
    const text = ctx.fire ? '🔥 FIRE!' : game.pattyReady && !g ? '▤ Cooked patty waiting' : applianceText('▤ Griddle', g, g?.burned, g?.burned ? '▤ Burnt patty' : '▤ Patty ready!');
    const colors = ctx.fire ? {bg: 'rgba(200,40,20,.95)'} : ready ? {bg: g.burned ? 'rgba(80,40,30,.92)' : 'rgba(226,115,61,.95)'} : {};
    world.griddle.sign.update(text, colors);
  }

  function props(ctx, anyHolds) {
    const outOfStock = new Set(ctx.outOfStock ?? []);
    for (const [id, crate] of Object.entries(world.crates)) {
      const empty = outOfStock.has(id);
      crate.item.visible = !empty;
      crate.label.update(empty ? 'SOLD OUT' : crate.name, empty ? {bg: 'rgba(200,40,20,.95)'} : {});
    }
    world.extinguisher.group.visible = !anyHolds(h => h.kind === 'extinguisher');
    world.pantry.label.update(outOfStock.size ? '📦 Pantry · restock!' : '📦 Pantry', outOfStock.size ? {bg: 'rgba(226,115,61,.95)'} : {});
  }

  return function sync(snap, selfId, time, dt) {
    const {game, ctx = {}} = snap;
    const held = snap.players.map(p => p.held).filter(Boolean);
    const anyHolds = predicate => held.some(predicate);
    const mine = snap.players.find(p => p.id === selfId)?.held ?? null;
    const slowOven = (snap.events?.active ?? []).some(e => e.type === 'oven');
    const mineDish = mine && game[mine.kind] ? dishKey(game[mine.kind]) : '';

    boards(game, anyHolds);
    updates.hand(mine ? `${JSON.stringify(mine)}|${mineDish}` : 'empty', () => heldMeshFor(mine, game));
    hands.setHolding(Boolean(mine));
    oven(game, dt, time, slowOven);
    griddle(game, ctx, anyHolds, dt, time);
    props(ctx, anyHolds);
    for (const lamp of world.lights.lamps) lamp.intensity = slowOven && Math.sin(time * 31 + lamp.position.x) > .93 ? .6 : 2.5;
    world.tickets.forEach((t, i) => t.draw(ticketView(game, game.orders[i], ctx)));
  };
}
