"""V0.2.3 rapid world iteration.

Applied after V0.2.2.  This patch keeps the byte-locked Ocean Mother payload
unchanged and only edits the authored Stone Money Island world/game adapter.
"""


def apply(s: str) -> str:
    def rep(old: str, new: str, count: int = 1) -> None:
        nonlocal s
        actual = s.count(old)
        assert actual == count, (old[:180], actual, count)
        s = s.replace(old, new)

    # Honest build identity.
    rep("Stone Money Island — Survivor Palau · V0.2.2", "Stone Money Island — Survivor Palau · V0.2.3")
    rep("const VERSION='stone-money-island-0.2.2-physical-beach';", "const VERSION='stone-money-island-0.2.3-arch-flyview';")
    rep("第一章 · 岸边求生 V0.2.2", "第一章 · 岸边求生 V0.2.3")
    rep("version:'0.2.0'", "version:'0.2.3'")

    # One more physical tightening pass.  The dynamic surface is capped by the
    # local run-up ceiling and must still stand above the actual bed.  This
    # rejects interpolated water triangles that previously crossed dry sand.
    rep('"key":"runup","label":"贴岸上冲","min":0,"max":1.5,"step":0.05,"value":0.38',
        '"key":"runup","label":"贴岸上冲","min":0,"max":1.5,"step":0.05,"value":0.18')
    rep(
        "float runupCeiling=uSeaLevel+.08+p_runup*.24,br=0.0,raw=waveSurface(p,br),permission=1.0-smoothstep(runupCeiling-.03,runupCeiling+.03,bed),y=mix(bed-.02,raw,permission),e=.17,bx=0.0,bz=0.0;vec2 px=p+vec2(e,0.0),pz=p+vec2(0.0,e);float bedX=bedH(px),bedZ=bedH(pz),rawX=waveSurface(px,bx),rawZ=waveSurface(pz,bz),permX=1.0-smoothstep(runupCeiling-.03,runupCeiling+.03,bedX),permZ=1.0-smoothstep(runupCeiling-.03,runupCeiling+.03,bedZ),yx=mix(bedX-.02,rawX,permX),yz=mix(bedZ-.02,rawZ,permZ);",
        "float runupCeiling=uSeaLevel+.025+p_runup*.10,br=0.0,raw=waveSurface(p,br),capped=min(raw,runupCeiling),permission=smoothstep(.012,.045,capped-bed),y=mix(bed-.08,capped,permission),e=.17,bx=0.0,bz=0.0;vec2 px=p+vec2(e,0.0),pz=p+vec2(0.0,e);float bedX=bedH(px),bedZ=bedH(pz),rawX=waveSurface(px,bx),rawZ=waveSurface(pz,bz),capX=min(rawX,runupCeiling),capZ=min(rawZ,runupCeiling),permX=smoothstep(.012,.045,capX-bedX),permZ=smoothstep(.012,.045,capZ-bedZ),yx=mix(bedX-.08,capX,permX),yz=mix(bedZ-.08,capZ,permZ);",
    )
    rep(
        "float physicalBed=bedH(vWorld.xz),runupCeiling=uSeaLevel+.08+p_runup*.24,physicalWater=1.-smoothstep(runupCeiling-.025,runupCeiling+.025,physicalBed);if(physicalWater<.001)discard;",
        "float physicalBed=bedH(vWorld.xz),runupCeiling=uSeaLevel+.025+p_runup*.10,localBreaker=0.,localSurface=min(waveSurface(vWorld.xz,localBreaker),runupCeiling),physicalWater=smoothstep(.012,.045,localSurface-physicalBed);if(physicalWater<.01)discard;",
    )
    rep(
        "float swashNoise=fbm(p*.028+vec2(uTime*.009,-uTime*.007));eta+=p_runup*.065*sin(uTime*.44-r*.09+swashNoise*3.2)*exp(-s*s/55.0);eta+=shallow*wet*.045*p_swell*sin(uTime*.57-r*.075+swashNoise*4.0);",
        "float swashNoise=fbm(p*.028+vec2(uTime*.009,-uTime*.007));eta+=p_runup*.035*sin(uTime*.39-r*.075+swashNoise*3.2)*exp(-s*s/72.0);eta+=shallow*wet*.025*p_swell*sin(uTime*.51-r*.062+swashNoise*4.0);",
    )
    rep(
        "const swashNoise=noise2(x*.028+time*.009,z*.028-time*.007,1301),run=c.runup*.065*Math.sin(time*.44-r*.09+swashNoise*3.2)*Math.exp(-s*s/55)+shallow*wet*.045*c.swell*Math.sin(time*.57-r*.075+swashNoise*4.0);",
        "const swashNoise=noise2(x*.028+time*.009,z*.028-time*.007,1301),run=c.runup*.035*Math.sin(time*.39-r*.075+swashNoise*3.2)*Math.exp(-s*s/72)+shallow*wet*.025*c.swell*Math.sin(time*.51-r*.062+swashNoise*4.0);",
    )

    # Add a true deep channel outside the reef shelf.  It is an authored game
    # trench candidate, not survey bathymetry.
    rep(
        "const reef=reefBathymetry(x,z,c);\n  return Math.max(shelf+deep+relief-reef.pit+reef.rim,smiSecondaryBed(x,z));",
        "const reef=reefBathymetry(x,z,c),trench=34*Math.exp(-Math.pow((x+168)/42,2)-Math.pow((z+132)/70,2))*smooth(35,125,s);\n  return Math.max(shelf+deep+relief-reef.pit+reef.rim-trench,smiSecondaryBed(x,z));",
    )
    rep(
        "vec2 reef=reefBed(p);return max(shelf+deep+relief-reef.x+reef.y,smiSecondaryBedG(p));",
        "vec2 reef=reefBed(p);float trench=34.0*exp(-pow((p.x+168.0)/42.0,2.0)-pow((p.y+132.0)/70.0,2.0))*smoothstep(35.0,125.0,s);return max(shelf+deep+relief-reef.x+reef.y-trench,smiSecondaryBedG(p));",
    )

    # Enrich the distant Rock Island forest and add a readable natural-arch
    # silhouette.  The arch is three coupled limestone bodies with an open
    # void; the elevated bridge body uses a reserved seed range.
    rep(
        "KARST_ROCKS.push([-83,34,9.6,19.0,8.1,911],[76,-53,8.1,15.7,7.0,937],[112,23,7.0,13.2,6.0,953],[-119,-71,10.4,22.0,8.7,977],[38,106,6.8,12.2,5.9,991]);",
        "KARST_ROCKS.push([-83,34,9.6,19.0,8.1,911],[76,-53,8.1,15.7,7.0,937],[112,23,7.0,13.2,6.0,953],[-119,-71,10.4,22.0,8.7,977],[38,106,6.8,12.2,5.9,991],[-182,118,19.5,38.0,16.5,1007],[177,142,17.5,34.0,15.0,1031],[-202,-128,23.0,46.0,19.0,1057],[148,-184,17.0,32.0,14.0,1087],[220,45,14.5,29.0,12.5,1103],[-221,25,18.0,36.0,15.0,1129],[176,-72,8.5,25.0,7.5,1163],[193,-68,8.5,24.0,7.5,1181],[184.5,-70,18.0,3.2,7.5,1201]);",
    )
    rep(
        "cy=(isKarst&&Math.hypot(cx,cz)>60?0:bedHeight(cx,cz))+sy*(isKarst?.45:(.72-SURFACE.rockEmbed)),lat=32",
        "cy=(isKarst&&Math.hypot(cx,cz)>60?0:bedHeight(cx,cz))+sy*(seed>=1200?7.0:(isKarst?.45:(.72-SURFACE.rockEmbed))),lat=32",
    )

    # Stone money now sits on the actual compiled Rock Island surface instead
    # of the beach.  Its visible and interaction height use the same rock query.
    rep("{id:'rai-01',type:'rai',name:'石钱',x:44,z:40}",
        "{id:'rai-01',type:'rai',name:'石钱',x:112,z:23}")
    rep(
        "function objPos(d){return[d.x,ground(d.x,d.z)+(d.type==='shelter'?.9:d.type==='rai'?1.15:.20),d.z];}",
        "function objPos(d){const groundY=ground(d.x,d.z),base=d.type==='rai'?Math.max(groundY,host.rock(d.x,d.z)):groundY;return[d.x,base+(d.type==='shelter'?.9:d.type==='rai'?1.15:.20),d.z];}",
    )
    rep("note('rai','洞口有一块带孔的大石盘。这里有比我更久远的故事。');",
        "note('rai','Rock Island 的岩台上立着一块带孔石钱。这里有比我更久远的故事。');")

    # Fixed high aerial review view.  This is deliberately available inside the
    # playable HUD because the player cannot free-fly in the survival chapter.
    rep("let s=state(),mode='menu',loaded=null", "let s=state(),mode='menu',aerial=false,loaded=null")
    rep("function start(resume=false){s=resume&&loaded?structuredClone(loaded):state();caseEpoch++;",
        "function start(resume=false){s=resume&&loaded?structuredClone(loaded):state();aerial=false;caseEpoch++;")
    rep('<button id="smiBag">背包 0</button><button id="smiMenuButton" aria-label="暂停与菜单">Ⅱ</button>',
        '<button id="smiBag">背包 0</button><button id="smiAerial">俯瞰全岛</button><button id="smiMenuButton" aria-label="暂停与菜单">Ⅱ</button>')
    rep(
        "$('smiMenuButton').onclick=()=>{commit();setMode('menu');};$('smiBag').onclick=()=>{updateUi();setMode('journal');};",
        "$('smiMenuButton').onclick=()=>{commit();setMode('menu');};$('smiBag').onclick=()=>{updateUi();setMode('journal');};$('smiAerial').onclick=()=>{aerial=!aerial;clearInput();$('smiAerial').textContent=aerial?'返回地面':'俯瞰全岛';toast(aerial?'高空总览 · 检查全岛、深槽、Arch 与远方群岛':'回到白沙滩');};",
    )
    rep(
        "const forward=(keys.forward?1:0)-(keys.back?1:0)-joy[1],side=(keys.right?1:0)-(keys.left?1:0)+joy[0],",
        "const forward=aerial?0:(keys.forward?1:0)-(keys.back?1:0)-joy[1],side=aerial?0:(keys.right?1:0)-(keys.left?1:0)+joy[0],",
    )
    rep(
        "function cameraFrame(aspect){if(mode==='menu')return false;const p=s.player,",
        "function cameraFrame(aspect){if(mode==='menu')return false;if(aerial){camera.eye=[0,330,360];camera.target=[0,4,0];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=(innerWidth<760?68:61)*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,60000);return true;}const p=s.player,",
    )
    rep(
        "const api={tick,cameraFrame,drawWorld,drawHand,",
        "const api={tick,cameraFrame,drawWorld,drawHand,setAerial:v=>{aerial=!!v;clearInput();if($('smiAerial'))$('smiAerial').textContent=aerial?'返回地面':'俯瞰全岛';},isAerial:()=>aerial,",
    )

    # Source-couple the Fish Mother R02 motion method: nine fixed-length body
    # sections follow a periodic carrier phase.  Species identity is still not
    # accepted; this replaces only the old one-piece toy ellipsoid.
    old_fish = "const fishGeo=[0,1,2].map(t=>{const b=builder(),col=[[.58,.68,.65],[.53,.45,.08],[.10,.36,.40]][t];b.ell([0,0,0],[.18,.28,.60],col);b.tri([0,0,-.48],[0,.35,-.95],[0,0,-.74],col);b.tri([0,0,-.48],[0,0,-.74],[0,-.35,-.95],col);b.tri([0,.15,.1],[0,.45,-.2],[0,.15,-.42],col);b.ell([.11,.095,.43],[.025,.04,.038],[.015,.024,.026],5,8);b.ell([-.11,.095,.43],[.025,.04,.038],[.015,.024,.026],5,8);return b.upload();});"
    new_fish = "const FISH_SOURCE='ocean-life-mother-r02-fixed-chain-method';const fishChain=[0,1,2].map(t=>Array.from({length:9},(_,j)=>{const b=builder(),col=[[.58,.68,.65],[.53,.45,.08],[.10,.36,.40]][t],u=j/8,profile=Math.sin(Math.PI*(.08+.84*u)),rx=.07+.105*profile,ry=.05+.14*profile,rz=.085;b.ell([0,0,0],[rx,ry,rz],col,5,9);if(j===0){b.ell([.065,.045,.055],[.020,.026,.024],[.012,.018,.020],4,7);b.ell([-.065,.045,.055],[.020,.026,.024],[.012,.018,.020],4,7);}if(j===3){b.tri([0,.08,.02],[0,.24,-.02],[0,.08,-.09],col);b.tri([.06,0,.02],[.20,-.03,-.04],[.05,0,-.08],col);b.tri([-.06,0,.02],[-.20,-.03,-.04],[-.05,0,-.08],col);}if(j===8){b.tri([0,0,-.02],[0,.24,-.17],[0,0,-.13],col);b.tri([0,0,-.02],[0,0,-.13],[0,-.24,-.17],col);}return b.upload();}));function drawFishActor(f){const phase=s.worldSeconds*(2.1+f.type*.22)+f.phase,seg=f.length*.16,heading=f.yaw;for(let j=0;j<9;j++){const u=j/8,longitudinal=(4-j)*seg,bend=Math.sin(phase-j*.58)*seg*(.12+.65*u*u),yaw=heading+Math.sin(phase-j*.58)*(.025+.16*u*u),x=f.pos[0]+Math.sin(heading)*longitudinal+Math.cos(heading)*bend,z=f.pos[2]+Math.cos(heading)*longitudinal-Math.sin(heading)*bend,y=f.pos[1]+Math.sin(phase-j*.42)*.012*f.length;draw(fishChain[f.type][j],matrix(x,y,z,yaw,f.length));}}"
    rep(old_fish, new_fish)
    rep("for(const f of fish)if(!s.fish[f.id]&&f.submerged)draw(fishGeo[f.type],matrix(...f.pos,f.yaw,f.length));",
        "for(const f of fish)if(!s.fish[f.id]&&f.submerged)drawFishActor(f);")
    rep(
        "fishCount:fish.length,submergedFishCount:fish.filter(f=>f.submerged&&!s.fish[f.id]).length,fishWaterViolations,shelterSlabCount:slabs.length,staticTriangles:staticGeo.count/3",
        "fishCount:fish.length,submergedFishCount:fish.filter(f=>f.submerged&&!s.fish[f.id]).length,fishWaterViolations,fishBoneSegments:9,fishSource:FISH_SOURCE,shelterSlabCount:slabs.length,staticTriangles:staticGeo.count/3",
    )

    # Browser-visible world receipt for fast iteration QA.
    rep(
        "window.StoneMoneyShoreline={shoreAt:(x,z,t=physicalTime)=>shorelineAt(x,z,t,config),physicalWaterAt:(x,z,t=physicalTime)=>{const q=shorelineAt(x,z,t,config),ceiling=q.surface+.08+config.runup*.24;return{...q,runupCeiling:ceiling,allowed:q.bed<ceiling};}};",
        "window.StoneMoneyShoreline={shoreAt:(x,z,t=physicalTime)=>shorelineAt(x,z,t,config),physicalWaterAt:(x,z,t=physicalTime)=>{const q=shorelineAt(x,z,t,config),wave=waveAt(x,z,t,config),ceiling=q.surface+.025+config.runup*.10,localSurface=Math.min(wave.eta,ceiling);return{...q,localSurface,runupCeiling:ceiling,allowed:localSurface-q.bed>.012};}};window.StoneMoneyWorld={deepProbe:[-168,-132],archCenter:[184.5,-70],archSeeds:[1163,1181,1201],aerialReview:true,fishSource:'ocean-life-mother-r02-fixed-chain-method'};",
    )
    rep("qa.shoreline='physical-bed-water-permission-v022';",
        "qa.shoreline='physical-bed-water-permission-v023';qa.archipelago='distant-rock-islands-and-open-arch';qa.aerialReview=true;qa.deepTrench=true;qa.fishSource='ocean-life-mother-r02-fixed-chain-method';")

    return s
