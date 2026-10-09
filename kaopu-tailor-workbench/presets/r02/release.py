"""Guarded R02 release: ordinary fast-forward publication, no old URL replacement."""
from pathlib import Path
import concurrent.futures, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.request

HERE=Path(__file__).resolve().parent
TAILOR=HERE.parent.parent
REPO=TAILOR.parent
BRANCH='feature/tailor-preset-3d-showcase-r02-20261009'
PREFIX='kaopu-tailor-workbench/presets/r02'
SOURCE=os.environ.get('GITHUB_SHA','local')
ROOT_URL='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/'
PUBLIC_URL=ROOT_URL+'presets/r02/'
RUNTIME=['index.html','style.css','app.mjs','showcase-3d.mjs','README.md']
DEPENDENCIES={
 'presets/r01/library.json':TAILOR/'presets/r01/library.json',
 'presets/r01/parameter-schema.json':TAILOR/'presets/r01/parameter-schema.json',
 'presets/r01/vendor/paper-preview.mjs':TAILOR/'presets/r01/vendor/paper-preview.mjs',
 'garments-r04/vendor/three.module.js':TAILOR/'garments-r04/vendor/three.module.js',
 'garments-r04/vendor/OrbitControls.js':TAILOR/'garments-r04/vendor/OrbitControls.js',
}

