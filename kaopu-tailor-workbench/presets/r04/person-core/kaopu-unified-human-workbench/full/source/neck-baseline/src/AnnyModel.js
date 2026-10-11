/*
 * R02 browser forward pass for the official Anny v0.6.1 model, including all facial actions.
 * Equations follow NAVER's Apache-2.0-licensed Anny implementation:
 * models/phenotype.py, models/rigged_model.py, utils/kinematics.py,
 * and skinning/skinning.py. See ../../licenses/ANNY-APACHE-2.0.txt.
 *
 * Array storage is float32, computation uses JavaScript float64, and the final
 * display positions are float32. Coordinates remain official metres, Z-up.
 * No proportional scaling, joint guesses, or skin-weight truncation occurs.
 */

export const PHENOTYPE_VARIATIONS = {
  race: ['african', 'asian', 'caucasian'],
  gender: ['male', 'female'],
  age: ['newborn', 'baby', 'child', 'young', 'old'],
  muscle: ['minmuscle', 'averagemuscle', 'maxmuscle'],
  weight: ['minweight', 'averageweight', 'maxweight'],
  height: ['minheight', 'maxheight'],
  proportions: ['idealproportions', 'uncommonproportions'],
  cupsize: ['mincup', 'averagecup', 'maxcup'],
  firmness: ['minfirmness', 'averagefirmness', 'maxfirmness'],
};

const DTYPES = {
  float32: Float32Array, float64: Float64Array,
  uint32: Uint32Array, uint16: Uint16Array, uint8: Uint8Array,
  int32: Int32Array, int16: Int16Array, int8: Int8Array,
};

export function identity4() {
  return new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function multiply4(a, b) {
  const out = new Float64Array(16);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[row * 4 + k] * b[k * 4 + col];
      out[row * 4 + col] = sum;
    }
  }
  return out;
}

export function rigidInverse4(a) {
  const out = identity4();
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) out[row * 4 + col] = a[col * 4 + row];
    out[row * 4 + 3] = -(a[row] * a[3] + a[4 + row] * a[7] + a[8 + row] * a[11]);
  }
  return out;
}

function rotationPose(rotation, position = null) {
  const out = identity4();
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) out[row * 4 + col] = rotation[row * 3 + col];
    if (position) out[row * 4 + 3] = position[row];
  }
  return out;
}

function replaceOrientation(pose, orientation) {
  const out = pose.slice();
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) out[row * 4 + col] = orientation[row * 3 + col];
  }
  return out;
}

/** R = Rx(x) * Ry(y) * Rz(z), matching roma.euler_to_rotmat('XYZ', ...). */
export function eulerXYZDegrees(values, translation = null) {
  const [x, y, z] = values.map(v => v * Math.PI / 180);
  const cx = Math.cos(x), sx = Math.sin(x);
  const cy = Math.cos(y), sy = Math.sin(y);
  const cz = Math.cos(z), sz = Math.sin(z);
  return rotationPose([
    cy * cz, -cy * sz, sy,
    cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy,
    sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy,
  ], translation);
}

/** Official demo protocol: XYZ are rotation-vector components in degrees. */
export function rotationVectorDegrees(values,translation=null){
  const [x,y,z]=values.map(v=>v*Math.PI/180),t=Math.hypot(x,y,z),t2=t*t;
  const A=t<1e-6?1-t2/6+t2*t2/120:Math.sin(t)/t;
  const B=t<1e-6?.5-t2/24+t2*t2/720:(1-Math.cos(t))/t2;
  return rotationPose([1-B*(y*y+z*z),B*x*y-A*z,B*x*z+A*y,B*x*y+A*z,1-B*(x*x+z*z),B*y*z-A*x,B*x*z-A*y,B*y*z+A*x,1-B*(x*x+y*y)],translation);
}

/** Proper SO(3) Procrustes projection: argmax_R trace(R^T M), det(R)=+1.
 * Equivalent to U diag(1,1,det(U V^T)) V^T for an SVD of M. We solve the
 * equivalent 4x4 real symmetric unit-quaternion eigenproblem by Jacobi
 * diagonalization, avoiding inverse-matrix iterations near singular matrices.
 * Quaternion convention is xyzw, active rotations, column vectors.
 */
