"""Publish this isolated review candidate with immutable payload URLs."""
from pathlib import Path
import urllib.request,urllib.error,subprocess,json,base64,os,hashlib,sys
P=Path(__file__).resolve().parents[1]
REPO='haihao0307/guilin-dem-pipeline'
PARENT='18b6deaed748c2e9d788c7ff418ace2b93632a18'
BRANCH='codex/hair-f13-fiber-motion-20261016'
PREFIX='kaopu-hair-workbench/foundation/f13'
def read(name):return json.loads((P/name).read_text(encoding='utf-8-sig'))
def digest(b):return hashlib.sha256(b).hexdigest()
statepath=P/'.build/publish-state.json'
state=read('.build/publish-state.json') if statepath.exists() else {}
credential=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',text=True,capture_output=True,env=dict(os.environ,GCM_INTERACTIVE='Never'),timeout=25)
if credential.returncode:raise RuntimeError('GitHub credential unavailable')
cred=dict(line.split('=',1) for line in credential.stdout.splitlines() if '=' in line)
def api(route,data=None,method=None):
 req=urllib.request.Request('https://api.github.com/repos/'+REPO+route,data=json.dumps(data,ensure_ascii=False).encode() if data is not None else None,headers={'Authorization':'Bearer '+cred.get('password',''),'Accept':'application/vnd.github+json','User-Agent':'Codex-F13-Integration','Content-Type':'application/json'},method=method)
 with urllib.request.urlopen(req,timeout=100) as r:return json.load(r)
cachepath=P/'.build/upload-cache.json';cache=read('.build/upload-cache.json') if cachepath.exists() else {}
def blob(relative):
 data=(P/relative).read_bytes();key=digest(data)
 if key not in cache:
  print('Upload',str(relative),len(data),flush=True)
  cache[key]=api('/git/blobs',{'content':base64.b64encode(data).decode(),'encoding':'base64'})['sha'];cachepath.write_text(json.dumps(cache),encoding='utf-8')
 return cache[key]
def make_commit(parent,paths,message):
 old=api('/git/commits/'+parent);tree=[]
 for relative in paths:
  data=(P/relative).read_bytes();entry={'path':PREFIX+'/'+relative.as_posix(),'mode':'100644','type':'blob'}
  if len(data)>200000 or relative.suffix in ['.png','.gif','.jpg','.bin']:entry['sha']=blob(relative)
  else:entry['content']=data.decode('utf-8-sig')
  tree.append(entry)
 tree_sha=api('/git/trees',{'base_tree':old['tree']['sha'],'tree':tree})['sha']
 return api('/git/commits',{'message':message,'tree':tree_sha,'parents':[parent]})['sha']
manifest=read('BUILD_MANIFEST.json');verification=read('evidence/verification.json')
assert verification['passed'] and verification['runtimeSHA256']==manifest['htmlSHA256'],'Current runtime not verified'
assert digest((P/'preview.html').read_bytes())==manifest['htmlSHA256']
for relative,sha in manifest['files'].items():assert digest((P/relative).read_bytes())==sha,'Source changed: '+relative
public=read('PUBLIC_BUILD.json')
for part in public['parts']:assert digest((P/part['path']).read_bytes())==part['sha256']
if '--pin' in sys.argv:
 assert state.get('payloadCommit') and not state.get('publishedCommit')
 ref=api('/git/ref/heads/'+BRANCH)['object']['sha'];assert ref==state['payloadCommit'],'Remote branch changed'
 (P/'PAYLOAD_PIN.json').write_text(json.dumps({'commit':ref,'runtimeSHA256':manifest['htmlSHA256']},indent=2),encoding='utf-8')
 subprocess.run(['C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe',str(P/'tools/build.cjs')],cwd=P,check=True)
 after=read('BUILD_MANIFEST.json');assert after['htmlSHA256']==manifest['htmlSHA256'],'Pin changed runtime'
 commit=make_commit(ref,[Path(x) for x in ['public.html','PUBLIC_BUILD.json','BUILD_MANIFEST.json','PAYLOAD_PIN.json']],'Freeze immutable F13 photo-groom material and motion preview')
 api('/git/refs/heads/'+BRANCH,{'sha':commit,'force':False},'PATCH')
 state['publishedCommit']=commit;statepath.write_text(json.dumps(state,indent=2),encoding='utf-8')
 url='https://htmlpreview.github.io/?https://raw.githubusercontent.com/'+REPO+'/'+commit+'/'+PREFIX+'/public.html'
 publication={'repository':REPO,'branch':BRANCH,'parent':PARENT,'payloadCommit':ref,'commit':commit,'previewURL':url,'runtimeSHA256':manifest['htmlSHA256'],'mainUpdated':False,'originalF12Changed':False,'donorChanged':False}
 (P/'PUBLICATION.json').write_text(json.dumps(publication,indent=2),encoding='utf-8');print(json.dumps(publication),flush=True)
else:
 assert not state.get('payloadCommit'),'Payload already published; use --pin'
 try:api('/git/ref/heads/'+BRANCH);raise RuntimeError('Branch already exists; inspect before writing')
 except urllib.error.HTTPError as e:
  if e.code!=404:raise
 paths=[Path(x) for x in ['.gitignore','README.md','DONOR_SNAPSHOT.json','BUILD_MANIFEST.json','PUBLIC_BUILD.json','public.html','evidence/verification.json']]
 for folder in ['src','vendor','tools','docs']:paths.extend(sorted(f.relative_to(P) for f in (P/folder).rglob('*') if f.is_file()))
 paths.extend(Path(x['path']) for x in public['parts'])
 paths.extend(sorted(f.relative_to(P) for f in (P/'evidence').glob('final-*.png')))
 if (P/'evidence/motion-review.gif').exists():paths.append(Path('evidence/motion-review.gif'))
 assert len(paths)==len(set(paths))
 commit=make_commit(PARENT,paths,'Integrate exact F12 photo groom with copied fiber optics and native walk run jump')
 state={'payloadCommit':commit,'branch':BRANCH,'parent':PARENT,'files':len(paths)};statepath.write_text(json.dumps(state,indent=2),encoding='utf-8')
 api('/git/refs',{'ref':'refs/heads/'+BRANCH,'sha':commit})
 print(json.dumps(state),flush=True)
