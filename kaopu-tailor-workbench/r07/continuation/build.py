"""Assemble an additive continuation of the existing, reviewed workbench.
Every source patch is exact and guarded. Original R072 files remain unchanged.
"""
from pathlib import Path
import hashlib,json,os,subprocess
P=Path(__file__).resolve().parent;ROOT=P.parent.parent;CAT=ROOT/'catalogue'
def once(text,old,new):
    if text.count(old)!=1:raise RuntimeError('Expected exactly one source target: '+old[:120]+'; found '+str(text.count(old)))
    return text.replace(old,new)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
source_paths=[CAT/'r072-worker.bundle.mjs',CAT/'r072-workbench-app.mjs',CAT/'r072-workbench-style.css',P.parent/'stability/r072.html',P.parent/'stability/joint-r072.wasm',ROOT/'learning/patterngsl-r01/pattern-edit-kernel.mjs',ROOT/'learning/patterngsl-r01/seam-span.mjs']
original={str(p.relative_to(ROOT)):sha(p) for p in source_paths}
worker=(CAT/'r072-worker.bundle.mjs').read_text()
worker=once(worker,"import {coplanarPositiveOverlap,staticGate} from '../r07/stability/audit.mjs';","import {coplanarPositiveOverlap} from '../r07/stability/audit.mjs';\nimport {continuationStaticGate as staticGate} from '../r07/continuation/seam-gate.mjs';")
worker=once(worker,"import {prepareAssembly,createSeamLayerGuide} from '../r07/assembly.mjs';","import {createSeamLayerGuide} from '../r07/assembly.mjs';\nimport {prepareContinuationAssembly as prepareAssembly} from '../r07/continuation/assembly.mjs';")
assert worker.count('spec = analytic = lab = null;')==2
worker=worker.replace('spec = analytic = lab = null;','spec = analytic = lab = null; resetContinuation();')
worker=once(worker,'} else if (data.type === "run") {','} else if (["edit","undo-edit","reset-edits","replay-edits"].includes(data.type)) {\n      await continuationEdit(data);\n    } else if (data.type === "run") {')
extension=(P/'worker-extension.mjs').read_text().replace("from '../../learning/","from '../learning/").replace("from './native-edit-bridge.mjs'","from '../r07/continuation/native-edit-bridge.mjs'")
worker=once(worker,'self.onmessage = async ({ data }) => {',extension+'\nself.onmessage = async ({ data }) => {')
worker=worker.replace('R07.2','R07.4')
(CAT/'r074-worker.bundle.mjs').write_text(worker)
# Node-only export of the exact newly built worker for independent geometry checks.
(CAT/'r074-test-module.mjs').write_text('globalThis.self={};\n'+worker+'\nexport {compileAnalytic,GarmentLab2,GarmentLab,BodySDF,configureWasm,prepareBodyAudit,strictIntersectionAudit,regionalStrain};\n')
ui=(CAT/'r072-workbench-app.mjs').read_text().replace('r072-workbench','r074-workbench').replace('r072-worker','r074-worker').replace('R07.2','R07.4')
ui=once(ui,'function bindDOM(){','function bindDOM(){mountContinuationUI();')
ui=once(ui,'function updateButtons(){','function updateButtons(){updateContinuationUI();')
ui=once(ui,"if(d.type==='paper'){state.generating=false;","if(d.type==='paper'){continuationPaperArrived(d);state.generating=false;")
ui=once(ui,"$('sew').onclick=()=>generate(true);","$('sew').onclick=continuationSewCurrent;")
ui=once(ui,"检验未通过：有穿插或过度拉伸，不能视为合格成衣","检验未通过：穿插、应变或整段接缝未通过；不能视为合格成衣")
ui=once(ui,"source:state.source,panelCount:","source:state.source,editRevision:continuationUIInfo?.revision||0,editOperationCount:continuationUIInfo?.operationCount||0,panelCount:")
extension=(P/'ui-extension.mjs').read_text()
ui=once(ui,"mountDOM();window.addEventListener",extension+"\nmountDOM();window.addEventListener")
ui+='\nwindow.__TAILOR_CONTINUATION_QA__={apply:op=>sendContinuationOperation(op),undo:()=>sendContinuationOperation(null,"undo-edit"),reset:()=>sendContinuationOperation(null,"reset-edits"),sew:continuationSewCurrent,getEditInfo:()=>structuredClone(continuationUIInfo),getBase:()=>structuredClone(continuationUIBase),showEditor:()=>{tab("parameters");$("continuation-editor").open=true;},getWholeSeamAudit:()=>structuredClone(state.staticGate?.wholeSeamAudit||null)};\n'
(CAT/'r074-workbench-app.mjs').write_text(ui)
css="""@import url('./r072-workbench-style.css');
#continuation-editor{border:1px solid var(--wb-line,#49616b);border-radius:6px;padding:10px;margin-bottom:14px;background:#192f38}
#continuation-editor summary{cursor:pointer;font-weight:600;color:#dac49b}
#continuation-editor p{font-size:11px;line-height:1.5;color:#bdcccc;margin:7px 0}
#continuation-editor label{display:block;font-size:11px;margin:8px 0}
#continuation-editor select{display:block;width:100%;max-width:100%;font-size:10px;background:#142831;color:#e6eeeb}
.continuation-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.continuation-actions button{font-size:10px!important;padding:7px!important;white-space:normal}
#continuation-whole-seam{font-size:11px!important;line-height:1.4;color:#e7c293;max-height:58px;overflow:auto;margin:6px 0 0}
@media(max-width:959px){#continuation-whole-seam{max-height:40px;font-size:10px!important}}
"""
(CAT/'r074-workbench-style.css').write_text(css)
html=(P.parent/'stability/r072.html').read_text().replace('R07.2','R07.4').replace('r072-workbench','r074-workbench').replace('联合整理','编辑接续与整段接缝检查')
(P/'index.html').write_text(html)
for path in [CAT/'r074-worker.bundle.mjs',CAT/'r074-workbench-app.mjs',P/'native-edit-bridge.mjs',P/'seam-gate.mjs',P/'assembly.mjs']:
    subprocess.run(['node','--check',str(path)],check=True)
for path,digest in original.items():assert sha(ROOT/path)==digest,path
outputs=[CAT/'r074-worker.bundle.mjs',CAT/'r074-workbench-app.mjs',CAT/'r074-workbench-style.css',P/'index.html',P/'native-edit-bridge.mjs',P/'seam-gate.mjs',P/'assembly.mjs']
(P/'BUILD_MANIFEST.json').write_text(json.dumps({'version':'R07.4','sourceCommit':os.environ.get('GITHUB_SHA','local'),
 'inheritedCoreCommit':'a704386453f7fc10f34a3023bdcbd023d1236c7c','unchangedSources':original,
 'runtimeFiles':{str(p.relative_to(ROOT)):sha(p) for p in outputs},'editsUseOriginalMaterials':True,
 'wholeSeamGateEnabled':True,'garmentQualityAccepted':False,'dynamicWearCertified':False},indent=2))
print('R074_CONTINUATION_BUILT; original workbench bytes unchanged')
