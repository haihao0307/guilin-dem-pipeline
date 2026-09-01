"""Reconstruct checked text changes into a new Coast directory; no deployment writes."""
import os,json,time,hashlib,urllib.request,pathlib,subprocess,concurrent.futures
REPO='haihao0307/guilin-dem-pipeline';BRANCH='work/ocean-mother-handoff-20260901'
BASE_REF='e7f1d6a2c5e02383452b87d8d9d6e8a106f974dd';HEAD=os.environ['GITHUB_SHA']
assert os.environ['GITHUB_REPOSITORY']==REPO and os.environ['GITHUB_REF']=='refs/heads/'+BRANCH
sha=lambda b:hashlib.sha256(b).hexdigest()
blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def get(ref,path):
    with urllib.request.urlopen('https://raw.githubusercontent.com/'+REPO+'/'+ref+'/'+path,timeout=60) as r:
        assert r.status==200;return r.read()
def api(path,body=None,method=None):
    req=urllib.request.Request('https://api.github.com/repos/'+REPO+path,data=None if body is None else json.dumps(body).encode(),method=method or ('GET' if body is None else 'POST'),headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json','Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=60) as r:return json.load(r)
root=pathlib.Path('stage');evidence=pathlib.Path('evidence');evidence.mkdir(exist_ok=True)
patches={}
for name in ['app','operators','tests']:
    p=json.loads(get(HEAD,'ocean-mother/coast-build-v011/'+name+'.patch.json'));assert not set(p)&set(patches);patches.update(p)
assert len(patches)==6
files={}
for name,p in patches.items():
    assert name.startswith(('ocean-mother/coast-v011/','ocean-mother/coast-tools-v011/')) and '..' not in name
    b=get(BASE_REF,p['base']);assert sha(b)==p['baseSha256'],('base identity',name)
    s=b.decode();end=0
    for i,j,addition in p['edits']:
        assert 0<=end<=i<=j<=len(s);end=j
    for i,j,addition in reversed(p['edits']):s=s[:i]+addition+s[j:]
    target=root/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(s)
    assert sha(s.encode())==p['sha256'],('patch identity',name,sha(s.encode()))
    if name.endswith('/coast-app.mjs'):
        s=s.replace('ids.push(base,base+1,base+2,base+2,base+1,base+3);','ids.push(base,base+2,base+1,base+2,base+3,base+1);').replace('for(const q of [center,[B[0],-8,B[1]],[A[0],-8,A[1]]])','for(const q of [center,[A[0],-8,A[1]],[B[0],-8,B[1]]])').replace('ids.push(i,i+1,i+2,i+2,i+1,i+3);','ids.push(i,i+2,i+1,i+2,i+3,i+1);')
        assert sha(s.encode())=='36abb8b172fb7ecd5e2d5a13f5551902894537fee71c4dc090f20287bfbb0053'
    if name.endswith('/index.html'):
        s=s.replace('侧界封闭反射试验','侧界零梯度外推试验');assert sha(s.encode())=='51e73241f968ee790922b26566557479df41e742425f70a203dd5fc52a31720f'
    files[name]=s.encode();target.write_bytes(files[name])
existing={
'ocean-mother/coast-v011/rock-domain.mjs':'449fbdcbdab1ee58bc04030da638ae83300828068ba625e8edd78772f98c8b18',
'ocean-mother/coast-v011/coast.css':'f20405b6d0e7d15ffa3d65deaf8a676291d50e2affc396d3af3f3921dcd143b3',
'ocean-mother/coast-v011/policy.json':'fe69ea88c05d9b8c74e79e21c2c2c719dc096b677848eb40305575f08b5b8fdf',
'ocean-mother/coast-v011/BUILD_TEMPLATE.json':'d1de3e8090f72bf55e6361b49a3a7e7640fc909a26652e73f8f2fa53b8f060fe',
'ocean-mother/coast-v011/README.md':'1a7767ac2e0611a9aa3c8b7252480677d713d95c4937648a490a2cd2d2a62ed8',
'ocean-mother/coast-tools-v011/mesh.test.mjs':'ae1e3bf4fa24d87a8d2883b16e08230faff5183e24fd5195666e5ebca7592088'}
for name,h in existing.items():
    b=get(HEAD,name);assert sha(b)==h,('direct source',name,sha(b));files[name]=b;p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
