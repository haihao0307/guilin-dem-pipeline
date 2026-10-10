"""Publish a reviewed R04.2 correction additively; do not merge or edit old snapshots."""
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
 sweep=load('SIDE_FIX_SWEEP.json');reg=load('SIDE_REGRESSION.json');ui=load('R042_UI_REPORT.json');native=load('CONTINUATION_REPORT.json');review=load('R042_REVIEW.json')
 assert sweep['rerunAllAffected'] and sweep['affectedPresetCount']==18 and reg['passed'] and ui['passed'] and native['passed']
 assert sweep['summary']==ui['summary']==native['summary']
 assert review['approvedForInteractiveReview'] and not review['userAccepted']
 for n,h in review['reviewedFilesSHA256'].items():assert sha(P/n)==h,('Reviewed file changed',n)
 assert set(sweep['previousPassIds']) <= {id for id,r in load('assets/results/index.json')['rows'].items() if r['qualityPassed']}
 assert not sweep['qualityThresholdsChanged'] and not sweep['physicalFitAccepted']
 evidence={'SOURCE_AUDIT.json','SIDE_FIX_PROOF.json','SIDE_REGRESSION.json','SIDE_FIX_SWEEP.json','SIDE_FIX_BASELINE_INDEX.json','R042_UI_REPORT.json','R042_REVIEW.json'}
 paths=[p for p in P.rglob('*') if p.is_file() and (p.parts[len(P.parts)] in ['assets','native'] or p.parent==P and (p.suffix in ['.mjs','.html','.css','.md'] or p.name in evidence))]
 files={p.relative_to(P).as_posix():{'sha256':sha(p),'bytes':p.stat().st_size} for p in paths}
 d={'version':'R04.2-native','owner':BRANCH,'runtimeSourceCommit':os.environ['GITHUB_SHA'],'nativeSolveSourceCommit':sweep['sourceCommit'],'person':load('assets/identity.json')['person'],'summary':sweep['summary'],'assemblyCorrection':'Rear sleeve/cuff *_b classification only; native material and solver mathematics unchanged','physicalFitAccepted':False,'dynamicWearCertified':False,'files':files}
 save('R04_MANIFEST.json',d);save('R042_MANIFEST.json',d);return d

def retain(message):
 git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
 git('fetch','origin',BRANCH,'--depth=1')
 assert git('rev-parse','origin/'+BRANCH)==git('rev-parse','HEAD'),'Source branch advanced; never overwrite another writer'
 git('add','--',PREFIX)
 if git('diff','--cached','--name-only'):
  git('commit','-m',message);git('push','origin','HEAD:refs/heads/'+BRANCH)

