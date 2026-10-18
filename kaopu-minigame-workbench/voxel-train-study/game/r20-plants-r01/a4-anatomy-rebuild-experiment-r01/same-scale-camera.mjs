// Axis-aligned common orthographic projection. No model transforms are changed.
export function projectedExtents(size,view){return view==='side'?{width:size.z,height:size.y}:view==='front'?{width:size.x,height:size.y}:{width:size.x,height:size.z};}
export function applyAcceptanceCamera(T,camera,{view,center,worldUnitsPerPixel,width,height}){
 if(!['side','front','top'].includes(view)||!(worldUnitsPerPixel>0))throw Error('INVALID_CAMERA');
 camera.up.set(...(view==='top'?[0,0,-1]:[0,1,0]));camera.left=-width*worldUnitsPerPixel/2;camera.right=-camera.left;camera.top=height*worldUnitsPerPixel/2;camera.bottom=-camera.top;
 camera.near=.01;camera.far=2000;camera.position.copy(center).addScaledVector(new T.Vector3(...({side:[1,0,0],front:[0,0,1],top:[0,1,0]}[view])),1000);camera.lookAt(center);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 camera.userData.acceptance={view,worldUnitsPerPixel,width,height,sourceUnits:'UNCALIBRATED',independentObjectFit:false};return camera;
}
