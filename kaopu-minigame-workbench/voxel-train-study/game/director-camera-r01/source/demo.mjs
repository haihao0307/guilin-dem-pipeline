import * as THREE from '../../../vendor/three.module.js';
import {createStationPlatform} from '../../r19/station-platform.mjs';
import {createGameTrain} from '../../r19/train-model.mjs';
import {createViewControls} from '../../r19/view-controls.mjs';
import {boundCameraPose} from '../../r19/camera-presets.mjs';
import {Session} from '../../r19/session.mjs';
import {createDirector,sampleScore} from './director.mjs';
const score=await (await fetch('./source/camera-score.json')).json();
const canvas=document.querySelector('canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x8d9b9b);scene.add(new THREE.HemisphereLight(0xeef7fa,0x66594b,2.5));const light=new THREE.DirectionalLight(0xffecd0,3);light.position.set(-10,25,15);scene.add(light);
const camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,220),target=new THREE.Vector3();
const platform=createStationPlatform({index:5,name:'大埔墟',english:'TAI PO MARKET',radius:2.8});scene.add(platform.group);
const train=createGameTrain({bodyMotion:{enabled:false}});scene.add(train.root);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(160,110),new THREE.MeshStandardMaterial({color:0x717367,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(-22,-.03,0);scene.add(ground);
const session=new Session({line:'kcr1',seed:'DIRECTOR-CAMERA-R01'});session.command('start');session.command('brake',true);
const controls=createViewControls({camera,target,canvas,root:document.body,storageKey:'kaopu.director.camera.r01.isolated',onChange:()=>{}});
const readPose=()=>({position:camera.position.toArray(),target:target.toArray(),fov:camera.fov,zoom:camera.zoom});
const writePose=p=>{camera.position.fromArray(p.position);target.fromArray(p.target);camera.fov=p.fov;camera.zoom=p.zoom??1;camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();};
writePose({position:[-35,12,28],target:[-16,2,2],fov:45,zoom:1});
scene.updateMatrixWorld(true);const ray=new THREE.Raycaster(),vec=new THREE.Vector3();
const collidables=[platform.group,train.root,ground];
function inspect(p){const origin=new THREE.Vector3(...p.position);let nearest=Infinity,obstacle=null;for(const d of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){ray.set(origin,new THREE.Vector3(...d));ray.near=0;ray.far=.2;const hits=ray.intersectObjects(collidables,true);if(hits.length&&hits[0].distance<nearest){nearest=hits[0].distance;obstacle=hits[0].object.name;}}
 vec.fromArray(p.target).sub(origin);const focusDistance=vec.length();ray.set(origin,vec.normalize());ray.far=focusDistance+.15;const hits=ray.intersectObjects(collidables,true);const first=hits[0];return {safe:nearest>.15,clearanceProbeM:.15,nearest:nearest===Infinity?null:nearest,obstacle,focusDistance,focusHit:first?{distance:first.distance,name:first.object.name}:null,focusOccluded:!!first&&first.distance<focusDistance-.15};}
let latest=null,last=performance.now(),manual=new URLSearchParams(location.search).has('manual');
const director=createDirector({score,readPose,writePose,boundPose:boundCameraPose,inspect,onStop:()=>{canvas.style.touchAction='none';}});
for(const type of ['pointerdown','pointermove','wheel'])canvas.addEventListener(type,e=>{if(director.state().active){e.stopImmediatePropagation();e.preventDefault();}}, {capture:true,passive:false});
function update(seconds){session.advance(seconds);const view=session.view();platform.updateClock(view.timetable.minutes);train.update(view,{dt:seconds});latest=director.update(view);renderer.render(scene,camera);document.querySelector('#status').textContent=`${director.state().active?latest?.label||'自动镜头':'普通操作：拖动／缩放'} · 世界 ${view.elapsed.toFixed(2)}s · 站钟 ${view.timetable.minutes.toFixed(3)} 分 · ${session.paused?'暂停':'运行'}`;return snapshot();}
function snapshot(){return {director:director.state(),pose:readPose(),worldElapsed:session.elapsed,worldTick:session.tick,clock:structuredClone(platform.proof.clock),latest,render:structuredClone(renderer.info.render),webgl:renderer.getContext().getParameter(renderer.getContext().VERSION)};}
document.querySelector('#play').onclick=()=>director.start(session.elapsed);document.querySelector('#stop').onclick=()=>director.stop('user');document.querySelector('#pause').onclick=()=>session.command('pause',!session.paused);addEventListener('keydown',e=>{if(e.key==='Escape')director.stop('escape');});addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
window.directorTrial={ready:true,snapshot,start:()=>director.start(session.elapsed),stop:()=>director.stop('test'),advance:seconds=>{let left=seconds;while(left>1e-8){const d=Math.min(left,.1);session.advance(d);left-=d;}return update(0);},pause:value=>session.command('pause',value),sample:t=>{const p=sampleScore(score,t),b=boundCameraPose(p.position,p.target);return {...p,...b,check:inspect({...p,...b})};},setManual:v=>manual=v,writePose,update,dispose:()=>{director.dispose();platform.dispose();renderer.dispose();}};
function frame(now){const dt=Math.min((now-last)/1000,.1);last=now;if(!manual)update(dt);requestAnimationFrame(frame);}update(0);requestAnimationFrame(frame);
