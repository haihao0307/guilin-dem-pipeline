import {buildHairVolume,VOLUME_GROUPS} from './HairVolumes.mjs';
import * as THREE from './three.module.js';
import {nativeFrame,localOffsets} from './GuideExchange.mjs';
import {point} from './NativeSurface.mjs';
import {unit,add,sub,mul,cross,len,clamp} from './approved/LegacyFoundation.mjs';
// Coarse, opaque, texture-free construction strips. This is an editable shape
// proxy, not a strand shader, inferred photographed mesh, or physics result.
export function createShape(surface,state,bindings){
 if(state.recipe.family==='portrait-bob')return createVolumeShape(surface,state,bindings);
 const group=new THREE.Group();group.name='F07-authored-hair-shape';group.matrixAutoUpdate=false;const material=new THREE.MeshBasicMaterial({color:'#202c2d',side:THREE.DoubleSide}),parts=[];
 for(const binding of bindings){
  const curve=state.curves.find(c=>c.rootId===binding.rootId),a=curve.points,points=[],indices=[],last=a.length/3-1,profile=curve.styleProfile;
  const sample=[];for(let j=0;j<=last;j+=3)sample.push(j);if(sample.at(-1)!==last)sample.push(last);
  for(let k=0;k<sample.length;k++){
   const j=sample[k],p=a.slice(j*3,j*3+3),before=a.slice(Math.max(0,j-1)*3,Math.max(0,j-1)*3+3),after=a.slice(Math.min(last,j+1)*3,Math.min(last,j+1)*3+3),t=unit(sub(after,before)),radial=unit([p[0],.025,p[2]-.005]);let side=cross(t,radial);if(len(side)<1e-6)side=[1,0,0];side=unit(side);
   const u=k/(sample.length-1),base=profile?.kind==='fringe'?(profile.central?.0011:.0035):.0085,width=base*Math.min(1,u/.07)*Math.pow(Math.max(.03,1-u),.19),bulge=k===0?0:.0013*Math.sin(Math.PI*u);
   for(const v of[-1,0,1])points.push(...surface.toNative(add(add(p,mul(side,width*v)),mul(radial,v===0?bulge:0))));
   if(k){const b=k*3;indices.push(b-3,b,b-2,b-2,b,b+1,b-2,b+1,b-1,b-1,b+1,b+2);}
  }
  parts.push({binding:binding.binding,offsets:localOffsets(points,nativeFrame(surface.referenceHead,binding.binding.triangle,binding.binding.barycentric)),count:points.length/3,indices});
 }
 const total=parts.reduce((n,p)=>n+p.count,0),array=new Float32Array(total*3),idx=[];let cursor=0;for(const p of parts){p.start=cursor;idx.push(...p.indices.map(i=>i+cursor));cursor+=p.count;}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(array,3));geometry.setIndex(idx);const strips=new THREE.Mesh(geometry,material);strips.frustumCulled=false;strips.name='F07-coarse-bob-strips';group.add(strips);
 const cells=state.scalp.cells.filter(c=>{const p=mul(c.v.reduce((a,v)=>add(a,v.p),[0,0,0]),1/3);return !(p[1]>.374&&p[2]>-.017&&Math.abs(p[0]-state.recipe.partMM*.001)<.0016);}),capArray=new Float32Array(cells.length*9),capGeometry=new THREE.BufferGeometry();capGeometry.setAttribute('position',new THREE.BufferAttribute(capArray,3));const cap=new THREE.Mesh(capGeometry,material);cap.name='F07-native-scalp-hair-base';cap.frustumCulled=false;group.add(cap);
 let version=-1;function update(head,mesh,positionVersion){
  group.matrix.copy(mesh.matrix);group.matrixWorld.copy(mesh.matrixWorld);if(version===positionVersion)return;version=positionVersion;
  for(const p of parts){const f=nativeFrame(head,p.binding.triangle,p.binding.barycentric),a=p.offsets;for(let j=0;j<a.length;j+=3)for(let k=0;k<3;k++)array[p.start*3+j+k]=f.origin[k]+f.t[k]*a[j]+f.b[k]*a[j+1]+f.n[k]*a[j+2];}
  geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();let n=0;
  for(const cell of cells){const f=nativeFrame(head,cell.f,cell.v[0].b);for(const v of cell.v){capArray.set(add(point(head,cell.f,v.b),mul(f.n,.005)),n);n+=3;}}
  capGeometry.attributes.position.needsUpdate=true;capGeometry.computeVertexNormals();
 }
 return {group,update,diagnostics:()=>({mode:'coarse authored strips and native scalp base',strips:parts.length,vertices:total+capArray.length/3,triangles:idx.length/3+capArray.length/9,photoTexture:false,physics:false}),dispose(){geometry.dispose();capGeometry.dispose();material.dispose();}};
}

