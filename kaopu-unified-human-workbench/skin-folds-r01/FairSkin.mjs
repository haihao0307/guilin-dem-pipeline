/** Bounded normal-direction Taubin fairing on the derived display surface.
 * The canonical character, lip/eyelid contact vertices and body are untouched.
 * This removes subdivision-scale corrugation BEFORE adding tissue folds. */
export class FairSkin {
 constructor(index,mask){
  this.mask=mask;const n=mask.length,count=new Uint32Array(n);
  for(let k=0;k<index.length;k+=3)for(let j=0;j<3;j++){const a=index[k+j];if(mask[a]>0)count[a]+=2;}
  this.offsets=new Uint32Array(n+1);for(let i=0;i<n;i++)this.offsets[i+1]=this.offsets[i]+count[i];
  const cursor=this.offsets.slice();this.neighbors=new Uint32Array(this.offsets[n]);
  for(let k=0;k<index.length;k+=3)for(let j=0;j<3;j++){const a=index[k+j];if(mask[a]<=0)continue;this.neighbors[cursor[a]++]=index[k+(j+1)%3];this.neighbors[cursor[a]++]=index[k+(j+2)%3];}
  this.temp=new Float32Array(n*3);this.original=new Float32Array(n*3);this.active=[];
  for(let i=0;i<n;i++)if(mask[i]>0&&count[i])this.active.push(i);
 }
 roughness(p,normals){let sum=0,weight=0;for(const i of this.active){const k=i*3;let a=0;for(let j=this.offsets[i];j<this.offsets[i+1];j++){const q=this.neighbors[j]*3;a+=(p[q]-p[k])*normals[k]+(p[q+1]-p[k+1])*normals[k+1]+(p[q+2]-p[k+2])*normals[k+2];}a/=this.offsets[i+1]-this.offsets[i];sum+=a*a*this.mask[i];weight+=this.mask[i];}return Math.sqrt(sum/(weight||1))*1000;}
 apply(p,normals,cycles=5,cap=.00022){
  this.original.set(p);const before=this.roughness(p,normals),o=this.original;
  for(let pass=0;pass<cycles*2;pass++){
   this.temp.set(p);const coefficient=pass%2===0?.52:-.53;
   for(const i of this.active){const k=i*3;let d=0;for(let j=this.offsets[i];j<this.offsets[i+1];j++){const q=this.neighbors[j]*3;d+=(p[q]-p[k])*normals[k]+(p[q+1]-p[k+1])*normals[k+1]+(p[q+2]-p[k+2])*normals[k+2];}
    d*=coefficient*this.mask[i]/(this.offsets[i+1]-this.offsets[i]);
    for(let q=0;q<3;q++)this.temp[k+q]=p[k+q]+normals[k+q]*d;
    const dx=this.temp[k]-o[k],dy=this.temp[k+1]-o[k+1],dz=this.temp[k+2]-o[k+2],length=Math.hypot(dx,dy,dz),limit=cap*this.mask[i];
    if(length>limit){const s=limit/length;this.temp[k]=o[k]+dx*s;this.temp[k+1]=o[k+1]+dy*s;this.temp[k+2]=o[k+2]+dz*s;}
   }
   p.set(this.temp);
  }
  let max=0;for(const i of this.active){const k=i*3;max=Math.max(max,Math.hypot(p[k]-o[k],p[k+1]-o[k+1],p[k+2]-o[k+2])*1000);}
  return {activeVertices:this.active.length,maxCorrectionMM:max,capMM:cap*1000,normalLaplacianBeforeMM:before,normalLaplacianAfterMM:this.roughness(p,normals),cycles,appliedBeforeFolds:true};
 }
}
