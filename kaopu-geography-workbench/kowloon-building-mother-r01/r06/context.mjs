/**
 * R06 bounded composition of two independent analytic fields in source metres.
 * The measured, unsigned shell is never edited or made into a closed volume.
 * The signed relation diagram is rigidly placed for INSPECTION, not registered
 * as a surveyed interior. Display clipping restricts source hits, adds no caps,
 * and does not change the authoritative full query or either input recipe.
 */
import {CASE_SCHEMA,queryCase,intersectCaseRay,buildCaseGLSL} from './cases.mjs';
import {ASSEMBLY_SCHEMA,queryAssembly,queryAssemblyInside,assemblyNormal,intersectAssemblyRay,buildAssemblyGLSL,assemblyLocalToSource,sourceToAssemblyLocal} from './assemblies.mjs';

export const CONTEXT_SCHEMA='kaopu.case-function-context/0.1';
// Identity/material arbitration only, matching the measured patch tie scale.
// Coincident source boundaries and authored footprint edges can evaluate a few
// Float32 ulps apart. Do not change the minimum distance, zero set or occupancy.
export const CONTEXT_IDENTITY_TIE_METRES=0.00001;
const sourceIdentityWins=(sourceDistance,designDistance)=>designDistance>=0&&sourceDistance<=designDistance+CONTEXT_IDENTITY_TIE_METRES;
const copy=x=>structuredClone(x),finite=(p,n)=>Array.isArray(p)&&p.length===n&&p.every(Number.isFinite);
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,t)=>a.map(x=>x*t),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),length=a=>Math.hypot(...a);
const unit=a=>mul(a,1/length(a));
const bound=(points)=>({min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i])))});
const corners=b=>Array.from({length:8},(_,k)=>b.min.map((x,i)=>(k>>i)&1?b.max[i]:x));
const unionBounds=(a,b)=>({min:a.min.map((x,i)=>Math.min(x,b.min[i])),max:a.max.map((x,i)=>Math.max(x,b.max[i]))});
function validBounds(b){return b&&finite(b.min,3)&&finite(b.max,3)&&b.min.every((x,i)=>x<=b.max[i]);}
function alignment(a){if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['translation','yawRadians'].includes(k))||!finite(a.translation,3)||a.translation.some(v=>Math.abs(v)>10000)||!Number.isFinite(a.yawRadians))throw Error('Rigid alignment requires finite translation and yawRadians; scale and shear are forbidden');return copy(a);}
function rotate(a,p,inverse=false){const c=Math.cos(a.yawRadians),s=Math.sin(a.yawRadians)*(inverse?-1:1);return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];}
function validateSpec(s){if(s?.schema!==CONTEXT_SCHEMA)throw Error('deriveCaseContext result required');}
function validatePoint(s,p){validateSpec(s);if(!finite(p,3))throw Error('Finite source-local point required');}
function displayDomain(measured,assembly,a,input){
 const b=measured.bounds,ab=bound(corners(assembly.bounds).map(p=>assemblyLocalToSource(assembly,p))),n=rotate(a,[0,0,1]);
 if(input!==undefined&&(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['heightRange','cutPlane'].includes(k))))throw Error('Unknown source display domain option');
 const heightRange=copy(input?.heightRange??[ab.min[1]-.35,ab.max[1]+.35]);
 const plane=copy(input?.cutPlane??{normal:n,offset:dot(n,a.translation)});
 if(!finite(heightRange,2)||heightRange[0]>=heightRange[1]||heightRange.some(v=>Math.abs(v)>10000))throw Error('Finite ordered source inspection height band required');
 if(!plane||Object.keys(plane).some(k=>!['normal','offset'].includes(k))||!finite(plane.normal,3)||Math.abs(plane.normal[1])>1e-12||Math.abs(length(plane.normal)-1)>1e-8||!Number.isFinite(plane.offset)||Math.abs(plane.offset)>10000)throw Error('Display cut requires a unit horizontal normal and finite offset');
 const lo=Math.max(b.min[1],heightRange[0]),hi=Math.min(b.max[1],heightRange[1]);
 if(lo>=hi)throw Error('Inspection height band does not overlap the measured source');
 const plan=[[b.min[0],lo,b.min[2]],[b.max[0],lo,b.min[2]],[b.max[0],lo,b.max[2]],[b.min[0],lo,b.max[2]]],kept=[];
 for(let i=0;i<4;i++){const p=plan[i],q=plan[(i+1)%4],dp=dot(plane.normal,p)-plane.offset,dq=dot(plane.normal,q)-plane.offset;if(dp>=0)kept.push(p);if((dp<0)!==(dq<0))kept.push(add(p,mul(sub(q,p),dp/(dp-dq))));}
 if(kept.length<3)throw Error('Display cut removes the entire bounded source domain');
 const displayBounds=bound(kept.flatMap(p=>[[p[0],lo,p[2]],[p[0],hi,p[2]]]));
 return {heightRange,cutPlane:plane,bounds:displayBounds,enabled:true,scope:'DISPLAY_ONLY_SOURCE_SHELL',retains:'heightRange[0] <= y <= heightRange[1] and dot(cutPlane.normal,p) >= cutPlane.offset',capsGenerated:false,groundClosureGenerated:false,label:'仅显示剖切：原楼外壳保留指定高度带及切平面一侧；不增补切口封面，不改原始源数据。',distanceQuery:'conservative_lower_bound_with_correct_restricted_zero_set_not_exact_clipped_distance'};
}
/** Explicit inspection consent is required. Fit validation belongs to the main
 * caller; this module never infers a metric fit, registration, or actual floor. */
