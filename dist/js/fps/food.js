/** Low-poly food meshes built from primitives. View-only: never touches game state. */
import * as THREE from '../../vendor/three.module.min.js';

const COLORS = {
  dough: 0xecd29b, doughBaked: 0xd59a52, burnt: 0x3d2a1f, sauce: 0xc2402c, mozzarella: 0xf7ebc4,
  pepperoni: 0xa8322a, mushroom: 0xcdb89a, bun: 0xd9994f, patty: 0x6b3d24, rawPatty: 0xd98282,
  cheese: 0xf2be2c, lettuce: 0x6cab4c, tomato: 0xd8432e,
};
const materials = new Map();
const mat = color => {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({color, roughness: .75}));
  return materials.get(color);
};
const disc = (radius, height, color, y = 0) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 28), mat(color));
  mesh.position.y = y + height / 2;
  mesh.castShadow = true;
  return mesh;
};
const scatter = (group, count, radius, color, y, size) => {
  for (let i = 0; i < count; i++) {
    const a = i * 2.399, r = radius * Math.sqrt((i + .5) / count);
    const bit = disc(size, .008, color, y);
    bit.position.x = Math.cos(a) * r;
    bit.position.z = Math.sin(a) * r;
    group.add(bit);
  }
};

export function buildPizza({ingredients = [], cooked = false, burned = false} = {}) {
  const group = new THREE.Group();
  const has = id => ingredients.includes(id);
  if (!has('dough')) return group;
  group.add(disc(.2, .025, burned ? COLORS.burnt : cooked ? COLORS.doughBaked : COLORS.dough));
  if (has('sauce')) group.add(disc(.175, .006, burned ? COLORS.burnt : COLORS.sauce, .025));
  if (has('mozzarella')) group.add(disc(.16, .006, burned ? COLORS.burnt : cooked ? 0xf3d68a : COLORS.mozzarella, .031));
  if (has('pepperoni')) scatter(group, 7, .12, COLORS.pepperoni, .037, .028);
  if (has('mushroom')) scatter(group, 8, .125, COLORS.mushroom, .037, .022);
  return group;
}

const BURGER_LAYERS = {
  bunBottom: [.11, .035, COLORS.bun], patty: [.115, .03, COLORS.patty], cheese: [.12, .008, COLORS.cheese],
  lettuce: [.125, .012, COLORS.lettuce], tomato: [.1, .012, COLORS.tomato],
};

export function buildBurger({ingredients = []} = {}) {
  const group = new THREE.Group();
  let y = 0;
  for (const id of ingredients) {
    if (id === 'bunTop') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(.11, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(COLORS.bun));
      dome.scale.y = .6;
      dome.position.y = y;
      group.add(dome);
      y += .066;
      continue;
    }
    const [radius, height, color] = BURGER_LAYERS[id];
    group.add(disc(radius, height, color, y));
    y += height;
  }
  return group;
}

/** A single carried or crated item. */
export function buildItem(id) {
  switch (id) {
    case 'dough': return disc(.09, .04, COLORS.dough);
    case 'sauce': {
      const can = disc(.045, .1, COLORS.sauce);
      can.add(disc(.046, .02, 0xdddddd, .02));
      return can;
    }
    case 'mozzarella': return new THREE.Mesh(new THREE.SphereGeometry(.05, 16, 12), mat(COLORS.mozzarella));
    case 'pepperoni': return disc(.05, .012, COLORS.pepperoni);
    case 'mushroom': {
      const g = new THREE.Group();
      g.add(disc(.015, .04, 0xeee3cc));
      const cap = new THREE.Mesh(new THREE.SphereGeometry(.04, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(COLORS.mushroom));
      cap.position.y = .035;
      g.add(cap);
      return g;
    }
    case 'bunBottom': return disc(.11, .035, COLORS.bun);
    case 'bunTop': return buildBurger({ingredients: ['bunTop']});
    case 'patty': return disc(.115, .03, COLORS.patty);
    case 'rawPatty': return disc(.115, .03, COLORS.rawPatty);
    case 'cheese': {
      const slice = new THREE.Mesh(new THREE.BoxGeometry(.16, .008, .16), mat(COLORS.cheese));
      slice.rotation.y = Math.PI / 4;
      return slice;
    }
    case 'lettuce': return disc(.12, .015, COLORS.lettuce);
    case 'tomato': return new THREE.Mesh(new THREE.SphereGeometry(.055, 16, 12), mat(COLORS.tomato));
    default: return new THREE.Group();
  }
}

/** Patty on the griddle shifts from raw pink to brown, then to charcoal when burnt. */
export function pattyColor(progress, burned) {
  if (burned) return new THREE.Color(COLORS.burnt);
  return new THREE.Color(COLORS.rawPatty).lerp(new THREE.Color(COLORS.patty), Math.min(1, progress));
}

/** Dispose geometry of a rebuilt food group. Materials are shared and kept. */
export function disposeGroup(group) {
  group.traverse(o => o.geometry?.dispose());
}

const plateMaterial = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: .4});

/** A finished dish on a white plate: {type, ingredients, cooked, burned}. */
export function buildPlated(dish) {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(.24, .2, .02, 32), plateMaterial);
  plate.castShadow = true;
  g.add(plate);
  const food = dish?.type === 'burger' ? buildBurger(dish) : buildPizza(dish ?? {});
  food.position.y = .02;
  g.add(food);
  return g;
}
