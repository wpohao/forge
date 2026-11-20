// 浮空島地形：起伏草地、石板小路、池塘與流向島邊的水道、分層岩壁與懸垂岩塊。
import * as THREE from 'three';
import { fbm, smoothstep } from './noise.js';

export const ISLAND_R = 9.2;
export const POND = { x: 5.0, z: -3.9, r: 1.45 };
const POND_DIR = new THREE.Vector2(POND.x, POND.z).normalize();

// 小路：門口 → 島邊（折線）
export const PATH = [
  new THREE.Vector2(0, 1.9), new THREE.Vector2(0.3, 3.6), new THREE.Vector2(1.2, 5.4),
  new THREE.Vector2(2.0, 7.0), new THREE.Vector2(2.4, 8.4),
];

export function edgeRadius(theta) {
  return ISLAND_R * (0.9 + 0.2 * fbm(Math.cos(theta) * 1.3 + 7, Math.sin(theta) * 1.3 + 7, 3));
}

export function distToPath(x, z) {
  let best = Infinity;
  const p = new THREE.Vector2(x, z);
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i];
    const b = PATH[i + 1];
    const ab = b.clone().sub(a);
    const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq()));
    best = Math.min(best, p.distanceTo(a.clone().add(ab.multiplyScalar(t))));
  }
  return best;
}

// 建築與前院要平整
export function inYard(x, z, pad = 0) {
  return x > -3.6 - pad && x < 5.6 + pad && z > -3.4 - pad && z < 3.2 + pad;
}

function streamMask(x, z) {
  // 池塘到島邊的水道（沿 POND_DIR 方向）
  const along = x * POND_DIR.x + z * POND_DIR.y;
  const across = Math.abs(-x * POND_DIR.y + z * POND_DIR.x);
  const start = Math.hypot(POND.x, POND.z);
  if (along < start) return 0;
  return 1 - smoothstep(0.25, 0.55, across);
}

export function heightAt(x, z) {
  let h = 0.85 * (fbm(x * 0.16 + 3, z * 0.16 + 11) - 0.45) + 0.35 * (fbm(x * 0.5, z * 0.5) - 0.5);
  h = Math.max(h, -0.15);
  // 島的北側（後方）稍微隆起成小丘
  h += 0.7 * smoothstep(1.5, 7, -z) * smoothstep(9, 4, Math.abs(x + 2));
  const yard = inYard(x, z) ? 1 : 1 - smoothstep(0, 1.6, Math.max(-3.6 - x, x - 5.6, -3.4 - z, z - 3.2));
  h *= 1 - yard;
  const path = 1 - smoothstep(0.55, 1.3, distToPath(x, z));
  h = h * (1 - path) + 0.02 * path;
  const pd = Math.hypot(x - POND.x, z - POND.z);
  h -= 0.55 * (1 - smoothstep(POND.r - 0.4, POND.r + 0.5, pd));
  h -= 0.45 * streamMask(x, z);
  return h;
}

const C = {
  grassA: new THREE.Color('#6f9e4c'), grassB: new THREE.Color('#8db35a'), grassC: new THREE.Color('#5a8a3f'),
  path: new THREE.Color('#b59468'), sand: new THREE.Color('#cdb27f'), lip: new THREE.Color('#4f7a34'),
  dirt: new THREE.Color('#7a5236'), dirt2: new THREE.Color('#5f3f2a'), rock: new THREE.Color('#6d655c'), rock2: new THREE.Color('#4d4740'),
};

const _ab = new THREE.Vector3();
const _ac = new THREE.Vector3();
// 依期望朝向自動修正繞序（top：朝上；side：朝外），避免背面剔除把面吃掉
function pushTri(pos, col, a, b, c, color, mode = 'top') {
  _ab.subVectors(b, a);
  _ac.subVectors(c, a);
  const n = _ab.cross(_ac);
  const want = mode === 'top' ? n.y : n.x * (a.x + b.x + c.x) + n.z * (a.z + b.z + c.z) - (mode === 'tip' ? 0 : 0);
  if (want < 0) { const t = b; b = c; c = t; }
  pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < 3; i++) col.push(color.r, color.g, color.b);
}

