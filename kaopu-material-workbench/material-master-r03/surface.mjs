// mt_* algebra mechanically translated from preserved FH88 metal-original WGSL.
// New masks/closures are KAOPU R02 research, not calibrated corrosion physics.
export const STREET_FIELDS=String.raw`
varying vec3 vRestM;varying vec3 vLocalN;
uniform float uWear,uHistory,uWet,uRepair,uMode,uFamily,uVariant,uPart;
float mt_kh(vec3 p){p=fract(p*.1031);p+=vec3(dot(p,p.yzx+vec3(33.33)));return fract((p.x+p.y)*p.z);}
float mt_kn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(vec3(3.)-2.*f);return mix(mix(mix(mt_kh(i),mt_kh(i+vec3(1,0,0)),f.x),mix(mt_kh(i+vec3(0,1,0)),mt_kh(i+vec3(1,1,0)),f.x),f.y),mix(mix(mt_kh(i+vec3(0,0,1)),mt_kh(i+vec3(1,0,1)),f.x),mix(mt_kh(i+vec3(0,1,1)),mt_kh(i+vec3(1,1,1)),f.x),f.y),f.z);}
float mt_kfb(vec3 p){return .57*mt_kn(p)+.28*mt_kn(p*2.13)+.15*mt_kn(p*4.17);}
float lineSeg(vec2 p,vec2 a,vec2 b){vec2 q=p-a,v=b-a;return length(q-v*clamp(dot(q,v)/dot(v,v),0.,1.));}
float softBox(vec2 p,vec2 b,float r){vec2 d=abs(p)-b;return length(max(d,0.))+min(max(d.x,d.y),0.)-r;}
struct StreetSample {vec3 color;float rough;float metal;float height;vec3 masks;};
StreetSample metalSample(vec3 p,float fp){
 float wear=uWear*uVariant,history=uHistory*uVariant,wet=uWet*uVariant,repair=uRepair*uVariant;
 float baseContact=exp(-max(p.y,0.)/ .18);
 float seam=exp(-abs(p.y-.22)/.045)+.65*exp(-abs(p.y-2.65)/.045);
 if(uFamily>.5&&uFamily<1.5)seam=exp(-abs(p.y-1.88)/.055)+exp(-abs(abs(p.x)-.9)/.045)*exp(-abs(p.z)/.12);
 if(uFamily>1.5)seam=exp(-abs(p.y-1.00)/.05)+exp(-abs(p.y-2.45)/.05)+.5*exp(-abs(abs(p.x)-1.05)/.045);
 float structure=clamp(.48*seam+.45*baseContact,0.,1.);
 float n=mt_kfb(p*8.3+vec3(9.1,2.7,5.3));
 float edge=1.-smoothstep(.1,.38,abs(vLocalN.y));
 float loss=smoothstep(.85-.36*wear,.96-.36*wear,n+.26*structure)*wear;
 float patchMask=1.-smoothstep(.02,.06,softBox(vec2(p.y-1.15,p.x),vec2(.22,.36),.025));
 loss*=1.-repair*patchMask;
 float rust=clamp(loss*(.35+.65*structure+.28*history),0.,1.);
 // Falling stains are driven by seam origins, narrow in x/z and long in -y.
 float streakX=pow(max(0.,sin(p.x*37.+p.z*29.)),18.);
 float fromJoint=exp(-max(2.65-p.y,0.)/ .9)*step(p.y,2.65);
 if(uFamily>.5&&uFamily<1.5)fromJoint=exp(-max(1.88-p.y,0.)/.7)*step(p.y,1.88);
 if(uFamily>1.5)fromJoint=exp(-max(2.45-p.y,0.)/.8)*step(p.y,2.45);
 float runoff=history*streakX*fromJoint*(.28+.72*wear);
 vec3 coat=vec3(.065,.105,.087),steel=vec3(.27,.29,.28),oxide=vec3(.11,.028,.007);
 float metal=loss*(1.-rust),rough=.44+.22*loss+.25*rust;
 vec3 color=mix(coat,steel,loss);color=mix(color,oxide,rust);
 if(uFamily>.5&&uFamily<1.5){color=mix(vec3(.45,.48,.47),vec3(.34,.36,.34),loss);color=mix(color,vec3(.55,.53,.46),rust*.8);color=mix(color,oxide,rust*structure*.45);metal=1.-rust;rough=.32+.43*rust+.12*loss;}
 if(uFamily>1.5){color=mix(vec3(.13,.15,.16),steel,loss);color=mix(color,oxide,rust);}
 color*=1.-runoff*.32;color=mix(color,coat,patchMask*repair*.8);metal*=1.-patchMask*repair;
 float grain=(mt_kn(p*220.+vec3(11.))-.5)*(1.-smoothstep(.001,.006,fp));
 float height=grain*.00008-rust*.00028+patchMask*repair*.00010;
 color*=1.-wet*.12;rough=mix(clamp(rough+runoff*.12,.18,.98),.19,wet);
 return StreetSample(color,rough,metal,height,vec3(loss,runoff,patchMask*repair));
}
StreetSample concreteMother(vec3 p,float age,float wetness,float repair,float footprint){
 vec3 q=p+vec3(19.,19.*.71,19.*.37);float large=mt_kn(q*.63),meso=mt_kn(q*3.7),fine=.5;if(footprint<.021)fine=mix(mt_kn(q*127.),.5,smoothstep(.003,.021,footprint));
 float moisturePatch=smoothstep(.43,.72,large)*smoothstep(.28,.62,meso),fresh=repair,damp=clamp(moisturePatch*(.42+large*.58)*(1.-fresh*.85),0.,1.);float wet=wetness*clamp(damp+smoothstep(.60,.81,large)*.38+.22,0.,1.);
 vec3 base=vec3(.468,.451,.381);float gray=moisturePatch*age*.18*(1.-fresh);vec3 color=mix(base,base*.69+vec3(.027,.030,.025),gray);float chip=smoothstep(.64,.81,mt_kn(q*23.))*smoothstep(.46,.76,meso)*age;
 color=mix(color,base*vec3(.59,.56,.49),chip*.42);color=mix(color,base*vec3(.50,.56,.50),damp*age*.72);color=mix(color,mix(base,vec3(.80,.78,.69),.17),fresh*.85);color*=1.-wet*.13;
 return StreetSample(color,clamp(.87+(fine-.5)*.07-wet*.23,.23,1.),0.,(fine-.5)*.00042-chip*.0007,vec3(0.));
}
StreetSample roadSample(vec3 p,float fp){
 vec2 q=p.xz;float wear=uWear*uVariant,history=uHistory*uVariant,wet=uWet*uVariant,repair=uRepair*uVariant;
 bool concrete=uFamily>3.5;
 // Shared crack network: authored connected segments in metres, not unrelated masks.
 float crackD=min(lineSeg(q,vec2(-2.8,-3.5),vec2(-1.,-.8)),min(lineSeg(q,vec2(-1.,-.8),vec2(.1,1.1)),lineSeg(q,vec2(.1,1.1),vec2(2.8,3.8))));
 crackD=min(crackD,lineSeg(q,vec2(-1.,-.8),vec2(-2.8,.5)));
 float crack=(1.-smoothstep(.003,.014+fp,crackD))*wear;
 float patchD=softBox(q-vec2(1.55,-.65),vec2(.65,1.0),.12);
 float patchMask=(1.-smoothstep(-.018,.018+fp,patchD))*repair;
 crack*=1.-patchMask;
 float aggregate=mt_kn(p/.012+vec3(17.,2.,7.));
 float grainGate=1.-smoothstep(.004,.024,fp);
 float grain=(aggregate-.5)*grainGate;
 vec3 base=concrete?vec3(.37,.36,.32):vec3(.045,.049,.051);
 float rough=concrete?.83:.89;
 base*=.86+.28*mt_kfb(p/.35+vec3(4.));base+=vec3(grain*(concrete?.08:.05));StreetSample cement=concreteMother(p,wear,0.,0.,fp);if(concrete){base=cement.color;rough=cement.rough;}
 // Wheel paths are lanes along z; history controls accumulated oil/rubber independently of wetness.
 float wheel=exp(-pow((abs(q.x)-.92)/.13,2.))+exp(-pow((abs(q.x)-2.15)/.13,2.));
 float travelled=wheel*history*(.4+.6*mt_kfb(vec3(q.x*2.,q.y*.4,8.)));
 float oil=exp(-dot((q-vec2(1.48,2.2))/vec2(.43,.72),(q-vec2(1.48,2.2))/vec2(.43,.72)))*history;
 float stains=clamp(travelled*.50+oil*.75,0.,1.);
 base=mix(base,concrete?vec3(.19,.195,.185):vec3(.022,.025,.026),patchMask);
 base*=1.-stains*(concrete?.48:.38);base=mix(base,vec3(.012,.014,.013),crack*.85);
 float joint=0.;if(concrete){float dist=abs(mod(q.y+1.5,3.)-1.5);joint=1.-smoothstep(.006,.014+fp,dist);base=mix(base,vec3(.07,.075,.07),joint*.72);}
 float edgeLine=1.-smoothstep(.035,.055+fp,abs(abs(q.x)-3.02));
 float centerLine=(1.-smoothstep(.045,.06+fp,abs(q.x)))*(1.-step(1.9,mod(q.y+4.5,3.)));
 float paint=clamp(edgeLine+centerLine,0.,1.)*smoothstep(.65,.85,vLocalN.y);
 float lostPaint=smoothstep(.5-.25*wear,.72-.25*wear,mt_kfb(vec3(q*14.,11.)))*wear;
 paint*=1.-lostPaint;paint*=1.-patchMask;
 vec3 marking=vec3(.78,.78,.73); // HK normal lane/centre lines: white; not kerb parking restriction markings.
 base=mix(base,marking,paint);
 rough=mix(rough-stains*.20,.60,paint);
 float height=(concrete?cement.height:grain*.0015)-crack*.002-joint*.001+patchMask*.001+paint*.00025;
 base*=1.-wet*.28;rough=mix(rough,.21,wet);
 return StreetSample(base,clamp(rough,.18,.98),0.,height,vec3(crack,stains,patchMask));
}
StreetSample streetSample(vec3 p,float fp){if(uPart>.5){float g=(mt_kn(p*35.)-.5)*.03;return StreetSample(vec3(.34,.33,.29)+g,.91,0.,g*.001,vec3(0.));}if(uFamily<2.5)return metalSample(p,fp);return roadSample(p,fp);}
`;
export function applyStreetMaterial(THREE,{family,variant,origin,part=0,state,shaders}){
 const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.7,metalness:0});
 material.onBeforeCompile=s=>{const values={Wear:state.wear,History:state.history,Wet:state.wet,Repair:state.repair,Mode:state.mode,Family:family,Variant:variant,Part:part};for(const[k,v]of Object.entries(values))s.uniforms['u'+k]={value:v};s.uniforms.uOrigin={value:new THREE.Vector3(...origin)};
 s.vertexShader='uniform vec3 uOrigin;varying vec3 vRestM;varying vec3 vLocalN;\n'+s.vertexShader;
 s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRestM=(modelMatrix*vec4(position,1.)).xyz-uOrigin;vLocalN=normalize(mat3(modelMatrix)*normal);');
 s.fragmentShader=STREET_FIELDS+s.fragmentShader;
 s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat kpFp=max(length(dFdx(vRestM)),length(dFdy(vRestM)));StreetSample kpS=streetSample(vRestM,kpFp);diffuseColor.rgb=kpS.color;');
 s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=kpS.rough;');
 s.fragmentShader=s.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=kpS.metal;');
 s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nvec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition),r1=cross(dy,normal),r2=cross(normal,dx);float det=dot(dx,r1);normal=normalize(abs(det)*normal-sign(det)*(dFdx(kpS.height)*r1+dFdy(kpS.height)*r2));');
 s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','if(uMode>.5&&uMode<1.5)outgoingLight=kpS.masks;if(uMode>1.5&&uMode<2.5)outgoingLight=vec3(kpS.metal);if(uMode>2.5)outgoingLight=vec3(kpS.rough);\n#include <opaque_fragment>');shaders.push(s);};
 material.customProgramCacheKey=()=>`street-${family}-${variant}-${part}`;return material;
}
