import * as NativeThree from 'three';
import {modelIdentity} from './upstream/source-contract.mjs';
import {nativeGarmentMesh, disposeGarment} from './upstream/outfits-r043.mjs';
import {buildContinuousSolid} from './upstream/continuous-solid.mjs';
import {mapPanelUV} from './upstream/panel-grain.mjs';

const identityCache = new WeakMap();
export function clothPersonIdentity(model) {
  let promise = identityCache.get(model);
  if (!promise) {promise = modelIdentity(model); identityCache.set(model, promise);}
  return promise;
}

class WorkerClient {
  constructor({workerURL, workerFactory, onProgress}) {
    const url = workerURL || new URL('./worker.mjs', import.meta.url);
    this.worker = workerFactory ? workerFactory(url) : new Worker(url, {type: 'module'});
    this.onProgress = onProgress; this.pending = new Map(); this.sequence = 0; this.generation = 1; this.dead = false; this.rows = null;
    this.worker.onmessage = ({data}) => {
      if (this.dead) return;
      if (data.progress) {this.onProgress?.(data.progress); return;}
      const task = this.pending.get(data.id);
      if (!task) return;
      this.pending.delete(data.id);
      if (data.error) {const error = Error(data.error); error.clothFailure = data.failure; error.audit = data.audit; task.reject(error); return;}
      if (data.rows) {
        this.rows ??= data.rows.map(row => ({positions: new Float32Array(row.positions.length), normals: new Float32Array(row.normals.length)}));
        try {
          data.rows.forEach((row, i) => {
            const target = this.rows[i];
            if (target.positions.length !== row.positions.length || target.normals.length !== row.normals.length) throw Error('Native cloth output topology changed');
            target.positions.set(row.positions); target.normals.set(row.normals); target.audit = row.audit;
            if (row.indices) {target.indices = row.indices; target.orientation = row.orientation;}
          });
          this.latestAudit = data.audit;
          task.resolve({...data, rows: this.rows});
        } catch (error) {task.reject(error);}
        finally {
          const buffers = data.rows.flatMap(row => [row.positions.buffer, row.normals.buffer]);
          this.worker.postMessage({command: 'recycle', generation: data.generation, slot: data.slot, buffers}, buffers);
        }
      } else {this.latestAudit = data.audit || this.latestAudit; task.resolve(data);}
    };
    this.worker.onerror = event => {const error = Error(event.message || 'Native cloth worker failed'); for (const task of this.pending.values()) task.reject(error); this.pending.clear();};
  }
  call(command, values = {}) {
    if (this.dead) return Promise.reject(Error('Native cloth worker disposed'));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject});
      try {this.worker.postMessage({id, command, generation: this.generation, ...values});}
      catch (error) {this.pending.delete(id); reject(error);}
    });
  }
  dispose() {
    if (this.dead) return;
    this.dead = true; this.worker.terminate();
    for (const task of this.pending.values()) task.reject(new DOMException('Clothing disposed', 'AbortError'));
    this.pending.clear();
  }
}

function uvFor(packet) {
  const values = [];
  for (const panel of packet.spec.panels) for (const [x, y] of panel.uvMm) values.push(...mapPanelUV(panel.id, x, y));
  return new Float32Array(values);
}

/**
 * Create one original T03/P02 outfit in the caller's Three renderer.
 * All actor-local data is independent. Only immutable source bytes are shared.
 * Call update once per accepted scene tick, then renderUpdate before rendering.
 */
