/** Approximate sky source from the SAME packed building footprint/top AABBs.
 * Three outward horizontal rays estimate a facade-midpoint horizon. This is
 * not radiosity, full hemispherical sky visibility, rainfall or indoor detection.
 */
export const SKY_FACADES=Object.freeze(['+X','-X','+Z','-Z']);
export const SKY_NORMALS=Object.freeze([[1,0],[-1,0],[0,1],[0,-1]]);
export const SKY_FAN_DEGREES=Object.freeze([-45,0,45]);
const EPS=.02;
function enterFootprint(x,z,dx,dz,b){
 let lo=0,hi=Infinity;
 for(const [p,d,min,max]of [[x,dx,b.x-b.width/2,b.x+b.width/2],[z,dz,b.z-b.depth/2,b.z+b.depth/2]]){
  if(Math.abs(d)<1e-12){if(p<min||p>max)return null;}
  else {let a=(min-p)/d,c=(max-p)/d;if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)return null;}
 }
 return hi>0?Math.max(EPS,lo):null;
}
/** normalXZ is one of the four outward cardinal normals; y is world metres. */
export function estimateFacadeSky(buildings,building,y,normalXZ){
 const [nx,nz]=normalXZ,x=building.x+nx*(building.width/2+EPS),z=building.z+nz*(building.depth/2+EPS);
 const rays=SKY_FAN_DEGREES.map(deg=>{
  const a=deg*Math.PI/180,dx=nx*Math.cos(a)-nz*Math.sin(a),dz=nx*Math.sin(a)+nz*Math.cos(a);let horizon=0,blocker=null,distance=null;
  for(const other of buildings){if(other.id===building.id||other.top<=y)continue;const t=enterFootprint(x,z,dx,dz,other);if(t===null)continue;const angle=Math.atan2(other.top-y,t);if(angle>horizon){horizon=angle;blocker=other.id;distance=t;}}
  // Integral of cos(altitude) from horizon to zenith, normalized by open sky.
  return {azimuthDegrees:deg,sky:Math.max(0,Math.min(1,1-Math.sin(horizon))),horizonRadians:horizon,blocker,distanceM:distance};
 });
 return {value:rays.reduce((s,r)=>s+r.sky,0)/rays.length,sampleM:[x,y,z],rays};
}
export function deriveFacadeExposure(buildings,building,y){return SKY_NORMALS.map(n=>estimateFacadeSky(buildings,building,y,n).value);}
