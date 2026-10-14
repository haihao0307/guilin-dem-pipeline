import * as THREE from '../three.module.js';
import {COUNT,SEGMENTS,makeRoots,hashFloats,MATERIALS,halton} from '../fiber-r02/kernel.mjs';
import * as old from '../fiber-r02/shaders.mjs';
import {stableVertex,nodeRadianceFragment,frontFragment,layerFragment,resolveFragment,STEP_METRES} from '../fiber-r03/stability.mjs';
import {movingPositionFragment,fastNodeRadianceFragment,fastStableVertex} from './motion-shaders.mjs';
import {FurGuideMotion} from './motion.mjs';
const VERSION='HAIR-FIBER-R04-FUR1';
const $=id=>document.getElementById(id);
const defaults={material:'chestnut',roughness:.30,variation:.36,diameter:70,frizz:.22,wave:1,lighting:'studio',rotation:0,exposure:1.25,shadowStrength:.52,scatterBoost:1,mode:0,path:'stable'};
const p={...defaults},errors=[],counters={positions:0,shadows:0,radiance:0,geometry:0,display:0};
const r=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
r.autoClear=false;r.setPixelRatio(1);r.outputColorSpace=THREE.LinearSRGBColorSpace;r.toneMapping=THREE.NoToneMapping;
const gl=r.getContext();
if(!gl.getExtension('EXT_color_buffer_float'))throw Error('需要 WebGL2 浮点渲染支持');
$('view').prepend(r.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(31,1,.02,5),target=new THREE.Vector3(0,-.002,0);
let yaw=.12,pitch=.035,distance=.66,width=1,height=1,seq=0,revision=0,completedRevision=-1,completed=0;
let posDirty=true,shadowDirty=true,shadeDirty=true,viewDirty=true,presentDirty=true;
let request=0,fence=null,frameRevision=0,submittedAt=0,firstReady=0,refSamples=0,refLimit=1,manual=false;
let motion=null,motionStart=0,motionOrigin=0,drawnFrames=0,lastInputAt=0;
const timings=[],inputLatencies=[];
const specimen=makeRoots(),signature=hashFloats([specimen.roots,specimen.traits]);
const geo=new THREE.InstancedBufferGeometry(),coords=new Float32Array((SEGMENTS+1)*6),indices=[];
for(let j=0;j<=SEGMENTS;j++){coords.set([-1,j/SEGMENTS,0,1,j/SEGMENTS,0],j*6);if(j<SEGMENTS){const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
geo.setAttribute('position',new THREE.BufferAttribute(coords,3));geo.setIndex(indices);
geo.setAttribute('rootData',new THREE.InstancedBufferAttribute(specimen.roots,4));geo.setAttribute('trait',new THREE.InstancedBufferAttribute(specimen.traits,4));geo.instanceCount=COUNT;
const u={diameter:{value:70e-6},frizz:{value:.22},wave:{value:1},viewport:{value:new THREE.Vector2()},ortho:{value:0},orthoDir:{value:new THREE.Vector3(0,0,1)},positionMap:{value:null},sigmaA:{value:new THREE.Vector3(...MATERIALS.chestnut.sigma)},roughness:{value:.3},variation:{value:.36},exposure:{value:1.25},shadowStrength:{value:.52},scatterBoost:{value:1},mode:{value:0},lightDirs:{value:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]},lightColors:{value:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]},shadowMatrices:{value:[new THREE.Matrix4(),new THREE.Matrix4(),new THREE.Matrix4()]},shadow0:{value:null},shadow1:{value:null},shadow2:{value:null},eyePosition:{value:new THREE.Vector3()},backdrop:{value:new THREE.Color(0x030507)},sampleIndex:{value:0},gPositionMap:{value:null},gTangentMap:{value:null},gAuxMap:{value:null},cameraView:{value:new THREE.Matrix4()},cameraProjection:{value:new THREE.Matrix4()},eyeDistance:{value:.66},layerBase:{value:0},layerStep:{value:STEP_METRES},frontMap:{value:null}};
function tex(data){const a=new Float32Array(128*Math.ceil(COUNT/128)*4);a.set(data);const t=new THREE.DataTexture(a,128,Math.ceil(COUNT/128),THREE.RGBAFormat,THREE.FloatType);t.needsUpdate=true;return t;}
u.rootMap={value:tex(specimen.roots)};u.traitMap={value:tex(specimen.traits)};
const nearest={minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter};
const positionRT=new THREE.WebGLRenderTarget(1024,Math.ceil(COUNT*81/1024),{type:THREE.FloatType,depthBuffer:false,...nearest});
u.positionMap.value=positionRT.texture;
const radianceRT=new THREE.WebGLRenderTarget(positionRT.width,positionRT.height,{count:4,type:THREE.HalfFloatType,depthBuffer:false,...nearest});
for(let i=0;i<4;i++)u['radiance'+i]={value:radianceRT.textures[i]};
const mk=(vs,fs,opts={})=>new THREE.ShaderMaterial({uniforms:u,vertexShader:vs,fragmentShader:fs,depthTest:false,depthWrite:false,...opts});
const positionMat=mk(old.fullscreenVertex,movingPositionFragment);
const radMat=mk(old.fullscreenVertex,fastNodeRadianceFragment,{glslVersion:THREE.GLSL3});
const frontMat=mk(fastStableVertex,frontFragment,{side:THREE.DoubleSide,depthTest:true,depthWrite:true});
const layerMat=mk(fastStableVertex,layerFragment,{glslVersion:THREE.GLSL3,side:THREE.DoubleSide,transparent:true,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendEquation:THREE.AddEquation});
const resolveMat=mk(old.fullscreenVertex,resolveFragment);
const oldCoverage=mk(old.vertex,old.gbufferFragment,{glslVersion:THREE.GLSL3,side:THREE.DoubleSide,depthTest:true,depthWrite:true});
const oldShade=mk(old.fullscreenVertex,old.fragment);
const mesh=new THREE.Mesh(geo,frontMat);mesh.frustumCulled=false;scene.add(mesh);
const quadScene=new THREE.Scene(),quadCamera=new THREE.Camera(),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));quad.frustumCulled=false;quadScene.add(quad);
const accU={currentFrame:{value:null},history:{value:null},sampleCount:{value:1}},outU={image:{value:null},exposure:u.exposure};
const accMat=new THREE.ShaderMaterial({uniforms:accU,vertexShader:old.fullscreenVertex,fragmentShader:old.accumulateFragment,depthTest:false,depthWrite:false});
const outMat=new THREE.ShaderMaterial({uniforms:outU,vertexShader:old.fullscreenVertex,fragmentShader:old.presentFragment,depthTest:false,depthWrite:false});
const du={diameter:u.diameter,viewport:{value:new THREE.Vector2(384,512)},ortho:{value:1},orthoDir:{value:new THREE.Vector3()},positionMap:u.positionMap,slab:{value:0}};
const depthMat=new THREE.ShaderMaterial({uniforms:du,vertexShader:old.vertex,fragmentShader:old.shadowFragment,side:THREE.DoubleSide,transparent:true,depthTest:false,depthWrite:false,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendEquation:THREE.AddEquation});
const shadowRT=Array.from({length:3},()=>new THREE.WebGLRenderTarget(768,512,{type:THREE.HalfFloatType,depthBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter}));
const shadowCam=Array.from({length:3},()=>new THREE.OrthographicCamera(-.18,.18,.18,-.18,.1,1));
for(let i=0;i<3;i++)u['shadow'+i].value=shadowRT[i].texture;
const bounds=[];for(const x of[-.06,.06])for(const y of[-.16,.15])for(const z of[-.04,.04])bounds.push(new THREE.Vector3(x,y,z));
let frame,accA,accB,gbuffer,frontRT,layers=[];
function updateCamera(){camera.position.set(target.x+distance*Math.sin(yaw)*Math.cos(pitch),target.y+distance*Math.sin(pitch),target.z+distance*Math.cos(yaw)*Math.cos(pitch));camera.lookAt(target);camera.updateMatrixWorld();u.eyePosition.value.copy(camera.position);u.cameraView.value.copy(camera.matrixWorldInverse);u.cameraProjection.value.copy(camera.projectionMatrix);u.eyeDistance.value=distance;}
function lighting(){
 const rigs={studio:[[-.60,.46,1.,6.8,6.2,5.5],[.82,.10,.72,1.5,1.72,2.1],[.35,.20,-1,6.3,6.6,7.4]],rake:[[-1,.12,.24,7.2,6.6,5.8],[.8,.4,.8,.6,.7,.85],[.4,.28,-1,4.2,4.5,5.]],back:[[-.5,.35,.8,1.1,1.,.9],[.8,.1,.8,.55,.65,.8],[.06,.15,-1,12,10.5,8.]]};
 const a=p.rotation*Math.PI/180;
 rigs[p.lighting].forEach((v,i)=>{u.lightDirs.value[i].set(v[0]*Math.cos(a)+v[2]*Math.sin(a),v[1],v[2]*Math.cos(a)-v[0]*Math.sin(a)).normalize();u.lightColors.value[i].set(v[3],v[4],v[5]);});shadowDirty=true;shadeDirty=true;
}
function fullpass(mat,rt){quad.material=mat;r.setRenderTarget(rt);r.setViewport(0,0,rt?rt.width:width,mat===radMat?Math.ceil(COUNT*u.shadeCount.value/1024):(rt?rt.height:height));r.render(quadScene,quadCamera);}
function geometry(mat,rt,clear=true){mesh.material=mat;r.setRenderTarget(rt);r.setViewport(0,0,rt.width,rt.height);if(clear){r.setClearColor(0,0);r.clear(true,true,false);}r.render(scene,camera);counters.geometry++;}
function shadows(){
 mesh.material=depthMat;const bias=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
 for(let i=0;i<3;i++){
  du.orthoDir.value.copy(u.lightDirs.value[i]);const c=shadowCam[i];c.position.copy(u.lightDirs.value[i]).multiplyScalar(.6);c.lookAt(0,-.004,0);c.updateMatrixWorld();
  const box=new THREE.Box3().setFromPoints(bounds.map(v=>{const q=v.clone(),m=dynamics.snapshot().maxOffset;q.x+=Math.sign(q.x)*m;q.y+=Math.sign(q.y)*m;q.z+=Math.sign(q.z)*m;return q.applyMatrix4(c.matrixWorldInverse);}));
  c.left=box.min.x-.004;c.right=box.max.x+.004;c.bottom=box.min.y-.004;c.top=box.max.y+.004;c.near=-box.max.z-.004;c.far=-box.min.z+.004;c.updateProjectionMatrix();
  u.shadowMatrices.value[i].copy(bias).multiply(c.projectionMatrix).multiply(c.matrixWorldInverse);
  r.setRenderTarget(shadowRT[i]);r.setViewport(0,0,768,512);r.setClearColor(0,0);r.clear(true,false,false);
  for(let s=0;s<2;s++){du.slab.value=s;r.setViewport(s*384,0,384,512);r.render(scene,c);}
 }shadowDirty=false;counters.shadows++;
}
function resize(){const box=$('view').getBoundingClientRect(),scale=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1600000/(box.width*box.height)));width=Math.max(1,Math.round(box.width*scale));height=Math.max(1,Math.round(box.height*scale));r.setSize(width,height,false);r.domElement.style.width='100%';r.domElement.style.height='100%';camera.aspect=box.width/box.height;camera.updateProjectionMatrix();
 for(const t of[frame,accA,accB,gbuffer,frontRT,...layers])t?.dispose();
 frame=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,depthBuffer:false});accA=frame.clone();accB=frame.clone();
 gbuffer=new THREE.WebGLRenderTarget(width,height,{count:3,type:THREE.FloatType,depthBuffer:true,...nearest});
 frontRT=new THREE.WebGLRenderTarget(width,height,{type:THREE.FloatType,depthBuffer:true,...nearest});
 layers=Array.from({length:2},()=>new THREE.WebGLRenderTarget(width,height,{count:4,type:THREE.HalfFloatType,depthBuffer:false,...nearest}));
 u.gPositionMap.value=gbuffer.textures[0];u.gTangentMap.value=gbuffer.textures[1];u.gAuxMap.value=gbuffer.textures[2];u.frontMap.value=frontRT.texture;
 for(let i=0;i<8;i++)u['layer'+i]={value:layers[Math.floor(i/4)].textures[i%4]};
 u.viewport.value.set(width,height);invalidate('camera');
}
function invalidate(kind='camera'){
 revision++;lastInputAt=performance.now();refSamples=0;completed=0;
 if(kind==='geometry')posDirty=shadowDirty=shadeDirty=viewDirty=true;
 else if(kind==='camera')shadeDirty=viewDirty=true;
 else if(kind==='shade')shadeDirty=true;
 presentDirty=true;if(!manual&&!request)request=requestAnimationFrame(tick);
}
function status(){
 $('motionStats').textContent=`导向 ${dynamics.snapshot().guides} · CPU ${dynamics.cpuMS.toFixed(3)} ms · 形变 ${ (dynamics.snapshot().maxOffset*1000).toFixed(1)} mm`;
 $('status').textContent=p.path==='stable'?'R04 · 原光学 / 导向毛梢运动':`R02 对照 · ${completed}/${refLimit}`;
 $('stats').textContent=`${COUNT.toLocaleString()} 根 · 80 段/根 · ${p.diameter} μm · ${timings.length?timings.at(-1).toFixed(1):'—'} ms 已完成帧`;
}
function render(){
 renderedGuideState=dynamics.snapshot();
 updateCamera();
 if(posDirty){fullpass(positionMat,positionRT);posDirty=false;counters.positions++;}
 if(shadowDirty)shadows();
 if(p.path==='stable'){
  if(shadeDirty){fullpass(radMat,radianceRT);shadeDirty=false;counters.radiance++;}
  if(viewDirty){geometry(frontMat,frontRT);viewDirty=false;}
  for(let b=0;b<2;b++){u.layerBase.value=b*4;geometry(layerMat,layers[b]);}
  fullpass(resolveMat,frame);outU.image.value=frame.texture;
 }else{
  const j=refSamples?[halton(refSamples,2)-.5,halton(refSamples,3)-.5]:[0,0];camera.setViewOffset(width,height,j[0],j[1],width,height);
  u.sampleIndex.value=refSamples;geometry(oldCoverage,gbuffer);camera.clearViewOffset();fullpass(oldShade,frame);
  refSamples++;accU.currentFrame.value=frame.texture;accU.history.value=accA.texture;accU.sampleCount.value=refSamples;fullpass(accMat,accB);[accA,accB]=[accB,accA];outU.image.value=accA.texture;
 }
 fullpass(outMat,null);counters.display++;presentDirty=false;drawnFrames++;seq++;
}
function completeFence(){if(!fence)return true;const state=gl.clientWaitSync(fence,0,0);if(state===gl.WAIT_FAILED)throw Error('GPU completion failed');if(state!==gl.ALREADY_SIGNALED&&state!==gl.CONDITION_SATISFIED)return false;gl.deleteSync(fence);fence=null;timings.push(performance.now()-submittedAt);if(timings.length>120)timings.shift();completedRevision=frameRevision;completed=p.path==='stable'?1:refSamples;if(!firstReady){firstReady=performance.now();document.body.dataset.ready='true';$('loading').hidden=true;}if(frameRevision===revision&&lastInputAt)inputLatencies.push(performance.now()-lastInputAt);status();return true;}
function tick(t){request=0;try{
 advanceDynamics(t);
 if(!completeFence()){request=requestAnimationFrame(tick);return;}
 if(motion){const elapsed=(t-motionStart)*.001;if(motion==='light'){p.rotation=((motionOrigin+elapsed*12+180)%360)-180;lighting();invalidateQuiet('shade');}else{yaw=motionOrigin+.42*Math.sin(elapsed*.65);invalidateQuiet('camera');}}
 if(presentDirty||(p.path==='reference'&&refSamples<refLimit)){
  submittedAt=performance.now();
  if(presentDirty&&!shadeDirty&&!viewDirty&&!shadowDirty&&!posDirty&&p.path==='stable'&&outU.image.value){fullpass(outMat,null);counters.display++;presentDirty=false;}else render();
  frameRevision=revision;fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();request=requestAnimationFrame(tick);
 }else if(motion||(!dynamics.paused&&(dynamics.enabled||dynamics.active)))request=requestAnimationFrame(tick);
}catch(e){fail(e);}}
function invalidateQuiet(kind){revision++;refSamples=0;completed=0;presentDirty=true;shadeDirty=true;if(kind==='camera')viewDirty=true;}
function setParam(k,val){
 if(k==='material'){if(!MATERIALS[val])throw Error('Unknown material');p.material=val;u.sigmaA.value.set(...MATERIALS[val].sigma);p.roughness=MATERIALS[val].roughness;u.roughness.value=p.roughness;$('roughness').value=p.roughness;invalidate('shade');}
 else if(k==='lighting'){if(!['studio','rake','back'].includes(val))throw Error('Unknown lighting');p.lighting=val;lighting();invalidate('shade');}
 else if(k==='path'){if(!['stable','legacy','reference'].includes(val))throw Error('Unknown path');p.path=val;refLimit=val==='reference'?16:1;viewDirty=shadeDirty=true;invalidate('camera');}
 else {const limits={roughness:[.18,.55],variation:[0,.7],diameter:[40,120],frizz:[0,.6],wave:[0,1.4],rotation:[-180,180],exposure:[.4,2.8],shadowStrength:[0,1],scatterBoost:[0,2],mode:[0,3]};const n=Number(val);if(!limits[k]||!Number.isFinite(n)||n<limits[k][0]||n>limits[k][1])throw Error('Invalid '+k);p[k]=n;if(u[k])u[k].value=k==='diameter'?n*1e-6:n;
 if(k==='rotation'){lighting();invalidate('shade');}else if(k==='exposure')invalidate('display');else if(['wave','frizz'].includes(k))invalidate('geometry');else if(k==='diameter'){shadowDirty=true;invalidate('camera');}else invalidate('shade');}
 for(const el of document.querySelectorAll('[data-material]'))el.classList.toggle('selected',el.dataset.material===p.material);
 for(const el of document.querySelectorAll('input[type=range]')){if(el.id in p){el.value=p[el.id];const o=$(el.id+'Value');if(o)o.textContent=String(p[el.id]);}}
 for(const k of['path','lighting','mode'])$(k).value=String(p[k]);
}
function setCamera(v){if(v.yaw!==undefined){if(!Number.isFinite(v.yaw))throw Error('Invalid yaw');yaw=v.yaw;}if(v.pitch!==undefined)pitch=Math.max(-1.25,Math.min(1.25,v.pitch));if(v.distance!==undefined)distance=Math.max(.08,Math.min(1.2,v.distance));if(v.target)target.fromArray(v.target);invalidate('camera');}
function setMotion(kind){motion=motion===kind?null:kind;motionStart=performance.now();motionOrigin=kind==='light'?p.rotation:yaw;for(const id of['lightMove','cameraMove'])$(id).classList.toggle('selected',motion===(id==='lightMove'?'light':'camera'));invalidate('camera');}
function fail(e){errors.push(String(e));$('status').textContent='渲染失败';$('loading').hidden=false;$('loading').textContent=String(e);document.body.dataset.failed='true';console.error(e);}
window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
for(const el of document.querySelectorAll('[data-material]'))el.onclick=()=>setParam('material',el.dataset.material);
for(const k of['roughness','variation','diameter','frizz','wave','rotation','exposure','shadowStrength','scatterBoost'])$(k).oninput=e=>setParam(k,e.target.value);
for(const k of['path','lighting','mode'])$(k).onchange=e=>setParam(k,e.target.value);
$('background').onchange=()=>{u.backdrop.value.setHex($('background').value==='gray'?0x555555:0x030507);viewDirty=true;invalidate('shade');};
$('full').onclick=()=>setCamera({yaw:.12,pitch:.035,distance:.66,target:[0,-.002,0]});$('macro').onclick=()=>setCamera({yaw:.08,pitch:0,distance:.20,target:[.012,-.015,.006]});
$('lightMove').onclick=()=>setMotion('light');$('cameraMove').onclick=()=>setMotion('camera');
$('reset').onclick=()=>{motion=null;for(const[k,v]of Object.entries(defaults))setParam(k,v);$('full').click();};
$('save').onclick=()=>{localStorage.setItem('kaopu.hair.fiber-r04',JSON.stringify({schema:'kaopu/hair-optics-specimen@1',seed:270314,parameters:p}));$('save').textContent='已保存本机参数';};
let pointer=null;
r.domElement.onpointerdown=e=>{motion=null;pointer={x:e.clientX,y:e.clientY,shift:e.shiftKey};r.domElement.setPointerCapture(e.pointerId);};
r.domElement.onpointermove=e=>{if(!pointer)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(pointer.shift){target.x-=dx*distance*.0007;target.y+=dy*distance*.0007;}else{yaw-=dx*.006;pitch=Math.max(-1.25,Math.min(1.25,pitch+dy*.006));}pointer.x=e.clientX;pointer.y=e.clientY;invalidate('camera');};
r.domElement.onpointerup=r.domElement.onpointercancel=()=>{pointer=null;};r.domElement.onwheel=e=>{e.preventDefault();distance=Math.min(1.2,Math.max(.08,distance*Math.exp(e.deltaY*.001)));invalidate('camera');};
r.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(request);request=0;fail('WebGL context lost');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(request);request=0;}else invalidate('camera');});
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

