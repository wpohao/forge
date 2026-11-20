// 場景人物：冒險者、異世界寵物、鐵匠老闆。沒有對話、不開內容卡（見 AGENTS.md）。
// 島上人物純氣氛不可點；室內人物可點，點了只有動作（poke）。
// 低多邊形 + flatShading，全部程式生成；每個關節是獨立的 Group，方便做待機動作。
// 角色本地座標：腳底在 y=0、臉朝 +z；人類身高約 1.5。
import * as THREE from 'three';
import { Batch, T, jitter } from './batch.js';
import { G, COL } from './kit.js';
import { ARCANE, magicMaterial, floatingRunes } from './arcane.js';
import { mulberry32 } from './noise.js';

const STAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 });
const MAGIC = magicMaterial(2.3);

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// 動作權重：開頭 inT 秒淡入到 1、結尾 outT 秒淡出到 0，總長 dur
const envelope = (e, dur, inT, outT) => smooth(e / inT) * (1 - smooth((e - (dur - outT)) / outT));
const lerp = (a, b, k) => a + (b - a) * k;
// 角度內插走最短的那一邊
const lerpAngle = (a, b, k) => {
  const d = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return a + d * k;
};
// 看不見的點擊範圍（人物的零件很細，直接打很難點中）
const HIT_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
function hitbox(root, w, h, d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), HIT_MAT);
  m.position.y = h / 2;
  m.userData.hitbox = true;
  root.add(m);
  return m;
}

// 一個可動部位：stat（一般）＋ magic（發光）兩個合併 mesh
function part(fn, shadow = true) {
  const b = { stat: new Batch(), magic: new Batch() };
  fn(b);
  const g = new THREE.Group();
  if (b.stat.geos.length) g.add(b.stat.build(STAT, { castShadow: shadow, receiveShadow: false }));
  if (b.magic.geos.length) g.add(b.magic.build(MAGIC, { castShadow: false, receiveShadow: false }));
  return g;
}
function joint(parent, x, y, z, fn) {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  if (fn) p.add(part(fn));
  parent.add(p);
  return p;
}

// ---------- 人形 ----------
// o: { skin, hair, top, sleeve, pants, boots, w(肩寬倍率), robe, head(b), body(b), armR(b), armL(b), back(b) }
function humanoid(o) {
  const w = o.w ?? 1;
  const root = new THREE.Group();
  const legs = [];
  if (o.robe) {
    // 長袍：裙擺蓋住雙腳
    joint(root, 0, 0, 0, (b) => {
      b.stat.add(G.cone7, jitter(o.robe, mulberry32(3)), T(0, 0.42, 0, 0, 0.2, 0, 0.66 * w, 0.86, 0.6 * w));
      b.stat.add(G.cyl8, o.trim ?? COL.gold, T(0, 0.04, 0, 0, 0, 0, 0.62 * w, 0.05, 0.56 * w));
    });
  } else {
    for (const s of [-1, 1]) {
      legs.push(joint(root, s * 0.1 * w, 0.62, 0, (b) => {
        b.stat.add(G.box, o.pants, T(0, -0.27, 0, 0, 0, 0, 0.14, 0.52, 0.15));
        b.stat.add(G.box, o.boots, T(0, -0.53, 0.03, 0, 0, 0, 0.16, 0.16, 0.24));
      }));
    }
  }
  const body = joint(root, 0, 0.62, 0, (b) => {
    b.stat.add(G.box, o.top, T(0, 0.25, 0, 0, 0, 0, 0.42 * w, 0.52, 0.25));
    b.stat.add(G.box, o.belt ?? COL.woodDark, T(0, 0.04, 0, 0, 0, 0, 0.44 * w, 0.08, 0.27));
    b.stat.add(G.box, COL.gold, T(0, 0.04, 0.14, 0, 0, 0, 0.07, 0.07, 0.02));
    if (o.body) o.body(b);
  });
  if (o.back) joint(body, 0, 0, 0, o.back);
  const head = joint(body, 0, 0.52, 0, (b) => {
    b.stat.add(G.cyl6, o.skin, T(0, 0.04, 0, 0, 0, 0, 0.1, 0.1, 0.1));
    b.stat.add(G.dodec, o.skin, T(0, 0.2, 0.01, 0, 0.3, 0, 0.3, 0.32, 0.29));
    for (const s of [-1, 1]) b.stat.add(G.box, '#1e1612', T(s * 0.065, 0.21, 0.15, 0, 0, 0, 0.04, 0.05, 0.02));
    b.stat.add(G.box, '#c47a64', T(0, 0.12, 0.15, 0, 0, 0, 0.06, 0.015, 0.01));
    if (o.hair) {
      b.stat.add(G.dodec, o.hair, T(0, 0.3, -0.03, 0, 0.5, 0, 0.33, 0.2, 0.33));
      b.stat.add(G.box, o.hair, T(0, 0.22, -0.12, 0, 0, 0, 0.3, 0.26, 0.1));
    }
    if (o.head) o.head(b);
  });
  const arms = [];
  for (const s of [-1, 1]) {
    arms.push(joint(body, s * (0.21 * w + 0.06), 0.47, 0, (b) => {
      b.stat.add(G.box, o.sleeve ?? o.top, T(0, -0.19, 0, 0, 0, 0, 0.12, 0.4, 0.13));
      b.stat.add(G.dodec, o.skin, T(0, -0.43, 0, 0, 0, 0, 0.11, 0.12, 0.11));
      const extra = s > 0 ? o.armR : o.armL;
      if (extra) extra(b);
    }));
  }
  arms[0].rotation.z = -0.08;
  arms[1].rotation.z = 0.08;
  return { root, body, head, armL: arms[0], armR: arms[1], legs };
}

