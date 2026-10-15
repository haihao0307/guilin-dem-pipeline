import {PROJECTION} from './patch-plan.mjs';
import {frame as sharedFrame} from './shared-projection.mjs';
export {PROJECTION};
export const REGION = Object.freeze({boundsEPSG2326:[796320,795730,869640,856720],origin:[834000,827000],heightMinMaxM:[-100,1500]});
export const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const normalize=a=>{const n=Math.hypot(...a);if(!(n>0))throw Error('Degenerate camera basis');return a.map(x=>x/n);};
export function mapCamera({target,distance,yaw,pitch}){
 const fw=normalize([Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)]),right=normalize(cross(fw,[0,1,0])),up=cross(right,fw);
 return {cam:target.map((v,i)=>v-fw[i]*distance),fw,right,up,flat:normalize([fw[0],0,fw[2]]),...PROJECTION};
}
export function regionCorners(region=REGION){const [e0,n0,e1,n1]=region.boundsEPSG2326,[eo,no]=region.origin;return [e0,e1].flatMap(E=>region.heightMinMaxM.flatMap(H=>[n0,n1].map(N=>[E-eo,H,no-N])));}
export function projectRaw(p,c,aspect){const v=p.map((x,i)=>x-c.cam[i]),z=dot(v,c.fw),near=c.clipNear??c.near??PROJECTION.near,far=c.clipFar??c.far??PROJECTION.far,tanFov=PROJECTION.tanFov;return [dot(v,c.right)/(tanFov*aspect),dot(v,c.up)/tanFov,(far+near)/(far-near)*z-2*far*near/(far-near),z];}
export function cameraReport(c,aspect,points=regionCorners()){
 const near=c.clipNear??c.near??PROJECTION.near,far=c.clipFar??c.far??PROJECTION.far;
 const corners=points.map(p=>{const clip=projectRaw(p,c,aspect),ndc=clip.slice(0,3).map(x=>x/clip[3]);return {world:p,clip,ndc,viewDepthM:clip[3],inside:clip[3]>=near&&clip[3]<=far&&ndc.every(x=>Math.abs(x)<=1+1e-12)};});
 return {near,far,allInside:corners.every(x=>x.inside),maxAbsNdcXY:Math.max(...corners.flatMap(x=>x.ndc.slice(0,2).map(Math.abs))),depthRangeM:[Math.min(...corners.map(x=>x.viewDepthM)),Math.max(...corners.map(x=>x.viewDepthM))],farSlackM:far-Math.max(...corners.map(x=>x.viewDepthM)),corners};
}
export function fitRegion(aspect,{region=REGION,pitch=-1.5,padding=1.08,farSafetyM=100,yaws=[0,-Math.PI/2]}={}){
 if(!(Number.isFinite(aspect)&&aspect>0&&padding>=1))throw Error('Invalid viewport or padding');
 const points=regionCorners(region),min=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...points.map(p=>p[i]))),target=min.map((v,i)=>(v+max[i])/2);
 const attempts=yaws.map(yaw=>{
  const basis=mapCamera({target,distance:0,yaw,pitch});let distance=180,maxOffsetZ=-Infinity;
  for(const p of points){const v=p.map((x,i)=>x-target[i]),z=dot(v,basis.fw);maxOffsetZ=Math.max(maxOffsetZ,z);distance=Math.max(distance,padding*Math.abs(dot(v,basis.right))/(PROJECTION.tanFov*aspect)-z,padding*Math.abs(dot(v,basis.up))/PROJECTION.tanFov-z,PROJECTION.near+1-z);}
  const maxDistance=PROJECTION.far-farSafetyM-maxOffsetZ,state={target:[...target],distance,yaw,pitch},camera=mapCamera(state),report=cameraReport(camera,aspect,points);
  return {supported:distance<=maxDistance&&report.allInside,gpuVisibilityVerified:false,aspect,state,camera,report,maxDistanceM:maxDistance,padding};
 });
 const best=attempts.filter(x=>x.supported).sort((a,b)=>a.state.distance-b.state.distance)[0];
 if(best)return best;
 return {supported:false,aspect,reason:'This viewport cannot fit the whole bounded region at 55 degrees within the 150 km far plane and requested padding. Rotate/widen the viewport; no island has been silently cropped.',attempts};
}
export function fitRegionShared(aspect,options={}){
 const fit=fitRegion(aspect,options);if(!fit.supported)return fit;
 const camera=sharedFrame(fit.camera,{mode:'map',distance:fit.state.distance});
 return {...fit,camera,report:cameraReport(camera,aspect,regionCorners(options.region||REGION))};
}
// Optional host-facing control. Call only after old city initialization/focus has finished.
// On resize, retain full-region framing only while this preset is active; pointer/wheel cancels it.
export function installRegionOverview(host,game,{buttonParent=document.body,initial=false}={}){
 let active=false,last=null;const {canvas,mapState,requestFrame,qa}=host;
 const button=document.createElement('button');button.textContent='全港含离岛';button.dataset.view='whole-hong-kong';buttonParent.append(button);
 const status=document.createElement('span');status.setAttribute('role','status');button.after(status);
 function focus(){const fit=fitRegionShared(canvas.width/canvas.height);last=fit;qa.fullRegionProjection={...fit,active:fit.supported,near:fit.supported?fit.camera.clipNear:null,far:PROJECTION.far,fov:PROJECTION.fov,projectionMode:'shared-map-dynamic',geometryCompletenessVerified:false};if(!fit.supported){active=false;status.textContent='屏幕过窄，请横屏或加宽后再看全港。';return fit;}game?.setMode('map');Object.assign(mapState,fit.state);active=true;status.textContent='';requestFrame();return fit;}
 const cancel=()=>{active=false;if(qa.fullRegionProjection)qa.fullRegionProjection.active=false;},resize=()=>{if(active){requestFrame();requestAnimationFrame(()=>requestAnimationFrame(()=>{if(active)focus();}));}};
 button.onclick=focus;canvas.addEventListener('pointerdown',cancel);canvas.addEventListener('wheel',cancel);addEventListener('resize',resize);
 if(initial)focus();
 return {focus,cancel,getState:()=>({active,last}),dispose(){canvas.removeEventListener('pointerdown',cancel);canvas.removeEventListener('wheel',cancel);removeEventListener('resize',resize);button.remove();status.remove();}};
}
export function depthAt(z,{near,far}=PROJECTION){return far/(far-near)-far*near/((far-near)*z);}
export function depthStepM(z,bits=24,{near,far}=PROJECTION){return z*z*(far-near)/(far*near*(2**bits-1));}
