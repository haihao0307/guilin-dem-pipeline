/**
 * R06 original measured-surface field adapter.
 * Preserves every source plane/profile boundary including holes; never imports
 * or builds the former render triangulation. This is an unsigned surface field,
 * NOT a claim that the incomplete measured shell encloses a surveyed interior.
 * Numerical boundary coordinates and BVH bounds are query data, not draw buffers.
 */
export const CASE_SCHEMA='kaopu.measured-surface-field/0.1';
export const CASE_SOURCE_COMMIT='b74929fc9f1c81eaa7e4b529a6bd5361024b035b';
export const CASE_PROFILES=Object.freeze({
 B367642137201063C0:{label:'喇沙利道33號',englishLabel:'33 La Salle Road',use:'low-rise residential',part:'existing low-rise model',storeys:{officialPart:2,wholeBuilding:2},sourceClassification:'complex-low-rise',interiorPlan:'not_acquired',sourceLedger:'sources/33-lasalle-evidence.json',knownRelations:['two_storeys','shared_31_33_front_gate_photo'],unresolved:['interior_stair','lift_presence','rear_or_service_entry','window_operation','frame_depth']},
 B359971994401063C0:{label:'龍總大廈 · 上部塔樓',englishLabel:'K.C.C. Building · tower component',use:'mixed residential / chamber complex',part:'tower_component_not_ground_podium',storeys:{officialPart:24,ownerWholeBuilding:28,separatePodium:4,separatePodiumBasement:1,additionPermitted:false},sourceClassification:'wing-plan-tower',interiorPlan:'public_unscaled_plan_for_5_to_17_and_18_to_26',sourceLedger:'sources/kcc-evidence.json',knownRelations:['six_units_A_to_F_in_plan','three_lifts_in_plan','central_stair_and_lift_lobby','tower_podium_separate'],unresolved:['exact_floor_FFL','actual_stair_dimensions','ground_residential_entry','rear_or_service_entry','window_depth']},
 B369121858401063C0:{label:'香港中旅協記貨倉有限公司第二倉 · 上部',englishLabel:'China Travel Hip Kee Godown No.2 · upper component',use:'warehouse',part:'upper_component_not_complete_ground_to_roof_building',storeys:{officialPart:12,separatePodium:2,separatePodiumBasement:2,additionPermitted:false},sourceClassification:'broad-sloped-roof',correctedRoofInterpretation:'source_roof_planes_are_horizontal_not_sloped',interiorPlan:'not_acquired',sourceLedger:'sources/warehouse-evidence.json',knownRelations:['upper_and_podium_components_separate','historical_vehicle_and_people_entries_distinct'],unresolved:['exact_whole_floor_count','actual_core_locations','internal_plan','freight_lift_count_verified','window_frame_depth']}
});
const clone=x=>structuredClone(x),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,n)=>a.map(x=>x*n),len=a=>Math.hypot(...a);
const normal=a=>{const n=len(a);if(n<1e-12)throw Error('Degenerate source plane');return mul(a,1/n);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const finiteArray=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite);
const toDisplay=p=>[p[0],p[2],-p[1]];
function validateScore(score){
 if(score?.adapter!=='kaopu.hk.measured-plane-boundary/0.1-research'||score.units!=='metre'||score.reconstruction?.generator!=='hk-measured-boundary'||score.reconstruction?.version!=='0.1.0')throw Error('Unsupported measured source recipe');
 if(!CASE_PROFILES[score.objectId])throw Error('Only the three identified source cases are supported');
 if(['scaleEast','scaleNorth','scaleHeight'].some(k=>(score.edits?.[k]??1)!==1))throw Error('Measured mode preserves original source scale; authored deformation is a separate design');
 if(!Array.isArray(score.reconstruction.operations)||!score.reconstruction.operations.length||score.reconstruction.operations.length>512)throw Error('Measured patch budget is1..512');
 const ids=new Set();for(const op of score.reconstruction.operations){if(typeof op.id!=='string'||ids.has(op.id))throw Error('Unique stable patch IDs required');ids.add(op.id);if(!['wallStrip','wallProfile','roofPlane','undersidePlane'].includes(op.kind))throw Error('Unsupported source patch: '+op.kind);
  if(op.kind==='wallStrip'){if(!Array.isArray(op.edge)||op.edge.length!==2||op.edge.some(p=>!finiteArray(p,2))||!Number.isFinite(op.bottom)||!Number.isFinite(op.top)||op.top<=op.bottom)throw Error('Invalid source wall strip');}
  else{if(!Array.isArray(op.loops)||!op.loops.length||op.loops.some(l=>!Array.isArray(l)||l.length<3||l.some(p=>!finiteArray(p,2))))throw Error('Invalid measured source boundary');
   if(op.kind==='wallProfile'){if(['origin','tangent','horizontalDriftPerHeight'].some(k=>!finiteArray(op[k],2)))throw Error('Invalid source profile frame');}
   else if(!finiteArray(op.heightPlane,3))throw Error('Invalid source height plane');}
 }
}
function operationFrame(op){
 if(op.kind==='wallStrip'){
  const [a,b]=op.edge,d=sub(b,a),L=len(d);if(L<1e-10)throw Error('Zero length wall');
  return {loops:[[[0,op.bottom],[L,op.bottom],[L,op.top],[0,op.top]]],map:q=>[a[0]+d[0]*q[0]/L,q[1],-(a[1]+d[1]*q[0]/L)],origin:[a[0],0,-a[1]],u:[d[0]/L,0,-d[1]/L],n:normal([d[1],0,d[0]])};
 }
 if(op.kind==='wallProfile'){
  const a=op.origin,t=op.tangent,d=op.horizontalDriftPerHeight,u=normal([t[0],0,-t[1]]),n=normal(cross(u,[d[0],1,-d[1]]));
  return {loops:op.loops,map:q=>[a[0]+t[0]*q[0]+d[0]*q[1],q[1],-(a[1]+t[1]*q[0]+d[1]*q[1])],origin:[a[0],0,-a[1]],u,n};
 }
 const[a,b,c]=op.heightPlane,u=normal([1,a,0]),n=mul(normal([-a,1,b]),op.kind==='undersidePlane'?-1:1);
 return{loops:op.loops,map:q=>[q[0],a*q[0]+b*q[1]+c,-q[1]],origin:[0,c,0],u,n};
}
function patchFromOperation(op,index){
 const f=operationFrame(op),v=normal(cross(f.n,f.u));
 const loops=f.loops.map(l=>l.map(q=>{const p=f.map(q),r=sub(p,f.origin);if(Math.abs(dot(r,f.n))>1e-7)throw Error('Source patch is not planar: '+op.id);return [dot(r,f.u),dot(r,v)];}));
 const controls=f.loops.flat().map(f.map),bounds={min:[0,1,2].map(i=>Math.min(...controls.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...controls.map(p=>p[i])))};
 return {sourcePatchId:op.id,sourceKind:op.kind,objectId:1000+index,materialRole:op.kind.startsWith('wall')?2:1,
  origin:f.origin,u:f.u,v,n:f.n,loops,bounds,sourceBoundaryCount:controls.length,sourceHoleCount:loops.length-1,
  geometryEvidence:'observed_derived_source_surface',materialEvidence:'authored_material_role_not_measured_finish',insideSemantic:'undefined_for_unsigned_surface'};
}
function unionBounds(items){return{min:[0,1,2].map(i=>Math.min(...items.map(x=>x.bounds.min[i]))),max:[0,1,2].map(i=>Math.max(...items.map(x=>x.bounds.max[i]))) };}
function buildBVH(patches){const nodes=[];function visit(indices){const bounds=unionBounds(indices.map(i=>patches[i])),id=nodes.length,node={...bounds,patchIndex:-1,skip:-1};nodes.push(node);
 if(indices.length===1)node.patchIndex=indices[0];else{const spreads=[0,1,2].map(a=>Math.max(...indices.map(i=>(patches[i].bounds.min[a]+patches[i].bounds.max[a])/2))-Math.min(...indices.map(i=>(patches[i].bounds.min[a]+patches[i].bounds.max[a])/2))),axis=spreads.indexOf(Math.max(...spreads));indices.sort((a,b)=>(patches[a].bounds.min[axis]+patches[a].bounds.max[axis])-(patches[b].bounds.min[axis]+patches[b].bounds.max[axis]));const m=Math.floor(indices.length/2);visit(indices.slice(0,m));visit(indices.slice(m));}
 node.skip=nodes.length;return id;}visit(patches.map((_,i)=>i));return nodes;}
