from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-surface-r5-k2/index.html"
OUT = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r1/index.html"
BUILD = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r1/build.json"
EXPECTED = "919df1a9eff14a6d310d4aca93a2ccfcc9a59bb70a9b44b0bfe7d57aed335709"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


raw = SRC.read_bytes()
actual = sha256(raw)
assert actual == EXPECTED, f"R5.K2 source lock mismatch: {actual}"
s = raw.decode("utf-8")

marker = "function generateScene(config,progress=()=>{}){"
assert s.count(marker) == 1, "generateScene integration point changed"

geometry_kernel = r'''function microscopeGeometryR1(mesh,options={}){
const W=World,P0=mesh.rest,N0=mesh.N,I=mesh.indices,count=P0.length/3;
const clamp=W.clamp,smooth=W.smooth;
const requestedAmp=Number.isFinite(options.amp)?options.amp:.22,ell=options.scale||2.6,layers=Math.max(1,Math.min(9,options.layers||6)),dir=(options.directionDeg??18)*Math.PI/180,warp=options.warp??.42,bias=options.bias??.32;
let minY=Infinity,maxY=-Infinity;for(let i=0;i<count;i++){let y=P0[i*3+1];minY=Math.min(minY,y);maxY=Math.max(maxY,y)}const span=Math.max(1e-6,maxY-minY);
function kernel(u,v,w){return Math.cos(Math.cos(w)*Math.cos(u)+Math.cos(v)*Math.cos(v)+Math.cos(v)*Math.cos(u))}
function mapped(x,y,z,f,mean){let th=Math.atan2(z,x),ang=dir+warp*(.32*Math.sin(y*.16)+.18*Math.sin(th*2.3+y*.07)),ca=Math.cos(ang),sa=Math.sin(ang),qx=(ca*x-sa*z)/ell,qz=(sa*x+ca*z)/ell,qy=y/(ell*2.1);return kernel(qx*f,qy*f,qz*f)-mean}
function mouthProtect(x,y,z,cx,cy,cz,rx,ry,rz){let q=Math.hypot((x-cx)/rx,(y-cy)/ry,(z-cz)/rz),shell=1-smooth(.055,.24,Math.abs(q-1)),front=smooth(cz-1.5,cz+3.0,z);return shell*front}
function gateAt(i){let k=i*3,x=P0[k],y=P0[k+1],z=P0[k+2],ny=Math.abs(N0[k+1]),t=(y-minY)/span,height=smooth(.12,.22,t)*(1-smooth(.82,.92,t)),wall=smooth(.08,.48,1-ny),cave=mouthProtect(x,y,z,-6,5.4,8.8,6.8,4.7,9),notch=mouthProtect(x,y,z,12,7,8,10,3.7,8);return clamp(height*wall*(1-Math.max(cave,notch)))}
const means=[];for(let j=0,f=1;j<layers;j++,f*=2){let sum=0,n=0;for(let i=0;i<count;i+=11){let k=i*3,x=P0[k],y=P0[k+1],z=P0[k+2],th=Math.atan2(z,x),ang=dir+warp*(.32*Math.sin(y*.16)+.18*Math.sin(th*2.3+y*.07)),ca=Math.cos(ang),sa=Math.sin(ang),qx=(ca*x-sa*z)/ell,qz=(sa*x+ca*z)/ell,qy=y/(ell*2.1);sum+=kernel(qx*f,qy*f,qz*f);n++}means[j]=sum/Math.max(1,n)}
function detailAt(i){let k=i*3,x=P0[k],y=P0[k+1],z=P0[k+2],sum=0,f=1;for(let j=0;j<layers;j++,f*=2)sum+=.5*mapped(x,y,z,f,means[j])/f;return sum}
function flipCount(P){let flips=0;for(let q=0;q<I.length;q+=3){let ia=I[q]*3,ib=I[q+1]*3,ic=I[q+2]*3,ux=P[ib]-P[ia],uy=P[ib+1]-P[ia+1],uz=P[ib+2]-P[ia+2],vx=P[ic]-P[ia],vy=P[ic+1]-P[ia+1],vz=P[ic+2]-P[ia+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,bux=P0[ib]-P0[ia],buy=P0[ib+1]-P0[ia+1],buz=P0[ib+2]-P0[ia+2],bvx=P0[ic]-P0[ia],bvy=P0[ic+1]-P0[ia+1],bvz=P0[ic+2]-P0[ia+2],bnx=buy*bvz-buz*bvy,bny=buz*bvx-bux*bvz,bnz=bux*bvy-buy*bvx;if(nx*bnx+ny*bny+nz*bnz<0)flips++}return flips}
function build(A){let P=new Float32Array(P0),disp=new Float32Array(count),sum2=0,maxD=0,protectedCount=0,protectedDrift=0;for(let i=0;i<count;i++){let k=i*3,g=gateAt(i);if(g<1e-7){protectedCount++;continue}let d=detailAt(i),eroded=d-bias*Math.max(0,d)*Math.max(0,d),off=A*g*eroded;disp[i]=off;P[k]=P0[k]+N0[k]*off;P[k+1]=P0[k+1]+N0[k+1]*off;P[k+2]=P0[k+2]+N0[k+2]*off;let ad=Math.abs(off);maxD=Math.max(maxD,ad);sum2+=off*off}for(let i=0;i<count;i++)if(gateAt(i)<1e-7){let k=i*3;if(P[k]!==P0[k]||P[k+1]!==P0[k+1]||P[k+2]!==P0[k+2])protectedDrift++}let flips=flipCount(P);return{P,disp,maxD,rms:Math.sqrt(sum2/count),protectedCount,protectedDrift,flips}}
let attempts=[requestedAmp,requestedAmp*.75,requestedAmp*.5,requestedAmp*.25,0],chosen=null,effectiveAmp=0;for(let A of attempts){let r=build(A);if(r.flips===0&&r.protectedDrift===0){chosen=r;effectiveAmp=A;break}}if(!chosen)throw Error('Microscope geometry safety gate failed');
let N=World.normals(chosen.P,I),maxNormal=0;for(let k=0;k<N.length;k+=3){let d=clamp(N0[k]*N[k]+N0[k+1]*N[k+1]+N0[k+2]*N[k+2],-1,1);maxNormal=Math.max(maxNormal,Math.acos(d)*180/Math.PI)}
mesh.positions=chosen.P;mesh.N=N;mesh.microscopeGeometry={schema:'LANDSCAPE_MICROSCOPE_GEOMETRY_R1',requestedAmplitudeM:requestedAmp,effectiveAmplitudeM:effectiveAmp,scaleM:ell,layers,directionDeg:(options.directionDeg??18),warp,bias,maxDisplacementM:chosen.maxD,rmsDisplacementM:chosen.rms,maxNormalAngleDeg:maxNormal,protectedVertexCount:chosen.protectedCount,protectedDriftCount:chosen.protectedDrift,triangleFlipCount:chosen.flips,referenceDomain:'immutable main.rest P0',cameraAffectsGeometry:false,timeAffectsStaticRock:false,fieldCoupled:false};return mesh.microscopeGeometry}
'''

