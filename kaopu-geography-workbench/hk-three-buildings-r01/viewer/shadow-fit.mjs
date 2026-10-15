// Receiver-only shadow calibration. Does not alter any material mother, measured
// geometry, light direction or tone mapping. Stable under camera movement.
export function fitDirectionalShadow(light,worldBounds,THREE){
 const box=worldBounds.clone().expandByScalar(7); // includes the authored 6 m courts
 light.updateMatrixWorld(true);light.target.updateMatrixWorld(true);light.shadow.updateMatrices(light);
 const inv=light.shadow.camera.matrixWorldInverse,ls=new THREE.Box3();
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])ls.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(inv));
 const c=light.shadow.camera,pad=1;
 c.left=ls.min.x-pad;c.right=ls.max.x+pad;c.bottom=ls.min.y-pad;c.top=ls.max.y+pad;
 c.near=Math.max(.1,-ls.max.z-2);c.far=Math.max(c.near+1,-ls.min.z+2);c.updateProjectionMatrix();
 const worldTexel=Math.max((c.right-c.left)/light.shadow.mapSize.x,(c.top-c.bottom)/light.shadow.mapSize.y);
 // Bias follows physical shadow-map resolution, rather than the previous
 // overly broad +-scene-diagonal frustum with a fixed 35 mm offset.
 light.shadow.normalBias=worldTexel*1.4;
 light.shadow.bias=-(worldTexel*.75)/(c.far-c.near);
 light.shadow.needsUpdate=true;
 return {bounds:{left:c.left,right:c.right,bottom:c.bottom,top:c.top,near:c.near,far:c.far},worldTexelM:worldTexel,normalBiasM:light.shadow.normalBias,depthBias:light.shadow.bias,mapSize:light.shadow.mapSize.toArray(),scope:'camera-independent selection bounds; receiver-only bias, unchanged mother functions'};
}
