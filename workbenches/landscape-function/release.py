"""Scoped source materialization and Pages publishing. No other namespace writes."""
from pathlib import Path
import base64,gzip,hashlib,json,os,time,urllib.request,urllib.error,sys
ROOT=Path(__file__).parent
REPO='haihao0307/guilin-dem-pipeline'
BRANCH='feature/landscape-mother-field-graph-v002'
PREFIX='landscape-mother-workbench'
EXPECTED='f2a98883f348c1702b7f49cfa6b351c6f7f9917d87c9a29e672ef0c359b360e0'
EXPECTED_BYTES=81635
SITE=Path(os.environ.get('LM_SITE','/tmp/lm-function-site'))
EVIDENCE=Path(os.environ.get('LM_EVIDENCE','/tmp/lm-function-evidence'))
EVIDENCE.mkdir(parents=True,exist_ok=True)
def digest(b):return hashlib.sha256(b).hexdigest()
def api(method,path,data=None):
    req=urllib.request.Request('https://api.github.com/repos/'+REPO+'/'+path,data=None if data is None else json.dumps(data).encode(),method=method,headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json','User-Agent':'Landscape-function-release','X-GitHub-Api-Version':'2022-11-28'})
    with urllib.request.urlopen(req,timeout=60) as r:return json.load(r)
def source_bytes():
    transfer=ROOT/'.transfer'
    if transfer.exists():
        parts=sorted(transfer.glob('*.b64'))
        assert [p.name for p in parts]==[f'{i:02d}.b64' for i in range(22)],'Incomplete source transfer'
        encoded=''.join(''.join(p.read_text().split()) for p in parts)
        raw=gzip.decompress(base64.b64decode(encoded,validate=True))
    else:
        raw=(ROOT/'index.html').read_bytes()
    actual={'bytes':len(raw),'sha256':digest(raw),'expected':EXPECTED}
    print(json.dumps(actual),flush=True)
    (EVIDENCE/'materialized.html').write_bytes(raw)
    assert len(raw)==EXPECTED_BYTES and digest(raw)==EXPECTED,'Materialized source differs from tested candidate'
    return raw

def stage():
    raw=source_bytes();SITE.mkdir(parents=True,exist_ok=True)
    (SITE/'index.html').write_bytes(raw)
    (SITE/'reference.html').write_text('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./"><a href="./">Landscape Mother</a>')
    manifest(os.environ['GITHUB_SHA'])
    print('Staged',len(raw),digest(raw))
def manifest(source):
    d={'version':'limestone-water-2','sourceCommit':source,'files':[{'path':n,'bytes':(SITE/n).stat().st_size,'sha256':digest((SITE/n).read_bytes())} for n in ('index.html','reference.html')],'sourceBasis':'User-authorized procedural Putao study; donor stone functions from HOUSE@53a4b0728678e31ba4ebf2a9267a213597d8f226; nested erosion cavities and static compliant-soil support; geography and kinetics uncalibrated','lod':False,'textures':False,'visualApproved':False,'productionReady':False}
    (SITE/'build.json').write_text(json.dumps(d,ensure_ascii=False,indent=2))
def freeze():
    head=os.environ['GITHUB_SHA'];parts=sorted((ROOT/'.transfer').glob('*'))
    if parts:
        assert api('GET','git/ref/heads/'+BRANCH)['object']['sha']==head,'Concurrent source update'
        tree=api('GET','git/commits/'+head)['tree']['sha']
        entries=[{'path':'workbenches/landscape-function/index.html','mode':'100644','type':'blob','content':(SITE/'index.html').read_text()}]+[{'path':'workbenches/landscape-function/.transfer/'+p.name,'mode':'100644','type':'blob','sha':None} for p in parts]
        newtree=api('POST','git/trees',{'base_tree':tree,'tree':entries})['sha']
        commit=api('POST','git/commits',{'parents':[head],'tree':newtree,'message':'build(landscape): retain checked erosion HTML and remove transfer files [skip ci]'})['sha']
        api('PATCH','git/refs/heads/'+BRANCH,{'sha':commit,'force':False});head=commit
    manifest(head)
    with open(os.environ['GITHUB_ENV'],'a') as f:f.write('LM_SOURCE='+head+'\n')
    print('Verified source commit',head)
def publish():
    source=os.environ['LM_SOURCE']
    assert os.environ['GITHUB_REF']=='refs/heads/'+BRANCH
    assert api('GET','git/ref/heads/'+BRANCH)['object']['sha']==source,'New source head exists'
    for kind in ('desktop','mobile'):
        r=json.loads((EVIDENCE/('stage-'+kind+'.json')).read_text())
        assert r['passed'] and r['sha256']==digest((SITE/'index.html').read_bytes()),'HTTP stage checks required'
    files=sorted(SITE.iterdir());assert {x.name for x in files}=={'index.html','reference.html','build.json'}
    subtree=api('POST','git/trees',{'tree':[{'path':p.name,'mode':'100644','type':'blob','content':p.read_text()} for p in files]})['sha']
    published=None
    for attempt in range(4):
        assert api('GET','git/ref/heads/'+BRANCH)['object']['sha']==source
        head=api('GET','git/ref/heads/gh-pages')['object']['sha'];base=api('GET','git/commits/'+head)['tree']['sha']
        before=api('GET','git/trees/'+base)['tree']
        tree=api('POST','git/trees',{'base_tree':base,'tree':[{'path':PREFIX,'mode':'040000','type':'tree','sha':subtree}]})['sha']
        after=api('GET','git/trees/'+tree)['tree'];keep=lambda rows:{x['path']:x['sha'] for x in rows if x['path']!=PREFIX}
        assert keep(before)==keep(after),'Unrelated public directory changed'
        commit=api('POST','git/commits',{'tree':tree,'parents':[head],'message':'Publish Landscape water-eroded limestone candidate from '+source})['sha']
        try:api('PATCH','git/refs/heads/gh-pages',{'sha':commit,'force':False});published=commit;break
        except urllib.error.HTTPError as e:
            if e.code not in (409,422):raise
            time.sleep(2)
    assert published
    api('POST','pages/builds',{})
    url='https://haihao0307.github.io/guilin-dem-pipeline/'+PREFIX+'/'
    for i in range(100):
        try:
            with urllib.request.urlopen(url+'build.json?verify='+source+'&i='+str(i),timeout=20) as r:active=json.load(r)
            if active.get('sourceCommit')==source:
                for p in ('index.html','reference.html'):
                    with urllib.request.urlopen(url+p+'?verify='+source,timeout=20) as r:b=r.read()
                    assert b==(SITE/p).read_bytes(),p+' published bytes mismatch'
                receipt={'url':url,'sourceCommit':source,'pagesCommit':published,'htmlSHA256':digest((SITE/'index.html').read_bytes()),'bytes':(SITE/'index.html').stat().st_size,'publicBytesVerified':True,'unrelatedPublicPathsUnchanged':True,'visualApproved':False}
                (EVIDENCE/'publish.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt));return
        except (urllib.error.URLError,ValueError):pass
        time.sleep(4)
    raise RuntimeError('Public bytes not verified')
if __name__=='__main__':{'stage':stage,'freeze':freeze,'publish':publish}[sys.argv[1]]()
