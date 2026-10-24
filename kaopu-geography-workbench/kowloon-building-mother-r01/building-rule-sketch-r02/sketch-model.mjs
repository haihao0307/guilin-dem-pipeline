/** Small, authored teaching models. All dimensions below are assumptions, not
 * measurements of any real building. Geometry is finite analytic fields only.
 * Stages reveal relationships; they are NOT a safe construction sequence. */
import {mergeBays,compileSupportProgram,validateSupportProgram} from './frame-growth.mjs';
import {finitePrism} from './kowloon-building-mother-r01/whole-building-floor-study-r01/floor-layout.mjs';
import {ASSEMBLY_SCHEMA,packAssemblyDescriptors,queryAssemblyInside} from './kowloon-building-mother-r01/r07/assemblies.mjs';
import {attachOpeningOwnership,validateOpeningOwnership} from './opening-ownership.mjs';

export const SKETCH_STAGES=Object.freeze([
 {stage:1,key:'foundation',label:'基础'}, {stage:2,key:'ring-beam',label:'地圈梁'},
 {stage:3,key:'columns',label:'柱'}, {stage:4,key:'beams',label:'梁'},
 {stage:5,key:'slabs-roof',label:'楼板与屋面'}, {stage:6,key:'circulation',label:'楼梯、走廊与电梯'},
 {stage:7,key:'walls-openings',label:'房间、墙与门洞'}
]);
export const SKETCH_CASES=Object.freeze({
 cell:{label:'一个结构单元',bayCount:1,storeys:1},
 vertical:{label:'一个单元向上生长',bayCount:1,storeys:2},
 connected:{label:'两个单元接搭 · 楼梯与外挂电梯',bayCount:2,storeys:2}
});
const RULES=Object.freeze({bayWidth:4,bayDepth:5,columnWidth:.28,beamWidth:.25,beamDepth:.32,
 slabThickness:.16,wallThickness:.12,doorHeight:2.1,doorWidth:.9,padWidth:.8,
 foundationBottom:-.80,foundationTop:-.36,stairWidth:1,stairRun:2.4,stairTargetRise:.18});
const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const boundsOf=ps=>({min:[0,1,2].map(k=>Math.min(...ps.map(p=>p.bounds.min[k]))),max:[0,1,2].map(k=>Math.max(...ps.map(p=>p.bounds.max[k])))});
const between=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
const copy=x=>structuredClone(x);

