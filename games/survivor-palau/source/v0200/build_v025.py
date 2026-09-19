from pathlib import Path
import hashlib,re,json,subprocess,math
from harden import apply as harden
from harden_v022 import apply as harden_v022
from harden_v023 import apply as harden_v023
from harden_v024 import apply as harden_v024
from harden_v025 import apply as harden_v025
HERE=Path(__file__).resolve().parent
base=HERE.parents[1]/'releases/v0.1.6.0/Stone_Money_Island_V0.1.6.0_Direct_Open.html'
assert hashlib.sha256(base.read_bytes()).hexdigest()=='dac1a80440d731488546b317ff8f286c55c8c63d5a2e9f1da3f8c900bbbc4710'
s=base.read_text()
def replace(a,b):
 global s
 assert s.count(a)==1,(a[:120],s.count(a));s=s.replace(a,b)
replace("const VERSION='stone-money-island-0.1.6.0-original-ocean'","const VERSION='stone-money-island-0.2.1-beach-contact'")
replace('<title>Stone Money Island · V0.1.6.0</title>','<title>Stone Money Island — Survivor Palau · V0.2.1</title>')
replace('</style>','\n'+(HERE/'chapter.css').read_text()+'\n</style>')
replace('let frozenOcean;','let frozenOcean,survival;')
replace('const api={qa,prepare,drawSky,drawSea,bindGame,','const api={qa,resetClock:t=>{lastWorldTime=t;seaTime=t;W.reset();W.tick(t);envForce=true;baking=false;},prepare,drawSky,drawSea,bindGame,')
replace('function updateCamera(aspect){','function updateCamera(aspect){if(survival?.cameraFrame(aspect))return;')
replace('initCurl();installUI();installCamera();installCanoeGame();','initCurl();installUI();if(query.has("reference"))installCamera();installCanoeGame();')
replace('if(updateCanoeGame(elapsed))changed=true;','if(!survival&&updateCanoeGame(elapsed))changed=true;\n if(survival){survival.tick(config.paused?0:elapsed,physicalTime);changed=true;opaqueDirty=true;}')
replace('drawSolid(ringGeo,sun);drawSolid(logsGeo,sun);','if(!survival){drawSolid(ringGeo,sun);drawSolid(logsGeo,sun);}')
replace('drawSolid(canoeGeo,sun,canoeModel());}gl.bindFramebuffer','drawSolid(canoeGeo,sun,canoeModel());survival?.drawWorld();}gl.bindFramebuffer')
replace('if(!query.has("reference"))drawMedia();qa.sceneFrames','if(!query.has("reference")){drawMedia();survival?.drawHand();}qa.sceneFrames')
replace('smokeVisible:true,fireEnabled:true','smokeVisible:false,fireEnabled:false')
replace('init().catch(fail);',(HERE/'chapter.js').read_text()+'\ninit().catch(fail);')
code='''
 if(!query.has('reference')){
  const n=QA_MODE?96:(innerWidth<760?150:220),coords=Array.from({length:n+1},(_,i)=>warpedCoord(i/n,DOMAIN.minX,DOMAIN.maxX));
  const interval=v=>{let lo=0,hi=n;while(hi-lo>1){const m=(lo+hi)>>1;if(coords[m]>v)hi=m;else lo=m;}return Math.min(n-1,Math.max(0,lo));};
  function renderedBed(x,z){const i=interval(x),j=interval(z),x0=coords[i],x1=coords[i+1],z0=coords[j],z1=coords[j+1],u=(x-x0)/(x1-x0),v=(z-z0)/(z1-z0);const a=bedHeight(x0,z0),b=bedHeight(x1,z0),c=bedHeight(x0,z1),d=bedHeight(x1,z1);return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);}
  survival=createSurvivalChapter({gl,canvas,camera,config,ready:()=>qa.ready,bed:renderedBed,rock:(x,z)=>rockField.sample(x,z),water:(x,z)=>waveAt(x,z,physicalTime,config),sun:sunDirection,lookAt:mat4LookAt,perspective:mat4Perspective,stopCanoe:()=>{CANOE_STATE.drive=false;cameraTween=null;},resetTime:()=>lastFrame=performance.now(),setWorldTime:t=>{physicalTime=t;accumulator=0;fieldAccumulator=0;particleAccumulator=0;frozenOcean.resetClock(t);lastFrame=performance.now();},count:n=>{qa.drawCalls++;qa.triangles+=n;}});
  document.body.classList.add('smiGame');qa.chapter='shore-survival';qa.visualAcceptance=false;
 }
'''
replace("document.body.dataset.oceanScene='unified';progress.textContent=",code+"\ndocument.body.dataset.oceanScene='unified';progress.textContent=")
replace('function updateGlassRects(){','function updateGlassRects(){if(survival){glassCount=0;glassDirty=false;return;}')
s=harden(s)
s=harden_v022(s)
s=harden_v023(s)
s=harden_v024(s)
s=harden_v025(s)
pattern=r'const __OM_TEXT__=(\{.*?\});\n'
a=re.search(pattern,base.read_text(),re.S);b=re.search(pattern,s,re.S);assert a and b and a.group(1)==b.group(1)
OUT=HERE.parents[1]/'releases/v0.2.5';OUT.mkdir(exist_ok=True,parents=True)
(OUT/'index.html').write_text(s)
for i,script in enumerate(re.findall(r'<script[^>]*>([\s\S]*?)</script>',s)):
 p=OUT/f'.syntax-{i}.mjs';p.write_text(script);subprocess.run(['node','--check',str(p)],check=True);p.unlink()
