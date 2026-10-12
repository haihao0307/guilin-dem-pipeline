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
