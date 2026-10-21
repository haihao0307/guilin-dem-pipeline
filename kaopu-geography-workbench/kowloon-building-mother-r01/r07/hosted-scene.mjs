/** R07 source-bound hosted apertures. Pure finite-function composition only.
 * The source recipe is retained by reference and never changed. Design masks
 * restrict selected source patch identities, not a global wall/depth channel.
 * The masked unsigned point field is a conservative lower bound with the
 * correct restricted zero set; analytic rays test EVERY eligible source face.
 */
import {queryCase,intersectCaseRay,buildCaseGLSL} from './cases.mjs';
import {queryAssembly,queryAssemblyInside,assemblyNormal,sourceToAssemblyLocal,intersectAssemblyRay,buildAssemblyGLSL} from './assemblies.mjs';
import {CONTEXT_SCHEMA,queryContext,contextNormal,contextMaterialDirection,intersectContextRay,buildContextGLSL} from './context.mjs';
import {queryApertures,intersectAperturesRay,buildAperturesGLSL,apertureMaterialDirection,apertureGlassInterval} from './apertures.mjs';
import {adaptHostedMaterialParameters,glassAbsorptionTransmittance,dielectricFresnel} from './material.mjs';
export const HOSTED_SCENE_SCHEMA='kaopu.hosted-case-function-scene/0.1';
export const HOSTED_IDENTITY_TIE_METRES=.00001;
const clone=x=>structuredClone(x),finite=(p,n)=>Array.isArray(p)&&p.length===n&&p.every(Number.isFinite),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,n)=>a.map(v=>v*n),len=a=>Math.hypot(...a),unit=a=>mul(a,1/len(a));
const union=(a,b)=>({min:a.min.map((v,i)=>Math.min(v,b.min[i])),max:a.max.map((v,i)=>Math.max(v,b.max[i]))});
const rotate=(s,p,inverse=false)=>{const a=s.alignmentTransform,c=Math.cos(a.yawRadians),n=Math.sin(a.yawRadians)*(inverse?-1:1);return [c*p[0]+n*p[2],p[1],-n*p[0]+c*p[2]];};
function valid(s,p){if(s?.schema!==HOSTED_SCENE_SCHEMA||p&&!finite(p,3))throw Error('Hosted scene and finite source-local point required');}
function maskSpec(m,context,components){
 const patch=context.measured.patches.find(p=>p.sourcePatchId===m.sourcePatchId),component=components.find(a=>a.instanceId===m.instanceId),frame=m.frame??component?.host;
 if(!patch||patch.objectId!==m.sourceObjectId||!patch.sourceKind.startsWith('wall'))throw Error('Source mask must name the exact existing wall patch and object identity');
 if(!component||component.enabled===false)throw Error('Source mask must bind an enabled aperture instance');
 if(!frame||!['origin','u','v','w'].every(k=>finite(frame[k],3))||['u','v','w'].some(k=>Math.abs(len(frame[k])-1)>1e-8)||Math.abs(dot(frame.u,frame.v))+Math.abs(dot(frame.u,frame.w))+Math.abs(dot(frame.v,frame.w))>1e-8)throw Error('Source mask requires a rigid orthonormal host frame');
 const width=m.width??component.config.width,height=m.height??component.config.height,roundRadius=m.roundRadius??component.config.roundRadius??0,depth=m.depth??component.config.wallThickness??.2;
 if(![width,height,depth,roundRadius].every(Number.isFinite)||Math.min(width,height,depth)<=0||roundRadius<0||roundRadius>Math.min(width,height)/2)throw Error('Finite positive source mask domain required');
 if(Math.abs(Math.abs(dot(patch.n,frame.w))-1)>1e-7||Math.abs(dot(sub(patch.origin,frame.origin),frame.w))>depth/2+.020001)throw Error('Mask frame is not coincident with its selected finite source wall');
 return {...clone(m),frame:clone(frame),width,height,roundRadius,halfDepth:depth/2+.02,enabled:true};
}
export function deriveHostedScene(context,aperturesOrBinding=[],options={}){
 if(context?.schema!==CONTEXT_SCHEMA)throw Error('Source-bound case context required');
 if(!options||Object.keys(options).some(k=>!['mode','sourceMasks','baselineContext'].includes(k)))throw Error('Unknown hosted scene option');
 const mode=options.mode??'design';if(!['baseline','design'].includes(mode))throw Error('Hosted scene mode must be baseline or design');
 const binding=Array.isArray(aperturesOrBinding)?null:aperturesOrBinding,components=binding?.components??aperturesOrBinding,baselineContext=options.baselineContext??context;
 if(!Array.isArray(components)||components.length>32||baselineContext?.schema!==CONTEXT_SCHEMA||baselineContext.measured!==context.measured)throw Error('Bounded components and unchanged original baseline source required');
 const active=mode==='design'?components.filter(a=>a.enabled!==false):[],selected=mode==='baseline'?baselineContext:context;
 if(new Set(active.map(a=>a.instanceId)).size!==active.length)throw Error('Aperture instance identities must be unique');
 const masks=mode==='design'?(options.sourceMasks??binding?.sourceMasks??[]).filter(m=>m.enabled!==false).map(m=>maskSpec(m,context,active)):[];
 if(masks.length>32)throw Error('Finite source mask budget exceeded');
 let bounds=clone(selected.bounds),fullBounds=clone(selected.fullBounds);for(const c of active){if(!c.bounds||!finite(c.bounds.min,3)||!finite(c.bounds.max,3))throw Error('Derived aperture finite bounds required');bounds=union(bounds,c.bounds);fullBounds=union(fullBounds,c.bounds);}
 return {...selected,schema:HOSTED_SCENE_SCHEMA,fieldKind:'hosted-context',context:selected,baselineContext,mode,apertures:active,components:active,sourceMasks:masks,bounds,fullBounds,sourceBinding:selected.assembly.sourceBinding??selected.sourceBinding,fitReport:selected.assembly.fitReport??selected.fitReport,sourceViewUnchanged:true,sourceGeometryChanged:false,sourceTransformApplied:false,designSourceMaskApplied:mode==='design'&&masks.length>0,counts:{...selected.counts,apertures:active.length,sourceMasks:masks.length,modelTriangles:0,modelVertexBuffers:0},distanceContract:{...selected.distanceContract,kind:'union_of_masked_unsigned_source_and_authored_finite_fields',sourceMaskField:'conservative_lower_bound_correct_restricted_zero_set_not_exact_clipped_distance',sourceMaskScope:'selected_source_patch_identity_and_finite_rounded_rectangle_extrusion_only',boundaryIdentity:{toleranceMetres:HOSTED_IDENTITY_TIE_METRES,policy:'lowest_stable_ID_within_tolerance_of_final_minimum_never_chained',scalarDistanceUnchanged:true,nearestRayParameterUnchanged:true,sourceBurial:'both_source_normal_neighbours_inside_authored_union'},certifiedSDF:false,lipschitzUpperBound:1,rayMethod:'finite_source_BVH_candidates_plus_hosted_analytic_domains',stepBudgetRequired:false},opticalContract:{model:'bounded_single_pane_two_interface_refraction',interfaces:'finite_analytic_pane_entry_and_exit',absorption:'Beer_Lambert_from_actual_internal_path_metres',reflection:'sky_environment_approximation_not_scene_reflection',secondary:'one_actual_scene_ray_then_opaque_terminal_shading',multiplePanes:'second_pane_is_terminal_tinted_surface_not_recursive_transmission',totalInternalReflection:'sky_only_reflection_approximation_no_internal_bounce',failure:'explicit_optical_failure_color_not_fabricated_transmission',caustics:false}};
}
/** SDF of an exact finite rounded-rectangle extrusion, in source metres. */
export function hostedMaskDistance(mask,p){const q=sub(p,mask.frame.origin),x=dot(q,mask.frame.u),y=dot(q,mask.frame.v),z=dot(q,mask.frame.w),r=mask.roundRadius,a=Math.abs(x)-mask.width/2+r,b=Math.abs(y)-mask.height/2+r,d=Math.hypot(Math.max(a,0),Math.max(b,0))+Math.min(Math.max(a,b),0)-r,e=Math.abs(z)-mask.halfDepth;return Math.hypot(Math.max(d,0),Math.max(e,0))+Math.min(Math.max(d,e),0);}
export function hostedSourceMaskContains(spec,patch,p){valid(spec,p);const id=typeof patch==='object'?patch.objectId:patch;return spec.sourceMasks.some(m=>m.sourceObjectId===id&&hostedMaskDistance(m,p)<0);}
function sourceDistance(s,patch,p,d){for(const m of s.sourceMasks)if(m.sourceObjectId===patch.objectId)d=Math.max(d,-hostedMaskDistance(m,p));return d;}
function domain(s,p){const d=s.sourceDisplay;return Math.max(d.heightRange[0]-p[1],p[1]-d.heightRange[1],d.cutPlane.offset-dot(d.cutPlane.normal,p));}
/** Central identity arbitration. Every candidate is compared with the FINAL
 * scalar minimum, never the previous winner (which permits epsilon chains).
 * Identity tolerance NEVER changes scalar distance, sign or nearest ray t.
 */
