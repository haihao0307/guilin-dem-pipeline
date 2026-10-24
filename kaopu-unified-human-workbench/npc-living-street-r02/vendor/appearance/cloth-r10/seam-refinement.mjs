import {materialHash,sha,stable} from './source-contract.mjs';

const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const area=panel=>panel.triangles.reduce((sum,t)=>{const[a,b,c]=t.map(i=>panel.uvMm[i]);return sum+Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))*.5;},0);
const edgeLength=(panel,ids)=>ids.slice(1).reduce((sum,id,j)=>sum+distance(panel.uvMm[ids[j]],panel.uvMm[id]),0);

export function sewnEdgeGapAudit(packet,positions){
 const panels=new Map();let offset=0;
 for(const panel of packet.spec.panels){panels.set(panel.id,{panel,offset});offset+=panel.uvMm.length;}
 const active=new Set(packet.record.activeSeams);let pairedMaxMM=0,spanMaxMM=0,unpaired=0;
 const point=i=>[positions[i*3],positions[i*3+1],positions[i*3+2]];
 const pointSegment=(p,a,b)=>{const e=b.map((x,j)=>x-a[j]),l=e.reduce((s,x)=>s+x*x,0),t=Math.max(0,Math.min(1,e.reduce((s,x,j)=>s+x*(p[j]-a[j]),0)/(l||1)));return distance(p,a.map((x,j)=>x+t*e[j]))*1000;};
 for(const seam of packet.spec.seams){
  if(!active.has(seam.id))continue;const A=panels.get(seam.a.panelId),B=panels.get(seam.b.panelId);
  for(const[a,b]of seam.stitchVertexPairs)pairedMaxMM=Math.max(pairedMaxMM,distance(point(A.offset+a),point(B.offset+b))*1000);
  for(const side of[0,1]){const from=side?B:A,to=side?A:B,edge=from.panel.edges[seam[side?'b':'a'].edge],anchors=seam.stitchVertexPairs.map(p=>({at:edge.indexOf(p[side]),id:p[1-side]})).sort((a,b)=>a.at-b.at),paired=new Set(seam.stitchVertexPairs.map(p=>p[side]));
   for(let j=1;j<edge.length-1;j++)if(!paired.has(edge[j])){unpaired++;const k=anchors.findIndex(a=>a.at>j);if(k<1)throw Error('UNBOUNDED_SEAM_SITE');spanMaxMM=Math.max(spanMaxMM,pointSegment(point(from.offset+edge[j]),point(to.offset+anchors[k-1].id),point(to.offset+anchors[k].id)));}
  }
 }
 return{pairedMaxMM,continuousSpanMaxMM:Math.max(pairedMaxMM,spanMaxMM),unpairedBoundaryVertices:unpaired,method:'all existing stitch equalities plus every intermediate material-edge vertex against its declared opposite stitch span'};
}

export function unmatchedSewnSites(packet){
 const active=new Set(packet.record.activeSeams),panels=new Map(packet.spec.panels.map(p=>[p.id,p]));
 return packet.spec.seams.filter(s=>active.has(s.id)).flatMap(s=>['a','b'].map((side,k)=>{
  const panel=panels.get(s[side].panelId),edge=panel?.edges?.[s[side].edge];
  if(!edge)throw Error('SEAM_EDGE_MISSING '+s.id);
  const paired=new Set((s.stitchVertexPairs||[]).map(pair=>pair[k]));
  return {seam:s.id,side,panel:panel.id,edge:s[side].edge,unmatched:edge.filter(i=>!paired.has(i))};
 })).filter(row=>row.unmatched.length);
}

