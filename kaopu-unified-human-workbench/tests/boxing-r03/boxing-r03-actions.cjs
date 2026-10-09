#!/usr/bin/env node
'use strict';
// Real Chromium + SwiftShader. No contact event injection, renderer mocks,
// physics substitution, hidden actors, timer acceleration or runtime edits.
// Phase one explicitly does not run body-contact validation.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {near, compareFloatArrays} = require('./assertions.cjs');
const BASE = (process.env.BOXING_R03_BASE || 'http://127.0.0.1:8765/kaopu-unified-human-workbench/').replace(/\/?$/, '/');
const OUT = path.resolve(process.env.BOXING_R03_OUT || 'boxing-r03-actions-results');
const ROOT = path.resolve(process.env.BOXING_R03_WORKBENCH || (fs.existsSync(path.join(__dirname, '../workbench')) ? path.join(__dirname, '../workbench') : path.join(__dirname, '../..')));
const MANIFEST = process.env.BOXING_R03_MANIFEST || path.join(__dirname, 'actions-source-manifest.json');
const BASELINE = process.env.BOXING_R03_BASELINE || path.join(__dirname, 'production-tree.json');
const REPO_ROOT = path.resolve(process.env.BOXING_R03_REPO_ROOT || path.dirname(ROOT));
const PRODUCTION_COMMIT = '499915682292d3eb44cd5a5c881423a9c244f767';
const PRODUCTION_TREE = 'ed42e6053b00634d2ca5ca1ee6a6feefaaec83cc';
const REPLAY = process.env.BOXING_R03_REPLAY || path.join(__dirname, 'WORST-POSE-REPLAY.json');
const VIDEO = process.env.BOXING_R03_VIDEO !== '0';
const PHASE = process.env.BOXING_R03_PHASE || 'all';
const report = {schema:'boxing-r03-actions-browser-qa/1', bodyContactReview:'not run, precision integration pending', passed:false, status:'running', startedAt:new Date().toISOString(), base:BASE, commit:process.env.GITHUB_SHA || null, phase:PHASE, runtimeClaim:'Phase one: 18 self-authored complete-character action programmes and GlovesR03 only. Body collision and hit response are disabled; precision integration is pending. No neural execution or production art review is inferred.', execution:'real headless Chromium with SwiftShader; offline deterministic stepping is not real-time FPS evidence', errors:[], consoleErrors:[], warnings:[], resources:[], failedRequests:[], expectedCancellationRequests:[], expectedCancellationConsole:[], screens:[], videos:[], stages:[]};
fs.mkdirSync(OUT, {recursive:true});
const writeReport = () => fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
let browser, page, cancelling = false;
async function stage(name, run) {
  const record = {name, status:'running', startedAt:new Date().toISOString()};
  report.stages.push(record); writeReport(); console.log('STAGE', name);
  try { const result = await run(); if (result !== undefined) record.result = result; record.status = 'passed'; }
  catch (e) {record.status = 'failed'; record.error = e.stack; throw e;}
  finally {record.finishedAt = new Date().toISOString(); writeReport();}
}
const diagnostics = () => page.evaluate(() => boxingWorkbench.diagnostics());
async function snap(name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const filename = name + '.png';
  await page.screenshot({path:path.join(OUT, filename), timeout:120000, animations:'disabled'});
  report.screens.push({file:filename, canonicalTime:await page.evaluate(() => window.boxingWorkbench?.diagnostics().time ?? null)});
  writeReport();
}
async function step(n, {chunk = 120} = {}) {
  while (n > 0) {const take = Math.min(n, chunk); await page.evaluate(count => boxingWorkbench.advanceSteps(count), take); n -= take;}
}
async function reset({mode='diverse-round',programId,round=0,speed=1}={}) {
  await page.evaluate(o=>{const a=boxingWorkbench;a.setPlaying(false);const auto=document.getElementById('auto-round');auto.checked=false;auto.dispatchEvent(new Event('change',{bubbles:true}));a.setSpeed(o.speed);a.setComparison(o.mode,o.programId||document.querySelector('#program-picker option').value);a.setRound(o.round);a.seek(0);}, {mode,programId,round,speed});
}
async function immutableActors() {
  return page.evaluate(async () => {
    const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), v => v.toString(16).padStart(2, '0')).join('');
    const buffer = array => new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    const results = [];
    const bounds = p => {const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.length;i+=3)for(let k=0;k<3;++k){lo[k]=Math.min(lo[k],p[i+k]);hi[k]=Math.max(hi[k],p[i+k]);}return {min:lo,max:hi,width:hi[0]-lo[0],height:hi[2]-lo[2]};};
    for (const a of boxingWorkbench.actors()) results.push({id:a.preset.id, stage:a.preset.stage, restFingerprint:a.restFingerprint, neutralPositions:await hash(buffer(a.human.positions)), faces:await hash(buffer(a.human.faces)), csrRange:await hash(buffer(a.human.range)), csrInfluences:await hash(buffer(a.human.packed)), state:await hash(new TextEncoder().encode(JSON.stringify(a.state))), visible:a.human.mesh.visible, groupScale:a.group.scale.toArray(), vertices:a.human.N, height:a.human.height, boneCount:a.human.names.length,neutralBounds:bounds(a.human.positions)});
    return results;
  });
}
async function poseData(actorId = null) {
  return page.evaluate(id => boxingWorkbench.actors().filter((_, i) => id === null || i === id).map(a => ({id:a.preset.id, matrices:a.latest.posedMatrices.flatMap(m => Array.from(m)), state:structuredClone(a.latest.state), metrics:structuredClone(a.latest.metrics), samples:[0,311,12500,25416].flatMap(v => a.human.sampleVertex(v))})), actorId);
}
async function sourceIntegrity() {
  const baseline = json(BASELINE), manifest = json(MANIFEST);
  assert.equal(manifest.schema,'boxing-r03-actions-source/1');
  assert.equal(manifest.bodyContactReview,'not run, precision integration pending');
  assert.equal(manifest.files['full/boxing-r03/GlovesR03.mjs'],'796b1cebc402fb66953ebef86707b30d8bcb44ccaf04ac79e590274996fd6d16');
  assert(!Object.keys(manifest.files).some(p=>/RuntimeContacts|ContactStudy|StudyTargets|ContactSpace|collision-architecture|jolt/i.test(p)),'Unused contact experiment leaked into release source graph');
  assert.equal(baseline.schema, 'boxing-r03-production-git-baseline/1');
  assert.equal(baseline.commit, PRODUCTION_COMMIT, 'Preservation must use pre-candidate production commit, never current candidate');
  assert.equal(baseline.tree, PRODUCTION_TREE);
  assert.equal(baseline.files.length, 429, 'Exact published production tree is incomplete');
  if (manifest.productionBaselineSha256) assert.equal(sha(fs.readFileSync(BASELINE)), manifest.productionBaselineSha256);
  report.sourceManifest = {preparedAt:manifest.preparedAt, sourceFiles:Object.keys(manifest.files).length};
  report.preservation = {source:'exact pre-candidate production Git tree',commit:baseline.commit,tree:baseline.tree,algorithm:'sha1(blob <byteLength>\0 + bytes)',files:baseline.files.length,verifiedFiles:[],mismatches:[],historicalLocalBaseline:{file:'r02-preservation-baseline.json',required:false,reason:'Historical local snapshot includes unpublished glove diagnostics/materialized aliases and an older boxing.html research link. Production already has the later R01 teacher-link edit; keeping that published file unchanged is not an R03 regression.'}};
  const seen = new Set();
  for (const entry of baseline.files) {
    const {path:relative,sha:expected}=entry;
    assert(/^kaopu-(?:unified-human|anny|mhr)-workbench\//.test(relative) && !relative.split('/').includes('..'), 'Unsafe production tree path');
    assert.match(expected,/^[a-f0-9]{40}$/);assert(!seen.has(relative),'Duplicate production tree path');seen.add(relative);
    const full = path.join(REPO_ROOT, relative);
    if (!fs.existsSync(full)) {report.preservation.mismatches.push({path:relative,reason:'published file missing'});continue;}
    const bytes=fs.readFileSync(full);
    const actual=crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
    if(actual!==expected)report.preservation.mismatches.push({path:relative,expected,actual});
    else report.preservation.verifiedFiles.push({path:relative,gitBlobSha1:actual});
  }
  assert.deepEqual(report.preservation.mismatches, [], 'Published R02/teacher dependency bytes changed relative to production 4999156');
  assert(seen.has('kaopu-unified-human-workbench/full/ui/runtime-metadata.json'), 'Runtime metadata must itself be production-blob-verified');
  // Follow the production metadata's actual assetURLs, never its locally
  // materialized source aliases. External GNM stays bound to its pinned URL
  // and existing SHA256. Native compressed parts are bound to their verified
  // production model manifests and original part hashes.
  const metadataPath=path.join(ROOT,'full/ui/runtime-metadata.json');
  const metadata=json(metadataPath),assetBase=new URL('full/',BASE),cache=new Map();
  report.runtimeDependencies={metadataGitBlobSha1:baseline.files.find(e=>e.path==='kaopu-unified-human-workbench/full/ui/runtime-metadata.json').sha,files:[],parts:[]};
  const verifyAsset=async (logical,expected,kind='asset')=>{
    assert.match(expected,/^[a-f0-9]{64}$/,'Missing production asset hash for '+logical);
    const url=new URL(metadata.assetURLs?.[logical]||logical,assetBase).href;
    let bytes=cache.get(url);
    if(!bytes){const response=await page.request.get(url,{timeout:120000});assert(response.ok(),'Published runtime dependency unavailable: '+url);bytes=await response.body();if(logical.endsWith('.json'))cache.set(url,bytes);}
    const actual=sha(bytes);assert.equal(actual,expected,'Production runtime dependency SHA256 mismatch: '+logical);
    const row={kind,logical,url,sha256:actual,bytes:bytes.length};
    (kind==='compressed-native-part'?report.runtimeDependencies.parts:report.runtimeDependencies.files).push(row);
    return logical.endsWith('.json')?JSON.parse(bytes.toString('utf8')):null;
  };
  for(const[logical,expected]of Object.entries(metadata.coreHashes))await verifyAsset(logical,expected,'core');
  for(const[logical,expected]of Object.entries(metadata.assetHashes))await verifyAsset(logical,expected,'asset');
  const annyPath='source/kaopu-anny-workbench/assets/anny-model.json',mhrPath='source/kaopu-mhr-workbench/assets/model.json';
  const anny=await verifyAsset(annyPath,metadata.assetHashes[annyPath],'native-part-manifest');
  const mhr=await verifyAsset(mhrPath,metadata.assetHashes[mhrPath],'native-part-manifest');
  for(const part of anny.binary.compressed.parts)await verifyAsset('source/kaopu-anny-workbench/assets/'+(part.file||part.url.split('/').at(-1)),part.sha256,'compressed-native-part');
  for(const part of mhr.parts)await verifyAsset('source/kaopu-mhr-workbench/assets/'+(part.file||part.url.split('/').at(-1)),part.sha256,'compressed-native-part');
  report.servedSources = [];
  for (const [file, expected] of Object.entries(manifest.files)) {
    assert.equal(sha(fs.readFileSync(path.join(ROOT, file))), expected, 'Frozen candidate source changed: ' + file);
    const response = await page.request.get(new URL(file, BASE).href);
    assert(response.ok(), 'Source unavailable: ' + file);
    const actual = sha(await response.body());
    assert.equal(actual, expected, 'Served-source hash mismatch: ' + file);
    report.servedSources.push({file, sha256:actual});
  }
  assert.equal(sha(fs.readFileSync(REPLAY)), manifest.worstPoseReplaySha256, 'Replay changed after source manifest was prepared');
  for (const [file, expected] of Object.entries(json(REPLAY).sourceHashes)) assert.equal(manifest.files['full/boxing-r03/' + file], expected, 'Replay numeric source differs from candidate: ' + file);
}
async function loadRetry() {
  await page.goto(new URL('boxing-r03.html', BASE).href, {waitUntil:'domcontentloaded', timeout:120000});
  await page.waitForFunction(() => !!window.boxingWorkbench, null, {timeout:120000});
  assert.equal(await page.locator('[data-arena]').count(), 18);
  cancelling = true;
  // Real public DOM handlers, same task, while real loadCommon is awaiting I/O.
  await page.evaluate(() => {document.getElementById('start').click(); document.getElementById('cancel').click();});
  await page.waitForFunction(() => !boxingWorkbench.diagnostics().busy && document.getElementById('load-status').textContent.includes('取消'), null, {timeout:120000});
  const cancelled = await diagnostics();
  assert.equal(cancelled.ready, false); assert.equal(cancelled.actors, 0); assert.equal(cancelled.pairs, 0);
  assert.equal(await page.locator('#start').isVisible(), true);
  assert.equal(await page.locator('#cancel').isVisible(), false);
  await page.waitForTimeout(150); cancelling = false;
  report.cancelRetry = {cancelled, retry:'pending'};
  await page.locator('#start').click();
  await page.waitForFunction(() => boxingWorkbench.diagnostics().ready || document.getElementById('load-status').textContent.includes('载入失败'), null, {timeout:480000});
  const loaded = await diagnostics();
  assert.equal(loaded.ready, true, await page.locator('#load-status').textContent());
  await page.evaluate(() => boxingWorkbench.setPlaying(false));
  report.cancelRetry.retry = 'passed';
  await page.evaluate(() => {for (const name of ['advanceSteps','diagnostics','actors','setComparison','setRound','setSpeed']) if (typeof boxingWorkbench[name] !== 'function') throw Error('Missing read/test API: ' + name);});
}
async function fullActorsAndPrograms() {
  await reset();
  const d = await diagnostics(); report.initial = d;
  assert.equal(d.actors, 36); assert.equal(d.pairs, 18); assert.equal(d.characters.length, 36);
  assert.equal(new Set(d.characters.map(c => c.id)).size, 36);
  assert(d.characters.every(c => c.vertices === 25417 && c.triangles === 50624 && c.weightsTruncated === false && c.bodyStatePreserved === true));
  assert(d.characters.every(c => c.neutralMaxErrorM < 1e-5), 'Neutral full-CSR skinning error');
  assert(d.characters.every(c => /^[a-f0-9]{64}$/.test(c.restFingerprint)), 'Missing actual native-rest fingerprint');
  assert.equal(new Set(d.characters.map(c => c.restFingerprint)).size, 36, '36 native rest shapes must be distinct');
  assert.equal(d.arena.ropeRuns, 16); assert.equal(d.arena.cornerPosts, 4); assert.equal(d.arena.spacers, 8);
  assert.equal(d.gloves.variants.length, 4); assert.equal(d.ropeMode, 'solid');
  assert(d.trianglesRendered > 36 * 50624, 'Complete humans and equipment must be rendered');
  assert(d.trianglesRendered < 2050000, 'R02 complete geometry budget exceeded');
  assert.match(d.renderer.unmasked || d.renderer.masked, /SwiftShader/i, 'Evidence must identify the actual SwiftShader renderer');
  assert.equal(d.inventory.validationOnly, true, 'Candidate must remain explicitly validation-only');
  assert.equal(d.inventory.canPublish, false, 'QA execution must not fabricate production approval');
  assert.equal(d.inventory.measuredBindings, 1296); assert.equal(d.inventory.distinctPrograms, 18);
  assert.equal(d.gloves.schema,'original-structured-boxing-glove/3-r03-cuff-fit');
  await phaseOneBoundary();
  report.immutableInitial = await immutableActors();
  assert(report.immutableInitial.every(a => a.visible && a.groupScale.every(v => v === 1)), 'No hidden or artificially scaled full people');
  const catalog = await page.evaluate(async () => {
    const m = await import('./full/boxing-r03/MotionPrograms.mjs');
    return {cycle:m.BOXING_CYCLE_SECONDS, provenance:m.BOXING_MOTION_PROVENANCE, programs:m.BOXING_PROGRAMS.map(p => ({id:p.id, semanticMotionId:p.semanticMotionId, takeId:p.takeId, label:p.label, events:p.events, movements:p.movements}))};
  });
  report.catalogue = catalog;
  assert.equal(catalog.programs.length, 18); assert.equal(new Set(d.programs).size, 18);
  const semantic = catalog.programs.map(p => JSON.stringify({events:p.events.map(e => [e.actor,e.kind,e.response,e.direction,e.counter]), travel:p.movements.map(e => [e.actor,e.side,e.kind,e.to])}));
  assert.equal(new Set(semantic).size, 18, 'Program diversity must include authored action/travel semantics, not phase-shifted clones');
  assert.equal(catalog.provenance.neuralInferenceExecuted, false);
  assert.equal(catalog.provenance.sourceKind, 'self-authored-procedural');
  await snap('01-full-36-people-18-rings');
  return {actors:d.actors, rings:d.pairs, authoredPrograms:catalog.programs.length, nativeRestHashes:36, completeTopology:'25417 vertices / 50624 triangles each'};
}
// Source images are genuine browser renders; canvas only arranges them for review.
// Every authored attack/response peak is included, plus early and late footwork.
async function semanticStoryboard(program, number) {
  const targets=program.events.map(e=>({time:e.start+(e.end-e.start)*.43,label:`${e.actor?'B':'A'} ${e.kind} / ${e.response}`,eventId:e.id}));
  const steps=program.movements.filter(e=>e.actor===0&&e.side==='L'&&e.kind!=='reset-distance');
  for(const e of steps) targets.push({time:(e.start+e.end)/2,label:`step ${e.kind}`,eventId:e.id});
  targets.sort((a,b)=>a.time-b.time);
  const frames=[];
  for(const [i,target] of targets.entries()) {
    await page.evaluate(o=>{boxingWorkbench.seek(o.time);boxingWorkbench.setAngle(o.angle);},{time:target.time,angle:i%2?'front':'side'});
    const image=await page.locator('.stage').screenshot({timeout:120000,animations:'disabled'});
    frames.push({...target,angle:i%2?'front':'side',image:'data:image/png;base64,'+image.toString('base64'),imageSha256:sha(image)});
  }
  const compositor=await browser.newPage();
  const png=await compositor.evaluate(async frames=>{
    const w=480,h=390,c=document.createElement('canvas');c.width=w*3;c.height=h*Math.ceil(frames.length/3);
    const g=c.getContext('2d');g.fillStyle='#f3f3f3';g.fillRect(0,0,c.width,c.height);
    for(let i=0;i<frames.length;i++){const f=frames[i],im=new Image();im.src=f.image;await im.decode();const x=i%3*w,y=Math.floor(i/3)*h;g.drawImage(im,x,y+30,w,h-30);g.fillStyle='#111';g.font='13px sans-serif';g.fillText(f.time.toFixed(3)+'s '+f.label+' '+f.angle,x+5,y+19);}
    return c.toDataURL('image/png').split(',')[1];
  },frames);
  await compositor.close();
  const file=`program-${String(number).padStart(2,'0')}-${program.id}-all-events.png`;
  fs.writeFileSync(path.join(OUT,file),Buffer.from(png,'base64'));
  report.semanticStoryboards??=[];report.semanticStoryboards.push({programId:program.id,file,review:'captured; pending visual review',frames:frames.map(({image,...f})=>f),continuous:false,method:'exact canonical pose samples from actual full-character WebGL; no contact overlay'});writeReport();
}
async function comparisonsAndRounds() {
  const ids = report.catalogue.programs.map(p => p.id);
  const same = [];
  for (const id of ids) {
    await reset({mode:'same-program', programId:id});
    const program = report.catalogue.programs.find(p => p.id === id);
    const keyEvent = [...program.events].sort((a,b) => a.start-b.start)[0];
    const keyTime = keyEvent.start + (keyEvent.end-keyEvent.start)*.43;
    await page.evaluate(() => {boxingWorkbench.select(8);boxingWorkbench.setViewMode('pair');boxingWorkbench.setRopes('ghost');boxingWorkbench.setAngle('side');});
    await step(Math.round(keyTime*120));
    const d = await diagnostics();
    assert.deepEqual(d.programs, Array(18).fill(id));
    assert.equal(new Set(d.characters.map(c => c.state.semanticMotionId)).size, 1);
    assert(d.characters.every(c => c.state.phaseOffset === 0 && c.state.speed === 1));
    assert.equal(d.actors, 36);
    same.push({programId:id, all18Arenas:true, canonicalTime:d.time, keyEvent:{kind:keyEvent.kind,response:keyEvent.response,actor:keyEvent.actor}, nativeBodies:new Set(d.characters.map(c => c.restFingerprint)).size});
    await snap('program-'+String(ids.indexOf(id)+1).padStart(2,'0')+'-'+id);
    await semanticStoryboard(program,ids.indexOf(id)+1);
  }
  report.sameProgramAll18 = same;
  await page.locator('#overview').click();
  await snap('02-same-program-full-body-comparison');
  const observed = Array.from({length:18}, () => new Set());
  report.roundPrograms = [];
  for (let round = 0; round < 18; ++round) {
    await reset({round}); const d = await diagnostics();
    assert.equal(new Set(d.programs).size, 18);
    d.programs.forEach((id, i) => observed[i].add(id));
    report.roundPrograms.push({round, programs:d.programs});
  }
  assert(observed.every(s => s.size === 18), 'Each body pair must receive all 18 authored programs over 18 rounds');
  await reset({round:0}); await step(300); const before = await diagnostics();
  await reset({round:18}); await step(300); const after = await diagnostics();
  assert.deepEqual(after.programs, before.programs);
  report.roleExchange = before.characters.map((c, i) => {
    assert.equal(after.characters[i].state.authoredRole, c.state.authoredRole ^ 1);
    assert.equal(after.characters[i].state.rolePass, 1);
    return {id:c.id, before:c.state.authoredRole, after:after.characters[i].state.authoredRole};
  });
  await snap('03-round-19-exchanges-roles');
}
async function timingAndDeterminism() {
  report.tempo = [];
  const poses = [];
  for (const [speed, steps] of [[1.14,330],[1,330],[.55,330]]) {
    await reset({speed}); await step(steps);
    const d = await diagnostics(); near(d.time, steps / 120 * speed, 1e-9, 'Canonical tempo');
    near(d.clock.physicalTime, steps / 120, 1e-9); assert.equal(d.clock.steps, steps); assert.equal(d.clock.droppedSteps, 0); assert.equal(d.clock.paused, true);
    report.tempo.push({speed, steps, clock:d.clock});
  }
  // Equal canonical time across all three tempos; no contact overlay in safe mode.
  for (const [speed, steps] of [[1.14,550],[1,627],[.55,1140]]) {
    await reset({speed}); await step(steps, {chunk:180});
    const d = await diagnostics(); near(d.time, 5.225, 1e-8);
    poses.push(await poseData());
  }
  report.equalCanonicalPose = [];
  for (let run = 1; run < poses.length; ++run) for (let actor = 0; actor < 36; ++actor) report.equalCanonicalPose.push({speed:run === 1 ? 1 : .55, actor, maxMatrixError:compareFloatArrays(poses[0][actor].matrices, poses[run][actor].matrices, 1e-6, 'Shared-clock equal canonical pose')});
  await reset({speed:1.14}); await step(180, {chunk:60}); const a = await poseData(); const da = await diagnostics();
  await reset({speed:1.14}); await step(180, {chunk:90}); const b = await poseData(); const db = await diagnostics();
  assert.deepEqual(db.clock, da.clock);
  report.determinism = {fixedSteps:180, renderingChunkSizes:[60,90], actorErrors:a.map((v,i) => compareFloatArrays(v.matrices,b[i].matrices,1e-9))};
  await assert.rejects(() => page.evaluate(() => boxingWorkbench.advanceSteps(-1)), /fixed-step/i);
  await assert.rejects(() => page.evaluate(() => boxingWorkbench.advanceSteps(1.5)), /fixed-step/i);
}
async function phaseOneBoundary() {
  const d=await diagnostics();
  assert.deepEqual(d.collision,{enabled:false,surfacePrecisionIntegration:'pending',approximateHitsPresentedAsSkinContact:false});
  for(const id of ['collision-mode','hit-response','proxy-overlay','contact-study'])assert.equal(await page.locator('#'+id).count(),0,'Disabled body-contact control still exposed: '+id);
  const api=await page.evaluate(()=>({collision:typeof boxingWorkbench.setCollisionMode,study:typeof boxingWorkbench.setContactStudy,audit:typeof boxingWorkbench.contactAudit,externalOverlays:boxingWorkbench.actors().filter(a=>a.latest?.state?.contactResponse?.accepted).length,allVisible:boxingWorkbench.actors().every(a=>a.human.mesh.visible)}));
  assert.equal(api.collision,'undefined');assert.equal(api.study,'undefined');assert.equal(api.audit,'undefined');assert.equal(api.externalOverlays,0);assert.equal(api.allVisible,true);
  assert.deepEqual(report.unexpectedContactRequests||[],[],'Phase-one loaded a retired body-contact/precision-study module');
  assert.equal(await page.locator('#contact').count(),1,'Foot contact IK must remain available');
  report.phaseOneBoundary={...d.collision,footContactIKRetained:true,bodyContactReview:report.bodyContactReview,retiredControlsAbsent:true,retiredRuntimeRequests:[]};
}
async function gloveCuffViews(){
  const fixture=json(path.join(__dirname,'actions-glove-replays.json'));assert.equal(fixture.cases.length,4);
  assert.equal(sha(fs.readFileSync(path.join(__dirname,'actions-glove-replays.json'))),json(MANIFEST).gloveReplayCasesSha256);
  report.gloveCuffViews=[];
  for(const c of fixture.cases){await reset({mode:'same-program',programId:c.programId,round:c.options.roundIndex,speed:1});await page.evaluate(c=>{boxingWorkbench.seek(c.time);boxingWorkbench.select(c.options.pairIndex);boxingWorkbench.setViewMode('gloves');boxingWorkbench.setRopes('ghost');},c);
    const d=await diagnostics(),actor=d.characters[c.options.pairIndex*2+c.options.fighter];assert.equal(actor.id,c.characterId);assert.equal(actor.state.authoredRole,1);assert.equal(actor.restFingerprint,c.options.restFingerprint);near(d.time,c.time,1e-12);
    for(const angle of ['front','side','rear']){await page.evaluate(a=>boxingWorkbench.setAngle(a),angle);await snap('cuff-'+c.characterId+'-'+angle);}
    report.gloveCuffViews.push({...c,currentGloveSHA256:json(MANIFEST).glovesR03Sha256,mode:'exact-time pose seek for static cuff inspection, not a contact simulation',visualReview:'captured; human visual review still required'});
  }
}
async function actualSoleMeasurements(){
  const baselineFile=path.join(__dirname,'actions-foot-surface-baseline.json'),baseline=json(baselineFile);assert.equal(sha(fs.readFileSync(baselineFile)),json(MANIFEST).soleBaselineSha256);
  for(const[p,h]of Object.entries(baseline.sourceHashes))assert.equal(json(MANIFEST).files['full/boxing-r03/'+p],h,'Sole numeric baseline source drift');
  const selected=await page.evaluate(()=>{window.__actionsFootVertices=boxingWorkbench.actors().map(a=>{let min=Infinity;for(let i=2;i<a.human.positions.length;i+=3)min=Math.min(min,a.human.positions[i]);const foot=[],sole=[];for(let v=0;v<a.human.N;++v){const z=a.human.positions[v*3+2];if(z<=min+a.human.height*.125)foot.push(v);if(z<=min+.002)sole.push(v);}return {id:a.preset.id,foot,sole,neutralMinZ:min};});return __actionsFootVertices.map(({foot,sole,...a})=>({...a,footVertices:foot.length,soleVertices:sole.length}));});
  report.actualSole={method:'Actual uploaded full-CSR skin sampleVertex, native Z+floorOffset relative to deck; all neutral lower12.5% foot vertices and minZ+2mm sole vertices. No foot-bone substitution.',coverage:'36 actors, full16s diverse round0 and role-swapped round18, every0.5 canonical seconds; not exhaustive all-program skin proof',sourceMatchedNumericBaseline:{minimumGroundZ:baseline.minimumGroundZ,samples:baseline.sampleCount,knownPenetrationIsNotZero:baseline.minimumGroundZ<0},selected,rows:[],maximumRegressionM:0,minimumGroundZ:Infinity,negativeClearanceSamples:0};
  for(const round of [0,18]){await reset({round,speed:1});for(let sample=0;sample<=32;++sample){if(sample)await step(60);const rows=await page.evaluate(()=>boxingWorkbench.actors().map((a,index)=>{const s=__actionsFootVertices[index];let foot=Infinity,sole=Infinity,worst=-1;for(const v of s.foot){const z=a.human.sampleVertex(v)[2]+a.human.floorOffset;if(z<foot){foot=z;worst=v;}}for(const v of s.sole)sole=Math.min(sole,a.human.sampleVertex(v)[2]+a.human.floorOffset);return {id:s.id,minimumFootSkinZ:foot,minimumSoleSkinZ:sole,worstVertex:worst,plantedFeet:a.latest.metrics.plantedFeet};}));for(const row of rows){assert(Number.isFinite(row.minimumFootSkinZ)&&Number.isFinite(row.minimumSoleSkinZ));const old=baseline.rows.find(b=>b.characterId===row.id);assert(old);const regression=Math.max(0,old.minGroundZ-row.minimumFootSkinZ);report.actualSole.maximumRegressionM=Math.max(report.actualSole.maximumRegressionM,regression);report.actualSole.minimumGroundZ=Math.min(report.actualSole.minimumGroundZ,row.minimumFootSkinZ);if(row.minimumFootSkinZ<-1e-6)report.actualSole.negativeClearanceSamples++;report.actualSole.rows.push({round,time:sample*.5,...row,numericBaselineMinZ:old.minGroundZ,regressionM:regression});}}}
  report.actualSole.review='Measurements distinguish existing sub-millimetre skin clearance from foot IK. No zero-penetration claim.';writeReport();
  assert(report.actualSole.maximumRegressionM<=1e-6,'Actual browser foot-skin measurement regresses below source-matched numeric baseline by '+report.actualSole.maximumRegressionM+'m');
}
async function controlsAndPixels() {
  await reset();
  await page.locator('[data-arena="8"]').click(); assert.equal((await diagnostics()).focus, 8);
  await page.locator('[data-frame="pair"]').click(); assert.equal((await diagnostics()).viewMode, 'pair');
  await page.selectOption('#ropes', 'ghost'); assert.equal((await diagnostics()).ropeMode, 'ghost');
  await step(240); await snap('05-adult-focused-pair-ghost-ropes');
  await page.locator('[data-frame="gloves"]').click(); assert.equal((await diagnostics()).viewMode, 'gloves'); await snap('06-preserved-r02-gloves');
  await page.locator('[data-frame="ring"]').click();
  for (const angle of ['front','side','rear','three']) await page.locator(`[data-angle="${angle}"]`).click();
  for (const mode of ['hidden','ghost','solid']) {await page.selectOption('#ropes', mode); assert.equal((await diagnostics()).ropeMode, mode);}
  await page.locator('#contact').uncheck(); assert.equal((await diagnostics()).contact, false);
  await page.locator('#contact').check(); assert.equal((await diagnostics()).contact, true);
  await page.locator('#skeleton').check(); await snap('07-skeleton-native-bones'); await page.locator('#skeleton').uncheck();
  await page.selectOption('#comparison-mode', 'same-program'); assert.equal((await diagnostics()).comparisonMode, 'same-program');
  await page.selectOption('#program-picker', report.catalogue.programs[7].id); assert.equal(new Set((await diagnostics()).programs).size, 1);
  await page.selectOption('#comparison-mode', 'diverse-round');
  const round = (await diagnostics()).roundIndex;
  await page.locator('#next-round').click(); assert.equal((await diagnostics()).roundIndex, (round+1)%36);
  for (const speed of ['1.14','1','0.55']) {await page.selectOption('#speed',speed); near((await diagnostics()).clock.speed, Number(speed));}
  // Exercise a real play/pause click but make no real-time performance claim.
  await page.locator('#pause').click();
  await page.waitForFunction(() => boxingWorkbench.diagnostics().clock.steps > 0, null, {timeout:120000});
  await page.locator('#pause').click();
  assert.equal((await diagnostics()).clock.paused, true);
  const paused = (await diagnostics()).time; await page.waitForTimeout(200); near((await diagnostics()).time, paused, 1e-12, 'Paused canonical time');
  await page.locator('#restart').click(); near((await diagnostics()).time, 0, 1e-12);
  await page.locator('#overview').click(); assert.equal((await diagnostics()).focus, -1);
  await page.locator('[data-arena="0"]').click(); await page.locator('[data-frame="pair"]').click();
  await step(240); await snap('09-child-original-shape-light-practice');
  report.viewportPixels = [];
  for (const viewport of [{width:390,height:844},{width:768,height:1024},{width:1600,height:1050}]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => {const c=document.getElementById('canvas'),r=c.getBoundingClientRect();return c.width>0 && c.height>0 && Math.abs(c.width/Math.min(devicePixelRatio,1.5)-r.width)<2;});
    const state = await page.evaluate(() => ({pixels:boxingWorkbench.pixelAudit(), paused:boxingWorkbench.diagnostics().clock.paused, time:boxingWorkbench.diagnostics().time, overflow:document.documentElement.scrollWidth>innerWidth, canvas:{width:document.getElementById('canvas').width,height:document.getElementById('canvas').height}}));
    assert.equal(state.paused, true); assert.equal(state.pixels.error, 0); assert(state.pixels.colors > 50, 'Paused resized viewport has no rendered geometry'); assert.equal(state.overflow, false);
    report.viewportPixels.push({viewport,...state}); await snap(`10-paused-viewport-${viewport.width}x${viewport.height}`);
  }
  const adults=report.immutableInitial.filter(a=>!['child','teen'].includes(a.stage));
  const extremes=[{label:'tallest-adult',actor:adults.reduce((a,b)=>a.height>b.height?a:b)},{label:'widest-adult',actor:adults.reduce((a,b)=>a.neutralBounds.width>b.neutralBounds.width?a:b)},{label:'shortest-child',actor:report.immutableInitial.reduce((a,b)=>a.height<b.height?a:b)}];
  report.extremeViews=[];
  for(const choice of extremes){const index=report.immutableInitial.findIndex(a=>a.id===choice.actor.id);await page.evaluate(i=>{boxingWorkbench.select(Math.floor(i/2));boxingWorkbench.setViewMode('pair');boxingWorkbench.setRopes('ghost');},index);for(const angle of ['side','rear']){await page.locator(`[data-angle="${angle}"]`).click();await snap('extreme-'+choice.label+'-'+angle);report.extremeViews.push({label:choice.label,characterId:choice.actor.id,angle});}}
  report.mobileScope = 'Viewport/responsive rendering only; no claim of physical mobile-device performance.';
}
async function replayWorstWindows() {
  const replay = json(REPLAY), cases = replay.programWorstCases;
  assert.equal(cases.length, 18);
  const maxSpeed = cases.reduce((a,b) => a.angularSpeed.value>b.angularSpeed.value?a:b).angularSpeed;
  const maxAccel = cases.reduce((a,b) => a.angularAcceleration.value>b.angularAcceleration.value?a:b).angularAcceleration;
  const chosen = [{kind:'max-angular-speed',data:maxSpeed},{kind:'max-angular-acceleration',data:maxAccel}];
  report.worstPoseReplay = {sourceMeasuredAt:replay.measuredAt, sourceHashes:replay.sourceHashes, availableProgramCases:18, renderedCases:[], meaning:'Two global worst elbow windows replayed continuously from t=0 by the real fixed-step runtime. Numeric bounds are not replaced by visual assertions.'};
  for (const {kind,data} of chosen) {
    const {options,window} = data.replay;
    await reset({mode:'same-program',programId:options.programId,round:options.roundIndex,speed:1,});
    await page.evaluate(i => {boxingWorkbench.select(i);boxingWorkbench.setViewMode('pair');boxingWorkbench.setRopes('ghost');boxingWorkbench.setAngle('side');}, options.pairIndex);
    const startSteps = Math.floor(Math.max(0,window[0]-.15)*120), endSteps = Math.ceil((window[1]+.15)*120);
    await step(startSteps, {chunk:180});
    const targetActor = options.pairIndex*2+options.fighter;
    const actor = (await diagnostics()).characters[targetActor]; assert.equal(actor.id, data.characterId, 'Worst-window character binding');
    const frames = [];
    const frameDir=path.join(OUT,'worst-pose-frames',kind);fs.mkdirSync(frameDir,{recursive:true});
    for (let n=startSteps;n<endSteps;) {const amount=Math.min(4,endSteps-n);await step(amount);n+=amount;const p=(await poseData(targetActor))[0];assert(p.matrices.every(Number.isFinite));frames.push({steps:n,time:(await diagnostics()).time,authoredRole:p.state.authoredRole,externalContactOverlay:p.metrics.externalContactOverlay});await page.locator('.stage').screenshot({path:path.join(frameDir,String(frames.length-1).padStart(4,'0')+'.png'),timeout:120000,animations:'disabled'});}
    await snap(`11-${kind}-${options.programId}`);
    report.worstPoseReplay.renderedCases.push({kind,characterId:data.characterId,programId:options.programId,pairIndex:options.pairIndex,role:data.role,round:options.roundIndex,joint:data.joint,numericValue:data.value,window,firstSteps:startSteps,lastSteps:endSteps,frameDirectory:'worst-pose-frames/'+kind,continuousFrames:true,frames});
  }
}
async function encodeClip(name, {canonicalSeconds = 16, speed = 1.14, round = 0, programId = null, pair = 8, startCanonical = 0, fps = 12, angle = 'side'} = {}) {
  assert.equal(120 % fps, 0, 'Capture FPS must divide the physical 120 Hz fixed step');
  await reset({mode:programId?'same-program':'diverse-round',programId,round,speed});
  await page.setViewportSize({width:1280,height:900});
  await page.evaluate(o => {boxingWorkbench.select(o.pair);boxingWorkbench.setViewMode('pair');boxingWorkbench.setRopes('ghost');boxingWorkbench.setAngle(o.angle);},{pair,angle});
  const initialSteps = Math.round(startCanonical / speed * 120); await step(initialSteps, {chunk:180});
  const frameDir = path.join(OUT, 'frames-'+name); fs.mkdirSync(frameDir,{recursive:true});
  const stepsPerFrame = 120/fps, frameCount = Math.ceil(canonicalSeconds/speed*fps), timeline = [];
  const wallStart = Date.now();
  for (let frame=0;frame<=frameCount;++frame) {
    if(frame)await step(stepsPerFrame);
    const d=await diagnostics();
    timeline.push({frame,steps:d.clock.steps,physicalTime:d.clock.physicalTime,canonicalTime:d.time,round:d.roundIndex,bodyContactEnabled:d.collision.enabled});
    await page.locator('.stage').screenshot({path:path.join(frameDir,String(frame).padStart(5,'0')+'.png'),timeout:120000,animations:'disabled'});
  }
  const file=name+'.mp4';
  const encoded=spawnSync(process.env.FFMPEG || 'ffmpeg',['-hide_banner','-loglevel','warning','-y','-framerate',String(fps),'-i',path.join(frameDir,'%05d.png'),'-vf',"pad=ceil(iw/2)*2:ceil(ih/2)*2,drawtext=text='OFFLINE FIXED-STEP REPLAY - NOT REALTIME':x=12:y=12:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.8:boxborderw=7",'-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',path.join(OUT,file)],{encoding:'utf8',timeout:180000});
  assert.equal(encoded.status,0,'ffmpeg did not encode video: '+encoded.stderr);
  assert(fs.statSync(path.join(OUT,file)).size>10000,'Video output unexpectedly empty');
  for(let i=1;i<timeline.length;++i){assert.equal(timeline[i].steps-timeline[i-1].steps,stepsPerFrame);near(timeline[i].canonicalTime-timeline[i-1].canonicalTime,speed/fps,1e-8);}
  const record={file,outputFps:fps,physicalFixedStep:1/120,stepsPerFrame,frameCount:timeline.length,canonicalSeconds:timeline.at(-1).canonicalTime-timeline[0].canonicalTime,speed,round,programId,pair,startCanonical,angle,bodyContactReview:report.bodyContactReview,wallCaptureSeconds:(Date.now()-wallStart)/1000,realtime:false,watermark:'OFFLINE FIXED-STEP REPLAY - NOT REALTIME',timeline};
  fs.writeFileSync(path.join(OUT,name+'-timeline.json'),JSON.stringify(record,null,2)+'\n');
  report.videos.push(record);writeReport();
  fs.rmSync(frameDir,{recursive:true,force:true});
}
async function videos() {
  await encodeClip('12-adult-full-cycle-offline', {canonicalSeconds:16,speed:1.14,pair:8,round:0});
  await encodeClip('14-slow-half-cycle-offline',{canonicalSeconds:8,speed:.55,pair:14,round:18,angle:'front'});
  const cases=json(REPLAY).programWorstCases;
  for(const kind of ['angularSpeed','angularAcceleration']){const worst=cases.reduce((a,b)=>a[kind].value>b[kind].value?a:b)[kind];await encodeClip('13-worst-elbow-'+kind+'-offline',{canonicalSeconds:1.2,speed:1,programId:worst.replay.options.programId,round:worst.replay.options.roundIndex,pair:worst.replay.options.pairIndex,startCanonical:Math.max(0,worst.time-.6),fps:24});}
}
async function originalLinks() {
  const link=page.getByRole('link',{name:'R02锚点',exact:true});
  assert((await link.getAttribute('href')).includes('boxing-r02.html'));
  await link.click();await page.waitForFunction(()=>!!window.boxingWorkbench,null,{timeout:120000});
  assert(page.url().includes('boxing-r02.html'));assert.equal(await page.locator('[data-arena]').count(),18);assert.equal(await page.locator('#ropes').count(),1);
  assert.equal(await page.locator('#comparison-mode').count(),0);
  report.r02LinkPreserved=true;
  await page.goto(new URL('index-characters-r02.html',BASE).href,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>document.querySelectorAll('[data-preset]').length===72,null,{timeout:120000});
  assert.equal(await page.locator('[data-preset]:visible').count(),36);report.original72PresetsPreserved=true;
}
(async()=>{
  try{
    browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],timeout:120000});
    page=await browser.newPage({viewport:{width:1600,height:1050},deviceScaleFactor:1});
    page.setDefaultTimeout(120000);
    page.on('request',r=>{if(/(?:jolt|CollisionWorld|RuntimeContacts|ContactStudy|StudyTargets|contact-study)/i.test(r.url())){report.unexpectedContactRequests??=[];report.unexpectedContactRequests.push(r.url());}});
    page.on('pageerror',e=>report.errors.push({message:e.message,stack:e.stack}));
    page.on('console',m=>{if(m.type()==='error'){if(cancelling&&/net::ERR_ABORTED|AbortError/.test(m.text()))report.expectedCancellationConsole.push(m.text());else report.consoleErrors.push(m.text());}else if(m.type()==='warning')report.warnings.push(m.text());});
    page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))report.resources.push({url:r.url(),status:r.status()});});
    page.on('requestfailed',r=>{const data={url:r.url(),failure:r.failure()?.errorText};if(cancelling&&/ABORT|cancel/i.test(data.failure||''))report.expectedCancellationRequests.push(data);else report.failedRequests.push(data);});
    await stage('Frozen source hashes and R02 byte preservation',sourceIntegrity);
    await stage('Real load / immediate cancel / retry',loadRetry);
    await stage('36 native full people / 18 complete rings / 18 authored programmes',fullActorsAndPrograms);
    if(PHASE!=='video'){
      await stage('All 18 same-program comparisons / 18 rounds / role exchange',comparisonsAndRounds);
      await stage('1.14 / 1 / 0.55 tempo and deterministic fixed stepping',timingAndDeterminism);
      await stage('Visible controls and paused desktop/mobile resize pixel audit',controlsAndPixels);
      await stage('Four corrected GlovesR03 cuff witnesses',gloveCuffViews);
      await stage('Worst elbow windows from hashed numeric replay',replayWorstWindows);
      try{await stage('Actual full-CSR foot/sole skin measurements',actualSoleMeasurements);}catch(e){report.soleFailure=e.stack;writeReport();console.error('Sole regression gate failed; independent visual capture continues:',e.message);}
      report.immutableFinal=await immutableActors();assert.deepEqual(report.immutableFinal,report.immutableInitial,'Native meshes, state, full CSR influences, visibility or transforms changed during runtime');
    }
    if(VIDEO)await stage('Continuous 120 Hz fixed-step offline video',videos);
    await stage('Phase-one body contact remains disabled',phaseOneBoundary);
    await stage('Preserved R02 anchor and original catalogue',originalLinks);
    await stage('No runtime / shader / HTTP / unexpected network errors',async()=>{
      assert.deepEqual(report.errors,[]);assert.deepEqual(report.resources,[]);
      assert.deepEqual(report.failedRequests,[]);
      const substantive=report.consoleErrors.filter(m=>!/^Failed to load resource: the server responded with a status of 404 \(File not found\)$/.test(m));
      assert.deepEqual(substantive,[]);
      const shaderWarnings=report.warnings.filter(m=>/shader.*(?:fail|error)|WebGL.*(?:lost|invalid)|GL_INVALID/i.test(m));assert.deepEqual(shaderWarnings,[]);
      // Source bytes are checked again after all controls and screenshots.
      for(const[file,hash]of Object.entries(json(MANIFEST).files))assert.equal(sha(fs.readFileSync(path.join(ROOT,file))),hash,'Source mutated during test: '+file);
    });
    if(report.soleFailure)throw Error('Actual sole regression gate remains failed. '+report.soleFailure);
    report.passed=true;report.status='passed-actions-only';report.bodyContactReview='not run, precision integration pending';
  }catch(e){report.failure=e.stack;report.status='failed';console.error(e.stack);try{if(page){await page.evaluate(()=>window.boxingWorkbench?.setPlaying(false));await snap('failure');}}catch(captureError){report.failureScreenshotError=String(captureError);}process.exitCode=1;}
  finally{report.finishedAt=new Date().toISOString();writeReport();if(browser)await browser.close();}
})();
