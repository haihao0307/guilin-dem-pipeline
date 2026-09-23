"""Guarded delivery helper; no source/model modifications or implicit approval."""
import datetime,hashlib,json,os,shutil,subprocess,sys,time,urllib.request
from pathlib import Path
OUT=Path('dist/fish-mother-yellowfin');PUB=Path('public/fish-mother-yellowfin');VERSION='FISH_ORAL_MERGE_R009';BASE='https://haihao0307.github.io/guilin-dem-pipeline/fish-mother-yellowfin/';PREVIOUS='60e2c6d054f2a74a33aa8bd530e365c021b24927'
H=lambda b:hashlib.sha256(b).hexdigest()
def read(p):return json.loads(p.read_text())
def git(*args):return subprocess.run(['git',*args],cwd='public',check=True,capture_output=True,text=True).stdout.strip()
def push(message):
 git('config','user.name','Fish Mother Build');git('config','user.email','fish-mother@users.noreply.github.com');git('add','fish-mother-yellowfin');git('commit','-m',message)
 for attempt in range(3):
  try:git('push','origin','HEAD:gh-pages');return
  except subprocess.CalledProcessError:
   if attempt==2:raise
   git('pull','--rebase','origin','gh-pages')
def review():
 from PIL import Image
 rows=[];root=OUT/'evidence';root.mkdir(parents=True,exist_ok=True)
 for name in ['r009-oral-min','r009-oral-max','r009-oral-front']:
  src=root/(name+'.png')
  if src.exists():
   im=Image.open(src).convert('RGB');im=im.crop((0,130,1175,837));im.thumbnail((480,290));p=root/(name+'.webp');im.save(p,quality=45,method=6)
   rows.append({'source':src.name,'sourceSha256':H(src.read_bytes()),'inspection':p.name,'inspectionSha256':H(p.read_bytes()),'bytes':p.stat().st_size})
 (root/'ORAL_MERGE_INSPECTION.json').write_text(json.dumps(rows,indent=2))
def predecessor():
 # The earlier concurrent writer must finish its proof before we replace the entry.
 for i in range(45):
  u='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/gh-pages/fish-mother-yellowfin/PUBLICATION_PROOF.json?merge='+str(time.time_ns())
  with urllib.request.urlopen(u,timeout=30) as r:p=json.load(r)
  if p.get('version') not in ['FISH_FEATURES_R008',VERSION]:raise RuntimeError('Unexpected concurrent Fish release; stop')
  if p.get('shareAllowed') and p.get('sourceBuildSha')==PREVIOUS:return
  if p.get('version')==VERSION and p.get('sourceBuildSha')==os.environ['GITHUB_SHA']:return
  print('WAIT_PREDECESSOR_PROOF',p.get('version'),flush=True);time.sleep(10)
 raise RuntimeError('Predecessor not complete; no overwrite')
def publish():
 old=PUB/'index.html';header=old.read_bytes()[:2500];proof=read(PUB/'PUBLICATION_PROOF.json');manifest=read(PUB/'BUILD_MANIFEST.json')
 assert b'FISH_FEATURES_R008' in header or VERSION.encode() in header,'Concurrent unexpected Fish page'
 if b'FISH_FEATURES_R008' in header:
  assert proof['shareAllowed'] and proof['sourceBuildSha']==PREVIOUS and manifest['buildSha']==PREVIOUS,'Predecessor proof not complete/current'
  assert H(old.read_bytes())==proof['htmlSha256'],'Predecessor page differs from proof'
  archive=PUB/'r008';archive.mkdir(exist_ok=True);shutil.copyfile(old,archive/'index.html')
  for name in ['PUBLICATION_PROOF.json','BROWSER_QA.json','PUBLIC_BROWSER_QA.json','BUILD_MANIFEST.json','OPENFIX_QA.json','PUBLIC_OPENFIX_QA.json']:
   if (PUB/name).exists():shutil.copyfile(PUB/name,archive/name)
 shutil.copytree(OUT,PUB,dirs_exist_ok=True)
 (PUB/'PUBLICATION_PROOF.json').write_text(json.dumps({'version':VERSION,'shareAllowed':False,'reason':'Await exact public R009 verification','productionReady':False}))
 push('Fish R009 additive oral+surface-feature merge; preserve R008 and other Mothers')
