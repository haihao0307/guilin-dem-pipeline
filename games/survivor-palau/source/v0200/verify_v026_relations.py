"""Static and numerical gates for the screenshot-corrected Stone Money Island V0.2.6."""
from pathlib import Path
import json,math

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'releases/v0.2.6'
html=(OUT/'index.html').read_text(encoding='utf-8')
receipt=json.loads((OUT/'BUILD_RECEIPT.json').read_text(encoding='utf-8'))

open_l=-.15;open_r=.55;half_span=31.5

def top(u):
 return 21.5+8.0*math.exp(-((u+.55)/.58)**2)+6.5*math.exp(-((u-.72)/.34)**2)+1.25*math.sin(u*4.7+.5)+.55*math.sin(u*11.3-1.2)+.28*math.sin(u*24.0+.3)
def base(u):
 return -8.2+.75*math.sin(u*5.4-.2)+.30*math.sin(u*15.7+1.3)
def hole(u):
 mid=(open_l+open_r)*.5;half=(open_r-open_l)*.5;q=max(-1,min(1,(u-mid)/half));d=max(0,1-q*q)**.62;skew=1+.15*q-.05*q*q
 return .9+13.2*d*skew+.55*math.sin(u*10.8+.2)*d+.25*math.sin(u*27.0-.8)*d

inside=[open_l+(open_r-open_l)*i/240 for i in range(241)]
roof=[top(u)-hole(u) for u in inside]
mid=(open_l+open_r)*.5
nominal_span=(open_r-open_l)*half_span
waterline_span=nominal_span*.82
opening_height=hole(mid)-min(base(open_l),base(open_r))
asymmetry=abs(top(-.5)-top(.5))+abs(hole(0)-hole(.4))
required=[
 "stone-money-island-0.2.6-eroded-arch",
 "function islandArch(c,halfSpan,depth,col)",
 "const shrubs=[-1.03,-.91,-.79",
 "b.islandArch([186,archBed+7.5,144],31.5,10.2",
 "offcenter-mushroom-rock-island-v026b",
 "physical-bed-water-permission-v024",
 "{id:'rai-01',type:'rai',name:'石钱',x:-178,z:104}",
 "trench=-185",
]
missing=[x for x in required if x not in html]
report={
 'version':'0.2.6','passed':False,'nominalSectionOpeningSpanM':nominal_span,
 'waterlineOpeningSpanApproxM':waterline_span,'openingHeightApproxM':opening_height,
 'minimumRoofThicknessM':min(roof),'asymmetryMetricM':asymmetry,
 'missingRuntimeRelations':missing,
 'frozenOceanUnchanged':receipt.get('frozenShaderAndWorkerStringsUnchanged'),
 'stoneMoneyRockIsland':receipt.get('stoneMoneyRockIsland'),
 'deepTrenchMeters':receipt.get('deepTrenchMeters'),
 'vegetationCrownClusters':receipt.get('archLandmark',{}).get('vegetationCrownClusters'),
}
report['passed']=bool(
 not missing and 21.5<nominal_span<22.5 and 17.5<waterline_span<18.7
 and opening_height>22 and min(roof)>9 and asymmetry>2.0
 and report['frozenOceanUnchanged'] is True
 and report['stoneMoneyRockIsland'] is True and report['deepTrenchMeters']==185
 and report['vegetationCrownClusters']==14
)
(OUT/'ERODED_ARCH_RELATION_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
if not report['passed']: raise SystemExit(1)
