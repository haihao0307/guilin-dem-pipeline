/* Browser QA expression. Source descriptors are queried, never triangulated. */
() => {
 const app=window.__IMPLICIT_BUILDING__,spec=app.spec();
 if(spec.fieldKind!=='measured-surface')throw Error('Source stress requires the unchanged measured case');
 const rays=[],categories={},f32=v=>v.map(Math.fround),add=(a,b)=>a.map((v,i)=>v+b[i]),scale=(a,s)=>a.map(v=>v*s),unit=a=>scale(a,1/Math.hypot(...a));
 const point=(p,uv)=>add(p.origin,add(scale(p.u,uv[0]),scale(p.v,uv[1])));
 function push(p,uv,kind,grazing=false){const target=point(p,uv),delta=grazing?add(scale(p.u,.5),scale(p.n,.01)):scale(p.n,.4);rays.push({origin:f32(add(target,delta)),direction:f32(unit(scale(delta,-1))),kind,patchId:p.sourcePatchId});categories[kind]=(categories[kind]??0)+1;}
 for(const p of spec.patches){
  const outer=p.loops[0],center=outer.reduce((a,q)=>[a[0]+q[0]/outer.length,a[1]+q[1]/outer.length],[0,0]);
  push(p,center,'patch-front');push(p,center,'tilted-near-parallel',true);
  for(let l=0;l<p.loops.length;l++)for(let j=0;j<p.loops[l].length;j++){
   const ring=p.loops[l],a=ring[j],b=ring[(j+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<.01)continue;
   const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],off=[-dy/len*.002,dx/len*.002];
   for(const side of [-1,1])push(p,[mid[0]+side*off[0],mid[1]+side*off[1]],l?'hole-edge-offset':'outer-edge-offset');
  }
  for(const ring of p.loops.slice(1)){const c=ring.reduce((a,q)=>[a[0]+q[0]/ring.length,a[1]+q[1]/ring.length],[0,0]);push(p,c,'hole-through');}
 }
 let mismatches=0,maxTErrorM=0;const examples=[];
 for(let first=0;first<rays.length;first+=128){const batch=rays.slice(first,first+128),gpu=app.probe(batch.map(r=>r.origin),4,batch.map(r=>r.direction));for(let i=0;i<batch.length;i++){
  const r=batch[i],cpu=app.intersectRay(r.origin,r.direction),actual=gpu[i],status=cpu.hit?1:2,e=cpu.hit?Math.abs(cpu.t-actual[0]):0,tolerance=r.kind==='tilted-near-parallel'?.001:.0005;maxTErrorM=Math.max(maxTErrorM,e);
  if(status!==Math.round(actual[2])||e>tolerance||(cpu.hit&&cpu.objectId!==Math.round(actual[1]))){mismatches++;if(examples.length<24)examples.push({ray:first+i,...r,cpu,gpu:actual,toleranceM:tolerance});}
 }}
 return {samples:rays.length,categories,maxTErrorM,mismatches,examples,passed:mismatches===0,scope:'All source patches, each nondegenerate outer/hole edge offset by2mm, hole-through and1:50 tilted rays; sampled evidence, not a universal numerical bound',limits:{ordinaryDepthM:.0005,tiltedDepthM:.001,edgeOffsetM:.002,normalToTangentRatio:.02}};
}
