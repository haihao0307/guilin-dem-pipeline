/** Bounded, display-only Taubin fairing removes the inherited triangular cheek
 * chatter BEFORE adding folds. Source coordinates and silhouette anchors stay intact.
 * Cached CSR neighborhoods; no per-frame neighbor searches or per-vertex objects. */
export class SurfaceFairing{
 constructor(geometry,bodyCount){
  const n=geometry.attributes.position.count,A=geometry.attributes.fA.array,B=geometry.attributes.fB.array,T=geometry.attributes.csType.array;
  this.mask=new Float32Array(n);this.active=[];for(let i=bodyCount;i<n;i++){
   const face=A[i*4],lip=A[i*4+1],thin=A[i*4+2],nose=A[i*4+3],cheek=B[i*4+1],ear=B[i*4+2];
   const m=face*Math.max(0,(cheek-.10)/.90)*Math.max(0,1-4*lip)*Math.max(0,1-2*thin)*Math.max(0,1-1.3*nose)*(1-ear);
   if(T[i]<.01&&m>.01){this.mask[i]=m;this.active.push(i);}
  }
  const lists=Array.from({length:n},()=>[]),I=geometry.index.array;
  const edge=(a,b)=>{if(this.mask[a]&&T[b]<.01)lists[a].push(b);if(this.mask[b]&&T[a]<.01)lists[b].push(a);};
  for(let k=0;k<I.length;k+=3){edge(I[k],I[k+1]);edge(I[k+1],I[k+2]);edge(I[k+2],I[k]);}
  this.offset=new Uint32Array(n+1);let size=0;for(let i=0;i<n;i++){this.offset[i]=size;lists[i]=[...new Set(lists[i])];size+=lists[i].length;}this.offset[n]=size;
  this.neighbors=new Uint32Array(size);for(let i=0;i<n;i++)this.neighbors.set(lists[i],this.offset[i]);this.work=new Float32Array(n*3);this.before=new Float32Array(n*3);
 }
 apply(geometry){
  const P=geometry.attributes.position.array,A=this.work,original=this.before;original.set(P);
  for(let step=0;step<12;step++){A.set(P);const gain=step%2?-.47:.45;for(const i of this.active){const a=this.offset[i],b=this.offset[i+1],n=b-a;if(!n)continue;let x=0,y=0,z=0;for(let k=a;k<b;k++){const j=this.neighbors[k]*3;x+=A[j];y+=A[j+1];z+=A[j+2];}const u=i*3,w=gain*this.mask[i];P[u]=A[u]+(x/n-A[u])*w;P[u+1]=A[u+1]+(y/n-A[u+1])*w;P[u+2]=A[u+2]+(z/n-A[u+2])*w;}}
  let max=0,affected=0;for(const i of this.active){const u=i*3,dx=P[u]-original[u],dy=P[u+1]-original[u+1],dz=P[u+2]-original[u+2],length=Math.hypot(dx,dy,dz),cap=.00032*this.mask[i],w=Math.min(1,cap/(length||1));P[u]=original[u]+dx*w;P[u+1]=original[u+1]+dy*w;P[u+2]=original[u+2]+dz*w;if(length>1e-9)affected++;max=Math.max(max,Math.min(length,cap));}
  geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();return{method:'bounded Taubin fairing on derived cheek skin only',affectedVertices:affected,maxDeltaMM:max*1000,capMM:.32,nativeModified:false};
 }
}
