from pathlib import Path
import urllib.request,hashlib,json,subprocess,sys,time
R=Path(__file__).resolve().parents[1]
url='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/hong-kong-map-sea-r03/'
a=(R/'index.html').read_bytes();expected=hashlib.sha256(a).hexdigest();deadline=time.time()+1800
while True:
 try:
  req=urllib.request.Request(url+'?verify='+expected[:12],headers={'Cache-Control':'no-cache'});r=urllib.request.urlopen(req,timeout=60);b=r.read()
  q={'url':url,'status':r.status,'expectedSha256':expected,'publicSha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)}
  if a==b:
   asset=(R/'station-data.js').read_bytes();actual=urllib.request.urlopen(url+'station-data.js?verify='+expected[:12],timeout=60).read();q['stationDataSha256']=hashlib.sha256(actual).hexdigest();q['stationDataBytes']=len(actual);q['totalRuntimeBytes']=len(b)+len(actual)
   if asset==actual:break
  print('Waiting for exact deployment',q['publicSha256'],flush=True)
 except Exception as e:print('Waiting for deployment',type(e).__name__,str(e),flush=True)
 if time.time()>deadline:raise RuntimeError('Exact public deployment not observed within this CI job window')
 time.sleep(15)
subprocess.run([sys.executable,str(R/'qa/browser_check.py'),url+'?verify='+expected[:12]],check=True)
q['publicWebGLPassed']=json.loads((R/'qa/BROWSER_QA.json').read_text())['passed'];(R/'qa/PUBLIC_QA.json').write_text(json.dumps(q,ensure_ascii=False,indent=2));print(json.dumps(q),flush=True)
