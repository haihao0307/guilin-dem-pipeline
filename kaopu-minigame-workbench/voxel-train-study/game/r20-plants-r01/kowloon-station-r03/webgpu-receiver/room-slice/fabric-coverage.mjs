/**
 * Original MP02-S1 raw-denim inputs plus NEW projected area-quadrature bridge.
 * Core source is unchanged. No renderer, geometry, noise or appearance map.
 *
 * Source commit: 23c34ca5699e388d2b9ab2502fb91480e6628b5c.
 * Receives the already existing host clothNative() implicit approximation.
 * Thus the integral is NOT evidence of equivalence to exact parametric yarns.
 * Only use for an explicitly labelled unresolved-material LOD. Near-field
 * geometry, micro normals, shadows and pores remain the original-yarn receiver.
 *
 * Returned coverage is separate from conditional average albedo. Do not use
 * coverage/albedo to add white pixels. A physical coverage composite needs the
 * background radiance; treating the mean as an opaque macro-sheet is instead a
 * declared homogenization approximation. Unresolved columns are diagnostic
 * failures, not pores. 32x128 worst-case source calls per final shaded pixel:
 * shade-only, never invoke this integral within sceneField / ray-march steps.
 *
 * A +/-Z projected footprint is not the full grazing-angle visibility integral.
 * Start transition based on actual chart-space pixel footprint, not distance.
 * Original near field should remain visible in inspection close-ups.
 * WGSL compilation and GPU timing have NOT been run for this new module.
 */
