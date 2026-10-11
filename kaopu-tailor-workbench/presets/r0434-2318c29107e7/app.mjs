import{readBytes}from'./resource-r0434.mjs';
import{smoothSewnNormals}from'./sewn-normals-r0433.mjs';
import{BoundedCache,installGarmentDisplay}from'./display-r0433.mjs';
import{normalizedRequest,validateRequest,requestFromBinding}from'./parameter-request-r0431.mjs';
import{hasSessionVariant,previewKey,sessionStatus,captureNativePreview}from'./variant-preview-r0431.mjs';
import{cardState,matchesQuality,summarizeCards}from'./card-state-r043.mjs';
import{loadCommon}from'./person-core/kaopu-unified-human-workbench/full/ui/load-common.mjs';
import{CommonViewer}from'./person-core/kaopu-unified-human-workbench/full/ui/Viewer.mjs';
import{defaultState}from'./person-core/kaopu-unified-human-workbench/full/src/State.mjs';
import{ALL_PRESETS,createPresetState}from'./person-core/kaopu-unified-human-workbench/full/ui/PresetCatalogueR2.mjs';
import*as THREE from'./person-core/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js';
import{sha,stable,samePerson,requirePerson,modelIdentity,materialHash,facesOf,assertFiniteCoordinates,checkPacket}from'./source-contract.mjs';
import{buildOutfits,verifyOutfitMembers,nativeGarmentMesh,disposeGarment}from'./outfits-r043.mjs';
import{mountParameterEditor}from'./parameters-r043.mjs';
const $=id=>document.getElementById(id),ROOT='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let model,viewer,display,lock,catalogue,identity,current,worker,editor,serial=0,shapeTicket=0,phase='boot',spec=null,record=null,binding=null,cloth=null,latestSolverM=null,cache={rows:{},failed:{}},category='全部',query='',paperDoc=null,ready=false,error=null,workerEvents=[];
let readiness={rows:{},summary:{}},coordinateAudit=0,indexAudit=true,panelColors=false,qualityFilter='all',collection='single',outfits=[],outfitPage=1,outfitProof=null,outfitMeshes=[],currentPackets=[],parameterPending=false,activeRequest=null,pendingPromise=null;
const thumbnailLoadErrors=new Set(),sessions=new Map(),packetCache=new BoundedCache(32),paperCache=new BoundedCache(8),sessionPreviews=new Map();
let selectionController=null,pendingSelectionId=null,failedSelectionId=null;
async function json(u){return JSON.parse(new TextDecoder().decode(await readBytes(u)));}
function message(text,bad=false){$('status').textContent=text;$('status').classList.toggle('error',bad);error=bad?text:null;}
function eligible(){return samePerson(identity,lock?.person);}
function stop(){serial++;selectionController?.abort();selectionController=null;pendingSelectionId=null;worker?.terminate();worker=null;if(pendingPromise){pendingPromise.resolve({cancelled:true});pendingPromise=null;}}
function clearCloth(){if(cloth){viewer.scene.remove(cloth);disposeGarment(cloth);cloth=null;}for(const m of outfitMeshes){viewer.scene.remove(m);disposeGarment(m);}outfitMeshes=[];outfitProof=null;currentPackets=[];latestSolverM=null;spec=record=binding=null;coordinateAudit=0;indexAudit=true;viewer?.render();}
function controls(){if($('retry-selection')){$('retry-selection').hidden=!failedSelectionId;$('retry-selection').disabled=!!pendingSelectionId||!!viewer?.lost;}editor?.lock(!!viewer?.lost||['loading','meshing','solving','auditing','paused','pausing','resuming'].includes(phase));const busy=!!viewer?.lost||['loading','meshing','solving','auditing','pausing','resuming'].includes(phase),single=current&&!current.members;
 $('read-paper').disabled=!ready||busy||!eligible()||!single;$('sew').disabled=!eligible()||!spec||!worker||busy||phase!=='paper'||parameterPending;
 $('pause').disabled=phase!=='solving';$('resume').disabled=phase!=='paused';$('cancel').disabled=!worker;$('person').disabled=!ready||!!viewer?.lost;
 $('person-state').textContent=eligible()?'原共同人物默认状态 · 几何、原生状态与碰撞输入一致':'原系统其他人物 · 没有对应量体 / 碰撞输入，旧衣服不复用';
 $('phase').textContent=({boot:'载入原系统',loading:'正在读取所选服装',idle:'尚未缝合',meshing:'原生参数 / 纸样生成',paper:'真实裁片摆放',solving:'原求解器运行',auditing:'独立材料 / 碰撞检查',done:'原求解结果',failed:'未通过 / 待修复',paused:'计算状态已保存',pausing:'等待求解器暂停确认',resuming:'等待求解器继续确认',blocked:'当前人物尚未接通制衣',outfit:'两件原结果的套系',checkpoint:'中间状态 · 未完成',inactive:'参数当前未生效'})[phase]||phase;
 $('parameter-host').hidden=!single;$('outfit-note').hidden=!current?.members;
 $('variant-state').textContent=parameterPending?'参数已修改：尚未生成 / 缝合；旧结果不代表新参数。':binding?.parameterRequestSHA256?'当前为原制版程序生成的新参数变体，不是原款缓存。':'';
}
function statusOf(id){return sessionStatus(id,sessions,cardState(id,cache,readiness));}
function singleCounts(){const n={all:catalogue.rows.length,'static-pass':0,'needs-repair':0,'no-result':0};for(const r of catalogue.rows){const q=statusOf(r.id);n[q.hasResult?q.kind:'no-result']++;}return n;}
function captureSessionPreview(id){const result=captureNativePreview({viewer,canvas:$('canvas'),key:previewKey(id,sessions),previews:sessionPreviews});if(result.captured)thumbnailLoadErrors.delete(id);else thumbnailLoadErrors.add(id);return result;}
function memberStatus(r){const a=r.members.map(statusOf);return a.every(s=>s.hasResult)?{kind:'needs-repair',label:'两件原结果 · 叠穿待验',hasResult:true,reason:'每件原服装分别求解；尚未进行两件布料的联合碰撞与动态穿着验收。'}:{kind:'solve-aborted',label:'套系成员待完成',hasResult:false,reason:r.members.filter(id=>!statusOf(id).hasResult).join('、')+' 尚无完整求解；保留源款，不补造衣壳。'};}
function updateModes(){for(const b of document.querySelectorAll('[data-collection]'))b.setAttribute('aria-pressed',b.dataset.collection===collection);$('pair-controls').hidden=collection!=='outfits';}
function categories(){const cats=collection==='outfits'?['全部']:['全部',...new Set(catalogue.rows.map(r=>r.category))];if(!cats.includes(category))category='全部';$('categories').innerHTML=cats.map(c=>`<button data-category="${c}" aria-pressed="${c===category}">${c}</button>`).join('');for(const b of $('categories').querySelectorAll('button'))b.onclick=()=>{category=b.dataset.category;categories();cards();};}
function cards(){if(!catalogue)return;
 const isPair=collection==='outfits',all=isPair?outfits:catalogue.rows,counts=isPair?{all:outfits.length,'needs-repair':outfits.filter(r=>memberStatus(r).hasResult).length,'static-pass':0,'no-result':outfits.filter(r=>!memberStatus(r).hasResult).length}:singleCounts();
 const choices=isPair?[['all','全部套系'],['needs-repair','成员有结果'],['no-result','成员待完成']]:[['all','全部'],['static-pass','静态检查通过'],['needs-repair','有结果 / 需修复'],['no-result','无完整结果']];
 $('quality-filters').innerHTML=choices.map(([id,label])=>`<button data-quality="${id}" aria-pressed="${qualityFilter===id}">${label} ${counts[id]??0}</button>`).join('');for(const b of $('quality-filters').querySelectorAll('button'))b.onclick=()=>{qualityFilter=b.dataset.quality;outfitPage=1;cards()};
 let list=all.filter(r=>matchesQuality(isPair?memberStatus(r):statusOf(r.id),qualityFilter)&&(category==='全部'||r.category===category)&&(!query||[r.id,r.name,r.intent,r.style].join(' ').toLowerCase().includes(query)));
 if(!isPair){const rank=id=>statusOf(id).kind==='static-pass'?0:statusOf(id).hasResult?1:2;list.sort((a,b)=>rank(a.id)-rank(b.id));}
 const total=list.length,pages=isPair?Math.max(1,Math.ceil(total/24)):1;outfitPage=Math.min(outfitPage,pages);if(isPair)list=list.slice((outfitPage-1)*24,outfitPage*24);
 $('count').textContent=isPair?`${total} / ${counts.all} 种原款搭配 · 第 ${outfitPage}/${pages} 页 · 未冒称联合物理已通过`:`${total} / ${counts.all} 款 · ${counts['static-pass']} 静态通过 · ${counts['needs-repair']} 有结果需修复 · ${counts['no-result']} 未完成`;
 $('cards').innerHTML=list.map(r=>{const e=cache.rows[r.id]||cache.checkpoints?.[r.id],st=isPair?memberStatus(r):statusOf(r.id),edited=hasSessionVariant(r.id,sessions),fresh=sessionPreviews.get(previewKey(r.id,sessions)),thumb=fresh||(!edited?(isPair?'assets/outfits/'+r.id+'.png':e?.thumbReady!==false&&e?.thumb?'assets/results/'+e.thumb:null):null);return `<button class="card" data-id="${r.id}" data-state="${st.kind}" aria-pressed="${current?.id===r.id}" title="${esc(st.reason)}"><div class="thumb ${st.kind==='static-pass'?'static-pass':''}">${thumb&&(!isPair||st.hasResult)?`<img ${isPair?'loading="lazy"':''} src="${esc(thumb)}" alt="${esc(r.name)}实际三维结果"><span>${esc(st.label)}</span>`:`<div class="pending rejected"><small>${isPair?'原上装 ＋ 原下装':'真实计算状态'}</small><b>${esc(edited?'当前参数变体 · 更新三维预览':st.label)}</b><p>${esc(edited?'正在用这次真实结果更新可见套系；旧图不冒充新效果。':st.reason)}</p><small>点击查看原模型 / 裁片与诊断</small></div>`}</div><strong>${r.id} ${esc(r.name)}</strong><small>${isPair?'独立原生结果 · 同一个人物':r.panelCount+' 裁片 / '+r.seamCount+' 缝边 · '+r.category}</small></button>`}).join('');
 for(const b of $('cards').querySelectorAll('button')){b.onclick=()=>select(b.dataset.id).catch(e=>message(e.message,true));const img=b.querySelector('img');if(img)img.onload=()=>thumbnailLoadErrors.delete(b.dataset.id);if(img)img.onerror=()=>{thumbnailLoadErrors.add(b.dataset.id);b.querySelector('.thumb').innerHTML='<div class="pending"><b>预览图未就绪</b><p>点击可直接检查原三维数据；不会用生成图片替代。</p></div>';};}
 $('pagination').innerHTML=pages>1?`<button id="page-prev" ${outfitPage===1?'disabled':''}>上一页</button><span>${outfitPage} / ${pages}</span><button id="page-next" ${outfitPage===pages?'disabled':''}>下一页</button>`:'';if(pages>1){$('page-prev').onclick=()=>{outfitPage--;cards()};$('page-next').onclick=()=>{outfitPage++;cards()};}
 queueVisibleVariantPreviews();
}
// Actual current-parameter thumbnails, generated lazily for the visible cabinet.
// Never selects another item or alters a material / solver coordinate to capture it.
let variantPreviewQueue=[],variantPreviewBusy=false;
function queueVisibleVariantPreviews(){
 if(!ready||!eligible()||parameterPending||!['idle','done','outfit'].includes(phase))return;
 variantPreviewQueue=Array.from($('cards').querySelectorAll('.card')).map(c=>c.dataset.id).filter(id=>hasSessionVariant(id,sessions)&&!sessionPreviews.has(previewKey(id,sessions)));
 if(!variantPreviewBusy)void processVariantPreviews();
}
function capturePacketPreview(id,packets,key){
 const hidden=[cloth,...outfitMeshes].filter(Boolean).map(m=>[m,m.visible]),meshes=packets.map(p=>nativeGarmentMesh(THREE,p,lock.groundShiftM,{panelColors:false,wire:false}));
 try{for(const[m]of hidden)m.visible=false;for(const m of meshes)viewer.scene.add(m);return captureNativePreview({viewer,canvas:$('canvas'),key,previews:sessionPreviews});}
 finally{for(const m of meshes){viewer.scene.remove(m);disposeGarment(m);}for(const[m,v]of hidden)m.visible=v;viewer.render();}
}
async function processVariantPreviews(){
 variantPreviewBusy=true;
 try{while(variantPreviewQueue.length){
  const id=variantPreviewQueue.shift(),key=previewKey(id,sessions),token=serial;if(sessionPreviews.has(key))continue;
  try{
   const packets=await Promise.all(id.split('-').map(id=>packetFor(id)));if(token!==serial||key!==previewKey(id,sessions)||!eligible()||parameterPending||!['idle','done','outfit'].includes(phase))continue;
   if(packets.some(p=>!p?.record))continue;if(packets.length===2)await verifyOutfitMembers(packets,identity);
   if(token!==serial||key!==previewKey(id,sessions))continue;
   const result=capturePacketPreview(id,packets,key);if(!result.captured)throw Error(result.reason||'真实三维预览未就绪');
   while(sessionPreviews.size>120)sessionPreviews.delete(sessionPreviews.keys().next().value);
   const card=$('cards').querySelector(`.card[data-id="${id}"]`);if(card){const host=card.querySelector('.thumb'),img=document.createElement('img'),label=document.createElement('span'),row=outfits.find(r=>r.id===id)||catalogue.rows.find(r=>r.id===id);img.src=sessionPreviews.get(key);img.alt=row.name+'当前参数的原生三维结果';img.dataset.variantPreview=key;label.textContent=id.includes('-')?memberStatus(row).label:statusOf(id).label;host.replaceChildren(img,label);}
   thumbnailLoadErrors.delete(id);
  }catch(e){if(token===serial&&key===previewKey(id,sessions))thumbnailLoadErrors.add(id);}
  await new Promise(r=>setTimeout(r,12));
 }}finally{variantPreviewBusy=false;}
}