// ---------- 角色 ----------
function swordsman() {
  const h = humanoid({
    skin: '#e9bf98', hair: '#6b3e22', top: '#34558f', sleeve: '#34558f', pants: '#3a3030', boots: '#4a2e1c',
    body: (b) => {
      b.stat.add(G.box, COL.steel, T(0, 0.3, 0.04, 0, 0, 0, 0.46, 0.34, 0.24));
      b.stat.add(G.box, COL.gold, T(0, 0.3, 0.165, 0, 0, Math.PI / 4, 0.08, 0.08, 0.01));
      // 腰間佩劍
      b.stat.add(G.box, COL.woodDark, T(-0.27, -0.12, 0.02, 0.2, 0, 0.1, 0.06, 0.62, 0.08));
      b.stat.add(G.box, COL.gold, T(-0.27, 0.22, 0.02, 0, 0, 0.1, 0.16, 0.04, 0.06));
      b.stat.add(G.box, '#5a3a24', T(-0.27, 0.32, 0.02, 0, 0, 0.1, 0.04, 0.14, 0.04));
    },
    head: (b) => {
      for (let k = 0; k < 4; k++) b.stat.add(G.cone4, '#6b3e22', T(-0.12 + k * 0.08, 0.4, 0.04 - k * 0.02, -0.3, k, 0.3 - k * 0.2, 0.09, 0.16, 0.09));
    },
    armR: (b) => b.stat.add(G.dodec, COL.steel, T(0, 0.02, 0, 0, 0, 0, 0.19, 0.14, 0.19)),
    armL: (b) => b.stat.add(G.dodec, COL.steel, T(0, 0.02, 0, 0, 0, 0, 0.19, 0.14, 0.19)),
  });
  // 披風：從肩膀垂下，會隨風擺動
  const cape = joint(h.body, 0, 0.5, -0.14, (b) => {
    b.stat.add(G.box, '#9c2f2a', T(0, -0.42, 0, 0, 0, 0, 0.5, 0.86, 0.03));
    b.stat.add(G.box, COL.gold, T(0, -0.02, 0.02, 0, 0, 0, 0.42, 0.04, 0.03));
  });
  return {
    root: h.root,
    update(t) {
      h.body.scale.y = 1 + Math.sin(t * 1.8) * 0.012;
      cape.rotation.x = 0.12 + Math.sin(t * 1.3) * 0.08 + Math.sin(t * 3.1) * 0.03;
      h.head.rotation.y = Math.sin(t * 0.35) * 0.35;
      h.armR.rotation.x = Math.sin(t * 1.8) * 0.04;
      h.armL.rotation.x = -0.15 + Math.sin(t * 1.8 + 1) * 0.04;
    },
  };
}

