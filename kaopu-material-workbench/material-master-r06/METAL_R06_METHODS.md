# R06 metal surface: bounded independent iteration

## Scope and preserved contracts

This iteration changes only `metal-surface.mjs` and adds this method record. It does not change receiver geometry, scene lighting, camera, controls, assets, older revisions, or publication. The actual export remains `makeMetalMaterial(T, {family, variant, origin, state, jointOrigins = []})`; it is not renamed to an imagined `createMetalMaterial` API.

The original FH88 `mt_kh`, `mt_kn`, and `mt_kfb` function lines are byte-for-byte identical to R05. R06 adds independently written value-and-gradient helpers using the same cubic lattice interpolation. There are no teacher textures, copied scenes, extra libraries, or new external assets.

The reviewed R05 close images show nearly continuous bright borders around large paint losses and visually flat rust islands. That observation motivates this candidate; successful visual correction must still be established with the R06 browser renders.

## 1. Independent vertical and transverse scales

- Paint thickness is 0.140 mm vertically; surviving primer thickness is 0.055 mm.
- Transverse surviving-primer extent varies from 0.18 to 1.10 mm. A separate interrupted adhesion field determines where primer actually survives. It is not a mandatory rim around every exposed island.
- A dimensionless macro damage potential is converted to a first-order signed distance in metres using its analytic gradient projected onto the surface tangent plane. The warped-noise chain rule is included. A 0.65 per metre slope floor prevents instability near stationary points.
- Boundary irregularities have their own metre amplitudes: 1.20 mm and 0.32 mm peak-to-peak before their resolution attenuation.
- Physical region boundaries use a narrow antialias width of 0.55 times the conservative surface pixel footprint, with an 8 micrometre numerical minimum. These widths are not substituted for coating thickness.
- There is no mandatory bright bare-metal ring. Primer is a muted dielectric and can be absent; oxide can directly meet the intact coat.

The signed distance is a local linear approximation, not an exact distance transform. Close to a stationary point, very small feature, or two intersecting loss fronts, its numerical width can deviate from the intended width. The isotropic footprint estimate also cannot represent every elongated grazing-angle footprint exactly.

## 2. Shared corrosion causes and microstructure

The material uses actual receiver connection origins for a proximity field and downstream runoff field. The illustrative runoff has a 40 mm lateral characteristic width, a 550 mm downstream decay, and a smooth 12 mm source onset. These are visual spatial controls, not a solved or calibrated water-flow model.

Exposed-area depth, history, connection proximity, runoff, orientation, and local retention contribute to a corrosion dose. This same dose and its meso/micro retention structure drive:

1. Exposed steel versus dielectric oxide coverage.
2. Oxide maturity, compaction, and porosity.
3. Oxide colour, roughness, deposited height, and pitting.
4. The height-derived normal perturbation.

There is no independent RGB noise layer used solely to add coloured spots. Pits occur within exposure. Fine normal frequencies attenuate when their feature period falls below the screen footprint; unresolved oxide detail adds modest roughness rather than retaining a flickering high-frequency bump pattern.

Galvanized zinc remains a metallic phase. Zinc corrosion is a separate dielectric phase driven by retained moisture on the remaining zinc, rather than by the mathematical outline of the steel exposure. Underlying steel and iron oxide appear only where zinc has been lost.

## 3. Bounded Three r170 optical adaptation

The repository's current `ShaderChunk.lights_physical_fragment` was inspected directly. Its standard metalness workflow computes diffuse as `(1 - B) C` and normal-incidence specular colour as `0.04 (1 - B) + B C`. If `C` has already been assembled from different material coverages, these operations introduce cross terms between unrelated phases.

R06 supplies two additional `MetalSurface` values and overrides the corresponding `PhysicalMaterial` fields immediately after that shader chunk:

