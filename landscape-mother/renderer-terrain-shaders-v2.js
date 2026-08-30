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
layout(location=7) in vec4 aField4;
layout(location=8) in vec4 aField5;
uniform mat4 uViewProjection;
uniform float uDetailMix;
out vec3 vWorld;
out vec3 vNormal;
out vec4 vField0;
out vec4 vField1;
out vec4 vField2;
out vec4 vField3;
out vec4 vField4;
out vec4 vField5;
void main(){
  vec3 position=aPosition;
  position.y+=aField3.x*uDetailMix;
  vWorld=position;
  vNormal=normalize(mix(aTruthNormal,aEnhancedNormal,uDetailMix));
  vField0=aField0;
  vField1=aField1;
  vField2=aField2;
  vField3=aField3;
  vField4=aField4;
  vField5=aField5;
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
in vec4 vField4;
in vec4 vField5;
uniform int uMode;
uniform float uMinElevation;
uniform float uMaxElevation;
uniform float uMaterialDetail;
uniform float uColorRichness;
uniform vec3 uEye;
out vec4 outColor;

float sat(float value){return clamp(value,0.0,1.0);}
float hash12(vec2 p){
  vec3 p3=fract(vec3(p.xyx)*.1031);
  p3+=dot(p3,p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}
vec2 hash22(vec2 p){
  float n=sin(dot(p,vec2(41.0,289.0)));
  return fract(vec2(262144.0,32768.0)*n);
}
float noise2(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  float a=hash12(i),b=hash12(i+vec2(1.0,0.0));
  float c=hash12(i+vec2(0.0,1.0)),d=hash12(i+vec2(1.0,1.0));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
float fbm(vec2 p){
  float sum=0.0,amplitude=.52;
  mat2 rotation=mat2(.80,.60,-.60,.80);
  for(int octave=0;octave<5;octave++){
    sum+=(noise2(p)-.5)*2.0*amplitude;
    p=rotation*p*2.03+vec2(7.1,3.7);
    amplitude*=.49;
  }
  return sum*.5+.5;
}
float ridged(vec2 p){
  float sum=0.0,amplitude=.57;
  mat2 rotation=mat2(.36,.93,-.93,.36);
  for(int octave=0;octave<5;octave++){
    float value=1.0-abs(noise2(p)*2.0-1.0);
    sum+=value*value*amplitude;
    p=rotation*p*2.07+vec2(11.7,5.3);
    amplitude*=.48;
  }
  return sat(sum*.74);
}
vec3 worley(vec2 p){
  vec2 id=floor(p),f=fract(p);
  float first=10.0,second=10.0,cell=0.0;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 offset=vec2(float(x),float(y));
    vec2 point=hash22(id+offset);
    float distanceValue=length(offset+point-f);
    if(distanceValue<first){
      second=first;
      first=distanceValue;
      cell=hash12(id+offset);
    }else if(distanceValue<second){
      second=distanceValue;
    }
  }
  return vec3(first,second,cell);
}
vec2 domainWarp(vec2 p){
  return vec2(fbm(p+vec2(13.1,5.2)),fbm(p+vec2(4.7,19.3)))-.5;
}
float clarity(float value,float amount){
  float t=sat(value);
  float local=t*t*(3.0-2.0*t);
  return sat(t+(t-local)*amount*1.35);
}
vec3 clut5(float t,vec3 c0,vec3 c1,vec3 c2,vec3 c3,vec3 c4){
  float x=sat(t)*4.0;
  if(x<1.0)return mix(c0,c1,x);
  if(x<2.0)return mix(c1,c2,x-1.0);
  if(x<3.0)return mix(c2,c3,x-2.0);
  return mix(c3,c4,x-3.0);
}
vec4 normalizedSplat(float a,float b,float c,float d,float sharpness){
  float powerValue=1.0+sat(sharpness/1.6)*5.0;
  vec4 weights=pow(max(vec4(a,b,c,d),vec4(.00001)),vec4(powerValue));
  return weights/max(dot(weights,vec4(1.0)),.00001);
}
vec3 truthRamp(float t){
  return clut5(
    t,
    vec3(.060,.105,.080),
    vec3(.135,.225,.120),
    vec3(.285,.315,.175),
    vec3(.455,.425,.285),
    vec3(.720,.710,.625)
  );
}

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
  float cavityCpu=sat(vField4.x);
  float protrusionCpu=sat(vField4.y);
  float separationCpu=sat(vField4.z);
  float colorDriverCpu=sat(vField4.w);
  float parentMask=sat(vField5.x);
  float processMask=sat(vField5.y);
  float roughnessCpu=sat(vField5.z);
  float aoCpu=sat(vField5.w);
  float elevation=sat((truth-uMinElevation)/max(1.0,uMaxElevation-uMinElevation));

  vec2 world=vWorld.xz;
  vec2 baseP=world*.0060;
  vec2 warped=baseP+domainWarp(baseP*.72+vec2(1.37,7.31))*.72;
  float macroA=fbm(warped*.56+vec2(2.7,6.1));
  float macroB=fbm(warped*1.16+vec2(9.2,1.8));
  float structureA=ridged(warped*2.30+vec2(3.4,7.8));
  float structureB=ridged((warped+domainWarp(warped*1.27)*.31)*4.55+vec2(12.4,2.2));
  float structure=clarity(structureA*.62+structureB*.38,.72);
  vec3 cells=worley(warped*2.72+vec2(8.1,2.6));
  float cellularEdge=1.0-smoothstep(.025,.19,cells.y-cells.x);

  float strataPhase=(
    vWorld.y*.054+
    world.x*.0102+
    world.y*.0046+
    (macroB-.5)*1.8
  )*6.2831853;
  float strataGpu=pow(1.0-abs(sin(strataPhase)),3.15)*smoothstep(.26,.82,macroA)*rock;
  float verticalRill=pow(
    1.0-abs(sin(vWorld.y*.185+(world.x+world.y)*.026+(macroA-.5)*4.0)),
    4.8
  )*flow*rock;
  float fractureGpu=smoothstep(
    .54,.78,
    structure*.48+cellularEdge*.29+fractureCpu*.39
  )*rock;
  float microRidge=ridged(warped*17.0+vec2(17.2,9.7));
  float microPore=smoothstep(.75,.95,ridged(warped*37.0+vec2(3.7,15.4)))*rock;

  float cavity=sat(max(cavityCpu*.88,fractureGpu*.31+microPore*.25+verticalRill*.18+ditch*.38));
  float protrusion=sat(max(protrusionCpu*.82,structure*.70+strataGpu*.18));
  float separation=sat(max(separationCpu,abs(macroA-structure)*1.65));
  float colorDriver=clarity(
    sat(colorDriverCpu*.56+macroA*.14+structure*.12+cavity*.07+wet*.06+separation*.05),
    .74
  );
  float strata=sat(max(strataCpu*.72,strataGpu));
  float fracture=sat(max(fractureCpu,fractureGpu));

  float microHeight=(
    (structure-.52)*.72*rock+
    strata*.30-
    fracture*.36-
    cavity*.22+
    protrusion*.18+
    (microRidge-.48)*.10+
    bund*.18-
    ditch*.17
  )*parentMask;
  vec3 baseNormal=normalize(vNormal);
  vec3 displaced=vWorld+baseNormal*microHeight*uMaterialDetail;
  vec3 normal=normalize(cross(dFdx(displaced),dFdy(displaced)));
  if(dot(normal,baseNormal)<0.0)normal=-normal;
  normal=normalize(mix(baseNormal,normal,sat(.18+uMaterialDetail*.48)));

  vec3 limestone=clut5(
    clarity(colorDriver*.44+structure*.30+strata*.13+unitSeed*.13,.72),
    vec3(.055,.060,.056),
    vec3(.150,.170,.165),
    vec3(.300,.315,.292),
    vec3(.485,.480,.430),
    vec3(.715,.690,.605)
  );
  float iron=smoothstep(.48,.72,macroB*.50+flow*.16+separation*.34)*rock;
  limestone=mix(limestone,vec3(.39,.265,.135),iron*.34);
  limestone=mix(limestone,vec3(.68,.64,.52),strata*.20);
  limestone*=mix(1.0,.66,wet*.50);

  vec3 colluvium=clut5(
    clarity(colorDriver*.42+macroA*.31+sediment*.27,.58),
    vec3(.080,.057,.031),
    vec3(.165,.108,.050),
    vec3(.285,.205,.088),
    vec3(.430,.330,.145),
    vec3(.565,.470,.245)
  );
  colluvium=mix(colluvium,vec3(.090,.078,.052),wet*.50);
  colluvium=mix(colluvium,vec3(.50,.42,.23),separation*.12);

  vec3 alluvialColor=clut5(
    clarity(colorDriver*.32+macroB*.30+sediment*.26+unitSeed*.12,.68),
    vec3(.075,.064,.039),
    vec3(.165,.125,.061),
    vec3(.285,.235,.105),
    vec3(.420,.360,.165),
    vec3(.565,.505,.260)
  );
  alluvialColor*=mix(1.02,.64,wet*.66);

  vec3 paddyColor=clut5(
    clarity(colorDriver*.34+unitSeed*.36+wet*.18+macroB*.12,.70),
    vec3(.075,.095,.032),
    vec3(.180,.270,.052),
    vec3(.340,.410,.085),
    vec3(.520,.510,.135),
    vec3(.690,.615,.225)
  );
  paddyColor*=mix(1.03,.69,wet*.65);

  float bare=max(0.0,1.0-rock-paddy*.74-alluvium*.54);
  vec4 weights=normalizedSplat(bare,paddy,rock,max(alluvium,sediment*.65),.72);
  vec3 color=
    colluvium*weights.x+
    paddyColor*weights.y+
    limestone*weights.z+
    alluvialColor*weights.w;
  color=mix(color,vec3(.135,.085,.032),bund*.67);
  color=mix(color,vec3(.035,.225,.260),ditch*.72+wet*.045);
  color=mix(color,vec3(.055,.047,.038),cavity*.32*processMask);
  color=mix(color,vec3(.665,.625,.515),protrusion*.10*rock);
  color=mix(color,vec3(.76,.69,.54),separation*.08*rock);

  if(uMode==1){
    color=truthRamp(elevation);
  }else if(uMode==2){
    float ridge=sat(tpi*.5+.5);
    color=clut5(
      ridge,
      vec3(.10,.28,.41),
      vec3(.13,.21,.25),
      vec3(.25,.28,.20),
      vec3(.52,.39,.17),
      vec3(.87,.67,.22)
    );
    color=mix(color,vec3(.82,.80,.70),rock*.56);
  }else if(uMode==3){
    color=mix(vec3(.046,.058,.040),paddyColor,pow(paddy,.55));
    color=mix(color,vec3(.31,.155,.040),pow(bund,.51));
    color=mix(color,vec3(.035,.40,.49),pow(ditch,.48));
  }else if(uMode==4){
    color=clut5(
      pow(wet,.66),
      vec3(.14,.08,.040),
      vec3(.24,.18,.09),
      vec3(.095,.33,.31),
      vec3(.035,.48,.55),
      vec3(.14,.63,.68)
    );
    color=mix(color,vec3(.025,.23,.46),ditch*.78+flow*.20);
  }else if(uMode==5){
    float eventDriver=sat(cavity*.34+protrusion*.22+separation*.20+fracture*.14+strata*.10);
    color=clut5(
      pow(eventDriver,.60),
      vec3(.065,.078,.060),
      vec3(.15,.18,.15),
      vec3(.34,.335,.29),
      vec3(.57,.525,.415),
      vec3(.80,.735,.585)
    );
    color=mix(color,vec3(.075,.046,.030),cavity*.45);
    color=mix(color,vec3(.73,.61,.36),protrusion*.20+strata*.15);
  }

  float luma=dot(color,vec3(.2126,.7152,.0722));
  color=mix(vec3(luma),color,uColorRichness);

  vec3 lightDirection=normalize(vec3(-.46,.80,.38));
  vec3 viewDirection=normalize(uEye-vWorld);
  vec3 halfDirection=normalize(lightDirection+viewDirection);
  float wrap=sat(dot(normal,lightDirection)*.68+.32);
  float sky=sat(normal.y*.5+.5);
  float ao=sat(1.0-aoCpu*.31-cavity*.20-sat(-curvature)*.10-fracture*.08-rock*.05);
  ao=mix(ao,1.0,.34);
  float roughness=sat(roughnessCpu*.72+.20+rock*.12+paddy*.06+sediment*.08-wet*.12+microRidge*.04);
  float specular=pow(max(dot(normal,halfDirection),0.0),mix(58.0,8.0,roughness))*mix(.20,.050,roughness);
  float rim=pow(1.0-max(dot(normal,viewDirection),0.0),3.0)*.09;
  vec3 lit=color*(.20+.63*wrap+.17*sky)*ao;
  lit+=vec3(.91,.87,.72)*specular+vec3(.13,.20,.18)*rim;
  float distanceToEye=length(uEye-vWorld);
  float fog=smoothstep(1700.0,4300.0,distanceToEye);
  lit=mix(lit,vec3(.043,.070,.060),fog*.62);
  outColor=vec4(pow(clamp(lit,0.0,1.24),vec3(.92)),1.0);
}`;

window.LandscapeMotherTerrainShaders = Object.freeze({
  TERRAIN_VERTEX_SHADER,
  TERRAIN_FRAGMENT_SHADER,
  version: '2.0.0',
});
})();
