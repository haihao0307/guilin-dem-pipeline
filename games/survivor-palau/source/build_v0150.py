from pathlib import Path
import hashlib
src=Path('games/survivor-palau/releases/v0.1.4.1/Survivor_Palau_V0.1.4.1_Cloud_Restore_Direct_Open.html')
out=Path('games/survivor-palau/releases/v0.1.5.0/Survivor_Palau_V0.1.5.0_Canoe_Control_Direct_Open.html')
s=src.read_text(encoding='utf-8')

def R(a,b,n=1):
    global s
    c=s.count(a)
    if c<n: raise SystemExit(f'marker missing {c}<{n}: {a[:160]!r}')
    s=s.replace(a,b,n)

def I(marker, text):
    global s
    if marker not in s: raise SystemExit(f'insert marker missing: {marker[:160]!r}')
    s=s.replace(marker,text+marker,1)

R('<title>Survivor: Palau | V0.1.4 Cloud Surf Karst Canoe</title>', '<title>Palau Survival | V0.1.5.0 Canoe Control</title>')
R('<b>SURVIVOR: PALAU</b><small>CLOUD RESTORE · SURF · KARST · CANOE / V0.1.4.1</small>', '<b>PALAU SURVIVAL</b><small>PLAYABLE CANOE · SHORE/DEEP TRANSITION / V0.1.5.0</small>')
R('SURVIVOR: PALAU V0.1.4.1 · 云层恢复候选','PALAU SURVIVAL V0.1.5.0 · 独木舟驾驶与浅深水过渡')
R("const VERSION='survivor-palau-0.1.4.1-cloud-restore';", "const VERSION='palau-survival-0.1.5.0-canoe-control';")

CSS='''
/* Palau Survival V0.1.5.0 game-layer controls. World rendering remains Ocean Mother-owned. */
#gameDock{position:fixed;z-index:38;left:20px;bottom:76px;display:flex;align-items:center;gap:9px;padding:7px 10px;max-width:min(620px,calc(100vw - 40px));font-size:10px;letter-spacing:.035em}
#gameDock button{min-height:36px;padding:7px 13px}#canoeTelemetry{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:410px}
#boatPad{position:fixed;z-index:39;inset:auto 18px 84px auto;display:none;grid-template-columns:54px 54px 54px;grid-template-rows:50px 50px;gap:5px;user-select:none;-webkit-user-select:none;touch-action:none}
#boatPad.active{display:grid}#boatPad button{border-radius:18px!important;font-size:18px;min-width:54px;min-height:50px;background:rgba(235,248,250,.56)}
#boatPad [data-boat="forward"]{grid-column:2;grid-row:1}#boatPad [data-boat="left"]{grid-column:1;grid-row:2}#boatPad [data-boat="back"]{grid-column:2;grid-row:2}#boatPad [data-boat="right"]{grid-column:3;grid-row:2}
#boatMission{position:fixed;z-index:38;right:20px;top:158px;width:255px;padding:12px 14px;font-size:10px;line-height:1.5;display:none}#boatMission.active{display:block}#boatMission b{display:block;font-size:11px;letter-spacing:.08em;margin-bottom:4px}
@media(max-width:760px){#gameDock{left:10px;bottom:126px;right:10px;max-width:none}#canoeTelemetry{max-width:calc(100vw - 170px)}#boatPad{right:12px;bottom:172px}#boatMission{top:166px;right:10px;width:210px;background:rgba(236,247,249,.70)}}
'''
I('</style>',CSS)

UI='''
<div id="gameDock" class="glass"><button id="canoeDrive" type="button">驾驶独木舟</button><span id="canoeTelemetry">游戏层待命 · 键盘 W/S/A/D 或方向键 · 手机使用方向键</span></div>
<div id="boatMission" class="glass"><b>任务 01 · 舟行测试</b><span id="boatMissionText">从当前位置驾驶独木舟，验证礁岸浅水与深海之间的连续过渡。</span></div>
<div id="boatPad" aria-label="独木舟触控"><button data-boat="forward">▲</button><button data-boat="left">◀</button><button data-boat="back">▼</button><button data-boat="right">▶</button></div>
'''
I('<div id="loading">',UI)

