globalThis.document={documentElement:{dataset:{}}};

const {installOverlayTransformContract}=await import('../../site/dist/r3-8/overlay-transform-contract.js');

class Vec3{
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}
}
class Quat{
  constructor(x=0,y=0,z=0,w=1){Object.assign(this,{x,y,z,w});}
  copy(v){Object.assign(this,{x:v.x,y:v.y,z:v.z,w:v.w});return this;}
}
class Object3D{
  constructor(){this.children=[];this.userData={};this.isScene=false;}
  add(...objects){this.children.push(...objects);return this;}
}
class Mesh extends Object3D{
  constructor(){
    super();
    this.isMesh=true;
    this.position=new Vec3();
    this.scale=new Vec3(1,1,1);
    this.quaternion=new Quat();
    this.geometry={attributes:{uv:{},position:{}}};
    this.material={alphaMap:{}};
  }
}

const THREE={Object3D};
installOverlayTransformContract(THREE);

const scene=new Object3D();scene.isScene=true;
const terrain=new Mesh();
terrain.position=new Vec3(7,2,-4);
terrain.scale=new Vec3(2,3,4);
terrain.quaternion=new Quat(.1,.2,.3,.9);
scene.add(terrain);

const soil=new Mesh();
soil.userData={wenzhouSoilContextEvidence:true,visualLiftM:.045};
soil.position.y=.000045;
scene.add(soil);

const expectedY=2+.045/1000;
const passed=(
  soil.position.x===7 &&
  Math.abs(soil.position.y-expectedY)<1e-12 &&
  soil.position.z===-4 &&
  soil.scale.x===2 && soil.scale.y===3 && soil.scale.z===4 &&
  soil.quaternion.x===.1 && soil.quaternion.y===.2 && soil.quaternion.z===.3 && soil.quaternion.w===.9 &&
  soil.userData.transformInheritedFromTerrain===true &&
  document.documentElement.dataset.wenzhouOverlayTransformContract==='true'
);

if(!passed){
  console.error('overlay transform contract: FAIL',{terrain,soil});
  process.exit(1);
}
console.log('overlay transform contract: PASS');
