// R03: stop transferring the repeated donor meso signal from cheek tiles 0/7.
// This is a subtractive, opt-in candidate on the pinned R01/R02 shader.
// R/B, chroma, other atlas tiles, procedural pores, identities and geometry stay intact.
export const MESO_GUARD_VERSION='cheek-meso-guard/r03';
export function patchCheekMeso(source){
 const replace=(a,b)=>{if(source.split(a).length!==2)throw Error('Pinned cheek meso anchor missing/ambiguous: '+a);source=source.replace(a,()=>b);};
 replace('vec3 fBands(highp sampler2DArray tex,vec2 mm){vec3 r=fPatch(tex,mm,vFRest.x>0.?7.:0.,vFRest.x>0.?vec2(14.):vec2(18.));',`vec3 fBands(highp sampler2DArray tex,vec2 mm,bool retainCheekMeso){vec3 r=fPatch(tex,mm,vFRest.x>0.?7.:0.,vFRest.x>0.?vec2(14.):vec2(18.));
 // Neutral height only for these two repeated donor patches, BEFORE native region mixing.
 // Keep the existing samples and derivatives; do not blur RGB or synthesize new lines.
 if(!retainCheekMeso)r.g=.5;`);
 replace('if(vFB.w>.001)r=mix(r,fPatch(tex,mm,7.,vec2(14.)),vFB.w);',`if(vFB.w>.001){vec3 chin=fPatch(tex,mm,7.,vec2(14.));if(!retainCheekMeso)chin.g=.5;r=mix(r,chin,vFB.w);}`);
 replace('fData=fBands(uSamplingAtlas,fMM);fChroma=fBands(uSamplingChroma,fMM);','fData=fBands(uSamplingAtlas,fMM,false);fChroma=fBands(uSamplingChroma,fMM,true);');
 return source;
}
export function attachCheekMesoGuard(skin,{enabled=true}={}){
 if(typeof enabled!=='boolean')throw TypeError('enabled must be boolean');
 if(!skin?.faceExtension||!skin?.samplingExtension)throw Error('Reviewed ET13 FaceSkin and R01 sampling required');
 if(skin.cheekMesoGuard)throw Error('Cheek meso guard already attached');
 const mat=skin.material,before=mat.onBeforeCompile,key=mat.customProgramCacheKey,disposeSkin=skin.dispose;let active=enabled,disposed=false;
 const compile=function(shader){before.call(this,shader);if(active&&!disposed)shader.fragmentShader=patchCheekMeso(shader.fragmentShader);};
 const cache=function(){return key.call(this)+(active&&!disposed?'/'+MESO_GUARD_VERSION:'');};
 const disposeWrapper=function(){api.dispose();return disposeSkin.call(this);};
 const api={
  setEnabled(value){if(disposed)throw Error('Cheek meso guard disposed');if(typeof value!=='boolean')throw TypeError('enabled must be boolean');if(active===value)return;active=value;mat.needsUpdate=true;skin.viewer.render();},
  report(){return{version:MESO_GUARD_VERSION,enabled:active,disposed,removedSignal:'detail atlas G, tiles 0/7 only; includes native chin reuse of tile 7',newTextures:0,newGeometry:0,newUniforms:0,newEditableParameters:0,physicalCalibration:false};},
  dispose(){if(disposed)return;if(mat.onBeforeCompile!==compile||mat.customProgramCacheKey!==cache||skin.dispose!==disposeWrapper)throw Error('Dispose later shader layers first');disposed=true;mat.onBeforeCompile=before;mat.customProgramCacheKey=key;skin.dispose=disposeSkin;delete skin.cheekMesoGuard;mat.needsUpdate=true;skin.viewer.render();}
 };
 mat.onBeforeCompile=compile;mat.customProgramCacheKey=cache;skin.dispose=disposeWrapper;skin.cheekMesoGuard=api;mat.needsUpdate=true;skin.viewer.render();return api;
}
