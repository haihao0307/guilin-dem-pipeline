"""Static and numerical gates for Stone Money Island V0.2.6."""
from pathlib import Path
import json,math

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'releases/v0.2.6'
html=(OUT/'index.html').read_text(encoding='utf-8')
receipt=json.loads((OUT/'BUILD_RECEIPT.json').read_text(encoding='utf-8'))

open_l=-.53;open_r=.46;half_span=31.5

def top(u):
 return 15.2+5.4*(1-min(1,u*u))+.95*math.sin(u*4.9+.3)+.58*math.sin(u*10.7-1.0)+.24*math.sin(u*23.3+.8)
def base(u):
 return -7.0+.62*math.sin(u*5.8-.4)+.28*math.sin(u*16.1+1.7)
def hole(u):
 mid=(open_l+open_r)*.5;half=(open_r-open_l)*.5;q=max(-1,min(1,(u-mid)/half));d=max(0,1-q*q)**.47;skew=1+.10*q-.035*q*q
 return 2.3+11.9*d*skew+.48*math.sin(u*12.4+.5)*d+.22*math.sin(u*29.0-1.1)*d

inside=[open_l+(open_r-open_l)*i/200 for i in range(201)]
roof=[top(u)-hole(u) for u in inside]
mid=(open_l+open_r)*.5
opening_span=(open_r-open_l)*half_span
opening_height=hole(mid)-min(base(open_l),base(open_r))
asymmetry=abs(top(-.32)-top(.32))+abs(hole(-.25)-hole(.25))
required=[
 "stone-money-island-0.2.6-eroded-arch",
 "function erodedArch(c,halfSpan,depth,col)",
 "const shrubs=[-.99,-.84,-.70",
 "b.erodedArch([186,archBed+8.4,144],31.5,9.4",
 "asymmetric-vegetated-eroded-ridge-v026",
 "physical-bed-water-permission-v024",
 "{id:'rai-01',type:'rai',name:'石钱',x:-178,z:104}",
 "trench=-185",
]
missing=[x for x in required if x not in html]
report={
 'version':'0.2.6','passed':False,'openingSpanM':opening_span,
 'openingHeightApproxM':opening_height,'minimumRoofThicknessM':min(roof),
 'asymmetryMetricM':asymmetry,'missingRuntimeRelations':missing,
 'frozenOceanUnchanged':receipt.get('frozenShaderAndWorkerStringsUnchanged'),
 'stoneMoneyRockIsland':receipt.get('stoneMoneyRockIsland'),
 'deepTrenchMeters':receipt.get('deepTrenchMeters'),
 'vegetationCrownClusters':receipt.get('archLandmark',{}).get('vegetationCrownClusters'),
}
report['passed']=bool(
 not missing and 30.5<opening_span<32 and opening_height>20 and min(roof)>4.5
 and asymmetry>.25 and report['frozenOceanUnchanged'] is True
 and report['stoneMoneyRockIsland'] is True and report['deepTrenchMeters']==185
 and report['vegetationCrownClusters']==13
)
(OUT/'ERODED_ARCH_RELATION_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
if not report['passed']: raise SystemExit(1)
