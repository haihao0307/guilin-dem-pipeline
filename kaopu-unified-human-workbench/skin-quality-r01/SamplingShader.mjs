export function patchSkinSamplingShader(source){
 const replace=(a,b)=>{if(source.split(a).length!==2)throw new Error('Pinned ET13 sampling anchor is missing or ambiguous: '+a);source=source.replace(a,()=>b);};
 replace('uniform sampler2D uFAtlas,uFChroma;','uniform highp sampler2DArray uFAtlas,uFChroma;\nvec2 fSamplingDX,fSamplingDY;');
 replace('vec3 fPatch(sampler2D tex,vec2 mm,float tile,vec2 span){return texture2D(tex,fAtlasUV(mm,tile,span)).rgb;}',`vec3 fPatch(highp sampler2DArray tex,vec2 mm,float tile,vec2 span){
  // Derivatives come from continuous rest millimetres BEFORE fract and the
  // region branches. Per-layer mip chains cannot mix nose/cheek/lip tiles.
  vec2 uv=(fract(mm/span)*252.+2.)/256.;
  vec2 dx=fSamplingDX/span*(252./256.),dy=fSamplingDY/span*(252./256.);
  return textureGrad(tex,vec3(uv,tile),dx,dy).rgb;
 }`);
 replace('vec3 fBands(sampler2D tex,vec2 mm)','vec3 fBands(highp sampler2DArray tex,vec2 mm)');
 replace('vec2 fMM=vFRest.xy*1000.;float fMask=', 'vec2 fMM=vFRest.xy*1000.;fSamplingDX=dFdx(fMM);fSamplingDY=dFdy(fMM);float fMask=');
 return source;
}
