from pathlib import Path
import re, hashlib, json

ROOT=Path(__file__).resolve().parents[3]
BASE=ROOT/'ocean-mother/recovery/r0189-3/Ocean_Mother_R018.9.3_Rock_Form_Candidate.html'
OUTDIR=ROOT/'ocean-mother/recovery/r0189-4'
OUT=OUTDIR/'Ocean_Mother_R018.9.4_Coast_Surface_Candidate.html'
REPORT=OUTDIR/'R0189_4_BUILD_REPORT.json'

def sha(b:bytes): return hashlib.sha256(b).hexdigest()
def repl_pat(s,pat,new,label):
    o,n=re.subn(pat,new,s,count=1,flags=re.S)
    if n!=1: raise RuntimeError(f'{label}: {n}')
    return o
def repl(s,old,new,label):
    n=s.count(old)
    if n<1: raise RuntimeError(f'{label}: {n}')
    return s.replace(old,new,1)

def get(s,pat,label):
    m=re.search(pat,s,re.S)
    if not m: raise RuntimeError(label)
    return m.group(0)

s=BASE.read_text()
base_sha=sha(BASE.read_bytes())
if base_sha!='dafd9df7ea2b8bbc7abd119e78aa42c0e76e99e3a23841ee1b1968a1342f3793':
    raise RuntimeError('R018.9.3 source SHA mismatch: '+base_sha)

# Frozen blocks outside this bounded visual pass.
protected={
'deep':r'const ORIGINAL_DEEP_HTML=.*?;\nconst deepFrame=',
'waterHeight':r'float waterHeight\(vec2 p\)\{.*?\n\}',
'foamField':r'float foamFilament\(vec2 p,float scale,vec2 drift,float phase\)\{.*?\n\}\nfloat foamField\(vec2 p\)\{.*?\n\}',
'curlDensity':r'float curlDensity\(vec3 p\)\{.*?\n\}',
'sprayDensity':r'float sprayDensity\(vec3 p\)\{.*?\n\}',
'smokeDensityAt':r'float smokeDensityAt\(vec3 p\)\{.*?\n\}',
'shadeWater':r'vec3 shadeWater\(vec3 p,vec3 rd,vec3 sunDir,vec3 sky\)\{.*?\n\}',
}
before={k:sha(get(s,p,k).encode()) for k,p in protected.items()}

