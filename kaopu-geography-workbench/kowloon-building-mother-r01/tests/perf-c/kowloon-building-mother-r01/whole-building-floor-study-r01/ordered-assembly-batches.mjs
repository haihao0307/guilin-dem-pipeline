/** Submission-only experiment. Original archetypes remain distinct analytic
 * unions. Descriptor values, original primitive order and each per-instance
 * nearest-hit update are unchanged. No geometry is concatenated or welded. */
export const ASSEMBLY_BATCH_LIMIT=32;
const MAX_ATLAS_RECORDS=65536;

/** Raw Float32 pages, including their padding. Every original internal index
 * stays page-local; the shader adds the page base in assemblyRecord only. */
export function packAssemblyAtlas(archetypes){
 if(!Array.isArray(archetypes)||!archetypes.length)return null;
 const entries=new Map();let records=0;
 for(const a of archetypes){
  const p=a?.packed;
  if(typeof a?.id!=='string'||entries.has(a.id)||!(p?.data instanceof Float32Array)||!Number.isInteger(p.width)||p.width<1||!Number.isInteger(p.height)||p.height<1||p.data.length!==p.width*p.height*4)return null;
  const count=p.width*p.height;if(records+count>MAX_ATLAS_RECORDS)return null;
  entries.set(a.id,{base:records,records:count});records+=count;
 }
 const width=Math.min(256,2**Math.ceil(Math.log2(Math.sqrt(records)))),height=Math.ceil(records/width),data=new Float32Array(width*height*4);
 for(const a of archetypes)data.set(a.packed.data,entries.get(a.id).base*4);
 return{data,width,height,entries,records};
}

/** Stable append only. Keep a whole original <=32-instance group together,
 * flushing the previous batch before it if necessary. Never reorder groups,
 * instances or primitives, and never combine their union/ownership queries. */
export function orderedAssemblyBatches(groups){
 if(!Array.isArray(groups))throw Error('Ordered assembly groups required');
 const batches=[];let batch=[];
 for(const {archetype,instances}of groups){
  if(!archetype||!Array.isArray(instances)||!instances.length||instances.length>ASSEMBLY_BATCH_LIMIT)throw Error('Original assembly group must contain 1..32 instances');
  if(batch.length+instances.length>ASSEMBLY_BATCH_LIMIT){batches.push(batch);batch=[];}
  for(let sourceSlot=0;sourceSlot<instances.length;sourceSlot++)batch.push({archetype,instance:instances[sourceSlot],sourceSlot});
 }
 if(batch.length)batches.push(batch);
 return batches;
}

/** Values are rounded exactly as the original gl.uniform* Float32 inputs.
 * Primary rows now follow batch slot, but refer to the same immutable row. */
export function assemblyBatchUniforms(batch,{atlas,primaryIndex,tileIndex,modelInstances}){
 if(!Array.isArray(batch)||!batch.length||batch.length>ASSEMBLY_BATCH_LIMIT)throw Error('Bounded ordered batch required');
 const instances=new Float32Array(4*batch.length),boundsMin=new Float32Array(4*batch.length),boundsMax=new Float32Array(4*batch.length),rows=new Int32Array(32);rows.fill(-1);
 for(let k=0;k<batch.length;k++){
  const {archetype,instance}=batch[k],entry=atlas?.entries.get(archetype.id);
  if(!entry)throw Error('Missing immutable assembly descriptor page');
  instances.set([...instance.translation,instance.objectIdOffset??10000*(modelInstances.indexOf(instance)+1)],4*k);
  boundsMin.set([...archetype.spec.bounds.min,entry.base],4*k);
  boundsMax.set([...archetype.spec.bounds.max,0],4*k);
  rows[k]=primaryIndex?.rows.get(archetype.id)?.[tileIndex]?.get(instance)??-1;
 }
 return{instances,boundsMin,boundsMax,rows};
}

/** Patch only address selection and the existing per-instance wrapper. The
 * exact solver and all float expressions within each instance remain intact. */
export function buildBatchedAssemblyShader(source){
 const record='vec4 assemblyRecord(int record){int width=textureSize(assemblyDescriptors,0).x;return texelFetch(assemblyDescriptors,ivec2(record%width,record/width),0);}',
  uniforms='uniform int uInstanceCount;uniform vec4 uInstances[32];uniform vec3 uArchetypeMin,uArchetypeMax;',
  loop='for(int i=0;i<uInstanceCount;i++){floorPrimaryCandidateInstance=uRayMode==0?i:-1;';
 for(const token of [record,uniforms,loop])if(source.split(token).length!==2)throw Error('Frozen assembly batching contract changed');
 return source.replace(record,'int floorAssemblyDescriptorBase=0;\n'+record.replace('int width=', 'record+=floorAssemblyDescriptorBase;int width='))
  .replace(uniforms,'uniform int uInstanceCount;uniform vec4 uInstances[32];uniform vec4 uArchetypeBoundsMin[32],uArchetypeBoundsMax[32];')
  .replace(loop,loop+'floorAssemblyDescriptorBase=int(uArchetypeBoundsMin[i].w);vec3 uArchetypeMin=uArchetypeBoundsMin[i].xyz,uArchetypeMax=uArchetypeBoundsMax[i].xyz;');
}