async function sourcePaper(row){if(paperCache.has(row.id))return paperCache.get(row.id);const b=await readBytes('assets/papers/'+row.id+'.json.gz');if(await sha(b)!==row.compressedSHA256)throw Error('原纸样压缩字节改变');const text=await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text();if(await sha(text)!==row.decodedSHA256)throw Error('原纸样内容与来源不同');const result={text,doc:JSON.parse(text)};paperCache.set(row.id,result);return result;}
async function packetFor(id,{session=true,signal}={}){const row=catalogue.rows.find(r=>r.id===id);if(!row)throw Error('原款式不存在 '+id);let d=session?sessions.get(id):null;if(!d)d=packetCache.get(id);if(!d){const c=cache.rows[id];if(!c)return null;const b=await readBytes('assets/results/'+c.file,{signal});if(await sha(b)!==c.sha256)throw Error('结果文件身份不符 '+id);d=await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).json();}
 requirePerson(d.binding.person,identity);if(d.binding.presetId!==id||await materialHash(d.spec)!==d.binding.materialSHA256)throw Error('原生材料身份不符 '+id);
 if(d.binding.parameterRequestSHA256){if(d.binding.basePaperSHA256!==row.decodedSHA256)throw Error('参数变体失去原款身份');await requestFromBinding(d.binding,editor.schema());}else if(d.binding.recipeHash!==row.recipeHash||d.binding.paperSHA256!==row.decodedSHA256)throw Error('原纸样身份不符 '+id);
 if(signal?.aborted)throw signal.reason||new DOMException('Cancelled','AbortError');
 if(!sessions.has(id))packetCache.set(id,d);return d;
}
function provenance(){$('provenance').textContent=JSON.stringify({person:identity,originalPersonMatches:eligible(),source:binding,outfit:outfitProof,parameterState:editor?.state(),sourcePapersImmutable:true,nativeSolverCoordinatesPreserved:true,bodyScaling:false,fullClothPhysicsCertified:false},null,2);}
// Requested and rendered identities are separate until verified data can be committed.
function selectionLabels(row){
 const nextCollection=row.members?'outfits':'single';
 if(collection!==nextCollection){collection=nextCollection;category='全部';qualityFilter='all';query='';$('search').value='';updateModes();categories();}
 if(row.members){$('pair-top').value=row.members[0];$('pair-bottom').value=row.members[1];if(!query&&qualityFilter==='all')outfitPage=Math.floor(outfits.indexOf(row)/24)+1;}
 $('selected-title').textContent=row.id+' · '+row.name;
 $('intent').textContent=row.intent||'原上装与原下装在同一个原人物上的组合。每件保留独立裁片、坐标与质量记录。';
 $('original-paper-link').href=ROOT+'presets/r01/?preset='+(row.members?.[0]||row.id);
 $('original-tailor-link').href=ROOT+'r07/continuation/?case='+(row.style||'Shirt');
 const url=new URL(location.href);url.searchParams.set('preset',row.id);history.replaceState(null,'',url);
}
async function select(id){
 const row=catalogue.rows.find(r=>r.id===id)||outfits.find(r=>r.id===id);
 if(!row)throw Error('未知原款或套系 '+id);
 stop();const token=serial;failedSelectionId=null;
 if(!eligible()){clearCloth();current=row;phase='blocked';selectionLabels(row);cards();controls();message('该原人物没有匹配的量体与碰撞输入，不能复用旧衣服。',true);return state();}
 const controller=new AbortController();selectionController=controller;pendingSelectionId=id;
 phase='loading';controls();message('正在读取 '+id+'；验证完成前保留当前三维结果。');
 let prepared=[],committed=false;
 try{
  const packets=await Promise.all((row.members||[id]).map(id=>packetFor(id,{signal:controller.signal})));
  if(token!==serial)return state();
  let proof=null,checkpoint=null,request=null;
  if(packets.some(p=>!p)){
   const c=!row.members&&cache.checkpoints?.[id];
   if(!c)throw Error(row.members?memberStatus(row).reason:statusOf(id).reason+'；暂无完整三维结果，可读取原纸样重新计算。');
   const buf=await readBytes('assets/results/'+c.file,{signal:controller.signal});
   if(await sha(buf)!==c.sha256)throw Error('中间状态文件身份不符');
   checkpoint=await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
   requirePerson(checkpoint.binding.person,identity);
   if(checkpoint.binding.paperSHA256!==row.decodedSHA256||await materialHash(checkpoint.spec)!==checkpoint.binding.materialSHA256)throw Error('中间状态的原裁片身份不符');
   const p=Float32Array.from(checkpoint.positionsM);assertFiniteCoordinates(checkpoint.spec,p);
   packets[0]={binding:checkpoint.binding,spec:checkpoint.spec,record:{positionsMm:Array.from({length:p.length/3},(_,i)=>Array.from(p.slice(i*3,i*3+3),x=>x*1000))}};
  }
  if(row.members)proof=await verifyOutfitMembers(packets,identity);
  else if(packets[0].binding.parameterRequestSHA256)request=await requestFromBinding(packets[0].binding,editor.schema());
  if(token!==serial)return state();
  // Construct and validate off-scene. A failed request never tears down a good garment.
  for(const p of packets){
   if(!p.record.positionsMm.every(v=>v.length===3&&v.every(Number.isFinite)))throw Error('服装含无效求解坐标');
   assertFiniteCoordinates(p.spec,Float32Array.from(p.record.positionsMm.flat(),x=>x*.001));
   prepared.push(nativeGarmentMesh(THREE,p,lock.groundShiftM,{panelColors,wire:$('wire').checked}));
  }
  clearCloth();current=row;parameterPending=false;activeRequest=request;paperDoc=null;error=null;editor?.invalidate();
  if(row.members){outfitMeshes=prepared;outfitProof=proof;currentPackets=packets;outfitMeshes.forEach(m=>viewer.scene.add(m));phase='outfit';}
  else{const d=packets[0];spec=d.spec;binding=d.binding;record=checkpoint?null:d.record;currentPackets=checkpoint?[]:packets;cloth=prepared[0];viewer.scene.add(cloth);if(checkpoint)draw(Float32Array.from(checkpoint.positionsM));else drawRecord(record);phase=checkpoint?'checkpoint':'done';}
  prepared=[];committed=true;pendingSelectionId=null;selectionController=null;
  selectionLabels(row);display?.frame();cards();controls();provenance();viewer.render();
  if(request){await editor.restoreRequest(request);if(token!==serial)return state();}
  if(hasSessionVariant(row.id,sessions)){captureSessionPreview(row.id);cards();}
  message(row.members?'两件原生结果已显示；套系联合碰撞与动态穿着仍待验收。':checkpoint?'当前为未完成的真实中间状态：'+(checkpoint.reason||'待继续计算'):qualityText(record),!!checkpoint||!row.members&&!record?.staticGate?.passed);
 }catch(e){
  if(token!==serial)return state();
  if(committed){message('原服装已显示；参数面板恢复失败：'+e.message,true);}
  else{failedSelectionId=id;phase=outfitMeshes.length?'outfit':cloth?(record?'done':'checkpoint'):'failed';message('未能载入 '+id+'：'+e.message+(current?'。当前仍显示 '+current.id+'，不是请求的新款。':'。')+' 可点击重试。',true);}
 }finally{
  for(const m of prepared)disposeGarment(m);
  if(token===serial){pendingSelectionId=null;selectionController=null;controls();provenance();}
 }
 return state();
}
function draw(positionsM){if(!spec)return;assertFiniteCoordinates(spec,positionsM);if(!cloth){const fakeRecord={positionsMm:Array.from({length:positionsM.length/3},(_,i)=>Array.from(positionsM.slice(i*3,i*3+3),x=>x*1000))};cloth=nativeGarmentMesh(THREE,{binding,spec,record:fakeRecord},lock.groundShiftM,{panelColors,wire:$('wire').checked});cloth.name='original-native-material-and-solver-output';viewer.scene.add(cloth);}
 latestSolverM=Float32Array.from(positionsM);const attr=cloth.geometry.attributes.position;for(let i=0;i<positionsM.length;i++)attr.array[i]=positionsM[i]-(i%3===1?lock.groundShiftM:0);attr.needsUpdate=true;cloth.geometry.computeVertexNormals();cloth.userData.sewnNormalAudit=smoothSewnNormals(cloth.geometry,spec,record?.activeSeams);cloth.geometry.computeBoundingSphere();const a=auditDisplay();coordinateAudit=a.error;indexAudit=a.indices;viewer.render();}
