/** Native78 signature-only equivalence. Never mutates specimen data.
 * This is NOT the original native76 hash and must have a separate release pin.
 * Source rules, dependencies, exact profile, and native validation remain mandatory.
 */
export const SIGNATURE_VERSION = 'native78-ficus-bounded-signature/1';
export const BARK_DIRECTION_ZERO_THRESHOLD = 1e-12;
// Exact binary cell width, strictly smaller than the 1e-12 maximum contract.
export const GROWTH_GRID_STEP = 2 ** -40;
// ../current-site-source/checkout/src/Core/sha256.ts
var K = new Uint32Array([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);
var rot = (n, b) => n >>> b | n << 32 - b;
function sha256Portable(bytes) {
  const h = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
  const length = Math.ceil((bytes.length + 9) / 64) * 64, data = new Uint8Array(length);
  data.set(bytes);
  data[bytes.length] = 128;
  const view = new DataView(data.buffer);
  view.setUint32(length - 8, Math.floor(bytes.length / 536870912));
  view.setUint32(length - 4, bytes.length * 8 >>> 0);
  const w = new Uint32Array(64);
  for (let off = 0; off < length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      w[i] = w[i - 16] + (rot(x, 7) ^ rot(x, 18) ^ x >>> 3) + w[i - 7] + (rot(y, 17) ^ rot(y, 19) ^ y >>> 10) >>> 0;
    }
    let [a, b, c, d, e, f, g, j] = h;
    for (let i = 0; i < 64; i++) {
      const t = j + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + (e & f ^ ~e & g) + K[i] + w[i] >>> 0, u = (rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + (a & b ^ a & c ^ b & c) >>> 0;
      j = g;
      g = f;
      f = e;
      e = d + t >>> 0;
      d = c;
      c = b;
      b = a;
      a = t + u >>> 0;
    }
    const out = [a, b, c, d, e, f, g, j];
    for (let i = 0; i < 8; i++) h[i] = h[i] + out[i] >>> 0;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, "0")).join("");
}
async function digestBytes(bytes) {
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return sha256Portable(bytes);
}


export { digestBytes as hashBytes };
const typedNames = new Map([[Float32Array,'Float32Array'],[Float64Array,'Float64Array'],[Uint32Array,'Uint32Array'],[Uint16Array,'Uint16Array'],[Uint8Array,'Uint8Array'],[Int32Array,'Int32Array'],[Int16Array,'Int16Array'],[Int8Array,'Int8Array'],[Uint8ClampedArray,'Uint8ClampedArray']]);

/** Include compact native organ prototype getters, which JSON.stringify drops.
 * All own keys, including unknown and nonenumerable keys, are included. Native
 * prototype methods are implementation, already bound by the source dependency.
 */
export function botanicalKeys(value) {
  const keys = new Set(Object.getOwnPropertyNames(value));
  for(let p=Object.getPrototypeOf(value);p&&p!==Object.prototype&&p!==Array.prototype;p=Object.getPrototypeOf(p)) {
    for(const key of Object.getOwnPropertyNames(p)) {
      if(key==='constructor')continue;
      const descriptor=Object.getOwnPropertyDescriptor(p,key);
      if(descriptor.get)keys.add(key);
      else if(typeof descriptor.value!=='function')keys.add(key);
    }
  }
  return [...keys].sort();
}

