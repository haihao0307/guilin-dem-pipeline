"""Additive native R04.1 publication; no source model or old workbench overwrite."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib,json,os,shutil,subprocess,sys,tempfile,time,urllib.request
P=Path(__file__).resolve().parent;ROOT=P.parents[2]
BRANCH='feature/tailor-cabinet-r03-garment-surfaces-20261009'
PREFIX='kaopu-tailor-workbench/presets/r04'
PUBLIC_ROOT='https://haihao0307.github.io/guilin-dem-pipeline/'
def git(*a,cwd=ROOT):return subprocess.check_output(['git',*a],cwd=cwd,text=True).strip()
def load(n):return json.loads((P/n).read_text())
def save(n,d):(P/n).write_text(json.dumps(d,ensure_ascii=False,indent=2))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def manifest():
 r=load('CONTINUATION_REPORT.json');s=load('CONTINUATION_SWEEP.json');review=load('VISUAL_NATIVE_REVIEW.json')
 assert r['passed'] and s['all60Attempted'] and s['allMaterialChecksPassed']
 assert review['interactiveSourceReviewApproved'] and not review['all60GarmentsAccepted']
 paths=[p for p in P.rglob('*') if p.is_file() and (p.parts[len(P.parts)] in ['assets','native'] or p.parent==P and p.suffix in ['.mjs','.html','.css','.md'])]
 files={p.relative_to(P).as_posix():{'sha256':sha(p),'bytes':p.stat().st_size} for p in paths}
 assert not any('/presets/r03/' in (P/n).read_text(errors='ignore') for n in ['app.mjs'])
 d={'version':'R04.1-native','owner':BRANCH,'runtimeSourceCommit':os.environ['GITHUB_SHA'],'nativeSolveSourceCommit':s['sourceCommit'],'person':load('assets/identity.json')['person'],'summary':s['summary'],'physicalFitAccepted':False,'dynamicWearCertified':False,'files':files}
 save('R04_MANIFEST.json',d);return d

def retain(message):
 git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
 git('fetch','origin',BRANCH,'--depth=1')
 assert git('rev-parse','origin/'+BRANCH)==git('rev-parse','HEAD'),'Source branch advanced; keep result in artifact, never overwrite another writer'
 git('add','--',PREFIX)
 if git('diff','--cached','--name-only'):git('commit','-m',message);git('push','origin','HEAD:refs/heads/'+BRANCH)

def publish():
 m=manifest();source=git('rev-parse','HEAD');fixed='kaopu-tailor-workbench/presets/r041-'+source[:12]
 git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
 temp=Path(tempfile.mkdtemp(prefix='native-r041-'));snapshot=temp/'snapshot';shutil.copytree(P,snapshot,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
 work=temp/'pages';git('fetch','origin','gh-pages','--depth=1');git('worktree','add','--detach',str(work),'origin/gh-pages')
 protected=['kaopu-unified-human-workbench','kaopu-tailor-workbench/presets/r01','kaopu-tailor-workbench/presets/r02','kaopu-tailor-workbench/presets/r03','kaopu-tailor-workbench/r07','kaopu-tailor-workbench/catalogue']
 receipt={}
 try:
  for attempt in range(5):
   git('fetch','origin','gh-pages','--depth=1');parent=git('rev-parse','origin/gh-pages');git('checkout','--detach',parent,cwd=work)
   before={n:git('rev-parse',parent+':'+n,cwd=work) for n in protected}
   for dest in [PREFIX,fixed]:
    target=work/dest
    if target.exists() and any(target.iterdir()):
     assert (target/'R04_MANIFEST.json').exists(),'Unowned public directory '+dest
     old=json.loads((target/'R04_MANIFEST.json').read_text());assert old['owner']==BRANCH
     if dest==fixed:
      for n,d in m['files'].items():assert sha(target/n)==d['sha256'],'Fixed snapshot conflict '+n
    shutil.copytree(snapshot,target,dirs_exist_ok=True)
   git('add','--sparse','--',PREFIX,fixed,cwd=work)
   changes=git('diff','--cached','--name-only',cwd=work).splitlines()
   assert changes and all(n.startswith(PREFIX+'/') or n.startswith(fixed+'/') for n in changes)
   git('commit','-m','publish(tailor-r04): original common person and genuine native sewing results; keep previous systems unchanged',cwd=work)
   new=git('rev-parse','HEAD',cwd=work)
   after={n:git('rev-parse',new+':'+n,cwd=work) for n in protected};assert before==after
   try:
    git('push','origin','HEAD:refs/heads/gh-pages',cwd=work)
    receipt={'publicationCommit':new,'pagesParentCommit':parent,'runtimeSourceCommit':source,'nativeSolveSourceCommit':m['nativeSolveSourceCommit'],'fixedPrefix':fixed,'fixedURL':PUBLIC_ROOT+fixed+'/?preset=T01','latestURL':PUBLIC_ROOT+PREFIX+'/?preset=T01','protectedBefore':before,'protectedAfter':after,'publicVerified':False,'physicalFitAccepted':False};break
   except subprocess.CalledProcessError:
    if attempt==4:raise
    time.sleep(3)
  save('R04_RELEASE_STATE.json',receipt);retain('docs(tailor-r04): retain additive publication receipt pending actual public acceptance')
  print('NATIVE_PUBLICATION',receipt,flush=True)
 finally:
  subprocess.run(['git','worktree','remove',str(work)],cwd=ROOT,check=False)

def fetch(path):
 last=None
 for i in range(5):
  try:
   req=urllib.request.Request(PUBLIC_ROOT+path+'?native='+load('R04_MANIFEST.json')['runtimeSourceCommit'][:12],headers={'Cache-Control':'no-cache','User-Agent':'KAOPU-Native-R04-Verify'})
   with urllib.request.urlopen(req,timeout=40) as r:return r.read()
  except Exception as e:last=e;time.sleep(2+i)
 raise RuntimeError((path,str(last)))

def verify():
 m=load('R04_MANIFEST.json');state=load('R04_RELEASE_STATE.json');fixed=state['fixedPrefix'];ready=False
 for _ in range(80):
  try:
   live=json.loads(fetch(fixed+'/R04_MANIFEST.json'))
   if live['runtimeSourceCommit']==m['runtimeSourceCommit']:ready=True;break
  except Exception:pass
  time.sleep(6)
 assert ready,'Checked original-system revision has not reached Pages: delivery incomplete'
 tasks=[(prefix+'/'+n,d['sha256']) for prefix in [PREFIX,fixed] for n,d in m['files'].items()]
 def check(item):
  n,expected=item;actual=hashlib.sha256(fetch(n)).hexdigest();assert actual==expected,n
  return {'path':n,'sha256':actual}
 with ThreadPoolExecutor(max_workers=6) as pool:checked=list(pool.map(check,tasks))
 save('PUBLIC_NATIVE_BYTES.json',{'allMatch':True,'checkedCount':len(checked),'checked':checked,'runtimeSourceCommit':m['runtimeSourceCommit']})
 print('NATIVE_PUBLIC_BYTES',len(checked),flush=True)

def finish():
 r=load('PUBLIC_CONTINUATION_REPORT.json');assert r['passed'] and r['public']
 state=load('R04_RELEASE_STATE.json');state['publicVerified']=True;state['publicChecks']=len(r['checks']);state['publicPathsChecked']=load('PUBLIC_NATIVE_BYTES.json')['checkedCount'];state['summary']=r['summary'];save('R04_RELEASE_STATE.json',state)
 retain('test(tailor-r04): retain actual HTTPS original-person and exact native-result validation; failures remain failed')
 print('NATIVE_PUBLIC_COMPLETE',git('rev-parse','HEAD'),flush=True)
if __name__=='__main__':{'publish':publish,'verify':verify,'finish':finish}[sys.argv[1]]()
