import crypto from 'node:crypto';
import fs from 'node:fs';

export const TUNA_SOURCE_VARIANTS = Object.freeze({
  high: Object.freeze({
    filename: 'tuna_fish (1)(1).glb',
    sha256: '5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe',
    bytes: 58908280,
    expectedImageSize: 4096
  }),
  low: Object.freeze({
    filename: 'tuna_fish.glb',
    sha256: 'f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0',
    bytes: 6137560,
    expectedImageSize: 1024
  })
});

const COMPONENTS = Object.freeze({
  5120: {bytes:1,read:'readInt8'},
  5121: {bytes:1,read:'readUInt8'},
  5122: {bytes:2,read:'readInt16LE'},
  5123: {bytes:2,read:'readUInt16LE'},
  5125: {bytes:4,read:'readUInt32LE'},
  5126: {bytes:4,read:'readFloatLE'}
});
const TYPE_WIDTH = Object.freeze({SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16});

export function sha256(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}

export function readGlb(path){
  const bytes=fs.readFileSync(path);
  if(bytes.length<20 || bytes.toString('ascii',0,4)!=='glTF') throw new Error('not_glb');
  const version=bytes.readUInt32LE(4), declaredLength=bytes.readUInt32LE(8);
  if(version!==2 || declaredLength!==bytes.length) throw new Error('invalid_glb_header');
  let offset=12,json=null,bin=null;
  while(offset<bytes.length){
    const length=bytes.readUInt32LE(offset), type=bytes.readUInt32LE(offset+4); offset+=8;
    const payload=bytes.subarray(offset,offset+length); offset+=length;
    if(type===0x4e4f534a) json=JSON.parse(payload.toString('utf8').replace(/\0+$/,'').trim());
    if(type===0x004e4942) bin=payload;
  }
  if(!json || !bin) throw new Error('missing_glb_chunks');
  return {path,bytes,sha256:sha256(bytes),gltf:json,bin};
}

export function decodeAccessor(source,index){
  const {gltf,bin}=source;
  const accessor=gltf.accessors?.[index];
  if(!accessor || !Number.isInteger(accessor.bufferView)) throw new Error(`accessor_${index}_unsupported`);
  const view=gltf.bufferViews?.[accessor.bufferView];
  const component=COMPONENTS[accessor.componentType], width=TYPE_WIDTH[accessor.type];
  if(!view || !component || !width) throw new Error(`accessor_${index}_layout`);
  const count=accessor.count, stride=view.byteStride??component.bytes*width;
  const base=(view.byteOffset??0)+(accessor.byteOffset??0);
  const values=new Array(count);
  for(let row=0;row<count;row++){
    const item=new Array(width);
    for(let col=0;col<width;col++) item[col]=bin[component.read](base+row*stride+col*component.bytes);
    values[row]=item;
  }
  return values;
}

function maxAbsDiff(a,b){
  if(a.length!==b.length) return Infinity;
  let d=0;
  for(let i=0;i<a.length;i++){
    if(a[i].length!==b[i].length) return Infinity;
    for(let j=0;j<a[i].length;j++) d=Math.max(d,Math.abs(a[i][j]-b[i][j]));
  }
  return d;
}

export function compareVariants(high,low){
  const h=high.gltf,l=low.gltf;
  const accessorCount=Math.min(h.accessors?.length??0,l.accessors?.length??0);
  let equalAccessors=0,maxAccessorDiff=0;
  for(let i=0;i<accessorCount;i++){
    const diff=maxAbsDiff(decodeAccessor(high,i),decodeAccessor(low,i));
    if(diff===0) equalAccessors++;
    maxAccessorDiff=Math.max(maxAccessorDiff,diff);
  }
  return {
    nodesEqual:JSON.stringify(h.nodes)===JSON.stringify(l.nodes),
    meshesEqual:JSON.stringify(h.meshes)===JSON.stringify(l.meshes),
    skinsEqual:JSON.stringify(h.skins)===JSON.stringify(l.skins),
    animationsEqual:JSON.stringify(h.animations)===JSON.stringify(l.animations),
    materialsEqual:JSON.stringify(h.materials)===JSON.stringify(l.materials),
    texturesEqual:JSON.stringify(h.textures)===JSON.stringify(l.textures),
    samplersEqual:JSON.stringify(h.samplers)===JSON.stringify(l.samplers),
    accessorCountHigh:h.accessors?.length??0,
    accessorCountLow:l.accessors?.length??0,
    equalAccessors,
    maxAccessorDiff,
    geometryRigAnimationArraysExactlyEqual:equalAccessors===accessorCount && accessorCount===(h.accessors?.length??0) && accessorCount===(l.accessors?.length??0)
  };
}

