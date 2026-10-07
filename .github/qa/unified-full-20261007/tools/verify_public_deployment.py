"""Read-only byte verification of the exact permitted public common-model URL."""
import sys,json,hashlib,urllib.request,concurrent.futures
from pathlib import Path
R=Path(__file__).resolve().parents[1];manifestPath=R/'DEPLOYMENT-45-MANIFEST.json';manifest=json.loads((manifestPath if manifestPath.exists()else R/'DEPLOYMENT-MANIFEST.json').read_text());url=sys.argv[1];base='https://haihao0307.github.io/guilin-dem-pipeline/'
assert url in [base+'kaopu-unified-human-workbench/',base+'kaopu-unified-human-workbench/index.html']
rows=[{**r,'url':base+r['path']}for r in manifest['files']+manifest['shared']]+manifest['external']
def check(row):
 with urllib.request.urlopen(row['url'],timeout=120)as response:b=response.read();status=response.status
 digest=hashlib.sha256(b).hexdigest();assert status==200 and digest==row['sha256'] and len(b)==row['bytes'],row['url']
 return {'url':row['url'],'status':status,'bytes':len(b),'sha256':digest}
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:results=list(pool.map(check,rows))
out={'passed':True,'url':url,'count':len(results),'files':results,'adapterFingerprint':manifest['adapterFingerprint']};(R/'research/PUBLIC-BYTE-RECEIPT.json').write_text(json.dumps(out,indent=2)+'\n');print('Public exact-byte checks passed:',len(results))
