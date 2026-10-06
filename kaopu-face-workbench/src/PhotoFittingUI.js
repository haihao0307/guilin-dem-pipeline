import {prepareFitModel} from './MultiPhotoFit.js';
import {FACE_CORRESPONDENCE as C} from '../vendor/FaceCorrespondence.js';
const MODEL_URL='https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const WASM_URL='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';
const yieldUI=()=>new Promise(r=>setTimeout(r,0));
/** All photo pixels remain in this document. Network traffic fetches public code/weights only. */
export function initPhotoFitting({mount,getModel,getRecords,getSelected,getConfirmed,getPerson,onApply,download}){
 const $=s=>mount.querySelector(s);let detectorPromise=null,run=0,worker=null,busy=false,result=null,frames=[],chosen=new Set(),nextId=0,applied=false,lastTimings=null;
 mount.innerHTML=`<h2>02 / 同人照片拟合 · 实验基线</h2><p class="small"><button class="fit-methods">观察 → 特征/可见性 → 共享身份 → 留出复验</button></p><p class="small">Google MediaPipe 在本机提取特征，GNM 联合求解共享身份。每图独立弱透视相机与表情。仅拟合稀疏特征，不含真实皮肤、遮挡分割或高精度照片重建。</p><p class="small">请选择 1–8 张同人清晰照片/视频取帧，优先正面与小角度斜侧。不能用本功能认人或自动合并人物。第一次会读取公开模型与 WASM，照片不上传。</p><div class="fit-inputs"></div><div class="row"><button class="fit-run">拟合所选照片</button><button class="fit-cancel" disabled>取消</button></div><p class="fit-status small" role="status">尚未运行拟合</p><div class="fit-results"></div><div class="row"><button class="fit-apply" disabled>应用共享身份（中性表情）</button><button class="fit-expression" disabled>查看当前图表情</button><button class="fit-export" disabled>导出拟合报告 JSON</button></div><p class="small">绿点＝检测；粉点＝预先留出的验证点；白圈＝校准特征预测。误差使用最长边不超过1280的处理图像像素。低误差不等于“像本人”，请核对侧面和原始脸。导出报告不含图像。</p>`;
 const methodDialog=document.createElement('dialog');methodDialog.className='methods-dialog';const closeMethods=document.createElement('button');closeMethods.textContent='关闭方法卡，回到当前编辑';closeMethods.onclick=()=>methodDialog.close();methodDialog.append(closeMethods);document.body.append(methodDialog);let methodsLoaded=false;
 $('.fit-methods').onclick=async()=>{methodDialog.showModal();if(methodsLoaded)return;try{const response=await fetch(new URL('METHODS.html',document.baseURI));if(!response.ok)throw Error('方法卡读取失败');const parsed=new DOMParser().parseFromString(await response.text(),'text/html');const main=parsed.querySelector('main');if(!main)throw Error('方法卡格式无效');main.classList.remove('intro');for(const link of main.querySelectorAll('a')){link.target='_blank';link.rel='noopener noreferrer';}for(const node of main.querySelectorAll('script,iframe,object,form'))node.remove();methodDialog.append(main);methodsLoaded=true;}catch(e){const p=document.createElement('p');p.textContent=e.message;methodDialog.append(p);}};
 const canvas=document.createElement('canvas');canvas.id='fitOverlay';canvas.hidden=true;canvas.setAttribute('aria-label','检测特征与拟合预测对照');document.getElementById('reference').append(canvas);
 const say=s=>$('.fit-status').textContent=s;
 const getID=r=>r.fitId||(r.fitId='local-'+(++nextId));
 function clearOverlay(){canvas.hidden=true;canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);}
 function showRecord(){
  clearOverlay();const record=getRecords()[getSelected()],i=result?.images.findIndex(x=>x.id===record?.fitId);$('.fit-expression').disabled=busy||!result||i==null||i<0;
  if(i==null||i<0||!frames[i])return;
  const image=result.images[i],f=frames.find(x=>x.id===image.id);if(!f)return;canvas.width=f.width;canvas.height=f.height;canvas.hidden=false;const ctx=canvas.getContext('2d');
  for(let k=0;k<C.count;k++){
   const p=f.landmarks[C.landmarks[k]],x=p.x*canvas.width,y=p.y*canvas.height;ctx.fillStyle=k%5===0?'#ff72c8':'#82f7c8';ctx.beginPath();ctx.arc(x,y,Math.max(1.4,canvas.width/550),0,Math.PI*2);ctx.fill();
   ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(.7,canvas.width/1200);ctx.beginPath();ctx.arc(image.projected[k*2]*canvas.width,image.projected[k*2+1]*canvas.height,Math.max(2,canvas.width/400),0,Math.PI*2);ctx.stroke();
  }
 }
 function buttons(){const enabled=!!result&&!busy;$('.fit-run').disabled=busy;$('.fit-cancel').disabled=!busy;$('.fit-apply').disabled=!enabled;$('.fit-export').disabled=!enabled;showRecord();}
 function cancel(message='已取消。未应用新拟合结果'){run++;worker?.terminate();worker=null;busy=false;buttons();syncRecords();say(message);}
 function invalidate(message='资料已改变，请重新拟合'){
  cancel(message);result=null;frames=[];applied=false;$('.fit-results').replaceChildren();clearOverlay();buttons();
 }
 function syncRecords(){
  const records=getRecords().filter(r=>r.type!=='video'),alive=new Set(records.map(getID));chosen=new Set([...chosen].filter(id=>alive.has(id)));for(const r of records)if(!r.fitSeen){r.fitSeen=true;if(chosen.size<8)chosen.add(getID(r));}
  const list=$('.fit-inputs');list.replaceChildren();for(const r of records){const label=document.createElement('label');label.className='check small';const input=document.createElement('input');input.type='checkbox';input.checked=chosen.has(getID(r));input.disabled=busy;input.onchange=()=>{if(input.checked&&chosen.size>=8){input.checked=false;say('一次最多 8 张，请先取消其他照片');return;}if(input.checked)chosen.add(getID(r));else chosen.delete(getID(r));invalidate('拟合选择已改变，请重新拟合');};label.append(input,document.createTextNode(r.name));list.append(label);}
 }
 async function verifiedModel(){
  const control=new AbortController(),timer=setTimeout(()=>control.abort(),90000);try{const response=await fetch(MODEL_URL,{signal:control.signal});if(!response.ok)throw Error('特征模型下载 HTTP '+response.status);const bytes=new Uint8Array(await response.arrayBuffer());const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(bytes.length!==3758596||hash!=='64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff')throw Error('MediaPipe 模型校验失败');return bytes;}finally{clearTimeout(timer);}
 }
 async function detector(){
  if(!detectorPromise)detectorPromise=(async()=>{const {FaceLandmarker,FilesetResolver}=await import(new URL('vendor/mediapipe/vision_bundle.mjs',document.baseURI).href);const fileset=await FilesetResolver.forVisionTasks(WASM_URL);return FaceLandmarker.createFromOptions(fileset,{baseOptions:{modelAssetBuffer:await verifiedModel(),delegate:'CPU'},runningMode:'IMAGE',numFaces:2,minFaceDetectionConfidence:.6,minFacePresenceConfidence:.6,outputFaceBlendshapes:false,outputFacialTransformationMatrixes:true});})().catch(e=>{detectorPromise=null;throw e;});
  return detectorPromise;
 }
 async function detectRecord(record,landmarker,isCurrent){
  const decodeStart=performance.now(),image=new Image();let c=null;image.src=record.url;
  try{
   await image.decode();if(!isCurrent())throw Object.assign(Error('拟合已取消'),{name:'AbortError'});
   const decodeMs=performance.now()-decodeStart;if(!image.naturalWidth||!image.naturalHeight)throw Error('图片没有有效尺寸');const scale=Math.min(1,1280/Math.max(image.naturalWidth,image.naturalHeight));c=document.createElement('canvas');c.width=Math.round(image.naturalWidth*scale);c.height=Math.round(image.naturalHeight*scale);const ctx=c.getContext('2d');ctx.drawImage(image,0,0,c.width,c.height);
   if(!isCurrent())throw Object.assign(Error('拟合已取消'),{name:'AbortError'});
   const detectionStart=performance.now(),detected=landmarker.detect(c),detectMs=performance.now()-detectionStart;if(detected.faceLandmarks.length===0)throw Error('没有检测到清晰人脸');if(detected.faceLandmarks.length!==1)throw Error('检测到多张脸，请裁剪为指定人物');const landmarks=detected.faceLandmarks[0].map(({x,y,z})=>({x,y,z}));
   // Reject tiny faces and non-frontal extremes rather than inventing occlusion confidence.
   const width=Math.max(...landmarks.map(x=>x.x))-Math.min(...landmarks.map(x=>x.x));if(width*c.width<100)throw Error('人脸太小，请换较清晰原图');
   const data=detected.facialTransformationMatrixes?.[0]?.data;let yawDegrees=null;if(data){yawDegrees=Math.atan2(data[8],data[10])*180/Math.PI;if(Math.abs(yawDegrees)>40)throw Error('侧转超过约40°，当前稀疏基线不可靠，请另选小角度照片');}
   const inFrame=landmarks.filter(p=>p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1).length;
   if(inFrame<469)throw Error('过多人脸特征超出画面，请换完整人脸照片');
   return {id:getID(record),width:c.width,height:c.height,landmarks,sourceGeometry:{decodedWidth:image.naturalWidth,decodedHeight:image.naturalHeight,processedWidth:c.width,processedHeight:c.height,scaleX:c.width/image.naturalWidth,scaleY:c.height/image.naturalHeight,crop:null,orientation:'browser-decoded EXIF orientation',landmarkCoordinates:'normalized full decoded image'},detectorYawDegrees:yawDegrees,confidence:null,qualityGate:{singleFace:true,faceWidthPixels:width*c.width,inFrameLandmarks:inFrame,totalLandmarks:478,poseDegrees:yawDegrees,checks:'face-count / size / image bounds / approximate yaw',occlusionMask:null,perLandmarkConfidence:null},timings:{decodeMs,detectMs},sourceName:record.name};
  }finally{if(c)c.width=c.height=1;image.removeAttribute('src');}
 }
 function present(){
  const v=result.validation;$('.fit-results').replaceChildren();const summary=document.createElement('p');summary.className='small';summary.textContent=`${result.images.length} 图共享 24 维身份 · 每图 12 维表情 · 95 个点从求解中预先留出。校准特征验证 RMS：原始脸 ${v.baselineHeldOutRmsPx.toFixed(2)} px → 拟合 ${v.heldOutRmsPx.toFixed(2)} px。${v.improvesHeldOut?'验证误差下降；仍需核对像不像':'验证误差未下降，不建议直接采纳'}。`;
  $('.fit-results').append(summary);if(lastTimings){const p=document.createElement('p');p.className='small';p.textContent=`本机实测：检测器载入 ${(lastTimings.detectorLoadMs/1000).toFixed(2)}s；图像解码 ${(lastTimings.images.reduce((s,x)=>s+x.decodeMs,0)/1000).toFixed(2)}s；特征检测 ${(lastTimings.images.reduce((s,x)=>s+x.detectMs,0)/1000).toFixed(2)}s；拟合与留出复验 ${(lastTimings.fitAndValidationMs/1000).toFixed(2)}s。随设备/缓存变化，不是平台速度承诺。`;$('.fit-results').append(p);}if(v.singleImageUnderconstrained){const p=document.createElement('p');p.className='small';p.textContent='只有一张照片：身份、表情、镜头与深度更难区分，无法做留图验证；建议补充独立视角';$('.fit-results').append(p);}
  result.images.forEach(f=>{const p=document.createElement('p');p.className='small';const source=frames.find(x=>x.id===f.id);const cross=v.crossView.find(x=>x.id===f.id);p.textContent=`${source?.sourceName||f.id}：训练 ${f.trainingRmsPx.toFixed(2)} / 留点 ${f.heldOutRmsPx.toFixed(2)} px；真实网格对应点 ${f.baseline.actualMeshHeldOutRmsPx.toFixed(2)} → ${f.actualMeshHeldOutRmsPx.toFixed(2)} px${cross?`；排除此图身份验证 ${cross.heldOutRmsPx.toFixed(2)} px`:''}`;$('.fit-results').append(p);});
  for(const [show,message] of [[v.lowViewDiversity,'视角变化不足约5°，多图可能没有增加足够的三维约束'],[v.poorLandmarkFit,'至少一图留点误差超过脸框对角线5%，请核对遮挡、表情和图像质量']])if(show){const p=document.createElement('p');p.className='small';p.textContent=message;$('.fit-results').append(p);}if(v.clampedIdentity){const p=document.createElement('p');p.textContent='部分身份参数达到边界，结果可能不可靠';$('.fit-results').append(p);}
 }
 $('.fit-run').onclick=async()=>{
  if(busy)return;if(!getModel()){say('请先等原始 GNM 模型载入');return;}if(!getConfirmed()||!getPerson().trim()){say('请先指定人物并确认所有资料属于同一个人');return;}
  const records=getRecords().filter(r=>r.type!=='video'&&chosen.has(getID(r)));if(records.length<1||records.length>8){say('请选 1–8 张同人照片或取帧');return;}
  const token=++run;busy=true;result=null;frames=[];applied=false;$('.fit-results').replaceChildren();buttons();syncRecords();say('正在载入本机特征检测器，照片不会上传…');const started=performance.now(),runTimings={detectorLoadMs:0,images:[],fitAndValidationMs:0,applyMs:null,totalMs:0};lastTimings=runTimings;
  try{
   const detectorStart=performance.now(),landmarker=await detector();if(token!==run)return;runTimings.detectorLoadMs=performance.now()-detectorStart;const failures=[],detected=[];
   for(let i=0;i<records.length;i++){if(token!==run)return;say(`本机提取 ${i+1}/${records.length}：${records[i].name}`);await yieldUI();if(token!==run)return;try{const f=await detectRecord(records[i],landmarker,()=>token===run);if(token!==run)return;detected.push(f);runTimings.images.push({id:f.id,...f.timings});}catch(e){if(token!==run)return;failures.push(records[i].name+'：'+e.message);}}
   if(failures.length)throw Error('以下照片未通过，未拟合任何结果：'+failures.join('；'));
   // Exact duplicate decoded frames cannot masquerade as independent evidence.
   for(let i=0;i<detected.length;i++)for(let j=0;j<i;j++)if(detected[i].width===detected[j].width&&detected[i].height===detected[j].height&&detected[i].landmarks.every((p,k)=>p.x===detected[j].landmarks[k].x&&p.y===detected[j].landmarks[k].y))throw Error('所选资料包含重复图像，请换独立视角');
   frames=detected;say(`已提取 ${frames.length} 图，正在后台联合求解与留出验证…`);await yieldUI();if(token!==run)return;
   const fitStart=performance.now();worker=new Worker(new URL(typeof __FACE_FIT_WORKER__==='string'?__FACE_FIT_WORKER__:'src/fittingWorker.js',document.baseURI),{type:'module'});const fitted=await new Promise((resolve,reject)=>{worker.onmessage=e=>e.data.error?reject(Error(e.data.error)):resolve(e.data.result);worker.onerror=e=>reject(Error(e.message||'拟合线程失败'));worker.postMessage({id:token,model:prepareFitModel(getModel()),frames});});
   if(token!==run)return;worker.terminate();worker=null;runTimings.fitAndValidationMs=performance.now()-fitStart;runTimings.totalMs=performance.now()-started;result={...fitted,timings:runTimings};busy=false;present();buttons();syncRecords();say(`真实计算完成 · ${((performance.now()-started)/1000).toFixed(1)} 秒 · 尚未应用；请选择是否应用并核对本人相似度`);
  }catch(e){if(token!==run)return;worker?.terminate();worker=null;busy=false;result=null;frames=[];buttons();syncRecords();say('未完成拟合：'+e.message);}
 };
 $('.fit-cancel').onclick=()=>cancel();
 $('.fit-apply').onclick=()=>{if(!result||busy)return;const t=performance.now();onApply(result.identity,Array(383).fill(0),'共享身份 · 稀疏拟合待核对');lastTimings.applyMs=performance.now()-t;applied=true;say('已应用共享身份，中性表情。原始 GNM 可随时恢复；这不代表本人相似度已验收');};
 $('.fit-expression').onclick=()=>{const record=getRecords()[getSelected()],f=result?.images.find(x=>x.id===record?.fitId);if(!f||busy)return;const t=performance.now();onApply(result.identity,f.expression,'此图表情 · 稀疏拟合待核对');lastTimings.applyMs=performance.now()-t;applied=true;say('已应用同一共享身份与当前图的独立表情；没有旋转或改写原始头部绑定');};
 $('.fit-export').onclick=()=>{if(result)download('kaopu-face-fit-report.json',JSON.stringify({...result,person:getPerson(),appliedToCurrentSession:applied},null,2),'application/json');};
 return {syncRecords,showRecord,invalidate,cancel,baselineRestored(){applied=false;say('已恢复原始 GNM；拟合报告保留，可比较后重新应用');},diagnostics:()=>({busy,result:result?{schema:result.schema,images:result.images.length,validation:result.validation}:null,applied,timings:lastTimings}),getResult:()=>result};
}
