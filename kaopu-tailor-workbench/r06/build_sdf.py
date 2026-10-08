"""Reproducible full-body collision field; original source body stays byte-identical."""
from pathlib import Path
import array, gzip, hashlib, json, os, subprocess, sys, tempfile
ROOT=Path(__file__).resolve().parent
body_path=ROOT.parent/'garments-r04/assets/body-anny-adult.json'
raw=body_path.read_bytes()
assert hashlib.sha256(raw).hexdigest()=='73c448ddb553e34b77a8bb3a46ae919f05159cde58a730e1de9f9c2bddab710b'
body=json.loads(raw);assets=ROOT/'assets';assets.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory() as tmp:
 tmp=Path(tmp);mesh=tmp/'body.mesh'
 with mesh.open('w') as f:
  f.write(f"{len(body['positionsMm'])} {len(body['triangles'])}\n")
  for p in body['positionsMm']: f.write(' '.join(map(str,p))+'\n')
  for t in body['triangles']: f.write(' '.join(map(str,t))+'\n')
 subprocess.run(['g++','-O3','-std=c++17','-fopenmp',str(ROOT/'body_field.cpp'),'-o',str(tmp/'field')],check=True)
 subprocess.run([str(tmp/'field'),str(mesh),str(tmp/'field.i16')],check=True,env={**os.environ,'OMP_NUM_THREADS':os.environ.get('OMP_NUM_THREADS','4')})
 rawfield=(tmp/'field.i16').read_bytes();field=array.array('h');field.frombytes(rawfield)
 if sys.byteorder!='little': field.byteswap()
 assert len(field)==261*391*131
 delta=array.array('H');prev=0
 for val in field:
  delta.append((val-prev)&65535);prev=val
 if sys.byteorder!='little':delta.byteswap()
 payload=gzip.compress(delta.tobytes(),compresslevel=7,mtime=0)
 name='body-full.sdfd.gz';(assets/name).write_bytes(payload)
 meta={'dimensions':[261,391,131],'originMm':[-650,-50,-200],'spacingMm':5,'quantizationMm':.05,'count':len(field),'sourceBodyAsset':'../../garments-r04/assets/body-anny-adult.json','sourceBodyAssetSha256':hashlib.sha256(raw).hexdigest(),'method':'Exact nearest original body triangle BVH; signed by interpolated area-weighted vertex normals; 5 mm grid. Not continuous collision detection.','bodyUnchanged':True,'transport':{'file':name,'encoding':'int16-delta-gzip','decodedBytes':len(rawfield),'decodedSha256':hashlib.sha256(rawfield).hexdigest(),'encodedSha256':hashlib.sha256(payload).hexdigest()}}
 (assets/'body-sdf-grid.json').write_text(json.dumps(meta,indent=2)+'\n')
 print('Full-body field bytes',len(payload),'sha256',meta['transport']['encodedSha256'])
