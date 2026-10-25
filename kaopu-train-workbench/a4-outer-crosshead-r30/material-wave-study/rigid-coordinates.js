/* Shading coordinates only; never patches DYNAMIC or scalar fields. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createMaterialCoordinates = factory;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMaterialCoordinates(SCENE, DYNAMIC) {
  'use strict';
  const D = DYNAMIC;
  const wheelCenters = new Map();
  for (let axle = 0; axle < D.wheelRadii.length; axle++) {
    const tyre = SCENE.parts.find(p => p.id === `wheel/axle${axle}_left_tyre`);
    if (!tyre) throw Error(`Missing axle${axle} reference tyre; cannot safely infer material coordinates`);
    const center = [1, 2].map(j => (tyre.aabb_min[j] + tyre.aabb_max[j]) / 2);
    if (Math.abs(center[0] - D.wheelRadii[axle]) > 1e-8) throw Error('Wheel height/radius mismatch: coordinate adapter needs review');
    wheelCenters.set(axle, center);
  }
  const midpoint = p => [0, 1, 2].map(j => (p.aabb_min[j] + p.aabb_max[j]) / 2);
  function inverseMap(part, theta, installation) {
    if (!Number.isFinite(theta)) throw Error('Use the finite theta from the render mechanical snapshot');
    if (!installation || !['baseline', 'candidate'].includes(installation.mode)) throw Error('Pass the same explicit installation snapshot used by scalar fields');
    if (part.group === 'wheel') {
      const match = part.id.match(/^wheel\/axle(\d+)_/);
      if (!match || !wheelCenters.has(Number(match[1]))) throw Error('Unsupported parameterized wheel field');
      const axle = Number(match[1]), center = wheelCenters.get(axle);
      const angle = D.wheelTheta(theta, axle) - D.referenceTheta;
      // Geometry uses atan2(yy,zz)-theta: forward body rotation is -angle.
      // This +angle inverse follows the actual parameterized wheel, including
      // differing bogie/trailing radii; a round tyre still carries rotating finish.
      const c = Math.cos(angle), s = Math.sin(angle);
      return {kind: 'parameterized-wheel', inverse: p => {
        const y = p[1] - center[0], z = p[2] - center[1];
        return [p[0], center[0] + c*y - s*z, center[1] + s*y + c*z];
      }, axle, center, parameterTheta: D.wheelTheta(theta, axle)};
    }
    // Stack fields are NEW IDs, not recognized by isCentralControl. Their
    // reference geometry is already in its declared Y layer. Use the exact
    // frameSourceId binding in stack-dynamic.js once, with no extra rebasing,
    // installation rotation, or second dynGresley transform.
    if (part.source === 'stack') {
      if (!part.frameSourceId || D.argument(part) !== 'dynGresley(p)') throw Error('Stack material mapping must follow the actual single dynGresley argument');
      const f = D.gresleyFrame(part, theta, installation);
      if (!f) throw Error('Stack field is missing its reference Gresley frame');
      return {kind: 'stack-gresley-inverse-XZ-once', inverse: p => D.gresleySolver.transformPoint(p, f, true)};
    }
    if (D.isCentralControl && D.isCentralControl(part)) {
      const f = D.gresleyFrame(part, theta, installation);
      return {kind: f ? 'gresley-inverse-XZ' : 'frozen-baseline', inverse: p => f ? D.gresleySolver.transformPoint(p, f, true) : p.slice()};
    }
    if (D.isOutsideValve && D.isOutsideValve(part)) {
      const f = D.valveFrame(part, theta, installation);
      return {kind: f ? 'outside-valve-inverse-YZ' : 'frozen-baseline', inverse: p => D.valvePoint(p, f, true)};
    }
    const mechanicalClass = D.classify(part);
    return {kind: mechanicalClass ? `field-${mechanicalClass.type}` : 'field-static', inverse: p => D.transform(p, theta, mechanicalClass, true, installation)};
  }
  function frame(part, theta, installation) {
    const map = inverseMap(part, theta, installation), origin = midpoint(part);
    const zero = map.inverse([0, 0, 0]);
    // Exact affine basis construction, not finite-difference differentiation.
    // These are rigid affine maps from the existing field adapter. Numerical
    // roundoff is checked in tests; a non-rigid field must supply its own Jacobian.
    const columns = [[1,0,0],[0,1,0],[0,0,1]].map(e => map.inverse(e).map((v,j) => v-zero[j]));
    const rows = [0,1,2].map(j => [...columns.map(c => c[j]), zero[j]-origin[j]]);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const d = rows[i].slice(0,3).reduce((s,v,k) => s+v*rows[j][k],0);
      if (Math.abs(d-(i===j?1:0))>1e-9) throw Error('Non-rigid material map requires an explicit Jacobian, not this rigid adapter');
    }
    return {kind: map.kind, rows, origin, theta, installation: {...installation},
      scalarArgument: part.group === 'wheel' ? `${part.glsl_function}_parameterized(p, wheelTheta)` : D.argument(part, 'p'),
      parameterTheta: map.parameterTheta, axle: map.axle,
      local: p => rows.map(r => r[0]*p[0]+r[1]*p[1]+r[2]*p[2]+r[3]),
      inverseReference: map.inverse};
  }
  return Object.freeze({frame, wheelCenters});
});