function drawRecord(r){const p=new Float32Array(r.positionsMm.length*3);r.positionsMm.forEach((v,i)=>p.set(v.map(x=>x*.001),i*3));draw(p);}
function qualityText(r){return r.staticGate?.passed?'原静态数值门槛通过；尚未做完整面料标定或动态穿着认证。':'原求解已得到三维结果，仍需修复：'+(r.staticGate?.failures?.join('、')||'没有完整质量记录');}
async function loadPaper(request=null){requirePerson(identity,lock.person);if(current.members)throw Error('先选套系中的单件原服装再调参。');if(request!==null){const q=validateRequest(editor.schema(),request);request=Object.keys(q.parameters).length||q.easeCm||q.waistEaseCm?q:null;}if(request===null)editor?.synchronize({});stop();clearCloth();phase='meshing';parameterPending=false;error=null;activeRequest=request;controls();message(request?'从原款重新调用原制版程序生成参数变体。':'读取真实原纸样，进行原生材料网格化。');const row=current,token=serial;
 const completion=new Promise((resolve,reject)=>pendingPromise={resolve,reject,token});
 try{const{doc,text}=await sourcePaper(row);if(token!==serial)return {cancelled:true};paperDoc=doc;worker=new Worker(new URL('native/kaopu-tailor-workbench/catalogue/native-adapter.mjs',import.meta.url),{type:'module'});
 const failure=e=>{if(token!==serial)return;phase='failed';message(e,true);editor?.feedback(e);controls();if(pendingPromise?.token===token){pendingPromise.resolve({error:e});pendingPromise=null;}};
 worker.onerror=e=>failure(e.message||'原工作线程失败');
 worker.onmessage=async({data})=>{if(token!==serial||data.requestId!==token&&data.type!=='ready')return;workerEvents.push(data.type);if(workerEvents.length>150)workerEvents.shift();try{
  if(data.type==='ready'){worker.postMessage({type:request?'generate-native-variant':'load-native-paper',requestId:token,presetId:row.id,person:identity,paperText:text,...(request?{parameters:request.changedParameters||request.parameters||{},easeCm:request.easeCm||0,waistEaseCm:request.waistEaseCm||0}:{})});}
  else if(data.type==='runtime'){message('原制版运行时：'+(data.message||data.stage||data.label||'正在计算真实裁片'));}
  else if(data.type==='paper'){requirePerson(data.binding.person,identity);if(data.binding.presetId!==row.id||await materialHash(data.spec)!==data.binding.materialSHA256)throw Error('原生材料来源不符');
   if(request){const expected=await sha(stable({parameters:request.changedParameters||request.parameters||{},easeCm:request.easeCm||0,waistEaseCm:request.waistEaseCm||0}));if(data.binding.basePaperSHA256!==row.decodedSHA256||data.binding.parameterRequestSHA256!==expected||!data.geometryChanged)throw Error('新参数没有对应的真实制版证据');}
   else if(data.binding.recipeHash!==row.recipeHash||data.binding.paperSHA256!==row.decodedSHA256)throw Error('原纸样身份被改变');
   if(token!==serial)return;spec=data.spec;binding=data.binding;paperDoc=data.analytic||doc;draw(data.positionsM);phase=data.canSew?'paper':'failed';message(data.canSew?(request?'参数已改变真实裁片；当前是新摆片，点击缝合生成本次成衣。':'原始裁片已网格化；当前摆片不是已完成成衣。'):data.fitPreflight?.message||'材料预检未通过',!data.canSew);editor?.feedback(request?'已验证真实裁片变化，旧成衣不复用。':'原纸样读取完成。');controls();provenance();if(pendingPromise?.token===token){pendingPromise.resolve({canSew:data.canSew,geometryChanged:!!data.geometryChanged,binding});pendingPromise=null;}}
  else if(['started','progress','stage','paused','auditing','checkpoint'].includes(data.type)){checkPacket(data,binding);draw(data.positionsM);phase=data.type==='paused'?'paused':data.type==='auditing'?'auditing':data.type==='checkpoint'?'checkpoint':'solving';$('progress').value=Math.min(1,data.progress||0);message(data.budgetCheckpoint?'计算片段到达预算，当前原材料和求解状态已保存。点击继续从此工序接着算。':data.type==='checkpoint'?'显示真实中间状态；未完成，不能判为成衣。':'原求解工序：'+data.stage+' · '+Math.round((data.progress||0)*100)+'%');controls();}
  else if(data.type==='done'){checkPacket(data,binding);record=data.record;requirePerson(record.nativeBinding?.person,identity);drawRecord(record);phase='done';display?.frame();$('progress').value=1;const d={binding:structuredClone(binding),spec:structuredClone(spec),record:structuredClone(record)};sessions.set(row.id,d);currentPackets=[d];captureSessionPreview(row.id);cards();parameterPending=false;message(qualityText(record),!record.staticGate?.passed);controls();provenance();}
  else if(data.type==='parameter-inactive'){phase='inactive';const msg=data.message||'该参数未在当前构成条件下改变裁片。';message(msg,true);editor?.feedback(msg);controls();if(pendingPromise?.token===token){pendingPromise.resolve({geometryChanged:false,message:msg});pendingPromise=null;}}
  else if(data.type==='error')failure('原求解器：'+data.message+'；中间状态未认定为成衣。');
 }catch(e){if(token!==serial)return;failure(e.message);stop();clearCloth();controls();}};
 worker.postMessage({type:'boot',root:ROOT,patternBase:ROOT+'garment-pattern-catalogue-r01/browser/'});
 }catch(e){if(token!==serial)return {cancelled:true};phase='failed';message(e.message,true);controls();if(pendingPromise?.token===token){pendingPromise.resolve({error:e.message});pendingPromise=null;}}
 return completion;
}
function sew(){requirePerson(identity,lock.person);if(!worker||!spec||phase!=='paper'||parameterPending)throw Error('必须先生成与当前参数一致的原生纸样。');phase='solving';error=null;$('progress').value=0;controls();worker.postMessage({type:'run',requestId:serial,person:identity});}
async function changePerson(id){const t=++shapeTicket;stop();clearCloth();sessions.clear();sessionPreviews.clear();parameterPending=false;editor?.invalidate();identity=null;phase='blocked';controls();model.compute(id==='default'?defaultState():createPresetState(id,defaultState));viewer.update();display.frame('three');const next=await modelIdentity(model);if(t!==shapeTicket)return;identity=next;$('person').value=id;phase=eligible()?'idle':'blocked';message(eligible()?'已恢复原共同人物默认状态。':'已切换原人物；没有新量体 / 碰撞输入，不复用旧衣服。');controls();provenance();}
function auditDisplay(){if(outfitMeshes.length){let error=0,indices=true;outfitMeshes.forEach((m,j)=>{const d=currentPackets[j],p=m.geometry.attributes.position.array;for(let i=0;i<p.length;i++){const v=Math.fround(d.record.positionsMm[Math.floor(i/3)][i%3]*.001);error=Math.max(error,Math.abs(p[i]-Math.fround(v-(i%3===1?lock.groundShiftM:0))));}indices=indices&&stable(Array.from(m.geometry.index.array))===stable(facesOf(d.spec));});return{error,indices,members:outfitMeshes.length};}
 let error=0;if(!cloth||!latestSolverM)return{error,indices:true};const p=cloth.geometry.attributes.position.array;for(let i=0;i<p.length;i++)error=Math.max(error,Math.abs(p[i]-Math.fround(latestSolverM[i]-(i%3===1?lock.groundShiftM:0))));return{error,indices:stable(Array.from(cloth.geometry.index.array))===stable(facesOf(spec))};}
