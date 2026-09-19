"""V0.2.6b visual correction after screenshot review.

The first V0.2.6 candidate passed numerical/browser gates but the actual review
image still read as an engineered bridge: broad near-horizontal roof band,
centered opening and two comparable supports.  This patch keeps the true
negative-space principle but turns the landmark into one mushroom/undercut Rock
Island with a smaller opening shifted toward one side and a much larger,
irregular limestone mass above it.
"""


def apply(s: str) -> str:
    def rep(old: str, new: str, count: int = 1) -> None:
        nonlocal s
        actual = s.count(old)
        assert actual == count, (old[:180], actual, count)
        s = s.replace(old, new)

    marker = "return{tri,quad,box,ell,rod,ring,rock,karstArch,erodedArch,upload};}"
    island_arch = r'''function islandArch(c,halfSpan,depth,col){
 const left=-1.24,right=1.08,openL=-.15,openR=.55,us=[];function span(a,b,n){for(let i=0;i<=n;i++){const u=a+(b-a)*i/n;if(!us.length||Math.abs(u-us[us.length-1])>1e-6)us.push(u);}}span(left,openL,26);span(openL,openR,30);span(openR,right,16);
 const topAt=u=>c[1]+21.5+8.0*Math.exp(-Math.pow((u+.55)/.58,2))+6.5*Math.exp(-Math.pow((u-.72)/.34,2))+1.25*Math.sin(u*4.7+.5)+.55*Math.sin(u*11.3-1.2)+.28*Math.sin(u*24.0+.3),baseAt=u=>c[1]-8.2+.75*Math.sin(u*5.4-.2)+.30*Math.sin(u*15.7+1.3),inside=u=>u>openL&&u<openR,holeAt=u=>{const mid=(openL+openR)*.5,half=(openR-openL)*.5,q=clamp((u-mid)/half,-1,1),d=Math.pow(Math.max(0,1-q*q),.62),skew=1+.15*q-.05*q*q;return c[1]+.9+13.2*d*skew+.55*Math.sin(u*10.8+.2)*d+.25*Math.sin(u*27.0-.8)*d;},lowAt=u=>inside(u)?holeAt(u):baseAt(u);
 const wet=[.22,.25,.23],soffit=[.245,.25,.22],green=[.07,.18,.04],green2=[.10,.25,.055],trunk=[.15,.105,.055],rockCol=(u,v)=>{const micro=.94+.065*Math.sin(u*12.3+v*8.5)+.045*Math.sin(u*31.0-v*15.0)+.025*Math.sin(u*67.0+v*29.0),vertical=.73+.27*Math.pow(v,.38),n=micro*vertical;return col.map(x=>clamp(x*n,0,1));};
 const dep=(u,v)=>depth*(.55+.38*v+.12*(1-Math.min(1,u*u))+.055*Math.sin(u*8.4+v*4.4)+.03*Math.sin(u*23.0-v*13.0)),pt=(u,v,side)=>{const lo=lowAt(u),hi=topAt(u),y=lo+(hi-lo)*v+.38*Math.sin(v*15.3+u*14.5)*(v*(1-v))+.16*Math.sin(v*33.0-u*21.0)*(v*(1-v)),mush=.82+.18*v,x=c[0]+u*halfSpan*mush+.72*Math.sin(v*6.9+u*12.4)+.27*Math.sin(v*18.0-u*33.0),z=c[2]+side*dep(u,v)+.48*Math.sin(u*14.0+v*11.1+side*.6)+.19*Math.sin(u*37.0-v*19.0);return[x,y,z];};
 const rows=14;for(let k=0;k<us.length-1;k++){const a=us[k],b=us[k+1],mid=(a+b)*.5;for(let j=0;j<rows;j++){const v0=j/rows,v1=(j+1)/rows,fc=rockCol(mid,(v0+v1)*.5);quad(pt(a,v0,-1),pt(b,v0,-1),pt(b,v1,-1),pt(a,v1,-1),fc);quad(pt(a,v1,1),pt(b,v1,1),pt(b,v0,1),pt(a,v0,1),fc);}quad(pt(a,1,-1),pt(b,1,-1),pt(b,1,1),pt(a,1,1),rockCol(mid,1));const lc=inside(mid)?soffit:(baseAt(mid)<c[1]-7.6?wet:rockCol(mid,.015));quad(pt(a,0,1),pt(b,0,1),pt(b,0,-1),pt(a,0,-1),lc);}
 for(const su of[openL,openR]){const y0=baseAt(su),y1=holeAt(su),x=c[0]+su*halfSpan*.82,d0=dep(su,0),d1=dep(su,.17);quad([x-.35,y0,c[2]-d0],[x+.25,y0,c[2]+d0],[x+.20,y1,c[2]+d1],[x-.24,y1,c[2]-d1],soffit);}
 for(const su of[left,right]){const y0=baseAt(su),y1=topAt(su),x0=c[0]+su*halfSpan*.82,x1=c[0]+su*halfSpan,d0=dep(su,0),d1=dep(su,1);quad([x0,y0,c[2]-d0],[x1,y1,c[2]-d1],[x1,y1,c[2]+d1],[x0,y0,c[2]+d0],rockCol(su,.5));}
 const shrubs=[-1.03,-.91,-.79,-.66,-.52,-.38,-.23,-.06,.13,.31,.49,.66,.82,.96];for(let i=0;i<shrubs.length;i++){const u=shrubs[i],x=c[0]+u*halfSpan+.9*Math.sin(i*2.07),y=topAt(u)+.5,z=c[2]+1.1*Math.sin(i*1.69),h=1.9+.8*(.5+.5*Math.sin(i*2.31));rod([x,y-.55,z],[x+.22*Math.sin(i),y+h,z+.16*Math.cos(i*.73)],.09,trunk);ell([x-.70,y+h+.20,z],[2.4+.45*Math.sin(i),1.25+.25*Math.cos(i*.8),1.75],i%2?green:green2,5,9);ell([x+1.15,y+h+.10,z+.45],[1.85,1.05,1.45],i%2?green2:green,5,9);ell([x+.15,y+h+.85,z-.55],[2.05,1.15,1.60],green2,5,9);}
}
'''
    rep(marker, island_arch + "return{tri,quad,box,ell,rod,ring,rock,karstArch,erodedArch,islandArch,upload};}")
    rep(
        "const archBed=Math.max(host.bed(186,144),-8);b.erodedArch([186,archBed+8.4,144],31.5,9.4,[.54,.53,.46]);",
        "const archBed=Math.max(host.bed(186,144),-8);b.islandArch([186,archBed+7.5,144],31.5,10.2,[.39,.40,.35]);"
    )
    rep(
        "if(cameraMode==='arch'){camera.eye=[194,17.5,230];camera.target=[184,10.5,144];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=46*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,60000);return true;}",
        "if(cameraMode==='arch'){camera.eye=[204,18.5,238];camera.target=[193,12,144];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=47*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,60000);return true;}"
    )
    rep(
        "cameraMode,archGeometry:'asymmetric-vegetated-eroded-ridge-v026',archOpening:{span:31.2,height:21.0,tidalUndercut:true,asymmetric:true},archCrown:'deterministic-vegetation-same-geometry-build',source:",
        "cameraMode,archGeometry:'offcenter-mushroom-rock-island-v026b',archOpening:{waterlineSpan:18.1,nominalSectionSpan:22.05,height:23.3,tidalUndercut:true,asymmetric:true,offCenter:true},archCrown:'deterministic-vegetation-same-geometry-build',source:"
    )
    return s
