"""Publish a reviewed immutable candidate without replacing unrelated Pages files."""
import hashlib,json,os,time,urllib.request,urllib.error
from pathlib import Path
base='https://api.github.com/repos/haihao0307/guilin-dem-pipeline'
token=os.environ['GH_TOKEN'];candidate=Path('_verified');out=Path('evidence');out.mkdir(exist_ok=True)
manifest=json.loads((candidate/'SOURCE.json').read_text())
qa=json.loads((candidate/'BROWSER_QA.json').read_text());tests=json.loads((candidate/'NODE_QA.json').read_text())
assert qa['status']=='PASS' and qa['failed']==0 and not qa['errors']
assert tests['status']=='PASS'
files={}
for name,meta in manifest.items():
    assert '/' not in name and '\\' not in name and name not in {'.','..'}
    raw=(candidate/'runtime'/name).read_bytes()
    assert len(raw)==meta['bytes'] and hashlib.sha256(raw).hexdigest()==meta['sha256'],name
    assert Path(name).suffix.lower() in {'.html','.css','.mjs','.js','.json','.md'}
    files['ocean-mother/coast-glass-r015/'+name]=raw.decode('utf-8')
assert 'coast-r015-daylight-glass' in files['ocean-mother/coast-glass-r015/index.html']
assert json.loads(files['ocean-mother/coast-glass-r015/BUILD.json'])['visualApproved'] is False

def api(path,body=None,method=None):
    req=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,method=method or ('POST' if body is not None else 'GET'),headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json','Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=60) as r:return json.load(r)

def commit_files(branch,contents,message):
    for attempt in range(3):
        head=api('/git/ref/heads/'+branch+'?read='+str(time.time_ns()))['object']['sha']
        tree=api('/git/commits/'+head)['tree']['sha']
        newtree=api('/git/trees',{'base_tree':tree,'tree':[{'path':path,'mode':'100644','type':'blob','content':content} for path,content in contents.items()]})['sha']
        commit=api('/git/commits',{'message':message,'tree':newtree,'parents':[head]})['sha']
        if api('/git/ref/heads/'+branch+'?read='+str(time.time_ns()))['object']['sha']!=head:continue
        try:
            api('/git/refs/heads/'+branch,{'sha':commit,'force':False},'PATCH')
            return commit
        except urllib.error.HTTPError as e:
            if e.code not in [409,422] or attempt==2:raise
    raise RuntimeError('Branch advanced concurrently; no force push attempted')

provenance={'candidateRun':33707658983,'candidateSourceCommit':'f9d0aac1e8fc4beec87c13631545d7fee74edcad','artifactId':int(os.environ['VERIFIED_ARTIFACT_ID']),'checksPassed':qa['passed'],'numericalGeometryChecks':tests['checkCount'],'visualApproved':False,'productionApproved':False,'mobileSafariHardwareTested':False,'files':manifest}
source=dict(files)
source['ocean-mother/knowledge/R015_GLASS_REFERENCE_STUDY.md']=(candidate/'runtime/REFERENCE_STUDY.md').read_text()
source['ocean-mother/qa/r015/SOURCE_MANIFEST.json']=json.dumps(provenance,ensure_ascii=False,indent=2)+'\n'
source['ocean-mother/qa/r015/BROWSER_QA.json']=(candidate/'BROWSER_QA.json').read_text()
source['ocean-mother/qa/r015/NODE_QA.json']=(candidate/'NODE_QA.json').read_text()
source_commit=commit_files('work/ocean-mother-handoff-20260901',source,'feat(ocean): retain tested R015 daylight glass runtime and reference study')
public_commit=commit_files('gh-pages',files,'feat(ocean): publish tested R015 daylight glass coast without altering other sites')
receipt={'status':'GIT_WRITTEN_PUBLIC_HTTP_NOT_YET_VERIFIED','sourceCommit':source_commit,'publicCommit':public_commit,**provenance}
# A bot commit alone may not trigger branch-based Pages builds. Request one explicitly.
try:
    result=api('/pages/builds',{})
    receipt['pagesBuildRequest']={'status':result.get('status'),'url':result.get('url')}
except urllib.error.HTTPError as e:
    receipt['pagesBuildRequest']={'httpStatus':e.code,'message':'Build request unavailable; public bytes must still verify before delivery'}
(out/'PUBLISH.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
(out/'SOURCE.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(receipt,ensure_ascii=False,indent=2))
