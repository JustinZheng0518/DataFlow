/**
 * A shared kitchen for one or more players. Pure domain code: runs in the browser
 * for solo play and on the Node server for multiplayer, so both follow the same rules.
 * Owns the KitchenGame, the EventDirector and every player's hands and pose.
 * Produces "fx" (served, missed, bell, used, event-start, ...) for views to animate.
 */
import {KitchenGame, RECIPES} from './core.js';
import {EventDirector} from './events.js';
import {planInteraction, runInteraction, isValidTarget} from './fps/interactions.js';

export const MAX_PLAYERS = 4;
export const PLAYER_COLORS = ['#e2733d', '#3d7fe2', '#9b59b6', '#2fa36b'];
const NAME_MAX = 16;
const ROOM_LIMITS = {minX: -4.7, maxX: 4.7, minZ: -3.7, maxZ: 3.7};
const MAX_PITCH = 1.6;

/** Make a display name safe: printable text, no markup characters, limited length. */
export function sanitizeName(raw) {
  if (typeof raw !== 'string') return 'Chef';
  const clean = raw.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, NAME_MAX);
  return clean || 'Chef';
}

const finiteOr = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class KitchenSession {
  constructor({random = Math.random} = {}) {
    this.game = new KitchenGame({random});
    this.director = new EventDirector({random});
    this.players = new Map();
    this.fx = [];
    this.seq = 0;
  }

  join(id, name) {
    if (this.players.has(id)) return this.players.get(id);
    if (this.players.size >= MAX_PLAYERS) return null;
    const used = new Set([...this.players.values()].map(p => p.color));
    const color = PLAYER_COLORS.find(c => !used.has(c));
    const spawn = this.players.size;
    const player = {id, name: sanitizeName(name), color, held: null, x: -1.5 + spawn, z: 2.6, yaw: 0, pitch: -.12};
    this.players.set(id, player);
    this.fx.push({kind: 'joined', id, name: player.name});
    return player;
  }

  leave(id) {
    const player = this.players.get(id);
    if (!player) return;
    this.players.delete(id);
    this.fx.push({kind: 'left', id, name: player.name});
  }

  setPose(id, pose) {
    const p = this.players.get(id);
    if (!p || typeof pose !== 'object' || pose === null) return;
    p.x = clamp(finiteOr(pose.x, p.x), ROOM_LIMITS.minX, ROOM_LIMITS.maxX);
    p.z = clamp(finiteOr(pose.z, p.z), ROOM_LIMITS.minZ, ROOM_LIMITS.maxZ);
    p.yaw = finiteOr(pose.yaw, p.yaw) % (Math.PI * 2);
    p.pitch = clamp(finiteOr(pose.pitch, p.pitch), -MAX_PITCH, MAX_PITCH);
  }

  contextFor(id) {
    const othersHeld = [...this.players.values()].filter(p => p.id !== id && p.held).map(p => p.held);
    return {...this.director.context(), othersHeld};
  }

  plan(id, target) {
    const p = this.players.get(id);
    if (!p || !isValidTarget(target)) return null;
    return planInteraction(this.game.state, p.held, target, this.contextFor(id));
  }

  interact(id, target) {
    const p = this.players.get(id);
    const interaction = this.plan(id, target);
    if (!p || !interaction?.enabled) return false;
    const s = this.game.state;
    const before = {orders: s.orders.map(o => ({...o})), served: s.served};
    const dishBefore = p.held && s[p.held.kind] ? structuredClone(s[p.held.kind]) : null;
    const {held, ok} = runInteraction(this.game, p.held, interaction);
    if (!ok) return false;
    p.held = held;
    this.fx.push({kind: 'used', target, by: id});
    for (const effect of interaction.effects) this.applyEffect(effect, id);
    if (this.game.state.served > before.served) this.recordServe(before.orders, dishBefore, id);
    return true;
  }

  applyEffect(effect, by) {
    if (effect.type === 'bell') this.fx.push({kind: 'bell', by});
    if (effect.type === 'restock' && this.director.restock(effect.id)) {
      this.game.say('Restocked. Back in business!', 'success', 'event');
      this.fx.push({kind: 'event-end', event: {type: 'shortage', ingredient: effect.id}, reason: 'resolved'});
    }
    if (effect.type === 'extinguish' && this.director.extinguish(this.game)) {
      this.fx.push({kind: 'extinguish', by}, {kind: 'event-end', event: {type: 'fire'}, reason: 'resolved'});
    }
    this.game.emit();
  }

  recordServe(ordersBefore, dish, by) {
    const remaining = new Set(this.game.state.orders.map(o => o.id));
    const order = ordersBefore.find(o => !remaining.has(o.id));
    if (!order) return;
    const price = RECIPES.find(r => r.id === order.recipeId)?.price ?? 0;
    this.fx.push({kind: 'served', orderId: order.id, recipeId: order.recipeId, dish: dish && {...dish, ingredients: [...dish.ingredients]}, by});
    this.fx.push(...this.director.onServed(this.game, order.id, price));
  }

  drop(id) {
    const p = this.players.get(id);
    if (!p?.held) return;
    p.held = null;
    this.fx.push({kind: 'dropped', by: id});
  }

  selectTicket(id, index) {
    const order = this.game.state.orders[index];
    if (!this.players.has(id) || !order) return;
    this.game.dispatch({type: 'SELECT_ORDER', id: order.id});
  }

  start(mode) {
    const safeMode = mode === 'shift' ? 'shift' : 'practice';
    this.game.dispatch({type: 'RESET', mode: safeMode});
    this.director.reset(safeMode);
    for (const p of this.players.values()) p.held = null;
    this.fx.push({kind: 'reset', mode: safeMode});
  }

  togglePause() { this.game.dispatch({type: 'PAUSE'}); }

  tick(dt) {
    const s = this.game.state;
    const before = {orders: s.orders.map(o => o.id), missed: s.missed, ended: s.ended};
    this.game.tick(dt);
    this.fx.push(...this.director.tick(this.game, dt));
    if (this.game.state.missed > before.missed) {
      const remaining = new Set(this.game.state.orders.map(o => o.id));
      for (const orderId of before.orders.filter(o => !remaining.has(o))) {
        this.fx.push({kind: 'missed', orderId});
        this.fx.push(...this.director.onMissed(this.game, orderId));
      }
    }
    if (this.game.state.ended && !before.ended) this.fx.push({kind: 'ended'});
  }

  snapshot() {
    this.seq += 1;
    return {
      seq: this.seq,
      game: this.game.state,
      players: [...this.players.values()].map(p => ({...p})),
      events: this.director.publicState(),
      ctx: this.director.context(),
    };
  }

  drainFx() {
    const out = this.fx;
    this.fx = [];
    return out;
  }
}
