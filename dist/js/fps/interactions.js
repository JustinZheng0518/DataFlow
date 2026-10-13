/**
 * First-person interaction rules. Pure functions: no DOM, no Three.js, no network.
 * Shared by the browser (to show prompts) and the multiplayer server (to decide).
 * A player's hands are session state; every game rule still runs through
 * KitchenGame.dispatch, so the core stays the single source of truth.
 *
 * held: null | {kind:'ingredient',id} | {kind:'rawPatty'} | {kind:'pizza'} | {kind:'burger'}
 *     | {kind:'extinguisher'} | {kind:'restock',id}
 * target: 'crate:<id>' | 'board:pizza' | 'board:burger' | 'oven' | 'griddle' | 'fridge'
 *       | 'window' | 'bell' | 'trash' | 'pantry' | 'extinguisher' | 'ticket:<index>'
 * ctx (optional): {othersHeld: held[], outOfStock: id[], fire: bool, criticOrderId: number}
 *
 * A plan is {label, enabled, actions, effects, nextHeld, succeeded?}.
 * actions are core actions; effects are session-level side effects (bell, restock, extinguish).
 * nextHeld undefined means "hands unchanged".
 */
import {INGREDIENTS, RECIPES} from '../core.js';

export const PIZZA_ITEMS = ['dough', 'sauce', 'mozzarella', 'pepperoni', 'mushroom'];
export const BURGER_ITEMS = ['bunBottom', 'patty', 'cheese', 'lettuce', 'tomato', 'bunTop'];
export const CRATE_ITEMS = ['dough', 'sauce', 'mozzarella', 'pepperoni', 'mushroom', 'bunBottom', 'cheese', 'lettuce', 'tomato', 'bunTop'];
const PIZZA_BASE = ['dough', 'sauce', 'mozzarella'];
const FIXED_TARGETS = ['oven', 'griddle', 'fridge', 'window', 'bell', 'trash', 'pantry', 'extinguisher', 'board:pizza', 'board:burger'];

const plan = (label, opts = {}) => ({
  label, enabled: true, actions: opts.actions ?? [], effects: opts.effects ?? [],
  // An explicit nextHeld: undefined means "keep what you hold"; omitting it means empty hands.
  nextHeld: 'nextHeld' in opts ? opts.nextHeld : null, succeeded: opts.succeeded,
});
const blocked = label => ({label, enabled: false, actions: [], effects: [], nextHeld: undefined});
const ingredientName = id => INGREDIENTS[id]?.name ?? id;
const sameHeld = (a, b) => Boolean(a && b && a.kind === b.kind && a.id === b.id);
const othersHold = (ctx, item) => (ctx.othersHeld ?? []).some(h => sameHeld(h, item));

/** True when a target string is one the game understands. Used to validate network input. */
export function isValidTarget(target) {
  if (typeof target !== 'string' || target.length > 32) return false;
  if (FIXED_TARGETS.includes(target)) return true;
  if (target.startsWith('crate:')) return CRATE_ITEMS.includes(target.slice(6));
  return /^ticket:[0-2]$/.test(target);
}

export function heldLabel(held) {
  if (!held) return 'Empty hands';
  switch (held.kind) {
    case 'ingredient': return ingredientName(held.id);
    case 'rawPatty': return 'Raw patty';
    case 'pizza': return 'Pizza';
    case 'burger': return 'Burger';
    case 'extinguisher': return 'Fire extinguisher';
    case 'restock': return `${ingredientName(held.id)} restock box`;
    default: return 'Something';
  }
}

const handsFull = held => blocked(`Hands full (${heldLabel(held)}). Press Q to put it down`);

function crate(held, id, ctx) {
  const empty = (ctx.outOfStock ?? []).includes(id);
  if (held?.kind === 'restock' && held.id === id) return plan(`Restock ${ingredientName(id)}`, {effects: [{type: 'restock', id}]});
  if (empty) return blocked(`Out of ${ingredientName(id).toLowerCase()}! Get a restock box from the pantry`);
  if (held) return handsFull(held);
  return plan(`Pick up ${ingredientName(id)}`, {nextHeld: {kind: 'ingredient', id}});
}

