from pathlib import Path
import hashlib,re,json,subprocess
import build_v026
from harden_v027 import apply as harden_v027

HERE=Path(__file__).resolve().parent
base=HERE.parents[1]/'releases/v0.1.6.0/Stone_Money_Island_V0.1.6.0_Direct_Open.html'
assert hashlib.sha256(base.read_bytes()).hexdigest()=='dac1a80440d731488546b317ff8f286c55c8c63d5a2e9f1da3f8c900bbbc4710'
source=HERE.parents[1]/'releases/v0.2.6/index.html'
s=harden_v027(source.read_text())
pattern=r'const __OM_TEXT__=(\{.*?\});\n'
a=re.search(pattern,base.read_text(),re.S);b=re.search(pattern,s,re.S);assert a and b and a.group(1)==b.group(1)
OUT=HERE.parents[1]/'releases/v0.2.7';OUT.mkdir(exist_ok=True,parents=True)
(OUT/'index.html').write_text(s)
for i,script in enumerate(re.findall(r'<script[^>]*>([\s\S]*?)</script>',s)):
 p=OUT/f'.syntax-{i}.mjs';p.write_text(script);subprocess.run(['node','--check',str(p)],check=True);p.unlink()
prev=json.loads((HERE.parents[1]/'releases/v0.2.6/BUILD_RECEIPT.json').read_text())
receipt={
 'version':'0.2.7',
 'sourceBranch':'work/stone-money-island-v0270-arch-mass-20260920',
 'baseCommit':'f2da9110c29e859a0b5c2a9711c5019fa87b530d',
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
   'geometry':'single dissolved mushroom Rock Island with true negative-space main arch and secondary tidal sea cave',
   'fullLandformSpanApproxM':71.2,
   'nominalMainOpeningSpanM':18.6,
   'mainOpeningHeightApproxM':21.5,
   'secondarySeaCaveSpanApproxM':5.7,
   'tidalToCrownWidthRatio':0.46,
   'frontBackDepthApproxM':21.2,
   'tidalWaist':True,
   'openingOffCenter':True,
   'unequalCrownLobes':True,
   'vegetationPockets':7,
   'surveyed':False
 },
 'archChangeReason':'V0.2.6 public screenshot still read as a broad wall/bridge because the tidal body and shrub row were too continuous; V0.2.7 narrows the tidal body, breaks the crown and removes regular vegetation spacing',
 'archReferenceBoundary':prev['archReferenceBoundary'],
 'fishWaterBinding':prev['fishWaterBinding'],
 'fishMotherCheckedHead':'4f271df5aa887808a461a3ff7b2209630934bf79',
 'fishMotherIntegrated':False,
 'fishMotherReason':'No newer Fish R1 branch exists; current R1 source gate still lacks an accepted source-coupled fish body, so replacing the game fish would not be a verified visual improvement',
 'constructedStoneHouseRemoved':True,
 'curlSheetDrawn':False,
 'visualAcceptance':False,
 'physicalDeviceTest':False,
 'publicVerified':False
}
(OUT/'BUILD_RECEIPT.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(receipt,ensure_ascii=False,indent=2))
