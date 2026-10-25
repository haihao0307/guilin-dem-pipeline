/** Local cap provenance for the remaining analytic aperture union.
 * There is still ONE union and its original outward coverage. Door/frame/leaf
 * own checks and all rounded plans remain intact. Only certified convex glass
 * depth caps avoid the redundant world -> local own-solid reconstruction.
 * Uncertain caps/sides keep the original own check, not scene-wide recovery.
 */
import {packApertureDescriptors} from './kowloon-building-mother-r01/r07/apertures.mjs';
import {GLASS_ENDPOINT_GLSL} from './kowloon-building-mother-r01/whole-building-facade-r01/glass-endpoint-roundoff.mjs';
import {classifyHostLocalGlassCap} from './host-local-endpoint-trace.mjs';

export const APERTURE_LOCAL_CAP_MAGIC=6721373,APERTURE_LOCAL_CAP_VERSION=1;
const F=Math.fround,integer=(x,a,b)=>Number.isInteger(x)&&x>=a&&x<=b;
const same=(a,b)=>a?.length===3&&b?.length===3&&a.every((v,k)=>Number.isFinite(v)&&F(v)===F(b[k]));
const frameEqual=(a,b)=>['origin','u','v','w'].every(k=>same(a[k],b[k]));
const allowedSashRole=role=>role===5||role===13;
const finiteRect=r=>r?.center?.length===2&&r?.half?.length===2&&[...r.center,...r.half,r.radius].every(Number.isFinite)&&r.half.every(x=>F(x)>0)&&r.radius>=0&&r.radius<=Math.min(...r.half);
const fail=reason=>({eligible:false,reason,variantKey:'generic-bounded-glass-recovery-v1'});

/** Inspect semantic part ownership, never infer sash identity from material
 * alone or hard-code descriptor order. Call after EVERY descriptor replacement.
 */
export function apertureLocalEndpointContract(input){
 const apertures=Array.isArray(input)?input:[input];
 if(apertures.length>512||apertures.some(a=>!Array.isArray(a?.primitives)))return fail('Invalid aperture list');
 const instances=new Set(),ids=new Set(),mappings=[];let offset=0;
 for(const aperture of apertures){
  if(!integer(aperture.instanceId,0,511)||instances.has(aperture.instanceId))return fail('Unknown or duplicate instance identity');
  instances.add(aperture.instanceId);
  for(const p of aperture.primitives){
   if(p.instanceId!==aperture.instanceId||!integer(p.objectId,1,16777215)||ids.has(p.objectId)||!Number.isFinite(p.materialRole))return fail('Unknown, duplicate or non-packed part identity');
   ids.add(p.objectId);
   if((p.part==='glass')!==(p.materialRole===6))return fail('Glass semantic/material identity mismatch');
  }
  const leaves=aperture.primitives.map((p,i)=>({p,i})).filter(({p})=>p.part==='leaf');
  for(const [i,p]of aperture.primitives.entries())if(p.materialRole===6){
   if(p.inner||!finiteRect(p.outer)||!(F(p.halfDepth)>0)||leaves.length!==1)return fail('Expected one explicit sash for each convex glass');
   const {p:sash,i:sashIndex}=leaves[0];
   if(!allowedSashRole(sash.materialRole)||!finiteRect(sash.inner)||!finiteRect(sash.outer)||!(F(sash.halfDepth)>=F(p.halfDepth))||!frameEqual(p,sash))return fail('Glass/sash packed frame or finite solid contract failed');
   mappings.push({glassIndex:offset+i,sashIndex:offset+sashIndex,glassObjectId:p.objectId,sashObjectId:sash.objectId,instanceId:aperture.instanceId,sashRole:sash.materialRole,glassRadius:F(p.outer.radius)});
  }
  offset+=aperture.primitives.length;
 }
 if(offset>4096)return fail('Part count exceeds established descriptor domain');
 return{eligible:true,variantKey:mappings.length?'local-glass-cap-v1':'original-own-no-glass-v1',primitiveCount:offset,glassCount:mappings.length,opaqueCount:offset-mappings.length,mappings,
  coverage:'Original complete aperture union / conservative neighbour index retained',
  numericalChange:'Certified local cap identity, not reproduction of old world-roundtrip rejection or rescue'};
}

/** The map travels in the SAME texture as its authoritative geometry. No new
 * sampler/uniform/side index. Original record-5 .w and header .zw were unused.
 * All original geometry/role/ID/bounds components are unchanged bit-for-bit.
 * An ineligible contract leaves the original packed descriptor data untouched;
 * the caller must select its original generic program variant in that case.
 */