function board(state, held, station, ctx) {
  const items = station === 'pizza' ? PIZZA_ITEMS : BURGER_ITEMS;
  const carriedByOther = othersHold(ctx, {kind: station});
  if (held?.kind === 'ingredient') {
    if (!items.includes(held.id)) return blocked(`${ingredientName(held.id)} belongs on the ${station === 'pizza' ? 'burger' : 'pizza'} board`);
    if (carriedByOther) return blocked(`A teammate is carrying the ${station}`);
    return plan(`Add ${ingredientName(held.id)}`, {actions: [{type: 'SELECT_STATION', station}, {type: 'ADD', ingredient: held.id}]});
  }
  if (held?.kind === station) return plan(`Put the ${station} down`);
  if (held) return handsFull(held);
  if (carriedByOther) return blocked(`A teammate is carrying the ${station}`);
  if (!state[station].ingredients.length) return blocked(station === 'pizza' ? 'Pizza board. Bring dough first' : 'Burger board. Bring a bottom bun first');
  return plan(`Pick up the ${station}`, {nextHeld: {kind: station}});
}

function oven(state, held, ctx) {
  const o = state.oven;
  if (held?.kind === 'pizza') {
    if (state.pizza.cooked) return blocked('Already baked. Take it to the serving window');
    if (o) return blocked('The oven is busy');
    if (!PIZZA_BASE.every(i => state.pizza.ingredients.includes(i))) return blocked('Needs dough, sauce and mozzarella before baking');
    return plan('Bake the pizza', {actions: [{type: 'SELECT_STATION', station: 'pizza'}, {type: 'BAKE'}]});
  }
  if (held) return handsFull(held);
  if (!o) return blocked('Oven. Bring a pizza to bake');
  if (o.elapsed < o.duration) return blocked(`Baking… ${Math.ceil(o.duration - o.elapsed)}s`);
  if (state.pizza.ingredients.length || othersHold(ctx, {kind: 'pizza'})) return blocked('Pizza ready. Clear or finish the pizza board first');
  // The core reports a burnt pizza with an error message even though collecting worked.
  return plan(o.dish.burned ? 'Take out the burnt pizza' : 'Take the pizza out', {actions: [{type: 'COLLECT_OVEN'}], nextHeld: {kind: 'pizza'}, succeeded: s => !s.oven});
}

function griddle(state, held, ctx) {
  const g = state.grill;
  if (ctx.fire) {
    if (held?.kind === 'extinguisher') return plan('Put out the fire!', {effects: [{type: 'extinguish'}], nextHeld: undefined});
    return blocked('Grease fire! Grab the extinguisher by the trash');
  }
  if (held?.kind === 'rawPatty') {
    if (g) return blocked('The griddle is busy');
    if (state.pattyReady) return blocked('Use the cooked patty first');
    return plan('Put the patty on the griddle', {actions: [{type: 'GRILL'}]});
  }
  if (held) return handsFull(held);
  if (g && g.elapsed < g.duration) return blocked(`Sizzling… ${Math.ceil(g.duration - g.elapsed)}s`);
  if (g) return plan(g.burned ? 'Scrape off the burnt patty' : 'Pick up the cooked patty', {actions: [{type: 'COLLECT_GRILL'}], nextHeld: g.burned ? null : {kind: 'ingredient', id: 'patty'}});
  if (state.pattyReady && othersHold(ctx, {kind: 'ingredient', id: 'patty'})) return blocked('A teammate has the cooked patty');
  if (state.pattyReady) return plan('Pick up the cooked patty', {nextHeld: {kind: 'ingredient', id: 'patty'}});
  return blocked('Griddle. Bring a raw patty from the fridge');
}

/** Orders whose recipe exactly matches the dish, critic first, then the least patient. */
function matchingOrder(state, station, ctx) {
  const dish = state[station];
  const matches = state.orders.filter(o => {
    const r = RECIPES.find(x => x.id === o.recipeId);
    return r.type === station && r.ingredients.length === dish.ingredients.length && r.ingredients.every(i => dish.ingredients.includes(i));
  });
  const critic = matches.find(o => o.id === ctx.criticOrderId);
  return critic ?? [...matches].sort((a, b) => a.remaining - b.remaining)[0];
}

function serveWindow(state, held, ctx) {
  if (held?.kind !== 'pizza' && held?.kind !== 'burger') return blocked('Serving window. Bring a finished dish');
  const station = held.kind;
  const match = matchingOrder(state, station, ctx);
  const select = match ? {type: 'SELECT_ORDER', id: match.id} : {type: 'SELECT_STATION', station};
  return plan(`Serve the ${station} and ring the bell`, {actions: [select, {type: 'SERVE'}], effects: [{type: 'bell'}]});
}

