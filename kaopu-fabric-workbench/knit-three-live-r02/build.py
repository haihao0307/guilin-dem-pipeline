from pathlib import Path
import json, hashlib, shutil
root = Path(__file__).resolve().parent
# Only our unpublished experimental transport is removed; no other project files.
shutil.rmtree(root / 'build', ignore_errors=True)
shader = (root / 'compute.wgsl').read_text()
html = (root / 'shell.html').read_text()
html = html.replace('/*SHADER*/', 'window.KNIT_WGSL='+json.dumps(shader, ensure_ascii=False)+';')
html = html.replace('/*ENGINE*/', (root / 'engine.js').read_text())
html = html.replace('/*UI*/', (root / 'ui.js').read_text())
assert '/*SHADER*/' not in html and '/*ENGINE*/' not in html and '/*UI*/' not in html
(root / 'index.html').write_text(html)
manifest = {'version':'KNIT-LIVE-R02','sha256':hashlib.sha256(html.encode()).hexdigest(),'bytes':len(html.encode()),'runtimeVerified':False,'sourceFiles':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in ['compute.wgsl','engine.js','ui.js','shell.html']}}
(root / 'BUILD.json').write_text(json.dumps(manifest, indent=2))
print(json.dumps(manifest))
