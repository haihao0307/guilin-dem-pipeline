"""Additive UI build from the deployed catalogue; the accepted application is never overwritten."""
from pathlib import Path
R=Path(__file__).resolve().parent.parent
p=R/'catalogue/workbench-app.mjs';s=p.read_text()
def patch(old,new):
 global s
 if s.count(old)!=1:raise RuntimeError('Expected one original UI anchor: '+old[:120])
 s=s.replace(old,new)
patch("workerStarts=0,workerStops=0,rendererStarts=0,rendererStops=0;","workerStarts=0,workerStops=0,rendererStarts=0,rendererStops=0,preferredView='paper';")
patch("workbench-worker.bundle.mjs","r06-worker.bundle.mjs")
patch("workbench-style.css","r06-workbench-style.css")
patch('<strong>服装制作总台</strong><span>真实纸样 · 当前材料 · 明确验收</span>','<strong>服装制作总台 <b id="build-version">R06.2</b></strong><span>纸样 → 摆片 → 缝合试验</span>')
patch('<button data-camera="back">背面</button>','<button data-camera="back">背面</button><button data-camera="side">侧面</button>')
patch('<button id="view-cloth">三维</button><button id="view-paper">纸样</button>','<button id="view-cloth">三维视图</button><button id="view-paper">二维纸样</button>')
patch('<div id="catalogue-status" role="status">加载工作台…</div>', '''<div id="workflow-controls" aria-label="纸样到成衣制作"><div class="workflow-actions"><button id="generate">① 生成纸样</button><button id="arrange">② 查看三维</button><button id="sew" class="primary">③ 一键缝合试穿</button><button id="pause" hidden>暂停求解</button><button id="resume" hidden>继续求解</button><button id="cancel" hidden>取消本轮</button></div><div class="workflow-progress"><progress id="solve-progress" max="1" value="0"></progress><span id="stage-indicator">准备纸样</span><label><input id="show-body" type="checkbox" checked>人体</label></div><p id="flow-note">本页新增款式为实时缝合试验，不是已验收成衣。</p></div><div id="catalogue-status" role="status">加载工作台…</div>''')
patch('<div class="primary-actions"><button id="generate" class="primary">生成当前纸样</button><button id="sew" class="primary">裁片并重新缝合</button><button id="pause" hidden>暂停当前求解</button><button id="resume" hidden>继续当前求解</button></div>','')
patch('<p>选择一个形制，继续在左侧同一视窗制作</p>','<p>选款后在同一视窗生成纸样，再按下方“一键缝合试穿”。原基础款保留；新增款式的试验结果需检查。</p><p id="catalogue-coverage"></p>')
patch('<p id="source-note"></p>','<p id="source-note"></p><details><summary>版式参考核对</summary><p>库内 GarmentCode 参考的 23 个入口配方、23 张纸样缩略图和 122 个设计字段均保留。入口配方不是全部可能参数组合，也不等于所有组合都能制成合格成衣。</p><p>保留 Shirt/FittedShirt、Pants、七种裙型、长袖/无肩带/不对称、三种领帽、三种袖口、两种腰头、连衣裙和连体裤。</p><p>PatternGSL 照片推理及 GarmentCodeData 完整数据集没有接入；此前用户给出的具体原链接尚未唯一确认。</p><a href="./r06/REFERENCE_AUDIT.md" target="_blank" rel="noopener">查看本次参考与覆盖记录</a></details>')
patch("document.title='服装制作总台 · 制版与缝合'","document.title='裁缝工作台 R06.2 · 纸样到缝合试验'")
start=s.index('function updateButtons()');end=s.index('\nfunction invalidate()',start)
s=s[:start]+'''function updateButtons(){const busy=state.generating||state.running,trial=current?.kind==='analytic';
 $('generate').disabled=busy;$('arrange').disabled=busy&&!state.spec;$('sew').hidden=false;$('sew').disabled=busy||state.phase==='paused';
 $('sew').textContent=trial?'③ 一键缝合试穿（试验）':'③ 一键缝合试穿';
 $('pause').hidden=!state.running;$('resume').hidden=state.phase!=='paused';$('cancel').hidden=!busy&&state.phase!=='paused';
 $('save-paper').disabled=!state.spec;$('save-svg').disabled=!state.spec;$('save-result').disabled=!state.record;
 $('flow-note').textContent=trial?'新增款式：真实纸样与当前参数参与计算；材料未标定，运行时无布料自碰撞，失败不会标为合格。':'保留原基础款求解设置。历史基准不代表当前尺寸已重新计算。';
 $('stage-indicator').textContent=state.phase==='paused'?'已暂停':state.running?'缝合 / 重力检查中':state.generating?'正在制版':state.phase==='complete'?(trial?'试验结束 · 请看检验':'计算结束 · 请看检验'):state.phase==='dirty'?'参数已变更':'纸样与摆片';
}
''' +s[end:]
patch("state.source='uncomputed';if(state.running||state.generating)","state.source='uncomputed';$('solve-progress').value=0;if(state.running||state.generating||state.phase==='paused')")
patch("function invalidate(){requestId++;", "function invalidate(){const wasPaused=state.phase==='paused';requestId++;")
patch("if(state.running||state.generating||state.phase==='paused'){stopWorker();", "if(state.running||state.generating||wasPaused){stopWorker();")
patch("if(state.running||state.generating)stopWorker();const ticket=++epoch", "if(state.running||state.generating||state.phase==='paused')stopWorker();const ticket=++epoch")
patch("label.textContent=s.kind==='legacy'?'基础穿体已验':'真实制版 · 穿体待验'", "label.textContent=s.kind==='legacy'?'已验基础参考 · 可重算':'真实制版 · 可试验缝合'")
patch("$('physical-boundary').textContent='这一形制已支持动态纸样和真实材料网格。穿体缝合仍逐款验收，当前不能把它显示为已验证成衣。';", "$('physical-boundary').textContent='点击视窗下方“一键缝合试穿”会重新制版并求解，不调用预制衣壳。此阶段用于观察失败和改版；当前不提供真实人体动态穿脱、布料自碰撞或工业制衣保证。';")
patch("$('physical-boundary').textContent='本轮参数必须重新生成材料并完整缝合。已验基准只作参照；原参数范围和求解设置保留。';", "$('physical-boundary').textContent='本轮参数必须重新制版并完整缝合。视窗下方按钮常驻；已验基准仅作参照，原参数范围和求解设置保留。';")
patch("$('view-origin').textContent=selected.kind==='legacy'?'已验基础款':'动态原纸样';", "$('view-origin').textContent=selected.kind==='legacy'?'已验基础参考':'动态原纸样 · 实时缝合试验';$('solve-progress').value=0;$('show-body').checked=true;")
patch("status('基准已就绪；调整尺寸后点击“裁片并重新缝合”');", "status('基准已就绪；点击视窗下方“一键缝合试穿”重新计算当前参数');")
patch("else{show('paper');$('viewport-note').textContent='选择参数后生成本轮真实纸样';status('参数已就绪，点击生成纸样');}", """else{show('cloth');$('viewport-note').textContent='当前展示的是人体和摆片，不是成衣';status('载入同一原始人体，准备纸样…');
 if(selected.kind==='analytic'){const body=bodyCache||await read(new URL('garments-r04/assets/body-anny-adult.json',ROOT),abort.signal);if(ticket!==epoch||!life.active)return;bodyCache=body;viewer.setBody(body);preferredView='paper';generate(false);}
 else status('参数就绪，点击生成纸样');}
 $('catalogue-coverage').textContent=`参考入口 ${styles.length}/23 · 原设计字段 ${schema.parameters.length}/122 · 原基础款 3 款`;
""")
patch("function generate(andSew=false){if(!current||state.running||state.generating)return;", "function generate(andSew=false){if(!current||state.running||state.generating||state.phase==='paused')return;state.error=null;state.diagnosticFailed=false;state.metrics=state.intersections=null;$('solve-progress').value=0;")
patch("status(current.kind==='legacy'?'重新生成并剖分当前纸样…':'执行原生成器；首次按需加载 Python，后续复用当前线程');", "status(current.kind==='legacy'?'重新生成并剖分当前纸样…':'正在执行原版制版程序；首次加载约 25 MB 运行时，请勿重复点击');")
patch("$('physical-summary').textContent=d.canSew?'当前尺寸等待完整求解与检查':'纸样和材料网格已生成；尚未通过穿体验收';", "$('physical-summary').textContent=current.kind==='analytic'?'原纸样已生成；支持实时试验缝合，尚未通过穿体验收':'当前尺寸等待完整求解与检查';")
patch("status('初始化当前材料与人体接触，准备缝合…');", "status('准备当前材料与人体碰撞；开始从摆片逐步缝合，不是历史结果回放');")
patch("else{show(state.analytic?'paper':'cloth');status('当前真实材料已生成');}", "else{show(state.analytic?preferredView:'cloth');$('viewport-note').textContent='纸样 / 三维摆片已生成，尚未缝合';status('纸样已生成；点击“一键缝合试穿”开始计算，或“查看三维”检查摆放');}")
patch("state.phase=d.type;status(", "state.phase=d.type;$('solve-progress').value=d.progress||0;$('viewport-note').textContent=current.kind==='analytic'?'当前参数实时求解 · 尚未验收':'';status(")
patch("status(i.bodyIntersectingFaceCount||i.selfStrictTriangleIntersectionCount?'本轮完成，但穿插检查未通过；保留诊断结果':'本轮完成，穿插检查通过；局部应变与工艺边界仍见检验');", """$('solve-progress').value=1;const failed=i.bodyIntersectingFaceCount>0||i.selfStrictTriangleIntersectionCount>0||d.regions.all.maximumPercent>15;state.diagnosticFailed=failed;
 if(current.kind==='analytic'){$('view-origin').textContent='本轮实时缝合结果 · 未验收';$('viewport-note').textContent=failed?'检验未通过：有穿插或过度拉伸，不能视为合格成衣':'仅最终几何抽检无交叉；仍非已验收成衣';status(`本轮试验结束${failed?'，检验未通过':''}：人体穿插 ${i.bodyIntersectingFaceCount}，布料交叉 ${i.selfStrictTriangleIntersectionCount}，最大原材料应变 ${format(d.regions.all.maximumPercent,1)}%。`,failed);}
 else status(i.bodyIntersectingFaceCount||i.selfStrictTriangleIntersectionCount?'本轮完成，但穿插检查未通过；保留诊断结果':'本轮完成，最终严格穿插检查通过；局部应变与工艺边界仍见检验');""")
