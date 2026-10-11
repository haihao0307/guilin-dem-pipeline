"""Additive R0434 release. No old entrance, garment gate or unrelated workbench is modified."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib,json,os,shutil,subprocess,sys,tempfile,time,urllib.request,io
P=Path(__file__).resolve().parent;ROOT=P.parents[2]
BRANCH='fix/tailor-display-r0434-20261011';PREFIX='kaopu-tailor-workbench/presets/r04';PUBLIC='https://haihao0307.github.io/guilin-dem-pipeline/'
def git(*a,cwd=ROOT):return subprocess.check_output(['git',*a],cwd=cwd,text=True).strip()
def load(n):return json.loads((P/n).read_text())
def save(n,d):(P/n).write_text(json.dumps(d,ensure_ascii=False,indent=2))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def retain(paths,message):
 git('fetch','origin',BRANCH,'--depth=1')
 assert git('rev-parse','origin/'+BRANCH)==git('rev-parse','HEAD'),'Source advanced; do not overwrite another writer'
 git('add','--',*[PREFIX+'/'+n for n in paths])
 if git('diff','--cached','--name-only'):git('commit','-m',message);git('push','origin','HEAD:refs/heads/'+BRANCH)
def publish():
 report=load('R0434_BROWSER_REPORT.json');safety=load('R0434_SAFETY_REPORT.json');idx=load('assets/results/index.json');pin=load('R0434_PERSON_PIN.json')
 assert report['passed'] and safety['passed'] and len(report['styles'])==60 and len(report['outfits'])==432
 assert all(r['passedDisplay'] for r in report['styles']+report['outfits'])
 assert len(idx['rows'])==60 and sum(r['qualityPassed'] for r in idx['rows'].values())==22
 assert pin['coreHashesUnchanged'] and pin['vertices']==25417 and pin['triangles']==50624
 for id,r in idx['rows'].items():
  assert sha(P/'assets/results'/r['file'])==r['sha256'] and r['thumbReady'],id
  assert sha(P/'assets/results'/r['thumb'])==r['thumbSHA256'],id
 for r in report['outfits']:assert sha(P/'assets/outfits'/(r['id']+'.png'))==r['thumbSHA256'],r['id']
 files=set(load('R0432_ACCEPTANCE.json')['files'])
 files.update(['parameter-schema.json','PARAMETER_AUDIT_R043.json','SOURCE_AUDIT.json','display-r0433.mjs','sewn-normals-r0433.mjs','initial-placement-r0433.mjs','resource-r0434.mjs','R0433_NATIVE_REVIEW.json','R0433_RUNTIME_REPAIR.json','R0433_DISPLAY_PATCH.json','RELEASE_NOTES_R0433_ZH.md','R0434_SOURCE_PATCH.json','R0434_PERSON_PIN.json','R0434_QA_INHERITANCE.json','R0434_BROWSER_REPORT.json','R0434_SAFETY_REPORT.json'])
 files.update(str(f.relative_to(P)) for f in (P/'person-core').rglob('*') if f.is_file())
 info={n:{'sha256':sha(P/n),'bytes':(P/n).stat().st_size} for n in sorted(files)}
 from bundle_closure_r0432 import verify_literal_json_closure
 save('R0434_BUNDLE_CLOSURE.json',verify_literal_json_closure(P,info))
 info['R0434_BUNDLE_CLOSURE.json']={'sha256':sha(P/'R0434_BUNDLE_CLOSURE.json'),'bytes':(P/'R0434_BUNDLE_CLOSURE.json').stat().st_size}
 source=git('rev-parse','HEAD');fixed='kaopu-tailor-workbench/presets/r0434-'+source[:12]
 m={'version':'R04.3.4','owner':BRANCH,'runtimeSourceCommit':source,'testedSourceCommit':report['sourceCommit'],'person':load('assets/identity.json')['person'],'personRuntimeCommit':pin['sourceCommit'],'categories':report['categories'],'styleCount':60,'outfitCount':432,'parameterCount':122,'staticPassCount':22,'needsRepairCount':38,'materialRecordsChangedThisRevision':False,'all60GarmentsAccepted':False,'physicalFitAccepted':False,'dynamicWearCertified':False,'jointOutfitCollisionCertified':False,'files':info}
 save('R0434_MANIFEST.json',m)
 git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
 temp=Path(tempfile.mkdtemp(prefix='r0434-'));snapshot=temp/'snapshot';snapshot.mkdir()
 for n in [*info,'R0434_MANIFEST.json']:
  dest=snapshot/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(P/n,dest)
 work=temp/'pages';git('fetch','origin','gh-pages','--depth=1');git('worktree','add','--detach',str(work),'origin/gh-pages');state=None
 try:
  for attempt in range(5):
   git('fetch','origin','gh-pages','--depth=1');parent=git('rev-parse','origin/gh-pages');git('checkout','--detach',parent,cwd=work)
   target=work/fixed;assert not target.exists(),'Immutable snapshot already exists; never overwrite'
   shutil.copytree(snapshot,target);git('add','--sparse','--',fixed,cwd=work)
   changed=git('diff','--cached','--name-only',cwd=work).splitlines();assert changed and all(n.startswith(fixed+'/') for n in changed)
   git('commit','-m','publish(tailor-r0434): isolated verified display; all old entrances untouched',cwd=work);commit=git('rev-parse','HEAD',cwd=work)
   protected=['kaopu-tailor-workbench/presets/r0432-eeca9dee0c3a','kaopu-tailor-workbench/presets/r0433-f2e0cf1646b6',PREFIX,'kaopu-unified-human-workbench','kaopu-tailor-workbench/catalogue','kaopu-tailor-workbench/r07']
   proof={n:{'before':git('rev-parse',parent+':'+n,cwd=work),'after':git('rev-parse',commit+':'+n,cwd=work)} for n in protected}
   assert all(v['before']==v['after'] for v in proof.values())
   try:
    git('push','origin','HEAD:refs/heads/gh-pages',cwd=work)
    state={'publicationCommit':commit,'pagesParentCommit':parent,'runtimeSourceCommit':source,'fixedPrefix':fixed,'fixedURL':PUBLIC+fixed+'/?preset=T01-P01','protectedTrees':proof,'changedOnlyInsideNewSnapshot':True,'publicVerified':False,'all60GarmentsAccepted':False};break
   except subprocess.CalledProcessError:
    if attempt==4:raise
    time.sleep(3)
  assert state;save('R0434_RELEASE_STATE.json',state)
  retain(['R0434_MANIFEST.json','R0434_BUNDLE_CLOSURE.json','R0434_RELEASE_STATE.json'],'docs(tailor-r0434): record immutable publication pending actual HTTPS acceptance')
 finally:
  subprocess.run(['git','worktree','remove',str(work)],cwd=ROOT,check=False);shutil.rmtree(snapshot,ignore_errors=True)
 print('R0434_PUBLISHED',json.dumps(state),flush=True)
def fetch(path,tries=4):
 for i in range(tries):
  try:
   with urllib.request.urlopen(urllib.request.Request(PUBLIC+path,headers={'Cache-Control':'no-cache','User-Agent':'KAOPU-R0434-Public-QA'}),timeout=60) as r:return r.read()
  except Exception:
   if i+1==tries:raise
   time.sleep(2+i*2)
def verify():
 from PIL import Image,ImageStat
 m=load('R0434_MANIFEST.json');state=load('R0434_RELEASE_STATE.json');fixed=state['fixedPrefix'];ready=False
 for i in range(80):
  try:
   if json.loads(fetch(fixed+'/R0434_MANIFEST.json',1))['runtimeSourceCommit']==m['runtimeSourceCommit']:ready=True;break
  except Exception:pass
  time.sleep(8)
 assert ready,'R0434 has not reached actual Pages; delivery incomplete'
 active={'assets/results/'+r['thumb'] for r in load('assets/results/index.json')['rows'].values()}|{'assets/outfits/'+r['id']+'.png' for r in load('R0434_BROWSER_REPORT.json')['outfits']}
 assert len(active)==492 and active<=set(m['files'])
 def check(item):
  name,meta=item;data=fetch(fixed+'/'+name);h=hashlib.sha256(data).hexdigest();assert h==meta['sha256'],name
  if name in active:
   im=Image.open(io.BytesIO(data));im.load();assert im.size==(320,400),name;assert max(ImageStat.Stat(im.convert('RGB')).stddev)>5,name
  return {'path':name,'sha256':h,'decodedCurrent3DPreview':name in active}
 with ThreadPoolExecutor(max_workers=8) as pool:rows=list(pool.map(check,m['files'].items()))
 assert sum(r['decodedCurrent3DPreview'] for r in rows)==492
 save('R0434_PUBLIC_BYTES.json',{'public':True,'allMatch':True,'runtimeSourceCommit':m['runtimeSourceCommit'],'checkedCount':len(rows),'decodedNonemptyPreviewCount':492,'previewScope':'exact 60 active native previews plus 432 current outfits; all retained historic files still hash-checked','checked':rows})
 print('R0434_PUBLIC_BYTES',len(rows),'decoded current previews',492,flush=True)
def finish():
 report=load('R0434_PUBLIC_REPORT.json');fresh=load('R0434_FRESH_PUBLIC_REPORT.json');safety=load('R0434_SAFETY_PUBLIC_REPORT.json');data=load('R0434_PUBLIC_BYTES.json')
 assert report['passed'] and report['actualPublicBrowser'] and not report.get('immutableNetworkReplay')
 assert fresh['passed'] and fresh['public'] and safety['passed'] and safety['actualPublicBrowser'] and data['allMatch']
 state=load('R0434_RELEASE_STATE.json');state.update(publicVerified=True,publicPathsChecked=data['checkedCount'],decoded3DPreviewCount=492,publicCheckCount=len(report['checks']),publicFreshCheckCount=len(fresh['checks']),publicSafetyCheckCount=len(safety['checks']),categories=report['categories']);save('R0434_RELEASE_STATE.json',state)
 retain(['R0434_RELEASE_STATE.json','R0434_PUBLIC_REPORT.json','R0434_FRESH_PUBLIC_REPORT.json','R0434_SAFETY_PUBLIC_REPORT.json','R0434_PUBLIC_BYTES.json','qa-r0434-public','qa-r0434-fresh-public','qa-r0434-safety-public'],'test(tailor-r0434): retain actual HTTPS all-style/outfit, fresh sewing and failure-recovery evidence')
 print('R0434_PUBLIC_VERIFIED',git('rev-parse','HEAD'),flush=True)
if __name__=='__main__':{'publish':publish,'verify':verify,'finish':finish}[sys.argv[1]]()
