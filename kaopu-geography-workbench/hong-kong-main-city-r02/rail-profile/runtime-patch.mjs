/** Exact anchors for the known frozen R01 integration bundle. Apply only after
 * its existing SHA check. Each anchor must occur exactly once; otherwise stop.
 * Original bundle and original route remain retained for explicit rollback.
 */
export const RAIL_PROFILE_PATCHES=Object.freeze([
 {id:'same-profile-track-and-motion',from:'w=Q8(n,s),A=ev(w)',to:'w=window.HKRailVertical.create(Q8(n,s),s),A=ev({...w,points:w.renderPoints})'},
 {id:'same-profile-fixed-step-gravity',from:'I=y.tick(Math.min(G,1)*W)',to:'I=window.HKRailVertical.stepDrive(y,w,Math.min(G,1)*W)'},
 {id:'locomotive-pitch-from-same-profile',from:'_.rotation.y=-Math.atan2(T.f[2],T.f[0])',to:'_.rotation.set(0,-Math.atan2(T.f[2],T.f[0]),Math.atan(T.grade),"YZX")'}
]);
export function patchRailVerticalRuntime(text){let result=text;const applied=[];for(const p of RAIL_PROFILE_PATCHES){if(result.split(p.from).length!==2)throw Error('Rail vertical patch anchor is not unique: '+p.id);result=result.replace(p.from,p.to);applied.push(p.id);}return {text:result,applied};}
