import{platformEdgeWGSL}from'./native-platform-edge.mjs';
import{stationWaterfrontWGSL}from'./native-station-waterfront.mjs';
import{stationLetteringWGSL}from'./native-station-lettering.mjs';
import{terminalHallWGSL,terminalHallMembers,terminalHallBounds}from'./native-terminal-hall.mjs';
import{stationRailWGSL}from'./native-station-rail.mjs';
import{stationLampWGSL}from'./native-station-lamps.mjs';
import{footbridgeWGSL,footbridgeBounds}from'./native-footbridge.mjs';
import{clockTowerWGSL}from'./native-clock-tower.mjs';
import{stationBenchWGSL}from'./native-station-bench.mjs';
import{archTrussWGSL}from'./native-arch-truss.mjs';
import{shedRoofWGSL}from'./native-shed-roof.mjs';
import{castColumnWGSL}from'./native-cast-column.mjs';
import {SITE_WGSL,STATION_SCORE} from './station-score.mjs';
// Authored continuous station domain. No component vertex/index buffers.
export function createStationFieldWGSL({construction=null,hostWGSL=""}={}){
 const host=construction?.host;const deck=host?.boardingIsland.topLocalYM??.85,eave=STATION_SCORE.shed.eave;const f=n=>Number.isInteger(n)?n+".":String(n);
 const titleAnchor=terminalHallMembers({...STATION_SCORE.hall,deck}).anchors[0],terminalBound=terminalHallBounds({...STATION_SCORE.hall,deck}),terminalCenter=terminalBound.min.map((x,i)=>(x+terminalBound.max[i])/2),terminalHalf=terminalBound.min.map((x,i)=>(terminalBound.max[i]-x)/2);
 const bridge={...STATION_SCORE.bridge,deck,stairCenters:host?STATION_SCORE.bridge.stairCenters:[-28.7,-8.7,11.3,28.7],platformCenters:host?[-30,-10,host.boardingIsland.centerLocalXM,30]:STATION_SCORE.platforms.centers,platformHalfWidths:host?[3.4,3.4,host.boardingIsland.halfWidthM,3.4]:[3.4,3.4,3.4,3.4]};const bridgeBound=footbridgeBounds(bridge),bridgeCenter=bridgeBound.min.map((x,i)=>(x+bridgeBound.max[i])/2),bridgeHalf=bridgeBound.min.map((x,i)=>(bridgeBound.max[i]-x)/2+.031),v=x=>`vec3<f32>(${x.map(f).join(",")})`;
 return String.raw`
${SITE_WGSL}
${stationWaterfrontWGSL({site:STATION_SCORE.site,materialDistance:"stationWaterfrontPhysicalDistance"})}
${terminalHallWGSL({...STATION_SCORE.hall,deck})}
${castColumnWGSL({deck,eave})}
${stationBenchWGSL({deck,length:3.4})}
${clockTowerWGSL({width:STATION_SCORE.tower.footprint})}
${stationRailWGSL()}
${platformEdgeWGSL({deck,eave,back:STATION_SCORE.shed.front-STATION_SCORE.shed.length,front:STATION_SCORE.shed.front,bay:STATION_SCORE.shed.bay,materialDistance:"stationPlatformEdgePhysicalDistance",stationDistanceContract:true})}
${stationLetteringWGSL({deck,hallEmbed:.045,id:7,seed:187})}
${stationLampWGSL({deck,materialDistance:"stationLampPhysicalDistance"})}
${footbridgeWGSL({...bridge,materialDistance:"stationBridgePhysicalDistance"})}
${archTrussWGSL({span:STATION_SCORE.shed.span,eave,radius:STATION_SCORE.shed.radius,depth:STATION_SCORE.shed.trussDepth})}
${shedRoofWGSL({span:STATION_SCORE.shed.span,eave,radius:STATION_SCORE.shed.radius,bay:STATION_SCORE.shed.bay})}
${host?hostWGSL:''}
const STATION_CANDIDATE_CAPACITY:u32=${host?96:64}u;
const HALL_BENCH_PUBLIC_X:array<f32,5>=array<f32,5>(${STATION_SCORE.hall.benchRows.publicX.map(f).join(",")});
const HALL_BENCH_RAIL_X:array<f32,5>=array<f32,5>(${STATION_SCORE.hall.benchRows.railX.map(f).join(",")});
const RAIL_CENTER_OFFSET:f32=${f(construction?.railCenterOffsetM??.752425)};
const RAIL_HALF_WIDTH:f32=${f((construction?.railHeadWidthM??.06985)/2)};
const RAIL_CROWN:f32=${f(construction?.railTopLocalM??.086)};
const RAIL_FOOT:f32=RAIL_CROWN-.15875;const SLEEPER_CENTER:f32=RAIL_FOOT-.03-.08;

struct HitField { d:f32, id:u32, q:vec3<f32>, seed:f32, baseD:f32, extent:vec3<f32>, sourceSeed:f32, }
fn box(p:vec3<f32>,b:vec3<f32>)->f32{let q=abs(p)-b;return length(max(q,vec3<f32>(0.)))+min(max(q.x,max(q.y,q.z)),0.);}
fn cyl(p:vec3<f32>,r:f32,h:f32)->f32{let q=vec2<f32>(length(p.xz)-r,abs(p.y)-h);return min(max(q.x,q.y),0.)+length(max(q,vec2<f32>(0.)));}
fn segment(p:vec3<f32>,a:vec3<f32>,b:vec3<f32>,r:f32)->f32{let v=b-a;return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.,1.))-r;}
// Candidate list is procedural construction metadata, not geometry vertices.
// A single dynamic material call prevents per-part compiler expansion while all
// candidates receive material displacement BEFORE the final nearest selection.
struct StationCandidates {count:u32,items:array<HitField,${host?96:64}>,}
// Invocation-private construction workspace. Avoid copying 4KiB candidates across
// function arguments in GLSL ES backends; reset before each nonrecursive query.
var<private> stationCandidates:StationCandidates;
var<private> stationCandidateOverflow:bool;
// Invocation-local admissible intervals prune only candidates that cannot win.
// This broad 30.01mm envelope contains every locked mother displacement and the
// retained far-field +/-30mm stepping convention. Order/ties remain unchanged.
var<private> stationRawCandidateCount:u32;
var<private> stationCandidateUpper:f32;
fn stationNativeId(id:u32)->bool{return id==1u||id==2u||id==3u||id==4u||id==12u||id==13u||id==15u||id==17u||id==19u;}
fn recordCandidate(h:HitField){
 if(stationRawCandidateCount>=STATION_CANDIDATE_CAPACITY){stationCandidateOverflow=true;return;}
 stationRawCandidateCount+=1u;
 let margin=select(0.,.03001,stationNativeId(h.id));
 stationCandidateUpper=min(stationCandidateUpper,h.d+margin);
 if(h.d-margin>stationCandidateUpper){return;}
 stationCandidates.items[stationCandidates.count]=h;stationCandidates.count+=1u;
}
fn recordPart(p:vec3<f32>,d:f32,id:u32,q:vec3<f32>,seed:f32){recordCandidate(HitField(d,id,q,seed,d,vec3<f32>(1.),0.));}
fn recordCoated(p:vec3<f32>,d:f32,q:vec3<f32>,extent:vec3<f32>,seed:f32){recordCandidate(HitField(d,13u,q,seed,d,extent,0.));}
fn recordTimber(p:vec3<f32>,d:f32,q:vec3<f32>,extent:vec3<f32>,role:f32,sourceSeed:f32){recordCandidate(HitField(d,4u,q,role,d,extent,sourceSeed));}
// Shared near/far execution of one material-bearing candidate. Native bench
// children use it before their inner union, then retain raw construction data.
fn stationCandidatePhysicalDistance(h:HitField,p:vec3<f32>,st:StationState)->f32{if(!stationNativeId(h.id)){return h.d;}if(abs(h.d)<.045){return evaluateStationGeometry(h,p,st).d;}return sign(h.d)*max(abs(h.d)-.03,0.);}
fn stationLampPhysicalDistance(h:StationLampMemberHit,p:vec3<f32>)->f32{return stationCandidatePhysicalDistance(HitField(h.baseD,h.id,h.q,184.,h.baseD,h.extent,h.member),p,resolveStationState(p));}
// A conservative word bound is traversable scheduling data only (id0).
// Finite raised glyphs use the original paint role and source Bézier counters.
fn stationLetterCandidate(h:StationLetteringHit,id:u32)->HitField{if(h.valid==0u){return HitField(h.lowerBound,0u,h.q,0.,h.lowerBound,vec3<f32>(1.),0.);}return HitField(h.d,id,h.q,h.seed,h.d,vec3<f32>(1.),0.);}
fn completeLampLettering(p:vec3<f32>,origin:vec3<f32>,row:u32)->HitField{var h=HitField(1e5,0u,p,0.,1e5,vec3<f32>(1.),0.);for(var side=-1;side<=1;side+=2){for(var line=0u;line<2u;line++){let candidate=stationLetterCandidate(stationLetteringPlatform(p,origin,row,side,line),7u);if(candidate.d<h.d){h=candidate;}}}return h;}
fn stationPlatformEdgePhysicalDistance(h:StationPlatformEdgeHit,p:vec3<f32>)->f32{return stationCandidatePhysicalDistance(HitField(h.baseD,h.id,h.q,h.seed,h.baseD,h.extent,h.sourceSeed),p,resolveStationState(p));}
fn stationWaterfrontPhysicalDistance(h:StationWaterfrontHit,p:vec3<f32>)->f32{return stationCandidatePhysicalDistance(HitField(h.baseD,h.id,h.q,h.seed,h.baseD,h.extent,h.member),p,resolveStationState(p));}
fn stationBridgePhysicalDistance(h:FootbridgeMemberHit,p:vec3<f32>)->f32{return stationCandidatePhysicalDistance(HitField(h.baseD,h.id,h.q,185.,h.baseD,h.extent,h.member),p,resolveStationState(p));}
fn resolveCandidates(p:vec3<f32>)->HitField{if(stationCandidateOverflow){return HitField(0.,999u,p,0.,0.,vec3<f32>(1.),0.);}var h=HitField(10000.,0u,p,0.,10000.,vec3<f32>(1.),0.);let st=resolveStationState(p);for(var i=0u;i<stationCandidates.count;i++){var candidate=stationCandidates.items[i];let d=candidate.d;let id=candidate.id;let native=stationNativeId(id);if(d-select(0.,.03001,native)>stationCandidateUpper){continue;}if(native&&d-.03<h.d){candidate.d=stationCandidatePhysicalDistance(candidate,p,st);}if(candidate.d<h.d){h=candidate;}}return h;}

fn rep(x:f32,pitch:f32,lo:f32,hi:f32)->f32{return x-clamp(round(x/pitch),lo,hi)*pitch;}
fn archHole(x:f32,y:f32,r:f32,spring:f32)->f32{return max(abs(x)-r,select(y-(spring+r),length(vec2<f32>(x,y-spring))-r,y>spring));}
fn stateWet(p:vec3<f32>)->f32{let drain=1.-smoothstep(.12,.75,abs(rep(p.x,7.5,-4.,4.)));let rain=(1.-smoothstep(7.5,12.,p.y))*smoothstep(.1,.4,p.y);return u.age*.12*(.15+drain*rain)+(1.-smoothstep(.2,1.8,p.y))*.15;}
fn repairAt(p:vec3<f32>)->f32{return .08+.65*(1.-smoothstep(.9,1.4,abs(p.x-15.)))*(1.-smoothstep(1.1,2.2,p.y));}
fn brickQ(p:vec3<f32>,axis:u32,d:f32)->vec3<f32>{let row=floor(p.y/.073);let shift=select(0.,.125,(i32(row)&1)==1);let face=select(p.x,p.z,axis==12u);return vec3<f32>(fract((face+shift)/.25)*.25-.125,fract(p.y/.073)*.073-.0365,.055384615+d);}
fn stationDomain(p:vec3<f32>,skipRoof:bool,skipFloor:bool)->HitField{
 stationCandidates.count=0u;stationCandidateOverflow=false;stationRawCandidateCount=0u;stationCandidateUpper=10000.;
 // Complete terminal source construction replaces the former seven-opening shell.
 // The inner union has already evaluated each actual construction ingredient.
 let terminalEnvelope=box(p-${v(terminalCenter)},${v(terminalHalf)});
 if(terminalEnvelope<.15){recordCandidate(terminalHallRawWinner(completeTerminalHall(p,skipFloor)));}else{recordPart(p,terminalEnvelope,0u,p,0.);}
 // Preserve exact title anchor/tip; a 45mm buried root closes its source 40mm mounting gap.
 recordCandidate(stationLetterCandidate(stationLetteringHall(p,${v(titleAnchor.at)}),8u));
 if(!skipFloor){recordPart(p,box(p-vec3<f32>(0.,.275,11.8),vec3<f32>(31.2,.575,3.)),17u,p,1.);}
 for(var i=0;i<4;i++){let z=14.9+f32(i)*.4;recordPart(p,box(p-vec3<f32>(0,.55-f32(i)*.18,z),vec3<f32>(4.7,.16,.22)),2u,p,1.);}
 let hallBound=box(p-vec3<f32>(0,7,0),vec3<f32>(31.5,8.2,10.5));
 if(hallBound<2.){
  // Complete source bench construction also serves the authored hall rows.
  // Both signed axes rotate together; the opposite wall never reflects grain.
  let benchSide=select(-1.,1.,p.z>=0.);var hallBenchX=1e5;var hallBenchIndex=0u;for(var i=0u;i<5u;i++){let x=select(HALL_BENCH_RAIL_X[i],HALL_BENCH_PUBLIC_X[i],p.z>=0.);let delta=p.x-x;if(abs(delta)<abs(hallBenchX)){hallBenchX=delta;hallBenchIndex=i;}}let bq=vec3<f32>(hallBenchX*benchSide,p.y,abs(p.z)-4.5);
  let hallBenchBound=box(bq-vec3<f32>(0.,${f(deck+.60)},.05),vec3<f32>(1.731,.631,.40));
  if(hallBenchBound<.15){let stockBase=10000.+f32(hallBenchIndex)+select(0.,100.,p.z<0.);recordCandidate(completeBenchTimber(p,bq,stockBase,148.));let iron=completeBenchIron(bq);recordCandidate(HitField(iron.d,3u,bq,39.,iron.d,vec3<f32>(1.731,.631,.40),iron.member));}else{recordPart(p,hallBenchBound,0u,bq,39.);}

 }
 else{recordPart(p,hallBound,0u,p,0.);}
 // Heritage tower candidate within retained site envelope. Absolute heights are provisional.
 // Stone group shares one quarry-coordinate field, so member min commutes with
 // that common displacement. Source masks never become painted facade strips.
 let tq=p-vec3<f32>(24.,0.,4.);let tb=box(tq-vec3<f32>(0.,23.,0.),vec3<f32>(4.8,23.,4.8));
 if(tb<2.){
  let stone=completeTowerstone(tq);recordCandidate(HitField(stone.d,2u,tq,171.,stone.d,vec3<f32>(4.8,23.,4.8),stone.member));
  let brick=completeTowerbrick(tq);recordCandidate(HitField(brick.d,select(1u,12u,abs(tq.x)>abs(tq.z)),tq,71.,brick.d,vec3<f32>(2.96,13.65,2.96),brick.member));
  let iron=completeToweriron(tq);recordCandidate(HitField(iron.d,3u,tq,183.,iron.d,vec3<f32>(1.),iron.member));
  let concrete=completeTowerconcrete(tq);recordCandidate(HitField(concrete.d,19u,tq,173.,concrete.d,vec3<f32>(2.7,1.3,2.7),concrete.member));
  let timber=completeTowerTimber(tq);recordCandidate(timber);
  let innerPlaster=completeTowerPlaster(tq);recordCandidate(innerPlaster);
  let dial=completeTowerdial(tq);recordCandidate(HitField(dial.d,7u,tq,0.,dial.d,vec3<f32>(1.),dial.member));
  for(var face=0u;face<4u;face++){
   let a=f32(face)*1.570796326794897;let n=vec3<f32>(sin(a),0.,cos(a));let right=vec3<f32>(n.z,0.,-n.x);let q=vec3<f32>(dot(tq,right),tq.y-25.,dot(tq,n)-3.30);
   let cb=box(q-vec3<f32>(0.,0.,.08),vec3<f32>(1.50,1.50,.13));
   if(cb<.15){let indices=completeTowerDialIndices(q);recordCandidate(HitField(indices.d,8u,q,0.,indices.d,vec3<f32>(1.),f32(face)*60.+indices.member));
    ${host?'let clockMinutes=frame.controls.w;':'let clockMinutes=380.;'}
    let hands=min(completeTowerHand(q-vec3<f32>(0.,0.,.09),clockMinutes*3.14159265359/360.,false),completeTowerHand(q-vec3<f32>(0.,0.,.09),clockMinutes*3.14159265359/30.,true));recordPart(p,hands,8u,q,0.);
    let cap=length(q-vec3<f32>(0.,0.,.09))-.095;recordCandidate(HitField(cap,3u,tq,182.,cap,vec3<f32>(1.),f32(face)+500.));
   }else{recordPart(p,cb,0u,tq,0.);}
  }
 }else{recordPart(p,tb,0u,p,0.);}
 // Three continuous barrel canopies with actual daylight slots and open trusses.
 let shedBox=box(p-vec3<f32>(0,7,SHED_CENTER),vec3<f32>(34,8,SHED_HALF+2.2));
 if(shedBox<2.){
  let xi=clamp(round(p.x/20.),-1.,1.);let x=p.x-xi*20.;let z=rep(p.z-SHED_FRONT,7.5,-SHED_BAYS,0.);
  if(!skipRoof){let panel=completeBarrelPanel(vec3<f32>(x,p.y,p.z));let pd=max(panel.d,abs(p.z-SHED_CENTER)-SHED_HALF);recordCandidate(HitField(pd,15u,vec3<f32>(x,p.y,p.z),55.+xi,pd,vec3<f32>(1.),panel.member));}
  // Restore the original alternating Warren web and real sections, not a
  // sinusoidal stripe. Source upper/lower chords are .72m apart vertically.
  let trussLow=${f(eave-STATION_SCORE.shed.trussDepth-.13)};let trussHigh=SHED_CY+SHED_RADIUS+.13;
  let trussEnvelope=box(vec3<f32>(x,p.y-(trussLow+trussHigh)*.5,z),vec3<f32>(${f(STATION_SCORE.shed.span/2+.13)},(trussHigh-trussLow)*.5,.065));
  if(trussEnvelope<.15){let member=completeWarrenTruss(vec3<f32>(x,p.y,z));recordCandidate(HitField(member.d,3u,p,52.,member.d,vec3<f32>(1.),member.member));}
  else{recordPart(p,trussEnvelope,0u,p,52.);}
  let purlin=completePurlins(vec3<f32>(x,p.y,p.z-SHED_CENTER),SHED_HALF);recordCandidate(HitField(purlin.d,3u,p,52.,purlin.d,vec3<f32>(1.),100.+purlin.member));
  let support=rep(p.x-10.,20.,-2.,1.);
 ${host?`for(var row=0u;row<4u;row++){let center=-30.+f32(row)*20.;let columnSupport=p.x-center;var columnZ=z;if(abs(center-HOST_BOARDING_ROW_X)<.01){columnZ=1e5;for(var pi=0u;pi<${host.supports.retainedBoardingPostLocalZ.length}u;pi++){let d=p.z-HOST_RETAINED_POST_Z[pi];if(abs(d)<abs(columnZ)){columnZ=d;}}}`:'let columnSupport=support;let columnZ=z;'}
 let cq=vec3<f32>(columnSupport,p.y-5.,columnZ);
 // Every accepted child of the casting is restored in one analytic assembly.
 // The common iron displacement at (cq,p,state) is identical for every child,
 // so material(min(child distances)) equals min(material(child distances)).
 let columnEnvelope=box(vec3<f32>(columnSupport,p.y-${f((deck-.03+eave+.62)/2)},columnZ),vec3<f32>(.82,${f((eave+.62-deck+.03)/2)},.49));
 if(columnEnvelope<.15){let member=completeCastColumn(vec3<f32>(columnSupport,p.y,columnZ));recordCandidate(HitField(member.d,3u,cq,56.,member.d,vec3<f32>(.82,${f((eave+.62-deck+.03)/2)},.49),member.member));}
 else{recordPart(p,columnEnvelope,0u,cq,56.);}
 // Full six-member lamps travel with their actual load-bearing columns.
 var lampOffsetZ=rep(p.z-SHED_FRONT+.70,7.5,-SHED_BAYS,0.)-.70;
 ${host?'if(abs(center-HOST_BOARDING_ROW_X)<.01){lampOffsetZ=1e5;for(var li=0u;li<'+host.supports.retainedBoardingPostLocalZ.length+'u;li++){let offset=p.z-HOST_RETAINED_POST_Z[li];if(abs(offset+.70)<abs(lampOffsetZ+.70)){lampOffsetZ=offset;}}}':''}
 let lampEnvelope=box(vec3<f32>(columnSupport,p.y-${f(deck+3.15)},lampOffsetZ+.70),vec3<f32>(.271,.901,.761));
 if(lampEnvelope<.15){let origin=vec3<f32>(p.x-columnSupport,0.,p.z-lampOffsetZ);let lamp=completeStationLamp(p,origin);recordCandidate(HitField(lamp.baseD,lamp.id,lamp.q,184.,lamp.baseD,lamp.extent,lamp.member));recordCandidate(completeLampLettering(p,origin,${host?'row':'u32(clamp(round((p.x-support+30.)/20.),0.,3.))'}));}else{recordPart(p,lampEnvelope,0u,cq,184.);}
 ${host?'}':''}
  // Four islands, mineral copings, with twin steel rails and actual sleeper gaps.
  ${host?String.raw`for(var pi=0;pi<4;pi++){let center=-30.+f32(pi)*20.;let isBoard=abs(center-HOST_BOARDING_ROW_X)<.01;let cx=select(center,HOST_ISLAND_CENTER_X,isBoard);let half=select(3.4,HOST_ISLAND_HALF_WIDTH,isBoard);let pq=vec3<f32>(p.x-cx,p.y-.275,p.z-SHED_CENTER);if(!skipFloor){recordPart(p,box(pq,vec3<f32>(half,.575,SHED_HALF+1.3)),17u,pq,77.);}let edgeBound=stationPlatformEdgeRowBound(p,center,cx,half);if(edgeBound<.15){recordCandidate(stationPlatformEdgeRawWinner(completeStationPlatformEdgeRow(p,center,cx,half,u32(pi))));}else{recordPart(p,edgeBound,0u,p,0.);}}`:String.raw`  let pq=vec3<f32>(support,p.y-.275,p.z-SHED_CENTER);if(!skipFloor){recordPart(p,box(pq,vec3<f32>(3.4,.575,SHED_HALF+1.3)),17u,pq,77.);}
  let edgeCenter=p.x-support;let edgeBound=stationPlatformEdgeRowBound(p,edgeCenter,edgeCenter,3.4);if(edgeBound<.15){recordCandidate(stationPlatformEdgeRawWinner(completeStationPlatformEdgeRow(p,edgeCenter,edgeCenter,3.4,u32(clamp(round((edgeCenter+30.)/20.),0.,3.)))));}else{recordPart(p,edgeBound,0u,p,0.);}
`}
  var railX=rep(p.x-5.,10.,-3.,2.);${host?'if(abs(p.x-railX-5.)<.01){railX=p.x-select(-5.,15.,p.x>=5.);}':''}let rail=vec3<f32>(abs(railX)-RAIL_CENTER_OFFSET,p.y-RAIL_CROWN,p.z-SHED_CENTER);recordPart(p,max(completeStationRail(rail.xy),abs(rail.z)-SHED_HALF-2.),3u,rail,55.);
  recordTimber(p,box(vec3<f32>(railX,p.y-SLEEPER_CENTER,rep(p.z,.64,floor((SHED_BACK-2.)/.64),-13.)),vec3<f32>(1.165,.080,.115)),vec3<f32>(railX,p.y-SLEEPER_CENTER,rep(p.z,.64,floor((SHED_BACK-2.)/.64),-13.)),vec3<f32>(1.165,.080,.115),30.,round(p.z/.64)+round((p.x-5.)/10.)*301.);
  let bearing=vec3<f32>(abs(railX)-RAIL_CENTER_OFFSET,p.y-(RAIL_FOOT-.015),rep(p.z,.64,floor((SHED_BACK-2.)/.64),-13.));recordPart(p,box(bearing,vec3<f32>(.09,.015,.11)),3u,bearing,189.);
  ${host?'for(var bi=0;bi<4;bi++){let benchRow=-30.+f32(bi)*20.;let benchSupport=p.x-select(benchRow,HOST_BENCH_ROW_X,abs(benchRow-HOST_BOARDING_ROW_X)<.01);var bz=rep(p.z+13.75,22.5,-5.,0.);var benchSourceZ=p.z-bz;if(abs(benchRow-HOST_BOARDING_ROW_X)<.01){bz=1e5;for(var j=0u;j<'+host.benches.retainedLocalZ.length+'u;j++){let q=p.z-HOST_RETAINED_BENCH_Z[j];if(abs(q)<abs(bz)){bz=q;benchSourceZ=HOST_BENCH_SOURCE_Z[j];}}}':''}
  ${host?'':'let bz=rep(p.z+13.75,22.5,-5.,0.);let benchSourceZ=p.z-bz;'}let bq=vec3<f32>(-bz,p.y,${host?'benchSupport':'support'});
  let benchBound=box(bq-vec3<f32>(0.,${f(deck+.60)},.05),vec3<f32>(1.731,.631,.40));
  if(benchBound<.15){let stockBase=1000.+round((benchSourceZ+13.75)/22.5)+round((p.x-${host?'benchSupport':'support'}+30.)/20.)*100.;recordCandidate(completeBenchTimber(p,bq,stockBase,138.));let iron=completeBenchIron(bq);recordCandidate(HitField(iron.d,3u,bq,38.,iron.d,vec3<f32>(1.731,.631,.40),iron.member));}
  else{recordPart(p,benchBound,0u,bq,38.);}
  ${host?'}':''}
  // Complete transverse footbridge, open landing gaps and all four stair flights.
  let bridgeEnvelope=box(p-${v(bridgeCenter)},${v(bridgeHalf)});
  if(bridgeEnvelope<.15){let bridgeHit=completeFootbridge(p);recordCandidate(HitField(bridgeHit.baseD,bridgeHit.id,bridgeHit.q,185.,bridgeHit.baseD,bridgeHit.extent,bridgeHit.member));}else{recordPart(p,bridgeEnvelope,0u,p,185.);}

 }
 else{recordPart(p,shedBox,0u,p,0.);}
 // Landward running tracks continue outside the train shed.
 if(p.z<SHED_BACK){var x=rep(p.x-5.,10.,-3.,2.);${host?'if(abs(p.x-x-5.)<.01){x=p.x-select(-5.,15.,p.x>=5.);}':''}let rail=vec3<f32>(abs(x)-RAIL_CENTER_OFFSET,p.y-RAIL_CROWN,p.z-(SHED_BACK-38.));recordPart(p,max(completeStationRail(rail.xy),abs(rail.z)-38.),3u,rail,55.);recordTimber(p,box(vec3<f32>(x,p.y-SLEEPER_CENTER,rep(p.z,.64,floor((SHED_BACK-76.)/.64),ceil(SHED_BACK/.64))),vec3<f32>(1.165,.080,.115)),vec3<f32>(x,p.y-SLEEPER_CENTER,rep(p.z,.64,floor((SHED_BACK-76.)/.64),ceil(SHED_BACK/.64))),vec3<f32>(1.165,.080,.115),30.,round(p.z/.64)+round((p.x-5.)/10.)*301.);}
 if(p.z<SHED_BACK){var x=rep(p.x-5.,10.,-3.,2.);${host?'if(abs(p.x-x-5.)<.01){x=p.x-select(-5.,15.,p.x>=5.);}':''}let plate=vec3<f32>(abs(x)-RAIL_CENTER_OFFSET,p.y-(RAIL_FOOT-.015),rep(p.z,.64,floor((SHED_BACK-76.)/.64),ceil(SHED_BACK/.64)));recordPart(p,box(plate,vec3<f32>(.09,.015,.11)),3u,plate,189.);}
 // Original track bed and six full buffer assemblies; no coarse head-only rail.
 let bufferX=rep(p.x-5.,10.,-3.,2.);let bufferZ=p.z-(SHED_FRONT-.8);
 let bufferLeg=vec3<f32>(abs(bufferX)-.72,p.y-.40,bufferZ);recordPart(p,box(bufferLeg,vec3<f32>(.14,.35,.135)),3u,bufferLeg,189.);
 let bufferBeam=vec3<f32>(bufferX,p.y-.75,bufferZ);recordPart(p,box(bufferBeam,vec3<f32>(1.075,.10,.18)),3u,bufferBeam,188.);
 let trackBed=vec3<f32>(p.x,p.y+.35,p.z-(SHED_BACK-76.+SHED_FRONT)*.5);recordPart(p,box(trackBed,vec3<f32>(29.,.10,(SHED_FRONT-SHED_BACK+76.)*.5)),2u,trackBed,190.);
 // Parcel / freight is an authored interpretation of the quay-side rail band.
 // Its loading dock, masonry piers, metal trusses and roof are one construction.
 let gq=p-vec3<f32>(GOODS_X,0.,GOODS_CENTER);let gb=box(gq-vec3<f32>(0.,3.,0.),vec3<f32>(7.,3.8,GOODS_HALF+1.));
 if(gb<2.){
  if(!skipFloor){recordPart(p,box(gq-vec3<f32>(1.7,.275,0.),vec3<f32>(4.7,.575,GOODS_HALF+.6)),17u,gq,77.);}
  let zz=rep(gq.z,7.,-6.,6.);let sideq=vec3<f32>(abs(gq.x)-3.,p.y-3.,zz);
  recordPart(p,box(sideq,vec3<f32>(.23,2.15,.40)),12u,sideq,91.);
  recordPart(p,box(gq-vec3<f32>(0.,3.,0.),vec3<f32>(.15,2.15,GOODS_HALF)),12u,gq,92.);
  let lintel=vec3<f32>(abs(gq.x)-3.,p.y-5.25,gq.z);recordCoated(p,box(lintel,vec3<f32>(.31,.15,GOODS_HALF)),lintel,vec3<f32>(.31,.15,GOODS_HALF),93.);
  let roof=abs(p.y-(6.3-abs(gq.x)*.31))-.065;recordPart(p,max(roof,max(abs(gq.x)-3.65,abs(gq.z)-GOODS_HALF-.6)),3u,gq,94.);
  recordPart(p,segment(vec3<f32>(gq.x,p.y,zz),vec3<f32>(-3.,5.1,0.),vec3<f32>(3.,5.1,0.),.045),3u,gq,94.);
  recordPart(p,segment(vec3<f32>(gq.x,p.y,zz),vec3<f32>(-3.,5.1,0.),vec3<f32>(0.,6.15,0.),.035),3u,gq,94.);
  recordPart(p,segment(vec3<f32>(gq.x,p.y,zz),vec3<f32>(3.,5.1,0.),vec3<f32>(0.,6.15,0.),.035),3u,gq,94.);
 }else{recordPart(p,gb,0u,p,0.);}
 // Parallel working siding ends before the passenger-to-pier promenade.
 let sx=p.x-50.;let sq=vec3<f32>(abs(sx)-RAIL_CENTER_OFFSET,p.y-RAIL_CROWN,p.z+91.);recordPart(p,max(completeStationRail(sq.xy),abs(sq.z)-79.),3u,sq,55.);
 let sleeper=vec3<f32>(sx,p.y-SLEEPER_CENTER,rep(p.z,.64,-265.,-19.));recordTimber(p,box(sleeper,vec3<f32>(1.165,.080,.115)),sleeper,vec3<f32>(1.165,.080,.115),30.,round(p.z/.64)+810.);
 let sidingPlate=vec3<f32>(abs(sx)-RAIL_CENTER_OFFSET,p.y-(RAIL_FOOT-.015),rep(p.z,.64,-265.,-19.));recordPart(p,box(sidingPlate,vec3<f32>(.09,.015,.11)),3u,sidingPlate,189.);
 // Covered passenger route turns seawards beyond the siding end, no cargo crossing.
 let walk=p-vec3<f32>(49.,0.,13.);let wb=box(walk-vec3<f32>(0.,2.5,0.),vec3<f32>(18.5,2.6,2.2));
 if(wb<2.){
  if(!skipFloor){recordPart(p,box(walk-vec3<f32>(0.,.275,0.),vec3<f32>(18.,.575,1.8)),17u,walk,77.);}
  let post=vec3<f32>(rep(walk.x,6.,-3.,3.),p.y-2.55,abs(walk.z)-1.65);recordPart(p,cyl(post,.07,1.7),3u,post,96.);
  let wr=abs(p.y-(4.7-abs(walk.z)*.13))-.045;recordPart(p,max(wr,max(abs(walk.x)-18.3,abs(walk.z)-1.95)),3u,walk,96.);
  recordPart(p,box(vec3<f32>(walk.x,p.y-4.35,abs(walk.z)-1.65),vec3<f32>(18.3,.085,.06)),3u,walk,96.);
 }else{recordPart(p,wb,0u,p,0.);}
 // Every quay, road, finite painted ingredient, bollard and pier support.
 let coast=completeStationWaterfront(p,skipFloor);
 recordCandidate(HitField(coast.baseD,coast.id,coast.q,coast.seed,coast.baseD,coast.extent,coast.member));

 ${host?String.raw`
 // A 40m transfer truss spans the clear boarding throat; original posts remain at re-sited rear bays. This is an authored
 // construction proposal, not an engineering load certification.
 let trZ=rep(p.z-SHED_FRONT,7.5,-SHED_BAYS,0.);let trCenter=p.z-trZ;
 if(trCenter>=HOST_CLEAR_MIN_Z-.42&&trCenter<=HOST_CLEAR_MAX_Z+.42){
  let q=vec3<f32>(p.x-10.,p.y-(HOST_TRUSS_BOTTOM_Y+HOST_TRUSS_DEPTH*.5),trZ);
  recordPart(p,box(vec3<f32>(q.x,abs(q.y)-HOST_TRUSS_DEPTH*.5,q.z),vec3<f32>(20.15,.095,.11)),3u,q,97.);
  let web=vec3<f32>(rep(q.x,2.5,-8.,8.),q.y,q.z);let diagonal=segment(web,vec3<f32>(-1.25,-.8,0.),vec3<f32>(1.25,.8,0.),.044);recordPart(p,diagonal,3u,web,97.);
 }
 // The preserved actor exits use this exact piecewise planar bearing surface.
 for(var ei=0u;ei<2u;ei++){
  let zmin=HOST_EXIT_APRON_MIN_Z[ei];let zmax=HOST_EXIT_MAX_Z[ei];
  var height=HOST_EXIT_PROFILE_Y[0];var slope=0.;
  for(var j=1u;j<6u;j++){if(p.x>=HOST_EXIT_PROFILE_X[j-1u]){let dx=HOST_EXIT_PROFILE_X[j]-HOST_EXIT_PROFILE_X[j-1u];slope=(HOST_EXIT_PROFILE_Y[j]-HOST_EXIT_PROFILE_Y[j-1u])/dx;height=mix(HOST_EXIT_PROFILE_Y[j-1u],HOST_EXIT_PROFILE_Y[j],clamp((p.x-HOST_EXIT_PROFILE_X[j-1u])/dx,0.,1.));}}
  let top=(p.y-height)/sqrt(1.+slope*slope);let bottom=-.4-p.y;
  let bounds=max(max(HOST_EXIT_PROFILE_X[0]-p.x,p.x-HOST_EXIT_PROFILE_X[5]),max(zmin-p.z,p.z-zmax));
  recordPart(p,max(max(top,bottom),bounds),17u,p,77.);
 }
 `:''}

 return resolveCandidates(p);
}
// Every native component receives physical matter BEFORE the union chooses the
// nearest member. This prevents a farther coating being skipped behind a nearer
// nominal core. No later geometric shell or second coplanar surface is emitted.
fn stationField(p:vec3<f32>)->HitField{return stationDomain(p,false,false);}
`;}
export const STATION_FIELD_WGSL=createStationFieldWGSL();
