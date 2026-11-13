/** Isolated spatial scheduling: never changes the authoritative finite fields.
 * Only primary caseTraceRay candidate iteration uses this index; full ordered
 * material ownership and all neighbor burial queries keep original descriptors.
 */
import {buildHitQueryBoundedAssemblyGLSL} from './bounded-hit-query.mjs';
import {prepareTileFrustum,aabbIntersectsTile,transformBounds} from '../whole-building-ground-r01/tile-visibility.mjs';
export const PRIMARY_INDEX_MAGIC=6721349;
export const MAX_PRIMARY_INDEX_RECORDS=65536;
const finite3=v=>v?.length===3&&Array.from(v).every(Number.isFinite);
const integer=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
/** Read the SAME outward-rounded AABBs used by assemblyRayBounds. */
export function primaryPackedBounds(packed,expectedCount){
 if(!(packed?.data instanceof Float32Array)||!integer(packed.width,1,16384)||!integer(packed.height,1,16384)||packed.data.length!==packed.width*packed.height*4)return null;
 const d=packed.data,base=d[0],count=d[5];
 if(!integer(count,1,96)||count!==expectedCount||!integer(base,3,MAX_PRIMARY_INDEX_RECORDS)||d[10]!==7||(base+7*count)*4>d.length)return null;
 return Array.from({length:count},(_,k)=>{const b=4*(base+7*k);return{min:Array.from(d.slice(b+16,b+19)),max:Array.from(d.slice(b+20,b+23))};});
}
/** Once-per-frame immutable index. All indices are stable original ordinals.
 * Invalid inputs disable the index; individual bad bounds are retained.
 * The current experiment is explicitly limited by the renderer to the separate
 * evidence floor. Multi-instance rows are supported without reordering them.
 */
export function buildPrimaryTileIndex({assemblies,frame,width,height,tileSize,token}){
 if(!Array.isArray(assemblies)||!assemblies.length||!integer(width,1,4096)||!integer(height,1,4096)||!integer(tileSize,1,256)||!integer(token,1,16777215)||frame?.width!==width||frame?.height!==height)return null;
 const tilesX=Math.ceil(width/tileSize),tilesY=Math.ceil(height/tileSize),rangeCount=tilesX*tilesY*assemblies.reduce((s,a)=>s+(a.instances?.length??0),0);
 if(!integer(rangeCount,1,MAX_PRIMARY_INDEX_RECORDS-1))return null;
 const rows=new Map(),ranges=[],indices=[];
 for(const {archetype,instances}of assemblies){
  const bounds=archetype?.primaryBounds,count=archetype?.spec?.primitives?.length;
  if(!Array.isArray(bounds)||bounds.length!==count||!integer(count,1,96)||!Array.isArray(instances)||instances.length>32||rows.has(archetype.id))return null;
  const tileRows=[];rows.set(archetype.id,tileRows);
  const worldBounds=instances.map(i=>finite3(i.translation)?bounds.map(b=>transformBounds(b,{origin:Array.from(i.translation,Math.fround)})):null);
  for(let y=0;y<height;y+=tileSize)for(let x=0;x<width;x+=tileSize){
   const tile=prepareTileFrustum(frame,{x,y,width:Math.min(tileSize,width-x),height:Math.min(tileSize,height-y)}),perInstance=new Map();tileRows.push(perInstance);
   for(let j=0;j<instances.length;j++){
    const selected=[];for(let k=0;k<count;k++)if(!worldBounds[j]||aabbIntersectsTile(tile,worldBounds[j][k]))selected.push(k);
    const row=1+ranges.length,start=1+rangeCount+indices.length;ranges.push([start,selected.length,count,token]);indices.push(...selected);perInstance.set(instances[j],row);
    if(1+rangeCount+indices.length>MAX_PRIMARY_INDEX_RECORDS)return null;
   }
  }
 }
 if(ranges.length!==rangeCount)return null;
 const records=1+rangeCount+indices.length,textureWidth=Math.min(256,2**Math.ceil(Math.log2(Math.sqrt(records)))),textureHeight=Math.ceil(records/textureWidth),data=new Float32Array(textureWidth*textureHeight*4);
 data.set([PRIMARY_INDEX_MAGIC,token,rangeCount,records]);ranges.forEach((r,k)=>data.set(r,4*(1+k)));indices.forEach((k,j)=>data[4*(1+rangeCount+j)]=k+1);
 return{data,width:textureWidth,height:textureHeight,token,rows,tilesX,tilesY,records,rangeCount,indexCount:indices.length};
}
/** Every pass sets all row slots. Unavailable rows explicitly fall back. */
export function primaryTileRows(index,archetypeId,tileIndex,instances){const out=new Int32Array(32);out.fill(-1);if(index&&Array.isArray(instances)&&instances.length<=32){const rows=index.rows.get(archetypeId)?.[tileIndex];instances.forEach((i,k)=>{out[k]=rows?.get(i)??-1;});}return out;}
/** CPU mirror of shader metadata/index validation, used for corrupt-data tests.
 * null means full original list, [] means a valid empty list. */
