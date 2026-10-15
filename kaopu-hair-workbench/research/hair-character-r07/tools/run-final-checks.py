import subprocess,sys,json
from pathlib import Path
manifest=json.loads(Path('BUILD_MANIFEST.json').read_text(encoding='utf-8'))['files']
checks=[('run-unit.cjs','unit-report.json'),('test-character.cjs','character-report.json'),('test-motion-contact.cjs','motion-contact-report.json'),('test-surface-opacity-distance.cjs','surface-opacity-distance-report.json'),('test-refined-surface.cjs','refined-surface-report.json'),('test-cache-quality.cjs','cache-quality-report.json'),('capture-motion.cjs','frame-manifest-r07.json'),('test-distance-performance.cjs','distance-performance.json')]
for tool,name in checks:
 f=Path('qa')/name
 if f.exists():
  report=json.loads(f.read_text(encoding='utf-8'))
  if report.get('passed') and report.get('sourceHashes')==manifest:
   print('CURRENT CHECK REUSED',tool,flush=True);continue
 print('CHECK',tool,flush=True)
 result=subprocess.run(['node','tools/'+tool])
 if result.returncode:sys.exit(result.returncode)
print('ALL FINAL CHECKS PASSED',flush=True)
