// Rest material and the original solver are unchanged. Contact is mass-weighted.
// Conservative advancement of linearly moving VF/EE primitives, not nonlinear CCD.
const scDot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const scSub=(a,b)=>a.map((v,k)=>v-b[k]);
const scCross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function scFace(p,a,b,c){
 const ab=scSub(b,a),ac=scSub(c,a),ap=scSub(p,a),d1=scDot(ab,ap),d2=scDot(ac,ap);let u,v,w;
 if(d1<=0&&d2<=0){u=1;v=w=0;}else{
 const bp=scSub(p,b),d3=scDot(ab,bp),d4=scDot(ac,bp);
 if(d3>=0&&d4<=d3){v=1;u=w=0;}else{
 const vc=d1*d4-d3*d2;
 if(vc<=0&&d1>=0&&d3<=0){v=d1/(d1-d3);u=1-v;w=0;}else{
 const cp=scSub(p,c),d5=scDot(ab,cp),d6=scDot(ac,cp);
 if(d6>=0&&d5<=d6){w=1;u=v=0;}else{
 const vb=d5*d2-d1*d6;
 if(vb<=0&&d2>=0&&d6<=0){w=d2/(d2-d6);u=1-w;v=0;}else{
 const va=d3*d6-d5*d4;
 if(va<=0&&d4>=d3&&d5>=d6){w=(d4-d3)/(d4-d3+d5-d6);v=1-w;u=0;}
 else{const den=va+vb+vc;if(Math.abs(den)<1e-24)return null;v=vb/den;w=vc/den;u=1-v-w;}
 }}}}}
 return {delta:p.map((x,k)=>x-u*a[k]-v*b[k]-w*c[k]),weights:[1,-u,-v,-w]};
}
function scEdges(a,b,c,d){
 const u=scSub(b,a),v=scSub(d,c),w=scSub(a,c),aa=scDot(u,u),bb=scDot(u,v),cc=scDot(v,v),dd=scDot(u,w),ee=scDot(v,w);let s=0,t=0;
 if(aa<1e-24&&cc<1e-24)return null;
 if(aa<1e-24)t=Math.max(0,Math.min(1,ee/cc));
 else if(cc<1e-24)s=Math.max(0,Math.min(1,-dd/aa));
 else{const den=aa*cc-bb*bb;s=den>1e-24?Math.max(0,Math.min(1,(bb*ee-cc*dd)/den)):0;t=(bb*s+ee)/cc;if(t<0){t=0;s=Math.max(0,Math.min(1,-dd/aa));}else if(t>1){t=1;s=Math.max(0,Math.min(1,(bb-dd)/aa));}}
 return {delta:a.map((x,k)=>(1-s)*x+s*b[k]-(1-t)*c[k]-t*d[k]),weights:[1-s,s,-(1-t),-t]};
}
export class SweptContact {
 constructor(lab,{thicknessMm=.8,cellSizeMm=24}={}){
  this.lab=lab;this.h=thicknessMm/1000;this.cell=cellSizeMm/1000;this.corrections=0;this.sweptHits=0;this.discreteHits=0;this.unresolved=0;this.skippedLargeTriangles=0;
  this.near=Array.from({length:lab.positions.length},(_,i)=>new Set([i]));
  for(const [a,b] of lab.meshEdges){this.near[a].add(b);this.near[b].add(a);}
  // Paired needle sites are intentional adjacency even before equality activation.
  // No exclusion of whole panels or gathering bands.
  for(const seam of lab.spec.seams){const a=lab.offsets.get(seam.a.panelId),b=lab.offsets.get(seam.b.panelId);for(const [i,j] of seam.stitchVertexPairs){this.near[a+i].add(b+j);this.near[b+j].add(a+i);}}
  const first=this.near.map(s=>new Set(s));
  for(let i=0;i<this.near.length;i++)for(const j of first[i])for(const k of first[j])this.near[i].add(k);
  this.previous=Float64Array.from(lab._old);this.lastGroups=-1;this.hash=new Map();this.edgeHash=new Map();
 }
 capture(){for(let i=0;i<this.lab.positions.length;i++)this.previous.set(this.lab.positions[i],i*3);}
 refreshTopology(){const l=this.lab;if(this.lastGroups===l.stitchGroups.groupCount)return;this.lastGroups=l.stitchGroups.groupCount;this.groupNear=new Map();for(let i=0;i<this.near.length;i++){const r=l.stitchGroups.find(i);let set=this.groupNear.get(r);if(!set)this.groupNear.set(r,set=new Set());for(const j of this.near[i])set.add(l.stitchGroups.find(j));}}
 bounds(ids){const l=this.lab,lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const id of ids)for(let k=0;k<3;k++){const x=l.positions[id][k],y=this.previous[id*3+k];lo[k]=Math.min(lo[k],x,y);hi[k]=Math.max(hi[k],x,y);}return{lo:lo.map(x=>x-this.h),hi:hi.map(x=>x+this.h)};}
 overlaps(a,b){return a.lo.every((v,k)=>v<=b.hi[k]&&b.lo[k]<=a.hi[k]);}
 cells(box,visit){const a=box.lo.map(x=>Math.floor(x/this.cell)),b=box.hi.map(x=>Math.floor(x/this.cell));const count=(b[0]-a[0]+1)*(b[1]-a[1]+1)*(b[2]-a[2]+1);if(count>20000)throw Error('CONTACT_SWEEP_BUDGET: excessive material displacement; refusing to omit collision candidates');for(let z=a[2];z<=b[2];z++)for(let y=a[1];y<=b[1];y++)for(let x=a[0];x<=b[0];x++)visit(x+','+y+','+z);}
 bodySweep(){
  const l=this.lab;if(!l.sdf)return;const q=new Float64Array(5),margin=l.clearance;
  for(let i=0;i<l.positions.length;i++){
   if(l.stitchGroups.find(i)!==i||!l.invMass[i])continue;
   const p=l.positions[i],o=[this.previous[i*3],this.previous[i*3+1],this.previous[i*3+2]],d=scSub(p,o),len=Math.hypot(...d);
   if(len<.0005)continue;
   let t=0,hit=null;
   for(let j=0;j<128&&t<=1;j++){
    const x=o.map((v,k)=>v+t*d[k]);l.sdf.sample(...x,q);
    if(!q[4]){t+=.001/len;continue;}
    if(q[0]<=margin+.00005){
     const n=[q[1],q[2],q[3]];
     // Already resting on the surface: allow separating motion.
     if(t===0&&scDot(d,n)>=0)break;
     hit={x,n};break;
    }
    t+=Math.max(.00001,(q[0]-margin)*.45)/len;
    if(j===127)this.unresolved++;
   }
   if(hit){const delta=scSub(p,hit.x),inward=scDot(delta,hit.n);if(inward<0){for(let k=0;k<3;k++)p[k]-=inward*hit.n[k];this.bodySweptHits=(this.bodySweptHits||0)+1;}}
  }
 }
 rebuild(){this.refreshTopology();const l=this.lab;this.hash.clear();this.edgeHash.clear();this.tb=l.triangles.map(t=>this.bounds(t.ids));this.eb=l.meshEdges.map(e=>this.bounds(e));for(let i=0;i<this.tb.length;i++)this.cells(this.tb[i],key=>{let a=this.hash.get(key);if(!a)this.hash.set(key,a=[]);a.push(i);});for(let i=0;i<this.eb.length;i++)this.cells(this.eb[i],key=>{let a=this.edgeHash.get(key);if(!a)this.edgeHash.set(key,a=[]);a.push(i);});}
 exclude(a,b){const l=this.lab;for(const i of a){const near=this.groupNear.get(l.stitchGroups.find(i));for(const j of b)if(near.has(l.stitchGroups.find(j)))return true;}return false;}
 contact(ids,face){
  const l=this.lab,ps=l.positions,old=this.previous;
  const before=ids.map(i=>[old[3*i],old[3*i+1],old[3*i+2]]),after=ids.map(i=>Array.from(ps[i])),moves=after.map((p,i)=>scSub(p,before[i]));
  const speed=face?Math.hypot(...moves[0])+Math.max(...moves.slice(1).map(v=>Math.hypot(...v))):Math.max(...moves.slice(0,2).map(v=>Math.hypot(...v)))+Math.max(...moves.slice(2).map(v=>Math.hypot(...v)));
  const sample=t=>{const p=before.map((v,i)=>v.map((x,k)=>x+t*moves[i][k]));return face?scFace(...p):scEdges(...p);};
  let t=0,q=sample(0),hit=null;
  // The Lipschitz speed bounds relative primitive motion over this substep.
  // An iteration limit is reported, never presented as complete certification.
  for(let j=0;j<32&&q;j++){
   const d=Math.hypot(...q.delta);if(d<=this.h+1e-8){hit=q;break;}if(speed<1e-12)return;
   const step=.9*(d-this.h)/speed;if(t+step>1)return;t+=Math.max(step,1e-7);if(t>1)return;q=sample(t);
   if(j===31)this.unresolved++;
  }
  if(!hit){const end=sample(1);if(!end||Math.hypot(...end.delta)>=this.h)return;hit=end;t=1;}
  let n=hit.delta,len=Math.hypot(...n);
  if(len<1e-12){n=face?scCross(scSub(before[2],before[1]),scSub(before[3],before[1])):scCross(scSub(before[1],before[0]),scSub(before[3],before[2]));len=Math.hypot(...n);if(len<1e-12)return;}
  n=n.map(v=>v/len);const w=hit.weights,delta=[0,0,0];for(let j=0;j<ids.length;j++)for(let k=0;k<3;k++)delta[k]+=w[j]*ps[ids[j]][k];const gap=scDot(delta,n);if(gap>=this.h)return;
  // Aggregate aliases before applying corrections, preserving total stitched mass.
  const groups=new Map();for(let j=0;j<ids.length;j++){const r=l.stitchGroups.find(ids[j]);groups.set(r,(groups.get(r)||0)+w[j]);}
  let den=0;for(const [r,w]of groups)den+=l.invMass[r]*w*w;if(den<1e-15)return;
  const dl=(this.h-gap)/den;for(const [r,w]of groups)for(let k=0;k<3;k++)ps[r][k]+=l.invMass[r]*w*dl*n[k];this.corrections++;if(t<1&&speed>this.h)this.sweptHits++;else this.discreteHits++;
 }
 project(){const l=this.lab;for(let i=0;i<l.positions.length;i++){if(l.stitchGroups.find(i)!==i)continue;const vb=this.bounds([i]),seen=new Set();this.cells(vb,key=>{for(const t of this.hash.get(key)||[]){if(seen.has(t))continue;seen.add(t);const ids=l.triangles[t].ids;if(!this.overlaps(vb,this.tb[t])||this.exclude([i],ids))continue;this.contact([i,...ids],true);}});}
  for(let e=0;e<l.meshEdges.length;e++){const a=l.meshEdges[e],seen=new Set();this.cells(this.eb[e],key=>{for(const f of this.edgeHash.get(key)||[]){if(f<=e||seen.has(f))continue;seen.add(f);const b=l.meshEdges[f];if(!this.overlaps(this.eb[e],this.eb[f])||this.exclude(a,b))continue;this.contact([...a,...b],false);}});}
  this.capture();
 }
 report(){return{kind:'swept linear vertex-face and edge-edge conservative advancement',thicknessMm:this.h*1000,corrections:this.corrections,bodySweptHits:this.bodySweptHits||0,contactIntervalSubsteps:6,sweptHits:this.sweptHits,discreteHits:this.discreteHits,iterationLimitEvents:this.unresolved,nonlinearContinuousCollisionCertified:false,skippedPrimitives:0};}
}
