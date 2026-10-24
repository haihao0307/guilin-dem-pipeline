import {buildFloorMaterialProbeShader,FLOOR_PROBE_VERTEX_GLSL,FLOOR_GPU_PROBES} from './gpu-probe.mjs';
console.log(JSON.stringify({vertex:FLOOR_PROBE_VERTEX_GLSL,sources:{paint:buildFloorMaterialProbeShader(),wood:buildFloorMaterialProbeShader({doorFinish:'wood'})},samples:FLOOR_GPU_PROBES}));
