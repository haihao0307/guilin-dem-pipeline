/**
 * Coordinate adapter for the retained native closed-yarn renderer.
 *
 * The input carrier is already the physical yarn-envelope mid-surface. The
 * original studio placed a yarn layer above a body-facing carrier; applying
 * that placement a second time would separate rendering from the solver.
 * build.py derives two explicitly audited modules from the pinned source:
 * yarn placement starts at zero, and seam route heights subtract the former
 * placement. Yarn shaders, tube profiles, materials and sampling stay native.
 * The same audited derivative releases a finished morph's previous atlas before
 * an otherwise unused deformation update. Active morphs keep both native atlases.
 */
export async function buildMidSurfaceSolid(native, packet, info, options = {}) {
  const {renderOffsetMeters, ...nativeOptions} = options;
  if (!['knit', 'denim'].includes(info?.family)) {
    throw new Error('The mid-surface adapter supports only the retained knit and denim materials.');
  }
  if (!Number.isFinite(renderOffsetMeters) || renderOffsetMeters < 0) {
    throw new Error('The original carrier placement must be supplied in metres.');
  }
  const [{layerLayout}, {buildContinuousSolid}] = await Promise.all([
    import('./upstream/material-settings.mjs'),
    import('./coordinate-adapter/continuous-solid.mjs'),
  ]);
  const expected = info.family === 'knit' ? layerLayout(info).outer * .001 :
    (info.geometry.thickness * .6 + .25) * .001;
  if (!Number.isFinite(expected) || Math.abs(expected - renderOffsetMeters) > 1e-10) {
    throw new Error('The recorded carrier placement does not match the retained source material.');
  }
  const solid = await buildContinuousSolid(native, packet, info, {
    ...nativeOptions, carrierOffsetMeters: renderOffsetMeters,
  });
  try {
    for (const chunk of solid.chunks) {
      if (chunk.uniforms.uOffset?.value !== 0) throw new Error('Native yarn placement was not reset to the physical mid-surface.');
      for (const record of [chunk.current, chunk.previous]) {
        if (record?.atlas && record.atlas.material.uniforms.uOffset !== chunk.uniforms.uOffset) {
          throw new Error('Native yarn atlas and direct material do not share their placement uniform.');
        }
      }
    }
    solid.stats.coordinateAdapter = {
      schema: 'physical-yarn-mid-surface@1',
      carrierCoordinates: 'physical-yarn-envelope-mid-surface',
      sourceCarrierOffsetMM: renderOffsetMeters * 1000,
      yarnPlacementOffsetMM: 0,
      seamRouteHeightAdjustmentMM: -renderOffsetMeters * 1000,
      cpuAndGPUSeamRoutesShareAdjustedSamples: true,
      originalYarnShaderUnchanged: true,
      originalYarnShapeUnchanged: true,
      originalMaterialUnchanged: true,
      originalContinuousSamplerUnchanged: true,
      physicalThicknessChanged: false,
    };
    // These describe the applied scheduling contract, not measured savings.
    solid.stats.renderSchedulingAdapter = {
      schema: 'expired-yarn-frame-atlas-order@1',
      expiredPreviousDisposedBeforeAtlasUpdate: true,
      activeMorphUpdatesBothAtlases: true,
      originalMorphDurationMS: 180,
      originalAtlasShaderUnchanged: true,
      originalSamplingDecisionsUnchanged: true,
    };
    return solid;
  } catch (error) {
    solid.dispose();
    throw error;
  }
}
