import {CANDIDATES,loadCandidateMesh,candidateToThree} from './candidate-adapter.mjs';

export const DEFAULT_PLACEMENTS=Object.freeze({
 bureau:{x:3310,z:5900,yaw:0,scale:1,heightOffset:.3,anchor:[3440,5850],meaning:'第二站附近可调故事位置；非庙街实址'},
 city:{x:3651.106,z:5505.324,yaw:0,scale:1,heightOffset:.2,meaning:'城寨参考点附近的旧双栋故事候选；非遗址测绘模型'}
});
export function samplePlacementHeight(hkHeight,state){const y=hkHeight(state.x,state.z);return (Number.isFinite(y)?y:0)+state.heightOffset;}
function retainVertexRoughness(T,object,roughness){
 object.geometry.setAttribute('candidateRoughness',new T.BufferAttribute(roughness,1));
 object.material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute float candidateRoughness; varying float vCandidateRoughness;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCandidateRoughness = candidateRoughness;');
  shader.fragmentShader='varying float vCandidateRoughness;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = clamp(vCandidateRoughness,0.02,1.0);');
 };
 object.material.customProgramCacheKey=()=> 'same-source-candidate-vertex-roughness-v1';
}
function placementControls({key,name,state,defaults,object,hkHeight,requestFrame,element,metadata}){
 if(!element)return;const fieldset=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=name+' · 同源粗采候选';fieldset.append(legend);
 const detail=document.createElement('small');detail.textContent=defaults.meaning+'。原米制 ×1；'+metadata.vertexCount.toLocaleString()+'顶点；网格步长 '+metadata.sampling.gridSpacingM+'m，薄件/室内受限。';fieldset.append(detail);
 const inputs={};const update=()=>{object.position.set(state.x,samplePlacementHeight(hkHeight,state),state.z);object.rotation.y=state.yaw*Math.PI/180;object.scale.setScalar(state.scale);object.updateMatrixWorld(true);object.userData.storyPlacement={...state,meaning:defaults.meaning,surveyed:false};requestFrame();};
 for(const [id,label,step,min,max]of [['x','东西 m',5,-100000,100000],['z','南北 m',5,-100000,100000],['yaw','朝向 °',5,-360,360],['scale','比例',.05,.1,5],['heightOffset','离地 m',.5,-50,100]]){const row=document.createElement('label');row.textContent=label+' ';const input=document.createElement('input');Object.assign(input,{type:'number',value:String(state[id]),step:String(step),min:String(min),max:String(max)});input.style.width='78px';input.setAttribute('aria-label',name+label);input.dataset.candidate=key;input.dataset.placement=id;input.addEventListener('change',()=>{const value=Number(input.value);if(!Number.isFinite(value)||value<min||value>max){input.value=String(state[id]);return;}state[id]=value;update();});row.append(input);fieldset.append(row);inputs[id]=input;}
 const reset=document.createElement('button');reset.type='button';reset.textContent='恢复此候选原比例与位置';reset.addEventListener('click',()=>{Object.assign(state,defaults);for(const [id,input]of Object.entries(inputs))input.value=String(state[id]);update();});fieldset.append(reset);element.append(fieldset);update();
}

/** Host supplies Three and its one scene/context. Each candidate succeeds or fails independently. */
export async function loadCandidates({T,scene,hkHeight,route,candidates,candidateStatus,requestFrame,placementsElement}){
 const report={schema:'same-world-candidate-load-v1',startedAt:new Date().toISOString(),models:{}};
 if(typeof window!=='undefined')window.HK_SAME_SOURCE_CANDIDATES=report;
 const jobs=[['bureau','lost-bureau'],['city','walled-pair']].map(async([key,id])=>{
  if(key==='city'){
   candidateStatus.city='原城寨程序作品保留；本地同版地图缓存未具备';report.models.city={status:'unavailable_existing_cache',sourceCommit:'942f27bfcf966d501e79586915899ba62cff75f5',originalProgramRetained:true};
   const b=document.querySelector('[data-camera=city]');if(b){b.disabled=true;b.textContent='城寨原缓存待接';}const toggle=document.getElementById('showCity');if(toggle){toggle.checked=false;toggle.disabled=true;}if(placementsElement){const note=document.createElement('p');note.textContent=candidateStatus.city+'。没有替代模型。';placementsElement.append(note);}requestFrame();return;
  }
  candidateStatus[key]='加载原场粗采网格';requestFrame();
  try{
   const mesh=await loadCandidateMesh(id),definition=CANDIDATES.find(m=>m.id===id),defaults={...DEFAULT_PLACEMENTS[key]};
   // Preserve the pair. Only its single story anchor may be offset if it sits on the display railway.
   if(key==='city'&&route?.nearest&&route?.sample){const q=route.sample(route.nearest([defaults.x,defaults.z]));if(Math.hypot(q.p[0]-defaults.x,q.p[2]-defaults.z)<35){defaults.x=q.p[0]+q.right[0]*45;defaults.z=q.p[2]+q.right[2]*45;defaults.meaning+='（让开显示铁路线45m）';}}
   const state={...defaults},object=candidateToThree(T,mesh);retainVertexRoughness(T,object,mesh.roughness);object.name=definition.name+' / '+id;object.position.set(state.x,samplePlacementHeight(hkHeight,state),state.z);object.rotation.y=state.yaw*Math.PI/180;object.scale.setScalar(state.scale);object.visible=typeof window==='undefined'||window.HK_CANDIDATE_VISIBILITY?.[key]!==false;object.userData.storyPlacement={...state,meaning:defaults.meaning,surveyed:false};object.userData.sourceCommit=mesh.metadata.sourceCommit;object.userData.finiteSampling=true;object.userData.geometrySource='actual same-source GPU surface intersections';object.userData.materialSource='original mother outputs at recorded fixed footprint';object.castShadow=false;object.receiveShadow=false;scene.add(object);candidates[key]=object;
   candidateStatus[key]=`已载入同源粗采：${mesh.metadata.vertexCount.toLocaleString()}顶点 · ×1原米制 · 可调故事位置`;
   placementControls({key,name:definition.name,state,defaults,object,hkHeight,requestFrame,element:placementsElement,metadata:mesh.metadata});
   report.models[key]={status:'loaded',sourceCommit:mesh.metadata.sourceCommit,vertexCount:mesh.metadata.vertexCount,triangleCount:mesh.metadata.triangleCount,sampling:mesh.metadata.sampling,placement:object.userData.storyPlacement};
  }catch(error){candidateStatus[key]='未载入真实网格：'+error.message;const b=document.querySelector('[data-camera='+key+']');if(b){b.disabled=true;b.textContent=(key==='city'?'城寨':'失物局')+'待接';b.title=error.message;}const toggle=document.getElementById(key==='city'?'showCity':'showBureau');if(toggle){toggle.checked=false;toggle.disabled=true;toggle.parentElement.lastChild.textContent=(key==='city'?'城寨':'失物局')+'（待接）';}document.getElementById('mapStatus').textContent='同場候選：機車＋煤水車 / 九龍 / '+(key==='city'?'失物局已接，城寨待接':'失物局未載入')+' · 車廂待接';report.models[key]={status:'failed',error:error.message};console.error('SAME_SOURCE_CANDIDATE',key,error);if(placementsElement){const message=document.createElement('p');message.textContent=(key==='bureau'?'失物局':'城寨')+'：'+candidateStatus[key];placementsElement.append(message);}}
  requestFrame();
 });await Promise.all(jobs);report.finishedAt=new Date().toISOString();return report;
}
