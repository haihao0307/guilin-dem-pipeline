import * as THREE from '../full/source/registration-vendor/three.module.js';
import {eyeFrames} from './Profile.mjs';
const declaration=`
uniform float uLFLips,uLFEyes,uLFEars,uLFGuard,uLFChroma,uLFBorder,uLFWet,uLFEyeDetail,uLFEyeTint,uLFEarColour,uLFEarScatter,uLFDiagnostic;
uniform vec3 uLFOrigin[2],uLFX[2],uLFY[2],uLFZ[2];uniform vec4 uLFShape[2];
float lfEye=0.,lfLip=0.,lfLipScope=0.,lfEar=0.,lfCavity=0.;
vec4 lfOrbit(vec3 p,out vec3 local){
 int id=distance(p,uLFOrigin[0])<distance(p,uLFOrigin[1])?0:1;
 vec3 d=p-uLFOrigin[id];local=vec3(dot(d,uLFX[id]),dot(d,uLFY[id]),dot(d,uLFZ[id]));
 float t=local.x/uLFShape[id].x,arc=pow(max(0.,4.*clamp(t,0.,1.)*(1.-clamp(t,0.,1.))),.70);
 float top=uLFShape[id].y*arc,bottom=uLFShape[id].z*arc,upper=step((top+bottom)*.5,local.y);
 float edge=mix(bottom-local.y,local.y-top,upper);
 float extent=smoothstep(-.12,.025,t)*(1.-smoothstep(1.18,1.38,t));
 float depth=1.-smoothstep(.009,.018,abs(local.z));
 float area=extent*depth*smoothstep(-.0010,.00025,edge)*(1.-smoothstep(.008,.014,edge));
 return vec4(area,upper,edge*1000.,t);
}
float lfGauss(vec3 p,vec3 c,vec3 size){vec3 q=(vec3(abs(p.x),p.y,p.z)-c)/size;return exp(-dot(q,q));}
`;
/** Local changes only: the host's complexion, body skin, maps and identity remain.
 * Lip and ear masks are the retained specialist domains. Eye frame is from
 * retained barycentric landmarks; no transplanted reference skin/mesh/pixels. */
