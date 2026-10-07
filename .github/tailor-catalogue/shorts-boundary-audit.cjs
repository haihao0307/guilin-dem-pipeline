const assert=require('node:assert/strict');
module.exports=function audit(record){
 const spec=record.snapshot.spec,positions=record.positionsMm,groups=record.materialToSolverGroup;
 assert.equal(groups.length,positions.length);
 const panels=new Map();let offset=0;
 for(const panel of spec.panels){panels.set(panel.id,{panel,offset});offset+=panel.uvMm.length;}
 const edge=ref=>{const {panel,offset}=panels.get(ref.panelId),ids=panel.edges[ref.edge].map(i=>i+offset);return ref.reverse?ids.reverse():ids;};
 const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 const seams=spec.seams.map(seam=>{const a=edge(seam.a),b=edge(seam.b);assert.equal(a.length,b.length);return{id:seam.id,a:seam.a,b:seam.b,stage:seam.stageId,sampleCount:a.length,maxGapMm:Math.max(...a.map((v,i)=>distance(positions[v],positions[b[i]]))),unsharedGroupCount:a.filter((v,i)=>groups[v]!==groups[b[i]]).length,pointsMm:a.map(i=>positions[i]),globalMaterialIds:a};});
 const incidence=new Map(),key=(a,b)=>a<b?a+':'+b:b+':'+a;
 for(const {panel,offset}of panels.values())for(const triangle of panel.triangles){const ids=triangle.map(i=>groups[i+offset]);if(new Set(ids).size<3)continue;for(let i=0;i<3;i++){const a=ids[i],b=ids[(i+1)%3],k=key(a,b);if(!incidence.has(k))incidence.set(k,{a,b,count:0,panels:[]});const item=incidence.get(k);item.count++;item.panels.push(panel.id);}}
 const boundary=[...incidence.values()].filter(e=>e.count===1),adj=new Map();
 for(const e of boundary)for(const[a,b]of[[e.a,e.b],[e.b,e.a]]){if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b);}
 const visited=new Set(),loops=[];
 for(const start of adj.keys()){if(visited.has(start))continue;const ids=[],stack=[start];while(stack.length){const i=stack.pop();if(visited.has(i))continue;visited.add(i);ids.push(i);stack.push(...adj.get(i));}const points=ids.map(i=>positions[i]),bounds={min:[0,1,2].map(j=>Math.min(...points.map(p=>p[j]))),max:[0,1,2].map(j=>Math.max(...points.map(p=>p[j])))};loops.push({vertexCount:ids.length,closed:ids.every(i=>adj.get(i).length===2),boundsMm:bounds,groupIds:ids});}
 const stitched=new Set(spec.seams.flatMap(s=>[s.a.panelId+'.'+s.a.edge,s.b.panelId+'.'+s.b.edge]));
 const freeEdges=[];for(const {panel,offset}of panels.values())for(const[name,ids]of Object.entries(panel.edges)){if(stitched.has(panel.id+'.'+name))continue;freeEdges.push({panelId:panel.id,edge:name,pointsMm:ids.map(i=>positions[i+offset]),globalMaterialIds:ids.map(i=>i+offset)});}
 return{schema:'kaopu-short-seam-boundary-audit@1',method:'Exact computed material vertices; paired sewing samples and triangle edge incidence after recorded equality groups. No projection or proximity weld.',seams,freeEdges,boundaryLoops:loops,nonManifoldEdges:[...incidence.values()].filter(e=>e.count>2),boundaryNonDegreeTwo:[...adj].filter(([,v])=>v.length!==2).map(([id,n])=>({group:id,degree:n.length})),vertexCount:positions.length};
};
