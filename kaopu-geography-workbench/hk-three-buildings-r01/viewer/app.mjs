import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {makeMaterial,MATERIAL_NAMES} from './materials.mjs';
import {groupByMaterial} from './geometry-utils.mjs';
import {buildGeometry} from '../geometry/reconstruct.mjs';
const $=id=>document.getElementById(id),errors=[];
window.__KAOPU_TRIAL__={ready:false,contextReady:false,fatalError:null,errors};
window.addEventListener('error',e=>{errors.push(e.message);window.__KAOPU_TRIAL__.fatalError=e.message;});
const query=new URLSearchParams(location.search),canvas=$('view');
let manifest,entries=[],objects=[],selected='all',currentView='whole',mode='material',modeVersion=0,framePending=false,frameCount=0,lastRenderMs=0;
let contextHook=null;
const settings={age:.32,wet:.24,grain:1,windows:0,plain:0,seed:19};
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xeeeeee,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.debug.onShaderError=(gl,p,vs,fs)=>{errors.push({vertex:gl.getShaderInfoLog(vs),fragment:gl.getShaderInfoLog(fs),program:gl.getProgramInfoLog(p)});$('failure').hidden=false;$('failure').textContent='材质编译失败，未用平色替代。请查看验证报告。';};
const scene=new THREE.Scene(),root=new THREE.Group(),context=new THREE.Group();scene.add(root,context);
const camera=new THREE.PerspectiveCamera(38,1,.02,3000),controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.maxDistance=2000;controls.minDistance=.05;controls.addEventListener('change',requestRender);
scene.add(new THREE.HemisphereLight(0xf5f5eb,0x65725e,2.2));
const sun=new THREE.DirectionalLight(0xfff3df,3.1);sun.position.set(90,150,80);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.035;sun.shadow.bias=-.0001;scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight(0xd8e4ef,.5);fill.position.set(-70,40,-60);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(700,500),new THREE.MeshStandardMaterial({color:0xd4d8c7,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.055;ground.receiveShadow=true;context.add(ground);
const grid=new THREE.GridHelper(500,50,0xbec8b5,0xd0d6c7);grid.position.y=-.048;grid.material.transparent=true;grid.material.opacity=.28;context.add(grid);
function requestRender(){if(framePending)return;framePending=true;requestAnimationFrame(()=>{framePending=false;render();});}
function render(){const t=performance.now();renderer.render(scene,camera);lastRenderMs=performance.now()-t;frameCount++;$('perf').textContent=`${lastRenderMs.toFixed(1)} ms 提交 · ${renderer.info.render.calls} 次绘制`;return stats();}
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();requestRender();}
new ResizeObserver(resize).observe($('stage'));
function getBounds(){const b=new THREE.Box3();for(const o of objects)if(o.group.visible)b.expandByObject(o.group);return b;}
function cameraSnapshot(){return {position:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov,near:camera.near,far:camera.far,aspect:camera.aspect};}
function chosen(){return selected==='all'?objects:objects.filter((_,i)=>i===selected);}
async function ensureSource(o){
 if(o.source)return o.source;if(o.sourcePromise)return o.sourcePromise;
 o.sourcePromise=(async()=>{const preview=await json(urlFor(o.entry.sourcePreviewUrl));
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(preview.positions,3));if(preview.indices)g.setIndex(preview.indices);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xabb6ad,roughness:.86,side:THREE.DoubleSide,flatShading:true}));mesh.castShadow=true;mesh.receiveShadow=true;mesh.visible=false;o.group.add(mesh);o.source=mesh;return mesh;
 })();try{return await o.sourcePromise;}catch(e){o.sourcePromise=null;throw e;}
}
async function setMode(v){
 const version=++modeVersion;
 if(!['source','reconstruction','material'].includes(v))throw Error('Unknown display mode');
 if(v==='source'){try{await Promise.all(chosen().map(ensureSource));}catch(e){$('failure').hidden=false;$('failure').textContent='原件对照未能载入：'+e.message+'。重建和程序材质仍可独立使用。';throw e;}}
 if(version!==modeVersion)return mode;
 mode=v;$('failure').hidden=true;for(const o of objects){if(o.source)o.source.visible=v==='source';o.mesh.visible=v!=='source';for(const m of o.materials)m.userData.uniforms.uPlain.value=v==='reconstruction'?1:settings.plain;}for(const b of document.querySelectorAll('[data-mode]'))b.classList.toggle('active',b.dataset.mode===v);updateLabels();render();return mode;
}
function selectBuilding(v){modeVersion++;selected=v==='all'?'all':Number(v);for(let i=0;i<objects.length;i++)objects[i].group.visible=selected==='all'||selected===i;for(const b of document.querySelectorAll('[data-building]'))b.classList.toggle('active',String(selected)===b.dataset.building);if(contextHook)contextHook({selected,objects});setView(currentView);updateLabels();if(mode==='source')return setMode('source');}
function setView(v){currentView=v;const box=getBounds(),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
 if(v==='whole'){
  const radius=size.length()/2;const dist=radius/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))*1.13;
  const dir=selected==='all'?new THREE.Vector3(.5,.33,1).normalize():new THREE.Vector3(1,.55,1.35).normalize();
  controls.target.copy(center);camera.position.copy(center).addScaledVector(dir,dist);camera.near=.05;camera.far=Math.max(1500,dist*8);
 }else{
  const o=objects[selected==='all'?0:selected],f=o.nearFace,target=f.center.clone().add(o.group.position);
  const normal=f.normal.clone();
  const distance=v==='near'?1.25:Math.min(18,Math.max(8,o.size.y*.33));
  controls.target.copy(target);camera.position.copy(target).addScaledVector(normal,distance);camera.position.y+=v==='near'?.11:distance*.08;
  camera.near=v==='near'?.01:.05;camera.far=2000;
 }
 camera.updateProjectionMatrix();controls.update();for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view===v);
 updateLabels();render();return cameraSnapshot();}
