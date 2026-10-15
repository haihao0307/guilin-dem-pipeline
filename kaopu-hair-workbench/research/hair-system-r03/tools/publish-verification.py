from pathlib import Path
import json,urllib.request,subprocess,os,base64,hashlib
P=Path(__file__).resolve().parents[1]
def read(name):return json.loads((P/name).read_text(encoding='utf-8-sig'))
pub=read('PUBLICATION.json');entry=read('qa/public-entrypoints.json');raw=read('qa/public-hash.json');assert entry['passed'] and raw['passed'];assert entry['sourceHashes']==read('BUILD_MANIFEST.json')['files']
delivery=read('DELIVERY.json');delivery['status']='Published; raw HTML hashes and both actual browser entrypoints verified; pending user visual review';delivery['publicVerified']=True;delivery['publicApplicationErrors']=entry['errors'];delivery['previewURLs']=pub['previewURLs'];(P/'DELIVERY.json').write_text(json.dumps(delivery,indent=2),encoding='utf-8')
verification={'testedCommit':pub['commit'],'previewURLs':pub['previewURLs'],'rawHashVerified':True,'bothDefaultStylesVerified':True,'whiteBackdropVerified':True,'blackHairAndPureWindVerified':True,'desktopMouseControlled':False,'applicationErrors':entry['errors'],'hostErrors':entry['hostErrors'],'sourceHashes':entry['sourceHashes']}
(P/'PUBLIC_VERIFICATION.json').write_text(json.dumps(verification,indent=2),encoding='utf-8')
s=(P/'README.md').read_text(encoding='utf-8-sig');s+='\n## 公开预览\n\n'+''.join(f'- [{"男士中长发" if style=="medium" else "长发"}]({url})\n' for style,url in pub['previewURLs'].items());(P/'README.md').write_text(s,encoding='utf-8')
credentials=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',text=True,capture_output=True,env=dict(os.environ,GCM_INTERACTIVE='Never'),timeout=25)
if credentials.returncode:raise RuntimeError('GitHub credential unavailable')
credential=dict(line.split('=',1) for line in credentials.stdout.splitlines() if '=' in line)
def api(path,data=None,method=None):
 req=urllib.request.Request('https://api.github.com/repos/'+pub['repository']+path,data=json.dumps(data).encode() if data is not None else None,headers={'Authorization':'Bearer '+credential.get('password',''),'Accept':'application/vnd.github+json','Content-Type':'application/json','User-Agent':'Codex-Hair-R03-Verification'},method=method)
 with urllib.request.urlopen(req,timeout=60) as response:return json.load(response)
assert api('/git/ref/heads/'+pub['branch'])['object']['sha']==pub['commit'],'Branch moved; refusing to overwrite'
base=api('/git/commits/'+pub['commit']);paths=['PUBLICATION.json','PUBLIC_VERIFICATION.json','DELIVERY.json','README.md','qa/public-entrypoints.json','qa/public-hash.json','qa/public-medium-black.png','qa/public-long-black-wind-tip.png','tools/verify-public.py','tools/publish-verification.py'];tree=[]
for name in paths:
 data=(P/name).read_bytes();item={'path':pub['prefix']+'/'+name,'mode':'100644','type':'blob'}
 if name.endswith('.png'):item['sha']=api('/git/blobs',{'content':base64.b64encode(data).decode(),'encoding':'base64'})['sha']
 else:item['content']=data.decode('utf-8-sig')
 tree.append(item)
newtree=api('/git/trees',{'base_tree':base['tree']['sha'],'tree':tree})['sha'];commit=api('/git/commits',{'message':'Record live white-background hair preview verification and actual captures','tree':newtree,'parents':[pub['commit']]})['sha'];api('/git/refs/heads/'+pub['branch'],{'sha':commit,'force':False},'PATCH')
pub['verificationCommit']=commit;pub['sourceURL']=f'https://github.com/{pub["repository"]}/tree/{commit}/{pub["prefix"]}';(P/'PUBLICATION.json').write_text(json.dumps(pub,indent=2),encoding='utf-8');print('Public verification committed:',commit)
