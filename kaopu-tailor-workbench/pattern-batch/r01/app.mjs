import {renderPaper,escapeXML} from './paper.mjs';
const $=s=>document.querySelector(s),categories=['全部','上装','裤装','半裙','连衣裙','连体裤'];
let pack,selected,category='全部',query='',svgOptions={seams:true,grain:false},viewBox,initialViewBox;
const tickets=new Map();let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4000)}
function download(data,filename,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function svgData(ticket,thumbnail=false){return renderPaper(ticket,{thumbnail,labels:!thumbnail,...svgOptions})}
function updateGallery(){
  const rows=pack.catalogue.rows.filter(r=>(category==='全部'||r.category===category)&&(!query||`${r.id} ${r.name}`.toLowerCase().includes(query.toLowerCase())));
  const review=rows.filter(r=>r.groupLengthReviewCount>0).length;
  $('#results').textContent=`${rows.length} 款 · 点击查看裁片${review?` · ${review} 款保留试缝提示`:''}`;
  $('#gallery').innerHTML=rows.map(r=>`<button class="card" data-id="${r.id}" aria-label="查看${escapeXML(r.name)}"><div class="card-paper"><span class="card-id">${r.id}</span>${svgData(tickets.get(r.id),true)}</div><div class="card-copy"><strong class="card-title">${escapeXML(r.name)}</strong><div class="card-meta"><span>${r.panelCount} 裁片 · ${r.seamCount} 接缝</span><em>${r.passed?'纸样已复核':'待复核'}</em></div></div></button>`).join('');
  $('#empty').hidden=!!rows.length;
  $('#categories').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.category===category);b.setAttribute('aria-pressed',String(b.dataset.category===category))});
}
function drawPaper(){
  $('#paper').innerHTML=svgData(selected);const svg=$('#paper svg');
  initialViewBox=svg.getAttribute('viewBox').split(' ').map(Number);viewBox=[...initialViewBox];
  svg.querySelectorAll('.paper-edge').forEach(edge=>edge.addEventListener('click',event=>{
    event.stopPropagation();const sid=edge.dataset.seam;
    svg.querySelectorAll('.paper-edge').forEach(e=>e.classList.toggle('selected',!!sid&&e.dataset.seam===sid));
    const seam=selected.pattern.seams.find(s=>s.id===sid);
    $('#seam-hint').textContent=seam?'两端来自原纸样的明确连接。':'这是一条未声明缝合的原始自由边。';
    if(!seam){$('#seam-info').textContent=`${edge.dataset.panel} · e${edge.dataset.edge}`;return}
    const g=seam.gathering,operation=selected.sewingPlan.groups.find(g=>g.sourceSeams.includes(sid)),segment=operation?.segments.find(s=>s.sourceSeamId===sid);
    $('#seam-info').innerHTML=`<strong>${escapeXML(seam.a.panelId)} · e${seam.a.edge}</strong><br>${seam.lengthAMm.toFixed(2)} mm<br>↔<br><strong>${escapeXML(seam.b.panelId)} · e${seam.b.edge}</strong><br>${seam.lengthBMm.toFixed(2)} mm<br>${seam.isDart?'同片收省':'裁片接合'} · ${seam.direction==='opposite'?'反向对应':'同向对应'}${segment?`<br>工艺抽褶比 ${segment.plannedRuffleA.toFixed(3)} / ${segment.plannedRuffleB.toFixed(3)}`:g?`<br>原声明抽褶比 ${g.ruffleCoefficientA.toFixed(3)} / ${g.ruffleCoefficientB.toFixed(3)}`:''}${operation?.constructionDeclarations.length?'<br>已恢复原配方的抽褶声明':''}`;
  }));
}
function show(ticket){
  selected=ticket;$('#detail-title').textContent=ticket.name;$('#detail-category').textContent=`${ticket.id} / ${pack.catalogue.rows.find(r=>r.id===ticket.id)?.category||'导入版型'}`;
  const row=pack.catalogue.rows.find(r=>r.id===ticket.id);
  $('#intent').textContent=row?.intent||'从已冻结的裁片与明确接缝恢复。';
  $('#piece-stats').innerHTML=`<dt>裁片</dt><dd>${ticket.pattern.panels.length} 片</dd><dt>接缝</dt><dd>${ticket.pattern.seams.length} 组</dd><dt>省道</dt><dd>${ticket.pattern.darts.length} 组</dd><dt>结构复核</dt><dd>${ticket.structuralAudit.passed?'通过':'待处理'}</dd>`;
  $('#source-info').textContent=`参考量体：${ticket.bodyIdentity.id}；版本 ${ticket.bodyIdentity.revision}。原制版来源 GarmentCode；本轮重新生成并独立复核。${ticket.sewingPlan.groupLengthReview.length?` ${ticket.sewingPlan.groupLengthReview.length} 个接缝组保留配长差异，须经后续试缝确认。`:''} 三维试穿、材料和叠穿未在本阶段验收。`;
  if(ticket.sewingPlan.groupLengthReview.length)$('#piece-stats').innerHTML+=`<dt>配长差异</dt><dd>${ticket.sewingPlan.groupLengthReview.length} 组待试缝</dd>`;
  $('#seam-info').textContent='';$('#seam-hint').textContent='点击一条缝边，查看配对裁片。';drawPaper();
  if(!$('#detail').open)$('#detail').showModal();
}
async function verifyKnownTicket(ticket){const {contentSHA256}=ticket;const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  // Python and JS differ in float serialization; validate full raw bytes in the batch manifest.
  // For import, require the exact known frozen ticket or a successful explicit offline rebuild.
  const known=tickets.get(ticket.id);
  if(!known||known.contentSHA256!==contentSHA256)throw Error('这份版型不属于当前已复核批次，请先重新批量复核。');
  if(canonical(ticket)!==canonical(known))throw Error('版型内容已改变，需要重新复核后才能导入。');
  return contentSHA256;
}
$('#search').addEventListener('input',e=>{query=e.target.value;updateGallery()});
$('#categories').addEventListener('click',e=>{const b=e.target.closest('button');if(b){category=b.dataset.category;updateGallery()}});
$('#gallery').addEventListener('click',e=>{const c=e.target.closest('[data-id]');if(c){show(tickets.get(c.dataset.id));history.replaceState(null,'',`#${c.dataset.id}`)}});
$('#close-detail').onclick=()=>$('#detail').close();
$('#detail').addEventListener('click',e=>{if(e.target===$('#detail')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
$('#show-seams').onchange=e=>{svgOptions.seams=e.target.checked;drawPaper()};$('#show-grain').onchange=e=>{svgOptions.grain=e.target.checked;drawPaper()};
$('#fit-paper').onclick=()=>{viewBox=[...initialViewBox];$('#paper svg').setAttribute('viewBox',viewBox.join(' '))};
$('#paper').addEventListener('wheel',e=>{if(!selected)return;e.preventDefault();const factor=e.deltaY>0?1.12:1/1.12;const next=viewBox[2]*factor;
  if(next<initialViewBox[2]/12||next>initialViewBox[2]*3)return;
  viewBox=[viewBox[0]+(viewBox[2]-next)/2,viewBox[1]+(viewBox[3]-viewBox[3]*factor)/2,next,viewBox[3]*factor];$('#paper svg').setAttribute('viewBox',viewBox.join(' '));},{passive:false});
let drag;
$('#paper').addEventListener('pointerdown',e=>{if(!e.target.closest('.paper-edge')){drag={x:e.clientX,y:e.clientY,box:[...viewBox]};$('#paper').setPointerCapture(e.pointerId)}});
$('#paper').addEventListener('pointermove',e=>{if(!drag)return;const r=$('#paper').getBoundingClientRect(),scale=Math.min(r.width/drag.box[2],r.height/drag.box[3]);viewBox=[drag.box[0]-(e.clientX-drag.x)/scale,drag.box[1]-(e.clientY-drag.y)/scale,...drag.box.slice(2)];$('#paper svg').setAttribute('viewBox',viewBox.join(' '))});
$('#paper').addEventListener('pointerup',()=>drag=null);$('#paper').addEventListener('pointercancel',()=>drag=null);
$('#export-svg').onclick=()=>download(renderPaper(selected,{seams:true,grain:true}),`${selected.id}-${selected.name}-净缝线.svg`,'image/svg+xml');
$('#export-json').onclick=()=>download(JSON.stringify(selected),`${selected.id}-pattern.json`,'application/json');
$('#export-all').onclick=()=>download(JSON.stringify(pack),'服装60款-版型与连接结构.json','application/json');
$('#import-toggle').onclick=()=>$('#import-file').click();
$('#import-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const ticket=JSON.parse(await file.text());await verifyKnownTicket(ticket);show(ticket);toast('已恢复原始裁片与接缝记录。')}catch(error){toast(error.message)}finally{e.target.value=''}};
async function load(){
  const inline=$('#batch-payload');
  if(inline){const bytes=Uint8Array.from(atob(inline.textContent.trim()),c=>c.charCodeAt(0));const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));pack=await new Response(stream).json()}
  else{const response=await fetch('./data/all-patterns.json');if(!response.ok)throw Error('版型数据读取失败');pack=await response.json()}
  if(pack.schema!=='kaopu-pattern-batch-pack@1'||pack.catalogue.count!==60||pack.patterns.length!==60)throw Error('版型批次不完整');
  pack.patterns.forEach(t=>tickets.set(t.id,t));
  $('#summary').textContent=`${pack.catalogue.passedCount} / 60 款结构已复核`;
  $('#categories').innerHTML=categories.map(c=>`<button data-category="${c}" class="${c==='全部'?'active':''}">${c}<small>${c==='全部'?60:pack.catalogue.categories[c].total}</small></button>`).join('');
  $('#export-all').disabled=false;updateGallery();
  window.KAOPUPatternBatch={version:'R01',getCatalogue:()=>structuredClone(pack.catalogue),select:id=>{if(!tickets.has(id))throw Error('Unknown pattern');show(tickets.get(id))},getPattern:id=>structuredClone(tickets.get(id))};
  const id=decodeURIComponent(location.hash.slice(1));if(tickets.has(id))show(tickets.get(id));
}
load().catch(error=>{$('#summary').textContent='版型读取失败';toast(error.message);console.error(error)});