def publish():
 m=manifest();source=git('rev-parse','HEAD');fixed='kaopu-tailor-workbench/presets/r042-'+source[:12]
 git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
 temp=Path(tempfile.mkdtemp(prefix='native-r042-'));snapshot=temp/'snapshot';shutil.copytree(P,snapshot,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
 work=temp/'pages';git('fetch','origin','gh-pages','--depth=1');git('worktree','add','--detach',str(work),'origin/gh-pages')
 protected=['kaopu-unified-human-workbench','kaopu-tailor-workbench/presets/r01','kaopu-tailor-workbench/presets/r02','kaopu-tailor-workbench/presets/r03','kaopu-tailor-workbench/presets/r041-8e98936acb85','kaopu-tailor-workbench/r07','kaopu-tailor-workbench/catalogue']
 receipt={}
 try:
  for attempt in range(5):
   git('fetch','origin','gh-pages','--depth=1');parent=git('rev-parse','origin/gh-pages');git('checkout','--detach',parent,cwd=work)
   before={n:git('rev-parse',parent+':'+n,cwd=work) for n in protected}
   for dest in [PREFIX,fixed]:
    target=work/dest
    if target.exists() and any(target.iterdir()):
     assert (target/'R04_MANIFEST.json').exists(),'Unowned public directory '+dest
     prior=json.loads((target/'R04_MANIFEST.json').read_text());assert prior['owner']==BRANCH
     if dest==fixed:
      for n,d in m['files'].items():assert sha(target/n)==d['sha256'],'Fixed snapshot conflict '+n
    shutil.copytree(snapshot,target,dirs_exist_ok=True)
   git('add','--sparse','--',PREFIX,fixed,cwd=work)
   changes=git('diff','--cached','--name-only',cwd=work).splitlines()
   assert changes and all(n.startswith(PREFIX+'/') or n.startswith(fixed+'/') for n in changes)
   git('commit','-m','publish(tailor-r042): corrected rear-panel assembly, native re-solves and explicit failure states; preserve old snapshots',cwd=work)
   new=git('rev-parse','HEAD',cwd=work)
   after={n:git('rev-parse',new+':'+n,cwd=work) for n in protected};assert before==after
   try:
    git('push','origin','HEAD:refs/heads/gh-pages',cwd=work)
    receipt={'publicationCommit':new,'pagesParentCommit':parent,'runtimeSourceCommit':source,'nativeSolveSourceCommit':m['nativeSolveSourceCommit'],'fixedPrefix':fixed,'fixedURL':PUBLIC_ROOT+fixed+'/?preset=T08','latestURL':PUBLIC_ROOT+PREFIX+'/?preset=T08','protectedBefore':before,'protectedAfter':after,'summary':m['summary'],'publicVerified':False,'physicalFitAccepted':False,'dynamicWearCertified':False};break
   except subprocess.CalledProcessError:
    if attempt==4:raise
    time.sleep(3)
  assert receipt
  save('R042_RELEASE_STATE.json',receipt);retain('docs(tailor-r042): record additive publication pending real HTTPS acceptance')
  print('R042_PUBLICATION',json.dumps(receipt),flush=True)
 finally:subprocess.run(['git','worktree','remove',str(work)],cwd=ROOT,check=False)

def fetch(path,tries=5):
 last=None
 for i in range(tries):
  try:
   req=urllib.request.Request(PUBLIC_ROOT+path+'?r042='+load('R042_MANIFEST.json')['runtimeSourceCommit'][:12],headers={'Cache-Control':'no-cache','User-Agent':'KAOPU-R042-Verify'})
   with urllib.request.urlopen(req,timeout=40) as r:return r.read()
  except Exception as e:last=e;time.sleep(2+i)
 raise RuntimeError((path,str(last)))

def verify():
 m=load('R042_MANIFEST.json');state=load('R042_RELEASE_STATE.json');fixed=state['fixedPrefix'];ready=False
 for _ in range(90):
  try:
   live=json.loads(fetch(fixed+'/R042_MANIFEST.json',1))
   if live['runtimeSourceCommit']==m['runtimeSourceCommit']:ready=True;break
  except Exception:pass
  time.sleep(8)
 assert ready,'Checked R04.2 has not reached Pages: delivery incomplete'
 tasks=[(prefix+'/'+n,d['sha256']) for prefix in [PREFIX,fixed] for n,d in m['files'].items()]
 def check(item):
  n,expected=item;actual=hashlib.sha256(fetch(n)).hexdigest();assert actual==expected,n
  return {'path':n,'sha256':actual}
 with ThreadPoolExecutor(max_workers=6) as pool:checked=list(pool.map(check,tasks))
 save('R042_PUBLIC_BYTES.json',{'allMatch':True,'checkedCount':len(checked),'checked':checked,'runtimeSourceCommit':m['runtimeSourceCommit']})
 print('R042_PUBLIC_BYTES',len(checked),flush=True)

def finish():
 reports=[load(n) for n in ['PUBLIC_CONTINUATION_REPORT.json','R042_PUBLIC_UI_REPORT.json','R042_PUBLIC_LIVE_REPORT.json']]
 assert all(r['passed'] and r['public'] for r in reports)
 state=load('R042_RELEASE_STATE.json');state['publicVerified']=True;state['publicChecks']=[len(r['checks']) for r in reports];state['publicPathsChecked']=load('R042_PUBLIC_BYTES.json')['checkedCount']
 state['summary']=reports[0]['summary'];assert state['summary']==reports[1]['summary']
 save('R042_RELEASE_STATE.json',state)
 retain('test(tailor-r042): retain actual public result identity, UI filters and fresh native T08 solve')
 print('R042_PUBLIC_COMPLETE',git('rev-parse','HEAD'),flush=True)
if __name__=='__main__':{'publish':publish,'verify':verify,'finish':finish}[sys.argv[1]]()
