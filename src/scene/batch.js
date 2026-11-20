// 把大量靜態小物件合併成單一 mesh（每頂點上色），讓高密度場景仍維持少量 draw call。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _c = new THREE.Color();

// T(x, y, z, rx, ry, rz, sx, sy, sz) → Matrix4
export function T(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.clone(), new THREE.Vector3(sx, sy, sz));
}

export class Batch {
  constructor() { this.geos = []; }

  // geo：任何 BufferGeometry；color：顏色字串或 THREE.Color；local：Matrix4；parent：Matrix4（選填）
  add(geo, color, local = new THREE.Matrix4(), parent = null) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    const m = parent ? parent.clone().multiply(local) : local;
    g.applyMatrix4(m);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    _c.set(color);
    for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.geos.push(g);
    return this;
  }

  // 已帶 color attribute 的幾何（例如地形）直接加入
  addColored(g) {
    const c = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(c.attributes)) if (name !== 'position' && name !== 'color') c.deleteAttribute(name);
    this.geos.push(c);
    return this;
  }

  build(material, { castShadow = true, receiveShadow = true } = {}) {
    if (!this.geos.length) return new THREE.Group();
    const merged = mergeGeometries(this.geos, false);
    merged.computeVertexNormals();
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    return mesh;
  }
}

// 顏色隨機微調（讓同種物件不會一模一樣）
export function jitter(color, rng, amount = 0.06) {
  const c = new THREE.Color(color);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h + (rng() - 0.5) * amount * 0.3, Math.min(1, Math.max(0, hsl.s + (rng() - 0.5) * amount)), Math.min(1, Math.max(0, hsl.l + (rng() - 0.5) * amount)));
  return c;
}

export const staticMaterial = () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 });
// 全站自發光強度係數（室內外共用）。所有發光材質（glowMaterial、magicMaterial、動態的爐火／劍／門光）都乘上它；
// 2026-11-19 使用者覺得太亮，從 1 調成 0.5。
export const GLOW = 0.5;
export const glowMaterial = (emissive, intensity) => new THREE.MeshStandardMaterial({ color: '#000000', emissive, emissiveIntensity: intensity * GLOW, flatShading: true });
