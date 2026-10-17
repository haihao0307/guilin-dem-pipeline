import {sphereOffset} from './sphere-kernel.mjs';
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const dot=(a,b)=>(a[0]*b[0]+a[1]*b[1])+a[2]*b[2];
export const length=a=>Math.sqrt(dot(a,a));
export function outwardTriangleNormal(a,b,c){
 const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]);let n=cross(u,v);const l=length(n);n=n.map(x=>x/l);
 const direction=(n[0]*(a[0]+b[0]+c[0])+n[1]*(a[1]+b[1]+c[1]))+n[2]*(a[2]+b[2]+c[2]);
 if(direction<0)n=n.map(x=>-x);return n;
}
export function deterministicAtan2Nonnegative(y,x){
 if(x===0)return 1.5707963267948966;
 if(x<0)return 3.141592653589793-deterministicAtan2Nonnegative(y,-x);
 if(y>x)return 1.5707963267948966-deterministicAtan2Nonnegative(x,y);
 let r=y/x,offset=0;
 if(r>0.41421356237309503){offset=0.7853981633974483;r=(r-1)/(r+1);}
 const square=r*r;let term=r,total=r;
 for(let k=1;k<25;k++){term=term*square;const contribution=term/(2*k+1);total=k%2?total-contribution:total+contribution;}
 return offset+total;
}
export function angleWeightedNormals(frame,labels,lon,lat,triangles,shading){
 const points=[];
 for(const label of labels){const[x,y,z]=sphereOffset(1,label>>>4,label&15,lon,lat);points.push([0,3,6].map(k=>(frame[k]*x+frame[k+1]*y)+frame[k+2]*z));}
 const count=Math.max(...shading)+1,acc=Array.from({length:count},()=>[0,0,0]);
 for(let i=0;i<triangles.length;i+=3){
  const tri=[triangles[i],triangles[i+1],triangles[i+2]],n=outwardTriangleNormal(...tri.map(k=>points[k]));
  for(let corner=0;corner<3;corner++){
   const ix=tri[corner],d=points[tri[(corner+1)%3]].map((x,a)=>x-points[ix][a]),e=points[tri[(corner+2)%3]].map((x,a)=>x-points[ix][a]);
   const angle=deterministicAtan2Nonnegative(length(cross(d,e)),dot(d,e)),group=shading[ix];
   for(let axis=0;axis<3;axis++)acc[group][axis]+=n[axis]*angle;
  }
 }
 const normal=acc.map(a=>{const l=length(a);return a.map(x=>x/l);});
 const out=new Float32Array(labels.length*3);for(let i=0;i<labels.length;i++)out.set(normal[shading[i]],i*3);return out;
}
