/** S01 surface domain kernel. No hairstyle, empirical world-space thresholds,
 * material or biological follicle-count assumptions at runtime. Units: metres. */
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const sub=(a,b)=>a.map((v,k)=>v-b[k]);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit=a=>{const n=Math.hypot(...a);return n>1e-12?a.map(x=>x/n):[0,1,0]};
export const lerp=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
export function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296}}
export function hash(a){let h=2166136261;for(const n of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^n,16777619);return (h>>>0).toString(16).padStart(8,'0')}
export class Heap{
 constructor(){this.a=[]}push(v){let i=this.a.length;this.a.push(v);while(i){const p=(i-1)>>1;if(this.a[p][0]<=v[0])break;this.a[i]=this.a[p];i=p}this.a[i]=v}
 pop(){const a=this.a,r=a[0],v=a.pop();if(a.length){let i=0;while(2*i+1<a.length){let c=2*i+1;if(c+1<a.length&&a[c+1][0]<a[c][0])c++;if(a[c][0]>=v[0])break;a[i]=a[c];i=c}a[i]=v}return r}
}
export class Surface{
 constructor(data){this.data=data;this.p=new Float32Array(data.positions);this.tri=new Uint16Array(data.triangles);this.component=new Uint8Array(data.component);this.N=this.p.length/3;this.F=this.tri.length/3;this.adj=Array.from({length:this.N},()=>new Map());this.normals=new Float32Array(this.p.length);this.areas=new Float64Array(this.F);
  for(let f=0;f<this.F;f++){const ids=[0,1,2].map(k=>this.tri[f*3+k]),a=this.vertex(ids[0]),b=this.vertex(ids[1]),c=this.vertex(ids[2]),n=cross(sub(b,a),sub(c,a));this.areas[f]=Math.hypot(...n)/2;
   for(let k=0;k<3;k++){const i=ids[k],j=ids[(k+1)%3];for(let d=0;d<3;d++)this.normals[i*3+d]+=n[d];if(this.component[i]===0&&this.component[j]===0){const length=Math.hypot(...sub(this.vertex(i),this.vertex(j)));this.adj[i].set(j,length);this.adj[j].set(i,length)}}
  }for(let i=0;i<this.N;i++)this.normals.set(unit(this.vertex(i,this.normals)),i*3);
 }
 vertex(i,p=this.p){return Array.from(p.subarray(i*3,i*3+3))}
 sample(f,b,p=this.p){const out=[0,0,0];for(let k=0;k<3;k++){const i=this.tri[f*3+k]*3;for(let d=0;d<3;d++)out[d]+=b[k]*p[i+d]}return out}
 scalar(f,b,v){return b.reduce((s,x,k)=>s+x*v[this.tri[f*3+k]],0)}
 normal(f,b,n=this.normals){return unit(this.sample(f,b,n))}
 distances(seeds,limit=Infinity){const d=new Float64Array(this.N).fill(Infinity),heap=new Heap();for(const[i,v]of seeds)if(v<d[i]){d[i]=v;heap.push([v,i])}while(heap.a.length){const[v,i]=heap.pop();if(v!==d[i]||v>limit)continue;for(const[j,w]of this.adj[i])if(v+w<d[j]&&v+w<=limit){d[j]=v+w;heap.push([d[j],j])}}return d}
 boundary(phi,p=this.p){const lines=[],seeds=[],segments=[];for(let f=0;f<this.F;f++){const ids=[0,1,2].map(k=>this.tri[f*3+k]);if(ids.some(i=>this.component[i]!==0))continue;const cut=[];
   for(let k=0;k<3;k++){const i=ids[k],j=ids[(k+1)%3],a=phi[i],b=phi[j];if((a>0)!==(b>0)){const t=a/(a-b),pos=lerp(this.vertex(i,p),this.vertex(j,p),t),rest=lerp(this.vertex(i),this.vertex(j),t);cut.push(pos);const edge=this.adj[i].get(j);seeds.push([i,t*edge],[j,(1-t)*edge]);segments.push({face:f,edge:[i,j],t,rest})}}
   if(cut.length===2)lines.push(...cut[0],...cut[1]);
  }return{lines:new Float32Array(lines),seeds,segments}}
 domainArea(phi){let area=0,faces=0;for(let f=0;f<this.F;f++){const ids=[0,1,2].map(k=>this.tri[f*3+k]);if(ids.some(i=>this.component[i]!==0))continue;let poly=ids.map(i=>({p:this.vertex(i),v:phi[i]})),out=[];for(let k=0;k<3;k++){const a=poly[k],b=poly[(k+1)%3];if(a.v>0)out.push(a);if((a.v>0)!==(b.v>0)){const t=a.v/(a.v-b.v);out.push({p:lerp(a.p,b.p,t),v:0})}}if(out.length>=3){faces++;for(let k=1;k<out.length-1;k++)area+=Math.hypot(...cross(sub(out[k].p,out[0].p),sub(out[k+1].p,out[0].p)))/2}}
  return {area,faces}}
}
/** Fixed full-skin candidate pool: edit activation, never resample on density,
 * probe length, camera, preview deformation or future hairstyle changes.
 * Hard-core spacing uses Euclidean surface chord, NOT exact geodesic spacing. */
