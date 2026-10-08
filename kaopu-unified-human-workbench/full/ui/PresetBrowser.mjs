import {PRESETS, STAGES, createPresetState, presetRecord} from './PresetCatalogue.mjs?v=presets-r01-20261008';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const decimals=x=>Number(x).toFixed(2);
export function measurePerson(model){
 const p=model.positions;let lo=Infinity,hi=-Infinity,headLo=Infinity,headHi=-Infinity;
 for(let i=2;i<p.length;i+=3){lo=Math.min(lo,p[i]);hi=Math.max(hi,p[i]);if(i>=model.bodyCount*3){headLo=Math.min(headLo,p[i]);headHi=Math.max(headHi,p[i]);}}
 return {heightCM:(hi-lo)*100,headRatio:(hi-lo)/(headHi-headLo),definition:'Z-up canonical vertex bounding box; neutral pose; head includes shared head and neck, so not an anatomical crown-to-chin head count.'};
}
export function mountPresetBrowser(root,{onSelect,onAdvanced,onArchive,onReset,onRecord}={}){
 let stage='all',query='',ready=false,activeId=null,record=null;
 root.replaceChildren();
 const intro=el('div','preset-intro'),eyebrow=el('span','eyebrow','CHARACTER LIBRARY / 01'),line=el('div','preset-heading'),title=el('h1','','先选一个人'),advanced=el('button','advanced-toggle','全部参数 ↗');advanced.id='open-all-parameters';advanced.setAttribute('aria-expanded','false');advanced.setAttribute('aria-controls','parameters');line.append(title,advanced);intro.append(eyebrow,line,el('p','muted','36 组真实形体。儿童到老人，高矮、胖瘦与体格，一点切换。'));
 const filters=el('div','preset-filters');filters.setAttribute('aria-label','按年龄形态筛选');for(const s of[{id:'all',label:'全部'},...STAGES]){const b=el('button','preset-filter',s.label);b.dataset.stage=s.id;b.setAttribute('aria-pressed',String(s.id==='all'));filters.append(b);}
 const search=el('input','preset-search');search.type='search';search.placeholder='找一个体型，如：儿童、胖、中年、瘦老人';search.setAttribute('aria-label','搜索人物预设');
 const count=el('div','preset-count','36 个人物预设 · 同一个模型'),grid=el('div','preset-grid');grid.setAttribute('aria-label','人物形体预设');
 const lower=el('div','preset-lower'),current=el('div','current-preset','尚未载入模型'),metrics=el('div','preset-metrics','点击任一人物开始载入'),detail=el('details','preset-details'),summary=el('summary','','查看这组真实参数'),values=el('div','preset-values'),source=el('p','muted','原生 Anny 形态与局部参数 → 同一共同模型；头身沿用现有联动。年龄是形态插值，未标定现实岁数。');detail.append(summary,values,source);const actions=el('div','preset-file-actions');
 for(const[action,label]of[['save','保存档案'],['load','恢复档案'],['reset','全部默认']]){const b=el('button','',label);b.dataset.presetAction=action;actions.append(b);}const exportRecord=el('button','preset-record','导出这组参数记录');exportRecord.hidden=true;detail.append(exportRecord);lower.append(current,metrics,detail,actions);root.append(intro,filters,search,count,grid,lower);
 const cards=new Map();for(const preset of PRESETS){const b=el('button','preset-card');b.dataset.preset=preset.id;b.setAttribute('aria-pressed','false');b.setAttribute('aria-label',preset.label+'，'+preset.description);const picture=el('div','preset-picture'),img=el('img');img.src=new URL('../assets/presets-r01/'+preset.id+'.webp',import.meta.url).href;img.alt='';img.width=192;img.height=248;img.loading='lazy';img.decoding='async';picture.append(img,el('span','preset-age',preset.stageLabel));const name=el('strong','preset-name',preset.label),meta=el('span','preset-meta',preset.genderLabel+' · '+preset.buildLabel);b.append(picture,name,meta);b.title=preset.description;b.addEventListener('click',()=>onSelect?.(preset.id));cards.set(preset.id,b);grid.append(b);}
 function render(){let shown=0;const q=query.trim().toLowerCase();for(const p of PRESETS){const card=cards.get(p.id);card.hidden=!((stage==='all'||p.stage===stage)&&(!q||[p.label,p.description,p.stageLabel,p.buildLabel,p.genderLabel].join(' ').toLowerCase().includes(q)));if(!card.hidden)shown++;}count.textContent=shown?`${shown} / ${PRESETS.length} 个人物 · 缩略图由本模型实渲`:'没有匹配人物，试试“儿童”或“中年”';}
 const onFilter=e=>{const b=e.target.closest('[data-stage]');if(!b)return;stage=b.dataset.stage;for(const f of filters.children)f.setAttribute('aria-pressed',String(f===b));render();};filters.addEventListener('click',onFilter);search.addEventListener('input',()=>{query=search.value;render();});advanced.addEventListener('click',()=>onAdvanced?.());actions.addEventListener('click',e=>{const b=e.target.closest('[data-preset-action]');if(!b)return;if(b.dataset.presetAction==='reset')onReset?.();else onArchive?.(b.dataset.presetAction);});exportRecord.addEventListener('click',()=>record&&onRecord?.(record));
 return {
  setBusy(id){const p=PRESETS.find(p=>p.id===id);current.textContent=p?'正在切换：'+p.label:'正在载入共同模型…';root.setAttribute('aria-busy','true');},
  sync(controller){ready=!!controller;root.setAttribute('aria-busy','false');advanced.disabled=!ready;for(const b of actions.children)b.disabled=!ready;if(!ready)return;
   const state=controller.state();activeId=controller.presetId||null;const p=PRESETS.find(p=>p.id===activeId);for(const[id,b]of cards)b.setAttribute('aria-pressed',String(id===activeId));current.textContent=p?p.label:'自定义人物 · 当前参数';const m=measurePerson(controller.model);metrics.textContent=`模型几何身高 ${m.heightCM.toFixed(1)} cm · 25,417 固定顶点`;metrics.title='按原生米制坐标计算共同网格的最高点与最低点差；预设使用中立姿态，不是现实人体测量。';values.replaceChildren();
   const labels={age:'年龄形态',gender:'性别形态',height:'身高形态',weight:'体重形态',muscle:'肌肉形态',proportions:'身体比例'};for(const[key,label]of Object.entries(labels)){const n=el('div','preset-value');n.append(el('span','',label),el('b','',decimals(state.anny.phenotypes[key])));values.append(n);}const locals=Object.entries(state.anny.localChanges).filter(([,v])=>v!==0);if(locals.length){values.append(el('p','local-values','局部参数 '+locals.map(([k,v])=>k+' '+decimals(v)).join(' · ')));}record=p?presetRecord(p.id,controller.defaults):null;exportRecord.hidden=!record;
  },
  diagnostics(){return{count:PRESETS.length,visible:[...cards.values()].filter(b=>!b.hidden).length,activeId,stage,query,ready};},
  destroy(){root.replaceChildren();}
 };
}
