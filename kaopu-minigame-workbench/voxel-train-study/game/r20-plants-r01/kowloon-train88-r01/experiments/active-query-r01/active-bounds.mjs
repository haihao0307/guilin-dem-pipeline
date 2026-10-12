// Execution-only active-ray envelope. Never a shape/material bound.
export const ACTIVE_BOUNDS_GLSL=String.raw`precision highp float;precision highp int;
uniform sampler2D inputMap;uniform ivec2 inputSize;uniform int isTrace;out vec4 value;
void main(){ivec2 origin=ivec2(gl_FragCoord.xy)*4;vec4 v=vec4(1e20,1e20,-1.,-1.);
for(int y=0;y<4;y++)for(int x=0;x<4;x++){ivec2 p=origin+ivec2(x,y);if(any(greaterThanEqual(p,inputSize)))continue;vec4 q=texelFetch(inputMap,p,0);
if(isTrace==1){if(q.w!=0.)continue;q=vec4(vec2(p),vec2(p));}
v.xy=min(v.xy,q.xy);v.zw=max(v.zw,q.zw);}value=v;}`;
export function decodeActiveBounds(v,width,height){
 if(v.length!==4||![width,height].every(x=>Number.isInteger(x)&&x>0)||Array.from(v).some(x=>!Number.isFinite(x)))throw Error('Invalid active bounds');
 if(v[2]===-1&&v[3]===-1&&v[0]>=width&&v[1]>=height)return null;
 if(Array.from(v).some(x=>!Number.isInteger(x))||v[0]<0||v[1]<0||v[2]<v[0]||v[3]<v[1]||v[2]>=width||v[3]>=height)throw Error('Malformed nonempty active bounds');
 return{x:v[0],y:v[1],w:v[2]-v[0]+1,h:v[3]-v[1]+1};
}
export function clipActiveRects(coverage,bounds){if(bounds===null)return[];return coverage.map(r=>{const x=Math.max(r.x,bounds.x),y=Math.max(r.y,bounds.y),right=Math.min(r.x+r.w,bounds.x+bounds.w),top=Math.min(r.y+r.h,bounds.y+bounds.h);return{x,y,w:right-x,h:top-y};}).filter(r=>r.w>0&&r.h>0);}
export function cpuActiveBounds(trace,width,height){if(trace.length!==width*height*4)throw Error('Wrong trace length');const r=[1e20,1e20,-1,-1];for(let i=0;i<width*height;i++)if(trace[i*4+3]===0){const x=i%width,y=Math.floor(i/width);r[0]=Math.min(r[0],x);r[1]=Math.min(r[1],y);r[2]=Math.max(r[2],x);r[3]=Math.max(r[3],y);}return decodeActiveBounds(r,width,height);}
export const rectArea=rects=>rects.reduce((n,r)=>n+r.w*r.h,0);
