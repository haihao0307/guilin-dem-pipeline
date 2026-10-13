from pathlib import Path
import urllib.request,hashlib,json,subprocess,sys
R=Path(__file__).resolve().parents[1];url='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/hong-kong-map-sea-r01/'
a=(R/'index.html').read_bytes();req=urllib.request.Request(url+'?verify='+hashlib.sha256(a).hexdigest()[:12],headers={'Cache-Control':'no-cache'});r=urllib.request.urlopen(req,timeout=60);b=r.read();q={'url':url,'status':r.status,'expectedSha256':hashlib.sha256(a).hexdigest(),'publicSha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)};assert a==b,q
subprocess.run([sys.executable,str(R/'qa/browser_check.py'),url+'?verify='+q['expectedSha256'][:12]],check=True)
q['publicWebGLPassed']=json.loads((R/'qa/BROWSER_QA.json').read_text())['passed'];(R/'qa/PUBLIC_QA.json').write_text(json.dumps(q,ensure_ascii=False,indent=2));print(json.dumps(q),flush=True)
