'use strict';
// CPU math + mocked upload wiring. This does NOT emulate GLSL or prove pixels.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const B=require('./r32-tests/legacy-test-bootstrap.cjs'),retained=B.assertRetainedScene();
const root=process.env.A4_SCENE_ROOT||[__dirname,path.join(__dirname,'..'),path.join(__dirname,'../r29')].find(p=>fs.existsSync(path.join(p,'scene.js')));
assert(root,'Set A4_SCENE_ROOT to the unchanged R29 input directory');
const rendererRoot=process.env.A4_RENDERER_ROOT||__dirname,outputRoot=process.env.A4_QA_OUTPUT||path.dirname(B.output('MATERIAL_INTEGRATION_QA.json'));
const historicalRoot=B.historical('r31');
const studyRoot=process.env.A4_RESOLUTION_STUDY||path.join(historicalRoot,'resolution-study');
const legacyRoot=process.env.A4_RESOLUTION_LEGACY||path.join(studyRoot,'legacy');
const read=n=>fs.readFileSync(path.join(['app.js','material-renderer.js'].includes(n)?rendererRoot:root,n),'utf8'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
fs.mkdirSync(path.join(outputRoot,'material-wave-study'),{recursive:true});
// Pure model load excludes DOM bootstrap by explicit role, while retaining all actual page model dependencies.
const c=B.loadModel(root).context;
const S=c.SCENE,D=c.DYNAMIC,M=c.ANALYTIC_MATERIAL_WAVES,A=c.createSurfaceAppearance(S,D,M,c.createMaterialCoordinates);
assert.equal(hash(JSON.stringify(S)),'0e7f7b7d9be4c4ed169519d23cd37ea67e59cdc758bfda2b4815d42232abe6ff','retained full728 model lock');
assert.equal(hash(D.glsl),'08195ead446f81ca665baaa0d8a5d999d10e40537e2dd3c1e17a2269a321bbd8','retained full dynamic GLSL lock');
const report={retainedSceneLock:retained,pass:true,scope:'CPU math and mock WebGL uniform wiring only; no browser, driver shader compilation, render or visual acceptance',browser:'NOT_RUN_TEST_USES_EXPLICIT_FACADE',mechanicalAcceptance:false,geometryDisplacement:0,fieldCount:S.parts.length};
const sourceBaseline=JSON.parse(fs.readFileSync(path.join(studyRoot,'SOURCE_BASELINE.json'),'utf8')),historicalGeometryMismatches=[];
for(const [name,expected] of Object.entries(JSON.parse(read('MATERIAL_GEOMETRY_LOCK.json')).sha256)){
 const actual=hash(fs.readFileSync(path.join(historicalRoot,name)));assert.equal(actual,sourceBaseline.sha256[name],'unchanged current R29 input '+name);
 if(actual!==expected)historicalGeometryMismatches.push({file:name,historicalR27Hash:expected,currentR29Hash:actual});
}
assert.deepEqual(historicalGeometryMismatches,sourceBaseline.preExistingHistoricalGeometryLockMismatches,'new historical mismatch is not allowed');
report.preExistingHistoricalGeometryLockMismatches=historicalGeometryMismatches;report.frozenHistoricalR31GeometryLockPassed=true;report.currentGenerated728ModelUnchanged=true;
for(const name of sourceBaseline.unchangedRuntimeScripts)assert.equal(hash(fs.readFileSync(path.join(historicalRoot,name))),sourceBaseline.sha256[name],'unchanged runtime input '+name);
const app=read('app.js'),historicalApp=fs.readFileSync(path.join(historicalRoot,'app.js'),'utf8'),locks=JSON.parse(read('RENDER_GEOMETRY_LOCK.json')).sha256;
const legacyApp=fs.readFileSync(path.join(legacyRoot,'app.js'),'utf8');
for(const [key,start,end] of [['scalarDispatch','let dispatch=','let fs='],['rayIntersectionAndNormal','float field(vec3 p)','outColor=vec4(surfaceColor'],['scissorProjection','function scissorBox','\n(async()=>']])assert.equal(hash(legacyApp.slice(legacyApp.indexOf(start),legacyApp.indexOf(end,legacyApp.indexOf(start)))),locks[key],'retained historical '+key);
const excerpt=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
for(const [start,end]of [['let dispatch=','let fs='],['float field(vec3 p)','void main()'],['float hit=-1.;','outColor=vec4(surfaceColor']])assert.equal(excerpt(historicalApp,start,end),excerpt(legacyApp,start,end),'historically retained field/intersection/normal source');
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
report.filteredSamples=samples;report.tangentConeSamples=2500;report.maximumFootprintRatio=maximumFootprintRatio;report.roughnessChangesLighting=true;report.historicalLocksRetained=true;report.historicalFieldIntersectionNormalSourceUnchanged=true;report.cameraProjectionValidation='See independent test_resolution.js; not claimed by the historical locks';
// Current renderer is tiled/multipass. Run all actual page scripts, not the old
// one-program/source facade. State readback is explicit synthetic MISS: NO pixels.
(async()=>{
 const run=await require('./r32-tests/legacy-material-facade.cjs').load(root),r=run.c;
 assert.equal(r.QA.errors.length,0);assert(r.QA.done&&r.QA.frameValid);
 assert.equal(r.SCENE.parts.length,728);assert.equal(hash(JSON.stringify(r.SCENE)),hash(JSON.stringify(S)));
 function verifyDraws(theta,installation,appearance){
  const expected=[];let visible=0,expectedStateDraws=0;
  for(const [programKey,g]of Object.entries(run.groups()))for(let id=0;id<g.ps.length;id++){
   const p=g.ps[id];if(!r.DYNAMIC.visible(p,installation))continue;visible++;
   const bounds=r.DYNAMIC.bounds(p,theta,installation),box=r.scissorBox(bounds[0],bounds[1],[12,3.5,-4],[0,1.8,-4]);
   if(g.pair){if(box[2]&&box[3]){expected.push({p,id,g,box});expectedStateDraws+=1;}}
   else for(const tile of r.A4_INTERVAL_GPU.tiles(box))expected.push({p,id,g,box:tile});
  }
  const actual=run.mappedDraws().filter(d=>!d.fbo);assert.equal(actual.length,expected.length,'all default-buffer physical draws, including32px tiles');
  for(let n=0;n<expected.length;n++){
   const {p,id,g,box}=expected[n],a=actual[n],u=a.uniforms,f=A.frame(p,theta,installation);
   assert.equal(a.part,p.id);assert.equal(a.source,p.source);assert.equal(u.id,id);assert.equal(u.timeTheta,theta);assert.equal(u.installationCandidate,installation.mode==='candidate'?1:0);assert.equal(u.surfaceAppearance,appearance.mode==='waves'?1:0);assert.equal(u.surfaceDetailScale,appearance.detailScale);
   for(let j=0;j<3;j++)assert(error(u['materialInverseRow'+j],f.coordinates.rows[j])<1e-14);
   const bounds=D.bounds(p,theta,installation);assert(error(u.bmin,bounds[0])<1e-14);assert(error(u.bmax,bounds[1])<1e-14);
   assert.deepEqual(a.viewport,Array.from(box));assert.deepEqual(a.scissor,Array.from(box));
  }
  const state=run.mappedDraws().filter(d=>d.fbo);assert.equal(state.length,expectedStateDraws,'explicit synthetic-MISS initialization-only state draw per nonempty interval box');
  for(const a of state){const p=S.parts.find(p=>p.id===a.part);assert(p&&!p.lipschitz);assert.equal(a.uniforms.timeTheta,theta);assert.equal(a.uniforms.id,0);assert.equal(a.uniforms.intervalNodeBudget,4096);assert.equal(a.uniforms.initializeState,1);const f=A.frame(p,theta,installation);for(let j=0;j<3;j++)assert(error(a.uniforms['materialInverseRow'+j],f.coordinates.rows[j])<1e-14);}
  assert.equal(r.QA.draws,visible);return{logicalFields:visible,defaultBufferPhysicalDraws:actual.length,statePhysicalDraws:state.length};
 }
 const checks=[];
 for(const [mode,time,appearance]of [['baseline',0,{mode:'waves',detailScale:1}],['candidate',1,{mode:'waves',detailScale:1}],['candidate',1,{mode:'diagnostic',detailScale:1}],['candidate',0,{mode:'waves',detailScale:0}],['baseline',0,{mode:'waves',detailScale:1}]]){
  const installation={mode,beta:.126};run.clearDraws();await r.renderAt(time,{eye:[12,3.5,-4]},{installation,appearance});const expected=r.DYNAMIC.snapshot(installation);
  checks.push(verifyDraws(.4+time,expected,appearance));assert.equal(r.QA.mechanicalAcceptance,false);assert.equal(r.QA.surface.geometryDisplacement,0);
 }
 const checkedRow=run.draws.find(d=>!d.fbo),savedRow=JSON.parse(JSON.stringify(checkedRow));let rejectedWiringControls=0;
 for(const mutate of [d=>d.uniforms.timeTheta+=.1,d=>d.uniforms.id+=1,d=>d.uniforms.bmin[0]+=.1,d=>d.uniforms.materialInverseRow0[3]+=.1,d=>d.viewport[0]++,d=>d.scissor[0]++]){mutate(checkedRow);assert.throws(()=>verifyDraws(.4,r.DYNAMIC.snapshot({mode:'baseline',beta:.126}),{mode:'waves',detailScale:1}));Object.assign(checkedRow,JSON.parse(JSON.stringify(savedRow)));rejectedWiringControls++;}
 report.rejectedCurrentWiringNegativeControls=rejectedWiringControls;
 assert.equal(r.QA.errors.length,0);assert.equal(run.errors.length,0);
 const fragments=run.shaders.filter(s=>s.type===run.gl.FRAGMENT_SHADER);assert.equal(fragments.length,run.programs.length);
 const safe=s=>s.replace(/\b[A-Za-z_]\w*__\w*\b/g,n=>n.replace(/__/g,'_neg_'));
 const normalTail=excerpt(historicalApp,'if(hit<0.)discard;','}`;');
 assert(normalTail.includes('gl_FragDepth=hit/80.;'));
 let fieldChecks=0,intervalChecks=0,tailChecks=0;
 for(const g of Object.values(run.groups())){
  for(const program of [g.p,...(g.pair?[g.pair.step]:[])]){
   const shader=program.shaders.find(s=>s.type===run.gl.FRAGMENT_SHADER).source;
   for(let id=0;id<g.ps.length;id++){const p=g.ps[id];assert(shader.includes(safe(`if(id==${id})return ${D.scalar(p)};`)),'actual dispatched scalar '+p.id);fieldChecks++;}
   if(g.pair&&program===g.pair.step){assert(shader.includes(safe(D.interval(g.ps[0]))),'actual interval consumer');assert(shader.includes('intervalNodeBudget'));assert(shader.includes('.0005'));intervalChecks++;}
   else{assert(shader.includes('surfaceColor(p,n,rd,hit,cutX,color)'));assert(shader.includes('gl_FragDepth=hit/80.;'));assert(shader.includes(normalTail),'original hit/normal/material/depth tail retained');tailChecks++;}
  }
 }
 assert.equal(fieldChecks,728+16);assert.equal(intervalChecks,16);assert.equal(tailChecks,Object.keys(run.groups()).length);
 const eye=[12,3.5,-4],installation={mode:'candidate',beta:.126},appearance={mode:'waves',detailScale:1};run.clearDraws();const pending=r.render(eye,[0,1.8,-4],100,.4,installation,appearance);eye[0]=123;installation.mode='baseline';appearance.mode='diagnostic';await pending;
 assert.equal(run.mappedDraws().filter(d=>!d.fbo)[0].uniforms.eye[0],12);assert.equal(r.QA.installation.mode,'candidate');assert.equal(r.QA.appearance.mode,'waves');
 report.mockDrawCounts=checks;report.immutableQueuedStatePassed=true;report.shaderProgramsAssembled=run.programs.length;report.actualCurrentShaderChecks={fieldDispatches:fieldChecks,intervalConsumers:intervalChecks,originalNormalMaterialDepthTails:tailChecks};report.driverCompilation='NOT_RUN';report.currentFacade='All actual page scripts; explicit synthetic MISS state words, no rasterized pixels';report.surfaceCoverage={baseline:A.coverage(D.snapshot({mode:'baseline'})),candidate:A.coverage(D.snapshot({mode:'candidate',beta:.126}))};
 fs.writeFileSync(path.join(outputRoot,'MATERIAL_INTEGRATION_QA.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
