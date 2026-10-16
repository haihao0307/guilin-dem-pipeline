// STONE_STUDY same-page stoneFields, kind 0 (the stone receiver's default).
// KpSurface is supplied once by the shared brick core; do not redefine it here.
// No texture, mesh, voxel atlas, material cache or additional noise family.
// Authored unit bridge: a 0.42 m longest side maps to 3.4 specimen units.
const float KP_STONE_SCALE_M= 0.12352941176470589;
const int KP_STONE_KIND= 0;
const uint KP_STONE_MASTER_SEED= 8231u;
// Original normalizeSeedDNA offsets: color +401, pore +307, weather +601.
const float KP_STONE_COLOR_SEED= 8632.0;
const float KP_STONE_PORE_SEED= 8538.0;
const float KP_STONE_WEATHER_SEED= 8832.0;

vec3 st_hash33(vec3 pIn){
 vec3 p=fract(pIn*vec3(0.1031,0.1030,0.0973));
 p+=vec3(dot(p,p.yxz+vec3(33.33)));
 return fract((p.xxy+p.yxx)*p.zyx);
}
float st_valueNoise3(vec3 p){
 vec3 i=floor(p);vec3 f=fract(p);
 f=f*f*f*(f*(f*6.0-vec3(15.0))+vec3(10.0));
 return mix(mix(mix(st_hash33(i).x,st_hash33(i+vec3(1,0,0)).x,f.x),mix(st_hash33(i+vec3(0,1,0)).x,st_hash33(i+vec3(1,1,0)).x,f.x),f.y),mix(mix(st_hash33(i+vec3(0,0,1)).x,st_hash33(i+vec3(1,0,1)).x,f.x),mix(st_hash33(i+vec3(0,1,1)).x,st_hash33(i+vec3(1,1,1)).x,f.x),f.y),f.z);
}
vec3 st_seedVector(float seed,float salt){
 return st_hash33(vec3(seed*0.001,salt,seed*0.00013))*49.0;
}
vec3 st_srgbToLinear(vec3 c){
 return mix(c/12.92,pow((c+vec3(0.055))/1.055,vec3(2.4)),step(vec3(0.04045),c));
}
float st_sf(vec3 p){
 return st_valueNoise3(p)*0.57+st_valueNoise3(p*2.07+vec3(13.7))*0.28+st_valueNoise3(p*4.11+vec3(27.2))*0.15;
}
vec3 st_warp(vec3 p,vec3 seed){
 return p+vec3(st_sf(p*0.8+seed),st_sf(p*0.8+seed+vec3(7.0)),st_sf(p*0.8+seed+vec3(19.0)))*0.25;
}
float st_line(vec3 q,vec3 seed){
 return abs(sin((q.x*0.84+q.y*0.37+q.z*0.51+st_sf(q*1.7+seed)*0.44)*12.0));
}
// New explicit isotropic footprint bridge replacing screen-space fwidth(line).
// It reevaluates the ORIGINAL line and warp at three metric axis offsets.
// This bound-like footprint is not screen-space fwidth equivalence and is not
// complete band-limiting of the original noise; zero footprint keeps 0.008.
float st_lineAA(vec3 pos,vec3 seed,float line,float physicalFootprintM){
 float e=max(physicalFootprintM,0.0)/KP_STONE_SCALE_M;
 if(e==0.0){return 0.008;}
 float dx=abs(st_line(st_warp(pos+vec3(e,0,0),seed),seed)-line);
 float dy=abs(st_line(st_warp(pos+vec3(0,e,0),seed),seed)-line);
 float dz=abs(st_line(st_warp(pos+vec3(0,0,e),seed),seed)-line);
 return max(dx+dy+dz,0.008);
}
// Original kind-0 stoneFields arithmetic. Fixed original material controls:
// sSurface.x=1, sSurface.y=0.7, sDisplay.w=1, sRelief=1, uEventCount=0.
// Original event-loop contribution is therefore 0. Original pits still apply.
// Branches 1/2/3 and their inactive grain/phase/crystal evaluations are omitted.
KpSurface kpStoneOriginalSurface(vec3 pLocalM,float sourceWet,float roughBias,float physicalFootprintM){
 vec3 pos=pLocalM/KP_STONE_SCALE_M;
 vec3 seed=st_seedVector(KP_STONE_COLOR_SEED,0.071);
 vec3 q=st_warp(pos,seed);
 float broad=st_sf(q*1.35+seed);
 float region=st_sf(q*3.2+seed+vec3(11.0));
 float weather=st_sf(q*2.2+st_seedVector(KP_STONE_WEATHER_SEED,0.09));
 float line=st_line(q,seed);
 float aa=st_lineAA(pos,seed,line,physicalFootprintM);
 float vein=(1.0-smoothstep(0.028,0.064+aa,line))*smoothstep(0.34,0.63,region);
 float pits=pow(max(0.0,(st_sf(q*19.0+st_seedVector(KP_STONE_PORE_SEED,0.061))-0.57)/0.43),2.0);
 vec3 col=mix(vec3(0.26,0.31,0.32),vec3(0.57,0.59,0.55),smoothstep(0.24,0.73,broad));
 col=mix(col,vec3(0.49,0.40,0.29),smoothstep(0.57,0.76,weather)*0.65);
 float mineral=vein*0.7;
 col=mix(col,vec3(0.83,0.81,0.70),mineral*0.90);
 float rough=mix(0.79,0.43,mineral);
 float h=(broad-0.5)*0.018+(region-0.5)*0.007+vein*0.004-pits*0.025;
 float geomCavity=0.0;
 float cav=clamp(geomCavity*0.55+pits*1.4,0.0,1.0);
 float wet=clamp(sourceWet*(0.18+0.82*smoothstep(0.32,0.75,weather+cav*0.25)),0.0,1.0);
 float lum=dot(col,vec3(0.2126,0.7152,0.0722));
 col=mix(vec3(lum),col,1.0);
 vec3 linear=st_srgbToLinear(clamp(col,vec3(0.025),vec3(0.95)));
 linear*=1.0-wet*0.38;
 return KpSurface(h*KP_STONE_SCALE_M,linear,clamp(mix(rough+roughBias,0.17,wet),0.12,0.98));
}
// New, authored age/moisture/repair bridge copied from resolveStoneFabric.
// Its original default wear=0.15 is fixed because this call has no wear input.
// No calibrated decay law, damage geometry, formation events or SDF is ported.
// Age changes original wet/rough uniforms only; original height stays intact.
KpSurface kpStoneSurface(vec3 pLocalM,float age,float wet,float repair,float physicalFootprintM){
 float a=clamp(age,0.0,1.0);float r=clamp(repair,0.0,1.0);float m=clamp(wet,0.0,1.0);
 float retainedAge=a*(1.0-r);
 float sourceWet=clamp(m*(0.45+0.55*retainedAge)*(1.0-0.45*r),0.0,1.0);
 float roughBias=0.07*retainedAge+0.025*0.15-0.06*r;
 return kpStoneOriginalSurface(pLocalM,sourceWet,roughBias,physicalFootprintM);
}