export function packApertureLocalEndpointDescriptors(input){
 const packed=packApertureDescriptors(input),contract=apertureLocalEndpointContract(input);
 if(!contract.eligible||!contract.glassCount)return{...packed,localEndpointContract:contract};
 const data=packed.data.slice();data[2]=APERTURE_LOCAL_CAP_MAGIC;data[3]=APERTURE_LOCAL_CAP_VERSION;
 for(const m of contract.mappings)data[4*(1+9*m.glassIndex+5)+3]=m.sashIndex+1;
 return{...packed,data,localEndpointContract:contract};
}

/** CPU counterpart of runtime map checks. null means original own check, never
 * an unchecked guess at a sash or a global scene recovery query.
 */
export function readApertureLocalSash(packed,own){
 if(!(packed?.data instanceof Float32Array)||!integer(packed.width,1,16384)||!integer(packed.height,1,16384)||packed.data.length!==packed.width*packed.height*4)return null;
 const d=packed.data,count=d[0];
 if(d[1]!==9||d[2]!==APERTURE_LOCAL_CAP_MAGIC||d[3]!==APERTURE_LOCAL_CAP_VERSION||!integer(count,1,4096)||!integer(own,0,count-1)||4*(1+9*count)>d.length)return null;
 const b=4*(1+9*own),encoded=d[b+23],sash=encoded-1;
 if(!integer(encoded,1,count)||sash===own||d[b+11]!==6||d[b+3]>.5)return null;
 const s=4*(1+9*sash),instance=d[b+22];
 if(!integer(instance,0,511)||d[s+22]!==instance||!allowedSashRole(d[s+11])||!(d[s+3]>.5)||!(d[s+15]>=d[b+15]))return null;
 for(const k of[0,1,2,4,5,6,8,9,10,12,13,14])if(!Number.isFinite(d[b+k])||d[b+k]!==d[s+k])return null;
 return sash;
}

const LOCAL_INTERVALS=`
vec4 apertureCapIntervalsLocal(AperturePart p,vec3 o,vec3 d,out vec2 plan,out vec2 depth){plan=aperturePlanInterval(o,d,p.outer,p.radii.x);depth=apertureSlab(o.z,d.z,-p.halfDepth,p.halfDepth);vec2 a=apertureIntersect(plan,depth);vec4 result=vec4(1,-1,1,-1);if(!apertureValid(a))return result;if(!p.hasInner)return vec4(a,1,-1);vec2 b=aperturePlanInterval(o,d,p.inner,p.radii.y);if(!apertureValid(b)||b.y<a.x||b.x>a.y)return vec4(a,1,-1);if(b.x>=a.x)result.xy=vec2(a.x,min(a.y,b.x));if(b.y<=a.y)result.zw=vec2(max(a.x,b.y),a.y);return result;}
`;
const budgetStart=GLASS_ENDPOINT_GLSL.indexOf('float apertureGlassEndpointBudget('),budgetEnd=GLASS_ENDPOINT_GLSL.indexOf('bool apertureGlassRecoveryIsolated(');
const CAP_BUDGET=GLASS_ENDPOINT_GLSL.slice(budgetStart,budgetEnd).replaceAll('apertureGlassEndpointBudget','apertureLocalCapUncertainty');
const CAP_EVENT=`
bool apertureConvexLocalCap(AperturePart p,int own,vec3 ro,vec3 rd,vec3 o,vec3 d,float t,vec2 plan,vec2 depth,out vec3 q,out vec3 n){
 if(p.role!=6.||p.hasInner||abs(d.z)<.00001||!(plan.x<t&&t<plan.y&&depth.x<depth.y))return false;
 bool entry=t==depth.x,exitEvent=t==depth.y;if(entry==exitEvent)return false;
 vec4 head=apertureRecord(0);if(head.y!=9.||head.z!=6721373.||head.w!=1.||head.x<1.||head.x>4096.||floor(head.x)!=head.x)return false;
 ivec2 size=textureSize(uApertureDescriptors,0);if(1.+9.*head.x>float(size.x*size.y)||own<0||float(own)>=head.x)return false;
 vec4 info=apertureRecord(1+9*own+5);if(!(info.w>=1.&&info.w<=head.x&&floor(info.w)==info.w)||info.z<0.||info.z>511.||floor(info.z)!=info.z)return false;
 int sashIndex=int(info.w)-1;if(sashIndex==own||apertureRecord(1+9*sashIndex+5).z!=info.z)return false;
 AperturePart sash=apertureLoad(sashIndex);
 if((sash.role!=5.&&sash.role!=13.)||!sash.hasInner||sash.halfDepth<p.halfDepth||!all(equal(sash.origin,p.origin))||!all(equal(sash.u,p.u))||!all(equal(sash.v,p.v))||!all(equal(sash.w,p.w)))return false;
 float error=apertureLocalCapUncertainty(p,ro,rd,t);if(!(error>0.&&error<p.halfDepth*.25))return false;
 q=o+d*t;
 if(!(apertureRectDistance(q.xy,p.outer,p.radii.x)<-4.*error&&apertureRectDistance(q.xy,sash.inner,sash.radii.y)<-4.*error))return false;
 float sign=(entry?-1.:1.)*(d.z<0.?-1.:1.);q.z=sign*p.halfDepth;n=normalize(p.w)*sign;return true;
}
`;

