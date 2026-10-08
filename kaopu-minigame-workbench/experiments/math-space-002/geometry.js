/* Original minimal geometry kernel. Signature B(p,q)=pt*qt-px*qx-pz*qz. */
(function(root){
'use strict';
const dot=(a,b)=>a[2]*b[2]-a[0]*b[0]-a[1]*b[1];
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(a,t)=>a.map(v=>v*t);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function point(r,angle,k){return k?[Math.sinh(k*r)*Math.sin(angle),-Math.sinh(k*r)*Math.cos(angle),Math.cosh(k*r)]:[r*Math.sin(angle),-r*Math.cos(angle),1];}
function distance(a,b,k){return k?Math.acosh(Math.max(1,dot(a,b)))/k:Math.hypot(a[0]-b[0],a[1]-b[1]);}
function tangent(a,b,k){if(!k){const d=distance(a,b,k);return d<1e-12?[0,-1,0]:[(b[0]-a[0])/d,(b[1]-a[1])/d,0];}const c=dot(a,b),v=add(b,mul(a,-c)),n=Math.sqrt(Math.max(0,-dot(v,v)));return n<1e-12?[0,-1,0]:mul(v,1/n);}
function exp(p,v,s,k){return k?add(mul(p,Math.cosh(k*s)),mul(v,Math.sinh(k*s))):add(p,mul(v,s));}
function transport(p,v,t,s,k){if(!k)return [...t];return add(t,mul(add(mul(p,Math.sinh(k*s)),mul(v,Math.cosh(k*s)-1)),-dot(t,v)));}
function step(frame,forward,side,distanceStep,k){const n=Math.hypot(forward,side);if(n<1e-12)return {p:[...frame.p],f:[...frame.f],r:[...frame.r]};const v=add(mul(frame.f,forward/n),mul(frame.r,side/n));const result={p:exp(frame.p,v,distanceStep,k),f:transport(frame.p,v,frame.f,distanceStep,k),r:transport(frame.p,v,frame.r,distanceStep,k)};return result;}
function turn(frame,angle){const c=Math.cos(angle),s=Math.sin(angle);return {p:[...frame.p],f:add(mul(frame.f,c),mul(frame.r,s)),r:add(mul(frame.r,c),mul(frame.f,-s))};}
function interpolate(a,b,t,k){const d=distance(a,b,k);return d<1e-10?[...a]:exp(a,tangent(a,b,k),d*t,k);}
function triangle(points,k){const sides=points.map((_,i)=>distance(points[(i+1)%3],points[(i+2)%3],k));const angles=sides.map((a,i)=>{const b=sides[(i+1)%3],c=sides[(i+2)%3];const cos=k?(Math.cosh(k*b)*Math.cosh(k*c)-Math.cosh(k*a))/(Math.sinh(k*b)*Math.sinh(k*c)):(b*b+c*c-a*a)/(2*b*c);return Math.acos(clamp(cos,-1,1));});const sum=angles.reduce((a,b)=>a+b,0);return {sides,angles,sum,defect:Math.PI-sum,area:k?(Math.PI-sum)/(k*k):.25*Math.sqrt(Math.max(0,(sides[0]+sides[1]+sides[2])*(-sides[0]+sides[1]+sides[2])*(sides[0]-sides[1]+sides[2])*(sides[0]+sides[1]-sides[2])))};}
function project(p,k){return k?[p[0]/(p[2]+1),p[1]/(p[2]+1)]:[p[0]/7.1,p[1]/7.1];}
function initial(){return {p:[0,0,1],f:[0,-1,0],r:[1,0,0]};}
function radial(p,k){return distance([0,0,1],p,k);}
root.HyperMath={dot,add,mul,point,distance,tangent,exp,transport,step,turn,interpolate,triangle,project,initial,radial};
})(globalThis);
