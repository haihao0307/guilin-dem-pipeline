// STONE_STUDY original sKind == 3 (blue-gray slate) surface branch.
// Append AFTER existing KP_STONE_WGSL; reuse its st_* source functions/seeds.
// Receiver controls below are explicit design bindings, NOT physical calibration.
// Original event count remains 0, matching the current surface-only port.
struct KpStoneSlateParams {
 float sourceScaleM; float materialScale; float mineral; float chroma; float relief;
};
KpStoneSlateParams kpStoneSlateDefaultParams(){
 return KpStoneSlateParams(KP_STONE_SCALE_M,1.0,0.7,1.0,1.0);
}
KpSurface kpStoneSlateOriginalSurface(vec3 pLocalM,KpStoneSlateParams params,float sourceWet,float roughBias,float physicalFootprintM){
 vec3 pos=pLocalM/params.sourceScaleM;
 vec3 seed=st_seedVector(KP_STONE_COLOR_SEED,0.071);
 vec3 p=pos*params.materialScale;
 vec3 q=st_warp(p,seed);
 float broad=st_sf(q*1.35+seed);
 float region=st_sf(q*3.2+seed+vec3(11.0));
 float weather=st_sf(q*2.2+st_seedVector(KP_STONE_WEATHER_SEED,0.09));
 float phase=q.y*5.7+q.x*0.82+q.z*0.41+st_sf(q*1.8+seed)*1.25;
 float line=st_line(q,seed);
 // Existing helper converts its input by KP_STONE_SCALE_M. Undo that fixed
 // scale here, then provide THIS receiver's explicit source + texture scale.
 // physicalFootprintM == 0 retains exactly the source's intrinsic aa floor.
 float aa=st_lineAA(p,seed,line,physicalFootprintM*KP_STONE_SCALE_M*params.materialScale/params.sourceScaleM);
 float vein=(1.0-smoothstep(0.028,0.064+aa,line))*smoothstep(0.34,0.63,region);
 float pits=pow(max(0.0,(st_sf(q*19.0+st_seedVector(KP_STONE_PORE_SEED,0.061))-0.57)/0.43),2.0);
 // Exact source kind-3 arithmetic; grain/crystal/bands are inactive here.
 float cleavage=st_sf(vec3(q.x*1.8,phase*2.8,q.z*1.8)+seed);
 vec3 col=mix(vec3(0.10,0.15,0.19),vec3(0.30,0.37,0.40),smoothstep(0.20,0.78,cleavage*0.58+broad*0.42));
 col=mix(col,vec3(0.47,0.33,0.20),smoothstep(0.60,0.77,weather)*0.67);
 float mineral=vein*params.mineral;
 col=mix(col,vec3(0.57,0.61,0.57),mineral*0.51);
 float rough=0.48+cleavage*0.17-mineral*0.19;
 float h=(cleavage-0.5)*0.009+(broad-0.5)*0.012+sin(phase*6.28318)*0.0018-pits*0.01;
 float geomCavity=0.0;
 float cav=clamp(geomCavity*0.55+pits*1.4,0.0,1.0);
 float wet=clamp(sourceWet*(0.18+0.82*smoothstep(0.32,0.75,weather+cav*0.25)),0.0,1.0);
 float lum=dot(col,vec3(0.2126,0.7152,0.0722));
 col=mix(vec3(lum),col,params.chroma);
 vec3 linear=st_srgbToLinear(clamp(col,vec3(0.025),vec3(0.95)));
 linear*=1.0-wet*0.38;
 return KpSurface(h*params.relief*params.sourceScaleM,linear,clamp(mix(rough+roughBias,0.17,wet),0.12,0.98));
}
// Same existing authored age/moisture/repair bridge; only source branch differs.
KpSurface kpStoneSlateSurface(vec3 pLocalM,KpStoneSlateParams params,float age,float wet,float repair,float physicalFootprintM){
 float a=clamp(age,0.0,1.0);float r=clamp(repair,0.0,1.0);float m=clamp(wet,0.0,1.0);
 float retainedAge=a*(1.0-r);
 float sourceWet=clamp(m*(0.45+0.55*retainedAge)*(1.0-0.45*r),0.0,1.0);
 float roughBias=0.07*retainedAge+0.025*0.15-0.06*r;
 return kpStoneSlateOriginalSurface(pLocalM,params,sourceWet,roughBias,physicalFootprintM);
}
