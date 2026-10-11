// CPU visibility probes against the actual submitted district triangles.
// This checks submitted geometry and reproduces the cloth shader at the given time;
// it does not claim pixel-level raster visibility or test hidden replacement scenes.
import * as THREE from '../../../vendor/three.module.js';
export function photoTargets(pose) {
 const {min,max}=pose.focusBounds,points=[];
 for(let i=0;i<=4;i++)for(const y of [min[1],(min[1]+max[1])/2,max[1]])for(const z of [min[2],max[2]])
  points.push([min[0]+(max[0]-min[0])*i/4,y,z]);
 return points;
}
export function streetVisibilityProbe(root,timeSeconds=10) {
 root.updateMatrixWorld(true);
 const mesh=[],clones=[],materials=new Map(),raycaster=new THREE.Raycaster();
 root.traverse(o=>{if(!o.isMesh)return;
  for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!materials.has(m))materials.set(m,m.side);m.side=THREE.DoubleSide;}
  // Raycaster cannot execute vertex shaders. Mirror the production cloth
  // position formula on a test-only geometry clone, never the actual scene.
  const motion=o.geometry.attributes.stMotion;
  if(motion){
   if(o.isInstancedMesh)throw Error('Add instanced cloth shader support before accepting this visibility proof');
   const geometry=o.geometry.clone(),p=geometry.attributes.position;
   for(let i=0;i<p.count;i++){
    const free=motion.getX(i),phase=timeSeconds*motion.getW(i)*6.28318530718+motion.getY(i),amp=motion.getZ(i);
    p.setX(i,p.getX(i)+Math.sin(phase)*amp*.35*free);
    p.setZ(i,p.getZ(i)+Math.sin(phase+.3)*amp*free*free);
   }
   geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const copy=new THREE.Mesh(geometry,o.material);copy.name=o.name;copy.matrixAutoUpdate=false;copy.matrixWorld.copy(o.matrixWorld);mesh.push(copy);clones.push(geometry);
  }else mesh.push(o);
 });
 return {count:mesh.length,firstHit(from,target){
  const origin=new THREE.Vector3(...from),delta=new THREE.Vector3(...target).sub(origin),far=delta.length();
  raycaster.set(origin,delta.normalize());raycaster.near=0;raycaster.far=far-1e-5;
  const first=raycaster.intersectObjects(mesh,false)[0];
  return first?{kind:'submitted-triangle',name:first.object.name,distance:first.distance,point:first.point.toArray()}:null;
 },dispose(){for(const [material,side] of materials)material.side=side;for(const geometry of clones)geometry.dispose();}};
}
