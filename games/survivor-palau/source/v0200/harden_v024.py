"""V0.2.4 inspection and shoreline refinement.

Applied after V0.2.3.  The original Ocean Mother shader/worker payload remains
byte-locked.  This revision tightens the physical swash permission, makes the
whole-island inspection camera crop out the finite ocean mesh boundary, gives
the rock arch a dedicated readable view, and adds a small background island
chain behind the arch.
"""


def apply(s: str) -> str:
    def rep(old: str, new: str, count: int = 1) -> None:
        nonlocal s
        actual = s.count(old)
        assert actual == count, (old[:180], actual, count)
        s = s.replace(old, new)

    rep("Stone Money Island — Survivor Palau · V0.2.3",
        "Stone Money Island — Survivor Palau · V0.2.4")
    rep("const VERSION='stone-money-island-0.2.3-fast-iteration';",
        "const VERSION='stone-money-island-0.2.4-aerial-arch';")
    rep("第一章 · 岸边求生 V0.2.3", "第一章 · 岸边求生 V0.2.4")

    # Keep a visible lap on the very lowest sand, but reject marginal water
    # thickness more aggressively so the rendered sheet cannot survive through
    # dry beach triangles.
    rep('"key":"runup","label":"贴岸上冲","min":0,"max":1.5,"step":0.05,"value":0.28',
        '"key":"runup","label":"贴岸上冲","min":0,"max":1.5,"step":0.05,"value":0.22')
    rep(
        "float physicalDepth=physicalSurface-physicalBed,physicalWater=smoothstep(.003,.020,physicalDepth)*(1.-smoothstep(runupCeiling-.015,runupCeiling+.015,physicalBed));if(physicalWater<.001)discard;",
        "float physicalDepth=physicalSurface-physicalBed,physicalWater=smoothstep(.008,.028,physicalDepth)*(1.-smoothstep(runupCeiling-.012,runupCeiling+.012,physicalBed));if(physicalWater<.001)discard;"
    )
    rep(
        "allowed:depth>.003&&q.bed<ceiling",
        "allowed:depth>.008&&q.bed<ceiling"
    )
    rep("qa.shoreline='physical-bed-water-permission-v023';",
        "qa.shoreline='physical-bed-water-permission-v024';")

    # The first V0.2.4 attempt used three large superellipsoid pieces and read
    # as a rectangular wall from the inspection camera.  Replace it with seven
    # smaller overlapping karst masses.  Their inner extents leave a real open
    # void; no alpha cutout or billboard is used to fake an arch.
    rep(
        "const archBed=Math.max(host.bed(186,144),-8);b.rock([176,archBed+13,144],[4.4,15.5,6.2],[.31,.34,.30]);b.rock([196,archBed+14,144],[4.7,16.8,6.4],[.30,.33,.29]);b.rock([186,archBed+27,144],[14.2,3.8,6.1],[.32,.35,.31]);",
        "const archBed=Math.max(host.bed(186,144),-8);b.rock([174,archBed+8,144],[5.0,9.5,7.2],[.31,.34,.30]);b.rock([176,archBed+20,144],[4.5,7.5,7.0],[.30,.33,.29]);b.rock([198,archBed+8,144],[5.1,9.8,7.3],[.31,.34,.30]);b.rock([196,archBed+20,144],[4.5,7.5,7.0],[.30,.33,.29]);b.rock([181,archBed+27,144],[6.5,5.3,7.0],[.32,.35,.31]);b.rock([191,archBed+27,144],[6.5,5.3,7.0],[.32,.35,.31]);b.rock([186,archBed+31,144],[7.2,5.0,7.1],[.33,.36,.32]);"
    )

    # Background islands behind the arch: they remain separate bodies, so the
    # landmark reads against an archipelago rather than against empty sky.
    rep(
        "[154,174,15.0,29.0,12.5,1249]);",
        "[154,174,15.0,29.0,12.5,1249],[236,154,13.0,25.0,11.0,1283],[255,181,10.0,20.0,9.0,1301],[224,204,12.5,23.0,10.0,1327]);"
    )

    # Whole-island view is intentionally framed inside the existing continuous
    # ocean domain.  V0.2.3 exposed the finite water-mesh edge as pale wedges at
    # the lower corners; this camera keeps the playable island and immediate
    # Rock Islands visible without pretending the finite mesh is infinite.
    # Arch view now looks nearly straight through the void so nearby islands do
    # not hide the opening.
    rep(
        "if(cameraMode==='aerial'){camera.eye=[0,285,330];camera.target=[0,-8,0];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=61*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,90000);return true;}",
        "if(cameraMode==='aerial'){camera.eye=[0,190,240];camera.target=[0,-5,0];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=46*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,90000);return true;}if(cameraMode==='arch'){camera.eye=[186,34,214];camera.target=[186,14,144];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=43*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,60000);return true;}"
    )

    # Add a direct landmark view without moving the player or changing world
    # state.  This makes the arch and rear island chain reviewable on phone too.
    rep(
        '<button id="smiAerial">全岛</button><button id="smiFishView">鱼群</button><button id="smiBag">背包 0</button>',
        '<button id="smiAerial">全岛</button><button id="smiArchView">拱门</button><button id="smiFishView">鱼群</button><button id="smiBag">背包 0</button>'
    )
    rep(
        "$('smiAerial').onclick=()=>{cameraMode=cameraMode==='aerial'?'player':'aerial';$('smiAerial').textContent=cameraMode==='aerial'?'返回人物':'全岛';};$('smiFishView').onclick=()=>{cameraMode=cameraMode==='fish'?'player':'fish';$('smiFishView').textContent=cameraMode==='fish'?'返回人物':'鱼群';};",
        "$('smiAerial').onclick=()=>{cameraMode=cameraMode==='aerial'?'player':'aerial';$('smiAerial').textContent=cameraMode==='aerial'?'返回人物':'全岛';};$('smiArchView').onclick=()=>{cameraMode=cameraMode==='arch'?'player':'arch';$('smiArchView').textContent=cameraMode==='arch'?'返回人物':'拱门';};$('smiFishView').onclick=()=>{cameraMode=cameraMode==='fish'?'player':'fish';$('smiFishView').textContent=cameraMode==='fish'?'返回人物':'鱼群';};"
    )
    rep(
        "setCameraMode:m=>{cameraMode=['player','aerial','fish'].includes(m)?m:'player';}",
        "setCameraMode:m=>{cameraMode=['player','aerial','arch','fish'].includes(m)?m:'player';}"
    )

    return s
