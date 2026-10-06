/** Ribbon renderer adapter copied from the accepted GNM groom experiment.
 * Curves remain three-dimensional; the shader expands only fibre radius.
 */
import * as THREE from 'three';
export function geometryFromBinding(binding,positions,normals){
  const a=binding.update(positions,normals),count=binding.count,segments=binding.segments,per=segments+1,points=count*per,g=new THREE.BufferGeometry(),attrs={position:new Float32Array(points*6),tangent:new Float32Array(points*6),scalpNormal:new Float32Array(points*6),strandSide:new Float32Array(points*2),along:new Float32Array(points*2),strandRandom:new Float32Array(points*2),strandRadius:new Float32Array(points*2)},idx=new Uint32Array(count*segments*6);
  let z=0;for(let i=0;i<count;i++)for(let j=0;j<per;j++){const q=i*per+j;for(let k=0;k<2;k++){const v=q*2+k;attrs.position.set(a.positions.subarray(q*3,q*3+3),v*3);attrs.tangent.set(a.tangents.subarray(q*3,q*3+3),v*3);attrs.scalpNormal.set(a.rootNormals.subarray(q*3,q*3+3),v*3);attrs.strandSide[v]=k?1:-1;attrs.along[v]=j/segments;attrs.strandRandom[v]=a.strandRandom[q];attrs.strandRadius[v]=a.radii[q];}if(j<segments){const v=q*2;idx.set([v,v+1,v+2,v+1,v+3,v+2],z);z+=6;}}
  for(const [name,a]of Object.entries(attrs))g.setAttribute(name,new THREE.BufferAttribute(a,['position','tangent','scalpNormal'].includes(name)?3:1).setUsage(THREE.DynamicDrawUsage));g.setIndex(new THREE.BufferAttribute(idx,1));g.userData.binding=binding;g.computeBoundingSphere();return g;
}
export function refreshBoundGeometry(mesh,positions,normals){const b=mesh.geometry.userData.binding,a=b.update(positions,normals);for(const [name,source]of [['position',a.positions],['tangent',a.tangents],['scalpNormal',a.rootNormals]]){const attr=mesh.geometry.attributes[name];for(let q=0;q<b.count*b.per;q++){attr.array.set(source.subarray(q*3,q*3+3),q*6);attr.array.set(source.subarray(q*3,q*3+3),q*6+3);}attr.needsUpdate=true;}mesh.geometry.computeBoundingSphere();}
