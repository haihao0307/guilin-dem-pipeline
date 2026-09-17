// A real, frame-driven handline loop. No delayed callbacks can award stale catches.
const FISH={phase:'closed',time:0,progress:0,tension:.18,held:false,catches:0,attempt:0,target:null,gearClock:0};
function fishPhase(phase){FISH.phase=phase;FISH.time=0;FISH.held=false;updateFishHUD();opaqueDirty=true;}
function stopFishing(){fishPhase('closed');if(tackleGeo){disposeGeo(tackleGeo);tackleGeo=null;}document.getElementById('fishCard').hidden=true;}
function chooseFishingTarget(){
 for(const off of [0,.5,-.5,1,-1,2,-2,Math.PI]){const a=CANOE_STATE.yaw+off,x=CANOE_STATE.x+Math.sin(a)*13,z=CANOE_STATE.z+Math.cos(a)*13;let clear=true;for(let i=1;i<=13;i++){const px=mix(CANOE_STATE.x,x,i/13),pz=mix(CANOE_STATE.z,z,i/13);if(rockField.sample(px,pz)>.15||bedHeight(px,pz)>waterLevel(physicalTime)-.1){clear=false;break;}}if(clear&&waterLevel(physicalTime)-bedHeight(x,z)>.65&&rockField.sample(x,z)<0)return{x,z};}
 return null;
}
function beginFishing(){
 const point=chooseFishingTarget();if(!point){$('journeyText').textContent='附近没有足够水深，请先划向开阔水面。';return false;}
 setCanoeDrive(false);$('actionSail').textContent='出海';FISH.target=point;FISH.progress=0;FISH.tension=.18;FISH.attempt++;fishPhase('ready');$('fishCard').hidden=false;
 cameraTween=null;camera.target=[CANOE_STATE.x+(point.x-CANOE_STATE.x)*.34,1.0,CANOE_STATE.z+(point.z-CANOE_STATE.z)*.34];camera.yaw=CANOE_STATE.yaw+Math.PI+.4;camera.pitch=.40;camera.distance=innerWidth<760?25:23;camera.fov=56*Math.PI/180;qa.view='fishing';opaqueDirty=true;return true;
}
function fishingAction(){
 if(config.paused)return;
 if(FISH.phase==='closed'){beginFishing();return;}
 if(['ready','caught','missed','broken'].includes(FISH.phase)){FISH.progress=0;FISH.tension=.18;fishPhase('cast');return;}
 if(FISH.phase==='bite'){fishPhase('reel');return;}
}
function updateFishHUD(){
 const s=FISH.phase,copy={closed:['钓鱼','',''],ready:['抛线','准备抛线','轻触抛线。观察浮标；咬钩时及时提竿。'],cast:['抛线中','鱼线落水','等待浮标稳定。'],waiting:['等待咬钩','静候水面的动静','浮标下沉后，轻触“提竿”。'],bite:['提竿','咬钩了！','现在提竿，不要错过。'],reel:['按住收线','跟着鱼的力道收线','按住收线；张力接近满格时松手，回落后再收。'],caught:['再钓一条','鱼已收进独木舟',`鱼获已收入行囊 · 合计 ${FISH.catches} 条。`],missed:['重新抛线','鱼已经游走','下次在浮标下沉时及时提竿。'],broken:['重新抛线','鱼线失去控制','下次间歇收线，张力过高时松手。']}[s];
 $('actionFish').textContent=copy[0];$('fishTitle').textContent=copy[1];$('fishHelp').textContent=copy[2];$('fishCard').dataset.phase=s;$('fishMeters').hidden=s!=='reel';
 $('catchPct').textContent=Math.round(FISH.progress*100)+'%';$('tensionPct').textContent=Math.round(FISH.tension*100)+'%';$('catchFill').style.width=(FISH.progress*100)+'%';$('tensionFill').style.width=(FISH.tension*100)+'%';
 $('inventoryReadout').textContent=`鱼获 ${FISH.catches} · 烹饪与完整生存系统尚未接入`;
}
function buildTackle(){
 if(!FISH.target||FISH.phase==='closed')return;
 const g=new PalauGeometry(),s=CANOE_STATE,a=s.yaw,dx=Math.sin(a),dz=Math.cos(a),water=waveAt(s.x,s.z,physicalTime,config).eta;
 const root=[s.x+dx,water+.28,s.z+dz],tip=[s.x+dx*3.1,water+2.6,s.z+dz*3.1];g.tube(root,tip,.027,6,6);
 const t=FISH.phase==='ready'?0:FISH.phase==='cast'?smooth(0,1,FISH.time):1,progress=FISH.phase==='caught'?1:FISH.phase==='reel'?FISH.progress:0;
 const land=[mix(s.x+dx*3,FISH.target.x,t)*(1-progress)+tip[0]*progress,0,mix(s.z+dz*3,FISH.target.z,t)*(1-progress)+tip[2]*progress];
 land[1]=waveAt(land[0],land[2],physicalTime,config).eta+.12+(FISH.phase==='cast'?Math.sin(t*Math.PI)*3:0)-(FISH.phase==='bite'?.23:0);
 let p=tip;for(let i=1;i<=12;i++){const f=i/12,q=tip.map((v,k)=>mix(v,land[k],f));q[1]-=Math.sin(f*Math.PI)*.36;g.tube(p,q,.014,10,4);p=q;}
 g.sphere(...land,.085,.14,.085,11,0,5,8);if(FISH.phase==='caught'){g.sphere(s.x,water+.62,s.z,.16,.12,.43,8,31,6,10);const a=g.vertex([s.x,water+.62,s.z-.32],8),b=g.vertex([s.x-.19,water+.62,s.z-.61],8),c=g.vertex([s.x+.19,water+.62,s.z-.61],8);g.tri(a,b,c);g.tri(a,c,b);}if(tackleGeo)disposeGeo(tackleGeo);tackleGeo=g.upload();opaqueDirty=true;
}
function updateFishing(dt){
 if(FISH.phase==='closed'||config.paused)return;
 FISH.time+=dt;FISH.gearClock+=dt;
 if(FISH.phase==='cast'&&FISH.time>=1)fishPhase('waiting');
 else if(FISH.phase==='waiting'&&FISH.time>3.4+(FISH.attempt%3)*.8)fishPhase('bite');
 else if(FISH.phase==='bite'&&FISH.time>2.25)fishPhase('missed');
 else if(FISH.phase==='reel'){
  const surge=.5+.5*Math.sin(physicalTime*2.3+FISH.attempt);
  FISH.tension=clamp(FISH.tension+dt*(FISH.held?.20+.18*surge:-.43),.05,1);
  FISH.progress=clamp(FISH.progress+dt*(FISH.held?.115-.025*surge:-.007),0,1);
  if(FISH.tension>=1||FISH.time>45)fishPhase('broken');
  else if(FISH.progress>=1){FISH.catches++;fishPhase('caught');qa.catchesAwarded=FISH.catches;}
 }
 if(FISH.gearClock>.09){FISH.gearClock=0;buildTackle();updateFishHUD();}
}
function installPalauHUD(){
 const toggleMenu=()=>{$('exploreSheet').hidden=!$('exploreSheet').hidden;$('uiMore').setAttribute('aria-expanded',String(!$('exploreSheet').hidden));};
 $('uiMore').onclick=toggleMenu;$('actionExplore').onclick=toggleMenu;
 $('uiPause').onclick=()=>{$('pause').click();$('uiPause').textContent=config.paused?'▷':'Ⅱ';FISH.held=false;};
 $('uiEngineering').onclick=()=>{$('exploreSheet').hidden=true;$('panelToggle').click();};
 $('actionSail').onclick=()=>{const on=!CANOE_STATE.drive;stopFishing();setCanoeDrive(on);$('actionSail').textContent=on?'停舟':'出海';$('journeyTitle').textContent=on?'ACROSS THE LAGOON':'THE ROCK ISLANDS';$('journeyText').textContent=on?'左侧方向键划行 · 停舟后可在原地钓鱼':'拖动环顾 · 双指缩放 · 从独木舟开始探索';if(!on)setView('overview');};
 $('actionFish').onclick=fishingAction;
 $('actionFish').addEventListener('pointerdown',e=>{if(FISH.phase==='reel'&&!config.paused){FISH.held=true;e.currentTarget.setPointerCapture(e.pointerId);}});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])$('actionFish').addEventListener(event,()=>FISH.held=false);
 $('fishCancel').onclick=()=>{stopFishing();setView('canoe');};
 document.querySelectorAll('[data-palau-view]').forEach(b=>b.onclick=()=>{stopFishing();setCanoeDrive(false);$('actionSail').textContent='出海';$('exploreSheet').hidden=true;setView(b.dataset.palauView);});
 const clear=()=>{FISH.held=false;Object.keys(BOAT_KEYS).forEach(k=>BOAT_KEYS[k]=false);};addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
 window.PalauExperience={version:VERSION,islands:PALAU_ISLES.map(p=>[...p]),fishing:FISH,beginFishing,action:fishingAction,cancelFishing:stopFishing,reef:{sharedCPUAndGPUField:true,cellSizeM:DOMAIN.width/(BED_N-1),surveyTruth:false},landscape:{source:'landscape-mother-v012/build_scene.py@a3511d67',reuse:'periodic angular profile and localized solution channels',palauAdapter:true,acceptedR5SDFImported:false},stoneMoney:{historicalRelation:'Yapese quarrying in Palau',replicaOfSpecificArtifact:false},visualAcceptance:false,productionReady:false};
 updateFishHUD();
}
