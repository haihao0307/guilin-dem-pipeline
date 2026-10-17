"""Collect fixed approved R05 pure-geometry runtime dependencies, never portrait parameters."""
from pathlib import Path
import json,hashlib,re,urllib.request,urllib.parse,shutil
ROOT=Path('native').resolve();FULL=ROOT/'kaopu-unified-human-workbench/full';OUT=Path('joey-native-runtime-r23');DEST=OUT/'engine/kaopu-unified-human-workbench/full';DEST.mkdir(parents=True,exist_ok=True)
COMMIT='0b4703359efbae10ffc6c0e5fe3fc081e7eca4fe';GNM='https://raw.githubusercontent.com/xrblocks/assets-gnm/134feb02b11fa642a43ff5e7e880246255a74e86/'
manifest={'schema':'kaopu-private-geometry-runtime/1','engine_commit':COMMIT,'containsNewIdentityParameters':False,'containsReferenceImages':False,'purpose':'Local private evaluation of the unchanged complete CommonPerson geometry pipeline','files':[],'assetMap':{},'licenses':[]}
def safe(path):
 p=Path(path).resolve();assert p.is_relative_to(ROOT),p
 assert 'PerimeterStudio' not in str(p),'Excluded inaccessible unrelated module'
 return p
def store(virtual,data,origin,expected=None):
 digest=hashlib.sha256(data).hexdigest()
 if expected:assert digest==expected,(virtual,digest,expected)
 target=DEST/virtual;assert target.resolve().is_relative_to(DEST.resolve());target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
 manifest['files'].append({'virtualPath':virtual,'origin':origin,'sha256':digest,'bytes':len(data),'expectedHashVerified':bool(expected)})
 return data
metaRaw=safe(FULL/'ui/runtime-metadata.json').read_bytes();meta=json.loads(metaRaw);store('ui/runtime-metadata.json',metaRaw,'fixed repo metadata')
for virtual,sha in meta['coreHashes'].items():store(virtual,safe(FULL/virtual).read_bytes(),'fixed repo core/'+virtual,sha)
visited=set()
def module(p):
 p=safe(p)
 if p in visited:return
 visited.add(p);virtual=str(p.relative_to(FULL));data=p.read_bytes()
 if not (DEST/virtual).exists():store(virtual,data,'fixed repo module/'+virtual)
 text=data.decode()
 for child in re.findall(r"(?:from\s*|import\s*\()\s*['\"]([^'\"]+)['\"]",text):
  if child.startswith('.'):
   q=urllib.parse.urlsplit(child).path;module(p.parent/q)
  elif child.startswith('node:'):pass
  else:raise RuntimeError('Unexpected non-relative runtime dependency '+child)
module(FULL/'ui/load-common.mjs')
def asset(virtual,sha=None):
 mapped=meta.get('assetURLs',{}).get(virtual,virtual)
 if mapped.startswith('https://'):
  assert mapped==GNM+'gnm_head_web.bin',mapped
  data=urllib.request.urlopen(mapped,timeout=120).read();origin=mapped
 else:
  p=safe(FULL/mapped);data=p.read_bytes();origin='fixed repo/'+str(p.relative_to(ROOT))
 manifest['assetMap'][mapped]=virtual
 return store(virtual,data,origin,sha)
for virtual,sha in meta['assetHashes'].items():asset(virtual,sha)
for metadataPath,prefix,partsPath in [('source/kaopu-anny-workbench/assets/anny-model.json','source/kaopu-anny-workbench/assets/',('binary','compressed','parts')),('source/kaopu-mhr-workbench/assets/model.json','source/kaopu-mhr-workbench/assets/',('parts',))]:
 j=json.loads((DEST/metadataPath).read_bytes());parts=j
 for k in partsPath:parts=parts[k]
 for part in parts:asset(prefix+(part.get('file') or part['url'].split('/')[-1]),part['sha256'])
licensePaths=['kaopu-anny-workbench/PROVENANCE.json','kaopu-anny-workbench/r02/PROVENANCE.json','kaopu-anny-workbench/licenses/ANNY-APACHE-2.0.txt','kaopu-anny-workbench/licenses/MAKEHUMAN-CC0.txt','kaopu-mhr-workbench/LICENSE-MHR.txt']
for path in licensePaths:
 data=safe(ROOT/path).read_bytes();target=OUT/'licenses'/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);manifest['licenses'].append({'path':str(target.relative_to(OUT)),'origin':'fixed repo/'+path,'sha256':hashlib.sha256(data).hexdigest()})
data=urllib.request.urlopen(GNM+'LICENSE',timeout=60).read();target=OUT/'licenses/GNM-APACHE-2.0.txt';target.write_bytes(data);manifest['licenses'].append({'path':str(target.relative_to(OUT)),'origin':GNM+'LICENSE','sha256':hashlib.sha256(data).hexdigest()})
(OUT/'engine/package.json').write_text('{"type":"module"}\n');manifest['totalBytes']=sum(x['bytes'] for x in manifest['files']);(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps({'files':len(manifest['files']),'moduleFiles':len(visited),'totalBytes':manifest['totalBytes'],'containsNewIdentityParameters':False}))
