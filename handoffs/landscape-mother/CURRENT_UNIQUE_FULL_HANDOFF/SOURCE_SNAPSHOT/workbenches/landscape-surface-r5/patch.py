from pathlib import Path
import hashlib,re
src=Path('workbenches/landscape-function/index.html')
out=Path('workbenches/landscape-surface-r5/index.html')
s=src.read_text(); before=s
b=src.read_bytes()
assert len(b)==81635 and hashlib.sha256(b).hexdigest()=='f2a98883f348c1702b7f49cfa6b351c6f7f9917d87c9a29e672ef0c359b360e0'
def rep(a,b):
 global s
 if a not in s: raise SystemExit('missing anchor: '+a[:100])
 s=s.replace(a,b,1)
def block(text,id):
 return re.search(r'<script id="'+id+r'" type="text/plain">(.*?)</script>',text,re.S).group(1)
world0,gen0=block(s,'worldSource'),block(s,'generateSource')
rep('<title>Landscape Mother · 水蚀石灰岩</title>','<title>Landscape Mother · 水蚀石灰岩 R5 表面显微层</title>')
rep('<h1>葡萄峰丛 · 水蚀岩壁</h1>','<h1>葡萄峰丛 · 水蚀岩壁 R5</h1>')
rep('Brick 石材 · <span id="seedLabel">种子 83</span> · 81.6 KB','Brick 石材 · <span id="seedLabel">种子 83</span> · microscope 表面层')
rep('</details><h4>表面 / 不改变几何</h4><div class="row"><label for="micro">微表面</label><output id="microOut">1.00</output></div><input id="micro" type="range" min="0" max="1.4" step=".05" value="1">','</details><h4>表面 / 不改变宏观几何</h4><div class="row"><label for="scope">Microscope 壳层</label><output id="scopeOut">0.82</output></div><input id="scope" type="range" min="0" max="1.35" step=".05" value=".82"><small>只在现有岩石表面采样并改变微法线与粗糙度，不参与峰体、洞口、峰脚、土体或落石位置。</small><div class="row"><label for="micro">Brick 微表面</label><output id="microOut">0.70</output></div><input id="micro" type="range" min="0" max="1.4" step=".05" value=".70">')
rep('<button data-mode="3">法线</button><button data-mode="4">来水</button>','<button data-mode="3">法线</button><button data-mode="4">来水</button><button data-mode="5">显微壳层</button>')
rep('<p>岩壁与落石采用 Brick Mother 的石材函数。来源为 haihao0307/HOUSE，固定提交 53a4b072，atelier-r4 的 kernel.js、renderer.js 和 catalog.js。只迁入四类石材的形状、矿物色层、粗糙度和有限细节；未迁入砖、土坯、纤维、外部模型或贴图。</p>','<p>R5 冻结这份水蚀石灰岩的宏观岩体、洞口、峰脚、土体和落石几何。Macroscopic microscope 只读取最终表面的固定世界坐标，并在极薄显示壳层中改变微法线、粗糙度和极小尺度明暗响应，不进入体积生成器。</p><p>显微层采用对数半径、方向比值、方位角与17级倍频组织尺度，并用位置相关连续空间弯折降低明显重复。调节显微壳层时，顶点、索引和结构字段均保持。</p>')
rep('<p id="details"></p>','<p><b>层级：</b>宏观主形负责岩体与主洞；结构层负责裂隙、溶蚀、来水；Microscope 只负责近表面多尺度细节；岩性、湿痕和苔藓最后读取同一固定表面。</p><p id="details"></p>')
rep('uniform vec3 uEye;uniform float uExposure,uWet,uMicro;uniform int uMode,uSection,uSelect;uniform float uStage;','uniform vec3 uEye;uniform float uExposure,uWet,uMicro,uScope;uniform int uMode,uSection,uSelect;uniform float uStage;')
rep('float noise(vec3 p){return bmN(p);}\n','float noise(vec3 p){return bmN(p);}\nvec3 mmRot(vec3 v,vec3 axis,float a){axis=normalize(axis);float c=cos(a),ss=sin(a);return c*v+ss*cross(axis,v)+(1.-c)*axis*dot(axis,v);}\nvec3 mmFrame(vec3 rawQ){vec3 q=rawQ*.155+vec3(5.7,-3.9,2.6);float R=max(length(q),1e-5),lr=log2(R);vec3 w=vec3(bmN(q*.41+vec3(3.1,7.2,-2.4)),bmN(q*.37+vec3(-8.3,2.7,4.6)),bmN(q*.43+vec3(1.5,-6.4,9.1)))-.5;q+=.38*w;float a=.24*(.62*sin(lr*2.15+q.y*.31)+.38*sin(q.z*.47-q.x*.29));q=mmRot(q-vec3(.8,-.4,.3),vec3(.31,.86,.39),a)+vec3(.8,-.4,.3);float b=.10*sin(lr*3.4+q.x*.21-q.z*.17);return mmRot(q-vec3(-1.2,.7,-.6),vec3(-.72,.18,.67),b)+vec3(-1.2,.7,-.6);}\nfloat mmCore(vec3 q){float R=max(length(q),1e-6);vec3 z=vec3(log2(R)-2.2,-q.z/R,atan(q.x,q.y));z.y-=1.;float e=z.y,sc=1.;for(int j=0;j<17;j++){e+=cos(dot(cos(z.zyy*sc),cos(z.xyx*sc)))/sc;sc+=sc;}return e;}\nfloat mmSurface(vec3 rawQ){vec3 q=mmFrame(rawQ);float a=mmCore(q);vec3 q2=mmFrame(rawQ+vec3(11.3,-7.1,5.9));float b=mmCore(mmRot(q2,vec3(.27,.61,-.74),.37));return .67*a+.33*b;}\n')
rep('float height=field*.013+(grain-.5)*.005;','float mmv=mmSurface(q),mmLo=tanh(mmv*.70),mmFine=tanh(mmSurface(q*1.73+vec3(2.9,-1.7,4.1))*.62);float shell=(d.x<2.5?1.:0.)*uScope;float height=field*.011+(grain-.5)*.0042+shell*(mmLo*.0085+mmFine*.0038);')
rep('rough=clamp((family==1?.92:family==2?.91:family==5?.88:.80)+.12*(drift-.5)-mineral*fresh*.08,.62,.99);','rough=clamp((family==1?.92:family==2?.91:family==5?.88:.80)+.12*(drift-.5)-mineral*fresh*.08+shell*.055*mmFine,.58,.99);albedo*=1.+shell*.035*mmLo;')
rep('if(uMode==3){frag=vec4(normalize(n0)*.5+.5,1.);return;}if(uMode==4){frag=vec4(mix(vec3(.22,.25,.22),vec3(.19,.66,.89),clamp(e.z,0.,1.)),1.);return;}','if(uMode==3){frag=vec4(normalize(n0)*.5+.5,1.);return;}if(uMode==4){frag=vec4(mix(vec3(.22,.25,.22),vec3(.19,.66,.89),clamp(e.z,0.,1.)),1.);return;}if(uMode==5){float v=.5+.34*tanh(mmSurface(q)*.70);frag=vec4(vec3(v),1.);return;}')
rep('mode:0,section:false,micro:1,wet:0,exposure:1.05,grass:true','mode:0,section:false,scope:.82,micro:.70,wet:0,exposure:1.08,grass:true')
rep("['uVP','uEye','uExposure','uWet','uMicro','uMode'", "['uVP','uEye','uExposure','uWet','uMicro','uScope','uMode'")
rep('gl.uniform1f(U.uMicro,state.micro);gl.uniform1f(U.uStage','gl.uniform1f(U.uMicro,state.micro);gl.uniform1f(U.uScope,state.scope);gl.uniform1f(U.uStage')
s=s.replace("for(let k of ['micro','wet','exposure'])", "for(let k of ['scope','micro','wet','exposure'])")
s=s.replace("'exposure,grass,micro,mode,phi,radius,section,selected,target,theta,wet'", "'exposure,grass,micro,mode,phi,radius,scope,section,selected,target,theta,wet'")
s=s.replace("for(let k of ['theta','phi','radius','micro','wet','exposure'])", "for(let k of ['theta','phi','radius','scope','micro','wet','exposure'])")
s=s.replace('v.micro<0||v.micro>1.4||v.wet<0','v.scope<0||v.scope>1.35||v.micro<0||v.micro>1.4||v.wet<0')
s=s.replace('v.mode>4','v.mode>5')
s=s.replace('micro:1,wet:0,exposure:1.05,mode:0','scope:.82,micro:.70,wet:0,exposure:1.08,mode:0')
s=s.replace("release:'limestone-water-2'", "release:'limestone-water-surface-r5'")
assert block(s,'worldSource')==world0 and block(s,'generateSource')==gen0
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(s)
raw=out.read_bytes();print(len(raw),hashlib.sha256(raw).hexdigest())
assert 'Microscope 壳层' in s and "release:'limestone-water-surface-r5'" in s and 'for(int j=0;j<17;j++)' in s
