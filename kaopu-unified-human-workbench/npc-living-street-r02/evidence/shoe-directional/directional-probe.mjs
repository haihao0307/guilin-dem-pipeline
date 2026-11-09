import fs from 'node:fs';
import path from 'node:path';
import {actorFor} from '../shoe-recovery/native-actor.mjs';
import {fitNativeShoeSide} from '../../src/NativeShoes.mjs';
const result=[],directory=path.join(globalThis.__SHOE_QA_ROOT__,'evidence/shoe-directional');
const names=['front','front-plusX','plusX','rear-plusX','rear','rear-minusX','minusX','front-minusX'];
const bucket=theta=>Math.floor(((theta+Math.PI/8+Math.PI*2)%(Math.PI*2))/(Math.PI/4));
const summary=rows=>({samples:rows.length,needsExit:rows.filter(r=>r.requiredM>0).length,
 maxRequiredM:Math.max(0,...rows.map(r=>r.requiredM)),maxAppliedM:Math.max(0,...rows.map(r=>r.appliedM)),
 meanAppliedM:rows.reduce((s,r)=>s+r.appliedM,0)/Math.max(rows.length,1),maxExcessM:Math.max(0,...rows.map(r=>r.excessM)),
 worstExcess:rows.reduce((a,b)=>!a||b.excessM>a.excessM?b:a,null),largestRequired:rows.reduce((a,b)=>!a||b.requiredM>a.requiredM?b:a,null)});
globalThis.__SHOE_APERTURE_DEBUG__=o=>{
 const {actor,base,foot,body,samples,measured,radial,r0,r1,ymax,cx,cz,displacement}=o,byPoint=new Map(measured.map(row=>[row.p,row])),q=new Float64Array(4);
 const rows=samples.map((p,index)=>{const x=p[0]-cx,z=p[2]-cz,r=Math.hypot(x,z),theta=Math.atan2(x,z),requiredM=byPoint.get(p)?.move||0;
  const appliedM=(o.atHeightAngle?o.atHeightAngle(p[1],theta).d:displacement.sample(p[1]/ymax).value)*radial(r).g*base.scaleM;
  return{index,pointMm:p,angleDegrees:theta*180/Math.PI,sector:names[bucket(theta)],requiredM,appliedM,excessM:appliedM-requiredM,initialSignedDistanceM:byPoint.get(p)?.distanceM??null};
 });
 const row={actor:actor.id,side:foot.side,scaleMPerMm:base.scaleM,axisMm:[cx,cz],radialSupportMm:[r0,r1],heightRangeMm:ymax,heightEnvelopeMm:displacement.values,
  all:summary(rows),sectors:Object.fromEntries(names.map(n=>[n,summary(rows.filter(r=>r.sector===n))])),
  quarterSectors:Object.fromEntries(['front','plusX','rear','minusX'].map((n,i)=>[n,summary(rows.filter(r=>Math.floor(((r.angleDegrees+45+360)%360)/90)===i))])),
  rows};result.push(row);
};
for(const id of (process.env.ACTOR_IDS||'B,F').split(',')){
 const actor=actorFor(id),fit=fitNativeShoeSide(actor,'L'),r=result.at(-1);r.fitting=fit.model.report.wearerFit;
 console.log(JSON.stringify({actor:id,all:r.all,sectors:r.sectors}));
 fs.writeFileSync(path.join(directory,process.env.SHOE_DIRECTIONAL_OUTPUT||'APERTURE_DIRECTIONAL_CANDIDATE.json'),JSON.stringify({schema:'production-aperture-directional-measurement/1',sourceHashes:globalThis.__SHOE_QA_SOURCE_HASHES__,
  injection:'One callback before evaluate() exposes production local measurements and unchanged analytic envelope; no fitter calculation changed.',
  units:'Distances in metres unless suffix Mm. Theta 0 points toward native shoe toe, ±180 toward rear; ±X are original unmirrored R14 side axes.',
  limitations:['The applied amount is the current analytic aperture field at exactly the base-fitted construction samples.','A sample which already has the requested complete-body clearance has requiredM zero. It may still be needed for a neighbouring continuous field.','Original base width/roof field is separated from this additional aperture displacement.','This is a neutral-direction RCA, not a new fitting or motion/visual pass.'],actors:result},null,2)+'\n');
}
