// 背景遠景：主島四周的中景浮空島、遠方岩柱與城堡剪影、雲牆。
// 鏡頭拉遠（完整取景）後畫面左右兩側會空出來，這裡把它補成有層次的異世界天空。
// 全部擺在鏡頭軌道（水平半徑約 30～40）之外，不會擋到主島；用自己的亂數種子，不影響主島佈置。
import * as THREE from 'three';
import { Batch, T, jitter, staticMaterial, glowMaterial } from './batch.js';
import { mulberry32 } from './noise.js';
import * as K from './kit.js';
import { createWaterfall, onSky } from './effects.js';
import { ARCANE, magicMaterial, crystalCluster, runeCircle } from './arcane.js';

const ROCK = ['#7a5236', '#6a5546', '#5f5249', '#4f4650'];
const SLATE = '#3b2f5a';
// 遠景不吃場景霧（霧是米黃色，會把遠景刷成紙板色），改用「已經霧化」的藕紫色＋微自發光，
// 在夕陽天空前呈現魔幻的紫色剪影
const FAR = { rock: '#bba2b6', rock2: '#ae95ad', grass: '#b3b39c', wall: '#c6afc0', roof: '#9a80a8' };
const R_ = (M, local) => M.clone().multiply(local);

// 浮空島岩座：草皮頂 → 泥土唇緣 → 往下收尖的岩層，外加凸岩、倒掛魔晶與底下漂浮的碎石
function isleBase(b, rng, M, R, crystal) {
  b.stat.add(K.G.cyl8, jitter('#78a852', rng, 0.08), T(0, 0.02, 0, 0, rng(), 0, R * 2, 0.24, R * 1.9), M);
  b.stat.add(K.G.cyl8, jitter('#7a5236', rng), T(0, -0.25, 0, 0, rng(), 0, R * 2.06, 0.4, R * 1.96), M);
  let y = -0.45;
  const layers = 3 + Math.floor(rng() * 2);
  for (let k = 0; k < layers; k++) {
    const w = R * 2 * (1 - k * 0.2);
    const h = R * (0.55 + rng() * 0.35);
    b.stat.add(K.G.cone6, jitter(ROCK[Math.min(k, 3)], rng), T((rng() - 0.5) * R * 0.15, y - h / 2, (rng() - 0.5) * R * 0.15, Math.PI, rng() * 3, 0, w, h, w * 0.94), M);
    y -= h * 0.62;
  }
  for (let i = 0; i < 5; i++) {
    const a = rng() * Math.PI * 2;
    const s = R * (0.18 + rng() * 0.14);
    b.stat.add(K.G.dodec, jitter(ROCK[2], rng), T(Math.cos(a) * R * 0.78, -0.6 - rng() * R * 0.4, Math.sin(a) * R * 0.78, rng(), rng(), rng(), s, s * 0.8, s), M);
  }
  for (let i = 0; i < 4; i++) {
    const a = rng() * Math.PI * 2;
    const r = R * (0.25 + rng() * 0.35);
    const len = R * (0.35 + rng() * 0.4);
    b.magic.add(K.G.oct, jitter(crystal, rng, 0.08), T(Math.cos(a) * r, y * (0.45 + rng() * 0.3), Math.sin(a) * r, Math.PI + (rng() - 0.5) * 0.7, rng(), (rng() - 0.5) * 0.7, len * 0.22, len, len * 0.22), M);
  }
  for (let i = 0; i < 3; i++) {
    const a = rng() * Math.PI * 2;
    const s = R * (0.1 + rng() * 0.12);
    b.stat.add(K.G.cone6, jitter(ROCK[3], rng), T(Math.cos(a) * R * 0.6, y - R * (0.4 + rng() * 0.8), Math.sin(a) * R * 0.6, Math.PI, rng(), 0, s * 2, s * 2.4, s * 2), M);
  }
}

