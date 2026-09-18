from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r3/index.html"
OUT = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r3-tiles-microscope/index.html"
BUILD = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r3-tiles-microscope/build.json"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


raw = SRC.read_bytes()
source_sha = sha256(raw)
s = raw.decode("utf-8")
assert "R5.K2.G3 Warped Microscope" in s
assert "Warped Microscope + Living Soil" in s
assert "const VS=`#version 300 es" in s

# Preserve the user-accepted G3 scene, camera, material, caves, ground and controls.
s = s.replace("R5.K2.G3 Warped Microscope", "R5.K2.G3.T1 Tiles Shape Microscope", 1)
s = s.replace("水蚀岩壁 R5.K2.G3", "水蚀岩壁 R5.K2.G3.T1", 1)
s = s.replace("Warped Microscope + Living Soil", "Tiles Mother Shape Microscope · G3 Locked", 1)
s = s.replace("<label for=\"scope\">Microscope 壳层强度</label>", "<label for=\"scope\">Microscope 形体强度</label>", 1)
s = s.replace('id="scope" type="range" min=".6" max="3.0"', 'id="scope" type="range" min="0" max="3.0"', 1)
s = s.replace(
    "真实几何负责米级与分米级形状；壳层只承担网格以下细节。峰顶、峰脚和主洞口继续冻结。",
    "沿用 Tiles Mother 的做法：同一个 Microscope 场直接移动渲染顶点并重算法线；不是贴图。峰顶、峰脚和主洞口继续保护。",
    1,
)
s = s.replace("v.scope<.6", "v.scope<0")
s = s.replace("release:'limestone-water-surface-r5'", "release:'limestone-water-surface-r5-g3t1-tiles-shape'", 1)

