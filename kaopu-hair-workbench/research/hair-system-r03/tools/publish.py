"""Publish the verified R03 as an additive snapshot on a new branch."""
from pathlib import Path
import urllib.request,urllib.error,subprocess,json,base64,os,hashlib
P=Path(__file__).resolve().parents[1]
REPO='haihao0307/guilin-dem-pipeline'
PARENT='2a27085ef1224a57216b57697d426a8af6271644'
BRANCH='feature/hair-fiber-system-r03-20261015'
PREFIX='kaopu-hair-workbench/research/hair-system-r03'
def read(name):return json.loads((P/name).read_text(encoding='utf-8-sig'))
manifest=read('BUILD_MANIFEST.json')
reports={name:read('qa/'+name+'-report.json') for name in ['physics','wind-physics','browser','interaction','standalone','optics','wind']}
assert all(r['passed'] for r in reports.values())
for name in ['browser','interaction','standalone','optics','wind']:assert reports[name]['sourceHashes']==manifest['files'],name
for name,digest in manifest['files'].items():assert hashlib.sha256((P/name).read_bytes()).hexdigest()==digest,name
record={'version':'HAIR-FIBER-SYSTEM-R03','status':'local rendered candidate; pending public verification and user visual review','styles':['medium','long'],'nominalMetres':[.14,.34],'noPileRuntime':True,'whiteBackdrop':True,'guideInfluences':4,'guides':85,'renderedStrands':10000,'transverseModesPerStrand':2,'stepHz':120,'localReportsPassed':list(reports),'opticalViewCombinations':len(reports['optics']['results']),'desktopMouseControlled':False,'limitations':['uncalibrated effective material and air parameters','reduced display-strand modes do not enforce every segment length','no strand contact/friction or head/shoulder contact','procedural air field and finite-sample light/shadow approximations'],'files':manifest['files']}
(P/'DELIVERY.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
credentials=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',text=True,capture_output=True,env=dict(os.environ,GCM_INTERACTIVE='Never'),timeout=25)
if credentials.returncode:raise RuntimeError('GitHub credential unavailable')
credential=dict(line.split('=',1) for line in credentials.stdout.splitlines() if '=' in line)
def api(path,data=None,method=None):
 request=urllib.request.Request('https://api.github.com/repos/'+REPO+path,data=json.dumps(data).encode() if data is not None else None,headers={'Authorization':'Bearer '+credential.get('password',''),'Accept':'application/vnd.github+json','User-Agent':'Codex-Hair-R03','Content-Type':'application/json'},method=method)
 with urllib.request.urlopen(request,timeout=100) as response:return json.load(response)
try:
 api('/git/ref/heads/'+BRANCH)
 raise RuntimeError('Target branch exists; refusing to overwrite')
except urllib.error.HTTPError as error:
 if error.code!=404:raise
parent=api('/git/commits/'+PARENT)
paths=[Path(name) for name in ['preview.html','preview-medium.html','preview-long.html','index.html','README.md','BUILD_MANIFEST.json','DELIVERY.json','docs/research.md']]
for directory in ['src','references','tests']:paths.extend(sorted(x.relative_to(P) for x in (P/directory).rglob('*') if x.is_file()))
for name in ['build.cjs','serve.cjs','capture.cjs','wind-capture.cjs','wind_gif.py','publish.py']:paths.append(Path('tools')/name)
for name in ['physics-report.json','wind-physics-report.json','browser-report.json','interaction-report.json','standalone-report.json','optics-report.json','wind-report.json','frame-manifest.json','medium-full.png','medium-black.png','medium-macro.png','medium-pointer-grab.png','long-full.png','long-black.png','long-wind-tip.png','long-pointer-grab.png','wind-comparison.gif','wind-tip-comparison.gif']:
 paths.append(Path('qa')/name)
cache_path=P/'qa/publish-blob-cache.json';cache=read('qa/publish-blob-cache.json') if cache_path.exists() else {}
tree=[]
for relative in paths:
 data=(P/relative).read_bytes();print('Uploading',relative.as_posix(),len(data),flush=True);entry={'path':PREFIX+'/'+relative.as_posix(),'mode':'100644','type':'blob'}
 if relative.suffix in ['.png','.gif'] or len(data)>250000:
  digest=hashlib.sha256(data).hexdigest()
  if digest not in cache:
   cache[digest]=api('/git/blobs',{'content':base64.b64encode(data).decode(),'encoding':'base64'})['sha'];cache_path.write_text(json.dumps(cache),encoding='utf-8')
  entry['sha']=cache[digest]
 else:entry['content']=data.decode('utf-8-sig')
 tree.append(entry)
tree_sha=api('/git/trees',{'base_tree':parent['tree']['sha'],'tree':tree})['sha']
commit=api('/git/commits',{'message':'Add white-background hair specimens with soft dielectric sheen and independent wind response','tree':tree_sha,'parents':[PARENT]})['sha']
api('/git/refs',{'ref':'refs/heads/'+BRANCH,'sha':commit})
urls={style:f'https://htmlpreview.github.io/?https://raw.githubusercontent.com/{REPO}/{commit}/{PREFIX}/preview-{style}.html' for style in ['medium','long']}
publication={'repository':REPO,'branch':BRANCH,'commit':commit,'parent':PARENT,'prefix':PREFIX,'previewURLs':urls,'sourceURL':f'https://github.com/{REPO}/tree/{commit}/{PREFIX}','mainUpdated':False,'r02Updated':False,'fileCount':len(paths),'htmlHashes':{style:manifest['files'][f'preview-{style}.html'] for style in ['medium','long']}}
(P/'PUBLICATION.json').write_text(json.dumps(publication,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(publication),flush=True)