export function rootPool(surface,{attempts=85000,spacing=.0021,seed=20261013}={}){
 const s=surface,R=rng(seed),faces=[],cum=[];let total=0;for(let f=0;f<s.F;f++){if([0,1,2].some(k=>s.component[s.tri[f*3+k]]!==0)||s.areas[f]<1e-12)continue;faces.push(f);cum.push(total+=s.areas[f])}
 const tris=[],bs=[],rs=[],positions=[],bins=new Map(),key=(x,y,z)=>`${x},${y},${z}`;
 for(let k=0;k<attempts;k++){const q=R()*total;let a=0,b=cum.length-1;while(a<b){const c=(a+b)>>1;if(cum[c]<q)a=c+1;else b=c}const f=faces[a],u=Math.sqrt(R()),v=R(),bary=[1-u,u*(1-v),u*v],p=s.sample(f,bary),cell=p.map(x=>Math.floor(x/spacing));let near=false;
  for(let x=-1;x<=1&&!near;x++)for(let y=-1;y<=1&&!near;y++)for(let z=-1;z<=1&&!near;z++)for(const j of bins.get(key(cell[0]+x,cell[1]+y,cell[2]+z))||[])if(Math.hypot(p[0]-positions[j*3],p[1]-positions[j*3+1],p[2]-positions[j*3+2])<spacing){near=true;break}
  if(near)continue;const id=tris.length;tris.push(f);bs.push(...bary);positions.push(...p);rs.push(R());const ck=key(...cell);if(!bins.has(ck))bins.set(ck,[]);bins.get(ck).push(id);
 }
 return{triangles:new Uint16Array(tris),barycentric:new Float32Array(bs),random:new Float32Array(rs),count:tris.length,seed,spacing,positions:new Float32Array(positions)}
}
export class Domain{
 constructor(surface,pool){this.s=surface;this.pool=pool;this.phi=new Float32Array(surface.data.mask);this.density=new Float32Array(surface.data.density);this.revision=0;this.undoStack=[];this.redoStack=[];this.recompute()}
 recompute(){this.boundary=this.s.boundary(this.phi);this.distance=this.s.distances(this.boundary.seeds);this.area=this.s.domainArea(this.phi);this.maskHash=hash(this.phi)}
 snapshot(){return {mask:Array.from(this.phi),density:Array.from(this.density)}}
 saveHistory(){this.undoStack.push(this.snapshot());if(this.undoStack.length>24)this.undoStack.shift();this.redoStack=[]}
 restoreSnapshot(o){this.phi.set(o.mask);this.density.set(o.density);this.revision++;this.recompute()}
 undo(){if(!this.undoStack.length)return false;this.redoStack.push(this.snapshot());this.restoreSnapshot(this.undoStack.pop());return true}
 redo(){if(!this.redoStack.length)return false;this.undoStack.push(this.snapshot());this.restoreSnapshot(this.redoStack.pop());return true}
 /** A stamp travels over actual mesh edges. It cannot jump to the opposite
  * side of the head or disconnected eyeballs. A click is one undo transaction. */
 paint(face,bary,{mode='erase',radius=.012,strength=.65}={}){
  if(!Number.isInteger(face)||face<0||face>=this.s.F||!['add','erase','dense','thin'].includes(mode)||!Number.isFinite(radius)||radius<.002||radius>.04||!Number.isFinite(strength)||strength<0||strength>1)throw Error('无效画笔');
  if(!bary||bary.length!==3||Array.from(bary).some(v=>!Number.isFinite(v)||v<-.000001||v>1.000001)||Math.abs(bary[0]+bary[1]+bary[2]-1)>.00001)throw Error('无效表面坐标');
  const ids=[0,1,2].map(k=>this.s.tri[face*3+k]);if(strength===0||ids.some(i=>this.s.component[i]!==0))return 0;const center=this.s.sample(face,bary),seeds=ids.map(i=>[i,Math.hypot(...sub(center,this.s.vertex(i)))]),dist=this.s.distances(seeds,radius);this.saveHistory();let changed=0;
  for(let i=0;i<this.s.N;i++)if(dist[i]<radius){const x=1-dist[i]/radius,w=x*x*(3-2*x);if(mode==='add'||mode==='erase'){const disk=radius*strength-dist[i];this.phi[i]=clamp(mode==='add'?Math.max(this.phi[i],disk):Math.min(this.phi[i],-disk),-.08,.08)}else this.density[i]=clamp(this.density[i]+(mode==='dense'?1:-1)*strength*w);changed++}
  this.revision++;this.recompute();return changed;
 }
 active(factor=1){const ids=[],P=this.pool;for(let i=0;i<P.count;i++){const f=P.triangles[i],b=P.barycentric.subarray(i*3,i*3+3);if(this.s.scalar(f,b,this.phi)>1e-9&&P.random[i]<clamp(factor)*clamp(this.s.scalar(f,b,this.density)))ids.push(i)}return ids}
 roots(ids,positions=this.s.p){const out=new Float32Array(ids.length*3);ids.forEach((id,k)=>out.set(this.s.sample(this.pool.triangles[id],this.pool.barycentric.subarray(id*3,id*3+3),positions),k*3));return out}
 archive(){return{schema:'kaopu/scalp-domain@1',version:'S01',topology:this.s.data.topology,source:this.s.data.source,revision:this.revision,pool:{seed:this.pool.seed,spacing:this.pool.spacing,hash:hash(this.pool.barycentric)+hash(this.pool.triangles)},...this.snapshot(),semantics:'authored candidate; diagnostic samples not a measured biological follicle map'}}
 import(o){if(!o||o.schema!=='kaopu/scalp-domain@1'||o.topology!==this.s.data.topology||o.pool?.hash!==hash(this.pool.barycentric)+hash(this.pool.triangles)||o.pool?.seed!==this.pool.seed||o.pool?.spacing!==this.pool.spacing)throw Error('拓扑或根点版本不一致');for(const[k,lo,hi]of[['mask',-.08,.08],['density',0,1]])if(!Array.isArray(o[k])||o[k].length!==this.s.N||o[k].some(v=>!Number.isFinite(v)||v<lo||v>hi))throw Error('蒙版或密度数据无效');for(let i=0;i<this.s.N;i++)if(this.s.component[i]!==0&&o.mask[i]>0)throw Error('非皮肤部件不能生长');this.saveHistory();this.restoreSnapshot(o)}
 stats(factor=1){const ids=this.active(factor),p=this.pool;let outside=0,sumError=0;for(const id of ids){const b=p.barycentric.subarray(id*3,id*3+3),f=p.triangles[id];if(this.s.scalar(f,b,this.phi)<=0)outside++;sumError=Math.max(sumError,Math.abs(b[0]+b[1]+b[2]-1))}return{revision:this.revision,candidateRoots:p.count,activeRoots:ids.length,areaCm2:this.area.area*10000,domainFaces:this.area.faces,boundarySegments:this.boundary.lines.length/6,outsideRoots:outside,maxBarycentricSumError:sumError,rootBindingHash:hash(p.triangles)+hash(p.barycentric),maskHash:this.maskHash,rootCountIsBiological:false,distanceMethod:'mesh-edge Dijkstra approximation',spacingMethod:'surface chord hard-core rejection'}}
}
