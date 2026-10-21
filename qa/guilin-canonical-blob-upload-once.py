"""One fixed seven-blob transfer. Does not create/update refs, trees or commits."""
import os,sys,json,hashlib,base64,urllib.request,urllib.error,subprocess,pathlib,time
REPO='haihao0307/guilin-dem-pipeline'
BRANCH='refs/heads/trial/guilin-canonical-blob-upload-20261021'
PARENT='fec5876906494128f07a9a3e0e142eb2e709a810'
RELEASE='guilin-canonical-elevation-store-12p5m-v1'
ITEMS=[{'path': 'guilin-elevation-store-v1/shards/elevation-shard-000.i16pack', 'bytes': 66595840, 'sha256': '0d759d863e91120e281460276e428d2efc0e0ef19654f72bff47021ba79d832c', 'git_blob_sha': '7125d429970c73a9f83ae9a1e4c6333967bc4a2a'}, {'path': 'guilin-elevation-store-v1/shards/elevation-shard-001.i16pack', 'bytes': 66595840, 'sha256': 'b2b935c20b0c212083b1e5698519a23638aa5a66f7f4e9289ab339eb12669ed3', 'git_blob_sha': '495148d83e246f171bf82689a1e494727c4e308d'}, {'path': 'guilin-elevation-store-v1/shards/elevation-shard-002.i16pack', 'bytes': 66807808, 'sha256': '5836bd8f1c7d13417657138f9061469e6d6e04df6d85e626461cb0a260630feb', 'git_blob_sha': 'd3fa4b2de71288cf0056fb753634bb92ba6d6aa9'}, {'path': 'guilin-elevation-store-v1/shards/elevation-shard-003.i16pack', 'bytes': 66595840, 'sha256': 'ec4b5bb529144258c15a8342b60ee9dacc92acd5177b2e6833691f43561486b7', 'git_blob_sha': '11a9b69f6e65e3fd0496c32f9c8ba361a1748baf'}, {'path': 'guilin-elevation-store-v1/shards/elevation-shard-004.i16pack', 'bytes': 66807808, 'sha256': 'ea174388ecd3a3999ebf13daca69901664f83ba43a4e504351005721e5a2b2a8', 'git_blob_sha': 'da3d456b5771b406cb6953d5a2f4bea7b030a75d'}, {'path': 'guilin-elevation-store-v1/shards/elevation-shard-005.i16pack', 'bytes': 66595840, 'sha256': '685f47bedee1d2f9f15a687ed564fb06cd06d621261eecf42698639b346d14ec', 'git_blob_sha': 'd860b7ce631d16c30b543d5fdfc4a5b5cc46070c'}, {'path': 'guilin-elevation-store-v1/shards/elevation-shard-006.i16pack', 'bytes': 23839734, 'sha256': 'c622b3371f2e67973df1e124357eec47da3c8fede10de3678146a456994184bd', 'git_blob_sha': '3bc6c17e3e7e1c1919ad1873468caf6b63d4df20'}]
assert len(sys.argv)==1, 'No arbitrary inputs accepted'
assert os.environ.get('GITHUB_REPOSITORY')==REPO
assert os.environ.get('GITHUB_REF')==BRANCH
assert os.environ.get('GITHUB_RUN_ATTEMPT')=='1', 'Single attempt; review partial receipt before any recovery'
assert subprocess.check_output(['git','rev-parse','HEAD^'],text=True).strip()==PARENT, 'Only the first child of the locked verified QA head may execute'
assert len(ITEMS)==7 and len({x['path'] for x in ITEMS})==7
receipt={'repository':REPO,'sourceRelease':RELEASE,'status':'running','scope':'seven verified Git blobs only; no ref/tree/commit mutation','uploaded':[],'head':os.environ['GITHUB_SHA']}
out=pathlib.Path('guilin-blob-transfer-receipt.json')
def save():out.write_text(json.dumps(receipt,indent=2))
save()
try:
 for i,item in enumerate(ITEMS):
  name=f'elevation-shard-{i:03d}.i16pack'
  assert item['path']=='guilin-elevation-store-v1/shards/'+name
  url=f'https://github.com/{REPO}/releases/download/{RELEASE}/{name}'
  sha=hashlib.sha256(); data=bytearray()
  with urllib.request.urlopen(url,timeout=180) as response:
   while True:
    block=response.read(1024*1024)
    if not block:break
    data.extend(block);sha.update(block)
    if len(data)>item['bytes']:raise ValueError('Source larger than locked byte size')
  assert len(data)==item['bytes'] and sha.hexdigest()==item['sha256'], 'Source bytes/SHA256 mismatch'
  gitsha=hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()
  assert gitsha==item['git_blob_sha'], 'Git object mismatch'
  # The only authenticated endpoint is this same repository's Git blob API.
  body=json.dumps({'encoding':'base64','content':base64.b64encode(data).decode('ascii')}).encode()
  del data
  request=urllib.request.Request(f'https://api.github.com/repos/{REPO}/git/blobs',data=body,method='POST',headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'})
  with urllib.request.urlopen(request,timeout=180) as response:result=json.load(response)
  assert result['sha']==gitsha, 'Uploaded blob mismatch'
  receipt['uploaded'].append({**item,'verifiedReturnedSha':result['sha']});save()
  print(json.dumps({'completed':i+1,'of':7,'name':name,'bytes':item['bytes'],'sha':gitsha}),flush=True)
  del body,request
 receipt['status']='success';save()
except Exception as error:
 receipt['status']='failed';receipt['error']={'type':type(error).__name__,'httpStatus':getattr(error,'code',None),'note':'Stopped without retry. Inspect exact fixed blob status before recovery; no refs were changed.'};save()
 print(json.dumps(receipt['error']),flush=True);raise SystemExit(1)
