// Full R04 functions, fibres, AA and integration settings are retained.
let accelerated=true;
const rawBind=bind,rawAllocate=allocate,rawReplaceSource=replaceSource;
let bindPool=new Map(),timingPool=null;
const cacheSet=searchCache.set.bind(searchCache);
searchCache.set=function(k,v){if(!this.has(k)&&this.size>=6)this.delete(this.keys().next().value);return cacheSet(k,v);};
bind=function(slot){if(!bindPool.has(slot))bindPool.set(slot,rawBind(slot));return bindPool.get(slot);};
allocate=function(...args){bindPool.clear();return rawAllocate(...args);};
replaceSource=function(...args){bindPool.clear();return rawReplaceSource(...args);};
function timingResources(count){
 if(timingPool?.count===count)return timingPool;
 if(timingPool){timingPool.read.destroy();timingPool.res.destroy();timingPool.qs.destroy();}
 timingPool={count,qs:device.createQuerySet({type:'timestamp',count:count*2}),res:gpuBuffer(count*16,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC),read:gpuBuffer(count*16,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ)};return timingPool;
}
render=async function({present=true,profile=true}={}){
 if(failed)throw Error('GPU已停止');
 const start=performance.now(),snapshot=params(),n=carrier?0:source.cols*source.rows*material.params.hairDensity;
 const steps=[{name:'controls',x:Math.ceil(W/8),y:Math.ceil(H/8),offset:0},{name:'clearHairs',x:Math.ceil(W/8),y:Math.ceil(H/8),offset:0}];
 const rows=soft?8:H;for(let y=0;y<H;y+=rows)steps.push({name:'render',x:Math.ceil(W/8),y:Math.ceil(Math.min(rows,H-y)/8),offset:y});
 if(accelerated)steps.push({name:'makeDepth',x:Math.ceil(W/8),y:Math.ceil(H/8),offset:0});
 const batch=soft?8192:Math.max(1,n);for(let i=0;i<n;i+=batch){const groups=Math.ceil(Math.min(batch,n-i)/64);steps.push({name:'hairs',x:Math.min(256,groups),y:Math.ceil(groups/256),offset:i});}
 steps.push({name:'composite',x:Math.ceil(W/8),y:Math.ceil(H/8),offset:0});
 if(steps.length>1024)throw Error('当前设置超出分批上限');
 const timing=stamp&&profile?timingResources(steps.length):null,packed=new Uint8Array(steps.length*256);
 for(let i=0;i<steps.length;i++){packed.set(new Uint8Array(snapshot),i*256);new Uint32Array(packed.buffer)[i*64+31]=steps[i].offset;}
 device.queue.writeBuffer(buffers.uniform,0,packed);
 let encoder=device.createCommandEncoder();
 for(let i=0;i<steps.length;i++){
  const s=steps[i],pass=encoder.beginComputePass(timing?{timestampWrites:{querySet:timing.qs,beginningOfPassWriteIndex:i*2,endOfPassWriteIndex:i*2+1}}:{});
  pass.setPipeline(pipes[s.name]);pass.setBindGroup(0,bind(i));pass.dispatchWorkgroups(s.x,s.y);pass.end();
  if(soft&&i<steps.length-1){device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();encoder=device.createCommandEncoder();if(failed)throw Error('GPU执行失败');}
 }
 if(present)encoder.copyTextureToTexture({texture},{texture:ctx.getCurrentTexture()},[W,H]);
 if(timing){encoder.resolveQuerySet(timing.qs,0,steps.length*2,timing.res,0);encoder.copyBufferToBuffer(timing.res,0,timing.read,0,steps.length*16);}
 device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();const wallMs=performance.now()-start;if(failed)throw Error('GPU执行失败');
 const stages={};if(timing){await timing.read.mapAsync(GPUMapMode.READ);const a=new BigUint64Array(timing.read.getMappedRange());steps.forEach((s,i)=>stages[s.name]=(stages[s.name]||0)+Number(a[i*2+1]-a[i*2])/1e6);timing.read.unmap();}
 lastResult={wallMs,gpuMs:timing?Object.values(stages).reduce((a,b)=>a+b,0):null,stages,dispatchedFibres:n,submissionCount:soft?steps.length:1,revision,accelerated,profiled:!!timing,realCompletedFrame:true};return lastResult;
};
const oldStats=updateStats;
updateStats=function(r){oldStats(r);$('budget60').textContent=r.wallMs<=1000/60?'本帧 ≤ 16.67 ms':'距60帧预算 '+(r.wallMs/(1000/60)).toFixed(2)+'×';if(r.gpuMs===null)$('gpu').textContent='定期采样';};
drawOnce=async function(){if(!ready||busy||failed||pending)return;busy=true;dirty=false;const rev=revision;try{const r=await render({profile:frame%15===0});frame++;const now=performance.now();frameTimes.push(now);if(frameTimes.length>60)frameTimes.shift();$('fps').textContent=frameTimes.length>1?((frameTimes.length-1)*1000/(now-frameTimes[0])).toFixed(1):'—';updateStats(r);$('veil').hidden=true;setStatus(soft?'软件后端实测，不代表你的显卡。':'R04同画质 · 真实完成帧 · 16.67ms预算');}catch(e){fatal(e);}finally{busy=false;if(revision!==rev)dirty=true;}};
function quantile(values,p){const a=[...values].sort((x,y)=>x-y),at=(a.length-1)*p,i=Math.floor(at);return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*(at-i);}
function summary(values){return {...stats(values),p95:quantile(values,.95),p99:quantile(values,.99)};}
async function performanceAB(rounds=6){
 const wasLive=live,wasOrbit=orbit,oldAccel=accelerated;live=false;orbit=false;
 return enqueue(async()=>{const trials={original:[],optimized:[]},view=clone(camera),startRev=revision;
  try{
   for(const mode of [false,true]){accelerated=mode;await render({present:false});}
   for(let i=0;i<rounds;i++)for(const mode of (i%2?[true,false]:[false,true])){if(revision!==startRev)throw Error('参数已改变，本轮测速作废。');accelerated=mode;setStatus(`同画质交替 ${i+1}/${rounds} · ${mode?'优化':'原搜索'}`);trials[mode?'optimized':'original'].push(await render({present:false}));}
   const summaries={};for(const k of Object.keys(trials))summaries[k]={wall:summary(trials[k].map(x=>x.wallMs)),gpu:stamp?summary(trials[k].map(x=>x.gpuMs)):null};
   const speedup=summaries.original.wall.median/summaries.optimized.wall.median;
   lastReport={...metadata(),kind:'same-material-interleaved-AB',camera:view,trials,summaries,speedup,targetMs:1000/60,hardware60Verified:false,qualityMustBeCheckedSeparately:true};
   $('measured').textContent=speedup.toFixed(2)+'× · '+summaries.optimized.wall.median.toFixed(2)+' ms';setStatus('同画质交替测量完成；可导出完整记录。');return lastReport;
  }finally{accelerated=oldAccel;live=wasLive;orbit=wasOrbit;dirty=true;}
 });
}
async function motionTest(seconds=5){
 const wasLive=live,wasOrbit=orbit,view=clone(camera);live=false;orbit=false;
 return enqueue(async()=>{const timings=[],ends=[],views=[],start=performance.now();
  try{let i=0;while(performance.now()-start<seconds*1000||i<3){await new Promise(requestAnimationFrame);camera.yaw=view.yaw+i*.009;views.push(clone(camera));const r=await render({profile:i%15===0});timings.push(r);ends.push(performance.now());i++;$('fps').textContent=ends.length>1?((ends.length-1)*1000/(ends.at(-1)-ends[0])).toFixed(1):'—';updateStats(r);}
   const intervals=ends.slice(1).map((x,i)=>x-ends[i]),fps=intervals.length*1000/intervals.reduce((x,y)=>x+y,0);
   lastReport={...metadata(),kind:'continuous-orbit-new-frames',requestedSeconds:seconds,completedFrames:ends.length,actualSeconds:(ends.at(-1)-start)/1000,actualCompletedFPS:fps,intervalsMs:summary(intervals),frameGPUCompletionMs:summary(timings.map(x=>x.wallMs)),timings,views,cachedFrames:0,changedResolution:false,targetFPS:60,passes60Class:!soft&&ends.length>=120&&fps>=59&&quantile(intervals,.95)<=18,notDisplayScanoutMeasurement:true};$('measured').textContent=fps.toFixed(1)+' FPS · P95 '+lastReport.intervalsMs.p95.toFixed(2)+'ms';return lastReport;
  }finally{camera=view;live=wasLive;orbit=wasOrbit;dirty=true;}
 });
}
const controls=document.createElement('div');controls.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 0';controls.innerHTML='<label><input id="fastSearch" type="checkbox" checked> 同画质加速</label><button id="benchAB">原版 / 优化交替实测</button><button id="motion60">连续旋转测60帧目标</button><span id="budget60">目标16.67 ms</span>';
$('bench').parentElement.after(controls);
$('fastSearch').onchange=()=>{accelerated=$('fastSearch').checked;changed();};$('benchAB').onclick=()=>performanceAB().catch(e=>error(e.message));$('motion60').onclick=()=>motionTest().catch(e=>error(e.message));
FabricLab.performanceAB=performanceAB;FabricLab.motionTest=motionTest;FabricLab.setAccelerated=on=>enqueue(async()=>{accelerated=!!on;$('fastSearch').checked=accelerated;changed();});
FabricLab.sourceStats=()=>clone(source.acceleration);
FabricLab.render=()=>enqueue(async()=>{const r=await render();frame++;updateStats(r);return r;});
