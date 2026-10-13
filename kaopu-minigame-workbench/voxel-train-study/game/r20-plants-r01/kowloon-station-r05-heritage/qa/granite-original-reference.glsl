// READ-ONLY ORIGINAL SOURCE EXTRACT FOR KOWLOON GRANITE IMPLEMENTATION AUDIT.
// Source: STONE_STUDY.html, Library libfile_3d00eceb0dbc8191bc4bf7b704079ede, version 1.
// Original source line windows: 1601-1652 and 1687-1693 (line locations per Library read).
// Functions below are verbatim excerpts; only this header and separating blank lines are new.
// This is an input/reference, not a WGSL implementation or standalone fragment shader.
// No original lighting, geometry mesh, scan, image, or texture is included.
// See GRANITE-SOURCE-AUDIT.md for exact function hashes and unit/licence boundaries.

uniform vec3 uCamera;uniform float uColorSeed;uniform float uPoreSeed;uniform float uWeatherSeed;uniform int uDebugMode;
uniform int uEventCount;uniform vec4 uEventCenter[20];uniform vec4 uEventSize[20];
vec3 hash33(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yxx)*p.zyx);}
float valueNoise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);return mix(mix(mix(hash33(i).x,hash33(i+vec3(1,0,0)).x,f.x),mix(hash33(i+vec3(0,1,0)).x,hash33(i+vec3(1,1,0)).x,f.x),f.y),mix(mix(hash33(i+vec3(0,0,1)).x,hash33(i+vec3(1,0,1)).x,f.x),mix(hash33(i+vec3(0,1,1)).x,hash33(i+vec3(1,1,1)).x,f.x),f.y),f.z);}
vec3 seedVector(float seed,float salt){return hash33(vec3(seed*.001,salt,seed*.00013))*49.;}
vec3 srgbToLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 linearToSrgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}

uniform int sKind;
uniform vec4 sSurface;
uniform vec4 sDisplay;
uniform float sRelief;
struct StoneSample {vec3 color;float height;float rough;float mineral;float cavity;};
float sf(vec3 p){return valueNoise3(p)*.57+valueNoise3(p*2.07+13.7)*.28+valueNoise3(p*4.11+27.2)*.15;}
vec4 scell(vec3 p){vec3 ip=floor(p),fp=fract(p);float md=100.;vec3 id=vec3(0);for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 off=vec3(x,y,z),ix=ip+off;vec3 v=off+hash33(ix)-fp;float d=dot(v,v);if(d<md){md=d;id=ix;}}return vec4(hash33(id+3.4),sqrt(md));}
StoneSample stoneFields(vec3 pos){
 vec3 seed=seedVector(uColorSeed,.071);vec3 p=pos*sSurface.x;
 vec3 q=p+vec3(sf(p*.8+seed),sf(p*.8+seed+7.),sf(p*.8+seed+19.))*.25;
 float broad=sf(q*1.35+seed),region=sf(q*3.2+seed+11.);
 float grain=valueNoise3(q*49.+seed),weather=sf(q*2.2+seedVector(uWeatherSeed,.09));
 float phase=q.y*5.7+q.x*.82+q.z*.41+sf(q*1.8+seed)*1.25;
 float bands=.5+.5*sin(phase*6.28318);
 float line=abs(sin((q.x*.84+q.y*.37+q.z*.51+sf(q*1.7+seed)*.44)*12.));
 float aa=max(fwidth(line),.008);
 float vein=(1.-smoothstep(.028,.064+aa,line))*smoothstep(.34,.63,region);
 float pits=pow(max(0.,(sf(q*19.+seedVector(uPoreSeed,.061))-.57)/.43),2.);
 vec4 crystal=scell(q*13.+seed);float mineral=0.;float h=0.;float rough=.75;vec3 col=vec3(.4);
 if(sKind==0){
  col=mix(vec3(.26,.31,.32),vec3(.57,.59,.55),smoothstep(.24,.73,broad));
  col=mix(col,vec3(.49,.40,.29),smoothstep(.57,.76,weather)*.65);
  mineral=vein*sSurface.y;col=mix(col,vec3(.83,.81,.70),mineral*.90);
  rough=mix(.79,.43,mineral);h=(broad-.5)*.018+(region-.5)*.007+vein*.004-pits*.025;
 }else if(sKind==1){
  float strata=sf(vec3(q.x*1.4,phase*1.8,q.z*1.4)+seed);
  col=mix(vec3(.34,.21,.13),vec3(.75,.58,.36),smoothstep(.24,.76,strata*.64+broad*.36));
  col=mix(col,vec3(.48,.27,.15),pow(bands,9.)*smoothstep(.30,.64,region)*.43);
  mineral=smoothstep(.80,.93,crystal.z)*sSurface.y;
  col=mix(col,vec3(.85,.76,.60),mineral*.46);rough=.87-mineral*.11;
  h=(strata-.5)*.015+sin(phase*6.28318)*.0025+(grain-.5)*.0007-pits*.011;
 }else if(sKind==2){
  float a=smoothstep(.28,.34,crystal.x),b=smoothstep(.62,.68,crystal.x);
  col=mix(vec3(.18,.20,.20),vec3(.67,.66,.59),a);
  col=mix(col,vec3(.73,.49,.41),b*.83);col*=.80+.29*region;
  mineral=(1.-a*.7)*sSurface.y;rough=mix(.66,.28,mineral);
  h=(crystal.y-.5)*.003+(broad-.5)*.009+(grain-.5)*.00035-pits*.007;
 }else{
  float cleavage=sf(vec3(q.x*1.8,phase*2.8,q.z*1.8)+seed);
  col=mix(vec3(.10,.15,.19),vec3(.30,.37,.40),smoothstep(.20,.78,cleavage*.58+broad*.42));
  col=mix(col,vec3(.47,.33,.20),smoothstep(.60,.77,weather)*.67);
  mineral=vein*sSurface.y;col=mix(col,vec3(.57,.61,.57),mineral*.51);
  rough=.48+cleavage*.17-mineral*.19;
  h=(cleavage-.5)*.009+(broad-.5)*.012+sin(phase*6.28318)*.0018-pits*.01;
 }
 float geomCavity=0.;for(int i=0;i<20;i++){if(i>=uEventCount)break;vec3 r=max(uEventSize[i].xyz,vec3(.001));float d=length((pos-uEventCenter[i].xyz)/r);float code=uEventCenter[i].w;if(code==6.||code==5.)geomCavity=max(geomCavity,1.-smoothstep(.35,1.2,d));}
 float cav=clamp(geomCavity*.55+pits*1.4,0.,1.);
 float wet=clamp(sSurface.z*(.18+.82*smoothstep(.32,.75,weather+cav*.25)),0.,1.);
 float lum=dot(col,vec3(.2126,.7152,.0722));col=mix(vec3(lum),col,sDisplay.w);
 vec3 linear=srgbToLinear(clamp(col,.025,.95));linear*=1.-wet*.38;
 StoneSample o;o.color=linear;o.height=h*sRelief;o.rough=clamp(mix(rough+sSurface.w,.17,wet),.12,.98);o.mineral=mineral;o.cavity=cav;return o;
}