function mage() {
  const h = humanoid({
    skin: '#f0cdb0', hair: '#d8d0ee', top: '#4b3a8c', sleeve: '#4b3a8c', robe: '#41327c', belt: '#2a2050',
    head: (b) => {
      // 長髮
      b.stat.add(G.box, '#d8d0ee', T(0, 0.08, -0.12, 0, 0, 0, 0.3, 0.42, 0.08));
      // 尖頂法師帽
      b.stat.add(G.cyl8, '#2f2560', T(0, 0.34, 0, 0, 0, 0, 0.6, 0.04, 0.6));
      b.stat.add(G.cone6, '#2f2560', T(0, 0.6, -0.04, -0.22, 0.2, 0, 0.36, 0.52, 0.36));
      b.stat.add(G.cyl8, COL.gold, T(0, 0.38, 0, 0, 0, 0, 0.36, 0.05, 0.36));
      b.magic.add(G.oct, ARCANE.violet, T(0, 0.4, 0.18, 0, 0, 0, 0.05, 0.08, 0.03));
    },
    armR: (b) => {
      // 法杖：杖身＋頂端魔晶
      b.stat.add(G.cyl6, COL.woodDark, T(0, -0.3, 0.04, 0, 0, 0, 0.05, 1.5, 0.05));
      b.stat.add(G.cone4, COL.gold, T(0, 0.48, 0.04, 0, 0, 0, 0.14, 0.12, 0.14));
    },
  });
  const orb = joint(h.armR, 0, 0.62, 0.04, (b) => b.magic.add(G.oct, ARCANE.frost, T(0, 0, 0, 0, 0, 0, 0.14, 0.24, 0.14)));
  const light = new THREE.PointLight(ARCANE.frost, 0.8, 1.6, 2);
  orb.add(light);
  const runes = floatingRunes(6, ARCANE.frost, { radius: 0.32, size: 0.05 });
  orb.add(runes.group);
  h.armR.rotation.x = -0.55;
  return {
    root: h.root,
    update(t) {
      h.body.scale.y = 1 + Math.sin(t * 1.6) * 0.012;
      h.armR.rotation.x = -0.55 + Math.sin(t * 0.9) * 0.08;
      h.armL.rotation.x = -0.9 + Math.sin(t * 0.9 + 0.5) * 0.12;
      h.armL.rotation.z = 0.35;
      orb.rotation.y = t * 1.5;
      const k = 0.5 + 0.5 * Math.sin(t * 2.2);
      orb.scale.setScalar(0.9 + k * 0.25);
      light.intensity = 0.5 + k * 0.7;
      runes.update(t);
      h.head.rotation.x = 0.1 + Math.sin(t * 0.6) * 0.05;
    },
  };
}

function blacksmith() {
  const h = humanoid({
    w: 1.3, skin: '#c98f63', top: '#6b4a33', sleeve: '#c98f63', pants: '#3b3230', boots: '#2e2420', belt: '#3a2618',
    body: (b) => {
      // 皮圍裙
      b.stat.add(G.box, '#5a3a24', T(0, 0.08, 0.135, 0, 0, 0, 0.44, 0.7, 0.03));
      b.stat.add(G.box, COL.ironDark, T(0.1, -0.05, 0.16, 0, 0, 0, 0.1, 0.08, 0.02));
    },
    head: (b) => {
      // 落腮鬍＋頭巾
      b.stat.add(G.dodec, '#7a3f22', T(0, 0.1, 0.11, 0, 0, 0, 0.3, 0.24, 0.16));
      b.stat.add(G.box, '#7a3f22', T(0, 0.17, 0.155, 0, 0, 0, 0.18, 0.04, 0.02));
      b.stat.add(G.cyl8, '#a8432f', T(0, 0.32, -0.01, 0, 0, 0, 0.31, 0.1, 0.31));
      b.stat.add(G.box, '#a8432f', T(0, 0.27, -0.18, 0.5, 0, 0, 0.06, 0.16, 0.04));
    },
    armR: (b) => {
      // 鍛造錘
      b.stat.add(G.cyl6, COL.wood, T(0, -0.44, 0.2, Math.PI / 2, 0, 0, 0.05, 0.5, 0.05));
      b.stat.add(G.box, COL.ironDark, T(0, -0.44, 0.47, 0, 0, 0, 0.14, 0.14, 0.24));
    },
    armL: (b) => {
      // 火鉗夾著燒紅的料
      b.stat.add(G.box, COL.ironDark, T(0, -0.44, 0.25, 0, 0, 0, 0.03, 0.03, 0.5));
      b.magic.add(G.box, '#ff7a2a', T(0, -0.44, 0.53, 0, 0, 0, 0.07, 0.04, 0.16));
    },
  });
  const SALUTE = 2.6;
  let act = -1;
  return {
    root: h.root,
    // 被點：停錘、轉身朝鏡頭點頭、高舉鐵錘致意，再回去打鐵
    poke(t) {
      if (act >= 0 && t - act < SALUTE) return false;
      act = t;
      return true;
    },
    // now：互動用時鐘（減少動態模式下 t 固定，被點的動作仍要播完）
    update(t, now = t) {
      const e = act >= 0 ? now - act : Infinity;
      if (e >= SALUTE) act = -1;
      const w = e < SALUTE ? envelope(e, SALUTE, 0.35, 0.55) : 0;
      // 1.3 秒一錘：舉高 → 落下敲擊 → 回彈
      const c = (t % 1.3) / 1.3;
      const raise = c < 0.55 ? c / 0.55 : c < 0.7 ? 1 - (c - 0.55) / 0.15 : 0;
      const forge = -0.75 - raise * 1.5 + (c >= 0.7 && c < 0.8 ? 0.08 : 0);
      h.armR.rotation.x = w > 0 ? lerp(forge, -2.75 + Math.sin(e * 9) * 0.06, w) : forge;
      h.armR.rotation.z = lerp(-0.08, -0.3, w);
      h.armL.rotation.x = lerp(-0.85 + Math.sin(t * 0.7) * 0.05, -0.2, w);
      h.body.rotation.x = lerp(0.06 + raise * -0.06, -0.04, w);
      h.body.rotation.y = -0.85 * w;
      h.body.scale.y = 1 + Math.sin(t * 1.5) * 0.01;
      // 點頭兩下
      const nod = e > 0.45 && e < 1.5 ? Math.max(0, Math.sin((e - 0.45) * 6)) : 0;
      h.head.rotation.x = lerp(0.35, -0.08 + nod * 0.32, w);
      h.head.rotation.y = -0.55 * w;
    },
  };
}

