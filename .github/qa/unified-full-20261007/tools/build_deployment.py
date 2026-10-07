"""Deterministic thin deployment: fixed shared assets are referenced, never duplicated.
Run after restore_sources.py, prepare_common.py and UI metadata generation.
Only manifest.files are publication candidates. materialize_shared() is QA-only.
"""
from pathlib import Path
import hashlib,json,re,shutil,os
R=Path(__file__).resolve().parents[1];D=R/'deployment';P=D/'kaopu-unified-human-workbench';F=P/'full';files={};shared={};external=[]
def sha(b):return hashlib.sha256(b).hexdigest()
def put(rel,data):
 p=P/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data);files[rel]={'path':'kaopu-unified-human-workbench/'+rel,'bytes':len(data),'sha256':sha(data),'gitBlobSHA':hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()}
def copy(rel):put('full/'+rel,(R/rel).read_bytes())
metadata=json.loads((R/'ui/runtime-metadata.json').read_text());urls={}
# Keep imports byte-identical except the three.js forwarding module, which shares
# the same already published pinned vendor and therefore the same module identity.
seen=set()
def module(rel):
 if rel in seen:return
 seen.add(rel)
 if rel=='source/registration-vendor/three.module.js':
  put('full/'+rel,b"export * from '../../../vendor/three.module.js';\n");shared['kaopu-unified-human-workbench/vendor/three.module.js']=R/rel;return
 data=(R/rel).read_bytes();put('full/'+rel,data)
 for dep in re.findall(r"(?:from\s*|import\s*)['\"]([^'\"]+)['\"]",data.decode()):
  if dep.startswith('.'):
   q=Path(os.path.normpath((R/rel).parent.joinpath(dep)));assert q.is_relative_to(R);module(str(q.relative_to(R)))
module('ui/browser-app.mjs')
for rel in metadata['coreHashes']:
 if rel not in seen:module(rel)
for rel in ['UI-CONTRACT.json','COVERAGE.json','HEAD-UI-CONTRACT.json','NOTICE.md','SOURCE-LOCK.json','HEAD-ADAPTER-LOCK.json','ui/workbench.css','ui/VENDOR-PROVENANCE.json','ui/vendor/LICENSE-THREE.txt','research/anny-local-region-gates.json','assets/head-transfer.json','assets/head-transfer.bin.gz','body-adapter/map-indices.u32','body-adapter/map-bary.f32','source/neck-baseline/assets/kernel.json']:
 copy(rel)
notice=(F/'NOTICE.md').read_text().replace('../../../kaopu-unified-human-workbench/licenses/','../licenses/').replace('../../../kaopu-mhr-workbench/','../../kaopu-mhr-workbench/')
put('full/NOTICE.md',notice.encode())
for rel in metadata['assetHashes']:
 if rel=='source/kaopu-face-workbench/assets/gnm_head_web.bin':
  row=next(x for x in json.loads((R/'SOURCE-LOCK.json').read_text())['files']if x['path']==rel.removeprefix('source/'));urls[rel]=row['url'];external.append({k:row[k]for k in ['url','bytes','sha256','gitBlobSHA']});external[-1]['runtimePath']=rel
 elif rel.startswith('source/kaopu-'):
  target=rel.removeprefix('source/');urls[rel]='../../'+target;shared[target]=R/rel
 elif rel=='source/neck-baseline/assets/kernel.bin.gz':
  urls[rel]='../assets/neck-surface.bin.gz';shared['kaopu-unified-human-workbench/assets/neck-surface.bin.gz']=R/rel
for teacher,metaPath in [('anny','source/kaopu-anny-workbench/assets/anny-model.json'),('mhr','source/kaopu-mhr-workbench/assets/model.json')]:
 m=json.loads((R/metaPath).read_text());parts=m['binary']['compressed']['parts']if teacher=='anny'else m['parts']
 for part in parts:
  file=part.get('file')or part['url'].split('/')[-1];rel=f'source/kaopu-{teacher}-workbench/assets/'+file;target=rel.removeprefix('source/');urls[rel]='../../'+target;shared[target]=R/rel
metadata['assetURLs']=urls;metadata['deploymentNote']='Thin fixed-mesh runtime. All shared teacher files retain their tested byte hashes.'
put('full/ui/runtime-metadata.json',(json.dumps(metadata,indent=2)+'\n').encode())
html=(R/'qa/full-workbench.html').read_text().replace('../ui/','./full/ui/').replace('../source/registration-vendor/','./full/source/registration-vendor/').replace('三老师参数测试','全参数兼容测试').replace('全参数候选 · 适配误差与扩展接口另列','成人基础参数已验 · 年龄与扩展边界另列').replace('</header>','<a href="./index-minimal.html">已验最小版</a></header>')
put('index.html',html.encode());put('index-minimal.html',(R/'fixtures/public-r01-index.html').read_bytes())
# Verify every local script/data hash, before creating QA-only copies of shared files.
for rel,h in metadata['coreHashes'].items():assert sha((F/rel).read_bytes())==h,rel
for rel,h in metadata['assetHashes'].items():assert sha((R/rel).read_bytes())==h,rel
manifest={'schema':'common-person-deployment/1','mathCheckpoint':'29109562604f9fdfa7def1aa3652258b722b0ad7','adapterFingerprint':metadata['adapterFingerprint'],'protectedMinimumIndexSourceCommit':'e7125bf26e7865e306937f4e65fa712d6adc55b0','files':list(files.values()),'shared':[],'external':external,'productionChanged':False}
for target,src in sorted(shared.items()):
 data=src.read_bytes();manifest['shared'].append({'path':target,'bytes':len(data),'sha256':sha(data),'gitBlobSHA':hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()})
 # QA only: exact existing public dependency path, excluded from publication manifest.
 p=D/target;p.parent.mkdir(parents=True,exist_ok=True)
 if not p.exists()or sha(p.read_bytes())!=sha(data):shutil.copyfile(src,p)
(R/'DEPLOYMENT-MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'files':len(files),'publicationBytes':sum(x['bytes']for x in files.values()),'sharedBytes':sum(x['bytes']for x in manifest['shared'])+sum(x['bytes']for x in external),'fingerprint':metadata['adapterFingerprint']}))
