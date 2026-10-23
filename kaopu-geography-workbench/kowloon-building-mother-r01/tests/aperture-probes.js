async indexed => {
 const s=window.semanticInspection,r=s.renderer,g=r.gl;
 const {buildPrimaryApertureIndex}=await import(new URL('kowloon-building-mother-r01/whole-building-floor-study-r01/primary-aperture-index.mjs',location.href));
 const {prepareTileFrame}=await import(new URL('kowloon-building-mother-r01/whole-building-ground-r01/tile-visibility.mjs',location.href));
 const parts=r.apertures.flatMap(a=>a.primitives),rows=[];let token=1000;
 if(r.busy)throw Error('Probe requires idle renderer');r.busy=true;r.hitDataComplete=false;
 try {
  r.targets(1,1);g.bindVertexArray(r.vao);g.enable(g.SCISSOR_TEST);g.viewport(0,0,1,1);g.scissor(0,0,1,1);
  for(const part of parts)for(const side of[-1,1])for(const offset of[[0,0],[.95,.95],[.95,-.95],[-.95,.95],[-.95,-.95]]){
   const q=[part.outer.center[0]+part.outer.half[0]*offset[0],part.outer.center[1]+part.outer.half[1]*offset[1]];
   const target=part.origin.map((v,k)=>v+part.u[k]*q[0]+part.v[k]*q[1]+part.w[k]*part.halfDepth*side);
   const eye=target.map((v,k)=>v+part.w[k]*side*Math.max(.35,part.halfDepth*4)),camera={eye,target,fov:Math.PI/4};
   const frame=prepareTileFrame({...camera,width:1,height:1}),idx=buildPrimaryApertureIndex({bounds:r.primaryApertureBounds,frame,width:1,height:1,tileSize:96,token:++token});
   if(!idx)throw Error('Expected reliable aperture probe index');const texture=r.texture(idx),p=r.apertureProgram;
   g.bindFramebuffer(g.FRAMEBUFFER,r.buffers[0].fbo);g.useProgram(p);const L=r.camera(p,1,1,camera);
   g.uniform1i(L('uRayMode'),0);g.uniform1i(L('uFirst'),1);g.uniform1i(L('uClip'),0);g.uniform1i(L('uSlice'),0);
   for(let unit=1;unit<=3;unit++){g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,null);}
   r.bindTexture(p,'uApertureDescriptors',0,r.apertureTexture);r.bindTexture(p,'uPrimaryApertureIndex',6,texture);
   g.uniform1i(L('uPrimaryApertureIndexEnabled'),indexed?1:0);g.uniform1i(L('uPrimaryApertureIndexToken'),token);g.uniform1i(L('uPrimaryApertureIndexRow'),1);
   g.drawArrays(g.TRIANGLES,0,3);await r.complete(false);const fields=[];
   for(let attachment=0;attachment<3;attachment++){g.readBuffer(g.COLOR_ATTACHMENT0+attachment);const data=new Float32Array(4);g.readPixels(0,0,1,1,g.RGBA,g.FLOAT,data);fields.push(Array.from(data));}
   rows.push({partId:part.objectId,side,offset,fields});g.deleteTexture(texture);r.textures=r.textures.filter(t=>t!==texture);
  }
  const error=g.getError();if(error!==g.NO_ERROR)throw Error('Probe GL error '+error);
  const bytes=new TextEncoder().encode(JSON.stringify(rows)),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  return{parts:parts.length,probes:rows.length,hitProbes:rows.filter(x=>x.fields[0][3]>.5).length,sha256:hash,rows};
 } finally {g.disable(g.SCISSOR_TEST);g.bindFramebuffer(g.FRAMEBUFFER,null);r.busy=false;}
}
