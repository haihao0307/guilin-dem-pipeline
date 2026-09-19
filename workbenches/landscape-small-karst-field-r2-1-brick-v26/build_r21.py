from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-small-karst-field-r2-brick-v26/index.html"
OUT = ROOT / "workbenches/landscape-small-karst-field-r2-1-brick-v26/index.html"
BUILD = ROOT / "workbenches/landscape-small-karst-field-r2-1-brick-v26/build.json"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


source = SRC.read_text(encoding="utf-8")
source_bytes = source.encode("utf-8")
assert "小尺度帕劳卡斯特 R2" in source
assert "STRICT_BRICK_V26_STONE_BLOCK" in source

shader_match = re.search(
    r"const VS=`(?P<vs>.*?)`;\s*const FS=`(?P<fs>.*?)`;\s*function compile",
    source,
    re.S,
)
assert shader_match, "R2 shader block not found"
vs = shader_match.group("vs")
fs = shader_match.group("fs")

common_start = fs.index("float hash31")
sdf_start = fs.index("float sdEllipsoid")
mat_start = fs.index("struct MatData")
main_start = fs.rindex("void main(){")
common = fs[common_start:sdf_start]
geometry_functions = fs[sdf_start:mat_start]
material_functions = fs[mat_start:main_start]

geom_fs = f'''#version 300 es
precision highp float;
in vec2 vUv;
layout(location=0) out vec4 gPosition;
layout(location=1) out vec4 gNormal;
uniform vec2 uRes;
uniform vec3 uCam;
uniform mat3 uBasis;
uniform float uOverall,uHeight,uWidth,uHoleSize,uCavity,uMacro,uWarp,uDetail,uDetailScale,uSoil;
#define MAX_STEPS 104
#define FAR 80.0
{common}
{geometry_functions}
void main(){{
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec3 ro=uCam,rd=normalize(uBasis*vec3(uv,1.55));
  float t=0.;vec2 hit=vec2(FAR,0.);vec3 p=ro;
  for(int i=0;i<MAX_STEPS;i++){{
    p=ro+rd*t;hit=mapScene(p);
    if(abs(hit.x)<.0016*max(1.,t*.14)||t>FAR)break;
    t+=max(hit.x*.70,.006);
  }}
  if(t>FAR){{gPosition=vec4(0.,0.,0.,0.);gNormal=vec4(rd,1.);return;}}
  vec3 N=normalAt(p);float occ=aoField(p,N);
  gPosition=vec4(p,hit.y);
  gNormal=vec4(N,occ);
}}'''

mat_fs = f'''#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uRes;
uniform sampler2D uPositionTex;
uniform sampler2D uNormalTex;
uniform vec3 uCam;
uniform float uSoil;
uniform int uGray;
{common}
{material_functions}
void main(){{
  ivec2 pixel=ivec2(gl_FragCoord.xy);
  vec4 gp=texelFetch(uPositionTex,pixel,0);
  vec4 gn=texelFetch(uNormalTex,pixel,0);
  if(gp.w<.5){{
    vec3 rd=normalize(gn.xyz);
    vec3 sky=mix(vec3(.035,.040,.043),vec3(.105,.116,.118),clamp(rd.y*.5+.5,0.,1.));
    outColor=vec4(sky,1.);return;
  }}
  vec3 p=gp.xyz,N=normalize(gn.xyz);float occ=clamp(gn.w,0.,1.);
  if(gp.w>1.5){{
    float g=fbmValueFast(p*.18);
    vec3 c=mix(vec3(.05,.055,.052),vec3(.11,.105,.085),g);
    outColor=vec4(linearToSrgb(c),1.);return;
  }}
  MatData m=brickStone(p,N,occ);
  vec3 dpdx=dFdx(p),dpdy=dFdy(p),R1=cross(dpdy,N),R2=cross(N,dpdx);
  float det=dot(dpdx,R1);
  if(abs(det)>.000001){{
    vec3 grad=sign(det)*(dFdx(m.height)*R1+dFdy(m.height)*R2);
    N=normalize(abs(det)*N-grad*.15);
  }}
  vec3 albedo=m.albedo;
  float soilMask=uSoil*smoothstep(.55,.83,N.y)*smoothstep(1.6,5.4,p.y);
  vec3 soilCol=mix(srgbToLinear(vec3(.24,.18,.105)),srgbToLinear(vec3(.33,.28,.13)),fbmValueFast(p*.33+vec3(5.7,0,-8.3)));
  albedo=mix(albedo,soilCol,soilMask*.76);
  albedo=mix(albedo,srgbToLinear(vec3(.18,.25,.09)),soilMask*smoothstep(.54,.78,fbmValueFast(p*.62))*.55);
  if(uGray==1)albedo=vec3(dot(albedo,vec3(.2126,.7152,.0722)));
  vec3 V=normalize(uCam-p),L1=normalize(vec3(-.44,.83,.36)),L2=normalize(vec3(.62,.47,-.63)),L3=normalize(vec3(-.12,.28,-.95));
  vec3 color=vec3(0.);
  color+=shadeLight(N,V,L1,vec3(1.,.975,.94),2.18,albedo,m.rough);
  color+=shadeLight(N,V,L2,vec3(.48,.64,.88),.52,albedo,m.rough);
  color+=shadeLight(N,V,L3,vec3(.86,.62,.42),.18,albedo,m.rough);
  float aocc=clamp(occ-m.cavity*.24,.50,1.);
  color+=albedo*(.31+.14*clamp(N.y*.5+.5,0.,1.));
  color*=aocc;
  color=1.-exp(-color*.96);
  color=pow(max(color,0.),vec3(1.015));
  outColor=vec4(linearToSrgb(color),1.);
}}'''

