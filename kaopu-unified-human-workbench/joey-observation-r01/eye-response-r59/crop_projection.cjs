'use strict';
// Crop the existing perspective image without moving the camera or face.
function cropProjection(P,width,height,[x,y,w,h]){
 if(P.length!==16||!P.every(Number.isFinite)||![width,height,x,y,w,h].every(Number.isFinite)||w<=0||h<=0||x<0||y<0||x+w>width||y+h>height)throw Error('Invalid perspective crop');
 const sx=width/w,sy=height/h,tx=(width-2*x-w)/w,ty=(2*y+h-height)/h,Q=P.slice();
 for(let c=0;c<4;c++){Q[c*4]=sx*P[c*4]+tx*P[c*4+3];Q[c*4+1]=sy*P[c*4+1]+ty*P[c*4+3];}
 return Q;
}
module.exports={cropProjection};
