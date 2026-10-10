// Candidate only. No model, storage, event, or renderer dependencies.
// Call with the THREE camera/target/anchor objects already used by the app.
const finite = p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);

export function projectAnchor(camera, anchor) {
  camera.updateMatrixWorld();
  const local = anchor.clone().applyMatrix4(camera.matrixWorldInverse);
  if (!finite(local) || local.z >= -camera.near) return null;
  const projected = anchor.clone().project(camera);
  return finite(projected) ? projected : null;
}

// Translate the camera and orbit target equally in the image plane. The camera
// direction and distance to its target remain unchanged, including after a pan.
export function putAnchorAtNdc(camera, target, anchor, desired) {
  const projected = projectAnchor(camera, anchor);
  if (!projected || !Number.isFinite(desired.x) || !Number.isFinite(desired.y)) return false;
  const pointAtDepth = projected.clone().set(desired.x, desired.y, projected.z).unproject(camera);
  const delta = anchor.clone().sub(pointAtDepth);
  if (!finite(delta)) return false;
  camera.position.add(delta);
  target.add(delta);
  camera.updateMatrixWorld();
  return true;
}

// Product policy: magnification holds the subject still; only a changing pinch
// midpoint pans it. The pointer position does not silently select another focus.
export function zoomSubject({ camera, target, anchor, factor = 1, dx = 0, dy = 0,
  width, height, minZoom = .4, maxZoom = 3 }) {
  if (!(width > 0 && height > 0 && factor > 0) || !Number.isFinite(factor) ||
      !Number.isFinite(dx) || !Number.isFinite(dy)) return false;
  const before = projectAnchor(camera, anchor);
  if (!before) return false;
  const previousZoom = camera.zoom;
  const nextZoom = Math.min(maxZoom, Math.max(minZoom, previousZoom * factor));
  if (nextZoom === previousZoom && dx === 0 && dy === 0) return false;
  camera.zoom = nextZoom;
  camera.updateProjectionMatrix();
  if (!putAnchorAtNdc(camera, target, anchor, { x: before.x + 2 * dx / width,
      y: before.y - 2 * dy / height })) {
    camera.zoom = previousZoom;
    camera.updateProjectionMatrix();
    return false;
  }
  return true;
}

// Coordinates are local to the canvas, not the window. Also works when the
// landscape canvas is CSS-rotated clockwise on a portrait phone.
export function canvasPoint({ clientX, clientY }, rect, width, height, rotated = false) {
  return rotated ? {
    x: (clientY - rect.top) * width / rect.height,
    y: (rect.right - clientX) * height / rect.width
  } : {
    x: (clientX - rect.left) * width / rect.width,
    y: (clientY - rect.top) * height / rect.height
  };
}

// Optional new-profile projection. Absence of projection metadata must continue
// to select the R05 formula, so old restored views keep their exact projection.
export function verticalFov(aspect, projection) {
  const baseTangent = Math.tan(32 * Math.PI / 360);
  if (projection?.kind === 'horizontal' && projection.referenceAspect > 0 &&
      Number.isFinite(projection.referenceAspect)) {
    return 2 * Math.atan(baseTangent * projection.referenceAspect / aspect) * 180 / Math.PI;
  }
  return aspect >= 1 ? 32 : 2 * Math.atan(baseTangent / aspect) * 180 / Math.PI;
}
