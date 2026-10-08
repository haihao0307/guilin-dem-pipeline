"""Build R072 by inheriting the reviewed R071 builder in an isolated temp tree."""
from pathlib import Path
import subprocess,tempfile,shutil,sys
P=Path(__file__).resolve().parent;R=P.parent.parent
with tempfile.TemporaryDirectory() as tmp:
 T=Path(tmp)/'kaopu-tailor-workbench';B=T/'r07/stability'
 for relative in ['r07/stability/build.py','r07/stability/joint-refinement.cpp','r07/kernel.cpp','r07/global.cpp','catalogue/r07-worker.bundle.mjs','catalogue/r07-workbench-app.mjs']:
  dest=T/relative;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(R/relative,dest)
 subprocess.run([sys.executable,str(B/'build.py')],check=True)
 worker=(T/'catalogue/r071-worker.bundle.mjs').read_text();ui=(T/'catalogue/r071-workbench-app.mjs').read_text()
 shutil.copy2(B/'joint.wasm',P/'joint-r072.wasm');shutil.copy2(B/'combined.cpp',P/'combined-r072.cpp')
 html=(B/'index.html').read_text().replace('R07.1','R07.2').replace('r071-','r072-')
def once(text,old,new):
 if text.count(old)!=1:raise RuntimeError(f'Expected one target: {old[:100]} ({text.count(old)})')
 return text.replace(old,new)
worker=worker.replace('R07.1','R07.2').replace('stability/joint.wasm','stability/joint-r072.wasm')
worker=once(worker,'numericalStitchSpacingMm !== null && Math.abs(s.lengthAMm-s.lengthBMm)/Math.min(s.lengthAMm,s.lengthBMm)>0.15','numericalStitchSpacingMm !== null && requiresGatheredStitchSites(s)')
worker=once(worker,'async function startLegacySolve(token) {','async function startLegacySolve(token) {\n const sizing=preflightSizing(analytic);if(sizing.blocking)throw Error(sizing.message);')
worker=once(worker,'canSew: config.kind === "legacy" || spec.source.experimentalSparseSewing === true, physicalStatus:','fitPreflight:preflightSizing(analytic),canSew: !preflightSizing(analytic).blocking && (config.kind === "legacy" || spec.source.experimentalSparseSewing === true), physicalStatus:')
worker="import {preflightSizing} from '../r07/stability/fit-preflight.mjs';\nimport {requiresGatheredStitchSites} from '../r07/stability/gathering.mjs';\n"+worker
(R/'catalogue/r072-worker.bundle.mjs').write_text(worker)
ui=ui.replace('R07.1','R07.2').replace('r071-','r072-')
changes=[
 ('<p id="flow-note">','<div id="fit-preflight" role="status"></div><button id="fit-adjust" hidden>按当前人台补足裙围（修改纸样）</button><p id="flow-note">'),
 ("function updateButtons(){const busy=","function updateButtons(){const sizing=state.fitPreflight;$('fit-preflight').textContent=sizing?.message||'';$('fit-adjust').hidden=!sizing?.blocking||!Number.isFinite(sizing?.suggestedRuffle);$('fit-adjust').disabled=state.generating||state.running;const busy="),
 ("$('sew').disabled=busy||state.phase==='paused';","$('sew').disabled=busy||state.phase==='paused'||!!state.fitPreflight?.blocking;"),
 ("state.phase='paper';state.spec=d.spec;","state.phase='paper';state.fitPreflight=d.fitPreflight||preflightSizing(d.analytic);state.spec=d.spec;"),
 ("state.canSew=d.canSew;","state.canSew=d.canSew&&!state.fitPreflight.blocking;if(state.fitPreflight.blocking)state.runAfterGeneration=false;"),
 ("status('纸样已生成；点击“一键缝合试穿”开始计算，或“查看三维”检查摆放');","status(state.fitPreflight.blocking?state.fitPreflight.message:'纸样已生成；点击缝合按钮开始计算，或查看三维摆片',!!state.fitPreflight.blocking);"),
 ("state.dirty=true;state.staticGate=null;","state.dirty=true;state.fitPreflight=null;state.staticGate=null;"),
 ("state.staticGate=null;state.spec=state.analytic=state.record=null;","state.staticGate=null;state.fitPreflight=null;state.spec=state.analytic=state.record=null;"),
 ("function generate(andSew=false){if(!current","function generate(andSew=false){if(andSew&&state.fitPreflight?.blocking){status(state.fitPreflight.message,true);return;}if(!current"),
 ("staticGate:state.staticGate,diagnosticFailed:","fitPreflight:state.fitPreflight,staticGate:state.staticGate,diagnosticFailed:"),
 ("$('generate').onclick=","$('fit-adjust').onclick=()=>{const suggested=state.fitPreflight?.suggestedRuffle;if(!design||!Number.isFinite(suggested))return;const parameter=schema.parameters.find(p=>p.path==='skirt.ruffle');if(!parameter||suggested>Math.max(...parameter.samplingRange)){status('所需裙围超出当前原制版范围，请更换版式',true);return;}design.skirt.ruffle.v=suggested;invalidate();controls();preferredView='paper';generate(false);};$('generate').onclick="),
 ("import {CatalogueViewer as Viewer} from './catalogue-viewer.mjs';","import {R072Viewer as Viewer} from './r072-viewer.mjs';"),
 ("getState:()=>({version:'R07.2',","getFraming:()=>viewer.framingReport(),getState:()=>({version:'R07.2',")]
for old,new in changes:ui=once(ui,old,new)
ui="import {preflightSizing} from '../r07/stability/fit-preflight.mjs';\n"+ui
(R/'catalogue/r072-workbench-app.mjs').write_text(ui)
(R/'catalogue/r072-workbench-style.css').write_text("@import url('./r07-workbench-style.css');\n#fit-preflight{font-size:12px!important;line-height:1.4;margin-top:4px;max-height:58px;overflow:auto;color:var(--wb-muted)}#fit-preflight:empty{display:none}#fit-adjust{margin-top:5px}@media(max-width:959px){#fit-preflight{max-height:38px;font-size:11px!important}}\n")
(P/'r072.html').write_text(html)
for name in ['r072-worker.bundle.mjs','r072-workbench-app.mjs','r072-viewer.mjs']:subprocess.run(['node','--check',str(R/'catalogue'/name)],check=True)
print('R07.2 built in isolation; old versions unchanged.')
