# Landscape Mother / Relief and material knowledge R009

Research date: 2026-09-03.
Scope: karst only. Other landforms stay paused. This is a research handoff, not a runtime release.

## Status and protection

The requested article, linked primary guide, relevant official function references, renderer documentation and the user's PBR guide were reviewed. The source example was not executed and its live demo was not performance-tested. No new visual, browser or device acceptance is claimed. No online file, source asset, protected seven-file core, regional truth, workflow, Pages setting or existing handoff was changed by this research commit.

Source contracts are specified; production implementation remains pending. visualApproved=false; productionReady=false. No images, external models, textures, presets or external source code are imported or redistributed.

## Source evidence

S01: https://www.ownkng.dev/thoughts/three-js-yuelongxueshan
S02: https://www.rayshader.com/reference/calculate_normal.html
S03: https://www.rayshader.com/reference/ray_shade.html
S04: https://www.rayshader.com/reference/ambient_shade.html
S05: https://www.rayshader.com/reference/sphere_shade.html
S06: https://www.rayshader.com/reference/create_texture.html
S07: https://www.rayshader.com/reference/add_shadow.html
S08: https://www.rayshader.com/reference/plot_3d.html
S09: https://threejs.org/docs/pages/MeshStandardMaterial.html
S10: https://threejs.org/manual/en/color-management.html
S11: https://r3f.docs.pmnd.rs/advanced/scaling-performance
S12: https://r3f.docs.pmnd.rs/advanced/pitfalls
S13: User-supplied The PBR Guide, third edition February 2018, especially pages 38-40, 48, 51, 59-60, 69, 74, 76-78.
S14: gh-pages/landscape-mother-v008/index.html, Git blob bcce3e5453f81cd7b3e818c7b47bcd725a698533, read through the GitHub connector.
S15: Root AGENTS and landscape-mother/AGENTS.md, SKILL.md, platform.json. Existing core stays unchanged.
S16: https://www.tylermw.com/posts/data_visualization/a-step-by-step-guide-to-making-3d-maps-with-satellite-imagery-in-r.html

S11 and S12 were read from official search-indexed text. Direct S11 retrieval exceeded tool size limits. The local network could not retrieve an additional raw copy of S14; no downloaded-byte checksum is claimed. S14's identity is from the connector response.

## What the requested article supports

S01, published 2021-01-07, combines cropped elevation, terrain shading and satellite imagery, exports OBJ then GLB, and separates scene controls from model presentation. The author explicitly says the web lighting is less realistic than the upstream result. The untextured demonstration uses a brown color and metalness=0.7. The article does not supply karst formation, carbonate dissolution, microscopic rock materials or verified mobile performance.

## Function knowledge extracted from official documentation

calculate_normal describes per-point unit normals and reuse through a normal cache [S02]. Its Value section contradictorily says light-intensity matrix. Preserve this discrepancy; exact package return structure has not been executed or verified.

ray_shade evaluates surface intersections toward light directions. Its default lambert=TRUE additionally applies the incidence-angle term. For a downstream BRDF, extract visibility separately to avoid multiplying Lambert shading twice. Direction, angular extent, metric scale, search extent and cache validity are separate inputs [S03].

ambient_shade evaluates multiple directions and search distances, with cache support. Treat its output as diffuse-sky accessibility, separate from direct-light visibility [S04].

sphere_shade is normal-dependent hemispherical color mapping, not measured mineral albedo. create_texture uses five directional colors: highlight, opposite-facing slope, left fill, right fill and flat surface. Learn directional illumination structure without generating or sampling the resulting texture. The sphere_shade prose has a colorintensity/zscale ambiguity; do not invent undocumented formulas [S05-S06].

add_shadow combines shading arrays with a configurable darkening floor. Its cartographic image composition is not adopted as a complete PBR equation [S07].

plot_3d separates height, shading and camera. zscale is the horizontal-spacing to vertical-unit ratio; decreasing it exaggerates relief. Our contract uses explicit metric coordinates. solid=FALSE displays a surface and cannot certify a closed rock body [S08].

## Independent Landscape Mother contract

These formulas and stage boundaries are our own engineering specification, not a recovered implementation of the source library.

