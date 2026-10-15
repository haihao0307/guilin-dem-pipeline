// Rendering adapter only. Reorders complete triangles by material; no coordinates
// are changed, merged, quantised or smoothed. The readable score stays untouched.
export function groupByMaterial(geometry,THREE){
 const g=geometry.index?geometry.toNonIndexed():geometry,groups=g.groups.length?g.groups:[{start:0,count:g.attributes.position.count,materialIndex:0}],indices=[];const ranges=[];
 for(const id of [...new Set(groups.map(g=>g.materialIndex))].sort((a,b)=>a-b)){
  const start=indices.length;for(const part of groups)if(part.materialIndex===id)for(let i=part.start;i<part.start+part.count;i++)indices.push(i);
  ranges.push({start,count:indices.length-start,materialIndex:id});
 }
 if(indices.length!==g.attributes.position.count)throw Error('Material group does not cover the exact geometry');
 const out=new THREE.BufferGeometry();for(const [name,a]of Object.entries(g.attributes)){const data=new a.array.constructor(a.count*a.itemSize);for(let j=0;j<indices.length;j++)for(let k=0;k<a.itemSize;k++)data[j*a.itemSize+k]=a.array[indices[j]*a.itemSize+k];out.setAttribute(name,new THREE.BufferAttribute(data,a.itemSize,a.normalized));}
 for(const r of ranges)out.addGroup(r.start,r.count,r.materialIndex);out.computeBoundingBox();return out;
}
