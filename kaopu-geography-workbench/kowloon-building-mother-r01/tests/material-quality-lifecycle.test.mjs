import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {GenerationScope} from '../gpu-recovery-r01/async-scope.mjs';
import {LatestFrameScheduler} from '../gpu-recovery-r01/frame-scheduler.mjs';
const nativeSetTimeout=globalThis.setTimeout,nativeClearTimeout=globalThis.clearTimeout;
const wait=ms=>new Promise(resolve=>nativeSetTimeout(resolve,ms));
async function until(fn){for(let i=0;i<150;i++){if(fn())return;await wait(10);}throw Error('Mock application condition not reached');}
function makeGl(canvas){
 let next=0,epoch=1,lost=false;const syncs=new Set(),errors=[],calls=[];
 const base={NO_ERROR:0,INVALID_OPERATION:1282,CONTEXT_LOST_WEBGL:37442,TIMEOUT_EXPIRED:37147,ALREADY_SIGNALED:37146,CONDITION_SATISFIED:37148,WAIT_FAILED:37149,hold:false,calls,drawSizes:[],drawRecords:[],boundFramebuffer:null,viewportRect:null,scissorRect:null,scissorOn:false,
 bindFramebuffer(target,value){base.boundFramebuffer=value;calls.push('bindFramebuffer');},viewport(...r){base.viewportRect=r;},scissor(...r){base.scissorRect=r;},enable(x){if(x==='SCISSOR_TEST')base.scissorOn=true;},disable(x){if(x==='SCISSOR_TEST')base.scissorOn=false;},
 drawArrays(){calls.push('drawArrays');base.drawSizes.push({width:canvas.width,height:canvas.height});base.drawRecords.push({framebuffer:base.boundFramebuffer?.id??null,viewport:base.viewportRect,clip:base.scissorOn?base.scissorRect:null});base.onDraw?.();},
 isContextLost:()=>lost,isSync:o=>syncs.has(o),getError:()=>errors.shift()??0,
 fenceSync(){calls.push('fence');const o={kind:'sync',id:++next,epoch};syncs.add(o);return o;},
 deleteSync:o=>{calls.push('deleteSync');syncs.delete(o);},
 clientWaitSync(o){calls.push('wait');if(lost)return base.WAIT_FAILED;if(!syncs.has(o)){errors.push(base.INVALID_OPERATION);return base.WAIT_FAILED;}return base.hold?base.TIMEOUT_EXPIRED:base.ALREADY_SIGNALED;},
 getParameter:name=>String(name).startsWith('MAX_')?(base.caps?.[name]??4096):'Mock GPU, not real WebGL',getShaderParameter:()=>true,getProgramParameter:()=>true,checkFramebufferStatus:()=> 'FRAMEBUFFER_COMPLETE',
 getExtension(name){if(name==='WEBGL_lose_context')return {loseContext(){lost=true;syncs.clear();globalThis.setTimeout(()=>canvas.emit('webglcontextlost',{preventDefault(){},statusMessage:'injected mock loss'}),0);},restoreContext(){lost=false;epoch++;syncs.clear();globalThis.setTimeout(()=>canvas.emit('webglcontextrestored',{}),0);}};return {UNMASKED_RENDERER_WEBGL:'MOCK_RENDERER'};}
 };
 return new Proxy(base,{get(target,key){if(key in target)return target[key];if(typeof key==='string'&&key.toUpperCase()===key)return key;if(String(key).startsWith('create'))return ()=>({kind:key,id:++next,epoch});if(key==='getUniformLocation')return ()=>({id:++next});return (...args)=>{calls.push(key);if((key==='deleteProgram'||key==='deleteTexture'||key==='deleteFramebuffer'||key==='deleteVertexArray')&&args[0]?.epoch!==epoch)throw Error('Deleted an old-generation GL object');};}});
}
async function fixture({search='?gpu-test=1',box={width:1200,height:800},settle=true,hold=false,caps={}}={}){
 const originals={};for(const key of ['window','document','location','fetch','requestAnimationFrame','cancelAnimationFrame','ResizeObserver','setTimeout','clearTimeout'])originals[key]=globalThis[key];
 const timers=new Set();globalThis.setTimeout=(fn,ms,...args)=>{const timer=nativeSetTimeout(()=>{timers.delete(timer);fn(...args);},ms);timers.add(timer);return timer;};globalThis.clearTimeout=timer=>{timers.delete(timer);nativeClearTimeout(timer);};
 class Element {constructor(id){this.id=id;this.hidden=false;this.value='0';this.width=1;this.height=1;this.style={};this.dataset={};this.classList={toggle(){}};this.listeners=new Map();this.textContent='';}addEventListener(name,fn){const list=this.listeners.get(name)??[];list.push(fn);this.listeners.set(name,list);}emit(name,event){for(const fn of this.listeners.get(name)??[])fn(event);}getBoundingClientRect(){return box;}replaceChildren(){}append(){}setPointerCapture(){}}
 const html=fs.readFileSync(new URL('../material-quality-r01.html',import.meta.url),'utf8'),elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,new Element(id)]));
 const canvas=elements.get('view'),gl=makeGl(canvas);gl.hold=hold;gl.caps=caps;canvas.getContext=()=>gl;
 const win=new Element('window');globalThis.window=win;globalThis.document={getElementById:id=>{if(!elements.has(id))throw Error('Missing HTML element '+id);return elements.get(id);},querySelectorAll:()=>[],createElement:id=>new Element(id)};globalThis.location={search};globalThis.fetch=async url=>new Response(fs.readFileSync(fileURLToPath(url)),{status:200});globalThis.requestAnimationFrame=fn=>globalThis.setTimeout(fn,0);globalThis.cancelAnimationFrame=globalThis.clearTimeout;globalThis.ResizeObserver=class{observe(){}};
 try{await import('../material-quality-r01/app.mjs?mock='+Math.random());assert(win.__IMPLICIT_BUILDING__?.apiAvailable,JSON.stringify(win.__IMPLICIT_BUILDING__));if(settle)await win.__IMPLICIT_BUILDING__.awaitSettled();}
 catch(error){for(const timer of timers)nativeClearTimeout(timer);Object.assign(globalThis,originals);throw error;}
 return {gl,elements,api:win.__IMPLICIT_BUILDING__,recovery:win.__GPU_RECOVERY__,quality:win.__MATERIAL_QUALITY__,close(){for(const timer of timers)nativeClearTimeout(timer);Object.assign(globalThis,originals);}};
}

