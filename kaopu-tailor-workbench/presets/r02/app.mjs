import {ShowcaseRenderer} from './showcase-3d.mjs';
import {paperSVG} from '../r01/vendor/paper-preview.mjs';

const $=id=>document.getElementById(id);
const R01=new URL('../r01/',import.meta.url),R074=new URL('../../r07/continuation/',import.meta.url);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pause=()=>new Promise(resolve=>(window.requestIdleCallback||window.requestAnimationFrame)(()=>resolve(),{timeout:50}));
let library,schema,current,detailRenderer,thumbnailRenderer,ready=false,thumbDisposed=false,thumbnailError=null,thumbnailCount=0,category='全部',query='',paperZoom=1,paperCache=new Map(),activeTab='3d';
const thumbnails=new Map();

async function fetchJSON(url){const r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw Error(`读取失败 ${r.status}：${url}`);return r.json();}
async function fetchPaper(row){
 if(paperCache.has(row.id))return paperCache.get(row.id);
 const r=await fetch(new URL(row.paperAsset,R01));if(!r.ok)throw Error(`纸样读取失败：${row.id}`);
 let bytes=await r.arrayBuffer(),u=new Uint8Array(bytes);
 if(u[0]===31&&u[1]===139){if(!('DecompressionStream'in window))throw Error('当前浏览器不支持读取压缩纸样');bytes=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}
 const pattern=JSON.parse(new TextDecoder().decode(bytes));
 if(pattern.validation?.analytic2DPass!==true||pattern.recipeHash!==row.recipeHash)throw Error('纸样与预设版本不匹配');
 paperCache.set(row.id,pattern);while(paperCache.size>5)paperCache.delete(paperCache.keys().next().value);return pattern;
}
function status(text,error=false){$('runtime-status').textContent=text;$('runtime-status').classList.toggle('error',error);}
function rows(){return library.presets.filter(row=>(category==='全部'||row.category===category)&&(!query||[row.id,row.name,row.category,row.style,row.intent].join(' ').toLowerCase().includes(query)));}
function renderCategories(){
 const values=['全部',...new Set(library.presets.map(row=>row.category))];
 $('categories').innerHTML=values.map(v=>`<button data-category="${esc(v)}" aria-pressed="${v===category}">${esc(v)}</button>`).join('');
 for(const button of $('categories').querySelectorAll('button'))button.onclick=()=>{category=button.dataset.category;renderCategories();renderCards();};
}
function cardHTML(row){
 const src=thumbnails.get(row.id),warnings=row.paperWarnings?.length||0;
 return `<button class="card" data-preset="${esc(row.id)}" aria-pressed="${row.id===current?.id}" aria-label="选择 ${esc(row.name)}">
   <span class="card-image">${src?`<img src="${src}" alt="${esc(row.name)}在塑料橱窗模特上的三维形体缩略图">`:'<span class="placeholder">生成三维橱窗缩略图…</span>'}<span class="card-code">${esc(row.id)}</span><span class="card-kind">3D</span></span>
   <span class="card-copy"><strong>${esc(row.name)}</strong><small>${esc(row.category)} · ${row.panelCount}片 · ${row.seamCount}组缝边${warnings?` · ${warnings}条源警告`:''}</small></span>
 </button>`;
}
function renderCards(){
 const filtered=rows();$('cards').innerHTML=filtered.map(cardHTML).join('');$('visible-count').textContent=`${filtered.length} / ${library.presets.length} 个款式`;$('empty').hidden=filtered.length!==0;
 for(const button of $('cards').querySelectorAll('.card'))button.onclick=()=>select(button.dataset.preset,true);
}
function updateFacts(row){
 const controls=row.activeParameterCount??'—';$('facts').innerHTML=[`${row.panelCount} 个裁片`,`${row.seamCount} 组缝边`,`${row.dartCount||0} 个省道`,`${controls} 项当前生效参数`,'形体预览非成衣验收'].map(v=>`<span>${esc(v)}</span>`).join('');
}
async function select(id,scroll=false){
 const row=library.presets.find(x=>x.id===id);if(!row)throw Error('未知预设 '+id);current=row;
 $('selected-category').textContent=`${row.category} / ${row.id}`;$('selected-title').textContent=row.name;$('selected-intent').textContent=row.intent||'以统一三维橱窗模特展示款式轮廓。';updateFacts(row);
 $('open-r01').href=new URL(`?preset=${encodeURIComponent(row.id)}`,R01).href;$('open-sewing').href=new URL(`?case=${encodeURIComponent(row.style)}`,R074).href;
 detailRenderer.setPreset(row);renderCards();
 const u=new URL(location.href);u.searchParams.set('preset',row.id);history.replaceState(null,'',u);
 if(activeTab==='paper')await renderPaper();
 if(scroll&&innerWidth<881)$('showcase').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'});
}
function fitPaper(){
 const svg=$('paper-host').querySelector('svg');if(!svg)return;const box=svg.viewBox.baseVal,viewport=$('paper-viewport'),w=Math.max(20,viewport.clientWidth-12),h=Math.max(20,viewport.clientHeight-12),scale=Math.min(w/box.width,h/box.height)*paperZoom;
 svg.style.width=`${Math.max(1,box.width*scale)}px`;svg.style.height=`${Math.max(1,box.height*scale)}px`;svg.style.minHeight='0';$('paper-host').style.width=`${Math.max(viewport.clientWidth,box.width*scale+12)}px`;$('paper-host').style.height=`${Math.max(viewport.clientHeight,box.height*scale+12)}px`;
}
async function renderPaper(){
 if(!current)return;$('paper-host').innerHTML='<p>正在读取该款实际纸样……</p>';
 try{const pattern=await fetchPaper(current);$('paper-host').innerHTML=paperSVG(pattern);paperZoom=1;fitPaper();status(`已读取 ${current.id} 的真实毫米纸样；当前三维橱窗仍只是选款形体。`);}catch(e){$('paper-host').innerHTML='<p>纸样读取失败。</p>';status(e.message,true);}
}
async function tab(name){
 activeTab=name;const is3d=name==='3d';$('tab-3d').setAttribute('aria-selected',String(is3d));$('tab-paper').setAttribute('aria-selected',String(!is3d));$('view-3d').hidden=!is3d;$('view-paper').hidden=is3d;
 if(!is3d)await renderPaper();else{detailRenderer.resize();detailRenderer.render();}
}
async function buildThumbnails(){
 thumbnailRenderer=new ShowcaseRenderer({thumbnail:true});thumbnailError=null;
 try{
  for(const row of library.presets){
   await pause();const url=thumbnailRenderer.capture(row,360,270);thumbnails.set(row.id,url);thumbnailCount++;
   const imgHost=$('cards').querySelector(`[data-preset="${CSS.escape(row.id)}"] .card-image`);
   if(imgHost){imgHost.querySelector('.placeholder')?.remove();const image=document.createElement('img');image.src=url;image.alt=`${row.name}在塑料橱窗模特上的三维形体缩略图`;imgHost.prepend(image);}
   $('thumbnail-progress').textContent=`三维缩略图 ${thumbnailCount} / ${library.presets.length}`;
  }
  $('thumbnail-progress').textContent=`${thumbnailCount} 张三维缩略图已缓存 · 临时渲染器已释放`;
 }catch(e){thumbnailError=String(e.message||e);$('thumbnail-progress').textContent='部分三维缩略图生成失败';status('三维缩略图生成失败：'+thumbnailError,true);
 }finally{thumbnailRenderer?.dispose();thumbnailRenderer=null;thumbDisposed=true;}
}
function state(){return{version:'R02',ready,presetCount:library?.presets?.length||0,visibleCards:$('cards')?.querySelectorAll('.card').length||0,thumbnailCount,thumbnailRendererDisposed:thumbDisposed,thumbnailError,activeRendererCount:detailRenderer?1:0,canvasCount:document.querySelectorAll('canvas').length,selectedId:current?.id||null,activeTab,paperReady:!!$('paper-host')?.querySelector('svg'),usesRealPerson:false,clothSimulationRun:false,physicalFitAccepted:false,dynamicWearCertified:false,detail:detailRenderer?.diagnostics()||null};}
async function boot(){
 try{
  [library,schema]=await Promise.all([fetchJSON(new URL('library.json',R01)),fetchJSON(new URL('parameter-schema.json',R01))]);
  if(library.schema!=='kaopu-tailor-preset-library@1'||library.presetCount!==60)throw Error('R01预设目录版本不匹配');
  $('metric-presets').textContent=library.presetCount;$('version').textContent=`R02 · 继承 P01 ${library.sourceCommit.slice(0,12)} · 三维形体预览 / 非成衣认证`;
  detailRenderer=new ShowcaseRenderer();detailRenderer.mount($('showcase'));
  renderCategories();renderCards();
  $('search').oninput=()=>{query=$('search').value.trim().toLowerCase();renderCards();};
  $('tab-3d').onclick=()=>tab('3d');$('tab-paper').onclick=()=>tab('paper');
  $('paper-plus').onclick=()=>{paperZoom=Math.min(4,paperZoom+.5);fitPaper();};$('paper-minus').onclick=()=>{paperZoom=Math.max(.5,paperZoom-.5);fitPaper();};$('paper-fit').onclick=()=>{paperZoom=1;fitPaper();};
  for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>{for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b===button));detailRenderer.view(button.dataset.view);};
  const requested=new URL(location.href).searchParams.get('preset');await select(library.presets.some(x=>x.id===requested)?requested:'J06');ready=true;window.__TAILOR_R02_QA__={getState:state,select,showPaper:()=>tab('paper'),show3D:()=>tab('3d'),getRows:()=>structuredClone(library.presets)};
  buildThumbnails();status('三维电子橱柜已启动；卡片使用统一塑料展示体，真实缝合质量仍由 R07.4 检查。');
 }catch(e){status('R02 启动失败：'+e.message,true);$('visible-count').textContent='载入失败';throw e;}
}
addEventListener('resize',()=>{if(activeTab==='paper')fitPaper();else detailRenderer?.resize();});
addEventListener('pagehide',()=>{thumbnailRenderer?.dispose();detailRenderer?.dispose();paperCache.clear();});
boot();
