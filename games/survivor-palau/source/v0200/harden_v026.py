"""V0.2.6 naturalized Palau-style arch increment.

Applied after V0.2.5.  The frozen Ocean Mother payload remains byte-locked.
The V0.2.5 arch was structurally a true negative-space ridge but still read as
an engineered bridge because its soffit, roof band and front face were too
regular.  This revision keeps one continuous landform while making the opening
asymmetric, the waterline undercut, the wall thickness variable and the crown
vegetated from the same deterministic parameterization.
"""


def apply(s: str) -> str:
    def rep(old: str, new: str, count: int = 1) -> None:
        nonlocal s
        actual = s.count(old)
        assert actual == count, (old[:180], actual, count)
        s = s.replace(old, new)

    rep("Stone Money Island — Survivor Palau · V0.2.5",
        "Stone Money Island — Survivor Palau · V0.2.6")
    rep("const VERSION='stone-money-island-0.2.5-karst-arch';",
        "const VERSION='stone-money-island-0.2.6-eroded-arch';")
    rep("第一章 · 岸边求生 V0.2.5", "第一章 · 岸边求生 V0.2.6")

    # V0.2.5 already provided a real opening, but its cross section was close to
    # a symmetric civil arch.  Add a second, source-coupled generator that uses
    # one continuous ridge: asymmetric spring points, independent crest and
    # soffit erosion, a narrower tidal waist, and a deterministic vegetation
    # crown.  Nothing here is a separate LOD/model asset.
    marker = "return{tri,quad,box,ell,rod,ring,rock,karstArch,upload};}"
    eroded = r'''function erodedArch(c,halfSpan,depth,col){
 const left=-1.18,right=1.14,openL=-.53,openR=.46,us=[];function span(a,b,n){for(let i=0;i<=n;i++){const u=a+(b-a)*i/n;if(!us.length||Math.abs(u-us[us.length-1])>1e-6)us.push(u);}}span(left,openL,18);span(openL,openR,34);span(openR,right,18);
 const topAt=u=>c[1]+15.2+5.4*(1-Math.min(1,u*u))+.95*Math.sin(u*4.9+.3)+.58*Math.sin(u*10.7-1.0)+.24*Math.sin(u*23.3+.8),baseAt=u=>c[1]-7.0+.62*Math.sin(u*5.8-.4)+.28*Math.sin(u*16.1+1.7),inside=u=>u>openL&&u<openR,holeAt=u=>{const mid=(openL+openR)*.5,half=(openR-openL)*.5,q=clamp((u-mid)/half,-1,1),d=Math.pow(Math.max(0,1-q*q),.47),skew=1+.10*q-.035*q*q;return c[1]+2.3+11.9*d*skew+.48*Math.sin(u*12.4+.5)*d+.22*Math.sin(u*29.0-1.1)*d;},lowAt=u=>inside(u)?holeAt(u):baseAt(u),rockCol=(u,v)=>{const n=.93+.07*Math.sin(u*11.7+v*7.9)+.045*Math.sin(u*29.1-v*13.7)+.025*Math.sin(u*61.0+v*23.0);return col.map(x=>clamp(x*n,0,1));},soffit=[.26,.27,.24],tidal=[.29,.31,.28],green=[.075,.20,.045],green2=[.105,.27,.060],trunk=[.17,.12,.065];
 const dep=(u,v)=>depth*(.56+.26*v+.10*(1-Math.min(1,u*u))+.045*Math.sin(u*8.8+v*4.1)+.025*Math.sin(u*21.0-v*11.0)),pt=(u,v,side)=>{const lo=lowAt(u),hi=topAt(u),y=lo+(hi-lo)*v+.20*Math.sin(v*19.0+u*17.0)*(v*(1-v)),x=c[0]+u*halfSpan+.52*Math.sin(v*7.7+u*13.1)+.20*Math.sin(v*17.3-u*31.0),z=c[2]+side*dep(u,v)+.42*Math.sin(u*15.0+v*12.2+side*.7)+.18*Math.sin(u*39.0-v*21.0);return[x,y,z];};
 const rows=12;for(let k=0;k<us.length-1;k++){const a=us[k],b=us[k+1],mid=(a+b)*.5;for(let j=0;j<rows;j++){const v0=j/rows,v1=(j+1)/rows,fc=rockCol(mid,(v0+v1)*.5);quad(pt(a,v0,-1),pt(b,v0,-1),pt(b,v1,-1),pt(a,v1,-1),fc);quad(pt(a,v1,1),pt(b,v1,1),pt(b,v0,1),pt(a,v0,1),fc);}const capCol=rockCol(mid,.98);quad(pt(a,1,-1),pt(b,1,-1),pt(b,1,1),pt(a,1,1),capCol);const lc=inside(mid)?soffit:((Math.abs(mid)>Math.max(Math.abs(openL),Math.abs(openR))&&baseAt(mid)<c[1]-5.6)?tidal:rockCol(mid,.02));quad(pt(a,0,1),pt(b,0,1),pt(b,0,-1),pt(a,0,-1),lc);}
 for(const su of[openL,openR]){const x=c[0]+su*halfSpan,y0=baseAt(su),y1=holeAt(su),d0=dep(su,0),d1=dep(su,.18);quad([x-.25,y0,c[2]-d0],[x+.22,y0,c[2]+d0],[x+.18,y1,c[2]+d1],[x-.18,y1,c[2]-d1],soffit);}
 for(const su of[left,right]){const y0=baseAt(su),y1=topAt(su),d0=dep(su,0),d1=dep(su,1),x=c[0]+su*halfSpan;quad([x,y0,c[2]-d0],[x,y1,c[2]-d1],[x,y1,c[2]+d1],[x,y0,c[2]+d0],rockCol(su,.5));}
 const shrubs=[-.99,-.84,-.70,-.56,-.39,-.22,-.04,.14,.31,.49,.67,.84,1.00];for(let i=0;i<shrubs.length;i++){const u=shrubs[i],x=c[0]+u*halfSpan+.7*Math.sin(i*2.1),y=topAt(u)+.55,z=c[2]+.9*Math.sin(i*1.73),h=1.7+.55*(.5+.5*Math.sin(i*2.43));rod([x,y-.45,z],[x+.18*Math.sin(i),y+h,z+.14*Math.cos(i*.7)],.10,trunk);ell([x-.55,y+h+.25,z],[2.15+.35*Math.sin(i),1.15+.20*Math.cos(i*.8),1.55],i%2?green:green2,5,9);ell([x+1.05,y+h+.15,z+.35],[1.65,1.0,1.35],i%2?green2:green,5,9);ell([x+.20,y+h+.72,z-.45],[1.85,1.05,1.45],green2,5,9);}
}
'''
    rep(marker, eroded + "return{tri,quad,box,ell,rod,ring,rock,karstArch,erodedArch,upload};}")

    rep(
        "const archBed=Math.max(host.bed(186,144),-8);b.karstArch([186,archBed+11,144],[29,18],[14.5,10.8],7.5,11,[.36,.35,.30]);",
        "const archBed=Math.max(host.bed(186,144),-8);b.erodedArch([186,archBed+8.4,144],31.5,9.4,[.54,.53,.46]);"
    )

    # Frame the new landform from lagoon height instead of presenting it like a
    # centered bridge elevation.  The opening remains readable, while the
    # vegetated shoulders and waterline waist stay in frame.
    rep(
        "if(cameraMode==='arch'){camera.eye=[186,19,226];camera.target=[186,9,144];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=42*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,60000);return true;}",
        "if(cameraMode==='arch'){camera.eye=[194,17.5,230];camera.target=[184,10.5,144];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=46*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,60000);return true;}"
    )

    rep(
        "cameraMode,archGeometry:'continuous-eroded-ridge-v025',archOpening:{span:29,height:21.8,tidalUndercut:true},source:'object definitions + state + relations; original sea/sky retained',limitations:",
        "cameraMode,archGeometry:'asymmetric-vegetated-eroded-ridge-v026',archOpening:{span:31.2,height:21.0,tidalUndercut:true,asymmetric:true},archCrown:'deterministic-vegetation-same-geometry-build',source:'object definitions + state + relations; original sea/sky retained',limitations:"
    )

    return s