function setMaterial(value){const vals={brick:0,plaster:1,concrete:2};if(value in vals)value=vals[value];for(const o of chosen()){o.materials[0].userData.uniforms.uMaterialKind.value=value==='preset'?o.index:Number(value);}if(document.querySelector(`#material option[value="${value}"]`))$('material').value=value;requestRender();}
function setParams(p){Object.assign(settings,p);for(const o of chosen())for(const m of o.materials){for(const [k,v] of Object.entries(p)){const u='u'+k[0].toUpperCase()+k.slice(1);if(m.userData.uniforms[u])m.userData.uniforms[u].value=Number(v);}}for(const k of ['age','wet','grain']){$(k).value=settings[k];$(k+'Value').textContent=Number(settings[k]).toFixed(2);}$('windows').checked=!!settings.windows;requestRender();return {...settings};}
function stats(){return {ready:window.__KAOPU_TRIAL__.ready,selected,view:currentView,mode,frames:frameCount,lastRenderCpuMs:lastRenderMs,renderer:renderer.info.render,memory:renderer.info.memory,pixelRatio:renderer.getPixelRatio(),drawingBuffer:[canvas.width,canvas.height],geometry:objects.map(o=>({id:o.entry.id,triangles:o.mesh.geometry.index?o.mesh.geometry.index.count/3:o.mesh.geometry.attributes.position.count/3,sourceTriangles:o.entry.sourceTriangles,sourceLoaded:!!o.source,size:o.size.toArray(),placement:o.group.position.toArray()})),settings:{...settings},camera:cameraSnapshot(),errors,limits:['CPU render submission timing is not GPU frame time','Surface microheight is shading-only','Far-footprint mean is approximate','Creative windows are not measured openings']};}
function updateLabels(){if(!objects.length)return;const all=selected==='all',o=objects[all?0:selected];$('viewTitle').textContent=all&&currentView==='whole'?'三栋 · 同一真实比例':o.entry.label;$('selectionLabel').textContent=all?'三栋独立实测主形':o.entry.label;$('geometryInfo').textContent=all?`${objects.reduce((s,o)=>s+o.triangles,0).toLocaleString()} 重建三角形 · 共享母体`:`${o.size.x.toFixed(1)} × ${o.size.z.toFixed(1)} × ${o.size.y.toFixed(1)} m · 不缩放`;
 $('viewNote').textContent=mode==='source'?'原件几何对照。同相机、同坐标，材质不代表原建筑外观。':currentView==='near'?'原建筑墙面上的程序材质近景。微表面不改变测量轮廓。':currentView==='mid'?'中景观察：砖缝与颗粒按屏幕足迹逐渐滤去。':all?'三栋独立源建筑，展示位置已并排排列；几何尺寸不变。':'实测主形与创作表面分离。窗门、楼层和内部空间未被推定。';}
function bestFace(g){const a=g.attributes.position,n=g.attributes.normal;let best=null,score=-Infinity;
 for(let i=0;i<a.count;i+=3){const p=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(a,i+j)),normal=new THREE.Vector3().crossVectors(p[1].clone().sub(p[0]),p[2].clone().sub(p[0]));const area=normal.length()/2;normal.normalize();if(Math.abs(normal.y)>.15)continue;const center=p[0].clone().add(p[1]).add(p[2]).multiplyScalar(1/3);const facing=Math.max(.1,normal.dot(new THREE.Vector3(.4,0,1).normalize()));const s=area*facing;if(s>score){score=s;best={center,normal};}}
 return best||{center:new THREE.Vector3(0,5,0),normal:new THREE.Vector3(0,0,1)};}
