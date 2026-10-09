// Curated design handoff: no baked clothing and no manual 122-field editing required.
let continuationPresetLibrary=null;
const continuationPresetBase=new URL('https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r01/');
function mountPresetUI(){
 const host=$('tab-styles');if(!host||$('continuation-preset-select'))return;
 const box=document.createElement('section');box.id='continuation-presets';box.innerHTML='<strong>助理服装预设</strong><p>选择设计，由原程序按当前人台重新制版；不载入固定尺码成衣。</p><select id="continuation-preset-select" aria-label="选择完整设计预设"><option>读取60套预设…</option></select><button id="continuation-preset-apply" disabled>采用这套设计并重新制版</button><p id="continuation-preset-status" role="status">专业参数由预设给定，你不必逐项调整。</p>';
 host.prepend(box);$('continuation-preset-apply').onclick=()=>applyContinuationPreset($('continuation-preset-select').value).catch(e=>status(e.message,true));
 read(new URL('library.json',continuationPresetBase)).then(library=>{
  if(library.schema!=='kaopu-tailor-preset-library@1'||library.version!=='P01'||library.presetCount!==60)throw Error('预设目录版本不匹配');continuationPresetLibrary=library;
  $('continuation-preset-select').innerHTML=library.presets.map(r=>`<option value="${r.id}">${r.id} · ${esc(r.category)} · ${esc(r.name)}</option>`).join('');$('continuation-preset-select').value='D01';$('continuation-preset-apply').disabled=false;
  $('continuation-preset-status').textContent='60套完整纸样设计已接入；这不是60件已验收成衣。';
 }).catch(e=>{$('continuation-preset-status').textContent='预设目录读取失败：'+e.message;});
}
async function applyContinuationPreset(id){
 if(!schema||!continuationPresetLibrary)throw Error('等待原工作台和预设目录加载');
 if(state.running||state.generating||state.phase==='paused')throw Error('先停止本轮计算，再切换设计');
 const row=continuationPresetLibrary.presets.find(r=>r.id===id);if(!row)throw Error('未知预设');
 if(continuationPresetLibrary.generatorCommit!==schema.sourceCommit)throw Error('预设和原制版程序版本不同，拒绝静默套用');
 $('continuation-preset-apply').disabled=true;
 try{
  const r=await fetch(new URL(row.paperAsset,continuationPresetBase));if(!r.ok)throw Error('无法读取完整设计');let data=await r.arrayBuffer();const first=new Uint8Array(data);
  if(first[0]===31&&first[1]===139)data=await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const paper=JSON.parse(new TextDecoder().decode(data));if(paper.recipeHash!==row.recipeHash||paper.validation?.analytic2DPass!==true)throw Error('预设来源或纸样校验不一致');
  const chosen=validateDesignSnapshot(paper.design,schema);
  await select(row.style,{push:true,skipBaseline:true,presetDesign:chosen});state.activePresetId=row.id;state.activePresetName=row.name;
  $('current-title').textContent=row.name;$('continuation-preset-status').textContent=`已采用 ${row.id} ${row.name} 的完整设计；当前人台重新生成尺寸，尚未缝合验收。`;
  return{presetId:row.id,style:row.style,usesCurrentBody:true,usesBakedGarment:false};
 }finally{$('continuation-preset-apply').disabled=false;}
}
