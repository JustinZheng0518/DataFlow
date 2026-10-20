/** Canvas-texture text for in-world signs, tickets and timers. */
import * as THREE from '../../vendor/three.module.min.js';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function makeCanvasTexture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return {canvas, texture};
}

/** A camera-facing sign whose text can change. update() redraws only on change. */
export function createSign({width = 1, height = .25, bg = 'rgba(33,62,49,.88)', fg = '#fbf7ec', size = 60} = {}) {
  const px = 512, py = Math.round(px * height / width);
  const {canvas, texture} = makeCanvasTexture(px, py);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, transparent: true, depthWrite: false}));
  sprite.scale.set(width, height, 1);
  let current = null;
  const update = (text, colors = {}) => {
    const key = text + (colors.bg ?? '') + (colors.fg ?? '');
    if (key === current) return;
    current = key;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, px, py);
    sprite.visible = Boolean(text);
    if (!text) return;
    ctx.fillStyle = colors.bg ?? bg;
    ctx.beginPath();
    ctx.roundRect(4, 4, px - 8, py - 8, py * .3);
    ctx.fill();
    ctx.fillStyle = colors.fg ?? fg;
    ctx.font = `600 ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, px / 2, py / 2 + 2, px - 24);
    texture.needsUpdate = true;
  };
  return {sprite, update};
}

/** A paper ticket plane. draw(order, recipe, ingredientNames, selected, patienceText). */
export function createTicket() {
  const {canvas, texture} = makeCanvasTexture(320, 400);
  const material = new THREE.MeshBasicMaterial({map: texture});
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.32, .4), material);
  let current = null;
  const draw = ticket => {
    const key = JSON.stringify(ticket);
    if (key === current) return;
    current = key;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 320, 400);
    mesh.visible = Boolean(ticket);
    if (!ticket) return;
    ctx.fillStyle = ticket.selected ? '#fff8d6' : '#fdfbf4';
    ctx.fillRect(0, 0, 320, 400);
    ctx.strokeStyle = ticket.selected ? '#4f7d4a' : '#d9d3c0';
    ctx.lineWidth = ticket.selected ? 14 : 4;
    ctx.strokeRect(0, 0, 320, 400);
    ctx.fillStyle = '#213e31';
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText(`#${String(ticket.id).padStart(3, '0')}   ${ticket.icon}`, 22, 46);
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(ticket.name, 22, 96, 280);
    ctx.font = `400 25px ${FONT}`;
    ticket.ingredients.forEach((line, i) => ctx.fillText(line, 22, 146 + i * 36, 280));
    ctx.font = `600 24px ${FONT}`;
    ctx.fillStyle = ticket.urgent ? '#b4532a' : '#5d7f52';
    ctx.fillText(ticket.patience, 22, 376);
    texture.needsUpdate = true;
  };
  return {mesh, draw};
}
