/* Same source textures and4096x4096 nine-octave noise, staged for mobile GPUs. */
(function(root){'use strict';
root.installRabbitStartupAdapter=function({renderer,getModule,bundle,send,requestDraw,onFailure}){
 const TextureLoader=getModule('framework/UncompressedTextureLoader');
 const deferred=new Map();let initial=true,noiseKey=null,noiseIndex=0,noisePending=false,failed=false;
 const isMask=path=>/bunnyalpha_(base|tip)\.png$/.test(path);
 const fail=error=>{if(failed)return;failed=true;onFailure(error);};
 function upload(path,texture,callback,cancelled=()=>false){
  const image=new Image();let settled=false,timer=null;
  function bad(e){if(settled)return;settled=true;clearTimeout(timer);if(cancelled()){callback?.();return;}fail(e);}
  image.onload=()=>{if(settled||failed)return;if(cancelled()){settled=true;clearTimeout(timer);callback?.();return;}try{gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.bindTexture(gl.TEXTURE_2D,null);const code=gl.getError();if(code)throw Error('纹理上传WebGL错误 '+code+': '+path);settled=true;clearTimeout(timer);callback?.();}catch(e){if(settled)fail(e);else bad(e);}};
  image.onerror=()=>bad(Error('无法解码原始纹理：'+path));
  parent.ensureRabbitAsset(path).then(url=>{if(cancelled()){settled=true;callback?.();return;}timer=setTimeout(()=>bad(Error('纹理解码等待超时：'+path)),30000);image.src=url;}).catch(bad);
 }
 TextureLoader.load=(path,callback)=>{const texture=gl.createTexture();if(!texture)throw Error('无法分配毛发纹理');
  if(initial&&renderer.proceduralText&&isMask(path)){deferred.set(path,{texture,callback:null,promise:null,cancelled:false});setTimeout(()=>callback?.(),0);}else upload(path,texture,callback);return texture;};
 const originalLoaded=renderer.updateLoadedObjectsCount.bind(renderer);renderer.updateLoadedObjectsCount=function(){send('load-progress',{stage:'decode',message:'解码模型与必要纹理',loaded:this.loadedItemsCount+1,total:this.ITEMS_TO_LOAD});return originalLoaded();};
 const originalLoadData=renderer.loadData.bind(renderer);renderer.loadData=function(){originalLoadData();initial=false;};
 async function ensureMasks(){await Promise.all([...deferred].map(([path,item])=>{if(!item.promise)item.promise=new Promise((resolve,reject)=>{upload(path,item.texture,resolve,()=>item.cancelled);const timer=setInterval(()=>{if(failed){clearInterval(timer);reject(Error('原始遮罩载入失败'));}},100);item.cleanup=()=>clearInterval(timer);}).then(()=>{item.cleanup?.();deferred.delete(path);},error=>{item.cleanup?.();item.promise=null;throw error;});return item.promise;}));}
 const oldPreset=renderer.loadPreset.bind(renderer);renderer.loadPreset=function(...args){for(const item of deferred.values())item.cancelled=true;deferred.clear();return oldPreset(...args);};
 renderer.createNoiseTextureFBO=function(size){
  this.hairAlphaNoiseTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.hairAlphaNoiseTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  this.renderBuffer=gl.createFramebuffer();this.colorBuffer=this.renderBuffer;this.colorRenderbuffer=null;gl.bindFramebuffer(gl.FRAMEBUFFER,this.renderBuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.hairAlphaNoiseTexture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('4096原精度毛发纹理缓冲不可用');gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,null);
 };
 // This wrapper intercepts noise before the original render/blit block. It never
 // lets the original drawScene blit a texture onto itself.
 const originalDraw=renderer.drawScene.bind(renderer);
 function prepareNoise(){
  const key=[renderer.persistence,renderer.lacunarity,renderer.noiseTextSize].join(':');
  if(!noisePending||key!==noiseKey){noiseKey=key;noiseIndex=0;noisePending=true;}
  const size=renderer.noiseTextSize,tile=512,columns=Math.ceil(size/tile),count=columns*columns;
  gl.bindFramebuffer(gl.FRAMEBUFFER,renderer.renderBuffer);gl.viewport(0,0,size,size);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.RASTERIZER_DISCARD);gl.enable(gl.SCISSOR_TEST);
  const x=(noiseIndex%columns)*tile,y=Math.floor(noiseIndex/columns)*tile;gl.scissor(x,y,Math.min(tile,size-x),Math.min(tile,size-y));renderer.drawNoiseTexture();gl.disable(gl.SCISSOR_TEST);gl.bindFramebuffer(gl.FRAMEBUFFER,null);const code=gl.getError();if(code)throw Error('生成原精度毛发纹理时WebGL错误 '+code);
  noiseIndex++;send('load-progress',{stage:'noise',message:'生成4096原精度毛发',loaded:noiseIndex,total:count});
  if(noiseIndex===count){noisePending=false;renderer.recalculateNoiseText=false;}requestDraw();return false;
 }
 renderer.drawScene=function(){if(failed||!this.loaded)return false;if(this.recalculateNoiseText||noisePending){prepareNoise();return false;}originalDraw();return true;};
 return {ensureMasks,get busy(){return noisePending||renderer.recalculateNoiseText;},get deferredCount(){return deferred.size;},get failed(){return failed;},get noiseProgress(){return {index:noiseIndex,total:64};}};
};
})(window);