def run(args,cwd=REPO):return subprocess.check_output(args,cwd=cwd,text=True).strip()
def git(*args,cwd=REPO):return run(['git',*args],cwd)
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def save(name,value):(HERE/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')

def manifest():
 report=json.loads((HERE/'BROWSER_REPORT.json').read_text())
 assert report['passed'] is True and report['finalState']['thumbnailCount']==60
 files={name:digest(HERE/name) for name in RUNTIME}
 deps={name:digest(path) for name,path in DEPENDENCIES.items()}
 save('BUILD_MANIFEST.json',{
  'version':'R02','sourceCommit':SOURCE,'sourceBaseline':'78eb5030f791735037d20b1dfe32a9044845ef34',
  'publicationOwner':BRANCH,'runtimeFiles':files,'inheritedDependencies':deps,
  'presetCount':60,'thumbnailMode':'one temporary WebGL renderer -> cached card images -> disposed; one active detail renderer',
  'usesRealPerson':False,'clothSimulationRun':False,'physicalFitAccepted':False,'dynamicWearCertified':False
 })
 print('R02_MANIFEST',len(files),'runtime files and',len(deps),'locked dependencies',flush=True)

def retain():
 git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
 git('fetch','origin',BRANCH,'--depth=1')
 assert git('rev-parse','origin/'+BRANCH)==SOURCE,'R02 branch advanced; do not overwrite another writer'
 git('add','--',PREFIX)
 git('commit','-m','build(tailor-showcase): retain tested 60-preset WebGL cabinet and browser evidence')
 artifact=git('rev-parse','HEAD')
 save('RELEASE_STATE.json',{'sourceCommit':SOURCE,'artifactCommit':artifact,'publicURL':PUBLIC_URL,'publicVerified':False,'physicalFitAccepted':False,'dynamicWearCertified':False})
 git('add','--',PREFIX+'/RELEASE_STATE.json');git('commit','-m','docs(tailor-showcase): record generated R02 artifact before public delivery')
 head=git('rev-parse','HEAD');git('push','origin','HEAD:refs/heads/'+BRANCH)
 print('R02_ARTIFACT_HEAD',head,flush=True)

def publish():
 state=json.loads((HERE/'RELEASE_STATE.json').read_text())
 snapshot=Path(tempfile.mkdtemp(prefix='tailor-r02-'))/'r02';shutil.copytree(HERE,snapshot,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
 work=Path(tempfile.mkdtemp(prefix='tailor-r02-pages-'))/'checkout'
 git('fetch','origin','gh-pages','--depth=1');git('worktree','add','--detach',str(work),'origin/gh-pages')
 try:
  published=None
  for attempt in range(5):
   git('fetch','origin','gh-pages','--depth=1');git('checkout','--detach','origin/gh-pages',cwd=work)
   target=work/PREFIX
   if (target/'BUILD_MANIFEST.json').exists():
    old=json.loads((target/'BUILD_MANIFEST.json').read_text());assert old.get('publicationOwner')==BRANCH,'R02 public path owned by another branch'
   shutil.copytree(snapshot,target,dirs_exist_ok=True)
   git('add','--',PREFIX,cwd=work)
   changed=git('diff','--cached','--name-only',cwd=work).splitlines();assert changed and all(p.startswith(PREFIX+'/') for p in changed),changed
   git('commit','-m','publish(tailor-showcase): add 3D electronic wardrobe without replacing R01 or R074',cwd=work)
   try:
    git('push','origin','HEAD:refs/heads/gh-pages',cwd=work);published=git('rev-parse','HEAD',cwd=work);break
   except subprocess.CalledProcessError:
    if attempt==4:raise
    time.sleep(2)
  assert published
  state['publicationCommit']=published;save('RELEASE_STATE.json',state)
  print('R02_PUBLICATION_COMMIT',published,flush=True)
 finally:
  git('worktree','remove',str(work));shutil.rmtree(snapshot.parent,ignore_errors=True)

def fetch_public(path):
 request=urllib.request.Request(ROOT_URL+path,headers={'Cache-Control':'no-cache','User-Agent':'KAOPU-R02-Delivery'})
 with urllib.request.urlopen(request,timeout=60) as response:return response.read()

def verify():
 expected=json.loads((HERE/'BUILD_MANIFEST.json').read_text());available=False
 for _ in range(90):
  try:
   live=json.loads(fetch_public('presets/r02/BUILD_MANIFEST.json?check='+str(time.time())))
   if live.get('sourceCommit')==SOURCE:available=True;break
  except Exception:pass
  time.sleep(10)
 assert available,'R02 checked build did not reach GitHub Pages; delivery incomplete'
 tasks=[('presets/r02/'+name,sha) for name,sha in expected['runtimeFiles'].items()]+list(expected['inheritedDependencies'].items())
 def one(item):
  name,sha=item;actual=hashlib.sha256(fetch_public(name)).hexdigest();assert actual==sha,(name,actual,sha);return name
 with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:checked=list(pool.map(one,tasks))
 save('PUBLIC_BYTES.json',{'sourceCommit':SOURCE,'allSHA256Match':True,'checkedPaths':checked,'runtimeCount':len(expected['runtimeFiles']),'dependencyCount':len(expected['inheritedDependencies'])})
 print('R02_PUBLIC_BYTES_PASS',len(checked),flush=True)

def retain_public():
 report=json.loads((HERE/'PUBLIC_REPORT.json').read_text());assert report['passed'] is True
 state=json.loads((HERE/'RELEASE_STATE.json').read_text());state['publicVerified']=True;save('RELEASE_STATE.json',state)
 git('fetch','origin',BRANCH,'--depth=1');assert git('rev-parse','origin/'+BRANCH)==git('rev-parse','HEAD'),'R02 branch advanced; keep evidence without overwriting'
 git('add','--',PREFIX+'/PUBLIC_REPORT.json',PREFIX+'/PUBLIC_BYTES.json',PREFIX+'/RELEASE_STATE.json',PREFIX+'/qa/public')
 git('commit','-m','docs(tailor-showcase): retain actual public 3D cabinet validation and screenshots')
 git('push','origin','HEAD:refs/heads/'+BRANCH)
 print('R02_PUBLIC_EVIDENCE_COMMIT',git('rev-parse','HEAD'),flush=True)

if __name__=='__main__':
 {'manifest':manifest,'retain':retain,'publish':publish,'verify':verify,'retain-public':retain_public}[sys.argv[1]]()