// ---------- 中景浮空島的主題 ----------
const THEMES = {
  // 法師塔：石塔身、腰帶、暖光窗、紫板岩尖頂，塔頂浮著魔晶
  tower(b, rng, M, R, crystal) {
    const H = R * 2.4;
    b.stat.add(K.G.taper6, jitter(K.COL.stone, rng), T(0, H / 2, 0, 0, 0.2, 0, R * 0.85, H, R * 0.85), M);
    for (let k = 1; k < 4; k++) b.stat.add(K.G.cyl8, jitter(K.COL.stoneDark, rng), T(0, (H * k) / 4, 0, 0, 0, 0, R * (0.9 - k * 0.05), 0.12, R * (0.9 - k * 0.05)), M);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + rng();
      const y = H * (0.25 + (k % 3) * 0.24);
      const r = R * (0.42 - (y / H) * 0.08);
      b.warm.add(K.G.box, '#ffb35c', T(Math.cos(a) * r, y, Math.sin(a) * r, 0, -a + Math.PI / 2, 0, 0.12, 0.34, 0.24), M);
    }
    b.stat.add(K.G.cyl8, jitter(K.COL.woodDark, rng), T(0, H * 0.62, 0, 0, 0, 0, R * 1.05, 0.1, R * 1.05), M);
    b.stat.add(K.G.cone6, jitter(SLATE, rng), T(0, H + R * 0.55, 0, 0, 0.3, 0, R * 1.15, R * 1.1, R * 1.15), M);
    b.stat.add(K.G.cone6, jitter(SLATE, rng), T(R * 0.55, H * 0.55 + R * 0.4, 0, 0, 0, 0, R * 0.5, R * 0.6, R * 0.5), M);
    b.stat.add(K.G.taper6, jitter(K.COL.stone, rng), T(R * 0.55, H * 0.28, 0, 0, 0, 0, R * 0.42, H * 0.56, R * 0.42), M);
    b.magic.add(K.G.oct, crystal, T(0, H + R * 1.55, 0, 0, 0, 0, R * 0.22, R * 0.5, R * 0.22), M);
    K.pine(b, rng, R_(M, T(-R * 0.7, 0, R * 0.4)), R * 0.32);
  },
  // 遺跡：一圈斷柱、一座拱門、倒下的柱子、發光的符文石
  ruins(b, rng, M, R, crystal) {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const h = R * (0.35 + rng() * 0.9);
      const x = Math.cos(a) * R * 0.62;
      const z = Math.sin(a) * R * 0.62;
      b.stat.add(K.G.cyl6, jitter('#cfc4b0', rng), T(x, h / 2, z, 0, rng(), 0, R * 0.16, h, R * 0.16), M);
      b.stat.add(K.G.box, jitter('#b8ad98', rng), T(x, 0.06, z, 0, rng(), 0, R * 0.26, 0.12, R * 0.26), M);
      if (rng() > 0.5) b.stat.add(K.G.dodec, jitter('#b8ad98', rng), T(x + R * 0.1, 0.1, z, rng(), rng(), rng(), R * 0.12), M);
    }
    b.stat.add(K.G.cyl6, jitter('#cfc4b0', rng), T(-R * 0.2, R * 0.75, -R * 0.1, 0, 0, 0, R * 0.17, R * 1.5, R * 0.17), M);
    b.stat.add(K.G.cyl6, jitter('#cfc4b0', rng), T(R * 0.35, R * 0.75, -R * 0.1, 0, 0, 0, R * 0.17, R * 1.5, R * 0.17), M);
    b.stat.add(K.G.box, jitter('#b8ad98', rng), T(R * 0.075, R * 1.55, -R * 0.1, 0, 0, 0.04, R * 0.85, R * 0.16, R * 0.24), M);
    b.stat.add(K.G.cyl6, jitter('#cfc4b0', rng), T(R * 0.1, R * 0.1, R * 0.45, 0, 0.6, Math.PI / 2, R * 0.15, R * 0.9, R * 0.15), M);
    for (let k = 0; k < 3; k++) b.magic.add(K.G.box, crystal, T((rng() - 0.5) * R, 0.1, (rng() - 0.5) * R, 0, rng() * 3, 0, R * 0.14, 0.05, R * 0.14), M);
    crystalCluster(b, rng, R_(M, T(R * 0.05, 0, -R * 0.1)), crystal, R * 0.4);
  },
  // 林地：松樹與橡樹叢、灌木、岩石
  grove(b, rng, M, R) {
    const n = 5 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * R * 0.7;
      const L = R_(M, T(Math.cos(a) * r, 0, Math.sin(a) * r, 0, rng() * 3, 0));
      if (rng() > 0.45) K.pine(b, rng, L, R * (0.3 + rng() * 0.18));
      else K.oak(b, rng, L, R * (0.26 + rng() * 0.12));
    }
    for (let k = 0; k < 4; k++) K.bush(b, rng, R_(M, T((rng() - 0.5) * R * 1.4, 0, (rng() - 0.5) * R * 1.4)), R * 0.3);
    K.rock(b, rng, R_(M, T(R * 0.5, 0, -R * 0.3)), R * 0.22);
  },
  // 巨型魔晶：一根主晶 + 一圈斜晶，底座是深色晶殼
  crystal(b, rng, M, R, crystal) {
    b.magic.add(K.G.oct, jitter(crystal, rng, 0.06), T(0, R * 1.2, 0, 0, 0.3, 0, R * 0.55, R * 2.6, R * 0.55), M);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + rng() * 0.4;
      const h = R * (0.7 + rng() * 0.8);
      b.magic.add(K.G.oct, jitter(crystal, rng, 0.1), T(Math.cos(a) * R * 0.45, h * 0.4, Math.sin(a) * R * 0.45, Math.sin(a) * 0.5, rng(), -Math.cos(a) * 0.5, R * 0.22, h, R * 0.22), M);
    }
    b.stat.add(K.G.dodec, jitter('#4a4458', rng), T(0, 0.15, 0, rng(), rng(), 0, R * 1.3, R * 0.4, R * 1.3), M);
    for (let k = 0; k < 3; k++) K.rock(b, rng, R_(M, T((rng() - 0.5) * R * 1.4, 0, (rng() - 0.5) * R * 1.4)), R * 0.2);
  },
  // 小村落：兩間小屋（暖光窗、煙囪）、柵欄、果樹
  hamlet(b, rng, M, R) {
    for (const [x, z, s, ry] of [[-R * 0.3, -R * 0.15, 1, 0.3], [R * 0.45, R * 0.25, 0.75, -0.5]]) {
      const H = T(x, 0, z, 0, ry, 0);
      const w = R * 0.75 * s;
      b.stat.add(K.G.box, jitter(K.COL.plaster, rng), T(0, w * 0.4, 0, 0, 0, 0, w, w * 0.8, w * 0.8), R_(M, H));
      b.stat.add(K.G.cone4, jitter(rng() > 0.5 ? K.COL.red : '#6b3f2a', rng), T(0, w * 0.8 + w * 0.32, 0, 0, Math.PI / 4, 0, w * 1.25, w * 0.65, w * 1.05), R_(M, H));
      b.stat.add(K.G.box, jitter(K.COL.stoneDark, rng), T(w * 0.25, w * 1.15, 0, 0, 0, 0, w * 0.14, w * 0.5, w * 0.14), R_(M, H));
      b.warm.add(K.G.box, '#ffb35c', T(0, w * 0.4, w * 0.41, 0, 0, 0, w * 0.22, w * 0.22, 0.04), R_(M, H));
      b.warm.add(K.G.box, '#ffb35c', T(w * 0.51, w * 0.4, 0, 0, 0, 0, 0.04, w * 0.22, w * 0.2), R_(M, H));
    }
    K.fence(b, rng, R_(M, T(-R * 0.6, 0, R * 0.55, 0, 0.2, 0)), R * 0.8);
    K.oak(b, rng, R_(M, T(R * 0.1, 0, R * 0.65)), R * 0.26);
    K.pine(b, rng, R_(M, T(-R * 0.75, 0, -R * 0.55)), R * 0.3);
  },
  // 巨石陣：一圈立石，中央祭壇浮著魔晶，地上有符文法陣
  stones(b, rng, M, R, crystal, extra) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const h = R * (0.6 + rng() * 0.5);
      b.stat.add(K.G.box, jitter(K.COL.stoneDark, rng), T(Math.cos(a) * R * 0.66, h / 2, Math.sin(a) * R * 0.66, (rng() - 0.5) * 0.15, -a, (rng() - 0.5) * 0.15, R * 0.2, h, R * 0.32), M);
    }
    b.stat.add(K.G.cyl6, jitter(K.COL.stone, rng), T(0, 0.2, 0, 0, 0, 0, R * 0.5, 0.4, R * 0.5), M);
    b.magic.add(K.G.oct, crystal, T(0, R * 0.95, 0, 0, 0, 0, R * 0.2, R * 0.48, R * 0.2), M);
    extra.circle = { r: R * 0.85 };
  },
};