function splitEdge(panel,positions,sourceUV,a,b,t,proof){
 if(t<1e-9)return a;if(t>1-1e-9)return b;
 const index=panel.uvMm.length;
 const mix=points=>points[a].map((v,k)=>v*(1-t)+points[b][k]*t);
 panel.uvMm.push(mix(panel.uvMm));positions.push(mix(positions));if(sourceUV)sourceUV.push(mix(sourceUV));
 let split=0;
 for(let f=0;f<panel.triangles.length;f++){
  const tri=panel.triangles[f];let edge=-1;
  for(let k=0;k<3;k++)if((tri[k]===a&&tri[(k+1)%3]===b)||(tri[k]===b&&tri[(k+1)%3]===a)){edge=k;break;}
  if(edge<0)continue;
  const i=tri[edge],j=tri[(edge+1)%3],c=tri[(edge+2)%3];
  panel.triangles.splice(f,1,[i,index,c],[index,j,c]);
  proof.push({panel:panel.id,newVertex:index,parentEdge:[a,b],parameter:t,parentTriangle:tri});split++;f++;
 }
 if(split!==1)throw Error('SEAM_REFINEMENT_NOT_SINGLE_BOUNDARY '+panel.id+' '+a+'/'+b+' '+split);
 for(const ids of[panel.boundary,...Object.values(panel.edges)])for(let k=0;k<ids.length-1;k++)if((ids[k]===a&&ids[k+1]===b)||(ids[k]===b&&ids[k+1]===a)){ids.splice(k+1,0,index);k++;}
 const boundary=panel.boundary;if((boundary.at(-1)===a&&boundary[0]===b)||(boundary.at(-1)===b&&boundary[0]===a))boundary.push(index);
 return index;
}

/** Common refinement of the EXISTING sewn edges. No new cloth patch or change
 * to a paper contour: split a boundary triangle at its original material edge,
 * then add that material site to the declared seam equality. The old sparse
 * 1.1-ease side/hip seams left 34 unpaired vertices on each fine edge. */
