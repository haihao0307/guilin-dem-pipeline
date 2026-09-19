"""Static/source-relation gate for Stone Money Island V0.2.5."""
from pathlib import Path
import json,math

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'releases'/'v0.2.5'
html=(OUT/'index.html').read_text(encoding='utf-8')
receipt=json.loads((OUT/'BUILD_RECEIPT.json').read_text(encoding='utf-8'))
required=[
 "stone-money-island-0.2.5-karst-arch",
 "function karstArch(c,outer,hole,depth,pier,col)",
 "b.karstArch([186,archBed+14,144],[25,15],[16,8.6],6.8,14",
 "archGeometry:'continuous-parametric-karst-v025'",
 "archOpening:{span:32,height:22.6,tidalUndercut:true}",
 "physical-bed-water-permission-v024",
 "physicalSurface=waveSurface(vWorld.xz,physicalBreaker)",
 "physicalWater=smoothstep(.008,.028,physicalDepth)",
 "{id:'rai-01',type:'rai',name:'石钱',x:-178,z:104}",
 "trench=-185",
]
missing=[x for x in required if x not in html]
forbidden=[
 "b.rock([174,archBed+8,144]",
 "b.rock([198,archBed+8,144]",
 "b.rock([186,archBed+31,144]",
]
present_forbidden=[x for x in forbidden if x in html]
# A simple geometric sanity check for the authored arch recipe.  It does not
# claim survey truth; it rejects an accidentally closed or paper-thin opening.
outer_span=50.0;opening_span=32.0;outer_rise=15.0;opening_rise=8.6
ring_thickness_x=(outer_span-opening_span)/2
roof_thickness=outer_rise-opening_rise
report={
 'version':'0.2.5',
 'passed':False,
 'missingRuntimeRelations':missing,
 'forbiddenBlockArchFragments':present_forbidden,
 'frozenOceanUnchanged':receipt.get('frozenShaderAndWorkerStringsUnchanged'),
 'stoneMoneyRockIsland':receipt.get('stoneMoneyRockIsland'),
 'deepTrenchMeters':receipt.get('deepTrenchMeters'),
 'arch':receipt.get('archLandmark'),
 'archSanity':{
   'openingSpanM':opening_span,
   'openingRiseAboveSpringM':opening_rise,
   'sideThicknessAtSpringM':ring_thickness_x,
   'roofThicknessM':roof_thickness,
   'openingIsReal':opening_span>0 and opening_rise>0,
   'notPaperThin':ring_thickness_x>3 and roof_thickness>3,
 },
 'fishMotherIntegrated':receipt.get('fishMotherIntegrated'),
 'fishMotherReason':receipt.get('fishMotherReason'),
}
report['passed']=bool(not missing and not present_forbidden and report['frozenOceanUnchanged'] and report['stoneMoneyRockIsland'] and report['deepTrenchMeters']>=150 and report['archSanity']['openingIsReal'] and report['archSanity']['notPaperThin'] and report['fishMotherIntegrated'] is False)
(OUT/'RELATION_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
if not report['passed']: raise SystemExit(1)
