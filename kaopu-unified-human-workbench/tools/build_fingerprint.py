from pathlib import Path
import json,hashlib,gzip
R=Path(__file__).resolve().parents[1]
for name in ['canonical','mhr-torso-delta']:
 p=R/'assets'/f'{name}.json';p.with_suffix('.json.gz').write_bytes(gzip.compress(p.read_bytes(),compresslevel=9,mtime=0))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
# Teacher hashes are pinned from checked source export manifests.
am=json.loads((R.parent/'anny-workbench-20261006/kaopu-anny-workbench/assets/anny-model.json').read_text())
inputs={'canonical':sha(R/'assets/canonical.json'),'mhrProjection':sha(R/'assets/mhr-torso-delta.json'),'canonicalCompressed':sha(R/'assets/canonical.json.gz'),'mhrProjectionCompressed':sha(R/'assets/mhr-torso-delta.json.gz'),'annyBinary':am['binary']['sha256'],'gnmBinary':'fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961','unifiedImplementation':sha(R/'src/UnifiedModel.js'),'annyImplementation':sha(R/'src/AnnyModel.js'),'gnmImplementation':sha(R/'src/GNMModel.js')}
identity=hashlib.sha256(json.dumps(inputs,sort_keys=True,separators=(',',':')).encode()).hexdigest()
(R/'assets/adapter-fingerprint.json').write_text(json.dumps({'schema':'kaopu-unified-adapter/1','id':identity,'inputs':inputs},indent=2)+'\n');print(identity)
