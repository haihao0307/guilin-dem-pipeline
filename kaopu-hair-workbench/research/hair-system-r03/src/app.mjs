import * as THREE from '../references/fur-r02/three.module.js';
import {COUNT,SEGMENTS,makeRoots,hashFloats,MATERIALS,halton} from './specimen.mjs';
import * as old from '../references/fiber-r02/shaders.mjs';
import {stableVertex,nodeRadianceFragment,frontFragment,layerFragment,resolveFragment,STEP_METRES} from '../references/fiber-r03/stability.mjs';
import {fastNodeRadianceFragment as originalRadiance,fastStableVertex,layer8Fragment,shadowPairFragment,packShadowFragment} from '../references/fiber-r05/shaders.mjs';
import {movingPositionFragment} from './shape-shader.mjs';
import {fastNodeRadianceFragment,displayFragment,whiteResolveFragment} from './optics.mjs';

import {StrandDynamics} from './physics.mjs';
import {STYLES} from './specimen.mjs';
const initialStyle=document.querySelector('meta[name=hair-style]')?.content||'medium';let style=initialStyle;
const VERSION='HAIR-FIBER-SYSTEM-R03';
const $=id=>document.getElementById(id);
const defaults={material:'chestnut',roughness:.40,variation:.18,diameter:70,frizz:.10,wave:1,lighting:'studio',rotation:0,exposure:1.0,shadowStrength:.52,scatterBoost:1,mode:0,path:'stable'};
const p={...defaults},errors=[],counters={positions:0,shadows:0,radiance:0,geometry:0,display:0};
const r=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
r.autoClear=false;r.setPixelRatio(1);r.outputColorSpace=THREE.LinearSRGBColorSpace;r.toneMapping=THREE.NoToneMapping;
const gl=r.getContext();
const supports8=gl.getParameter(gl.MAX_DRAW_BUFFERS)>=8&&gl.getParameter(gl.MAX_COLOR_ATTACHMENTS)>=8;let optimized=true,packed=supports8;
if(!gl.getExtension('EXT_color_buffer_float'))throw Error('需要 WebGL2 浮点渲染支持');
$('view').prepend(r.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(31,1,.02,5),target=new THREE.Vector3(0,-.002,0);
let yaw=.35,pitch=.035,distance=STYLES[style].distance,width=1,height=1,seq=0,revision=0,completedRevision=-1,completed=0;
let posDirty=true,shadowDirty=true,shadeDirty=true,viewDirty=true,presentDirty=true;
let request=0,fence=null,frameRevision=0,submittedAt=0,firstReady=0,refSamples=0,refLimit=1,manual=false;
let motion=null,motionStart=0,motionOrigin=0,drawnFrames=0,lastInputAt=0;
const timings=[],inputLatencies=[];
const specimen=makeRoots(),signature=hashFloats([specimen.roots,specimen.traits]);
const geo=new THREE.InstancedBufferGeometry(),coords=new Float32Array((SEGMENTS+1)*6),indices=[];
for(let j=0;j<=SEGMENTS;j++){coords.set([-1,j/SEGMENTS,0,1,j/SEGMENTS,0],j*6);if(j<SEGMENTS){const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
geo.setAttribute('position',new THREE.BufferAttribute(coords,3));geo.setIndex(indices);
geo.setAttribute('rootData',new THREE.InstancedBufferAttribute(specimen.roots,4));geo.setAttribute('trait',new THREE.InstancedBufferAttribute(specimen.traits,4));geo.instanceCount=COUNT;
const u={silkiness:{value:.88},clumping:{value:.22},styleIndex:{value:style==='long'?1:0},rootY:{value:STYLES[style].rootY},weightDebug:{value:0},styleLength:{value:STYLES[style].length},diameter:{value:70e-6},frizz:{value:.10},wave:{value:1},viewport:{value:new THREE.Vector2()},ortho:{value:0},orthoDir:{value:new THREE.Vector3(0,0,1)},positionMap:{value:null},sigmaA:{value:new THREE.Vector3(...MATERIALS.chestnut.sigma)},roughness:{value:.40},variation:{value:.18},exposure:{value:1.0},shadowStrength:{value:.52},scatterBoost:{value:1},mode:{value:0},lightPositions:{value:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]},lightDirs:{value:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]},lightColors:{value:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]},shadowMatrices:{value:[new THREE.Matrix4(),new THREE.Matrix4(),new THREE.Matrix4()]},shadow0:{value:null},shadow1:{value:null},shadow2:{value:null},eyePosition:{value:new THREE.Vector3()},backdrop:{value:new THREE.Color(0xffffff)},sampleIndex:{value:0},gPositionMap:{value:null},gTangentMap:{value:null},gAuxMap:{value:null},cameraView:{value:new THREE.Matrix4()},cameraProjection:{value:new THREE.Matrix4()},eyeDistance:{value:.66},layerBase:{value:0},layerStep:{value:STEP_METRES},frontMap:{value:null}};
function tex(data){const a=new Float32Array(128*Math.ceil(COUNT/128)*4);a.set(data);const t=new THREE.DataTexture(a,128,Math.ceil(COUNT/128),THREE.RGBAFormat,THREE.FloatType);t.needsUpdate=true;return t;}
u.rootMap={value:tex(specimen.roots)};u.traitMap={value:tex(specimen.traits)};const clumpTexture=new THREE.DataTexture(specimen.clumps,24,1,THREE.RGBAFormat,THREE.FloatType);clumpTexture.needsUpdate=true;u.clumpMap={value:clumpTexture};
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
const layer8Mat=supports8?mk(fastStableVertex,layer8Fragment,{glslVersion:THREE.GLSL3,side:THREE.DoubleSide,transparent:true,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendEquation:THREE.AddEquation}):null;
const resolveMat=mk(old.fullscreenVertex,whiteResolveFragment);
const oldCoverage=mk(old.vertex,old.gbufferFragment,{glslVersion:THREE.GLSL3,side:THREE.DoubleSide,depthTest:true,depthWrite:true});
const oldShade=mk(old.fullscreenVertex,old.fragment);
const mesh=new THREE.Mesh(geo,frontMat);mesh.frustumCulled=false;scene.add(mesh);
const quadScene=new THREE.Scene(),quadCamera=new THREE.Camera(),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));quad.frustumCulled=false;quadScene.add(quad);
const accU={currentFrame:{value:null},history:{value:null},sampleCount:{value:1}},outU={image:{value:null},exposure:u.exposure,backdrop:u.backdrop};
const accMat=new THREE.ShaderMaterial({uniforms:accU,vertexShader:old.fullscreenVertex,fragmentShader:old.accumulateFragment,depthTest:false,depthWrite:false});
const outMat=new THREE.ShaderMaterial({uniforms:outU,vertexShader:old.fullscreenVertex,fragmentShader:displayFragment,depthTest:false,depthWrite:false});
const du={diameter:u.diameter,viewport:{value:new THREE.Vector2(384,512)},ortho:{value:0},orthoDir:{value:new THREE.Vector3()},positionMap:u.positionMap,slab:{value:0}};
const depthMat=new THREE.ShaderMaterial({uniforms:du,vertexShader:old.vertex,fragmentShader:old.shadowFragment,side:THREE.DoubleSide,transparent:true,depthTest:false,depthWrite:false,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendEquation:THREE.AddEquation});
const pairRT=new THREE.WebGLRenderTarget(384,512,{count:2,type:THREE.HalfFloatType,depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
const pairMat=new THREE.ShaderMaterial({uniforms:du,vertexShader:old.vertex,fragmentShader:shadowPairFragment,glslVersion:THREE.GLSL3,side:THREE.DoubleSide,transparent:true,depthTest:false,depthWrite:false,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendEquation:THREE.AddEquation});
const packMat=new THREE.ShaderMaterial({uniforms:{nearMap:{value:pairRT.textures[0]},farMap:{value:pairRT.textures[1]}},vertexShader:old.fullscreenVertex,fragmentShader:packShadowFragment,depthTest:false,depthWrite:false});
const shadowRT=Array.from({length:3},()=>new THREE.WebGLRenderTarget(768,512,{type:THREE.HalfFloatType,depthBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter}));
const shadowCam=Array.from({length:3},()=>new THREE.PerspectiveCamera(60,.75,.1,2));
for(let i=0;i<3;i++)u['shadow'+i].value=shadowRT[i].texture;
const bounds=[];for(const x of[-.18,.18])for(const y of[-.25,.25])for(const z of[-.18,.18])bounds.push(new THREE.Vector3(x,y,z));
let frame,accA,accB,gbuffer,frontRT,layers=[];
function updateCamera(){camera.position.set(target.x+distance*Math.sin(yaw)*Math.cos(pitch),target.y+distance*Math.sin(pitch),target.z+distance*Math.cos(yaw)*Math.cos(pitch));camera.lookAt(target);camera.updateMatrixWorld();u.eyePosition.value.copy(camera.position);u.cameraView.value.copy(camera.matrixWorldInverse);u.cameraProjection.value.copy(camera.projectionMatrix);u.eyeDistance.value=distance;}
function lighting(){
 const rigs={studio:[[-.60,.46,1.,3.1,3.05,3.0],[.82,.10,.72,1.2,1.25,1.32],[.35,.20,-1,1.9,1.95,2.0]],rake:[[-1,.12,.24,2.5,2.45,2.35],[.8,.4,.8,.6,.7,.85],[.4,.28,-1,1.4,1.45,1.5]],back:[[-.5,.35,.8,1.1,1.,.9],[.8,.1,.8,.55,.65,.8],[.06,.15,-1,3.4,3.25,3.0]]};
 const a=p.rotation*Math.PI/180;
 rigs[p.lighting].forEach((v,i)=>{u.lightDirs.value[i].set(v[0]*Math.cos(a)+v[2]*Math.sin(a),v[1],v[2]*Math.cos(a)-v[0]*Math.sin(a)).normalize();u.lightPositions.value[i].copy(u.lightDirs.value[i]).multiplyScalar(.70);u.lightPositions.value[i].y=[.055,.18,.10][i];u.lightDirs.value[i].copy(u.lightPositions.value[i]).normalize();u.lightColors.value[i].set(v[3],v[4],v[5]);});shadowDirty=true;shadeDirty=true;
}
function fullpass(mat,rt){quad.material=mat;r.setRenderTarget(rt);r.setViewport(0,0,rt?rt.width:width,mat===radMat?Math.ceil(COUNT*u.shadeCount.value/1024):(rt?rt.height:height));r.render(quadScene,quadCamera);}
function geometry(mat,rt,clear=true){mesh.material=mat;r.setRenderTarget(rt);r.setViewport(0,0,rt.width,rt.height);if(clear){r.setClearColor(0,0);r.clear(true,true,false);}r.render(scene,camera);counters.geometry++;}
function shadows(){
 mesh.material=depthMat;const bias=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
 for(let i=0;i<3;i++){
  du.orthoDir.value.copy(u.lightDirs.value[i]);const c=shadowCam[i];c.position.copy(u.lightPositions.value[i]);c.lookAt(0,-.004,0);c.updateMatrixWorld();
  const box=new THREE.Box3().setFromPoints(bounds.map(v=>{const q=v.clone(),m=dynamics.snapshot().maxOffset;q.x+=Math.sign(q.x)*m;q.y+=Math.sign(q.y)*m;q.z+=Math.sign(q.z)*m;return q.applyMatrix4(c.matrixWorldInverse);}));
  c.near=Math.max(.02,-box.max.z-.008);c.far=-box.min.z+.008;let fov=0;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])fov=Math.max(fov,Math.atan(Math.max(Math.abs(y),Math.abs(x)/c.aspect)/c.near)*360/Math.PI);c.fov=Math.min(145,Math.max(25,fov+2));c.updateProjectionMatrix();
  u.shadowMatrices.value[i].copy(bias).multiply(c.projectionMatrix).multiply(c.matrixWorldInverse);
  r.setRenderTarget(shadowRT[i]);r.setViewport(0,0,768,512);r.setClearColor(0,0);r.clear(true,false,false);
  if(optimized){mesh.material=pairMat;r.setRenderTarget(pairRT);r.setViewport(0,0,384,512);r.clear(true,false,false);r.render(scene,c);fullpass(packMat,shadowRT[i]);mesh.material=depthMat;}
  else for(let s=0;s<2;s++){du.slab.value=s;r.setViewport(s*384,0,384,512);r.render(scene,c);}
 }shadowDirty=false;counters.shadows++;
}
function resize(){const box=$('view').getBoundingClientRect(),scale=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1600000/(box.width*box.height)));width=Math.max(1,Math.round(box.width*scale));height=Math.max(1,Math.round(box.height*scale));r.setSize(width,height,false);r.domElement.style.width='100%';r.domElement.style.height='100%';camera.aspect=box.width/box.height;camera.updateProjectionMatrix();
 for(const t of[frame,accA,accB,gbuffer,frontRT,...layers])t?.dispose();
 frame=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,depthBuffer:false});accA=frame.clone();accB=frame.clone();
 gbuffer=new THREE.WebGLRenderTarget(width,height,{count:3,type:THREE.FloatType,depthBuffer:true,...nearest});
 frontRT=new THREE.WebGLRenderTarget(width,height,{type:THREE.FloatType,depthBuffer:true,...nearest});
 layers=Array.from({length:packed?1:2},()=>new THREE.WebGLRenderTarget(width,height,{count:packed?8:4,type:THREE.HalfFloatType,depthBuffer:false,...nearest}));
 u.gPositionMap.value=gbuffer.textures[0];u.gTangentMap.value=gbuffer.textures[1];u.gAuxMap.value=gbuffer.textures[2];u.frontMap.value=frontRT.texture;
 for(let i=0;i<8;i++)u['layer'+i]={value:layers[packed?0:Math.floor(i/4)].textures[packed?i:i%4]};
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
 const d=dynamics.snapshot();$('motionStats').textContent=`根梢连续权重 · 重力与弯曲 · 形变 ${(d.maxOffset*1000).toFixed(1)} mm`; 
 $('status').textContent=p.path==='stable'?STYLES[style].name+' · 实时三维':`R02 对照 · ${completed}/${refLimit}`;
 $('stats').textContent=`${COUNT.toLocaleString()} 根细丝 · 丝径 ${p.diameter} μm`;
}
function render(){
 renderedGuideState=dynamics.snapshot();
 updateCamera();
 if(posDirty){fullpass(positionMat,positionRT);posDirty=false;counters.positions++;}
 if(shadowDirty)shadows();
 if(p.path==='stable'){
  if(shadeDirty){fullpass(radMat,radianceRT);shadeDirty=false;counters.radiance++;}
  if(viewDirty){geometry(frontMat,frontRT);viewDirty=false;}
  if(packed){geometry(layer8Mat,layers[0]);}else for(let b=0;b<2;b++){u.layerBase.value=b*4;geometry(layerMat,layers[b]);}
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
 if(k==='rotation'){lighting();invalidate('shade');}else if(k==='exposure')invalidate('display');else if(['wave','frizz'].includes(k)){if(k==='wave'){dynamics.configure(style,p.wave);dirtyDynamics();}invalidate('geometry');}else if(k==='diameter'){shadowDirty=true;invalidate('camera');}else invalidate('shade');}
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
$('background').onchange=()=>{u.backdrop.value.setHex({white:0xffffff,gray:0x888888,black:0x030507}[$('background').value]);$('view').dataset.dark=$('background').value==='black';viewDirty=true;invalidate('shade');};
function fullView(){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<dynamics.equilibrium.length;i++){const k=i%3;min[k]=Math.min(min[k],dynamics.equilibrium[i]);max[k]=Math.max(max[k],dynamics.equilibrium[i]);}const center=min.map((v,k)=>(v+max[k])*.5),extent=Math.max(max[0]-min[0],max[1]-min[1],max[2]-min[2]);setCamera({yaw:.35,pitch:.05,distance:extent/(2*Math.tan(31*Math.PI/360))*1.20,target:center});}
$('full').onclick=fullView;$('macro').onclick=()=>setCamera({yaw:.30,pitch:0,distance:style==='long'?.23:.16,target:dynamics.sample(42,.48)});
$('lightMove').onclick=()=>setMotion('light');$('cameraMove').onclick=()=>setMotion('camera');
$('reset').onclick=()=>{motion=null;for(const[k,v]of Object.entries(defaults))setParam(k,v);$('full').click();};
$('save').onclick=()=>{localStorage.setItem('kaopu.hair.fiber-r05',JSON.stringify({schema:'kaopu/hair-optics-specimen@1',seed:270314,parameters:p}));$('save').textContent='已保存本机参数';};
let pointer=null;
r.domElement.onpointerdown=e=>{motion=null;pointer={x:e.clientX,y:e.clientY,shift:e.shiftKey};r.domElement.setPointerCapture(e.pointerId);};
r.domElement.onpointermove=e=>{if(!pointer)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(pointer.shift){target.x-=dx*distance*.0007;target.y+=dy*distance*.0007;}else{yaw-=dx*.006;pitch=Math.max(-1.25,Math.min(1.25,pitch+dy*.006));}pointer.x=e.clientX;pointer.y=e.clientY;invalidate('camera');};
r.domElement.onpointerup=r.domElement.onpointercancel=()=>{pointer=null;};r.domElement.onwheel=e=>{e.preventDefault();distance=Math.min(1.2,Math.max(.08,distance*Math.exp(e.deltaY*.001)));invalidate('camera');};
r.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(request);request=0;fail('WebGL context lost');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(request);request=0;}else invalidate('camera');});
// R04: integration only. The FUR source does not own this specimen's optics or roots.
const dynamics=new StrandDynamics(initialStyle);let dynamicsClock=performance.now(),lastMotionRevision=-1,brushMode=false;
const guideTexture=new THREE.DataTexture(dynamics.offsets,85,33,THREE.RGBAFormat,THREE.FloatType);
const guideLinear=!!gl.getExtension("OES_texture_float_linear");guideTexture.minFilter=guideTexture.magFilter=THREE.NearestFilter;guideTexture.needsUpdate=true;u.guideMotion={value:guideTexture};
u.shadeCount={value:81};u.shadeStride={value:1};
const basisTexture=new THREE.DataTexture(dynamics.basisData,81,1,THREE.RGBAFormat,THREE.FloatType);basisTexture.needsUpdate=true;u.modalBasis={value:basisTexture};u.guideLinear={value:guideLinear};
const frameTexture=new THREE.DataTexture(dynamics.frames,85,33,THREE.RGBAFormat,THREE.FloatType);frameTexture.needsUpdate=true;u.guideFrames={value:frameTexture};
let renderedGuideState=null,simCPU=[];
const detailTexture=new THREE.DataTexture(dynamics.detail.texture,256,Math.ceil(COUNT/256)*2,THREE.RGBAFormat,THREE.FloatType);detailTexture.needsUpdate=true;u.detailMotion={value:detailTexture};
function dirtyDynamics(){detailTexture.needsUpdate=true;guideTexture.needsUpdate=true;frameTexture.needsUpdate=true;posDirty=shadowDirty=shadeDirty=viewDirty=presentDirty=true;revision++;refSamples=0;completed=0;lastMotionRevision=dynamics.revision;}
function advanceDynamics(now){const dt=Math.max(0,(now-dynamicsClock)/1000);dynamicsClock=now;if(dynamics.advance(dt)){dirtyDynamics();simCPU.push(dynamics.cpuMS);if(simCPU.length>120)simCPU.shift();}}
function wakeDynamics(){if(!request&&!fence)dynamicsClock=performance.now();invalidate('geometry');}
function windEnabled(v){dynamics.enabled=!!v;$('windMotion').textContent=v?'关闭微风 / 自然回落':'开启微风';wakeDynamics();}
function resetDynamics(){$('swayRoots')?.classList.remove('selected');dynamics.enabled=false;dynamics.paused=false;dynamics.reset();dirtyDynamics();$('windMotion').textContent='开启微风';$('pauseMotion').textContent='暂停发丝';wakeDynamics();}
function setOpticalSamples(n){if(n!==81)throw Error('R05 retains all 81 optical nodes');u.shadeCount.value=n;u.shadeStride.value=80/(n-1);$('opticalSamples').value=String(n);invalidate('camera');}
function brushOnce(){const weights=new Float32Array(85);for(let i=0;i<85;i++){const q=i*3;weights[i]=Math.exp(-(dynamics.positions[q]**2+dynamics.positions[q+2]**2)/.00018);}dynamics.setBrush(weights,[12,-3,3]);wakeDynamics();setTimeout(()=>{dynamics.release();wakeDynamics();},260);}
$('windMotion').onclick=()=>windEnabled(!dynamics.enabled);
$('pauseMotion').onclick=()=>{dynamics.paused=!dynamics.paused;$('pauseMotion').textContent=dynamics.paused?'恢复发丝':'暂停发丝';wakeDynamics();};
$('resetMotion').onclick=resetDynamics;$('impulseMotion').onclick=brushOnce;
$('windGain').oninput=e=>{dynamics.setWind(+e.target.value);$('windGainValue').textContent=dynamics.wind.toFixed(2);wakeDynamics();};
$('opticalSamples').onchange=e=>setOpticalSamples(+e.target.value);
$('brushMotion').onclick=()=>{brushMode=!brushMode;$('brushMotion').classList.toggle('selected',brushMode);r.domElement.style.cursor=brushMode?'crosshair':'grab';};
const oldDown=r.domElement.onpointerdown,oldMove=r.domElement.onpointermove,oldUp=r.domElement.onpointerup;
const oldReset=$('reset').onclick;$('reset').onclick=()=>{resetDynamics();setOpticalSamples(81);oldReset();};
document.addEventListener('visibilitychange',()=>{dynamicsClock=performance.now();dynamics.accumulator=0;dynamics.release();});
function readMotionNodes(){const result=[];for(const root of[0,4999,9999]){const read=node=>{const id=root*81+node,a=new Float32Array(4);r.readRenderTargetPixels(positionRT,id%1024,Math.floor(id/1024),1,1,a);return [...a].slice(0,3);};result.push({root,position:read(0),tip:read(80)});}return result;}