patch("$('generate').onclick=()=>generate(false);$('sew').onclick=()=>generate(true);", """$('generate').onclick=()=>{preferredView='paper';generate(false);};$('arrange').onclick=()=>{preferredView='cloth';if(state.spec){show('cloth');viewer.cameraView('full');}else generate(false);};$('sew').onclick=()=>generate(true);
 $('show-body').onchange=()=>{if(viewer?.body)viewer.body.visible=$('show-body').checked;if(viewer)viewer.dirty=true;};
 $('cancel').onclick=()=>{stopWorker();state.running=state.generating=false;state.phase='cancelled';state.runAfterGeneration=false;requestId++;status('本轮已取消；保留当前画面但不作为完成结果，可重新生成纸样');updateButtons();};""")
patch("state.phase='error';state.error=error.message;status", "state.phase='error';state.runAfterGeneration=false;state.error=error.message;status")
patch("getState:()=>({caseId:current?.id,", "getState:()=>({version:'R06.2',diagnosticFailed:state.diagnosticFailed,caseId:current?.id,")
patch("getRecord:()=>structuredClone(state.record),select", "getRecord:()=>structuredClone(state.record),getDesign:()=>structuredClone(design),select")
s=s.replace('R06.2','R06.3').replace('r06-worker.bundle.mjs','r06-contact-worker.bundle.mjs')
(R/'catalogue/r06-contact-workbench-app.mjs').write_text('// R06.2 additive UI; original application retained.\n'+s)
print('UI',len(s))
