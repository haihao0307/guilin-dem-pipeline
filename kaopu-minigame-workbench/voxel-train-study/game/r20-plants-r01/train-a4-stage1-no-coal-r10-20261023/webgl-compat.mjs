/** Context compatibility only. No model, material, texture or animation changes. */
export function createCompatibleRenderer(T,{createCanvas=()=>document.createElement('canvas'),onAttempt=()=>{}}={}) {
  const diagnostics={phase:'context-creation',attempts:[],selected:null,modelDownloadStarted:false};
  const profiles=[{id:'standard',antialias:true},{id:'reduced-context',antialias:false}];
  for(const profile of profiles) {
    const canvas=createCanvas(),events=[];
    const attributes={alpha:false,depth:true,stencil:false,antialias:profile.antialias,
      premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'default',
      failIfMajorPerformanceCaveat:false};
    canvas.addEventListener?.('webglcontextcreationerror',event=>events.push(String(event.statusMessage||'')));
    const attempt={profile:profile.id,requested:attributes,events,created:false};
    diagnostics.attempts.push(attempt);onAttempt(attempt);
    let context;
    try { context=canvas.getContext('webgl2',attributes); }
    catch(error) {
      attempt.error=String(error.message||error);canvas.remove?.();
      // Do not retry an explicit browser security denial with other options.
      if(error.name==='SecurityError') {
        const blocked=new Error('浏览器拒绝创建 WebGL2 图形上下文；未下载模型，未修改浏览器设置。');
        blocked.code='WEBGL_CONTEXT_BLOCKED';blocked.diagnostics=diagnostics;throw blocked;
      }
    }
    if(!context){canvas.remove?.();continue;}
    attempt.created=true;attempt.actual=context.getContextAttributes?.()??null;
    // A shader/library error after context creation is not a compatibility retry.
    let renderer;
    try {renderer=new T.WebGLRenderer({canvas,context,...attributes});}
    catch(error){context.getExtension?.('WEBGL_lose_context')?.loseContext();canvas.remove?.();error.diagnostics=diagnostics;throw error;}
    diagnostics.selected=profile.id;diagnostics.phase='context-ready';
    return {renderer,diagnostics};
  }
  const error=new Error('浏览器未能创建 WebGL2 图形上下文，标准和低资源初始化均未成功。模型尚未开始下载。请先关闭其他 3D 页面后重试；若仍失败，需要检查浏览器图形能力。此页面不会改动你的浏览器设置。');
  error.code='WEBGL_CONTEXT_UNAVAILABLE';error.diagnostics=diagnostics;throw error;
}

