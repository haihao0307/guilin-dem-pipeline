from pathlib import Path
import re,json,hashlib
r=Path(__file__).parent
core=(r/'core.wgsl').read_text()
# Extend only the uniform contract; all R04 material parameters and geometry remain unchanged.
old='pattern:vec4<f32>, fibre:vec4<f32>, }'
assert core.count(old)==1
core=core.replace(old,'pattern:vec4<f32>, fibre:vec4<f32>, optimization:vec4<f32>, }')
# Pull the direct analytic solver from the R06 research implementation.
research=(r/'direct_solver.wgsl').read_text()
direct=research
anchor='fn softShadow('
assert core.count(anchor)==1
core=core.replace(anchor,direct+'\n'+anchor,1)
oldray='fn renderRay(rd:vec3<f32>,w:array<f32,6>)->vec4<f32>{'
assert core.count(oldray)==1
core=core.replace(oldray,'fn renderRayMarch(rd:vec3<f32>,w:array<f32,6>)->vec4<f32>{',1)
anchor2='@compute @workgroup_size(8,8) fn render('
assert core.count(anchor2)==1
core=core.replace(anchor2,'fn renderRay(rd:vec3<f32>,w:array<f32,6>)->vec4<f32>{if(g.optimization.y>.5&&g.fibre.w<.5){return renderRayDirect(rd,w);}return renderRayMarch(rd,w);}\n'+anchor2,1)
# Add direct/fallback counters in the existing hair accumulation buffer.
oldclear='@compute @workgroup_size(8,8) fn clearHairs(@builtin(global_invocation_id) gid:vec3<u32>){if(any(gid.xy>=g.dims.xy)){return;}let i=(gid.y*g.dims.x+gid.x)*4u;for(var j=0u;j<4u;j++){atomicStore(&hairAccum[i+j],0u);}}'
newclear='@compute @workgroup_size(8,8) fn clearHairs(@builtin(global_invocation_id) gid:vec3<u32>){if(any(gid.xy>=g.dims.xy)){return;}let i=(gid.y*g.dims.x+gid.x)*4u;for(var j=0u;j<4u;j++){atomicStore(&hairAccum[i+j],0u);}if(gid.x==0u&&gid.y==0u){atomicStore(&hairAccum[g.dims.x*g.dims.y*4u],0u);atomicStore(&hairAccum[g.dims.x*g.dims.y*4u+1u],0u);}}'
assert core.count(oldclear)==1
core=core.replace(oldclear,newclear)
(r/'core.wgsl').write_text(core)

