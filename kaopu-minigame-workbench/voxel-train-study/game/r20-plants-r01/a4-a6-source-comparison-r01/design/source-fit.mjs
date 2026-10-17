/** The retained R04 exterior is an authoring template, not a metric calibration.
 * Only the NEW design vertices are mapped. The original A4 root and buffers are untouched.
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
export const AUTHORING_D=Object.freeze({
 units:'INTERNAL_TEMPLATE_COORDINATES_ONLY',noseX:-1.4,locoEnd:20.10,tenderStart:20.32,tenderEnd:28.30,
 driverRadius:1.067925,cabStart:3.2,cabEnd:9.6,cabFloor:2.18,cabGlassSill:2.52,steamOutlets:[14.8,16.65]
});
function longitudinalScale(x){return x<=20.10?-.92:x<20.32?(-3.3325+3.1418)/.22:(-10.9776+3.3325)/7.98;}
export function sourcePoint(x,y,z){
 const forward=x<=20.10?-3.1418+(20.10-x)*.92:x<20.32?-3.1418+(x-20.10)*(-3.3325+3.1418)/.22:-3.3325+(x-20.32)*(-10.9776+3.3325)/7.98;
 return[-y*SOURCE_FIT.transverseScale,z+SOURCE_FIT.verticalOffset,forward];
}
export function sourceJacobian(x){return{transverse:SOURCE_FIT.transverseScale,longitudinal:longitudinalScale(x)};}
