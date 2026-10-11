export const CONTACT_LIMITS=Object.freeze({penetrationToleranceM:.008,contactToleranceM:.015,minimumStanceContactFraction:.30});
/** Candidate diagnostics, not force closure or whole-body collision acceptance. */
export function summarizeFootContacts(vertices,{planted=false}={}) {
  const finite=vertices.filter(v=>Number.isFinite(v.gapM)),penetrating=finite.filter(v=>v.gapM < -CONTACT_LIMITS.penetrationToleranceM),touching=finite.filter(v=>Math.abs(v.gapM)<=CONTACT_LIMITS.contactToleranceM),airborne=finite.filter(v=>v.gapM>CONTACT_LIMITS.contactToleranceM),n=vertices.length;
  const minimumGapM=finite.length?Math.min(...finite.map(v=>v.gapM)):null,maximumGapM=finite.length?Math.max(...finite.map(v=>v.gapM)):null;
  return {vertices:n,planted,minimumGapM,maximumGapM,missingSupport:n-finite.length,penetratingVertices:penetrating.length,penetratingFraction:n?penetrating.length/n:1,contactVertices:touching.length,contactFraction:n?touching.length/n:0,airborneVertices:airborne.length,airborneFraction:n?airborne.length/n:1,candidateGate:penetrating.length===0&&(!planted||(touching.length/n>=CONTACT_LIMITS.minimumStanceContactFraction)),limits:CONTACT_LIMITS,scope:'Original skinned low-sole band to actual floor/tread samples; no forces, foot volumes, walls or clothing collision tested'};
}

/** Highest actual top only within the existing local foot-height window.
 * Shift the nearest-height query to the window ceiling so overlapping stair
 * noses cannot hide behind a nearer, lower tread. Never searches other storeys.
 */
export function sampleFootObstacle(sampleSupport,{x,z,referenceY,maxRise=.23,maxDrop=.43}){
  return sampleSupport({x,z,referenceY:referenceY+maxRise,maxRise:0,maxDrop:maxRise+maxDrop});
}
