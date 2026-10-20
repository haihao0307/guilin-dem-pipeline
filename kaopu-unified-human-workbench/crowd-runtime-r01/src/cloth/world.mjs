import {prepareNativeOutfit} from './prepare.mjs';
import {CoupledCloth} from './upstream/coupled-cloth.mjs';
import {ReducedCloth} from './upstream/reduced-cloth.mjs';
import {GPUCloth} from './upstream/gpu-cloth.mjs';
import {loadClothKernel, accelerateWorld} from './upstream/wasm-cloth.mjs';

export const DEFAULT_PHYSICS = Object.freeze({gravity: 1, bend: 1, softness: 1, damping: 7, clearanceMM: 4});
const waitForEventLoop = () => new Promise(resolve => setTimeout(resolve, 0));

function failIfAborted(signal) {if (signal?.aborted) throw new DOMException('Cloth creation cancelled', 'AbortError');}
function detachWasmState(world) {
  // Retain every numeric value, but release the initialization-only WASM heap.
  for (const s of world.solvers) for (const key of ['p', 'v', 'old', 'w']) s[key] = s[key].slice();
  world.bottomSurface.p = world.solvers[1].p;
  world.bottomSurface.refit();
}

/** Same GPU-first / WASM fallback 48-step joint fitting as live-cloth-worker. */
export async function createClothWorld(options = {}) {
  const {onProgress = () => {}, signal, fitBackend = 'auto'} = options;
  if (!['auto', 'wasm', 'webgpu'].includes(fitBackend)) throw Error('Unknown native cloth fitting backend');
  const started = performance.now(), prepared = await prepareNativeOutfit(options);
  failIfAborted(signal);
  const settings = {...DEFAULT_PHYSICS, ...options.physicsSettings};
  const world = new CoupledCloth(prepared.rows, {sdf: prepared.sdf, actor: prepared.actor, settings});
  world.actor.evaluate({});
  const finalBody = world.actor.positions.slice(), origin = prepared.actor.fittingOrigin;
  world.actor.positions.set(origin); world.body.refit(world.actor.positions);
  let fitting = null, fallbackReason = null, completed = 0;
  try {
    if (fitBackend !== 'wasm') {
      try {fitting = await GPUCloth.create(world);}
      catch (error) {if (fitBackend === 'webgpu') throw error; fallbackReason = error.message;}
    }
    if (!fitting) {
      world.forceBodyTriangles = true;
      accelerateWorld(world, await loadClothKernel(await prepared.assets.bytes('cloth-kernel.wasm')));
      fitting = world.acceleration; world.bodyActive = true;
    }
    const backend = fitting instanceof GPUCloth ? 'original-webgpu-joint-fit' : 'original-wasm-joint-fit';
    for (let i = 0; i < 48; i++) {
      failIfAborted(signal);
      const fraction = Math.min(1, (i + 1) / 32);
      const target = Float32Array.from(finalBody, (v, k) => origin[k] + (v - origin[k]) * fraction);
      if (fitting instanceof GPUCloth) {fitting.fittingTarget = target; fitting.fitFraction = fraction;}
      else {world.actor.positions.set(target); fitting.actorTarget.set(target); fitting.waist.begin();}
      await world.step(1 / 60, false);
      completed++;
      onProgress({phase: '原上衣与裤装联合适配当前人物', fraction: .1 + .75 * completed / 48, completedFitSteps: completed, totalFitSteps: 48, backend});
      if (!(fitting instanceof GPUCloth) && i % 4 === 3) await waitForEventLoop();
    }
    const fitContact = world.audit(true);
    const fitGarments = world.solvers.map(s => s.audit(false, {skipStaticContact: true}));
    const fitMetrics = {...fitting.metrics};
    world.initialTime = world.elapsed;
    if (!(fitting instanceof GPUCloth)) detachWasmState(world);
    fitting.dispose?.(); fitting = null;
    new ReducedCloth(world);
    world.initial = world.solvers.map(s => s.p.slice());
    world.bodyActive = true;
    const report = {
      backend, fallbackReason, completedFitSteps: completed, requiredFitSteps: 48,
      fittingPhysicalSeconds: 48 / 60, grading: prepared.grades,
      jointFitSkipped: false, reusedFittedState: false, currentPerson: prepared.personIdentity,
      sourceProof: prepared.proof, fitContact, fitGarments, fitMetrics,
      currentFitContactAfterRegionalSetup: world.audit(false),
      nativeRuntimeSafetyThresholdsChanged: false, wearerFitAccepted: false,
      liveBackend: world.acceleration.backend, creationMS: performance.now() - started,
      physicalParticles: world.acceleration.models.map(m => m.count),
      visualControlVertices: world.solvers.map(s => s.output.length / 3)
    };
    onProgress({phase: '当前人物联合穿着初态已生成，原区域物理已接入', fraction: .9, report});
    return new ExternalClothWorld(world, prepared, report);
  } catch (error) {
    fitting?.dispose?.();
    error.clothFailure = {phase: 'native-joint-fit', completedFitSteps: completed, requiredFitSteps: 48,
      nativeRuntimeSafetyThresholdsChanged: false, currentPerson: prepared.personIdentity,
      safetyTrips: world.safetyTrips, backend: world.acceleration?.backend || world.backend,
      fallbackReason, message: error.message};
    throw error;
  }
}

