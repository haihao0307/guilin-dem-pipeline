'use strict';
// CPU and WebGL-call mock only. Never launches a browser or claims pixel evidence.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const here=__dirname;
const studyRoot=process.env.A4_RESOLUTION_STUDY||(fs.existsSync(path.join(here,'SOURCE_BASELINE.json'))?here:path.join(here,'resolution-study'));
const sceneRoot=process.env.A4_SCENE_ROOT||[here,path.join(here,'..'),path.join(here,'../r29')].find(p=>fs.existsSync(path.join(p,'scene.js')));
assert(sceneRoot,'Set A4_SCENE_ROOT to the unchanged R29 input directory');
const rendererRoot=process.env.A4_RENDERER_ROOT||here;
const legacyRoot=process.env.A4_RESOLUTION_LEGACY||path.join(studyRoot,'legacy');
const outputRoot=process.env.A4_QA_OUTPUT||here;
const read=(root,name)=>fs.readFileSync(path.join(root,name),'utf8');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const report={status:'RUNNING',scope:'CPU projection, immutable startup resolution, source equivalence, and mock uniform/draw wiring only',browser:'NOT_RUN_LOCAL_SANDBOX_DENIED',pixelReadbackVerified:false,pngReproducibilityVerified:false,mechanicalAcceptance:false,geometryDisplacement:0};
const app=read(rendererRoot,'app.js'),legacyApp=read(legacyRoot,'app.js');
const sourceBaseline=JSON.parse(read(studyRoot,'SOURCE_BASELINE.json')),manifest=sourceBaseline.sha256;
for(const name of ['app.js','material-renderer.js'])assert.equal(hash(read(legacyRoot,name)),manifest[name],'retained source '+name);
const locks=JSON.parse(read(sceneRoot,'RENDER_GEOMETRY_LOCK.json')).sha256;
const excerpt=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i,'missing source markers');return s.slice(i,j);};
for(const [key,start,end]of [['scalarDispatch','let dispatch=','let fs='],['rayIntersectionAndNormal','float field(vec3 p)','outColor=vec4(surfaceColor'],['scissorProjection','function scissorBox','\n(async()=>']])assert.equal(hash(excerpt(legacyApp,start,end)),locks[key],'historical lock '+key);
for(const [start,end]of [['let dispatch=','let fs='],['float field(vec3 p)','void main()'],['float hit=-1.;','outColor=vec4(surfaceColor']])assert.equal(excerpt(app,start,end),excerpt(legacyApp,start,end),'unchanged field/intersection/normal');
assert(app.includes('gl_FragDepth=hit/80.;'));
const historicalGeometryMismatches=[];
for(const [name,expected]of Object.entries(JSON.parse(read(sceneRoot,'MATERIAL_GEOMETRY_LOCK.json')).sha256)){
 const actual=hash(fs.readFileSync(path.join(sceneRoot,name)));assert.equal(actual,manifest[name],'unchanged current R29 geometric input '+name);
 if(actual!==expected)historicalGeometryMismatches.push({file:name,historicalR27Hash:expected,currentR29Hash:actual});
}
assert.deepEqual(historicalGeometryMismatches,sourceBaseline.preExistingHistoricalGeometryLockMismatches,'new historical mismatch is not allowed');
for(const name of ['RENDER_GEOMETRY_LOCK.json','MATERIAL_GEOMETRY_LOCK.json'])assert.equal(hash(read(sceneRoot,name)),manifest[name],'historical lock file retained');
report.preExistingHistoricalGeometryLockMismatches=historicalGeometryMismatches;
report.currentR29GeometricInputsUnchanged=true;
for(const name of sourceBaseline.unchangedRuntimeScripts)assert.equal(hash(read(sceneRoot,name)),manifest[name],'unchanged runtime input '+name);
for(const name of ['material-wave-study/material-waves.js','material-wave-study/rigid-coordinates.js'])assert.equal(hash(read(sceneRoot,name)),manifest[name],'unchanged material waves/coordinates '+name);
report.historicalLocksUnmodified=true;report.fieldIntersectionNormalDepthUnchanged=true;report.materialWavesAndCoordinatesUnchanged=true;