function createVolumeShape(surface,state,bindings){
 const cage=buildHairVolume(state.recipe,surface.head),group=new THREE.Group();group.name='F07-grouped-hair-volume';group.matrixAutoUpdate=false;
 const anchor=surface.roots.filter(r=>r.active).reduce((a,b)=>{const d=r=>(r.p[0]-state.recipe.partMM*.001)**2+(r.p[1]-.40)**2+(r.p[2]-.015)**2;return d(a)<d(b)?a:b;});
 const binding={triangle:anchor.f,barycentric:anchor.b.slice()},frame=nativeFrame(surface.referenceHead,binding.triangle,binding.barycentric),native=[];for(let j=0;j<cage.positions.length;j+=3)native.push(...surface.toNative(cage.positions.slice(j,j+3)));
 const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(cage.positions,3));indexed.setIndex(cage.triangles);indexed.computeVertexNormals();const normals=indexed.attributes.normal.array,parts=[],light=unit([-.35,.65,.7]),material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
 for(const spec of VOLUME_GROUPS.filter(g=>g.id!=='fringe')){
  const pts=[],uv=[],shades=[];for(let f=0;f<cage.faceGroups.length;f++)if(cage.faceGroups[f]===spec.id)for(const id of cage.triangles.slice(f*3,f*3+3)){pts.push(...native.slice(id*3,id*3+3));uv.push(...cage.uv.slice(id*2,id*2+2));const n=normals.slice(id*3,id*3+3);shades.push(.63+.37*Math.max(0,n[0]*light[0]+n[1]*light[1]+n[2]*light[2]));}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(pts.length),3));const mesh=new THREE.Mesh(geometry,material);mesh.name='F07-volume-'+spec.id;mesh.frustumCulled=false;mesh.userData.hairGroup=spec.id;mesh.userData.materialSlot='body';group.add(mesh);parts.push({spec,mesh,offsets:localOffsets(pts,frame),binding,shades});
 }
 // The sparse photographed fringe is a separate leaf group with exact native
 // roots; it does not close the forehead opening of the main volume.
 for(const g of bindings.filter(b=>b.styleProfile?.kind==='fringe')){
  const c=state.curves.find(c=>c.rootId===g.rootId),a=c.points,last=a.length/3-1,pts=[],uv=[],shades=[],sample=[];for(let j=0;j<=last;j+=3)sample.push(j);if(sample.at(-1)!==last)sample.push(last);
  const rings=[];for(let k=0;k<sample.length;k++){const j=sample[k],p=a.slice(j*3,j*3+3),t=unit(sub(a.slice(Math.min(last,j+1)*3,Math.min(last,j+1)*3+3),a.slice(Math.max(0,j-1)*3,Math.max(0,j-1)*3+3))),radial=unit([p[0],.01,p[2]-.005]);let side=unit(cross(t,radial));if(len(side)<1e-6)side=[1,0,0];const u=k/(sample.length-1),w=(c.styleProfile.central?.0010:.0060)*Math.min(1,u/.10)*Math.pow(Math.max(.02,1-u),.4);rings.push([surface.toNative(add(p,mul(side,-w))),surface.toNative(add(p,mul(side,w)))]);}
  for(let k=1;k<rings.length;k++)for(const [row,col]of[[k-1,0],[k,0],[k-1,1],[k-1,1],[k,0],[k,1]]){pts.push(...rings[row][col]);uv.push(col,row/(rings.length-1));shades.push(.9);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(pts.length),3));const mesh=new THREE.Mesh(geometry,material);mesh.name='F07-fringe-'+g.rootId;mesh.userData.hairGroup='fringe';mesh.userData.materialSlot='fringe';mesh.frustumCulled=false;group.add(mesh);parts.push({spec:VOLUME_GROUPS.find(g=>g.id==='fringe'),mesh,offsets:localOffsets(pts,nativeFrame(surface.referenceHead,g.binding.triangle,g.binding.barycentric)),binding:g.binding,shades});
 }
 indexed.dispose();let version=-1,partition=false,selected='all';
 function mode(colored=false,id='all'){partition=colored;selected=id;for(const p of parts){p.mesh.visible=selected==='all'||p.spec.id===selected;const color=new THREE.Color(partition?p.spec.color:'#73807e'),a=p.mesh.geometry.attributes.color.array;for(let i=0;i<p.shades.length;i++){a[i*3]=color.r*p.shades[i];a[i*3+1]=color.g*p.shades[i];a[i*3+2]=color.b*p.shades[i];}p.mesh.geometry.attributes.color.needsUpdate=true;}}
 function update(head,mesh,positionVersion){group.matrix.copy(mesh.matrix);group.matrixWorld.copy(mesh.matrixWorld);if(version===positionVersion)return;version=positionVersion;for(const p of parts){const f=nativeFrame(head,p.binding.triangle,p.binding.barycentric),a=p.offsets,out=p.mesh.geometry.attributes.position.array;for(let j=0;j<a.length;j+=3)for(let k=0;k<3;k++)out[j+k]=f.origin[k]+f.t[k]*a[j]+f.b[k]*a[j+1]+f.n[k]*a[j+2];p.mesh.geometry.attributes.position.needsUpdate=true;}}
 mode();return{group,update,mode,attachMaterials(slots){for(const key of Object.keys(slots))if(!['body','fringe'].includes(key)||!slots[key]?.isMaterial)throw Error('需要 body/fringe 材质对象');for(const p of parts)p.mesh.material=slots[p.mesh.userData.materialSlot]||material;},exportVolume:()=>({...structuredClone(cage),nativeBinding:{triangle:binding.triangle,barycentric:binding.barycentric.slice(),coordinates:'native-common-viewer-Yup',offsets:localOffsets(native,frame)},rootOwnership:bindings.map(g=>({rootId:g.rootId,binding:g.binding,groups:g.styleProfile?.pathGroups??[]}))}),diagnostics:()=>({mode:'hierarchical authored volume with separate native fringe',groups:VOLUME_GROUPS.map(g=>g.id),vertices:parts.reduce((n,p)=>n+p.offsets.length/3,0),triangles:parts.reduce((n,p)=>n+p.offsets.length/9,0),photoTexture:false,physics:false,partition,selected}),dispose(){for(const p of parts)p.mesh.geometry.dispose();material.dispose();}};
}
