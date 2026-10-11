import {buildWallUnit} from './wall-unit.mjs';
// Opt-in hook for the EXISTING game's QA scene. No page, renderer, camera,
// input handlers, animation loop, or default route mutation is created here.
export function createWallUnitFixtures({THREE,createMaterialLibrary,origin=[0,0,0],yaw=0}={}){
  if(typeof createMaterialLibrary!=='function')throw Error('Supply the existing KST1 material factory');
  const materials=createMaterialLibrary(THREE,{performance:{limits:{maxMaterials:24}}});
  const root=new THREE.Group();root.name='Opt-in native wall-unit fixtures';root.position.fromArray(origin);root.rotation.y=yaw;
  const handles=[];
  try{for(const [i,kind] of ['plaster-window','tile-door','cage-window'].entries()){
    const handle=buildWallUnit({kind,object:{id:'wall-fixture-'+kind,seed:1980+i},placement:{position:[(i-1)*3.2,0,0],yaw:0}},{THREE,materials});handles.push(handle);root.add(handle.root);
  }}catch(e){for(const h of handles)h.dispose();materials.dispose();throw e;}
  return{root,handles,sourceMaterials:materials,
    update(time,world={}){for(const h of handles)h.update(time,world);},
    measure(){root.updateWorldMatrix(true,true);const box=new THREE.Box3().setFromObject(root);return{bounds:{min:box.min.toArray(),max:box.max.toArray()},units:handles.map(h=>h.measure()),textures:0};},
    dispose(){for(const h of handles)h.dispose();materials.dispose();root.removeFromParent();root.clear();}};
}