export function selectHostedIdentity(candidates,metric='distance'){
 if(!['distance','t'].includes(metric)||!Array.isArray(candidates)||!candidates.length)throw Error('Nonempty hosted candidates and distance/t metric required');
 const minimum=Math.min(...candidates.map(h=>h[metric]));let identity=null;
 for(const h of candidates)if(h[metric]<=minimum+HOSTED_IDENTITY_TIE_METRES&&h.objectId>0&&(!identity||h.objectId<identity.objectId))identity=h;
 if(!identity||!Number.isFinite(minimum))throw Error('Finite hosted candidate values and stable positive IDs required');
 return{minimum,identity};
}
function choose(hits){const{minimum,identity}=selectHostedIdentity(hits);return {...identity,distance:minimum,inside:minimum<0?true:identity.inside};}

export function queryHostedScene(spec,p,{display=false}={}){
 valid(spec,p);if(typeof display!=='boolean')throw Error('display must be boolean');if(spec.mode==='baseline')return queryContext(spec.context,p,{display});
 const a=queryCase(spec.measured,p,{distanceModifier:(patch,q,d)=>sourceDistance(spec,patch,q,d)}),b=queryAssembly(spec.assembly,sourceToAssemblyLocal(spec.assembly,p));if(display)a.distance=Math.max(a.distance,domain(spec,p));
 const hits=[{...a,component:'source',coordinateFrame:'source-local'},{...b,component:'assembly',coordinateFrame:'diagram-local'}];if(spec.apertures.length){const c=queryApertures(spec.apertures,p);if(c.objectId>0)hits.push({...c,component:'aperture',coordinateFrame:'aperture-material-local'});}
 return {...choose(hits),sourceModelId:spec.sourceModelId,queryScope:display?'design_display_lower_bound':'design_full_lower_bound',sourceOccupancy:null,designInside:b.inside};
}
export function hostedNormal(spec,p,options={}){valid(spec,p);if(spec.mode==='baseline')return contextNormal(spec.context,p,options);const h=queryHostedScene(spec,p,options);if(h.component==='source')return clone(h.normal);if(h.component==='assembly')return rotate(spec,assemblyNormal(spec.assembly,h.local));if(h.normal)return clone(h.normal);const e=1e-6,g=[0,1,2].map(i=>{const a=[...p],b=[...p];a[i]+=e;b[i]-=e;return queryApertures(spec.apertures,a).distance-queryApertures(spec.apertures,b).distance;});return len(g)>1e-12?unit(g):[0,1,0];}
export function hostedMaterialDirection(spec,hit,direction){valid(spec);if(!finite(direction,3))throw Error('Finite material direction required');if(hit.objectId<4000)return contextMaterialDirection(spec.context,hit,direction);const component=spec.apertures.find(a=>Math.floor((hit.objectId-4000)/8)===a.instanceId);if(!component)throw Error('Unknown hosted aperture identity');return apertureMaterialDirection(component,hit.objectId,direction);}
/** A source face is buried only when BOTH normal-side neighbours are inside.
 * Exact coincident boundary points can be +/- a few ulps from an authored side.
 * This uses cheap occupancy, not a full material/distance query per source face.
 */
