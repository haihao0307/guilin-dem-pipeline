// Only compiler-generated interface syntax is adapted for Three r170 uniforms.
// Function bodies, constants, branches and floating point expressions stay exact.
export function threeFragment(source,{allowUniformFree=false}={}){
 if(!source.startsWith('#version 300 es'))throw Error('Expected Naga ES300 output');
 let count=0;const uniforms=[];const text=source.replace(/^#version 300 es\s*/, '').replace(/layout\(std140\) uniform (\w+) \{ (\w+) (\w+); \};/g,(_,block,type,name)=>{count++;uniforms.push({type,name,block});return 'uniform '+type+' '+name+';';});
 if((count<1&&!allowUniformFree)||/layout\(std140\)/.test(text))throw Error('Unsupported uniform interface');
 const samplers=[...text.matchAll(/uniform\s+(?:highp\s+)?sampler2D\s+(\w+)\s*;/g)].map(m=>m[1]);
 return{text,uniforms,samplers};
}
export const DISPATCH_VERTEX=`precision highp float;void main(){vec2 p[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));gl_Position=vec4(p[gl_VertexID],0.,1.);}`;
