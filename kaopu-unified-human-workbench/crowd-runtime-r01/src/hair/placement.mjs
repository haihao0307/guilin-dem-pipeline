/** Coordinate adaptation for the pinned F13 solver; no force/quality changes. */

export function assertRigid(matrix, epsilon = 1e-5) {
  const e = matrix.elements;
  if (e.length !== 16 || !e.every(Number.isFinite)) throw new Error('Hair placement must be finite');
  const dot = (a, b) => e[a] * e[b] + e[a + 1] * e[b + 1] + e[a + 2] * e[b + 2];
  if ([0, 4, 8].some(a => Math.abs(dot(a, a) - 1) > epsilon)
      || [[0, 4], [0, 8], [4, 8]].some(([a, b]) => Math.abs(dot(a, b)) > epsilon)
      || Math.abs(matrix.determinant() - 1) > epsilon
      || Math.abs(e[3]) + Math.abs(e[7]) + Math.abs(e[11]) + Math.abs(e[15] - 1) > epsilon) {
    throw new Error('Hair placement supports rigid translation/rotation; author body scale in the native model');
  }
}

export function transformTriples(array, matrix, vector = false) {
  if (!array) return;
  const e = matrix.elements;
  for (let i = 0; i < array.length; i += 3) {
    const x = array[i], y = array[i + 1], z = array[i + 2];
    array[i] = e[0] * x + e[4] * y + e[8] * z + (vector ? 0 : e[12]);
    array[i + 1] = e[1] * x + e[5] * y + e[9] * z + (vector ? 0 : e[13]);
    array[i + 2] = e[2] * x + e[6] * y + e[10] * z + (vector ? 0 : e[14]);
  }
}

/**
 * F13 builds its neutral scalp/torso fields at the model origin. Move that
 * completed, private state once, before enabling the actor's animated pose.
 * Rest lengths, local curvature, density and collision settings are retained.
 */
export function placeSolver(photo, matrix) {
  assertRigid(matrix);
  const d = photo.dynamics, b = photo.binding, c = photo.collisions;
  const arrays = new Set();
  for (const a of [photo.reference, d.q, d.rest, d.previous, d.equilibrium,
    d.sleepReference, d.positions, d.anchors, d.grabReference]) {
    if (a && !arrays.has(a)) { transformTriples(a, matrix); arrays.add(a); }
  }
  transformTriples(d.velocity, matrix, true);
  const matrices = new Set();
  const move = m => { if (m && !matrices.has(m)) { m.premultiply(matrix); matrices.add(m); } };
  for (const m of [photo.restFrame, b.frame, b.restFrame, d.equilibriumFrame,
    c.bodyFrame, c.headFrame, c.previousHead, c.surface?.frame, c.surface?.previousFrame]) move(m);
  for (const s of c.shapes) { move(s.rest); move(s.frame); move(s.previous); s.inverse.copy(s.frame).invert(); s.previousInverse.copy(s.previous).invert(); }
  photo.inverseRest.copy(photo.restFrame).invert();
  b.inverse.copy(b.frame).invert();
  c.bodyInverse.copy(c.bodyFrame).invert();
  c.headInverse?.copy(c.headFrame).invert();
  if (c.surface?.frame) c.surface.inverse.copy(c.surface.frame).invert();
  b.nativeKey = null; b.fullNativeKey = null; b.frameVersion = (b.frameVersion || 0) + 1;
  c.key = null; d.anchorKey = null; d.contactCache.fill(null); d.sleepReferenceValid = false;
  if (d.bundleFriction) d.bundleFriction.count = 0;
  // The original detail model caches spatial wind harmonics at rest roots.
  // Rebuild those same harmonics at this actor's placed rest roots.
  if (d.detail?.basis && d.groom?.hairs) {
    const e = b.frame.elements, basis = d.detail.basis;
    for (let i = 0; i < d.groom.hairs.length; i++) {
      const p = d.groom.hairs[i].p;
      const x = e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12];
      const y = e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13];
      const z = e[2] * p[0] + e[6] * p[1] + e[10] * p[2] + e[14];
      const a = x * 23 + z * 15, v = y * 32 - x * 11, f = x * 157 + z * 103, o = y * 83 - z * 139;
      const angles = [a, v, f, o, a * .81 + 1.3, v + f * .25];
      for (let j = 0; j < 6; j++) { basis[i * 12 + j * 2] = Math.sin(angles[j]); basis[i * 12 + j * 2 + 1] = Math.cos(angles[j]); }
    }
  }
  d.writeOffsets();
}

/**
 * Read the body's final pose, without advancing it. Collision rest frames live
 * in the actor's initial world placement, so bone transport is M(t) S M(0)^-1.
 * Kinematic history belongs to hair, not the body factory or another actor.
 */
export function createMotionFacade(THREE, motion) {
  const state = {
    initializing: true, world: new THREE.Matrix4(), initialInverse: new THREE.Matrix4(),
    matrices: new Map(), air: [0, 0, 0], kinematics: null, input: null, transportInactive: false,
  };
  let facade;
  const methods = new Map();
  const special = {
    advance: () => false,
    sampleDisplay: (index, point) => state.initializing ? point : motion.sampleDisplay(index, point),
    sampleDisplayInto: (index, x, y, z, out) => {
      if (state.initializing || !motion.active) { out[0] = x; out[1] = y; out[2] = z; return out; }
      return motion.sampleDisplayInto(index, x, y, z, out);
    },
    skinMatrix: name => {
      if (state.initializing) return new THREE.Matrix4();
      if (!state.matrices.has(name)) {
        state.matrices.set(name, state.world.clone().multiply(motion.skinMatrix(name)).multiply(state.initialInverse));
      }
      return state.matrices.get(name);
    },
    updateKinematics: (frame, dt) => motion.updateKinematics.call(facade, frame, dt),
    prepareRender: () => { if (!state.initializing) motion.prepareRender(); },
  };
  facade = new Proxy(motion, {
    get(target, key) {
      if (Object.prototype.hasOwnProperty.call(special, key)) return special[key];
      if (key === 'active') return !state.initializing && (target.active || state.transportInactive);
      if (key === 'playing') return !state.initializing && target.playing;
      if (key === 'airVelocity') return state.air;
      if (key === 'kinematics' || key === 'input') return state[key];
      const value = target[key];
      if (typeof value !== 'function') return value;
      if (!methods.has(key)) methods.set(key, value.bind(target));
      return methods.get(key);
    },
    set(target, key, value) {
      if (key === 'kinematics' || key === 'input') { state[key] = value; return true; }
      throw new Error('Hair attempted to mutate body motion: ' + String(key));
    },
  });
  function sync(world, initialize = false) {
    assertRigid(world);
    state.world.copy(world); state.matrices.clear();
    if (initialize) state.initialInverse.copy(world).invert();
    const e = world.elements, a = motion.airVelocity || [0, 0, 0];
    state.air[0] = e[0] * a[0] + e[4] * a[1] + e[8] * a[2];
    state.air[1] = e[1] * a[0] + e[5] * a[1] + e[9] * a[2];
    state.air[2] = e[2] * a[0] + e[6] * a[1] + e[10] * a[2];
  }
  return { facade, state, sync, enable: () => { state.initializing = false; },
    withBoneTransport(callback) {
      const old = state.transportInactive; state.transportInactive = true;
      try { return callback(); } finally { state.transportInactive = old; }
    },
    resetKinematics: () => { state.kinematics = null; state.input = null; } };
}