function sourceBuried(spec,patch,p){const q=sourceToAssemblyLocal(spec.assembly,p),n=rotate(spec,patch.normal??patch.n,true),offset=mul(n,HOSTED_IDENTITY_TIE_METRES);return queryAssemblyInside(spec.assembly,add(q,offset))&&queryAssemblyInside(spec.assembly,sub(q,offset));}
export function intersectHostedSceneRay(spec,origin,direction,{maxDistance=10000,display=true,accelerated=true,skipGlass=false,skipObjectId=0,minDistance=0}={}){
 valid(spec,origin);if(!finite(direction,3)||len(direction)<1e-12||!Number.isFinite(maxDistance)||maxDistance<=0||typeof display!=='boolean'||!Number.isFinite(minDistance)||minDistance<0)throw Error('Valid hosted ray and finite positive range required');
 if(spec.mode==='baseline')return intersectContextRay(spec.context,origin,direction,{maxDistance,display,accelerated});
 const rd=unit(direction),source=intersectCaseRay(spec.measured,origin,rd,{maxDistance,accelerated,acceptCandidate:(patch,p,t)=>t>=minDistance&&(!display||domain(spec,p)<=1e-9)&&!hostedSourceMaskContains(spec,patch,p)&&!sourceBuried(spec,patch,p)}),design=intersectAssemblyRay(spec.assembly,sourceToAssemblyLocal(spec.assembly,origin),rotate(spec,rd,true),{maxDistance}),aperture=spec.apertures.length?intersectAperturesRay(spec.apertures,origin,rd,{maxDistance,skipGlass,skipObjectId,minDistance}):{hit:false};
 const candidates=[];if(source.hit)candidates.push({...source,component:'source',coordinateFrame:'source-local'});if(design.hit&&design.t>=minDistance)candidates.push({...design,normal:rotate(spec,design.normal),point:add(origin,mul(rd,design.t)),component:'assembly',coordinateFrame:'diagram-local'});if(aperture.hit)candidates.push({...aperture,component:'aperture',coordinateFrame:'aperture-material-local'});
 const selection=candidates.length?selectHostedIdentity(candidates,'t'):null,nearestT=selection?.minimum??Infinity,representative=selection?.identity;
 if(representative){const point=add(origin,mul(rd,nearestT)),delta=sub(point,representative.point);representative.local=representative.component==='source'?clone(point):representative.component==='assembly'?sourceToAssemblyLocal(spec.assembly,point):add(representative.local,hostedMaterialDirection(spec,representative,delta));representative.point=point;representative.t=nearestT;representative.distance=0;}
 const stats={patchTests:source.patchTests??0,nodeVisits:source.nodeVisits??0,planeTests:design.planeTests??0,apertureTests:aperture.primitiveTests??aperture.candidateTests??0,method:'finite_source_candidate_filter_and_analytic_hosted_domains'};
 return representative?{...representative,hit:true,status:representative.status??'hit',sourceModelId:spec.sourceModelId,...stats}:{hit:false,status:'miss',...stats};
}
const f=n=>{if(!Number.isFinite(n))throw Error('Finite hosted GLSL number required');return Number(n).toFixed(12).replace(/0+$/,'').replace(/\.$/,'.0');},v=a=>`vec${a.length}(${a.map(f).join(',')})`;
const STRUCT='struct FieldHit{float distance;float objectId;float materialRole;vec3 local;};';
function namespace(code,prefix,all=true){if(typeof code!=='string')code=code.source;if(code.split(STRUCT).length!==2)throw Error('Unexpected child FieldHit contract');return code.replace(STRUCT,'').replace(all?/\b(?:case[A-Za-z0-9_]+|assembly[A-Za-z0-9_]+|mapField|mapDistance|fieldNormal|fieldRayNormal)\b/g:/\b(?:mapField|mapDistance|fieldNormal|fieldRayNormal|caseTraceRay)\b/g,name=>prefix+name);}
export function buildHostedSceneGLSL(spec){
 valid(spec);if(spec.mode==='baseline')return buildContextGLSL(spec.context)+`\nvec3 hostedMaterialDirection(FieldHit h,vec3 d){return contextMaterialDirection(h,d);}\nbool hostedTraceRayFiltered(vec3 ro,vec3 rd,float skipObjectId,out float t,out FieldHit h,out int visits){return caseTraceRay(ro,rd,t,h,visits);}\nbool apertureGlassExit(float id,vec3 ro,vec3 rd,out float pathLength,out vec3 exitNormal,out vec3 exitPoint){pathLength=0.0;exitNormal=vec3(0,1,0);exitPoint=ro;return false;}\n`;
 const a=spec.alignmentTransform,c=Math.cos(a.yawRadians),s=Math.sin(a.yawRadians),d=spec.sourceDisplay;
 const masks=spec.sourceMasks.map((m,i)=>`float hostedMask${i}(vec3 p){vec3 q=p-${v(m.frame.origin)};vec2 xy=vec2(dot(q,${v(m.frame.u)}),dot(q,${v(m.frame.v)}));vec2 edge=abs(xy)-${v([m.width/2-m.roundRadius,m.height/2-m.roundRadius])};float planar=length(max(edge,0.0))+min(max(edge.x,edge.y),0.0)-${f(m.roundRadius)};vec2 e=vec2(planar,abs(dot(q,${v(m.frame.w)}))-${f(m.halfDepth)});return length(max(e,0.0))+min(max(e.x,e.y),0.0);}`).join('\n');
 return `${STRUCT}
${namespace(buildAssemblyGLSL(spec.assembly),'contextDesign_')}
${namespace(buildAperturesGLSL(spec.apertures),'hostedAperture_',false)}
vec3 contextRotate(vec3 p){return vec3(${f(c)}*p.x+${f(s)}*p.z,p.y,-(${f(s)})*p.x+${f(c)}*p.z);}
vec3 contextInverseRotate(vec3 p){return vec3(${f(c)}*p.x-(${f(s)})*p.z,p.y,${f(s)}*p.x+${f(c)}*p.z);}
vec3 contextDesignLocal(vec3 p){return contextInverseRotate(p-${v(a.translation)});}
vec3 contextMaterialDirection(FieldHit h,vec3 d){return h.objectId>=4000.0?apertureMaterialDirection(h.objectId,d):(h.objectId>=2000.0?contextInverseRotate(d):d);}
vec3 hostedMaterialDirection(FieldHit h,vec3 d){return contextMaterialDirection(h,d);}
float contextDisplayDomain(vec3 p){return max(max(${f(d.heightRange[0])}-p.y,p.y-(${f(d.heightRange[1])})),${f(d.cutPlane.offset)}-dot(${v(d.cutPlane.normal)},p));}
${masks}
vec3 contextSource_caseNormalForId(float objectId);
float hostedMaskSourceDistance(int k,vec3 p,float distance){${spec.sourceMasks.map((m,i)=>`if(k==${m.sourceObjectId-1000})distance=max(distance,-hostedMask${i}(p));`).join('')}return distance;}
bool hostedAcceptSourceCandidate(int k,vec3 p){${spec.sourceMasks.map((m,i)=>`if(k==${m.sourceObjectId-1000}&&hostedMask${i}(p)<0.0)return false;`).join('')}vec3 q=contextDesignLocal(p),offset=contextInverseRotate(contextSource_caseNormalForId(float(k+1000)))*${f(HOSTED_IDENTITY_TIE_METRES)};return !(contextDesign_assemblyUnionInside(q+offset)&&contextDesign_assemblyUnionInside(q-offset));}
${namespace(buildCaseGLSL(spec.measured,{distanceHook:'hostedMaskSourceDistance',candidateHook:'hostedAcceptSourceCandidate'}),'contextSource_')}
const float hostedIdentityTolerance=${f(HOSTED_IDENTITY_TIE_METRES)};
bool hostedIdentityCandidate(float value,float minimum,float identity,float owner){return value<=minimum+hostedIdentityTolerance&&identity>0.0&&(owner==0.0||identity<owner);}
FieldHit hostedMap(vec3 p,bool display){FieldHit a=contextSource_mapField(p),b=contextDesign_mapField(contextDesignLocal(p)),c=hostedAperture_mapField(p);if(display)a.distance=max(a.distance,contextDisplayDomain(p));float d=min(a.distance,min(b.distance,c.distance));FieldHit h=FieldHit(d,0.0,0.0,p);if(hostedIdentityCandidate(a.distance,d,a.objectId,h.objectId))h=a;if(hostedIdentityCandidate(b.distance,d,b.objectId,h.objectId))h=b;if(hostedIdentityCandidate(c.distance,d,c.objectId,h.objectId))h=c;h.distance=d;return h;}
FieldHit mapField(vec3 p){return hostedMap(p,false);}float mapDistance(vec3 p){return mapField(p).distance;}
FieldHit displayMapField(vec3 p){return hostedMap(p,true);}float displayMapDistance(vec3 p){return displayMapField(p).distance;}
vec3 fieldNormal(vec3 p){FieldHit h=mapField(p);return h.objectId<2000.0?contextSource_caseNormalForId(h.objectId):(h.objectId<4000.0?contextRotate(contextDesign_fieldNormal(h.local)):hostedAperture_fieldNormal(p));}
vec3 fieldRayNormal=vec3(0,1,0);
bool hostedSourceInterval(vec3 ro,vec3 rd,bool display,out float lo,out float hi){lo=0.0;hi=1e20;vec3 low=${v(spec.measured.bounds.min)},high=${v(spec.measured.bounds.max)};if(display){low.y=max(low.y,${f(d.heightRange[0])});high.y=min(high.y,${f(d.heightRange[1])});}for(int axis=0;axis<3;axis++){if(abs(rd[axis])<1e-12){if(ro[axis]<low[axis]||ro[axis]>high[axis])return false;}else{float x=(low[axis]-ro[axis])/rd[axis],y=(high[axis]-ro[axis])/rd[axis];lo=max(lo,min(x,y));hi=min(hi,max(x,y));if(hi<lo)return false;}}if(display){float q=dot(${v(d.cutPlane.normal)},ro)-(${f(d.cutPlane.offset)}),t=dot(${v(d.cutPlane.normal)},rd);if(abs(t)<1e-12){if(q<0.0)return false;}else{float r=-q/t;if(t>0.0)lo=max(lo,r);else hi=min(hi,r);}}return hi>=lo;}
bool hostedTraceRay(vec3 ro,vec3 rd,bool display,float skipObjectId,out float t,out FieldHit h,out int visits){float sourceT=1e20,designT=1e20,apertureT=1e20,lo,hi;FieldHit hs,hd,ha;int vs=0,vd=0,va=0;bool fs=false;vec3 nd,na;
 if(hostedSourceInterval(ro,rd,display,lo,hi)){fs=contextSource_caseTraceRay(ro+rd*lo,rd,sourceT,hs,vs);sourceT+=lo;if(sourceT>hi)fs=false;}
 bool fd=contextDesign_caseTraceRay(contextDesignLocal(ro),contextInverseRotate(rd),designT,hd,vd);nd=contextRotate(contextDesign_fieldRayNormal);
 bool fa=apertureTraceRayFiltered(ro,rd,false,skipObjectId,apertureT,ha,va);na=hostedAperture_fieldRayNormal;
 visits=vs+vd+va;t=min(fs?sourceT:1e20,min(fd?designT:1e20,fa?apertureT:1e20));h=FieldHit(1e20,0.0,0.0,ro);fieldRayNormal=vec3(0,1,0);
 // Preserve the nearest geometric t. Only the boundary identity is stabilized.
 if(fs&&hostedIdentityCandidate(sourceT,t,hs.objectId,h.objectId)){h=hs;h.local=ro+rd*t;fieldRayNormal=contextSource_caseNormalForId(hs.objectId);}
 if(fd&&hostedIdentityCandidate(designT,t,hd.objectId,h.objectId)){h=hd;h.local=contextDesignLocal(ro+rd*t);fieldRayNormal=nd;}
 if(fa&&hostedIdentityCandidate(apertureT,t,ha.objectId,h.objectId)){h=ha;h.local+=apertureMaterialDirection(h.objectId,rd*(t-apertureT));fieldRayNormal=na;}h.distance=0.0;return fs||fd||fa;}
bool caseTraceRay(vec3 ro,vec3 rd,out float t,out FieldHit h,out int visits){return hostedTraceRay(ro,rd,true,0.0,t,h,visits);}
bool hostedTraceRayFiltered(vec3 ro,vec3 rd,float skipObjectId,out float t,out FieldHit h,out int visits){return hostedTraceRay(ro,rd,true,skipObjectId,t,h,visits);}
bool contextTraceRayFull(vec3 ro,vec3 rd,out float t,out FieldHit h,out int visits){return hostedTraceRay(ro,rd,false,0.0,t,h,visits);}
`;
}