test('material ordinary cold startup uses bounded async initialization, never QA readback (mock GL)',async()=>{
 const f=await fixture();try{const s=f.recovery.snapshot();assert(f.api.ready);assert.equal(s.initialization.budgetMs,60000);assert.equal(s.maxWaitMs,15000);assert.equal(f.gl.calls.includes('finish'),false);assert.equal(f.gl.calls.includes('readPixels'),false);assert.equal(f.gl.drawSizes[0].width,1);assert.equal(s.resources.qualityInitialization.required,true);}finally{f.close();}
});
test('QA invalidation followed by quality render drains safely, independently warms FBO, and presents (mock GL)',async()=>{
 const f=await fixture();try{f.api.probe([[0,0,0]]);const scheduling=f.api.scheduling();assert.notEqual(scheduling.lastDispatch.revision,scheduling.revision);assert.equal(scheduling.pendingCallbacks,0);const before=f.gl.drawRecords.length,first=await f.quality.render({width:32,height:24,samplesPerAxis:2,tileSide:16});assert.equal(first.status,'complete');assert.equal(first.done,first.total);assert.equal(first.initialization.reused,false);assert.equal(first.initialization.domain,'quality-rgba8');assert.equal(first.initialization.pixelCount,1);assert.equal(first.initialization.budgetMs,60000);assert.equal(first.initialization.ordinaryTileBudgetMs,15000);const draws=f.gl.drawRecords.slice(before);assert.deepEqual(draws[0].clip,[32,24,1,1]);assert.equal(draws[0].framebuffer,draws[1].framebuffer);assert.equal(f.recovery.snapshot().currentResolution.width,32);assert(f.api.ready);assert.equal(f.api.scheduling().lastDispatch.revision,f.api.scheduling().revision);const second=await f.quality.render({width:48,height:32,samplesPerAxis:2,tileSide:16});assert.equal(second.status,'complete');assert.equal(second.initialization.reused,true);assert.equal(second.initialization.fenceElapsedMs,null);}finally{f.close();}
});
test('quality owner is acquired before first await so duplicate requests cannot compete (mock GL)',async()=>{
 const f=await fixture();try{const first=f.quality.render({width:16,height:16});await assert.rejects(f.quality.render({width:16,height:16}),/measurement is in progress/);await first;assert.equal(f.quality.snapshot().job.id,1);}finally{f.close();}
});
test('cancel offscreen initialization rejects promptly and never presents partial tiles (mock GL)',async()=>{
 const f=await fixture();try{f.gl.hold=true;const before=f.gl.drawRecords.length;const task=f.quality.render({width:32,height:24}),rejected=assert.rejects(task,{name:'AbortError'});await until(()=>f.quality.snapshot().job.status==='initializing');assert.equal(f.recovery.snapshot().pending.metadata.initializationDomain,'quality-rgba8');f.quality.cancel();await rejected;assert.equal(f.quality.snapshot().job.status,'cancelled');assert.equal(f.quality.snapshot().job.done,0);assert.equal(f.recovery.snapshot().pending.phase,'initialization');assert.equal(f.gl.drawRecords.length,before+1);assert.equal(f.recovery.snapshot().recoveryAttempts,0);f.gl.hold=false;await f.api.awaitSettled();assert.equal(f.recovery.snapshot().state,'active');}finally{f.close();}
});
test('context loss during quality initialization aborts old job and rebuilds new resources (mock GL)',async()=>{
 const f=await fixture();try{f.gl.hold=true;const initial=f.recovery.snapshot();const task=f.quality.render({width:32,height:24}),rejected=assert.rejects(task,{name:'AbortError'});await until(()=>f.quality.snapshot().job.status==='initializing');f.recovery.test.loseContext();await rejected;assert.equal(f.quality.snapshot().job.status,'cancelled');f.gl.hold=false;f.recovery.test.restoreContext();await until(()=>f.api.ready);assert.equal(f.recovery.snapshot().generation,initial.generation+1);assert.equal(f.recovery.snapshot().resources.qualityInitialization.required,true);const fresh=await f.quality.render({width:16,height:16});assert.equal(fresh.status,'complete');assert.equal(fresh.initialization.reused,false);assert.equal(f.recovery.snapshot().resourceRebuilds,1);}finally{f.close();}
});
test('click during screen initialization gives local feedback without false global failure (mock GL)',async()=>{
 const f=await fixture({hold:true,settle:false});try{await until(()=>f.recovery.snapshot().pendingFence);await f.elements.get('quality-render').onclick();assert.equal(f.recovery.snapshot().state,'initializing');assert.equal(f.api.snapshot().errors.length,0);assert.match(f.elements.get('quality-progress').textContent,/初始化/);assert.equal(f.quality.snapshot().job,null);}finally{f.close();}
});
test('quality output budget rejects invalid requests before starting a job (mock GL)',async()=>{
 const f=await fixture();try{const rendererState=f.recovery.snapshot().resources;assert(rendererState.capabilities.maxTextureUnits>=9);await assert.rejects(f.quality.render({width:841,height:1}),/budget/);assert.equal(f.quality.snapshot().job,null);}finally{f.close();}
});

