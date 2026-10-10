export function patchRegionalShader(source){
 const replace=(a,b)=>{if(source.split(a).length!==2)throw Error('Regional ET13 anchor missing/ambiguous: '+a.slice(0,90));source=source.replace(a,()=>b);};
 replace('uniform sampler2D uFAtlas,uFChroma;',`uniform sampler2D uFAtlas,uFChroma;
 uniform float uRLipFiltering,uRLipDryness,uRLipBorderBlend,uROrbitalMicrorelief,uROrbitalRoughness,uRAlarOil,uRDebug;
 uniform vec4 uRAla,uROrbitalL,uROrbitalR;
 `);
 replace('float csSurfaceRough=clamp(',`// All region math is in native rest space, before any screen derivatives.
   float rGate=fMask*csCover*(1.-step(.5,vCSType));
   float rLip=clamp(vFA.y,0.,1.);
   float rCore=rLip*smoothstep(.15,.85,rLip)*rGate;
   float rBorder=4.*rLip*(1.-rLip)*rGate;
   vec2 rEL=(fMM-uROrbitalL.xy)/uROrbitalL.zw,rER=(fMM-uROrbitalR.xy)/uROrbitalR.zw;
   float rEyeWindow=1.-smoothstep(.75,1.35,min(length(rEL),length(rER)));
   float rOrbital=clamp(vFA.z,0.,1.)*rGate*rEyeWindow;
   vec2 rAL=(fMM-uRAla.xy)/vec2(4.5,5.5),rAR=(fMM-uRAla.zw)/vec2(4.5,5.5);
   float rAlar=max(exp(-dot(rAL,rAL)),exp(-dot(rAR,rAR)))*clamp(vFA.w,0.,1.)*rGate;
   float csSurfaceRough=clamp(`);
 replace('float csGrooves=sin(vCSRest.x*12300.+csNoise(vCSRest*310.)*3.)*.5;',`float rLipPhase=vCSRest.x*12300.+csNoise(vCSRest*310.)*3.;
   vec2 rPhaseFoot=vec2(dFdx(rLipPhase),dFdy(rLipPhase));
   // Gaussian approximation of a pixel box, applied to the existing sinusoid.
   // No new grooves, identity marks or UV distortion are introduced.
   float rFilter=exp(-dot(rPhaseFoot,rPhaseFoot)/24.);
   float csGrooves=sin(rLipPhase)*.5*mix(1.,rFilter,uRLipFiltering*rGate);`);
 replace('(fData.r-.5)*.000032*uFDetail','(fData.r-.5)*.000032*uFDetail*mix(1.,uROrbitalMicrorelief,rOrbital)');
 // Only pore relief, not the user's wrinkle/scar/meso fields, is attenuated.
 replace('visibility*ageGain*(1.-vFA.y)*(1.-vFA.z*.85)*(1.+vFA.w*.35)','visibility*ageGain*(1.-vFA.y)*(1.-vFA.z*.85)*(1.+vFA.w*.35)*mix(1.,uROrbitalMicrorelief,rOrbital)');
 replace('#include <clearcoat_normal_fragment_maps>',`
   if(rGate>0.)roughnessFactor=clamp(roughnessFactor+.13*uRLipDryness*rCore+.05*uRLipBorderBlend*rBorder+uROrbitalRoughness*rOrbital-.035*uRAlarOil*rAlar*fHostOil,.24,.95);
   #include <clearcoat_normal_fragment_maps>`);
 const coat='material.clearcoatRoughness=clamp(material.clearcoatRoughness-(.045*vFA.y+.015*vFA.w)*fMask,.23,.55);';
 replace(coat,coat+`
   if(rGate>0.){material.clearcoat=clamp(material.clearcoat*(1.-.65*uRLipDryness*rCore-.55*uRLipBorderBlend*rBorder)+.10*uRAlarOil*rAlar*fHostOil,0.,.65);
   material.clearcoatRoughness=clamp(material.clearcoatRoughness+.10*uRLipDryness*rCore+.07*uRLipBorderBlend*rBorder,.23,.60);}
 `);
 // This diagnostic only runs when explicitly requested; normal rendering remains 3D.
 replace('if(uFLayer>.5&&uFLayer<1.5)', 'if(uRDebug>.5)outgoingLight=vec3(rCore+rBorder*.25,rAlar,rOrbital);\n   if(uFLayer>.5&&uFLayer<1.5)');
 return source;
}
