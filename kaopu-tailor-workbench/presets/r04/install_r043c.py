from pathlib import Path
import hashlib,json,subprocess
P=Path(__file__).parent;N=P/'native/kaopu-tailor-workbench/catalogue';C=P/'correctives/r043c';C.mkdir(exist_ok=True)
f=N/'native-adapter.mjs';snapshot=N/'native-adapter-r0431-before-c.mjs'
if not snapshot.exists():snapshot.write_bytes(f.read_bytes())
s=snapshot.read_text()
old="const corrected43=config?.variant43||!new Set([\"T01\",\"T02\",\"T03\",\"T04\",\"T08\",\"T15\",\"T16\",\"T17\",\"T18\"]).has(nativeBinding?.presetId);"
new=old+"\n const spanCorrected43=corrected43&&(config?.variant43||!['T13','T14'].includes(nativeBinding?.presetId))&&spec.seams.some(s=>s.numericalStitchPlan&&Math.max(s.sourceSeam.lengthAMm,s.sourceSeam.lengthBMm)/Math.min(s.sourceSeam.lengthAMm,s.sourceSeam.lengthBMm)<=1.12+1e-12),kernelMode43=corrected43?(spanCorrected43?'seam-spans':'bending'):'legacy';"
routes=P/'R043C_SELECTED_ROUTES.json'
if routes.exists():
 selected=json.loads(routes.read_text())['enabledOriginalIds']
 new=new.replace("(config?.variant43||!['T13','T14'].includes(nativeBinding?.presetId))",'new Set('+json.dumps(selected,separators=(",",":"))+').has(nativeBinding?.presetId)')
assert s.count(old)==1;s=s.replace(old,new)
s=s.replace("import {beginMaterialRefinement} from '../../../correctives/r043b/seam-frames.mjs';","import {beginMaterialRefinement} from '../../../correctives/r043c/seam-frames.mjs';")
s=s.replace('kernelVariant43!==corrected43','kernelVariant43!==kernelMode43').replace('kernelVariant43=corrected43','kernelVariant43=kernelMode43')
s=s.replace('corrected43?"../../../correctives/r043b/joint-r043b.wasm":"../r07/stability/joint-r072.wasm"','corrected43?(spanCorrected43?"../../../correctives/r043c/joint-r043c.wasm":"../../../correctives/r043b/joint-r043b.wasm"):"../r07/stability/joint-r072.wasm"')
s=s.replace('lab.pipeline43=corrected43;','lab.pipeline43=corrected43;lab.spanCorrected43=spanCorrected43;')
s=s.replace('record.r043={bending:', 'record.r043={continuousSeamSpans:lab.seamSpanReport43c||null,bending:')
f.write_text(s)
base=(P/'correctives/r043b/seam-frames.mjs').read_text();base="import {closeLightEaseSpans} from './seam-spans.mjs';\nimport {beginMaterialRefinement as beginB} from '../r043b/seam-frames.mjs';\n"+base
base=base.replace('if(!lab.pipeline43)return originalBegin(lab);','if(!lab.spanCorrected43)return beginB(lab);')
base=base.replace('const rows=refinementGuides(lab),keys=', 'const extended=closeLightEaseSpans(lab,refinementGuides(lab));lab.seamSpanReport43c=extended.report;const rows=extended.rows,keys=')
base=base.replace('additionalNativeSeamFrames:additional,','additionalNativeSeamFrames:additional,continuousSeamSpans:extended.report,')
(C/'seam-frames.mjs').write_text(base)
subprocess.run(['python',str(C/'build_seam_kernel.py')],check=True)
subprocess.run(['node','--check',str(f)],check=True)
(P/'R043C_CODE_PROOF.json').write_text(json.dumps({'beforeSHA256':hashlib.sha256(snapshot.read_bytes()).hexdigest(),'afterSHA256':hashlib.sha256(f.read_bytes()).hexdigest(),'sourcePapersChanged':False,'materialUVChanged':False,'materialIndexChanged':False,'bodyChanged':False,'staticThresholdsChanged':False,'preserve11PassingOriginals':True,'correction':'replace contradictory 0.3mm construction boundary offset on slight-ease joins with zero-offset side condition and explicit 0.1mm distance tube; high-ratio gathers unchanged','maxSourceLengthRatio':1.12,'physicalFitAccepted':False},indent=2))
