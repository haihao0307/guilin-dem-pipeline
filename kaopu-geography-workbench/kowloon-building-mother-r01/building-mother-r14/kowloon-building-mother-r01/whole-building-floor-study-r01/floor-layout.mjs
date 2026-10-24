/**
 * One additive KCC representative-floor study. This file never changes measured
 * patches or the native mother. Interior geometry is compiled ONLY after an
 * explicit, independently checked pixel-to-source registration is supplied.
 * Public plan topology is evidence; wall heights/depths/FFL/finishes are design.
 */
import { CASE_SCHEMA } from '../r07/cases.mjs';
import { ASSEMBLY_SCHEMA, queryAssemblyInside, intersectAssemblyRay } from '../r07/assemblies.mjs';
import { deriveAperture, queryApertures, intersectAperturesRay } from '../r07/apertures.mjs';
import { validateFiniteHostDomain } from '../r07/host-bindings.mjs';
import { WHOLE_BUILDING_SCHEMA } from '../whole-building-r01/tower.mjs';

export const FLOOR_STUDY_SCHEMA='kaopu.kcc-registered-floor-study/0.1';
const EPS=1e-7,copy=x=>structuredClone(x),add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,t)=>a.map(v=>v*t),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),len=a=>Math.hypot(...a),unit=a=>mul(a,1/len(a));
const finite=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite),Y=[0,1,0],rect=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const shiftedBounds=(b,t)=>({min:add(b.min,t),max:add(b.max,t)});
const bounds=P=>({min:[0,1,2].map(k=>Math.min(...P.map(p=>p.bounds.min[k]))),max:[0,1,2].map(k=>Math.max(...P.map(p=>p.bounds.max[k])))});
const localPoint=(p,q)=>add(p.origin,add(mul(p.u,q[0]),add(mul(p.v,q[1]),mul(p.w,q[2]))));
export function finitePrism(nodeId,loops,range,{u=[1,0,0],v=[0,0,1],w=Y,origin=[0,0,0],materialRole=2,materialKey='painted_partition',roomIds=[]}={}) {
 if(!Array.isArray(loops)||!loops.length||loops.some(l=>!Array.isArray(l)||l.length<3||l.some(p=>!finite(p,2)))||!finite(range,2)||range[1]<=range[0])throw Error('Finite nondegenerate polygon prism required');
 if(![u,v,w,origin].every(p=>finite(p,3))||[u,v,w].some(a=>Math.abs(len(a)-1)>EPS)||Math.abs(dot(u,v))+Math.abs(dot(u,w))+Math.abs(dot(v,w))>EPS)throw Error('Rigid orthogonal prism frame required');
 const p={kind:'finite_polygon_prism',nodeId,objectId:2000,materialRole,materialKey,roomIds:copy(roomIds),origin:copy(origin),u:copy(u),v:copy(v),w:copy(w),loops:copy(loops),range:copy(range),geometryEvidence:'public_plan_topology_registered_design_metric_fit_not_surveyed_interiors'};
 const points=loops.flat().flatMap(q=>range.map(h=>localPoint(p,[...q,h])));p.bounds={min:[0,1,2].map(i=>Math.min(...points.map(q=>q[i]))),max:[0,1,2].map(i=>Math.max(...points.map(q=>q[i])))};
 p.planes=[{normal:[0,0,1],offset:range[0],domain:'cap'},{normal:[0,0,1],offset:range[1],domain:'cap'}];
 for(const loop of loops)for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[j],b=loop[i],n=[b[1]-a[1],a[0]-b[0],0],L=len(n);if(L<EPS)throw Error('Degenerate finite prism edge');p.planes.push({normal:mul(n,1/L),offset:dot(n,[...a,0])/L,domain:'side',edge:[a,b]});}return p;
}
/** Original pixel observations from the supplied 1888 × 1334 public 5/F–17/F
 * drawing. It has no scale bar/north arrow. Coordinates are NOT source metres.
 * Door centres are observations of schematic gaps, not surveyed openings.
 */
const DISPLAY_PLAN_A_TOPOLOGY=Object.freeze({
 imageSize:[1888,1334],planFamily:'5/F–17/F',actualFloorLabel:null,unitLabel:'A',metricScaleKnown:false,northKnown:false,
 rooms:[
  {key:'living',label:'客厅',center:[550,615],polygon:rect(487,550,661,683),materialKey:'living_terrazzo'},
  {key:'dining',label:'餐厅',center:[520,747],polygon:rect(458,698,582,788),materialKey:'living_terrazzo'},
  {key:'kitchen',label:'厨房',center:[632,748],polygon:rect(596,698,661,786),materialKey:'kitchen_non_slip_tile'},
  {key:'passage',label:'户内短过道',center:[448,670],polygon:rect(402,657,482,683),materialKey:'living_terrazzo'},
  {key:'bedroom-upper',label:'卧室 1',center:[330,591],polygon:[[266,543],[387,543],[387,613],[424,613],[424,644],[252,644],[252,596],[266,580]],materialKey:'bedroom_timber'},
  {key:'bedroom-lower',label:'卧室 2',center:[326,742],polygon:[[252,657],[388,657],[388,792],[266,792],[266,753],[252,735]],materialKey:'bedroom_timber'},
  {key:'bath-upper',label:'浴室 1',center:[455,590],polygon:rect(440,543,475,643),materialKey:'bath_non_slip_tile'},
  {key:'bath-lower',label:'浴室 2',center:[425,750],polygon:rect(402,700,445,792),materialKey:'bath_non_slip_tile'},
 ],
 // Each line is a real authored solid; openings are omitted intervals plus a
 // separate lintel, never a coloured door drawn over a closed partition.
 walls:[
  {key:'entry-host',a:[670,546],b:[670,790],doors:[{key:'entry',at:124,width:36,from:'lobby',to:'living'}],rooms:['living','kitchen']},
  {key:'bedrooms-divider',a:[250,650],b:[432,650],doors:[{key:'bedroom-upper',at:161,width:36,from:'passage',to:'bedroom-upper'}],rooms:['bedroom-upper','bedroom-lower','passage']},
  {key:'bedroom-upper-bath-west',a:[395,542],b:[395,607],rooms:['bedroom-upper','bath-upper']},
  {key:'bedroom-upper-bath-step',a:[395,607],b:[433,607],rooms:['bedroom-upper','bath-upper']},
  {key:'bedroom-upper-bath-east',a:[433,607],b:[433,650],rooms:['bedroom-upper','bath-upper']},
  {key:'bath-upper-living',a:[481,542],b:[481,650],rooms:['bath-upper','living']},
  {key:'bath-upper-door-host',a:[433,650],b:[483,650],doors:[{key:'bath-upper',at:26,width:34,from:'passage',to:'bath-upper'}],rooms:['bath-upper','passage']},
  {key:'bedroom-lower-door-host',a:[395,650],b:[395,792],doors:[{key:'bedroom-lower',at:22,width:38,from:'passage',to:'bedroom-lower'}],rooms:['bedroom-lower','passage','bath-lower']},
  {key:'bath-lower-dining',a:[451,691],b:[451,792],rooms:['bath-lower','dining']},
  {key:'bath-lower-door-host',a:[395,691],b:[451,691],doors:[{key:'bath-lower',at:38,width:30,from:'passage',to:'bath-lower'}],rooms:['bath-lower','passage']},
  {key:'living-dining',a:[483,691],b:[590,691],rooms:['living','dining']},
  {key:'dining-kitchen',a:[590,691],b:[590,790],rooms:['dining','kitchen']},
  {key:'kitchen-door-host',a:[590,691],b:[665,691],doors:[{key:'kitchen',at:20,width:34,from:'living',to:'kitchen'}],rooms:['living','kitchen']},
 ],
 connections:[
  {from:'living',to:'passage',via:[[550,650],[500,670],[448,670]],opening:'open'},
  {from:'passage',to:'dining',via:[[448,670],[468,690],[500,735]],opening:'open'},
 ],
 window:{key:'bedroom-upper-window',room:'bedroom-upper',pixel:[246,619],insidePixel:[274,619],buildingType:'one_dark_grey_metal_outward_casement_with_vertical_handle',photoPositionRegistered:false,photoFloorKnown:false,photoUnitKnown:false},
 evidence:'public_plan_room_adjacency_and_schematic_gaps; no_as_built_dimensions_or_orientation_claim'
});

