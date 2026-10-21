export const I=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export function mul(a,b){const c=Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)c[i*4+j]+=a[i*4+k]*b[k*4+j];return c;}
export function inv(a){const r=I(),s=a[0]**2+a[4]**2+a[8]**2;for(let i=0;i<3;i++)for(let j=0;j<3;j++)r[i*4+j]=a[j*4+i]/s;for(let i=0;i<3;i++)r[i*4+3]=-(r[i*4]*a[3]+r[i*4+1]*a[7]+r[i*4+2]*a[11]);return r;}
export const sub=(a,b)=>a.map((x,i)=>x-b[i]),add=(a,b)=>a.map((x,i)=>x+b[i]),scale=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a),unit=a=>scale(a,1/(norm(a)||1));
export const point=(m,p)=>[0,1,2].map(i=>m[i*4]*p[0]+m[i*4+1]*p[1]+m[i*4+2]*p[2]+m[i*4+3]);
export const vector=(m,p)=>[0,1,2].map(i=>m[i*4]*p[0]+m[i*4+1]*p[1]+m[i*4+2]*p[2]);
export const position=m=>[m[3],m[7],m[11]];
export function quaternionMatrix(q,pos=[0,0,0],s=1){let [x,y,z,w]=q;const n=Math.hypot(...q);x/=n;y/=n;z/=n;w/=n;return [(1-2*y*y-2*z*z)*s,(2*x*y-2*z*w)*s,(2*x*z+2*y*w)*s,pos[0],(2*x*y+2*z*w)*s,(1-2*x*x-2*z*z)*s,(2*y*z-2*x*w)*s,pos[1],(2*x*z-2*y*w)*s,(2*y*z+2*x*w)*s,(1-2*x*x-2*y*y)*s,pos[2],0,0,0,1];}
export function align(a,b){a=unit(a);b=unit(b);const c=dot(a,b);if(c>.99999999)return I();if(c<-.99999999){const v=unit(cross(a,Math.abs(a[0])<.8?[1,0,0]:[0,1,0]));return quaternionMatrix([...v,0]);}const v=cross(a,b);return quaternionMatrix([...v,1+c]);}
export function frame(forward,side){const x=unit(forward),y=unit(sub(side,scale(x,dot(side,x)))),z=cross(x,y);return[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,0,0,0,1];}
export const C=[1,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,1];
export function sourceWorld(joints){return Array.from({length:joints.length/8},(_,j)=>{const p=Array.from(joints.slice(j*8,j*8+3),x=>x/100),q=Array.from(joints.slice(j*8+3,j*8+7));return mul(C,quaternionMatrix(q,p,joints[j*8+7]));});}
