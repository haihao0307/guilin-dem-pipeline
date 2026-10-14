// Original KAOPU local corrective: same neutral face and native blink.
// A coherent orbital warp changes the CLOSED target only. Not a measured muscle model.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const median=a=>{a.sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:null;};
const point=(p,i)=>[p[3*i],p[3*i+1],p[3*i+2]];
function interpolate(rows,u){
 if(u<=rows[0][0])return rows[0][1];if(u>=rows.at(-1)[0])return rows.at(-1)[1];
 let hi=1;while(rows[hi][0]<u)hi++;const a=rows[hi-1],b=rows[hi],t=(u-a[0])/(b[0]-a[0]);return a[1]+t*(b[1]-a[1]);
}
export function orbitalWarp(q,eye,amount=1){
 const u=(q[0]-eye.inner[0])/(eye.outer[0]-eye.inner[0]);
 if(u<=0||u>=1)return [0,0,0];
 const seam=interpolate(eye.profile,u),line=eye.inner[1]*(1-u)+eye.outer[1]*u;
 const target=line+(seam-line)*.42,vertical=q[1]-seam;
 const gate=smooth(0,.09,u)*(1-smooth(.91,1,u))*(1-smooth(.014,.026,Math.abs(vertical)));
 const dy=clamp(target-seam,-.0045,.0045)*Math.exp(-((vertical/.014)**2))*gate*amount;
 const ry=q[1]-eye.center[1],rz=q[2]-eye.center[2],rho=Math.hypot(ry,rz);
 if(rz<=.001||rho<.002||Math.abs(ry+dy)>=rho*.998)return [0,0,0];
 // Rotate skin around the unchanged globe axis, preserving radial clearance.
 return [0,dy,Math.sqrt(Math.max(0,rho*rho-(ry+dy)*(ry+dy)))-rz];
}
export function buildClosureCorrections(groom,geometry){
 const f=groom.frame,p=geometry.attributes.position.array,index=geometry.index.array,targets=geometry.morphAttributes.position;
 if(targets.length!==2)throw Error('Expected exactly two retained native eye targets');
 const N=p.length/3,rest=new Float32Array(p.length),closed=new Float32Array(p.length);
 for(let i=0;i<N;i++){
  rest.set(f.project(point(p,i)),i*3);
  const q=point(p,i);for(let k=0;k<3;k++)q[k]+=targets[0].array[i*3+k]+targets[1].array[i*3+k];closed.set(f.project(q),i*3);
 }
 const positions=[new Float32Array(p.length),new Float32Array(p.length)],reports=[],domains=[];
 for(const side of ['left','right']){
  const ids=side==='left'?[42,45]:[39,36];
  const inner=f.project(groom.landmark(ids[0])),outer=f.project(groom.landmark(ids[1]));
  const strands=groom.batches.filter(b=>b.kind!=='brow').flatMap(b=>b.strands.filter(s=>s.side===side));
  if(strands.length<80)throw Error('Insufficient retained eyelid bindings for '+side);
  const energy=targets.map(t=>strands.reduce((sum,s)=>sum+s.anchor.ids.reduce((n,i)=>n+Math.hypot(t.array[i*3],t.array[i*3+1],t.array[i*3+2]),0),0)),ti=energy[0]>energy[1]?0:1;
  const center=f.project(strands[0].follow.eyeCenter),width=Math.abs(outer[0]-inner[0]);
  const samples=strands.map(s=>{const a=s.anchor,q=[0,0,0];for(let j=0;j<3;j++)for(let k=0;k<3;k++)q[k]+=closed[a.ids[j]*3+k]*a.weights[j];return{u:(q[0]-inner[0])/(outer[0]-inner[0]),y:q[1],kind:s.kind};});
  const profile=[[0,inner[1]]];
  for(let b=0;b<22;b++){
   const u=(b+.5)/22,near=samples.filter(s=>Math.abs(s.u-u)<.045);
   const top=median(near.filter(s=>s.kind==='upper').map(s=>s.y)),bottom=median(near.filter(s=>s.kind==='lower').map(s=>s.y));
   const value=top===null?bottom:bottom===null?top:(top+bottom)*.5;
   if(value!==null)profile.push([u,value]);
  }
  profile.push([1,outer[1]]);
  for(let pass=0;pass<3;pass++){const old=profile.map(p=>p[1]);for(let j=1;j<profile.length-1;j++)profile[j][1]=(old[j-1]+2*old[j]+old[j+1])*.25;}
  const eye={inner,outer,center,width,profile};
  // Actual skin connectivity, not proximity: disconnected eyeballs are excluded.
  const eligible=new Uint8Array(N),adj=new Map(),seeds=new Set(strands.flatMap(s=>s.anchor.ids));
  for(let i=0;i<N;i++){
   const x=rest[3*i],y=rest[3*i+1],z=rest[3*i+2];
   eligible[i]=x>Math.min(inner[0],outer[0])-.003&&x<Math.max(inner[0],outer[0])+.003&&Math.abs(y-center[1])<.033&&z>center[2]+.001&&z<center[2]+.045?1:0;
  }
  for(let k=0;k<index.length;k+=3){const tri=[index[k],index[k+1],index[k+2]];for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3];if(!eligible[a]||!eligible[b])continue;if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);adj.get(a).push(b);adj.get(b).push(a);}}
  const selected=new Set(),queue=[];for(const i of seeds)if(eligible[i]){selected.add(i);queue.push(i);}
  for(let j=0;j<queue.length;j++)for(const i of adj.get(queue[j])||[])if(!selected.has(i)){selected.add(i);queue.push(i);}
  let maxShift=0,maxRadiusError=0,changed=0;
  for(const i of selected){const q=point(closed,i),d=orbitalWarp(q,eye);if(Math.hypot(...d)<1e-10)continue;
   const before=Math.hypot(q[1]-center[1],q[2]-center[2]),after=Math.hypot(q[1]+d[1]-center[1],q[2]+d[2]-center[2]);maxRadiusError=Math.max(maxRadiusError,Math.abs(after-before));
   for(let k=0;k<3;k++)positions[ti][i*3+k]=f.x[k]*d[0]+f.up[k]*d[1]+f.front[k]*d[2];
   maxShift=Math.max(maxShift,Math.hypot(...d));changed++;
  }
  const mid=interpolate(profile,.5),line=(inner[1]+outer[1])*.5;
  reports.push({side,targetIndex:ti,profilePoints:profile.length,connectedSkinVertices:selected.size,changedVertices:changed,maxShiftMM:maxShift*1000,maxRadialErrorMM:maxRadiusError*1000,inheritedMidSagMM:(line-mid)*1000,targetMidSagMM:(line-mid)*.42*1000,closedEyeCenter:center});domains.push({side,indices:Array.from(selected),eye});
 }
 return {positions,reports,domains};
}
