/* Test-only first actual draw. Same shader/uniforms/720x400 ray coordinates.
 * Stops the normal frame deliberately after reading one pixel. NEVER acceptance. */
(()=>{const proto=WebGL2RenderingContext.prototype,draw=proto.drawArrays;let used=false;
 proto.drawArrays=function(...args){if(used)throw Error('A4_DIAGNOSTIC_ONLY_STOP');used=true;
  const original=Array.from(this.getParameter(this.SCISSOR_BOX)),x=original[0]+Math.floor(original[2]/2),y=original[1]+Math.floor(original[3]/2),ext=this.getExtension('WEBGL_debug_renderer_info'),started=performance.now();
  const base={started_ms:started,source:'pressure',partId:'boiler/outer_steel_shell',nativeBuffer:[this.drawingBufferWidth,this.drawingBufferHeight],originalScissor:original,probeScissor:[x,y,1,1],renderer:this.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:this.RENDERER),wholeFrame:false};
  window.reportNativePixelProbe({...base,phase:'before-native-pixel-draw'}).catch(()=>{});
  this.scissor(x,y,1,1);draw.apply(this,args);this.finish();const pixels=new Uint8Array(4);this.readPixels(x,y,1,1,this.RGBA,this.UNSIGNED_BYTE,pixels);
  const result={...base,phase:'after-finish-and-readback',elapsed_ms:performance.now()-started,rgba:Array.from(pixels),glError:this.getError(),contextLost:this.isContextLost()};window.__A4_NATIVE_PIXEL_RESULT=result;window.reportNativePixelProbe(result).catch(()=>{});
  throw Error('A4_DIAGNOSTIC_ONLY_STOP_NOT_A_WHOLE_FRAME');
 };
})();
