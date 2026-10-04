"""Archive the requested Coral line; never modifies gh-pages or runs its applications."""
from pathlib import Path, PurePosixPath
from urllib.request import Request, urlopen, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError
import base64, gzip, hashlib, io, json, os, re, shutil, subprocess, tarfile, time, zipfile

SOURCE='71204339af530ff3da9d8f717bf0434e799b55b2'
REPO='haihao0307/guilin-dem-pipeline'
TAG='coral-mother-handoff-20261004'
ROOT=Path('/tmp/coral-handoff')
OUT=ROOT/'CORAL_MOTHER_REPOSITORY_HANDOFF_20261004'
RESULT=Path('/tmp/coral-release')
OUT.mkdir(parents=True,exist_ok=True);RESULT.mkdir(parents=True,exist_ok=True)
HERE=Path(__file__).resolve().parent
REPORT={'source_commit':SOURCE,'repository':REPO,'kind':'frozen repository source handoff, not a newly approved model','git_entries':[],'source_branches':[],'artifacts':[],'omitted':[],'warnings':[],'public_deployment_changed':False,'chat_only_originals_uploaded':False}

def git(*args):return subprocess.check_output(['git',*args],stderr=subprocess.PIPE)
def sha(data):return hashlib.sha256(data).hexdigest()
def put(path,data):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
def tree(ref):
 rows=[]
 for row in git('ls-tree','-r','-l','-z',ref).split(b'\0'):
  if not row:continue
  meta,name=row.split(b'\t',1);mode,kind,blob,size=meta.decode().split()
  rows.append({'path':name.decode(),'mode':mode,'type':kind,'blob':blob,'bytes':int(size) if size!='-' else 0})
 return rows

