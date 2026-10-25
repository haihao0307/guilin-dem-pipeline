'use strict';
// CPU math + mocked upload wiring. This does NOT emulate GLSL or prove pixels.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=process.env.A4_SCENE_ROOT||[__dirname,path.join(__dirname,'..'),path.join(__dirname,'../r29')].find(p=>fs.existsSync(path.join(p,'scene.js')));
assert(root,'Set A4_SCENE_ROOT to the unchanged R29 input directory');
const rendererRoot=process.env.A4_RENDERER_ROOT||__dirname,outputRoot=process.env.A4_QA_OUTPUT||__dirname;
const studyRoot=process.env.A4_RESOLUTION_STUDY||(fs.existsSync(path.join(__dirname,'SOURCE_BASELINE.json'))?__dirname:path.join(__dirname,'resolution-study'));
const legacyRoot=process.env.A4_RESOLUTION_LEGACY||path.join(studyRoot,'legacy');
const read=n=>fs.readFileSync(path.join(['app.js','material-renderer.js'].includes(n)?rendererRoot:root,n),'utf8'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
fs.mkdirSync(path.join(outputRoot,'material-wave-study'),{recursive:true});
const c={console,setTimeout,performance,URLSearchParams,location:{search:''}};c.window=c;vm.createContext(c);
const load=n=>vm.runInContext(read(n),c,{filename:n});
// Follow the actual R29 page dependencies; the retained R28 test list omitted the side-offset solver and later adapters.
for(const n of [...read('index.html').matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(n=>!['app.js','controls.js'].includes(n)))load(n);
const S=c.SCENE,D=c.DYNAMIC,M=c.ANALYTIC_MATERIAL_WAVES,A=c.createSurfaceAppearance(S,D,M,c.createMaterialCoordinates);
const report={pass:true,scope:'CPU math and mock WebGL uniform wiring only; no browser, driver shader compilation, render or visual acceptance',browser:'NOT_RUN_LOCAL_SANDBOX_DENIED',mechanicalAcceptance:false,geometryDisplacement:0,fieldCount:S.parts.length};
const sourceBaseline=JSON.parse(fs.readFileSync(path.join(studyRoot,'SOURCE_BASELINE.json'),'utf8')),historicalGeometryMismatches=[];
for(const [name,expected] of Object.entries(JSON.parse(read('MATERIAL_GEOMETRY_LOCK.json')).sha256)){
 const actual=hash(fs.readFileSync(path.join(root,name)));assert.equal(actual,sourceBaseline.sha256[name],'unchanged current R29 input '+name);
 if(actual!==expected)historicalGeometryMismatches.push({file:name,historicalR27Hash:expected,currentR29Hash:actual});
}
assert.deepEqual(historicalGeometryMismatches,sourceBaseline.preExistingHistoricalGeometryLockMismatches,'new historical mismatch is not allowed');
report.preExistingHistoricalGeometryLockMismatches=historicalGeometryMismatches;report.currentR29GeometryUnchanged=true;
for(const name of sourceBaseline.unchangedRuntimeScripts)assert.equal(hash(fs.readFileSync(path.join(root,name))),sourceBaseline.sha256[name],'unchanged runtime input '+name);
const app=read('app.js'),locks=JSON.parse(read('RENDER_GEOMETRY_LOCK.json')).sha256;
const legacyApp=fs.readFileSync(path.join(legacyRoot,'app.js'),'utf8');
for(const [key,start,end] of [['scalarDispatch','let dispatch=','let fs='],['rayIntersectionAndNormal','float field(vec3 p)','outColor=vec4(surfaceColor'],['scissorProjection','function scissorBox','\n(async()=>']])assert.equal(hash(legacyApp.slice(legacyApp.indexOf(start),legacyApp.indexOf(end,legacyApp.indexOf(start)))),locks[key],'retained historical '+key);
const excerpt=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
for(const [start,end]of [['let dispatch=','let fs='],['float field(vec3 p)','void main()'],['float hit=-1.;','outColor=vec4(surfaceColor']])assert.equal(excerpt(app,start,end),excerpt(legacyApp,start,end),'unchanged field/intersection/normal source');
// Camera/scissor parameterization is independently checked by test_resolution.js.

assert(app.includes('gl_FragDepth=hit/80.;'));assert(!/texture\s*\(|sampler|dFdx|dFdy|fwidth|uniform\s+float\s+(?:time|theta)/.test(A.glsl));
for(const mode of ['baseline','candidate']){const installation=D.snapshot({mode,beta:.126}),visible=S.parts.filter(p=>D.visible(p,installation)).length;assert.equal(A.coverage(installation).visible,visible);}
const expectedStackFields=S.parts.filter(p=>p.source==='stack').length;
report.actualStackFields=expectedStackFields;
let stackCalls=0;const savedFrame=D.gresleyFrame;D.gresleyFrame=(part,...args)=>{if(part.source==='stack')stackCalls++;return savedFrame(part,...args);};
for(const part of S.parts.filter(p=>p.source==='stack')){const f=A.frame(part,1.4,D.snapshot({mode:'candidate',beta:.126}));assert.equal(f.coordinates.kind,'stack-gresley-inverse-XZ-once');assert.equal(f.coordinates.scalarArgument,'dynGresley(p)');}
assert.equal(stackCalls,expectedStackFields);D.gresleyFrame=savedFrame;report.stackMappingsExactlyOnce=stackCalls;
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>Math.hypot(...a),unit=a=>a.map(v=>v/norm(a)),error=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
let seed=421;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const I=[[1,0,0],[0,1,0],[0,0,1]],color=[.38,.62,.72];let samples=0,maximumFilterBoundExcess=0,maximumFootprintRatio=0;
for(const name of M.names)for(let k=0;k<240;k++){
 const q=[0,1,2].map(()=>12*random()-6),n=unit([random()-.5,random()-.5,random()-.5]),radius=2*random(),b=M.bounds(name),m=M.presets[name];
 const shade=A.filteredSample(q,n,I,name,radius,1,color);
 assert(Math.abs(shade.virtualHeight)<=b.height+1e-14);assert(error(shade.normal,n)<=2*Math.sin(b.normalAngleRadians/2)+1e-12);
 assert.equal(shade.geometryDisplacement,0);assert(shade.weights.every(w=>w>=0&&w<=1));
 const disabled=A.filteredSample(q,n,I,name,radius,0,color);assert(error(disabled.normal,n)<1e-14);assert.equal(disabled.virtualHeight,0);
 const rgb=A.lighting(shade,[.4,.8,.2]);assert(rgb.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
 const shadow=A.lighting(shade,[-.6,-.9,-.4]);assert(shadow.every(Number.isFinite));
 for(const w of m.waves){assert(A.detailWeight(w,radius)>=A.detailWeight(w,radius+.1));assert.equal(A.detailWeight(w,1e20),0);}
 samples++;
}
// Low-frequency bands remain sampleable at the default whole-view distance.
for(const name of ['neutral','steel','copper','wood']){
 const r=A.footprintRadius(12,[1,0,0],[-1,0,0]);const weights=M.presets[name].waves.map(w=>A.detailWeight(w,r));
 assert(weights.some(w=>w>.8),`${name}: all whole-view waves unexpectedly vanished`);
 assert(weights.some(w=>w===0),`${name}: micro frequencies must be filtered at whole scale`);
}
assert.equal(A.footprintRadius(12,[0,1,0],[1,0,0]),1e20);
const fullViewFilter={scope:'CPU weights at nominal 12m whole-view distance; not browser pixel visibility',presets:{}};
for(const incidence of [1,.75,.5,.25]) {
 const radius=A.footprintRadius(12,[incidence,Math.sqrt(1-incidence*incidence),0],[-1,0,0]);
 fullViewFilter.presets[incidence]={radius,weights:Object.fromEntries(['neutral','steel','copper','wood'].map(name=>[name,M.presets[name].waves.map(w=>A.detailWeight(w,radius))]))};
}
fs.writeFileSync(path.join(outputRoot,'material-wave-study/WHOLE_VIEW_FILTER_QA.json'),JSON.stringify(fullViewFilter,null,2)+'\n');

// Direct tangent-plane ray intersections verify the cone bound, independently.
for(let k=0;k<2500;k++){
 const ray=unit([random()-.5,random()-.5,random()-.5]),n=unit([random()-.5,random()-.5,random()-.5]),t=1+30*random();
 if(Math.abs(dot(n,ray))<.16)continue;
 const perturbed=unit(ray.map(v=>v+.002*(random()-.5)));
 const tt=t*dot(n,ray)/dot(n,perturbed),delta=ray.map((v,i)=>tt*perturbed[i]-t*v),radius=A.footprintRadius(t,n,ray);
 maximumFootprintRatio=Math.max(maximumFootprintRatio,norm(delta)/radius);assert(norm(delta)<=radius+1e-12);
}
const light=unit([.6,.9,.4]),base={normal:light,albedo:[.48,.51,.54],metallic:.95};
const smooth=A.lighting({...base,roughness:.2},light),rough=A.lighting({...base,roughness:.8},light);assert(error(smooth,rough)>.1,'roughness has no meaningful lighting effect');
report.filteredSamples=samples;report.tangentConeSamples=2500;report.maximumFootprintRatio=maximumFootprintRatio;report.roughnessChangesLighting=true;report.historicalLocksRetained=true;report.unchangedFieldIntersectionNormalSource=true;report.cameraProjectionValidation='See independent test_resolution.js; not claimed by the historical locks';
// Capture all source shaders and actual per-draw uniforms with a strict mock.
const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,DEPTH_TEST:5,COLOR_BUFFER_BIT:8,DEPTH_BUFFER_BIT:16,SCISSOR_TEST:6,TRIANGLES:7,
 drawingBufferWidth:720,drawingBufferHeight:400,viewport(...v){this.currentViewport=v;},
 current:null,shaders:[],programs:[],draws:[],createShader(type){const s={type};this.shaders.push(s);return s;},shaderSource(s,source){s.source=source;},compileShader(){},getShaderParameter(){return true;},
 createProgram(){const p={shaders:[],uniforms:{}};this.programs.push(p);return p;},attachShader(p,s){p.shaders.push(s);},linkProgram(){},getProgramParameter(){return true;},useProgram(p){this.current=p;},
 getUniformLocation(p,n){return {p,n};},uniform2f(u,x,y){u.p.uniforms[u.n]=[x,y];},uniform3fv(u,v){u.p.uniforms[u.n]=Array.from(v);},uniform4fv(u,v){u.p.uniforms[u.n]=Array.from(v);},uniform1f(u,v){u.p.uniforms[u.n]=v;},uniform1i(u,v){u.p.uniforms[u.n]=v;},
 enable(){},disable(){},clearColor(){},clear(){this.draws=[];},scissor(...s){this.current.scissor=s;},finish(){},getError(){return 0;},drawArrays(){this.draws.push({program:this.current,uniforms:JSON.parse(JSON.stringify(this.current.uniforms)),scissor:this.current.scissor.slice()});}};
const elements={c:{width:720,height:400,getContext:()=>gl},status:{}};c.document={getElementById:id=>{assert(elements[id],id);return elements[id];}};c.RESEARCH_UI={install(){},async request(){},showRendered(){}};
function verifyDraws(theta,installation,appearance){
 const groups=Object.entries(S.sources).map(([source])=>S.parts.filter(p=>p.source===source));let count=0;
 for(let si=0;si<groups.length;si++)for(let i=0;i<groups[si].length;i++){
   const p=groups[si][i];if(!D.visible(p,installation))continue;const u=gl.draws[count++].uniforms,f=A.frame(p,theta,installation);
   assert.equal(u.id,i);assert.equal(u.timeTheta,theta);assert.equal(u.installationCandidate,installation.mode==='candidate'?1:0);assert.equal(u.surfaceAppearance,appearance.mode==='waves'?1:0);assert.equal(u.surfaceDetailScale,appearance.detailScale);
   for(let j=0;j<3;j++)assert(error(u['materialInverseRow'+j],f.coordinates.rows[j])<1e-14);
   const bounds=D.bounds(p,theta,installation);assert(error(u.bmin,bounds[0])<1e-14);assert(error(u.bmax,bounds[1])<1e-14);
 }
 assert.equal(gl.draws.length,count);return count;
}
(async()=>{
 load('app.js');while(!c.render){assert.equal(c.QA.errors.length,0);await new Promise(r=>setTimeout(r,2));}
 const checks=[];
 for(const [mode,time,appearance]of [['baseline',0,{mode:'waves',detailScale:1}],['candidate',1,{mode:'waves',detailScale:1}],['candidate',1,{mode:'diagnostic',detailScale:1}],['candidate',0,{mode:'waves',detailScale:0}],['baseline',0,{mode:'waves',detailScale:1}]]){
   const installation={mode,beta:.126};await c.renderAt(time,{eye:[12,3.5,-4]},{installation,appearance});const expected=D.snapshot(installation);
   checks.push(verifyDraws(.4+time,expected,appearance));assert.equal(c.QA.mechanicalAcceptance,false);assert.equal(c.QA.surface.geometryDisplacement,0);
 }
 assert.equal(c.QA.errors.length,0);assert.equal(gl.shaders.filter(s=>s.type===gl.FRAGMENT_SHADER).length,Object.keys(S.sources).length);
 for(const shader of gl.shaders.filter(s=>s.type===gl.FRAGMENT_SHADER)){assert(shader.source.includes('surfaceColor(p,n,rd,hit,cutX,color)'));assert(shader.source.includes('gl_FragDepth=hit/80.'));}
 const eye=[12,3.5,-4],installation={mode:'candidate',beta:.126},appearance={mode:'waves',detailScale:1};const pending=c.render(eye,[0,1.8,-4],100,.4,installation,appearance);eye[0]=123;installation.mode='baseline';appearance.mode='diagnostic';await pending;
 assert.equal(gl.draws[0].uniforms.eye[0],12);assert.equal(c.QA.installation.mode,'candidate');assert.equal(c.QA.appearance.mode,'waves');
 report.mockDrawCounts=checks;report.immutableQueuedStatePassed=true;report.shaderProgramsAssembled=gl.programs.length;report.driverCompilation='NOT_RUN';report.surfaceCoverage={baseline:A.coverage(D.snapshot({mode:'baseline'})),candidate:A.coverage(D.snapshot({mode:'candidate',beta:.126}))};
 fs.writeFileSync(path.join(outputRoot,'MATERIAL_INTEGRATION_QA.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
