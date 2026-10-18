// KAOPU original implementation. Metres; all coordinates remain in the retained person's mesh space.
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export const sub=(a,b)=>a.map((v,i)=>v-b[i]);
export const mul=(a,s)=>a.map(v=>v*s);
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit=a=>{const n=Math.hypot(...a);return n>1e-12?mul(a,1/n):[0,0,1];};
export const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
export const point=(a,i)=>[a[i*3],a[i*3+1],a[i*3+2]];
export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export function random(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function headFrame(model){const L=model.eyeSurface.landmark;const left=L(36),right=L(45),origin=mix(left,right,.5),x=unit(sub(right,left));const raw=sub(L(27),L(8)),up=unit(sub(raw,mul(x,dot(raw,x))));let front=unit(cross(x,up));if(dot(front,sub(L(30),origin))<0)front=mul(front,-1);return{origin,x,up,front,project:p=>{const d=sub(p,origin);return[dot(d,x),dot(d,up),dot(d,front)];},world:q=>add(origin,add(mul(x,q[0]),add(mul(up,q[1]),mul(front,q[2]))))};}
// Binned, frontmost exact triangle query; no nearest-vertex or ellipsoid substitute.
export class SurfaceChart{
 constructor(positions,indices,frame,{mask=null,normals=null}={}){this.positions=positions;this.indices=indices;this.frame=frame;this.normals=normals;this.bounds=[-.11,.11,-.026,.073];this.nx=72;this.ny=48;this.bins=Array.from({length:this.nx*this.ny},()=>[]);this.local=new Float32Array(positions.length);for(let i=0;i<positions.length/3;i++)this.local.set(frame.project(point(positions,i)),i*3);this.triangleCount=0;
 const [xmin,xmax,ymin,ymax]=this.bounds;
 for(let k=0;k<indices.length;k+=3){const ids=[indices[k],indices[k+1],indices[k+2]];if(mask&&!ids.every(i=>mask[i]))continue;const q=ids.map(i=>point(this.local,i));if(q.some(p=>p[0]<xmin||p[0]>xmax||p[1]<ymin||p[1]>ymax||p[2]<-.035||p[2]>.08))continue;const det=(q[1][0]-q[0][0])*(q[2][1]-q[0][1])-(q[1][1]-q[0][1])*(q[2][0]-q[0][0]);if(det<1e-13)continue;
 const ax=this.cx(Math.min(...q.map(p=>p[0]))),bx=this.cx(Math.max(...q.map(p=>p[0]))),ay=this.cy(Math.min(...q.map(p=>p[1]))),by=this.cy(Math.max(...q.map(p=>p[1])));const record={ids,q};for(let y=ay;y<=by;y++)for(let x=ax;x<=bx;x++)this.bins[y*this.nx+x].push(record);this.triangleCount++;}}
 cx(x){return clamp(Math.floor((x-this.bounds[0])/(this.bounds[1]-this.bounds[0])*this.nx),0,this.nx-1);}
 cy(y){return clamp(Math.floor((y-this.bounds[2])/(this.bounds[3]-this.bounds[2])*this.ny),0,this.ny-1);}
 query(x,y){if(x<this.bounds[0]||x>this.bounds[1]||y<this.bounds[2]||y>this.bounds[3])return null;let best=null,z=-Infinity;for(const {ids,q}of this.bins[this.cy(y)*this.nx+this.cx(x)]){const[a,b,c]=q,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-14)continue;const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den,w=1-u-v;if(Math.min(u,v,w)<-1e-7)continue;const depth=u*a[2]+v*b[2]+w*c[2];if(depth>z){z=depth;best={ids,weights:[u,v,w],depth,xy:[x,y]};}}
 if(!best)return null;const p=best.ids.map(i=>point(this.positions,i));best.position=[0,1,2].map(k=>p.reduce((s,v,j)=>s+v[k]*best.weights[j],0));let n=this.normals?[0,1,2].map(k=>best.ids.reduce((s,i,j)=>s+this.normals[i*3+k]*best.weights[j],0)):cross(sub(p[1],p[0]),sub(p[2],p[0]));n=unit(n);if(dot(n,this.frame.front)<0)n=mul(n,-1);best.normal=n;return best;}
}
export function curve2(points,t){t=clamp(t);const s=t*(points.length-1),i=Math.min(points.length-2,Math.floor(s)),u=s-i,a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];return b.map((_,k)=>.5*((2*b[k])+(-a[k]+c[k])*u+(2*a[k]-5*b[k]+4*c[k]-d[k])*u*u+(-a[k]+3*b[k]-3*c[k]+d[k])*u*u*u));}
export function cubic(a,b,c,d,t){const v=1-t;return a.map((_,i)=>v*v*v*a[i]+3*v*v*t*b[i]+3*v*t*t*c[i]+t*t*t*d[i]);}
function deformedVertex(g,weights,i){const p=point(g.attributes.position.array,i);const targets=g.morphAttributes.position||[];for(let j=0;j<targets.length;j++){const w=weights?.[j]||0;if(!w)continue;const a=targets[j].array;for(let k=0;k<3;k++)p[k]+=(g.morphTargetsRelative?a[i*3+k]:a[i*3+k]-g.attributes.position.array[i*3+k])*w;}return p;}
export function anchorFrame(anchor,g,weights){const p=anchor.ids.map(i=>deformedVertex(g,weights,i)),center=[0,1,2].map(k=>p.reduce((s,v,j)=>s+v[k]*anchor.weights[j],0)),e1=unit(sub(p[1],p[0])),n=unit(cross(e1,sub(p[2],p[0]))),e2=unit(cross(n,e1));return{center,e1,e2,n};}
export function bindOffsets(hit,points,g){const a={ids:[...hit.ids],weights:[...hit.weights]},f=anchorFrame(a,g,[]);a.offsets=points.map(p=>{const d=sub(p,f.center);return[dot(d,f.e1),dot(d,f.e2),dot(d,f.n)];});return a;}
export function sampleOffsets(anchor,g,weights){const f=anchorFrame(anchor,g,weights);return anchor.offsets.map(p=>add(f.center,add(mul(f.e1,p[0]),add(mul(f.e2,p[1]),mul(f.n,p[2])))));}
export function rootErrorMM(anchor,g,weights,actual){const f=anchorFrame(anchor,g,weights);return Math.hypot(...sub(actual,f.center))*1000;}
export function visibleRim(x,y0,yHint,sign,skin,globes){let previous=y0;const outside=yHint+sign*.009,visible=y=>{const s=skin.query(x,y),e=globes.query(x,y);return !!s&&(!e||s.depth>=e.depth-.00004);};if(visible(y0))return null;for(let i=1;i<=100;i++){const y=y0+(outside-y0)*i/100;if(visible(y)){let lo=previous,hi=y;for(let k=0;k<14;k++){const m=(lo+hi)*.5;if(visible(m))hi=m;else lo=m;}return hi;}previous=y;}return null;}
