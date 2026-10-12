// Execution partition only. Frozen source equations remain in the bureau package.
import {RUNTIME_HEADER,STEP_ENTRY} from '../../../bureau-train88-r01/runtime-entries.mjs';
export {RUNTIME_HEADER,STEP_ENTRY};
export function splitOriginalStep(entry=STEP_ENTRY){
 const marker='for(var i=0u;i<u32(frame.viewport.w);i++){', start=entry.indexOf(marker);
 if(start<0||entry.indexOf(marker,start+1)!==-1)throw Error('Original step loop contract changed');
 const open=start+marker.length-1;let depth=1,end=open+1;for(;depth;end++){if(entry[end]==='{')depth++;if(entry[end]==='}')depth--;if(end>=entry.length)throw Error('Unclosed step loop');}
 const prefix=entry.slice(0,start),body=entry.slice(open+1,end-1),suffix=entry.slice(end);
 const call='let h=sceneField(ro+rd*tr.x);';if(body.split(call).length!==2)throw Error('Expected exactly one geometry query');
 if(!/^\s*return tr;\s*}\s*$/.test(suffix))throw Error('Unexpected original post-loop code');
 const advanceBody=body.replace(call,'let h=textureLoad(queryInput,vec2<i32>(pixel.xy),0);').replaceAll('h.mat','u32(h.y)').replaceAll('h.d','h.x').replaceAll('break;','return tr;').replaceAll('continue;','return tr;');
 if(/sceneField|\b(break|continue)\b/.test(advanceBody))throw Error('Unpartitioned query or loop control');
 return {init:prefix.replace('fn stepRays','fn initializeBureauRays')+'return tr;\n}',advance:'@group(1)@binding(1)var queryInput:texture_2d<f32>;\n'+prefix.replace('fn stepRays','fn advanceBureauRays')+advanceBody+suffix,body,prefix};
}
export const COMPACT_FIELD='fn compactBureauField(p:vec3<f32>)->vec4<f32>{let h=sceneField(p);return vec4<f32>(h.d,f32(h.mat),h.seed,h.wet);}\n';
export const QUERY_ENTRY=COMPACT_FIELD+String.raw`
@fragment fn queryBureauRays(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{let tr=textureLoad(traceInput,vec2<i32>(pixel.xy),0);if(tr.w!=0.){return vec4<f32>(0.);}let ray=hostRay(pixel.xy);return compactBureauField(ray[0]+ray[1]*tr.x);}
`;