function mockGL(canvas){
 const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,DEPTH_TEST:5,COLOR_BUFFER_BIT:8,DEPTH_BUFFER_BIT:16,SCISSOR_TEST:6,TRIANGLES:7,
  shaders:[],programs:[],draws:[],uniformAttempts:[],current:null,currentScissor:[0,0,canvas.width,canvas.height],currentViewport:[0,0,canvas.width,canvas.height],scissorEnabled:false,
  get drawingBufferWidth(){return canvas.width;},get drawingBufferHeight(){return canvas.height;},
  viewport(...v){this.currentViewport=v;},createShader(type){const s={type};this.shaders.push(s);return s;},shaderSource(s,source){s.source=source;},compileShader(){},getShaderParameter(){return true;},
  createProgram(){const p={index:this.programs.length,shaders:[],uniforms:{}};this.programs.push(p);return p;},attachShader(p,s){p.shaders.push(s);},linkProgram(){},getProgramParameter(){return true;},useProgram(p){this.current=p;},
  getUniformLocation(p,n){this.lastLocation={p,n};const source=p.shaders.map(s=>s.source).join('\n');if(n==='renderResolution'&&!source.includes('uniform vec2 renderResolution;'))return null;if(n==='surfaceRayEpsilon'&&!source.includes('uniform float surfaceRayEpsilon;'))return null;return {p,n};},
  upload(u,value){this.uniformAttempts.push({program:this.lastLocation.p.index,name:this.lastLocation.n,value,ignored:u===null});if(u)u.p.uniforms[u.n]=value;},
  uniform2f(u,x,y){this.upload(u,[x,y]);},uniform3fv(u,v){this.upload(u,Array.from(v));},uniform4fv(u,v){this.upload(u,Array.from(v));},uniform1f(u,v){this.upload(u,v);},uniform1i(u,v){this.upload(u,v);},
  enable(v){if(v===this.SCISSOR_TEST)this.scissorEnabled=true;},disable(v){if(v===this.SCISSOR_TEST)this.scissorEnabled=false;},clearColor(){},
  clear(){assert(!this.scissorEnabled,'frame clear must cover the whole buffer');this.draws=[];this.uniformAttempts=[];},scissor(...s){this.currentScissor=s;},finish(){},getError(){return 0;},
  drawArrays(){this.draws.push({program:this.current.index,uniforms:plain(this.current.uniforms),scissor:this.currentScissor.slice(),viewport:this.currentViewport.slice()});}};
 return gl;
}
async function boot(search='',legacy=false){
 const canvas={width:720,height:400};let gl;
 canvas.getContext=()=>gl||(gl=mockGL(canvas));
 const elements={c:canvas,status:{textContent:''},'steam-path-state':{textContent:''},'steam-count':{textContent:''}};
 const context={console,setTimeout,performance,URLSearchParams,location:{search},document:{getElementById:id=>{assert(elements[id],id);return elements[id];}},RESEARCH_UI:{install(){},async request(){},showRendered(){}}};
 context.window=context;vm.createContext(context);
 const scripts=[...read(sceneRoot,'index.html').matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(n=>!['app.js','controls.js'].includes(n));
 for(const name of scripts)vm.runInContext(read(name==='material-renderer.js'?(legacy?legacyRoot:rendererRoot):sceneRoot,name),context,{filename:name});
 vm.runInContext(legacy?legacyApp:app,context,{filename:legacy?'legacy/app.js':'app.js'});
 const start=Date.now();while(!context.render){assert(!context.QA.errors.length,context.QA.errors.join('\n'));assert(Date.now()-start<10000,'mock compilation setup timed out');await new Promise(r=>setTimeout(r,2));}
 return {context,gl,canvas};
}
function normalizedShaders(state){return state.gl.shaders.map(s=>({type:s.type,source:s.source}));}
function restoreHighShader(source){return source.replace('uniform vec2 renderResolution;','').replace('\nuniform float surfaceRayEpsilon;','').replace('vec2 uv=(gl_FragCoord.xy-.5*renderResolution)/renderResolution.y;','vec2 uv=(gl_FragCoord.xy-vec2(360,200))/400.;').replace('float epsilon=surfaceRayEpsilon;','const float epsilon=.004242640687119285;');}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),norm=a=>Math.hypot(...a),unit=a=>a.map(v=>v/norm(a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function basis(eye,target){const f=unit(sub(target,eye)),r=unit(cross(f,[0,1,0]));return {f,r,u:cross(r,f)};}
function ray(point,width,height,eye,target){const {f,r,u}=basis(eye,target),uv=[(point[0]-width/2)/height,(point[1]-height/2)/height];return unit(f.map((v,i)=>v+r[i]*uv[0]*1.2+u[i]*uv[1]*1.2));}
function expectedScissor(lo,hi,eye,target,width,height){
 const {f,r,u}=basis(eye,target),xs=[],ys=[];
 for(let i=0;i<8;i++){const p=sub([i&1?hi[0]:lo[0],i&2?hi[1]:lo[1],i&4?hi[2]:lo[2]],eye),z=dot(p,f);if(z<=0)return [0,0,width,height];xs.push(width/2+height/1.2*dot(p,r)/z);ys.push(height/2+height/1.2*dot(p,u)/z);}
 const x=Math.max(0,Math.floor(Math.min(...xs))-2),y=Math.max(0,Math.floor(Math.min(...ys))-2),xx=Math.min(width,Math.ceil(Math.max(...xs))+2),yy=Math.min(height,Math.ceil(Math.max(...ys))+2);
 return [x,y,Math.max(0,xx-x),Math.max(0,yy-y)];
}
let seed=425;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function strippedDraws(state){return state.gl.draws.map(d=>{const u={...d.uniforms};delete u.renderResolution;delete u.surfaceRayEpsilon;return {...d,uniforms:u};});}
function inspectUploads(state,width,height){
 for(const p of state.gl.programs){const resolution=state.gl.uniformAttempts.filter(a=>a.program===p.index&&a.name==='renderResolution'),epsilon=state.gl.uniformAttempts.filter(a=>a.program===p.index&&a.name==='surfaceRayEpsilon');
  assert.equal(resolution.length,1);assert.equal(epsilon.length,1);assert.deepEqual(resolution[0].value,[width,height]);assert.equal(epsilon[0].value,1.2/height*Math.SQRT2);assert.equal(resolution[0].ignored,height===400);assert.equal(epsilon[0].ignored,height===400);
 }
 assert.deepEqual(state.gl.currentViewport,[0,0,width,height]);
 for(const d of state.gl.draws)assert.deepEqual(d.viewport,[0,0,width,height]);
 assert.equal(state.context.QA.resolution.nativeSampling,true);assert.equal(state.context.QA.resolution.resizedFromImage,false);
}
(async()=>{
 const old=await boot('',true),low=await boot(''),explicitLow=await boot('?resolution=720x400'),high=await boot('?resolution=1440x800');
 assert.deepEqual(normalizedShaders(low),normalizedShaders(old),'default complete GLSL is byte-identical to legacy');
 assert.deepEqual(normalizedShaders(explicitLow),normalizedShaders(old),'explicit 720 complete GLSL is byte-identical');
 assert.deepEqual(normalizedShaders(high).map(s=>({...s,source:restoreHighShader(s.source)})),normalizedShaders(old),'1440 differs only in declared resolution/footprint inputs and ray coordinate expression');
 assert.equal(high.canvas.width,1440);assert.equal(high.canvas.height,800);assert.equal(low.canvas.width,720);assert.equal(low.canvas.height,400);
 const config=vm.runInContext('RENDER_RESOLUTION',high.context);assert(Object.isFrozen(config));
 assert.equal(config.rayEpsilon,1.2/800*Math.SQRT2);
 report.default720CompleteShaderByteIdentical=true;report.highShaderOnlyResolutionChanges=true;report.shaderPrograms=high.gl.programs.length;
 const cameraEyes=[[12,3.5,-4],[-12,3.5,-4],[24,13,15],[10,6,22]],target=[0,1.8,-4];let rays=0,boxes=0;
 for(const eye of cameraEyes)for(let i=0;i<500;i++){
  const point=[720*random(),400*random()],a=ray(point,720,400,eye,target),b=ray(point.map(v=>v*2),1440,800,eye,target);assert(Math.max(...a.map((v,j)=>Math.abs(v-b[j])))<1e-14);rays++;
  const lo=[30*random()-15,10*random()-3,45*random()-25],hi=lo.map(v=>v+.01+4*random());
  assert.deepEqual(plain(low.context.scissorBox(lo,hi,eye,target)),plain(old.context.scissorBox(lo,hi,eye,target)),'legacy scissor values unchanged');
  for(const [state,w,h]of [[low,720,400],[high,1440,800]]){const actual=plain(state.context.scissorBox(lo,hi,eye,target));assert.deepEqual(actual,expectedScissor(lo,hi,eye,target,w,h));assert(actual.every(Number.isFinite));assert(actual[2]>=0&&actual[3]>=0);if(actual[2]>0)assert(actual[0]>=0&&actual[0]+actual[2]<=w);if(actual[3]>0)assert(actual[1]>=0&&actual[1]+actual[3]<=h);boxes++;}
 }
 assert.deepEqual(plain(high.context.scissorBox([-.5,-.5,-.5],[.5,.5,.5],[0,0,0],[0,0,-1])),[0,0,1440,800],'near-plane fallback covers native full buffer');
 report.normalizedRayEquivalenceSamples=rays;report.scissorBoxesChecked=boxes;report.nearPlaneFallbackPassed=true;
 const oldSurface=old.context.SURFACE,lowSurface=low.context.SURFACE,highSurface=high.context.SURFACE;let footprintChecks=0;
 for(const incidence of [1,.75,.5,.25,.151])for(const t of [0,1,12,30]){
  const n=[incidence,Math.sqrt(1-incidence*incidence),0],r=[-1,0,0],a=lowSurface.footprintRadius(t,n,r),b=highSurface.footprintRadius(t,n,r);
  assert.equal(a,oldSurface.footprintRadius(t,n,r));assert.equal(highSurface.footprintRadius(t,n,r,400),a);assert.equal(lowSurface.footprintRadius(t,n,r,800),b);
  assert(Math.abs(b-2*t*config.rayEpsilon/(incidence-config.rayEpsilon))<1e-12);assert(b<=a);
  for(const name of high.context.ANALYTIC_MATERIAL_WAVES.names)for(const wave of high.context.ANALYTIC_MATERIAL_WAVES.presets[name].waves)assert(highSurface.detailWeight(wave,b)>=lowSurface.detailWeight(wave,a));footprintChecks++;
 }
 assert.equal(highSurface.footprintRadius(12,[0,1,0],[1,0,0]),1e20);assert.throws(()=>highSurface.footprintRadius(12,[1,0,0],[-1,0,0],0));
 let tangentChecks=0;
 for(let i=0;i<2500;i++){const r=unit([random()-.5,random()-.5,random()-.5]),n=unit([random()-.5,random()-.5,random()-.5]),t=1+30*random();if(Math.abs(dot(n,r))<.16)continue;const perturbed=unit(r.map(v=>v+.001*(random()-.5))),tt=t*dot(n,r)/dot(n,perturbed),delta=r.map((v,j)=>tt*perturbed[j]-t*v);assert(norm(delta)<=highSurface.footprintRadius(t,n,r)+1e-12);tangentChecks++;}
 report.footprintChecks=footprintChecks;report.highResolutionTangentConeSamples=tangentChecks;report.grazingFilterPreserved=true;
 const cases=[{mode:'baseline',cut:100,time:0,appearance:'waves'},{mode:'candidate',cut:100,time:0,appearance:'waves'},{mode:'candidate',cut:0,time:3.3545228223-.4,appearance:'waves'},{mode:'baseline',cut:0,time:3.3545228223-.4,appearance:'diagnostic'},{mode:'baseline',cut:100,time:0,appearance:'waves'}];
 let firstLowDraws,firstHighDraws;report.frames=[];
 for(const frame of cases){const object={cut:frame.cut,installation:{mode:frame.mode,beta:.126},appearance:{mode:frame.appearance,detailScale:1}},eye=[12,3.5,-4];
  for(const state of [old,low,high])await state.context.renderAt(frame.time,{eye},object);
  inspectUploads(low,720,400);inspectUploads(high,1440,800);
  assert.deepEqual(strippedDraws(low),strippedDraws(old),'720 original draw/scissor/uniform sequence unchanged');
  const installation=high.context.DYNAMIC.snapshot(object.installation),expected=high.context.SCENE.parts.filter(p=>high.context.DYNAMIC.visible(p,installation)).length;assert.equal(low.gl.draws.length,expected);assert.equal(high.gl.draws.length,expected);
  assert.deepEqual(strippedDraws(low).map(d=>({program:d.program,uniforms:d.uniforms})),strippedDraws(high).map(d=>({program:d.program,uniforms:d.uniforms})),'native resolution must not alter any mechanical/material inputs');
  if(!firstLowDraws){firstLowDraws=strippedDraws(low);firstHighDraws=strippedDraws(high);}
  assert.equal(high.context.QA.surface.geometryDisplacement,0);assert.equal(high.context.QA.mechanicalAcceptance,false);
  report.frames.push({...frame,draws:expected,expectedDrawsSource:'Actual SCENE.parts filtered by DYNAMIC.visible for this installation',dimensions:[1440,800]});
 }
 assert.deepEqual(strippedDraws(low),firstLowDraws);assert.deepEqual(strippedDraws(high),firstHighDraws);report.mockReturnDrawsExact=true;report.default720DrawsByteEquivalent=true;report.everyProgramResolutionAndEpsilonUploadVerified=true;
 // A changed query string cannot resize the already initialized canvas.
 high.context.location.search='?resolution=720x400';await high.context.renderAt(0,{eye:[12,3.5,-4]},{});assert.equal(high.canvas.width,1440);inspectUploads(high,1440,800);
 // External resize is rejected rather than racing with the fixed render queue.
 high.canvas.width=720;await assert.rejects(high.context.renderAt(0,{},{}),/dimensions changed after page initialization/);high.canvas.width=1440;await high.context.renderAt(0,{},{});inspectUploads(high,1440,800);
 await assert.rejects(boot('?resolution=999999x999999'),/Unsupported resolution/);await assert.rejects(boot('?resolution=800x800'),/Unsupported resolution/);
 report.fixedStartupResolutionAndResizeRejection=true;report.invalidResolutionRejected=true;
 report.status='PASS_CPU_MOCK_ONLY';fs.mkdirSync(outputRoot,{recursive:true});fs.writeFileSync(path.join(outputRoot,'CPU_RESOLUTION_QA.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(error=>{report.status='FAIL';report.error=String(error);fs.mkdirSync(outputRoot,{recursive:true});fs.writeFileSync(path.join(outputRoot,'CPU_RESOLUTION_QA.json'),JSON.stringify(report,null,2)+'\n');console.error(error);process.exitCode=1;});
