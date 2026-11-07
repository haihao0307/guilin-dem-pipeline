/** Numerical broad-phase scheduling only. Does not change shapes or physical clipping. */
export const FLOAT32_EPSILON=2**-23;
export function assemblyEntryStart({low,high,ro,rd,eye=ro,origin=[0,0,0],boundsLo,clipLo=0}){
 let pad=0;
 if(boundsLo>0)for(let a=0;a<3;a++)if(Math.abs(rd[a])>=1e-12){
  const near=Math.min((low[a]-ro[a])/rd[a],(high[a]-ro[a])/rd[a]);
  const f=Math.fround,near32=Math.min(f(f(f(low[a])-f(ro[a]))/f(rd[a])),f(f(f(high[a])-f(ro[a]))/f(rd[a])));
  if(near===boundsLo||near32===boundsLo)pad=Math.max(pad,8*FLOAT32_EPSILON*(1+Math.abs(boundsLo)+(Math.abs(eye[a])+Math.abs(origin[a])+Math.abs(ro[a]))/Math.abs(rd[a])));
 }
 return Math.max(clipLo,0,boundsLo-pad);
}
export const ASSEMBLY_ENTRY_GUARD_GLSL=`
float assemblyEntryStart(vec3 low,vec3 high,vec3 ro,vec3 rd,vec3 eye,vec3 origin,float boundsLo,float clipLo){
 float pad=0.;
 if(boundsLo>0.)for(int a=0;a<3;a++)if(abs(rd[a])>=1e-12){
  float nearT=min((low[a]-ro[a])/rd[a],(high[a]-ro[a])/rd[a]);
  if(nearT==boundsLo)pad=max(pad,8.*1.1920929e-7*(1.+abs(boundsLo)+(abs(eye[a])+abs(origin[a])+abs(ro[a]))/abs(rd[a])));
 }
 return max(clipLo,max(0.,boundsLo-pad));
}
`;