export function deriveCaseContext(measured,assembly,options={}){
 if(measured?.schema!==CASE_SCHEMA||assembly?.schema!==ASSEMBLY_SCHEMA||measured.sourceModelId!==assembly.sourceModelId)throw Error('Matching original measured source and evidence assembly required');
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['inspectionContext','sourceDisplay'].includes(k)))throw Error('Unknown case context option');
 if(options.inspectionContext!==true)throw Error('Explicit inspectionContext: true required; rigid placement is unverified, not a fitted interior');
 if(!validBounds(measured.bounds)||!validBounds(assembly.bounds))throw Error('Finite source and assembly bounds required');
 const a=alignment(assembly.alignmentTransform);
 if(measured.patches.some((p,i)=>p.objectId!==1000+i)||measured.patches.length>1000||assembly.primitives.some(p=>!Number.isInteger(p.objectId)||p.objectId<2000))throw Error('Stable disjoint source 1000+ and assembly 2000+ object ID ranges required');
 const assemblyBounds=bound(corners(assembly.bounds).map(p=>assemblyLocalToSource(assembly,p))),sourceDisplay=displayDomain(measured,assembly,a,options.sourceDisplay);
 return {schema:CONTEXT_SCHEMA,fieldKind:'case-context',sourceModelId:measured.sourceModelId,sourceCommit:measured.sourceCommit,caseId:assembly.caseId,profile:copy(assembly.profile),measured,assembly,alignmentTransform:a,sourceDisplay,assemblyBounds,bounds:unionBounds(sourceDisplay.bounds,assemblyBounds),fullBounds:unionBounds(measured.bounds,assemblyBounds),coordinateSystem:'source_local_east_up_south_metres',placementMode:'unverified_rigid_inspection_context',registrationStatus:'unverified_editable_design',inspectionContext:true,sourceViewUnchanged:true,sourceGeometryChanged:false,sourceTransformApplied:false,actualInteriorComplete:false,structuralCertification:false,semantics:{sourceOccupancy:'unknown_unsigned_measured_shell',designOccupancy:'signed_authored_prism_union_only',alignmentEvidence:'explicit_unverified_rigid_assumption',actualFloorEstablished:false,designDisclaimer:'原楼与可编辑关系函数同场检查；刚体位置为明确假设，不是实测室内配准，也不证明实际楼层或合规性。'},counts:{patches:measured.patches.length,bvhNodes:measured.nodes.length,primitives:assembly.primitives.length,analyticBoundaryPlanes:assembly.counts.analyticBoundaryPlanes,modelTriangles:0,modelVertexBuffers:0},distanceContract:{kind:'minimum_of_unsigned_source_surface_and_signed_authored_prism_union',certifiedSDF:false,lipschitzUpperBound:1,sourceOccupancy:'undefined_no_invented_closed_volume',designInside:'signed_authored_occupancy_only',displayQuery:'separate_conservative_clipping_lower_bound',rayMethod:'source_analytic_BVH_with_domain_interval_plus_rigid_assembly_analytic_finite_domains',stepBudgetRequired:false}};
}
function domainValue(s,p){const d=s.sourceDisplay;return Math.max(d.heightRange[0]-p[1],p[1]-d.heightRange[1],d.cutPlane.offset-dot(d.cutPlane.normal,p));}
/** Default is the full DATA query. display:true is explicitly a lower-bound
 * display field, not the exact distance to the clipped finite source polygons. */