new_vs = r'''const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aP;layout(location=1) in vec3 aN;layout(location=2) in vec3 aRest;layout(location=3) in vec4 aD;layout(location=4) in vec3 aE;
uniform mat4 uVP;
uniform float uScope,uShellScale,uShellContrast,uShellCoverage,uShellDirection,uShellWarp,uShellBreakup,uGroundMicro;
out vec3 p;out vec3 n0;out vec3 q;out vec4 d;out vec3 e;out vec3 bmQ;out vec3 bmData;
float bmH(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float bmN(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(bmH(i),bmH(i+vec3(1,0,0)),f.x),mix(bmH(i+vec3(0,1,0)),bmH(i+vec3(1,1,0)),f.x),f.y),mix(mix(bmH(i+vec3(0,0,1)),bmH(i+vec3(1,0,1)),f.x),mix(bmH(i+vec3(0,1,1)),bmH(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec3 bmTwist(vec3 p,vec3 center,vec3 axis,float radius,float freq,float amp,float phase){vec3 v=p-center;axis=normalize(axis);float angle=amp*exp(-dot(v,v)/(radius*radius))*sin(freq*dot(axis,v)+phase);float c=cos(angle),s=sin(angle);return center+c*v+s*cross(axis,v)+(1.-c)*axis*dot(axis,v);}
vec3 bmCoordinates(vec3 p){p=bmTwist(p,vec3(.12,-.08,.04),vec3(.38,.82,.42),2.4,1.45,.65,.7);p=bmTwist(p,vec3(-.16,.13,-.06),vec3(-.67,.15,.73),2.1,4.1,.20,2.0);vec3 x=p*6.9+vec3(.7);p+=.050*(vec3(bmN(x),bmN(x+vec3(14.7,-6.3,4.2)),bmN(x+vec3(-3.7,17.2,12.4)))-.5);return p;}
uint bmHashU(ivec3 p,uint seed){uint h=uint(p.x)*374761393u^uint(p.y)*668265263u^uint(p.z)*1274126177u^seed;h=(h^(h>>13u))*1274126177u;return h^(h>>16u);}
float bmSeedNoise(vec3 p,uint seed){ivec3 i=ivec3(floor(p));vec3 f=fract(p);f=f*f*(3.-2.*f);float a=float(bmHashU(i,seed)),b=float(bmHashU(i+ivec3(1,0,0),seed)),c=float(bmHashU(i+ivec3(0,1,0),seed)),d0=float(bmHashU(i+ivec3(1,1,0),seed)),e0=float(bmHashU(i+ivec3(0,0,1),seed)),g=float(bmHashU(i+ivec3(1,0,1),seed)),h=float(bmHashU(i+ivec3(0,1,1),seed)),j=float(bmHashU(i+ivec3(1,1,1),seed));return mix(mix(mix(a,b,f.x),mix(c,d0,f.x),f.y),mix(mix(e0,g,f.x),mix(h,j,f.x),f.y),f.z)/4294967295.;}
uint bmColorSeed(uint seed){seed=(seed^99u)*16777619u;seed=(seed^111u)*16777619u;seed=(seed^108u)*16777619u;seed=(seed^111u)*16777619u;return(seed^114u)*16777619u;}
vec3 lmRot(vec3 v,vec3 axis,float a){axis=normalize(axis);float c=cos(a),ss=sin(a);return c*v+ss*cross(axis,v)+(1.-c)*axis*dot(axis,v);}

// Tiles Mother transfer: one stable 17-octave scalar field drives the full visible shell.
float lmShapeBand(vec3 p,float seed,float density,float footprint){
 vec3 q0=vec3(p.x+(fract(sin(seed*12.9898+78.233)*43758.5453)-.5)*.11,p.z+.40,p.y+.27);
 float r=max(length(q0),.0001);
 vec3 xi=vec3(log2(r)-2.,-q0.z/r,atan(q0.x,q0.y))*density;
 float span=footprint*density/max(length(q0.xy),.20),scale=1.,value=0.;
 for(int j=0;j<17;j++){
  if(span*scale>=2.4)break;
  float weight=1.-smoothstep(.8,2.4,span*scale);
  vec3 c=cos(xi*scale);value+=weight*(cos(dot(c.zyy,c.xyx))-.6556965)/scale;scale*=2.;
 }
 return value;
}
vec3 lmDomain(vec3 rawQ){
 float a=radians(uShellDirection),ca=cos(a),sa=sin(a);
 vec3 q0=vec3(ca*rawQ.x-sa*rawQ.z,rawQ.y,sa*rawQ.x+ca*rawQ.z);
 vec3 low=vec3(bmN(rawQ*.021+vec3(3.1,7.2,-2.4)),bmN(rawQ*.0187+vec3(-8.3,2.7,4.6)),bmN(rawQ*.0243+vec3(1.5,-6.4,9.1)))-.5;
 vec3 low2=vec3(bmN(rawQ*.0119+vec3(-13.7,6.2,18.1)),bmN(rawQ*.0141+vec3(9.8,-11.4,2.7)),bmN(rawQ*.0127+vec3(4.2,15.3,-8.9)))-.5;
 float zone=bmN(rawQ*.0137+vec3(17.1,-5.3,8.7));
 vec3 axis=normalize(vec3(.41,.79,.46)+low*.92+low2*.38);
 q0+=low*(.72+.62*uShellWarp)+low2*(.20+.31*uShellBreakup);
 q0=lmRot(q0,axis,(zone-.5)*(.66+.92*uShellWarp));
 vec3 warpA=vec3(bmN(q0*.173+vec3(5.7,-3.9,2.6)),bmN(q0*.149+vec3(-4.6,8.1,11.3)),bmN(q0*.191+vec3(9.4,3.2,-7.5)))-.5;
 q0+=warpA*(.32+.54*uShellWarp);
 q0.x+=sin(q0.y*.31+q0.z*.13+zone*2.1)*.11*uShellBreakup;
 q0.y+=sin(q0.z*.27-q0.x*.09-zone*1.7)*.08*uShellBreakup;
 q0.z+=sin(q0.x*.29+q0.y*.07+zone*1.3)*.10*uShellBreakup;
 return q0*max(.2,uShellScale);
}
float lmMouthProtect(vec3 x,vec3 c,vec3 r){float q0=length((x-c)/r);float shell=1.-smoothstep(.045,.28,abs(q0-1.));float front=smoothstep(c.z-2.,c.z+3.4,x.z);return shell*front;}
float lmRockGate(vec3 x,vec3 n){
 float t=clamp((x.y+5.82)/52.94,0.,1.);
 float height=smoothstep(.105,.205,t)*(1.-smoothstep(.835,.935,t));
 float wall=smoothstep(.055,.40,1.-abs(n.y));
 float cave=lmMouthProtect(x,vec3(-6.,5.4,8.8),vec3(6.8,4.7,9.));
 float notch=lmMouthProtect(x,vec3(12.,7.,8.),vec3(10.,3.7,8.));
 return clamp(height*wall*(1.-max(cave,notch)),0.,1.);
}
float lmCoverage(vec3 x){float zone=bmN(x*.027+vec3(23.7,-8.4,16.2));float edge=clamp(1.-uShellCoverage,0.,.85);return smoothstep(edge,min(1.,edge+.24),zone);}
float lmRockShell(vec3 rawQ,vec3 n){
 if(uScope<=0.)return 0.;
 vec3 p0=lmDomain(rawQ);
 float broad=clamp(lmShapeBand(p0,83.,6.,.0012),-1.,1.);
 float middle=clamp(lmShapeBand(p0,83.,26.,.0012),-1.,1.);
 float pores=smoothstep(.56,.67,lmShapeBand(p0,83.,80.,.0012));
 float shellValue=.050*broad+.021*middle-.038*pores;
 float rawShell=clamp(uScope*(.72+.28*uShellContrast)*shellValue,-.110,.095);
 return rawShell*lmRockGate(rawQ,n)*lmCoverage(rawQ);
}
float lmSoilShell(vec3 rawQ,vec3 n){
 if(uGroundMicro<=0.)return 0.;
 vec3 p0=lmDomain(rawQ*.72+vec3(5.3,-2.1,8.7));
 float broad=clamp(lmShapeBand(p0,211.,5.,.0012),-1.,1.);
 float middle=clamp(lmShapeBand(p0,211.,19.,.0012),-1.,1.);
 float pores=smoothstep(.58,.70,lmShapeBand(p0,211.,58.,.0012));
 float shellValue=.025*broad+.010*middle-.014*pores;
 return clamp(uGroundMicro*shellValue,-.045,.040)*smoothstep(.30,.86,n.y);
}
float lmShell(vec3 rawQ,vec3 n,float kind){if(kind<.5)return lmRockShell(rawQ,n);if(kind>2.5&&kind<3.5)return lmSoilShell(rawQ,n);return 0.;}
void main(){
 vec3 z=aRest*.13;bmQ=bmCoordinates(z);uint family=uint(aD.w+.1);uint seed=bmColorSeed(family==2u?9298u:family==5u?10365u:family==6u?7179u:8231u);bmData=vec3(bmSeedNoise(z*2.2,seed),bmSeedNoise(z*7.5,seed+88u),bmSeedNoise(z*26.,seed+19u));
 vec3 local=aP,localN=aN;float shell=lmShell(aRest,aN,aD.x);bool shaped=(aD.x<.5)||(aD.x>2.5&&aD.x<3.5);
 if(shaped){
  local+=aN*shell;
  vec3 tangent=normalize(cross(abs(aN.z)<.9?vec3(0,0,1):vec3(1,0,0),aN));
  vec3 bitangent=normalize(cross(aN,tangent));float eps=aD.x<.5?.075:.11;
  float sx=lmShell(aRest+tangent*eps,aN,aD.x),sz=lmShell(aRest+bitangent*eps,aN,aD.x);
  vec3 tx=tangent*eps+aN*(sx-shell),tz=bitangent*eps+aN*(sz-shell);
  localN=normalize(cross(tx,tz));if(dot(localN,aN)<0.)localN=-localN;
 }
 p=local;n0=localN;q=aRest;d=aD;e=aE;gl_Position=uVP*vec4(p,1.);
}`;'''