// R05 native picking uses deformed guide locations and a camera-facing grab plane.
let grabState=null;
const ray=new THREE.Raycaster(),pointerNDC=new THREE.Vector2();
function guidePoint(i,t){return new THREE.Vector3(...dynamics.sample(i,t));}
function pointerRay(e){const b=r.domElement.getBoundingClientRect();pointerNDC.set((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2);ray.setFromCamera(pointerNDC,camera);return ray.ray;}
function hitGuide(e){
 updateCamera();const box=r.domElement.getBoundingClientRect();let best=32*32,result=null;
 for(let i=0;i<85;i++)for(let n=2;n<=32;n++){const t=n/32,world=guidePoint(i,t),screen=world.clone().project(camera);if(screen.z<-1||screen.z>1)continue;
  const d=(box.x+(screen.x*.5+.5)*box.width-e.clientX)**2+(box.y+(.5-screen.y*.5)*box.height-e.clientY)**2;
  if(d<best){best=d;result={i,t,world};}
 }return result;
}
r.domElement.onpointerdown=e=>{
 if(!brushMode){oldDown(e);return;}const hit=hitGuide(e);if(!hit)return;
 const weights=new Float32Array(85),x=dynamics.positions[hit.i*3],z=dynamics.positions[hit.i*3+2];
 for(let i=0;i<85;i++)weights[i]=Math.exp(-((dynamics.positions[i*3]-x)**2)/.00010-((dynamics.positions[i*3+2]-z)**2)/.00008);
 const normal=camera.getWorldDirection(new THREE.Vector3()),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,hit.world),anchor=new THREE.Vector3();
 if(!pointerRay(e).intersectPlane(plane,anchor))return;grabState={...hit,weights,plane,anchor,initial:[0,0,0]};motion=null;r.domElement.setPointerCapture(e.pointerId);
 dynamics.setGrab(weights,hit.t,grabState.initial);wakeDynamics();
};
r.domElement.onpointermove=e=>{
 if(!grabState){if(!brushMode)oldMove(e);return;}const world=new THREE.Vector3();if(!pointerRay(e).intersectPlane(grabState.plane,world))return;
 const target=world.sub(grabState.anchor).add(new THREE.Vector3(...grabState.initial));dynamics.setGrab(grabState.weights,grabState.t,target.toArray());wakeDynamics();
};
function releaseGrab(){if(grabState){grabState=null;dynamics.release();wakeDynamics();}oldUp();}
r.domElement.onpointerup=r.domElement.onpointercancel=releaseGrab;r.domElement.addEventListener('lostpointercapture',releaseGrab);
$('impulseMotion').onclick=()=>{dynamics.impulse();wakeDynamics();};
$('pipeline').onchange=e=>setPipeline(e.target.value==='merged');
function materialPassMode(){for(const m of[layerMat,layer8Mat,depthMat,pairMat])if(m)m.forceSinglePass=optimized;}
materialPassMode();
function setPipeline(v){optimized=!!v;packed=optimized&&supports8;materialPassMode();radMat.fragmentShader=optimized?fastNodeRadianceFragment:nodeRadianceFragment;radMat.needsUpdate=true;$('pipeline').value=optimized?'merged':'reference';resize();shadowDirty=shadeDirty=posDirty=true;}
// Measurements are opt-in, serialized and excluded from normal runtime.
let profiling=false,passTimings=[];
const rawFullpass=fullpass,rawGeometry=geometry,rawShadows=shadows;
function timed(name,fn){
 if(!profiling)return fn();gl.finish();const auto=r.info.autoReset;r.info.autoReset=false;
 const calls=r.info.render.calls,triangles=r.info.render.triangles,start=performance.now();
 try{const v=fn();gl.finish();passTimings.push({name,wallMS:performance.now()-start,drawCalls:r.info.render.calls-calls,triangles:r.info.render.triangles-triangles});return v;}finally{r.info.autoReset=auto;}
}
fullpass=(mat,rt)=>timed(mat===positionMat?'positions':mat===radMat?'optics81':mat===resolveMat?'resolve':mat===outMat?'display':mat===packMat?'shadow_pack':'other_quad',()=>rawFullpass(mat,rt));
geometry=(mat,rt,clear=true)=>timed(mat===frontMat?'front_depth':mat===layer8Mat?'eight_layers_one_draw':'layer_group',()=>rawGeometry(mat,rt,clear));
shadows=()=>timed('shadows_inclusive',()=>rawShadows());