R("const CANOE_POS=Object.freeze([-58,0,41]);\nconst DEEP_FISH_POS=Object.freeze([-142,0,82]);", "const CANOE_POS=Object.freeze([-58,0,41]);\nconst DEEP_FISH_POS=Object.freeze([-142,0,82]);\nconst CANOE_STATE={x:CANOE_POS[0],z:CANOE_POS[2],yaw:-.58,speed:0,drive:false,depth:0,grounded:false,hit:false,targetDistance:0};")
R('uniform mat4 uView,uProj;\nout vec3 vWorld,vNormal;', 'uniform mat4 uView,uProj,uModel;\nout vec3 vWorld,vNormal;')
R('void main(){vWorld=aPosition;vNormal=aNormal;vKind=aKind;gl_Position=uProj*uView*vec4(aPosition,1.0);}', 'void main(){vec4 wp=uModel*vec4(aPosition,1.0);vWorld=wp.xyz;vNormal=normalize(mat3(uModel)*aNormal);vKind=aKind;gl_Position=uProj*uView*wp;}')
R("solidLoc=locations(gl,solidProgram,[...common,'uView','uProj','uCamera'", "solidLoc=locations(gl,solidProgram,[...common,'uView','uProj','uModel','uCamera'")
R('const data=[],indices=[],cx=CANOE_POS[0],cz=CANOE_POS[2],cy=waterLevel(0,SURFACE)+.28,angle=-.58,co=Math.cos(angle),si=Math.sin(angle),N=40;', 'const data=[],indices=[],cx=0,cz=0,cy=0,angle=0,co=1,si=0,N=40;')
R('canoe:{target:[CANOE_POS[0],waterLevel(physicalTime,config)+.28,CANOE_POS[2]],yaw:2.16,pitch:.43,distance:13},', 'canoe:{target:[CANOE_STATE.x,waterLevel(physicalTime,config)+.28,CANOE_STATE.z],yaw:CANOE_STATE.yaw+Math.PI,pitch:.30,distance:11},')
R('animatedGlassButtons:true,webgl2:false,errors:[]', 'animatedGlassButtons:true,playableCanoeV1:true,shoreDepthGateV1:true,mobileCanoeControlsV1:true,webgl2:false,errors:[]')