s, n = re.subn(r"const VS=`#version 300 es.*?`;\nconst FS=", new_vs + "\nconst FS=", s, count=1, flags=re.S)
assert n == 1, "vertex shader block not found"

# Add a precise scope note without changing the rest of the accepted scene.
info_anchor = "<p>R5 冻结这份水蚀石灰岩的宏观岩体、洞口、峰脚、土体和落石几何。"
assert info_anchor in s
s = s.replace(
    info_anchor,
    "<p><b>G3.T1：</b>仅将 Tiles Mother 08F.2 的统一全壳层形体方法接入 G3：同一个 17 层 Microscope 标量场移动岩壁和土体顶点，并以有限差分重算法线；不改洞口、山体主形、材质、光照、相机或任务系统。</p>" + info_anchor,
    1,
)

raw_out = s.encode("utf-8")
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_bytes(raw_out)

build = {
    "schema": "LANDSCAPE_R5_K2_G3T1_TILES_SHAPE_V1",
    "date": "2026-09-17",
    "sourcePath": str(SRC.relative_to(ROOT)),
    "sourceSha256": source_sha,
    "candidatePath": str(OUT.relative_to(ROOT)),
    "candidateSha256": sha256(raw_out),
    "candidateBytes": len(raw_out),
    "acceptedVisualBaseline": "R5.K2.G3",
    "tilesTransfer": {
        "sourceRepo": "haihao0307/HOUSE",
        "sourceCommit": "397e94b85fa9c16a01afed319595e0022d12a74b",
        "sourcePath": "tiles-mother/r2-closeout-08f-final/START_HERE.html",
        "method": "one 17-octave scalar field displaces the complete visible shell before projection and recomputes normals",
        "rockVertexDisplacement": True,
        "soilVertexDisplacement": True,
        "materialOnly": False,
        "wholeObjectDomainWarp": False,
    },
    "preserved": [
        "G3 macro rock", "G3 caves and notches", "G3 camera", "G3 material", "G3 lighting", "G3 ground layout", "G3 controls"
    ],
    "visualApproved": False,
    "productionReady": False,
}
BUILD.write_text(json.dumps(build, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(build, ensure_ascii=False))