// 中景配置：方位（弧度）、半徑、高度、大小、主題、魔晶色、是否有瀑布
const MID = [
  [0.15, 50, -3, 4.2, 'tower', ARCANE.violet, false],
  [0.7, 58, -8, 3.4, 'grove', ARCANE.frost, true],
  [1.2, 47, 1, 2.8, 'crystal', ARCANE.frost, false],
  [1.75, 56, -5, 3.8, 'ruins', ARCANE.gold, false],
  [2.3, 49, -1, 3.2, 'hamlet', ARCANE.rose, true],
  [2.85, 60, -9, 4.0, 'grove', ARCANE.verdant, false],
  [3.4, 50, 0, 3.0, 'stones', ARCANE.violet, false],
  [3.95, 58, -6, 3.8, 'crystal', ARCANE.rose, true],
  [4.5, 48, -2, 3.0, 'ruins', ARCANE.frost, false],
  [5.05, 57, -7, 3.6, 'grove', ARCANE.violet, true],
  [5.55, 50, 0, 3.0, 'hamlet', ARCANE.gold, false],
  [6.0, 62, -10, 3.6, 'tower', ARCANE.frost, false],
];

// 遠景岩柱：從雲海升起、分段收窄，頂上偶爾有松樹或魔晶；其中一根頂著城堡
function farSpires(b, rng) {
  // 鏡頭約在 y=11 往下俯視，岩柱頂要壓在地平線下（-6～8）才不會衝出畫面頂端
  const N = 22;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + (rng() - 0.5) * 0.2;
    const r = 74 + rng() * 26;
    const top = -6 + rng() * 14;
    const base = -26;
    const w = 3.5 + rng() * 4.5;
    const M = T(Math.cos(a) * r, 0, Math.sin(a) * r, 0, rng() * 3, 0);
    let y = base;
    let ww = w;
    const segs = 3 + Math.floor(rng() * 3);
    const seg = (top - base) / segs;
    for (let k = 0; k < segs; k++) {
      b.stat.add(K.G.taper6, jitter(k % 2 ? FAR.rock : FAR.rock2, rng, 0.05), T((rng() - 0.5) * 1.2, y + seg / 2, (rng() - 0.5) * 1.2, 0, rng() * 3, 0, ww, seg * 1.08, ww * (0.85 + rng() * 0.2)), M);
      y += seg;
      ww *= 0.78 + rng() * 0.1;
    }
    b.stat.add(K.G.cyl8, jitter(FAR.grass, rng), T(0, top + 0.2, 0, 0, rng(), 0, ww * 1.05, 0.5, ww * 1.05), M);
    if (rng() > 0.4) for (let k = 0; k < 3; k++) K.pine(b, rng, R_(M, T((rng() - 0.5) * ww * 0.6, top + 0.3, (rng() - 0.5) * ww * 0.6)), 1.6 + rng());
    else if (rng() > 0.5) b.magic.add(K.G.oct, jitter([ARCANE.frost, ARCANE.violet][i % 2], rng), T(0, top + 3, 0, 0, rng(), 0, 1.4, 4.2, 1.4), M);
  }
  // 遠方城堡：夕陽方向的大岩柱上，城牆、塔樓、尖頂與點點燈火
  const ca = Math.atan2(-0.32, -0.95);
  const C = T(Math.cos(ca) * 92, -7, Math.sin(ca) * 92, 0, 0.4, 0);
  let y = -26;
  for (const [w, h] of [[17, 9], [15, 8], [14, 7]]) {
    b.stat.add(K.G.taper6, jitter(FAR.rock2, rng, 0.04), T(0, y + h / 2, 0, 0, rng(), 0, w, h * 1.06, w * 0.9), C);
    y += h;
  }
  const top = y;
  b.stat.add(K.G.cyl8, FAR.grass, T(0, top + 0.3, 0, 0, 0, 0, 14, 0.6, 13.5), C);
  b.stat.add(K.G.box, FAR.wall, T(0, top + 2.4, 0, 0, 0, 0, 11, 4.2, 8), C);
  for (const [x, z, h, s] of [[-5.5, -4, 9, 2.2], [5.5, -4, 8, 2.0], [-5.5, 4, 7, 2.0], [5.5, 4, 7.5, 2.0], [0, -1, 13, 3.0], [2.8, 2, 10, 1.8]]) {
    b.stat.add(K.G.cyl8, jitter(FAR.wall, rng, 0.04), T(x, top + h / 2, z, 0, 0, 0, s, h, s), C);
    b.stat.add(K.G.cone6, jitter(FAR.roof, rng), T(x, top + h + s * 0.75, z, 0, 0, 0, s * 1.35, s * 1.5, s * 1.35), C);
    b.warm.add(K.G.box, '#ffbf6e', T(x, top + h * 0.7, z + s * 0.5, 0, 0, 0, 0.35, 0.7, 0.1), C);
  }
  b.magic.add(K.G.oct, ARCANE.violet, T(0, top + 18.5, -1, 0, 0, 0, 0.8, 2.2, 0.8), C);
  // 遠方漂浮的碎岩（地平線附近，填補岩柱之間）
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2;
    const r = 66 + rng() * 34;
    const s = 1.2 + rng() * 2.6;
    const M = T(Math.cos(a) * r, -4 + rng() * 12, Math.sin(a) * r, 0, rng() * 3, 0);
    b.stat.add(K.G.cyl8, jitter(FAR.grass, rng), T(0, 0, 0, 0, 0, 0, s * 2, s * 0.25, s * 1.8), M);
    b.stat.add(K.G.cone6, jitter(FAR.rock2, rng), T(0, -s * 0.8, 0, Math.PI, 0, 0, s * 2, s * 1.5, s * 1.8), M);
    if (rng() > 0.5) K.pine({ stat: b.stat }, rng, R_(M, T(0, 0.1, 0)), s * 0.6);
  }
}

