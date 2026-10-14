import { VERSION, COUNT, SEGMENTS, makeRoots, hashFloats, halton, MATERIALS } from './kernel.mjs';
import { vertex, positionFragment, coverageFragment, fragment, shadowFragment, fullscreenVertex, accumulateFragment, presentFragment } from './shaders.mjs';
// THREE is embedded, pinned r169, with its MIT notice in the self-contained build.
const $ = id => document.getElementById(id);
const THREE = globalThis.THREE;
const parameters = { material:'chestnut', roughness:.30, variation:.36, diameter:70, frizz:.22, wave:1, lighting:'studio', rotation:0, exposure:1.25, shadowStrength:.52, scatterBoost:1, mode:0 };
const errors=[];window.addEventListener('error',e=>errors.push(String(e.message)));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
function boot(){
 const host=$('view'), renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
 host.prepend(renderer.domElement);renderer.setPixelRatio(1);renderer.autoClear=false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
 const gl=renderer.getContext();if(!gl.getExtension('EXT_color_buffer_float'))throw Error('此发丝样本需要 WebGL2 浮点渲染支持，请使用支持硬件加速的桌面浏览器。');
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(31,1,.02,5),camTarget=new THREE.Vector3(0,-.002,0);
 let yaw=.12,pitch=.035,distance=.66,samples=0,maxSamples=16,width=1,height=1,request=0,shadowDirty=true,spinning=false,lastTick=0,firstFrame=0,renderMS=[],positionDirty=true,fence=null,completedSamples=0,revision=0,pendingRevision=0;
 const specimen=makeRoots();const signature=hashFloats([specimen.roots,specimen.traits]);
 const geometry=new THREE.InstancedBufferGeometry();const coords=new Float32Array((SEGMENTS+1)*6),index=[];
 for(let j=0;j<=SEGMENTS;j++){coords.set([-1,j/SEGMENTS,0,1,j/SEGMENTS,0],j*6);if(j<SEGMENTS){const k=j*2;index.push(k,k+1,k+2,k+1,k+3,k+2);}}
 geometry.setAttribute('position',new THREE.BufferAttribute(coords,3));geometry.setIndex(index);
 geometry.setAttribute('rootData',new THREE.InstancedBufferAttribute(specimen.roots,4));geometry.setAttribute('trait',new THREE.InstancedBufferAttribute(specimen.traits,4));geometry.instanceCount=COUNT;
 const u={diameter:{value:70e-6},frizz:{value:.22},wave:{value:1},viewport:{value:new THREE.Vector2(1,1)},ortho:{value:0},orthoDir:{value:new THREE.Vector3(0,0,1)},positionMap:{value:null},sigmaA:{value:new THREE.Vector3(...MATERIALS.chestnut.sigma)},roughness:{value:.30},variation:{value:.36},exposure:{value:1.25},shadowStrength:{value:.52},scatterBoost:{value:1},mode:{value:0},lightDirs:{value:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]},lightColors:{value:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]},shadowMatrices:{value:[new THREE.Matrix4(),new THREE.Matrix4(),new THREE.Matrix4()]},shadow0:{value:null},shadow1:{value:null},shadow2:{value:null}};
 const material=new THREE.ShaderMaterial({uniforms:u,vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide,alphaToCoverage:false,depthWrite:false,depthTest:true,depthFunc:THREE.EqualDepth,transparent:false});
 const coverageMat=new THREE.ShaderMaterial({uniforms:u,vertexShader:vertex,fragmentShader:coverageFragment,side:THREE.DoubleSide,alphaToCoverage:true,colorWrite:false,depthWrite:true,depthTest:true});
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
 const depthU={diameter:u.diameter,frizz:u.frizz,wave:u.wave,viewport:{value:new THREE.Vector2(384,512)},ortho:{value:1},orthoDir:{value:new THREE.Vector3(0,0,1)},positionMap:u.positionMap,slab:{value:0}};
 const depthMat=new THREE.ShaderMaterial({uniforms:depthU,vertexShader:vertex,fragmentShader:shadowFragment,side:THREE.DoubleSide,depthWrite:false,depthTest:false,transparent:true,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendEquation:THREE.AddEquation});
 const shadowTargets=Array.from({length:3},()=>new THREE.WebGLRenderTarget(768,512,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,depthBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter}));
 const shadowCameras=Array.from({length:3},()=>new THREE.OrthographicCamera(-.18,.18,.18,-.18,.1,1.0));
 for(let i=0;i<3;i++)u['shadow'+i].value=shadowTargets[i].texture;
 const quadScene=new THREE.Scene(),quadCamera=new THREE.Camera(),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));quad.frustumCulled=false;quadScene.add(quad);
 const accU={currentFrame:{value:null},history:{value:null},sampleCount:{value:1}},outU={image:{value:null},exposure:{value:1.25}};
 const accMat=new THREE.ShaderMaterial({uniforms:accU,vertexShader:fullscreenVertex,fragmentShader:accumulateFragment,depthTest:false,depthWrite:false}),outMat=new THREE.ShaderMaterial({uniforms:outU,vertexShader:fullscreenVertex,fragmentShader:presentFragment,depthTest:false,depthWrite:false});
 let frame,accA,accB;
 const positionTarget=new THREE.WebGLRenderTarget(1024,Math.ceil(COUNT*81/1024),{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
 function rootTexture(data){const padded=new Float32Array(128*Math.ceil(COUNT/128)*4);padded.set(data);const tex=new THREE.DataTexture(padded,128,Math.ceil(COUNT/128),THREE.RGBAFormat,THREE.FloatType);tex.needsUpdate=true;return tex;}
 const positionU={rootMap:{value:rootTexture(specimen.roots)},traitMap:{value:rootTexture(specimen.traits)},wave:u.wave,frizz:u.frizz};
 const positionMat=new THREE.ShaderMaterial({uniforms:positionU,vertexShader:fullscreenVertex,fragmentShader:positionFragment,depthTest:false,depthWrite:false});
 u.positionMap.value=positionTarget.texture;
 function buildPositions(){quad.material=positionMat;renderer.setRenderTarget(positionTarget);renderer.setViewport(0,0,positionTarget.width,positionTarget.height);renderer.render(quadScene,quadCamera);positionDirty=false;}

 const bounds=[];for(const x of[-.060,.060])for(const y of[-.16,.15])for(const z of[-.04,.04])bounds.push(new THREE.Vector3(x,y,z));
 function updateCamera(){camera.position.set(camTarget.x+distance*Math.sin(yaw)*Math.cos(pitch),camTarget.y+distance*Math.sin(pitch),camTarget.z+distance*Math.cos(yaw)*Math.cos(pitch));camera.lookAt(camTarget);camera.updateMatrixWorld();}
 function setLighting(){
  const setups={studio:[[-.60,.46,1.0,6.8,6.2,5.5],[.82,.10,.72,1.5,1.72,2.1],[.35,.20,-1,6.3,6.6,7.4]],rake:[[-1,.12,.24,7.2,6.6,5.8],[.8,.4,.8,.6,.7,.85],[.4,.28,-1,4.2,4.5,5.0]],back:[[-.5,.35,.8,1.1,1.0,.9],[.8,.1,.8,.55,.65,.8],[.06,.15,-1,12,10.5,8.0]]};
  const angle=parameters.rotation*Math.PI/180;
  setups[parameters.lighting].forEach((a,i)=>{u.lightDirs.value[i].set(a[0]*Math.cos(angle)+a[2]*Math.sin(angle),a[1],a[2]*Math.cos(angle)-a[0]*Math.sin(angle)).normalize();u.lightColors.value[i].set(a[3],a[4],a[5]);});
  shadowDirty=true;
 }
 function shadows(){
  mesh.material=depthMat;renderer.setScissorTest(false);
  const bias=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
  for(let i=0;i<3;i++){
   depthU.orthoDir.value.copy(u.lightDirs.value[i]);const c=shadowCameras[i];c.position.copy(u.lightDirs.value[i]).multiplyScalar(.6);c.lookAt(0,-.004,0);c.updateMatrixWorld();
   const box=new THREE.Box3().setFromPoints(bounds.map(p=>p.clone().applyMatrix4(c.matrixWorldInverse)));
   c.left=box.min.x-.004;c.right=box.max.x+.004;c.bottom=box.min.y-.004;c.top=box.max.y+.004;c.near=-box.max.z-.004;c.far=-box.min.z+.004;c.updateProjectionMatrix();
   u.shadowMatrices.value[i].copy(bias).multiply(c.projectionMatrix).multiply(c.matrixWorldInverse);
   renderer.setRenderTarget(shadowTargets[i]);renderer.setViewport(0,0,768,512);renderer.setClearColor(0,0);renderer.clear(true,false,false);
   for(let s=0;s<2;s++){depthU.slab.value=s;renderer.setViewport(s*384,0,384,512);renderer.render(scene,c);}
  }
  mesh.material=material;shadowDirty=false;
 }
 function updateStatus(){ $('status').textContent=completedSamples>=maxSamples?'细丝精炼完成':`静帧精炼 ${completedSamples} / ${maxSamples}`; $('specimenInfo').textContent=`${COUNT.toLocaleString()} 根独立细丝 · 约 24 cm 发样 · ${parameters.diameter} μm 基准直径`; }
 function invalidate(){revision++;samples=0;completedSamples=0;if(!request)request=requestAnimationFrame(tick);}
 function resize(){
  const r=host.getBoundingClientRect();const scale=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1600000/(r.width*r.height)));
  width=Math.max(1,Math.round(r.width*scale));height=Math.max(1,Math.round(r.height*scale));renderer.setSize(width,height,false);renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';camera.aspect=r.width/r.height;camera.updateProjectionMatrix();
  for(const t of[frame,accA,accB])t?.dispose();
  frame=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,samples:4,depthBuffer:true});
  accA=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,depthBuffer:false});accB=accA.clone();
  u.viewport.value.set(width,height);invalidate();
 }
 function tick(t){
  request=0;
  if(fence){
   const state=gl.clientWaitSync(fence,0,0);
   if(state===gl.WAIT_FAILED){errors.push('GPU fence failed');$('status').textContent='显卡同步失败，请刷新';return;}
   if(state!==gl.ALREADY_SIGNALED&&state!==gl.CONDITION_SATISFIED){request=requestAnimationFrame(tick);return;}
   gl.deleteSync(fence);fence=null;
   if(pendingRevision===revision){completedSamples=samples;if(!firstFrame){firstFrame=performance.now();$('loading').hidden=true;document.body.dataset.ready='true';}updateStatus();}
  }
  const start=performance.now();
  if(spinning&&t-lastTick>140){parameters.rotation=(parameters.rotation+1.4)%360;$('rotation').value=parameters.rotation>180?parameters.rotation-360:parameters.rotation;setLighting();samples=0;lastTick=t;}
  if(samples<maxSamples){
   updateCamera();if(positionDirty)buildPositions();if(shadowDirty)shadows();
   const jitter=samples? [halton(samples,2)-.5,halton(samples,3)-.5]:[0,0];camera.setViewOffset(width,height,jitter[0],jitter[1],width,height);
   renderer.setRenderTarget(frame);renderer.setViewport(0,0,width,height);renderer.setClearColor($('background').value==='gray'?0x555555:0x030507,1);renderer.clear(true,true,false);mesh.material=coverageMat;renderer.render(scene,camera);mesh.material=material;renderer.render(scene,camera);camera.clearViewOffset();
   samples++;accU.currentFrame.value=frame.texture;accU.history.value=accA.texture;accU.sampleCount.value=samples;
   quad.material=accMat;renderer.setRenderTarget(accB);renderer.render(quadScene,quadCamera);[accA,accB]=[accB,accA];
   outU.image.value=accA.texture;outU.exposure.value=parameters.exposure;quad.material=outMat;renderer.setRenderTarget(null);renderer.setViewport(0,0,width,height);renderer.render(quadScene,quadCamera);
   fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);pendingRevision=revision;gl.flush();
   renderMS.push(performance.now()-start);if(renderMS.length>100)renderMS.shift();updateStatus();
  }
  if(samples<maxSamples||spinning||fence)request=requestAnimationFrame(tick);
 }
 function setParam(key,value){
  if(key==='material'){
   if(!MATERIALS[value])throw Error('Unknown optical preset');parameters.material=value;u.sigmaA.value.set(...MATERIALS[value].sigma);parameters.roughness=MATERIALS[value].roughness;u.roughness.value=parameters.roughness;$('roughness').value=parameters.roughness;
   document.querySelectorAll('[data-material]').forEach(b=>b.classList.toggle('selected',b.dataset.material===value));
  }else if(key==='lighting'){if(!['studio','rake','back'].includes(value))throw Error('Unknown light rig');parameters.lighting=value;$('lighting').value=value;setLighting();}
  else if(key==='rotation'){const n=Number(value);if(!Number.isFinite(n)||n< -180||n>180)throw Error('Invalid light rotation');parameters.rotation=n;setLighting();}
  else if(key in parameters){const n=Number(value);const limits={roughness:[.18,.55],variation:[0,.7],diameter:[40,120],frizz:[0,.6],wave:[0,1.4],exposure:[.4,2.8],shadowStrength:[0,1],scatterBoost:[0,2],mode:[0,3]};if(!Number.isFinite(n)||!limits[key]||n<limits[key][0]||n>limits[key][1])throw Error('Invalid parameter');parameters[key]=n;if(u[key])u[key].value=key==='diameter'?n*1e-6:n;if(['diameter','wave','frizz'].includes(key))shadowDirty=true;if(['wave','frizz'].includes(key))positionDirty=true;}
  else throw Error('Unknown parameter');
  document.querySelectorAll('input[type=range]').forEach(el=>{const o=$(el.id+'Value');if(o)o.textContent=String(parameters[el.id]??el.value);});invalidate();
 }
 document.querySelectorAll('[data-material]').forEach(b=>b.onclick=()=>setParam('material',b.dataset.material));
 for(const key of['roughness','variation','diameter','frizz','wave','rotation','exposure','shadowStrength','scatterBoost'])$(key).oninput=e=>setParam(key,e.target.value);
 $('lighting').onchange=e=>setParam('lighting',e.target.value);$('background').onchange=invalidate;$('mode').onchange=e=>setParam('mode',e.target.value);
 $('full').onclick=()=>{distance=.66;camTarget.set(0,-.002,0);yaw=.12;pitch=.035;invalidate();};
 $('macro').onclick=()=>{distance=.20;camTarget.set(.012,-.015,.006);yaw=.08;pitch=0;invalidate();};
 $('lightMove').onclick=()=>{spinning=!spinning;$('lightMove').textContent=spinning?'停止光源巡游':'光源巡游';invalidate();};
 $('reset').onclick=()=>{spinning=false;$('lightMove').textContent='光源巡游';for(const[k,v]of Object.entries({roughness:.30,variation:.36,diameter:70,frizz:.22,wave:1,rotation:0,exposure:1.25,shadowStrength:.52,scatterBoost:1,mode:0})){$(k).value=v;setParam(k,v);}setParam('material','chestnut');setParam('lighting','studio');$('full').click();};
 $('save').onclick=()=>{localStorage.setItem('kaopu.hair.fiber-r02',JSON.stringify({schema:'kaopu/hair-optics-specimen@1',seed:270314,parameters}));$('save').textContent='已保存本机参数';};
 let pointer=null;
 renderer.domElement.onpointerdown=e=>{pointer={x:e.clientX,y:e.clientY,shift:e.shiftKey};renderer.domElement.setPointerCapture(e.pointerId);};
 renderer.domElement.onpointermove=e=>{if(!pointer)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(pointer.shift){camTarget.x-=dx*distance*.0007;camTarget.y+=dy*distance*.0007;}else{yaw-=dx*.006;pitch=Math.max(-1.25,Math.min(1.25,pitch+dy*.006));}pointer.x=e.clientX;pointer.y=e.clientY;invalidate();};
 renderer.domElement.onpointerup=()=>{pointer=null;};renderer.domElement.onpointercancel=()=>{pointer=null;};
 renderer.domElement.onwheel=e=>{e.preventDefault();distance=Math.min(1.2,Math.max(.08,distance*Math.exp(e.deltaY*.001)));invalidate();};
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();errors.push('WebGL context lost');$('status').textContent='显卡上下文丢失，请刷新';cancelAnimationFrame(request);request=0;});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(request);request=0;}else invalidate();});
 window.HAIR_LAB={version:VERSION,source:document.querySelector('meta[name=source-commit]').content,parameters,setParam,snapshot:()=>({version:VERSION,source:document.querySelector('meta[name=source-commit]').content,parameters:{...parameters},count:COUNT,segments:SEGMENTS,signature,samples:completedSamples,submittedSamples:samples,maxSamples,width,height,renderer:gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL||gl.RENDERER),firstFrameMS:firstFrame,cpuSubmissionMS:renderMS.slice(),memory:renderer.info.memory,errors:errors.slice(),physics:false,eb1:false}),capture:()=>renderer.domElement.toDataURL('image/png'),invalidate};
 updateCamera();setLighting();new ResizeObserver(resize).observe(host);resize();
}
try{boot();}catch(e){errors.push(String(e));$('loading').hidden=false;$('loading').textContent='无法启动：'+String(e.message||e);$('status').textContent='交付未完成：当前设备未成功渲染';document.body.dataset.failed='true';console.error(e);}
