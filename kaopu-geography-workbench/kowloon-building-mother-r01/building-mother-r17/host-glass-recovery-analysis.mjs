/** Independent, NOT connected to the renderer. Positive-band analysis for the
 * existing glass endpoint recovery rule. It never reuses coverage neighbours.
 *
 * Every proposed omission requires a strict lower distance > upper recovery
 * band over a CLOSED world-space query domain and every allowed own error.
 * A future consumer MUST check the actual point is in that domain, check the
 * same own error gate, validate descriptor identity, and otherwise use the full
 * original recovery scan. Geometry bounds alone do not justify recovery skips.
 *
 * Interval arithmetic models highp F32 add/subtract/multiply with a wider than
 * one-ULP enclosure, sqrt with a wider than two-ULP enclosure, and division with
 * a wider than 2.5-ULP enclosure. Dot sums include every binary association; the
 * intervals include exact intermediates and therefore also contraction. It is
 * NOT a universal device proof and does not replace real GPU equivalence QA.
 */
import {packApertureDescriptors} from './kowloon-building-mother-r01/r07/apertures.mjs';
import {aperturePackedBounds} from './kowloon-building-mother-r01/whole-building-floor-study-r01/primary-aperture-index.mjs';
const f=new Float32Array(1),bits=new Uint32Array(f.buffer),MIN_NORMAL=2**-126;
function next(value,up){f[0]=value;const r=f[0];if(!Number.isFinite(r))return r;if(r===0){bits[0]=up?1:0x80000001;return f[0]}bits[0]+=((r>0)===up)?1:-1;return f[0]}
function rounded(value,up,ulps=2){let r=Math.fround(value);for(let k=0;k<ulps;k++)r=next(r,up);if(Math.abs(value)<MIN_NORMAL)r=up?Math.max(0,r):Math.min(0,r);return r;}
const I=x=>[x,x],span=(a,b,ulps=2)=>[rounded(a,false,ulps),rounded(b,true,ulps)],join=(a,b)=>[Math.min(a[0],b[0]),Math.max(a[1],b[1])],valid=a=>a.length===2&&a.every(Number.isFinite)&&a[0]<=a[1];
const plus=(a,b)=>span(a[0]+b[0],a[1]+b[1]),minus=(a,b)=>span(a[0]-b[1],a[1]-b[0]),neg=a=>[-a[1],-a[0]],abs=a=>a[0]>=0?a:a[1]<=0?neg(a):[0,Math.max(-a[0],a[1])],max=(a,b)=>[Math.max(a[0],b[0]),Math.max(a[1],b[1])],min=(a,b)=>[Math.min(a[0],b[0]),Math.min(a[1],b[1])];
function times(a,b){const p=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]];return span(Math.min(...p),Math.max(...p));}
function divide(a,b){if(b[0]<=0&&b[1]>=0)return[-Infinity,Infinity];const p=[a[0]/b[0],a[0]/b[1],a[1]/b[0],a[1]/b[1]];return span(Math.min(...p),Math.max(...p),4);}
function sums(terms){const memo=new Map();function visit(mask){if(memo.has(mask))return memo.get(mask);if(!(mask&(mask-1))){const value=terms[Math.log2(mask)];memo.set(mask,value);return value}const first=mask&-mask;let out=null;for(let sub=(mask-1)&mask;sub;sub=(sub-1)&mask){if(!(sub&first))continue;const other=mask^sub;if(!other)continue;const value=plus(visit(sub),visit(other));out=out?join(out,value):value}memo.set(mask,out);return out}return visit((1<<terms.length)-1);}
const dot=(a,b)=>sums(a.map((x,k)=>times(x,b[k]))),zero=I(0),one=I(1);
function length(a){const square=a.map(x=>{const v=abs(x);return times(v,v)}),s=sums(square);return span(Math.sqrt(Math.max(0,s[0])),Math.sqrt(Math.max(0,s[1])),3);}
const u=I(2**-24),g=n=>{const nu=times(I(n),u);return divide(nu,minus(one,nu))},g8=g(8),g64=g(64);
function shapeScale(p){let value=plus(plus(dot(p.outer.map(v=>I(Math.abs(v))),[one,one,one,one]),times(I(2),I(p.radii[0]))),I(p.halfDepth));if(p.hasInner)value=plus(value,plus(dot(p.inner.map(v=>I(Math.abs(v))),[one,one,one,one]),times(I(2),I(p.radii[1]))));return value;}
function rectDistance(q,r,radius){const a=q.map((v,k)=>plus(minus(abs(minus(v,I(r[k]))),I(r[k+2])),I(radius)));return minus(plus(length(a.map(v=>max(v,zero))),min(max(a[0],a[1]),zero)),I(radius));}
function distance(p,q){const a=rectDistance(q.slice(0,2),p.outer,p.radii[0]),b=minus(abs(q[2]),I(p.halfDepth)),d=plus(length([max(a,zero),max(b,zero)]),min(max(a,b),zero));return p.hasInner?max(d,neg(rectDistance(q.slice(0,2),p.inner,p.radii[1]))):d;}
function records(packed){const d=packed.data;return Array.from({length:packed.primitiveCount},(_,k)=>{const base=4*(1+9*k),r=i=>Array.from(d.slice(base+4*i,base+4*i+4)),a=r(0),u=r(1),v=r(2),w=r(3),p={primitiveIndex:k,origin:a.slice(0,3),hasInner:a[3]>.5,axes:[u.slice(0,3),v.slice(0,3),w.slice(0,3)],objectId:u[3],role:v[3],halfDepth:w[3],outer:r(4),radii:r(5).slice(0,2),inner:r(6)};p.shapeScale=shapeScale(p);return p;});}
/** Closed-box interval evaluation of the actual positive-band expressions. */
export function hostRecoveryPairBounds(other,domain,ownErrorMax){
 if(!domain||![...domain.min,...domain.max,ownErrorMax].every(Number.isFinite)||ownErrorMax<0||domain.min.some((v,k)=>v>domain.max[k]))return null;
 const point=domain.min.map((v,k)=>[v,domain.max[k]]),relative=point.map((v,k)=>minus(v,I(other.origin[k]))),q=other.axes.map(axis=>dot(axis.map(I),relative)),r=point.map((v,k)=>plus(abs(v),I(Math.abs(other.origin[k])))),e=other.axes.map(axis=>times(g8,dot(axis.map(v=>I(Math.abs(v))),r))),evaluation=times(g64,plus(dot(q.map(abs),[one,one,one]),other.shapeScale)),band=times(plus(plus(times(I(4),[0,ownErrorMax]),length(e)),evaluation),plus(one,g8)),d=distance(other,q);
 if(!valid(d)||!valid(band))return null;return{distanceLower:d[0],distanceUpper:d[1],bandUpper:band[1],margin:d[0]-band[1],omittable:d[0]>band[1]};
}
export function analyzeHostGlassRecovery({apertures,hostIndex,groupIndex=null}={}){
 if(!Array.isArray(apertures)||!hostIndex?.groups?.length||groupIndex!==null&&!hostIndex.groups[groupIndex])throw Error('Explicit apertures and host group required');
 const packed=packApertureDescriptors(apertures),parts=records(packed),bounds=aperturePackedBounds(packed,parts.length),groups=groupIndex===null?hostIndex.groups:[hostIndex.groups[groupIndex]];
 if(parts.length!==hostIndex.primitiveCount||parts.some((p,k)=>p.objectId!==hostIndex.primitiveRecords[k].objectId))throw Error('Recovery descriptors and host index are not the same ordered scene');
 if(new Set(parts.map(p=>p.objectId)).size!==parts.length)throw Error('Recovery object IDs must be unique');
 const rows=[];
 for(const group of groups)for(const window of group.windows)for(const ownIndex of window.primitiveIndices){const own=parts[ownIndex];if(own.role!==6||own.hasInner)continue;const ownErrorMax=rounded(own.halfDepth*.25,true),base=bounds?.[ownIndex],domain=base?{min:base.min.map(v=>rounded(v-ownErrorMax,false)),max:base.max.map(v=>rounded(v+ownErrorMax,true))}:null,candidatePrimitiveIndices=[],omitted=[],uncertain=[];
  for(let k=0;k<parts.length;k++){if(k===ownIndex)continue;const certificate=hostRecoveryPairBounds(parts[k],domain,ownErrorMax);if(certificate?.omittable)omitted.push({primitiveIndex:k,objectId:parts[k].objectId,...certificate});else{candidatePrimitiveIndices.push(k);if(!certificate)uncertain.push(k)}}
  rows.push({groupIndex:group.groupIndex,sourcePatchId:group.sourcePatchId,windowIndex:window.windowIndex,instanceId:window.instanceId,ownPrimitiveIndex:ownIndex,ownObjectId:own.objectId,ownErrorLimit:Math.fround(own.halfDepth*.25),ownErrorMax,domain,candidatePrimitiveIndices,omitted,uncertain});
 }
 return{schema:'kaopu.host-glass-recovery-analysis/1',sourcePatchId:groups.length===1?groups[0].sourcePatchId:null,sourcePatchIds:groups.map(g=>g.sourcePatchId),primitiveCount:parts.length,descriptorWidth:packed.width,descriptorHeight:packed.height,descriptorBits:Object.freeze(Array.from(new Uint32Array(packed.data.buffer,packed.data.byteOffset,packed.data.length))),rows,activationAutomatic:false,gpuValidated:false,requiresRuntimePointAndErrorGuard:true,requiresDescriptorIdentityGuard:true,precisionModel:'Conservative interval model for GLSL ES highp F32 arithmetic, including all dot-sum binary associations; not arbitrary devices',scope:'Only existing apertureGlassRecoveryIsolated predicate; not scene union, wall coverage, primary-ray culling, or geometry changes'};
}
/** Independent CPU contract checker. null means run the FULL original scan.
 * This intentionally performs an exact descriptor-bit check. A GPU consumer
 * would need an atomic revision/token contract for the same frozen texture;
 * hashing just IDs or reusing a stale scene revision is not sufficient. */
