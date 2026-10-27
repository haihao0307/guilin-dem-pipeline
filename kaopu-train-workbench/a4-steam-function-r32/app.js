const A4_STARTUP_RUN=window.A4_STARTUP?.state.runId;
window.A4_STARTUP?.step('脚本已加载，正在初始化整车 WebGL2…',A4_STARTUP_RUN);
const c=document.getElementById('c');
// Fixed at page initialization: no runtime resize, DPR multiplier, or image resampling.
const RENDER_RESOLUTION=(()=>{
 const query=new URLSearchParams(window.location?.search||'').get('resolution');
 if(query!==null&&query!=='720x400'&&query!=='1440x800')throw Error('Unsupported resolution: use 720x400 or 1440x800');
 const width=query==='1440x800'?1440:720,height=query==='1440x800'?800:400;
 if(c.width!==width)c.width=width;if(c.height!==height)c.height=height;
 return Object.freeze({width,height,legacy:width===720&&height===400,rayEpsilon:1.2/height*Math.SQRT2});
})();
const gl=c.getContext('webgl2',{preserveDrawingBuffer:true});window.QA={compiled:[],errors:[],draws:0,done:false};
if(!gl){window.A4_STARTUP?.fail('无法创建 WebGL2 上下文；整车渲染尚未开始。',A4_STARTUP_RUN);throw Error('WebGL2 context unavailable');}
const vs=`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;
function shader(type,s){let x=gl.createShader(type);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x));return x}
const vec=a=>'vec3('+a.map(x=>Number(x).toFixed(8)).join(',')+')';
const programs={};
const intervalGPU=A4_INTERVAL_GPU.create(gl,vs,RENDER_RESOLUTION.width,RENDER_RESOLUTION.height);
function distanceOnly(source){
 const marker='if(lip>0.){',start=source.indexOf(marker);if(start<0)throw Error('Distance branch contract missing');let depth=1,end=start+marker.length;for(;depth;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}
 if(source.slice(end,end+5)!=='else{')throw Error('Interval branch contract missing');let finish=end+5;depth=1;for(;depth;finish++){if(source[finish]==='{')depth++;if(source[finish]==='}')depth--;}
 return A4_INTERVAL_GPU.prune(source.slice(0,start)+'{'+source.slice(start+marker.length,end-1)+'}'+source.slice(finish));
}

function scissorBox(lo,hi,eye,target,resolution=RENDER_RESOLUTION){
 const {width,height}=resolution;
 const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((r,v,i)=>r+v*b[i],0),norm=a=>a.map(v=>v/Math.hypot(...a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const f=norm(sub(target,eye)),r=norm(cross(f,[0,1,0])),u=cross(r,f),xs=[],ys=[];
 for(let i=0;i<8;i++){let p=sub([i&1?hi[0]:lo[0],i&2?hi[1]:lo[1],i&4?hi[2]:lo[2]],eye),z=dot(p,f);if(z<=0)return [0,0,width,height];xs.push(width/2+height/1.2*dot(p,r)/z);ys.push(height/2+height/1.2*dot(p,u)/z);}
 let x=Math.max(0,Math.floor(Math.min(...xs))-2),y=Math.max(0,Math.floor(Math.min(...ys))-2),xx=Math.min(width,Math.ceil(Math.max(...xs))+2),yy=Math.min(height,Math.ceil(Math.max(...ys))+2);return [x,y,Math.max(0,xx-x),Math.max(0,yy-y)];
}

(async()=>{try{
window.A4_STARTUP?.assertActive(A4_STARTUP_RUN);
window.SURFACE=createSurfaceAppearance(SCENE,DYNAMIC,ANALYTIC_MATERIAL_WAVES,createMaterialCoordinates,RENDER_RESOLUTION.height);
for(const [source,code] of Object.entries(SCENE.sources)){
const sourceParts=SCENE.parts.filter(p=>p.source===source),batches=[];
for(let start=0;start<sourceParts.length;){let n=1;const distance=!!sourceParts[start].lipschitz;if(distance){const max=source==='pressure'?4:sourceParts.length;while(n<max&&start+n<sourceParts.length&&sourceParts[start+n].lipschitz)n++;}batches.push({ps:sourceParts.slice(start,start+n),programKey:source+'/'+start,traceKind:distance?'distance':'interval'});start+=n;}
for(const {ps,programKey,traceKind} of batches){
window.A4_STARTUP?.assertActive(A4_STARTUP_RUN);
window.A4_STARTUP?.step("正在编译整车解析域："+source+"；此阶段可能较慢…",A4_STARTUP_RUN);
// Each local id maps to the same retained global part, in unchanged draw order.
let dispatch=ps.map((p,i)=>`if(id==${i})return ${DYNAMIC.scalar(p)};`).join('\n');

let ranges=ps.map((p,i)=>p.interval_function?`if(id==${i}){${DYNAMIC.interval(p)}}`:'').join('\n');
let fs=`#version 300 es
precision highp float;precision highp int;
out vec4 outColor;uniform int id;uniform vec3 bmin,bmax,color;uniform float lip;uniform vec3 eye,target;uniform float cutX;${RENDER_RESOLUTION.legacy?'':'uniform vec2 renderResolution;'}
${DYNAMIC.glsl}
${SURFACE.glsl}
${code}
${source==='pressure'?SCENE.sources.service:''}
float field(vec3 p){${dispatch}return 1e20;}
vec2 ranges(vec3 lo,vec3 hi){${ranges}return vec2(-1e20,1e20);}
void main(){vec3 fw=normalize(target-eye),rt=normalize(cross(fw,vec3(0,1,0))),up=cross(rt,fw);${RENDER_RESOLUTION.legacy?'vec2 uv=(gl_FragCoord.xy-vec2(360,200))/400.;':'vec2 uv=(gl_FragCoord.xy-.5*renderResolution)/renderResolution.y;'}vec3 rd=normalize(fw+rt*uv.x*1.2+up*uv.y*1.2);vec3 inv=1./rd;vec3 aa=(bmin-eye)*inv,bb=(bmax-eye)*inv;vec3 nearv=min(aa,bb),farv=max(aa,bb);float t=max(0.,max(nearv.x,max(nearv.y,nearv.z))),end=min(farv.x,min(farv.y,farv.z));if(t>end)discard;
float hit=-1.;
if(lip>0.){
for(int i=0;i<1600;i++){if(t>end)break;vec3 p=eye+rd*t;float f=field(p);if(p.x>cutX)f=max(f,p.x-cutX);
if(f<=0.0005){hit=t;break;}t+=max(f/lip,0.00025);}
}else{
float lefts[32];float rights[32];int top=1;lefts[0]=t;rights[0]=end;
for(int i=0;i<4096;i++){if(top==0)break;top--;float a=lefts[top],b=rights[top];vec3 pa=eye+rd*a,pb=eye+rd*b;if(min(pa.x,pb.x)>cutX)continue;vec2 rr=ranges(min(pa,pb),max(pa,pb));if(rr.x>0.)continue;
if(b-a<0.0005){float mid=(a+b)*.5;vec3 pm=eye+rd*mid;if(pm.x<=cutX&&field(pm)<=0.0005){hit=mid;break;}continue;}
float mid=(a+b)*.5;if(top<30){lefts[top]=mid;rights[top]=b;top++;lefts[top]=a;rights[top]=mid;top++;}}
}
if(hit<0.)discard;vec3 p=eye+rd*hit;float h=.0003;vec3 n=normalize(vec3(field(p+vec3(h,0,0))-field(p-vec3(h,0,0)),field(p+vec3(0,h,0))-field(p-vec3(0,h,0)),field(p+vec3(0,0,h))-field(p-vec3(0,0,h))));outColor=vec4(surfaceColor(p,n,rd,hit,cutX,color),1);gl_FragDepth=hit/80.;}`;
let p,pair;const safe=fs.replace(/\b[A-Za-z_]\w*__\w*\b/g,n=>n.replace(/__/g,"_neg_"));
if(traceKind==='interval'){if(ps.length!==1||ps[0].lipschitz)throw Error('Interval singleton classification');pair=intervalGPU.compile(safe);p=pair.tail;}
else{if(ps.some(x=>!x.lipschitz))throw Error('Distance certification missing');p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,distanceOnly(safe)));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));}
programs[programKey]={p,pair,ps,source,traceKind};window.A4_STARTUP?.assertActive(A4_STARTUP_RUN);QA.compiled.push({source,parts:ps.length});document.getElementById("status").textContent=JSON.stringify(QA);await new Promise(r=>setTimeout(r,0));window.A4_STARTUP?.assertActive(A4_STARTUP_RUN);}}
async function renderFrame(eye=[12,3.5,-4],target=[0,1.8,-4],cut=100,theta=.4,installation=DYNAMIC.snapshot(),appearance=SURFACE.snapshot(),frameRunId=window.A4_STARTUP?.state.runId){
 const guard=()=>window.A4_STARTUP?.assertActive(frameRunId);guard();QA.done=false;
 const frameQA={...QA,errors:[...QA.errors],done:false,frameValid:false,runId:frameRunId};const {width,height,rayEpsilon}=RENDER_RESOLUTION;
 if(c.width!==width||c.height!==height||gl.drawingBufferWidth!==width||gl.drawingBufferHeight!==height)throw Error('Render buffer dimensions changed after page initialization');
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);gl.disable(gl.SCISSOR_TEST);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.clearColor(.075,.1,.14,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 frameQA.draws=0;frameQA.physicalStateDraws=0;frameQA.intervalFields=[];const start=performance.now();
 const progress=(phase,part,detail={})=>{guard();QA.progress={phase,part,logicalDraws:frameQA.draws,ms:performance.now()-start,...detail};if(window.reportA4Trace)window.reportA4Trace(QA.progress);};
 for(const [programKey,{p,pair,ps,source:src,traceKind}]of Object.entries(programs)){
  guard();progress('source-start',programKey,{traceKind});
  for(let i=0;i<ps.length;i++){
   const x=ps[i];if(!DYNAMIC.visible(x,installation))continue;guard();const bounds=DYNAMIC.bounds(x,theta,installation),material=SURFACE.frame(x,theta,installation),box=scissorBox(bounds[0],bounds[1],eye,target);
   const bindUniforms=program=>{guard();gl.useProgram(program);const u=n=>gl.getUniformLocation(program,n);
    gl.uniform2f(u('renderResolution'),width,height);gl.uniform1f(u('surfaceRayEpsilon'),rayEpsilon);gl.uniform3fv(u('eye'),eye);gl.uniform3fv(u('target'),target);gl.uniform1f(u('cutX'),cut);gl.uniform1f(u('timeTheta'),theta);gl.uniform1f(u('middleInclination'),installation.beta);gl.uniform1i(u('installationCandidate'),installation.mode==='candidate'?1:0);gl.uniform1i(u('upstreamCandidate'),installation.mode==='candidate'&&installation.steamRevision==='r32'?1:0);gl.uniform1f(u('regulatorOpen'),installation.regulatorOpen??0);gl.uniform1i(u('surfaceAppearance'),appearance.mode==='waves'?1:0);gl.uniform1f(u('surfaceDetailScale'),appearance.detailScale);gl.uniform3fv(u('color'),src==='pressure'?[.38,.62,.72]:src==='motion'?[.85,.54,.25]:src==='service'?[.73,.57,.26]:[.56,.62,.65]);
    gl.uniform1i(u('materialIndex'),material.assignment.materialIndex);for(let row=0;row<3;row++)gl.uniform4fv(u('materialInverseRow'+row),material.coordinates.rows[row]);const vm=DYNAMIC.valveFrame(x,theta,installation)?.inverseYZ||[1,0,0,0,1,0];gl.uniform3fv(u('valveInverseRow0'),vm.slice(0,3));gl.uniform3fv(u('valveInverseRow1'),vm.slice(3,6));const gm=DYNAMIC.gresleyFrame(x,theta,installation)?.inverseXZ||[1,0,0,0,1,0];gl.uniform3fv(u('gresleyInverseRow0'),gm.slice(0,3));gl.uniform3fv(u('gresleyInverseRow1'),gm.slice(3,6));gl.uniform1i(u('id'),i);gl.uniform3fv(u('bmin'),bounds[0]);gl.uniform3fv(u('bmax'),bounds[1]);gl.uniform1f(u('lip'),x.lipschitz||0);
   };
   progress('field-start',x.id,{traceKind,box});
   if(traceKind==='interval'){
    const stats=await intervalGPU.render(pair,box,bindUniforms,guard,detail=>progress('interval-batch',x.id,detail));guard();frameQA.physicalStateDraws+=stats.physicalStateDraws;frameQA.intervalFields.push({id:x.id,...stats});
   }else{bindUniforms(p);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);gl.enable(gl.SCISSOR_TEST);gl.scissor(...box);gl.drawArrays(gl.TRIANGLES,0,3);}
   frameQA.draws++;progress('field-submitted',x.id,{traceKind});
  }
  await new Promise(r=>setTimeout(r,0));guard();
 }
 guard();gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);gl.disable(gl.SCISSOR_TEST);gl.finish();
 frameQA.resolution={width,height,drawingBufferWidth:gl.drawingBufferWidth,drawingBufferHeight:gl.drawingBufferHeight,viewport:[0,0,width,height],rayEpsilon,legacyShader:RENDER_RESOLUTION.legacy,nativeSampling:true,resizedFromImage:false};frameQA.ms=performance.now()-start;frameQA.jsSubmissionMs=frameQA.ms;frameQA.glError=gl.getError();if(gl.isContextLost())throw Error("WebGL context lost before whole-frame completion");if(frameQA.glError!==gl.NO_ERROR)throw Error("WebGL error after whole-frame submission: 0x"+frameQA.glError.toString(16));frameQA.theta=theta;frameQA.installation=installation;frameQA.appearance=appearance;frameQA.surface={...SURFACE.coverage(installation),geometryDisplacement:0,shadingOnly:true,independentClock:false,filtered:true,footprint:'tangent-plane ray cone; no derivative in divergent flow; edge/curvature AA not certified',historicalMaterialCertainty:false,pixelReadbackVerified:false};frameQA.mechanicalAcceptance=false;frameQA.outsideValves=installation.mode==='candidate'?{leftQ:DYNAMIC.outsideValvePose(theta).left.spindleDisplacement,rightQ:DYNAMIC.outsideValvePose(theta).right.spindleDisplacement,fixedReversingSetting:.75,reconstructed:true,middleFrozen:false}:null;frameQA.centralControl=installation.mode==='candidate'?{qMiddle:DYNAMIC.gresleySolver.pose(theta).qMiddle,finiteMinusIdeal:DYNAMIC.gresleySolver.pose(theta).finiteMinusIdeal,inferredHorizontalInstallation:true,sideOffsetMiddleValve:true,middleChestPresent:true,baselinePlateOverlapKnown:true,candidateFiniteStack:true,historicalR28Failures:['original central levers intersected frame fields','original centre-horizontal spindle intersected power-cylinder moving parts'],currentWholeNeighborStatus:'Read R29 whole-neighbor evidence; no whole-mechanical certification',realFrameOpeningsAndInstallationUnverified:true,candidateExplicitMount:true,verifiedFrameMount:false,verifiedEndLocks:false}:null;frameQA.steamPath=installation.mode==='candidate'&&DYNAMIC.steamPathCandidate?{candidateInstalled:true,parts:DYNAMIC.steamPathCandidate.parts.length,sourceName:'steamPath',theta,hostCount:Object.keys(DYNAMIC.steamPathCandidate.hostCuts).length,subtractOnly:true,completeSteamNetwork:false,historicalValveEventsVerified:false,sameTimeChambers:DYNAMIC.steamPathCandidate.inspection(theta,installation).workingChambers}:null;frameQA.upstreamSteam=DYNAMIC.upstreamCandidate?.network(theta,installation)||null;window.A4_STARTUP?.assertActive(frameRunId);frameQA.done=true;frameQA.frameValid=true;delete frameQA.invalidatedBy;Object.assign(QA,frameQA);delete QA.invalidatedBy;document.getElementById("status").textContent=`${width}×${height} native pixels · ${SCENE.parts.length} defined analytic fields · ${frameQA.draws} logical fields / ${frameQA.physicalStateDraws} interval-state draws · GL ${frameQA.glError} · JS submission ${(frameQA.jsSubmissionMs/1000).toFixed(2)} s; software-WebGL readback timing only in BROWSER_QA · theta ${theta.toFixed(4)} rad · ${appearance.mode==='waves'?'解析微法线 / 粗糙度研究':'原诊断色'} · 几何位移 0`;if(window.RESEARCH_UI)RESEARCH_UI.showRendered(theta,installation,appearance);return {...frameQA};}
let renderTail=Promise.resolve();
window.render=function(eye,target,cut,theta,installation=DYNAMIC.snapshot(),appearance=SURFACE.snapshot()){
 const mechanical=DYNAMIC.snapshot(installation),surface=SURFACE.snapshot(appearance);
 const eyeSnapshot=eye?.slice(),targetSnapshot=target?.slice();
 const next=renderTail.then(()=>renderFrame(eyeSnapshot,targetSnapshot,cut,theta,mechanical,surface,A4_STARTUP_RUN));renderTail=next.catch(()=>{});return next;
};
// Same Time -> rail-local Location -> whole Object state, appearance sampled last.
// DYNAMIC and every mechanical/source function remain unchanged.
window.renderAt=async function(Time,Location={},ObjectState={}){
 const state=DYNAMIC.state(Time,Location,ObjectState),surface=SURFACE.snapshot(ObjectState.appearance||{});
 return render(state.eye,[0,1.8,-4],state.cut,state.theta,state.installation,surface);
};
window.A4_STARTUP?.step("解析域编译完成，正在绘制整车首帧…",A4_STARTUP_RUN);
window.A4_STARTUP?.assertActive(A4_STARTUP_RUN);
window.RESEARCH_UI.install();const firstFrame=await RESEARCH_UI.request({throwOnError:true});
if(firstFrame?.status!=="submitted"||firstFrame.runId!==A4_STARTUP_RUN)throw Error("整车首帧未确认提交；初始化未完成。");
window.A4_STARTUP?.step("整车首帧已提交。可切换候选、时间与剖切；软件渲染可能较慢。",A4_STARTUP_RUN);

}catch(e){if(window.A4_STARTUP&&A4_STARTUP_RUN!==window.A4_STARTUP.state.runId)return;window.A4_STARTUP?.fail(String(e),A4_STARTUP_RUN);if(!QA.errors.includes(String(e)))QA.errors.push(String(e));document.getElementById("status").textContent=JSON.stringify(QA,null,2)}})();