function state(){const audit=auditDisplay();return{version:'R04-SOURCE-5.3',sewnNormalAudits:[cloth,...outfitMeshes].filter(Boolean).map(m=>m.userData.sewnNormalAudit),release:'R04.3.4',pendingSelectionId,failedSelectionId,personRuntimeCommit:'537c0f619fb9391c6a1e72ee29d2f889b5d1782f',display:display?.audit(),packetCacheSize:packetCache.size,paperCacheSize:paperCache.size,variantPreviewQueueLength:variantPreviewQueue.length,variantPreviewRendering:variantPreviewBusy,ready:ready&&!viewer?.lost,phase,error,selectedId:current?.id,person:identity,supportedPerson:eligible(),commonVertexCount:model?.vertexCount,commonTriangleCount:model?.faces.length/3,clothVertices:cloth?.geometry.attributes.position.count||outfitMeshes.reduce((n,m)=>n+m.geometry.attributes.position.count,0),clothTriangles:cloth?cloth.geometry.index.count/3:outfitMeshes.reduce((n,m)=>n+m.geometry.index.count/3,0),renderCoordinateErrorM:audit.error,clothIndexMatchesNative:audit.indices,binding,staticGate:record?.staticGate||null,outfit:outfitProof,outfitCount:outfits.length,collection,parameterEditor:editor?.state(),parameterPending,canvasCount:document.querySelectorAll('canvas').length,sourcePresets:catalogue?.rows.length||0,workerEvents:[...workerEvents],standaloneMannequin:false,bodyScaling:false,proxyGarment:false,clothComputedForOtherPerson:false,qualityFilter,thumbnailLoadErrors:[...thumbnailLoadErrors],actualResultCount:catalogue?catalogue.rows.filter(r=>statusOf(r.id).hasResult).length:0,nativeMaterialCount:readiness.summary.nativeMaterialsReady,staticPassCount:catalogue?singleCounts()['static-pass']:0,baselineStaticPassCount:Object.values(cache.rows).filter(r=>r.qualityPassed).length,sessionVariantCount:[...sessions.values()].filter(p=>p.binding?.parameterRequestSHA256).length,all60GarmentsAccepted:false};}
function appearance(){for(const m of[cloth,...outfitMeshes].filter(Boolean)){m.material.forEach((v,i)=>{v.color.set(panelColors?[0xbbab8b,0x9ab5ac,0xc4a4a4,0xa1a8c6][i%4]:0xc6b591);v.wireframe=$('wire').checked;});}viewer.render();}
async function boot(){try{[lock,catalogue,cache,readiness]=await Promise.all([json('assets/identity.json'),json('assets/catalogue.json'),json('assets/results/index.json'),json('assets/readiness.json')]);outfits=buildOutfits(catalogue.rows);message('正在载入并验证原共同人物。');const loaded=await loadCommon({onProgress:p=>message('原共同人物资源校验 '+Math.round(p.fraction*100)+'%')});model=loaded.model;model.compute(defaultState());identity=await modelIdentity(model);requirePerson(identity,lock.person);viewer=new CommonViewer({canvas:$('canvas'),container:$('stage'),model,onStatus:message});
 display=installGarmentDisplay(THREE,viewer,{meshes:()=>viewer.scene.children.filter(m=>m.userData?.binding?.presetId),onGraphics:ok=>{controls();message(ok?'三维显示已恢复；原人物与原服装数据保留。':'显卡上下文暂不可用，已保留原服装；等待浏览器恢复或刷新本页。',!ok)}});
 for(const b of document.querySelectorAll('[data-focus]'))b.onclick=()=>{for(const e of document.querySelectorAll('[data-focus]'))e.setAttribute('aria-pressed',e===b);display.focus(b.dataset.focus)};
 $('person').innerHTML='<option value="default">原共同人物 · 默认制衣输入</option>'+ALL_PRESETS.map(p=>`<option value="${p.id}">${esc(p.label)}${p.collection==='r01'?' · 原版':''}</option>`).join('');$('person').onchange=()=>changePerson($('person').value).catch(e=>message(e.message,true));$('read-paper').onclick=()=>loadPaper().catch(e=>message(e.message,true));$('sew').onclick=()=>{try{sew()}catch(e){message(e.message,true)}};$('pause').onclick=()=>{if(phase!=='solving'||!worker)return;phase='pausing';controls();worker.postMessage({type:'pause',requestId:serial});};$('resume').onclick=()=>{if(phase!=='paused'||!worker)return;phase='resuming';controls();worker.postMessage({type:'resume',requestId:serial});};$('cancel').onclick=()=>{stop();clearCloth();phase='idle';controls();message('已取消本次求解；旧中间状态不复用。');};for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>display.frame(b.dataset.view);$('wire').onchange=appearance;$('panel-colors').onclick=()=>{panelColors=!panelColors;$('panel-colors').setAttribute('aria-pressed',panelColors);appearance()};$('search').oninput=()=>{query=$('search').value.trim().toLowerCase();outfitPage=1;cards()};
 for(const b of document.querySelectorAll('[data-collection]'))b.onclick=()=>{collection=b.dataset.collection;qualityFilter='all';outfitPage=1;category='全部';updateModes();categories();cards()};for(const[t,cat]of[['top',['上装']],['bottom',['裤装','半裙']]])$('pair-'+t).innerHTML=catalogue.rows.filter(r=>cat.includes(r.category)).map(r=>`<option value="${r.id}">${r.id} ${esc(r.name)}</option>`).join('');$('pair-show').onclick=()=>select($('pair-top').value+'-'+$('pair-bottom').value).catch(e=>message(e.message,true));$('edit-top').onclick=()=>current?.members&&select(current.members[0]);$('edit-bottom').onclick=()=>current?.members&&select(current.members[1]);
 editor=await mountParameterEditor($('parameter-host'),{readCurrentPaper:async()=>{if(!current||current.members)throw Error('先选择单件原款式。');return(await sourcePaper(current)).doc},apply:request=>{const q=normalizedRequest(request);return loadPaper(Object.keys(q.parameters).length||q.easeCm||q.waistEaseCm?request:null);},onState:s=>{const q={parameters:s.changedParameters||{},easeCm:s.easeCm??0,waistEaseCm:s.waistEaseCm??0},a=activeRequest?{parameters:activeRequest.changedParameters||activeRequest.parameters||{},easeCm:activeRequest.easeCm||0,waistEaseCm:activeRequest.waistEaseCm||0}:null;parameterPending=!Number.isFinite(q.easeCm)||!Number.isFinite(q.waistEaseCm)||(a?stable(q)!==stable(a):Object.keys(q.parameters).length>0||q.easeCm>0||q.waistEaseCm>0);controls();}});
 $('retry-selection').onclick=()=>failedSelectionId&&select(failedSelectionId).catch(e=>message(e.message,true));
 ready=true;categories();updateModes();const wanted=new URL(location.href).searchParams.get('preset');await select(catalogue.rows.some(r=>r.id===wanted)||outfits.some(r=>r.id===wanted)?wanted:'S02');
 window.__R04={state,auditDisplay,select,loadPaper,sew,changePerson,view:n=>display.frame(n),focus:n=>display.focus(n),thumbnail:()=>display.thumbnail(),displayAudit:()=>display.audit(),pixelAudit:()=>viewer.pixelAudit(),loseContext:()=>viewer.renderer.forceContextLoss(),restoreContext:()=>viewer.renderer.forceContextRestore(),nativeArrays:()=>({positions:Array.from(model.positions),faces:Array.from(model.faces),state:model.state}),packet:()=>record?{binding:structuredClone(binding),spec:structuredClone(spec),record:structuredClone(record)}:null,packets:()=>structuredClone(currentPackets),materialPacket:()=>spec?{binding:structuredClone(binding),spec:structuredClone(spec),positionsM:latestSolverM?Array.from(latestSolverM):null}:null,canvasPNG:()=>{viewer.render();return $('canvas').toDataURL('image/png')},sourcePaper:()=>paperDoc,parameterSchema:()=>editor.schema(),parameterState:()=>editor.state(),setParameters:(p,e=0,w=0)=>editor.set(p,e,w),generateParameters:()=>editor.generate(),outfits:()=>structuredClone(outfits),setCollection:c=>{collection=c;qualityFilter='all';updateModes();categories();cards()},captureOutfit:async id=>{await select(id);return{state:state(),png:display.thumbnail()}}};controls();
 }catch(e){phase='failed';message('原系统连接失败：'+e.message+'；不会改用替代模型或衣壳。',true);console.error(e);if($('person-state'))controls();}}
addEventListener('pagehide',e=>{if(e.persisted)return;stop();display?.dispose();viewer?.dispose()});boot();
