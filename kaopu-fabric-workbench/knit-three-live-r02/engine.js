const C=[[-.5,-.39,-.08],[-.36,-.43,.13],[-.14,-.22,.29],[-.29,.2,.06],[-.28,.51,-.13],[0,.63,-.18],[.28,.51,-.13],[.29,.2,.06],[.14,-.22,.29],[.36,-.43,.13],[.5,-.39,-.08]];
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>mul(a,1/Math.hypot(...a));
const VIEWS={near:[22,15,90],oblique:[95,26,80],back:[22,15,-95],whole:[75,45,570],grazing:[180,20,60]};
const names={proxy:'函数代理',surfel:'表面采样',reference:'原求交对照'};
const stat=a=>{const b=[...a].sort((x,y)=>x-y);if(!b.length)return null;const q=p=>{const n=(b.length-1)*p,i=Math.floor(n);return b[i]+(b[Math.min(i+1,b.length-1)]-b[i])*(n-i);};return {count:b.length,median:q(.5),p95:q(.95),p99:q(.99),min:b[0],max:b.at(-1)};};
function basis(eye){const f=norm(mul(eye,-1)),r=norm(cross(f,[0,1,0]));return [eye,f,r,cross(r,f)];}
function constants(){const co=[],low=[],high=[],ca=[],cb=[];for(let i=0;i<10;i++){const a=C[Math.max(0,i-1)],b=C[i],c=C[i+1],d=C[Math.min(10,i+2)];co.push(b,mul(sub(c,a),.5),b.map((v,k)=>(2*a[k]-5*v+4*c[k]-d[k])*.5),b.map((v,k)=>(-a[k]+3*v-3*c[k]+d[k])*.5));const bez=[b,add(b,mul(sub(c,a),1/6)),sub(c,mul(sub(d,b),1/6)),c].map(p=>p.map((v,k)=>(v+(k===0?.5:0))*11.6));low.push([0,1,2].map(k=>Math.min(...bez.map(p=>p[k]))-1.72*1.1427));high.push([0,1,2].map(k=>Math.max(...bez.map(p=>p[k]))+1.72*1.1427));const q=bez.slice(0,3).map((p,j)=>mul(add(p,bez[j+1]),.5)),r=q.slice(0,2).map((p,j)=>mul(add(p,q[j+1]),.5)),s=mul(add(r[0],r[1]),.5);for(const piece of [[bez[0],q[0],r[0],s],[s,r[1],q[2],bez[3]]]){const d=sub(piece[3],piece[0]),radius=Math.max(...piece.map(p=>Math.hypot(...sub(sub(p,piece[0]),mul(d,Math.max(0,Math.min(1,dot(sub(p,piece[0]),d)/dot(d,d))))))))+1.72*1.1427+.01;ca.push([...piece[0],radius]);cb.push([...piece[3],radius]);}}return {co,low,high,ca,cb};}
class KnitCompare {
 async init(options={}){
  this.options=options;this.failed=null;
  if(!navigator.gpu)throw Error('此浏览器没有开放 WebGPU；未自动改用 CPU 或 WebGL。');
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw Error('没有可用的 WebGPU 适配器。');
  const info=adapter.info;this.adapter={vendor:info?.vendor,architecture:info?.architecture,device:info?.device,description:info?.description,isFallbackAdapter:info?.isFallbackAdapter??null};
  this.timestamp=adapter.features.has('timestamp-query');this.limit=Math.min(adapter.limits.maxStorageBufferBindingSize,512*1024*1024);
  this.device=await adapter.requestDevice({requiredFeatures:this.timestamp?['timestamp-query']:[],requiredLimits:{maxStorageBufferBindingSize:this.limit,maxBufferSize:Math.min(adapter.limits.maxBufferSize,1024*1024*1024),maxStorageBuffersPerShaderStage:8}});
  this.device.addEventListener('uncapturederror',e=>{this.failed=e.error.message;fail(e.error);});this.device.lost.then(i=>{this.failed=i.message;fail(Error('GPU 设备丢失：'+i.message));});
  const d=this.device;this.constants=constants();this.shader=d.createShaderModule({code:window.KNIT_WGSL});const compilation=await this.shader.getCompilationInfo();const errors=compilation.messages.filter(m=>m.type==='error');if(errors.length)throw Error(errors.map(e=>`${e.lineNum}:${e.linePos} ${e.message}`).join('\n'));
  const entries=[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:'uniform'}}];for(let i=1;i<=8;i++)entries.push({binding:i,visibility:GPUShaderStage.COMPUTE,buffer:{type:'storage'}});for(let i=9;i<=10;i++)entries.push({binding:i,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:'unfilterable-float'}});entries.push({binding:11,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:'write-only',format:'rgba8unorm'}},{binding:12,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:'write-only',format:'r32float'}});
  this.layout=d.createBindGroupLayout({entries});const layout=d.createPipelineLayout({bindGroupLayouts:[this.layout]});this.pipelines={};this.compileMs={};
  for(const entryPoint of ['prepare','clear','bin','query','splat','resolve','shading','shadowExport']){const t=performance.now();this.pipelines[entryPoint]=await d.createComputePipelineAsync({layout,compute:{module:this.shader,entryPoint}});this.compileMs[entryPoint]=performance.now()-t;}
  this.uniform=d.createBuffer({size:2048*16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.nu=options.nu||80;this.nv=options.nv||16;this.view='near';this.eye=[...VIEWS.near];this.cap=2048;this.buffers=[];
  this.shadowSize=256;this.shadows=[0,1].map(()=>this.tex(this.shadowSize,this.shadowSize,'r32float'));this.dummyShadow=this.tex(1,1,'r32float');this.dummyScreen=this.tex(1,1,'rgba8unorm');this.shadowTarget=this.tex(1,1,'r32float');
  this.canvases=[$('stage')];this.contexts=this.canvases.map(c=>{const ctx=c.getContext('webgpu');if(!ctx)throw Error('WebGPU 画布创建失败');ctx.configure({device:d,format:'rgba8unorm',usage:GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT,alphaMode:'opaque'});return ctx;});
  this.allocate(options.width||640,options.height||448);await this.rebuild();return this;
 }
 tex(w,h,format){return this.device.createTexture({size:[w,h],format,usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC|GPUTextureUsage.COPY_DST});}
 allocate(w,h){
  if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1)throw Error('无效尺寸');
  const tx=Math.ceil(w/8),ty=Math.ceil(h/8),sizes=[w*h*64,16,28*54*this.nu*this.nv*48,w*h*16,w*h*16,tx*ty*4,tx*ty*this.cap*4,w*h*32];
  if(Math.max(...sizes)>this.limit)throw Error('此密度／像素超出设备缓冲区上限；没有自动降低质量。');
  const prev=this.buffers,keep=prev[2]?.size===sizes[2]?prev[2]:null;
  for(let i=0;i<prev.length;i++)if(i!==2||!keep)prev[i]?.destroy();
  this.output?.destroy();this.w=w;this.h=h;this.tx=tx;this.ty=ty;this.byteSizes=sizes;
  this.buffers=sizes.map((size,i)=>i===2&&keep?keep:this.device.createBuffer({size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}));
  if(!keep)this.surfelReady=false;
  this.output=this.tex(w,h,'rgba8unorm');for(const c of this.canvases){c.width=w;c.height=h;}
 }
 params(pass){const raw=new ArrayBuffer(1856),f=new Float32Array(raw),u=new Uint32Array(raw);const put=(at,x)=>f.set(x,at);const b=basis(this.eye);b.forEach((v,i)=>put(i*4,v));put(16,[11.6,1.72,9,Math.tan(19*Math.PI/180)]);for(const [i,p]of [[0,[-450,520,550]],[1,[560,220,430]]])basis(p).forEach((v,j)=>put(20+i*16+j*4,v));u.set([this.w,this.h,this.tx,0],52);u.set([this.nu,this.nv,1,pass],56);u.set([28,54,this.cap,this.shadowSize],60);let at=64;for(const list of [this.constants.co,this.constants.low,this.constants.high,this.constants.ca,this.constants.cb])for(const row of list){put(at,row);at+=4;}return raw;}
 group(slot,prep=false,target=this.shadowTarget){const entries=[{binding:0,resource:{buffer:this.uniform,offset:slot*2048,size:1856}}];this.buffers.forEach((buffer,i)=>entries.push({binding:i+1,resource:{buffer}}));entries.push({binding:9,resource:(prep?this.dummyShadow:this.shadows[0]).createView()},{binding:10,resource:(prep?this.dummyShadow:this.shadows[1]).createView()},{binding:11,resource:this.output.createView()},{binding:12,resource:target.createView()});return this.device.createBindGroup({layout:this.layout,entries});}
 steps(method){const px=this.w*this.h,n=28*54*this.nu*this.nv;return method==='proxy'?[['clear',this.tx*this.ty,0],['bin',15120,0],['query',px,1],['shading',px,0]]:method==='surfel'?[['clear',px*4,1],['splat',n,0],['splat',n,1],['resolve',px,0],['shading',px,0]]:[['query',px,0],['shading',px,0]];}
 async execute(steps,{canvas=-1,prep=false,target=this.shadowTarget,timed=false}={}){
  if(this.failed)throw Error(this.failed);const d=this.device,start=performance.now(),encoder=d.createCommandEncoder();let qs,rb,read;
  if(timed&&this.timestamp){qs=d.createQuerySet({type:'timestamp',count:steps.length*2});rb=d.createBuffer({size:steps.length*16,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC});read=d.createBuffer({size:steps.length*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});}
  steps.forEach(([name,count,mode],i)=>{d.queue.writeBuffer(this.uniform,i*2048,this.params(mode));const options=qs?{timestampWrites:{querySet:qs,beginningOfPassWriteIndex:i*2,endOfPassWriteIndex:i*2+1}}:{};const pass=encoder.beginComputePass(options);pass.setPipeline(this.pipelines[name]);pass.setBindGroup(0,this.group(i,prep,target));const groups=Math.ceil(count/64);pass.dispatchWorkgroups(Math.min(groups,256),Math.ceil(groups/256));pass.end();});
  if(canvas>=0)encoder.copyTextureToTexture({texture:this.output},{texture:this.contexts[canvas].getCurrentTexture()},[this.w,this.h]);
  if(qs){encoder.resolveQuerySet(qs,0,steps.length*2,rb,0);encoder.copyBufferToBuffer(rb,0,read,0,steps.length*16);}d.queue.submit([encoder.finish()]);await d.queue.onSubmittedWorkDone();if(this.failed)throw Error(this.failed);const wall=performance.now()-start;const stages=[];
  if(read){await read.mapAsync(GPUMapMode.READ);const x=new BigUint64Array(read.getMappedRange());for(let i=0;i<steps.length;i++)stages.push({stage:steps[i][0],ms:Number(x[i*2+1]-x[i*2])/1e6});read.unmap();read.destroy();rb.destroy();qs.destroy();}
  return {completedWallMs:wall,gpuMs:stages.length?stages.reduce((s,x)=>s+x.ms,0):null,stages};
 }
 async read(index){const d=this.device,b=this.buffers[index],copy=d.createBuffer({size:b.size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),e=d.createCommandEncoder();e.copyBufferToBuffer(b,0,copy,0,b.size);d.queue.submit([e.finish()]);await copy.mapAsync(GPUMapMode.READ);const out=copy.getMappedRange().slice(0);copy.unmap();copy.destroy();return out;}
 async checkOverflow(){const x=new Uint32Array(await this.read(1));if(x[0])throw Error(`候选列表溢出 ${x[0]}；本轮作废，没有静默丢弃。`);return 0;}
 async rebuild(){
  const start=performance.now(),w=this.w,h=this.h,eye=[...this.eye],times=[];
  this.allocate(this.shadowSize,this.shadowSize);
  for(const [i,p]of [[0,[-450,520,550]],[1,[560,220,430]]]){
   setStatus('准备共享阴影 '+(i+1)+'/2 …');this.eye=p;
   times.push(await this.execute([['clear',this.tx*this.ty,0],['bin',15120,0],['query',this.shadowSize*this.shadowSize,1],['shadowExport',this.shadowSize*this.shadowSize,0]],{prep:true,target:this.shadows[i],timed:true}));
   await this.checkOverflow();
  }
  this.allocate(w,h);this.eye=eye;
  this.preparation={totalCompletedMs:performance.now()-start,shadowPasses:times,surfel:null};
 }
 async ensureSurfels(){if(this.surfelReady)return;setStatus('从原函数准备表面采样 …');this.prepare=await this.execute([['prepare',28*54*this.nu*this.nv,0]],{timed:true});this.surfelReady=true;this.preparation.surfel=this.prepare;}
 async render(method,canvas=-1,timed=false){if(method==='surfel')await this.ensureSurfels();const r=await this.execute(this.steps(method),{canvas,timed});if(method==='proxy')await this.checkOverflow();return r;}
 async snapshot(method){await this.render(method);return {hits:new Float32Array(await this.read(0)),out:new Float32Array(await this.read(7))};}
 metadata(){return {schema:'kaopu/knit-browser-ab@1',version:'KNIT-LIVE-R02',sourceEngineCommit:'603682e1c1aa86323154038ccfc7215833afcda9',backend:'WebGPU compute',adapter:this.adapter,browser:navigator.userAgent,hardwareClassification:/swiftshader|llvmpipe|software|lavapipe/i.test(JSON.stringify(this.adapter))||this.adapter.isFallbackAdapter===true?'software':'not-confirmed-by-hardware-test',grid:[28,54],pitchMm:11.6,radiusMm:1.72,aaSamples:4,fuzzComputed:false,triangleDrawCalls:0,physicalCloth:false,worldCacheStatic:true,baselineQualification:'source-derived WebGPU port, not the unchanged engine player; shared experimental shading and shadows',shadowMapSize:[256,256],shadowMapBiasMm:.6,lightProjection:'perspective 38 degrees',size:[this.w,this.h],density:[this.nu,this.nv],surfacePoints:28*54*this.nu*this.nv,bufferBytes:this.byteSizes,declaredBufferBytesTotal:this.byteSizes.reduce((a,b)=>a+b,0),notPhysicalVRAMMeasurement:true,eyeMm:[...this.eye],shaderCompileCpuMs:this.compileMs,preparation:this.preparation};}
}
