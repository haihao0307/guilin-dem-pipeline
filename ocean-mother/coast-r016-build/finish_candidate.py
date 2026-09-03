from __future__ import annotations

from pathlib import Path
import base64
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import zlib

repo = Path(sys.argv[1]).resolve()
source = repo / 'ocean-mother/coast-glass-r015'
target = repo / 'ocean-mother/coast-glass-r016'
payload_dir = repo / 'ocean-mother/coast-r016-build'
parts = ['payload00.b64', 'payload01a.b64', 'payload01b.b64', 'payload02.b64', 'payload03.b64']
encoded = b''.join((payload_dir / name).read_bytes() for name in parts)
if hashlib.sha256(encoded).hexdigest() != '5a795d0eaf4627aac0954f773a0e400e74e0ed520d71884891e7be7c612b618a':
    raise SystemExit('R016 build payload identity mismatch')
script = zlib.decompress(base64.b64decode(encoded))
if hashlib.sha256(script).hexdigest() != '727654e88debea7c60909bcdba17b83be85c9355a192ddbdaa9635e4ea1bb9d1':
    raise SystemExit('R016 build script identity mismatch')
with tempfile.TemporaryDirectory() as td:
    build = Path(td) / 'build.py'
    build.write_bytes(script)
    subprocess.run([sys.executable, str(build), str(source), str(target)], check=True)

app = target / 'app.mjs'
text = app.read_text(encoding='utf-8')
replacements = {
    "const camera={target:[-4,.5,-3],yaw:3.38,pitch:.25,distance:48,fov:53*Math.PI/180":
        "const camera={target:[-4,.9,-5],yaw:.055,pitch:.22,distance:58,fov:49*Math.PI/180",
    "overview:{target:[-4,.42,-2],yaw:3.38,pitch:.25,distance:48}":
        "overview:{target:[-4,.2,-1],yaw:3.42,pitch:.31,distance:54}",
    "shore:{target:[3,.16,-4],yaw:3.44,pitch:.17,distance:20}":
        "shore:{target:[4,.2,-5],yaw:3.48,pitch:.21,distance:24}",
    "breaker:{target:[4,.18,4],yaw:3.23,pitch:.13,distance:23}":
        "breaker:{target:[4,.25,5],yaw:3.25,pitch:.15,distance:26}",
    "fire:{target:[FIRE_CENTER[0],1.15,FIRE_CENTER[2]],yaw:3.62,pitch:.20,distance:12.2}":
        "fire:{target:[FIRE_CENTER[0],1.28,FIRE_CENTER[2]],yaw:3.62,pitch:.22,distance:13.5}",
    "rocks:{target:[-7,.48,-3],yaw:3.57,pitch:.18,distance:17.5}":
        "rocks:{target:[-7,.55,-3],yaw:3.60,pitch:.23,distance:20}",
    "camera.target=[-7,.55,-3];camera.yaw=3.23;camera.pitch=.27;camera.distance=46;camera.fov=66*Math.PI/180":
        "camera.target=[-8,.5,-4];camera.yaw=3.2;camera.pitch=.30;camera.distance=54;camera.fov=68*Math.PI/180",
    "terrainGeo=gridMesh(gl,mobileMesh?144:276,mobileMesh?126:232":
        "terrainGeo=gridMesh(gl,mobileMesh?112:276,mobileMesh?96:232",
    "rockField=compileRockHeight(rg,mobileMesh?208:320,mobileMesh?180:280)":
        "rockField=compileRockHeight(rg,mobileMesh?160:320,mobileMesh?136:280)",
    "waterGeo=waterMesh(gl,mobileMesh?168:320,mobileMesh?144:276)":
        "waterGeo=waterMesh(gl,mobileMesh?136:320,mobileMesh?116:276)",
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'expected R016 app fragment missing: {old[:80]}')
    text = text.replace(old, new, 1)
text = text.replace("p.size=.34+rng.next()*.34", "p.size=.42+rng.next()*.42", 1)
app.write_text(text, encoding='utf-8')

