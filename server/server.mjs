/**
 * Sizzle Kitchen multiplayer server.
 * Serves the static game from dist/ and runs one authoritative KitchenSession that
 * up to four players share over WebSockets (path /ws). Clients send intents; the
 * server validates them, applies the shared rules and broadcasts snapshots.
 *
 *   npm start            # http://localhost:8080, also printed with LAN addresses
 *   PORT=9000 npm start
 */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {WebSocketServer} from 'ws';
import {KitchenSession, MAX_PLAYERS} from '../dist/js/session.js';
import {isValidTarget} from '../dist/js/fps/interactions.js';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const TICK_MS = 50;
const MAX_MESSAGE_BYTES = 2048;
const RATE = {perSecond: 40, burst: 80, maxDropped: 400};
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const log = (msg, extra = {}) => console.log(`[${new Date().toISOString()}] ${msg}`, Object.keys(extra).length ? extra : '');

/** Resolve a URL path inside dist/, refusing anything that escapes it. */
export function resolveStatic(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const full = path.resolve(DIST, relative);
  return full === DIST || full.startsWith(DIST + path.sep) ? full : null;
}

async function handleHttp(req, res, session) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, {Allow: 'GET, HEAD'}).end('Method not allowed');
    return;
  }
  if (req.url.startsWith('/api/info')) {
    res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
    res.end(JSON.stringify({multiplayer: true, players: session.players.size, maxPlayers: MAX_PLAYERS}));
    return;
  }
  const file = resolveStatic(req.url);
  if (!file) {
    res.writeHead(400).end('Bad path');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {'Content-Type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'EISDIR') log('Static file error', {url: req.url, code: error.code});
    res.writeHead(404).end('Not found');
  }
}

/** Token bucket per connection so one client cannot flood the server. */
function createLimiter() {
  let tokens = RATE.burst, last = Date.now(), dropped = 0;
  return {
    allow() {
      const now = Date.now();
      tokens = Math.min(RATE.burst, tokens + (now - last) / 1000 * RATE.perSecond);
      last = now;
      if (tokens >= 1) { tokens -= 1; return true; }
      dropped += 1;
      return false;
    },
    get abusive() { return dropped > RATE.maxDropped; },
  };
}

function parseMessage(raw) {
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  try {
    const msg = JSON.parse(raw.toString());
    return msg && typeof msg === 'object' && typeof msg.t === 'string' ? msg : null;
  } catch {
    return null;
  }
}

/** Apply one validated client message. Unknown or malformed messages are ignored. */
function applyMessage(session, id, msg) {
  switch (msg.t) {
    case 'pose': session.setPose(id, msg); break;
    case 'interact': if (isValidTarget(msg.target)) session.interact(id, msg.target); break;
    case 'drop': session.drop(id); break;
    case 'select': if (Number.isInteger(msg.index) && msg.index >= 0 && msg.index <= 2) session.selectTicket(id, msg.index); break;
    case 'start': session.start(msg.mode === 'shift' ? 'shift' : 'practice'); break;
    case 'pause': session.togglePause(); break;
    default: break;
  }
}

function attachConnection(ws, session, clients) {
  const id = randomUUID().slice(0, 8);
  const limiter = createLimiter();
  let joined = false;
  ws.on('message', raw => {
    if (!limiter.allow()) {
      if (limiter.abusive) ws.close(1008, 'Too many messages');
      return;
    }
    const msg = parseMessage(raw);
    if (!msg) return;
    if (!joined) {
      if (msg.t !== 'hello') return;
      const player = session.join(id, msg.name);
      if (!player) {
        ws.send(JSON.stringify({t: 'full', maxPlayers: MAX_PLAYERS}));
        ws.close(1013, 'Kitchen is full');
        return;
      }
      joined = true;
      clients.set(id, ws);
      ws.send(JSON.stringify({t: 'welcome', id, color: player.color, name: player.name}));
      log('Player joined', {id, name: player.name, players: session.players.size});
      return;
    }
    try {
      applyMessage(session, id, msg);
    } catch (error) {
      log('Failed to apply message', {id, type: msg.t, error: error.message});
    }
  });
  ws.on('close', () => {
    if (!joined) return;
    clients.delete(id);
    session.leave(id);
    log('Player left', {id, players: session.players.size});
    if (session.players.size === 0) session.start('practice');
  });
  ws.on('error', error => log('Socket error', {id, error: error.message}));
}

export function startServer({port = Number(process.env.PORT) || 8080, host = '0.0.0.0', tickMs = TICK_MS} = {}) {
  const session = new KitchenSession();
  const clients = new Map();
  const server = http.createServer((req, res) => {
    handleHttp(req, res, session).catch(error => {
      log('HTTP handler failed', {url: req.url, error: error.message});
      if (!res.headersSent) res.writeHead(500).end('Server error');
    });
  });
  const wss = new WebSocketServer({server, path: '/ws', maxPayload: MAX_MESSAGE_BYTES});
  wss.on('connection', ws => attachConnection(ws, session, clients));

  let last = Date.now();
  const timer = setInterval(() => {
    const now = Date.now();
    const dt = Math.min((now - last) / 1000, .25);
    last = now;
    if (clients.size === 0) return;
    session.tick(dt);
    const message = JSON.stringify({t: 'state', snap: session.snapshot(), fx: session.drainFx()});
    for (const ws of clients.values()) if (ws.readyState === ws.OPEN) ws.send(message);
  }, tickMs);

  return new Promise(resolve => {
    server.listen(port, host, () => {
      const actual = server.address().port;
      resolve({
        port: actual, session,
        close: () => new Promise(done => {
          clearInterval(timer);
          for (const ws of clients.values()) ws.terminate();
          wss.close(() => server.close(() => done()));
        }),
      });
    });
  });
}

function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const {port} = await startServer();
  console.log(`\nSizzle Kitchen is open!\n  This computer:  http://localhost:${port}/fps.html`);
  for (const ip of lanAddresses()) console.log(`  Same Wi-Fi:     http://${ip}:${port}/fps.html`);
  console.log('\nEveryone opens the link, picks "Play together", and cooks in the same kitchen.\n');
}
