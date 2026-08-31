import {SPEC,makeRecipe,sample,waterMesh,clamp} from './fields.mjs';
import {auditRibbon,auditSeams} from './checks.mjs';
self.onmessage=async ({data})=>{
 try{
 const start=performance.now(),c=makeRecipe(data.caseId,data.seed),n=SPEC.grid,extent=SPEC.extent;
 const h=new Float32Array(n*n),meta=new Uint8Array(n*n*4),flood=new Float32Array(n*n);flood.fill(NaN);
 let minH=Infinity,maxH=-Infinity;
 for(let iz=0;iz<n;iz++){
  for(let ix=0;ix<n;ix++){
   const i=iz*n+ix,s=sample(c,ix-extent/2,iz-extent/2);
   h[i]=s.h;minH=Math.min(minH,s.h);maxH=Math.max(maxH,s.h);flood[i]=s.water;
   meta[i*4]=Math.round(s.rock*255);meta[i*4+1]=Math.round(s.wet*255);meta[i*4+2]=Math.round(s.bund*255);meta[i*4+3]=Math.round(s.soil*255);
  }
  if(iz%128===0)postMessage({type:'progress',value:iz/n*.60,label:'求值形体与材料字段'});
 }
 // Analytic sunlight transported through scalar height buffers, no shadow texture.
 const horizon=new Float32Array(n*n),shade=new Uint8Array(n*n);
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){
  const i=z*n+x,up=z>0&&x>1?horizon[i-n-2]-1.9:-10000;
  horizon[i]=Math.max(h[i],up);shade[i]=Math.round((1-clamp((up-h[i]+.35)/1.5))*255);
 }
 const tileSize=SPEC.chunk,side=tileSize+1,tiles=[];let vertexCount=0;
 for(let tz=0;tz<extent/tileSize;tz++)for(let tx=0;tx<extent/tileSize;tx++){
  const buffer=new ArrayBuffer(side*side*16),dv=new DataView(buffer);let lo=Infinity,hi=-Infinity;
  for(let z=0;z<side;z++)for(let x=0;x<side;x++){
   const gx=tx*tileSize+x,gz=tz*tileSize+z,i=gz*n+gx,o=(z*side+x)*16;
   const l=h[gz*n+Math.max(0,gx-1)],r=h[gz*n+Math.min(n-1,gx+1)],a=h[Math.max(0,gz-1)*n+gx],b=h[Math.min(n-1,gz+1)*n+gx];
   let nx=l-r,ny=2,nz=a-b,len=Math.hypot(nx,ny,nz);nx/=len;ny/=len;nz/=len;
   dv.setFloat32(o,h[i],true);dv.setInt16(o+4,Math.round(nx*32767),true);dv.setInt16(o+6,Math.round(ny*32767),true);dv.setInt16(o+8,Math.round(nz*32767),true);
   let shadows=0,count=0,avg=0;
   for(const [dx,dz] of [[0,0],[-2,0],[2,0],[0,-2],[0,2]]){const ni=clamp(gz+dz,0,n-1)*n+clamp(gx+dx,0,n-1);shadows+=shade[ni];avg+=h[ni];count++}
   const concave=Math.max(0,avg/count-h[i]);
   dv.setUint8(o+10,Math.round(shadows/count));dv.setUint8(o+11,Math.round((1-clamp(concave*.22,0,.40))*255));
   for(let j=0;j<4;j++)dv.setUint8(o+12+j,meta[i*4+j]);lo=Math.min(lo,h[i]);hi=Math.max(hi,h[i]);
  }
  tiles.push({buffer,x:tx*tileSize-1024,z:tz*tileSize-1024,lo,hi});vertexCount+=side*side;
 }
 postMessage({type:'progress',value:.86,label:'连接同精度几何与河床'});
 const water=waterMesh(c),pondPos=[],pondDep=[],pondIdx=[];
 if(c.id==='paddy'){
  for(let z=0;z<n-1;z++)for(let x=0;x<n-1;x++){
   const i=z*n+x,ii=[i,i+n,i+1,i+n+1],w=flood[i];
   if(!Number.isFinite(w)||!ii.every(j=>Number.isFinite(flood[j])&&Math.abs(flood[j]-w)<.001&&w>h[j]+.04))continue;
   const a=pondPos.length/3;pondPos.push(x-1024,w,z-1024,x-1024,w,z+1-1024,x+1-1024,w,z-1024,x+1-1024,w,z+1-1024);
   pondDep.push(...ii.map(j=>w-h[j]));pondIdx.push(a,a+1,a+2,a+2,a+1,a+3);
  }
 }
 const ponds={positions:new Float32Array(pondPos),depths:new Float32Array(pondDep),indices:new Uint32Array(pondIdx)};
 water.audit=auditRibbon(water,h,n);const seams=auditSeams(tiles);if(!water.audit.technicalPass)throw Error('连续河面数值门失败 '+JSON.stringify(water.audit));if(!seams.passed)throw Error('同精度分区接缝失败');
 const audit={...SPEC,seams,caseId:c.id,seed:c.seed,sourceType:'procedural-authored-example',demBound:false,geographyClaim:false,peakCount:c.peaks.length,gridVertices:n*n,uploadedVertices:vertexCount,terrainTriangles:extent*extent*2,tileCount:tiles.length,bytes:tiles.reduce((s,t)=>s+t.buffer.byteLength,0)+water.positions.byteLength+water.indices.byteLength+water.depths.byteLength+ponds.positions.byteLength+ponds.depths.byteLength+ponds.indices.byteLength,minHeight:minH,maxHeight:maxH,buildMs:performance.now()-start,river:water.audit,pondTriangles:ponds.indices.length/3,visualApproved:false,productionReady:false};
 const transfer=[...tiles.map(t=>t.buffer),water.positions.buffer,water.depths.buffer,water.indices.buffer,ponds.positions.buffer,ponds.depths.buffer,ponds.indices.buffer];
 postMessage({type:'result',tiles,water,ponds,audit},transfer);
 }catch(e){postMessage({type:'error',message:e.message,stack:e.stack})}
};
