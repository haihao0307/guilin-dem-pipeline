from pathlib import Path
import hashlib, json, re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'workbenches/landscape-surface-r5/index.html'
OUT = ROOT / 'workbenches/landscape-surface-r5-k2/index.html'
STATUS = ROOT / 'workbenches/landscape-surface-r5-k2/build.json'
EXPECTED = 'ac46bf029cf2a9d5ffd3dcc5a53a29990be7aedcc17aa84be27462c8e6e89ec2'


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


raw = SRC.read_bytes()
assert sha(raw) == EXPECTED, f'R5 source lock mismatch: {sha(raw)}'
s = raw.decode('utf-8')
source_world = re.search(r'<script id="worldSource" type="text/plain">(.*?)</script>', s, re.S)
assert source_world, 'worldSource block missing'
source_world_bytes = source_world.group(1).encode('utf-8')

old = """vec3 mmFrame(vec3 rawQ){vec3 q=rawQ*.155+vec3(5.7,-3.9,2.6);float R=max(length(q),1e-5),lr=log2(R);vec3 w=vec3(bmN(q*.41+vec3(3.1,7.2,-2.4)),bmN(q*.37+vec3(-8.3,2.7,4.6)),bmN(q*.43+vec3(1.5,-6.4,9.1)))-.5;q+=.38*w;float a=.24*(.62*sin(lr*2.15+q.y*.31)+.38*sin(q.z*.47-q.x*.29));q=mmRot(q-vec3(.8,-.4,.3),vec3(.31,.86,.39),a)+vec3(.8,-.4,.3);float b=.10*sin(lr*3.4+q.x*.21-q.z*.17);return mmRot(q-vec3(-1.2,.7,-.6),vec3(-.72,.18,.67),b)+vec3(-1.2,.7,-.6);}
float mmCore(vec3 q){float R=max(length(q),1e-6);vec3 z=vec3(log2(R)-2.2,-q.z/R,atan(q.x,q.y));z.y-=1.;float e=z.y,sc=1.;for(int j=0;j<17;j++){e+=cos(dot(cos(z.zyy*sc),cos(z.xyx*sc)))/sc;sc+=sc;}return e;}
float mmSurface(vec3 rawQ){vec3 q=mmFrame(rawQ);float a=mmCore(q);vec3 q2=mmFrame(rawQ+vec3(11.3,-7.1,5.9));float b=mmCore(mmRot(q2,vec3(.27,.61,-.74),.37));return .67*a+.33*b;}"""

new = """vec3 mmFrame(vec3 rawQ){
  vec3 q=rawQ*.28;
  vec3 low=vec3(
    bmN(rawQ*.026+vec3(3.1,7.2,-2.4)),
    bmN(rawQ*.023+vec3(-8.3,2.7,4.6)),
    bmN(rawQ*.029+vec3(1.5,-6.4,9.1))
  )-.5;
  float zone=bmN(rawQ*.017+vec3(17.1,-5.3,8.7));
  vec3 axis=normalize(vec3(.41,.79,.46)+low*.78);
  q+=low*1.34;
  q=mmRot(q,axis,(zone-.5)*1.34);
  vec3 warp=vec3(
    bmN(q*.23+vec3(5.7,-3.9,2.6)),
    bmN(q*.211+vec3(-4.6,8.1,11.3)),
    bmN(q*.257+vec3(9.4,3.2,-7.5))
  )-.5;
  return q+warp*(1.02+.42*zone);
}
vec3 mmOrganicData(vec3 rawQ){
  vec3 q=mmFrame(rawQ);
  float zone=bmN(rawQ*.021+vec3(31.7,7.9,-13.1));
  float a=bmN(q*.55+vec3(2.1,11.7,-6.4));
  float b=bmN(q*.97+vec3(-9.6,3.8,14.2));
  float c=bmN(q*1.87+vec3(7.4,-13.1,4.5));
  float d0=bmN(q*3.73+vec3(19.2,5.6,-8.7));
  float e0=bmN(q*7.51+vec3(-3.9,17.6,12.8));
  float f0=bmN(q*15.13+vec3(13.8,-9.2,21.7));
  float broad=.45*a+.32*b+.23*c;
  float mid=.38*b+.37*c+.25*d0;
  float fine=.45*d0+.35*e0+.20*f0;
  float threshold=.61+.07*(zone-.5);
  float cavity0=smoothstep(threshold,threshold+.11,broad);
  float rim0=1.-smoothstep(.014,.064,abs(broad-threshold));
  float cavity1=smoothstep(.68,.82,mid)*(1.-cavity0*.52);
  float rim1=(1.-smoothstep(.011,.050,abs(mid-.68)))*(1.-cavity0*.52);
  float pit=smoothstep(.72,.87,fine)*smoothstep(.28,.82,1.-mid);
  float poreRim=(1.-smoothstep(.010,.042,abs(fine-.72)))*(1.-cavity0*.58);
  float nodule=smoothstep(.57,.82,d0)*smoothstep(.33,.76,broad)*(1.-cavity0);
  float lowShape=(broad-.5)*.18+(mid-.5)*.10;
  float h=lowShape+.28*rim0-.44*cavity0+.14*rim1-.22*cavity1+.055*poreRim-.095*pit+.08*nodule;
  h=tanh(h*1.72);
  float cavity=clamp(cavity0*.82+cavity1*.50+pit*.24,0.,1.);
  float rim=clamp(rim0*.78+rim1*.50+poreRim*.18+nodule*.16,0.,1.);
  return vec3(h,cavity,rim);
}
float mmSurface(vec3 rawQ){return mmOrganicData(rawQ).x;}"""