function archer() {
  const h = humanoid({
    skin: '#e3b48e', hair: '#c9a05a', top: '#3f6b45', sleeve: '#4f7a4f', pants: '#5a4630', boots: '#3a2a1c',
    body: (b) => {
      // 斗篷領口
      b.stat.add(G.box, '#2f5236', T(0, 0.46, 0, 0, 0, 0, 0.46, 0.08, 0.3));
    },
    back: (b) => {
      // 箭筒
      b.stat.add(G.cyl6, '#6b4a2a', T(0.1, 0.3, -0.18, 0, 0, -0.35, 0.12, 0.46, 0.12));
      for (let k = 0; k < 3; k++) b.stat.add(G.box, '#efe3c6', T(0.18 + k * 0.03, 0.58, -0.18, 0, 0, -0.35, 0.03, 0.12, 0.03));
    },
    head: (b) => {
      // 兜帽披在腦後
      b.stat.add(G.dodec, '#2f5236', T(0, 0.12, -0.16, 0, 0, 0, 0.3, 0.26, 0.16));
      for (const s of [-1, 1]) b.stat.add(G.cone4, '#e3b48e', T(s * 0.16, 0.24, 0, 0, 0, s * -1.2, 0.05, 0.12, 0.05));
    },
  });
  // 背上的長弓（射箭時收起，改成手上那把）
  const backBow = joint(h.body, 0, 0, 0, (b) => {
    b.stat.add(G.box, COL.woodLight, T(-0.12, 0.28, -0.19, 0, 0, 0.35, 0.04, 1.1, 0.04));
    b.stat.add(G.box, '#efe3c6', T(-0.06, 0.28, -0.2, 0, 0, 0.35, 0.01, 1.02, 0.01));
  });
  // 左手的弓：手臂舉平時，弓身（本地 z）會變成垂直、弓背朝前（本地 -y）
  const handBow = joint(h.armL, 0, 0, 0, (b) => {
    for (let i = 0; i < 7; i++) {
      const a = -0.9 + i * 0.3;
      b.stat.add(G.box, COL.woodLight, T(0, -0.45 + (1 - Math.cos(a)) * 0.25, Math.sin(a) * 0.5, a * 0.5, 0, 0, 0.045, 0.045, 0.17));
    }
    b.stat.add(G.box, '#efe3c6', T(0, -0.45 + (1 - Math.cos(0.9)) * 0.25, 0, 0, 0, 0, 0.01, 0.01, Math.sin(0.9) * 1.0));
  });
  handBow.visible = false;
  const SHOOT = 3.0;
  const RELEASE = 1.25;
  let act = -1;
  let released = false;
  let aim = { yaw: 0, elev: 0 };
  let onRelease = null;
  let baseYaw = null;
  return {
    root: h.root,
    // 被點：轉向目標、舉弓拉弦、放出一支魔光箭（onRelease 由室內場景處理箭的飛行）
    poke(t, target, cb) {
      if (act >= 0 && t - act < SHOOT) return false;
      const p = h.root.position;
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      aim = { yaw: Math.atan2(dx, dz), elev: Math.atan2(target.y - (p.y + 1.55), Math.hypot(dx, dz)) };
      act = t;
      released = false;
      onRelease = cb;
      return true;
    },
    // 箭從哪裡射出（世界座標）
    handPos(v) { return h.armL.localToWorld(v.set(0, -0.5, 0)); },
    update(t, now = t) {
      if (baseYaw === null) baseYaw = h.root.rotation.y;
      const e = act >= 0 ? now - act : Infinity;
      if (e >= SHOOT) act = -1;
      const w = e < SHOOT ? envelope(e, SHOOT, 0.45, 0.6) : 0;
      if (e >= RELEASE && e < SHOOT && !released) {
        released = true;
        if (onRelease) onRelease();
      }
      const shooting = e > 0.2 && e < SHOOT - 0.3;
      handBow.visible = shooting;
      backBow.visible = !shooting;
      h.root.rotation.y = lerpAngle(baseYaw, aim.yaw, w);
      h.body.scale.y = 1 + Math.sin(t * 1.7) * 0.012;
      // 平常：抬頭看看架上的兵器，又低頭想一想
      h.head.rotation.x = lerp(-0.25 + Math.sin(t * 0.45) * 0.2, -aim.elev * 0.7, w);
      h.head.rotation.y = lerp(Math.sin(t * 0.3) * 0.4, 0, w);
      // 拉弦：放箭前右手往外收，放箭後回彈
      const draw = e < RELEASE ? smooth((e - 0.5) / 0.6) : Math.max(0, 1 - (e - RELEASE) * 6);
      const up = -(Math.PI / 2 + aim.elev);
      h.armL.rotation.x = lerp(-0.5, up, w);
      h.armL.rotation.z = lerp(0.45, 0, w);
      h.armR.rotation.x = lerp(-1.35 + Math.sin(t * 0.45) * 0.08, up + 0.15, w);
      h.armR.rotation.z = lerp(-0.55, -0.2 - draw * 0.55, w);
    },
  };
}