// The image viewer resampled the 3308 × 2339 source to 1888 × 1334.
// Store the conversion explicitly; no thumbnail pixel is ever treated as an
// original image pixel by the registration kernel.
const TRACE_SCALE=[3308/1888,2339/1334],originalPixel=p=>p.map((v,i)=>v*TRACE_SCALE[i]);
export const PLAN_A_TOPOLOGY=Object.freeze({...DISPLAY_PLAN_A_TOPOLOGY,imageSize:[3308,2339],traceReferenceImageSize:[1888,1334],traceToOriginalScale:TRACE_SCALE,
 rooms:DISPLAY_PLAN_A_TOPOLOGY.rooms.map(r=>({...r,center:originalPixel(r.center),polygon:r.polygon.map(originalPixel)})),
 walls:DISPLAY_PLAN_A_TOPOLOGY.walls.map(w=>{const a=originalPixel(w.a),b=originalPixel(w.b),scale=len(sub(b,a))/len(sub(w.b,w.a));return{...w,a,b,doors:w.doors?.map(d=>({...d,at:d.at*scale,width:d.width*scale}))};}),
 connections:DISPLAY_PLAN_A_TOPOLOGY.connections.map(c=>({...c,via:c.via.map(originalPixel)})),
 window:{...DISPLAY_PLAN_A_TOPOLOGY.window,pixel:originalPixel(DISPLAY_PLAN_A_TOPOLOGY.window.pixel),insidePixel:originalPixel(DISPLAY_PLAN_A_TOPOLOGY.window.insidePixel)}
});

function registrationTransform(registration){
 const t=registration?.pixelToSource,m=t?.matrix;
 if(!m||!Array.isArray(m)||m.length!==2||m.some(r=>!finite(r,2))||!finite(t.translation,2))throw Error('Explicit finite pixelToSource 2 × 2 matrix and translation required');
 const cx=[m[0][0],m[1][0]],cy=[m[0][1],m[1][1]],sx=len(cx),sy=len(cy);
 if(sx<.005||sx>.10||Math.abs(sx-sy)>1e-7||Math.abs(dot(cx,cy))>1e-8)throw Error('Plan registration must be one bounded similarity, not anisotropic scale/shear');
 return{scale:sx,point:p=>[m[0][0]*p[0]+m[0][1]*p[1]+t.translation[0],m[1][0]*p[0]+m[1][1]*p[1]+t.translation[1]],matrix:copy(m),translation:copy(t.translation)};
}
export function planPixelToSource(registration,pixel){if(!finite(pixel,2))throw Error('Finite plan pixel required');return registrationTransform(registration).point(pixel);}
const sourcePoint=(T,p,y=0)=>{const q=T.point(p);return[q[0],y,q[1]];};
function insideLoop(p,l){let hit=false;for(let i=0,j=l.length-1;i<l.length;j=i++){const a=l[j],b=l[i];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function segmentDistance(p,a,b){const d=sub(b,a),den=dot(d,d),t=den<EPS?0:Math.max(0,Math.min(1,dot(sub(p,a),d)/den));return len(sub(p,add(a,mul(d,t))));}
function insideBoundary(p,r){return insideLoop(p,r)||r.some((a,i)=>segmentDistance(p,a,r[(i+1)%r.length])<EPS);}
function segmentInside(a,b,ring){const d=sub(b,a),cuts=[0,1];for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length],v=sub(q,p),w=sub(p,a),den=d[0]*v[1]-d[1]*v[0];if(Math.abs(den)>1e-12){const t=(w[0]*v[1]-w[1]*v[0])/den,u=(w[0]*d[1]-w[1]*d[0])/den;if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);}}cuts.sort((a,b)=>a-b);return insideBoundary(a,ring)&&insideBoundary(b,ring)&&cuts.slice(1).every((t,i)=>insideBoundary(add(a,mul(d,(t+cuts[i])/2)),ring));}
function primitiveFits(p,ring){const plan=p.loops.flat().flatMap(q=>p.range.map(h=>localPoint(p,[...q,h]))).map(q=>[q[0],q[2]]);return plan.every(q=>insideBoundary(q,ring))&&p.loops.every(l=>l.every((q,i)=>p.range.every(h=>{const a=localPoint(p,[...q,h]),b=localPoint(p,[...l[(i+1)%l.length],h]);return segmentInside([a[0],a[2]],[b[0],b[2]],ring);})));}
function studyArchetype(id,P,old){const a={...old,id,primitives:P,bounds:bounds(P),counts:{primitives:P.length,modelTriangles:0,modelVertexBuffers:0},sourceRecipe:'selected_floor_only_public_plan_A_trace_after_explicit_registration'};a.spec={schema:ASSEMBLY_SCHEMA,fieldKind:'evidence-assembly',primitives:P,bounds:a.bounds,counts:a.counts};return a;}
function block(base,measured,floorId,registration,reason,extra={}) {return{schema:FLOOR_STUDY_SCHEMA,baseModel:base,model:base,measured,floorId,status:reason,enabled:false,metadata:{actualFloorLabel:null,sourcePlanFamily:PLAN_A_TOPOLOGY.planFamily,registration:registration?copy(registration):null,originalSourceUnchanged:true,noModelMesh:true,...extra},archetypes:[],instances:[],rooms:[],doors:[],apertures:[],apertureConfigs:[],sourceMasks:[],graph:{nodes:[],edges:[]},paths:[],validation:{valid:false,reason,...extra}};}

/** Adjacent floor relation, not a roof or an as-built floor height. */
export function upperFloorDesign(values={}){
 const height=values.height??3.0,slabThickness=values.slabThickness??.18;
 if(!Number.isFinite(height)||!Number.isFinite(slabThickness)||height<2.6||height>3.6||slabThickness<.12||slabThickness>.30||height-slabThickness<2.3)throw Error('Upper-floor design height/thickness outside bounded domain');
 return{height,slabThickness,underside:height-slabThickness,allDimensionsDesign:true,elevationDatum:'current_structural_slab_top_local_zero_not_mPD',actualHeightKnown:false};
}
function coreUpperOpenings(T,root,slabId){
 const records=[],h=.14/2;
 const hole=(key,purpose,a,b,rel)=>{const A=T.point(a),B=T.point(b),polygon=rect(A[0]+h,A[1]+h,B[0]-h,B[1]-h);if(polygon[1][0]<=polygon[0][0]||polygon[2][1]<=polygon[1][1])throw Error('Core opening lost positive clear size');records.push({id:root+':upper-opening:'+key,hostSlabId:slabId,purpose,relatedCoreId:rel,polygon,sourcePlanRectangle:[a,b],insetFromWallCenterM:h,evidence:'design_reservation_inside_existing_plan_enclosure_not_measured_slab_opening'});};
 for(let i=0;i<3;i++)hole('lift-'+i,'lift',[1263+i*563/3,950],[1263+(i+1)*563/3,1098],root+':lift:'+i);
 hole('stairs','stairs',[1263,1203],[1936,1393],root+':stair-enclosure');
 return records;
}

