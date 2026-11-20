// 裝置分級：決定陰影、bloom、粒子數與解析度。
export const TIER_SETTINGS = {
  high: { shadows: true, bloom: true, particles: 1, pixelRatioMax: 2 },
  low: { shadows: false, bloom: false, particles: 0.35, pixelRatioMax: 1.25 },
};

export function pickTier({ webgl, mobile, cores, reducedMotion }) {
  if (!webgl) return 'none';
  if (mobile || cores < 4 || reducedMotion) return 'low';
  return 'high';
}