// 雙尾狐靈：橘毛、白腹，尾巴尖端有冰藍魔光
function spiritFox() {
  const root = new THREE.Group();
  const body = joint(root, 0, 0.3, 0, (b) => {
    b.stat.add(G.dodec, '#e8833a', T(0, 0, 0, 0, 0, 0, 0.3, 0.26, 0.5));
    b.stat.add(G.dodec, '#f6e6cf', T(0, -0.06, 0.06, 0, 0, 0, 0.22, 0.16, 0.38));
  });
  const head = joint(body, 0, 0.12, 0.26, (b) => {
    b.stat.add(G.dodec, '#e8833a', T(0, 0.04, 0, 0, 0, 0, 0.24, 0.22, 0.22));
    b.stat.add(G.cone6, '#f6e6cf', T(0, 0.0, 0.15, Math.PI / 2, 0, 0, 0.12, 0.16, 0.1));
    b.stat.add(G.box, '#1e1612', T(0, 0.01, 0.235, 0, 0, 0, 0.04, 0.03, 0.02));
    for (const s of [-1, 1]) {
      b.stat.add(G.cone4, '#e8833a', T(s * 0.08, 0.2, -0.02, 0, Math.PI / 4, s * -0.2, 0.09, 0.16, 0.06));
      b.stat.add(G.box, '#1e1612', T(s * 0.06, 0.07, 0.1, 0, 0, 0, 0.03, 0.03, 0.02));
    }
  });
  const legs = [];
  for (const [x, z] of [[-0.09, 0.15], [0.09, 0.15], [-0.09, -0.15], [0.09, -0.15]]) {
    legs.push(joint(root, x, 0.22, z, (b) => {
      b.stat.add(G.box, '#c4692c', T(0, -0.1, 0, 0, 0, 0, 0.06, 0.22, 0.07));
      b.stat.add(G.box, '#3a2a20', T(0, -0.2, 0.01, 0, 0, 0, 0.07, 0.04, 0.09));
    }));
  }
  const tails = [-1, 1].map((s) => joint(body, s * 0.06, 0.06, -0.24, (b) => {
    b.stat.add(G.cone6, '#e8833a', T(0, 0.12, -0.14, -0.9, 0, 0, 0.14, 0.38, 0.14));
    b.magic.add(G.cone6, ARCANE.frost, T(0, 0.26, -0.28, -0.9 + Math.PI, 0, 0, 0.1, 0.16, 0.1));
  }));
  return {
    root,
    walk(t, moving) {
      for (let i = 0; i < 4; i++) legs[i].rotation.x = moving ? Math.sin(t * 9 + (i % 3 === 0 ? 0 : Math.PI)) * 0.55 : 0;
      body.position.y = 0.3 + (moving ? Math.abs(Math.sin(t * 9)) * 0.025 : 0);
      tails.forEach((tl, i) => { tl.rotation.y = Math.sin(t * 2.2 + i * 1.4) * 0.45; tl.rotation.x = Math.sin(t * 1.7 + i) * 0.1; });
      head.rotation.y = Math.sin(t * 0.8) * 0.25;
    },
  };
}

