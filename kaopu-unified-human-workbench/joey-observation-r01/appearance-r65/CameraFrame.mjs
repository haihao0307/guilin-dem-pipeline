/** Keep PerspectiveCamera properties and its projection matrix consistent after resize. */
export function projectionProperties(spec){
 const P=spec.projection,W=spec.width,H=spec.height;
 if(!Number.isFinite(W)||!Number.isFinite(H)||W<=0||H<=0||P.length!==4||P.some(r=>r.length!==4||!r.every(Number.isFinite)))throw Error('Invalid perspective specification');
 if(Math.abs(P[3][2]+1)>1e-12||P[3][3]!==0||P[0][0]<=0||P[1][1]<=0||Math.abs(P[0][0]*W-P[1][1]*H)>1e-8)throw Error('Unsupported perspective projection');
 const near=P[2][3]/(P[2][2]-1),far=P[2][3]/(P[2][2]+1);
 if(!(near>0&&far>near))throw Error('Invalid depth range');
 return{fov:2*Math.atan(1/P[1][1])*180/Math.PI,aspect:W/H,near,far,offsetX:P[0][2]*W/2,offsetY:-P[1][2]*H/2};
}
export function configurePerspective(camera,spec){
 const p=projectionProperties(spec);camera.clearViewOffset();camera.zoom=1;camera.filmOffset=0;Object.assign(camera,{fov:p.fov,aspect:p.aspect,near:p.near,far:p.far});
 camera.setViewOffset(spec.width,spec.height,p.offsetX,p.offsetY,spec.width,spec.height);camera.updateProjectionMatrix();return p;
}
export function assertCamera(camera,spec,tolerance=1e-10){
 const columnMajor=m=>Array.from({length:16},(_,i)=>m[i%4][Math.floor(i/4)]),difference=(got,wanted)=>Math.max(...got.map((v,i)=>Math.abs(v-wanted[i])));
 const projectionError=difference(camera.projectionMatrix.toArray(),columnMajor(spec.projection)),poseError=difference(camera.matrixWorldInverse.toArray(),columnMajor(spec.worldInverse));
 if(!Number.isFinite(projectionError)||!Number.isFinite(poseError)||projectionError>tolerance||poseError>tolerance)throw Error(`Camera changed during capture: projection ${projectionError}, pose ${poseError}`);
 return{projectionError,poseError,tolerance};
}
