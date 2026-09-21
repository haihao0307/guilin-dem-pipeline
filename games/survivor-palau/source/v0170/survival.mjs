// Palau V0170 — first playable slice of the pilot-survival story contract.
// Historical prototype and game divergence are documented separately. This module does not
// invent the still-unverified FG-1 raft stowage/release animation.
let survivalGeo=null,surfaceFishGeo=null,surfaceGearGeo=null,pilotGameplayClockMs=performance.now();
const SURVIVAL={
 version:'palau-pilot-survival-r2-v0170',ready:false,day:1,
 story:{date:'1944-11-21',pilot:'Carroll E. McCullah',unit:'VMF-122',aircraft:'Goodyear FG-1 Corsair',bureauNumber:'14053',historicalOutcome:'rapid rescue',gameDivergence:'rescue interrupted; long survival near Airai',minuteByMinuteReenactment:false},
 inventory:{water:2,rations:2,hooks:4,lineSegments:3,bait:5,fishFood:0},
 gear:{goggles:'improvised surface-observation only',snorkel:'short surface tube',woodSpear:'locked-next-stage',freediving:'locked-later-stage',elasticSpear:false,hawaiianSling:false,mechanicalSpeargun:false},
 observation:{active:false,anchorX:0,anchorZ:0,bobY:0,focusX:0,focusZ:0,breath:1,fog:.08,leak:.03,calm:.12,ingress:0,snorkelClearanceM:.2,lowProfile:false,actionDisturbance:0,lastYaw:0,lastPitch:0,geometryClock:0,uiClock:0,behaviorClockMs:0,behaviorDtS:0},
 fishing:{candidate:-1,biteReady:false,castSerial:0,candidateDistanceM:99,baitDepthM:.72,baitVisible:false,hookVisible:false,autoCatch:false},
 fish:[],
 telemetry:{visibleFishCount:0,cameraSurfaceOffsetM:0,snorkelSubmerged:false,fishRespondToMotion:false,lineEndDepthM:0,historyDateResolved:true,behaviorClockIndependent:true,behaviorWallDtCapS:.5,visualAcceptance:false,productionReady:false}
};
function pilot01(v){return Math.max(0,Math.min(1,v))}
function pilotAngleDelta(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b))}
function pilotGameplayElapsed(elapsed){const now=performance.now(),wall=Math.max(0,(now-pilotGameplayClockMs)/1000);pilotGameplayClockMs=now;return Math.max(elapsed,Math.min(.5,wall))}
function pilotNotice(text,seconds=2.4){const el=document.getElementById('pilotNotice');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(pilotNotice.timer);pilotNotice.timer=setTimeout(()=>el.classList.remove('show'),seconds*1000)}
function pilotBox(g,x,y,z,sx,sy,sz,kind=10){
 const k=g.v.length/7,p=[[-sx,-sy,-sz],[sx,-sy,-sz],[sx,sy,-sz],[-sx,sy,-sz],[-sx,-sy,sz],[sx,-sy,sz],[sx,sy,sz],[-sx,sy,sz]];
 p.forEach(q=>g.vertex([x+q[0],y+q[1],z+q[2]],kind));
 for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]){g.tri(k+f[0],k+f[1],k+f[2]);g.tri(k+f[0],k+f[2],k+f[3])}
}
function pilotOrientedEllipsoid(g,c,fx,fz,length,height,width,kind=8,seed=0,lat=5,lon=9){
 const fl=Math.hypot(fx,fz)||1;fx/=fl;fz/=fl;const rx=fz,rz=-fx,b=g.v.length/7;
 g.vertex([c[0],c[1]+height,c[2]],kind);
 for(let j=1;j<lat;j++)for(let i=0;i<lon;i++){
  const t=j/lat*Math.PI,a=i/lon*TAU,rad=Math.sin(t),wob=1+.035*Math.sin(a*3+seed)*rad;
  const side=Math.cos(a)*width*rad*wob,fore=Math.sin(a)*length*rad*wob,up=Math.cos(t)*height;
  g.vertex([c[0]+rx*side+fx*fore,c[1]+up,c[2]+rz*side+fz*fore],kind);
 }
 const end=g.vertex([c[0],c[1]-height,c[2]],kind);
 for(let i=0;i<lon;i++)g.tri(b,b+1+(i+1)%lon,b+1+i);
 for(let j=0;j<lat-2;j++)for(let i=0;i<lon;i++){const a=b+1+j*lon+i,c0=b+1+j*lon+(i+1)%lon;g.tri(a,c0,a+lon);g.tri(c0,c0+lon,a+lon)}
 for(let i=0;i<lon;i++)g.tri(end,b+1+(lat-2)*lon+i,b+1+(lat-2)*lon+(i+1)%lon);
 return{fx,fz,rx,rz};
}
function pilotFishShape(g,f){
 const fx=Math.sin(f.heading),fz=Math.cos(f.heading),kind=f.kind;
 const basis=pilotOrientedEllipsoid(g,[f.x,f.y,f.z],fx,fz,.34*f.size,.13*f.size,.11*f.size,kind,f.seed,5,9);
 const bx=f.x-fx*.29*f.size,bz=f.z-fz*.29*f.size,tx=f.x-fx*.55*f.size,tz=f.z-fz*.55*f.size,k=g.v.length/7;
 g.vertex([bx,f.y,bz],kind);g.vertex([tx,f.y+.18*f.size,tz],kind);g.vertex([tx,f.y-.18*f.size,tz],kind);g.tri(k,k+1,k+2);g.tri(k,k+2,k+1);
 const dk=g.v.length/7;g.vertex([f.x-fx*.04*f.size,f.y+.09*f.size,f.z-fz*.04*f.size],kind);g.vertex([f.x-fx*.18*f.size,f.y+.24*f.size,f.z-fz*.18*f.size],kind);g.vertex([f.x+fx*.14*f.size,f.y+.08*f.size,f.z+fz*.14*f.size],kind);g.tri(dk,dk+1,dk+2);g.tri(dk,dk+2,dk+1);
 g.sphere(f.x+fx*.20*f.size+basis.rx*.08*f.size,f.y+.025*f.size,f.z+fz*.20*f.size+basis.rz*.08*f.size,.021*f.size,.021*f.size,.021*f.size,10,f.seed,4,7);
}
function buildSurvivalProps(){
 const g=new PalauGeometry(),x=8.4,z=5.8,y=bedHeight(x,z)+.28;
 pilotBox(g,x,y+.28,z,.58,.28,.40,10);g.tube([x-.48,y+.56,z-.34],[x+.48,y+.56,z-.34],.035,9,6);
 g.sphere(x+1.02,y+.35,z-.14,.17,.36,.17,11,17,6,10);g.tube([x+1.02,y+.66,z-.14],[x+1.02,y+.83,z-.14],.045,10,6);
 g.tube([x-1.00,y+.14,z+.12],[x-.42,y+.14,z+.12],.12,6,12);g.tube([x-.88,y+.14,z+.12],[x-.55,y+.14,z+.12],.055,10,10);
 g.tube([x+.42,y+.08,z+.82],[x+1.16,y+.09,z+.82],.026,10,6);g.tube([x+1.10,y+.09,z+.82],[x+1.37,y+.09,z+.82],.012,9,6);
 return g.upload();
}
function pilotBaitPoint(){
 if(!FISH.target)return[SURVIVAL.observation.focusX,SURVIVAL.observation.bobY-.85,SURVIVAL.observation.focusZ];
 const w=waveAt(FISH.target.x,FISH.target.z,physicalTime,config).eta,depth=SURVIVAL.fishing.baitDepthM;
 return[FISH.target.x,w-depth,FISH.target.z];
}
function pilotLineEndOffset(t=1){
 if(FISH.phase==='ready'||FISH.phase==='closed')return .12;
 if(FISH.phase==='cast')return mix(.12,-SURVIVAL.fishing.baitDepthM,t);
 return-SURVIVAL.fishing.baitDepthM;
}
function buildSurfaceGear(){
 if(!SURVIVAL.observation.active)return null;
 const o=SURVIVAL.observation,g=new PalauGeometry(),fx=Math.sin(camera.yaw+Math.PI),fz=Math.cos(camera.yaw+Math.PI),rx=fz,rz=-fx;
 const eyeY=o.bobY-.055,ex=o.anchorX,ez=o.anchorZ;
 const left=[ex+fx*.24-rx*.086,eyeY-.025,ez+fz*.24-rz*.086],right=[ex+fx*.24+rx*.086,eyeY-.025,ez+fz*.24+rz*.086];
 pilotOrientedEllipsoid(g,left,fx,fz,.018,.052,.070,10,3,4,8);pilotOrientedEllipsoid(g,right,fx,fz,.018,.052,.070,10,4,4,8);
 g.tube([left[0]+rx*.06,left[1],left[2]+rz*.06],[right[0]-rx*.06,right[1],right[2]-rz*.06],.012,9,6);
 const mouth=[ex+fx*.17+rx*.18,o.bobY-.13,ez+fz*.17+rz*.18],lower=[ex+rx*.34,o.bobY-.12,ez+rz*.34],top=[lower[0],o.bobY+(o.lowProfile ? .015 : .20),lower[2]];
 g.tube(mouth,lower,.018,9,7);g.tube(lower,top,.022,9,7);g.tube(top,[top[0]+fx*.055,top[1]+.035,top[2]+fz*.055],.022,9,7);
 if(FISH.target&&FISH.phase!=='closed'){
  const b=pilotBaitPoint();g.sphere(b[0],b[1],b[2],.090,.047,.045,11,33,5,8);
  const hk=[b[0]+.075,b[1]-.03,b[2]],tip=[b[0]+.095,b[1]-.14,b[2]+.025],curl=[b[0]+.035,b[1]-.18,b[2]+.035];g.tube(hk,tip,.008,10,5);g.tube(tip,curl,.008,10,5);
 }
 return g.upload();
}
function buildSurfaceFish(){
 if(!SURVIVAL.observation.active||!SURVIVAL.fish.length)return null;
 const g=new PalauGeometry();for(const f of SURVIVAL.fish)if(!f.hidden)pilotFishShape(g,f);return g.upload();
}
function pilotSeedFish(cx,cz){
 SURVIVAL.fish.length=0;
 for(let i=0;i<12;i++){const a=i*2.399963+.37*(i%3),r=1.8+(i%5)*.52,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r,w=waveAt(x,z,physicalTime,config).eta;
  SURVIVAL.fish.push({x,z,y:Math.max(bedHeight(x,z)+.38,w-.85-.10*(i%4)),vx:0,vz:0,heading:a+Math.PI*.5,size:.72+.08*(i%4),kind:7+(i%3),seed:71+i*13,interest:0,hidden:false});
 }
 SURVIVAL.telemetry.visibleFishCount=SURVIVAL.fish.length;
}
function pilotDeriveCamera(eye,target){
 const dx=eye[0]-target[0],dy=eye[1]-target[1],dz=eye[2]-target[2],d=Math.max(.7,Math.hypot(dx,dy,dz));
 camera.target=[...target];camera.distance=d;camera.yaw=Math.atan2(dx,dz);camera.pitch=Math.asin(clamp(dy/d,-.94,.94));camera.fov=61*Math.PI/180;camera.dirty=true;
}
function enterSurfaceObservation(point=FISH.target){
 const o=SURVIVAL.observation;if(o.active&&point){o.focusX=point.x;o.focusZ=point.z;o.behaviorClockMs=performance.now();return true}
 setCanoeDrive(false);const side=CANOE_STATE.yaw+Math.PI*.5;o.anchorX=CANOE_STATE.x+Math.sin(side)*2.35;o.anchorZ=CANOE_STATE.z+Math.cos(side)*2.35;o.bobY=waveAt(o.anchorX,o.anchorZ,physicalTime,config).eta;
 const fx=Math.sin(CANOE_STATE.yaw),fz=Math.cos(CANOE_STATE.yaw);o.focusX=point?.x??o.anchorX+fx*7.2;o.focusZ=point?.z??o.anchorZ+fz*7.2;o.active=true;o.lowProfile=false;o.breath=Math.max(o.breath,.72);o.calm=.10;o.actionDisturbance=.45;o.lastYaw=camera.yaw;o.lastPitch=camera.pitch;o.behaviorClockMs=performance.now();o.behaviorDtS=0;
 const focusWater=waveAt(o.focusX,o.focusZ,physicalTime,config).eta,target=[o.focusX,focusWater-.82,o.focusZ],eye=[o.anchorX,o.bobY-.055,o.anchorZ];pilotDeriveCamera(eye,target);pilotSeedFish(o.focusX,o.focusZ);qa.view='surface-observation';opaqueDirty=true;pilotUpdateHUD();return true;
}
function exitSurfaceObservation(restore=false){
 const o=SURVIVAL.observation;o.active=false;o.lowProfile=false;o.actionDisturbance=0;o.behaviorClockMs=0;o.behaviorDtS=0;SURVIVAL.fishing.biteReady=false;if(surfaceFishGeo)disposeGeo(surfaceFishGeo);if(surfaceGearGeo)disposeGeo(surfaceGearGeo);surfaceFishGeo=null;surfaceGearGeo=null;opaqueDirty=true;pilotUpdateHUD();if(restore&&FISH.phase==='closed')setView('canoe');
}
function pilotCanStartFishing(){
 const i=SURVIVAL.inventory;if(i.hooks<=0||i.lineSegments<=0){pilotNotice('鱼钩或线组已耗尽，不能继续抛线。');return false}if(i.bait<=0){pilotNotice('鱼饵已经用完，需要另找可用饵料。');return false}return true;
}
function pilotCanRecast(){return pilotCanStartFishing()}
function pilotResetCandidate(){SURVIVAL.fishing.candidate=FISH.attempt%Math.max(1,SURVIVAL.fish.length);SURVIVAL.fishing.biteReady=false;for(const f of SURVIVAL.fish)f.interest=0}
function pilotOnCast(point){SURVIVAL.inventory.bait--;SURVIVAL.fishing.castSerial++;SURVIVAL.fishing.baitVisible=true;SURVIVAL.fishing.hookVisible=true;pilotResetCandidate();pilotUpdateHUD()}
function pilotOnRecast(){SURVIVAL.inventory.bait--;SURVIVAL.fishing.castSerial++;pilotResetCandidate();pilotUpdateHUD()}
function pilotAfterFishingCamera(point){enterSurfaceObservation(point);pilotNotice('饵钩已放到视野内。保持身体稳定，观察哪条鱼真正吞饵。',3.2)}
function pilotOnLineBroken(){const i=SURVIVAL.inventory;i.hooks=Math.max(0,i.hooks-1);i.lineSegments=Math.max(0,i.lineSegments-1);SURVIVAL.fishing.biteReady=false;pilotNotice('鱼线失控：损失 1 枚鱼钩和 1 组线。',3);pilotUpdateHUD()}
function pilotOnCatch(){SURVIVAL.inventory.fishFood++;SURVIVAL.fishing.biteReady=false;pilotNotice('鱼已收回。它仍需处理和烹饪，不能直接转化为完整生存值。',3);pilotUpdateHUD()}
function pilotFishReadyToBite(){return SURVIVAL.observation.active&&SURVIVAL.fishing.biteReady}
function pilotUpdateFishStep(dt,motion){
 const o=SURVIVAL.observation,b=pilotBaitPoint(),phase=FISH.phase,n=SURVIVAL.fish.length;if(!n)return;
 const candidate=((SURVIVAL.fishing.candidate%n)+n)%n;SURVIVAL.fishing.biteReady=false;
 for(let i=0;i<n;i++){
  const f=SURVIVAL.fish[i],isTarget=i===candidate;let tx,ty,tz,speed=.65+.08*(i%4),angle=f.seed*.17+physicalTime*(.15+.02*(i%3)),radius=2.1+(i%5)*.46;
  const frightened=motion>.80||o.actionDisturbance>.55||o.ingress>.55;
  if(frightened){const dx=f.x-o.anchorX,dz=f.z-o.anchorZ,l=Math.hypot(dx,dz)||1;tx=f.x+dx/l*3.4;tz=f.z+dz/l*3.4;ty=f.y;f.interest=Math.max(0,f.interest-dt*1.25);speed=1.55;SURVIVAL.telemetry.fishRespondToMotion=true}
  else if(isTarget&&phase==='waiting'){
   const canInspect=o.calm>.35&&o.breath>.42&&o.fog<.88;f.interest=pilot01(f.interest+dt*(canInspect?(.115+.18*o.calm):-.22));
   const approach=smooth(.08,.96,f.interest);radius=mix(3.8,.12,approach);angle=f.seed*.21+physicalTime*.13*(1-approach*.82);tx=b[0]+Math.cos(angle)*radius;tz=b[2]+Math.sin(angle)*radius;ty=b[1]+.08*Math.sin(physicalTime*2+f.seed);speed=mix(.80,.28,approach);
   const dist=Math.hypot(f.x-b[0],f.y-b[1],f.z-b[2]);SURVIVAL.fishing.candidateDistanceM=dist;if(f.interest>.93&&dist<.43)SURVIVAL.fishing.biteReady=true;
  }else if(isTarget&&(phase==='bite'||phase==='reel')){
   const pull=phase==='reel'?FISH.progress:0,boatWater=waveAt(CANOE_STATE.x,CANOE_STATE.z,physicalTime,config).eta;tx=mix(b[0],CANOE_STATE.x,pull*.92);tz=mix(b[2],CANOE_STATE.z,pull*.92);ty=mix(b[1],boatWater-.30,pull);speed=.95+pull*.7;f.interest=1;
  }else{
   f.interest=Math.max(0,f.interest-dt*.18);tx=b[0]+Math.cos(angle)*radius;tz=b[2]+Math.sin(angle)*radius;const w=waveAt(tx,tz,physicalTime,config).eta;ty=Math.max(bedHeight(tx,tz)+.38,w-.80-.13*((i+1)%4));
  }
  const dx=tx-f.x,dz=tz-f.z,l=Math.hypot(dx,dz)||1,blend=pilot01(dt*2.7),dvx=dx/l*speed,dvz=dz/l*speed;f.vx=mix(f.vx,dvx,blend);f.vz=mix(f.vz,dvz,blend);f.x+=f.vx*dt;f.z+=f.vz*dt;f.y=mix(f.y,ty,pilot01(dt*2.2));if(Math.hypot(f.vx,f.vz)>.02)f.heading=Math.atan2(f.vx,f.vz);
 }
 SURVIVAL.telemetry.visibleFishCount=n;
}
function pilotUpdateFish(dt,motion){
 let remaining=Math.min(1.25,Math.max(0,dt));
 while(remaining>1e-5){const step=Math.min(.10,remaining);pilotUpdateFishStep(step,motion);remaining-=step;if(SURVIVAL.fishing.biteReady)break}
}
function pilotUpdateObservation(dt,behaviorDt=dt){
 const o=SURVIVAL.observation,w=waveAt(o.anchorX,o.anchorZ,physicalTime,config).eta;o.bobY=mix(o.bobY,w,pilot01(dt*2.0));
 const moveRate=(Math.abs(pilotAngleDelta(camera.yaw,o.lastYaw))+Math.abs(camera.pitch-o.lastPitch))/Math.max(.016,dt);o.lastYaw=camera.yaw;o.lastPitch=camera.pitch;const motion=moveRate*.22+Math.abs(CANOE_STATE.speed)*.8+o.actionDisturbance;o.actionDisturbance=Math.max(0,o.actionDisturbance-behaviorDt*.72);
 const tubeHeight=o.lowProfile ? .015 : .20,crest=waveAt(o.anchorX,o.anchorZ,physicalTime,config).eta;o.snorkelClearanceM=o.bobY+tubeHeight-crest;
 if(o.snorkelClearanceM<0){o.ingress=pilot01(o.ingress+dt*1.9);o.breath=pilot01(o.breath-dt*(.58+o.ingress*.42));o.leak=pilot01(o.leak+dt*.07)}else{o.ingress=pilot01(o.ingress-dt*1.05);o.breath=pilot01(o.breath+dt*.34)}
 o.fog=pilot01(o.fog+dt*(.006+.012*o.leak));o.calm=pilot01(o.calm+behaviorDt*((motion<.30&&o.ingress<.25) ? .18 : -.70));
 const desiredEyeY=o.bobY-.055;camera.target[1]=desiredEyeY-camera.distance*Math.sin(camera.pitch);camera.dirty=true;SURVIVAL.telemetry.cameraSurfaceOffsetM=desiredEyeY-w;SURVIVAL.telemetry.snorkelSubmerged=o.snorkelClearanceM<0;SURVIVAL.telemetry.lineEndDepthM=FISH.target?pilotBaitPoint()[1]-waveAt(FISH.target.x,FISH.target.z,physicalTime,config).eta:0;
 pilotUpdateFish(behaviorDt,motion);return motion;
}
function pilotUpdateHUD(){
 const i=SURVIVAL.inventory,o=SURVIVAL.observation,set=(id,text)=>{const e=document.getElementById(id);if(e)e.textContent=text};
 set('waterCount',`饮水 ${i.water}`);set('rationCount',`口粮 ${i.rations}`);set('hookCount',`鱼钩 ${i.hooks}`);set('lineCount',`线组 ${i.lineSegments}`);set('baitCount',`鱼饵 ${i.bait}`);
 const card=document.getElementById('observeCard'),button=document.getElementById('actionObserve');if(card)card.hidden=!o.active;if(button){button.classList.toggle('active',o.active);button.textContent=o.active?'退出观察':'水面观察'}
 if(!o.active)return;
 const breath=Math.round(o.breath*100),fog=Math.round(o.fog*100),calm=Math.round(o.calm*100);set('breathPct',breath+'%');set('fogPct',fog+'%');set('calmPct',calm+'%');
 for(const [id,v] of [['breathFill',breath],['fogFill',fog],['calmFill',calm]]){const e=document.getElementById(id);if(e)e.style.width=v+'%'}
 const submerged=o.snorkelClearanceM<0;set('observeTitle',submerged?'浪峰盖住管口：停止吸气并恢复姿态':o.fog>.72?'镜片起雾：目标轮廓正在变弱':'脸朝下，保持管口露出水面');
 set('observeHelp',submerged?'先松开贴近观察，等管口离水并排出少量进水。':`目标鱼距饵 ${Math.min(99,SURVIVAL.fishing.candidateDistanceM).toFixed(1)} m · ${o.calm>.55?'动作稳定，鱼在靠近':'减少转头和大幅划水'}`);
 if(FISH.phase==='waiting'){set('fishTitle','直接观察鱼群与饵钩');set('fishHelp',`目标鱼距饵 ${Math.min(99,SURVIVAL.fishing.candidateDistanceM).toFixed(1)} m。看见吞饵后再提线；动作过大，鱼会离开。`)}
 if(FISH.phase==='bite'){set('fishTitle','你看见鱼吞下饵钩');set('fishHelp','现在提线。过早或过晚都会失去这次机会。')}
}
function updatePilotSurvival(dt,behaviorDt=dt){
 if(!SURVIVAL.ready)return false;const o=SURVIVAL.observation;if(!o.active){o.uiClock+=dt;if(o.uiClock>.5){o.uiClock=0;pilotUpdateHUD()}return false}
 o.behaviorDtS=behaviorDt;
 pilotUpdateObservation(dt,o.behaviorDtS);o.geometryClock+=dt;o.uiClock+=dt;let changed=false;
 if(o.geometryClock>.075){o.geometryClock=0;if(surfaceFishGeo)disposeGeo(surfaceFishGeo);if(surfaceGearGeo)disposeGeo(surfaceGearGeo);surfaceFishGeo=buildSurfaceFish();surfaceGearGeo=buildSurfaceGear();opaqueDirty=true;changed=true}
 if(o.uiClock>.10){o.uiClock=0;pilotUpdateHUD()}return changed;
}
function installPilotSurvival(){
 const span=document.querySelector('#palauWordmark span');if(span)span.textContent='1944 · 11月21日 / 第一天';
 const observe=document.getElementById('actionObserve');if(observe)observe.onclick=()=>{if(SURVIVAL.observation.active){if(FISH.phase!=='closed'){pilotNotice('先退出当前钓鱼动作，再离开水面观察。');return}exitSurfaceObservation(true)}else enterSurfaceObservation()};
 const wipe=document.getElementById('wipeLens');if(wipe)wipe.onclick=()=>{const o=SURVIVAL.observation;o.fog=.06;o.leak=Math.max(0,o.leak-.16);o.actionDisturbance=1;pilotNotice('镜片暂时清楚了，但擦拭动作惊动了附近鱼群。',2.8)};
 const brace=document.getElementById('braceObserve');if(brace){const down=e=>{e.preventDefault();SURVIVAL.observation.lowProfile=true;SURVIVAL.observation.actionDisturbance=Math.max(SURVIVAL.observation.actionDisturbance,.30);brace.classList.add('active');brace.setPointerCapture?.(e.pointerId)},up=()=>{SURVIVAL.observation.lowProfile=false;brace.classList.remove('active')};brace.addEventListener('pointerdown',down);for(const t of ['pointerup','pointercancel','lostpointercapture'])brace.addEventListener(t,up)}
 const story=document.getElementById('storySheet'),storyButton=document.getElementById('uiPilotStory'),close=document.getElementById('storyClose');if(storyButton)storyButton.onclick=()=>{story.hidden=false;document.getElementById('exploreSheet').hidden=true};if(close)close.onclick=()=>story.hidden=true;
 const fishButton=document.getElementById('actionFish');if(fishButton)fishButton.addEventListener('click',()=>queueMicrotask(()=>{if(FISH.phase!=='closed'&&!SURVIVAL.observation.active)enterSurfaceObservation(FISH.target)}));
 const cancel=document.getElementById('fishCancel');if(cancel)cancel.addEventListener('click',()=>queueMicrotask(()=>exitSurfaceObservation(false)));
 const sail=document.getElementById('actionSail');if(sail)sail.addEventListener('click',()=>{if(CANOE_STATE.drive&&SURVIVAL.observation.active)exitSurfaceObservation(false)});
 document.querySelectorAll('[data-palau-view]').forEach(b=>b.addEventListener('click',()=>exitSurfaceObservation(false)));
 SURVIVAL.ready=true;window.PalauExperience.survival=SURVIVAL;window.PalauExperience.enterSurfaceObservation=enterSurfaceObservation;window.PalauExperience.exitSurfaceObservation=exitSurfaceObservation;window.PalauExperience.pilotLineEndOffset=pilotLineEndOffset;qa.pilotSurvivalReady=true;qa.visibleFishCount=0;pilotUpdateHUD();
}
