/** Authored GAME yard study. No historical photograph, no standards certification.
 * Coordinates: local s follows the supplied route; positive u is route.right.
 * No edits to the supplied route/profile or the old Kowloon station are made.
 */
export const DEFAULT_PARAMETERS = Object.freeze({
  variant:'five_track', designCoachCount:8, usableLengthM:250, throatLengthM:140, rootStaggerM:20,
  branchSplitDistanceM:40, approachStubM:30, innerOffsetM:4.8, outerTrackGapM:10.4,
  platformEdgeOffsetM:1.8, platformLengthM:250, railGaugeM:1.435,
  bedWidthM:3.7, tieLengthM:2.35, tieWidthM:.22, tiePitchM:.72,
  locoTenderLengthM:28.3, coachLengthM:23, couplingGapM:.8, vehicleWidthM:2.95,
  stopMarginEachEndM:15, trackEnvelopeHalfWidthM:2.225,
  pointSpeedKmh:15, minimumCandidateRadiusM:100, maxLateralAccelerationMps2:.2,
  maximumMainGradePermille:15, stationGradeTolerancePermille:.1,
  canopySpanM:60, canopyLengthM:135, canopyBayM:7.5, canopyEnabled:false,
  sampleStepM:2, buildingEnvelopeMarginM:1,
});
const EPS=1e-7;
const clone=x=>JSON.parse(JSON.stringify(x));
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(10+t*(-15+6*t));};
const d3=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const lengthOf=pts=>pts.slice(1).reduce((v,p,i)=>v+d3(p.p,pts[i].p),0);
const unique=a=>[...new Set(a)];
function assert(ok,message){if(!ok)throw new Error(message);}
function radiusOf(a,b,c){const ax=b[0]-a[0],az=b[2]-a[2],bx=c[0]-b[0],bz=c[2]-b[2];const cross=Math.abs(ax*bz-az*bx);return cross<1e-12?Infinity:Math.hypot(ax,az)*Math.hypot(bx,bz)*Math.hypot(c[0]-a[0],c[2]-a[2])/(2*cross);}
function dimensions(p){
  const H=p.usableLengthM/2;
  return {half:H, flatHalf:H+p.throatLengthM+p.rootStaggerM,
    yardLengthM:p.usableLengthM+2*(p.throatLengthM+p.rootStaggerM),
    extHalf:H+p.throatLengthM+p.rootStaggerM+p.approachStubM};
}
export function trainEnvelope(coachCount,p=DEFAULT_PARAMETERS){
  assert(Number.isInteger(coachCount)&&coachCount>=0,'coachCount must be a non-negative integer');
  const bodySumM=p.locoTenderLengthM+coachCount*p.coachLengthM;
  const totalM=bodySumM+coachCount*p.couplingGapM;
  return {coachCount,bodySumM,totalM,couplingCount:coachCount,
    couplingPolicy:'R05 explicitly authored 0.8m gap between retained vehicle coupler bounds',
    requiredUsableLengthM:totalM+2*p.stopMarginEachEndM,
    marginAtEachEndWhenCentredM:(p.usableLengthM-totalM)/2,
    fits:p.usableLengthM+EPS>=totalM+2*p.stopMarginEachEndM};
}
function validateParameters(p){
  for(const [key,value] of Object.entries(p)) if(typeof value==='number')assert(Number.isFinite(value)&&value>=0,`invalid parameter ${key}`);
  assert(['five_track','three_track'].includes(p.variant),'unknown yard variant');
  assert(Number.isInteger(p.designCoachCount)&&p.designCoachCount>=1&&p.designCoachCount<=8,'R05 coach count must be an integer 1–8');
  assert(p.sampleStepM>0&&p.usableLengthM>0,'positive sample step and length required');
  assert(p.branchSplitDistanceM>0&&p.branchSplitDistanceM<p.throatLengthM,'split must lie within each throat');
  assert(p.innerOffsetM>=p.vehicleWidthM,'inner track static bodies overlap');
  assert(p.outerTrackGapM>2*p.platformEdgeOffsetM,'no island platform width');
  assert(p.platformLengthM<=p.usableLengthM,'platform exceeds the parallel usable zone');
  assert(p.canopyBayM>0&&Math.abs(p.canopyLengthM/p.canopyBayM-Math.round(p.canopyLengthM/p.canopyBayM))<EPS,'canopy length must be an integral number of 7.5 m prototype bays');
  assert(p.railGaugeM<p.tieLengthM&&p.tieLengthM<=p.bedWidthM,'incoherent track bed dimensions');
  assert(p.maximumMainGradePermille<=15,'the shared 15 permille constraint must not be relaxed');
}
export function buildYard({centerS=0,sampleRoute,parameters={},sourceRouteLengthM=null,geographicRegistration=null}={}){
  const p={...DEFAULT_PARAMETERS,...parameters};validateParameters(p);assert(Number.isFinite(centerS),'invalid centre chainage');
  const q=dimensions(p),worldRegistered=typeof sampleRoute==='function';
  const base=sampleRoute??(s=>({p:[s,0,0],f:[1,0,0],right:[0,0,1],grade:0}));
  if(sourceRouteLengthM!==null)assert(centerS>=q.extHalf&&centerS+q.extHalf<=sourceRouteLengthM,'yard extends beyond supplied route domain');
  function point(s,u=0){const a=base(centerS+s);assert(a?.p?.length===3&&a.p.every(Number.isFinite),'invalid route sample');
    let right=a.right;
    if(!right){const h=Math.hypot(a.f?.[0],a.f?.[2]);assert(h>0,'route tangent missing');right=[-a.f[2]/h,0,a.f[0]/h];}
    assert(right.every(Number.isFinite)&&Math.abs(Math.hypot(right[0],right[2])-1)<1e-4&&Math.abs(right[1])<EPS,'route.right must be a horizontal unit vector');
    return {local:[s,u],chainageM:centerS+s,p:[a.p[0]+right[0]*u,a.p[1],a.p[2]+right[2]*u],grade:Number.isFinite(a.grade)?a.grade:null};
  }
  const nodes=[],edges=[],turnouts=[],roads=[],platforms=[],paths={};
  function node(id,s,u=0){const n={id,...point(s,u)};nodes.push(n);return id;}
  const nodeBy=id=>nodes.find(n=>n.id===id);
  function edge(id,from,to,fn,kind='connector',resource=null){
    const a=nodeBy(from).local[0],b=nodeBy(to).local[0],n=Math.max(2,Math.ceil(Math.abs(b-a)/p.sampleStepM));
    const samples=Array.from({length:n+1},(_,i)=>point(a+(b-a)*i/n,fn(a+(b-a)*i/n)));
    assert(d3(samples[0].p,nodeBy(from).p)<EPS&&d3(samples.at(-1).p,nodeBy(to).p)<EPS,`endpoint mismatch ${id}`);
    const e={id,from,to,kind,resource,points:samples,lengthM:lengthOf(samples)};edges.push(e);return id;
  }
  const negRoot={L:-(q.half+p.throatLengthM+p.rootStaggerM),R:-(q.half+p.throatLengthM)};
  node('APP_NEG',-q.extHalf);node('MROOT_NEG_L',negRoot.L);node('MROOT_NEG_R',negRoot.R);node('M_NEG',-q.half);node('M_POS',q.half);node('MROOT_POS_R',-negRoot.R);node('MROOT_POS_L',-negRoot.L);node('APP_POS',q.extHalf);
  const mid=['APP_NEG','MROOT_NEG_L','MROOT_NEG_R','M_NEG','M_POS','MROOT_POS_R','MROOT_POS_L','APP_POS'];
  const mainEdges=mid.slice(1).map((id,i)=>edge(`MAIN_${i}`,mid[i],id,()=>0,i===3?'usable_track':'mainline',i===3?'TRACK_M':null));
  paths.M={negative:mainEdges.slice(0,3),track:mainEdges[3],positive:mainEdges.slice(4)};
  roads.push({id:'M',role:'central_through_no_platform',offsetM:0,usableLengthM:p.usableLengthM,edge:mainEdges[3],platformIds:[]});
  for(const side of ['L','R']){
    const sign=side==='L'?-1:1,root=negRoot[side],split=root+p.branchSplitDistanceM;
    const inner=s=>sign*p.innerOffsetM*smooth((s-root)/(-q.half-root));
    const outer=s=>inner(s)+sign*p.outerTrackGapM*smooth((s-split)/(-q.half-split));
    node(`${side}S_NEG`,split,inner(split));node(`${side}1_NEG`,-q.half,sign*p.innerOffsetM);node(`${side}1_POS`,q.half,sign*p.innerOffsetM);node(`${side}S_POS`,-split,inner(split));
    const eA=edge(`${side}_NEG_ROOT_SPLIT`,`MROOT_NEG_${side}`,`${side}S_NEG`,inner);
    const eB=edge(`${side}1_NEG_CURVE`,`${side}S_NEG`,`${side}1_NEG`,inner);
    const tr=edge(`${side}1_TRACK`,`${side}1_NEG`,`${side}1_POS`,()=>sign*p.innerOffsetM,'usable_track',`TRACK_${side}1`);
    const eC=edge(`${side}1_POS_CURVE`,`${side}1_POS`,`${side}S_POS`,s=>inner(-s));
    const eD=edge(`${side}_POS_SPLIT_ROOT`,`${side}S_POS`,`MROOT_POS_${side}`,s=>inner(-s));
    const pre=side==='L'?mainEdges.slice(0,1):mainEdges.slice(0,2),post=side==='L'?mainEdges.slice(6):mainEdges.slice(5);
    paths[`${side}1`]={negative:[...pre,eA,eB],track:tr,positive:[eC,eD,...post]};
    roads.push({id:`${side}1`,role:p.variant==='five_track'?'inner_passing_passenger':'passing_passenger',offsetM:sign*p.innerOffsetM,usableLengthM:p.usableLengthM,edge:tr,platformIds:[`P_${side}`]});
    turnouts.push({id:`SW_NEG_${side}_ROOT`,node:`MROOT_NEG_${side}`,common:pre.at(-1),normal:mainEdges[side==='L'?1:2],reverse:eA,default:'normal'},
      {id:`SW_POS_${side}_ROOT`,node:`MROOT_POS_${side}`,common:post[0],normal:mainEdges[side==='L'?5:4],reverse:eD,default:'normal'});
    if(p.variant==='five_track'){
      node(`${side}2_NEG`,-q.half,sign*(p.innerOffsetM+p.outerTrackGapM));node(`${side}2_POS`,q.half,sign*(p.innerOffsetM+p.outerTrackGapM));
      const n=edge(`${side}2_NEG_CURVE`,`${side}S_NEG`,`${side}2_NEG`,outer);
      const t=edge(`${side}2_TRACK`,`${side}2_NEG`,`${side}2_POS`,()=>sign*(p.innerOffsetM+p.outerTrackGapM),'usable_track',`TRACK_${side}2`);
      const x=edge(`${side}2_POS_CURVE`,`${side}2_POS`,`${side}S_POS`,s=>outer(-s));
      paths[`${side}2`]={negative:[...pre,eA,n],track:t,positive:[x,eD,...post]};
      roads.push({id:`${side}2`,role:'outer_passing_parking_passenger',offsetM:sign*(p.innerOffsetM+p.outerTrackGapM),usableLengthM:p.usableLengthM,edge:t,platformIds:[`P_${side}`]});
      turnouts.push({id:`SW_NEG_${side}_SPLIT`,node:`${side}S_NEG`,common:eA,normal:eB,reverse:n,default:'normal'},
        {id:`SW_POS_${side}_SPLIT`,node:`${side}S_POS`,common:eD,normal:eC,reverse:x,default:'normal'});
    }
    const near=sign*(p.innerOffsetM+p.platformEdgeOffsetM),far=sign*(p.innerOffsetM+p.outerTrackGapM-p.platformEdgeOffsetM);
    const width=Math.abs(far-near),h=p.platformLengthM/2;
    const boundarySteps=Math.max(2,Math.ceil(p.platformLengthM/p.sampleStepM));
    const boundaryNear=Array.from({length:boundarySteps+1},(_,i)=>point(-h+2*h*i/boundarySteps,near).p);
    const boundaryFar=Array.from({length:boundarySteps+1},(_,i)=>point(h-2*h*i/boundarySteps,far).p);
    platforms.push({id:`P_${side}`,kind:p.variant==='five_track'?'island':'side',serves:p.variant==='five_track'?[`${side}1`,`${side}2`]:[`${side}1`],centerOffsetM:(near+far)/2,widthM:width,lengthM:p.platformLengthM,localPolygon:[[-h,near],[h,near],[h,far],[-h,far]],worldPolygon:[...boundaryNear,...boundaryFar],columnAxisOffsetM:side==='L'?-10:10,columnMaximumFootprintM:.96,minimumClearStripEitherSideOfCenteredColumnM:(width-.96)/2,access:'Reservation for an airport-side concourse/grade-separated link only; no public at-grade crossing through operating tracks.'});
  }
  const byEdge=id=>edges.find(e=>e.id===id),routes=[];
  function makeRoute(id,roadId,kind,start,edgeIds,throats,external){
    let current=start;const sequence=[current];for(const eid of edgeIds){const e=byEdge(eid);assert(e.from===current||e.to===current,`route disconnected ${id}/${eid}`);current=e.from===current?e.to:e.from;sequence.push(current);}
    const settings={};for(const sw of turnouts){const ix=sequence.indexOf(sw.node);if(ix>0&&ix<sequence.length-1){const pair=[edgeIds[ix-1],edgeIds[ix]];assert(pair.includes(sw.common)&&!(pair.includes(sw.normal)&&pair.includes(sw.reverse)),`invalid turnout traversal ${id}/${sw.id}`);settings[sw.id]=pair.includes(sw.reverse)?'reverse':'normal';}}
    const resources=unique([`TRACK_${roadId}`,...throats.map(t=>`THROAT_${t}`),...external.map(t=>`EXTERNAL_${t}`),...Object.keys(settings).map(t=>`POINT_${t}`),...edgeIds.map(e=>`EDGE_${e}`)]);
    routes.push({id,roadId,kind,start,end:current,edgeIds,nodeSequence:sequence,pointSettings:settings,resources,lengthM:edgeIds.reduce((v,e)=>v+byEdge(e).lengthM,0)});
  }
  for(const [id,a]of Object.entries(paths)){
    const e=byEdge(a.track);
    makeRoute(`NEG_TO_${id}`,id,'arrival','APP_NEG',[...a.negative,a.track],['NEG'],['NEG']);
    makeRoute(`POS_TO_${id}`,id,'arrival','APP_POS',[...a.positive].reverse().concat(a.track),['POS'],['POS']);
    makeRoute(`${id}_TO_POS`,id,'departure',e.from,[a.track,...a.positive],['POS'],['POS']);
    makeRoute(`${id}_TO_NEG`,id,'departure',e.to,[a.track,...a.negative.slice().reverse()],['NEG'],['NEG']);
    makeRoute(`NEG_VIA_${id}_TO_POS`,id,'through','APP_NEG',[...a.negative,a.track,...a.positive],['NEG','POS'],['NEG','POS']);
  }
  const gradeSamples=Array.from({length:Math.ceil(q.yardLengthM/p.sampleStepM)+1},(_,i)=>point(-q.flatHalf+Math.min(q.yardLengthM,i*p.sampleStepM)));
  const canopyHalf=p.canopySpanM/2,canopyLong=p.canopyLengthM/2;
  const center=base(centerS),ch=Math.hypot(center.f?.[0]??1,center.f?.[2]??0),right=center.right??[-(center.f?.[2]??0)/ch,0,(center.f?.[0]??1)/ch],forward=[right[2],0,-right[0]];
  const rigidPoint=(s,u)=>center.p.map((v,i)=>v+forward[i]*s+right[i]*u);
  const roofPoints=[rigidPoint(-canopyLong,-canopyHalf),rigidPoint(canopyLong,-canopyHalf),rigidPoint(canopyLong,canopyHalf),rigidPoint(-canopyLong,canopyHalf)];
  const mainDrift=Math.max(...gradeSamples.filter(a=>Math.abs(a.local[0])<=canopyLong).map(a=>Math.abs((a.p[0]-center.p[0])*right[0]+(a.p[2]-center.p[2])*right[2])));
  const yard={schema:'tinhau-yard-route-r01/1',status:'authored_game_design_not_historical_cad_or_engineering_approval',parameters:p,centerS,worldRegistered,geographicRegistration:clone(geographicRegistration),dimension:q,
    routeContract:'Central M centerline is exactly sampleRoute(centerS+s). All Y values come from this same profile; no independent DEM or local flattening.',
    stationProfileRequest:{centerS,startS:centerS-q.flatHalf,endS:centerS+q.flatHalf,targetGradePermille:0,tolerancePermille:p.stationGradeTolerancePermille,maxGlobalGradePermille:15,flatLengthM:q.yardLengthM,approachVerticalTransitions:'Required outside this interval in the shared mainline vertical profile; cannot add local Y offsets.'},
    evidence:{trackCount:'Five yellow strokes are visually distinguishable in the central part of the supplied annotated image; five tracks are an editable inference, not an exact user-specified count.',redMarks:'Authored building/envelope suggestions only; unlabelled individual building functions remain unassigned.',photoNotIncluded:true},
    vehicles:{source:'R05 retained 88 and GrandCoach actual coupler envelopes; authored 0.8m gaps. No new A6 mother.',envelopes:[...new Set([p.designCoachCount,6,8])].map(n=>trainEnvelope(n,p))},
    nodes,edges,roads,turnouts,routes,platforms,gradeSamples,
    rail:{gaugeM:p.railGaugeM,bedWidthM:p.bedWidthM,tieLengthM:p.tieLengthM,tieWidthM:p.tieWidthM,tiePitchM:p.tiePitchM},
    canopy:{enabled:p.canopyEnabled,oldStationMutation:false,newInstanceOnly:true,prototypeSpanCount:3,prototypeSpanM:20,newInstanceSpanPerBayM:p.canopySpanM/3,spanM:p.canopySpanM,lengthM:p.canopyLengthM,bayM:p.canopyBayM,bayCount:p.canopyLengthM/p.canopyBayM,columnAxesM:[-p.canopySpanM/2,-p.canopySpanM/6,p.canopySpanM/6,p.canopySpanM/2],coveredUsableLengthM:Math.min(p.canopyLengthM,p.usableLengthM),uncoveredAtEachEndM:Math.max(0,(p.usableLengthM-p.canopyLengthM)/2),optionalNewInstanceLengthsM:[135,255,270],worldPolygon:roofPoints,frame:{origin:center.p,forward,right},mainlineLateralDriftUnderRigidRoofM:mainDrift,note:'135 m prototype covers only the middle; 255/270 m are optional 34/36-bay new instances, never a rewrite of the old 18-bay shed.'},
    limitations:['Game geometry and static conflict screening only. No real turnout product, signalling safety, braking, moving wheelset, suspension, platform crowd, or structural certification.','The side-track route graph is usable by a future controller, but current host driving may remain on central M. Drawing these rails does not assert operable side-track driving.','No claim of building clearance is valid until registered existing-building footprints and the roof envelope are checked.','A6 repeated 0.8 m coupling spaces follow the existing layout convention; actual articulated/coupler geometry still needs dynamic verification.'],
  };
  // Callable samplers are deliberately omitted by JSON serialization; static points remain.
  yard.sampleLocal=point;
  for(const e of edges)e.sample=(distanceM)=>samplePolyline(e.points,distanceM);
  yard.validation=validateYard(yard);return yard;
}
export function samplePolyline(points,distanceM){
  let left=Math.max(0,distanceM);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],len=d3(a.p,b.p);if(left<=len||i===points.length-1){const t=len>0?Math.min(1,left/len):0;const p=a.p.map((v,k)=>v+(b.p[k]-v)*t);const f=len>0?b.p.map((v,k)=>(v-a.p[k])/len):[1,0,0];const horizontal=Math.hypot(f[0],f[2]);return {p,f,right:horizontal>EPS?[-f[2]/horizontal,0,f[0]/horizontal]:[0,0,1],grade:horizontal>EPS?f[1]/horizontal:0,role:'tinhau-yard',local:a.local.map((v,k)=>v+(b.local[k]-v)*t)};}left-=len;}return {p:points[0].p.slice(),f:[1,0,0],local:points[0].local.slice()};
}
export function sampleYardRoute(yard,routeId,distanceM){
  const route=yard.routes.find(r=>r.id===routeId);assert(route,`unknown route ${routeId}`);let left=Math.max(0,distanceM);
  for(let i=0;i<route.edgeIds.length;i++){const e=yard.edges.find(e=>e.id===route.edgeIds[i]),forward=e.from===route.nodeSequence[i];if(left<=e.lengthM||i===route.edgeIds.length-1){const a=samplePolyline(e.points,forward?left:Math.max(0,e.lengthM-left));if(!forward){a.f=a.f.map(v=>-v);a.right=a.right.map(v=>-v);a.grade=-a.grade;}return a;}left-=e.lengthM;}
}
export function routesConflict(a,b){const s=new Set(a.resources);return {conflict:b.resources.some(v=>s.has(v)),shared:b.resources.filter(v=>s.has(v))};}
export function canReserveRoute(yard,routeId,{occupied={},reserved={},pointStates={},ownTrainId=null}={}){
  const route=yard.routes.find(r=>r.id===routeId);assert(route,'unknown route');const reasons=[];
  for(const resource of route.resources){if(occupied[resource]!==undefined&&!(ownTrainId!==null&&occupied[resource]===ownTrainId&&resource===`TRACK_${route.roadId}`&&route.kind==='departure'))reasons.push(`occupied:${resource}`);if(reserved[resource]!==undefined&&reserved[resource]!==ownTrainId)reasons.push(`reserved:${resource}`);}
  for(const [id,position]of Object.entries(route.pointSettings)){const a=pointStates[id];if(!a||a.position!==position||a.detected!==true||a.locked!==true||a.moving===true)reasons.push(`point_not_detected_and_locked:${id}`);}
  return {ok:reasons.length===0,reasons};
}
export function validateOccupancy(yard,trains){
  const errors=[],seen=new Set();for(const a of trains){const road=yard.roads.find(r=>r.id===a.roadId);if(!road){errors.push(`unknown_road:${a.roadId}`);continue;}if(seen.has(a.roadId))errors.push(`multiple_trains_on_road:${a.roadId}`);seen.add(a.roadId);if(!Number.isFinite(a.centerLocalS)||!Number.isFinite(a.lengthM)||a.lengthM<=0){errors.push(`invalid_train_span:${a.id}`);continue;}if(Math.abs(a.centerLocalS)+a.lengthM/2>yard.dimension.half+EPS)errors.push(`train_fouls_throat:${a.id}`);}
  return {ok:errors.length===0,errors};
}
export function validateYard(yard){
  const p=yard.parameters,errors=[],warnings=[],byNode=new Map(yard.nodes.map(n=>[n.id,n])),byEdge=new Map(yard.edges.map(e=>[e.id,e]));
  for(const e of yard.edges){if(!byNode.has(e.from)||!byNode.has(e.to)||e.lengthM<=0)errors.push(`invalid_edge:${e.id}`);if(d3(e.points[0].p,byNode.get(e.from).p)>EPS||d3(e.points.at(-1).p,byNode.get(e.to).p)>EPS)errors.push(`endpoint_gap:${e.id}`);}
  for(const sw of yard.turnouts){const incident=yard.edges.filter(e=>e.from===sw.node||e.to===sw.node).map(e=>e.id);if(incident.length!==3||![sw.common,sw.normal,sw.reverse].every(e=>incident.includes(e)))errors.push(`invalid_turnout_ports:${sw.id}`);}
  for(const r of yard.routes)for(let i=0;i<r.edgeIds.length;i++){const e=byEdge.get(r.edgeIds[i]);if(!e||![[e.from,e.to],[e.to,e.from]].some(x=>x[0]===r.nodeSequence[i]&&x[1]===r.nodeSequence[i+1]))errors.push(`route_gap:${r.id}`);}
  const curves=yard.edges.map(e=>{let min=Infinity;for(let i=1;i<e.points.length-1;i++)min=Math.min(min,radiusOf(e.points[i-1].p,e.points[i].p,e.points[i+1].p));return {edgeId:e.id,minRadiusM:Number.isFinite(min)?min:null,lateralAccelerationMps2:Number.isFinite(min)?(p.pointSpeedKmh/3.6)**2/min:0};});
  let minJoinedRouteRadiusM=Infinity;
  for(const r of yard.routes){const points=[];for(let i=0;i<r.edgeIds.length;i++){const e=byEdge.get(r.edgeIds[i]),arr=e.from===r.nodeSequence[i]?e.points:e.points.slice().reverse();points.push(...(points.length?arr.slice(1):arr));}for(let i=1;i<points.length-1;i++)minJoinedRouteRadiusM=Math.min(minJoinedRouteRadiusM,radiusOf(points[i-1].p,points[i].p,points[i+1].p));}
  if(minJoinedRouteRadiusM<p.minimumCandidateRadiusM-EPS)errors.push('joined_route_radius_below_limit');
  for(const c of curves)if(c.minRadiusM!==null&&c.minRadiusM<p.minimumCandidateRadiusM-EPS)errors.push(`candidate_radius_below_limit:${c.edgeId}`);
  for(const c of curves)if(c.lateralAccelerationMps2>p.maxLateralAccelerationMps2+EPS)errors.push(`candidate_lateral_acceleration:${c.edgeId}`);
  let actualGrade=0,reportedGrade=0,unknownGrades=0;const gs=yard.gradeSamples;
  for(let i=1;i<gs.length;i++){const a=gs[i-1].p,b=gs[i].p;const d=Math.hypot(b[0]-a[0],b[2]-a[2]);if(d>EPS)actualGrade=Math.max(actualGrade,1000*Math.abs(b[1]-a[1])/d);}
  for(const s of gs)if(s.grade===null)unknownGrades++;else reportedGrade=Math.max(reportedGrade,1000*Math.abs(s.grade));
  if(actualGrade>p.stationGradeTolerancePermille+EPS||reportedGrade>p.stationGradeTolerancePermille+EPS)errors.push('shared_profile_station_not_flat');
  let exportedMainMaxGrade=reportedGrade;
  for(const e of yard.edges.filter(e=>e.id.startsWith('MAIN_')))for(let i=0;i<e.points.length;i++){const a=e.points[i];if(a.grade!==null)exportedMainMaxGrade=Math.max(exportedMainMaxGrade,Math.abs(a.grade)*1000);if(i){const b=e.points[i-1],h=Math.hypot(a.p[0]-b.p[0],a.p[2]-b.p[2]);if(h>EPS)exportedMainMaxGrade=Math.max(exportedMainMaxGrade,Math.abs(a.p[1]-b.p[1])*1000/h);}}
  if(Math.max(actualGrade,reportedGrade,exportedMainMaxGrade)>15+EPS)errors.push('shared_profile_grade_exceeds_15_permille');
  if(unknownGrades)warnings.push('Some route samples lack a declared grade; sampled height slope alone was checked.');
  for(const t of yard.vehicles.envelopes)if(!t.fits){if(t.coachCount===p.designCoachCount)errors.push(`train_${t.coachCount}_coaches_does_not_fit`);else warnings.push(`The ${t.coachCount}-coach comparison does not fit this ${p.designCoachCount}-coach design.`);}
  if(p.innerOffsetM<2*p.trackEnvelopeHalfWidthM)errors.push('parallel_main_inner_envelopes_overlap');
  const platformStaticGapM=p.platformEdgeOffsetM-p.vehicleWidthM/2;
  if(platformStaticGapM<=0)errors.push('platform_intersects_static_vehicle_body');
  if(!yard.worldRegistered)warnings.push('Local demonstration frame only; not a registered site clearance result.');
  warnings.push('Actual existing-building footprints have not been checked by this validator.');
  if(Math.abs(p.canopySpanM-60)>EPS)warnings.push('New-instance roof span differs from the preserved 3x20 m prototype; shifted column axes and platform clearance need a new check.');
  if(yard.canopy.mainlineLateralDriftUnderRigidRoofM>.5)warnings.push('Mainline curves under the rigid roof; recheck column/vehicle and platform fit before instancing the shed.');
  if(!yard.canopy.enabled)warnings.push('Canopy remains an inactive new-instance option; no old roof is mutated.');
  if(yard.canopy.uncoveredAtEachEndM>0)warnings.push(`Canopy leaves ${yard.canopy.uncoveredAtEachEndM} m of platform uncovered at each end.`);
  return {ok:errors.length===0,errors,warnings,counts:{tracks:yard.roads.length,turnouts:yard.turnouts.length,nodes:yard.nodes.length,edges:yard.edges.length,routes:yard.routes.length},geometry:{curves,minJoinedRouteRadiusM:Number.isFinite(minJoinedRouteRadiusM)?minJoinedRouteRadiusM:null,minRadiusM:Math.min(...curves.map(x=>x.minRadiusM??Infinity)),pointSpeedKmh:p.pointSpeedKmh,maxLateralAccelerationMps2:Math.max(...curves.map(x=>x.lateralAccelerationMps2)),exportedMainlineMaxGradePermille:exportedMainMaxGrade,flatProfileSampledMaxGradePermille:actualGrade,flatProfileDeclaredMaxGradePermille:reportedGrade,platformStaticBodyGapM:platformStaticGapM,centralToInnerStaticBodyGapM:p.innerOffsetM-p.vehicleWidthM,railEnvelopeWidthM:2*((p.variant==='five_track'?p.innerOffsetM+p.outerTrackGapM:p.innerOffsetM)+p.trackEnvelopeHalfWidthM),roofControlWidthM:p.canopySpanM},buildingClearanceStatus:'not_checked',operationalStatus:'static_topology_only_not_host_side_track_driving'};
}
// 2D footprint screen, intentionally conservative about vertical separation.
function cross(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function on(a,b,c){return Math.abs(cross(a,b,c))<EPS&&c[0]>=Math.min(a[0],b[0])-EPS&&c[0]<=Math.max(a[0],b[0])+EPS&&c[1]>=Math.min(a[1],b[1])-EPS&&c[1]<=Math.max(a[1],b[1])+EPS;}
function intersects(a,b,c,d){return (cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);}
function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(on(a,b,p))return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function segDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function segmentPolygonDistance(a,b,poly){if(inside(a,poly)||inside(b,poly))return 0;let d=Infinity;for(let i=0;i<poly.length;i++){const c=poly[i],e=poly[(i+1)%poly.length];if(intersects(a,b,c,e))return 0;d=Math.min(d,segDistance(a,c,e),segDistance(b,c,e),segDistance(c,a,b),segDistance(e,a,b));}return d;}
export function checkBuildingClearance(yard,{obstacles=[],coverageComplete=false,includeProposedCanopy=true}={}){
  const hits=[],to2=p=>[p[0],p[2]],margin=yard.parameters.buildingEnvelopeMarginM;
  for(const ob of obstacles){assert(ob.id&&ob.polygon?.length>=3,'obstacle requires id and world [X,Z] polygon');assert(ob.polygon.every(p=>p.length===2&&p.every(Number.isFinite)),'invalid obstacle coordinates');const poly=ob.polygon;
    for(const e of yard.edges){let distance=Infinity;for(let i=1;i<e.points.length;i++)distance=Math.min(distance,segmentPolygonDistance(to2(e.points[i-1].p),to2(e.points[i].p),poly));if(distance<yard.parameters.trackEnvelopeHalfWidthM+margin)hits.push({buildingId:ob.id,element:e.id,kind:'track_static_corridor',distanceM:distance,requiredM:yard.parameters.trackEnvelopeHalfWidthM+margin});}
    const polys=yard.platforms.map(p=>({id:p.id,kind:'platform',points:p.worldPolygon}));if(includeProposedCanopy)polys.push({id:'PROPOSED_CANOPY',kind:'roof_footprint_even_if_disabled',points:yard.canopy.worldPolygon});
    for(const item of polys){const points=item.points.map(to2);let distance=inside(poly[0],points)||inside(points[0],poly)?0:Infinity;for(let i=0;i<points.length;i++)distance=Math.min(distance,segmentPolygonDistance(points[i],points[(i+1)%points.length],poly));if(distance<margin+EPS)hits.push({buildingId:ob.id,element:item.id,kind:item.kind,distanceM:distance,requiredM:margin});}
  }
  return {status:hits.length?'conflicts_found':coverageComplete?'clear_in_supplied_complete_2d_dataset':'unverified_incomplete_building_coverage',clear:hits.length===0&&coverageComplete,coverageComplete,obstacleCount:obstacles.length,hits,limitations:'2D static corridor screen, not vehicle dynamic sweep or structural/vertical clearance. No existing building is moved or deleted.'};
}
export function serializableYard(yard){return JSON.parse(JSON.stringify(yard,(k,v)=>typeof v==='function'?undefined:!Number.isFinite(v)&&typeof v==='number'?null:v));}

/** Use existing makeTrack on these unique edges. MAIN is omitted to avoid doubling the host rails. */
export function makeRenderRoutes(yard){
  return yard.edges.filter(e=>!e.id.startsWith('MAIN_')).map(e=>{
    let d=0;const points=e.points.map((a,i)=>{if(i)d+=d3(a.p,e.points[i-1].p);return {x:a.p[0],y:a.p[1],z:a.p[2],d,role:'tinhau-yard'};});
    return {id:e.id,length:e.lengthM,lengthM:e.lengthM,points,renderPoints:points,
      sample:distanceM=>samplePolyline(e.points,distanceM),
      metadata:{from:e.from,to:e.to,kind:e.kind,sourceRoad:e.resource,sharedEndpoint:true,graphOnlyDriving:false}};
  });
}
