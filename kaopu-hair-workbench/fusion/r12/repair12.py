#!/usr/bin/env python3
"""Post-generation fix discovered in the first real 96k browser regression.
Keep every geometry/material/quality setting. Coalesce duplicate GPU submissions.
"""
from pathlib import Path
import shutil
p=Path(__file__).parent
shutil.copy2(p/'RenderGate.js',p/'src/RenderGate.js')
f=p/'src/experiment.js';s=f.read_text()
assert 'function render(){' in s and 'RenderGate' not in s
s="import {RenderGate} from './RenderGate.js';\n"+s
s=s.replace('function render(){','function renderNow(){',1)
s=s.replace('function resize(){',"function render(){if(editorDepth||!renderer||!head||disposed||!graphics.usable)return;renderGate?.request();}\nfunction resize(){",1)
s=s.replace('let sceneComplete=false;','let renderGate=null;\nlet sceneComplete=false;',1)
s=s.replace('function suspendGraphics(){','function suspendGraphics(){\n renderGate?.reset();',1)
s=s.replace('window.groomStudy={',"renderGate=new RenderGate({draw:renderNow,getGL:()=>renderer?.getContext(),canDraw:()=>!!renderer&&!!head&&!disposed&&graphics.usable,onError:error=>{errors.push(String(error));console.error(error);message('绘制未完成：'+String(error.message||error));}});\nwindow.groomStudy={whenRendered:ms=>renderGate.wait(ms),renderGateDiagnostics:()=>renderGate.diagnostics(),",1)
f.write_text(s)
f=p/'female-source.html';s=f.read_text().replace('</head>','<link rel="icon" href="data:,"></head>',1)
s=s.replace('<summary>当前验证范围与许可</summary>','<summary>原独立版本的历史验证与许可</summary><p>以下是此前独立版本的记录，不代表本次 R12 已经载入或验收原女性模型。本页当前没有原模型，需选择本地私有运行目录。</p>')
f.write_text(s)
f=p/'tests/verify12.mjs';s=f.read_text()
# Make this patch repeatable from either the original or already repaired source.
if 'GPU burst coalesces without changing scalp geometry' not in s:
 s=s.replace('async function shot(name){const data=',"async function shot(name){await page.evaluate(()=>groomStudy.whenRendered(180000));const data=")
 s=s.replace('await page.evaluate(()=>groomStudy.freeze());',"await page.evaluate(async()=>{groomStudy.freeze();await groomStudy.whenRendered(180000)});")
 s=s.replace(" await shot('01-default');", " const beforeGate=await page.evaluate(()=>groomStudy.renderGateDiagnostics()),beforeHash=(await diag()).scalpCurveHash;await page.evaluate(async()=>{for(let i=0;i<12;i++)groomStudy.render();await groomStudy.whenRendered(180000)});report.renderGate=await page.evaluate(()=>groomStudy.renderGateDiagnostics());check('GPU burst coalesces without changing scalp geometry',report.renderGate.draws-beforeGate.draws===1&&(await diag()).scalpCurveHash===beforeHash);\n await shot('01-default');")
 s=s.replace('},style);const g=',"},style);await page.evaluate(()=>groomStudy.whenRendered(180000));const g=")
 s=s.replace('browsModel:i}),i);const t=',"browsModel:i}),i);await page.evaluate(()=>groomStudy.whenRendered(180000));const t=")
 s=s.replace("await mp.screenshot({path:path.join(out,'10-mobile-390x844.png')", "await mp.evaluate(()=>groomStudy.whenRendered(180000));await mp.screenshot({path:path.join(out,'10-mobile-390x844.png')")
 f.write_text(s)
# Do not silently overwrite future edits via the one-time transport archive.
f=p/'README.md';s=f.read_text()
if '## 首轮回归与绘制修复' not in s:
 s+='\n## 首轮回归与绘制修复\n首轮实际浏览器运行 38115223409 的 42 项检查及前七张画面通过，但连续切换 14 眉型后截图等待超时，因此整轮失败且没有发布网页。修复不是减少发根或关闭材质，而是用 WebGL2 fence 限制为最多一个在途 GPU 帧、合并多余绘制请求；测试等待真实 GPU 完成后才截图，每个眉型和发型仍逐个完成真实绘制。RenderGate 的十项独立测试覆盖积压、取消、上下文丢失和等待失败。\n\n`repair12.py` 在 `refine.py` 后运行，是本轮实际回归发现的问题修复。build-inputs 只保留首次源码传输的审计记录；已有的可读源文件不会再被它覆盖。\n'
 f.write_text(s)
print('R12 real-regression repair: fenced draws; unchanged quality; explicit female historical scope')
