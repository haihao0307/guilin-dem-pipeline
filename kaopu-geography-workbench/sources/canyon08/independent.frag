// R8: independently authored connected canyon height-field study.
// New representation: continuous elevation surface, no caves or overhang claim.
// General interpolation and ray-bracketing methods are not claimed novel.
// No teacher code, images, textures or geometry data are used.
const float LAND_FAR=300.0;
uint mixCell(ivec2 p){
 uint h=uint(p.x)*8191u+uint(p.y)*524287u+3917u;
 h=(h^(h<<7)^(h>>13))*6700417u;
 h=(h^(h>>11))*32771u;return h^(h<<9);
}
float lattice(ivec2 p){return float(mixCell(p)&0xffffffu)/16777216.0;}
float landNoise(vec2 p){
 ivec2 q=ivec2(floor(p));vec2 f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(lattice(q),lattice(q+ivec2(1,0)),f.x),mix(lattice(q+ivec2(0,1)),lattice(q+ivec2(1,1)),f.x),f.y);
}
mat2 landTurn(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float riverCenter(float z){return 18.0*sin(z*.014+.42)+8.0*sin(z*.033-1.3);}
float riverWidth(float z){return 37.0+8.0*sin(z*.021+.6)+6.0*(landNoise(vec2(z*.027,9.3))-.5);}
float valleyFloor(vec2 p){
 float x=p.x-riverCenter(p.y);
 float drainage=x-7.0*sin(p.y*.029)-3.0*sin(p.y*.073+.4);
 return .7+1.6*landNoise(p*.037+vec2(23,17))+.65*landNoise(landTurn(.43)*p*.11)
        -1.65*exp(-pow(drainage/(9.5+2.5*sin(p.y*.023+.7)),2.0))
        +.40*sin(p.y*.047+drainage*.073)*exp(-pow(drainage/15.0,2.0));
}
float terrainHeight(vec2 p){
 float z=p.y,x=p.x-riverCenter(z),side=x<0.0?-1.0:1.0;
 float a=abs(x)-riverWidth(z);
 // Unequal coves and attached headlands vary the entire cross-section.
 float plan=landNoise(vec2(z*.032+side*13.7,29.1));
 a+=12.0*(plan-.5)+3.4*sin(z*.061+side*2.7);
 // Exact interior simplification: every bank/bed/joint term is zero here;
 // retain the only surviving fan and debris terms, without changing geometry.
 if(a< -8.0){
  float fan=exp(-pow((z-(side>0.0?86.0:202.0))/25.0,2.0));
  float apron=4.3*fan*max(0.0,1.0-abs(a+2.0)/24.0);
  return valleyFloor(p)+apron;
 }
 // Coherent cross-bank displacement articulates actual major cliff faces.
 float faceExposure=smoothstep(-2.0,12.0,a)*(1.0-smoothstep(67.0,106.0,a));
 float wallRelief=3.8*(2.0*landNoise(vec2(z*.15,p.x*.065)+vec2(side*19.0,8.0))-1.0);
 wallRelief+=1.2*(2.0*landNoise(vec2(z*.39,p.x*.14)+vec2(31.0,side*7.0))-1.0);
 a+=wallRelief*faceExposure;
 vec2 broadP=landTurn(side*.35)*p;
 float upland=54.0+22.0*(landNoise(broadP*.017+vec2(9,47))-.5)
             +15.0*(landNoise(broadP*.041+vec2(31,7))-.5)+8.0*sin(z*.016+side);
 float cleft=landNoise(vec2(z*.044+side*7.3,13.9));
 float lower=.29*smoothstep(-8.0,16.0+5.0*cleft,a);
 float face=clamp((a-(14.0+7.0*cleft))/(11.0+2.0*cleft),0.0,1.0);
 float cliff=.47*mix(face,face*face*(3.0-2.0*face),.13);
 float shoulder=.24*smoothstep(24.0,65.0,a);
 float h=upland*(lower+cliff+shoulder);
 // Intermediate benches terminate by region instead of circling every bank.
 float region=smoothstep(.38,.74,landNoise(vec2(z*.012+side*5.1,73.2)));
 h+=5.5*region*(smoothstep(9.0,15.0,a)-smoothstep(27.0,48.0,a));
 float rockGate=smoothstep(-1.0,18.0,a);
 float relief=4.4*(landNoise(landTurn(.21)*p*.095+vec2(43,2))-.5)
              +1.45*(landNoise(landTurn(-.51)*p*.25+vec2(9,63))-.5);
 h+=relief*rockGate;
 float fractured=1.0-abs(2.0*landNoise(landTurn(.73)*p*.19+vec2(18,71))-1.0);
 h+=(3.4*(fractured-.5)+.95*(landNoise(landTurn(-.37)*p*.49)-.5))*rockGate;
 // Finite, unequal erosion joints subdivide major faces in plan, not color.
 float jointCell=floor(z/23.0);
 for(int j=-1;j<=1;j++){
  float k=jointCell+float(j),seed=lattice(ivec2(int(k),int(side*19.0)));
  float center=(k+.5)*23.0+(seed-.5)*12.0+.13*a;
  float profile=exp(-pow((z-center)/(1.7+1.8*seed),2.0));
  float extent=smoothstep(9.0,23.0,a)*(1.0-smoothstep(42.0+seed*20.0,80.0,a));
  h-=(3.5+5.0*seed)*profile*extent*smoothstep(.19,.39,seed);
 }
 // Three climbing side-drainages carve connected V-shaped tributaries.
 const vec4 branches[3]=vec4[3](vec4(1,85,.42,7.0),vec4(-1,201,-.29,10.0),vec4(1,347,.25,8.0));
 for(int i=0;i<3;i++){
  vec4 b=branches[i];if(side*b.x<0.0)continue;
  float outwards=max(a+7.0,0.0);
  float branchZ=b.y+b.z*outwards+6.0*sin(outwards*.047+float(i));
  float d=(z-branchZ)/(b.w+outwards*.046);
  float cut=exp(-d*d)*(1.0-smoothstep(55.0,139.0,outwards));
  float risingBed=outwards*.10+outwards*outwards*.0016;
  h=mix(h,min(h,risingBed),cut*.88);
 }
 // Sparse connected alluvial aprons, not a carpet of standalone towers.
 float fan=exp(-pow((z-(side>0.0?86.0:202.0))/25.0,2.0));
 h+=4.3*fan*max(0.0,1.0-abs(a+2.0)/24.0);
 return valleyFloor(p)+max(h,0.0);
}
float landField(vec3 p){return p.y-terrainHeight(p.xz);}
vec3 landNormal(vec3 p,float t){
 float e=.06+.0003*t;
 float a=terrainHeight(p.xz+vec2(e,0))-terrainHeight(p.xz-vec2(e,0));
 float b=terrainHeight(p.xz+vec2(0,e))-terrainHeight(p.xz-vec2(0,e));
 return normalize(vec3(-a,2.0*e,-b));
}
float landShadow(vec3 p,vec3 light){
 float travel=.25;
 for(int j=0;j<36;j++){
  float h=landField(p+light*travel);
  if(h<.025)return .15;
  travel+=clamp(h*.20,.25,5.0);
  if(travel>95.0)break;
 }
 return 1.0;
}
// Independent multiscale stone finish. The material lab was observed for
// coarse/middle surface organization, cavity correlation and side lighting.
// This code reuses neither its teacher functions nor image assets.
float stoneVolume(vec3 p){
 ivec3 c=ivec3(floor(p));vec3 f=fract(p);f=f*f*(3.0-2.0*f);
 ivec2 a=c.xy+ivec2(c.z*113,c.z*367),b=a+ivec2(113,367);
 float lo=mix(mix(lattice(a),lattice(a+ivec2(1,0)),f.x),mix(lattice(a+ivec2(0,1)),lattice(a+ivec2(1,1)),f.x),f.y);
 float hi=mix(mix(lattice(b),lattice(b+ivec2(1,0)),f.x),mix(lattice(b+ivec2(0,1)),lattice(b+ivec2(1,1)),f.x),f.y);
 return mix(lo,hi,f.z);
}
float stoneRelief(vec3 p){
 vec3 q=vec3(.91*p.x+.29*p.z,p.y+.16*p.z,-.29*p.x+.91*p.z);
 float broad=stoneVolume(q*.24+vec3(39,7,11));
 float chip=1.0-abs(2.0*stoneVolume(q*.72+vec3(9,21,63))-1.0);
 float split=stoneVolume(q*1.93+vec3(8,43,17));
 return .96*broad+.24*chip*(.5+.7*broad)+.055*split;
}
vec3 stoneSurfaceNormal(vec3 p,vec3 n,float t){
 // Normal-only relief at middle and small stone scales; silhouette stays frozen.
 float e=.075+.00065*t;vec2 k=vec2(e,0);float a=stoneRelief(p);
 vec3 g=vec3(stoneRelief(p+k.xyy)-stoneRelief(p-k.xyy),stoneRelief(p+k.yxy)-stoneRelief(p-k.yxy),stoneRelief(p+k.yyx)-stoneRelief(p-k.yyx))/(2.0*e);
 float rock=1.0-smoothstep(.79,.97,n.y);
 return normalize(n-1.55*rock*(g-n*dot(g,n)));
}
vec3 stoneColor(vec3 p,vec3 n){
 float relativeX=p.x-riverCenter(p.z),a=abs(relativeX)-riverWidth(p.z);
 float mineral=stoneVolume(p*.043+vec3(61,29,3));
 float face=stoneVolume(p*.23+vec3(7,39,19));
 float chip=stoneVolume(p*.73+vec3(33,18,51));
 vec3 rock=mix(vec3(.22,.137,.081),vec3(.38,.248,.135),smoothstep(.21,.77,mineral));
 // Correlated weathering follows broad rock patches; no ring-like bright layer.
 rock*=.76+.40*face;
 rock=mix(rock,vec3(.17,.131,.106),smoothstep(.57,.80,face)*.24);
 rock*=.88+.16*chip;
 vec3 sand=mix(vec3(.35,.266,.174),vec3(.43,.330,.224),landNoise(p.xz*.042));
 float drainage=relativeX-7.0*sin(p.z*.029)-3.0*sin(p.z*.073+.4);
 sand=mix(sand,vec3(.42,.321,.218),exp(-pow(drainage/10.0,2.0))*.35);
 float floorMix=1.0-smoothstep(-7.0,8.0,a);
 return mix(rock,sand,max(smoothstep(.72,.96,n.y)*.45,floorMix));
}
void mainImage(out vec4 fragColor,in vec2 fragCoord){
 float station=12.0+iTime*3.7;
 float c=riverCenter(station),w=riverWidth(station);
 vec3 ro=vec3(c-w*.26,28.0+4.0*sin(iTime*.16+.4),station);
 vec3 target=vec3(riverCenter(station+108.0)+8.0,22.0+2.0*sin(iTime*.12),station+108.0);
 vec3 f=normalize(target-ro),r=normalize(cross(f,vec3(0,1,0))),u=cross(r,f);
 vec2 uv=(fragCoord-iResolution.xy*.5)/iResolution.y;
 float aspect=iResolution.x/iResolution.y;
 float lens=1.22*min(1.0,aspect/1.6);
 vec3 rd=normalize(f*lens+r*uv.x+u*uv.y);
 vec3 sky=mix(vec3(.62,.68,.71),vec3(.21,.39,.57),clamp(rd.y*1.9+.19,0.0,1.0));
 vec3 col=sky;float t=.1,previous=0.0;bool hit=false;
 #ifdef DENSE_REFERENCE
 const int STEPS=6500;const float divisor=24.0;const float maxStep=.7;const float minStep=.018;
 #else
 const int STEPS=3200;const float divisor=14.0;const float maxStep=1.8;const float minStep=.01;
 #endif
 for(int j=0;j<STEPS;j++){
  // All bounded height terms together remain below100 scene units.
  if(rd.y>0.0&&(ro+rd*t).y>100.0){t=LAND_FAR+1.0;break;}
  float d=landField(ro+rd*t);
  if(d<=0.0){
   float lo=previous,hi=t;
   for(int k=0;k<10;k++){float mid=(lo+hi)*.5;if(landField(ro+rd*mid)>0.0)lo=mid;else hi=mid;}
   t=(lo+hi)*.5;hit=true;break;
  }
  if(t>LAND_FAR)break;
  previous=t;t+=clamp(d/divisor,minStep,maxStep);
 }
 if(hit){
  vec3 p=ro+rd*t,gn=landNormal(p,t),n=stoneSurfaceNormal(p,gn,t),sun=normalize(vec3(-.69,.43,-.58));
  float shadow=landShadow(p+gn*.23,sun),diff=max(dot(n,sun),0.0)*shadow;
  float contact=1.0;
  for(int i=1;i<=2;i++){
   float s=float(i)*1.35;contact-=max(0.0,s-landField(p+gn*s))*.09;
  }
  contact=clamp(contact,.56,1.0);
  float relief=stoneRelief(p);float cavity=.70+.30*smoothstep(.28,.76,relief);
  vec3 ambient=mix(vec3(.075,.062,.052),vec3(.17,.205,.235),gn.y*.5+.5);
  float fill=max(dot(n,normalize(vec3(.67,.28,-.39))),0.0);
  col=stoneColor(p,gn)*(ambient*contact*cavity+vec3(1.20,.98,.73)*diff+vec3(.055,.077,.108)*fill);
  // Broad dry-mineral sheen, deliberately not a wet coating.
  vec3 halfVector=normalize(sun-rd);
  float sheen=pow(max(dot(n,halfVector),0.0),12.0)*max(dot(n,sun),0.0)*shadow;
  col+=vec3(.022,.021,.018)*sheen*cavity;
  float fog=max((1.0-exp(-t*.0025))*.55,pow(smoothstep(140.0,LAND_FAR,t),2.0)*.98);
  col=mix(col,vec3(.55,.61,.64),fog);
 }
 col=pow(max(col,0.0),vec3(.4545));
 col*=1.0-.12*dot(uv,uv);
 #ifdef TRACE_DIAGNOSTIC
 if(!hit&&t<LAND_FAR)col=vec3(1,0,0);
 else if(hit&&abs(landField(ro+rd*t))>.05)col=vec3(1,0,1);
 else col*=.5;
 #endif
 #ifdef TRACE_DEPTH_OUTPUT
 if(hit){float q=floor(clamp(t/LAND_FAR,0.,.999999)*65534.);col=vec3(floor(q/256.),mod(q,256.),0.)/255.;}else col=vec3(1);
 #endif
 #ifdef FINITE_CHECK
 fragColor=(any(isnan(col))||any(isinf(col)))?vec4(1,0,1,1):vec4(0,0,0,1);
 #else
 fragColor=vec4(clamp(col,0.,1.),1.);
 #endif
}
