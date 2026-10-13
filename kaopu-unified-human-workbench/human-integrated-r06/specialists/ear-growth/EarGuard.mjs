/** Local, deterministic backtracking on triangle orientation/area/edge strain
 * and sampled anterior/posterior sheet gaps. This is NOT global collision
 * detection, cartilage FEM, or an anatomical-validity certificate. */
export class EarGuard {
 constructor(geometry,samples){
  this.triangles={left:[],right:[]};this.pairs={left:[],right:[]};
  const I=geometry.index.array,R=geometry.attributes.fRest.array;
  for(let k=0;k<I.length;k+=3){const ids=[I[k],I[k+1],I[k+2]],q=ids.map(i=>samples[i]).find(q=>q&&q.mask>1e-7);if(q)this.triangles[q.side>0?'left':'right'].push(ids);}
  for(const side of[-1,1]){
   const bins=new Map(),cell=.0017,key=(y,z)=>Math.floor(y/cell)+','+Math.floor(z/cell);
   for(let i=0;i<samples.length;i++){const q=samples[i];if(q?.side!==side||q.nx>-.25||q.mask<.8)continue;const k=key(q.y,q.z);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(i);}
   for(let i=0;i<samples.length;i++){
    const q=samples[i];if(q?.side!==side||q.nx<.50||q.mask<.8)continue;
    let best=Infinity,id=-1;const by=Math.floor(q.y/cell),bz=Math.floor(q.z/cell);
    for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const j of bins.get((by+y)+','+(bz+z))||[]){const p=samples[j],gap=q.x-p.x,d=(q.y-p.y)**2+(q.z-p.z)**2;if(gap>.0006&&gap<.0075&&d<best&&d<.00000144){best=d;id=j;}}
    if(id>=0)this.pairs[side>0?'left':'right'].push([i,id,side]);
   }
  }
 }
 metrics(base,candidate,which,frame){
  let minArea=Infinity,maxEdge=0,minEdge=Infinity,minFacing=1,violations=0,minGap=Infinity,checked=0,gaps=0;
  for(const[a,b,c]of this.triangles[which]){
   const i=a*3,j=b*3,k=c*3;
   const ux=base[j]-base[i],uy=base[j+1]-base[i+1],uz=base[j+2]-base[i+2],vx=base[k]-base[i],vy=base[k+1]-base[i+1],vz=base[k+2]-base[i+2];
   const Ux=candidate[j]-candidate[i],Uy=candidate[j+1]-candidate[i+1],Uz=candidate[j+2]-candidate[i+2],Vx=candidate[k]-candidate[i],Vy=candidate[k+1]-candidate[i+1],Vz=candidate[k+2]-candidate[i+2];
   const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,Nx=Uy*Vz-Uz*Vy,Ny=Uz*Vx-Ux*Vz,Nz=Ux*Vy-Uy*Vx;
   const nn=Math.hypot(nx,ny,nz),NN=Math.hypot(Nx,Ny,Nz);if(nn<1e-13)continue;checked++;
   const area=NN/nn,facing=(nx*Nx+ny*Ny+nz*Nz)/(nn*NN||1);minArea=Math.min(minArea,area);minFacing=Math.min(minFacing,facing);
   const r1=Math.hypot(Ux,Uy,Uz)/Math.max(1e-10,Math.hypot(ux,uy,uz)),r2=Math.hypot(Vx,Vy,Vz)/Math.max(1e-10,Math.hypot(vx,vy,vz)),r3=Math.hypot(Ux-Vx,Uy-Vy,Uz-Vz)/Math.max(1e-10,Math.hypot(ux-vx,uy-vy,uz-vz));
   const low=Math.min(r1,r2,r3),high=Math.max(r1,r2,r3);minEdge=Math.min(minEdge,low);maxEdge=Math.max(maxEdge,high);
   if(!Number.isFinite(area)||area<.12||area>6||facing<.10||low<.25||high>3)violations++;
  }
  for(const[a,b,side]of this.pairs[which]){
   const gap=P=>side*((P[a*3]-P[b*3])*frame.x[0]+(P[a*3+1]-P[b*3+1])*frame.x[1]+(P[a*3+2]-P[b*3+2])*frame.x[2]);
   const before=gap(base);if(before<.00035)continue;gaps++;const now=gap(candidate);minGap=Math.min(minGap,now);if(now<Math.max(.00012,before*.20))violations++;
  }
  return{violations,checkedTriangles:checked,minAreaRatio:Number.isFinite(minArea)?minArea:1,minFacingCosine:minFacing,minEdgeRatio:Number.isFinite(minEdge)?minEdge:1,maxEdgeRatio:maxEdge,checkedSheetPairs:gaps,minimumSampledGapMM:Number.isFinite(minGap)?minGap*1000:null};
 }
 solve(base,delta,out,samples,frame){
  out.set(base);const report={};
  for(const which of['left','right']){
   const side=which==='left'?1:-1;let alpha=1,metrics=null,initial=null,steps=0;
   for(;steps<12;steps++){
    for(let i=0;i<samples.length;i++)if(samples[i]?.side===side)for(let k=0;k<3;k++)out[i*3+k]=base[i*3+k]+alpha*delta[i*3+k];
    metrics=this.metrics(base,out,which,frame);initial??=metrics.violations;
    if(!metrics.violations)break;alpha*=.65;
   }
   if(metrics.violations){alpha=0;for(let i=0;i<samples.length;i++)if(samples[i]?.side===side)for(let k=0;k<3;k++)out[i*3+k]=base[i*3+k];metrics=this.metrics(base,out,which,frame);}
   report[which]={acceptedScale:alpha,backtrackingSteps:steps,requestedViolations:initial,...metrics};
  }
  return report;
 }
}
