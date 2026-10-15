/** Keep native face diffusion, but never shade clothing in its two skin buffers.
 * The full beauty pass remains authoritative for visibility. Its exact WebGL2
 * depth is copied before each skin pass, so sleeves, collars and eyebrows still
 * occlude the skin. No cloth geometry, yarn instances or skin weights are cut.
 * This adapter targets the retained, pinned Three r170 renderer only.
 */
export function installFacePassRouting(viewer){
 const renderer=viewer.renderer, diffusion=viewer.faceDiffusion;
 if(!diffusion?.targets?.length)return null;
 const gl=renderer.getContext(),render=renderer.render.bind(renderer),channel=31;
 const stats={enabled:true,skinPasses:0,depthCopies:0,fallbackPasses:0,method:'same-frame beauty depth + native-skin auxiliary passes',removedVisibleGeometry:false};
 renderer.render=(scene,camera)=>{
  const target=renderer.getRenderTarget(),targets=diffusion.targets;
  if(!stats.enabled||scene!==viewer.scene||(target!==targets[1]&&target!==targets[2]))return render(scene,camera);
  const source=targets[0],sourceFB=renderer.properties.get(source).__webglFramebuffer;
  if(!sourceFB||Array.isArray(sourceFB)||!target.depthTexture||!source.depthTexture||source.depthTexture.type!==target.depthTexture.type||source.depthTexture.format!==target.depthTexture.format||source.samples!==0||target.samples!==0||source.width!==target.width||source.height!==target.height||gl.isContextLost()){
   stats.fallbackPasses++;return render(scene,camera);
  }
  const oldRead=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),oldMask=camera.layers.mask,oldMeshMask=viewer.mesh.layers.mask;
  const oldClear=renderer.autoClear,oldBackground=scene.background,lights=[];
  try{
   // DRAW_FRAMEBUFFER is the already selected auxiliary target. Restoring only
   // READ_FRAMEBUFFER keeps Three's cached draw target consistent with WebGL.
   gl.bindFramebuffer(gl.READ_FRAMEBUFFER,sourceFB);
   gl.blitFramebuffer(0,0,source.width,source.height,0,0,target.width,target.height,gl.DEPTH_BUFFER_BIT,gl.NEAREST);
   gl.bindFramebuffer(gl.READ_FRAMEBUFFER,oldRead);stats.depthCopies++;
   scene.traverse(o=>{if(o.isLight){lights.push([o,o.layers.mask]);o.layers.enable(channel);}});
   viewer.mesh.layers.enable(channel);camera.layers.set(channel);
   // The native diffusion renderer already cleared this target immediately
   // before calling render. A second automatic clear would erase copied depth.
   renderer.autoClear=false;scene.background=null;
   const result=render(scene,camera);stats.skinPasses++;return result;
  }finally{
   gl.bindFramebuffer(gl.READ_FRAMEBUFFER,oldRead);
   camera.layers.mask=oldMask;viewer.mesh.layers.mask=oldMeshMask;
   for(const [light,mask]of lights)light.layers.mask=mask;
   renderer.autoClear=oldClear;scene.background=oldBackground;
  }
 };
 const audit=()=>({...stats,occlusion:'exact current beauty-pass depth',nativeFaceDiffusionPreserved:true});
 viewer.facePassRouting={audit,setEnabled:value=>{stats.enabled=!!value;viewer.render();}};
 return viewer.facePassRouting;
}
