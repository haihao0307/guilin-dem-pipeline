export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),lerp=(a,b,t)=>a+(b-a)*t;
export function norm(a){let l=Math.hypot(...a)||1;return a.map(v=>v/l)}
export function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
export function look(e,c){let z=norm(e.map((v,i)=>v-c[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-x.reduce((s,v,i)=>s+v*e[i],0),-y.reduce((s,v,i)=>s+v*e[i],0),-z.reduce((s,v,i)=>s+v*e[i],0),1])}
export function perspective(fov,aspect,n,f){let t=1/Math.tan(fov/2);return new Float32Array([t/aspect,0,0,0,0,t,0,0,0,0,(f+n)/(n-f),-1,0,0,2*f*n/(n-f),0])}
export function mult(a,b){let o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o}
export async function request(url,type='json'){let r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw Error(`资源未就绪 HTTP ${r.status}: ${url}`);return type==='buffer'?r.arrayBuffer():type==='text'?r.text():r.json()}
export async function inflate(bytes){if(!globalThis.DecompressionStream)throw Error('浏览器缺少数字压缩解码接口');return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()}