/** Standalone trace compiler, useful for unit tests without placing anything in
 * the mother. Callers may inspect the result; it does not authorize placement. */
export function compilePlanATopology(registration,{wallHeight=2.55,wallThickness=.11,doorHeight=2.10,floorFinishThickness=.008,upperFloor=null}={}){
 const T=registrationTransform(registration),top=upperFloor?upperFloorDesign(upperFloor):null;
 if(top&&Math.abs(wallHeight-top.underside)>EPS)throw Error('Wall top must derive from the adjacent slab underside');
 if(![wallHeight,wallThickness,doorHeight,floorFinishThickness].every(Number.isFinite)||wallHeight<2.3||wallHeight>(top?3.48:2.7)||wallThickness<.08||wallThickness>.20||doorHeight<1.95||doorHeight>wallHeight-.15||floorFinishThickness<.002||floorFinishThickness>.025)throw Error('Interior metric assumptions outside bounded study domain');
 const P=[],doors=[],rooms=PLAN_A_TOPOLOGY.rooms.map(r=>({...copy(r),planPolygon:r.polygon.map(T.point),center:sourcePoint(T,r.center),geometryEvidence:'schematic_public_plan_trace_after_similarity_fit',actualDimensionsKnown:false}));
 for(const room of rooms)P.push(finitePrism('study-floor:'+room.key,[room.planPolygon],[0,floorFinishThickness],{materialRole:10,materialKey:room.materialKey,roomIds:[room.key]}));
 for(const wall of PLAN_A_TOPOLOGY.walls){const a=sourcePoint(T,wall.a),b=sourcePoint(T,wall.b),u=unit(sub(b,a)),w=[-u[2],0,u[0]],L=len(sub(b,a)),cuts=[0,L];
  const openings=(wall.doors??[]).map(d=>({...d,center:d.at*T.scale,width:d.width*T.scale}));
  for(const d of openings){if(d.width<.45||d.center-d.width/2<.025||d.center+d.width/2>L-.025)throw Error('Schematic door leaves no finite jamb at '+wall.key);cuts.push(d.center-d.width/2,d.center+d.width/2);}
  cuts.sort((a,b)=>a-b);let part=0;
  for(let i=0;i<cuts.length-1;i++){const lo=cuts[i],hi=cuts[i+1],mid=(lo+hi)/2,d=openings.find(d=>mid>d.center-d.width/2&&mid<d.center+d.width/2);if(hi-lo<EPS)continue;P.push(finitePrism('study-wall:'+wall.key+':'+part++,[rect(lo,d?doorHeight:0,hi,wallHeight)],[-wallThickness/2,wallThickness/2],{u,v:Y,w,origin:a,materialRole:12,materialKey:wall.rooms?.some(r=>r.startsWith('bath')||r==='kitchen')?'wet_zone_wall_tile':'painted_partition',roomIds:wall.rooms??[]}));}
  for(const d of openings){const center=add(a,mul(u,d.center)),target=rooms.find(r=>r.key===d.to).center,sign=dot(sub(target,center),w)>=0?1:-1;doors.push({...d,hostKey:wall.key,hostNodeId:'study-wall:'+wall.key,width:d.width,height:doorHeight,wallThickness,center,frame:{origin:add(center,[0,doorHeight/2,0]),u:mul(u,sign),v:copy(Y),w:mul(w,sign)},swingEvidence:'authored_inward_to_named_room_not_hardware_survey',actualDimensionsKnown:false,positionEvidence:'public_plan_schematic_opening_registered_to_source_design_floor'});}
 }
 P.forEach((p,i)=>p.objectId=2100+i);
 return{primitives:P,rooms,doors,scale:T.scale,transform:{matrix:T.matrix,translation:T.translation},metricAssumptions:{wallHeight,wallThickness,doorHeight,floorFinishThickness,allDimensionsDesign:true}};
}

function sourceWindowBinding(measured,T,level,{width=.74,height=1.20,sillHeight=.85,wallThickness=.18,maxPlaneDistance=.40}={}){
 const target=sourcePoint(T,PLAN_A_TOPOLOGY.window.pixel,level.elevation+sillHeight+height/2),inside=sourcePoint(T,PLAN_A_TOPOLOGY.window.insidePixel,target[1]),expectedOut=unit(sub(target,inside));
 const candidates=[];for(const p of measured.patches){if(p.sourceKind!=='wallStrip'||Math.abs(p.n[1])>1e-6||Math.abs(dot(p.v,Y))<.999999||dot(p.n,expectedOut)<.92)continue;
  const distance=dot(sub(target,p.origin),p.n);if(Math.abs(distance)>maxPlaneDistance)continue;
  const planeCenter=sub(target,mul(p.n,distance)),uv=[dot(sub(planeCenter,p.origin),p.u),dot(sub(planeCenter,p.origin),p.v)],region=rect(uv[0]-width/2-.15,uv[1]-height/2-.15,uv[0]+width/2+.15,uv[1]+height/2+.15);
  try {const domain=validateFiniteHostDomain(region,p.loops,{minimumMargin:.06});candidates.push({p,distance,planeCenter,uv,domain});}catch{}
 }
 candidates.sort((a,b)=>Math.abs(a.distance)-Math.abs(b.distance));if(!candidates.length)throw Error('Registered A exterior window has no compatible finite measured vertical patch within '+maxPlaneDistance+' m');
 const c=candidates[0],frame={origin:sub(c.planeCenter,mul(c.p.n,wallThickness/2)),u:copy(c.p.u),v:copy(c.p.v),w:copy(c.p.n)},config={instanceId:101,kind:'window',width,height,frameDepth:.085,wallThickness,frameWidth:.045,sashWidth:.038,leafThickness:.032,glassThickness:.006,glassSeat:.005,roundRadius:0,hingeOrSlider:'hinge-left',openT:.28,enabled:true,leafEnabled:true,host:{...copy(frame),nodeId:level.nodeId+':study:source-window-host',sourcePatchId:c.p.sourcePatchId,sourceObjectId:c.p.objectId,emitWall:true,wallWidth:width+.30,wallHeight:height+.30}};
 const aperture=deriveAperture(config),mask={instanceId:101,hostId:config.host.nodeId,sourcePatchId:c.p.sourcePatchId,sourceObjectId:c.p.objectId,frame:copy(frame),width,height,depth:wallThickness+.002,roundRadius:0,enabled:true,scope:'proposal_view_only_exact_selected_patch',sourceGeometryDeleted:false};
 return{key:PLAN_A_TOPOLOGY.window.key,room:PLAN_A_TOPOLOGY.window.room,config,aperture,mask,sourcePatchId:c.p.sourcePatchId,sourceObjectId:c.p.objectId,sourcePatchDomain:copy(c.p.loops),sourceUVCenter:c.uv,sourceRegionValidation:c.domain,planeDistanceM:c.distance,sourcePlanePoint:c.planeCenter,insidePoint:sub(c.planeCenter,mul(c.p.n,.40)),typeEvidence:PLAN_A_TOPOLOGY.window.buildingType,metricPlacementEvidence:'design_position_on_registered_plan_exterior; photograph_not_registered_to_floor_unit_or_patch',actualMetricDimensionsKnown:false,actualPhotoPatchKnown:false,wallThicknessEvidence:'authored_assumption_not_measured'};
}

/** A* on the retained floor's analytic field. Querying both support and a small
 * standing envelope catches routes through shaft holes and solid partitions.
 * This is a bounded design-path check, never a building-code certification. */
