// R3.12's half extents normalize its material field. They are not the physical
// clipping bounds of the new thin mesh, and must not inherit a tall water domain.
export const PLASTER_METRIC_SCALE_METRES = 1.8;

/** Return existing createNativePlaster params with equal metric field axes.
 * Reuse one center and scale throughout a facade, including every storey.
 * Actual wall/region dimensions, the source functions, and V26 are unchanged.
 */
export function makeMetricPlasterField({
  center,
  metresPerUnit = PLASTER_METRIC_SCALE_METRES,
} = {}) {
  if (!Array.isArray(center) || center.length !== 2 || !center.every(Number.isFinite)) {
    throw Error('A shared finite [u, y] field center is required');
  }
  if (!Number.isFinite(metresPerUnit) || metresPerUnit < .08) {
    throw Error('Metric plaster field scale must be finite and at least 0.08 metres');
  }
  return Object.freeze({
    center: Object.freeze([...center]),
    half: Object.freeze([metresPerUnit, metresPerUnit]),
  });
}
