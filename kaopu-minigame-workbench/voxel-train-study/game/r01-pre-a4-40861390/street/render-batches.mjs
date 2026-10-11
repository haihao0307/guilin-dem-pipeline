import * as THREE from '../../../vendor/three.module.js';
import {createBatchMaterials,packAppearance,MATERIAL_TABLE_SIZE} from './batch-materials.mjs';
const identity=new THREE.Matrix4();
// A suspended pack must not share mutable matrix scratch with another cell.
function* meshes(root){const stack=[root];while(stack.length){const o=stack.pop();for(let i=o.children.length-1;i>=0;i--)stack.push(o.children[i]);if(o.isMesh)yield o;}}
export const BATCH_CELL_METRES=44;
const BOUNDS_PAD=.0001;
const capacity=n=>Math.max(64,Math.ceil(Math.max(1,n)*1.125/64)*64);
function attribute(array,itemSize,instanced=false){const a=instanced?new THREE.InstancedBufferAttribute(array,itemSize):new THREE.BufferAttribute(array,itemSize);a.setUsage(THREE.DynamicDrawUsage);return a;}
function bytes(g){let n=g.index?.array.byteLength||0;for(const a of Object.values(g.attributes))n+=a.array.byteLength;return n;}
// Source handles are recipes and CPU ownership only. Exactly one visible district
// renderer owns shared family materials and cross-parcel batches.
function createCellRenderer({cellMetres=BATCH_CELL_METRES}={}){
 if(!Number.isFinite(cellMetres)||cellMetres<44||cellMetres>66)throw Error('Street batch cells must be 44–66 metres');
 const m4=new THREE.Matrix4(),n3=new THREE.Matrix3(),instanceBounds=new THREE.Box3();
 const root=new THREE.Group();root.name='R20-cross-parcel-function-batches';let library=createBatchMaterials();const batches=new Map();let rebuilds=0,closed=false;
 const proof={cellMetres,spatialCells:0,frustumCulled:true,sourceMeshes:0,batches:0,materials:0,sourceTriangles:0,renderTriangles:0,instanceBytes:0,geometryBytes:0,clothVertices:0,rebuilds:0,disposedBatches:0,clock:'Session.view.elapsed',externalMesh:false,externalImageTextures:false};
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
  mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=true;mesh.name='R20-batch:'+key;const depth=library.depthFor(group.family);if(depth)mesh.customDepthMaterial=depth;root.add(mesh);
  b={mesh,geometry:g,capacity:cap,indexCapacity:indexCap,instanced:group.instanced,key};batches.set(key,b);return b;
 }
 function* rebuildSteps(chunks){
  if(closed)throw Error('District batches disposed');const groups=new Map(),palettes=new Map();let sourceMeshes=0,sourceTriangles=0,clothVertices=0;
  for(const c of chunks){const h=c.handle,cloth=new Map(h.cloth.map(v=>[v.mesh,v]));h.root.position.set(0,0,0);h.root.updateMatrixWorld(true);
   for(const o of meshes(h.root)){if(Array.isArray(o.material))throw Error('R20 scalar recipe material required');sourceMeshes++;const p=packAppearance(o.material,c.center,c.score.appearance.wetness),isInstance=!!o.isInstancedMesh;
    const paletteKey=p.family+':'+p.transparent;let palette=palettes.get(paletteKey);if(!palette){palette={family:p.family,transparent:p.transparent,ids:new Map(),rows:[]};palettes.set(paletteKey,palette);}const appearanceKey=JSON.stringify(p.data);let appearanceId=palette.ids.get(appearanceKey);if(appearanceId===undefined){appearanceId=palette.rows.length;palette.ids.set(appearanceKey,appearanceId);palette.rows.push(p.data);}p.materialIndex=appearanceId%MATERIAL_TABLE_SIZE;const tableIndex=Math.floor(appearanceId/MATERIAL_TABLE_SIZE);
    const cell=Math.floor(c.center/cellMetres),key=cell+':'+(isInstance?'i:'+o.geometry.uuid:'m')+':'+p.family+':'+p.transparent+':'+tableIndex;
    let g=groups.get(key);if(!g){g={key,cell,instanced:isInstance,family:p.family,transparent:p.transparent,tableIndex,source:o.geometry,entries:[],count:0,vertices:0,indices:0};groups.set(key,g);}
    const count=isInstance?o.count:1;g.count+=count;g.vertices+=o.geometry.attributes.position.count;g.indices+=o.geometry.index?.count??o.geometry.attributes.position.count;
    const clothSource=cloth.get(o);if(clothSource){if(!o.matrixWorld.equals(identity))throw Error('Cloth analytic coordinates require identity recipe transform');clothVertices+=clothSource.rest.length/3;}
    g.entries.push({object:o,appearance:p,center:c.center,cloth:clothSource,wind:h.score.motion.wind});sourceTriangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*count;
    yield 'source';
   }
  }
  for(const[key,b]of batches)if(!groups.has(key)){disposeBatch(b);batches.delete(key);}
  if(!groups.size&&library.count){library.dispose();library=createBatchMaterials();}
  for(const palette of palettes.values())for(let i=0;i<palette.rows.length;i+=MATERIAL_TABLE_SIZE){library.setTable(palette.family,palette.transparent,i/MATERIAL_TABLE_SIZE,palette.rows.slice(i,i+MATERIAL_TABLE_SIZE));yield 'palette';}
  let renderedTriangles=0,geometryBytes=0,instanceBytes=0;
  for(const[key,group]of groups){const b=allocate(key,group),g=b.geometry,usedBounds=new THREE.Box3();let offset=0,indexOffset=0,windAmplitude=0;
   yield 'allocate';
   const primitiveBounds=group.instanced?(group.source.boundingBox||new THREE.Box3().setFromBufferAttribute(group.source.attributes.position)):null;
   const writeAppearance=(n,p)=>{g.attributes.stMaterial.array[n]=p.materialIndex;};
   for(const e of group.entries){const o=e.object,p=e.appearance,source=o.geometry;
    if(group.instanced){for(let i=0;i<o.count;i++){o.getMatrixAt(i,m4);m4.premultiply(o.matrixWorld);m4.elements[12]+=e.center;b.mesh.instanceMatrix.array.set(m4.elements,offset*16);m4.fromArray(b.mesh.instanceMatrix.array,offset*16);usedBounds.union(instanceBounds.copy(primitiveBounds).applyMatrix4(m4));b.mesh.instanceColor.array.set(p.color,offset*3);writeAppearance(offset,p);offset++;if((i&127)===127)yield 'instances';}yield 'entry';continue;}
    // Scalar packing mirrors Three r170 Vector3 arithmetic exactly. Reading back
    // positions after their Float32 write keeps the conservative bounds unchanged.
    const pos=source.attributes.position,norm=source.attributes.normal,base=offset,matrix=o.matrixWorld;n3.getNormalMatrix(matrix);
    const me=matrix.elements,ne=n3.elements,rest=e.cloth?.rest;
    const sourcePosition=rest||(!pos.normalized&&!pos.isFloat16BufferAttribute&&!pos.isInterleavedBufferAttribute&&pos.itemSize===3?pos.array:null);
    const sourceNormal=!norm.normalized&&!norm.isFloat16BufferAttribute&&!norm.isInterleavedBufferAttribute&&norm.itemSize===3?norm.array:null;
    const positions=g.attributes.position.array,normals=g.attributes.normal.array,colors=g.attributes.color.array,materialIds=g.attributes.stMaterial.array;
    const motion=g.attributes.stMotion?.array,motionHeight=g.attributes.stMotionHeight?.array,bmin=usedBounds.min,bmax=usedBounds.max;
    let minY=Infinity,maxY=-Infinity;if(rest)for(let i=1;i<rest.length;i+=3){minY=Math.min(minY,rest[i]);maxY=Math.max(maxY,rest[i]);}const height=Math.max(.1,maxY-minY);
    for(let i=0;i<pos.count;i++,offset++){
     if(i&&(i&511)===0)yield 'vertices';
     const si=i*3,di=offset*3,x=sourcePosition?sourcePosition[si]:pos.getX(i),y=sourcePosition?sourcePosition[si+1]:pos.getY(i),z=sourcePosition?sourcePosition[si+2]:pos.getZ(i);
     const w=1/(me[3]*x+me[7]*y+me[11]*z+me[15]);
     positions[di]=(me[0]*x+me[4]*y+me[8]*z+me[12])*w+e.center;
     positions[di+1]=(me[1]*x+me[5]*y+me[9]*z+me[13])*w;
     positions[di+2]=(me[2]*x+me[6]*y+me[10]*z+me[14])*w;
     const px=positions[di],py=positions[di+1],pz=positions[di+2];
     bmin.x=Math.min(bmin.x,px);bmin.y=Math.min(bmin.y,py);bmin.z=Math.min(bmin.z,pz);
     bmax.x=Math.max(bmax.x,px);bmax.y=Math.max(bmax.y,py);bmax.z=Math.max(bmax.z,pz);
     // Keep normalization order, including Three's zero-length fallback.
     const sx=sourceNormal?sourceNormal[si]:norm.getX(i),sy=sourceNormal?sourceNormal[si+1]:norm.getY(i),sz=sourceNormal?sourceNormal[si+2]:norm.getZ(i);
     const nx=ne[0]*sx+ne[3]*sy+ne[6]*sz,ny=ne[1]*sx+ne[4]*sy+ne[7]*sz,nz=ne[2]*sx+ne[5]*sy+ne[8]*sz;
     const inverseLength=1/(Math.sqrt(nx*nx+ny*ny+nz*nz)||1);
     normals[di]=nx*inverseLength;normals[di+1]=ny*inverseLength;normals[di+2]=nz*inverseLength;
     colors[di]=p.color[0];colors[di+1]=p.color[1];colors[di+2]=p.color[2];materialIds[offset]=p.materialIndex;
     if(group.family==='cloth'){
      let free=0,phase=0,amp=0,freq=1,gradient=0;
      if(e.cloth){free=e.cloth.pinned?.[i]?0:Math.max(0,Math.min(1,(maxY-rest[i*3+1])/height));phase=((e.cloth.seed||0)*.173+rest[i*3]*1.8)%(2*Math.PI);amp=e.wind.amplitude;freq=e.wind.frequency;gradient=free>0&&free<1?-1/height:0;}
      const mi=offset*4;motion[mi]=free;motion[mi+1]=phase;motion[mi+2]=amp;motion[mi+3]=freq;windAmplitude=Math.max(windAmplitude,motion[mi+2]);motionHeight[offset]=gradient;
     }
    }
    const si=source.index;for(let i=0;i<(si?.count??pos.count);i++){g.index.array[indexOffset++]=base+(si?si.getX(i):i);if((i&1023)===1023)yield 'indices';}
    yield 'entry';
   }
   for(const a of Object.values(g.attributes))if(a.usage===THREE.DynamicDrawUsage){a.clearUpdateRanges();a.addUpdateRange(0,offset*a.itemSize);a.needsUpdate=true;}
   if(group.instanced){b.mesh.count=offset;b.mesh.instanceMatrix.clearUpdateRanges();b.mesh.instanceMatrix.addUpdateRange(0,offset*16);b.mesh.instanceMatrix.needsUpdate=true;b.mesh.instanceColor.clearUpdateRanges();b.mesh.instanceColor.addUpdateRange(0,offset*3);b.mesh.instanceColor.needsUpdate=true;renderedTriangles+=(group.source.index?.count??group.source.attributes.position.count)/3*offset;instanceBytes+=b.mesh.instanceMatrix.array.byteLength+b.mesh.instanceColor.array.byteLength;}
   else{g.setDrawRange(0,indexOffset);g.index.clearUpdateRanges();g.index.addUpdateRange(0,indexOffset);g.index.needsUpdate=true;renderedTriangles+=indexOffset/3;}
   // Bounds use only submitted instances/filled vertices, never spare capacity.
   // Cloth position is evaluated in the shader; enclose its full sine envelope.
   usedBounds.expandByVector(new THREE.Vector3(windAmplitude*.35+BOUNDS_PAD,BOUNDS_PAD,windAmplitude+BOUNDS_PAD));
   const sphere=usedBounds.getBoundingSphere(new THREE.Sphere());let radiusSq=0;
   // A union-box diagonal can include empty corners between buildings. Enclose
   // each real instance box / used vertex instead, without weakening the bound.
   if(group.instanced){for(let i=0;i<offset;i++){if(i&&(i&127)===0)yield 'instance-bounds';b.mesh.getMatrixAt(i,m4);instanceBounds.copy(primitiveBounds).applyMatrix4(m4).expandByScalar(BOUNDS_PAD);const dx=Math.max(Math.abs(instanceBounds.min.x-sphere.center.x),Math.abs(instanceBounds.max.x-sphere.center.x)),dy=Math.max(Math.abs(instanceBounds.min.y-sphere.center.y),Math.abs(instanceBounds.max.y-sphere.center.y)),dz=Math.max(Math.abs(instanceBounds.min.z-sphere.center.z),Math.abs(instanceBounds.max.z-sphere.center.z));radiusSq=Math.max(radiusSq,dx*dx+dy*dy+dz*dz);}}
   else{const p=g.attributes.position.array;for(let i=0;i<offset;i++){if(i&&(i&511)===0)yield 'vertex-bounds';const dx=Math.abs(p[i*3]-sphere.center.x)+windAmplitude*.35+BOUNDS_PAD,dy=Math.abs(p[i*3+1]-sphere.center.y)+BOUNDS_PAD,dz=Math.abs(p[i*3+2]-sphere.center.z)+windAmplitude+BOUNDS_PAD;radiusSq=Math.max(radiusSq,dx*dx+dy*dy+dz*dz);}}
   sphere.radius=Math.sqrt(radiusSq);
   if(group.instanced){b.mesh.boundingBox=usedBounds;b.mesh.boundingSphere=sphere;}
   else{g.boundingBox=usedBounds;g.boundingSphere=sphere;}
   b.mesh.userData.streetCulling={cell:group.cell,cellMetres,usedVertices:group.instanced?g.attributes.position.count:offset,usedInstances:group.instanced?offset:0,usedIndices:group.instanced?(g.index?.count??g.attributes.position.count):indexOffset,windAmplitude,sourceObjectIds:group.entries.map(e=>e.object.uuid)};
   geometryBytes+=bytes(g);yield 'batch';
  }
  if(renderedTriangles!==sourceTriangles)throw Error('R20 batching changed triangle count');
  Object.assign(proof,{spatialCells:new Set([...groups.values()].map(g=>g.cell)).size,sourceMeshes,batches:batches.size,materials:library.count,sourceTriangles,renderTriangles:renderedTriangles,geometryBytes,instanceBytes,clothVertices,rebuilds:++rebuilds});return proof;
 }
 function rebuild(chunks){const work=rebuildSteps(chunks);let step;do{step=work.next();}while(!step.done);return step.value;}
 return{root,proof,rebuild,rebuildSteps,allocation(){let geometryBytes=0,instanceBytes=0;const depth=new Set();for(const b of batches.values()){geometryBytes+=bytes(b.geometry);if(b.instanced)instanceBytes+=b.mesh.instanceMatrix.array.byteLength+b.mesh.instanceColor.array.byteLength;if(b.mesh.customDepthMaterial)depth.add(b.mesh.customDepthMaterial);}return{geometryBytes,instanceBytes,materials:library.count,depthMaterials:depth.size};},update(time,distance,groundY){library.update(time,distance,groundY);proof.time=time;proof.distance=distance;},dispose(){if(closed)return;closed=true;for(const b of batches.values())disposeBatch(b);batches.clear();library.dispose();root.clear();root.removeFromParent();proof.batches=0;proof.disposed=true;}};
}


