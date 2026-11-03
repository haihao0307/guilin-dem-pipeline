import {loadNativeBodyFixture} from '../native-body-fixtures.mjs';
import {THREE,NativeBinding} from '../../src/NativeBinding.mjs';
import {NativeRig} from '../../src/NativeRig.mjs';
export function actorFor(id){
 const model=loadNativeBodyFixture(id),geometry=new THREE.BufferGeometry(),P=new Float32Array(model.positions.length);
 for(let i=0;i<model.bodyCount;i++){P[i*3]=model.positions[i*3];P[i*3+1]=model.positions[i*3+2];P[i*3+2]=-model.positions[i*3+1];}
 geometry.setAttribute('position',new THREE.BufferAttribute(P,3));geometry.setIndex(new THREE.BufferAttribute(model.faces.slice(),1));geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial()),ocular={source:geometry,geometry,pairs:[]};
 const binding=new NativeBinding(model,{mesh,geometry,currentOcular:ocular,surfaces:new Map([['body-prefix',{geometry,levels:[]}]])});
 const rig=new NativeRig(binding.rig);return{id,rig,binding,nativeSource:{positions:binding.positions,faces:model.faces,bodyCount:model.bodyCount},fixture:{bodyVertices:model.bodyCount,bodyTriangles:model.faces.length/3,bones:rig.count,csrInfluences:binding.packed.length/8}};
}