export async function refineSewnBoundaries(source){
 const packet=structuredClone(source),before=unmatchedSewnSites(packet);
 if(!before.length)return packet;
 const panels=packet.spec.panels,byId=new Map(panels.map((p,i)=>[p.id,{panel:p,index:i}]));
 let offset=0;const positions=panels.map(p=>{const row=packet.record.positionsMm.slice(offset,offset+p.uvMm.length);offset+=p.uvMm.length;return row;});
 const original=panels.map(p=>({id:p.id,areaMM2:area(p),edges:Object.fromEntries(Object.entries(p.edges).map(([id,ids])=>[id,edgeLength(p,ids)])),vertices:p.uvMm.length,triangles:p.triangles.length}));
 const sourceUV=packet.sourceTemplate?.panelsUV,refined=[],seams=[];
 for(const seamId of [...new Set(before.map(x=>x.seam))]){
  const seam=packet.spec.seams.find(s=>s.id===seamId),oldPairs=seam.stitchVertexPairs.map(p=>p.slice());
  const A=byId.get(seam.a.panelId),B=byId.get(seam.b.panelId),aEdge=A.panel.edges[seam.a.edge];
  const direction=Math.sign(aEdge.indexOf(oldPairs.at(-1)[0])-aEdge.indexOf(oldPairs[0][0]));
  if(!direction)throw Error('SEAM_ANCHORS_NOT_ORDERED '+seam.id);
  for(const fromSide of['a','b']){
   const fk=fromSide==='a'?0:1,tk=1-fk,F=byId.get(seam[fromSide].panelId),T=byId.get(seam[fromSide==='a'?'b':'a'].panelId),fromEdge=F.panel.edges[seam[fromSide].edge],toEdge=T.panel.edges[seam[fromSide==='a'?'b':'a'].edge];
   const anchors=seam.stitchVertexPairs.map(pair=>({at:fromEdge.indexOf(pair[fk]),to:pair[tk]})).sort((a,b)=>a.at-b.at);
   if(anchors[0].at!==0||anchors.at(-1).at!==fromEdge.length-1||anchors.some(a=>a.at<0))throw Error('SEAM_ANCHORS_DO_NOT_COVER_EDGE '+seam.id);
   const paired=new Set(seam.stitchVertexPairs.map(p=>p[fk]));
   for(let k=1;k<fromEdge.length-1;k++){
    const id=fromEdge[k];if(paired.has(id))continue;
    const right=anchors.findIndex(a=>a.at>k),left=right-1;if(left<0||right<0)throw Error('SEAM_SITE_OUTSIDE_ANCHORS');
    const lo=anchors[left],hi=anchors[right],span=fromEdge.slice(lo.at,hi.at+1),fraction=edgeLength(F.panel,fromEdge.slice(lo.at,k+1))/edgeLength(F.panel,span);
    let a=toEdge.indexOf(lo.to),b=toEdge.indexOf(hi.to);if(a<0||b<0||a===b)throw Error('SEAM_TARGET_ANCHOR_MISSING '+seam.id);
    const step=Math.sign(b-a),route=[];for(let j=a;;j+=step){route.push(toEdge[j]);if(j===b)break;}
    const target=edgeLength(T.panel,route)*fraction;let travelled=0,newId=-1;
    for(let j=1;j<route.length;j++){const length=distance(T.panel.uvMm[route[j-1]],T.panel.uvMm[route[j]]);if(target<=travelled+length+1e-8){newId=splitEdge(T.panel,positions[T.index],sourceUV?.[T.index],route[j-1],route[j],(target-travelled)/length,refined);break;}travelled+=length;}
    if(newId<0)throw Error('SEAM_REFINEMENT_TARGET_NOT_FOUND');
    seam.stitchVertexPairs.push(fk===0?[id,newId]:[newId,id]);
   }
  }
  seam.stitchVertexPairs.sort((x,y)=>direction*(A.panel.edges[seam.a.edge].indexOf(x[0])-A.panel.edges[seam.a.edge].indexOf(y[0])));
  seams.push({id:seam.id,sourcePairs:oldPairs.length,refinedPairs:seam.stitchVertexPairs.length,sourceLengthRatio:seam.sourceSeam?.lengthRatioAOverB??null});
 }
 for(let i=0;i<panels.length;i++){
  const panel=panels[i],prior=original[i];if(Math.abs(area(panel)-prior.areaMM2)>1e-6)throw Error('SEAM_REFINEMENT_CHANGED_MATERIAL_AREA '+panel.id);
  for(const[id,length]of Object.entries(prior.edges))if(Math.abs(edgeLength(panel,panel.edges[id])-length)>1e-7)throw Error('SEAM_REFINEMENT_CHANGED_EDGE_LENGTH '+panel.id+'/'+id);
 }
 packet.record.positionsMm=positions.flat();
 const invalidated=['materialToSolverGroup','nativeBinding','wholeSeamAudit','jointRefinement'];for(const key of invalidated)delete packet.record[key];
 packet.record.staticGate={passed:false,reason:'Common seam refinement requires the current live fitting and continuous-edge audit; original static acceptance is retained only in the source packet'};
 packet.record.meshRefinement={schema:'kaopu/sewn-edge-common-refinement@1',parentRecipeHash:source.binding.recipeHash,original,inserted:refined,seams,unmatchedBefore:before,unmatchedAfter:unmatchedSewnSites(packet),invalidatedDependencies:invalidated,paperContoursChanged:false,materialAreaChanged:false,newClothPatches:0,fullGarmentAccepted:false};
 if(packet.record.meshRefinement.unmatchedAfter.length)throw Error('SEAM_REFINEMENT_LEFT_UNPAIRED_BOUNDARY');
 packet.binding={...packet.binding,meshParentPaperSHA256:source.binding.paperSHA256,paperSHA256:await sha(stable(packet.spec.panels)),materialSHA256:await materialHash(packet.spec),recipeHash:await sha(stable({parent:source.binding.recipeHash,operation:packet.record.meshRefinement}))};
 return packet;
}