function findPath(assembly,start,end,{step=.16,bodyRadius=.16,maxVisits=60000,apertures=[]}={}){
 const low=assembly.bounds.min,high=assembly.bounds.max,x0=Math.floor(low[0]/step)*step,z0=Math.floor(low[2]/step)*step,nx=Math.ceil((high[0]-x0)/step)+1,nz=Math.ceil((high[2]-z0)/step)+1;
 const grid=p=>[Math.round((p[0]-x0)/step),Math.round((p[2]-z0)/step)],point=q=>[x0+q[0]*step,0,z0+q[1]*step],key=q=>q[1]*nx+q[0],walkCache=new Map();
 function free(p){if(!queryAssemblyInside(assembly,add(p,[0,-.008,0])))return false;for(const [dx,dz]of [[0,0],[bodyRadius,0],[-bodyRadius,0],[0,bodyRadius],[0,-bodyRadius]])for(const y of [.2,1.25,1.85])if(queryAssemblyInside(assembly,[p[0]+dx,y,p[2]+dz])||(apertures.length&&queryApertures(apertures,[p[0]+dx,y,p[2]+dz]).inside))return false;return true;}
 function cell(q){if(q[0]<0||q[0]>=nx||q[1]<0||q[1]>=nz)return false;const k=key(q);if(!walkCache.has(k))walkCache.set(k,free(point(q)));return walkCache.get(k);}
 function edgeClear(a,b){const d=sub(b,a),L=len(d);if(L<EPS)return true;const o=add(a,[0,1.25,0]),direction=mul(d,1/L);if(intersectAssemblyRay(assembly,o,direction,{maxDistance:L}).hit||apertures.length&&intersectAperturesRay(apertures,o,direction,{maxDistance:L}).hit)return false;return queryAssemblyInside(assembly,add(mul(add(a,b),.5),[0,-.008,0]));}
 function near(p){const c=grid(p),choices=[];for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){const q=[c[0]+dx,c[1]+dz];if(cell(q)&&edgeClear(p,point(q)))choices.push(q);}choices.sort((a,b)=>len(sub(point(a),p))-len(sub(point(b),p)));if(!choices.length)throw Error('No standing clearance at route endpoint '+JSON.stringify(p));return choices[0];}
 const S=near(start),E=near(end),target=key(E),open=[S],g=new Map([[key(S),0]]),prev=new Map(),closed=new Set(),h=q=>Math.hypot(q[0]-E[0],q[1]-E[1]);let visits=0;
 while(open.length&&visits++<maxVisits){let best=0;for(let i=1;i<open.length;i++)if(g.get(key(open[i]))+h(open[i])<g.get(key(open[best]))+h(open[best]))best=i;const q=open.splice(best,1)[0],k=key(q);if(closed.has(k))continue;closed.add(k);if(k===target){const route=[E];let cur=k;while(prev.has(cur)){cur=prev.get(cur);route.push([cur%nx,Math.floor(cur/nx)]);}route.reverse();return{points:[copy(start),...route.map(point),copy(end)],visits,standingEnvelopeRadiusM:bodyRadius,method:'bounded_analytic_field_A_star'};}
  for(const[dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const n=[q[0]+dx,q[1]+dz],nk=key(n);if(closed.has(nk)||!cell(n)||dx&&dz&&(!cell([q[0]+dx,q[1]])||!cell([q[0],q[1]+dz]))||!edgeClear(point(q),point(n)))continue;const ng=g.get(k)+Math.hypot(dx,dz);if(ng<(g.get(nk)??Infinity)){g.set(nk,ng);prev.set(nk,k);open.push(n);}}
 }
 throw Error('No connected standing route in registered floor geometry; visited '+visits+' cells');
}

