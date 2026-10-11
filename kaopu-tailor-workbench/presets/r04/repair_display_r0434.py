"""Apply a reviewed patch to exact inherited source; never alter material or solver records."""
from pathlib import Path
import hashlib,json
P=Path(__file__).resolve().parent
EXPECTED={'app.mjs':'67d6b43dadc31bc96100243b3129a5c071a90a1b8cb02145737c84052d1c714e','style.css':'a530c151926b595f103e808ff2d4b8c1a2ae3b0112f36131c739373ebf0f3121','index.html':'6f14ec91dc07d8215552fcc945afd6368c854b2dbfff27fbf8e2ff5c6e0706aa'}
texts={n:(P/n).read_text() for n in EXPECTED}
for n,h in EXPECTED.items():
 assert hashlib.sha256((P/n).read_bytes()).hexdigest()==h,('Unexpected source; no overwrite',n)
def edit(n,a,b):
 assert texts[n].count(a)==1,(n,a[:100],texts[n].count(a))
 texts[n]=texts[n].replace(a,b)
edit('app.mjs',"import{smoothSewnNormals}","import{readBytes}from'./resource-r0434.mjs';\nimport{smoothSewnNormals}")
edit('app.mjs',"async function json(u){const r=await fetch(u);if(!r.ok)throw Error('资源读取失败 '+r.status+' '+u);return r.json();}","let selectionController=null,pendingSelectionId=null,failedSelectionId=null;\nasync function json(u){return JSON.parse(new TextDecoder().decode(await readBytes(u)));}")
edit('app.mjs',"function stop(){serial++;", "function stop(){serial++;selectionController?.abort();selectionController=null;pendingSelectionId=null;")
edit('app.mjs',"function controls(){editor?.lock", "function controls(){if($('retry-selection')){$('retry-selection').hidden=!failedSelectionId;$('retry-selection').disabled=!!pendingSelectionId||!!viewer?.lost;}editor?.lock")
edit('app.mjs',"const r=await fetch('assets/papers/'+row.id+'.json.gz');if(!r.ok)throw Error('原纸样不存在');const b=await r.arrayBuffer();", "const b=await readBytes('assets/papers/'+row.id+'.json.gz');")
edit('app.mjs',"async function packetFor(id,{session=true}={})", "async function packetFor(id,{session=true,signal}={})")
edit('app.mjs',"const r=await fetch('assets/results/'+c.file);if(!r.ok)throw Error('真实结果读取失败 '+id);const b=await r.arrayBuffer();", "const b=await readBytes('assets/results/'+c.file,{signal});")
edit('app.mjs',".pipeThrough(new DecompressionStream('gzip'))).json();packetCache.set(id,d);}", ".pipeThrough(new DecompressionStream('gzip'))).json();}")
edit('app.mjs'," return d;\n}\nfunction provenance", " if(signal?.aborted)throw signal.reason||new DOMException('Cancelled','AbortError');\n if(!sessions.has(id))packetCache.set(id,d);return d;\n}\nfunction provenance")
start=texts['app.mjs'].index('async function select(id)')
end=texts['app.mjs'].index('function draw(positionsM)',start)
texts['app.mjs']=texts['app.mjs'][:start]+'''// Requested and rendered identities are separate until verified data can be committed.
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
''' +texts['app.mjs'][end:]
edit('app.mjs',"}catch(e){failure(e.message);stop();clearCloth();controls();}};", "}catch(e){if(token!==serial)return;failure(e.message);stop();clearCloth();controls();}};")
edit('app.mjs'," }catch(e){phase='failed';message(e.message,true);controls();if(pendingPromise?.token===token)", " }catch(e){if(token!==serial)return {cancelled:true};phase='failed';message(e.message,true);controls();if(pendingPromise?.token===token)")
edit('app.mjs',"release:'R04.3.3',", "release:'R04.3.4',pendingSelectionId,failedSelectionId,personRuntimeCommit:'537c0f619fb9391c6a1e72ee29d2f889b5d1782f',")
edit('app.mjs',"ready=true;categories();updateModes();", "$('retry-selection').onclick=()=>failedSelectionId&&select(failedSelectionId).catch(e=>message(e.message,true));\n ready=true;categories();updateModes();")
texts['style.css']+='''\n/* R0434: labels occupy their own row; never crop sleeves, wide hems or current 3D previews. */
.thumb{aspect-ratio:auto}
.thumb img{height:auto;aspect-ratio:4/5;object-fit:contain}
.thumb>span{position:static;display:block}
.thumb>.pending{height:auto;min-height:150px;aspect-ratio:4/5}
#retry-selection{margin:0 0 12px} [hidden]{display:none!important}
'''
edit('index.html','R04.3.3 · 全类别三维展示修复','R04.3.4 · 全类别稳定展示')
edit('index.html','<p id="status" role="status">校验原系统来源…</p>','<p id="status" role="status">校验原系统来源…</p><button id="retry-selection" hidden>重试载入所选服装</button>')
for n,t in texts.items():(P/n).write_text(t)
(P/'R0434_SOURCE_PATCH.json').write_text(json.dumps({'before':EXPECTED,'after':{n:hashlib.sha256((P/n).read_bytes()).hexdigest() for n in texts},'sourceAnchor':'5a0770741e6ecc35c41a66c7320d7390028d7fe4','changes':['transactional selection','bounded retry and cancellation','stale worker validation isolation','status labels outside image'],'materialRecordsChanged':False,'qualityGatesChanged':False},indent=2))
print('R0434_SOURCE_PATCH_APPLIED')
