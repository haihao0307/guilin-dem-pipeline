// R04: integration only. The FUR source does not own this specimen's optics or roots.
const dynamics=new FurGuideMotion();let dynamicsClock=performance.now(),lastMotionRevision=-1,brushMode=false;
const guideTexture=new THREE.DataTexture(dynamics.offsets,17,5,THREE.RGBAFormat,THREE.FloatType);
guideTexture.minFilter=guideTexture.magFilter=THREE.NearestFilter;guideTexture.needsUpdate=true;u.guideMotion={value:guideTexture};
u.shadeCount={value:21};u.shadeStride={value:4};
let renderedGuideState=null,simCPU=[];
function dirtyDynamics(){guideTexture.needsUpdate=true;posDirty=shadowDirty=shadeDirty=viewDirty=presentDirty=true;revision++;refSamples=0;completed=0;lastMotionRevision=dynamics.revision;}
function advanceDynamics(now){const dt=Math.max(0,(now-dynamicsClock)/1000);dynamicsClock=now;if(dynamics.advance(dt)){dirtyDynamics();simCPU.push(dynamics.cpuMS);if(simCPU.length>120)simCPU.shift();}}
function wakeDynamics(){dynamicsClock=performance.now();invalidate('geometry');}
function windEnabled(v){dynamics.enabled=!!v;$('windMotion').textContent=v?'关闭微风 / 自然回落':'开启微风';wakeDynamics();}
function resetDynamics(){dynamics.enabled=false;dynamics.paused=false;dynamics.reset();dirtyDynamics();$('windMotion').textContent='开启微风';$('pauseMotion').textContent='暂停发丝';wakeDynamics();}
function setOpticalSamples(n){if(![21,81].includes(n))throw Error('Invalid optical sampling');u.shadeCount.value=n;u.shadeStride.value=80/(n-1);$('opticalSamples').value=String(n);invalidate('camera');}
function brushOnce(){const weights=new Float32Array(85);for(let i=0;i<85;i++){const q=i*3;weights[i]=Math.exp(-(dynamics.positions[q]**2+dynamics.positions[q+2]**2)/.00018);}dynamics.setBrush(weights,[12,-3,3]);wakeDynamics();setTimeout(()=>{dynamics.release();wakeDynamics();},260);}
$('windMotion').onclick=()=>windEnabled(!dynamics.enabled);
$('pauseMotion').onclick=()=>{dynamics.paused=!dynamics.paused;$('pauseMotion').textContent=dynamics.paused?'恢复发丝':'暂停发丝';wakeDynamics();};
$('resetMotion').onclick=resetDynamics;$('impulseMotion').onclick=brushOnce;
$('windGain').oninput=e=>{dynamics.setWind(+e.target.value);$('windGainValue').textContent=dynamics.wind.toFixed(2);wakeDynamics();};
$('opticalSamples').onchange=e=>setOpticalSamples(+e.target.value);
$('brushMotion').onclick=()=>{brushMode=!brushMode;$('brushMotion').classList.toggle('selected',brushMode);r.domElement.style.cursor=brushMode?'crosshair':'grab';};
const oldDown=r.domElement.onpointerdown,oldMove=r.domElement.onpointermove,oldUp=r.domElement.onpointerup;
let brushPointer=null;
r.domElement.onpointerdown=e=>{if(!brushMode){oldDown(e);return;}motion=null;brushPointer={x:e.clientX,y:e.clientY};r.domElement.setPointerCapture(e.pointerId);};
r.domElement.onpointermove=e=>{
 if(!brushPointer){oldMove(e);return;}
 const dx=e.clientX-brushPointer.x,dy=e.clientY-brushPointer.y;brushPointer={x:e.clientX,y:e.clientY};
 const box=r.domElement.getBoundingClientRect(),weights=new Float32Array(85),point=new THREE.Vector3();
 for(let i=0;i<85;i++){
  const q=i*3,x=dynamics.positions[q],z=dynamics.positions[q+2],group=Math.max(0,Math.min(16,Math.round((x/.052+.5)*16)));let best=1e9;
  for(let j=2;j<=12;j++){const t=j/12,envelope=Math.sin(Math.PI*t),clump=envelope*envelope;
   point.set(x*(1-.28*t*t)+p.wave*.024*Math.sin(6*t)*envelope+.0035*Math.sin(8*t+group*.83)*clump+dynamics.offsets[i*4]*t*t,
    .128-.268*t+dynamics.offsets[i*4+1]*t*t,
    z*(1-.18*t)+p.wave*.018*Math.sin(7.2*t+.4)*envelope+.0055*Math.sin(5.7*t+group*.83)*clump+dynamics.offsets[i*4+2]*t*t).project(camera);
   if(point.z>=-1&&point.z<=1){const sx=box.x+(point.x*.5+.5)*box.width,sy=box.y+(.5-point.y*.5)*box.height;best=Math.min(best,(sx-e.clientX)**2+(sy-e.clientY)**2);}
  }
  weights[i]=Math.exp(-best/(32*32));
 }
 const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
 const dir=right.multiplyScalar(dx).addScaledVector(up,-dy);dynamics.setBrush(weights,dir.toArray());wakeDynamics();
};
r.domElement.onpointerup=r.domElement.onpointercancel=()=>{if(brushPointer){brushPointer=null;dynamics.release();wakeDynamics();}oldUp();};
r.domElement.addEventListener('lostpointercapture',()=>{if(brushPointer){brushPointer=null;dynamics.release();wakeDynamics();}});
const oldReset=$('reset').onclick;$('reset').onclick=()=>{resetDynamics();setOpticalSamples(21);oldReset();};
document.addEventListener('visibilitychange',()=>{dynamicsClock=performance.now();dynamics.accumulator=0;dynamics.release();});
function readMotionNodes(){const result=[];for(const root of[0,4999,9999]){const read=node=>{const id=root*81+node,a=new Float32Array(4);r.readRenderTargetPixels(positionRT,id%1024,Math.floor(id/1024),1,1,a);return [...a].slice(0,3);};result.push({root,position:read(0),tip:read(80)});}return result;}
