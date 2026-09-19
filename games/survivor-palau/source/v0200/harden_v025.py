"""V0.2.5 source-coupled karst-arch increment.

Applied after V0.2.4.  The frozen Ocean Mother payload is still byte-locked.
This revision replaces the seven-block arch approximation with one continuous
irregular limestone ridge whose opening is genuine negative space.  The upper
ridge, opening soffit and tidal-undercut supports share one parameterization.
"""


def apply(s: str) -> str:
    def rep(old: str, new: str, count: int = 1) -> None:
        nonlocal s
        actual = s.count(old)
        assert actual == count, (old[:180], actual, count)
        s = s.replace(old, new)

    rep("Stone Money Island — Survivor Palau · V0.2.4",
        "Stone Money Island — Survivor Palau · V0.2.5")
    rep("const VERSION='stone-money-island-0.2.4-aerial-arch';",
        "const VERSION='stone-money-island-0.2.5-karst-arch';")
    rep("第一章 · 岸边求生 V0.2.4", "第一章 · 岸边求生 V0.2.5")

    # One continuous limestone ridge with a real eroded opening.  Unlike the
    # first V0.2.5 annulus study, the silhouette is not a symmetric bridge band:
    # top height, front/back depth and support undercut vary independently but
    # remain continuous at the spring line.  Vegetation colour is restricted to
    # the narrow exposed crest rather than painted across the whole front face.
    marker = "return{tri,quad,box,ell,rod,ring,rock,upload};}"
    karst_arch = r'''function karstArch(c,outer,hole,depth,pier,col){
 const holeU=hole[0]/outer[0],us=[];function span(a,b,n){for(let i=0;i<=n;i++){const u=a+(b-a)*i/n;if(!us.length||Math.abs(u-us[us.length-1])>1e-6)us.push(u);}}span(-1,-holeU,13);span(-holeU,holeU,28);span(holeU,1,13);
 const topAt=u=>c[1]+outer[1]*(.60+.40*(1-u*u))+.95*Math.sin(u*4.7+.4)+.42*Math.sin(u*10.3-1.1),baseAt=u=>c[1]-pier*(.91+.06*Math.sin(u*5.2)+.03*Math.sin(u*12.7)),holeAt=u=>{const q=clamp(Math.abs(u)/holeU,0,1),d=Math.pow(Math.max(0,1-q*q),.58);return c[1]+hole[1]*d*(1+.035*Math.sin(u*7.4+.8));},inside=u=>Math.abs(u)<holeU-1e-6,lowAt=u=>inside(u)?holeAt(u):baseAt(u),rockCol=(u,v)=>{const n=.96+.055*Math.sin(u*13.1+v*5.7)+.035*Math.sin(u*31.7-v*9.2);return col.map(x=>clamp(x*n,0,1));},crest=[.23,.30,.19],soffit=[.23,.25,.22];
 const dep=(u,v)=>depth*(.74+.16*(1-u*u)+.055*Math.sin(u*8.1+v*3.7)+.035*Math.sin(u*19.0-v*7.1)),pt=(u,v,side)=>{const lo=lowAt(u),hi=topAt(u),y=lo+(hi-lo)*v,x=c[0]+u*outer[0]+.22*Math.sin(v*8.3+u*11.0),z=c[2]+side*dep(u,v)+.28*Math.sin(u*17.0+v*13.0+side);return[x,y,z];};
 const rows=7;for(let k=0;k<us.length-1;k++){const a=us[k],b=us[k+1],mid=(a+b)*.5;for(let j=0;j<rows;j++){const v0=j/rows,v1=(j+1)/rows,fc=rockCol(mid,(v0+v1)*.5);quad(pt(a,v0,-1),pt(b,v0,-1),pt(b,v1,-1),pt(a,v1,-1),fc);quad(pt(a,v1,1),pt(b,v1,1),pt(b,v0,1),pt(a,v0,1),fc);}quad(pt(a,1,-1),pt(b,1,-1),pt(b,1,1),pt(a,1,1),crest);const lc=inside(mid)?soffit:rockCol(mid,0);quad(pt(a,0,1),pt(b,0,1),pt(b,0,-1),pt(a,0,-1),lc);}
 for(const su of[-holeU,holeU]){const y0=baseAt(su),y1=c[1],z0=depth*.77,z1=depth*.83,x=c[0]+su*outer[0];quad([x,y0,c[2]-z0],[x,y0,c[2]+z0],[x,y1,c[2]+z1],[x,y1,c[2]-z1],soffit);}
 for(const su of[-1,1]){const y0=baseAt(su),y1=topAt(su),z0=dep(su,0),z1=dep(su,1),x=c[0]+su*outer[0];quad([x,y0,c[2]-z0],[x,y1,c[2]-z1],[x,y1,c[2]+z1],[x,y0,c[2]+z0],rockCol(su,.5));}
}
'''
    rep(marker, karst_arch + "return{tri,quad,box,ell,rod,ring,rock,karstArch,upload};}")

    # Replace the seven independent V0.2.4 rock bodies with the continuous
    # eroded-ridge expression.  The opening is broader than the previous study
    # but the roof stays thick enough to read as limestone mass, not a bridge.
    old_arch = "const archBed=Math.max(host.bed(186,144),-8);b.rock([174,archBed+8,144],[5.0,9.5,7.2],[.31,.34,.30]);b.rock([176,archBed+20,144],[4.5,7.5,7.0],[.30,.33,.29]);b.rock([198,archBed+8,144],[5.1,9.8,7.3],[.31,.34,.30]);b.rock([196,archBed+20,144],[4.5,7.5,7.0],[.30,.33,.29]);b.rock([181,archBed+27,144],[6.5,5.3,7.0],[.32,.35,.31]);b.rock([191,archBed+27,144],[6.5,5.3,7.0],[.32,.35,.31]);b.rock([186,archBed+31,144],[7.2,5.0,7.1],[.33,.36,.32]);"
    new_arch = "const archBed=Math.max(host.bed(186,144),-8);b.karstArch([186,archBed+11,144],[29,18],[14.5,10.8],7.5,11,[.36,.35,.30]);"
    rep(old_arch, new_arch)

    # Review from water level with enough distance to include the whole eroded
    # ridge and surrounding Rock Islands.  Player/world state is unchanged.
    rep(
        "if(cameraMode==='arch'){camera.eye=[186,34,214];camera.target=[186,14,144];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=43*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,60000);return true;}",
        "if(cameraMode==='arch'){camera.eye=[186,19,226];camera.target=[186,9,144];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=42*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,60000);return true;}"
    )

    rep(
        "cameraMode,source:'object definitions + state + relations; original sea/sky retained',limitations:",
        "cameraMode,archGeometry:'continuous-eroded-ridge-v025',archOpening:{span:29,height:21.8,tidalUndercut:true},source:'object definitions + state + relations; original sea/sky retained',limitations:"
    )

    return s
