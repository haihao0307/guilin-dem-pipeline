import {curve} from '../../fixtures/local-knit-r03/p02-curve.mjs';
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,b)=>a.map(v=>v*b),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/Math.hypot(...a)),fract=x=>x-Math.floor(x),smooth=(a,b,x)=>{x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x);};
export function hash(x){let n=Math.imul((x|0)^4291,73244475);n=Math.imul(n^(n>>>16),73244475);return((n^(n>>>16))>>>0)/4294967296;}
function phase(t,lane){return hash(Math.floor(t)+lane*4099)*Math.PI*2;}
export function sourceFrame(t,lane,profile){const centre=q=>{const p=curve(q);return[(Math.floor(q)+p[0]+.5)*profile.pitchMM,(lane*.5+p[1])*profile.pitchMM,p[2]*profile.pitchMM];},P=centre(t),T=unit(sub(centre(t+.0005),centre(t-.0005))),B=unit(add(cross(T,[0,0,1]),[1.e-12,1.e-12,1.e-12])),W=unit(cross(B,T)),radius=profile.radiusMM*(1+.038*Math.sin(fract(t)*21+phase(t,lane))+.022*Math.sin(fract(t)*49+phase(t,lane)*3));return{P,T,B,W,radius};}
export function shortFibre(col,row,j,profile,mmPerPixel){
 const id=Math.round(row*4099+col),L=(Math.imul(id,997)+j)|0,H=n=>hash(Math.imul(L,n)),at=col+hash(Math.imul(L,13)+4),frame=sourceFrame(at,row,profile),{P,T,B,W}=frame,radius=profile.yarnGeometry==='circular-preview@1'?profile.radiusMM:frame.radius,theta=hash(Math.imul(L,7)+1)*Math.PI*2,Q=unit(add(mul(B,Math.cos(theta)),mul(W,Math.sin(theta)))),scale=profile.pitchMM/5.8;
 const envelope=profile.yarnGeometry==='circular-preview@1'?1:1+.055*Math.cos(3*(theta+fract(at)*Math.PI*2*2.8*.55))+.022*Math.sin(5*theta+phase(at,row)+fract(at)*11),root=add(P,mul(Q,radius*envelope+.014*scale)),near=smooth(3,7,2*radius/mmPerPixel),population=H(29),rare=population>.991;
 const original=(rare?1.4:.32)+(rare?1.5:.94)*H(31)**1.45,raised=rare?3.2+2.5*H(31):population>.93?1.6+1.5*H(31):1.2+2.5*H(31)**1.2,len=(original*(1-near)+raised*near)*scale;
 const strand=mul(unit(add(mul(T,(H(41)-.5)*1.35),mul(Q,.3+.5*H(23)))),len*.95),bend=mul(add(mul(B,(H(19)-.5)*len*1.25),mul(W,(H(37)-.45)*len*.7)),.95),curl=mul(unit(add(mul(B,H(79)-.5),mul(W,H(83)-.5))),.95*.12*len*near),wave=Math.PI*(1.4+1.2*H(73)),radiusMM=(.0175*(1-near)+.024*near)*scale;
 return{root,strand,bend,curl,wave,radiusMM,normal:Q,near,col,row,seed:H(97),weight:1,colourVariation:1+.18*(hash(id*17+3)-.5)*.65};
}
export function buildFibreBins({profile,eye,target,width,height,samples=64}){
 const forward=unit(sub(target,eye)),right=unit(cross(forward,[0,1,0])),up=cross(right,forward),distance=Math.hypot(...sub(target,eye)),mmPerPixel=distance*.68/height,shift=[-profile.grid[0]*profile.pitchMM*.5,-profile.grid[1]*profile.pitchMM*.25,0],tileSize=16,tilesX=Math.ceil(width/tileSize),tilesY=Math.ceil(height/tileSize),bins=Array.from({length:tilesX*tilesY},()=>[]),fibres=[];
 const project=p=>{const q=sub(p,eye),z=dot(q,forward);return[(dot(q,right)/z/.34/(width/height)*.5+.5)*width,(dot(q,up)/z/.34*.5+.5)*height,z];};
 for(let row=0;row<profile.grid[1];row++)for(let col=0;col<profile.grid[0];col++){
  // Stable IDs come from the original 960-member stratum. Rare flyaways are
  // retained separately with their own population weight, as in the workbench.
  const id=row*4099+col,rare=[],ordinary=[];for(let i=0;i<960;i++){const j=i*577%960,L=(Math.imul(id,997)+j)|0;(hash(Math.imul(L,29))>.991?rare:ordinary).push(j);}
  const nr=Math.min(rare.length,Math.ceil(samples*rare.length/960)),nn=samples-nr;
  for(const [ids,n]of [[rare,nr],[ordinary,nn]])for(let i=0;i<n;i++){
   const f=shortFibre(col,row,ids[i],profile,mmPerPixel);f.weight=ids.length/n;f.root=add(f.root,shift);
   // Analytic componentwise bound on root+s*t+b*t²+c*sin(w*t)*sin(pi*t).
   const lo=f.root.map((v,k)=>v+Math.min(0,f.strand[k])+Math.min(0,f.bend[k])-Math.abs(f.curl[k])-f.radiusMM),hi=f.root.map((v,k)=>v+Math.max(0,f.strand[k])+Math.max(0,f.bend[k])+Math.abs(f.curl[k])+f.radiusMM),corners=[];
   for(let n=0;n<8;n++)corners.push(project([n&1?hi[0]:lo[0],n&2?hi[1]:lo[1],n&4?hi[2]:lo[2]]));
   if(corners.some(p=>p[2]<=0))throw Error('Fibre bound crosses camera; candidate not supported');
   f.screenBounds=[Math.min(...corners.map(p=>p[0]))-2,Math.min(...corners.map(p=>p[1]))-2,Math.max(...corners.map(p=>p[0]))+2,Math.max(...corners.map(p=>p[1]))+2];
   const x0=Math.max(0,Math.floor(f.screenBounds[0]/tileSize)),x1=Math.min(tilesX-1,Math.floor(f.screenBounds[2]/tileSize)),y0=Math.max(0,Math.floor(f.screenBounds[1]/tileSize)),y1=Math.min(tilesY-1,Math.floor(f.screenBounds[3]/tileSize));
   if(x0>x1||y0>y1)continue;const index=fibres.length;fibres.push(f);for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)bins[y*tilesX+x].push(index);
  }
 }
 const offsets=new Uint32Array(bins.length*2),indices=[];let maximum=0;for(let i=0;i<bins.length;i++){offsets.set([indices.length,bins[i].length],i*2);indices.push(...bins[i]);maximum=Math.max(maximum,bins[i].length);}
 const records=new Float32Array(fibres.length*28);fibres.forEach((f,i)=>records.set([...f.root,f.radiusMM,...f.strand,f.wave,...f.bend,f.weight,...f.curl,f.col,...[f.row,f.seed,f.near,f.colourVariation],...f.normal,0,...f.screenBounds],i*28));
 return{records,offsets,indices:new Uint32Array(indices),tilesX,tilesY,tileSize,mmPerPixel,stats:{fibres:fibres.length,sourceFibresPerNeedle:960,samplesPerNeedle:samples,maximumCandidatesPerTile:maximum,candidateReferences:indices.length,cacheBytes:records.byteLength+offsets.byteLength+indices.length*4,fullPopulation:samples===960}};
}
