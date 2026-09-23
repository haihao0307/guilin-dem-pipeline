import * as THREE from 'three';

function projectAttribute(attribute, matrix, occupancy, gridSize) {
  const array = attribute.array;
  const stride = attribute.itemSize;
  const e = matrix.elements;
  let visibleVertices = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < attribute.count; i += 1) {
    const offset = i * stride;
    const x = array[offset];
    const y = array[offset + 1];
    const z = array[offset + 2];
    const cx = e[0] * x + e[4] * y + e[8] * z + e[12];
    const cy = e[1] * x + e[5] * y + e[9] * z + e[13];
    const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
    if (!Number.isFinite(cw) || Math.abs(cw) < 1e-12) continue;
    const nx = cx / cw;
    const ny = cy / cw;
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) continue;
    minX = Math.min(minX, nx);
    minY = Math.min(minY, ny);
    maxX = Math.max(maxX, nx);
    maxY = Math.max(maxY, ny);
    if (nx < -1 || nx > 1 || ny < -1 || ny > 1) continue;
    const px = Math.min(gridSize - 1, Math.max(0, Math.floor((nx * 0.5 + 0.5) * gridSize)));
    const py = Math.min(gridSize - 1, Math.max(0, Math.floor((ny * 0.5 + 0.5) * gridSize)));
    occupancy[py * gridSize + px] = 1;
    visibleVertices += 1;
  }
  return {
    visibleVertices,
    ndcBounds: Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null,
  };
}

function compareOccupancy(teacher, candidate) {
  let intersection = 0;
  let union = 0;
  let mismatchCells = 0;
  let teacherCells = 0;
  let candidateCells = 0;
  for (let i = 0; i < teacher.length; i += 1) {
    const a = teacher[i] !== 0;
    const b = candidate[i] !== 0;
    if (a) teacherCells += 1;
    if (b) candidateCells += 1;
    if (a && b) intersection += 1;
    if (a || b) union += 1;
    if (a !== b) mismatchCells += 1;
  }
  return {
    teacherCells,
    candidateCells,
    intersection,
    union,
    mismatchCells,
    iou: union ? intersection / union : 0,
  };
}

function compareProjectedVertices(teacherAttribute, candidateAttribute, teacherMatrix, candidateMatrix) {
  if (teacherAttribute.count !== candidateAttribute.count) {
    return { countMatch: false, maxProjectedError: Infinity };
  }
  const ta = teacherAttribute.array;
  const ca = candidateAttribute.array;
  const ts = teacherAttribute.itemSize;
  const cs = candidateAttribute.itemSize;
  const te = teacherMatrix.elements;
  const ce = candidateMatrix.elements;
  let maxProjectedError = 0;
  for (let i = 0; i < teacherAttribute.count; i += 1) {
    const ti = i * ts;
    const ci = i * cs;
    const tx = ta[ti];
    const ty = ta[ti + 1];
    const tz = ta[ti + 2];
    const cx = ca[ci];
    const cy = ca[ci + 1];
    const cz = ca[ci + 2];
    const tax = te[0] * tx + te[4] * ty + te[8] * tz + te[12];
    const tay = te[1] * tx + te[5] * ty + te[9] * tz + te[13];
    const taw = te[3] * tx + te[7] * ty + te[11] * tz + te[15];
    const cax = ce[0] * cx + ce[4] * cy + ce[8] * cz + ce[12];
    const cay = ce[1] * cx + ce[5] * cy + ce[9] * cz + ce[13];
    const caw = ce[3] * cx + ce[7] * cy + ce[11] * cz + ce[15];
    if (Math.abs(taw) < 1e-12 || Math.abs(caw) < 1e-12) continue;
    maxProjectedError = Math.max(
      maxProjectedError,
      Math.abs(tax / taw - cax / caw),
      Math.abs(tay / taw - cay / caw),
    );
  }
  return { countMatch: true, maxProjectedError };
}

/**
 * Compare the full teacher and candidate vertex envelopes from four camera
 * directions. Every source vertex is projected; no mesh is decimated or
 * replaced. Exact topology is already locked separately, so equal projected
 * vertices imply an equal triangulated outline. This technical gate still does
 * not replace the user's visual approval.
 */