/** CPU reference for the renderer's explicitly single-pane bounded optics.
 * The returned scene ray is real; no alpha-blended rectangle proxy is used.
 */
export function traceHostedTransmission(spec,origin,direction,parameters={}){
 valid(spec,origin);const material=adaptHostedMaterialParameters(parameters),rd=unit(direction),hit=intersectHostedSceneRay(spec,origin,rd);
 if(!hit.hit||hit.materialRole!==6)return{status:'not_glass',hit,model:spec.opticalContract};
 const refract=(d,n,eta)=>{const c=dot(n,d),k=1-eta*eta*(1-c*c);return k<0?null:sub(mul(d,eta),mul(n,eta*c+Math.sqrt(k)));};
 const startsInside=dot(rd,hit.normal)>0,facing=startsInside?mul(hit.normal,-1):hit.normal;
 const entryF=startsInside?0:dielectricFresnel(dot(mul(rd,-1),facing),material.glassIOR),internalDirection=startsInside?rd:refract(rd,facing,1/material.glassIOR);
 if(!internalDirection)return{status:'total_internal_reflection',hit,reflection:'sky_only_approximation'};
 const interval=startsInside?{hit:true,pathLength:hit.t,exitPoint:hit.point,exitNormal:hit.normal}:apertureGlassInterval(spec.apertures,hit.objectId,hit.point,internalDirection);
 if(!interval.hit)return{status:'optical_path_unresolved',hit,reason:interval.status,transmissionFabricated:false};
 const exitF=dielectricFresnel(dot(internalDirection,interval.exitNormal),material.glassIOR),transmitted=refract(internalDirection,mul(interval.exitNormal,-1),material.glassIOR);
 if(!transmitted)return{status:'total_internal_reflection',hit,startsInside,entryFresnel:entryF,exitFresnel:exitF,pathLength:interval.pathLength,exitPoint:interval.exitPoint,exitNormal:interval.exitNormal,transmittedDirection:[0,0,0],transmittance:[0,0,0],nextHit:{hit:false},reflection:'sky_only_approximation'};
 const originAfter=add(interval.exitPoint,mul(transmitted,.00003)),nextHit=intersectHostedSceneRay(spec,originAfter,transmitted,{skipObjectId:hit.objectId}),energy=(1-entryF)*(1-exitF);
 return{status:'transmitted',hit,startsInside,entryFresnel:entryF,exitFresnel:exitF,pathLength:interval.pathLength,exitPoint:interval.exitPoint,exitNormal:interval.exitNormal,transmittedDirection:transmitted,transmittance:glassAbsorptionTransmittance(interval.pathLength,material).map(x=>x*energy),nextHit,reflection:'sky_environment_approximation',additionalPanes:'terminal_surface_not_recursively_transmitted'};
}

