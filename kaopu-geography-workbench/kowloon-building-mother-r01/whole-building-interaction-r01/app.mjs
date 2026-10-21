import * as Tower from './tower.mjs';
import {WholeRenderer} from './renderer.mjs';
import {attachCameraControls} from './camera-controls.mjs';
import {deriveMeasuredCase} from '../r07/cases.mjs';
import {profileFor} from '../r07/profiles.mjs';
const $=id=>document.getElementById(id);let measured,official,model,renderer,liftState,view='whole',config={towerFloorCount:24,podiumFloorCount:4};
let pending=null,drainPromise=null,activeWidth=0,settleTimer=null,playing=false,lastTick=0,requestCount=0;
const state={ready:false,errors:[],frames:[],cancellations:[],playing:false};window.wholeBuilding=state;
const clone=x=>structuredClone(x);
function status(text,error=false){$('status').textContent=text;$('status').className=error?'error':'';}
function selected(){return model.levels.find(f=>f.id===$('floor').value)??model.levels[0];}
function motionWidth(){return view==='whole'?128:192;}
function cameraForBounds(b,scale=1){const c=b.min.map((x,i)=>(x+b.max[i])/2),s=Math.max(...b.max.map((x,i)=>x-b.min[i]));return{target:c,eye:[c[0]+s*.92*scale,c[1]+s*.55*scale,c[2]-s*1.12*scale]};}
function setCamera(){const y=selected().localY;if(view==='source'){Object.assign(renderer.options,cameraForBounds(measured.bounds));renderer.options.cut=false;}else if(view==='whole'){Object.assign(renderer.options,cameraForBounds(model.bounds,.96));renderer.options.cut=$('cut').checked;}else if(view==='levels'){Object.assign(renderer.options,{target:[0,y+1.7,0],eye:[27,y+18,-31]});renderer.options.cut=$('cut').checked;}else{Object.assign(renderer.options,{target:[0,y+1.5,-3.2],eye:[7,y+2.1,-12.2]});renderer.options.cut=true;}}
function visibleFloors(){if(view==='whole'||view==='source')return null;const i=model.levels.indexOf(selected());return model.levels.slice(Math.max(0,i-1),Math.min(model.levels.length,i+2)).map(f=>f.id);}
function graph(){state.model=model;state.view=view;state.config=config;$('graphSummary').textContent=`${model.levels.length}个设计楼层 · ${model.graph.nodes.length}个归属对象 · ${model.graph.edges.length}条关系；隐藏不删楼层和服务站。`;$('caption').textContent=view==='source'?'原塔楼完整函数表面，未添加实测细节。':`${view==='whole'?'裙房与塔楼整栋设计关系':selected().id+'与相邻层'} · 拖动旋转 / 滚轮缩放 / Shift或右键拖动平移`;
 $('play').textContent=playing?'暂停电梯播放':'播放电梯到目标层';state.playing=playing;}
