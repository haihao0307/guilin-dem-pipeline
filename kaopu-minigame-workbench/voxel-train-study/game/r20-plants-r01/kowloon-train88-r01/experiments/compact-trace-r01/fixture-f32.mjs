// Exact CPU input quantization and the shader's individual f32 threshold operations.
export const f32=Math.fround;
export const quantize=values=>values.map(f32);
export const finiteGPU=values=>values.every(x=>Math.abs(f32(x))<f32(1e30));
export const projectGPU=(a,raw,overflow)=>[f32(a[0]),f32(a[1]),f32(raw),(overflow?1:0)+(finiteGPU(a)?0:2)];
export const hitEpsilon=t=>Math.max(f32(.00065),Math.min(f32(.004),f32(f32(t)*f32(.000015))));
export function adjacentPositive(value,delta){if(![0,-1,1].includes(delta)||!(value>0))throw Error('Positive one-ULP fixture required');const f=new Float32Array([value]),u=new Uint32Array(f.buffer);u[0]+=delta;return f[0];}