export function deriveMeasuredCase(score,options={}){
 validateScore(score);if(Object.keys(options).some(k=>!['materialOverride'].includes(k)))throw Error('Unknown measured-case option');
 if(options.materialOverride!==undefined&&![1,2,3].includes(options.materialOverride))throw Error('Material role must be1..3');
 const patches=score.reconstruction.operations.map(patchFromOperation);if(options.materialOverride!==undefined)for(const p of patches)p.materialRole=options.materialOverride;
 const rawBounds=unionBounds(patches),bounds={min:rawBounds.min.map(x=>x-.0001),max:rawBounds.max.map(x=>x+.0001)},nodes=buildBVH(patches),profile=clone(CASE_PROFILES[score.objectId]);
 return{schema:CASE_SCHEMA,fieldKind:'measured-surface',sourceModelId:score.objectId,sourceCommit:CASE_SOURCE_COMMIT,
  sourcePath:`kaopu-geography-workbench/hk-three-buildings-r01/geometry/${score.objectId}.score.json`,sourceGeoreference:clone(score.georeference),sourceEvidence:clone(score.evidence),profile,
  coordinateSystem:'source_local_east_up_south_metres',patches,nodes,bounds,sourceBounds:rawBounds,
  counts:{patches:patches.length,boundaryCoordinates:patches.reduce((n,p)=>n+p.sourceBoundaryCount,0),holes:patches.reduce((n,p)=>n+p.sourceHoleCount,0),bvhNodes:nodes.length,modelTriangles:0,modelVertexBuffers:0},
  sourceRoleCounts:patches.reduce((a,p)=>(a[p.sourceKind]=(a[p.sourceKind]??0)+1,a),{}),
  distanceContract:{kind:'exact_unsigned_distance_to_finite_source_surface_union',lipschitzUpperBound:1,occupancy:'undefined_no_invented_closed_volume',raySafetyFactor:.85,minimumPositiveStep:0,hitRule:'field_distance_tolerance_measures_euclidean_distance_to_the_source_surface'},
  reconstruction:{allSourcePatchesRetained:true,interiorGenerated:false,wallThicknessAdded:false,groundClosureAdded:false,roofReclassifiedWithoutChangingShape:score.objectId==='B369121858401063C0',unsupportedPatches:[]}};
}
function closestSegment(p,a,b){const d=sub(b,a),den=dot(d,d);if(den<=1e-24)return len(sub(p,a));const t=Math.max(0,Math.min(1,dot(sub(p,a),d)/den));return len(sub(p,add(a,mul(d,t))));}
function insideLoop(p,loop){let inside=false;for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[j],b=loop[i];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
/** Exact unsigned point-to-finite-plane-polygon distance, including holes. */
export function patchDistance(patch,p){const q=sub(p,patch.origin),uv=[dot(q,patch.u),dot(q,patch.v)],plane=dot(q,patch.n);let edge=Infinity;for(const loop of patch.loops)for(let i=0,j=loop.length-1;i<loop.length;j=i++)edge=Math.min(edge,closestSegment(uv,loop[j],loop[i]));const inside=insideLoop(uv,patch.loops[0])&&!patch.loops.slice(1).some(l=>insideLoop(uv,l));return Math.hypot(plane,inside?0:edge);}
const boundDistance=(p,b)=>Math.hypot(...p.map((v,i)=>Math.max(b.min[i]-v,0,v-b.max[i])));
export function queryCase(spec,p,{accelerated=true}={}){
 if(spec?.schema!==CASE_SCHEMA||!finiteArray(p,3))throw Error('Measured case and finite point required');let best=Infinity,index=-1,patchEvaluations=0,nodeVisits=0;
 const take=i=>{patchEvaluations++;const d=patchDistance(spec.patches[i],p);if(d<best-1e-10||(Math.abs(d-best)<=1e-10&&(index<0||i<index)))index=i;best=Math.min(best,d);};
 if(accelerated){let i=0;while(i<spec.nodes.length){const n=spec.nodes[i];nodeVisits++;if(boundDistance(p,n)>best+1e-10){i=n.skip;continue;}if(n.patchIndex>=0)take(n.patchIndex);i++;}}
 else for(let i=0;i<spec.patches.length;i++)take(i);
 const patch=spec.patches[index];return{distance:best,objectId:patch.objectId,materialRole:patch.materialRole,local:clone(p),inside:null,sourcePatchId:patch.sourcePatchId,sourceKind:patch.sourceKind,normal:clone(patch.n),patchEvaluations,nodeVisits};
}
export function caseNormal(spec,p){return queryCase(spec,p).normal;}
export function traceCase(spec,origin,direction,{maxSteps=256,maxDistance=500,epsilon=.0005,safety=.85}={}){
 if(!finiteArray(origin,3)||!finiteArray(direction,3)||len(direction)<1e-12||safety<=0||safety>1)throw Error('Valid ray and conservative safety required');const rd=normal(direction);let t=0;
 for(let i=0;i<maxSteps;i++){const p=add(origin,mul(rd,t)),h=queryCase(spec,p);if(h.distance<=epsilon)return{...h,hit:true,status:'hit',point:p,t,steps:i+1};t+=h.distance*safety;if(t>maxDistance)return{hit:false,status:'range',t,steps:i+1};}return{hit:false,status:'unresolved',t,steps:maxSteps};
}
/** Exact ray intersection against the same finite source planes and boundary
 * predicates. Optional direct renderer path: no iterative distance budget. */
function rayBounds(origin,rd,best,bounds){let lo=0,hi=best;for(let a=0;a<3;a++){
 // Match the finite-boundary predicate tolerance conservatively. Exact thin
 // AABBs otherwise reject edge hits after the source frame round trip.
 const min=bounds.min[a]-1e-8,max=bounds.max[a]+1e-8;
 if(Math.abs(rd[a])<1e-12){if(origin[a]<min||origin[a]>max)return false;continue;}
 const x=(min-origin[a])/rd[a],y=(max-origin[a])/rd[a];lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));if(hi<lo)return false;}return true;}
