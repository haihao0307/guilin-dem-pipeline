import * as T from 'three';
import {GLTFLoader} from '../../a4-a6-source-comparison-r03/vendor/GLTFLoader.mjs';
import {RoomEnvironment} from '../../a4-a6-source-comparison-r03/vendor/RoomEnvironment.mjs';
import {restoreOriginal} from '../../a4-a6-source-comparison-r03/src/original-chassis-recovery.mjs';
import {applyAcceptanceCamera,projectedExtents} from '../../a4-a6-source-comparison-r03/src/orthographic-acceptance.mjs';
import {registerWheelEnvelopeDisplay} from '../../a4-a6-source-comparison-r03/src/source-display-datums.mjs';
import {reconstructDocument,makeGltfBridge,sha256,verifyImplementation} from '../src/exact-decoder.mjs';
import {getBytes,unpack} from './transport.mjs';
import {loadResidualParts} from './storage.mjs';
const ruleTextures=new URL(location.href).searchParams.has('ruleTextures');
const qa=window.CONVERSION_QA,stage=document.querySelector('#stage'),status=document.querySelector('#status'),panels=[],sources=[];
function progress(id,phase,e={}){qa.progress[id]={phase,...e};status.textContent=Object.entries(qa.progress).map(([k,p])=>k+': '+p.phase+(p.loaded!==undefined?' '+(p.loaded/1048576).toFixed(1)+' MB':'')+(p.attempt?' (第'+p.attempt+'次)':'')).join('\n');}
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.debug.onShaderError=(gl,p)=>fail(Error('SHADER '+gl.getProgramInfoLog(p)));stage.append(renderer.domElement);
const studio=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.04).texture;studio.dispose();pmrem.dispose();
let view='side',playing=false,time=0,last=0;
function render(){const sw=stage.clientWidth,sh=stage.clientHeight,base=stage.getBoundingClientRect();renderer.setSize(sw,sh,false);renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);const frames=new Map();let scale=0;
 for(const key of ['a4','mark3']){const pair=panels.filter(p=>p.key===key);if(!pair.length)continue;const box=new T.Box3();pair.forEach(p=>box.union(p.bounds));const size=box.getSize(new T.Vector3()),extent=projectedExtents(size,view);for(const p of pair){const r=p.element.getBoundingClientRect();scale=Math.max(scale,extent.width/r.width,extent.height/r.height);}frames.set(key,box.getCenter(new T.Vector3()));}scale*=1.12;
 for(const p of panels){const r=p.element.getBoundingClientRect();applyAcceptanceCamera(T,p.camera,{view,center:frames.get(p.key),worldUnitsPerPixel:scale,width:r.width,height:r.height});renderer.setViewport(r.left-base.left,sh-(r.bottom-base.top),r.width,r.height);renderer.setScissor(r.left-base.left,sh-(r.bottom-base.top),r.width,r.height);renderer.render(p.scene,p.camera);}Object.assign(qa,{view,worldUnitsPerPixel:scale,visiblePanels:panels.map(p=>p.id)});
}
function addPanel(key,kind,source){source.root.updateMatrixWorld(true);const inverseRestRoot=source.root.matrixWorld.clone().invert();source.materialRestMatrices=new WeakMap();source.root.traverse(o=>{if(o.isMesh)source.materialRestMatrices.set(o,new T.Matrix4().multiplyMatrices(inverseRestRoot,o.matrixWorld));});const scene=new T.Scene();scene.background=new T.Color('#e9e6dd');scene.environment=environment;scene.add(registerWheelEnvelopeDisplay(T,source));scene.add(new T.HemisphereLight(0xffffff,0x656b62,1.2));const sun=new T.DirectionalLight(0xffffff,2);sun.position.set(10,20,15);scene.add(sun);const id=key+'-'+kind;panels.push({id,key,source,scene,camera:new T.OrthographicCamera(),element:document.getElementById(id),bounds:new T.Box3().setFromObject(source.root,true)});sources.push(source);render();progress(id,'完整场景已显示');}
async function converted(key){const id=key+'-converted',base=new URL('../generated/'+key+'/',import.meta.url);const get=async path=>getBytes(new URL(path,base),e=>progress(id,'下载 '+path,e));
 const manifest=JSON.parse(new TextDecoder().decode(await unpack(await get('program.json.gz'))));progress(id,'核对共享函数实现版本');await verifyImplementation(manifest,async path=>getBytes(new URL('../'+path,import.meta.url),e=>progress(id,'核对代码 '+path,e)));const storage=JSON.parse(new TextDecoder().decode(await get('storage-manifest.json')));const residual=await loadResidualParts(storage,get),shapes=new Map();for(const a of manifest.shapeAssets||[])shapes.set(a.path,await get(a.path));progress(id,'执行形体/组件函数；逐字段与完整载荷SHA核验');
 const result=await reconstructDocument(manifest,residual,shapes);const urls=[],binaryURL=URL.createObjectURL(new Blob([result.payload]));urls.push(binaryURL);const g=makeGltfBridge(result.document,binaryURL),c=result.document.content;
 let textureBridge=null;
 if(ruleTextures){const {createGltfTextureRuleBridge}=await import('../texture-rules/gltf-texture-bridge.mjs');textureBridge=await createGltfTextureRuleBridge(T,{model:key,document:result.document,gltf:g,getBytes:url=>getBytes(url,e=>progress(id,'执行纹理规则',e))});}
 const imageBase=base;
 if(!ruleTextures)for(let i=0;i<c.images.length;i++){const im=c.images[i],bytes=await getBytes(new URL(im.payload,imageBase),e=>progress(id,'验证贴图 '+im.payload,e));if(bytes.length!==im.bytes||await sha256(bytes)!==im.sha256)throw Error('IMAGE_INTEGRITY '+im.payload);const u=URL.createObjectURL(new Blob([bytes],{type:im.definition.mimeType||(/\.jpe?g$/i.test(im.payload)?'image/jpeg':'image/png')}));urls.push(u);g.images[i].uri=u;}
 let model;try{const loader=new GLTFLoader();if(textureBridge)loader.register(textureBridge.plugin);model=await loader.parseAsync(JSON.stringify(g),'');textureBridge?.assertComplete(model);}finally{urls.forEach(URL.revokeObjectURL);}
 const nodes=await Promise.all(g.nodes.map((_,i)=>model.parser.getDependency('node',i))),rest=nodes.map(n=>({position:n.position.clone(),quaternion:n.quaternion.clone(),scale:n.scale.clone(),matrix:n.matrix.clone()})),mixer=new T.AnimationMixer(model.scene);
 const source={key,root:model.scene,model,nodes,rest,mixer,g,setTime(t){mixer.stopAllAction();nodes.forEach((n,i)=>{n.position.copy(rest[i].position);n.quaternion.copy(rest[i].quaternion);n.scale.copy(rest[i].scale);n.matrix.copy(rest[i].matrix);});if(model.animations[0]){const action=mixer.clipAction(model.animations[0]);action.reset().setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(t);}model.scene.updateMatrixWorld(true);}};
 qa[key]={fieldPayloadSHA256:await sha256(result.payload),nodeCount:g.nodes.length,meshCount:g.meshes.length,shapeFunctions:manifest.fieldFunctions.filter(f=>f.program.some(r=>/Exact$/.test(r.op)&&!['arithmeticExact'].includes(r.op))).length,sourceFallbackUsed:false,textureMode:ruleTextures?'exact-regions-rgba':'encoded-source-images',textureRules:textureBridge?.report??null};return source;
}
for(const name of ['side','front','top'])document.getElementById(name).onclick=()=>{view=name;render();};document.getElementById('play').onclick=()=>{playing=!playing;};document.getElementById('rest').onclick=()=>{playing=false;time=0;sources.forEach(s=>{s.mixer.stopAllAction();s.nodes.forEach((n,i)=>{n.position.copy(s.rest[i].position);n.quaternion.copy(s.rest[i].quaternion);n.scale.copy(s.rest[i].scale);n.matrix.copy(s.rest[i].matrix);});s.root.updateMatrixWorld(true);});render();};addEventListener('resize',render);
renderer.setAnimationLoop(now=>{if(playing){time+=Math.min(.1,(now-last)/1000);for(const s of sources)if(s.model.animations[0])s.setTime(time%s.model.animations[0].duration);render();}last=now;});
async function switchMaterialMode(mode){
 if(!qa.ready)throw Error('Wait for complete source verification before material upgrade.');
 if(!qa.masterBindings){
  const masterDirectory=new URL(location.href).searchParams.get('masterVersion')==='2'?'master-materials-v2':'master-materials';const masterBase=new URL('../'+masterDirectory+'/',import.meta.url);const lock=JSON.parse(new TextDecoder().decode(await getBytes(new URL('runtime-lock.json',masterBase))));for(const f of lock.files){const bytes=await getBytes(new URL(f.path,masterBase),e=>progress('master','核对大师函数 '+f.path,e));if(bytes.length!==f.bytes||await sha256(bytes)!==f.sha256)throw Error('MASTER_IMPLEMENTATION_INTEGRITY '+f.path);}const {installTrainMaster}=await import('../'+masterDirectory+'/train-binding.mjs');
  qa.masterBindings=panels.filter(p=>p.id.endsWith('converted')).map(p=>({key:p.key,binding:installTrainMaster(T,p.source)}));
 }
 for(const item of qa.masterBindings)item.binding.switchMode(mode);
 qa.materialMode=mode;qa.materialVersion=new URL(location.href).searchParams.get('masterVersion')==='2'?'2':'1';qa.materialRecords=qa.masterBindings.map(x=>({key:x.key,records:x.binding.records}));
 for(const p of panels.filter(p=>p.id.endsWith('converted')))p.element.querySelector('.label').textContent=p.key.toUpperCase()+(mode==='source-exact'?' 函数/模板/残差重建':' 自有大师材质候选 · 未验收');
 render();status.textContent=mode==='source-exact'?'源精确材质已恢复。所有原材质引用保留。':'自有 R06 金属 / R03 玻璃升级候选；配方与源不同，材质域未米制标定。铜金/图案等未适配项保留原材质。';
 return qa.materialRecords;
}
qa.switchMaterialMode=switchMaterialMode;
for(const [id,mode] of [['source-material','source-exact'],['master-material','master-upgrade']])document.getElementById(id).onclick=()=>switchMaterialMode(mode).catch(fail);
const convertedOnly=new URL(location.href).searchParams.has('convertedOnly');
await Promise.all(['a4','mark3'].flatMap(key=>[...(convertedOnly?[]:[restoreOriginal(key,{onProgress:e=>progress(key+'-original',e.phase,e)}).then(s=>addPanel(key,'original',s))]),converted(key).then(s=>addPanel(key,'converted',s))]));
Object.assign(qa,{ready:true,panels,sources,renderer,render});status.textContent=panels.length+'格均完成完整性核验。逐字段、节点、材质、贴图、动画由精确转换器回放；原始残差仍明确保留。';render();