export function deriveFloorStudy(baseModel,measured,options={}){
 if(baseModel?.schema!==WHOLE_BUILDING_SCHEMA||baseModel.caseId!=='kcc'||measured?.schema!==CASE_SCHEMA||measured.sourceModelId!==baseModel.sourceModelId)throw Error('Matching immutable KCC mother and measured source required');
 const floorId=options.floorId??'T04',level=baseModel.levels.find(l=>l.id===floorId),registration=options.registration;
 if(!level||level.componentId!=='tower')throw Error('An existing native tower design floor is required');
 if(!registration||registration.accepted!==true||registration.ambiguous===true||registration.uniqueOrientation===false)return block(baseModel,measured,floorId,registration,'blocked_pending_plan_registration');
 if(registration.sourceModelId!==measured.sourceModelId)return block(baseModel,measured,floorId,registration,'blocked_registration_source_identity_mismatch');
 const legacy=registration.legacyWingLabel;if(!/^[A-F]$/.test(legacy??'')||!Array.isArray(registration.sourceWingChain)||registration.sourceWingChain.length!==4)return block(baseModel,measured,floorId,registration,'blocked_missing_registered_source_wing');
 const nativeA=baseModel.archetypes.find(a=>a.id===level.archetypeId),nativeI=baseModel.instances.find(i=>i.floorId===floorId&&i.kind==='floor'),ring=baseModel.sourceBinding.towerFootprint;
 if(!nativeA||!nativeI)throw Error('Existing floor archetype and instance required');
 let compiled,T,windowBinding,routeResults;try{
  T=registrationTransform(registration);compiled=compilePlanATopology(registration,{wallHeight:baseModel.config.wallHeight,...options.dimensions});
  if(compiled.metricAssumptions.wallHeight>level.clearHeight+EPS)throw Error('Study wall exceeds unchanged native floor clear height');
  const bad=compiled.primitives.find(p=>!primitiveFits(p,ring));if(bad)throw Error('Registered room field leaves exact measured footprint: '+bad.nodeId);
  windowBinding=sourceWindowBinding(measured,T,level,options.window);
 }catch(error){return block(baseModel,measured,floorId,registration,'blocked_registered_geometry_no_fit',{reason:error.message});}
 const removed=nativeA.primitives.filter(p=>p.nodeId.includes('source-unit-'+legacy+'-partition'));
 if(!removed.length)return block(baseModel,measured,floorId,registration,'blocked_registered_host_not_found');
 const kept=nativeA.primitives.filter(p=>!removed.includes(p)),newA=studyArchetype(nativeA.id+':'+floorId+':registered-A-study',[...kept,...compiled.primitives],nativeA),newI={...nativeI,archetypeId:newA.id,bounds:shiftedBounds(newA.bounds,nativeI.translation)},root=level.nodeId+':study-A';
 try {routeResults=compiled.rooms.map(r=>({...findPath(newA,[0,0,0],r.center),roomKey:r.key}));const inside=sub(windowBinding.insidePoint,[0,level.elevation,0]);routeResults.push({...findPath(newA,[0,0,0],[inside[0],0,inside[2]]),roomKey:'source-window'});}catch(error){return block(baseModel,measured,floorId,registration,'blocked_floor_route_no_fit',{reason:error.message});}
 const nodes=[],edges=[],node=(id,type,label,owner,extra={})=>{nodes.push({id,type,label,evidence:'registered_public_plan_topology_design_metric_fields',floorId,actualFloorLabel:null,...extra});if(owner)edges.push({type:'ownedBy',from:id,to:owner});return id;};
 const unit=node(root,'representative-unit-study','图纸 A 户：注册后的代表设计层',level.nodeId,{publicPlanUnitLabel:'A',legacySourceWingAlias:legacy,actualUnitFloorVerified:false}),roomIds={};
 for(const room of compiled.rooms){room.id=node(root+':room:'+room.key,'interior-room',room.label,unit,{materialKey:room.materialKey,actualFinishKnown:false});roomIds[room.key]=room.id;room.worldCenter=add(room.center,[0,level.elevation,0]);}
 const apertures=[],apertureConfigs=[];
 for(const [i,door]of compiled.doors.entries()){door.id=node(root+':door:'+door.key,'hosted-door',door.key==='entry'?'A 户入口':door.key,unit,{hostKey:door.hostKey,roughWidth:door.width,roughHeight:door.height});door.worldCenter=add(door.center,[0,level.elevation,0]);door.frame.origin=add(door.frame.origin,[0,level.elevation,0]);const config={instanceId:80+i,kind:'door',width:door.width,height:door.height,frameWidth:.045,frameDepth:.10,wallThickness:door.wallThickness,roundRadius:0,hingeOrSlider:'hinge-left',openT:1,enabled:true,clearance:.012,thresholdHeight:0,host:{...copy(door.frame),nodeId:door.id+':host',emitWall:false}};door.apertureInstanceId=config.instanceId;apertureConfigs.push(config);apertures.push(deriveAperture(config));const from=door.from==='lobby'?level.nodeId+':lobby':roomIds[door.from],to=roomIds[door.to];edges.push({type:'walksTo',from,to:door.id,geometryBacked:true},{type:'walksTo',from:door.id,to,geometryBacked:true});}
 for(const c of PLAN_A_TOPOLOGY.connections)edges.push({type:'walksTo',from:roomIds[c.from],to:roomIds[c.to],geometryBacked:true,opening:'unframed_open_passage'});
 const windowId=node(root+':source-window','source-hosted-window','外墙源面上的单扇外开窗设计',unit,{sourcePatchId:windowBinding.sourcePatchId,sourceObjectId:windowBinding.sourceObjectId,actualPhotoPatchKnown:false});edges.push({type:'walksTo',from:roomIds[windowBinding.room],to:windowId,geometryBacked:true});
 for(const p of compiled.primitives)node(nativeI.id+':'+p.nodeId,'analytic-room-field',p.nodeId,unit,{materialKey:p.materialKey});
 apertures.push(windowBinding.aperture);apertureConfigs.push(windowBinding.config);
 const paths=routeResults.map(r=>({...r,id:root+':path:'+r.roomKey,floorId,from:level.nodeId+':lobby',to:r.roomKey==='source-window'?windowId:roomIds[r.roomKey],points:r.points.map(p=>add(p,[0,level.elevation,0]))}));
 const levels=baseModel.levels.map(l=>l===level?{...l,archetypeId:newA.id}:l),archetypes=[...baseModel.archetypes,newA],instances=baseModel.instances.map(i=>i===nativeI?newI:i),model={...baseModel,levels,archetypes,instances,graph:{...baseModel.graph,nodes:[...baseModel.graph.nodes,...nodes],edges:[...baseModel.graph.edges,...edges],actualInteriorComplete:false},counts:{...baseModel.counts,archetypes:archetypes.length,primitives:archetypes.reduce((s,a)=>s+a.primitives.length,0),expandedPrimitiveCount:instances.reduce((s,i)=>s+archetypes.find(a=>a.id===i.archetypeId).primitives.length,0)},floorStudy:{floorId,unitLabel:'A',actualFloorLabel:null,originalSourceUnchanged:true}};
 const metadata={floorId,actualFloorLabel:null,sourcePlanFamily:PLAN_A_TOPOLOGY.planFamily,publicPlanUnitLabel:'A',legacySourceWingAlias:legacy,sourceWingChain:copy(registration.sourceWingChain),registration:copy(registration),metricAssumptions:compiled.metricAssumptions,actualFinishKnown:false,actualWindowPositionKnown:false,actualWindowDimensionsKnown:false,actualUnitFloorVerified:false,originalSourceUnchanged:true,sourcePatchCount:measured.patches.length,sourceTrianglesUnchanged:true,noModelMesh:true,changedScope:'one_existing_design_floor_one_registered_unit_partition_only',unchangedOtherUnitCount:5,retainedLegacyPartitionCount:kept.filter(p=>p.nodeId.includes('-partition')).length,removedPrimitiveIds:removed.map(p=>p.nodeId),retainedCorePrimitiveCount:kept.filter(p=>p.nodeId.endsWith(':source-lift-core')).length,structuralOrFireSafetyCertification:false};
 return{schema:FLOOR_STUDY_SCHEMA,baseModel,model,measured,floorId,status:'registered_design_floor_connected',enabled:true,metadata,archetypes:[newA],instances:[newI],rooms:compiled.rooms,doors:compiled.doors,apertures,apertureConfigs,sourceMasks:[windowBinding.mask],windowBinding,graph:{nodes,edges},paths,validation:{valid:true,allRoomsConnectedToExistingLobby:true,sourceWindowBoundToFiniteOriginalPatch:true,allNewFieldsInsideOriginalFootprint:true,levelCountUnchanged:levels.length===baseModel.levels.length,baseElevationsUnchanged:levels.every((l,i)=>same([l.id,l.elevation,l.elevationMpd,l.height,l.actualFloorLabel],[baseModel.levels[i].id,baseModel.levels[i].elevation,baseModel.levels[i].elevationMpd,baseModel.levels[i].height,baseModel.levels[i].actualFloorLabel])),noModelMesh:true,actualInteriorReconstructed:false,standingPathMethod:'bounded_analytic_field_A_star; door-leaf_collision_not_continuously_certified'}};
}

/** Independent CPU route probes used by regression tests and the UI. */
export function validateFloorStudyRoutes(study,{spacing=.075}={}){
 if(study?.schema!==FLOOR_STUDY_SCHEMA||(!study.enabled&&!study.evidenceEnabled))throw Error('Enabled registered or independent evidence floor required');
 const a=study.evidenceEnabled?study.evidenceArchetype:study.archetypes[0],level=study.evidenceEnabled?study.evidenceModel.levels[0]:study.model.levels.find(l=>l.id===study.floorId);let samples=0;
 for(const path of study.paths)for(let i=1;i<path.points.length;i++){const p=sub(path.points[i-1],[0,level.elevation,0]),q=sub(path.points[i],[0,level.elevation,0]),N=Math.max(1,Math.ceil(len(sub(q,p))/spacing));for(let j=0;j<=N;j++){const v=add(p,mul(sub(q,p),j/N));samples++;if(!queryAssemblyInside(a,add(v,[0,-.008,0]))||queryAssemblyInside(a,add(v,[0,1.25,0]))||queryApertures(study.apertures,add(v,[0,1.25,0])).inside)throw Error('Unsupported or wall/door-obstructed route '+path.roomKey);}}
 return{valid:true,samples,paths:study.paths.length,spacing,measuredShellOccupancy:'not_invented',structuralOrFireSafetyCertification:false};
}

const EVIDENCE_OUTLINE_PIXELS=[[452,934],[1073,934],[1073,610],[1048,585],[1048,485],[1073,460],[1073,425],[1545,425],[1545,934],[1664,934],[1664,425],[2133,425],[2133,460],[2158,485],[2158,585],[2133,610],[2133,934],[2758,934],[2758,1018],[2785,1045],[2785,1288],[2758,1315],[2758,1407],[2130,1407],[2130,1952],[2044,1952],[2008,1988],[1780,1988],[1744,1952],[1660,1952],[1660,1407],[1545,1407],[1545,1952],[1470,1952],[1434,1988],[1196,1988],[1160,1952],[1074,1952],[1074,1407],[452,1407],[452,1315],[425,1288],[425,1045],[452,1018]];
function recolorAperture(a){for(const p of a.primitives)p.materialRole=p.part==='glass'?6:p.part==='host'?11:p.part==='leaf'&&a.kind==='door'?14:13;return a;}
function wallField(id,a,b,{height=2.55,thickness=.14,openings=[],materialRole=12,materialKey='painted_partition',inwardOnly=false}={}){
 const u=unit(sub(b,a)),w=[-u[2],0,u[0]],L=len(sub(b,a)),cuts=[0,L],P=[];
 for(const o of openings){if(o.center-o.width/2<.02||o.center+o.width/2>L-.02||o.bottom<0||o.bottom+o.height>height-.04)throw Error('Evidence opening leaves finite wall '+id);cuts.push(o.center-o.width/2,o.center+o.width/2);}
 cuts.sort((a,b)=>a-b);let part=0;
 for(let i=0;i<cuts.length-1;i++){const lo=cuts[i],hi=cuts[i+1],mid=(lo+hi)/2,o=openings.find(o=>mid>o.center-o.width/2&&mid<o.center+o.width/2);for(const range of o?[[0,o.bottom],[o.bottom+o.height,height]]:[[0,height]]){if(range[1]-range[0]<EPS)continue;P.push(finitePrism(id+':'+part++,[rect(lo,range[0],hi,range[1])],inwardOnly?[0,thickness]:[-thickness/2,thickness/2],{u,v:Y,w,origin:a,materialRole,materialKey}));}}
 return P;
}
/**
 * Independent evidence-plan coordinate frame. This is deliberately NOT an
 * instanced floor in the measured mother and does not identify a source facade.
 * Uses one inferred scale with original (3308 × 2339) image coordinates.
 * Two ambiguous fit candidates are metadata only, never applied to geometry.
 */
