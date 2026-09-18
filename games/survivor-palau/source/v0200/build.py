from pathlib import Path
import hashlib,re,json,subprocess
from harden import apply as harden
HERE=Path(__file__).resolve().parent
base=HERE.parents[1]/'releases/v0.1.6.0/Stone_Money_Island_V0.1.6.0_Direct_Open.html'
assert hashlib.sha256(base.read_bytes()).hexdigest()=='dac1a80440d731488546b317ff8f286c55c8c63d5a2e9f1da3f8c900bbbc4710'
s=base.read_text()
def replace(a,b):
 global s
 assert s.count(a)==1,(a[:120],s.count(a));s=s.replace(a,b)
replace("const VERSION='stone-money-island-0.1.6.0-original-ocean'","const VERSION='stone-money-island-0.2.1-wet-fish-retreat'")
replace('<title>Stone Money Island · V0.1.6.0</title>','<title>Stone Money Island — Survivor Palau · Day 1 · 0.2.1</title>')
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
replace('init().catch(fail);',(HERE/'fish_wet_navigation.js').read_text()+'\n'+(HERE/'chapter.js').read_text()+'\ninit().catch(fail);')
code='''
 if(!query.has('reference')){
  const n=QA_MODE?96:(innerWidth<760?150:220),coords=Array.from({length:n+1},(_,i)=>warpedCoord(i/n,DOMAIN.minX,DOMAIN.maxX));
  const interval=v=>{let lo=0,hi=n;while(hi-lo>1){const m=(lo+hi)>>1;if(coords[m]>v)hi=m;else lo=m;}return Math.min(n-1,Math.max(0,lo));};
  const bedNodes=new Float64Array((n+1)*(n+1)),bedKnown=new Uint8Array(bedNodes.length);let bedEpoch=-1;
  function vertexBed(i,j){if(geometryDirty)return bedHeight(coords[i],coords[j]);if(bedEpoch!==qa.geometryRebuilds){bedKnown.fill(0);bedEpoch=qa.geometryRebuilds;}const k=j*(n+1)+i;if(!bedKnown[k]){bedNodes[k]=bedHeight(coords[i],coords[j]);bedKnown[k]=1;}return bedNodes[k];}
  function renderedBed(x,z){const i=interval(x),j=interval(z),x0=coords[i],x1=coords[i+1],z0=coords[j],z1=coords[j+1],u=(x-x0)/(x1-x0),v=(z-z0)/(z1-z0);const a=vertexBed(i,j),b=vertexBed(i+1,j),c=vertexBed(i,j+1),d=vertexBed(i+1,j+1);return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);}
  survival=createSurvivalChapter({gl,canvas,camera,config,ready:()=>qa.ready,bed:renderedBed,rock:(x,z)=>rockField.sample(x,z),water:(x,z)=>waveAt(x,z,physicalTime,config),waterAt:(x,z,t)=>waveAt(x,z,t,config),sun:sunDirection,lookAt:mat4LookAt,perspective:mat4Perspective,stopCanoe:()=>{CANOE_STATE.drive=false;cameraTween=null;},resetTime:()=>lastFrame=performance.now(),setWorldTime:t=>{physicalTime=t;accumulator=0;fieldAccumulator=0;particleAccumulator=0;frozenOcean.resetClock(t);lastFrame=performance.now();},count:n=>{qa.drawCalls++;qa.triangles+=n;}});
  document.body.classList.add('smiGame');qa.chapter='shore-survival';qa.visualAcceptance=false;
 }
'''
replace("document.body.dataset.oceanScene='unified';progress.textContent=",code+"\ndocument.body.dataset.oceanScene='unified';progress.textContent=")
replace('function updateGlassRects(){','function updateGlassRects(){if(survival){glassCount=0;glassDirty=false;return;}')
s=harden(s)
# The existing near/deep water query reads this prepared frame's spectrum.
replace(' if(survival){survival.tick(config.paused?0:elapsed,physicalTime);changed=true;opaqueDirty=true;}\n frozenOcean.prepare(now,physicalTime);',
        ' frozenOcean.prepare(now,physicalTime);\n if(survival){survival.tick(config.paused?0:elapsed,physicalTime);changed=true;opaqueDirty=true;}')
pattern=r'const __OM_TEXT__=(\{.*?\});\n'
a=re.search(pattern,base.read_text(),re.S);b=re.search(pattern,s,re.S);assert a and b and a.group(1)==b.group(1)
OUT=HERE.parents[1]/'releases/v0.2.1';OUT.mkdir(exist_ok=True,parents=True)
(OUT/'index.html').write_text(s)
for i,script in enumerate(re.findall(r'<script[^>]*>([\s\S]*?)</script>',s)):
 p=OUT/f'.syntax-{i}.mjs';p.write_text(script);subprocess.run(['node','--check',str(p)],check=True);p.unlink()
receipt={'version':'0.2.1','gameBaselineCommit':'19960d5d455ca5bb7be66e5ed47ed4b82ecc21bc','baseCommit':'9e0780eaff274d5ab606c7c09a99f92bcac045ab','baseSha256':hashlib.sha256(base.read_bytes()).hexdigest(),'entrySha256':hashlib.sha256(s.encode()).hexdigest(),'bytes':len(s.encode()),'frozenShaderAndWorkerStringsUnchanged':True,'qaChangesGeometry':False,'sharedProjectionNear':.15,'shelterCollision':'conservative authored bounds; not exact curved-rock contact','visualAcceptance':False,'physicalDeviceTest':False,'publicVerified':False,'gameplay':['on-foot first person','wooden spear craft and geometric fish hit','coconut use','inventory object transitions','cave shelter rest and day counter','patrol LOS candidate and failure','local save','damaged radio inspection only']}
(OUT/'BUILD_RECEIPT.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n');print(json.dumps(receipt,ensure_ascii=False,indent=2))