function quatAngle(a,b){
  const na=Math.hypot(...a)||1,nb=Math.hypot(...b)||1;
  let dot=0; for(let i=0;i<4;i++) dot+=(a[i]/na)*(b[i]/nb);
  dot=Math.min(1,Math.max(-1,Math.abs(dot)));
  return 2*Math.acos(dot);
}

function vectorExtent(values){
  const width=values[0]?.length??0,mins=Array(width).fill(Infinity),maxs=Array(width).fill(-Infinity);
  for(const row of values) for(let i=0;i<width;i++){mins[i]=Math.min(mins[i],row[i]);maxs[i]=Math.max(maxs[i],row[i]);}
  return Math.hypot(...mins.map((v,i)=>maxs[i]-v));
}

function rotationExtent(values){
  const base=values[0]; let max=0;
  for(const q of values) max=Math.max(max,quatAngle(base,q));
  return max;
}

export function auditTunaSource(source){
  const g=source.gltf;
  const skin=g.skins?.[0];
  const joints=new Set(skin?.joints??[]);
  const animation=g.animations?.[0];
  let durationSeconds=0;
  const pathCounts={translation:0,rotation:0,scale:0,weights:0,other:0};
  const animatedNodes=new Set();
  const motion=[];
  for(const channel of animation?.channels??[]){
    const target=channel.target??{}, path=target.path;
    if(Object.hasOwn(pathCounts,path)) pathCounts[path]++; else pathCounts.other++;
    if(Number.isInteger(target.node)) animatedNodes.add(target.node);
    const sampler=animation.samplers[channel.sampler];
    const times=decodeAccessor(source,sampler.input).map(v=>v[0]);
    durationSeconds=Math.max(durationSeconds,...times);
    const values=decodeAccessor(source,sampler.output);
    const extent=path==='rotation'?rotationExtent(values):vectorExtent(values);
    motion.push({node:target.node,name:g.nodes?.[target.node]?.name??null,path,keyCount:times.length,extent});
  }
  const significantRotationCount=motion.filter(x=>x.path==='rotation' && x.extent>Math.PI/180).length;
  const significantTranslationCount=motion.filter(x=>x.path==='translation' && x.extent>1e-4).length;
  const significantScaleCount=motion.filter(x=>x.path==='scale' && x.extent>1e-4).length;
  const meshes=(g.meshes??[]).map((m,index)=>({index,name:m.name??null,primitives:(m.primitives??[]).length}));
  const materials=(g.materials??[]).map((m,index)=>({
    index,name:m.name??null,alphaMode:m.alphaMode??'OPAQUE',doubleSided:Boolean(m.doubleSided),
    baseColorAlpha:m.pbrMetallicRoughness?.baseColorFactor?.[3]??1,
    hasBaseColorTexture:Number.isInteger(m.pbrMetallicRoughness?.baseColorTexture?.index),
    hasMetallicRoughnessTexture:Number.isInteger(m.pbrMetallicRoughness?.metallicRoughnessTexture?.index),
    hasNormalTexture:Number.isInteger(m.normalTexture?.index),
    hasOcclusionTexture:Number.isInteger(m.occlusionTexture?.index)
  }));
  return {
    identity:{path:source.path,sha256:source.sha256,bytes:source.bytes.length,title:g.asset?.extras?.title??null,author:g.asset?.extras?.author??null,license:g.asset?.extras?.license??null,source:g.asset?.extras?.source??null},
    counts:{scenes:g.scenes?.length??0,nodes:g.nodes?.length??0,meshes:g.meshes?.length??0,materials:g.materials?.length??0,textures:g.textures?.length??0,images:g.images?.length??0,skins:g.skins?.length??0,joints:joints.size,animations:g.animations?.length??0,animationChannels:animation?.channels?.length??0,accessors:g.accessors?.length??0},
    animation:{name:animation?.name??null,durationSeconds,pathCounts,animatedNodeCount:animatedNodes.size,animatedJointCount:[...animatedNodes].filter(n=>joints.has(n)).length,significantRotationCount,significantTranslationCount,significantScaleCount},
    meshes,materials,motion
  };
}