export function specialProcrustes(m) {
  let scale = 0;
  for (const value of m) scale = Math.max(scale, Math.abs(value));
  if (scale === 0) return new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  if (!Number.isFinite(scale)) throw new Error('Non-finite bone covariance');
  const a = Array.from(m, v => v / scale);
  const [xx, xy, xz, yx, yy, yz, zx, zy, zz] = a;
  const k = new Float64Array([
    xx - yy - zz, xy + yx, xz + zx, zy - yz,
    xy + yx, yy - xx - zz, yz + zy, xz - zx,
    xz + zx, yz + zy, zz - xx - yy, yx - xy,
    zy - yz, xz - zx, yx - xy, xx + yy + zz,
  ]);
  const vectors = identity4();
  for (let iteration = 0; iteration < 80; iteration++) {
    let p = 0, q = 1, largest = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const value = Math.abs(k[i * 4 + j]);
        if (value > largest) { largest = value; p = i; q = j; }
      }
    }
    if (largest < 2e-15) break;
    const pp = p * 4 + p, qq = q * 4 + q, pq = p * 4 + q;
    const off = k[pq], tau = (k[qq] - k[pp]) / (2 * off);
    const t = (tau >= 0 ? 1 : -1) / (Math.abs(tau) + Math.hypot(1, tau));
    const c = 1 / Math.hypot(1, t), s = t * c;
    k[pp] -= t * off;
    k[qq] += t * off;
    k[pq] = k[q * 4 + p] = 0;
    for (let i = 0; i < 4; i++) {
      if (i !== p && i !== q) {
        const ip = k[i * 4 + p], iq = k[i * 4 + q];
        k[i * 4 + p] = k[p * 4 + i] = c * ip - s * iq;
        k[i * 4 + q] = k[q * 4 + i] = s * ip + c * iq;
      }
      const vp = vectors[i * 4 + p], vq = vectors[i * 4 + q];
      vectors[i * 4 + p] = c * vp - s * vq;
      vectors[i * 4 + q] = s * vp + c * vq;
    }
  }
  // Prefer the identity quaternion in an exact diagonal tie. A rank-deficient
  // covariance can have nonunique optimum rotations in any implementation.
  let best = 3;
  for (let i = 0; i < 3; i++) if (k[i * 4 + i] > k[best * 4 + best]) best = i;
  let x = vectors[best], y = vectors[4 + best], z = vectors[8 + best], w = vectors[12 + best];
  const norm = Math.hypot(x, y, z, w);
  x /= norm; y /= norm; z /= norm; w /= norm;
  return new Float64Array([
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ]);
}

export function interpolationWeights(value, anchors, extrapolate = false) {
  const out = new Float64Array(anchors.length);
  if (!extrapolate) value = Math.max(anchors[0], Math.min(anchors.at(-1), value));
  let upper = 0;
  while (upper < anchors.length && anchors[upper] < value) upper++;
  upper = Math.max(1, Math.min(anchors.length - 1, upper));
  const alpha = (value - anchors[upper - 1]) / (anchors[upper] - anchors[upper - 1]);
  out[upper - 1] = 1 - alpha;
  out[upper] = alpha;
  return out;
}

function orderedBones(parents) {
  const order = [], seen = new Set();
  while (order.length < parents.length) {
    let progress = false;
    for (let i = 0; i < parents.length; i++) {
      if (!seen.has(i) && (parents[i] < 0 || seen.has(parents[i]))) {
        seen.add(i); order.push(i); progress = true;
      }
    }
    if (!progress) throw new Error('Invalid bone hierarchy');
  }
  return order;
}

function validateParameters(values, labels, kind) {
  for (const [key, value] of Object.entries(values)) {
    if (!labels.includes(key)) throw new Error(`Unknown ${kind}: ${key}`);
    if (!Number.isFinite(value)) throw new Error(`Invalid ${kind}: ${key}`);
  }
}

