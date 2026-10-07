"""Verify the exact authorized product bytes after Pages publication.
Read-only. Run in an authorized network-enabled CI environment.
"""
from pathlib import Path
import argparse,concurrent.futures,hashlib,json,urllib.request
p=argparse.ArgumentParser();p.add_argument('manifest',type=Path);p.add_argument('--out',type=Path,default=Path('coral-public-bytes.json'));args=p.parse_args()
m=json.loads(args.manifest.read_text());base='https://haihao0307.github.io/guilin-dem-pipeline/'
def check(item):
    url=base+item['path']+'?verify='+item['sha256'][:16]
    request=urllib.request.Request(url,headers={'Cache-Control':'no-cache'})
    try:
        with urllib.request.urlopen(request,timeout=60) as response:data=response.read();status=response.status
        actual=hashlib.sha256(data).hexdigest()
        return {'path':item['path'],'status':status,'sha256':actual,'bytes':len(data),'passed':status==200 and actual==item['sha256']}
    except Exception as e:return {'path':item['path'],'passed':False,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:rows=list(pool.map(check,m['files']))
result={'passed':all(x['passed'] for x in rows),'files':rows,'expectedFrozenProduct':m['frozenProductCommit'],'url':base+'coral-mother-core-seed-r01/growth-lab-r01/'}
args.out.write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
if not result['passed']:raise SystemExit(1)
