// Diagnostic ablation only. No production installation, added marks or geometry.
export const CHANNELS=Object.freeze(['host','atlasMicro','atlasMeso','pores','atlasRoughness','identityHeight']);
export function attachReliefProbe(skin){
 const mat=skin.material,before=mat.onBeforeCompile,key=mat.customProgramCacheKey,U={};let disposed=false;
 for(const k of CHANNELS)U['uProbe_'+k]={value:1};U.uProbeRotation={value:0};U.uProbeSeams={value:0};
 mat.onBeforeCompile=shader=>{before.call(mat,shader);Object.assign(shader.uniforms,U);
  let source=shader.fragmentShader;const replace=(a,b)=>{if(source.split(a).length!==2)throw Error('Diagnostic anchor missing/ambiguous: '+a);source=source.replace(a,()=>b);};
  replace('uniform float uRLipFiltering,','uniform float uProbeRotation,uProbeSeams;uniform float '+CHANNELS.map(k=>'uProbe_'+k).join(',')+';\nuniform float uRLipFiltering,');
  replace('float csHeight=csSurface*csDetail*csCover*(1.-vFA.x*uFEnabled*.65);','float csHeight=csSurface*csDetail*csCover*(1.-vFA.x*uFEnabled*.65)*mix(1.,uProbe_host,fMask);');
  replace('(fData.r-.5)*.000032*uFDetail','(fData.r-.5)*.000032*uFDetail*uProbe_atlasMicro');
  replace('(fData.g-.5)*.000090*uFMeso','(fData.g-.5)*.000090*uFMeso*uProbe_atlasMeso');
  replace('h+=fPores(fMM)*.000006*uFDetail','h+=fPores(fMM)*.000006*uFDetail*uProbe_pores');
  replace('(fData.b-.5)*.18*fMask*fHostDetail','(fData.b-.5)*.18*fMask*fHostDetail*uProbe_atlasRoughness');
  replace('float iHeight=(iRelief.r-iRelief.g)*.001*iMask*clamp(csDetail/.72,0.,2.1);','float iHeight=(iRelief.r-iRelief.g)*.001*iMask*clamp(csDetail/.72,0.,2.1)*uProbe_identityHeight;');
  replace('vec2 uv=(fract(mm/span)*252.+2.)/256.;',`vec2 probeMM=mix(mm,vec2(-mm.y,mm.x),uProbeRotation);vec2 uv=(fract(probeMM/span)*252.+2.)/256.;`);
  replace('vec2 dx=fSamplingDX/span*(252./256.),dy=fSamplingDY/span*(252./256.);',`vec2 dx=mix(fSamplingDX,vec2(-fSamplingDX.y,fSamplingDX.x),uProbeRotation)/span*(252./256.),dy=mix(fSamplingDY,vec2(-fSamplingDY.y,fSamplingDY.x),uProbeRotation)/span*(252./256.);`);
  replace('if(uRDebug>.5)outgoingLight=',`if(uProbeSeams>.5){vec2 q=fract(fMM/(vFRest.x>0.?14.:18.)),e=min(q,1.-q);float edge=1.-smoothstep(0.,.025,min(e.x,e.y));outgoingLight=mix(outgoingLight,vec3(1.,0.,0.),edge*fMask*vFB.y*(1.-vFA.y));}
   if(uRDebug>.5)outgoingLight=`);
  shader.fragmentShader=source;
 };
 mat.customProgramCacheKey=()=>key.call(mat)+'/diagnostic-relief-ablation/1';mat.needsUpdate=true;
 return{set(disabled=[],options={}){if(disposed)throw Error('Probe disposed');for(const k of disabled)if(!CHANNELS.includes(k))throw Error('Unknown probe channel');for(const k of CHANNELS)U['uProbe_'+k].value=disabled.includes(k)?0:1;U.uProbeRotation.value=options.rotate?1:0;U.uProbeSeams.value=options.seams?1:0;skin.viewer.render();},dispose(){if(disposed)return;disposed=true;mat.onBeforeCompile=before;mat.customProgramCacheKey=key;mat.needsUpdate=true;skin.viewer.render();}};
}
