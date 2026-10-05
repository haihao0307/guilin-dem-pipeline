from pathlib import Path
import hashlib,json,urllib.request
P=Path(__file__).parent
for name,item in json.loads((P/'vendor-lock.json').read_text()).items():
 path=P/'vendor'/name
 if not path.exists():
  path.parent.mkdir(exist_ok=True)
  path.write_bytes(urllib.request.urlopen(item['url'],timeout=90).read())
 if hashlib.sha256(path.read_bytes()).hexdigest()!=item['sha256']:raise SystemExit('Vendor hash mismatch '+name)
 print(name,'verified',item['sha256'])
