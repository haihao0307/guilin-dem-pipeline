import {createClothWorld} from './world.mjs';

let actor = null, chain = Promise.resolve(), generation = 0, pool = [];
function allocateSlots() {
  pool = Array.from({length: 3}, (_, id) => ({id, free: true, rows: actor.world.solvers.map(s => ({positions: new Float32Array(s.output.length), normals: new Float32Array(s.normals.length)}))}));
}
function sendFrame(id, {initial = false, extra = {}} = {}) {
  const slot = pool.find(value => value.free);
  if (!slot) throw Error('No native cloth output slot has been returned');
  slot.free = false;
  const rows = actor.pack(slot.rows, initial);
  const message = {id, generation, slot: slot.id, rows, audit: actor.audit(), ...extra};
  self.postMessage(message, rows.flatMap(row => [row.positions.buffer, row.normals.buffer]));
}
function recycle(data) {
  const slot = pool[data.slot];
  if (!slot || slot.free || data.generation !== generation || data.buffers?.length !== slot.rows.length * 2) return;
  let k = 0;
  for (const row of slot.rows) {row.positions = new Float32Array(data.buffers[k++]); row.normals = new Float32Array(data.buffers[k++]);}
  slot.free = true;
}
async function handle(data) {
  if (data.command === 'init') {
    if (actor) throw Error('Native cloth actor already initialized');
    generation = data.generation;
    actor = await createClothWorld({...data.options, onProgress: progress => self.postMessage({id: data.id, progress})});
    allocateSlots();
    sendFrame(data.id, {initial: true, extra: {initialization: actor.initialization, garments: actor.descriptors(), groundShiftM: actor.prepared.lock.person.groundShiftM}});
    return;
  }
  if (!actor) throw Error('Native clothing is not initialized');
  if (data.command === 'step') {await actor.update(data.frame); sendFrame(data.id);}
  else if (data.command === 'reset') {actor.reset(); sendFrame(data.id);}
  else if (data.command === 'measure-contact') self.postMessage({id: data.id, generation, contact: actor.measureContact(), audit: actor.audit()});
  else throw Error('Unsupported external native cloth command: ' + data.command);
}
self.onmessage = ({data}) => {
  if (data.command === 'recycle') {recycle(data); return;}
  chain = chain.then(() => handle(data)).catch(error => self.postMessage({id: data.id, generation, error: error.message, failure: error.clothFailure || null, audit: actor?.audit() || null}));
};
