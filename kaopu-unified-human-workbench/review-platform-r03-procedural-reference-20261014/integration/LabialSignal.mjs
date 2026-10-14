import FIT from './LabialNormalFit.json';
// The signal is stored as sparse function coefficients, not image pixels.
// Reconstruct once, then cache in two formerly unused atlas channels.
let fields;
function reconstruct(){
 if(fields)return fields;const W=FIT.width,H=FIT.height;
 const cx=Array.from({length:W},(_,k)=>Float32Array.from({length:W},(_,x)=>Math.cos(Math.PI/W*(x+.5)*k)));
 const cy=Array.from({length:H},(_,k)=>Float32Array.from({length:H},(_,y)=>Math.cos(Math.PI/H*(y+.5)*k)));
 fields=['lower','upper'].map(part=>FIT[part].map(({coefficients})=>{const a=new Float32Array(W*H);for(const[kx,ky,amp]of coefficients)for(let y=0;y<H;y++){const v=amp*cy[ky][y];for(let x=0;x<W;x++)a[y*W+x]+=v*cx[kx][x];}return a;}));
 return fields;
}
export function packLabialSignal(texture){
 if(texture.userData.labialSignal)return;const f=reconstruct(),{width,height,data}=texture.image,W=FIT.width,H=FIT.height;
 if(!(data instanceof Uint8Array)||width!==1024||height!==512)throw Error('Lip atlas contract changed');
 const get=(a,x,y)=>a[Math.max(0,Math.min(H-1,y))*W+Math.max(0,Math.min(W-1,x))];
 for(let y=0;y<height;y++){const upper=y>=height/2?1:0,v=((y/(height/2)-upper)-.06)/.88,qy=Math.max(0,Math.min(H-1,v*H-.5)),iy=Math.floor(qy),fy=qy-iy;
  for(let x=0;x<width;x++){const qx=(x+.5)/width*W-.5,ix=Math.floor(qx),fx=qx-ix;
   for(let c=0;c<2;c++){const a=f[upper][c],s=(get(a,ix,iy)*(1-fx)+get(a,ix+1,iy)*fx)*(1-fy)+(get(a,ix,iy+1)*(1-fx)+get(a,ix+1,iy+1)*fx)*fy;
    data[(y*width+x)*4+2+c]=Math.max(0,Math.min(255,Math.round((s+1)*127.5)));
   }
  }
 }
 texture.userData.labialSignal={version:FIT.schema,termsPerChannel:FIT.termsPerChannel,sourceSignalDimensions:[W,H],samplersAdded:0,textureBytesAdded:0,upperVarianceRetained:FIT.upper.map(x=>x.varianceRetained),lowerVarianceRetained:FIT.lower.map(x=>x.varianceRetained)};
 texture.needsUpdate=true;
}
export function signalReport(){return{termsPerChannel:FIT.termsPerChannel,sourceSignalDimensions:[FIT.width,FIT.height],upperVarianceRetained:FIT.upper.map(x=>x.varianceRetained),lowerVarianceRetained:FIT.lower.map(x=>x.varianceRetained),tangentSlopeRMSE:FIT.upper.concat(FIT.lower).map(x=>x.rmse*.4),cache:'unused B/A of existing RG lip height atlas',samplersAdded:0,textureBytesAdded:0};}
