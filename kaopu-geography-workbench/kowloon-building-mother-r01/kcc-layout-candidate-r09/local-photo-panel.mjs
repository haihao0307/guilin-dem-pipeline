/** User-selected references remain entirely in this origin's browser storage.
 * No fetch, upload, server, EXIF inference, photo registration or geometry edits. */
export function localPhotoIdentity(selection){
 if(!selection?.caseId)throw Error('Select a building first');
 const face=selection.sourcePatchId?`source-face:${selection.sourcePatchId}`:selection.localObjectId!=null?`component:${selection.localObjectId}`:'building-overview';
 return{key:`${selection.caseId}|${face}`,caseId:selection.caseId,buildingId:selection.buildingId??null,face,sourcePatchId:selection.sourcePatchId??null,localObjectId:selection.localObjectId??null};
}
const el=(tag,content,cls)=>{const e=document.createElement(tag);if(content!==undefined)e.textContent=content;if(cls)e.className=cls;return e;};
function openDb(){return new Promise((resolve,reject)=>{if(!globalThis.indexedDB)return reject(Error('浏览器不支持 IndexedDB'));const r=indexedDB.open('building-r05-local-references',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('references'))r.result.createObjectStore('references',{keyPath:'key'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error??Error('无法打开本地存储'));r.onblocked=()=>reject(Error('本地存储被另一页面阻止'));});}
function dbRequest(db,mode,operation){return new Promise((resolve,reject)=>{const tx=db.transaction('references',mode),request=operation(tx.objectStore('references'));let result;request.onsuccess=()=>{result=request.result;};request.onerror=()=>reject(request.error);tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??Error('本地存储操作未完成'));});}
export function createLocalPhotoPanel({element,getSelection,onChange=()=>{}}){
 const cache=new Map();let db=null,storageError=null,revision=0,objectUrls=[],capture=null;
 const state={ready:false,key:null,count:0,activeIndex:0,persisted:false,storage:'initializing',networkUploads:0,geometryRetraces:0};
 const title=el('strong','本机参考照片'),note=el('p','用户本机参考，未自动配准。只存此浏览器，不上传服务器。','hint'),association=el('p','','local-association'),input=document.createElement('input');input.type='file';input.accept='image/*';input.multiple=true;input.id='localPhotoInput';input.setAttribute('aria-label','为当前建筑或源面选择本机参考照片');
 const status=el('p','','hint'),gallery=el('div',undefined,'local-photo-gallery'),clear=el('button','清除此处本机照片');clear.id='clearLocalPhotos';const body=el('div',undefined,'local-photo-panel');body.append(title,note,association,input,status,gallery,clear);element.append(body);
 const dbReady=openDb().then(result=>{db=result;db.onversionchange=()=>db.close();state.storage='indexeddb';}).catch(e=>{storageError=e.message;state.storage='session-only';});
 function revoke(){for(const u of objectUrls)URL.revokeObjectURL(u);objectUrls=[];}
 function current(){return localPhotoIdentity(getSelection());}
 function info(record){return record?.photos?.length?record.persisted?'已保存到此浏览器。清除浏览器站点数据也会删除照片。':'仅保留在本次页面；关闭或刷新可能丢失。'+(storageError?' 本地保存失败：'+storageError:''):'尚未添加本机照片。'+(storageError?' 浏览器持久保存不可用：'+storageError:'');}
 function draw(record){revoke();const photos=record?.photos??[];state.count=photos.length;state.persisted=!!record?.persisted;state.activeIndex=Math.min(state.activeIndex,Math.max(0,photos.length-1));gallery.replaceChildren();status.textContent=info(record);clear.hidden=!photos.length;if(photos.length){const active=photos[state.activeIndex],image=document.createElement('img');image.src=URL.createObjectURL(active.blob);objectUrls.push(image.src);image.alt='用户本机参考，未自动配准：'+active.name;image.className='local-reference-image';gallery.append(image,el('p',active.name,'hint'));if(photos.length>1){const tabs=el('div',undefined,'buttons local-photo-tabs');for(const [i,p] of photos.entries()){const b=el('button',`${i+1} · ${p.name}`);b.classList.toggle('active',i===state.activeIndex);b.onclick=()=>{state.activeIndex=i;draw(record);};tabs.append(b);}gallery.append(tabs);}}onChange({...state});}
 async function read(identity){await dbReady;if(cache.has(identity.key))return cache.get(identity.key);if(db){try{const saved=await dbRequest(db,'readonly',s=>s.get(identity.key));if(saved){saved.persisted=true;cache.set(identity.key,saved);return saved;}}catch(e){storageError=e.message;state.storage='session-only';}}return null;}
 async function refresh(){const rev=++revision,identity=current();state.key=identity.key;state.caseId=identity.caseId;state.sourcePatchId=identity.sourcePatchId;state.activeIndex=0;association.textContent=`关联：${getSelection().buildingName??identity.caseId} · ${identity.sourcePatchId?'原源面 '+identity.sourcePatchId:identity.localObjectId!=null?'局部构件 '+identity.localObjectId:'建筑总览'}`;gallery.replaceChildren();clear.hidden=true;status.textContent='读取本机参考…';const record=await read(identity);if(rev!==revision)return;state.ready=true;draw(record);return {...state};}
 async function importFiles(files,selection=getSelection()){
  const identity=localPhotoIdentity(selection),accepted=[...files].filter(f=>f.type.startsWith('image/'));if(!accepted.length){status.textContent='没有选到可识别的图片文件。';return {accepted:0};}
  const old=await read(identity),photos=[...(old?.photos??[]),...accepted.map(f=>({id:crypto.randomUUID(),name:f.name,type:f.type,blob:f,addedAt:new Date().toISOString()}))],record={...identity,photos,persisted:false};cache.set(identity.key,record);
  if(db){try{await dbRequest(db,'readwrite',s=>s.put(record));record.persisted=true;}catch(e){storageError=e.message;state.storage='session-only';}}
  if(current().key===identity.key)await refresh();return{accepted:accepted.length,key:identity.key,persisted:record.persisted};
 }
 async function clearCurrent(){const identity=current();if(db){try{await dbRequest(db,'readwrite',s=>s.delete(identity.key));}catch(e){status.textContent='清除持久存储失败，照片可能仍在此浏览器：'+e.message;return false;}}cache.delete(identity.key);await refresh();return true;}
 input.addEventListener('click',()=>{capture={...getSelection()};});input.addEventListener('change',()=>{const selected=capture??getSelection();capture=null;importFiles(input.files,selected).catch(e=>{status.textContent='本机照片未载入：'+e.message;});input.value='';});clear.onclick=()=>clearCurrent().catch(e=>status.textContent=e.message);
 return {state,refresh,importFiles,clearCurrent,destroy(){revoke();db?.close();element.replaceChildren();}};
}
