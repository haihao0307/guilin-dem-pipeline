"""Apply only the verified P06 static construction correction; preserve other routes."""
from pathlib import Path
import hashlib,json,os
P=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
proof={'schema':'kaopu-r0432-code-change@1','sourceCommit':os.environ.get('GITHUB_SHA'),
 'previousRuntime':'a6fa594bc4c1ccb9470cbf8571a9f5ce10945ce7','enabledOriginalIds':['P06'],
 'rejectedTrialIds':['P09','D03','J03'],'sourcePapersChanged':False,'bodyChanged':False,
 'materialUVOrIndexChanged':False,'wasmChanged':False,'qualityThresholdsChanged':False,'files':{}}
def edit(n,fn):
 p=P/n;before=p.read_text();after=fn(before);p.write_text(after)
 proof['files'][n]={'beforeSHA256':hashlib.sha256(before.encode()).hexdigest(),'afterSHA256':sha(p)}
def frames(s):
 if 'compatibleSeamClearance' in s:return s
 old='const rows=refinementGuides(lab),keys='
 assert s.count(old)==1
 s=s.replace(old,"const base=refinementGuides(lab),clearance=lab.sideClearance43d?compatibleSeamClearance(lab,base):null;\n if(clearance)lab.seamSideClearance43d=clearance.report;\n const rows=clearance?clearance.rows:base,keys=")
 return "import {compatibleSeamClearance} from '../../seam-clearance-r0432.mjs';\n"+s
edit('correctives/r043b/seam-frames.mjs',frames)
def worker(s):
 if 'lab.sideClearance43d' not in s:
  old='lab.pipeline43=corrected43;lab.spanCorrected43=spanCorrected43;'
  assert s.count(old)==1;s=s.replace(old,old+'lab.sideClearance43d=corrected43&&nativeBinding?.presetId==="P06";')
  old='record.r043={continuousSeamSpans:'
  assert s.count(old)==1;s=s.replace(old,'record.r043={constructionSideClearance:lab.seamSideClearance43d||null,continuousSeamSpans:')
 return s
edit('native/kaopu-tailor-workbench/catalogue/native-adapter.mjs',worker)
edit('app.mjs',lambda s:s.replace("release:'R04.3.1'","release:'R04.3.2'").replace("version:'R04-SOURCE-5.1'","version:'R04-SOURCE-5.2'"))
edit('index.html',lambda s:s.replace('R04.3.1 ·','R04.3.2 ·'))
for n in ['qa_integrated_r0431.py']:
 edit(n,lambda s:s.replace("=='R04.3.1'","=='R04.3.2'"))
proof['preservedKernels']={str(p.relative_to(P)):sha(p) for p in P.rglob('*.wasm')}
(P/'R0432_CODE_PROOF.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2))
print('R0432_INSTALLED',proof['enabledOriginalIds'],flush=True)
