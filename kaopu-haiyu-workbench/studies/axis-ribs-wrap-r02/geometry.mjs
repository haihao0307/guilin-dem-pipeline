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
export function evaluate(options={}){
 const allowed=['time','amplitude','ribCount','asymmetry','wrapAngle','widthScale','depthScale'];for(const k of Object.keys(options))if(!allowed.includes(k))throw Error('Unsupported geometry parameter: '+k);
 const p={time:0,amplitude:1,ribCount:12,asymmetry:.04,wrapAngle:2.40,widthScale:.94,depthScale:.50,...options};
 if(!Number.isFinite(p.time)||!Number.isFinite(p.amplitude)||p.amplitude<0||p.amplitude>2||!Number.isInteger(p.ribCount)||p.ribCount<2||p.ribCount>24||!Number.isFinite(p.asymmetry)||Math.abs(p.asymmetry)>.1)throw Error('Invalid structure parameters');
 if(!Number.isFinite(p.wrapAngle)||p.wrapAngle<2.10||p.wrapAngle>2.75||!Number.isFinite(p.widthScale)||p.widthScale<.85||p.widthScale>1||!Number.isFinite(p.depthScale)||p.depthScale<.35||p.depthScale>.75)throw Error('Invalid wrapping parameters');
 const steps=128,centers=Array.from({length:steps+1},(_,i)=>axis(i/steps,p.time,p.amplitude));
 const frames=transportedFrames(Array.from({length:steps+1},(_,i)=>tangent(i/steps,p.time,p.amplitude)));
 const stations=[],ribs=[];
 for(let j=0;j<p.ribCount;j++){
  const index=Math.round((.12+.76*j/(p.ribCount-1))*steps),s=index/steps,root=centers[index],f=frames[index];
  const phase=2*Math.PI*p.time/4-2.5*s,L=.255*Math.pow(Math.sin(Math.PI*s),.7)*(1+.05*p.amplitude*Math.sin(phase));
  const station={id:j,index,s,root:[...root],frame:f};stations.push(station);
  for(const side of[-1,1]){
   const span=L*(1+side*p.asymmetry*Math.sin(2*Math.PI*s));const local=[],points=[];
   for(let k=0;k<=24;k++){
    // +B is the designed back direction; -B is the chest direction.
    // Each elliptical arc starts exactly on the axis, opens laterally, then turns inward.
    // Neither the axis equation nor the camera projection is changed for this correction.
    const u=k/24,angle=p.wrapAngle*u,offset=[.22*span*u,side*span*p.widthScale*Math.sin(angle),-span*p.depthScale*(1-Math.cos(angle))];
    local.push(offset);points.push(add(root,add(mul(f.T,offset[0]),add(mul(f.N,offset[1]),mul(f.B,offset[2])))));
   }
   ribs.push({id:`station-${j}-${side<0?'left':'right'}`,stationId:j,side,root:[...root],local,points});
  }
 }
 return {schema:'haiyu.sparse-axis-ribs-wrap/2',parameters:p,axis:centers,frames,stations,ribs,semantics:'C01 user-directed shape study: local +B back, -B chest; paired arcs wrap inward. Not anatomy or physical simulation',bounds:{origin:'world',cameraDependent:false},vertexCount:centers.length+ribs.reduce((n,r)=>n+r.points.length,0)};
}
export function inspect(packet){
 let orthogonality=0,unitError=0,handedness=1,adjacentNormalDot=1,rootError=0;
 for(let i=0;i<packet.frames.length;i++){
  const{T,N,B}=packet.frames[i];orthogonality=Math.max(orthogonality,Math.abs(dot(T,N)),Math.abs(dot(T,B)),Math.abs(dot(N,B)));unitError=Math.max(unitError,...[T,N,B].map(v=>Math.abs(length(v)-1)));handedness=Math.min(handedness,dot(cross(T,N),B));if(i)adjacentNormalDot=Math.min(adjacentNormalDot,dot(N,packet.frames[i-1].N));
 }
 for(const rib of packet.ribs){rootError=Math.max(rootError,length(sub(rib.points[0],packet.stations[rib.stationId].root)));}
 const all=[...packet.axis,...packet.ribs.flatMap(r=>r.points)].flat();
 return {orthogonality,unitError,handedness,adjacentNormalDot,rootError,allFinite:all.every(Number.isFinite),ribCount:packet.ribs.length,stations:packet.stations.length,vertexCount:packet.vertexCount};
}
export function project(v,view='front',yaw=.65,pitch=.35){
 if(view==='front')return [v[0],-v[1],v[2]];
 if(view==='top')return [v[0],-v[2],v[1]];
 if(view==='side')return [v[1],-v[2],v[0]];
 const x=v[0]*Math.cos(yaw)+v[2]*Math.sin(yaw),z=-v[0]*Math.sin(yaw)+v[2]*Math.cos(yaw),y=v[1]*Math.cos(pitch)-z*Math.sin(pitch);
 return [x,-y,v[1]*Math.sin(pitch)+z*Math.cos(pitch)];
}