function showLift(){state.liftState=liftState;$('liftState').textContent=`1号梯 ${liftState.phase} · 局部高度${liftState.currentElevation.toFixed(2)}m · 目标${liftState.targetFloorId} · 当前层门${liftState.doorOpen?'打开':'锁闭'}。`;$('play').textContent=playing?'暂停电梯播放':'播放电梯到目标层';state.playing=playing;}
function syncLift(){const v=Tower.liftVisuals(model,liftState);renderer.setModel({...model,archetypes:[...model.archetypes,...v.archetypes],instances:[...model.instances,...v.instances]},measured);state.dynamicLiftVisuals=v;}
function scheduleClear(){clearTimeout(settleTimer);if(!playing)settleTimer=setTimeout(()=>requestFrame(640).catch(()=>{}),400);}
function cancelHigh(){clearTimeout(settleTimer);if(drainPromise&&activeWidth>motionWidth())renderer.requestRevision++;}
function requestFrame(width=640){
 pending={width,camera:clone(renderer.options),view,visible:visibleFloors(),number:++requestCount};
 if(drainPromise&&activeWidth>motionWidth()&&width<activeWidth)renderer.requestRevision++;
 if(!drainPromise)drainPromise=(async()=>{while(pending){const q=pending;pending=null;activeWidth=q.width;renderer.options=clone(q.camera);const revision=++renderer.requestRevision;status(q.width<640?'交互中：正在按当前相机重算3D函数场…':'停稳清晰重绘中，可随时拖动中止剩余块…');
  const stats=await renderer.render({width:q.width,height:Math.round(q.width*.85),presentWidth:640,presentHeight:544,tileSize:128,visibleFloorIds:q.visible,source:q.view!=='circulation',design:q.view!=='source',coreOnly:q.view==='circulation',requestRevision:revision});
  if(stats.cancelled){state.cancellations.push(stats);if(state.cancellations.length>30)state.cancellations.shift();continue;}
  state.lastStats=stats;state.frames.push({...stats,intent:q.number,liftState:clone(liftState)});if(state.frames.length>120)state.frames.shift();state.presentedFrames=(state.presentedFrames??0)+1;
  $('performance').textContent=`实际求交 ${stats.width}×${stats.height}px → 显示640×544px\n${stats.wallMs.toFixed(0)}ms / ${stats.tilesCompleted}块 / ${stats.passes}次射线派发\n最大块等待${stats.maxTileWallMs.toFixed(0)}ms · 完成帧${state.presentedFrames}\n${renderer.gpu}`;
  status(stats.width<640?'当前为移动采样；停稳自动回640px，不改变物体形体。':'当前相机640px完整帧已完成。不是预制图片，也不保证60fps。');graph();
  if(playing){const now=performance.now(),dt=Math.min(2,Math.max(.001,(now-lastTick)/1000));lastTick=now;liftState=Tower.advanceLift(model,liftState,dt);if(liftState.arrived)playing=false;syncLift();showLift();pending={width:playing?motionWidth():640,camera:clone(renderer.options),view,visible:visibleFloors(),number:++requestCount};}
 }})().catch(e=>{state.errors.push(String(e.stack??e));state.error=e.message;playing=false;status('函数场渲染未完成：'+e.message,true);showLift();throw e;}).finally(()=>{drainPromise=null;activeWidth=0;});
 return drainPromise;
}
async function idle(){clearTimeout(settleTimer);playing=false;state.playing=false;pending=null;if(drainPromise){renderer.requestRevision++;await drainPromise;}showLift();}
async function rebuild(next=config,{preview=false}={}){if(renderer&&model)await idle();const derived=Tower.deriveWholeBuilding(measured,official,next);model=derived;config={...next};liftState=Tower.createLiftState(model);syncLift();const old=$('floor').value;$('floor').replaceChildren(...model.levels.map(l=>{const o=document.createElement('option');o.value=l.id;o.textContent=l.label??l.id;return o;}));$('floor').value=model.levels.some(l=>l.id===old)?old:model.levels[Math.min(6,model.levels.length-1)].id;$('floorHeight').value=model.config.towerFloorHeight;$('floorCount').value=model.config.towerFloorCount;showLift();setCamera();graph();await requestFrame(preview?motionWidth():640);if(preview)scheduleClear();return model;}
function route(mode='stairs'){const r=Tower.routeWholeBuilding(model,selected().id,{mode,liftId:model.interfaces.lifts[0].id});state.lastRoute=r;$('route').textContent=mode==='stairs'?`裙房设计入口 → ${r.fromFloorId} → ${r.targetFloorId}；${r.segments.filter(s=>s.kind==='stairs').length}段实体楼梯与平台。`:`入口等待 → 1号梯 → ${r.targetFloorId}；仅到站开门才接通。`;return r;}
async function play(target=$('floor').value){await idle();liftState=Tower.targetLift(model,liftState,target);playing=!liftState.arrived;lastTick=performance.now();syncLift();showLift();route('lift');return requestFrame(motionWidth());}
async function changeView(v,{clear=true}={}){await idle();view=v;setCamera();graph();await requestFrame(clear?640:motionWidth());if(!clear)scheduleClear();}
async function boot(){const profile=profileFor('kcc'),url=new URL(profile.scoreUrl,new URL('../r07/profiles.mjs',import.meta.url)),r=await fetch(url);if(!r.ok)throw Error('Original source unavailable');const text=await r.text(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==profile.scoreSha256)throw Error('Original source hash mismatch');measured=deriveMeasuredCase(JSON.parse(text));official=await(await fetch(new URL('../r07/sources/official-footprints.json',import.meta.url))).json();renderer=new WholeRenderer($('view'));state.renderer=renderer;state.measured=measured;state.sourceHash=hash;
 await rebuild(config,{preview:true});state.ready=true;
 state.controls=attachCameraControls($('view'),{getCamera:()=>clone(renderer.options),setCamera:c=>Object.assign(renderer.options,c),onStart:()=>cancelHigh(),onChange:()=>{requestFrame(motionWidth()).catch(()=>{});},onEnd:()=>scheduleClear()});
}
$('regenerate').onclick=()=>rebuild({towerFloorCount:Number($('floorCount').value),podiumFloorCount:4,towerFloorHeight:Number($('floorHeight').value)}).catch(e=>$('validation').textContent=e.message);
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>changeView(b.dataset.view,{clear:false}).catch(()=>{});
$('floor').onchange=async()=>{await idle();setCamera();await requestFrame(motionWidth());scheduleClear();};$('cut').onchange=()=>{cancelHigh();setCamera();requestFrame(motionWidth()).then(scheduleClear).catch(()=>{});};$('clear').onclick=()=>requestFrame(640).catch(()=>{});$('resetCamera').onclick=()=>{cancelHigh();setCamera();requestFrame(motionWidth()).then(scheduleClear).catch(()=>{});};$('stairs').onclick=()=>route();
$('lift').onclick=async()=>{await idle();liftState=Tower.targetLift(model,liftState,selected().id);syncLift();showLift();route('lift');await requestFrame(motionWidth());scheduleClear();};$('play').onclick=()=>{if(playing){playing=false;showLift();scheduleClear();}else play().catch(()=>{});};$('step').onclick=async()=>{await idle();liftState=Tower.advanceLift(model,liftState,1);syncLift();showLift();await requestFrame(motionWidth());scheduleClear();};
Object.assign(state,{setView:v=>changeView(v),setFloor:async id=>{await idle();$('floor').value=id;setCamera();return requestFrame(640);},rebuild,route,render:requestFrame,pause:idle,play,getModel:()=>model,getLiftState:()=>liftState,getCamera:()=>clone(renderer.options),setCamera:async c=>{await idle();Object.assign(renderer.options,c);return requestFrame(640);},advance:async(seconds,target)=>{await idle();if(target)liftState=Tower.targetLift(model,liftState,target);liftState=Tower.advanceLift(model,liftState,seconds);syncLift();showLift();await requestFrame(640);return liftState;}});
boot().catch(e=>{state.errors.push(String(e.stack??e));state.error=e.message;status('初始化未完成：'+e.message,true);});
