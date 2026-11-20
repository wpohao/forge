// 浮空島外觀：地形、鐵匠鋪、上百件道具與植被、天空、雲海、煙、火星、瀑布、飛鳥、小浮島。
import * as THREE from 'three';
import { Batch, T, jitter, staticMaterial, glowMaterial, GLOW } from './batch.js';
import { mulberry32 } from './noise.js';
import {
  buildTerrainGeometry, heightAt, inYard, distToPath, edgeRadius, randomPointOnIsland, PATH, POND,
} from './terrain.js';
import { buildForgeHouse } from './forgeHouse.js';
import * as K from './kit.js';
import {
  SKY, onSky, createSky, createCloudSea, createClouds, createSmoke, createEmbers, createFireflies,
  createWaterfall, createBirds,
} from './effects.js';
import { ARCANE, magicMaterial, crystalCluster, runeCircle, floatingRunes, raven } from './arcane.js';
import { createVista } from './vista.js';
import { createIslandCast } from './characters.js';

const HOUSE_M = T(0, 0, -0.6);
const GARDEN = { x0: -6.9, x1: -4.1, z0: 0.6, z1: 3.3 };
const SPOTS = {
  well: new THREE.Vector2(-5.9, -1.4),
  cart: new THREE.Vector2(-2.9, 3.6),
  mailbox: new THREE.Vector2(3.0, 6.8),
  windmill: new THREE.Vector2(-4.6, -5.1),
  obelisk: new THREE.Vector2(6.3, 2.4),
};

function at(x, z, ry = 0, s = 1, dy = 0) {
  return T(x, heightAt(x, z) + dy, z, 0, ry, 0, s);
}

function inGarden(x, z, pad = 0) {
  return x > GARDEN.x0 - pad && x < GARDEN.x1 + pad && z > GARDEN.z0 - pad && z < GARDEN.z1 + pad;
}

function blocked(x, z, pad) {
  if (inYard(x, z, pad)) return true;
  if (distToPath(x, z) < 1.1 + pad * 0.3) return true;
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.8 + pad) return true;
  if (inGarden(x, z, 0.6 + pad * 0.4)) return true;
  for (const s of Object.values(SPOTS)) if (Math.hypot(x - s.x, z - s.y) < 1.4 + pad) return true;
  // 水道
  const d = new THREE.Vector2(POND.x, POND.z).normalize();
  const along = x * d.x + z * d.y;
  const across = Math.abs(-x * d.y + z * d.x);
  if (along > Math.hypot(POND.x, POND.z) && across < 1.1) return true;
  return false;
}

function scatter(rng, n, minGap, pad, placed, margin = 0.9) {
  const out = [];
  let tries = 0;
  while (out.length < n && tries < n * 60) {
    tries++;
    const p = randomPointOnIsland(rng, margin);
    if (blocked(p.x, p.z, pad)) continue;
    if (placed.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < minGap)) continue;
    out.push(p);
    placed.push(p);
  }
  return out;
}

