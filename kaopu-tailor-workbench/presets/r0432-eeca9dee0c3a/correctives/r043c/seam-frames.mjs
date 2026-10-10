import {closeLightEaseSpans} from './seam-spans.mjs';
import {beginMaterialRefinement as beginB} from '../r043b/seam-frames.mjs';
/** Extend original seam-side inequalities to ordinary native joins.
 * Existing sparse gathering guides and all acceptance constants remain.
 * These are static construction-orientation constraints, NOT general self contact.
 */
import {refinementGuides,beginJointRefinement as originalBegin} from '../../native/kaopu-tailor-workbench/r07/stability/refinement.mjs';
export function beginMaterialRefinement(lab){
 if(!lab.spanCorrected43)return beginB(lab);
 const extended=closeLightEaseSpans(lab,refinementGuides(lab));lab.seamSpanReport43c=extended.report;const rows=extended.rows,keys=new Set(rows.map(g=>g.ids.join(','))),panels=new Map(lab.spec.panels.map(p=>[p.id,p]));let additional=0;
 for(const seam of lab.spec.seams){
  if(seam.sourceSeam?.isDart||seam.a.panelId===seam.b.panelId)continue;
  let A=seam.a,B=seam.b,pairs=seam.stitchVertexPairs;
  if(!A.panelId.startsWith('wb_')){[A,B]=[B,A];pairs=pairs.map(([a,b])=>[b,a]);}
  const pa=panels.get(A.panelId),pb=panels.get(B.panelId),oa=lab.offsets.get(pa.id),ob=lab.offsets.get(pb.id),be=B.reverse?[...pb.edges[B.edge]].reverse():pb.edges[B.edge];
  for(let j=0;j<pairs.length-1;j++){const[a0,b0]=pairs[j],[a1,b1]=pairs[j+1],aFace=pa.triangles.find(t=>t.includes(a0)&&t.includes(a1));if(!aFace)continue;const innerA=aFace.find(i=>i!==a0&&i!==a1),k0=be.indexOf(b0),k1=be.indexOf(b1);if(k0<0||k1<=k0)throw Error('NATIVE_SEAM_ORDER_INVALID');
   for(let k=k0;k<k1;k++){const bFace=pb.triangles.find(t=>t.includes(be[k])&&t.includes(be[k+1]));if(!bFace)continue;const innerB=bFace.find(i=>i!==be[k]&&i!==be[k+1]);const ids=[oa+a0,oa+a1,oa+innerA,ob+innerB],key=ids.join(',');if(!keys.has(key)){rows.push({ids,margin:.001});keys.add(key);additional++;}}
  }
 }
 const capacity=lab.strainTriangles.length*3;if(rows.length>capacity)throw Error('REFINE_GUIDE_CAPACITY');const ids=new Int32Array(lab.kernel.memory.buffer,lab.ptr.qgi,capacity*4),margins=new Float64Array(lab.kernel.memory.buffer,lab.ptr.qgm,capacity);rows.forEach((g,i)=>{ids.set(g.ids,i*4);margins[i]=g.margin});lab.kernel.qnInit(lab.ptr.qn,lab.ptr.qgi,lab.ptr.qgm,rows.length,lab.constraints.length);if(lab.kernel.qnStatus()<0)throw Error('REFINE_INITIAL_STATE: invalid material, body domain or seam frame');
 return{sourceGuides:rows.length,additionalNativeSeamFrames:additional,continuousSeamSpans:extended.report,startEnergy:lab.kernel.qnInitialEnergy(),objective:'original material stretch, exact body field, stitches, source seam-side inequalities and explicit panel-hinge bending',geometricTarget:[.88,1.12],fabricCalibration:false,continuousCollision:false};
}
