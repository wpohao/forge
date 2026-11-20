// 天空、雲海、飄雲、煙、火星、螢火蟲、瀑布、飛鳥。
import * as THREE from 'three';
import { Batch, T, jitter, staticMaterial } from './batch.js';
import { G } from './kit.js';
import { mulberry32 } from './noise.js';

// 室外配色：黃昏／夜晚。右上角按鈕即時切換（main.js 呼叫 setSkyMode），網址 ?sky=night|dusk 可指定初始值。
// 島、建築、佈置都相同，只換天空、燈光、雲與遠景的顏色；用到配色的地方以 onSky() 註冊，切換時會被叫到。
const SKY_PRESETS = {
  dusk: {
    top: '#26285a', mid: '#c9677a', horizon: '#ffb46e', below: '#f3c49b',
    sunGlow: 1, stars: [0.9975, 0.35], aurora: 0.22, moonGlow: 1,
    hemi: ['#ffd9b5', '#4a3f63', 1.05], sun: ['#ffc48a', 2.8], fill: ['#8f9ae0', 0.55],
    cloudTint: '#ffffff', cloudEmissive: ['#ffcfb0', '#ffd8c0'], farTint: '#ffffff', farEmissive: '#8a6f92',
  },
  night: {
    top: '#03051a', mid: '#0d1240', horizon: '#2b2f6e', below: '#1d2256',
    sunGlow: 0, stars: [0.993, 0.0], aurora: 0.5, moonGlow: 2.2,
    hemi: ['#7d8cd0', '#191630', 0.7], sun: ['#a9b8ff', 1.25], fill: ['#4f5ea8', 0.4],
    cloudTint: '#7480bd', cloudEmissive: ['#1f2858', '#24305e'], farTint: '#5a6498', farEmissive: '#20264a',
  },
};
export const SKY_MODES = Object.keys(SKY_PRESETS);
export let SKY_MODE = 'dusk';
// 顏色物件固定不換（shader uniform 直接引用），切換時只改值
export const SKY = {
  top: new THREE.Color(), mid: new THREE.Color(), horizon: new THREE.Color(), below: new THREE.Color(),
  stars: new THREE.Vector2(),
  sunDir: new THREE.Vector3(-0.85, 0.2, -0.38).normalize(),
};
function loadSky(mode) {
  const p = SKY_PRESETS[mode];
  Object.assign(SKY, p, { top: SKY.top, mid: SKY.mid, horizon: SKY.horizon, below: SKY.below, stars: SKY.stars, sunDir: SKY.sunDir });
  for (const k of ['top', 'mid', 'horizon', 'below']) SKY[k].set(p[k]);
  SKY.stars.set(...p.stars);
}
loadSky(SKY_MODE);
const skyListeners = [];
// 註冊「配色改變時要做的事」，註冊當下就先套用一次
export function onSky(fn) { skyListeners.push(fn); fn(SKY); }
export function setSkyMode(mode) {
  if (!SKY_PRESETS[mode] || mode === SKY_MODE) return;
  SKY_MODE = mode;
  loadSky(mode);
  for (const fn of skyListeners) fn(SKY);
}

