from pathlib import Path
import json,hashlib,shutil
ROOT=Path(__file__).parent.resolve();remote='kaopu-tailor-workbench/garment-pattern-catalogue-r01'
selected=[]
for p in ROOT.rglob('*'):
 if not p.is_file():continue
 r=p.relative_to(ROOT);parts=r.parts
 if any(x in parts for x in ['.venv','native-extra','pw-browsers','__pycache__','mpl-cache','checkpoint','checkpoint-v2','checkpoint-v3']):continue
 if parts[0]=='browser':
  if 'pyodide' in parts:
   is_part='.gz.part' in p.name
   if p.name not in ['pyodide.js','pyodide.asm.js'] and not p.name.endswith('.gz') and not is_part:continue
   if p.name.endswith('.gz') and p.stat().st_size>11*1024*1024:continue
 elif parts[0]=='upstream':pass
 elif parts[0]=='runtime':continue # packed reproducibly; pristine source kept separately
 elif parts[0]=='examples':
  if p.name not in ['body-anny-cm.json','Skirt2-default.json','SkirtCircle-default.json','Pants-default.json','LongSleeve-default.json','Skirt2-wasm.json','SkirtCircle-wasm.json','Pants-wasm.json','LongSleeve-wasm.json']:continue
 elif parts[0]=='reports':
  if p.suffix!='.json' or p.name.startswith(('checkpoint','browser')):continue
 elif parts[0]=='tests':
  if p.suffix not in ['.py','.cjs','.mjs','.yml']:continue
 elif p.name not in ['STATUS.json','finalize_reports.py','README.md','THIRD-PARTY-NOTICES.md','requirements-native.txt','pattern_catalogue.py','build_runtime.py','build_browser.py','download_pyodide.py','make_checkpoint.py','pyodide-lock.json']:continue
 selected.append({'localPath':str(p),'path':remote+'/'+str(r),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'encoding':'base64' if (p.suffix in ['.gz','.zip','.wasm','.whl'] or '.gz.part' in p.name) else 'utf-8'})
for f in selected:
 p=Path(f['localPath']);dest=ROOT/'checkpoint-v3'/p.relative_to(ROOT);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest);f['localPath']=str(dest)
selected.sort(key=lambda x:x['path'])
manifest={'scope':'QA-only candidate, no production changes','targetDirectory':remote,'workflowDraft':'tests/qa-workflow.yml; owner may install at .github/workflows/qa-tailor-pattern-catalogue.yml','sourceCommit':'d449629979028123a5c4dc9e732a2ec19b7fce31','files':selected,'fileCount':len(selected),'bytes':sum(x['bytes'] for x in selected),'writePolicy':'Only owner-coordinated existing QA ref with fresh base/CAS; no new branch, force push, or production promotion'}
(ROOT/'CHECKPOINT-SCOPE-v3.json').write_text(json.dumps(manifest,indent=2));print(manifest['fileCount'],manifest['bytes'])
