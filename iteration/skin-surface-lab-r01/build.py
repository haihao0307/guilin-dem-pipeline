"""Build a scoped surface candidate from the exact published own-project HTML.
No old file, model position, rig, weight, source texture or original skill is changed.
"""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parent
BASE=ROOT.parents[1]/'kaopu-unified-human-workbench/skin-dna-r02-1/preview.html'
OUT=ROOT.parents[1]/'kaopu-unified-human-workbench/skin-surface-lab-r01';OUT.mkdir(parents=True,exist_ok=True)
b=BASE.read_bytes();digest=hashlib.sha256(b).hexdigest()
assert digest=='19609ea6f60e3945e2c3caf9fad7fc6ff5cd2fdb037f7c6f317f87500798e2e3',digest
s=b.decode();anchor='window.__IDENTITY_QA__={model:()=>_e?.model,viewer:()=>Ue,controller:()=>_e};'
assert s.count(anchor)==1
s=s.replace(anchor,'window.__SSG_THREE__=st;'+anchor)
s=s.replace('</head>','<style>'+ (ROOT/'lab.css').read_text()+'</style></head>',1)
s=s.replace('</body>','<script>\n'+(ROOT/'surface-lab.js').read_text()+'\n</script></body>',1)
s=s.replace('<title>SKIN / NATURE R02.1 · 六种肤质 · 总人物独立副本</title>','<title>KAOPU · 皮肤表面实验室 R01</title>',1)
(OUT/'preview.html').write_text(s)
report={'version':'SKIN-SURFACE-LAB-R01','baselineCommit':'7c406b142ac5732c999a87797251e38697b31f17','skillCommit':'853e5f02b8b6e557eaf28f461e49ae495a1b5d07','baselineSHA256':digest,'previewSHA256':hashlib.sha256(s.encode()).hexdigest(),'previewBytes':len(s.encode()),'code':{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in ['build.py','surface-lab.js','lab.css']},'geometryChanged':False,'externalSkinTextures':False,'extraFragmentSamplers':1,'presets':6,'userVisualAccepted':False}
(OUT/'BUILD.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
