(() => {
'use strict';
const TERRAIN_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aTruthNormal;
layout(location=2) in vec3 aEnhancedNormal;
layout(location=3) in vec4 aField0;
layout(location=4) in vec4 aField1;
layout(location=5) in vec4 aField2;
layout(location=6) in vec4 aField3;
uniform mat4 uViewProjection;
uniform float uDetailMix;
out vec3 vWorld;
out vec3 vNormal;
out vec4 vField0;
out vec4 vField1;
out vec4 vField2;
out vec4 vField3;
void main(){
  vec3 position=aPosition;
  position.y+=aField3.x*uDetailMix;
  vWorld=position;
  vNormal=normalize(mix(aTruthNormal,aEnhancedNormal,uDetailMix));
  vField0=aField0;
  vField1=aField1;
  vField2=aField2;
  vField3=aField3;
  gl_Position=uViewProjection*vec4(position,1.0);
}`;

const TERRAIN_FRAGMENT_SHADER = `#version 300 es
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
uniform float uMaterialDetail;
uniform float uColorRichness;
uniform vec3 uEye;
out vec4 outColor;
float sat(float v){return clamp(v,0.0,1.0);}
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){float n=sin(dot(p,vec2(41.0,289.0)));return fract(vec2(262144.0,32768.0)*n);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float a=hash12(i),b=hash12(i+vec2(1,0)),c=hash12(i+vec2(0,1)),d=hash12(i+vec2(1,1));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
float fbm(vec2 p){float sum=0.0,amp=.52;mat2 r=mat2(.80,.60,-.60,.80);for(int i=0;i<5;i++){sum+=(noise2(p)-.5)*2.0*amp;p=r*p*2.03+vec2(7.1,3.7);amp*=.49;}return sum*.5+.5;}
float ridged(vec2 p){float sum=0.0,amp=.57;mat2 r=mat2(.36,.93,-.93,.36);for(int i=0;i<5;i++){float n=1.0-abs(noise2(p)*2.0-1.0);sum+=n*n*amp;p=r*p*2.07+vec2(11.7,5.3);amp*=.48;}return sat(sum*.74);}
vec3 worley(vec2 p){vec2 id=floor(p),f=fract(p);float d1=10.0,d2=10.0,cell=0.0;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));vec2 h=hash22(id+o);float d=length(o+h-f);if(d<d1){d2=d1;d1=d;cell=hash12(id+o);}else if(d<d2)d2=d;}return vec3(d1,d2,cell);}
vec2 domainWarp(vec2 p){return vec2(fbm(p+vec2(13.1,5.2)),fbm(p+vec2(4.7,19.3)))-.5;}
float clarity(float v,float amount){float t=sat(v),local=t*t*(3.0-2.0*t);return sat(t+(t-local)*amount*1.45);}
float maskSharp(float v,float sharpness){float width=mix(.30,.035,sat(sharpness/1.6));return smoothstep(.5-width,.5+width,v);}
vec3 clut5(float t,vec3 c0,vec3 c1,vec3 c2,vec3 c3,vec3 c4){float x=sat(t)*4.0;if(x<1.0)return mix(c0,c1,x);if(x<2.0)return mix(c1,c2,x-1.0);if(x<3.0)return mix(c2,c3,x-2.0);return mix(c3,c4,x-3.0);}
vec4 splat(float a,float b,float c,float d,float sharpness){float power=1.0+sat(sharpness/1.6)*5.0;vec4 w=pow(max(vec4(a,b,c,d),vec4(.00001)),vec4(power));return w/max(dot(w,vec4(1.0)),.00001);}
vec3 truthRamp(float t){return clut5(t,vec3(.075,.13,.10),vec3(.16,.25,.14),vec3(.31,.34,.19),vec3(.47,.44,.29),vec3(.73,.72,.64));}
void main(){
  float truth=vField0.x;
  float slope=sat(vField0.y);
  float curvature=clamp(vField0.z,-1.0,1.0);
  float tpi=clamp(vField0.w,-1.0,1.0);
  float rock=sat(vField1.x);
  float paddy=sat(vField1.y);
  float wet=sat(vField1.z);
  float alluvium=sat(vField1.w);
  float bund=sat(vField2.x);
  float ditch=sat(vField2.y);
  float fractureCpu=sat(vField2.z);
  float strataCpu=sat(vField2.w);
  float delta=vField3.x;
  float unitSeed=sat(vField3.y);
  float flow=sat(vField3.z);
  float sediment=sat(vField3.w);
  float elevation=sat((truth-uMinElevation)/max(1.0,uMaxElevation-uMinElevation));

  vec2 world=vWorld.xz;
  vec2 p=world*.0062;
  vec2 q=p+domainWarp(p*.73+vec2(1.37,7.31))*.74;
  float macroA=fbm(q*.57+vec2(2.7,6.1));
  float macroB=fbm(q*1.19+vec2(9.2,1.8));
  float ruggedA=ridged(q*2.35+vec2(3.4,7.8));
  float ruggedB=ridged((q+domainWarp(q*1.31)*.34)*4.72+vec2(12.4,2.2));
  float rugged=clarity(ruggedA*.64+ruggedB*.36,.78);
  vec3 cells=worley(q*2.82+vec2(8.1,2.6));
  float plateEdge=1.0-smoothstep(.025,.19,cells.y-cells.x);
  float strataPhase=(vWorld.y*.055+world.x*.0107+world.y*.0049+(macroB-.5)*1.9)*6.2831853;
  float strata=pow(1.0-abs(sin(strataPhase)),3.25)*smoothstep(.27,.83,macroA)*rock;
  float verticalRill=pow(1.0-abs(sin(vWorld.y*.19+(world.x+world.y)*.027+(macroA-.5)*4.2)),5.0)*flow*rock;
  float fracture=maskSharp(rugged*.51+plateEdge*.31+fractureCpu*.42,1.02)*rock;
  float microRidge=ridged(q*18.0+vec2(17.2,9.7));
  float microPore=smoothstep(.75,.95,ridged(q*39.0+vec2(3.7,15.4)))*rock;
  float separation=smoothstep(.08,.42,abs(macroA-rugged));
  float cavity=sat(fracture*.38+microPore*.27+verticalRill*.20+ditch*.42);
  float microHeight=(rugged-.52)*.86*rock+strata*.38-fracture*.48+verticalRill*-.18+(microRidge-.46)*.12+bund*.22-ditch*.20;
  vec3 baseNormal=normalize(vNormal);
  vec3 displaced=vWorld+baseNormal*microHeight*uMaterialDetail;
  vec3 normal=normalize(cross(dFdx(displaced),dFdy(displaced)));
  if(dot(normal,baseNormal)<0.0)normal=-normal;
  normal=normalize(mix(baseNormal,normal,sat(.20+uMaterialDetail*.56)));

  vec3 limestone=clut5(clarity(rugged*.42+strata*.20+macroA*.18+unitSeed*.20,.82),vec3(.065,.066,.062),vec3(.18,.20,.20),vec3(.34,.35,.33),vec3(.52,.51,.47),vec3(.73,.71,.64));
  float iron=maskSharp(macroB*.50+flow*.20+separation*.30,.76)*rock;
  limestone=mix(limestone,vec3(.43,.29,.16),iron*.40);
  limestone=mix(limestone,vec3(.72,.67,.53),strata*.25);
  limestone*=mix(1.0,.67,wet*.52);
  vec3 colluvium=clut5(clarity(macroA*.53+macroB*.25+sediment*.22,.62),vec3(.095,.066,.035),vec3(.19,.12,.055),vec3(.32,.225,.095),vec3(.46,.35,.16),vec3(.59,.50,.27));
  colluvium=mix(colluvium,vec3(.10,.085,.055),wet*.55);
  colluvium=mix(colluvium,vec3(.54,.45,.26),separation*.15);
  vec3 alluvial=clut5(clarity(macroB*.38+sediment*.36+unitSeed*.26,.72),vec3(.09,.075,.045),vec3(.19,.145,.07),vec3(.32,.265,.12),vec3(.46,.40,.19),vec3(.62,.56,.30));
  alluvial*=mix(1.03,.63,wet*.70);
  vec3 paddyColor=clut5(clarity(macroB*.40+unitSeed*.42+wet*.18,.76),vec3(.10,.12,.040),vec3(.25,.31,.07),vec3(.45,.49,.12),vec3(.64,.59,.17),vec3(.78,.70,.28));
  paddyColor*=mix(1.04,.67,wet*.73);

  float bare=max(0.0,1.0-rock-paddy*.75-alluvium*.55);
  vec4 weights=splat(bare,paddy,rock,max(alluvium,sediment*.65),.74);
  vec3 color=colluvium*weights.x+paddyColor*weights.y+limestone*weights.z+alluvial*weights.w;
  color=mix(color,vec3(.15,.095,.035),bund*.72);
  color=mix(color,vec3(.045,.26,.31),ditch*.75+wet*.06);
  color=mix(color,vec3(.07,.055,.043),cavity*.36);
  color=mix(color,vec3(.68,.65,.54),separation*.13*rock);

  if(uMode==1){
    color=truthRamp(elevation);
  }else if(uMode==2){
    float ridge=sat(tpi*.5+.5);
    color=clut5(ridge,vec3(.12,.31,.44),vec3(.15,.24,.28),vec3(.28,.30,.22),vec3(.57,.43,.19),vec3(.91,.71,.24));
    color=mix(color,vec3(.86,.84,.73),rock*.58);
  }else if(uMode==3){
    color=mix(vec3(.055,.068,.045),paddyColor,pow(paddy,.56));
    color=mix(color,vec3(.33,.17,.045),pow(bund,.52));
    color=mix(color,vec3(.04,.46,.56),pow(ditch,.49));
  }else if(uMode==4){
    color=clut5(pow(wet,.67),vec3(.15,.09,.045),vec3(.26,.20,.10),vec3(.11,.38,.35),vec3(.045,.54,.61),vec3(.17,.69,.73));
    color=mix(color,vec3(.035,.27,.51),ditch*.82+flow*.20);
  }else if(uMode==5){
    color=clut5(pow(fracture*.48+strata*.28+microPore*.24,.60),vec3(.075,.09,.068),vec3(.18,.20,.17),vec3(.38,.37,.32),vec3(.62,.58,.47),vec3(.84,.78,.63));
    color=mix(color,vec3(.09,.055,.035),fracture*.55);
    color=mix(color,vec3(.76,.65,.40),strata*.28);
  }

  float luma=dot(color,vec3(.2126,.7152,.0722));
  color=mix(vec3(luma),color,uColorRichness);
  vec3 lightDirection=normalize(vec3(-.46,.80,.38));
  vec3 viewDirection=normalize(uEye-vWorld);
  vec3 halfDirection=normalize(lightDirection+viewDirection);
  float wrap=sat(dot(normal,lightDirection)*.68+.32);
  float sky=sat(normal.y*.5+.5);
  float ao=sat(1.0-cavity*.28-sat(-curvature)*.12-fracture*.12-rock*.08);
  ao=mix(ao,1.0,.40);
  float roughness=sat(.50+rock*.27+paddy*.11+sediment*.16-wet*.25+microRidge*.08);
  float specular=pow(max(dot(normal,halfDirection),0.0),mix(58.0,8.0,roughness))*mix(.20,.052,roughness);
  float rim=pow(1.0-max(dot(normal,viewDirection),0.0),3.0)*.10;
  vec3 lit=color*(.20+.63*wrap+.17*sky)*ao;
  lit+=vec3(.92,.88,.72)*specular+vec3(.14,.22,.20)*rim;
  float distanceToEye=length(uEye-vWorld);
  float fog=smoothstep(1750.0,4300.0,distanceToEye);
  lit=mix(lit,vec3(.045,.075,.064),fog*.64);
  outColor=vec4(pow(clamp(lit,0.0,1.28),vec3(.91)),1.0);
}`;

window.LandscapeMotherTerrainShaders = Object.freeze({ TERRAIN_VERTEX_SHADER, TERRAIN_FRAGMENT_SHADER });
})();
