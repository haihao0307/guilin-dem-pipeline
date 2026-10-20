/**
 * Reproduce the application's captured, current-native Worker input in Node.
 *
 * node tests/native-replay.mjs --input evidence/native-world-input.json \
 *   --output evidence/native-replay --steps 240 --mode both
 *
 * --mode baseline|perturb|both (default both), --source <project> (default this
 * project), --label <safe-name> (default native), --stop-on-failure (optional),
 * --save-state (optional exact surfaces and persistent-contact diagnostics).
 * Exact captured typed-array bytes are restored; no body, rest metric, material,
 * solver setting or source text is substituted. The optional source directory
 * permits an explicit R01 comparison with the identical captured input.
 *
 * Each scenario writes <label>-<mode>.ndjson and .summary.json, including source
 * hashes, actual progress, timings and independent cloth/body triangle checks.
 * Exit status is nonzero for an incomplete run or any acceptance failure.
 * Discrete checkpoint checks are not continuous collision or yarn certificates.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {auditMeshIntersections} from './mesh-intersections.mjs';
import {createBodyEnvelopeAudit} from './body-envelope-audit.mjs';

const ownProject = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = {source: ownProject, input: 'evidence/native-world-input.json', output: 'evidence/native-replay', steps: 240, mode: 'both', label: 'native'};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (key === '--stop-on-failure') {args.stopOnFailure = true; continue;}
  if (key === '--save-state') {args.saveState = true; continue;}
  if (!/^--(source|input|output|steps|mode|label)$/.test(key) || !process.argv[i + 1]) throw Error('Unknown or incomplete argument: ' + key);
  args[key.slice(2)] = process.argv[++i];
}
args.steps = Number(args.steps);
if (!Number.isInteger(args.steps) || args.steps < 1 || args.steps > 10000) throw Error('--steps must be an integer in 1–10000');
if (!['baseline', 'perturb', 'both'].includes(args.mode)) throw Error('--mode must be baseline, perturb or both');
if (!/^[a-zA-Z0-9._-]+$/.test(args.label)) throw Error('--label must be a safe filename component');
for (const key of ['source', 'input', 'output']) args[key] = path.resolve(args[key]);
const sha = value => createHash('sha256').update(value).digest('hex');
const inputBytes = await fs.readFile(args.input);
const typedConstructors = {Float32Array, Float64Array, Int32Array, Uint32Array, Int16Array, Uint16Array, Int8Array, Uint8Array, Uint8ClampedArray};

function restoreInput() {
  const input = JSON.parse(inputBytes);
  const restored = new Set();
  for (const entry of input.typedArrays || []) {
    const T = typedConstructors[entry.type], bytes = Buffer.from(entry.base64 || '', 'base64');
    if (!T || bytes.byteLength !== entry.byteLength || bytes.byteLength !== entry.length * T.BYTES_PER_ELEMENT) throw Error('Invalid captured typed array: ' + entry.path);
    const keys = entry.path.split('/').slice(1);
    if (keys.length < 2 || keys.some(key => ['__proto__', 'prototype', 'constructor'].includes(key))) throw Error('Invalid captured array path');
    let parent = input;
    for (const key of keys.slice(0, -1)) {if (!parent || !Object.hasOwn(parent, key)) throw Error('Missing captured array path: ' + entry.path); parent = parent[key];}
    parent[keys.at(-1)] = new T(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    restored.add(entry.path);
  }
  for (const required of ['/body/positions', '/body/faces', ...(input.rows || []).map((_, i) => '/rows/' + i + '/positions')]) {
    if (!restored.has(required)) throw Error('Replay requires original typed-array bytes for ' + required);
  }
  if (!input.rows?.length || input.body.positions.length < 3000 || input.body.faces.length < 3000) throw Error('Replay requires the full native body and garment input');
  return input;
}

// Keep the source's relative ./upstream/ imports intact, exactly as the build
// does, while retaining the upstream directory as read-only shared input.
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'native-layer-replay-'));
const sourceSHA256 = {};
await fs.mkdir(args.output, {recursive: true});
let failed = false;
try {
  const upstream = path.join(args.source, 'reference/mp05-studio-r10');
  for (const file of ['layer-world.mjs', 'layer-contact.mjs', 'layer-initialization.mjs', 'body-envelope.mjs']) {
    let bytes;try{bytes = await fs.readFile(path.join(args.source, 'src', file));}catch(error){if(file==='body-envelope.mjs'&&error.code==='ENOENT')continue;throw error;}
    sourceSHA256['src/' + file] = sha(bytes);
    await fs.writeFile(path.join(temp, file), bytes);
  }
  await fs.symlink(upstream, path.join(temp, 'upstream'), 'dir');
  const kernelBytes = await fs.readFile(path.join(upstream, 'cloth-kernel.wasm'));
  sourceSHA256['upstream/cloth-kernel.wasm'] = sha(kernelBytes);
  for (const file of ['material-physics.mjs', 'mesh-contact.mjs']) sourceSHA256['upstream/' + file] = sha(await fs.readFile(path.join(upstream, file)));
  const {LayerWorld} = await import(pathToFileURL(path.join(temp, 'layer-world.mjs')));
  const modes = args.mode === 'both' ? ['baseline', 'perturb'] : [args.mode];
  for (const mode of modes) {
    const label = args.label + '-' + mode;
    const summaryPath = path.join(args.output, label + '.summary.json'), logPath = path.join(args.output, label + '.ndjson');
    const input = restoreInput();
    const summary = {schema: 'kaopu-native-layer-replay@2', label, mode, inputPath: args.input,
      inputSHA256: sha(inputBytes), inputIdentity: input.identity, provenance: input.source,
      coordinateSystem: input.coordinateSystem, sourceProject: args.source, sourceSHA256,
      executionEnvironment:{node:process.version,execArgv:process.execArgv,platform:process.platform,arch:process.arch,logicalCPUs:os.cpus().length},
      originalOptions: input.options, requestedSteps: args.steps, completedSteps: 0,
      physicsStepSeconds: 1 / 120, simulationSeconds: 0, perturbations: [], checkpoints: [],
      maxima: {dynamicEdgeStretch: 0, contactResidualMM: null, speedMPS: 0, fixedDriftMM: 0},
      timing: null, acceptance: {passed: false, failures: [], criteria: {
        completedRequestedSteps: true, finiteState: true, fixedDriftToleranceMM: .001,
        dynamicEdgeStretchMaximum: 1.45, contactResidualMaximumMM: .5,
        bodyHalfThicknessOverlapToleranceMM: .001,
        noReportedTriangleIntersectionsAtEveryStep: true, noDegenerateTrianglesAtEveryStep: true,
        initializationStretchExcludedFromDynamicStretchGate: true,
        scope: 'Discrete full middle-surface intersections, all vertex/body signed distances, independent triangle/body half-thickness distances and solver cloth thickness residual at every completed step; no continuous-time, self-collision or rendered-yarn certificate',
      }}};
    const timings = [], failures = new Map(), maximumMove = new Map();
    const fail = (code, step, details) => {const old = failures.get(code); if (old) {old.lastStep = step; old.count++;} else failures.set(code, {code, firstStep: step, lastStep: step, count: 1, firstDetails: details});};
    const save = async () => {summary.acceptance.failures = Array.from(failures.values()); await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2) + '\n');};
    await fs.writeFile(logPath, '');
    const checkpointSteps = new Set([0, 1, 6, 12, 18, 24, 60, 120, 180, 240, args.steps]);
    if (mode === 'perturb') for (const step of [61, 66, 121, 126, 181, 186]) checkpointSteps.add(step);
    let world;const bodyEnvelopeAuditor=createBodyEnvelopeAudit(input.body);
    const saveState=async step=>{
      if(!args.saveState||!world)return;
      const c=world.contacts,reference=g=>({id:g.id,count:g.count});
      const history={options:Object.fromEntries(['cellSize','searchMargin','contactMargin','maxCorrection','sampleLimit','cacheSkin','tolerance','maxCellsPerTriangle','broadphaseCache'].map(key=>[key,c[key]])),
        sides:[...c._sides],frameSides:[...c._frameSides],edgeReferences:[...c._edgeReferences],
        history:[...c._history],pending:[...c._pending].map(([key,value])=>[key,{...value,a:reference(value.a),b:reference(value.b)}]),
        restoreNote:'Reattach each history/pending triangles reference to its surface triangles object by garment id, and pending a/b to prepared surfaces; JSON cannot retain object identity.'};
      await fs.writeFile(path.join(args.output,label+'.state.json'),JSON.stringify({step,simulationSeconds:world.time,inputSHA256:summary.inputSHA256,sourceSHA256,
        surfaces:world.surfaces(),contactHistory:history},(key,value)=>ArrayBuffer.isView(value)?Array.from(value):value));
    };
    try {
      const started = performance.now(),creationCPU=process.cpuUsage();
      world = await LayerWorld.create(input.body, input.rows, kernelBytes, input.options);
      summary.creationMS = performance.now() - started;
      {const cpu=process.cpuUsage(creationCPU);summary.creationCPUms={user:cpu.user/1000,system:cpu.system/1000,total:(cpu.user+cpu.system)/1000};}
      summary.initialization = world.initializationReport;
      summary.garments = world.rows.map(a => ({id: a.id, particles: a.s.count, triangles: a.s.faces.length / 3, thicknessM: a.thickness, fixedParticles: Array.from(a.s.w).filter(w => w === 0).length}));
      const fixedReference = world.rows.map(a => a.s.p.slice());
      const inspect = async (step, previous,stepCPU=null) => {
        const checkpoint = checkpointSteps.has(step), audit = world.audit({bodySamples: true});
        const contact = step === 0 ? world.contacts.measure(world.surfaces()) : audit.contact;
        const compactContact = contact ? {contactCount: contact.contactCount, residualCount: contact.residualCount,
          residualMaxPenetration: contact.residualMaxPenetration, residualScope: contact.residualScope,
          sweptCrossingCount: contact.sweptCrossingCount, timings: contact.timings} : null;
        let speed = 0;
        const movement = world.rows.map((a, index) => {
          let moved = 0, fixedDrift = 0;
          for (let i = 0; i < a.s.count; i++) {
            const k = i * 3;
            if (previous) moved = Math.max(moved, Math.hypot(a.s.p[k] - previous[index][k], a.s.p[k + 1] - previous[index][k + 1], a.s.p[k + 2] - previous[index][k + 2]));
            if (!a.s.w[i]) fixedDrift = Math.max(fixedDrift, Math.hypot(a.s.p[k] - fixedReference[index][k], a.s.p[k + 1] - fixedReference[index][k + 1], a.s.p[k + 2] - fixedReference[index][k + 2]));
            speed = Math.max(speed, Math.hypot(a.s.v[k], a.s.v[k + 1], a.s.v[k + 2]));
          }
          maximumMove.set(a.id, Math.max(maximumMove.get(a.id) || 0, moved));
          return {id: a.id, maxMoveMM: moved * 1000, maxFixedDriftMM: fixedDrift * 1000, finite: a.s.p.every(Number.isFinite) && a.s.v.every(Number.isFinite)};
        });
        const row = {step, simulationSeconds: audit.simulationSeconds, solverMS: audit.solverMS,
          stageTimingsMS: audit.stageTimingsMS, processCPUms:stepCPU, maxEdgeStretch: audit.maxEdgeStretch, seamGapMM: audit.seamGapMM,
          contact: compactContact, movement, maxSpeedMPS: speed,
          bodySampledVertices: audit.bodySampledVertices, bodyMinimumMM: audit.bodyMinimumMM,
          bodyInsideVertices: audit.bodyInsideVertices, bodyThicknessOverlapMM: audit.bodyThicknessOverlapMM ?? null,
          bodyThicknessOverlappingVertices: audit.bodyThicknessOverlappingVertices ?? null,
          bodyPerGarment: audit.bodyPerGarment ?? null, geometry: null,
          bodyEnvelope:world.lastBodyEnvelope?{maxHalfThicknessOverlapM:world.lastBodyEnvelope.maxHalfThicknessOverlapM,maxClearanceDeficitM:world.lastBodyEnvelope.maxClearanceDeficitM,triangles:world.lastBodyEnvelope.triangles}:null,
          settling: world.lastSettling ? {converged:world.lastSettling.converged,passes:world.lastSettling.passes,totalActiveCorrections:world.lastSettling.totalActiveCorrections,settlingMS:world.lastSettling.settlingMS,final:world.lastSettling.observations.at(-1)} : null};
        {
          row.geometry = auditMeshIntersections([...world.rows.map(a => ({id: a.id, positions: a.s.p, indices: a.s.faces})),
            {id: '__actual_native_body__', positions: input.body.positions, indices: input.body.faces}], {sampleLimit: checkpoint ? 16 : 0});
          row.independentBodyEnvelope=bodyEnvelopeAuditor.measure(world.surfaces(),{sampleLimit:checkpoint?16:0});
          if(!Number.isFinite(row.independentBodyEnvelope.maxHalfThicknessOverlapMM)||row.independentBodyEnvelope.maxHalfThicknessOverlapMM>.001)fail('body-surface-half-thickness-overlap',step,row.independentBodyEnvelope);
          if(row.independentBodyEnvelope.degenerateTriangles!==0||row.independentBodyEnvelope.scope?.completeForInputTriangles!==true)fail('incomplete-body-surface-audit',step,row.independentBodyEnvelope.scope);
          if (row.geometry.hasReportedIntersections) fail('triangle-intersections', step, row.geometry.pairs.filter(p => p.properCrossingTrianglePairs || p.boundaryCurveTrianglePairs || p.coplanarOverlapTrianglePairs));
          if (row.geometry.degenerateTriangles) fail('degenerate-triangles', step, row.geometry.degenerateTriangles);
          if (row.geometry.scope?.allNondegenerateInputTrianglePairsCovered !== true) fail('incomplete-triangle-audit', step, row.geometry.scope);
          const expectedVertices=world.rows.reduce((sum,a)=>sum+a.s.count,0);
          if(row.bodySampledVertices!==expectedVertices||!Number.isFinite(row.bodyMinimumMM)||!Number.isFinite(row.bodyThicknessOverlapMM))fail('incomplete-body-audit',step,{expectedVertices,measured:row.bodySampledVertices,minimumMM:row.bodyMinimumMM,overlapMM:row.bodyThicknessOverlapMM});
          if (row.bodyInsideVertices > 0) fail('cloth-vertices-inside-body', step, row.bodyInsideVertices);
          if (row.bodyThicknessOverlapMM === null) fail('body-thickness-not-measured', step, null);
          else if (row.bodyThicknessOverlapMM > .001) fail('body-half-thickness-overlap', step, row.bodyThicknessOverlapMM);
          if(checkpoint)summary.checkpoints.push(row);
          summary.independentlyAuditedDiscreteStates=step+1;
        }
        if (movement.some(m => !m.finite) || !Number.isFinite(audit.maxEdgeStretch)) fail('nonfinite-state', step, movement);
        const fixedDrift = Math.max(...movement.map(m => m.maxFixedDriftMM));
        if (fixedDrift > .001) fail('fixed-particle-drift', step, fixedDrift);
        if (step > 0 && audit.maxEdgeStretch > 1.45) fail('dynamic-paper-overstretch', step, audit.maxEdgeStretch);
        const residualMM = compactContact?.residualMaxPenetration * 1000;
        if (!Number.isFinite(residualMM)) fail('contact-residual-not-measured', step, null);
        else {summary.maxima.contactResidualMM = Math.max(summary.maxima.contactResidualMM ?? 0, residualMM); if (residualMM > .5) fail('cloth-thickness-residual', step, residualMM);}
        if (step > 0) {summary.maxima.dynamicEdgeStretch = Math.max(summary.maxima.dynamicEdgeStretch, audit.maxEdgeStretch); timings.push(audit.solverMS);}
        summary.maxima.speedMPS = Math.max(summary.maxima.speedMPS, speed);
        summary.maxima.fixedDriftMM = Math.max(summary.maxima.fixedDriftMM, fixedDrift);
        summary.completedSteps = step; summary.simulationSeconds = audit.simulationSeconds;
        await fs.appendFile(logPath, JSON.stringify(row) + '\n');
        if (checkpoint) {await saveState(step);await save(); console.log(JSON.stringify({label, step, seconds: audit.simulationSeconds, solverMS: audit.solverMS, stretch: audit.maxEdgeStretch,
          residualMM: Number.isFinite(residualMM) ? residualMM : null, intersections: row.geometry.hasReportedIntersections, bodyOverlapMM: row.bodyThicknessOverlapMM}));}
      };
      await inspect(0, null);
      for (let step = 1; step <= args.steps; step++) {
        if (args.stopOnFailure && failures.size) break;
        if (mode === 'perturb' && [61, 121, 181].includes(step)) {
          const id = step === 121 ? 'inner' : 'outer', kind = step === 121 ? 'tug' : 'push';
          if (!world.rows.some(a => a.id === id)) throw Error('Perturbation requires garment ' + id);
          world.perturb(id, kind); summary.perturbations.push({beforeStep: step, garment: id, kind});
        }
        const previous = world.rows.map(a => a.s.p.slice());
        const stepCPUStart=process.cpuUsage();world.step(1 / 120);const stepCPU=process.cpuUsage(stepCPUStart);
        await inspect(step, previous,{user:stepCPU.user/1000,system:stepCPU.system/1000,total:(stepCPU.user+stepCPU.system)/1000});
      }
      if (summary.completedSteps !== args.steps || Math.abs(summary.simulationSeconds - args.steps / 120) > 1e-9) fail('incomplete-physical-progress', summary.completedSteps, {requestedSteps: args.steps, seconds: summary.simulationSeconds});
      for (const a of world.rows) if (a.s.w.some(w => w > 0) && !(maximumMove.get(a.id) > 1e-8)) fail('no-measured-garment-motion', summary.completedSteps, a.id);
    } catch (error) {summary.error = {message: error.message, stack: error.stack,diagnostics:error.diagnostics}; fail('replay-error', summary.completedSteps, error.message);}
    const sorted = timings.slice().sort((a, b) => a - b);
    summary.timing = sorted.length ? {count: sorted.length, minMS: sorted[0], medianMS: sorted[Math.floor(sorted.length * .5)], p95MS: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))], maxMS: sorted.at(-1)} : null;
    summary.maximumSingleStepMoveMM = Object.fromEntries(Array.from(maximumMove, ([id, value]) => [id, value * 1000]));
    summary.acceptance.passed = failures.size === 0;
    failed ||= !summary.acceptance.passed;
    await save();
    console.log(JSON.stringify({label, done: true, passed: summary.acceptance.passed, completedSteps: summary.completedSteps, simulationSeconds: summary.simulationSeconds, failures: summary.acceptance.failures, timing: summary.timing, summaryPath}));
  }
} finally {await fs.rm(temp, {recursive: true, force: true});}
if (failed) process.exitCode = 1;
