// A6 continuous authored form. These station values are independent design
// dimensions constrained by the retained 88 mechanical and loading envelope.
// Natural cubic interpolation supplies C2 continuity between stations.
export const A6_FORM_STATIONS=Object.freeze([
 [-8.54,1.245,1.74,3.865,15],[-8.32,1.278,1.76,3.915,15],[-7.62,1.295,1.78,3.957,15],[-6.34,1.295,1.80,3.962,15],
 [-5.1,1.340,1.86,3.962,8],[-3.4,1.325,1.82,3.962,3.8],[-1.2,1.295,1.79,3.948,2.6],[.45,1.255,1.77,3.901,2.3],
 [1.55,1.180,1.70,3.786,2.2],[2.50,1.055,1.57,3.545,2.1],[3.35,.880,1.39,3.015,2],[3.98,.690,1.34,2.215,2],[4.45,.490,1.34,1.710,2]
]);
function spline(rows,k){const n=rows.length,x=rows.map(r=>r[0]),a=rows.map(r=>r[k]),h=x.slice(1).map((v,i)=>v-x[i]),l=Array(n).fill(0),mu=Array(n).fill(0),z=Array(n).fill(0),c=Array(n).fill(0),b=Array(n-1),d=Array(n-1);l[0]=1;for(let i=1;i<n-1;i++){l[i]=2*(x[i+1]-x[i-1])-h[i-1]*mu[i-1];mu[i]=h[i]/l[i];z[i]=(3*(a[i+1]-a[i])/h[i]-3*(a[i]-a[i-1])/h[i-1]-h[i-1]*z[i-1])/l[i]}l[n-1]=1;for(let j=n-2;j>=0;j--){c[j]=z[j]-mu[j]*c[j+1];b[j]=(a[j+1]-a[j])/h[j]-h[j]*(c[j+1]+2*c[j])/3;d[j]=(c[j+1]-c[j])/(3*h[j])}const fn=t=>{let i=0;while(i<n-2&&t>x[i+1])i++;const q=Math.max(x[0],Math.min(x[n-1],t))-x[i];return{value:a[i]+b[i]*q+c[i]*q*q+d[i]*q*q*q,slope:b[i]+2*c[i]*q+3*d[i]*q*q,curvature:2*c[i]+6*d[i]*q}};fn.segments=x.slice(0,-1).map((v,i)=>({x0:v,x1:x[i+1],a:a[i],b:b[i],c:c[i],d:d[i]}));return fn}
const F=[1,2,3,4].map(k=>spline(A6_FORM_STATIONS,k));
export function a6Section(x){const q=F.map(f=>f(x));return{halfWidth:q[0].value,lower:q[1].value,crown:q[2].value,exponent:q[3].value,crownSlope:q[2].slope,crownCurvature:q[2].curvature}}
export function a6Surface(x,theta,offset=0){const q=a6Section(x),u=Math.max(0,Math.sin(theta)),sign=Math.cos(theta)>=0?1:-1,y=sign*q.halfWidth*Math.sqrt(Math.max(0,1-u**q.exponent)),z=q.lower+(q.crown-q.lower)*u;const ny=2*y/(q.halfWidth*q.halfWidth),nz=q.exponent*u**(q.exponent-1)/(q.crown-q.lower),n=Math.hypot(ny,nz)||1;return[x,y+offset*ny/n,z+offset*nz/n]}
export function a6RoofZM(x,y){const q=a6Section(x);return q.lower+(q.crown-q.lower)*Math.max(0,1-(y/q.halfWidth)**2)**(1/q.exponent)}
export function a6SideYM(x,z,side=1){const q=a6Section(x),u=Math.max(0,Math.min(1,(z-q.lower)/(q.crown-q.lower)));return side*q.halfWidth*Math.sqrt(Math.max(0,1-u**q.exponent))}
export function a6Implicit(x,y,z){const q=a6Section(x);return (y/q.halfWidth)**2+Math.max(0,(z-q.lower)/(q.crown-q.lower))**q.exponent-1}
export function a6Normal(x,y,z){const e=.0001,fx=(a6Implicit(x+e,y,z)-a6Implicit(x-e,y,z))/(2*e),q=a6Section(x),u=Math.max(0,(z-q.lower)/(q.crown-q.lower)),fy=2*y/(q.halfWidth*q.halfWidth),fz=q.exponent*u**(q.exponent-1)/(q.crown-q.lower),n=Math.hypot(fx,fy,fz);return[fx/n,fy/n,fz/n]}
export const A6_BODY_BINDINGS=Object.freeze({shellRangeXM:[-6.34,4.45],cabRangeXM:[-8.54,-6.34],driverSkirtRangeXM:[-5.55,1.35],minimumMovingPartGapM:.035,removableCoverThicknessM:.018,accessRequiredFor:['three main rods and crossheads','all driven crank pins','all brake upper pivots and longitudinal pull rods','cab regulator and pressure takeoffs','boiler cladding mounts and unknown external service interfaces']});

export function a6ProfileGLSL(){const f=n=>Number(n).toFixed(10);return 'vec2 coatingShellProfile(float x){'+F[1].segments.map((s,i)=>{const t=F[2].segments[i];return (i<F[1].segments.length-1?'if(x<='+f(s.x1)+')':'')+'{float q=clamp(x,'+f(A6_FORM_STATIONS[0][0])+','+f(A6_FORM_STATIONS.at(-1)[0])+')-('+f(s.x0)+');return vec2('+f(s.a)+','+f(t.a)+')+q*(vec2('+f(s.b)+','+f(t.b)+')+q*(vec2('+f(s.c)+','+f(t.c)+')+q*vec2('+f(s.d)+','+f(t.d)+')));}' }).join('')+'}'}
