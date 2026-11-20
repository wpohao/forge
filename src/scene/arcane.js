// 異世界魔法元素：發光材質、水晶、符文法陣、浮空符文、渡鴉、魔導書。全部程式生成、低多邊形。
import * as THREE from 'three';
import { Batch, T, jitter, GLOW } from './batch.js';
import { G } from './kit.js';

// 附魔色：語言與框架＝冰藍、資料與架構＝紫、雲端維運＝翠綠、品質與資安＝金
export const ARCANE = {
  frost: '#5fd8ff',
  violet: '#b07cff',
  verdant: '#5dffb0',
  gold: '#ffd36a',
  rose: '#ff7ad9',
};
export const ENCHANT_COLORS = [ARCANE.frost, ARCANE.violet, ARCANE.verdant, ARCANE.gold];

// 每頂點上色的自發光材質：顏色乘上倍率（再乘全站係數 GLOW），倍率 >1 的部分會被 bloom 抓到
export function magicMaterial(boost = 2.2, opts = {}) {
  const k = boost * GLOW;
  return new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(k, k, k), ...opts });
}

// 水晶簇：一根主晶 + 幾根斜插的小晶；本體放 b.stat（深色晶殼），晶芯放 b.magic
export function crystalCluster(b, rng, M, color, s = 1) {
  const n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const main = i === 0;
    const h = (main ? 1.2 : 0.45 + rng() * 0.5) * s;
    const w = (main ? 0.32 : 0.14 + rng() * 0.1) * s;
    const a = (i / n) * Math.PI * 2 + rng();
    const tilt = main ? 0 : 0.35 + rng() * 0.4;
    const L = T(main ? 0 : Math.cos(a) * 0.16 * s, 0, main ? 0 : Math.sin(a) * 0.16 * s, Math.sin(a) * tilt, rng() * 3, -Math.cos(a) * tilt);
    b.magic.add(G.oct, jitter(color, rng, 0.08), T(0, h * 0.5, 0, 0, 0, 0, w, h, w), M.clone().multiply(L));
  }
  b.stat.add(G.dodec, jitter('#4a4458', rng), T(0, 0.05 * s, 0, rng(), rng(), 0, 0.5 * s, 0.22 * s, 0.5 * s), M);
}

// 地面/空中的符文法陣：外圈、內圈、刻度、三角星；回傳可旋轉的 Group
export function runeCircle(radius, color, { opacity = 0.75, segments = 48 } = {}) {
  const b = new Batch();
  const ring = (r, w) => {
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      b.add(G.box, color, T(Math.cos(a) * r, 0, Math.sin(a) * r, 0, -a, 0, w, 0.01, (Math.PI * 2 * r) / segments * 1.02));
    }
  };
  ring(radius, 0.05 * radius);
  ring(radius * 0.8, 0.025 * radius);
  ring(radius * 0.42, 0.03 * radius);
  // 外圈之間的符文刻記
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = radius * 0.9;
    const kind = i % 4;
    const len = radius * (kind === 0 ? 0.12 : 0.07);
    b.add(G.box, color, T(Math.cos(a) * r, 0, Math.sin(a) * r, 0, -a, 0, len, 0.01, 0.025 * radius));
    if (kind === 2) b.add(G.box, color, T(Math.cos(a) * r, 0, Math.sin(a) * r, 0, -a + Math.PI / 2, 0, len, 0.01, 0.025 * radius));
  }
  // 兩個交錯三角形（六芒星）
  for (const off of [0, Math.PI / 3]) {
    for (let k = 0; k < 3; k++) {
      const a0 = off + (k / 3) * Math.PI * 2;
      const a1 = off + ((k + 1) / 3) * Math.PI * 2;
      const p0 = new THREE.Vector2(Math.cos(a0), Math.sin(a0)).multiplyScalar(radius * 0.8);
      const p1 = new THREE.Vector2(Math.cos(a1), Math.sin(a1)).multiplyScalar(radius * 0.8);
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      const len = p0.distanceTo(p1);
      const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      b.add(G.box, color, T(mid.x, 0, mid.y, 0, -ang, 0, len, 0.01, 0.02 * radius));
    }
  }
  const mat = magicMaterial(1.6, { transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = b.build(mat, { castShadow: false, receiveShadow: false });
  const g = new THREE.Group();
  g.add(mesh);
  g.userData.mat = mat;
  return g;
}

// 浮空符文石：繞著中心慢慢轉、上下漂（回傳 group 與 update）
export function floatingRunes(count, color, { radius = 0.5, size = 0.08, y = 0 } = {}) {
  const b = new Batch();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const M = T(Math.cos(a) * radius, Math.sin(i * 2.3) * 0.08, Math.sin(a) * radius, 0, -a, 0);
    // 一個字形 = 兩三筆
    b.add(G.box, color, T(0, 0, 0, 0, 0, 0, size * 0.25, size * 1.4, size * 0.2), M);
    b.add(G.box, color, T(0, size * (i % 2 ? 0.4 : -0.3), 0, 0, 0, i % 3 ? 0.8 : -0.8, size * 0.9, size * 0.22, size * 0.2), M);
    if (i % 3 === 0) b.add(G.box, color, T(size * 0.3, size * 0.55, 0, 0, 0, 0, size * 0.5, size * 0.2, size * 0.2), M);
  }
  const mesh = b.build(magicMaterial(2.4), { castShadow: false, receiveShadow: false });
  const g = new THREE.Group();
  g.add(mesh);
  g.position.y = y;
  const ph = Math.random() * 6;
  return {
    group: g,
    update(t) {
      g.rotation.y = t * 0.45 + ph;
      mesh.position.y = Math.sin(t * 1.3 + ph) * 0.06;
    },
  };
}

