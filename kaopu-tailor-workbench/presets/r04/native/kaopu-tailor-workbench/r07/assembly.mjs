// R07 temporary assembly operations; no changes to rest UV, body or source curves.
export function prepareAssembly(spec,body){
 const changes=[];
 for(const p of spec.panels){
  const b=p.placement.rigidBasis,t=p.placement.translationMm;
  if(Math.abs(b[2])+Math.abs(b[5])+Math.abs(b[6])+Math.abs(b[7])>1e-8)continue;
  const xy=p.uvMm.map(([u,v])=>[b[0]*u+b[1]*v+t[0],b[3]*u+b[4]*v+t[1]]),xs=xy.map(p=>p[0]),ys=xy.map(p=>p[1]);
  const xmin=Math.min(...xs)-20,xmax=Math.max(...xs)+20,ymin=Math.min(...ys)-20,ymax=Math.max(...ys)+20;
  const zs=body.positionsMm.filter(p=>p[0]>=xmin&&p[0]<=xmax&&p[1]>=ymin&&p[1]<=ymax).map(p=>p[2]);
  if(zs.length){const before=[...t];t[2]=p.source.bodySide==='back'?Math.min(...zs)-12:Math.max(...zs)+12;changes.push({panel:p.id,originalTranslationMm:before,assemblyTranslationMm:[...t]});}
 }
 for(const s of spec.seams)if(s.stageId==='waist'&&s.a.panelId.startsWith('wb_')&&s.b.panelId.startsWith('wb_'))s.stageId='sides';
 const order=['darts','centers','rises','legs','sleeve_tubes','waist','shoulders','armholes','sides','shell'].filter(id=>spec.seams.some(s=>s.stageId===id));
 spec.source.assemblyExperiment=order;spec.stages=[{id:'cut',requires:[],seams:[]},...order.map((id,i)=>({id,requires:[i?order[i-1]:'cut'],seams:spec.seams.filter(s=>s.stageId===id).map(s=>s.id)}))];
 spec.source.r07Preparation={rigidMoves:changes,restUVChanged:false,bodyGeometryChanged:false,method:'conservative front/back envelope of the exact body inside panel XY bounds; 12 mm initial offset; original analytic placement preserved in panel.source.originalPlacement'};
}
// A temporary seam-side inequality, NOT general self-collision or CCD.
// Released for the last 200 global relaxation sweeps and independently audited.
export function createSeamLayerGuide(lab){
 const guides=[];
 for(const seam of lab.spec.seams){
  if(!seam.numericalStitchPlan)continue;
  let A=seam.a,B=seam.b,pa=lab.spec.panels.find(p=>p.id===A.panelId),pb=lab.spec.panels.find(p=>p.id===B.panelId),pairs=seam.stitchVertexPairs;
  if(seam.sourceSeam.lengthAMm>seam.sourceSeam.lengthBMm){[A,B]=[B,A];[pa,pb]=[pb,pa];pairs=pairs.map(([a,b])=>[b,a]);}
  const be=B.reverse?[...pb.edges[B.edge]].reverse():pb.edges[B.edge],oa=lab.offsets.get(pa.id),ob=lab.offsets.get(pb.id);
  for(let i=0;i+1<pairs.length;i++){
   const [a0,b0]=pairs[i],[a1,b1]=pairs[i+1];const face=pa.triangles.find(t=>t.includes(a0)&&t.includes(a1));if(!face)continue;
   const inner=face.find(v=>v!==a0&&v!==a1),j0=be.indexOf(b0),j1=be.indexOf(b1);if(j0<0||j1<=j0)continue;
   for(let j=j0+1;j<j1;j++)guides.push({a:oa+a0,b:oa+a1,c:oa+inner,v:ob+be[j],f:(j-j0)/(j1-j0),boundary:true});
   const chosen=new Set();
   for(let j=j0;j<j1;j++)for(const t of pb.triangles)if(t.includes(be[j])&&t.includes(be[j+1])){const v=t.find(v=>v!==be[j]&&v!==be[j+1]);if(chosen.has(v)||pb.boundary.includes(v))continue;chosen.add(v);guides.push({a:oa+a0,b:oa+a1,c:oa+inner,v:ob+v,f:(j-j0+.5)/(j1-j0),boundary:false});}
  }
 }
 return {count:guides.length,project(){let corrected=0;const x=lab.positions,w=lab.invMass;
  for(const g of guides){const A=x[g.a],B=x[g.b],C=x[g.c],V=x[g.v],f=g.f;let tx=B[0]-A[0],ty=B[1]-A[1],tz=B[2]-A[2],l=tx*tx+ty*ty+tz*tz;if(l<1e-12)continue;
   const px=A[0]+f*tx,py=A[1]+f*ty,pz=A[2]+f*tz;let dx=C[0]-px,dy=C[1]-py,dz=C[2]-pz;const t=(dx*tx+dy*ty+dz*tz)/l;dx-=t*tx;dy-=t*ty;dz-=t*tz;l=Math.hypot(dx,dy,dz);if(l<1e-8)continue;dx/=l;dy/=l;dz/=l;
   const distance=(V[0]-px)*dx+(V[1]-py)*dy+(V[2]-pz)*dz+(g.boundary?.0003:.001);if(distance<=0)continue;
   const W=w[g.v]+w[g.a]*(1-f)**2+w[g.b]*f*f;if(W<1e-12)continue;const lambda=distance/W;
   for(const[id,s]of[[g.v,-w[g.v]],[g.a,w[g.a]*(1-f)],[g.b,w[g.b]*f]]){x[id][0]+=s*lambda*dx;x[id][1]+=s*lambda*dy;x[id][2]+=s*lambda*dz;}corrected++;
  }return corrected;
 }};
}
