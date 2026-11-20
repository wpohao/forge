// 鐵匠鋪建築：石砌地基、木骨架灰泥牆、石板瓦屋頂、石砌煙囪、亮窗、側邊開放式打鐵棚。
import * as THREE from 'three';
import { T, jitter } from './batch.js';
import { G, COL, anvil, stump, waterBarrel, hammer, barrel, crate, R } from './kit.js';

const W = 5.2;
const D = 4.0;
const BASE = 0.5;
const WALL_H = 2.6;
const TOP = BASE + WALL_H;
const RISE = 1.9;
const SLATE = ['#4c5160', '#5a5f6e', '#3f4350', '#535868'];

function tri(a, b, c) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...b], 3));
  return g;
}

function stoneCourse(b, rng, M, x0, x1, z, y, h, alongZ = false) {
  let x = x0;
  while (x < x1 - 0.05) {
    const w = Math.min(0.35 + rng() * 0.4, x1 - x);
    const cx = x + w / 2;
    const m = alongZ ? T(z, y, cx, 0, 0, 0, 0.14, h * 0.92, w * 0.94) : T(cx, y, z, 0, 0, 0, w * 0.94, h * 0.92, 0.14);
    b.stat.add(G.box, jitter(rng() > 0.5 ? COL.stone : COL.stoneDark, rng, 0.1), m, M);
    x += w;
  }
}

function windowAt(b, rng, M) {
  // M：窗戶中心、朝 +z
  b.warm.add(G.box, '#ffffff', T(0, 0, 0, 0, 0, 0, 0.78, 0.72, 0.04), M);
  const d = COL.woodDark;
  b.stat.add(G.box, d, T(0, 0.4, 0.04, 0, 0, 0, 0.96, 0.1, 0.1), M);
  b.stat.add(G.box, d, T(0, -0.4, 0.06, 0, 0, 0, 1.05, 0.1, 0.18), M);
  for (const x of [-0.44, 0.44]) b.stat.add(G.box, d, T(x, 0, 0.04, 0, 0, 0, 0.09, 0.8, 0.1), M);
  b.stat.add(G.box, d, T(0, 0, 0.05, 0, 0, 0, 0.05, 0.72, 0.05), M);
  b.stat.add(G.box, d, T(0, 0, 0.05, 0, 0, 0, 0.78, 0.05, 0.05), M);
  for (const s of [-1, 1]) {
    b.stat.add(G.box, jitter('#6e4a2c', rng), T(s * 0.72, 0, 0.18, 0, s * 0.5, 0, 0.42, 0.78, 0.05), M);
  }
  // 花台
  b.stat.add(G.box, jitter(COL.plank, rng), T(0, -0.55, 0.2, 0, 0, 0, 0.9, 0.18, 0.24), M);
  const petals = ['#e85d5d', '#f2c94c', '#f4f1e8', '#b98ad8'];
  for (let i = 0; i < 5; i++) {
    b.stat.add(G.ico0, jitter('#5f9a3e', rng), T(-0.35 + i * 0.175, -0.42, 0.2, 0, 0, 0, 0.16), M);
    b.stat.add(G.oct, petals[i % petals.length], T(-0.35 + i * 0.175, -0.32, 0.22, 0, rng(), 0, 0.09), M);
  }
}

