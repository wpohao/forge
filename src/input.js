// 拖曳和點擊的分界：位移 ≤ 6px 且 ≤ 500ms 才算點擊，避免旋轉結束時誤觸物件。
export const TAP_MAX_PX = 6;
export const TAP_MAX_MS = 500;

export function isTap(down, up) {
  const dist = Math.hypot(up.x - down.x, up.y - down.y);
  return dist <= TAP_MAX_PX && up.t - down.t <= TAP_MAX_MS;
}

// 依 pointerId 追蹤：同一次手勢中只要出現兩指以上（例如雙指縮放），整次都不算點擊。
export function createTapTracker() {
  const active = new Map();
  let multi = false;
  return {
    down({ id, x, y, t }) {
      active.set(id, { x, y, t });
      if (active.size > 1) multi = true;
    },
    up({ id, x, y, t }) {
      const d = active.get(id);
      active.delete(id);
      const wasMulti = multi;
      if (active.size === 0) multi = false;
      if (!d || wasMulti) return false;
      return isTap(d, { x, y, t });
    },
    cancel(id) {
      active.delete(id);
      if (active.size === 0) multi = false;
    },
  };
}
