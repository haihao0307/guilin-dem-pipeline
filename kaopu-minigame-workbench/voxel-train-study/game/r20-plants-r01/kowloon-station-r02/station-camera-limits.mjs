import{boundCameraPose as originalBound,getFocusBounds}from'../camera-presets.mjs';
export{getFocusBounds};
// Expanded station context, reusing the existing camera safety calculation.
export const CAMERA_LIMITS=Object.freeze({minHeight:.7,minRadius:5.5,maxRadius:420,minTargetHeight:.35,maxTargetHeight:65,minTargetX:-700,maxTargetX:320,minTargetZ:-300,maxTargetZ:300,minPhi:.12,maxPhi:1.50,minZoom:.4,maxZoom:3,trainClearance:{min:[-62,-.5,-1.9],max:[6,4.8,1.9]}});
export const boundCameraPose=(position,target)=>originalBound(position,target,CAMERA_LIMITS);