export async function create(options = {}) {
  const {THREE = NativeThree, renderer, actorPacket, model, parent = null,
    onProgress = () => {}, requestRender = () => {}, signal, actorID = 'npc'} = options;
  if (THREE.BufferGeometry !== NativeThree.BufferGeometry || THREE.DataTexture !== NativeThree.DataTexture || THREE.MeshPhysicalMaterial !== NativeThree.MeshPhysicalMaterial) throw Error('Native clothing and actor renderer must resolve to the same Three.js module instance');
  if (!renderer?.getContext || !actorPacket) throw Error('Native clothing requires the shared renderer and complete actor packet');
  const personIdentity = options.personIdentity || await clothPersonIdentity(model);
  const group = new THREE.Group(); group.name = actorID + '/native-clothing';
  const abort = new AbortController(), items = [];
  let disposed = false, running = false, pendingUpdate = null, frame = null, initialization = null;
  const client = new WorkerClient({workerURL: options.workerURL, workerFactory: options.workerFactory, onProgress});
  function dispose() {
    if (disposed) return;
    disposed = true; abort.abort(); client.dispose();
    for (const item of items) {item.solid?.dispose(); disposeGarment(item.mesh);}
    group.removeFromParent(); group.clear();
    signal?.removeEventListener('abort', dispose);
  }
  signal?.addEventListener('abort', dispose, {once: true});
  if (signal?.aborted) {dispose(); throw new DOMException('Clothing cancelled', 'AbortError');}
  function applyFrame(data) {
    data.rows.forEach((row, i) => {
      const item = items[i]; if (!item) return;
      const geometry = item.mesh.geometry;
      if (row.indices && !item.orientationApplied) {geometry.setIndex(new THREE.BufferAttribute(row.indices, 1)); item.orientationApplied = true;}
      geometry.attributes.position.array = row.positions;
      geometry.attributes.normal.array = row.normals;
      geometry.attributes.position.needsUpdate = true; geometry.attributes.normal.needsUpdate = true;
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      item.solid?.motion(running); item.solid?.deform(); item.physicsAudit = row.audit;
    });
    frame = data.audit;
  }
  const localCamera = new THREE.PerspectiveCamera(), inverseRoot = new THREE.Matrix4();
  localCamera.matrixAutoUpdate = false;
  function renderUpdate(camera) {
    if (disposed || !camera) return;
    if (!camera.isPerspectiveCamera) throw Error('Native cloth sampling currently requires a perspective camera');
    camera.updateWorldMatrix(true, false); group.updateWorldMatrix(true, false);
    inverseRoot.copy(group.matrixWorld).invert();
    localCamera.matrix.multiplyMatrices(inverseRoot, camera.matrixWorld);
    localCamera.matrixWorld.copy(localCamera.matrix); localCamera.matrixWorldInverse.copy(localCamera.matrix).invert();
    localCamera.position.setFromMatrixPosition(localCamera.matrix);
    localCamera.projectionMatrix.copy(camera.projectionMatrix); localCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    for (const key of ['fov', 'aspect', 'near', 'far', 'zoom', 'filmGauge', 'filmOffset']) localCamera[key] = camera[key];
    for (const item of items) {item.solid.motion(running); item.solid.update(localCamera);}
  }
  try {
    const data = await client.call('init', {options: {actorPacket, personIdentity,
      outfit: options.outfit, materialSettings: options.materialSettings,
      physicsSettings: options.physicsSettings, fitBackend: options.fitBackend || 'auto'}});
    if (disposed) throw new DOMException('Clothing cancelled', 'AbortError');
    initialization = data.initialization;
    for (const descriptor of data.garments) {
      const mesh = nativeGarmentMesh(THREE, descriptor.packet, data.groundShiftM);
      mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uvFor(descriptor.packet), 2));
      mesh.userData.role = descriptor.role;
      items.push({...descriptor, mesh, solid: null, orientationApplied: false});
    }
    applyFrame(data);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      item.solid = await buildContinuousSolid(item.mesh, item.packet, item.info, {renderer, signal: abort.signal,
        requestRender: () => {if (!disposed) requestRender();},
        onProgress: (fraction, panel) => onProgress({phase: '生成原实体纱线 · ' + item.role + ' · ' + panel, fraction: .9 + .1 * (i + fraction) / items.length})});
      item.solid.group.name = actorID + '/' + item.packet.binding.presetId + '/original-solid';
      group.add(item.solid.group);
    }
    if (disposed) throw new DOMException('Clothing cancelled', 'AbortError');
    parent?.add(group);
    onProgress({phase: '原生上衣与裤装已接入同一场景', fraction: 1});
  } catch (error) {dispose(); throw error;}

  return {
    group, items, initialization, personIdentity,
    get frame() {return frame;},
    get busy() {return !!pendingUpdate;},
    async update(input) {
      if (disposed) throw Error('Disposed native clothing');
      if (pendingUpdate) throw Error('Clothing already has a tick in flight; scene scheduler must await completion');
      running = true;
      pendingUpdate = client.call('step', {frame: input});
      try {const result = await pendingUpdate; applyFrame(result); return frame;}
      catch (error) {running = false; if (error.audit) frame = error.audit; throw error;}
      finally {pendingUpdate = null;}
    },
    renderUpdate,
    pause() {running = false; for (const item of items) item.solid.motion(false);},
    async reset() {if (pendingUpdate) await pendingUpdate.catch(() => {}); running = false; const result = await client.call('reset'); applyFrame(result); return frame;},
    async measureContact() {if (pendingUpdate) await pendingUpdate; return (await client.call('measure-contact')).contact;},
    audit() {return {initialization, frame, rendering: items.map(item => ({preset: item.packet.binding.presetId, material: item.materialID, ...item.solid.stats, resources: item.solid.resources?.()})), sharedRenderer: true, originalSolidRepresentation: true, independentlyOwnedMutableState: true};},
    dispose
  };
}

export const createClothActor = create;
export function update(actor, input) {return actor.update(input);}
export function dispose(actor) {actor?.dispose();}
