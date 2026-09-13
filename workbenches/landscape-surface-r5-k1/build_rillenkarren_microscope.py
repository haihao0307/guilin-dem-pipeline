from pathlib import Path
import hashlib, json

ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'workbenches/landscape-surface-r5/index.html'
OUT=ROOT/'workbenches/landscape-surface-r5-k1/index.html'
STATUS=ROOT/'workbenches/landscape-surface-r5-k1/build.json'
EXPECTED='ac46bf029cf2a9d5ffd3dcc5a53a29990be7aedcc17aa84be27462c8e6e89ec2'

def sha(b): return hashlib.sha256(b).hexdigest()
raw=SRC.read_bytes()
assert sha(raw)==EXPECTED, f'R5 source lock mismatch: {sha(raw)}'
s=raw.decode('utf-8')

old="""vec3 mmFrame(vec3 rawQ){vec3 q=rawQ*.155+vec3(5.7,-3.9,2.6);float R=max(length(q),1e-5),lr=log2(R);vec3 w=vec3(bmN(q*.41+vec3(3.1,7.2,-2.4)),bmN(q*.37+vec3(-8.3,2.7,4.6)),bmN(q*.43+vec3(1.5,-6.4,9.1)))-.5;q+=.38*w;float a=.24*(.62*sin(lr*2.15+q.y*.31)+.38*sin(q.z*.47-q.x*.29));q=mmRot(q-vec3(.8,-.4,.3),vec3(.31,.86,.39),a)+vec3(.8,-.4,.3);float b=.10*sin(lr*3.4+q.x*.21-q.z*.17);return mmRot(q-vec3(-1.2,.7,-.6),vec3(-.72,.18,.67),b)+vec3(-1.2,.7,-.6);}
float mmCore(vec3 q){float R=max(length(q),1e-6);vec3 z=vec3(log2(R)-2.2,-q.z/R,atan(q.x,q.y));z.y-=1.;float e=z.y,sc=1.;for(int j=0;j<17;j++){e+=cos(dot(cos(z.zyy*sc),cos(z.xyx*sc)))/sc;sc+=sc;}return e;}
float mmSurface(vec3 rawQ){vec3 q=mmFrame(rawQ);float a=mmCore(q);vec3 q2=mmFrame(rawQ+vec3(11.3,-7.1,5.9));float b=mmCore(mmRot(q2,vec3(.27,.61,-.74),.37));return .67*a+.33*b;}"""
new="""vec3 mmFrame(vec3 rawQ){
  vec3 q=rawQ*.155+vec3(5.7,-3.9,2.6);float R=max(length(q),1e-5),lr=log2(R);
  vec3 w=vec3(bmN(q*.41+vec3(3.1,7.2,-2.4)),bmN(q*.37+vec3(-8.3,2.7,4.6)),bmN(q*.43+vec3(1.5,-6.4,9.1)))-.5;
  q+=.38*w;
  float zone=bmN(rawQ*.031+vec3(17.3,-4.7,9.1));
  float a=.24*(.62*sin(lr*2.15+q.y*.31)+.38*sin(q.z*.47-q.x*.29))+.11*(zone-.5);
  q=mmRot(q-vec3(.8,-.4,.3),vec3(.31,.86,.39),a)+vec3(.8,-.4,.3);
  float b=.10*sin(lr*3.4+q.x*.21-q.z*.17)+.055*sin(rawQ.x*.071+rawQ.z*.053+zone*6.28318);
  return mmRot(q-vec3(-1.2,.7,-.6),vec3(-.72,.18,.67),b)+vec3(-1.2,.7,-.6);
}
float mmCore(vec3 q){float R=max(length(q),1e-6);vec3 z=vec3(log2(R)-2.2,-q.z/R,atan(q.x,q.y));z.y-=1.;float e=z.y,sc=1.;for(int j=0;j<17;j++){e+=cos(dot(cos(z.zyy*sc),cos(z.xyx*sc)))/sc;sc+=sc;}return e;}
float mmSurface(vec3 rawQ){vec3 q=mmFrame(rawQ);float a=mmCore(q);vec3 q2=mmFrame(rawQ+vec3(11.3,-7.1,5.9));float b=mmCore(mmRot(q2,vec3(.27,.61,-.74),.37));return .67*a+.33*b;}
float mmRillenkarren(vec3 rawQ){
  vec3 N0=normalize(n0),G=vec3(0.,-1.,0.);vec3 flow=G-N0*dot(G,N0);float fl=length(flow);
  if(fl<.06||d.x>.55)return 0.;flow/=fl;vec3 across=normalize(cross(N0,flow));
  float zone=bmN(rawQ*.027+vec3(31.7,7.9,-13.1));
  float u=dot(rawQ,across),v=dot(rawQ,flow);
  float warp=.18*sin(v*.61+zone*6.28318)+.085*sin(v*1.37+rawQ.x*.043-rawQ.z*.037)+.045*sin(v*2.83+zone*11.7);
  float f0=5.1+2.4*zone;
  float s1=abs(sin((u+warp)*f0));
  float s2=abs(sin((u*.73+warp*.55+v*.035)*(f0*1.73)+1.7));
  float s3=abs(sin((u*1.11-warp*.34-v*.021)*(f0*2.91)+4.1));
  float g1=1.-smoothstep(.055,.31,s1),g2=1.-smoothstep(.045,.25,s2),g3=1.-smoothstep(.035,.19,s3);
  float ridge=smoothstep(.55,.96,abs(sin((u+warp*.32)*(f0*.52)+.7)));
  float steep=smoothstep(.18,.82,fl),water=smoothstep(.035,.52,clamp(e.z,0.,1.));
  float exposed=smoothstep(.24,.82,d.y)*smoothstep(.05,.42,d.z);
  float zoneMask=smoothstep(.30,.66,bmN(rawQ*.083+vec3(-7.1,19.3,4.7))+.18*zone);
  float mask=steep*mix(.28,1.,water)*exposed*zoneMask*clamp(uStage/2.,0.,1.);
  return mask*(-.0155*g1-.0065*g2-.0028*g3+.0032*ridge);
}"""
assert old in s, 'Microscope source block not found'
s=s.replace(old,new,1)
old2="float mmv=mmSurface(q),mmLo=tanh(mmv*.70),mmFine=tanh(mmSurface(q*1.73+vec3(2.9,-1.7,4.1))*.62);float shell=(d.x<2.5?1.:0.)*uScope;float height=field*.011+(grain-.5)*.0042+shell*(mmLo*.0085+mmFine*.0038);"
new2="float mmv=mmSurface(q),mmLo=tanh(mmv*.70),mmFine=tanh(mmSurface(q*1.73+vec3(2.9,-1.7,4.1))*.62);float shell=(d.x<2.5?1.:0.)*uScope;float rillen=mmRillenkarren(q);float height=field*.011+(grain-.5)*.0042+shell*(mmLo*.0085+mmFine*.0038+rillen);"
assert old2 in s, 'height integration point not found'
s=s.replace(old2,new2,1)
old3="if(uMode==3){frag=vec4(normalize(n0)*.5+.5,1.);return;}if(uMode==4){frag=vec4(mix(vec3(.22,.25,.22),vec3(.19,.66,.89),clamp(e.z,0.,1.)),1.);return;}if(uMode==5){float v=.5+.34*tanh(mmSurface(q)*.70);frag=vec4(vec3(v),1.);return;}"
new3="if(uMode==3){frag=vec4(normalize(n0)*.5+.5,1.);return;}if(uMode==4){frag=vec4(mix(vec3(.22,.25,.22),vec3(.19,.66,.89),clamp(e.z,0.,1.)),1.);return;}if(uMode==5){float v=.5+.30*tanh(mmSurface(q)*.70)+clamp(-mmRillenkarren(q)*14.,0.,.28);frag=vec4(vec3(v),1.);return;}"
assert old3 in s, 'microscope diagnostic mode point not found'
s=s.replace(old3,new3,1)
s=s.replace('<title>Landscape Mother · 水蚀石灰岩 R5 表面显微层</title>','<title>Landscape Mother · 水蚀石灰岩 R5.K1 Rillenkarren Microscope</title>',1)
s=s.replace('<h1>葡萄峰丛 · 水蚀岩壁 R5</h1>','<h1>葡萄峰丛 · 水蚀岩壁 R5.K1</h1>',1)
s=s.replace('Brick 石材 · <span id="seedLabel">种子 83</span> · microscope 表面层','Brick 石材 · <span id="seedLabel">种子 83</span> · Yohei/Microscope rillenkarren',1)
OUT.parent.mkdir(parents=True,exist_ok=True)
out=s.encode('utf-8');OUT.write_bytes(out)
status={
 'schema':'LANDSCAPE_R5_K1_RILLENKARREN_MICROSCOPE_V1','sourceCommit':'039d3a7f32c73ff3ac292c5bbb18c3f6f5535b90',
 'sourcePath':'workbenches/landscape-surface-r5/index.html','sourceSha256':EXPECTED,'candidateSha256':sha(out),'candidateBytes':len(out),
 'macroGeometryChanged':False,'vertexIndexGeneratorChanged':False,'worldSourceChanged':False,
 'microscopeMethod':'stable world position + continuous mineral zone + tangent gravity/flow frame + multi-scale non-integer bands',
 'referenceUse':'Austria rillenkarren GLB/images are observation/calibration only; no external mesh or texture runtime dependency',
 'visualApproved':False,'productionReady':False}
STATUS.write_text(json.dumps(status,ensure_ascii=False,indent=2))
print(json.dumps(status,ensure_ascii=False))