window.HAIR_LAB={version:VERSION,setParam,setCamera,setMotion,parameters:p,invalidate,
 snapshot:()=>({version:VERSION,style,shaderWeights:{guideInfluences:4,hierarchicalClumps:24,independentFollowerModes:20000,rootClumpWeight:0,silkiness:u.silkiness.value,clumping:u.clumping.value},source:document.querySelector('meta[name=source-commit]').content,parameters:{...p},camera:{yaw,pitch,distance,target:target.toArray()},count:COUNT,segments:SEGMENTS,signature,width,height,revision,completedRevision,completed,seq,firstFrameMS:firstReady,completedFrameWallMS:timings.slice(),inputLatencyWallMS:inputLatencies.slice(-120),counters:{...counters},renderer:gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL||gl.RENDERER),memory:r.info.memory,errors:errors.slice(),physics:"gravity-xpbd-oriented-curvature",pipeline:optimized?"merged":"reference",packedLayers:packed,drawBufferLimit:gl.getParameter(gl.MAX_DRAW_BUFFERS),guideMotion:dynamics.snapshot(),renderedGuideState,simulationCPU:simCPU.slice(),opticalSamples:u.shadeCount.value,temporalReprojection:false,deterministicCoverage:p.path==='stable'}),
 setPipeline,profileFrame:async()=>{if(!manual)throw Error("Manual profiling required");posDirty=shadowDirty=shadeDirty=viewDirty=true;passTimings=[];profiling=true;try{await HAIR_LAB.renderFrame();return passTimings.slice();}finally{profiling=false;}},
 setWindEnabled:windEnabled,setWind:v=>{dynamics.setWind(v);wakeDynamics();},resetDynamics,setOpticalSamples,readMotionNodes,
 stepDynamics:dt=>{if(!manual)throw Error("Manual test required");dynamics.advance(dt);dirtyDynamics();},
 testBrush:(gain=1)=>{const w=new Float32Array(85);for(let i=0;i<85;i++)w[i]=Math.exp(-(dynamics.positions[i*3]**2)/.00014);dynamics.setBrush(w,[12,-3,3],gain);dirtyDynamics();},
 impulse:()=>{dynamics.impulse();dirtyDynamics();},testGrab:(t,delta)=>{const w=new Float32Array(85);for(let i=0;i<85;i++)w[i]=Math.exp(-(dynamics.positions[i*3]**2)/.0001);dynamics.setGrab(w,t,delta);dirtyDynamics();},releaseGrab:()=>{dynamics.release();dirtyDynamics();},
 opticalMetrics:()=>{
  const linear=new Uint16Array(width*height*4),display=new Uint8Array(width*height*4);r.readRenderTargetPixels(frame,0,0,width,height,linear);r.setRenderTarget(null);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,display);
  const values=[],linearValues=[];let white=0;for(let i=0;i<linear.length;i+=4){const alpha=THREE.DataUtils.fromHalfFloat(linear[i+3]);if(alpha<.99)continue;const y=(.2126*display[i]+.7152*display[i+1]+.0722*display[i+2])/255;values.push(y);linearValues.push((.2126*THREE.DataUtils.fromHalfFloat(linear[i])+.7152*THREE.DataUtils.fromHalfFloat(linear[i+1])+.0722*THREE.DataUtils.fromHalfFloat(linear[i+2]))/alpha);if(display[i]>230&&display[i+1]>230&&display[i+2]>230)white++;}
  values.sort((a,b)=>a-b);linearValues.sort((a,b)=>a-b);const percentile=(a,q)=>a[Math.min(a.length-1,Math.floor(a.length*q))]||0;return {opaquePixels:values.length,whiteFraction:white/Math.max(1,values.length),displayMedian:percentile(values,.5),displayP95:percentile(values,.95),displayP99:percentile(values,.99),linearP99:percentile(linearValues,.99),backgroundCorner:[...display.slice(0,3)]};
 },
 capture:()=>r.domElement.toDataURL('image/png'),
 setManual:async value=>{manual=value;motion=null;cancelAnimationFrame(request);request=0;while(!completeFence())await new Promise(s=>setTimeout(s,5));},
 renderFrame:async()=>{if(!manual)throw Error('Manual test mode required');while(!completeFence())await new Promise(s=>setTimeout(s,5));submittedAt=performance.now();render();frameRevision=revision;fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();while(!completeFence())await new Promise(s=>setTimeout(s,5));return window.HAIR_LAB.snapshot();}
};