async function json(url){const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);return r.json();}
function urlFor(path){return new URL(path,new URL('../',location.href)).href;}
async function load(){
 const [m,source]=await Promise.all([json('../geometry/buildings.json'),fetch('./mothers/kaopu-original.glsl').then(r=>{if(!r.ok)throw Error('Missing exact material source');return r.text();})]);manifest=m;entries=Array.isArray(m)?m:m.buildings;
 if(!entries||entries.length!==3)throw Error('Manifest must contain exactly three buildings');
 let offset=0;
 for(let index=0;index<entries.length;index++){
  const entry=entries[index],score=await json(urlFor(entry.scoreUrl));
  let geometry=buildGeometry(score,THREE);if(geometry.geometry)geometry=geometry.geometry;geometry=groupByMaterial(geometry,THREE);geometry.computeVertexNormals();geometry.computeBoundingBox();const bounds=geometry.boundingBox,size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const materials=[makeMaterial(source,{kind:index,height:size.y,seed:19,...settings}),makeMaterial(source,{kind:2,height:size.y,seed:19,...settings}),makeMaterial(source,{kind:2,height:size.y,seed:19,...settings})];
  const mesh=new THREE.Mesh(geometry,materials);mesh.castShadow=true;mesh.receiveShadow=true;
  const group=new THREE.Group();group.add(mesh);group.position.set(offset-center.x,-bounds.min.y,-center.z);root.add(group);offset+=size.x+Math.max(15,size.x*.22);
  const o={index,entry,score,size,group,mesh,source:null,sourcePromise:null,materials,nearFace:bestFace(geometry),triangles:geometry.attributes.position.count/3};objects.push(o);
 }
 const bounds=new THREE.Box3().setFromObject(root),center=bounds.getCenter(new THREE.Vector3());for(const o of objects)o.group.position.x-=center.x;
 const span=bounds.getSize(new THREE.Vector3()).length();sun.shadow.camera.left=-span;sun.shadow.camera.right=span;sun.shadow.camera.top=span;sun.shadow.camera.bottom=-span;sun.shadow.camera.far=600;sun.shadow.camera.near=.1;sun.shadow.camera.updateProjectionMatrix();
 $('buildings').innerHTML=`<button data-building="all" class="active">三栋一起看<small>真实比例 · 独立实验场</small></button>`+objects.map((o,i)=>`<button data-building="${i}">${String(i+1).padStart(2,'0')} · ${o.entry.label}<small>${o.size.y.toFixed(1)} m 高 · ${MATERIAL_NAMES[i]}</small></button>`).join('');
 for(const b of document.querySelectorAll('[data-building]'))b.onclick=()=>Promise.resolve(selectBuilding(b.dataset.building)).catch(()=>{});
 for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>setView(b.dataset.view);
 for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>setMode(b.dataset.mode).catch(()=>{});
 for(const k of ['age','wet','grain'])$(k).oninput=e=>setParams({[k]:Number(e.target.value)});
 $('windows').onchange=e=>setParams({windows:e.target.checked?1:0});$('context').onchange=e=>{context.visible=e.target.checked;requestRender();};$('material').onchange=e=>setMaterial(e.target.value);$('reset').onclick=()=>setView('whole');
 $('export').onclick=()=>{const blob=new Blob([JSON.stringify({schema:'kaopu.hk-three-buildings.recipe/1',...stats()},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='kaopu-hk-three-buildings-recipe.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
 Object.assign(window.__KAOPU_TRIAL__,{ready:false,selectBuilding,setView,setMaterial,setParams,setMode,stats,render,cameraSnapshot,renderer,scene,camera,context,objects,setContextHook:h=>contextHook=h});
 resize();selectBuilding(query.get('building')||'all');if(query.has('material'))setMaterial(query.get('material'));if(query.get('windows')==='1')setParams({windows:1});if(query.get('plain')==='1')setParams({plain:1});if(query.has('view'))setView(query.get('view'));if(query.has('mode'))await setMode(query.get('mode'));
 $('loading').hidden=true;render();
 // Optional environment adapter is independently supplied; no placeholder plants.
 const module=await import('./context.mjs');if(module.installContext)await module.installContext({THREE,scene,context,ground,grid,objects,renderer,requestRender,source});window.__KAOPU_TRIAL__.contextReady=true;window.__KAOPU_TRIAL__.ready=true;render();
}
load().catch(e=>{window.__KAOPU_TRIAL__.fatalError=e.message;errors.push(e.stack||e.message);$('loading').hidden=true;$('failure').hidden=false;$('failure').textContent='载入未完成：'+e.message;});
