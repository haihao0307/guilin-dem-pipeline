// Haiyu's own sparse structure study. Not reconstruction of the artist's code or anatomy.
// The axis equation and Rodrigues helper are reused from the verified R17 source.
import {rotate} from './curve-math.mjs';
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export const sub=(a,b)=>a.map((v,i)=>v-b[i]);
export const mul=(v,k)=>v.map(x=>x*k);
export const dot=(a,b)=>a.reduce((r,v,i)=>r+v*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=v=>Math.hypot(...v);
const unit=v=>{const d=length(v);if(!Number.isFinite(d)||d<1e-12)throw Error('Degenerate tangent');return mul(v,1/d)};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function axis(s,t,amplitude=1){const p=2*Math.PI*t/4,a=.055*amplitude;return [s-.5,.022*s*s+a*s*s*Math.sin(p-2.5*s),a*.48*s*s*Math.sin(p-1.8*s+.4)];}
export function tangent(s,t,amplitude=1){const p=2*Math.PI*t/4,a=.055*amplitude;return [1,.044*s+a*(2*s*Math.sin(p-2.5*s)-2.5*s*s*Math.cos(p-2.5*s)),a*.48*(2*s*Math.sin(p-1.8*s+.4)-1.8*s*s*Math.cos(p-1.8*s+.4))];}
// Discrete minimal-rotation approximation, not a claimed exact continuous RMF.
// The initial normal is fixed once. There is no per-station world-axis switch.
export function transportedFrames(tangents,normalSeed=[0,1,0],{closed=false}={}){
 if(closed)throw Error('Closed paths need a separately tested twist-closure policy');
 if(!tangents.length)throw Error('No tangents');
 const T0=unit(tangents[0]),N0=unit(sub(normalSeed,mul(T0,dot(normalSeed,T0))));
 const frames=[{T:T0,N:N0,B:unit(cross(T0,N0))}];
 for(let i=1;i<tangents.length;i++){
  const prev=frames[i-1],T=unit(tangents[i]),d=clamp(dot(prev.T,T),-1,1),r=cross(prev.T,T),s=length(r);
  if(d<-1+1e-9)throw Error('Adjacent tangents reverse: resample or repair the axis');
  if(d<.5)throw Error('Tangent turn exceeds 60 degrees: resample or repair the axis');
  let N=s<1e-12?prev.N:rotate(prev.N,mul(r,Math.atan2(s,d)/s));
  N=unit(sub(N,mul(T,dot(N,T))));const B=unit(cross(T,N));frames.push({T,N,B});
 }
 return frames;
}
