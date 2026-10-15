// Source-seam inequalities and late seam closure. No hard-coded garment vertices.
// These operations retain each independent panel's original material UV and triangles.
export function refinementGuides(lab){
 const guides=[];const panels=new Map(lab.spec.panels.map(p=>[p.id,p]));
 for(const seam of lab.spec.seams){
  if(seam.isInternalReinforcement||seam.isFinishConstruction)continue;
  if(!seam.numericalStitchPlan)continue;
  let A=seam.a,B=seam.b,pa=panels.get(A.panelId),pb=panels.get(B.panelId),pairs=seam.stitchVertexPairs;
  if(seam.sourceSeam.lengthAMm>seam.sourceSeam.lengthBMm){[A,B]=[B,A];[pa,pb]=[pb,pa];pairs=pairs.map(([a,b])=>[b,a]);}
  const edge=B.reverse?[...pb.edges[B.edge]].reverse():pb.edges[B.edge],oa=lab.offsets.get(pa.id),ob=lab.offsets.get(pb.id);
  for(let i=0;i+1<pairs.length;i++){
   const[a0,b0]=pairs[i],[a1,b1]=pairs[i+1],face=pa.triangles.find(t=>t.includes(a0)&&t.includes(a1));if(!face)continue;
   const inner=_finishInner(pa,a0,a1,face.find(v=>v!==a0&&v!==a1)),j0=edge.indexOf(b0),j1=edge.indexOf(b1);if(j0<0||j1<=j0)throw Error('REFINE_SEAM_ORDER: invalid original gathering order');
   const push=(id,margin)=>guides.push({ids:[oa+a0,oa+a1,oa+inner,ob+id],margin});
   for(let j=j0+1;j<j1;j++)push(edge[j],.0003);
   const chosen=new Set();
   for(let j=j0;j<j1;j++)for(const t of pb.triangles)if((!pb.reinforcementCut||t.every(i=>i<pb.reinforcementCut.originalMaterialVertexCount))&&t.includes(edge[j])&&t.includes(edge[j+1])){
    const v=_finishInner(pb,edge[j],edge[j+1],t.find(v=>v!==edge[j]&&v!==edge[j+1]));if(chosen.has(v)||(pb.reinforcementCut?.netBoundaryMaterialIds||pb.boundary).includes(v))continue;chosen.add(v);push(v,.001);
   }
  }
 }
 return guides;
}
export function beginJointRefinement(lab){
 const rows=refinementGuides(lab),capacity=lab.strainTriangles.length*3;if(rows.length>capacity)throw Error('REFINE_GUIDE_CAPACITY: no omitted constraints');
 const ids=new Int32Array(lab.kernel.memory.buffer,lab.ptr.qgi,capacity*4),margins=new Float64Array(lab.kernel.memory.buffer,lab.ptr.qgm,capacity);
 rows.forEach((g,i)=>{ids.set(g.ids,i*4);margins[i]=g.margin;});
 lab.kernel.qnInit(lab.ptr.qn,lab.ptr.qgi,lab.ptr.qgm,rows.length,lab.constraints.length);
 if(lab.kernel.qnStatus()<0)throw Error('REFINE_INITIAL_STATE: invalid material, body domain or seam frame');
 return {sourceGuides:rows.length,startEnergy:lab.kernel.qnInitialEnergy(),objective:'original-UV principal-stretch penalties + exact body-SDF derivative + original stitches + local gathering-side inequalities',geometricTarget:[.88,1.12],fabricCalibration:false,continuousCollision:false};
}
export function finalizeCloseSeams(lab,{maximumGapMm=.2}={}){
 // R07's old geometric stage did not synchronize stitches after the physical stage.
 // Only finish source-declared stitches that genuinely approached one another.
 const groups=lab.stitchGroups;let count=0,max=0;
 for(const c of lab.seamConstraints){
  if(c.eliminated||lab.elapsed-c.activatedAt<c.rampDuration)continue;
  const a=groups.find(c.a),b=groups.find(c.b);if(a===b){c.eliminated=true;continue;}
  const gap=Math.hypot(...lab.positions[a].map((v,k)=>v-lab.positions[b][k]))*1000;
  if(!Number.isFinite(gap))throw Error('REFINE_NONFINITE_SEAM');
  if(gap>maximumGapMm)continue;
  groups.parent[Math.max(a,b)]=Math.min(a,b);c.eliminated=true;groups.equalities++;count++;max=Math.max(max,gap);
 }
 if(count){groups.rebuild();lab.syncConstraints();lab.kernel.prepare(1/720,lab.elapsed);}
 return {sourcePairsClosed:count,maximumClosureDisplacementMm:max,maximumAllowedGapMm:maximumGapMm,restUVChanged:false,trianglesDeleted:0};
}
export function jointReport(lab,info){return {...info,iterations:lab.kernel.qnIterations(),initialEnergy:lab.kernel.qnInitialEnergy(),finalEnergy:lab.kernel.qnEnergy(),gradientNorm:lab.kernel.qnGradNorm(),lineSearchBacktracks:lab.kernel.qnBacktracks(),stop:lab.kernel.qnStatus()===1?'gradient-tolerance':lab.kernel.qnStatus()===2?'line-search-stalled':'iteration-budget',momentumConservingDynamics:false};}

// A narrow folded seam needs a net-cloth orientation reference beyond its fold,
// otherwise the old half-space rule fights the newly sewn second row.
function _finishInner(p,a,b,near){
 if(p.reinforcementCut?.schema!=='interior-narrow-fold-cut@1')return near;
 const A=p.uvMm[a],B=p.uvMm[b],C=p.uvMm[near],dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy),side=Math.sign(dx*(C[1]-A[1])-dy*(C[0]-A[0])),mid=[(A[0]+B[0])/2,(A[1]+B[1])/2];let best=near,score=Infinity;
 for(let i=0;i<p.uvMm.length;i++){const q=p.uvMm[i],height=(dx*(q[1]-A[1])-dy*(q[0]-A[0]))/L*side;if(height<5)continue;const d=(q[0]-mid[0])**2+(q[1]-mid[1])**2;if(d<score){score=d;best=i}}
 return best;
}
