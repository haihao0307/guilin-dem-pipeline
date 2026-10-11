"""Freeze original CommonPerson code byte-for-byte and resolve data URLs to its existing commit."""
from pathlib import Path,PurePosixPath
from urllib.parse import urljoin,urlsplit
from urllib.request import urlopen,Request
import hashlib,json,re,time
P=Path(__file__).resolve().parent
SHA='537c0f619fb9391c6a1e72ee29d2f889b5d1782f'
REPO='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/'+SHA+'/'
PREFIX='kaopu-unified-human-workbench/full/'
DEST=P/'person-core'
assert not DEST.exists(),'Do not overwrite a frozen runtime'
def digest(b):return hashlib.sha256(b).hexdigest()
def read(path):
 assert not path.startswith('/') and '..' not in PurePosixPath(path).parts
 for attempt in range(4):
  try:
   with urlopen(Request(REPO+path,headers={'User-Agent':'KAOPU-Tailor-R0434'}),timeout=60) as r:return r.read()
  except Exception:
   if attempt==3:raise
   time.sleep(1+attempt)
metadata_bytes=read(PREFIX+'ui/runtime-metadata.json');metadata=json.loads(metadata_bytes)
roots=['ui/load-common.mjs','ui/Viewer.mjs','src/State.mjs','ui/PresetCatalogueR2.mjs','source/registration-vendor/three.module.js']
pending=[PREFIX+n for n in [*roots,*metadata['coreHashes']]];copied={}
pattern=re.compile(r'''\b(?:from\s*|import\s*(?:\(\s*)?)(['"])([^'"\n]+)\1''')
while pending:
 name=pending.pop()
 if name in copied:continue
 assert name.endswith(('.js','.mjs')),('Review non-module dependency',name)
 data=read(name);assert len(data)<8000000,('Unexpectedly large code module',name)
 text=data.decode('utf-8');copied[name]={'sha256':digest(data),'bytes':len(data)}
 target=DEST/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
 for match in pattern.finditer(text):
  source=match.group(2)
  if source=='three':pending.append(PREFIX+'source/registration-vendor/three.module.js');continue
  if not source.startswith(('./','../')):raise AssertionError(('Unpinned module import requires review',name,source))
  resolved=urljoin('https://frozen.invalid/'+name,source);path=urlsplit(resolved).path.lstrip('/')
  assert path.startswith('kaopu-unified-human-workbench/'),('Module escapes original common-person subtree',name,source)
  pending.append(path)
for name,expected in metadata['coreHashes'].items():assert copied[PREFIX+name]['sha256']==expected,('Original core integrity mismatch',name)
asset_urls=dict(metadata.get('assetURLs',{}));rewritten={}
for name in sorted(set(metadata['assetHashes'])|set(asset_urls)):
 old=asset_urls.get(name,name);new=urljoin(REPO+PREFIX,old)
 assert urlsplit(new).scheme=='https' and urlsplit(new).hostname=='raw.githubusercontent.com',('Review non-pinned asset origin',name,new)
 if not new.startswith(REPO):assert '/134feb02b11fa642a43ff5e7e880246255a74e86/' in new,('External asset must be original immutable ref',new)
 rewritten[name]=new
metadata['assetURLs']=rewritten
metadata['tailorRuntimeFreeze']={'sourceCommit':SHA,'copiedCoreUnmodified':True,'geometryAndAdapterUnchanged':True}
meta=DEST/PREFIX/'ui/runtime-metadata.json';meta.write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
original='https://haihao0307.github.io/guilin-dem-pipeline/'+PREFIX
for name,count in [('app.mjs',5),('index.html',1)]:
 f=P/name;text=f.read_text();assert text.count(original)==count,(name,text.count(original))
 f.write_text(text.replace(original,'./person-core/'+PREFIX))
proof={'schema':'kaopu-tailor-common-runtime-pin@1','sourceCommit':SHA,'originalMetadataSHA256':digest(metadata_bytes),'localMetadataSHA256':digest(meta.read_bytes()),'coreFiles':copied,'assetURLs':rewritten,'coreHashesUnchanged':True,'adapterFingerprint':metadata['adapterFingerprint'],'vertices':metadata['vertices'],'triangles':metadata['triangles'],'bodyScaling':False,'newMannequin':False,'thirdPartyBinaryDuplicated':False,'note':'Original repository-relative module layout is retained, including shared Three.js vendor. Only code is copied; binary reads resolve existing immutable original assets. Original identity checks remain mandatory.'}
(P/'R0434_PERSON_PIN.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2))
print('ORIGINAL_PERSON_PINNED',len(copied),sum(r['bytes'] for r in copied.values()),flush=True)
