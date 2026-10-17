// FH88 mt_kh/mt_kn/mt_kfb algebra retained from R03. New R05 causal coating stack.
export const METAL_FIELDS=String.raw`
varying vec3 vRestM;varying vec3 vSurfaceN;
uniform float uWear,uHistory,uWet,uRepair,uMode,uVariant,uRack;
uniform vec3 uJoints[16];uniform int uJointCount;
float mt_kh(vec3 p){p=fract(p*.1031);p+=vec3(dot(p,p.yzx+vec3(33.33)));return fract((p.x+p.y)*p.z);}
float mt_kn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(vec3(3.)-2.*f);return mix(mix(mix(mt_kh(i),mt_kh(i+vec3(1,0,0)),f.x),mix(mt_kh(i+vec3(0,1,0)),mt_kh(i+vec3(1,1,0)),f.x),f.y),mix(mix(mt_kh(i+vec3(0,0,1)),mt_kh(i+vec3(1,0,1)),f.x),mix(mt_kh(i+vec3(0,1,1)),mt_kh(i+vec3(1,1,1)),f.x),f.y),f.z);}
float mt_kfb(vec3 p){return .57*mt_kn(p)+.28*mt_kn(p*2.13)+.15*mt_kn(p*4.17);}

struct MetalSurface{vec3 color;float rough;float metal;float height;float damage;vec3 layers;};
MetalSurface metalField(vec3 p,float fp){
 float wear=uWear*uVariant,history=uHistory*uVariant,wet=uWet*uVariant;
 float joint=0.,drip=0.;
 for(int i=0;i<16;i++){if(i>=uJointCount)break;vec3 q=p-uJoints[i];joint=max(joint,exp(-dot(q,q)/.012));float down=-q.y;float feed=exp(-dot(q.xz,q.xz)/.0016);drip=max(drip,feed*exp(-max(down,0.)/.55)*step(0.,down));}
 vec3 warp=vec3(mt_kn(p*3.7+vec3(7,2,4)),mt_kn(p*4.3+vec3(1,8,3)),mt_kn(p*3.1+vec3(6,1,9)))-.5;
 float field=mt_kfb(p*13.+warp*2.8+vec3(2.7,8.4,1.2));
 float scar=1.-smoothstep(.025,.105,abs(mt_kn(p*vec3(31.,4.,19.)+warp)-.52));
 float edgeGrain=(mt_kn(p*137.)-.5)*.075+(mt_kn(p*517.)-.5)*.025;
 float drive=field+.19*joint+.055*scar+edgeGrain;
 float threshold=1.02-.50*wear;
 float damageActive=smoothstep(.01,.05,wear);
 float loss=smoothstep(threshold-.004,threshold+.004,drive)*damageActive;
 float exposed=smoothstep(threshold+.012,threshold+.020,drive)*damageActive;
 float intact=1.-loss,primer=max(loss-exposed,0.);
 float oxidation=smoothstep(.52-.20*history,.68-.20*history,mt_kn(p*91.+vec3(11,3,7))+.26*joint);
 float oxide=exposed*oxidation;
 float bare=max(exposed-oxide,0.);
 float macroPit=smoothstep(.59,.84,mt_kn(p*78.+warp))*exposed;
 float micro=mt_kn(p*490.+vec3(11.));float fineGate=1.-smoothstep(.0007,.0035,fp);
 float pits=macroPit*(.4+.6*micro);
 float stain=history*drip*(.15+.85*exposed);
 vec3 coat=vec3(.085,.12,.105),undercoat=vec3(.34,.19,.095),steel=vec3(.30,.32,.31),rust=vec3(.17,.044,.012);
 vec3 color=coat*intact+undercoat*primer+steel*bare+rust*oxide;
 float metal=bare,rough=.43*intact+.74*primer+.34*bare+.94*oxide;
 float height=.00016*intact+.00007*primer-.00062*pits+.00024*oxide*(mt_kn(p*165.)-.25);
 if(uRack>.5){ // Galvanized zinc is metallic; white zinc corrosion is dielectric, steel rust only after zinc loss.
  float zinc=1.-exposed,white=loss*(1.-exposed)*(.35+.65*history),steelRust=oxide;
  zinc=max(zinc-white,0.);color=vec3(.48,.50,.49)*zinc+vec3(.62,.60,.54)*white+steel*bare+rust*steelRust;
  metal=zinc+bare;rough=.31*zinc+.84*white+.37*bare+.94*steelRust;
  height=.00008*zinc+.00015*white-.00062*pits+.0002*steelRust;
  intact=zinc;primer=white;
 }
 float grain=(micro-.5)*fineGate;height+=grain*.000055*(1.+2.*exposed);
 color*=1.-stain*.32;color*=1.-wet*.14;rough=mix(clamp(rough+.14*stain+.09*pits,.16,.98),.19,wet);
 return MetalSurface(color,rough,clamp(metal,0.,1.),height,loss,vec3(intact,primer,exposed));
}
`;
export function makeMetalMaterial(T,{family,variant,origin,state,jointOrigins=[]}){
 const uniforms={uWear:{value:state.wear},uHistory:{value:state.history},uWet:{value:state.wet},uRepair:{value:state.repair},uMode:{value:state.mode},uVariant:{value:variant},uRack:{value:family==='rack'?1:0},uOrigin:{value:new T.Vector3(...origin)},uJoints:{value:Array.from({length:16},(_,i)=>new T.Vector3(...(jointOrigins[i]||[0,0,0])))},uJointCount:{value:Math.min(jointOrigins.length,16)}};
 const m=new T.MeshStandardMaterial({color:0xffffff,roughness:.5});m.userData.uniforms=uniforms;m.userData.update=s=>{for(const[k,v]of Object.entries(s)){const name='u'+k[0].toUpperCase()+k.slice(1);if(uniforms[name])uniforms[name].value=v;}};
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms);s.vertexShader='uniform vec3 uOrigin;varying vec3 vRestM;varying vec3 vSurfaceN;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRestM=(modelMatrix*vec4(position,1.)).xyz-uOrigin;vSurfaceN=normalize(mat3(modelMatrix)*normal);');s.fragmentShader=METAL_FIELDS+s.fragmentShader;
 s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat fp=max(length(dFdx(vRestM)),length(dFdy(vRestM)));MetalSurface ms=metalField(vRestM,fp);diffuseColor.rgb=ms.color;');
 s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=ms.rough;').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=ms.metal;');
 s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nvec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition),r1=cross(dy,normal),r2=cross(normal,dx);float det=dot(dx,r1);normal=normalize(abs(det)*normal-sign(det)*(dFdx(ms.height)*r1+dFdy(ms.height)*r2));');
 s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','if(uMode>.5&&uMode<1.5)outgoingLight=vec3(clamp(.5+ms.height*650.,0.,1.));if(uMode>1.5&&uMode<2.5)outgoingLight=vec3(ms.rough);if(uMode>2.5&&uMode<3.5)outgoingLight=vec3(ms.damage);if(uMode>3.5&&uMode<4.5)outgoingLight=ms.layers;if(uMode>4.5)outgoingLight=normal*.5+.5;\n#include <opaque_fragment>');};m.customProgramCacheKey=()=>`metal-layer-r05-b-${family}-${variant}`;return m;
}