export function splitOriginalGlass(original){
 const marker='for(var i=0u;i<1400u;i++){',start=original.indexOf(marker);if(start<0)throw Error('Original glass loop contract changed');const open=start+marker.length-1;let depth=1,end=open+1;for(;depth;end++){if(original[end]==='{')depth++;if(original[end]==='}')depth--;if(end>=original.length)throw Error('Unclosed glass loop');}
 const body=original.slice(open+1,end-1),call='let q=ro+rd*t;let f=sceneField(q);';if(body.split(call).length!==2)throw Error('Glass query call changed');
 let adapted=body.replace(call,'let f=textureLoad(queryInput,vec2<i32>(pixel.xy),0);').replaceAll('f.mat','u32(f.y)').replaceAll('f.d','f.x').replaceAll('start.distance','primary.x');
 for(const[from,to]of [['return Transmission(t,1u,i+1u,glassDepth);','return vec4<f32>(t,glassDepth,f32(i+1u),1.);'],['return Transmission(t,0u,i+1u,glassDepth);','return vec4<f32>(t,glassDepth,f32(i+1u),2.);'],['continue;','return vec4<f32>(t,glassDepth,f32(i+1u),select(0.,3.,i+1u>=1400u));']]){if(adapted.split(from).length!==2)throw Error('Glass control boundary changed '+from);adapted=adapted.replace(from,to);}
 if(/sceneField|Transmission\(|\bcontinue\b/.test(adapted))throw Error('Unpartitioned glass control');
 return {body,adapted,entry:GLASS_ADVANCE_HEADER+String.raw`
@fragment fn advanceBureauGlass(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{let state=textureLoad(traceInput,vec2<i32>(pixel.xy),0);if(state.w!=0.){return state;}let primary=textureLoad(primaryInput,vec2<i32>(pixel.xy),0);var t=state.x;var glassDepth=state.y;let i=u32(state.z);
`+adapted+'\nreturn vec4<f32>(t,glassDepth,f32(i+1u),select(0.,3.,i+1u>=1400u));\n}'};
}
export const GLASS_INIT=String.raw`
@fragment fn initializeBureauGlass(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{let tr=textureLoad(traceInput,vec2<i32>(pixel.xy),0);if(tr.w!=1.||tr.y!=8.){return vec4<f32>(tr.x,0.,0.,tr.w);}return vec4<f32>(tr.x+.003,0.,0.,0.);}
`;
export const GLASS_ADVANCE_HEADER='@group(1)@binding(1)var queryInput:texture_2d<f32>;\n@group(1)@binding(2)var primaryInput:texture_2d<f32>;\n';
export const GLASS_FINAL_QUERY=COMPACT_FIELD+String.raw`
@group(1)@binding(1)var primaryInput:texture_2d<f32>;
@fragment fn queryBureauGlassTerminal(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{let ij=vec2<i32>(pixel.xy);let state=textureLoad(traceInput,ij,0);let tr=textureLoad(primaryInput,ij,0);if(tr.w!=1.||tr.y!=8.||state.w!=1.||state.x>hostRayLength(pixel.xy)){return vec4<f32>(0.);}let ray=hostRay(pixel.xy);return compactBureauField(ray[0]+ray[1]*state.x);}
`;
export const GLASS_PACK=String.raw`
@group(1)@binding(1)var glassStateInput:texture_2d<f32>;
@group(1)@binding(2)var terminalQueryInput:texture_2d<f32>;
@fragment fn packBureauGlass(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{let ij=vec2<i32>(pixel.xy);let tr=textureLoad(traceInput,ij,0);if(tr.w!=1.||tr.y!=8.){return vec4<f32>(tr.x,tr.y,0.,tr.w);}let state=textureLoad(glassStateInput,ij,0);if(state.x>hostRayLength(pixel.xy)){return vec4<f32>(state.x,0.,state.y,2.);}var mat=0.;if(state.w==1.){mat=textureLoad(terminalQueryInput,ij,0).y;}return vec4<f32>(state.x,mat,state.y,state.w);}
`;
export const NORMAL_ACCUMULATE=String.raw`
@group(1)@binding(1)var transmissionInput:texture_2d<f32>;
@group(1)@binding(2)var normalAccumulator:texture_2d<f32>;
@group(1)@binding(3)var glassAccumulator:texture_2d<f32>;
struct NormalAccumulator{@location(0)primary:vec4<f32>,@location(1)glass:vec4<f32>,}
@fragment fn sampleBureauNormal(@builtin(position)pixel:vec4<f32>)->NormalAccumulator{let ij=vec2<i32>(pixel.xy);let tr=textureLoad(traceInput,ij,0);if(tr.w!=1.){return NormalAccumulator(vec4<f32>(0.),vec4<f32>(0.));}let g=textureLoad(transmissionInput,ij,0);let k=u32(frame.viewport.w);var gradient=vec3<f32>(0.);var glass=vec3<f32>(0.);if(k>0u){gradient=textureLoad(normalAccumulator,ij,0).xyz;glass=textureLoad(glassAccumulator,ij,0).xyz;}let second=k>=4u;let axes=array<vec3<f32>,4>(vec3<f32>(1.,-1.,-1.),vec3<f32>(-1.,-1.,1.),vec3<f32>(-1.,1.,-1.),vec3<f32>(1.,1.,1.));let axis=axes[k%4u];if((!second&&g.w==1.)||(second&&tr.y==8.)){let ray=hostRay(pixel.xy);let distance=select(g.x,tr.x,second);let point=ray[0]+ray[1]*distance;let d=sceneField(point+axis*.002).d;if(second){glass+=axis*d;}else{gradient+=axis*d;}}return NormalAccumulator(vec4<f32>(gradient,0.),vec4<f32>(glass,0.));}
`;
export const NORMAL_PACK=String.raw`
@group(1)@binding(1)var transmissionInput:texture_2d<f32>;
@group(1)@binding(2)var normalAccumulator:texture_2d<f32>;
@group(1)@binding(3)var glassAccumulator:texture_2d<f32>;
struct GeometryRecord{@location(0)positionDistance:vec4<f32>,@location(1)glassNormalDepth:vec4<f32>,@location(2)normalMaterial:vec4<f32>,}
@fragment fn packBureauNormals(@builtin(position)pixel:vec4<f32>)->GeometryRecord{let ij=vec2<i32>(pixel.xy);let tr=textureLoad(traceInput,ij,0);let g=textureLoad(transmissionInput,ij,0);if(tr.w!=1.){return GeometryRecord(vec4<f32>(0.),vec4<f32>(0.),vec4<f32>(0.));}let ray=hostRay(pixel.xy);let p=ray[0]+ray[1]*g.x;let gradient=textureLoad(normalAccumulator,ij,0).xyz;let glass=textureLoad(glassAccumulator,ij,0).xyz;return GeometryRecord(vec4<f32>(p,select(-1.,g.x,g.w==1.)),vec4<f32>(normalize(glass+vec3<f32>(0.,.00000001,0.)),g.z),vec4<f32>(normalize(gradient+vec3<f32>(0.,.00000001,0.)),g.y));}
`;
