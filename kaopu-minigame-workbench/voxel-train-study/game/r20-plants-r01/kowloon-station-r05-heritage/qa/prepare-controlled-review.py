from pathlib import Path
import shutil,sys,hashlib,json
mode=sys.argv[1]
prefix=Path('kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01')
source=Path('revision')/prefix/'kowloon-station-r05-heritage'
root=Path('baseline')/prefix
host=root/'kowloon-train88-r01'
if mode=='candidate':
 shutil.copytree(source,root/'kowloon-station-r05-heritage',dirs_exist_ok=True)
 for p in host.rglob('*.mjs'):
  p.write_text(p.read_text().replace('../kowloon-station-r04/','../kowloon-station-r05-heritage/'))
shutil.copyfile(source/'qa/webgl-evidence.cjs',host/'qa/webgl-evidence.cjs')
p=host/'qa/native-focus-host.cjs';s=p.read_text()
s=s.replace("page.setDefaultTimeout(600000);","page.setDefaultTimeout(600000);await require('./webgl-evidence.cjs')(page,out);")
# The complete original successful native-focus contract is kept for baseline.
# Candidate is also held to it; changed architecture may legitimately change IDs,
# but any such assertion occurs only after complete material readbacks are saved.
p.write_text(s)
files=['native-shed-roof.mjs','native-arch-truss.mjs','native-cast-column.mjs','native-platform-edge.mjs','native-station-rail.mjs','native-station-waterfront.mjs','station-acceleration.mjs']
hashes={}
for f in files:
 a=(root/'kowloon-station-r04'/f).read_bytes();b=(source/f).read_bytes();assert a==b,f'Unrelated source changed: {f}';hashes[f]=hashlib.sha256(a).hexdigest()
Path('baseline/source-control.json').write_text(json.dumps({'receiverCommit':'25c460991397665e2ad9068e79a93b2b16b80484','mode':mode,'unchangedHashes':hashes},indent=2))
print('CONTROLLED_REVIEW',mode,hashes)