TAPER='''float taperedSpit(vec2 p){
  vec2 a=vec2(27.,-16.),b=vec2(51.,-24.);
  vec2 ba=b-a;
  float h=sat(dot(p-a,ba)/dot(ba,ba));
  vec2 side=normalize(vec2(-ba.y,ba.x));
  vec2 centre=a+ba*h+side*sin(h*PI)*2.4;
  float width=mix(6.0,.85,pow(h,.72));
  width*=.88+.12*sin(h*PI*2.2+1.1);
  return length(p-centre)-width;
}'''
RADIUS='''float islandRadius(float a){
  float irr=uIsland.y;
  float r=43.8;
  r*=1.+irr*(.095*sin(a*2.+.42)+.058*sin(a*3.-1.13)+.034*sin(a*5.+2.10)+.020*sin(a*8.-.36));
  r+=uIsland.w*(6.4*angularLobe(a,-.55,.38)-6.2*angularLobe(a,1.93,.34)+4.6*angularLobe(a,2.78,.29)-4.0*angularLobe(a,.72,.26)+2.4*angularLobe(a,-2.16,.24));
  r+=2.2*angularLobe(a,-1.46,.22)-2.7*angularLobe(a,2.30,.24);
  return r;
}'''
SHORE='''float shoreDistance(vec2 p){
  vec2 q=rot2(-.16)*p;
  vec2 e=q/vec2(1.13,.91);
  float a=atan(e.y,e.x);
  float d=length(e)-islandRadius(a);
  d+=(fbm(q*.050+vec2(3.1,-1.7))-.5)*2.85*uIsland.y;
  d+=(noise2(q*.17+4.3)-.5)*.52*uIsland.y;
  float spit=taperedSpit(q)+(1.00-uIsland.w)*2.4;
  d=smoothMin(d,spit,2.55);
  return d;
}'''
ROCK='''float cragOne(vec2 p,vec2 c,vec2 r,float h,float seed,float turn){
  vec2 q=rot2(turn)*(p-c)/r;
  float a=atan(q.y,q.x);
  float radial=length(q)*(1.+.075*sin(a*5.+seed)+.038*sin(a*9.-seed*.41));
  float core=sat(1.-radial);
  float crown=pow(core,.58);
  float facet=.82+.10*cos(a*4.+seed*.7)+.055*cos(a*7.-seed*.3);
  float tilt=sat(.94-.12*q.x+.08*q.y);
  float strata=1.-.035*smoothstep(.46,.54,fract(crown*4.2+noise2(q*3.1+seed)));
  return h*crown*facet*tilt*strata;
}
float rockField(vec2 p){
  float r=0.;
  r=max(r,cragOne(p,vec2(34.,-12.),vec2(6.4,4.0),4.25,1.1,.32));
  r=max(r,cragOne(p,vec2(28.,-24.),vec2(4.2,2.8),2.75,4.3,-.28));
  r=max(r,cragOne(p,vec2(-34.,10.),vec2(7.2,4.6),4.45,7.2,.18));
  r=max(r,cragOne(p,vec2(-42.,0.),vec2(4.0,2.7),2.55,9.7,-.55));
  r=max(r,cragOne(p,vec2(4.,31.),vec2(5.3,3.5),3.35,13.4,.46));
  r=max(r,cragOne(p,vec2(17.,27.),vec2(3.5,2.35),2.30,16.1,-.12));
  r=max(r,cragOne(p,vec2(-7.,-34.),vec2(4.6,2.9),2.55,19.3,.62));
  r=max(r,cragOne(p,vec2(-4.,4.),vec2(4.8,3.2),2.75,22.8,-.34));
  r=max(r,cragOne(p,vec2(10.,1.),vec2(3.2,2.2),1.85,25.6,.41));
  return r;
}'''
TERRAIN='''float terrainHeight(vec2 p){
  float sd=shoreDistance(p);
  float inside=smoothstep(2.6,-3.3,sd);
  float offshore=max(sd,0.);
  float seabed=-.24-offshore*.044+(fbm(p*.035+vec2(5.2,1.4))-.5)*.52;
  float inland=max(-sd,0.);
  float upland=smoothstep(uIsland.z*.46,uIsland.z*1.06,inland);
  float shelf=.12+.041*min(inland,uIsland.z*.92);
  float dunes=(fbm(p*.20+vec2(6.4,-2.1))-.5)*.34*(1.-upland);
  float core=sat((inland-uIsland.z*.31)/43.);
  vec2 q=rot2(-.18)*p;
  vec2 pa=(q-vec2(-8.,5.))/vec2(23.,17.);
  vec2 pb=(q-vec2(15.,-2.))/vec2(19.,14.);
  vec2 pc=(q-vec2(-2.,-13.))/vec2(28.,12.);
  float massA=exp(-dot(pa,pa)*1.15);
  float massB=exp(-dot(pb,pb)*1.35);
  float saddle=.35*exp(-dot(pc,pc)*1.7);
  float broad=uIsland.x*(.70*massA+.49*massB+.18*saddle)*pow(core,.32);
  float ridgeA=pow(ridged2(rot2(.42)*p*.047+vec2(1.3,-.7)),3.0);
  float ridgeB=pow(ridged2(rot2(-.50)*p*.073+vec2(4.2,2.1)),3.35);
  float relief=(ridgeA-.47)*2.85*pow(core,.60)+(ridgeB-.49)*1.55*pow(core,.48);
  float drainage=pow(sat(.47-ridged2(p*.061+vec2(8.1,-2.4))),2.25);
  float gullies=-1.65*drainage*pow(core,.70);
  float land=shelf+dunes+upland*(broad+relief+gullies)+rockField(p);
  return mix(seabed,land,inside);
}'''
SHADET='''vec3 shadeTerrain(vec3 p,vec3 rd,vec3 sunDir){
  vec3 n=terrainNormal(p.xz);
  float sd=shoreDistance(p.xz),h=p.y;
  float inland=max(-sd,0.);
  float a=atan(p.z,p.x);
  float sheltered=1.-swellExposure(p.xz);
  float bay=.62+.42*angularLobe(a,-.60,.48)+.23*angularLobe(a,2.72,.38);
  float localBeach=uIsland.z*mix(.40,.74,sat(sheltered*.72+bay*.28));
  float beach=1.-smoothstep(localBeach*.38,localBeach,inland);
  float damp=beach*(1.-smoothstep(.15,1.85,inland));
  float swash=beach*exp(-pow((sd+.06)/1.06,2.));
  float wetPatch=.70+.30*fbm(p.xz*.17+vec2(1.8,-3.1));
  float wet=sat(damp*wetPatch+swash*.30);
  float rock=rockMaskAt(p.xz);
  float slope=1.-n.y;
  float exposed=smoothstep(.22,.56,slope)*(1.-beach)*(1.-rock);
  rock=max(rock,smoothstep(.44,.73,slope)*smoothstep(6.0,12.0,h));
  float macro=fbm(p.xz*.11+vec2(3.5,-1.8));
  float grain=.70*fbm(p.xz*.48)+.30*noise2(p.xz*1.8);
  float drainage=smoothstep(.34,.60,ridged2(p.xz*.067+vec2(8.1,-2.4)));
  float altitude=smoothstep(2.2,12.5,h);
  vec3 drySand=mix(vec3(.56,.53,.46),vec3(.79,.74,.63),sat(grain*.64+.22));
  vec3 wetSand=mix(vec3(.15,.19,.19),vec3(.29,.29,.26),grain*.28);
  vec3 lowGreen=mix(vec3(.065,.14,.065),vec3(.19,.285,.13),sat(macro*.88));
  vec3 highGreen=mix(vec3(.08,.13,.065),vec3(.20,.25,.12),sat(macro*.75));
  vec3 scrub=mix(lowGreen,highGreen,altitude*.72);
  scrub=mix(scrub,vec3(.16,.235,.105),drainage*.16);
  vec3 earth=mix(vec3(.20,.17,.13),vec3(.34,.29,.21),grain*.46);
  float rockMacro=fbm(p.xz*.20+vec2(-2.4,5.7));
  float rockMicro=noise2(p.xz*1.20+7.4);
  vec3 rockCol=mix(vec3(.18,.205,.205),vec3(.38,.375,.34),sat(rockMacro*.68+rockMicro*.18));
  float nearShore=1.-smoothstep(2.0,10.0,abs(sd));
  float waterline=exp(-pow((h-.24)/1.18,2.));
  float wetRock=rock*nearShore*waterline*(.68+.32*noise2(p.xz*.58+2.8));
  rockCol=mix(rockCol,vec3(.055,.080,.086),wetRock*.82);
  float lichen=rock*(1.-wetRock)*smoothstep(.58,.80,fbm(p.xz*.29+9.3));
  rockCol=mix(rockCol,vec3(.23,.265,.20),lichen*.14);
  vec3 col=mix(scrub,drySand,beach);
  col=mix(col,earth,exposed*.70);
  col=mix(col,wetSand,wet);
  col=mix(col,rockCol,rock);
  float ndl=max(dot(n,sunDir),0.);
  float skyFill=.43+.17*n.y;
  float diff=skyFill+.57*ndl;
  float back=max(dot(n,normalize(vec3(-sunDir.x,.28,-sunDir.z))),0.);
  col*=diff;
  col+=col*back*.045;
  float rim=pow(1.-max(dot(n,-rd),0.),3.2);
  col+=rim*mix(vec3(.015,.027,.032),vec3(.052,.071,.071),rock)*(.28+.72*ndl);
  float spec=pow(max(dot(reflect(-sunDir,n),-rd),0.),104.);
  col+=vec3(.22,.26,.26)*spec*(wet*.18+wetRock*.70);
  if(flag(64)){
    float fireGlow=0.;
    vec2 fs[4];fs[0]=vec2(-6.5,3.5);fs[1]=vec2(-1.,-1.8);fs[2]=vec2(4.8,3.2);fs[3]=vec2(1.8,8.);
    for(int i=0;i<4;i++){float d=length(p.xz-fs[i]);fireGlow+=exp(-d*d*.14)*uRocks.z;}
    col+=vec3(1.0,.22,.028)*fireGlow*(.78+.22*sin(uTime*7.3+p.x*1.7));
  }
  if(uMode==1)col=vec3(.48)*diff;
  if(uMode==3)col=mix(vec3(.13,.19,.20),vec3(.92,.34,.07),sat(rock+slope));
  return col;
}'''

