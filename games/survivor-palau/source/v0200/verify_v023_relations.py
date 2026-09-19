"""Static/numerical gate for V0.2.3 rapid iteration."""
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/"releases"/"v0.2.3"
html=(OUT/"index.html").read_text(encoding="utf-8")
receipt=json.loads((OUT/"BUILD_RECEIPT.json").read_text(encoding="utf-8"))

required=[
 "physical-bed-water-permission-v023",
 "physicalSurface=waveSurface(vWorld.xz,physicalBreaker)",
 "physicalDepth=physicalSurface-physicalBed",
 "runupCeiling=uSeaLevel+.018+p_runup*.16",
 "KARST_ROCKS.push([-83,34",
 "[-178,104,18.0,34.0,14.0,1117]",
 "trench=-185",
 "archBed=Math.max(host.bed(186,144),-8)",
 "{id:'rai-01',type:'rai',name:'石钱',x:-178,z:104}",
 "cameraMode='player'",
 "id=\"smiAerial\"",
 "id=\"smiFishView\"",
]
missing=[x for x in required if x not in html]
report={
 "version":"0.2.3",
 "passed":not missing and receipt.get("frozenShaderAndWorkerStringsUnchanged") is True,
 "missingRuntimeRelations":missing,
 "frozenOceanUnchanged":receipt.get("frozenShaderAndWorkerStringsUnchanged"),
 "stoneMoneyRockIsland":receipt.get("stoneMoneyRockIsland"),
 "archLandmark":receipt.get("archLandmark"),
 "deepTrenchMeters":receipt.get("deepTrenchMeters"),
 "inspectionViews":receipt.get("inspectionViews"),
}
(OUT/"RAPID_RELATION_QA.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps(report,ensure_ascii=False,indent=2))
if not report["passed"]: raise SystemExit(1)
