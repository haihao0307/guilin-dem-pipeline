import Knowledge from './production-knowledge-r09.js';
import registry from '../data/production-cards-r09.json';

// Event-driven production context: never evaluated in the fish animation loop.
// These cards describe work permissions, not accepted animal anatomy or motion.
export function mountProductionContext({getFishId, labels}) {
  const panel=document.getElementById('framework'), body=document.getElementById('knowledgeBody');
  const tabs=document.getElementById('knowledgeStages'), title=document.getElementById('knowledgeFish');
  const status=document.getElementById('knowledgeStatus');
  let stage='behavior', current=null, renders=0;
  const componentNames={surface:'离线来源与紧凑成品',axis:'中心轴与截面',fins:'鳍根与鳍区',eyes:'眼窝与视轴',mouth:'下颌与口部',gills:'鳃部',envelope:'完整动画包络',gait:'推进与节律',physicalUnits:'真实物理尺寸'};
  const statusNames={SOURCE_MEASURED:'来源已测',SOURCE_DERIVED:'来源推导',ENGINEERING_CANDIDATE:'工程候选',CONFIRMED_ABSENT:'证实缺失',UNKNOWN:'待确认',HOLD_LOCAL:'局部待测',MEASUREMENT_REQUIRED:'需要测量',SOURCE_ENTRY_REQUIRED:'需要完整来源',INVALID_CARD:'卡片无效'};
  const append=(parent,tag,text,className)=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;parent.append(el);return el;};
  const describe=v=>typeof v==='string'?v: v?.text||v?.description||(v?.label?[componentNames[v.label]||v.label,v.status?statusNames[v.status]||v.status:'',v.met===false?'当前需补证据':''].filter(Boolean).join(' · '):JSON.stringify(v));
  function section(name,values){if(!values?.length)return;append(body,'h3',name);const list=append(body,'ul','');for(const value of values)append(list,'li',describe(value));}
  function refresh() {
    const id=getFishId(),card=registry.cards.find(c=>c.id===id||c.specimenId===id);
    current=Knowledge.resolve(card||Knowledge.createCard(id,labels[id]?.[0]||id),stage);
    renders++; title.textContent=labels[id]?.[0]||id;
    status.textContent=current.readyToBuild?'当前工位可开展 · 尚未验收':'先补当前工位的测量或证据';
    status.dataset.ready=String(!!current.readyToBuild);
    body.replaceChildren();
    append(body,'p','共性规则随工位加载；源差异随鱼型加载。未知结构保留原姿态，局部等待测量。','knowledge-intro');
    section('当前来源与差异',[current.source?.title?('来源：'+current.source.title):'',current.identity?.targetArchetype?('制作母型：'+current.identity.targetArchetype):'',current.identity?.largestDeviation?('当前最大偏差：'+current.identity.largestDeviation):''].filter(Boolean));
    section('本工位的共性',current.rules);
    section('数学关系',current.formulas?.map(f=>typeof f==='string'?f:[f.expression||f.formula||f.text||f.label, f.units?'单位：'+(typeof f.units==='string'?f.units:JSON.stringify(f.units)):'',(f.type||f.kind)?'关系类型：'+({CURRENT_IMPLEMENTATION:'当前实现',MATHEMATICAL_CONTRACT:'数学接口约束'}[f.type]||f.type||f.kind):'',f.meaning||'',f.owner?'函数：'+(typeof f.owner==='string'?f.owner:JSON.stringify(f.owner)):''].filter(Boolean).join(' · ')));
    section('该来源的准备与限制',current.requirements||current.required);
    const requiredKeys=new Set((current.requirements||[]).map(r=>r.path?.split('.')[1]).filter(Boolean));
    section('该来源的测量与差异',Object.entries(current.evidence||{}).filter(([key])=>requiredKeys.has(key)||stage==='cranial'&&['eyes','mouth','gills'].includes(key)).map(([key,m])=>(componentNames[key]||key)+' · '+(statusNames[m.status]||m.status)+' · '+(m.summary||'')+(m.reference?' · '+m.reference:'')));
    if(stage==='cranial')section('部件分别放行',Object.entries(current.components||{}).map(([key,m])=>(componentNames[key]||key)+' · '+(statusNames[m.status]||m.status)+' · '+m.action));
    section('当前阻塞',current.blocked);
    section('全卡待确认（不全部阻塞当前工位）',current.unknowns);
    section('验证与旧问题',current.checks||current.verification);
    append(body,'p','可开展只表示当前制作资料足够；不代表真实物种、自然运动或用户视觉验收已经通过。','knowledge-note');
    for(const b of tabs.querySelectorAll('button')){const active=b.dataset.productionStage===stage;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
    panel.dataset.productionStage=stage;panel.dataset.sourceId=id;
    return current;
  }
  function enter(next,{open=false}={}) {
    if(!Knowledge.stages.some(s=>s.id===next))throw Error('Unknown production stage: '+next);
    stage=next;refresh();if(open)panel.classList.add('open');return current;
  }
  for(const s of Knowledge.stages){const button=append(tabs,'button',s.label,'subtle');button.type='button';button.dataset.productionStage=s.id;button.onclick=()=>enter(s.id);}
  function open(){refresh();panel.classList.add('open');document.getElementById('closeFramework').focus({preventScroll:true});}
  function close(){panel.classList.remove('open');}
  document.getElementById('frameworkButton').onclick=open;
  document.getElementById('knowledgeButton').onclick=open;
  document.getElementById('closeFramework').onclick=close;
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){close();document.getElementById('knowledgeButton').focus({preventScroll:true});}});
  refresh();
  return {enter,refresh,open,close,registry,knowledge:Knowledge,get stage(){return stage;},get current(){return current;},get renders(){return renders;}};
}
