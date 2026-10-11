#!/usr/bin/env python3
"""Acquire only pinned redistributable GNM binaries; package without loss."""
from pathlib import Path
import gzip,hashlib,json,urllib.request,subprocess,os,re,shutil
p=Path(__file__).resolve().parent
mode=os.environ.get('R12_MODE','assets')
if mode=='assets':
    records=[]
    (p/'assets').mkdir(exist_ok=True)
    base='https://raw.githubusercontent.com/xrblocks/assets-gnm/134feb02b11fa642a43ff5e7e880246255a74e86/'
    for name,size,digest in [('gnm_head_web.bin',34937952,'fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961'),('gnm_samplers_web.bin',2731824,'827fc7850022cbc62d4401c6f6782b876c4dfa48f2a6f446d9644b0ba2b8122b')]:
        data=urllib.request.urlopen(base+name,timeout=120).read();assert len(data)==size and hashlib.sha256(data).hexdigest()==digest
        packed=gzip.compress(data,compresslevel=9,mtime=0);assert gzip.decompress(packed)==data
        (p/'assets'/f'{name}.gz').write_bytes(packed)
        records.append({'file':name+'.gz','source':base+name,'originalBytes':size,'originalSha256':digest,'gzipBytes':len(packed),'gzipSha256':hashlib.sha256(packed).hexdigest(),'lossless':True})
    m=json.loads((p/'BUILD_MANIFEST.json').read_text());m['assets']=records;m['sourceRevision']=os.environ.get('GITHUB_SHA','local');(p/'BUILD_MANIFEST.json').write_text(json.dumps(m,indent=2))
    s=(p.parent/'r11/tests/unit.mjs').read_text().replace('fusion/r11/','fusion/r12/');(p/'tests/inherited-strand-unit.mjs').write_text(s)
elif mode=='stamp':
    sha=os.environ['R12_ASSET_SHA'];assert re.fullmatch('[a-f0-9]{40}',sha)
    f=p/'src/experiment.js';s=f.read_text();assert '__R12_ASSET_BASE__' in s
    s=s.replace('__R12_ASSET_BASE__',f'https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/{sha}/kaopu-hair-workbench/fusion/r12/assets/').replace('__R12_SOURCE_REVISION__',os.environ.get('GITHUB_SHA',sha));f.write_text(s)
    m=json.loads((p/'BUILD_MANIFEST.json').read_text());m['assetRevision']=sha;(p/'BUILD_MANIFEST.json').write_text(json.dumps(m,indent=2))
elif mode=='female':
    s=(p/'female-source.html').read_text();code=(p/'female-bundle.js').read_text().replace('</script','<\\/script');s=s.replace('<script type="module" src="female-src/viewer.js"></script>','<script type="module">'+code+'</script>');assert 'src="female-src/' not in s;(p/'female.html').write_text(s)
    m=json.loads((p/'BUILD_MANIFEST.json').read_text());m['femaleHtmlSha256']=hashlib.sha256((p/'female.html').read_bytes()).hexdigest();m['femaleRuntimeSelfContained']=True;m['femaleOriginalAssetPresent']=False;m['runtimeDependencies']=['Two lossless compressed fixed-hash GNM files with original-source fallback'];(p/'BUILD_MANIFEST.json').write_text(json.dumps(m,indent=2))
else:raise ValueError('Unknown build mode')
