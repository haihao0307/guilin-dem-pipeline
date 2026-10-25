/** Host-local scheduling/ownership only. This module does not alter the source,
 * emit a wall, cut a hole, reclassify a floor, or remove a legacy aperture.
 * The consumer must explicitly activate an integrated host field before using
 * the reported removal sets. A candidate host is tested as a full 3D domain,
 * not only after a hit on its original zero-thickness source plane.
 */
import {packApertureDescriptors} from './kowloon-building-mother-r01/r07/apertures.mjs';
import {aperturePackedBounds} from './kowloon-building-mother-r01/whole-building-floor-study-r01/primary-aperture-index.mjs';
const EPS=2**-23,finite3=v=>v?.length===3&&Array.from(v).every(Number.isFinite),valid=b=>finite3(b?.min)&&finite3(b?.max)&&b.min.every((v,k)=>v<=b.max[k]);
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),sub=(a,b)=>a.map((v,k)=>v-b[k]),add=(a,b)=>a.map((v,k)=>v+b[k]);
const scratch=new Float32Array(1),bits=new Uint32Array(scratch.buffer);
function outward(value,up){scratch[0]=value;const r=scratch[0];if(!Number.isFinite(r))return NaN;if(up?r>=value:r<=value)return r;if(r===0){bits[0]=up?1:0x80000001;return scratch[0]}bits[0]+=((r>0)===up)?1:-1;return scratch[0]}
function union(items){if(!items.length||items.some(b=>!valid(b)))return null;return{min:[0,1,2].map(k=>Math.min(...items.map(b=>b.min[k]))),max:[0,1,2].map(k=>Math.max(...items.map(b=>b.max[k])))}}
function overlaps(a,b){return !valid(a)||!valid(b)||a.min.every((v,k)=>v<=b.max[k]&&b.min[k]<=a.max[k])}
const corners=b=>Array.from({length:8},(_,mask)=>[0,1,2].map(k=>(mask&(1<<k))?b.max[k]:b.min[k]));
function localBounds(bounds,frame){if(!valid(bounds))return null;const points=corners(bounds).map(p=>[frame.u,frame.v,frame.n].map(axis=>dot(axis,sub(p,frame.origin))));return{min:[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...points.map(p=>p[k])))}}
function inverseFrame(frame){
 const rows=[frame.u,frame.v,frame.n].map(row=>row.map(Math.fround));
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(Math.abs(dot(rows[i],rows[j])-(i===j?1:0))>1e-5)return null;
 const [[a,b,c],[d,e,f],[g,h,i]]=rows,det=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);
 if(!Number.isFinite(det)||Math.abs(det)<.999||Math.abs(det)>1.001)return null;
 return [[e*i-f*h,c*h-b*i,b*f-c*e],[f*g-d*i,a*i-c*g,c*d-a*f],[d*h-e*g,b*g-a*h,a*e-b*d]].map(row=>row.map(v=>v/det));
}
/** Includes both the original double source extrusion and the packed F32
 * dot-coordinate interpretation. Outward padding schedules more work only.
 * This follows the existing primary-index F32 guard convention, not a universal
 * proof of every driver's floating-point implementation. GPU boundary QA is
 * still required before activation.
 * Invalid/infinite supports fail open as null; consumers may not omit them.
 */
