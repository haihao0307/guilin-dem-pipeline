"""Publish only this workbench subtree after staged checks. No user source asset upload."""
import json,os,time,urllib.request,urllib.error,hashlib
from pathlib import Path
repo='haihao0307/guilin-dem-pipeline';prefix='landscape-mother-workbench';source=os.environ['GITHUB_SHA'];token=os.environ['GH_TOKEN'];site=Path(os.environ['LM_SITE'])
assert os.environ['GITHUB_REF']=='refs/heads/feature/landscape-mother-field-graph-v002'
def api(method,path,data=None):
 req=urllib.request.Request('https://api.github.com/repos/'+repo+'/'+path,data=None if data is None else json.dumps(data).encode(),method=method,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json','User-Agent':'Landscape-Mother-source-fit','X-GitHub-Api-Version':'2022-11-28'})
 with urllib.request.urlopen(req,timeout=90) as r:return json.load(r)
expected={'index.html','reference.html','fit.css','source.mjs','field.mjs','audit.mjs','color-evidence.mjs','fit-view.mjs','fit-worker.mjs','fit-app.mjs','manifest.json','build.json'}
files=sorted(p for p in site.iterdir() if p.is_file());assert {f.name for f in files}==expected
build=json.loads((site/'build.json').read_text());assert build['sourceCommit']==source
assert api('GET','git/ref/heads/feature/landscape-mother-field-graph-v002')['object']['sha']==source,'A newer source head exists'
subtree=api('POST','git/trees',{'tree':[{'path':p.name,'mode':'100644','type':'blob','content':p.read_text()} for p in files]})['sha'];published=None
for attempt in range(4):
 head=api('GET','git/ref/heads/gh-pages')['object']['sha'];base=api('GET','git/commits/'+head)['tree']['sha'];before=api('GET','git/trees/'+base)['tree']
 tree=api('POST','git/trees',{'base_tree':base,'tree':[{'path':prefix,'mode':'040000','type':'tree','sha':subtree}]})['sha'];after=api('GET','git/trees/'+tree)['tree'];keep=lambda rows:{x['path']:x['sha'] for x in rows if x['path']!=prefix}
 assert keep(before)==keep(after),'Unrelated public directories changed'
 commit=api('POST','git/commits',{'tree':tree,'parents':[head],'message':'Publish source-driven Landscape Mother B1 from '+source})['sha']
 try:api('PATCH','git/refs/heads/gh-pages',{'sha':commit,'force':False});published=commit;break
 except urllib.error.HTTPError as e:
  if e.code not in (409,422):raise
  time.sleep(2)
assert published
api('POST','pages/builds',{});url='https://haihao0307.github.io/guilin-dem-pipeline/'+prefix+'/'
for attempt in range(120):
 try:
  with urllib.request.urlopen(url+'build.json?verify='+source+'-'+str(attempt),timeout=20) as response:active=json.load(response)
  if active.get('sourceCommit')==source:
   for f in build['files']:
    with urllib.request.urlopen(url+f['path']+'?verify='+source,timeout=20) as response:raw=response.read()
    assert len(raw)==f['bytes'] and hashlib.sha256(raw).hexdigest()==f['sha256'],f['path']
   print('Exact published source verified',source,published,url);break
 except (urllib.error.URLError,ValueError):pass
 time.sleep(4)
else:raise RuntimeError('Exact public version not verified')
