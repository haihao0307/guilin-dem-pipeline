import {Renderer} from './renderer.mjs';
import {CASES,SPEC} from './fields.mjs';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
let id=CASES[params.get('case')]?params.get('case'):'karst',seed=Number(params.get('seed')||31415),worker,renderer,audit=null;
if(!Number.isSafeInteger(seed)||seed<0||seed>999999)seed=31415;
const toast=t=>{$('toast').textContent=t;$('toast').style.opacity='1';setTimeout(()=>$('toast').style.opacity='0',2700)};
function fail(message){$('loading').hidden=false;$('loadTitle').textContent='暂未通过运行检查';$('loadText').textContent=message;$('loadPercent').textContent='已停止，没有降低几何精度';document.body.dataset.state='error';window.__LM.error=message;console.error(message)}
window.__LM={version:'1.0.0',ready:false,error:null,audit:null,sourceType:'procedural-authored-example',renderTextureCalls:0,renderGeometryChanges:0};
try{renderer=new Renderer($('world'));window.__LM.snapshot=()=>renderer.snapshot();window.__LM.bookmark=v=>renderer.bookmark(v);window.__LM.renderer=renderer}catch(e){fail(e.message)}
async function build(caseId=id){
 if(!renderer)return;id=caseId;window.__LM.ready=false;window.__LM.error=null;document.body.dataset.state='building';$('loading').hidden=false;$('progress').style.width='0%';$('loadTitle').textContent='正在生成'+CASES[id].name;$('loadText').textContent='固定精度几何只生成一次，转动时无需重建。';$('seed').value=seed;
 for(const b of document.querySelectorAll('[data-case]')){b.classList.toggle('selected',b.dataset.case===id);b.disabled=true}
 $('caseEnglish').textContent=CASES[id].en;$('caseTitle').textContent=CASES[id].name;$('caseNote').textContent=CASES[id].note;
 const url=new URL(location.href);url.searchParams.set('case',id);url.searchParams.set('seed',String(seed));if(location.protocol==='https:'||location.protocol==='http:')history.replaceState(null,'',url);
 worker?.terminate();worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});worker.onerror=e=>fail(e.message||'字段工作线程未能载入，请检查模块地址或浏览器工作线程支持');
 worker.onmessage=async({data})=>{
  if(data.type==='error'){fail(data.message);return}
  if(data.type==='progress'){$('progress').style.width=Math.round(data.value*100)+'%';$('loadPercent').textContent=Math.round(data.value*100)+'%';$('loadText').textContent=data.label;return}
  try{
   if(data.audit.river.minBedClearanceM<0)throw Error('水面与河床净空检查失败');
   $('progress').style.width='94%';$('loadText').textContent='上传固定网格，检查图形设备';await renderer.load(data);audit=data.audit;window.__LM.audit=audit;
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));renderer.render();
   if(renderer.gl.isContextLost())throw Error('图形上下文丢失');
   $('loading').hidden=true;document.body.dataset.state='ready';window.__LM.ready=true;facts();
   for(const b of document.querySelectorAll('[data-case]'))b.disabled=false;
   for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view==='overview');worker.terminate();
  }catch(e){fail(e.message)}
 };worker.postMessage({caseId:id,seed});
}
function facts(){if(!audit)return;const s=renderer.snapshot();const rows=[['来源','程序化创作 / 无 DEM'],['范围','2.048 × 2.048 km'],['几何网格','2049 × 2049'],['固定间距','1.00 m'],['地形三角形',audit.terrainTriangles.toLocaleString()],['当前绘制',s.visibleTriangles.toLocaleString()],['CPU 生成',Math.round(audit.buildMs)+' ms'],['数值缓冲区',(audit.bytes/1048576).toFixed(1)+' MiB'],['河面纵向采样','1.00 m'],['河床最小净空',audit.river.minBedClearanceM.toFixed(3)+' m'],['材质纹理','0'],['LOD 切换','0']];$('facts').replaceChildren(...rows.map(([a,b])=>{let d=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=a;dd.textContent=b;d.append(dt,dd);return d}))}
for(const b of document.querySelectorAll('[data-case]'))b.onclick=()=>build(b.dataset.case);
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{renderer.bookmark(b.dataset.view);for(const q of document.querySelectorAll('[data-view]'))q.classList.toggle('active',q===b)};
$('seedForm').onsubmit=e=>{e.preventDefault();seed=Number($('seed').value);if(!Number.isSafeInteger(seed)||seed<0||seed>999999){toast('种子范围为 0 至 999999 的整数');return}build()};
for(const name of ['color','wet'])$(name).oninput=e=>{renderer.settings[name]=Number(e.target.value);$(name+'Value').textContent=Number(e.target.value).toFixed(2)};
$('gray').onclick=()=>{renderer.settings.gray=renderer.settings.gray?0:1;$('gray').classList.toggle('active',!!renderer.settings.gray)};
$('inspect').onclick=()=>{$('inspector').hidden=!$('inspector').hidden;facts()};
function hide(){document.body.classList.toggle('clean');$('hideUI').textContent=document.body.classList.contains('clean')?'展开面板':'收起面板'}$('hideUI').onclick=hide;window.addEventListener('keydown',e=>{if(e.code==='KeyH'&&!['INPUT','TEXTAREA'].includes(e.target.tagName))hide()});
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{toast('当前浏览器未开放全屏')}};
$('share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('当前案例链接已复制')}catch{toast('请复制浏览器地址栏中的当前链接')}};
setInterval(()=>{if(!window.__LM.ready)return;const s=renderer.snapshot();$('fps').textContent='按需绘制 · '+s.drawCalls+' 次绘制';if(!$('inspector').hidden)facts()},1200);
window.__LM.select=build;
if(renderer)build();
