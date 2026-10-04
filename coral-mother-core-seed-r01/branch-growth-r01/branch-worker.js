/* Video-guided reconstruction; parameters are fitted, not the undisclosed Cinema4D scene. */
'use strict';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const norm=p=>{const l=Math.hypot(...p)||1;return p.map(v=>v/l)},add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,t)=>a.map(v=>v*t);
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const rnd=n=>{const s=Math.sin(n*127.17+311.73)*43758.5453;return s-Math.floor(s)};
function rot(v,z,x){let c=Math.cos(z),s=Math.sin(z),q=[c*v[0]-s*v[1],s*v[0]+c*v[1],v[2]];c=Math.cos(x);s=Math.sin(x);return norm([q[0],q[1]*c-q[2]*s,q[1]*s+q[2]*c])}
function blueprint(p){
 const out=[],ang=p.angle*Math.PI/180,dep=clamp(p.depth,2,5),spread=p.spatial;
 function bud(start,dir,len,rad,level,root,path,parent){
  const id=out.length,turn=(rnd(path*13+root)-.5)*.08;
  const bend=norm([dir[0]+turn,dir[1],dir[2]+(rnd(path+12)-.5)*.18*spread]);
  const end=add(start,mul(bend,len));out.push({id,parent,root,path,level,start,end,dir,bend,len,rad});
  if(level>=dep)return;
  const count=level===0?(root===2?5:2):(level<3?3:2),fan=level===0?1.10:level===1?.85:.72;
  for(let k=0;k<count;k++){
   let a=(k-(count-1)/2)*ang*fan+(rnd(path*31+k)-.5)*.09;if(level===0){if(root===0)a=k===0?.72:-.05;else if(root===1)a=k===0?-.98:.06;else a=-1.75+k*1.15;}a*=p.angle/37;
   const tilt=(rnd(path*67+k*5)-.5)*.54*spread+(k-(count-1)/2)*.12*spread;
   const d=rot(bend,a,tilt);let lengthFactor=level===0?(root===2?1.65:(k===0?.77:1.05)):.69;
   bud(end,d,len*lengthFactor*(.92+.16*rnd(path*17+k)),rad*(level<2?.76:.73),level+1,root,path*5+k+1,id);
  }
 }
 const seeds=[{a:[-.60,-.43,.06],d:[.12,1,.04],l:.54,r:.124},{a:[.15,-.55,-.02],d:[.24,1,-.06],l:.54,r:.132},{a:[-.55,-.67,.13],d:[.75,-.45,.12],l:.21,r:.112}];
 seeds.forEach((s,i)=>bud(s.a,norm(s.d),s.l,s.r,0,i,i+1,-1));return out;
}
function branchSegments(nodes,p){
 const t=p.growth/100*(p.depth+1.05),seg=[],lines=[];let active=0,tips=0;
 for(const n of nodes){const age=t-n.level;if(age<=0&&n.level>0)continue;
  const f=clamp(age/.85),smooth=f*f*(3-2*f),grow=n.level===0?Math.max(.035,smooth):smooth;
  if(grow<.001)continue;active++;
  const mature=clamp((age+.35)/1.5),radius=n.rad*(.70+.30*mature)*p.thickness;let last=n.start;
  for(let j=1;j<=3;j++){
   const u=grow*j/3,curve=mix(n.dir,n.bend,u),pt=add(n.start,mul(curve,n.len*u));
   const r0=radius*(.68+.44*(u-grow/3)),r1=radius*(.68+.44*u);
   seg.push({a:last,b:pt,r0,r1,root:n.root,level:n.level/(p.depth||1),tip:u,u0:u-grow/3,terminal:(age<1.05||n.level===p.depth)?1:.1});
   lines.push(...last,...pt);last=pt;
  }
  if(age<1.04||n.level===p.depth)tips++;
 }
 return {seg,lines,active,tips};
}
function mesh(p){
 const start=performance.now(),nodes=blueprint(p),{seg,lines,active,tips}=branchSegments(nodes,p),flatten=.70;
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(const n of nodes)for(const pt of [n.start,n.end])for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],pt[k]-.30);hi[k]=Math.max(hi[k],pt[k]+.30)}
 const side=Math.max(...hi.map((v,k)=>v-lo[k])),step=side/(p.resolution||126);
 const N=hi.map((v,k)=>Math.ceil((v-lo[k])/step)+1),[nx,ny,nz]=N,plane=nx*ny,total=plane*nz;
 if(total>3800000)throw Error('Mesh resolution budget exceeded');
 const F=new Float32Array(total);F.fill(20);const tipField=new Float32Array(total),levelField=new Float32Array(total);
 for(const s of seg){
  const k=Math.min(.038*p.thickness,.6*Math.max(s.r0,s.r1)),rr=Math.max(s.r0,s.r1)+k*1.1+step*3,d=s.b.map((v,i)=>v-s.a[i]);d[2]/=flatten;
  const length2=d.reduce((v,x)=>v+x*x,0),mn=s.a.map((v,i)=>Math.max(0,Math.floor((Math.min(v,s.b[i])-rr-lo[i])/step))),mx=s.a.map((v,i)=>Math.min(N[i]-1,Math.ceil((Math.max(v,s.b[i])+rr-lo[i])/step)));
  for(let z=mn[2];z<=mx[2];z++){const qz=(lo[2]+z*step-s.a[2])/flatten;
   for(let y=mn[1];y<=mx[1];y++){const qy=lo[1]+y*step-s.a[1];let idx=z*plane+y*nx+mn[0];
    for(let x=mn[0];x<=mx[0];x++,idx++){
     const qx=lo[0]+x*step-s.a[0],h=length2>1e-12?clamp((qx*d[0]+qy*d[1]+qz*d[2])/length2):0;
     const dist=Math.hypot(qx-h*d[0],qy-h*d[1],qz-h*d[2])-(s.r0+(s.r1-s.r0)*h);if(dist>rr)continue;
     const old=F[idx],blend=clamp(.5+.5*(dist-old)/k);
     tipField[idx]=tipField[idx]*blend+((s.u0+(s.tip-s.u0)*h)*s.terminal)*(1-blend);levelField[idx]=levelField[idx]*blend+s.level*(1-blend);
     F[idx]=dist+(old-dist)*blend-k*blend*(1-blend);
    }
   }
  }
 }
 const gradients=new Float32Array(total*3);
 for(let z=1;z<nz-1;z++)for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){
  const i=x+y*nx+z*plane;if(Math.abs(F[i])>step*2.5)continue;
  const dx=F[i+1]-F[i-1],dy=F[i+nx]-F[i-nx],dz=F[i+plane]-F[i-plane],n=Math.hypot(dx,dy,dz)||1;
  gradients[i*3]=dx/n;gradients[i*3+1]=dy/n;gradients[i*3+2]=dz/n;
 }
 const pos=[],nor=[],info=[],offsets=[0,1,nx+1,nx,plane,plane+1,plane+nx+1,plane+nx],corner=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];let vertices=0;
 function crossVertex(a,b,ids,x,y,z){
  const ia=ids[a],ib=ids[b],u=clamp(F[ia]/(F[ia]-F[ib])),ca=corner[a],cb=corner[b];
  const q=[lo[0]+(x+ca[0]+(cb[0]-ca[0])*u)*step,lo[1]+(y+ca[1]+(cb[1]-ca[1])*u)*step,lo[2]+(z+ca[2]+(cb[2]-ca[2])*u)*step];
  const n=norm([0,1,2].map(k=>gradients[ia*3+k]*(1-u)+gradients[ib*3+k]*u));
  return {q,n,t:tipField[ia]*(1-u)+tipField[ib]*u,l:levelField[ia]*(1-u)+levelField[ib]*u};
 }
 function tri(a,b,c){
  const u=b.q.map((v,i)=>v-a.q[i]),v=c.q.map((v,i)=>v-a.q[i]),cr=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  if(cr.reduce((s,v,i)=>s+v*(a.n[i]+b.n[i]+c.n[i]),0)<0)[b,c]=[c,b];
  for(const e of [a,b,c]){pos.push(...e.q);nor.push(...e.n);info.push(e.l,e.t)}vertices+=3;
 }
 for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
  const id=x+y*nx+z*plane,ids=offsets.map(o=>id+o);let cnt=0;for(const i of ids)cnt+=F[i]<0?1:0;if(cnt===0||cnt===8)continue;
  for(const tet of tets){const neg=[],plus=[];for(const v of tet)(F[ids[v]]<0?neg:plus).push(v);if(!neg.length||!plus.length)continue;
   if(neg.length===1||plus.length===1){const a=neg.length===1?neg[0]:plus[0],rest=neg.length===1?plus:neg;tri(...rest.map(b=>crossVertex(a,b,ids,x,y,z)))}
   else{const a=crossVertex(neg[0],plus[0],ids,x,y,z),b=crossVertex(neg[0],plus[1],ids,x,y,z),c=crossVertex(neg[1],plus[0],ids,x,y,z),d=crossVertex(neg[1],plus[1],ids,x,y,z);tri(a,b,c);tri(b,d,c)}
  }
 }
 const positions=new Float32Array(pos),normals=new Float32Array(nor),attributes=new Float32Array(info),skeleton=new Float32Array(lines);
 return {positions,normals,attributes,skeleton,metrics:{activeBranches:active,terminalFronts:tips,totalBranches:nodes.length,triangles:vertices/3,seedCount:3,growth:p.growth,grid:N,resolution:step,milliseconds:Math.round(performance.now()-start),bounds:{lo,hi},ruleDepth:p.depth},graph:nodes.map(n=>({id:n.id,parent:n.parent,root:n.root,level:n.level,start:n.start,end:n.end}))};
}
self.onmessage=e=>{const {id,params}=e.data;try{const r=mesh(params);self.postMessage({id,...r},[r.positions.buffer,r.normals.buffer,r.attributes.buffer,r.skeleton.buffer])}catch(err){self.postMessage({id,error:String(err?.stack||err)})}};