1. metric_surface_domain(sourceIdentity, bounds, dx, dz, datum, validity) -> validatedDomain. Units must be explicit; truth stays read-only; missing data remains marked. Unequal horizontal spacing is supported.
2. macro_surface_normal(validatedDomain, geometry) -> unitNormal. For y-up heightfields, N=normalize(-dH/dx,1,-dH/dz). Use actual solid geometry for caves and overhangs.
3. material_state(lithology, flowHistory, wetnessHistory, fractureState, biologicalState, processSeed) -> materialState + provenance. Missing solver histories cannot silently become measured hydrology.
4. material_reflectance(materialState, worldPosition) -> baseColorLinear, roughness, dielectricF0, microHeight. Base color contains no large-scale illumination. Limestone metalness is zero. F0=0.04 is an explicitly assumed common-dielectric default, not a measured limestone value.
5. micro_surface_normal(unitNormal, microHeight, physicalScale) -> shadingNormal. Micro-relief must not modify the macro silhouette or create fake visible holes.
6. sun_visibility(geometry, position, sunDirection, sourceAngle, boundaryPolicy) -> visibility + validity. No embedded Lambert term.
7. sky_accessibility(geometry, position, normal, sampleDirections, boundaryPolicy) -> diffuse accessibility + validity.
8. direct_indirect_composition(material, shadingNormal, view, visibility, accessibility, lights) -> linear radiance. Apply incidence once. Keep ambient diffuse occlusion separate from direct lighting; any future specular-visibility model must be explicit.
9. display_transfer(linearRadiance, exposure, toneMapper, colorSpace) -> displayRGB. Exactly one final display conversion.
10. invalidation_graph(geometryRevision, materialRevision, lights, camera, display) -> dirty stages. Camera changes preserve geometry, materials and geometric visibility caches; sun changes invalidate sun visibility; material changes preserve geometry.
11. mobile_inspection(scene, viewport, touchPointers, dirtyStages) -> camera and render requests. Default static view, genuine two-pointer zoom, safe areas, explicit errors and on-demand rendering. No device-dependent geometry reduction.

The independent light-composition design is:

Ldirect = sum(BRDF * incidentRadiance * sunVisibility * max(dot(N,L),0))
LambientDiffuse = diffuseSkyResponse * skyAccessibility
Llinear = Ldirect + LambientDiffuse + separatelyModelledIndirectTerms
Ldisplay = displayTransfer(toneMap(exposure * Llinear))

Changing the light must not repaint mineral or biological albedo. Changing the camera must not regenerate rock. Normal-dependent directional coloring belongs to illumination, not to geological pigment. Our material channels share causal history while retaining independent scale and response functions [S09-S10,S13].

## Current V008 source audit

SOURCE_READ_ONLY, not a new rendering or device test.

The runtime uses an 81 by 81 heightfield with authoring width 26 m and depth 21 m. Horizontal sample spacing is 0.325 m and 0.2625 m. CPU code assigns colors through threshold conditions. The fragment shader interpolates those colors; it has no independent fine-scale geological color or micro-normal evaluator. Roughness changes from 0.82 to 0.54 as a function of height [S14].

The variable flow is derived from slope and fbm; age is also a noise proxy. These are not calculated flow accumulation or geological age. Prior descriptions of them as physical process outputs must not be reused [S14].

The shader contains normal-dot-light and GGX-style expressions but no terrain-occluder visibility test or stored visibility field. Color is decoded from sRGB after interpolation; future vertex attributes must be linear before interpolation, or color must be evaluated per fragment [S14,S10].

The mobile hint mentions two-finger zoom, but current handlers track one drag state and wheel zoom only. No two-pointer distance calculation is present. Buttons are 33 CSS px high and some labels are 8 or 9 px [S14].

These limitations plausibly contribute to painted or chocolate-like surfaces and difficult close inspection. They do not prove one exclusive visual cause.

## Karst and waveform boundary

The terrain remains a time-indexed state of initial body, structure, environment, process history, material and optical response. Wave functions represent declared variations and drivers; they do not replace reaction chemistry, material supply, water pathways or conservation rules. The article contributes display architecture. It does not supply the missing karst-process solver.

Maintain a solid kernel for cavities, arches, overhangs and closed detached rocks. A heightfield may serve a regional surface or an analytic fixture; it cannot silently replace the requested solid karst object. Keep fixed geometry, zero LOD and zero texture sampling. Use arrays, attributes, buffers and procedural evaluation. No distant mountains, fog, new scenery or other landforms.

## Acceptance plan

Use one small karst specimen with a fixed comparison camera. Implement separate albedo, macro-normal, micro-normal, direct-shadow, diffuse-accessibility and final-lighting diagnostics. Preserve geometry hashes across lighting/material display changes. Test analytical planes with unequal dx/dz, ridge occlusion, cavity accessibility, single Lambert application and single color encoding.

For mobile: test real two-finger gestures, safe-area layout, failure messages and a public HTTPS entry. A 44 CSS px control target is a proposed project UI criterion, not a claimed test result. Actual iPhone testing and visual acceptance remain pending. Source demo performance is unknown.

## Local research artifacts and validation

Complete local files produced in this task:

RELIEF_LIGHTING_DISTILLATION_R009.md
SHA256 9ba9b36a31068f29448cd06ea007d746ac2762aefe1eaad5e454b704b625f94c

FUNCTION_CONTRACT_R009.json
SHA256 23fd753992ea33cf671753a5cd576b8607eaddc50948eecae96b33b6d692be23

CURRENT_RUNTIME_AUDIT_R009.json
SHA256 df29d9d01e423b748a7c015f53908145de7b383de8b342c3129ab7bfcc3ad0c6

RESEARCH_VALIDATION_R009.json
SHA256 934bd2e374d4252af8c21e2d58e13853281a662ebdf8e4cf7d49a902f7697231

Local JSON validation confirmed 11 unique function identifiers, valid source references, valid dependencies and an acyclic graph. Independent scalar calculations checked an sRGB round trip. Linear interpolation of black and white encodes to 0.735356983; decoding an already-interpolated sRGB midpoint gives 0.214041140. These are analytic sanity checks only, not renderer, geometry, browser, visual or performance tests.
