import {growSketch} from '../building-rule-sketch-r06/sketch-model.mjs';
import {finitePrism} from '../building-rule-sketch-r06/kowloon-building-mother-r01/whole-building-floor-study-r01/floor-layout.mjs';
import {ASSEMBLY_SCHEMA,packAssemblyDescriptors,queryAssemblyInside} from '../building-rule-sketch-r06/kowloon-building-mother-r01/r07/assemblies.mjs';
const rect=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]];
const bounds=ps=>({min:[0,1,2].map(k=>Math.min(...ps.map(p=>p.bounds.min[k]))),max:[0,1,2].map(k=>Math.max(...ps.map(p=>p.bounds.max[k])))});
export function growRoom(params={}){
 const stage=params.stage??7,roofVisible=params.roofVisible??false;
 if(!Number.isInteger(stage)||stage<1||stage>7||typeof roofVisible!=='boolean')throw Error('Stage must be 1..7 and roofVisible must be boolean');
 const frame=growSketch({windowWidth:1.4,windowHeight:1.25,...params,caseId:'cell',storeys:1,stage:7,roofVisible:true});
 const r=frame.parameters,root=frame.model.sourceModelId,level=frame.levels[0].id,H=r.groundHeight-r.slabThickness-r.beamDepth,W=r.bayWidth,D=r.bayDepth,columnFace=r.columnWidth/2,wallHalf=r.wallThickness/2;
 // Reuse existing foundation / frame / slabs. Old corridor and old wall layout
 // are NOT the source of the new room: native boundary program below owns it.
 const structural=p=>['column','beam','roof'].includes(p.semanticClass)||p.nodeId.includes(':foundation:pad:')||p.nodeId===level+':slab';
 const ps=frame.model.archetypes.flatMap(a=>a.primitives).filter(structural).map(p=>structuredClone(p));
 const removed=new Set(frame.graph.nodes.filter(n=>/:wall:|:corridor|:room/.test(n.id)).map(n=>n.id));
 const graph={nodes:frame.graph.nodes.filter(n=>!removed.has(n.id)),edges:frame.graph.edges.filter(e=>!removed.has(e.from)&&!removed.has(e.to))};
 const edge=(from,to,type)=>graph.edges.push({from,to,type});
 const node=(id,type,label,owner,extra={})=>{graph.nodes.push({id,type,label,evidence:'authored_teaching_assumption',...extra});if(owner)edge(id,owner,'ownedBy');return id;};
 ps.forEach(p=>{const n=graph.nodes.find(n=>n.id===p.nodeId);let label;
  if(p.nodeId.includes(':foundation:pad:'))label='独立基础';else if(p.nodeId.includes(':ring-beam:'))label='基础联系梁';else if(p.semanticClass==='column')label='框架柱';else if(p.semanticClass==='beam')label='框架梁';else if(p.semanticClass==='roof')label='屋面板';else label='首层地面结构板';
  n.label=label;n.structureMaterial='concrete';n.loadSystem='frame';p.materialKey='concrete';p.componentLabel=label;
 });
 const room=node(level+':single-room','room','单间室内',level,{stage:6}),outside=node(root+':outside','exterior_space','室外',root,{stage:6});
 const slots=[{key:'entry',kind:'door',side:'front',width:params.roomDoorWidth??1.0,height:r.doorHeight,sill:0,center:W/2},{key:'window-right',kind:'window',side:'right',width:r.windowWidth,height:r.windowHeight,sill:r.windowSill,center:D/2},{key:'window-rear',kind:'window',side:'rear',width:r.windowWidth,height:r.windowHeight,sill:r.windowSill,center:W/2}];
 const sides=[{key:'front',origin:[0,0,0],u:[1,0,0],w:[0,0,-1],length:W},{key:'right',origin:[W,0,0],u:[0,0,1],w:[1,0,0],length:D},{key:'rear',origin:[W,0,D],u:[-1,0,0],w:[0,0,1],length:W},{key:'left',origin:[0,0,D],u:[0,0,-1],w:[-1,0,0],length:D}];
 const portals=[],wallPrograms=[];
 // Definition order: spatial boundary + portal roles first, complementary wall
 // intervals second. No full wall is made and boolean-cut after the fact.
 for(const side of sides){
  const wallId=node(level+':boundary:'+side.key,'wall',({front:'前',right:'右',rear:'后',left:'左'}[side.key])+'侧填充墙',room,{stage:7,hostRole:'wall',wallRole:'infill'});
  edge(wallId,level+':slab','supportedBy');edge(wallId,room,'boundsRoom');edge(wallId,outside,'boundsRoom');
  const slot=slots.find(s=>s.side===side.key);let areas=[];
  if(slot){const id=wallId+':'+slot.key;node(id,slot.kind+'_opening',slot.kind==='door'?'外门开口':'对外窗开口',wallId,{stage:7,openingType:slot.kind});edge(id,wallId,'hostedBy');edge(id,room,'opensBetween');edge(id,outside,'opensBetween');
   if(slot.kind==='door')edge(room,outside,'connectedByOpening');
   const lo=slot.center-slot.width/2,hi=slot.center+slot.width/2,top=slot.sill+slot.height;
   if(![slot.width,slot.height,slot.sill,slot.center].every(Number.isFinite)||slot.width<=0||slot.height<=0||slot.sill<0)throw Error('Positive finite opening dimensions required');
   if(top>=H||lo<=columnFace||hi>=side.length-columnFace)throw Error('Opening must remain clear of frame');
   // Infill stops at column faces and beam underside; no wall overlaps columns.
   areas=[[columnFace,0,lo,H],[hi,0,side.length-columnFace,H],[lo,top,hi,H],...(slot.sill>0?[[lo,0,hi,slot.sill]]:[])];
   portals.push({...slot,id,hostId:wallId,floorId:level,origin:side.origin.map((v,k)=>v+side.u[k]*slot.center+(k===1?slot.sill+slot.height/2:0)),u:side.u,v:[0,1,0],w:side.w,from:outside,to:room});
  }else areas=[[columnFace,0,side.length-columnFace,H]];
  areas.forEach((a,i)=>{if(a[2]<=a[0]||a[3]<=a[1])return;const id=wallId+':segment:'+i;node(id,'wall_segment','填充墙段',wallId,{stage:7});edge(id,wallId,'partOf');const p=finitePrism(id,[rect(...a)],[-wallHalf,wallHalf],{origin:side.origin,u:side.u,v:[0,1,0],w:side.w,materialKey:'mineral_plaster'});Object.assign(p,{semanticClass:'wall',stage:7,floorId:level,componentLabel:'填充墙段'});ps.push(p);});
  wallPrograms.push({id:wallId,side:side.key,opening:slot?.key??null,areas});
 }
 const floorId=node(level+':floor-finish','floor_finish','地面面层（素面示意）',level+':slab',{stage:5});edge(floorId,level+':slab','supportedBy');
 const finish=finitePrism(floorId,[rect(columnFace,columnFace,W-columnFace,D-columnFace)],[0,.012],{materialKey:'cement_finish'});Object.assign(finish,{semanticClass:'floor',stage:5,floorId:level,componentLabel:'地面面层（素面示意）'});ps.push(finish);
 // Existing door/window recipe is injected only after its provenance is verified.
 const components=params.componentFactory?.({portals,graph,root,level,params})??{primitives:[],apertures:[],chains:[]};
 ps.push(...components.primitives);
 ps.forEach((p,i)=>p.objectId=2000+i);
 const visible=ps.filter(p=>p.stage<=stage&&(roofVisible||p.semanticClass!=='roof'));
 const archetypes=[];for(let i=0;i<visible.length;i+=64){const group=visible.slice(i,i+64),a={schema:ASSEMBLY_SCHEMA,id:root+':room-batch:'+i,primitives:group,bounds:bounds(group),counts:{primitives:group.length,modelTriangles:0,modelVertexBuffers:0}};packAssemblyDescriptors(a);archetypes.push(a);}
 const box=bounds(visible);graph.nodes.forEach(n=>n.visible=(n.stage??0)<=stage&&(roofVisible||n.type!=='roof'));
 const model={...frame.model,graph,archetypes,instances:archetypes.map(a=>({id:a.id+':instance',archetypeId:a.id,translation:[0,0,0],floorId:level,objectIdOffset:10000,bounds:a.bounds})),bounds:box,hostedComponents:{apertures:stage>=7?components.apertures:[],sourceMasks:[],floorId:level},openingOwnership:{chains:components.chains},roomProgram:{room,outside,slots,wallPrograms}};
 const failures=[];const ids=new Set(graph.nodes.map(n=>n.id));for(const e of graph.edges)if(!ids.has(e.from)||!ids.has(e.to))failures.push('Missing endpoint '+e.from+' -> '+e.to);
 for(const p of portals){const point=p.origin;const walls=ps.filter(x=>x.semanticClass==='wall');if(queryAssemblyInside({schema:ASSEMBLY_SCHEMA,primitives:walls},point))failures.push('Blocked native slot '+p.id);}
 if(portals.filter(p=>p.kind==='door').length!==1||portals.filter(p=>p.kind==='window').length!==2)failures.push('Single room requires one external door and two windows');
 const checks={passed:!failures.length,failures,sharedFrameChecks:frame.checks.passed,nativeBoundaryProgram:true,openingHostCount:3,doorOnExterior:true,twoDistinctWindowWalls:true,structuralCertification:false};
 return {...frame,model,graph,source:{...frame.source,bounds:box},bounds:box,portals,rooms:[{id:room,polygon:rect(columnFace,columnFace,W-columnFace,D-columnFace)}],checks,parameters:{...frame.parameters,stage,roofVisible,roomDoorWidth:slots[0].width,roomOpenings:slots,structureMaterial:'concrete',structuralSystem:'frame',wallRole:'infill'},claims:{...frame.claims,openFrontSection:false,note:"单间教学假设；共享框架与原生空间边界。非实楼测量、结构设计或规范认证。"},routes:[{from:outside,to:room,via:portals[0].id}],supportProgram:{...frame.supportProgram,nodes:graph.nodes,edges:graph.edges,validation:{passed:checks.passed,scope:"graph endpoints and inherited frame only"}},counts:{...frame.counts,openings:3,ordinaryDoorLeaves:components.apertures.filter(a=>a.kind==='door').length,primitives:visible.length,totalPrimitives:ps.length,doors:1,windows:2,rooms:1},componentsReady:!!params.componentFactory};
}