function patchContains(patch,p){const q=sub(p,patch.origin),uv=[dot(q,patch.u),dot(q,patch.v)];if(insideLoop(uv,patch.loops[0])&&!patch.loops.slice(1).some(l=>insideLoop(uv,l)))return true;return patchDistance(patch,p)<=1e-8;}
export function intersectCaseRay(spec,origin,direction,{maxDistance=10000,accelerated=true}={}){
 if(spec?.schema!==CASE_SCHEMA||!finiteArray(origin,3)||!finiteArray(direction,3)||len(direction)<1e-12)throw Error('Measured case and valid ray required');const rd=normal(direction);let t=maxDistance,index=-1,nodeVisits=0,patchTests=0;
 const test=k=>{patchTests++;const patch=spec.patches[k],den=dot(rd,patch.n);if(Math.abs(den)<1e-12)return;const d=dot(sub(patch.origin,origin),patch.n)/den;if(d<0||d>t)return;const p=add(origin,mul(rd,d));if(patchContains(patch,p)&&(d<t||(d===t&&(index<0||k<index)))){t=d;index=k;}};
 if(accelerated){let i=0;while(i<spec.nodes.length){const n=spec.nodes[i];nodeVisits++;if(!rayBounds(origin,rd,t,n)){i=n.skip;continue;}if(n.patchIndex>=0)test(n.patchIndex);i++;}}
 else for(let i=0;i<spec.patches.length;i++)test(i);
 if(index<0)return{hit:false,status:'miss',patchTests,nodeVisits,method:'analytic_plane_polygon_intersection'};
 const patch=spec.patches[index],point=add(origin,mul(rd,t));return{hit:true,status:'hit',distance:0,objectId:patch.objectId,materialRole:patch.materialRole,local:point,point,t,normal:clone(patch.n),sourcePatchId:patch.sourcePatchId,inside:null,patchTests,nodeVisits,method:'analytic_plane_polygon_intersection'};
}
const f=n=>{if(!Number.isFinite(n))throw Error('Non-finite field constant');return Number(n).toFixed(12).replace(/0+$/,'').replace(/\.$/,'.0');};
const vec=(a,n=a.length)=>`vec${n}(${a.map(f).join(',')})`;
const array=(type,name,items)=>`const ${type} ${name}[${items.length}]=${type}[${items.length}](${items.join(',')});`;
/** Emit a compact branch tree with literal plane/domain constants. Dynamic
 * indexing of large const arrays is very expensive on some WebGL2 drivers.
 * These are the SAME source plane equations and finite boundary predicates:
 * neither object geometry nor a surrogate closed-volume approximation.
 * Small bounded groups avoid duplicating all single-patch BVH bounds in GLSL. */
