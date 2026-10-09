"""Publish only reviewed R03 subtrees; verify real HTTPS bytes and browser results."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib,json,os,shutil,subprocess,sys,tempfile,time,urllib.request
HERE=Path(__file__).resolve().parent
REPO=HERE.parents[2]
BRANCH='feature/tailor-cabinet-r03-garment-surfaces-20261009'
PREFIX='kaopu-tailor-workbench/presets/r03'
ROOT='https://haihao0307.github.io/guilin-dem-pipeline/'
PUBLIC=ROOT+PREFIX+'/'
def git(*args,cwd=REPO):return subprocess.check_output(['git',*args],cwd=cwd,text=True).strip()
def read(n):return json.loads((HERE/n).read_text())
def save(n,d):(HERE/n).write_text(json.dumps(d,ensure_ascii=False,indent=2))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def checked_manifest():
 m=read('BUILD_MANIFEST.json');r=read('BROWSER_REPORT.json');approval=read('VISUAL_REVIEW.json')
 assert r['passed'] is True and r['sourceCommit']==m['sourceCommit']
 assert approval['reviewedSourceCommit']==m['sourceCommit'] and approval['approvedForInteractiveReview'] is True
 assert m['version']=='R03.4'
 for name,record in m['files'].items():assert sha(HERE/name)==record['sha256'],name
 return m

def retain(paths,message):
 git('fetch','origin',BRANCH,'--depth=1')
 assert git('rev-parse','origin/'+BRANCH)==git('rev-parse','HEAD'),'Source branch advanced; will not overwrite'
 git('add','--',*[PREFIX+'/'+p for p in paths])
 if git('diff','--cached','--name-only'):
  git('commit','-m',message);git('push','origin','HEAD:refs/heads/'+BRANCH)
 return git('rev-parse','HEAD')

def publish():
 m=checked_manifest();frozen='kaopu-tailor-workbench/presets/r034-'+m['sourceCommit'][:12]
 git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
 snapshot=Path(tempfile.mkdtemp(prefix='r03-snapshot-'))/'r03'
 shutil.copytree(HERE,snapshot,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
 work=Path(tempfile.mkdtemp(prefix='r03-pages-'))/'checkout'
 git('fetch','origin','gh-pages','--depth=1');git('worktree','add','--detach',str(work),'origin/gh-pages')
 protected=['kaopu-tailor-workbench/presets/r01','kaopu-tailor-workbench/presets/r02','kaopu-tailor-workbench/garments-r04','kaopu-tailor-workbench/r07','kaopu-tailor-workbench/catalogue']
 try:
  published=None
  for attempt in range(5):
   git('fetch','origin','gh-pages','--depth=1');parent=git('rev-parse','origin/gh-pages');git('checkout','--detach',parent,cwd=work)
   target=work/PREFIX
   if (target/'BUILD_MANIFEST.json').exists():assert json.loads((target/'BUILD_MANIFEST.json').read_text()).get('sourceBranch')==BRANCH,'Public path owned by another branch'
   shutil.copytree(snapshot,target,dirs_exist_ok=True)
   frozen_target=work/frozen
   if frozen_target.exists():
    for name,record in m['files'].items():assert sha(frozen_target/name)==record['sha256'],'Immutable snapshot conflict: '+name
   shutil.copytree(snapshot,frozen_target,dirs_exist_ok=True)
   git('add','--',PREFIX,frozen,cwd=work)
   changes=git('diff','--cached','--name-only',cwd=work).splitlines()
   assert changes and all(p.startswith(PREFIX+'/') or p.startswith(frozen+'/') for p in changes)
   git('commit','-m','publish(tailor-r03): add reviewed mannequin wardrobe and fixed snapshot; preserve R02 and sewing workbench',cwd=work)
   new=git('rev-parse','HEAD',cwd=work)
   protected_receipt={p:{'before':git('rev-parse',parent+':'+p,cwd=work),'after':git('rev-parse',new+':'+p,cwd=work)} for p in protected}
   assert all(v['before']==v['after'] for v in protected_receipt.values())
   try:git('push','origin','HEAD:refs/heads/gh-pages',cwd=work);published=new;break
   except subprocess.CalledProcessError:
    if attempt==4:raise
    time.sleep(2)
  assert published
  save('RELEASE_STATE.json',{'sourceCommit':m['sourceCommit'],'reviewedArtifactCommit':read('VISUAL_REVIEW.json')['reviewedArtifactCommit'],'publicationCommit':published,'pagesParentCommit':parent,'publicURL':ROOT+frozen+'/','latestURL':PUBLIC,'snapshotPrefix':frozen,'publicVerified':False,'physicalFitAccepted':False,'dynamicWearCertified':False,'protectedSubtrees':protected_receipt})
  retain(['RELEASE_STATE.json'],'docs(tailor-r03): record additive Pages publication pending real HTTPS acceptance')
  print('PUBLICATION_COMMIT',published,flush=True)
 finally:git('worktree','remove',str(work));shutil.rmtree(snapshot.parent,ignore_errors=True)

def get_bytes(path,attempts=4):
 last=None
 for i in range(attempts):
  try:
   url=ROOT+path+'?r03verify='+read('BUILD_MANIFEST.json')['sourceCommit'][:14]
   req=urllib.request.Request(url,headers={'Cache-Control':'no-cache','User-Agent':'KAOPU-R03-Public-Acceptance'})
   with urllib.request.urlopen(req,timeout=45) as r:return r.read()
  except Exception as e:last=e;time.sleep(min(2+i*2,8))
 raise RuntimeError((path,str(last)))

def verify():
 m=checked_manifest();frozen=read('RELEASE_STATE.json')['snapshotPrefix'];ready=False
 for _ in range(72):
  try:
   live=json.loads(get_bytes(frozen+'/BUILD_MANIFEST.json',1))
   if live.get('sourceCommit')==m['sourceCommit']:ready=True;break
  except Exception:pass
  time.sleep(8)
 assert ready,'The checked revision has not reached Pages; delivery incomplete'
 tasks=[(prefix+'/'+n,d['sha256']) for prefix in [PREFIX,frozen] for n,d in m['files'].items()]
 deps=['presets/r01/library.json','presets/r01/vendor/paper-preview.mjs','garments-r04/vendor/three.module.js','garments-r04/vendor/OrbitControls.js']
 lib=json.loads((HERE.parent/'r01/library.json').read_text())
 deps+=['presets/r01/'+r['paperAsset'] for r in lib['presets']]
 for n in deps:tasks.append(('kaopu-tailor-workbench/'+n,sha(HERE.parents[1]/n)))
 def check(item):
  p,expected=item;actual=hashlib.sha256(get_bytes(p)).hexdigest();assert actual==expected,(p,actual,expected)
  return {'path':p,'sha256':actual}
 with ThreadPoolExecutor(max_workers=6) as pool:results=list(pool.map(check,tasks))
 save('PUBLIC_BYTES.json',{'sourceCommit':m['sourceCommit'],'allSHA256Match':True,'checkedCount':len(results),'checked':results})
 print('PUBLIC_SHA256_PASS',len(results),flush=True)

def alias_smoke():
 from playwright.sync_api import sync_playwright
 out=HERE/'qa/public';out.mkdir(parents=True,exist_ok=True);errors=[]
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  page=b.new_page(viewport={'width':1440,'height':1080})
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(PUBLIC+'?preset=J06',wait_until='networkidle',timeout=120000)
  page.wait_for_function('window.__TAILOR_R03_QA__?.getState().ready',timeout=120000)
  s=page.evaluate('__TAILOR_R03_QA__.getState()');assert s['version']=='R03.4' and s['selectedId']=='J06' and s['canvasCount']==1
  page.locator('[data-view=side]').click();page.screenshot(path=str(out/'latest-alias-side.png'));assert page.evaluate('__TAILOR_R03_QA__.getState().renderer.view')=='side'
  assert not errors;save('ALIAS_REPORT.json',{'url':PUBLIC,'passed':True,'version':'R03.4','selectedId':'J06','canvasCount':1,'sideViewPassed':True,'pageErrors':errors});b.close()

def finish():
 r=read('PUBLIC_REPORT.json');m=checked_manifest();assert r['passed'] is True and r['public'] is True and r['sourceCommit']==m['sourceCommit'];assert read('ALIAS_REPORT.json')['passed'] is True
 s=read('RELEASE_STATE.json');s['publicVerified']=True;s['publicCheckCount']=len(r['checks']);s['publicBytesChecked']=read('PUBLIC_BYTES.json')['checkedCount'];save('RELEASE_STATE.json',s)
 retain(['PUBLIC_REPORT.json','PUBLIC_BYTES.json','ALIAS_REPORT.json','RELEASE_STATE.json','qa/public'],'docs(tailor-r03): retain real HTTPS browser checks and screenshots; physical certification remains false')
 print('PUBLIC_VERIFIED',git('rev-parse','HEAD'),flush=True)

if __name__=='__main__':{'publish':publish,'verify':verify,'alias':alias_smoke,'finish':finish}[sys.argv[1]]()
