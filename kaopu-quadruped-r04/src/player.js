import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONTRACT, VERSION, buildScore, dispose, measure, fingerprint } from './instrument.js';

const viewport = document.querySelector('#viewport');
const scoreInput = document.querySelector('#score');
const statusNode = document.querySelector('#status');
const emptyNote = document.querySelector('#empty-note');
const payload = document.querySelector('#kaopu-instrument-payload')?.textContent?.trim() || '';
const nodes = { scoreBytes: document.querySelector('#score-bytes'), meshes: document.querySelector('#meshes'), triangles: document.querySelector('#triangles'), hash: document.querySelector('#hash') };
const scene = new THREE.Scene(); scene.background = new THREE.Color('#101419'); scene.fog = new THREE.Fog('#101419', 10, 28);
const camera = new THREE.PerspectiveCamera(40, 1, .01, 200); camera.position.set(3.5, 2, 5.2);
const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'}); renderer.setPixelRatio(Math.min(devicePixelRatio||1,2)); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05; renderer.shadowMap.enabled=true; viewport.appendChild(renderer.domElement);
const controls = new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.dampingFactor=.065; controls.target.set(0,.7,0);
scene.add(new THREE.HemisphereLight('#dcecff','#312a21',1.5)); const key=new THREE.DirectionalLight('#fff0d0',4.2); key.position.set(4.5,7.5,5.2); key.castShadow=true; scene.add(key); const rim=new THREE.DirectionalLight('#8fb9ff',1.3); rim.position.set(-4,3,-5); scene.add(rim);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#20262d',roughness:.98}));ground.rotation.x=-Math.PI/2;ground.position.y=-.025;ground.receiveShadow=true;scene.add(ground);const grid=new THREE.GridHelper(16,32,'#58636e','#303740');grid.position.y=-.02;scene.add(grid);
let active=null,lastBounds=null,frames=0;
function status(text,error=false){statusNode.textContent=text;statusNode.classList.toggle('error',error)}
function fit(){if(!lastBounds)return;const r=Math.max(lastBounds.sphere.radius,.25),d=r/Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*1.32,dir=new THREE.Vector3(1.05,.58,1.5).normalize();camera.position.copy(lastBounds.sphere.center).addScaledVector(dir,d);controls.target.copy(lastBounds.sphere.center);camera.near=Math.max(d/500,.005);camera.far=Math.max(d*80,80);camera.updateProjectionMatrix();controls.update()}
function updateDraft(){nodes.scoreBytes.textContent=String(new TextEncoder().encode(scoreInput.value.trim()).length)}
function play(){let next=null;try{next=buildScore(scoreInput.value);const box=new THREE.Box3().setFromObject(next.root),sphere=box.getBoundingSphere(new THREE.Sphere()),metrics=measure(next.root,next.score),hash=fingerprint(next.root);if(active){scene.remove(active.root);dispose(active.root)}active=next;next=null;scene.add(active.root);lastBounds={box,sphere};nodes.scoreBytes.textContent=String(metrics.scoreBytes);nodes.meshes.textContent=String(metrics.meshes);nodes.triangles.textContent=new Intl.NumberFormat('zh-CN').format(metrics.triangles);nodes.hash.textContent=hash;emptyNote.hidden=true;status('演奏完成：谱子提供形体属性，乐器只完成计算。');fit()}catch(error){if(next)dispose(next.root);status(`谱子未执行：${error instanceof Error?error.message:String(error)}`,true)}}
function decode(base64){const binary=atob(base64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
document.querySelector('#play').addEventListener('click',play);document.querySelector('#camera').addEventListener('click',fit);scoreInput.addEventListener('input',updateDraft);document.querySelector('#file').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;scoreInput.value=(await file.text()).trim();updateDraft();status(`已导入 ${file.name}，尚未演奏。`)});document.querySelector('#download-instrument').addEventListener('click',()=>{const blob=new Blob([decode(payload)],{type:'text/javascript'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='KAOPU_QUADRUPED_K4.js';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
const resize=new ResizeObserver(()=>{const w=Math.max(viewport.clientWidth,1),h=Math.max(viewport.clientHeight,1);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()});resize.observe(viewport);renderer.setAnimationLoop(()=>{frames++;controls.update();renderer.render(scene,camera)});
window.__KAOPU_EMPTY_K4__={version:VERSION,contract:CONTRACT,state:()=>({frames,active:Boolean(active),score:active?.score??null,metrics:active?measure(active.root,active.score):null,hash:active?fingerprint(active.root):null})};
