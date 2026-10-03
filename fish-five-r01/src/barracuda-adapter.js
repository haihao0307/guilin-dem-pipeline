import {readCarrierBytes,loadPhase} from './asset-reader-r06.js';
import {installLegacyEyeRim} from './legacy-eye-fit-r05.js';
import {batchLegacyEyes} from './legacy-eye-batch.js';
import {specializeLegacyShadow} from './legacy-shadow-pass.js';
import {interpolateLegacyPresentation} from './legacy-presentation.js';
import {installLegacyCranial} from './legacy-cranial-r04.js';
import {patchLegacySampling} from './legacy-sampling-r04.js';
import {decodeLegacyPacket,stageLegacyPacket} from './legacy-packet-r07.js';
import {installLegacyMath,releaseLegacySourceCopies} from './legacy-math-r07.js';
import {installLegacySchool} from './legacy-school-r08.js';
import {fitLegacyOverview} from './legacy-overview-r08.js';
import {patchCompactLegacyR10} from './compact-legacy-r10.js';
// Preserve the accepted R14 carrier; runtime sampling skips only unread fin rows.
// ABI isolation protects its custom WebGL habitat; no new window or remote page.
export function createBarracudaModule(stage){
 let frame=null,api=null,visible=false,running=false,batch=null,shadow=null,presentation=null,cranial=null,mounting=null,lastDraw=-1,blobUrl=null,staged=null,epoch=0,math=null,memory=null,school=null,overview=null;
 const modeMap={cruise:'CRUISE',hover:'GLIDE',burst:'BURST',turn:'TURN_LEFT',rest:'REST'};
 async function mountOnce(){
  if(api)return api;
  const attempt=++epoch,carrier=document.getElementById('barracudaModule');let html;
  if(carrier.dataset.format==='FCP10_LEGACY_GZIP'){const bytes=await readCarrierBytes(carrier,'barracuda');loadPhase('barracuda','decode');const raw=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());if(attempt!==epoch)throw new DOMException('Selection cancelled','AbortError');const program=JSON.parse(document.getElementById('compactLegacyProgram').textContent);staged=stageLegacyPacket({html:program,scoreBytes:raw});html=staged.html;}else if(carrier.dataset.encoding==='fbr7-gzip-base64'){const bytes=await readCarrierBytes(carrier,'barracuda');loadPhase('barracuda','decode');const unpacked=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());if(attempt!==epoch)throw new DOMException('Selection cancelled','AbortError');staged=stageLegacyPacket(decodeLegacyPacket(unpacked));html=staged.html;
  }else if(carrier.dataset.encoding==='gzip-base64'){const bytes=await readCarrierBytes(carrier,'barracuda');loadPhase('barracuda','decode');html=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();}else html=JSON.parse(carrier.textContent);
  if(attempt!==epoch)throw new DOMException('Selection cancelled','AbortError');
  frame=document.createElement('iframe');frame.title='海狼鱼 · 共用制作系统';frame.id='barracudaViewport';frame.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;display:none';
  stage.prepend(frame);
  loadPhase('barracuda','prepare');
  const style='<style>html,body,.app,.main,.stage{height:100%!important;width:100%!important;margin:0!important}.app,.main{display:block!important}.topbar,.controls,.footer,.school-dock,.behavior,.hint,.panel-label{display:none!important}#gl{height:100%!important;width:100%!important}</style>';
  html=patchLegacySampling(html).replace('</head>',style+'<script>globalThis.__FISH_KEEP_CPU_COPY__=true;globalThis.__FISH_BOOT_CONTEXTS_R07__=new Set();const fishGetContextR07=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){const context=fishGetContextR07.call(this,type,...args);if(context&&/webgl/i.test(type))__FISH_BOOT_CONTEXTS_R07__.add(context);return context;};addEventListener("error",e=>{globalThis.__FISH_IFRAME_BOOT_ERROR__=e.message;});addEventListener("unhandledrejection",e=>{globalThis.__FISH_IFRAME_BOOT_ERROR__=String(e.reason?.message||e.reason);});</script></head>');
  // A file iframe inherits its creator through srcdoc. Its FBR7 program is only
  if(carrier.dataset.format==='FCP10_LEGACY_GZIP')html=patchCompactLegacyR10(html);
  // about1MB. Online Blob navigation avoids retaining the HTML in a DOM attribute.
  if(location.protocol==='file:')frame.srcdoc=html;else{blobUrl=URL.createObjectURL(new Blob([html],{type:'text/html'}));frame.src=blobUrl;}
  const started=performance.now();
  while(attempt===epoch&&!frame.contentWindow?.__KAOPU_R14__?.ready){
   const error=frame.contentWindow?.__FISH_IFRAME_BOOT_ERROR__||frame.contentWindow?.__KAOPU_R14__?.error;if(error)throw Error(error);
   if(performance.now()-started>120000)throw Error('海狼鱼模块启动超时');
   await new Promise(r=>setTimeout(r,30));
  }
  if(attempt!==epoch)throw new DOMException('Selection cancelled','AbortError');
  api=frame.contentWindow.__KAOPU_R14__;
  const r=api.renderer,originalFrame=r.frame.bind(r);frame.contentWindow.cancelAnimationFrame(r.raf);cranial=await installLegacyCranial(api);const eyeRim=installLegacyEyeRim(api);api.eyeRimR05=eyeRim;batch=batchLegacyEyes(api);math=installLegacyMath(api);shadow=specializeLegacyShadow(api);school=installLegacySchool(api);presentation=interpolateLegacyPresentation(api);overview=fitLegacyOverview(api);cranial.attach();memory=releaseLegacySourceCopies(api,cranial);api.mathR07=math;api.memoryR07=memory;for(const p of cranial.programs)r.gl.deleteProgram(p.original);
  if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null;}staged?.release();staged=null;
  r.frame=now=>{if(!visible||document.hidden){r.last=now;running=false;return;}if(lastDraw===now)return;lastDraw=now;running=true;try{originalFrame(now);}finally{presentation.restore();}};
  // ResizeObserver may report hidden zero dimensions. Never clear a valid buffer
  // merely because the module was hidden or its size did not change.
  r.resize=()=>{const rect=r.canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;r.dpr=Math.min(devicePixelRatio||1,1.35);const w=Math.max(1,Math.round(rect.width*r.dpr)),h=Math.max(1,Math.round(rect.height*r.dpr));if(r.canvas.width!==w)r.canvas.width=w;if(r.canvas.height!==h)r.canvas.height=h;};
  return api;
 }
 function mount(){if(mounting)return mounting;const job=mountOnce();mounting=job;job.catch(()=>{if(mounting===job){unmount();}});return job;}
 function unmount(){epoch++;visible=false;running=false;if(api){const r=api.renderer;frame?.contentWindow.cancelAnimationFrame(r.raf);try{overview?.dispose();presentation?.dispose();school?.dispose();batch?.dispose();shadow?.dispose();r.dispose();}catch(error){console.warn('Legacy release',error);}}try{for(const gl of frame?.contentWindow?.__FISH_BOOT_CONTEXTS_R07__||[])gl.getExtension('WEBGL_lose_context')?.loseContext();}catch{}if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=null;staged?.release();staged=null;frame?.remove();frame=null;api=null;batch=shadow=presentation=cranial=math=memory=school=overview=null;mounting=null;lastDraw=-1;}
 function resume(){if(!visible||!api||document.hidden||running)return;running=true;api.renderer.last=0;api.renderer.raf=frame.contentWindow.requestAnimationFrame(t=>api.renderer.frame(t));}
 function activate(on){if(!on){unmount();return;}visible=true;if(frame)frame.style.display='block';api?.renderer.resize();resume();}
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&api){frame.contentWindow.cancelAnimationFrame(api.renderer.raf);running=false;}else resume();});
 function configure(state){if(!api)return;const r=api.renderer;if(r.state.school!==state.group)r.setSchool(state.group);const mode=modeMap[state.mode]||'CRUISE';if(r.state.mode!==mode)r.setMode(mode);r.state.playing=state.playing;r.state.paths=state.bones;r.state.compare=false;r.state.pointer=state.group;}
 function view(value){if(!api)return;const c=api.renderer.camera;c.setView(value==='side'||value==='head'?'left':value==='top'?'top':'oblique');if(value==='head'){const h=api.renderer.h,e=h.metadata.continuum.eyes.eyes,center=e.reduce((v,x)=>v.map((q,k)=>q+x.globeCenterM[k]/e.length),[0,0,0]);c.target=[(h.metadata.continuum.body.sourceXM+center[0])*.5,center[1]-.01,0];c.zoom=3.8;c.halfWidth=.58;c.distance=1.55;c.perspective=false;}if(api.renderer.state.school){c.halfWidth=3.3;c.distance=5.5;c.perspective=true;}}
 function reset(){api?.renderer.resetAll();}
 return {mount,activate,configure,view,reset,dispose:unmount,get api(){return api;},get frame(){return frame;},get visible(){return visible;},get eyeBatch(){return batch;},get shadowPass(){return shadow;},get presentation(){return presentation;},get overview(){return overview;},get cranial(){return cranial;},get math(){return math;},get memory(){return memory;}};
}
