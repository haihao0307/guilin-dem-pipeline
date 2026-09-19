"""V0.2.5 source-coupled karst-arch increment.

Applied after V0.2.4.  The frozen Ocean Mother payload is still byte-locked.
This increment replaces the seven-block arch approximation with one continuous
parametric limestone arch mesh whose supports, opening and roof share a single
function.  It also preserves the physical shoreline gate and review cameras.
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

    # Add one continuous arch primitive.  The upper annulus and the two tidal
    # supports share the same spring line.  The supports become narrower toward
    # the waterline to evoke the undercut/mushroom weathering visible in Palau
    # Rock Islands rather than a masonry-like pair of columns.
    marker = "return{tri,quad,box,ell,rod,ring,rock,upload};}"
    karst_arch = r'''function karstArch(c,outer,hole,depth,pier,col){
 const n=40,topCol=[col[0]*.52,col[1]*.70,col[2]*.46],mixCol=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t),rough=(t,k)=>1+.026*Math.sin(t*5.0+k*.71)+.018*Math.sin(t*11.0-k*.43),faceCol=y=>mixCol(col,topCol,clamp((y-(c[1]+outer[1]*.60))/(outer[1]*.30),0,1));
 const arc=(t,inner,zSign)=>{const r=inner?hole:outer,q=rough(t,inner?2:1),zd=depth*(.94+.05*Math.sin(t*7.0+zSign*.9));return[c[0]+Math.cos(t)*r[0]*q,c[1]+Math.sin(t)*r[1]*q,c[2]+zSign*zd];};
 for(let i=0;i<n;i++){const t0=i/n*Math.PI,t1=(i+1)/n*Math.PI,o0f=arc(t0,false,-1),o1f=arc(t1,false,-1),i0f=arc(t0,true,-1),i1f=arc(t1,true,-1),o0b=arc(t0,false,1),o1b=arc(t1,false,1),i0b=arc(t0,true,1),i1b=arc(t1,true,1),fc=faceCol((o0f[1]+o1f[1])*.5);quad(o0f,o1f,i1f,i0f,fc);quad(i0b,i1b,o1b,o0b,fc);quad(o0f,o0b,o1b,o1f,fc);quad(i1f,i1b,i0b,i0f,fc);}
 const rows=14;
 for(const side of[-1,1]){const row=u=>{const wob=(1-u),outerAbs=outer[0]*(.90+.10*u)+wob*(.22*Math.sin(u*9.0+side)+.12*Math.sin(u*17.0)),innerAbs=hole[0]*(1.08-.08*u)+wob*(.16*Math.sin(u*8.0-side*.7)),y=c[1]-pier*(1-u),zd=depth*(.90+.10*u+wob*.05*Math.sin(u*13.0+side));return{oi:[c[0]+side*outerAbs,y,c[2]-zd],oo:[c[0]+side*outerAbs,y,c[2]+zd],ii:[c[0]+side*innerAbs,y,c[2]-zd],io:[c[0]+side*innerAbs,y,c[2]+zd]};};for(let j=0;j<rows;j++){const a=row(j/rows),b=row((j+1)/rows),fc=faceCol((a.oi[1]+b.oi[1])*.5);quad(a.oi,b.oi,b.ii,a.ii,fc);quad(a.io,a.oo,b.oo,b.io,fc);quad(a.oi,a.oo,b.oo,b.oi,fc);quad(a.ii,b.ii,b.io,a.io,fc);}}
}
'''
    rep(marker, karst_arch + "return{tri,quad,box,ell,rod,ring,rock,karstArch,upload};}")

    # Replace the seven independent rock bodies with a single connected arch.
    old_arch = "const archBed=Math.max(host.bed(186,144),-8);b.rock([174,archBed+8,144],[5.0,9.5,7.2],[.31,.34,.30]);b.rock([176,archBed+20,144],[4.5,7.5,7.0],[.30,.33,.29]);b.rock([198,archBed+8,144],[5.1,9.8,7.3],[.31,.34,.30]);b.rock([196,archBed+20,144],[4.5,7.5,7.0],[.30,.33,.29]);b.rock([181,archBed+27,144],[6.5,5.3,7.0],[.32,.35,.31]);b.rock([191,archBed+27,144],[6.5,5.3,7.0],[.32,.35,.31]);b.rock([186,archBed+31,144],[7.2,5.0,7.1],[.33,.36,.32]);"
    new_arch = "const archBed=Math.max(host.bed(186,144),-8);b.karstArch([186,archBed+14,144],[25,15],[16,8.6],6.8,14,[.34,.36,.31]);"
    rep(old_arch, new_arch)

    # Put the review camera closer to the water-level opening.  The camera is
    # still only an inspection mode: it does not move the player or world state.
    rep(
        "if(cameraMode==='arch'){camera.eye=[186,34,214];camera.target=[186,14,144];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=43*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,60000);return true;}",
        "if(cameraMode==='arch'){camera.eye=[186,18,207];camera.target=[186,8,144];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=39*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,60000);return true;}"
    )

    # Expose a tiny geometry receipt for browser QA without making geometry
    # dependent on QA mode.
    rep(
        "cameraMode,source:'object definitions + state + relations; original sea/sky retained',limitations:",
        "cameraMode,archGeometry:'continuous-parametric-karst-v025',archOpening:{span:32,height:22.6,tidalUndercut:true},source:'object definitions + state + relations; original sea/sky retained',limitations:"
    )

    return s