for name in files:
    if name.endswith('.mjs'):subprocess.run(['node','--check',str(root/name)],check=True)
test=subprocess.run(['node','--test','stage/ocean-mother/coast-tools-v011/core.test.mjs','stage/ocean-mother/coast-tools-v011/mesh.test.mjs'],capture_output=True,text=True)
(evidence/'CORE_TESTS.tap').write_text(test.stdout+test.stderr);assert test.returncode==0 and '# pass 28' in test.stdout and '# fail 0' in test.stdout
# Refuse to replace any generated source path; this phase only materializes new files.
for directory in ['coast-v011','coast-tools-v011']:
    listing=api('/contents/ocean-mother/'+directory+'?ref='+HEAD)
    assert not any(x['path'] in patches for x in listing),'Generated sources already exist; use a normal source edit instead'
assert api('/git/ref/heads/'+BRANCH)['object']['sha']==HEAD,'Concurrent edit; stop before writes'
tree=[]
for name in patches:
    bid=api('/git/blobs',{'content':files[name].decode(),'encoding':'utf-8'})['sha'];assert bid==blob(files[name]);tree.append({'path':name,'mode':'100644','type':'blob','sha':bid})
baseTree=api('/git/commits/'+HEAD)['tree']['sha'];newTree=api('/git/trees',{'base_tree':baseTree,'tree':tree})['sha']
source=api('/git/commits',{'message':'feat(ocean): integrate expanded Coast, accounted side boundaries and solid-rock rendering','tree':newTree,'parents':[HEAD]})['sha']
diff=api('/compare/'+HEAD+'...'+source)['files'];assert len(diff)==6 and all(x['status']=='added' and x['filename'] in patches for x in diff)
assert api('/git/ref/heads/'+BRANCH)['object']['sha']==HEAD
result=api('/git/refs/heads/'+BRANCH,{'sha':source,'force':False},'PATCH');assert result['object']['sha']==source
for name,b in files.items():assert get(source,name)==b,('source readback',name)
identities={n:{'bytes':len(b),'sha256':sha(b),'gitBlobSha':blob(b)} for n,b in files.items()}
(evidence/'SOURCE.json').write_text(json.dumps({'sourceCommit':source,'workflowCommit':HEAD,'baseRef':BASE_REF,'files':identities,'runtimeImages':0,'visualApproved':False,'productionApproved':False},indent=2))
build=json.loads(files['ocean-mother/coast-v011/BUILD_TEMPLATE.json']);build.update(sourceCommit=source,workflowRunId=int(os.environ['GITHUB_RUN_ID']))
(root/'ocean-mother/coast-v011/build.json').write_text(json.dumps(build,indent=2)+'\n');(evidence/'build.json').write_text(json.dumps(build,indent=2)+'\n')
ref='970aa25814e5d5f98cf10091da69666f62dbcd28';b=get(ref,'ocean-mother/v001/MANIFEST.json');dm=json.loads(b)
p=root/'ocean-mother/v001';p.mkdir(parents=True,exist_ok=True);(p/'MANIFEST.json').write_bytes(b)
def dependency(item):
    n,e=item;b=get(ref,'ocean-mother/v001/'+n);assert len(b)==e['bytes'] and sha(b)==e['sha256'];f=p/n;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(b)
list(concurrent.futures.ThreadPoolExecutor(max_workers=5).map(dependency,dm['files'].items()));assert len(dm['files'])==21
(evidence/'DEEP_LOCK.json').write_text(json.dumps({'ref':ref,'filesVerified':21,'runtimeModified':False},indent=2))
print('SOURCE',source,flush=True)
with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as f:f.write('Coast V011 source '+source+'; 28 numeric/geometry tests passed; browser pending.\n')