export class AnnyModel {
  constructor(meta, arrayBuffer, facialMeta = null, facialBuffer = null) {
    this.meta = meta;
    this.metadata = { ...meta, ...(meta.metadata || {}) };
    this.arrays = {};
    for (const [name, spec] of Object.entries(meta.arrays)) {
      const Type = DTYPES[spec.dtype];
      if (!Type) throw new Error(`Unsupported array type: ${spec.dtype}`);
      this.arrays[name] = new Type(arrayBuffer, spec.byteOffset, spec.byteLength / Type.BYTES_PER_ELEMENT);
    }
    this.facialSupplement=null;
    const md = this.metadata, a = this.arrays;
    this.boneLabels = md.bone_labels;
    this.boneParents = md.bone_parents;
    this.localChangeLabels = md.local_change_labels || [];
    this.facialActionLabels = md.facial_action_labels || [];
    this.phenotypeLabels = md.phenotype_labels || ['gender', 'age', 'muscle', 'weight', 'height', 'proportions'];
    this.variations = md.phenotype_variations || PHENOTYPE_VARIATIONS;
    this.anchors = md.anchors || {};
    for (const [name, labels] of Object.entries(this.variations)) {
      if (name === 'race' || this.anchors[name]) continue;
      this.anchors[name] = labels.map((_, i) => name === 'age' ? -1 / 3 + i / 3 : i / (labels.length - 1));
    }
    this.vertexCount = a.template_vertices.length / 3;
    this.boneCount = this.boneLabels.length;
    this.shapeCount = a.blendshape_offsets ? a.blendshape_offsets.length - 1 : meta.arrays.blendshapes.shape[0];
    this.maskWidth = Object.values(this.variations).reduce((n, labels) => n + labels.length, 0);
    this.phenotypeShapeCount = a.stacked_phenotype_blend_shapes_mask.length / this.maskWidth;
    this.influences = a.vertex_bone_weights.length / this.vertexCount;
    this.boneOrder = orderedBones(this.boneParents);
    if (this.shapeCount !== this.phenotypeShapeCount + this.facialActionLabels.length + 2 * this.localChangeLabels.length) {
      throw new Error('Blendshape coefficient layout does not match metadata');
    }
    if (!a.bone_template_orientation_matrices || !a.bone_orientation_blendshapes) {
      throw new Error('This browser export requires official cached bone orientation tensors');
    }
    if(facialMeta&&facialBuffer)this.attachFacial(facialMeta,facialBuffer);
  }

  attachFacial(meta,buffer) {
    if(meta.baseModelSha256!==this.meta.binary.sha256)throw new Error('Facial tensor base mismatch');
    const arrays={};for(const [key,spec]of Object.entries(meta.arrays)){const Type=DTYPES[spec.dtype];arrays[key]=new Type(buffer,spec.byteOffset,spec.byteLength/Type.BYTES_PER_ELEMENT);}
    this.facialSupplement={meta,arrays};this.facialActionLabels=meta.facial_action_labels;
  }

  coefficients(phenotypes = {}, localChanges = {}, facialActions = {}) {
    validateParameters(phenotypes, this.phenotypeLabels, 'phenotype');
    validateParameters(localChanges, this.localChangeLabels, 'local change');
    validateParameters(facialActions, this.facialActionLabels, 'facial action');
    const value = name => this.phenotypeLabels.includes(name) ? (phenotypes[name] ?? 0.5) : 0.5;
    const weights = {};
    for (const [name, labels] of Object.entries(this.variations)) {
      if (name === 'race') continue;
      const ws = interpolationWeights(value(name), this.anchors[name], !!this.metadata.extrapolate_phenotypes);
      labels.forEach((label, i) => { weights[label] = ws[i]; });
    }
    const races = this.variations.race.map(value), total = races.reduce((x, y) => x + y, 0);
    this.variations.race.forEach((label, i) => {
      const result = races[i] / total;
      weights[label] = Number.isFinite(result) ? result : 1 / 3;
    });
    const phens = Object.values(this.variations).flatMap(labels => labels.map(label => weights[label]));
    const mask = this.arrays.stacked_phenotype_blend_shapes_mask;
    const out = new Float64Array(this.shapeCount+(this.facialSupplement?this.facialActionLabels.length:0));
    for (let shape = 0; shape < this.phenotypeShapeCount; shape++) {
      let coefficient = 1;
      for (let j = 0; j < this.maskWidth; j++) {
        const m = mask[shape * this.maskWidth + j];
        coefficient *= phens[j] * m + (1 - m);
      }
      out[shape] = coefficient;
    }
    let offset = this.phenotypeShapeCount;
    for (const label of this.facialActionLabels) out[offset++] = facialActions[label] ?? 0;
    for (const label of this.localChangeLabels) {
      const v = localChanges[label] ?? 0;
      out[offset++] = Math.max(v, 0);
      out[offset++] = Math.max(-v, 0);
    }
    return out;
  }

