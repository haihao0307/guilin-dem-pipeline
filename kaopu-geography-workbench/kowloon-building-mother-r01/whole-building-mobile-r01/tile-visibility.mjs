/** Conservative broad-phase only: never replace, simplify or approximate a field.
 *
 * Prepare one frame, one frustum per GL scissor tile, then test world AABBs.
 * Tile coordinates are bottom-left framebuffer PIXEL EDGES, not CSS pixels or
 * pixel centres. Pass the render width/height, not the presentation dimensions.
 * The camera is the interaction renderer's CAMERA: vertical FOV in radians,
 * right = normalize(cross(forward, abs(forward.y) > .999 ? Z : Y)).
 *
 * In exact arithmetic, a ray through the closed tile lies in all five inward
 * half-spaces. An AABB's support vertex maximizes each plane expression. Only
 * an entirely negative maximum proves exclusion. Passing all planes is only a
 * necessary condition: false positives are intentional. There is no near/far
 * distance cutoff, occlusion assumption, projected-corner test or mesh creation.
 *
 * Numerical guards expand acceptance, account for Float32 uniforms, and disable
 * side-plane rejection near the discontinuous camera-up branch. These are not
 * a certification of every GPU's transcendental precision. Sampled ray tests
 * are regression evidence, not a mathematical proof of a GPU implementation.
 */

const FLOAT_GUARD = 2 ** -17;
const ABS_GUARD = 1e-7;
const finite3 = v => v != null && v.length === 3 && Array.from(v).every(Number.isFinite);
const validBounds = b => finite3(b?.min) && finite3(b?.max) && b.min.every((v, i) => v <= b.max[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = v => { const d = Math.hypot(...v); return d > 0 && Number.isFinite(d) ? v.map(x => x / d) : null; };
const plane = (a, b, scale) => normalize(a.map((v, i) => v + scale * b[i]));

/** Prepare once per frame from the SAME camera and render dimensions as GLSL.
 * Inputs are copied. eye/target/fov are rounded like WebGL float uniforms.
 * A degenerate/overflowing camera fails open (valid:false), never hides geometry.
 */
export function prepareTileFrame({ eye, target, fov, width, height }) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) throw new RangeError('Positive finite render dimensions required');
  if (!finite3(eye) || !finite3(target) || !Number.isFinite(fov) || fov <= 0 || fov >= Math.PI) throw new RangeError('Finite camera and vertical FOV in (0, PI) required');
  const origin = Array.from(eye, Math.fround), aim = Array.from(target, Math.fround);
  const forward = normalize(aim.map((v, i) => v - origin[i]));
  const base = { eye: origin, width, height, valid: false, sidePlanesReliable: false };
  if (!forward || !finite3(origin) || Math.fround(fov) >= Math.PI) return base;
  const vertical = Math.abs(forward[1]);
  const right = normalize(cross(forward, vertical > .999 ? [0, 0, 1] : [0, 1, 0]));
  if (!right) return base;
  const up = cross(right, forward), tanHalfFov = Math.tan(Math.fround(fov) * .5);
  if (!Number.isFinite(tanHalfFov)) return base;
  return { ...base, forward, right, up, tanHalfFov, valid: true,
    // Either GLSL up-vector branch may be selected within this guard band.
    // Forward-only rejection is conservative for both orientations.
    sidePlanesReliable: Math.abs(vertical - .999) > FLOAT_GUARD };
}

/** Prepare once per tile. Closed edges retain zero-width bounds and edge hits.
 * The returned planes pass through frame.eye; aabbIntersectsTile uses relative
 * coordinates instead of cancellation-prone large world-space plane offsets.
 */
export function prepareTileFrustum(frame, { x, y, width, height }) {
  if (![x, y, width, height].every(Number.isFinite) || width < 0 || height < 0) throw new RangeError('Finite tile edges and nonnegative size required');
  if (!frame?.valid) return { eye: frame?.eye, planes: [] };
  const { forward: f, right: r, up: u, tanHalfFov: t } = frame;
  const left = t * (2 * x - frame.width) / frame.height;
  const right = t * (2 * (x + width) - frame.width) / frame.height;
  const bottom = t * (2 * y - frame.height) / frame.height;
  const top = t * (2 * (y + height) - frame.height) / frame.height;
  if (![left, right, bottom, top].every(Number.isFinite)) return { eye: frame.eye, planes: [] };
  const planes = [f];
  if (frame.sidePlanesReliable) planes.push(plane(r, f, -left), plane(r.map(v => -v), f, right), plane(u, f, -bottom), plane(u.map(v => -v), f, top));
  return { eye: frame.eye, planes: planes.filter(Boolean) };
}

/** True means KEEP the original field instance; false means proven outside a
 * tile half-space (with outward numerical padding). Missing/malformed bounds
 * fail open. Bounds must enclose the FULL domain evaluated by the shader.
 * Use measured.bounds, translated archetype.bounds, and transformed rail
 * template.bounds (includes arcs, tube radii AND all embedded support posts).
 */
export function aabbIntersectsTile(frustum, bounds) {
  if (!validBounds(bounds) || !finite3(frustum?.eye) || !frustum?.planes?.length) return true;
  const eye = frustum.eye;
  for (const normal of frustum.planes) {
    if (!finite3(normal)) return true;
    let maximum = 0, scale = 1;
    for (let axis = 0; axis < 3; axis++) {
      const n = normal[axis], v = n >= 0 ? bounds.max[axis] : bounds.min[axis];
      maximum += n * (v - eye[axis]);
      // Sum of absolute world magnitudes also covers Float32 conversion and
      // near-cancellation when camera and model have a large common offset.
      scale += Math.max(Math.abs(bounds.min[axis]), Math.abs(bounds.max[axis])) + Math.abs(eye[axis]);
    }
    if (!Number.isFinite(maximum) || !Number.isFinite(scale)) return true;
    if (maximum < -(ABS_GUARD + FLOAT_GUARD * scale)) return false;
  }
  return true;
}

/** Full affine local-to-world AABB, including rotation, reflection or scaling.
 * Matrix columns are xAxis/yAxis/zAxis. For the existing upright rails use
 * {origin:instance.origin,xAxis:instance.xAxis,zAxis:instance.zAxis}; yAxis is Y.
 * For translated archetypes pass {origin:instance.translation}. Cache at model
 * construction, not per tile. No eight-corner allocation; all local extrema
 * contribute. Invalid/overflowing input returns null, which culling retains.
 */
export function transformBounds(bounds, { origin = [0, 0, 0], xAxis = [1, 0, 0], yAxis = [0, 1, 0], zAxis = [0, 0, 1] } = {}) {
  if (!validBounds(bounds) || ![origin, xAxis, yAxis, zAxis].every(finite3)) return null;
  const axes = [xAxis, yAxis, zAxis], min = [], max = [];
  for (let row = 0; row < 3; row++) {
    let lo = origin[row], hi = origin[row], scale = 1 + Math.abs(origin[row]);
    for (let col = 0; col < 3; col++) {
      const a = axes[col][row] * bounds.min[col], b = axes[col][row] * bounds.max[col];
      lo += Math.min(a, b); hi += Math.max(a, b); scale += Math.max(Math.abs(a), Math.abs(b));
    }
    const padding = ABS_GUARD + FLOAT_GUARD * scale;
    min.push(lo - padding); max.push(hi + padding);
  }
  return validBounds({ min, max }) ? { min, max } : null;
}
