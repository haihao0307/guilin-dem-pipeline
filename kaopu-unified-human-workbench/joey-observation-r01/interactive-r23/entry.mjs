import * as THREE from 'three';
import portrait from './portrait.json';
import {attachR05Brows} from './vendor/brows/NativeR05Brows.mjs';
import {attachCurrentET16Eyes} from '../full-material-r21/eye/CurrentET16Eyes.mjs';
import {attachLipFinish} from '../full-material-r23/NativeSurfaceR23.mjs';
import {captureCurrentR64Input} from '../hair-f13-static-r17/browser/CaptureR64Input.mjs';
import {attachCurrentF13Hair} from '../hair-f13-static-r17/browser/NativeF13Hair.mjs';
const BASE='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/';
const R54=BASE+'joey-observation-r01/appearance-r54/';
const R23='d01a6fb06828e96d83399a311fa8491bd19276b4';
const ASSETS='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/8a5e2322401217cff808a64d7fa614b710da0db1/kaopu-unified-human-workbench/joey-observation-r01/full-material-r21/eye/assets/';
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
const progress=(stage,detail)=>parent.r23Progress(stage,detail);
let worker,disposed=false,v,api,brows,eye,lip,hair,appearance,light;
const state={version:'R23-interactive/1',sourceCommit:R23,ready:false,stage:'starting',errors:[],timings:[],cache:{hit:false,saved:false},controlsApplied:0,faceShapeEditing:false,physics:false,photosIncluded:false};
const started=performance.now();
function mark(name,detail){state.stage=name;state.timings.push({stage:name,elapsedMS:performance.now()-started});progress(name,detail);if(disposed)throw Error('当前载入已取消');}
function storage(mode,key,value){return new Promise((resolve,reject)=>{const request=indexedDB.open('kaopu-r23-complete-hair',1);request.onupgradeneeded=()=>request.result.createObjectStore('dense');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('dense',mode==='get'?'readonly':'readwrite'),store=tx.objectStore('dense'),q=mode==='get'?store.get(key):store.put(value,key);q.onsuccess=()=>{if(mode==='get')resolve(q.result);};q.onerror=()=>reject(q.error);tx.oncomplete=()=>{db.close();if(mode!=='get')resolve(true);};tx.onerror=()=>{db.close();reject(tx.error);};};});}
async function dense(captured){const key=portrait.expectedDenseSHA256;let cached;
 try{cached=await storage('get',key);if(cached?.buffer&&await hash(cached.buffer)===key){state.cache.hit=true;state.cache.bytes=cached.buffer.byteLength;state.generation=cached.report;mark('已读取本机完整发丝缓存');return cached.buffer;}}catch(e){state.cache.readError=String(e);}
 mark('正在从原始参数生成全部短发','首次约需数分钟；保留全部98,358根发丝，完成后尝试保存在本机。');
 const result=await new Promise((resolve,reject)=>{const url=URL.createObjectURL(new Blob([parent.R23_WORKER],{type:'text/javascript'}));worker=new Worker(url,{type:'module'});URL.revokeObjectURL(url);worker.onmessage=e=>{const m=e.data;if(m.type==='progress'){if(m.stage==='dense')progress('正在生成完整短发',m.generated+' / '+m.total+' 根');else progress('正在生成完整短发',m.stage);}else if(m.type==='complete'){worker.terminate();worker=null;resolve(m);}else if(m.type==='error'){worker.terminate();worker=null;reject(Error(m.error));}};worker.onerror=e=>{worker?.terminate();worker=null;reject(Error(e.message||'完整发丝生成中断'));};worker.postMessage(captured);});
 if(await hash(result.buffer)!==key)throw Error('完整发丝与已验证R23摘要不同，已停止；不会改用简化发型');
 state.generation=result.report;state.cache.bytes=result.buffer.byteLength;
 try{await storage('put',key,{buffer:result.buffer,report:result.report});state.cache.saved=true;}catch(e){state.cache.writeError=String(e);}
 return result.buffer;
}
function batch(fn){const render=v.render;let pending=false;v.render=()=>{pending=true;};try{fn();}finally{v.render=render;}render.call(v);return pending;}
let defaults,current,baseCamera,frontTarget;
function snapshot(){return structuredClone(current);}
function validateSettings(s){if(!s||s.schema!=='kaopu/r23-controls/1')throw Error('不是本版参数');const out=structuredClone(s);for(const[k,min,max]of[['tone',0,1],['warmth',0,1],['detail',0,1.5],['roughness',.3,.9],['oil',0,1],['variation',0,1],['redness',0,1],['lipMix',0,1]])if(!Number.isFinite(out.skin[k])||out.skin[k]<min||out.skin[k]>max)throw Error('皮肤参数越界 '+k);if(!/^#[0-9a-f]{6}$/i.test(out.skin.lipColor))throw Error('无效唇色');if(!Number.isFinite(out.lip.roughness)||out.lip.roughness<.3||out.lip.roughness>.7||!Number.isFinite(out.lip.clearcoat)||out.lip.clearcoat<0||out.lip.clearcoat>.35)throw Error('唇面参数越界');if(!Number.isFinite(out.hair.roughness)||out.hair.roughness<.2||out.hair.roughness>.7||!['black','darkBrown'].includes(out.hair.color))throw Error('毛发参数越界');if(!/^#[0-9a-f]{6}$/i.test(out.brow.color)||!Number.isFinite(out.brow.density)||out.brow.density<.8||out.brow.density>1.5)throw Error('眉毛参数越界');return out;}
function apply(next){if(!state.ready||disposed)throw Error('人物尚未就绪');const checked=validateSettings(next),browChanged=JSON.stringify(checked.brow)!==JSON.stringify(current.brow);batch(()=>{v.skin.set(checked.skin);lip.set(checked.lip);if(browChanged)brows.set(checked.brow);const u=v.scene.getObjectByName('F13-planned-complete-hair').material.uniforms;u.roughness.value=checked.hair.roughness;u.absorption.value.set(...(checked.hair.color==='black'?[2.4,2.8,3.3]:[1.8,2.3,3.0]));});current=checked;state.controlsApplied++;return snapshot();}
function resize(){if(!v||!state.ready)return;v.renderer.setPixelRatio(1);v.resize();}
function view(name){if(!state.ready)throw Error('人物尚未就绪');const c=v.camera;c.clearViewOffset();c.zoom=1;c.near=.01;c.far=100;c.fov=30;c.aspect=innerWidth/innerHeight;
 if(name==='r23'){c.position.fromArray(baseCamera.position);c.quaternion.fromArray(baseCamera.quaternion);v.orbit.target.fromArray(frontTarget);c.fov=baseCamera.fov;c.setViewOffset(baseCamera.width,baseCamera.height,baseCamera.offsetX,baseCamera.offsetY,baseCamera.width,baseCamera.height);}
 else{const center=new THREE.Vector3(0,.72,.055),distance=.78;v.orbit.target.copy(center);const direction=name==='side'?new THREE.Vector3(1,.05,0):name==='three'?new THREE.Vector3(.65,.03,1).normalize():new THREE.Vector3(0,.03,1).normalize();c.position.copy(center).addScaledVector(direction,distance);c.up.set(0,1,0);c.lookAt(center);}
 c.updateProjectionMatrix();c.updateMatrixWorld(true);v.orbit.enabled=true;v.render();state.view=name;
}
function zoom(factor){if(!state.ready)return;const offset=v.camera.position.clone().sub(v.orbit.target),distance=Math.max(.36,Math.min(.95,offset.length()*factor));offset.setLength(distance);v.camera.position.copy(v.orbit.target).add(offset);v.camera.updateMatrixWorld(true);v.render();state.view='free';}
function dispose(){if(disposed)return;disposed=true;worker?.terminate();worker=null;state.ready=false;state.stage='disposed';try{hair?.dispose();brows?.dispose();lip?.dispose();eye?.dispose();light?.dispose();appearance?.dispose();v?.dispose();}catch(e){state.disposeError=String(e);}}
window.addEventListener('pagehide',dispose);
document.addEventListener('webglcontextlost',e=>{e.preventDefault();state.errors.push('WebGL context lost');state.ready=false;parent.r23Failure('绘图上下文丢失，请重新载入。未自动降低头发密度。');worker?.terminate();},true);
async function boot(){
 mark('正在载入原生人物引擎');await import(BASE+'full/ui/browser-app.mjs?v=entry-r06-20261010');
 const until=performance.now()+30000;while(!window.fullCommonWorkbench){if(performance.now()>until)throw Error('原生人物入口未就绪');await new Promise(r=>setTimeout(r,100));}
 api=window.fullCommonWorkbench;mark('正在载入完整人物');await api.load();await api.motion().setMode('shape');api.restore(portrait.archive);v=api.motion().viewer;v.orbit.enabled=false;v.renderer.setPixelRatio(1);
 state.nativeSHA=await hash(api.positions().buffer);if(state.nativeSHA!==portrait.expectedNativeFloat32SHA256)throw Error('原生R23脸型摘要不同');
 mark('正在挂接原R23眉眼与肤唇');const{attachAppearanceR52}=await import(R54+'base/brow-face-r52/AppearanceR52.mjs');appearance=await attachAppearanceR52(api,{pigmentScale:.55});
 v.scene.traverse(o=>{if(o.name==='Mindfront CC0 surface-bound eyebrows')o.visible=false;});
 eye=await attachCurrentET16Eyes(api,{assetBase:ASSETS,THREE});lip=attachLipFinish(v.skin);brows=attachR05Brows(api);
 const captured=await captureCurrentR64Input(api),buffer=await dense(captured);mark('正在准备完整发丝显卡数据');
 const render=v.render;v.render=()=>{};
 try{hair=await attachCurrentF13Hair(api,{denseBuffer:buffer});v.skin.set(portrait.skin);lip.set({enabled:true,...portrait.cosmetics});
 // Exact previous portrait camera cropped to the head/shoulders, no image substitute.
 const w=new THREE.Matrix4().fromArray(portrait.camera.worldInverse.flatMap((_,i)=>portrait.camera.worldInverse.map(r=>r[i]))).invert();w.decompose(v.camera.position,v.camera.quaternion,v.camera.scale);
 const P=portrait.camera.projection.map(r=>r.slice()),wide=portrait.wide,oldW=portrait.camera.width,oldH=portrait.camera.height;
 P[0][0]*=wide.scale*oldW/wide.width;P[1][1]*=wide.scale*oldH/wide.height;P[1][2]=-(1-2*wide.offsetY/wide.height-wide.scale*oldH/wide.height);
 P[0][0]*=900/600;P[1][1]*=1100/540;P[0][2]=P[0][2]*900/600;P[1][2]=P[1][2]*1100/540-(2*30+540-1100)/540;
 baseCamera={position:v.camera.position.toArray(),quaternion:v.camera.quaternion.toArray(),fov:2*Math.atan(1/P[1][1])*180/Math.PI,width:600,height:540,offsetX:P[0][2]*300,offsetY:-P[1][2]*270};
 const forward=new THREE.Vector3(0,0,-1).applyQuaternion(v.camera.quaternion),head=new THREE.Vector3(0,.72,.055);frontTarget=v.camera.position.clone().addScaledVector(forward,head.sub(v.camera.position).dot(forward)).toArray();
 v.camera.updateMatrixWorld(true);const{attachObservationLighting}=await import(R54+'ObservationLighting.mjs');light=await attachObservationLighting(v,{options:portrait.light});
 }finally{v.render=render;}
 current={schema:'kaopu/r23-controls/1',skin:{...portrait.skin},lip:{enabled:true,edgeGamma:.9,roughness:.50,clearcoat:.12},hair:{roughness:.38,color:'black'},brow:{color:'#191916',density:1.28}};defaults=snapshot();
 v.orbit.enablePan=false;v.orbit.minDistance=.36;v.orbit.maxDistance=.95;v.orbit.minPolarAngle=.35;v.orbit.maxPolarAngle=2.3;v.orbit.enableDamping=false;
 state.ready=true;view('r23');mark('正在验证真实画面');
 const gl=v.renderer.getContext();gl.finish();state.nativeUnchanged=await hash(api.positions().buffer)===state.nativeSHA;if(!state.nativeUnchanged)throw Error('挂接改变原生人物');
 state.gpu=hair.verifyGPU();if(!state.gpu.finite||state.gpu.rootErrorMM>.01||state.gpu.staticPathErrorMM>.01)throw Error('完整毛根GPU校验失败');

 // Keep only one complete GPU frame in flight. New UI requests replace the queued draw,
 // without changing strand count, mesh density, shader quality or camera resolution.
 const directRender=v.render.bind(v),queue={requested:0,drawn:0,coalesced:0,inFlight:false,pending:false,lastGPUWaitMS:0};state.renderQueue=queue;
 let frameToken=0,fence=null;
 function queueDraw(){if(disposed)return;queue.requested++;if(queue.inFlight||frameToken){queue.pending=true;queue.coalesced++;return;}frameToken=requestAnimationFrame(()=>{frameToken=0;if(disposed)return;queue.pending=false;queue.inFlight=true;const began=performance.now();try{directRender();queue.drawn++;fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();const poll=()=>{if(disposed)return;const result=gl.clientWaitSync(fence,0,0);if(result===gl.TIMEOUT_EXPIRED){setTimeout(poll,16);return;}gl.deleteSync(fence);fence=null;queue.inFlight=false;queue.lastGPUWaitMS=performance.now()-began;if(result===gl.WAIT_FAILED){parent.r23Failure('绘图同步失败，请重新载入。');return;}if(queue.pending){queue.pending=false;queueDraw();}};setTimeout(poll,0);}catch(e){queue.inFlight=false;parent.r23Failure(String(e.message||e));}});}
 v.render=queueDraw;
 const settle=()=>new Promise((resolve,reject)=>{const began=performance.now();const check=()=>{if(disposed)return reject(Error('页面已停止'));if(!queue.inFlight&&!queue.pending&&!frameToken)return resolve({waitMS:performance.now()-began,...queue});setTimeout(check,20);};check();});
 const inspect=()=>({...structuredClone(state),ready:state.ready&&!disposed,hair:hair.report(),brows:brows.report(),eye:eye.report(),lip:lip.report(),controls:snapshot(),camera:{position:v.camera.position.toArray(),quaternion:v.camera.quaternion.toArray(),projection:v.camera.projectionMatrix.toArray(),target:v.orbit.target.toArray()},canvas:[v.canvas.width,v.canvas.height]});
 window.r23Interactive={report:inspect,snapshot,apply,view,zoom,settle,reset(){batch(()=>{apply(structuredClone(defaults));view('r23');});return snapshot();},dispose,capture(){v.render();return v.canvas.toDataURL('image/png');},nativeSHA:async()=>hash(api.positions().buffer)};
 state.stage='ready';state.elapsedMS=performance.now()-started;parent.r23Ready(window.r23Interactive);
}
boot().catch(e=>{state.ready=false;state.stage='error';state.errors.push(String(e.stack||e));parent.r23Failure(String(e.message||e));worker?.terminate();});
