// Re-use the accepted R14 instrument byte-for-byte under the shared Fish registry.
// ABI isolation protects its custom WebGL habitat; no new window or remote page.
export function createBarracudaModule(stage){
 let frame=null,api=null,visible=false;
 const modeMap={cruise:'CRUISE',hover:'GLIDE',burst:'BURST',turn:'TURN_LEFT',rest:'REST'};
 async function mount(){
  if(api)return api;
  const html=JSON.parse(document.getElementById('barracudaModule').textContent);
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
  const r=api.renderer,originalFrame=r.frame.bind(r);
  r.frame=now=>{if(!visible){r.last=now;r.raf=frame.contentWindow.requestAnimationFrame(t=>r.frame(t));return;}originalFrame(now);};
  return api;
 }
 function activate(on){visible=on;if(frame)frame.style.display=on?'block':'none';}
 function configure(state){if(!api)return;const r=api.renderer;if(r.state.school!==state.group)r.setSchool(state.group);const mode=modeMap[state.mode]||'CRUISE';if(r.state.mode!==mode)r.setMode(mode);r.state.playing=state.playing;r.state.paths=state.bones;r.state.compare=false;r.state.pointer=state.group;}
 function view(value){if(!api)return;const c=api.renderer.camera;c.setView(value==='side'?'left':value==='top'?'top':'oblique');if(api.renderer.state.school){c.halfWidth=3.3;c.distance=5.5;c.perspective=true;}}
 function reset(){api?.renderer.resetAll();}
 return {mount,activate,configure,view,reset,get api(){return api;},get frame(){return frame;},get visible(){return visible;}};
}
