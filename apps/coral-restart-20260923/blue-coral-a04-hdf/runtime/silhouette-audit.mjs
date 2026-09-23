import * as THREE from 'three';

function maskStats(a, b) {
  let intersection = 0;
  let union = 0;
  let mismatchPixels = 0;
  let teacherPixels = 0;
  let candidatePixels = 0;
  for (let i = 0; i < a.length; i += 4) {
    const teacher = a[i] > 24 || a[i + 1] > 24 || a[i + 2] > 24;
    const candidate = b[i] > 24 || b[i + 1] > 24 || b[i + 2] > 24;
    if (teacher) teacherPixels += 1;
    if (candidate) candidatePixels += 1;
    if (teacher && candidate) intersection += 1;
    if (teacher || candidate) union += 1;
    if (teacher !== candidate) mismatchPixels += 1;
  }
  return {
    teacherPixels,
    candidatePixels,
    intersection,
    union,
    mismatchPixels,
    iou: union ? intersection / union : 0,
  };
}

/**
 * Render teacher and canonical-field candidate as binary silhouettes with the
 * exact same camera. This is a visual QA gate only; it does not approve coral
 * biology, unlock structure grammar, or replace user review.
 */
export function runSameCameraSilhouetteAudit({
  renderer,
  camera,
  controls,
  teacherScene,
  candidateScene,
  teacherMeshes,
  candidateMeshes,
  presets,
  views = ['front', 'left', 'top', 'hero'],
  size = 256,
  minimumIoU = 0.99999,
}) {
  const saved = {
    renderTarget: renderer.getRenderTarget(),
    viewport: renderer.getViewport(new THREE.Vector4()).clone(),
    scissor: renderer.getScissor(new THREE.Vector4()).clone(),
    scissorTest: renderer.getScissorTest(),
    clearColor: renderer.getClearColor(new THREE.Color()).clone(),
    clearAlpha: renderer.getClearAlpha(),
    autoClear: renderer.autoClear,
    teacherBackground: teacherScene.background,
    candidateBackground: candidateScene.background,
    cameraPosition: camera.position.clone(),
    cameraQuaternion: camera.quaternion.clone(),
    cameraUp: camera.up.clone(),
    cameraAspect: camera.aspect,
    cameraZoom: camera.zoom,
    controlTarget: controls.target.clone(),
    teacher: teacherMeshes.map((mesh) => ({
      mesh,
      material: mesh.material,
      visible: mesh.visible,
    })),
    candidate: candidateMeshes.map((mesh) => ({
      mesh,
      material: mesh.material,
      visible: mesh.visible,
    })),
  };

  const target = new THREE.WebGLRenderTarget(size, size, {
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.texture.generateMipmaps = false;
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const teacherPixels = new Uint8Array(size * size * 4);
  const candidatePixels = new Uint8Array(size * size * 4);
  const black = new THREE.Color(0x000000);

  function renderMask(scene, pixels) {
    renderer.setRenderTarget(target);
    renderer.setViewport(0, 0, size, size);
    renderer.setScissor(0, 0, size, size);
    renderer.setScissorTest(false);
    renderer.autoClear = true;
    renderer.setClearColor(black, 1);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
  }

  try {
    teacherScene.background = black;
    candidateScene.background = black;
    for (const item of saved.teacher) {
      item.mesh.material = material;
      item.mesh.visible = true;
    }
    for (const item of saved.candidate) {
      item.mesh.material = material;
      item.mesh.visible = true;
    }

    camera.up.set(0, 0, 1);
    camera.aspect = 1;
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);

    const results = [];
    for (const view of views) {
      const position = presets[view];
      if (!position) throw new Error(`Unknown silhouette view ${view}`);
      camera.position.fromArray(position);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld(true);
      renderMask(teacherScene, teacherPixels);
      renderMask(candidateScene, candidatePixels);
      results.push({ view, ...maskStats(teacherPixels, candidatePixels) });
    }

    const minIoU = Math.min(...results.map((result) => result.iou));
    const maxMismatchPixels = Math.max(...results.map((result) => result.mismatchPixels));
    return {
      schema: 'kaopu.same-camera-silhouette/1.0',
      size,
      views: results,
      minimumIoU,
      minIoU,
      maxMismatchPixels,
      passed: results.every((result) => result.union > 100 && result.iou >= minimumIoU),
      userVisualApproval: false,
      structureGrammarUnlocked: false,
      finalGenerator: false,
    };
  } finally {
    for (const item of saved.teacher) {
      item.mesh.material = item.material;
      item.mesh.visible = item.visible;
    }
    for (const item of saved.candidate) {
      item.mesh.material = item.material;
      item.mesh.visible = item.visible;
    }
    teacherScene.background = saved.teacherBackground;
    candidateScene.background = saved.candidateBackground;
    camera.position.copy(saved.cameraPosition);
    camera.quaternion.copy(saved.cameraQuaternion);
    camera.up.copy(saved.cameraUp);
    camera.aspect = saved.cameraAspect;
    camera.zoom = saved.cameraZoom;
    camera.updateProjectionMatrix();
    controls.target.copy(saved.controlTarget);
    controls.update();
    renderer.setRenderTarget(saved.renderTarget);
    renderer.setViewport(saved.viewport);
    renderer.setScissor(saved.scissor);
    renderer.setScissorTest(saved.scissorTest);
    renderer.setClearColor(saved.clearColor, saved.clearAlpha);
    renderer.autoClear = saved.autoClear;
    target.dispose();
    material.dispose();
  }
}
