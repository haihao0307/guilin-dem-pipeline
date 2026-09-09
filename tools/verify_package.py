from pathlib import Path
import json,hashlib,sys
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'MANIFEST.json').read_text(encoding='utf-8'))
errors=[]
for item in manifest['files']:
 p=root/item['path']
 if not p.is_file():errors.append(item['path']+': missing');continue
 with p.open('rb') as f:sha=hashlib.file_digest(f,'sha256').hexdigest()
 if p.stat().st_size!=item['bytes'] or sha!=item['sha256']:errors.append(item['path']+': mismatch')
print(json.dumps({'passed':not errors,'checked':len(manifest['files']),'errors':errors},ensure_ascii=False))
sys.exit(bool(errors))
