// 鐵匠鋪室內：石牆木骨架、木地板、屋樑、窗光；六個可互動物件各自獨立成 mesh（可單獨發光），其餘雜物合併。
import * as THREE from 'three';
import { Batch, T, jitter, staticMaterial, glowMaterial, GLOW } from './batch.js';
import { mulberry32 } from './noise.js';
import * as K from './kit.js';
import { createEmbers, createFireflies, createSmoke } from './effects.js';
import { ARCANE, ENCHANT_COLORS, magicMaterial, crystalCluster, runeCircle, floatingRunes, raven, grimoire } from './arcane.js';
import { createInteriorCast } from './characters.js';
import { createForgeGame } from '../forgeGame.js';

const { G, COL } = K;
const RW = 7; // 半寬
const BACK = -4.6;
const FRONT = 4.6;
const H = 5.2;

function bundle() { return { stat: new Batch(), warm: new Batch(), ember: new Batch(), magic: new Batch() }; }

// ---------- 附魔兵器（4 件，對應 4 類技能；符文顏色＝附魔屬性） ----------
// 語言與框架：冰霜長劍
function frostSword(b, M, c) {
  K.sword(b, M, 1.55);
  for (let k = 0; k < 6; k++) b.magic.add(G.box, c, T(0, 0.45 + k * 0.22, 0.012, 0, 0, k % 2 ? 0.5 : -0.5, 0.035, 0.08, 0.01), M);
  b.magic.add(G.oct, c, T(0, 0.06, 0, 0, 0, 0, 0.09, 0.12, 0.09), M);
  b.stat.add(G.box, COL.gold, T(0, 0.17, 0, 0, 0, 0, 0.36, 0.05, 0.06), M);
}
// 資料與架構：符文戰鎚（穩固、承重）
function runeHammer(b, M, c) {
  b.stat.add(G.box, COL.woodDark, T(0, 0.75, 0, 0, 0, 0, 0.08, 1.5, 0.08), M);
  for (let k = 0; k < 4; k++) b.stat.add(G.box, '#5a3a24', T(0, 0.2 + k * 0.1, 0, 0, 0, 0, 0.1, 0.05, 0.1), M);
  b.stat.add(G.box, COL.iron, T(0, 1.5, 0, 0, 0, 0, 0.56, 0.28, 0.28), M);
  b.stat.add(G.box, COL.ironDark, T(0, 1.5, 0, 0, 0, 0, 0.6, 0.06, 0.3), M);
  b.magic.add(G.box, c, T(0, 1.5, 0.145, 0, 0, Math.PI / 4, 0.12, 0.12, 0.01), M);
  for (const x of [-0.18, 0.18]) b.magic.add(G.box, c, T(x, 1.5, 0.145, 0, 0, 0, 0.03, 0.18, 0.01), M);
}
// 雲端與維運：風之長弓（遠距、機動）
function windBow(b, M, c) {
  for (let i = 0; i < 9; i++) {
    const a = -0.85 + (i / 8) * 1.7;
    b.stat.add(G.box, COL.woodDark, T(-Math.cos(a) * 0.28 + 0.28, 1.0 + Math.sin(a) * 0.78, 0, 0, 0, a, 0.07, 0.22, 0.06), M);
    if (i % 2 === 0) b.magic.add(G.box, c, T(-Math.cos(a) * 0.28 + 0.31, 1.0 + Math.sin(a) * 0.78, 0.03, 0, 0, a, 0.02, 0.1, 0.01), M);
  }
  b.magic.add(G.box, c, T(0.0, 1.0, 0, 0, 0, 0, 0.012, 1.45, 0.012), M);
  b.stat.add(G.box, COL.wood, T(0.18, 0.9, 0.06, 0, 0, 0.05, 0.03, 1.2, 0.03), M);
  b.magic.add(G.cone4, c, T(0.2, 1.53, 0.06, 0, Math.PI / 4, 0, 0.06, 0.12, 0.03), M);
}
// 品質與資安：守護之盾
function wardShield(b, M, c) {
  b.stat.add(G.cyl12, '#2f3f5e', T(0, 1.0, 0, Math.PI / 2, 0, 0, 1.0, 0.08, 1.05), M);
  b.stat.add(G.cyl12, COL.gold, T(0, 1.0, -0.01, Math.PI / 2, 0, 0, 1.06, 0.06, 1.1), M);
  b.stat.add(G.cyl12, COL.gold, T(0, 1.0, 0.05, Math.PI / 2, 0, 0, 0.3, 0.06, 0.3), M);
  b.magic.add(G.oct, c, T(0, 1.0, 0.085, 0, 0, 0, 0.18, 0.26, 0.02), M);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    b.magic.add(G.box, c, T(Math.cos(a) * 0.36, 1.0 + Math.sin(a) * 0.36, 0.06, 0, 0, a, 0.08, 0.025, 0.01), M);
  }
}
const WEAPONS = [frostSword, runeHammer, windBow, wardShield];

