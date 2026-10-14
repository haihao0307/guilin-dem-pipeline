/** Same-source finite surface mesh adapter. One shared map canvas; no iframe, billboard or texture facade. */
export const CANDIDATES=Object.freeze([
 {id:'lost-bureau',name:'失物局 R03f',label:'中远景布局候选 · 同源有限采样',sourceCommit:'5e139ef061cb2f6ed739536f2e53342a2c71c924',nominalMetres:[92,31,80],defaultScale:1,sourceFront:'negative x',storyPlacement:true},
 {id:'walled-pair',name:'城寨两栋 R05',label:'空间结构候选 · 同源有限采样',sourceCommit:'942f27bfcf966d501e79586915899ba62cff75f5',nominalMetres:[22.3,40.6,13.1],defaultScale:1,sourceFront:'negative z',storyPlacement:true}
]);
const TYPES={positions:Float32Array,normals:Float32Array,colors:Float32Array,indices:Uint32Array,roughness:Float32Array,materialIds:Uint16Array};
export async function loadCandidateMesh(id,{baseURL=new URL('./data/',import.meta.url),fetchImpl=fetch}={}){
 if(!CANDIDATES.some(c=>c.id===id))throw Error('Unknown candidate '+id);const get=async path=>{const r=await fetchImpl(new URL(path,baseURL));if(!r.ok)throw Error(`候选真实网格未加载：${path} HTTP ${r.status}`);return r;};
 const metadata=await(await get(id+'.json')).json(),mesh={id,metadata};await Promise.all(Object.entries(metadata.files).map(async([key,file])=>{const bytes=await(await get(file.path)).arrayBuffer();if(bytes.byteLength!==file.bytes)throw Error('Candidate mesh size mismatch '+file.path);const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(digest!==file.sha256)throw Error('Candidate mesh hash mismatch '+file.path);mesh[key]=new TYPES[key](bytes);}));
 if(mesh.positions.length!==metadata.vertexCount*3||mesh.indices.length!==metadata.triangleCount*3)throw Error('Candidate mesh shape mismatch '+id);
 return mesh;
}
export function transformCandidateMesh(mesh,{position=[0,0,0],yaw=0,scale=1}={}){
 if(!Number.isFinite(scale)||scale<=0||position.length!==3||position.some(x=>!Number.isFinite(x))||!Number.isFinite(yaw))throw Error('Invalid candidate rigid placement or scale');
 const c=Math.cos(yaw),s=Math.sin(yaw),positions=new Float32Array(mesh.positions.length),normals=new Float32Array(mesh.normals.length);
 for(let i=0;i<positions.length;i+=3){const x=mesh.positions[i]*scale,z=mesh.positions[i+2]*scale;positions[i]=position[0]+x*c+z*s;positions[i+1]=position[1]+mesh.positions[i+1]*scale;positions[i+2]=position[2]-x*s+z*c;const nx=mesh.normals[i],nz=mesh.normals[i+2];normals[i]=nx*c+nz*s;normals[i+1]=mesh.normals[i+1];normals[i+2]=-nx*s+nz*c;}
 return {...mesh,positions,normals,placement:{position:[...position],yaw,scale,geographicStatus:'adjustable authored story placement, not surveyed'}};
}
export function candidateToThree(THREE,mesh,{position=[0,0,0],yaw=0,scale=1}={}){
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(mesh.positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(mesh.normals,3));geometry.setAttribute('color',new THREE.BufferAttribute(mesh.colors,3));geometry.setIndex(new THREE.BufferAttribute(mesh.indices,1));geometry.computeBoundingSphere();const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,metalness:0,side:THREE.DoubleSide});const object=new THREE.Mesh(geometry,material);object.name=mesh.id;object.position.fromArray(position);object.rotation.y=yaw;object.scale.setScalar(scale);object.userData.candidate=mesh.metadata;return object;
}
