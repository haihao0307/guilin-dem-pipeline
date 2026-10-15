"""Lossless packing of existing official categorical nodes; no resampling."""
import gzip,hashlib,json
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parent; data=root.parent/'outer-terrain/data'
m=json.loads((data/'manifest.json').read_text()); a=np.full(m['shapeRC'],255,dtype=np.uint8); seen=np.zeros(a.shape,dtype=bool); overlaps=0
for c in m['chunks']:
 r,k=c['sourceStartRowCol']; h,w=c['shapeRC']; b=(data/c['waterClass']['url']).read_bytes();assert hashlib.sha256(b).hexdigest()==c['waterClass']['sha256']; q=np.frombuffer(gzip.decompress(b),np.uint8).reshape(h,w);s=seen[r:r+h,k:k+w];d=a[r:r+h,k:k+w];assert np.array_equal(d[s],q[s]);overlaps+=int(s.sum());d[:]=q;s[:]=True
assert seen.all();raw=a.tobytes();z=gzip.compress(raw,compresslevel=9,mtime=0);(root/'water-mask.u8.gz').write_bytes(z)
p={'schema':'hk-outer-ocean-mask-cache/1','shapeRC':m['shapeRC'],'nodeOriginEastingNorthing':m['nodeOriginEastingNorthing'],'stepM':30,'nodeBoundsEPSG2326':m['nodeBoundsEPSG2326'],'data':'water-mask.u8.gz','gzipBytes':len(z),'decodedBytes':len(raw),'sha256':hashlib.sha256(z).hexdigest(),'decodedSha256':hashlib.sha256(raw).hexdigest(),'semantics':m['waterClassMeaning'],'sourceManifest':'../outer-terrain/data/manifest.json','sharedOverlappingNodesChecked':overlaps,'resampled':False,'sourceAndOldMapModified':False,'ownership':'Inside old map use the old map mask unchanged; this cache is only consulted outside.'}
(root/'mask-manifest.json').write_text(json.dumps(p,indent=2)+'\n');print(json.dumps(p))
