// Temporal articulation only. Geometry, source weights and pivots are measured
// separately. Rates/angles are bounded engineering settings, not field data.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),TAU=Math.PI*2;
const supported=new Set(['barracuda','tuna-yellow-label','tuna-blue-label']);
export function create(id,seed=90401,index=0,maxAngle=.03){
 const h=((seed+Math.imul(index+1,7411))>>>0),phase=(h%997)/997*TAU;
 return {id,index,time:0,phase,frequency:.78+(h%113)/113*.24,maxAngle,enabled:supported.has(id),effort:0,jawValue:0,gillValue:0,output:{lower:0,upper:0,gill:0,status:supported.has(id)?'SOURCE_BOUND_ARTICULATION':'HOLD_LOCAL_SOURCE_ANATOMY'}};
}
export function update(c,dt,{mode='cruise',paused=false,effort=0}={}){
 if(paused||!Number.isFinite(dt)||dt<=0)return c.output;
 if(String(mode).toLowerCase()==='rest'||!c.enabled){c.jawValue=c.gillValue=c.output.lower=c.output.upper=c.output.gill=0;return c.output;}
 dt=Math.min(.1,dt);c.time+=dt;
 const target=mode==='burst'?1:mode==='hover'?.12:mode==='turn'?.42:.32;
 c.effort+=(clamp(Math.max(target,effort),0,1)-c.effort)*(1-Math.exp(-dt*3));
 const wave=.5-.5*Math.cos(TAU*c.frequency*c.time+c.phase),e=c.effort;
 if(c.id==='barracuda'){
  // Coupled buccal/opercular pump with a lag; no synthetic cavity or teeth.
  c.output.lower=Math.min(c.maxAngle,.008+( .012+.017*e)*wave);
  c.output.gill=(.00035+.0010*e)*(.5-.5*Math.cos(TAU*c.frequency*c.time+c.phase-TAU*.18));
 }else{
  // Scombrid ram-ventilation candidate: retain a small gape during swimming,
  // modulate gently with demand, never rhythmically seal the mouth at speed.
  c.output.lower=Math.min(c.maxAngle,.011+.011*e+.003*wave);
  c.output.gill=0;
 }
 c.jawValue+=(c.output.lower-c.jawValue)*(1-Math.exp(-dt*10));c.gillValue+=(c.output.gill-c.gillValue)*(1-Math.exp(-dt*10));c.output.lower=c.jawValue;c.output.gill=c.gillValue;c.output.upper=0;return c.output;
}
export function snapshot(c){return {id:c.id,index:c.index,time:c.time,phase:c.phase,frequency:c.frequency,effort:c.effort,maxAngle:c.maxAngle,enabled:c.enabled,...c.output};}

// Piecewise-linear source skin-weight gradients, area-weighted at vertices.
// Same original position aliases are averaged to the same gradient. No mesh
// coordinates, topology, UVs, weights or texture pixels are changed.
export function surfaceGradients(positions,indices,weights,stride=1,channel=0){
 const count=positions.length/3,out=new Float32Array(positions.length),area=new Float64Array(count);
 for(let t=0;t<indices.length;t+=3){const a=indices[t],b=indices[t+1],c=indices[t+2],wa=weights[a*stride+channel],wb=weights[b*stride+channel],wc=weights[c*stride+channel];
  const A=a*3,B=b*3,C=c*3,x=positions[B]-positions[A],y=positions[B+1]-positions[A+1],z=positions[B+2]-positions[A+2],u=positions[C]-positions[A],v=positions[C+1]-positions[A+1],w=positions[C+2]-positions[A+2],nx=y*w-z*v,ny=z*u-x*w,nz=x*v-y*u,L2=nx*nx+ny*ny+nz*nz;if(L2<1e-24)continue;
  const L=Math.sqrt(L2),dB=wb-wa,dC=wc-wa,gx=((v*nz-w*ny)*dB+(ny*z-nz*y)*dC)/L2,gy=((w*nx-u*nz)*dB+(nz*x-nx*z)*dC)/L2,gz=((u*ny-v*nx)*dB+(nx*y-ny*x)*dC)/L2;
  for(const i of [a,b,c]){out[i*3]+=gx*L;out[i*3+1]+=gy*L;out[i*3+2]+=gz*L;area[i]+=L;}
 }
 for(let i=0;i<count;i++)if(area[i]>0)for(let k=0;k<3;k++)out[i*3+k]/=area[i];
 // Mouth has a small support. Avoid a half-million-entry string map for the
 // legacy body: only unify nonzero gradients and their position aliases.
 const grouped=new Map();for(let i=0;i<count;i++)if(Math.hypot(out[i*3],out[i*3+1],out[i*3+2])>1e-10){const j=i*3,key=[0,1,2].map(k=>Math.round(positions[j+k]*1e7)).join(','),g=grouped.get(key);if(g){g.ids.push(i);for(let k=0;k<3;k++)g.sum[k]+=out[j+k];}else grouped.set(key,{ids:[i],sum:[out[j],out[j+1],out[j+2]]});}
 for(const g of grouped.values())for(const i of g.ids)for(let k=0;k<3;k++)out[i*3+k]=g.sum[k]/g.ids.length;
 return out;
}
