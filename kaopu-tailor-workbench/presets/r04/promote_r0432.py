"""Promote only a complete strict improvement on the same original material/person."""
from pathlib import Path
import gzip,hashlib,json,os,math
P=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
index=json.loads((P/'assets/results/index.json').read_text());before=json.loads((P/'assets/results/index.json').read_text());entry=index['rows']['P06']
oldRaw=(P/'assets/results'/entry['file']).read_bytes();assert sha(oldRaw)==entry['sha256'];old=json.loads(gzip.decompress(oldRaw))
trial=json.loads(gzip.decompress((P/'candidate-r0432/P06.json.gz').read_bytes()));g=trial['record']['staticGate']
assert g['passed'] and not g['failures'];assert g['thresholds']==old['record']['staticGate']['thresholds']
assert trial['binding']==old['binding'];assert trial['record']['nativeBinding']==trial['binding']
assert len(trial['spec']['panels'])==len(old['spec']['panels'])
for a,b in zip(trial['spec']['panels'],old['spec']['panels']):
 for k in ['id','uvMm','triangles']:assert a[k]==b[k],k
assert all(math.isfinite(x)for p in trial['record']['positionsMm']for x in p)
assert trial['record']['r043']['constructionSideClearance']['changedBoundaryRows']>0
packet={k:trial[k]for k in['binding','spec','record']};packet.update(sourceRun=os.environ.get('GITHUB_SHA'),complete=True)
raw=gzip.compress(json.dumps(packet,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)
(P/'assets/results/P06.json.gz').write_bytes(raw)
index['rows']['P06']={**entry,'file':'P06.json.gz','sha256':sha(raw),'qualityPassed':True,'thumbReady':False,'kind':'NATIVE_REVIEWED_SEAM_SIDE_CLEARANCE'}
index['sourceCommit']=os.environ.get('GITHUB_SHA');index['source']='reviewed-native-r0432';index['selectedSideClearanceRoutes']=['P06']
protected={}
for id,r in before['rows'].items():
 if id=='P06':continue
 assert sha((P/'assets/results'/r['file']).read_bytes())==r['sha256'];protected[id]=r['sha256']
assert len(index['rows'])==60 and sum(r['qualityPassed']for r in index['rows'].values())==22
(P/'assets/results/index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2))
ready=json.loads((P/'assets/readiness.json').read_text());ready['summary']['staticGatePassedRecords']=22;(P/'assets/readiness.json').write_text(json.dumps(ready,ensure_ascii=False,indent=2))
report={'sourceCommit':os.environ.get('GITHUB_SHA'),'baselineCommit':'a6fa594bc4c1ccb9470cbf8571a9f5ce10945ce7',
 'newPassIds':['P06'],'previousFailureCategories':old['record']['staticGate']['failures'],'newFailureCategories':[],
 'beforeSHA256':sha(oldRaw),'afterSHA256':sha(raw),'protectedOriginalRecordSHA256':protected,
 'summary':ready['summary'],'originalUVAndTriangleOrderUnchanged':True,'personUnchanged':True,
 'qualityThresholdsUnchanged':True,'physicalFitAccepted':False,'dynamicWearCertified':False}
(P/'R0432_PROMOTION.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('R0432_PROMOTED',json.dumps(ready['summary']),flush=True)
