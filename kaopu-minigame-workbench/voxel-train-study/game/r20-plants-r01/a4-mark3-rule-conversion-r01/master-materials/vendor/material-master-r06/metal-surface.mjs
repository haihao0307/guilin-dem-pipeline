// R06: metre-valued coating edges and one causal corrosion microstructure.
// Original FH88 mt_kh/mt_kn/mt_kfb algebra is retained verbatim from R05.
export const METAL_FIELDS=String.raw`
varying vec3 vRestM;varying vec3 vSurfaceN;
uniform float uWear,uHistory,uWet,uRepair,uMode,uVariant,uRack;
uniform vec3 uJoints[16];uniform int uJointCount;
float mt_kh(vec3 p){p=fract(p*.1031);p+=vec3(dot(p,p.yzx+vec3(33.33)));return fract((p.x+p.y)*p.z);}
float mt_kn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(vec3(3.)-2.*f);return mix(mix(mix(mt_kh(i),mt_kh(i+vec3(1,0,0)),f.x),mix(mt_kh(i+vec3(0,1,0)),mt_kh(i+vec3(1,1,0)),f.x),f.y),mix(mix(mt_kh(i+vec3(0,0,1)),mt_kh(i+vec3(1,0,1)),f.x),mix(mt_kh(i+vec3(0,1,1)),mt_kh(i+vec3(1,1,1)),f.x),f.y),f.z);}
float mt_kfb(vec3 p){return .57*mt_kn(p)+.28*mt_kn(p*2.13)+.15*mt_kn(p*4.17);}

// Value + analytic gradient of the SAME cubic lattice interpolation. The
// gradient converts a dimensionless threshold into a local surface distance;
// no screen derivative of a derivative is needed to derive the height field.
vec4 mt_knvg(vec3 p){
 vec3 i=floor(p),f=fract(p),u=f*f*(3.-2.*f),du=6.*f*(1.-f);
 float a=mt_kh(i),b=mt_kh(i+vec3(1,0,0)),c=mt_kh(i+vec3(0,1,0)),d=mt_kh(i+vec3(1,1,0));
 float e=mt_kh(i+vec3(0,0,1)),f1=mt_kh(i+vec3(1,0,1)),g=mt_kh(i+vec3(0,1,1)),h=mt_kh(i+vec3(1,1,1));
 float k1=b-a,k2=c-a,k3=e-a,k4=a-b-c+d,k5=a-c-e+g,k6=a-b-e+f1,k7=-a+b+c-d+e-f1-g+h;
 float value=a+k1*u.x+k2*u.y+k3*u.z+k4*u.x*u.y+k5*u.y*u.z+k6*u.z*u.x+k7*u.x*u.y*u.z;
 vec3 grad=du*vec3(k1+k4*u.y+k6*u.z+k7*u.y*u.z,k2+k4*u.x+k5*u.z+k7*u.x*u.z,k3+k5*u.y+k6*u.x+k7*u.x*u.y);
 return vec4(value,grad);
}
vec4 mt_kfbvg(vec3 p){vec4 a=mt_knvg(p),b=mt_knvg(p*2.13),c=mt_knvg(p*4.17);return vec4(.57*a.x+.28*b.x+.15*c.x,.57*a.yzw+.28*2.13*b.yzw+.15*4.17*c.yzw);}
float mt_aa(float edge,float value,float width){return smoothstep(edge-width,edge+width,value);}
float mt_resolved(float frequency,float fp){return 1.-smoothstep(.30,.95,frequency*fp);}

struct MetalSurface{vec3 color;float rough;float metal;float height;float damage;vec3 layers;vec3 coverageDiffuse;vec3 coverageF0;};
MetalSurface metalField(vec3 p,float fp){
 float wear=clamp(uWear*uVariant,0.,1.),history=clamp(uHistory*uVariant,0.,1.),wet=clamp(uWet*uVariant,0.,1.);
 float joint=0.,drip=0.;vec3 jointGrad=vec3(0.),dripGrad=vec3(0.);
 for(int i=0;i<16;i++){
  if(i>=uJointCount)break;vec3 q=p-uJoints[i];
  float j=exp(-dot(q,q)/.012);if(j>joint){joint=j;jointGrad=-2.*q*j/.012;}
  // Runoff exists only downstream of actual connection origins; 40 mm feed
  // width and 550 mm decay are spatial controls, not simulated hydrology.
  if(q.y<=0.){float t=clamp(-q.y/.012,0.,1.),onset=t*t*(3.-2.*t),base=exp(-dot(q.xz,q.xz)/.0016+q.y/.55),r=base*onset;if(r>drip){drip=r;dripGrad=base*vec3(-2.*q.x*onset/.0016,onset/.55-6.*t*(1.-t)/.012,-2.*q.z*onset/.0016);}}
 }
 vec4 wx=mt_knvg(p*3.7+vec3(7,2,4)),wy=mt_knvg(p*4.3+vec3(1,8,3)),wz=mt_knvg(p*3.1+vec3(6,1,9));
 vec3 warp=vec3(wx.x,wy.x,wz.x)-.5;
 vec4 macro=mt_kfbvg(p*13.+warp*2.8+vec3(2.7,8.4,1.2));
 vec3 grad=13.*macro.yzw+2.8*(macro.y*3.7*wx.yzw+macro.z*4.3*wy.yzw+macro.w*3.1*wz.yzw)+.19*jointGrad+.035*dripGrad;
 vec3 surfaceN=normalize(vSurfaceN);grad-=surfaceN*dot(grad,surfaceN);
 float potential=macro.x+.19*joint+.035*drip,threshold=1.02-.50*wear;
 // Local first-order signed distance in METRES. Fine perturbations also have
 // metre amplitudes; they do not multiply the macro scalar's arbitrary slope.
 float distanceM=(potential-threshold)/max(length(grad),.65);
 distanceM+=(mt_kn(p*137.)-.5)*.0012*mt_resolved(137.,fp)+(mt_kn(p*517.)-.5)*.00032*mt_resolved(517.,fp);
 float aa=max(.55*fp,.000008),damageActive=smoothstep(.01,.05,wear);
 float loss=mt_aa(0.,distanceM,aa)*damageActive;
 float intact=1.-loss;
 float meso=mt_kfb(p*63.+warp*1.4+vec3(4,13,7));
 float fineGate=mt_resolved(490.,fp),micro=mix(.5,mt_kn(p*490.+vec3(11.)),fineGate);
 float granule=mix(.5,mt_kn(p*218.+warp*2.),mt_resolved(218.,fp));
 // Vertical coating thickness and the transverse peel extent are independent.
 // Primer survives only in interrupted adhesion pockets, never a full outline.
 float peelExtentM=mix(.00018,.0011,mt_kn(p*37.+vec3(9,2,5)));
 float adhesion=mt_kn(p*43.+vec3(17,3,6))-.16*history-.16*joint;
 float primerGate=mt_aa(.54,adhesion,max(.008,fp*43.*.32));
 float primer=loss*(1.-mt_aa(peelExtentM,distanceM,aa))*primerGate;
 float exposed=max(loss-primer,0.);
 float interior=smoothstep(0.,.018,max(distanceM,0.));
 float retention=clamp(.16+.46*joint+.30*drip+.12*max(surfaceN.y,0.)+.14*meso,0.,1.);
 float age=history*(.70+.30*interior);
 // Shared corrosion driver: exposure duration proxy, retained moisture at
 // connections/runoff, and sub-mm-to-mm nucleation sites within exposure.
 float dose=.76*age+.28*joint+.18*drip+.16*retention;
 float reactive=dose+.22*(meso-.5)+.09*(granule-.5);
 float oxideClass=mt_aa(.40,reactive,max(.004,fp*9.));
 float oxide=exposed*oxideClass,bare=max(exposed-oxide,0.);
 float maturity=clamp((dose-.16)*1.35+.20*(meso-.5),0.,1.);
 float compact=clamp(.28+.54*maturity+.22*drip-.24*(granule-.5),0.,1.);
 float porous=clamp(.20+.80*granule-.27*compact,0.,1.);
 float pitSeed=mt_aa(.59,mt_kn(p*284.+warp*2.6+vec3(7,3,19)),max(.025,fp*284.*.20));
 float pits=exposed*(.25+.75*maturity)*pitSeed*(.35+.65*meso)*mt_resolved(284.,fp);
 float stain=history*drip*(.12+.88*exposed);
 vec3 coat=vec3(.085,.12,.105),undercoat=vec3(.17,.087,.040),steel=vec3(.30,.32,.31);
 // The oxide palette follows the same compaction/maturity and pore coverage
 // that control relief and roughness. No independent RGB noise patches.
 vec3 freshOxide=vec3(.19,.060,.020),denseOxide=vec3(.065,.022,.009);
 vec3 rust=mix(freshOxide,denseOxide,compact);
 rust*=1.-.22*porous-.16*pitSeed;
 vec3 color=coat*intact+undercoat*primer+steel*bare+rust*oxide;
 vec3 coverageDiffuse=coat*intact+undercoat*primer+rust*oxide;
 vec3 coverageF0=steel*bare+vec3(.04)*(intact+primer+oxide);
 float metal=bare;
 float rough=.43*intact+.72*primer+(.35+.18*pits)*bare+(.78+.17*porous+.045*(1.-fineGate))*oxide;
 float coatThicknessM=.00014,primerThicknessM=.000055;
 float oxideHeightM=.000035+.00022*porous*(.35+.65*maturity);
 float height=coatThicknessM*intact+primerThicknessM*primer-.00036*pits+oxideHeightM*oxide;
 if(uRack>.5){
  // Zinc remains a metal. White corrosion develops on retained zinc where
  // moisture is retained, rather than being defined as a ring around steel.
  float remainingZinc=1.-exposed;
  float whitePotential=history*(.24+.62*retention)+.16*meso+.10*joint;
  float whiteClass=mt_aa(.45,whitePotential,max(.006,fp*12.));
  float white=remainingZinc*whiteClass,zinc=max(remainingZinc-white,0.);
  vec3 zincColor=vec3(.48,.50,.49)*(1.-.06*(meso-.5));
  vec3 zincOxide=vec3(.38,.39,.36)*(1.-.18*porous);
  color=zincColor*zinc+zincOxide*white+steel*bare+rust*oxide;
  coverageDiffuse=zincOxide*white+rust*oxide;
  coverageF0=zincColor*zinc+steel*bare+vec3(.04)*(white+oxide);
  metal=zinc+bare;rough=(.31+.045*meso)*zinc+(.73+.18*porous)*white+(.37+.16*pits)*bare+(.80+.15*porous)*oxide;
  height=.00008*zinc+(.00010+.00009*porous)*white-.00036*pits+oxideHeightM*oxide;
  intact=zinc;primer=white;
 }
 // Resolved grains share the corrosion driver; unresolved energy is represented
 // by roughness above, instead of a persistent high-frequency normal pattern.
 height+=(micro-.5)*(.000012*(1.-exposed)+.000065*oxide*(.4+.6*porous));
 // Stain/wet darkening attenuates dielectric diffuse only. Bare conductor F0
 // remains unchanged; a water dielectric overlayer is NOT being simulated.
 coverageDiffuse*=(1.-stain*.24)*(1.-wet*.14);
 color=coverageDiffuse+coverageF0-vec3(.04)*(1.-metal);
 rough=mix(clamp(rough+.10*stain,.16,.98),.22,wet);
 return MetalSurface(color,rough,clamp(metal,0.,1.),height,loss,vec3(intact,primer,exposed),coverageDiffuse,coverageF0);
}
`;
export function makeMetalMaterial(T,{family,variant,origin,state,jointOrigins=[]}){
 const uniforms={uWear:{value:state.wear},uHistory:{value:state.history},uWet:{value:state.wet},uRepair:{value:state.repair},uMode:{value:state.mode},uVariant:{value:variant},uRack:{value:family==='rack'?1:0},uOrigin:{value:new T.Vector3(...origin)},uJoints:{value:Array.from({length:16},(_,i)=>new T.Vector3(...(jointOrigins[i]||[0,0,0])))},uJointCount:{value:Math.min(jointOrigins.length,16)}};
 const m=new T.MeshStandardMaterial({color:0xffffff,roughness:.5});m.userData.uniforms=uniforms;m.userData.update=s=>{for(const[k,v]of Object.entries(s)){const name='u'+k[0].toUpperCase()+k.slice(1);if(uniforms[name])uniforms[name].value=v;}};
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms);s.vertexShader='uniform vec3 uOrigin;varying vec3 vRestM;varying vec3 vSurfaceN;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRestM=(modelMatrix*vec4(position,1.)).xyz-uOrigin;vSurfaceN=normalize(mat3(modelMatrix)*normal);');s.fragmentShader=METAL_FIELDS+s.fragmentShader;
 s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat fp=max(length(dFdx(vRestM)),length(dFdy(vRestM)));MetalSurface ms=metalField(vRestM,fp);diffuseColor.rgb=ms.color;');
 s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=ms.rough;').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=ms.metal;');
 s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\nmaterial.diffuseColor=ms.coverageDiffuse;material.specularColor=ms.coverageF0;');
 s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nvec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition),r1=cross(dy,normal),r2=cross(normal,dx);float det=dot(dx,r1);normal=normalize(abs(det)*normal-sign(det)*(dFdx(ms.height)*r1+dFdy(ms.height)*r2));');
 s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','if(uMode>.5&&uMode<1.5)outgoingLight=vec3(clamp(.5+ms.height*650.,0.,1.));if(uMode>1.5&&uMode<2.5)outgoingLight=vec3(ms.rough);if(uMode>2.5&&uMode<3.5)outgoingLight=vec3(ms.damage);if(uMode>3.5&&uMode<4.5)outgoingLight=ms.layers;if(uMode>4.5)outgoingLight=normal*.5+.5;\n#include <opaque_fragment>');};m.customProgramCacheKey=()=>`metal-layer-r06-a-${family}-${variant}`;return m;
}
