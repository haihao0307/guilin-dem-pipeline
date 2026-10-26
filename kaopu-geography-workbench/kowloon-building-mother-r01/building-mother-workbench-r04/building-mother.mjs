import{context,rect,boundsOf}from'./primitive-kernel.mjs';
import{growStair,stairOpening}from'./stair-rule.mjs';
export const DEFAULTS=Object.freeze({floors:2,storeyHeight:3.6,width:4,depth:5,column:.28,beamWidth:.25,beamDepth:.32,slab:.16,wall:.12,finish:.012,foundationBottom:-.8,foundationTop:-.36,pad:.8,railNoiseAmplitude:0,stage:7,roofVisible:false});
export function growBuilding(input={}){
 if(Object.keys(input).some(k=>!['floors','storeyHeight','stage','roofVisible','railNoiseAmplitude'].includes(k)))throw Error('Only tested instance differences are supported');
 const p={...DEFAULTS,...input};if(![1,2].includes(p.floors)||!Number.isFinite(p.storeyHeight)||p.storeyHeight<3||p.storeyHeight>4.2||!Number.isInteger(p.stage)||p.stage<1||p.stage>7||typeof p.roofVisible!=='boolean'||!Number.isFinite(p.railNoiseAmplitude)||p.railNoiseAmplitude<0||p.railNoiseAmplitude>.002)throw Error('Supported teaching range: 1–2 floors, 3–4.2m height');
 const root='building-mother:room',e=context(root),W=p.width,D=p.depth,corners=[[0,0],[W,0],[W,D],[0,D]],levels=Array.from({length:p.floors},(_,i)=>({id:root+':L'+i,nodeId:root+':L'+i,label:(i+1)+'层',elevation:i*p.storeyHeight,height:p.storeyHeight}));
 for(const l of levels)e.node(l.id,'floor_level',l.label,root,{stage:3});
 const pads=corners.map(([x,z],i)=>{const id=root+':foundation:'+i;e.box(id,'floor',[x-p.pad/2,p.foundationBottom,z-p.pad/2],[x+p.pad/2,p.foundationTop,z+p.pad/2],{label:'独立基础',stage:1});return id;});
 const beams=corners.map(([x,z],i)=>{const[x1,z1]=corners[(i+1)%4],id=root+':foundation-beam:'+i;const horizontal=z===z1;e.box(id,'beam',[Math.min(x,x1)-(horizontal?0:.16),p.foundationTop,Math.min(z,z1)-(horizontal?.16:0)],[Math.max(x,x1)+(horizontal?0:.16),0,Math.max(z,z1)+(horizontal?.16:0)],{label:'基础联系梁',stage:2,supports:[pads[i],pads[(i+1)%4]]});return id;});
 const transitions=[];
 // One standard-layer function. Only index/elevation and its incoming port vary.
 function standardLayer(l,i){const y=l.elevation,next=y+p.storeyHeight,below=i?levels[i-1].id:null,hole=i?stairOpening():null;
  corners.forEach(([x,z],j)=>e.box(l.id+':column:'+j,'column',[x-p.column/2,i?y:p.foundationTop,z-p.column/2],[x+p.column/2,next,z+p.column/2],{owner:l.id,label:'框架柱',floorId:l.id,stage:3,supports:[i?below+':column:'+j:pads[j]]}));
  corners.forEach(([x,z],j)=>{const[x1,z1]=corners[(j+1)%4],horizontal=z===z1;e.box(l.id+':beam:'+j,'beam',[Math.min(x,x1)-(horizontal?0:p.beamWidth/2),next-p.slab-p.beamDepth,Math.min(z,z1)-(horizontal?p.beamWidth/2:0)],[Math.max(x,x1)+(horizontal?0:p.beamWidth/2),next-p.slab,Math.max(z,z1)+(horizontal?p.beamWidth/2:0)],{owner:l.id,label:'框架梁',floorId:l.id,stage:4,supports:[l.id+':column:'+j,l.id+':column:'+((j+1)%4)]});});
  const slabId=l.id+':slab';e.prism(slabId,'floor',[rect(-.18,-.18,W+.18,D+.18),...(hole?[hole]:[])],[y-p.slab,y],{owner:l.id,label:i?'上层楼板（楼梯孔）':'首层地面结构板',floorId:l.id,stage:5,supports:i?corners.map((_,j)=>below+':beam:'+j):beams});
  e.prism(l.id+':finish','floor',[rect(p.column/2,p.column/2,W-p.column/2,D-p.column/2),...(hole?[hole]:[])],[y,y+p.finish],{owner:slabId,label:'地面面层（原素面）',floorId:l.id,stage:5,supports:[slabId]});
 }
 levels.forEach(standardLayer);
 for(let i=1;i<levels.length;i++)transitions.push(growStair({id:root+':stair:'+i,lowerId:levels[i-1].id,upperId:levels[i].id,elevation:levels[i-1].elevation,rise:p.storeyHeight,roomWidth:W,roomDepth:D,finish:p.finish,slabThickness:p.slab,railNoiseAmplitude:p.railNoiseAmplitude},e));
 const top=levels.at(-1),roofId=root+':roof';e.prism(roofId,'roof',[rect(-.25,-.25,W+.25,D+.25)],[p.floors*p.storeyHeight-p.slab,p.floors*p.storeyHeight],{owner:top.id,label:'屋面板（可选显示）',floorId:top.id,stage:5,supports:corners.map((_,j)=>top.id+':beam:'+j)});
 // Shared enclosure grows from level/port roles; never cut a finished wall.
 const outside=e.node(root+':outside','exterior_space','室外',root,{stage:7}),H=p.storeyHeight-p.slab-p.beamDepth,half=p.column/2,portals=[];
 function enclosure(l,i){const base=i?l.id:root,room=e.node(base+':room','room',l.label+'单间',l.id,{stage:7}),y=l.elevation;
 const window={kind:'window',width:1.4,height:1.25,sill:.9};
 const sides=[['前',[0,y,0],[1,0,0],[0,0,-1],W,{center:W/2,...(i?window:{kind:'door',width:1,height:2.1,sill:0})}],['右',[W,y,0],[0,0,1],[1,0,0],D,{center:D/2,...window}],['后',[W,y,D],[-1,0,0],[0,0,1],W,{center:W/2,...window}],['左',[0,y,D],[0,0,-1],[-1,0,0],D,null]];
 for(const[name,origin,u,w,L,slot]of sides){const host=e.node(base+':wall:'+name,'wall',name+'侧填充墙',room,{stage:7,wallRole:'infill',floorId:l.id});e.edge(host,l.id+':slab','supportedBy');let areas;
  if(slot){const id=e.node(host+':port',slot.kind+'_opening',slot.kind==='door'?'外门开口':'对外窗开口',host,{stage:7,floorId:l.id});e.edge(id,host,'hostedBy');e.edge(id,room,'opensBetween');e.edge(id,outside,'opensBetween');const lo=slot.center-slot.width/2,hi=slot.center+slot.width/2,t=slot.sill+slot.height;areas=[[half,0,lo,H],[hi,0,L-half,H],[lo,t,hi,H],...(slot.sill?[[lo,0,hi,slot.sill]]:[])];portals.push({id,hostId:host,...slot,origin,u,w});}else areas=[[half,0,L-half,H]];
  areas.forEach((a,j)=>e.prism(host+':segment:'+j,'wall',[rect(...a)],[-p.wall/2,p.wall/2],{origin,u,v:[0,1,0],w,owner:host,label:'填充墙段',floorId:l.id,stage:7,supports:[l.id+':slab']}));
 }}
 levels.forEach(enclosure);
 const rounds=(e.roundMembers??[]).filter(q=>q.stage<=p.stage);
 const visible=e.primitives.filter(q=>q.stage<=p.stage&&(p.roofVisible||q.nodeId!==roofId)),archetypes=[];
 for(let i=0;i<visible.length;i+=64){const group=visible.slice(i,i+64);archetypes.push({schema:'kaopu.evidence-function-assembly/0.1',id:root+':batch:'+i,primitives:group,bounds:boundsOf(group),counts:{primitives:group.length,modelTriangles:0,modelVertexBuffers:0}});}
 const bounds=boundsOf([...visible,...rounds]),graph={nodes:e.nodes,edges:e.edges},ids=new Set(e.nodes.map(n=>n.id)),failures=e.edges.filter(a=>!ids.has(a.from)||!ids.has(a.to)).map(a=>'Missing graph endpoint '+a.from+' -> '+a.to);
 const model={schema:'kaopu.function-teaching-sketch/0.1',sourceModelId:root,placementMode:'UNREGISTERED_evidence_plan_NOT_part_of_measured_mother',graph,levels,archetypes,roundMembers:rounds,instances:archetypes.map(a=>({id:a.id+':instance',archetypeId:a.id,translation:[0,0,0],objectIdOffset:10000,bounds:a.bounds})),interfaces:{stairs:[]},bounds};
 return{model,graph,source:{sourceModelId:root,patches:[],bounds},parameters:p,bounds,levels,transitions,portals,primitives:e.primitives,roundMembers:e.roundMembers??[],checks:{passed:!failures.length,failures,structuralCertification:false},counts:{storeys:p.floors,frameColumns:4*p.floors,frameBeams:4*p.floors,primitives:visible.length+rounds.length,totalPrimitives:e.primitives.length+(e.roundMembers??[]).length,stairConnections:transitions.length},claims:{teachingDimensions:true,sourceMeasurements:false,oneStandardLayerFunction:true,doorWindowPartsNotIntegrated:true}};
}
