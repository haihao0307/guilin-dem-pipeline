import os, json, base64, hashlib, zipfile, urllib.request, urllib.error, io, pathlib, subprocess, sys, zlib
REPO='haihao0307/guilin-dem-pipeline'
BRANCH='work/ocean-mother-handoff-20260901'
NAME='Ocean_Mother_Full_Clean_V0.1.0_2026-09-01'
EXPECTED='4719ed2f4cba56fa7795eae052cc6d809cc620e970f72620d095b23b5308306b'
ARCHIVE_BLOB='95e8a95062ce645a8c71181b40c58f1081dd1281'
SEED_TREE='c9c29682d283bf016869a84d0beefb77cfb5691a'
ARTIFACT=9789388372
ARTIFACT_HASH='7a598e64b9c1e50f25e52e337ff0e3220db35b08f1d84d5972f0934ce94808da'
SOURCE_PATH='ocean-mother/clean-full-v010'
ZIP_PATH='ocean-mother/distributions/'+NAME+'.zip'
sha=lambda b:hashlib.sha256(b).hexdigest()
blobsha=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
encoded=lambda x:(json.dumps(x,ensure_ascii=False,indent=2)+'\n').encode()

def restore(artifact, seeds):
    assert sha(artifact)==ARTIFACT_HASH
    files={}
    with zipfile.ZipFile(io.BytesIO(artifact)) as z:
        assert z.testzip() is None
        receipt=json.loads(z.read('SOURCE_EXPORT_RECEIPT.json'))
        identities={k:v for k,v in receipt['files'].items() if k not in {'knowledge/AGENTS.md','knowledge/WORKING_STATE.md'}}
        assert len(identities)==36
        for name, entry in identities.items():
            b=z.read(name)
            assert len(b)==entry['bytes'] and sha(b)==entry['sha256'] and blobsha(b)==entry['gitBlobSha'],name
            files[name]=b
    assert len(seeds)==8 and not set(files)&set(seeds)
    files.update(seeds)
    source={'format':'ocean-mother-clean-full-source-lock','version':1,'publishedRef':receipt['publishedRef'],'knowledgeRef':receipt['knowledgeRef'],'exportCommit':'f771ea21f28b97f0c2c09f2c3e2348a34a49c4c5','exportRun':'33479542474','sourceArtifactId':ARTIFACT,'sourceArtifactSha256':ARTIFACT_HASH,'sourceFilesKept':36,'sourceFilesModified':0,'files':identities}
    files['SOURCE_LOCK.json']=encoded(source)
    manifest={k:{'bytes':len(v),'sha256':sha(v)} for k,v in sorted(files.items(),key=lambda item:pathlib.PurePosixPath(item[0]).parts)}
    files['MANIFEST.json']=encoded({'format':'ocean-mother-clean-full-manifest','version':1,'packageVersion':'1.0.0-clean-full','runtimeVersion':'0.1.0','files':manifest,'listedFileCount':len(manifest),'uncompressedBytesExcludingManifest':sum(v['bytes'] for v in manifest.values()),'selfExcluded':'MANIFEST.json; archive checksum is supplied separately','compression':'lossless ZIP DEFLATE; no runtime changes'})
    assert len(files)==46
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for n,b in sorted(files.items(),key=lambda item:pathlib.PurePosixPath(item[0]).parts):
            assert '..' not in pathlib.PurePosixPath(n).parts and not n.startswith('/') and '\\' not in n
            info=zipfile.ZipInfo(NAME+'/'+n,(2026,9,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
            z.writestr(info,b,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    archive=output.getvalue()
    assert len(archive)==132186 and sha(archive)==EXPECTED and blobsha(archive)==ARCHIVE_BLOB,('ZIP identity mismatch',len(archive),sha(archive),zlib.ZLIB_RUNTIME_VERSION)
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        assert z.testzip() is None
        assert all(z.read(NAME+'/'+n)==b for n,b in files.items())
    return files, archive

def main():
    assert os.environ['GITHUB_REPOSITORY']==REPO and os.environ['GITHUB_REF']=='refs/heads/'+BRANCH
    head=os.environ['GITHUB_SHA'];token=os.environ['GH_TOKEN'];base='https://api.github.com/repos/'+REPO
    def api(path, body=None, method=None):
        r=urllib.request.Request(base+path,data=None if body is None else json.dumps(body).encode(),method=method or ('GET' if body is None else 'POST'),headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json'})
        with urllib.request.urlopen(r,timeout=60) as response:return json.load(response)
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,req,fp,code,msg,headers,newurl):return None
    request=urllib.request.Request(base+f'/actions/artifacts/{ARTIFACT}/zip',headers={'Authorization':'Bearer '+token})
    try:
        response=urllib.request.build_opener(NoRedirect).open(request,timeout=60)
        artifact=response.read()
    except urllib.error.HTTPError as e:
        if e.code not in (301,302,303,307,308):raise
        with urllib.request.urlopen(e.headers['Location'],timeout=60) as response:artifact=response.read()
    seed_metadata=api('/git/trees/'+SEED_TREE+'?recursive=1');assert not seed_metadata.get('truncated')
    seeds={}
    for e in seed_metadata['tree']:
        if e['type']!='blob':continue
        assert e['mode']=='100644'
        r=api('/git/blobs/'+e['sha']);b=base64.b64decode(r['content']);assert blobsha(b)==e['sha']
        seeds[e['path']]=b
    files,archive=restore(artifact,seeds)
    root=pathlib.Path('_archive_stage')/NAME
    for n,b in files.items():
        p=root/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
    result=subprocess.run([sys.executable,'-B',str(root/'tools/verify.py')],capture_output=True,text=True,check=True)
    validation=json.loads(result.stdout);assert validation['status']=='PACKAGE_INTEGRITY_PASS'
    for p in (root/'workbench').rglob('*.js'):subprocess.run(['node','--check',str(p)],check=True)
    tests=subprocess.run(['node','--test',str(root/'knowledge/bridge-v1/tests/bridge.test.cjs'),str(root/'knowledge/bridge-v1/tests/source-api.test.cjs')],env={**os.environ,'WEATHER_ENGINE_PATH':str((root/'workbench/weather/engine.js').resolve())},capture_output=True,text=True,check=True)
    assert '# pass 48' in tests.stdout and '# fail 0' in tests.stdout
    evidence=pathlib.Path('upload-evidence');evidence.mkdir(exist_ok=True)
    (evidence/'PACKAGE_VERIFY.json').write_text(result.stdout)
    (evidence/'BRIDGE_TESTS.txt').write_text(tests.stdout+tests.stderr)
    # All Git writes below are bounded to this exact working branch and new paths.
    assert api('/git/ref/heads/'+BRANCH)['object']['sha']==head,'Concurrent branch update; stop without overwriting it'
    existing=api('/contents/ocean-mother?ref='+head)
    assert not any(e['name']=='clean-full-v010' for e in existing),'An archive source snapshot already exists; inspect it first'
    try:
        api('/contents/'+ZIP_PATH+'?ref='+head)
    except urllib.error.HTTPError as e:
        if e.code!=404:raise
    else:raise RuntimeError('Archive path already exists; refusing replacement')
    ids={k:blobsha(v) for k,v in files.items()}
    for n in ('SOURCE_LOCK.json','MANIFEST.json'):
        r=api('/git/blobs',{'content':files[n].decode('utf-8'),'encoding':'utf-8'});assert r['sha']==ids[n]
    tree=api('/git/trees',{'tree':[{'path':n,'mode':'100644','type':'blob','sha':ids[n]} for n in sorted(files)]})['sha']
    archive_id=api('/git/blobs',{'content':base64.b64encode(archive).decode(),'encoding':'base64'})['sha']
    assert archive_id==ARCHIVE_BLOB
    remote_archive=base64.b64decode(api('/git/blobs/'+archive_id)['content'])
    assert remote_archive==archive and sha(remote_archive)==EXPECTED
    receipt={'format':'ocean-clean-full-github-publication','version':1,'archive':NAME+'.zip','archivePath':ZIP_PATH,'archiveBytes':len(archive),'archiveSha256':EXPECTED,'archiveGitBlobSha':archive_id,'matchesDeliveredZIPByteForByte':True,'remoteBlobReadbackVerified':True,'archiveCRC':'PASS','fileCount':46,'uncompressedBytes':sum(map(len,files.values())),'sourceDirectory':SOURCE_PATH,'sourceTreeSha':tree,'sourceFilesByteIdentical':36,'packageValidation':validation,'bridgeTestsThisRun':{'passed':48,'failed':0,'scope':'independent bridge, not browser or marine solver'},'workflowCommit':head,'workflowRunId':int(os.environ['GITHUB_RUN_ID']),'branch':BRANCH,'runtimeVersion':'0.1.0','packageVersion':'1.0.0-clean-full','images':0,'screenshots':0,'models':0,'runtimeChanged':False,'samplingReduced':False,'newBrowserQA':False,'deploymentChanged':False,'visualApproved':False,'productionApproved':False}
    checksum_path=ZIP_PATH[:-4]+'.sha256';receipt_path=ZIP_PATH[:-4]+'.receipt.json'
    checksum=(EXPECTED+'  '+NAME+'.zip\n').encode()
    entries=[{'path':SOURCE_PATH,'mode':'040000','type':'tree','sha':tree},{'path':ZIP_PATH,'mode':'100644','type':'blob','sha':archive_id}]
    for name,b in ((checksum_path,checksum),(receipt_path,encoded(receipt))):
        bid=api('/git/blobs',{'content':b.decode(),'encoding':'utf-8'})['sha']
        entries.append({'path':name,'mode':'100644','type':'blob','sha':bid})
    base_tree=api('/git/commits/'+head)['tree']['sha']
    new_tree=api('/git/trees',{'base_tree':base_tree,'tree':entries})['sha']
    commit=api('/git/commits',{'message':'archive(ocean): store byte-identical clean full V0.1.0 package and complete source snapshot','tree':new_tree,'parents':[head]})['sha']
    diff=api('/compare/'+head+'...'+commit)
    changed=diff['files'];assert len(changed)==49
    assert all(f['status']=='added' and (f['filename'].startswith(SOURCE_PATH+'/') or f['filename'] in (ZIP_PATH,checksum_path,receipt_path)) for f in changed)
    assert api('/git/ref/heads/'+BRANCH)['object']['sha']==head,'Concurrent update detected before final ref update'
    api('/git/refs/heads/'+BRANCH,{'sha':commit,'force':False},'PATCH')
    assert api('/git/ref/heads/'+BRANCH)['object']['sha']==commit
    file_response=api('/contents/'+ZIP_PATH+'?ref='+commit)
    assert file_response['sha']==archive_id and file_response['size']==len(archive)
    if file_response.get('encoding')=='base64':assert base64.b64decode(file_response['content'])==archive
    final={'status':'PUSHED_AND_READBACK_VERIFIED','commit':commit,'branch':BRANCH,'archiveSha256':EXPECTED,'archiveBytes':len(archive),'archiveGitBlobSha':archive_id,'sourceTreeSha':tree,'filesAdded':49,'archivePath':ZIP_PATH,'receiptPath':receipt_path,'sourceDirectory':SOURCE_PATH,'sourceManifestEntries':45,'sourceFiles':46,'runtimeFilesUnchanged':True,'otherProductionLinesChanged':False,'mainChanged':False,'ghPagesChanged':False,'visualApproved':False,'productionApproved':False}
    (evidence/'UPLOAD_RESULT.json').write_bytes(encoded(final))
    print(json.dumps(final,indent=2))
    with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as s:s.write('# Ocean Mother clean full archive\n\n'+json.dumps(final,indent=2)+'\n')
if __name__=='__main__':main()
