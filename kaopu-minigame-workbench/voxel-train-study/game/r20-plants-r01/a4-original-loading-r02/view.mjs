import {RoomEnvironment} from '../a4-full-source-replica-r01/vendor/RoomEnvironment.mjs';
import * as T from 'three';import {OrbitControls} from '../a4-full-source-replica-r01/vendor/OrbitControls.mjs';import {restoreOriginal} from './original-recovery-loading.mjs';
const status=document.querySelector('#status'),host=document.querySelector('#view');
Object.assign(window.A4_REPLICA,{sourceSceneOnly:true,fullSceneVisible:true,geometryOrMaterialReplacement:false});
addEventListener('error',e=>A4_REPLICA.errors.push(e.message));addEventListener('unhandledrejection',e=>A4_REPLICA.errors.push(String(e.reason)));
try{
 const source=await restoreOriginal('a4');source.showAll();const scene=new T.Scene();scene.background=new T.Color('#e9e6dd');scene.add(source.root);
 // Viewer lights are not source geometry or material replacements; source glTF defines no lighting rig.
 scene.add(new T.HemisphereLight(0xffffff,0x6a6c66,1.2));const sun=new T.DirectionalLight(0xfff3db,2);sun.position.set(10,20,15);scene.add(sun);
 await new Promise(r=>{reportLoad('创建WebGL与原贴图');setTimeout(r,0);});
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.debug.onShaderError=(gl,program,vs,fs)=>failLoad(Error('SHADER_ERROR '+gl.getProgramInfoLog(program)+' '+gl.getShaderInfoLog(vs)+' '+gl.getShaderInfoLog(fs)));renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();A4_REPLICA.ready=false;failLoad(Error('WebGL上下文丢失，原件未被替换，请重新加载'));});host.append(renderer.domElement);
 const studio=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(studio,.04).texture;studio.dispose();pmrem.dispose();
 const camera=new T.OrthographicCamera(-1,1,1,-1,.01,2000),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
 const render=()=>renderer.render(scene,camera);function fit(){source.root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(source.root,true),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),w=host.clientWidth,h=host.clientHeight,scale=Math.max(size.z/w,size.y/h)*1.12;camera.up.set(0,1,0);camera.zoom=1;camera.left=-w*scale/2;camera.right=-camera.left;camera.top=h*scale/2;camera.bottom=-camera.top;camera.near=.01;camera.far=2000;camera.position.copy(center).add(new T.Vector3(1000,0,0));camera.lookAt(center);controls.target.copy(center);camera.updateProjectionMatrix();controls.update();A4_REPLICA.defaultView='orthographic-side';A4_REPLICA.worldUnitsPerPixel=scale;render();}
 reportLoad('准备首帧GPU绘制');
 function resize(){renderer.setSize(host.clientWidth,host.clientHeight);camera.updateProjectionMatrix();fit();}addEventListener('resize',resize);resize();
 let playing=false,time=0,last=performance.now();const duration=Math.max(...source.model.animations.map(c=>c.duration),0);
 document.querySelector('#fit').onclick=fit;document.querySelector('#play').onclick=()=>{playing=!playing;document.querySelector('#play').textContent=playing?'暂停原动画':'播放原动画';};
 document.querySelector('#rest').onclick=()=>{playing=false;document.querySelector('#play').textContent='播放原动画';source.mixer.stopAllAction();source.nodes.forEach((n,i)=>{const r=source.rest[i];n.position.copy(r.position);n.quaternion.copy(r.quaternion);n.scale.copy(r.scale);n.matrix.copy(r.matrix);});source.root.updateMatrixWorld(true);time=0;render();};
 if(A4_REPLICA.errors.length)throw Error(A4_REPLICA.errors.join('\n'));
 reportLoad('首帧已显示');
 status.textContent='331节点 · 200网格 · 22原材质 · 2原图/3纹理 · 71动画通道（原场景全量）';
 Object.assign(A4_REPLICA,{ready:true,source,scene,renderer,camera,controls,fit,render});renderer.setAnimationLoop(now=>{if(playing&&duration){time=(time+Math.min(.1,(now-last)/1000))%duration;source.setTime(time);}last=now;controls.update();render();});
}catch(e){window.failLoad(e);}
