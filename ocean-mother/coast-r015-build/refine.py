"""Final deterministic R015 portability and identity refinements."""
from pathlib import Path
import json,re,sys
root=Path(sys.argv[1] if len(sys.argv)>1 else '_r015/site')
index=root/'index.html'
text=index.read_text()
text=re.sub(r'<code id="build">[^<]+</code>','<code id="build">coast-r015-daylight-glass</code>',text)
index.write_text(text)
shader=root/'shaders.mjs'
text=shader.read_text()
for upper in ['.54','.36','.45']:
    text=text.replace(f'smoothstep(1.0,{upper},vLife)',f'(1.0-smoothstep({upper},1.0,vLife))')
for m in re.finditer(r'smoothstep\(\s*([\d.-]+)\s*,\s*([\d.-]+)',text):
    assert float(m.group(1))<float(m.group(2)),m.group()
shader.write_text(text)
app=root/'app.mjs'
text=app.read_text().replace('qa.glError=gl.getError();','qa.glError=gl.getError();if(qa.glError!==gl.NO_ERROR){qa.glErrors??=[];qa.glErrors.push({frame:qa.frames,code:qa.glError});}')
app.write_text(text)
build=root/'BUILD.json'
meta=json.loads(build.read_text())
meta['imageGenerationEnabled']=False
meta['testStatus']='EXTERNAL_EVIDENCE_REQUIRED'
meta['browserHardwareLimit']='Chrome software WebGL and viewport emulation only; iPhone Safari hardware not verified'
meta['referenceBoundary']='ThreeUI public description and preview only; Pro renderer source not obtained. Forum is an unresolved question.'
build.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
assert meta['buildId'] in index.read_text()
assert meta['version'] in (root/'core.mjs').read_text()
for p in root.rglob('*'):
    if p.is_file():
        assert p.suffix.lower() not in {'.png','.jpg','.jpeg','.webp','.gif','.avif','.hdr','.exr','.ktx','.ktx2','.dds','.glb','.gltf','.obj'},str(p)
        if p.suffix in {'.mjs','.js','.css','.html'}:
            s=p.read_text()
            assert not re.search(r'data\s*:\s*image/|new\s+Image\s*\(|TextureLoader',s),str(p)
print('R015 identity, procedural asset policy and smoothstep domains verified')