// Stable spatial ownership prevents one incoming parcel from re-uploading the
// entire district or renumbering appearance-table entries in unrelated cells.
// rebuild() is the explicit synchronous oracle. request()/update() are the
// production cooperative path; existing cells remain untouched until commit.
export function createDistrictBatches({cellMetres=BATCH_CELL_METRES,budgetMs=6,maxStepsPerFrame=32768,now=()=>performance.now(),retainSource=()=>{},releaseSource=()=>{}}={}){
 if(!Number.isFinite(cellMetres)||cellMetres<44||cellMetres>66)throw Error('Street batch cells must be 44–66 metres');
 if(!Number.isFinite(budgetMs)||budgetMs<=0)throw Error('Street packing budget must be positive');
 if(!Number.isSafeInteger(maxStepsPerFrame)||maxStepsPerFrame<1)throw Error('Street packing step cap must be positive');
 const root=new THREE.Group();root.name='R20-incremental-spatial-district';
 const cells=new Map(),jobs=new Map(),versions=new Map(),coverage=new Map();let closed=false,retiredBatches=0,serial=0;
 const proof={cellMetres,spatialCells:0,frustumCulled:true,sourceMeshes:0,batches:0,materials:0,depthMaterials:0,allocatedMaterials:0,sourceTriangles:0,renderTriangles:0,instanceBytes:0,geometryBytes:0,clothVertices:0,rebuilds:0,rebuildRequests:0,cellRebuilds:0,lastRebuiltCells:[],disposedCells:0,disposedBatches:0,cells:[],clock:'Session.view.elapsed',externalMesh:false,externalImageTextures:false,
  scheduling:'synchronous',budgetMs,maxStepsPerFrame,stepCapFrames:0,budgetKind:'soft; synchronous first-coverage exceptions',pendingCells:0,pendingSources:0,cancelledJobs:0,staleCommits:0,packingSteps:0,packingMs:0,lastPackingMs:0,maxPackingMs:0,maxSliceMs:0,coverageBuilds:0,coverageMs:0,lastCoverageMs:0,maxCoverageMs:0,coverageBatches:0,coverageTriangles:0,renderedParcelIds:[],stagingGeometryBytes:0,stagingInstanceBytes:0,allocatedGeometryBytes:0,allocatedInstanceBytes:0,totalAllocatedMaterials:0,peakAllocatedGeometryBytes:0,peakAllocatedInstanceBytes:0,peakAllocatedMaterials:0,renderedRevision:0};
 const sameSources=(old,next)=>old.length===next.length&&old.every((c,i)=>c.handle===next[i].handle&&c.center===next[i].center);
 const sourceId=c=>c.handle.score.object.id;
 const retain=items=>{for(const c of items)retainSource(c.handle);};
 const release=items=>{for(const c of items)releaseSource(c.handle);};
 function groupSources(chunks){const desired=new Map();for(const c of chunks){const id=Math.floor(c.center/cellMetres);if(!desired.has(id))desired.set(id,[]);desired.get(id).push(c);}for(const items of desired.values())items.sort((a,b)=>a.center-b.center||sourceId(a).localeCompare(sourceId(b)));return desired;}
 function renderedSources(){const out=[];for(const c of cells.values())out.push(...c.sources);for(const c of coverage.values())out.push(...c.sources);return out;}
 function aggregate(){
  const totals={sourceMeshes:0,batches:0,materials:0,depthMaterials:0,sourceTriangles:0,renderTriangles:0,instanceBytes:0,geometryBytes:0,clothVertices:0},rows=[];let disposedBatches=retiredBatches;
  const add=(id,c,provisional=false)=>{const p=c.renderer.proof,depths=new Set();c.renderer.root.traverse(o=>{if(o.customDepthMaterial)depths.add(o.customDepthMaterial);});for(const key of Object.keys(totals))if(key!=='depthMaterials')totals[key]+=p[key];totals.depthMaterials+=depths.size;disposedBatches+=p.disposedBatches;rows.push({id,rebuilds:p.rebuilds,sourceChunks:c.sources.map(sourceId),batches:p.batches,materials:p.materials,depthMaterials:depths.size,geometryBytes:p.geometryBytes,instanceBytes:p.instanceBytes,provisional});};
  for(const[id,c]of cells)add(id,c);for(const[id,c]of coverage)add(c.cell,c,true);
  Object.assign(proof,totals,{allocatedMaterials:totals.materials+totals.depthMaterials,spatialCells:cells.size,disposedBatches,cells:rows.sort((a,b)=>a.id-b.id),renderedParcelIds:renderedSources().map(sourceId).sort(),coverageBatches:[...coverage.values()].reduce((n,c)=>n+c.renderer.proof.batches,0),coverageTriangles:[...coverage.values()].reduce((n,c)=>n+c.renderer.proof.renderTriangles,0)});
  queueProof();
 }
 function queueProof(){let geometryBytes=0,instanceBytes=0,materials=0,depthMaterials=0;for(const job of jobs.values()){const p=job.renderer.allocation();geometryBytes+=p.geometryBytes;instanceBytes+=p.instanceBytes;materials+=p.materials;depthMaterials+=p.depthMaterials;}Object.assign(proof,{pendingCells:jobs.size,pendingSources:[...jobs.values()].reduce((n,j)=>n+j.sources.length,0),stagingGeometryBytes:geometryBytes,stagingInstanceBytes:instanceBytes,stagingMaterials:materials,stagingDepthMaterials:depthMaterials,allocatedGeometryBytes:proof.geometryBytes+geometryBytes,allocatedInstanceBytes:proof.instanceBytes+instanceBytes,totalAllocatedMaterials:proof.allocatedMaterials+materials+depthMaterials});proof.peakAllocatedGeometryBytes=Math.max(proof.peakAllocatedGeometryBytes,proof.allocatedGeometryBytes);proof.peakAllocatedInstanceBytes=Math.max(proof.peakAllocatedInstanceBytes,proof.allocatedInstanceBytes);proof.peakAllocatedMaterials=Math.max(proof.peakAllocatedMaterials,proof.totalAllocatedMaterials);}
 function disposeRenderer(renderer){renderer.dispose();retiredBatches+=renderer.proof.disposedBatches;}
 function releaseCell(id){const c=cells.get(id);if(!c)return;disposeRenderer(c.renderer);cells.delete(id);release(c.sources);proof.disposedCells++;proof.renderedRevision++;}
 function releaseCoverage(id){const c=coverage.get(id);if(!c)return;disposeRenderer(c.renderer);coverage.delete(id);release(c.sources);proof.renderedRevision++;}
 function cancel(id){const job=jobs.get(id);if(!job)return;jobs.delete(id);versions.set(id,++serial);job.work.return();disposeRenderer(job.renderer);release(job.sources);proof.cancelledJobs++;}
 function makeRenderer(id){const renderer=createCellRenderer({cellMetres});renderer.root.name='R20-spatial-cell:'+id;return renderer;}
 function install(id,renderer,sources){const old=cells.get(id);cells.set(id,{renderer,sources});root.add(renderer.root);if(old){disposeRenderer(old.renderer);release(old.sources);}for(const[key,c]of coverage)if(c.cell===id)releaseCoverage(key);proof.cellRebuilds++;proof.lastRebuiltCells.push(id);proof.rebuilds++;proof.renderedRevision++;}
 function syncCell(id,items,coverageException=false){const old=cells.get(id);if(old&&!coverageException){retain(items);try{old.renderer.rebuild(items);}catch(e){release(items);throw e;}release(old.sources);old.sources=items.slice();proof.cellRebuilds++;proof.lastRebuiltCells.push(id);proof.rebuilds++;proof.renderedRevision++;return;}const renderer=makeRenderer(id),start=now();retain(items);try{renderer.rebuild(items);}catch(e){renderer.dispose();release(items);throw e;}install(id,renderer,items.slice());if(coverageException){const ms=now()-start;proof.coverageBuilds++;proof.lastCoverageMs+=ms;proof.coverageMs+=ms;proof.maxCoverageMs=Math.max(proof.maxCoverageMs,ms);}}
 function rebuild(chunks){
  if(closed)throw Error('District batches disposed');proof.scheduling='synchronous';delete proof.error;proof.rebuildRequests++;proof.lastRebuiltCells=[];proof.lastCoverageMs=0;const desired=groupSources(chunks);
  for(const id of [...jobs.keys()])cancel(id);for(const id of [...coverage.keys()])releaseCoverage(id);
  for(const id of [...cells.keys()])if(!desired.has(id))releaseCell(id);
  for(const[id,items]of desired){const c=cells.get(id);if(c&&sameSources(c.sources,items))continue;syncCell(id,items);}
  aggregate();return proof;
 }
 function request(chunks){
  if(closed)throw Error('District batches disposed');proof.scheduling='cooperative';delete proof.error;proof.rebuildRequests++;proof.lastRebuiltCells=[];proof.lastCoverageMs=0;const desired=groupSources(chunks),wanted=new Set(chunks.map(sourceId));
  for(const[id,job]of jobs)if(!desired.has(id)||!sameSources(job.sources,desired.get(id)))cancel(id);
  for(const id of [...cells.keys()])if(!desired.has(id))releaseCell(id);
  for(const id of [...coverage.keys()])if(!wanted.has(id))releaseCoverage(id);
  for(const[id,items]of desired){const c=cells.get(id);if(c&&sameSources(c.sources,items)){cancel(id);continue;}
   // New cells contain the instrument's real far architecture, never proxy
   // boxes. Packing these immediately is an explicitly measured coverage
   // exception, not part of the cooperative-time claim.
   if(!c){syncCell(id,items,true);continue;}
   const present=new Set(c.sources.map(sourceId));
   for(const item of items)if(!present.has(sourceId(item))&&!coverage.has(sourceId(item))){const renderer=makeRenderer(id),start=now();retain([item]);try{renderer.rebuild([item]);}catch(e){renderer.dispose();release([item]);throw e;}renderer.root.name='R20-coverage-parcel:'+sourceId(item);root.add(renderer.root);coverage.set(sourceId(item),{cell:id,renderer,sources:[item]});proof.renderedRevision++;const ms=now()-start;proof.coverageBuilds++;proof.lastCoverageMs+=ms;proof.coverageMs+=ms;proof.maxCoverageMs=Math.max(proof.maxCoverageMs,ms);}
   if(jobs.has(id))continue;
   const renderer=makeRenderer(id),version=++serial,sources=items.slice();versions.set(id,version);retain(sources);jobs.set(id,{id,version,sources,renderer,work:renderer.rebuildSteps(sources)});
  }
  aggregate();return proof;
 }
 function step(time,distance,groundY){
  const start=now(),deadline=start+budgetMs;let steps=0,changed=false;proof.lastRebuiltCells=[];
  // Oldest work completes first. Distance changes cannot repeatedly restart an
  // unchanged request. Every yield bounds arithmetic to 512 vertices / 1024
  // indices / 128 instances; allocation and GC remain soft-budget exceptions.
  while(jobs.size&&now()<deadline&&steps<maxStepsPerFrame){const job=jobs.values().next().value,sliceStart=now();let result;
   try{result=job.work.next();}catch(e){cancel(job.id);proof.error=String(e);changed=true;break;}
   const sliceMs=now()-sliceStart;proof.maxSliceMs=Math.max(proof.maxSliceMs,sliceMs);steps++;
   if(result.done){queueProof();if(jobs.get(job.id)!==job||versions.get(job.id)!==job.version){proof.staleCommits++;job.renderer.dispose();continue;}jobs.delete(job.id);job.renderer.update(time,distance,groundY);install(job.id,job.renderer,job.sources);changed=true;}
  }
  if(jobs.size&&steps===maxStepsPerFrame)proof.stepCapFrames++;
  const ms=now()-start;proof.lastPackingMs=ms;proof.packingMs+=ms;proof.maxPackingMs=Math.max(proof.maxPackingMs,ms);proof.packingSteps+=steps;
  if(changed)aggregate();else queueProof();
 }
 return{root,proof,rebuild,request,renderedSources,beginFrame(){proof.lastCoverageMs=0;proof.lastPackingMs=0;proof.lastRebuiltCells=[];},update(time,distance,groundY){if(closed)return;root.position.set(-distance,groundY,0);if(jobs.size)step(time,distance,groundY);else proof.lastPackingMs=0;for(const c of cells.values())c.renderer.update(time,distance,groundY);for(const c of coverage.values())c.renderer.update(time,distance,groundY);proof.time=time;proof.distance=distance;},dispose(){if(closed)return;closed=true;for(const id of [...jobs.keys()])cancel(id);for(const id of [...coverage.keys()])releaseCoverage(id);for(const id of [...cells.keys()])releaseCell(id);root.clear();root.removeFromParent();aggregate();proof.disposed=true;}};
}
