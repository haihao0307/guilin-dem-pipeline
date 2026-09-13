from pathlib import Path
import hashlib,re,json
root=Path(__file__).resolve().parents[2]
out=Path(__file__).resolve().parent
source=root/'handoff/Landscape_Mother_R5_K2_Current_Full_Handoff_2026-09-14/SOURCE_SNAPSHOT/workbenches/landscape-surface-r5-k2/index.html'
if not source.exists():source=out/'source-r5-k2.html'
h=source.read_text();assert hashlib.sha256(h.encode()).hexdigest()=='919df1a9eff14a6d310d4aca93a2ccfcc9a59bb70a9b44b0bfe7d57aed335709'
base=h
h=h.replace('R5.K2','R5.K3').replace('Organic Microscope</div>','活喀斯特 · 有机显微表面</div>')
h=h.replace('<button id="nextseed">换种子</button>','<button id="nextseed" hidden>换种子</button>')
h=h.replace('<details class="stage-controls">','<details class="stage-controls" hidden>')
h=h.replace('显微层采用对数半径、方向比值、方位角与17级倍频组织尺度，并用位置相关连续空间弯折降低明显重复。','当前继承的 K2 显微层使用六个非整数尺度、连续矿物区和固定世界位置的局部方向框架，组织孔腔、圆润孔缘、微孔与结节。')
h=h.replace('换种子会显式重建岩体，','本候选锁定已确认的岩体配方，')
h=h.replace('<p id="details">','<p>活喀斯特采用四个由实际三角面定位的洞顶和洞底点。内部入渗连线是尚未标定的连通代理，并非实测裂隙。溶蚀目前记录相对矿物量及局部湿痕，不挖改已冻结的洞壁；沉积读取同一矿物账本。脱气为零则不沉积，断水后排尽在途水才停止滴水。几何尺寸、供水量和时间均未作物理标定。</p><p id="details">')
ui='''<section id="karstPanel" class="glass"><div class="row"><b>活喀斯特 · 四处滴点</b><button id="karstCave">洞内观察</button></div><div class="row"><label for="karstTime">相对演化阶段</label><output id="karstTimeOut">65%</output></div><input id="karstTime" type="range" min="0" max="1" step=".005" value=".65"><div class="buttons"><button id="karstPlay">播放</button><button id="karstStop">从此断水</button><button id="karstRestart">重演</button><button id="karstPaths">水路</button></div><p id="karstStatus"></p><small id="karstPathKey" hidden>蓝线透视：入渗连通代理 → 洞顶滴点 → 洞底</small><details><summary>水与沉积</summary><p id="karstBudget"></p><label for="karstDegas">脱气条件：低 → 高</label><input id="karstDegas" type="range" min="0" max="1" step=".05" value="1"><small>尺寸与时间未标定；回退按同一供水方案重算。</small></details></section>'''
h=h.replace('<header>',ui+'<header>',1)
h=h.replace('</style>','''#karstPanel{position:absolute;right:22px;bottom:98px;width:280px;border-radius:12px;padding:13px;max-height:45vh;overflow:auto}#karstPanel button{padding:8px;font-size:11px}#karstPanel p{font-size:10px;margin:9px 0}#karstPanel small{font-size:10px}#karstPanel .row{font-size:11px}#karstPanel input{margin:5px 0}button:disabled{opacity:.45;cursor:default}.immersive #karstPanel{display:none}@media(max-width:640px){#karstPanel{left:12px;right:12px;bottom:91px;width:auto;max-height:29vh;padding:10px}#karstPanel button{min-height:38px}#karstPanel details[open]{max-height:100px;overflow:auto}.brand{max-width:230px}.brand h1{font-size:14px}.tools #nextseed{display:none}}
</style>''',1)
h=h.replace("<script>'use strict';\nconst VS=","<script>"+(out/'living-karst.js').read_text()+"</script><script>'use strict';\nconst VS=",1)
h=h.replace('uniform float uStage;','uniform float uStage;uniform vec4 uKarstAnchors[4];uniform vec4 uKarstTops;uniform vec2 uKarstWet;',1)
h=h.replace('float moisture=uWet*(.45+.55*rain);','''float processWet=0.;for(int i=0;i<4;i++){vec4 a=uKarstAnchors[i];float dx=length(p.xz-a.xy);float reach=step(a.z-.25,p.y)*step(p.y,uKarstTops[i]+.25);float local=max(exp(-dx*dx/0.09)*reach,exp(-(dx*dx+pow(p.y-a.w,2.))/0.45));processWet=max(processWet,local);}processWet*=uKarstWet.x;albedo=mix(albedo,albedo*vec3(.65,.72,.73),processWet*.65);rough=mix(rough,.40,processWet);float moisture=uWet*(.45+.55*rain);''')
h=h.replace("'uSelect','uStage']","'uSelect','uStage','uKarstAnchors','uKarstTops','uKarstWet']")
h=h.replace("report=data.report;$('#status')","report=data.report;livingAnchors=LivingKarst.anchors(parts);livingRebuild();$('#status')",1)
h=h.replace('function render(t){requestAnimationFrame(render);draw()}','function render(t){requestAnimationFrame(render);livingTick(t);draw()}')
h=h.replace('gl.uniform1i(U.uSelect,state.selected);','''gl.uniform1i(U.uSelect,state.selected);if(livingAnchors.length){gl.uniform4fv(U.uKarstAnchors,livingAnchors.flatMap(a=>[a.x,a.z,a.roof,a.floor]));gl.uniform4fv(U.uKarstTops,livingAnchors.map(a=>a.top));gl.uniform2f(U.uKarstWet,livingLedger.wet,livingLedger.dissolved);}''')
h=h.replace('gl.bindVertexArray(null);renderTimes.push','gl.bindVertexArray(null);livingDraw(vp);renderTimes.push',1)
h=h.replace("function getState(){return {schema:'landscape-function-view/1'","function getState(){return {process:{...living,playing:false},schema:'landscape-function-view/1'")
h=h.replace("if(Object.keys(s).sort().join(',')!=='label,recipe,schema,view')","if(!['label,recipe,schema,view','label,process,recipe,schema,view'].includes(Object.keys(s).sort().join(',')))")
h=h.replace("await build(s.recipe);state=","if(s.process)LivingKarst.ledger(s.process.phase,s.process.rain,s.process.cutoff,s.process.degassing);await build(s.recipe);if(s.process)livingSet({...s.process,playing:false});state=",1)
h=h.replace("if(!newRecipe||Object.keys(newRecipe)","if(!newRecipe||Object.entries({schema:'landscape-function-world/1',core:'limestone-water-2',seed:83,stage:4,fracture:1,relief:1}).some(([k,v])=>newRecipe[k]!==v))throw Error('R5.K3 锁定已确认宏观配方');if(!newRecipe||Object.keys(newRecipe)",1)
h=h.replace('cave:[[1,6.5,23],[-6,5,3]]','cave:[[1,6.5,30],[-6,5,8]]')
h=h.replace("state.section=v==='section';","if(innerWidth<640&&v==='cave')state.target[1]-=2.1;state.section=v==='section';",1)
h=h.replace("release:'limestone-water-surface-r5'","release:'limestone-water-surface-r5-k3'")
h=h.replace('try{initGL();controls();', (out/'living-renderer.js').read_text()+'\ntry{initGL();livingInit();controls();livingControls();',1)
for ident in ['worldSource','generateSource']:
 pattern=rf'<script id="{ident}"[^>]*>([\s\S]*?)</script>'
 assert re.search(pattern,h)[1]==re.search(pattern,base)[1],ident
(out/'index.html').write_text(h)
(out/'build.json').write_text(json.dumps({'sourceSha256':hashlib.sha256(base.encode()).hexdigest(),'candidateSha256':hashlib.sha256(h.encode()).hexdigest(),'candidateBytes':len(h.encode()),'worldSourceUnchanged':True,'generateSourceUnchanged':True,'macroGeometryChanged':False,'visualApproved':False,'productionReady':False,'yearsCalibrated':False},indent=2)+'\n')
print(len(h.encode()))
