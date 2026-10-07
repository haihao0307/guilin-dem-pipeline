import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
const $=id=>document.getElementById(id),canvas=$('scene');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});}catch(error){showError(`当前浏览器无法创建 WebGL 画面。请使用支持 WebGL 的浏览器。\n${error.message}`);throw error;}
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0x25292a,1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const scene=new THREE.Scene(),target=new THREE.Vector3(0,1.35,0);
scene.add(new THREE.HemisphereLight(0xffffff,0x555c5c,2.2));
for(const [position,intensity] of [[[4,7,5],3.0],[[-4,4,-3],1.5],[[2,1,-5],.7]]){const light=new THREE.DirectionalLight(0xffffff,intensity);light.position.set(...position);scene.add(light);}
const perspective=new THREE.PerspectiveCamera(35,1,.01,100),orthographic=new THREE.OrthographicCamera(-2,2,2,-2,.01,100);let camera=perspective;
perspective.position.set(4,3.5,5.4);perspective.lookAt(target);orthographic.position.set(0,1.35,7);orthographic.lookAt(target);
const controls=new OrbitControls(camera,canvas);controls.target.copy(target);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=1.2;controls.maxDistance=14;controls.maxPolarAngle=Math.PI;controls.screenSpacePanning=true;
const material=new THREE.MeshStandardMaterial({color:0xbabbb8,metalness:0,roughness:1,side:THREE.DoubleSide});let mesh=null,ranges=[],lineage=[],lastGeometry=null;
const selectionMaterial=new THREE.MeshBasicMaterial({color:0xd0e3d8,wireframe:true,transparent:true,opacity:.38,depthTest:true});let selectedMesh=null;
let sequence=0,requested=0,displayed=0,geometryBusy=false,queued=false,playing=false,time=1,lastFrame=0,lastRequest=0,parameters={seed:'17',density:1,fold:1};
let worker;const pendingDownloads=new Map();
try{worker=new Worker(new URL('./geometry-worker.mjs',import.meta.url),{type:'module'});}catch(error){showError(`几何模块无法启动。此页面需要通过 HTTP(S) 打开，不能直接双击 file:// 文件。\n${error.message}`);throw error;}
worker.onerror=event=>{geometryBusy=false;stop();showError(`几何线程出错：${event.message||'请检查浏览器控制台或模块加载。'}`);};
worker.onmessage=({data})=>{
 if(data.type==='error'){geometryBusy=false;stop();showError(`几何生成失败：${data.message}`);return;}
 if(data.type==='obj'||data.type==='lineage'){
  const entry=pendingDownloads.get(data.id);if(!entry)return;pendingDownloads.delete(data.id);entry.button.disabled=false;entry.button.textContent=entry.label;
  download(data.blob??new Blob([data.contents],{type:'application/json'}),entry.filename);$('status').textContent=data.type==='obj'?`已生成 ${data.parts} 个分件的原始 OBJ；未做统一并集。`:'已生成完整配方、谱系与当前前沿 JSON。';return;
 }
 geometryBusy=false;
 if(data.id<requested){if(queued){queued=false;requestGeometry();}return;}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));geometry.setIndex(new THREE.BufferAttribute(data.indices,1));geometry.computeBoundingSphere();
 if(mesh){mesh.geometry.dispose();mesh.geometry=geometry;}else{mesh=new THREE.Mesh(geometry,material);scene.add(mesh);}
 ranges=data.ranges;lineage=data.lineage;lastGeometry=data;displayed=data.time;
 updatePartOptions();updateSelected();
 $('part-count').textContent=`${ranges.length} 个活动分件`;
 $('status').textContent=`画面 ${Math.round(displayed*100)}% · ${(data.indices.length/3).toLocaleString('zh-CN')} 三角面 · 原始分件预览`;
 canvas.dataset.renderedTime=String(displayed);canvas.dataset.vertices=String(data.positions.length/3);canvas.dataset.triangles=String(data.indices.length/3);canvas.dataset.generation=String(data.id);
 if(queued){queued=false;requestGeometry();}
};
function requestGeometry(){
 if(geometryBusy){queued=true;return;}
 geometryBusy=true;requested=++sequence;lastRequest=performance.now();
 worker.postMessage({id:requested,type:'geometry',params:{...parameters},time});
 $('status').textContent=`正在生成 ${Math.round(time*100)}% · 当前画面 ${Math.round(displayed*100)}%`;
}
function stageName(t){return t<.06?'连通低基底':t<.28?'多高低芽':t<.5?'主枝推进':t<.76?'层片向外展开':'密集回折层片';}
function updateTime(value){time=Math.max(0,Math.min(1,Number(value)));$('time').value=String(time);$('time-value').textContent=`${Math.round(time*100)}%`;$('stage-label').textContent=stageName(time);}
function stop(){playing=false;$('play').textContent='▶ 播放';$('play').setAttribute('aria-label',time>=1?'从头播放':'继续播放');}
function togglePlay(){if(playing){stop();return;}if(time>=.999)updateTime(0);playing=true;$('play').textContent='Ⅱ 暂停';$('play').setAttribute('aria-label','暂停播放');lastFrame=performance.now();requestGeometry();}
$('play').onclick=togglePlay;$('restart').onclick=()=>{stop();updateTime(0);requestGeometry();};
$('time').addEventListener('input',event=>{stop();updateTime(event.target.value);requestGeometry();});
function updateParameters(){stop();parameters={seed:$('seed').value||'17',density:Number($('density').value),fold:Number($('fold').value)};$('density-value').textContent=`${parameters.density.toFixed(2)}×`;$('fold-value').textContent=`${parameters.fold.toFixed(2)}×`;$('part').value='';requestGeometry();}
let parameterTimer;
for(const id of ['density','fold'])$(id).addEventListener('input',()=>{$(`${id}-value`).textContent=`${Number($(id).value).toFixed(2)}×`;clearTimeout(parameterTimer);parameterTimer=setTimeout(updateParameters,140);});
$('seed').addEventListener('change',updateParameters);$('seed').addEventListener('keydown',event=>{if(event.key==='Enter'){$('seed').blur();updateParameters();}});
$('reset').onclick=()=>{clearTimeout(parameterTimer);$('seed').value='17';$('density').value='1';$('fold').value='1';$('wire').checked=false;material.wireframe=false;$('part').value='';updateTime(1);setView('perspective');updateParameters();};
$('wire').addEventListener('change',()=>{material.wireframe=$('wire').checked;});
function setView(view){
 const isPerspective=view==='perspective';camera=isPerspective?perspective:orthographic;controls.object=camera;controls.target.copy(target);camera.up.set(0,1,0);
 if(isPerspective){camera.position.set(4,3.5,5.4);camera.zoom=1;}else{camera.zoom=1;if(view==='front')camera.position.set(0,1.35,7);if(view==='side')camera.position.set(7,1.35,0);if(view==='top'){camera.position.set(0,8,0);camera.up.set(0,0,-1);}}
 camera.lookAt(target);controls.update();resize();for(const button of document.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===view));
}
for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>setView(button.dataset.view);
function resize(){const w=window.innerWidth,h=window.innerHeight;renderer.setSize(w,h,false);perspective.aspect=w/h;perspective.updateProjectionMatrix();const aspect=w/h,halfY=aspect<.8?2.7:2.15;orthographic.left=-halfY*aspect;orthographic.right=halfY*aspect;orthographic.top=halfY;orthographic.bottom=-halfY;orthographic.updateProjectionMatrix();if(aspect<.8&&camera===perspective&&camera.position.distanceTo(controls.target)<8.5)camera.position.copy(controls.target).add(new THREE.Vector3(4,2.15,5.4).normalize().multiplyScalar(8.8));}
window.addEventListener('resize',resize);
function updatePartOptions(){
 const ids=lineage.map(r=>r.id).join('|');if($('part').dataset.ids===ids)return;
 const selected=$('part').value;$('part').replaceChildren(new Option('全部组织（点击画面可选片）',''));
 for(const r of lineage)$('part').append(new Option(`${r.type} · ${r.id}`,r.id));$('part').dataset.ids=ids;$('part').value=lineage.some(r=>r.id===selected)?selected:'';
}
function updateSelected(){
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
function download(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function exportFile(type,button,partId=null){
 stop();const id=++sequence,stage=displayed,params=lastGeometry?.params??parameters;
 const seed=String(params.seed).replace(/[^\w.-]/g,'_'),filename=`coral-${seed}-t${Math.round(stage*1000).toString().padStart(4,'0')}${partId?'-single-part':''}${type==='lineage'?'-lineage.json':'.obj'}`;
 pendingDownloads.set(id,{button,label:button.textContent,filename});button.disabled=true;button.textContent='生成中…';worker.postMessage({id,type,params,time:stage,partId,highQuality:$('export-high').checked});
}
$('obj').onclick=()=>exportFile('obj',$('obj'));$('part-obj').onclick=()=>exportFile('obj',$('part-obj'),$('part').value);$('json').onclick=()=>exportFile('lineage',$('json'));
canvas.addEventListener('keydown',event=>{if(event.code==='Space'){event.preventDefault();togglePlay();}if(event.key==='Escape'){$('part').value='';updateSelected();}});
function showError(text){$('error').hidden=false;$('error').textContent=text;}
function animate(now){requestAnimationFrame(animate);if(playing){const dt=Math.min(.12,(now-lastFrame)/1000);updateTime(time+dt/28);if(time>=1)stop();if(now-lastRequest>110)requestGeometry();}lastFrame=now;controls.update();renderer.render(scene,camera);}
resize();updateTime(1);requestGeometry();requestAnimationFrame(animate);
// Read-only audit: observations of actual buffers and WebGL output, never a pass flag.
function exposeReadonlyAudit(){
 let fingerprintSource=null,fingerprint=null;
 const hashBytes=bytes=>{let hash=2166136261;for(let i=0;i<bytes.length;i++)hash=Math.imul(hash^bytes[i],16777619);return (hash>>>0).toString(16).padStart(8,'0');};
 const geometryFingerprint=()=>{
  if(lastGeometry!==fingerprintSource){fingerprintSource=lastGeometry;fingerprint=lastGeometry?{
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
   geometryFingerprint:geometryFingerprint(),rendererTriangles:renderer.info.render.triangles,rendererCalls:renderer.info.render.calls,
   parts:ranges.length,vertices:lastGeometry?.positions.length/3||0,faces:lastGeometry?.indices.length/3||0,union:false,selected:$('part').value,
   camera:{type:camera.type,position:camera.position.toArray(),up:camera.up.toArray(),zoom:camera.zoom,target:controls.target.toArray()}
  };},
  pixelDigest(){
   const gl=renderer.getContext(),glErrorBefore=gl.getError();
   // readPixels immediately follows a synchronous draw; no preserved-frame assumption.
   renderer.render(scene,camera);
   const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,pixels=new Uint8Array(width*height*4);
   gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   const glError=gl.getError(),border=new Map();
   const sample=(x,y)=>{const i=(y*width+x)*4,key=`${pixels[i]},${pixels[i+1]},${pixels[i+2]},${pixels[i+3]}`;border.set(key,(border.get(key)||0)+1);};
   for(let i=0;i<20;i++){const x=Math.min(width-1,Math.floor(i*width/20)),y=Math.min(height-1,Math.floor(i*height/20));sample(x,0);sample(x,height-1);sample(0,y);sample(width-1,y);}
   const background=[...border].sort((a,b)=>b[1]-a[1])[0][0].split(',').map(Number);let nonBackgroundPixels=0;
   for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-background[0])+Math.abs(pixels[i+1]-background[1])+Math.abs(pixels[i+2]-background[2])>9)nonBackgroundPixels++;
   return {width,height,background,nonBackgroundPixels,nonBackgroundFraction:nonBackgroundPixels/(width*height),hash:hashBytes(pixels),glErrorBefore,glError,rendererTriangles:renderer.info.render.triangles,rendererCalls:renderer.info.render.calls};
  }
 };
 Object.defineProperty(window,'__coralAudit',{value:Object.freeze(audit),writable:false,configurable:false});
}
exposeReadonlyAudit();
