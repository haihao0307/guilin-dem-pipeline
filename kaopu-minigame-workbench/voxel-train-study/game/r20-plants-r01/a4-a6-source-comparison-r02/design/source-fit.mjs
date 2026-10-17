/** R02 maps only the NEW design vertices. Original A4 buffers and transforms stay intact.
 * Source coordinates are not a metre calibration. Crown matching uses a geometric
 * wheel-mesh-bottom reference, not a certified running/rail plane.
 */
export const SOURCE_FIT=Object.freeze({
 units:'UNCHANGED_SOURCE_UNITS_UNCALIBRATED',axes:'X transverse; Y up; Z forward',
 transverseScale:1.4366/1.475,verticalOffset:.4228,
 locoEndSourceZ:-3.1418,tenderStartSourceZ:-3.3325,tenderEndSourceZ:-10.9776,
 locoAuthoringEnd:20.10,tenderAuthoringStart:20.32,tenderAuthoringEnd:28.30,
 locoLongitudinalScale:.92,
 driverPreciseVertexBounds:[{node:90,z:[4.9899,7.1258],y:[.4228,2.5583]},{node:94,z:[2.7691,4.9050],y:[.4308,2.5663]},{node:7,z:[.5482,2.6841],y:[.4389,2.5744]}],
 warning:'Source bounds are uncalibrated. Do not read these units as metres. A6 is an exterior study on the original three-axle A4, not a rebuilt four-axle A6.'
});
/** Explicit inverse of the unchanged design-only longitudinal axis mapping. */
export function authoringX(sourceZ){return sourceZ>=SOURCE_FIT.locoEndSourceZ?SOURCE_FIT.locoAuthoringEnd+(SOURCE_FIT.locoEndSourceZ-sourceZ)/.92:sourceZ>=SOURCE_FIT.tenderStartSourceZ?20.10+(sourceZ+3.1418)*.22/(-3.3325+3.1418):20.32+(sourceZ+3.3325)*7.98/(-10.9776+3.3325);}
export const DESIGN_LAYOUT=Object.freeze({
 revision:'R02_USER_BLUE_MARKUP_2026-10-17_0723',
 noseSourceEnvelopeRevision:'R02_FRONT_SOURCE_COVER_0747',
 noseCoverControlUpdates:{4:{crownHeight:3.35,shoulder:2.65},5:{crownHeight:4.00,shoulder:2.83}},
 noseCoverReason:'Cover unmodified original front-bogie upper geometry, mixed front rivets and pipes; source whistle stays at its original mounted position',
 noseSourceZ:13.60,previousNoseSourceZ:16.6382,originalA4NoseSourceZ:11.054,
 cabFrontSourceZ:6.80,cabRearSourceZ:.70,
 wheelOpeningFrontSourceZ:7.1258,wheelOpeningRearSourceZ:.5482,
 wheelOpeningFrontRampSourceZ:7.80,wheelOpeningRearRampSourceZ:-.15,wheelOpeningCrownSourceY:2.60,
 crownSourceY:4.443316818,
 crownReference:{mark3BodyNode:15,mark3BodySourceY:4.227700233,mark3MeasuredWheelMeshBottomY:.207143545,a4MeasuredWheelMeshBottomY:.422760130,relativeCrown:4.020556688,status:'GEOMETRIC_SOURCE_UNIT_REFERENCE_ONLY; wheel mesh minimum is not a certified rail plane'},
 driverOffsetFromCabFront:1.40,originalCabFloor:2.18,newCabFloor:2.3772,newFloorLowestSourceY:2.70,rearSwitchCount:9,rearSwitchRows:1,
 branding:{wordmarkWidth:7.60,wordmarkX:24.25,wordmarkZ:2.95,redContourWidth:3.65,redContourX:18.20,redContourZ:2.18,numberWidth:1.20,numberX:5.80,numberZ:1.47,companyWidth:1.05,companyX:7.30,companyZ:1.45},
 sourceMechanicalTransformsChanged:false,sourceAssetsChanged:false,
 passengerCarBlueArcs:'REFERENCE_ANNOTATIONS_ONLY; no Mark3 mechanism deleted',
 fitStatus:'VISUAL_LAYOUT_PROPOSAL_ONLY; floor/mechanism, structure and motion clearance remain unverified'
});
export const AUTHORING_D=Object.freeze({
 units:'INTERNAL_TEMPLATE_COORDINATES_ONLY',noseX:authoringX(DESIGN_LAYOUT.noseSourceZ),locoEnd:20.10,tenderStart:20.32,tenderEnd:28.30,
 driverRadius:1.067925,cabStart:authoringX(DESIGN_LAYOUT.cabFrontSourceZ),cabEnd:authoringX(DESIGN_LAYOUT.cabRearSourceZ),cabFloor:DESIGN_LAYOUT.newCabFloor,cabGlassSill:2.52,steamOutlets:[17.60,19.25],
 crownHeight:DESIGN_LAYOUT.crownSourceY-SOURCE_FIT.verticalOffset
});
function longitudinalScale(x){return x<=20.10?-.92:x<20.32?(-3.3325+3.1418)/.22:(-10.9776+3.3325)/7.98;}
export function sourcePoint(x,y,z){
 const forward=x<=20.10?-3.1418+(20.10-x)*.92:x<20.32?-3.1418+(x-20.10)*(-3.3325+3.1418)/.22:-3.3325+(x-20.32)*(-10.9776+3.3325)/7.98;
 return[-y*SOURCE_FIT.transverseScale,z+SOURCE_FIT.verticalOffset,forward];
}
export function sourceJacobian(x){return{transverse:SOURCE_FIT.transverseScale,longitudinal:longitudinalScale(x)};}