// 史萊姆：半透明的綠色果凍，一跳一跳
function slime() {
  const root = new THREE.Group();
  const jelly = new THREE.Group();
  root.add(jelly);
  const mat = new THREE.MeshStandardMaterial({ color: '#5fe0a0', emissive: '#2a9a66', emissiveIntensity: 0.5, transparent: true, opacity: 0.82, flatShading: true, roughness: 0.25 });
  const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), mat);
  blob.scale.set(1, 0.78, 1);
  blob.position.y = 0.22;
  blob.castShadow = true;
  jelly.add(blob);
  jelly.add(part((b) => {
    for (const s of [-1, 1]) b.stat.add(G.box, '#14261c', T(s * 0.09, 0.27, 0.24, 0, 0, 0, 0.05, 0.08, 0.02));
    b.stat.add(G.box, '#14261c', T(0, 0.17, 0.26, 0, 0, 0, 0.08, 0.02, 0.02));
    b.magic.add(G.ico0, ARCANE.verdant, T(0, 0.22, 0, 0, 0, 0, 0.12));
  }, false));
  return {
    root,
    update(t) {
      const c = (t % 1.1) / 1.1;
      const air = c > 0.3 && c < 0.85 ? Math.sin(((c - 0.3) / 0.55) * Math.PI) : 0;
      const squash = c <= 0.3 ? Math.sin((c / 0.3) * Math.PI) : 0;
      jelly.position.y = air * 0.38;
      jelly.scale.set(1 + squash * 0.22 - air * 0.06, 1 - squash * 0.3 + air * 0.12, 1 + squash * 0.22 - air * 0.06);
    },
  };
}

// 小紫龍：繞著屋頂盤旋，翅膀拍動、尾巴擺動
function babyDragon() {
  const root = new THREE.Group();
  const body = joint(root, 0, 0, 0, (b) => {
    b.stat.add(G.dodec, '#6a4fb0', T(0, 0, 0, 0, 0, 0, 0.36, 0.34, 0.6));
    b.stat.add(G.dodec, '#e8c46a', T(0, -0.08, 0.06, 0, 0, 0, 0.24, 0.2, 0.46));
    for (let k = 0; k < 4; k++) b.stat.add(G.cone4, '#4a3690', T(0, 0.17, 0.18 - k * 0.13, 0, 0, 0, 0.06, 0.1, 0.06));
    for (const s of [-1, 1]) b.stat.add(G.box, '#5a4298', T(s * 0.12, -0.17, 0.12, 0.4, 0, 0, 0.07, 0.14, 0.07));
  });
  const head = joint(body, 0, 0.14, 0.32, (b) => {
    b.stat.add(G.dodec, '#6a4fb0', T(0, 0.04, 0.04, 0, 0, 0, 0.26, 0.24, 0.28));
    b.stat.add(G.box, '#7a5fc0', T(0, 0.0, 0.2, 0, 0, 0, 0.16, 0.12, 0.16));
    for (const s of [-1, 1]) {
      b.stat.add(G.cone4, '#efe3c6', T(s * 0.08, 0.18, -0.06, -0.6, 0, s * -0.25, 0.05, 0.16, 0.05));
      b.magic.add(G.box, ARCANE.gold, T(s * 0.08, 0.08, 0.15, 0, 0, 0, 0.05, 0.04, 0.02));
    }
  });
  const wings = [-1, 1].map((s) => joint(body, s * 0.14, 0.12, 0.02, (b) => {
    b.stat.add(G.box, '#4a3690', T(s * 0.28, 0.02, 0, 0, 0, 0, 0.56, 0.03, 0.04));
    b.stat.add(G.cone4, '#a88ce8', T(s * 0.3, 0, -0.14, Math.PI / 2, 0, 0, 0.56, 0.32, 0.02));
  }));
  const tail = joint(body, 0, 0.0, -0.3, (b) => {
    b.stat.add(G.cone6, '#6a4fb0', T(0, 0, -0.25, -Math.PI / 2, 0, 0, 0.16, 0.5, 0.16));
    b.magic.add(G.oct, ARCANE.violet, T(0, 0, -0.52, 0, 0, 0, 0.08, 0.12, 0.08));
  });
  return {
    root,
    update(t) {
      const f = Math.sin(t * 7);
      wings[0].rotation.z = f * 0.75;
      wings[1].rotation.z = -f * 0.75;
      body.position.y = -f * 0.05;
      tail.rotation.y = Math.sin(t * 2) * 0.35;
      head.rotation.y = Math.sin(t * 0.7) * 0.3;
    },
  };
}

