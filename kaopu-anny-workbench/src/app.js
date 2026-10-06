import * as THREE from 'three';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {AnnyModel} from './AnnyModel.js';
const $=id=>document.getElementById(id),SOURCE='d6fc027ced5c17b6b0775dee944096ade7a9ef80';
const specs=[['gender','性别形态','gender','male 锚点','female 锚点',0,1],['age','年龄形态','age','newborn −⅓','old 1',-1/3,1],['muscle','肌肉量','muscle','较少','较多',0,1],['weight','体重形态','weight','较轻形态','较重形态',0,1],['height','身高形态','height','较矮形态','较高形态',0,1],['proportions','身体比例','proportions','ideal 锚点','uncommon 锚点',0,1]];
let model,meta,result,baseline,geometry,mesh,renderer,scene,camera,orbit,bodyGroup,boneLines,floor,warm,cool,loading=false,ready=false,lost=false,auto=false,raf=0,last=0,frames=0,loadCount=0,evalFrame=0,currentView='front',qaContext=null;
let state={phenotypes:{},localChanges:{},pose:{}},originalHeight=1,fitDistance=3;
let loadGeneration=0,activeLoad=null;
const status=s=>$('modelStatus').textContent=s,notice=s=>$('notice').textContent=s;
const sha=async buffer=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),n=>n.toString(16).padStart(2,'0')).join('');
function render(){if(ready&&!lost&&!document.hidden){renderer.render(scene,camera);frames++;}}
function stop(){cancelAnimationFrame(raf);raf=0;last=0;}
function tick(t){raf=0;if(!auto||lost||document.hidden||!ready)return;const dt=last?Math.min((t-last)/1000,.1):0;last=t;const offset=camera.position.clone().sub(orbit.target).applyAxisAngle(new THREE.Vector3(0,1,0),dt*.3);camera.position.copy(orbit.target).add(offset);orbit.update();render();raf=requestAnimationFrame(tick);}
function schedule(){if(auto&&ready&&!lost&&!document.hidden&&!raf)raf=requestAnimationFrame(tick);}
function toggleAuto(value){auto=value;$('rotate').setAttribute('aria-pressed',String(value));stop();schedule();}
function resize(){if(!renderer)return;const b=$('stage').getBoundingClientRect();renderer.setSize(Math.max(b.width,1),Math.max(b.height,1),false);camera.aspect=b.width/Math.max(b.height,1);camera.updateProjectionMatrix();render();}
function view(which=currentView){if(!ready)return;currentView=which;toggleAuto(false);const b=new THREE.Box3().setFromBufferAttribute(geometry.attributes.position),size=new THREE.Vector3();b.getSize(size);const c=b.getCenter(new THREE.Vector3());c.set(c.x,c.z,-c.y);const vertical=size.z,horizontal=which==='side'?size.y:size.x;fitDistance=Math.max(vertical,horizontal/Math.max(camera.aspect,.2))/(2*Math.tan(camera.fov*Math.PI/360))*1.18;const angle={front:0,three:.55,side:Math.PI/2,back:Math.PI}[which]||0;camera.zoom=1;camera.position.copy(c).add(new THREE.Vector3(Math.sin(angle)*fitDistance,.025*fitDistance,Math.cos(angle)*fitDistance));orbit.target.copy(c);orbit.minDistance=Math.max(.1,fitDistance*.16);orbit.maxDistance=fitDistance*5;camera.updateProjectionMatrix();orbit.update();render();}
function initGraphics(){if(renderer)return;renderer=new THREE.WebGLRenderer({canvas:$('canvas'),antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setClearColor(0x19262e);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(32,1,.005,100);orbit=new OrbitControls(camera,$('canvas'));orbit.enableDamping=false;orbit.addEventListener('change',render);orbit.addEventListener('start',()=>toggleAuto(false));scene.add(new THREE.HemisphereLight(0xeaf4ff,0x414a42,1.05));warm=new THREE.DirectionalLight(0xffc691,3.5);cool=new THREE.DirectionalLight(0x8dbbff,2.6);warm.position.set(2,3,3);cool.position.set(-2,1,-.4);scene.add(warm,cool);bodyGroup=new THREE.Group();bodyGroup.rotation.x=-Math.PI/2;scene.add(bodyGroup);floor=new THREE.GridHelper(3,12,0x46554f,0x283a40);floor.material.transparent=true;floor.material.opacity=.32;scene.add(floor);new ResizeObserver(resize).observe($('stage'));resize();}
const ownsLoad=request=>activeLoad===request&&loadGeneration===request.generation;
function checkLoad(request){if(!ownsLoad(request)||request.controller.signal.aborted)throw new DOMException('Model loading cancelled','AbortError');}
function cancelLoad(reason='user'){
  const request=activeLoad;if(!request||ready)return;
  request.reason=reason;clearTimeout(request.timer);activeLoad=null;loadGeneration++;loading=false;
  request.controller.abort();
  $('cancelLoad').hidden=true;$('loadSpinner').hidden=true;$('retry').hidden=false;
  $('loadText').textContent=reason==='pagehide'?'载入已停止，返回后可重试':'已取消载入';
  status('模型未载入，点击重试后重新下载');
}
async function readWithProgress(url,expected,request){
  if(!Number.isFinite(expected)||expected<=0)throw Error('模型大小信息无效');
  const response=await fetch(url,{signal:request.controller.signal});checkLoad(request);
  if(!response.ok)throw Error('模型下载 HTTP '+response.status);
  const chunks=[],reader=response.body.getReader();let total=0;
  try{
    while(true){
      const{done,value}=await reader.read();checkLoad(request);if(done)break;
      total+=value.length;if(total>expected)throw Error('模型大小校验失败');
      chunks.push(value);$('progress').value=((request.receivedBase||0)+total)/(request.totalDownload||expected);
      $('loadText').textContent='读取真实 Anny 数据 · '+(((request.receivedBase||0)+total)/1048576).toFixed(1)+' / '+((request.totalDownload||expected)/1048576).toFixed(1)+' MiB';
    }
    if(total!==expected)throw Error('模型下载不完整');
    const bytes=new Uint8Array(total);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    return bytes;
  }finally{try{await reader.cancel();}catch{}reader.releaseLock();}
}
async function load(){
  if(loading||ready)return;
  const request={generation:++loadGeneration,controller:new AbortController(),reason:null,timer:null};
  activeLoad=request;loading=true;loadCount++;
  request.timer=setTimeout(()=>{if(ownsLoad(request)){request.reason='timeout';request.controller.abort();}},180000);
  $('retry').hidden=true;$('cancelLoad').hidden=false;$('loadSpinner').hidden=false;
  $('loading').hidden=false;$('progress').value=0;$('loadText').textContent='正在读取 Anny 模型信息';
  status('正在载入官方模型，可随时取消');
  try{
    initGraphics();
    const response=await fetch('./assets/anny-model.json',{signal:request.controller.signal});checkLoad(request);
    if(!response.ok)throw Error('元数据下载 HTTP '+response.status);
    const nextMeta=await response.json();checkLoad(request);
    if(nextMeta.source_commit!==SOURCE)throw Error('官方模型版本不匹配');
    if(!globalThis.DecompressionStream)throw Error('浏览器暂不支持 gzip 模型解压，请使用较新版本的 Safari、Chrome 或 Firefox');
    const transport=nextMeta.binary.compressed;
    $('loadInfo').textContent='首次下载约 '+(transport.byteLength/1048576).toFixed(1)+' MiB，解压后模型约 '+(nextMeta.binary.byteLength/1048576).toFixed(1)+' MiB；解压与计算还需额外内存';
    const packed=new Uint8Array(transport.byteLength);request.totalDownload=transport.byteLength;request.receivedBase=0;
    for(const part of transport.parts){
      const bytes=await readWithProgress(part.url,part.byteLength,request);checkLoad(request);
      if(await sha(bytes)!==part.sha256)throw Error('模型分片 SHA-256 不匹配');checkLoad(request);
      packed.set(bytes,request.receivedBase);request.receivedBase+=bytes.byteLength;
    }
    if(request.receivedBase!==transport.byteLength)throw Error('模型分片总长度不匹配');
    const packedHash=await sha(packed);checkLoad(request);
    if(packedHash!==transport.sha256)throw Error('下载数据 SHA-256 不匹配');
    $('loadText').textContent='校验并构建原生骨骼与顶点';
    const stream=new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'),{signal:request.controller.signal});
    const buffer=await new Response(stream).arrayBuffer();checkLoad(request);
    if(buffer.byteLength!==nextMeta.binary.byteLength)throw Error('解压数据大小校验失败');
    const bufferHash=await sha(buffer);checkLoad(request);
    if(bufferHash!==nextMeta.binary.sha256)throw Error('解压数据校验失败');
    // Only the current request may commit a fully verified model. Cancelled
    // earlier downloads, hashes, and decompression cannot overwrite a retry.
    meta=nextMeta;model=new AnnyModel(meta,buffer);result=model.forward(state);baseline=result.vertices.slice();
    geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(result.vertices.slice(),3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(new THREE.BufferAttribute(model.arrays.faces,1));geometry.computeVertexNormals();geometry.computeBoundingSphere();mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xb6beb0,roughness:.6,metalness:.04}));bodyGroup.add(mesh);
    const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array((model.boneCount-1)*6),3));boneLines=new THREE.LineSegments(lineGeometry,new THREE.LineBasicMaterial({color:0xd4ff87,depthTest:false,transparent:true,opacity:.8}));boneLines.visible=false;boneLines.renderOrder=2;bodyGroup.add(boneLines);
    populateParameters();ready=true;$('editors').disabled=false;$('loading').hidden=true;updateGeometry(result);originalHeight=mesh.geometry.boundingBox?.getSize(new THREE.Vector3()).z||1;status('Anny 原生身体 · 官方默认基线');$('meshStats').textContent=meta.num_vertices.toLocaleString()+' 顶点 / '+meta.num_faces.toLocaleString()+' 三角面 / 104 骨骼';resize();view();
  }catch(error){
    if(!ownsLoad(request))return;
    $('loadText').textContent='未能载入：'+(request.reason==='timeout'?'连接超时，可以重试':error.message);
    $('retry').hidden=false;$('loadSpinner').hidden=true;status('模型未就绪，可以重试');
  }finally{
    clearTimeout(request.timer);
    if(ownsLoad(request)){activeLoad=null;loading=false;$('cancelLoad').hidden=true;}
  }
}
$('cancelLoad').onclick=()=>cancelLoad();
addEventListener('pagehide',()=>cancelLoad('pagehide'));
function updateGeometry(output){geometry.attributes.position.array.set(output.vertices);geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.computeBoundingBox();floor.position.y=geometry.boundingBox.min.z-.008;let o=0;const lines=boneLines.geometry.attributes.position.array;for(let i=0;i<model.boneCount;i++){const p=model.boneParents[i];if(p<0)continue;for(const b of [p,i])for(const d of [3,7,11])lines[o++]=output.bonePoses[b*16+d];}boneLines.geometry.attributes.position.needsUpdate=true;boneLines.geometry.computeBoundingSphere();render();}
function countEdits(){return Object.values(state.phenotypes).filter(v=>Math.abs(v-.5)>1e-9).length+Object.values(state.localChanges).filter(v=>Math.abs(v)>1e-9).length+Object.values(state.pose).filter(a=>a.some(v=>Math.abs(v)>1e-9)).length;}
function evaluate(){evalFrame=0;if(!ready)return;const t=performance.now();result=model.forward(state);updateGeometry(result);let max=0,sum=0;for(let i=0;i<baseline.length;i++){const d=result.vertices[i]-baseline[i];sum+=d*d;max=Math.max(max,Math.abs(d));}const changes=countEdits();$('difference').textContent=changes?changes+' 项编辑 · 基线顶点最大分量差 '+(max*1000).toFixed(1)+' mm':'原始基线 · 所有形态参数 0.5';$('performance').textContent=(performance.now()-t).toFixed(0)+' ms / 前向计算 + 网格更新';status(changes?'Anny 原生身体 · 当前实验参数':'Anny 原生身体 · 官方默认基线');render();}
function queueEvaluate(){if(!evalFrame)evalFrame=requestAnimationFrame(evaluate);}
function synchronize(){for(const [key] of specs){$('p-'+key).value=state.phenotypes[key]??.5;$('v-'+key).textContent=Number(state.phenotypes[key]??.5).toFixed(3);}syncLocal();syncBone();}
function reset(){state={phenotypes:{},localChanges:{},pose:{}};synchronize();evaluate();view('front');notice('已还原官方默认：六个形态参数均为 0.5，局部变化和姿态归零');}
function populateParameters(){for(const [key,label,en,left,right,min,max] of specs){const el=document.createElement('div');el.className='slider-card';el.innerHTML='<div class="slider-title"><label for="p-'+key+'">'+label+' <span>'+en+'</span></label><output id="v-'+key+'">0.500</output></div><input id="p-'+key+'" type="range" min="'+min+'" max="'+max+'" step="any" value="0.5"><div class="range-ends"><span>'+left+'</span><span>'+right+'</span></div>';$('phenotypes').append(el);$('p-'+key).oninput=e=>{state.phenotypes[key]=Number(e.target.value);$('v-'+key).textContent=state.phenotypes[key].toFixed(3);queueEvaluate();};}fillLocalSelect();const common=['root','spine02','head','neck01','upperarm01.L','upperarm01.R','lowerarm01.L','lowerarm01.R','upperleg01.L','upperleg01.R','lowerleg01.L','lowerleg01.R'];for(const b of [...common,...model.boneLabels.filter(b=>!common.includes(b))]){const o=document.createElement('option');o.value=b;o.textContent=boneName(b);$('boneSelect').append(o);}$('boneSelect').value='upperarm01.L';for(let i=0;i<3;i++){const row=document.createElement('div');row.className='pose-row';row.innerHTML='<label for="pose'+i+'">'+['X','Y','Z'][i]+'</label><input id="pose'+i+'" type="range" min="-120" max="120" value="0" step="1"><output id="poseOut'+i+'">0°</output>';$('poseSliders').append(row);$('pose'+i).oninput=e=>{const bone=$('boneSelect').value;state.pose[bone]??=[0,0,0];state.pose[bone][i]=Number(e.target.value);$('poseOut'+i).textContent=e.target.value+'°';queueEvaluate();};}syncLocal();syncBone();}
function boneName(b){const names={root:'根骨骼',spine02:'脊柱',head:'头',neck01:'颈部','upperarm01.L':'左上臂','upperarm01.R':'右上臂','lowerarm01.L':'左前臂','lowerarm01.R':'右前臂','upperleg01.L':'左大腿','upperleg01.R':'右大腿','lowerleg01.L':'左小腿','lowerleg01.R':'右小腿'};return (names[b]?names[b]+' · ':'')+b;}
function fillLocalSelect(){if(!model)return;const old=$('localSelect').value,search=$('localSearch').value.trim().toLowerCase();$('localSelect').replaceChildren();for(const label of model.localChangeLabels.filter(l=>l.includes(search))){const o=document.createElement('option');o.value=label;o.textContent=label;$('localSelect').append(o);}if([...$('localSelect').options].some(o=>o.value===old))$('localSelect').value=old;$('localValue').disabled=!$('localSelect').value;syncLocal();}
function syncLocal(){const value=state.localChanges[$('localSelect').value]||0;$('localValue').value=value;$('localOutput').textContent=value.toFixed(2);}
function syncBone(){const value=state.pose[$('boneSelect').value]||[0,0,0];for(let i=0;i<3;i++){const el=$('pose'+i);if(el){el.value=value[i];$('poseOut'+i).textContent=value[i]+'°';}}}
$('retry').onclick=load;$('baseline').onclick=reset;$('fit').onclick=()=>view();document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));$('rotate').onclick=()=>toggleAuto(!auto);for(const [id,factor] of [['zoomIn',1.15],['zoomOut',1/1.15]])$(id).onclick=()=>{if(!ready)return;camera.zoom=Math.max(.4,Math.min(8,camera.zoom*factor));camera.updateProjectionMatrix();render();};for(const id of ['warm','cool'])$(id).onclick=()=>{const light=id==='warm'?warm:cool;if(!light)return;light.visible=!light.visible;$(id).setAttribute('aria-pressed',String(light.visible));render();};for(const [id,target,property] of [['wire',()=>mesh?.material,'wireframe'],['skeleton',()=>boneLines,'visible']])$(id).onclick=()=>{const object=target();if(!object)return;object[property]=!object[property];$(id).setAttribute('aria-pressed',String(object[property]));render();};
$('localSearch').oninput=fillLocalSelect;$('localSelect').onchange=syncLocal;$('localValue').oninput=()=>{const key=$('localSelect').value;if(!key)return;state.localChanges[key]=Number($('localValue').value);syncLocal();queueEvaluate();};$('resetLocal').onclick=()=>{delete state.localChanges[$('localSelect').value];syncLocal();evaluate();};$('clearLocals').onclick=()=>{state.localChanges={};syncLocal();evaluate();};$('boneSelect').onchange=syncBone;$('resetBone').onclick=()=>{delete state.pose[$('boneSelect').value];syncBone();evaluate();};$('clearPose').onclick=()=>{state.pose={};syncBone();evaluate();};
document.querySelectorAll('[data-local]').forEach(b=>b.onclick=()=>{$('localSearch').value='';fillLocalSelect();$('localSelect').value=b.dataset.local;syncLocal();});
const posePresets={neutral:{},arms:{'upperarm01.L':[0,0,-25],'upperarm01.R':[0,0,25],'lowerarm01.L':[35,0,0],'neck01':[0,15,0]},step:{'upperleg01.L':[25,0,0],'upperleg01.R':[-20,0,0],'lowerleg01.L':[30,0,0],'lowerleg01.R':[10,0,0],'spine02':[0,0,8]}};
document.querySelectorAll('[data-pose]').forEach(b=>b.onclick=()=>{state.pose=structuredClone(posePresets[b.dataset.pose]);syncBone();evaluate();});
const shapePresets={baseline:{},adult:{age:2/3},child:{age:1/3},elder:{age:1},athletic:{gender:0,age:2/3,muscle:1,weight:.75,height:.8,proportions:.2}};
document.querySelectorAll('[data-shape]').forEach(b=>b.onclick=()=>{state.phenotypes={...shapePresets[b.dataset.shape]};synchronize();evaluate();view();});
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function profile(){return {schema:'kaopu-anny-profile/1',sourceCommit:SOURCE,modelHash:meta.binary.sha256,rig:'anny',topology:'anny',poseParameterization:'local-ref',eulerOrder:'RxRyRz',units:'metres',upAxis:'Z',parameters:structuredClone(state)};}
$('exportProfile').onclick=()=>download('kaopu-anny-parameters.json',JSON.stringify(profile(),null,2),'application/json');
$('exportObj').onclick=()=>{let text='# Official Anny v0.6.1 browser output; metres; Z-up; '+SOURCE+'\n';for(let i=0;i<result.vertices.length;i+=3)text+='v '+result.vertices[i]+' '+result.vertices[i+1]+' '+result.vertices[i+2]+'\n';const f=model.arrays.faces;for(let i=0;i<f.length;i+=3)text+='f '+(f[i]+1)+' '+(f[i+1]+1)+' '+(f[i+2]+1)+'\n';download('kaopu-anny-current.obj',text,'text/plain');};
function validateProfile(p){if(p.schema!=='kaopu-anny-profile/1'||p.sourceCommit!==SOURCE||p.modelHash!==meta.binary.sha256||p.rig!=='anny'||p.topology!=='anny'||p.poseParameterization!=='local-ref'||p.eulerOrder!=='RxRyRz')throw Error('档案版本或坐标约定不匹配');const s=p.parameters;if(!s||typeof s!=='object')throw Error('缺少参数');const clean={phenotypes:{},localChanges:{},pose:{}};for(const [group,labels] of [['phenotypes',model.phenotypeLabels],['localChanges',model.localChangeLabels],['pose',model.boneLabels]]){if(!s[group]||Array.isArray(s[group])||typeof s[group]!=='object')throw Error('参数结构错误');for(const [key,v] of Object.entries(s[group])){if(!labels.includes(key))throw Error('未知参数 '+key);if(group==='pose'){if(!Array.isArray(v)||v.length!==3||v.some(n=>!Number.isFinite(n)||Math.abs(n)>120))throw Error('骨骼角度超出工作台范围');clean.pose[key]=v.slice();}else{const min=group==='localChanges'?-1:key==='age'?-1/3:0;if(!Number.isFinite(v)||v<min-1e-9||v>1)throw Error('参数超出工作台范围');clean[group][key]=v;}}}return clean;}
let importGeneration=0;$('importProfile').onchange=async()=>{const file=$('importProfile').files[0];if(!file)return;const generation=++importGeneration;try{if(file.size>200000)throw Error('档案大于 200 KB');const p=JSON.parse(await file.text());if(generation!==importGeneration)return;const next=validateProfile(p);model.forward(next);state=next;synchronize();evaluate();view();notice('已恢复参数，来源版本、骨架、姿态约定和模型哈希均通过校验');}catch(e){notice('未导入：'+e.message);}finally{if(generation===importGeneration)$('importProfile').value='';}};
$('canvas').addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;stop();status('图形上下文中断；参数已保留，等待恢复');});$('canvas').addEventListener('webglcontextrestored',()=>{requestAnimationFrame(()=>{lost=false;renderer.setClearColor(0x19262e);resize();render();schedule();status('图形已恢复 · 当前参数保持');});});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else{render();schedule();}});addEventListener('pagehide',stop);addEventListener('pageshow',()=>{resize();render();schedule();});
window.annyWorkbench={diagnostics:()=>({ready,loading,loadGeneration,requestInFlight:!!activeLoad,lost,auto,raf:!!raf,frames,loadCount,vertices:model?.vertexCount,faces:meta?.num_faces,bones:model?.boneCount,contextCount:renderer?1:0}),positions:()=>result?.vertices.slice(),profile,reset,forward:inputs=>model.forward(inputs).vertices,pixelAudit:()=>{render();const gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,p=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,p);let colors=new Set();for(let y=0;y<h;y+=8)for(let x=0;x<w;x+=8){const i=(y*w+x)*4;colors.add(p[i]+','+p[i+1]+','+p[i+2]);}return{colors:colors.size,background:Array.from(p.subarray(0,4)),error:gl.getError()};},loseContext:()=>{qaContext=renderer?.getContext().getExtension('WEBGL_lose_context');qaContext?.loseContext();},restoreContext:()=>qaContext?.restoreContext()};
load();