function syncStyleUI(){
 document.querySelectorAll('[data-style]').forEach(e=>e.classList.toggle('selected',e.dataset.style===style));
 $('specimenName').textContent=STYLES[style].name;$('specimenDesc').textContent=style==='medium'?'基准 14 厘米 · 轻扫分束 · 柔顺垂落':'基准 34 厘米 · 细束聚散 · 自然垂落';
}
async function setStyle(value){
 if(!STYLES[value])throw Error('Invalid style');if(value===style)return;
 $('loading').hidden=false;$('loading').textContent='正在建立发束与重力平衡…';await new Promise(s=>requestAnimationFrame(()=>setTimeout(s,0)));
 style=value;dynamics.enabled=false;dynamics.sway=false;dynamics.paused=false;dynamics.configure(style,p.wave);u.styleIndex.value=style==='long'?1:0;u.rootY.value=STYLES[style].rootY;u.styleLength.value=STYLES[style].length;
 dirtyDynamics();syncStyleUI();$('full').click();$('windMotion').textContent='开启微风';$('swayRoots').classList.remove('selected');$('loading').hidden=true;wakeDynamics();
}
for(const e of document.querySelectorAll('[data-style]'))e.onclick=()=>setStyle(e.dataset.style);
for(const name of ['silkiness','clumping'])$(name).oninput=e=>{u[name].value=+e.target.value;$(name+'Value').textContent=e.target.value;invalidate('geometry');};
$('stiffness').oninput=e=>{dynamics.stiffness=+e.target.value;$('stiffnessValue').textContent=e.target.value;wakeDynamics();dynamics.active=true;};
$('damping').oninput=e=>{dynamics.damping=+e.target.value;$('dampingValue').textContent=e.target.value;};
$('swayRoots').onclick=()=>{dynamics.sway=!dynamics.sway;$('swayRoots').classList.toggle('selected',dynamics.sway);wakeDynamics();};
$('weightsView').onclick=()=>{u.weightDebug.value=1-u.weightDebug.value;$('weightsView').classList.toggle('selected',u.weightDebug.value>0);$('weightLegend').hidden=u.weightDebug.value===0;invalidate('shade');};
$('tipView').onclick=()=>setCamera({yaw:.30,pitch:0,distance:style==='long'?.22:.12,target:dynamics.sample(42,style==='long'?.90:.81)});
$('sideView').onclick=()=>setCamera({yaw:1.2,pitch:0,distance:STYLES[style].distance,target:STYLES[style].target});
$('exportRecipe').onclick=()=>{const blob=new Blob([JSON.stringify({version:VERSION,style,parameters:p,shaderWeights:{silkiness:u.silkiness.value,clumping:u.clumping.value},physics:dynamics.snapshot()},null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='hair-r03-recipe.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);};
HAIR_LAB.setStyle=setStyle;HAIR_LAB.guidePoint=(g,t)=>guidePoint(g,t).toArray();HAIR_LAB.setSway=v=>{dynamics.sway=!!v;wakeDynamics();};
HAIR_LAB.setPhysics=(stiffness,damping)=>{dynamics.stiffness=stiffness;dynamics.damping=damping;};
HAIR_LAB.setWeights=(silkiness,clumping)=>{if(![silkiness,clumping].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('Invalid weights');u.silkiness.value=silkiness;u.clumping.value=clumping;invalidate('geometry');};
syncStyleUI();fullView();lighting();new ResizeObserver(resize).observe($('view'));resize();

