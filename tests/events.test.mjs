/** Random kitchen events: scheduling, effects on the game and how they resolve. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KitchenGame} from '../dist/js/core.js';
import {EventDirector} from '../dist/js/events.js';

const setup = (mode = 'shift', random = () => .1) => {
  const game = new KitchenGame({random});
  game.reset(mode);
  const director = new EventDirector({random});
  director.reset(mode);
  return {game, director};
};

test('an event starts once the countdown runs out', () => {
  const {game, director} = setup();
  assert.equal(director.active.length, 0);
  const fx = director.tick(game, 60);
  assert.equal(director.active.length, 1);
  assert.equal(fx[0].kind, 'event-start');
});

test('nothing happens while paused or after the shift ends', () => {
  const {game, director} = setup();
  game.dispatch({type: 'PAUSE'});
  director.tick(game, 120);
  assert.equal(director.active.length, 0);
});

test('timed events expire', () => {
  const {game, director} = setup();
  director.start('oven', game);
  const fx = director.tick(game, 21);
  assert.equal(director.has('oven'), false);
  assert.ok(fx.some(f => f.kind === 'event-end' && f.reason === 'expired'));
});

test('a slow oven bakes at half speed', () => {
  const {game, director} = setup();
  director.start('oven', game);
  game.dispatch({type: 'ADD', ingredient: 'dough'});
  game.dispatch({type: 'ADD', ingredient: 'sauce'});
  game.dispatch({type: 'ADD', ingredient: 'mozzarella'});
  game.dispatch({type: 'BAKE'});
  game.tick(2);
  director.tick(game, 2);
  assert.equal(game.state.oven.elapsed, 1);
});

test('rush shortens patience of new customers and pays a bonus', () => {
  const {game, director} = setup();
  director.start('rush', game);
  game.state.orders.pop();
  game.addOrder();
  director.tick(game, .1);
  const fresh = game.state.orders.at(-1);
  assert.equal(fresh.total, 60);
  const before = game.state.score;
  director.onServed(game, game.state.orders[0].id);
  assert.equal(game.state.score, before + 30);
});

test('the critic pays double when served and costs points when missed', () => {
  const {game, director} = setup();
  director.start('critic', game);
  const critic = director.context().criticOrderId;
  assert.ok(game.state.orders.some(o => o.id === critic));
  const fx = director.onServed(game, critic, 42);
  assert.equal(game.state.score, 100);
  assert.equal(game.state.revenue, 42);
  assert.equal(director.has('critic'), false);
  assert.ok(fx.some(f => f.kind === 'bonus'));

  director.start('critic', game);
  game.state.score = 50;
  director.onMissed(game, director.context().criticOrderId);
  assert.equal(game.state.score, 0);
});

test('a shortage blocks one crate until it is restocked', () => {
  const {game, director} = setup();
  director.start('shortage', game, {ingredient: 'mozzarella'});
  assert.deepEqual(director.context().outOfStock, ['mozzarella']);
  assert.equal(director.restock('cheese'), false);
  assert.equal(director.restock('mozzarella'), true);
  assert.deepEqual(director.context().outOfStock, []);
});

test('a burnt patty starts a grease fire that the extinguisher puts out', () => {
  const {game, director} = setup();
  game.dispatch({type: 'GRILL'});
  game.tick(16);
  const fx = director.tick(game, .1);
  assert.equal(director.context().fire, true);
  assert.ok(fx.some(f => f.kind === 'event-start' && f.event.type === 'fire'));
  assert.equal(director.extinguish(game), true);
  assert.equal(director.context().fire, false);
  assert.equal(game.state.grill, null);
});

test('practice mode never schedules rush or fire', () => {
  const {game, director} = setup('practice', () => 0);
  game.dispatch({type: 'GRILL'});
  for (let i = 0; i < 20; i++) director.tick(game, 60);
  const types = director.history;
  assert.ok(types.length > 0);
  assert.ok(types.every(t => !['rush', 'fire'].includes(t)));
});

test('public state is plain data for the network', () => {
  const {game, director} = setup();
  director.start('shortage', game, {ingredient: 'tomato'});
  const pub = director.publicState();
  assert.equal(pub.active[0].title, 'Out of tomato');
  assert.doesNotThrow(() => JSON.stringify(pub));
});
