"""Rerun pinned knowledge probes; generated output fields may contain historical labels."""
from pathlib import Path
import subprocess,hashlib,json,sys,time,platform,datetime,argparse
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo-root',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
SKILLS=args.repo_root/'docs/mother_coordination/learning-r1-20260905/skills'
EXPECTED={
'curl-warp-composition/composition_probe.py':'f4e8033c4a65ad545f747eb28a94ef23f91fb3cf',
'procedural-noise-audit/noise_contract_probe.py':'98bdb212a7fdab40b3f717d0bad441867ce14a58',
'realtime-stream-time/temporal_probe.py':'a684270c5c20c31e0615cdae6bfeae807f6aaf8c',
'ocean-function-source-review/ocean_contract_probe.py':'d796a4ff7d5fa770ad672e158a15ed219688ccad',
'local-collective-motion/probe.py':'b0e27cf09ffeaea9439c7fc5fa976b852f66823c',
'gaze-and-bounded-micro-motion/probe.py':'b5faad7568caed1df1d9c581092fde9f1881b129',
'surface-and-volume-optics/probe.py':'c1f73d3bd67f9c76eab60bafc6fc6d05216cc526'}
rows=[]
for rel,sha in EXPECTED.items():
 p=SKILLS/rel;b=p.read_bytes();actual=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
 assert sha==actual,(rel,actual,sha)
 start=time.perf_counter();cp=subprocess.run([sys.executable,str(p)],capture_output=True,text=True,timeout=20)
 row={'path':rel,'git_blob':actual,'sha256':hashlib.sha256(b).hexdigest(),'returncode':cp.returncode,'wall_ms':round(1000*(time.perf_counter()-start),3)}
 try:row['output']=json.loads(cp.stdout)
 except ValueError:row['stdout']=cp.stdout
 row['stderr']=cp.stderr;row['passed']=cp.returncode==0
 rows.append(row)
 print(rel,'PASS' if row['passed'] else 'FAIL',row.get('output',{}).get('checks','groups/multicase'))
report={'base_commit':'1fc23df1dd253d4785e05b19154cf443b4636ced','executed_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'environment':{'python':platform.python_version(),'platform':platform.platform()},'suites':rows,'passed_suites':sum(x['passed'] for x in rows),'scope':'Seven existing pinned CPU knowledge probes; no production assets or upstream apps executed. Four older probes count groups/cases, not comparable numbered checks. Historical npm-attempt text in gaze output is inherited from its source, not a new npm attempt.'}
args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
assert report['passed_suites']==len(rows)
