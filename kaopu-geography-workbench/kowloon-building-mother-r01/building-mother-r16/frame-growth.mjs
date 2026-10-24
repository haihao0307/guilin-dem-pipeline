/** Small typed growth DAG. A prerequisite points from dependent -> support.
 * This is a generative dependency model, NOT a construction sequence or design
 * certification. Ring beams are opt-in frame prototypes, never universal facts. */
export function mergeBays(bays){
 const points=[],spans=[],pointIndex=new Map(),spanSet=new Set();
 for(const bay of bays){if(bay.length!==4)throw Error('Frame-cell requires four corners');const ids=bay.map(p=>{if(p.length!==2||p.some(v=>!Number.isFinite(v)))throw Error('Finite grid points required');const key=p.map(v=>v.toFixed(7)).join(',');if(!pointIndex.has(key)){pointIndex.set(key,points.length);points.push([...p]);}return pointIndex.get(key);});if(new Set(ids).size!==4)throw Error('Collapsed frame cell');
 for(let i=0;i<4;i++){const pair=[ids[i],ids[(i+1)%4]].sort((a,b)=>a-b),key=pair.join(':');if(!spanSet.has(key)){spanSet.add(key);spans.push(pair);}}}
 return{points,spans,sharedBoundaryPolicy:'one physical point/member, multiple bay references'};
}
export function compileSupportProgram({root,levels,grid,foundation={status:'unknown'},ringBeamPrototype=false}){
 if(!root||!levels.length||!grid?.points?.length)throw Error('Retained levels and explicit structural grid required');
 const nodes=[],edges=[],add=(id,type,props={})=>{nodes.push({id,type,...props});return id;},relation=(a,b,type)=>edges.push({from:a,to:b,type}),support=(a,b)=>{relation(a,b,'supportedBy');relation(a,b,'dependsOn');};
 add(root,'building');const foundationId=add(root+':growth:foundation','foundation',{evidence:foundation.status,actualDimensions:null,geometryGenerated:false});relation(foundationId,root,'ownedBy');
 const ground=add(root+':growth:ground-support',ringBeamPrototype?'ring_beam':'ground_support_interface',{evidence:ringBeamPrototype?'explicit_frame_prototype':'unknown_actual_support_arrangement',actualDimensions:null,geometryGenerated:false});relation(ground,root,'ownedBy');support(ground,foundationId);
 const floorTable=[];
 for(const [i,l]of levels.entries()){
  if(!Number.isFinite(l.elevation)||(i&&l.elevation<=levels[i-1].elevation))throw Error('Actual floor sequence must strictly increase');
  const floor=add(l.nodeId,'floor',{elevation:l.elevation,exception:i===0?'ground_special':i===levels.length-1?'top_closure':'typical'});relation(floor,root,'ownedBy');
  const slab=add(l.nodeId+':slab','floor_slab');relation(slab,floor,'ownedBy');if(i===0)support(slab,ground);else for(const b of floorTable[i-1].beams)support(slab,b);
  const columns=grid.points.map((point,k)=>{const id=add(l.nodeId+':complete:column:'+k,'column',{gridPoint:[...point]});relation(id,floor,'ownedBy');support(id,slab);return id;});
  const beams=grid.spans.map((pair,k)=>{if(pair.length!==2||pair[0]===pair[1]||pair.some(j=>!Number.isInteger(j)||!columns[j]))throw Error('Beam endpoints require actual grid columns');const id=add(l.nodeId+':complete:beam:'+k,'beam',{columnKeys:pair});relation(id,floor,'ownedBy');for(const j of pair)support(id,columns[j]);return id;});
  floorTable.push({id:floor,slab,columns,beams,exception:i===0?'ground_special':i===levels.length-1?'top_closure':'typical'});
 }
 const roof=add(root+':roof-system:r07:diaphragm','roof_closure',{evidence:'authored_closure_not_actual_roof_replacement'});relation(roof,root,'ownedBy');for(const b of floorTable.at(-1).beams)support(roof,b);
 const program={nodes,edges,floorTable,foundationId,roof,actualFoundationVerified:foundation.status==='observed',isConstructionInstruction:false};program.validation=validateSupportProgram(program);if(!program.validation.passed)throw Error(program.validation.failures.join('; '));return program;
}
export function validateSupportProgram(program){const {nodes,edges}=program,ids=new Set(nodes.map(n=>n.id)),failures=[],visiting=new Set(),visited=new Set(),order=[];
 if(ids.size!==nodes.length)failures.push('duplicate support identity');for(const e of edges)if(!ids.has(e.from)||!ids.has(e.to))failures.push('missing dependency endpoint');
 const required=new Set(['column','beam','floor_slab','roof_closure','ring_beam','ground_support_interface']);for(const n of nodes)if(required.has(n.type)&&!edges.some(e=>e.from===n.id&&e.type==='supportedBy'))failures.push('unsupported '+n.id);
 const dependencies=new Map(nodes.map(n=>[n.id,edges.filter(e=>e.from===n.id&&e.type==='dependsOn').map(e=>e.to)]));
 function walk(id){if(visiting.has(id)){failures.push('cyclic dependency '+id);return;}if(visited.has(id)||!ids.has(id))return;visiting.add(id);for(const d of dependencies.get(id))walk(d);visiting.delete(id);visited.add(id);order.push(id);}
 for(const n of nodes)walk(n.id);
 const seenPoints=new Set(),seenSpans=new Set();for(const f of program.floorTable??[]){for(const id of f.columns){const n=nodes.find(n=>n.id===id),key=f.id+':'+n.gridPoint.join(',');if(seenPoints.has(key))failures.push('duplicate shared column');seenPoints.add(key);}for(const id of f.beams){const n=nodes.find(n=>n.id===id),key=f.id+':'+[...n.columnKeys].sort((a,b)=>a-b).join(':');if(seenSpans.has(key))failures.push('duplicate shared beam');seenSpans.add(key);}}
 return{passed:failures.length===0,failures,generationOrder:order,actualSupportArrangementVerified:program.actualFoundationVerified===true,structuralCertification:false};
}