export function deriveEvidenceFloorPlan(baseModel,measured,{registration=null,scaleMPerPixel=.013407147599905933,referenceFloorId='T04',dimensions={},windowOpenT=.32,upperFloor=null}={}){
 if(baseModel?.schema!==WHOLE_BUILDING_SCHEMA||baseModel.caseId!=='kcc'||measured?.schema!==CASE_SCHEMA||measured.sourceModelId!==baseModel.sourceModelId)throw Error('Matching immutable KCC source and mother required');
 if(!Number.isFinite(scaleMPerPixel)||scaleMPerPixel<.012||scaleMPerPixel>.015)throw Error('Evidence scale must remain in the disclosed approximate plan-fit range');
 const reference=baseModel.levels.find(l=>l.id===referenceFloorId);if(!reference)throw Error('Existing design reference floor required');
 if(!Number.isFinite(windowOpenT)||windowOpenT<0||windowOpenT>1)throw Error('Window fraction must be0..1');
 const enclosure=upperFloor?upperFloorDesign(upperFloor):null;if(enclosure&&dimensions.wallHeight!==undefined&&Math.abs(dimensions.wallHeight-enclosure.underside)>EPS)throw Error('Do not supply an independent wall height with an upper-floor relation');
 const imageCenter=[1605,1170.5],planRegistration={pixelToSource:{matrix:[[scaleMPerPixel,0],[0,scaleMPerPixel]],translation:mul(imageCenter,-scaleMPerPixel)}},T=registrationTransform(planRegistration),compiled=compilePlanATopology(planRegistration,enclosure?{...dimensions,wallHeight:enclosure.underside,upperFloor:enclosure}:dimensions),outline=EVIDENCE_OUTLINE_PIXELS.map(T.point),root='KCC:evidence-plan-r01',levelId='evidence-plan',wallHeight=compiled.metricAssumptions.wallHeight;
 const P=[finitePrism('floor:slab',[outline],[-.18,0],{materialRole:1,materialKey:'evidence_concrete_slab'}),...compiled.primitives];
 // Plan-observed core walls are separate from the immutable mother core. The
 // three lift cavities and public lobby form the same planar relationships.
 const pp=(x,y)=>sourcePoint(T,[x,y]),coreFields=[];
 const liftLeft=1263,liftRight=1826,liftTop=950,liftBottom=1098,shaftWidth=(liftRight-liftLeft)/3;
 coreFields.push(...wallField('evidence-core:lift-back',pp(liftLeft,liftTop),pp(liftRight,liftTop),{height:wallHeight}));
 for(let i=0;i<=3;i++)coreFields.push(...wallField('evidence-core:lift-side:'+i,pp(liftLeft+i*shaftWidth,liftTop),pp(liftLeft+i*shaftWidth,liftBottom),{height:wallHeight}));
 const coreApertures=[],corePorts=[];
 for(let i=0;i<3;i++){const a=pp(liftLeft+i*shaftWidth,liftBottom),b=pp(liftLeft+(i+1)*shaftWidth,liftBottom),L=len(sub(b,a)),width=1.05;coreFields.push(...wallField('evidence-core:lift-front:'+i,a,b,{height:wallHeight,openings:[{center:L/2,width,height:2.10,bottom:0}]}));const origin=add(a,mul(unit(sub(b,a)),L/2));const cfg={instanceId:110+i,kind:'door',width,height:2.10,frameWidth:.055,frameDepth:.10,wallThickness:.14,hingeOrSlider:'fixed',leafEnabled:false,host:{origin:add(origin,[0,1.05,0]),u:[1,0,0],v:Y,w:[0,0,1],nodeId:root+':lift:'+i,emitWall:false}};coreApertures.push(recolorAperture(deriveAperture(cfg)));corePorts.push({id:root+':lift:'+i,key:'lift-'+(i+1),center:origin,actualMachineryKnown:false});}
 // Meter room boundaries, and the stair/enclosure edge below the public lobby.
 coreFields.push(...wallField('evidence-core:meter-top',pp(1840,950),pp(1934,950),{height:wallHeight}),...wallField('evidence-core:meter-side',pp(1934,950),pp(1934,1098),{height:wallHeight}));
 const stairFrontA=pp(1263,1203),stairFrontB=pp(1936,1203),stairLength=len(sub(stairFrontB,stairFrontA));
 coreFields.push(...wallField('evidence-core:stair-front',stairFrontA,stairFrontB,{height:wallHeight,openings:[{center:1.65,width:1.00,height:2.1,bottom:0},{center:stairLength-1.0,width:1.00,height:2.1,bottom:0}]}),...wallField('evidence-core:stair-left',pp(1263,1203),pp(1263,1393),{height:wallHeight}),...wallField('evidence-core:stair-right',pp(1936,1203),pp(1936,1393),{height:wallHeight}),...wallField('evidence-core:stair-back',pp(1263,1393),pp(1936,1393),{height:wallHeight}));
 // A measured stair height is not known. Low, tactile 8 mm field bands express
 // the plan's two run directions, rather than inventing a vertical stair rise.
 for(let i=0;i<12;i++)for(const [x0,x1]of [[1495,1615],[1640,1760]]){const a=T.point([x0,1218+i*13]),b=T.point([x1,1220+i*13]);coreFields.push(finitePrism('evidence-core:stair-plan-band:'+x0+':'+i,[rect(a[0],a[1],b[0],b[1])],[0,.008],{materialRole:13,materialKey:'schematic_stair_direction_band_not_physical_step'}));}
 P.push(...coreFields);
 // Real finite wall hosts on the evidence outline, not measured source patches.
 let windowInfo=null;const windowWidth=.74,windowHeight=1.20,sill=.85,target=pp(425,1085),windowEdge=41;
 for(let i=0;i<outline.length;i++){const a=[outline[i][0],0,outline[i][1]],b=[outline[(i+1)%outline.length][0],0,outline[(i+1)%outline.length][1]],L=len(sub(b,a)),u=unit(sub(b,a)),opening=i===windowEdge?{center:dot(sub(target,a),u),width:windowWidth,height:windowHeight,bottom:sill}:null;P.push(...wallField('evidence-outline:wall:'+i,a,b,{height:wallHeight,thickness:.14,openings:opening?[opening]:[],materialRole:11,materialKey:'light_horizontal_exterior_tile',inwardOnly:true}));if(opening){const inward=[-u[2],0,u[0]],outward=mul(inward,-1),hostU=[outward[2],0,-outward[0]],center=add(add(target,mul(inward,.07)),[0,sill+windowHeight/2,0]);windowInfo={key:'bedroom-upper-window',room:'bedroom-upper',outlineEdge:i,finiteDomain:{length:L,height:wallHeight,thickness:.14},center,insidePoint:add(target,mul(inward,.45)),config:{instanceId:101,kind:'window',width:windowWidth,height:windowHeight,wallThickness:.14,frameDepth:.085,frameWidth:.045,sashWidth:.038,leafThickness:.032,glassThickness:.006,glassSeat:.005,hingeOrSlider:'hinge-left',openT:windowOpenT,host:{origin:center,u:hostU,v:Y,w:outward,nodeId:root+':window:host',emitWall:false}},sourcePatchId:null,actualPhotoPatchKnown:false,actualPhotoUnitKnown:false,actualPhotoFloorKnown:false,typeEvidence:PLAN_A_TOPOLOGY.window.buildingType,metricPlacementEvidence:'public_plan_exterior_opening_plus_building_type_photo; unregistered_plan_coordinate_demonstration',dimensionsEvidence:'authored_metric_assumptions_not_1_to_1_survey'};}}
 const windowAperture=recolorAperture(deriveAperture(windowInfo.config)),leaf=windowAperture.primitives.find(p=>p.part==='leaf'),handleX=leaf.outer.half[0]-.068;
 P.push(finitePrism('evidence-window:vertical-handle',[rect(handleX-.009,-.105,handleX+.009,.105)],[-.064,-.042],{u:leaf.u,v:leaf.v,w:leaf.w,origin:leaf.origin,materialRole:13,materialKey:'observed_type_dark_metal_handle_design_dimensions'}));
 for(const y of [-.08,.08])P.push(finitePrism('evidence-window:handle-mount:'+y,[rect(handleX-.015,y-.012,handleX+.015,y+.012)],[-.045,-leaf.halfDepth],{u:leaf.u,v:leaf.v,w:leaf.w,origin:leaf.origin,materialRole:13,materialKey:'observed_type_dark_metal_handle_design_dimensions'}));
 windowInfo.hardwareEvidence='vertical_handle_observed_building_type; dimensions_and_mounts_authored';
 P.forEach((p,i)=>p.objectId=2000+i);
 const arch=studyArchetype('evidence-floor-plan',P,{schema:ASSEMBLY_SCHEMA,fieldKind:'evidence-assembly',caseId:'kcc',sourceOutline:outline,holes:{stair:null,lifts:[]}}),instance={id:root+':instance',archetypeId:arch.id,floorId:levelId,translation:[0,0,0],bounds:copy(arch.bounds),kind:'floor',objectIdOffset:0};
 const nodes=[],edges=[],node=(id,type,label,owner,extra={})=>{nodes.push({id,type,label,evidence:'public_plan_trace_in_unregistered_evidence_frame',actualFloorLabel:null,...extra});if(owner)edges.push({type:'ownedBy',from:id,to:owner});return id;};
 node(root,'evidence-plan','5/F–17/F 资料平面：尚未配准入整栋',null);node(root+':floor','evidence-floor','资料平面',root);node(root+':lobby','shared-circulation','电梯大堂与共用通路',root,{position:pp(1530,1151)});node(root+':unit-A','representative-unit-study','图纸 A 户',root);for(const key of ['B','C','D','E','F'])node(root+':unit-'+key,'plan-unit-placeholder','图纸 '+key+' 户：内部未细化',root,{roomGeometryGenerated:false});
 const roomIds={};for(const r of compiled.rooms){r.id=node(root+':room:'+r.key,'interior-room',r.label,root+':unit-A',{materialKey:r.materialKey,actualFinishKnown:false});r.worldCenter=copy(r.center);roomIds[r.key]=r.id;}
 const apertures=[...coreApertures],apertureConfigs=coreApertures.map(a=>a.config);
 for(const [i,d]of compiled.doors.entries()){d.id=node(root+':door:'+d.key,'hosted-door',d.key==='entry'?'A 户入口':d.key,root+':unit-A',{roughWidth:d.width,roughHeight:d.height});d.worldCenter=copy(d.center);const c={instanceId:80+i,kind:'door',width:d.width,height:d.height,frameWidth:.045,frameDepth:.10,wallThickness:d.wallThickness,roundRadius:0,hingeOrSlider:'hinge-left',openT:1,clearance:.012,host:{...copy(d.frame),nodeId:d.id+':host',emitWall:false}};apertureConfigs.push(c);apertures.push(recolorAperture(deriveAperture(c)));edges.push({type:'walksTo',from:d.from==='lobby'?root+':lobby':roomIds[d.from],to:d.id,geometryBacked:true},{type:'walksTo',from:d.id,to:roomIds[d.to],geometryBacked:true});}
 for(const c of PLAN_A_TOPOLOGY.connections)edges.push({type:'walksTo',from:roomIds[c.from],to:roomIds[c.to],geometryBacked:true});
 const wid=node(root+':window','evidence-hosted-window','单扇外开窗：未绑定实测外墙',root+':unit-A',{sourcePatchId:null});edges.push({type:'walksTo',from:roomIds[windowInfo.room],to:wid,geometryBacked:true});
 for(const port of corePorts){node(port.id,'lift-interface','图纸电梯接口',root);edges.push({type:'walksTo',from:root+':lobby',to:port.id,geometryBacked:true});}
 apertures.push(windowAperture);apertureConfigs.push(windowInfo.config);
 const lobby=pp(1530,1151),paths=[],routeFailures=[];for(const target of [...compiled.rooms.map(r=>({key:r.key,point:r.center,id:r.id})),{key:'source-window',point:[windowInfo.insidePoint[0],0,windowInfo.insidePoint[2]],id:wid}])try {const path=findPath(arch,lobby,target.point,{step:.15,bodyRadius:.14,apertures});paths.push({...path,id:root+':path:'+target.key,roomKey:target.key,floorId:levelId,from:root+':lobby',to:target.id});}catch(error){routeFailures.push({roomKey:target.key,reason:error.message});}
 const renderArchetypes=[],renderInstances=[];for(let k=0;k<P.length;k+=90){const chunk=studyArchetype('evidence-floor-plan:'+Math.floor(k/90),P.slice(k,k+90),arch);renderArchetypes.push(chunk);renderInstances.push({...instance,id:instance.id+':'+Math.floor(k/90),archetypeId:chunk.id,bounds:copy(chunk.bounds)});}
 const planLevel={id:levelId,nodeId:root+':floor',label:'资料平面，不是实测层',componentId:'evidence',index:0,elevation:0,localY:0,elevationMpd:null,fflM:null,height:3.0,clearHeight:2.82,actualFloorLabel:null,archetypeId:renderArchetypes[0].id};
 const evidenceModel={schema:WHOLE_BUILDING_SCHEMA,caseId:'kcc',sourceModelId:measured.sourceModelId,coordinateSystem:'independent_evidence_plan_right_up_down_inferred_metres',sourceGeoreference:null,sourceTransformApplied:false,sourceViewUnchanged:true,placementMode:'UNREGISTERED_evidence_plan_NOT_part_of_measured_mother',config:{slabThickness:.18,wallHeight,minimumHeadroom:2.3},levels:[planLevel],archetypes:renderArchetypes,instances:renderInstances,archetype:renderArchetypes[0],graph:{nodes,edges,actualInteriorComplete:false,designWholeBuildingConnected:false},interfaces:{lifts:[],stairs:[]},rails:{templates:[],instances:[]},components:[{id:'evidence',nodeId:root,floorIds:[levelId]}],bounds:copy(arch.bounds),coreBounds:{min:pp(1240,920),max:add(pp(1960,1420),[0,wallHeight,0])},focus:{core:pp(1530,1151),entry:copy(compiled.doors.find(d=>d.key==='entry').center)},sourceBinding:{sourceBounds:copy(arch.bounds),sourceOutline:copy(outline),registrationApplied:false},counts:{archetypes:renderArchetypes.length,primitives:P.length,instances:renderInstances.length,expandedPrimitiveCount:P.length,modelTriangles:0,modelVertexBuffers:0},summary:{floorCount:1,unitCount:6,detailedUnitCount:1,liftInterfaceCount:3,actualInteriorComplete:false,designClosure:false}};
 // Add the owning upper reference and its slab once. Views only choose
 // visible owner IDs; rooms, openings and graph objects are never duplicated.
 if(enclosure){
  const upperId='evidence-upper-reference',upperNode=root+':upper-floor',slabId=root+':upper-slab',openings=coreUpperOpenings(T,root,slabId);
  const slab=finitePrism(slabId,[outline,...openings.map(o=>o.polygon)],[enclosure.underside,enclosure.height],{materialRole:1,materialKey:'design_upper_concrete_slab_underside'});slab.objectId=2900;
  const upperArch=studyArchetype('evidence-upper-slab',[slab],{schema:ASSEMBLY_SCHEMA,fieldKind:'evidence-assembly',caseId:'kcc',sourceOutline:outline,holes:{stair:openings[3].polygon,lifts:openings.slice(0,3).map(o=>o.polygon)}});
  renderArchetypes.push(upperArch);renderInstances.push({id:slabId+':instance',archetypeId:upperArch.id,floorId:upperId,translation:[0,0,0],bounds:copy(upperArch.bounds),kind:'floor',objectIdOffset:0});
  Object.assign(planLevel,{height:enclosure.height,clearHeight:enclosure.underside,finishedClearHeight:enclosure.underside-compiled.metricAssumptions.floorFinishThickness,verticalDimensionsEvidence:'editable_design_not_measured'});
  evidenceModel.levels.push({id:upperId,nodeId:upperNode,label:'上层楼板参考（设计，非另一实测户型）',componentId:'evidence',index:1,elevation:enclosure.height,localY:enclosure.height,elevationMpd:null,fflM:null,height:null,clearHeight:null,actualFloorLabel:null,archetypeId:upperArch.id,geometryScope:'slab_only_no_upper_rooms',verticalDimensionsEvidence:'editable_design_not_measured'});
  node(upperNode,'design-adjacent-floor-reference','相邻上层，仅生成其楼板',root,{designLocalSlabTopM:enclosure.height,actualFloorLabel:null});node(slabId,'slab','上层所属楼板 / 本层顶面',upperNode,{primitiveObjectId:2900,designThicknessM:enclosure.slabThickness,topM:enclosure.height,bottomM:enclosure.underside,openingIds:openings.map(o=>o.id)});
  node(root+':lower-slab','slab','现有本层楼板',root+':floor',{primitiveNodeId:'floor:slab'});node(root+':stair-enclosure','stair-plan-interface','图纸双向楼梯范围，非已生成竖向楼梯',root+':floor');
  edges.push({type:'adjacentAbove',from:upperNode,to:root+':floor'});
  for(const o of openings){node(o.id,'slab-opening',o.purpose+' 设计留洞',slabId,{hostSlabId:slabId,relatedCoreId:o.relatedCoreId,polygon:copy(o.polygon),evidence:o.evidence});edges.push({type:'reservesCorePassage',from:o.id,to:o.relatedCoreId});}
  for(const room of compiled.rooms)edges.push({type:'upperBoundaryFor',from:slabId,to:room.id});
  for(const e of edges)if(e.type==='ownedBy'&&e.to===root&&(e.from===root+':lobby'||e.from.startsWith(root+':unit-')||corePorts.some(p=>p.id===e.from)))e.to=root+':floor';
  evidenceModel.components[0].floorIds.push(upperId);evidenceModel.bounds=bounds([...P,slab]);evidenceModel.coreBounds.max[1]=enclosure.height;evidenceModel.sourceBinding.sourceBounds=copy(evidenceModel.bounds);
  Object.assign(evidenceModel.config,{upperFloorDesign:enclosure,wallHeight});Object.assign(evidenceModel.counts,{archetypes:renderArchetypes.length,primitives:P.length+1,instances:renderInstances.length,expandedPrimitiveCount:P.length+1});
  Object.assign(evidenceModel.summary,{floorCount:2,currentDetailedFloorCount:1,upperSlabReferenceCount:1,designClosure:true,actualInteriorComplete:false});
  evidenceModel.upperFloorRelation={...enclosure,currentFloorId:levelId,upperFloorId:upperId,slabId,slabObjectId:2900,openings,cutawayVisibleFloorIds:[levelId],interiorVisibleFloorIds:[levelId,upperId],lowerCoreVoidNotRetrofitted:true,physicalStairRiseGenerated:false};
 }
 evidenceModel.floorStudy={floorId:levelId,apertures,sourceMasks:[],frame:{X:[1,0,0],Z:[0,0,1]},rooms:compiled.rooms,doors:compiled.doors,paths,windowBinding:windowInfo,corePorts,upperFloorRelation:evidenceModel.upperFloorRelation??null,registrationStatus:'orientation_ambiguous_not_as_built_registration',sourceRegistrationVerified:false};
 const candidates=registration?.all20_candidates??registration?.candidates??[];
 return{schema:FLOOR_STUDY_SCHEMA,baseModel,model:baseModel,measured,evidenceModel,evidenceArchetype:arch,evidenceInstance:instance,floorId:referenceFloorId,evidenceFloorId:levelId,status:'unregistered_evidence_plan',enabled:false,evidenceEnabled:true,metadata:{registrationStatus:registration?.status??'orientation_ambiguous_not_as_built_registration',registrationAccepted:false,candidates:copy(candidates),actualFloorLabel:null,referenceFloorId,referenceFloorElevation:reference.elevation,referenceFloorIsNotClaimedRegistration:true,sourcePlanFamily:PLAN_A_TOPOLOGY.planFamily,scaleMPerPixel,scaleEvidence:'inferred_global_similarity_scale_not_drawn_scale_bar_or_survey',pixelDomain:[3308,2339],imageCenterPixel:imageCenter,planOrientation:'paper_right_down_only_no_north',sourcePatchBinding:false,originalSourceUnchanged:true,motherModelUnchanged:true,actualFinishKnown:false,actualWindowPositionKnown:false,metricAssumptions:compiled.metricAssumptions,dimensionsNotOneToOneSurvey:true,stairDepiction:'8_mm_plan_direction_bands_not_physical_rise',platformPolicy:'sixth_floor_platform_not_extruded_as_every_floor_balcony',noModelMesh:true,otherFiveUnitInteriorsNotInvented:true},archetypes:renderArchetypes,instances:renderInstances,rooms:compiled.rooms,doors:compiled.doors,apertures,apertureConfigs,sourceMasks:[],windowBinding:windowInfo,corePorts,graph:{nodes,edges},paths,validation:{valid:routeFailures.length===0,allRoomsConnectedToEvidenceLobby:routeFailures.length===0,routeFailures,originalSourceUnchanged:true,motherModelUnchanged:true,allPlanCoordinatesUseOriginalImagePixels:true,sourceRegistrationVerified:false,noModelMesh:true,structuralOrFireSafetyCertification:false}};
}

/** Renderer convenience API. Full diagnostics remain in deriveEvidenceFloorPlan. */
export function deriveEvidencePlanModel(baseModel,measured,options={}){const s=deriveEvidenceFloorPlan(baseModel,measured,options);s.evidenceModel.floorStudy.metadata=s.metadata;s.evidenceModel.floorStudy.validation=s.validation;return s.evidenceModel;}
