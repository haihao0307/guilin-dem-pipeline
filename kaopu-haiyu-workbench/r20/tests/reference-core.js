/* Marine Feather teaching reconstruction R06. Source: @yuruyurau,
 * https://x.com/yuruyurau/status/2100230050063024467
 * Stages 1-4 follow user-supplied teaching screenshots; 5 follows author code.
 * Coordinates are screen units, time is the author's dimensionless t. */
(function(root){
  'use strict';
  const N=20000, STEP=Math.PI/30, PERIOD_FRAMES=480;
  function point(stage,i,t){
    const y=i/598,e=y/5-11,k=(5+Math.sin(y))*Math.cos(i/7);
    const d=Math.sqrt(k*k+e*e)/.6-6;
    let q,c;
    if(stage===1){q=120+10*Math.sin(y);c=y*.3-t/8;}
    else {
      q=stage===2 ? 99+d*1.5 : 99+d*Math.sin(t-d);
      c=d/4-t/8;
      if(stage>=4)q+=y/23*k*(3*Math.sin(e)+e*Math.sin(e*2)+Math.sin(d*4));
      if(stage===5)c+=Math.cos(t+e)/9;
    }
    return [q*Math.sin(c)+200,q*Math.cos(c)+200];
  }
  function frame(stage,t,out){
    if(!Number.isInteger(stage)||stage<1||stage>5||!Number.isFinite(t))throw Error('Invalid stage/time');
    out=out||new Float64Array(N*2);
    let j=0;
    for(let i=N-1;i>=0;i--){const p=point(stage,i,t);out[j++]=p[0];out[j++]=p[1];}
    return out;
  }
  const api={N,STEP,PERIOD_FRAMES,point,frame};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MarineCore=api;
})(typeof window==='undefined'?globalThis:window);
