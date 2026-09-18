from pathlib import Path
import hashlib,re,json,subprocess
HERE=Path(__file__).resolve().parent
base=HERE.parents[1]/'releases/v0.1.6.0/Stone_Money_Island_V0.1.6.0_Direct_Open.html'
assert hashlib.sha256(base.read_bytes()).hexdigest()=='dac1a80440d731488546b317ff8f286c55c8c63d5a2e9f1da3f8c900bbbc4710'
s=base.read_text()
def replace(a,b):
 global s
 assert s.count(a)==1,(a[:120],s.count(a));s=s.replace(a,b)
replace("const VERSION='stone-money-island-0.1.6.0-original-ocean'","const VERSION='stone-money-island-0.2.0-shore-survival'")
replace('<title>Stone Money Island · V0.1.6.0</title>','<title>Stone Money Island — Survivor Palau · Day 1</title>')
replace('</style>','\n'+(HERE/'chapter.css').read_text()+'\n</style>')
replace('let frozenOcean;','let frozenOcean,survival;')
# Clock adapter only: unchanged original shaders, spectrum and field generator.
replace('const api={qa,prepare,drawSky,drawSea,bindGame,','const api={qa,resetClock:t=>{lastWorldTime=t;seaTime=t;W.reset();W.tick(t);envForce=true;baking=false;},prepare,drawSky,drawSea,bindGame,')
replace('function updateCamera(aspect){','function updateCamera(aspect){if(survival?.cameraFrame(aspect))return;')
replace('initCurl();installUI();installCamera();installCanoeGame();','initCurl();installUI();if(query.has("reference"))installCamera();installCanoeGame();')
replace('if(updateCanoeGame(elapsed))changed=true;','if(!survival&&updateCanoeGame(elapsed))changed=true;\n if(survival){survival.tick(config.paused?0:elapsed,physicalTime);changed=true;opaqueDirty=true;}')
replace('drawSolid(ringGeo,sun);drawSolid(logsGeo,sun);','if(!survival){drawSolid(ringGeo,sun);drawSolid(logsGeo,sun);}')
replace('drawSolid(canoeGeo,sun,canoeModel());}gl.bindFramebuffer','drawSolid(canoeGeo,sun,canoeModel());survival?.drawWorld();}gl.bindFramebuffer')
replace('if(!query.has("reference"))drawMedia();qa.sceneFrames','if(!query.has("reference")){drawMedia();survival?.drawHand();}qa.sceneFrames')
replace('smokeVisible:true,fireEnabled:true','smokeVisible:false,fireEnabled:false')
replace('init().catch(fail);',(HERE/'chapter.js').read_text()+'\ninit().catch(fail);')
# Feet query the actual existing generated ground triangles, not an unrelated surface.
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
pattern=r'const __OM_TEXT__=(\{.*?\});\n'
a=re.search(pattern,base.read_text(),re.S);b=re.search(pattern,s,re.S);assert a and b and a.group(1)==b.group(1)
OUT=HERE.parents[1]/'releases/v0.2.0';OUT.mkdir(exist_ok=True,parents=True)
(OUT/'index.html').write_text(s)
for i,script in enumerate(re.findall(r'<script[^>]*>([\s\S]*?)</script>',s)):
 p=OUT/f'.syntax-{i}.mjs';p.write_text(script);subprocess.run(['node','--check',str(p)],check=True);p.unlink()
receipt={'version':'0.2.0','baseCommit':'9e0780eaff274d5ab606c7c09a99f92bcac045ab','baseSha256':hashlib.sha256(base.read_bytes()).hexdigest(),'entrySha256':hashlib.sha256(s.encode()).hexdigest(),'bytes':len(s.encode()),'frozenShaderAndWorkerStringsUnchanged':True,'visualAcceptance':False,'physicalDeviceTest':False,'publicVerified':False,'gameplay':['on-foot first person','wooden spear craft and geometric fish hit','coconut use','inventory object transitions','cave shelter rest and day counter','patrol LOS candidate and failure','local save','damaged radio inspection only']}
(OUT/'BUILD_RECEIPT.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n');print(json.dumps(receipt,ensure_ascii=False,indent=2))
