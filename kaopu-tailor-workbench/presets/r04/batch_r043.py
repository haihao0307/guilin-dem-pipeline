from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
import subprocess,json,os,gzip,hashlib,time
P=Path(__file__).parent;O=P/'batch-r043';O.mkdir(exist_ok=True)
rows=json.loads((P/'assets/catalogue.json').read_text())['rows'];old=json.loads((P/'assets/results/index.json').read_text());ids=[r['id'] for r in rows if not old['rows'].get(r['id'],{}).get('qualityPassed')]
if os.environ.get('R043_IDS'):ids=os.environ['R043_IDS'].split(',')
subprocess.run(['python',str(P/'prepare_node_r043.py')],check=True)
def solve(id):
 start=time.monotonic();out=O/(id+'.json.gz');log=O/(id+'.log')
 if not out.exists():
  with log.open('w') as f:
   proc=subprocess.Popen(['node',str(P/'node_solve_r043.mjs'),id,str(out)],stdout=f,stderr=subprocess.STDOUT)
   try:proc.wait(timeout=420)
   except subprocess.TimeoutExpired:
    proc.terminate()
    try:proc.wait(timeout=25)
    except subprocess.TimeoutExpired:proc.kill();proc.wait()
 if not out.exists():return {'id':id,'complete':False,'reason':log.read_text()[-1000:],'seconds':time.monotonic()-start}
 d=json.loads(gzip.decompress(out.read_bytes()));return {'id':id,'complete':'record' in d,'checkpoint':bool(d.get('checkpoint')),'staticPassed':bool(d.get('record',{}).get('staticGate',{}).get('passed')),'failures':d.get('record',{}).get('staticGate',{}).get('failures'),'reason':d.get('error'),'seconds':d.get('elapsedSeconds'),'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}
report={'sourceCommit':os.environ.get('GITHUB_SHA'),'previousPassedPreserved':[i for i,r in old['rows'].items() if r['qualityPassed']],'requested':ids,'rows':[],'sourceGateNotFullClothCertification':True}
with ThreadPoolExecutor(max_workers=int(os.environ.get('R043_PARALLEL','3')))as pool:
 for future in as_completed([pool.submit(solve,id) for id in ids]):
  r=future.result();print('CASE',json.dumps(r,ensure_ascii=False),flush=True);report['rows'].append(r);(P/'BATCH_R043.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
report['complete']=len(report['rows'])==len(ids);report['solverCompleteCount']=sum(r['complete'] for r in report['rows']);report['newStaticPasses']=[r['id'] for r in report['rows'] if r.get('staticPassed')];report['notComplete']=[r['id'] for r in report['rows'] if not r['complete']]
(P/'BATCH_R043.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('FINISHED',report['solverCompleteCount'],report['newStaticPasses'],report['notComplete'])
