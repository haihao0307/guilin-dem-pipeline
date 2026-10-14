"""Publish a checksum-verified encrypted browser bundle. Never access the private source repo."""
from pathlib import Path
import os,json,hashlib,urllib.request,zipfile,io,shutil,subprocess,time
ROOT=Path(__file__).resolve().parent
REPO=Path.cwd()
request=json.loads((ROOT/'PUBLISH_REQUEST.json').read_text())
assert request['nativeBrowserPassed'] is True
assert request['sourceRepository']=='haihao0307/Human-Fabric-Workbench'
assert len(request['sourceCommit'])==40
allowed={'index.html','app.js','runtime-loader.js','native-bridge.js','registry.json','SHADER_RULE_CONTRACT.json','BUILD_MANIFEST.json','legacy.pack','raywave.pack','denim.pack','leather.pack'}
url=request['artifactURL'];assert url.startswith('https://') and '.oaiusercontent.com/' in url
raw=urllib.request.urlopen(url,timeout=180).read()
assert hashlib.sha256(raw).hexdigest()==request['artifactSHA256'],'Artifact checksum mismatch'
out=Path('/tmp/fabric-collection-stage');out.mkdir(exist_ok=False)
with zipfile.ZipFile(io.BytesIO(raw)) as z:
 names={i.filename for i in z.infolist() if not i.is_dir()}
 assert names==allowed,sorted(names)
 assert sum(i.file_size for i in z.infolist())<160000000
 for name in sorted(names):
  b=z.read(name);assert name in allowed
  (out/name).write_bytes(b)
man=json.loads((out/'BUILD_MANIFEST.json').read_text())
assert man['version']=='FABRIC-COLLECTION-R01' and man['sourceCommit']==request['sourceCommit']
assert man['privateSourcePublished'] is False and man['keyPublished'] is False and man['rulesAppliedToShaders'] is False
for engine,record in man['engines'].items():
 assert record['encrypted'] is True and record['url']==engine+'.pack'
 b=(out/record['url']).read_bytes()
 assert len(b)==record['bytes'] and hashlib.sha256(b).hexdigest()==record['sha256']
REL='kaopu-fabric-workbench/collection/r01-'+request['sourceCommit'][:12]
URL='https://haihao0307.github.io/guilin-dem-pipeline/'+REL+'/'
files={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(out.iterdir())}
manifest={'version':man['version'],'sourceCommit':request['sourceCommit'],'nativeRun':request['nativeRun'],'nativeBrowserPassed':True,'publicBrowserVerified':False,'files':files}
(out/'FILES.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
manifest_bytes=(out/'FILES.json').read_bytes()
def git(*args,cwd=REPO,check=True):return subprocess.run(['git',*args],cwd=cwd,text=True,capture_output=True,check=check)
git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
work=Path('/tmp/fabric-collection-pages')
for attempt in range(5):
 git('fetch','--filter=blob:none','--depth=1','origin','gh-pages');base=git('rev-parse','FETCH_HEAD').stdout.strip()
 if work.exists():git('worktree','remove','--force',str(work));git('worktree','prune')
 git('worktree','add','--no-checkout','--detach',str(work),base)
 git('sparse-checkout','init','--cone',cwd=work);git('sparse-checkout','set',REL,cwd=work);git('checkout',base,cwd=work)
 dest=work/REL
 if dest.exists():
  assert (dest/'FILES.json').read_bytes()==manifest_bytes,'Immutable version exists with different files'
  public=base;break
 dest.parent.mkdir(parents=True,exist_ok=True);shutil.copytree(out,dest)
 git('add','-f',REL,cwd=work);git('commit','-m','publish(fabric): immutable seven-family encrypted native collection',cwd=work)
 changed=git('diff-tree','--no-commit-id','--name-only','-r','HEAD',cwd=work).stdout.splitlines()
 assert changed and all(n.startswith(REL+'/') for n in changed),'Publication touched unrelated paths'
 pushed=git('push','origin','HEAD:refs/heads/gh-pages',cwd=work,check=False)
 if pushed.returncode==0:public=git('rev-parse','HEAD',cwd=work).stdout.strip();break
 if attempt==4:raise RuntimeError('Publication branch kept advancing; no force push attempted')
 time.sleep(2)
receipt={'version':man['version'],'status':'PUBLISHED_AWAITING_PUBLIC_BROWSER','fixedURL':URL,'sourceCommit':request['sourceCommit'],'publicCommit':public,'nativeRun':request['nativeRun'],'sourcePR':'https://github.com/haihao0307/Human-Fabric-Workbench/pull/4','nativeBrowserPassed':True,'publicBrowserVerified':False,'oldVersionsPreserved':True,'keyIncluded':False,'files':files}
Path('/tmp/FABRIC_PUBLIC_STAGE.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2))
with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('url='+URL+'\npublic='+public+'\nsource='+request['sourceCommit']+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k!='files'},ensure_ascii=False,indent=2))
