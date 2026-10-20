/**
 * Two interchangeable kitchen connections with the same interface:
 *   LocalKitchen  - solo play, runs KitchenSession in the browser.
 *   RemoteKitchen - multiplayer, talks to server/server.mjs over a WebSocket.
 * Interface: selfId, online, start(mode), interact(target), drop(), select(i), pause(),
 *            sendPose(pose), update(dt, active) -> {snap, fx}, close().
 */
import {KitchenSession} from '../session.js';
import {planInteraction} from './interactions.js';

const POSE_INTERVAL = 1 / 15;
const CONNECT_TIMEOUT_MS = 6000;

/** Plan what the local player would do, from any snapshot (local or remote). */
export function planFromSnapshot(snap, selfId, target) {
  const me = snap?.players.find(p => p.id === selfId);
  if (!me || !target) return null;
  const othersHeld = snap.players.filter(p => p.id !== selfId && p.held).map(p => p.held);
  return planInteraction(snap.game, me.held, target, {...snap.ctx, othersHeld});
}

export function createLocalKitchen(name) {
  const session = new KitchenSession();
  const selfId = 'me';
  session.join(selfId, name);
  return {
    selfId, online: false, session,
    start: mode => session.start(mode),
    interact: target => session.interact(selfId, target),
    drop: () => session.drop(selfId),
    select: index => session.selectTicket(selfId, index),
    pause: () => session.togglePause(),
    sendPose: pose => session.setPose(selfId, pose),
    update(dt, active) {
      if (active) session.tick(dt);
      return {snap: session.snapshot(), fx: session.drainFx()};
    },
    close() {},
  };
}

/** Connect to the multiplayer server. Resolves once the server welcomes us. */
export function connectRemoteKitchen(name, {onClose} = {}) {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);
  let snap = null, fx = [], selfId = null, poseClock = 0, lastPose = '';
  const send = msg => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); };

  const kitchen = {
    online: true,
    get selfId() { return selfId; },
    start: mode => send({t: 'start', mode}),
    interact: target => send({t: 'interact', target}),
    drop: () => send({t: 'drop'}),
    select: index => send({t: 'select', index}),
    pause: () => send({t: 'pause'}),
    sendPose(pose) {
      const key = `${pose.x.toFixed(2)},${pose.z.toFixed(2)},${pose.yaw.toFixed(2)},${pose.pitch.toFixed(2)}`;
      if (poseClock < POSE_INTERVAL || key === lastPose) return;
      poseClock = 0;
      lastPose = key;
      send({t: 'pose', ...pose});
    },
    update(dt) {
      poseClock += dt;
      const out = {snap, fx};
      fx = [];
      return out;
    },
    close: () => ws.close(),
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error('The kitchen server did not answer. Is `npm start` running?')); ws.close(); }, CONNECT_TIMEOUT_MS);
    ws.addEventListener('open', () => send({t: 'hello', name}));
    ws.addEventListener('message', event => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (error) {
        console.warn('Ignoring malformed server message', error);
        return;
      }
      if (msg.t === 'welcome') { selfId = msg.id; return; }
      if (msg.t === 'full') { clearTimeout(timer); reject(new Error(`The kitchen is full (${msg.maxPlayers} chefs max).`)); return; }
      if (msg.t === 'state') {
        snap = msg.snap;
        fx = [...fx, ...(Array.isArray(msg.fx) ? msg.fx : [])];
        if (selfId) { clearTimeout(timer); resolve(kitchen); }
      }
    });
    ws.addEventListener('close', event => {
      clearTimeout(timer);
      reject(new Error('Could not join the kitchen.'));
      onClose?.(event.reason || 'Disconnected from the kitchen server.');
    });
    ws.addEventListener('error', () => console.warn('WebSocket error while talking to the kitchen server'));
  });
}

/** True when this page is served by the multiplayer server (not a plain static server). */
export async function multiplayerAvailable() {
  try {
    const res = await fetch('/api/info', {cache: 'no-store'});
    if (!res.ok) return null;
    const info = await res.json();
    return info?.multiplayer ? info : null;
  } catch {
    return null;
  }
}
