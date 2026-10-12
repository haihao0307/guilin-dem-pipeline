/** Isolated, reversible CANDIDATE-target constraint for the static R30 prefix.
 * No Three dependency, global state, mutations, roots, radii, surface queries,
 * free-tail edits, rendering or collision claims.
 *
 * Coordinates are metres in the current body's geometry coordinate system.
 * rootLateralM is dot(root - currentOrigin, unit(currentAxes[0])). It is an
 * actual current-head coordinate, not template x and not world x. Do not divide
 * it by headFrame.scale: that would mix actual and template-space distances.
 *
 * widthScale is supplied by the caller. If measured cross-sectional widths are
 * available, use currentHalfWidth/rootHalfWidth to preserve the normalized
 * lateral label while allowing head width to vary along the prefix. The default
 * 1 does not estimate head width or claim to follow a surface meridian.
 *
 * A single coordinate cannot identify a connected scalp route. Projection onto
 * real triangles may erase this correction or jump to another face. The caller
 * must reproject and recheck continuous segments, including the release join.
 * This module has NOT been verified on a rendered body or a human surface.
 */

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function xyz(value, name) {
  const result = Array.isArray(value) || ArrayBuffer.isView(value)
    ? [value[0], value[1], value[2]]
    : [value?.x, value?.y, value?.z];
  result.forEach((component, index) => finite(component, `${name}[${index}]`));
  return result;
}

function frameLateral(headFrame) {
  const origin = xyz(headFrame?.currentOrigin, 'headFrame.currentOrigin');
  const axis = xyz(headFrame?.currentAxes?.[0], 'headFrame.currentAxes[0]');
  const length = Math.hypot(...axis);
  if (!Number.isFinite(length) || length <= 1e-12) throw new RangeError('Head lateral axis is degenerate');
  return {origin, axis: axis.map(value => value / length)};
}

function coordinate(point, origin, axis) {
  return point.reduce((sum, value, index) => sum + (value - origin[index]) * axis[index], 0);
}

/** Measure an actual point's current-head lateral coordinate in metres. */
export function headLateralCoordinateR30(point, headFrame) {
  const {origin, axis} = frameLateral(headFrame);
  return coordinate(xyz(point, 'point'), origin, axis);
}

/**
 * Return a new candidate target and diagnostics; never mutate an input.
 *
 * progress is normalized over the PREFIX ONLY, j / surfaceSegments, in [0, 1].
 * A value outside that interval is rejected rather than silently editing a tail.
 * Default startProgress=1/20 preserves root 0 and prefix point 1 exactly for the
 * existing 20-step prefix. Smoothstep gives a zero correction derivative at its
 * start and end. The bounded tanh response avoids a hard displacement-clamp kink.
 * strength=0 or maxCorrectionM=0 is an exact coordinate-value rollback.
 *
 * widthScale is a positive caller-provided current-width/root-width ratio. It
 * must be sampled continuously along a strand; discontinuous measurements can
 * still create discontinuous targets. No width is invented by this function.
 * Default 12 mm is a candidate-target safety bound, NOT an approved skin offset.
 */
export function preserveMeridianTargetR30({
  rootLateralM,
  target,
  progress,
  headFrame,
  strength = 1,
  widthScale = 1,
  startProgress = 1 / 20,
  maxCorrectionM = 0.012,
} = {}) {
  finite(rootLateralM, 'rootLateralM');
  finite(progress, 'progress');
  finite(strength, 'strength');
  finite(widthScale, 'widthScale');
  finite(startProgress, 'startProgress');
  finite(maxCorrectionM, 'maxCorrectionM');
  if (progress < 0 || progress > 1) throw new RangeError('progress must describe the prefix only, in [0, 1]');
  if (strength < 0 || strength > 1) throw new RangeError('strength must be in [0, 1]');
  if (widthScale <= 0) throw new RangeError('widthScale must be positive');
  if (startProgress < 0 || startProgress >= 1) throw new RangeError('startProgress must be in [0, 1)');
  if (maxCorrectionM < 0) throw new RangeError('maxCorrectionM must be nonnegative');
  const point = xyz(target, 'target');
  const {origin, axis} = frameLateral(headFrame);
  const originalLateralM = coordinate(point, origin, axis);
  const desiredLateralM = rootLateralM * widthScale;
  const localProgress = Math.max(0, (progress - startProgress) / (1 - startProgress));
  const smoothWeight = localProgress * localProgress * (3 - 2 * localProgress);
  const weight = strength * smoothWeight;
  const unboundedCorrectionM = (desiredLateralM - originalLateralM) * weight;
  const appliedCorrectionM = maxCorrectionM > 0
    ? maxCorrectionM * Math.tanh(unboundedCorrectionM / maxCorrectionM)
    : 0;
  // Keep the exact input numbers, including signed zero, on the off branch.
  const result = appliedCorrectionM === 0 ? [...point]
    : point.map((value, index) => value + axis[index] * appliedCorrectionM);
  return {
    target: result,
    active: appliedCorrectionM !== 0,
    progress,
    weight,
    rootLateralM,
    originalLateralM,
    desiredLateralM,
    resultLateralM: coordinate(result, origin, axis),
    widthScale,
    unboundedCorrectionM,
    appliedCorrectionM,
    maxCorrectionM,
  };
}
