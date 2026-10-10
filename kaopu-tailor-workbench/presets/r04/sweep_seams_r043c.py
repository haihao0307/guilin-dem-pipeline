"""Re-solve only changed slight-ease assembly routes; preserve every other record."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
import subprocess,json,gzip,hashlib,os,time
P=Path(__file__).parent;O=P/'batch-r043c';O.mkdir(exist_ok=True);A=P/'assets';I=A/'results/index.json'
load=lambda n:json.loads((P/n).read_text());sha=lambda b:hashlib.sha256(b).hexdigest()
index=load('assets/results/index.json');old=load('assets/results/index.json');cat=load('assets/catalogue.json')['rows'];ids=[]
for id,row in index['rows'].items():
 if row['qualityPassed']:continue
 d=json.loads(gzip.decompress((A/'results'/row['file']).read_bytes()))
 if any(s.get('numericalStitchPlan') and max(s['sourceSeam']['lengthAMm'],s['sourceSeam']['lengthBMm'])/min(s['sourceSeam']['lengthAMm'],s['sourceSeam']['lengthBMm'])<=1.12+1e-12 for s in d['spec']['seams']):ids.append(id)
assert len(ids)==24
subprocess.run(['python',str(P/'prepare_node_r043.py')],check=True)
report={'sourceCommit':os.environ['GITHUB_SHA'],'baselineSummary':load('assets/readiness.json')['summary'],'affectedSourceIds':ids,'originalMaterialAndQualityGatesUnchanged':True,'rows':[]}
def solve(id):
 out=O/(id+'.json.gz')
 with (O/(id+'.log')).open('w') as log:
  proc=subprocess.Popen(['node',str(P/'node_solve_r043.mjs'),id,str(out)],stdout=log,stderr=subprocess.STDOUT)
  try:proc.wait(timeout=600)
  except subprocess.TimeoutExpired:
   proc.terminate()
   try:proc.wait(timeout=25)
   except subprocess.TimeoutExpired:proc.kill();proc.wait()
 if not out.exists():raise RuntimeError(id+' did not write a truthful outcome')
 d=json.loads(gzip.decompress(out.read_bytes()));row={'id':id,'complete':bool(d.get('record')),'passed':bool(d.get('record',{}).get('staticGate',{}).get('passed')),'failures':d.get('record',{}).get('staticGate',{}).get('failures'),'error':d.get('error'),'elapsedSeconds':d.get('elapsedSeconds')}
 return row,d
with ThreadPoolExecutor(max_workers=3)as pool:
 for fut in as_completed([pool.submit(solve,id)for id in ids]):
  row,d=fut.result();id=row['id'];report['rows'].append(row);print('SEAM_CASE',json.dumps(row,ensure_ascii=False),flush=True)
  if d.get('record'):
   prior=json.loads(gzip.decompress((A/'results'/old['rows'][id]['file']).read_bytes()))
   assert d['binding']['materialSHA256']==prior['binding']['materialSHA256'],id+' material changed'
   assert d['record']['nativeBinding']==d['binding']
   assert d['record']['staticGate']['thresholds']==prior['record']['staticGate']['thresholds']
   packet={k:d[k]for k in ['binding','spec','record']};packet.update(sourceRun=os.environ['GITHUB_SHA'],complete=True)
   raw=gzip.compress(json.dumps(packet,ensure_ascii=False,separators=(',',':')).encode(),mtime=0);(A/'results'/(id+'.json.gz')).write_bytes(raw)
   index['rows'][id]={**old['rows'][id],'file':id+'.json.gz','sha256':sha(raw),'qualityPassed':row['passed'],'thumbReady':False,'kind':'NATIVE_LIGHT_EASE_SPAN_CORRECTION'}
  (P/'R043C_SWEEP.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
assert all(r['complete']for r in report['rows']),'No incomplete correction can replace a complete published result'
preserved={id:r['sha256']for id,r in old['rows'].items()if id not in ids}
assert all(sha((A/'results'/index['rows'][id]['file']).read_bytes())==h for id,h in preserved.items())
assert all(index['rows'][id]['qualityPassed']for id,r in old['rows'].items()if r['qualityPassed'])
report['preservedRecordSHA256']=preserved;report['newPassingIds']=[r['id']for r in report['rows']if r['passed']];report['summary']={**load('assets/readiness.json')['summary'],'staticGatePassedRecords':sum(r['qualityPassed']for r in index['rows'].values())}
report['all60GarmentsAccepted']=all(r['qualityPassed']for r in index['rows'].values());report['complete']=True
index['sourceCommit']=os.environ['GITHUB_SHA'];index['source']='native-r043c-source-material-light-ease-spans';I.write_text(json.dumps(index,ensure_ascii=False,indent=2))
r=load('assets/readiness.json');r['summary']=report['summary'];(A/'readiness.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));(P/'R043C_SWEEP.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('SEAM_SUMMARY',json.dumps(report['summary']),flush=True)