s = s.replace(marker, geometry_kernel + "\n" + marker, 1)

old_main = "const grid=fullMain.grid;main.name='主岩体';main.kind=0;main.event=0;main.rest=main.positions.slice();main.N=W.normals(main.positions,main.indices);parts.push(main);"
new_main = "const grid=fullMain.grid;main.name='主岩体';main.kind=0;main.event=0;main.rest=main.positions.slice();main.N=W.normals(main.positions,main.indices);const geometryAmp=config.stage<2?0:config.stage===2?.12:config.stage===3?.18:.22;const geometryMicroscope=microscopeGeometryR1(main,{amp:geometryAmp,scale:2.6,layers:6,directionDeg:18,warp:.42,bias:.32});parts.push(main);"
assert old_main in s, "main rock integration point missing"
s = s.replace(old_main, new_main, 1)

old_report = "const report={config:{...config},builtInMs:performance.now()-start,"
new_report = "const report={config:{...config},microscopeGeometry:geometryMicroscope,builtInMs:performance.now()-start,"
assert old_report in s, "report integration point missing"
s = s.replace(old_report, new_report, 1)

s = s.replace("<title>Landscape Mother · 水蚀石灰岩 R5.K2 Organic Microscope</title>", "<title>Landscape Mother · 水蚀石灰岩 R5.K2.G1 Real Geometry</title>", 1)
s = s.replace("<h1>葡萄峰丛 · 水蚀岩壁 R5.K2</h1>", "<h1>葡萄峰丛 · 水蚀岩壁 R5.K2.G1</h1>", 1)
s = s.replace("Brick 石材 · <span id=\"seedLabel\">种子 83</span> · Organic Microscope", "Brick 石材 · <span id=\"seedLabel\">种子 83</span> · Organic Microscope + Real Geometry", 1)
s = s.replace("只在现有岩石表面采样并改变微法线与粗糙度，不参与峰体、洞口、峰脚、土体或落石位置。", "显示壳层继续只改微法线与粗糙度；另有真实几何位移核只作用于主岩体非保护区，峰顶、峰脚和主洞口保持冻结。", 1)
s = s.replace("R5 冻结这份水蚀石灰岩的宏观岩体、洞口、峰脚、土体和落石几何。Macroscopic microscope 只读取最终表面的固定世界坐标，并在极薄显示壳层中改变微法线、粗糙度和极小尺度明暗响应，不进入体积生成器。", "R5 冻结这份水蚀石灰岩的宏观岩体、洞口、峰脚、土体和落石几何。R5.K2.G1 在不可变 P0 上增加受门控的真实顶点位移；峰顶、峰脚与两个主洞口前缘属于硬保护区。原 Macroscopic microscope 显示壳层仍只改变微法线、粗糙度和极小尺度明暗响应。", 1)