export function queryContext(spec,p,{display=false}={}){
 validatePoint(spec,p);if(typeof display!=='boolean')throw Error('display must be boolean');
 const source=queryCase(spec.measured,p),design=queryAssembly(spec.assembly,sourceToAssemblyLocal(spec.assembly,p));
 if(display)source.distance=Math.max(source.distance,domainValue(spec,p));
 const component=sourceIdentityWins(source.distance,design.distance)?'source':'assembly',h=component==='source'?source:design;
 return {...h,distance:Math.min(source.distance,design.distance),component,coordinateFrame:component==='source'?'source-local':'diagram-local',sourceModelId:spec.sourceModelId,queryScope:display?'display_clipped_lower_bound':'authoritative_full_data',sourceOccupancy:null,designInside:design.inside,inside:component==='source'?null:design.inside};
}
export function contextNormal(spec,p,options={}){const h=queryContext(spec,p,options);return h.component==='source'?copy(h.normal):rotate(spec.alignmentTransform,assemblyNormal(spec.assembly,h.local));}
/** Material coordinates and their directional derivatives use the same frame. */
export function contextMaterialDirection(spec,hit,worldDirection){validateSpec(spec);if(!finite(worldDirection,3)||!Number.isFinite(hit?.objectId)||hit.objectId<1000)throw Error('Context material hit and finite direction required');return hit.objectId>=2000?rotate(spec.alignmentTransform,worldDirection,true):copy(worldDirection);}
/** Intersect a convex restriction interval BEFORE the unchanged source tracer.
 * Rejecting only the first removed source face would incorrectly miss a later
 * retained back face. Restarting at interval entry avoids that failure. */
function sourceInterval(spec,ro,rd,maxDistance,display){let lo=0,hi=maxDistance;const b=spec.measured.bounds;
 for(let a=0;a<3;a++){const min=a===1&&display?Math.max(b.min[a],spec.sourceDisplay.heightRange[0]):b.min[a],max=a===1&&display?Math.min(b.max[a],spec.sourceDisplay.heightRange[1]):b.max[a];if(Math.abs(rd[a])<1e-12){if(ro[a]<min||ro[a]>max)return null;}else{const x=(min-ro[a])/rd[a],y=(max-ro[a])/rd[a];lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));if(hi<lo)return null;}}
 if(display){const n=spec.sourceDisplay.cutPlane.normal,q=dot(n,ro)-spec.sourceDisplay.cutPlane.offset,d=dot(n,rd);if(Math.abs(d)<1e-12){if(q<0)return null;}else{const t=-q/d;if(d>0)lo=Math.max(lo,t);else hi=Math.min(hi,t);}}
 return hi>=lo?[lo,hi]:null;
}
export function intersectContextRay(spec,origin,direction,{maxDistance=10000,display=true,accelerated=true}={}){
 validatePoint(spec,origin);if(!finite(direction,3)||length(direction)<1e-12||!Number.isFinite(maxDistance)||maxDistance<=0||typeof display!=='boolean')throw Error('Finite nonzero ray, positive range and boolean display required');
 const rd=unit(direction),a=spec.alignmentTransform,localOrigin=sourceToAssemblyLocal(spec.assembly,origin),localDirection=rotate(a,rd,true),design=intersectAssemblyRay(spec.assembly,localOrigin,localDirection,{maxDistance}),interval=sourceInterval(spec,origin,rd,maxDistance,display);
 let source={hit:false,patchTests:0,nodeVisits:0};
 if(interval){const [lo,hi]=interval,h=intersectCaseRay(spec.measured,add(origin,mul(rd,lo)),rd,{maxDistance:hi-lo,accelerated});source={...h};if(h.hit){source.t=h.t+lo;source.point=add(origin,mul(rd,source.t));source.local=copy(source.point);if(source.t>hi||queryAssemblyInside(spec.assembly,sourceToAssemblyLocal(spec.assembly,source.point)))source.hit=false;}}
 const component=source.hit&&(!design.hit||source.t<=design.t)?'source':design.hit?'assembly':null;
 const stats={patchTests:source.patchTests,nodeVisits:source.nodeVisits,planeTests:design.planeTests,primitiveTests:design.primitiveTests,visits:source.nodeVisits+design.planeTests,sourceInterval:interval,method:'analytic_source_interval_and_rigid_prism_domains',displayOnlyClip:display};
 if(component===null)return {hit:false,status:'miss',...stats};
 const hit=component==='source'?source:design,point=add(origin,mul(rd,hit.t)),normal=component==='source'?copy(source.normal):rotate(a,design.normal);
 // The winning finite boundary already carries its authoritative identity and
 // material-local coordinates. Do not re-evaluate every source patch here.
 return {...hit,component,coordinateFrame:component==='source'?'source-local':'diagram-local',sourceModelId:spec.sourceModelId,queryScope:display?'analytic_display_boundary':'analytic_full_boundary',sourceOccupancy:null,designInside:false,inside:component==='source'?null:false,hit:true,status:'hit',t:hit.t,point,normal,...stats};
}
const f=n=>{if(!Number.isFinite(n))throw Error('Non-finite context GLSL constant');return Number(n).toFixed(12).replace(/0+$/,'').replace(/\.$/,'.0');},vec=a=>`vec${a.length}(${a.map(f).join(',')})`;
const STRUCT='struct FieldHit{float distance;float objectId;float materialRole;vec3 local;};';
/** Namespaces whole identifiers, never numeric data or field members. Apart
 * from the one shared struct, both original generators' bodies are retained. */
