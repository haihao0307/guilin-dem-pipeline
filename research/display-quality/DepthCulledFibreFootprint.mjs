import {rectangularFibreQueryShaders} from './ConservativeFibreQueryFootprint.mjs';

// Only an execution bound: a fragment may be rejected by the existing opaque
// depth buffer when the entire padded source-fibre AABB is farther away. This
// does not create a strand mesh, alter a root or lower its solver budget.
export function depthCulledFibreQueryShaders(...args){
 const source=rectangularFibreQueryShaders(...args);let vertex=source.vertex;
 function replace(a,b){if(vertex.split(a).length!==2)throw Error('Depth-culled source footprint changed: '+a.slice(0,90));vertex=vertex.replace(a,b);}
 replace('lo-=pad;hi+=pad;\n vec2 low=',`lo-=pad;hi+=pad;
 // Any normalized view ray intersecting this AABB travels at least this far.
 // The depth conversion itself loses precision near the near plane, so its
 // margin must scale with the far distance as well as world-coordinate size.
 // Unbounded or non-finite inputs take the always-visible path instead.
 float conservativeClip=-1.;
 if(uCameraFar>=.001&&uCameraFar<=1.e8&&
    all(lessThanEqual(abs(uEye),vec3(1.e7)))&&
    all(lessThanEqual(abs(lo),vec3(1.e7)))&&
    all(lessThanEqual(abs(hi),vec3(1.e7)))){
   vec3 separation=max(max(lo-uEye,uEye-hi),vec3(0.));
   float magnitude=max(length(uEye),max(length(lo),length(hi)));
   float margin=max(.10,max(2.e-5*magnitude,1.e-6*uCameraFar));
   float nearestPossible=max(0.,length(separation)-margin);
   conservativeClip=2.*clamp(nearestPossible/uCameraFar,0.,1.)-1.;
 }
 vec2 low=`);
 replace('gl_Position=vec4(pixel/uSize*2.-1.,0.,1.);',
  'gl_Position=vec4(pixel/uSize*2.-1.,conservativeClip,1.);');
 return{...source,vertex};
}
