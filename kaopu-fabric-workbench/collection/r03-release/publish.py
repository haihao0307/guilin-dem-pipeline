"""Publish an allowlisted encrypted browser artifact; no private-source access or keys."""
from pathlib import Path
import os,io,json,hashlib,re,urllib.request,zipfile,subprocess
ROOT=Path(__file__).resolve().parent
req=json.loads((ROOT/'REQUEST.json').read_text());source=req['sourceCommit']
assert re.fullmatch('[0-9a-f]{40}',source) and req['nativePassed'] is True
assert req['artifactURL'].startswith('https://') and '.oaiusercontent.com/' in req['artifactURL']
raw=urllib.request.urlopen(req['artifactURL'],timeout=180).read()
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(raw)==req['artifactSHA256']
rel='kaopu-fabric-workbench/collection/r03-'+source[:12]
stage=Path('/tmp/fabric-r03-public');stage.mkdir(exist_ok=False)
with zipfile.ZipFile(io.BytesIO(raw)) as z:
 names=z.namelist();assert len(names)==len(set(names)) and all('/' not in n and '\\' not in n for n in names)
 assert sum(x.file_size for x in z.infolist())<40000000
 m=json.loads(z.read('BUILD_MANIFEST.json'));fm=json.loads(z.read('FILES.json'))
 assert m['version']=='FABRIC-COLLECTION-R03' and m['sourceCommit']==source==fm['sourceCommit']
 assert m['keyPublished'] is False and m['rulesAppliedToShaders'] is False
 allowed={'index.html','app.js','runtime-loader.js','asset-service.js','cipher-cache.js','decode-worker.js','native-bridge.js','registry.json','SHADER_RULE_CONTRACT.json','BUILD_MANIFEST.json','BUILD_PROOF.json','FILES.json'}
 for r in list(m['engines'].values())+list(m['bundles'].values()):
  assert r['encrypted'] and r['url'].endswith('.pack')
  b=z.read(r['url']);assert len(b)==r['bytes'] and sha(b)==r['sha256'];allowed.add(r['url'])
 assert set(names)==allowed and set(fm['files'])==allowed-{'FILES.json'}
 for name in names:
  b=z.read(name)
  if name!='FILES.json':assert len(b)==fm['files'][name]['bytes'] and sha(b)==fm['files'][name]['sha256'],name
  (stage/name).write_bytes(b)
def git(*args,env=None,check=True):
 return subprocess.run(['git',*args],text=True,capture_output=True,check=check,env=env)
git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
for attempt in range(5):
 git('fetch','--filter=blob:none','--depth=1','origin','gh-pages');base=git('rev-parse','FETCH_HEAD').stdout.strip()
 assert not git('ls-tree',base,rel).stdout.strip(),'Immutable release path already exists; refuse overwrite'
 index=Path('/tmp/fabric-r03-index');index.unlink(missing_ok=True)
 env={**os.environ,'GIT_INDEX_FILE':str(index)};git('read-tree',base,env=env)
 for p in sorted(stage.iterdir()):
  blob=git('hash-object','-w',str(p)).stdout.strip();git('update-index','--add','--cacheinfo','100644',blob,rel+'/'+p.name,env=env)
 tree=git('write-tree',env=env).stdout.strip()
 commit=git('commit-tree',tree,'-p',base,'-m','publish(fabric): immutable R03 startup and native material collection').stdout.strip()
 changed=git('diff-tree','--no-commit-id','--name-only','-r',commit).stdout.splitlines()
 assert changed and all(p.startswith(rel+'/') for p in changed)
 pushed=git('push','origin',commit+':refs/heads/gh-pages',check=False)
 if pushed.returncode==0:break
 if attempt==4:raise RuntimeError('Concurrent publication prevented fast-forward; no force push attempted')
receipt={'version':m['version'],'sourceCommit':source,'publicCommit':commit,'fixedURL':'https://haihao0307.github.io/guilin-dem-pipeline/'+rel+'/','nativeRun':req['nativeRun'],'status':'PUBLISHED_PENDING_PUBLIC_BROWSER','oldVersionsPreserved':True,'keyPublished':False,'files':fm['files']}
Path('/tmp/FABRIC_R03_STAGE.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in receipt.items() if k!='files'},ensure_ascii=False,indent=2))