// 雲牆：中低高度一圈蓬鬆雲團，把側邊下方填滿並遮住岩柱根部
function cloudWall(rng) {
  const b = new Batch();
  for (let i = 0; i < 70; i++) {
    const a = rng() * Math.PI * 2;
    const r = 42 + rng() * 50;
    const y = -17 + rng() * 7;
    const puffs = 3 + Math.floor(rng() * 4);
    for (let k = 0; k < puffs; k++) {
      const s = 4 + rng() * 6;
      b.add(K.G.ico1, jitter(rng() > 0.5 ? '#fff3e8' : '#ffe1d0', rng, 0.04),
        T(Math.cos(a) * r + (rng() - 0.5) * 8, y + rng() * 2.5, Math.sin(a) * r + (rng() - 0.5) * 8, rng(), rng(), 0, s, s * 0.6, s * (0.8 + rng() * 0.4)));
    }
  }
  const mat = staticMaterial();
  mat.roughness = 1;
  onSky((s) => { mat.color.set(s.cloudTint); mat.emissive.set(s.cloudEmissive[0]); });
  mat.emissiveIntensity = 0.38;
  return b.build(mat, { castShadow: false, receiveShadow: false });
}

export function createVista(seed = 31) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const stat = staticMaterial();
  const warm = glowMaterial('#ffb35c', 2.2);
  const magic = magicMaterial(2.0);
  const farMat = staticMaterial();
  farMat.fog = false;
  onSky((s) => { farMat.color.set(s.farTint); farMat.emissive.set(s.farEmissive); });
  farMat.emissiveIntensity = 0.45;
  const bob = [];
  const anim = [];

  for (const [az, r, y, R, theme, crystal, fall] of MID) {
    const b = { stat: new Batch(), warm: new Batch(), ember: new Batch(), magic: new Batch() };
    const M = T(0, 0, 0, 0, rng() * Math.PI * 2, 0);
    const extra = {};
    isleBase(b, rng, M, R, crystal);
    THEMES[theme](b, rng, M, R, crystal, extra);
    const g = new THREE.Group();
    g.add(b.stat.build(stat, { castShadow: false, receiveShadow: false }));
    g.add(b.warm.build(warm, { castShadow: false, receiveShadow: false }));
    g.add(b.magic.build(magic, { castShadow: false, receiveShadow: false }));
    if (extra.circle) {
      const c = runeCircle(extra.circle.r, crystal, { opacity: 0.55 });
      c.position.y = 0.2;
      g.add(c);
      anim.push((t) => { c.rotation.y = t * 0.2; });
    }
    if (fall) {
      // 瀑布從面向主島的那一側流下（主島在原點，方向＝-位置）
      const out = new THREE.Vector3(-Math.cos(az), 0, -Math.sin(az));
      const wf = createWaterfall(out.clone().multiplyScalar(R * 0.98).setY(-0.15), out, 10 + R * 2, 0.5 + R * 0.12);
      g.add(wf.mesh);
      anim.push((t) => wf.update(t));
    }
    g.position.set(Math.cos(az) * r, y, Math.sin(az) * r);
    group.add(g);
    bob.push({ g, y, ph: rng() * 6, amp: 0.3 + rng() * 0.4 });
  }

  const far = { stat: new Batch(), warm: new Batch(), ember: new Batch(), magic: new Batch() };
  farSpires(far, rng);
  group.add(far.stat.build(farMat, { castShadow: false, receiveShadow: false }));
  group.add(far.warm.build(warm, { castShadow: false, receiveShadow: false }));
  group.add(far.magic.build(magic, { castShadow: false, receiveShadow: false }));
  group.add(cloudWall(rng));

  return {
    group,
    update(t) {
      for (const it of bob) it.g.position.y = it.y + Math.sin(t * 0.3 + it.ph) * it.amp;
      for (const f of anim) f(t);
    },
  };
}