export function readPrimaryTileList(index,row,primitiveCount,{enabled=true,primaryRay=true,token=index?.token}={}){
 if(!enabled||!primaryRay||!index||!(index.data instanceof Float32Array)||!integer(index.width,1,16384)||!integer(index.height,1,16384)||index.data.length!==index.width*index.height*4)return null;
 const d=index.data,capacity=index.width*index.height,rangeCount=d[2],records=d[3];
 if(d[0]!==PRIMARY_INDEX_MAGIC||d[1]!==token||!integer(token,1,16777215)||!integer(rangeCount,1,capacity-1)||!integer(records,rangeCount+1,capacity)||!integer(row,1,rangeCount))return null;
 const b=row*4,start=d[b],count=d[b+1];
 if(d[b+2]!==primitiveCount||d[b+3]!==token||!integer(start,rangeCount+1,records)||!integer(count,0,primitiveCount)||start+count>records)return null;
 // A full-length list can always use the original list, independent of entries.
 if(count===primitiveCount)return null;
 const out=[];let previous=-1;for(let j=0;j<count;j++){const encoded=d[(start+j)*4],k=encoded-1;if(!integer(encoded,1,primitiveCount)||k<=previous)return null;out.push(k);previous=k;}return out;
}
const TRACE_PREFIX='int count=int(assemblyRecord(1).y),base=int(assemblyRecord(0).w);for(int k=0;k<count;k++){vec3 low=';
export const PRIMARY_TILE_INDEX_GLSL=`
uniform highp sampler2D uPrimaryTileIndex;
uniform bool uPrimaryTileIndexEnabled;
uniform int uPrimaryTileIndexToken;
uniform ivec4 uPrimaryTileIndexRows[8];
int floorPrimaryCandidateInstance=-1;
vec4 floorPrimaryIndexRecord(int record){int width=textureSize(uPrimaryTileIndex,0).x;return texelFetch(uPrimaryTileIndex,ivec2(record%width,record/width),0);}
bool floorPrimaryInteger(float x,float lo,float hi){return x>=lo&&x<=hi&&floor(x)==x;}
ivec2 floorPrimaryCandidateRange(int primitiveCount){
 if(!uPrimaryTileIndexEnabled||floorPrimaryCandidateInstance<0||floorPrimaryCandidateInstance>=32)return ivec2(-1,primitiveCount);
 ivec2 size=textureSize(uPrimaryTileIndex,0);int capacity=size.x*size.y;if(capacity<2)return ivec2(-1,primitiveCount);
 vec4 head=floorPrimaryIndexRecord(0);float token=float(uPrimaryTileIndexToken);
 if(head.x!=6721349.||head.y!=token||!floorPrimaryInteger(token,1.,16777215.)||!floorPrimaryInteger(head.z,1.,float(capacity-1))||!floorPrimaryInteger(head.w,head.z+1.,float(capacity)))return ivec2(-1,primitiveCount);
 int row=uPrimaryTileIndexRows[floorPrimaryCandidateInstance/4][floorPrimaryCandidateInstance%4];if(row<1||row>int(head.z))return ivec2(-1,primitiveCount);
 vec4 range=floorPrimaryIndexRecord(row);if(range.z!=float(primitiveCount)||range.w!=token||!floorPrimaryInteger(range.x,head.z+1.,head.w)||!floorPrimaryInteger(range.y,0.,float(primitiveCount))||range.x+range.y>head.w)return ivec2(-1,primitiveCount);
 int start=int(range.x),count=int(range.y);if(count==primitiveCount)return ivec2(-1,primitiveCount);
 int previous=-1;for(int j=0;j<count;j++){float encoded=floorPrimaryIndexRecord(start+j).x;if(!floorPrimaryInteger(encoded,1.,float(primitiveCount)))return ivec2(-1,primitiveCount);int k=int(encoded)-1;if(k<=previous)return ivec2(-1,primitiveCount);previous=k;}
 return ivec2(start,count);
}
`;
export function buildPrimaryTileAssemblyGLSL(spec){
 const source=buildHitQueryBoundedAssemblyGLSL(spec);if(source.split(TRACE_PREFIX).length!==2)throw Error('Frozen primary trace candidate contract changed');
 return PRIMARY_TILE_INDEX_GLSL+source.replace(TRACE_PREFIX,'int count=int(assemblyRecord(1).y),base=int(assemblyRecord(0).w);ivec2 primaryRange=floorPrimaryCandidateRange(count);int candidateCount=primaryRange.x<0?count:primaryRange.y;for(int candidateIndex=0;candidateIndex<candidateCount;candidateIndex++){int k=primaryRange.x<0?candidateIndex:int(floorPrimaryIndexRecord(primaryRange.x+candidateIndex).x)-1;vec3 low=');
}
