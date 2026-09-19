import * as R54 from '../round-54/r045_round54_kernel.mjs';
export * from '../round-54/r045_round54_kernel.mjs';
export const VERSION='R045.55';
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

// R54 changed the actual vertical profile, but its first physical QA sampled that narrow transition with a 1.5 m half-span.
// The endpoints often landed on the same lower/upper levels in both versions, so a sharper riser could look numerically identical.
// R55 freezes R54 geometry and corrects the validation scale and browser evidence resolution instead of changing another parameter.
export const snapshot={...R54.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round55:{
 scope:'freeze the substantive R54 level-preserving profile geometry and replace its under-resolved profile test/visual mesh with feature-resolving physical evidence; no new terrain, footprint, water, parcel or amplitude change',
 method:'use the exact R54 surface. Define the local across-terrace direction from the gradient of inherited terrace coordinate q=base+phase. Measure the terrace-delta contribution with 0.30 m centered directional differences in shoulder and central-riser phase bands, while separately bounding the complete world surface and contour-tangent side effects. Increase fixed-view terrain sampling from about 9 m to about 3 m.',
 logicCorrection:'R54 exposed a sampling-scale fallacy: a 1.5 m centered difference can span an entire narrow transition, making old and sharpened profiles return the same integrated level change; a roughly 9 m visual mesh likewise cannot validate a metre-scale profile. R55 therefore freezes geometry and changes only measurement frame/resolution. Passing R55 can validate the R54 profile change but not hillside-scale terrace organization.',
 constraint:'the 0.30 m directional probe, ~3 m fixed-view mesh, R54 transition interval, inherited 6 m topology lattice and 12 m drainage hard core are synthetic QA/morphology scales, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM and photographs still cannot supply field microtopography, parcel/management boundaries, bund/riser/channel sections, inlet/outlet sill elevations, hydraulic connectivity, water head/depth/discharge/gate state or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: better-resolved geometry evidence does not establish management identity, parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state.',
 mrRolordUse:'the saved MrRolord study is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video is not available to replay in this run; Blender dimensions, Voronoi, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'the available terrace reference remains non-metric morphology evidence only: broad contour-following benches, concentrated riser edges, unequal widths, nested bends and drainage interruptions. No width, height, channel size or hydraulic parameter is inferred from it.',
 predecessorEvidence:'R54 first QA passed 21/23, preserved exact R47 footprint/stair frame/water graph and changed 70 samples with max 0.2786 m, but its 1.5 m cross-contour test reported shoulder ratio 1.0037 and riser ratio 1.0000. R55 treats that as under-resolved until feature-scale evidence proves otherwise.',
 evidenceClass:'same R54 synthetic profile geometry with feature-resolving directional and fixed-view evidence; not surveyed terrace/riser/parcel/hydraulic truth',
 forbiddenClaims:['surveyed terrace footprint','surveyed riser width','surveyed riser profile','measured bench width','measured bund section','measured channel section','known hydraulic connectivity','known water depth','known discharge','known gate state','regional truth from photograph']
}};
