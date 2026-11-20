// 第一人稱打鐵的計數（純邏輯，不碰 DOM／three，可用 node 測）。
// 每敲 per 下完成一次附魔，附魔種類依序輪替（0..kinds-1，對應兵器架的 4 類技能與附魔色）。
export function createForgeGame({ per = 5, kinds = 4 } = {}) {
  const g = {
    per,
    count: 0, // 這一輪已經敲了幾下
    kind: 0, // 下一次完成時是哪一種附魔
    // 敲一下：回傳 { count（含這一下）, enchanted（完成的附魔種類，沒完成是 null）}
    strike() {
      g.count += 1;
      if (g.count < per) return { count: g.count, enchanted: null };
      const done = g.kind;
      g.count = 0;
      g.kind = (g.kind + 1) % kinds;
      return { count: per, enchanted: done };
    },
    // 離開打鐵時：清掉敲到一半的次數，但記得下一個要附哪一種
    reset() { g.count = 0; },
  };
  return g;
}