app=(r/'app.js').read_text()
app=app.replace("VERSION='KNIT-MATERIAL-R04'", "VERSION='KNIT-MATERIAL-R06'")
app=app.replace("let editorTab='source',editorDirty=false,compileCache=new Map(),visibleSource='';", "let editorTab='source',editorDirty=false,compileCache=new Map(),visibleSource='',directMode=false;")
app=app.replace("[['policy',32],['pixels',16],['hairAccum',16]]", "[['policy',32],['pixels',16],['hairAccum',16]]")
app=app.replace("buffers[k]=gpuBuffer(W*H*bpp,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC);", "buffers[k]=gpuBuffer(W*H*bpp+(k==='hairAccum'?16:0),GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC);")
app=app.replace('new ArrayBuffer(208)', 'new ArrayBuffer(224)')
app=app.replace('f.set([p.hairDiameter,p.curl,p.undercoat,carrier?1:0],48);return b;', 'f.set([p.hairDiameter,p.curl,p.undercoat,carrier?1:0],48);f.set([0,directMode?1:0,0,0],52);return b;')
app=app.replace('offset:slot*256,size:208', 'offset:slot*256,size:224')
app=app.replace("sourceFullFidelityAccepted:false,revision,lastResult", "sourceFullFidelityAccepted:false,surfaceSolver:directMode?'R06 direct parametric yarn solve':'R04 128-step field marcher',targetFrameTimeMs:16.667,targetFrameTimeReductionPercent:80,revision,lastResult")
needle="async function readPixels(){const b=buffers.pixels,r=gpuBuffer(b.size,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ),e=device.createCommandEncoder();e.copyBufferToBuffer(b,0,r,0,b.size);device.queue.submit([e.finish()]);await r.mapAsync(GPUMapMode.READ);const a=new Float32Array(r.getMappedRange().slice(0));r.unmap();r.destroy();return a;}"
assert needle in app
app=app.replace(needle,needle+"\nasync function readSolverStats(){const b=buffers.hairAccum,r=gpuBuffer(b.size,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ),e=device.createCommandEncoder();e.copyBufferToBuffer(b,0,r,0,b.size);device.queue.submit([e.finish()]);await r.mapAsync(GPUMapMode.READ);const a=new Uint32Array(r.getMappedRange().slice(0));r.unmap();r.destroy();const direct=a[W*H*4+1],fallback=a[W*H*4];return{directSamples:direct,fallbackSamples:fallback,directShare:direct/Math.max(1,direct+fallback)};}")
# Compare modes on the exact same resolution/material, with alternating order.
anchor3='async function benchmark(){'
insert=r'''async function compareSolvers(){
 const wasLive=live;live=false;return enqueue(async()=>{const previous=directMode;const trials={field:[],direct:[]};try{
  directMode=false;await render({present:false});directMode=true;await render({present:false});
  for(let i=0;i<6;i++){for(const route of (i%2?['direct','field']:['field','direct'])){directMode=route==='direct';trials[route].push(await render({present:false}));}}
  directMode=true;await render({present:false});const solverCoverage=await readSolverStats();
  const summary={};for(const route of ['field','direct']){const xs=trials[route].map(x=>x.wallMs).sort((a,b)=>a-b);const gs=trials[route].map(x=>x.gpuMs).filter(Number.isFinite).sort((a,b)=>a-b);summary[route]={n:xs.length,median:(xs[2]+xs[3])/2,min:xs[0],max:xs.at(-1),gpuMedian:gs.length?(gs[2]+gs[3])/2:null};}
  const reduction=(1-summary.direct.median/summary.field.median)*100;const gpuReduction=summary.field.gpuMedian&&summary.direct.gpuMedian?(1-summary.direct.gpuMedian/summary.field.gpuMedian)*100:null;const targetGpuMs=summary.field.gpuMedian?summary.field.gpuMedian*.2:null;lastReport={...metadata(),comparison:'R04 field marcher vs R06 direct parametric yarn solve',timestampUTC:new Date().toISOString(),summary,solverCoverage,frameTimeReductionPercent:reduction,gpuTimeReductionPercent:gpuReduction,speedup:summary.field.median/summary.direct.median,targetReductionPercent:80,targetFrameMs:1000/60,targetGpuMs,targetPassed:reduction>=80&&summary.direct.median<=1000/60&&gpuReduction!==null&&gpuReduction>=80&&summary.direct.gpuMedian<=targetGpuMs,trials};
  $('measured').textContent=`R06 ${reduction.toFixed(1)}% / ${summary.direct.median.toFixed(2)} ms`;setStatus(lastReport.targetPassed?'达到80%帧时间与GPU耗时双门槛，等待视觉验收。':'尚未达到80%帧时间降低与GPU耗时双门槛。');return lastReport;
 }finally{directMode=previous;changed();$('solver').textContent=directMode?'R06直接求交：开启':'R06直接求交：关闭';live=wasLive;}});
}
'''
assert app.count(anchor3)==1
app=app.replace(anchor3,insert+anchor3)
app=app.replace("$('bench').onclick=()=>benchmark().catch(e=>error(e.message));", "$('bench').onclick=()=>benchmark().catch(e=>error(e.message));$('solver').onclick=()=>enqueue(async()=>{directMode=!directMode;changed();$('solver').classList.toggle('active',directMode);$('solver').textContent=directMode?'R06直接求交：开启':'R06直接求交：关闭';setStatus(directMode?'R06直接求交实验路径':'恢复R04原始场步进');}).catch(e=>error(e.message));$('compareSolvers').onclick=()=>compareSolvers().catch(e=>error(e.message));")
app=app.replace('read:readPixels,select:selectMaterial', 'read:readPixels,readSolverStats,setSolver:value=>enqueue(async()=>{directMode=!!value;changed();}),compareSolvers,select:selectMaterial')
(r/'app.js').write_text(app)

shell=(r/'shell.html').read_text().replace('R04 · 同一面片，独立材质','R06 · 直接函数求交实验，80%目标待验收')
shell=shell.replace('<button id="pause">暂停</button>', '<button id="solver">R06直接求交：关闭</button><button id="pause">暂停</button>')
shell=shell.replace('<button id="bench">本材质实测 6 帧</button><button id="report">导出测量</button>', '<button id="bench">本材质实测 6 帧</button><button id="compareSolvers">R04 / R06 交替对比</button><button id="report">导出测量</button>')
shell=shell.replace('R04</title>','R06</title>')
shell=shell.replace('极密、极长绒毛会增加计算；这里不预填其他设备的帧率，也不宣称达到原版全部纤维精度。','R06直接求交以单次射线求解替代128步场步进；掠射与未收敛射线保留R04回退。80%帧时间降低和60FPS必须同时通过，未通过不晋级。')
(r/'shell.html').write_text(shell)
# Rebuild standalone directly from the patched R04 core and existing materials.
html=shell.replace('/*DATA*/','const CORE='+json.dumps(core,ensure_ascii=False)+';\nconst DEFAULT_MATERIAL='+json.dumps((r/'material.wgsl').read_text(),ensure_ascii=False)+';\nconst PRESET_DATA='+(r/'presets.json').read_text()+';').replace('/*APP*/',app)
(r/'index.html').write_text(html)
(r/'BUILD.json').write_text(json.dumps({'version':'KNIT-MATERIAL-R06','sha256':hashlib.sha256(html.encode()).hexdigest(),'bytes':len(html.encode()),'baseRuntime':'R04 accepted material and fibre renderer','solver':'R06 direct parametric yarn intersection; R04 marcher fallback','qualityInvariants':{'resolution':[640,480],'defaultFibreCount':491520,'fibreSegments':8,'samplesPerPixel':2,'triangles':0},'validation':{'shaderCompile':False,'browser':False,'pixelEquivalence':False,'80PercentReduction':False,'hardware60FPS':False}},indent=2))
print('R06 patched',len(html.encode()),hashlib.sha256(html.encode()).hexdigest())
