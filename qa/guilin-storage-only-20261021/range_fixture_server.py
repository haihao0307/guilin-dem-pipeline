"""Local/CI read-only fixture server. Never serves files outside this QA folder."""
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit,unquote
import argparse,hashlib,json,mimetypes,re,threading

ROOT=Path(__file__).resolve().parent
M=json.loads((ROOT/'CANONICAL_ELEVATION_MANIFEST.json').read_text())
OLD=json.loads((ROOT/'baseline/guilin/data/NATIVE_ELEVATION_MANIFEST.json').read_text())
TILES={t['file']:t for t in OLD['tiles']}
CHUNKS={tuple(t['matrix_index']):t for t in M['chunks']}
LOCK=threading.Lock();TILE_CACHE={}

def legacy_bytes(name):
 with LOCK:
  if name in TILE_CACHE:return TILE_CACHE[name]
 t=TILES[name];sx,sy,w,h=t['source_window'];x,y=sx-2438,sy-949;out=bytearray(8388608)
 for rr in range(y//512,(y+h-1)//512+1):
  for cc in range(x//512,(x+w-1)//512+1):
   c=CHUNKS[rr,cc];cx,cy,cw,ch=c['aoi_window']
   with (ROOT/'payload/guilin-elevation-store-v1'/c['shard']).open('rb') as f:
    f.seek(c['shard_byte_offset']);raw=f.read(c['bytes'])
   assert hashlib.sha256(raw).hexdigest()==c['sha256']
   left,right=max(x,cx),min(x+w,cx+cw);top,bottom=max(y,cy),min(y+h,cy+ch)
   for row in range(top,bottom):
    a=((row-cy)*cw+left-cx)*2;b=((row-y)*2048+left-x)*2
    out[b:b+(right-left)*2]=raw[a:a+(right-left)*2]
 raw=bytes(out);assert hashlib.sha256(raw).hexdigest()==t['sha256']
 with LOCK:
  if len(TILE_CACHE)>=2:TILE_CACHE.pop(next(iter(TILE_CACHE)))
  TILE_CACHE[name]=raw
 return raw

class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_HEAD(self):self.serve(False)
 def do_GET(self):self.serve(True)
 def serve(self,body):
  route=unquote(urlsplit(self.path).path);forced=route.startswith('/force200/')
  original_route=route
  if route.startswith('/transition/'):
   if '/guilin-elevation-store-v1/' in route:route=route.replace('/transition/','/candidate/',1)
   elif '/guilin-truth-data/' in route:route=route.replace('/transition/','/baseline/',1)
   else:route=route.replace('/transition/','/'+getattr(self.server,'transition_phase','baseline')+'/',1)
  if route=='/favicon.ico':
   self.send_response(204);self.send_header('Content-Length','0');self.end_headers();return
  if forced:route='/candidate/'+route[len('/force200/'):]
  raw=None;file=None
  if route.startswith('/baseline/guilin-truth-data/native/'):
   name=route.rsplit('/',1)[-1]
   if name in TILES:raw=legacy_bytes(name)
  elif route.startswith('/candidate/guilin-elevation-store-v1/'):
   file=ROOT/'payload/guilin-elevation-store-v1'/route.split('/candidate/guilin-elevation-store-v1/',1)[1]
  elif route.startswith(('/baseline/guilin/','/candidate/guilin/')):
   file=ROOT/route.lstrip('/')
   if route.endswith('/'):file=file/'index.html'
  if file is not None:
   file=file.resolve()
   if not file.is_relative_to(ROOT) or not file.is_file():file=None
  if file is None and raw is None:self.send_error(404);return
  size=len(raw) if raw is not None else file.stat().st_size
  start,end,status=0,size-1,200
  requested=self.headers.get('Range')
  if requested and not forced:
   match=re.fullmatch(r'bytes=(\d+)-(\d+)',requested)
   if not match or not (0<=int(match[1])<=int(match[2])<size):
    self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.send_header('Content-Length','0');self.end_headers();return
   start,end,status=int(match[1]),int(match[2]),206
  self.send_response(status)
  self.send_header('Content-Type',mimetypes.guess_type(str(file) if file is not None else route)[0] or 'application/octet-stream')
  self.send_header('Content-Length',str(end-start+1));self.send_header('Accept-Ranges','bytes')
  self.send_header('Cache-Control','public, max-age=3600' if route.endswith('.js') else 'no-store')
  if status==206:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
  self.end_headers();written=0
  try:
   if body and raw is not None:self.wfile.write(raw[start:end+1]);written=end-start+1
   elif body:
    with file.open('rb') as f:
     f.seek(start);remaining=end-start+1
     while remaining:
      data=f.read(min(65536,remaining));self.wfile.write(data);written+=len(data);remaining-=len(data)
  except (BrokenPipeError,ConnectionResetError):pass
  finally:
   record={'path':original_route,'resolved_fixture_path':route,'request_range':requested,'status':status,'declared_bytes':end-start+1,'written_bytes':written,'forced_200':forced}
   with LOCK:
    with (ROOT/'reports/HTTP_FIXTURE_ACCESS.jsonl').open('a') as log:log.write(json.dumps(record)+'\n')

def make_server(port=0):return ThreadingHTTPServer(('127.0.0.1',port),Handler)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=0);a=p.parse_args()
 server=make_server(a.port);print(json.dumps({'port':server.server_port}),flush=True);server.serve_forever()
