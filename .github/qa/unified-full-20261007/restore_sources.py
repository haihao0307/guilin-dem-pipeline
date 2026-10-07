"""Restore immutable published teacher data; never download full TorchScript teachers.
Every file is checked against a Git blob from SOURCE-LOCK.json before use.
Reuse the verified neck-work cache when present. The download path is reproducible.
"""
from pathlib import Path
import concurrent.futures,urllib.request,hashlib,json,gzip,os
R=Path(__file__).resolve().parent;lock=json.loads((R/'SOURCE-LOCK.json').read_text());O=R/'source';cache=R.parent/'neck-repair-20261007/baseline';rows=[]
def sha(b):return hashlib.sha256(b).hexdigest()
def fetch(f):
 p=O/f['path'];p.parent.mkdir(parents=True,exist_ok=True);source=cache/f['path'];where='existing';url=f.get('url',f"https://raw.githubusercontent.com/{lock['repository']}/{lock['commit']}/{f['path']}")
 if p.exists():b=p.read_bytes()
 elif source.is_file():b=source.read_bytes();where='verified-existing-cache'
 else:
  with urllib.request.urlopen(url,timeout=90)as x:b=x.read()
  where='immutable-public-source'
 assert len(b)==f['bytes'],(f['path'],'length');assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==f['gitBlobSHA'],(f['path'],'Git blob')
 if f.get('sha256'):assert sha(b)==f['sha256'],f['path']
 if not p.exists():
  if source.is_file():os.link(source,p)
  else:p.write_bytes(b)
 return{**f,'url':url,'sha256':sha(b),'recoveredVia':where}
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:rows=list(pool.map(fetch,lock['files']))
# Decode only the actual browser arrays after verifying their joined hashes.
am=json.loads((O/'kaopu-anny-workbench/assets/anny-model.json').read_text());parts=am['binary']['compressed'];compressed=b''.join((O/'kaopu-anny-workbench'/p['url']).read_bytes()for p in parts['parts']);assert sha(compressed)==parts['sha256'];raw=gzip.decompress(compressed);assert sha(raw)==am['binary']['sha256'];(O/'anny-model.raw.bin').write_bytes(raw)
mm=json.loads((O/'kaopu-mhr-workbench/assets/model.json').read_text());mhrparts=[]
for part in mm['parts']:
 data=(O/'kaopu-mhr-workbench/assets'/part['file']).read_bytes();assert len(data)==part['bytes']and sha(data)==part['sha256'];mhrparts.append(data)
mp=b''.join(mhrparts);assert len(mp)==mm['compressed_bytes'];mraw=gzip.decompress(mp);assert len(mraw)==mm['raw_bytes'];(O/'mhr-model.raw.bin').write_bytes(mraw)
fm=json.loads((O/'kaopu-anny-workbench/r02/assets/facial-actions.json').read_text());fb=(O/'kaopu-anny-workbench/r02/assets/facial-actions.bin.gz').read_bytes();assert sha(fb)==fm['compressedSha256'];assert sha(gzip.decompress(fb))==fm['rawSha256']
(R/'SOURCE-RESTORE-RECEIPT.json').write_text(json.dumps({'commit':lock['commit'],'files':rows,'teacherModelsNotBundledInThisCheckpoint':True,'decoded':{'anny':{'bytes':len(raw),'sha256':sha(raw)},'mhr':{'bytes':len(mraw),'sha256':sha(mraw)}}},indent=2));print(json.dumps({'restored':len(rows),'newDownloadBytes':sum(r['bytes']for r in rows if r['recoveredVia']=='immutable-public-source'),'cachedFiles':sum(r['recoveredVia']=='verified-existing-cache'for r in rows)}))
