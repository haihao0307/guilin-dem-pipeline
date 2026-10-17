/** A finite, watertight roof cover extracted from the existing analytic exterior.
 * This changes design geometry only. The source coal load is retained separately.
 */
export function createClosedOilWaterRoof(T,skin,D,material,thickness=.05){
 const source=skin.mesh.geometry,p=source.attributes.position,n=source.attributes.normal;
 const paint=source.groups[0],glass=source.groups[1],selected=[],remaining=[];
 for(let i=paint.start;i<paint.start+paint.count;i+=3){
  const tri=[0,1,2].map(k=>source.index.getX(i+k));
  const roof=tri.every(id=>p.getX(id)>=D.tenderStart-1e-5&&p.getX(id)<=D.tenderEnd+1e-5&&p.getZ(id)>=D.cabGlassSill-1e-4);
  (roof?selected:remaining).push(...tri);
 }
 if(!selected.length)throw Error('OIL_WATER_ROOF_EXTRACTION_EMPTY');
 const glassIndices=[];for(let i=glass.start;i<glass.start+glass.count;i++)glassIndices.push(source.index.getX(i));
 source.setIndex([...remaining,...glassIndices]);source.clearGroups();source.addGroup(0,remaining.length,0);source.addGroup(remaining.length,glassIndices.length,1);skin.paintIndices=remaining.length;skin.glassIndices=glassIndices.length;
 const map=new Map();for(const id of selected)if(!map.has(id))map.set(id,map.size);
 const count=map.size,positions=[],normals=[],uv=[];
 for(const[id]of map){positions.push(p.getX(id),p.getY(id),p.getZ(id));normals.push(n.getX(id),n.getY(id),n.getZ(id));uv.push(source.attributes.uv.getX(id),source.attributes.uv.getY(id));}
 for(const[id]of map){positions.push(p.getX(id)-n.getX(id)*thickness,p.getY(id)-n.getY(id)*thickness,p.getZ(id)-n.getZ(id)*thickness);normals.push(-n.getX(id),-n.getY(id),-n.getZ(id));uv.push(source.attributes.uv.getX(id),source.attributes.uv.getY(id));}
 const outer=selected.map(id=>map.get(id)),indices=[...outer],edges=new Map();
 for(let i=0;i<outer.length;i+=3){const a=outer[i],b=outer[i+1],c=outer[i+2];indices.push(a+count,c+count,b+count);for(const[e,f]of[[a,b],[b,c],[c,a]]){const key=e<f?e+','+f:f+','+e;if(edges.has(key))edges.delete(key);else edges.set(key,[e,f]);}}
 for(const[a,b]of edges.values())indices.push(b,a,a+count,b,a+count,b+count);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();
 const mesh=new T.Mesh(g,material);mesh.name='closed finite oil-water tank crown / no open coal bunker';
 const counts=new Map();for(let i=0;i<indices.length;i+=3)for(const[a,b]of[[indices[i],indices[i+1]],[indices[i+1],indices[i+2]],[indices[i+2],indices[i]]]){const key=a<b?a+','+b:b+','+a;counts.set(key,(counts.get(key)||0)+1);}
 const manifold=[...counts.values()].every(n=>n===2);if(!manifold)throw Error('OIL_WATER_ROOF_NOT_CLOSED');
 mesh.userData={closedCover:true,manifoldEdgeCount:counts.size,everyEdgeUsedTwice:manifold,outerSurfaceTriangles:outer.length/3,perimeterEdges:edges.size,finiteThicknessSourceUnits:thickness,thicknessIsDesignProposal:true,sharedAnalyticExterior:true,sourceCoalNodeRetained:311};
 return mesh;
}
