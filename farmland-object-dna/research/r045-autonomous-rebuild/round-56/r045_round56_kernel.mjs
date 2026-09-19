import * as R54 from '../round-54/r045_round54_kernel.mjs';
export * from '../round-54/r045_round54_kernel.mjs';
export const VERSION='R045.56';
export const terraceStateAt=R54.terraceStateAt;
export const terraceGroupMask=R54.terraceGroupMask;
export const terraceFrameAt=R54.terraceFrameAt;
export const terraceDelta=R54.terraceDelta;
export const height=R54.height;
export const gradient=R54.gradient;
export const slope=R54.slope;
export const curvature=R54.curvature;
export const terracePermission=R54.terracePermission;
export const suitability=R54.suitability;

// R55 exposed a validation fallacy rather than a geometry failure. A flatter physical bench can require a
// LARGER terrace-delta derivative when that derivative cancels the inherited macro-slope derivative. Requiring
// |d(delta)/dn| itself to decrease confuses one additive term with the slope of the composed world surface.
// R56 freezes the exact R54 surface and accepts/rejects the bench on |d(height)/dn|, while riser concentration
// remains measured on the isolated terrace contribution because the inherited R30 base is unchanged.
export const snapshot={...R54.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round56:{
 scope:'freeze exact R54 geometry and replace the invalid R55 shoulder-delta gate with a composition-aware physical bench/riser gate; add a cheap fixed-camera surface plus sub-metre cross-section evidence inset',
 method:'use the exact R54 surface. Across inherited strong R47 support, measure bench shoulders on the complete world height along the local terrace-coordinate normal; measure central riser concentration on terraceDelta with the same 0.30 m probe; bound tangent side effects and all drainage/receiver locks. The browser keeps a coarse whole-slope fixed view and adds high-resolution local normal profiles instead of evaluating the whole hillside at ~3 m.',
 logicCorrection:'R55 failed one gate because it required the magnitude of the terrace correction derivative to shrink on a bench. That is a composition fallacy: height=R30 base+terrace delta, so flattening an inherited slope can require a larger opposing delta derivative. R55 itself measured the composed shoulder slope falling to about 28% of R47 while the riser delta rose about 55%. R56 therefore gates the physical bench on the composed world derivative, not on one additive term in isolation.',
 constraint:'the 0.30 m directional probe, 6 m whole-slope audit lattice, local profile inset, R54 transition interval and inherited 12 m drainage hard core are synthetic QA/morphology scales, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM and photographs cannot supply field microtopography, parcel/management boundaries, bund/riser/channel sections, inlet/outlet sill elevations, hydraulic connectivity, water head/depth/discharge/gate state or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric continuity and a flatter composed bench do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state.',
 mrRolordUse:'the saved MrRolord study is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video is not available to replay in this run; Blender dimensions, Voronoi, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png is used only as non-metric morphology evidence: contour-following benches, concentrated darker riser edges, unequal widths, nested bends and drainage interruptions. No width, height, channel size or hydraulic parameter is inferred from it.',
 predecessorEvidence:'R55 persisted 20/21 gates. Its only failure was terrace-delta shoulder magnitude 1.4896x R47, while the physically composed world shoulder slope was 0.2819x R47 and central-riser terrace contribution was 1.5549x. This is evidence that the failed gate measured the wrong causal quantity.',
 evidenceClass:'exact R54 synthetic geometry with composition-aware physical profile evidence; not surveyed terrace/riser/parcel/hydraulic truth',
 forbiddenClaims:['surveyed terrace footprint','surveyed riser width','surveyed riser profile','measured bench width','measured bund section','measured channel section','known hydraulic connectivity','known water depth','known discharge','known gate state','regional truth from photograph']
}};
