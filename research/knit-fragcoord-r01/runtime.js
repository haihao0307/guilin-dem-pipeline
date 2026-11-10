'use strict';
const BUILD='KNIT-FRAGCOORD-R01-20261110';
const $=id=>document.getElementById(id),canvas=$('world');
const qa=window.__KNIT__={build:BUILD,ready:false,frames:0,errors:[],view:'collar',triangles:0,renderBackend:'WebGPU compute',cacheBytes:160*160*112*16,visualAcceptance:false,productionReady:false,testFixtureOnly:true};
const state={yaw:0,pitch:.2,distance:3,target:[0,.08,0],lens:.8,thickness:1.5,fuzz:1,turn:false,normals:0,colour:[.20,.092,.042],exposure:1};
const types={float:'f32',int:'i32',uint:'u32',vec2:'vec2f',vec3:'vec3f',vec4:'vec4f',ivec3:'vec3i'};
// Deliberately limited translation of the checked-in, known GLSL subset, not a general converter.
function translate(src){
 src=src.replace(/\/\/[^\n]*/g,'');
 src=src.replace(/struct\s+(\w+)\s*\{([\s\S]*?)\};/g,(_,name,body)=>'struct '+name+' {\n'+[...body.matchAll(/(\w+)\s+(\w+)\s*;/g)].map(m=>m[2]+': '+(types[m[1]]||m[1])+',').join('\n')+'\n}');
 src=src.replace(/\b(float|vec[234]|int|Chart|Sample)\s+(\w+)\s*\(([^)]*)\)\s*\{/g,(_,ret,name,args)=>'fn '+name+'('+args.split(',').map(a=>a.trim()).filter(Boolean).map(a=>{const [t,n]=a.split(/\s+/);return n+': '+(types[t]||t)}).join(',')+')->'+(types[ret]||ret)+' {');
 src=src.replace(/\bconst\s+(float|int)\s+(\w+)\s*=/g,(_,t,n)=>'const '+n+': '+types[t]+' =');
 src=src.replace(/\b(float|vec[234]|int|Chart|Sample)\s+(\w+)\s*=/g,(_,t,n)=>'var '+n+': '+(types[t]||t)+' =');
 for(const [t,w] of Object.entries(types))src=src.replace(new RegExp('\\b'+t+'\\s*\\(','g'),w+'(');
 src=src.replace(/\batan\(/g,'atan2(');
 // WGSL does not broadcast scalar addition/subtraction like GLSL.
 return src.replace('3.0-2.0*f','vec3f(3.0)-2.0*f').replace('2.51*c+0.03','2.51*c+vec3f(0.03)').replace('2.43*c+0.59','2.43*c+vec3f(0.59)').replace('))+0.14', '))+vec3f(0.14)').replace(')+0.14',')+vec3f(0.14)').replace('n*0.5+0.5','n*0.5+vec3f(0.5)');
}
const CONTROL=[[-.5,-.39,-.08],[-.36,-.43,.13],[-.14,-.22,.29],[-.29,.2,.06],[-.28,.51,-.13],[0,.63,-.18],[.28,.51,-.13],[.29,.2,.06],[.14,-.22,.29],[.36,-.43,.13],[.5,-.39,-.08]];
function curve(t){const k=Math.floor(t),v=(t-k)*10,i=Math.min(9,Math.floor(v)),x=v-i,a=CONTROL[Math.max(0,i-1)],b=CONTROL[i],c=CONTROL[i+1],d=CONTROL[Math.min(10,i+2)];return b.map((p,j)=>.5*(2*p+(-a[j]+c[j])*x+(2*a[j]-5*p+4*c[j]-d[j])*x*x+(-a[j]+3*p-3*c[j]+d[j])*x*x*x)+(j===0?k:0));}
const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const l=Math.hypot(...a);if(l<1e-10)throw Error('Degenerate yarn frame');return a.map(v=>v/l)};
function segments(){
 const centers=Array.from({length:97},(_,i)=>curve(i/96)),arc=[0],data=[];
 for(let i=1;i<=96;i++)arc.push(arc.at(-1)+Math.hypot(...sub(centers[i],centers[i-1])));
 const total=arc.at(-1);
 function add(points){for(let j=0;j<points.length-1;j++)data.push(...points[j],0,...points[j+1],0)}
 for(let k=0;k<3;k++){
  const pts=[];
  for(let i=0;i<=96;i++){const t=i/96,T=norm(sub(curve(t+.0001),curve(t-.0001))),N=norm(cross(T,[0,0,1])),B=cross(T,N),phase=arc[i]/total*7*Math.PI*2+k*Math.PI*2/3;pts.push(centers[i].map((v,j)=>v+.046*(Math.cos(phase)*N[j]+Math.sin(phase)*B[j])))}
  add(pts);
 }
 for(let k=0;k<32;k++){
  const t=(k+.37)/32,c=curve(t),T=norm(sub(curve(t+.0001),curve(t-.0001))),N=norm(cross(T,[0,0,1])),B=cross(T,N),phase=Math.sin(k*78.2)*13.7,R=N.map((v,j)=>Math.cos(phase)*v+Math.sin(phase)*B[j]),len=.08+.09*(.5+.5*Math.sin(k*31.7)),pts=[];
  for(let j=0;j<4;j++){const f=j/3;pts.push(c.map((v,i)=>v+R[i]*(.095+len*.5*f)+T[i]*(len*f)+B[i]*(.022*Math.sin(f*Math.PI+k))))}add(pts);
 }
 return new Float32Array(data);
}
let device,ctx,pipeline,uniforms,field,hair,sampler,outImage,bindGroup,stopped=false,reading=false,needsResize=true;
function fail(error){const message=String(error?.message||error);qa.errors.push(message);qa.ready=false;stopped=true;$('status').textContent='启动未完成';$('failure').hidden=false;$('failureText').textContent=message;console.error(message);}
async function moduleFor(code,label){const m=device.createShaderModule({code,label}),info=await m.getCompilationInfo(),errors=info.messages.filter(x=>x.type==='error');if(errors.length)throw Error(label+'\n'+errors.map(x=>x.lineNum+': '+x.message).join('\n'));return m;}
function resize(){
 const w=Math.max(1,Math.round(canvas.clientWidth)),h=Math.max(1,Math.round(canvas.clientHeight));
 if(canvas.width===w&&canvas.height===h&&outImage)return;
 canvas.width=w;canvas.height=h;outImage?.destroy();
 ctx.configure({device,format:'rgba8unorm',alphaMode:'opaque',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_DST});
 outImage=device.createTexture({size:[w,h],format:'rgba8unorm',usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.COPY_SRC});
 bindGroup=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:uniforms}},{binding:1,resource:field.createView()},{binding:2,resource:sampler},{binding:3,resource:outImage.createView()},{binding:4,resource:hair.createView()}]});
 qa.resolution=[w,h];$('resolution').textContent=w+' × '+h;
}
function values(){const u=new Float32Array(64),cp=Math.cos(state.pitch),eye=[state.target[0]+Math.sin(state.yaw)*cp*state.distance,state.target[1]+Math.sin(state.pitch)*state.distance,state.target[2]+Math.cos(state.yaw)*cp*state.distance];u.set([canvas.width,canvas.height,qa.frames,0],0);u.set(eye,4);u.set(state.target,8);u.set([state.lens,0,0,state.exposure],16);u.set([.038,state.thickness,state.fuzz,state.normals],20);u.set(state.colour,24);return u;}
let previous=performance.now(),fpsStart=previous,fpsFrames=0;
async function frame(now){
 if(stopped)return;
 if(document.hidden||reading){requestAnimationFrame(frame);return;}
 const dt=Math.min((now-previous)/1000,.10);previous=now;if(state.turn)state.yaw+=dt*.25;
 try{
  if(needsResize){resize();needsResize=false;}
  const start=performance.now();device.queue.writeBuffer(uniforms,0,values());const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bindGroup);pass.dispatchWorkgroups(Math.ceil(canvas.width/8),Math.ceil(canvas.height/8));pass.end();encoder.copyTextureToTexture({texture:outImage},{texture:ctx.getCurrentTexture()},[canvas.width,canvas.height,1]);device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();
  qa.frames++;qa.lastCompletedMs=performance.now()-start;qa.ready=true;$('loading').hidden=true;fpsFrames++;const elapsed=performance.now()-fpsStart;if(elapsed>1000){qa.completedFPS=fpsFrames*1000/elapsed;$('fps').textContent=qa.completedFPS.toFixed(1)+' FPS';fpsStart=performance.now();fpsFrames=0;}$('status').textContent='WebGPU';
 }catch(e){fail(e);return;}
 requestAnimationFrame(frame);
}
qa.probe=async()=>{
 if(!outImage)throw Error('No rendered output');reading=true;
 try{await device.queue.onSubmittedWorkDone();const w=canvas.width,h=canvas.height,row=Math.ceil(w*4/256)*256,b=device.createBuffer({size:row*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),e=device.createCommandEncoder();e.copyTextureToBuffer({texture:outImage},{buffer:b,bytesPerRow:row,rowsPerImage:h},[w,h]);device.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const padded=new Uint8Array(b.getMappedRange()),pixels=new Uint8Array(w*h*4);for(let y=0;y<h;y++)pixels.set(padded.subarray(y*row,y*row+w*4),y*w*4);const bins=new Set();let brown=0,opaque=0;for(let i=0;i<pixels.length;i+=4){const r=pixels[i],g=pixels[i+1],bl=pixels[i+2];bins.add((r>>3)*1024+(g>>3)*32+(bl>>3));if(r>g*1.15&&g>bl*1.10)brown++;if(pixels[i+3]===255)opaque++;}const digest=await crypto.subtle.digest('SHA-256',pixels);const sha256=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');b.unmap();b.destroy();return{sha256,bins:bins.size,brownFraction:brown/(w*h),opaqueFraction:opaque/(w*h),frames:qa.frames,resolution:[w,h],view:qa.view};}finally{reading=false;}
};
qa.setView=name=>{
 qa.view=name;state.turn=false;$('turn').setAttribute('aria-pressed','false');
 let eye,target;
 if(name==='collar'){eye=[.46,1.04,.87];target=[.05,.65,.03];state.lens=.75;}
 else if(name==='yarn'){eye=[.06,.18,.47];target=[0,.12,.20];state.lens=.65;}
 else{eye=[1.25,.75,3.3];target=[0,.08,0];state.lens=.80;}
 const v=sub(eye,target);state.distance=Math.hypot(...v);state.yaw=Math.atan2(v[0],v[2]);state.pitch=Math.asin(v[1]/state.distance);state.target=target;
 for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===name));
};
qa.rotate=angle=>{state.yaw+=angle;};
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>qa.setView(b.dataset.view);
$('turn').onclick=()=>{state.turn=!state.turn;$('turn').setAttribute('aria-pressed',String(state.turn));};
$('options').onclick=()=>{const open=$('panel').hidden;$('panel').hidden=!open;$('options').setAttribute('aria-expanded',String(open));};
$('closePanel').onclick=()=>{$('panel').hidden=true;$('options').setAttribute('aria-expanded','false');};
$('thickness').oninput=e=>{state.thickness=Number(e.target.value);$('thicknessValue').textContent=state.thickness.toFixed(2);};
$('fuzz').onchange=e=>{state.fuzz=e.target.checked?1:0;};
$('normals').onchange=e=>{state.normals=e.target.checked?1:0;};
$('colour').oninput=e=>{const h=e.target.value;state.colour=[1,3,5].map(i=>Math.pow(parseInt(h.slice(i,i+2),16)/255,2.2));};
$('exposure').oninput=e=>{state.exposure=Number(e.target.value);};
$('retry').onclick=()=>location.reload();
const pointers=new Map();let last=null,pinch=0;
canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);last=[e.clientX,e.clientY];if(pointers.size===2){const a=[...pointers.values()];pinch=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);}};
canvas.onpointermove=e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(pinch>0&&d>0)state.distance=Math.max(.13,Math.min(6,state.distance*pinch/d));pinch=d;}else if(last){state.yaw-=(e.clientX-last[0])*.006;state.pitch=Math.max(-1.1,Math.min(1.3,state.pitch+(e.clientY-last[1])*.004));}last=[e.clientX,e.clientY];};
canvas.onpointerup=canvas.onpointercancel=e=>{pointers.delete(e.pointerId);last=null;pinch=0;};
canvas.addEventListener('wheel',e=>{e.preventDefault();state.distance=Math.max(.13,Math.min(6,state.distance*Math.exp(e.deltaY*.001)));},{passive:false});
canvas.ondblclick=()=>qa.setView(qa.view);window.addEventListener('resize',()=>{needsResize=true;});
async function start(){
 if(!navigator.gpu)throw Error('这个浏览器没有提供 WebGPU；不会用静态图或 CPU 模式替代三维画面。');
 const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw Error('没有可用的 WebGPU 适配器。');
 qa.adapter={vendor:adapter.info?.vendor,architecture:adapter.info?.architecture,description:adapter.info?.description,isFallbackAdapter:adapter.info?.isFallbackAdapter};
 device=await adapter.requestDevice();device.addEventListener('uncapturederror',e=>fail(e.error));device.lost.then(i=>fail('GPU 设备连接中断：'+i.message));
 ctx=canvas.getContext('webgpu');if(!ctx)throw Error('无法创建 WebGPU 画布。');
 const fieldHeader='struct Segments { data:array<vec4f>, }\n@group(0) @binding(0) var<storage,read> segments:Segments;\n@group(0) @binding(1) var fieldOut:texture_storage_3d<rgba16float,write>;\n@group(0) @binding(2) var hairOut:texture_storage_3d<rgba16float,write>;\n';
 const fieldEnd='\n@compute @workgroup_size(4,4,4) fn main(@builtin(global_invocation_id) id:vec3u){let size=textureDimensions(fieldOut);if(any(id>=size)){return;}let uv=(vec3f(id)+vec3f(0.5))/vec3f(size);let p=vec3f(uv.x,uv.y*0.65,uv.z-0.5);textureStore(fieldOut,vec3i(id),fieldAt(p));textureStore(hairOut,vec3i(id),hairAt(p));}';
 const renderHeader='struct Uniforms { v:array<vec4f,16>, }\n@group(0) @binding(0) var<uniform> U:Uniforms;\n@group(0) @binding(1) var fieldTex:texture_3d<f32>;\n@group(0) @binding(2) var fieldSampler:sampler;\n@group(0) @binding(3) var outImage:texture_storage_2d<rgba8unorm,write>;\n@group(0) @binding(4) var hairTex:texture_3d<f32>;\nfn sampleField(uv:vec3f)->vec4f{return textureSampleLevel(fieldTex,fieldSampler,uv,0.0);}\nfn sampleHair(uv:vec3f)->vec4f{return textureSampleLevel(hairTex,fieldSampler,uv,0.0);}\n';
 const renderEnd='\n@compute @workgroup_size(8,8,1) fn main(@builtin(global_invocation_id) id:vec3u){if(id.x>=u32(U.v[0].x)||id.y>=u32(U.v[0].y)){return;}textureStore(outImage,vec2i(id.xy),renderPixel(vec2f(id.xy)+vec2f(0.5)));}';
 $('loadingText').textContent='编译纱线函数';
 const fm=await moduleFor(fieldHeader+translate($('fieldSource').textContent)+fieldEnd,'Yarn cache'),rm=await moduleFor(renderHeader+translate($('renderSource').textContent)+renderEnd,'Research carrier');
 const fp=await device.createComputePipelineAsync({layout:'auto',compute:{module:fm,entryPoint:'main'}});pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:rm,entryPoint:'main'}});
 const data=segments(),sb=device.createBuffer({size:data.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(sb,0,data);
 const desc={size:[160,160,112],dimension:'3d',format:'rgba16float',usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING};field=device.createTexture(desc);hair=device.createTexture(desc);
 const bg=device.createBindGroup({layout:fp.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:sb}},{binding:1,resource:field.createView()},{binding:2,resource:hair.createView()}]});
 $('loadingText').textContent='准备针脚与毛羽';const began=performance.now(),e=device.createCommandEncoder(),p=e.beginComputePass();p.setPipeline(fp);p.setBindGroup(0,bg);p.dispatchWorkgroups(40,40,28);p.end();device.queue.submit([e.finish()]);await device.queue.onSubmittedWorkDone();qa.cacheBuildMs=performance.now()-began;sb.destroy();
 sampler=device.createSampler({minFilter:'linear',magFilter:'linear',addressModeU:'repeat',addressModeV:'repeat',addressModeW:'clamp-to-edge'});uniforms=device.createBuffer({size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
 qa.setView(new URLSearchParams(location.search).get('view')||'collar');$('loadingText').textContent='绘制第一帧';requestAnimationFrame(frame);
}
start().catch(fail);
