"""Publish R07 to a new isolated branch. Main and the R05 branch stay untouched."""
from pathlib import Path
import urllib.request,urllib.error,subprocess,json,base64,os,hashlib,sys,time
P=Path(__file__).resolve().parents[1]
REPO='haihao0307/guilin-dem-pipeline';PARENT='ce566f5801401ec5d79bd51b56fd10fb7c91fea1';BRANCH='fix/hair-surface-contact-r07-20261015';PREFIX='kaopu-hair-workbench/research/hair-character-r07'
def read(name):return json.loads((P/name).read_text(encoding='utf-8-sig'))
def digest(data):return hashlib.sha256(data).hexdigest()
c=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',text=True,capture_output=True,env=dict(os.environ,GCM_INTERACTIVE='Never'),timeout=25)
if c.returncode:raise RuntimeError('GitHub credential unavailable')
cred=dict(line.split('=',1) for line in c.stdout.splitlines() if '=' in line)
def api(path,data=None,method=None):
 req=urllib.request.Request('https://api.github.com/repos/'+REPO+path,data=json.dumps(data,ensure_ascii=False).encode() if data is not None else None,headers={'Authorization':'Bearer '+cred.get('password',''),'Accept':'application/vnd.github+json','User-Agent':'Codex-Hair-R07','Content-Type':'application/json'},method=method)
 with urllib.request.urlopen(req,timeout=100) as response:return json.load(response)
cachepath=P/'qa/publish-blob-cache.json';cache=read('qa/publish-blob-cache.json') if cachepath.exists() else {}
def blob(relative):
 data=(P/relative).read_bytes();key=digest(data)
 if key not in cache:
  print('Uploading',str(relative),len(data),flush=True)
  cache[key]=api('/git/blobs',{'content':base64.b64encode(data).decode(),'encoding':'base64'})['sha'];cachepath.write_text(json.dumps(cache),encoding='utf-8')
 return cache[key]
if '--stage' in sys.argv:
 immutable=[Path('references/character-platform-frozen.html'),Path('references/three.module.js')]+list(Path('references/motion')/f.name for f in (P/'references/motion').glob('*SOURCE.json'))+[Path(x['file']) for x in read('PUBLIC_BUILD.json')['parts']]
 for relative in immutable:blob(relative)
 print('Immutable transport blobs staged',len(immutable),flush=True);raise SystemExit(0)
manifest=read('BUILD_MANIFEST.json')
for report in ['unit-report.json','character-report.json','motion-contact-report.json','distance-performance.json','cache-quality-report.json','frame-manifest-r07.json','surface-opacity-distance-report.json','refined-surface-report.json']:
 d=read('qa/'+report);assert d['passed'],report;assert d['sourceHashes']==manifest['files'],report+' hashes'
