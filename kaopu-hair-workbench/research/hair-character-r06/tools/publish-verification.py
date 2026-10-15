"""Append observed public QA to the isolated review branch without changing render bytes."""
from pathlib import Path
import urllib.request,subprocess,json,base64,os
P=Path(__file__).resolve().parents[1]
def read(n):return json.loads((P/n).read_text(encoding='utf-8-sig'))
pub=read('PUBLICATION.json');report=read('PUBLIC_VERIFICATION.json');assert report['passed'];assert report['commit']==pub['commit']
c=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',text=True,capture_output=True,env=dict(os.environ,GCM_INTERACTIVE='Never'),timeout=25)
if c.returncode:raise RuntimeError('Credential unavailable')
cred=dict(x.split('=',1) for x in c.stdout.splitlines() if '=' in x)
def api(path,data=None,method=None):
 r=urllib.request.Request('https://api.github.com/repos/'+pub['repository']+path,data=json.dumps(data).encode() if data is not None else None,headers={'Authorization':'Bearer '+cred.get('password',''),'Accept':'application/vnd.github+json','User-Agent':'Codex-Hair-R06-QA','Content-Type':'application/json'},method=method)
 with urllib.request.urlopen(r,timeout=120) as response:return json.load(response)
current=api('/git/ref/heads/'+pub['branch'])['object']['sha'];assert current==pub['commit'],'Branch changed; refusing update'
parent=api('/git/commits/'+current);tree=[]
for f in ['PUBLICATION.json','PUBLIC_VERIFICATION.json','tools/public-check.cjs','qa/public-medium.png','qa/public-medium-canvas.png','qa/public-long.png','qa/public-long-canvas.png','qa/public-wind.png','qa/public-crowd.png','qa/public-near.png','qa/public-motion.png','qa/public-fluffy.png','qa/public-distance-overview.jpg']:
 data=(P/f).read_bytes();e={'path':pub['prefix']+'/'+f,'mode':'100644','type':'blob'}
 if f.endswith(('.png','.jpg')):e['sha']=api('/git/blobs',{'content':base64.b64encode(data).decode(),'encoding':'base64'})['sha']
 else:e['content']=data.decode('utf-8-sig')
 tree.append(e);print('Verification',f,flush=True)
t=api('/git/trees',{'base_tree':parent['tree']['sha'],'tree':tree})['sha'];commit=api('/git/commits',{'message':'Record actual public-browser verification of two native character hairstyles','tree':t,'parents':[current]})['sha'];api('/git/refs/heads/'+pub['branch'],{'sha':commit,'force':False},'PATCH');(P/'VERIFICATION_PUBLICATION.json').write_text(json.dumps({'renderCommit':pub['commit'],'verificationCommit':commit,'branch':pub['branch'],'publicVerified':True,'previewURLs':pub['previewURLs'],'mainUpdated':False},ensure_ascii=False,indent=2),encoding='utf-8');print('Verification commit',commit,flush=True)
