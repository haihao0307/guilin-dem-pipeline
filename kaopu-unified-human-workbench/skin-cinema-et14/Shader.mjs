export const UNIFORMS=`
uniform float uCEnabled,uCPoreSize,uCPoreDepth,uCScanMicro,uCGrain,uCGrainMM,uCHydration,uCCheekRoughness,uCNoseRoughness,uCOilFilm,uCLobeMix,uCLobeRoughness,uCPigmentVariation,uCBloodVariation,uCLipGrain,uCFoldRelief,uCSeed;
uniform sampler2D uCFolds,uCBaseHeight;
float cNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);vec2 seed=vec2(uCSeed,uCSeed*.37);return mix(mix(fHash(i+seed).x,fHash(i+vec2(1.,0.)+seed).x,f.x),mix(fHash(i+vec2(0.,1.)+seed).x,fHash(i+vec2(1.)+seed).x,f.x),f.y);}
float cFineNetwork(vec2 mm){
 vec2 p=mm/uCGrainMM,cell=floor(p),f=fract(p);float d1=8.,d2=8.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 c=vec2(float(x),float(y)),q=c+.12+.76*fHash(cell+c+uCSeed)-f;float d=dot(q,q);if(d<d1){d2=d1;d1=d;}else d2=min(d2,d);}
 float edge=max(0.,sqrt(d2)-sqrt(d1));
 // Shallow connected valleys, not a noise value used as a normal directly.
 return -.0017*exp(-edge*edge/0.007)+.00022;
}
float cDecodeFold(vec2 packed){return ((packed.x*255.*256.+packed.y*255.)-32768.)*(3./65535.);}
`;
export function patchCinemaShader(source){
 const replace=(a,b)=>{if(source.split(a).length!==2)throw Error('ET14 pinned shader anchor absent or ambiguous: '+a.slice(0,100));source=source.replace(a,()=>b);};
 replace('uniform sampler2D uIColor,uIHeight;uniform float uIEnabled;','uniform sampler2D uIColor,uIHeight;uniform float uIEnabled;\n'+UNIFORMS);
 replace('csPaint=mix(csPaint,paint,fMask);',`csPaint=mix(csPaint,paint,fMask);
    float cVar=(cNoise(fMM/4.7)-.5)*.10*uCPigmentVariation*fHostVariation;
    float cBlood=(cNoise(fMM/7.3+17.)-.5)*.075*uCBloodVariation*fHostVariation*(.35+.65*vFB.y);
    csPaint*=exp(uCEnabled*fMask*(vec3(-1.,-1.43,-1.8)*cVar+vec3(.4,-.7,-.5)*cBlood));
 `);
 replace('(fData.r-.5)*.000032*uFDetail','(fData.r-.5)*.000032*uFDetail*mix(1.,uCScanMicro,uCEnabled)');
 replace('fPores(fMM)*.000006*uFDetail','fPores(fMM/mix(1.,uCPoreSize,uCEnabled))*.000006*uFDetail*mix(1.,uCPoreDepth,uCEnabled)');
 // The sampling worker's derivative must scale with the parameterized pore domain.
 replace('footDX=fSamplingDX/.38,footDY=fSamplingDY/.38','footDX=fSamplingDX/(.38*mix(1.,uCPoreSize,uCEnabled)),footDY=fSamplingDY/(.38*mix(1.,uCPoreSize,uCEnabled))');
 replace('float iHeight=(iRelief.r-iRelief.g)*.001*iMask*clamp(csDetail/.72,0.,2.1);',`
   vec4 cBase=texture2D(uCBaseHeight,clamp(iUV,0.,1.));
   float cFold=cDecodeFold(texture2D(uCFolds,clamp(iUV,0.,1.)).rg)*uCFoldRelief;
   float cHeight=(cBase.r-cBase.g+cFold)*.001;
   float iHeight=mix((iRelief.r-iRelief.g)*.001,cHeight,uCEnabled)*iMask*clamp(csDetail/.72,0.,2.1);
 `);
 replace('#include <clearcoat_normal_fragment_maps>',`
   if(uCEnabled>.5&&fMask>.001){
    float cFoot=max(length(dFdx(fMM)),length(dFdy(fMM)));
    float cVis=1.-smoothstep(uCGrainMM*.25,uCGrainMM*.8,cFoot);
    float cSmall=cFineNetwork(fMM)*.001*uCGrain*cVis*(1.-vFA.z*.8)*(1.-vFA.y);
    float cLip=(sin(fMM.x*16.+sin(fMM.y*.7))*.5+sin(fMM.x*29.+fMM.y*.4)*.18)*.000004*uCLipGrain*vFA.y*(1.-smoothstep(.03,.14,cFoot));
    float cH=(cSmall+cLip)*fMask*fHostDetail;
    vec3 cx=dFdx(-vViewPosition),cy=dFdy(-vViewPosition),cr1=cross(cy,normal),cr2=cross(normal,cx);float cd=dot(cx,cr1);
    if(abs(cd)>1e-14)normal=normalize(abs(cd)*normal-sign(cd)*(dFdx(cH)*cr1+dFdy(cH)*cr2));
    float cDry=(.5-uCHydration)*.10;
    roughnessFactor=clamp(roughnessFactor+fMask*(cDry+vFB.y*uCCheekRoughness+vFA.w*uCNoseRoughness),.24,.94);
    // Conservative slope-variance broadening. This is not full unresolved-NDF
    // reconstruction and does not claim to recover lost microgeometry energy.
    vec3 nx=dFdx(normal),ny=dFdy(normal);float variance=min(.035,(dot(nx,nx)+dot(ny,ny))*.12);
    roughnessFactor=sqrt(min(.94*.94,roughnessFactor*roughnessFactor+variance*fMask));
   }
   #include <clearcoat_normal_fragment_maps>
 `);
 replace('material.clearcoatRoughness=.4-csT*.08-csLip*.1;',`material.clearcoatRoughness=.4-csT*.08-csLip*.1;
   if(uCEnabled>.5){material.clearcoat=clamp(material.clearcoat+uCOilFilm*fMask*fHostOil*(.13*vFA.w+.055*vFB.x),0.,.65);}
 `);
 replace('reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );',`
  float cMix=uCEnabled*uFEnabled*clamp(vFA.x,0.,1.)*uCLobeMix;
  PhysicalMaterial cNarrow=material;cNarrow.roughness=clamp(uCLobeRoughness,.18,.60);
  // Convex mixture: do not add a second full-strength lobe on top of the first.
  reflectedLight.directSpecular += irradiance * ((1.-cMix)*BRDF_GGX(directLight.direction,geometryViewDir,geometryNormal,material)+cMix*BRDF_GGX(directLight.direction,geometryViewDir,geometryNormal,cNarrow));
 `);
 return source;
}
