import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
const $=id=>document.getElementById(id),canvas=$('scene');
const storagePrefix=`coral-growth:${location.pathname}:`;
function readSession(name){try{return JSON.parse(sessionStorage.getItem(storagePrefix+name)||'null');}catch{return null;}}
function writeSession(name,value){try{sessionStorage.setItem(storagePrefix+name,JSON.stringify(value));return true;}catch{return false;}}
const resumeState=readSession('resume');try{sessionStorage.removeItem(storagePrefix+'resume');}catch{}
const lifecycle={phase:'running',disposed:false,contextLost:false,contextLostCount:0,contextRestoredCount:0,previousCleanup:readSession('cleanup'),cleanup:null,instanceId:globalThis.crypto?.randomUUID?.()??String(Date.now())};
const chooseRenderQuality=()=>matchMedia('(max-width: 640px)').matches?'mobilePreview':'preview';
let renderQuality=chooseRenderQuality(),rafId=null,mainDrawCalls=0,mainTriangles=0,beforeMainDraw=null,renderDirty=true;
const timings={geometryInstallCount:0,geometryInstallMsLast:0,geometryInstallMsTotal:0,geometryBytesInstalled:0,renderCount:0,renderSubmitMsLast:0,renderSubmitMsTotal:0,pixelDigestCount:0,pixelDigestMsLast:0,pixelDigestMsTotal:0,readbackMsLast:0,readbackMsTotal:0,bufferUploadCalls:0,bufferUploadBytes:0,bufferUploadSubmitMsTotal:0};
function invalidate(){renderDirty=true;}
const downloadURLs=new Map();
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});}catch(error){showError(`当前浏览器无法创建 WebGL 画面。请使用支持 WebGL 的浏览器。\n${error.message}`);throw error;}
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0x25292a,1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
// Count actual WebGL buffer upload submissions, not estimated GPU time or memory.
const uploadContext=renderer.getContext(),originalUploadMethods={bufferData:uploadContext.bufferData,bufferSubData:uploadContext.bufferSubData};
for(const method of ['bufferData','bufferSubData'])uploadContext[method]=function(...args){
 const source=method==='bufferData'?args[1]:args[2],elementBytes=source?.BYTES_PER_ELEMENT??1;
 const bytes=typeof source==='number'?source:(args[4]===undefined?(source?.byteLength??0):args[4]*elementBytes);
 const started=performance.now(),result=Reflect.apply(originalUploadMethods[method],this,args);timings.bufferUploadCalls++;timings.bufferUploadBytes+=bytes;timings.bufferUploadSubmitMsTotal+=performance.now()-started;return result;
};
const scene=new THREE.Scene(),target=new THREE.Vector3(0,1.35,0);
scene.add(new THREE.HemisphereLight(0xffffff,0x555c5c,2.2));
for(const [position,intensity] of [[[4,7,5],3.0],[[-4,4,-3],1.5],[[2,1,-5],.7]]){const light=new THREE.DirectionalLight(0xffffff,intensity);light.position.set(...position);scene.add(light);}
const perspective=new THREE.PerspectiveCamera(35,1,.01,100),orthographic=new THREE.OrthographicCamera(-2,2,2,-2,.01,100);let camera=perspective;
perspective.position.set(4,3.5,5.4);perspective.lookAt(target);orthographic.position.set(0,1.35,7);orthographic.lookAt(target);
const controls=new OrbitControls(camera,canvas);controls.target.copy(target);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=1.2;controls.maxDistance=14;controls.maxPolarAngle=Math.PI;controls.screenSpacePanning=true;controls.addEventListener('change',invalidate);
const material=new THREE.MeshStandardMaterial({color:0xbabbb8,metalness:0,roughness:1,side:THREE.FrontSide});let mesh=null,ranges=[],lineage=[],lastGeometry=null;
let framingBounds=resumeState?.framingSphere?new THREE.Sphere(new THREE.Vector3().fromArray(resumeState.framingSphere.center),resumeState.framingSphere.radius):null,fitPending=!resumeState?.camera,portraitHalfY=resumeState?.portraitHalfY??2.7,framingRecord=resumeState?.framingRecord??null,lastViewportWidth=0,lastViewportHeight=0;
const selectionMaterial=new THREE.MeshBasicMaterial({color:0xd0e3d8,wireframe:true,transparent:true,opacity:.38,depthTest:true});let selectedMesh=null;
let sequence=0,requested=0,displayed=0,geometryBusy=false,queued=false,playing=false,time=1,lastFrame=0,lastRequest=0,parameters={seed:'17',density:1,fold:1};
let worker;const pendingDownloads=new Map();
try{worker=new Worker(new URL('./geometry-worker.mjs',import.meta.url),{type:'module'});}catch(error){showError(`几何模块无法启动。此页面需要通过 HTTP(S) 打开，不能直接双击 file:// 文件。\n${error.message}`);throw error;}
worker.onerror=event=>{geometryBusy=false;stop();showError(`几何线程出错：${event.message||'请检查浏览器控制台或模块加载。'}`);};
worker.onmessage=({data})=>{
 if(lifecycle.disposed)return;
 if(data.type==='error'){geometryBusy=false;stop();showError(`几何生成失败：${data.message}`);return;}
 if(data.type==='obj'||data.type==='lineage'){
  const entry=pendingDownloads.get(data.id);if(!entry)return;pendingDownloads.delete(data.id);entry.button.disabled=false;entry.button.textContent=entry.label;
  download(data.blob??new Blob([data.contents],{type:'application/json'}),entry.filename);$('status').textContent=data.type==='obj'?`已生成 ${data.parts} 个分件的原始 OBJ；未做统一并集。`:'已生成完整配方、谱系与当前前沿 JSON。';return;
 }
 geometryBusy=false;
 if(data.id<requested){if(queued){queued=false;requestGeometry();}return;}
 const installStarted=performance.now();
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));geometry.setIndex(new THREE.BufferAttribute(data.indices,1));geometry.computeBoundingSphere();
 if(mesh){mesh.geometry.dispose();mesh.geometry=geometry;}else{mesh=new THREE.Mesh(geometry,material);mesh.onBeforeRender=()=>{beforeMainDraw={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};};mesh.onAfterRender=()=>{mainDrawCalls+=renderer.info.render.calls-beforeMainDraw.calls;mainTriangles+=renderer.info.render.triangles-beforeMainDraw.triangles;};scene.add(mesh);}
 ranges=data.ranges;lineage=data.lineage;lastGeometry=data;displayed=data.time;
 if(data.time>=.999||!framingBounds)framingBounds=geometry.boundingSphere.clone();
 updatePartOptions();updateSelected();
 $('part-count').textContent=`${ranges.length} 个活动分件`;
 $('status').textContent=lifecycle.contextLost?'图形上下文已丢失，等待恢复。':`画面 ${Math.round(displayed*100)}% · ${(data.indices.length/3).toLocaleString('zh-CN')} 三角面 · ${data.quality==='mobilePreview'?'手机采样 · ':''}原始分件预览`;
 canvas.dataset.renderedTime=String(displayed);canvas.dataset.vertices=String(data.positions.length/3);canvas.dataset.triangles=String(data.indices.length/3);canvas.dataset.generation=String(data.id);
 if(fitPending&&fitPortraitCamera())fitPending=false;
 timings.geometryInstallCount++;timings.geometryInstallMsLast=performance.now()-installStarted;timings.geometryInstallMsTotal+=timings.geometryInstallMsLast;timings.geometryBytesInstalled+=data.positions.byteLength+data.normals.byteLength+data.indices.byteLength;invalidate();
 if(queued){queued=false;requestGeometry();}
};
function requestGeometry(){
 if(lifecycle.disposed)return;
 if(geometryBusy){queued=true;return;}
 geometryBusy=true;requested=++sequence;lastRequest=performance.now();
 worker.postMessage({id:requested,type:'geometry',params:{...parameters},time,quality:renderQuality});
 $('status').textContent=`正在生成 ${Math.round(time*100)}% · 当前画面 ${Math.round(displayed*100)}%`;
}
function stageName(t){return t<.06?'连通低基底':t<.28?'多高低芽':t<.5?'主枝推进':t<.76?'层片向外展开':'密集回折层片';}
function updateTime(value){time=Math.max(0,Math.min(1,Number(value)));$('time').value=String(time);$('time-value').textContent=`${Math.round(time*100)}%`;$('stage-label').textContent=stageName(time);}
function stop(){playing=false;$('play').textContent='▶ 播放';$('play').setAttribute('aria-label',time>=1?'从头播放':'继续播放');}
function togglePlay(){if(lifecycle.disposed||lifecycle.contextLost)return;if(playing){stop();return;}if(time>=.999)updateTime(0);playing=true;$('play').textContent='Ⅱ 暂停';$('play').setAttribute('aria-label','暂停播放');lastFrame=performance.now();requestGeometry();}
$('play').onclick=togglePlay;$('restart').onclick=()=>{stop();updateTime(0);requestGeometry();};
$('time').addEventListener('input',event=>{stop();updateTime(event.target.value);requestGeometry();});
function updateParameters(){stop();parameters={seed:$('seed').value||'17',density:Number($('density').value),fold:Number($('fold').value)};$('density-value').textContent=`${parameters.density.toFixed(2)}×`;$('fold-value').textContent=`${parameters.fold.toFixed(2)}×`;$('part').value='';requestGeometry();}
let parameterTimer;
for(const id of ['density','fold'])$(id).addEventListener('input',()=>{$(`${id}-value`).textContent=`${Number($(id).value).toFixed(2)}×`;clearTimeout(parameterTimer);parameterTimer=setTimeout(updateParameters,140);});
$('seed').addEventListener('change',updateParameters);$('seed').addEventListener('keydown',event=>{if(event.key==='Enter'){$('seed').blur();updateParameters();}});
$('reset').onclick=()=>{clearTimeout(parameterTimer);$('seed').value='17';$('density').value='1';$('fold').value='1';$('wire').checked=false;material.wireframe=false;$('part').value='';updateTime(1);setView('perspective');fitPending=true;updateParameters();};
$('wire').addEventListener('change',()=>{material.wireframe=$('wire').checked;invalidate();});
function setView(view){
 if(lifecycle.disposed)return;
 const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
 const isPerspective=view==='perspective';camera=isPerspective?perspective:orthographic;controls.object=camera;controls.target.copy(target);camera.up.set(0,1,0);
 if(isPerspective){camera.position.set(4,3.5,5.4);camera.zoom=1;}else{camera.zoom=1;if(view==='front')camera.position.set(0,1.35,7);if(view==='side')camera.position.set(7,1.35,0);if(view==='top'){camera.position.set(0,8,0);camera.up.set(0,0,-1);}}
 camera.lookAt(target);controls.update();controls.enableDamping=damping;invalidate();resize();if(!fitPortraitCamera())fitPending=true;for(const button of document.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===view));
}
for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>setView(button.dataset.view);
function zoomCamera(factor){
 if(lifecycle.disposed||lifecycle.contextLost)return;
 if(camera.isOrthographicCamera){camera.zoom=Math.max(.3,Math.min(6,camera.zoom/factor));camera.updateProjectionMatrix();}
 else{const direction=camera.position.clone().sub(controls.target);const distance=Math.max(controls.minDistance,Math.min(controls.maxDistance,direction.length()*factor));camera.position.copy(controls.target).add(direction.normalize().multiplyScalar(distance));}
 controls.update();invalidate();renderScene();
}
$('zoom-in').onclick=()=>zoomCamera(.84);$('zoom-out').onclick=()=>zoomCamera(1/.84);
// Fit only explicit views / initial load on narrow screens. Geometry and timeline
// never change camera scale. The same framing sphere is retained through growth.
function availablePortraitRect(){
 const w=innerWidth,h=innerHeight,pad=12;
 const top=Math.max(document.querySelector('header').getBoundingClientRect().bottom,$('tools').getBoundingClientRect().bottom,$('views').getBoundingClientRect().bottom)+pad;
 const bottom=Math.min($('timeline').getBoundingClientRect().top,$('status').getBoundingClientRect().top,$('hint').getBoundingClientRect().top)-pad;
 return {left:pad,right:w-pad,top,bottom:Math.max(top+80,bottom),width:Math.max(80,w-pad*2),height:Math.max(80,bottom-top)};
}
function setPortraitProjection(rect=availablePortraitRect()){
 const w=innerWidth,h=innerHeight,offsetX=w/2-(rect.left+rect.right)/2,offsetY=h/2-(rect.top+rect.bottom)/2;
 // Shift the optical centre into the unobstructed rectangle; raycasting continues
 // to use the full canvas because the camera projection includes this offset.
 perspective.setViewOffset(w,h,offsetX,offsetY,w,h);
 orthographic.setViewOffset(w,h,offsetX,offsetY,w,h);
 return rect;
}
function fitPortraitCamera(){
 if(innerWidth>640){fitPending=false;return true;}
 if(!framingBounds)return false;
 const rect=setPortraitProjection(),radius=framingBounds.radius*1.06;
 const direction=camera.position.clone().sub(controls.target).normalize();
 const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
 target.copy(framingBounds.center);controls.target.copy(target);
 const halfVertical=THREE.MathUtils.degToRad(perspective.fov/2);
 const horizontalAngle=Math.atan(Math.tan(halfVertical)*rect.width/innerHeight);
 const verticalAngle=Math.atan(Math.tan(halfVertical)*rect.height/innerHeight);
 const distance=radius/Math.sin(Math.min(horizontalAngle,verticalAngle));
 controls.maxDistance=Math.max(14,distance*2);camera.zoom=1;
 portraitHalfY=radius*Math.max(innerHeight/rect.width,innerHeight/rect.height);
 const aspect=innerWidth/innerHeight;orthographic.left=-portraitHalfY*aspect;orthographic.right=portraitHalfY*aspect;orthographic.top=portraitHalfY;orthographic.bottom=-portraitHalfY;orthographic.updateProjectionMatrix();
 camera.position.copy(target).addScaledVector(direction,camera.isPerspectiveCamera?distance:Math.max(7,framingBounds.radius*3));camera.lookAt(target);camera.updateProjectionMatrix();controls.update();controls.enableDamping=damping;
 framingRecord={method:'actual geometry bounding sphere and unobstructed canvas rectangle',rect,sphere:{center:framingBounds.center.toArray(),radius:framingBounds.radius},margin:1.06,distance,portraitHalfY};invalidate();return true;
}
function resize(){
 if(lifecycle.disposed)return;invalidate();const nextQuality=chooseRenderQuality();if(nextQuality!==renderQuality){renderQuality=nextQuality;fitPending=true;requestGeometry();}
 const w=window.innerWidth,h=window.innerHeight,dimensionsChanged=w!==lastViewportWidth||h!==lastViewportHeight;lastViewportWidth=w;lastViewportHeight=h;renderer.setSize(w,h,false);perspective.aspect=w/h;
 const aspect=w/h,halfY=w<=640?portraitHalfY:2.15;orthographic.left=-halfY*aspect;orthographic.right=halfY*aspect;orthographic.top=halfY;orthographic.bottom=-halfY;
 if(w<=640){if(dimensionsChanged)setPortraitProjection();}else{perspective.clearViewOffset();orthographic.clearViewOffset();framingRecord=null;}
 perspective.updateProjectionMatrix();orthographic.updateProjectionMatrix();
}
window.addEventListener('resize',resize);
function updatePartOptions(){
 const ids=lineage.map(r=>r.id).join('|');if($('part').dataset.ids===ids)return;
 const selected=$('part').value;$('part').replaceChildren(new Option('全部组织（点击画面可选片）',''));
 for(const r of lineage)$('part').append(new Option(`${r.type} · ${r.id}`,r.id));$('part').dataset.ids=ids;$('part').value=lineage.some(r=>r.id===selected)?selected:'';
}
function updateSelected(){
 invalidate();
 if(selectedMesh){scene.remove(selectedMesh);selectedMesh.geometry.dispose();selectedMesh=null;}
 const id=$('part').value,r=lineage.find(r=>r.id===id);$('record').replaceChildren();$('part-obj').disabled=!r?.active;
 if(!r){const dt=document.createElement('dt');dt.textContent='未选择组织；当前显示全部分件';$('record').append(dt);return;}
 const items=[['ID',r.id],['父 ID',r.parent??'无（根基底）'],['出生时间',r.birth.toFixed(6)],['父枝到达',r.parentArrival.toFixed(6)],['父枝材料坐标',r.attachmentMaterialT===null?'—':r.attachmentMaterialT.toFixed(6)],['当前前沿',`${(r.front*100).toFixed(1)}%${r.active?'':' · 尚未出生'}`]];
 for(const [label,value] of items){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;$('record').append(dt,dd);}
 const range=ranges.find(p=>p.id===id);if(!range||!lastGeometry)return;
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(lastGeometry.positions.subarray(range.vertexStart*3,(range.vertexStart+range.vertexCount)*3).slice(),3));const indices=lastGeometry.indices.subarray(range.faceStart*3,(range.faceStart+range.faceCount)*3).map(i=>i-range.vertexStart);geometry.setIndex(new THREE.BufferAttribute(indices,1));selectedMesh=new THREE.Mesh(geometry,selectionMaterial);scene.add(selectedMesh);
}
$('part').addEventListener('change',updateSelected);
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
canvas.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY,t:performance.now()};});
canvas.addEventListener('pointerup',event=>{
 if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>5||performance.now()-down.t>500||!mesh)return;
 pointer.set(event.clientX/window.innerWidth*2-1,1-event.clientY/window.innerHeight*2);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObject(mesh)[0];if(!hit)return;
 const part=ranges.find(p=>hit.faceIndex>=p.faceStart&&hit.faceIndex<p.faceStart+p.faceCount);if(part){$('part').value=part.id;$('inspect').open=true;updateSelected();}
});
function download(blob,name){if(lifecycle.disposed)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();const timer=setTimeout(()=>{URL.revokeObjectURL(url);downloadURLs.delete(url);},60000);downloadURLs.set(url,timer);}
function exportFile(type,button,partId=null){
 if(lifecycle.disposed)return;
 stop();const id=++sequence,stage=displayed,params=lastGeometry?.params??parameters;
 const seed=String(params.seed).replace(/[^\w.-]/g,'_'),filename=`coral-${seed}-t${Math.round(stage*1000).toString().padStart(4,'0')}${partId?'-single-part':''}${type==='lineage'?'-lineage.json':'.obj'}`;
 pendingDownloads.set(id,{button,label:button.textContent,filename});button.disabled=true;button.textContent='生成中…';worker.postMessage({id,type,params,time:stage,partId,quality:lastGeometry?.quality??renderQuality,highQuality:$('export-high').checked});
}
$('obj').onclick=()=>exportFile('obj',$('obj'));$('part-obj').onclick=()=>exportFile('obj',$('part-obj'),$('part').value);$('json').onclick=()=>exportFile('lineage',$('json'));
canvas.addEventListener('keydown',event=>{if(event.code==='Space'){event.preventDefault();togglePlay();}if(event.key==='Escape'){$('part').value='';updateSelected();}});
function showError(text){$('error').hidden=false;$('error').textContent=text;}
function renderScene(force=false){if(lifecycle.disposed||lifecycle.contextLost||(!force&&!renderDirty))return false;mainDrawCalls=0;mainTriangles=0;const started=performance.now();renderer.render(scene,camera);timings.renderCount++;timings.renderSubmitMsLast=performance.now()-started;timings.renderSubmitMsTotal+=timings.renderSubmitMsLast;renderDirty=false;return true;}
function animate(now){rafId=null;if(lifecycle.disposed||lifecycle.contextLost)return;if(playing){const dt=Math.min(.12,(now-lastFrame)/1000);updateTime(time+dt/28);if(time>=1)stop();if(now-lastRequest>110)requestGeometry();}lastFrame=now;controls.update();renderScene();rafId=requestAnimationFrame(animate);}
function startAnimation(){if(rafId===null&&!lifecycle.disposed&&!lifecycle.contextLost){lastFrame=performance.now();rafId=requestAnimationFrame(animate);}}
function bufferMemory(){const position=lastGeometry?.positions.byteLength??0,normal=lastGeometry?.normals.byteLength??0,index=lastGeometry?.indices.byteLength??0;return {position,normal,index,total:position+normal+index};}
function rendererMemory(){return {geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs?.length??0};}
function onContextLost(event){
 if(lifecycle.disposed)return;event.preventDefault();lifecycle.phase='context-lost';lifecycle.contextLost=true;lifecycle.contextLostCount++;lifecycle.lastLossAt=Date.now();stop();if(rafId!==null)cancelAnimationFrame(rafId);rafId=null;controls.enabled=false;$('status').textContent='图形上下文已丢失，等待恢复。';
 // r170's renderer loss listener ran first but has not replaced its caches yet.
 // Retire old WebGLGeometries dispose closures/VAOs NOW, while GL is lost;
 // after restoration those closures would illegally delete prior-epoch objects.
 // BufferGeometry/Material.dispose release GPU bookkeeping only: CPU arrays,
 // geometry objects, material settings, lineage, selection and recipe stay intact.
 const retiredEpoch=lifecycle.contextRestoredCount,before=rendererMemory(),preservedBytes=bufferMemory().total,geometries=new Set([mesh?.geometry,selectedMesh?.geometry].filter(Boolean)),materials=new Set([material,selectionMaterial]);
 try{
  if(!renderer.getContext().isContextLost())throw new Error('Context-loss cleanup requires an actually lost WebGL context.');
  for(const geometry of geometries)geometry.dispose();
  for(const currentMaterial of materials)currentMaterial.dispose();
  renderer.renderLists.dispose();
  lifecycle.contextLossCleanup={status:'complete',retiredEpoch,contextWasLost:true,geometriesReleased:geometries.size,materialsReleased:materials.size,before,after:rendererMemory(),preservedCPUBufferBytes:preservedBytes};
 }catch(error){lifecycle.contextLossCleanup={status:'failed',retiredEpoch,message:error.message};lifecycle.phase='loss-cleanup-failed';showError(`图形上下文旧资源清理失败：${error.message}`);throw error;}
}
function onContextRestored(){
 if(lifecycle.disposed)return;lifecycle.phase='restoring';lifecycle.contextLost=false;lifecycle.contextRestoredCount++;lifecycle.lastRestoreAt=Date.now();
 try{
  // Three's earlier-registered restore listener has now created fresh caches.
  if(lifecycle.contextLossCleanup?.status!=='complete'||lifecycle.contextLossCleanup.retiredEpoch!==lifecycle.contextRestoredCount-1)throw new Error('Previous-context resource cleanup did not complete for this GPU epoch.');
  for(const object of [mesh,selectedMesh])if(object){for(const attribute of Object.values(object.geometry.attributes))attribute.needsUpdate=true;if(object.geometry.index)object.geometry.index.needsUpdate=true;object.material.needsUpdate=true;}
  controls.enabled=true;resize();renderScene(true);lifecycle.phase='running';$('status').textContent=`图形上下文已恢复 · 当前画面 ${Math.round(displayed*100)}%`;startAnimation();
 }catch(error){lifecycle.phase='restore-failed';showError(`图形上下文恢复失败：${error.message}`);}
}
canvas.addEventListener('webglcontextlost',onContextLost,false);canvas.addEventListener('webglcontextrestored',onContextRestored,false);
function disposePage(event){
 if(lifecycle.disposed)return;
 const before={buffers:bufferMemory(),rendererMemory:rendererMemory()};
 writeSession('resume',{params:{...parameters},time,framingSphere:framingBounds?{center:framingBounds.center.toArray(),radius:framingBounds.radius}:null,portraitHalfY,framingRecord,camera:{view:document.querySelector('[data-view][aria-pressed=true]')?.dataset.view??'perspective',position:camera.position.toArray(),up:camera.up.toArray(),target:controls.target.toArray(),zoom:camera.zoom}});
 lifecycle.disposed=true;lifecycle.phase='disposed';stop();const record={instanceId:lifecycle.instanceId,event:'pagehide',persisted:!!event.persisted,at:Date.now(),before,errors:[]};
 const release=(name,fn)=>{try{fn();record[name]=true;}catch(error){record[name]=false;record.errors.push(`${name}: ${error.message}`);}};
 release('rafCancelled',()=>{if(rafId!==null)cancelAnimationFrame(rafId);rafId=null;});
 release('timersCleared',()=>{clearTimeout(parameterTimer);for(const [url,timer] of downloadURLs){clearTimeout(timer);URL.revokeObjectURL(url);}downloadURLs.clear();});
 release('workerTerminated',()=>{worker?.terminate();worker=null;geometryBusy=false;queued=false;pendingDownloads.clear();});
 release('controlsDisposed',()=>{controls.dispose();controls.enabled=false;window.removeEventListener('resize',resize);});
 canvas.removeEventListener('webglcontextlost',onContextLost);canvas.removeEventListener('webglcontextrestored',onContextRestored);
 const gl=renderer.getContext(),lossExtension=gl.isContextLost()?null:gl.getExtension('WEBGL_lose_context');
 release('geometryDisposed',()=>{mesh?.geometry.dispose();selectedMesh?.geometry.dispose();scene.clear();mesh=null;selectedMesh=null;lastGeometry=null;ranges=[];lineage=[];mainDrawCalls=0;mainTriangles=0;});
 release('materialsDisposed',()=>{material.dispose();selectionMaterial.dispose();});
 release('rendererDisposed',()=>{renderer.renderLists.dispose();renderer.dispose();for(const method of ['bufferData','bufferSubData'])uploadContext[method]=originalUploadMethods[method];});
 record.contextLossRequested=!!lossExtension;release('gpuContextReleased',()=>{if(lossExtension)lossExtension.loseContext();});record.gpuContextLost=gl.isContextLost();
 record.after={buffers:bufferMemory(),rendererMemory:rendererMemory(),workerAlive:worker!==null,rafPending:rafId!==null,objectURLs:downloadURLs.size};
 lifecycle.cleanup=record;record.saved=writeSession('cleanup',record);
}
window.addEventListener('pagehide',disposePage);
window.addEventListener('pageshow',event=>{if(event.persisted&&lifecycle.disposed){const record=readSession('cleanup');if(record)writeSession('cleanup',{...record,bfcacheReloadRequested:true});location.reload();}});
resize();
if(resumeState?.params){
 parameters={seed:String(resumeState.params.seed??'17'),density:Number(resumeState.params.density??1),fold:Number(resumeState.params.fold??1)};$('seed').value=parameters.seed;$('density').value=String(parameters.density);$('fold').value=String(parameters.fold);$('density-value').textContent=`${parameters.density.toFixed(2)}×`;$('fold-value').textContent=`${parameters.fold.toFixed(2)}×`;
 updateTime(Number.isFinite(resumeState.time)?resumeState.time:1);
 const saved=resumeState.camera;if(saved){setView(saved.view);camera.position.fromArray(saved.position);camera.up.fromArray(saved.up);camera.zoom=saved.zoom;controls.target.fromArray(saved.target);target.copy(controls.target);fitPending=false;camera.updateProjectionMatrix();controls.update();}
}else updateTime(1);
requestGeometry();startAnimation();
// Read-only audit: observations of actual buffers and WebGL output, never a pass flag.
function exposeReadonlyAudit(){
 let fingerprintGeneration=0,fingerprint=null;
 const hashBytes=bytes=>{let hash=2166136261;for(let i=0;i<bytes.length;i++)hash=Math.imul(hash^bytes[i],16777619);return (hash>>>0).toString(16).padStart(8,'0');};
 const geometryFingerprint=()=>{
  if((lastGeometry?.id??0)!==fingerprintGeneration){fingerprintGeneration=lastGeometry?.id??0;fingerprint=lastGeometry?{
   positions:hashBytes(new Uint8Array(lastGeometry.positions.buffer,lastGeometry.positions.byteOffset,lastGeometry.positions.byteLength)),
   indices:hashBytes(new Uint8Array(lastGeometry.indices.buffer,lastGeometry.indices.byteOffset,lastGeometry.indices.byteLength))
  }:null;}
  return fingerprint?{...fingerprint}:null;
 };
 const audit={
  get state(){return {
   requestedTime:time,displayedTime:displayed,playing,parameters:{...parameters},
   displayedParameters:lastGeometry?{...lastGeometry.params}:null,
   generationId:lastGeometry?.id??0,generationMs:lastGeometry?.ms??null,geometryBusy,queued,
   renderQuality,displayedQuality:lastGeometry?.quality??null,renderDirty,timings:{...timings,timingScope:'CPU/main-thread submission wall times; not GPU elapsed time'},buffers:bufferMemory(),rendererMemory:rendererMemory(),mainDrawCalls,mainTriangles,materialSide:'FrontSide',
   lifecycle:JSON.parse(JSON.stringify(lifecycle)),workerAlive:worker!==null,rafPending:rafId!==null,
   geometryFingerprint:geometryFingerprint(),rendererTriangles:renderer.info.render.triangles,rendererCalls:renderer.info.render.calls,
   parts:ranges.length,vertices:lastGeometry?.positions.length/3||0,faces:lastGeometry?.indices.length/3||0,union:false,selected:$('part').value,
   framing:framingRecord?JSON.parse(JSON.stringify(framingRecord)):null,
   camera:{type:camera.type,position:camera.position.toArray(),up:camera.up.toArray(),zoom:camera.zoom,target:controls.target.toArray()}
  };},
  pixelDigest(){
   if(lifecycle.disposed||lifecycle.contextLost)return {unavailable:lifecycle.phase,nonBackgroundPixels:0,hash:null};
   const digestStarted=performance.now(),gl=renderer.getContext(),glErrorBefore=gl.getError();
   // readPixels immediately follows a synchronous draw; no preserved-frame assumption.
   renderScene(true);
   const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,pixels=new Uint8Array(width*height*4);
   const readStarted=performance.now();gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);timings.readbackMsLast=performance.now()-readStarted;timings.readbackMsTotal+=timings.readbackMsLast;
   const glError=gl.getError(),border=new Map();
   const sample=(x,y)=>{const i=(y*width+x)*4,key=`${pixels[i]},${pixels[i+1]},${pixels[i+2]},${pixels[i+3]}`;border.set(key,(border.get(key)||0)+1);};
   for(let i=0;i<20;i++){const x=Math.min(width-1,Math.floor(i*width/20)),y=Math.min(height-1,Math.floor(i*height/20));sample(x,0);sample(x,height-1);sample(0,y);sample(width-1,y);}
   const background=[...border].sort((a,b)=>b[1]-a[1])[0][0].split(',').map(Number);let nonBackgroundPixels=0,minX=width,minY=height,maxX=-1,maxY=-1;
   for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-background[0])+Math.abs(pixels[i+1]-background[1])+Math.abs(pixels[i+2]-background[2])>9){nonBackgroundPixels++;const x=(i/4)%width,y=height-1-Math.floor(i/4/width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
   const hash=hashBytes(pixels);timings.pixelDigestCount++;timings.pixelDigestMsLast=performance.now()-digestStarted;timings.pixelDigestMsTotal+=timings.pixelDigestMsLast;
   return {width,height,background,nonBackgroundBounds:{minX,minY,maxX,maxY},nonBackgroundPixels,nonBackgroundFraction:nonBackgroundPixels/(width*height),hash,glErrorBefore,glError,rendererTriangles:renderer.info.render.triangles,rendererCalls:renderer.info.render.calls,mainDrawCalls,mainTriangles,buffers:bufferMemory(),rendererMemory:rendererMemory(),readbackMs:timings.readbackMsLast,pixelDigestMs:timings.pixelDigestMsLast,renderSubmitMs:timings.renderSubmitMsLast};
  }
 };
 Object.defineProperty(window,'__coralAudit',{value:Object.freeze(audit),writable:false,configurable:false});
}
exposeReadonlyAudit();
