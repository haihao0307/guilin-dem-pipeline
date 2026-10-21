"""Fixed seven verified source files to one isolated evidence branch; never gh-pages."""
import os,sys,json,hashlib,urllib.request,urllib.error,subprocess,pathlib,tempfile,base64
REPO='haihao0307/guilin-dem-pipeline'
WORKFLOW_BRANCH='refs/heads/trial/guilin-canonical-blob-upload-20261021'
WORKFLOW_PARENT='64744d21d476173c227683f93a992460ee59635c'
BASE='fec5876906494128f07a9a3e0e142eb2e709a810'
DEST='refs/heads/transfer/guilin-canonical-seven-shards-20261021'
RELEASE='guilin-canonical-elevation-store-12p5m-v1'
ITEMS=[{'path': 'guilin-elevation-store-v1/shards/elevation-shard-000.i16pack', 'bytes': 66595840, 'sha256': '0d759d863e91120e281460276e428d2efc0e0ef19654f72bff47021ba79d832c', 'git_blob_sha': '7125d429970c73a9f83ae9a1e4c6333967bc4a2a'}, {'path': 'guilin-elevation-store-v1/shards/elevation-shard-001.i16pack', 'bytes': 66595840, 'sha256': 'b2b935c20b0c212083b1e5698519a23638aa5a66f7f4e9289ab339eb12669ed3', 'git_blob_sha': '495148d83e246f171bf82689a1e494727c4e308d'}, {'path': 'guilin-elevation-store-v1/shards/elevation-shard-002.i16pack', 'bytes': 66807808, 'sha256': '5836bd8f1c7d13417657138f9061469e6d6e04df6d85e626461cb0a260630feb', 'git_blob_sha': 'd3fa4b2de71288cf0056fb753634bb92ba6d6aa9'}, {'path': 'guilin-elevation-store-v1/shards/elevation-shard-003.i16pack', 'bytes': 66595840, 'sha256': 'ec4b5bb529144258c15a8342b60ee9dacc92acd5177b2e6833691f43561486b7', 'git_blob_sha': '11a9b69f6e65e3fd0496c32f9c8ba361a1748baf'}, {'path': 'guilin-elevation-store-v1/shards/elevation-shard-004.i16pack', 'bytes': 66807808, 'sha256': 'ea174388ecd3a3999ebf13daca69901664f83ba43a4e504351005721e5a2b2a8', 'git_blob_sha': 'da3d456b5771b406cb6953d5a2f4bea7b030a75d'}, {'path': 'guilin-elevation-store-v1/shards/elevation-shard-005.i16pack', 'bytes': 66595840, 'sha256': '685f47bedee1d2f9f15a687ed564fb06cd06d621261eecf42698639b346d14ec', 'git_blob_sha': 'd860b7ce631d16c30b543d5fdfc4a5b5cc46070c'}, {'path': 'guilin-elevation-store-v1/shards/elevation-shard-006.i16pack', 'bytes': 23839734, 'sha256': 'c622b3371f2e67973df1e124357eec47da3c8fede10de3678146a456994184bd', 'git_blob_sha': '3bc6c17e3e7e1c1919ad1873468caf6b63d4df20'}]
assert len(sys.argv)==1
assert os.environ.get('GITHUB_REPOSITORY')==REPO
assert os.environ.get('GITHUB_REF')==WORKFLOW_BRANCH
assert os.environ.get('GITHUB_RUN_ATTEMPT')=='1'
assert subprocess.check_output(['git','rev-parse','HEAD^'],text=True).strip()==WORKFLOW_PARENT
assert len(ITEMS)==7 and len({x['path'] for x in ITEMS})==7
url='https://github.com/'+REPO+'.git'
out=pathlib.Path('guilin-blob-transfer-receipt.json').absolute()
receipt={'repository':REPO,'sourceRelease':RELEASE,'status':'running','scope':'seven fixed verified shard files; isolated evidence branch only; no gh-pages/default ref update','uploaded':[],'head':os.environ['GITHUB_SHA'],'base':BASE,'destination':DEST}
def save():out.write_text(json.dumps(receipt,indent=2))
save();stage='initialize'
try:
 with tempfile.TemporaryDirectory(prefix='guilin-seven-fixed-') as temp:
  root=pathlib.Path(temp)
  def git(*args,input=None,env=None):
   result=subprocess.run(['git',*args],cwd=root,input=input,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env)
   if result.returncode:raise RuntimeError('Git operation failed: '+args[0]+'; exit='+str(result.returncode))
   return result.stdout.decode().strip()
  git('init','--quiet')
  assert not git('ls-remote',url,DEST), 'Destination exists; inspect rather than overwrite'
  git('fetch','--quiet','--no-tags','--filter=blob:none','--depth=1',url,BASE)
  assert git('rev-parse','FETCH_HEAD')==BASE
  git('read-tree',BASE)
  for i,item in enumerate(ITEMS):
   name=f'elevation-shard-{i:03d}.i16pack';assert item['path']=='guilin-elevation-store-v1/shards/'+name
   stage='verify-source:'+name;data=bytearray();sha=hashlib.sha256()
   with urllib.request.urlopen(f'https://github.com/{REPO}/releases/download/{RELEASE}/{name}',timeout=180) as response:
    while True:
     block=response.read(1024*1024)
     if not block:break
     data.extend(block);sha.update(block)
     if len(data)>item['bytes']:raise ValueError('Locked source byte size exceeded')
   assert len(data)==item['bytes'] and sha.hexdigest()==item['sha256'], 'Source bytes/SHA256 mismatch'
   gitsha=hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest();assert gitsha==item['git_blob_sha']
   stage='write-fixed-local-blob:'+name
   assert git('hash-object','-w','--stdin',input=bytes(data))==gitsha
   del data
   git('update-index','--add','--cacheinfo','100644,'+gitsha+','+item['path'])
   receipt['uploaded'].append({**item,'localVerifiedBlob':gitsha});save();print('Verified local shard',i+1,'of 7',flush=True)
  tree=git('write-tree');env=os.environ.copy();env.update({'GIT_AUTHOR_NAME':'github-actions[bot]','GIT_AUTHOR_EMAIL':'41898282+github-actions[bot]@users.noreply.github.com','GIT_COMMITTER_NAME':'github-actions[bot]','GIT_COMMITTER_EMAIL':'41898282+github-actions[bot]@users.noreply.github.com'})
  commit=git('commit-tree',tree,'-p',BASE,input=b'Transfer seven hash-verified canonical Guilin shards for staged storage cutover\n',env=env)
  changed=git('diff-tree','--no-commit-id','--name-only','-r',BASE,commit).splitlines();assert sorted(changed)==sorted(x['path'] for x in ITEMS),'Unexpected changed path'
  for x in ITEMS:assert git('rev-parse',commit+':'+x['path'])==x['git_blob_sha']
  assert not git('ls-remote',url,DEST), 'Destination became occupied; stop'
  stage='push-fixed-evidence-ref'
  token=os.environ['GH_TOKEN'];auth=base64.b64encode(('x-access-token:'+token).encode()).decode()
  authenv=env.copy();authenv.update({'GIT_CONFIG_COUNT':'1','GIT_CONFIG_KEY_0':'http.https://github.com/.extraheader','GIT_CONFIG_VALUE_0':'AUTHORIZATION: basic '+auth,'GIT_TERMINAL_PROMPT':'0'})
  git('push','--porcelain',url,commit+':'+DEST,env=authenv)
  remote=git('ls-remote',url,DEST).split();assert remote[0]==commit
  receipt.update({'status':'success','verifiedRemoteCommit':commit,'tree':tree,'changedPaths':changed,'normalPush':True,'force':False});save();print(json.dumps({'status':'success','commit':commit,'tree':tree,'ref':DEST,'fileCount':7}),flush=True)
except Exception as error:
 receipt.update({'status':'failed','stage':stage,'error':{'type':type(error).__name__,'httpStatus':getattr(error,'code',None),'message':str(error)[:300],'note':'No automatic retry. Inspect destination ref if push outcome uncertain. No gh-pages update attempted.'}});save();print(json.dumps(receipt['error']),flush=True);raise SystemExit(1)
