"""Static/numerical gate for Stone Money Island V0.2.4."""
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'releases'/'v0.2.4'
html=(OUT/'index.html').read_text(encoding='utf-8')
receipt=json.loads((OUT/'BUILD_RECEIPT.json').read_text(encoding='utf-8'))
required=[
 "physical-bed-water-permission-v024",
 "smoothstep(.008,.028,physicalDepth)",
 "allowed:depth>.008&&q.bed<ceiling",
 "cameraMode==='arch'",
 "id=\"smiArchView\"",
 "camera.eye=[0,190,240]",
 "camera.fov=46*Math.PI/180",
 "camera.eye=[186,34,214]",
 "camera.fov=43*Math.PI/180",
 "b.rock([174,archBed+8,144]",
 "b.rock([176,archBed+20,144]",
 "b.rock([198,archBed+8,144]",
 "b.rock([196,archBed+20,144]",
 "b.rock([181,archBed+27,144]",
 "b.rock([191,archBed+27,144]",
 "b.rock([186,archBed+31,144]",
 "[236,154,13.0,25.0,11.0,1283]",
 "{id:'rai-01',type:'rai',name:'石钱',x:-178,z:104}",
 "trench=-185",
]
missing=[x for x in required if x not in html]
report={
 'version':'0.2.4',
 'passed':not missing and receipt.get('frozenShaderAndWorkerStringsUnchanged') is True and receipt.get('fishMotherIntegrated') is False,
 'missingRuntimeRelations':missing,
 'frozenOceanUnchanged':receipt.get('frozenShaderAndWorkerStringsUnchanged'),
 'fishMotherIntegrated':receipt.get('fishMotherIntegrated'),
 'fishMotherReason':receipt.get('fishMotherReason'),
 'inspectionViews':receipt.get('inspectionViews'),
 'aerialBoundaryPolicy':receipt.get('aerialBoundaryPolicy'),
 'archConstruction':'seven overlapping karst masses with a true open void',
}
(OUT/'RELATION_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
if not report['passed']: raise SystemExit(1)