export function growSketch({caseId='connected',stage=7,groundHeight=3.6,typicalHeight=3,
 doorOpen=0,liftOpen=0,liftLevel=0,liftAttached=true,roofVisible=true,waistThickness=.14,storeys,pitDepth=1.2,overhead=1}={}) {
 if(!Object.hasOwn(SKETCH_CASES,caseId))throw Error('Unknown teaching sketch case');
 if(!Number.isInteger(stage)||!between(stage,1,7))throw Error('Stage must be 1..7');
 if(!between(groundHeight,2.6,5)||!between(typicalHeight,2.6,5))throw Error('Teaching floor heights must be 2.6..5 m');
 if(!between(waistThickness,.08,.28))throw Error('Teaching stair waist thickness must be .08.. .28 m');
 const floorCount=caseId==='cell'?1:(storeys??SKETCH_CASES[caseId].storeys);
 if(!Number.isInteger(floorCount)||!between(floorCount,caseId==='cell'?1:2,5))throw Error('Teaching connected/vertical storeys must be 2..5');
 if(!between(pitDepth,.6,3)||!between(overhead,.4,3))throw Error('Teaching pit/overhead dimensions out of range');
 if(!between(doorOpen,0,1)||!between(liftOpen,0,1)||!Number.isInteger(liftLevel)||!between(liftLevel,0,Math.max(1,floorCount-1))||typeof liftAttached!=='boolean'||typeof roofVisible!=='boolean')throw Error('Invalid door or lift setting');
 const def=SKETCH_CASES[caseId],r={...RULES},root='teaching-sketch:'+caseId,W=def.bayCount*r.bayWidth,D=r.bayDepth;
 const parameters={caseId,stage,groundHeight,typicalHeight,doorOpen,liftOpen,liftLevel,liftAttached,roofVisible,waistThickness,storeys:floorCount,pitDepth,overhead,...r};
 const bays=Array.from({length:def.bayCount},(_,i)=>rect(i*r.bayWidth,0,(i+1)*r.bayWidth,D));
 const grid=mergeBays(bays),levels=Array.from({length:floorCount},(_,i)=>({id:root+':L'+i,nodeId:root+':L'+i,label:(i+1)+'F',elevation:i?groundHeight+(i-1)*typicalHeight:0,height:i?typicalHeight:groundHeight,actualElevation:null}));
 const roofElevation=groundHeight+(floorCount-1)*typicalHeight;
 const program=compileSupportProgram({root,levels,grid,foundation:{status:'explicit_teaching_assumption'},ringBeamPrototype:true});
 const nodes=program.nodes,edges=program.edges,nodeMap=new Map(nodes.map(n=>[n.id,n])),primitives=[],portals=[],routes=[],rooms=[];
 Object.assign(nodeMap.get(root),{label:def.label,evidence:'authored_teaching_assumptions_not_a_real_building'});
 const edge=(from,to,type)=>{if(!edges.some(e=>e.from===from&&e.to===to&&e.type===type))edges.push({from,to,type});};
 const node=(id,type,owner=root,props={})=>{if(nodeMap.has(id)){Object.assign(nodeMap.get(id),props);return id;}const n={id,type,evidence:'authored_teaching_assumption',...props};nodes.push(n);nodeMap.set(id,n);if(owner)edge(id,owner,'ownedBy');return id;};
 const support=(id,by)=>{edge(id,by,'supportedBy');edge(id,by,'dependsOn');};
 const mainModule=root+':frame',stairModule=root+':stair',liftModule=root+':lift';
 node(mainModule,'frame_module');
 const solid=(id,cls,loops,range,{owner=root,stage:at=5,floorId=null,moduleId=mainModule,supports=[],...frame}={})=>{
  node(id,cls,owner,{stage:at,floorId,moduleId,geometryGenerated:true});for(const by of supports)support(id,by);
  const p=finitePrism(id,loops,range,frame);Object.assign(p,{objectId:2000+primitives.length,semanticClass:cls,stage:at,floorId,moduleId,geometryEvidence:'authored_teaching_dimensions_not_surveyed'});primitives.push(p);return p;
 };
 const box=(id,cls,x0,z0,x1,z1,y0,y1,opts={})=>solid(id,cls,[rect(x0,z0,x1,z1)],[y0,y1],opts);
 const segment=(id,cls,a,b,width,y0,y1,opts={})=>{
  const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),u=[dx/L,0,dz/L],v=[-dz/L,0,dx/L];
  return solid(id,cls,[rect(0,-width/2,L,width/2)],[y0,y1],{...opts,u,v,w:[0,1,0],origin:[a[0],0,a[1]]});
 };

 // One physical footing/column at a shared grid point, one member per edge.
 const pads=grid.points.map(([x,z],i)=>{
  const id=root+':foundation:pad:'+i;box(id,'floor',x-r.padWidth/2,z-r.padWidth/2,x+r.padWidth/2,z+r.padWidth/2,r.foundationBottom,r.foundationTop,{owner:program.foundationId,stage:1});return id;
 });
 const groundSupport=root+':growth:ground-support';
 grid.spans.forEach(([a,b],i)=>segment(root+':ring-beam:'+i,'beam',grid.points[a],grid.points[b],.32,r.foundationTop,0,{owner:groundSupport,stage:2,supports:[pads[a],pads[b]]}));
 const stairHole=floorCount>1?rect(.30,1.4,2.80,4.75):null;
 const columnJoints=[];
 for(const [i,l]of levels.entries()){
  const f=program.floorTable[i],next=levels[i+1]?.elevation??roofElevation,top=next-r.slabThickness;
  grid.points.forEach(([x,z],j)=>{
   // The column owns the slab-joint depth too. It ends at the next floor's
   // elevation, not at the underside of a separately hidden slab. No extra
   // width, concealed pad, or render-only bridge is added at this junction.
   box(f.columns[j],'column',x-r.columnWidth/2,z-r.columnWidth/2,x+r.columnWidth/2,z+r.columnWidth/2,l.elevation,next,{owner:l.nodeId,stage:3,floorId:l.id});
   const below=i?program.floorTable[i-1].columns[j]:groundSupport;
   for(let k=edges.length-1;k>=0;k--)if(edges[k].from===f.columns[j]&&edges[k].to===f.slab&&['supportedBy','dependsOn'].includes(edges[k].type))edges.splice(k,1);
   support(f.columns[j],below);Object.assign(nodeMap.get(f.columns[j]),{jointRule:'continuous_floor_to_floor',bottomElevation:l.elevation,topElevation:next});
   if(i)columnJoints.push({lowerId:below,upperId:f.columns[j],position:[x,l.elevation,z],width:r.columnWidth,hiddenSlabRequired:false});
  });
  grid.spans.forEach(([a,b],j)=>segment(f.beams[j],'beam',grid.points[a],grid.points[b],r.beamWidth,top-r.beamDepth,top,{owner:l.nodeId,stage:4,floorId:l.id}));
  solid(f.slab,'floor',[rect(-.18,-.18,W+.18,D+.18),...(i&&stairHole?[stairHole]:[])],[l.elevation-r.slabThickness,l.elevation],{owner:l.nodeId,stage:5,floorId:l.id});
 }
 solid(program.roof,'roof',[rect(-.25,-.25,W+.25,D+.25)],[roofElevation-r.slabThickness,roofElevation],{stage:5,floorId:levels.at(-1).id});

 // Doors are subtracted in the wall's finite polygon. A separate leaf can move.
 const wall=(id,a,b,base,height,{owner=null,floorId=null,opening=null,cls='wall',moduleId=mainModule,at=7,open=doorOpen,from=null,to=null}={})=>{
  const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),u=[dx/L,0,dz/L],v=[0,1,0],w=[-dz/L,0,dx/L],origin=[a[0],base,a[1]];
  let loop=rect(0,0,L,height),portal=null;
  if(opening){const width=opening.width??r.doorWidth,center=opening.at??L/2,lo=center-width/2,hi=center+width/2;
   if(lo<=0||hi>=L||r.doorHeight>=height)throw Error('Door must fit its finite host');
   loop=[[0,0],[lo,0],[lo,r.doorHeight],[hi,r.doorHeight],[hi,0],[L,0],[L,height],[0,height]];
   portal={id:id+':opening',hostId:id,floorId,origin:copy(origin),u:copy(u),v:copy(v),w:copy(w),lo,hi,width,height:r.doorHeight,from,to,open,moduleId,stage:at,
    center:[origin[0]+u[0]*center,base,origin[2]+u[2]*center],leafIds:[]};
  }
  const host=solid(id,cls,[loop],[-r.wallThickness/2,r.wallThickness/2],{u,v,w,origin,owner:owner??floorId??root,stage:at,floorId,moduleId});
  if(floorId)support(id,program.floorTable[levels.findIndex(l=>l.id===floorId)].slab);
  if(portal){node(portal.id,'door_opening',id,{hostId:id,stage:at,floorId,moduleId});edge(portal.id,id,'hostedBy');
   if(cls==='elevator'){
    for(const side of[-1,1]){const start=(side<0?portal.lo:(portal.lo+portal.hi)/2)+side*open*portal.width/2,idLeaf=id+':leaf:'+side;
     solid(idLeaf,'elevator',[rect(0,0,portal.width/2,r.doorHeight)],[-.018,.018],{u,v,w,origin:[origin[0]+u[0]*start,base,origin[2]+u[2]*start],owner:id,stage:at,floorId,moduleId,supports:[id]});portal.leafIds.push(idLeaf);edge(idLeaf,id,'hostedBy');}
   }else{
    const angle=open*Math.PI/2,du=[u[0]*Math.cos(angle)+w[0]*Math.sin(angle),0,u[2]*Math.cos(angle)+w[2]*Math.sin(angle)],dw=[-du[2],0,du[0]],leaf=id+':leaf';
    solid(leaf,'door',[rect(0,0,portal.width,r.doorHeight)],[-.018,.018],{u:du,v,w:dw,origin:[origin[0]+u[0]*portal.lo,base,origin[2]+u[2]*portal.lo],owner:id,stage:at,floorId,moduleId,supports:[id]});portal.leafIds.push(leaf);edge(leaf,id,'hostedBy');
   }
   if(from&&to){edge(from,to,'connectedByOpening');edge(portal.id,from,'opensFrom');edge(portal.id,to,'opensTo');}portals.push(portal);
  }
  return host;
 };

 // A real two-flight stair: 0 -> half-rise landing -> upper corridor. The upper
 // floor has a matching hole; no hidden full slab blocks the route.
 const corridors=levels.map(l=>{const id=node(l.id+':corridor','corridor',l.nodeId,{stage:6,elevation:l.elevation});
  box(id+':surface','floor',.18,.18,W-.18,1.4,l.elevation-.015,l.elevation+.008,{owner:id,stage:6,floorId:l.id,supports:[l.nodeId+':slab']});return id;
 });
 let stair=null;
 if(floorCount>1){
  node(stairModule,'stair_system',root,{stage:6});
  const connections=[];
  for(let connectionIndex=0;connectionIndex<levels.length-1;connectionIndex++){
  const lowerLevel=levels[connectionIndex],upperLevel=levels[connectionIndex+1],connectionId=connectionIndex?stairModule+':connection:'+connectionIndex:stairModule;
  if(connectionIndex)node(connectionId,'stair_connection',stairModule,{stage:6,fromFloorId:lowerLevel.id,toFloorId:upperLevel.id});
  const baseElevation=lowerLevel.elevation,height=upperLevel.elevation-baseElevation,half=height/2,stepsPerFlight=Math.ceil(half/r.stairTargetRise),rise=half/stepsPerFlight,tread=r.stairRun/stepsPerFlight;
  const waypoints=[[.95,baseElevation,.8],[.95,baseElevation,1.4]],treadIds=[],landingId=connectionId+':mid-landing',flights=[];
  const slope=half/r.stairRun,waistVerticalDepth=waistThickness*Math.hypot(1,slope);
  // Both flights share this exact section rule. A thin inclined waist carries
  // triangular step wedges. The space below is genuinely empty, not masked.
  const flight=({key,x0,z0,direction,base,floorId,supports})=>{
   const waistId=connectionId+':'+key+'-waist',frame={u:[0,0,direction],v:[0,1,0],w:[1,0,0],origin:[x0,base,z0]},ids=[];
   solid(waistId,'stair',[[[0,-waistVerticalDepth],[r.stairRun,half-waistVerticalDepth],[r.stairRun,half],[0,0]]],[0,r.stairWidth],{...frame,owner:connectionId,stage:6,floorId,moduleId:stairModule,supports});
   Object.assign(nodeMap.get(waistId),{partRole:'inclined_waist',normalThickness:waistThickness});
   for(let i=0;i<stepsPerFlight;i++){
    const s0=i*tread,s1=(i+1)*tread,y0=i*rise,y1=(i+1)*rise,id=connectionId+':'+key+'-step:'+i;
    solid(id,'stair',[[[s0,y0],[s1,y1],[s0,y1]]],[0,r.stairWidth],{...frame,owner:connectionId,stage:6,floorId,moduleId:stairModule,supports:[waistId]});
    Object.assign(nodeMap.get(id),{partRole:'step_wedge',supportedByWaist:waistId});
    waypoints.push([x0+r.stairWidth/2,base+y1,z0+direction*s0],[x0+r.stairWidth/2,base+y1,z0+direction*s1]);ids.push(id);treadIds.push(id);
   }
   const f={id:connectionId+':'+key,waistId,treadIds:ids,x0,z0,direction,base,run:r.stairRun,rise:half,width:r.stairWidth,slope,waistThickness,waistVerticalDepth};flights.push(f);return f;
  };
  const lower=flight({key:'lower',x0:.45,z0:1.4,direction:1,base:baseElevation,floorId:lowerLevel.id,supports:[lowerLevel.nodeId+':slab']});
  box(landingId,'stair',.45,3.8,2.65,4.6,baseElevation+half-r.slabThickness,baseElevation+half,{owner:connectionId,stage:6,floorId:lowerLevel.id,moduleId:stairModule,supports:[lower.waistId]});
  waypoints.push([.95,baseElevation+half,4.2],[2.15,baseElevation+half,4.2],[2.15,baseElevation+half,3.8]);
  flight({key:'upper',x0:1.65,z0:3.8,direction:-1,base:baseElevation+half,floorId:upperLevel.id,supports:[landingId,upperLevel.nodeId+':slab']});
  waypoints.push([2.15,upperLevel.elevation,.8]);
  const routeId=node(connectionId+':route','walk_route',connectionId,{stage:6,from:corridors[connectionIndex],to:corridors[connectionIndex+1]});edge(routeId,corridors[connectionIndex],'startsAt');edge(routeId,corridors[connectionIndex+1],'endsAt');for(const id of [...treadIds,landingId])edge(routeId,id,'walksOn');
  connections.push({id:connectionId,routeId,fromFloorId:lowerLevel.id,toFloorId:upperLevel.id,baseElevation,height,stepsPerFlight,totalRisers:stepsPerFlight*2,rise,tread,clearWidth:r.stairWidth,waistThickness,waistVerticalDepth,flights,underFlightsHollow:true,landingId,treadIds,upperSlabId:upperLevel.nodeId+':slab',upperHole:copy(stairHole),headroomCertified:false});
  routes.push({id:routeId,type:'stair',from:corridors[connectionIndex],to:corridors[connectionIndex+1],fromFloorId:lowerLevel.id,toFloorId:upperLevel.id,stage:6,waypoints,treadIds,continuous:true,accessibleRoute:false});
  }
  stair={...connections[0],id:stairModule,connections,flights:connections.flatMap(c=>c.flights),treadIds:connections.flatMap(c=>c.treadIds),totalRisers:connections.reduce((n,c)=>n+c.totalRisers,0)};
 }

 for(const [i,l]of levels.entries()){
  const height=l.height-r.slabThickness;
  // These two sides remain visible in a useful open-front teaching cutaway.
  wall(l.id+':wall:rear',[0,D],[W,D],l.elevation,height,{floorId:l.id});
  wall(l.id+':wall:right',[W,D],[W,0],l.elevation,height,{floorId:l.id});
  if(caseId==='cell'){
   const room=node(l.id+':room','room',l.nodeId,{label:'单元空间',stage:7});rooms.push({id:room,label:'单元空间',floorId:l.id,polygon:rect(.18,1.4,W-.18,D-.18)});
   wall(l.id+':wall:room-entry',[.18,1.4],[W-.18,1.4],l.elevation,height,{owner:room,floorId:l.id,opening:{at:(W-.36)/2},from:corridors[i],to:room});
  }else if(caseId==='connected'){
   const roomA=node(l.id+':room:A','room',l.nodeId,{label:'房间 A',stage:7}),roomB=node(l.id+':room:B','room',l.nodeId,{label:'房间 B',stage:7});
   rooms.push({id:roomA,label:'房间 A',floorId:l.id,polygon:rect(4.18,1.4,6,D-.18)},{id:roomB,label:'房间 B',floorId:l.id,polygon:rect(6,1.4,W-.18,D-.18)});
   wall(l.id+':wall:room-A-entry',[4.18,1.4],[6,1.4],l.elevation,height,{owner:roomA,floorId:l.id,opening:{at:.91},from:corridors[i],to:roomA});
   wall(l.id+':wall:room-B-entry',[6,1.4],[W-.18,1.4],l.elevation,height,{owner:roomB,floorId:l.id,opening:{at:.91},from:corridors[i],to:roomB});
   wall(l.id+':wall:rooms-divider',[6,1.4],[6,D],l.elevation,height,{owner:l.nodeId,floorId:l.id});
   edge(l.id+':wall:rooms-divider',roomA,'boundsRoom');edge(l.id+':wall:rooms-divider',roomB,'boundsRoom');
  }else{
   // An open frame landing, not a claimed habitable room in the residual width.
   node(l.id+':stair-landing-space','landing_space',l.nodeId,{stage:7,label:'楼梯与层间接口'});
  }
 }

 // Optional independent vertical shaft attaches through one corridor port per floor.
 // Removing it leaves the original frame and stair unchanged.
 let lift=null;
 if(caseId==='connected'&&liftAttached){
  node(liftModule,'detachable_lift_module',root,{stage:6,certified:false});
  const x0=W+.65,x1=x0+2.2,z0=0,z1=2.3,carElevation=levels[liftLevel].elevation,shaftBottom=-pitDepth,pitFloorTop=shaftBottom+.18,shaftTop=roofElevation+overhead;
  const foundation=liftModule+':foundation';box(foundation,'elevator',x0-.15,z0-.15,x1+.15,z1+.15,shaftBottom,pitFloorTop,{owner:liftModule,stage:6,moduleId:liftModule});
  wall(liftModule+':shaft:back',[x0,z1],[x1,z1],pitFloorTop,shaftTop-pitFloorTop,{owner:liftModule,cls:'elevator',moduleId:liftModule,at:6});
  wall(liftModule+':shaft:outer',[x1,z1],[x1,z0],pitFloorTop,shaftTop-pitFloorTop,{owner:liftModule,cls:'elevator',moduleId:liftModule,at:6});
  wall(liftModule+':pit:front',[x0,z0],[x0,z1],pitFloorTop,-pitFloorTop,{owner:liftModule,cls:'elevator',moduleId:liftModule,at:6});
  wall(liftModule+':overhead:front',[x0,z0],[x0,z1],roofElevation,overhead,{owner:liftModule,cls:'elevator',moduleId:liftModule,at:6});
  // Deliberately omit the near shaft wall: this is an inspectable section.
  const attachments=[];
  for(const [i,l]of levels.entries()){
   const dock=node(liftModule+':dock:'+i,'lift_landing',liftModule,{stage:6,floorId:l.id});
   box(dock+':bridge','floor',W-.18,.3,x0+.10,1.3,l.elevation-r.slabThickness,l.elevation,{owner:dock,stage:6,floorId:l.id,moduleId:liftModule,supports:[l.nodeId+':slab']});
   wall(dock+':door-host',[x0,z0],[x0,z1],l.elevation,l.height,{owner:dock,floorId:l.id,opening:{at:.8,width:1},cls:'elevator',moduleId:liftModule,at:6,open:i===liftLevel?liftOpen:0,from:corridors[i],to:dock});
   edge(dock,corridors[i],'attachedTo');attachments.push({floorId:l.id,corridorId:corridors[i],dockId:dock,position:[x0,l.elevation,.8]});
   routes.push({id:dock+':route',type:'lift_connector',from:corridors[i],to:dock,stage:6,waypoints:[[W-.3,l.elevation,.8],[x0,l.elevation,.8]],continuous:true,cabinAtLanding:i===liftLevel});
  }
  const cabin=node(liftModule+':cabin','lift_cabin',liftModule,{stage:6,level:liftLevel,elevation:carElevation,positionMode:'discrete_parameter_not_animation'});
  box(cabin+':floor','elevator',x0+.08,.18,x1-.18,z1-.18,carElevation-.10,carElevation,{owner:cabin,stage:6,moduleId:liftModule,supports:[foundation]});
  box(cabin+':back','elevator',x1-.22,.18,x1-.16,z1-.18,carElevation,carElevation+2.2,{owner:cabin,stage:6,moduleId:liftModule,supports:[cabin+':floor']});
  box(cabin+':side','elevator',x0+.08,z1-.24,x1-.16,z1-.18,carElevation,carElevation+2.2,{owner:cabin,stage:6,moduleId:liftModule,supports:[cabin+':floor']});
  box(cabin+':ceiling','elevator',x0+.08,.18,x1-.18,z1-.18,carElevation+2.2,carElevation+2.26,{owner:cabin,stage:6,moduleId:liftModule,supports:[cabin+':back']});
  lift={id:liftModule,attached:true,detachable:true,cabinId:cabin,level:liftLevel,elevation:carElevation,doorOpen:liftOpen,attachments,pitDepth,pitFloorTop,shaftBottom,shaftTop,overhead,shaftAxis:[0,1,0],shaftBounds:{min:[x0,shaftBottom,z0],max:[x1,shaftTop,z1]},stops:levels.map(l=>({floorId:l.id,elevation:l.elevation})),travelRange:[0,levels.at(-1).elevation],machineRoom:'unknown_not_generated',certified:false,animation:false,sectionView:true};
 }

 // The main right wall must not seal the lift route. Replace its host with a
 // doorway on each storey, rather than drawing a door over a closed wall.
 if(lift){for(const [i,l]of levels.entries()){
  const id=l.id+':wall:right',old=primitives.findIndex(p=>p.nodeId===id);primitives.splice(old,1);
  wall(id,[W,D],[W,0],l.elevation,l.height-r.slabThickness,{floorId:l.id,opening:{at:D-.8,width:1},from:corridors[i],to:lift.attachments[i].dockId});
 }}
 if(lift){
  lift.facing=levels.map((l,i)=>{
   const main=portals.find(p=>p.hostId===l.id+':wall:right'),landing=portals.find(p=>p.hostId===lift.attachments[i].dockId+':door-host');
   const delta=landing.center.map((v,k)=>v-main.center[k]),distance=Math.hypot(...delta),direction=delta.map(v=>v/distance),dot=(a,b)=>a.reduce((v,x,k)=>v+x*b[k],0);
   const bridgeRoute=[[W-.3,l.elevation,.8],copy(main.center),copy(landing.center),[landing.center[0]+.65,l.elevation,.8]];
   return {floorId:l.id,mainPortalId:main.id,liftPortalId:landing.id,mainDoorCenter:copy(main.center),liftDoorCenter:copy(landing.center),mainDoorFacing:copy(main.w),liftDoorFacing:copy(landing.w),approachDirection:direction,
    doorCentersAligned:Math.abs(delta[1])+Math.abs(delta[2])<1e-8,opposedNormals:dot(main.w,landing.w)<-.999,mainFacesBridge:dot(main.w,direction)>.999,liftFacesBridge:dot(landing.w,direction)<-.999,bridgeLength:distance,bridgeRoute};
  });
  for(let i=1;i<levels.length;i++){
   const arrival=lift.facing[i],id=node(liftModule+':stair-arrival-route'+(i===1?'':':'+i),'walk_route',liftModule,{stage:6}),elevation=levels[i].elevation;edge(id,corridors[i],'startsAt');edge(id,lift.cabinId,'endsAt');
   routes.push({id,type:'stair_to_lift',from:corridors[i],to:lift.cabinId,floorId:levels[i].id,stage:6,
    waypoints:[[2.15,elevation,1.4],[2.15,elevation,.8],...copy(arrival.bridgeRoute)],portalIds:[arrival.mainPortalId,arrival.liftPortalId],continuous:true,
    traversable:doorOpen>.99&&liftOpen>.99&&liftLevel===i,condition:'Both landing doors open and cabin at this landing. The stair turns into the corridor, then approaches the opposing doors along +X.'});
  }
 }

 const entrance=node(root+':entry','ground_entry',root,{stage:6,position:[.95,0,-.1]});
 const entryRoute={id:root+':entry-route',type:'entry',from:entrance,to:corridors[0],stage:6,waypoints:[[.95,0,-.1],[.95,0,.8]],continuous:true};
 node(entryRoute.id,'walk_route',root,{stage:6});edge(entryRoute.id,entrance,'startsAt');edge(entryRoute.id,corridors[0],'endsAt');routes.push(entryRoute);
 for(const room of rooms){const floorIndex=levels.findIndex(l=>l.id===room.floorId),l=levels[floorIndex],portal=portals.find(p=>p.to===room.id),x=portal.center[0],points=copy(entryRoute.waypoints);
  for(let i=0;i<floorIndex;i++){const route=routes.find(p=>p.type==='stair'&&p.fromFloorId===levels[i].id);points.push(...copy(i?route.waypoints:route.waypoints.slice(1)));}
  points.push([x,l.elevation,.8],[x,l.elevation,1.4],[x,l.elevation,2.7]);
  const id=node(room.id+':entry-route','walk_route',room.id,{stage:7});edge(id,entrance,'startsAt');edge(id,room.id,'endsAt');edge(id,portal.id,'passesThrough');
  routes.push({id,type:'entry_to_room',from:entrance,to:room.id,floorId:room.floorId,stage:7,waypoints:points,portalIds:[portal.id],continuous:true,traversable:doorOpen>.99,condition:'Open the room door; route geometry is independent of the leaf state.'});
 }
 const openingChains=[];
 for(const portal of portals){
  nodeMap.get(portal.hostId).hostRole='wall';
  const infillId=portal.id+':door-assembly';
  openingChains.push(attachOpeningOwnership({nodes,edges},{buildingId:root,wallId:portal.hostId,openingId:portal.id,infillId,infillType:'door',adjacentSpaceIds:[portal.from,portal.to].filter(Boolean),parts:portal.leafIds.map(id=>({id,type:'leaf'}))}));
  Object.assign(nodes.find(n=>n.id===infillId),{stage:portal.stage,floorId:portal.floorId,moduleId:portal.moduleId});portal.infillId=infillId;
 }
 const openingValidation=validateOpeningOwnership({nodes,edges},openingChains);

 // Stable field IDs across stages and opening edits. Grouping by module
 // makes detaching the lift possible without touching the main frame.
 primitives.forEach((p,i)=>p.objectId=2000+i);
 const visible=primitives.filter(p=>p.stage<=stage&&(roofVisible||p.semanticClass!=='roof')),archetypes=[];
 const groupKeys=[...new Set(visible.map(p=>JSON.stringify([p.moduleId,p.floorId])))];
 for(const key of groupKeys){const [moduleId,floorId]=JSON.parse(key),group=visible.filter(p=>p.moduleId===moduleId&&p.floorId===floorId);
  for(let i=0;i<group.length;i+=64){const ps=group.slice(i,i+64),id=moduleId+':'+(floorId??'all')+':batch:'+i,a={schema:ASSEMBLY_SCHEMA,id,primitives:ps,bounds:boundsOf(ps),counts:{primitives:ps.length,modelTriangles:0,modelVertexBuffers:0},moduleId,floorId};packAssemblyDescriptors(a);archetypes.push(a);}
 }
 const bounds=boundsOf(visible),graph={nodes,edges};
 for(const n of nodes)n.visible=(n.stage===undefined||n.stage<=stage)&&(roofVisible||n.id!==program.roof);
 const model={schema:'kaopu.function-teaching-sketch/0.1',sourceModelId:root,placementMode:'UNREGISTERED_evidence_plan_NOT_part_of_measured_mother',graph,levels:copy(levels),archetypes,
  instances:archetypes.map(a=>({id:a.id+':instance',archetypeId:a.id,translation:[0,0,0],floorId:a.floorId,moduleId:a.moduleId,objectIdOffset:10000,bounds:copy(a.bounds)})),interfaces:{stairs:[]},openingOwnership:{chains:openingChains,validation:openingValidation},bounds};
 const source={sourceModelId:root,patches:[],bounds:copy(bounds),evidence:'no_real_building_source_used'};
 const counts={bays:bays.length,storeys:levels.length,columnsPerStorey:grid.points.length,beamsPerStorey:grid.spans.length,frameColumns:grid.points.length*levels.length,frameBeams:grid.spans.length*levels.length,foundationPads:pads.length,ringBeams:grid.spans.length,primitives:visible.length,totalPrimitives:primitives.length,rooms:rooms.length,doors:portals.length,visibleByClass:{}};
 for(const p of visible)counts.visibleByClass[p.semanticClass]=(counts.visibleByClass[p.semanticClass]??0)+1;
 const failures=[],supportValidation=validateSupportProgram({...program,nodes,edges});failures.push(...supportValidation.failures,...openingValidation.errors.map(e=>e.message));
 const ids=new Set(nodes.map(n=>n.id));for(const e of edges)if(!ids.has(e.from)||!ids.has(e.to))failures.push('Missing graph endpoint: '+e.from+' -> '+e.to);
 const only=p=>({schema:ASSEMBLY_SCHEMA,primitives:[p]});
 for(const portal of portals){const p=primitives.find(p=>p.nodeId===portal.hostId),q=[0,1,2].map(k=>portal.origin[k]+portal.u[k]*(portal.lo+portal.hi)/2+portal.v[k]*1);if(queryAssemblyInside(only(p),q))failures.push('Blocked door host: '+portal.id);}
 if(stair)for(const connection of stair.connections){const slab=primitives.find(p=>p.nodeId===connection.upperSlabId),elevation=connection.baseElevation+connection.height;for(const point of[[.95,elevation-.08,2.6],[2.15,elevation-.08,2.6],[1.6,elevation-.08,4.2]])if(queryAssemblyInside(only(slab),point))failures.push('Stair hole blocked');}
 const columnSpec={schema:ASSEMBLY_SCHEMA,primitives:primitives.filter(p=>p.semanticClass==='column')};
 for(const joint of columnJoints)for(const offset of[-r.slabThickness*.75,-.001,.001])if(!queryAssemblyInside(columnSpec,[joint.position[0],joint.position[1]+offset,joint.position[2]]))failures.push('Column joint gap: '+joint.upperId);
 if(stair){const stairSpec={schema:ASSEMBLY_SCHEMA,primitives:primitives.filter(p=>p.moduleId===stairModule)};for(const f of stair.flights)for(const t of[.5,.7,.9])if(queryAssemblyInside(stairSpec,[f.x0+f.width/2,f.base+f.rise*t-f.waistVerticalDepth-.08,f.z0+f.direction*f.run*t]))failures.push('Solid fill remains below flight: '+f.id);}
 if(lift?.facing.some(f=>!f.doorCentersAligned||!f.opposedNormals||!f.mainFacesBridge||!f.liftFacesBridge))failures.push('Lift door facing does not match bridge');
 const checks={passed:failures.length===0,failures,supportDAG:supportValidation.passed,openingOwnership:openingValidation.passed,sharedMembersDeduplicated:true,doorHostsCut:!failures.some(f=>f.startsWith('Blocked door')),upperStairOpening:!failures.includes('Stair hole blocked'),frameJointsContinuous:!failures.some(f=>f.startsWith('Column joint gap')),underFlightsHollow:!failures.some(f=>f.startsWith('Solid fill')),liftFacesBridge:!failures.includes('Lift door facing does not match bridge'),modelTriangles:0,modelVertexBuffers:0,sourceUnchanged:true,structuralCertification:false};
 if(!checks.passed)throw Error(failures.join('; '));program.validation=supportValidation;
 return {model,source,graph,checks,validation:checks,parameters,stages:copy(SKETCH_STAGES),caseLabel:def.label,grid,bays,levels,counts,bounds,roofElevation,
  portals,rooms,routes,stair,lift,columnJoints,supportProgram:{...program,nodes,edges},
  modules:[{id:mainModule,type:'frame',detachable:false},...(stair?[{id:stairModule,type:'stair',detachable:false}]:[]),...(lift?[{id:liftModule,type:'lift',detachable:true}]:[])],
  claims:{teachingSketch:true,assumedDimensions:true,realBuildingReconstruction:false,sourceGeometryChanged:false,structuralCertification:false,codeComplianceCertified:false,openFrontSection:true,modelTriangles:0,liftAnimation:false,
   note:'独立教学假设；开前侧剖视，非实楼复原、施工顺序或结构/消防/无障碍认证。电梯仅离散楼层与门态示意。'}};
}
