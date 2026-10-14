import FIT from './SkinNormalFit.json';
let signal;
function synthesize(){
 if(signal)return signal;const W=64,H=64,C=Array.from({length:64},(_,k)=>Float32Array.from({length:64},(_,x)=>Math.cos(Math.PI/64*(x+.5)*k)));
 signal=FIT.patches.map(p=>p.channels.map(({coefficients})=>{const a=new Float32Array(W*H);for(const[kx,ky,amp]of coefficients)for(let y=0;y<H;y++){const v=amp*C[ky][y];for(let x=0;x<W;x++)a[y*W+x]+=v*C[kx][x];}return a;}));return signal;
}
export function appendSkinSignal(texture){
 if(texture.userData.referenceSkinSignal)return texture.userData.referenceSkinSignal.row;
 const fields=synthesize(),old=texture.image.data,row=old.length/2048,out=new Float32Array(old.length+64*512*4);out.set(old);
 for(let patch=0;patch<4;patch++)for(let y=0;y<64;y++)for(let x=0;x<64;x++){const j=((row+y)*512+patch*64+x)*4;for(let c=0;c<3;c++)out[j+c]=fields[patch][c][y*64+x];out[j+3]=1;}
 texture.image={data:out,width:512,height:out.length/2048};texture.needsUpdate=true;texture.userData.referenceSkinSignal={row,bytesAdded:64*512*4*4,patches:4,method:FIT.method};return row;
}
export const skinSignalMeans=FIT.patches.map(p=>p.channels[2].mean);
export const skinSignalNormalMeans=FIT.patches.map(p=>p.channels.slice(0,2).map(c=>c.mean));
export const skinSignalReport=()=>({schema:FIT.schema,patches:FIT.patches.map(p=>({name:p.name,physicalSpanMM:p.spanMM,normalVarianceRetained:p.channels.slice(0,2).map(c=>c.varianceRetained),normalSlopeRMSE:p.channels.slice(0,2).map(c=>c.rmse*.4)})),sharedCacheBytesAdded:64*512*4*4,textureSamplersAdded:0,externalImagesLoaded:0});
