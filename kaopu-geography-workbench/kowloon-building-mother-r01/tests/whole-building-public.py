import json,hashlib,time,urllib.request,subprocess,sys
from pathlib import Path
root=Path(__file__).parent
request=json.loads((root/'whole-public-request.json').read_text())
base='https://haihao0307.github.io/guilin-dem-pipeline/'
assert request['baseUrl']==base
reports=[]
for path,expected in request['sha256'].items():
 assert path.startswith('kaopu-geography-workbench/kowloon-building-mother-r01/')
 url=base+path
 with urllib.request.urlopen(url,timeout=45) as r:
  data=r.read();actual=hashlib.sha256(data).hexdigest();assert r.status==200
 assert actual==expected,(path,actual,expected)
 reports.append({'path':path,'sha256':actual,'bytes':len(data)})
out=root.parent/'evidence'/'whole-building-public';out.mkdir(parents=True,exist_ok=True)
(out/'https-hashes.json').write_text(json.dumps({'commit':request['publishedCommit'],'files':reports},indent=2))
subprocess.run([sys.executable,'-u',str(root/'whole-building-browser.py'),'--url',base+'kaopu-geography-workbench/kowloon-building-mother-r01/whole-building-r01.html','--output',str(out)],check=True)
