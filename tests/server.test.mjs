/** Integration: real HTTP + WebSocket server with two clients sharing a kitchen. */
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {startServer, resolveStatic} from '../server/server.mjs';

let server;
before(async () => { server = await startServer({port: 0, host: '127.0.0.1', tickMs: 20}); });
after(async () => { await server.close(); });

const url = p => `http://127.0.0.1:${server.port}${p}`;

function connect(name) {
  const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
  const inbox = [];
  ws.on('message', raw => inbox.push(JSON.parse(raw.toString())));
  const waitFor = (predicate, timeout = 2000) => new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      const hit = inbox.find(predicate);
      if (hit) return resolve(hit);
      if (Date.now() - started > timeout) return reject(new Error('timed out waiting for message'));
      setTimeout(poll, 10);
    };
    poll();
  });
  const ready = new Promise(resolve => ws.on('open', () => { ws.send(JSON.stringify({t: 'hello', name})); resolve(); }));
  return {ws, inbox, waitFor, ready, send: msg => ws.send(JSON.stringify(msg))};
}

test('serves the game files and blocks path traversal', async () => {
  const page = await fetch(url('/fps.html'));
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  const info = await (await fetch(url('/api/info'))).json();
  assert.equal(info.multiplayer, true);
  assert.equal(resolveStatic('/../package.json'), null);
  assert.equal(resolveStatic('/%2e%2e/package.json'), null);
  assert.equal((await fetch(url('/missing.js'))).status, 404);
});

test('two players join, see each other and share the kitchen', async () => {
  const a = connect('Ana'), b = connect('Ben');
  await Promise.all([a.ready, b.ready]);
  const welcomeA = await a.waitFor(m => m.t === 'welcome');
  await b.waitFor(m => m.t === 'welcome');
  await a.waitFor(m => m.t === 'state' && m.snap.players.length === 2);

  a.send({t: 'interact', target: 'crate:dough'});
  a.send({t: 'interact', target: 'board:pizza'});
  b.send({t: 'interact', target: 'crate:sauce'});
  b.send({t: 'interact', target: 'board:pizza'});
  const shared = await b.waitFor(m => m.t === 'state' && m.snap.game.pizza.ingredients.length === 2);
  assert.deepEqual(shared.snap.game.pizza.ingredients, ['dough', 'sauce']);

  a.send({t: 'pose', x: 1, z: 1, yaw: .5, pitch: 0});
  const moved = await b.waitFor(m => m.t === 'state' && m.snap.players.some(p => p.id === welcomeA.id && p.x === 1));
  assert.ok(moved);

  a.send({t: 'interact', target: '../../etc/passwd'});
  a.send({t: 'nonsense'});
  a.ws.send('not json');
  b.ws.close();
  await a.waitFor(m => m.t === 'state' && m.snap.players.length === 1);
  a.ws.close();
});
