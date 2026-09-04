from pathlib import Path
import argparse,hashlib,json
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--commit',required=True);a=p.parse_args();root=Path(__file__).parent;dst=Path(a.output);dst.mkdir(parents=True,exist_ok=True)
html=(root/'template.html').read_text().replace('__GENERATOR__',(root/'generator.js').read_text()).replace('__VIEWER__',(root/'viewer.js').read_text())
assert '__GENERATOR__' not in html and '__VIEWER__' not in html
raw=html.encode();assert len(raw)<100000
(dst/'index.html').write_bytes(raw)
(dst/'reference.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./index.html"><a href="./index.html">进入三维岩体样板</a></html>')
files=[{'path':n,'bytes':(dst/n).stat().st_size,'sha256':hashlib.sha256((dst/n).read_bytes()).hexdigest()} for n in ['index.html','reference.html']]
build={'version':'B3.1','sourceCommit':a.commit,'sourceBytes':sum(f['bytes'] for f in files),'files':files,'sourceBasis':'three user photos; visible feature interpretation; hidden volume and dimensions authored','coreCommit':'7f5591a56898cd7441a0b95e24025d3a7586376c','lod':False,'textures':False,'originalMeshRuntimeDependency':False,'vegetationInstances':0,'visualApproved':False,'productionReady':False}
(dst/'build.json').write_text(json.dumps(build,ensure_ascii=False,indent=2));print(json.dumps(build,ensure_ascii=False))
