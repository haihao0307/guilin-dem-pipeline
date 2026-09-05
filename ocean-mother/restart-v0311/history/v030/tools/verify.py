from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'MANIFEST.json').read_text(encoding='utf-8'))
errors=[]
for rel,meta in manifest['files'].items():
 p=ROOT/rel
 if not p.is_file(): errors.append(rel+' missing');continue
 data=p.read_bytes()
 if len(data)!=meta['bytes']: errors.append(rel+' size')
 if hashlib.sha256(data).hexdigest()!=meta['sha256']: errors.append(rel+' sha256')
print(json.dumps({'status':'PASS' if not errors else 'FAIL','checked':len(manifest['files']),'errors':errors},ensure_ascii=False,indent=2))
sys.exit(1 if errors else 0)
