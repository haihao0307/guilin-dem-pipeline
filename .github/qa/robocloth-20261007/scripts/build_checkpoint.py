from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[1]
files=[root/'STATUS.md']
files += [p for p in (root/'scripts').glob('*') if p.suffix in ('.py','.sh')]
files += [p for p in (root/'reports').glob('*') if p.suffix in ('.json','.md','.patch') or p.name in ('LICENSE-Apache-2.0.txt','range-headers-sanitized.txt')]
manifest=[];entries=[]
for p in files:
 rel=str(p.relative_to(root));content=p.read_text();manifest.append({'path':rel,'bytes':p.stat().st_size,'sha256':hashlib.sha256(content.encode()).hexdigest()});entries.append({'path':'.github/qa/robocloth-20261007/'+rel,'mode':'100644','type':'blob','content':content})
(root/'reports/checkpoint-files.json').write_text(json.dumps(manifest,indent=2));(root/'checkpoint-entries.json').write_text(json.dumps(entries));print(len(entries),sum(x['bytes'] for x in manifest))