runtime = r'''function makeShader(type,src,label){
  const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);
  if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(label+' shader compile:\n'+(gl.getShaderInfoLog(sh)||'(empty log)'));
  return sh;
}
function makeProgram(vertexSource,fragmentSource,label){
  const program=gl.createProgram();
  const v=makeShader(gl.VERTEX_SHADER,vertexSource,label+' vertex');
  const f=makeShader(gl.FRAGMENT_SHADER,fragmentSource,label+' fragment');
  gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);
  const ok=gl.getProgramParameter(program,gl.LINK_STATUS),log=gl.getProgramInfoLog(program)||'';
  gl.deleteShader(v);gl.deleteShader(f);
  if(!ok)throw Error(label+' program link:\n'+(log||'(empty log)'));
  return program;
}
function locations(program,names){const result={};for(const name of names)result[name]=gl.getUniformLocation(program,name);return result}
let geometryProgram,materialProgram,UG,UM,vao,framebuffer,positionTex,normalTex,targetW=0,targetH=0;
try{
  if(!gl.getExtension('EXT_color_buffer_float'))throw Error('浏览器缺少 EXT_color_buffer_float，无法运行双程序连续场。');
  geometryProgram=makeProgram(VS,GEOMETRY_FS,'geometry');
  materialProgram=makeProgram(VS,MATERIAL_FS,'Brick V2.6 material');
  UG=locations(geometryProgram,['uRes','uCam','uBasis','uOverall','uHeight','uWidth','uHoleSize','uCavity','uMacro','uWarp','uDetail','uDetailScale','uSoil']);
  UM=locations(materialProgram,['uRes','uPositionTex','uNormalTex','uCam','uSoil','uGray']);
  vao=gl.createVertexArray();gl.bindVertexArray(vao);
  framebuffer=gl.createFramebuffer();positionTex=gl.createTexture();normalTex=gl.createTexture();
}catch(err){const e=document.getElementById('error');e.style.display='block';e.textContent=err.stack||err;document.documentElement.dataset.karstFailure='true';throw err}
function allocTexture(tex,w,h){gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,w,h,0,gl.RGBA,gl.HALF_FLOAT,null)}
function resizeTargets(w,h){if(w===targetW&&h===targetH)return;targetW=w;targetH=h;allocTexture(positionTex,w,h);allocTexture(normalTex,w,h);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,positionTex,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,normalTex,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);const status=gl.checkFramebufferStatus(gl.FRAMEBUFFER);gl.bindFramebuffer(gl.FRAMEBUFFER,null);if(status!==gl.FRAMEBUFFER_COMPLETE)throw Error('双程序缓冲区不完整: 0x'+status.toString(16))}
const state={overall:1,height:1,width:1,holeSize:1,cavity:1.10,macro:1.05,warp:1.20,detail:1.0,detailScale:1,soil:.52,gray:0,theta:.56,phi:1.27,radius:28,target:[0,.4,0]},ids=['overall','height','width','holeSize','cavity','macro','warp','detail','detailScale','soil'];
function suffix(k){return['overall','height','width','holeSize','detailScale'].includes(k)?'×':''}
function sync(){for(const k of ids){const e=document.getElementById(k),o=document.getElementById(k+'Out');e.value=state[k];o.textContent=Number(state[k]).toFixed(2)+suffix(k)}}
ids.forEach(k=>document.getElementById(k).oninput=e=>{state[k]=+e.target.value;document.getElementById(k+'Out').textContent=state[k].toFixed(2)+suffix(k);dirty=true});
document.getElementById('reset').onclick=()=>{Object.assign(state,{overall:1,height:1,width:1,holeSize:1,cavity:1.10,macro:1.05,warp:1.20,detail:1,detailScale:1,soil:.52,gray:0,theta:.56,phi:1.27,radius:28,target:[0,.4,0]});document.getElementById('gray').classList.remove('on');sync();dirty=true};
document.getElementById('panelBtn').onclick=()=>document.getElementById('panel').classList.toggle('hide');
document.getElementById('gray').onclick=e=>{state.gray=1-state.gray;e.currentTarget.classList.toggle('on',!!state.gray);dirty=true};
let dirty=true,drag=false,lx=0,ly=0;
canvas.onpointerdown=e=>{drag=true;lx=e.clientX;ly=e.clientY;canvas.setPointerCapture(e.pointerId)};
canvas.onpointermove=e=>{if(!drag)return;state.theta-=(e.clientX-lx)*.005;state.phi=Math.max(.22,Math.min(2.9,state.phi-(e.clientY-ly)*.004));lx=e.clientX;ly=e.clientY;dirty=true};
canvas.onpointerup=()=>drag=false;canvas.onpointercancel=()=>drag=false;
canvas.onwheel=e=>{e.preventDefault();state.radius=Math.max(11,Math.min(62,state.radius*Math.exp(e.deltaY*.0012)));dirty=true};
function resize(){const dpr=Math.min(devicePixelRatio||1,1.25),w=Math.max(1,Math.floor(innerWidth*dpr)),h=Math.max(1,Math.floor(innerHeight*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);resizeTargets(w,h);dirty=true}}
addEventListener('resize',()=>{try{resize()}catch(err){const e=document.getElementById('error');e.style.display='block';e.textContent=err.stack||err;document.documentElement.dataset.karstFailure='true'}});
function norm(v){const l=Math.hypot(...v)||1;return v.map(x=>x/l)}function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function drawGeometry(eye,basis){gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(geometryProgram);gl.bindVertexArray(vao);gl.uniform2f(UG.uRes,canvas.width,canvas.height);gl.uniform3fv(UG.uCam,eye);gl.uniformMatrix3fv(UG.uBasis,false,basis);for(const k of ids)if(UG['u'+k[0].toUpperCase()+k.slice(1)]!==undefined&&UG['u'+k[0].toUpperCase()+k.slice(1)]!==null)gl.uniform1f(UG['u'+k[0].toUpperCase()+k.slice(1)],state[k]);gl.drawArrays(gl.TRIANGLES,0,3)}
function drawMaterial(eye){gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(materialProgram);gl.bindVertexArray(vao);gl.uniform2f(UM.uRes,canvas.width,canvas.height);gl.uniform3fv(UM.uCam,eye);gl.uniform1f(UM.uSoil,state.soil);gl.uniform1i(UM.uGray,state.gray);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,positionTex);gl.uniform1i(UM.uPositionTex,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,normalTex);gl.uniform1i(UM.uNormalTex,1);gl.drawArrays(gl.TRIANGLES,0,3)}
let firstFrame=true;
function frame(){requestAnimationFrame(frame);try{resize();if(!dirty)return;dirty=false;const cp=Math.cos(state.phi),sp=Math.sin(state.phi),ct=Math.cos(state.theta),st=Math.sin(state.theta),eye=[state.target[0]+state.radius*sp*st,state.target[1]+state.radius*cp,state.target[2]+state.radius*sp*ct],f=norm([state.target[0]-eye[0],state.target[1]-eye[1],state.target[2]-eye[2]]),r=norm(cross(f,[0,1,0])),u=cross(r,f),basis=new Float32Array([r[0],r[1],r[2],u[0],u[1],u[2],f[0],f[1],f[2]]);drawGeometry(eye,basis);drawMaterial(eye);if(firstFrame){firstFrame=false;window.__KARST_READY__=true;document.documentElement.dataset.karstReady='true'}}catch(err){const e=document.getElementById('error');e.style.display='block';e.textContent=err.stack||err;document.documentElement.dataset.karstFailure='true';dirty=false}}
sync();resize();requestAnimationFrame(frame);window.__KARST_STATE__=state;window.__KARST_DIAGNOSTICS__={renderer:'two-pass-continuous-field',material:'Brick Mother V2.6 stone-block locked'};'''

