/** First-person interaction rules: held item + looked-at target → core actions. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KitchenGame} from '../dist/js/core.js';
import {planInteraction, performInteraction, planDrop} from '../dist/js/fps/interactions.js';

const make = () => new KitchenGame({random: () => .1});
const use = (g, held, target) => performInteraction(g, held, planInteraction(g.state, held, target));
const carry = (g, held, ...targets) => targets.reduce((h, t) => use(g, h, t), held);

test('picking up from a crate requires empty hands', () => {
  const g = make();
  const held = use(g, null, 'crate:dough');
  assert.deepEqual(held, {kind: 'ingredient', id: 'dough'});
  const plan = planInteraction(g.state, held, 'crate:sauce');
  assert.equal(plan.enabled, false);
});

test('placing an ingredient on the matching board adds it to the dish', () => {
  const g = make();
  const held = carry(g, null, 'crate:dough', 'board:pizza');
  assert.equal(held, null);
  assert.deepEqual(g.state.pizza.ingredients, ['dough']);
});

test('a rejected placement keeps the ingredient in hand', () => {
  const g = make();
  const held = carry(g, null, 'crate:mozzarella', 'board:pizza');
  assert.deepEqual(held, {kind: 'ingredient', id: 'mozzarella'});
  assert.deepEqual(g.state.pizza.ingredients, []);
});

test('pizza ingredients cannot go on the burger board', () => {
  const g = make();
  const plan = planInteraction(g.state, {kind: 'ingredient', id: 'dough'}, 'board:burger');
  assert.equal(plan.enabled, false);
});

test('full pizza flow: build, carry to oven, collect, serve at window', () => {
  const g = make();
  let held = carry(g, null, 'crate:dough', 'board:pizza', 'crate:sauce', 'board:pizza', 'crate:mozzarella', 'board:pizza');
  held = use(g, held, 'board:pizza');
  assert.deepEqual(held, {kind: 'pizza'});
  held = use(g, held, 'oven');
  assert.equal(held, null);
  assert.ok(g.state.oven);
  assert.equal(planInteraction(g.state, null, 'oven').enabled, false);
  g.tick(7);
  held = use(g, held, 'oven');
  assert.deepEqual(held, {kind: 'pizza'});
  held = use(g, held, 'window');
  assert.equal(held, null);
  assert.equal(g.state.served, 1);
  assert.equal(g.state.revenue, 42);
});

test('serving auto-selects the ticket that matches the dish', () => {
  const g = make();
  let held = use(g, null, 'fridge');
  assert.deepEqual(held, {kind: 'rawPatty'});
  held = use(g, held, 'griddle');
  g.tick(5);
  held = use(g, held, 'griddle');
  assert.deepEqual(held, {kind: 'ingredient', id: 'patty'});
  held = null; // dropped with Q; the cooked patty waits beside the griddle
  held = carry(g, null, 'crate:bunBottom', 'board:burger');
  held = carry(g, held, 'griddle', 'board:burger');
  for (const id of ['cheese', 'lettuce', 'bunTop']) held = carry(g, held, `crate:${id}`, 'board:burger');
  held = carry(g, held, 'board:burger', 'window');
  assert.equal(g.state.served, 1);
  assert.equal(g.state.revenue, 36);
});

test('serving a dish no ticket wants keeps it in hand with an error', () => {
  const g = make();
  let held = carry(g, null, 'crate:dough', 'board:pizza', 'crate:sauce', 'board:pizza');
  held = carry(g, held, 'board:pizza', 'window');
  assert.deepEqual(held, {kind: 'pizza'});
  assert.equal(g.state.messageType, 'error');
  assert.equal(g.state.served, 0);
});

test('trash clears a carried dish and discards loose ingredients', () => {
  const g = make();
  let held = carry(g, null, 'crate:dough', 'board:pizza', 'board:pizza', 'trash');
  assert.equal(held, null);
  assert.deepEqual(g.state.pizza.ingredients, []);
  held = carry(g, null, 'crate:lettuce', 'trash');
  assert.equal(held, null);
});

test('tickets can be selected by looking at them', () => {
  const g = make();
  use(g, null, 'ticket:2');
  assert.equal(g.state.selectedOrder, 3);
});

test('dropping returns carried dishes to their board without core changes', () => {
  assert.equal(planDrop({kind: 'pizza'}).label, 'Put the pizza back on its board');
  assert.equal(planDrop(null), null);
});

test('busy appliances and empty boards are not interactive', () => {
  const g = make();
  assert.equal(planInteraction(g.state, null, 'board:pizza').enabled, false);
  assert.equal(planInteraction(g.state, null, 'griddle').enabled, false);
  assert.equal(planInteraction(g.state, null, 'nothing'), null);
});

test('a burnt pizza taken out of the oven ends up in hand so it can be trashed', () => {
  const g = make();
  g.reset('shift');
  let held = carry(g, null, 'crate:dough', 'board:pizza', 'crate:sauce', 'board:pizza', 'crate:mozzarella', 'board:pizza', 'board:pizza', 'oven');
  g.tick(17);
  held = use(g, held, 'oven');
  assert.equal(g.state.oven, null);
  assert.deepEqual(held, {kind: 'pizza'});
  assert.equal(g.state.pizza.burned, true);
  held = use(g, held, 'trash');
  assert.equal(held, null);
  assert.deepEqual(g.state.pizza.ingredients, []);
});

test('the oven explains when the pizza board must be cleared first', () => {
  const g = make();
  let held = carry(g, null, 'crate:dough', 'board:pizza', 'crate:sauce', 'board:pizza', 'crate:mozzarella', 'board:pizza', 'board:pizza', 'oven');
  held = carry(g, held, 'crate:dough', 'board:pizza');
  g.tick(7);
  const plan = planInteraction(g.state, null, 'oven');
  assert.equal(plan.enabled, false);
  assert.match(plan.label, /board/i);
});

// ---- Multiplayer + events context ----
test('a dish carried by another player cannot be grabbed or added to', () => {
  const g = make();
  carry(g, null, 'crate:dough', 'board:pizza');
  const ctx = {othersHeld: [{kind: 'pizza'}]};
  assert.equal(planInteraction(g.state, null, 'board:pizza', ctx).enabled, false);
  assert.equal(planInteraction(g.state, {kind: 'ingredient', id: 'sauce'}, 'board:pizza', ctx).enabled, false);
});

test('only one player can take the cooked patty', () => {
  const g = make();
  carry(g, null, 'fridge', 'griddle');
  g.tick(5);
  use(g, null, 'griddle');
  const plan = planInteraction(g.state, null, 'griddle', {othersHeld: [{kind: 'ingredient', id: 'patty'}]});
  assert.equal(plan.enabled, false);
});

test('out-of-stock crates need a restock box from the pantry', () => {
  const g = make();
  const ctx = {outOfStock: ['mozzarella']};
  assert.equal(planInteraction(g.state, null, 'crate:mozzarella', ctx).enabled, false);
  const pantry = planInteraction(g.state, null, 'pantry', ctx);
  assert.deepEqual(pantry.nextHeld, {kind: 'restock', id: 'mozzarella'});
  const restock = planInteraction(g.state, {kind: 'restock', id: 'mozzarella'}, 'crate:mozzarella', ctx);
  assert.equal(restock.enabled, true);
  assert.deepEqual(restock.effects, [{type: 'restock', id: 'mozzarella'}]);
  assert.equal(restock.nextHeld, null);
  assert.equal(planInteraction(g.state, null, 'pantry', {}).enabled, false);
});

test('a grease fire blocks the griddle until the extinguisher is used', () => {
  const g = make();
  const ctx = {fire: true};
  assert.equal(planInteraction(g.state, {kind: 'rawPatty'}, 'griddle', ctx).enabled, false);
  assert.deepEqual(planInteraction(g.state, null, 'extinguisher', ctx).nextHeld, {kind: 'extinguisher'});
  const out = planInteraction(g.state, {kind: 'extinguisher'}, 'griddle', ctx);
  assert.deepEqual(out.effects, [{type: 'extinguish'}]);
  assert.equal(out.nextHeld, undefined);
  assert.equal(planInteraction(g.state, null, 'extinguisher', {othersHeld: [{kind: 'extinguisher'}]}).enabled, false);
});

test('serving rings the bell and prefers the critic ticket', () => {
  const g = make();
  g.state.orders[2].recipeId = 'margherita';
  const held = carry(g, null, 'crate:dough', 'board:pizza', 'crate:sauce', 'board:pizza', 'crate:mozzarella', 'board:pizza', 'board:pizza');
  const plan = planInteraction(g.state, held, 'window', {criticOrderId: 3});
  assert.deepEqual(plan.actions[0], {type: 'SELECT_ORDER', id: 3});
  assert.deepEqual(plan.effects, [{type: 'bell'}]);
  assert.deepEqual(planInteraction(g.state, null, 'bell').effects, [{type: 'bell'}]);
});

test('extinguishers and restock boxes go back instead of into the trash', () => {
  const g = make();
  assert.equal(planInteraction(g.state, {kind: 'extinguisher'}, 'trash').enabled, false);
  assert.equal(planDrop({kind: 'extinguisher'}).label, 'Hang the extinguisher back up');
});