function buildStaticCaseRayGLSL(patches,nodes){
 const domainEpsilon=.00002;
 const loopEdges=loop=>loop.map((b,i)=>({a:loop[(i+loop.length-1)%loop.length],b}));
 const convexSign=loop=>{
  const edges=loopEdges(loop),area=edges.reduce((s,{a,b})=>s+a[0]*b[1]-b[0]*a[1],0),sign=Math.sign(area);
  // Check every boundary coordinate, not only adjacent turns. No simplification.
  return sign&&edges.every(({a,b})=>loop.every(p=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))>=0))?sign:0;
 };
 const domains=patches.map((patch,k)=>{
  const edges=patch.loops.map(loopEdges),predicates=patch.loops.map((loop,j)=>{
   const sign=convexSign(loop);
   if(sign)return `bool in${j}=${edges[j].map(({a,b})=>`(dot(uv-${vec(a)},${vec([sign*(a[1]-b[1]),sign*(b[0]-a[0])])})>=0.0)`).join('&&')};`;
   return `bool in${j}=false;`+edges[j].map(({a,b})=>`in${j}=in${j}!=caseRayCross(uv,${vec([...a,...b])});`).join('');
  }).join('\n');
  const inside=patch.loops.map((_,j)=>j?`!in${j}`:'in0').join('&&');
  return `bool caseRayDomain${k}(vec2 uv,float planeSquared){if(planeSquared>=${f(domainEpsilon**2)})return false;${predicates}\nif(${inside})return true;\nreturn ${edges.flat().map(({a,b})=>`caseRayEdgeSquared(uv,${vec([...a,...b])})+planeSquared<${f(domainEpsilon**2)}`).join('||')};}\n`+
   `void caseRayPatch${k}(vec3 ro,vec3 rd,inout float t,inout FieldHit h,inout int best){\nvec3 n=${vec(patch.n)},origin=${vec(patch.origin)};float den=dot(rd,n);if(abs(den)<1e-12)return;float candidate=dot(origin-ro,n)/den;if(candidate<0.0||candidate>t)return;\nvec3 p=ro+rd*candidate,q=p-origin;vec2 uv=vec2(dot(q,${vec(patch.u)}),dot(q,${vec(patch.v)}));float plane=dot(q,n);\nif(caseRayDomain${k}(uv,plane*plane)&&(candidate<t||(candidate==t&&(best<0||${k}<best)))){best=${k};t=candidate;h.distance=0.0;h.objectId=${f(1000+k)};h.materialRole=${f(patch.materialRole)};h.local=p;}}`;
 }).join('\n');
 const emit=i=>{
  const node=nodes[i],leaves=nodes.slice(i,node.skip).filter(n=>n.patchIndex>=0);
  const body=leaves.length<=4?leaves.map(n=>`caseRayPatch${n.patchIndex}(ro,rd,t,h,best);`).join('\n'):emit(i+1)+emit(nodes[i+1].skip);
  return `nodeVisits++;if(caseRayBoundsStatic(ro,inv,parallel,${vec(node.min)},${vec(node.max)},t)){\n${body}}\n`;
 };
 return `
// Exact polygon crossing and finite-edge distance; no sampled occupancy.
bool caseRayCross(vec2 p,vec4 ab){vec2 a=ab.xy,b=ab.zw;return ((a.y>p.y)!=(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x);}
float caseRayEdgeSquared(vec2 p,vec4 ab){vec2 a=ab.xy,d=ab.zw-a;float den=dot(d,d),s=den>1e-24?clamp(dot(p-a,d)/den,0.0,1.0):0.0;vec2 q=p-(a+d*s);return dot(q,q);}
bool caseRayBoundsStatic(vec3 ro,vec3 inv,bvec3 parallel,vec3 bmin,vec3 bmax,float best){
 // Padding is conservative query tolerance only, never a surface change.
 bmin-=vec3(0.00002);bmax+=vec3(0.00002);vec3 a=(bmin-ro)*inv,b=(bmax-ro)*inv,lo=min(a,b),hi=max(a,b);
 if(parallel.x){if(ro.x<bmin.x||ro.x>bmax.x)return false;lo.x=0.0;hi.x=1e20;}
 if(parallel.y){if(ro.y<bmin.y||ro.y>bmax.y)return false;lo.y=0.0;hi.y=1e20;}
 if(parallel.z){if(ro.z<bmin.z||ro.z>bmax.z)return false;lo.z=0.0;hi.z=1e20;}
 return max(0.0,max(lo.x,max(lo.y,lo.z)))<=min(best,min(hi.x,min(hi.y,hi.z)));}
${domains}
bool caseTraceRay(vec3 ro,vec3 rd,out float t,out FieldHit h,out int nodeVisits){
 t=1e20;h.distance=1e20;h.objectId=0.0;h.materialRole=0.0;h.local=ro;nodeVisits=0;int best=-1;
 bvec3 parallel=lessThan(abs(rd),vec3(1e-12));vec3 inv=1.0/vec3(parallel.x?1.0:rd.x,parallel.y?1.0:rd.y,parallel.z?1.0:rd.z);
 ${emit(0)}return best>=0;}
`;
}
/** One stackless BVH of analytic scalar bounds; no recursion, draw geometry,
 * triangle reconstruction, texture voxel storage or model vertex attributes. */