replacement = (
    f"const VS=`{vs}`;\n"
    f"const GEOMETRY_FS=`{geom_fs}`;\n"
    f"const MATERIAL_FS=`{mat_fs}`;\n"
    + runtime
)

script_end = source.index("</script>", shader_match.end())
output = source[: shader_match.start()] + replacement + source[script_end:]
output = output.replace("小尺度帕劳卡斯特 R2", "小尺度帕劳卡斯特 R2.1", 3)
output = output.replace("无预展开网格 · Brick Mother V2.6 石块材质/色彩原样迁移", "无预展开网格 · 双程序连续场 · Brick Mother V2.6 石块材质锁定", 1)
output = output.replace("STRICT_BRICK_V26_STONE_BLOCK", "STRICT_BRICK_V26_STONE_BLOCK_TWO_PASS", 1)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(output, encoding="utf-8")
meta = {
    "schema": "LANDSCAPE_SMALL_KARST_BRICK_V26_R21_TWO_PASS",
    "source": str(SRC.relative_to(ROOT)),
    "sourceSha256": sha256(source_bytes),
    "output": str(OUT.relative_to(ROOT)),
    "outputSha256": sha256(output.encode("utf-8")),
    "renderer": "two-pass continuous-field MRT",
    "geometry": "R2 continuous SDF, unchanged controls and shape",
    "material": "Brick Mother V2.6 stone-block field/palette/roughness/micro-normal block copied from R2 strict transfer",
    "holeSizeControl": [0.35, 1.85],
    "originalR1Changed": False,
    "visualApproved": False,
}
BUILD.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(meta, ensure_ascii=False))
