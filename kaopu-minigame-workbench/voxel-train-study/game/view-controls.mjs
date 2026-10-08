import * as THREE from '../vendor/three.module.js';
import {DEFAULT_VIEWS,prepareViewProfiles,recommendView,restoreView as restoreStoredView} from './view-profile-storage.mjs';
const KEY='kaopu.train-driver.views.v1';
export function createViewControls({camera,target,canvas,root,onChange,onReset=()=>{}}){
 const defaults=DEFAULT_VIEWS;
 let raw=null;try{raw=localStorage.getItem(KEY);}catch{}
 let data=prepareViewProfiles(raw),pointers=new Map(),gesture=null;
 const $=id=>document.getElementById(id),profile=()=>data.profiles[data.layout]||(data.profiles[data.layout]={...structuredClone(defaults[data.layout]),manual:false,locked:false});
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch{}}
 function rotated(){return data.layout==='landscape'&&innerHeight>innerWidth;}
 function point(e){return rotated()?{x:e.clientY,y:innerWidth-e.clientX}:{x:e.clientX,y:e.clientY};}
 function sync(){root.dataset.layout=data.layout;root.dataset.rotated=String(rotated());$('landscapeView').setAttribute('aria-pressed',String(data.layout==='landscape'));$('portraitView').setAttribute('aria-pressed',String(data.layout==='portrait'));$('lockView').setAttribute('aria-pressed',String(profile().locked));$('lockView').textContent=profile().locked?'已固定':'固定';$('lockView').setAttribute('aria-label',profile().locked?'解锁当前视角':'固定当前视角');$('restoreView').hidden=!data.backups[data.layout];$('viewHint').textContent=profile().locked?'此视角已保存，横竖各自独立':'拖动画面调角度 · 双指缩放/平移';}
 function apply(){const p=profile();camera.position.fromArray(p.position);target.fromArray(p.target);camera.zoom=p.zoom;camera.updateProjectionMatrix();camera.lookAt(target);sync();onChange();}
 function capture(manual=true){const p=profile();if(manual){p.position=camera.position.toArray();p.target=target.toArray();p.zoom=camera.zoom;p.manual=true;}persist();sync();}
 function setLayout(mode){capture(profile().manual);data.layout=mode;pointers.clear();gesture=null;apply();persist();requestAnimationFrame(onChange);}
 function orbit(dx,dy){const offset=camera.position.clone().sub(target),s=new THREE.Spherical().setFromVector3(offset);s.theta-=dx/Math.max(200,canvas.clientWidth)*Math.PI*1.6;s.phi=THREE.MathUtils.clamp(s.phi-dy/Math.max(150,canvas.clientHeight)*Math.PI, .16,1.48);camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(s));camera.lookAt(target);capture();onChange();}
 function snapshot(){const points=[...pointers.values()];return points.length>=2?{center:{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2},distance:Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)}:null;}
 canvas.addEventListener('pointerdown',e=>{if(profile().locked||e.button>0)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,point(e));gesture=snapshot();});
 canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)||profile().locked)return;e.preventDefault();const previous=pointers.get(e.pointerId),next=point(e);pointers.set(e.pointerId,next);if(pointers.size===1)orbit(next.x-previous.x,next.y-previous.y);else{const nextGesture=snapshot();if(gesture&&nextGesture){camera.zoom=THREE.MathUtils.clamp(camera.zoom*nextGesture.distance/Math.max(1,gesture.distance),.4,3);camera.updateProjectionMatrix();const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1),scale=camera.position.distanceTo(target)*.0015/camera.zoom,delta=right.multiplyScalar(-(nextGesture.center.x-gesture.center.x)*scale).add(up.multiplyScalar((nextGesture.center.y-gesture.center.y)*scale));target.add(delta);camera.position.add(delta);camera.lookAt(target);capture();onChange();}gesture=nextGesture;}});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{pointers.delete(e.pointerId);gesture=snapshot();});
 canvas.addEventListener('wheel',e=>{if(profile().locked)return;e.preventDefault();camera.zoom=THREE.MathUtils.clamp(camera.zoom*Math.exp(-e.deltaY*.001),.4,3);camera.updateProjectionMatrix();capture();onChange();},{passive:false});
 $('landscapeView').addEventListener('click',()=>setLayout('landscape'));$('portraitView').addEventListener('click',()=>setLayout('portrait'));
 $('lockView').addEventListener('click',()=>{capture();profile().locked=!profile().locked;pointers.clear();persist();sync();onChange();});
 $('resetView').addEventListener('click',()=>{onReset();recommendView(data,data.layout);apply();persist();});
 $('restoreView').addEventListener('click',()=>{if(!restoreStoredView(data,data.layout))return;onReset();apply();persist();});
 addEventListener('resize',()=>{pointers.clear();sync();onChange();});apply();persist();
 return{automaticFrame:()=>profile(),manual:()=>profile().manual||profile().locked,locked:()=>profile().locked,mode:()=>data.layout,resetForSession(){if(!this.manual())apply();},markPreset(){profile().locked=false;capture(true);},saveCurrent(){capture();},state:()=>({layout:data.layout,frameRevision:data.frameRevision,rotated:rotated(),locked:profile().locked,manual:profile().manual,position:camera.position.toArray(),target:target.toArray(),zoom:camera.zoom,profiles:structuredClone(data.profiles)})};
}