function localMatrix(node){
  if(node.matrix){const m=Array.from({length:4},()=>Array(4).fill(0));for(let c=0;c<4;c++)for(let r=0;r<4;r++)m[r][c]=node.matrix[c*4+r];return m;}
  const t=node.translation??[0,0,0],s=node.scale??[1,1,1],q=node.rotation??[0,0,0,1];
  const [x,y,z,w]=q,n=x*x+y*y+z*z+w*w||1,k=2/n;
  const r=[[1-k*(y*y+z*z),k*(x*y-z*w),k*(x*z+y*w)],[k*(x*y+z*w),1-k*(x*x+z*z),k*(y*z-x*w)],[k*(x*z-y*w),k*(y*z+x*w),1-k*(x*x+y*y)]];
  return [[r[0][0]*s[0],r[0][1]*s[1],r[0][2]*s[2],t[0]],[r[1][0]*s[0],r[1][1]*s[1],r[1][2]*s[2],t[1]],[r[2][0]*s[0],r[2][1]*s[1],r[2][2]*s[2],t[2]],[0,0,0,1]];
}
function multiply(a,b){const o=Array.from({length:4},()=>Array(4).fill(0));for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)o[r][c]+=a[r][k]*b[k][c];return o;}

export function bindWorldPositions(gltf){
  const parents=new Map();
  (gltf.nodes??[]).forEach((n,i)=>(n.children??[]).forEach(c=>parents.set(c,i)));
  const cache=new Map();
  const world=i=>{if(cache.has(i))return cache.get(i);const l=localMatrix(gltf.nodes[i]);const w=parents.has(i)?multiply(world(parents.get(i)),l):l;cache.set(i,w);return w;};
  return (gltf.nodes??[]).map((_,i)=>{const m=world(i);return [m[0][3],m[1][3],m[2][3]];});
}

export const TUNA_SEMANTIC_SOURCE_MAP = Object.freeze({
  sourceRoot:[8],
  bodyCenterMerged:[13,89],
  axialAnterior:[14,15,16,17],
  axialPosterior:[90,91,92],
  jawUpper:[18],jawLower:[21],eyes:[19,20],operculaCandidate:[22,23],
  pectoralLeft:[24,25,26,27,28,29],pectoralRight:[34,35,36,37,38,39],
  pelvicLeft:[30,31,32,33],pelvicRight:[40,41,42,43],
  dorsalRayField:Array.from({length:45},(_,i)=>44+i),
  caudalUpper:[93,94,95,96],caudalLower:[97,98,99,100],
  dorsalRear:[101,102,103,104,105],analFin:[106,107,108,109]
});

export function buildNativeSemanticRig(source){
  const g=source.gltf,positions=bindWorldPositions(g);
  const sourceName=i=>g.nodes?.[i]?.name??null;
  const controls=[
    ['root',[8]],['body_center',[13,89]],['trunk_front',[14]],['trunk_anterior',[15]],['neck',[16]],['head',[17]],
    ['peduncle_0',[90]],['peduncle_1',[91]],['peduncle_2',[92]],['jaw_upper',[18]],['jaw_lower',[21]],
    ['eye_left',[19]],['eye_right',[20]],['operculum_left',[22]],['operculum_right',[23]],
    ['pectoral_left',[24,25,26,27,28,29]],['pectoral_right',[34,35,36,37,38,39]],
    ['pelvic_left',[30,31,32,33]],['pelvic_right',[40,41,42,43]],
    ['dorsal_field',Array.from({length:45},(_,i)=>44+i)],['dorsal_rear',[101,102,103,104,105]],
    ['anal_fin',[106,107,108,109]],['caudal_upper',[93,94,95,96]],['caudal_lower',[97,98,99,100]]
  ].map(([id,nodes])=>({id,sourceNodes:nodes,sourceNames:nodes.map(sourceName),bindCenters:nodes.map(n=>positions[n])}));
  const c13=positions[13],c89=positions[89],mergedCenterDistance=Math.hypot(c13[0]-c89[0],c13[1]-c89[1],c13[2]-c89[2]);
  return {
    schema:'kaopu.original-fish.semantic-rig/0.1',
    speciesBranch:'tuna',
    sourceReferenceId:'FISH-REF-002',
    sourceEvidenceTier:'N2_TRANSITIONAL_REFERENCE',
    sourceRuntimeDependency:false,
    nativeControlCount:controls.length,
    sourceJointCount:g.skins?.[0]?.joints?.length??0,
    compression:{dropScaleChannels:true,retainRootTranslationCandidate:true,mergeTwinBodyCenter:true,mergedCenterDistance},
    controls,
    acceptance:{numeric:false,motion:false,visual:false,user:false,productionReady:false}
  };
}
