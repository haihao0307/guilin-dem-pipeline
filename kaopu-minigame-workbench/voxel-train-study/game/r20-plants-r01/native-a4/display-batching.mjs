import * as T from '../../../vendor/three.module.js';
// Transient renderer buffers only. The native source hierarchy, functions and identities remain intact.
export function batchStaticDisplay(root,{domain=false}={}){
 root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),matrix=new T.Matrix4(),inst=new T.Matrix4(),normalMatrix=new T.Matrix3(),P=new T.Vector3(),N=new T.Vector3(),groups=new Map(),sources=[];
 root.traverseVisible(o=>{if(!o.isMesh||Array.isArray(o.material)||o.material.transparent)return;const m=o.material;if(!groups.has(m))groups.set(m,{positions:[],normals:[]});const b=groups.get(m),g=o.geometry,a=g.attributes.position,n=g.attributes.normal,index=g.index;
 for(let j=0;j<(o.isInstancedMesh?o.count:1);j++){matrix.copy(inverse).multiply(o.matrixWorld);if(o.isInstancedMesh){o.getMatrixAt(j,inst);matrix.multiply(inst);}normalMatrix.getNormalMatrix(matrix);for(let i=0;i<(index?index.count:a.count);i++){const k=index?index.getX(i):i;P.fromBufferAttribute(a,k).applyMatrix4(matrix);N.fromBufferAttribute(n,k).applyMatrix3(normalMatrix).normalize();b.positions.push(...P.toArray());b.normals.push(...N.toArray());}}
 sources.push(o);});
 for(const o of sources){o.visible=false;o.userData.nativeDisplaySource=true;}
 const displays=[];for(const [mat,b]of groups){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.normals,3));g.computeBoundingSphere();const mesh=new T.Mesh(g,mat);mesh.name='Transient function display '+mat.name;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.nativeDisplayBatch=true;
 if(domain){mat.userData.domainRoot=root;mesh.onBeforeRender=(_r,_s,_c,_g,m)=>{if(m.userData.shader)m.userData.shader.uniforms.kpDomain.value.copy(root.matrixWorld).invert();};}
 root.add(mesh);displays.push(mesh);}return{sources,displays};
}