window.HAIR_LAB={version:VERSION,setParam,setCamera,setMotion,parameters:p,invalidate,
 snapshot:()=>({version:VERSION,source:document.querySelector('meta[name=source-commit]').content,parameters:{...p},camera:{yaw,pitch,distance,target:target.toArray()},count:COUNT,segments:SEGMENTS,signature,width,height,revision,completedRevision,completed,seq,firstFrameMS:firstReady,completedFrameWallMS:timings.slice(),inputLatencyWallMS:inputLatencies.slice(-120),counters:{...counters},renderer:gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL||gl.RENDERER),memory:r.info.memory,errors:errors.slice(),physics:"bounded-guide-spring",guideMotion:dynamics.snapshot(),renderedGuideState,simulationCPU:simCPU.slice(),opticalSamples:u.shadeCount.value,temporalReprojection:false,deterministicCoverage:p.path==='stable'}),
 setWindEnabled:windEnabled,setWind:v=>{dynamics.setWind(v);wakeDynamics();},resetDynamics,setOpticalSamples,readMotionNodes,
 stepDynamics:dt=>{if(!manual)throw Error("Manual test required");dynamics.advance(dt);dirtyDynamics();},
 testBrush:(gain=1)=>{const w=new Float32Array(85);for(let i=0;i<85;i++)w[i]=Math.exp(-(dynamics.positions[i*3]**2)/.00014);dynamics.setBrush(w,[12,-3,3],gain);dirtyDynamics();},
 capture:()=>r.domElement.toDataURL('image/png'),
 setManual:async value=>{manual=value;motion=null;cancelAnimationFrame(request);request=0;while(!completeFence())await new Promise(s=>setTimeout(s,5));},
 renderFrame:async()=>{if(!manual)throw Error('Manual test mode required');while(!completeFence())await new Promise(s=>setTimeout(s,5));submittedAt=performance.now();render();frameRevision=revision;fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();while(!completeFence())await new Promise(s=>setTimeout(s,5));return window.HAIR_LAB.snapshot();}
};
lighting();new ResizeObserver(resize).observe($('view'));resize();
