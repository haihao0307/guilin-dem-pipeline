import json,hashlib,urllib.request
from pathlib import Path
BASE='https://haihao0307.github.io/guilin-dem-pipeline/'
expected=json.loads((Path(__file__).parent/'public-expected.json').read_text())
results=[]
for path,sha in expected.items():
 with urllib.request.urlopen(BASE+path,timeout=120) as r: data=r.read()
 actual=hashlib.sha256(data).hexdigest()
 assert actual==sha,(path,sha,actual)
 results.append({'path':path,'bytes':len(data),'sha256':actual})
Path('skin-public-hash-report.json').write_text(json.dumps({'passed':True,'count':len(results),'files':results},indent=2))
print('Exact public files verified:',len(results))
