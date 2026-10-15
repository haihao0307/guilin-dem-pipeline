import{validateRequest}from'./parameter-request-r0431.mjs';
/** All controls route to original pattern generation. No render-scale fitting knobs. */
const names={'meta':'构成','shirt':'衣身','collar':'领型','sleeve':'袖型','left':'不对称一侧','pants':'裤装','skirt':'基础裙','pencil-skirt':'合体裙','flare-skirt':'展开裙','godet-skirt':'插片裙','levels-skirt':'分层裙','waistband':'腰头'};
const labels={'shirt.length':'衣长比例','shirt.width':'衣身宽度','shirt.flare':'衣摆展开','sleeve.length':'袖长比例','sleeve.end_width':'袖口宽度','pants.length':'裤长比例','pants.width':'裤腿宽度','pants.flare':'裤脚展开','pants.rise':'裤腰高度','skirt.length':'裙长比例','skirt.ruffle':'腰部褶量','waistband.width':'腰头高度','collar.width':'领口宽度','collar.fc_depth':'前领深度','collar.bc_depth':'后领深度','levels-skirt.level_ruffle':'层间褶量'};
const get=(d,path)=>path.split('.').reduce((v,k)=>v[k],d).v;
export async function mountParameterEditor(host,{readCurrentPaper,apply,onState=()=>{}}){
 const[schema,audit]=await Promise.all([fetch('parameter-schema.json').then(r=>r.json()),fetch('PARAMETER_AUDIT_R043.json').then(r=>r.json())]);
 let paper=null,values={},easeCm=0,waistEaseCm=0,busy=false,workerLocked=false,epoch=0;const byPath=new Map(schema.parameters.map(p=>[p.path,p])),evidence=new Map(audit.rows.map(p=>[p.path,p]));
 host.innerHTML='<div class="parameter-heading"><strong>原生制版参数</strong><span>改裁片，不缩放人物或成衣</span></div><div class="ease-presets"><button data-ease="0">原版</button><button data-ease="3">舒适松量</button><button data-ease="6">宽松</button></div><label>胸 / 臀制版加放量（cm）<input id="garment-ease" type="number" min="0" max="12" step="0.5" value="0"></label><label>腰头加放量（cm）<input id="waist-ease" type="number" min="0" max="6" step="0.5" value="0"></label><p class="muted">腰头默认不随胸臀加放，防止宽松款失去腰部支承。加大腰围可能需要腰带或松紧结构。</p><details id="all-native-parameters"><summary>全部原生参数 · <span id="parameter-total"></span>项</summary><input id="parameter-search" type="search" placeholder="搜索袖长、裤腰或参数名称"><div id="native-parameter-fields"></div></details><div class="parameter-actions"><button id="apply-native-parameters">生成当前参数的新纸样</button><button id="reset-native-parameters">恢复原款参数</button></div><p id="parameter-feedback" role="status">参数需满足当前领型、袖型和版式的启用条件；纸样变化不等于穿着检查通过。</p>';
 const fields=host.querySelector('#native-parameter-fields'),feedback=host.querySelector('#parameter-feedback');host.querySelector('#parameter-total').textContent=schema.parameters.length;
 function render(){if(!paper)return;const groups=new Map();for(const p of schema.parameters){const group=p.path.split('.')[0];if(!groups.has(group))groups.set(group,[]);groups.get(group).push(p)}fields.replaceChildren();
  for(const[group,params]of groups){const box=document.createElement('details'),summary=document.createElement('summary');summary.textContent=(names[group]||group)+' · '+params.length;box.append(summary);
   for(const p of params){const label=document.createElement('label');label.className='parameter-row';label.dataset.parameter=p.path;const title=document.createElement('span');title.textContent=labels[p.path]||p.path;title.title=p.path;let input;
    if(p.type==='bool'){input=document.createElement('input');input.type='checkbox';input.checked=values[p.path]??get(paper.design,p.path)}
    else if(p.choices){input=document.createElement('select');for(const v of p.choices){const o=document.createElement('option');o.value=JSON.stringify(v);o.textContent=v===null?'无 / 关闭':String(v);input.append(o)}input.value=JSON.stringify(Object.hasOwn(values,p.path)?values[p.path]:get(paper.design,p.path));}
    else{input=document.createElement('input');input.type='number';input.min=Math.min(...p.samplingRange);input.max=Math.max(...p.samplingRange);input.step=p.type==='int'?1:'any';input.value=Object.hasOwn(values,p.path)?values[p.path]:get(paper.design,p.path);}
    input.dataset.path=p.path;input.disabled=busy||workerLocked;input.onchange=()=>{if(busy||workerLocked)return;const v=p.type==='bool'?input.checked:p.choices?JSON.parse(input.value):(input.value.trim()===''?NaN:Number(input.value));values[p.path]=v;feedback.textContent='参数已修改；生成新纸样后才能重新缝合。旧结果不会当作新参数成衣。';onState(state());};
    const hint=document.createElement('small');const ev=evidence.get(p.path);hint.textContent=ev?.status==='verified-with-explicit-activation'?'条件参数已实测 · 查看启用依赖':ev?.example?'已有原程序变形实测 · '+ev.example.preset:'尚未证明生效';hint.title=ev?.example?.activationOverrides?JSON.stringify(ev.example.activationOverrides):'裁片变化不等于成衣质量通过。';label.append(title,input,hint);box.append(label);
   }fields.append(box);
  }
 }
 function state(){return{parameterCount:schema.parameters.length,changedParameters:structuredClone(values),easeCm,waistEaseCm,busy:busy||workerLocked,workerLocked,sourceProgram:'original-GarmentCode-pattern-engine',personScaleControls:0,geometryEffectClaimed:false};}
 function synchronize(request={}){
  const q=validateRequest(schema,request);values=q.parameters;easeCm=q.easeCm;waistEaseCm=q.waistEaseCm;
  host.querySelector('#garment-ease').value=easeCm;host.querySelector('#waist-ease').value=waistEaseCm;
  render();onState(state());return state();
 }
 function setBusy(value){
  busy=!!value;for(const id of ['apply-native-parameters','reset-native-parameters','garment-ease','waist-ease'])host.querySelector('#'+id).disabled=busy||workerLocked;
  for(const button of host.querySelectorAll('[data-ease]'))button.disabled=busy||workerLocked;
  render();
 }
 async function load(seed=null){
  const q=validateRequest(schema,seed===null?{}:seed),ticket=++epoch;
  try{const next=await readCurrentPaper();if(ticket!==epoch)return false;paper=next;setBusy(false);synchronize(q);return true;}
  catch(e){if(ticket!==epoch)return false;feedback.textContent=e.message;throw e;}
 }
 async function generate(){
  if(busy||workerLocked)return;let ticket=epoch;
  try{if(!paper&&!await load())return;ticket=epoch;validateRequest(schema,{parameters:values,easeCm,waistEaseCm});setBusy(true);onState(state());
   feedback.textContent='原制版程序正在生成新裁片；首次需载入原 Python 运行时。';await apply(state());
  }catch(e){if(ticket===epoch)feedback.textContent=e.message;}
  finally{if(ticket===epoch){setBusy(false);onState(state());}}
 }
 async function loadFromControl(){try{await load();}catch{/* load already reports errors for its own epoch. */}}
 host.querySelector('#garment-ease').onchange=e=>{if(busy||workerLocked)return;easeCm=e.target.value.trim()===''?NaN:Number(e.target.value);onState(state())};host.querySelector('#waist-ease').onchange=e=>{if(busy||workerLocked)return;waistEaseCm=e.target.value.trim()===''?NaN:Number(e.target.value);onState(state())};
 for(const b of host.querySelectorAll('[data-ease]'))b.onclick=async()=>{if(busy||workerLocked)return;try{if(!paper&&!await load())return;easeCm=Number(b.dataset.ease);host.querySelector('#garment-ease').value=easeCm;feedback.textContent='加放量已准备；点击生成新纸样后，由原求解器重新缝合。';onState(state());}catch{/* read errors are already reported. */}};
 host.querySelector('#all-native-parameters').ontoggle=async e=>{if(e.target.open&&!paper)await loadFromControl()};
 host.querySelector('#parameter-search').oninput=e=>{const q=e.target.value.trim().toLowerCase();for(const n of fields.querySelectorAll('.parameter-row')){n.hidden=q&&!n.textContent.toLowerCase().includes(q)&&!n.dataset.parameter.toLowerCase().includes(q);if(q&&!n.hidden)n.parentElement.open=true;}};
 host.querySelector('#apply-native-parameters').onclick=generate;host.querySelector('#reset-native-parameters').onclick=loadFromControl;
 return{load,state,generate,synchronize,lock:value=>{const next=!!value;if(next!==workerLocked){workerLocked=next;setBusy(busy);}},restoreRequest:request=>load(request),
  set:async(parameters,ease=0,waist=0)=>{if(busy||workerLocked)throw Error('原制版程序正在计算，请先取消或等待当前请求。');const q=validateRequest(schema,{parameters,easeCm:ease,waistEaseCm:waist});if(!paper&&!await load())return state();return synchronize(q)},
  feedback:text=>feedback.textContent=text,
  invalidate:()=>{epoch++;paper=null;values={};easeCm=waistEaseCm=0;setBusy(false);fields.replaceChildren();host.querySelector('#garment-ease').value=0;host.querySelector('#waist-ease').value=0;feedback.textContent='已切换原款式；参数编辑将从该款原纸样读取。';onState(state());},
  schema:()=>structuredClone(schema)};
}
