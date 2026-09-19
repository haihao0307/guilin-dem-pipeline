"""Publish only a fresh N02 namespace on the existing Pages branch.
No existing files/branches/sites are replaced and no site configuration is changed.
Runtime blobs are copied by exact SHA; historical R02 dependencies remain separate.
"""
from pathlib import Path
import hashlib,json,os,re,time,urllib.request,urllib.error
R=Path(__file__).resolve().parents[1]
BASE='https://api.github.com/repos/haihao0307/guilin-dem-pipeline'
SHA=os.environ['N02_SHA'];TOKEN=os.environ['GH_TOKEN']
assert re.fullmatch('[0-9a-f]{40}',SHA)
PREFIX='ocean-life/n02-'+SHA[:12]
def api(path,body=None,method=None):
    req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,method=method or ('POST' if body is not None else 'GET'),headers={'Authorization':'Bearer '+TOKEN,'Accept':'application/vnd.github+json','Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=45) as r:return json.load(r)
def blobsha(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
num=json.loads((R/'qa/NUMERICAL.json').read_text());browser=json.loads((R/'qa/BROWSER.json').read_text())
assert num['failed']==0 and num['passed']>=11 and browser['browserPassed']
entries=[];manifest={}
for name in ['index.html','src/life-core.js','src/viewer.js']:
    data=(R/name).read_bytes();source=api('/contents/apps/ocean-life-mother/nature-core/n02/'+name+'?ref='+SHA)
    assert blobsha(data)==source['sha'],name
    entries.append({'path':PREFIX+'/nature-core/n02/'+name,'type':'blob','mode':'100644','sha':source['sha']})
    manifest[name]={'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
# Exact legacy trees, not merged simulation; retain their already-public code unchanged.
legacy={}
parent=api('/contents/apps/ocean-life-mother?ref='+SHA)
for name in ['r00','r01','r02']:
    item=next(x for x in parent if x['name']==name)
    assert item['type']=='dir';legacy[name]=item['sha']
    entries.append({'path':PREFIX+'/'+name,'type':'tree','mode':'040000','sha':item['sha']})
for attempt in range(3):
    head=api('/git/ref/heads/gh-pages')['object']['sha']
    try:api('/contents/'+PREFIX+'?ref='+head)
    except urllib.error.HTTPError as e:
        if e.code!=404:raise
    else:raise RuntimeError('Immutable destination already exists; refusing overwrite')
    tree=api('/git/commits/'+head)['tree']['sha']
    newtree=api('/git/trees',{'base_tree':tree,'tree':entries})['sha']
    commit=api('/git/commits',{'message':'publish(ocean-life): add exact tested N02 visual workbench '+SHA[:12],'tree':newtree,'parents':[head]})['sha']
    if api('/git/ref/heads/gh-pages')['object']['sha']!=head:continue
    try:api('/git/refs/heads/gh-pages',{'sha':commit,'force':False},'PATCH');break
    except urllib.error.HTTPError as e:
        if e.code not in (409,422) or attempt==2:raise
else:raise RuntimeError('Concurrent Pages updates; no force push attempted')
url='https://haihao0307.github.io/guilin-dem-pipeline/'+PREFIX+'/nature-core/n02/index.html'
receipt={'status':'PAGES_FILES_WRITTEN_NOT_YET_PUBLIC_VERIFIED','sourceCommit':SHA,'publicCommit':commit,'prefix':PREFIX,'url':url,'runtime':manifest,'separateLegacyTrees':legacy,'unrelatedPathsChanged':False,'shareAllowed':False}
try:receipt['buildRequest']=api('/pages/builds',{})
except urllib.error.HTTPError as e:receipt['buildRequest']={'httpStatus':e.code}
(R/'qa/PAGES_WRITTEN.json').write_text(json.dumps(receipt,indent=2))
# Allow ordinary propagation; 403 is an explicit failure, never circumvented.
for i in range(30):
    try:
        with urllib.request.urlopen(url,timeout=20) as r:
            data=r.read();ok=r.status==200 and hashlib.sha256(data).hexdigest()==manifest['index.html']['sha256']
        if ok:break
    except urllib.error.HTTPError as e:
        if e.code==403:raise
    except (TimeoutError,urllib.error.URLError):pass
    time.sleep(6)
else:raise RuntimeError('Pages did not publish exact entry within propagation window')
print('N02_PAGES_ENTRY '+url)