export function buildInterior(tier) {
  const rng = mulberry32(1106);
  const f = tier.particles;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#120c08');
  scene.fog = new THREE.Fog('#1a110b', 18, 36);

  scene.add(new THREE.HemisphereLight('#d6a77c', '#2a1a10', 1.25));
  const winLight = new THREE.DirectionalLight('#ffb27a', 1.4);
  winLight.position.set(6, 6, -8);
  winLight.castShadow = tier.shadows;
  winLight.shadow.mapSize.set(1024, 1024);
  Object.assign(winLight.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
  winLight.shadow.bias = -0.0008;
  winLight.shadow.normalBias = 0.03;
  scene.add(winLight);

  const room = bundle();
  const s = room.stat;

  // ---------- 房間 ----------
  // 木地板
  for (let x = -RW; x < RW; x += 0.5) {
    s.add(G.box, jitter('#6b4a30', rng, 0.08), T(x + 0.25, -0.05, (BACK + FRONT) / 2, 0, 0, 0, 0.48, 0.1, FRONT - BACK));
  }
  // 地板往鏡頭方向多延伸一段（暗處），直式螢幕鏡頭在人眼高度時，畫面下緣才不會露出地板盡頭
  for (let x = -RW; x < RW; x += 0.5) {
    s.add(G.box, jitter('#5a3d27', rng, 0.08), T(x + 0.25, -0.05, FRONT + 1.75, 0, 0, 0, 0.48, 0.1, 3.5));
  }
  // 石牆下半 + 灰泥上半 + 木骨架
  const wallStones = (x0, x1, z, alongZ) => {
    for (let r = 0; r < 6; r++) {
      let u = x0 - (r % 2) * 0.25;
      while (u < x1) {
        const w = Math.min(0.45 + rng() * 0.4, x1 - u);
        if (w > 0.05) {
          const c = (u + w / 2);
          const m = alongZ ? T(z, 0.18 + r * 0.32, c, 0, 0, 0, 0.3, 0.3, w * 0.95) : T(c, 0.18 + r * 0.32, z, 0, 0, 0, w * 0.95, 0.3, 0.3);
          s.add(G.box, jitter(rng() > 0.5 ? COL.stone : COL.stoneDark, rng, 0.12), m);
        }
        u += w;
      }
    }
  };
  wallStones(-RW, RW, BACK, false);
  wallStones(BACK, FRONT, -RW, true);
  wallStones(BACK, FRONT, RW, true);
  s.add(G.box, '#cdb990', T(0, 1.95 + (H - 1.95) / 2, BACK - 0.05, 0, 0, 0, RW * 2, H - 1.95, 0.2));
  s.add(G.box, '#c4b087', T(-RW - 0.05, 1.95 + (H - 1.95) / 2, 0, 0, 0, 0, 0.2, H - 1.95, FRONT - BACK));
  s.add(G.box, '#c4b087', T(RW + 0.05, 1.95 + (H - 1.95) / 2, 0, 0, 0, 0, 0.2, H - 1.95, FRONT - BACK));
  for (const x of [-RW, -3.5, 0, 3.5, RW]) s.add(G.box, COL.woodDark, T(x, H / 2, BACK + 0.08, 0, 0, 0, 0.26, H, 0.18));
  for (const z of [BACK, -1.5, 1.5, FRONT]) {
    s.add(G.box, COL.woodDark, T(-RW + 0.08, H / 2, z, 0, 0, 0, 0.18, H, 0.26));
    s.add(G.box, COL.woodDark, T(RW - 0.08, H / 2, z, 0, 0, 0, 0.18, H, 0.26));
  }
  s.add(G.box, COL.woodDark, T(0, 1.98, BACK + 0.1, 0, 0, 0, RW * 2, 0.16, 0.16));
  s.add(G.box, COL.woodDark, T(-RW + 0.1, 1.98, 0, 0, 0, 0, 0.16, 0.16, FRONT - BACK));
  s.add(G.box, COL.woodDark, T(RW - 0.1, 1.98, 0, 0, 0, 0, 0.16, 0.16, FRONT - BACK));
  // 屋樑
  for (const z of [-3.2, -0.6, 2.0]) s.add(G.box, COL.woodDark, T(0, H - 0.2, z, 0, 0, 0, RW * 2, 0.32, 0.32));
  s.add(G.box, COL.woodDark, T(0, H + 0.4, 0, 0, 0, 0, 0.3, 0.3, FRONT - BACK));
  for (const z of [-3.2, -0.6, 2.0]) s.add(G.box, COL.woodDark, T(0, H + 0.12, z, 0, 0, 0, 0.18, 0.6, 0.18));
  s.add(G.box, '#2a1d14', T(0, H + 0.7, 0, 0, 0, 0, RW * 2, 0.1, FRONT - BACK));

  // 窗（後牆右側兩扇、右牆一扇）
  const windowAt = (M) => {
    room.warm.add(G.box, '#ffffff', T(0, 0, 0, 0, 0, 0, 1.0, 1.1, 0.05), M);
    for (const x of [-0.55, 0.55]) s.add(G.box, COL.woodDark, T(x, 0, 0.05, 0, 0, 0, 0.12, 1.3, 0.14), M);
    for (const y of [-0.6, 0.6]) s.add(G.box, COL.woodDark, T(0, y, 0.05, 0, 0, 0, 1.2, 0.12, 0.14), M);
    s.add(G.box, COL.woodDark, T(0, 0, 0.06, 0, 0, 0, 0.06, 1.1, 0.06), M);
    s.add(G.box, COL.woodDark, T(0, 0, 0.06, 0, 0, 0, 1.0, 0.06, 0.06), M);
    s.add(G.box, jitter(COL.plank, rng), T(0, -0.72, 0.15, 0, 0, 0, 1.3, 0.08, 0.3), M);
  };
  windowAt(T(2.2, 3.1, BACK + 0.06));
  windowAt(T(RW - 0.06, 3.1, -2.4, 0, -Math.PI / 2, 0));
  windowAt(T(-1.5, 3.3, BACK + 0.06));
  // 窗光柱（半透明）
  const beamMat = new THREE.MeshBasicMaterial({ color: '#ffcf96', transparent: true, opacity: 0.025, depthWrite: false, blending: THREE.AdditiveBlending });
  const shafts = new THREE.Group();
  for (const [x, z, ry] of [[2.2, BACK + 1.6, 0], [RW - 1.6, -2.4, -Math.PI / 2], [-1.5, BACK + 1.6, 0]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 3.4), beamMat);
    m.position.set(x, 2.1, z);
    m.rotation.set(-0.75, ry, 0);
    m.scale.y = 22;
    shafts.add(m);
  }
  scene.add(shafts);

  // 左牆的門（開著，透出外面的黃昏）
  {
    const M = T(-RW + 0.06, 0, 2.9, 0, Math.PI / 2, 0);
    room.warm.add(G.box, '#ffffff', T(0, 1.15, 0, 0, 0, 0, 1.2, 2.3, 0.04), M);
    for (const x of [-0.7, 0.7]) s.add(G.box, COL.woodDark, T(x, 1.2, 0.05, 0, 0, 0, 0.18, 2.4, 0.18), M);
    s.add(G.box, COL.woodDark, T(0, 2.45, 0.05, 0, 0, 0, 1.6, 0.2, 0.18), M);
    s.add(G.box, jitter('#6e4a2c', rng), T(-0.6 + Math.cos(1.2) * 0.6, 1.15, 0.05 + Math.sin(1.2) * 0.6, 0, -1.2, 0, 1.2, 2.3, 0.08), M);
  }

  // 地毯
  s.add(G.box, '#7a2e22', T(0.2, 0.02, 1.6, 0, 0.05, 0, 3.6, 0.02, 2.2));
  s.add(G.box, '#c99a3a', T(0.2, 0.025, 1.6, 0, 0.05, 0, 3.2, 0.02, 1.8));
  s.add(G.box, '#8a3426', T(0.2, 0.03, 1.6, 0, 0.05, 0, 3.0, 0.02, 1.6));

  // 吊燈（屋樑垂下）
  const hanging = [[-2.2, -0.6], [2.4, -0.6], [0, 2.0]];
  for (const [x, z] of hanging) {
    s.add(G.box, COL.ironDark, T(x, H - 0.75, z, 0, 0, 0, 0.03, 1.0, 0.03));
    s.add(G.cyl8, COL.ironDark, T(x, H - 1.3, z, 0, 0, 0, 0.9, 0.06, 0.9));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      s.add(G.cyl6, '#efe3c6', T(x + Math.cos(a) * 0.38, H - 1.17, z + Math.sin(a) * 0.38, 0, 0, 0, 0.08, 0.22, 0.08));
      room.warm.add(G.cone4, '#ffffff', T(x + Math.cos(a) * 0.38, H - 1.0, z + Math.sin(a) * 0.38, 0, 0, 0, 0.07, 0.12, 0.07));
    }
  }

  // 雜物
  K.barrel(room, rng, T(-6.2, 0, -3.8));
  K.barrel(room, rng, T(-5.5, 0, -4.0, 0, 0.4, 0, 0.9));
  K.barrel(room, rng, T(-6.0, 0.9, -3.85, 0, 0.2, 0, 0.8));
  K.crate(room, rng, T(6.2, 0, 3.6, 0, 0.3));
  K.crate(room, rng, T(5.5, 0, 4.0, 0, -0.2, 0, 0.8));
  K.crate(room, rng, T(6.1, 0.7, 3.7, 0, 0.6, 0, 0.6));
  K.waterBarrel(room, rng, T(-0.1, 0, 0.9));
  K.grindstone(room, rng, T(2.8, 0, 2.6, 0, -0.4));
  K.orePile(room, rng, T(-1.7, 0, -3.8));
  K.woodpile(room, rng, T(-6.1, 0, -1.6, 0, Math.PI / 2));
  K.hayBale(room, rng, T(-5.9, 0, 3.9, 0, 0.2));
  // 牆上層架 + 罐子
  for (const [x, y] of [[-3.0, 3.0], [-3.0, 3.8]]) {
    s.add(G.box, jitter(COL.plank, rng), T(x, y, BACK + 0.25, 0, 0, 0, 2.2, 0.08, 0.4));
    for (let i = 0; i < 6; i++) {
      const c = ['#7a4a8a', '#4a7a5a', '#a0652a', '#5a6a8a', '#8a3a2a'][Math.floor(rng() * 5)];
      s.add(rng() > 0.5 ? G.cyl8 : G.box, jitter(c, rng), T(x - 0.9 + i * 0.36, y + 0.2, BACK + 0.25, 0, rng(), 0, 0.2, 0.32 + rng() * 0.15, 0.2));
    }
  }
  // 掛在牆上的鐵鍊與工具
  for (let i = 0; i < 5; i++) K.hammer(room, T(RW - 0.15, 2.6, 2.2 + i * 0.4, 0, 0, 0.1 * (i % 2 ? 1 : -1)));
  s.add(G.box, jitter(COL.woodLight, rng), T(RW - 0.08, 2.6, 3.0, 0, 0, 0, 0.06, 1.0, 2.2));

  // 魔法素材：牆角水晶簇、層架上的小水晶、掛在屋樑的魔晶燈
  crystalCluster(room, rng, T(6.35, 0, -4.15, 0, 0.4), ARCANE.violet, 0.9);
  crystalCluster(room, rng, T(-6.4, 0, 0.3, 0, 1.2), ARCANE.frost, 0.8);
  crystalCluster(room, rng, T(3.9, 0, 3.9, 0, 2.0), ARCANE.verdant, 0.6);
  crystalCluster(room, rng, T(-2.4, 3.84, BACK + 0.28, 0, 0.3), ARCANE.rose, 0.32);
  crystalCluster(room, rng, T(-3.8, 3.04, BACK + 0.28, 0, 1.1), ARCANE.frost, 0.28);
  // 牆上的魔法陣掛毯（後牆左側）
  s.add(G.box, '#3a2450', T(-6.2, 3.35, BACK + 0.12, 0, 0, 0, 1.1, 1.7, 0.03));
  s.add(G.box, COL.gold, T(-6.2, 4.25, BACK + 0.14, 0, 0, 0, 1.25, 0.07, 0.07));
  for (let k = 0; k < 7; k++) s.add(G.cone4, '#3a2450', T(-6.68 + k * 0.16, 2.42, BACK + 0.12, Math.PI, Math.PI / 4, 0, 0.12, 0.18, 0.03));
  {
    const tap = T(-6.2, 3.4, BACK + 0.14, Math.PI / 2, 0, 0);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      room.magic.add(G.box, ARCANE.violet, T(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42, 0, -a, 0, 0.02, 0.01, 0.115), tap);
    }
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + Math.PI / 2;
      const a2 = ((k + 1) / 3) * Math.PI * 2 + Math.PI / 2;
      const mx = (Math.cos(a) + Math.cos(a2)) * 0.17;
      const mz = (Math.sin(a) + Math.sin(a2)) * 0.17;
      room.magic.add(G.box, ARCANE.violet, T(mx, 0, mz, 0, -(a + a2) / 2 + Math.PI / 2, 0, 0.6, 0.01, 0.02), tap);
    }
    room.magic.add(G.oct, ARCANE.rose, T(0, 0, 0, 0, 0, 0, 0.1, 0.01, 0.16), tap);
  }

  const roomMesh = s.build(staticMaterial());
  scene.add(roomMesh);
  scene.add(room.warm.build(glowMaterial('#ffc07a', 1.7), { castShadow: false, receiveShadow: false }));
  scene.add(room.magic.build(magicMaterial(2.0), { castShadow: false, receiveShadow: false }));

  // 屋樑下飄浮的魔晶燈（小互動：點了叮一聲、閃一下，換成下一種附魔色）
  // 晶體用白色頂點色，顏色放在材質上，換色時只改材質與燈光
  const LAMP_COLORS = [ARCANE.frost, ARCANE.violet, ARCANE.verdant, ARCANE.gold, ARCANE.rose];
  const floaters = [];
  for (const [x, z, ci] of [[-1.0, -2.0, 0], [1.8, 0.8, 1], [-3.2, 1.6, 2], [3.4, -2.6, 3]]) {
    const fb = new Batch();
    fb.add(G.oct, '#ffffff', T(0, 0, 0, 0, 0, 0, 0.16, 0.28, 0.16));
    const mat = magicMaterial(1.35);
    const base = mat.color.r;
    const m = fb.build(mat, { castShadow: false, receiveShadow: false });
    m.position.set(x, 3.6, z);
    scene.add(m);
    const pl = new THREE.PointLight(LAMP_COLORS[ci], 1.6, 4, 1.8);
    m.add(pl);
    const f = { m, y: 3.6, ph: rng() * 6, mat, base, pl, ci, flash: 0 };
    mat.color.set(LAMP_COLORS[ci]).multiplyScalar(base);
    floaters.push(f);
  }

  // ---------- 七個可互動物件 ----------
  const hotspots = new Map();
  const glowParts = []; // 會隨時間變化的發光材質
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const add = (key, build, pos, ry = 0) => {
    const group = new THREE.Group();
    const b = bundle();
    build(b);
    const mat = staticMaterial();
    group.add(b.stat.build(mat));
    if (b.warm.geos.length) group.add(b.warm.build(glowMaterial('#ffc07a', 1.8), { castShadow: false, receiveShadow: false }));
    if (b.ember.geos.length) {
      const em = glowMaterial('#ff6a1a', 3.4);
      group.add(b.ember.build(em, { castShadow: false, receiveShadow: false }));
      glowParts.push({ key, mat: em });
    }
    if (b.magic.geos.length) group.add(b.magic.build(magicMaterial(2.3), { castShadow: false, receiveShadow: false }));
    const bb = new THREE.Box3().setFromObject(group);
    const size = bb.getSize(new THREE.Vector3()).addScalar(0.3);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), hitMat);
    bb.getCenter(hit.position);
    hit.userData.hitbox = true;
    group.add(hit);
    group.position.copy(pos);
    group.rotation.y = ry;
    group.userData.key = key;
    group.userData.mat = mat;
    group.userData.top = new THREE.Vector3(0, bb.max.y + 0.3, 0);
    scene.add(group);
    hotspots.set(key, group);
    return group;
  };

  // 爐火：大型石砌熔爐 + 爐罩 + 煙囪 + 風箱 + 煤桶
  const HEARTH = new THREE.Vector3(-4.3, 0, -3.5);
  add('hearth', (b) => {
    for (let r = 0; r < 5; r++) {
      for (let i = 0; i < 6; i++) {
        const x = -1.25 + i * 0.5 + (r % 2) * 0.12;
        b.stat.add(G.box, jitter(rng() > 0.5 ? COL.stone : COL.stoneDark, rng, 0.12), T(x, 0.12 + r * 0.24, 0.85, 0, 0, 0, 0.48, 0.22, 0.2));
      }
    }
    b.stat.add(G.box, COL.stoneDark, T(0, 0.6, 0, 0, 0, 0, 2.8, 1.2, 1.6));
    b.stat.add(G.box, '#1f140d', T(0, 1.22, 0.1, 0, 0, 0, 1.9, 0.06, 1.1));
    b.ember.add(G.box, '#ffffff', T(0, 1.27, 0.1, 0, 0, 0, 1.8, 0.1, 1.0));
    for (let i = 0; i < 18; i++) b.ember.add(G.ico0, '#ffffff', T(-0.8 + rng() * 1.6, 1.34, -0.35 + rng() * 0.9, rng(), rng(), 0, 0.14 + rng() * 0.1));
    b.stat.add(G.taper6, COL.ironDark, T(0, 2.5, -0.1, 0, Math.PI / 6, 0, 2.3, 1.0, 1.7));
    b.stat.add(G.box, COL.stoneDark, T(0, 4.2, -0.4, 0, 0, 0, 1.0, 2.6, 0.9));
    for (let r = 0; r < 8; r++) b.stat.add(G.box, jitter(COL.stone, rng, 0.1), T(0, 3.0 + r * 0.32, 0.07, 0, 0, 0, 1.05, 0.28, 0.06));
    // 風箱已拆成獨立的小互動（見下方 bellows）
    // 火鉗、煤桶
    b.stat.add(G.box, COL.iron, T(-1.55, 0.9, 0.9, 0, 0, 0.15, 0.04, 1.4, 0.04));
    b.stat.add(G.box, COL.iron, T(-1.48, 0.9, 0.95, 0, 0, 0.05, 0.04, 1.4, 0.04));
    b.stat.add(G.cyl8, COL.ironDark, T(-1.6, 0.3, 1.5, 0, 0, 0, 0.6, 0.6, 0.6));
    for (let i = 0; i < 6; i++) b.stat.add(G.ico0, '#1a1a1d', T(-1.6 + (rng() - 0.5) * 0.3, 0.62, 1.5 + (rng() - 0.5) * 0.3, rng(), rng(), 0, 0.18));
    // 龍焰熔爐：爐罩正面的龍首浮雕（低多邊形），眼睛與鼻孔透出爐火
    const D = T(0, 2.55, 0.78);
    const dark = '#2e2a2c';
    const bronze = '#7a5a32';
    b.stat.add(G.box, dark, T(0, 0.05, 0.1, -0.1, 0, 0, 0.62, 0.42, 0.5), D);        // 頭
    b.stat.add(G.box, dark, T(0, -0.04, 0.42, -0.05, 0, 0, 0.42, 0.26, 0.42), D);    // 口鼻
    b.stat.add(G.box, '#242022', T(0, -0.22, 0.36, 0.25, 0, 0, 0.38, 0.08, 0.4), D); // 下顎
    for (let k = 0; k < 4; k++) b.stat.add(G.cone4, '#e8dcc0', T(-0.14 + k * 0.093, -0.16, 0.56, Math.PI, 0, 0, 0.04, 0.08, 0.04), D); // 牙
    for (const x of [-1, 1]) {
      b.stat.add(G.cone4, bronze, T(x * 0.24, 0.36, -0.05, -0.7, 0, x * -0.35, 0.1, 0.5, 0.1), D);  // 角
      b.stat.add(G.cone4, bronze, T(x * 0.36, 0.12, -0.02, -0.4, 0, x * -1.1, 0.07, 0.3, 0.07), D); // 側角
      b.stat.add(G.box, dark, T(x * 0.2, 0.2, 0.3, 0, 0, x * 0.3, 0.16, 0.06, 0.2), D);             // 眉骨
      b.ember.add(G.box, '#ffffff', T(x * 0.17, 0.12, 0.36, 0, 0, 0, 0.09, 0.05, 0.02), D);          // 眼
      b.ember.add(G.box, '#ffffff', T(x * 0.09, 0.02, 0.635, 0, 0, 0, 0.05, 0.04, 0.02), D);         // 鼻孔
      // 鱗片沿著爐罩兩側
      for (let k = 0; k < 4; k++) b.stat.add(G.cone4, bronze, T(x * (0.9 - k * 0.05), -0.25 + k * 0.17, -0.05 - k * 0.08, -0.5, Math.PI / 4, 0, 0.12, 0.16, 0.06), D);
    }
    // 爐口兩側的龍爪石雕
    for (const x of [-1.2, 1.2]) {
      b.stat.add(G.box, dark, T(x, 1.3, 0.75, 0, 0, 0, 0.32, 0.12, 0.3));
      for (let k = 0; k < 3; k++) b.stat.add(G.cone4, '#e8dcc0', T(x - 0.1 + k * 0.1, 1.22, 0.92, Math.PI / 2 + 0.6, 0, 0, 0.04, 0.12, 0.04));
    }
  }, HEARTH);
  const fireLight = new THREE.PointLight('#ff7a2a', 40, 12, 1.5);
  fireLight.position.set(HEARTH.x, 1.8, HEARTH.z + 1.0);
  fireLight.castShadow = tier.shadows;
  fireLight.shadow.mapSize.set(512, 512);
  scene.add(fireLight);

  // 附魔兵器架：4 件附魔兵器，每件下方有對應顏色的附魔石台
  // 每件兵器的附魔光各自一個 mesh，滑鼠移到哪一件就只亮那一件
  const ARMORY = new THREE.Vector3(0.6, 0, BACK + 0.2);
  const weaponMagic = ENCHANT_COLORS.map(() => new Batch());
  const armoryGroup = add('armory', (b) => {
    b.stat.add(G.box, jitter(COL.woodLight, rng), T(0, 2.1, 0, 0, 0, 0, 4.2, 2.6, 0.12));
    for (const y of [1.0, 3.2]) b.stat.add(G.box, COL.woodDark, T(0, y, 0.1, 0, 0, 0, 4.4, 0.14, 0.14));
    for (const x of [-2.1, 2.1]) b.stat.add(G.box, COL.woodDark, T(x, 2.1, 0.1, 0, 0, 0, 0.14, 2.6, 0.14));
    // 架頂的拱形徽飾
    b.stat.add(G.box, COL.woodDark, T(0, 3.45, 0.1, 0, 0, 0, 1.4, 0.36, 0.14));
    b.stat.add(G.cyl12, COL.gold, T(0, 3.5, 0.18, Math.PI / 2, 0, 0, 0.36, 0.04, 0.36));
    b.magic.add(G.oct, ARCANE.violet, T(0, 3.5, 0.22, 0, 0, 0, 0.12, 0.2, 0.03));
    WEAPONS.forEach((fn, i) => {
      const x = -1.5 + i * 1.0;
      const c = ENCHANT_COLORS[i];
      const wm = weaponMagic[i];
      fn({ stat: b.stat, magic: wm }, T(x, 0.95, 0.2, 0, 0, (i % 2 ? 1 : -1) * 0.03), c);
      b.stat.add(G.box, COL.ironDark, T(x, 2.75, 0.16, 0, 0, 0, 0.14, 0.05, 0.12));
      // 附魔石台 + 發光符文槽
      b.stat.add(G.box, jitter(COL.stoneDark, rng, 0.08), T(x, 0.45, 0.42, 0, 0, 0, 0.62, 0.9, 0.5));
      b.stat.add(G.box, jitter(COL.stone, rng, 0.08), T(x, 0.92, 0.42, 0, 0, 0, 0.7, 0.06, 0.56));
      wm.add(G.box, c, T(x, 0.5, 0.675, 0, 0, Math.PI / 4, 0.16, 0.16, 0.01));
      wm.add(G.box, c, T(x, 0.955, 0.42, 0, 0, 0, 0.44, 0.01, 0.06));
    });
  }, ARMORY);
  const WEAPON_BOOST = 2.3;
  const weapons = weaponMagic.map((wb) => {
    const mat = magicMaterial(WEAPON_BOOST);
    armoryGroup.add(wb.build(mat, { castShadow: false, receiveShadow: false }));
    return { mat, glow: 1, spin: 0 };
  });
  const weaponLight = new THREE.PointLight('#ffffff', 0, 2.6, 1.6);
  scene.add(weaponLight);
  let focusWeapon = -1;
  // 兵器前方繞行的浮空符文
  const runeSets = ENCHANT_COLORS.map((c, i) => {
    const fr = floatingRunes(6, c, { radius: 0.36, size: 0.07, y: 0 });
    fr.group.position.set(ARMORY.x - 1.5 + i * 1.0, 1.25, ARMORY.z + 0.45);
    scene.add(fr.group);
    return fr;
  });

  // 鐵砧：燒紅的劍 + 鐵鎚 + 樹墩
  let swordMat = null;
  add('anvil', (b) => {
    K.stump(b, rng, T(0, 0, 0), 0.6);
    K.anvil(b, rng, T(0, 0.6, 0, 0, 0.2, 0, 1.6));
    // 鐵鎚拆成獨立的小互動（見下方 hammerProp）
    b.stat.add(G.box, COL.iron, T(-0.75, 1.55, -0.2, 0, 0.4, 0.05, 0.04, 0.04, 1.0));
  }, new THREE.Vector3(-1.3, 0, 0.3));
  {
    const g = new THREE.Group();
    const sb = bundle();
    sb.ember.add(G.box, '#ffffff', T(0, 0, 0, 0, 0, 0, 1.5, 0.05, 0.12));
    sb.ember.add(G.cone4, '#ffffff', T(0.85, 0, 0, 0, Math.PI / 4, -Math.PI / 2, 0.12, 0.25, 0.05));
    swordMat = glowMaterial('#ff6a1a', 3.0);
    g.add(sb.ember.build(swordMat, { castShadow: false, receiveShadow: false }));
    const hb = new Batch();
    K.sword({ stat: hb }, T(-0.75, 0, 0, 0, 0, Math.PI / 2), 0.01);
    hb.add(G.box, COL.woodDark, T(-0.98, 0, 0, 0, 0, Math.PI / 2, 0.06, 0.4, 0.06));
    g.add(hb.build(staticMaterial()));
    g.position.set(-1.3, 1.72, 0.3);
    g.rotation.y = 0.2;
    hotspots.get('anvil').attach(g);
  }
  // 鐵砧下的鍛造法陣（還在附魔中，慢慢轉）
  const anvilCircle = runeCircle(1.05, ARCANE.frost, { opacity: 0.55 });
  anvilCircle.position.set(-1.3, 0.045, 0.3);
  scene.add(anvilCircle);
  const anvilRunes = floatingRunes(8, ARCANE.frost, { radius: 0.75, size: 0.06 });
  anvilRunes.group.position.set(-1.3, 1.95, 0.3);
  scene.add(anvilRunes.group);

  // 委託板：三張蠟封委託單 + 兩盞壁燈
  add('commissions', (b) => {
    b.stat.add(G.box, jitter(COL.plank, rng), T(0, 0, 0, 0, 0, 0, 2.4, 1.8, 0.1));
    for (const y of [-0.95, 0.95]) b.stat.add(G.box, COL.woodDark, T(0, y, 0.05, 0, 0, 0, 2.6, 0.14, 0.14));
    for (const x of [-1.25, 1.25]) b.stat.add(G.box, COL.woodDark, T(x, 0, 0.05, 0, 0, 0, 0.14, 2.0, 0.14));
    [[-0.7, 0.2, 0.06], [0.05, 0.3, -0.05], [0.75, 0.1, 0.08]].forEach(([x, y, r]) => {
      b.stat.add(G.box, jitter('#efe3c6', rng, 0.04), T(x, y, 0.08, 0, 0, r, 0.6, 0.85, 0.02));
      for (let k = 0; k < 4; k++) b.stat.add(G.box, '#8a7a60', T(x - 0.05, y + 0.25 - k * 0.14, 0.095, 0, 0, r, 0.42 - (k === 3 ? 0.18 : 0), 0.03, 0.005));
      b.stat.add(G.cyl8, '#a12a1e', T(x + 0.15, y - 0.3, 0.1, Math.PI / 2, 0, 0, 0.16, 0.03, 0.16));
      b.stat.add(G.box, COL.ironDark, T(x, y + 0.4, 0.1, 0, 0, 0, 0.05, 0.05, 0.04));
    });
    b.stat.add(G.box, jitter('#efe3c6', rng), T(-0.3, -0.55, 0.075, 0, 0, -0.1, 0.4, 0.3, 0.02));
    // 冒險者公會徽章：盾形底 + 交叉雙劍 + 魔晶
    b.stat.add(G.box, '#5a2e22', T(0, 1.25, 0.06, 0, 0, 0, 0.7, 0.5, 0.06));
    b.stat.add(G.cone4, '#5a2e22', T(0, 0.92, 0.06, Math.PI, Math.PI / 4, 0, 0.5, 0.3, 0.06));
    for (const r of [-0.7, 0.7]) b.stat.add(G.box, COL.steel, T(0, 1.15, 0.1, 0, 0, r, 0.05, 0.62, 0.02));
    b.stat.add(G.box, COL.gold, T(0, 1.5, 0.08, 0, 0, 0, 0.78, 0.06, 0.07));
    b.magic.add(G.oct, ARCANE.gold, T(0, 1.2, 0.12, 0, 0, 0, 0.12, 0.18, 0.04));
    for (const x of [-1.6, 1.6]) {
      b.stat.add(G.box, COL.ironDark, T(x, 0.2, 0.15, 0, 0, 0, 0.06, 0.3, 0.3));
      b.stat.add(G.box, COL.ironDark, T(x, 0.45, 0.25, 0, 0, 0, 0.22, 0.04, 0.22));
      b.warm.add(G.box, '#ffffff', T(x, 0.6, 0.25, 0, 0, 0, 0.14, 0.22, 0.14));
    }
  }, new THREE.Vector3(4.4, 2.6, BACK + 0.2));

  // 書桌：攤開的帳本、蠟燭、墨水、羽毛筆、卷軸、椅子、書櫃
  add('ledger', (b) => {
    b.stat.add(G.box, jitter(COL.plank, rng), T(0, 1.0, 0, 0, 0, 0, 1.2, 0.1, 2.2));
    for (const [x, z] of [[-0.5, -1.0], [0.5, -1.0], [-0.5, 1.0], [0.5, 1.0]]) b.stat.add(G.box, COL.woodDark, T(x, 0.5, z, 0, 0, 0, 0.1, 1.0, 0.1));
    b.stat.add(G.box, '#5a2a1e', T(-0.05, 1.08, 0.1, 0, 0.1, 0, 0.62, 0.05, 0.9));
    b.stat.add(G.box, '#f3ead6', T(-0.05, 1.12, -0.12, 0, 0.1, 0.06, 0.55, 0.03, 0.42));
    b.stat.add(G.box, '#f3ead6', T(-0.05, 1.12, 0.32, 0, 0.1, -0.06, 0.55, 0.03, 0.42));
    for (let k = 0; k < 5; k++) b.stat.add(G.box, '#9a8a70', T(-0.05, 1.14, -0.25 + k * 0.06, 0, 0.1, 0, 0.4, 0.005, 0.01));
    b.stat.add(G.cyl8, '#efe3c6', T(0.2, 1.25, -0.85, 0, 0, 0, 0.12, 0.4, 0.12));
    b.stat.add(G.cyl8, COL.gold, T(0.2, 1.06, -0.85, 0, 0, 0, 0.3, 0.04, 0.3));
    b.warm.add(G.cone4, '#ffffff', T(0.2, 1.52, -0.85, 0, 0, 0, 0.08, 0.16, 0.08));
    b.stat.add(G.cyl8, '#1f2a4a', T(0.3, 1.12, 0.75, 0, 0, 0, 0.14, 0.14, 0.14));
    b.stat.add(G.box, '#f4f1e8', T(0.3, 1.3, 0.75, 0.4, 0, 0.3, 0.04, 0.45, 0.08));
    for (let i = 0; i < 3; i++) b.stat.add(G.cyl8, jitter('#e3d3b2', rng), T(-0.35, 1.12 + i * 0.1, -0.7 + i * 0.05, 0, 0, Math.PI / 2, 0.1, 0.5, 0.1));
    // 椅子
    b.stat.add(G.box, COL.wood, T(-1.0, 0.55, 0, 0, 0, 0, 0.6, 0.08, 0.6));
    for (const [x, z] of [[-1.25, -0.25], [-0.75, -0.25], [-1.25, 0.25], [-0.75, 0.25]]) b.stat.add(G.box, COL.woodDark, T(x, 0.27, z, 0, 0, 0, 0.07, 0.55, 0.07));
    b.stat.add(G.box, COL.wood, T(-1.3, 1.0, 0, 0, 0, 0, 0.07, 0.9, 0.6));
    // 書櫃
    b.stat.add(G.box, COL.woodDark, T(1.0, 1.5, 0, 0, 0, 0, 0.5, 3.0, 2.0));
    for (let r = 0; r < 4; r++) {
      b.stat.add(G.box, COL.wood, T(0.78, 0.4 + r * 0.72, 0, 0, 0, 0, 0.08, 0.06, 1.9));
      let z = -0.85;
      while (z < 0.85) {
        const w = 0.08 + rng() * 0.08;
        const c = ['#7a2e22', '#2e4a6b', '#3f6b3a', '#8a6a2f', '#5a3a6b'][Math.floor(rng() * 5)];
        b.stat.add(G.box, jitter(c, rng), T(0.85, 0.65 + r * 0.72, z + w / 2, (rng() - 0.5) * 0.12, 0, 0, 0.35, 0.4 + rng() * 0.15, w));
        z += w + 0.01;
      }
    }
  }, new THREE.Vector3(5.6, 0, 0.7));
  const candle = new THREE.PointLight('#ffb060', 6, 5, 1.8);
  candle.position.set(5.8, 1.8, -0.15);
  scene.add(candle);

  // 魔導書架：高書櫃塞滿魔導書（書脊封印發光）＋ 書架前的講台與一本浮空翻開的魔導書
  const BOOK_COLORS = ['#3a2450', '#1f3a5a', '#2f4a2a', '#5a1f24', '#4a3a1a', '#24304a'];
  const SIGILS = [ARCANE.violet, ARCANE.frost, ARCANE.verdant, ARCANE.rose, ARCANE.gold];
  const SHELF = new THREE.Vector3(5.65, 0, -2.85);
  add('shelf', (b) => {
    // 書櫃本體（背靠右牆，local +z 朝房內）
    const back = -0.75;
    b.stat.add(G.box, COL.woodDark, T(0, 1.05, back, 0, 0, 0, 2.0, 2.1, 0.08));
    for (const x of [-1.0, 1.0]) b.stat.add(G.box, COL.woodDark, T(x, 1.05, back + 0.22, 0, 0, 0, 0.1, 2.1, 0.5));
    b.stat.add(G.box, COL.woodDark, T(0, 2.12, back + 0.24, 0, 0, 0, 2.2, 0.1, 0.56));
    // 書櫃頂的尖拱與魔晶
    b.stat.add(G.cone4, COL.woodDark, T(0, 2.32, back + 0.2, 0, Math.PI / 4, 0, 0.8, 0.32, 0.3));
    b.magic.add(G.oct, ARCANE.violet, T(0, 2.34, back + 0.38, 0, 0, 0, 0.1, 0.17, 0.04));
    for (let r = 0; r < 3; r++) {
      const y = 0.12 + r * 0.66;
      b.stat.add(G.box, COL.wood, T(0, y, back + 0.22, 0, 0, 0, 1.92, 0.06, 0.46));
      let x = -0.92;
      while (x < 0.86) {
        const w = 0.09 + rng() * 0.09;
        const h = 0.36 + rng() * 0.2;
        const col = BOOK_COLORS[Math.floor(rng() * BOOK_COLORS.length)];
        const lean = rng() > 0.88 ? 0.25 : (rng() - 0.5) * 0.05;
        const sig = rng() > 0.55 ? SIGILS[Math.floor(rng() * SIGILS.length)] : null;
        grimoire(b, rng, T(x + w / 2, y + 0.03, back + 0.24, 0, 0, lean), col, { w, h, d: 0.36, sigil: sig });
        x += w + 0.012;
      }
      // 層板上的小水晶與燭台
      if (r === 1) crystalCluster(b, rng, T(0.7, y + 0.03, back + 0.3), ARCANE.frost, 0.22);
    }
    // 講台
    const L = T(0, 0, 0.55);
    b.stat.add(G.cyl6, COL.woodDark, T(0, 0.08, 0, 0, 0, 0, 0.6, 0.16, 0.6), L);
    b.stat.add(G.taper6, COL.wood, T(0, 0.6, 0, 0, 0, 0, 0.22, 0.9, 0.22), L);
    b.stat.add(G.box, COL.woodDark, T(0, 1.1, 0, -0.45, 0, 0, 0.7, 0.06, 0.5), L);
    b.stat.add(G.box, COL.gold, T(0, 1.1, 0.24, -0.45, 0, 0, 0.72, 0.04, 0.03), L);
    // 地上的魔導書堆
    for (let i = 0; i < 4; i++) {
      const c = BOOK_COLORS[(i * 2) % BOOK_COLORS.length];
      b.stat.add(G.box, jitter(c, rng), T(-0.75, 0.06 + i * 0.1, 0.45, 0, rng() * 0.8, 0, 0.44, 0.09, 0.32));
    }
  }, SHELF, -Math.PI / 2);
  // 浮空翻開的魔導書（獨立 group，會上下漂並緩慢翻頁發光）
  const floatBook = new THREE.Group();
  {
    const fb = { stat: new Batch(), magic: new Batch() };
    fb.stat.add(G.box, '#3a2450', T(-0.2, 0, 0, 0, 0, 0.12, 0.4, 0.03, 0.52));
    fb.stat.add(G.box, '#3a2450', T(0.2, 0, 0, 0, 0, -0.12, 0.4, 0.03, 0.52));
    fb.stat.add(G.box, '#f3ead6', T(-0.19, 0.03, 0, 0, 0, 0.12, 0.36, 0.03, 0.48));
    fb.stat.add(G.box, '#f3ead6', T(0.19, 0.03, 0, 0, 0, -0.12, 0.36, 0.03, 0.48));
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 5; k++) fb.magic.add(G.box, ARCANE.violet, T(sx * 0.19, 0.05 + (sx < 0 ? 0.0 : 0.0), -0.16 + k * 0.08, 0, 0, sx * -0.12, 0.26 - (k % 2) * 0.08, 0.005, 0.015));
    }
    floatBook.add(fb.stat.build(staticMaterial()));
    floatBook.add(fb.magic.build(magicMaterial(2.4), { castShadow: false, receiveShadow: false }));
  }
  const bookLight = new THREE.PointLight(ARCANE.violet, 3, 3.5, 1.6);
  bookLight.position.y = 0.3;
  floatBook.add(bookLight);
  // 翻頁用的書頁：平常藏起來，點了才一張張從右翻到左（以書脊為軸）
  const pages = [];
  for (let k = 0; k < 4; k++) {
    const pv = new THREE.Group();
    pv.position.y = 0.05;
    const pb = new Batch();
    pb.add(G.box, '#f3ead6', T(0.18, 0, 0, 0, 0, 0, 0.36, 0.006, 0.46));
    pb.add(G.box, ARCANE.violet, T(0.18, 0.004, 0, 0, 0, 0, 0.22, 0.002, 0.012));
    pv.add(pb.build(staticMaterial(), { castShadow: false, receiveShadow: false }));
    pv.visible = false;
    floatBook.add(pv);
    pages.push(pv);
  }
  // 講台在 shelf local z=0.55 → 轉 -90° 後在世界座標 x 往內 0.55
  floatBook.position.set(SHELF.x - 0.55, 1.62, SHELF.z);
  floatBook.rotation.set(-0.35, Math.PI / 2, 0, 'YXZ');
  hotspots.get('shelf').attach(floatBook);
  const bookRunes = floatingRunes(7, ARCANE.violet, { radius: 0.45, size: 0.06 });
  bookRunes.group.position.set(SHELF.x - 0.55, 1.75, SHELF.z);
  scene.add(bookRunes.group);
  const bookCircle = runeCircle(0.55, ARCANE.violet, { opacity: 0.5 });
  bookCircle.position.set(SHELF.x - 0.55, 0.05, SHELF.z);
  scene.add(bookCircle);

  // 傳信渡鴉：壁掛信箱 + 信件 + 渡鴉
  add('mailbox', (b) => {
    b.stat.add(G.box, '#7c2f1c', T(0, 1.4, 0, 0, 0, 0, 0.8, 0.6, 0.35));
    b.stat.add(G.cyl12, '#8f3a22', T(0, 1.7, 0, Math.PI / 2, 0, 0, 0.8, 0.35, 0.8));
    b.stat.add(G.box, COL.gold, T(0, 1.42, 0.18, 0, 0, 0, 0.4, 0.08, 0.02));
    b.stat.add(G.box, COL.woodDark, T(0, 0.55, 0, 0, 0, 0, 0.12, 1.1, 0.12));
    for (let i = 0; i < 5; i++) b.stat.add(G.box, jitter('#efe3c6', rng, 0.05), T(0.65 + (rng() - 0.5) * 0.3, 0.03 + i * 0.03, 0.2 + (rng() - 0.5) * 0.3, 0, rng(), 0, 0.42, 0.02, 0.28));
    // 渡鴉（眼睛帶冰藍魔光）＋ 封蠟上的魔法印記
    raven(b, T(0, 2.05, 0));
    b.magic.add(G.oct, ARCANE.frost, T(0, 1.42, 0.2, 0, 0, 0, 0.08, 0.12, 0.02));
  }, new THREE.Vector3(-4.6, 0, 1.3), Math.PI / 2 + 0.5);

  // ---------- 小互動（點了有反應、不開卡片；userData.prop） ----------
  const props = [];
  const propHit = (parent, w, h, d, pos) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hitMat);
    m.position.copy(pos);
    m.userData.hitbox = true;
    parent.add(m);
    return m;
  };
  const asProp = (obj, name) => { obj.userData.prop = name; props.push(obj); return obj; };

  // 風箱：爐火左前方的木架上，噴嘴朝爐口。點了壓一下鼓風，爐火變旺、噴火星
  const bellows = asProp(new THREE.Group(), 'bellows');
  {
    const sb = new Batch();
    sb.add(G.box, COL.woodDark, T(0, 0.3, 0, 0, 0, 0, 1.15, 0.06, 0.72));
    for (const [x, z] of [[-0.48, -0.3], [0.48, -0.3], [-0.48, 0.3], [0.48, 0.3]]) sb.add(G.box, COL.woodDark, T(x, 0.15, z, 0, 0, 0, 0.07, 0.3, 0.07));
    sb.add(G.box, COL.wood, T(0, 0.36, 0, 0, 0, 0, 1.0, 0.06, 0.7));
    sb.add(G.cone4, COL.iron, T(-0.66, 0.44, 0, Math.PI / 4, 0, Math.PI / 2, 0.13, 0.36, 0.13));
    bellows.add(sb.build(staticMaterial()));
  }
  const leather = new THREE.Group();
  leather.position.set(0.02, 0.39, 0);
  {
    const lb = new Batch();
    lb.add(G.box, '#5a3a24', T(0, 0.1, 0, 0, 0, 0, 0.86, 0.2, 0.64));
    for (const x of [-0.25, 0.05, 0.35]) lb.add(G.box, '#3e2716', T(x, 0.1, 0, 0, 0, 0, 0.03, 0.21, 0.65));
    leather.add(lb.build(staticMaterial()));
  }
  bellows.add(leather);
  const bellowsLid = new THREE.Group();
  bellowsLid.position.set(-0.5, 0.42, 0);
  {
    const tb = new Batch();
    tb.add(G.box, COL.wood, T(0.5, 0, 0, 0, 0, 0, 1.0, 0.06, 0.7));
    tb.add(G.box, COL.woodDark, T(1.14, 0.02, 0, 0, 0, 0, 0.36, 0.05, 0.07));
    tb.add(G.box, COL.woodDark, T(1.3, 0.02, 0, 0, 0, 0, 0.06, 0.05, 0.34));
    bellowsLid.add(tb.build(staticMaterial()));
  }
  bellows.add(bellowsLid);
  propHit(bellows, 1.7, 1.0, 0.95, new THREE.Vector3(0.1, 0.45, 0));
  {
    const pos = new THREE.Vector3(-5.05, 0, -1.75);
    const d = HEARTH.clone().sub(pos).setY(0).normalize();
    bellows.position.copy(pos);
    bellows.rotation.y = Math.atan2(d.z, -d.x); // 本地 -x（噴嘴）朝爐口
  }
  scene.add(bellows);
  const FIRE_MOUTH = new THREE.Vector3(HEARTH.x, 1.4, HEARTH.z + 0.3);
  let pumpT = -9;
  let fireBoost = 0;

  // 魔晶燈：看不見的球形點擊範圍
  floaters.forEach((f, i) => {
    asProp(f.m, 'lamp').userData.lamp = i;
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), hitMat);
    hit.userData.hitbox = true;
    f.m.add(hit);
  });

  // 浮空魔導書：翻頁＋符文散開，接著開書架卡（書架開放時）
  asProp(floatBook, 'tome');
  propHit(floatBook, 0.95, 0.45, 0.75, new THREE.Vector3(0, 0.05, 0));
  let flipT = -9;

  // 工具架：左牆上的木板掛著鐵鎚、火鉗、鐵鍊、馬蹄鐵，點了會晃、叮噹響
  const toolBoard = asProp(new THREE.Group(), 'tools');
  const tools = [];
  {
    const W = -RW + 0.12;
    const bb = new Batch();
    bb.add(G.box, jitter(COL.plank, rng), T(0, 2.78, 0, 0, 0, 0, 0.06, 0.5, 1.75));
    for (const z of [-0.8, 0.8]) bb.add(G.box, COL.woodDark, T(0.02, 2.78, z, 0, 0, 0, 0.08, 0.6, 0.08));
    toolBoard.add(bb.build(staticMaterial()));
    const hang = (z, build) => {
      const pv = new THREE.Group();
      pv.position.set(0.1, 2.88, z);
      const tb = new Batch();
      tb.add(G.box, COL.ironDark, T(-0.04, 0.02, 0, 0, 0, Math.PI / 2, 0.03, 0.1, 0.03));
      build(tb);
      pv.add(tb.build(staticMaterial()));
      toolBoard.add(pv);
      tools.push({ pv, amp: 0, ph: 0 });
    };
    // 鐵鎚（頭朝下）
    hang(-0.62, (b) => {
      b.add(G.box, COL.wood, T(0, -0.26, 0, 0, 0, 0, 0.045, 0.5, 0.045));
      b.add(G.box, COL.iron, T(0, -0.53, 0, 0, 0, 0, 0.09, 0.1, 0.24));
    });
    // 火鉗
    hang(-0.22, (b) => {
      for (const r of [-0.07, 0.07]) b.add(G.box, COL.iron, T(0, -0.32, r * 0.6, r, 0, 0, 0.03, 0.62, 0.03));
      b.add(G.box, COL.ironDark, T(0, -0.62, 0, 0, 0, 0, 0.05, 0.06, 0.12));
    });
    // 鐵鍊
    hang(0.2, (b) => {
      for (let k = 0; k < 6; k++) {
        const y = -0.06 - k * 0.1;
        if (k % 2) b.add(G.box, COL.iron, T(0, y, 0, 0, 0, 0, 0.02, 0.11, 0.07));
        else b.add(G.box, COL.iron, T(0, y, 0, 0, 0, 0, 0.07, 0.11, 0.02));
      }
    });
    // 馬蹄鐵（U 形朝下掛）
    hang(0.6, (b) => {
      for (let k = 0; k < 9; k++) {
        const a = (k / 8) * Math.PI * 1.25 - Math.PI * 0.125;
        b.add(G.box, COL.steel, T(0, -0.2 - Math.sin(a) * 0.13, Math.cos(a) * 0.13, a, 0, 0, 0.04, 0.05, 0.06));
      }
    });
    propHit(toolBoard, 0.45, 1.0, 1.85, new THREE.Vector3(0.12, 2.6, 0));
    // 抬高到傳信渡鴉上方，預設視角才不會被渡鴉擋住
    toolBoard.position.set(W, 0.65, -2.05);
  }
  scene.add(toolBoard);

  // 鐵砧上的鐵鎚（擺著不動）：點了跟點鐵匠老闆一樣，進入第一人稱打鐵
  const ANVIL = hotspots.get('anvil').position.clone();
  const hammerProp = asProp(new THREE.Group(), 'hammer');
  hammerProp.position.copy(ANVIL);
  const REST = { p: new THREE.Vector3(0.55, 1.62, 0.45), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0.9, 0)) };
  {
    const ham = new THREE.Group();
    const hb = { stat: new Batch() };
    K.hammer(hb, T(0, 0, 0, 0, 0, 0, 1.4));
    ham.add(hb.stat.build(staticMaterial()));
    ham.position.copy(REST.p);
    ham.quaternion.copy(REST.q);
    hammerProp.add(ham);
  }
  propHit(hammerProp, 0.95, 0.6, 0.85, REST.p.clone().add(new THREE.Vector3(0, 0.05, 0.05)));
  scene.add(hammerProp);
  let heat = 0;

  // ---------- 第一人稱打鐵（點鐵匠老闆或鐵砧上的鐵鎚進入） ----------
  // 鏡頭站在鐵砧前方往下看，劍身橫在畫面中間；鐵鎚跟著游標在鐵砧上方移動，點一下敲一記，
  // 每 5 下完成一次附魔（依序冰霜、符文、疾風、守護，對應兵器架的 4 類技能）
  const FORGE_VIEW = {
    position: new THREE.Vector3(ANVIL.x + 0.1, 3.1, ANVIL.z + 3.0),
    target: new THREE.Vector3(ANVIL.x + 0.1, 1.45, ANVIL.z - 0.35),
  };
  const STRIKE_Y = 1.76; // 劍身上緣的高度，鐵鎚打在這個平面上
  const AIM_BOX = { x0: ANVIL.x - 1.0, x1: ANVIL.x + 1.0, z0: ANVIL.z - 0.45, z1: ANVIL.z + 0.5 };
  const BLADE = new THREE.Vector3(ANVIL.x, STRIKE_Y, ANVIL.z);
  const game = createForgeGame();
  const fpHam = new THREE.Group(); // 原點在錘面中心：放在敲擊點上，錘面剛好碰到劍
  {
    const hb = { stat: new Batch(), magic: new Batch() };
    hb.stat.add(G.box, COL.iron, T(0, 0.16, 0, 0, 0, 0, 0.18, 0.3, 0.18));
    for (const y of [0.04, 0.28]) hb.stat.add(G.box, COL.ironDark, T(0, y, 0, 0, 0, 0, 0.2, 0.04, 0.2));
    hb.stat.add(G.box, COL.wood, T(0.42, 0.16, 0, 0, 0, 0, 0.7, 0.06, 0.06));
    hb.stat.add(G.box, '#5a3a24', T(0.7, 0.16, 0, 0, 0, 0, 0.2, 0.075, 0.075));
    hb.stat.add(G.box, COL.gold, T(0.09, 0.16, 0, 0, 0, 0, 0.03, 0.09, 0.09));
    for (const s of [-1, 1]) hb.magic.add(G.oct, '#ffffff', T(0, 0.16, s * 0.095, Math.PI / 2, 0, 0, 0.05, 0.08, 0.02));
    fpHam.add(hb.stat.build(staticMaterial(), { castShadow: false, receiveShadow: false }));
    fpHam.add(hb.magic.build(magicMaterial(2.4), { castShadow: false, receiveShadow: false }));
  }
  const fpRune = fpHam.children[1].material;
  fpHam.visible = false;
  scene.add(fpHam);
  const FP_YAW = -0.67; // 握把朝右前方（朝鏡頭那一側）
  const aim = BLADE.clone();
  const fpPos = BLADE.clone();
  const swingFp = { t: -9, hit: true, from: new THREE.Vector3() };
  let forging = false;
  let enchantKind = -1; // 劍目前帶著哪一種附魔（-1＝沒有）

  // 附魔成功：同色法陣向外擴散、符文往上飄、一陣同色閃光
  const enchantFx = ENCHANT_COLORS.map((c) => {
    const ring = runeCircle(1.0, c, { opacity: 1 });
    ring.position.set(ANVIL.x, 0.06, ANVIL.z);
    ring.visible = false;
    scene.add(ring);
    const runes = floatingRunes(10, c, { radius: 0.7, size: 0.09 });
    runes.group.position.set(ANVIL.x, STRIKE_Y, ANVIL.z);
    runes.group.visible = false;
    scene.add(runes.group);
    return { ring, runes, color: new THREE.Color(c) };
  });
  const enchantLight = new THREE.PointLight('#ffffff', 0, 6, 1.4);
  enchantLight.position.set(ANVIL.x, 2.3, ANVIL.z + 0.3);
  scene.add(enchantLight);
  let enchantT = -9;
  let enchantShow = -1;

  // 弓箭手射向魔晶燈的魔光箭
  const arrow = new THREE.Group();
  {
    const ab = new Batch();
    ab.add(G.box, '#ffffff', T(0, 0, 0, 0, 0, 0, 0.025, 0.025, 0.55));
    ab.add(G.oct, '#ffffff', T(0, 0, 0.3, Math.PI / 2, 0, 0, 0.05, 0.1, 0.05));
    for (const r of [0, Math.PI / 2]) ab.add(G.box, '#ffffff', T(0, 0, -0.24, 0, 0, r, 0.09, 0.008, 0.1));
    const am = magicMaterial(2.6);
    am.color.set(ARCANE.verdant).multiplyScalar(2.6 * 0.5);
    arrow.add(ab.build(am, { castShadow: false, receiveShadow: false }));
  }
  arrow.scale.setScalar(1.8);
  arrow.visible = false;
  scene.add(arrow);
  const shot = { t: -9, from: new THREE.Vector3(), lamp: null, dur: 0.38 };

  let fx = { burst() {}, sound() {} };
  let now = 0;
  const flashLamp = (f, step = 1) => {
    f.ci = (f.ci + step) % LAMP_COLORS.length;
    f.mat.color.set(LAMP_COLORS[f.ci]).multiplyScalar(f.base);
    f.pl.color.set(LAMP_COLORS[f.ci]);
    f.flash = 1;
    fx.sound('chime', f.ci);
  };
  // 弓箭手：挑仰角最小（最好瞄）的那盞燈
  const archerTarget = () => {
    const a = cast.archer.root.position;
    let best = floaters[0];
    let bestE = Infinity;
    for (const f of floaters) {
      const e = (f.m.position.y - 1.6) / Math.hypot(f.m.position.x - a.x, f.m.position.z - a.z);
      if (e < bestE) { bestE = e; best = f; }
    }
    return best;
  };

  // ---------- 動態 ----------
  const embers = createEmbers(new THREE.Vector3(HEARTH.x, 1.35, HEARTH.z + 0.1), Math.round(50 * f + 12), 1.4);
  scene.add(embers.points);
  const dust = createFireflies(Math.round(70 * f + 10), () => new THREE.Vector3((Math.random() - 0.5) * 12, 0.4 + Math.random() * 4, BACK + Math.random() * 8));
  dust.points.material.color.set('#ffd9a8');
  dust.points.material.size = 0.04;
  scene.add(dust.points);
  const steam = createSmoke(new THREE.Vector3(-0.1, 0.95, 0.9), Math.round(6 * Math.max(f, 0.5)), { color: '#f2ece4', size: 0.22, life: 3, rise: 0.5, drift: new THREE.Vector3(0.05, 0, 0.02) });
  scene.add(steam.mesh);
  // 魔力微粒：紫與冰藍
  const motes = createFireflies(Math.round(40 * f + 8), () => new THREE.Vector3((Math.random() - 0.5) * 12, 0.6 + Math.random() * 3.6, BACK + 0.5 + Math.random() * 7));
  motes.points.material.color.set(new THREE.Color(ARCANE.violet).multiplyScalar(1.6));
  motes.points.material.size = 0.06;
  scene.add(motes.points);
  const motes2 = createFireflies(Math.round(30 * f + 6), () => new THREE.Vector3(SHELF.x - 0.6 + (Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 2.4, SHELF.z + (Math.random() - 0.5) * 2));
  motes2.points.material.color.set(new THREE.Color(ARCANE.frost).multiplyScalar(1.6));
  motes2.points.material.size = 0.05;
  scene.add(motes2.points);

  // 人物：鐵匠老闆在鐵砧旁打鐵、弓箭手客人看兵器、壁爐邊睡著的黑貓魔寵（可點，只有動作，見 characters.js）
  const cast = createInteriorCast();
  scene.add(cast.group);
  props.push(...cast.props);

  const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const _v = new THREE.Vector3();

  const RAISE_Y = 0.5; // 待命時鐵鎚舉在敲擊點上方多高
  const HIT_AT = 0.08; // 點下去到錘面碰到劍的時間（秒）
  const SWING_END = 0.34;

  function startEnchant(kind) {
    enchantKind = kind;
    enchantShow = kind;
    enchantT = now;
    enchantFx.forEach((e, i) => { e.ring.visible = i === kind; e.runes.group.visible = i === kind; });
    enchantLight.color.copy(enchantFx[kind].color);
    fpRune.color.copy(enchantFx[kind].color).multiplyScalar(2.4 * GLOW);
    fx.burst(BLADE, 40);
    fx.sound('enchant', kind);
    fx.enchanted?.(kind);
  }

  // 第一人稱鐵鎚：待命時舉在游標位置上方（往後翹），點下去 0.08 秒落到劍上、再彈回
  function updateForge(dt) {
    if (!forging) return;
    const e = now - swingFp.t;
    const swinging = e < SWING_END;
    if (!swinging) fpPos.lerp(aim, Math.min(1, dt * 14));
    let lift;
    let tilt;
    if (e < HIT_AT) {
      const k = (e / HIT_AT) ** 2;
      lift = RAISE_Y * (1 - k);
      tilt = -0.55 * (1 - k);
      fpPos.lerpVectors(swingFp.from, aim, k);
    } else if (swinging) {
      const k = smooth((e - HIT_AT) / (SWING_END - HIT_AT));
      lift = RAISE_Y * k;
      tilt = -0.55 * k;
    } else {
      lift = RAISE_Y + Math.sin(now * 3) * 0.02;
      tilt = -0.55;
    }
    fpHam.position.set(fpPos.x, fpPos.y + lift, fpPos.z);
    fpHam.rotation.set(0, FP_YAW, tilt);
    if (e >= HIT_AT && !swingFp.hit) {
      swingFp.hit = true;
      fx.burst(fpPos, 28);
      fx.sound('hammer');
      heat = 1;
      const r = game.strike();
      fx.forgeProgress?.(r.count, game.per, r.enchanted ?? game.kind);
      if (r.enchanted !== null) startEnchant(r.enchanted);
    }
  }

  // 附魔成功的特效：1.8 秒內法陣擴散淡出、符文上升、閃光衰減
  function updateEnchantFx() {
    const e = now - enchantT;
    const k = Math.min(1, e / 1.8);
    if (enchantShow >= 0) {
      const fxs = enchantFx[enchantShow];
      const out = 1 - (1 - k) ** 3;
      fxs.ring.scale.setScalar(0.5 + out * 2.2);
      fxs.ring.rotation.y = e * 1.5;
      fxs.ring.userData.mat.opacity = 1 - k;
      fxs.runes.group.position.y = STRIKE_Y + out * 1.3;
      fxs.runes.group.scale.setScalar(1 + out * 0.8);
      fxs.runes.group.rotation.y = e * 2.2;
      if (k >= 1) { fxs.ring.visible = false; fxs.runes.group.visible = false; enchantShow = -1; }
    }
    enchantLight.intensity = e < 1.8 ? 16 * (1 - k) ** 2 : 0;
  }

  let hovered = null;
  return {
    scene,
    hotspots,
    interactive: [...hotspots.values()],
    // 小互動（點了有反應、不開卡片）；userData.prop 是名稱
    props,
    viewTarget: new THREE.Vector3(0, 1.6, -1.6),
    // 鏡頭往後拉＋廣角（fov 52），房間看起來比較寬敞；高度約人眼（2.5），接近平視；畫面下緣與左右仍落在地板與牆內
    cameraHome: { position: new THREE.Vector3(0.4, 2.5, 8.9), target: new THREE.Vector3(0, 1.55, -1.6) },
    fov: 52,
    // 特效與音效由 main.js 提供：burst(世界座標, 數量)、sound(名稱, 參數)；
    // 打鐵時另有 forgeProgress(已敲幾下, 每輪幾下, 附魔種類)、enchanted(附魔種類)
    setFx(f) { fx = f; },
    // ---------- 第一人稱打鐵 ----------
    forgeView: FORGE_VIEW,
    get forging() { return forging; },
    get forgeGame() { return game; },
    enterForgeMode() {
      forging = true;
      game.reset();
      aim.copy(BLADE);
      fpPos.copy(BLADE);
      swingFp.t = -9;
      swingFp.hit = true;
      fpRune.color.copy(enchantFx[enchantKind >= 0 ? enchantKind : game.kind].color).multiplyScalar(2.4 * GLOW);
      fpHam.visible = true;
      hammerProp.visible = false;
      // 水桶的蒸氣在第一人稱視角會貼在鏡頭前變成大灰球，打鐵時先收起來
      steam.mesh.visible = false;
      cast.smith.root.visible = false;
      fx.forgeProgress?.(0, game.per, game.kind);
    },
    exitForgeMode() {
      forging = false;
      fpHam.visible = false;
      hammerProp.visible = true;
      steam.mesh.visible = true;
      cast.smith.root.visible = true;
      enchantKind = -1;
      // 放下鐵鎚：老闆回到鐵砧邊，舉錘向你致意
      if (cast.smith.poke(now)) fx.sound('salute');
    },
    // 鐵鎚瞄準：射線打在劍身高度的水平面上，限制在鐵砧周圍
    forgeAim(ray) {
      if (!forging || Math.abs(ray.direction.y) < 1e-4) return;
      const d = (STRIKE_Y - ray.origin.y) / ray.direction.y;
      if (d <= 0) return;
      const x = ray.origin.x + ray.direction.x * d;
      const z = ray.origin.z + ray.direction.z * d;
      aim.set(Math.min(AIM_BOX.x1, Math.max(AIM_BOX.x0, x)), STRIKE_Y, Math.min(AIM_BOX.z1, Math.max(AIM_BOX.z0, z)));
    },
    forgeStrike() {
      if (!forging) return;
      const e = now - swingFp.t;
      // 錘還沒落下就不重複起手（落下之後就能再敲，連點也跟得上）
      if (e < HIT_AT) return;
      swingFp.from.copy(fpPos);
      swingFp.t = now;
      swingFp.hit = false;
    },
    // 互動動畫的時鐘（秒），自動化測試用來等動畫到某個時間點
    get clock() { return now; },
    propByName(name) { return props.find((o) => o.userData.prop === name) ?? null; },
    labelAnchor(key) {
      if (key === 'hammer') return hammerProp.localToWorld(REST.p.clone().add(new THREE.Vector3(0, 0.45, 0)));
      const g = hotspots.get(key);
      return g ? g.localToWorld(g.userData.top.clone()) : null;
    },
    // 兵器架上游標下的是第幾件兵器（0–3），不在任何一件上回傳 -1
    weaponAt(point) {
      const p = armoryGroup.worldToLocal(point.clone());
      const i = Math.round(p.x + 1.5);
      return i >= 0 && i < 4 && Math.abs(p.x - (i - 1.5)) < 0.5 && p.y > 0.3 && p.y < 3.1 ? i : -1;
    },
    // 點了小互動；回傳 { open, delay } 表示接著要開哪張卡、{ forge: true } 表示進入第一人稱打鐵（都由 main.js 處理）
    poke(name, obj) {
      switch (name) {
        case 'bellows':
          if (now - pumpT > 0.55) { pumpT = now; fx.sound('whoosh'); }
          return null;
        case 'lamp':
          flashLamp(floaters[obj.userData.lamp]);
          return null;
        case 'tome':
          if (now - flipT > 1.3) { flipT = now; fx.sound('rustle'); }
          return { open: 'shelf', delay: 750 };
        case 'tools':
          for (const tl of tools) { tl.amp = 0.35 + Math.random() * 0.25; tl.ph = Math.random() * Math.PI; tl.t = now; }
          fx.sound('clink');
          return null;
        case 'hammer':
        case 'smith':
          return { forge: true };
        case 'cat': {
          const r = cast.cat.poke(now);
          if (r) fx.sound(r === 'purr' ? 'purr' : 'rustle');
          return null;
        }
        case 'archer': {
          const lamp = archerTarget();
          cast.archer.poke(now, lamp.m.position, () => {
            fx.sound('twang');
            cast.archer.handPos(shot.from);
            shot.lamp = lamp;
            shot.t = now;
            arrow.visible = true;
          });
          return null;
        }
        default:
          return null;
      }
    },
    update(t, dt) {
      // 互動動畫用自己的時鐘（減少動態模式下 t 固定為 0，但使用者點的動作仍要播完）
      now += dt;
      // 風箱：壓下 0.18s、彈回 0.4s；壓到底時爐火變旺、噴火星
      const pe = now - pumpT;
      const press = pe < 0.18 ? smooth(pe / 0.18) : pe < 0.6 ? 1 - smooth((pe - 0.18) / 0.42) : 0;
      if (pe >= 0.18 && pe - dt < 0.18) { fireBoost = 1; fx.burst(FIRE_MOUTH, 40); }
      fireBoost = Math.max(0, fireBoost - dt * 0.7);
      const ang = 0.26 - press * 0.22;
      bellowsLid.rotation.z = ang;
      leather.scale.y = (0.03 + 0.5 * Math.sin(ang)) / 0.2;

      fireLight.intensity = (36 + Math.sin(t * 9) * 5 + Math.sin(t * 23) * 3) * (1 + fireBoost * 0.9);
      candle.intensity = 5.5 + Math.sin(t * 13) * 0.8;
      for (const g of glowParts) g.mat.emissiveIntensity = (3.0 + Math.sin(t * 6 + 1) * 0.5) * GLOW * (1 + fireBoost * 0.8);

      // 燒紅的劍：20 秒週期由亮橘冷卻到暗紅再回熱；敲打時更亮。
      // 打鐵附魔後，劍身換成那一種附魔色（離開打鐵就恢復）
      updateForge(dt);
      updateEnchantFx();
      heat = Math.max(0, heat - dt * 1.3);
      const k = Math.min(1, 0.5 + 0.5 * Math.cos((t / 20) * Math.PI * 2) + heat * 0.5);
      swordMat.emissive.setRGB(1.0, 0.18 + 0.4 * k, 0.04 + 0.12 * k);
      swordMat.emissiveIntensity = (0.6 + 2.8 * k) * GLOW;
      if (enchantKind >= 0) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 4);
        swordMat.emissive.lerp(enchantFx[enchantKind].color, 0.85);
        swordMat.emissiveIntensity = (1.6 + pulse * 0.8 + heat) * GLOW;
      }

      embers.update(dt, t);
      dust.update(dt, t);
      steam.update(dt);
      motes.update(dt, t);
      motes2.update(dt, t);
      cast.update(t, now);

      // 兵器架：游標下那件的附魔變亮、符文變大轉快，並打一盞同色的光
      weapons.forEach((w, i) => {
        const target = i === focusWeapon ? 2.0 : 1;
        w.glow += (target - w.glow) * Math.min(1, dt * 8);
        w.mat.color.setScalar(WEAPON_BOOST * GLOW * w.glow);
        w.spin += dt * (w.glow - 1) * 2.5;
        runeSets[i].update(t);
        runeSets[i].group.rotation.y += w.spin;
        runeSets[i].group.scale.setScalar(1 + (w.glow - 1) * 0.5);
      });
      if (focusWeapon >= 0) {
        weaponLight.color.set(ENCHANT_COLORS[focusWeapon]);
        weaponLight.position.set(ARMORY.x - 1.5 + focusWeapon, 1.5, ARMORY.z + 0.8);
      }
      weaponLight.intensity += ((focusWeapon >= 0 ? 3 : 0) - weaponLight.intensity) * Math.min(1, dt * 8);

      anvilRunes.update(t);
      anvilRunes.group.rotation.y += heat * 0.4;
      bookRunes.update(t);
      anvilCircle.rotation.y = t * 0.12;
      bookCircle.rotation.y = -t * 0.2;
      anvilCircle.userData.mat.opacity = 0.45 + Math.sin(t * 1.4) * 0.12 + heat * 0.25;
      floatBook.position.y = 1.62 + Math.sin(t * 1.1) * 0.06;

      // 魔導書翻頁：4 張書頁依序從右翻到左，符文向外散開再收回
      const fe = now - flipT;
      pages.forEach((pv, i) => {
        const pk = (fe - i * 0.13) / 0.36;
        pv.visible = pk > 0 && pk < 1;
        pv.rotation.z = -0.12 + (Math.PI + 0.24) * smooth(pk);
      });
      const burst = fe < 1.3 ? Math.sin((fe / 1.3) * Math.PI) : 0;
      bookRunes.group.scale.setScalar(1 + burst * 1.4);
      bookLight.intensity = 3 + burst * 7;

      for (const fl of floaters) {
        fl.flash = Math.max(0, fl.flash - dt * 1.8);
        fl.m.position.y = fl.y + Math.sin(t * 0.8 + fl.ph) * 0.15;
        fl.m.rotation.y = t * 0.6 + fl.ph + fl.flash * 4;
        fl.m.scale.setScalar(1 + fl.flash * 0.7);
        fl.pl.intensity = 1.6 + fl.flash * 6;
      }

      // 工具晃動：阻尼擺動
      for (const tl of tools) {
        const te = now - (tl.t ?? -99);
        tl.pv.rotation.x = te < 4 ? tl.amp * Math.exp(-te * 1.6) * Math.sin(te * 7.5 + tl.ph) : 0;
      }

      // 魔光箭：從弓箭手手上飛到魔晶燈，命中時燈換色
      if (arrow.visible) {
        const ak = (now - shot.t) / shot.dur;
        _v.copy(shot.lamp.m.position);
        if (ak >= 1) {
          arrow.visible = false;
          flashLamp(shot.lamp);
          fx.burst(_v, 14);
        } else {
          arrow.position.lerpVectors(shot.from, _v, ak);
          arrow.lookAt(_v);
        }
      }
    },
    // key：滑鼠下的內容物件；weapon：在兵器架上時是第幾件（-1＝不在任何一件上）
    setHover(key, weapon = -1) {
      focusWeapon = key === 'armory' ? weapon : -1;
      if (hovered === key) return;
      hovered = key;
      for (const [k, g] of hotspots) {
        const m = g.userData.mat;
        if (k === key) { m.emissive.set('#7a3a12'); m.emissiveIntensity = 0.55; } else { m.emissive.set('#000000'); m.emissiveIntensity = 1; }
      }
    },
  };
}
