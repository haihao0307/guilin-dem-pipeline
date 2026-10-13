import {LipViewer} from '../lip-structure/LipViewer.mjs';
/** Loading is not animation. Coalesce texture callbacks, constructor draws and
 * initial camera/layout changes into one FULL-quality startup render. After
 * startup this delegates to the original render exactly; no lower LOD, lower
 * render-target resolution, disabled diffusion or replacement material. */
const originalRender=LipViewer.prototype.render,originalDispose=LipViewer.prototype.dispose;
LipViewer.prototype.render=function(){
 if(!this.active||this.inLipUpdate||!this.startupRenderable)return;
 if(!this.startupFinalFrame){
  const skin=this.skin,host=globalThis.fullCommonWorkbench?.diagnostics?.();
  const ready=skin?.faceExtension?.ready&&skin?.naturalEyeExtension?.ready&&host?.ready&&!host.busy;
  if(!ready){
   const p=globalThis.__LIP_STARTUP__;if(p){p.coalescedStartupDraws=(p.coalescedStartupDraws||0)+1;p.stage='准备完整材质 / 合并初始化绘制';}
   if(!this.startupDrawRAF)this.startupDrawRAF=requestAnimationFrame(()=>{this.startupDrawRAF=0;if(this.active)this.render();});
   return;
  }
  this.startupFinalFrame=true;cancelAnimationFrame(this.startupDrawRAF);this.startupDrawRAF=0;
  const p=globalThis.__LIP_STARTUP__;if(p)p.events.push({stage:'完整材质和原控件已就绪 / 首次完整绘制',ms:performance.now()});
 }
 return originalRender.call(this);
};
LipViewer.prototype.dispose=function(){cancelAnimationFrame(this.startupDrawRAF);this.startupDrawRAF=0;return originalDispose.call(this);};
