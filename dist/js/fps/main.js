/** First-person Sizzle Kitchen: wires renderer, player, kitchen connection, effects and HUD. */
import * as THREE from '../../vendor/three.module.min.js';
import {buildWorld, COLLIDERS, ROOM} from './world.js';
import {createPlayer} from './player.js';
import {createHud} from './hud.js';
import {createSync} from './sync.js';
import {createSound} from './sound.js';
import {createHands} from './hands.js';
import {createParticles} from './particles.js';
import {createTweens} from './tweens.js';
import {createCustomers} from './customers.js';
import {createAvatars} from './avatars.js';
import {createEffects} from './effects.js';
import {createMenu} from './menu.js';
import {createLocalKitchen, connectRemoteKitchen, multiplayerAvailable, planFromSnapshot} from './net.js';

const REACH = 2.4;
const BEST_KEY = 'sizzle-best';
const MESSAGE_SOUNDS = ['ready', 'cook'];
const $ = id => document.getElementById(id);

function createRenderer(canvas) {
  try {
    // ?record keeps the last frame readable so a recorder can copy it into a video.
    const record = new URLSearchParams(location.search).has('record');
    const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: record});
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    return renderer;
  } catch (error) {
    console.error('WebGL renderer could not start', error);
    $('webgl-error').hidden = false;
    $('start').hidden = true;
    return null;
  }
}

/** Walk up from a hit object to the nearest ancestor tagged as interactive. */
function targetOf(object) {
  for (let o = object; o; o = o.parent) if (o.userData.target) return o.userData.target;
  return null;
}

function readBest() {
  try { return Number(localStorage.getItem(BEST_KEY) || 0); } catch { return 0; }
}
function saveBest(value) {
  try { localStorage.setItem(BEST_KEY, String(value)); } catch (error) { console.warn('Could not save best score', error); }
}