/** Accept the current bounded-recovery library (including primary/neighbor
 * wrappers). Failed ownership certificates preserve that source EXACTLY.
 * Program cache must distinguish contract.variantKey, not just part count.
 */
export function withApertureLocalEndpointTrace(source,contract){
 if(!contract?.eligible)return source;
 if(typeof source!=='string'||source.includes('apertureConvexLocalCap(')||source.includes('hostConvexGlassCap('))throw Error('Plain bounded-recovery aperture source required');
 const rescueStart=source.indexOf('float apertureGlassEndpointBudget('),traceStart=source.indexOf('bool apertureTraceRayFiltered('),traceEnd=source.indexOf('bool caseTraceRay(',traceStart);
 if(rescueStart<0||traceStart<rescueStart||traceEnd<traceStart||!source.slice(rescueStart,traceStart).includes('bool apertureOwnEndpointVerified('))throw Error('Frozen aperture rescue contract changed');
 const original=source.slice(traceStart,traceEnd),own='!apertureOwnEndpointVerified(p,k,ro,rd,candidate,point,q,n,skipObjectId)';
 if(original.split(own).length!==2)throw Error('Frozen aperture own check changed');
 let trace,helpers='';
 if(!contract.glassCount)trace=original.replace(own,'!aperturePositiveNeighbour(apertureIntervals(p,point,-n))');
 else{
  const interval='vec4 iv=apertureIntervals(p,ro,rd);visits++;',endpoint='vec3 point=ro+rd*candidate,q=aperturePartLocal(p,point),n=normalize(aperturePartWorldDirection(p,aperturePartLocalNormal(p,q)));';
  if(original.split(interval).length!==2||original.split(endpoint).length!==2)throw Error('Frozen aperture candidate contract changed');
  helpers=LOCAL_INTERVALS+CAP_BUDGET+CAP_EVENT;
  trace=original.replace(interval,'vec3 capO=aperturePartLocal(p,ro),capD=aperturePartDirection(p,rd);vec2 capPlan,capDepth;vec4 iv=apertureCapIntervalsLocal(p,capO,capD,capPlan,capDepth);visits++;').replace(endpoint,'vec3 point=ro+rd*candidate,q,n;bool directCap=apertureConvexLocalCap(p,k,ro,rd,capO,capD,candidate,capPlan,capDepth,q,n);if(!directCap){q=aperturePartLocal(p,point);n=normalize(aperturePartWorldDirection(p,aperturePartLocalNormal(p,q)));}').replace(own,'(!directCap&&!aperturePositiveNeighbour(apertureIntervals(p,point,-n)))');
 }
 const result=source.slice(0,rescueStart)+helpers+trace+source.slice(traceEnd);
 if(/apertureGlassRecoveryIsolated|apertureOwnEndpointVerified|apertureGlassEndpointBudget/.test(result))throw Error('Unexpected remaining full-scene glass recovery');
 return result;
}

export function classifyApertureLocalGlassCap(args){
 const {part,sash}=args??{};
 if(part?.part!=='glass'||sash?.part!=='leaf'||part.instanceId!==sash.instanceId||!allowedSashRole(sash?.materialRole)||!frameEqual(part,sash))return{direct:false,reason:'unverified-sash-ownership'};
 // Material 13 is wood joinery, not a different interval geometry. Reuse the
 // already-tested host CPU certificate without altering the actual descriptor.
 return classifyHostLocalGlassCap({...args,sash:{...sash,materialRole:5}});
}
