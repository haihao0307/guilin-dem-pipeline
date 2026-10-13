export function installRenderHealth(viewer){
 const renderer=viewer.renderer,g=renderer.getContext(),old=renderer.debug.onShaderError,errors=[],ext=g.getExtension('WEBGL_debug_renderer_info');
 const caps={fragmentSamplers:g.getParameter(g.MAX_TEXTURE_IMAGE_UNITS),vertexSamplers:g.getParameter(g.MAX_VERTEX_TEXTURE_IMAGE_UNITS),combinedSamplers:g.getParameter(g.MAX_COMBINED_TEXTURE_IMAGE_UNITS),attributes:g.getParameter(g.MAX_VERTEX_ATTRIBS),varyings:g.getParameter(g.MAX_VARYING_VECTORS),maxTextureSize:g.getParameter(g.MAX_TEXTURE_SIZE)};
 const driver=ext?g.getParameter(ext.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);
 let last=null;
 renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{errors.push({kind:'shader-link',program:gl.getProgramInfoLog(program),vertex:gl.getShaderInfoLog(vertex),fragment:gl.getShaderInfoLog(fragment)});old?.(gl,program,vertex,fragment);};
 const types=new Set(['SAMPLER_2D','SAMPLER_CUBE','SAMPLER_3D','SAMPLER_2D_ARRAY','SAMPLER_2D_SHADOW','SAMPLER_2D_ARRAY_SHADOW','SAMPLER_CUBE_SHADOW','INT_SAMPLER_2D','INT_SAMPLER_2D_ARRAY','UNSIGNED_INT_SAMPLER_2D','UNSIGNED_INT_SAMPLER_2D_ARRAY'].map(k=>g[k]).filter(Number.isFinite));
 function inspect(){
  const programs=[];for(const item of renderer.info.programs||[]){const p=item.program;if(!p)continue;const linked=!!g.getProgramParameter(p,g.LINK_STATUS),shaders=(g.getAttachedShaders(p)||[]).map(s=>({type:g.getShaderParameter(s,g.SHADER_TYPE),source:g.getShaderSource(s)||''})),fragment=shaders.find(s=>s.type===g.FRAGMENT_SHADER)?.source||'',vertex=shaders.find(s=>s.type===g.VERTEX_SHADER)?.source||'';let fs=0,vs=0,combined=0;const names=[];
   if(linked)for(let i=0;i<g.getProgramParameter(p,g.ACTIVE_UNIFORMS);i++){const u=g.getActiveUniform(p,i);if(!types.has(u.type))continue;const base=u.name.replace(/\[.*$/,''),re=new RegExp('\\b'+base+'\\b');if(re.test(fragment))fs+=u.size;if(re.test(vertex))vs+=u.size;combined+=u.size;names.push({name:u.name,size:u.size});}
   programs.push({skin:fragment.includes('uSDBioLUT'),linked,fragmentSamplers:fs,vertexSamplers:vs,combinedSamplers:combined,names,log:linked?'':g.getProgramInfoLog(p)});
  }
  const glErrors=[];for(let i=0;i<8;i++){const e=g.getError();if(e===g.NO_ERROR)break;glErrors.push(e);}
  const skin=programs.filter(p=>p.skin),valid=!g.isContextLost()&&!errors.length&&!glErrors.length&&skin.length>0&&programs.every(p=>p.linked&&p.fragmentSamplers<=caps.fragmentSamplers&&p.vertexSamplers<=caps.vertexSamplers&&p.combinedSamplers<=caps.combinedSamplers)&&skin.every(p=>p.fragmentSamplers<=16);
  last={version:'SKIN-GPU-HEALTH-1',valid,driver,caps,context:g.getContextAttributes(),contextLost:g.isContextLost(),programs,errors:[...errors],glErrors,eyePacking:viewer.skin.eyeColorPacking?.report||null};return last;
 }
 return{inspect,report:()=>last||{version:'SKIN-GPU-HEALTH-1',caps,driver,valid:false,phase:'awaiting-real-linked-program'},dispose(){renderer.debug.onShaderError=old;}};
}
