import * as T from 'three';
import {RoomEnvironment} from '../vendor/RoomEnvironment.mjs';
import {restoreOriginal} from './original-chassis-recovery.mjs?v=loading-r02';
import {createA6Design} from '../design/a6-design.mjs';
const stage=document.querySelector('#stage'),status=document.querySelector('#status');
window.COMPARISON={ready:false,errors:[],loading:{},sourceUnits:'unchanged; not calibrated metres'};
const reportProgress=e=>{COMPARISON.loading[e.key]=e;window.trainLoadProgress?.(e);};
window.trainBootStarted=true;
addEventListener('error',e=>COMPARISON.errors.push(e.message));addEventListener('unhandledrejection',e=>COMPARISON.errors.push(String(e.reason)));
try{
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.debug.onShaderError=(gl,p,v,f)=>COMPARISON.errors.push('SHADER '+gl.getProgramInfoLog(p)+' '+gl.getShaderInfoLog(v)+' '+gl.getShaderInfoLog(f));stage.append(renderer.domElement);
 const studio=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromScene(studio,.04).texture;studio.dispose();pmrem.dispose();
 const sources=new Array(4),panels=[],ids=['a4','a6','mark3','coach'];let design;
 const glazingRoom=new T.Scene();glazingRoom.background=new T.Color(.12,.16,.14);const glazingPMREM=new T.PMREMGenerator(renderer),glazingEnvironment=glazingPMREM.fromScene(glazingRoom,0).texture;glazingPMREM.dispose();
 let yaw=Math.PI/2,pitch=0,zoom=1,playing=false,phase=0,last=0,designVisible=true;
 const frameCenter=new T.Vector3(),frameSize=new T.Vector3(10,5,30);
 function fit(){const box=new T.Box3();panels.forEach(p=>box.union(new T.Box3().setFromObject(p.scene,true)));box.getCenter(frameCenter);box.getSize(frameSize);}
 function render(){const sw=stage.clientWidth,sh=stage.clientHeight;renderer.setScissorTest(false);renderer.setSize(sw,sh,false);renderer.clear();renderer.setScissorTest(true);const base=stage.getBoundingClientRect();const direction=new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw));
 for(const p of panels){const r=p.element.getBoundingClientRect(),w=r.width,h=r.height,aspect=w/h;const half=Math.max(frameSize.y/2,frameSize.length()/(2*aspect))*1.12/zoom;p.camera.left=-half*aspect;p.camera.right=half*aspect;p.camera.top=half;p.camera.bottom=-half;p.camera.near=.01;p.camera.far=500;p.camera.position.copy(frameCenter).addScaledVector(direction,100);p.camera.lookAt(frameCenter);p.camera.updateProjectionMatrix();renderer.setViewport(r.left-base.left,sh-(r.bottom-base.top),w,h);renderer.setScissor(r.left-base.left,sh-(r.bottom-base.top),w,h);renderer.render(p.scene,p.camera);}}
 function reset(){playing=false;document.querySelector('#play').textContent='播放原A4动画';sources.forEach(s=>{s.mixer.stopAllAction();s.nodes.forEach((n,i)=>{n.position.copy(s.rest[i].position);n.quaternion.copy(s.rest[i].quaternion);n.scale.copy(s.rest[i].scale);n.matrix.copy(s.rest[i].matrix)});s.root.updateMatrixWorld(true)});phase=0;render()}
 // A verified complete pair is rendered immediately; a slower other source cannot block it.
 async function loadPair(key,offset){
  const pair=await Promise.all([restoreOriginal(key,{onProgress:reportProgress}),restoreOriginal(key,{onProgress:reportProgress})]);
  pair.forEach((source,j)=>{const i=offset+j;sources[i]=source;source.showAll();const scene=new T.Scene();scene.background=new T.Color(i%2?'#e3e8e1':'#e9e6dd');scene.environment=env;scene.add(source.root);scene.add(new T.HemisphereLight(0xffffff,0x656b62,1.2));const sun=new T.DirectionalLight(0xffffff,2);sun.position.set(10,20,15);scene.add(sun);
   if(i===1){design=createA6Design(T,source);design.designGlass.envMap=glazingEnvironment;design.designGlass.envMapIntensity=.18;design.designGlass.clearcoat=0;design.designGlass.clearcoatRoughness=.1;design.designGlass.needsUpdate=true;scene.add(design.root);design.setVisible(true);}
   panels.push({id:ids[i],source,scene,camera:new T.OrthographicCamera(),element:document.getElementById(ids[i])});
  });panels.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));fit();render();COMPARISON.visiblePanels=panels.map(p=>p.id);reportProgress({key,phase:'visible'});
 }
 await Promise.all([loadPair('a4',0),loadPair('mark3',2)]);
 document.querySelector('#side').onclick=()=>{yaw=Math.PI/2;pitch=0;zoom=1;render()};document.querySelector('#quarter').onclick=()=>{yaw=.95;pitch=.15;zoom=1;render()};document.querySelector('#rest').onclick=reset;document.querySelector('#play').onclick=()=>{playing=!playing;document.querySelector('#play').textContent=playing?'暂停原A4动画':'播放原A4动画'};document.querySelector('#shell').onclick=()=>{designVisible=!designVisible;design.root.visible=designVisible;design.setVisible?.(designVisible);render()};
 for(const p of panels){let drag; p.element.onpointerdown=e=>{drag=[e.clientX,e.clientY];p.element.setPointerCapture(e.pointerId)};p.element.onpointerup=()=>drag=null;p.element.onpointermove=e=>{if(drag){yaw-=(e.clientX-drag[0])*.008;pitch=T.MathUtils.clamp(pitch+(e.clientY-drag[1])*.005,-1.2,1.2);drag=[e.clientX,e.clientY];render()}};p.element.onwheel=e=>{e.preventDefault();zoom=T.MathUtils.clamp(zoom*Math.exp(-e.deltaY*.001),.5,4);render()};}
 addEventListener('resize',render);renderer.setAnimationLoop(now=>{if(playing){phase+=Math.min(.1,(now-last)/1000);const duration=sources[0].model.animations[0]?.duration||1;sources[0].setTime(phase%duration);sources[1].setTime(phase%duration);render()}last=now});
 window.trainLoadComplete=true;Object.assign(COMPARISON,{ready:true,renderer,panels,sources,design,render,reset});status.textContent='A4 331节点/200网格 ×2 · Mark3 145节点/89网格 ×2 · 原材质与贴图完整 · 同步视角；A6四轴扩展待设计';render();
}catch(e){COMPARISON.errors.push(e.stack||e.message);window.trainLoadFailed?.(e);status.textContent='加载失败：'+e.message+'。已校验画面保留；请点重新加载重试。';}
