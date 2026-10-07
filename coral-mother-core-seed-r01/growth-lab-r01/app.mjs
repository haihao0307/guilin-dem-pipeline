import * as THREE from './vendor/three.module.js';
import {DEFAULTS,VERSION} from './growth.mjs';
const $=id=>document.getElementById(id);const options={...DEFAULTS};
let renderer,scene,camera,mesh,worker,request=0,frames=[],frameIndex=0,playing=false,done=false,mask='material',wire=false,lastTime=0,accumulator=0,lastShown=-1;
let target=new THREE.Vector3(0,.64,0),azimuth=.68,elevation=.28,distance=2.6,drag=null,pointers=new Map(),pinchDistance=0;
const state={version:VERSION,webgl:false,compiled:false,frame:0,vertices:0,triangles:0,generation:0,complete:false,view:'material',errors:[]};window.__CORAL_GROWTH__=state;
function fail(message){state.errors.push(message);$('renderError').hidden=false;$('renderError').textContent=message;$('state').textContent='图形运行受阻';}
try{
 renderer=new THREE.WebGLRenderer({canvas:$('view'),antialias:true,alpha:true,powerPreference:'default'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(42,1,.01,100);scene.add(new THREE.HemisphereLight(0xc0e8ed,0x18383b,2.0));
 for(const [color,intensity,x,y,z] of [[0xffd9b2,4.2,2,4,3],[0x83c9d8,2.3,-3,2,0],[0xf6d6ad,3,0,3,-2]]){const l=new THREE.DirectionalLight(color,intensity);l.position.set(x,y,z);scene.add(l);}
 state.webgl=true;
 new ResizeObserver(()=>{const r=$('viewport').getBoundingClientRect();if(r.width<1||r.height<1)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}).observe($('viewport'));
 $('view').addEventListener('webglcontextlost',e=>{e.preventDefault();playing=false;fail('图形上下文已丢失，请重新打开本案例。当前参数仍保留在页面中。');});
}catch(e){fail('此浏览器未提供可用 WebGL，无法显示实际三维网格。请换用支持 WebGL 的浏览器；本页不会用截图代替实时结果。');}
function cameraUpdate(){camera.position.set(target.x+Math.sin(azimuth)*Math.cos(elevation)*distance,target.y+Math.sin(elevation)*distance,target.z+Math.cos(azimuth)*Math.cos(elevation)*distance);camera.lookAt(target);}
function colors(data){let rgb=new Float32Array(data.positions.length),color=new THREE.Color();for(let i=0;i<data.positions.length/3;i++){
 let c=data.masks[i*3],d=data.masks[i*3+1],s=data.masks[i*3+2];
 if(mask==='material'){let y=data.positions[i*3+1];color.setHSL(.049+.031*Math.min(1,c*.75+.1+y*.17),.70,.25+.20*c+.055*d);}
 else{let v=mask==='curvature'?c:mask==='direction'?d:s;color.setHSL(.57-.53*v,.7,.25+.32*v);}
 rgb.set([color.r,color.g,color.b],i*3);
 }return rgb;}
function showFrame(index){if(!frames[index])return;frameIndex=index;let d=frames[index];lastShown=index;state.frame=d.frame;state.vertices=d.stats.vertices;state.triangles=d.stats.triangles;state.view=mask;
 if(renderer){let geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(d.positions,3));geo.setIndex(new THREE.BufferAttribute(d.indices,1));geo.setAttribute('color',new THREE.BufferAttribute(colors(d),3));geo.computeVertexNormals();geo.computeBoundingSphere();
  if(mesh){mesh.geometry.dispose();mesh.geometry=geo;mesh.material.wireframe=wire;}else{mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.66,metalness:.02,side:THREE.DoubleSide}));scene.add(mesh);}state.compiled=false;
 }
 state.geometryFingerprint=Array.from(d.positions.slice(0,90)).concat(Array.from(d.positions.slice(-90))).map(x=>x.toFixed(6)).join(',');
 $('frameText').textContent=String(d.frame).padStart(3,'0');$('timeline').value=d.frame;$('vertices').textContent=d.stats.vertices.toLocaleString();$('splits').textContent=d.stats.splits.toLocaleString();$('area').textContent=d.stats.area.toFixed(2);}
