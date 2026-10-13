/** F02.1: local ear-attachment exclusion; metres on frozen native GNM.
 * Only subtracts growth in the reported superior/anterior auricle bridge.
 * It does not change the accepted outer scalp profile or move any root.
 * Local dimensions are authored on this head, not photo measurements.
 */
export const EAR_GUARD=Object.freeze({minAbsX:.0735,cy:.289,cz:.025,ry:.0185,rz:.0125});
export function earClearance(p){
 const g=EAR_GUARD,dy=(p[1]-g.cy)/g.ry,dz=(p[2]-g.cz)/g.rz;
 return Math.max((Math.hypot(dy,dz)-1)*g.rz,g.minAbsX-Math.abs(p[0]));
}
export function subtractEar(p,oldValue){
 // Outside the small local attachment window the original field is exact.
 const d=earClearance(p);
 // A continuous union/difference field is required by the contour bisector.
 if (Math.abs(p[0])<.065 || p[1]<.26 || p[1]>.32 || p[2]<.005 || p[2]>.048) return oldValue;
 return Math.min(oldValue,d);
}
