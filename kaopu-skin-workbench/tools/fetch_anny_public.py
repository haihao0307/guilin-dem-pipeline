"""Read-only QA dependency: fetch the published, already-approved Anny bytes.
Does not rebuild teachers, publish assets, or require credentials.
"""
from pathlib import Path
import json,hashlib,re,urllib.request
BASE='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-anny-workbench/'
ROOT=Path('kaopu-anny-workbench');ASSETS=ROOT/'assets';ASSETS.mkdir(parents=True,exist_ok=True)
RAW='57cb642954bfee0c7589626a22726f5584490f74a1e38e7db8eb78a8392f57b1'
GZIP='2efd8da238bf7df2794c71db2578d0280b79d976d719543df83d0ac0148c428a'
def get(relative):
 with urllib.request.urlopen(BASE+relative,timeout=120) as response:return response.read()
metadata=get('assets/anny-model.json');m=json.loads(metadata);b=m['binary'];z=b['compressed']
assert b['sha256']==RAW and b['byteLength']==117588304
assert z['sha256']==GZIP and z['byteLength']==45650600 and z['encoding']=='gzip'
assert len(z['parts'])==6
for i,p in enumerate(z['parts']):
 name=f'anny-model-{i:02}.bin.part';assert p['url']=='./assets/'+name
 data=get('assets/'+name);assert len(data)==p['byteLength'];assert hashlib.sha256(data).hexdigest()==p['sha256']
 (ASSETS/name).write_bytes(data)
(ASSETS/'anny-model.json').write_bytes(metadata)
receipt={'source':BASE,'readOnly':True,'rebuildTeachers':False,'rawSHA256':RAW,'gzipSHA256':GZIP,'parts':6,'metadataSHA256':hashlib.sha256(metadata).hexdigest()}
(ASSETS/'public-fetch-receipt.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
