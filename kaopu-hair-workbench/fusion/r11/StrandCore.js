/** Portable, typed-array strands and topology.
 * Selected mathematical routines adapted from:
 * Perm / src/hair/strands.py and rotational_repr.py (MIT, Chengan He 2024).
 * Digital Salon / HairGen.cpp particle topology (MIT, Digital Salon 2024).
 * Full notices in licenses/PERM-MIT.txt and DIGITAL-SALON-MIT.txt.
 * No neural network, CUDA solver or pretrained weights are included here.
 */
export function sampleTriangle(rng){const u=Math.sqrt(rng()),v=rng();return [1-u,u*(1-v),u*v]}
export function encodeStrand(points){
 if(points.length<6||points.length%3||!points.every(Number.isFinite))throw Error('A strand needs finite xyz samples');
 const n=points.length/3-1,directions=new Float32Array(n*3),lengths=new Float32Array(n);
 for(let j=0;j<n;j++){const q=j*3,dx=points[q+3]-points[q],dy=points[q+4]-points[q+1],dz=points[q+5]-points[q+2],d=Math.hypot(dx,dy,dz);lengths[j]=d;if(d>1e-12){directions[q]=dx/d;directions[q+1]=dy/d;directions[q+2]=dz/d}}
 return {root:Float32Array.from(points.slice(0,3)),directions,lengths};
}
export function integrateStrand({root,directions,lengths}){
 if(root.length!==3||directions.length!==lengths.length*3)throw Error('Strand shape mismatch');const out=new Float32Array((lengths.length+1)*3);out.set(root);
 for(let i=0;i<lengths.length;i++){const q=i*3,l=lengths[i];if(!Number.isFinite(l)||l<0)throw Error('Invalid edge length');for(let k=0;k<3;k++){const d=directions[q+k];if(!Number.isFinite(d))throw Error('Invalid direction');out[q+3+k]=out[q+k]+d*l}}
 return out;
}
/** Reflected linear boundaries, following Perm's moving-average smoother. */
export function smoothStrand(points,kernel=3){
 if(points.length%3||points.length<6)throw Error('Invalid curve');const n=points.length/3;kernel=Math.max(1,Math.min(n%2?n:n-1,Math.floor(kernel)|1));const half=kernel>>1,out=Float32Array.from(points);
 for(let i=1;i<n-1;i++)for(let k=0;k<3;k++){let sum=0;for(let j=i-half;j<=i+half;j++){sum+=j<0?2*points[k]-points[-j*3+k]:j>=n?2*points[(n-1)*3+k]-points[(2*n-j-2)*3+k]:points[j*3+k]}out[i*3+k]=sum/kernel}return out;
}
/** Digital Salon's +1/+2/+3 spring adjacency, flattened with explicit roots.
 * This is reusable simulation topology, NOT a running dynamics solver. */
export function buildSpringTopology(curves){
 const offsets=new Uint32Array(curves.length+1),roots=new Uint32Array(curves.length),pairs=[],rest=[],types=[];let offset=0;
 for(let i=0;i<curves.length;i++){const p=curves[i];if(p.length%3||p.length<6)throw Error('Invalid curve');const n=p.length/3;offsets[i]=roots[i]=offset;for(let j=0;j<n;j++)for(let step=1;step<=3;step++){if(j+step>=n)continue;pairs.push(offset+j,offset+j+step);rest.push(Math.hypot(p[(j+step)*3]-p[j*3],p[(j+step)*3+1]-p[j*3+1],p[(j+step)*3+2]-p[j*3+2]));types.push(step)}offset+=n}offsets[curves.length]=offset;
 return{offsets,rootIndices:roots,links:Uint32Array.from(pairs),restLengths:Float32Array.from(rest),linkTypes:Uint8Array.from(types),particleCount:offset,physicsRunning:false};
}
export const DETAIL_DEFAULTS={hairWave:0,hairMicroCurl:0,hairWavePeriod:28,hairDetailSmoothing:35};
/** Macro guides untouched: only a root-fixed, normal-frame detail residual.
 * This implements separate editable levels, NOT Perm's trained PCA/GAN model. */
export function applyDetailLayer(owner){
 const o=owner.detailOptions||DETAIL_DEFAULTS,wave=o.hairWave*.0001,curl=o.hairMicroCurl*.0001;if(wave===0&&curl===0){owner.detailMaxOffset=0;return}
 const {count,segments}=owner.options,per=segments+1,p=owner.latestPoints,normal=owner.n,base=new Float64Array(per*3),delta=new Float32Array(per*3),period=Math.max(.008,o.hairWavePeriod*.001),smoothing=o.hairDetailSmoothing/100;let maximum=0;
 for(let i=0;i<count;i++){
  const start=i*per*3;base.set(p.subarray(start,start+per*3));delta.fill(0);const root=owner.binding.templateRoots.subarray(i*3,i*3+3),phase=Math.sin(root[0]*47+root[2]*33)*Math.PI;let arc=0;
  for(let j=1;j<per;j++){
   const q=j*3;arc+=Math.hypot(base[q]-base[q-3],base[q+1]-base[q-2],base[q+2]-base[q-1]);if(j<2)continue;
   const a=Math.max(0,j-1)*3,b=Math.min(segments,j+1)*3,tx=base[b]-base[a],ty=base[b+1]-base[a+1],tz=base[b+2]-base[a+2],nq=(i*per+j)*6,nx=normal[nq],ny=normal[nq+1],nz=normal[nq+2];let bx=ny*tz-nz*ty,by=nz*tx-nx*tz,bz=nx*ty-ny*tx,bd=Math.hypot(bx,by,bz);if(bd<1e-12){bx=ny;by=-nx;bz=0;bd=Math.hypot(bx,by,bz)||1}bx/=bd;by/=bd;bz/=bd;
   const s=j/segments,ramp=Math.min(1,(s-.08)/.65)**1.3,f=2*Math.PI*arc/period,lateral=ramp*(wave*(Math.sin(f+phase)-Math.sin(phase))*.5+curl*Math.sin(f*2)),outward=ramp*curl*(1-Math.cos(f*2))*.5;
   delta[q]=bx*lateral+nx*outward;delta[q+1]=by*lateral+ny*outward;delta[q+2]=bz*lateral+nz*outward;
  }
  const smoothed=smoothing>0?smoothStrand(delta,3):delta;
  for(let j=2;j<per;j++){const q=j*3,nq=(i*per+j)*6;let dx=delta[q]*(1-smoothing)+smoothed[q]*smoothing,dy=delta[q+1]*(1-smoothing)+smoothed[q+1]*smoothing,dz=delta[q+2]*(1-smoothing)+smoothed[q+2]*smoothing;const signed=dx*normal[nq]+dy*normal[nq+1]+dz*normal[nq+2];if(signed<0){dx-=signed*normal[nq];dy-=signed*normal[nq+1];dz-=signed*normal[nq+2]}const length=Math.hypot(dx,dy,dz),scale=Math.min(1,.003/Math.max(1e-12,length));p[start+q]=base[q]+dx*scale;p[start+q+1]=base[q+1]+dy*scale;p[start+q+2]=base[q+2]+dz*scale;maximum=Math.max(maximum,length*scale)}
 }
 owner.detailMaxOffset=maximum;
}
