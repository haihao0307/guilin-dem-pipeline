/** No browser/context launch. Parent QA supplies its own authorized GL context.
 * Compile/readback orchestration belongs to the parent; these are exact GLSL
 * fixtures and checks, not a renderer and not evidence of an executed GPU test.
 */
import {buildFloorMaterialGLSL} from './material-adapter.mjs';
export const FLOOR_PROBE_VERTEX_GLSL='#version 300 es\nprecision highp float;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}';
export function buildFloorMaterialProbeShader(options={}){return `#version 300 es
precision highp float;precision highp int;
${buildFloorMaterialGLSL(options)}
uniform float uRole,uFp;uniform vec3 uPoint,uN;uniform float uObject;
layout(location=0)out vec4 a;layout(location=1)out vec4 b;layout(location=2)out vec4 c;layout(location=3)out vec4 d;
void main(){FloorMaterialSample s=sampleFloorMaterial(uRole,uPoint,uN,uFp,uObject);a=vec4(s.baseColor,s.roughness);b=vec4(s.height,s.clearcoat,s.clearcoatRoughness,s.metallic);c=vec4(s.coverageDiffuse,s.tileMask);d=vec4(s.coverageF0,s.cavity);}`;}
export const FLOOR_GPU_PROBES=Object.freeze([
 {name:'floor_face',role:10,point:[.1505,0,.1505],normal:[0,1,0],footprintM:.0001,objectId:2010,expected:{roughness:.34,tileMask:1,clearcoat:1,metallic:0,heightRangeM:[-.000033,.000033]}},
 {name:'facade_face',role:11,point:[.1005,.0255,0],normal:[0,0,1],footprintM:.0001,objectId:2011,expected:{roughness:.29,tileMask:1,clearcoat:1,metallic:0,heightRangeM:[-.000033,.000033]}},
 {name:'facade_grout',role:11,point:[0,.0255,0],normal:[0,0,1],footprintM:.0001,objectId:2011,expected:{roughness:.91,tileMask:0,clearcoat:0,metallic:0,heightRangeM:[-.001501,-.001499]}},
 {name:'wall_a',role:12,point:[.4,1.2,0],normal:[0,0,1],footprintM:.0001,objectId:2012,expected:{roughnessRange:[.6,.85],metallic:0}},
 {name:'metal_a',role:13,point:[.04,.2,.02],normal:[0,0,1],footprintM:.0001,objectId:2013,expected:{baseColor:[.035,.043,.041],roughness:.43,f0:[.04,.04,.04],metallic:0,heightRangeM:[.0001339,.0001461]}},
 {name:'door_paint',role:14,point:[.2,1.1,0],normal:[0,0,1],footprintM:.0001,objectId:2014,expected:{baseColor:[.22,.18,.12],roughnessRange:[.36,.40],metallic:0,heightRangeM:[-.0000091,.0000091]}},
 {name:'metal_b',role:13,point:[.0407,.2004,.0201],normal:[0,0,1],footprintM:.0001,objectId:2013,expected:{baseColor:[.035,.043,.041],roughness:.43,f0:[.04,.04,.04],metallic:0,heightRangeM:[.0001339,.0001461]}},
 {name:'wall_b',role:12,point:[.83,1.71,0],normal:[0,0,1],footprintM:.0001,objectId:2012,expected:{roughnessRange:[.6,.85],metallic:0}},
]);
/** Read 1x1 RGBA32F attachments 0..3 in order, no tone map or color transform. */
export function decodeFloorMaterialReadback(attachments){
 if(!Array.isArray(attachments)||attachments.length!==4||attachments.some(a=>a.length!==4||![...a].every(Number.isFinite)))throw new Error('Four finite RGBA32F attachments required');
 const[a,b,c,d]=attachments.map(a=>[...a]);return{baseColor:a.slice(0,3),roughness:a[3],height:b[0],clearcoat:b[1],clearcoatRoughness:b[2],metallic:b[3],coverageDiffuse:c.slice(0,3),tileMask:c[3],f0:d.slice(0,3),cavity:d[3]};
}
export function verifyFloorMaterialReadback(probe,attachments,{tolerance=2e-5}={}){
 const s=decodeFloorMaterialReadback(attachments),e=probe.expected;
 for(const k of ['roughness','tileMask','clearcoat','metallic'])if(e[k]!==undefined&&Math.abs(s[k]-e[k])>tolerance)throw new Error(probe.name+': '+k+' outside expected range');
 for(const k of ['baseColor','f0'])if(e[k]&&s[k].some((x,i)=>Math.abs(x-e[k][i])>tolerance))throw new Error(probe.name+': '+k+' mismatch');
 for(const [out,input]of [['height','heightRangeM'],['roughness','roughnessRange']])if(e[input]&&(s[out]<e[input][0]||s[out]>e[input][1]))throw new Error(probe.name+': '+out+' outside bound');
 return s;
}
export function verifyFloorMaterialProbeVariation(named){
 if(!named.metal_a||!named.metal_b||!named.wall_a||!named.wall_b)throw new Error('Both metal and wall sample pairs required');
 if(Math.abs(named.metal_a.height-named.metal_b.height)<1e-12)throw new Error('Original R06 microheight not varying');
 if(Math.abs(named.wall_a.baseColor[0]-named.wall_b.baseColor[0])<1e-7)throw new Error('Original plaster field not varying');
 return true;
}
