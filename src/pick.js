// 點擊／滑鼠指到的是哪個東西（純邏輯，不碰 three，可用 node 測）。
// hits：射線由近到遠的交點（three 的 intersectObjects 結果，只用到 object.userData／object.parent／point）。
// 規則：
// 1. 從打到的物件往上找父節點，先遇到 userData.prop 就是小互動、先遇到 userData.key 就是內容物件。
// 2. 小互動（包含它的隱形點擊範圍）優先於內容物件的「隱形點擊範圍」——例如浮空魔導書在書架的點擊範圍裡面；
//    但內容物件的實體幾何擋在前面時，以實體為準。
// 3. 都只打到內容物件的點擊範圍時，取最近的那個。
// 回傳 { key, prop, obj, point } 或 null。
export function resolvePick(hits) {
  let fallback = null;
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData?.key && !o.userData?.prop) o = o.parent;
    if (!o) continue;
    const r = { key: o.userData.key ?? null, prop: o.userData.prop ?? null, obj: o, point: h.point };
    if (r.prop) return r;
    if (!h.object.userData?.hitbox) return r;
    if (!fallback) fallback = r;
  }
  return fallback;
}
