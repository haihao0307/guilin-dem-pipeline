export function installRenderHealth(viewer){
 const renderer=viewer.renderer,g=renderer.getContext(),old=renderer.debug.onShaderError,errors=[],ext=g.getExtension('WEBGL_debug_renderer_info');
 const caps={fragmentSamplers:g.getParameter(g.MAX_TEXTURE_IMAGE_UNITS),vertexSamplers:g.getParameter(g.MAX_VERTEX_TEXTURE_IMAGE_UNITS),combinedSamplers:g.getParameter(g.MAX_COMBINED_TEXTURE_IMAGE_UNITS),attributes:g.getParameter(g.MAX_VERTEX_ATTRIBS),varyings:g.getParameter(g.MAX_VARYING_VECTORS),maxTextureSize:g.getParameter(g.MAX_TEXTURE_SIZE)};
 const driver=ext?g.getParameter(ext.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);let last=null;
 renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{errors.push({kind:'shader-link',program:gl.getProgramInfoLog(program),vertex:gl.getShaderInfoLog(vertex),fragment:gl.getShaderInfoLog(fragment)});old?.(gl,program,vertex,fragment);};
 const types=new Set(['SAMPLER_2D','SAMPLER_CUBE','SAMPLER_3D','SAMPLER_2D_ARRAY','SAMPLER_2D_SHADOW','SAMPLER_2D_ARRAY_SHADOW','SAMPLER_CUBE_SHADOW','INT_SAMPLER_2D','INT_SAMPLER_2D_ARRAY','UNSIGNED_INT_SAMPLER_2D','UNSIGNED_INT_SAMPLER_2D_ARRAY'].map(k=>g[k]).filter(Number.isFinite));
 // These two names are vertex-only in the pinned ear and Three morph source.
 // Charge every unknown sampler to fragment; do not treat missing source as 0.
 const vertexOnly=new Set(['uE6Packed','morphTargetsTexture']);
 function inspect(){
  const programs=[];for(const item of renderer.info.programs||[]){const p=item.program;if(!p)continue;const linked=!!g.getProgramParameter(p,g.LINK_STATUS);let fs=0,vs=0,combined=0;const names=[];
   if(linked)for(let i=0;i<g.getProgramParameter(p,g.ACTIVE_UNIFORMS);i++){const u=g.getActiveUniform(p,i);if(!types.has(u.type))continue;const base=u.name.replace(/\[.*$/,'');if(vertexOnly.has(base))vs+=u.size;else fs+=u.size;combined+=u.size;names.push({name:u.name,size:u.size,stage:vertexOnly.has(base)?'vertex-contract':'fragment-conservative'});}
   // D3D may release source after linking; an active uniform survives that.
   programs.push({skin:names.some(u=>u.name==='uSDBioLUT'),linked,fragmentSamplers:fs,vertexSamplers:vs,combinedSamplers:combined,names,log:linked?'':g.getProgramInfoLog(p)});
  }
  const glErrors=[];for(let i=0;i<8;i++){const e=g.getError();if(e===g.NO_ERROR)break;glErrors.push(e);}
  const skin=programs.filter(p=>p.skin),valid=!g.isContextLost()&&!errors.length&&!glErrors.length&&skin.length>0&&programs.every(p=>p.linked&&p.fragmentSamplers<=caps.fragmentSamplers&&p.vertexSamplers<=caps.vertexSamplers&&p.combinedSamplers<=caps.combinedSamplers)&&skin.every(p=>p.fragmentSamplers<=16);
  last={version:'SKIN-GPU-HEALTH-2',valid,driver,caps,context:g.getContextAttributes(),contextLost:g.isContextLost(),programs,stageAccounting:'actual active uniforms; pinned vertex-only names; all unknown samplers conservatively counted as fragment',errors:[...errors],glErrors,eyePacking:viewer.skin.eyeColorPacking?.report||null};
  // Finish blocking driver inspection BEFORE the final draw/readPixels pair.
  // The original render path keeps current camera, light and surface choices.
  if(valid){const idle=window.lifelikeIdle?.runtime?.();if(idle?.originalRender)idle.originalRender();else viewer.render();last.postInspectionRedraw=true;}
  return last;
 }
 return{inspect,report:()=>last||{version:'SKIN-GPU-HEALTH-2',caps,driver,valid:false,phase:'awaiting-real-linked-program'},dispose(){renderer.debug.onShaderError=old;}};
}
