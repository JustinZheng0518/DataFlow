/** Lightweight sprite particles: steam, smoke, fire, sparks and extinguisher foam. */
import * as THREE from '../../vendor/three.module.min.js';

const MAX_PARTICLES = 400;

function softTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(.4, 'rgba(255,255,255,.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const KINDS = {
  steam: {color: 0xffffff, opacity: .35, size: [.08, .35], life: [1.2, 2], rise: .35, spread: .08, additive: false},
  smoke: {color: 0x3a3632, opacity: .55, size: [.15, .7], life: [1.5, 2.6], rise: .45, spread: .15, additive: false},
  fire: {color: 0xff7a1a, opacity: .9, size: [.18, .04], life: [.4, .8], rise: .9, spread: .12, additive: true},
  ember: {color: 0xffd24a, opacity: 1, size: [.03, .01], life: [.5, 1], rise: 1.2, spread: .3, additive: true},
  foam: {color: 0xf4f6f8, opacity: .9, size: [.12, .3], life: [.6, 1.1], rise: -.2, spread: .35, additive: false},
  sparkle: {color: 0xfff1a8, opacity: 1, size: [.06, .01], life: [.5, .9], rise: .6, spread: .35, additive: true},
};

export function createParticles(scene) {
  const texture = softTexture();
  const materials = {};
  for (const [name, k] of Object.entries(KINDS)) {
    materials[name] = new THREE.SpriteMaterial({map: texture, color: k.color, transparent: true, depthWrite: false, blending: k.additive ? THREE.AdditiveBlending : THREE.NormalBlending});
  }
  const live = [];
  const pool = [];

  function emit(kind, position, count = 1, velocity = null) {
    const k = KINDS[kind];
    for (let i = 0; i < count && live.length < MAX_PARTICLES; i++) {
      const sprite = pool.pop() ?? new THREE.Sprite();
      sprite.material = materials[kind].clone();
      sprite.raycast = () => {};
      sprite.position.set(position.x + (Math.random() - .5) * k.spread, position.y, position.z + (Math.random() - .5) * k.spread);
      const life = k.life[0] + Math.random() * (k.life[1] - k.life[0]);
      const v = velocity
        ? velocity.clone().add(new THREE.Vector3((Math.random() - .5) * k.spread * 2, (Math.random() - .5) * k.spread, (Math.random() - .5) * k.spread * 2))
        : new THREE.Vector3((Math.random() - .5) * .1, k.rise * (.7 + Math.random() * .6), (Math.random() - .5) * .1);
      live.push({sprite, kind: k, age: 0, life, v});
      scene.add(sprite);
    }
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        scene.remove(p.sprite);
        p.sprite.material.dispose();
        pool.push(p.sprite);
        live.splice(i, 1);
        continue;
      }
      p.sprite.position.addScaledVector(p.v, dt);
      const [s0, s1] = p.kind.size;
      p.sprite.scale.setScalar(s0 + (s1 - s0) * t);
      p.sprite.material.opacity = p.kind.opacity * (1 - t) * Math.min(1, t * 6);
    }
  }

  return {emit, update};
}
