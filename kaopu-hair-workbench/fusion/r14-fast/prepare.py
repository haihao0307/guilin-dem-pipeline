"""Lossless section split of the exact original model. No mesh/texture resampling."""
from pathlib import Path
import shutil,json,hashlib,gzip,re,base64,os
p=Path(__file__).resolve().parent
old=Path(os.environ.get('HAIR_PARENT',p.parent/'r14-loadfix'))
for name in ['src','vendor','data','native-head','licenses']:
    shutil.copytree(old/name,p/name,dirs_exist_ok=True)
for name in ['index.html','workbench.css','NATIVE_HEAD_LOCK.json','BASELINE_HASHES.json']:
    shutil.copy2(old/name,p/name)
def edit(name,a,b):
    f=p/name;s=f.read_text();assert s.count(a)==1,(name,a,s.count(a));f.write_text(s.replace(a,b))
html=(old/'public-lite.html').read_text()
assert hashlib.sha256(html.encode()).hexdigest()=='e955df78a669f4ee06437968e2936d575aa37047714fe0bf08f82997056b570a'
z=base64.b64decode(re.search(r'<template id="gnmHeadPayload"[^>]*>(.*?)</template>',html).group(1))
raw=gzip.decompress(z)
assert hashlib.sha256(raw).hexdigest()=='fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961'
hlen=int.from_bytes(raw[8:12],'little');prefix=raw[:12+hlen];header=json.loads(raw[12:12+hlen]);base=12+hlen
bulk={'identity_basis','expression_basis'}
def pack(selected):
    buf=bytearray();sections=[]
    for s in header['sections']:
        if (s['name'] in bulk)!=selected:continue
        while len(buf)%4:buf.append(0)
        sections.append({**s,'offset':len(buf)})
        buf.extend(raw[base+s['offset']:base+s['offset']+s['byteLength']])
    h=json.dumps({'meta':header['meta'],'sections':sections},separators=(',',':')).encode()
    h+=b' '*((-12-len(h))%4)
    return b'GNMW'+(1).to_bytes(4,'little')+len(h).to_bytes(4,'little')+h+buf
core=pack(False);deferred=pack(True)
(p/'build-data').mkdir(exist_ok=True)
for name,blob in [('core.bin',core),('deferred.bin',deferred),('original.bin',raw)]:
    (p/'build-data'/name).write_bytes(blob)
original={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'prefix':base64.b64encode(prefix).decode(),'sections':header['sections']}
(p/'build-data/original.json').write_text(json.dumps(original,separators=(',',':')))
shutil.copy2(p/'patches/ExactGuideSearch.js',p/'src/ExactGuideSearch.js')
edit('src/LengthKernel.js',"import {crownWeight","import {exactNearestGuides} from './ExactGuideSearch.js';\nimport {crownWeight")
f=p/'src/LengthKernel.js';s=f.read_text();a=s.index('function nearestGuides(');b=s.index('function rotateNormal(',a)
s=s[:a]+'''function nearestGuides(root,d,gs){
 const cw=crownWeight(root),flow=fieldDirection(root,root,d);
 return exactNearestGuides(gs,root,g=>{const delta=sub(g.root,root);return dot(delta,delta)*(1+5*cw*Math.pow(1-clamp(dot(flow,g.rootFlow),-1,1),2));},g=>canInterpolate(root,g.root,d));
}
'''+s[b:];f.write_text(s)
edit('src/app.js',"import {loadEmbeddedHead} from './EmbeddedHead.js';","const loadEmbeddedHead=async()=>globalThis.__HAIR_RUNTIME.coreResult;")
edit('src/app.js',"model=new GNMHeadModel(h.meta,h.sections);","model=new GNMHeadModel(h.meta,h.sections);globalThis.__HAIR_RUNTIME.attachModel(model);")
edit('src/app.js',"assets.push({kind,sha256:'fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961',bytes:34937952,compressedBytes:a.compressedBytes,transport:a.transport});","assets.push({kind,sourceOriginalSha256:'fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961',sha256:a.sha256,bytes:a.buffer.byteLength,compressedBytes:a.compressedBytes,transport:a.transport});")
edit('src/app.js',"startup:{stage:startupStage,failure:startupFailure,embeddedModel:true}","startup:{stage:startupStage,failure:startupFailure,embeddedModel:false,loading:globalThis.__HAIR_LOAD}")
edit('src/app.js',"startupStage='ready';sync();","startupStage='ready';globalThis.__HAIR_LOAD.fullyRenderedMs=performance.now();sync();")
edit('src/app.js','window.lengthGroom.retryStartup=retryStartup;','''window.lengthGroom.retryStartup=retryStartup;
window.lengthGroom.loadOriginalBases=()=>globalThis.__HAIR_RUNTIME.loadOriginalBases();
window.lengthGroom.runtimeBuffers=()=>({curves:compiled.curves,normals:compiled.normals,tangents:compiled.tangents,randoms:compiled.randoms,active:compiled.active,guideMap:compiled.guideMap,weights:compiled.weights,lengths:compiled.lengths,head:head.geometry.attributes.position.array});''')
for name in ['src/app.js','index.html']:
    f=p/name;s=f.read_text().replace('R14.2-L01','R14.2-L02').replace('随页资源 · 启动修复','直达快启 · 原质量').replace('读取随页原模型…','读取原质量资源…');f.write_text(s)
manifest=[]
for folder in ['src','native-head','data','vendor']:
    for f in (old/folder).rglob('*'):
        if f.is_file() and f.suffix in ['.js','.mjs','.png']:
            rel=f.relative_to(old).as_posix()
            if rel in ['src/app.js','src/LengthKernel.js']:continue
            assert (p/rel).read_bytes()==f.read_bytes(),rel
            manifest.append({'path':rel,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'bytes':f.stat().st_size})
(p/'UNCHANGED_RUNTIME.json').write_text(json.dumps({'parent':'bb5cb1dc9b451f6cd190fc726856a8ecbfb7244b','files':manifest},indent=2))
print('core',len(core),'gzip',len(gzip.compress(core,9,mtime=0)),'deferred',len(deferred))
