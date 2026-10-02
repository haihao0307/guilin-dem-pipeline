#!/usr/bin/env python3
"""Same micro-surface functions, scheduled in small full-resolution float passes."""
from pathlib import Path
import re,json,sys,subprocess
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[2]/'workbenches/landscape-terrain-influence-tool-v07'
p=root/'index.html';s=p.read_text()
oldfs=re.search(r'const FS=`(.*?)`;',s,re.S).group(1)
functions=oldfs[oldfs.index('float bmH('):oldfs.index('float mmSurface(')]
fieldfs='''#version 300 es
precision highp float;
in vec3 p;in vec3 n0;in vec3 q;in vec4 d;in vec3 e;in vec3 bmQ;in vec3 bmData;out vec4 frag;
uniform float uShellDirection,uShellScale,uShellWarp,uShellBreakup,uShellContrast,uShellCoverage,uFieldScale;
uniform vec3 uFieldShift;uniform int uSection,uMode;
'''+functions+'''
void main(){bool cap=d.x>3.5&&d.x<5.5;if(uSection==1&&!cap&&p.z>.001)discard;
if(!(d.x<2.5||(d.x>3.5&&d.x<4.5))&&uMode!=5){frag=vec4(0);return;}
frag=vec4(mmControlledData(q*uFieldScale+uFieldShift),1.);}
'''
newfs=oldfs.replace('out vec4 frag;','out vec4 frag;uniform highp sampler2D uField0,uField1;',1)
old='vec3 mmData=mmControlledData(q),mmFineData=mmControlledData(q*1.37+vec3(2.9,-1.7,4.1));'
assert old in newfs
newfs=newfs.replace(old,'vec3 mmData=texelFetch(uField0,ivec2(gl_FragCoord.xy),0).xyz,mmFineData=texelFetch(uField1,ivec2(gl_FragCoord.xy),0).xyz;')
newfs=newfs.replace('vec3 m=mmControlledData(q);float v=', 'vec3 m=texelFetch(uField0,ivec2(gl_FragCoord.xy),0).xyz;float v=')
s=s.replace('const FS=`'+oldfs+'`;', 'const FS=`'+newfs+'`;\nconst FIELD_FS='+json.dumps(fieldfs)+';',1)
start=s.index('function draw(){');end=s.index('function sync()',start);draw=s[start:end]
a=draw.index('gl.useProgram(program);');b=draw.index('renderTimes.push(');paint=draw[a:b]
helper='function paintScene(vp){'+paint+'}\n'
newdraw=r'''function draw(){
 if(!dirty||busy||baking)return;requestSurfaceRefresh();let t0=performance.now();dirty=false;eye=eyePos();
 const vp=mm(projection(innerWidth<640?.75:.61,canvas.width/canvas.height,.15,1400),look(eye,state.target));
 ensureFieldTargets();const finalProgram=program,finalU=U;
 program=fieldProgram;U=fieldU;gl.bindFramebuffer(gl.FRAMEBUFFER,fieldFbo);
 for(let k=0;k<2;k++){
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,fieldTextures[k],0);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
  gl.uniform1f(gl.getUniformLocation(program,'uFieldScale'),k?1.37:1);
  gl.uniform3fv(gl.getUniformLocation(program,'uFieldShift'),k?[2.9,-1.7,4.1]:[0,0,0]);paintScene(vp);
 }
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);program=finalProgram;U=finalU;
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
 for(let k=0;k<2;k++){gl.activeTexture(gl.TEXTURE0+k);gl.bindTexture(gl.TEXTURE_2D,fieldTextures[k]);gl.uniform1i(gl.getUniformLocation(program,'uField'+k),k);}
 paintScene(vp);gl.activeTexture(gl.TEXTURE0);
 renderTimes.push(performance.now()-t0);if(renderTimes.length>200)renderTimes.shift();let err=gl.getError();if(err!==gl.NO_ERROR)errorLog.push('GL:'+err);
}
'''
fieldinit=r'''
let fieldProgram=null,fieldU={},fieldTextures=[],fieldFbo=null,fieldDepth=null,fieldSize='';
function initFieldProgram(){
 if(!gl.getExtension('EXT_color_buffer_float'))throw Error('此显卡缺少 EXT_color_buffer_float；已停止，不改变原地形。');
 const sh=(type,src)=>{const x=gl.createShader(type);gl.shaderSource(x,src);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(x));return x;};
 fieldProgram=gl.createProgram();gl.attachShader(fieldProgram,sh(gl.VERTEX_SHADER,VS));gl.attachShader(fieldProgram,sh(gl.FRAGMENT_SHADER,FIELD_FS));gl.linkProgram(fieldProgram);
 if(!gl.getProgramParameter(fieldProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(fieldProgram));
 for(let k of Object.keys(U))fieldU[k]=gl.getUniformLocation(fieldProgram,k);
}
function ensureFieldTargets(){
 const size=canvas.width+'x'+canvas.height;if(size===fieldSize)return;
 fieldTextures.forEach(t=>gl.deleteTexture(t));if(fieldDepth)gl.deleteRenderbuffer(fieldDepth);if(fieldFbo)gl.deleteFramebuffer(fieldFbo);
 fieldFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fieldFbo);
 fieldTextures=[0,1].map(()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,canvas.width,canvas.height,0,gl.RGBA,gl.FLOAT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;});
 fieldDepth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,fieldDepth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,canvas.width,canvas.height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,fieldDepth);
 gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,fieldTextures[0],0);
 if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('材质函数缓冲不完整，已停止');
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);fieldSize=size;
}
'''
s=s[:start]+helper+newdraw+s[end:]
s=s.replace('try{initGL();controls();','try{initGL();initFieldProgram();controls();',1)
s=s.replace('function pixels(){',fieldinit+'\nfunction pixels(){',1)
p.write_text(s)
contract=root/'BUILD_CONTRACT.json';m=json.loads(contract.read_text());m.update({'fragmentShaderChanged':True,'fragmentFieldScheduling':'same-original-functions-in-three-full-resolution-passes','fieldBuffers':'RGBA32F','materialFunctionReplaced':False});contract.write_text(json.dumps(m,indent=2))
for i,(attrs,body) in enumerate(re.findall(r'<script([^>]*)>(.*?)</script>',s,re.S)):
 if 'text/plain' in attrs:continue
 q=Path('/tmp')/f'lm07-split-{i}.js';q.write_text(body);subprocess.run(['node','--check',str(q)],check=True)
print('Split original micro fields into RGBA32F passes without replacing their formulas')
