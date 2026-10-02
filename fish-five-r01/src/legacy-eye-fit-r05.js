// Preserve the measured aperture and moving iris; fit its axial relief to the source eye.
// The immutable R14 geometry/carrier remain unchanged. This is a runtime shader adapter.
export function sourceEyeFit(api){
 const desc=api.renderer.h.metadata.continuum.eyes.eyes;
 const dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0);
 const depth=e=>dot(e.pupilCenterM.map((v,k)=>v-e.globeCenterM[k]),e.outwardNormal);
 // Both source eye centers were located 4.86mm behind their measured pupil.
 // Match that relief (rather than adding a 12.5mm spherical crown in front).
 const ratios=desc.map(e=>(depth(e)+(e.embedM||0))/e.globeRadiusM);
 if(ratios.some(x=>!Number.isFinite(x)||x<.35||x>.65)||Math.abs(ratios[0]-ratios[1])>1e-5)throw Error('Measured eye relief outside R05 fit ABI');
 const relief=ratios[0];
 function vertex(source){const anchor='vec3 world=uCenter+uTangent*local.x+uUp*local.y+uOutward*local.z;';if(!source.includes(anchor))throw Error('Eye surface fit ABI mismatch');return source.replace(anchor,`local.z*=${relief.toFixed(8)};n=normalize(vec3(n.xy,n.z/${relief.toFixed(8)}));\n${anchor}`);}
 function fragment(source){const replacements=[
 ['vec3(.035,.040,.034),vec3(.23,.24,.17)','vec3(.055,.065,.070),vec3(.27,.29,.28)'],
 ['vec3(.012,.014,.012),vec3(.075,.064,.035)','vec3(.075,.085,.09),vec3(.18,.20,.20)'],
 ['vec3(.11,.075,.018),gold=vec3(.74,.50,.09),pale=vec3(.96,.80,.30)','vec3(.12,.115,.085),gold=vec3(.50,.47,.32),pale=vec3(.67,.64,.49)'],
 ['c+s*.20','c+s*.10'],['c+s*.22','c+s*.12'],['h1*.65+h2*.18,.10+fres*.22','h1*.30+h2*.09,.075+fres*.15']
 ];let out=source;for(const [a,b] of replacements){if(!out.includes(a))throw Error('Eye material fit ABI mismatch '+a);out=out.replace(a,b);}return out;}
 return {vertex,fragment,proof:{version:'SOURCE_EYE_APERTURE_RELIEF_R05',sourcePupilDepthM:desc.map(depth),axialReliefScale:relief,originalCrownM:desc.map(e=>e.globeRadiusM-(e.embedM||0)),fittedCrownM:desc.map(depth),apertureRadiiM:desc.map(e=>e.measuredOpeningRadiusM),irisRadiusUnchanged:true,pupilRadiusUnchanged:true,gazeControllerUnchanged:true,bodyGeometryUnchanged:true}};
}

// Restore source-texture tonal continuity at the eye/socket margin. The old
// 92 percent uniform-black mask created a dark cut-out beyond the globe.
export function installLegacyEyeRim(api){
 const r=api.renderer,gl=r.gl,old='tex=mix(tex,vec3(.055,.065,.06),eyeMask*.92);',replacement='tex=mix(tex,gray*vec3(.92,1.0,1.02),eyeMask*.55);',programs=[];
 for(const key of ['program','habitatProgram']){
  const previous=r[key],attached=gl.getAttachedShaders(previous),sources=attached.map(s=>({type:gl.getShaderParameter(s,gl.SHADER_TYPE),source:gl.getShaderSource(s)}));
  const fragment=sources.find(s=>s.type===gl.FRAGMENT_SHADER);
  if(!fragment.source.includes(old))throw Error('Source eye rim shader ABI mismatch');
  fragment.source=fragment.source.replace(old,replacement);
  const program=gl.createProgram();for(const x of sources){const shader=gl.createShader(x.type);gl.shaderSource(shader,x.source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);gl.deleteShader(shader);}gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));r[key]=program;programs.push({key,previous,program});
 }
 return {programs,sourceTexturePixelsUnchanged:true,sourceBodyVertexShadersUnchanged:true,oldNeutralMask:.92,newSourceGrayMix:.55};
}