function generate(){
 request++;state.generation=request;state.complete=false;done=false;playing=false;frames=[];lastShown=-1;$('play').textContent='▶';$('play').setAttribute('aria-label','播放生长');if(worker)worker.terminate();
 $('state').textContent='正在计算真实生长序列';$('computeProgress').style.width='0%';$('dirty').textContent='相同种子与参数可重复生成';$('seedBadge').textContent=`SEED ${String(options.seed).padStart(4,'0')}`;
 $('formTitle').textContent={rosette:'层叠生长',cup:'单杯生长',colony:'群落生长'}[options.form];
 worker=new Worker('./worker.mjs',{type:'module'});worker.onmessage=({data})=>{if(data.id!==request)return;if(data.kind==='error'){fail('生长求解失败：'+data.message);return;}if(data.kind==='done'){done=true;state.complete=true;$('state').textContent='计算完成 · 可逐帧观察';showFrame(Math.min(40,frames.length-1));return;}if(data.kind==='frame'){frames[data.frame/3]=data;$('computeProgress').style.width=`${data.frame/180*100}%`;if(data.frame===0)showFrame(0);if(data.frame%30===0)$('state').textContent=`生长迭代 ${data.frame} / 180`;}};worker.onerror=e=>fail('生长计算线程失败：'+e.message);worker.postMessage({id:request,options});state.parameters={...options};
}
for(const id of ['rate','curvature','direction','shadow','ruffle'])$(id).addEventListener('input',()=>{$(id+'Value').textContent=Number($(id).value).toFixed(2);$('dirty').textContent='参数已改变，点击“重新生长”计算';});
$('regenerate').addEventListener('click',()=>{for(const k of ['rate','curvature','direction','shadow','ruffle'])options[k]=Number($(k).value);options.seed=Math.max(1,Math.min(999999,Number($('seed').value)||17));$('seed').value=options.seed;generate();});
$('nextSeed').onclick=()=>{$('seed').value=(Number($('seed').value)||17)+1;$('dirty').textContent='种子已改变，点击“重新生长”计算';};
for(const b of document.querySelectorAll('[data-form]'))b.onclick=()=>{options.form=b.dataset.form;document.querySelectorAll('[data-form]').forEach(x=>x.classList.toggle('selected',x===b));generate();};
for(const b of document.querySelectorAll('[data-mask]'))b.onclick=()=>{mask=b.dataset.mask;document.querySelectorAll('[data-mask]').forEach(x=>x.classList.toggle('selected',x===b));showFrame(frameIndex);};
$('wireframe').onclick=()=>{wire=!wire;$('wireframe').setAttribute('aria-pressed',String(wire));if(mesh)mesh.material.wireframe=wire;state.wireframe=wire;};
function setPlaying(value){playing=value;accumulator=0;$('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?'暂停生长':'播放生长');state.playing=playing;}
$('play').onclick=()=>{if(!done)return;if(frameIndex>=frames.length-1)showFrame(0);setPlaying(!playing);};
$('restart').onclick=()=>{setPlaying(false);showFrame(0);};$('step').onclick=()=>{setPlaying(false);showFrame(Math.min(frames.length-1,frameIndex+1));};
$('timeline').oninput=()=>{setPlaying(false);showFrame(Math.min(frames.length-1,Math.round(Number($('timeline').value)/3)));};
$('homeCamera').onclick=()=>{azimuth=.68;elevation=.28;distance=2.6;target.set(0,.64,0);};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('viewport').requestFullscreen();}catch{}};
$('aboutOpen').onclick=()=>$('about').showModal();$('aboutClose').onclick=()=>$('about').close();$('about').addEventListener('click',e=>{if(e.target===$('about')){const r=$('about').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('about').close();}});
const canvas=$('view');canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);drag=[e.clientX,e.clientY];});canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===2){const [a,b]=[...pointers.values()],dist=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinchDistance)distance=Math.max(1,Math.min(7,distance*pinchDistance/dist));pinchDistance=dist;}else{azimuth-=(e.clientX-prev[0])*.007;elevation=Math.max(-1.15,Math.min(1.4,elevation+(e.clientY-prev[1])*.007));}state.cameraChanges=(state.cameraChanges||0)+1;});for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>{pointers.delete(e.pointerId);pinchDistance=0;drag=null;});canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(1,Math.min(7,distance*Math.exp(e.deltaY*.001)));state.cameraChanges=(state.cameraChanges||0)+1;},{passive:false});
$('export').onclick=()=>{const data=frames[frameIndex];if(!data)return;let out=`# KAOPU original Coral Growth Lab\n# ${VERSION}\n# Parameters ${JSON.stringify(options)}\n# Iteration ${data.frame}\n`;for(let i=0;i<data.positions.length;i+=3)out+=`v ${data.positions[i]} ${data.positions[i+1]} ${data.positions[i+2]}\n`;for(let i=0;i<data.indices.length;i+=3)out+=`f ${data.indices[i]+1} ${data.indices[i+1]+1} ${data.indices[i+2]+1}\n`;const url=URL.createObjectURL(new Blob([out],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download=`kaopu-coral-${options.seed}-f${data.frame}.obj`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);};
function animate(t){requestAnimationFrame(animate);let dt=Math.min(.1,(t-lastTime)/1000);lastTime=t;if(playing&&done){accumulator+=dt*Number($('speed').value)/3;if(accumulator>=1){let next=Math.min(frames.length-1,frameIndex+Math.floor(accumulator));accumulator%=1;showFrame(next);if(next===frames.length-1)setPlaying(false);}}if(renderer){cameraUpdate();renderer.render(scene,camera);state.compiled=renderer.info.render.triangles>0;state.drawCalls=renderer.info.render.calls;state.renderedFrames=(state.renderedFrames||0)+1;}}
window.__CORAL_AUDIT__=()=>{if(!renderer)return{available:false};cameraUpdate();renderer.render(scene,camera);const gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,data=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,data);let colors=new Set(),opaque=0;for(let i=0;i<data.length;i+=4*13){if(data[i+3]>0){opaque++;colors.add(`${data[i]},${data[i+1]},${data[i+2]}`)}}return{available:true,width:w,height:h,opaqueSamples:opaque,uniqueColors:colors.size,glError:gl.getError(),triangles:renderer.info.render.triangles};};
document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false);});window.addEventListener('pagehide',()=>{setPlaying(false);worker?.terminate();});
generate();requestAnimationFrame(animate);