export function installLocalFeatures(viewer){
 const m=viewer.skin.material,previous=m.onBeforeCompile,key=m.customProgramCacheKey.bind(m),fields=viewer.model.faceSurface.fields;
 const frames=eyeFrames(i=>fields.landmark(fields.rest,i)),U={};
 for(const name of ['uLFLips','uLFEyes','uLFEars','uLFGuard','uLFChroma','uLFBorder','uLFWet','uLFEyeDetail','uLFEyeTint','uLFEarColour','uLFEarScatter','uLFDiagnostic'])U[name]={value:0};
 for(const[name,part]of [['uLFOrigin','origin'],['uLFX','x'],['uLFY','y'],['uLFZ','z']])U[name]={value:frames.map(f=>new THREE.Vector3(...f[part]))};U.uLFShape={value:frames.map(f=>new THREE.Vector4(...f.shape))};
 const report={version:'LOCAL-FEATURES-R03',compiles:0,newTextures:0,newVertexAttributes:0,newMeshes:0,originalBodyAndComplexion:true,referenceBitmapsImported:false,eyeLandmarks:frames.map(f=>({origin:f.origin,width:f.width,shape:f.shape})),limitations:'Bounded artist-authored local appearance rules, not measured reflectance or replacement of eyelid geometry'};let lastShader;
 const patch=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Local R03 shader drift: '+a.slice(0,110));return s.replace(a,()=>b);};
 m.onBeforeCompile=function(s,...args){previous.call(this,s,...args);lastShader=s;Object.assign(s.uniforms,U);let f=declaration+s.fragmentShader;
 // Broaden only the lip boundary, taper at the corners; never draw a second oval.
 f=patch(f,'mix(.00016,.00062,uLSoft)','mix(mix(.00016,.00062,uLSoft),min(.00040+.0011*uLFBorder,max(.00025,(lpTopY-lpBotY)*.24)),uLFLips)');
 const lp='vec3 lpColor=mix(csBase,csLipColor,clamp(csLipMix*(.43+uLPigment*.30+lpBlood*.25),0.,.94));';
 f=patch(f,lp,`vec3 lfBeforeLip=csBase;${lp}
  vec3 lfMutedLip=mix(csBase,csLipColor,clamp(csLipMix*(.36+.25*uLPigment+.20*lpBlood)*uLFChroma,0.,.94))*vec3(.985,.98,1.025);
  lpColor=mix(lpColor,lfMutedLip,uLFLips);
 `);
 const blend='csBase=mix(csBase,mix(csLipColor*(1.+csMacro*.06),lpColor,uLEnabled),csLip*mix(csLipMix,1.,uLEnabled));';
 f=patch(f,blend,blend+`
  float lfEdgeFade=smoothstep(.72,1.12,lpV)*(.09+.09*uLFBorder)*(1.-lpMucosa);
  csBase=mix(csBase,mix(lfBeforeLip,lpColor,lpMask*(1.-lfEdgeFade)),uLFLips*uLEnabled);
 `);
 const ear='eaColour=mix(eaColour,etColour,uETActive);';
 f=patch(f,ear,ear+`
  // Region colour is pigment, not a baked highlight or painted cavity shadow.
  float lfBlood=eaS.x*uLFEarColour*(.26+.48*eaBowl+.36*etLobe+.18*eaRim);
  vec3 lfEarPigment=csPaint*exp(lfBlood*vec3(.12,-.25,-.17));
  lfEarPigment*=exp(eaVariation*uLFEarColour*vec3(.065,.032,.026)+eaMottle*.018*uLFEarColour);
  eaColour=mix(eaColour,lfEarPigment,uLFEars);
 `);
 const color='diffuseColor.rgb*=mix(vec3(1.),rfBlood*(1.+rfChroma),rfArea);';
 f=patch(f,color,color+`
  vec3 lfEyeQ;vec4 lfEyeField=lfOrbit(vFRest,lfEyeQ);
  float lfSkinOwner=csCover*(1.-step(.5,vCSType));
  lfEye=lfEyeField.x*lfSkinOwner*(1.-lpMask)*(1.-eaM)*uLFEyes;
  lfLip=lpMask*lfSkinOwner*uLFLips;lfEar=eaM*uLFEars;
  // A border correction can remove the former feather at a corner. Ownership
  // must include BOTH the original support and the edited support; otherwise
  // removed original pigment is falsely classified as an unrelated-skin edit.
  // Recompute the exact retained specialist's original AA/domain equation.
  // This does not broaden the actual colour, normal or optical modifications.
  float lfNativeAA=max(fwidth(vFRest.y)*.8,mix(.00016,.00062,uLSoft));
  float lfNativeLip=smoothstep(lpBotY-lfNativeAA,lpBotY+lfNativeAA,vFRest.y+lpBorderNoise)*(1.-smoothstep(lpTopY-lfNativeAA,lpTopY+lfNativeAA,vFRest.y+lpBorderNoise));
  lfNativeLip*=lpExtent*lpThickness*smoothstep(0.111193347,0.117193347,vFRest.z)*csCover*uLEnabled;
  lfNativeLip=max(lfNativeLip,lpMucosa);
  lfLipScope=max(lpMask,lfNativeLip)*lfSkinOwner*uLFLips;
  lfCavity=clamp(vFA.w,0.,1.)*(1.-smoothstep(.267,.281,vFRest.y))*lfSkinOwner*uLFGuard;
  float lfRim=exp(-pow(lfEyeField.z/.65,2.));
  float lfUnder=(1.-lfEyeField.y)*exp(-pow((lfEyeField.z-3.5)/5.5,2.));
  float lfColourNoise=csNoise(vFRest*vec3(350.,790.,530.))-.5;
  vec3 lfOrbitalPigment=exp(uLFEyeTint*(vec3(.010,-.017,-.018)*lfRim+vec3(-.020,-.033,-.015)*lfUnder+lfColourNoise*vec3(.026,.016,.011)));
  diffuseColor.rgb*=mix(vec3(1.),lfOrbitalPigment,lfEye);
 `);
 f=patch(f,'#include <clearcoat_normal_fragment_maps>',`
  vec2 lfMM=lfEyeQ.xy*1000.;float lfFoot=max(length(dFdx(lfMM)),length(dFdy(lfMM)));
  float lfMicroVis=1.-smoothstep(.06,.24,lfFoot),lfFoldVis=1.-smoothstep(.18,.65,lfFoot);
  float lfMaturity=smoothstep(.20,.72,uFAge),lfFine=(fData.r-.5)*.000014*lfMicroVis;
  float lfCrease=0.;
  for(int j=0;j<4;j++){
   float n=float(j),shift=2.2+n*1.83+.23*sin(lfEyeField.w*(7.1+n)+n*2.8);
   float dist=lfEyeField.z-shift,width=.085+n*.023;
   float var=.55+.45*sin(lfEyeField.w*(4.9+n)+n*1.73)*sin(lfEyeField.w*9.3+n);
   lfCrease-=exp(-dist*dist/(width*width+lfFoot*lfFoot*.30))*var*.0000023;
  }
  lfCrease*=smoothstep(.08,.30,lfEyeField.w)*(1.-smoothstep(.86,1.12,lfEyeField.w))*(.35+.65*lfMaturity)*lfFoldVis;
  float lfRelief=(lfFine+lfCrease+(csNoise(vFRest*1950.)-.5)*.0000017*lfMicroVis)*uLFEyeDetail*lfEye*clamp(csDetail/.72,0.,2.1);
  vec3 lfDX=dFdx(-vViewPosition),lfDY=dFdy(-vViewPosition),lfR1=cross(lfDY,normal),lfR2=cross(normal,lfDX);float lfDet=dot(lfDX,lfR1);
  if(abs(lfDet)>1e-14){vec3 slope=sign(lfDet)*(dFdx(lfRelief)*lfR1+dFdy(lfRelief)*lfR2)/abs(lfDet);slope*=min(1.,.14/max(length(slope),.00001));normal=normalize(normal-slope*lfEye);}
  roughnessFactor=mix(roughnessFactor,clamp(roughnessFactor+.030*lfEyeField.y-.065*lfRim+.016*lfColourNoise,.35,.86),lfEye);
  float lfLipRough=clamp(roughnessFactor+.060-lpMoist*lpWetGain*uLFWet*.15,.34,.79);
  roughnessFactor=mix(roughnessFactor,lfLipRough,lfLip);
  roughnessFactor=mix(roughnessFactor,clamp(roughnessFactor+.030*etLobe-.016*eaBowl,.37,.86),lfEar);
  #include <clearcoat_normal_fragment_maps>
 `);
 const coat='material.clearcoatRoughness=mix(material.clearcoatRoughness,.50,rfArea);';
 f=patch(f,coat,coat+`
  material.clearcoat=mix(material.clearcoat,.005+lpMoist*lpWetGain*uLFWet*.58,lfLip);
  material.clearcoatRoughness=mix(material.clearcoatRoughness,clamp(.48-lpMoist*lpWetGain*uLFWet*.38,.26,.50),lfLip);
  material.clearcoat=mix(material.clearcoat,.004+lfRim*.055,lfEye);
  material.clearcoatRoughness=mix(material.clearcoatRoughness,.43-.12*lfRim,lfEye);
  material.specularColor=mix(material.specularColor,vec3(.031),lfEye);
 `);
 const light='reflectedLight.directDiffuse+=mix(mix(etOld,etLight,etMask),rfAngular,rfArea)*directLight.color*BRDF_Lambert(material.diffuseColor);';
 f=patch(f,light,`
  vec3 lfAngular=mix(mix(etOld,etLight,etMask),rfAngular,rfArea);
  vec3 lfWrapW=vec3(.09,.045,.025),lfShallow=max((vec3(fNL)+lfWrapW)/(1.+lfWrapW),vec3(0.))/(1.+lfWrapW);
  lfAngular=mix(lfAngular,lfShallow,max(lfEye,lfLip)*.75);
  // Only valid ear tissue can transmit; thick/root/occluded regions cannot be
  // brightened by an unshadowed ambient or backlight add. Light colour here
  // already includes this light's actual shadow visibility.
  float lfValid=smoothstep(.25,.75,vETissue.w)*clamp(vETissue.y,0.,1.);
  vec3 lfTransmit=etTransport(fNL,eaSetting(vFRest).w,etSoft)*lfValid*uLFEarScatter;
  lfAngular=mix(lfAngular,vec3(max(fNL,0.))+lfTransmit,lfEar*uLFGuard);
  lfAngular=mix(lfAngular,vec3(dotNL),lfCavity);
  reflectedLight.directDiffuse+=lfAngular*directLight.color*BRDF_Lambert(material.diffuseColor);
 `);
 f=patch(f,'#include <opaque_fragment>',`
  if(uLFDiagnostic>.5&&uLFDiagnostic<1.5){gl_FragColor=vec4(lfLipScope>0.?1.:0.,lfEye>0.?1.:0.,lfEar>0.?1.:0.,1.);return;}
  if(uLFDiagnostic>1.5&&uLFDiagnostic<2.5)outgoingLight=diffuseColor.rgb;
  if(uLFDiagnostic>2.5&&uLFDiagnostic<3.5)outgoingLight=vec3(roughnessFactor);
  if(uLFDiagnostic>3.5)outgoingLight=normal*.5+.5;
  #include <opaque_fragment>
 `);
 s.fragmentShader=f;report.compiles++;
 };
 m.customProgramCacheKey=()=>key()+'/bounded-local-features-r03-v2-support-union';m.needsUpdate=true;
 return {U,report,shader:()=>lastShader,update(p){const gray=viewer.model.foldProfile.settings.gray||viewer.model.eyeSurface.settings.gray;for(const[k,n]of Object.entries({lips:'uLFLips',eyes:'uLFEyes',ears:'uLFEars',leakGuard:'uLFGuard'}))U[n].value=p[k]&&!gray?1:0;for(const[k,n]of Object.entries({lipChroma:'uLFChroma',lipBorder:'uLFBorder',lipWetness:'uLFWet',eyeDetail:'uLFEyeDetail',eyeTint:'uLFEyeTint',earColour:'uLFEarColour',earScatter:'uLFEarScatter',diagnostic:'uLFDiagnostic'}))U[n].value=gray?0:p[k];},dispose(){m.onBeforeCompile=previous;m.customProgramCacheKey=key;m.needsUpdate=true;}};
}