export const RAW_DENIM_INPUTS = Object.freeze({
  sourceCommit: '23c34ca5699e388d2b9ab2502fb91480e6628b5c',
  sourcePreset: 'denim-raw',
  pitchMM: .42, weftPitchMM: .64, thicknessMM: .70,
  weave: 0, slub: .25, offsetMM: .67, cotton: .78, plain: 0,
  dyeSRGB: '#163553', weftDyeSRGB: '#b8b4a5',
  dyeLinear: Object.freeze([.008023192985384994,.03560131487502034,.08650046203654976]),
  weftDyeLinear: Object.freeze([.4793201831008268,.45641102318040466,.3762621229909065]),
  roughness: .95,
  offsetNote: 'offsetMM=0 is only a host recentering of the whole yarn layer; preserve relative yarn positions',
});
export const KP_FABRIC_COVERAGE_WGSL = "// New deterministic area-quadrature receiver for unresolved source yarns.\n// Requires existing clothParams(), clothNative(), ClothSample and KpWovenParams.\n// No new appearance noise, texture, yarn field, silhouette or renderer.\n// This integrates the HOST implicit receiver, whose closest-section approximation\n// still requires validation against the original parametric MP02 yarn surface.\n\nstruct KpFabricColumnSample {\n  hit: f32,\n  unresolved: f32,\n  albedo: vec3<f32>,\n  roughness: f32,\n}\nstruct KpFabricCoverageSample {\n  coverage: f32,\n  unresolvedFraction: f32,\n  albedo: vec3<f32>,\n  roughness: f32,\n}\n\n// Conservative source-derived local-Z bounds for a FLAT chart. For this source\n// B.z=0 and abs(W.z)<=1. Slub and cotton must remain in their original [0,1] range.\n// The zero/0.67 mm offset choice is inherited from the host clothParams().\nfn kpFabricFlatZBounds() -> vec2<f32> {\n  let p = clothParams(0.0);\n  let packMax = 1.0 + mix(0.085, 0.040, p.cotton);\n  let centreMaxMM = p.thicknessMM * 0.265 + 0.023 * p.slub;\n  let radiusMaxMM = p.thicknessMM * 0.235 * (1.0 + p.slub * 0.14 * 0.5) * packMax;\n  let halfMM = centreMaxMM + radiusMaxMM;\n  let weftBiasMM = p.thicknessMM * 0.235 * 0.18;\n  return vec2<f32>(p.offsetMM - halfMM - weftBiasMM, p.offsetMM + halfMM) * 0.001;\n}\n\n// Projected +/-Z first-visible-yarn query. It is not a general camera-ray\n// integral or guaranteed conservative tracing of the approximate host field.\n// No-hit and iteration exhaustion are distinct; never silently count exhaustion\n// as a transparent pore or an accepted fabric render.\nfn kpFabricCoverageColumn(uvM: vec2<f32>, viewSide: f32) -> KpFabricColumnSample {\n  let bounds = kpFabricFlatZBounds();\n  let positiveSide = viewSide >= 0.0;\n  let startZ = select(bounds.x - 0.000006, bounds.y + 0.000006, positiveSide);\n  let direction = select(1.0, -1.0, positiveSide);\n  let lengthM = bounds.y - bounds.x + 0.000012;\n  var t = 0.0;\n  var previousT = 0.0;\n  for (var step = 0; step < 128; step++) {\n    let q = vec3<f32>(uvM, startZ + direction * t);\n    let f = clothNative(q);\n    if (f.d <= 0.000002) {\n      var a = previousT;\n      var b = t;\n      var resolvedT = t;\n      if (f.d < 0.0) {\n        for (var refine = 0; refine < 8; refine++) {\n          let mid = (a + b) * 0.5;\n          let test = clothNative(vec3<f32>(uvM, startZ + direction * mid));\n          if (test.d > 0.0) { a = mid; } else { b = mid; }\n        }\n        resolvedT = (a + b) * 0.5;\n      }\n      let hit = clothNative(vec3<f32>(uvM, startZ + direction * resolvedT));\n      return KpFabricColumnSample(1.0, 0.0, hit.albedo, hit.roughness);\n    }\n    previousT = t;\n    t += clamp(abs(f.d) * 0.35, 0.000006, 0.00006);\n    if (t > lengthM) {\n      return KpFabricColumnSample(0.0, 0.0, vec3<f32>(0.0), 0.95);\n    }\n  }\n  return KpFabricColumnSample(0.0, 1.0, vec3<f32>(0.0), 0.95);\n}\n\n// Exact base-2 radical inverse for the 32 fixed integration samples.\n// This is quadrature placement, not added material noise.\nfn kpFabricQuadratureV(index: u32) -> f32 {\n  var value = index;\n  var weight = 0.5;\n  var result = 0.0;\n  for (var bit = 0u; bit < 5u; bit++) {\n    result += f32(value & 1u) * weight;\n    value >>= 1u;\n    weight *= 0.5;\n  }\n  return result + 1.0 / 64.0;\n}\n\n// Box-footprint projected-area estimate: 32 equal-weight source column samples.\n// Derive footprintM from the actual pixel footprint in the local cloth chart.\n// A single scalar isotropic footprint is a declared host approximation.\n// All colours are averaged in LINEAR space; return albedo conditional on a yarn hit.\n// coverage is separately returned and must not be misrepresented as exactly 1.\n// The renderer may use this as an explicitly authored unresolved-macro-surface\n// material LOD; that homogenization is not the original microgeometry itself.\nfn kpFabricCoverage(uvM: vec2<f32>, footprintM: f32, viewSide: f32) -> KpFabricCoverageSample {\n  var hitSum = 0.0;\n  var unresolvedSum = 0.0;\n  var colourSum = vec3<f32>(0.0);\n  var roughSum = 0.0;\n  for (var i = 0u; i < 32u; i++) {\n    let sampleXY = vec2<f32>((f32(i) + 0.5) / 32.0, kpFabricQuadratureV(i));\n    let point = uvM + (sampleXY - vec2<f32>(0.5)) * max(footprintM, 0.0);\n    let sample = kpFabricCoverageColumn(point, viewSide);\n    hitSum += sample.hit;\n    unresolvedSum += sample.unresolved;\n    colourSum += sample.albedo * sample.hit;\n    roughSum += sample.roughness * sample.hit;\n  }\n  let count = max(hitSum, 1.0);\n  return KpFabricCoverageSample(hitSum/32.0, unresolvedSum/32.0, colourSum/count, roughSum/count);\n}\n";
