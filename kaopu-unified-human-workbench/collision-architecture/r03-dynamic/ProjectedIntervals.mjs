/** Conservative fixed-direction intervals for LINEAR rendered vertices.
 * min(linear vertex projections) is concave; its endpoint chord is a lower
 * bound. max is convex; its endpoint chord is an upper bound. Thus these
 * interpolated intervals contain the actual triangle at every time, even when
 * both triangles deform. This filter only proves exclusions; it cannot hit.
 */
const TOL=20e-6;
function axis(t){const a=t[0],b=t[1],c=t[2],ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx,n=Math.hypot(x,y,z);return n>1e-12&&Number.isFinite(n)?[x/n,y/n,z/n]:null;}
function bounds(t,n){let min=Infinity,max=-Infinity,magnitude=0;for(let i=0;i<3;i++){const p=t[i],a=p[0]*n[0],b=p[1]*n[1],c=p[2]*n[2],v=a+b+c;min=Math.min(min,v);max=Math.max(max,v);magnitude=Math.max(magnitude,Math.abs(a)+Math.abs(b)+Math.abs(c));}return {min,max,magnitude};}
export function prepareProjectedIntervals(start,end){
 const n=axis(start);if(!n)return null;const directions=[n];
 for(let i=0;i<3;i++){const a=start[i],b=start[(i+1)%3],x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2],u=n[1]*z-n[2]*y,v=n[2]*x-n[0]*z,w=n[0]*y-n[1]*x,L=Math.hypot(u,v,w);if(L>1e-12)directions.push([u/L,v/L,w/L]);}
 return directions.map(axis=>({axis,start:bounds(start,axis),end:bounds(end,axis)}));
}
export function projectedLowerBound(start,end,prepared,limit=1){
 if(!prepared)return 0;let lo=0,hi=Math.min(1,limit);
 for(const p of prepared){const a=p.start,b=p.end,c=bounds(start,p.axis),d=bounds(end,p.axis),padding=TOL+64*Number.EPSILON*(1+a.magnitude+b.magnitude+c.magnitude+d.magnitude);
  let f0=a.min-c.max-padding,f1=b.min-d.max-padding,slope=f1-f0;
  if(slope===0){if(f0>0)return Infinity;}else if(slope>0)hi=Math.min(hi,-f0/slope);else lo=Math.max(lo,-f0/slope);if(lo>hi)return Infinity;
  f0=c.min-a.max-padding;f1=d.min-b.max-padding;slope=f1-f0;
  if(slope===0){if(f0>0)return Infinity;}else if(slope>0)hi=Math.min(hi,-f0/slope);else lo=Math.max(lo,-f0/slope);if(lo>hi)return Infinity;
 }
 return lo;
}
