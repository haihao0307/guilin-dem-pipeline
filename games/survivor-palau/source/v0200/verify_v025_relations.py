"""Static/source-relation gate for Stone Money Island V0.2.5."""
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'releases'/'v0.2.5'
html=(OUT/'index.html').read_text(encoding='utf-8')
receipt=json.loads((OUT/'BUILD_RECEIPT.json').read_text(encoding='utf-8'))
required=[
 "stone-money-island-0.2.5-karst-arch",
 "function karstArch(c,outer,hole,depth,pier,col)",
 "b.karstArch([186,archBed+11,144],[29,18],[14.5,10.8],7.5,11",
 "archGeometry:'continuous-eroded-ridge-v025'",
 "archOpening:{span:29,height:21.8,tidalUndercut:true}",
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
 "topCol=[col[0]*.52",
]
present_forbidden=[x for x in forbidden if x in html]
outer_span=58.0;opening_span=29.0;outer_rise=18.0;opening_above_spring=10.8;support=11.0
side_mass=(outer_span-opening_span)/2
roof_mass=outer_rise-opening_above_spring
report={
 'version':'0.2.5','passed':False,'missingRuntimeRelations':missing,'forbiddenBlockArchFragments':present_forbidden,
 'frozenOceanUnchanged':receipt.get('frozenShaderAndWorkerStringsUnchanged'),'stoneMoneyRockIsland':receipt.get('stoneMoneyRockIsland'),'deepTrenchMeters':receipt.get('deepTrenchMeters'),'arch':receipt.get('archLandmark'),
 'archSanity':{'openingSpanM':opening_span,'openingHeightAboveTidalBaseM':support+opening_above_spring,'sideMassAtSpringM':side_mass,'minimumRoofMassM':roof_mass,'openingIsReal':opening_span>0 and opening_above_spring>0,'notPaperThin':side_mass>8 and roof_mass>5},
 'fishMotherIntegrated':receipt.get('fishMotherIntegrated'),'fishMotherReason':receipt.get('fishMotherReason')}
report['passed']=bool(not missing and not present_forbidden and report['frozenOceanUnchanged'] and report['stoneMoneyRockIsland'] and report['deepTrenchMeters']>=150 and report['archSanity']['openingIsReal'] and report['archSanity']['notPaperThin'] and report['fishMotherIntegrated'] is False)
(OUT/'RELATION_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
if not report['passed']: raise SystemExit(1)