def export(ref,paths,dest,label):
 if not paths:return
 proc=subprocess.Popen(['git','archive','--format=tar',ref,'--',*paths],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 with tarfile.open(fileobj=proc.stdout,mode='r|') as arc:
  for m in arc:
   if not m.isfile():continue
   name=PurePosixPath(m.name)
   if name.is_absolute() or '..' in name.parts:raise RuntimeError('Unsafe archive member')
   if name.suffix.lower() in ['.ttf','.otf','.ttc','.woff','.woff2','.eot']:
    REPORT['omitted'].append({'source':label,'path':m.name,'reason':'font file not redistributed'});continue
   if name.name in ['.env','.env.local','credentials.json'] or name.suffix.lower() in ['.pem','.key']:
    REPORT['omitted'].append({'source':label,'path':m.name,'reason':'credential-like file not redistributed'});continue
   f=arc.extractfile(m)
   target=dest/m.name;target.parent.mkdir(parents=True,exist_ok=True)
   with target.open('wb') as w:shutil.copyfileobj(f,w)
 err=proc.stderr.read().decode(errors='replace');rc=proc.wait()
 if rc:raise RuntimeError('git archive failed: '+err[-2000:])

allrows=tree(SOURCE)
roots=sorted({r['path'].split('/')[0] for r in allrows if 'coral' in r['path'].split('/')[0].lower()})
if any(r['path'].startswith('kaopu-tree-fractal-wave-lab/') for r in allrows):roots.append('kaopu-tree-fractal-wave-lab')
paths=list(roots)
paths += [r['path'] for r in allrows if (r['path'].startswith('tools/') or r['path'].startswith('.github/workflows/')) and 'coral' in r['path'].lower()]
# Only the already-used rock lighting source, not the unrelated material production line.
paths += [r['path'] for r in allrows if r['path'] in ['kaopu-material-workbench/lab-r14/iq-raster.js']]
paths=sorted(set(paths))
REPORT['selected_roots']=roots
REPORT['git_entries']=[r for r in allrows if any(r['path']==p or r['path'].startswith(p+'/') for p in paths)]
print('ARCHIVE_SCOPE',len(REPORT['git_entries']),sum(r['bytes'] for r in REPORT['git_entries']),roots,flush=True)
export(SOURCE,paths,OUT/'snapshot/site',SOURCE)

# Decode the already-written cumulative log, enforcing its original digest.
pieces=[(HERE/'knowledge'/('master-%02d.b64'%i)).read_text().strip() for i in range(3)]
# Remove two accidental duplicate ranges in the final transport piece only.
t=pieces[2]
if 'VVC30vUK55czb' in t:
 a=t.index('VVC30vUK55czb');b=t.index('VVC30vUK18Y',a);t=t[:a]+t[b:]
if 'SPwsTq3' in t:
 a=t.index('SPwsTq3');b=t.index('SPwsq6',a);t=t[:a]+t[b:]
pieces[2]=t
log=gzip.decompress(base64.b64decode(''.join(pieces),validate=True))
assert len(log)==37088 and sha(log)=='b466be4fe17c23463cd8d085ea44c927ed8b11e36770d4a9d4fb2734f91a6f84','Cumulative log transport failed exact checksum'
put(OUT/'knowledge/CORAL_MASTER_PROGRESS.md',log)
# Preserve only packaging metadata as readable files; raw transport fragments are not the log.
for name in ['README.md','HANDOFF_STATE.json']:
 put(OUT/name,(HERE/name).read_bytes())

branches=['work/coral-inspection-r03-20261004','work/coral-young-color-r02-20261004','work/coral-young-source-r01-20261003','work/coral-studio-fullview-r05-20261003','work/coral-studio-reference-r04-20261003','work/coral-original-recovery-20261003','work/coral-original-artifact-trace-20261003','work/coral-branch-public-r01-20261004']
for i,branch in enumerate(branches):
 try:
  ref='refs/remotes/handoff-sources/%d'%i
  git('fetch','--depth=1','--filter=blob:none','origin',branch+':'+ref)
  commit=git('rev-parse',ref).decode().strip();rows=tree(ref)
  selected=[r['path'] for r in rows if (r['path'].startswith('tools/') or r['path'].startswith('.github/workflows/')) and 'coral' in r['path'].lower()]
  export(ref,selected,OUT/'source-history'/branch.replace('/','__'),commit)
  REPORT['source_branches'].append({'branch':branch,'commit':commit,'files':len(selected)})
 except Exception as e:REPORT['warnings'].append({'source_branch':branch,'error':str(e)[:700]})

TOKEN=os.environ['GH_TOKEN']
def api(path,data=None,method=None):
 req=Request('https://api.github.com/repos/'+REPO+'/'+path,data=None if data is None else json.dumps(data).encode(),method=method,headers={'Authorization':'Bearer '+TOKEN,'Accept':'application/vnd.github+json','Content-Type':'application/json','User-Agent':'Coral-Handoff'})
 with urlopen(req,timeout=60) as r:return json.load(r)
class NoRedirect(HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
no=build_opener(NoRedirect)
artifact_ids=[11297450167,11297133142,11293023607,11291411647,11270766954,11270727523,11264416454,11263902824,11261525062,11263651664,11262983731,11263389521,11260720262]
for aid in artifact_ids:
 try:
  meta=api('actions/artifacts/'+str(aid))
  if meta['expired']:raise RuntimeError('Artifact expired')
  req=Request('https://api.github.com/repos/'+REPO+'/actions/artifacts/'+str(aid)+'/zip',headers={'Authorization':'Bearer '+TOKEN,'User-Agent':'Coral-Handoff'})
  try:resp=no.open(req,timeout=60)
  except HTTPError as e:
   if e.code not in [301,302,303,307,308]:raise
   loc=e.headers['Location'];assert loc.startswith('https://');resp=urlopen(Request(loc,headers={'User-Agent':'Coral-Handoff'}),timeout=90)
  with resp:data=resp.read()
  dig=sha(data);expected=meta.get('digest')
  if expected:assert expected=='sha256:'+dig,('Artifact integrity',aid)
  z=zipfile.ZipFile(io.BytesIO(data));assert z.testzip() is None
  put(OUT/'evidence'/('%s-%s.zip'%(aid,meta['name'])),data)
  if aid==11297133142:
   for info in z.infolist():
    name=PurePosixPath(info.filename)
    if name.is_absolute() or '..' in name.parts:raise RuntimeError('Unsafe source artifact')
    if info.filename.startswith('external-reference-source/') or name.name in ['SOURCE_TRACE.json','README.md']:
     if not info.is_dir():put(OUT/'source-lineage'/info.filename,z.read(info))
  REPORT['artifacts'].append({'id':aid,'name':meta['name'],'bytes':len(data),'sha256':dig,'status':'included'})
 except Exception as e:
  REPORT['artifacts'].append({'id':aid,'status':'unavailable','reason':str(e)[:600]})

# Inventory every included source without claiming absent private uploads were present.
media=[]
for p in (OUT/'snapshot').rglob('*'):
 if p.is_file() and p.suffix.lower() in ['.mp4','.webm','.mov','.glb','.gltf','.zip']:
  media.append({'path':str(p.relative_to(OUT)),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())})
REPORT['repository_media']=media
REPORT['standalone_chat_originals']={'status':'separate conversation/Library archive; not fetched by this repository-only job','recordings':['capture.webm','capture (13).webm','capture (19).webm','video_分叉生长——自然界的神奇现象 _..._top_0_1.mp4'],'historical_packages':'See the companion full originals ZIP and Library /GAME/CORAL.'}
REPORT['master_log_sha256']=sha(log)
put(OUT/'PACKAGING_REPORT.json',json.dumps(REPORT,ensure_ascii=False,indent=2).encode())
put(OUT/'snapshot/SOURCE_COMMIT.txt',(SOURCE+'\n').encode())

VERIFY='''from pathlib import Path\nimport hashlib,json,sys\np=Path(__file__).resolve().parent\nm=json.loads((p/'FILE_MANIFEST.json').read_text())\nbad=[]\nfor f in m['files']:\n q=p/f['path']\n if not q.is_file() or q.stat().st_size!=f['bytes'] or hashlib.sha256(q.read_bytes()).hexdigest()!=f['sha256']:bad.append(f['path'])\nprint('files',len(m['files']),'bad',bad)\nsys.exit(bool(bad))\n'''
put(OUT/'VERIFY_PACKAGE.py',VERIFY.encode())
files=[]
for p in sorted(OUT.rglob('*')):
 if p.is_file():files.append({'path':p.relative_to(OUT).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())})
