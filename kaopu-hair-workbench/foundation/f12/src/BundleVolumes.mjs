import {BUNDLES,PARENTS,parentOf,bundleOf} from './BundlePlan.mjs';
import {add,sub,mul,mix,len,cross,dot,unit,smooth,clamp} from './approved/LegacyFoundation.mjs';
import {point} from './NativeSurface.mjs';
import {clumpRule,clumpOf} from './ClumpRules.mjs';
import {createSweptClump,guideThroughClump} from './SweptClumps.mjs';
import {buildBundlePlan} from './BundlePlan.mjs';
const area3=(a,b,c)=>len(cross(sub(b,a),sub(c,a)))*.5;
const centroid=a=>a.reduce((p,v)=>add(p,mul(v,1/a.length)),[0,0,0]);
// All clipping happens on the APPROVED SCALP, before hair geometry exists.
// A root patch, not a face on a pre-existing shell, owns each full volume.
export function splitRootPatches(scalp,recipe){
 const part=recipe.partMM*.001,planes=[[0,part-.063],[0,part-.003],[0,part],[0,part+.006],[2,.077],[2,.100],[1,.378],[2,.045],[2,-.027],[1,.336],[1,.390],[1,.335],[1,.318]];
 const bank=new Map(BUNDLES.map(b=>[b.id,{id:b.id,parent:parentOf(b.id),area:0,cells:[],nodes:[],triangles:[],boundary:[],nodeMap:new Map(),edges:new Map()}]));
 const vertex=(a,b,t)=>({p:mix(a.p,b.p,t),chartP:mix(a.chartP,b.chartP,t),b:mix(a.b,b.b,t),edge:a.edge&&b.edge});
 const cut=(poly,axis,value)=>{
  const lo=Math.min(...poly.map(v=>v.chartP[axis])),hi=Math.max(...poly.map(v=>v.chartP[axis]));if(lo>=value-1e-11||hi<=value+1e-11)return[poly];
  const neg=[],pos=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=a.chartP[axis]-value,db=b.chartP[axis]-value;if(da<=1e-11)neg.push(a);if(da>=-1e-11)pos.push(a);if(da*db<0){const v=vertex(a,b,da/(da-db));neg.push(v);pos.push(v);}}return[neg,pos].filter(p=>p.length>=3);
 };
 for(const cell of scalp.cells){let polygons=[cell.v.map(v=>({...v,edge:Math.abs(v.s)<1e-8}))];for(const[axis,value]of planes)polygons=polygons.flatMap(p=>cut(p,axis,value));for(const poly of polygons){const center=centroid(poly.map(v=>v.chartP)),patch=bank.get(bundleOf({chartP:center},recipe));for(let k=1;k<poly.length-1;k++){const v=[poly[0],poly[k],poly[k+1]],area=area3(...v.map(v=>v.p));if(area<1e-14)continue;patch.area+=area;patch.cells.push({f:cell.f,v,area,cdf:patch.area});const ids=v.map(v=>{const key=v.p.map(x=>Math.round(x*1e7)).join(',');let i=patch.nodeMap.get(key);if(i===undefined){i=patch.nodes.length;patch.nodeMap.set(key,i);patch.nodes.push({...v,f:cell.f});}return i;});patch.triangles.push(...ids);for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=a<b?a+','+b:b+','+a,edge=patch.edges.get(key);if(edge)edge.count++;else patch.edges.set(key,{a,b,count:1});}}}}
 for(const patch of bank.values()){
  for(const e of patch.edges.values())if(e.count===1){const a=patch.nodes[e.a],b=patch.nodes[e.b],onRootBoundary=a.edge&&b.edge,onPlane=planes.some(([axis,v])=>Math.abs(a.chartP[axis]-v)<1e-8&&Math.abs(b.chartP[axis]-v)<1e-8);if(onRootBoundary||onPlane)patch.boundary.push([e.a,e.b]);}
  delete patch.nodeMap;delete patch.edges;
 }
 const patches=[...bank.values()],sum=patches.reduce((n,p)=>n+p.area,0);if(Math.abs(sum-scalp.area)>1e-9||patches.some(p=>!p.cells.length||!p.boundary.length))throw Error('头皮根区面积或边界不完整');
 return {patches,area:sum,originalArea:scalp.area,areaErrorCM2:(sum-scalp.area)*1e4,method:'plane-clipped approved native scalp cells; exact area on this piecewise-linear mesh'};
}
export function populationBudget(rootPatches,density=180){
 const total=Math.round(rootPatches.area*1e4*density),raw=rootPatches.patches.map(p=>({id:p.id,parent:p.parent,areaCM2:p.area*1e4,densityPerCM2:density,targetCount:Math.floor(p.area*1e4*density),fraction:p.area*1e4*density%1}));let remaining=total-raw.reduce((n,p)=>n+p.targetCount,0);for(const p of [...raw].sort((a,b)=>b.fraction-a.fraction))if(remaining-->0)p.targetCount++;
 return {schema:'kaopu/hair-population-budget@1',meaning:'authored target strands, NOT measured biological follicles',densityUnits:'target strands per cm2 of actual P01 scalp patch',densityPerCM2:density,totalTarget:total,totalAreaCM2:rootPatches.area*1e4,seed:190915,patches:raw.map(({fraction,...p})=>p),groups:PARENTS.map(g=>({...g,areaCM2:raw.filter(p=>p.parent===g.id).reduce((n,p)=>n+p.areaCM2,0),targetCount:raw.filter(p=>p.parent===g.id).reduce((n,p)=>n+p.targetCount,0)}))};
}
// A consumer can deterministically distribute the quantity budget over the
// actual root area, then apply the same bundle guide field. No image pixels
// or guessed 2D color areas are used as follicle counts.
export function samplePatchRoots(patch,count,seed=190915){
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;},out=[];
 for(let i=0;i<count;i++){const wanted=random()*patch.area;let a=0,b=patch.cells.length-1;while(a<b){const m=(a+b)>>1;if(patch.cells[m].cdf<wanted)a=m+1;else b=m;}const c=patch.cells[a],u=Math.sqrt(random()),v=random(),w=[1-u,u*(1-v),u*v],bary=[0,1,2].map(k=>c.v.reduce((n,p,j)=>n+w[j]*p.b[k],0));out.push({triangle:c.f,barycentric:bary,patchId:patch.id,parent:patch.parent});}return out;
}
export function clumpBudget(clumps,totalTarget){const area=clumps.reduce((n,c)=>n+c.sourceAreaCM2,0),rows=clumps.map(c=>({id:c.id,targetCount:Math.floor(totalTarget*c.sourceAreaCM2/area),fraction:totalTarget*c.sourceAreaCM2/area%1}));let left=totalTarget-rows.reduce((n,c)=>n+c.targetCount,0);for(const c of [...rows].sort((a,b)=>b.fraction-a.fraction))if(left-->0)c.targetCount++;return rows.map(({fraction,...r})=>r);}
export function validatePopulation(population,contract){
 const budget=population?.budget,patches=population?.rootPatches;
 if(budget?.schema!=='kaopu/hair-population-budget@1'||!Number.isFinite(budget.densityPerCM2)||budget.densityPerCM2<80||budget.densityPerCM2>260||patches?.length!==BUNDLES.length||new Set(patches.map(p=>p.id)).size!==BUNDLES.length||budget.patches?.length!==BUNDLES.length||budget.groups?.length!==PARENTS.length)throw Error('发束数量与源区契约无效');
 let area=0,count=0;for(const patch of patches){const spec=BUNDLES.find(b=>b.id===patch.id),row=budget.patches.find(b=>b.id===patch.id);if(!spec||patch.parent!==parentOf(patch.id)||!row||row.parent!==patch.parent||!Number.isFinite(patch.area)||patch.area<=0||!Number.isInteger(row.targetCount)||row.targetCount<0||!Array.isArray(patch.cells)||!patch.cells.length)throw Error('源区或数量无效');let sum=0;for(const c of patch.cells){if(!Number.isInteger(c.f)||c.f<0||c.f>=50624||!Number.isFinite(c.area)||c.area<=0||c.v?.length!==3)throw Error('源区三角面无效');for(const v of c.v)if(v.b?.length!==3||v.b.some(x=>!Number.isFinite(x)||x< -1e-8||x>1+1e-8)||Math.abs(v.b.reduce((n,x)=>n+x,0)-1)>1e-8)throw Error('源区重心坐标无效');sum+=c.area;if(Math.abs(sum-c.cdf)>1e-9)throw Error('源区面积分布不连续');}if(Math.abs(sum-patch.area)>1e-9||Math.abs(row.areaCM2-patch.area*1e4)>1e-6||Math.abs(row.targetCount-row.areaCM2*budget.densityPerCM2)>1)throw Error('源区面积或数量不一致');area+=patch.area;count+=row.targetCount;}
 if(Math.abs(area*1e4-budget.totalAreaCM2)>1e-6||count!==budget.totalTarget||count!==Math.round(area*1e4*budget.densityPerCM2))throw Error('发束总面积或总数量不一致');
 for(const group of budget.groups){const rows=budget.patches.filter(p=>p.parent===group.id);if(!PARENTS.some(p=>p.id===group.id)||group.targetCount!==rows.reduce((n,r)=>n+r.targetCount,0)||Math.abs(group.areaCM2-rows.reduce((n,r)=>n+r.areaCM2,0))>1e-6)throw Error('发束层组数量不一致');}
 if(contract?.schema!=='kaopu/root-grown-bundle-volumes@3'||contract.globalShellUsed!==false||contract.parts?.length!==BUNDLES.length||contract.groups?.length!==PARENTS.length)throw Error('缺少独立根区生成的三维体量');for(const part of contract.parts){const row=budget.patches.find(b=>b.id===part.id);if(!row||row.parent!==part.parent||Math.abs(row.areaCM2-part.sourceAreaCM2)>1e-6||part.rootBoundaryEdges<3||part.rootTriangles<1)throw Error('三维发束与源区面积不一致');}
 const ids=new Set();for(const part of contract.parts){const row=budget.patches.find(b=>b.id===part.id);if(!part.clumps?.length)throw Error('缺少有厚度和截面转向的子束');let area=0,count=0;for(const c of part.clumps){if(!c.id.startsWith(part.id+'/')||ids.has(c.id)||!Number.isFinite(c.sourceAreaCM2)||c.sourceAreaCM2<=0||!Number.isInteger(c.targetCount)||c.targetCount<0||!Number.isInteger(c.anchorRootId)||c.anchorRootId<0||c.anchorRootId>=3300||c.sections?.length!==65)throw Error('体积子束源区或数量无效');ids.add(c.id);area+=c.sourceAreaCM2;count+=c.targetCount;
   for(let i=0;i<c.sections.length;i++){const s=c.sections[i],axes=[s.tangent,s.widthAxis,s.thicknessAxis];if(s.u!==i/64||s.center?.length!==3||s.center.some(v=>!Number.isFinite(v))||axes.some(a=>a?.length!==3||a.some(v=>!Number.isFinite(v))||Math.abs(len(a)-1)>1e-6)||Math.abs(dot(axes[0],axes[1]))>1e-6||Math.abs(dot(axes[0],axes[2]))>1e-6||Math.abs(dot(axes[1],axes[2]))>1e-6||!Number.isFinite(s.twistRadians)||!Number.isFinite(s.halfWidth)||!Number.isFinite(s.halfThickness)||s.halfWidth<0||s.halfThickness<0||(s.u>.25&&s.u<.75&&(s.halfThickness<.0005||s.halfWidth<.001)))throw Error('发束截面不能退化为面片或翻转的坐标系 '+c.id+' '+i);}
  }if(Math.abs(area-part.sourceAreaCM2)>1e-6||count!==row.targetCount)throw Error('体积子束源区面积或数量不守恒');}
 return population;
}
export function splitClumps(patch,recipe){
 const rule=clumpRule(patch.id,recipe);if(!rule)return [{...patch,clumpId:patch.id+'/0'}];
 const width=(rule.max-rule.min)/rule.count,bank=Array.from({length:rule.count},(_,i)=>({id:patch.id,clumpId:patch.id+'/'+i,parent:patch.parent,area:0,cells:[],nodes:[],triangles:[],boundary:[],map:new Map(),edges:new Map()}));
 const cut=(poly,value,keep)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a.chartP[rule.axis]-value)*keep,db=(b.chartP[rule.axis]-value)*keep;if(da>=-1e-12)out.push(a);if(da*db<0){const t=da/(da-db);out.push({p:mix(a.p,b.p,t),b:mix(a.b,b.b,t),chartP:mix(a.chartP,b.chartP,t),edge:a.edge&&b.edge});}}return out;};
 for(const cell of patch.cells)for(let i=0;i<rule.count;i++){
  let poly=cut(cell.v,rule.edges[i],1);if(poly.length<3)continue;poly=cut(poly,rule.edges[i+1],-1);if(poly.length<3)continue;const chunk=bank[i];
  for(let j=1;j<poly.length-1;j++){const verts=[poly[0],poly[j],poly[j+1]],area=area3(...verts.map(v=>v.p));if(area<1e-14)continue;chunk.area+=area;chunk.cells.push({f:cell.f,v:verts,area,cdf:chunk.area});const ids=verts.map(v=>{const key=v.p.map(x=>Math.round(x*1e7)).join(',');let n=chunk.map.get(key);if(n===undefined){n=chunk.nodes.length;chunk.map.set(key,n);chunk.nodes.push({...v,f:cell.f});}return n;});chunk.triangles.push(...ids);for(let e=0;e<3;e++){const a=ids[e],b=ids[(e+1)%3],key=a<b?a+','+b:b+','+a,old=chunk.edges.get(key);if(old)old.count++;else chunk.edges.set(key,{a,b,count:1});}}
 }
 // The existing source patch already removed nonconforming interior edges.
 // New clump boundaries are exact intrinsic-surface clipping planes.
 const original=patch.boundary.map(([a,b])=>[patch.nodes[a],patch.nodes[b]]),onOriginal=(a,b)=>original.some(([u,v])=>{const d=sub(v.p,u.p),dd=dot(d,d);if(dd<1e-20)return false;return[a,b].every(w=>{const t=dot(sub(w.p,u.p),d)/dd;return t>=-1e-5&&t<=1+1e-5&&len(sub(w.p,add(u.p,mul(d,t))))<2e-7;});});
 for(let i=0;i<bank.length;i++){const chunk=bank[i],lo=rule.edges[i],hi=rule.edges[i+1];for(const e of chunk.edges.values())if(e.count===1){const a=chunk.nodes[e.a],b=chunk.nodes[e.b],onPlane=[lo,hi].some(v=>Math.abs(a.chartP[rule.axis]-v)<1e-9&&Math.abs(b.chartP[rule.axis]-v)<1e-9);if(onPlane||onOriginal(a,b))chunk.boundary.push([e.a,e.b]);}delete chunk.map;delete chunk.edges;}
 const active=bank.filter(c=>c.area>1e-12);if(active.some(c=>!c.boundary.length)||Math.abs(active.reduce((n,c)=>n+c.area,0)-patch.area)>1e-10)throw Error('子束源区裁分不完整');return active;
}
export function buildBundleVolumes(rootPatches,state,builder){
 const rows=64,parts=[],updatedGuides=new Map();builder.denseModels=[];
 for(const patch of rootPatches.patches){
  const subparts=[];
  for(const region of splitClumps(patch,state.recipe)){
  const all=state.curves.filter(c=>c.bundleId===patch.id),own=all.filter(c=>clumpOf(patch.id,builder.roots[c.rootId].chartP,state.recipe).id===region.clumpId),guides=own.length?own:all,nodes=region.nodes,model=createSweptClump(region,guides,state,builder),field=(nodeId,u)=>model.at(nodes[nodeId],u);
  builder.denseModels.push({region,model});
  for(const guide of own)updatedGuides.set(guide.rootId,guideThroughClump(guide,model,builder));
  const positions=[],triangles=[],sourceTriangles=[],anchors=[],progress=[],uv=[],index=new Map(),addNode=(id,row)=>{const key=id+':'+row;let i=index.get(key);if(i!==undefined)return i;i=positions.length/3;index.set(key,i);positions.push(...field(id,row/rows));anchors.push({triangle:nodes[id].f,barycentric:nodes[id].b.slice()});progress.push(row/rows);uv.push(nodes[id].chartP[0]*10,row/rows);return i;};
  // Actual scalp patch is the source cap. The end cap inherits the SAME
  // two-dimensional source topology; boundary faces connect their full flow.
  for(let f=0;f<region.triangles.length;f+=3){const[a,b,c]=region.triangles.slice(f,f+3),root=[addNode(c,0),addNode(b,0),addNode(a,0)];triangles.push(...root);sourceTriangles.push(...root);triangles.push(addNode(a,rows),addNode(b,rows),addNode(c,rows));}
  for(const[a,b]of region.boundary)for(let row=0;row<rows;row++){const a0=addNode(a,row),b0=addNode(b,row),a1=addNode(a,row+1),b1=addNode(b,row+1);triangles.push(a0,b0,a1,b0,b1,a1);}
  // Measure the displayed volume. Keep these inspection envelopes separate
  // from the immutable construction frames used by the actual root paths.
  for(const section of model.metadata.sections){const W=[],B=[];for(let i=0;i<progress.length;i++)if(Math.abs(progress[i]-section.u)<1e-10){const q=sub(positions.slice(i*3,i*3+3),section.center);W.push(dot(q,section.widthAxis));B.push(dot(q,section.thicknessAxis));}if(W.length){const w0=Math.min(...W),w1=Math.max(...W),b0=Math.min(...B),b1=Math.max(...B);section.center=add(section.center,add(mul(section.widthAxis,(w0+w1)*.5),mul(section.thicknessAxis,(b0+b1)*.5)));section.halfWidth=(w1-w0)*.5;section.halfThickness=(b1-b0)*.5;}}
  model.metadata.peakWidthMM=Math.max(...model.metadata.sections.map(s=>s.halfWidth))*2000;model.metadata.peakThicknessMM=Math.max(...model.metadata.sections.map(s=>s.halfThickness))*2000;
  subparts.push({positions,triangles,sourceTriangles,anchors,progress,uv,clumpId:region.clumpId,model:model.metadata,sourceAreaCM2:region.area*1e4,rootBoundaryEdges:region.boundary.length,rootVertices:nodes.length,rootTriangles:region.triangles.length/3});
  }
  const merged={positions:[],triangles:[],sourceTriangles:[],anchors:[],progress:[],uv:[],rootBoundaryEdges:0,rootVertices:0,rootTriangles:0},clumps=[];
  for(const child of subparts){const offset=merged.positions.length/3;for(const k of ['positions','anchors','progress','uv'])for(const v of child[k])merged[k].push(v);for(const k of ['triangles','sourceTriangles'])for(const v of child[k])merged[k].push(v+offset);for(const k of ['rootBoundaryEdges','rootVertices','rootTriangles'])merged[k]+=child[k];clumps.push({...child.model,vertexStart:offset,vertices:child.positions.length/3,triangleStart:merged.triangles.length-child.triangles.length,triangleCount:child.triangles.length,sourceTriangleStart:merged.sourceTriangles.length-child.sourceTriangles.length,sourceTriangleCount:child.sourceTriangles.length});}
  parts.push({id:patch.id,parent:patch.parent,color:BUNDLES.find(b=>b.id===patch.id).color,...merged,clumps,sourceAreaCM2:patch.area*1e4,rows,construction:'scalp source patch swept through its own guide field; fringe child source regions independently tapered'});
 }
 if(updatedGuides.size!==state.curves.length)throw Error('有导向未进入自己的体积子束');state.curves=state.curves.map(g=>updatedGuides.get(g.rootId));state.bundlePlan=buildBundlePlan(builder.roots,state.curves,state.recipe);
 return {schema:'kaopu/root-grown-bundle-volumes@3',coordinates:'head-aligned-Yup-Zfront; each vertex has native source binding',groups:PARENTS,parts,sourceAreaCM2:rootPatches.area*1e4,sourceAreaErrorCM2:rootPatches.areaErrorCM2,globalShellUsed:false,finiteWidthCollisionCertified:false,denseFollowersGenerated:false};
}
