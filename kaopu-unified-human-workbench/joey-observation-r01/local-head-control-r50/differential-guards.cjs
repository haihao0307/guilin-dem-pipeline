'use strict';
function cross3(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function normalRows(P,J,ids,D){
 const[a,b,c]=ids,u=[0,1,2].map(k=>P[3*b+k]-P[3*a+k]),v=[0,1,2].map(k=>P[3*c+k]-P[3*a+k]),q=cross3(u,v),length=Math.hypot(...q);
 if(length<=1e-12)return null;const n=q.map(x=>x/length),rows=Array.from({length:3},()=>new Float64Array(D));
 for(let d=0;d<D;d++){const du=[0,1,2].map(k=>J[(3*b+k)*D+d]-J[(3*a+k)*D+d]),dv=[0,1,2].map(k=>J[(3*c+k)*D+d]-J[(3*a+k)*D+d]);const x=cross3(du,v),y=cross3(u,dv),dc=x.map((z,k)=>z+y[k]),dot=dc.reduce((s,z,k)=>s+z*n[k],0);for(let k=0;k<3;k++)rows[k][d]=(dc[k]-n[k]*dot)/length;}
 return{rows,area:length/2};
}
function edgeRow(P,J,a,b,D){const e=[0,1,2].map(k=>P[3*b+k]-P[3*a+k]),length=Math.hypot(...e);if(length<=1e-9)return null;const row=new Float64Array(D);for(let d=0;d<D;d++)for(let k=0;k<3;k++)row[d]+=e[k]*(J[(3*b+k)*D+d]-J[(3*a+k)*D+d])/(length*length);return{row,length};}
if(typeof module!=='undefined')module.exports={normalRows,edgeRow};else Object.assign(globalThis,{normalRows,edgeRow});