function trash(held) {
  if (!held) return blocked('Trash');
  if (held.kind === 'pizza' || held.kind === 'burger') return plan(`Throw away the ${held.kind}`, {actions: [{type: 'SELECT_STATION', station: held.kind}, {type: 'CLEAR'}]});
  if (held.kind === 'ingredient' && held.id === 'patty') return blocked('Press Q to set the cooked patty down instead');
  if (held.kind === 'extinguisher' || held.kind === 'restock') return blocked('Press Q to put it back where it belongs');
  return plan(`Throw away ${heldLabel(held).toLowerCase()}`);
}

function extinguisher(held, ctx) {
  if (held?.kind === 'extinguisher') return plan('Hang the extinguisher back up');
  if (held) return handsFull(held);
  if (othersHold(ctx, {kind: 'extinguisher'})) return blocked('A teammate has the extinguisher');
  return plan(ctx.fire ? 'Grab the extinguisher!' : 'Grab the fire extinguisher', {nextHeld: {kind: 'extinguisher'}});
}

function pantry(held, ctx) {
  if (held?.kind === 'restock') return plan('Put the restock box back');
  const needed = (ctx.outOfStock ?? []).find(id => !othersHold(ctx, {kind: 'restock', id}));
  if (!needed) return blocked('Pantry. Everything is stocked');
  if (held) return handsFull(held);
  return plan(`Grab a ${ingredientName(needed).toLowerCase()} restock box`, {nextHeld: {kind: 'restock', id: needed}});
}

function ticket(state, index) {
  const order = state.orders[index];
  if (!order) return null;
  const r = RECIPES.find(x => x.id === order.recipeId);
  return plan(`Select ticket #${order.id}: ${r.name}`, {actions: [{type: 'SELECT_ORDER', id: order.id}], nextHeld: undefined});
}

/** Describe what the interact key would do. Returns null when the target is not interactive. */
export function planInteraction(state, held, target, ctx = {}) {
  if (!target || state.paused || state.ended) return null;
  if (target.startsWith('crate:')) return crate(held, target.slice(6), ctx);
  if (target.startsWith('board:')) return board(state, held, target.slice(6), ctx);
  if (target.startsWith('ticket:')) return ticket(state, Number(target.slice(7)));
  switch (target) {
    case 'oven': return oven(state, held, ctx);
    case 'griddle': return griddle(state, held, ctx);
    case 'fridge': return held ? handsFull(held) : plan('Grab a raw patty', {nextHeld: {kind: 'rawPatty'}});
    case 'window': return serveWindow(state, held, ctx);
    case 'bell': return plan('Ring the bell', {effects: [{type: 'bell'}], nextHeld: undefined});
    case 'trash': return trash(held);
    case 'extinguisher': return extinguisher(held, ctx);
    case 'pantry': return pantry(held, ctx);
    default: return null;
  }
}

/**
 * Run a plan's core actions against the game and return {held, ok}.
 * A plan may supply succeeded(state); otherwise an error message after dispatch
 * means the action failed and the hands stay unchanged.
 * Session-level effects are applied by the caller only when ok is true.
 */
export function performInteraction(game, held, interaction) {
  if (!interaction?.enabled) return held;
  return runInteraction(game, held, interaction).held;
}

export function runInteraction(game, held, interaction) {
  if (!interaction?.enabled) return {held, ok: false};
  for (const action of interaction.actions) game.dispatch(action);
  const failed = interaction.succeeded
    ? !interaction.succeeded(game.state)
    : interaction.actions.length > 0 && game.state.messageType === 'error';
  if (failed) return {held, ok: false};
  return {held: interaction.nextHeld === undefined ? held : interaction.nextHeld, ok: true};
}

/** Put down whatever is held. Dishes return to their board; loose items go back to their source. */
export function planDrop(held) {
  if (!held) return null;
  if (held.kind === 'pizza' || held.kind === 'burger') return {label: `Put the ${held.kind} back on its board`};
  if (held.kind === 'ingredient' && held.id === 'patty') return {label: 'Set the cooked patty beside the griddle'};
  if (held.kind === 'extinguisher') return {label: 'Hang the extinguisher back up'};
  if (held.kind === 'restock') return {label: 'Put the restock box back in the pantry'};
  return {label: `Put ${heldLabel(held).toLowerCase()} back`};
}