/** Four deterministic rays for the REAL first pane, in its current moving frame.
 * Origins/directions are Float32-rounded before both CPU and GPU evaluation.
 * These probe normal entry, oblique entry, an inside camera and the visible glass edge next to the opaque sash.
 * They do not manufacture a background object or alter the source-bound scene.
 */
export function hostedOpticalProbeRays(spec,{glassObjectId=null}={}){
 valid(spec);const pane=spec.apertures.flatMap(a=>a.primitives).find(p=>p.materialRole===6&&(glassObjectId===null||p.objectId===glassObjectId));if(!pane)return[];
 const toWorld=q=>add(pane.origin,add(mul(pane.u,q[0]),add(mul(pane.v,q[1]),mul(pane.w,q[2])))),toDirection=q=>unit(add(mul(pane.u,q[0]),add(mul(pane.v,q[1]),mul(pane.w,q[2]))));
 const sash=spec.apertures.flatMap(a=>a.primitives).find(p=>p.instanceId===pane.instanceId&&p.materialRole===5&&p.inner);
 const cx=pane.outer.center[0],cy=pane.outer.center[1],front=pane.halfDepth,margin=Math.min(pane.halfDepth*.2,pane.outer.half[0]*.01),edge=(sash?sash.inner.half[0]:pane.outer.half[0])-margin;
 const fixed=[{name:'normal_6mm_or_current_thickness',target:[cx,cy,front],direction:[0,0,-1],approach:.12},{name:'oblique_6mm_or_current_thickness',target:[cx+.013,cy+.017,front],direction:unit([.32,.08,-1]),approach:.12},{name:'inside_pane_camera',origin:[cx,cy,0],direction:unit([.1,0,-1])},{name:'visible_glass_edge_to_sash',target:[cx+edge,cy,front],direction:unit([.6,0,-1]),approach:.03}];
 return fixed.map(x=>{const origin=x.origin??sub(x.target,mul(x.direction,x.approach));return{name:x.name,glassObjectId:pane.objectId,glassThickness:2*pane.halfDepth,origin:toWorld(origin).map(Math.fround),direction:toDirection(x.direction).map(Math.fround)};});
}
