// 低多邊形道具庫：每個函式把零件加進 batch（b.stat 一般、b.warm 暖光、b.ember 爐火光），M 為放置矩陣。
import * as THREE from 'three';
import { T, jitter } from './batch.js';

export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  taper6: new THREE.CylinderGeometry(0.38, 0.5, 1, 6),
  cone6: new THREE.ConeGeometry(0.5, 1, 6),
  cone7: new THREE.ConeGeometry(0.5, 1, 7),
  cone4: new THREE.ConeGeometry(0.5, 1, 4),
  ico0: new THREE.IcosahedronGeometry(0.5, 0),
  ico1: new THREE.IcosahedronGeometry(0.5, 1),
  dodec: new THREE.DodecahedronGeometry(0.5, 0),
  oct: new THREE.OctahedronGeometry(0.5, 0),
};

export const COL = {
  wood: '#7a5232', woodDark: '#4f3420', woodLight: '#a57a4c', plank: '#8f6a43',
  iron: '#3b3a3c', ironDark: '#262529', steel: '#b9bec6', gold: '#c99a3a',
  stone: '#8a847b', stoneDark: '#5f5a54', plaster: '#e3d3b2',
  pine: '#2f6b3f', pine2: '#3d7d48', leaf: '#5f9a3e', leaf2: '#78ad4a', leaf3: '#4a8236',
  red: '#a8432f', water: '#5aa7c9', straw: '#d9b45a',
};

const R = (M, local) => M.clone().multiply(local);

export function pine(b, rng, M, s = 1) {
  b.stat.add(G.cyl6, jitter(COL.woodDark, rng), T(0, 0.35 * s, 0, 0, 0, 0, 0.22 * s, 0.7 * s, 0.22 * s), M);
  const layers = 3 + Math.floor(rng() * 2);
  for (let i = 0; i < layers; i++) {
    const w = (1.5 - i * 0.32) * s;
    b.stat.add(G.cone7, jitter(i % 2 ? COL.pine : COL.pine2, rng, 0.1), T(0, (0.9 + i * 0.55) * s, 0, 0, rng() * 3, 0, w, 1.0 * s, w), M);
  }
}

export function oak(b, rng, M, s = 1) {
  b.stat.add(G.taper6, jitter(COL.wood, rng), T(0, 0.6 * s, 0, 0, 0, 0, 0.32 * s, 1.2 * s, 0.32 * s), M);
  b.stat.add(G.cyl6, jitter(COL.wood, rng), T(0.25 * s, 1.15 * s, 0, 0, 0, -0.7, 0.12 * s, 0.6 * s, 0.12 * s), M);
  const blobs = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + rng();
    const r = i === 0 ? 0 : 0.45 * s;
    const sz = (i === 0 ? 1.5 : 0.95 + rng() * 0.35) * s;
    const col = [COL.leaf, COL.leaf2, COL.leaf3][Math.floor(rng() * 3)];
    b.stat.add(G.ico1, jitter(col, rng, 0.12), T(Math.cos(a) * r, (1.75 + (i === 0 ? 0.35 : rng() * 0.3)) * s, Math.sin(a) * r, rng(), rng(), rng(), sz, sz * 0.85, sz), M);
  }
}

export function bush(b, rng, M, s = 1) {
  const n = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i++) {
    const sz = (0.45 + rng() * 0.3) * s;
    b.stat.add(G.ico0, jitter(rng() > 0.5 ? COL.leaf : COL.leaf3, rng, 0.12), T((rng() - 0.5) * 0.5 * s, sz * 0.35, (rng() - 0.5) * 0.5 * s, rng(), rng(), 0, sz, sz * 0.8, sz), M);
  }
}

export function rock(b, rng, M, s = 1) {
  b.stat.add(G.dodec, jitter(rng() > 0.5 ? COL.stone : COL.stoneDark, rng, 0.08), T(0, 0.15 * s, 0, rng() * 3, rng() * 3, rng() * 3, s, s * (0.5 + rng() * 0.4), s * (0.8 + rng() * 0.4)), M);
}

export function grassTuft(b, rng, M) {
  for (let i = 0; i < 3; i++) {
    b.stat.add(G.cone4, jitter('#7fae4f', rng, 0.15), T((rng() - 0.5) * 0.18, 0.12, (rng() - 0.5) * 0.18, (rng() - 0.5) * 0.5, rng() * 3, (rng() - 0.5) * 0.5, 0.06, 0.28 + rng() * 0.15, 0.06), M);
  }
}

