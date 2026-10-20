/** Adapted only for multiple meshes and explicit disposal from the retained
 * MP05 r10 face-pass-routing.mjs. Keep native face diffusion, but do not shade
 * clothing in its two skin buffers. The current beauty depth remains the
 * visibility authority; no visible cloth/skin/yarn geometry is removed.
 *
 * Install AFTER the native HairPassCache wrapper. It then sits outside that
 * wrapper, while the cache's private hair bake/quad draws call its original.
 */
export function installFacePassRouting(viewer, {getMeshes = () => [viewer.mesh]} = {}) {
  const renderer = viewer.renderer, diffusion = viewer.faceDiffusion;
  if (!diffusion?.targets?.length) return null;
  const gl = renderer.getContext(), previousRender = renderer.render;
  const render = previousRender.bind(renderer), previousRouting = viewer.facePassRouting, channel = 31;
  const stats = {enabled: true, skinPasses: 0, depthCopies: 0, fallbackPasses: 0,
    lastSkinMeshes: 0, method: 'same-frame beauty depth + all native actor skin auxiliary passes',
    removedVisibleGeometry: false};
  let disposed = false;
  const forward = (scene, camera) => {
    const target = renderer.getRenderTarget(), targets = diffusion.targets;
    if (!stats.enabled || disposed || scene !== viewer.scene || (target !== targets[1] && target !== targets[2])) {
      return render(scene, camera);
    }
    const source = targets[0], sourceFB = renderer.properties.get(source).__webglFramebuffer;
    // Original r170 source/MSAA/format guards are deliberately unchanged.
    if (!sourceFB || Array.isArray(sourceFB) || !target.depthTexture || !source.depthTexture
        || source.depthTexture.type !== target.depthTexture.type
        || source.depthTexture.format !== target.depthTexture.format
        || source.resolveDepthBuffer === false || target.samples !== 0
        || source.width !== target.width || source.height !== target.height || gl.isContextLost()) {
      stats.fallbackPasses++; return render(scene, camera);
    }
    const meshes = [...new Set(getMeshes())].filter(mesh => mesh?.isMesh);
    if (!meshes.length) {stats.fallbackPasses++; return render(scene, camera);}
    const oldRead = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING), oldMask = camera.layers.mask;
    const meshMasks = meshes.map(mesh => [mesh, mesh.layers.mask]);
    const oldClear = renderer.autoClear, oldBackground = scene.background, lights = [];
    try {
      // r170 already resolved beauty MSAA depth into source.__webglFramebuffer.
      // Leave DRAW_FRAMEBUFFER at the auxiliary target selected by Three.
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFB);
      gl.blitFramebuffer(0, 0, source.width, source.height, 0, 0, target.width, target.height,
        gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, oldRead); stats.depthCopies++;
      scene.traverse(object => {if (object.isLight) {lights.push([object, object.layers.mask]); object.layers.enable(channel);}});
      for (const mesh of meshes) mesh.layers.enable(channel);
      camera.layers.set(channel);
      // Native diffusion cleared this target before entering renderer.render.
      // Another automatic clear would destroy the exact copied beauty depth.
      renderer.autoClear = false; scene.background = null;
      const result = render(scene, camera); stats.skinPasses++; stats.lastSkinMeshes = meshes.length;
      return result;
    } finally {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, oldRead);
      camera.layers.mask = oldMask;
      for (const [mesh, mask] of meshMasks) mesh.layers.mask = mask;
      for (const [light, mask] of lights) light.layers.mask = mask;
      renderer.autoClear = oldClear; scene.background = oldBackground;
    }
  };
  renderer.render = forward;
  const routing = {
    audit: () => ({...stats, disposed, occlusion: 'exact current beauty-pass depth',
      nativeFaceDiffusionPreserved: true, skinSelection: 'all actor.mesh; source brow/lash occlusion remains in beauty depth',
      wrapperOrder: 'face routing -> native HairPassCache -> native renderer'}),
    setEnabled(value) {stats.enabled = !!value; viewer.render();},
    dispose() {
      if (disposed) return;
      disposed = true;
      // Uninstall this outer wrapper before HairPassCache.dispose checks its
      // own renderer.render identity and restores its captured original.
      if (renderer.render === forward) renderer.render = previousRender;
      if (viewer.facePassRouting === routing) {
        if (previousRouting) viewer.facePassRouting = previousRouting; else delete viewer.facePassRouting;
      }
    },
  };
  viewer.facePassRouting = routing;
  return routing;
}