geometry = target / 'geometry.mjs'
g = geometry.read_text(encoding='utf-8')
old = "export function rockGeometry(definitions){\n const vertices=[],indices=[];let inverted=0,degenerate=0;\n for(const [cx,cz,sx,sy,sz,seed] of definitions){\n  const base=vertices.length/7,cy=bedHeight(cx,cz)+sy*.30,lat=20,lon=40;"
new = "export function rockGeometry(definitions,lat=20,lon=40){\n const vertices=[],indices=[];let inverted=0,degenerate=0;\n for(const [cx,cz,sx,sy,sz,seed] of definitions){\n  const base=vertices.length/7,cy=bedHeight(cx,cz)+sy*.30;"
if old not in g:
    raise SystemExit('expected rock geometry fragment missing')
g = g.replace(old, new, 1)
geometry.write_text(g, encoding='utf-8')
text = app.read_text(encoding='utf-8')
old = "const rg=rockGeometry(COAST_ROCKS);"
new = "const rg=rockGeometry(COAST_ROCKS,mobileMesh?18:28,mobileMesh?36:56);"
if old not in text:
    raise SystemExit('rock geometry call missing')
app.write_text(text.replace(old, new, 1), encoding='utf-8')

shader = target / 'shaders.mjs'
s = shader.read_text(encoding='utf-8')
if "N=normalize(mix(faceN,N,.56));" not in s:
    raise SystemExit('rock normal mix fragment missing')
s = s.replace("N=normalize(mix(faceN,N,.56));", "N=normalize(mix(faceN,N,.78));", 1)
shader.write_text(s, encoding='utf-8')

build_path = target / 'BUILD.json'
build_data = json.loads(build_path.read_text(encoding='utf-8'))
build_data['compositionRevision'] = 'water-visible shoreline framing, smoother rock silhouette, lower mobile mesh budget'
build_data['candidateStatus'] = 'LOCAL_BROWSER_EVIDENCE_REQUIRED'
build_path.write_text(json.dumps(build_data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

for module in sorted(target.glob('*.mjs')):
    subprocess.run(['node', '--check', str(module)], check=True)
node = subprocess.run(['node', str(target / 'core.test.mjs')], check=True, capture_output=True, text=True)

required = {'BUILD.json','README.md','REFERENCE_STUDY.md','app.mjs','coast.css','core.mjs','core.test.mjs','geometry.mjs','index.html','shaders.mjs'}
missing = sorted(required - {p.name for p in target.iterdir() if p.is_file()})
if missing:
    raise SystemExit(f'missing files: {missing}')
image_suffixes={'.png','.jpg','.jpeg','.webp','.gif','.bmp','.tif','.tiff','.hdr','.exr','.kt','.ktx','.ktx2','.dds','.avif'}
images=[str(p) for p in target.rglob('*') if p.is_file() and p.suffix.lower() in image_suffixes]
if images:
    raise SystemExit(f'image assets found: {images}')
remote=re.compile(r'https?://[^\s"\']+\.(?:png|jpe?g|webp|gif|hdr|exr|ktx2?)\b',re.I)
for path in target.rglob('*'):
    if path.is_file() and path.suffix.lower() in {'.html','.css','.js','.mjs','.json','.md'}:
        body=path.read_text(encoding='utf-8')
        if re.search(r'data\s*:\s*image/', body, re.I) or remote.search(body):
            raise SystemExit(f'image dependency found in {path}')

report = {
    'status':'STATIC_PASS',
    'version':'0.2.6-coast-r016',
    'buildId':'coast-r016-clear-shore-glass',
    'node':json.loads(node.stdout),
    'changes':[
        'Restored water-visible overview, shore, breaker and rock framing',
        'Reduced mobile terrain, water and rock-field resolution',
        'Raised desktop rock silhouette tessellation and smoothed generated normals',
        'Kept R016 daylight, obstacle contact foam, liquid-glass controls and zero-image policy',
    ],
    'persistentImageAssets':0,
    'externalModels':0,
    'externalCdn':0,
}
print(json.dumps(report, ensure_ascii=False, indent=2))