assert old in s, 'original Microscope block not found'
s = s.replace(old, new, 1)

old2 = "float mmv=mmSurface(q),mmLo=tanh(mmv*.70),mmFine=tanh(mmSurface(q*1.73+vec3(2.9,-1.7,4.1))*.62);float shell=(d.x<2.5?1.:0.)*uScope;float height=field*.011+(grain-.5)*.0042+shell*(mmLo*.0085+mmFine*.0038);"
new2 = "vec3 mmData=mmOrganicData(q),mmFineData=mmOrganicData(q*1.37+vec3(2.9,-1.7,4.1));float mmLo=mmData.x,mmFine=mmFineData.x;float shell=(d.x<2.5?1.:0.)*uScope;float height=field*.011+(grain-.5)*.0042+shell*(mmLo*.0072+mmFine*.0026);"
assert old2 in s, 'Microscope height integration point not found'
s = s.replace(old2, new2, 1)

old3 = "rough=clamp((family==1?.92:family==2?.91:family==5?.88:.80)+.12*(drift-.5)-mineral*fresh*.08+shell*.055*mmFine,.58,.99);albedo*=1.+shell*.035*mmLo;"
new3 = "rough=clamp((family==1?.92:family==2?.91:family==5?.88:.80)+.12*(drift-.5)-mineral*fresh*.08+shell*(.030*mmFine+.075*mmData.y+.034*mmData.z),.58,.99);albedo*=1.+shell*(.026*mmLo-.065*mmData.y+.024*mmData.z);"
assert old3 in s, 'Microscope material integration point not found'
s = s.replace(old3, new3, 1)

old4 = "if(uMode==3){frag=vec4(normalize(n0)*.5+.5,1.);return;}if(uMode==4){frag=vec4(mix(vec3(.22,.25,.22),vec3(.19,.66,.89),clamp(e.z,0.,1.)),1.);return;}if(uMode==5){float v=.5+.34*tanh(mmSurface(q)*.70);frag=vec4(vec3(v),1.);return;}"
new4 = "if(uMode==3){frag=vec4(normalize(n0)*.5+.5,1.);return;}if(uMode==4){frag=vec4(mix(vec3(.22,.25,.22),vec3(.19,.66,.89),clamp(e.z,0.,1.)),1.);return;}if(uMode==5){vec3 m=mmOrganicData(q);float v=clamp(.50+.33*m.x-.23*m.y+.18*m.z,0.,1.);frag=vec4(vec3(v),1.);return;}"
assert old4 in s, 'Microscope mode point not found'
s = s.replace(old4, new4, 1)

s = s.replace('<title>Landscape Mother · 水蚀石灰岩 R5 表面显微层</title>', '<title>Landscape Mother · 水蚀石灰岩 R5.K2 Organic Microscope</title>', 1)
s = s.replace('<h1>葡萄峰丛 · 水蚀岩壁 R5</h1>', '<h1>葡萄峰丛 · 水蚀岩壁 R5.K2</h1>', 1)
s = s.replace('Brick 石材 · <span id="seedLabel">种子 83</span> · microscope 表面层', 'Brick 石材 · <span id="seedLabel">种子 83</span> · Organic Microscope', 1)

candidate_world = re.search(r'<script id="worldSource" type="text/plain">(.*?)</script>', s, re.S)
assert candidate_world, 'candidate worldSource block missing'
assert candidate_world.group(1).encode('utf-8') == source_world_bytes, 'worldSource changed'
assert 'mmRillenkarren' not in s, 'withdrawn carved-rill function leaked into candidate'
assert 'abs(sin(' not in new, 'periodic stripe construction forbidden'

OUT.parent.mkdir(parents=True, exist_ok=True)
out = s.encode('utf-8')
OUT.write_bytes(out)
status = {
    'schema': 'LANDSCAPE_R5_K2_ORGANIC_MICROSCOPE_V2',
    'sourceCommit': '039d3a7f32c73ff3ac292c5bbb18c3f6f5535b90',
    'sourcePath': 'workbenches/landscape-surface-r5/index.html',
    'sourceSha256': EXPECTED,
    'candidateSha256': sha(out),
    'candidateBytes': len(out),
    'macroGeometryChanged': False,
    'vertexIndexGeneratorChanged': False,
    'worldSourceChanged': False,
    'surfaceMethod': 'stable world position + continuous mineral zones + one continuous local frame + six non-integer scales forming nested organic cavities, rounded rims, pores and nodules',
    'explicitlyForbidden': ['directional carved stripes', 'periodic sine grooves', 'external mesh runtime', 'external texture runtime'],
    'referenceUse': 'uploaded microscope frames and Austria rillenkarren GLB used only as visual/statistical observation; no source geometry or texture copied',
    'visualApproved': False,
    'productionReady': False,
}
STATUS.write_text(json.dumps(status, ensure_ascii=False, indent=2))
print(json.dumps(status, ensure_ascii=False))
