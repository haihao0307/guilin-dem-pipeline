/* Independent compatibility implementation. Three.js MeshSSSNodeMaterial's
 * published fast-translucency equation is ported to the retained WebGL2 host.
 * This is not native TSL, measured tissue transport, or a copy of lo-th assets. */
const declarations=`
uniform float uHLSurface,uHLDetail,uHLColour,uHLRough,uHLPigment,uHLWet,uHLScatter,uHLView;
float hlFace=0.,hlLip=0.,hlDomain=0.,hlThickness=0.;
`;
export function installLookMaterial(viewer){
 const m=viewer.skin.material,previous=m.onBeforeCompile,previousKey=m.customProgramCacheKey.bind(m);
 const U={uHLSurface:{value:1},uHLDetail:{value:.8},uHLColour:{value:.85},uHLRough:{value:.72},uHLPigment:{value:.7},uHLWet:{value:.65},uHLScatter:{value:.6},uHLView:{value:0}};
 const report={version:'HEAD-LOOK-MATERIAL-R01',compiles:0,extraTextures:0,extraVertexAttributes:0,meshReplaced:false,volumeSSS:false,source:'Existing owned/previously admitted colour and height atlases, not lo-th texture pixels',thickness:'Authored regional translucency proxy, not measured skin thickness'};let lastShader;
 const patch=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Head look shader anchor changed: '+a.slice(0,100));return s.replace(a,()=>b);};
 m.onBeforeCompile=function(s,...args){
  previous.call(this,s,...args);lastShader=s;Object.assign(s.uniforms,U);s.fragmentShader=declarations+s.fragmentShader;
  const lipStart='vec3 lpColor=mix(csBase,csLipColor,clamp(csLipMix*(.43+uLPigment*.30+lpBlood*.25),0.,.94));';
  s.fragmentShader=patch(s.fragmentShader,lipStart,lipStart+`
   vec3 hlSkinBeforeLip=csBase;
   vec3 hlVermilion=mix(csBase,csBase*vec3(.96,.58,.91),clamp(.40+.40*uHLPigment,0.,1.));
   hlVermilion=mix(hlVermilion,csLipColor*vec3(.98,.90,1.08),clamp(uLPigment*.18,0.,.32));
   lpColor=mix(lpColor,hlVermilion,uHLSurface);
  `);
  const lipApply='csBase=mix(csBase,mix(csLipColor*(1.+csMacro*.06),lpColor,uLEnabled),csLip*mix(csLipMix,1.,uLEnabled));';
  s.fragmentShader=patch(s.fragmentShader,lipApply,lipApply+`
   // Shared anatomical lip-domain edge, not a second painted ellipse.
   float hlLipFeather=lpMask*(1.-.20*smoothstep(.78,1.,lpV));
   csBase=mix(csBase,mix(hlSkinBeforeLip,lpColor,hlLipFeather),uHLSurface*uLEnabled);
  `);
  const colour='diffuseColor.rgb*=mix(vec3(1.),rfBlood*(1.+rfChroma),rfArea);';
  s.fragmentShader=patch(s.fragmentShader,colour,colour+`
   hlFace=clamp(vFA.x,0.,1.)*(1.-clamp(lpMask,0.,1.))*(1.-clamp(eaM,0.,1.))*smoothstep(.203,.218,vFRest.y)*smoothstep(-.015,.025,vFRest.z)*uHLSurface;
   hlLip=clamp(lpMask,0.,1.)*(1.-clamp(eaM,0.,1.))*uHLSurface;
   hlDomain=clamp(hlFace+hlLip,0.,1.);
   hlThickness=clamp(.45+.30*rfThin+.18*rfNose+.12*hlLip-.10*rfForehead,.20,.92);
   vec3 hlResidual=exp(clamp(fChroma-vec3(.5),vec3(-.17),vec3(.17))*uHLColour*1.75);
   float hlMesoTone=(fData.g-.5)*.10*uHLColour;
   diffuseColor.rgb*=mix(vec3(1.),hlResidual*vec3(1.012,.987,1.015)*(1.+hlMesoTone),hlFace);
  `);
  // Assign ownership of pores: reduce the retained synthetic pore layer when
  // the existing micro/meso atlas is restored; never double both at full strength.
  s.fragmentShader=patch(s.fragmentShader,'rfH=rfPoreHeight(rfMM,uRFSize,rfFoot)*uRFGain*rfVisibility*rfArea;',
   'rfH=rfPoreHeight(rfMM,uRFSize,rfFoot)*uRFGain*rfVisibility*rfArea*(1.-.65*uHLSurface);');
  s.fragmentShader=patch(s.fragmentShader,'#include <clearcoat_normal_fragment_maps>',`
   if(uHLSurface>.001){
    float hlFoot=max(length(dFdx(fMM)),length(dFdy(fMM)));
    float hlMicroVisibility=1.-smoothstep(.07,.27,hlFoot),hlMesoVisibility=1.-smoothstep(.28,1.0,hlFoot);
    float hlHeight=((fData.r-.5)*.000030*hlMicroVisibility+(fData.g-.5)*.00010*hlMesoVisibility)*uHLDetail*hlFace;
    vec3 hx=dFdx(-vViewPosition),hy=dFdy(-vViewPosition),hr1=cross(hy,normal),hr2=cross(normal,hx);float hd=dot(hx,hr1);
    if(abs(hd)>1e-14){vec3 slope=sign(hd)*(dFdx(hlHeight)*hr1+dFdy(hlHeight)*hr2)/abs(hd);slope*=min(1.,.26/max(length(slope),.00001));normal=normalize(normal-slope);}
    float hlRoughness=uHLRough-.065*rfNose-.028*rfForehead+.025*rfThin+(fData.b-.5)*.16+(csRoughness-.62)*.25;
    roughnessFactor=mix(roughnessFactor,clamp(hlRoughness,.46,.88),hlFace);
    float hlLipRough=.66+(mix(uL19Rough.x,uL19Rough.y,lpUpper)-.515)*.7+(uLRough-.56)*.35-lpMoist*clamp(lpWetGain/.4,0.,2.)*uHLWet*.26+lpDryPatch*.065+lpMottle*.032;
    roughnessFactor=mix(roughnessFactor,clamp(hlLipRough,.31,.82),hlLip);
   }
   #include <clearcoat_normal_fragment_maps>
  `);
  const coat='material.clearcoatRoughness=mix(material.clearcoatRoughness,.50,rfArea);';
  s.fragmentShader=patch(s.fragmentShader,coat,coat+`
   material.specularColor=mix(material.specularColor,vec3(.03252),hlFace);
   material.clearcoat=mix(material.clearcoat,.003,hlFace);
   material.clearcoat=mix(material.clearcoat,.008+lpMoist*clamp(lpWetGain/.4,0.,2.)*uHLWet*.27,hlLip);
   material.clearcoatRoughness=mix(material.clearcoatRoughness,.48-lpMoist*clamp(lpWetGain/.4,0.,2.)*uHLWet*.19,hlLip);
  `);
  const lighting='reflectedLight.directDiffuse+=mix(mix(etOld,etLight,etMask),rfAngular,rfArea)*directLight.color*BRDF_Lambert(material.diffuseColor);';
  s.fragmentShader=patch(s.fragmentShader,lighting,`
   vec3 hlOriginalDiffuse=mix(mix(etOld,etLight,etMask),rfAngular,rfArea);
   reflectedLight.directDiffuse+=mix(hlOriginalDiffuse,vec3(dotNL),hlDomain)*directLight.color*BRDF_Lambert(material.diffuseColor);
   // Three.js fast SSS: distorted half-vector, bounded view/backlight lobe,
   // plus ambient scattering. Replace old face wrapping rather than stack it.
   vec3 hlHalf=normalize(directLight.direction+geometryNormal*.23);
   float hlBack=pow(clamp(dot(geometryViewDir,-hlHalf),0.,1.),2.)*.6;
   vec3 hlScatterColour=material.diffuseColor*vec3(1.,.48,.38)*hlThickness;
   reflectedLight.directDiffuse+=(hlBack+.2)*hlScatterColour*.4*directLight.color*uHLScatter*hlDomain;
  `);
  s.fragmentShader=patch(s.fragmentShader,'#include <opaque_fragment>',`
   if(uHLView>.5&&uHLView<1.5)outgoingLight=diffuseColor.rgb;
   if(uHLView>1.5&&uHLView<2.5)outgoingLight=vec3(roughnessFactor);
   if(uHLView>2.5&&uHLView<3.5)outgoingLight=normal*.5+.5;
   if(uHLView>3.5&&uHLView<4.5)outgoingLight=mix(vec3(.06),vec3(hlThickness),hlDomain);
   if(uHLView>4.5)outgoingLight=mix(vec3(.08),vec3(.22,.58,.8)*hlFace+vec3(.85,.25,.3)*hlLip,hlDomain);
   #include <opaque_fragment>
  `);
  report.compiles++;lastShader=s;
 };
 m.customProgramCacheKey=()=>previousKey()+'/head-look-channel-ownership-r01';m.needsUpdate=true;
 return {U,report,shader:()=>lastShader,update(p){const gray=viewer.model.foldProfile?.settings.gray||viewer.model.eyeSurface?.settings.gray;U.uHLSurface.value=p.surface&&!gray?1:0;for(const [a,b]of [['uHLDetail','detail'],['uHLColour','colour'],['uHLRough','roughness'],['uHLPigment','pigment'],['uHLWet','wetness'],['uHLScatter','scatter'],['uHLView','diagnostic']])U[a].value=gray?0:p[b];},dispose(){m.onBeforeCompile=previous;m.customProgramCacheKey=previousKey;m.needsUpdate=true;}};
}
