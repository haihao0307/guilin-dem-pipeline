/** Exact primary-ray candidate scheduling for the complete comparison scene.
 * Uses the existing packed outward-rounded AABBs and shader metadata contract.
 * Sparse rows omit only instances already excluded by the existing conservative
 * tile broad phase. Original primitive order, full neighbour/ownership queries,
 * exact functions, secondary rays and dynamic-field passes are unchanged.
 * Any invalid/oversized input returns null, restoring the full original solver.
 */
import {PRIMARY_INDEX_MAGIC,MAX_PRIMARY_INDEX_RECORDS} from './primary-tile-index.mjs';
import {prepareTileFrustum,aabbIntersectsTile,transformBounds} from '../whole-building-ground-r01/tile-visibility.mjs';
const finite3=v=>v?.length===3&&Array.from(v).every(Number.isFinite);
const integer=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
export function buildPrimarySceneIndex({assemblies,frame,width,height,tileSize,token}){
 if(!Array.isArray(assemblies)||!assemblies.length||!integer(width,1,16384)||!integer(height,1,16384)||!integer(tileSize,1,256)||!integer(token,1,16777215)||frame?.width!==width||frame?.height!==height)return null;
 const tilesX=Math.ceil(width/tileSize),tilesY=Math.ceil(height/tileSize),rows=new Map(),ranges=[],indices=[];
 const tiles=[];for(let y=0;y<height;y+=tileSize)for(let x=0;x<width;x+=tileSize)tiles.push(prepareTileFrustum(frame,{x,y,width:Math.min(tileSize,width-x),height:Math.min(tileSize,height-y)}));
 for(const {archetype,instances} of assemblies){
  const bounds=archetype?.primaryBounds,count=archetype?.spec?.primitives?.length;
  if(!Array.isArray(bounds)||bounds.length!==count||!integer(count,1,96)||!Array.isArray(instances)||instances.length>32||rows.has(archetype.id))return null;
  const tileRows=[];rows.set(archetype.id,tileRows);
  const worldBounds=instances.map(i=>finite3(i.translation)?bounds.map(b=>transformBounds(b,{origin:Array.from(i.translation,Math.fround)})):null);
  for(const tile of tiles){
   const perInstance=new Map();tileRows.push(perInstance);
   for(let j=0;j<instances.length;j++){
    const instance=instances[j];if(instance.bounds&&!aabbIntersectsTile(tile,instance.bounds))continue;
    const selected=[];for(let k=0;k<count;k++)if(!worldBounds[j]||aabbIntersectsTile(tile,worldBounds[j][k]))selected.push(k);
    const row=1+ranges.length;ranges.push([indices.length,selected.length,count,token]);indices.push(...selected);perInstance.set(instance,row);
    if(1+ranges.length+indices.length>MAX_PRIMARY_INDEX_RECORDS)return null;
   }
  }
 }
 const rangeCount=ranges.length,records=1+rangeCount+indices.length;
 if(!integer(rangeCount,1,MAX_PRIMARY_INDEX_RECORDS-1))return null;
 const textureWidth=Math.min(256,2**Math.ceil(Math.log2(Math.sqrt(records)))),textureHeight=Math.ceil(records/textureWidth),data=new Float32Array(textureWidth*textureHeight*4);
 data.set([PRIMARY_INDEX_MAGIC,token,rangeCount,records]);ranges.forEach((r,k)=>data.set([1+rangeCount+r[0],...r.slice(1)],4*(1+k)));indices.forEach((k,j)=>data[4*(1+rangeCount+j)]=k+1);
 return{data,width:textureWidth,height:textureHeight,token,rows,tilesX,tilesY,records,rangeCount,indexCount:indices.length,kind:'complete-scene-sparse-primary-only'};
}
