from pathlib import Path
import shutil,json,hashlib
root=Path(__file__).parent
src=root/'knit-material-r06'
dst=root/'knit-material-r07'
if dst.exists(): shutil.rmtree(dst)
shutil.copytree(src,dst,ignore=shutil.ignore_patterns('evidence','qa.mjs','patch_r06.py'))
core=(dst/'core.wgsl').read_text()
core=core.replace('var<storage,read_write> hairAccum:array<atomic<u32>>;','var<storage,read_write> hairAccum:array<atomic<u32>>;\nstruct HairCache { points:array<vec4<f32>,9>, meta:vec4<f32>, }\n@group(0) @binding(8) var<storage,read_write> hairCache:array<HairCache>;')
core=core.replace('@compute @workgroup_size(64) fn hairs(', '@compute @workgroup_size(64) fn hairsLegacy(',1)
prep='''@compute @workgroup_size(64) fn prepareHairs(@builtin(global_invocation_id) gid:vec3<u32>){
 if(g.fibre.w>.5||g.appearance.x<.001){return;}
 let index=gid.x+gid.y*16384u+g.dims.w;let count=u32(g.fabric.z);let total=u32(g.fabric.x*g.fabric.y)*count;
 if(index>=total||count==0u){return;}
 let needle=index/count;let col=needle%u32(g.fabric.x);let row=needle/u32(g.fabric.x);let j=index%count;
 let id=(row*4099u+col)*997u+j+u32(g.pattern.z)*391u;let at=hash(id*13u+4u);let seg=min(79u,u32(at*80.));let s=segs[seg];let u=fract(at*80.);
 let T=normalize(s.b.xyz-s.a.xyz);let B=normalize(cross(T,vec3<f32>(0.,0.,1.))+vec3<f32>(1.e-9));let W=normalize(cross(B,T));
 let theta=hash(id*7u+1u)*TAU;let Q=normalize(B*cos(theta)+W*sin(theta));
 let root=mix(s.a.xyz,s.b.xyz,u)+vec3<f32>(f32(col)*g.geom.x,f32(row)*g.geom.x*.5*g.geom.y,0.)-swatchShift()+Q*(materialYarnRadius(f32(col)+at,theta,f32(row))+.025);
 let population=hash(id*29u);let len=g.fabric.w*(.3+.7*pow(hash(id*31u),1.2))*select(1.,1.7,population>.985);
 var cached:HairCache;cached.points[0]=vec4<f32>(root,1.);
 for(var k=1u;k<=8u;k++){cached.points[k]=vec4<f32>(strandPoint(root,T,B,W,Q,id,f32(k)/8.,len),1.);}
 let light=normalize(vec3<f32>(-.6,.65,1.));let nl=max(0.,dot(Q,light));let wrap=.40+.38*sqrt(max(0.,1.-pow(dot(T,light),2.)));
 cached.meta=vec4<f32>(f32(col)+at,f32(row),(wrap+nl*.9)*(.86+.28*hash(id*97u)),0.);hairCache[index]=cached;
}
'''
core=core.replace('@compute @workgroup_size(8,8) fn clearHairs(',prep+'\n@compute @workgroup_size(8,8) fn clearHairs(',1)
cached='''@compute @workgroup_size(64) fn hairs(@builtin(global_invocation_id) gid:vec3<u32>){
 if(g.fibre.w>.5||g.appearance.x<.001){return;}
 let index=gid.x+gid.y*16384u+g.dims.w;let count=u32(g.fabric.z);let total=u32(g.fabric.x*g.fabric.y)*count;
 if(index>=total||count==0u){return;}
 let cached=hairCache[index];let fiberColor=materialColor(cached.meta.xy)*cached.meta.z;var a=project(cached.points[0].xyz);
 for(var k=1u;k<=8u;k++){
  let b=project(cached.points[k].xyz);if(min(a.z,b.z)<1.){a=b;continue;}
  let physicalRadius=g.fibre.x*.5*g.view.y/(g.view.z*(a.z+b.z));let radius=max(.55,physicalRadius);
  let lo=max(vec2<i32>(0),vec2<i32>(floor(min(a.xy,b.xy)-vec2<f32>(radius+1.))));let hi=min(vec2<i32>(g.dims.xy)-vec2<i32>(1),vec2<i32>(ceil(max(a.xy,b.xy)+vec2<f32>(radius+1.))));
  let d=b.xy-a.xy;let dd=max(.000001,dot(d,d));
  for(var y=lo.y;y<=hi.y;y++){for(var x=lo.x;x<=hi.x;x++){
   let xy=vec2<f32>(f32(x)+.5,f32(y)+.5);let t=clamp(dot(xy-a.xy,d)/dd,0.,1.);let edge=length(xy-a.xy-d*t);
   let cover=(1.-smoothstep(max(0.,radius-.5),radius+.5,edge))*min(1.,physicalRadius/.55);if(cover<.002){continue;}
   let z=1./mix(1./a.z,1./b.z,t);let pi=u32(y)*g.dims.x+u32(x);let baseDepth=pixels[pi].w*dot(direction(xy),g.forward.xyz);if(z>baseDepth+.025){continue;}
   let tau=min(.7,cover*.38*g.appearance.x);let weight=u32(tau*65536.);let off=pi*4u;
   atomicAdd(&hairAccum[off],u32(fiberColor.x*f32(weight)));atomicAdd(&hairAccum[off+1u],u32(fiberColor.y*f32(weight)));atomicAdd(&hairAccum[off+2u],u32(fiberColor.z*f32(weight)));atomicAdd(&hairAccum[off+3u],weight);
  }}a=b;
 }
}
'''
core=core.replace('@compute @workgroup_size(8,8) fn composite(',cached+'\n@compute @workgroup_size(8,8) fn composite(',1)
(dst/'core.wgsl').write_text(core)
app=(dst/'app.js').read_text().replace("VERSION='KNIT-MATERIAL-R06'","VERSION='KNIT-MATERIAL-R07'")
app=app.replace('let buffers={},W=640,H=480,ready=false','let buffers={},hairCacheValid=false,cacheEnabled=true,cacheBuildCount=0,W=640,H=480,ready=false')
app=app.replace("function replaceSource(s){for(const k of ['segments','bins','ids']){buffers[k]?.destroy();buffers[k]=gpuBuffer(s[k],GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST);}source=s;}","function replaceSource(s,p=material.params){for(const k of ['segments','bins','ids']){buffers[k]?.destroy();buffers[k]=gpuBuffer(s[k],GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST);}source=s;const count=s.cols*s.rows*p.hairDensity;buffers.hairCache?.destroy();buffers.hairCache=gpuBuffer(Math.max(16,count*160),GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST);hairCacheValid=false;}")
app=app.replace("const s=buildSource(next.params);replaceSource(s);material=next;","const s=buildSource(next.params);material=next;replaceSource(s,next.params);")
app=app.replace("const geometry=['pitch','rowStretch','radius','loft'].includes(k);paramTimer=setTimeout(()=>enqueue(async()=>{if(geometry)replaceSource(buildSource(next.params));material.params=next.params;","const geometry=['pitch','rowStretch','radius','loft'].includes(k);const cacheAffecting=geometry||['hairDensity','hairLength','curl','seed','twist'].includes(k);paramTimer=setTimeout(()=>enqueue(async()=>{material.params=next.params;if(cacheAffecting)replaceSource(geometry?buildSource(next.params):source,next.params);")
app=app.replace("for(const entryPoint of ['controls','render','clearHairs','hairs','composite'])","for(const entryPoint of ['controls','render','clearHairs','prepareHairs','hairsLegacy','hairs','composite'])")
app=app.replace("...[4,5,7].map(binding=>({binding,visibility:4,buffer:{type:'storage'}}))","...[4,5,7,8].map(binding=>({binding,visibility:4,buffer:{type:'storage'}}))")
oldbind="...[['segments',1],['bins',2],['ids',3],['policy',4],['pixels',5],['hairAccum',7]].map(([k,binding])=>({binding,resource:{buffer:buffers[k]}})),{binding:6,resource:texture.createView()}]"
newbind="...[['segments',1],['bins',2],['ids',3],['policy',4],['pixels',5],['hairAccum',7],['hairCache',8]].map(([k,binding])=>({binding,resource:{buffer:buffers[k]}})),{binding:6,resource:texture.createView()}]"
app=app.replace(oldbind,newbind)
app=app.replace("const steps=[{name:'controls',x:Math.ceil(W/8),y:Math.ceil(H/8),offset:0},{name:'clearHairs',x:Math.ceil(W/8),y:Math.ceil(H/8),offset:0}];","const steps=[];if(cacheEnabled&&!hairCacheValid&&n>0)steps.push({name:'prepareHairs',x:Math.min(256,Math.ceil(n/64)),y:Math.ceil(Math.ceil(n/64)/256),offset:0});steps.push({name:'controls',x:Math.ceil(W/8),y:Math.ceil(H/8),offset:0},{name:'clearHairs',x:Math.ceil(W/8),y:Math.ceil(H/8),offset:0});")
app=app.replace("steps.push({name:'hairs',x:Math.min(256,groups),y:Math.ceil(groups/256),offset:i});","steps.push({name:cacheEnabled?'hairs':'hairsLegacy',x:Math.min(256,groups),y:Math.ceil(groups/256),offset:i});")
app=app.replace("lastResult={wallMs,gpuMs:stamp?Object.values(stages).reduce((a,b)=>a+b,0):null,stages,dispatchedFibres:n,submissionCount:soft?steps.length:1,revision};return lastResult;","if(cacheEnabled&&n>0&&!hairCacheValid){hairCacheValid=true;cacheBuildCount++;}lastResult={wallMs,gpuMs:stamp?Object.values(stages).reduce((a,b)=>a+b,0):null,stages,dispatchedFibres:n,submissionCount:soft?steps.length:1,revision,cacheEnabled,hairCacheBytes:buffers.hairCache?.size||0};return lastResult;")
app=app.replace("surfaceSolver:directMode?'R06 direct parametric yarn solve':'R04 128-step field marcher',","surfaceSolver:directMode?'R06 direct parametric yarn solve':'R04 128-step field marcher',hairCache:cacheEnabled?'R07 persistent GPU strand cache':'R06 per-frame strand recompute',hairCacheBytes:buffers.hairCache?.size||0,cacheBuildCount,")
start=app.index('async function compareSolvers(){');end=app.index('async function benchmark(){',start)
cmp="""async function compareSolvers(){const wasLive=live;live=false;return enqueue(async()=>{const previous=cacheEnabled;const trials={recompute:[],cached:[]};try{directMode=true;cacheEnabled=false;await render({present:false});cacheEnabled=true;await render({present:false});for(let i=0;i<6;i++){for(const route of(i%2?['cached','recompute']:['recompute','cached'])){cacheEnabled=route==='cached';trials[route].push(await render({present:false}));}}const summary={};for(const route of ['recompute','cached']){const xs=trials[route].map(x=>x.wallMs).sort((a,b)=>a-b);const gs=trials[route].map(x=>x.gpuMs).filter(Number.isFinite).sort((a,b)=>a-b);summary[route]={n:xs.length,median:(xs[2]+xs[3])/2,min:xs[0],max:xs.at(-1),gpuMedian:gs.length?(gs[2]+gs[3])/2:null};}const reduction=(1-summary.cached.median/summary.recompute.median)*100;const gpuReduction=summary.recompute.gpuMedian&&summary.cached.gpuMedian?(1-summary.cached.gpuMedian/summary.recompute.gpuMedian)*100:null;lastReport={...metadata(),comparison:'R06 recompute vs R07 persistent GPU cache',timestampUTC:new Date().toISOString(),summary,frameTimeReductionPercent:reduction,gpuTimeReductionPercent:gpuReduction,targetPassed:reduction>=80&&gpuReduction!==null&&gpuReduction>=80&&summary.cached.median<=1000/60,trials};$('measured').textContent='R07 '+reduction.toFixed(1)+'% / '+summary.cached.median.toFixed(2)+' ms';setStatus(lastReport.targetPassed?'达到80%双门槛，等待视觉验收。':'尚未达到80%双门槛。');return lastReport;}finally{cacheEnabled=previous;directMode=true;changed();live=wasLive;}});}
"""
app=app[:start]+cmp+app[end:]
app=app.replace("read:readPixels,readSolverStats,setSolver:value=>enqueue(async()=>{directMode=!!value;changed();}),compareSolvers","read:readPixels,readSolverStats,setSolver:value=>enqueue(async()=>{directMode=!!value;changed();}),setCache:value=>enqueue(async()=>{cacheEnabled=!!value;changed();}),compareSolvers")
app=app.replace("VERSION,adapter:adapterInfo","VERSION,adapter:adapterInfo")
(dst/'app.js').write_text(app)
shell=(dst/'shell.html').read_text().replace('R06 · 直接函数求交实验，80%目标待验收','R07 · GPU毛丝曲线缓存').replace('R04 / R06 交替对比','R06 / R07 缓存对比')
shell=shell.replace('R06直接求交以单次射线求解替代128步场步进；掠射与未收敛射线保留R04回退。80%帧时间降低和60FPS必须同时通过，未通过不晋级。','R07把毛丝的随机根部、弯曲曲线和9个控制位置预计算到GPU缓存。相机移动只重新投影缓存曲线，不重复生成毛丝。保留R06逐帧重算路径作为同机对照。')
(dst/'shell.html').write_text(shell)
html=shell.replace('/*DATA*/','const CORE='+json.dumps(core,ensure_ascii=False)+';\nconst DEFAULT_MATERIAL='+json.dumps((dst/'material.wgsl').read_text(),ensure_ascii=False)+';\nconst PRESET_DATA='+(dst/'presets.json').read_text()+';').replace('/*APP*/',app)
(dst/'index.html').write_text(html)
(dst/'qa-r07.mjs').write_text((root/'knit-material-r07-qa.mjs').read_text())
(dst/'README.md').write_text('''# KNIT-MATERIAL-R07 — persistent GPU strand cache\n\nR07 retains the accepted R04 material model and R06 direct yarn intersection. It adds a persistent GPU storage cache containing the nine exact sampled positions of each fibre curve (root + eight existing curve segments) and the per-strand lighting multiplier. The original R06 per-frame strand reconstruction remains available as hairsLegacy for same-session A/B tests.\n\nThe cache is generated once after geometry or hair-shape inputs change. Camera movement and viewport changes do not invalidate it; those frames only project the cached curve points and run the same pixel coverage, depth test, and optical-depth accumulation. Default 491,520 fibres and eight curve segments remain unchanged. No mesh or triangle draw path is introduced.\n\nMemory trade-off: default cache is 78,643,200 bytes (about 75 MiB). This is GPU storage allocation, not driver VRAM usage. Hardware acceptance requires the target GPU and production resolution. CI software WebGPU is not a hardware benchmark.\n''')
(dst/'BUILD.json').write_text(json.dumps({'version':'KNIT-MATERIAL-R07','bytes':len(html.encode()),'sha256':hashlib.sha256(html.encode()).hexdigest(),'optimization':'persistent GPU cache of nine exact curve positions per fibre','qualityInvariants':{'resolution':[640,480],'fibres':491520,'segmentsPerFibre':8,'triangles':0},'acceptance':{'runtime':False,'pixelEquivalence':False,'80PercentReduction':False,'hardware60FPS':False}},indent=2))
print('R07 created',dst)
