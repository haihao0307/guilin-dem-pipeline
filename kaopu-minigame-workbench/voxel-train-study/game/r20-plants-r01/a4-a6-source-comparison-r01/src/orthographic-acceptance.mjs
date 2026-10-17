/** Fixed axis-aligned acceptance views. All dimensions are uncalibrated source units. */
export function applyAcceptanceCamera(T,camera,{view,center,worldUnitsPerPixel,width,height}){
 if(!['side','front','top'].includes(view))throw Error('UNKNOWN_ACCEPTANCE_VIEW');
 if(!(worldUnitsPerPixel>0&&width>0&&height>0))throw Error('INVALID_ACCEPTANCE_SCALE');
 const direction=new T.Vector3(...({side:[1,0,0],front:[0,0,1],top:[0,1,0]}[view]));
 camera.up.set(...(view==='top'?[0,0,-1]:[0,1,0]));
 camera.left=-width*worldUnitsPerPixel/2;camera.right=-camera.left;
 camera.top=height*worldUnitsPerPixel/2;camera.bottom=-camera.top;
 camera.near=.01;camera.far=2000;camera.position.copy(center).addScaledVector(direction,1000);camera.lookAt(center);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 camera.userData.acceptance={view,worldUnitsPerPixel,width,height,sourceUnits:'UNCALIBRATED',independentObjectFit:false};
 return camera;
}
export function projectedExtents(size,view){
 if(view==='side')return{width:size.z,height:size.y};
 if(view==='front')return{width:size.x,height:size.y};
 if(view==='top')return{width:size.x,height:size.z};
 throw Error('UNKNOWN_ACCEPTANCE_VIEW');
}