export function flower(b, rng, M) {
  const petals = ['#e85d5d', '#f2c94c', '#f4f1e8', '#b98ad8', '#f29bc4'];
  b.stat.add(G.box, '#5d8f3a', T(0, 0.12, 0, 0, 0, 0, 0.025, 0.24, 0.025), M);
  b.stat.add(G.oct, petals[Math.floor(rng() * petals.length)], T(0, 0.26, 0, 0, rng(), 0, 0.12, 0.08, 0.12), M);
}

export function barrel(b, rng, M, s = 1) {
  b.stat.add(G.cyl8, jitter(COL.plank, rng), T(0, 0.45 * s, 0, 0, 0, 0, 0.62 * s, 0.9 * s, 0.62 * s), M);
  for (const y of [0.15, 0.75]) b.stat.add(G.cyl8, COL.ironDark, T(0, y * s, 0, 0, 0, 0, 0.66 * s, 0.07 * s, 0.66 * s), M);
  b.stat.add(G.cyl8, jitter(COL.woodDark, rng), T(0, 0.9 * s, 0, 0, 0, 0, 0.55 * s, 0.02, 0.55 * s), M);
}

export function waterBarrel(b, rng, M) {
  barrel(b, rng, M);
  b.stat.add(G.cyl8, COL.water, T(0, 0.86, 0, 0, 0, 0, 0.54, 0.03, 0.54), M);
}

export function crate(b, rng, M, s = 1) {
  const c = jitter(COL.woodLight, rng);
  b.stat.add(G.box, c, T(0, 0.35 * s, 0, 0, 0, 0, 0.7 * s), M);
  const d = jitter(COL.woodDark, rng);
  for (const z of [-0.36, 0.36]) {
    b.stat.add(G.box, d, T(0, 0.35 * s, z * s, 0, 0, Math.PI / 4, 0.9 * s, 0.08 * s, 0.03), M);
    b.stat.add(G.box, d, T(0, 0.04 * s, z * s, 0, 0, 0, 0.72 * s, 0.08 * s, 0.03), M);
    b.stat.add(G.box, d, T(0, 0.66 * s, z * s, 0, 0, 0, 0.72 * s, 0.08 * s, 0.03), M);
  }
}

export function lanternPost(b, rng, M) {
  b.stat.add(G.box, COL.woodDark, T(0, 0.9, 0, 0, 0, 0, 0.12, 1.8, 0.12), M);
  b.stat.add(G.box, COL.woodDark, T(0.22, 1.72, 0, 0, 0, 0, 0.5, 0.08, 0.08), M);
  b.stat.add(G.box, COL.ironDark, T(0.42, 1.48, 0, 0, 0, 0, 0.26, 0.04, 0.26), M);
  b.stat.add(G.cone4, COL.ironDark, T(0.42, 1.68, 0, 0, Math.PI / 4, 0, 0.36, 0.16, 0.36), M);
  b.warm.add(G.box, '#ffffff', T(0.42, 1.48 + 0.02, 0, 0, 0, 0, 0.18, 0.22, 0.18), M);
}

export function fence(b, rng, M, len = 2) {
  const c = jitter(COL.wood, rng);
  const posts = Math.max(2, Math.round(len / 0.9) + 1);
  for (let i = 0; i < posts; i++) {
    const x = -len / 2 + (i / (posts - 1)) * len;
    b.stat.add(G.box, c, T(x, 0.38, 0, 0, (rng() - 0.5) * 0.2, (rng() - 0.5) * 0.08, 0.1, 0.76, 0.1), M);
  }
  b.stat.add(G.box, jitter(COL.woodLight, rng), T(0, 0.55, 0, 0, 0, 0, len, 0.07, 0.05), M);
  b.stat.add(G.box, jitter(COL.woodLight, rng), T(0, 0.28, 0, 0, 0, 0, len, 0.07, 0.05), M);
}

