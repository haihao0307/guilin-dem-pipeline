import {LipViewer} from '../lip-structure/LipViewer.mjs';
/** Startup/shutdown are not animation. Keep final geometry, textures, diffusion
 * and render-target size unchanged. After startup delegate original rendering.
 * Capture pagehide before host cleanup: MotionStudio.clear() calls resize(),
 * which otherwise issues another full diffusion render while the page leaves. */
const originalRender=LipViewer.prototype.render,originalDispose=LipViewer.prototype.dispose;
if(typeof window!=='undefined')window.addEventListener('pagehide',()=>{const v=window.__IDENTITY_QA__?.viewer?.();if(v){v.startupShuttingDown=true;cancelAnimationFrame(v.startupDrawRAF);v.startupDrawRAF=0;}},{capture:true});
LipViewer.prototype.render=function(){
 if(!this.active||this.startupShuttingDown||this.inLipUpdate||!this.startupRenderable)return;
 if(!this.startupFinalFrame){
  const skin=this.skin,host=globalThis.fullCommonWorkbench?.diagnostics?.();
  const ready=skin?.faceExtension?.ready&&skin?.naturalEyeExtension?.ready&&host?.ready&&!host.busy;
  if(!ready)this.startupStableFrames=0;
  // Allow the original texture-ready callbacks and ResizeObserver to finish
  // their initial layout/camera changes before drawing the complete material.
  if(!ready||(this.startupStableFrames||0)<2){
   const p=globalThis.__LIP_STARTUP__;if(p){p.coalescedStartupDraws=(p.coalescedStartupDraws||0)+1;p.stage='准备完整材质 / 合并初始化绘制';}
   if(!this.startupDrawRAF)this.startupDrawRAF=requestAnimationFrame(()=>{this.startupDrawRAF=0;if(this.active&&!this.startupShuttingDown){this.startupStableFrames=(this.startupStableFrames||0)+1;this.render();}});
   return;
  }
  this.startupFinalFrame=true;cancelAnimationFrame(this.startupDrawRAF);this.startupDrawRAF=0;
  const p=globalThis.__LIP_STARTUP__;if(p)p.events.push({stage:'完整材质和原控件已就绪 / 首次完整绘制',ms:performance.now()});
 }
 return originalRender.call(this);
};
LipViewer.prototype.dispose=function(){this.startupShuttingDown=true;cancelAnimationFrame(this.startupDrawRAF);this.startupDrawRAF=0;return originalDispose.call(this);};
