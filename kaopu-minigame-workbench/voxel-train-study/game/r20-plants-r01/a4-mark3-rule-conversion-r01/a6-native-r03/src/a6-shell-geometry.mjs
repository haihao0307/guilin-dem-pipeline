/** First-party native mesh helpers; no I/O, model assets, residuals or renderer. */
export const add=(a,b)=>a.map((x,i)=>x+b[i]);
export const sub=(a,b)=>a.map((x,i)=>x-b[i]);
export const mul=(a,s)=>a.map(x=>x*s);
export const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit=a=>{const n=Math.hypot(...a);if(!Number.isFinite(n)||n<1e-13)throw new Error('Degenerate authored derivative');return mul(a,1/n);};
export const range=(a,b,n)=>Array.from({length:n+1},(_,i)=>a+(b-a)*i/n);
export const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
export const smoothD=t=>t<=0||t>=1?0:30*t*t*(t-1)*(t-1);
export class A6Mesh {
  constructor(name,material,category,metadata={}){Object.assign(this,{name,material,category,metadata,positions:[],normals:[],uvs:[],indices:[]});}
  vertex(p,n,uv){if(!p.every(Number.isFinite)||!uv.every(Number.isFinite))throw new Error('Nonfinite native geometry');const id=this.positions.length/3;this.positions.push(...p);this.normals.push(...unit(n));this.uvs.push(...uv);return id;}
  triangle(points,normals,uvs){const geom=cross(sub(points[1],points[0]),sub(points[2],points[0]));if(Math.hypot(...geom)<1e-12)return;let ids=points.map((p,i)=>this.vertex(p,normals[i],uvs[i]));if(dot(geom,normals.reduce(add,[0,0,0]))<0)ids=[ids[0],ids[2],ids[1]];this.indices.push(...ids);}
  quad(samples){this.triangle([samples[0].point,samples[1].point,samples[2].point],[samples[0].normal,samples[1].normal,samples[2].normal],[samples[0].uv,samples[1].uv,samples[2].uv]);this.triangle([samples[0].point,samples[2].point,samples[3].point],[samples[0].normal,samples[2].normal,samples[3].normal],[samples[0].uv,samples[2].uv,samples[3].uv]);}
  finish(){return {name:this.name,material:this.material,category:this.category,metadata:this.metadata,positions:Float32Array.from(this.positions),normals:Float32Array.from(this.normals),uvs:Float32Array.from(this.uvs),indices:Uint32Array.from(this.indices),materialGroups:[{start:0,count:this.indices.length,materialIndex:0}],uvUnits:'design-metres'};}
}
export function grid(mesh,evaluate,us,vs){for(let i=0;i<us.length-1;i++)for(let j=0;j<vs.length-1;j++)mesh.quad([evaluate(us[i],vs[j]),evaluate(us[i+1],vs[j]),evaluate(us[i+1],vs[j+1]),evaluate(us[i],vs[j+1])]);}
export function boundsOf(parts){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const part of parts)for(let i=0;i<part.positions.length;i+=3)for(let j=0;j<3;j++){min[j]=Math.min(min[j],part.positions[i+j]);max[j]=Math.max(max[j],part.positions[i+j]);}return {min,max,size:max.map((x,i)=>x-min[i])};}
