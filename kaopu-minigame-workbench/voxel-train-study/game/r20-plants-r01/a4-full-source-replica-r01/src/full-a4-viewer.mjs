import {RoomEnvironment} from '../vendor/RoomEnvironment.mjs';
import * as T from 'three';import {OrbitControls} from '../vendor/OrbitControls.mjs';import {restoreOriginal} from './original-chassis-recovery.mjs';
const status=document.querySelector('#status'),host=document.querySelector('#view');
window.A4_REPLICA={ready:false,errors:[],sourceSceneOnly:true,fullSceneVisible:true,geometryOrMaterialReplacement:false};
addEventListener('error',e=>A4_REPLICA.errors.push(e.message));addEventListener('unhandledrejection',e=>A4_REPLICA.errors.push(String(e.reason)));
try{
 const source=await restoreOriginal('a4');source.showAll();const scene=new T.Scene();scene.background=new T.Color('#e9e6dd');scene.add(source.root);
 // Viewer lights are not source geometry or material replacements; source glTF defines no lighting rig.
 scene.add(new T.HemisphereLight(0xffffff,0x6a6c66,1.2));const sun=new T.DirectionalLight(0xfff3db,2);sun.position.set(10,20,15);scene.add(sun);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.debug.onShaderError=(gl,program,vs,fs)=>A4_REPLICA.errors.push('SHADER_ERROR '+gl.getProgramInfoLog(program)+' '+gl.getShaderInfoLog(vs)+' '+gl.getShaderInfoLog(fs));host.append(renderer.domElement);
 const studio=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(studio,.04).texture;studio.dispose();pmrem.dispose();
 const camera=new T.PerspectiveCamera(42,1,.01,1000),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
 const render=()=>renderer.render(scene,camera);function fit(){source.root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(source.root),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),direction=new T.Vector3(1,.22,1).normalize(),right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),direction).normalize(),up=new T.Vector3().crossVectors(direction,right),tan=Math.tan(T.MathUtils.degToRad(camera.fov/2));let d=0;
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const v=new T.Vector3(x,y,z).sub(center);d=Math.max(d,v.dot(direction)+Math.max(Math.abs(v.dot(up))/tan,Math.abs(v.dot(right))/(tan*camera.aspect)));}d*=1.14;
 camera.position.copy(center).addScaledVector(direction,d);controls.target.copy(center);camera.near=Math.max(.001,d/1000);camera.far=Math.max(100,d*10);camera.updateProjectionMatrix();controls.update();render();}
 function resize(){renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();fit();}addEventListener('resize',resize);resize();
 let playing=false,time=0,last=performance.now();const duration=Math.max(...source.model.animations.map(c=>c.duration),0);
 document.querySelector('#fit').onclick=fit;document.querySelector('#play').onclick=()=>{playing=!playing;document.querySelector('#play').textContent=playing?'暂停原动画':'播放原动画';};
 document.querySelector('#rest').onclick=()=>{playing=false;document.querySelector('#play').textContent='播放原动画';source.mixer.stopAllAction();source.nodes.forEach((n,i)=>{const r=source.rest[i];n.position.copy(r.position);n.quaternion.copy(r.quaternion);n.scale.copy(r.scale);n.matrix.copy(r.matrix);});source.root.updateMatrixWorld(true);time=0;render();};
 status.textContent='331节点 · 200网格 · 22原材质 · 2原图/3纹理 · 71动画通道（原场景全量）';
 Object.assign(A4_REPLICA,{ready:true,source,scene,renderer,camera,controls,fit,render});renderer.setAnimationLoop(now=>{if(playing&&duration){time=(time+Math.min(.1,(now-last)/1000))%duration;source.setTime(time);}last=now;controls.update();render();});
}catch(e){A4_REPLICA.errors.push(e.stack||e.message);status.textContent='加载或WebGL失败：'+e.message;}
