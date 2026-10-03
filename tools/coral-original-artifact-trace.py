"""Read-only recovery of original Blue R41 / Color R02. No generated replacement."""
import os,sys,json,re,hashlib,base64,zlib,zipfile,tarfile,io,posixpath,subprocess,time
from pathlib import Path
from urllib.request import Request,build_opener,HTTPRedirectHandler,urlopen
from urllib.error import HTTPError
OUT=Path('/tmp/coral-original-trace');OUT.mkdir(exist_ok=True);(OUT/'candidates').mkdir(exist_ok=True)
TOKEN=os.environ['GH_TOKEN'];REPO=os.environ['GITHUB_REPOSITORY'];START=time.monotonic();LIMIT=540
R={'scope':'Same repository Actions artifacts plus reassembled loaders from reachable commit snapshots. No production files changed.','artifacts':[],'downloads':[],'reassembled':[],'matches':[],'errors':[],'skipped':[],'inspected':0,'decoded':0};seen=set();assemblies=set();MAX=100_000_000
class NoRedirect(HTTPRedirectHandler):
 def redirect_request(self,*a,**kw):return None
nr=build_opener(NoRedirect)
def api(path):
 with urlopen(Request('https://api.github.com/repos/'+REPO+'/'+path,headers={'Authorization':'Bearer '+TOKEN,'Accept':'application/vnd.github+json','User-Agent':'Coral-original-recovery'}),timeout=30) as q:return json.load(q)
def bounded_read(q,n):
 b=q.read(n+1)
 if len(b)>n:raise ValueError('source exceeds bounded read')
 return b

def inspect(b,where,depth=0):
 if depth>4 or len(b)>MAX:return
 h=hashlib.sha256(b).hexdigest()
 if h in seen:return
 seen.add(h);R['inspected']+=1
 if b.startswith(b'PK\x03\x04'):
  try:
   with zipfile.ZipFile(io.BytesIO(b)) as z:
    for m in z.infolist():
     if m.is_dir() or m.file_size>MAX:continue
     if Path(m.filename.lower()).suffix in ['.html','.htm','.js','.mjs','.json','.md','.txt','.glsl','.b64','.zip','.gz','.tar']:
      inspect(z.read(m),where+'!'+m.filename,depth+1)
  except Exception as e:R['errors'].append([where,str(e)])
  return
 if len(b)>265 and b[257:262]==b'ustar':
  try:
   with tarfile.open(fileobj=io.BytesIO(b),mode='r:') as z:
    for m in z:
     if m.isfile() and m.size<=MAX and ('coral' in m.name.lower() or Path(m.name).suffix.lower() in ['.html','.glsl']):
      q=z.extractfile(m)
      if q:inspect(q.read(),where+'!'+m.name,depth+1)
  except Exception as e:R['errors'].append([where,str(e)])
  return
 if b[:2] in [b'\x1f\x8b',b'x\x9c',b'x\xda',b'x\x01']:
  try:
   d=zlib.decompressobj(31 if b.startswith(b'\x1f\x8b') else 15);u=d.decompress(b,MAX+1)
   if len(u)<=MAX:R['decoded']+=1;inspect(u,where+'!inflate',depth+1)
  except Exception:pass
  return
 try:t=b.decode('utf-8')
 except UnicodeDecodeError:return
 lower=t.lower();title=re.findall(r'<title[^>]*>(.*?)</title>',t,re.S|re.I)
 hits=[x for x in ['沿着生长','大形保留','老师完整源码','BLUE CORAL / R41','COLOR CORAL / R02','BLUE_CORAL_R41','COLOR_CORAL_R02'] if x.lower() in lower]
 if hits:
  row={'source':where,'sha256':h,'bytes':len(b),'title':title[:3],'hits':hits,'webglCalls':len(re.findall('drawArrays|drawElements|WebGLRenderer',t)),'laterWrapperMarkers':bool(re.search('target-screen|exact-source-not-recovered|runtime-pending|原版恢复中|源码待定位',t))}
  R['matches'].append(row);(OUT/'candidates'/(h[:20]+'.txt')).write_bytes(b)
 # HTML quoted in JSON/string and complete inline compressed code, never eval.
 if depth<4:
  for m in re.finditer(r'(?<![A-Za-z0-9+/_-])([A-Za-z0-9+/_-]{300,}={0,2})(?![A-Za-z0-9+/_-])',t):
   s=m.group(1)
   if len(s)>20_000_000:continue
   try:
    u=base64.urlsafe_b64decode(s+'='*((-len(s))%4))
    if u.startswith((b'<!',b'<html',b'\x1f\x8b',b'PK\x03\x04',b'x\x9c',b'x\xda')):R['decoded']+=1;inspect(u,where+'!base64@'+str(m.start()),depth+1)
   except Exception:pass

