"""Read-only byte verification of the 45 already-published unified files."""
from pathlib import Path
import json,hashlib,urllib.request,concurrent.futures
ROOT=Path(__file__).resolve().parents[1];spec=json.loads((ROOT/'tests/public-manifest.json').read_text())
def one(row):
 url=spec['baseURL']+row['path']
 with urllib.request.urlopen(url,timeout=120) as response:data=response.read();status=response.status
 actual=hashlib.sha256(data).hexdigest()
 return {'path':row['path'],'url':url,'status':status,'bytes':len(data),'expectedSHA256':row['sha256'],'actualSHA256':actual,'passed':status==200 and actual==row['sha256']}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:rows=list(pool.map(one,spec['files']))
report={'productionCommit':spec['productionCommit'],'baseURL':spec['baseURL'],'passed':all(r['passed'] for r in rows),'files':rows,'readOnly':True};(ROOT/'unified-public-hash-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report));assert report['passed']