- `coverageDiffuse = sum(dielectric_phase_colour * dielectric_phase_coverage)`.
- `coverageF0 = steel_colour * bare_steel_coverage + zinc_colour * zinc_coverage + 0.04 * total_dielectric_coverage`.

The painted version omits zinc terms. This preserves pure-phase responses and avoids multiplying the already weighted diffuse by metal coverage a second time. The legacy metalness field remains available and is still the actual conductor-area coverage.

A 50% paint/steel example, with paint `[0.085, 0.12, 0.105]` and steel `[0.30, 0.32, 0.31]`, demonstrates the limited correction:

| Quantity | Previously mixed twice | Explicit coverage assembly |
| --- | --- | --- |
| Diffuse parameter | `[0.09625, 0.11, 0.10375]` | `[0.0425, 0.06, 0.0525]` |
| F0 parameter | `[0.11625, 0.13, 0.12375]` | `[0.17, 0.18, 0.175]` |

These are linear material parameters, not display RGB samples or measured reflectances.

This is not full multi-BSDF mixing, not OpenPBR conformance, and not BRDF equivalence to a reference renderer. All phases still share one interpolated roughness and one shading normal. Three's lighting, Schlick Fresnel, geometry roughness, and environment integration remain in use. Finite pixel boundaries therefore remain an approximation, now without the avoidable diffuse/F0 coverage cross multiplication.

Stain and wetness darken the dielectric diffuse contribution only. Bare-conductor F0 is not darkened by the wetness scalar. The wet control blends roughness toward 0.22, which remains an explicitly phenomenological approximation; it does not create a water film, change IOR, implement refraction, or conserve energy through a layered water BSDF.

## Checks actually completed

- JavaScript module syntax check passed.
- FH88 `mt_kh`, `mt_kn`, and `mt_kfb` line-preservation checks passed.
- 12,000 CPU double-precision value/gradient samples: maximum original-noise versus analytic-helper value error `5.55e-16`; maximum central-difference gradient error `2.38e-10`.
- 2,000 warped-field gradient samples: maximum central-difference error `7.04e-8`. The finite-difference step for this check was `1e-7` m. This checks the warped-noise chain rule, not the physical interpretation of corrosion.
- 100,000 synthetic normalized coverage combinations: nonnegative phase weights, unit weight sum (maximum error `2.22e-16`), and tested diffuse/F0/roughness parameter ranges. These are algebra tests, not a survey of scene pixels.
- Pure dielectric and pure conductor parameter equivalence checks passed for the explicit coverage assembly.
- Both actual injected sign and rack Three r170 vertex/fragment shader sources compiled and linked with clean logs using native Mesa EGL / ES 3. This is compile/link validation, not browser image acceptance; shadow and environment variants remain for parent browser QA.

The temporary reproducibility harnesses are `r06-metal-numeric.mjs` and `r06-metal-compile.mjs` in the execution environment's temporary directory. They are not required runtime assets or publication changes. Parent integration may preserve them in its own QA package.

## Remaining limits and acceptance

- Height is a shading field. It does not displace the silhouette or create geometry, flaking overhangs, shell thickness, or volume loss.
- Coating/rust dimensions, corrosion dose, colours, and roughness are authored parameters, not measured alloy/coating samples or calibrated exposure years. Steel and zinc F0 remain the prior artistic grey values.
- The 16-connection cap, local metric receiver assumptions, existing wetness control, and unused metal repair control are retained. Arbitrary nonuniform model scaling is not claimed as a supported material-calibration workflow.
- Macro chip distribution remains procedural. Stress, fastener abrasion, damaged-coating propagation, electrochemistry, and hydrology are not simulated.
- GPU runtime cost and actual appearance require browser measurement. Analytic gradients add arithmetic; no performance claim is made from successful compilation.
- Browser inspection must compare the sign and rack close views at the same lighting/exposure as R05, inspect several view angles, and check both normal and roughness diagnostics. A darker colour or a passing compiler is not sufficient evidence of a better material.
