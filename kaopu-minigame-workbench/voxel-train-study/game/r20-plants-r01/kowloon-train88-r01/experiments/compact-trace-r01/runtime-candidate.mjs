import{GROUP_QUERY_HEADER}from'../../group-runtime.mjs';import{RUNTIME_HEADER}from'../../runtime-entries.mjs';import{extraction}from'../../shader-closure.mjs';import{GEOMETRY_GROUP_NAMES,stationGeometryGroupSource}from'../../geometry-groups.mjs';import{createGroupedRayStages}from'../../group-ray-stages.mjs';
export const COMPACT_MERGE_WGSL=String.raw`
fn mergeCompactTrace(previous:vec4<f32>,a:vec4<f32>,raw:f32,localOverflow:bool)->vec4<f32>{
 var merged=previous;let rawCount=previous.z+raw;
 let overflow=(u32(previous.w)&1u)!=0u||localOverflow||rawCount>96.;
 if(a.x<merged.x){merged.x=a.x;merged.y=a.y;merged.w=select(0.,2.,!all(abs(a)<vec4<f32>(1e30)));}
 merged.z=rawCount;if(overflow){return vec4<f32>(0.,999.,rawCount,1.);}return merged;
}
`;
export function compactRuntimeEntry(index){if(!Number.isInteger(index)||index<0||index>=12)throw Error('Invalid canonical group');return String.raw`
@fragment fn stationCompactQuery(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{
 let ij=vec2<i32>(pixel.xy);let trace=textureLoad(traceInput,ij,0);
 let ray=hostRay(pixel.xy);let p=ray[0]+ray[1]*trace.x+groupQueryControl.offsetAndPhase.xyz;
 var merged=${index===0?'vec4<f32>(10000.,0.,0.,0.)':'textureLoad(previousGroupA,ij,0)'};
 let phase=groupQueryControl.offsetAndPhase.w;
 if((phase==0.&&trace.w!=0.)||(phase==1.&&trace.w!=1.)){return merged;}
 let mode=groupQueryControl.options.x;var skipRoof=mode==1.;var skipFloor=mode==2.;
 if(mode==3.){let full=textureLoad(fullHitA,ij,0);skipRoof=full.y==15.;skipFloor=full.y==17.;if(!skipRoof&&!skipFloor){return merged;}}
 let h=stationDomain(p,skipRoof,skipFloor);
 return mergeCompactTrace(merged,vec4<f32>(h.d,f32(h.id),h.baseD,h.seed),f32(stationRawCandidateCount),stationCandidateOverflow);
}
`;}
export function createCompactGroupRuntimeWGSL(source,index){const selected=stationGeometryGroupSource(source,index),part=extraction(selected),entry=compactRuntimeEntry(index);return part.header+RUNTIME_HEADER+GROUP_QUERY_HEADER+part.closure(['stationDomain'],RUNTIME_HEADER+GROUP_QUERY_HEADER+entry)+COMPACT_MERGE_WGSL+entry;}
function replaceOnce(source,before,after){if(source.split(before).length!==2)throw Error('Original advance contract changed');return source.replace(before,after);}
export function createCompactAdvanceWGSL(source){let code=createGroupedRayStages(source)['group-advance'].source;
 code=replaceOnce(code,'let h=HitField(a.x,u32(a.y),p,a.w,a.z,vec3<f32>(1.),0.);','let h=HitField(a.x,u32(a.y),p,0.,0.,vec3<f32>(1.),0.);');
 code=replaceOnce(code,'h.id==999u||!all(abs(a)<vec4<f32>(1e30))','h.id==999u||a.w!=0.||!all(abs(a.xy)<vec2<f32>(1e30))');
 code=replaceOnce(code,'alternate.y==999.||!all(abs(alternate)<vec4<f32>(1e30))','alternate.y==999.||alternate.w!=0.||!all(abs(alternate.xy)<vec2<f32>(1e30))');
 return code;
}
