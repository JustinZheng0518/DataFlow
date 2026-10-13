/**
 * Random kitchen events. Pure domain code (no DOM), shared by solo play and the server.
 * The director watches a KitchenGame and nudges its state: shorter patience during a
 * rush, a slow oven, a grease fire on the griddle, a sold-out crate or a food critic.
 * Every method returns "fx": plain objects the views use for banners and sounds.
 */
import {INGREDIENTS} from './core.js';

const CRATE_ITEMS = ['dough', 'sauce', 'mozzarella', 'pepperoni', 'mushroom', 'bunBottom', 'cheese', 'lettuce', 'tomato', 'bunTop'];
const RUSH_PATIENCE = 60;
const RUSH_BONUS = 30;
const CRITIC_POINTS = 100;
const FIRE_PENALTY = 40;
const FIRE_DRAIN_PER_SECOND = 2;
const OVEN_SLOWDOWN = .5;
const MAX_RANDOM_ACTIVE = 2;
const FIRST_EVENT_AFTER = {shift: 20, practice: 30};
const EVENT_GAP = {shift: [22, 18], practice: [35, 25]};

export const EVENT_INFO = {
  rush: {title: () => 'Lunch rush!', detail: 'New customers are impatient. +30 points per dish served.', duration: 30, shiftOnly: true},
  critic: {title: () => 'A food critic is waiting', detail: 'Serve the ★ ticket for double pay and +100 points.', duration: null},
  oven: {title: () => 'Oven on the fritz', detail: 'The oven bakes at half speed for a while.', duration: 20},
  shortage: {title: e => `Out of ${INGREDIENTS[e.ingredient].name.toLowerCase()}`, detail: 'Bring a restock box from the pantry to the empty crate.', duration: null},
  fire: {title: () => 'Grease fire!', detail: 'Grab the extinguisher by the trash and put out the griddle.', duration: null, shiftOnly: true},
};

const clampScore = (game, delta) => { game.state.score = Math.max(0, game.state.score + delta); };

export class EventDirector {
  constructor({random = Math.random} = {}) {
    this.random = random;
    this.reset('practice');
  }

  reset(mode) {
    this.mode = mode;
    this.active = [];
    this.history = [];
    this.nextId = 1;
    this.nextIn = FIRST_EVENT_AFTER[mode] ?? FIRST_EVENT_AFTER.practice;
    this.seenOrders = new Set();
    this.fireDrain = 0;
  }

  has(type) { return this.active.some(e => e.type === type); }
  find(type) { return this.active.find(e => e.type === type); }

  /** Values interaction rules need: what is sold out, whether the griddle burns, the critic's ticket. */
  context() {
    return {
      outOfStock: this.active.filter(e => e.type === 'shortage').map(e => e.ingredient),
      fire: this.has('fire'),
      criticOrderId: this.find('critic')?.orderId ?? null,
    };
  }

  publicState() {
    return {active: this.active.map(e => ({...e, title: EVENT_INFO[e.type].title(e), detail: EVENT_INFO[e.type].detail}))};
  }

  eligible(game) {
    const s = game.state;
    return Object.keys(EVENT_INFO).filter(type => {
      if (this.has(type)) return false;
      if (EVENT_INFO[type].shiftOnly && this.mode !== 'shift') return false;
      if (type === 'fire') return Boolean(s.grill);
      if (type === 'critic') return s.orders.length > 0;
      return true;
    });
  }

  /** Begin an event. Returns its start fx, or [] if it cannot start. */
  start(type, game, opts = {}) {
    if (this.has(type) || !EVENT_INFO[type]) return [];
    const event = {id: this.nextId++, type, remaining: EVENT_INFO[type].duration};
    if (type === 'shortage') event.ingredient = opts.ingredient ?? CRATE_ITEMS[Math.floor(this.random() * CRATE_ITEMS.length)];
    if (type === 'critic') {
      const orders = game.state.orders;
      if (!orders.length) return [];
      event.orderId = opts.orderId ?? orders[Math.floor(this.random() * orders.length)].id;
    }
    if (type === 'fire') this.ignite(game);
    this.active = [...this.active, event];
    this.history = [...this.history, type];
    game.say(`${EVENT_INFO[type].title(event)} ${EVENT_INFO[type].detail}`, type === 'fire' ? 'error' : 'info', 'event');
    return [{kind: 'event-start', event: this.publicEvent(event)}];
  }

