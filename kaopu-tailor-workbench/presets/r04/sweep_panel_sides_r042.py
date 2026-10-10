"""Fresh browser solves of all presets affected by corrected rear-piece classification.
Only exact native solver records enter the gallery. Old failures stay in Git history
and the fixed R04.1 snapshot; no display geometry or quality gate substitution.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
import json,copy,os,hashlib
P=Path(__file__).resolve().parent
source=(P/'sweep_native.py').read_text().split("\nmode=os.environ.get('R04_MODE'",1)[0]
ns={'__file__':str(P/'sweep_native.py'),'__name__':'side_fix_test_library'}
exec(compile(source,str(P/'sweep_native.py'),'exec'),ns)
A=P/'assets';load=lambda p:json.loads(p.read_text())
old=load(A/'results/index.json');readiness=load(A/'readiness.json')
proof=load(P/'SIDE_FIX_PROOF.json');affected={r['id'] for r in proof['affected']}
assert len(affected)==18
rows=[r for r in ns['CAT'] if r['id'] in affected]
rows.sort(key=lambda r:(not r['id'].startswith('T'),r['id']))
index=copy.deepcopy(old)
(P/'SIDE_FIX_BASELINE_INDEX.json').write_text(json.dumps(old,ensure_ascii=False,indent=2))
originalFiles={id:hashlib.sha256((A/'results'/r['file']).read_bytes()).hexdigest() for id,r in old['rows'].items() if id not in affected}
results=[]
with ThreadPoolExecutor(max_workers=2) as pool:
 for f in as_completed([pool.submit(ns['sweep_chunk'],rows[i::2]) for i in range(2)]):results+=f.result()
assert len(results)==18 and {r['id'] for r in results}==affected
assert not any(r['status'] in ['contract-error','harness-error','worker-error'] for r in results),[(r['id'],r['status']) for r in results]
for r in results:
 id=r['id'];m=r.get('material')
 if m:
  assert m['areaErrorMaxMm2']<.001 and m['maxPanelVertices']<=3000 and m['maxPanelTriangles']<=6000
  readiness['rows'][id]={'status':'native-material-ready','reason':None,'vertices':m['vertices'],'budget':m['budget']}
 else:readiness['rows'][id]={'status':'native-material-rejected','reason':r.get('message'),'vertices':0}
 if r.get('file'):
  index['rows'][id]={k:r[k] for k in ['file','sha256','qualityPassed']}|{'thumb':id+'.png','thumbReady':False,'kind':'ORIGINAL_SOLVER_RESULT','person':ns['LOCK']['person'],'assemblyCorrection':'R04.2-rear-piece-classification','sourceCommit':ns['SOURCE']}
  index.setdefault('failed',{}).pop(id,None)
 else:
  index['rows'].pop(id,None)
  index.setdefault('failed',{})[id]={'phase':r['status'],'reason':r.get('message'),'kind':'NO_FINISHED_RESULT_NOT_REPLACED','assemblyCorrection':'R04.2-rear-piece-classification'}
for id,h in originalFiles.items():assert hashlib.sha256((A/'results'/old['rows'][id]['file']).read_bytes()).hexdigest()==h
priorPass={id for id,r in old['rows'].items() if r['qualityPassed']}
newPass={id for id,r in index['rows'].items() if r['qualityPassed']}
assert priorPass<=newPass,'Previously passed originals regressed'
index['previousResultSourceCommit']=old['sourceCommit'];index['sourceCommit']=ns['SOURCE'];index['assemblyCorrection']='R04.2-rear-piece-classification'
summary={'originalPapers':60,'nativeMaterialsReady':sum(r['status']=='native-material-ready' for r in readiness['rows'].values()),'nativeMaterialRejected':sum(r['status']!='native-material-ready' for r in readiness['rows'].values()),'actualSolverRecords':len(index['rows']),'staticGatePassedRecords':len(newPass),'all60GarmentsAccepted':False}
readiness['summary']=summary
for name,d in [('results/index.json',index),('readiness.json',readiness)]:ns['write'](A/name,d)
report={'sourceCommit':ns['SOURCE'],'affectedPresetCount':18,'rerunAllAffected':True,'unchangedPresets':42,'unchangedRecordSHA256':originalFiles,'previousSummary':load(P/'CONTINUATION_SWEEP.json')['summary'],'summary':summary,'previousPassIds':sorted(priorPass),'newPassIds':sorted(newPass-priorPass),'stillUnfinishedIds':sorted(set(r['id'] for r in ns['CAT'])-newPass),'newResultIds':sorted(set(index['rows'])-set(old['rows'])),'trials':results,'oldSnapshot':'https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r041-8e98936acb85/','onlyClassificationChanged':True,'qualityThresholdsChanged':False,'physicalFitAccepted':False,'dynamicWearCertified':False,'all60GarmentsAccepted':False}
ns['write'](P/'SIDE_FIX_SWEEP.json',report)
print('SIDE_FIX_SWEEP',summary,'new passes',sorted(newPass-priorPass),flush=True)
ns['render_verify']()
