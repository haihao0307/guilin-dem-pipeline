/** Independent faceted-solid geometry study, not a geological reconstruction.
 * Plane constraints represent genuine closed 3D solids, including undersides.
 * max(n dot p - d) has a correct inside/outside sign for this convex solid,
 * but is not an exact Euclidean signed distance outside corners.
 */
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const n=Math.hypot(...a);if(n<1e-12)throw Error('Zero normal');return a.map(v=>v/n);};
function hash(n){n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return((n^(n>>>16))>>>0)/4294967296;}
export function planeConstraintValue(planes,p){return Math.max(...planes.map(q=>dot(q.normal,p)-q.offset));}
export function buildConvexSolid(planes){
 if(!Array.isArray(planes)||planes.length<4||planes.length>32)throw Error('Require 4 to 32 planes');
 const P=planes.map(q=>{if(!Array.isArray(q.normal)||q.normal.length!==3||!q.normal.every(Number.isFinite)||!Number.isFinite(q.offset))throw Error('Invalid plane');
  const length=Math.hypot(...q.normal);return {normal:norm(q.normal),offset:q.offset/length};});
 const vertices=[],eps=1e-8;
 for(let a=0;a<P.length;a++)for(let b=a+1;b<P.length;b++)for(let c=b+1;c<P.length;c++){
  const A=P[a],B=P[b],C=P[c],bc=cross(B.normal,C.normal),ca=cross(C.normal,A.normal),ab=cross(A.normal,B.normal),det=dot(A.normal,bc);
  if(Math.abs(det)<1e-10)continue;
  const p=bc.map((v,i)=>(v*A.offset+ca[i]*B.offset+ab[i]*C.offset)/det);
  if(planeConstraintValue(P,p)>eps)continue;
  if(!vertices.some(v=>Math.hypot(...p.map((x,i)=>x-v[i]))<eps*10))vertices.push(p);
 }
 if(vertices.length<4)throw Error('Empty or degenerate convex solid');
 const faces=[],indices=[];
 for(let k=0;k<P.length;k++){
  const {normal:n,offset:d}=P[k],ids=vertices.map((p,i)=>Math.abs(dot(n,p)-d)<eps*10?i:-1).filter(i=>i>=0);
  if(ids.length<3)continue;
  const center=[0,0,0];for(const i of ids)for(let j=0;j<3;j++)center[j]+=vertices[i][j]/ids.length;
  const helper=Math.abs(n[0])<.8?[1,0,0]:[0,1,0],u=norm(cross(helper,n)),v=cross(n,u);
  ids.sort((a,b)=>{const A=vertices[a].map((x,i)=>x-center[i]),B=vertices[b].map((x,i)=>x-center[i]);return Math.atan2(dot(A,v),dot(A,u))-Math.atan2(dot(B,v),dot(B,u));});
  faces.push({planeIndex:k,vertexIds:ids,normal:n});
  for(let i=1;i<ids.length-1;i++)indices.push([ids[0],ids[i],ids[i+1]]);
 }
 // Reject unbounded inputs by checking every edge has two incident oriented faces.
 const counts=new Map();for(const t of indices)for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':'),e=counts.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;counts.set(key,e);}
 if([...counts.values()].some(([count,winding])=>count!==2||winding!==0))throw Error('Planes do not form a closed orientable solid');
 return {vertices,indices,faces,planes:P,fieldMeaning:'signed half-space constraint; not exact distance',geologicallyCalibrated:false};
}
export function createFractureStudy({seed=8071,center=[0,1,0],halfSize=[3.2,1.9,2.4]}={}){
 if(!Number.isInteger(seed)||seed<0||seed>4294967295||!Array.isArray(center)||center.length!==3||!center.every(Number.isFinite)||!Array.isArray(halfSize)||halfSize.length!==3||!halfSize.every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid solid profile');
 const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],
 [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[0,1,1],[0,1,-1],[0,-1,1],[0,-1,-1],[1,0,1],[1,0,-1],[-1,0,1],[-1,0,-1],[.35,.9,.25]];
 const planes=directions.map((q,i)=>{
  const n=norm(q),s=n.map((v,j)=>v/halfSize[j]),length=Math.hypot(...s),normal=s.map(v=>v/length);
  const radius=i<6?.9+.12*hash(seed+i*991):i===18?.76:1.10+.16*hash(seed+i*997);
  return {normal,offset:radius/length+dot(normal,center)};
 });
 return {...buildConvexSolid(planes),seed,center:[...center],halfSize:[...halfSize],process:'bounded fracture-plane shape study',version:'0.1.0'};
}
