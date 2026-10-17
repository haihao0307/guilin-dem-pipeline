"""Verify and unpack the shared Anny multipart runtime for CPU QA."""
from pathlib import Path
import sys,json,hashlib,gzip
root=Path(sys.argv[1]);meta=json.loads((root/'assets/anny-model.json').read_text());info=meta['binary']['compressed']
def check(data,spec):
 assert len(data)==spec['byteLength'],'Anny byte length mismatch'
 assert hashlib.sha256(data).hexdigest()==spec['sha256'],'Anny SHA-256 mismatch'
parts=info.get('parts')
if parts:
 chunks=[]
 for p in parts:
  b=(root/p['url']).read_bytes();check(b,p);chunks.append(b)
 data=b''.join(chunks)
else:data=(root/info['url']).read_bytes()
check(data,info);raw=gzip.decompress(data);check(raw,meta['binary']);(root/'assets/anny-model.bin').write_bytes(raw);print('Verified Anny bytes',len(raw))
