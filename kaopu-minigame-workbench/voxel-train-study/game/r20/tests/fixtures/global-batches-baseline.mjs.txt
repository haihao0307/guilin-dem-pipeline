import * as THREE from '../../../vendor/three.module.js';
import {createBatchMaterials,packAppearance,MATERIAL_TABLE_SIZE} from './batch-materials.mjs';
const identity=new THREE.Matrix4(),m4=new THREE.Matrix4(),n3=new THREE.Matrix3(),v3=new THREE.Vector3();
const capacity=n=>Math.max(64,Math.ceil(Math.max(1,n)*1.125/64)*64);
function attribute(array,itemSize,instanced=false){const a=instanced?new THREE.InstancedBufferAttribute(array,itemSize):new THREE.BufferAttribute(array,itemSize);a.setUsage(THREE.DynamicDrawUsage);return a;}
function bytes(g){let n=g.index?.array.byteLength||0;for(const a of Object.values(g.attributes))n+=a.array.byteLength;return n;}
// Source handles are recipes and CPU ownership only. Exactly one visible district
// renderer owns shared family materials and cross-parcel batches.
export function createDistrictBatches(){
 const root=new THREE.Group();root.name='R19-cross-parcel-function-batches';let library=createBatchMaterials();const batches=new Map();let rebuilds=0,closed=false;
 const proof={sourceMeshes:0,batches:0,materials:0,sourceTriangles:0,renderTriangles:0,instanceBytes:0,geometryBytes:0,clothVertices:0,rebuilds:0,disposedBatches:0,clock:'Session.view.elapsed',externalMesh:false,externalImageTextures:false};
 function disposeBatch(b){b.mesh.removeFromParent();b.mesh.dispose?.();b.geometry.dispose();proof.disposedBatches++;}
 function allocate(key,group){
  let b=batches.get(key),count=group.instanced?group.count:group.vertices,cap=capacity(count),indexCap=group.instanced?0:capacity(group.indices);
  if(b&&b.capacity>=count&&b.capacity<=Math.max(256,count*1.5)&&(group.instanced||(b.indexCapacity>=group.indices&&b.indexCapacity<=Math.max(512,group.indices*1.5))))return b;
  if(b)disposeBatch(b);
  const g=new THREE.BufferGeometry();if(group.instanced){for(const[name,a]of Object.entries(group.source.attributes))g.setAttribute(name,a.clone());g.setIndex(group.source.index?.clone()||null);if(!g.attributes.color)g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(1),3));}
  else{g.setAttribute('position',attribute(new Float32Array(cap*3),3));g.setAttribute('normal',attribute(new Float32Array(cap*3),3));g.setAttribute('color',attribute(new Float32Array(cap*3),3));g.setIndex(attribute(new Uint32Array(indexCap),1));}
  g.setAttribute('stMaterial',attribute(new Float32Array(cap),1,group.instanced));
  if(group.family==='cloth'){g.setAttribute('stMotion',attribute(new Float32Array(cap*4),4,group.instanced));g.setAttribute('stMotionHeight',attribute(new Float32Array(cap),1,group.instanced));}
  const material=library.get(group.family,group.transparent,group.tableIndex),mesh=group.instanced?new THREE.InstancedMesh(g,material,cap):new THREE.Mesh(g,material);
  if(group.instanced){mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.instanceColor=attribute(new Float32Array(cap*3),3,true);}
  mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.name='R19-batch:'+key;const depth=library.depthFor(group.family);if(depth)mesh.customDepthMaterial=depth;root.add(mesh);
  b={mesh,geometry:g,capacity:cap,indexCapacity:indexCap,instanced:group.instanced,key};batches.set(key,b);return b;
 }
 function rebuild(chunks){
  if(closed)throw Error('District batches disposed');const groups=new Map(),palettes=new Map();let sourceMeshes=0,sourceTriangles=0,clothVertices=0;
  for(const c of chunks){const h=c.handle,cloth=new Map(h.cloth.map(v=>[v.mesh,v]));h.root.position.set(0,0,0);h.root.updateMatrixWorld(true);
   h.root.traverse(o=>{if(!o.isMesh)return;if(Array.isArray(o.material))throw Error('R19 scalar recipe material required');sourceMeshes++;const p=packAppearance(o.material,c.center,c.score.appearance.wetness),isInstance=!!o.isInstancedMesh;
    const paletteKey=p.family+':'+p.transparent;let palette=palettes.get(paletteKey);if(!palette){palette={family:p.family,transparent:p.transparent,ids:new Map(),rows:[]};palettes.set(paletteKey,palette);}const appearanceKey=JSON.stringify(p.data);let appearanceId=palette.ids.get(appearanceKey);if(appearanceId===undefined){appearanceId=palette.rows.length;palette.ids.set(appearanceKey,appearanceId);palette.rows.push(p.data);}p.materialIndex=appearanceId%MATERIAL_TABLE_SIZE;const tableIndex=Math.floor(appearanceId/MATERIAL_TABLE_SIZE);
    const key=(isInstance?'i:'+o.geometry.uuid:'m')+':'+p.family+':'+p.transparent+':'+tableIndex;
    let g=groups.get(key);if(!g){g={key,instanced:isInstance,family:p.family,transparent:p.transparent,tableIndex,source:o.geometry,entries:[],count:0,vertices:0,indices:0};groups.set(key,g);}
    const count=isInstance?o.count:1;g.count+=count;g.vertices+=o.geometry.attributes.position.count;g.indices+=o.geometry.index?.count??o.geometry.attributes.position.count;
    const clothSource=cloth.get(o);if(clothSource){if(!o.matrixWorld.equals(identity))throw Error('Cloth analytic coordinates require identity recipe transform');clothVertices+=clothSource.rest.length/3;}
    g.entries.push({object:o,appearance:p,center:c.center,cloth:clothSource,wind:h.score.motion.wind});sourceTriangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*count;
   });
  }
  for(const[key,b]of batches)if(!groups.has(key)){disposeBatch(b);batches.delete(key);}
  if(!groups.size&&library.count){library.dispose();library=createBatchMaterials();}
  for(const palette of palettes.values())for(let i=0;i<palette.rows.length;i+=MATERIAL_TABLE_SIZE)library.setTable(palette.family,palette.transparent,i/MATERIAL_TABLE_SIZE,palette.rows.slice(i,i+MATERIAL_TABLE_SIZE));
  let renderedTriangles=0,geometryBytes=0,instanceBytes=0;
  for(const[key,group]of groups){const b=allocate(key,group),g=b.geometry;let offset=0,indexOffset=0;
   const writeAppearance=(n,p)=>{g.attributes.stMaterial.array[n]=p.materialIndex;};
   for(const e of group.entries){const o=e.object,p=e.appearance,source=o.geometry;
    if(group.instanced){for(let i=0;i<o.count;i++){o.getMatrixAt(i,m4);m4.premultiply(o.matrixWorld);m4.elements[12]+=e.center;b.mesh.instanceMatrix.array.set(m4.elements,offset*16);b.mesh.instanceColor.array.set(p.color,offset*3);writeAppearance(offset,p);offset++;}continue;}
    const pos=source.attributes.position,norm=source.attributes.normal,base=offset,matrix=o.matrixWorld;n3.getNormalMatrix(matrix);
    let minY=Infinity,maxY=-Infinity;if(e.cloth)for(let i=1;i<e.cloth.rest.length;i+=3){minY=Math.min(minY,e.cloth.rest[i]);maxY=Math.max(maxY,e.cloth.rest[i]);}const height=Math.max(.1,maxY-minY);
    for(let i=0;i<pos.count;i++,offset++){
     const rest=e.cloth?.rest;if(rest)v3.fromArray(rest,i*3);else v3.fromBufferAttribute(pos,i);v3.applyMatrix4(matrix);v3.x+=e.center;v3.toArray(g.attributes.position.array,offset*3);
     // Original rest normal is kept; the shader applies the analytic wind Jacobian.
     v3.fromBufferAttribute(norm,i).applyNormalMatrix(n3).toArray(g.attributes.normal.array,offset*3);g.attributes.color.array.set(p.color,offset*3);writeAppearance(offset,p);
     if(group.family==='cloth'){
      let free=0,phase=0,amp=0,freq=1,gradient=0;
      if(e.cloth){free=e.cloth.pinned?.[i]?0:Math.max(0,Math.min(1,(maxY-rest[i*3+1])/height));phase=((e.cloth.seed||0)*.173+rest[i*3]*1.8)%(2*Math.PI);amp=e.wind.amplitude;freq=e.wind.frequency;gradient=free>0&&free<1?-1/height:0;}
      g.attributes.stMotion.array.set([free,phase,amp,freq],offset*4);g.attributes.stMotionHeight.array[offset]=gradient;
     }
    }
    const si=source.index;for(let i=0;i<(si?.count??pos.count);i++)g.index.array[indexOffset++]=base+(si?si.getX(i):i);
   }
   for(const a of Object.values(g.attributes))if(a.usage===THREE.DynamicDrawUsage){a.clearUpdateRanges();a.addUpdateRange(0,offset*a.itemSize);a.needsUpdate=true;}
   if(group.instanced){b.mesh.count=offset;b.mesh.instanceMatrix.clearUpdateRanges();b.mesh.instanceMatrix.addUpdateRange(0,offset*16);b.mesh.instanceMatrix.needsUpdate=true;b.mesh.instanceColor.clearUpdateRanges();b.mesh.instanceColor.addUpdateRange(0,offset*3);b.mesh.instanceColor.needsUpdate=true;renderedTriangles+=(group.source.index?.count??group.source.attributes.position.count)/3*offset;instanceBytes+=b.mesh.instanceMatrix.array.byteLength+b.mesh.instanceColor.array.byteLength;}
   else{g.setDrawRange(0,indexOffset);g.index.clearUpdateRanges();g.index.addUpdateRange(0,indexOffset);g.index.needsUpdate=true;renderedTriangles+=indexOffset/3;}
   geometryBytes+=bytes(g);
  }
  if(renderedTriangles!==sourceTriangles)throw Error('R19 batching changed triangle count');
  Object.assign(proof,{sourceMeshes,batches:batches.size,materials:library.count,sourceTriangles,renderTriangles:renderedTriangles,geometryBytes,instanceBytes,clothVertices,rebuilds:++rebuilds});return proof;
 }
 return{root,proof,rebuild,update(time,distance,groundY){root.position.set(-distance,groundY,0);library.update(time,distance,groundY);proof.time=time;proof.distance=distance;},dispose(){if(closed)return;closed=true;for(const b of batches.values())disposeBatch(b);batches.clear();library.dispose();root.clear();root.removeFromParent();proof.batches=0;proof.disposed=true;}};
}
