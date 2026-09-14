import * as THREE from 'three';
import {OrbitControls} from '../vendor/OrbitControls.js';
const FLAG=Symbol.for('wenzhou.eye-look-contract.v1');
/** Current runtime adapter: retain frozen terrain/camera position code unchanged. */
export function installEyeLookContract(){
  if(OrbitControls.prototype[FLAG])return;
  OrbitControls.prototype[FLAG]=true;
  const controlsByCamera=new WeakMap();
  const update=OrbitControls.prototype.update;
  OrbitControls.prototype.update=function(...args){
    controlsByCamera.set(this.object,this);
    return update.apply(this,args);
  };
  const before=THREE.Scene.prototype.onBeforeRender;
  const direction=new THREE.Vector3(),expected=new THREE.Vector3();
  THREE.Scene.prototype.onBeforeRender=function(renderer,scene,camera,...rest){
    if(typeof before==='function')before.call(this,renderer,scene,camera,...rest);
    const controls=controlsByCamera.get(camera),canvas=renderer.domElement;
    // The inherited eye mode disables OrbitControls and uses a 0.1m near plane.
    // Updating OrbitControls here would shift position / clamp pitch, so orient only.
    if(canvas?.id!=='terrain'||!controls||controls.enabled!==false||Math.abs(camera.near-.0001)>1e-10)return;
    expected.copy(controls.target).sub(camera.position);
    if(expected.lengthSq()<1e-14)return;
    expected.normalize();camera.lookAt(controls.target);camera.updateMatrixWorld(true);
    camera.getWorldDirection(direction);
    const error=direction.distanceTo(expected);
    canvas.dataset.eyeLookDirection=direction.toArray().map(v=>v.toFixed(9)).join(',');
    canvas.dataset.eyeLookDirectionError=error.toExponential(3);
    canvas.dataset.eyeLookContract='target-synchronized';
  };
}