export function createSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: SKY.top }, uMid: { value: SKY.mid }, uHorizon: { value: SKY.horizon },
      uBelow: { value: SKY.below }, uSun: { value: SKY.sunDir },
      uSunGlow: { value: 1 }, uStars: { value: SKY.stars }, uAurora: { value: 0 }, uMoonGlow: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uMid, uHorizon, uBelow, uSun;
      uniform float uSunGlow, uAurora, uMoonGlow;
      uniform vec2 uStars;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        float h = vDir.y;
        vec3 col = mix(uHorizon, uMid, smoothstep(0.02, 0.28, h));
        col = mix(col, uTop, smoothstep(0.22, 0.85, h));
        col = mix(col, uBelow, smoothstep(0.0, -0.25, h));
        float s = max(dot(vDir, uSun), 0.0);
        col += vec3(1.0, 0.62, 0.32) * pow(s, 18.0) * 0.55 * uSunGlow;
        col += vec3(1.0, 0.85, 0.6) * pow(s, 900.0) * 3.0 * uSunGlow;
        vec3 cell = floor(vDir * 260.0);
        float star = step(uStars.x, hash(cell)) * smoothstep(uStars.y, uStars.y + 0.45, h);
        col += vec3(star) * 0.9;
        // 異世界的雙月：大的淡紫月（帶月暈與暗斑）、小的青色月
        // 位置在預設鏡頭的右上天空、與夕陽分開（從雲海上方升起；方向＝預設鏡頭視線與天空球（中心在原點）的交點）
        vec3 m1 = normalize(vec3(-0.371, -0.060, -0.927));
        vec3 m2 = normalize(vec3(-0.175, -0.002, -0.986));
        vec3 nd = normalize(vDir); // 插值後的 vDir 長度會小於 1，月面這種小角度要重新正規化
        float d1 = dot(nd, m1);
        float d2 = dot(nd, m2);
        float disc1 = smoothstep(0.9982, 0.99835, d1);
        float spots = hash(floor(nd * 160.0)) * 0.1 + smoothstep(0.99895, 0.9991, dot(nd, normalize(m1 + vec3(0.012, 0.01, 0.0)))) * 0.12;
        col = mix(col, vec3(0.74, 0.62, 0.95) * (1.0 - spots), disc1);
        col += vec3(0.5, 0.35, 0.8) * pow(max(d1, 0.0), 400.0) * 0.18 * uMoonGlow;
        float disc2 = smoothstep(0.99955, 0.9996, d2);
        col = mix(col, vec3(0.45, 0.82, 0.9), disc2);
        col += vec3(0.3, 0.7, 0.85) * pow(max(d2, 0.0), 1200.0) * 0.15 * uMoonGlow;
        // 淡淡的魔力極光：高空飄動的紫青光帶
        float ang = atan(vDir.z, vDir.x);
        float band = smoothstep(-0.14, -0.04, h) * smoothstep(0.3, 0.06, h);
        float wave = 0.5 + 0.5 * sin(ang * 5.0 + sin(ang * 3.0) * 1.5 + h * 9.0);
        float curtain = band * pow(wave, 3.0) * smoothstep(-0.2, 0.6, -vDir.z);
        col += mix(vec3(0.35, 0.9, 0.85), vec3(0.6, 0.35, 0.95), wave) * curtain * uAurora;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  onSky((s) => {
    mat.uniforms.uSunGlow.value = s.sunGlow;
    mat.uniforms.uAurora.value = s.aurora;
    mat.uniforms.uMoonGlow.value = s.moonGlow;
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

export function createCloudSea(seed = 7) {
  const rng = mulberry32(seed);
  const b = new Batch();
  for (let i = 0; i < 190; i++) {
    const a = rng() * Math.PI * 2;
    const r = 14 + Math.pow(rng(), 0.8) * 90;
    const sz = 4 + rng() * 8;
    const c = jitter(rng() > 0.5 ? '#fff3e8' : '#ffe1d0', rng, 0.04);
    b.add(G.ico1, c, T(Math.cos(a) * r, -19 - rng() * 4 + r * 0.03, Math.sin(a) * r, rng(), rng(), 0, sz, sz * 0.32, sz * (0.8 + rng() * 0.5)));
  }
  const mat = staticMaterial();
  mat.roughness = 1;
  onSky((s) => { mat.color.set(s.cloudTint); mat.emissive.set(s.cloudEmissive[0]); });
  mat.emissiveIntensity = 0.35;
  return b.build(mat, { castShadow: false, receiveShadow: false });
}

export function createClouds(count, seed = 11) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const mat = staticMaterial();
  mat.roughness = 1;
  onSky((s) => { mat.color.set(s.cloudTint); mat.emissive.set(s.cloudEmissive[1]); });
  mat.emissiveIntensity = 0.45;
  const items = [];
  for (let i = 0; i < count; i++) {
    const b = new Batch();
    const puffs = 4 + Math.floor(rng() * 4);
    for (let k = 0; k < puffs; k++) {
      const s = 1.2 + rng() * 1.6;
      b.add(G.ico1, jitter('#fff1e4', rng, 0.04), T((k - puffs / 2) * 1.1 + rng() * 0.6, rng() * 0.6, rng() * 1.4, rng(), rng(), 0, s, s * 0.7, s));
    }
    const m = b.build(mat, { castShadow: false, receiveShadow: false });
    const pivot = new THREE.Group();
    const a = (i / count) * Math.PI * 2 + rng();
    m.position.set(24 + rng() * 26, 3 + rng() * 11, 0);
    m.rotation.y = rng() * Math.PI;
    pivot.rotation.y = a;
    pivot.add(m);
    group.add(pivot);
    items.push({ pivot, speed: 0.006 + rng() * 0.01 });
  }
  return { group, update(dt) { for (const it of items) it.pivot.rotation.y += it.speed * dt; } };
}

// 低多邊形煙團（InstancedMesh）
export function createSmoke(origin, count, { color = '#efe6dc', rise = 0.9, drift = new THREE.Vector3(0.35, 0, 0.12), life = 5, size = 0.55 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.42, flatShading: true, roughness: 1, depthWrite: false, emissive: color, emissiveIntensity: 0.25 });
  const mesh = new THREE.InstancedMesh(G.ico1, mat, count);
  mesh.frustumCulled = false;
  const ages = Array.from({ length: count }, (_, i) => (i / count) * life);
  const seeds = Array.from({ length: count }, () => Math.random());
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  return {
    mesh,
    update(dt) {
      for (let i = 0; i < count; i++) {
        ages[i] = (ages[i] + dt) % life;
        const k = ages[i] / life;
        p.copy(origin).addScaledVector(drift, ages[i] * (0.6 + k)).add(new THREE.Vector3(Math.sin(seeds[i] * 20 + ages[i]) * 0.15, ages[i] * rise, Math.cos(seeds[i] * 13 + ages[i]) * 0.15));
        const sc = size * (0.4 + k * 1.6) * (k > 0.8 ? (1 - k) / 0.2 : 1);
        s.setScalar(Math.max(sc, 0.001));
        e.set(seeds[i] * 6 + ages[i] * 0.3, seeds[i] * 3, 0);
        q.setFromEuler(e);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// 粒子（火星、螢火蟲）：spawn(i) 決定初始位置與速度
function particles(count, { color, size, spawn, step }) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const state = Array.from({ length: count }, (_, i) => spawn(i, {}));
  return {
    points,
    state,
    update(dt, t) {
      for (let i = 0; i < count; i++) {
        const st = state[i];
        step(st, dt, t, i);
        if (st.dead) state[i] = spawn(i, st);
        pos[i * 3] = st.p.x; pos[i * 3 + 1] = st.p.y; pos[i * 3 + 2] = st.p.z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

export function createEmbers(origin, count, spread = 0.4) {
  return particles(count, {
    color: new THREE.Color('#ffc27a').multiplyScalar(1.6),
    size: 0.07,
    spawn: () => ({
      p: origin.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * 0.2, (Math.random() - 0.5) * spread)),
      v: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.8 + Math.random() * 1.4, (Math.random() - 0.5) * 0.3),
      life: 0.8 + Math.random() * 1.6,
      age: Math.random() * 1.5,
    }),
    step: (st, dt) => {
      st.age += dt;
      st.p.addScaledVector(st.v, dt);
      st.v.x += (Math.random() - 0.5) * dt * 1.5;
      st.v.z += (Math.random() - 0.5) * dt * 1.5;
      st.dead = st.age > st.life;
    },
  });
}

// 點擊時噴出的火星
export function createSparks(count) {
  const sys = particles(count, {
    color: new THREE.Color('#ffd08a').multiplyScalar(1.8),
    size: 0.09,
    spawn: (i, old) => ({ p: new THREE.Vector3(0, -999, 0), v: new THREE.Vector3(), age: 0, life: 0, dead: false, idle: true, ...(old.keep || {}) }),
    step: (st, dt) => {
      if (st.idle) return;
      st.age += dt;
      st.v.y -= 6 * dt;
      st.p.addScaledVector(st.v, dt);
      if (st.age > st.life) { st.idle = true; st.p.set(0, -999, 0); }
    },
  });
  let next = 0;
  sys.burst = (origin, n) => {
    for (let k = 0; k < n; k++) {
      const st = sys.state[next];
      next = (next + 1) % count;
      st.idle = false;
      st.age = 0;
      st.life = 0.4 + Math.random() * 0.6;
      st.p.copy(origin);
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 3;
      st.v.set(Math.cos(a) * sp, 2 + Math.random() * 3, Math.sin(a) * sp);
    }
  };
  return sys;
}

export function createFireflies(count, sampler) {
  return particles(count, {
    color: new THREE.Color('#eaff9c').multiplyScalar(1.4),
    size: 0.09,
    spawn: () => {
      const p = sampler();
      return { base: p.clone(), p: p.clone(), ph: Math.random() * 10, sp: 0.3 + Math.random() * 0.5 };
    },
    step: (st, dt, t) => {
      st.p.set(
        st.base.x + Math.sin(t * st.sp + st.ph) * 0.6,
        st.base.y + Math.sin(t * st.sp * 1.7 + st.ph * 2) * 0.35,
        st.base.z + Math.cos(t * st.sp * 1.3 + st.ph) * 0.6,
      );
    },
  });
}

export function createWaterfall(top, dir, height = 10, width = 0.95) {
  const geo = new THREE.PlaneGeometry(width, height, 4, 40);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float drop = 1.0 - uv.y;
        p.z += 1.2 * pow(drop, 0.6) - 0.1;
        p.x *= 1.0 + drop * 0.5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        float col = floor(vUv.x * 9.0);
        float speed = 1.4 + hash(vec2(col, 1.0)) * 0.8;
        float streak = fract(vUv.y * 5.0 + uTime * speed + hash(vec2(col, 3.0)));
        float white = smoothstep(0.75, 1.0, streak);
        vec3 water = mix(vec3(0.42, 0.72, 0.86), vec3(0.95, 0.98, 1.0), white * 0.8);
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        float fade = smoothstep(0.0, 0.35, vUv.y);
        gl_FragColor = vec4(water, 0.82 * edge * fade);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(top).add(new THREE.Vector3(0, -height / 2, 0));
  mesh.rotation.y = Math.atan2(dir.x, dir.z);
  return { mesh, update(t) { mat.uniforms.uTime.value = t; } };
}

export function createBirds(count, seed = 5) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#2a2230', flatShading: true });
  const wing = new THREE.BoxGeometry(0.5, 0.03, 0.18);
  const birds = [];
  for (let i = 0; i < count; i++) {
    const b = new THREE.Group();
    const l = new THREE.Mesh(wing, mat);
    const r = new THREE.Mesh(wing, mat);
    l.geometry = wing; r.geometry = wing;
    const lp = new THREE.Group(); lp.add(l); l.position.x = -0.25;
    const rp = new THREE.Group(); rp.add(r); r.position.x = 0.25;
    b.add(lp, rp);
    group.add(b);
    b.scale.setScalar(2.2);
    birds.push({ b, lp, rp, r: 38 + rng() * 10, h: 9 + rng() * 6, sp: 0.06 + rng() * 0.04, ph: rng() * Math.PI * 2 });
  }
  return {
    group,
    update(t) {
      for (const it of birds) {
        const a = it.ph + t * it.sp;
        it.b.position.set(Math.cos(a) * it.r, it.h + Math.sin(t * 0.7 + it.ph) * 0.6, Math.sin(a) * it.r);
        it.b.rotation.y = -a;
        const f = Math.sin(t * 9 + it.ph) * 0.6;
        it.lp.rotation.z = f;
        it.rp.rotation.z = -f;
      }
    },
  };
}
