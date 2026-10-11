"""Publish an additive UNVERIFIED development candidate. Never overwrite old pages."""
from pathlib import Path
from urllib.request import urlopen,Request
import subprocess,json,hashlib,tempfile,shutil,time
P=Path(__file__).resolve().parent
ROOT=Path(subprocess.check_output(['git','rev-parse','--show-toplevel'],text=True).strip())
BRANCH='feature/tailor-mp02-solid-textiles-20261011'
PREFIX='kaopu-tailor-workbench/material-products/r02'
HOST='https://haihao0307.github.io/guilin-dem-pipeline/'
def git(*args,cwd=ROOT):return subprocess.check_output(['git',*args],cwd=cwd,text=True).strip()
def digest(b):return hashlib.sha256(b).hexdigest()
def save(name,data):(P/name).write_text(json.dumps(data,ensure_ascii=False,indent=2))
def retain(names,message):
 git('fetch','origin',BRANCH,'--depth=1')
 assert git('rev-parse','HEAD')==git('rev-parse','origin/'+BRANCH),'Source advanced; refusing overwrite'
 git('add','--',*[PREFIX+'/'+n for n in names])
 if git('diff','--cached','--name-only'):
  git('commit','-m',message+' [skip ci]');git('push','origin','HEAD:refs/heads/'+BRANCH)
def publish():
 report=json.loads((P/'GEOMETRY_REPORT.json').read_text());assert report['passed'] and len(report['rows'])==7
 assert json.loads((P/'SHADER_REPORT.json').read_text())['passed']
 sha=git('rev-parse','HEAD');dest='kaopu-tailor-workbench/material-products/mp02-s1-'+sha[:12]
 files=['index.html','app.mjs','style.css','looks.mjs','outfits-r043.mjs','source-contract.mjs','sewn-normals-r0433.mjs','panel-grain.mjs','solid-textiles.mjs','geometry-core.mjs','geometry-worker.mjs','material-shaders.mjs','leather-field.mjs','cotton-surface.js','denim-core.js','materials.json','SOURCE_LOCK.json','INHERITANCE.json','README.md','THIRD_PARTY_NOTICES.md','GEOMETRY_REPORT.json','SHADER_REPORT.json']
 files += [str(f.relative_to(P)) for f in sorted((P/'native').glob('*.gz'))]
 manifest={'version':'MP02-S1','sourceCommit':sha,'files':{n:{'bytes':(P/n).stat().st_size,'sha256':digest((P/n).read_bytes())}for n in files},'deliveryComplete':False,'visualVerified':False,'browserBlock':'ERR_BLOCKED_BY_ADMINISTRATOR on local development URL','materialPhysicsCalibrated':False,'userAccepted':False}
 save('BUILD_MANIFEST.json',manifest)
 work=Path(tempfile.mkdtemp(prefix='mp02-pages-'));git('fetch','origin','gh-pages','--depth=1');git('worktree','add','--detach',str(work),'origin/gh-pages')
 try:
  for attempt in range(5):
   git('fetch','origin','gh-pages','--depth=1');parent=git('rev-parse','origin/gh-pages');git('checkout','--detach',parent,cwd=work);target=work/dest
   assert not target.exists(),'Never overwrite an immutable candidate'
   for name in files+['BUILD_MANIFEST.json']:
    (target/name).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(P/name,target/name)
   git('add','--sparse','--',dest,cwd=work);git('commit','-m','publish(mp02-s1): UNVERIFIED solid textile candidate; preserve old workbenches [skip ci]',cwd=work)
   commit=git('rev-parse','HEAD',cwd=work);changed=git('diff','--name-only',parent,commit,cwd=work).splitlines();assert all(x.startswith(dest+'/')for x in changed)
   old='kaopu-tailor-workbench/material-products/mp01-ff151f3bf29e';before=git('rev-parse',parent+':'+old,cwd=work);after=git('rev-parse',commit+':'+old,cwd=work);assert before==after
   try:git('push','origin','HEAD:refs/heads/gh-pages',cwd=work);break
   except subprocess.CalledProcessError:
    if attempt==4:raise
    time.sleep(3)
  state={'version':'MP02-S1','sourceCommit':sha,'publicationCommit':commit,'fixedURL':HOST+dest+'/?look=L04&top=leather-patent&bottom=denim-bleach','oldMP01TreeBefore':before,'oldMP01TreeAfter':after,'changedPathsOnlyNewSnapshot':True,'publicBytesVerified':False,'visualVerified':False,'deliveryComplete':False}
  save('RELEASE_STATE.json',state)
 finally:subprocess.run(['git','worktree','remove',str(work)],cwd=ROOT,check=False)
 # HTTP success and hashes deliberately do not count as browser verification.
 public=[]
 for attempt in range(40):
  try:
   with urlopen(Request(HOST+dest+'/BUILD_MANIFEST.json',headers={'User-Agent':'KAOPU-source-validation'}),timeout=30)as r:remote=json.load(r)
   if remote['sourceCommit']==sha:break
  except Exception:pass
  time.sleep(6)
 else:raise RuntimeError('New public bytes unavailable; delivery remains incomplete')
 for name,entry in manifest['files'].items():
  with urlopen(Request(HOST+dest+'/'+name,headers={'User-Agent':'KAOPU-source-validation'}),timeout=60)as r:data=r.read()
  assert digest(data)==entry['sha256'],name
  public.append({'path':name,'sha256':digest(data),'bytes':len(data)})
 state['publicBytesVerified']=True;save('RELEASE_STATE.json',state);save('PUBLIC_BYTES.json',{'passed':True,'visualVerified':False,'files':public})
 retain(['BUILD_MANIFEST.json','RELEASE_STATE.json','PUBLIC_BYTES.json'],'docs(mp02): record source-verified candidate; visual delivery incomplete')
 print(json.dumps(state),flush=True)
if __name__=='__main__':publish()
