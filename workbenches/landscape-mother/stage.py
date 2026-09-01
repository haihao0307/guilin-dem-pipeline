import argparse,hashlib,json,shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--commit',required=True);a=p.parse_args();root=Path(__file__).parent;dst=Path(a.output);dst.mkdir(parents=True,exist_ok=True)
names=['index.html','reference.html','fit.css','source.mjs','field.mjs','audit.mjs','color-evidence.mjs','fit-view.mjs','fit-worker.mjs','fit-app.mjs','manifest.json'];files=[]
for n in names:
 raw=(root/n).read_bytes();shutil.copyfile(root/n,dst/n);files.append({'path':n,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
assert sum(f['bytes'] for f in files)<100000
build={'version':'B1.0','sourceCommit':a.commit,'coreCommit':'7f5591a56898cd7441a0b95e24025d3a7586376c','files':files,'sourceBytes':sum(f['bytes'] for f in files),'sourceBinaryPublished':False,'actualUserSourceRetestedInCI':False,'visualApproved':False,'productionReady':False}
(dst/'build.json').write_text(json.dumps(build,ensure_ascii=False,indent=2));print(json.dumps(build,ensure_ascii=False))