put(OUT/'FILE_MANIFEST.json',json.dumps({'source_commit':SOURCE,'file_count':len(files),'files':files},ensure_ascii=False,indent=2).encode())
subprocess.run(['python',str(OUT/'VERIFY_PACKAGE.py')],check=True)
archive=RESULT/'CORAL_MOTHER_REPOSITORY_HANDOFF_20261004.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
 for p in sorted(OUT.rglob('*')):
  if p.is_file():z.write(p,OUT.name+'/'+p.relative_to(OUT).as_posix())
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
archive_hash=sha(archive.read_bytes())
put(RESULT/'SHA256SUMS.txt',(archive_hash+'  '+archive.name+'\n').encode())
put(RESULT/'PACKAGING_REPORT.json',(OUT/'PACKAGING_REPORT.json').read_bytes())
put(RESULT/'FILE_MANIFEST.json',(OUT/'FILE_MANIFEST.json').read_bytes())
put(RESULT/'CORAL_MASTER_PROGRESS.md',log)

# GitHub release only: no Pages, no force-push, no application code writes.
body='珊瑚生产线封存交接。源 SHA '+SOURCE+'。保留现有珊瑚目录、树母台依赖、历史源码、累计知识与可获取的验证产物。此包是仓库源码快照，不把仅存在于聊天/Library的原录屏与旧HTML宣称为已上传。Blue Coral R41、旧彩色R02和短片作者完整工程仍为未恢复事项。现有 gh-pages 不改动。'
try:release=api('releases/tags/'+TAG)
except HTTPError as e:
 if e.code!=404:raise
 release=api('releases',{'tag_name':TAG,'target_commitish':os.environ['GITHUB_SHA'],'name':'Coral Mother — 全线源码交接 2026-10-04','body':body,'draft':True,'prerelease':False,'make_latest':'false'},'POST')
for p in [archive,RESULT/'SHA256SUMS.txt',RESULT/'PACKAGING_REPORT.json',RESULT/'FILE_MANIFEST.json']:
 old=next((a for a in release.get('assets',[]) if a['name']==p.name),None)
 if old:
  if old.get('digest')=='sha256:'+sha(p.read_bytes()):continue
  raise RuntimeError('Existing release asset differs; no overwrite: '+p.name)
 upload=release['upload_url'].split('{')[0]+'?name='+p.name
 req=Request(upload,data=p.read_bytes(),method='POST',headers={'Authorization':'Bearer '+TOKEN,'Accept':'application/vnd.github+json','Content-Type':'application/zip' if p.suffix=='.zip' else 'application/octet-stream','User-Agent':'Coral-Handoff'})
 with urlopen(req,timeout=240) as r:asset=json.load(r)
 assert asset['size']==p.stat().st_size,('Uploaded asset size',p.name)
 if asset.get('digest'):assert asset['digest']=='sha256:'+sha(p.read_bytes()),('Uploaded digest',p.name)
release=api('releases/'+str(release['id']),{'draft':False,'make_latest':'false'},'PATCH')
assets=api('releases/'+str(release['id'])+'/assets')
receipt={'release_url':release['html_url'],'tag':TAG,'source_commit':SOURCE,'handoff_commit':os.environ['GITHUB_SHA'],'file_count':len(files)+1,'archive_bytes':archive.stat().st_size,'archive_sha256':archive_hash,'assets':[{'name':a['name'],'size':a['size'],'digest':a.get('digest'),'browser_download_url':a['browser_download_url']} for a in assets],'gh_pages_unchanged_by_this_job':True,'chat_only_originals_in_release':False}
put(RESULT/'RELEASE_RECEIPT.json',json.dumps(receipt,ensure_ascii=False,indent=2).encode())
print('HANDOFF_RELEASE '+json.dumps(receipt,ensure_ascii=False),flush=True)
