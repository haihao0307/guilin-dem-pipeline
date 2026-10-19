import os,json,hashlib,urllib.request,time,concurrent.futures
from pathlib import Path
p=Path(__file__).parent
expected=json.loads((p/'public-runtime-hashes.json').read_text());base=os.environ['TARGET_URL'];out=p.parent/'qa';out.mkdir(exist_ok=True)
def one(item):
 f,e=item;url=base+f
 for attempt in range(1,4):
  try:
   with urllib.request.urlopen(url,timeout=60) as r:
    h=hashlib.sha256();n=0
    while True:
     b=r.read(262144)
     if not b:break
     h.update(b);n+=len(b)
    assert n==e['bytes'] and h.hexdigest()==e['sha256'],f+' HASH_MISMATCH'
    return dict(path=f,status=r.status,bytes=n,sha256=h.hexdigest(),attempt=attempt)
  except Exception:
   if attempt==3:raise
   time.sleep(4)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:rows=list(ex.map(one,expected.items()))
(out/'PUBLIC_RUNTIME_HASHES.json').write_text(json.dumps(dict(status='PASS',files=len(rows),bytes=sum(r['bytes'] for r in rows),results=rows),indent=2))
print('PUBLIC_HASH_PASS',len(rows))
