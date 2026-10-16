const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const [patterns,materials]=await Promise.all(['pattern-catalog.json','materials.json'].map(async file=>{const r=await fetch(new URL(file,import.meta.url));if(!r.ok)throw Error('CATALOG_HTTP '+r.status);return r.json();}));
const names={'denim-raw':'深靛原色','denim-vintage':'复古水洗','denim-bleach':'浅色漂洗','denim-black':'炭黑牛仔','knit-fine-0':'细针素色','knit-soft-0':'柔软中针','knit-chunky-1':'菱格粗针','knit-reverse-3':'正针条纹','leather-black':'荔枝纹皮革','leather-wax':'油蜡棕革','leather-suede':'反绒皮革','leather-patent':'深棕漆皮'};
const colours={'denim-raw':'#234556','denim-vintage':'#657c85','denim-bleach':'#94acba','denim-black':'#373d41','knit-fine-0':'#8da7a4','knit-soft-0':'#b4a991','knit-chunky-1':'#a7916a','knit-reverse-3':'#9c9f8e','leather-black':'#36362f','leather-wax':'#9e6d42','leather-suede':'#b69674','leather-patent':'#51463e'};
const families={knit:'针织',denim:'牛仔',leather:'皮革'},roleName={top:'上衣',bottom:'下装'};
const state={step:'patterns',role:'top',family:'all',patterns:{top:null,bottom:null},materials:{top:'denim-raw',bottom:'denim-raw'},parameters:{},building:false,applied:null,dirty:true};
const pattern=id=>patterns.find(p=>p.id===id),material=id=>materials.find(m=>m.id===id),complete=()=>!!state.patterns.top&&!!state.patterns.bottom;
let toastTimer;
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3800);}
function panelName(id){const labels={left_ftorso:'左前衣片',right_ftorso:'右前衣片',left_btorso:'左后衣片',right_btorso:'右后衣片',pant_b_l:'左后裤片',pant_b_r:'右后裤片',pant_f_l:'左前裤片',pant_f_r:'右前裤片',wb_front:'前腰片',wb_back:'后腰片'};return labels[id]||(/sleeve/.test(id)?'袖片':/collar/.test(id)?'领片':'衣片');}
function paperSVG(row,mini=false){
 let panels=row.panels;if(mini&&row.id==='T08')panels=['left_ftorso','left_btorso','left_sleeve_f','right_sleeve_f'].map(id=>row.panels.find(p=>p.id===id));
 const columns=2,cellW=140,cellH=175,h=Math.ceil(panels.length/columns)*cellH;
 const maxW=Math.max(...panels.map(p=>p.bounds[2]-p.bounds[0])),maxH=Math.max(...panels.map(p=>p.bounds[3]-p.bounds[1])),scale=Math.min(118/maxW,142/maxH);
 const body=panels.map((p,i)=>{const w=(p.bounds[2]-p.bounds[0])*scale,hh=(p.bounds[3]-p.bounds[1])*scale,x=(i%2)*cellW+(cellW-w)/2,y=Math.floor(i/2)*cellH+10;
  const points=p.outline.map(([a,b])=>[x+(a-p.bounds[0])*scale,y+hh-(b-p.bounds[1])*scale]);
  const d=points.map(([a,b],j)=>(j?'L':'M')+a.toFixed(2)+' '+b.toFixed(2)).join(' ')+'Z';
  return'<path d="'+d+'"/><line x1="'+(x+w/2)+'" x2="'+(x+w/2)+'" y1="'+(y+hh*.25)+'" y2="'+(y+hh*.8)+'"/>'+(mini?'':'<text class="paper-panel-label" x="'+(x+w/2)+'" y="'+(y+hh+14)+'">'+esc(panelName(p.id))+'</text>');
 }).join('');
 return'<svg class="'+(mini?'pattern-art':'paper-layout')+'" viewBox="0 0 280 '+h+'" aria-label="'+esc(row.label)+'原裁片轮廓" role="img">'+body+'</svg>';
}
function renderSummary(){
 $('outfit-summary').innerHTML=['top','bottom'].map(role=>{const p=pattern(state.patterns[role]),m=material(state.materials[role]);return'<div class="summary-row '+(p?'':'empty')+'" data-summary-role="'+role+'" role="button" tabindex="0"><small>'+roleName[role]+'</small><strong>'+esc(p?.label||'尚未选择版型')+'</strong>'+(p&&state.step==='patterns'?'<span class="summary-material">材质在下一步选择</span>':p?'<span class="summary-material"><i style="--swatch:'+colours[m.id]+'"></i>'+esc(names[m.id])+'</span>':'')+'</div>';}).join('');
 for(const row of $('outfit-summary').children){const act=()=>{if(state.building)return;state.role=row.dataset.summaryRole;go(state.step==='preview'?'materials':state.step);};row.onclick=act;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act();}};}
}
function renderPaper(){
 const selected=['top','bottom'].map(role=>({role,p:pattern(state.patterns[role])})).filter(x=>x.p);
 $('paper-preview').innerHTML=selected.map(({role,p})=>'<article class="board-pattern" data-active="'+(role===state.role)+'">'+paperSVG(p)+'<span class="paper-caption">'+roleName[role]+' / '+esc(p.label)+'</span></article>').join('');
 $('paper-board').classList.toggle('has-pattern',!!selected.length);
 const heading=$('paper-board').querySelector('h2');heading.textContent=selected.length?(state.step==='materials'?'版型已定，挑选你的材质。':'你的衣服，从这些裁片开始。'):'先选轮廓，再挑质感。';
}
function render(){
 const step=state.step,role=state.role,rows=patterns.filter(p=>p.role===role),isPattern=step==='patterns',isMaterial=step==='materials';
 document.body.dataset.step=step;
 $('selection-title').textContent=isPattern?'从版型开始':isMaterial?'为版型选材质':'搭配已就绪';
 $('selection-note').textContent=isPattern?'上衣和下装分开选，搭配由你决定。':isMaterial?'保留版型，分别选择两件衣物的质感。':'查看动作，也可以继续更换版型和材质。';
 $('catalog-caption').textContent=roleName[role]+(isPattern?'版型':'材质');
 $('catalog-count').textContent=(isPattern?rows.length:materials.filter(m=>state.family==='all'||m.family===state.family).length)+(isPattern?' 款':' 种');
 $('pattern-cards').hidden=!isPattern;$('fabric-cards').hidden=!isMaterial;$('fabric-filters').hidden=!isMaterial;$('preview-selection').hidden=step!=='preview';
 document.querySelector('.catalog-tools').hidden=step==='preview';
 for(const b of document.querySelectorAll('[data-role]'))b.setAttribute('aria-pressed',String(b.dataset.role===role));
 for(const r of['top','bottom'])$(r+'-selection-dot').dataset.selected=!!state.patterns[r];
 for(const b of document.querySelectorAll('button[data-step]')){b.disabled=state.building||(b.dataset.step==='materials'&&!complete())||(b.dataset.step==='preview'&&(!state.applied||state.dirty));b.setAttribute('aria-current',b.dataset.step===step?'step':'false');}
 $('pattern-cards').innerHTML=rows.map(p=>'<button class="pattern-card" data-pattern="'+p.id+'" aria-pressed="'+(state.patterns[role]===p.id)+'">'+paperSVG(p,true)+'<span class="card-copy"><b>'+esc(p.label)+'</b><small>'+esc(p.note)+'</small></span></button>').join('');
 for(const b of $('pattern-cards').children)b.onclick=()=>{if(state.building)return;state.patterns[state.role]=b.dataset.pattern;state.dirty=true;if(state.role==='top'&&!state.patterns.bottom)state.role='bottom';render();};
 const order=['denim','knit','leather'];const fabrics=[...materials].sort((a,b)=>order.indexOf(a.family)-order.indexOf(b.family)).filter(m=>state.family==='all'||m.family===state.family);
 $('fabric-cards').innerHTML=fabrics.map(m=>'<button class="fabric-card" data-material="'+m.id+'" aria-pressed="'+(state.materials[role]===m.id)+'"><span class="fabric-swatch '+m.family+'" style="--swatch:'+colours[m.id]+'"></span><span class="card-copy"><b>'+esc(names[m.id]||m.label)+'</b><small>'+families[m.family]+'</small></span></button>').join('');
 for(const b of $('fabric-cards').children)b.onclick=()=>{if(state.building)return;state.materials[state.role]=b.dataset.material;delete state.parameters[state.role];state.dirty=true;render();};
 for(const b of document.querySelectorAll('[data-family]'))b.setAttribute('aria-pressed',String(b.dataset.family===state.family));
 const p=pattern(state.patterns[role]);$('preview-selection').innerHTML=p?'<article class="preview-summary-card"><small>'+roleName[role]+'</small><h3>'+esc(p.label)+'</h3><p>'+esc(names[state.materials[role]])+'</p><button data-change="patterns">更换版型</button><button data-change="materials">更换材质</button></article>':'';
 for(const b of document.querySelectorAll('[data-change]'))b.onclick=()=>go(b.dataset.change);
 $('next-step').disabled=state.building||!complete();$('next-step').innerHTML=state.building?'正在准备…':isPattern?'下一步 · 选材质 <span>→</span>':isMaterial?(state.applied?'更新试穿':'开始试穿')+' <span>→</span>':'继续调整 <span>↗</span>';
 $('previous-step').hidden=isPattern;$('previous-step').textContent=isMaterial?'返回版型':'返回材质';
 $('selection-progress').textContent=!complete()?'请选择一款上衣和一款下装。':isPattern?'上衣与下装已选好，接下来选择材质。':isMaterial?'材质仅应用于当前选中的'+roleName[role]+'。':'上衣、下装与材质均可独立调整。';
 $('surface-title').textContent=isPattern?'版型案板':isMaterial?'材质案板':'试衣台';$('surface-subtitle').textContent=isPattern?'独立裁片 / 自由搭配':isMaterial?'版型不变 / 对比质感':'走路 / 跑步 / 跳跃';$('board-count').textContent=(isPattern?'01':isMaterial?'02':'03')+' / 03';
 $('board-save').disabled=!complete()||state.building;$('build-overlay').hidden=!state.building;
 renderSummary();renderPaper();
}
function go(step){if(state.building)return;if(step==='materials'&&!complete())return;if(step==='preview'&&(!state.applied||state.dirty))return;state.step=step;if(step!=='preview')window.__MP05__?.pause();render();}
async function apply(){
 if(!complete()||state.building)return;state.building=true;render();
 try{
  const start=performance.now();while(!window.__MP05__?.audit().ready){if(performance.now()-start>180000)throw Error('人物尚未准备完成，请稍后重试');await new Promise(r=>setTimeout(r,100));}
  const result=await __MP05__.compose({topPattern:state.patterns.top,bottomPattern:state.patterns.bottom,topMaterial:state.materials.top,bottomMaterial:state.materials.bottom,roleSettings:state.parameters});
  if(!result)throw Error(__MP05__.audit().error||'试穿未完成，请重试');
  state.applied={patterns:{...state.patterns},materials:{...state.materials}};state.dirty=false;state.step='preview';
  document.querySelector('[data-light='+$('studio-select').value+']').click();
 }catch(e){toast(e.message);}finally{state.building=false;render();}
}
for(const b of document.querySelectorAll('[data-role]'))b.onclick=()=>{if(state.building)return;state.role=b.dataset.role;$('edit-role').value=state.role;$('edit-role').dispatchEvent(new Event('change'));render();};
for(const b of document.querySelectorAll('button[data-step]'))b.onclick=()=>go(b.dataset.step);
for(const b of document.querySelectorAll('[data-family]'))b.onclick=()=>{state.family=b.dataset.family;render();};
$('next-step').onclick=()=>state.step==='patterns'?go('materials'):state.step==='materials'?apply():go('materials');
$('previous-step').onclick=()=>go(state.step==='preview'?'materials':'patterns');
$('studio-select').onchange=()=>document.querySelector('[data-light='+$('studio-select').value+']').click();
$('board-save').onclick=()=>{try{localStorage.setItem('KAOPU_GARMENT_BOARD_R09',JSON.stringify({schema:'kaopu/garment-board-recipe@1',patterns:state.patterns,materials:state.materials,roleSettings:state.parameters}));toast('已保存当前版型与材质配方');}catch{toast('配方未保存，请检查浏览器存储设置');}};
$('board-load').onclick=()=>{try{const saved=JSON.parse(localStorage.getItem('KAOPU_GARMENT_BOARD_R09')||'null');if(!saved)throw Error('还没有保存的配方');for(const role of['top','bottom'])if(pattern(saved.patterns[role])?.role!==role||!material(saved.materials[role]))throw Error('配方中的版型或材质不可用');state.patterns={...saved.patterns};state.materials={...saved.materials};state.parameters=structuredClone(saved.roleSettings||{});state.dirty=true;go('materials');toast('配方已打开，可继续选材质或开始试穿');}catch(e){toast(e.message);}};
addEventListener('garment-selected',e=>{const look=e.detail;state.patterns={top:look.top,bottom:look.bottom};state.materials={top:look.topMaterial,bottom:look.bottomMaterial};const parameters=window.__MP05__?.audit().parameters||[];state.parameters={top:parameters[0]||{},bottom:parameters[1]||{}};state.applied={patterns:{...state.patterns},materials:{...state.materials}};state.step='preview';state.dirty=false;$('edit-role').value=state.role;$('edit-role').dispatchEvent(new Event('change'));render();});
new MutationObserver(()=>{if(state.building)$('build-message').textContent=$('status').textContent;}).observe($('status'),{childList:true,characterData:true,subtree:true});
const timer=setInterval(()=>{const p=window.__MP05__?.debug().physics;$('preview-state').textContent=state.building?'正在准备试穿':state.step!=='preview'?'等待确认版型与材质':p?.running?'实时试穿':'已暂停';},500);
const recovery=document.createElement('div');recovery.className='preview-recovery';recovery.hidden=true;recovery.setAttribute('role','status');recovery.textContent='试穿已暂停。点击下方“重置”后可继续。';document.querySelector('.viewport').appendChild(recovery);
const recoveryTimer=setInterval(()=>{recovery.hidden=state.step!=='preview'||!window.__MP05__?.debug().physics?.lastError;},500);
addEventListener('pagehide',()=>clearInterval(recoveryTimer),{once:true});
addEventListener('pagehide',()=>clearInterval(timer),{once:true});
window.GarmentBoard={state:()=>structuredClone(state),patterns:()=>patterns,materials:()=>materials,go,apply};render();

if(new URL(location.href).searchParams.get('dev')==='1')document.querySelector('.technical-drawer').hidden=false;
