/** Pure browser/Node field decoder. No fetching, filesystem, teacher fallback, or implicit rod changes. */
export const FULL_STUDENT_SCHEMA='a4-student-full-payload/1';
const TYPES={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
const WIDTH={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
const ATTR={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',indices:'index'};
export async function sha256(bytes){if(!(bytes instanceof Uint8Array))throw Error('BYTES_REQUIRED');return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function verifyBytes(bytes,length,hash,label='resource'){if(!(bytes instanceof Uint8Array)||bytes.byteLength!==length)throw Error('LENGTH_MISMATCH '+label);if(await sha256(bytes)!==hash)throw Error('SHA256_MISMATCH '+label);return bytes;}
function validateManifest(m){
 if(m?.schema!==FULL_STUDENT_SCHEMA||m.byteOrder!=='little-endian'||!Array.isArray(m.fields)||m.fields.length!==942)throw Error('UNSUPPORTED_FULL_STUDENT_MANIFEST');
 if(m.gltf?.nodes?.length!==331||m.gltf?.meshes?.length!==200||m.gltf?.animations?.length!==1||m.gltf.animations[0].channels.length!==71)throw Error('INCOMPLETE_SOURCE_SCENE_DEFINITIONS');
 if(!m.providers?.wheel||!Array.isArray(m.providers.wheel.accessors)||m.providers.wheel.accessors.length!==12)throw Error('WHEEL_PROVIDER_REQUIRED');
 const unique=new Set(m.providers.wheel.accessors);if(unique.size!==12)throw Error('DUPLICATE_WHEEL_ACCESSOR');
 for(const id of unique)if(m.fields[id]?.storage?.kind!=='wheel')throw Error('WHEEL_FIELD_IN_FALLBACK '+id);
 const wheelBindings=new Map();for(const node of [8,9,10]){const p=m.gltf.meshes[m.gltf.nodes[node].mesh]?.primitives?.[0];if(!p)throw Error('MISSING_WHEEL_PRIMITIVE');for(const [attribute,id]of Object.entries(p.attributes))wheelBindings.set(id,{node,attribute});wheelBindings.set(p.indices,{node,attribute:'indices'});}
 if(wheelBindings.size!==12)throw Error('INVALID_WHEEL_PRIMITIVE_FIELDS');for(const[id,b]of wheelBindings){const s=m.fields[id]?.storage;if(!unique.has(id)||s?.kind!=='wheel'||s.node!==b.node||s.attribute!==b.attribute)throw Error('WHEEL_BINDING_MISMATCH '+id);}
 const rivetIds=new Set(m.providers.rivet?.accessors||[]);if(rivetIds.size!==(m.providers.rivet?.accessors||[]).length)throw Error('DUPLICATE_RIVET_ACCESSOR');
 for(const f of m.fields){if(f.storage?.kind==='wheel'&&!unique.has(f.accessor))throw Error('UNDECLARED_WHEEL_FIELD');if(f.storage?.kind==='rivet'){const s=f.storage,p=m.gltf.meshes[m.gltf.nodes[s.node]?.mesh]?.primitives?.[0];if(!rivetIds.has(f.accessor)||s.attribute!=='POSITION'||p?.attributes?.POSITION!==f.accessor)throw Error('RIVET_BINDING_MISMATCH '+f.accessor);}}
 for(const id of m.providers.rivet?.accessors||[])if(m.fields[id]?.storage?.kind!=='rivet')throw Error('RIVET_FIELD_IN_FALLBACK '+id);
}
export async function assembleFallbackChunks(manifest,decodedChunks){
 validateManifest(manifest);const f=manifest.fallback;if(!Array.isArray(decodedChunks)||decodedChunks.length!==f.chunks.length)throw Error('FALLBACK_CHUNK_COUNT');
 const out=new Uint8Array(f.decodedBytes);let offset=0;
 for(let i=0;i<f.chunks.length;i++){const q=f.chunks[i];if(q.decodedOffset!==offset||!Number.isSafeInteger(q.decodedBytes)||q.decodedBytes<=0)throw Error('INVALID_CHUNK_LAYOUT '+i);const b=await verifyBytes(decodedChunks[i],q.decodedBytes,q.decodedSHA256,'fallback chunk '+i);out.set(b,offset);offset+=b.byteLength;}
 if(offset!==out.byteLength)throw Error('INCOMPLETE_FALLBACK');return verifyBytes(out,f.decodedBytes,f.decodedSHA256,'assembled fallback');
}
function providerArray(record,wheelGeometries,rivetPositions){
 const s=record.storage;
 if(s.kind==='wheel'){const a=wheelGeometries?.[s.node]?.[ATTR[s.attribute]];if(!a)throw Error('MISSING_WHEEL_FIELD '+record.accessor);return a;}
 if(s.kind==='rivet'){if(s.attribute!=='POSITION')throw Error('UNEXPECTED_RIVET_ATTRIBUTE');const a=rivetPositions?.[s.node];if(!a)throw Error('MISSING_RIVET_POSITION '+record.accessor);return a;}
 throw Error('UNKNOWN_FIELD_STORAGE '+s.kind);
}
export async function decodeStudentFields(manifest,{fallbackBytes,wheelGeometries,rivetPositions={}}={}){
 validateManifest(manifest);await verifyBytes(fallbackBytes,manifest.fallback.decodedBytes,manifest.fallback.decodedSHA256,'fallback');
 const fieldBytes=[];
 for(const [i,f]of manifest.fields.entries()){
  if(f.accessor!==i||!f.definition||!f.storage)throw Error('INVALID_FIELD_RECORD '+i);const Type=TYPES[f.definition.componentType],width=WIDTH[f.definition.type];
  if(!Type||!width||!Number.isSafeInteger(f.definition.count)||f.definition.count<0||f.byteLength!==f.definition.count*width*Type.BYTES_PER_ELEMENT)throw Error('INVALID_FIELD_DEFINITION '+i);
  let b;if(f.storage.kind==='fallback'){
   const o=f.storage.offset,n=f.storage.byteLength;if(!Number.isSafeInteger(o)||o<0||n!==f.byteLength||o+n>fallbackBytes.byteLength)throw Error('INVALID_FALLBACK_RANGE '+i);b=fallbackBytes.subarray(o,o+n);
  }else{const a=providerArray(f,wheelGeometries,rivetPositions);if(!(a instanceof Type)||a.byteLength!==f.byteLength)throw Error('PROVIDER_TYPE_OR_LENGTH '+i);b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);}
  fieldBytes.push(b);
 }
 // Bounded parallel hashing avoids thousands of serialized browser round-trips.
 for(let k=0;k<fieldBytes.length;k+=24)await Promise.all(fieldBytes.slice(k,k+24).map((b,j)=>verifyBytes(b,manifest.fields[k+j].byteLength,manifest.fields[k+j].decodedSHA256,'accessor '+(k+j))));
 return {fieldBytes,fieldCount:fieldBytes.length,teacherFilesRead:false,rodPostprocessingApplied:false};
}
/** Repack field bytes into a GLTF-ready buffer without changing accessor index or scene definitions. */
export function packDecodedFields(manifest,fieldBytes){
 validateManifest(manifest);if(fieldBytes.length!==manifest.fields.length)throw Error('INCOMPLETE_FIELD_ARRAY');let bytes=0;const offsets=[];
 for(const [i,b]of fieldBytes.entries()){if(!(b instanceof Uint8Array)||b.byteLength!==manifest.fields[i].byteLength)throw Error('INVALID_PACK_FIELD '+i);bytes=(bytes+3)&~3;offsets.push(bytes);bytes+=b.byteLength;}
 const binary=new Uint8Array(bytes);for(let i=0;i<fieldBytes.length;i++)binary.set(fieldBytes[i],offsets[i]);
 return {binary,bufferViews:fieldBytes.map((b,i)=>({buffer:0,byteOffset:offsets[i],byteLength:b.byteLength})),accessors:manifest.fields.map((f,i)=>({...f.definition,bufferView:i,byteOffset:0}))};
}