test('actual renderer resource boundaries reject unavailable unit 8 and oversized supersampled targets (mock GL)',async()=>{
 for(const [caps,request,error] of [[{MAX_TEXTURE_IMAGE_UNITS:8},{width:16,height:16},/nine units/],[{MAX_TEXTURE_SIZE:64,MAX_RENDERBUFFER_SIZE:64},{width:64,height:64},/GPU dimensions/]]){
  const f=await fixture({caps});try{await assert.rejects(f.quality.render(request),error);assert.equal(f.quality.snapshot().job.status,'failed');assert.equal(f.recovery.snapshot().lastFailure,null);}finally{f.close();}
 }
});

test('presentation already submitted is not falsely reported as cancelled or previous-frame retained (mock GL)',async()=>{
 const f=await fixture();try{f.gl.onDraw=()=>{if(f.quality.snapshot().job?.status==='presenting')f.gl.hold=true;};const task=f.quality.render({width:16,height:16});await until(()=>f.quality.snapshot().job?.status==='presenting'&&f.recovery.snapshot().pendingFence);const result=f.quality.cancel();assert.equal(result.job.cancelled,false);assert.equal(f.elements.get('quality-cancel').disabled,true);assert.match(result.job.message,/无法撤回/);f.gl.hold=false;const completed=await task;assert.equal(completed.status,'complete');}finally{f.close();}
});
