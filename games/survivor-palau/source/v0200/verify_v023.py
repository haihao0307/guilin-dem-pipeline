from pathlib import Path
import hashlib,json,math,re

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OUT=ROOT/'releases/v0.2.3'
ENTRY=OUT/'index.html'
BASE=ROOT/'releases/v0.1.6.0/Stone_Money_Island_V0.1.6.0_Direct_Open.html'
s=ENTRY.read_text()
base=BASE.read_text()

checks={
 'version':"stone-money-island-0.2.3-arch-flyview" in s,
 'beachScale':all(x in s for x in ['"value":92','"value":50','"value":84']),
 'runupTightened':'"key":"runup","label":"贴岸上冲","min":0,"max":1.5,"step":0.05,"value":0.18' in s,
 'physicalClearanceGate':'localSurface-physicalBed' in s and 'capped-bed' in s,
 'stoneMoneyOnRock':"{id:'rai-01',type:'rai',name:'石钱',x:112,z:23}" in s and "Math.max(groundY,host.rock(d.x,d.z))" in s,
 'archBodies':all(x in s for x in ['1163','1181','1201','seed>=1200?7.0']),
 'deepTrench':all(x in s for x in ['(x+168)/42','(z+132)/70','34*Math.exp','34.0*exp']),
 'aerialView':all(x in s for x in ['id="smiAerial"','camera.eye=[0,330,360]','isAerial:()=>aerial']),
 'fishMotherMethod':all(x in s for x in ["ocean-life-mother-r02-fixed-chain-method","length:9","drawFishActor(f)"]),
 'constructedHouseAbsent':'const slabs=[];' in s and "id:'roof'" not in s,
 'curlSheetNotDrawn':'if(!query.has("reference")){drawWater(sun)}' in s,
}

pattern=r'const __OM_TEXT__=(\{.*?\});\n'
a=re.search(pattern,base,re.S);b=re.search(pattern,s,re.S)
checks['frozenOceanUnchanged']=bool(a and b and a.group(1)==b.group(1))

old_area=math.pi*(27**2-(27-11)**2)
new_area=math.pi*(92**2-(92-50)**2)
ratio=new_area/old_area
checks['beachAreaOverTen']=ratio>=10

report={
 'version':'0.2.3',
 'passed':all(checks.values()),
 'checks':checks,
 'nominalBeachAreaRatioVsOriginal':ratio,
 'stoneMoneyRockIslandXZ':[112,23],
 'archCenter':[184.5,-70],
 'deepTrenchProbeXZ':[-168,-132],
 'deepTrenchAdditionalDepthM':34,
 'fishBoneSegments':9,
 'fishSource':'apps/ocean-life-mother/r02/runtime-r02.js@11970757e0233f31446ed399257de1dd4bdf1c00',
 'entrySha256':hashlib.sha256(ENTRY.read_bytes()).hexdigest(),
 'visualAcceptance':False,
 'physicalDeviceTest':False,
}
(OUT/'WORLD_RELATION_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
if not report['passed']:
 raise SystemExit(1)