assert "microscopeGeometryR1" in s
assert "fieldCoupled:false" in s
assert "main.rest=main.positions.slice()" in s

OUT.parent.mkdir(parents=True, exist_ok=True)
out = s.encode("utf-8")
OUT.write_bytes(out)

build = {
    "schema": "LANDSCAPE_R5_K2_MICROSCOPE_REAL_GEOMETRY_INTEGRATION_R1",
    "date": "2026-09-16",
    "sourceCommit": "e7e04ffab58d97edd4442443fcba682d3f2c9de5",
    "sourcePath": "workbenches/landscape-surface-r5-k2/index.html",
    "sourceSha256": EXPECTED,
    "candidatePath": "workbenches/landscape-surface-r5-k2-geometry-r1/index.html",
    "candidateSha256": sha256(out),
    "candidateBytes": len(out),
    "acceptedMacroCommit": "039d3a7f32c73ff3ac292c5bbb18c3f6f5535b90",
    "geometry": {
        "reference": "immutable main.rest P0",
        "defaultAmplitudeM": 0.22,
        "stage2AmplitudeM": 0.12,
        "stage3AmplitudeM": 0.18,
        "scaleM": 2.6,
        "layers": 6,
        "directionDeg": 18,
        "warp": 0.42,
        "bias": 0.32,
        "automaticTriangleFlipBackoff": True,
        "protected": ["peak top", "peak foot", "primary cave forward surface/rim", "secondary notch forward surface/rim"],
    },
    "macroGeometryReplacement": False,
    "indexOrderChangedByIntegration": False,
    "cameraAffectsGeometry": False,
    "timeAffectsStaticRock": False,
    "geometryFieldCoupled": False,
    "visualApproved": False,
    "productionReady": False,
}
BUILD.write_text(json.dumps(build, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(build, ensure_ascii=False))
