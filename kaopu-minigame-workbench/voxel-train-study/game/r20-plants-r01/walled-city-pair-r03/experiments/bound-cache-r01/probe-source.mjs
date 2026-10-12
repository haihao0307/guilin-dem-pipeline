import{geometryStageWGSL}from'../../runtime/geometry-stages.mjs';
import{selectStageSource}from'../../runtime/stage-source.mjs';
export const PROBE_LAYOUT={reference:0,bounds:458752,keys:569344,points:585728,excluded:602112,comparison:610304,counters:1069056,bytes:1069088,pointCapacity:1024,geoHitBytes:64};
const boundExpression='let bound=boxD(p-center,vec3<f32>(halfW+.9,a.w*.5+.18,depth+1.));';
const common=String.raw`
struct ProbeScratch{
 reference:array<GeoHit,7168>, bounds:array<f32,27648>, keys:array<vec4<u32>,1024>,
 points:array<vec4<f32>,1024>, excludedKeys:array<vec2<u32>,1024>, comparison:array<GeoHit,7168>, counters:array<atomic<u32>,8>
}
@group(0) @binding(4) var<storage,read_write> probe:ProbeScratch;
var<private> probeContextId:u32;
fn uncachedOriginalBound(p:vec3<f32>,s:u32)->f32{
 let a=rec(s,0u);let b=rec(s,1u);let halfW=a.z*.5;let middleZ=(b.x+b.y)*.5;let depth=(b.y-b.x)*.5;
 let center=vec3<f32>(a.x,a.y+a.w*.5,middleZ);
 return boxD(p-center,vec3<f32>(halfW+.9,a.w*.5+.18,depth+1.));
}
fn referenceBound(p:vec3<f32>,s:u32)->f32{atomicAdd(&probe.counters[0],1u);return uncachedOriginalBound(p,s);}
fn boundKey(p:vec3<f32>)->vec4<u32>{return vec4<u32>(bitcast<vec3<u32>>(p),bitcast<u32>(u.eye.w));}
fn prepareBounds(p:vec3<f32>){
 let id=probeContextId;let key=boundKey(p);if(arrayLength(&worldRules)/4u!=27u||key.w==0u){return;}
 if(all(probe.keys[id]==key)){atomicAdd(&probe.counters[3],1u);return;}
 atomicAdd(&probe.counters[2],1u);
 for(var s=0u;s<27u;s++){probe.bounds[id*27u+s]=uncachedOriginalBound(p,s);atomicAdd(&probe.counters[1],1u);}
 probe.keys[id]=key;
}
fn cachedOriginalBound(p:vec3<f32>,s:u32)->f32{
 if(arrayLength(&worldRules)/4u!=27u||bitcast<u32>(u.eye.w)==0u||!all(probe.keys[probeContextId]==boundKey(p))){atomicAdd(&probe.counters[4],1u);return uncachedOriginalBound(p,s);}
 return probe.bounds[probeContextId*27u+s];
}
`;
export function createProbeStage(group,cached){
 if(!Number.isInteger(group)||group<0||group>6)throw Error('invalid group');
 let source=geometryStageWGSL(group);if(group<6){if(!source.includes(boundExpression))throw Error('original bound site changed');source=source.replace(boundExpression,`let bound=${cached?'cachedOriginalBound':'referenceBound'}(p,s);`);}
 const entry=String.raw`
@compute @workgroup_size(64) fn probeQuery(@builtin(global_invocation_id) gid:vec3<u32>){
 let id=gid.x;if(id>=u32(u.size.x)){return;}probeContextId=id;
 let p=probe.points[id].xyz;fieldCompetition=true;fieldExcludedCount=0u;
 let excluded=probe.excludedKeys[id];if(excluded.x!=4294967295u){fieldExcluded[0]=excluded;fieldExcludedCount=1u;}
 ${cached&&group===0?'prepareBounds(p);':''}
 let h=queryChunk(p,220.);fieldCompetition=false;
 probe.${cached?'comparison':'reference'}[${group}u*1024u+id]=h;
}
`;
 return selectStageSource(source+'\n'+common+'\n'+entry,['probeQuery']);
}

export function createBoundCompareStage(){return selectStageSource(geometryStageWGSL(0)+'\n'+common+String.raw`
@compute @workgroup_size(64) fn compareAllBounds(@builtin(global_invocation_id) gid:vec3<u32>){
 let id=gid.x;if(id>=u32(u.size.x)||bitcast<u32>(u.eye.w)==0u){return;}let p=probe.points[id].xyz;
 for(var s=0u;s<27u;s++){atomicAdd(&probe.counters[6],1u);if(bitcast<u32>(uncachedOriginalBound(p,s))!=bitcast<u32>(probe.bounds[id*27u+s])){atomicAdd(&probe.counters[5],1u);}}
}
`,['compareAllBounds']);}
