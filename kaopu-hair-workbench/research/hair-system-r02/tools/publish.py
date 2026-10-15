"""Publish an additive R02 snapshot on an isolated branch; never alter main/R01."""
from pathlib import Path
import urllib.request,urllib.error,subprocess,json,base64,os,hashlib
P=Path(__file__).resolve().parents[1]
REPO='haihao0307/guilin-dem-pipeline'
PARENT='4d4277df1069f1cf8b148b2c0e184bd041f66e14'
BRANCH='feature/hair-fiber-system-r02-20261015'
PREFIX='kaopu-hair-workbench/research/hair-system-r02'
physics=json.loads((P/'qa/physics-report.json').read_text(encoding='utf-8'))
browser=json.loads((P/'qa/browser-report.json').read_text(encoding='utf-8'))
interaction=json.loads((P/'qa/interaction-report.json').read_text(encoding='utf-8'))
assert physics['passed'] and browser['passed'] and interaction['passed']
manifest=json.loads((P/'BUILD_MANIFEST.json').read_text(encoding='utf-8'))
for name,digest in manifest['files'].items():assert hashlib.sha256((P/name).read_bytes()).hexdigest()==digest,name
for report in [browser,interaction]:assert report['sourceHashes']==manifest['files']
receipt={'version':'HAIR-FIBER-SYSTEM-R02','status':'local visual and interaction candidate; pending public verification and user visual review','styles':['medium','long'],'nominalMetres':[.14,.34],'noPileRuntime':True,'weightedGuideInfluences':4,'primaryClumps':24,'physics':'gravity, oriented curvature and global chain length projection','stepHz':120,'localPhysicsPassed':True,'localBrowserPassed':True,'localPointerInteractionPassed':True,'desktopMouseControlled':False,'firstImpulsePeakSeconds':{r['style']:r['firstPeak']['time'] for r in physics['results']},'limitations':['uncalibrated effective bundle stiffness','guide constraints do not certify every display-fiber length','no hair-hair or human contact','linearised curvature and finite-light/deep-opacity approximations'],'files':manifest['files']}
(P/'DELIVERY.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
credentials=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',text=True,capture_output=True,env=dict(os.environ,GCM_INTERACTIVE='Never'),timeout=25)
if credentials.returncode:raise RuntimeError('GitHub credential unavailable')
credential=dict(line.split('=',1) for line in credentials.stdout.splitlines() if '=' in line)
def api(path,data=None):
 request=urllib.request.Request('https://api.github.com/repos/'+REPO+path,data=json.dumps(data).encode() if data is not None else None,headers={'Authorization':'Bearer '+credential.get('password',''),'Accept':'application/vnd.github+json','User-Agent':'Codex-Hair-R02','Content-Type':'application/json'})
 with urllib.request.urlopen(request,timeout=45) as response:return json.load(response)
try:
 api('/git/ref/heads/'+BRANCH)
 raise RuntimeError('Target branch exists; refusing to overwrite')
except urllib.error.HTTPError as error:
 if error.code!=404:raise
parent=api('/git/commits/'+PARENT)
paths=[Path(name) for name in ['preview.html','preview-medium.html','preview-long.html','index.html','README.md','BUILD_MANIFEST.json','DELIVERY.json']]
for directory in ['src','references','tests','docs','tools']:
 paths.extend(sorted(x.relative_to(P) for x in (P/directory).rglob('*') if x.is_file()))
for name in ['physics-report.json','browser-report.json','interaction-report.json','medium-full.png','medium-macro.png','medium-pointer-grab.png','medium-weights.png','long-full.png','long-macro.png','long-pointer-grab.png','motion-comparison.gif']:
 paths.append(Path('qa')/name)
tree=[]
for relative in paths:
 data=(P/relative).read_bytes();entry={'path':PREFIX+'/'+relative.as_posix(),'mode':'100644','type':'blob'}
 if relative.suffix in ['.png','.gif']:entry['sha']=api('/git/blobs',{'content':base64.b64encode(data).decode(),'encoding':'base64'})['sha']
 else:entry['content']=data.decode('utf-8-sig')
 tree.append(entry)
tree_sha=api('/git/trees',{'base_tree':parent['tree']['sha'],'tree':tree})['sha']
commit=api('/git/commits',{'message':'Add weighted silky medium and long hair specimens with gravity and coupled curvature dynamics','tree':tree_sha,'parents':[PARENT]})['sha']
api('/git/refs',{'ref':'refs/heads/'+BRANCH,'sha':commit})
urls={style:f'https://htmlpreview.github.io/?https://raw.githubusercontent.com/{REPO}/{commit}/{PREFIX}/preview-{style}.html' for style in ['medium','long']}
record={'repository':REPO,'branch':BRANCH,'commit':commit,'parent':PARENT,'prefix':PREFIX,'previewURLs':urls,'sourceURL':f'https://github.com/{REPO}/tree/{commit}/{PREFIX}','mainUpdated':False,'r01Updated':False,'fileCount':len(paths),'htmlHashes':{style:manifest['files'][f'preview-{style}.html'] for style in ['medium','long']}}
(P/'PUBLICATION.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
print(json.dumps(record),flush=True)