export function woodpile(b, rng, M) {
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4 - row; i++) {
      const x = (i - (3 - row) / 2) * 0.32;
      b.stat.add(G.cyl8, jitter(COL.wood, rng, 0.12), T(x, 0.16 + row * 0.28, 0, Math.PI / 2, 0, 0, 0.3, 1.1 + rng() * 0.15, 0.3), M);
      b.stat.add(G.cyl8, jitter('#c79a62', rng), T(x, 0.16 + row * 0.28, 0.57, Math.PI / 2, 0, 0, 0.27, 0.02, 0.27), M);
    }
  }
}

export function well(b, rng, M) {
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    b.stat.add(G.box, jitter(COL.stone, rng, 0.1), T(Math.cos(a) * 0.7, 0.3, Math.sin(a) * 0.7, 0, -a, 0, 0.42, 0.6, 0.28), M);
  }
  b.stat.add(G.cyl12, '#3f6f86', T(0, 0.45, 0, 0, 0, 0, 1.2, 0.04, 1.2), M);
  for (const x of [-0.75, 0.75]) b.stat.add(G.box, COL.woodDark, T(x, 1.0, 0, 0, 0, 0, 0.1, 1.4, 0.1), M);
  b.stat.add(G.cyl8, COL.wood, T(0, 1.35, 0, 0, 0, Math.PI / 2, 0.1, 1.5, 0.1), M);
  for (const s of [-1, 1]) b.stat.add(G.box, jitter(COL.red, rng), T(0, 1.85, s * 0.36, s * 0.75, 0, 0, 1.9, 0.06, 0.9), M);
  b.stat.add(G.cyl8, COL.plank, T(0, 0.95, 0, 0, 0, 0, 0.25, 0.25, 0.25), M);
}

export function cart(b, rng, M) {
  b.stat.add(G.box, jitter(COL.plank, rng), T(0, 0.7, 0, 0, 0, 0, 1.6, 0.12, 1.0), M);
  for (const z of [-0.5, 0.5]) b.stat.add(G.box, jitter(COL.wood, rng), T(0, 0.88, z, 0, 0, 0, 1.6, 0.3, 0.06), M);
  for (const x of [-0.8, 0.8]) b.stat.add(G.box, jitter(COL.wood, rng), T(x, 0.88, 0, 0, 0, 0, 0.06, 0.3, 1.0), M);
  for (const z of [-0.6, 0.6]) {
    b.stat.add(G.cyl12, COL.woodDark, T(0.1, 0.42, z, Math.PI / 2, 0, 0, 0.84, 0.08, 0.84), M);
    b.stat.add(G.cyl8, COL.ironDark, T(0.1, 0.42, z, Math.PI / 2, 0, 0, 0.18, 0.1, 0.18), M);
  }
  for (const z of [-0.3, 0.3]) b.stat.add(G.box, COL.wood, T(1.35, 0.55, z, 0, 0, 0.3, 1.1, 0.06, 0.06), M);
  for (let i = 0; i < 5; i++) b.stat.add(G.ico0, jitter(rng() > 0.5 ? '#7d6f63' : '#9a7b55', rng), T(-0.4 + rng() * 0.8, 0.95, -0.3 + rng() * 0.6, rng(), rng(), rng(), 0.35), M);
}

export function orePile(b, rng, M) {
  for (let i = 0; i < 9; i++) {
    const c = rng() > 0.7 ? '#a0522d' : rng() > 0.5 ? '#6b6f78' : '#4a4d55';
    b.stat.add(G.ico0, jitter(c, rng), T((rng() - 0.5) * 0.9, 0.12 + rng() * 0.2, (rng() - 0.5) * 0.9, rng() * 3, rng() * 3, 0, 0.3 + rng() * 0.2), M);
  }
}

export function stump(b, rng, M, h = 0.55) {
  b.stat.add(G.cyl8, jitter(COL.wood, rng), T(0, h / 2, 0, 0, 0, 0, 0.62, h, 0.62), M);
  b.stat.add(G.cyl8, '#c79a62', T(0, h + 0.005, 0, 0, 0, 0, 0.56, 0.01, 0.56), M);
}

export function anvil(b, rng, M, s = 1) {
  b.stat.add(G.box, COL.ironDark, T(0, 0.1 * s, 0, 0, 0, 0, 0.55 * s, 0.2 * s, 0.4 * s), M);
  b.stat.add(G.box, COL.iron, T(0, 0.32 * s, 0, 0, 0, 0, 0.3 * s, 0.28 * s, 0.24 * s), M);
  b.stat.add(G.box, COL.iron, T(0, 0.52 * s, 0, 0, 0, 0, 0.75 * s, 0.14 * s, 0.32 * s), M);
  b.stat.add(G.cone4, COL.iron, T(0.52 * s, 0.53 * s, 0, 0, Math.PI / 4, -Math.PI / 2, 0.22 * s, 0.32 * s, 0.22 * s), M);
}