function buildIslet(rng, size, crystal) {
  const b = { stat: new Batch(), warm: new Batch(), ember: new Batch(), magic: new Batch() };
  b.stat.add(K.G.cone6, jitter('#5f5249', rng), T(0, -size * 0.9, 0, Math.PI, rng(), 0, size * 2, size * 1.8, size * 2));
  b.stat.add(K.G.cone6, jitter('#7a5236', rng), T(0, -size * 0.18, 0, Math.PI, rng(), 0, size * 2.05, size * 0.4, size * 2.05));
  b.stat.add(K.G.cyl8, jitter('#78a852', rng), T(0, 0.05, 0, 0, rng(), 0, size * 2.1, 0.18, size * 2.1));
  if (rng() > 0.4) K.pine(b, rng, T(size * 0.2, 0.1, 0, 0, 0, 0, 0.7 * size));
  else K.oak(b, rng, T(size * 0.2, 0.1, 0, 0, 0, 0, 0.6 * size));
  K.rock(b, rng, T(-size * 0.5, 0.1, size * 0.3, 0, 0, 0, 0.4 * size));
  K.bush(b, rng, T(-size * 0.3, 0.1, -size * 0.4, 0, 0, 0, 0.7));
  // 小浮島底部倒掛的魔晶
  for (let i = 0; i < 3; i++) {
    const a = rng() * Math.PI * 2;
    b.magic.add(K.G.oct, jitter(crystal, rng, 0.08), T(Math.cos(a) * size * 0.4, -size * (0.9 + rng() * 0.5), Math.sin(a) * size * 0.4, Math.PI + (rng() - 0.5) * 0.6, rng(), (rng() - 0.5) * 0.6, size * 0.18, size * (0.6 + rng() * 0.4), size * 0.18));
  }
  crystalCluster(b, rng, T(-size * 0.45, 0.1, -size * 0.1), crystal, 0.5 * size);
  const g = new THREE.Group();
  g.add(b.stat.build(staticMaterial()));
  g.add(b.magic.build(magicMaterial(2.2), { castShadow: false, receiveShadow: false }));
  return g;
}

