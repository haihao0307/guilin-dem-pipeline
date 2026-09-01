"""Publish only a tested Coast candidate; keep other Pages paths byte-identical."""
import os,json,time,hashlib,base64,urllib.request,urllib.error,zipfile,io,pathlib,concurrent.futures
REPO='haihao0307/guilin-dem-pipeline'
SOURCE='aeeafa124d79f9cb3df2345b0563929ef9f1b47f'
RUN=33487313834
BRANCH='work/ocean-mother-handoff-20260901'
DEST='ocean-mother/coast-v010'
BASE='https://api.github.com/repos/'+REPO
TOKEN=os.environ['GH_TOKEN']
assert os.environ['GITHUB_REPOSITORY']==REPO and os.environ['GITHUB_REF']=='refs/heads/'+BRANCH
sha=lambda b:hashlib.sha256(b).hexdigest()
encode=lambda d:(json.dumps(d,ensure_ascii=False,indent=2)+'\n').encode()
def api(path,body=None,method=None):
    req=urllib.request.Request(BASE+path,data=None if body is None else json.dumps(body).encode(),method=method or ('GET' if body is None else 'POST'),headers={'Authorization':'Bearer '+TOKEN,'Accept':'application/vnd.github+json','Content-Type':'application/json','Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=60) as r:return json.load(r)
def raw(ref,path):
    with urllib.request.urlopen('https://raw.githubusercontent.com/'+REPO+'/'+ref+'/'+path,timeout=60) as r:
        assert r.status==200;return r.read()
def download_artifact(aid):
    class NR(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs):return None
    req=urllib.request.Request(BASE+f'/actions/artifacts/{aid}/zip',headers={'Authorization':'Bearer '+TOKEN})
    try:
        with urllib.request.build_opener(NR).open(req,timeout=60) as r:return r.read()
    except urllib.error.HTTPError as e:
        if e.code not in (301,302,303,307,308):raise
        with urllib.request.urlopen(e.headers['Location'],timeout=60) as r:return r.read()
run=api(f'/actions/runs/{RUN}');assert run['conclusion']=='success' and run['head_sha']==SOURCE
artifact=next(x for x in api(f'/actions/runs/{RUN}/artifacts')['artifacts'] if x['name']=='ocean-coast-candidate-evidence')
b=download_artifact(artifact['id']);assert 'sha256:'+sha(b)==artifact['digest']
with zipfile.ZipFile(io.BytesIO(b)) as z:
    assert z.testzip() is None
    qa=json.loads(z.read('QA.json'));identities=json.loads(z.read('SOURCE.json'));build=z.read('build.json');core=z.read('CORE_TESTS.tap')
assert qa['status']=='BROWSER_QA_PASS' and all(x['passed'] for x in qa['checks']) and not qa['errors']
assert identities['sourceCommit']==SOURCE and json.loads(build)['sourceCommit']==SOURCE
assert b'# pass 14' in core and b'# fail 0' in core
names=['coast-core.mjs','coast-app.mjs','shaders.mjs','index.html','coast.css','policy.json','README.md']
files={}
for n in names:
    p=DEST+'/'+n;b=raw(SOURCE,p);e=identities['files'][p]
    assert len(b)==e['bytes'] and sha(b)==e['sha256'];files[n]=b
assert sha(files['policy.json'])=='fe69ea88c05d9b8c74e79e21c2c2c719dc096b677848eb40305575f08b5b8fdf'
files['build.json']=build
manifest={'format':'ocean-coast-runtime-manifest','version':'0.1.0-coast','sourceCommit':SOURCE,'candidateRun':RUN,'files':{n:{'bytes':len(b),'sha256':sha(b)} for n,b in files.items()},'visualApproved':False,'productionApproved':False,'sharedStrictSchemaIntegrated':False}
files['MANIFEST.json']=encode(manifest)
stage=pathlib.Path('stage')/DEST;stage.mkdir(parents=True,exist_ok=True)
for n,b in files.items():(stage/n).write_bytes(b)
out=pathlib.Path('evidence');out.mkdir(exist_ok=True)
(out/'CANDIDATE_QA.json').write_bytes(encode(qa));(out/'CORE_TESTS.tap').write_bytes(core)
# Public dependencies must still match the protected reference before new publication.
deepref='970aa25814e5d5f98cf10091da69666f62dbcd28'
dm=json.loads(raw(deepref,'ocean-mother/v001/MANIFEST.json'))
def verify_deep(item):
    n,e=item;url='https://haihao0307.github.io/guilin-dem-pipeline/ocean-mother/v001/'+n+'?coastcheck='+e['sha256'][:16]
    with urllib.request.urlopen(url,timeout=45) as r:b=r.read();assert r.status==200
    assert len(b)==e['bytes'] and sha(b)==e['sha256'],n
list(concurrent.futures.ThreadPoolExecutor(max_workers=5).map(verify_deep,dm['files'].items()))
blobs={}
for n,b in files.items():
    bid=api('/git/blobs',{'encoding':'utf-8','content':b.decode()})['sha'];assert bid==hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest();blobs[n]=bid
subtree=api('/git/trees',{'tree':[{'path':n,'mode':'100644','type':'blob','sha':bid} for n,bid in blobs.items()]})['sha']
for attempt in range(4):
    parent=api('/git/ref/heads/gh-pages?nonce='+str(time.time_ns()))['object']['sha']
    listing=api('/contents/ocean-mother?ref='+parent)
    assert not any(x['name']=='coast-v010' for x in listing),'Existing published Coast must be reviewed before replacement'
    protected={x['name']:x['sha'] for x in listing}
    tree=api('/git/trees',{'base_tree':api('/git/commits/'+parent)['tree']['sha'],'tree':[{'path':DEST,'mode':'040000','type':'tree','sha':subtree}]})['sha']
    commit=api('/git/commits',{'message':'deploy(ocean): publish browser-checked Coast preview without changing existing deep sea','tree':tree,'parents':[parent]})['sha']
    diff=api('/compare/'+parent+'...'+commit)['files']
    assert len(diff)==9 and all(f['status']=='added' and f['filename'].startswith(DEST+'/') for f in diff)
    after=api('/contents/ocean-mother?ref='+commit)
    assert all(next(x['sha'] for x in after if x['name']==n)==s for n,s in protected.items())
    if api('/git/ref/heads/gh-pages?nonce='+str(time.time_ns()))['object']['sha']!=parent:continue
    try:
        result=api('/git/refs/heads/gh-pages',{'sha':commit,'force':False},'PATCH')
        assert result['object']['sha']==commit
        break
    except urllib.error.HTTPError as e:
        if e.code not in (409,422):raise
else:raise RuntimeError('Concurrent publication: no overwrite attempted')
for attempt in range(12):
    read=api('/contents/'+DEST+'/MANIFEST.json?ref='+commit)
    if read['sha']==blobs['MANIFEST.json']:break
    time.sleep(2)
else:raise RuntimeError('Immutable publication readback failed')
receipt={'status':'PUBLISHED_PENDING_PUBLIC_BROWSER','version':'0.1.0-coast','sourceCommit':SOURCE,'deploymentCommit':commit,'deploymentParent':parent,'candidateRunId':RUN,'candidateArtifactId':artifact['id'],'candidateChecks':len(qa['checks']),'coreTests':14,'filesAdded':9,'protectedOceanEntriesUnchanged':protected,'deepPublicDependencyFilesChecked':21,'runtimeImages':0,'visualApproved':False,'productionApproved':False,'url':'https://haihao0307.github.io/guilin-dem-pipeline/'+DEST+'/'}
(out/'PUBLICATION.json').write_bytes(encode(receipt))
# Verify all newly published bytes rather than assuming Pages has propagated.
url=receipt['url'];checked={}
for attempt in range(36):
    try:
        for n,b in files.items():
            with urllib.request.urlopen(url+n+'?verify='+sha(b)[:16],timeout=30) as r:got=r.read();assert r.status==200
            assert got==b,n;checked[n]={'bytes':len(got),'sha256':sha(got)}
        break
    except Exception as e:
        print('Pages propagation',attempt,type(e).__name__,str(e),flush=True)
        if attempt==35:raise
        time.sleep(10)
(out/'PUBLIC_BYTES.json').write_bytes(encode({'url':url,'sourceCommit':SOURCE,'deploymentCommit':commit,'files':checked,'allByteIdentical':True}))
pathlib.Path('public_qa.py').write_bytes(raw(SOURCE,'ocean-mother/coast-tools/browser_qa.py'))
print(json.dumps(receipt,indent=2))
with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as f:f.write(json.dumps(receipt,indent=2)+'\n')
