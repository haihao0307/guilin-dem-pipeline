/** Authored sampling band on the existing native eyebrow curve; no mesh deformation.
 * Defaults reproduce R17/R42's smooth-band mask. Candidate options only affect
 * root support sampling, not strand shader, pigment, lighting or head hair. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function bounded(options,key,fallback,min,max){const v=options[key]??fallback;if(!Number.isFinite(v)||v<min||v>max)throw RangeError(key+' outside authored band range');return v;}
export function browBandProfile(u,options={}){
 if(!Number.isFinite(u)||u<0||u>1)throw RangeError('Brow longitudinal coordinate must be 0..1');
 const headWidth=bounded(options,'headWidthFloor',.82,.25,1),headCoverage=bounded(options,'headCoverageFloor',.7,.1,1),tailWidth=bounded(options,'tailWidthReduction',.72,0,.92),tailCoverage=bounded(options,'tailCoverageReduction',.35,0,.9);
 return {width:(headWidth+(1-headWidth)*smooth(0,.18,u))*(1-tailWidth*smooth(.55,1,u)),coverage:(headCoverage+(1-headCoverage)*smooth(0,.22,u))*(1-tailCoverage*smooth(.65,1,u))};
}
/** Accept a deterministic subset of existing R42 roots. Never refill rejected
 * roots elsewhere. Guide supports, triangles, barycentrics and material stay fixed. */
export function browRetentionRatio(u,distance,radius,options={}){
 if(!Number.isFinite(distance)||distance<0||!Number.isFinite(radius)||radius<=0)throw RangeError('Invalid brow band distance/radius');
 const old=browBandProfile(u),next=browBandProfile(u,options),radial=w=>clamp((1-distance/(radius*w))*2.5,0,1),a=radial(old.width)*old.coverage,b=radial(next.width)*next.coverage;
 if(b>a+1e-12)throw RangeError('Retention cannot expand original root distribution');
 return a>0?clamp(b/a,0,1):0;
}
