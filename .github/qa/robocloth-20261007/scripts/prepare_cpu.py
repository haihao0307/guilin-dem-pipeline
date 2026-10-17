"""Create a deterministic CPU-only adapter without changing frozen upstream files."""
from pathlib import Path
import shutil,json,hashlib,difflib
root=Path(__file__).resolve().parents[1]
src=root/'upstream';dest=root/'runtime_cpu'
if dest.exists():shutil.rmtree(dest)
for d in ['rendering','training']:
 shutil.copytree(src/d,dest/d)
changes={
 '.cuda()':'.to("cpu")',
 "device='cuda'":"device='cpu'",
 'device="cuda"':'device="cpu"',
 "map_location='cuda'":"map_location='cpu'",
}
diffs=[];report=[]
for name in ['rendering/brdf_plugin/mlp.py']:
 p=dest/name;s=p.read_text();t=s
 for a,b in changes.items():t=t.replace(a,b)
 p.write_text(t)
 diffs.extend(difflib.unified_diff(s.splitlines(True),t.splitlines(True),fromfile='upstream/'+name,tofile='runtime_cpu/'+name))
 report.append({'path':name,'source_sha256':hashlib.sha256(s.encode()).hexdigest(),'adapter_sha256':hashlib.sha256(t.encode()).hexdigest()})
(root/'reports/cpu-adapter.patch').write_text(''.join(diffs));(root/'reports/cpu-adapter.json').write_text(json.dumps(report,indent=2))
print('CPU adapter created. Model math unchanged; device conversions only.')