function copySkin(skin) {return skin.map(m => Float64Array.from(m));}
function validateSkin(matrices, count) {
  if (matrices?.length !== count) throw Error('External cloth pose requires all native bone matrices');
  for (let j = 0; j < count; j++) {
    const m = matrices[j];
    if (m?.length !== 16 || !Array.from(m).every(Number.isFinite)) throw Error('Nonfinite or malformed external skin matrix ' + j);
    if (Math.abs(m[12]) > 1e-8 || Math.abs(m[13]) > 1e-8 || Math.abs(m[14]) > 1e-8 || Math.abs(m[15] - 1) > 1e-8) throw Error('External skin matrices must be affine row-major transforms');
  }
}

class ExternalClothWorld {
  constructor(world, prepared, initialization) {
    this.world = world; this.prepared = prepared; this.initialization = initialization;
    this.lastFrameSequence = -1; this.motionTime = 0; this.lastError = null; this.busy = false; this.disposed = false;
    this.acceptedSkin = copySkin(world.actor.skin);
    this.initialSkin = copySkin(world.actor.skin);
    this.transaction = world.solvers.map(s => ({p: s.p.slice(), output: s.output.slice(), normals: s.normals.slice(), time: s.time, steps: s.steps}));
  }
  pack(rows = null, includeStatic = false) {return this.world.rows(rows, includeStatic);}
  descriptors() {
    return this.prepared.rows.map(row => ({packet: row.packet, info: row.info, materialID: row.materialID, role: row.role}));
  }
  audit() {
    const w = this.world;
    return {frameSequence: this.lastFrameSequence, physicalFrameSequence: w.frameSequence,
      timeSeconds: this.motionTime, simulatedSeconds: w.elapsed - w.initialTime,
      fittingPhysicalSeconds: this.initialization.fittingPhysicalSeconds, solverMS: w.simulationMs,
      physicsSource: 'native-live-externally-clocked', backend: w.acceleration.backend,
      internalActionAdvance: false, actionResultReplay: false,
      bodyFrameMatchesCloth: true, requestedFrameAccepted: !this.lastError, lastError: this.lastError,
      safetyTrips: w.safetyTrips, pipeline: {...w.acceleration.metrics},
      bodyRevision: w.bodyRevision, clothRevision: w.clothRevision,
      nativeRig: w.actor.audit(), fullFreeCloth: false, allSelfCollision: false,
      continuousCollision: false, wearerFitAccepted: false};
  }
  async update({dt = 1 / 60, skinMatrices, frameSequence, timeSeconds} = {}) {
    if (this.disposed) throw Error('Disposed native clothing actor');
    if (this.busy) throw Error('A cloth actor already has a physical tick in flight');
    if (this.lastError) throw Error('Restore the initial cloth state before continuing: ' + this.lastError);
    if (!Number.isFinite(dt) || dt <= 0 || dt > 1 / 15) throw Error('Invalid external cloth time step');
    if (!Number.isInteger(frameSequence) || frameSequence <= this.lastFrameSequence) throw Error('Cloth frame sequence must strictly increase; a pose cannot advance twice');
    const nextTime = timeSeconds ?? this.motionTime + dt;
    if (!Number.isFinite(nextTime) || nextTime < this.motionTime) throw Error('External cloth time cannot move backwards');
    validateSkin(skinMatrices, this.world.actor.rig.names.length);
    this.busy = true;
    const w = this.world, previous = {elapsed: w.elapsed, bodyRevision: w.bodyRevision, clothRevision: w.clothRevision, frameSequence: w.frameSequence, motionTime: w.motionTime};
    this.transaction.forEach((r, i) => {const s = w.solvers[i]; r.p.set(s.p); r.output.set(s.output); r.normals.set(s.normals); r.time = s.time; r.steps = s.steps;});
    try {
      // The sole native motion entry. No actor.at(), setMotion(), or action timer.
      w.actor.evaluate({}, skinMatrices);
      await w.acceleration.step(dt, false);
      w.bodyRevision = previous.bodyRevision + 1;
      w.motionTime = nextTime;
      this.motionTime = nextTime; this.lastFrameSequence = frameSequence;
      for (let j = 0; j < this.acceptedSkin.length; j++) this.acceptedSkin[j].set(w.actor.skin[j]);
      return this.audit();
    } catch (error) {
      // Native ReducedCloth rolls back its regional state inside step(). The
      // external input arrived before that snapshot, so restore its prior body
      // and the exact prior fine garment outputs as one additional transaction.
      w.actor.evaluate({}, this.acceptedSkin);
      w.acceleration.updateReferences(); w.acceleration.lowerBodyContact.refit();
      this.transaction.forEach((r, i) => {const s = w.solvers[i]; s.p.set(r.p); s.output.set(r.output); s.normals.set(r.normals); s.time = r.time; s.steps = r.steps;});
      w.body.refit(w.actor.positions); w.bottomSurface.refit();
      Object.assign(w, previous);
      this.lastError = error.message;
      error.clothFailure = {phase: 'external-native-step', frameSequence, timeSeconds: nextTime,
        acceptedFrameSequence: this.lastFrameSequence, acceptedTimeSeconds: this.motionTime,
        inputPoseRolledBack: true, safetyTrips: w.safetyTrips, message: error.message};
      throw error;
    } finally {this.busy = false;}
  }
  reset() {
    if (this.busy) throw Error('Wait for the pending cloth tick before reset');
    const w = this.world;
    w.reset(); w.initialTime = 0; w.bodyActive = true;
    this.lastFrameSequence = -1; this.motionTime = 0; this.lastError = null;
    for (let j = 0; j < this.acceptedSkin.length; j++) this.acceptedSkin[j].set(w.actor.skin[j]);
    return this.audit();
  }
  measureContact() {return {frameSequence: this.lastFrameSequence, ...this.world.audit(true)};}
  dispose() {this.disposed = true; this.world.acceleration.dispose?.();}
}
