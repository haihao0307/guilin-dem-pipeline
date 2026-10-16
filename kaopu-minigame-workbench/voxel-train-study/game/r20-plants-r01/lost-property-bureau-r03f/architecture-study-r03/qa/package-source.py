from pathlib import Path
import hashlib,json,zipfile
root=Path(__file__).resolve().parents[1]
files=[p for p in root.rglob('*') if p.is_file() and not set(p.relative_to(root).parts)&{'evidence','delivery','__pycache__'} and p.name!='browser-local.cjs']
manifest={'revision':'architecture-study-r03','scope':'Independent new directory only; no publication performed','runtimeDependsOn':['vendor/three.module.js','vendor/OrbitControls.js'],'files':[{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in sorted(files)]}
(root/'delivery/source-manifest.json').write_text(json.dumps(manifest,indent=2))
with zipfile.ZipFile(root/'delivery/bureau-r03-source-candidate.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for p in files:z.write(p,'architecture-study-r03/'+str(p.relative_to(root)))
 z.write(root/'delivery/source-manifest.json','architecture-study-r03/source-manifest.json')
print(len(files),'files', (root/'delivery/bureau-r03-source-candidate.zip').stat().st_size,'bytes')
