from pathlib import Path
import hashlib,re,json,subprocess
import build_v025
from harden_v026 import apply as harden_v026
from harden_v026b import apply as harden_v026b

HERE=Path(__file__).resolve().parent
base=HERE.parents[1]/'releases/v0.1.6.0/Stone_Money_Island_V0.1.6.0_Direct_Open.html'
assert hashlib.sha256(base.read_bytes()).hexdigest()=='dac1a80440d731488546b317ff8f286c55c8c63d5a2e9f1da3f8c900bbbc4710'
source=HERE.parents[1]/'releases/v0.2.5/index.html'
s=harden_v026b(harden_v026(source.read_text()))
pattern=r'const __OM_TEXT__=(\{.*?\});\n'
a=re.search(pattern,base.read_text(),re.S);b=re.search(pattern,s,re.S);assert a and b and a.group(1)==b.group(1)
OUT=HERE.parents[1]/'releases/v0.2.6';OUT.mkdir(exist_ok=True,parents=True)
(OUT/'index.html').write_text(s)
for i,script in enumerate(re.findall(r'<script[^>]*>([\s\S]*?)</script>',s)):
 p=OUT/f'.syntax-{i}.mjs';p.write_text(script);subprocess.run(['node','--check',str(p)],check=True);p.unlink()
prev=json.loads((HERE.parents[1]/'releases/v0.2.5/BUILD_RECEIPT.json').read_text())
receipt={
 'version':'0.2.6',
 'sourceBranch':'work/stone-money-island-v0260-eroded-arch-20260920',
 'baseCommit':'9d818edcf1ccac3c090eaf20089938e13761e612',
 'baseOceanSha256':hashlib.sha256(base.read_bytes()).hexdigest(),
 'entrySha256':hashlib.sha256(s.encode()).hexdigest(),
 'bytes':len(s.encode()),
 'frozenShaderAndWorkerStringsUnchanged':True,
 'qaChangesGeometry':False,
 'candidateBeach':prev['candidateBeach'],
 'physicalWaterGate':prev['physicalWaterGate'],
 'stoneMoneyRockIsland':True,
 'deepTrenchMeters':185,
 'inspectionViews':['aerial','arch','fish'],
 'archLandmark':{
   'geometry':'single continuous off-center mushroom Rock Island with true negative-space opening',
   'fullLandformSpanApproxM':73.1,
   'nominalSectionOpeningSpanM':22.05,
   'waterlineOpeningSpanApproxM':18.1,
   'openingHeightApproxM':23.3,
   'minimumRoofThicknessAtOpeningCenterM':10.8,
   'frontBackDepthApproxM':20.4,
   'tidalWaist':True,
   'openingOffCenter':True,
   'vegetationCrownClusters':14,
   'surveyed':False
 },
 'archReferenceBoundary':[
   'UNESCO: Palau Rock Islands are coralline limestone islands shaped by weather, wind and vegetation and often show mushroom-like profiles',
   'Natural Arch and Palau photo references used for morphology only; no mesh, texture or image is embedded in runtime'
 ],
 'fishWaterBinding':prev['fishWaterBinding'],
 'fishMotherIntegrated':False,
 'fishMotherReason':prev['fishMotherReason'],
 'constructedStoneHouseRemoved':True,
 'curlSheetDrawn':False,
 'visualAcceptance':False,
 'physicalDeviceTest':False,
 'publicVerified':False
}
(OUT/'BUILD_RECEIPT.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(receipt,ensure_ascii=False,indent=2))
