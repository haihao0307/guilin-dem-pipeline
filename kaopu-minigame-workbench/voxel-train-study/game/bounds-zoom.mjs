// Optional stricter policy: preserve the projected, unclipped subject bounds
// center, rather than its 3D center. The input points stay fixed for the session.
export function projectFrame(camera, points) {
  camera.updateMatrixWorld();
  if (!Array.isArray(points) || points.length < 2) return null;
  let left, right, bottom, top;
  for (const point of points) {
    const depth = -point.clone().applyMatrix4(camera.matrixWorldInverse).z;
    const projected = point.clone().project(camera);
    if (!(depth > camera.near) || !Number.isFinite(projected.x + projected.y)) return null;
    const p = {x: projected.x, y: projected.y, depth};
    if (!left || p.x < left.x) left = p;
    if (!right || p.x > right.x) right = p;
    if (!bottom || p.y < bottom.y) bottom = p;
    if (!top || p.y > top.y) top = p;
  }
  return {x: (left.x + right.x) / 2, y: (bottom.y + top.y) / 2,
    width: right.x - left.x, height: top.y - bottom.y, left, right, bottom, top};
}

function centerFrame(camera, target, points, desired) {
  // Translation along camera right/up preserves every point's depth. Each
  // projected extremum is piecewise linear in that translation; solve using
  // the active extreme points, rechecking if their identities change.
  for (let i = 0; i < 12; i++) {
    const f = projectFrame(camera, points);
    if (!f) return false;
    const xError = f.x - desired.x, yError = f.y - desired.y;
    if (Math.abs(xError) + Math.abs(yError) < 1e-12) return true;
    const px = camera.projectionMatrix.elements[0], py = camera.projectionMatrix.elements[5];
    const dx = xError / (px * .5 * (1 / f.left.depth + 1 / f.right.depth));
    const dy = yError / (py * .5 * (1 / f.bottom.depth + 1 / f.top.depth));
    if (!Number.isFinite(dx + dy)) return false;
    const delta = target.clone().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(dx)
      .add(target.clone().setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(dy));
    camera.position.add(delta); target.add(delta); camera.updateMatrixWorld();
  }
  const f = projectFrame(camera, points);
  return !!f && Math.abs(f.x - desired.x) + Math.abs(f.y - desired.y) < 1e-10;
}

export function zoomFrame({camera, target, points, factor = 1, dx = 0, dy = 0,
  width, height, minZoom = .4, maxZoom = 3}) {
  if (!(width > 0 && height > 0 && factor > 0) || !Number.isFinite(factor + dx + dy)) return false;
  const before = projectFrame(camera, points);
  if (!before) return false;
  const previousZoom = camera.zoom;
  const nextZoom = Math.min(maxZoom, Math.max(minZoom, previousZoom * factor));
  if (nextZoom === previousZoom && dx === 0 && dy === 0) return false;
  const position = camera.position.clone(), lookAt = target.clone();
  camera.zoom = nextZoom; camera.updateProjectionMatrix();
  if (centerFrame(camera, target, points, {x: before.x + 2 * dx / width,
      y: before.y - 2 * dy / height})) return true;
  camera.position.copy(position); target.copy(lookAt); camera.zoom = previousZoom;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  return false;
}
