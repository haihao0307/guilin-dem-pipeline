import {BUNDLES,PARENTS,parentOf,bundleOf} from './BundlePlan.mjs';
import {bobProfile} from './PortraitBob.mjs';
import {add,sub,mul,mix,len,cross,dot,unit,smooth,clamp} from './approved/LegacyFoundation.mjs';
import {point} from './NativeSurface.mjs';
const area3=(a,b,c)=>len(cross(sub(b,a),sub(c,a)))*.5;
const centroid=a=>a.reduce((p,v)=>add(p,mul(v,1/a.length)),[0,0,0]);
// All clipping happens on the APPROVED SCALP, before hair geometry exists.
// A root patch, not a face on a pre-existing shell, owns each full volume.
export function splitRootPatches(scalp,recipe){
 const part=recipe.partMM*.001,planes=[[0,part-.063],[0,part-.003],[0,part],[0,part+.006],[2,.077],[2,.100],[1,.378],[2,.065],[2,-.027],[1,.336],[1,.390],[1,.335],[1,.318]];
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
export function validatePopulation(population,contract){
 const budget=population?.budget,patches=population?.rootPatches;
 if(budget?.schema!=='kaopu/hair-population-budget@1'||!Number.isFinite(budget.densityPerCM2)||budget.densityPerCM2<80||budget.densityPerCM2>260||patches?.length!==BUNDLES.length||new Set(patches.map(p=>p.id)).size!==BUNDLES.length||budget.patches?.length!==BUNDLES.length||budget.groups?.length!==PARENTS.length)throw Error('发束数量与源区契约无效');
 let area=0,count=0;for(const patch of patches){const spec=BUNDLES.find(b=>b.id===patch.id),row=budget.patches.find(b=>b.id===patch.id);if(!spec||patch.parent!==parentOf(patch.id)||!row||row.parent!==patch.parent||!Number.isFinite(patch.area)||patch.area<=0||!Number.isInteger(row.targetCount)||row.targetCount<0||!Array.isArray(patch.cells)||!patch.cells.length)throw Error('源区或数量无效');let sum=0;for(const c of patch.cells){if(!Number.isInteger(c.f)||c.f<0||c.f>=50624||!Number.isFinite(c.area)||c.area<=0||c.v?.length!==3)throw Error('源区三角面无效');for(const v of c.v)if(v.b?.length!==3||v.b.some(x=>!Number.isFinite(x)||x< -1e-8||x>1+1e-8)||Math.abs(v.b.reduce((n,x)=>n+x,0)-1)>1e-8)throw Error('源区重心坐标无效');sum+=c.area;if(Math.abs(sum-c.cdf)>1e-9)throw Error('源区面积分布不连续');}if(Math.abs(sum-patch.area)>1e-9||Math.abs(row.areaCM2-patch.area*1e4)>1e-6||Math.abs(row.targetCount-row.areaCM2*budget.densityPerCM2)>1)throw Error('源区面积或数量不一致');area+=patch.area;count+=row.targetCount;}
 if(Math.abs(area*1e4-budget.totalAreaCM2)>1e-6||count!==budget.totalTarget||count!==Math.round(area*1e4*budget.densityPerCM2))throw Error('发束总面积或总数量不一致');
 for(const group of budget.groups){const rows=budget.patches.filter(p=>p.parent===group.id);if(!PARENTS.some(p=>p.id===group.id)||group.targetCount!==rows.reduce((n,r)=>n+r.targetCount,0)||Math.abs(group.areaCM2-rows.reduce((n,r)=>n+r.areaCM2,0))>1e-6)throw Error('发束层组数量不一致');}
 if(contract?.schema!=='kaopu/root-grown-bundle-volumes@1'||contract.globalShellUsed!==false||contract.parts?.length!==BUNDLES.length||contract.groups?.length!==PARENTS.length)throw Error('缺少独立根区生成的三维体量');for(const part of contract.parts){const row=budget.patches.find(b=>b.id===part.id);if(!row||row.parent!==part.parent||Math.abs(row.areaCM2-part.sourceAreaCM2)>1e-6||part.rootBoundaryEdges<3||part.rootTriangles<1)throw Error('三维发束与源区面积不一致');}
 return population;
}
function sampleCurve(c,u){const n=c.points.length/3-1,x=u*n,i=Math.min(n-1,Math.floor(x));return mix(c.points.slice(i*3,i*3+3),c.points.slice((i+1)*3,(i+1)*3+3),x-i);}
export function buildBundleVolumes(rootPatches,state,builder){
 const rows=24,parts=[];
 for(const patch of rootPatches.patches){
  const guides=state.curves.filter(c=>c.bundleId===patch.id),nodes=patch.nodes,paths=[];
  for(const node of nodes){const nearest=guides.map(c=>({c,d:len(sub(node.chartP,builder.roots[c.rootId].chartP))})).sort((a,b)=>a.d-b.d).slice(0,3),sum=nearest.reduce((n,g)=>n+1/Math.max(.0008,g.d)**2,0);for(const g of nearest)g.w=1/Math.max(.0008,g.d)**2/sum;const root=nearest.reduce((p,g)=>add(p,mul(g.c.points.slice(0,3),g.w)),[0,0,0]),target=nearest.reduce((p,g)=>add(p,mul(g.c.styleProfile.target,g.w)),[0,0,0]),waypoint=nearest.reduce((p,g)=>add(p,mul(g.c.styleProfile.waypoint,g.w)),[0,0,0]),profile=bobProfile({id:0,bundleId:patch.id,p:node.p,chartP:node.chartP},state.recipe,builder.bvh);paths.push({nearest,rootDelta:sub(node.p,root),tipDelta:sub(profile.target,target),midDelta:sub(profile.waypoint,waypoint)});}
  const field=(nodeId,u)=>{
   const data=paths[nodeId];if(u===0)return nodes[nodeId].p.slice();let p=data.nearest.reduce((p,g)=>add(p,mul(sampleCurve(g.c,u),g.w)),[0,0,0]);p=add(p,mul(data.rootDelta,1-smooth(u/.22)));p=add(p,mul(data.tipDelta,smooth((u-.15)/.65)));p=add(p,mul(data.midDelta,Math.sin(Math.PI*u)*.55));
   if(u>.025){const h=builder.bvh.nearest(p),n=unit(point(builder.head,h.t,h.b,builder.normals)),signed=dot(sub(p,h.p),n);if(signed<.001)p=add(p,mul(n,.001-signed));}return p;
  };
  const positions=[],triangles=[],anchors=[],progress=[],uv=[],index=new Map(),addNode=(id,row)=>{const key=id+':'+row;let i=index.get(key);if(i!==undefined)return i;i=positions.length/3;index.set(key,i);positions.push(...field(id,row/rows));anchors.push({triangle:nodes[id].f,barycentric:nodes[id].b.slice()});progress.push(row/rows);uv.push(nodes[id].chartP[0]*10,row/rows);return i;};
  // Actual scalp patch is the source cap. The end cap inherits the SAME
  // two-dimensional source topology; boundary faces connect their full flow.
  for(let f=0;f<patch.triangles.length;f+=3){const[a,b,c]=patch.triangles.slice(f,f+3);triangles.push(addNode(c,0),addNode(b,0),addNode(a,0));triangles.push(addNode(a,rows),addNode(b,rows),addNode(c,rows));}
  for(const[a,b]of patch.boundary)for(let row=0;row<rows;row++){const a0=addNode(a,row),b0=addNode(b,row),a1=addNode(a,row+1),b1=addNode(b,row+1);triangles.push(a0,b0,a1,b0,b1,a1);}
  parts.push({id:patch.id,parent:patch.parent,color:BUNDLES.find(b=>b.id===patch.id).color,positions,triangles,anchors,progress,uv,sourceAreaCM2:patch.area*1e4,rootBoundaryEdges:patch.boundary.length,rootVertices:nodes.length,rootTriangles:patch.triangles.length/3,rows,construction:'scalp source patch swept through its own guide field; individual root frames'});
 }
 return {schema:'kaopu/root-grown-bundle-volumes@1',coordinates:'head-aligned-Yup-Zfront; each vertex has native source binding',groups:PARENTS,parts,sourceAreaCM2:rootPatches.area*1e4,sourceAreaErrorCM2:rootPatches.areaErrorCM2,globalShellUsed:false,finiteWidthCollisionCertified:false,denseFollowersGenerated:false};
}
