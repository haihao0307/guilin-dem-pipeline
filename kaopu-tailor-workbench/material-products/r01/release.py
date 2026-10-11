from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request,urlopen
import hashlib,json,os,shutil,subprocess,tempfile,time,sys
P=Path(__file__).resolve().parent;ROOT=P.parents[2];BRANCH='feature/tailor-three-material-products-r01-20261011';PREFIX='kaopu-tailor-workbench/material-products/r01';HOST='https://haihao0307.github.io/guilin-dem-pipeline/'
def git(*a,cwd=ROOT):return subprocess.check_output(['git',*a],cwd=cwd,text=True).strip()
def load(n):return json.loads((P/n).read_text())
def save(n,d):(P/n).write_text(json.dumps(d,ensure_ascii=False,indent=2))
def digest(b):return hashlib.sha256(b).hexdigest()
def retain(names,msg):
 git('fetch','origin',BRANCH,'--depth=1');assert git('rev-parse','HEAD')==git('rev-parse','origin/'+BRANCH),'Another source writer advanced; no overwrite'
 git('add','--',*[PREFIX+'/'+n for n in names]);git('commit','-m',msg);git('push','origin','HEAD:refs/heads/'+BRANCH)
def publish():
 r=load('CANDIDATE_REPORT.json');assert r['passed'] and len(r['looks'])==12 and all(v['passed'] for v in r['looks'])
 source=load('SOURCE_LOCK.json');mats=load('materials.json');assert len(mats)==12 and len(source['garments'])==7
 files=['index.html','style.css','app.mjs','looks.mjs','outfits-r043.mjs','source-contract.mjs','sewn-normals-r0433.mjs','SOURCE_LOCK.json','materials.json','EXPORT_SOURCE_RECEIPT.json','EXPORT_FIELDS_REPORT.json','CANDIDATE_REPORT.json','THIRD_PARTY_NOTICES.md','native/identity.json','panel-grain.mjs','PANEL_GRAIN_REPORT.json','TEXTURE_PACK_REPORT.json','INTEGRATION_PATCH.json']
 files += [r['path'] for r in source['garments'].values()]
 for row in mats:
  for x in row['files'].values():assert digest((P/x['path']).read_bytes())==x['sha256'];files.append(x['path'])
 files += ['thumbs/'+row['id']+'.png' for row in r['looks']]
 assert len(files)==len(set(files)) and not any('MATERIAL_EXPORT_INPUT' in n or 'source/knit' in n for n in files)
 sha=git('rev-parse','HEAD');dest='kaopu-tailor-workbench/material-products/mp01-'+sha[:12]
 info={n:{'sha256':digest((P/n).read_bytes()),'bytes':(P/n).stat().st_size} for n in files}
 manifest={'version':'MP01','sourceCommit':sha,'candidateSourceCommit':r['sourceCommit'],'files':info,'lookCount':12,'materialCount':12,'garmentCount':7,'privateKnitSourceIncluded':False,'garmentVerticesChanged':False,'materialPhysicsCalibrated':False,'jointOutfitCollisionCertified':False,'userVisualAccepted':False};save('BUILD_MANIFEST.json',manifest)
 git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
 work=Path(tempfile.mkdtemp(prefix='mp01-pages-'));git('fetch','origin','gh-pages','--depth=1');git('worktree','add','--detach',str(work),'origin/gh-pages')
 try:
  for attempt in range(4):
   git('fetch','origin','gh-pages','--depth=1');parent=git('rev-parse','origin/gh-pages');git('checkout','--detach',parent,cwd=work);target=work/dest;assert not target.exists(),'Immutable directory already exists'
   for n in files+['BUILD_MANIFEST.json']:
    f=target/n;f.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(P/n,f)
   git('add','--sparse','--',dest,cwd=work);git('commit','-m','publish(tailor-mp01): isolated three-material product exhibition, all old entrances retained',cwd=work);commit=git('rev-parse','HEAD',cwd=work)
   changed=git('diff','--name-only',parent,commit,cwd=work).splitlines();assert changed and all(n.startswith(dest+'/') for n in changed)
   protected=['kaopu-tailor-workbench/presets','kaopu-unified-human-workbench','kaopu-tailor-workbench/catalogue','kaopu-tailor-workbench/r07']
   proof={n:{'before':git('rev-parse',parent+':'+n,cwd=work),'after':git('rev-parse',commit+':'+n,cwd=work)} for n in protected};assert all(x['before']==x['after'] for x in proof.values())
   try:git('push','origin','HEAD:refs/heads/gh-pages',cwd=work);break
   except subprocess.CalledProcessError:
    if attempt==3:raise
    time.sleep(3)
  state={'sourceCommit':sha,'publicationCommit':commit,'pagesParentCommit':parent,'fixedPrefix':dest,'fixedURL':HOST+dest+'/?look=K02','protectedTrees':proof,'allChangedPathsInsideNewSnapshot':True,'publicVerified':False,'userVisualAccepted':False,'materialPhysicsCalibrated':False};save('RELEASE_STATE.json',state);retain(['BUILD_MANIFEST.json','RELEASE_STATE.json'],'docs(tailor-mp01): record new immutable publication pending real HTTPS verification')
 finally:subprocess.run(['git','worktree','remove',str(work)],cwd=ROOT,check=False)
 print('MP01_PUBLISHED',state['fixedURL'],flush=True)
def fetch(path):
 with urlopen(Request(HOST+path,headers={'User-Agent':'KAOPU-MP01-Acceptance','Cache-Control':'no-cache'}),timeout=90) as r:return r.read()
def verify():
 state=load('RELEASE_STATE.json');m=load('BUILD_MANIFEST.json');prefix=state['fixedPrefix'];ready=False
 for _ in range(90):
  try:
   if json.loads(fetch(prefix+'/BUILD_MANIFEST.json'))['sourceCommit']==m['sourceCommit']:ready=True;break
  except Exception:pass
  time.sleep(8)
 assert ready,'Actual Pages snapshot not available; delivery incomplete'
 def check(item):
  n,meta=item;b=fetch(prefix+'/'+n);assert digest(b)==meta['sha256'],n
  return {'path':n,'sha256':digest(b),'bytes':len(b)}
 with ThreadPoolExecutor(max_workers=6) as pool:rows=list(pool.map(check,m['files'].items()))
 save('PUBLIC_BYTES.json',{'passed':True,'actualHTTPS':True,'checkedCount':len(rows),'checked':rows,'sourceCommit':m['sourceCommit']});print('ACTUAL_PUBLIC_BYTES_PASS',len(rows),flush=True)
def finish():
 r=load('PUBLIC_REPORT.json');b=load('PUBLIC_BYTES.json');assert r['passed'] and r['public'] and not r['networkMocked'] and len(r['looks'])==12 and b['passed']
 state=load('RELEASE_STATE.json');state.update(publicVerified=True,publicChecks=len(r['checks']),publicFilesChecked=b['checkedCount']);save('RELEASE_STATE.json',state)
 retain(['RELEASE_STATE.json','PUBLIC_REPORT.json','PUBLIC_BYTES.json','qa/public'],'test(tailor-mp01): retain verified actual HTTPS product views, controls and native geometry proof');print('MP01_PUBLIC_VERIFIED',state['fixedURL'],flush=True)
if __name__=='__main__':{'publish':publish,'verify':verify,'finish':finish}[sys.argv[1]]()