assert digest((P/'references/character-platform-frozen.html').read_bytes())==read('references/CHARACTER-PUBLICATION.json')['platformSHA256']
for name,value in manifest['files'].items():assert digest((P/name).read_bytes())==value,name
publicBuild=read('PUBLIC_BUILD.json');loader=read('qa/loader-report.json');assert loader['passed'] and loader['wrappers']==publicBuild
for style in ['medium','long']:assert publicBuild['wrappers'][style]['decompressedSHA256']==manifest['files'][f'preview-{style}.html']
for part in publicBuild['parts']:assert digest((P/part['file']).read_bytes())==part['sha256']
contact=read('qa/contact-capture-report.json');assert contact['passed'] and contact['sourceHashes']==manifest['files']
for artifact in ['visual-artifacts.json','contact-artifacts.json']:assert read('qa/'+artifact)['sourceHashes']==manifest['files']
record={'version':'HAIR-CHARACTER-R07','status':'public candidate; local verified; artistic review pending','characterSource':'ab499da18b1da1e256cd66e35ec1212183c58028','hairSource':'6c116f8122d934e1d7b9e8e2abee7daba3830688','sameNativeMainPerson':True,'orderedDisplayStrandContacts':True,'nativeRefinedHeadContact':True,'distantMotionRetained':True,'bundleFriction':True,'styles':['medium','long'],'guides':192,'nodesPerGuide':25,'maxDisplayStrandsPerHead':64000,'physicsHz':60,'whiteBackground':True,'shortPile':False,'newExternalHairAssets':False,'continuousDistanceSampling':True,'substituteHairModels':False,'fineContactSolverLimit':1,'crowdFixtures':[12,24,48],'externalEllipsoidSlots':2,'mouseControlled':False,'files':manifest['files'],'limits':['distant heads retain four directional 3D pendulums and a shared rest field','one fine solver in this workbench','conservative native skin depth-normal fields, not an exact body SDF','guide-bundle friction is aggregate; no complete individual-fiber self-contact, wet adhesion or two-way rigid-body coupling','display modal deformation does not strictly retain each fiber arc length','crowd fixtures do not measure independent full characters or networking','no deep-opacity hair cast shadow','uncalibrated optical, bundle and air parameters']}
(P/'DELIVERY.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
try:
 existing=api('/git/ref/heads/'+BRANCH)['object']['sha'];raise RuntimeError('R07 branch already exists at '+existing+'; inspect saved state before recovery')
except urllib.error.HTTPError as error:
 if error.code!=404:raise
parent=api('/git/commits/'+PARENT)
paths=[Path(f) for f in ['public.html','public-medium.html','public-long.html','PUBLIC_BUILD.json','HOST_COMPATIBILITY.json','index.html','README.md','BUILD_MANIFEST.json','DELIVERY.json','docs/research.md','docs/performance.md','references/character-platform-frozen.html','references/three.module.js','references/CHARACTER-PUBLICATION.json','references/CHARACTER-SOURCES.md','references/MOTION-SOURCES.md']]
paths.extend(sorted(f.relative_to(P) for f in (P/'src').glob('*.mjs')))
paths.extend(sorted(f.relative_to(P) for f in (P/'references/motion').iterdir() if f.is_file()))
paths.extend(sorted(f.relative_to(P) for f in (P/'tests').glob('*.mjs')))
paths.extend(Path('tools')/f for f in ['build.cjs','serve.cjs','build-public.py','test-public-loader.cjs','run-unit.cjs','run-final-checks.py','test-character.cjs','test-motion-contact.cjs','test-distance-performance.cjs','test-cache-quality.cjs','test-surface-opacity-distance.cjs','test-refined-surface.cjs','capture-contact.cjs','make-contact-visuals.py','capture-motion.cjs','make-motion-gif.py','summarize-r07.py','publish.py','public-check.cjs','publish-verification.py'])
paths.extend(Path('qa')/f for f in ['unit-report.json','character-report.json','motion-contact-report.json','distance-performance.json','distance-summary.json','cache-quality-report.json','cache-visual-difference.json','frame-manifest-r07.json','visual-artifacts.json','loader-report.json','surface-opacity-distance-report.json','refined-surface-report.json','contact-capture-report.json','contact-artifacts.json','medium-black-oblique.png','medium-black-top.png','long-black-oblique.png','long-black-back.png','contact-fluffy-long-sphere.png','contact-fluffy-long-blocker.png','crowd-medium-48.png','crowd-long-48.png','crowd-approach-detail.png','mid-long-jump-body.png','hair-motion-r07.gif','motion-overview.jpg','distance-overview.jpg','mobile.png','r07-contact-overview.jpg','r07-far-motion.gif','r07-close-face.png','r07-close-ear.png','r07-close-shoulder.png'])
paths.extend(Path(x['file']) for x in read('PUBLIC_BUILD.json')['parts'])
assert len(paths)==len(set(paths));(P/'qa/publish-files.json').write_text(json.dumps([f.as_posix() for f in paths]),encoding='utf-8')
tree=[]
for relative in paths:
 data=(P/relative).read_bytes();entry={'path':PREFIX+'/'+relative.as_posix(),'mode':'100644','type':'blob'}
 if digest(data) in cache or len(data)>250000 or relative.suffix in ['.png','.jpg','.gif','.bin']:entry['sha']=blob(relative)
 else:entry['content']=data.decode('utf-8')
 tree.append(entry)
treeid=api('/git/trees',{'base_tree':parent['tree']['sha'],'tree':tree})['sha']
commit=api('/git/commits',{'message':'Fix continuous strand-body contact, dense opacity and persistent distant hair motion','tree':treeid,'parents':[PARENT]})['sha']
(P/'qa/publish-state.json').write_text(json.dumps({'commit':commit,'tree':treeid,'branch':BRANCH,'prefix':PREFIX,'parent':PARENT}),encoding='utf-8')
api('/git/refs',{'ref':'refs/heads/'+BRANCH,'sha':commit})
urls={style:f'https://htmlpreview.github.io/?https://raw.githubusercontent.com/{REPO}/{commit}/{PREFIX}/public-{style}.html' for style in ['medium','long']}
publication={'repository':REPO,'branch':BRANCH,'commit':commit,'parent':PARENT,'prefix':PREFIX,'previewURLs':urls,'sourceURL':f'https://github.com/{REPO}/tree/{commit}/{PREFIX}','mainUpdated':False,'originalCharacterBranchUpdated':False,'r05BranchUpdated':False,'fileCount':len(paths),'htmlHashes':{s:read('PUBLIC_BUILD.json')['wrappers'][s]['sha256'] for s in ['medium','long']},'sourceRenderHashes':{s:manifest['files'][f'preview-{s}.html'] for s in ['medium','long']}}
(P/'PUBLICATION.json').write_text(json.dumps(publication,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(publication),flush=True)
