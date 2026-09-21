from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'workbenches/landscape-small-karst-field-r2-5-steep-sea-cut/index.html'
OUT_DIR = ROOT / 'workbenches/landscape-small-karst-field-r2-5-1-gpu-compat'
OUT = OUT_DIR / 'index.html'
BUILD = OUT_DIR / 'build.json'
source = SRC.read_text(encoding='utf-8')
source_sha = hashlib.sha256(source.encode('utf-8')).hexdigest()

def rep(old,new,label):
    global source
    if old not in source: raise RuntimeError(label)
    source=source.replace(old,new,1)

source=source.replace('帕劳海蚀卡斯特 R2.5 · 下部陡切','帕劳海蚀卡斯特 R2.5.1 · GPU 兼容',2)
source=source.replace('PALAU_KARST_R25_STEEP_LOWER_SEA_CUT','PALAU_KARST_R251_GPU_COMPAT')
source=source.replace('R2.5 · 海蚀层下移 · 陡切窄颈 · 底脚自然外展 · 三形态','R2.5.1 · RGBA8 兼容渲染 · 海蚀形体不变 · 三形态')
source=source.replace('下部陡切海蚀层 · 窄颈下行 · 底脚平缓外展','下部陡切海蚀层 · 窄颈下行 · RGBA8 跨 GPU 兼容渲染')
source=source.replace('in vec2 vUv;\n','')
rep('layout(location=1) out vec4 gNormal;','layout(location=1) out vec4 gNormal;\nlayout(location=2) out vec4 gMeta;','third output')
pack_code=r'''\nvec2 pack16(float v){\n  float q=floor(clamp(v,0.0,1.0)*65535.0+0.5);\n  float hi=floor(q/256.0);\n  return vec2(hi,q-hi*256.0)/255.0;\n}\nvec2 octEncode(vec3 n){\n  n/=abs(n.x)+abs(n.y)+abs(n.z)+1e-8;\n  vec2 e=n.xy;\n  if(n.z<0.0)e=(1.0-abs(e.yx))*sign(e.xy);\n  return e*0.5+0.5;\n}\nvoid writePacked(vec3 p,vec3 n,float kind){\n  const vec3 LO=vec3(-80.0,-16.0,-80.0);\n  const vec3 HI=vec3( 80.0, 16.0, 80.0);\n  vec3 q=clamp((p-LO)/(HI-LO),0.0,1.0);\n  vec2 px=pack16(q.x),py=pack16(q.y),pz=pack16(q.z);\n  gPosition=vec4(px,py);\n  gNormal=vec4(octEncode(normalize(n)),0.0,1.0);\n  gMeta=vec4(pz,clamp(floor(kind+0.5),0.0,3.0)/3.0,1.0);\n}\n'''
rep('\nvoid main(){\n  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;',pack_code+'\nvoid main(){\n  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;','pack insertion')
rep('if(t>FAR){gPosition=vec4(0.,0.,0.,0.);gNormal=vec4(rd,1.);return;}','if(t>FAR){writePacked(vec3(0.0),rd,0.0);return;}','miss')
rep('gPosition=vec4(p,hit.y);\n  gNormal=vec4(N,occ);','writePacked(p,N,hit.y);','hit')
rep('uniform sampler2D uNormalTex;','uniform sampler2D uNormalTex;\nuniform sampler2D uMetaTex;','meta uniform')
unpack_code=r'''\nfloat unpack16(vec2 b){\n  vec2 v=floor(b*255.0+0.5);\n  return (v.x*256.0+v.y)/65535.0;\n}\nvec3 octDecode(vec2 e){\n  e=e*2.0-1.0;\n  vec3 n=vec3(e,1.0-abs(e.x)-abs(e.y));\n  if(n.z<0.0)n.xy=(1.0-abs(n.yx))*sign(n.xy);\n  return normalize(n);\n}\n'''
old='''void main() {\n  ivec2 pixel = ivec2(gl_FragCoord.xy);\n  vec4 gp = texelFetch(uPositionTex, pixel, 0);\n  vec4 gn = texelFetch(uNormalTex, pixel, 0);'''
new=unpack_code+'''\nvoid main() {\n  ivec2 pixel = ivec2(gl_FragCoord.xy);\n  vec4 pp = texelFetch(uPositionTex, pixel, 0);\n  vec4 nn = texelFetch(uNormalTex, pixel, 0);\n  vec4 pm = texelFetch(uMetaTex, pixel, 0);\n  const vec3 PACK_LO=vec3(-80.0,-16.0,-80.0);\n  const vec3 PACK_HI=vec3( 80.0, 16.0, 80.0);\n  vec3 packedPos=vec3(unpack16(pp.rg),unpack16(pp.ba),unpack16(pm.rg));\n  float hitKind=floor(pm.b*3.0+0.5);\n  vec4 gp=vec4(mix(PACK_LO,PACK_HI,packedPos),hitKind);\n  vec4 gn=vec4(octDecode(nn.rg),1.0);'''
rep(old,new,'unpack block')
rep(' if(!gl.getExtension("EXT_color_buffer_float"))throw Error("浏览器缺少 EXT_color_buffer_float");\n','', 'extension')
rep('const gl=canvas.getContext("webgl2",{antialias:false,alpha:false,preserveDrawingBuffer:false,powerPreference:"high-performance"});','const gl=canvas.getContext("webgl2",{antialias:false,alpha:false,preserveDrawingBuffer:false,powerPreference:"default"});','context preference')
rep('let geometryProgram,materialProgram,UG,UM,vao,framebuffer,positionTex,normalTex,targetW=0,targetH=0;','let geometryProgram,materialProgram,UG,UM,vao,framebuffer,positionTex,normalTex,metaTex,targetW=0,targetH=0;','meta variable')
rep('UM=locs(materialProgram,["uRes","uPositionTex","uNormalTex",','UM=locs(materialProgram,["uRes","uPositionTex","uNormalTex","uMetaTex",','meta loc')
rep('vao=gl.createVertexArray();framebuffer=gl.createFramebuffer();positionTex=gl.createTexture();normalTex=gl.createTexture();','if(gl.getParameter(gl.MAX_DRAW_BUFFERS)<3||gl.getParameter(gl.MAX_COLOR_ATTACHMENTS)<3)throw Error("浏览器可用颜色附件少于 3 个");\n vao=gl.createVertexArray();framebuffer=gl.createFramebuffer();positionTex=gl.createTexture();normalTex=gl.createTexture();metaTex=gl.createTexture();','create meta')
rep('function tex(t,w,h){gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,w,h,0,gl.RGBA,gl.HALF_FLOAT,null)}',
'function tex(t,w,h){gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null)}','rgba8')
rep('function targets(w,h){if(w===targetW&&h===targetH)return;targetW=w;targetH=h;tex(positionTex,w,h);tex(normalTex,w,h);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,positionTex,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,normalTex,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);const s=gl.checkFramebufferStatus(gl.FRAMEBUFFER);gl.bindFramebuffer(gl.FRAMEBUFFER,null);if(s!==gl.FRAMEBUFFER_COMPLETE)throw Error("framebuffer incomplete 0x"+s.toString(16))}',
'function targets(w,h){if(w===targetW&&h===targetH)return;targetW=w;targetH=h;tex(positionTex,w,h);tex(normalTex,w,h);tex(metaTex,w,h);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,positionTex,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,normalTex,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT2,gl.TEXTURE_2D,metaTex,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1,gl.COLOR_ATTACHMENT2]);const s=gl.checkFramebufferStatus(gl.FRAMEBUFFER);gl.bindFramebuffer(gl.FRAMEBUFFER,null);if(s!==gl.FRAMEBUFFER_COMPLETE)throw Error("framebuffer incomplete 0x"+s.toString(16))}','targets')
rep('function drawGeometry(eye,basis){gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(geometryProgram);',
'function drawGeometry(eye,basis){gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.viewport(0,0,canvas.width,canvas.height);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.useProgram(geometryProgram);','geometry state')
rep('gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,normalTex);gl.uniform1i(UM.uNormalTex,1);gl.drawArrays(gl.TRIANGLES,0,3)}',
'gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,normalTex);gl.uniform1i(UM.uNormalTex,1);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,metaTex);gl.uniform1i(UM.uMetaTex,2);gl.drawArrays(gl.TRIANGLES,0,3)}','material bind meta')
probe='''\nfunction outputVisible(){const pts=[[.5,.5],[.12,.15],[.88,.15],[.12,.82],[.88,.82]],px=new Uint8Array(4);let sum=0;for(const p of pts){gl.readPixels(Math.min(canvas.width-1,Math.max(0,Math.floor(canvas.width*p[0]))),Math.min(canvas.height-1,Math.max(0,Math.floor(canvas.height*p[1]))),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);sum+=px[0]+px[1]+px[2];}return sum>120;}\n'''
rep('const startedAt=performance.now();let first=true;',probe+'const startedAt=performance.now();let first=true;','probe function')
rep('if(first){first=false;const loadMs=Math.round(performance.now()-startedAt);window.__KARST_READY__=true;window.__KARST_METRICS__={firstFrameMs:loadMs,quality:state.quality};document.documentElement.dataset.karstReady="true";document.documentElement.dataset.firstFrameMs=String(loadMs);document.getElementById("badge").textContent=`首帧 ${loadMs} ms · 标准质量 · 强蓝灰 V2.6 · 滚轮/按钮缩放`}',
'if(first){if(!outputVisible())throw Error("GPU 已完成绘制但输出仍为空，已阻止伪成功");first=false;const loadMs=Math.round(performance.now()-startedAt);window.__KARST_READY__=true;window.__KARST_METRICS__={firstFrameMs:loadMs,quality:state.quality,renderer:"rgba8-packed"};document.documentElement.dataset.karstReady="true";document.documentElement.dataset.karstOutputVisible="true";document.documentElement.dataset.firstFrameMs=String(loadMs);document.getElementById("badge").textContent=`首帧 ${loadMs} ms · RGBA8 GPU兼容 · 强蓝灰 V2.6 · 滚轮/按钮缩放`}','first frame marker')
rep('sync();resize();requestAnimationFrame(frame);window.__KARST_STATE__=state;',
'canvas.addEventListener("webglcontextlost",e=>{e.preventDefault();const x=document.getElementById("error");x.style.display="block";x.textContent="WebGL 上下文丢失，正在等待浏览器恢复。";document.documentElement.dataset.karstFailure="context-lost"});canvas.addEventListener("webglcontextrestored",()=>location.reload());\nsync();resize();requestAnimationFrame(frame);window.__KARST_STATE__=state;','context events')
source=source.replace('renderer:"two-pass-r25-steep-lower-sea-cut"','renderer:"two-pass-r251-rgba8-packed-gpu-compat"')
source=source.replace('material:"Brick Mother V2.6 + tidal wet/salt band"','material:"Brick Mother V2.6 + RGBA8 packed geometry buffers"')
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT.write_text(source, encoding='utf-8')
report = {
  'schema': 'LANDSCAPE_PALAU_KARST_R251_GPU_COMPAT',
  'source': str(SRC.relative_to(ROOT)),
  'sourceSha256': source_sha,
  'output': str(OUT.relative_to(ROOT)),
  'outputSha256': hashlib.sha256(source.encode('utf-8')).hexdigest(),
  'renderer': 'WebGL2 RGBA8 three-target packed geometry buffer',
  'removedRequirements': ['EXT_color_buffer_float', 'RGBA16F render targets'],
  'strictDriverFixes': ['remove unused fragment varying', 'default power preference', 'context-loss handler', 'first-frame non-black probe'],
  'shapeChanged': False,
  'materialChanged': False,
  'visualApproved': False,
}
BUILD.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
