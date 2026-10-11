// Opt-in host adapter. Creates no page, renderer, camera, timer or event listener.
import {createNativeWallUnitFixtures} from './wall-native.mjs';
import {pinnedDependencies} from './native-codec/codec.mjs';
export async function mountWallUnitQA({THREE,scene,createMaterialLibrary,origin=[-10,.081,10],yaw=0}={}){
  const dependencyBytes={};
  for(const dep of pinnedDependencies()){
    const url=new URL(dep.id==='host-street-materials'?'../street/materials.mjs':'./'+dep.id,import.meta.url);
    const response=await fetch(url);if(!response.ok)throw Error('Wall source read failed: '+dep.id);
    dependencyBytes[dep.id]=new Uint8Array(await response.arrayBuffer());
  }
  const fixture=await createNativeWallUnitFixtures({THREE,createMaterialLibrary,dependencyBytes,origin,yaw,
    readSampleBytes:async name=>{const r=await fetch(new URL('./native-codec/samples/'+name,import.meta.url));if(!r.ok)throw Error('Wall sample read failed: '+name);return new Uint8Array(await r.arrayBuffer());}});
  scene.add(fixture.root);return fixture;
}
