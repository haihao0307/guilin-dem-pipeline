import argparse,hashlib,json,shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--commit',required=True);a=p.parse_args()
root=Path(__file__).resolve().parent;dst=Path(a.output);dst.mkdir(parents=True,exist_ok=True)
names=['index.html','style.css','fields.mjs','checks.mjs','worker.mjs','shaders.mjs','renderer.mjs','app.mjs','manifest.json','reference.html','reference.mjs','glb-reader.mjs','reference-intake-b.json']
files=[]
for n in names:
 raw=(root/n).read_bytes();shutil.copyfile(root/n,dst/n);files.append({'path':n,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
assert sum(f['bytes'] for f in files)<100000,'Review source budget before publishing'
build={'version':'1.0.1-reference','sourceCommit':a.commit,'coreCommit':'7f5591a56898cd7441a0b95e24025d3a7586376c','files':files,'sourceBytes':sum(f['bytes'] for f in files),'referenceEntry':'reference.html','sourceBinaryPublished':False,'visualApproved':False,'productionReady':False}
(dst/'build.json').write_text(json.dumps(build,ensure_ascii=False,indent=2))
print(json.dumps(build,ensure_ascii=False,indent=2))
