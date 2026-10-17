/** Shared analytic sphere sample kernel, with fixed IEEE-754 operation order.
 * Universal mathematical constants, never source-coordinate templates.
 */
const Q12 = [0, 0.5, 0.8660254037844386, 1];
const Q16 = [0, 0.3826834323650897, 0.7071067811865476, 0.9238795325112867, 1];
export function sinSample(i, n) {
  if (n !== 12 && n !== 16) throw new Error('Only fixed 12/16 sample lattices are supported');
  const q = n === 12 ? Q12 : Q16, k = n / 4;
  i = ((i % n) + n) % n;
  if (i <= k) return q[i];
  if (i <= k * 2) return q[k * 2 - i];
  if (i <= k * 3) return -q[i - k * 2];
  return -q[k * 4 - i];
}
export function sphereOffset(radius, latitude, longitude, longitudeSegments, latitudeSegments) {
  const rho = radius * sinSample(latitude, latitudeSegments * 2);
  const dx = rho * sinSample(longitude, longitudeSegments);
  const dy = radius * sinSample(latitude + latitudeSegments / 2, latitudeSegments * 2);
  const dz = rho * sinSample(longitude + longitudeSegments / 4, longitudeSegments);
  return [dx, dy, dz];
}
