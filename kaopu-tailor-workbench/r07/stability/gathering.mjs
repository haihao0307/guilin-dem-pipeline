// Source-declared gathering, independent of the old 15% demo ease limit.
export function requiresGatheredStitchSites(seam) {
  const g = seam?.gathering;
  if (!g) return false;
  const a = g.ruffleCoefficientA, b = g.ruffleCoefficientB;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
    throw Error('INVALID_SOURCE_GATHERING: positive finite coefficients required');
  }
  return Math.abs(a - b) > 1e-8 * Math.max(1, a, b);
}
