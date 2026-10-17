/** A rounded rectangular opening, raised frame, full reveal and interior return.
 * Circle/line analytic contours only; no source sample coordinates. */
export function addThickRoundedWindow(b,name,{side,x,z0,z1,y0,y1,radius:r,depth,frameWidth:f,projection}){
 if(![x,z0,z1,y0,y1,r,depth,f,projection].every(Number.isFinite)||r<=0||r>=Math.min(z1-z0,y1-y0)/2||depth<=0||f<=0||projection<=0)throw Error('Invalid rounded window');
 const line=(a,c,n)=>(u,d)=>({z:a[0]+(c[0]-a[0])*u+n[0]*d,y:a[1]+(c[1]-a[1])*u+n[1]*d,dz:c[0]-a[0],dy:c[1]-a[1],nz:n[0],ny:n[1]});
 const arc=(cz,cy,a0)=>(u,d)=>{const a=a0+u*Math.PI/2,co=Math.cos(a),si=Math.sin(a);return{z:cz+(r+d)*co,y:cy+(r+d)*si,dz:-(r+d)*si*Math.PI/2,dy:(r+d)*co*Math.PI/2,nz:co,ny:si};};
 const curves=[line([z0+r,y0],[z1-r,y0],[0,-1]),arc(z1-r,y0+r,-Math.PI/2),line([z1,y0+r],[z1,y1-r],[1,0]),arc(z1-r,y1-r,0),line([z1-r,y1],[z0+r,y1],[0,1]),arc(z0+r,y1-r,Math.PI/2),line([z0,y1-r],[z0,y0+r],[-1,0]),arc(z0+r,y0+r,Math.PI)];
 for(let j=0;j<8;j++){const samples=j%2?Array.from({length:13},(_,i)=>i/12):[0,1],c=curves[j];
  b.patch(`${name}-outer-frame-${j}`,(u,v)=>{const q=c(u,v*f);return{p:[side*(x+projection),q.y,q.z],du:[0,q.dy,q.dz],dv:[0,q.ny*f,q.nz*f],uv:[(j+u)/8,v]};},samples,[0,1],2,side);
  b.patch(`${name}-opening-wall-${j}`,(u,v)=>{const q=c(u,0);return{p:[side*(x+projection-(projection+depth)*v),q.y,q.z],du:[0,q.dy,q.dz],dv:[-side*(projection+depth),0,0],uv:[(j+u)/8,v]};},samples,[0,1],2,-side);
  b.patch(`${name}-frame-return-${j}`,(u,v)=>{const q=c(u,f);return{p:[side*(x+projection*(1-v)),q.y,q.z],du:[0,q.dy,q.dz],dv:[-side*projection,0,0],uv:[(j+u)/8,v]};},samples,[0,1],2,side);
  b.patch(`${name}-interior-lip-${j}`,(u,v)=>{const q=c(u,v*f);return{p:[side*(x-depth),q.y,q.z],du:[0,q.dy,q.dz],dv:[0,q.ny*f,q.nz*f],uv:[(j+u)/8,v]};},samples,[0,1],2,-side);
 }
 // Fill only the four outside-of-circle corner regions left by rectangular wall partitioning.
 const corners=[{z:z1,y:y0,j:1},{z:z1,y:y1,j:3},{z:z0,y:y1,j:5},{z:z0,y:y0,j:7}];
 for(let k=0;k<4;k++){const a=corners[k],points=Array.from({length:13},(_,i)=>{const q=curves[a.j](i/12,0);return[side*x,q.y,q.z];});b.fan(`${name}-wall-corner-${k}`,[side*x,a.y,a.z],points,[side,0,0],0);}
}
