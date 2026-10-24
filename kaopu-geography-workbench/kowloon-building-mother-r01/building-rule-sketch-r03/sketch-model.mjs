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
 {stage:7,key:'walls-openings',label:'房间、墙、门洞与窗洞'}
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
 doorOpen=0,liftOpen=0,liftLevel=0,liftAttached=true,roofVisible=true,waistThickness=.14,storeys,pitDepth=1.2,overhead=1,windowSill=.9,windowHeight=1.2,windowWidth=1.2}={}) {
 if(!Object.hasOwn(SKETCH_CASES,caseId))throw Error('Unknown teaching sketch case');
 if(!Number.isInteger(stage)||!between(stage,1,7))throw Error('Stage must be 1..7');
 if(!between(groundHeight,2.6,5)||!between(typicalHeight,2.6,5))throw Error('Teaching floor heights must be 2.6..5 m');
 if(!between(waistThickness,.08,.28))throw Error('Teaching stair waist thickness must be .08.. .28 m');
 if(!between(windowSill,0,2)||!between(windowHeight,.3,2.2)||!between(windowWidth,.4,1.8))throw Error('Teaching window dimensions out of range');
 const floorCount=caseId==='cell'?1:(storeys??SKETCH_CASES[caseId].storeys);
 if(!Number.isInteger(floorCount)||!between(floorCount,caseId==='cell'?1:2,8))throw Error('Teaching connected/vertical storeys must be 2..8');
 if(!between(pitDepth,.6,3)||!between(overhead,.4,3))throw Error('Teaching pit/overhead dimensions out of range');
 if(!between(doorOpen,0,1)||!between(liftOpen,0,1)||!Number.isInteger(liftLevel)||!between(liftLevel,0,Math.max(1,floorCount-1))||typeof liftAttached!=='boolean'||typeof roofVisible!=='boolean')throw Error('Invalid door or lift setting');
 const def=SKETCH_CASES[caseId],r={...RULES},root='teaching-sketch:'+caseId,W=def.bayCount*r.bayWidth,D=r.bayDepth;
 const parameters={caseId,stage,groundHeight,typicalHeight,doorOpen,liftOpen,liftLevel,liftAttached,roofVisible,waistThickness,storeys:floorCount,pitDepth,overhead,windowSill,windowHeight,windowWidth,...r};
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

 // Opening type is explicit, never inferred from bottom height. Ordinary doors
 // and windows are empty host voids. Only the two distinct lift door mechanisms
 // emit leaves; there is no additional ordinary door in front of the lift.
 const wall=(id,a,b,base,height,{owner=null,floorId=null,opening=null,cls='wall',moduleId=mainModule,at=7,open=0,from=null,to=null,thickness=r.wallThickness,supportIds=null}={})=>{
  const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),u=[dx/L,0,dz/L],v=[0,1,0],w=[-dz/L,0,dx/L],origin=[a[0],base,a[1]];
  let loops=[rect(0,0,L,height)],portal=null;
  if(opening){
   const openingType=opening.type??'door',role=opening.role??(openingType==='window'?'window':'empty_doorway');
   const width=opening.width??r.doorWidth,apertureHeight=opening.height??r.doorHeight,sill=opening.sill??0,center=opening.at??L/2,lo=center-width/2,hi=center+width/2,top=sill+apertureHeight;
   if(!['door','window'].includes(openingType)||!['empty_doorway','window','lift_landing','lift_car'].includes(role)||![width,apertureHeight,sill,center].every(Number.isFinite)||lo<=0||hi>=L||sill<0||apertureHeight<=0||top>=height)throw Error('Opening must have an explicit type and fit its finite host');
   if(openingType==='door'&&sill!==0)throw Error('Door opening must start at its floor');
   loops=sill===0?[[[0,0],[lo,0],[lo,top],[hi,top],[hi,0],[L,0],[L,height],[0,height]]]:[rect(0,0,L,height),rect(lo,sill,hi,top)];
   portal={id:id+':opening',hostId:id,floorId,openingType,role,sill,bottomElevation:base+sill,topElevation:base+top,origin:copy(origin),u:copy(u),v:copy(v),w:copy(w),lo,hi,width,height:apertureHeight,from,to,open:role.startsWith('lift_')?open:1,moduleId,stage:at,
    center:[origin[0]+u[0]*center,base+sill,origin[2]+u[2]*center],leafIds:[],infillId:null,empty:!role.startsWith('lift_')};
  }
  const host=solid(id,cls,loops,[-thickness/2,thickness/2],{u,v,w,origin,owner:owner??floorId??root,stage:at,floorId,moduleId});
  for(const by of supportIds??(floorId?[program.floorTable[levels.findIndex(l=>l.id===floorId)].slab]:[]))support(id,by);
  if(portal){
   node(portal.id,portal.openingType+'_opening',id,{hostId:id,openingType:portal.openingType,openingRole:portal.role,sill:portal.sill,width:portal.width,height:portal.height,stage:at,floorId,moduleId,geometryGenerated:false,empty:portal.empty});
   for(const relation of ['hostedBy','voids'])edge(portal.id,id,relation);
   if(portal.role.startsWith('lift_')){
    for(const side of[-1,1]){const start=(side<0?portal.lo:(portal.lo+portal.hi)/2)+side*open*portal.width/2,idLeaf=id+':leaf:'+side;
     solid(idLeaf,'elevator',[rect(0,0,portal.width/2,portal.height)],[-.018,.018],{u,v,w,origin:[origin[0]+u[0]*start,base,origin[2]+u[2]*start],owner:id,stage:at,floorId,moduleId,supports:[id]});portal.leafIds.push(idLeaf);edge(idLeaf,id,'hostedBy');}
   }
   if(from&&to){if(portal.openingType==='door')edge(from,to,'connectedByOpening');edge(portal.id,from,'opensFrom');edge(portal.id,to,'opensTo');}
   for(const adjacent of [from,to].filter(Boolean)){edge(id,adjacent,'boundsRoom');edge(portal.id,adjacent,'opensBetween');}
   portals.push(portal);
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
  wall(l.id+':wall:rear',[0,D],[W,D],l.elevation,height,{floorId:l.id,opening:{type:'window',at:W-1,width:windowWidth,height:windowHeight,sill:windowSill}});
  wall(l.id+':wall:right',[W,D],[W,caseId==='connected'&&liftAttached?2.3:0],l.elevation,height,{floorId:l.id});
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

 // The shaft's outer boundary touches the existing slab edge exactly. One
 // shared building/shaft wall hosts each landing door. A short sill inside the
 // wall thickness meets the car floor; there is no remote bridge or second
 // building doorway. Landing doors and the travelling car door are independent
 // owned assemblies, coupled only when the car is at that floor.
 let lift=null;
 if(caseId==='connected'&&liftAttached){
  node(liftModule,'detachable_lift_module',root,{stage:6,certified:false});
  const slabEdge=W+.18,x0=slabEdge,x1=x0+2.2,z0=0,z1=2.3,wallCenter=x0+r.wallThickness/2,carFront=x0+.16,carDoorPlane=carFront+.02;
  const carElevation=levels[liftLevel].elevation,shaftBottom=-pitDepth,pitFloorTop=shaftBottom+.18,shaftTop=roofElevation+overhead;
  const foundation=liftModule+':foundation';box(foundation,'elevator',x0-.15,z0-.15,x1+.15,z1+.15,shaftBottom,pitFloorTop,{owner:liftModule,stage:6,moduleId:liftModule});
  wall(liftModule+':shaft:back',[x0,z1],[x1,z1],pitFloorTop,shaftTop-pitFloorTop,{owner:liftModule,cls:'elevator',moduleId:liftModule,at:6});
  wall(liftModule+':shaft:outer',[x1,z1],[x1,z0],pitFloorTop,shaftTop-pitFloorTop,{owner:liftModule,cls:'elevator',moduleId:liftModule,at:6});
  wall(liftModule+':pit:front',[wallCenter,z0],[wallCenter,z1],pitFloorTop,-pitFloorTop,{owner:liftModule,cls:'elevator',moduleId:liftModule,at:6});
  wall(liftModule+':overhead:front',[wallCenter,z0],[wallCenter,z1],roofElevation,overhead,{owner:liftModule,cls:'elevator',moduleId:liftModule,at:6});
  // The near side is deliberately omitted for an inspectable teaching section.
  const attachments=[];
  for(const [i,l]of levels.entries()){
   const dock=node(liftModule+':dock:'+i,'lift_landing',liftModule,{stage:6,floorId:l.id});
   const sillId=dock+':sill',hostId=dock+':door-host';
   box(sillId,'floor',slabEdge,.3,carFront,1.3,l.elevation-r.slabThickness,l.elevation,{owner:dock,stage:6,floorId:l.id,moduleId:liftModule,supports:[l.nodeId+':slab']});
   wall(hostId,[wallCenter,z0],[wallCenter,z1],l.elevation,l.height,{owner:dock,floorId:l.id,opening:{type:'door',role:'lift_landing',at:.8,width:1},cls:'elevator',moduleId:liftModule,at:6,open:i===liftLevel?liftOpen:0,from:corridors[i],to:dock});
   Object.assign(nodeMap.get(hostId),{sharedBuildingShaftBoundary:true});edge(hostId,l.nodeId,'formsBuildingBoundary');
   // Close the .18 m slab overhang return without a second wall on the route.
   wall(dock+':wall-return',[W,z1],[wallCenter,z1],l.elevation,l.height-r.slabThickness,{owner:dock,floorId:l.id,cls:'elevator',moduleId:liftModule,at:6});
   const landingPortalId=hostId+':opening';
   edge(dock,corridors[i],'attachedTo');attachments.push({floorId:l.id,corridorId:corridors[i],dockId:dock,hostId,landingPortalId,sillId,slabId:l.nodeId+':slab',slabEdge,carFloorEdge:carFront,thresholdDepth:carFront-slabEdge,position:[wallCenter,l.elevation,.8]});
  }
  const cabin=node(liftModule+':cabin','lift_cabin',liftModule,{stage:6,level:liftLevel,elevation:carElevation,positionMode:'discrete_parameter_not_animation'});
  box(cabin+':floor','elevator',carFront,.18,x1-.18,z1-.18,carElevation-.10,carElevation,{owner:cabin,stage:6,moduleId:liftModule,supports:[foundation]});
  box(cabin+':back','elevator',x1-.22,.18,x1-.16,z1-.18,carElevation,carElevation+2.2,{owner:cabin,stage:6,moduleId:liftModule,supports:[cabin+':floor']});
  box(cabin+':side','elevator',carFront,z1-.24,x1-.16,z1-.18,carElevation,carElevation+2.2,{owner:cabin,stage:6,moduleId:liftModule,supports:[cabin+':floor']});
  box(cabin+':ceiling','elevator',carFront,.18,x1-.18,z1-.18,carElevation+2.2,carElevation+2.26,{owner:cabin,stage:6,moduleId:liftModule,supports:[cabin+':back']});
  const carHost=cabin+':door-host',carPortalId=carHost+':opening';
  wall(carHost,[carDoorPlane,z0],[carDoorPlane,z1],carElevation,2.2,{owner:cabin,floorId:levels[liftLevel].id,opening:{type:'door',role:'lift_car',at:.8,width:1},cls:'elevator',moduleId:liftModule,at:6,open:liftOpen,from:attachments[liftLevel].dockId,to:cabin,thickness:.04,supportIds:[cabin+':floor']});
  const occupiedLandingPortalId=attachments[liftLevel].landingPortalId;
  edge(carPortalId,occupiedLandingPortalId,'coupledAtLanding');
  Object.assign(nodeMap.get(carPortalId),{coupledLandingPortalId:occupiedLandingPortalId});
  const facing=attachments.map((a,i)=>{
   const landing=portals.find(p=>p.id===a.landingPortalId),car=portals.find(p=>p.id===carPortalId),elevation=levels[i].elevation,carAtLanding=i===liftLevel;
   const thresholdRoute=[[W-.3,elevation,.8],[slabEdge,elevation,.8],[wallCenter,elevation,.8],[carDoorPlane,elevation,.8],[carFront+.65,elevation,.8]];
   return {floorId:a.floorId,landingPortalId:landing.id,carPortalId,landingDoorCenter:copy(landing.center),carDoorCenter:copy(car.center),landingDoorFacing:copy(landing.w),carDoorFacing:copy(car.w),doorAxesAligned:true,doorPlanesParallel:true,carAtLanding,verticalOffset:carElevation-elevation,directAttachment:true,slabEdge,shaftOuterBoundary:x0,thresholdDepth:a.thresholdDepth,doorPlaneSeparation:carDoorPlane-wallCenter,thresholdRoute};
  });
  lift={id:liftModule,attached:true,detachable:true,directAttachment:true,cabinId:cabin,carPortalId,occupiedLandingPortalId,level:liftLevel,elevation:carElevation,doorOpen:liftOpen,attachments,facing,pitDepth,pitFloorTop,shaftBottom,shaftTop,overhead,shaftAxis:[0,1,0],shaftBounds:{min:[x0,shaftBottom,z0],max:[x1,shaftTop,z1]},slabEdge,stops:levels.map((l,i)=>({floorId:l.id,elevation:l.elevation,landingPortalId:attachments[i].landingPortalId})),travelRange:[0,levels.at(-1).elevation],machineRoom:'unknown_not_generated',certified:false,animation:false,sectionView:true};
  for(const [i,a]of attachments.entries()){
   const arrival=facing[i],elevation=levels[i].elevation,available=i===liftLevel&&liftOpen>.99;
   const connectorId=node(a.dockId+':route','walk_route',a.dockId,{stage:6});edge(connectorId,corridors[i],'startsAt');edge(connectorId,cabin,'endsAt');
   routes.push({id:connectorId,type:'lift_connector',from:corridors[i],to:cabin,floorId:levels[i].id,stage:6,waypoints:copy(arrival.thresholdRoute),portalIds:[a.landingPortalId,carPortalId],continuous:i===liftLevel,cabinAtLanding:i===liftLevel,traversable:available,condition:'Landing door and separate car door open together only at the occupied stop; other landing doors stay closed.'});
   if(i){const id=node(liftModule+':stair-arrival-route'+(i===1?'':':'+i),'walk_route',liftModule,{stage:6});edge(id,corridors[i],'startsAt');edge(id,cabin,'endsAt');
    routes.push({id,type:'stair_to_lift',from:corridors[i],to:cabin,floorId:levels[i].id,stage:6,waypoints:[[2.15,elevation,1.4],[2.15,elevation,.8],...copy(arrival.thresholdRoute)],portalIds:[a.landingPortalId,carPortalId],continuous:i===liftLevel,traversable:available,condition:'Direct slab-to-shaft threshold, with the landing door and the separate car door both open and the car at this floor.'});}
  }
 }

 const entrance=node(root+':entry','ground_entry',root,{stage:6,position:[.95,0,-.1]});
 const entryRoute={id:root+':entry-route',type:'entry',from:entrance,to:corridors[0],stage:6,waypoints:[[.95,0,-.1],[.95,0,.8]],continuous:true};
 node(entryRoute.id,'walk_route',root,{stage:6});edge(entryRoute.id,entrance,'startsAt');edge(entryRoute.id,corridors[0],'endsAt');routes.push(entryRoute);
 for(const room of rooms){const floorIndex=levels.findIndex(l=>l.id===room.floorId),l=levels[floorIndex],portal=portals.find(p=>p.to===room.id),x=portal.center[0],points=copy(entryRoute.waypoints);
  for(let i=0;i<floorIndex;i++){const route=routes.find(p=>p.type==='stair'&&p.fromFloorId===levels[i].id);points.push(...copy(i?route.waypoints:route.waypoints.slice(1)));}
  points.push([x,l.elevation,.8],[x,l.elevation,1.4],[x,l.elevation,2.7]);
  const id=node(room.id+':entry-route','walk_route',room.id,{stage:7});edge(id,entrance,'startsAt');edge(id,room.id,'endsAt');edge(id,portal.id,'passesThrough');
  routes.push({id,type:'entry_to_room',from:entrance,to:room.id,floorId:room.floorId,stage:7,waypoints:points,portalIds:[portal.id],continuous:true,traversable:true,condition:'Empty room doorway; there is no ordinary door leaf to open.'});
 }
 const openingChains=[],emptyOpenings=[];
 for(const portal of portals){
  const hostNode=nodeMap.get(portal.hostId);hostNode.hostRole='wall';
  Object.assign(nodeMap.get(portal.id),{ownerBuildingId:root,openingOwnershipId:portal.id});
  if(portal.empty){
   // A semantic void is not an invented infill assembly. Keep its explicit
   // door/window type even for a floor-touching (sill = 0) window.
   emptyOpenings.push({buildingId:root,wallId:portal.hostId,openingId:portal.id,openingType:portal.openingType,infillId:null,parts:[]});
   continue;
  }
  const infillId=portal.id+':door-assembly';
  openingChains.push(attachOpeningOwnership({nodes,edges},{buildingId:root,wallId:portal.hostId,openingId:portal.id,infillId,infillType:'door',adjacentSpaceIds:[portal.from,portal.to].filter(Boolean),parts:portal.leafIds.map(id=>({id,type:'leaf'}))}));
  Object.assign(nodes.find(n=>n.id===infillId),{stage:portal.stage,floorId:portal.floorId,moduleId:portal.moduleId,doorRole:portal.role});portal.infillId=infillId;
 }
 const openingValidation=validateOpeningOwnership({nodes,edges},openingChains);
 for(const empty of emptyOpenings){
  const p=portals.find(p=>p.id===empty.openingId),n=nodeMap.get(p.id);
  for(const type of ['ownedBy','hostedBy','voids']){
   const parents=edges.filter(e=>e.from===p.id&&e.type===type);
   if(parents.length!==1||parents[0].to!==p.hostId)openingValidation.errors.push({code:'wrong_empty_host',message:'Empty opening must have one host wall: '+p.id});
  }
  if(n.type!==p.openingType+'_opening'||p.leafIds.length||p.infillId!==null)openingValidation.errors.push({code:'invalid_empty_opening',message:'Empty aperture type or components changed: '+p.id});
 }
 openingValidation.emptyOpeningCount=emptyOpenings.length;openingValidation.passed=openingValidation.errors.length===0;

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
  instances:archetypes.map(a=>({id:a.id+':instance',archetypeId:a.id,translation:[0,0,0],floorId:a.floorId,moduleId:a.moduleId,objectIdOffset:10000,bounds:copy(a.bounds)})),interfaces:{stairs:[]},openingOwnership:{chains:openingChains,emptyOpenings,validation:openingValidation},bounds};
 const source={sourceModelId:root,patches:[],bounds:copy(bounds),evidence:'no_real_building_source_used'};
 const counts={bays:bays.length,storeys:levels.length,columnsPerStorey:grid.points.length,beamsPerStorey:grid.spans.length,frameColumns:grid.points.length*levels.length,frameBeams:grid.spans.length*levels.length,foundationPads:pads.length,ringBeams:grid.spans.length,primitives:visible.length,totalPrimitives:primitives.length,rooms:rooms.length,openings:portals.length,doors:portals.filter(p=>p.openingType==='door').length,windows:portals.filter(p=>p.openingType==='window').length,ordinaryDoorLeaves:0,liftDoorAssemblies:openingChains.length,visibleByClass:{}};
 for(const p of visible)counts.visibleByClass[p.semanticClass]=(counts.visibleByClass[p.semanticClass]??0)+1;
 const failures=[],supportValidation=validateSupportProgram({...program,nodes,edges});failures.push(...supportValidation.failures,...openingValidation.errors.map(e=>e.message));
 const ids=new Set(nodes.map(n=>n.id));for(const e of edges)if(!ids.has(e.from)||!ids.has(e.to))failures.push('Missing graph endpoint: '+e.from+' -> '+e.to);
 const only=p=>({schema:ASSEMBLY_SCHEMA,primitives:[p]});
 for(const portal of portals){const p=primitives.find(p=>p.nodeId===portal.hostId),q=[0,1,2].map(k=>portal.origin[k]+portal.u[k]*(portal.lo+portal.hi)/2+portal.v[k]*(portal.sill+portal.height/2));if(queryAssemblyInside(only(p),q))failures.push('Blocked opening host: '+portal.id);}
 if(stair)for(const connection of stair.connections){const slab=primitives.find(p=>p.nodeId===connection.upperSlabId),elevation=connection.baseElevation+connection.height;for(const point of[[.95,elevation-.08,2.6],[2.15,elevation-.08,2.6],[1.6,elevation-.08,4.2]])if(queryAssemblyInside(only(slab),point))failures.push('Stair hole blocked');}
 const columnSpec={schema:ASSEMBLY_SCHEMA,primitives:primitives.filter(p=>p.semanticClass==='column')};
 for(const joint of columnJoints)for(const offset of[-r.slabThickness*.75,-.001,.001])if(!queryAssemblyInside(columnSpec,[joint.position[0],joint.position[1]+offset,joint.position[2]]))failures.push('Column joint gap: '+joint.upperId);
 if(stair){const stairSpec={schema:ASSEMBLY_SCHEMA,primitives:primitives.filter(p=>p.moduleId===stairModule)};for(const f of stair.flights)for(const t of[.5,.7,.9])if(queryAssemblyInside(stairSpec,[f.x0+f.width/2,f.base+f.rise*t-f.waistVerticalDepth-.08,f.z0+f.direction*f.run*t]))failures.push('Solid fill remains below flight: '+f.id);}
 if(lift){
  if(lift.shaftBounds.min[0]!==W+.18)failures.push('Lift shaft not flush with slab');
  const openPath=lift.facing[liftLevel].thresholdRoute,walkable=primitives.filter(p=>['floor','elevator'].includes(p.semanticClass));
  for(let i=1;i<openPath.length;i++)for(const t of [.1,.5,.9]){
   const q=openPath[i-1].map((v,k)=>v+(openPath[i][k]-v)*t);
   if(!queryAssemblyInside({schema:ASSEMBLY_SCHEMA,primitives:walkable},[q[0],q[1]-.025,q[2]]))failures.push('Lift threshold lacks floor support');
   if(liftOpen>.99)for(const dy of [.05,.9,1.95])if(queryAssemblyInside({schema:ASSEMBLY_SCHEMA,primitives},[q[0],q[1]+dy,q[2]]))failures.push('Direct lift threshold blocked');
  }
 }
 const checks={passed:failures.length===0,failures,supportDAG:supportValidation.passed,openingOwnership:openingValidation.passed,sharedMembersDeduplicated:true,doorHostsCut:!failures.some(f=>f.startsWith('Blocked opening')),windowHostsCut:!failures.some(f=>f.startsWith('Blocked opening')),emptyOrdinaryDoorways:true,upperStairOpening:!failures.includes('Stair hole blocked'),frameJointsContinuous:!failures.some(f=>f.startsWith('Column joint gap')),underFlightsHollow:!failures.some(f=>f.startsWith('Solid fill')),liftDirectThreshold:!failures.some(f=>f.startsWith('Lift threshold')||f.startsWith('Direct lift')||f.startsWith('Lift shaft')),separateLiftDoorOwnership:true,modelTriangles:0,modelVertexBuffers:0,sourceUnchanged:true,structuralCertification:false};
 if(!checks.passed)throw Error(failures.join('; '));program.validation=supportValidation;
 return {model,source,graph,checks,validation:checks,parameters,stages:copy(SKETCH_STAGES),caseLabel:def.label,grid,bays,levels,counts,bounds,roofElevation,
  portals,rooms,routes,stair,lift,columnJoints,supportProgram:{...program,nodes,edges},
  modules:[{id:mainModule,type:'frame',detachable:false},...(stair?[{id:stairModule,type:'stair',detachable:false}]:[]),...(lift?[{id:liftModule,type:'lift',detachable:true}]:[])],
  claims:{teachingSketch:true,assumedDimensions:true,realBuildingReconstruction:false,sourceGeometryChanged:false,structuralCertification:false,codeComplianceCertified:false,openFrontSection:true,modelTriangles:0,liftAnimation:false,
   note:'独立教学假设；开前侧剖视，非实楼复原、施工顺序或结构/消防/无障碍认证。电梯仅离散楼层与门态示意。'}};
}
