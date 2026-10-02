#!/usr/bin/env python3
"""Full geometry. Sample original material functions in production, not each frame.
This is explicitly a vertex-sampled interactive material preview, NOT pixel parity.
"""
from pathlib import Path
import re,json,sys,subprocess
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[2]/'workbenches/landscape-terrain-influence-tool-v07'
p=root/'index.html';s=p.read_text();fs=re.search(r'const FS=`(.*?)`;',s,re.S).group(1)
helpers=fs[fs.index('float bmH('):fs.index('void main(){')]
main=fs[fs.index('void main(){'):fs.index('if(uMode==1)')]
def cutblock(s,token,replacement):
 a=s.index(token);b=s.index('{',a);level=1;c=b+1
 while level:
  if s[c]=='{':level+=1
  elif s[c]=='}':level-=1
  c+=1
 return s[:a]+replacement+s[c:]
main=main.replace('if(uSection==1&&!cap&&p.z>.001)discard;','').replace('if(!gl_FrontFacing)N=-N;','')
main=cutblock(main,'if(uMicro>0.&&uMode==0&&!cap)', 'outHeight=height*(.42/.13);')
main=cutblock(main,'if((d.x>2.5&&d.x<3.5)&&uMode==0&&uGroundMicro>0.)', 'outHeight=(noise(vec3(p.x*.72,p.y*.31,p.z*.67)+vec3(4.2,-7.1,11.3))-.5)*.012+(noise(vec3(p.x*1.61,p.y*.47,p.z*1.43)+vec3(-9.4,3.7,6.2))-.5)*.005;')
main=main.replace('void main(){','void main(){p=aP;n0=aN;q=aRest;d=aD;e=aE;bmQ=aBQ;bmData=aBD;outHeight=0.;')
matvs='''#version 300 es
precision highp float;
layout(location=0)in vec3 aP;layout(location=1)in vec3 aN;layout(location=2)in vec3 aRest;layout(location=3)in vec4 aD;layout(location=4)in vec3 aE;layout(location=5)in vec3 aBQ;layout(location=6)in vec3 aBD;
vec3 p,n0,q,bmQ,bmData;vec4 d;vec3 e;
uniform vec3 uEye;uniform float uExposure,uWet,uMicro,uScope,uShellScale,uShellContrast,uShellCoverage,uShellDirection,uShellWarp,uShellBreakup,uBreakContrast,uGroundMicro,uColorWarp,uColorScale,uColorBreakup,uPalauSeed,uStage;uniform int uMode,uSection,uSelect;
out vec4 outMaterial;out float outHeight;
'''+helpers+main+'outMaterial=vec4(albedo,rough);gl_Position=vec4(0,0,0,1);}'
matvs=re.sub(r'max\(length\(dFdx\((\w+)\)\),length\(dFdy\(\1\)\)\)', '0.0',matvs)
assert 'dFdx' not in matvs and 'discard' not in matvs
sampler=r'''
let materialSamplerProgram=null;
async function samplePreviewMaterial(gl,data,view,recipe,progress=()=>{}){
 view={...view};recipe={...recipe};
 if(!materialSamplerProgram){
  function shader(t,s){const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(x));return x;}
  const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,MATERIAL_VS));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 f;void main(){f=vec4(0);}'));
  gl.transformFeedbackVaryings(program,['outMaterial','outHeight'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));materialSamplerProgram=program;
 }
 const program=materialSamplerProgram,result={report:data.report,parts:[]};let done=0,total=data.parts.reduce((sum,p)=>sum+p.vertices.length/p.stride,0);
 for(const part of data.parts){
  const count=part.vertices.length/part.stride,buf=new Float32Array(count*5),out=new Float32Array(count*30),vao=gl.createVertexArray(),vb=gl.createBuffer(),ob=gl.createBuffer(),tf=gl.createTransformFeedback();
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,part.vertices,gl.STATIC_DRAW);
  [3,3,3,4,3,3,3].forEach((n,i)=>{gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,part.stride*4,[0,3,6,9,13,16,19][i]*4);});
  gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,ob);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,4096*5*4,gl.STREAM_READ);
  for(let first=0;first<count;first+=4096){
   const n=Math.min(4096,count-first);gl.useProgram(program);
   for(const key of ['exposure','wet','micro','scope','shellScale','shellContrast','shellCoverage','shellDirection','shellWarp','shellBreakup','breakContrast','colorWarp','colorScale','colorBreakup']){const value=view[key];if(typeof value==='number')gl.uniform1f(gl.getUniformLocation(program,'u'+key[0].toUpperCase()+key.slice(1)),value);}
   for(const [name,value] of [['uGroundMicro',recipe.soilMicro],['uPalauSeed',recipe.seed],['uStage',recipe.stage],['uWet',0]])gl.uniform1f(gl.getUniformLocation(program,name),value);
   gl.bindVertexArray(vao);gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,tf);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,ob);gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,first,n);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);
   gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,ob);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,buf,first*5,n*5);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null);gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);gl.bindVertexArray(null);
   done+=n;progress(done/total);await new Promise(r=>setTimeout(r,0));
  }
  for(let i=0;i<count;i++){out.set(part.vertices.subarray(i*part.stride,i*part.stride+25),i*30);out.set(buf.subarray(i*5,i*5+5),i*30+25);}
  gl.deleteTransformFeedback(tf);gl.deleteVertexArray(vao);gl.deleteBuffer(vb);gl.deleteBuffer(ob);
  result.parts.push({...part,stride:30,vertices:out});
 }
 result.report={...result.report,materialPreview:'original-functions-sampled-at-full-geometry-vertices',pixelParityClaim:false};return result;
}
'''
lightfs='''#version 300 es
precision highp float;
in vec3 p;in vec3 n0;in vec3 q;in vec4 d;in vec3 e;in vec4 mat;in float matHeight;out vec4 frag;
uniform vec3 uEye;uniform float uExposure,uWet,uMicro,uStage;uniform int uMode,uSection,uSelect;
vec3 linearize(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 srgb(vec3 c){return mix(12.92*c,1.055*pow(max(c,vec3(0)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
void main(){bool cap=d.x>3.5&&d.x<5.5;if(uSection==1&&!cap&&p.z>.001)discard;vec3 N=normalize(n0);if(!gl_FrontFacing)N=-N;
vec3 albedo=mat.rgb;float rough=mat.a,ao=d.y,sun=d.z;
if(uMicro>0.&&uMode==0&&!cap){vec3 dx=dFdx(p),dy=dFdy(p),r1=cross(dy,N),r2=cross(N,dx);float det=dot(dx,r1);if(abs(det)>1e-9){vec3 grad=(r1*dFdx(matHeight)+r2*dFdy(matHeight))/det;grad*=min(1.,.82/max(length(grad),.001));N=normalize(N-uMicro*grad);}}
float moisture=uWet*(.45+.55*clamp(e.z,0.,1.));albedo*=1.-moisture*.24;rough=clamp(rough-moisture*.30,.30,1.);
if(uMode==1)albedo=vec3(.55,.57,.53);
if(uMode==2){float ny=normalize(n0).y;albedo=ny<-.10?mix(vec3(.85,.37,.17),vec3(.66,.15,.08),clamp(-ny,0.,1.)):mix(vec3(.32,.46,.55),vec3(.56,.69,.39),clamp(ny,0.,1.));}
if(uMode==3){frag=vec4(normalize(n0)*.5+.5,1.);return;}if(uMode==4){frag=vec4(mix(vec3(.22,.25,.22),vec3(.19,.66,.89),clamp(e.z,0.,1.)),1.);return;}if(uMode==5){frag=vec4(vec3(clamp(.5+matHeight*3.,0.,1.)),1.);return;}
if(uSelect>0&&int(e.y+.1)==uSelect)albedo=mix(albedo,vec3(.84,.62,.27),.40);
'''+fs[fs.index('albedo=linearize(albedo);'):]
s=s.replace('const FS=`'+fs+'`;','const ORIGINAL_FS=`'+fs+'`;\nconst FS='+json.dumps(lightfs)+';\nconst MATERIAL_VS='+json.dumps(matvs)+';\n'+sampler,1)
match=re.search(r'const VS=(".*?");',s,re.S);fastvs=json.loads(match.group(1));fastvs=fastvs.replace('uniform mat4 uVP;','layout(location=7)in vec4 aMat;layout(location=8)in float aHeight;out vec4 mat;out float matHeight;uniform mat4 uVP;').replace('void main(){','void main(){mat=aMat;matHeight=aHeight;')
s=s[:match.start(1)]+json.dumps(fastvs)+s[match.end(1):]
s=s.replace("fetch('./manifest.json')","fetch('./manifest-preview.json')")
s=s.replace('stride===25','stride>=25')
s=s.replace('[3,3,3,4,3,3,3].forEach((n,i)=>{let off=[0,3,6,9,13,16,19][i];gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,25*4,off*4)});','[3,3,3,4,3,3,3,4,1].forEach((n,i)=>{let off=[0,3,6,9,13,16,19,25,29][i];gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,30*4,off*4)});')
s=s.replace("'shellWarp','shellBreakup'];","'shellWarp','shellBreakup','colorWarp','colorScale','colorBreakup','breakContrast'];")
s=s.replace('baking=false;}\n  }else{','data=await samplePreviewMaterial(gl,data,state,recipe,p=>progressMessage("采样函数材质",p));baking=false;}\n  }else{')
s=s.replace("()=>id!==epoch);baking=false;\n  }", "()=>id!==epoch);data=await samplePreviewMaterial(gl,data,state,recipe,p=>progressMessage('采样函数材质',p));baking=false;\n  }")
s=s.replace('if(id===epoch){activeData=next;upload(next);','next=await samplePreviewMaterial(gl,next,state,recipe);if(id===epoch){activeData=next;upload(next);')
s=s.replace('地形影响工具体系 V0.7','地形影响工具体系 V0.7 · 快速交互')
s=s.replace('读取完整地形','读取原函数完整地形')
s=s.replace('等待地形首帧','完整几何 · 函数材质采样')
s=s.replace('不减面，不在打开时重复生产。','不减面；材质为原函数的顶点采样预览，不声称逐像素一致。')
s=s.replace('微表面灰度','材质高度采样')
s=s.replace('await build({...recipe,seed:p.seed,geo:p.geo,concavity:p.concavity,soilMicro:p.soilMicro});sync();toast(', 'await build({...recipe,seed:p.seed,geo:p.geo,concavity:p.concavity,soilMicro:p.soilMicro});toast(')
p.write_text(s)
codec=s[s.index('function encodeBlock('):s.index('function createBaker(')]
bakepage='''<!doctype html><meta charset="utf-8"><canvas id="c" width="1" height="1"></canvas><script>'''+codec+'\nconst MATERIAL_VS='+json.dumps(matvs)+';\n'+sampler+r'''
const gl=document.getElementById('c').getContext('webgl2',{antialias:false});if(!gl)throw Error('No WebGL2');
window.bakeEntry=async entry=>{const data=unpackData(await inflateResponse(await fetch('./'+entry.file)));const out=await samplePreviewMaterial(gl,data,entry.view,entry.recipe);const bytes=packData(out,true);
for(let offset=0;offset<bytes.length;offset+=262144){const r=await fetch('/__save/'+entry.id+'?offset='+offset,{method:'POST',body:bytes.subarray(offset,Math.min(bytes.length,offset+262144))});if(!r.ok)throw Error('Cache chunk failed');}const r=await fetch('/__save/'+entry.id+'?finish=1',{method:'POST'});if(!r.ok)throw Error('Cache finalize failed');return {id:entry.id,bytes:bytes.length,glError:gl.getError()};};
</script>'''
(root/'preview-bake.html').write_text(bakepage)
if (root/'bake-caches.py').exists():
 py=(root/'bake-caches.py').read_text().replace("root/'cache'","root/'cache-preview'").replace("'cache/'+f.name","'cache-preview/'+f.name").replace("'http://127.0.0.1:8771/bake.html'","'http://127.0.0.1:8771/preview-bake.html'").replace("entries=json.loads((root/'entries.json').read_text())","entries=json.loads((root/'manifest.json').read_text())['entries']").replace("(root/'manifest.json').write_text","(root/'manifest-preview.json').write_text").replace("'fragmentShaderChanged':False","'fragmentShaderChanged':True,'materialPreview':'original-functions-sampled-at-full-mesh-vertices','pixelParityClaim':False")
 (root/'bake-preview.py').write_text(py)
contract=root/'BUILD_CONTRACT.json';m=json.loads(contract.read_text());m.update({'fragmentShaderChanged':True,'runtimeMaterial':'vertex-sampled original functions with pixel PBR lighting','pixelParityClaim':False,'materialChangedButNotGeometry':True,'startupFboCount':0,'startupWorkerRequired':False});contract.write_text(json.dumps(m,ensure_ascii=False,indent=2))
for i,(attrs,body) in enumerate(re.findall(r'<script([^>]*)>(.*?)</script>',s,re.S)):
 if 'text/plain' in attrs:continue
 q=Path('/tmp')/f'lm07-preview-{i}.js';q.write_text(body);subprocess.run(['node','--check',str(q)],check=True)
print('Prepared explicitly labelled vertex-sampled material preview with full original geometry')
