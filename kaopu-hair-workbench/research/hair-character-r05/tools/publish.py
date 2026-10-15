"""Add R05 on a new review branch; never modify the character platform branch."""
from pathlib import Path
import urllib.request,urllib.error,subprocess,json,base64,os,hashlib,time
P=Path(__file__).resolve().parents[1]
REPO='haihao0307/guilin-dem-pipeline';PARENT='99e8343b60644bd1dd174a44766bb66597f4d582';BRANCH='perf/hair-character-r05-20261015';PREFIX='kaopu-hair-workbench/research/hair-character-r05'
def read(name):return json.loads((P/name).read_text(encoding='utf-8-sig'))
assert read('qa/performance-correctness.json')['passed']
assert read('qa/optimized-performance.json')['passed']
manifest=read('BUILD_MANIFEST.json')
for name in ['qa/performance-correctness.json','qa/optimized-performance.json']:assert read(name)['sourceHashes']==manifest['files'],name
report=read('qa/character-report.json');assert report['passed'],report.get('failure');assert report['sourceHashes']==manifest['files']
for name,digest in manifest['files'].items():assert hashlib.sha256((P/name).read_bytes()).hexdigest()==digest,name
assert hashlib.sha256((P/'references/character-platform.html').read_bytes()).hexdigest()==read('references/CHARACTER-PUBLICATION.json')['platformSHA256']
record={'version':'HAIR-CHARACTER-R05','status':'performance optimized candidate; local verified; public verification recorded separately; pending user artistic review','characterSource':'ab499da18b1da1e256cd66e35ec1212183c58028','sameNativePerson':True,'styles':['medium','long'],'guides':192,'nodesPerGuide':25,'renderedStrands':64000,'detailModes':128000,'stepHz':120,'whiteBackground':True,'shortPile':False,'newExternalHairAssets':False,'localTests':[t['name'] for t in report['tests']],'mouseControlled':False,'files':manifest['files'],'limits':['linear rod curvature approximation','native radial head and body cross-section collision approximations','rest-coordinate per-fiber detail air phases','no per-fiber self-contact or friction','no deep-opacity hair shadows; hair cast shadows disabled','uncalibrated effective optical and bundle parameters']}
(P/'DELIVERY.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
c=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',text=True,capture_output=True,env=dict(os.environ,GCM_INTERACTIVE='Never'),timeout=25)
if c.returncode:raise RuntimeError('GitHub credential unavailable')
cred=dict(line.split('=',1) for line in c.stdout.splitlines() if '=' in line)
def api(path,data=None,method=None):
 req=urllib.request.Request('https://api.github.com/repos/'+REPO+path,data=json.dumps(data).encode() if data is not None else None,headers={'Authorization':'Bearer '+cred.get('password',''),'Accept':'application/vnd.github+json','User-Agent':'Codex-Hair-Character-R05','Content-Type':'application/json'},method=method)
 with urllib.request.urlopen(req,timeout=120) as r:return json.load(r)
try:
 api('/git/ref/heads/'+BRANCH);raise RuntimeError('Review branch already exists; refusing overwrite')
except urllib.error.HTTPError as e:
 if e.code!=404:raise
parent=api('/git/commits/'+PARENT)
paths=[Path(n) for n in ['public.html','public-medium.html','public-long.html','PUBLIC_BUILD.json','index.html','README.md','BUILD_MANIFEST.json','DELIVERY.json','docs/research.md','docs/performance.md']]
paths.extend(sorted(p.relative_to(P) for p in (P/'src').glob('*.mjs')))
paths.extend(Path(n) for n in ['references/character-platform.html','references/three.module.js','references/CHARACTER-SOURCES.md','references/CHARACTER-PUBLICATION.json','tests/detail-cache.test.mjs'])
paths.extend(Path('tools')/n for n in ['build.cjs','serve.cjs','test-character.cjs','publish.py','publish-verification.py','public-check.cjs','make-wind-gif.py','benchmark.cjs','test-performance.cjs','compare-appearance.py','summarize-performance.py','build-public.py','test-public-loader.cjs'])
paths.extend(Path('qa')/n for n in ['character-report.json','detail-cache-report.json','frame-manifest.json','medium-black-oblique.png','medium-black-top.png','long-black-oblique.png','long-black-back.png','medium-chestnut-oblique.png','long-chestnut-oblique.png','native-idle-4.png','mobile.png','long-character-P02.png','wind-comparison.gif','loader-report.json','baseline-performance.json','optimized-performance.json','performance-correctness.json','performance-summary.json','visual-difference.json'])
paths.extend(Path(part['file']) for part in read('PUBLIC_BUILD.json')['parts'])
(P/'qa/publish-files.json').write_text(json.dumps([x.as_posix() for x in paths]),encoding='utf-8')
if os.environ.get('HAIR_PUBLISH_LIST_ONLY')=='1':raise SystemExit(0)
cachepath=P/'qa/publish-blob-cache.json';cache=read('qa/publish-blob-cache.json') if cachepath.exists() else {};tree=[]
for relative in paths:
 data=(P/relative).read_bytes();print('Uploading',relative.as_posix(),len(data),flush=True);entry={'path':PREFIX+'/'+relative.as_posix(),'mode':'100644','type':'blob'}
 if len(data)>250000 or relative.suffix in ['.png','.gif']:
  digest=hashlib.sha256(data).hexdigest()
  if digest not in cache:
   cache[digest]=api('/git/blobs',{'content':base64.b64encode(data).decode(),'encoding':'base64'})['sha'];cachepath.write_text(json.dumps(cache),encoding='utf-8')
  entry['sha']=cache[digest]
 else:entry['content']=data.decode('utf-8-sig')
 tree.append(entry)
treeid=api('/git/trees',{'base_tree':parent['tree']['sha'],'tree':tree})['sha']
commit=api('/git/commits',{'message':'Optimize full hairstyle rendering, deformation and idle scheduling without reducing strand density','tree':treeid,'parents':[PARENT]})['sha']
api('/git/refs',{'ref':'refs/heads/'+BRANCH,'sha':commit})
urls={s:f'https://htmlpreview.github.io/?https://raw.githubusercontent.com/{REPO}/{commit}/{PREFIX}/public-{s}.html' for s in ['medium','long']}
publication={'repository':REPO,'branch':BRANCH,'commit':commit,'parent':PARENT,'prefix':PREFIX,'previewURLs':urls,'sourceURL':f'https://github.com/{REPO}/tree/{commit}/{PREFIX}','mainUpdated':False,'originalCharacterBranchUpdated':False,'fileCount':len(paths),'htmlHashes':{s:read('PUBLIC_BUILD.json')['wrappers'][s]['sha256'] for s in ['medium','long']},'sourceRenderHashes':{s:manifest['files'][f'preview-{s}.html'] for s in ['medium','long']}}
(P/'PUBLICATION.json').write_text(json.dumps(publication,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(publication),flush=True)
