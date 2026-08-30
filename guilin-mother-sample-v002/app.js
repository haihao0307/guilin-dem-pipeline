(()=>{'use strict';
const CONTRACT_URL='./sample-contract.json';
const DATA_ROOT='./data/';
const MANIFEST_FILE='NATIVE_ELEVATION_MANIFEST.json';
const HYDROLOGY_MANIFEST_FILE='osm-waterways-manifest.json';
const TILE_FILE='native-r07-c02-2048x2048-i16.bin';
const EXPECTED_SOURCE_SHA='9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4';
const EXPECTED_TILE_SHA='5408050e693e4a4679dd39fe96b473067dec515c23a7f53954c707e74e303215';
const EXPECTED_TILE_BYTES=8388608;
const TILE_GRID=2048,WINDOW_X=1330,WINDOW_Y=521;
const TRUTH_GRID=81,SUBDIVISION=4,RENDER_GRID=(TRUTH_GRID-1)*SUBDIVISION+1;
const TRUTH_SPACING=12.5,RENDER_SPACING=TRUTH_SPACING/SUBDIVISION,SIDE_M=1000;
const CENTER_E=448643.75,CENTER_N=2740856.25;
const SEEDS=Object.freeze({shape:326492026,composition:8157341,pore:440923,weather:730119,field:20260830,water:110156});
const MAX_DPR=1.42;
const $=id=>document.getElementById(id);
const canvas=$('terrain'),loading=$('loading'),loadingText=$('loadingText'),errorBox=$('error'),errorText=$('errorText');
const runtimeErrors=[];
const state={contract:null,manifest:null,hydrologyManifest:null,truth:null,denseTruth:null,fields:null,peaks:[],segments:[],minimum:0,maximum:1,sourceNodeMaxError:Infinity,gl:null,programs:null,uniforms:null,terrain:null,water:null,skirt:null,mode:0,showKarst:true,showField:true,showWater:true,karstStrength:1,detailStrength:1,colorStrength:1,camera:{target:[0,92,0],yaw:-.78,pitch:.52,distance:1380,minDistance:95,maxDistance:4800},projection:new Float32Array(16),view:new Float32Array(16),viewProjection:new Float32Array(16),inverseViewProjection:new Float32Array(16),pointers:new Map(),pinch:null,dirty:true,ready:false,lastFrameAt:0,frameSamples:[],karstRange:[0,0],fieldRange:[0,0],sourceShaVerified:false,tileShaVerified:false,hydrologyShaVerified:false};
window.addEventListener('error',e=>{runtimeErrors.push(String(e.error?.stack||e.message||'window error'));updateQa();});
window.addEventListener('unhandledrejection',e=>{runtimeErrors.push(String(e.reason?.stack||e.reason||'unhandled rejection'));updateQa();});

const TERRAIN_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aTruthNormal;
layout(location=2) in vec3 aEnhancedNormal;
layout(location=3) in vec4 aField0;
layout(location=4) in vec4 aField1;
layout(location=5) in vec4 aField2;
layout(location=6) in vec4 aField3;
uniform mat4 uViewProjection;
uniform float uKarstStrength;
uniform float uFieldStrength;
out vec3 vWorld;
out vec3 vNormal;
out vec4 vField0;
out vec4 vField1;
out vec4 vField2;
out vec4 vField3;
void main(){
  float k=uKarstStrength;
  float f=uFieldStrength;
  vec3 position=aPosition;
  position.y+=aField2.y*k+aField2.z*f;
  float normalMix=clamp(max(k,f),0.0,1.0);
  vNormal=normalize(mix(aTruthNormal,aEnhancedNormal,normalMix));
  vWorld=position;
  vField0=aField0;
  vField1=aField1;
  vField2=aField2;
  vField3=aField3;
  gl_Position=uViewProjection*vec4(position,1.0);
}`;

const WATER_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in float aClass;
uniform mat4 uViewProjection;
out vec3 vWorld;
out float vClass;
void main(){vWorld=aPosition;vClass=aClass;gl_Position=uViewProjection*vec4(aPosition,1.0);}`;
const WATER_FS=`#version 300 es
precision highp float;
in vec3 vWorld;
in float vClass;
uniform vec3 uEye;
uniform float uTime;
out vec4 outColor;
void main(){
  vec3 V=normalize(uEye-vWorld);
  float fres=pow(1.0-clamp(V.y,0.0,1.0),2.4);
  float ripple=sin(vWorld.x*.075+uTime*.75)+sin(vWorld.z*.092-uTime*.58)+sin((vWorld.x+vWorld.z)*.031+uTime*.37);
  vec3 deep=vClass<.5?vec3(.035,.19,.245):vec3(.045,.25,.29);
  vec3 pale=vec3(.21,.48,.52);
  vec3 color=mix(deep,pale,.16+fres*.55)+ripple*.006;
  outColor=vec4(color,vClass<.5?.88:.76);
}`;

const SKIRT_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
uniform mat4 uViewProjection;
out float vY;
void main(){vY=aPosition.y;gl_Position=uViewProjection*vec4(aPosition,1.0);}`;
const SKIRT_FS=`#version 300 es
precision highp float;
in float vY;
out vec4 outColor;
void main(){float t=clamp((vY+60.0)/140.0,0.0,1.0);outColor=vec4(mix(vec3(.045,.039,.030),vec3(.16,.135,.085),t),1.0);}`;
const TERRAIN_FS=`#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
in vec4 vField0;
in vec4 vField1;
in vec4 vField2;
in vec4 vField3;
uniform int uMode;
uniform float uMinElevation;
uniform float uMaxElevation;
uniform float uDetailStrength;
uniform float uColorStrength;
uniform vec3 uEye;
out vec4 outColor;
float sat(float v){return clamp(v,0.0,1.0);}
float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
vec3 hash33(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return fract(sin(p)*43758.5453123);}
float valueNoise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float n000=hash31(i),n100=hash31(i+vec3(1,0,0)),n010=hash31(i+vec3(0,1,0)),n110=hash31(i+vec3(1,1,0)),n001=hash31(i+vec3(0,0,1)),n101=hash31(i+vec3(1,0,1)),n011=hash31(i+vec3(0,1,1)),n111=hash31(i+vec3(1,1,1));return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y),f.z);}
float fbm3(vec3 p){float sum=0.0,amp=.52;mat3 r=mat3(.00,.80,.60,-.80,.36,-.48,-.60,-.48,.64);for(int i=0;i<4;i++){sum+=(valueNoise3(p)-.5)*2.0*amp;p=r*p*2.03+vec3(7.1,3.7,5.9);amp*=.49;}return sum*.5+.5;}
float ridged3(vec3 p){float sum=0.0,amp=.58;mat3 r=mat3(.36,.48,-.80,-.80,.60,.00,.48,.64,.60);for(int i=0;i<4;i++){float n=1.0-abs(valueNoise3(p)*2.0-1.0);sum+=n*n*amp;p=r*p*2.08+vec3(11.7,5.3,8.9);amp*=.48;}return sat(sum*.76);}
vec2 worley3(vec3 p){vec3 id=floor(p),f=fract(p);float d1=10.0,d2=10.0;for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 o=vec3(float(x),float(y),float(z));vec3 h=hash33(id+o);float d=length(o+h-f);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}return vec2(d1,d2);}
vec3 domainWarp(vec3 p){return vec3(fbm3(p+vec3(13.1,1.7,5.2)),fbm3(p+vec3(4.7,19.3,9.1)),fbm3(p+vec3(8.9,3.3,23.7)))-.5;}
float autoLevel(float v,float a,float b){return sat((v-a)/max(.0001,b-a));}
float clarity(float v,float amount){float t=sat(v),local=t*t*(3.0-2.0*t);return sat(t+(t-local)*amount*1.45);}
float maskSharp(float v,float sharpness){float w=mix(.30,.035,sat(sharpness/1.6));return smoothstep(.5-w,.5+w,v);}
vec3 clut5(float t,vec3 c0,vec3 c1,vec3 c2,vec3 c3,vec3 c4){float x=sat(t)*4.0;if(x<1.0)return mix(c0,c1,x);if(x<2.0)return mix(c1,c2,x-1.0);if(x<3.0)return mix(c2,c3,x-2.0);return mix(c3,c4,x-3.0);}
vec4 splat(float a,float b,float c,float d,float sharpness){float p=1.0+sat(sharpness/1.6)*4.0;vec4 w=pow(max(vec4(a,b,c,d),vec4(.0001)),vec4(p));return w/max(dot(w,vec4(1)),.0001);}
vec3 truthRamp(float t){return clut5(t,vec3(.09,.17,.13),vec3(.18,.30,.17),vec3(.35,.37,.21),vec3(.46,.42,.28),vec3(.70,.69,.61));}
void main(){
  float truth=vField0.x,slope=sat(vField0.y),curvature=clamp(vField0.z,-1.0,1.0),karst=sat(vField0.w);
  float rock=sat(vField1.x),paddy=sat(vField1.y),wet=sat(vField1.z),bund=sat(vField1.w);
  float channel=sat(vField2.x),karstDelta=vField2.y,fieldDelta=vField2.z,unitSeed=vField2.w;
  float flow=sat(vField3.x),talus=sat(vField3.y),cliff=sat(vField3.z),terrace=sat(vField3.w);
  float elev=sat((truth-uMinElevation)/max(1.0,uMaxElevation-uMinElevation));
  vec3 p=vec3(vWorld.x*.0065,vWorld.y*.012,vWorld.z*.0065);
  vec3 q=p+domainWarp(p*.72+vec3(1.37,4.19,7.31))*.74;
  float macroA=fbm3(q*.55+vec3(2.7,6.1,1.2));
  float macroB=fbm3(q*1.18+vec3(9.2,1.8,5.6));
  float ruggedA=ridged3(q*2.25+vec3(3.4,7.8,11.1));
  float ruggedB=ridged3((q+domainWarp(q*1.31)*.35)*4.65+vec3(12.4,2.2,8.3));
  float rugged=clarity(ruggedA*.63+ruggedB*.37,.76);
  vec2 cells=worley3(q*2.75+vec3(8.1,2.6,4.9));
  float plateEdge=1.0-smoothstep(.025,.19,cells.y-cells.x);
  float strataPhase=(vWorld.y*.052+vWorld.x*.0105+vWorld.z*.0048+(macroB-.5)*1.8)*6.2831853;
  float strata=pow(1.0-abs(sin(strataPhase)),3.2)*smoothstep(.28,.82,macroA);
  float verticalStreak=pow(1.0-abs(sin(vWorld.y*.19+(vWorld.x+vWorld.z)*.026+(macroA-.5)*4.1)),5.0);
  float fracture=maskSharp(rugged*.55+plateEdge*.45,1.05)*cliff;
  float microRidge=ridged3(q*18.0+vec3(17.2,9.7,3.1));
  float microPore=smoothstep(.74,.94,ridged3(q*37.0+vec3(3.7,15.4,21.8)));
  float separation=smoothstep(.09,.42,abs(macroA-rugged));
  float cavity=sat(fracture*.38+microPore*.30+verticalStreak*.20*cliff+channel*.32);
  float protrusion=sat(rugged*.50+strata*.24+plateEdge*.16+bund*.35);
  float surfaceHeight=(rugged-.52)*1.35*rock+strata*.66*rock-fracture*.72*rock+(microRidge-.45)*.16+bund*.18-channel*.14;
  vec3 baseNormal=normalize(vNormal);
  vec3 displaced=vWorld+baseNormal*surfaceHeight*uDetailStrength;
  vec3 N=normalize(cross(dFdx(displaced),dFdy(displaced)));
  if(dot(N,baseNormal)<0.0)N=-N;
  N=normalize(mix(baseNormal,N,sat(.24+uDetailStrength*.52)));

  vec3 soil=clut5(clarity(macroA*.58+macroB*.24+unitSeed*.18,.58),vec3(.105,.075,.042),vec3(.22,.145,.072),vec3(.36,.255,.115),vec3(.47,.38,.17),vec3(.61,.53,.29));
  vec3 paddyColor=clut5(clarity(macroB*.45+unitSeed*.38+wet*.17,.72),vec3(.12,.15,.055),vec3(.28,.34,.09),vec3(.48,.51,.13),vec3(.67,.60,.17),vec3(.78,.70,.29));
  vec3 limestone=clut5(clarity(rugged*.46+strata*.20+macroA*.18+unitSeed*.16,.82),vec3(.075,.073,.066),vec3(.20,.22,.21),vec3(.36,.37,.34),vec3(.53,.52,.46),vec3(.72,.70,.61));
  float iron=maskSharp(macroB*.54+flow*.18+separation*.28,.76)*rock;
  limestone=mix(limestone,vec3(.42,.29,.16),iron*.38);
  limestone=mix(limestone,vec3(.72,.68,.54),strata*.28);
  limestone*=mix(1.0,.68,wet*.48);
  soil*=mix(1.0,.60,wet*.68);
  paddyColor*=mix(1.04,.66,wet*.76);
  vec4 weights=splat(max(0.0,1.0-paddy-rock),paddy,rock,talus,.72);
  vec3 color=soil*weights.x+paddyColor*weights.y+limestone*weights.z+mix(soil,limestone,.55)*weights.w;
  color=mix(color,vec3(.055,.22,.255),channel*.72+wet*.08);
  color=mix(color,vec3(.16,.105,.045),bund*.64);
  color=mix(color,vec3(.085,.070,.052),cavity*.34*rock);
  color=mix(color,vec3(.66,.64,.54),separation*.13*rock);

  if(uMode==1){color=truthRamp(elev);}
  else if(uMode==2){float positive=sat(karstDelta/42.0),negative=sat(-karstDelta/15.0);color=mix(vec3(.055,.075,.064),vec3(.87,.63,.18),karst);color=mix(color,vec3(.98,.87,.48),positive);color=mix(color,vec3(.16,.42,.66),negative*.82);}
  else if(uMode==3){color=mix(vec3(.065,.078,.052),paddyColor,pow(paddy,.58));color=mix(color,vec3(.31,.17,.055),pow(bund,.55));color=mix(color,vec3(.055,.42,.52),pow(channel,.50));}
  else if(uMode==4){color=clut5(pow(wet,.68),vec3(.15,.095,.055),vec3(.25,.20,.11),vec3(.12,.37,.34),vec3(.055,.51,.58),vec3(.18,.66,.70));color=mix(color,vec3(.055,.30,.50),channel*.75);}
  else if(uMode==5){color=clut5(pow(rock,.58),vec3(.075,.105,.070),vec3(.18,.21,.17),vec3(.37,.37,.32),vec3(.60,.58,.49),vec3(.82,.79,.68));color=mix(color,vec3(.10,.07,.05),fracture*.50);color=mix(color,vec3(.76,.65,.42),strata*.25);}

  float luma=dot(color,vec3(.2126,.7152,.0722));
  color=mix(vec3(luma),color,uColorStrength);
  vec3 L=normalize(vec3(-.47,.79,.39));
  vec3 V=normalize(uEye-vWorld);
  vec3 H=normalize(L+V);
  float diffuse=max(dot(N,L),0.0);
  float wrap=sat(dot(N,L)*.68+.32);
  float sky=sat(N.y*.5+.5);
  float ao=sat(1.0-cavity*.33-curvature<0.0?0.0:0.0);
  ao=sat(1.0-cavity*.28-sat(-curvature)*.12-fracture*.13-rock);
  ao=mix(ao,1.0,.42);
  float roughness=sat(.48+rock*.28+paddy*.11+talus*.16-wet*.24+microRidge*.08);
  float specular=pow(max(dot(N,H),0.0),mix(52.0,8.0,roughness))*mix(.20,.055,roughness);
  float rim=pow(1.0-max(dot(N,V),0.0),3.0)*.12;
  vec3 lit=color*(.20+.63*wrap+.17*sky)*ao;
  lit+=vec3(.92,.88,.72)*specular*(1.0-wet*.22)+vec3(.16,.24,.22)*rim;
  float distanceToEye=length(uEye-vWorld);
  float fog=smoothstep(1700.0,4300.0,distanceToEye);
  lit=mix(lit,vec3(.055,.085,.073),fog*.65);
  outColor=vec4(pow(clamp(lit,0.0,1.3),vec3(.90)),1.0);
}`;
const TERRAIN_FS_V21=`#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
in vec4 vField0;
in vec4 vField1;
in vec4 vField2;
in vec4 vField3;
uniform int uMode;
uniform float uMinElevation;
uniform float uMaxElevation;
uniform float uDetailStrength;
uniform float uColorStrength;
uniform vec3 uEye;
out vec4 outColor;
float sat(float v){return clamp(v,0.0,1.0);}
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fb2(vec2 p){float s=0.0,a=.56;mat2 r=mat2(.80,.60,-.60,.80);for(int i=0;i<3;i++){s+=(n2(p)-.5)*2.0*a;p=r*p*2.07+vec2(9.3,5.7);a*=.48;}return s*.5+.5;}
float rg2(vec2 p){float s=0.0,a=.62;mat2 r=mat2(.72,.69,-.69,.72);for(int i=0;i<3;i++){float n=1.0-abs(n2(p)*2.0-1.0);s+=n*n*a;p=r*p*2.11+vec2(7.1,12.9);a*=.47;}return sat(s*.72);}
vec2 wc2(vec2 p){vec2 id=floor(p),f=fract(p);float d1=8.0,d2=8.0;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y)),j=vec2(h21(id+o),h21(id+o+19.7)),v=o+j-f;float d=dot(v,v);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}return sqrt(vec2(d1,d2));}
float sharp(float v,float s){float w=mix(.28,.045,sat(s));return smoothstep(.5-w,.5+w,v);}
float clearField(float v,float a){float t=sat(v),m=t*t*(3.0-2.0*t);return sat(t+(t-m)*a);}
vec3 clut5(float t,vec3 a,vec3 b,vec3 c,vec3 d,vec3 e){float x=sat(t)*4.0;if(x<1.0)return mix(a,b,x);if(x<2.0)return mix(b,c,x-1.0);if(x<3.0)return mix(c,d,x-2.0);return mix(d,e,x-3.0);}
vec3 truthRamp(float t){return clut5(t,vec3(.075,.15,.11),vec3(.16,.28,.13),vec3(.34,.37,.18),vec3(.49,.43,.25),vec3(.72,.70,.60));}
void main(){
 float truth=vField0.x,slope=sat(vField0.y),curv=clamp(vField0.z,-1.0,1.0),karst=sat(vField0.w);
 float rock=sat(vField1.x),paddy=sat(vField1.y),wet=sat(vField1.z),bund=sat(vField1.w);
 float channel=sat(vField2.x),kDelta=vField2.y,fDelta=vField2.z,seed=vField2.w;
 float flow=sat(vField3.x),talus=sat(vField3.y),cliff=sat(vField3.z),terrace=sat(vField3.w);
 float elev=sat((truth-uMinElevation)/max(1.0,uMaxElevation-uMinElevation));
 vec2 p=vWorld.xz,warp=vec2(fb2(p*.0027+vec2(7.2,1.9)),fb2(p*.0027+vec2(2.3,11.7)))-.5;
 vec2 q=p+warp*34.0;
 float macro=fb2(q*.0017+vec2(3.7,9.1));
 float meso=fb2(q*.0082+vec2(17.3,4.6));
 float ridge=rg2(q*.0125+vec2(8.4,14.2));
 vec2 cell=wc2(q*.018+vec2(4.1,7.8));
 float plate=1.0-smoothstep(.035,.19,cell.y-cell.x);
 float strata=pow(1.0-abs(sin(vWorld.y*.072+q.x*.008+q.y*.003+(macro-.5)*2.1)),3.0);
 float streak=pow(1.0-abs(sin(vWorld.y*.18+q.x*.019+(meso-.5)*3.0)),5.0)*cliff;
 float fracture=sharp(ridge*.57+plate*.43,.72)*cliff;
 float micro=rg2(q*.085+vec2(21.1,3.2));
 float separation=smoothstep(.10,.40,abs(macro-ridge));
 float cavity=sat(fracture*.42+streak*.20+channel*.34+smoothstep(.82,.97,micro)*.22);
 float relief=(ridge-.51)*1.25*rock+strata*.52*rock-fracture*.65*rock+(micro-.48)*.12+bund*.18-channel*.16;
 vec3 baseN=normalize(vNormal),dp=vWorld+baseN*relief*uDetailStrength;
 vec3 N=normalize(cross(dFdx(dp),dFdy(dp)));if(dot(N,baseN)<0.0)N=-N;N=normalize(mix(baseN,N,sat(.26+uDetailStrength*.48)));
 vec3 soil=clut5(clearField(macro*.56+meso*.27+seed*.17,.62),vec3(.075,.055,.030),vec3(.18,.115,.050),vec3(.31,.215,.085),vec3(.43,.34,.14),vec3(.58,.49,.25));
 vec3 field=clut5(clearField(meso*.42+seed*.38+wet*.20,.72),vec3(.10,.13,.035),vec3(.25,.31,.065),vec3(.45,.49,.10),vec3(.64,.58,.15),vec3(.79,.70,.27));
 vec3 lime=clut5(clearField(ridge*.44+strata*.22+macro*.20+seed*.14,.84),vec3(.055,.057,.054),vec3(.17,.19,.19),vec3(.33,.35,.34),vec3(.52,.52,.47),vec3(.76,.74,.65));
 lime=mix(lime,vec3(.43,.28,.13),sharp(meso*.55+flow*.20+separation*.25,.56)*rock*.34);
 lime=mix(lime,vec3(.78,.72,.56),strata*rock*.22);
 lime*=mix(1.0,.66,wet*.52);soil*=mix(1.0,.61,wet*.72);field*=mix(1.04,.67,wet*.74);
 float fieldWeight=pow(paddy,.66),rockWeight=pow(rock,.70),soilWeight=sat(1.0-max(fieldWeight,rockWeight));
 vec3 color=soil*soilWeight+field*fieldWeight*(1.0-rockWeight)+lime*rockWeight;
 color=mix(color,mix(soil,lime,.52),talus*.44);color=mix(color,vec3(.13,.085,.038),bund*.72);color=mix(color,vec3(.045,.28,.34),channel*.78);color=mix(color,vec3(.045,.055,.047),cavity*rock*.38);color=mix(color,vec3(.69,.65,.51),separation*rock*.14);
 if(uMode==1)color=truthRamp(elev);
 else if(uMode==2){float pos=sat(kDelta/55.0),neg=sat(-kDelta/17.0);color=mix(vec3(.045,.065,.055),vec3(.87,.52,.13),karst);color=mix(color,vec3(.98,.84,.39),pos);color=mix(color,vec3(.18,.44,.71),neg*.85);}
 else if(uMode==3){color=mix(vec3(.055,.068,.040),field,pow(paddy,.48));color=mix(color,vec3(.38,.19,.045),pow(bund,.48));color=mix(color,vec3(.035,.42,.52),pow(channel,.45));}
 else if(uMode==4){color=clut5(pow(wet,.62),vec3(.13,.08,.04),vec3(.25,.18,.08),vec3(.12,.38,.32),vec3(.035,.53,.59),vec3(.17,.69,.72));color=mix(color,vec3(.035,.29,.51),channel*.76);}
 else if(uMode==5){color=clut5(pow(rock,.56),vec3(.055,.08,.055),vec3(.16,.19,.16),vec3(.36,.37,.34),vec3(.61,.59,.52),vec3(.84,.81,.71));color=mix(color,vec3(.065,.045,.035),fracture*.54);color=mix(color,vec3(.77,.66,.43),strata*.23);}
 float luma=dot(color,vec3(.2126,.7152,.0722));color=mix(vec3(luma),color,uColorStrength);
 vec3 L=normalize(vec3(-.48,.80,.36)),V=normalize(uEye-vWorld),H=normalize(L+V);
 float wrap=sat(dot(N,L)*.67+.33),sky=sat(N.y*.5+.5),ao=sat(1.0-cavity*.27-sat(-curv)*.10-fracture*.10-rock*.045);
 float rough=sat(.48+rock*.28+paddy*.10+talus*.14-wet*.23+micro*.07),spec=pow(max(dot(N,H),0.0),mix(50.0,8.0,rough))*mix(.18,.045,rough),rim=pow(1.0-max(dot(N,V),0.0),3.0)*.10;
 vec3 lit=color*(.23+.59*wrap+.18*sky)*mix(ao,1.0,.34)+vec3(.93,.88,.72)*spec+vec3(.13,.21,.18)*rim;
 float fog=smoothstep(1800.0,4300.0,length(uEye-vWorld));lit=mix(lit,vec3(.05,.078,.066),fog*.60);
 outColor=vec4(pow(clamp(lit,0.0,1.25),vec3(.90)),1.0);
}`;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const smoothstep=(a,b,v)=>{const t=clamp((v-a)/Math.max(1e-9,b-a));return t*t*(3-2*t);};
const fract=v=>v-Math.floor(v);
function hash2(x,z,seed=SEEDS.shape){return fract(Math.sin(x*127.1+z*311.7+seed*.000173)*43758.5453123);}
function valueNoise2(x,z,seed=SEEDS.shape){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);const a=hash2(ix,iz,seed),b=hash2(ix+1,iz,seed),c=hash2(ix,iz+1,seed),d=hash2(ix+1,iz+1,seed);return mix(mix(a,b,u),mix(c,d,u),v);}
function fbm2(x,z,seed=SEEDS.shape,octaves=5){let sum=0,amp=.52,norm=0,frequency=1;for(let i=0;i<octaves;i++){sum+=(valueNoise2(x*frequency,z*frequency,seed+i*193)-.5)*2*amp;norm+=amp;frequency*=2.03;amp*=.49;}return sum/Math.max(norm,1e-9);}
function ridged2(x,z,seed=SEEDS.shape,octaves=5){let sum=0,amp=.56,norm=0,frequency=1;for(let i=0;i<octaves;i++){let n=1-Math.abs(valueNoise2(x*frequency,z*frequency,seed+i*229)*2-1);sum+=n*n*amp;norm+=amp;frequency*=2.07;amp*=.48;}return sum/Math.max(norm,1e-9);}
async function fetchJson(url){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`${url} HTTP ${response.status}`);return response.json();}
async function fetchBinary(url){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`${url} HTTP ${response.status}`);return response.arrayBuffer();}
async function sha256Hex(buffer){const digest=await crypto.subtle.digest('SHA-256',buffer);return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');}
function assert(condition,message){if(!condition)throw new Error(message);}
function littleEndian(){const b=new ArrayBuffer(2);new DataView(b).setUint16(0,0x00ff,true);return new Uint16Array(b)[0]===0x00ff;}
function decodeI16(buffer){if(littleEndian())return new Int16Array(buffer);const out=new Int16Array(buffer.byteLength/2),view=new DataView(buffer);for(let i=0;i<out.length;i++)out[i]=view.getInt16(i*2,true);return out;}
function decodeF32(buffer){if(littleEndian())return new Float32Array(buffer);const out=new Float32Array(buffer.byteLength/4),view=new DataView(buffer);for(let i=0;i<out.length;i++)out[i]=view.getFloat32(i*4,true);return out;}
function extractTruth(tile){const out=new Float32Array(TRUTH_GRID*TRUTH_GRID);let minimum=Infinity,maximum=-Infinity;for(let row=0;row<TRUTH_GRID;row++){for(let column=0;column<TRUTH_GRID;column++){const value=tile[(WINDOW_Y+row)*TILE_GRID+WINDOW_X+column];assert(value!==0,`源窗口含 NoData 0，位置 ${column},${row}`);out[row*TRUTH_GRID+column]=value;minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);}}state.minimum=minimum;state.maximum=maximum;return out;}
function catmull(p0,p1,p2,p3,t){const t2=t*t,t3=t2*t;return .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3);}
function truthAtSourceGrid(truth,x,z){const ix=Math.floor(x),iz=Math.floor(z),tx=x-ix,tz=z-iz;const row=new Float64Array(4);for(let oz=-1;oz<=2;oz++){const zz=clamp(iz+oz,0,TRUTH_GRID-1);const p0=truth[zz*TRUTH_GRID+clamp(ix-1,0,TRUTH_GRID-1)];const p1=truth[zz*TRUTH_GRID+clamp(ix,0,TRUTH_GRID-1)];const p2=truth[zz*TRUTH_GRID+clamp(ix+1,0,TRUTH_GRID-1)];const p3=truth[zz*TRUTH_GRID+clamp(ix+2,0,TRUTH_GRID-1)];row[oz+1]=catmull(p0,p1,p2,p3,tx);}return catmull(row[0],row[1],row[2],row[3],tz);}
function buildDenseTruth(truth){const dense=new Float32Array(RENDER_GRID*RENDER_GRID);let maxError=0;for(let row=0;row<RENDER_GRID;row++){const z=row/SUBDIVISION;for(let column=0;column<RENDER_GRID;column++){const x=column/SUBDIVISION;const value=truthAtSourceGrid(truth,x,z);dense[row*RENDER_GRID+column]=value;if(row%SUBDIVISION===0&&column%SUBDIVISION===0){const source=truth[(row/SUBDIVISION)*TRUTH_GRID+column/SUBDIVISION];maxError=Math.max(maxError,Math.abs(value-source));}}}state.sourceNodeMaxError=maxError;assert(maxError<=1e-6,`源像元交点误差 ${maxError} m 超出合同`);return dense;}
function boxBlur(source,width,height,radius){const temp=new Float32Array(source.length),out=new Float32Array(source.length),span=radius*2+1;for(let row=0;row<height;row++){let sum=0;for(let x=-radius;x<=radius;x++)sum+=source[row*width+clamp(x,0,width-1)];for(let column=0;column<width;column++){temp[row*width+column]=sum/span;sum-=source[row*width+clamp(column-radius,0,width-1)];sum+=source[row*width+clamp(column+radius+1,0,width-1)];}}for(let column=0;column<width;column++){let sum=0;for(let y=-radius;y<=radius;y++)sum+=temp[clamp(y,0,height-1)*width+column];for(let row=0;row<height;row++){out[row*width+column]=sum/span;sum-=temp[clamp(row-radius,0,height-1)*width+column];sum+=temp[clamp(row+radius+1,0,height-1)*width+column];}}return out;}
function pointSegmentDistance(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,denominator=dx*dx+dz*dz;if(denominator<1e-9)return Math.hypot(px-ax,pz-az);const t=clamp(((px-ax)*dx+(pz-az)*dz)/denominator);return Math.hypot(px-(ax+dx*t),pz-(az+dz*t));}
function clipSegment(x0,z0,x1,z1,half=SIDE_M*.5){const dx=x1-x0,dz=z1-z0;let t0=0,t1=1;for(const[p,q]of[[-dx,x0+half],[dx,half-x0],[-dz,z0+half],[dz,half-z0]]){if(Math.abs(p)<1e-9){if(q<0)return null;continue;}const r=q/p;if(p<0)t0=Math.max(t0,r);else t1=Math.min(t1,r);if(t0>t1)return null;}return{t0,t1};}
function parseHydrology(values){const bounds=state.manifest.aoi.native_sample_center_bounds_epsg32649,fullE=(bounds[0]+bounds[2])*.5,fullN=(bounds[1]+bounds[3])*.5,segments=[];for(let i=0;i+7<values.length;i+=8){const sx=values[i]+fullE-CENTER_E,sz=CENTER_N-(fullN-values[i+2]),ex=values[i+3]+fullE-CENTER_E,ez=CENTER_N-(fullN-values[i+5]);const clipped=clipSegment(sx,sz,ex,ez,SIDE_M*.5+3);if(!clipped)continue;const sy=values[i+1],ey=values[i+4],t0=clipped.t0,t1=clipped.t1;segments.push({x0:mix(sx,ex,t0),z0:mix(sz,ez,t0),y0:mix(sy,ey,t0),x1:mix(sx,ex,t1),z1:mix(sz,ez,t1),y1:mix(sy,ey,t1),classValue:Math.round(values[i+6]),sourceWidth:values[i+7]});}return segments;}
function nearestWaterDistance(x,z,segments){let distance=1e9;for(const s of segments)distance=Math.min(distance,pointSegmentDistance(x,z,s.x0,s.z0,s.x1,s.z1));return distance;}
function denseTruthAtWorld(x,z){const gx=(x+SIDE_M*.5)/RENDER_SPACING,gz=(z+SIDE_M*.5)/RENDER_SPACING;const x0=clamp(Math.floor(gx),0,RENDER_GRID-1),z0=clamp(Math.floor(gz),0,RENDER_GRID-1),x1=clamp(x0+1,0,RENDER_GRID-1),z1=clamp(z0+1,0,RENDER_GRID-1),tx=gx-x0,tz=gz-z0;return mix(mix(state.denseTruth[z0*RENDER_GRID+x0],state.denseTruth[z0*RENDER_GRID+x1],tx),mix(state.denseTruth[z1*RENDER_GRID+x0],state.denseTruth[z1*RENDER_GRID+x1],tx),tz);}
function detectKarstPeaks(dense){const broad=boxBlur(dense,RENDER_GRID,RENDER_GRID,34),medium=boxBlur(dense,RENDER_GRID,RENDER_GRID,13),candidates=[];for(let row=4;row<TRUTH_GRID-4;row++){for(let column=4;column<TRUTH_GRID-4;column++){const dr=row*SUBDIVISION,dc=column*SUBDIVISION,index=dr*RENDER_GRID+dc,h=dense[index],relief=h-broad[index],shoulder=h-medium[index],elev=(h-state.minimum)/Math.max(1,state.maximum-state.minimum);if(relief<7||h<state.minimum+34)continue;let localMaximum=true;for(let oz=-2;oz<=2&&localMaximum;oz++)for(let ox=-2;ox<=2;ox++){if(!ox&&!oz)continue;if(dense[(dr+oz*SUBDIVISION)*RENDER_GRID+dc+ox*SUBDIVISION]>h+1.5){localMaximum=false;break;}}const score=relief*1.25+shoulder*.55+elev*24+(localMaximum?12:0);candidates.push({column,row,x:column*TRUTH_SPACING-SIDE_M*.5,z:row*TRUTH_SPACING-SIDE_M*.5,h,relief,score});}}candidates.sort((a,b)=>b.score-a.score);const peaks=[];for(const candidate of candidates){if(peaks.some(p=>Math.hypot(candidate.x-p.x,candidate.z-p.z)<105))continue;const seed=hash2(candidate.column,candidate.row,SEEDS.shape);peaks.push({...candidate,radius:clamp(62+candidate.relief*1.15,66,126),amplitude:clamp(18+candidate.relief*.82,20,48),angle:seed*Math.PI,ellipse:.72+hash2(candidate.row,candidate.column,SEEDS.shape+19)*.38,phase:hash2(candidate.column+31,candidate.row-17,SEEDS.shape+53)});if(peaks.length>=11)break;}if(peaks.length<5){for(const candidate of candidates){if(peaks.some(p=>Math.hypot(candidate.x-p.x,candidate.z-p.z)<82))continue;peaks.push({...candidate,radius:78,amplitude:24,angle:hash2(candidate.column,candidate.row)*Math.PI,ellipse:.86,phase:.5});if(peaks.length>=7)break;}}return peaks;}
function parcelGrammar(easting,northing){const warpX=fbm2(easting*.0021,northing*.0021,SEEDS.field+31,4)*24,warpZ=fbm2(easting*.0021+7.4,northing*.0021-5.1,SEEDS.field+73,4)*24,angle=.31+fbm2(easting*.00065,northing*.00065,SEEDS.field+91,3)*.18,ca=Math.cos(angle),sa=Math.sin(angle),rx=(easting+warpX)*ca+(northing+warpZ)*sa,rz=-(easting+warpX)*sa+(northing+warpZ)*ca,cellX=76,cellZ=58,gx=Math.floor(rx/cellX),gz=Math.floor(rz/cellZ);let first=1e9,second=1e9,nearestX=gx,nearestZ=gz;for(let oz=-1;oz<=1;oz++)for(let ox=-1;ox<=1;ox++){const cx=gx+ox,cz=gz+oz,px=(cx+.14+hash2(cx,cz,SEEDS.field+149)*.72)*cellX,pz=(cz+.14+hash2(cx,cz,SEEDS.field+193)*.72)*cellZ,d=Math.hypot(rx-px,rz-pz);if(d<first){second=first;first=d;nearestX=cx;nearestZ=cz;}else if(d<second)second=d;}const edgeDistance=second-first,boundary=1-smoothstep(1.3,5.8,edgeDistance),fieldSeed=hash2(nearestX,nearestZ,SEEDS.field+277),rowA=1-smoothstep(.91,.996,Math.abs(Math.sin((rx+fieldSeed*117)*.058))),rowB=1-smoothstep(.925,.998,Math.abs(Math.sin((rz-fieldSeed*89)*.071))),channel=Math.max(rowA,rowB*.66);return{boundary,fieldSeed,channel};}
function buildNormalArray(heights){const normals=new Float32Array(heights.length*3);for(let row=0;row<RENDER_GRID;row++){for(let column=0;column<RENDER_GRID;column++){const l=heights[row*RENDER_GRID+Math.max(0,column-1)],r=heights[row*RENDER_GRID+Math.min(RENDER_GRID-1,column+1)],d=heights[Math.max(0,row-1)*RENDER_GRID+column],u=heights[Math.min(RENDER_GRID-1,row+1)*RENDER_GRID+column],dx=Math.max(RENDER_SPACING,(Math.min(RENDER_GRID-1,column+1)-Math.max(0,column-1))*RENDER_SPACING),dz=Math.max(RENDER_SPACING,(Math.min(RENDER_GRID-1,row+1)-Math.max(0,row-1))*RENDER_SPACING);let nx=-(r-l)/dx,ny=1,nz=-(u-d)/dz,len=Math.hypot(nx,ny,nz)||1;const offset=(row*RENDER_GRID+column)*3;normals[offset]=nx/len;normals[offset+1]=ny/len;normals[offset+2]=nz/len;}}return normals;}
function deriveTerrainFields(dense,segments){const count=dense.length,broad=boxBlur(dense,RENDER_GRID,RENDER_GRID,34),medium=boxBlur(dense,RENDER_GRID,RENDER_GRID,13),small=boxBlur(dense,RENDER_GRID,RENDER_GRID,3);state.peaks=detectKarstPeaks(dense);const slope=new Float32Array(count),curvature=new Float32Array(count),karst=new Float32Array(count),rock=new Float32Array(count),paddy=new Float32Array(count),wet=new Float32Array(count),bund=new Float32Array(count),channel=new Float32Array(count),karstDelta=new Float32Array(count),fieldDelta=new Float32Array(count),unitSeed=new Float32Array(count),flow=new Float32Array(count),talus=new Float32Array(count),cliff=new Float32Array(count),terrace=new Float32Array(count),enhanced=new Float32Array(count);let kMin=1e9,kMax=-1e9,fMin=1e9,fMax=-1e9;const elevationRange=Math.max(1,state.maximum-state.minimum);for(let row=0;row<RENDER_GRID;row++){for(let column=0;column<RENDER_GRID;column++){const index=row*RENDER_GRID+column,truth=dense[index],x=column*RENDER_SPACING-SIDE_M*.5,z=row*RENDER_SPACING-SIDE_M*.5,easting=CENTER_E+x,northing=CENTER_N-z,l=dense[row*RENDER_GRID+Math.max(0,column-1)],r=dense[row*RENDER_GRID+Math.min(RENDER_GRID-1,column+1)],d=dense[Math.max(0,row-1)*RENDER_GRID+column],u=dense[Math.min(RENDER_GRID-1,row+1)*RENDER_GRID+column],gx=(r-l)/Math.max(RENDER_SPACING,(Math.min(RENDER_GRID-1,column+1)-Math.max(0,column-1))*RENDER_SPACING),gz=(u-d)/Math.max(RENDER_SPACING,(Math.min(RENDER_GRID-1,row+1)-Math.max(0,row-1))*RENDER_SPACING),slopeDeg=Math.atan(Math.hypot(gx,gz))*180/Math.PI,slopeNorm=clamp(slopeDeg/62),curv=clamp((small[index]-medium[index])/9,-1,1),relief=truth-broad[index],mediumRelief=truth-medium[index];let strongest=-1e9,secondStrongest=-1e9,peakInfluence=0,flankMask=0,footMask=0;for(const peak of state.peaks){const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle),dx=x-peak.x,dz=z-peak.z,rx=(dx*ca+dz*sa)/peak.ellipse,rz=(-dx*sa+dz*ca)*peak.ellipse,warp=fbm2((easting+peak.phase*319)*.0041,(northing-peak.phase*211)*.0041,SEEDS.shape+Math.round(peak.phase*10000),3),distance=Math.hypot(rx,rz)/(peak.radius*(.90+warp*.16)),crown=Math.exp(-Math.pow(distance/.27,2.5)),tower=Math.exp(-Math.pow(distance/.57,3.0)),broadTower=Math.exp(-Math.pow(distance/.88,4.2)),ring=Math.exp(-Math.pow((distance-.62)/.16,2)),localGate=smoothstep(-4,18,relief+tower*23),ridgeDetail=(ridged2(easting*.018+peak.phase*9,northing*.018-peak.phase*7,SEEDS.shape+307,4)-.52)*3.6*tower,local=localGate*(peak.amplitude*(crown*.70+tower*.34+broadTower*.10-ring*.23)+ridgeDetail);if(local>strongest){secondStrongest=strongest;strongest=local;}else if(local>secondStrongest)secondStrongest=local;peakInfluence=Math.max(peakInfluence,tower);flankMask=Math.max(flankMask,smoothstep(.22,.48,distance)*(1-smoothstep(.72,1.03,distance))*tower*2.1);footMask=Math.max(footMask,smoothstep(.60,.82,distance)*(1-smoothstep(.92,1.17,distance)));}const profileT=clamp((relief+3)/Math.max(22,Math.abs(relief)+28)),profileCut=-10.5*Math.pow(Math.sin(profileT*Math.PI),2)*smoothstep(8,24,relief)*smoothstep(.05,.52,slopeNorm),groove=(ridged2(easting*.026,northing*.026,SEEDS.weather+71,4)-.55)*5.4*flankMask,karstValue=clamp((Math.max(0,strongest)+Math.max(0,secondStrongest)*.18)+profileCut+groove,-14,48),karstLikelihood=clamp(Math.max(peakInfluence,smoothstep(7,27,relief)*smoothstep(.07,.58,slopeNorm)),0,1),cliffValue=clamp(smoothstep(.30,.72,slopeNorm)*(.40+.60*karstLikelihood)+flankMask*.58+smoothstep(9,31,mediumRelief)*.18,0,1),talusValue=clamp(footMask*smoothstep(.12,.50,slopeNorm)*(1-cliffValue*.62),0,1),waterDistance=nearestWaterDistance(x,z,segments),waterCore=1-smoothstep(4.5,22,waterDistance),waterInfluence=Math.exp(-waterDistance/92),elev=(truth-state.minimum)/elevationRange,lowland=1-smoothstep(.13,.52,elev),flat=1-smoothstep(4.5,11.5,slopeDeg),concavity=smoothstep(-.04,.50,-curv),wetness=clamp(waterInfluence*.66+lowland*.19+concavity*.18+smoothstep(.45,.82,fbm2(easting*.003,northing*.003,SEEDS.water+7,4))*.07,0,1),parcel=parcelGrammar(easting,northing),fieldPatch=smoothstep(.17,.67,fbm2(easting*.0024,northing*.0024,SEEDS.field+401,4)*.5+.5),paddyValue=clamp(lowland*flat*(.48+.52*wetness)*(.56+.44*fieldPatch)*(1-waterCore)*(1-cliffValue)*(1-talusValue*.65),0,1),bundValue=paddyValue*parcel.boundary,channelValue=paddyValue*parcel.channel*(1-parcel.boundary*.42),terraceStep=.28+parcel.fieldSeed*.14,terraceTarget=Math.round(truth/terraceStep)*terraceStep,flatten=clamp((terraceTarget-truth)*.35,-.12,.12),fieldValue=clamp(paddyValue*flatten+bundValue*(.30+parcel.fieldSeed*.20)-channelValue*(.19+parcel.fieldSeed*.12),-.30,.52),rockValue=clamp(cliffValue*.80+karstLikelihood*.24*smoothstep(.18,.64,slopeNorm)+talusValue*.24,0,1),flowValue=clamp(waterInfluence*.52+wetness*.28+channelValue*.55,0,1);slope[index]=slopeNorm;curvature[index]=curv;karst[index]=karstLikelihood;rock[index]=rockValue;paddy[index]=paddyValue;wet[index]=wetness;bund[index]=bundValue;channel[index]=channelValue;karstDelta[index]=karstValue;fieldDelta[index]=fieldValue;unitSeed[index]=parcel.fieldSeed;flow[index]=flowValue;talus[index]=talusValue;cliff[index]=cliffValue;terrace[index]=paddyValue*flat;enhanced[index]=truth+karstValue+fieldValue;kMin=Math.min(kMin,karstValue);kMax=Math.max(kMax,karstValue);fMin=Math.min(fMin,fieldValue);fMax=Math.max(fMax,fieldValue);}}state.karstRange=[kMin,kMax];state.fieldRange=[fMin,fMax];return{slope,curvature,karst,rock,paddy,wet,bund,channel,karstDelta,fieldDelta,unitSeed,flow,talus,cliff,terrace,truthNormals:buildNormalArray(dense),enhancedNormals:buildNormalArray(enhanced),enhanced};}
function compileShader(gl,type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(log||'shader compile failed');}return shader;}
function createProgram(gl,vs,fs){const vertex=compileShader(gl,gl.VERTEX_SHADER,vs),fragment=compileShader(gl,gl.FRAGMENT_SHADER,fs),program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const log=gl.getProgramInfoLog(program);gl.deleteProgram(program);throw new Error(log||'program link failed');}return program;}
function setupWebGL(){const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,powerPreference:'high-performance',preserveDrawingBuffer:true});assert(gl,'当前浏览器未提供 WebGL2');const terrainFs=TERRAIN_FS.replace('float ao=sat(1.0-cavity*.33-curvature<0.0?0.0:0.0);\n  ao=sat(1.0-cavity*.28-sat(-curvature)*.12-fracture*.13-rock);','float ao=sat(1.0-cavity*.28-sat(-curvature)*.12-fracture*.13-rock*.08);');state.gl=gl;state.programs={terrain:createProgram(gl,TERRAIN_VS,terrainFs),water:createProgram(gl,WATER_VS,WATER_FS),skirt:createProgram(gl,SKIRT_VS,SKIRT_FS)};state.uniforms={terrain:{viewProjection:gl.getUniformLocation(state.programs.terrain,'uViewProjection'),karst:gl.getUniformLocation(state.programs.terrain,'uKarstStrength'),field:gl.getUniformLocation(state.programs.terrain,'uFieldStrength'),mode:gl.getUniformLocation(state.programs.terrain,'uMode'),minimum:gl.getUniformLocation(state.programs.terrain,'uMinElevation'),maximum:gl.getUniformLocation(state.programs.terrain,'uMaxElevation'),detail:gl.getUniformLocation(state.programs.terrain,'uDetailStrength'),color:gl.getUniformLocation(state.programs.terrain,'uColorStrength'),eye:gl.getUniformLocation(state.programs.terrain,'uEye')},water:{viewProjection:gl.getUniformLocation(state.programs.water,'uViewProjection'),eye:gl.getUniformLocation(state.programs.water,'uEye'),time:gl.getUniformLocation(state.programs.water,'uTime')},skirt:{viewProjection:gl.getUniformLocation(state.programs.skirt,'uViewProjection')}};gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.frontFace(gl.CCW);gl.clearColor(.018,.032,.028,1);}
function buildTerrainMesh(){const gl=state.gl,strideFloats=25,count=RENDER_GRID*RENDER_GRID,vertices=new Float32Array(count*strideFloats);let cursor=0;for(let row=0;row<RENDER_GRID;row++){for(let column=0;column<RENDER_GRID;column++){const index=row*RENDER_GRID+column,no=index*3,x=column*RENDER_SPACING-SIDE_M*.5,z=row*RENDER_SPACING-SIDE_M*.5;vertices[cursor++]=x;vertices[cursor++]=state.denseTruth[index]-state.minimum;vertices[cursor++]=z;vertices[cursor++]=state.fields.truthNormals[no];vertices[cursor++]=state.fields.truthNormals[no+1];vertices[cursor++]=state.fields.truthNormals[no+2];vertices[cursor++]=state.fields.enhancedNormals[no];vertices[cursor++]=state.fields.enhancedNormals[no+1];vertices[cursor++]=state.fields.enhancedNormals[no+2];vertices[cursor++]=state.denseTruth[index];vertices[cursor++]=state.fields.slope[index];vertices[cursor++]=state.fields.curvature[index];vertices[cursor++]=state.fields.karst[index];vertices[cursor++]=state.fields.rock[index];vertices[cursor++]=state.fields.paddy[index];vertices[cursor++]=state.fields.wet[index];vertices[cursor++]=state.fields.bund[index];vertices[cursor++]=state.fields.channel[index];vertices[cursor++]=state.fields.karstDelta[index];vertices[cursor++]=state.fields.fieldDelta[index];vertices[cursor++]=state.fields.unitSeed[index];vertices[cursor++]=state.fields.flow[index];vertices[cursor++]=state.fields.talus[index];vertices[cursor++]=state.fields.cliff[index];vertices[cursor++]=state.fields.terrace[index];}}const indices=new Uint32Array((RENDER_GRID-1)*(RENDER_GRID-1)*6);let ic=0;for(let row=0;row<RENDER_GRID-1;row++){for(let column=0;column<RENDER_GRID-1;column++){const a=row*RENDER_GRID+column,b=a+1,c=a+RENDER_GRID,d=c+1;indices[ic++]=a;indices[ic++]=c;indices[ic++]=b;indices[ic++]=b;indices[ic++]=c;indices[ic++]=d;}}const vao=gl.createVertexArray(),vertexBuffer=gl.createBuffer(),indexBuffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);const stride=strideFloats*4,layout=[[0,3,0],[1,3,3],[2,3,6],[3,4,9],[4,4,13],[5,4,17],[6,4,21]];for(const[location,size,offset]of layout){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,stride,offset*4);}gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);gl.bindVertexArray(null);state.terrain={vao,vertexBuffer,indexBuffer,indexCount:indices.length,vertexCount:count,triangleCount:indices.length/3};}
function buildWaterMesh(){const gl=state.gl,vertices=[],indices=[];const add=(x,y,z,c)=>{vertices.push(x,y,z,c);return vertices.length/4-1;};for(const segment of state.segments){const dx=segment.x1-segment.x0,dz=segment.z1-segment.z0,length=Math.hypot(dx,dz);if(length<.25)continue;const nx=-dz/length,nz=dx/length,base=segment.classValue===0?6:(segment.classValue===1?2.4:1.6),halfWidth=clamp(Math.max(base,segment.sourceWidth*.5),base,40),y0=segment.y0-state.minimum+.52,y1=segment.y1-state.minimum+.52,a=add(segment.x0+nx*halfWidth,y0,segment.z0+nz*halfWidth,segment.classValue),b=add(segment.x0-nx*halfWidth,y0,segment.z0-nz*halfWidth,segment.classValue),c=add(segment.x1+nx*halfWidth,y1,segment.z1+nz*halfWidth,segment.classValue),d=add(segment.x1-nx*halfWidth,y1,segment.z1-nz*halfWidth,segment.classValue);indices.push(a,b,c,c,b,d);}const vao=gl.createVertexArray(),vertexBuffer=gl.createBuffer(),indexBuffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,1,gl.FLOAT,false,16,12);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);gl.bindVertexArray(null);state.water={vao,vertexBuffer,indexBuffer,indexCount:indices.length};}
function buildSkirtMesh(){const gl=state.gl,vertices=[];function pushEdge(points){for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],bottom=-72;vertices.push(a[0],a[1],a[2],a[0],bottom,a[2],b[0],b[1],b[2],b[0],b[1],b[2],a[0],bottom,a[2],b[0],bottom,b[2]);}}const north=[],south=[],west=[],east=[];for(let i=0;i<RENDER_GRID;i++){const x=i*RENDER_SPACING-SIDE_M*.5,z=i*RENDER_SPACING-SIDE_M*.5;north.push([x,state.denseTruth[i]-state.minimum,-SIDE_M*.5]);south.push([x,state.denseTruth[(RENDER_GRID-1)*RENDER_GRID+i]-state.minimum,SIDE_M*.5]);west.push([-SIDE_M*.5,state.denseTruth[i*RENDER_GRID]-state.minimum,z]);east.push([SIDE_M*.5,state.denseTruth[i*RENDER_GRID+RENDER_GRID-1]-state.minimum,z]);}pushEdge(north);pushEdge(east);pushEdge(south.reverse());pushEdge(west.reverse());const vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);gl.bindVertexArray(null);state.skirt={vao,buffer,count:vertices.length/3};}
function mat4Multiply(out,a,b){const r=new Float32Array(16);for(let c=0;c<4;c++)for(let row=0;row<4;row++)r[c*4+row]=a[row]*b[c*4]+a[4+row]*b[c*4+1]+a[8+row]*b[c*4+2]+a[12+row]*b[c*4+3];out.set(r);return out;}
function mat4Perspective(out,fovy,aspect,near,far){const f=1/Math.tan(fovy/2);out.fill(0);out[0]=f/aspect;out[5]=f;out[10]=(far+near)/(near-far);out[11]=-1;out[14]=2*far*near/(near-far);return out;}
function mat4LookAt(out,eye,center,up){let zx=eye[0]-center[0],zy=eye[1]-center[1],zz=eye[2]-center[2],len=Math.hypot(zx,zy,zz)||1;zx/=len;zy/=len;zz/=len;let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;len=Math.hypot(xx,xy,xz)||1;xx/=len;xy/=len;xz/=len;const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;out.set([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*eye[0]+xy*eye[1]+xz*eye[2]),-(yx*eye[0]+yy*eye[1]+yz*eye[2]),-(zx*eye[0]+zy*eye[1]+zz*eye[2]),1]);return out;}
function mat4Invert(out,a){const a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15],b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;let det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;if(!det)return false;det=1/det;out[0]=(a11*b11-a12*b10+a13*b09)*det;out[1]=(a02*b10-a01*b11-a03*b09)*det;out[2]=(a31*b05-a32*b04+a33*b03)*det;out[3]=(a22*b04-a21*b05-a23*b03)*det;out[4]=(a12*b08-a10*b11-a13*b07)*det;out[5]=(a00*b11-a02*b08+a03*b07)*det;out[6]=(a32*b02-a30*b05-a33*b01)*det;out[7]=(a20*b05-a22*b02+a23*b01)*det;out[8]=(a10*b10-a11*b08+a13*b06)*det;out[9]=(a01*b08-a00*b10-a03*b06)*det;out[10]=(a30*b04-a31*b02+a33*b00)*det;out[11]=(a21*b02-a20*b04-a23*b03)*det;out[12]=(a11*b07-a10*b09-a12*b06)*det;out[13]=(a00*b09-a01*b07+a02*b06)*det;out[14]=(a31*b01-a30*b03-a32*b00)*det;out[15]=(a20*b03-a21*b01+a22*b00)*det;return true;}
function transformVec4(m,v){return[m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12]*v[3],m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13]*v[3],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]*v[3],m[3]*v[0]+m[7]*v[1]+m[11]*v[2]+m[15]*v[3]];}
function resizeCanvas(){const dpr=Math.min(MAX_DPR,devicePixelRatio||1),width=Math.max(2,Math.floor(canvas.clientWidth*dpr)),height=Math.max(2,Math.floor(canvas.clientHeight*dpr));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;state.dirty=true;}}
function cameraEye(){const horizontal=Math.cos(state.camera.pitch)*state.camera.distance;return[state.camera.target[0]+Math.sin(state.camera.yaw)*horizontal,state.camera.target[1]+Math.sin(state.camera.pitch)*state.camera.distance,state.camera.target[2]+Math.cos(state.camera.yaw)*horizontal];}
function updateMatrices(width=canvas.width,height=canvas.height){const eye=cameraEye();mat4Perspective(state.projection,Math.PI/4.15,width/Math.max(1,height),.45,9000);mat4LookAt(state.view,eye,state.camera.target,[0,1,0]);mat4Multiply(state.viewProjection,state.projection,state.view);mat4Invert(state.inverseViewProjection,state.viewProjection);return eye;}
function drawSkirt(){const gl=state.gl;if(!state.skirt)return;gl.useProgram(state.programs.skirt);gl.uniformMatrix4fv(state.uniforms.skirt.viewProjection,false,state.viewProjection);gl.disable(gl.CULL_FACE);gl.bindVertexArray(state.skirt.vao);gl.drawArrays(gl.TRIANGLES,0,state.skirt.count);gl.bindVertexArray(null);gl.enable(gl.CULL_FACE);}
function drawTerrain(mode,karstStrength,fieldStrength,eye){const gl=state.gl;gl.useProgram(state.programs.terrain);gl.uniformMatrix4fv(state.uniforms.terrain.viewProjection,false,state.viewProjection);gl.uniform1f(state.uniforms.terrain.karst,karstStrength);gl.uniform1f(state.uniforms.terrain.field,fieldStrength);gl.uniform1i(state.uniforms.terrain.mode,mode);gl.uniform1f(state.uniforms.terrain.minimum,state.minimum);gl.uniform1f(state.uniforms.terrain.maximum,state.maximum);gl.uniform1f(state.uniforms.terrain.detail,state.detailStrength);gl.uniform1f(state.uniforms.terrain.color,state.colorStrength);gl.uniform3f(state.uniforms.terrain.eye,eye[0],eye[1],eye[2]);gl.bindVertexArray(state.terrain.vao);gl.drawElements(gl.TRIANGLES,state.terrain.indexCount,gl.UNSIGNED_INT,0);gl.bindVertexArray(null);}
function drawWater(eye,now){if(!state.showWater||!state.water||state.water.indexCount===0)return;const gl=state.gl;gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.disable(gl.CULL_FACE);gl.useProgram(state.programs.water);gl.uniformMatrix4fv(state.uniforms.water.viewProjection,false,state.viewProjection);gl.uniform3f(state.uniforms.water.eye,eye[0],eye[1],eye[2]);gl.uniform1f(state.uniforms.water.time,now*.001);gl.bindVertexArray(state.water.vao);gl.drawElements(gl.TRIANGLES,state.water.indexCount,gl.UNSIGNED_INT,0);gl.bindVertexArray(null);gl.enable(gl.CULL_FACE);gl.depthMask(true);gl.disable(gl.BLEND);}
function drawViewport(x,width,mode,karstStrength,fieldStrength,now){const gl=state.gl;gl.viewport(x,0,width,canvas.height);gl.scissor(x,0,width,canvas.height);const eye=updateMatrices(width,canvas.height);drawSkirt();drawTerrain(mode,karstStrength,fieldStrength,eye);drawWater(eye,now);}
function render(now=performance.now()){if(!state.ready||!state.gl)return;resizeCanvas();const gl=state.gl;gl.enable(gl.SCISSOR_TEST);gl.scissor(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const karst=state.showKarst?state.karstStrength:0,field=state.showField?1:0;if(state.mode===6){const left=Math.floor(canvas.width/2);drawViewport(0,left,1,0,0,now);gl.clear(gl.DEPTH_BUFFER_BIT);drawViewport(left,canvas.width-left,0,karst,field,now);}else{const mode=state.mode;drawViewport(0,canvas.width,mode,mode===1?0:karst,mode===1||mode===2?0:field,now);}gl.disable(gl.SCISSOR_TEST);if(state.lastFrameAt){state.frameSamples.push(now-state.lastFrameAt);if(state.frameSamples.length>120)state.frameSamples.shift();}state.lastFrameAt=now;state.dirty=false;updateStatus();updateQa();}
function loop(now){if(state.dirty||state.showWater)render(now);requestAnimationFrame(loop);}
function paddyCentroid(){let sx=0,sz=0,w=0;for(let row=0;row<RENDER_GRID;row+=4)for(let column=0;column<RENDER_GRID;column+=4){const index=row*RENDER_GRID+column,value=state.fields.paddy[index];if(value>.18){sx+=(column*RENDER_SPACING-SIDE_M*.5)*value;sz+=(row*RENDER_SPACING-SIDE_M*.5)*value;w+=value;}}return w?[sx/w,sz/w]:[0,0];}
function highestPeak(){if(!state.peaks.length)return{x:0,z:0,h:state.maximum};return state.peaks.reduce((a,b)=>b.h+b.amplitude>a.h+a.amplitude?b:a);}
function setView(name){const relief=state.maximum-state.minimum;if(name==='top'){state.camera.target=[0,relief*.20,0];state.camera.yaw=-.05;state.camera.pitch=1.485;state.camera.distance=1320;}else if(name==='karst'){const peak=highestPeak();state.camera.target=[peak.x,peak.h-state.minimum+peak.amplitude*.55,peak.z];state.camera.yaw=-1.02;state.camera.pitch=.30;state.camera.distance=430;}else if(name==='field'){const c=paddyCentroid();state.camera.target=[c[0],16,c[1]];state.camera.yaw=-.72;state.camera.pitch=.24;state.camera.distance=330;}else{state.camera.target=[0,relief*.24,0];state.camera.yaw=-.78;state.camera.pitch=.52;state.camera.distance=1380;}state.dirty=true;}
function screenRay(clientX,clientY){resizeCanvas();updateMatrices();const rect=canvas.getBoundingClientRect(),x=((clientX-rect.left)/rect.width)*2-1,y=1-((clientY-rect.top)/rect.height)*2,near=transformVec4(state.inverseViewProjection,[x,y,-1,1]),far=transformVec4(state.inverseViewProjection,[x,y,1,1]);if(Math.abs(near[3])<1e-9||Math.abs(far[3])<1e-9)return null;const origin=[near[0]/near[3],near[1]/near[3],near[2]/near[3]],end=[far[0]/far[3],far[1]/far[3],far[2]/far[3]],direction=[end[0]-origin[0],end[1]-origin[1],end[2]-origin[2]],len=Math.hypot(...direction)||1;return{origin,direction:direction.map(v=>v/len)};}
function focusAt(clientX,clientY){const ray=screenRay(clientX,clientY);if(!ray||Math.abs(ray.direction[1])<1e-6)return;const t=(state.camera.target[1]-ray.origin[1])/ray.direction[1];if(t<=0)return;state.camera.target[0]=clamp(ray.origin[0]+ray.direction[0]*t,-500,500);state.camera.target[2]=clamp(ray.origin[2]+ray.direction[2]*t,-500,500);state.camera.distance=clamp(state.camera.distance*.55,state.camera.minDistance,state.camera.maxDistance);state.dirty=true;}
/* v0.2.1 visual convergence. All overrides stay inside the actual WebGL2 runtime. */
setupWebGL=function(){
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  assert(gl,'当前浏览器未提供 WebGL2');
  state.gl=gl;
  state.programs={
    terrain:createProgram(gl,TERRAIN_VS,TERRAIN_FS_V21),
    water:createProgram(gl,WATER_VS,WATER_FS),
    skirt:createProgram(gl,SKIRT_VS,SKIRT_FS)
  };
  state.uniforms={
    terrain:{
      viewProjection:gl.getUniformLocation(state.programs.terrain,'uViewProjection'),
      karst:gl.getUniformLocation(state.programs.terrain,'uKarstStrength'),
      field:gl.getUniformLocation(state.programs.terrain,'uFieldStrength'),
      mode:gl.getUniformLocation(state.programs.terrain,'uMode'),
      minimum:gl.getUniformLocation(state.programs.terrain,'uMinElevation'),
      maximum:gl.getUniformLocation(state.programs.terrain,'uMaxElevation'),
      detail:gl.getUniformLocation(state.programs.terrain,'uDetailStrength'),
      color:gl.getUniformLocation(state.programs.terrain,'uColorStrength'),
      eye:gl.getUniformLocation(state.programs.terrain,'uEye')
    },
    water:{
      viewProjection:gl.getUniformLocation(state.programs.water,'uViewProjection'),
      eye:gl.getUniformLocation(state.programs.water,'uEye'),
      time:gl.getUniformLocation(state.programs.water,'uTime')
    },
    skirt:{viewProjection:gl.getUniformLocation(state.programs.skirt,'uViewProjection')}
  };
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.frontFace(gl.CCW);gl.clearColor(.018,.032,.028,1);
};

const deriveTerrainFieldsV20=deriveTerrainFields;
deriveTerrainFields=function(dense,segments){
  const fields=deriveTerrainFieldsV20(dense,segments);
  const broad=boxBlur(dense,RENDER_GRID,RENDER_GRID,34);
  const medium=boxBlur(dense,RENDER_GRID,RENDER_GRID,13);
  const elevationRange=Math.max(1,state.maximum-state.minimum);
  const ordered=state.peaks.slice().sort((a,b)=>{
    const scoreA=a.score-Math.hypot(a.x,a.z)*.035;
    const scoreB=b.score-Math.hypot(b.x,b.z)*.035;
    return scoreB-scoreA;
  });
  const central=ordered.filter(peak=>Math.abs(peak.x)<430&&Math.abs(peak.z)<430);
  state.peaks=(central.length>=6?central:ordered).slice(0,8);
  let karstMinimum=Infinity,karstMaximum=-Infinity,fieldMinimum=Infinity,fieldMaximum=-Infinity;

  for(let row=0;row<RENDER_GRID;row++){
    for(let column=0;column<RENDER_GRID;column++){
      const index=row*RENDER_GRID+column;
      const truth=dense[index];
      const x=column*RENDER_SPACING-SIDE_M*.5;
      const z=row*RENDER_SPACING-SIDE_M*.5;
      const easting=CENTER_E+x;
      const northing=CENTER_N-z;
      const relief=truth-broad[index];
      const mediumRelief=truth-medium[index];
      const slopeNorm=fields.slope[index];
      const slopeDegrees=slopeNorm*62;
      let strongest=-Infinity;
      let second=-Infinity;
      let towerInfluence=0;
      let wallInfluence=0;
      let footInfluence=0;

      for(const peak of state.peaks){
        const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle);
        const dx=x-peak.x,dz=z-peak.z;
        const rx=(dx*ca+dz*sa)/peak.ellipse;
        const rz=(-dx*sa+dz*ca)*peak.ellipse;
        const theta=Math.atan2(rz,rx);
        const worldWarp=fbm2((easting+peak.phase*239)*.0052,(northing-peak.phase*313)*.0052,SEEDS.shape+Math.round(peak.phase*15000),3);
        const angularRadius=clamp(1+.17*Math.sin(theta*3+peak.phase*11)+.10*Math.sin(theta*5-peak.phase*17)+worldWarp*.13,.69,1.34);
        const radius=peak.radius*(.86+.14*peak.phase);
        const r=Math.hypot(rx,rz)/(radius*angularRadius);
        const body=Math.pow(Math.max(0,1-smoothstep(.24,1.0,r)),.30);
        const crown=Math.pow(Math.max(0,1-r/.30),.58);
        const crownNotch=Math.pow(Math.abs(Math.sin(theta*3+peak.phase*19)),7)*crown;
        const offsetA=Math.hypot(rx-radius*.10*Math.cos(peak.phase*23),rz-radius*.10*Math.sin(peak.phase*23))/radius;
        const offsetB=Math.hypot(rx+radius*.12*Math.cos(peak.phase*31),rz+radius*.12*Math.sin(peak.phase*31))/radius;
        const spireA=Math.pow(Math.max(0,1-offsetA/.24),.72);
        const spireB=Math.pow(Math.max(0,1-offsetB/.21),.76);
        const shoulderCut=Math.exp(-Math.pow((r-.58)/.15,2));
        const footCut=Math.exp(-Math.pow((r-.88)/.105,2));
        const grooves=Math.pow(Math.abs(Math.sin(theta*6+peak.phase*29+worldWarp*4.2)),8)*body;
        const realGate=smoothstep(2.5,18,relief+body*18);
        const amplitude=clamp(peak.amplitude*1.16,24,58);
        const local=realGate*(amplitude*(body*.66+crown*.28+spireA*.12+spireB*.09-crownNotch*.10-shoulderCut*.16-footCut*.22)-grooves*(2.2+amplitude*.055));
        if(local>strongest){second=strongest;strongest=local;}else if(local>second){second=local;}
        towerInfluence=Math.max(towerInfluence,body);
        wallInfluence=Math.max(wallInfluence,smoothstep(.27,.48,r)*(1-smoothstep(.76,1.03,r))*body*2.5);
        footInfluence=Math.max(footInfluence,smoothstep(.70,.82,r)*(1-smoothstep(.96,1.15,r)));
      }

      const realHill=smoothstep(5,25,relief);
      const profileCut=-9.5*Math.pow(Math.sin(clamp((relief+2)/Math.max(22,Math.abs(relief)+27),0,1)*Math.PI),2)*realHill*smoothstep(.08,.54,slopeNorm);
      const wallGroove=(ridged2(easting*.031,northing*.031,SEEDS.weather+71,4)-.54)*5.2*wallInfluence;
      const karstValue=clamp(Math.max(0,strongest)+Math.max(0,second)*.15+profileCut+wallGroove,-16,58);
      const karstLikelihood=clamp(Math.max(towerInfluence,smoothstep(6,27,relief)*smoothstep(.06,.60,slopeNorm)),0,1);
      const cliffValue=clamp(smoothstep(.25,.66,slopeNorm)*(.35+.65*karstLikelihood)+wallInfluence*.76+smoothstep(8,30,mediumRelief)*.16,0,1);
      const talusValue=clamp(footInfluence*smoothstep(.07,.45,slopeNorm)*(1-cliffValue*.50),0,1);

      const waterDistance=nearestWaterDistance(x,z,segments);
      const waterCore=1-smoothstep(6,25,waterDistance);
      const waterInfluence=Math.exp(-waterDistance/104);
      const elev=(truth-state.minimum)/elevationRange;
      const lowland=1-smoothstep(.10,.63,elev);
      const flat=1-smoothstep(3.5,15.5,slopeDegrees);
      const concavity=smoothstep(-.05,.55,-fields.curvature[index]);
      const wetness=clamp(waterInfluence*.62+lowland*.20+concavity*.18+smoothstep(.43,.82,fbm2(easting*.0031,northing*.0031,SEEDS.water+7,4))*.09,0,1);
      const parcel=parcelGrammar(easting,northing);
      const patch=fbm2(easting*.0025,northing*.0025,SEEDS.field+401,4)*.5+.5;
      const paddyBase=lowland*flat*(.54+.46*wetness)*(.72+.28*patch)*(1-waterCore*.94)*(1-cliffValue*.93)*(1-talusValue*.58);
      const paddyValue=Math.pow(clamp(paddyBase,0,1),.58);
      const bundValue=paddyValue*Math.pow(parcel.boundary,.70);
      const channelValue=paddyValue*parcel.channel*(1-parcel.boundary*.38);
      const terraceStep=.24+parcel.fieldSeed*.13;
      const terraceTarget=Math.round(truth/terraceStep)*terraceStep;
      const flatten=clamp((terraceTarget-truth)*.42,-.14,.14);
      const fieldValue=clamp(paddyValue*flatten+bundValue*(.34+parcel.fieldSeed*.20)-channelValue*(.22+parcel.fieldSeed*.15),-.38,.58);
      const rockValue=clamp(cliffValue*.83+karstLikelihood*.34+talusValue*.20,0,1);
      const flowValue=clamp(waterInfluence*.52+wetness*.29+channelValue*.58,0,1);

      fields.karst[index]=karstLikelihood;
      fields.cliff[index]=cliffValue;
      fields.talus[index]=talusValue;
      fields.rock[index]=rockValue;
      fields.paddy[index]=paddyValue;
      fields.wet[index]=wetness;
      fields.bund[index]=bundValue;
      fields.channel[index]=channelValue;
      fields.karstDelta[index]=karstValue;
      fields.fieldDelta[index]=fieldValue;
      fields.unitSeed[index]=parcel.fieldSeed;
      fields.flow[index]=flowValue;
      fields.terrace[index]=paddyValue*flat;
      fields.enhanced[index]=truth+karstValue+fieldValue;
      karstMinimum=Math.min(karstMinimum,karstValue);
      karstMaximum=Math.max(karstMaximum,karstValue);
      fieldMinimum=Math.min(fieldMinimum,fieldValue);
      fieldMaximum=Math.max(fieldMaximum,fieldValue);
    }
  }
  fields.enhancedNormals=buildNormalArray(fields.enhanced);
  state.karstRange=[karstMinimum,karstMaximum];
  state.fieldRange=[fieldMinimum,fieldMaximum];
  return fields;
};

buildWaterMesh=function(){
  const gl=state.gl,vertices=[],indices=[];
  const add=(x,y,z,c)=>{vertices.push(x,y,z,c);return vertices.length/4-1;};
  for(const segment of state.segments){
    const dx=segment.x1-segment.x0,dz=segment.z1-segment.z0,length=Math.hypot(dx,dz);
    if(length<.5)continue;
    if(length<7&&segment.sourceWidth>length*1.45)continue;
    const nx=-dz/length,nz=dx/length;
    const base=segment.classValue===0?5.5:(segment.classValue===1?2.2:1.35);
    const requestedHalf=Math.max(base,segment.sourceWidth*.50);
    const lengthSafeHalf=Math.max(base,length*.38);
    const halfWidth=clamp(Math.min(requestedHalf,lengthSafeHalf),base,28);
    const y0=segment.y0-state.minimum+.42,y1=segment.y1-state.minimum+.42;
    const a=add(segment.x0+nx*halfWidth,y0,segment.z0+nz*halfWidth,segment.classValue);
    const b=add(segment.x0-nx*halfWidth,y0,segment.z0-nz*halfWidth,segment.classValue);
    const c=add(segment.x1+nx*halfWidth,y1,segment.z1+nz*halfWidth,segment.classValue);
    const d=add(segment.x1-nx*halfWidth,y1,segment.z1-nz*halfWidth,segment.classValue);
    indices.push(a,b,c,c,b,d);
  }
  const vao=gl.createVertexArray(),vertexBuffer=gl.createBuffer(),indexBuffer=gl.createBuffer();
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,16,0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,1,gl.FLOAT,false,16,12);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  state.water={vao,vertexBuffer,indexBuffer,indexCount:indices.length};
};

highestPeak=function(){
  const candidates=state.peaks.filter(peak=>Math.abs(peak.x)<350&&Math.abs(peak.z)<350);
  const pool=candidates.length?candidates:state.peaks;
  if(!pool.length)return{x:0,z:0,h:state.maximum,amplitude:0};
  return pool.reduce((best,peak)=>{
    const score=peak.h+peak.amplitude-Math.hypot(peak.x,peak.z)*.075;
    const bestScore=best.h+best.amplitude-Math.hypot(best.x,best.z)*.075;
    return score>bestScore?peak:best;
  });
};

const drawSkirtV20=drawSkirt;
drawSkirt=function(){if(state.camera.distance<760)return;drawSkirtV20();};

setView=function(name){
  const relief=state.maximum-state.minimum;
  if(name==='top'){
    state.camera.target=[0,relief*.18,0];state.camera.yaw=-.05;state.camera.pitch=1.485;state.camera.distance=1320;
  }else if(name==='karst'){
    const peak=highestPeak();
    const localHeight=denseTruthAtWorld(peak.x,peak.z)-state.minimum;
    state.camera.target=[peak.x,localHeight+peak.amplitude*.48,peak.z];state.camera.yaw=-1.00;state.camera.pitch=.37;state.camera.distance=520;
  }else if(name==='field'){
    const c=paddyCentroid();
    const localHeight=denseTruthAtWorld(c[0],c[1])-state.minimum;
    state.camera.target=[c[0],localHeight+8,c[1]];state.camera.yaw=-.78;state.camera.pitch=.48;state.camera.distance=500;
  }else{
    state.camera.target=[0,relief*.24,0];state.camera.yaw=-.78;state.camera.pitch=.55;state.camera.distance=1450;
  }
  state.dirty=true;
};

loop=function(now){if(state.dirty)render(now);requestAnimationFrame(loop);};
/* v0.2.2 field readability, water ribbon safety and close-view convergence. */
const TERRAIN_FS_V22=TERRAIN_FS_V21
  .replace("+(micro-.48)*.12+bund*.18-channel*.16","+(micro-.48)*.035+bund*.22-channel*.18")
  .replace("+micro*.07","+micro*.025")
  .replace("color=mix(color,vec3(.13,.085,.038),bund*.72)","color=mix(color,vec3(.115,.070,.028),bund*.86)");

setupWebGL=function(){
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  assert(gl,'当前浏览器未提供 WebGL2');
  state.gl=gl;
  state.programs={terrain:createProgram(gl,TERRAIN_VS,TERRAIN_FS_V22),water:createProgram(gl,WATER_VS,WATER_FS),skirt:createProgram(gl,SKIRT_VS,SKIRT_FS)};
  state.uniforms={
    terrain:{viewProjection:gl.getUniformLocation(state.programs.terrain,'uViewProjection'),karst:gl.getUniformLocation(state.programs.terrain,'uKarstStrength'),field:gl.getUniformLocation(state.programs.terrain,'uFieldStrength'),mode:gl.getUniformLocation(state.programs.terrain,'uMode'),minimum:gl.getUniformLocation(state.programs.terrain,'uMinElevation'),maximum:gl.getUniformLocation(state.programs.terrain,'uMaxElevation'),detail:gl.getUniformLocation(state.programs.terrain,'uDetailStrength'),color:gl.getUniformLocation(state.programs.terrain,'uColorStrength'),eye:gl.getUniformLocation(state.programs.terrain,'uEye')},
    water:{viewProjection:gl.getUniformLocation(state.programs.water,'uViewProjection'),eye:gl.getUniformLocation(state.programs.water,'uEye'),time:gl.getUniformLocation(state.programs.water,'uTime')},
    skirt:{viewProjection:gl.getUniformLocation(state.programs.skirt,'uViewProjection')}
  };
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.frontFace(gl.CCW);gl.clearColor(.018,.032,.028,1);
};

parcelGrammar=function(easting,northing){
  const warpX=fbm2(easting*.0019,northing*.0019,SEEDS.field+31,4)*27;
  const warpZ=fbm2(easting*.0019+7.4,northing*.0019-5.1,SEEDS.field+73,4)*27;
  const angle=.29+fbm2(easting*.00062,northing*.00062,SEEDS.field+91,3)*.20;
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const rx=(easting+warpX)*ca+(northing+warpZ)*sa;
  const rz=-(easting+warpX)*sa+(northing+warpZ)*ca;
  const cellX=88,cellZ=66,gx=Math.floor(rx/cellX),gz=Math.floor(rz/cellZ);
  let first=Infinity,second=Infinity,nearestX=gx,nearestZ=gz;
  for(let oz=-1;oz<=1;oz++)for(let ox=-1;ox<=1;ox++){
    const cx=gx+ox,cz=gz+oz;
    const px=(cx+.13+hash2(cx,cz,SEEDS.field+149)*.74)*cellX;
    const pz=(cz+.13+hash2(cx,cz,SEEDS.field+193)*.74)*cellZ;
    const distance=Math.hypot(rx-px,rz-pz);
    if(distance<first){second=first;first=distance;nearestX=cx;nearestZ=cz;}else if(distance<second)second=distance;
  }
  const boundary=1-smoothstep(1.1,6.2,second-first);
  const fieldSeed=hash2(nearestX,nearestZ,SEEDS.field+277);
  const lineA=Math.abs(Math.sin((rx+fieldSeed*117)*.055));
  const lineB=Math.abs(Math.sin((rz-fieldSeed*89)*.069));
  const rowA=1-smoothstep(.00,.075,lineA);
  const rowB=1-smoothstep(.00,.064,lineB);
  const channel=Math.max(rowA,rowB*.62);
  return{boundary,fieldSeed,channel};
};

const deriveTerrainFieldsV21=deriveTerrainFields;
deriveTerrainFields=function(dense,segments){
  const fields=deriveTerrainFieldsV21(dense,segments);
  const elevationRange=Math.max(1,state.maximum-state.minimum);
  let fieldMinimum=Infinity,fieldMaximum=-Infinity,paddySum=0,bundSum=0,channelSum=0;
  for(let row=0;row<RENDER_GRID;row++){
    for(let column=0;column<RENDER_GRID;column++){
      const index=row*RENDER_GRID+column;
      const truth=dense[index];
      const x=column*RENDER_SPACING-SIDE_M*.5,z=row*RENDER_SPACING-SIDE_M*.5;
      const easting=CENTER_E+x,northing=CENTER_N-z;
      const slopeDegrees=fields.slope[index]*62;
      const elev=(truth-state.minimum)/elevationRange;
      const lowland=1-smoothstep(.10,.61,elev);
      const flat=1-smoothstep(3.2,14.8,slopeDegrees);
      const waterDistance=nearestWaterDistance(x,z,segments);
      const waterCore=1-smoothstep(7,26,waterDistance);
      const patch=fbm2(easting*.0022,northing*.0022,SEEDS.field+401,4)*.5+.5;
      const patchGate=.42+.58*smoothstep(.20,.78,patch);
      const base=lowland*flat*(.48+.52*fields.wet[index])*patchGate*(1-waterCore*.94)*(1-fields.cliff[index]*.94)*(1-fields.talus[index]*.56);
      const paddyValue=smoothstep(.13,.58,base);
      const parcel=parcelGrammar(easting,northing);
      const bundValue=paddyValue*Math.pow(parcel.boundary,.58);
      const channelValue=paddyValue*parcel.channel*(1-parcel.boundary*.50);
      const terraceStep=.25+parcel.fieldSeed*.14;
      const terraceTarget=Math.round(truth/terraceStep)*terraceStep;
      const flatten=clamp((terraceTarget-truth)*.43,-.14,.14);
      const fieldValue=clamp(paddyValue*flatten+bundValue*(.38+parcel.fieldSeed*.21)-channelValue*(.25+parcel.fieldSeed*.15),-.40,.62);
      fields.paddy[index]=paddyValue;
      fields.bund[index]=bundValue;
      fields.channel[index]=channelValue;
      fields.fieldDelta[index]=fieldValue;
      fields.unitSeed[index]=parcel.fieldSeed;
      fields.flow[index]=clamp(fields.flow[index]+channelValue*.52,0,1);
      fields.terrace[index]=paddyValue*flat;
      fields.enhanced[index]=truth+fields.karstDelta[index]+fieldValue;
      fieldMinimum=Math.min(fieldMinimum,fieldValue);fieldMaximum=Math.max(fieldMaximum,fieldValue);
      paddySum+=paddyValue;bundSum+=bundValue;channelSum+=channelValue;
    }
  }
  fields.enhancedNormals=buildNormalArray(fields.enhanced);
  state.fieldRange=[fieldMinimum,fieldMaximum];
  state.fieldStats={paddyFraction:paddySum/fields.paddy.length,bundMean:bundSum/fields.bund.length,channelMean:channelSum/fields.channel.length};
  return fields;
};

buildWaterMesh=function(){
  const gl=state.gl,vertices=[],indices=[];
  const add=(x,y,z,c)=>{vertices.push(x,y,z,c);return vertices.length/4-1;};
  for(const segment of state.segments){
    const dx=segment.x1-segment.x0,dz=segment.z1-segment.z0,length=Math.hypot(dx,dz);
    if(length<3.5)continue;
    const nx=-dz/length,nz=dx/length;
    const base=segment.classValue===0?5.2:(segment.classValue===1?2.0:1.2);
    const requestedHalf=Math.max(base*.65,segment.sourceWidth*.50);
    const halfWidth=clamp(Math.min(requestedHalf,length*.18,26),.65,26);
    if(length<18&&halfWidth>length*.22)continue;
    const y0=segment.y0-state.minimum+.38,y1=segment.y1-state.minimum+.38;
    const a=add(segment.x0+nx*halfWidth,y0,segment.z0+nz*halfWidth,segment.classValue);
    const b=add(segment.x0-nx*halfWidth,y0,segment.z0-nz*halfWidth,segment.classValue);
    const c=add(segment.x1+nx*halfWidth,y1,segment.z1+nz*halfWidth,segment.classValue);
    const d=add(segment.x1-nx*halfWidth,y1,segment.z1-nz*halfWidth,segment.classValue);
    indices.push(a,b,c,c,b,d);
  }
  const vao=gl.createVertexArray(),vertexBuffer=gl.createBuffer(),indexBuffer=gl.createBuffer();
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,16,0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,1,gl.FLOAT,false,16,12);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  state.water={vao,vertexBuffer,indexBuffer,indexCount:indices.length};
};

function bestFieldPoint(){
  let best={score:-Infinity,x:0,z:0};
  for(let row=8;row<RENDER_GRID-8;row+=3){
    for(let column=8;column<RENDER_GRID-8;column+=3){
      const index=row*RENDER_GRID+column;
      const x=column*RENDER_SPACING-SIDE_M*.5,z=row*RENDER_SPACING-SIDE_M*.5;
      const waterDistance=nearestWaterDistance(x,z,state.segments);
      const desiredWater=1-Math.min(1,Math.abs(waterDistance-82)/110);
      const centerPenalty=Math.hypot(x,z)/900;
      const score=state.fields.paddy[index]*1.30+state.fields.bund[index]*.28+desiredWater*.22-state.fields.channel[index]*.25-centerPenalty*.14;
      if(score>best.score)best={score,x,z};
    }
  }
  return[best.x,best.z];
}

setView=function(name){
  const relief=state.maximum-state.minimum;
  if(name==='top'){
    state.camera.target=[0,relief*.18,0];state.camera.yaw=-.05;state.camera.pitch=1.485;state.camera.distance=1320;
  }else if(name==='karst'){
    const peak=highestPeak();const localHeight=denseTruthAtWorld(peak.x,peak.z)-state.minimum;
    state.camera.target=[peak.x,localHeight+peak.amplitude*.46,peak.z];state.camera.yaw=-1.00;state.camera.pitch=.38;state.camera.distance=540;
  }else if(name==='field'){
    const c=bestFieldPoint();const localHeight=denseTruthAtWorld(c[0],c[1])-state.minimum;
    state.camera.target=[c[0],localHeight+4.5,c[1]];state.camera.yaw=-.70;state.camera.pitch=.55;state.camera.distance=430;
  }else{
    state.camera.target=[0,relief*.24,0];state.camera.yaw=-.78;state.camera.pitch=.55;state.camera.distance=1450;
  }
  state.dirty=true;
};
/* v0.2.3 coherent parcel-scale geometry and short-segment water cleanup. */
parcelGrammar=function(easting,northing){
  const warpX=fbm2(easting*.00155,northing*.00155,SEEDS.field+31,4)*34;
  const warpZ=fbm2(easting*.00155+7.4,northing*.00155-5.1,SEEDS.field+73,4)*34;
  const angle=.27+fbm2(easting*.00052,northing*.00052,SEEDS.field+91,3)*.19;
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const rx=(easting+warpX)*ca+(northing+warpZ)*sa;
  const rz=-(easting+warpX)*sa+(northing+warpZ)*ca;
  const cellX=120,cellZ=92,gx=Math.floor(rx/cellX),gz=Math.floor(rz/cellZ);
  let first=Infinity,second=Infinity,nearestX=gx,nearestZ=gz;
  for(let oz=-1;oz<=1;oz++)for(let ox=-1;ox<=1;ox++){
    const cx=gx+ox,cz=gz+oz;
    const px=(cx+.12+hash2(cx,cz,SEEDS.field+149)*.76)*cellX;
    const pz=(cz+.12+hash2(cx,cz,SEEDS.field+193)*.76)*cellZ;
    const distance=Math.hypot(rx-px,rz-pz);
    if(distance<first){second=first;first=distance;nearestX=cx;nearestZ=cz;}else if(distance<second)second=distance;
  }
  const boundary=1-smoothstep(1.8,13.0,second-first);
  const fieldSeed=hash2(nearestX,nearestZ,SEEDS.field+277);
  const lineA=Math.abs(Math.sin((rx+fieldSeed*141)*.039));
  const lineB=Math.abs(Math.sin((rz-fieldSeed*103)*.051));
  const rowA=1-smoothstep(.00,.28,lineA);
  const rowB=1-smoothstep(.00,.23,lineB);
  const channel=Math.max(rowA,rowB*.58);
  return{boundary,fieldSeed,channel};
};

const deriveTerrainFieldsV22=deriveTerrainFields;
deriveTerrainFields=function(dense,segments){
  const fields=deriveTerrainFieldsV22(dense,segments);
  const elevationRange=Math.max(1,state.maximum-state.minimum);
  let fieldMinimum=Infinity,fieldMaximum=-Infinity,paddySum=0,bundSum=0,channelSum=0;
  for(let row=0;row<RENDER_GRID;row++){
    for(let column=0;column<RENDER_GRID;column++){
      const index=row*RENDER_GRID+column;
      const truth=dense[index];
      const x=column*RENDER_SPACING-SIDE_M*.5,z=row*RENDER_SPACING-SIDE_M*.5;
      const easting=CENTER_E+x,northing=CENTER_N-z;
      const slopeDegrees=fields.slope[index]*62;
      const elev=(truth-state.minimum)/elevationRange;
      const lowland=1-smoothstep(.09,.64,elev);
      const flat=1-smoothstep(3.0,15.8,slopeDegrees);
      const waterDistance=nearestWaterDistance(x,z,segments);
      const waterCore=1-smoothstep(7,27,waterDistance);
      const patch=fbm2(easting*.00185,northing*.00185,SEEDS.field+401,4)*.5+.5;
      const patchGate=.58+.42*smoothstep(.18,.80,patch);
      const base=lowland*flat*(.46+.54*fields.wet[index])*patchGate*(1-waterCore*.95)*(1-fields.cliff[index]*.95)*(1-fields.talus[index]*.55);
      const paddyValue=smoothstep(.065,.47,base);
      const parcel=parcelGrammar(easting,northing);
      const bundValue=paddyValue*Math.pow(parcel.boundary,.48);
      const channelValue=paddyValue*parcel.channel*(1-parcel.boundary*.56);
      const terraceStep=.25+parcel.fieldSeed*.15;
      const terraceTarget=Math.round(truth/terraceStep)*terraceStep;
      const flatten=clamp((terraceTarget-truth)*.45,-.15,.15);
      const fieldValue=clamp(paddyValue*flatten+bundValue*(.42+parcel.fieldSeed*.22)-channelValue*(.27+parcel.fieldSeed*.16),-.43,.68);
      fields.paddy[index]=paddyValue;
      fields.bund[index]=bundValue;
      fields.channel[index]=channelValue;
      fields.fieldDelta[index]=fieldValue;
      fields.unitSeed[index]=parcel.fieldSeed;
      fields.flow[index]=clamp(fields.flow[index]+channelValue*.44,0,1);
      fields.terrace[index]=paddyValue*flat;
      fields.enhanced[index]=truth+fields.karstDelta[index]+fieldValue;
      fieldMinimum=Math.min(fieldMinimum,fieldValue);fieldMaximum=Math.max(fieldMaximum,fieldValue);
      paddySum+=paddyValue;bundSum+=bundValue;channelSum+=channelValue;
    }
  }
  fields.enhancedNormals=buildNormalArray(fields.enhanced);
  state.fieldRange=[fieldMinimum,fieldMaximum];
  state.fieldStats={paddyFraction:paddySum/fields.paddy.length,bundMean:bundSum/fields.bund.length,channelMean:channelSum/fields.channel.length};
  return fields;
};

buildWaterMesh=function(){
  const gl=state.gl,vertices=[],indices=[];
  const add=(x,y,z,c)=>{vertices.push(x,y,z,c);return vertices.length/4-1;};
  for(const segment of state.segments){
    const dx=segment.x1-segment.x0,dz=segment.z1-segment.z0,length=Math.hypot(dx,dz);
    if(length<3.5)continue;
    const nx=-dz/length,nz=dx/length;
    const base=segment.classValue===0?5.0:(segment.classValue===1?1.9:1.1);
    const requestedHalf=Math.max(base*.60,segment.sourceWidth*.50);
    const shortSafe=length<58?Math.max(.65,length*.075):26;
    const halfWidth=clamp(Math.min(requestedHalf,shortSafe,26),.65,26);
    const y0=segment.y0-state.minimum+.36,y1=segment.y1-state.minimum+.36;
    const a=add(segment.x0+nx*halfWidth,y0,segment.z0+nz*halfWidth,segment.classValue);
    const b=add(segment.x0-nx*halfWidth,y0,segment.z0-nz*halfWidth,segment.classValue);
    const c=add(segment.x1+nx*halfWidth,y1,segment.z1+nz*halfWidth,segment.classValue);
    const d=add(segment.x1-nx*halfWidth,y1,segment.z1-nz*halfWidth,segment.classValue);
    indices.push(a,b,c,c,b,d);
  }
  const vao=gl.createVertexArray(),vertexBuffer=gl.createBuffer(),indexBuffer=gl.createBuffer();
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,16,0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,1,gl.FLOAT,false,16,12);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  state.water={vao,vertexBuffer,indexBuffer,indexCount:indices.length};
};

function bestCentralFieldPoint(){
  let best={score:-Infinity,x:0,z:0};
  for(let row=12;row<RENDER_GRID-12;row+=3){
    for(let column=12;column<RENDER_GRID-12;column+=3){
      const x=column*RENDER_SPACING-SIDE_M*.5,z=row*RENDER_SPACING-SIDE_M*.5;
      if(Math.abs(x)>315||Math.abs(z)>315)continue;
      const index=row*RENDER_GRID+column;
      const waterDistance=nearestWaterDistance(x,z,state.segments);
      const desiredWater=1-Math.min(1,Math.abs(waterDistance-90)/120);
      const centerPenalty=Math.hypot(x,z)/700;
      const score=state.fields.paddy[index]*1.45+state.fields.bund[index]*.26+desiredWater*.18-state.fields.channel[index]*.18-centerPenalty*.18;
      if(score>best.score)best={score,x,z};
    }
  }
  return[best.x,best.z];
}

setView=function(name){
  const relief=state.maximum-state.minimum;
  if(name==='top'){
    state.camera.target=[0,relief*.18,0];state.camera.yaw=-.05;state.camera.pitch=1.485;state.camera.distance=1320;
  }else if(name==='karst'){
    const peak=highestPeak();const localHeight=denseTruthAtWorld(peak.x,peak.z)-state.minimum;
    state.camera.target=[peak.x,localHeight+peak.amplitude*.46,peak.z];state.camera.yaw=-1.00;state.camera.pitch=.40;state.camera.distance=565;
  }else if(name==='field'){
    const c=bestCentralFieldPoint();const localHeight=denseTruthAtWorld(c[0],c[1])-state.minimum;
    state.camera.target=[c[0],localHeight+7,c[1]];state.camera.yaw=-.72;state.camera.pitch=.64;state.camera.distance=600;
  }else{
    state.camera.target=[0,relief*.24,0];state.camera.yaw=-.78;state.camera.pitch=.55;state.camera.distance=1450;
  }
  state.dirty=true;
};
/* v0.2.4 stable warped parcel grammar and material hierarchy cleanup. */
const TERRAIN_FS_V23=TERRAIN_FS_V22
  .replace("+(micro-.48)*.035+bund*.22-channel*.18","+(micro-.48)*.018*(.18+.82*rock)+bund*.22-channel*.18")
  .replace("meso*.42+seed*.38+wet*.20","macro*.20+meso*.12+seed*.54+wet*.14");

setupWebGL=function(){
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  assert(gl,'当前浏览器未提供 WebGL2');
  state.gl=gl;
  state.programs={terrain:createProgram(gl,TERRAIN_VS,TERRAIN_FS_V23),water:createProgram(gl,WATER_VS,WATER_FS),skirt:createProgram(gl,SKIRT_VS,SKIRT_FS)};
  state.uniforms={
    terrain:{viewProjection:gl.getUniformLocation(state.programs.terrain,'uViewProjection'),karst:gl.getUniformLocation(state.programs.terrain,'uKarstStrength'),field:gl.getUniformLocation(state.programs.terrain,'uFieldStrength'),mode:gl.getUniformLocation(state.programs.terrain,'uMode'),minimum:gl.getUniformLocation(state.programs.terrain,'uMinElevation'),maximum:gl.getUniformLocation(state.programs.terrain,'uMaxElevation'),detail:gl.getUniformLocation(state.programs.terrain,'uDetailStrength'),color:gl.getUniformLocation(state.programs.terrain,'uColorStrength'),eye:gl.getUniformLocation(state.programs.terrain,'uEye')},
    water:{viewProjection:gl.getUniformLocation(state.programs.water,'uViewProjection'),eye:gl.getUniformLocation(state.programs.water,'uEye'),time:gl.getUniformLocation(state.programs.water,'uTime')},
    skirt:{viewProjection:gl.getUniformLocation(state.programs.skirt,'uViewProjection')}
  };
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.frontFace(gl.CCW);gl.clearColor(.018,.032,.028,1);
};

parcelGrammar=function(easting,northing){
  const warpX=fbm2(easting*.00145,northing*.00145,SEEDS.field+31,4)*39;
  const warpZ=fbm2(easting*.00145+7.4,northing*.00145-5.1,SEEDS.field+73,4)*39;
  const angle=.24+fbm2(easting*.00048,northing*.00048,SEEDS.field+91,3)*.18;
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const rx=(easting+warpX)*ca+(northing+warpZ)*sa;
  const rz=-(easting+warpX)*sa+(northing+warpZ)*ca;
  const cellX=126,cellZ=88;
  const gx=Math.floor(rx/cellX),gz=Math.floor(rz/cellZ);
  const fu=fract(rx/cellX),fv=fract(rz/cellZ);
  const edge=Math.min(fu,1-fu,fv,1-fv);
  const boundary=1-smoothstep(.018,.095,edge);
  const fieldSeed=hash2(gx,gz,SEEDS.field+277);
  const ditchWarp=fbm2(easting*.0036,northing*.0036,SEEDS.field+333,3)*10;
  const lineA=Math.abs(Math.sin((rx+ditchWarp+fieldSeed*83)*.018));
  const lineB=Math.abs(Math.sin((rz-ditchWarp-fieldSeed*61)*.022));
  const ditchA=1-smoothstep(.00,.115,lineA);
  const ditchB=1-smoothstep(.00,.095,lineB);
  const channel=fieldSeed>.67?Math.max(ditchA,ditchB*.62):ditchA;
  return{boundary,fieldSeed,channel};
};

const deriveTerrainFieldsV23=deriveTerrainFields;
deriveTerrainFields=function(dense,segments){
  const fields=deriveTerrainFieldsV23(dense,segments);
  let minimum=Infinity,maximum=-Infinity,paddySum=0,bundSum=0,channelSum=0;
  for(let row=0;row<RENDER_GRID;row++){
    for(let column=0;column<RENDER_GRID;column++){
      const index=row*RENDER_GRID+column;
      const truth=dense[index];
      const x=column*RENDER_SPACING-SIDE_M*.5,z=row*RENDER_SPACING-SIDE_M*.5;
      const easting=CENTER_E+x,northing=CENTER_N-z;
      const parcel=parcelGrammar(easting,northing);
      const paddy=fields.paddy[index];
      const bund=paddy*Math.pow(parcel.boundary,.62);
      const channel=paddy*parcel.channel*(1-parcel.boundary*.68);
      const terraceStep=.26+parcel.fieldSeed*.14;
      const target=Math.round(truth/terraceStep)*terraceStep;
      const flatten=clamp((target-truth)*.43,-.14,.14);
      const delta=clamp(paddy*flatten+bund*(.43+parcel.fieldSeed*.20)-channel*(.25+parcel.fieldSeed*.14),-.40,.66);
      fields.bund[index]=bund;
      fields.channel[index]=channel;
      fields.fieldDelta[index]=delta;
      fields.unitSeed[index]=parcel.fieldSeed;
      fields.flow[index]=clamp(fields.flow[index]+channel*.44,0,1);
      fields.enhanced[index]=truth+fields.karstDelta[index]+delta;
      minimum=Math.min(minimum,delta);maximum=Math.max(maximum,delta);
      paddySum+=paddy;bundSum+=bund;channelSum+=channel;
    }
  }
  fields.enhancedNormals=buildNormalArray(fields.enhanced);
  state.fieldRange=[minimum,maximum];
  state.fieldStats={paddyFraction:paddySum/fields.paddy.length,bundMean:bundSum/fields.bund.length,channelMean:channelSum/fields.channel.length};
  return fields;
};

const drawSkirtV24=drawSkirt;
drawSkirt=function(){if(state.mode===2&&state.camera.distance<760)return;drawSkirtV24();};
/* v0.2.5 floodplain parent mask, parcel identity and globally continuous irrigation lines. */
parcelGrammar=function(easting,northing){
  const warpX=fbm2(easting*.00135,northing*.00135,SEEDS.field+31,4)*42;
  const warpZ=fbm2(easting*.00135+7.4,northing*.00135-5.1,SEEDS.field+73,4)*42;
  const angle=.23+fbm2(easting*.00044,northing*.00044,SEEDS.field+91,3)*.16;
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const rx=(easting+warpX)*ca+(northing+warpZ)*sa;
  const rz=-(easting+warpX)*sa+(northing+warpZ)*ca;
  const cellX=132,cellZ=94;
  const gx=Math.floor(rx/cellX),gz=Math.floor(rz/cellZ);
  const fu=fract(rx/cellX),fv=fract(rz/cellZ);
  const edge=Math.min(fu,1-fu,fv,1-fv);
  const boundary=1-smoothstep(.016,.085,edge);
  const fieldSeed=hash2(gx,gz,SEEDS.field+277);
  const ditchWarp=fbm2(easting*.0027,northing*.0027,SEEDS.field+333,3)*13;
  const lineA=Math.abs(Math.sin((rx+ditchWarp)*.0122));
  const lineB=Math.abs(Math.sin((rz-ditchWarp)*.0155));
  const ditchA=1-smoothstep(.00,.145,lineA);
  const ditchB=1-smoothstep(.00,.120,lineB);
  const channel=Math.max(ditchA,ditchB*.58);
  return{boundary,fieldSeed,channel};
};

const deriveTerrainFieldsV24=deriveTerrainFields;
deriveTerrainFields=function(dense,segments){
  const fields=deriveTerrainFieldsV24(dense,segments);
  const elevationRange=Math.max(1,state.maximum-state.minimum);
  let minimum=Infinity,maximum=-Infinity,paddySum=0,bundSum=0,channelSum=0;
  for(let row=0;row<RENDER_GRID;row++){
    for(let column=0;column<RENDER_GRID;column++){
      const index=row*RENDER_GRID+column;
      const truth=dense[index];
      const x=column*RENDER_SPACING-SIDE_M*.5,z=row*RENDER_SPACING-SIDE_M*.5;
      const easting=CENTER_E+x,northing=CENTER_N-z;
      const slopeDegrees=fields.slope[index]*62;
      const elev=(truth-state.minimum)/elevationRange;
      const lowland=1-smoothstep(.085,.66,elev);
      const flat=1-smoothstep(3.2,15.5,slopeDegrees);
      const waterDistance=nearestWaterDistance(x,z,segments);
      const waterCore=1-smoothstep(8,28,waterDistance);
      const parentScore=lowland*flat*(.53+.47*fields.wet[index])*(1-waterCore*.96)*(1-fields.cliff[index]*.96)*(1-fields.talus[index]*.58);
      const parentMask=smoothstep(.075,.50,parentScore);
      const parcel=parcelGrammar(easting,northing);
      const parcelUse=smoothstep(.035,.17,parcel.fieldSeed);
      const paddy=parentMask*mix(.82,1.0,parcelUse);
      const bund=paddy*Math.pow(parcel.boundary,.58);
      const channel=paddy*parcel.channel*(1-parcel.boundary*.72);
      const terraceStep=.26+parcel.fieldSeed*.15;
      const target=Math.round(truth/terraceStep)*terraceStep;
      const flatten=clamp((target-truth)*.46,-.15,.15);
      const delta=clamp(paddy*flatten+bund*(.44+parcel.fieldSeed*.22)-channel*(.26+parcel.fieldSeed*.15),-.42,.69);
      fields.paddy[index]=paddy;
      fields.bund[index]=bund;
      fields.channel[index]=channel;
      fields.fieldDelta[index]=delta;
      fields.unitSeed[index]=parcel.fieldSeed;
      fields.flow[index]=clamp(fields.flow[index]+channel*.46,0,1);
      fields.terrace[index]=paddy*flat;
      fields.enhanced[index]=truth+fields.karstDelta[index]+delta;
      minimum=Math.min(minimum,delta);maximum=Math.max(maximum,delta);
      paddySum+=paddy;bundSum+=bund;channelSum+=channel;
    }
  }
  fields.enhancedNormals=buildNormalArray(fields.enhanced);
  state.fieldRange=[minimum,maximum];
  state.fieldStats={paddyFraction:paddySum/fields.paddy.length,bundMean:bundSum/fields.bund.length,channelMean:channelSum/fields.channel.length};
  return fields;
};

buildWaterMesh=function(){
  const gl=state.gl,vertices=[],indices=[];
  const add=(x,y,z,c)=>{vertices.push(x,y,z,c);return vertices.length/4-1;};
  for(const segment of state.segments){
    const dx=segment.x1-segment.x0,dz=segment.z1-segment.z0,length=Math.hypot(dx,dz);
    if(length<3.5)continue;
    if(length<60&&segment.sourceWidth>20)continue;
    const nx=-dz/length,nz=dx/length;
    const base=segment.classValue===0?4.8:(segment.classValue===1?1.8:1.0);
    const requestedHalf=Math.max(base*.60,segment.sourceWidth*.50);
    const shortSafe=length<58?Math.max(.60,length*.065):25;
    const halfWidth=clamp(Math.min(requestedHalf,shortSafe,25),.60,25);
    const y0=segment.y0-state.minimum+.34,y1=segment.y1-state.minimum+.34;
    const a=add(segment.x0+nx*halfWidth,y0,segment.z0+nz*halfWidth,segment.classValue);
    const b=add(segment.x0-nx*halfWidth,y0,segment.z0-nz*halfWidth,segment.classValue);
    const c=add(segment.x1+nx*halfWidth,y1,segment.z1+nz*halfWidth,segment.classValue);
    const d=add(segment.x1-nx*halfWidth,y1,segment.z1-nz*halfWidth,segment.classValue);
    indices.push(a,b,c,c,b,d);
  }
  const vao=gl.createVertexArray(),vertexBuffer=gl.createBuffer(),indexBuffer=gl.createBuffer();
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,16,0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,1,gl.FLOAT,false,16,12);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  state.water={vao,vertexBuffer,indexBuffer,indexCount:indices.length};
};
const MODE_NAMES=['母体合成','真实高程','喀斯特形体','地块与田埂','湿度与水系','岩壁与裂隙','原始 / 合成三维对照'];
const LEGENDS={0:[['#9a9d47','田块'],['#88714a','泥土'],['#aaa797','石灰岩'],['#2b8090','水系']],1:[['#29482d','低地'],['#6f7042','坡地'],['#aaa99b','高地']],2:[['#17221c','低响应'],['#dc9f2d','喀斯特'],['#f3dc79','正增量'],['#397cb2','切削区']],3:[['#1d2518','禁入'],['#a6ad3d','田面'],['#6f421c','田埂'],['#238395','沟渠']],4:[['#36271a','偏干'],['#35685e','湿润'],['#1f91a0','高湿'],['#216896','真实水系']],5:[['#1d2b1d','覆盖面'],['#73746d','裸岩'],['#332219','裂隙'],['#c1ad72','层理']],6:[['#69725b','左侧真值'],['#a0a34d','右侧母体'],['#2b8090','共享水系'] ]};
function updateLegend(){const root=$('legend');root.innerHTML='';for(const[color,label]of LEGENDS[state.mode])root.insertAdjacentHTML('beforeend',`<div><i style="background:${color}"></i>${label}</div>`);}
function updateStatus(){const maxDelta=Math.max(Math.abs(state.karstRange[0]),Math.abs(state.karstRange[1])),fps=averageFps();$('status').textContent=`${MODE_NAMES[state.mode]} · 真值 ${TRUTH_GRID}×${TRUTH_GRID} @ ${TRUTH_SPACING} m · 三维网格 ${RENDER_GRID}×${RENDER_GRID} @ ${RENDER_SPACING} m · 峰体 ${state.peaks.length} · 水系 ${state.segments.length} 段 · 喀斯特最大增量 ${maxDelta.toFixed(1)} m${fps?` · ${fps.toFixed(1)} FPS`:''}`;}
function averageFps(){if(state.frameSamples.length<8)return null;const average=state.frameSamples.reduce((a,b)=>a+b,0)/state.frameSamples.length;return average>0?1000/average:null;}
function setMode(mode){state.mode=clamp(Number(mode),0,6);document.querySelectorAll('[data-mode]').forEach(button=>button.classList.toggle('active',Number(button.dataset.mode)===state.mode));$('compareLabels').hidden=state.mode!==6;updateLegend();state.dirty=true;}
function setupUi(){$('modeGrid').addEventListener('click',event=>{const button=event.target.closest('[data-mode]');if(button)setMode(button.dataset.mode);});$('karstToggle').addEventListener('change',event=>{state.showKarst=event.target.checked;state.dirty=true;});$('fieldToggle').addEventListener('change',event=>{state.showField=event.target.checked;state.dirty=true;});$('waterToggle').addEventListener('change',event=>{state.showWater=event.target.checked;state.dirty=true;});for(const[id,key,out]of[['karstStrength','karstStrength','karstOut'],['detailStrength','detailStrength','detailOut'],['colorStrength','colorStrength','colorOut']]){$(id).addEventListener('input',event=>{state[key]=Number(event.target.value);$(out).value=state[key].toFixed(2);state.dirty=true;});}document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));canvas.addEventListener('contextmenu',event=>event.preventDefault());canvas.addEventListener('pointerdown',event=>{canvas.setPointerCapture(event.pointerId);state.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,buttons:event.buttons,shift:event.shiftKey});if(state.pointers.size===2){const points=[...state.pointers.values()];state.pinch={distance:Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y),cameraDistance:state.camera.distance};}});canvas.addEventListener('pointermove',event=>{const previous=state.pointers.get(event.pointerId);if(!previous)return;const current={x:event.clientX,y:event.clientY,buttons:event.buttons,shift:event.shiftKey};state.pointers.set(event.pointerId,current);if(state.pointers.size===2&&state.pinch){const points=[...state.pointers.values()],distance=Math.max(8,Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y));state.camera.distance=clamp(state.pinch.cameraDistance*state.pinch.distance/distance,state.camera.minDistance,state.camera.maxDistance);}else{const dx=current.x-previous.x,dy=current.y-previous.y;if(event.shiftKey||event.buttons===2){const scale=state.camera.distance*.00105,rightX=Math.cos(state.camera.yaw),rightZ=-Math.sin(state.camera.yaw),forwardX=Math.sin(state.camera.yaw),forwardZ=Math.cos(state.camera.yaw);state.camera.target[0]=clamp(state.camera.target[0]-dx*scale*rightX-dy*scale*forwardX,-540,540);state.camera.target[2]=clamp(state.camera.target[2]-dx*scale*rightZ-dy*scale*forwardZ,-540,540);}else{state.camera.yaw-=dx*.0055;state.camera.pitch=clamp(state.camera.pitch+dy*.0045,.07,1.49);}}state.dirty=true;});const release=event=>{state.pointers.delete(event.pointerId);if(state.pointers.size<2)state.pinch=null;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('wheel',event=>{event.preventDefault();state.camera.distance=clamp(state.camera.distance*Math.exp(event.deltaY*.001),state.camera.minDistance,state.camera.maxDistance);state.dirty=true;},{passive:false});canvas.addEventListener('dblclick',event=>focusAt(event.clientX,event.clientY));window.addEventListener('resize',()=>{state.dirty=true;});window.addEventListener('keydown',event=>{if(event.key==='r'||event.key==='R')setView('overview');if(event.code==='Space'){event.preventDefault();setMode(state.mode===1?0:1);}});updateLegend();}
function updateMetrics(){$('renderGrid').textContent=`${RENDER_GRID} × ${RENDER_GRID} · ${RENDER_SPACING.toFixed(3)} m`;$('heightRange').textContent=`${state.minimum.toFixed(0)} 至 ${state.maximum.toFixed(0)} m`;$('karstRange').textContent=`${state.karstRange[0].toFixed(1)} 至 +${state.karstRange[1].toFixed(1)} m`;$('fieldRange').textContent=`${state.fieldRange[0].toFixed(2)} 至 +${state.fieldRange[1].toFixed(2)} m`;$('waterCount').textContent=`${state.segments.length} 段 · 坐标只读`;}
function updateQa(){const qa={schema:'guilin-dem-mother-sample-browser-qa/v2',passed:Boolean(state.ready&&state.gl&&state.sourceShaVerified&&state.tileShaVerified&&state.hydrologyShaVerified&&state.sourceNodeMaxError<=1e-6&&state.segments.length>0&&runtimeErrors.length===0&&loading.hidden&&!errorBox.hidden===false),sample_id:state.contract?.id||null,render_mode:'interactive-webgl2-3d',webgl2_active:Boolean(state.gl),renderer:state.gl?state.gl.getParameter(state.gl.RENDERER):null,source_sha256:state.manifest?.source?.sha256||null,source_sha_verified:state.sourceShaVerified,parent_tile_sha256:EXPECTED_TILE_SHA,parent_tile_sha_verified:state.tileShaVerified,hydrology_sha_verified:state.hydrologyShaVerified,truth_grid:[TRUTH_GRID,TRUTH_GRID],truth_spacing_m:TRUTH_SPACING,render_grid:[RENDER_GRID,RENDER_GRID],render_spacing_m:RENDER_SPACING,render_subdivision_factor:SUBDIVISION,source_node_preservation_max_error_m:state.sourceNodeMaxError,source_pixel_window_integer:true,source_resampling:false,truth_overwrite:false,synthetic_gap_fill:false,vertical_scale:1,karst_peak_count:state.peaks.length,karst_additive_range_m:state.karstRange.slice(),field_microrelief_range_m:state.fieldRange.slice(),karst_additive_authoritative:false,osm_segment_count:state.segments.length,manual_waterway:false,synthetic_waterway:false,terrain_vertex_count:state.terrain?.vertexCount||0,terrain_triangle_count:state.terrain?.triangleCount||0,plant_layer_count:0,vegetation_instance_count:0,concept_image_count:0,ai_generated_acceptance_image_count:0,terrain_image_texture_count:0,terrain_sampler2d_count:0,external_terrain_image_request_count:0,browser_rendered_evidence:true,interactive_controls_present:true,visualAcceptance:false,productionReady:false,average_fps:averageFps(),runtime_errors:runtimeErrors.slice()};window.__GUILIN_DEM_MOTHER_SAMPLE_V002__=qa;document.body.dataset.ready=String(qa.passed);document.body.dataset.visualAcceptance='false';document.body.dataset.productionReady='false';return qa;}
function showError(error){const message=String(error?.stack||error?.message||error);runtimeErrors.push(message);console.error(error);loading.hidden=true;errorText.textContent=message;errorBox.hidden=false;updateQa();}
function validateContract(contract){assert(contract.schema==='dem-mother-guilin-sample/v2','三维样板合同版本错误');assert(contract.renderMode==='interactive-webgl2-3d','成果未锁定为交互三维');assert(contract.sample.truthGrid[0]===TRUTH_GRID&&contract.sample.renderGrid[0]===RENDER_GRID,'真值或三维显示网格合同错误');assert(contract.source.sourceTiffSha256===EXPECTED_SOURCE_SHA,'来源 SHA 合同错误');assert(contract.source.parentTileSha256===EXPECTED_TILE_SHA,'父瓦片 SHA 合同错误');assert(contract.rules.truthOverwrite===false&&contract.rules.sourceResampling===false&&contract.rules.syntheticGapFill===false,'真值保护合同错误');assert(contract.rules.verticalScale===1,'垂直比例必须为 1.0');assert(contract.rules.plantLayerCount===0&&contract.rules.vegetationInstanceCount===0,'植物层必须完全删除');assert(contract.rules.conceptImageCount===0&&contract.rules.aiGeneratedAcceptanceImageCount===0,'二维概念图不得进入交付');assert(contract.rules.interactive3DRequired===true,'三维强制门未打开');}
function validateManifest(manifest){assert(manifest.schema==='guilin-canonical-native-dem/v1'&&manifest.status==='sole_authoritative','唯一桂林真值身份错误');assert(manifest.source.sha256===EXPECTED_SOURCE_SHA,'唯一真值 SHA 错误');assert(manifest.source.resolution_m[0]===TRUTH_SPACING&&manifest.source.read_only===true,'唯一真值分辨率或只读状态错误');const tile=manifest.tiles.find(item=>item.id==='native-r07-c02');assert(tile&&tile.file===TILE_FILE,'阳朔父瓦片不存在');assert(tile.sha256===EXPECTED_TILE_SHA&&tile.stored_bytes===EXPECTED_TILE_BYTES,'阳朔父瓦片身份错误');assert(tile.resampling==='none'&&tile.source_elevation_modified_m===0,'阳朔父瓦片发生重采样或高程修改');state.sourceShaVerified=true;}
async function initialize(){setupUi();setupWebGL();loadingText.textContent='读取三维合同、唯一 DEM 与真实水系清单';const[contract,manifest,hydrologyManifest]=await Promise.all([fetchJson(CONTRACT_URL),fetchJson(`${DATA_ROOT}${MANIFEST_FILE}`),fetchJson(`${DATA_ROOT}${HYDROLOGY_MANIFEST_FILE}`)]);validateContract(contract);validateManifest(manifest);assert(hydrologyManifest.segments?.file&&hydrologyManifest.segments?.sha256,'真实水系资产清单不完整');state.contract=contract;state.manifest=manifest;state.hydrologyManifest=hydrologyManifest;loadingText.textContent='逐字节核对 12.5 米父瓦片与不可变水系';const[tileBuffer,segmentBuffer]=await Promise.all([fetchBinary(`${DATA_ROOT}${TILE_FILE}`),fetchBinary(`${DATA_ROOT}${hydrologyManifest.segments.file}`)]);assert(tileBuffer.byteLength===EXPECTED_TILE_BYTES,'父瓦片字节数错误');assert(segmentBuffer.byteLength===hydrologyManifest.segments.bytes,'水系资产字节数错误');const[tileSha,hydrologySha]=await Promise.all([sha256Hex(tileBuffer),sha256Hex(segmentBuffer)]);assert(tileSha===EXPECTED_TILE_SHA,'父瓦片 SHA256 错误');assert(hydrologySha===hydrologyManifest.segments.sha256,'水系资产 SHA256 错误');state.tileShaVerified=true;state.hydrologyShaVerified=true;loadingText.textContent='裁出 81 × 81 原生像元并生成 321 × 321 三维显示网格';state.truth=extractTruth(decodeI16(tileBuffer));state.denseTruth=buildDenseTruth(state.truth);state.segments=parseHydrology(decodeF32(segmentBuffer));assert(state.segments.length>0,'当前样板没有真实水系');loadingText.textContent='生成峰冠、陡壁、短峰脚、田埂、沟渠与多尺度材料场';state.fields=deriveTerrainFields(state.denseTruth,state.segments);loadingText.textContent='编译真实三维几何与程序材质';buildTerrainMesh();buildWaterMesh();buildSkirtMesh();updateMetrics();setView('overview');state.ready=true;loading.hidden=true;errorBox.hidden=true;state.dirty=true;updateQa();window.__GUILIN_DEM_MOTHER_SAMPLE_V002_TEST_API={getState:updateQa,setMode,setView,setKarst(value){state.showKarst=Boolean(value);$('karstToggle').checked=state.showKarst;state.dirty=true;return updateQa();},setField(value){state.showField=Boolean(value);$('fieldToggle').checked=state.showField;state.dirty=true;return updateQa();},setWater(value){state.showWater=Boolean(value);$('waterToggle').checked=state.showWater;state.dirty=true;return updateQa();}};requestAnimationFrame(loop);}
initialize().catch(showError);
})();
