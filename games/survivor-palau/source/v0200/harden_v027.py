"""V0.2.7 dissolved Rock-Island arch increment.

Applied after the verified V0.2.6 runtime.  Screenshot review showed that the
landmark was mathematically continuous but still read as a civil bridge: too
much vertical wall, an almost continuous crown line, and a regular row of
shrubs.  This patch keeps one deterministic parametric landform and the true
negative-space opening, but makes the tidal body much narrower than the crown,
adds an off-centre secondary sea-cave notch, breaks the crown into unequal
limestone lobes, reduces vegetation to irregular pockets, and moves the review
camera to a three-quarter water-level view.  The frozen Ocean Mother payload is
not touched.
"""


def apply(s: str) -> str:
    def rep(old: str, new: str, count: int = 1) -> None:
        nonlocal s
        actual = s.count(old)
        assert actual == count, (old[:180], actual, count)
        s = s.replace(old, new)

    rep("Stone Money Island — Survivor Palau · V0.2.6",
        "Stone Money Island — Survivor Palau · V0.2.7")
    rep("const VERSION='stone-money-island-0.2.6-eroded-arch';",
        "const VERSION='stone-money-island-0.2.7-dissolved-arch';")
    rep("第一章 · 岸边求生 V0.2.6", "第一章 · 岸边求生 V0.2.7")

    marker = "return{tri,quad,box,ell,rod,ring,rock,karstArch,erodedArch,islandArch,upload};}"
    dissolved = r'''function dissolvedArch(c,halfSpan,depth,col){
 const left=-1.20,right=1.06,mainL=-.11,mainR=.48,caveL=-.82,caveR=-.64,us=[];function span(a,b,n){for(let i=0;i<=n;i++){const u=a+(b-a)*i/n;if(!us.length||Math.abs(u-us[us.length-1])>1e-6)us.push(u);}}span(left,caveL,14);span(caveL,caveR,8);span(caveR,mainL,18);span(mainL,mainR,28);span(mainR,right,18);
 const ga=(u,m,w)=>Math.exp(-Math.pow((u-m)/w,2)),topAt=u=>c[1]+12.5+13.4*ga(u,-.70,.38)+7.3*ga(u,.64,.28)+5.1*ga(u,-.05,.72)-1.6*ga(u,.22,.18)+1.15*Math.sin(u*4.5+.7)+.62*Math.sin(u*10.7-1.0)+.26*Math.sin(u*25.0+.4),baseAt=u=>c[1]-7.6+.70*Math.sin(u*5.1-.3)+.28*Math.sin(u*15.0+1.1),inMain=u=>u>mainL&&u<mainR,inCave=u=>u>caveL&&u<caveR;
 const archCurve=(u,a,b,rise,pow,skew)=>{const mid=(a+b)*.5,half=(b-a)*.5,q=clamp((u-mid)/half,-1,1),d=Math.pow(Math.max(0,1-q*q),pow);return c[1]+1.0+rise*d*(1+skew*q)+.38*Math.sin(u*13.0+.4)*d;},holeAt=u=>inMain(u)?archCurve(u,mainL,mainR,10.7,.58,.18):(inCave(u)?archCurve(u,caveL,caveR,4.6,.72,-.10):baseAt(u)),lowAt=u=>holeAt(u);
 const wet=[.18,.22,.21],soffit=[.20,.225,.205],green=[.055,.15,.035],green2=[.08,.22,.045],trunk=[.13,.09,.05],rockCol=(u,v)=>{const streak=.89+.08*Math.sin(u*12.1+v*8.9)+.055*Math.sin(u*30.0-v*17.0)+.028*Math.sin(u*69.0+v*31.0),height=.70+.30*Math.pow(v,.30),mott=.96+.04*Math.sin(u*5.3-v*3.1);return col.map(x=>clamp(x*streak*height*mott,0,1));};
 const dep=(u,v)=>depth*(.43+.48*v+.13*(1-Math.min(1,u*u))+.065*Math.sin(u*8.1+v*4.6)+.035*Math.sin(u*24.0-v*14.0)),pt=(u,v,side)=>{const lo=lowAt(u),hi=topAt(u),vv=v*v*(3-2*v),y=lo+(hi-lo)*v+.52*Math.sin(v*14.7+u*15.2)*(v*(1-v))+.20*Math.sin(v*35.0-u*23.0)*(v*(1-v)),mush=.46+.54*vv,x=c[0]+u*halfSpan*mush+.95*Math.sin(v*6.5+u*12.8)+.36*Math.sin(v*18.0-u*34.0),z=c[2]+side*dep(u,v)+.68*Math.sin(u*13.2+v*11.4+side*.6)+.24*Math.sin(u*39.0-v*21.0);return[x,y,z];};
 const rows=15;for(let k=0;k<us.length-1;k++){const a=us[k],b=us[k+1],mid=(a+b)*.5;for(let j=0;j<rows;j++){const v0=j/rows,v1=(j+1)/rows,fc=rockCol(mid,(v0+v1)*.5);quad(pt(a,v0,-1),pt(b,v0,-1),pt(b,v1,-1),pt(a,v1,-1),fc);quad(pt(a,v1,1),pt(b,v1,1),pt(b,v0,1),pt(a,v0,1),fc);}quad(pt(a,1,-1),pt(b,1,-1),pt(b,1,1),pt(a,1,1),rockCol(mid,1));const open=inMain(mid)||inCave(mid),lc=open?soffit:(baseAt(mid)<c[1]-7?wet:rockCol(mid,.02));quad(pt(a,0,1),pt(b,0,1),pt(b,0,-1),pt(a,0,-1),lc);}
 for(const su of[mainL,mainR,caveL,caveR]){const y0=baseAt(su),y1=holeAt(su),x=c[0]+su*halfSpan*.46,d0=dep(su,0),d1=dep(su,.15);quad([x-.28,y0,c[2]-d0],[x+.24,y0,c[2]+d0],[x+.19,y1,c[2]+d1],[x-.20,y1,c[2]-d1],soffit);}
 for(const su of[left,right]){const y0=baseAt(su),y1=topAt(su),x0=c[0]+su*halfSpan*.46,x1=c[0]+su*halfSpan,d0=dep(su,0),d1=dep(su,1);quad([x0,y0,c[2]-d0],[x1,y1,c[2]-d1],[x1,y1,c[2]+d1],[x0,y0,c[2]+d0],rockCol(su,.5));}
 const pockets=[[-.94,-1.0,1.25],[-.73,.4,1.65],[-.48,-.5,1.10],[-.19,.7,.85],[.43,-.8,1.15],[.69,.5,1.55],[.88,-.2,.95]];for(let i=0;i<pockets.length;i++){const q=pockets[i],u=q[0],x=c[0]+u*halfSpan+.55*Math.sin(i*1.7),y=topAt(u)+.42,z=c[2]+q[1],sc=q[2],h=.8+1.0*sc;rod([x,y-.35,z],[x+.13*Math.sin(i*1.3),y+h,z+.11*Math.cos(i*.9)],.07,trunk);ell([x-.35*sc,y+h+.10,z],[1.35*sc,.72*sc,1.0*sc],i%2?green:green2,5,8);ell([x+.52*sc,y+h+.06,z+.20],[1.05*sc,.62*sc,.85*sc],i%2?green2:green,5,8);ell([x+.05,y+h+.45,z-.28],[1.10*sc,.66*sc,.90*sc],green2,5,8);}
}
'''
    rep(marker, dissolved + "return{tri,quad,box,ell,rod,ring,rock,karstArch,erodedArch,islandArch,dissolvedArch,upload};}")

    rep(
        "const archBed=Math.max(host.bed(186,144),-8);b.islandArch([186,archBed+7.5,144],31.5,10.2,[.39,.40,.35]);",
        "const archBed=Math.max(host.bed(186,144),-8);b.dissolvedArch([186,archBed+7.8,144],31.5,10.6,[.36,.37,.32]);"
    )

    rep(
        "if(cameraMode==='arch'){camera.eye=[204,18.5,238];camera.target=[193,12,144];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=47*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,60000);return true;}",
        "if(cameraMode==='arch'){camera.eye=[219,16.8,215];camera.target=[191,10.5,144];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=44*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,60000);return true;}"
    )

    rep(
        "cameraMode,archGeometry:'offcenter-mushroom-rock-island-v026b',archOpening:{waterlineSpan:18.1,nominalSectionSpan:22.05,height:23.3,tidalUndercut:true,asymmetric:true,offCenter:true},archCrown:'deterministic-vegetation-same-geometry-build',source:",
        "cameraMode,archGeometry:'dissolved-mushroom-rock-island-v027',archOpening:{nominalMainSpan:18.6,height:19.5,tidalUndercut:true,asymmetric:true,offCenter:true,secondarySeaCave:true},archMass:{tidalToCrownWidthRatio:.46,vegetationPockets:7,unequalCrownLobes:true,minimumRoofThickness:5.7},archCrown:'irregular-pocket-vegetation-same-geometry-build',source:"
    )

    return s