// 黑貓魔寵：蜷在壁爐邊睡覺，偶爾睜開發紫光的眼睛、甩尾巴
function familiarCat() {
  const root = new THREE.Group();
  const body = joint(root, 0, 0.12, 0, (b) => {
    b.stat.add(G.dodec, '#24202a', T(0, 0, 0, 0, 0, 0, 0.5, 0.24, 0.4));
    b.stat.add(G.dodec, '#2e2836', T(-0.1, 0.04, 0.05, 0, 0, 0, 0.3, 0.2, 0.3));
  });
  const head = joint(body, 0.18, 0.02, 0.14, (b) => {
    b.stat.add(G.dodec, '#24202a', T(0, 0.04, 0, 0, 0, 0, 0.22, 0.18, 0.2));
    for (const s of [-1, 1]) b.stat.add(G.cone4, '#24202a', T(s * 0.06, 0.15, -0.02, 0, Math.PI / 4, 0, 0.07, 0.1, 0.05));
  });
  const eyes = part((b) => { for (const s of [-1, 1]) b.magic.add(G.box, ARCANE.violet, T(s * 0.05, 0.05, 0.1, 0, 0, 0, 0.04, 0.03, 0.02)); }, false);
  head.add(eyes);
  const lids = part((b) => { for (const s of [-1, 1]) b.stat.add(G.box, '#3a3444', T(s * 0.05, 0.05, 0.102, 0, 0, 0, 0.045, 0.01, 0.02)); }, false);
  head.add(lids);
  const tail = joint(body, -0.24, 0.0, 0.0, (b) => {
    b.stat.add(G.box, '#24202a', T(0.0, 0, 0.18, 0, 0, 0, 0.06, 0.06, 0.36));
    b.magic.add(G.oct, ARCANE.violet, T(0, 0, 0.38, 0, 0, 0, 0.05, 0.07, 0.05));
  });
  const STRETCH = 3.2;
  const HOP = 0.9;
  let state = 'sleep';
  let since = 0;
  let spots = null;
  let at = 0;
  return {
    root,
    // 兩個睡覺的位置 [{ x, z, yaw }]；醒著時再點一下就跳到另一個
    setSpots(list) {
      spots = list;
      root.position.set(list[0].x, 0, list[0].z);
      root.rotation.y = list[0].yaw;
    },
    // 回傳要播的音效：睡著 → 醒來伸懶腰（purr）；醒著 → 跳到另一個位置（hop）
    poke(t) {
      if (state === 'sleep') { state = 'stretch'; since = t; return 'purr'; }
      if (state === 'stretch' && spots) { state = 'hop'; since = t; return 'hop'; }
      return null;
    },
    update(t, now = t) {
      const e = now - since;
      if (state === 'stretch' && e > STRETCH) state = 'sleep';
      if (state === 'hop') {
        const a = spots[at];
        const b = spots[1 - at];
        const k = smooth(e / HOP);
        root.position.set(lerp(a.x, b.x, k), Math.sin(Math.min(e / HOP, 1) * Math.PI) * 0.55, lerp(a.z, b.z, k));
        root.rotation.y = lerpAngle(a.yaw, b.yaw, k);
        if (e >= HOP) {
          at = 1 - at;
          root.position.y = 0;
          // 落地後再醒一下下才睡回去
          state = 'stretch';
          since = now - STRETCH + 1.4;
        }
      }
      const e2 = now - since;
      const wake = state === 'sleep' ? 0 : state === 'hop' ? 1 : envelope(e2, STRETCH, 0.25, 0.6);
      // 伸懶腰：身體拉長壓低、抬頭
      const stretch = state === 'stretch' ? Math.sin(Math.min(Math.max((e2 - 0.2) / 1.4, 0), 1) * Math.PI) : 0;
      body.scale.set(1 + stretch * 0.22, (1 + Math.sin(t * 1.2) * 0.05) * (1 - stretch * 0.15), 1 + stretch * 0.1);
      // 平常每 7 秒睜眼約 1.6 秒
      const awake = wake > 0.2 || t % 7 > 5.4;
      eyes.visible = awake;
      lids.visible = !awake;
      head.rotation.x = lerp(awake ? -0.15 : 0.15, -0.45, wake);
      tail.rotation.y = Math.sin(t * (awake ? 3 : 0.8) * (1 + wake)) * (awake ? 0.5 : 0.15);
      tail.rotation.x = -0.8 * wake;
    },
  };
}

