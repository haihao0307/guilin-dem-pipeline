// Display schedule only. No geometry, identity or ownership is regenerated.
export function constructionPlan(result){
 const m=result.model,nodes=new Map(m.graph.nodes.map(n=>[n.id,n])),owner=new Map(m.graph.edges.filter(e=>e.type==='ownedBy').map(e=>[e.from,e.to])),entities=[...m.archetypes.flatMap(a=>(a.spec??a).primitives),...(m.roundMembers??[])],stepById=new Map(),steps=[];
 const ancestor=(id,type)=>{const seen=new Set();while(id&&!seen.has(id)){seen.add(id);const n=nodes.get(id);if(n?.type===type)return n;id=owner.get(id);}return null;};
 const stair=new Map(entities.map(p=>[p.nodeId,ancestor(p.nodeId,'stair_connection')])),guard=new Map(entities.map(p=>[p.nodeId,ancestor(p.nodeId,'boundary_guard')]));
 function add(id,label,test){const addedIds=entities.filter(p=>!stepById.has(p.nodeId)&&test(p)).map(p=>p.nodeId);if(!addedIds.length)return;const index=steps.length;addedIds.forEach(id=>stepById.set(id,index));steps.push({index,id,label,addedIds,visibleCount:stepById.size});}
 add('foundations','基础 · 独立基础',p=>p.stage===1);
 add('foundation-beams','基础 · 联系梁',p=>p.stage===2);
 const first=result.levels[0];add('ground-slab','首层 · 地面结构板与面层',p=>p.floorId===first.id&&p.semanticClass==='floor'&&!stair.get(p.nodeId));
 for(const [i,l]of result.levels.entries()){
  const name=l.label??(i+1)+'层',next=result.levels[i+1];
  add(l.id+':columns',name+' · 立柱',p=>p.floorId===l.id&&p.semanticClass==='column');
  add(l.id+':beams',name+' · 搭梁',p=>p.floorId===l.id&&p.semanticClass==='beam');
  add(l.id+':next-slab',next?(next.label??(i+2)+'层')+' · 楼板与面层':'屋顶 · 楼板与面层',p=>!stair.get(p.nodeId)&&(next?p.floorId===next.id&&p.semanticClass==='floor':p.semanticClass==='roof'||(result.roofLevel?.id!==l.id&&p.floorId===result.roofLevel?.id&&p.semanticClass==='floor')));
  const destination=next?.id??result.roofLevel?.id;
  add(l.id+':access',name+' · 层间楼梯与到达边界护栏',p=>stair.get(p.nodeId)?.fromFloorId===l.id||Boolean(guard.get(p.nodeId)&&p.floorId===destination));
  add(l.id+':enclosure',name+' · 围护',p=>p.floorId===l.id&&p.semanticClass==='wall');
 }
 const missing=entities.filter(p=>!stepById.has(p.nodeId));if(missing.length)throw Error('Unscheduled construction entities: '+missing.map(p=>p.nodeId).join(','));
 for(const edge of m.graph.edges)if(edge.type==='supportedBy'&&stepById.has(edge.from)&&stepById.has(edge.to)&&stepById.get(edge.to)>stepById.get(edge.from))throw Error('Construction hides support: '+edge.from+' -> '+edge.to);
 return{steps,stepById,sourceModel:m,scope:'display_order_only_not_structural_construction_certification'};
}
export function constructionView(result,plan,index){
 const m=result.model;if(plan.sourceModel!==m)throw Error('Construction plan belongs to a different complete model');if(!Number.isInteger(index)||index<0||index>=plan.steps.length)throw Error('Construction step out of range');
 if(index===plan.steps.length-1)return m;
 const visible=p=>plan.stepById.get(p.nodeId)<=index,archetypes=m.archetypes.map(a=>{const spec=a.spec??a,primitives=spec.primitives.filter(visible),filtered={...spec,primitives,...(spec.counts?{counts:{...spec.counts,primitives:primitives.length}}:{})};return a.spec?{...a,spec:filtered}:filtered;}).filter(a=>(a.spec??a).primitives.length),ids=new Set(archetypes.map(a=>a.id));
 return{...m,archetypes,instances:m.instances.filter(i=>ids.has(i.archetypeId)),roundMembers:(m.roundMembers??[]).filter(visible),bounds:m.bounds};
}
