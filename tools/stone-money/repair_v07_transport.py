#!/usr/bin/env python3
"""Bound CI transport, do not change terrain or material math."""
from pathlib import Path
root=Path(__file__).resolve().parents[2]/'workbenches/landscape-terrain-influence-tool-v07'
p=root/'bake.html';s=p.read_text()
old="let r=await fetch('/__save/'+entry.id,{method:'POST',body:bytes});if(!r.ok)throw Error('Save failed');"
new="""for(let offset=0;offset<bytes.length;offset+=262144){let r=await fetch('/__save/'+entry.id+'?offset='+offset,{method:'POST',body:bytes.subarray(offset,Math.min(bytes.length,offset+262144))});if(!r.ok)throw Error('Chunk save failed '+offset);}let r=await fetch('/__save/'+entry.id+'?finish=1',{method:'POST'});if(!r.ok)throw Error('Cache finalize failed');"""
assert old in s;s=s.replace(old,new)
p.write_text(s)
p=root/'bake-caches.py';s=p.read_text()
a=s.index(' def do_POST(self):');b=s.index('\nsrv=',a)
s=s[:a]+''' def do_POST(self):
  from urllib.parse import urlsplit,parse_qs
  parsed=urlsplit(self.path);name=parsed.path.removeprefix('/__save/');q=parse_qs(parsed.query)
  if not name.startswith('P') or not name[1:].isdigit():self.send_error(400);return
  (root/'cache').mkdir(exist_ok=True);temp=root/'cache'/f'{name}.tmp'
  if 'finish' in q:
   if not temp.exists():self.send_error(409);return
   with temp.open('rb') as src,gzip.open(root/'cache'/f'{name}.lmc','wb',compresslevel=6) as dst:shutil.copyfileobj(src,dst,1024*1024)
   temp.unlink()
  else:
   offset=int(q.get('offset',['-1'])[0]);length=int(self.headers.get('Content-Length',0))
   if offset<0 or length>262144:self.send_error(400);return
   if offset>0 and (not temp.exists() or temp.stat().st_size!=offset):self.send_error(409);return
   data=self.rfile.read(length)
   if len(data)!=length:self.send_error(400);return
   with temp.open('wb' if offset==0 else 'ab') as dst:dst.write(data)
  self.send_response(200);self.end_headers();self.wfile.write(b'OK')
'''+s[b:]
p.write_text(s)
for name in ['index.html','bake.html']:
 p=root/name;s=p.read_text();s=s.replace('const result={report:data.report,parts:[]};let done=', 'view={...view};recipe={...recipe};const result={report:data.report,parts:[]};let done=')
 s=s.replace('原台内核已连接','等待地形首帧').replace('原内核已连接','等待地形首帧')
 s=s.replace('生成耗时 ${','发布前生产耗时 ${')
 p.write_text(s)
print('Bounded binary transport to 256 KiB; original geometry unchanged.')
import subprocess,sys
subprocess.run([sys.executable,str(Path(__file__).with_name('split_v07_fragment_fields.py'))],check=True)