def wait_public():
 expected=H((OUT/'index.html').read_bytes())
 for i in range(75):
  try:
   for u in [BASE,BASE+'?v=r009']:
    with urllib.request.urlopen(u,timeout=45) as r:b=r.read();status=r.status
    assert status==200 and H(b)==expected,'Public HTML is not current'
   print('PUBLIC_CURRENT_HASH_PASS',expected,len(b),flush=True);return
  except Exception as e:print('PUBLIC_WAIT',str(e),flush=True)
  time.sleep(10)
 raise RuntimeError('Exact public bytes not verified')
def proof():
 q=read(OUT/'PUBLIC_BROWSER_QA.json');b=read(OUT/'BUILD_MANIFEST.json');offline=read(OUT/'BROWSER_QA.json');local=read(OUT/'OPENFIX_QA.json');live=read(OUT/'PUBLIC_OPENFIX_QA.json')
 assert q['browserPass'] and offline['browserPass'] and local['passed'] and live['passed']
 for x in ['allPoseChecks','headAudit','featureAudit','oralAudit']:assert q[x]['passed']
 assert q['additiveMergePass'] and q['errors']==[]
 value={'version':VERSION,'url':BASE+'?v=r009','sourceBuildSha':os.environ['GITHUB_SHA'],'verificationRunId':os.environ['GITHUB_RUN_ID'],'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'predecessorSourceSha':PREVIOUS,'oralSourceSha':'6f2aec5e79f844311d3970bf6dfbd3fa64eb8abc','httpStatus':200,'htmlSha256':b['sha256'],'htmlBytes':b['bytes'],'publicFullFileHashMatchesBuild':True,'fileProtocolBrowserPass':True,'publicBrowserPass':True,'desktopPass':q['desktopPass'],'mobileViewportPass':q['mobilePass'],'physicalMobileDeviceTested':False,'userDeviceRetested':False,'originalClientCauseConfirmed':False,'visibleHtmlBeforeSource':b['visibleHtmlBeforeSource'],'sourceChunkRoundtripHashMatches':b['sourceChunkRoundtripHashMatches'],'sourceGlbSha256':b['sourceGlbSha256'],'sourcePrecisionChanged':False,'openfixLocal':local,'openfixPublic':live,'consoleAndPageErrorsInNormalRegression':q['errors'],'anatomicalPartitionApproved':False,'stageAComplete':False,'independentGenerator':False,'productionReady':False,'manualVisualAcceptance':False,'shareAllowed':True}
 for key in ['allPoseChecks','silhouettes','regionChecks','boundaryAudit','headAudit','featureStudy','featureAudit','featureSelections','oralStudy','oralAudit','oralSamples','oralTrace','materialRestoration','additiveMergePass']:value[key]=q[key]
 assert read(PUB/'BUILD_MANIFEST.json')['sha256']==b['sha256']
 for p in [OUT/'PUBLICATION_PROOF.json',PUB/'PUBLICATION_PROOF.json']:p.write_text(json.dumps(value,indent=2))
 for name in ['PUBLIC_BROWSER_QA.json','OPENFIX_QA.json','PUBLIC_OPENFIX_QA.json']:shutil.copyfile(OUT/name,PUB/name)
 push('Fish R009 exact-public additive-merge and source oral verification receipt')
 print('R009_PUBLIC_VERIFIED',json.dumps(value),flush=True)
if __name__=='__main__':
 {'review':review,'predecessor':predecessor,'publish':publish,'wait':wait_public,'proof':proof}[sys.argv[1]]()
