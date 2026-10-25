/** Specialize ONLY reverse coverage of an already accepted host-wall boundary.
 * Glass is skipped only if its entire packed outer support is strictly inside
 * the host's own through-hole with an outward numerical/positive-neighbour
 * guard. Such a pane cannot occupy the positive half-neighbourhood of any
 * boundary of that wall. Other infill parts must have exactly zero radii.
 *
 * This is a geometry-support certificate under the existing primary-index F32
 * guard convention, not a guarantee for arbitrary non-IEEE devices or wildly
 * ill-conditioned camera reconstruction. Actual GPU boundary QA is required.
 * Re-run the certificate after any infill/frame/hole change. Do not reuse an
 * optimized program on an uncertified host; shared programs require EVERY host
 * that uses that program to pass. Invalid support returns the original source.
 */
import {packApertureDescriptors} from './kowloon-building-mother-r01/r07/apertures.mjs';
const EPS=.000002,FLOAT_EPS=2**-23,finite3=v=>v?.length===3&&Array.from(v).every(Number.isFinite),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),norm=m=>Math.max(...m.map(r=>r.reduce((s,v)=>s+Math.abs(v),0)));
function inverse(matrix){if(matrix.some(r=>!finite3(r)))return null;for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(Math.abs(dot(matrix[i],matrix[j])-(i===j?1:0))>1e-5)return null;const [[a,b,c],[d,e,f],[g,h,i]]=matrix,det=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);if(!Number.isFinite(det)||Math.abs(det)<.999||Math.abs(det)>1.001)return null;const inv=[[e*i-f*h,c*h-b*i,b*f-c*e],[f*g-d*i,a*i-c*g,c*d-a*f],[d*h-e*g,b*g-a*h,a*e-b*d]].map(r=>r.map(v=>v/det));return norm(matrix)*norm(inv)<=4?inv:null;}
export function analyzeHostWallCoverage(host){
 const fail=(reason,detail={})=>({eligible:false,reason,...detail});if(!host?.windows?.length||![host.origin,host.u,host.v,host.n].every(finite3))return fail('Missing finite host frame/windows');
 const H=[host.u,host.v,host.n].map(r=>r.map(Math.fround)),hostOrigin=host.origin.map(Math.fround);if(!inverse(H))return fail('Unreliable packed host frame');let packed;try{packed=packApertureDescriptors(host.windows.map(w=>w.infill));}catch(error){return fail('Infill packing failed',{error:String(error.message)})}
 const d=packed.data,rows=[];let start=0,minimumClearance=Infinity,minimumGuardedClearance=Infinity,sharpParts=0,supportCorners=0;
 for(const [windowIndex,w]of host.windows.entries()){
  if(w.infill?.primitives?.length!==4||w.hole?.length!==4||!w.hole.every(Number.isFinite)||!(w.hole[0]<w.hole[2]&&w.hole[1]<w.hole[3]))return fail('Expected four finite infill parts and a positive through-hole',{windowIndex});
  let glassIndex=-1;for(let j=0;j<4;j++){const part=w.infill.primitives[j],b=4*(1+9*(start+j)),role=d[b+11];if(role===6){if(glassIndex!==-1||part.part!=='glass'||part.inner||d[b+3]>.5)return fail('Expected exactly one convex glass part',{windowIndex});glassIndex=start+j;}else{if(![2,4,5].includes(role)||part.outer?.radius!==0||(part.inner?.radius??0)!==0||d[b+20]!==0||d[b+21]!==0)return fail('Non-glass part is not an unchanged sharp rectangle extrusion',{windowIndex,partIndex:j});sharpParts++;}}
  if(glassIndex<0)return fail('Missing glass support',{windowIndex});
  const b=4*(1+9*glassIndex),record=i=>Array.from(d.slice(b+4*i,b+4*i+4)),origin=record(0).slice(0,3),M=[record(1).slice(0,3),record(2).slice(0,3),record(3).slice(0,3)],inv=inverse(M),outer=record(4),depth=record(3)[3];if(!inv||!finite3(origin)||!outer.every(Number.isFinite)||!(outer[2]>0&&outer[3]>0&&depth>0))return fail('Unreliable packed glass support',{windowIndex});
  const uv=[];for(let mask=0;mask<8;mask++){const local=[outer[0]+((mask&1)?outer[2]:-outer[2]),outer[1]+((mask&2)?outer[3]:-outer[3]),(mask&4)?depth:-depth],world=inv.map((r,k)=>origin[k]+dot(r,local)),relative=world.map((v,k)=>v-hostOrigin[k]);uv.push([dot(H[0],relative),dot(H[1],relative)]);supportCorners++;}
  const low=[0,1].map(k=>Math.min(...uv.map(q=>q[k]))),high=[0,1].map(k=>Math.max(...uv.map(q=>q[k]))),hole=w.hole.map(Math.fround),clearance=Math.min(low[0]-hole[0],low[1]-hole[1],hole[2]-high[0],hole[3]-high[1]),condition=norm(H)*norm(M)*norm(inv),scale=1+Math.max(...origin.map(Math.abs))+Math.max(...hostOrigin.map(Math.abs))+Math.max(...low.map(Math.abs),...high.map(Math.abs))+Math.max(...outer.map(Math.abs),depth),guard=EPS*norm(H)+128*FLOAT_EPS*scale*condition,guardedClearance=clearance-guard;
  if(!(guardedClearance>0))return fail('Glass support is not strictly separated from the wall boundary',{windowIndex,clearance,guard,guardedClearance});
  rows.push({windowIndex,instanceId:w.instanceId,glassPrimitiveIndex:glassIndex,glassObjectId:d[b+7],low,high,hole,clearance,guard,guardedClearance});minimumClearance=Math.min(minimumClearance,clearance);minimumGuardedClearance=Math.min(minimumGuardedClearance,guardedClearance);start+=4;
 }
 return{eligible:true,sourcePatchId:host.sourcePatchId,windows:rows.length,sharpParts,glassParts:rows.length,supportCorners,minimumClearance,minimumGuardedClearance,rows,scope:'Only wall-boundary reverse coverage; no primary glass, regular infill union, material or geometric substitution'};
}
function functionRange(source,name){const start=source.indexOf(name+'(');if(start<0)return null;const brace=source.indexOf('{',start);if(brace<0)return null;let depth=1,end=brace+1;for(;end<source.length&&depth;end++){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;}return depth?null:{start,brace,end,body:source.slice(brace,end)};}
export function withHostWallCoverageSpecialization(source,host){
 if(typeof source!=='string'||source.includes('hostWallSharpIntervals('))throw Error('Wall coverage specialization requires unwrapped source');
 const certificate=analyzeHostWallCoverage(host);if(!certificate.eligible)return source;
 return specializeCertifiedSource(source);
}
export function sharpHostWallCoverageContract(hosts){
 if(!Array.isArray(hosts)||!hosts.length)return{eligible:false,variantKey:'generic-wall-coverage-v1',reason:'A nonempty complete shared-program host list is required',hosts:[]};
 const reports=hosts.map(host=>({sourcePatchId:host?.sourcePatchId??null,...analyzeHostWallCoverage(host)})),eligible=reports.every(r=>r.eligible);
 return{eligible,variantKey:eligible?'sharp-wall-coverage-v1':'generic-wall-coverage-v1',hosts:reports,minimumGuardedClearance:eligible?Math.min(...reports.map(r=>r.minimumGuardedClearance)):null};
}
/** The shared renderer must pass ALL hosts that will use this program. */
export function withSharpHostWallCoverage(source,hosts){
 if(typeof source!=='string'||source.includes('hostWallSharpIntervals('))throw Error('Wall coverage specialization requires unwrapped source');
 return sharpHostWallCoverageContract(hosts).eligible?specializeCertifiedSource(source):source;
}
function specializeCertifiedSource(source){
 const intervals=functionRange(source,'apertureIntervals'),plan=functionRange(source,'aperturePlanInterval'),coverage=functionRange(source,'hostInfillCovers');if(!intervals||!plan||!coverage)throw Error('Host interval/coverage function contract changed');
 const sharpBranch='vec2 q=o.xy-r.xy;if(radius==0.0)return apertureBox2(q,d.xy,r.zw);';if(!plan.body.startsWith('{'+sharpBranch)||intervals.body.split('aperturePlanInterval(').length!==3)throw Error('Frozen zero-radius interval branch changed');
 const needle='if(aperturePositiveNeighbour(apertureIntervals(apertureLoad(k),point,normal)))return true;';if(coverage.body.split(needle).length!==2)throw Error('Frozen host reverse-coverage loop changed');
 const sharpPlan='vec2 hostWallSharpPlanInterval(vec3 o,vec3 d,vec4 r,float radius){vec2 q=o.xy-r.xy;return apertureBox2(q,d.xy,r.zw);}\n',sharpIntervals='vec4 hostWallSharpIntervals(AperturePart p,vec3 ro,vec3 rd)'+intervals.body.replaceAll('aperturePlanInterval(','hostWallSharpPlanInterval(')+'\n',body=coverage.body.replace(needle,'if(apertureRecord(1+9*k+2).w==6.)continue;if(aperturePositiveNeighbour(hostWallSharpIntervals(apertureLoad(k),point,normal)))return true;');
 // Insert helpers immediately before the complete coverage function declaration.
 const declarationStart=source.lastIndexOf('bool ',coverage.start);if(declarationStart<0)throw Error('Host reverse-coverage declaration changed');return source.slice(0,declarationStart)+sharpPlan+sharpIntervals+source.slice(declarationStart,coverage.brace)+body+source.slice(coverage.end);
}
