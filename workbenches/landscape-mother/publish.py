"""Path-scoped Pages publication. Normal fast-forward only; never change Pages settings."""
import json,os,time,urllib.request,urllib.error
from pathlib import Path
REPO='haihao0307/guilin-dem-pipeline';BRANCH='gh-pages';PREFIX='landscape-mother-workbench/'
TOKEN=os.environ['GH_TOKEN'];SOURCE=os.environ['GITHUB_SHA'];SITE=Path(os.environ['LM_SITE'])
def api(method,path,data=None):
 body=None if data is None else json.dumps(data).encode()
 req=urllib.request.Request('https://api.github.com/repos/'+REPO+'/'+path,data=body,method=method,headers={'Authorization':'Bearer '+TOKEN,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json','User-Agent':'Landscape-Mother-scoped-publisher'})
 with urllib.request.urlopen(req,timeout=90) as r:return json.load(r)
assert os.environ['GITHUB_REF']=='refs/heads/feature/landscape-mother-field-graph-v002'
files=sorted(p for p in SITE.iterdir() if p.is_file())
expected={'index.html','style.css','fields.mjs','checks.mjs','worker.mjs','shaders.mjs','renderer.mjs','app.mjs','manifest.json','build.json'}
assert {p.name for p in files}==expected
build=json.loads((SITE/'build.json').read_text());assert build['sourceCommit']==SOURCE
entries=[{'path':PREFIX+p.name,'mode':'100644','type':'blob','content':p.read_text()} for p in files]
published=None
for attempt in range(4):
 head=api('GET','git/ref/heads/'+BRANCH)['object']['sha'];commit=api('GET','git/commits/'+head)
 before=api('GET','git/trees/'+commit['tree']['sha'])['tree']
 tree=api('POST','git/trees',{'base_tree':commit['tree']['sha'],'tree':entries})['sha']
 after=api('GET','git/trees/'+tree)['tree']
 def preserved(items):return {a['path']:a['sha'] for a in items if a['path']!=PREFIX.rstrip('/')}
 assert preserved(before)==preserved(after),'Unrelated public assets changed'
 new=api('POST','git/commits',{'message':'Publish Landscape Mother Studio 01 from '+SOURCE,'tree':tree,'parents':[head]})['sha']
 try:
  api('PATCH','git/refs/heads/'+BRANCH,{'sha':new,'force':False});published=new;break
 except urllib.error.HTTPError as e:
  if e.code not in (409,422):raise
  time.sleep(2)
assert published,'Concurrent publication prevented fast-forward'
print('Path-scoped publication commit',published)
# A GITHUB_TOKEN push alone may not trigger the branch Pages build.
reply=api('POST','pages/builds',{})
print('Pages build requested',reply.get('status'))
url='https://haihao0307.github.io/guilin-dem-pipeline/'+PREFIX
for attempt in range(120):
 try:
  req=urllib.request.Request(url+'build.json?verify='+SOURCE+'-'+str(attempt),headers={'Cache-Control':'no-cache'})
  with urllib.request.urlopen(req,timeout=20) as r:active=json.load(r)
  if active.get('sourceCommit')==SOURCE:
   for f in build['files']:
    import hashlib
    with urllib.request.urlopen(url+f['path']+'?verify='+SOURCE,timeout=20) as r:raw=r.read()
    assert len(raw)==f['bytes'] and hashlib.sha256(raw).hexdigest()==f['sha256'],f['path']
   print('Exact public build and all source hashes verified',url);break
 except (urllib.error.URLError,ValueError):pass
 time.sleep(4)
else:raise RuntimeError('Exact public build did not become available; no public success claim')
