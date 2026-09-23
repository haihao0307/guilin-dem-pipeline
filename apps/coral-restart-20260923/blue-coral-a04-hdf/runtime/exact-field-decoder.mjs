import * as THREE from 'three';

const COMPONENT_ARRAY = Object.freeze({
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
});

const ATTRIBUTE_NAME = Object.freeze({
  POSITION: 'position',
  NORMAL: 'normal',
  TEXCOORD_0: 'uv',
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function fieldById(manifest, id) {
  const field = manifest.accessors[id];
  invariant(field && field.id === id, `Missing canonical field ${id}`);
  return field;
}

/**
 * Decodes a source accessor into a brand-new TypedArray and backing ArrayBuffer.
 * The candidate never aliases the teacher bytes or another candidate field.
 */
export function decodeField(manifest, payload, id) {
  const field = fieldById(manifest, id);
  const Ctor = COMPONENT_ARRAY[field.componentType];
  invariant(Ctor, `Unsupported component type ${field.componentType}`);
  invariant(payload instanceof ArrayBuffer, 'Canonical field payload must be an ArrayBuffer');
  const start = field.offset;
  const end = start + field.byteLength;
  invariant(start >= 0 && end <= payload.byteLength, `Field ${id} is outside payload bounds`);
  const independentBytes = payload.slice(start, end);
  const typed = new Ctor(independentBytes);
  invariant(
    typed.length === field.count * field.width,
    `Field ${id} element count mismatch: ${typed.length}`,
  );
  return typed;
}

function surfaceBindings(manifest, surfaceId) {
  const result = new Map();
  for (const field of manifest.accessors) {
    for (const binding of field.bindings || []) {
      if (binding.surface === surfaceId) result.set(binding.semantic, field.id);
    }
  }
  for (const required of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'INDICES']) {
    invariant(result.has(required), `Surface ${surfaceId} lacks ${required}`);
  }
  return result;
}

export function createNeutralMaterial(options = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: options.color ?? 0x7fa9b4,
    roughness: options.roughness ?? 0.82,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  material.name = 'Blue Coral A04 · neutral candidate material';
  material.userData = {
    role: 'neutral-shape-diagnostic',
    inheritsMuseumTexture: false,
    healthyLivingColorClaim: false,
  };
  return material;
}

/**
 * Reconstructs the candidate only from teacher-package + accessor manifest +
 * object graph + exact field bytes. It does not use GLTFLoader, clone(), the
 * teacher Object3D, or any teacher BufferGeometry.
 */
export function reconstructCandidate({
  packageJson,
  manifest,
  objectGraph,
  payload,
  material = createNeutralMaterial(),
}) {
  invariant(packageJson.schema === 'kaopu.canonical-coral-teacher/1.0', 'Wrong canonical package schema');
  invariant(packageJson.version === 'BLUE_CORAL_CANONICAL_A04', 'Wrong canonical package version');
  invariant(packageJson.stage === 'ONE_TO_ONE_HIGH_DIMENSIONAL_FIELD_EXPRESSION', 'Wrong A04 stage');
  invariant(manifest.schema === 'kaopu.coral-a04-accessor-manifest/1.0', 'Wrong field manifest schema');
  invariant(objectGraph.schema === 'kaopu.coral-a04-object-graph/1.0', 'Wrong object graph schema');
  invariant(manifest.accessors.length === 36, 'All 36 source accessors are required');
  invariant(manifest.surfaces.length === 9, 'All 9 source surfaces are required');
  invariant(payload.byteLength === packageJson.fields.payloadBytes, 'Field payload byte count mismatch');

  const decoded = new Map();
  const decode = (id) => {
    if (!decoded.has(id)) decoded.set(id, decodeField(manifest, payload, id));
    return decoded.get(id);
  };

  const nodes = objectGraph.nodes.map((node) => {
    const object = new THREE.Object3D();
    object.name = node.sourceName || `source-node-${node.id}`;
    object.userData = {
      sourceNodeId: node.id,
      sourceMeshId: node.meshId,
      candidateNode: true,
    };
    if (node.sourceMatrix) {
      object.matrixAutoUpdate = false;
      object.matrix.fromArray(node.sourceMatrix);
      object.matrix.decompose(object.position, object.quaternion, object.scale);
      object.updateMatrixWorld(true);
    }
    return object;
  });

  const candidateMeshes = [];
  const candidateGeometries = [];
  const attributeArrays = [];

  for (const surface of manifest.surfaces) {
    const bindings = surfaceBindings(manifest, surface.id);
    const geometry = new THREE.BufferGeometry();
    geometry.name = `Blue Coral A04 surface ${surface.id}`;

    for (const semantic of ['POSITION', 'NORMAL', 'TEXCOORD_0']) {
      const fieldId = bindings.get(semantic);
      const field = fieldById(manifest, fieldId);
      const array = decode(fieldId);
      geometry.setAttribute(
        ATTRIBUTE_NAME[semantic],
        new THREE.BufferAttribute(array, field.width, field.normalized),
      );
      attributeArrays.push(array);
    }

    const indexFieldId = bindings.get('INDICES');
    const indexArray = decode(indexFieldId);
    geometry.setIndex(new THREE.BufferAttribute(indexArray, 1, false));
    attributeArrays.push(indexArray);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.userData = {
      canonicalSurfaceId: surface.id,
      sourceMesh: surface.sourceMesh,
      sourcePrimitive: surface.sourcePrimitive,
      sourceNode: surface.sourceNode,
      vertexCount: surface.vertexCount,
      triangleCount: surface.triangleCount,
      positionField: surface.positionField,
      normalField: surface.normalField,
      uvField: surface.uvField,
      indexField: surface.indexField,
    };

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `A04 independent field surface ${surface.id}`;
    mesh.frustumCulled = false;
    mesh.userData = {
      role: 'one-to-one-high-dimensional-field-candidate',
      sourceCloneUsed: false,
      gltfLoaderUsedForCandidate: false,
      canonicalSurfaceId: surface.id,
    };

    const map = objectGraph.surfaceNodeMap.find((entry) => entry.surface === surface.id);
    invariant(map, `Surface ${surface.id} lacks a source node mapping`);
    nodes[map.node].add(mesh);
    candidateMeshes.push(mesh);
    candidateGeometries.push(geometry);
  }

  for (const node of objectGraph.nodes) {
    for (const childId of node.children || []) nodes[node.id].add(nodes[childId]);
  }

  const root = new THREE.Group();
  root.name = 'BLUE_CORAL_CANONICAL_A04_INDEPENDENT_CANDIDATE';
  for (const rootId of objectGraph.rootNodes) root.add(nodes[rootId]);
  root.updateMatrixWorld(true);

  const buffers = attributeArrays.map((array) => array.buffer);
  const uniqueBuffers = new Set(buffers);
  invariant(uniqueBuffers.size === buffers.length, 'Candidate accessors unexpectedly share backing buffers');
  invariant(new Set(candidateGeometries).size === candidateGeometries.length, 'Candidate surfaces share geometry objects');

  const totals = candidateGeometries.reduce(
    (sum, geometry) => {
      sum.vertices += geometry.getAttribute('position').count;
      sum.triangles += geometry.index.count / 3;
      return sum;
    },
    { vertices: 0, triangles: 0 },
  );
  invariant(totals.vertices === 582034, `Candidate vertex records changed: ${totals.vertices}`);
  invariant(totals.triangles === 1000000, `Candidate triangles changed: ${totals.triangles}`);

  const audit = Object.freeze({
    version: packageJson.version,
    stage: packageJson.stage,
    sourceCloneUsed: false,
    gltfLoaderUsedForCandidate: false,
    separateTypedArrays: true,
    separateArrayBuffers: true,
    separateGpuBuffers: true,
    allSourceAccessorsDecoded: decoded.size === 36,
    decodedAccessorCount: decoded.size,
    surfaceCount: candidateMeshes.length,
    vertexRecordCount: totals.vertices,
    triangleCount: totals.triangles,
    meshSimplification: false,
    decimation: false,
    remeshing: false,
    voxelization: false,
    marchingCubes: false,
    surfaceProjectionProxy: false,
    structureGrammarUnlocked: false,
    finalGenerator: false,
    productionReady: false,
  });

  return {
    root,
    nodes,
    meshes: candidateMeshes,
    geometries: candidateGeometries,
    arrays: attributeArrays,
    decoded,
    material,
    audit,
  };
}

export function setCandidateDiagnosticColor(candidate, color) {
  candidate.material.color.set(color);
  candidate.material.needsUpdate = true;
}

export function setCandidateRoughness(candidate, roughness) {
  candidate.material.roughness = THREE.MathUtils.clamp(roughness, 0, 1);
  candidate.material.needsUpdate = true;
}

export function verifyNoTeacherAliasing(candidate, teacherMeshes = []) {
  const teacherGeometries = new Set(teacherMeshes.map((mesh) => mesh.geometry));
  const teacherBuffers = new Set();
  for (const mesh of teacherMeshes) {
    const geometry = mesh.geometry;
    for (const name of Object.keys(geometry.attributes)) {
      teacherBuffers.add(geometry.attributes[name].array.buffer);
    }
    if (geometry.index) teacherBuffers.add(geometry.index.array.buffer);
  }
  return {
    geometryAliasCount: candidate.geometries.filter((geometry) => teacherGeometries.has(geometry)).length,
    bufferAliasCount: candidate.arrays.filter((array) => teacherBuffers.has(array.buffer)).length,
    passed:
      candidate.geometries.every((geometry) => !teacherGeometries.has(geometry)) &&
      candidate.arrays.every((array) => !teacherBuffers.has(array.buffer)),
  };
}
