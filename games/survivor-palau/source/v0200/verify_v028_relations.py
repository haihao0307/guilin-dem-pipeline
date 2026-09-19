"""Static and numerical gate for Stone Money Island V0.2.8."""
from pathlib import Path
import json,math

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'releases'/'v0.2.8'
html=(OUT/'index.html').read_text(encoding='utf-8')
receipt=json.loads((OUT/'BUILD_RECEIPT.json').read_text(encoding='utf-8'))

main_l=-.18;main_r=.58;cave_l=-.82;cave_r=-.64;half_span=31.5

def ga(u,m,w): return math.exp(-((u-m)/w)**2)
def top(u):
 return 12.5+13.4*ga(u,-.70,.38)+7.3*ga(u,.64,.28)+5.1*ga(u,-.05,.72)-1.6*ga(u,.22,.18)+1.15*math.sin(u*4.5+.7)+.62*math.sin(u*10.7-1.0)+.26*math.sin(u*25.0+.4)
def base(u): return -7.6+.70*math.sin(u*5.1-.3)+.28*math.sin(u*15.0+1.1)
def curve(u,a,b,rise,power,skew):
 mid=(a+b)*.5;half=(b-a)*.5;q=max(-1,min(1,(u-mid)/half));d=max(0,1-q*q)**power
 return 1.0+rise*d*(1+skew*q)+.38*math.sin(u*13.0+.4)*d

def main_hole(u): return curve(u,main_l,main_r,11.6,.56,.20)
inside=[main_l+(main_r-main_l)*i/300 for i in range(301)]
roof=[top(u)-main_hole(u) for u in inside]
mid=(main_l+main_r)*.5
main_span=(main_r-main_l)*half_span
cave_span=(cave_r-cave_l)*half_span
opening_height=main_hole(mid)-min(base(main_l),base(main_r))
# Authored distant Rock Island centres in the live inherited field.
karst=[(-83,34),(76,-53),(112,23),(-119,-71),(38,106),(-178,104),(192,-118),(214,82),(-218,-142),(154,174),(236,154),(255,181),(224,204)]
arch=(96,208)
nearest=min(math.hypot(arch[0]-x,arch[1]-z) for x,z in karst)
required=[
 'stone-money-island-0.2.8-arch-reveal',
 'mainL=-.18,mainR=.58',
 'archCurve(u,mainL,mainR,11.6,.56,.20)',
 "b.dissolvedArch([96,archBed+7.8,208],31.5,10.6",
 "archGeometry:'dissolved-mushroom-rock-island-v028-revealed'",
 'archPosition:[96,208]',
 'nominalMainSpan:23.94',
 'secondarySeaCave:true',
 'physical-bed-water-permission-v024',
 'physicalWater=smoothstep(.008,.028,physicalDepth)',
 "{id:'rai-01',type:'rai',name:'石钱',x:-178,z:104}",
 'trench=-185',
]
forbidden=[
 "b.dissolvedArch([186,archBed+7.8,144],31.5,10.6",
 "b.dissolvedArch([210,archBed+7.8,190],31.5,10.6",
 "archGeometry:'dissolved-mushroom-rock-island-v027'",
]
missing=[x for x in required if x not in html]
present_forbidden=[x for x in forbidden if x in html]
report={
 'version':'0.2.8','passed':False,
 'mainOpeningSpanM':main_span,'secondarySeaCaveSpanM':cave_span,
 'mainOpeningHeightApproxM':opening_height,'minimumRoofThicknessM':min(roof),
 'archPositionXZ':receipt.get('archLandmark',{}).get('positionXZ'),
 'openWaterApproach':receipt.get('archLandmark',{}).get('openWaterApproach'),
 'nearestAuthoredKarstCenterDistanceM':nearest,
 'missingRuntimeRelations':missing,'activePreviousArchRelations':present_forbidden,
 'frozenOceanUnchanged':receipt.get('frozenShaderAndWorkerStringsUnchanged'),
 'stoneMoneyRockIsland':receipt.get('stoneMoneyRockIsland'),
 'deepTrenchMeters':receipt.get('deepTrenchMeters'),
 'fishMotherIntegrated':receipt.get('fishMotherIntegrated'),
}
report['passed']=bool(
 not missing and not present_forbidden
 and 23.5<main_span<24.5 and 5.2<cave_span<6.1
 and opening_height>20 and min(roof)>4.5 and nearest>65
 and report['archPositionXZ']==[96,208] and report['openWaterApproach'] is True
 and report['frozenOceanUnchanged'] is True and report['stoneMoneyRockIsland'] is True
 and report['deepTrenchMeters']==185 and report['fishMotherIntegrated'] is False
)
(OUT/'ARCH_REVEAL_RELATION_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
if not report['passed']: raise SystemExit(1)
