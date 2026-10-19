/** Compact POSITION bindings. Decoder has no source POSITION input or source-file reads. */
import {wheelSurfacePoint,DEFAULT_WHEEL_RULES} from '../rules/wheel/wheel-surface-rules.mjs';
import {SPOKE_FAMILY,buildSpokeReferenceSamples,measuredSpokePoint} from '../rules/wheel/wheel-spoke-family.mjs';
import {HUB_PATCH_RULES,hubSurfacePoint} from '../rules/wheel/hub-lathe-rules.mjs';
export const POSITION_BINDING_SCHEMA='a4-wheel-position-bindings/1';
export const CATALOG_DEFINITION='r03-wheel-analytic-slots-v1';
const TAU=Math.PI*2;
const angles=Array.from({length:65},(_,j)=>({station:j-32,theta:(j-32)*TAU/64}));angles.push({station:'negative-zero',theta:-0});
let cached;
/** All slots are evaluated from dimensions/functions, never loaded position tables. */
export function createWheelPositionCatalog() {
 if(cached)return cached;
 const points=[],kinds=[],ranges=[];
 const add=(point,kind)=>{points.push(...point);kinds.push(kind);};
 let start=0;
 for(const side of[-1,1])for(let k=0;k<DEFAULT_WHEEL_RULES.profile.length;k++)for(const a of angles)add(wheelSurfacePoint(k,a.theta,side),1);
 ranges.push({kind:1,name:'wheel_meridian',start,count:kinds.length-start,order:'side [-1,+1], 30 meridian stations, angles [-32..32] plus negative-zero'});start=kinds.length;
 const samples=buildSpokeReferenceSamples(SPOKE_FAMILY);
 for(const side of[-1,1])for(const s of samples)add(measuredSpokePoint(s.index,s.e,s.phi,side,{spokeFamily:SPOKE_FAMILY,faceted:true}),2);
 ranges.push({kind:2,name:'all_measured_spokes',start,count:kinds.length-start,order:'side [-1,+1], source-free sorted family boundary samples'});start=kinds.length;
 for(const side of[-1,1])for(let k=0;k<HUB_PATCH_RULES.profile.length;k++)for(const a of angles)add(hubSurfacePoint(k,a.theta,side),3);
 ranges.push({kind:3,name:'hub_meridian',start,count:kinds.length-start,order:'side [-1,+1], 21 meridian stations, angles [-32..32] plus negative-zero'});
 cached={definition:CATALOG_DEFINITION,positions:new Float32Array(points),kinds:new Uint8Array(kinds),slotCount:kinds.length,ranges};return cached;
}
const scratch=new Float32Array(3),bits=new Uint32Array(scratch.buffer);
function key(point,offset=0){scratch[0]=point[offset];scratch[1]=point[offset+1];scratch[2]=point[offset+2];return `${bits[0]},${bits[1]},${bits[2]}`;}
/** OFFLINE encoder only: nodeResults are certified R03 output positions plus kind classifications. */
export function encodeWheelPositions(nodeResults) {
 const catalog=createWheelPositionCatalog(),lookup=new Map(),residualMap=new Map(),residual=[],codes=[],nodes=[];
 for(let i=0;i<catalog.slotCount;i++){const k=catalog.kinds[i]+':'+key(catalog.positions,3*i);if(!lookup.has(k))lookup.set(k,i);}
 let generated=0,residualVertices=0;
 for(const node of[8,9,10]) {
  const data=nodeResults[node],positions=data.positions,kinds=data.kinds,offset=codes.length;
  if(positions.length!==3*kinds.length)throw Error('BAD_CERTIFIED_POSITION_COUNT');
  for(let i=0;i<kinds.length;i++) {
   let code;
   if(kinds[i]) {
    code=lookup.get(kinds[i]+':'+key(positions,3*i));
    if(code===undefined)throw Error(`GENERATED_POINT_NOT_IN_ANALYTIC_CATALOG node=${node} vertex=${i} kind=${kinds[i]} xyz=${positions.slice(3*i,3*i+3)}`);
    generated++;
   } else {
    const k=key(positions,3*i);let index=residualMap.get(k);
    if(index===undefined){index=residual.length/3;residual.push(...positions.slice(i*3,i*3+3));residualMap.set(k,index);}
    code=catalog.slotCount+index;residualVertices++;
   }
   if(code>=65536)throw Error('UINT16_BINDING_CAPACITY_EXCEEDED');codes.push(code);
  }
  nodes.push({node,vertexCount:kinds.length,bindingOffset:offset,bindingCount:kinds.length});
 }
 return {layout:{schema:POSITION_BINDING_SCHEMA,catalogDefinition:CATALOG_DEFINITION,catalogSlotCount:catalog.slotCount,catalogRanges:catalog.ranges,nodes,residualPointCount:residual.length/3,sourcePositionBufferRequired:false},bindingCodes:new Uint16Array(codes),residualPositions:new Float32Array(residual),stats:{generatedVertices:generated,residualVertices,uniqueResidualPoints:residual.length/3}};
}
/** Pure source-free decoder: only compact integer bindings and explicitly unlearned coordinates. */
export function decodeWheelPositions(bindingCodes,residualPositions,layout) {
 if(layout.schema!==POSITION_BINDING_SCHEMA||layout.catalogDefinition!==CATALOG_DEFINITION)throw Error('UNSUPPORTED_POSITION_BINDING_SCHEMA');
 if(!(bindingCodes instanceof Uint16Array)||!(residualPositions instanceof Float32Array))throw Error('EXPECTED_UINT16_BINDINGS_FLOAT32_RESIDUAL');
 const catalog=createWheelPositionCatalog();if(catalog.slotCount!==layout.catalogSlotCount)throw Error('CATALOG_VERSION_MISMATCH');
 if(residualPositions.length!==layout.residualPointCount*3)throw Error('RESIDUAL_SIZE_MISMATCH');
 const result={};
 for(const node of layout.nodes) {
  if(node.bindingCount!==node.vertexCount||node.bindingOffset+node.bindingCount>bindingCodes.length)throw Error('BINDING_RANGE_INVALID');
  const out=new Float32Array(node.vertexCount*3);
  for(let i=0;i<node.vertexCount;i++) {
   const code=bindingCodes[node.bindingOffset+i],isRule=code<catalog.slotCount,index=isRule?code:code-catalog.slotCount,buffer=isRule?catalog.positions:residualPositions;
   if(index*3+2>=buffer.length)throw Error('BINDING_SLOT_OUT_OF_RANGE');out.set(buffer.subarray(index*3,index*3+3),i*3);
  }
  result[node.node]=out;
 }
 return result;
}
