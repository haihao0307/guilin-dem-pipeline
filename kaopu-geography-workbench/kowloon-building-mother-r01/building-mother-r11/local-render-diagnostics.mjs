/** Local, user-opened diagnostics only. No network, storage, clipboard, timers,
 * new context creation or rendering. Reads the existing context and statistics.
 */
const number=v=>Number.isFinite(v)?v:null;
const label=v=>typeof v==='string'&&v.length?v:null;
const safely=fn=>{try{return fn();}catch{return null;}};
export function readLocalRenderDiagnostics({renderer=null,state={},canvas=renderer?.canvas,environment=globalThis}={}){
 const gl=renderer?.gl??null,lost=gl?safely(()=>gl.isContextLost?.()??false):null,usable=Boolean(gl&&!lost&&!renderer?.disposed);
 const parameter=key=>usable&&key!==undefined?safely(()=>gl.getParameter(key)):null;
 const extension=usable?safely(()=>gl.getExtension('WEBGL_debug_renderer_info')):null;
 const bounds=safely(()=>canvas?.getBoundingClientRect()),frame=state?.lastStats??null,compiles=Array.isArray(renderer?.compileStats)?renderer.compileStats:[],latestCompile=compiles.at(-1),now=safely(()=>environment.performance?.now());
 const cssWidth=number(bounds?.width),cssHeight=number(bounds?.height),bufferWidth=usable?number(gl.drawingBufferWidth):null,bufferHeight=usable?number(gl.drawingBufferHeight):null;
 return{
  schemaVersion:1,pageVersion:label(state?.version),
  backend:{contextAvailable:usable,contextLost:lost===true,webglVersion:label(parameter(gl?.VERSION)),renderer:extension?label(parameter(extension.UNMASKED_RENDERER_WEBGL)):null,detailAvailable:Boolean(extension)},
  display:{cssWidth,cssHeight,devicePixelRatio:number(environment.devicePixelRatio),canvasWidth:number(canvas?.width),canvasHeight:number(canvas?.height),framebufferWidth:bufferWidth,framebufferHeight:bufferHeight,scaleX:cssWidth>0&&bufferWidth!==null?bufferWidth/cssWidth:null,scaleY:cssHeight>0&&bufferHeight!==null?bufferHeight/cssHeight:null,lastFrameWidth:number(frame?.width),lastFrameHeight:number(frame?.height)},
  frame:{available:Boolean(frame),busy:Boolean(state?.busy||renderer?.busy),firstFrame:typeof frame?.firstFrame==='boolean'?frame.firstFrame:null,cancelled:typeof frame?.cancelled==='boolean'?frame.cancelled:null,requestRevision:number(frame?.requestRevision),ageMs:Number.isFinite(now)&&Number.isFinite(state?.lastPresentedAt)?Math.max(0,now-state.lastPresentedAt):null,cpuPrepareMs:number(frame?.cpuPrepareWallMs),cpuSubmitMs:number(frame?.cpuSubmitWallMs),fenceWaitMs:number(frame?.fenceWallMs),totalMs:number(frame?.wallMs)},
  compile:{latestProgram:label(latestCompile?.name),latestMs:number(latestCompile?.compileLinkWallMs),contextTotalMs:compiles.length?compiles.reduce((sum,c)=>sum+(number(c.compileLinkWallMs)??0),0):null},
  notice:'只在当前页面显示，不自动上传、不持久保存。等待包含队列、驱动和轮询开销，不是纯 GPU 时间；首帧还可能含延迟编译。软件 GPU 测试不能代替本机实测，也不能据此把卡顿归因于你的电脑。'
 };
}
const value=(v,digits=1)=>v===null?'未知':typeof v==='number'?v.toFixed(digits):v;
const dimensions=(w,h)=>`${value(w)} × ${value(h)}`;
export function formatLocalRenderDiagnostics(s){return[
 `页面版本：${value(s.pageVersion)}`,
 `WebGL 版本：${value(s.backend.webglVersion)}`,
 `渲染后端：${value(s.backend.renderer)}${s.backend.detailAvailable?'':'（扩展不可用）'}`,
 ...(s.backend.contextLost?['当前 WebGL 上下文已丢失']:!s.backend.contextAvailable?['当前没有可读取的 WebGL 上下文']:[]),
 `CSS 视口：${dimensions(s.display.cssWidth,s.display.cssHeight)} px；DPR：${value(s.display.devicePixelRatio,2)}`,
 `实际 framebuffer：${dimensions(s.display.framebufferWidth,s.display.framebufferHeight)} px`,
 `canvas 属性尺寸：${dimensions(s.display.canvasWidth,s.display.canvasHeight)} px`,
 `实际像素 / CSS：${value(s.display.scaleX,3)} × ${value(s.display.scaleY,3)}`,
 `最近完成帧：${dimensions(s.display.lastFrameWidth,s.display.lastFrameHeight)} px；${!s.frame.available?'暂无记录':s.frame.firstFrame===true?'首帧':s.frame.firstFrame===false?'后续帧':'阶段未知'}${s.frame.busy?'；新帧计算中，以下仍为上次记录':''}`,
 `最近编译/链接：${value(s.compile.latestMs)} ms（${value(s.compile.latestProgram)}，非每帧开销）`,
 `本上下文累计编译/链接：${value(s.compile.contextTotalMs)} ms`,
 `帧准备：${value(s.frame.cpuPrepareMs)} ms`,
 `命令提交：${value(s.frame.cpuSubmitMs)} ms`,
 `fence 等待：${value(s.frame.fenceWaitMs)} ms（非纯 GPU 时间）`,
 `整帧总耗时：${value(s.frame.totalMs)} ms`,
 `完成画面距今：${value(s.frame.ageMs)} ms`,
 '编译和等待可能重叠，不将这些分项直接相加。'
].join('\n');}
export function createLocalRenderDiagnostics({host,getRenderer=()=>null,getState=()=>({}),canvas=null,id='localRenderDiagnostics'}={}){
 if(!host?.ownerDocument)throw Error('Local diagnostics host element required');
 const doc=host.ownerDocument,environment=doc.defaultView??globalThis,details=doc.createElement('details'),summary=doc.createElement('summary'),notice=doc.createElement('p'),refreshButton=doc.createElement('button'),output=doc.createElement('pre');
 details.id=id;details.className='local-render-diagnostics';summary.textContent='本机渲染诊断（不上传）';notice.textContent='展开或手动刷新时读取，仅在本页显示；不上传、不持久保存，也不会重新绘制。';refreshButton.type='button';refreshButton.textContent='刷新本机诊断';output.style.maxHeight='300px';output.style.overflow='auto';output.setAttribute('aria-live','polite');details.append(summary,notice,refreshButton,output);host.append(details);
 let lastSnapshot=null,destroyed=false;
 function refresh(){if(destroyed||!details.open)return null;lastSnapshot=readLocalRenderDiagnostics({renderer:safely(getRenderer),state:safely(getState)??{},canvas,environment});output.textContent=formatLocalRenderDiagnostics(lastSnapshot);notice.textContent=lastSnapshot.notice;return lastSnapshot;}
 const toggle=()=>{if(details.open)refresh();};details.addEventListener('toggle',toggle);refreshButton.addEventListener('click',refresh);
 return{element:details,refresh,getSnapshot:()=>lastSnapshot?structuredClone(lastSnapshot):null,destroy(){if(destroyed)return;destroyed=true;details.removeEventListener('toggle',toggle);refreshButton.removeEventListener('click',refresh);details.remove();lastSnapshot=null;}};
}
