/** Multiplayer session: players, hands, shared kitchen, effects and validation. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KitchenSession, MAX_PLAYERS, sanitizeName} from '../dist/js/session.js';

const make = () => {
  const session = new KitchenSession({random: () => .1});
  session.join('a', 'Ana');
  session.join('b', 'Ben');
  session.drainFx();
  return session;
};
const run = (session, id, ...targets) => targets.forEach(t => session.interact(id, t));
const held = (session, id) => session.players.get(id).held;

test('players join with unique colours up to the limit', () => {
  const session = new KitchenSession();
  const players = Array.from({length: MAX_PLAYERS}, (_, i) => session.join(`p${i}`, `P${i}`));
  assert.equal(new Set(players.map(p => p.color)).size, MAX_PLAYERS);
  assert.equal(session.join('extra', 'Late'), null);
});

test('names are trimmed, stripped of markup and never empty', () => {
  assert.equal(sanitizeName('  <b>Chef\u0007 Bo</b>  '), 'bChef Bo/b');
  assert.equal(sanitizeName(''), 'Chef');
  assert.equal(sanitizeName(42), 'Chef');
  assert.equal(sanitizeName('x'.repeat(40)).length, 16);
});

test('two players share one kitchen and can split the work', () => {
  const s = make();
  run(s, 'a', 'crate:dough', 'board:pizza');
  run(s, 'b', 'crate:sauce', 'board:pizza');
  assert.deepEqual(s.game.state.pizza.ingredients, ['dough', 'sauce']);
});

test('a teammate cannot grab the pizza someone else is carrying', () => {
  const s = make();
  run(s, 'a', 'crate:dough', 'board:pizza', 'board:pizza');
  assert.deepEqual(held(s, 'a'), {kind: 'pizza'});
  s.interact('b', 'board:pizza');
  assert.equal(held(s, 'b'), null);
});

test('serving emits bell, used and served effects with the dish', () => {
  const s = make();
  run(s, 'a', 'crate:dough', 'board:pizza', 'crate:sauce', 'board:pizza', 'crate:mozzarella', 'board:pizza', 'board:pizza', 'oven');
  s.tick(7);
  run(s, 'a', 'oven');
  s.drainFx();
  run(s, 'a', 'window');
  const fx = s.drainFx();
  const served = fx.find(f => f.kind === 'served');
  assert.ok(fx.some(f => f.kind === 'bell'));
  assert.equal(served.orderId, 1);
  assert.equal(served.dish.type, 'pizza');
  assert.equal(served.by, 'a');
  assert.equal(s.game.state.served, 1);
});

test('missed orders emit a missed effect', () => {
  const s = make();
  s.start('shift');
  s.drainFx();
  s.tick(96);
  const missed = s.drainFx().filter(f => f.kind === 'missed');
  assert.equal(missed.length, 3);
});

test('restocking and extinguishing resolve events', () => {
  const s = make();
  s.start('shift');
  s.director.start('shortage', s.game, {ingredient: 'cheese'});
  run(s, 'a', 'pantry');
  assert.deepEqual(held(s, 'a'), {kind: 'restock', id: 'cheese'});
  run(s, 'a', 'crate:cheese');
  assert.equal(held(s, 'a'), null);
  assert.deepEqual(s.director.context().outOfStock, []);

  run(s, 'b', 'fridge', 'griddle');
  s.director.start('fire', s.game);
  run(s, 'b', 'extinguisher', 'griddle');
  assert.equal(s.director.context().fire, false);
  assert.deepEqual(held(s, 'b'), {kind: 'extinguisher'});
});

test('poses are clamped to the room and bad values ignored', () => {
  const s = make();
  s.setPose('a', {x: 99, z: -99, yaw: 1, pitch: 9});
  const a = s.players.get('a');
  assert.ok(a.x <= 5 && a.z >= -4);
  assert.ok(a.pitch <= 1.6);
  s.setPose('a', {x: NaN, z: 'nope', yaw: Infinity, pitch: 0});
  assert.ok(Number.isFinite(a.x) && Number.isFinite(a.z) && Number.isFinite(a.yaw));
});

test('unknown targets and unknown players are rejected', () => {
  const s = make();
  assert.equal(s.interact('a', 'crate:gold'), false);
  assert.equal(s.interact('ghost', 'fridge'), false);
  assert.equal(held(s, 'a'), null);
});

test('starting a new round empties everyone\'s hands', () => {
  const s = make();
  run(s, 'a', 'fridge');
  s.start('shift');
  assert.equal(held(s, 'a'), null);
  assert.equal(s.game.state.mode, 'shift');
});

test('snapshot is plain JSON with players and events', () => {
  const s = make();
  const snap = JSON.parse(JSON.stringify(s.snapshot()));
  assert.equal(snap.players.length, 2);
  assert.ok(snap.game.orders.length);
  assert.ok(Array.isArray(snap.events.active));
  assert.equal(typeof snap.ctx.fire, 'boolean');
});