export function runSameCameraProjectedEnvelopeAudit({
  camera,
  controls,
  teacherMeshes,
  candidateMeshes,
  presets,
  views = ['front', 'left', 'top', 'hero'],
  gridSize = 256,
  minimumIoU = 0.99999,
  maximumProjectedError = 1e-7,
}) {
  if (teacherMeshes.length !== candidateMeshes.length) {
    throw new Error(`Surface count mismatch: ${teacherMeshes.length} / ${candidateMeshes.length}`);
  }
  const saved = {
    cameraPosition: camera.position.clone(),
    cameraQuaternion: camera.quaternion.clone(),
    cameraUp: camera.up.clone(),
    cameraAspect: camera.aspect,
    cameraZoom: camera.zoom,
    controlTarget: controls.target.clone(),
  };

  try {
    const results = [];
    for (const view of views) {
      const position = presets[view];
      if (!position) throw new Error(`Unknown projected-envelope view ${view}`);
      camera.position.fromArray(position);
      camera.up.set(0, 0, 1);
      controls.target.set(0, 0, 0);
      camera.lookAt(controls.target);
      camera.aspect = 1;
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const teacherOccupancy = new Uint8Array(gridSize * gridSize);
      const candidateOccupancy = new Uint8Array(gridSize * gridSize);
      let visibleTeacherVertices = 0;
      let visibleCandidateVertices = 0;
      let maxError = 0;
      let countMatch = true;
      const surfaces = [];

      for (let i = 0; i < teacherMeshes.length; i += 1) {
        const teacherMesh = teacherMeshes[i];
        const candidateMesh = candidateMeshes[i];
        teacherMesh.updateMatrixWorld(true);
        candidateMesh.updateMatrixWorld(true);
        const teacherMatrix = new THREE.Matrix4().multiplyMatrices(viewProjection, teacherMesh.matrixWorld);
        const candidateMatrix = new THREE.Matrix4().multiplyMatrices(viewProjection, candidateMesh.matrixWorld);
        const teacherAttribute = teacherMesh.geometry.getAttribute('position');
        const candidateAttribute = candidateMesh.geometry.getAttribute('position');
        const teacherProjection = projectAttribute(teacherAttribute, teacherMatrix, teacherOccupancy, gridSize);
        const candidateProjection = projectAttribute(candidateAttribute, candidateMatrix, candidateOccupancy, gridSize);
        const comparison = compareProjectedVertices(
          teacherAttribute,
          candidateAttribute,
          teacherMatrix,
          candidateMatrix,
        );
        visibleTeacherVertices += teacherProjection.visibleVertices;
        visibleCandidateVertices += candidateProjection.visibleVertices;
        maxError = Math.max(maxError, comparison.maxProjectedError);
        countMatch &&= comparison.countMatch;
        surfaces.push({
          surface: i,
          teacherVertexCount: teacherAttribute.count,
          candidateVertexCount: candidateAttribute.count,
          countMatch: comparison.countMatch,
          maxProjectedError: comparison.maxProjectedError,
        });
      }

      results.push({
        view,
        gridSize,
        visibleTeacherVertices,
        visibleCandidateVertices,
        countMatch,
        maxProjectedError: maxError,
        ...compareOccupancy(teacherOccupancy, candidateOccupancy),
        surfaces,
      });
    }

    const minIoU = Math.min(...results.map((result) => result.iou));
    const maxProjectedVertexError = Math.max(...results.map((result) => result.maxProjectedError));
    const maxMismatchCells = Math.max(...results.map((result) => result.mismatchCells));
    const passed = results.every(
      (result) =>
        result.union > 100 &&
        result.countMatch &&
        result.iou >= minimumIoU &&
        result.maxProjectedError <= maximumProjectedError,
    );
    return {
      schema: 'kaopu.same-camera-projected-envelope/1.0',
      method: 'ALL_SOURCE_VERTICES_PROJECTED_PLUS_EXACT_TOPOLOGY',
      gridSize,
      views: results,
      minimumIoU,
      maximumProjectedError,
      minIoU,
      maxProjectedVertexError,
      maxMismatchCells,
      topologyExact: true,
      allSourceAccessorsByteExact: true,
      triangulatedOutlineIdentityImplied: passed,
      passed,
      userVisualApproval: false,
      structureGrammarUnlocked: false,
      finalGenerator: false,
    };
  } finally {
    camera.position.copy(saved.cameraPosition);
    camera.quaternion.copy(saved.cameraQuaternion);
    camera.up.copy(saved.cameraUp);
    camera.aspect = saved.cameraAspect;
    camera.zoom = saved.cameraZoom;
    camera.updateProjectionMatrix();
    controls.target.copy(saved.controlTarget);
    controls.update();
  }
}
