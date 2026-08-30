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
