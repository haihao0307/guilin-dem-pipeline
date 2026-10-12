// Execution interface only. Original grouped stationDomain, candidate recording,
// native member competition, and physical resolve functions remain unchanged.
import {RUNTIME_HEADER} from './runtime-entries.mjs';
import {extraction} from './shader-closure.mjs';
import {GEOMETRY_GROUP_NAMES, stationGeometryGroupSource} from './geometry-groups.mjs';

export const GROUP_QUERY_CONTROL_BYTES = 32;
export const GROUP_QUERY_HEADER = String.raw`
struct GroupQueryControl {offsetAndPhase:vec4<f32>,options:vec4<f32>,}
@group(0) @binding(2) var<uniform> groupQueryControl:GroupQueryControl;
@group(1) @binding(1) var previousGroupA:texture_2d<f32>;
@group(1) @binding(2) var previousGroupB:texture_2d<f32>;
@group(1) @binding(3) var previousGroupC:texture_2d<f32>;
@group(1) @binding(4) var previousGroupE:texture_2d<f32>;
@group(1) @binding(5) var fullHitA:texture_2d<f32>;
struct GroupQueryResult {
 @location(0) a:vec4<f32>,
 @location(1) b:vec4<f32>,
 @location(2) c:vec4<f32>,
 @location(3) e:vec4<f32>,
}
`;

export function groupRuntimeEntryWGSL(index) {
  if (!Number.isInteger(index) || index < 0 || index >= GEOMETRY_GROUP_NAMES.length) throw Error('Invalid station runtime group index');
  const initial = index === 0
    ? 'GroupQueryResult(vec4<f32>(10000.,0.,10000.,0.),vec4<f32>(p,0.),vec4<f32>(1.,1.,1.,0.),vec4<f32>(0.))'
    : 'GroupQueryResult(textureLoad(previousGroupA,ij,0),textureLoad(previousGroupB,ij,0),textureLoad(previousGroupC,ij,0),textureLoad(previousGroupE,ij,0))';
  return String.raw`
// Literal group ${index}: ${GEOMETRY_GROUP_NAMES[index]}. No run-time group selector.
@fragment fn stationGroupQuery(@builtin(position)pixel:vec4<f32>)->GroupQueryResult {
 let ij=vec2<i32>(pixel.xy);
 let trace=textureLoad(traceInput,ij,0);
 let ray=hostRay(pixel.xy);
 let p=ray[0]+ray[1]*trace.x+groupQueryControl.offsetAndPhase.xyz;
 var merged=${initial};
 let phase=groupQueryControl.offsetAndPhase.w;
 if((phase==0.&&trace.w!=0.)||(phase==1.&&trace.w!=1.)){return merged;}
 let mode=groupQueryControl.options.x;
 var skipRoof=mode==1.;var skipFloor=mode==2.;
 if(mode==3.){
  let full=textureLoad(fullHitA,ij,0);
  skipRoof=full.y==15.;skipFloor=full.y==17.;
  if(!skipRoof&&!skipFloor){return merged;}
 }
 // stationDomain returns this group's fully physical winner, not a nominal min.
 let h=stationDomain(p,skipRoof,skipFloor);
 let rawCount=merged.c.w+f32(stationRawCandidateCount);
 let overflow=merged.e.x!=0.||stationCandidateOverflow||rawCount>96.;
 if(h.d<merged.a.x){
  merged.a=vec4<f32>(h.d,f32(h.id),h.baseD,h.seed);
  merged.b=vec4<f32>(h.q,h.sourceSeed);
  merged.c=vec4<f32>(h.extent,rawCount);
 }
 merged.c.w=rawCount;
 merged.e=vec4<f32>(select(0.,1.,overflow),0.,0.,0.);
 if(overflow){
  merged.a=vec4<f32>(0.,999.,0.,0.);
  merged.b=vec4<f32>(p,0.);
  merged.c=vec4<f32>(1.,1.,1.,rawCount);
 }
 return merged;
}
`;
}

/** Generate one complete WGSL source; the caller owns emission and Naga compilation.
 * Pass the same original host station WGSL used by emit-geometry-groups.mjs.
 * Future compact (d,id,rawCount,overflow) output belongs at this execution boundary,
 * without altering grouped stationDomain or native material-bearing construction.
 */
export function createGroupRuntimeWGSL(source, index) {
  const entry = groupRuntimeEntryWGSL(index);
  const selected = stationGeometryGroupSource(source, index);
  const part = extraction(selected);
  const body = part.closure(['stationDomain'], RUNTIME_HEADER + GROUP_QUERY_HEADER + entry);
  return part.header + RUNTIME_HEADER + GROUP_QUERY_HEADER + body + entry;
}
