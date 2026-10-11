import {decode,verifyDependencyBytes} from './native-codec/codec.mjs';
import {buildWallUnit} from './wall-unit.mjs';
// Decode does not execute file-supplied code or fetch resources. Dependency
// bytes must be read by the host from its own fixed, trusted module locations.
export async function loadNativeWall(bytes,{THREE,materials,dependencyBytes}={}){
  await verifyDependencyBytes(dependencyBytes);
  const score=await decode(bytes),wall=buildWallUnit(score,{THREE,materials});
  wall.proof.nativeContainer={format:'SQLite 3',profile:'kaopu.functional-wall/0.1-experimental',dependencyPinsVerified:true,decoded:true};
  return wall;
}
export async function replaceNativeWall(previous,bytes,context){
  // Failure before a complete candidate exists leaves the current wall intact.
  const candidate=await loadNativeWall(bytes,context);
  const parent=previous?.root?.parent;
  try{if(parent)parent.add(candidate.root);candidate.measure();}catch(e){candidate.dispose();throw e;}
  previous?.dispose();return candidate;
}
export const NATIVE_WALL_SAMPLE_NAMES=Object.freeze(['plaster-window.KaoPu','tile-door.KaoPu','cage-window.KaoPu']);
export async function createNativeWallUnitFixtures({THREE,createMaterialLibrary,readSampleBytes,dependencyBytes,origin=[0,0,0],yaw=0}={}){
  if(typeof createMaterialLibrary!=='function'||typeof readSampleBytes!=='function')throw Error('Supply native host material factory and fixed sample-byte reader');
  await verifyDependencyBytes(dependencyBytes);
  const materials=createMaterialLibrary(THREE,{performance:{limits:{maxMaterials:24}}});
  const root=new THREE.Group();root.name='Native SQLite wall-unit QA fixtures';root.position.fromArray(origin);root.rotation.y=yaw;
  const handles=[];
  try{for(const [i,name]of NATIVE_WALL_SAMPLE_NAMES.entries()){
    const wall=await loadNativeWall(await readSampleBytes(name),{THREE,materials,dependencyBytes});
    const holder=new THREE.Group();holder.name='Display-only offset '+name;holder.position.x=(i-1)*3.2;holder.add(wall.root);root.add(holder);handles.push(wall);
  }}catch(e){for(const h of handles)h.dispose();materials.dispose();root.clear();throw e;}
  return{root,handles,sourceMaterials:materials,
    update(time,world={}){for(const wall of handles)wall.update(time,world);},
    measure(){root.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(root);return{bounds:{min:b.min.toArray(),max:b.max.toArray()},units:handles.map(h=>h.measure()),nativeObjects:handles.length,textures:0};},
    dispose(){for(const h of handles)h.dispose();materials.dispose();root.removeFromParent();root.clear();}};
}
