"""V0.2.8 arch-reveal increment.

Applied after verified V0.2.7.  Public screenshot review showed the main defect was
no longer the existence of a true opening but its legibility: neighbouring Rock
Islands occluded the negative space and the main throat remained too narrow for
an unmistakable natural-arch read.  This increment keeps the same continuous
procedural landform, frozen Ocean Mother payload, beach physics, stone-money
placement and deep trench; it enlarges the true void, relocates the landmark to
an open-water corridor, and places the dedicated review camera inside that
corridor rather than behind foreground islands.
"""


def apply(s: str) -> str:
    def rep(old: str, new: str, count: int = 1) -> None:
        nonlocal s
        actual = s.count(old)
        assert actual == count, (old[:180], actual, count)
        s = s.replace(old, new)

    rep("Stone Money Island — Survivor Palau · V0.2.7",
        "Stone Money Island — Survivor Palau · V0.2.8")
    rep("const VERSION='stone-money-island-0.2.7-dissolved-arch';",
        "const VERSION='stone-money-island-0.2.8-arch-reveal';")
    rep("第一章 · 岸边求生 V0.2.7", "第一章 · 岸边求生 V0.2.8")

    # Open the same continuous limestone body farther.  This is not a new mesh
    # asset or an LOD: the negative space remains part of the same generator.
    rep("const left=-1.20,right=1.06,mainL=-.11,mainR=.48,caveL=-.82,caveR=-.64,us=[];",
        "const left=-1.20,right=1.06,mainL=-.18,mainR=.58,caveL=-.82,caveR=-.64,us=[];")
    rep("inMain(u)?archCurve(u,mainL,mainR,10.7,.58,.18)",
        "inMain(u)?archCurve(u,mainL,mainR,11.6,.56,.20)")

    # Move the arch out of the crowded V0.2.7 sightline.  The landmark stays a
    # distant Rock Island, but now has an open-water approach corridor instead
    # of being visually hidden by the 154/174 and other background masses.
    rep("const archBed=Math.max(host.bed(186,144),-8);b.dissolvedArch([186,archBed+7.8,144],31.5,10.6,[.36,.37,.32]);",
        "const archBed=Math.max(host.bed(210,190),-8);b.dissolvedArch([210,archBed+7.8,190],31.5,10.6,[.36,.37,.32]);")

    # Review from lagoon/water height along the cleared approach.  This camera
    # is deliberately closer than V0.2.7 because the prior camera proved that a
    # valid arch can still be unreadable when foreground islands dominate.
    rep("if(cameraMode==='arch'){camera.eye=[246,32,258];camera.target=[184,10,144];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=46*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,60000);return true;}",
        "if(cameraMode==='arch'){camera.eye=[217,13.6,247];camera.target=[207,8.8,190];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=49*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,60000);return true;}")

    rep("cameraMode,archGeometry:'dissolved-mushroom-rock-island-v027',archOpening:{nominalMainSpan:18.6,height:19.5,tidalUndercut:true,asymmetric:true,offCenter:true,secondarySeaCave:true},archMass:{tidalToCrownWidthRatio:.46,vegetationPockets:7,unequalCrownLobes:true,minimumRoofThickness:5.7},archCrown:'irregular-pocket-vegetation-same-geometry-build',source:",
        "cameraMode,archGeometry:'dissolved-mushroom-rock-island-v028-revealed',archPosition:[210,190],archOpening:{nominalMainSpan:23.94,height:21.19,tidalUndercut:true,asymmetric:true,offCenter:true,secondarySeaCave:true},archMass:{tidalToCrownWidthRatio:.46,vegetationPockets:7,unequalCrownLobes:true,minimumRoofThickness:4.91},archCrown:'irregular-pocket-vegetation-same-geometry-build',source:")

    return s
