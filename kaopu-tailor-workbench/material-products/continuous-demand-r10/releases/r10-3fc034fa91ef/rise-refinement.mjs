import {sha,stable,materialHash} from './source-contract.mjs';

/** Give long material triangles beside the rise a real interior contact site.
 * A barycentric split preserves the paper area, all original edges and seams.
 * It adds resolution to the existing panel, never a covering cloth patch. */
export async function refineRiseTriangles(source){
 if(!source.spec.panels.some(p=>/^pant_/.test(p.id)))return source;
 const packet=structuredClone(source),sites=new Map(),active=new Set(packet.record.activeSeams);
 for(const seam of packet.spec.seams)if(active.has(seam.id)&&/^pant_/.test(seam.a.panelId)&&/^pant_/.test(seam.b.panelId)&&(/_l$/.test(seam.a.panelId)!==/_l$/.test(seam.b.panelId)))for(const side of['a','b']){const endpoint=seam[side],panel=packet.spec.panels.find(p=>p.id===endpoint.panelId);if(!sites.has(panel.id))sites.set(panel.id,new Set());for(const i of panel.edges[endpoint.edge])sites.get(panel.id).add(i);}
 let offset=0;const positions=packet.spec.panels.map(p=>{const row=packet.record.positionsMm.slice(offset,offset+p.uvMm.length);offset+=p.uvMm.length;return row;}),inserted=[];
 for(let n=0;n<packet.spec.panels.length;n++){
  const panel=packet.spec.panels[n],core=sites.get(panel.id);if(!core)continue;const triangles=[];
  for(const tri of panel.triangles){const uv=tri.map(i=>panel.uvMm[i]),longest=Math.max(...tri.map((i,k)=>Math.hypot(panel.uvMm[i][0]-uv[(k+1)%3][0],panel.uvMm[i][1]-uv[(k+1)%3][1])));
   if(!tri.some(i=>core.has(i))||longest<=20){triangles.push(tri);continue;}
   const index=panel.uvMm.length,mean=values=>values[0].map((_,k)=>values.reduce((sum,p)=>sum+p[k],0)/3);
   panel.uvMm.push(mean(uv));positions[n].push(mean(tri.map(i=>positions[n][i])));if(packet.sourceTemplate?.panelsUV?.[n])packet.sourceTemplate.panelsUV[n].push(mean(tri.map(i=>packet.sourceTemplate.panelsUV[n][i])));
   triangles.push([tri[0],tri[1],index],[tri[1],tri[2],index],[tri[2],tri[0],index]);inserted.push({panel:panel.id,index,parentTriangle:tri,barycentric:[1/3,1/3,1/3]});
  }panel.triangles=triangles;
 }
 if(!inserted.length)return source;
 packet.record.positionsMm=positions.flat();packet.record.contactRefinement={schema:'kaopu/rise-material-triangle-refinement@1',parentRecipeHash:source.binding.recipeHash,maximumSelectedEdgeMM:20,inserted,paperContoursChanged:false,materialAreaChanged:false,newClothPatches:0};
 for(const key of['materialToSolverGroup','nativeBinding','wholeSeamAudit','jointRefinement'])delete packet.record[key];
 packet.binding={...packet.binding,paperSHA256:await sha(stable(packet.spec.panels)),materialSHA256:await materialHash(packet.spec),recipeHash:await sha(stable({parent:source.binding.recipeHash,operation:packet.record.contactRefinement}))};return packet;
}
