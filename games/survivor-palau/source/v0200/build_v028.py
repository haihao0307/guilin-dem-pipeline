from pathlib import Path
import hashlib,re,json,subprocess
import build_v027
from harden_v028 import apply as harden_v028

HERE=Path(__file__).resolve().parent
base=HERE.parents[1]/'releases/v0.1.6.0/Stone_Money_Island_V0.1.6.0_Direct_Open.html'
assert hashlib.sha256(base.read_bytes()).hexdigest()=='dac1a80440d731488546b317ff8f286c55c8c63d5a2e9f1da3f8c900bbbc4710'
source=HERE.parents[1]/'releases/v0.2.7/index.html'
s=harden_v028(source.read_text())
pattern=r'const __OM_TEXT__=(\{.*?\});\n'
a=re.search(pattern,base.read_text(),re.S);b=re.search(pattern,s,re.S);assert a and b and a.group(1)==b.group(1)
OUT=HERE.parents[1]/'releases/v0.2.8';OUT.mkdir(exist_ok=True,parents=True)
(OUT/'index.html').write_text(s)
for i,script in enumerate(re.findall(r'<script[^>]*>([\s\S]*?)</script>',s)):
 p=OUT/f'.syntax-{i}.mjs';p.write_text(script);subprocess.run(['node','--check',str(p)],check=True);p.unlink()
prev=json.loads((HERE.parents[1]/'releases/v0.2.7/BUILD_RECEIPT.json').read_text())
receipt={
 'version':'0.2.8',
 'sourceBranch':'work/stone-money-island-v0280-arch-reveal-20260920',
 'baseCommit':'658f43e38e0a9d66586f6fab0faa1bba01bbcdc1',
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
   'geometry':'single dissolved mushroom Rock Island with enlarged true negative-space main arch and secondary tidal cave',
   'positionXZ':[210,190],
   'fullLandformSpanApproxM':71.2,
   'nominalMainOpeningSpanM':23.94,
   'mainOpeningHeightApproxM':21.0,
   'secondarySeaCaveSpanApproxM':5.7,
   'tidalToCrownWidthRatio':0.46,
   'minimumRoofThicknessApproxM':4.8,
   'frontBackDepthApproxM':21.2,
   'openWaterApproach':True,
   'tidalWaist':True,
   'openingOffCenter':True,
   'unequalCrownLobes':True,
   'vegetationPockets':7,
   'surveyed':False
 },
 'archChangeReason':'V0.2.7 was physically a real arch but the public review view was dominated by foreground Rock Islands; V0.2.8 enlarges the actual void and relocates the same landform into a clear-water approach corridor so the negative space is legible without reverting to an artificial bridge silhouette',
 'archReferenceBoundary':prev['archReferenceBoundary'],
 'fishWaterBinding':prev['fishWaterBinding'],
 'fishMotherCheckedHead':'4f271df5aa887808a461a3ff7b2209630934bf79',
 'fishMotherIntegrated':False,
 'fishMotherReason':'Fish R1 source-gate head is unchanged and still does not provide an accepted source-coupled body demonstrably better than the game fish; no generic-carrier substitution was made',
 'constructedStoneHouseRemoved':True,
 'curlSheetDrawn':False,
 'visualAcceptance':False,
 'physicalDeviceTest':False,
 'publicVerified':False
}
(OUT/'BUILD_RECEIPT.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(receipt,ensure_ascii=False,indent=2))
