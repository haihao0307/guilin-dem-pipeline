/* R01-C3: coupled shallow follicle/skin-line network and restrained chroma.
 * Independently authored functions, no input surface images or reference pixels.
 * The C2 fixed public build remains an immutable comparison, not overwritten. */
(()=>{'use strict';const priorInstall=window.__installHeadCalibration;
 const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('R01-C3 surface contract '+a);return s.replace(a,()=>b);};
 window.__installHeadCalibration=(api,v)=>{priorInstall(api,v);const mat=api.material(),prior=mat.onBeforeCompile,key=mat.customProgramCacheKey;
 mat.onBeforeCompile=s=>{prior(s);
  s.fragmentShader=once(s.fragmentShader,'float height=0.,pigment=0.;','float height=0.,pigment=0.,nearest=1e6,second=1e6;');
  s.fragmentShader=once(s.fragmentShader,'float d2=dot(delta,delta);','float d2=dot(delta,delta);if(d2<nearest){second=nearest;nearest=d2;}else if(d2<second){second=d2;}');
  s.fragmentShader=once(s.fragmentShader,'return vec2(height,pigment);','float gap=sqrt(max(second,0.))-sqrt(max(nearest,0.));float width=.035+footprint*.45;float crease=exp(-gap*gap/(width*width))*.035/width;return vec2(height,crease);');
  s.fragmentShader=once(s.fragmentShader,'float psResolve=1.-smoothstep(.18,.72,psFoot);',`float pcGrain=(psNoise(psMM*3.7+vec3(91.3))-.5)*.025*psMicro;
   float pcChroma=(pcGrain+psPore.x*.08*psPores-psPore.y*.004*psMicro)*pcBlend*(1.-psLipFeather)*(1.-psThinMask*.6);
   psBase*=clamp(1.+pcChroma,.9,1.08);diffuseColor.rgb=psBase;
   float psResolve=1.-smoothstep(.18,.72,psFoot);`);
  s.fragmentShader=once(s.fragmentShader,'psPore.x*.000011*psPores+psMeso*psMicro','psPore.x*.000020*psPores+(psMeso-psPore.y*.000010)*psMicro');
  s.fragmentShader=once(s.fragmentShader,'roughnessFactor=psR;','psR=clamp(psR+(psPore.y-.20)*.028*psMicro*pcBlend*(1.-psLipFeather),.27,.89);roughnessFactor=psR;');
  api.finalFragment=s.fragmentShader;
 };mat.customProgramCacheKey=()=>key()+'/C3-microstructure';mat.needsUpdate=true;api.calibration={...api.calibration,version:'R01-C3',shallowLineNetwork:true,chromaCoupledToFollicles:true,lightingUnchanged:true};v.render();
 };
})();