export function readHostGlassRecoveryCandidates(analysis,ownObjectId,point,error,packed){
 if(analysis?.schema!=='kaopu.host-glass-recovery-analysis/1'||!(packed?.data instanceof Float32Array)||packed.width!==analysis.descriptorWidth||packed.height!==analysis.descriptorHeight||packed.data[0]!==analysis.primitiveCount)return null;
 const bits=new Uint32Array(packed.data.buffer,packed.data.byteOffset,packed.data.length);if(bits.length!==analysis.descriptorBits?.length||analysis.descriptorBits.some((v,k)=>v!==bits[k]))return null;
 if(!point||point.length!==3||!Array.from(point).every(Number.isFinite)||!Number.isFinite(error))return null;
 const row=analysis.rows.find(r=>r.ownObjectId===ownObjectId);if(!row?.domain||!(error>0&&error<row.ownErrorLimit)||point.some((v,k)=>v<row.domain.min[k]||v>row.domain.max[k]))return null;
 const covered=new Set([row.ownPrimitiveIndex]);let last=-1;for(const k of row.candidatePrimitiveIndices){if(!Number.isInteger(k)||k<=last||k<0||k>=analysis.primitiveCount||covered.has(k))return null;covered.add(k);last=k}
 for(const p of row.omitted){if(!Number.isInteger(p.primitiveIndex)||p.primitiveIndex<0||p.primitiveIndex>=analysis.primitiveCount||covered.has(p.primitiveIndex)||!(p.distanceLower>p.bandUpper))return null;covered.add(p.primitiveIndex)}
 if(covered.size!==analysis.primitiveCount)return null;return [...row.candidatePrimitiveIndices];
}
