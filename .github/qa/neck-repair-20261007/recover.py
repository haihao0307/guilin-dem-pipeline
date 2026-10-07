from pathlib import Path
import urllib.request, concurrent.futures, hashlib, json, gzip
ROOT=Path(__file__).resolve().parent
COMMIT='cdf2ac931e444875dd400eafada7ee118702147f'
BASE=f'https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/{COMMIT}/'
FILES={
 'kaopu-skin-workbench':['src/app.js','src/SkinMaterial.js','src/UnifiedModel.js','src/AnnyModel.js','src/GNMModel.js','index.html','style.css','package.json','assets/canonical.json.gz','assets/mhr-torso-delta.json.gz','assets/adapter-fingerprint.json','vendor/three.module.js','vendor/OrbitControls.js','tests/browser.cjs'],
 'kaopu-unified-human-workbench':['src/app.js','src/R01Assets.js','src/LifeEpoch.mjs','src/UnifiedModel.js','src/AnnyModel.js','src/GNMModel.js','index.html','style.css','package.json','assets/canonical.json.gz','assets/mhr-torso-delta.json.gz','assets/adapter-fingerprint.json','vendor/three.module.js','vendor/OrbitControls.js','tools/build_seam.py','tools/build_fingerprint.py','tests/model.mjs','tests/neck_geometry.py'],
 'kaopu-anny-workbench':['assets/anny-model.json'],
}
rows=[]
def fetch(row):
 rel,url,sha=row;dest=ROOT/'baseline'/rel
 if not dest.exists():
  dest.parent.mkdir(parents=True,exist_ok=True)
  with urllib.request.urlopen(url,timeout=120)as response: data=response.read()
  dest.write_bytes(data)
 else:data=dest.read_bytes()
 digest=hashlib.sha256(data).hexdigest()
 if sha:assert digest==sha,(rel,digest,sha)
 result={'path':rel,'url':url,'bytes':len(data),'sha256':digest,'gitBlobSHA':hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()};print(rel,len(data),flush=True);return result
jobs=[(f'{folder}/{name}',BASE+f'{folder}/{name}',None)for folder,files in FILES.items()for name in files]
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:rows.extend(pool.map(fetch,jobs))
am=json.loads((ROOT/'baseline/kaopu-anny-workbench/assets/anny-model.json').read_text());parts=am['binary']['compressed']['parts']
jobs=[]
for p in parts:
 rel='kaopu-anny-workbench/'+p['url'].removeprefix('./');jobs.append((rel,BASE+rel,p['sha256']))
jobs.append(('kaopu-face-workbench/assets/gnm_head_web.bin','https://raw.githubusercontent.com/xrblocks/assets-gnm/134feb02b11fa642a43ff5e7e880246255a74e86/gnm_head_web.bin','fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961'))
with concurrent.futures.ThreadPoolExecutor(max_workers=3)as pool:rows.extend(pool.map(fetch,jobs))
packed=b''.join((ROOT/'baseline/kaopu-anny-workbench'/p['url'].removeprefix('./')).read_bytes()for p in parts);assert hashlib.sha256(packed).hexdigest()==am['binary']['compressed']['sha256'];raw=gzip.decompress(packed);assert hashlib.sha256(raw).hexdigest()==am['binary']['sha256'];(ROOT/'baseline/kaopu-anny-workbench/assets/anny-model.bin').write_bytes(raw)
for folder in ['kaopu-skin-workbench','kaopu-unified-human-workbench']:
 for name in ['canonical','mhr-torso-delta']:
  p=ROOT/'baseline'/folder/'assets'/f'{name}.json';p.write_bytes(gzip.decompress(p.with_suffix('.json.gz').read_bytes()))
(ROOT/'recovery-receipt.json').write_text(json.dumps({'commit':COMMIT,'files':rows,'teacherBytesVerified':True},indent=2));print('RECOVERED',len(rows),'files',flush=True)