old_area=math.pi*(27**2-(27-11)**2)
new_area=math.pi*(92**2-(92-50)**2)
receipt={
 'version':'0.2.5',
 'sourceBranch':'work/stone-money-island-v0250-karst-arch-20260920',
 'baseCommit':'f8770b395a1062821174e7f36c93b9ada1857594',
 'baseOceanSha256':hashlib.sha256(base.read_bytes()).hexdigest(),
 'entrySha256':hashlib.sha256(s.encode()).hexdigest(),
 'bytes':len(s.encode()),
 'frozenShaderAndWorkerStringsUnchanged':True,
 'qaChangesGeometry':False,
 'sharedProjectionNear':.15,
 'shorelineQuery':'V0.2.4 fragment and CPU physical water gate preserved; no shoreline regression is permitted',
 'candidateBeach':{'radius':92,'beachWidth':50,'shelfWidth':84,'nominalAreaRatioVsOriginal':new_area/old_area,'regime':'reef-protected lagoon','surveyed':False},
 'physicalWaterGate':'dynamic run-up head plus per-fragment wave/bed depth rejects water on dry beach while retaining lowest-sand lap',
 'stoneMoneyRockIsland':True,
 'deepTrenchMeters':185,
 'inspectionViews':['aerial','arch','fish'],
 'archLandmark':{'geometry':'one continuous parametric limestone arch','outerSpanM':50,'openingSpanM':32,'outerRiseM':15,'openingRiseM':8.6,'tidalSupportHeightM':14,'tidalUndercut':True,'sourceMorphology':'Palau limestone Rock Islands: mushroom/undercut family; arch proportions are authored candidate, not survey'},
 'archReferenceBoundary':['UNESCO Rock Islands Southern Lagoon: limestone islands shaped by weather/wind/vegetation and commonly mushroom-like','Flickr Palau Sea Arch / Natural Arch photographs used only as visual morphology reference; no geometry copied'],
 'fishWaterBinding':'current game fish remain water/bed constrained',
 'fishMotherReviewed':'FISH-R1-T01 source-gate handoff reviewed on work/fish-r1-t01-source-gate-20260919',
 'fishMotherIntegrated':False,
 'fishMotherReason':'The latest Fish Mother task is blocked_missing_native_source_and_reference_bytes; importing its generic R02 carrier would not be a source-coupled visual improvement',
 'constructedStoneHouseRemoved':True,
 'curlSheetDrawn':False,
 'visualAcceptance':False,
 'physicalDeviceTest':False,
 'publicVerified':False
}
(OUT/'BUILD_RECEIPT.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(receipt,ensure_ascii=False,indent=2))
