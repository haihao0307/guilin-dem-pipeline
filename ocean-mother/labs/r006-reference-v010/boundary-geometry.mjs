/** Closed diagnostic geometry only. No material or physics validity is implied. */
export function buildClosedBed({nx,nz,bounds,bottom,heightAt}){
  if(!Number.isInteger(nx)||nx<1||!Number.isInteger(nz)||nz<1||!Number.isFinite(bottom)||
    !Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite)||bounds[0]>=bounds[1]||bounds[2]>=bounds[3]||typeof heightAt!=='function')throw Error('Invalid bed geometry input');
  const vertices=[],indices=[];
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const x=bounds[0]+(bounds[1]-bounds[0])*i/nx,z=bounds[2]+(bounds[3]-bounds[2])*j/nz,y=heightAt(x,z);
    if(!Number.isFinite(y)||y<=bottom)throw Error('Bed must remain above finite bottom');vertices.push([x,y,z]);}
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.push([a,c,b],[b,c,d]);}
  const topVertexCount=vertices.length,topTriangleCount=indices.length;
  const edges=new Map();
  for(const t of indices)for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}
  const bottomIds=new Map();
  for(const [a,b]of edges.values())for(const id of [a,b])if(!bottomIds.has(id)){bottomIds.set(id,vertices.length);vertices.push([vertices[id][0],bottom,vertices[id][2]]);}
  const center=vertices.length;vertices.push([(bounds[0]+bounds[1])/2,bottom,(bounds[2]+bounds[3])/2]);
  for(const [a,b]of edges.values()){const A=bottomIds.get(a),B=bottomIds.get(b);indices.push([b,a,A],[b,A,B],[center,B,A]);}
  return {vertices,indices,topVertexCount,topTriangleCount,perimeterSegmentCount:edges.size,
    scope:'diagnostic solid; not a liquid interface or collider solver'};
}
export function inspectClosedMesh({vertices,indices}){
  const edges=new Map();let signedVolume=0,degenerate=0;
  for(const [a,b,c]of indices){const A=vertices[a],B=vertices[b],C=vertices[c];if(!A||!B||!C)throw Error('Invalid index');
    const u=B.map((x,i)=>x-A[i]),v=C.map((x,i)=>x-A[i]);const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if(Math.hypot(...cross)<1e-12)degenerate++;
    signedVolume+=(A[0]*(B[1]*C[2]-B[2]*C[1])+A[1]*(B[2]*C[0]-B[0]*C[2])+A[2]*(B[0]*C[1]-B[1]*C[0]))/6;
    for(const [x,y]of [[a,b],[b,c],[c,a]]){const key=[Math.min(x,y),Math.max(x,y)].join(':'),e=edges.get(key)||{count:0,winding:0};e.count++;e.winding+=x<y?1:-1;edges.set(key,e);}}
  const openEdges=[...edges.values()].filter(e=>e.count===1).length;
  const nonManifoldEdges=[...edges.values()].filter(e=>e.count!==2).length;
  const orientationErrors=[...edges.values()].filter(e=>e.count===2&&e.winding!==0).length;
  return {openEdges,nonManifoldEdges,orientationErrors,degenerateTriangles:degenerate,signedVolumeM3:signedVolume,
    closed:!nonManifoldEdges&&!orientationErrors&&!degenerate&&signedVolume>0};
}