s=repl_pat(s,r'float taperedSpit\(vec2 p\)\{.*?\n\}',TAPER,'taperedSpit')
s=repl_pat(s,r'float islandRadius\(float a\)\{.*?\n\}',RADIUS,'islandRadius')
s=repl_pat(s,r'float shoreDistance\(vec2 p\)\{.*?\n\}',SHORE,'shoreDistance')
s=repl_pat(s,r'float cragOne\(vec2 p,vec2 c,vec2 r,float h,float seed,float turn\)\{.*?\n\}\nfloat rockField\(vec2 p\)\{.*?\n\}',ROCK,'rockField')
s=repl_pat(s,r'float terrainHeight\(vec2 p\)\{.*?\n\}',TERRAIN,'terrainHeight')
s=repl_pat(s,r'vec3 shadeTerrain\(vec3 p,vec3 rd,vec3 sunDir\)\{.*?\n\}',SHADET,'shadeTerrain')

# Identity, calmer defaults, and review cameras.
repls=[
('Ocean Mother | R018.9.3 岩石形体候选','Ocean Mother | R018.9.4 岸形与地表候选','title'),
('ISLAND GOLD COAST / R018.9.3','ISLAND GOLD COAST / R018.9.4','brand'),
('R018.9.3 · 岩石形体候选','R018.9.4 · 岸形与地表候选','footer'),
("version:'0.3.9.3-r0189-rock-form'","version:'0.3.9.4-r0189-coast-surface'",'version'),
("buildId:'r0189.3-rock-form-v001-deep-frozen'","buildId:'r0189.4-coast-surface-v001-deep-frozen'",'build'),
('islandHeight:17.2,islandIrregularity:1.28,beachWidth:8.6,shoreBias:1.18,','islandHeight:15.6,islandIrregularity:1.02,beachWidth:6.2,shoreBias:.98,','island defaults'),
('waveHeight:.80,waveSpeed:.78,breakerPower:1.12,curlPower:1.02,','waveHeight:.72,waveSpeed:.72,breakerPower:.96,curlPower:.88,','wave defaults'),
('foamWall:.88,foamNoise:1.22,runup:.78,spray:.72,','foamWall:.78,foamNoise:1.16,runup:.66,spray:.58,','foam defaults'),
('waterClarity:.74,sunAngle:-.50,exposure:1.08,rockSharpness:1.06,rockContrast:1.06','waterClarity:.72,sunAngle:-.50,exposure:1.06,rockSharpness:.96,rockContrast:.98','material defaults'),
('function setView(name){const views={overview:[.72,.42,104,[2,4,-2]],top:[-.12,1.46,126,[4,1,-3]],shore:[-.62,.20,58,[18,1.2,-12]],breaker:[.68,.10,48,[23,.5,17]],rocks:[-.12,.22,53,[30,2,-10]],fire:[1.18,.22,50,[0,10,3]]};',
 'function setView(name){const views={overview:[.76,.38,99,[1,3,-1]],top:[-.12,1.48,119,[2,1,-2]],shore:[-.58,.18,49,[19,.8,-13]],breaker:[.68,.10,48,[23,.5,17]],rocks:[-.15,.19,44,[31,1.3,-11]],fire:[1.18,.22,50,[0,10,3]]};','views'),
]
for a,b,l in repls:s=repl(s,a,b,l)

after={k:sha(get(s,p,k).encode()) for k,p in protected.items()}
changed=[k for k in before if before[k]!=after[k]]
if changed: raise RuntimeError('protected changed '+str(changed))

OUTDIR.mkdir(parents=True,exist_ok=True)
OUT.write_text(s)
report={
 'baseline':'R018.9.3 cumulative from exact R018.9',
 'baselineSha256':base_sha,
 'candidate':'R018.9.4',
 'candidateSha256':sha(s.encode()),
 'scope':['shorter curved sand spit','narrow exposure-aware beach','two-mass island relief','lower integrated rocks','terrain palette and review cameras'],
 'protected':sorted(protected),
 'protectedHashesUnchanged':True,
 'deepOceanByteIdentityInsideCandidate':before['deep']==after['deep'],
 'deepOcean':'frozen original V001',
 'smokeFireDefaultOff':True,
 'visualApproved':False,
 'productionApproved':False,
}
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