GAME='''
const IDENTITY_MAT=new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
const BOAT_KEYS={forward:false,back:false,left:false,right:false};
let canoeMissionReached=false;
function canoeSample(x,z){
 const w=waveAt(x,z,physicalTime,config),rock=(rockField&&rockField.sample)?rockField.sample(x,z):-1e6;
 const solidTop=Math.max(w.bed,Number.isFinite(rock)?rock:-1e6),depth=w.eta-solidTop;
 return {w,rock,solidTop,depth,blocked:solidTop>w.eta-.10};
}
function canoeModel(){
 const w=waveAt(CANOE_STATE.x,CANOE_STATE.z,physicalTime,config),co=Math.cos(CANOE_STATE.yaw),si=Math.sin(CANOE_STATE.yaw),y=w.eta+.28;
 return new Float32Array([co,0,-si,0, 0,1,0,0, si,0,co,0, CANOE_STATE.x,y,CANOE_STATE.z,1]);
}
function boatInput(name,on){if(name in BOAT_KEYS)BOAT_KEYS[name]=!!on;}
function setCanoeDrive(on=!CANOE_STATE.drive){
 CANOE_STATE.drive=!!on;CANOE_STATE.speed*=CANOE_STATE.drive?1:0;
 const dock=document.getElementById('canoeDrive'),pad=document.getElementById('boatPad'),mission=document.getElementById('boatMission');
 if(dock)dock.textContent=CANOE_STATE.drive?'退出驾驶':'驾驶独木舟';if(pad)pad.classList.toggle('active',CANOE_STATE.drive);if(mission)mission.classList.toggle('active',CANOE_STATE.drive);
 if(CANOE_STATE.drive){cameraTween=null;qa.view='canoe-drive';}
 opaqueDirty=true;
}
function updateCanoeGame(dt){
 if(!CANOE_STATE.drive)return false;
 const throttle=(BOAT_KEYS.forward?1:0)-(BOAT_KEYS.back?1:0),steer=(BOAT_KEYS.right?1:0)-(BOAT_KEYS.left?1:0);
 const here=canoeSample(CANOE_STATE.x,CANOE_STATE.z);CANOE_STATE.depth=here.depth;CANOE_STATE.grounded=here.depth<.24;CANOE_STATE.hit=false;
 const shallow=clamp((here.depth-.18)/1.25,0,1),maxForward=mix(.65,4.6,shallow),maxReverse=-mix(.35,1.45,shallow),target=throttle>=0?throttle*maxForward:throttle*Math.abs(maxReverse);
 const response=1-Math.exp(-dt*(throttle?2.6:1.5));CANOE_STATE.speed=mix(CANOE_STATE.speed,target,response);
 if(CANOE_STATE.grounded&&CANOE_STATE.speed>0)CANOE_STATE.speed=Math.min(CANOE_STATE.speed,.22);
 const turnAuthority=.22+.78*clamp(Math.abs(CANOE_STATE.speed)/2.2,0,1);CANOE_STATE.yaw+=steer*1.12*turnAuthority*dt*(CANOE_STATE.speed<-.05?-1:1);
 const nx=CANOE_STATE.x+Math.sin(CANOE_STATE.yaw)*CANOE_STATE.speed*dt,nz=CANOE_STATE.z+Math.cos(CANOE_STATE.yaw)*CANOE_STATE.speed*dt,next=canoeSample(nx,nz);
 if(next.blocked||next.depth<.08){CANOE_STATE.hit=true;CANOE_STATE.speed*=throttle<0?.72:-.08;}else{CANOE_STATE.x=nx;CANOE_STATE.z=nz;CANOE_STATE.depth=next.depth;}
 CANOE_STATE.targetDistance=Math.hypot(CANOE_STATE.x-DEEP_FISH_POS[0],CANOE_STATE.z-DEEP_FISH_POS[2]);
 if(CANOE_STATE.targetDistance<16)canoeMissionReached=true;
 const w=waveAt(CANOE_STATE.x,CANOE_STATE.z,physicalTime,config),followY=w.eta+.66;camera.target=[CANOE_STATE.x,followY,CANOE_STATE.z];camera.yaw=CANOE_STATE.yaw+Math.PI;camera.pitch=.24;camera.distance=10.5;camera.fov=54*Math.PI/180;cameraTween=null;
 qa.canoePosition=[CANOE_STATE.x,CANOE_STATE.z];qa.canoeSpeed=CANOE_STATE.speed;qa.canoeDepthM=CANOE_STATE.depth;qa.canoeGrounded=CANOE_STATE.grounded;qa.canoeHit=CANOE_STATE.hit;qa.canoeDeepTargetReached=canoeMissionReached;
 const telemetry=document.getElementById('canoeTelemetry'),mission=document.getElementById('boatMissionText');
 const zone=CANOE_STATE.grounded?'搁浅/极浅':CANOE_STATE.depth<1.2?'浅水':'深水';if(telemetry)telemetry.textContent=`${zone} · 水深 ${Math.max(0,CANOE_STATE.depth).toFixed(1)} m · 航速 ${Math.abs(CANOE_STATE.speed).toFixed(1)} m/s · 钓点 ${CANOE_STATE.targetDistance.toFixed(0)} m${CANOE_STATE.hit?' · 前方受阻':''}`;
 if(mission)mission.textContent=canoeMissionReached?'已抵达深海钓点范围。舟行接口通过；下一生产段接鱼群、抛线与收线。':'驶向深海钓点，同时验证浅水减速、搁浅和岩体阻挡。';
 opaqueDirty=true;return true;
}
function installCanoeGame(){
 const drive=document.getElementById('canoeDrive');if(drive)drive.addEventListener('click',()=>setCanoeDrive());
 const keyMap={KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
 addEventListener('keydown',e=>{const k=keyMap[e.code];if(k&&CANOE_STATE.drive){e.preventDefault();boatInput(k,true)}});addEventListener('keyup',e=>{const k=keyMap[e.code];if(k){e.preventDefault();boatInput(k,false)}});
 document.querySelectorAll('[data-boat]').forEach(b=>{const k=b.dataset.boat,down=e=>{e.preventDefault();boatInput(k,true)},up=e=>{e.preventDefault();boatInput(k,false)};b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('pointerleave',up)});
 window.PalauSurvivalGame={version:VERSION,state:CANOE_STATE,input:boatInput,setCanoeDrive,teleportCanoe:(x,z,yaw=CANOE_STATE.yaw)=>{CANOE_STATE.x=x;CANOE_STATE.z=z;CANOE_STATE.yaw=yaw;CANOE_STATE.speed=0;opaqueDirty=true;},deepTarget:[...DEEP_FISH_POS]};
}
'''
I('function frame(now){',GAME)
R(' updateCamera(canvas.width/canvas.height);', ' if(updateCanoeGame(elapsed))changed=true;\n updateCamera(canvas.width/canvas.height);')
R('function drawSolid(geo,sun){gl.useProgram(solidProgram);gl.bindVertexArray(geo.vao);setCommon(solidLoc);um4(gl,solidLoc.uView,camera.view);um4(gl,solidLoc.uProj,camera.proj);', 'function drawSolid(geo,sun,model=IDENTITY_MAT){gl.useProgram(solidProgram);gl.bindVertexArray(geo.vao);setCommon(solidLoc);um4(gl,solidLoc.uView,camera.view);um4(gl,solidLoc.uProj,camera.proj);um4(gl,solidLoc.uModel,model);')
R('drawSolid(vegetationGeo,sun);drawSolid(canoeGeo,sun);', 'drawSolid(vegetationGeo,sun);drawSolid(canoeGeo,sun,canoeModel());')
R('initCurl();installUI();installCamera();', 'initCurl();installUI();installCamera();installCanoeGame();')
R("window.__OCEAN_UNIFIED_SCENE__={version:VERSION,buildId:'survivor-palau-v0141-cloud-restore'", "window.__OCEAN_UNIFIED_SCENE__={version:VERSION,buildId:'palau-survival-v0150-canoe-control'")
for marker in ['PalauSurvivalGame','playableCanoeV1:true','uModel','updateCanoeGame(elapsed)','canoeModel()','V0.1.5.0']:
    assert marker in s,marker
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(s,encoding='utf-8')
print(out, len(s.encode()), hashlib.sha256(s.encode()).hexdigest())
