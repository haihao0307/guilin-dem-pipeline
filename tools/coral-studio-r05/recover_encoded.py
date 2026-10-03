"""Read-only search of nested/encoded HTML, not a generator or a replacement workbench."""
import base64,gzip,hashlib,html,io,json,re,subprocess,sys,zipfile,zlib
from pathlib import Path
out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
R={'scope':'coral-related historical objects plus HTML: nested ZIP, gzip, zlib, quoted HTML and inline base64; reachable refs only','inspected':0,'decoded':0,'nestedMembers':0,'matches':[],'errors':[],'skipped':[]}
seen=set();MAX=80_000_000
need=['BLUE CORAL / R41','COLOR CORAL / R02','沿着生长，让细节有起伏','老师完整源码，直接运行']
def visit(b,label,depth=0):
 if len(b)>MAX or depth>5:return
 h=hashlib.sha256(b).hexdigest()
 if h in seen:return
 seen.add(h);R['inspected']+=1
 if b.startswith(b'PK\x03\x04'):
  try:
   with zipfile.ZipFile(io.BytesIO(b)) as z:
    for m in z.infolist():
     if m.file_size>MAX or m.is_dir():continue
     if Path(m.filename.lower()).suffix in ['.zip','.html','.htm','.js','.json','.txt','.b64','.gz','.glsl']:
      R['nestedMembers']+=1;visit(z.read(m),label+'!'+m.filename,depth+1)
  except Exception as e:R['errors'].append([label,str(e)])
  return
 if b.startswith(b'\x1f\x8b') or b[:2] in [b'x\x9c',b'x\xda',b'x\x01']:
  try:
   d=zlib.decompressobj(31 if b.startswith(b'\x1f\x8b') else 15);u=d.decompress(b,MAX+1)
   if len(u)<=MAX:R['decoded']+=1;visit(u,label+'!inflate',depth+1)
  except Exception:pass
  return
 if b.startswith((b'\x89PNG',b'\xff\xd8',b'\x1aE\xdf\xa3')):return
 try:t=b.decode('utf-8')
 except UnicodeDecodeError:return
 hits=[x for x in need if x.lower() in t.lower()]
 if hits:
  title=re.findall(r'<title[^>]*>(.*?)</title>',t,re.I|re.S)[:3]
  row={'source':label,'sha256':h,'bytes':len(b),'title':title,'matches':hits,'webgl_tokens':len(re.findall(r'drawArrays|drawElements|WebGLRenderer|new THREE',t)),'recovery_wrapper':bool(re.search(r'原版恢复中|运行体待恢复|exact-source-not-recovered|target-screen|runtime-pending',t))}
  R['matches'].append(row);(out/(h[:20]+'.txt')).write_bytes(b)
 # Decode string-contained documents without executing anything.
 for m in re.finditer(r'"(?:[^"\\]|\\.)*"',t):
  v=m.group()
  if ('doctype' in v.lower() or '\\u003c' in v or 'BLUE CORAL' in v or 'COLOR CORAL' in v) and len(v)>200:
   try:
    s=json.loads(v)
    if isinstance(s,str) and s!=t and len(s)>200:R['decoded']+=1;visit(s.encode(),label+'!json-string',depth+1)
   except Exception:pass
 for m in re.finditer(r'(?<![A-Za-z0-9+/_-])([A-Za-z0-9+/_-]{300,}={0,2})(?![A-Za-z0-9+/_-])',t):
  s=m.group(1)
  if len(s)>MAX*1.4:continue
  try:
   u=base64.urlsafe_b64decode(s+'='*((-len(s))%4))
   if u.startswith((b'\x1f\x8b',b'x\x9c',b'x\xda',b'PK\x03\x04',b'<!',b'<html',b'{',b'//',b'/*')):R['decoded']+=1;visit(u,label+'!base64@'+str(m.start()),depth+1)
  except Exception:pass
 if '&lt;html' in t or '&lt;!doctype' in t.lower():
  s=html.unescape(t)
  if s!=t:visit(s.encode(),label+'!html-entities',depth+1)
if len(sys.argv)>2 and sys.argv[2]=='--git':
 objects=subprocess.check_output(['git','rev-list','--objects','--all'],text=True).splitlines()
 p=subprocess.Popen(['git','cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
 for line in objects:
  a=line.split(' ',1)
  if len(a)!=2:continue
  sha,path=a;ext=Path(path.lower()).suffix
  if not(ext in ['.html','.htm'] or (any(x in path.lower() for x in ['coral','珊瑚']) and ext in ['.js','.json','.txt','.b64','.gz','.zip','.glsl'])):continue
  p.stdin.write((sha+'\n').encode());p.stdin.flush();header=p.stdout.readline().decode().split()
  if len(header)!=3:continue
  size=int(header[2]);b=p.stdout.read(size);p.stdout.read(1)
  if size>MAX:R['skipped'].append({'path':path,'bytes':size});continue
  visit(b,'git:'+sha+':'+path)
 p.stdin.close();p.wait()
else:
 for path in Path('/mnt/data').glob('*'):
  if path.is_file() and ('coral' in path.name.lower()) and path.suffix.lower() in ['.html','.zip']:visit(path.read_bytes(),str(path))
 for path in Path('/mnt/data/coral_hub_sources').glob('*.zip'):visit(path.read_bytes(),str(path))
R['candidate_count']=len(R['matches']);(out/'ENCODED_SOURCE_AUDIT.json').write_text(json.dumps(R,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in R.items() if k not in ['matches']},ensure_ascii=False,indent=2))
