/** Host-only convex-glass cap provenance, not a new geometric primitive.
 * Primary local intervals keep their exact original operations. A depth event
 * may carry its known +/- cap coordinate instead of destroying that identity
 * through a world round trip and then asking the same solid to rediscover it.
 *
 * Only strict plan/sash-hole interiors with a bounded numerical uncertainty
 * qualify. This bound DECLINES uncertain events; it never advances a ray,
 * widens a solid, clamps t, or runs scene-wide rescue. Side/corner/degenerate
 * events and all frame/leaf/sill events retain the original own/coverage rules.
 */
import {GLASS_ENDPOINT_GLSL} from './kowloon-building-mother-r01/whole-building-facade-r01/glass-endpoint-roundoff.mjs';
const same=(a,b)=>a?.length===3&&b?.length===3&&a.every((v,k)=>Math.fround(v)===Math.fround(b[k]));
export function hostLocalEndpointContract(host){
 if(!host?.windows?.length)return{eligible:false,reason:'No explicit host windows'};
 for(const [windowIndex,w]of host.windows.entries()){const p=w.infill?.primitives;if(p?.length!==4||p[0].materialRole!==4||p[1].materialRole!==5||!p[1].inner||p[2].materialRole!==6||p[2].inner||p[3].materialRole!==2)return{eligible:false,reason:'Expected retained frame/sash/convex-glass/sill ordering',windowIndex};if(!['origin','u','v','w'].every(k=>same(p[1][k],p[2][k])))return{eligible:false,reason:'Glass and sash do not share the packed local frame',windowIndex};}
 return{eligible:true,windows:host.windows.length,primitiveCount:4*host.windows.length,roundedGlassPreserved:true};
}
const LOCAL_INTERVALS=`
vec4 hostIntervalsLocal(AperturePart p,vec3 o,vec3 d,out vec2 plan,out vec2 depth){plan=aperturePlanInterval(o,d,p.outer,p.radii.x);depth=apertureSlab(o.z,d.z,-p.halfDepth,p.halfDepth);vec2 a=apertureIntersect(plan,depth);vec4 result=vec4(1,-1,1,-1);if(!apertureValid(a))return result;if(!p.hasInner)return vec4(a,1,-1);vec2 b=aperturePlanInterval(o,d,p.inner,p.radii.y);if(!apertureValid(b)||b.y<a.x||b.x>a.y)return vec4(a,1,-1);if(b.x>=a.x)result.xy=vec2(a.x,min(a.y,b.x));if(b.y<=a.y)result.zw=vec2(max(a.x,b.y),a.y);return result;}
`;
// Keep only the existing bounded-ray uncertainty calculation. There is no
// recovery isolation, full-scene descriptor loader or own-verification rescue.
const budgetStart=GLASS_ENDPOINT_GLSL.indexOf('float apertureGlassEndpointBudget('),budgetEnd=GLASS_ENDPOINT_GLSL.indexOf('bool apertureGlassRecoveryIsolated(');
const CAP_BUDGET=GLASS_ENDPOINT_GLSL.slice(budgetStart,budgetEnd).replaceAll('apertureGlassEndpointBudget','hostLocalCapUncertainty');
const CAP_EVENT=`
bool hostConvexGlassCap(AperturePart p,int own,vec3 ro,vec3 rd,vec3 o,vec3 d,float t,vec2 plan,vec2 depth,out vec3 q,out vec3 n){
 if(p.role!=6.||p.hasInner||own!=hostPrimitiveStart+2||abs(d.z)<.00001||!(plan.x<t&&t<plan.y&&depth.x<depth.y))return false;
 bool entry=t==depth.x,exitEvent=t==depth.y;if(entry==exitEvent)return false;
 AperturePart sash=apertureLoad(hostPrimitiveStart+1);
 if(sash.role!=5.||!sash.hasInner||!all(equal(sash.origin,p.origin))||!all(equal(sash.u,p.u))||!all(equal(sash.v,p.v))||!all(equal(sash.w,p.w)))return false;
 float error=hostLocalCapUncertainty(p,ro,rd,t);if(!(error>0.&&error<p.halfDepth*.25))return false;
 q=o+d*t;
 // The glass keeps its real rounded plan. Sash-hole interior excludes uncertain
 // glass/opaque-joint contacts from this direct boundary certificate.
 if(!(apertureRectDistance(q.xy,p.outer,p.radii.x)<-4.*error&&apertureRectDistance(q.xy,sash.inner,sash.radii.y)<-4.*error))return false;
 float sign=(entry?-1.:1.)*(d.z<0.?-1.:1.);q.z=sign*p.halfDepth;n=normalize(p.w)*sign;return true;
}
`;
export function withHostLocalEndpointTrace(source,host){
 const contract=hostLocalEndpointContract(host);if(!contract.eligible)throw Error('Host local-endpoint contract: '+contract.reason);
 if(typeof source!=='string'||source.includes('hostConvexGlassCap(')||source.includes('hostRecoveryCandidateRange('))throw Error('Local-endpoint variant requires plain, unindexed host source');
 const rescueStart=source.indexOf('float apertureGlassEndpointBudget('),traceStart=source.indexOf('bool apertureTraceRayFiltered('),traceEnd=source.indexOf('bool caseTraceRay(',traceStart);
 if(rescueStart<0||traceStart<rescueStart||traceEnd<traceStart||!source.slice(rescueStart,traceStart).includes('bool apertureOwnEndpointVerified('))throw Error('Frozen host rescue/trace contract changed');
 const original=source.slice(traceStart,traceEnd),interval='vec4 iv=apertureIntervals(p,ro,rd);visits++;',endpoint='vec3 point=ro+rd*candidate,q=aperturePartLocal(p,point),n=normalize(aperturePartWorldDirection(p,aperturePartLocalNormal(p,q)));if(!apertureOwnEndpointVerified(p,k,ro,rd,candidate,point,q,n,skipObjectId)||apertureOutwardCovered(k,point,n,skipGlass,skipObjectId))continue;';
 if(original.split(interval).length!==2||original.split(endpoint).length!==2)throw Error('Frozen host primary candidate contract changed');
 const trace=original.replace(interval,'vec3 hostO=aperturePartLocal(p,ro),hostD=aperturePartDirection(p,rd);vec2 hostPlan,hostDepth;vec4 iv=hostIntervalsLocal(p,hostO,hostD,hostPlan,hostDepth);visits++;').replace(endpoint,'vec3 point=ro+rd*candidate,q,n;bool directCap=hostConvexGlassCap(p,k,ro,rd,hostO,hostD,candidate,hostPlan,hostDepth,q,n);if(!directCap){q=aperturePartLocal(p,point);n=normalize(aperturePartWorldDirection(p,aperturePartLocalNormal(p,q)));}if((!directCap&&!aperturePositiveNeighbour(apertureIntervals(p,point,-n)))||apertureOutwardCovered(k,point,n,skipGlass,skipObjectId))continue;');
 const result=(source.slice(0,rescueStart)+LOCAL_INTERVALS+CAP_BUDGET+CAP_EVENT+trace+source.slice(traceEnd)).replace('uniform sampler2D uHostWindows,uHostRecoveryDescriptors;','uniform sampler2D uHostWindows;');
 if(/apertureGlassRecoveryIsolated|apertureOwnEndpointVerified|hostRecoveryRecord|hostRecoveryLoad|uHostRecoveryDescriptors/.test(result))throw Error('Unexpected surviving full-scene recovery reference');return result;
}
// CPU F32 diagnostic counterpart of the cap certificate, not a replacement
// CPU intersection solver. Tests compare accepted events to R07 analytic rays.
const F=Math.fround,A=(a,b)=>F(a+b),S=(a,b)=>F(a-b),M=(a,b)=>F(a*b),D=(a,b)=>F(a/b),dot=(a,b)=>A(A(M(a[0],b[0]),M(a[1],b[1])),M(a[2],b[2])),len=a=>F(Math.sqrt(dot(a,a))),axes=p=>[p.u,p.v,p.w],local=(p,ro)=>axes(p).map(a=>dot(a,ro.map((v,k)=>S(v,p.origin[k])))),dir=(p,rd)=>axes(p).map(a=>dot(a,rd)),g=n=>D(M(n,2**-24),S(1,M(n,2**-24)));
function uncertainty(p,ro,rd,t,o,d){const r=ro.map((v,k)=>A(Math.abs(v),Math.abs(p.origin[k]))),dr=rd.map(Math.abs),s=r.map((v,k)=>A(v,M(dr[k],Math.abs(t)))),aa=axes(p).map(a=>a.map(Math.abs)),bo=aa.map(a=>M(g(6),dot(a,r))),bd=aa.map(a=>M(g(5),dot(a,dr))),bq=aa.map(a=>M(g(8),dot(a,s))),den=S(Math.abs(d[2]),bd[2]);if(!(den>0))return Infinity;const et=D(A(A(bo[2],M(Math.abs(t),bd[2])),M(M(2,g(1)),A(p.halfDepth,Math.abs(o[2])))),den),error=aa.map((a,k)=>Math.max(M(g(24),dot(a,s)),A(bq[k],M(A(Math.abs(d[k]),bd[k]),et))));return len(error);}
function rectDistance(q,r){const v=q.map((v,k)=>A(S(Math.abs(S(v,r.center[k])),r.half[k]),r.radius)),outside=v.map(v=>Math.max(v,0)),length=F(Math.sqrt(A(M(outside[0],outside[0]),M(outside[1],outside[1]))));return S(A(length,Math.min(Math.max(v[0],v[1]),0)),r.radius);}
export function classifyHostLocalGlassCap({part:p,sash,origin:ro,direction:rd,t,plan,depth}={}){
 if(!p||p.materialRole!==6||p.inner||!sash?.inner||sash.materialRole!==5)return{direct:false,reason:'not-convex-glass-with-sash'};
 if(!['origin','u','v','w'].every(k=>same(sash[k],p[k])))return{direct:false,reason:'different-local-frame'};
 const o=local(p,ro),d=dir(p,rd);if(Math.abs(d[2])<.00001||!(plan[0]<t&&t<plan[1]&&depth[0]<depth[1]))return{direct:false,reason:'side-edge-degenerate-or-near-parallel'};
 const entry=t===depth[0],exit=t===depth[1];if(entry===exit)return{direct:false,reason:'not-unique-depth-cap'};
 const error=uncertainty(p,ro,rd,t,o,d);if(!(error>0&&error<M(p.halfDepth,.25)))return{direct:false,reason:'uncertain-ray',error};
 const q=o.map((v,k)=>A(v,M(d[k],t)));if(!(rectDistance(q.slice(0,2),p.outer)<M(-4,error)&&rectDistance(q.slice(0,2),sash.inner)<M(-4,error)))return{direct:false,reason:'plan-or-sash-contact-uncertain',error};
 const sign=(entry?-1:1)*(d[2]<0?-1:1);q[2]=M(sign,p.halfDepth);const length=len(p.w),normal=p.w.map(v=>M(D(v,length),sign));return{direct:true,t,local:q,normal,capSign:sign,provenance:entry?'convex-glass-depth-entry':'convex-glass-depth-exit',error};
}