export function buildCaseGLSL(spec){
 if(spec?.schema!==CASE_SCHEMA)throw Error('deriveMeasuredCase result required');const patches=spec.patches,nodes=spec.nodes,segments=[],ranges=[];
 for(const p of patches){const start=segments.length;for(let loopId=0;loopId<p.loops.length;loopId++){const l=p.loops[loopId];for(let i=0,j=l.length-1;i<l.length;j=i++)segments.push({ab:[...l[j],...l[i]],hole:loopId>0?1:0});}ranges.push([start,segments.length-start]);}
 const maxEdges=Math.max(...ranges.map(r=>r[1]));
 return `
struct FieldHit{float distance;float objectId;float materialRole;vec3 local;};
${array('vec3','caseOrigins',patches.map(p=>vec(p.origin)))}
${array('vec3','caseU',patches.map(p=>vec(p.u)))}
${array('vec3','caseV',patches.map(p=>vec(p.v)))}
${array('vec3','caseN',patches.map(p=>vec(p.n)))}
${array('ivec2','caseRanges',ranges.map(r=>`ivec2(${r.join(',')})`))}
${array('float','caseRoles',patches.map(p=>f(p.materialRole)))}
${array('vec4','caseEdges',segments.map(s=>vec(s.ab)))}
${array('int','caseHole',segments.map(s=>String(s.hole)))}
${array('vec3','caseBVHMin',nodes.map(n=>vec(n.min)))}
${array('vec3','caseBVHMax',nodes.map(n=>vec(n.max)))}
${array('ivec2','caseBVHLinks',nodes.map(n=>`ivec2(${n.patchIndex},${n.skip})`))}
float casePatchDistance(int k,vec3 p){vec3 q=p-caseOrigins[k];vec2 uv=vec2(dot(q,caseU[k]),dot(q,caseV[k]));float plane=dot(q,caseN[k]),edge=1e20;bool outer=false,hole=false;
 for(int j=0;j<${maxEdges};j++){if(j>=caseRanges[k].y)break;int e=caseRanges[k].x+j;vec2 a=caseEdges[e].xy,b=caseEdges[e].zw,ab=b-a;float den=dot(ab,ab);float t=den>1e-24?clamp(dot(uv-a,ab)/den,0.0,1.0):0.0;edge=min(edge,length(uv-(a+ab*t)));
 if((a.y>uv.y)!=(b.y>uv.y)){if(uv.x<(b.x-a.x)*(uv.y-a.y)/(b.y-a.y)+a.x){if(caseHole[e]==0)outer=!outer;else hole=!hole;}}}
 return length(vec2(plane,outer&&!hole?0.0:edge));}
float caseBound(vec3 p,int i){return length(max(max(caseBVHMin[i]-p,p-caseBVHMax[i]),0.0));}
FieldHit mapField(vec3 p){FieldHit h;h.distance=1e20;h.objectId=0.0;h.materialRole=0.0;h.local=p;int i=0,best=-1;
 for(int visit=0;visit<${nodes.length};visit++){if(i>=${nodes.length})break;if(caseBound(p,i)>h.distance+0.00001){i=caseBVHLinks[i].y;continue;}int k=caseBVHLinks[i].x;
 if(k>=0){float d=casePatchDistance(k,p);if(d<h.distance-0.00001||(abs(d-h.distance)<=0.00001&&(best<0||k<best))){best=k;h.objectId=float(k+1000);h.materialRole=caseRoles[k];}h.distance=min(h.distance,d);}i++;}return h;}
${buildStaticCaseRayGLSL(patches,nodes)}
float mapDistance(vec3 p){return mapField(p).distance;}
vec3 fieldNormal(vec3 p){int k=int(mapField(p).objectId)-1000;return k>=0&&k<${patches.length}?caseN[k]:vec3(0,1,0);}
`;
}
