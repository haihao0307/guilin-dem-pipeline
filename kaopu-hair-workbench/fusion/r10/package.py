#!/usr/bin/env python3
from pathlib import Path
import re,json,hashlib
p=Path(__file__).parent
s=(p/'index.html').read_text()
s=re.sub(r'<script type="importmap">.*?</script>','',s,flags=re.S)
code=(p/'bundle.js').read_text().replace('</script','<\\/script')
s=re.sub(r'<script type="module" src="[^"]+"></script>',lambda m:'<script type="module">'+code+'</script>',s,flags=re.S)
for href in re.findall(r'<link rel="stylesheet" href="([^"]+)">',s):
 css=(p/href).resolve().read_text();s=s.replace('<link rel="stylesheet" href="'+href+'">','<style>'+css+'</style>')
for src in re.findall(r'<script src="([^"]+)" defer></script>',s):
 js=(p/src).resolve().read_text().replace('</script','<\\/script');s=s.replace('<script src="'+src+'" defer></script>','<script>'+js+'</script>')
s=s.replace('href="TEACHER-GROOM-PROVENANCE.json"','href="https://github.com/haihao0307/guilin-dem-pipeline/blob/40861390bb57673c677a08d5216286d2dcbcf4da/kaopu-hair-workbench/qa/gnm-groom-editor/TEACHER-GROOM-PROVENANCE.json"')
(p/'public-lite.html').write_text(s)
m=json.loads((p/'BUILD_MANIFEST.json').read_text())
m['bundleSha256']=hashlib.sha256((p/'bundle.js').read_bytes()).hexdigest()
m['htmlSha256']=hashlib.sha256((p/'public-lite.html').read_bytes()).hexdigest()
m['htmlBytes']=(p/'public-lite.html').stat().st_size
m['runtimeDependencies']=['GNM head and samplers: original fixed public SHA-256 checked assets']
(p/'BUILD_MANIFEST.json').write_text(json.dumps(m,indent=2))
print('Public HTML bytes:',m['htmlBytes'],'SHA256:',m['htmlSha256'])