export async function hashSpecimen(specimen) {
  if(!specimen||typeof specimen!=='object'||!specimen.geometry||!specimen.growth||!specimen.surfaces)throw Error('Complete native specimen required');
  const viewIds=new Map(),backingIds=new Map(),active=new Set();
  const id=(map,value)=>{if(!map.has(value))map.set(value,map.size);return map.get(value);};
  async function visit(value,path,depth=0) {
    if(depth>90)throw Error('Signature nesting exceeds native bound');
    if(value===null)return ['null'];
    if(typeof value==='number') {
      if(!Number.isFinite(value))throw Error('Nonfinite signature number at '+path.join('.'));
      const growth=path[0]==='growth';
      if(growth&&!Number.isInteger(value)) {
        const cell=Math.round(value/GROWTH_GRID_STEP);
        if(!Number.isSafeInteger(cell))throw Error('Growth value exceeds exact grid index bound');
        return ['growth-binary-cell',cell];
      }
      return ['number',Object.is(value,-0)?'-0':value];
    }
    if(typeof value==='string'||typeof value==='boolean')return [typeof value,value];
    if(value===undefined)return ['undefined'];
    if(typeof value!=='object')throw Error('Unsupported signature value');
    if(Object.getOwnPropertySymbols(value).length)throw Error('Symbol fields require an explicit signature version');
    if(ArrayBuffer.isView(value)) {
      const type=typedNames.get(value.constructor);
      if(!type)throw Error('Unsupported signature typed array');
      if(value instanceof Float32Array||value instanceof Float64Array)for(const number of value)if(!Number.isFinite(number))throw Error('Nonfinite signature buffer');
      const bark=path.length===2&&path[0]==='geometry'&&path[1]==='barkCoordinates69';
      let bytes=new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
      if(bark) {
        if(!(value instanceof Float32Array)||value.length%4)throw Error('Invalid bark direction chart');
        const copy=new Float32Array(value);
        for(let i=0;i<copy.length;i++)if(i%4<2&&Math.abs(copy[i])<BARK_DIRECTION_ZERO_THRESHOLD)copy[i]=0;
        bytes=new Uint8Array(copy.buffer);
      }
      // View and backing-store alias topology is retained, even on repeated uses.
      const descriptor=['typed-array',id(viewIds,value),type,value.length,value.byteLength,id(backingIds,value.buffer),value.byteOffset,value.buffer.byteLength,bark?'bark-directions-near-zero':'exact',await digestBytes(bytes)];
      // Unexpected custom properties on typed arrays must not disappear.
      const extras=Object.getOwnPropertyNames(value).filter(k=>!(/^(0|[1-9][0-9]*)$/.test(k)&&Number(k)<value.length));
      if(extras.length)throw Error('Custom typed-array properties require an explicit signature version');
      return descriptor;
    }
    if(value instanceof ArrayBuffer||value instanceof Date||value instanceof Map||value instanceof Set)throw Error('Unsupported signature object');
    if(active.has(value))throw Error('Cyclic signature object');
    active.add(value);
    try {
      if(Array.isArray(value)) {
        const entries=[];
        for(let i=0;i<value.length;i++)entries.push(i in value?await visit(value[i],[...path,String(i)],depth+1):['array-hole']);
        const extras=[];
        for(const key of Object.getOwnPropertyNames(value).sort())if(key!=='length'&&!(/^(0|[1-9][0-9]*)$/.test(key)&&Number(key)<value.length))extras.push([key,await visit(value[key],[...path,key],depth+1)]);
        return ['array',value.length,entries,extras];
      }
      const entries=[];
      for(const key of botanicalKeys(value))entries.push([key,await visit(value[key],[...path,key],depth+1)]);
      return ['object',entries];
    } finally { active.delete(value); }
  }
  const tree=await visit(specimen,[]);
  return digestBytes(new TextEncoder().encode(JSON.stringify({signatureVersion:SIGNATURE_VERSION,barkDirectionZeroThreshold:BARK_DIRECTION_ZERO_THRESHOLD,growthGridStep:GROWTH_GRID_STEP,tree})));
}

/** Read-only diagnostic expansion. Includes all compact leaf prototype getters.
 * Not used to change or quantize generation; typed growth buffers are tagged.
 */
export function materializeGrowth(growth) {
  const active=new Set();
  const expand=(value,depth=0)=>{
    if(depth>90)throw Error('Growth diagnostic depth exceeded');
    if(typeof value==='number'&&!Number.isFinite(value))throw Error('Nonfinite growth diagnostic');
    if(value===null||typeof value!=='object')return value;
    if(ArrayBuffer.isView(value))return {$typedArray:value.constructor.name,values:Array.from(value)};
    if(active.has(value))throw Error('Cyclic growth diagnostic');
    active.add(value);
    try {
      if(Array.isArray(value))return Array.from(value,x=>expand(x,depth+1));
      const result={};
      for(const key of botanicalKeys(value))Object.defineProperty(result,key,{value:expand(value[key],depth+1),enumerable:true,writable:true,configurable:true});
      return result;
    } finally {active.delete(value);}
  };
  return expand(growth);
}
