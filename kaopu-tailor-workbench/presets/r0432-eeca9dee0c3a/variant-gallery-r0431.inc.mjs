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
