/* Rock geometry candidate 0.1.0. Closed half-space solids derived from reference
   silhouettes. No measured geology, external mesh, or image-based material. */
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const normal=v=>{let d=Math.hypot(...v);return v.map(x=>x/d)};
export const COAST_BOUNDS=Object.freeze([-50,46,-42,42]);
export const COAST_GRID=Object.freeze([216,168]);
export function shore(z){return 8.2+1.35*Math.sin(z*.105)+.8*Math.sin(z*.26+.8);}
export function sandBed(x,z){const d=x-shore(z);return .105*d+.095*Math.sin(z*.19)*Math.exp(-d*d/400)+.012*Math.sin(z*5.1+x*.8)*Math.sin(x*1.8);}
function makeRock(x,z,rx,rz,h,angle,id){
 const ca=Math.cos(angle),sa=Math.sin(angle),cy=sandBed(x,z)+h*.37;
 // Unequal joint planes and beveled corners create broad faces and a low crown.
 const local=[[1,.09,0,1],[-1,.20,.02,.93],[.05,.08,1,.92],[-.06,.18,-1,1.04],
 [.10,1,.13,.77],[-.14,-1,.03,1.10],[.68,.53,.76,1.22],[-.68,.49,.66,1.16],
 [.62,.55,-.72,1.23],[-.79,.53,-.62,1.25],[-.15,1,-.42,.91],[.71,-.25,.64,1.21]];
 const planes=local.map(([a,b,c,d],j)=>{d*=1+.032*Math.sin(id*3.7+j*2.9);const n=[(ca*a)/rx-(sa*c)/rz,b/(h*.60),(sa*a)/rx+(ca*c)/rz];const m=Math.hypot(...n);return {n:n.map(v=>v/m),d:d/m};});
 const vertices=[];
 for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){
  const a=planes[i],b=planes[j],c=planes[k],bc=cross(b.n,c.n),det=dot(a.n,bc);if(Math.abs(det)<1e-8)continue;
  const ca=cross(c.n,a.n),ab=cross(a.n,b.n),p=bc.map((v,l)=>(a.d*v+b.d*ca[l]+c.d*ab[l])/det);
  if(planes.every(q=>dot(q.n,p)<=q.d+1e-7)&&!vertices.some(q=>Math.hypot(...p.map((v,l)=>v-q[l]))<1e-6))vertices.push(p);
 }
 const faces=[];
 for(const p of planes){let ring=vertices.filter(v=>Math.abs(dot(p.n,v)-p.d)<1e-6);if(ring.length<3)continue;let center=[0,0,0];for(const v of ring)for(let i=0;i<3;i++)center[i]+=v[i]/ring.length;const u=normal(cross(p.n,Math.abs(p.n[1])<.9?[0,1,0]:[1,0,0])),v=cross(p.n,u);ring=ring.sort((a,b)=>Math.atan2(dot(a.map((x,i)=>x-center[i]),v),dot(a.map((x,i)=>x-center[i]),u))-Math.atan2(dot(b.map((x,i)=>x-center[i]),v),dot(b.map((x,i)=>x-center[i]),u)));faces.push({normal:p.n,vertices:ring.map(v=>[v[0]+x,v[1]+cy,v[2]+z])});}
 return {x,z,y:cy,rx,rz,h,id,planes,faces,vertices:vertices.map(v=>[v[0]+x,v[1]+cy,v[2]+z]),xmin:Math.min(...vertices.map(v=>v[0]+x)),xmax:Math.max(...vertices.map(v=>v[0]+x)),zmin:Math.min(...vertices.map(v=>v[2]+z)),zmax:Math.max(...vertices.map(v=>v[2]+z))};
}
// A few unequal primary boulders, fractured companions and low detached blocks.
export const ROCKS=[makeRock(6.7,10,3.2,2.65,2.85,.31,1),makeRock(10.15,12.5,2.1,2.6,1.65,-.4,2),makeRock(3.0,-12.5,2.1,1.65,1.55,.65,3),makeRock(13,-17,3.6,2.9,2.75,-.26,4),makeRock(16,-13,2.35,1.5,1.3,.18,5),makeRock(23,15,1.25,1,1.05,.7,6),makeRock(10.3,7.8,.95,1.1,.72,-.9,7),makeRock(16.8,-19,1.3,1.8,1.2,-.5,8),makeRock(7.0,31,2.5,2.0,2.05,.4,9),makeRock(11.4,33,1.45,1.3,1.12,.7,10)];
export function rockTop(x,z,r){if(x<r.xmin||x>r.xmax||z<r.zmin||z>r.zmax)return -1e6;let lo=-1e6,hi=1e6;for(const p of r.planes){const b=p.d-p.n[0]*(x-r.x)-p.n[2]*(z-r.z),a=p.n[1];if(a>1e-9)hi=Math.min(hi,b/a);else if(a< -1e-9)lo=Math.max(lo,b/a);else if(b<0)return -1e6;}return hi>=lo?hi+r.y:-1e6;}
export function bed(x,z){let y=sandBed(x,z);for(const r of ROCKS)y=Math.max(y,rockTop(x,z,r));return y;}
export function rockInside(p,r,tolerance=0){return r.planes.every(q=>dot(q.n,[p[0]-r.x,p[1]-r.y,p[2]-r.z])<=q.d+tolerance);}
export const FIRE=Object.freeze([17,sandBed(17,-5.5)+.18,-5.5]);
