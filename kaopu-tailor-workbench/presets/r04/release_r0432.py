"""Reviewed native R04.3.2 publication, byte verification and real HTTPS acceptance.
Preserve every previous snapshot and all original person/tailoring directories.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib,json,os,shutil,subprocess,sys,tempfile,time,urllib.request
P=Path(__file__).resolve().parent;ROOT=P.parents[2]
BRANCH='feature/tailor-cabinet-r03-garment-surfaces-20261009'
PREFIX='kaopu-tailor-workbench/presets/r04'
PUBLIC='https://haihao0307.github.io/guilin-dem-pipeline/'
def git(*args,cwd=ROOT):return subprocess.check_output(['git',*args],cwd=cwd,text=True).strip()
def load(n):return json.loads((P/n).read_text())
def save(n,d):(P/n).write_text(json.dumps(d,ensure_ascii=False,indent=2))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def checked():
 a=load('R0432_ACCEPTANCE.json');v=load('R0432_REVIEW.json')
 assert a['passed'] and not a['all60GarmentsAccepted']
 assert v['approvedForInteractiveReview'] and not v['userAccepted']
 assert a['sourceCommit']==v['reviewedSourceCommit']
 assert a['summary']['actualSolverRecords']==60 and a['summary']['staticGatePassedRecords']==22
 for n,r in a['files'].items():assert sha(P/n)==r['sha256'],('Unreviewed file change',n)
 idx=load('assets/results/index.json');assert len(idx['rows'])==60 and not idx.get('checkpoints')
 for r in idx['rows'].values():assert sha(P/'assets/results'/r['file'])==r['sha256']
 return a

def retain(paths,message):
 git('fetch','origin',BRANCH,'--depth=1')
 assert git('rev-parse','origin/'+BRANCH)==git('rev-parse','HEAD'),'Source advanced: do not overwrite another writer'
 git('add','--',*[PREFIX+'/'+n for n in paths])
 if git('diff','--cached','--name-only'):
  git('commit','-m',message);git('push','origin','HEAD:refs/heads/'+BRANCH)

def publish():
 a=checked();source=git('rev-parse','HEAD');fixed='kaopu-tailor-workbench/presets/r0432-'+source[:12]
 git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
 files=dict(a['files'])
 for n in ['R0432_ACCEPTANCE.json','R0432_REVIEW.json','R0432_CODE_PROOF.json','R0432_PROMOTION.json','PARAMETER_AUDIT_R043.json','R0431_PATCH_PROOF.json','R043C_ACCEPTANCE.json','R043C_SELECTED_ROUTES.json','SOURCE_AUDIT.json','RELEASE_NOTES_R0432_ZH.md']:
  files[n]={'sha256':sha(P/n),'bytes':(P/n).stat().st_size}
 m={'version':'R04.3.2-native','owner':BRANCH,'runtimeSourceCommit':source,'nativeSolveSourceCommit':a['sourceCommit'],
  'person':load('assets/identity.json')['person'],'summary':a['summary'],'sourceParameters':122,'outfits':432,
  'all60GarmentsAccepted':False,'physicalFitAccepted':False,'dynamicWearCertified':False,'jointOutfitCollisionCertified':False,'files':files}
 save('R0432_MANIFEST.json',m);save('R04_MANIFEST.json',m)
 temp=Path(tempfile.mkdtemp(prefix='r0432-publish-'));snapshot=temp/'snapshot';snapshot.mkdir()
 for n in [*files,'R0432_MANIFEST.json','R04_MANIFEST.json']:
  dest=snapshot/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(P/n,dest)
 work=temp/'pages';git('fetch','origin','gh-pages','--depth=1');git('worktree','add','--detach',str(work),'origin/gh-pages')
 receipt=None
 try:
  for attempt in range(5):
   git('fetch','origin','gh-pages','--depth=1');parent=git('rev-parse','origin/gh-pages');git('checkout','--detach',parent,cwd=work)
   oldPresets=git('ls-tree','--name-only',parent+':kaopu-tailor-workbench/presets',cwd=work).splitlines()
   protected=['kaopu-unified-human-workbench','kaopu-tailor-workbench/r07','kaopu-tailor-workbench/catalogue']+['kaopu-tailor-workbench/presets/'+n for n in oldPresets if n not in ['r04',fixed.rsplit('/',1)[-1]]]
   before={n:git('rev-parse',parent+':'+n,cwd=work) for n in protected}
   for n in [PREFIX,fixed]:
    target=work/n
    if target.exists() and any(target.iterdir()):
     assert (target/'R04_MANIFEST.json').exists(),'Unowned target '+n
     prior=json.loads((target/'R04_MANIFEST.json').read_text());assert prior['owner']==BRANCH
     if n==fixed:
      for f,r in files.items():assert sha(target/f)==r['sha256'],'Immutable snapshot conflict '+f
    shutil.copytree(snapshot,target,dirs_exist_ok=True)
   git('add','--sparse','--',PREFIX,fixed,cwd=work)
   changed=git('diff','--cached','--name-only',cwd=work).splitlines()
   assert changed and all(n.startswith(PREFIX+'/') or n.startswith(fixed+'/') for n in changed)
   git('commit','-m','publish(tailor-r0432): native 60-result wardrobe, verified parameters and 432 source outfits; retain failed quality states',cwd=work)
   commit=git('rev-parse','HEAD',cwd=work);after={n:git('rev-parse',commit+':'+n,cwd=work) for n in protected};assert before==after
   try:
    git('push','origin','HEAD:refs/heads/gh-pages',cwd=work)
    receipt={'publicationCommit':commit,'pagesParentCommit':parent,'runtimeSourceCommit':source,'nativeSolveSourceCommit':a['sourceCommit'],
      'fixedPrefix':fixed,'fixedURL':PUBLIC+fixed+'/?preset=S02','outfitURL':PUBLIC+fixed+'/?preset=T01-P01','latestURL':PUBLIC+PREFIX+'/?preset=S02',
      'protectedBefore':before,'protectedAfter':after,'summary':a['summary'],'publicVerified':False,'all60GarmentsAccepted':False,'physicalFitAccepted':False,'dynamicWearCertified':False};break
   except subprocess.CalledProcessError:
    if attempt==4:raise
    time.sleep(3)
  assert receipt
  save('R0432_RELEASE_STATE.json',receipt)
  retain(['R0432_MANIFEST.json','R04_MANIFEST.json','R0432_RELEASE_STATE.json'],'docs(tailor-r0432): retain additive publication receipt pending actual HTTPS verification')
  print('R0432_PUBLISHED',json.dumps(receipt,ensure_ascii=False),flush=True)
 finally:
  subprocess.run(['git','worktree','remove',str(work)],cwd=ROOT,check=False)
  shutil.rmtree(snapshot,ignore_errors=True)

def fetch(path,tries=4):
 last=None
 for i in range(tries):
  try:
   req=urllib.request.Request(PUBLIC+path+'?r0432='+load('R0432_MANIFEST.json')['runtimeSourceCommit'][:12],headers={'Cache-Control':'no-cache','User-Agent':'KAOPU-R0432-Public-Acceptance'})
   with urllib.request.urlopen(req,timeout=45) as r:return r.read()
  except Exception as e:last=e;time.sleep(2+i*2)
 raise RuntimeError((path,str(last)))

def verify():
 m=load('R0432_MANIFEST.json');state=load('R0432_RELEASE_STATE.json');fixed=state['fixedPrefix'];ready=False
 for _ in range(100):
  try:
   live=json.loads(fetch(fixed+'/R0432_MANIFEST.json',1))
   if live['runtimeSourceCommit']==m['runtimeSourceCommit']:ready=True;break
  except Exception:pass
  time.sleep(8)
 assert ready,'Reviewed version has not reached GitHub Pages; delivery incomplete'
 tasks=[(prefix+'/'+n,r['sha256']) for prefix in [PREFIX,fixed] for n,r in m['files'].items()]
 def check(t):
  n,h=t;got=hashlib.sha256(fetch(n)).hexdigest();assert got==h,n
  return{'path':n,'sha256':got}
 with ThreadPoolExecutor(max_workers=8) as pool:rows=list(pool.map(check,tasks))
 save('R0432_PUBLIC_BYTES.json',{'public':True,'allMatch':True,'checkedCount':len(rows),'runtimeSourceCommit':m['runtimeSourceCommit'],'checked':rows})
 print('R0432_PUBLIC_BYTES',len(rows),flush=True)

def alias():
 from playwright.sync_api import sync_playwright
 errors=[];out=P/'qa-r0432-public';out.mkdir(exist_ok=True)
 with sync_playwright()as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']);page=browser.new_page(viewport={'width':1440,'height':1080});page.set_default_timeout(300000)
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(PUBLIC+PREFIX+'/?preset=T01-P01',wait_until='domcontentloaded');page.wait_for_function('window.__R04?.state().ready',timeout=300000)
  s=page.evaluate('__R04.state()');assert s['release']=='R04.3.2' and s['phase']=='outfit' and s['person']==load('assets/identity.json')['person'] and s['renderCoordinateErrorM']==0 and s['clothIndexMatchesNative']
  page.evaluate('__R04.setCollection("outfits")');page.screenshot(path=str(out/'latest-alias-outfits.png'));assert not errors
  save('R0432_ALIAS_REPORT.json',{'public':True,'url':PUBLIC+PREFIX+'/','passed':True,'state':s,'errors':errors});browser.close()

def finish():
 names=['R043_PUBLIC_REPORT.json','R0431_PUBLIC_BROWSER_REPORT.json','R0432_PUBLIC_FRESH_REPORT.json','R0432_ALIAS_REPORT.json']
 rs={n:load(n)for n in names};assert all(r['passed']and r['public'] for r in rs.values())
 state=load('R0432_RELEASE_STATE.json');state['publicVerified']=True;state['publicPathsChecked']=load('R0432_PUBLIC_BYTES.json')['checkedCount'];state['publicCheckCounts']={n:len(r.get('checks',[]))for n,r in rs.items()}
 save('R0432_RELEASE_STATE.json',state)
 retain(names+['R0432_PUBLIC_BYTES.json','R0432_RELEASE_STATE.json','qa-r043-public','qa-r0431-public','qa-r0432-public'],'test(tailor-r0432): retain actual HTTPS source identity, all 60 results, live ease/outfit edits and fresh P06 solver evidence')
 print('R0432_PUBLIC_VERIFIED',git('rev-parse','HEAD'),flush=True)
if __name__=='__main__':{'publish':publish,'verify':verify,'alias':alias,'finish':finish}[sys.argv[1]]()