  ignite(game) {
    const g = game.state.grill;
    if (g) {
      g.burned = true;
      g.elapsed = Math.max(g.elapsed, g.duration);
    }
    clampScore(game, -FIRE_PENALTY);
    this.fireDrain = 0;
  }

  end(type, reason) {
    const event = this.find(type);
    if (!event) return [];
    this.active = this.active.filter(e => e !== event);
    return [{kind: 'event-end', event: this.publicEvent(event), reason}];
  }

  publicEvent(event) {
    return {...event, title: EVENT_INFO[event.type].title(event), detail: EVENT_INFO[event.type].detail};
  }

  tick(game, dt) {
    const s = game.state;
    if (s.paused || s.ended || !Number.isFinite(dt) || dt <= 0) return [];
    const fx = [];
    for (const event of this.active) if (event.remaining !== null) event.remaining -= dt;
    for (const event of this.active.filter(e => e.remaining !== null && e.remaining <= 0)) fx.push(...this.end(event.type, 'expired'));
    this.applyRush(game);
    this.applyOven(game, dt);
    this.applyFire(game, dt, fx);
    if (this.has('critic') && !s.orders.some(o => o.id === this.find('critic').orderId)) fx.push(...this.end('critic', 'failed'));
    this.nextIn -= dt;
    if (this.nextIn <= 0) {
      const [base, spread] = EVENT_GAP[this.mode] ?? EVENT_GAP.practice;
      this.nextIn = base + this.random() * spread;
      const options = this.eligible(game);
      if (options.length && this.active.length < MAX_RANDOM_ACTIVE) fx.push(...this.start(options[Math.floor(this.random() * options.length)], game));
    }
    return fx;
  }

  applyRush(game) {
    for (const order of game.state.orders) {
      if (this.seenOrders.has(order.id)) continue;
      this.seenOrders.add(order.id);
      if (this.has('rush') && this.mode === 'shift') {
        order.remaining = Math.min(order.remaining, RUSH_PATIENCE);
        order.total = RUSH_PATIENCE;
      }
    }
  }

  applyOven(game, dt) {
    const o = game.state.oven;
    if (this.has('oven') && o && o.elapsed < o.duration) o.elapsed = Math.max(0, o.elapsed - dt * OVEN_SLOWDOWN);
  }

  applyFire(game, dt, fx) {
    const g = game.state.grill;
    if (!this.has('fire') && g?.burned && this.mode === 'shift') fx.push(...this.start('fire', game));
    if (!this.has('fire')) return;
    this.fireDrain += dt * FIRE_DRAIN_PER_SECOND;
    const whole = Math.floor(this.fireDrain);
    if (whole > 0) {
      clampScore(game, -whole);
      this.fireDrain -= whole;
    }
  }

  /** A dish was served. Returns bonus fx. */
  onServed(game, orderId, price = 0) {
    const fx = [];
    if (this.has('rush')) {
      clampScore(game, RUSH_BONUS);
      fx.push({kind: 'bonus', points: RUSH_BONUS, revenue: 0, text: `Rush bonus +${RUSH_BONUS}`});
    }
    if (this.find('critic')?.orderId === orderId) {
      clampScore(game, CRITIC_POINTS);
      game.state.revenue += price;
      fx.push({kind: 'bonus', points: CRITIC_POINTS, revenue: price, text: `The critic loved it! +${CRITIC_POINTS} · +¥${price}`});
      fx.push(...this.end('critic', 'resolved'));
    }
    return fx;
  }

  /** A customer gave up. Returns penalty fx. */
  onMissed(game, orderId) {
    if (this.find('critic')?.orderId !== orderId) return [];
    if (this.mode === 'shift') clampScore(game, -CRITIC_POINTS);
    return this.end('critic', 'failed');
  }

  restock(id) {
    const event = this.active.find(e => e.type === 'shortage' && e.ingredient === id);
    if (!event) return false;
    this.active = this.active.filter(e => e !== event);
    return true;
  }

  /** Put out the fire. The burnt patty is scraped off. */
  extinguish(game) {
    if (!this.has('fire')) return false;
    this.active = this.active.filter(e => e.type !== 'fire');
    if (game.state.grill) game.state.grill = null;
    game.say('Fire is out. Nice save, chef!', 'success', 'event');
    return true;
  }
}
