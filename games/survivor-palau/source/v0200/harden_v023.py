"""V0.2.3 fast visual/physical iteration for Stone Money Island.

Applied after V0.2.2.  This patch keeps the byte-locked original Ocean Mother
payload untouched and changes only authored game/island relations requested by
the user: stricter water/beach contact, stone money on a Rock Island, deeper
water, distant island silhouettes, an arch landmark and inspection cameras.
"""


def apply(s: str) -> str:
    def rep(old: str, new: str, count: int = 1) -> None:
        nonlocal s
        actual = s.count(old)
        assert actual == count, (old[:160], actual, count)
        s = s.replace(old, new)

    rep("Stone Money Island — Survivor Palau · V0.2.2",
        "Stone Money Island — Survivor Palau · V0.2.3")
    rep("const VERSION='stone-money-island-0.2.2-physical-beach';",
        "const VERSION='stone-money-island-0.2.3-fast-iteration';")
    rep("第一章 · 岸边求生 V0.2.2", "第一章 · 岸边求生 V0.2.3")

    # Keep the already accepted broad beach, but make the visible swash calmer.
    rep('"key":"runup","label":"贴岸上冲","min":0,"max":1.5,"step":0.05,"value":0.38',
        '"key":"runup","label":"贴岸上冲","min":0,"max":1.5,"step":0.05,"value":0.28')
    rep('"key":"foam","label":"泡沫生成强度","min":0,"max":2,"step":0.05,"value":0.06',
        '"key":"foam","label":"泡沫生成强度","min":0,"max":2,"step":0.05,"value":0.035')
    rep('"key":"shoreFoam","label":"贴岸白沫增强","min":0,"max":2,"step":0.05,"value":0.04',
        '"key":"shoreFoam","label":"贴岸白沫增强","min":0,"max":2,"step":0.05,"value":0.02')

    # Add large, separated Rock Island silhouettes behind the playable island.
    rep(
        "KARST_ROCKS.push([-83,34,9.6,19.0,8.1,911],[76,-53,8.1,15.7,7.0,937],[112,23,7.0,13.2,6.0,953],[-119,-71,10.4,22.0,8.7,977],[38,106,6.8,12.2,5.9,991]);",
        "KARST_ROCKS.push([-83,34,9.6,19.0,8.1,911],[76,-53,8.1,15.7,7.0,937],[112,23,7.0,13.2,6.0,953],[-119,-71,10.4,22.0,8.7,977],[38,106,6.8,12.2,5.9,991],[-178,104,18.0,34.0,14.0,1117],[192,-118,22.0,42.0,18.0,1153],[214,82,17.0,31.0,14.0,1187],[-218,-142,24.0,46.0,19.0,1213],[154,174,15.0,29.0,12.5,1249]);"
    )

    # Localised deep-water trench / blue-hole relation beyond the reef.
    rep(
        "const reef=reefBathymetry(x,z,c);\n  return Math.max(shelf+deep+relief-reef.pit+reef.rim,smiSecondaryBed(x,z));",
        "const reef=reefBathymetry(x,z,c),tx=(x-176)/58,tz=(z+168)/72,trench=-185*Math.exp(-(tx*tx+tz*tz))*smooth(c.shelfWidth*.62,c.shelfWidth*1.30,s);\n  return Math.max(shelf+deep+relief-reef.pit+reef.rim+trench,smiSecondaryBed(x,z));"
    )
    rep(
        "vec2 reef=reefBed(p);return max(shelf+deep+relief-reef.x+reef.y,smiSecondaryBedG(p));",
        "vec2 reef=reefBed(p);vec2 tq=vec2((p.x-176.0)/58.0,(p.y+168.0)/72.0);float trench=-185.0*exp(-dot(tq,tq))*smoothstep(p_shelfWidth*.62,p_shelfWidth*1.30,s);return max(shelf+deep+relief-reef.x+reef.y+trench,smiSecondaryBedG(p));"
    )

    # Re-evaluate water permission per fragment from the same wave and bed
    # functions.  This prevents interpolation across a large water triangle from
    # painting water through dry sand.  A moving run-up head allows a thin
    # swash edge, but no water fragment survives above that physical head.
    rep(
        "float physicalBed=bedH(vWorld.xz),runupCeiling=uSeaLevel+.08+p_runup*.24,physicalWater=1.-smoothstep(runupCeiling-.025,runupCeiling+.025,physicalBed);if(physicalWater<.001)discard;float smiCoastWeight=1.-smoothstep(8.,22.,max(0.,uSeaLevel-physicalBed));if(smiCoastWeight<.001)discard;",
        "float physicalBed=bedH(vWorld.xz),physicalBreaker=0.0,physicalSurface=waveSurface(vWorld.xz,physicalBreaker);float swashNoise=fbm(vWorld.xz*.028+vec2(uTime*.009,-uTime*.007));float swashPulse=.5+.5*sin(uTime*.44-length(vWorld.xz)*.09+swashNoise*3.2);float runupCeiling=uSeaLevel+.018+p_runup*.16*(.18+.82*swashPulse);float physicalDepth=physicalSurface-physicalBed,physicalWater=smoothstep(.003,.020,physicalDepth)*(1.-smoothstep(runupCeiling-.015,runupCeiling+.015,physicalBed));if(physicalWater<.001)discard;float smiCoastWeight=1.-smoothstep(8.,22.,max(0.,uSeaLevel-physicalBed));if(smiCoastWeight<.001)discard;"
    )
    rep("float thickness=vThickness;vec3 refrDir=",
        "float thickness=min(vThickness,max(0.0,physicalDepth));vec3 refrDir=")
    rep(
        "window.StoneMoneyShoreline={shoreAt:(x,z,t=physicalTime)=>shorelineAt(x,z,t,config),physicalWaterAt:(x,z,t=physicalTime)=>{const q=shorelineAt(x,z,t,config),ceiling=q.surface+.08+config.runup*.24;return{...q,runupCeiling:ceiling,allowed:q.bed<ceiling};}};",
        "window.StoneMoneyShoreline={shoreAt:(x,z,t=physicalTime)=>shorelineAt(x,z,t,config),physicalWaterAt:(x,z,t=physicalTime)=>{const q=shorelineAt(x,z,t,config),w=waveAt(x,z,t,config),n=noise2(x*.028+t*.009,z*.028-t*.007,1301),pulse=.5+.5*Math.sin(t*.44-Math.hypot(x,z)*.09+n*3.2),ceiling=q.surface+.018+config.runup*.16*(.18+.82*pulse),depth=w.eta-q.bed;return{...q,waveSurface:w.eta,physicalDepth:depth,runupCeiling:ceiling,allowed:depth>.003&&q.bed<ceiling};}};"
    )
    rep("qa.shoreline='physical-bed-water-permission-v022';",
        "qa.shoreline='physical-bed-water-permission-v023';")

    # Move stone money from the beach to the upper surface of a separated Rock
    # Island.  The object position uses the rendered rock height when available.
    rep("{id:'rai-01',type:'rai',name:'石钱',x:44,z:40}",
        "{id:'rai-01',type:'rai',name:'石钱',x:-178,z:104}")
    rep(
        "function objPos(d){return[d.x,ground(d.x,d.z)+(d.type==='shelter'?.9:d.type==='rai'?1.15:.20),d.z];}",
        "function objPos(d){const terrain=ground(d.x,d.z),rock=host.rock?host.rock(d.x,d.z):-1e9,base=d.type==='rai'?Math.max(terrain,rock):terrain;return[d.x,base+(d.type==='shelter'?.9:d.type==='rai'?1.15:.20),d.z];}"
    )
    rep(
        "note('rai','洞口有一块带孔的大石盘。这里有比我更久远的故事。');",
        "note('rai','远处 Rock Island 的岩面上有一块带孔的大石盘。这里有比我更久远的故事。');"
    )

    # Add a procedural rock arch landmark.  Three irregular rock bodies form an
    # open void; it is world geometry, not a billboard/image.
    rep(
        "function rebuildStatic(){dispose(staticGeo);const b=builder();for(const d of defs){",
        "function rebuildStatic(){dispose(staticGeo);const b=builder();const archBed=Math.max(host.bed(186,144),-8);b.rock([176,archBed+13,144],[4.4,15.5,6.2],[.31,.34,.30]);b.rock([196,archBed+14,144],[4.7,16.8,6.4],[.30,.33,.29]);b.rock([186,archBed+27,144],[14.2,3.8,6.1],[.32,.35,.31]);for(const d of defs){"
    )

    # Add inspection modes that do not move the player.  Aerial shows the whole
    # authored island, deep trench and distant archipelago; Fish view makes the
    # currently water-bound school easy to inspect.
    rep(
        "let s=state(),mode='menu',loaded=null,clock=0,wake=0,toastUntil=0,lastUi=0,lastSave=0,thrust=0,cooldown=0,candidate=null,blocked='',caseEpoch=0;",
        "let s=state(),mode='menu',cameraMode='player',loaded=null,clock=0,wake=0,toastUntil=0,lastUi=0,lastSave=0,thrust=0,cooldown=0,candidate=null,blocked='',caseEpoch=0;"
    )
    rep(
        '<button id="smiBag">背包 0</button><button id="smiMenuButton" aria-label="暂停与菜单">Ⅱ</button>',
        '<button id="smiAerial">全岛</button><button id="smiFishView">鱼群</button><button id="smiBag">背包 0</button><button id="smiMenuButton" aria-label="暂停与菜单">Ⅱ</button>'
    )
    rep(
        "$('smiMenuButton').onclick=()=>{commit();setMode('menu');};$('smiBag').onclick=()=>{updateUi();setMode('journal');};",
        "$('smiAerial').onclick=()=>{cameraMode=cameraMode==='aerial'?'player':'aerial';$('smiAerial').textContent=cameraMode==='aerial'?'返回人物':'全岛';};$('smiFishView').onclick=()=>{cameraMode=cameraMode==='fish'?'player':'fish';$('smiFishView').textContent=cameraMode==='fish'?'返回人物':'鱼群';};$('smiMenuButton').onclick=()=>{commit();setMode('menu');};$('smiBag').onclick=()=>{updateUi();setMode('journal');};"
    )
    rep(
        "function cameraFrame(aspect){if(mode==='menu')return false;const p=s.player,h=ground(p.x,p.z),rise=.40+(p.crouched?.42:1.24)*Math.min(1,wake/2.3);",
        "function cameraFrame(aspect){if(mode==='menu')return false;if(cameraMode==='aerial'){camera.eye=[0,285,330];camera.target=[0,-8,0];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=61*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,90000);return true;}if(cameraMode==='fish'){const f=fish.find(q=>q.submerged&&!s.fish[q.id]);if(f){const w=host.water(f.pos[0],f.pos[2]).eta;camera.eye=[f.pos[0]+8,w+5.2,f.pos[2]+8];camera.target=[f.pos[0],f.pos[1],f.pos[2]];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=48*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.08,60000);return true;}cameraMode='player';}const p=s.player,h=ground(p.x,p.z),rise=.40+(p.crouched?.42:1.24)*Math.min(1,wake/2.3);"
    )
    rep(
        "const api={tick,cameraFrame,drawWorld,drawHand,getState:()=>structuredClone(s),",
        "const api={tick,cameraFrame,drawWorld,drawHand,setCameraMode:m=>{cameraMode=['player','aerial','fish'].includes(m)?m:'player';},getCameraMode:()=>cameraMode,getState:()=>structuredClone(s),"
    )
    rep(
        "source:'object definitions + state + relations; original sea/sky retained',limitations:",
        "cameraMode,source:'object definitions + state + relations; original sea/sky retained',limitations:"
    )

    return s
