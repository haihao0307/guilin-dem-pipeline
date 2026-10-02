import {batchLegacyEyes} from './legacy-eye-batch.js';
import {specializeLegacyShadow} from './legacy-shadow-pass.js';
import {interpolateLegacyPresentation} from './legacy-presentation.js';
// Re-use the accepted R14 instrument byte-for-byte under the shared Fish registry.
// ABI isolation protects its custom WebGL habitat; no new window or remote page.
export function createBarracudaModule(stage){
 let frame=null,api=null,visible=false,running=false,batch=null,shadow=null,presentation=null,mounting=null,lastDraw=-1;
 const modeMap={cruise:'CRUISE',hover:'GLIDE',burst:'BURST',turn:'TURN_LEFT',rest:'REST'};
 async function mountOnce(){
  if(api)return api;
  const carrier=document.getElementById('barracudaModule');let html;
  if(carrier.dataset.encoding==='gzip-base64'){const binary=atob(carrier.textContent.trim()),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);html=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();}else html=JSON.parse(carrier.textContent);
  frame=document.createElement('iframe');frame.title='海狼鱼 · 共用制作系统';frame.id='barracudaViewport';frame.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;display:none';
  stage.prepend(frame);
  const style='<style>html,body,.app,.main,.stage{height:100%!important;width:100%!important;margin:0!important}.app,.main{display:block!important}.topbar,.controls,.footer,.school-dock,.behavior,.hint,.panel-label{display:none!important}#gl{height:100%!important;width:100%!important}</style>';
  frame.srcdoc=html.replace('</head>',style+'<script>globalThis.__FISH_KEEP_CPU_COPY__=true;</script></head>');
  const started=performance.now();
  while(!frame.contentWindow?.__KAOPU_R14__?.ready){
   const error=frame.contentWindow?.__KAOPU_R14__?.error;if(error)throw Error(error);
   if(performance.now()-started>120000)throw Error('海狼鱼模块启动超时');
   await new Promise(r=>setTimeout(r,30));
  }
  api=frame.contentWindow.__KAOPU_R14__;
  const r=api.renderer,originalFrame=r.frame.bind(r);batch=batchLegacyEyes(api);shadow=specializeLegacyShadow(api);presentation=interpolateLegacyPresentation(api);
  r.frame=now=>{if(!visible||document.hidden){r.last=now;running=false;return;}if(lastDraw===now)return;lastDraw=now;running=true;try{originalFrame(now);}finally{presentation.restore();}};
  // ResizeObserver may report hidden zero dimensions. Never clear a valid buffer
  // merely because the module was hidden or its size did not change.
  r.resize=()=>{const rect=r.canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;r.dpr=Math.min(devicePixelRatio||1,1.35);const w=Math.max(1,Math.round(rect.width*r.dpr)),h=Math.max(1,Math.round(rect.height*r.dpr));if(r.canvas.width!==w)r.canvas.width=w;if(r.canvas.height!==h)r.canvas.height=h;};
  return api;
 }
 function mount(){return mounting||(mounting=mountOnce().catch(error=>{mounting=null;throw error;}));}
 function resume(){if(!visible||!api||document.hidden||running)return;running=true;api.renderer.last=0;api.renderer.raf=frame.contentWindow.requestAnimationFrame(t=>api.renderer.frame(t));}
 function activate(on){visible=on;if(frame)frame.style.display=on?'block':'none';if(!on&&api){frame.contentWindow.cancelAnimationFrame(api.renderer.raf);running=false;}else if(on){api?.renderer.resize();resume();}}
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&api){frame.contentWindow.cancelAnimationFrame(api.renderer.raf);running=false;}else resume();});
 function configure(state){if(!api)return;const r=api.renderer;if(r.state.school!==state.group)r.setSchool(state.group);const mode=modeMap[state.mode]||'CRUISE';if(r.state.mode!==mode)r.setMode(mode);r.state.playing=state.playing;r.state.paths=state.bones;r.state.compare=false;r.state.pointer=state.group;}
 function view(value){if(!api)return;const c=api.renderer.camera;c.setView(value==='side'?'left':value==='top'?'top':'oblique');if(api.renderer.state.school){c.halfWidth=3.3;c.distance=5.5;c.perspective=true;}}
 function reset(){api?.renderer.resetAll();}
 return {mount,activate,configure,view,reset,get api(){return api;},get frame(){return frame;},get visible(){return visible;},get eyeBatch(){return batch;},get shadowPass(){return shadow;},get presentation(){return presentation;}};
}