export function hostWallBounds(patch,depthRange){
 if(!patch||![patch.origin,patch.u,patch.v,patch.n].every(finite3)||!Array.isArray(patch.loops)||!patch.loops.length||patch.loops.flat().some(p=>p?.length!==2||!p.every(Number.isFinite))||!Array.isArray(depthRange)||depthRange.length!==2||!depthRange.every(Number.isFinite)||depthRange[0]>depthRange[1])return null;
 const inverse=inverseFrame(patch);if(!inverse)return null;
 const uv=patch.loops.flat(),low=[Math.min(...uv.map(p=>p[0])),Math.min(...uv.map(p=>p[1])),depthRange[0]],high=[Math.max(...uv.map(p=>p[0])),Math.max(...uv.map(p=>p[1])),depthRange[1]],origin=patch.origin.map(Math.fround),points=[];
 for(const p of corners({min:low,max:high})){
  points.push(patch.origin.map((v,k)=>v+patch.u[k]*p[0]+patch.v[k]*p[1]+patch.n[k]*p[2]));
  const q=p.map(Math.fround);points.push(inverse.map((row,k)=>origin[k]+dot(row,q)));
 }
 const scale=1+Math.max(...points.flat().map(Math.abs))+Math.max(...low.map(Math.abs),...high.map(Math.abs)),guard=.00002+128*EPS*scale;
 const bounds={min:[0,1,2].map(k=>outward(Math.min(...points.map(p=>p[k]))-guard,false)),max:[0,1,2].map(k=>outward(Math.max(...points.map(p=>p[k]))+guard,true))};return valid(bounds)?bounds:null;
}
function rectangularHost(patch){
 if(patch.sourceKind!=='wallStrip'||patch.loops?.length!==1||patch.loops[0].length!==4)return false;
 const loop=patch.loops[0],u=[Math.min(...loop.map(q=>q[0])),Math.max(...loop.map(q=>q[0]))],v=[Math.min(...loop.map(q=>q[1])),Math.max(...loop.map(q=>q[1]))];
 return u[1]>u[0]&&v[1]>v[0]&&loop.every(q=>u.includes(q[0])&&v.includes(q[1]))&&new Set(loop.map(q=>q.join(','))).size===4;
}
export function buildHostApertureIndex({source,apertures,sourceMasks,hostPatchIds,wallDepthRange=[-.26,0]}={}){
 if(!Array.isArray(source?.patches)||!Array.isArray(apertures)||!Array.isArray(sourceMasks)||!Array.isArray(hostPatchIds)||new Set(hostPatchIds).size!==hostPatchIds.length)throw Error('Explicit source, apertures, masks and unique host IDs required');
 if(!Array.isArray(wallDepthRange)||wallDepthRange.length!==2||!wallDepthRange.every(Number.isFinite)||wallDepthRange[0]>=wallDepthRange[1])throw Error('Explicit ordered positive-volume wall depth range required');
 const packed=packApertureDescriptors(apertures),bounds=aperturePackedBounds(packed,packed.primitiveCount),flat=[],apertureParts=[];let cursor=0;
 apertures.forEach((aperture,apertureIndex)=>{const indices=[];for(const [partIndex,part]of aperture.primitives.entries()){indices.push(cursor);flat.push({primitiveIndex:cursor++,apertureIndex,partIndex,objectId:part.objectId,part,nodeId:part.nodeId,caseId:aperture.caseId??null})}apertureParts.push(indices)});
 const groups=[],bySourcePatchIndex=new Map(),bySourceObjectId=new Map(),claimed=new Set();
 for(const hostId of hostPatchIds){
  const sourcePatchIndex=source.patches.findIndex(p=>p.sourcePatchId===hostId),patch=source.patches[sourcePatchIndex];if(!patch)throw Error('Unknown source host '+hostId);if(source.patches.filter(p=>p.sourcePatchId===hostId).length!==1)throw Error('Ambiguous source string identity');
  if(!rectangularHost(patch))throw Error('Initial integrated host adapter requires a finite rectangular source wall: '+hostId);
  if(bySourceObjectId.has(patch.objectId))throw Error('Ambiguous source numeric identity');
  const frame={origin:[...patch.origin],u:[...patch.u],v:[...patch.v],n:[...patch.n]},wallBounds=hostWallBounds(patch,wallDepthRange),uv=patch.loops[0],sourceUVBounds={min:[Math.min(...uv.map(q=>q[0])),Math.min(...uv.map(q=>q[1]))],max:[Math.max(...uv.map(q=>q[0])),Math.max(...uv.map(q=>q[1]))]},windows=[];
  apertures.forEach((aperture,apertureIndex)=>{
   if(aperture.host?.sourcePatchId!==hostId)return;
   if(aperture.host.sourceObjectId!==patch.objectId)throw Error('Aperture source string/numeric identity mismatch');
   if(claimed.has(apertureIndex))throw Error('Aperture claimed by multiple hosts');
   const matching=sourceMasks.map((mask,index)=>({mask,index})).filter(({mask})=>mask.enabled&&mask.sourcePatchId===hostId&&mask.instanceId===aperture.instanceId&&mask.hostId===aperture.host.nodeId);
   if(matching.length!==1)throw Error('Exactly one same-host source opening row required for '+aperture.host.nodeId);
   const {mask,index:sourceMaskIndex}=matching[0];if(mask.sourceObjectId!==patch.objectId||mask.floorId!==aperture.floorId)throw Error('Opening source/floor ownership mismatch');
   if(![mask.width,mask.height,mask.depth].every(v=>Number.isFinite(v)&&v>0)||![mask.frame?.origin,mask.frame?.u,mask.frame?.v,mask.frame?.w].every(finite3))throw Error('Finite positive source opening row required');
   if(!inverseFrame({...mask.frame,n:mask.frame.w})||Math.abs(dot(sub(mask.frame.origin,frame.origin),frame.n))>1e-6||Math.abs(Math.abs(dot(mask.frame.w,frame.n))-1)>1e-6)throw Error('Opening row is not a rigid frame on its named source plane');
   const openingCorners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(q=>mask.frame.origin.map((v,k)=>v+mask.frame.u[k]*q[0]*mask.width/2+mask.frame.v[k]*q[1]*mask.height/2)),uvCorners=openingCorners.map(p=>[dot(sub(p,frame.origin),frame.u),dot(sub(p,frame.origin),frame.v)]);
   if(uvCorners.some(q=>q.some((v,k)=>v<sourceUVBounds.min[k]-1e-6||v>sourceUVBounds.max[k]+1e-6)))throw Error('Opening leaves its finite source wall');
   const primitiveIndices=apertureParts[apertureIndex],windowBounds=union(primitiveIndices.map(k=>bounds?.[k]??null));
   windows.push({windowIndex:windows.length,apertureIndex,instanceId:aperture.instanceId,floorId:aperture.floorId,sourceMaskIndex,hostNodeId:aperture.host.nodeId,primitiveIndices:[...primitiveIndices],objectIds:primitiveIndices.map(k=>flat[k].objectId),bounds:windowBounds,hostLocalBounds:localBounds(windowBounds,frame),opening:{frame:structuredClone(mask.frame),width:mask.width,height:mask.height,depth:mask.depth,uvCorners,uvBounds:{min:[0,1].map(k=>Math.min(...uvCorners.map(q=>q[k]))),max:[0,1].map(k=>Math.max(...uvCorners.map(q=>q[k])))}}});claimed.add(apertureIndex);
  });
  if(!windows.length)throw Error('Explicit host has no owned aperture rows: '+hostId);
  const claimedMasks=new Set(windows.map(w=>w.sourceMaskIndex));if(sourceMasks.some((mask,k)=>mask.enabled&&mask.sourcePatchId===hostId&&!claimedMasks.has(k)))throw Error('Enabled source opening row has no unique owned aperture');
  const own=new Set(windows.flatMap(w=>w.primitiveIndices)),domain=union([wallBounds,...windows.map(w=>w.bounds)]),externalApertureConflicts=flat.filter(p=>!own.has(p.primitiveIndex)&&overlaps(domain,bounds?.[p.primitiveIndex]??null)).map(p=>({primitiveIndex:p.primitiveIndex,objectId:p.objectId,apertureIndex:p.apertureIndex,nodeId:p.nodeId,caseId:p.caseId,unknownBounds:!valid(bounds?.[p.primitiveIndex])}));
  for(const window of windows){const ownParts=new Set(window.primitiveIndices);window.coverageCandidatePrimitiveIndices=flat.filter(p=>!ownParts.has(p.primitiveIndex)&&overlaps(window.bounds,bounds?.[p.primitiveIndex]??null)).map(p=>p.primitiveIndex);window.otherWindowOverlap=window.coverageCandidatePrimitiveIndices.filter(k=>own.has(k));window.externalOverlap=window.coverageCandidatePrimitiveIndices.filter(k=>!own.has(k));window.isolatedFromOtherApertureBounds=window.coverageCandidatePrimitiveIndices.length===0;}
  const group={groupIndex:groups.length,sourcePatchId:hostId,sourceObjectId:patch.objectId,sourcePatchIndex,frame,sourceUVBounds,wallDepthRange:[...wallDepthRange],wallThicknessEvidence:'explicit_design_parameter_not_surveyed',wallBounds,bounds:domain,windows,primitiveIndices:[...own],externalApertureConflicts,requiresBoundsFallback:!valid(domain),requiresExternalApertureReview:externalApertureConflicts.length>0,glassRecoveryIsolationCertified:false,scope:'Aperture bounds/ownership index only; not a proof that another host, assembly or positive roundoff isolation band cannot interact',legacyRemoval:{sourcePatchIndices:[sourcePatchIndex],apertureIndices:windows.map(w=>w.apertureIndex),sourceMaskIndices:windows.map(w=>w.sourceMaskIndex)}};
  bySourcePatchIndex.set(sourcePatchIndex,group.groupIndex);bySourceObjectId.set(patch.objectId,group.groupIndex);groups.push(group);
 }
 return{schema:'kaopu.host-aperture-index/1',groups,bySourcePatchIndex,bySourceObjectId,packedPrimitiveBounds:bounds,primitiveRecords:flat,sourcePatchCount:source.patches.length,apertureCount:apertures.length,primitiveCount:flat.length,sourceEvidenceMutated:false,activationAutomatic:false};
}
/** Unknown bounds always retain work. Ray can start inside, run parallel to the
 * source plane, hit an outward sill first, or reach an inward frame from inside. */
export function hostRayInterval(bounds,origin,direction,maxDistance=Infinity){
 if(!finite3(origin)||!finite3(direction)||!direction.some(v=>v!==0)||!(maxDistance>=0))throw Error('Finite nonzero ray and nonnegative limit required');
 if(!valid(bounds))return{near:0,far:maxDistance,failOpen:true};let near=0,far=maxDistance;
 for(let k=0;k<3;k++){if(direction[k]===0){if(origin[k]<bounds.min[k]||origin[k]>bounds.max[k])return null}else{const a=(bounds.min[k]-origin[k])/direction[k],b=(bounds.max[k]-origin[k])/direction[k];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(far<near)return null}}
 return{near,far,failOpen:false};
}
export function queryHostRay(index,origin,direction,{maxDistance=Infinity}={}){
 return index.groups.flatMap(group=>{const interval=hostRayInterval(group.bounds,origin,direction,maxDistance);if(!interval)return[];return[{groupIndex:group.groupIndex,sourcePatchIndex:group.sourcePatchIndex,sourceObjectId:group.sourceObjectId,interval,windowIndices:group.windows.filter(window=>hostRayInterval(window.bounds,origin,direction,maxDistance)!==null).map(window=>window.windowIndex)}]});
}
