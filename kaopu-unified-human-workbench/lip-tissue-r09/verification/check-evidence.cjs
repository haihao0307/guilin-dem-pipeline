'use strict';
// Verifies frozen experiment evidence only. Technical execution cannot promote an appearance.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const PREVIEW_SHA='dcb126c2cca5671ccd541e938705816afb190af791c88c322504db1dd6d12222';
const QA_SHA='43b40dad41380ebacb8e4865558850e62410c1ab8b5ef5ec7734a28a6dfb874d';
const SOURCE_SHA='70457c86c20e724235705ff45fd919ac822dba8e',BUILD_SHA='dcded3a1b471d32ce191296939b6266e6d41e62a';
const RAW='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/'+BUILD_SHA+'/kaopu-unified-human-workbench/lip-surface-r08/preview.html';
const specs=[
 {id:'beauty',recipe:'research/recipes-initial.json',out:'evidence/ci-beauty',cases:[
  ['cross-section-redistribution','535dec77e26e30b470bd0ae1a61e9ee62a510ba0181ffc9669b98f7c34175b47'],
  ['shared-main-curve-interspace-half-height','6b5a66b0b7c9b852ef860450a272cdadbffe910eef30efb6a74558d9216092fc']
 ]},
 {id:'root-cause',recipe:'research/recipes-root-cause-support.json',out:'evidence/ci-root-cause',cases:[
  ['data-only-frozen-b-support','0474d05224fd99c4c9df4db603f8a98256ef8287722dcdcad8fe2818929ab39e'],
  ['data-only-frozen-b-larger-response','48b497e737084d811b1ab018757950cd852b879d0103e50ad670f65849062529']
 ]}
];
const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function validateInputs(){
 assert(process.env.BASELINE_PREVIEW_PATH&&process.env.BASELINE_QA_PATH,'Explicit immutable R08 input paths required');
 assert.equal(sha(fs.readFileSync(process.env.BASELINE_PREVIEW_PATH)),PREVIEW_SHA,'R08 preview bytes changed');
 assert.equal(sha(fs.readFileSync(process.env.BASELINE_QA_PATH)),QA_SHA,'R08 reference QA bytes changed');
 const publicQA=readJSON(process.env.BASELINE_QA_PATH),reference=publicQA.comparisons.find(x=>x.pose==='neutral'&&x.view==='macro'&&x.progress===1);
 assert(reference,'Frozen neutral/macro reference missing');
 for(const spec of specs){
  spec.recipeBytes=fs.readFileSync(path.join(root,spec.recipe));spec.parsed=JSON.parse(spec.recipeBytes);
  assert.equal(spec.parsed.schema,'kaopu/lip-r09-native-experiments@1');
  assert.deepEqual(spec.parsed.matrix,[{pose:'neutral',view:'macro',progress:1}],'Only the frozen single view is authorized');
  assert.deepEqual(spec.parsed.cases.map(c=>c.id),spec.cases.map(c=>c[0]),'Frozen case IDs/order changed');
  for(let i=0;i<spec.cases.length;i++)assert.equal(sha(JSON.stringify(spec.parsed.cases[i].patches)),spec.cases[i][1],'Frozen patch bytes changed: '+spec.cases[i][0]);
  if(spec.id==='root-cause'){assert.equal(spec.parsed.visualCandidate,false);for(const c of spec.parsed.cases)assert.equal(c.visualCandidate,false);}
 }
 return{reference,runnerSHA256:sha(fs.readFileSync(path.join(__dirname,'run-native-experiments.cjs')))};
}
function patchLiteral(source,patches,reverse=false){for(const p of reverse?[...patches].reverse():patches){const from=reverse?p.to:p.from,to=reverse?p.from:p.to;assert.equal(source.split(from).length,2,'Patch must hit exactly once: '+p.id);source=source.replace(from,()=>to);}return source;}
function readSnapshot(out,name){
 const record=readJSON(path.join(out,name+'.json')),texts={};
 assert(record.state.functionsOriginal);assert(record.state.materials.every(m=>m.sameOriginalObject&&m.sameOriginalCompileHook&&m.sameOriginalCacheKey));
 assert(record.transaction.hooksRestored&&record.transaction.nativeRenderFunctionRestored);
 assert.equal(record.shader.nativeUniforms.length,15);assert(record.shader.nativeUniforms.every(u=>u.nativePresent&&u.skinPresent&&u.sameObject&&u.sameNativeObjectSinceHarness&&u.sameSkinObjectSinceHarness));
 assert.deepEqual(record.shader.expanded.map(s=>s.type).sort(),['fragment','vertex']);
 for(const s of record.shader.expanded){assert.equal(s.compiled,true);assert.equal(s.file,name+'-'+s.type+'.glsl');const bytes=fs.readFileSync(path.join(out,s.file));assert.equal(sha(bytes),s.sha256);assert.equal(bytes.length,s.bytes);texts[s.type]=bytes.toString('utf8');}
 return{...record,texts};
}
function checkFrame(out,frame){
 assert.equal(frame.width,640);assert.equal(frame.height,512);assert.match(frame.sha256,/^[a-f0-9]{64}$/);assert(frame.nonUniformPixels>640*512*.01);
 const g=frame.gpu;assert.equal(g.errorBefore,0);assert.equal(g.error,0);assert.equal(g.lost,false);assert.equal(g.defaultFramebuffer,true);assert.equal(g.restored,true);
 assert(g.passes.some(p=>p.nativeScene&&p.nativeCamera&&p.frameDelta>0&&p.drawCalls>0&&p.triangles>0),'Native scene/camera draw missing');assert(g.programs.length&&g.programs.every(p=>p.linked),'GPU program link failed');
 if(frame.saved){
  const bytes=fs.readFileSync(path.join(out,frame.name+'.png'));assert.equal(sha(bytes),frame.pngSHA256);
  const {PNG}=require('pngjs'),png=PNG.sync.read(bytes),raw=Buffer.alloc(640*512*4);assert.equal(png.width,640);assert.equal(png.height,512);
  for(let y=0;y<512;y++)png.data.copy(raw,(511-y)*640*4,y*640*4,(y+1)*640*4);
  assert.equal(sha(raw),frame.sha256,'PNG bytes do not reproduce the native readPixels buffer');
 }
}
function validateExperiment(spec,common,run){
 const out=path.join(root,spec.out),q=readJSON(path.join(out,'qa.json'));
 assert.equal(q.schema,'kaopu/lip-r09-native-local-experiment@1');assert.equal(q.mode,'local-candidate-transactions');assert.equal(q.completed,true);
 for(const key of ['failure','restorationError','cleanupError'])assert(!q[key],key);
 for(const key of ['pageErrors','consoleErrors','failedRequests','resourceErrors'])assert.deepEqual(q[key],[],key);
 for(const key of ['visualAcceptance','productionReady','publicHttpsPassed','shareAllowed','temporalStabilityTested'])assert.equal(q[key],false,key);
 assert.equal(q.browserVersion,'145.0.7632.6');assert.equal(q.runnerSHA256,common.runnerSHA256);assert.equal(q.recipeSHA256,sha(spec.recipeBytes));assert.equal(sha(fs.readFileSync(path.join(out,'recipes.json'))),q.recipeSHA256);
 assert.equal(q.sourceVerifierSHA256,'cf3dd4372f682a71721a1fcaf798c311d2673cb01f47101ebd6bf023bba682ce');
 assert.equal(q.baseline.previewSHA256,PREVIEW_SHA);assert.equal(q.baseline.publicQASHA256,QA_SHA);assert.equal(q.baseline.sourceCommit,SOURCE_SHA);assert.equal(q.baseline.buildCommit,BUILD_SHA);assert.equal(q.baseline.route,RAW);assert(q.baseline.routeCount>0);
 assert.equal(q.transport.mode,'direct-browser-https-with-exact-local-preview-route');for(const key of ['APITransport','ignoreHTTPSErrors','environmentProxyConfigured','trustStoreModified','publicHttpsPassed','shareAllowed'])assert.equal(q.transport[key],false,'transport.'+key);
 assert.equal(q.lifecycle.rendererReady,true);assert.equal(q.lifecycle.sessionInitialized,true);
 assert.equal(q.cleanup.completed,true);assert.equal(q.cleanup.browserDisconnected,true);assert.deepEqual(q.cleanup.errors,[]);
 assert.equal(q.cleanup.gpuDrain.attempted,true);assert.equal(q.cleanup.gpuDrain.completed,true);assert.equal(q.cleanup.gpuDrain.hooksRestored,true);assert(!q.cleanup.gpuDrain.skippedWithReason);
 assert(q.gpuContext&&q.gpuContext.attributes);for(const key of ['samples','sampleBuffers','alphaBits'])assert(Number.isInteger(q.gpuContext[key])&&q.gpuContext[key]>=0,'GPU metadata missing: '+key);
 assert(Number.isFinite(Date.parse(q.startedAt))&&Date.parse(q.startedAt)>=Date.parse(run.startedAt),'Evidence predates this CI attempt');assert(Date.parse(q.finishedAt)>=Date.parse(q.startedAt));
 assert.equal(q.frames.length,5,'Exactly five native readbacks required');assert.equal(q.frames.filter(f=>f.saved).length,3,'Three PNGs plus two unsaved restoration readbacks required');assert.equal(q.transactions.length,2);
 const baselineName='neutral-macro-r08-baseline',expectedNames=[baselineName];for(const c of spec.parsed.cases)expectedNames.push('neutral-macro-'+c.id,'neutral-macro-'+c.id+'-restored');
 assert.deepEqual(q.frames.map(f=>f.name),expectedNames);assert.deepEqual(q.frames.map(f=>f.saved),[true,true,false,true,false]);
 for(const frame of q.frames)checkFrame(out,frame);
 const baselineFrame=q.frames[0],baseline=readSnapshot(out,baselineName);assert.equal(baselineFrame.sha256,common.reference.onSHA256);assert.deepEqual(baseline.state,common.reference.onState);assert.equal(baseline.transaction.caseId,null);
 for(let i=0;i<2;i++){
  const c=spec.parsed.cases[i],transaction=q.transactions[i],candidateFrame=q.frames[1+i*2],restoredFrame=q.frames[2+i*2];
  assert.equal(transaction.id,c.id);assert.equal(transaction.pose,'neutral');assert.equal(transaction.view,'macro');assert.equal(transaction.progress,1);assert.equal(transaction.completed,true);assert.equal(transaction.patchSHA256,spec.cases[i][1]);
  for(const key of ['actualVertexExact','actualFragmentOnlyDeclaredPatches','reverseActualGPUPatchesExact','allActiveUniformsExact','nativeUniformIdentityAndValuesExact','inheritedTemplatesExact','completeNativeStateExact'])assert.equal(transaction.proof[key],true,c.id+' '+key);
  for(const key of ['completeNativeStateExact','actualShaderAndUniformsExact','pixelsExact','hooksExact'])assert.equal(transaction.restoration[key],true,c.id+' restoration '+key);
  assert.equal(transaction.baselineFrame,baselineName);assert.equal(transaction.candidateFrame,candidateFrame.name);assert.equal(transaction.frameSHA256,candidateFrame.sha256);assert.equal(transaction.pngSHA256,candidateFrame.pngSHA256);assert.equal(transaction.restoration.frameSHA256,baselineFrame.sha256);assert.equal(restoredFrame.sha256,baselineFrame.sha256);
  const candidate=readSnapshot(out,candidateFrame.name),restored=readSnapshot(out,restoredFrame.name);
  assert.equal(candidate.transaction.caseId,c.id);assert.equal(restored.transaction.caseId,null);assert(candidate.transaction.compileExecuted&&candidate.transaction.records.length>0,'Actual compile transaction missing');
  for(const record of [candidate,restored]){assert.deepEqual(record.state,baseline.state);for(const key of ['activeUniforms','nativeUniforms','templates'])assert.deepEqual(record.shader[key],baseline.shader[key]);assert.equal(record.texts.vertex,baseline.texts.vertex);}
  assert.equal(candidate.texts.fragment,patchLiteral(baseline.texts.fragment,c.patches));assert.equal(patchLiteral(candidate.texts.fragment,c.patches,true),baseline.texts.fragment);assert.equal(restored.texts.fragment,baseline.texts.fragment);
 }
 assert.equal(q.naturalUI.file,'baseline-workbench-ui.png');assert.equal(q.naturalUI.baselineOnly,true);assert.equal(q.naturalUI.actualBrowserScreenshot,true);assert.equal(sha(fs.readFileSync(path.join(out,q.naturalUI.file))),q.naturalUI.sha256);
 return{id:spec.id,passed:true,qaSHA256:sha(fs.readFileSync(path.join(out,'qa.json'))),recipeSHA256:q.recipeSHA256,nativeReadbacks:5,savedNativePNGs:3,restorations:2,actualShaderUniformAndStateChecks:true,gpuContext:q.gpuContext,visualAcceptance:false,productionReady:false,publicHttpsPassed:false,shareAllowed:false};
}
if(process.argv[2]==='--inputs-only'){
 const common=validateInputs();console.log(JSON.stringify({inputsVerified:true,runnerSHA256:common.runnerSHA256,frozenPatchCounts:specs.map(s=>({id:s.id,count:s.cases.length})),publicHttpsPassed:false,shareAllowed:false}));
}else{
 const report={schema:'kaopu/lip-r09-ci-technical-evidence-check@1',checkedAt:new Date().toISOString(),sourceSHA:process.env.GITHUB_SHA||null,workflowRun:process.env.GITHUB_RUN_ID||null,workflowAttempt:process.env.GITHUB_RUN_ATTEMPT||null,completed:false,experiments:[],errors:[],visualAcceptance:false,productionReady:false,publicHttpsPassed:false,shareAllowed:false,interpretation:'Frozen failed appearance experiments and data-only diagnosis; technical reproduction does not reverse visual rejection.'};
 let common,run;
 try{common=validateInputs();run=readJSON(path.join(root,'evidence/CI_RUN_CONTEXT.json'));assert.equal(run.sourceSHA,process.env.GITHUB_SHA);assert.equal(run.workflowRun,process.env.GITHUB_RUN_ID);assert.equal(run.workflowAttempt,process.env.GITHUB_RUN_ATTEMPT);assert(Number.isFinite(Date.parse(run.startedAt)));}catch(e){report.errors.push(String(e));}
 if(common&&run&&!report.errors.length)for(const spec of specs){try{report.experiments.push(validateExperiment(spec,common,run));}catch(e){report.experiments.push({id:spec.id,passed:false,error:String(e),visualAcceptance:false,productionReady:false,publicHttpsPassed:false,shareAllowed:false});report.errors.push(spec.id+': '+String(e));}}
 report.completed=report.errors.length===0&&report.experiments.length===2&&report.experiments.every(e=>e.passed);
 fs.mkdirSync(path.join(root,'evidence'),{recursive:true});fs.writeFileSync(path.join(root,'evidence/CI_VERIFICATION.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.completed)process.exitCode=1;
}
