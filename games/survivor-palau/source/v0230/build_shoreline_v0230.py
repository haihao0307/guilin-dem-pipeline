from pathlib import Path
import hashlib,json,re,subprocess,shutil

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
BASE=ROOT/'releases/v0.2.2/index.html'
OUT=ROOT/'releases/v0.2.3.0'
BASE_SHA='d37d6fcbbb89184f3a4db40bff3a3a06fb3fb45d15c0c738b4bec8a47e099505'
assert hashlib.sha256(BASE.read_bytes()).hexdigest()==BASE_SHA
s=BASE.read_text(encoding='utf-8')

def replace_once(a,b):
    global s
    count=s.count(a)
    assert count==1,(a[:140],count)
    s=s.replace(a,b,1)

replace_once("const VERSION='stone-money-island-0.2.2-shared-reef-reference'","const VERSION='stone-money-island-0.2.3.0-wake-bay-shoreline-r01'")
replace_once('<title>Stone Money Island — Survivor Palau · Day 1 · 0.2.2</title>','<title>Stone Money Island — Survivor Palau · Day 1 · 0.2.3.0</title>')
replace_once("version:'0.2.2'","version:'0.2.3.0'")

core=(HERE/'shoreline_profile.cjs').read_text(encoding='utf-8')
runtime=core+r'''
// BEGIN SMI_WAKE_BAY_R01 runtime coupling.
// The inherited Ocean sea/cloud/shader text remains byte-stable. Only the game terrain/contact field is replaced in the bounded bay.
const __SMI_LEGACY_BED_HEIGHT=bedHeight;
bedHeight=function(x,z){
 return StoneMoneyShorelineCore.bedAt(x,z,__SMI_LEGACY_BED_HEIGHT,theta=>islandRadius(theta,SURFACE));
};
function stoneMoneyShoreAt(x,z,time=physicalTime){
 const level=waterLevel(time,SURFACE);
 return StoneMoneyShorelineCore.shoreAt(x,z,__SMI_LEGACY_BED_HEIGHT,theta=>islandRadius(theta,SURFACE),level);
}
globalThis.StoneMoneyShoreline=Object.freeze({
 version:'SMI_WAKE_BAY_R01',
 bedAt:(x,z)=>bedHeight(x,z),
 shoreAt:stoneMoneyShoreAt,
 profileElevation:StoneMoneyShorelineCore.profileElevation,
 waterlineSignedDistance:StoneMoneyShorelineCore.waterlineSignedDistance,
 evidenceClass:'candidate-dimensions / shared-render-contact-relationship'
});
qa.authoritativeShorelineProfileV1=true;
qa.shorelineProfileId='SMI_WAKE_BAY_R01';
qa.shorelineRenderContactShared=true;
qa.shorelineGpuOceanBathymetryCoupled=false;
// END SMI_WAKE_BAY_R01 runtime coupling.
'''
replace_once('init().catch(fail);',runtime+'\ninit().catch(fail);')

# Frozen original Ocean shader/worker payload is an explicit invariant.
pattern=r'const __OM_TEXT__=(\{.*?\});\n'
a=re.search(pattern,BASE.read_text(encoding='utf-8'),re.S)
b=re.search(pattern,s,re.S)
assert a and b and a.group(1)==b.group(1)

OUT.mkdir(parents=True,exist_ok=True)
entry=OUT/'index.html'
entry.write_text(s,encoding='utf-8')
for i,script in enumerate(re.findall(r'<script[^>]*>([\s\S]*?)</script>',s)):
    p=OUT/f'.syntax-{i}.mjs'
    p.write_text(script,encoding='utf-8')
    subprocess.run(['node','--check',str(p)],check=True)
    p.unlink()

qa=json.loads(subprocess.check_output(['node',str(HERE/'shoreline_profile.test.cjs')],text=True,cwd=str(HERE)))
(OUT/'SHORELINE_NUMERICAL_QA.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
shutil.copyfile(HERE/'KNOWN_LIMITATIONS.md',OUT/'KNOWN_LIMITATIONS.md')
receipt={
 'version':'0.2.3.0',
 'profileId':'SMI_WAKE_BAY_R01',
 'baseRelease':'0.2.2',
 'baseSha256':BASE_SHA,
 'entrySha256':hashlib.sha256(entry.read_bytes()).hexdigest(),
 'bytes':entry.stat().st_size,
 'frozenOceanTextUnchanged':True,
 'renderTerrainUsesProfile':True,
 'playerContactUsesSameRenderedBed':True,
 'cpuWaterQueryUsesProfile':True,
 'gpuOceanInternalBathymetryUnchanged':True,
 'lodIntroduced':False,
 'replacementMeshIntroduced':False,
 'persistentImageAssetsAdded':0,
 'numericalQaPassed':bool(qa.get('passed')),
 'visualAcceptance':False,
 'physicalDeviceTest':False,
 'productionReady':False
}
(OUT/'BUILD_RECEIPT.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(receipt,ensure_ascii=False,indent=2))
