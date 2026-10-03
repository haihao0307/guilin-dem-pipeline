from pathlib import Path
import json,base64,hashlib
ROOT=Path(__file__).parent
ORIG=ROOT/'teacher-original'
modules={str(p.relative_to(ORIG/'js/app')).removesuffix('.js'):p.read_text() for p in sorted((ORIG/'js/app').rglob('*.js')) if p.name!='main.js'}
paths=['data/models/bunnyUV.json','data/models/cloth.json']+[str(p.relative_to(ORIG)) for p in sorted((ORIG/'data/textures').glob('*.png'))]
assets={p:('data:image/png;base64,'+base64.b64encode((ORIG/p).read_bytes()).decode() if p.endswith('.png') else (ORIG/p).read_text()) for p in paths}
manifest={str(p.relative_to(ORIG)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(ORIG.rglob('*')) if p.is_file()}
bundle={'commit':'cca0432bef548a9853f34d89788c5d2761e57d56','modules':modules,'assets':assets,'sha256':manifest,'license':(ORIG/'LICENCE.md').read_text()}
# Script data is escaped to make arbitrary embedded strings safe inside HTML.
escape=lambda s:s.replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
html=(ROOT/'src/workbench.html').read_text().replace('/*__BUNDLE__*/', 'window.WORKBENCH_BUNDLE='+escape(json.dumps(bundle,separators=(',',':')))+';').replace('/*__FRAME_RUNTIME__*/','window.FRAME_RUNTIME='+escape(json.dumps((ROOT/'src/frame.js').read_text()))+';').replace('/*__HOST_RUNTIME__*/',(ROOT/'src/host.js').read_text())
(ROOT/'dist/KAOPU-毛发工作台.html').write_text(html)
(ROOT/'source-manifest.json').write_text(json.dumps({'commit':bundle['commit'],'sha256':manifest},indent=2))
print('Built',len(html.encode()),'bytes')
