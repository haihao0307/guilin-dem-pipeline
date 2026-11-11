// View-independent index of original candidate IDs, NOT a sampled surface.
const BUILD_SOURCE_R04=buildSource;
const searchCache=new Map();
buildSource=function(p){
 const key=JSON.stringify([p.pitch,p.rowStretch,p.radius,p.loft]);if(searchCache.has(key))return searchCache.get(key);
 const s=BUILD_SOURCE_R04(p),start=performance.now(),nx=64,ny=32,nz=32;
 const sx=p.pitch,sy=p.pitch*.5*p.rowStretch,zmax=Math.fround(sx*.4*p.loft+p.radius+1.35);
 const pad=2*Math.hypot(sx/nx*.5,sy/ny*.5,zmax/nz)+.01;
 // Distance-to-segment is 1-Lipschitz. Candidates farther than best+2*cellRadius
 // at the cell centre cannot win anywhere in the cell. Extra .01mm covers f32.
 const allIds=Array.from(s.ids),b=new Uint32Array((128+nx*ny*nz)*2);b.set(s.bins);
 const dedup=new Map();let kept=0,maxKept=0,oldTotal=0;
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const coarse=(y>>2)*16+(x>>2),lo=s.bins[coarse*2],count=s.bins[coarse*2+1];
  const cx=(x+.5)*sx/nx,cy=(y+.5)*sy/ny,records=[];
  for(let k=0;k<count;k++){
   const id=(lo+k)*4,si=s.ids[id]*8,ox=s.ids[id+1]*sx,oy=s.ids[id+2]*sy;
   const ax=s.segments[si]+ox,ay=s.segments[si+1]+oy,az=s.segments[si+2];
   const vx=s.segments[si+4]-s.segments[si],vy=s.segments[si+5]-s.segments[si+1],vz=s.segments[si+6]-s.segments[si+2];
   records.push([id,ax,ay,az,vx,vy,vz,1/(vx*vx+vy*vy+vz*vz)]);
  }
  for(let z=0;z<nz;z++){
   const cz=-zmax+(z+.5)*2*zmax/nz,distances=[];let best=Infinity;
   for(const a of records){const dx=cx-a[1],dy=cy-a[2],dz=cz-a[3],t=Math.max(0,Math.min(1,(dx*a[4]+dy*a[5]+dz*a[6])*a[7]));const xx=dx-a[4]*t,yy=dy-a[5]*t,zz=dz-a[6]*t,d=xx*xx+yy*yy+zz*zz;distances.push(d);best=Math.min(best,d);}
   const limit=(Math.sqrt(best)+pad)**2,indices=records.filter((_,i)=>distances[i]<=limit).map(a=>a[0]);
   const listKey=indices.join(',');let entry=dedup.get(listKey);
   if(!entry){entry=[allIds.length/4,indices.length];for(const i of indices)allIds.push(s.ids[i],s.ids[i+1],s.ids[i+2],s.ids[i+3]);dedup.set(listKey,entry);}
   b.set(entry,(128+(z*ny+y)*nx+x)*2);kept+=indices.length;maxKept=Math.max(maxKept,indices.length);oldTotal+=count;
  }
 }
 s.bins=b;s.ids=new Int32Array(allIds);
 s.acceleration={method:'conservative-nearest-segment-candidates',grid:[nx,ny,nz],zmax,paddingMm:pad,coordinateSafetyMarginMm:.01,averageOriginalCandidates:oldTotal/(nx*ny*nz),averageRetainedCandidates:kept/(nx*ny*nz),maxRetainedCandidates:maxKept,uniqueLists:dedup.size,bytes:b.byteLength+s.ids.byteLength,buildCpuMs:performance.now()-start,boundaryFallback:true,storesSurfaceSamples:false};
 searchCache.set(key,s);return s;
};