def git(*a):return subprocess.check_output(['git',*a],stderr=subprocess.DEVNULL)
# Find loader snapshots and follow the filenames actually used by each loader.
objs=git('rev-list','--objects','--all').decode().splitlines();todo=[]
for ln in objs:
 s=ln.split(' ',1)
 if len(s)==2 and any(x in s[1].lower() for x in ['coral','珊瑚']) and Path(s[1]).suffix.lower() in ['.html','.js','.txt']:todo.append(s)
for sha,path in todo:
 if time.monotonic()-START>180: R['skipped'].append('loader time budget');break
 try:
  b=git('cat-file','blob',sha)
  if len(b)>MAX:continue
  t=b.decode('utf-8',errors='replace')
  arrays=[]
  for m in re.finditer(r'\[([^\[\]]{5,16000})\]',t):
   v=re.findall(r'[\"\x27]([^\"\x27]+\.(?:txt|b64))[\"\x27]',m.group(1))
   if len(v)>1 and len(v)<=128:arrays.append(v)
  if not arrays:continue
  commits=git('log','--all','--format=%H','--',path).decode().splitlines()
  for c in commits:
   try:
    if git('rev-parse',c+':'+path).decode().strip()!=sha:continue
    for names in arrays:
     key=(c,path,tuple(names))
     if key in assemblies:continue
     assemblies.add(key)
     parts=[];identities=[]
     for n in names:
      p=posixpath.normpath(posixpath.join(posixpath.dirname(path),n))
      if p.startswith('../') or ':' in p:raise ValueError('nonlocal loader piece')
      d=git('show',c+':'+p);parts.append(d.strip());identities.append({'path':p,'bytes':len(d),'sha256':hashlib.sha256(d).hexdigest()})
     packed=b''.join(parts);raw=base64.b64decode(packed,validate=True);de=zlib.decompressobj(31);dec=de.decompress(raw,MAX+1)
     if len(dec)>MAX:raise ValueError('oversized reassembly')
     h=hashlib.sha256(dec).hexdigest();record={'commit':c,'loader':path,'loaderBlob':sha,'parts':identities,'decodedBytes':len(dec),'sha256':h,'titles':re.findall(r'<title[^>]*>(.*?)</title>',dec.decode('utf8','replace'),re.S|re.I)}
     R['reassembled'].append(record);(OUT/'candidates'/('assembled-'+h[:20]+'.html')).write_bytes(dec);inspect(dec,'git:'+c+':'+path+'!joined-loader')
   except subprocess.CalledProcessError:continue
   except Exception as e:R['errors'].append(['loader:'+c+':'+path,str(e)])
 except Exception as e:R['errors'].append([path,str(e)])
# Build outputs can contain original sources that were never committed.
try:
 for page in range(1,41):
  if time.monotonic()-START>LIMIT:break
  j=api('actions/artifacts?per_page=100&page='+str(page));a=j.get('artifacts',[])
  for v in a:R['artifacts'].append({k:v.get(k) for k in ['id','name','size_in_bytes','created_at','expired','workflow_run']})
  if len(a)<100:break
 candidates=[v for v in R['artifacts'] if re.search('coral|珊瑚',v['name'],re.I) or ('2026-09-27'<=v['created_at'][:10]<='2026-09-30' and re.search('kaopu|mother|source|workbench',v['name'],re.I))]
 candidates.sort(key=lambda v:(not ('2026-09-27'<=v['created_at'][:10]<='2026-09-30'),v['size_in_bytes']))
 total=0
 for v in candidates:
  if time.monotonic()-START>LIMIT:R['skipped'].append('artifact time budget');break
  if v['expired'] or v['size_in_bytes']>240_000_000 or total+v['size_in_bytes']>800_000_000:
   R['skipped'].append({'artifact':v['id'],'name':v['name'],'reason':'expired/size budget'});continue
  try:
   u='https://api.github.com/repos/'+REPO+'/actions/artifacts/'+str(v['id'])+'/zip'
   try:q=nr.open(Request(u,headers={'Authorization':'Bearer '+TOKEN,'Accept':'application/vnd.github+json'}),timeout=30)
   except HTTPError as e:
    if e.code not in [301,302,303,307,308]:raise
    target=e.headers['Location']
    if not target.startswith('https://'):raise ValueError('artifact redirect scheme')
    q=urlopen(Request(target,headers={'User-Agent':'Coral-original-recovery'}),timeout=40)
   with q:b=bounded_read(q,240_000_000)
   total+=len(b);R['downloads'].append({'id':v['id'],'name':v['name'],'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()});inspect(b,'artifact:'+str(v['id'])+':'+v['name'])
  except Exception as e:R['errors'].append(['artifact:'+str(v['id']),str(e)])
except Exception as e:R['errors'].append(['artifact-index',str(e)])
R['seconds']=round(time.monotonic()-START,2);R['candidateCount']=len(R['matches']);R['artifactIndexCount']=len(R['artifacts']);R['publicationChanged']=False
(OUT/'TRACE_REPORT.json').write_text(json.dumps(R,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in R.items() if k not in ['artifacts','matches']},ensure_ascii=False,indent=2))