export function buildForgeHouse(b, rng, M, doorMaterial) {
  const hw = W / 2;
  const hd = D / 2;

  // 地基：整塊 + 外露石塊
  b.stat.add(G.box, COL.stoneDark, T(0, BASE / 2, 0, 0, 0, 0, W + 0.3, BASE, D + 0.3), M);
  for (const s of [-1, 1]) {
    stoneCourse(b, rng, M, -hw - 0.1, hw + 0.1, s * (hd + 0.17), 0.13, 0.26);
    stoneCourse(b, rng, M, -hw - 0.1, hw + 0.1, s * (hd + 0.17), 0.38, 0.24);
    stoneCourse(b, rng, M, -hd - 0.1, hd + 0.1, s * (hw + 0.17), 0.13, 0.26, true);
    stoneCourse(b, rng, M, -hd - 0.1, hd + 0.1, s * (hw + 0.17), 0.38, 0.24, true);
  }

  // 牆身
  b.stat.add(G.box, COL.plaster, T(0, BASE + WALL_H / 2, 0, 0, 0, 0, W, WALL_H, D), M);
  const beam = COL.woodDark;
  // 直柱
  for (const zs of [-1, 1]) {
    for (const x of [-hw, -hw * 0.45, hw * 0.45, hw]) b.stat.add(G.box, beam, T(x, BASE + WALL_H / 2, zs * (hd + 0.03), 0, 0, 0, 0.2, WALL_H, 0.1), M);
  }
  for (const xs of [-1, 1]) {
    for (const z of [-hd, 0, hd]) b.stat.add(G.box, beam, T(xs * (hw + 0.03), BASE + WALL_H / 2, z, 0, 0, 0, 0.1, WALL_H, 0.2), M);
  }
  // 橫樑
  for (const y of [BASE + 0.08, BASE + 1.25, TOP - 0.08]) {
    for (const zs of [-1, 1]) b.stat.add(G.box, beam, T(0, y, zs * (hd + 0.04), 0, 0, 0, W + 0.1, 0.16, 0.1), M);
    for (const xs of [-1, 1]) b.stat.add(G.box, beam, T(xs * (hw + 0.04), y, 0, 0, 0, 0, 0.1, 0.16, D + 0.1), M);
  }
  // 斜撐（前後牆兩側面板）
  const brace = Math.atan2(1.1, hw * 0.55);
  for (const zs of [-1, 1]) {
    for (const xs of [-1, 1]) {
      b.stat.add(G.box, beam, T(xs * hw * 0.72, BASE + 0.67, zs * (hd + 0.05), 0, 0, xs * brace, 1.6, 0.12, 0.08), M);
    }
  }

  // 門：門框、遮雨棚、半開門板、發光門洞（獨立 mesh，可點擊）
  const doorY = BASE + 0.95;
  for (const x of [-0.6, 0.6]) b.stat.add(G.box, beam, T(x, doorY, hd + 0.07, 0, 0, 0, 0.16, 1.9, 0.14), M);
  b.stat.add(G.box, beam, T(0, BASE + 1.95, hd + 0.07, 0, 0, 0, 1.4, 0.18, 0.16), M);
  const A = 1.15;
  b.stat.add(G.box, jitter('#6e4a2c', rng), T(-0.5 + Math.cos(A) * 0.5, doorY, hd + 0.08 + Math.sin(A) * 0.5, 0, -A, 0, 1.0, 1.8, 0.08), M);
  for (const s of [-1, 1]) b.stat.add(G.box, beam, T(s * 0.55, BASE + 2.25, hd + 0.35, -0.6, 0, 0, 0.08, 0.08, 0.7), M);
  b.stat.add(G.box, jitter(SLATE[0], rng), T(0, BASE + 2.45, hd + 0.4, 0.45, 0, 0, 1.6, 0.08, 0.85), M);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.04, 1.85, 0.05), doorMaterial);
  door.position.set(0, doorY, hd + 0.02).applyMatrix4(M);
  door.userData.key = 'door';

  // 窗
  for (const x of [-1.6, 1.6]) windowAt(b, rng, R(M, T(x, BASE + 1.45, hd + 0.04)));
  windowAt(b, rng, R(M, T(-hw - 0.04, BASE + 1.45, -0.4, 0, -Math.PI / 2, 0)));
  windowAt(b, rng, R(M, T(-hw - 0.04, BASE + 1.45, 1.2, 0, -Math.PI / 2, 0)));

  // 屋頂：兩片斜板 + 一片片石板瓦 + 屋脊
  const ohd = hd + 0.4;
  const slope = Math.atan2(RISE, ohd);
  const L = Math.hypot(RISE, ohd) + 0.05;
  for (const s of [-1, 1]) {
    const plane = R(M, T(0, TOP + RISE / 2, (s * ohd) / 2, s * slope, 0, 0));
    b.stat.add(G.box, COL.woodDark, T(0, 0, 0, 0, 0, 0, W + 0.9, 0.1, L), plane);
    const rows = 9;
    for (let r = 0; r < rows; r++) {
      const u = -L / 2 + 0.2 + (r / rows) * (L - 0.15);
      const off = (r % 2) * 0.24;
      for (let x = -(W + 0.9) / 2 + 0.24 + off; x < (W + 0.9) / 2 - 0.1; x += 0.48) {
        const c = jitter(SLATE[Math.floor(rng() * SLATE.length)], rng, 0.06);
        b.stat.add(G.box, c, T(x, 0.08 + r * 0.004, s * u, (rng() - 0.5) * 0.06 - s * 0.08, 0, (rng() - 0.5) * 0.06, 0.46, 0.05, 0.42), plane);
      }
    }
  }
  b.stat.add(G.box, '#34373f', T(0, TOP + RISE + 0.05, 0, Math.PI / 4, 0, 0, W + 1.0, 0.28, 0.28), M);
  // 山牆
  for (const xs of [-1, 1]) {
    const x = xs * hw;
    b.stat.add(tri([x, TOP, -hd], [x, TOP, hd], [x, TOP + RISE - 0.05, 0]), COL.plaster, new THREE.Matrix4(), M);
    b.stat.add(G.box, beam, T(x + xs * 0.03, TOP + RISE / 2 - 0.05, 0, 0, 0, 0, 0.1, RISE - 0.1, 0.16), M);
    for (const zs of [-1, 1]) {
      b.stat.add(G.box, beam, T(x + xs * 0.04, TOP + RISE / 2 - 0.05, zs * hd / 2, -zs * Math.atan2(RISE, hd), 0, 0, 0.1, 0.14, Math.hypot(RISE, hd)), M);
    }
    // 山牆小圓窗
    b.warm.add(G.cyl8, '#ffffff', T(x + xs * 0.06, TOP + 0.7, 0, 0, 0, Math.PI / 2, 0.42, 0.04, 0.42), M);
    b.stat.add(G.cyl8, beam, T(x + xs * 0.07, TOP + 0.7, 0, 0, 0, Math.PI / 2, 0.06, 0.06, 0.46), M);
  }

  // 煙囪（從後側屋頂穿出）
  const cx = 1.45;
  const cz = -1.25;
  let y = TOP - 0.4;
  let row = 0;
  while (y < TOP + RISE + 1.4) {
    const h = 0.22;
    const off = (row % 2) * 0.1;
    for (const [dx, dz, w, d] of [[0, -0.42, 0.95, 0.16], [0, 0.42, 0.95, 0.16], [-0.42, 0, 0.16, 0.7], [0.42, 0, 0.16, 0.7]]) {
      b.stat.add(G.box, jitter(rng() > 0.4 ? COL.stone : COL.stoneDark, rng, 0.12), T(cx + dx + (dz ? off - 0.05 : 0), y, cz + dz, 0, 0, 0, w, h * 0.94, d), M);
    }
    y += h;
    row++;
  }
  b.stat.add(G.box, COL.stoneDark, T(cx, y + 0.06, cz, 0, 0, 0, 1.15, 0.14, 1.15), M);
  b.stat.add(G.box, '#1c1714', T(cx, y + 0.1, cz, 0, 0, 0, 0.6, 0.06, 0.6), M);
  const chimneyTop = new THREE.Vector3(cx, y + 0.25, cz).applyMatrix4(M);

  // 掛招牌（左前角）
  b.stat.add(G.box, beam, T(-hw - 0.1, BASE + 2.35, hd + 0.45, 0, 0, 0, 0.08, 0.08, 0.9), M);
  for (const z of [0.6, 0.95]) b.stat.add(G.box, COL.ironDark, T(-hw - 0.1, BASE + 2.2, hd + z, 0, 0, 0, 0.02, 0.3, 0.02), M);
  b.stat.add(G.box, jitter(COL.woodLight, rng), T(-hw - 0.1, BASE + 1.85, hd + 0.78, 0, 0, 0, 0.06, 0.55, 0.75), M);
  anvil(b, rng, R(M, T(-hw - 0.15, BASE + 1.72, hd + 0.78, 0, Math.PI / 2, 0, 0.42)));

  // ---------- 側邊打鐵棚（+x 側） ----------
  const sx0 = hw;
  const sx1 = hw + 2.7;
  const sz0 = -1.9;
  const sz1 = 1.7;
  const roofHi = TOP - 0.1;
  const roofLo = 2.3;
  for (const [x, z] of [[sx1, sz0], [sx1, sz1], [sx1, (sz0 + sz1) / 2]]) {
    const h = roofLo;
    b.stat.add(G.box, beam, T(x - 0.1, h / 2, z, 0, 0, 0, 0.2, h, 0.2), M);
    b.stat.add(G.box, COL.stoneDark, T(x - 0.1, 0.1, z, 0, 0, 0, 0.36, 0.2, 0.36), M);
  }
  b.stat.add(G.box, beam, T(sx1 - 0.1, roofLo - 0.08, (sz0 + sz1) / 2, 0, 0, 0, 0.18, 0.18, sz1 - sz0 + 0.3), M);
  const lean = Math.atan2(roofHi - roofLo, sx1 - sx0);
  const leanLen = Math.hypot(roofHi - roofLo, sx1 - sx0) + 0.4;
  const leanM = R(M, T((sx0 + sx1) / 2 + 0.1, (roofHi + roofLo) / 2 + 0.08, (sz0 + sz1) / 2, 0, 0, -lean));
  for (let z = sz0 - 0.2; z < sz1 + 0.2; z += 0.36) {
    b.stat.add(G.box, jitter(COL.plank, rng, 0.1), T(0, 0, z - (sz0 + sz1) / 2, 0, 0, 0, leanLen, 0.08, 0.34), leanM);
  }
  for (const z of [sz0, sz1]) b.stat.add(G.box, beam, T(0, -0.1, z - (sz0 + sz1) / 2, 0, 0, 0, leanLen, 0.14, 0.14), leanM);

  // 熔爐：石砌爐台 + 爐火 + 爐罩 + 煙管
  const fx = hw + 1.55;
  const fz = -1.05;
  for (let r = 0; r < 4; r++) {
    stoneCourse(b, rng, M, fx - 0.8, fx + 0.8, fz + 0.62, 0.12 + r * 0.22, 0.22);
    stoneCourse(b, rng, M, fz - 0.6, fz + 0.6, fx + 0.82, 0.12 + r * 0.22, 0.22, true);
  }
  b.stat.add(G.box, COL.stoneDark, T(fx, 0.45, fz, 0, 0, 0, 1.6, 0.9, 1.2), M);
  b.stat.add(G.box, '#2a1a12', T(fx, 0.92, fz, 0, 0, 0, 1.1, 0.06, 0.8), M);
  b.ember.add(G.box, '#ffffff', T(fx, 0.97, fz, 0, 0, 0, 1.0, 0.08, 0.7), M);
  for (let i = 0; i < 10; i++) b.ember.add(G.ico0, '#ffffff', T(fx - 0.4 + rng() * 0.8, 1.02, fz - 0.28 + rng() * 0.56, rng(), rng(), 0, 0.12 + rng() * 0.08), M);
  b.stat.add(G.taper6, COL.ironDark, T(fx, 1.75, fz, 0, Math.PI / 6, 0, 1.3, 0.7, 1.0), M);
  b.stat.add(G.cyl8, COL.ironDark, T(fx, 2.7, fz, 0, 0, 0, 0.3, 1.3, 0.3), M);
  b.stat.add(G.cyl8, COL.ironDark, T(fx, 3.4, fz, 0, 0, 0, 0.42, 0.12, 0.42), M);
  const forgeGlow = new THREE.Vector3(fx, 1.4, fz).applyMatrix4(M);
  const forgeSparks = new THREE.Vector3(fx, 1.1, fz).applyMatrix4(M);

  // 風箱
  const bx = hw + 0.45;
  b.stat.add(G.box, COL.wood, T(bx, 0.7, fz, 0, 0, 0.18, 0.7, 0.06, 0.6), M);
  b.stat.add(G.box, COL.wood, T(bx, 0.5, fz, 0, 0, -0.08, 0.7, 0.06, 0.6), M);
  b.stat.add(G.box, '#5a3a24', T(bx - 0.05, 0.6, fz, 0, 0, 0.05, 0.6, 0.16, 0.56), M);
  b.stat.add(G.cyl6, COL.ironDark, T(bx + 0.45, 0.62, fz, 0, 0, Math.PI / 2, 0.08, 0.4, 0.08), M);
  b.stat.add(G.box, COL.woodDark, T(bx - 0.25, 0.3, fz, 0, 0, 0, 0.1, 0.6, 0.1), M);

  // 鐵砧＋燒紅的鐵條
  const ax = hw + 1.35;
  const az = 0.65;
  stump(b, rng, R(M, T(ax, 0, az)), 0.5);
  anvil(b, rng, R(M, T(ax, 0.5, az, 0, 0.3, 0)));
  b.ember.add(G.box, '#ffffff', T(ax + 0.05, 1.14, az, 0, 0.3, 0, 0.7, 0.05, 0.08), M);
  hammer(b, R(M, T(ax - 0.2, 1.15, az + 0.25, Math.PI / 2, 0.8, 0)));
  waterBarrel(b, rng, R(M, T(hw + 2.3, 0, 1.05)));
  barrel(b, rng, R(M, T(hw + 2.35, 0, -0.1, 0, 0.5, 0, 0.85)));

  // 工具牆
  b.stat.add(G.box, jitter(COL.woodLight, rng), T(hw + 0.06, BASE + 1.6, 0.6, 0, 0, 0, 0.06, 0.9, 1.6), M);
  for (let i = 0; i < 4; i++) hammer(b, R(M, T(hw + 0.14, BASE + 1.5, 0.05 + i * 0.36, 0, 0, 0.1 * (i % 2 ? 1 : -1))));
  for (let i = 0; i < 2; i++) {
    b.stat.add(G.box, COL.iron, T(hw + 0.14, BASE + 1.75, 1.0 + i * 0.22, 0, 0, 0.15, 0.04, 0.8, 0.04), M);
  }
  crate(b, rng, R(M, T(-hw - 0.75, 0, -1.4, 0, 0.3, 0)));
  crate(b, rng, R(M, T(-hw - 0.7, 0.7, -1.35, 0, 0.9, 0, 0.7)));

  return { door, chimneyTop, forgeGlow, forgeSparks };
}

export const HOUSE = { W, D, TOP, RISE };
