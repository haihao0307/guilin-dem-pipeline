// Display-only order: no geometry or identity is regenerated while playing.
export function constructionPlan(result){
 const entities=[...result.primitives,...result.roundMembers],nodes=new Map(result.graph.nodes.map(n=>[n.id,n])),owners=new Map(result.graph.edges.filter(e=>e.type==='ownedBy').map(e=>[e.from,e.to])),stepById=new Map,steps=[];
 const ancestor=id=>{const seen=new Set;while(id&&!seen.has(id)){seen.add(id);const n=nodes.get(id);if(n?.type==='stair_connection')return n;id=owners.get(id);}return null;};
 const stair=new Map(entities.map(p=>[p.nodeId,ancestor(p.nodeId)]));
 const add=(label,test)=>{const added=entities.filter(p=>!stepById.has(p.nodeId)&&test(p));if(!added.length)return;const index=steps.length;for(const p of added)stepById.set(p.nodeId,index);steps.push({index,label,ids:added.map(p=>p.nodeId),count:stepById.size});};
 add('独立基础',p=>p.stage===1);add('基础联系梁',p=>p.stage===2);
 add(result.levels[0].label+' · 底板与面层',p=>p.floorId===result.levels[0].id&&p.semanticClass==='floor'&&!stair.get(p.nodeId));
 for(const [i,l] of result.levels.entries()){
  add(l.label+' · 框架柱',p=>p.floorId===l.id&&p.semanticClass==='column');
  add(l.label+' · 框架梁',p=>p.floorId===l.id&&p.semanticClass==='beam');
  const next=result.levels[i+1];add(next?next.label+' · 楼板与通行孔':'屋面板',p=>!stair.get(p.nodeId)&&(next?p.floorId===next.id&&p.semanticClass==='floor':p.semanticClass==='roof'));
  add(l.label+' · 连通楼梯与连续扶手',p=>stair.get(p.nodeId)?.fromFloorId===l.id);
  add(l.label+' · 围护与原生门窗',p=>p.floorId===l.id&&p.stage===7);
 }
 const missing=entities.filter(p=>!stepById.has(p.nodeId));if(missing.length)throw Error('Unscheduled parts '+missing.map(p=>p.nodeId).join(','));
 for(const edge of result.graph.edges)if(edge.type==='supportedBy'&&stepById.has(edge.from)&&stepById.has(edge.to)&&stepById.get(edge.to)>stepById.get(edge.from))throw Error('Hidden support during growth '+edge.from);
 return{steps,stepById};
}
export function sceneFor(result,plan,options={}){
 const {step=plan.steps.length-1,walls=false,roof=false,explode=false,semanticColors=true}=options;
 const index=new Map(result.levels.map((l,i)=>[l.id,i]));
 const visible=p=>plan.stepById.get(p.nodeId)<=step&&(walls||p.semanticClass!=='wall')&&(roof||p.semanticClass!=='roof');
 const shift=p=>{const offset=explode?(index.get(p.floorId)??0)*1.65:0;if(!offset)return p;const move=a=>a.map((v,k)=>v+(k===1?offset:0)),q={...p,bounds:{min:move(p.bounds.min),max:move(p.bounds.max)}};if(p.origin)q.origin=move(p.origin);if(p.start){q.start=move(p.start);q.end=move(p.end);q.surfaceBounds=q.bounds;}return q;};
 const primitives=result.primitives.filter(visible).map(shift),roundMembers=result.roundMembers.filter(visible).map(shift),all=[...primitives,...roundMembers];
 const bounds=all.length?{min:[0,1,2].map(k=>Math.min(...all.map(p=>p.bounds.min[k]))),max:[0,1,2].map(k=>Math.max(...all.map(p=>p.bounds.max[k])))}:result.bounds;
 return{primitives,roundMembers,bounds,semanticColors};
}