function namespace(code,prefix){if(code.split(STRUCT).length!==2)throw Error('Unexpected child FieldHit contract');return code.replace(STRUCT,'').replace(/\b(?:case[A-Za-z0-9_]+|assembly[A-Za-z0-9_]+|mapField|mapDistance|fieldNormal|fieldRayNormal)\b/g,name=>prefix+name);}
export function buildContextGLSL(spec){
 validateSpec(spec);const a=spec.alignmentTransform,d=spec.sourceDisplay,c=Math.cos(a.yawRadians),s=Math.sin(a.yawRadians);
 return `
${STRUCT}
// Original independent fields, mechanically namespaced without changing bodies.
${namespace(buildCaseGLSL(spec.measured),'contextSource_')}
${namespace(buildAssemblyGLSL(spec.assembly),'contextDesign_')}
const vec3 contextTranslation=${vec(a.translation)};
vec3 contextRotate(vec3 p){return vec3(${f(c)}*p.x+(${f(s)})*p.z,p.y,-(${f(s)})*p.x+${f(c)}*p.z);}
vec3 contextInverseRotate(vec3 p){return vec3(${f(c)}*p.x-(${f(s)})*p.z,p.y,${f(s)}*p.x+${f(c)}*p.z);}
vec3 contextDesignLocal(vec3 p){return contextInverseRotate(p-contextTranslation);}
vec3 contextMaterialDirection(FieldHit h,vec3 worldDirection){return h.objectId>=2000.0?contextInverseRotate(worldDirection):worldDirection;}
float contextDisplayDomain(vec3 p){return max(max(${f(d.heightRange[0])}-p.y,p.y-(${f(d.heightRange[1])})),${f(d.cutPlane.offset)}-dot(${vec(d.cutPlane.normal)},p));}
// Authoritative DATA query: unsigned measured shell + signed authored solids.
// Outside-only identity tie: retain source identity near numerical coincidence,
// but return the true min. Every strictly negative design distance wins.
bool contextSourceIdentityWins(float sourceDistance,float designDistance){return designDistance>=0.0&&sourceDistance<=designDistance+${f(CONTEXT_IDENTITY_TIE_METRES)};}
FieldHit mapField(vec3 p){FieldHit a=contextSource_mapField(p),b=contextDesign_mapField(contextDesignLocal(p));float nearest=min(a.distance,b.distance);if(contextSourceIdentityWins(a.distance,b.distance)){a.distance=nearest;return a;}b.distance=nearest;return b;}
float mapDistance(vec3 p){return min(contextSource_mapDistance(p),contextDesign_mapDistance(contextDesignLocal(p)));}
// DISPLAY ONLY lower bound. No new zero set, cap, volume, or model geometry.
FieldHit displayMapField(vec3 p){FieldHit a=contextSource_mapField(p),b=contextDesign_mapField(contextDesignLocal(p));a.distance=max(a.distance,contextDisplayDomain(p));float nearest=min(a.distance,b.distance);if(contextSourceIdentityWins(a.distance,b.distance)){a.distance=nearest;return a;}b.distance=nearest;return b;}
float displayMapDistance(vec3 p){return min(max(contextSource_mapDistance(p),contextDisplayDomain(p)),contextDesign_mapDistance(contextDesignLocal(p)));}
vec3 fieldNormal(vec3 p){FieldHit h=mapField(p);return h.objectId<2000.0?contextSource_caseNormalForId(h.objectId):contextRotate(contextDesign_fieldNormal(h.local));}
vec3 fieldRayNormal=vec3(0,1,0);
bool contextSourceInterval(vec3 ro,vec3 rd,bool display,out float lo,out float hi){lo=0.0;hi=1e20;vec3 low=${vec(spec.measured.bounds.min)},high=${vec(spec.measured.bounds.max)};
 if(display){low.y=max(low.y,${f(d.heightRange[0])});high.y=min(high.y,${f(d.heightRange[1])});}
 for(int axis=0;axis<3;axis++){if(abs(rd[axis])<1e-10){if(ro[axis]<low[axis]||ro[axis]>high[axis])return false;}else{float x=(low[axis]-ro[axis])/rd[axis],y=(high[axis]-ro[axis])/rd[axis];lo=max(lo,min(x,y));hi=min(hi,max(x,y));if(hi<lo)return false;}}
 if(display){float q=dot(${vec(d.cutPlane.normal)},ro)-(${f(d.cutPlane.offset)}),v=dot(${vec(d.cutPlane.normal)},rd);if(abs(v)<1e-10){if(q<0.0)return false;}else{float t=-q/v;if(v>0.0)lo=max(lo,t);else hi=min(hi,t);}}
 return hi>=lo;}
bool contextTraceRay(vec3 ro,vec3 rd,bool display,out float t,out FieldHit h,out int visits){float sourceT=1e20,designT=1e20,lo,hi;FieldHit sourceHit,designHit;int sourceVisits=0,designVisits=0;bool sourceFound=false;
 if(contextSourceInterval(ro,rd,display,lo,hi)){sourceFound=contextSource_caseTraceRay(ro+rd*lo,rd,sourceT,sourceHit,sourceVisits);sourceT+=lo;if(sourceFound&&sourceT>hi)sourceFound=false;if(sourceFound&&contextDesign_assemblyUnionInside(contextDesignLocal(ro+rd*sourceT)))sourceFound=false;}
 bool designFound=contextDesign_caseTraceRay(contextDesignLocal(ro),contextInverseRotate(rd),designT,designHit,designVisits);visits=sourceVisits+designVisits;t=1e20;h.distance=1e20;h.objectId=0.0;h.materialRole=0.0;h.local=ro;
 if(!sourceFound&&!designFound)return false;bool sourceWins=sourceFound&&(!designFound||sourceT<=designT);t=sourceWins?sourceT:designT;if(sourceWins)h=sourceHit;else h=designHit;
 // Stable coincidence policy: source wins an exactly equal ray parameter.
 fieldRayNormal=sourceWins?contextSource_caseNormalForId(h.objectId):contextRotate(contextDesign_fieldRayNormal);return true;}
// Renderer trace is explicitly the DISPLAY query; full DATA ray stays available.
bool caseTraceRay(vec3 ro,vec3 rd,out float t,out FieldHit h,out int visits){return contextTraceRay(ro,rd,true,t,h,visits);}
bool contextTraceRayFull(vec3 ro,vec3 rd,out float t,out FieldHit h,out int visits){return contextTraceRay(ro,rd,false,t,h,visits);}
`;
}