function start() {
  const canvas = $('view');
  const renderer = createRenderer(canvas);
  if (!renderer) return;
  const world = buildWorld();
  const camera = new THREE.PerspectiveCamera(70, 1, .05, 80);
  world.scene.add(camera);
  const hands = createHands(camera);
  const player = createPlayer(camera, {colliders: COLLIDERS, room: ROOM, element: canvas});
  const hud = createHud();
  const sound = createSound();
  const particles = createParticles(world.scene);
  const tweens = createTweens();
  const sync = createSync(world, hands, particles);
  const customers = createCustomers(world.scene, world.pass);
  const avatars = createAvatars(world.scene);
  const effects = createEffects({world, hands, particles, tweens, sound, customers, avatars, hud});
  const raycaster = new THREE.Raycaster();
  raycaster.far = REACH;
  const center = new THREE.Vector2(0, 0);

  let kitchen = null, snap = null, current = null, prevHeld = null, lastMessage = '';
  let summaryShown = false, best = readBest(), forceLock = false;
  const debug = new URLSearchParams(location.search).has('debug');
  const locked = () => forceLock || document.pointerLockElement === canvas;
  const selfOf = s => s?.players.find(p => p.id === kitchen?.selfId) ?? null;

  const lookTarget = () => {
    raycaster.setFromCamera(center, camera);
    const hit = raycaster.intersectObjects(world.scene.children, true).find(h => h.object.visible);
    return hit ? targetOf(hit.object) : null;
  };
  const lock = () => {
    const request = canvas.requestPointerLock?.();
    request?.catch?.(error => { console.warn('Pointer lock was refused', error); onLockLost(); });
  };
  const resetView = () => {
    summaryShown = false;
    prevHeld = null;
    hud.resetCache();
    customers.reset();
    avatars.clear();
  };

  /** Solo pauses the clock; online the shared kitchen keeps running. */
  function onLockLost() {
    if (!kitchen || locked() || menu.isOpen('summary') || menu.isOpen('start')) return;
    const s = snap?.game;
    if (!kitchen.online && s && !s.paused && !s.ended) kitchen.pause();
    menu.showPaused({online: kitchen.online, kitchenPaused: Boolean(s?.paused), players: snap?.players.length ?? 1});
  }

  const enter = () => {
    menu.hideAll();
    sound.unlock();
    lock();
  };
  const menu = createMenu({
    onSolo(mode, name) {
      kitchen?.close();
      resetView();
      kitchen = createLocalKitchen(name);
      kitchen.start(mode);
      player.reset();
      enter();
    },
    async onJoin(name) {
      kitchen?.close();
      kitchen = null;
      resetView();
      const remote = await connectRemoteKitchen(name, {onClose: reason => {
        if (kitchen !== remote) return;
        kitchen = null;
        if (document.pointerLockElement) document.exitPointerLock();
        menu.showStart();
        menu.setError(reason);
      }});
      kitchen = remote;
      const me = selfOf(remote.update(0).snap);
      player.reset();
      if (me) player.place({x: me.x, z: me.z});
      enter();
    },
    onResume() {
      if (kitchen && !kitchen.online && snap?.game.paused) kitchen.pause();
      enter();
    },
    onRestart(mode) {
      if (!kitchen) return;
      resetView();
      kitchen.start(mode);
      enter();
    },
    onTogglePause() {
      kitchen?.pause();
      setTimeout(() => menu.showPaused({online: true, kitchenPaused: Boolean(snap?.game.paused), players: snap?.players.length ?? 1}), 150);
    },
    onLeave() {
      kitchen?.close();
      kitchen = null;
      snap = null;
      resetView();
      menu.showStart();
    },
  });
  multiplayerAvailable().then(info => menu.setTogether(info));

  document.addEventListener('pointerlockchange', () => {
    if (!locked()) onLockLost();
  });
  document.addEventListener('pointerlockerror', onLockLost);
  // Re-plan at input time so two inputs in one frame never reuse a stale plan.
  const interact = () => {
    if (!kitchen || !snap) return;
    const target = lookTarget();
    const plan = planFromSnapshot(snap, kitchen.selfId, target);
    if (plan?.enabled) kitchen.interact(target);
  };
  canvas.addEventListener('mousedown', e => {
    if (!locked()) { if (kitchen && menu.isOpen('paused')) lock(); return; }
    if (e.button === 0) interact();
  });
  window.addEventListener('keydown', e => {
    if (!locked() || e.repeat || !kitchen) return;
    if (e.code === 'KeyE') interact();
    if (e.code === 'KeyQ') kitchen.drop();
    if (/^Digit[1-3]$/.test(e.code)) kitchen.select(Number(e.code.slice(5)) - 1);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && document.pointerLockElement) document.exitPointerLock();
  });

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  function finishShift(s) {
    summaryShown = true;
    best = Math.max(best, s.score);
    saveBest(best);
    hud.showSummary(s, best);
    menu.showSummary();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function frameWithKitchen(dt, time) {
    const localActive = locked() && !snap?.game.paused && !snap?.game.ended;
    const update = kitchen.update(dt, localActive);
    if (update.snap) snap = update.snap;
    const canMove = Boolean(locked() && snap && !snap.game.paused && !snap.game.ended);
    const {speed, step} = player.update(dt, canMove);
    if (step) sound.play('step');
    if (canMove) kitchen.sendPose(player.pose());
    hands.update(dt, speed);
    if (!snap) return;
    effects.handle(update.fx, snap, kitchen.selfId, prevHeld);
    prevHeld = selfOf(snap)?.held ?? null;
    current = canMove ? planFromSnapshot(snap, kitchen.selfId, lookTarget()) : null;
    const s = snap.game, key = `${s.event}|${s.message}`;
    if (key !== lastMessage) {
      lastMessage = key;
      if (MESSAGE_SOUNDS.includes(s.event)) sound.play(s.event);
    }
    sync(snap, kitchen.selfId, time, dt);
    customers.update(snap, dt);
    avatars.update(snap, kitchen.selfId, dt);
    sound.ambience({sizzle: s.grill && !s.grill.burned ? 1 : 0, fire: snap.ctx?.fire ? 1 : 0});
    hud.render(snap, kitchen.selfId, current, kitchen.online);
    if (s.ended && !summaryShown) finishShift(s);
    if (!s.ended) summaryShown = false;
  }

  let last = performance.now();
  renderer.setAnimationLoop(now => {
    const dt = Math.min((now - last) / 1000, .1);
    last = now;
    try {
      if (kitchen) frameWithKitchen(dt, now / 1000);
      else { player.update(dt, false); sound.ambience({}); }
      particles.update(dt);
      tweens.update(dt);
      effects.update(dt);
      renderer.render(world.scene, camera);
    } catch (error) {
      console.error('Frame failed', error);
    }
  });

  if (debug) {
    window.sizzle = {
      get kitchen() { return kitchen; },
      get snap() { return snap; },
      lookTarget, interact, place: player.place, prompt: () => current?.label ?? null,
      setForceLock: value => { forceLock = value; },
    };
  }
}

start();
