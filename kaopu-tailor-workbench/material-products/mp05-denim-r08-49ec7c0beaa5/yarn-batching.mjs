import * as THREE from 'three';
/** Group identical material/chart/LOD draws, not fibers. Every original interval,
 * tube index, ply count, cap and shader is retained. Visibility still comes from
 * the original tile policy; no proxy surface, strand thinning or shadow proxy. */
export function batchYarnTiles(tiles,group,stats){
 const pools=new Map();let disposed=false,uploads=0;
 for(const tile of tiles){
  for(let lod=0;lod<tile.lods.length;lod++){
   const source=tile.lods[lod],material=tile.materials[lod];let pool=pools.get(material);
   if(!pool){pool={material,source,capacity:0,members:[],old:[],geometry:null,mesh:null};pools.set(material,pool);}
   if(pool.source.index!==source.index||pool.source.attributes.tubeCoordinate!==source.attributes.tubeCoordinate)throw Error('Non-identical yarn templates cannot share a draw');
   pool.capacity+=source.instanceCount;pool.members.push({tile,lod,source});
  }
  group.remove(tile.mesh);
 }
 const ensure=pool=>{
  if(pool.geometry)return;
  const geometry=new THREE.InstancedBufferGeometry();
  for(const [name,a] of Object.entries(pool.source.attributes))if(!a.isInstancedBufferAttribute)geometry.setAttribute(name,a);
  geometry.setIndex(pool.source.index);
  geometry.setAttribute('yarnInterval',new THREE.InstancedBufferAttribute(new Float32Array(pool.capacity*4),4).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('yarnEnds',new THREE.InstancedBufferAttribute(new Float32Array(pool.capacity*2),2).setUsage(THREE.DynamicDrawUsage));
  geometry.instanceCount=0;
  const mesh=new THREE.Mesh(geometry,pool.material);mesh.name='batched-original-solid-yarn';mesh.customDepthMaterial=pool.material.userData.depth;mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.visible=false;
  group.add(mesh);pool.geometry=geometry;pool.mesh=mesh;
 };
 const update=()=>{
  if(disposed)return;
  let drawCalls=0,triangles=0,instances=0,selectedTiles=0,bytes=0;
  for(const pool of pools.values()){
   const current=pool.members.filter(e=>e.tile.mesh.visible&&e.tile.mesh.geometry===e.source);
   if(current.length){ensure(pool);drawCalls++;}
   if(!pool.geometry)continue;
   const changed=current.length!==pool.old.length||current.some((x,i)=>x!==pool.old[i]);
   if(changed){let n=0;
    for(const e of current){const count=e.source.instanceCount;pool.geometry.attributes.yarnInterval.array.set(e.source.attributes.yarnInterval.array.subarray(0,count*4),n*4);pool.geometry.attributes.yarnEnds.array.set(e.source.attributes.yarnEnds.array.subarray(0,count*2),n*2);n+=count;}
    pool.geometry.instanceCount=n;for(const [name,stride]of[['yarnInterval',4],['yarnEnds',2]]){const a=pool.geometry.attributes[name];a.clearUpdateRanges();if(n)a.addUpdateRange(0,n*stride);a.needsUpdate=true;}
    pool.old=current;uploads++;
   }
   pool.mesh.visible=pool.geometry.instanceCount>0;
   instances+=pool.geometry.instanceCount;triangles+=pool.geometry.instanceCount*pool.geometry.index.count/3;selectedTiles+=current.length;
   bytes+=pool.geometry.attributes.yarnInterval.array.byteLength+pool.geometry.attributes.yarnEnds.array.byteLength;
  }
  Object.assign(stats,{batchedYarnDrawCalls:drawCalls,originalVisibleYarnDrawCalls:selectedTiles,batchedYarnTriangles:triangles,batchedYarnInstances:instances,batchIntervalStorageBytes:bytes,batchMembershipUpdates:uploads,primitiveBatching:'same templates, intervals, material and LOD; no strand removal'});
 };
 function verify(){
  let checked=0;
  for(const pool of pools.values())if(pool.geometry){let n=0;
   for(const e of pool.old){
    if(pool.geometry.index!==e.source.index)throw Error('Yarn triangle index mismatch');
    for(const [name,a]of Object.entries(e.source.attributes))if(!a.isInstancedBufferAttribute&&pool.geometry.attributes[name]!==a)throw Error('Yarn template changed');
    for(const [name,stride]of[['yarnInterval',4],['yarnEnds',2]])for(let j=0;j<e.source.instanceCount*stride;j++)if(pool.geometry.attributes[name].array[n*stride+j]!==e.source.attributes[name].array[j])throw Error('Yarn instance changed');
    n+=e.source.instanceCount;checked+=e.source.instanceCount;
   }
   if(n!==pool.geometry.instanceCount||pool.mesh.material!==pool.material||pool.mesh.customDepthMaterial!==pool.material.userData.depth)throw Error('Batch material/count mismatch');
  }
  return {passed:true,checkedInstances:checked,drawCalls:stats.batchedYarnDrawCalls,triangles:stats.batchedYarnTriangles};
 }
 return{update,verify,dispose(){if(disposed)return;disposed=true;for(const p of pools.values())if(p.geometry){group.remove(p.mesh);p.geometry.dispose();}pools.clear();}};
}
