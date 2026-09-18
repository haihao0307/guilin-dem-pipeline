"""Append an immutable candidate page; never replace an existing Mother entry."""
from pathlib import Path
import hashlib,json,os,time,urllib.request,urllib.error,subprocess

p=Path('games/survivor-palau/releases/v0.2.2')
data=(p/'index.html').read_bytes();digest=hashlib.sha256(data).hexdigest()
build=json.loads((p/'BUILD_RECEIPT.json').read_text())
assert digest==build['entrySha256'] and build['frozenShaderAndWorkerStringsUnchanged']
source=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
folder='games/stone-money-island/v0.2.2-'+digest[:8]
API='https://api.github.com/repos/haihao0307/guilin-dem-pipeline/'
headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json'}
def api(path,body=None,method=None):
    req=urllib.request.Request(API+path,headers=headers,data=None if body is None else json.dumps(body).encode(),method=method or ('GET' if body is None else 'POST'))
    with urllib.request.urlopen(req,timeout=30) as r:return json.load(r)
blob=api('git/blobs',{'content':data.decode(),'encoding':'utf-8'})['sha']
source_info=json.dumps({'title':'Stone Money Island','sourceCommit':source,'entrySha256':digest,'frozenSourceUnchanged':True,'reference':'G05','measuredReconstruction':False,'visualAcceptance':False,'publicVerified':False},ensure_ascii=False,indent=2)+'\n'
for attempt in range(4):
    head=api('git/ref/heads/gh-pages')['object']['sha'];base=api('git/commits/'+head)['tree']['sha']
    tree=api('git/trees',{'base_tree':base,'tree':[{'path':folder+'/index.html','mode':'100644','type':'blob','sha':blob},{'path':folder+'/SOURCE.json','mode':'100644','type':'blob','content':source_info}]})['sha']
    commit=api('git/commits',{'message':'publish(stone-money): append shared reef and retreating fish candidate','tree':tree,'parents':[head]})['sha']
    try:api('git/refs/heads/gh-pages',{'sha':commit,'force':False},'PATCH');break
    except urllib.error.HTTPError as e:
        if e.code not in (409,422) or attempt==3:raise
        time.sleep(2)
values={'url':'https://haihao0307.github.io/guilin-dem-pipeline/'+folder+'/index.html','sha256':digest,'source':source,'pages':commit}
(p/'DEPLOYMENT.json').write_text(json.dumps(values,indent=2)+'\n')
with open(os.environ['GITHUB_OUTPUT'],'a') as f:
    for k,v in values.items():f.write(k+'='+v+'\n')
print(json.dumps(values,indent=2))
