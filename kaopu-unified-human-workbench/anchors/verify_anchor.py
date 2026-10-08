#!/usr/bin/env python3
"""Read-only byte verification. Standard library only; no downloads or writes."""
from pathlib import Path
import argparse,gzip,hashlib,json,sys
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--workbench',type=Path,required=True,help='Exact baseline kaopu-unified-human-workbench directory; current repair candidates are expected to differ.')
p.add_argument('--asset-cache',type=Path,help='Optional complete local full/ cache using runtimePath layout; no asset downloads are performed.')
p.add_argument('--manifest',type=Path,default=Path(__file__).with_name('ANCHOR-MANIFEST-20261008.json'))
a=p.parse_args();m=json.loads(a.manifest.read_text());root=m['baseline']['targetPath']+'/'
failures=[];checked=[]
def check(label,read,sha,byte_length,git=None):
 try:
  data=read();actual=hashlib.sha256(data).hexdigest()
  if actual!=sha or len(data)!=byte_length:raise ValueError('SHA-256 or byte length mismatch')
  if git and hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()!=git:raise ValueError('Git blob mismatch')
  checked.append(label)
 except Exception as e:failures.append({'path':label,'error':str(e)})
for item in m['files']:
 path=item['path'];assert path.startswith(root)
 rel=path[len(root):];check(path,lambda rel=rel:(a.workbench/rel).read_bytes(),item['sha256'],item['byteLength'],item['gitBlobSHA1'])
if a.asset_cache:
 entries=m['registryAndAssets']
 for item in entries:
  path=item['runtimePath']
  def read(item=item,path=path):
   if path.endswith('<decompressed>'):return gzip.decompress((a.asset_cache/path.removesuffix('<decompressed>')).read_bytes())
   if path.endswith('<decompressed-concatenated-parts>'):
    prefix=path.removesuffix('<decompressed-concatenated-parts>');parts=[x for x in entries if x['kind']=='native-part' and x['runtimePath'].startswith(prefix)]
    return gzip.decompress(b''.join((a.asset_cache/x['runtimePath']).read_bytes() for x in parts))
   return (a.asset_cache/path).read_bytes()
  check(path,read,item['expectedSHA256'],item['byteLength'])
result={'baselineCommit':m['baseline']['commit'],'passed':not failures,'sourceFilesChecked':len(m['files']),'registryAndAssetsChecked':len(m['registryAndAssets']) if a.asset_cache else 0,'assetsStatus':'checked' if a.asset_cache else 'not requested / not checked','failed':failures,'visualAcceptance':False,'note':'Byte identity only. Head linkage and visual quality require separate validation.'}
print(json.dumps(result,ensure_ascii=False,indent=2));sys.exit(1 if failures else 0)