  parsePose(pose = {}) {
    if (ArrayBuffer.isView(pose) || (Array.isArray(pose) && pose.length === this.boneCount * 16)) {
      if (pose.length !== this.boneCount * 16) throw new Error('Incorrect pose tensor size');
      return Array.from({ length: this.boneCount }, (_, i) => new Float64Array(pose.slice(i * 16, (i + 1) * 16)));
    }
    return this.boneLabels.map(label => {
      const value = pose[label];
      if (!value) return identity4();
      if (value.matrix) {
        if (value.matrix.length !== 16 || !Array.from(value.matrix).every(Number.isFinite)) throw new Error(`Invalid pose: ${label}`);
        return new Float64Array(value.matrix);
      }
      const rotation = value.rotation || value;
      if (rotation.length !== 3 || !Array.from(rotation).every(Number.isFinite)) throw new Error(`Invalid pose: ${label}`);
      if (value.translation && (value.translation.length !== 3 || !Array.from(value.translation).every(Number.isFinite))) throw new Error(`Invalid translation: ${label}`);
      return rotationVectorDegrees(Array.from(rotation), value.translation);
    });
  }

  forward({ phenotypes = {}, localChanges = {}, facialActions = {}, pose = {}, poseParameterization = this.metadata.pose_parameterization || 'local-ref' } = {}) {
    const a = this.arrays, J = this.boneCount;
    const coefficients = this.coefficients(phenotypes, localChanges, facialActions);
    let baseCoefficients=coefficients, faceCoefficients=null;
    if(this.facialSupplement){
      const n=this.facialActionLabels.length,p=this.phenotypeShapeCount;
      faceCoefficients=coefficients.subarray(p,p+n);baseCoefficients=new Float64Array(this.shapeCount);
      baseCoefficients.set(coefficients.subarray(0,p));baseCoefficients.set(coefficients.subarray(p+n),p);
    }
    const active = [];
    for (let i = 0; i < baseCoefficients.length; i++) if (baseCoefficients[i] !== 0) active.push(i);
    const restVertices = new Float64Array(a.template_vertices);
    const restBoneHeads = new Float64Array(a.template_bone_heads);
    const covariances = new Float64Array(a.bone_template_orientation_matrices);
    const offsets = a.blendshape_offsets, indices = a.blendshape_indices, values = a.blendshape_values;
    for (const shape of active) {
      const c = baseCoefficients[shape];
      if (offsets) {
        for (let k = offsets[shape]; k < offsets[shape + 1]; k++) restVertices[indices[k]] += c * values[k];
      } else {
        const base = shape * restVertices.length;
        for (let k = 0; k < restVertices.length; k++) restVertices[k] += c * a.blendshapes[base + k];
      }
      const headBase = shape * J * 3, orientationBase = shape * J * 9;
      for (let k = 0; k < J * 3; k++) restBoneHeads[k] += c * a.bone_heads_blendshapes[headBase + k];
      for (let k = 0; k < J * 9; k++) covariances[k] += c * a.bone_orientation_blendshapes[orientationBase + k];
    }
    if(this.facialSupplement){
      const f=this.facialSupplement.arrays;
      for(let shape=0;shape<faceCoefficients.length;shape++){
        const c=faceCoefficients[shape];if(c===0)continue;
        for(let k=f.blendshape_offsets[shape];k<f.blendshape_offsets[shape+1];k++)restVertices[f.blendshape_indices[k]]+=c*f.blendshape_values[k];
        for(let k=0;k<J*3;k++)restBoneHeads[k]+=c*f.bone_heads_blendshapes[shape*J*3+k];
        for(let k=0;k<J*9;k++)covariances[k]+=c*f.bone_orientation_blendshapes[shape*J*9+k];
      }
    }
    const rest = [], restInverse = [];
    for (let bone = 0; bone < J; bone++) {
      const rotation = this.metadata.root_identity_orientation && bone === 0
        ? new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
        : specialProcrustes(covariances.subarray(bone * 9, bone * 9 + 9));
      rest[bone] = rotationPose(rotation, restBoneHeads.subarray(bone * 3, bone * 3 + 3));
      restInverse[bone] = rigidInverse4(rest[bone]);
    }
    // This mirrors the official absolute-orientation FK, including its root
    // branch: the transform uses the pre-orientation-override root pose.
    const absoluteOrientations = (orientations, base = null) => {
      const poses = [], transforms = [];
      for (const bone of this.boneOrder) {
        const parent = this.boneParents[bone];
        const beforeOverride = parent < 0
          ? (base ? multiply4(base, rest[bone]) : rest[bone])
          : multiply4(transforms[parent], rest[bone]);
        poses[bone] = replaceOrientation(beforeOverride, orientations[bone]);
        transforms[bone] = multiply4(parent < 0 ? beforeOverride : poses[bone], restInverse[bone]);
      }
      return { poses, transforms };
    };
    const delta = this.parsePose(pose);
    let poses, transforms;
    if (poseParameterization === 'world') {
      poses = delta;
    } else if (poseParameterization === 'world-orient') {
      const orientation = delta.map(d => new Float64Array([d[0], d[1], d[2], d[4], d[5], d[6], d[8], d[9], d[10]]));
      const base = multiply4(delta[0], restInverse[0]);
      ({ poses, transforms } = absoluteOrientations(orientation, base));
    } else {
      let reference = rest;
      if (a.reference_bone_orientations) {
        const orientation = Array.from({ length: J }, (_, j) => a.reference_bone_orientations.subarray(j * 9, j * 9 + 9));
        reference = absoluteOrientations(orientation).poses;
      }
      if (!['local-ref', 'local-bone', 'local-bone-world'].includes(poseParameterization)) throw new Error(`Unsupported pose parameterization: ${poseParameterization}`);
      const referenceInverse = reference.map(rigidInverse4);
      const base = poseParameterization === 'local-bone-world' ? null : referenceInverse[0];
      const referenceTransforms = [];
      poses = [];
      for (const bone of this.boneOrder) {
        const parent = this.boneParents[bone];
        let d = delta[bone];
        if (poseParameterization === 'local-ref') {
          const orientation = reference[bone].slice();
          orientation[3] = orientation[7] = orientation[11] = 0;
          d = multiply4(multiply4(rigidInverse4(orientation), d), orientation);
        }
        const t = multiply4(reference[bone], d);
        poses[bone] = parent < 0 ? (base ? multiply4(base, t) : t) : multiply4(referenceTransforms[parent], t);
        referenceTransforms[bone] = multiply4(poses[bone], referenceInverse[bone]);
      }
    }
    if (!transforms) transforms = poses.map((p, i) => multiply4(p, restInverse[i]));
    const vertices64 = new Float64Array(restVertices.length);
    const blend = new Float64Array(12);
    for (let vertex = 0; vertex < this.vertexCount; vertex++) {
      const v = vertex * 3, x = restVertices[v], y = restVertices[v + 1], z = restVertices[v + 2];
      blend.fill(0);
      for (let slot = 0; slot < this.influences; slot++) {
        const index = vertex * this.influences + slot, weight = a.vertex_bone_weights[index];
        if (weight === 0) continue;
        const transform = transforms[a.vertex_bone_indices[index]];
        for (let k = 0; k < 12; k++) blend[k] += weight * transform[k];
      }
      vertices64[v] = blend[0] * x + blend[1] * y + blend[2] * z + blend[3];
      vertices64[v + 1] = blend[4] * x + blend[5] * y + blend[6] * z + blend[7];
      vertices64[v + 2] = blend[8] * x + blend[9] * y + blend[10] * z + blend[11];
    }
    const flatten = matrices => Float64Array.from(matrices.flatMap(matrix => Array.from(matrix)));
    const bonePoses = flatten(poses), restBonePoses = flatten(rest);
    const boneHeads = new Float64Array(J * 3);
    poses.forEach((p, i) => boneHeads.set([p[3], p[7], p[11]], i * 3));
    return {
      vertices: new Float32Array(vertices64), vertices64, restVertices,
      bonePoses, boneHeads, restBonePoses, restBoneHeads,
      boneTransforms: flatten(transforms), coefficients,
    };
  }

  compute(inputs) { return this.forward(inputs); }
}

export default AnnyModel;
