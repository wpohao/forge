// 鏡頭取景（純數學，不碰 three／DOM，可用 node 測）。
// 目的：讓整座島（含岩底尖端）落在「頂列下方～快捷列上方」的可用區域內，不被畫面下緣或快捷列切掉。
// 作法：鏡頭方向固定，找出能裝下所有取景點的最短距離；注視點高度在 yRange 內挑最省距離的位置；
// 再用 camera.setViewOffset(w, h, offsetX, offsetY, w, h) 把投影中心移到可用區域中央。

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// 透視投影到 NDC（-1..1，y 朝上），與 three.js PerspectiveCamera（fov 為垂直視角）一致
export function projectNdc(point, eye, target, fovDeg, aspect) {
  const f = unit(sub(target, eye));
  const r = unit(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const v = sub(point, eye);
  const z = dot(v, f);
  const t = Math.tan((fovDeg * Math.PI) / 360);
  return { x: dot(v, r) / (z * t * aspect), y: dot(v, u) / (z * t), z };
}

/**
 * @param {object} o
 * @param {number[][]} o.points 取景點（世界座標）
 * @param {number[]} o.target 注視點（只會調整 y）
 * @param {number[]} o.dir 從注視點指向鏡頭的方向
 * @param {{w:number,h:number}} o.viewport 畫面大小（px）
 * @param {{top:number,bottom:number,left:number,right:number}} o.safe 可用區域（px）
 * @param {number[]} [o.yRange] 注視點 y 相對於 target[1] 的可調範圍
 * @param {number} [o.fill] 取景點最多佔可用區域的比例（以中心縮放），小於 1 時四周留白、鏡頭拉遠
 * @returns {{distance:number, targetY:number, offsetX:number, offsetY:number}}
 */
export function fitView({ points, target, dir, fovDeg, aspect, viewport, safe, yRange = [0, 0], fill = 1 }) {
  const d = unit(dir);
  const hx = ((safe.right - safe.left) / viewport.w) * fill; // 可用區域的半寬／半高（NDC 單位）
  const hy = ((safe.bottom - safe.top) / viewport.h) * fill;

  const fits = (dist, ty) => {
    const tgt = [target[0], ty, target[2]];
    const eye = [tgt[0] + d[0] * dist, ty + d[1] * dist, tgt[2] + d[2] * dist];
    for (const p of points) {
      const n = projectNdc(p, eye, tgt, fovDeg, aspect);
      if (n.z <= 0.1 || Math.abs(n.x) > hx || Math.abs(n.y) > hy) return false;
    }
    return true;
  };
  const minDist = (ty) => {
    let lo = 0.5;
    let hi = 1000;
    if (!fits(hi, ty)) return Infinity;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid, ty)) hi = mid; else lo = mid;
    }
    return hi;
  };

  // 粗掃再細掃，挑出最短距離的注視點高度
  let best = { ty: target[1], dist: minDist(target[1]) };
  const [y0, y1] = [target[1] + yRange[0], target[1] + yRange[1]];
  if (y1 > y0) {
    const scan = (from, to, steps) => {
      for (let i = 0; i <= steps; i++) {
        const ty = from + ((to - from) * i) / steps;
        const dist = minDist(ty);
        if (dist < best.dist) best = { ty, dist };
      }
    };
    scan(y0, y1, 32);
    const step = (y1 - y0) / 32;
    scan(Math.max(y0, best.ty - step), Math.min(y1, best.ty + step), 16);
  }

  return {
    distance: best.dist,
    targetY: best.ty,
    offsetX: viewport.w / 2 - (safe.left + safe.right) / 2,
    offsetY: viewport.h / 2 - (safe.top + safe.bottom) / 2,
  };
}