// 放在地面：pos=[x,z]，face=[x,z] 面向的點
function place(obj, groundY, [x, z], [fx, fz], s = 1) {
  obj.root.position.set(x, groundY(x, z), z);
  obj.root.rotation.y = Math.atan2(fx - x, fz - z);
  obj.root.scale.setScalar(s);
}

// ---------- 島上 ----------
// 島上人物放大一些：全島取景時才看得出來
const S = 1.25;

export function createIslandCast({ groundY, door, obelisk }) {
  const group = new THREE.Group();
  const sword = swordsman();
  place(sword, groundY, [0.85, 4.5], [door.x, door.z], S);
  const wiz = mage();
  place(wiz, groundY, [obelisk.x - 1.3, obelisk.y + 1.45], [obelisk.x, obelisk.y], S);
  const fox = spiritFox();
  const sl = slime();
  place(sl, groundY, [-0.9, 7.0], [0, 12], S);
  const dragon = babyDragon();
  dragon.root.scale.setScalar(1.5);
  for (const c of [sword, wiz, fox, sl, dragon]) group.add(c.root);

  // 狐靈的散步路線：前院的橢圓，走走停停
  const FOX = { cx: -1.7, cz: 5.6, rx: 1.25, rz: 0.75 };
  const foxPos = (a) => [FOX.cx + Math.cos(a) * FOX.rx, FOX.cz + Math.sin(a) * FOX.rz];
  return {
    group,
    update(t) {
      sword.update(t);
      wiz.update(t);
      sl.update(t);
      dragon.update(t);
      // 每 10 秒：走 7 秒、停下來東張西望 3 秒
      const cyc = Math.floor(t / 10);
      const local = t % 10;
      const moving = local < 7;
      const a = (cyc * 7 + Math.min(local, 7)) * 0.45;
      const [x, z] = foxPos(a);
      const [nx, nz] = foxPos(a + 0.05);
      fox.root.position.set(x, groundY(x, z), z);
      fox.root.scale.setScalar(S);
      fox.root.rotation.y = Math.atan2(nx - x, nz - z);
      fox.walk(t, moving);
      // 小龍：繞著屋頂與煙囪盤旋，機身略微傾斜
      const da = t * 0.32;
      dragon.root.position.set(Math.cos(da) * 4.6, 7.2 + Math.sin(t * 0.9) * 0.5, -0.6 + Math.sin(da) * 4.0);
      dragon.root.rotation.set(0, -da, 0);
      dragon.root.rotateZ(0.25);
    },
  };
}

// ---------- 室內 ----------
export function createInteriorCast() {
  const group = new THREE.Group();
  const flat = () => 0;
  const smith = blacksmith();
  // 站在鐵砧左側（不要站正後方，會被鐵砧整個擋住），側身朝鐵砧揮錘
  place(smith, flat, [-2.45, 0.55], [-1.3, 0.3], 1.12);
  hitbox(smith.root, 0.8, 1.75, 0.8);
  const guest = archer();
  place(guest, flat, [2.3, -2.5], [0.6, -4.4], 1.1);
  hitbox(guest.root, 0.7, 1.7, 0.7);
  const cat = familiarCat();
  place(cat, flat, [-4.0, -1.2], [0.4, 8.9], 1.2);
  // 兩個睡覺的位置：爐火左前方（不能被鐵匠擋住）、地毯前緣；臉大致朝鏡頭
  const faceCam = (x, z) => Math.atan2(0.4 - x, 8.9 - z);
  cat.setSpots([{ x: -4.0, z: -1.2, yaw: faceCam(-4.0, -1.2) + 0.3 }, { x: -0.95, z: 2.55, yaw: faceCam(-0.95, 2.55) - 0.3 }]);
  hitbox(cat.root, 0.75, 0.5, 0.75);
  smith.root.userData.prop = 'smith';
  guest.root.userData.prop = 'archer';
  cat.root.userData.prop = 'cat';
  for (const c of [smith, guest, cat]) group.add(c.root);
  return {
    group,
    // 可點的人物（不開卡片，只有動作）
    props: [smith.root, guest.root, cat.root],
    smith,
    archer: guest,
    cat,
    update(t, now = t) {
      smith.update(t, now);
      guest.update(t, now);
      cat.update(t, now);
    },
  };
}