export function buildTerrainGeometry() {
  const RINGS = 30;
  const SEG = 96;
  const pos = [];
  const col = [];
  const grid = [];
  for (let i = 0; i <= RINGS; i++) {
    const row = [];
    for (let j = 0; j < SEG; j++) {
      const th = (j / SEG) * Math.PI * 2;
      const R = edgeRadius(th);
      const r = (i / RINGS) * R;
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      row.push(new THREE.Vector3(x, heightAt(x, z), z));
    }
    grid.push(row);
  }
  const center = new THREE.Vector3(0, heightAt(0, 0), 0);
  const faceColor = (a, b, c) => {
    const cx = (a.x + b.x + c.x) / 3;
    const cz = (a.z + b.z + c.z) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    if (distToPath(cx, cz) < 0.75) return C.path.clone().lerp(C.sand, fbm(cx * 2, cz * 2) * 0.5);
    const pd = Math.hypot(cx - POND.x, cz - POND.z);
    if (pd < POND.r + 0.55 || (streamMask(cx, cz) > 0.3)) return C.sand;
    const n = fbm(cx * 0.35 + 9, cz * 0.35 + 2);
    const base = n < 0.45 ? C.grassC.clone().lerp(C.grassA, n / 0.45) : C.grassA.clone().lerp(C.grassB, (n - 0.45) / 0.55);
    return base.offsetHSL(0, 0, cy * 0.04 + (fbm(cx * 3, cz * 3) - 0.5) * 0.03);
  };
  for (let j = 0; j < SEG; j++) {
    const j2 = (j + 1) % SEG;
    pushTri(pos, col, center, grid[1][j2], grid[1][j], faceColor(center, grid[1][j2], grid[1][j]));
    for (let i = 1; i < RINGS; i++) {
      const a = grid[i][j];
      const b = grid[i][j2];
      const c = grid[i + 1][j];
      const d = grid[i + 1][j2];
      pushTri(pos, col, a, b, c, faceColor(a, b, c));
      pushTri(pos, col, b, d, c, faceColor(b, d, c));
    }
  }

  // 側邊：草皮唇緣 → 泥土層 → 岩層，往下收成倒錐，帶分層色帶
  const LAYERS = [
    { dy: 0.28, k: 1.0, color: () => C.lip },
    { dy: 0.9, k: 0.98, color: (n) => C.dirt.clone().lerp(C.dirt2, n) },
    { dy: 1.6, k: 0.9, color: (n) => C.dirt2.clone().lerp(C.rock, n) },
    { dy: 2.6, k: 0.74, color: (n) => C.rock.clone().lerp(C.rock2, n) },
    { dy: 3.8, k: 0.55, color: (n) => C.rock2.clone().lerp(C.rock, n) },
    { dy: 5.2, k: 0.34, color: (n) => C.rock.clone().lerp(C.dirt2, n * 0.5) },
    { dy: 6.8, k: 0.14, color: (n) => C.rock2.clone().lerp(C.rock, n) },
  ];
  let prev = grid[RINGS];
  let prevY = prev.map((v) => v.y);
  for (const L of LAYERS) {
    const ring = [];
    for (let j = 0; j < SEG; j++) {
      const th = (j / SEG) * Math.PI * 2;
      const jit = fbm(Math.cos(th) * 3 + L.dy, Math.sin(th) * 3 + L.dy, 2);
      const R = edgeRadius(th) * L.k * (0.92 + 0.16 * jit);
      ring.push(new THREE.Vector3(Math.cos(th) * R, -L.dy - jit * 0.5 * L.dy * 0.3, Math.sin(th) * R));
    }
    for (let j = 0; j < SEG; j++) {
      const j2 = (j + 1) % SEG;
      const n = fbm(j * 0.4, L.dy, 2);
      const color = L.color(n);
      pushTri(pos, col, prev[j], ring[j], prev[j2], color, 'side');
      pushTri(pos, col, prev[j2], ring[j], ring[j2], color.clone().offsetHSL(0, 0, -0.02), 'side');
    }
    prev = ring;
    prevY = ring.map((v) => v.y);
  }
  const tip = new THREE.Vector3(0.3, -9.2, -0.2);
  for (let j = 0; j < SEG; j++) {
    pushTri(pos, col, prev[j], tip, prev[(j + 1) % SEG], C.rock2, 'side');
  }
  void prevY;

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export function randomPointOnIsland(rng, margin = 0.9) {
  const th = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * (edgeRadius(th) - margin);
  const x = Math.cos(th) * r;
  const z = Math.sin(th) * r;
  return { x, z, y: heightAt(x, z) };
}
