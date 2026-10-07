import {FrameStore,digest} from './codec.mjs';
import {PpfViewer} from './viewer.mjs';
const base=new URL('./',import.meta.url),$=id=>document.getElementById(id),mi=b=>(b/1048576).toFixed(2);
const cases={drape:{title:'五层布料 · 球体垂坠',note:'5 层 128 × 128 网格，在重力下绕过球体并相互接触。每层保留两个原始角点约束。'},belt:{title:'三层传动带 · 摩擦接触',note:'三个滚轮先向外张紧，再依原脚本转动。三层带与滚轮使用原求解器摩擦与自接触。'}};
document.body.dataset.wbUi='tailor-ppf';document.title='PPF 布料物理 · 原求解器结果回放';
document.querySelector('main').outerHTML=`<main class="wb-workspace"><section class="wb-stage ppf-stage"><div class="ppf-caption"><strong id="ppf-title"></strong><span>PPF · 官方 CPU 原结果</span></div><div id="ppf-viewport"><canvas id="ppf-canvas" aria-label="PPF 原求解顶点序列三维回放"></canvas><div class="ppf-badge">原求解器结果回放</div><div class="ppf-transfer" id="ppf-transfer">按需读取原始帧</div></div><div class="wb-stage-tools"><button data-ppf-view="angle">斜视</button><button data-ppf-view="front">正面</button><button data-ppf-view="side">侧面</button><button data-ppf-view="top">俯视</button><select id="ppf-display" aria-label="PPF 显示方式"><option value="cloth">布料材质</option><option value="wire">原始网格</option><option value="facets">三角面诊断</option><option value="strain">原休止材料主伸长</option><option value="contacts">物体接触计数</option></select><label><input id="ppf-shadows" type="checkbox" checked>阴影</label></div><div class="ppf-timeline"><div><span id="ppf-frame">准备完整记录</span><span id="ppf-time"></span></div><input id="ppf-seek" type="range" min="0" max="1" value="0" step="1" aria-label="原始模拟帧"></div></section><aside class="wb-controls ppf-controls"><div class="wb-controls-head"><h2>布料物理 · PPF</h2><button data-wb-toggle aria-expanded="true">收起参数</button></div><div class="wb-controls-scroll"><section class="ppf-panel"><label>官方场景<select id="ppf-case"><option value="drape">五层布料 · 球体垂坠</option><option value="belt">三层传动带 · 摩擦接触</option></select></label><p id="ppf-description"></p><div class="ppf-buttons"><button id="ppf-play">从头回放</button><button id="ppf-prev">前一帧</button><button id="ppf-next">后一帧</button></div><label>回放速度<select id="ppf-speed"><option value="0.1">0.1 倍 · 观察接触</option><option value="0.25" selected>0.25 倍</option><option value="0.5">0.5 倍</option><option value="1">1 倍</option></select></label><p id="ppf-status" role="status"></p><p class="ppf-note">画面读取官方求解器已算出的三维顶点。可旋转、逐帧和分层检查；此网页没有在浏览器里重新求解 PPF。回放速度只改变观看速度；读取新块时暂停等待，不跳过原帧。</p></section><section class="ppf-panel"><h3>分层与接触观察</h3><div class="ppf-layers" id="ppf-layers"></div><p id="ppf-legend">布料颜色用于区分原物体</p><p>右侧为该物体参与的接触计数，直接读取原求解器日志，不能相加当作独立接触对数。隐藏一层只影响显示。</p><button id="ppf-show-all">显示全部</button></section><section class="ppf-panel"><h3>原始规模</h3><div class="ppf-metrics" id="ppf-metrics"></div><details><summary>只读物理参数</summary><dl class="ppf-dl" id="ppf-parameters"></dl><p>材料值使用上游原场景定义。接触间隙是数值模型参数，不等于真实布料厚度；不同场景不能用同一摩擦值概括。</p></details><details><summary>来源、精度与复现</summary><p>Ryoichi Ando / ZOZO，Apache-2.0；2026-10-02 main 的原 CPU 后端。不是 2024 论文 CUDA 版本的逐位复刻。</p><p class="ppf-source">源版本 b4ee7a44a741754d5bdfe1926d064d2483cf1456</p><p>原始 float32 顶点、全部输出帧与拓扑。无损分块解码后核对 SHA-256；不降网格，不插值补帧。最多保留三个解码块。</p><p><a href="./ppf-teacher/REPRODUCE.md">原运行参数、输入 hash 与复现说明</a> · <a href="https://github.com/st-tech/ppf-contact-solver/tree/b4ee7a44a741754d5bdfe1926d064d2483cf1456">官方源代码</a></p><p id="ppf-audit"></p></details></section></div></aside></main>`;
const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('player.css',base);document.head.append(sheet);
let generation=0,active=true,viewer=null,store=null,abort=null,manifest=null,stats=null,current=-1,desired=null,busy=false,playing=false,timer=0,caseId='drape',savedFrame=null,lastStepAt=0;
const status=(text,error=false)=>{$('ppf-status').textContent=text;$('ppf-status').classList.toggle('error',error);};
function stop(){playing=false;clearTimeout(timer);timer=0;$('ppf-play').textContent=current>=((manifest?.frames||1)-1)?'从头回放':'播放';}
function clean(){stop();generation++;abort?.abort();abort=null;store?.dispose();store=null;viewer?.dispose();viewer=null;manifest=stats=null;desired=null;busy=false;const c=$('ppf-canvas');c.replaceWith(c.cloneNode(false));}
function controls(enabled){for(const id of ['ppf-play','ppf-prev','ppf-next','ppf-seek','ppf-show-all'])$(id).disabled=!enabled;}
function objectName(o){return o.name==='sphere'?'静态球体':o.name.startsWith('sheet')?'布层 '+(o.id+1):o.name.startsWith('cylinder')?'滚轮 '+(o.id+1):'传动带 '+(o.id-2);}
function showFrameInfo(){
  const row=stats.frames[current];$('ppf-seek').value=current;$('ppf-frame').textContent=`原始帧 ${current} / ${manifest.frames-1}`;$('ppf-time').textContent=`${row.timeSeconds.toFixed(3)} 模拟秒`;
  for(const obj of row.objects){const out=$('ppf-contact-'+obj.object_index);if(out)out.textContent=obj.contact_count.toLocaleString()+' 接触';}
  $('ppf-prev').disabled=current<=0;$('ppf-next').disabled=current>=manifest.frames-1;
}
async function seek(frame){
  if(!active||!manifest)return;desired=Math.min(manifest.frames-1,Math.max(0,frame));if(busy)return;
  const token=generation;busy=true;lastStepAt=performance.now();
  try{while(desired!==null&&active&&token===generation){const next=desired;desired=null;status('正在读取并校验原始帧…');const positions=await store.frame(next);if(!active||token!==generation)return;
    if(await digest(new Uint8Array(positions.buffer,positions.byteOffset,positions.byteLength))!==stats.frames[next].sha256)throw Error('原始帧 SHA-256 不匹配');
    if(!active||token!==generation)return;viewer.update(positions,stats.frames[next].objects);current=next;showLegend();showFrameInfo();
    const ranges=[...store.cache.keys()].sort((a,b)=>a-b).map(first=>{const c=manifest.chunks.find(c=>c.firstFrame===first);return first+'–'+(first+c.frameCount-1);});
    $('ppf-transfer').textContent=`已读 ${mi(store.bytes)} MiB · 缓存帧 ${ranges.join(' / ')} · 上限 3 块`;
    status('原始顶点校验通过 · '+(playing?'回放中':'已暂停，可旋转与逐帧检查'));
  }}catch(e){if(active&&token===generation&&e.name!=='AbortError'){stop();status(e.message,true);document.documentElement.dataset.error=e.message;}}
  finally{if(token===generation){busy=false;if(playing)schedule();}}
}
function schedule(){clearTimeout(timer);if(!playing||!manifest)return;if(current>=manifest.frames-1){stop();return;}timer=setTimeout(()=>{timer=0;seek(current+1);},Math.max(0,1000/(manifest.fps*Number($('ppf-speed').value))-(performance.now()-lastStepAt)));}
async function load(id,{frame=null}={}){
  clean();active=true;caseId=cases[id]?id:'drape';const token=generation;abort=new AbortController();current=-1;controls(false);
  $('ppf-case').value=caseId;$('ppf-title').textContent=cases[caseId].title;$('ppf-description').textContent=cases[caseId].note;$('ppf-layers').replaceChildren();$('ppf-transfer').textContent='按需读取原始帧';status('读取完整场景的清单…');delete document.documentElement.dataset.error;
  try{const dataBase=new URL('data/'+caseId+'/',base);const response=await fetch(new URL('manifest.json',dataBase),{signal:abort.signal});if(!response.ok)throw Error('场景清单 HTTP '+response.status);const m=await response.json();if(!active||token!==generation)return;
    if(m.terminal.outcome.kind!=='finished'||m.frames!==m.terminal.frame+1)throw Error('场景不是完整终态记录');manifest=m;
    store=new FrameStore(dataBase,m,{signal:abort.signal,onTransfer:bytes=>{if(active&&token===generation)$('ppf-transfer').textContent=`本场已读取 ${mi(bytes)} MiB · 无损原帧 · 最多缓存 3 块`;}});
    const [topology,statistics]=await Promise.all([store.read(m.topology),store.read(m.statistics)]);if(!active||token!==generation)return;
    stats=JSON.parse(new TextDecoder().decode(statistics));viewer=new PpfViewer($('ppf-canvas'),$('ppf-viewport'));viewer.load(m,topology);viewer.mode($('ppf-display').value);viewer.shadows($('ppf-shadows').checked);
    for(const o of m.objects){const label=document.createElement('label');label.className='ppf-layer';const cb=document.createElement('input');cb.type='checkbox';cb.checked=true;cb.dataset.object=o.id;cb.onchange=()=>viewer?.visible(o.id,cb.checked);const name=document.createElement('span');name.textContent=objectName(o);const out=document.createElement('output');out.id='ppf-contact-'+o.id;label.append(cb,name,out);$('ppf-layers').append(label);}
    $('ppf-metrics').innerHTML=`<div><strong>${m.vertexCount.toLocaleString()}</strong><span>原始动态顶点</span></div><div><strong>${m.triangleCount.toLocaleString()}</strong><span>原始三角形</span></div><div><strong>${m.frames}</strong><span>全部输出帧（含 0）</span></div><div><strong>${((m.frames-1)/m.fps).toFixed(2)} s</strong><span>原模拟时间</span></div>`;
    const rows=[['积分步长',m.parameters.dt+' s'],['接触屏障',m.parameters.barrier],['摩擦混合',m.parameters.friction_mode],['重力',m.parameters.gravity.join(', ')+' m/s²'],['最小 Newton 迭代',m.parameters.min_newton_steps],['线性容差',m.parameters.cg_tol]];
    for(const o of m.objects)if(o.material)rows.push([objectName(o)+' 应变限',o.material['strain-limit'].map(x=>(x*100).toFixed(1)+'%').join('/')],[objectName(o)+' 摩擦',o.material.friction.map(x=>x.toFixed(2)).join('/')]);
    $('ppf-parameters').innerHTML=rows.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('');$('ppf-seek').max=m.frames-1;$('ppf-audit').textContent='官方终态：Finished。原求解器开启每步交叉检查；此回放不另行声称连续接触或所有三角对独立复验。';controls(true);
    await seek(frame??m.frames-1);if(token===generation)stop();
  }catch(e){if(active&&token===generation&&e.name!=='AbortError'){status(e.message,true);document.documentElement.dataset.error=e.message;}}
}
$('ppf-case').onchange=()=>{savedFrame=null;const u=new URL(location.href);u.searchParams.set('scene',$('ppf-case').value);history.replaceState(null,'',u);load($('ppf-case').value);};
$('ppf-seek').oninput=()=>{stop();seek(Number($('ppf-seek').value));};
$('ppf-prev').onclick=()=>{stop();seek(current-1);};$('ppf-next').onclick=()=>{stop();seek(current+1);};
$('ppf-play').onclick=()=>{if(playing){stop();return;}playing=true;$('ppf-play').textContent='暂停回放';if(current>=manifest.frames-1)seek(0);else if(!busy)schedule();};
$('ppf-speed').onchange=()=>{if(playing&&!busy)schedule();};
for(const b of document.querySelectorAll('[data-ppf-view]'))b.onclick=()=>viewer?.cameraView(b.dataset.ppfView);
function showLegend(){const mode=$('ppf-display').value;$('ppf-legend').textContent=mode==='contacts'?'按物体接触参与次数对数着色；不是接触点位置图。':mode==='strain'?`蓝 0% → 红 6% 主伸长；顶点颜色是相邻三角面积加权平均；基于原休止三角度量。原三角最大 ${((viewer?.maximumStretch-1)*100).toFixed(3)}%。`:'布料颜色用于区分原物体；显示样式不改变顶点。';}
$('ppf-display').onchange=()=>{viewer?.mode($('ppf-display').value);showLegend();};
$('ppf-shadows').onchange=()=>viewer?.shadows($('ppf-shadows').checked);
$('ppf-show-all').onclick=()=>{for(const cb of $('ppf-layers').querySelectorAll('input')){cb.checked=true;viewer?.visible(Number(cb.dataset.object),true);}};
$('case-select').value='ppf';$('case-select').onchange=()=>{const u=new URL(location.href);u.searchParams.set('case',$('case-select').value);u.searchParams.delete('scene');location.assign(u);};
window.addEventListener('pagehide',()=>{savedFrame=current;active=false;clean();window.dispatchEvent(new CustomEvent('ppf-lifecycle',{detail:{kind:'released',active:false,workerCount:0,rendererCount:0,cachedChunks:0}}));});
window.addEventListener('pageshow',()=>{if(!active){active=true;load(caseId,{frame:savedFrame});}});
window.ppfQA={getState:()=>({active,caseId,current,frames:manifest?.frames||0,busy,playing,generation,rendererCount:viewer?1:0,workerCount:0,cachedChunks:store?.cache.size||0,bytes:store?.bytes||0,renderCount:viewer?.renderCount||0,maximumStretch:viewer?.maximumStretch||null,visibleObjects:viewer?.meshes.filter(m=>m.visible).map(m=>m.userData.object.id)||[],error:document.documentElement.dataset.error||null}),seek:frame=>{stop();return seek(frame);},selectCase:id=>load(id),positions:()=>viewer?.current?.slice()||null};
load(new URL(location.href).searchParams.get('scene')||'drape');
