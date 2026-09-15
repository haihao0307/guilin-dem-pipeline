import * as W from '../source/world.mjs';
const E=W.extent,errors=[];let min=Infinity,max=-Infinity,samples=0;
function renderedGround(x,z){const i=Math.floor((x-E.xmin)/E.step),j=Math.floor((z-E.zmin)/E.step),xx=E.xmin+i*E.step,zz=E.zmin+j*E.step,u=(x-xx)/E.step,v=(z-zz)/E.step;const a=W.ground(xx,zz),b=W.ground(xx+E.step,zz),c=W.ground(xx,zz+E.step),d=W.ground(xx+E.step,zz+E.step);return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);}
for(const e of W.connections)for(let i=0;i<=200;i++){
 const p=W.waterSurfaceOnEdge(e,W.makeState(),i/200),depth=p[1]-renderedGround(p[0],p[2]);samples++;min=Math.min(min,depth);max=Math.max(max,depth);if(depth<.03||depth>.24)errors.push({edge:e.id,depth,t:i/200});
}
for(const p of W.ports){const f=W.fieldById[p.fieldId];const distance=Math.min(...f.polygon.map((q,i)=>W.segmentProjection(p.position[0],p.position[2],[...q.slice(0,1),0,q[1]],[f.polygon[(i+1)%f.polygon.length][0],0,f.polygon[(i+1)%f.polygon.length][1]]).d));if(distance>1e-6)errors.push({port:p.id,distance});}
const drops=W.connections.filter(e=>e.role==='field_spill').map(e=>({id:e.id,length:e.points.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-e.points[i][0],p[2]-e.points[i][2]),0)}));if(drops.some(e=>e.length>15))errors.push('long_cross_field_drop');
console.log(JSON.stringify({version:W.VERSION,ok:!errors.length,errors,renderedChannelDepth:{samples,min,max},portsChecked:W.ports.length,drops,visualAcceptance:false},null,2));if(errors.length)process.exit(1);
