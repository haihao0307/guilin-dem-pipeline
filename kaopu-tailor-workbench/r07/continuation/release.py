"""Scoped R074 publication, ordinary fast-forward only; no old workbench replacement."""
from pathlib import Path
import concurrent.futures,hashlib,json,os,shutil,subprocess,sys,tempfile,time,urllib.request
P=Path(__file__).resolve().parent;TAILOR=P.parent.parent;REPO=TAILOR.parent
PREFIX='kaopu-tailor-workbench/r07/continuation';BRANCH='feature/tailor-continued-integration-20261009';SOURCE=os.environ['GITHUB_SHA']
ROOT_URL='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/'
HELPERS=['learning/patterngsl-r01/pattern-edit-kernel.mjs','learning/patterngsl-r01/seam-span.mjs']
GENERATED=['catalogue/r074-worker.bundle.mjs','catalogue/r074-workbench-app.mjs','catalogue/r074-workbench-style.css']
def git(*args,cwd=REPO):return subprocess.check_output(['git',*args],cwd=cwd,text=True).strip()
def save(n,d):(P/n).write_text(json.dumps(d,ensure_ascii=False,indent=2))
def allowed(path):return path.startswith(PREFIX+'/') or path in ['kaopu-tailor-workbench/'+p for p in GENERATED+HELPERS]
def retain():
 report=json.loads((P/'BROWSER_REPORT.json').read_text());assert report['passed'] is True
 manifest=json.loads((P/'BUILD_MANIFEST.json').read_text())
 manifest['publicationOwner']=BRANCH
 manifest['runtimeFiles']['r07/continuation/assets/original-anny-rig.json.gz']=hashlib.sha256((P/'assets/original-anny-rig.json.gz').read_bytes()).hexdigest()
 for h in HELPERS:manifest['runtimeFiles'][h]=hashlib.sha256((TAILOR/h).read_bytes()).hexdigest()
 save('BUILD_MANIFEST.json',manifest)
 git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
 git('fetch','origin',BRANCH,'--depth=1');assert git('rev-parse','origin/'+BRANCH)==SOURCE,'Branch advanced; refusal to overwrite'
 git('add','--',PREFIX,*['kaopu-tailor-workbench/'+p for p in GENERATED])
 changed=git('diff','--cached','--name-only').splitlines();assert changed and all(allowed(p) for p in changed)
 git('commit','-m','build(tailor): retain tested R074 editor, source rig and honest seam diagnostics')
 artifact=git('rev-parse','HEAD');git('push','origin','HEAD:refs/heads/'+BRANCH)
 save('RELEASE_STATE.json',{'sourceCommit':SOURCE,'artifactCommit':artifact,'publicURL':ROOT_URL+'r07/continuation/','publicVerified':False,'physicalFitAccepted':False,'dynamicWearCertified':False})
 print('R074_ARTIFACT_COMMIT',artifact,flush=True)
def publish():
 state=json.loads((P/'RELEASE_STATE.json').read_text());snapshot=Path(tempfile.mkdtemp(prefix='r074-checked-'))
 own=snapshot/'continuation';shutil.copytree(P,own,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
 for f in GENERATED+HELPERS:q=snapshot/f;q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(TAILOR/f,q)
 work=Path(tempfile.mkdtemp(prefix='r074-pages-'))/'checkout';git('fetch','origin','gh-pages','--depth=1');git('worktree','add','--detach',str(work),'origin/gh-pages')
 try:
  for attempt in range(4):
   git('fetch','origin','gh-pages','--depth=1');git('checkout','--detach','origin/gh-pages',cwd=work)
   target=work/PREFIX
   if (target/'BUILD_MANIFEST.json').exists():assert json.loads((target/'BUILD_MANIFEST.json').read_text()).get('publicationOwner')==BRANCH,'Path ownership conflict'
   shutil.copytree(own,target,dirs_exist_ok=True)
   for f in GENERATED+HELPERS:
    dest=work/'kaopu-tailor-workbench'/f
    if f in HELPERS and dest.exists():assert dest.read_bytes()==(snapshot/f).read_bytes(),'Do not replace another learning-core version'
    dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(snapshot/f,dest)
   paths=[PREFIX]+['kaopu-tailor-workbench/'+p for p in GENERATED+HELPERS];git('add','--',*paths,cwd=work)
   changed=git('diff','--cached','--name-only',cwd=work).splitlines();assert changed and all(allowed(p) for p in changed),changed
   git('commit','-m','publish(tailor): add tested R074 editing workflow; garment and motion quality remain unaccepted',cwd=work)
   try:git('push','origin','HEAD:refs/heads/gh-pages',cwd=work);state['publicationCommit']=git('rev-parse','HEAD',cwd=work);break
   except subprocess.CalledProcessError:
    if attempt==3:raise
    time.sleep(2)
  save('RELEASE_STATE.json',state);print('R074_PUBLICATION_COMMIT',state['publicationCommit'],flush=True)
 finally:git('worktree','remove',str(work));shutil.rmtree(snapshot,ignore_errors=True)
def verify():
 expected=json.loads((P/'BUILD_MANIFEST.json').read_text());available=False
 def get(path):
  with urllib.request.urlopen(urllib.request.Request(ROOT_URL+path,headers={'Cache-Control':'no-cache'}),timeout=60) as r:return r.read()
 for _ in range(72):
  try:
   live=json.loads(get('r07/continuation/BUILD_MANIFEST.json?check='+str(time.time())))
   if live.get('sourceCommit')==SOURCE:available=True;break
  except Exception:pass
  time.sleep(10)
 assert available,'R074 has not reached the public page; delivery incomplete'
 def verify_one(pair):
  path,digest=pair;actual=hashlib.sha256(get(path)).hexdigest();assert actual==digest,(path,actual,digest);return path
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:checked=list(pool.map(verify_one,expected['runtimeFiles'].items()))
 save('PUBLIC_BYTES.json',{'sourceCommit':SOURCE,'allSHA256Match':True,'checkedPaths':checked});print('R074_PUBLIC_RUNTIME_BYTES_PASS',len(checked),flush=True)
def retain_public():
 report=json.loads((P/'PUBLIC_REPORT.json').read_text());assert report['passed'] is True
 state=json.loads((P/'RELEASE_STATE.json').read_text());state['publicVerified']=True;save('RELEASE_STATE.json',state)
 git('fetch','origin',BRANCH,'--depth=1');assert git('rev-parse','origin/'+BRANCH)==git('rev-parse','HEAD'),'Source advanced; do not overwrite'
 git('add','--',PREFIX+'/PUBLIC_REPORT.json',PREFIX+'/PUBLIC_BYTES.json',PREFIX+'/RELEASE_STATE.json',PREFIX+'/qa/public')
 git('commit','-m','docs(tailor): retain actual public R074 edit and re-sew evidence with unresolved quality flags')
 git('push','origin','HEAD:refs/heads/'+BRANCH);print('R074_PUBLIC_EVIDENCE_COMMIT',git('rev-parse','HEAD'),flush=True)
if __name__=='__main__':{'retain':retain,'publish':publish,'verify':verify,'retain-public':retain_public}[sys.argv[1]]()
