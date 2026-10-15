import {compatibleSeamClearance} from '../../seam-clearance-r0432.mjs';
/** Extend original seam-side inequalities to ordinary native joins.
 * Existing sparse gathering guides and all acceptance constants remain.
 * These are static construction-orientation constraints, NOT general self contact.
 */
import {refinementGuides,beginJointRefinement as originalBegin} from '../../native/kaopu-tailor-workbench/r07/stability/refinement.mjs';
export function beginMaterialRefinement(lab){
 if(!lab.pipeline43)return originalBegin(lab);
 const base=refinementGuides(lab),clearance=lab.sideClearance43d?compatibleSeamClearance(lab,base):null;
 if(clearance)lab.seamSideClearance43d=clearance.report;
 const rows=clearance?clearance.rows:base,keys=new Set(rows.map(g=>g.ids.join(','))),panels=new Map(lab.spec.panels.map(p=>[p.id,p]));let additional=0;
 for(const seam of lab.spec.seams){
  if(seam.isInternalReinforcement||seam.isFinishConstruction)continue;
  if(seam.sourceSeam?.isDart||seam.a.panelId===seam.b.panelId)continue;
  let A=seam.a,B=seam.b,pairs=seam.stitchVertexPairs;
  if(!A.panelId.startsWith('wb_')){[A,B]=[B,A];pairs=pairs.map(([a,b])=>[b,a]);}
  const pa=panels.get(A.panelId),pb=panels.get(B.panelId),oa=lab.offsets.get(pa.id),ob=lab.offsets.get(pb.id),be=B.reverse?[...pb.edges[B.edge]].reverse():pb.edges[B.edge];
  for(let j=0;j<pairs.length-1;j++){const[a0,b0]=pairs[j],[a1,b1]=pairs[j+1],aFace=pa.triangles.find(t=>t.includes(a0)&&t.includes(a1));if(!aFace)continue;const innerA=_finishInner(pa,a0,a1,aFace.find(i=>i!==a0&&i!==a1)),k0=be.indexOf(b0),k1=be.indexOf(b1);if(k0<0||k1<=k0)throw Error('NATIVE_SEAM_ORDER_INVALID');
   for(let k=k0;k<k1;k++){const bFace=pb.triangles.find(t=>t.includes(be[k])&&t.includes(be[k+1]));if(!bFace)continue;const innerB=_finishInner(pb,be[k],be[k+1],bFace.find(i=>i!==be[k]&&i!==be[k+1]));const ids=[oa+a0,oa+a1,oa+innerA,ob+innerB],key=ids.join(',');if(!keys.has(key)){rows.push({ids,margin:.001});keys.add(key);additional++;}}
  }
 }
 const capacity=lab.strainTriangles.length*3;if(rows.length>capacity)throw Error('REFINE_GUIDE_CAPACITY');const ids=new Int32Array(lab.kernel.memory.buffer,lab.ptr.qgi,capacity*4),margins=new Float64Array(lab.kernel.memory.buffer,lab.ptr.qgm,capacity);rows.forEach((g,i)=>{ids.set(g.ids,i*4);margins[i]=g.margin});lab.kernel.qnInit(lab.ptr.qn,lab.ptr.qgi,lab.ptr.qgm,rows.length,lab.constraints.length);if(lab.kernel.qnStatus()<0)throw Error('REFINE_INITIAL_STATE: invalid material, body domain or seam frame');
 return{sourceGuides:rows.length,additionalNativeSeamFrames:additional,startEnergy:lab.kernel.qnInitialEnergy(),objective:'original material stretch, exact body field, stitches, source seam-side inequalities and explicit panel-hinge bending',geometricTarget:[.88,1.12],fabricCalibration:false,continuousCollision:false};
}

// A narrow folded seam needs a net-cloth orientation reference beyond its fold,
// otherwise the old half-space rule fights the newly sewn second row.
function _finishInner(p,a,b,near){
 if(p.reinforcementCut?.schema!=='interior-narrow-fold-cut@1')return near;
 const A=p.uvMm[a],B=p.uvMm[b],C=p.uvMm[near],dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy),side=Math.sign(dx*(C[1]-A[1])-dy*(C[0]-A[0])),mid=[(A[0]+B[0])/2,(A[1]+B[1])/2];let best=near,score=Infinity;
 for(let i=0;i<p.uvMm.length;i++){const q=p.uvMm[i],height=(dx*(q[1]-A[1])-dy*(q[0]-A[0]))/L*side;if(height<5)continue;const d=(q[0]-mid[0])**2+(q[1]-mid[1])**2;if(d<score){score=d;best=i}}
 return best;
}