export function hammer(b, M) {
  b.stat.add(G.box, COL.wood, T(0, 0, 0, 0, 0, 0, 0.05, 0.5, 0.05), M);
  b.stat.add(G.box, COL.iron, T(0, 0.25, 0, 0, 0, 0, 0.2, 0.09, 0.09), M);
}

export function sword(b, M, len = 1.1, glowBatch = null) {
  (glowBatch || b.stat).add(G.box, glowBatch ? '#ffffff' : COL.steel, T(0, len / 2 + 0.18, 0, 0, 0, 0, 0.07, len, 0.02), M);
  b.stat.add(G.box, COL.gold, T(0, 0.17, 0, 0, 0, 0, 0.28, 0.04, 0.05), M);
  b.stat.add(G.box, COL.woodDark, T(0, 0.06, 0, 0, 0, 0, 0.04, 0.18, 0.04), M);
}

export function swordRack(b, rng, M) {
  for (const x of [-0.6, 0.6]) b.stat.add(G.box, COL.woodDark, T(x, 0.6, 0, 0, 0, 0, 0.09, 1.2, 0.09), M);
  b.stat.add(G.box, COL.wood, T(0, 1.1, 0, 0, 0, 0, 1.4, 0.08, 0.12), M);
  b.stat.add(G.box, COL.wood, T(0, 0.25, 0, 0, 0, 0, 1.4, 0.08, 0.2), M);
  for (let i = 0; i < 4; i++) sword(b, R(M, T(-0.45 + i * 0.3, 0.25, 0.02, 0, 0, (rng() - 0.5) * 0.06)), 0.85);
}

export function grindstone(b, rng, M) {
  for (const z of [-0.25, 0.25]) b.stat.add(G.box, COL.wood, T(0, 0.35, z, 0, 0, 0, 0.1, 0.7, 0.1), M);
  b.stat.add(G.box, COL.wood, T(0, 0.08, 0, 0, 0, 0, 0.9, 0.08, 0.6), M);
  b.stat.add(G.cyl12, '#a39a8c', T(0, 0.68, 0, Math.PI / 2, 0, 0, 0.75, 0.16, 0.75), M);
  b.stat.add(G.cyl8, COL.ironDark, T(0, 0.68, 0, Math.PI / 2, 0, 0, 0.06, 0.7, 0.06), M);
}

export function cropRow(b, rng, M, len = 2) {
  b.stat.add(G.box, '#6b4a2f', T(0, 0.06, 0, 0, 0, 0, len, 0.12, 0.38), M);
  const n = Math.round(len / 0.3);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.15 + i * (len / n);
    if (rng() > 0.5) b.stat.add(G.cone6, jitter('#6aa84f', rng, 0.15), T(x, 0.3, 0, 0, rng() * 3, 0, 0.22, 0.38, 0.22), M);
    else {
      b.stat.add(G.ico0, jitter('#5f9a3e', rng), T(x, 0.22, 0, 0, rng() * 3, 0, 0.26), M);
      if (rng() > 0.5) b.stat.add(G.ico0, '#e07b39', T(x + 0.06, 0.18, 0.08, 0, 0, 0, 0.12), M);
    }
  }
}

export function bench(b, rng, M) {
  b.stat.add(G.box, jitter(COL.plank, rng), T(0, 0.42, 0, 0, 0, 0, 1.4, 0.08, 0.4), M);
  for (const x of [-0.55, 0.55]) b.stat.add(G.box, COL.woodDark, T(x, 0.2, 0, 0, 0, 0, 0.08, 0.4, 0.34), M);
}

export function hayBale(b, rng, M) {
  b.stat.add(G.box, jitter(COL.straw, rng), T(0, 0.3, 0, 0, 0, 0, 1.0, 0.6, 0.6), M);
  for (const x of [-0.25, 0.25]) b.stat.add(G.box, '#8a6a2f', T(x, 0.3, 0, 0, 0, 0, 0.04, 0.62, 0.62), M);
}

export { R };
