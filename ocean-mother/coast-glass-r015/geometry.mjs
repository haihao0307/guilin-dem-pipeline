import {TAU,normalize3,bedHeight,DOMAIN,COAST_ROCKS} from './core.mjs';
export function rockGeometry(definitions){
 const vertices=[],indices=[];let inverted=0,degenerate=0;
 for(const [cx,cz,sx,sy,sz,seed] of definitions){
  const base=vertices.length/7,cy=bedHeight(cx,cz)+sy*.30,lat=20,lon=40;
  const rotation=seed*.671;
  function pt(ux,uy,uz){
   // Broad fracture planes, with bounded coherent relief. Star-shaped, sealed volume.
   let radius=1;
   for(let k=0;k<13;k++){
    const a=k*2.39996+rotation,y=k<9?.28*Math.sin(k*3.13+seed):(k%2===0?1.7:-1.4),n=normalize3([Math.cos(a),y,Math.sin(a)]);
    const d=ux*n[0]+uy*n[1]+uz*n[2],plane=.77+.10*Math.sin(seed+k*4.7);
    if(d>0)radius=Math.min(radius,plane/d);
   }
   radius*=1+.035*Math.sin(ux*8+uy*5+seed)*Math.sin(uz*9-uy*4+seed*.4);
   return[cx+ux*sx*radius,cy+uy*sy*radius*(uy<0?.78:1),cz+uz*sz*radius];
  }
  function push(u){vertices.push(...pt(...u),0,0,0,1)}
  push([0,1,0]);
  for(let j=1;j<lat;j++)for(let i=0;i<lon;i++){const t=j/lat*Math.PI,a=i/lon*TAU;push([Math.sin(t)*Math.cos(a),Math.cos(t),Math.sin(t)*Math.sin(a)])}
  const bottom=vertices.length/7;push([0,-1,0]);
  function tri(a,b,c){
   const A=vertices.slice(a*7,a*7+3),B=vertices.slice(b*7,b*7+3),C=vertices.slice(c*7,c*7+3);
   let ux=B[0]-A[0],uy=B[1]-A[1],uz=B[2]-A[2],vx=C[0]-A[0],vy=C[1]-A[1],vz=C[2]-A[2];
   let n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
   const radial=[(A[0]+B[0]+C[0])/3-cx,(A[1]+B[1]+C[1])/3-cy,(A[2]+B[2]+C[2])/3-cz];
   if(n[0]*radial[0]+n[1]*radial[1]+n[2]*radial[2]<0){[b,c]=[c,b];n=n.map(x=>-x);inverted++}
   if(Math.hypot(...n)<1e-10){degenerate++;return}
   indices.push(a,b,c);for(const id of [a,b,c])for(let k=0;k<3;k++)vertices[id*7+3+k]+=n[k];
  }
  for(let i=0;i<lon;i++)tri(base,base+1+i,base+1+(i+1)%lon);
  for(let j=0;j<lat-2;j++)for(let i=0;i<lon;i++){const a=base+1+j*lon+i,b=base+1+j*lon+(i+1)%lon,c=a+lon,d=b+lon;tri(a,c,b);tri(b,c,d)}
  for(let i=0;i<lon;i++)tri(bottom,base+1+(lat-2)*lon+(i+1)%lon,base+1+(lat-2)*lon+i);
 }
 for(let i=0;i<vertices.length;i+=7){const n=normalize3(vertices.slice(i+3,i+6));vertices.splice(i+3,3,...n)}
 return{data:new Float32Array(vertices),indices:new Uint32Array(indices),windingCorrections:inverted,degenerate};
}
export function compileRockHeight(geometry,w=256,h=224){
 const top=new Float32Array(w*h);top.fill(-64);const {data:d,indices:ix}=geometry;
 // Rasterize the actual solid triangles into an ephemeral numeric height field.
 for(let n=0;n<ix.length;n+=3){
  const v=[ix[n],ix[n+1],ix[n+2]].map(i=>[d[i*7],d[i*7+1],d[i*7+2]]);
  const g=v.map(p=>[(p[0]-DOMAIN.minX)/DOMAIN.width*(w-1),(p[2]-DOMAIN.minZ)/DOMAIN.depth*(h-1)]);
  const den=(g[1][1]-g[2][1])*(g[0][0]-g[2][0])+(g[2][0]-g[1][0])*(g[0][1]-g[2][1]);if(Math.abs(den)<1e-8)continue;
  for(let y=Math.max(0,Math.floor(Math.min(...g.map(p=>p[1]))));y<=Math.min(h-1,Math.ceil(Math.max(...g.map(p=>p[1]))));y++)
   for(let x=Math.max(0,Math.floor(Math.min(...g.map(p=>p[0]))));x<=Math.min(w-1,Math.ceil(Math.max(...g.map(p=>p[0]))));x++){
    const a=((g[1][1]-g[2][1])*(x-g[2][0])+(g[2][0]-g[1][0])*(y-g[2][1]))/den,b=((g[2][1]-g[0][1])*(x-g[2][0])+(g[0][0]-g[2][0])*(y-g[2][1]))/den,c=1-a-b;
    if(Math.min(a,b,c)>=-1e-5)top[y*w+x]=Math.max(top[y*w+x],a*v[0][1]+b*v[1][1]+c*v[2][1]);
   }
 }
 return{top,w,h,sample(x,z){const i=Math.round((x-DOMAIN.minX)/DOMAIN.width*(w-1)),j=Math.round((z-DOMAIN.minZ)/DOMAIN.depth*(h-1));return i<0||i>=w||j<0||j>=h?-64:top[j*w+i]}};
}