// 渡鴉（站姿），放進 b.stat；眼睛放 b.magic
export function raven(b, M, s = 1) {
  const k = '#1c1a22';
  b.stat.add(G.ico0, k, T(0, 0.2 * s, 0, 0, 0, 0, 0.32 * s, 0.3 * s, 0.42 * s), M);
  b.stat.add(G.ico0, k, T(0, 0.43 * s, 0.15 * s, 0, 0, 0, 0.2 * s), M);
  b.stat.add(G.cone4, '#2c2a30', T(0, 0.42 * s, 0.32 * s, Math.PI / 2, Math.PI / 4, 0, 0.06 * s, 0.18 * s, 0.06 * s), M);
  b.stat.add(G.box, k, T(0, 0.17 * s, -0.3 * s, -0.4, 0, 0, 0.18 * s, 0.04 * s, 0.3 * s), M);
  for (const x of [-0.13, 0.13]) b.stat.add(G.box, '#26232c', T(x * s, 0.24 * s, -0.02 * s, 0, 0, x > 0 ? -0.3 : 0.3, 0.05 * s, 0.22 * s, 0.34 * s), M);
  for (const x of [-0.06, 0.06]) b.stat.add(G.box, '#3a3020', T(x * s, 0.02 * s, 0.02 * s, 0, 0, 0, 0.02 * s, 0.1 * s, 0.02 * s), M);
  if (b.magic) for (const x of [-0.07, 0.07]) b.magic.add(G.box, ARCANE.frost, T(x * s, 0.47 * s, 0.22 * s, 0, 0, 0, 0.03 * s, 0.03 * s, 0.02 * s), M);
}

// 魔導書（闔起的書，可立可躺）：封面 + 書頁 + 金屬護角 + 發光封印
export function grimoire(b, rng, M, color, { w = 0.18, h = 0.5, d = 0.36, sigil = null } = {}) {
  b.stat.add(G.box, jitter(color, rng, 0.08), T(0, h / 2, 0, 0, 0, 0, w, h, d), M);
  b.stat.add(G.box, '#efe3c6', T(0, h / 2, 0.012, 0, 0, 0, w * 0.86, h * 0.92, d * 0.96), M);
  b.stat.add(G.box, '#c99a3a', T(0, h * 0.18, 0, 0, 0, 0, w * 1.04, h * 0.06, d * 1.02), M);
  b.stat.add(G.box, '#c99a3a', T(0, h * 0.82, 0, 0, 0, 0, w * 1.04, h * 0.06, d * 1.02), M);
  // 書脊朝 +z：封印刻在書脊上
  if (sigil && b.magic) b.magic.add(G.oct, sigil, T(0, h / 2, d * 0.5 + 0.01, 0, 0, 0, w * 0.45, w * 0.7, 0.03), M);
}
