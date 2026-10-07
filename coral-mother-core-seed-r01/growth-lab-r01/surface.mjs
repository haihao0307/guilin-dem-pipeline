/* Original surface refinement for the independently computed growth mesh.
 * Standard Loop weights; shared-edge topology, not normal-only fakery.
 * Raw simulation snapshots remain unchanged and can be inspected as wireframe.
 */
export function refineSurface(snapshot,levels=2){
 let p=snapshot.positions,m=snapshot.masks,f=snapshot.indices;
 for(let level=0;level<levels;level++){
  const n=p.length/3,neighbors=Array.from({length:n},()=>new Set()),boundary=Array.from({length:n},()=>[]),edges=new Map();
  const key=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
  for(let t=0;t<f.length;t+=3){const a=f[t],b=f[t+1],c=f[t+2];for(const [i,j,k]of[[a,b,c],[b,c,a],[c,a,b]]){neighbors[i].add(j);neighbors[j].add(i);const id=key(i,j);let e=edges.get(id);if(!e){e={a:i,b:j,opposite:[],index:0};edges.set(id,e);}e.opposite.push(k);}}
  for(const e of edges.values())if(e.opposite.length===1){boundary[e.a].push(e.b);boundary[e.b].push(e.a);}
  const nextP=new Float32Array((n+edges.size)*3),nextM=new Float32Array(nextP.length);
  for(let i=0;i<n;i++)for(let q=0;q<3;q++){
   let value=p[i*3+q];if(boundary[i].length===2)value=.75*value+.125*(p[boundary[i][0]*3+q]+p[boundary[i][1]*3+q]);
   else{const k=neighbors[i].size,beta=k===3?3/16:3/(8*k);value=(1-k*beta)*value;for(const j of neighbors[i])value+=beta*p[j*3+q];}
   nextP[i*3+q]=value;nextM[i*3+q]=m[i*3+q];
  }
  let cursor=n;for(const e of edges.values()){e.index=cursor++;for(let q=0;q<3;q++){nextP[e.index*3+q]=e.opposite.length===2?3/8*(p[e.a*3+q]+p[e.b*3+q])+1/8*(p[e.opposite[0]*3+q]+p[e.opposite[1]*3+q]):(p[e.a*3+q]+p[e.b*3+q])*.5;nextM[e.index*3+q]=(m[e.a*3+q]+m[e.b*3+q])*.5;}}
  const nextF=new Uint32Array(f.length*4);let o=0;for(let t=0;t<f.length;t+=3){const a=f[t],b=f[t+1],c=f[t+2],ab=edges.get(key(a,b)).index,bc=edges.get(key(b,c)).index,ca=edges.get(key(c,a)).index;nextF.set([a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca],o);o+=12;}
  p=nextP;m=nextM;f=nextF;
 }
 return{...snapshot,positions:p,masks:m,indices:f};
}

export function thickenSurface(surface,thickness=.004){
 const p=surface.positions,f=surface.indices,n=p.length/3,normals=new Float64Array(p.length),edges=new Map();
 for(let t=0;t<f.length;t+=3){let a=f[t],b=f[t+1],c=f[t+2],ax=p[b*3]-p[a*3],ay=p[b*3+1]-p[a*3+1],az=p[b*3+2]-p[a*3+2],bx=p[c*3]-p[a*3],by=p[c*3+1]-p[a*3+1],bz=p[c*3+2]-p[a*3+2],cr=[ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx];for(const i of[a,b,c])for(let q=0;q<3;q++)normals[i*3+q]+=cr[q];for(const [i,j]of[[a,b],[b,c],[c,a]]){let key=i<j?`${i}:${j}`:`${j}:${i}`;let e=edges.get(key);if(e)e.count++;else edges.set(key,{a:i,b:j,count:1});}}
 const nextP=new Float32Array(p.length*2),nextM=new Float32Array(surface.masks.length*2);
 for(let i=0;i<n;i++){let length=Math.hypot(normals[i*3],normals[i*3+1],normals[i*3+2])||1;for(let q=0;q<3;q++){let delta=normals[i*3+q]/length*thickness*.5;nextP[i*3+q]=p[i*3+q]+delta;nextP[(i+n)*3+q]=p[i*3+q]-delta;nextM[i*3+q]=nextM[(i+n)*3+q]=surface.masks[i*3+q];}}
 const rim=[...edges.values()].filter(e=>e.count===1),nextF=new Uint32Array(f.length*2+rim.length*6);let cursor=0;
 for(let t=0;t<f.length;t+=3){const a=f[t],b=f[t+1],c=f[t+2];nextF.set([a,b,c,a+n,c+n,b+n],cursor);cursor+=6;}
 for(const {a,b}of rim){nextF.set([a,a+n,b+n,a,b+n,b],cursor);cursor+=6;}
 return{...surface,positions:nextP,masks:nextM,indices:nextF,shellThickness:thickness};
}