export function buildIsland(tier) {
  const rng = mulberry32(20261106);
  const f = tier.particles;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog('#000000', 45, 150);
  scene.add(createSky());

  // ---------- 光 ----------
  // 夜晚版時 sun 是月光；顏色與強度由 onSky 套用
  const hemi = new THREE.HemisphereLight();
  scene.add(hemi);
  const sun = new THREE.DirectionalLight();
  sun.position.copy(SKY.sunDir).multiplyScalar(40);
  sun.castShadow = tier.shadows;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 5, far: 90 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const fill = new THREE.DirectionalLight();
  fill.position.set(10, 6, 14);
  scene.add(fill);
  onSky((s) => {
    scene.background.copy(s.horizon);
    scene.fog.color.copy(s.below).lerp(s.horizon, 0.5);
    hemi.color.set(s.hemi[0]);
    hemi.groundColor.set(s.hemi[1]);
    hemi.intensity = s.hemi[2];
    sun.color.set(s.sun[0]);
    sun.intensity = s.sun[1];
    fill.color.set(s.fill[0]);
    fill.intensity = s.fill[1];
  });

  const root = new THREE.Group();
  scene.add(root);

  const stat = new Batch();
  const b = { stat, warm: new Batch(), ember: new Batch(), magic: new Batch() };

  // ---------- 地形 ----------
  stat.addColored(buildTerrainGeometry());

  // ---------- 建築 ----------
  const doorMat = new THREE.MeshStandardMaterial({ color: '#2a1206', emissive: '#ffa648', emissiveIntensity: 2.4 * GLOW });
  const house = buildForgeHouse(b, rng, HOUSE_M, doorMat);
  const door = house.door;
  root.add(door);

  // ---------- 小路：石板 + 燈籠 ----------
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i];
    const c = PATH[i + 1];
    const len = a.distanceTo(c);
    const steps = Math.floor(len / 0.62);
    for (let k = 0; k < steps; k++) {
      const p = a.clone().lerp(c, (k + 0.5) / steps);
      const ox = (rng() - 0.5) * 0.25;
      stat.add(K.G.cyl8, jitter(K.COL.stone, rng, 0.1), at(p.x + ox, p.y, rng() * 3, 1, 0.02).multiply(T(0, 0, 0, 0, 0, 0, 0.55 + rng() * 0.15, 0.08, 0.45)));
    }
  }
  const lanterns = [[-0.85, 3.2], [1.35, 4.2], [0.35, 5.9], [2.95, 5.6], [1.35, 7.6]];
  for (const [x, z] of lanterns) {
    let best = null;
    let bd = Infinity;
    for (const p of PATH) { const d = Math.hypot(p.x - x, p.y - z); if (d < bd) { bd = d; best = p; } }
    const ry = -Math.atan2(best.y - z, best.x - x);
    K.lanternPost(b, rng, at(x, z, ry));
  }
  // 路標
  {
    const M = at(-0.9, 6.3, 0.4);
    stat.add(K.G.box, K.COL.woodDark, T(0, 0.75, 0, 0, 0, 0, 0.1, 1.5, 0.1), M);
    stat.add(K.G.box, jitter(K.COL.woodLight, rng), T(0.25, 1.25, 0, 0, 0, -0.08, 0.8, 0.22, 0.05), M);
    stat.add(K.G.box, jitter(K.COL.woodLight, rng), T(-0.2, 0.95, 0, 0, 0.5, 0.06, 0.7, 0.2, 0.05), M);
  }

  // ---------- 院子道具 ----------
  K.swordRack(b, rng, at(-1.95, 2.35, 0));
  K.bench(b, rng, at(1.9, 2.05, 0));
  K.grindstone(b, rng, at(3.35, 2.5, 0.5));
  K.barrel(b, rng, at(3.2, 1.55, 0));
  K.barrel(b, rng, at(3.85, 1.85, 0.4, 0.9));
  K.orePile(b, rng, at(4.9, 2.3));
  K.crate(b, rng, at(-3.25, 1.75, 0.3));
  K.crate(b, rng, at(-3.0, 2.45, -0.2, 0.8));
  K.woodpile(b, rng, at(-3.25, -2.2, Math.PI / 2));
  K.woodpile(b, rng, at(-3.2, -3.35, Math.PI / 2 + 0.1));
  K.cart(b, rng, at(SPOTS.cart.x, SPOTS.cart.y, 0.7));
  K.hayBale(b, rng, at(-4.2, 4.3, 0.3));
  K.hayBale(b, rng, at(-4.0, 4.3, 0.3, 1, 0.6));
  K.well(b, rng, at(SPOTS.well.x, SPOTS.well.y, 0.3));

  // 風車（北側小丘）：石砌塔身 + 木頂 + 會轉的風車葉
  const millBase = new THREE.Vector3(SPOTS.windmill.x, heightAt(SPOTS.windmill.x, SPOTS.windmill.y) - 0.1, SPOTS.windmill.y);
  const millFace = 0.95;
  const blades = new THREE.Group();
  {
    const M = T(millBase.x, millBase.y, millBase.z, 0, millFace, 0);
    for (let r = 0; r < 12; r++) {
      const w = 1.9 - r * 0.07;
      stat.add(K.G.cyl8, jitter(r % 2 ? K.COL.stone : '#9a938a', rng, 0.06), T(0, 0.15 + r * 0.3, 0, 0, r * 0.2, 0, w, 0.3, w), M);
    }
    stat.add(K.G.cyl8, K.COL.woodDark, T(0, 3.75, 0, 0, 0, 0, 1.25, 0.2, 1.25), M);
    stat.add(K.G.cone7, jitter('#7a3e26', rng), T(0, 4.55, 0, 0, 0, 0, 1.6, 1.4, 1.6), M);
    stat.add(K.G.box, K.COL.woodDark, T(0, 0.6, 0.86, 0, 0, 0, 0.55, 1.0, 0.1), M);
    b.warm.add(K.G.box, '#ffffff', T(0, 2.3, 0.72, 0, 0, 0, 0.3, 0.4, 0.04), M);
    stat.add(K.G.cyl8, K.COL.woodDark, T(0, 3.9, 0.85, Math.PI / 2, 0, 0, 0.18, 0.6, 0.18), M);
    const bb = new Batch();
    bb.add(K.G.cyl8, K.COL.woodDark, T(0, 0, 0, Math.PI / 2, 0, 0, 0.32, 0.25, 0.32));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const arm = T(0, 0, 0, 0, 0, a);
      bb.add(K.G.box, K.COL.wood, T(0, 1.55, 0, 0, 0, 0, 0.12, 3.1, 0.08), arm);
      bb.add(K.G.box, jitter('#efe3c6', rng, 0.04), T(0.32, 1.9, 0.02, 0, 0, 0, 0.5, 2.2, 0.03), arm);
      for (let k = 0; k < 4; k++) bb.add(K.G.box, K.COL.woodDark, T(0.32, 0.95 + k * 0.62, 0.04, 0, 0, 0, 0.56, 0.04, 0.03), arm);
    }
    const bladeMesh = bb.build(staticMaterial());
    blades.add(bladeMesh);
    blades.position.set(0, 3.9, 1.2).applyMatrix4(M);
    blades.rotation.y = millFace;
    root.add(blades);
  }

  // 菜園 + 圍籬
  {
    const cx = (GARDEN.x0 + GARDEN.x1) / 2;
    const cz = (GARDEN.z0 + GARDEN.z1) / 2;
    const w = GARDEN.x1 - GARDEN.x0;
    const d = GARDEN.z1 - GARDEN.z0;
    for (let i = 0; i < 4; i++) K.cropRow(b, rng, at(cx, GARDEN.z0 + 0.45 + i * 0.62, 0), w - 0.5);
    K.fence(b, rng, at(cx, GARDEN.z0, 0), w);
    K.fence(b, rng, at(cx - 0.5, GARDEN.z1, 0), w - 1.0);
    K.fence(b, rng, at(GARDEN.x0, cz, Math.PI / 2), d);
    K.fence(b, rng, at(GARDEN.x1, cz, Math.PI / 2), d);
  }

  // 池塘：蘆葦、荷葉
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2;
    const r = POND.r + 0.1 + rng() * 0.3;
    const x = POND.x + Math.cos(a) * r;
    const z = POND.z + Math.sin(a) * r;
    for (let k = 0; k < 3; k++) stat.add(K.G.cone4, jitter('#6f8f3a', rng), at(x + (rng() - 0.5) * 0.2, z + (rng() - 0.5) * 0.2, 0, 1, 0.2).multiply(T(0, 0.15, 0, (rng() - 0.5) * 0.3, 0, (rng() - 0.5) * 0.3, 0.05, 0.75 + rng() * 0.4, 0.05)));
  }
  for (let i = 0; i < 6; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() * (POND.r - 0.4);
    stat.add(K.G.cyl8, jitter('#4f8a3a', rng), T(POND.x + Math.cos(a) * r, -0.3, POND.z + Math.sin(a) * r, 0, rng() * 3, 0, 0.42, 0.02, 0.42));
  }

  // ---------- 植被與石頭 ----------
  const placed = [];
  const trees = scatter(rng, Math.round(36 * Math.max(f, 0.6)), 1.45, 0.9, placed);
  for (const p of trees) {
    // 鏡頭這一側（東南）的高樹會擋住鐵匠鋪正面，改種灌木
    if (p.x > -1.5 && p.z > 2.2) { K.bush(b, rng, at(p.x, p.z, rng() * 3), 1.1 + rng() * 0.5); continue; }
    const s = 0.8 + rng() * 0.55;
    if (p.z < -1 ? rng() < 0.7 : rng() < 0.35) K.pine(b, rng, at(p.x, p.z, rng() * 3, 1, -0.05), s);
    else K.oak(b, rng, at(p.x, p.z, rng() * 3, 1, -0.05), s * 0.95);
  }
  for (const p of scatter(rng, 30, 0.9, 0.4, placed)) K.bush(b, rng, at(p.x, p.z, rng() * 3), 0.9 + rng() * 0.6);
  for (const p of scatter(rng, 26, 0.8, 0.2, placed, 0.5)) K.rock(b, rng, at(p.x, p.z, rng() * 3, 1, -0.05), 0.35 + rng() * 0.5);
  // 島緣大石
  for (let i = 0; i < 22; i++) {
    const th = (i / 22) * Math.PI * 2 + rng() * 0.2;
    const r = edgeRadius(th) - 0.25;
    const x = Math.cos(th) * r;
    const z = Math.sin(th) * r;
    if (blocked(x, z, 0)) continue;
    K.rock(b, rng, at(x, z, rng() * 3, 1, -0.2), 0.5 + rng() * 0.6);
  }
  for (let i = 0; i < Math.round(320 * f + 80); i++) {
    const p = randomPointOnIsland(rng, 0.4);
    if (distToPath(p.x, p.z) < 0.8 || inYard(p.x, p.z, -0.4) || Math.hypot(p.x - POND.x, p.z - POND.z) < POND.r + 0.3) continue;
    K.grassTuft(b, rng, at(p.x, p.z, rng() * 3));
  }
  for (let i = 0; i < Math.round(150 * f + 40); i++) {
    const p = randomPointOnIsland(rng, 0.5);
    if (blocked(p.x, p.z, -0.6)) continue;
    K.flower(b, rng, at(p.x, p.z, 0));
  }

  // ---------- 異世界魔法元素 ----------
  // 島的岩層底部：從岩壁斜刺出來的魔晶（浮空島的魔力來源）
  for (let i = 0; i < 26; i++) {
    const th = (i / 26) * Math.PI * 2 + rng() * 0.15;
    const depth = 1.4 + rng() * 4.2;
    const k = depth < 2.6 ? 0.9 : depth < 3.8 ? 0.72 : 0.5;
    const r = edgeRadius(th) * k;
    const col = [ARCANE.frost, ARCANE.violet, ARCANE.frost, ARCANE.rose][i % 4];
    const len = 0.8 + rng() * 1.6;
    const out = 0.45 + rng() * 0.5; // 往外下方斜（八面體對稱，繞 z 轉正角＝外下方）
    const M = T(Math.cos(th) * r, -depth, Math.sin(th) * r, 0, -th, 0);
    b.magic.add(K.G.oct, jitter(col, rng, 0.08), T(0, -len * 0.3, 0, 0, 0, out, len * 0.22, len, len * 0.22), M);
    if (rng() > 0.5) b.magic.add(K.G.oct, jitter(col, rng, 0.08), T(0, -len * 0.1, 0.25, 0.3, 0, out + 0.3, len * 0.12, len * 0.55, len * 0.12), M);
  }
  // 魔力方尖碑：石台 + 黑曜石柱 + 頂端魔晶 + 環繞符文（東側小丘）
  const OB = new THREE.Vector3(SPOTS.obelisk.x, heightAt(SPOTS.obelisk.x, SPOTS.obelisk.y), SPOTS.obelisk.y);
  {
    const M = T(OB.x, OB.y, OB.z, 0, 0.3, 0);
    for (let k = 0; k < 3; k++) stat.add(K.G.cyl6, jitter(k % 2 ? K.COL.stone : K.COL.stoneDark, rng, 0.06), T(0, 0.12 + k * 0.22, 0, 0, k * 0.4, 0, 1.6 - k * 0.35, 0.24, 1.6 - k * 0.35), M);
    stat.add(K.G.taper6, '#2c2836', T(0, 1.75, 0, 0, 0, 0, 0.5, 2.2, 0.5), M);
    for (let k = 0; k < 4; k++) b.magic.add(K.G.box, ARCANE.frost, T(0, 1.0 + k * 0.45, 0.22 - k * 0.012, 0, 0, k % 2 ? 0.6 : -0.6, 0.05, 0.14, 0.01), M);
    stat.add(K.G.cone6, '#2c2836', T(0, 2.95, 0, 0, 0, 0, 0.42, 0.25, 0.42), M);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      crystalCluster(b, rng, T(OB.x + Math.cos(a) * 0.95, OB.y + 0.05, OB.z + Math.sin(a) * 0.95, 0, a), k % 2 ? ARCANE.frost : ARCANE.violet, 0.28);
    }
  }
  const obCrystal = new THREE.Group();
  {
    const cb = new Batch();
    cb.add(K.G.oct, ARCANE.frost, T(0, 0, 0, 0, 0, 0, 0.5, 0.95, 0.5));
    cb.add(K.G.oct, '#bff4ff', T(0, 0, 0, 0, Math.PI / 4, 0, 0.3, 0.7, 0.3));
    obCrystal.add(cb.build(magicMaterial(2.6), { castShadow: false, receiveShadow: false }));
    obCrystal.position.set(OB.x, OB.y + 3.75, OB.z);
    obCrystal.add(new THREE.PointLight(ARCANE.frost, 10, 9, 1.6));
    root.add(obCrystal);
  }
  const obRunes = floatingRunes(10, ARCANE.frost, { radius: 0.85, size: 0.12 });
  obRunes.group.position.set(OB.x, OB.y + 3.7, OB.z);
  root.add(obRunes.group);
  const obRing = runeCircle(1.25, ARCANE.frost, { opacity: 0.6 });
  obRing.position.set(OB.x, OB.y + 2.4, OB.z);
  obRing.rotation.x = 0.25;
  root.add(obRing);
  // 鐵匠鋪門前的守護法陣
  const doorCircle = runeCircle(1.35, ARCANE.gold, { opacity: 0.45 });
  {
    const p = new THREE.Vector3(0.15, 0, 2.15);
    doorCircle.position.set(p.x, heightAt(p.x, p.z) + 0.06, p.z);
    root.add(doorCircle);
  }
  // 院子與路邊的水晶簇（避開路、池塘、院子）
  for (const [x, z, c, sz] of [[2.6, 6.1, ARCANE.frost, 0.4], [-5.2, 5.6, ARCANE.verdant, 0.55], [4.6, -1.0, ARCANE.rose, 0.5], [-6.8, -3.4, ARCANE.frost, 0.6], [1.0, -6.6, ARCANE.violet, 0.55], [-1.6, -6.9, ARCANE.rose, 0.45]]) {
    if (blocked(x, z, -0.6)) continue;
    crystalCluster(b, rng, at(x, z, rng() * 3, 1, -0.05), c, sz);
  }

  // ---------- 信箱（可點擊，獨立 mesh） ----------
  const mailbox = new THREE.Group();
  {
    const mb = { stat: new Batch() };
    const M = new THREE.Matrix4();
    mb.stat.add(K.G.box, K.COL.woodDark, T(0, 0.55, 0, 0, 0, 0, 0.12, 1.1, 0.12), M);
    mb.stat.add(K.G.box, '#7c2f1c', T(0, 1.2, 0, 0, 0, 0, 0.42, 0.34, 0.62), M);
    mb.stat.add(K.G.cyl12, '#8f3a22', T(0, 1.37, 0, Math.PI / 2, 0, 0, 0.42, 0.62, 0.42), M);
    mb.stat.add(K.G.box, K.COL.gold, T(0, 1.2, 0.315, 0, 0, 0, 0.2, 0.12, 0.02), M);
    mb.stat.add(K.G.box, K.COL.ironDark, T(0.23, 1.35, -0.1, 0, 0, 0, 0.03, 0.3, 0.03), M);
    mb.stat.add(K.G.box, '#d8402c', T(0.23, 1.5, -0.02, 0, 0, 0, 0.03, 0.12, 0.18), M);
    mb.magic = new Batch();
    raven(mb, T(-0.02, 1.58, -0.05, 0, 0.5, 0, 0.75));
    const mesh = mb.stat.build(staticMaterial());
    mailbox.add(mesh);
    mailbox.add(mb.magic.build(magicMaterial(2.4), { castShadow: false, receiveShadow: false }));
    mailbox.position.set(SPOTS.mailbox.x, heightAt(SPOTS.mailbox.x, SPOTS.mailbox.y), SPOTS.mailbox.y);
    mailbox.rotation.y = -0.9;
    mailbox.userData.key = 'mailbox';
    // 點擊範圍
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1, 1.9, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.position.y = 0.95;
    mailbox.add(hit);
    root.add(mailbox);
  }

  // ---------- 合併輸出 ----------
  root.add(stat.build(staticMaterial()));
  const warmMat = glowMaterial('#ffc07a', 2.6);
  const emberMat = glowMaterial('#ff6a1a', 3.2);
  root.add(b.warm.build(warmMat, { castShadow: false, receiveShadow: false }));
  root.add(b.ember.build(emberMat, { castShadow: false, receiveShadow: false }));
  root.add(b.magic.build(magicMaterial(2.2), { castShadow: false, receiveShadow: false }));

  // 水：池塘 + 水道
  const waterMat = new THREE.MeshStandardMaterial({ color: '#4f9fc4', roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.88, flatShading: true });
  const pond = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 0.35, 18), waterMat);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(POND.x, -0.32, POND.z);
  root.add(pond);
  const sd = new THREE.Vector2(POND.x, POND.z).normalize();
  const startR = Math.hypot(POND.x, POND.z);
  const edgeR = edgeRadius(Math.atan2(sd.y, sd.x));
  const streamGeo = new THREE.PlaneGeometry(edgeR - startR + 0.3, 0.8);
  streamGeo.rotateX(-Math.PI / 2);
  const stream = new THREE.Mesh(streamGeo, waterMat);
  stream.rotation.y = -Math.atan2(sd.y, sd.x);
  stream.position.set(sd.x * (startR + edgeR) / 2, -0.34, sd.y * (startR + edgeR) / 2);
  root.add(stream);
  const fall = createWaterfall(new THREE.Vector3(sd.x * (edgeR + 0.02), -0.3, sd.y * (edgeR + 0.02)), new THREE.Vector3(sd.x, 0, sd.y), 12, 0.9);
  root.add(fall.mesh);

  // 點光源：熔爐、門口
  const forgeLight = new THREE.PointLight('#ff7a2a', 15, 7, 1.6);
  forgeLight.position.copy(house.forgeGlow);
  root.add(forgeLight);
  const doorLight = new THREE.PointLight('#ffb060', 8, 6, 1.8);
  doorLight.position.copy(door.position).add(new THREE.Vector3(0, 0.2, 0.8));
  root.add(doorLight);

  // ---------- 動態 ----------
  const smoke = createSmoke(house.chimneyTop, Math.round(18 * Math.max(f, 0.5)));
  root.add(smoke.mesh);
  const forgeSmoke = createSmoke(house.forgeGlow.clone().add(new THREE.Vector3(0, 2.4, 0)), Math.round(10 * Math.max(f, 0.5)), { color: '#bfb3a8', size: 0.35, life: 3.5 });
  root.add(forgeSmoke.mesh);
  const embers = createEmbers(house.forgeSparks, Math.round(40 * f + 10));
  root.add(embers.points);
  const chimneyEmbers = createEmbers(house.chimneyTop, Math.round(14 * f + 4), 0.3);
  root.add(chimneyEmbers.points);
  const flies = createFireflies(Math.round(50 * f + 10), () => {
    const p = randomPointOnIsland(Math.random, 0.8);
    return new THREE.Vector3(p.x, p.y + 0.5 + Math.random() * 1.6, p.z);
  });
  root.add(flies.points);

  scene.add(createCloudSea());
  const clouds = createClouds(Math.round(12 * Math.max(f, 0.5)));
  scene.add(clouds.group);
  const birds = createBirds(7);
  scene.add(birds.group);

  // 環繞島嶼慢慢公轉的浮空魔晶
  const orbit = new THREE.Group();
  {
    const ob = new Batch();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rng() * 0.3;
      const r = 11 + rng() * 3;
      const y = -2.5 + rng() * 5;
      const sz = 0.35 + rng() * 0.45;
      const col = [ARCANE.frost, ARCANE.violet, ARCANE.rose][i % 3];
      ob.add(K.G.oct, jitter(col, rng, 0.06), T(Math.cos(a) * r, y, Math.sin(a) * r, rng(), rng(), rng(), sz, sz * 1.8, sz));
      ob.add(K.G.oct, jitter(col, rng, 0.06), T(Math.cos(a) * r + 0.5, y - 0.4, Math.sin(a) * r, rng(), rng(), rng(), sz * 0.4, sz * 0.8, sz * 0.4));
    }
    orbit.add(ob.build(magicMaterial(2.0), { castShadow: false, receiveShadow: false }));
    scene.add(orbit);
  }
  // 魔力微粒（紫）
  const arcaneMotes = createFireflies(Math.round(40 * f + 8), () => {
    const p = randomPointOnIsland(Math.random, 0.8);
    return new THREE.Vector3(p.x, p.y + 0.8 + Math.random() * 2.4, p.z);
  });
  arcaneMotes.points.material.color.set(new THREE.Color(ARCANE.violet).multiplyScalar(1.5));
  root.add(arcaneMotes.points);

  const islets = [];
  const ISLET_CRYSTAL = [ARCANE.violet, ARCANE.frost, ARCANE.rose, ARCANE.verdant];
  for (const [i, [x, y, z, s]] of [[-15, -1.5, -8, 1.3], [13, 2.5, -12, 1.0], [-11, 4.5, 12, 0.8], [17, -3, 7, 1.1]].entries()) {
    const m = buildIslet(rng, s, ISLET_CRYSTAL[i]);
    m.position.set(x, y, z);
    scene.add(m);
    islets.push({ m, y, ph: rng() * 6 });
  }

  // 背景遠景：中景浮空島、遠方岩柱與城堡、雲牆（填滿完整取景後左右的空白）
  const vista = createVista();
  scene.add(vista.group);
  // 人物：劍士、魔法師、狐靈、史萊姆、小龍（跟著島一起浮動）
  const cast = createIslandCast({ groundY: heightAt, door: door.position, obelisk: SPOTS.obelisk });
  root.add(cast.group);

  const doorTarget = new THREE.Vector3();
  // 取景點（給 src/framing.js）：繞 y 軸對稱的幾圈，島自轉／鏡頭自動環繞時取景依然成立。
  // 由上而下：風車頂、樹梢與屋頂、草皮唇緣、岩壁魔晶、岩層下段、岩底尖端（多留 0.25 給上下浮動）
  const ringPts = (r, y, n = 16) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  });
  const framePoints = [
    ...ringPts(4.3, 11.4), ...ringPts(6.2, 7.0), ...ringPts(10.0, 0.6),
    ...ringPts(8.6, -3.0), ...ringPts(5.2, -6.8), [0.3, -9.6, -0.2],
  ];
  return {
    framePoints,
    scene,
    door,
    interactive: [door, mailbox],
    get doorTarget() { return door.getWorldPosition(doorTarget); },
    // 跟室內一致用廣角（fov 52）；俯角約 14°（原本 18°），比較接近平視，遠景露得更多。距離由 frameIsland 算
    cameraHome: { position: new THREE.Vector3(13.5, 6.7, 17.2), target: new THREE.Vector3(0.2, 1.2, -0.6) },
    fov: 52,
    update(t, dt) {
      root.position.y = Math.sin(t * 0.5) * 0.18;
      doorMat.emissiveIntensity = (2.1 + Math.sin(t * (Math.PI * 2 / 1.6)) * 0.6) * GLOW;
      forgeLight.intensity = 14 + Math.sin(t * 11) * 2.5 + Math.sin(t * 27) * 1.5;
      emberMat.emissiveIntensity = (3.0 + Math.sin(t * 7) * 0.5) * GLOW;
      smoke.update(dt);
      forgeSmoke.update(dt);
      embers.update(dt, t);
      chimneyEmbers.update(dt, t);
      flies.update(dt, t);
      fall.update(t);
      clouds.update(dt);
      birds.update(t);
      blades.rotation.z = t * 0.35;
      for (const it of islets) it.m.position.y = it.y + Math.sin(t * 0.4 + it.ph) * 0.35;
      orbit.rotation.y = t * 0.03;
      obCrystal.rotation.y = t * 0.8;
      obCrystal.position.y = OB.y + 3.75 + Math.sin(t * 1.2) * 0.12;
      obRunes.update(t);
      obRing.rotation.y = t * 0.25;
      doorCircle.rotation.y = -t * 0.08;
      doorCircle.userData.mat.opacity = 0.35 + Math.sin(t * 1.6) * 0.1;
      arcaneMotes.update(dt, t);
      vista.update(t);
      cast.update(t);
    },
  };
}
