import {ROAD_FIELD_GLSL} from './road-field.mjs';

// Mechanical GLSL preservation of the frozen KST1 ST_FAMILY 8 concrete closure.
// Frequencies .63 / 3.7 / 127, original noise, optical colours and metric heights remain.
export const ROAD_KST1_MOTHER_GLSL=String.raw`
float mt_kh(vec3 p){p=fract(p*.1031);p+=vec3(dot(p,p.yzx+vec3(33.33)));return fract((p.x+p.y)*p.z);}
float mt_kn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(vec3(3.)-2.*f);return mix(mix(mix(mt_kh(i),mt_kh(i+vec3(1,0,0)),f.x),mix(mt_kh(i+vec3(0,1,0)),mt_kh(i+vec3(1,1,0)),f.x),f.y),mix(mix(mt_kh(i+vec3(0,0,1)),mt_kh(i+vec3(1,0,1)),f.x),mix(mt_kh(i+vec3(0,1,1)),mt_kh(i+vec3(1,1,1)),f.x),f.y),f.z);}
struct RoadMother{vec3 color;float rough;float height;};
RoadMother roadConcreteMother(vec3 p,float age,float wetness,float repair,float footprint){
 vec3 q=p+vec3(19.,19.*.71,19.*.37);float large=mt_kn(q*.63),meso=mt_kn(q*3.7),fine=.5;if(footprint<.021)fine=mix(mt_kn(q*127.),.5,smoothstep(.003,.021,footprint));
 float moisturePatch=smoothstep(.43,.72,large)*smoothstep(.28,.62,meso),fresh=repair,damp=clamp(moisturePatch*(.42+large*.58)*(1.-fresh*.85),0.,1.);float wet=wetness*clamp(damp+smoothstep(.60,.81,large)*.38+.22,0.,1.);
 vec3 base=vec3(.468,.451,.381);float gray=moisturePatch*age*.18*(1.-fresh);vec3 color=mix(base,base*.69+vec3(.027,.030,.025),gray);float chip=smoothstep(.64,.81,mt_kn(q*23.))*smoothstep(.46,.76,meso)*age;
 color=mix(color,base*vec3(.59,.56,.49),chip*.42);color=mix(color,base*vec3(.50,.56,.50),damp*age*.72);color=mix(color,mix(base,vec3(.80,.78,.69),.17),fresh*.85);color*=1.-wet*.13;
 return RoadMother(color,clamp(.87+(fine-.5)*.07-wet*.23,.23,1.),(fine-.5)*.00042-chip*.0007);
}
`;
export const ROAD_MATERIAL_GLSL=String.raw`
varying vec3 vRoadRest;varying float vRoadMacro,vRoadFace;varying vec3 vRoadObjectN;
struct RoadStone{float stone;float id;float crown;};
RoadStone roadStone(vec2 p,float fp){
 float scale=uRoadFamily>.5?.016:.012;vec2 q=p/scale;ivec2 ij=ivec2(floor(q));float best=1e6,id=0.,radius=.3;
 // Randomly oriented irregular angular sections with a broad size distribution.
 // Compare surfaces, not centre distances, so large and small grains coexist.
 for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){ivec2 k=ij+ivec2(i,j);float rnd=roadHash(k,uRoadSeed+41);vec2 c=vec2(k)+.12+.76*vec2(rnd,roadHash(k,uRoadSeed+42));vec2 d=q-c;float angle=6.2831853*roadHash(k,uRoadSeed+44),ca=cos(angle),sa=sin(angle);d=mat2(ca,-sa,sa,ca)*d;d*=vec2(.72+.7*roadHash(k,uRoadSeed+45),.8+.65*roadHash(k,uRoadSeed+46));float r=.10+.48*pow(roadHash(k,uRoadSeed+43),1.65);float facet=max(abs(d.x),max(abs(dot(d,vec2(.42,.91))),abs(dot(d,vec2(-.64,.77)))));float sd=facet-r;if(sd<best){best=sd;id=rnd;radius=r;}}
 float aa=max(fp/scale*.55,.012),pebble=1.-smoothstep(-aa,aa,best);float crown=clamp(-best/max(radius,.08),0.,1.);float resolved=1.-smoothstep(.003,.014,fp);
 return RoadStone(mix(.32,pebble,resolved),id,crown*resolved);
}
// One 3D aggregate volume is cut by every receiver face. No independent side decal.
RoadStone roadVolumeStone(vec3 p,float fp){
 float cell=.029;vec3 q=(p+vec3(.019,.007,.031))/cell,base=floor(q);float best=1e6,id=0.,radius=.3;
 for(int z=0;z<2;z++)for(int y=0;y<2;y++)for(int x=0;x<2;x++){
  vec3 k=base+vec3(float(x),float(y),float(z));float h=mt_kh(k+vec3(float(uRoadSeed)+71.));
  vec3 c=k+(vec3(mt_kh(k+17.),mt_kh(k+33.),mt_kh(k+59.))-.5)*.18;
  vec3 d=q-c;float angle=h*6.2831853;d.xz=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*d.xz;
  d*=vec3(.83+.55*mt_kh(k+43.),.78+.50*mt_kh(k+46.),.83+.50*mt_kh(k+49.));
  float r=.115+.41*pow(mt_kh(k+61.),.72);
  float fac=max(max(abs(d.x),abs(d.y)),max(abs(d.z),abs(dot(d,normalize(vec3(.62,.76,.46))))));
  float sd=fac-r;if(sd<best){best=sd;id=h;radius=r;}
 }
 float aa=max(fp/cell*.55,.008),coverage=1.-smoothstep(-aa,aa,best),gate=1.-smoothstep(.004,.022,fp);
 return RoadStone(mix(.31,coverage,gate),id,clamp(-best/max(radius,.1),0.,1.)*gate);
}
vec2 roadSurfaceUV(vec3 p){vec3 n=abs(vRoadObjectN);if(vRoadFace>.5)return p.xz;if(n.x>n.z)return p.zy;return p.xy;}
float roadFineHeight(vec3 p,float fp,RoadDamage damage){
 vec2 uv=roadSurfaceUV(p);bool concrete=uRoadFamily>.5;RoadStone stone=roadStone(uv,fp);if(concrete)stone=roadVolumeStone(p,fp);
 float top=step(.5,vRoadFace);float exposure=concrete?mix(.9,.12+.78*damage.exposure,top):(.25+.48*damage.exposure);
 float h=(stone.crown-.24)*(concrete?.0015:.0013)*exposure;
 if(concrete){
  float pore=smoothstep(.76,.91,mt_kn(p*810.))*smoothstep(.40,.71,mt_kn(p*117.));
  float matrix=1.-stone.stone*exposure;
  float matrixLoss=(.00016+.00085*damage.exposure)*matrix;
  h-=matrixLoss+pore*.00065*matrix*(1.-smoothstep(.0008,.003,fp));
  // Mineral fracture texture belongs inside aggregate, not a stamped color circle.
  h+=(mt_kn(p*620.+vec3(stone.id*19.))-.5)*.00038*stone.stone*exposure*(1.-smoothstep(.001,.004,fp));
 }
 if(concrete)h+=roadConcreteMother(p,uRoadWear*uRoadVariant,0.,damage.repairMask,fp).height;
 float fines=(roadNoise(uv*440.,uRoadSeed+49)-.5)*(1.-smoothstep(.0009,.004,fp));
 return h+fines*(concrete?.00009:.00016);
}
// Metric finite-difference spacing: 0.7 mm at close range, widened with pixel footprint.
// This avoids treating one arbitrary screen-pixel sample as the intrinsic microgradient.
vec2 roadFineGradient(vec3 p,float fp,RoadDamage damage,float h){
 float ds=max(.0007,min(.003,fp*.5));vec3 tx=vec3(1,0,0),tz=vec3(0,0,1);
 if(vRoadFace<.5){if(abs(vRoadObjectN.x)>abs(vRoadObjectN.z)){tx=vec3(0,0,1);tz=vec3(0,1,0);}else{tx=vec3(1,0,0);tz=vec3(0,1,0);}}
 return vec2(roadFineHeight(p+tx*ds,fp,damage)-h,roadFineHeight(p+tz*ds,fp,damage)-h)/ds;
}
struct RoadClosure{vec3 color;float rough;float residual;float macro;vec3 damage;vec3 layers;vec2 fineGradient;};
RoadClosure roadClosure(vec3 p,float fp){
 bool concrete=uRoadFamily>.5;float wear=uRoadWear*uRoadVariant,history=uRoadHistory*uRoadVariant,wet=uRoadWet*uRoadVariant;
 RoadPotential potential=roadPotential(p.xz);RoadDamage damage=roadDamage(potential);vec2 uv=roadSurfaceUV(p);RoadStone stone=roadStone(uv,fp);if(concrete)stone=roadVolumeStone(p,fp);
 float top=step(.5,vRoadFace);float depth=uRoadTopY-p.y;float sectionCrack=(1.-smoothstep(damage.depth*.5,damage.depth+.018,depth))*(1.-top);
 float fractureAA=max(fwidth(potential.distance),.00005);float fractureFiltered=1.-smoothstep(potential.halfWidth-fractureAA,potential.halfWidth+fractureAA,potential.distance);
 float fracture=damage.core;fracture=mix(fracture,fractureFiltered*smoothstep(.025,.44,wear*potential.activity)*(1.-damage.repairMask),smoothstep(.002,.009,fp));fracture*=top+sectionCrack;
 float exposure=concrete?(.07+.83*damage.exposure):(.25+.48*damage.exposure);exposure=mix(concrete?.93:.60,exposure,top);
 RoadMother mother=roadConcreteMother(p,wear,0.,damage.repairMask,fp);
 vec3 binder=concrete?mother.color:vec3(.027,.030,.032)*( .94+.12*potential.stress );
 vec3 aggregate=concrete?mix(vec3(.26,.27,.25),vec3(.48,.46,.40),smoothstep(.08,.94,stone.id)):vec3(.060,.064,.062);
 if(concrete){aggregate*=.90+.20*stone.id;aggregate*=.95+.10*mt_kn(p*690.+vec3(stone.id*17.));}else{aggregate*=.80+.34*stone.id;aggregate*=.94+.12*roadNoise(uv*690.,uRoadSeed+57);}
 if(concrete){float matrixAge=history*(.32+.68*potential.stress)*(1.-damage.repairMask);binder*=1.-matrixAge*.12;}

 vec3 col=mix(binder,aggregate,stone.stone*exposure);
 // Cut section exposes the same aggregate/paste or binder, not a decorative separate noise map.
 if(!concrete){float baseCourse=1.-smoothstep(.041,.047,depth);col=mix(col*vec3(1.2,1.14,1.02),col,baseCourse);}
 col=mix(col,concrete?vec3(.075,.079,.069):vec3(.010,.013,.014),fracture*.77);
 float lane=exp(-pow((p.x+.68)/.26,2.));float traffic=lane*history*(.35+.65*potential.stress)*top;
 col*=1.-traffic*(concrete?.21:.14);
 float paintWidth=.12,paintD=abs(p.x-.62)-paintWidth*.5;float aa=max(fwidth(p.x),.0001);
 float dash=1.-smoothstep(1.76-fp,1.80+fp,mod(p.z+2.4,3.0));
 float paint=(1.-smoothstep(-aa,aa,paintD))*dash*top*uRoadMarkings;
 paint*=clamp(1.-damage.collar*.95-damage.edge*.9-wear*.3*(1.-stone.stone),0.,1.);paint*=1.-damage.repairMask;
 col=mix(col,vec3(.74,.75,.71),paint);
 float rough=concrete?mother.rough:.84;rough+=stone.stone*(concrete?-.08:.05)+damage.exposure*.065-traffic*.13;rough=mix(rough,.61,paint);
 // Present water changes optical response only; fracture/history never depend on wetness.
 float retention=clamp(.64+damage.collar*.36+potential.stress*.16,0.,1.);float film=wet*retention;
 col*=1.-film*(concrete?.17:.28);rough=mix(rough,.205,film);
 float fineHeight=roadFineHeight(p,fp,damage);vec2 fineGradient=roadFineGradient(p,fp,damage,fineHeight);
 float residual=(damage.macro-vRoadMacro)*top+paint*.00027;
 return RoadClosure(col,clamp(rough,.18,.98),residual,damage.macro,vec3(damage.core,damage.edge,damage.repairMask),vec3(exposure*stone.stone,paint,1.-exposure*stone.stone),fineGradient);
}
`;
export function makeRoadMaterial(T,state){
 const material=new T.MeshStandardMaterial({color:0xffffff,roughness:.86,metalness:0});
 material.name=`R06 ${state.family} causal surface`;const shaders=[];
 function uniforms(s){s.uniforms.uRoadWear={value:state.wear};s.uniforms.uRoadHistory={value:state.history};s.uniforms.uRoadWet={value:state.wetness};s.uniforms.uRoadRepair={value:state.repair};s.uniforms.uRoadVariant={value:state.variant};s.uniforms.uRoadMode={value:state.mode};s.uniforms.uRoadFamily={value:state.family==='concrete'?1:0};s.uniforms.uRoadMarkings={value:state.markings?1:0};s.uniforms.uRoadSize={value:new T.Vector2(state.width,state.length)};s.uniforms.uRoadSeed={value:state.seed};s.uniforms.uRoadTopY={value:state.topY};}
 material.onBeforeCompile=s=>{
  uniforms(s);shaders.push(s);
  s.vertexShader='attribute vec3 roadRest;attribute float roadMacro;attribute float roadFace;varying vec3 vRoadRest;varying float vRoadMacro,vRoadFace;varying vec3 vRoadObjectN;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRoadRest=roadRest;vRoadMacro=roadMacro;vRoadFace=roadFace;vRoadObjectN=normal;');
  s.fragmentShader=ROAD_FIELD_GLSL+ROAD_KST1_MOTHER_GLSL+ROAD_MATERIAL_GLSL+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat roadFP=max(length(dFdx(vRoadRest)),length(dFdy(vRoadRest)));RoadClosure roadS=roadClosure(vRoadRest,roadFP);diffuseColor.rgb=roadS.color;');
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=roadS.rough;');
  // Screen-space derivative of residual: coarse geometric height is subtracted, so relief is not doubled.
  // Grain bands fade at metric pixel footprints above their resolvable wavelengths.
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nvec3 roadDX=dFdx(-vViewPosition),roadDY=dFdy(-vViewPosition),roadR1=cross(roadDY,normal),roadR2=cross(normal,roadDX);float roadDet=dot(roadDX,roadR1);normal=normalize(abs(roadDet)*normal-sign(roadDet)*((dFdx(roadS.residual)+dot(roadS.fineGradient,dFdx(roadSurfaceUV(vRoadRest))))*roadR1+(dFdy(roadS.residual)+dot(roadS.fineGradient,dFdy(roadSurfaceUV(vRoadRest))))*roadR2));');
  s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','if(uRoadMode>.5&&uRoadMode<1.5)outgoingLight=vec3(clamp(.62+roadS.macro*22.,0.,1.));else if(uRoadMode>1.5&&uRoadMode<2.5)outgoingLight=vec3(roadS.rough);else if(uRoadMode>2.5&&uRoadMode<3.5)outgoingLight=roadS.damage;else if(uRoadMode>3.5&&uRoadMode<4.5)outgoingLight=roadS.layers;else if(uRoadMode>4.5)outgoingLight=normal*.5+.5;\n#include <opaque_fragment>');
 };
 material.customProgramCacheKey=()=>`r06-road-volume-1-${state.family}`;
 material.userData.update=()=>{for(const s of shaders){const v=s.uniforms;v.uRoadWear.value=state.wear;v.uRoadHistory.value=state.history;v.uRoadWet.value=state.wetness;v.uRoadRepair.value=state.repair;v.uRoadVariant.value=state.variant;v.uRoadMode.value=state.mode;v.uRoadMarkings.value=state.markings?1:0;}};
 material.userData.shaders=shaders;
 return material;
}
