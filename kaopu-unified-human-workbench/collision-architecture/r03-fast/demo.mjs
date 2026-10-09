import * as THREE from '../../full/source/registration-vendor/three.module.js';
import {OrbitControls} from '../../full/ui/vendor/OrbitControls.js';
import {loadCommon} from '../../full/ui/load-common.mjs';
import {defaultState} from '../../full/src/State.mjs';
import {PRESETS,createPresetState} from '../../full/ui/PresetCatalogueR2.mjs';
import {AnimatedHuman} from '../../full/boxing/AnimatedHuman.mjs';
import {createBoxingRig} from '../../full/boxing/Motion.mjs';
import {createGlovePair} from '../../full/boxing-r02/Gloves.mjs';
import {surfaceFingerprint} from '../r02/SurfaceFingerprint.mjs';
import {SurfaceNarrowPhase} from './SurfaceNarrowPhase.mjs';
import {validateActualFixture} from './Validation.mjs';
const $=id=>document.getElementById(id),scene=new THREE.Scene();scene.background=new THREE.Color(0x203742);
const camera=new THREE.PerspectiveCamera(33,1,.01,30);camera.position.set(2.5,1.9,3.5);
const renderer=new THREE.WebGLRenderer({canvas:$('canvas'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
const orbit=new OrbitControls(camera,$('canvas'));orbit.target.set(0,.95,0);orbit.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xe9f9ff,0x766854,2.6));const light=new THREE.DirectionalLight(0xffe5c3,3);light.position.set(-3,5,4);scene.add(light);scene.add(new THREE.GridHelper(8,32,0x5d7e88,0x344e5b));
let loaded,human,rig,group,surface,pose,wire,gloves=[],marker=null,normalArrow=null,ready=false,busy=false,presetIndex=16,poseTime=0,lastResult=null,fingerprint=null;const errors=[];
const resize=()=>{const r=$('stage').getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe($('stage'));resize();
const render=()=>{orbit.update();renderer.render(scene,camera);};renderer.setAnimationLoop(render);
const controls=()=>{for(const id of ['preset','pose','validate','contact','focus','reset'])$(id).disabled=!ready||busy;};
function clearContact({clearResult=true}={}){
 if(marker){scene.remove(marker);marker.geometry.dispose();marker.material.dispose();marker=null;}
 if(normalArrow){scene.remove(normalArrow);normalArrow.dispose();normalArrow=null;}
 for(const glove of gloves)glove.visible=false;
 if(clearResult){lastResult=null;$('event').textContent='待检测';$('status').className='status';$('status').textContent='待验证 · 完整 hit / trianglePairs / unresolved 对照';$('timing').replaceChildren();}
}
function updatePose(){
 clearContact();pose=rig.evaluate(poseTime,{pairIndex:Math.floor(presetIndex/2),fighter:presetIndex%2,opponentStature:1.75});human.animate(pose.skinMatrices);group.updateWorldMatrix(true,false);
 const snapshot=surface.snapshot(pose.skinMatrices,group.matrixWorld.elements);surface.setStep(snapshot,snapshot);wire.geometry.attributes.position.array.set(surface.allPositions(snapshot));wire.geometry.attributes.position.needsUpdate=true;wire.geometry.computeBoundingSphere();wire.visible=$('surface').checked;
 $('badge').textContent=`实际皮肤 ${surface.triangleIds.length.toLocaleString()} 面 / 全CSR权重\n显示 ${human.N.toLocaleString()} 顶点 · 姿态 ${poseTime.toFixed(2)}s\n独立验证 · 未接18台实时`;
}
async function build(index=presetIndex){
 if(busy)return;busy=true;ready=false;controls();$('start').disabled=true;
 try{
  presetIndex=Number(index);$('preset').value=String(presetIndex);loaded??=await loadCommon({onProgress:p=>$('load').textContent=`校验现有人体资产 ${Math.round(p.fraction*100)}%`});clearContact();
  if(group){scene.remove(group,wire,...gloves);human.dispose();wire.geometry.dispose();wire.material.dispose();gloves.forEach(g=>g.dispose());surface=null;rig=null;human=null;group=null;wire=null;gloves=[];}
  const state=createPresetState(PRESETS[presetIndex].id,defaultState);loaded.model.compute(state);human=new AnimatedHuman(loaded.model,state,{color:0x387f9a});fingerprint=await surfaceFingerprint(human);
  rig=createBoxingRig({names:human.names,parents:human.rig.parents,restMatrices:human.rig.restMatrices,stature:human.height});group=new THREE.Group();group.position.y=human.floorOffset;group.add(human.mesh);scene.add(group);surface=new SurfaceNarrowPhase(human);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(human.N*3),3));geometry.setIndex(surface.triangleIds.flatMap(t=>[human.faces[t*3],human.faces[t*3+1],human.faces[t*3+2]]));wire=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x52e6d7,wireframe:true,transparent:true,opacity:.17,depthWrite:false}));scene.add(wire);
  gloves=createGlovePair({names:human.names,height:human.height,color:0xd8a047});scene.add(...gloves);updatePose();ready=true;$('start').hidden=true;$('load').textContent=`${PRESETS[presetIndex].label||PRESETS[presetIndex].id} · ${human.height.toFixed(3)}m`;
 }catch(error){errors.push(error.stack);$('load').textContent='载入失败：'+error.message;$('start').disabled=false;}
 finally{busy=false;controls();}
}
function timingRows(result){
 const element=$('timing');element.replaceChildren();const add=(label,value,strong=false)=>{const l=document.createElement('span'),r=document.createElement(strong?'strong':'span');l.textContent=label;r.textContent=value;element.append(l,r);};
 add('项目','R02 → 分层快版');for(const row of result.summary)add(`${row.kind==='body'?'身体':'格挡'} · ${row.cache==='cold'?'冷':'热'}`,`${row.oracleMs.toFixed(2)} → ${row.fastTotalMs.toFixed(2)}`,true);
 add('冷准备 · 身体 / 格挡',result.summary.filter(r=>r.cache==='cold').map(r=>r.fastPreparationMs.toFixed(2)).join(' / '));add('参考长扫 · 单列',result.fixture.referenceMs.toFixed(1));
}
function showContact(kind=$('contact').value){
 if(!lastResult?.rows)return;clearContact({clearResult:false});$('contact').value=kind;const row=lastResult.rows.find(r=>r.kind===kind&&r.cache==='warm'),hit=row.fast.hit,fixture=lastResult.fixture[kind];
 if(row.fast.unresolved){$('event').textContent='查询未收敛 / 超预算，未生成确认命中。';return;}if(!hit){$('event').textContent='实际表面未相交。';return;}
 const probe=gloves[0];probe.visible=true;probe.position.fromArray(fixture.from.map((v,k)=>v+(fixture.to[k]-v)*hit.toi));gloves[1].visible=kind==='guard';
 marker=new THREE.Mesh(new THREE.SphereGeometry(.006,14,10),new THREE.MeshBasicMaterial({color:0xffe58a,depthTest:false}));marker.position.fromArray(hit.contactPoint);marker.renderOrder=10;scene.add(marker);normalArrow=new THREE.ArrowHelper(new THREE.Vector3(...hit.normal),new THREE.Vector3(...hit.contactPoint),.11,0xffe58a,.023,.014);scene.add(normalArrow);
 $('event').textContent=`实际区域 ${hit.bodyRegion}\nTOI ${hit.toi.toFixed(8)}\n目标 / 拳套三角 ${hit.triangleId} / ${hit.attackerTriangleId}\n接触间距 ${(hit.surfaceSeparation*1000).toFixed(5)} mm\n精确CCD ${row.fast.trianglePairs} 对\n完整结果与R02逐项一致`;render();
}
async function validate(){
 if(!ready||busy)return;busy=true;controls();$('status').className='status';$('status').textContent='对照同一实际表面快照…';await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 try{const result=validateActualFixture({surface,pose,matrixWorld:group.matrixWorld.elements,gloves,presetIndex,poseTime,orientForward:g=>g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1))});lastResult={...result,shapeFingerprint:fingerprint};$('status').className='status '+(result.passed?'pass':'fail');$('status').textContent=result.passed?'4 / 4 完整结果一致 · 身体 / 格挡 · 冷 / 热查询':'存在未完成或不一致结果';timingRows(result);showContact();return lastResult;
 }catch(error){errors.push(error.stack);lastResult={passed:false,error:error.message,mismatch:error.comparison??null};$('status').className='status fail';$('status').textContent='验证未通过：'+error.message;clearContact({clearResult:false});$('event').textContent='未生成确认命中。';throw error;}
 finally{busy=false;controls();}
}
const setPose=time=>{if(!ready||busy)return;poseTime=Number(time);$('pose').value=String(poseTime);updatePose();};
function focusContact(){const kind=$('contact').value,p=lastResult?.rows?.find(r=>r.kind===kind&&r.cache==='warm')?.fast.hit?.contactPoint;if(p){orbit.target.fromArray(p);camera.position.fromArray([p[0]+.70,p[1]+.22,p[2]+.88]);render();}}
const overview=()=>{orbit.target.set(0,human?human.height*.52:.95,0);camera.position.set(2.5,1.9,3.5);render();};
$('start').onclick=()=>build();$('preset').onchange=e=>build(Number(e.target.value));$('pose').onchange=e=>setPose(e.target.value);$('validate').onclick=()=>validate().catch(()=>{});$('contact').onchange=e=>showContact(e.target.value);$('focus').onclick=focusContact;$('reset').onclick=()=>clearContact();$('surface').onchange=()=>{if(wire)wire.visible=$('surface').checked;};
window.fastSurfaceDemo={build,setPreset:build,setPose,validate,clear:clearContact,showContact,focusContact,overview,diagnostics:()=>({ready,busy,presetIndex,poseTime,lastResult,errors,shapeFingerprint:fingerprint,report:human?.report,collisionTriangles:surface?.triangleIds.length,gloveTriangles:gloves.map(g=>g.geometry.index.count/3),cuffVertices:gloves.map(g=>g._cuffVertices.length),source:'Actual R02 human/model/rig plus actual 770-triangle articulated glove geometry; no mock or proxy contact',renderer:renderer.getContext().getParameter(renderer.getContext().RENDERER)})};
