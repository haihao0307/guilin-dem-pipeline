"""Publish public-source EB1 snapshots; never read private fabric repositories."""
from pathlib import Path
import subprocess,shutil,json,hashlib,os,time
SOURCE='2a17b4ae0113b087b940adddedd1476fd5ce8003'
CORE='929945387f6371b1c74848f342b74fd493992fa5fe91e6543252b18cf18f70f7'
REL='kaopu-lighting/eb1-v1-'+SOURCE[:12]
URL='https://haihao0307.github.io/guilin-dem-pipeline/'+REL+'/'
repo=Path('project').resolve();src=Path('upstream/lighting/eb1').resolve();out=Path('/tmp/eb1-release');out.mkdir(exist_ok=True)
def git(*args,cwd=repo,check=True):return subprocess.run(['git',*args],cwd=cwd,text=True,check=check,capture_output=True)
report=json.loads((src/'qa/REPORT.json').read_text())
expected={'lab','leather','hat','denim','shoe','tailor'}
assert report['passed'] and set(report['cases'])==expected and all(x['passed'] for x in report['cases'].values()),'Unverified public candidate'
assert hashlib.sha256((src/'eb1.js').read_bytes()).hexdigest()==CORE
shutil.copytree(src/'v1',out,dirs_exist_ok=True)
for n in ['POLICY.md','README.md','THIRD_PARTY_NOTICES.md']:shutil.copyfile(src/n,out/n)
shutil.copytree(src/'licenses',out/'licenses',dirs_exist_ok=True)
# Preserve the exact runtime bytes that passed Chromium. Release metadata is separate.
release={'version':'EB1-1.0.0','sourceRepository':'haihao0307/Humanoid-Rig-Lab-Next','candidateCommit':SOURCE,'coreSHA256':CORE,'fixedURL':URL,'nativeBrowserPassed':sorted(expected),'publicBrowserVerified':False,'privateKnitIncluded':False,'legacyVersionsUntouched':True,'userAccepted':False,'status':'PUBLISHED_REQUIRES_PUBLIC_VERIFICATION'}
(out/'RELEASE.json').write_text(json.dumps(release,ensure_ascii=False,indent=2))
files={}
for p in sorted(out.rglob('*')):
 if not p.is_file() or p.name=='FILES.json':continue
 assert not p.is_symlink()
 b=p.read_bytes();files[str(p.relative_to(out))]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
(out/'FILES.json').write_text(json.dumps({'version':'EB1-1.0.0','candidateCommit':SOURCE,'files':files},indent=2))
manifest=(out/'FILES.json').read_bytes();work=Path('/tmp/eb1-pages')
git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
for attempt in range(5):
 git('fetch','--filter=blob:none','--depth=1','origin','gh-pages')
 base=git('rev-parse','FETCH_HEAD').stdout.strip()
 if work.exists():git('worktree','remove','--force',str(work));git('worktree','prune')
 git('worktree','add','--no-checkout','--detach',str(work),base)
 git('sparse-checkout','init','--cone',cwd=work);git('sparse-checkout','set',REL,cwd=work);git('checkout',base,cwd=work)
 dest=work/REL
 if dest.exists():
  assert (dest/'FILES.json').read_bytes()==manifest,'Immutable release already exists with different content'
  public=base;break
 dest.parent.mkdir(parents=True,exist_ok=True);shutil.copytree(out,dest)
 git('add','-f',REL,cwd=work);git('commit','-m','publish(eb1): immutable five-workbench and calibration lighting release',cwd=work)
 result=git('push','origin','HEAD:refs/heads/gh-pages',cwd=work,check=False)
 if result.returncode==0:public=git('rev-parse','HEAD',cwd=work).stdout.strip();break
 if attempt==4:raise RuntimeError('Publication branch advanced repeatedly; no force push attempted')
 time.sleep(2)
else:raise RuntimeError('Publication failed')
release['publicCommit']=public;release['files']=files
Path('/tmp/EB1_PUBLIC_STAGE.json').write_text(json.dumps(release,indent=2,ensure_ascii=False))
with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('url='+URL+'\npublic='+public+'\nsource='+SOURCE+'\n')
print(json.dumps({k:v for k,v in release.items() if k!='files'},ensure_ascii=False,indent=2))
