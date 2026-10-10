"""Update existing gallery state reporting, without changing its renderer or geometry."""
from pathlib import Path
import re
P=Path(__file__).resolve().parent
p=P/'app.mjs';s=p.read_text()
if "from './card-state-r042.mjs'" not in s:
 s="import {cardState,matchesQuality,summarizeCards} from './card-state-r042.mjs';\nlet qualityFilter='all';const thumbnailLoadErrors=new Set();\n"+s
 s=s.replace("function rows(){return catalogue.rows.filter(r=>(category", "function rows(){return catalogue.rows.filter(r=>matchesQuality(cardState(r.id,cache,readiness),qualityFilter)&&(category")
 a=s.index('function cards(){');b=s.index('\nfunction categories()',a)
 s=s[:a]+r'''function cards(){
 const counts=summarizeCards(catalogue.rows,cache,readiness);
 const choices=[['all','全部'],['static-pass','静态检查通过'],['needs-repair','有结果 / 需修复'],['no-result','无完整结果']];
 $('quality-filters').innerHTML=choices.map(([id,label])=>`<button data-quality="${id}" aria-pressed="${qualityFilter===id}">${label} ${counts[id]}</button>`).join('');
 for(const b of $('quality-filters').querySelectorAll('button'))b.onclick=()=>{qualityFilter=b.dataset.quality;cards()};
 const rank=r=>cache.rows[r.id]?.qualityPassed?0:cache.rows[r.id]?1:2;
 const list=rows().sort((a,b)=>rank(a)-rank(b));
 $('count').textContent=`当前 ${list.length} / ${counts.all} 款 · ${counts['static-pass']} 款静态检查通过 · ${counts['needs-repair']} 款有结果但需修复 · ${counts['no-result']} 款无完整结果`;
 $('cards').innerHTML=list.map(r=>{
  const e=cache.rows[r.id],st=cardState(r.id,cache,readiness);
  return `<button class="card" data-id="${r.id}" data-state="${st.kind}" aria-pressed="${current?.id===r.id}" title="${esc(st.reason)}"><div class="thumb ${st.kind==='static-pass'?'static-pass':''}">${e&&e.thumbReady!==false?`<img src="assets/results/${esc(e.thumb)}" alt="${esc(r.name)}的实际求解结果"><span>${esc(st.label)}</span>`:`<div class="pending rejected"><small>不是加载等待</small><b>${esc(st.label)}</b><p>${esc(st.reason)}</p><small>原纸样保留 · 点击查看 / 重新计算</small></div>`}</div><strong>${r.id} ${esc(r.name)}</strong><small>${r.panelCount} 裁片 / ${r.seamCount} 缝边 · ${r.category}</small></button>`;
 }).join('');
 for(const b of $('cards').querySelectorAll('button')){
  b.onclick=()=>select(b.dataset.id);
  const img=b.querySelector('img');if(img)img.onerror=()=>{
   thumbnailLoadErrors.add(b.dataset.id);const host=b.querySelector('.thumb');
   host.innerHTML='<div class="pending rejected"><b>缩略图资源读取失败</b><p>这与求解中止不同。点击本卡仍可检查三维结果；刷新可重试资源读取。</p></div>';
  };
 }
}
'''+s[b:]
 s=s.replace("version:'R04-SOURCE-3'","version:'R04-SOURCE-4'")
 s=s.replace('actualResultCount:Object.keys(cache.rows).length','panelSideFixApplied:true,qualityFilter,thumbnailLoadErrors:[...thumbnailLoadErrors],actualResultCount:Object.keys(cache.rows).length')
 p.write_text(s)
p=P/'index.html';s=p.read_text().replace('R04.1 · 原人物 / 原裁缝','R04.2 · 修正后袖 / 袖口摆片')
if 'id="quality-filters"' not in s:s=s.replace('<p id="count"></p>','<nav id="quality-filters" aria-label="按实际计算结果筛选"></nav><p id="count"></p>')
s=re.sub(r'<div class="correction">.*?</div>','<div class="correction">继续使用同一人物和原裁缝程序。本版修正后袖、后袖口被摆到前侧的错误；没有完整结果的款式直接显示中止原因，不再显示成“还在加载”。静态检查通过仍不等于真实布料或动态穿着认证。</div>',s,count=1)
p.write_text(s)
p=P/'style.css';s=p.read_text()
if 'R042_REAL_CARD_STATE' not in s:s+='''\n/* R042_REAL_CARD_STATE */\n#quality-filters{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}#quality-filters button{font-size:11px;padding:7px 9px}.pending{padding:15px;text-align:center}.pending b{font-size:14px}.pending p{font-size:11px;line-height:1.9;overflow-wrap:anywhere;margin:12px 0;color:#c7b7aa}.pending small{padding:0;font-size:10px}.card[data-state=solve-aborted] .thumb,.card[data-state=material-blocked] .thumb{background:#302d2b}@media(max-width:760px){.pending{padding:8px}.pending b{font-size:10px}.pending p{font-size:9px;line-height:1.6;margin:6px 0}.pending small{font-size:8px}#quality-filters button{font-size:10px}}\n'''
p.write_text(s)
print('R042_CARD_STATES_APPLIED')
