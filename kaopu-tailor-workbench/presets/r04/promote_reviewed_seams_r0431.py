"""Promote strictly improved native trials; never replace an existing complete result by a failed experiment."""
from pathlib import Path
import gzip,json,hashlib,subprocess,os,re
P=Path(__file__).resolve().parent;ROOT=P.parents[2];PREFIX='kaopu-tailor-workbench/presets/r04';BASE='5bc88ac13a597b8e9f947fa38b09bf54b1e181ea'
sha=lambda b:hashlib.sha256(b).hexdigest()
def original(n):return subprocess.check_output(['git','show',BASE+':'+PREFIX+'/'+n],cwd=ROOT)
index=json.loads(original('assets/results/index.json'));old=json.loads(original('assets/results/index.json'));audit=json.loads((P/'R043C_SWEEP.json').read_text())
if not (P/'R043C_FAILED_RUN_ORIGINAL.json').exists():(P/'R043C_FAILED_RUN_ORIGINAL.json').write_bytes((P/'R043C_SWEEP.json').read_bytes())
report={'sourceCommit':os.environ.get('GITHUB_SHA'),'numericalTrialSourceCommit':audit['sourceCommit'],'baselineCommit':BASE,'trialAll24Completed':False,'trialFailuresPreserved':True,'selectionRule':'Only complete native outcomes with a strict subset of previous failed gate categories; no relaxed thresholds or display edits','promoted':[],'rejected':[],'preservedRecordSHA256':{},'complete':False}
for id,row in index['rows'].items():
 raw=original('assets/results/'+row['file']);assert sha(raw)==row['sha256'];(P/'assets/results'/row['file']).write_bytes(raw)
for trial in audit['rows']:
 id=trial['id'];base=json.loads(gzip.decompress((P/'assets/results'/index['rows'][id]['file']).read_bytes()));d=json.loads(gzip.decompress((P/'batch-r043c'/(id+'.json.gz')).read_bytes()))
 prev=set(base['record']['staticGate']['failures']);gate=d.get('record',{}).get('staticGate',{});current=set(gate.get('failures',[]));better=bool(d.get('record')) and current<prev
 entry={'id':id,'previousFailures':sorted(prev),'trialFailures':sorted(current) if d.get('record') else None,'trialError':d.get('error'),'completeTrial':bool(d.get('record'))}
 if not better:
  entry['reason']='incomplete candidate' if not d.get('record') else 'new failure category or no strict gate improvement';report['rejected'].append(entry);continue
 assert d['binding']['materialSHA256']==base['binding']['materialSHA256']
 assert d['record']['nativeBinding']==d['binding']
 assert gate['thresholds']==base['record']['staticGate']['thresholds']
 for a,b in zip(d['spec']['panels'],base['spec']['panels']):assert a['id']==b['id'] and a['uvMm']==b['uvMm'] and a['triangles']==b['triangles']
 packet={k:d[k]for k in ['binding','spec','record']};packet.update(sourceRun=audit['sourceCommit'],complete=True)
 raw=gzip.compress(json.dumps(packet,ensure_ascii=False,separators=(',',':')).encode(),mtime=0);(P/'assets/results'/(id+'.json.gz')).write_bytes(raw)
 index['rows'][id]={**index['rows'][id],'sha256':sha(raw),'file':id+'.json.gz','qualityPassed':bool(gate['passed']),'thumbReady':False,'kind':'NATIVE_REVIEWED_LIGHT_EASE_SEAM_SPANS'};entry['staticPassed']=bool(gate['passed']);report['promoted'].append(entry)
selected=sorted(r['id'] for r in report['promoted']);assert len(selected)==16 and len(report['rejected'])==8
for id,row in old['rows'].items():
 if id not in selected:
  assert sha((P/'assets/results'/row['file']).read_bytes())==row['sha256'];report['preservedRecordSHA256'][id]=row['sha256']
 assert not row['qualityPassed'] or index['rows'][id]['qualityPassed']
assert len(index['rows'])==60 and not index.get('checkpoints')
index['source']='reviewed-native-original-materials';index['sourceCommit']=os.environ.get('GITHUB_SHA');index['selectedSeamRoutes']=selected
(P/'assets/results/index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2))
readiness=json.loads(original('assets/readiness.json'));readiness['summary']['staticGatePassedRecords']=sum(r['qualityPassed']for r in index['rows'].values());assert readiness['summary']['staticGatePassedRecords']==21
(P/'assets/readiness.json').write_text(json.dumps(readiness,ensure_ascii=False,indent=2))
# The runtime and the cached output must select the identical reviewed numerical route.
f=P/'native/kaopu-tailor-workbench/catalogue/native-adapter.mjs';s=f.read_text();pattern=r"const spanCorrected43=corrected43&&.*?,kernelMode43=corrected43\?\(spanCorrected43\?'seam-spans':'bending'\):'legacy';"
replacement='const spanCorrected43=corrected43&&new Set('+json.dumps(selected,separators=(',',':'))+').has(nativeBinding?.presetId)&&spec.seams.some(s=>s.numericalStitchPlan&&Math.max(s.sourceSeam.lengthAMm,s.sourceSeam.lengthBMm)/Math.min(s.sourceSeam.lengthAMm,s.sourceSeam.lengthBMm)<=1.12+1e-12),kernelMode43=corrected43?(spanCorrected43?\'seam-spans\':\'bending\'):\'legacy\';'
s,count=re.subn(pattern,lambda _:replacement,s);assert count==1;f.write_text(s)
# Also protect subsequent source rebuilds from re-enabling rejected routes.
f=P/'install_r043c.py';s=f.read_text();marker='assert s.count(old)==1;s=s.replace(old,new)'
if 'R043C_SELECTED_ROUTES.json' not in s:
 insertion="routes=P/'R043C_SELECTED_ROUTES.json'\nif routes.exists():\n selected=json.loads(routes.read_text())['enabledOriginalIds']\n new=new.replace(\"(config?.variant43||!['T13','T14'].includes(nativeBinding?.presetId))\",'new Set('+json.dumps(selected,separators=(\",\",\":\"))+').has(nativeBinding?.presetId)')\n"
 assert s.count(marker)==1;s=s.replace(marker,insertion+marker);f.write_text(s)
(P/'R043C_SELECTED_ROUTES.json').write_text(json.dumps({'enabledOriginalIds':selected,'disabledTrialIds':[r['id']for r in report['rejected']],'variantRule':'new variants use the reviewed route of their base design; their resulting fit must be checked again','restMaterialChanged':False,'thresholdsChanged':False},indent=2))
report['summary']=readiness['summary'];report['newPassingIds']=sorted(r['id']for r in report['promoted']if r['staticPassed']);report['complete']=True;report['all60GarmentsAccepted']=False;report['numericalWorkerSHA256']=sha((P/'native/kaopu-tailor-workbench/catalogue/native-adapter.mjs').read_bytes())
(P/'R043C_PROMOTION.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('REVIEWED_PROMOTION',json.dumps(report['summary']),selected,flush=True)
