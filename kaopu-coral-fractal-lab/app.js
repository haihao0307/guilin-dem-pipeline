'use strict';
(()=>{
const $=id=>document.getElementById(id), frame=$('bench');let entries=[],selected=null,current=null,source='',request=0,mode='coral';
const clone=x=>JSON.parse(JSON.stringify(x));
function once(text,old,replacement){const n=text.split(old).length-1;if(n!==1)throw Error('锚点接口不匹配：'+old.slice(0,55)+' ('+n+')');return text.replace(old,replacement);}
function adapt(html,score){
 let out=html;
 out=once(out,'function generate(s){score={...s};const out=[];', 'function generateAnchor(s){score={...s};const out=[];');
 out=once(out,'function makeGeometry(branches,progress=1){', 'function generate(s){score={...s};return CoralFunctions.generate(s,generateAnchor);}\nfunction makeGeometry(branches,progress=1){');
 out=once(out,'let count=depth===0?6:(depth===1?4:3),made=0;', 'let count=s.branchCounts?.[depth]??(depth===0?6:(depth===1?4:3)),made=0;');
 out=once(out,'target=V.norm(V.mix(initial,target,e));dir=', 'target=V.norm(V.mix(initial,target,e));target=CoralFunctions.direction(s,pos,target,depth,u);dir=');
 out=once(out,'function radiusAt(b,u){let p=', "function radiusAt(b,u){if(b.radiusProfile==='tentacle')return b.r0*Math.pow(Math.max(.04,1-u),.58);let p=");
 out=once(out,'let geom=makeGeometry(data.branches);','let geom=CoralFunctions.geometry(data,makeGeometry,score);');
 out=once(out,'let points=data.branches.flatMap(b=>b.points),ymax=', 'let points=data.branches.flatMap(b=>b.points).concat(data.landmarks||[]),ymax=');
 out=once(out,'${data.branches.length} 条函数分枝','${data.parts??data.branches.length} 个生长单元');
 out=once(out,"let target=[0,.33,0],dd=dist*Math.max(1,1.12/(box.width/box.height)),eye=[Math.sin(yaw)*Math.cos(pitch)*dd, .33+Math.sin(pitch)*dd,Math.cos(yaw)*Math.cos(pitch)*dd];", "let target=data.bounds?.center||[0,.33,0],dd=dist*Math.max(.45,(data.bounds?.radius||.5)/.43)*Math.max(1,1.12/(box.width/box.height)),eye=[target[0]+Math.sin(yaw)*Math.cos(pitch)*dd,target[1]+Math.sin(pitch)*dd,target[2]+Math.cos(yaw)*Math.cos(pitch)*dd];");
 out=once(out,'function bind(k){', "window.CoralLab={apply(s){CoralFunctions.validate(s);score=JSON.parse(JSON.stringify(s));playing=false;growth=1;$('growth').value=1;rebuild();},getScore:()=>JSON.parse(JSON.stringify(score)),getData:()=>data,replay(){growth=0;playing=true;},progress(v){playing=false;growth=clamp(v);$('growth').value=growth;updateLabels();}};\nfunction bind(k){");
 const scoreRegex=/let score=\{schema:'KAOPU\.branch-wave\.study-01'[^\n]+;/;
 if(!scoreRegex.test(out))throw Error('找不到冻结锚点的谱初始化');
 out=out.replace(scoreRegex,'let score='+JSON.stringify(score).replace(/</g,'\\u003c')+';');
 const base=new URL('./',location.href).href;
 out=out.replace('</head>',`<base href="${base}"><style>header,.panel,.caption{display:none!important}.layout{display:block;min-height:0}.stage{height:100vh;min-height:300px}.foot{bottom:16px}.foot strong{font-size:11px}.tools{top:15px}.axis{right:16px}.error{font-size:12px}@media(max-width:760px){.stage{height:100vh;min-height:300px}.foot{bottom:12px}}</style></head>`);
 out=once(out,"<script>\n'use strict';",`<script src="${base}coral-functions.js"><\/script><script>\n'use strict';`);
 out=out.replace('>中心轴</button>','>结构线</button>').replace('单指拖动旋转 · 双指缩放 · 改参数后仍是同一颗种子','单指旋转 · 双指缩放 · 结构研究 / 非物种复刻');
 return out;
}
window.CoralLoader={adapt};
function error(e){$('loading').hidden=false;$('loading').textContent='载入未完成：'+e.message+'。原台入口仍保留在下方。';$('status').textContent=e.message;console.error(e);}
function fields(s){
 if(s.operator==='branch')return [['分枝角度','angle',18,78,1,'°'],['分枝波幅','wave',0,.45,.01,''],['基部半径','radius',.008,.06,.001,' m']];
 if(s.operator==='radial')return [['触手数量','radial.count',24,120,3,''],['触手长度','radial.length',.08,.3,.01,' m'],['触手外展','radial.spread',.01,.13,.005,' m']];
 if(s.operator==='sheet')return [['卷曲薄层','sheet.layers',2,7,1,' 层'],['边缘褶皱','sheet.fold',0,.065,.001,' m'],['薄层厚度','sheet.thickness',.001,.012,.001,' m']];
 return [['迷宫密度','massive.frequency',3,14,.1,''],['真实脊高','massive.ridgeHeight',0,.05,.001,' m'],['脊谷宽度','massive.ridgeWidth',.16,.65,.01,'']];
}
const get=(o,path)=>path.split('.').reduce((a,k)=>a[k],o);
const set=(o,path,v)=>{let keys=path.split('.'),last=keys.pop();keys.reduce((a,k)=>a[k],o)[last]=v;};
function info(){
 $('tag').textContent=selected.tag;$('name').textContent=selected.name;$('lead').textContent=selected.lead;$('method').textContent=selected.method;$('missing').textContent=selected.missing;
 $('references').replaceChildren();for(const r of selected.refs){let a=document.createElement('a');a.href=r.url;a.target='_blank';a.rel='noopener';a.textContent='真实参照 ↗ '+r.name;$('references').append(a);}
 $('controls').replaceChildren();for(const [label,path,min,max,step,unit]of fields(current)){let box=document.createElement('div');box.className='control';let lab=document.createElement('label'),o=document.createElement('output'),range=document.createElement('input');lab.append(document.createTextNode(label),o);range.type='range';range.min=min;range.max=max;range.step=step;range.value=get(current,path);range.dataset.path=path;const fmt=()=>o.textContent=Number(range.value).toFixed(step>=1?0:step>=.01?2:3)+unit;fmt();let timer;range.oninput=()=>{fmt();clearTimeout(timer);timer=setTimeout(()=>{set(current,path,+range.value);apply();},85);};box.append(lab,range);$('controls').append(box);}
 let box=document.createElement('div');box.className='control';box.innerHTML='<label>结构展开（不是年龄）<output id="progressValue">100%</output></label><input id="progress" type="range" min="0" max="1" step=".01" value="1">';$('controls').append(box);$('progress').oninput=()=>{frame.contentWindow.CoralLab?.progress(+$('progress').value);$('progressValue').textContent=Math.round(+$('progress').value*100)+'%';};
 scoreView();
}
function scoreView(){$('score').textContent=JSON.stringify(current,null,2);}
function apply(){try{CoralFunctions.validate(current);if(mode!=='coral')return;frame.contentWindow.CoralLab?.apply(current);scoreView();updateStatus();}catch(e){error(e);}}
function updateStatus(){let w=frame.contentWindow,s=w?.studyState,b=w?.CoralLab?.getData().bounds;if(s&&b){$('status').textContent=`${s.renderer} · 宽 ${(b.max[0]-b.min[0]).toFixed(2)} m · 高 ${(b.max[1]-b.min[1]).toFixed(2)} m · ${Math.round(s.triangles).toLocaleString()} 临时三角面`;window.coralState={ready:s.ready,id:current.id,renderer:s.renderer,bounds:b,triangles:s.triangles,sourceCommit:'967f975e2f10e5895b4c8a09005a2d8d6e313dc1',speciesApproved:false};}}
async function loadCoral(){
 mode='coral';document.body.classList.remove('native');$('returnBtn').hidden=true;const id=++request;$('loading').hidden=false;$('loading').innerHTML='<b>正在从同一函数锚点重新演奏…</b><span>谱只保存规则；不会载入成品模型。</span>';
 const doc=adapt(source,current);frame.removeAttribute('src');frame.onload=()=>{if(id!==request)return;let n=0;const check=()=>{if(id!==request)return;const w=frame.contentWindow;if(w?.studyState?.ready&&w?.CoralLab){$('loading').hidden=true;updateStatus();}else if(++n<100)setTimeout(check,80);else error(Error('三维未通过启动检查'));};check();};frame.srcdoc=doc;
}
function select(id){selected=entries.find(e=>e.id===id);if(!selected)throw Error('未知谱');current=clone(selected.score);info();document.querySelectorAll('#types button').forEach(b=>b.classList.toggle('active',b.dataset.id===id));return loadCoral();}
function native(path){mode='native';++request;document.body.classList.add('native');$('returnBtn').hidden=false;$('loading').hidden=false;$('loading').textContent='正在打开完整原台…';frame.onload=()=>{$('loading').hidden=true;};frame.removeAttribute('srcdoc');frame.src='source-tree/'+path+'/index.html';}
$('replay').onclick=()=>{frame.contentWindow.CoralLab?.replay();$('progress').value=0;$('progressValue').textContent='正在展开';};
$('seed').onclick=()=>{current.seed=(current.seed+7919)>>>0;apply();};
$('returnBtn').onclick=()=>loadCoral();document.querySelectorAll('[data-native]').forEach(b=>b.onclick=()=>native(b.dataset.native));
$('export').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(current,null,2)],{type:'application/json'}));a.href=url;a.download='KAOPU_CORAL_'+current.id+'_SCORE.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);};
$('import').onclick=()=>$('file').click();$('file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>50000)throw Error('谱超过50KB限制');let s=JSON.parse(await f.text());CoralFunctions.validate(s);current=s;selected=entries.find(e=>e.score.operator===s.operator)||entries[0];info();await loadCoral();}catch(e){error(e);}finally{$('file').value='';}};
Promise.all([fetch('scores.json').then(r=>{if(!r.ok)throw Error('谱目录 HTTP '+r.status);return r.json();}),fetch('source-tree/anchor-r01/index.html').then(r=>{if(!r.ok)throw Error('冻结锚点 HTTP '+r.status);return r.text();})]).then(([catalog,html])=>{entries=catalog.entries;source=html;for(const e of entries){let b=document.createElement('button');b.textContent=e.name;b.dataset.id=e.id;b.onclick=()=>select(e.id).catch(error);$('types').append(b);}return select('branch');}).catch(error);
})();
