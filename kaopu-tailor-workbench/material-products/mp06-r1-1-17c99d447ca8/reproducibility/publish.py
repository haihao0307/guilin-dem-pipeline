from pathlib import Path
import sys,os,subprocess,json,hashlib,shutil,tempfile,time
runtime=Path(sys.argv[1]).resolve();project=Path(sys.argv[2]).resolve();branch='feature/tailor-mp06-native-human-motion-eb1-20261013';prefix='kaopu-tailor-workbench/material-products/r06-1-1'
def git(*args,env=None,input=None):
 p=subprocess.run(['git',*args],cwd=project,text=True,input=input,env={**os.environ,**(env or {})},capture_output=True)
 if p.returncode:raise RuntimeError('git '+args[0]+': '+p.stderr)
 return p.stdout.strip()
git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com');expected=git('rev-parse','HEAD');git('fetch','origin',branch,'--depth=1','--filter=blob:none');assert git('rev-parse','origin/'+branch)==expected,'Branch changed; no overwrite'
git('sparse-checkout','add',prefix);assert not (project/prefix).exists(),'Complete source directory exists; use new release version'
shutil.copytree(runtime,project/prefix);git('add','-f','--',prefix);git('commit','-m','build(mp06): persist original R05 person, source actions, EB1 and new-body cloth evidence [skip ci]');source=git('rev-parse','HEAD');git('push','origin','HEAD:refs/heads/'+branch)
manifest={'version':'MP06-R1.1','sourceCommit':source,'buildRequest':expected,'files':{}}
for p in sorted(runtime.rglob('*')):
 if p.is_file() and p.name!='BUILD_MANIFEST.json':
  b=p.read_bytes();manifest['files'][p.relative_to(runtime).as_posix()]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
(runtime/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));publicPrefix='kaopu-tailor-workbench/material-products/mp06-r1-1-'+source[:12];url='https://haihao0307.github.io/guilin-dem-pipeline/'+publicPrefix+'/'
for attempt in range(5):
 git('fetch','origin','gh-pages','--depth=1','--filter=blob:none');base=git('rev-parse','origin/gh-pages');assert not git('ls-tree',base,'--',publicPrefix),'Immutable public directory already exists'
 idx=str(Path(tempfile.gettempdir())/('mp06-index-'+str(os.getpid())));Path(idx).unlink(missing_ok=True);env={'GIT_INDEX_FILE':idx};git('read-tree',base,env=env)
 entries=[]
 for p in sorted(runtime.rglob('*')):
  if p.is_file():
   sha=git('hash-object','-w',str(p));entries.append('100644 '+sha+'\t'+publicPrefix+'/'+p.relative_to(runtime).as_posix())
 git('update-index','--index-info',env=env,input='\n'.join(entries)+'\n')
 tree=git('write-tree',env=env);commit=git('commit-tree',tree,'-p',base,input='deploy(mp06): new immutable native-source garment workbench\n');Path(idx).unlink(missing_ok=True)
 try:git('push','origin',commit+':refs/heads/gh-pages');break
 except RuntimeError:
  if attempt==4:raise
  time.sleep(2)
state={'url':url,'source':source,'public':commit,'version':'MP06-R1.1'};Path('/tmp/MP06_STAGE.json').write_text(json.dumps(state,indent=2));print(json.dumps(state,indent=2))
if os.getenv('GITHUB_OUTPUT'):
 with open(os.environ['GITHUB_OUTPUT'],'a') as f:
  for k in ['url','source','public']:f.write(k+'='+state[k]+'\n')
