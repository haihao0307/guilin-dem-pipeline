/* KAOPU Coral Growth Lab: original deterministic triangular-membrane solver.
 * Algorithmic study: J. Horikawa's MIT HoudiniHowtos, not a HIP/Vellum port.
 * No teacher code, movie, geometry cache or paid asset is embedded here.
 */
export const VERSION='CORAL-GROWTH-R02-20261007';
export const DEFAULTS={seed:17,rate:1,curvature:0.3,direction:0.55,shadow:0.5,ruffle:0.7,detail:0.035,form:'cup'};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const norm=(v)=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l)};
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
function random(seed){let a=seed|0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function hashCell(x,y,z,s){return`${Math.floor(x/s)},${Math.floor(y/s)},${Math.floor(z/s)}`}
export class Growth {
 constructor(options={}){this.o={...DEFAULTS,...options};this.p=[];this.f=[];this.anchor=[];this.birth=[];this.seedRadius=[];this.group=[];this.rest=new Map();this.frame=0;this.splits=0;this.rng=random(this.o.seed);this.makeSeeds();this.chartAngle=this.p.map(p=>Math.atan2(p[2],p[0]));this.orientationBacktracks=0;this.topology();this.attributes();}
 makeSeeds(){
  const rings=16,loops=[];
  for(let j=0;j<=rings;j++){
   const t=j/rings,r=.015+.29*Math.pow(t,.85),y=.025+.45*t,sectors=Math.max(12,Math.round(96*r/.305/4)*4),loop=[];
   for(let k=0;k<sectors;k++){
    const theta=2*Math.PI*k/sectors,ripple=.004*Math.pow(t,5)*(Math.sin(theta*18+this.o.seed*.13)+.2*Math.sin(theta*11+this.o.seed*.51));
    loop.push(this.p.length);this.p.push([(r+ripple)*Math.cos(theta),y+ripple*.7,(r+ripple)*Math.sin(theta)]);
    this.anchor.push(j===0);this.birth.push(0);this.seedRadius.push(t);this.group.push(0);
   }loops.push(loop);
  }
  for(let j=0;j<rings;j++){
   let a=loops[j],b=loops[j+1],i=0,k=0;
   while(i<a.length||k<b.length){let na=(i+1)/a.length,nb=(k+1)/b.length,A=a[i%a.length],B=b[k%b.length];
    if(Math.abs(na-nb)<1e-8){let C=a[(i+1)%a.length],D=b[(k+1)%b.length];this.f.push([A,C,B],[C,D,B]);i++;k++;}
    else if(na<nb){this.f.push([A,a[(i+1)%a.length],B]);i++;}
    else{this.f.push([A,b[(k+1)%b.length],B]);k++;}
   }
  }
  const bottom=this.p.length;this.p.push([0,.015,0]);this.anchor.push(true);this.birth.push(0);this.seedRadius.push(0);this.group.push(0);
  for(let k=0;k<loops[0].length;k++)this.f.push([bottom,loops[0][(k+1)%loops[0].length],loops[0][k]]);
 }
 topology(){
  this.neighbors=this.p.map(()=>new Set());const es=new Map();
  for(const [a,b,c] of this.f)for(const [i,j] of [[a,b],[b,c],[c,a]]){this.neighbors[i].add(j);this.neighbors[j].add(i);let key=i<j?`${i}:${j}`:`${j}:${i}`;let e=es.get(key);if(e)e.n++;else{let l=Math.hypot(...sub(this.p[i],this.p[j]));es.set(key,{i,j,n:1,key,r:this.rest.get(key)??l});}}
  this.edges=[...es.values()];this.boundary=new Uint8Array(this.p.length);this.rest.clear();for(const e of this.edges){this.rest.set(e.key,e.r);if(e.n===1){this.boundary[e.i]=1;this.boundary[e.j]=1;}}
 }
 attributes(){
  const n=this.p.length;this.normal=Array.from({length:n},()=>[0,0,0]);
  for(const [a,b,c] of this.f){const u=sub(this.p[b],this.p[a]),v=sub(this.p[c],this.p[a]);const cr=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(const i of [a,b,c])for(let q=0;q<3;q++)this.normal[i][q]+=cr[q];}
  this.normal=this.normal.map(norm);this.masks=new Float32Array(n*3);const light=norm([0.45,1,0.32]);let heights=new Map();
  const s=this.o.detail*1.6;
  const project=p=>[(p[0]-.45*p[1])/s,(p[2]-.32*p[1])/s,p[1]];
  this.p.forEach(p=>{let[u,v,h]=project(p);let key=`${Math.round(u)},${Math.round(v)}`;heights.set(key,Math.max(h,heights.get(key)??-100));});
  this.p.forEach((p,i)=>{
   let lap=[0,0,0];for(const j of this.neighbors[i])for(let q=0;q<3;q++)lap[q]+=(this.p[j][q]-p[q])/this.neighbors[i].size;
   let curv=clamp(Math.abs(dot(lap,this.normal[i]))/(this.o.detail*.2));
   let dir=clamp(0.5+0.5*dot(this.normal[i],light));let[u,v,h]=project(p),above=heights.get(`${Math.round(u)},${Math.round(v)}`)-h;
   let exposure=clamp(1-above/0.3,.15,1);
   this.masks.set([curv,dir,exposure],i*3);
  });
 }
 step(){
  this.attributes();let previous=this.p.map(p=>p.slice());let n=this.p.length;let localEdge=this.p.map((p,i)=>Math.min(...[...this.neighbors[i]].map(j=>Math.hypot(...sub(p,this.p[j])))));let displacement=Array.from({length:n},()=>[0,0,0]);let growthMask=new Float32Array(n);
  for(let i=0;i<n;i++){
   let [c,d,s]=this.masks.subarray(i*3,i*3+3);let edge=Math.pow(this.seedRadius[i],3);
   growthMask[i]=(.02+.98*edge)*(1+this.o.curvature*c*.35)*((1-this.o.direction)+this.o.direction*(.4+.6*d))*((1-this.o.shadow)+this.o.shadow*s);
   let a=this.normal[i],p=this.p[i];let wave=Math.sin(p[0]*7.2+p[2]*5.1+this.o.seed*.32+this.frame*.045);
   let speed=.00025*this.o.rate*growthMask[i];
   for(let q=0;q<3;q++)displacement[i][q]+=a[q]*speed;
   let rr=Math.hypot(p[0],p[2])||1;displacement[i][0]+=.0007*this.o.rate*edge*p[0]/rr;displacement[i][2]+=.0007*this.o.rate*edge*p[2]/rr;displacement[i][1]+=.0007*this.o.rate*this.o.direction*edge;
   displacement[i][1]+=.00015*this.o.ruffle*edge*Math.sin(Math.atan2(p[2],p[0])*18+this.o.seed*.13);
  }
  for(const e of this.edges){let mask=(growthMask[e.i]+growthMask[e.j])/2;let mid=this.p[e.i].map((v,q)=>(v+this.p[e.j][q])*.5),rr=Math.hypot(mid[0],mid[2])||1,tangent=[-mid[2]/rr,0,mid[0]/rr],ed=norm(sub(this.p[e.j],this.p[e.i])),around=Math.abs(dot(ed,tangent));e.r=Math.min(e.r*(1+.0045*this.o.rate*mask*(.75+around*.6)),Math.hypot(...sub(this.p[e.i],this.p[e.j]))*1.08);this.rest.set(e.key,e.r);}
  // Local spring constraints grow their rest metric; unlike object scale, this
  // produces nonuniform stress, bending, folds and adaptive topology changes.
  for(let iteration=0;iteration<4;iteration++){
   let correction=Array.from({length:n},()=>[0,0,0]);
   for(const e of this.edges){let delta=sub(this.p[e.j],this.p[e.i]),l=Math.hypot(...delta)||1;let force=(l-e.r)/l*.2;
    for(let q=0;q<3;q++){correction[e.i][q]+=delta[q]*force;correction[e.j][q]-=delta[q]*force;}
   }
   for(let i=0;i<n;i++)if(!this.anchor[i])for(let q=0;q<3;q++)this.p[i][q]+=clamp(correction[i][q],-localEdge[i]*.12,localEdge[i]*.12);
  }
  // Surface-separation relaxation accelerated by a deterministic spatial hash.
  const cell=this.o.detail*.8,bins=new Map();this.p.forEach((p,i)=>{let key=hashCell(...p,cell);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(i);});
  for(let i=0;i<n;i++){
   let p=this.p[i];let xyz=p.map(v=>Math.floor(v/cell));
   for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
    let ids=bins.get(`${xyz[0]+x},${xyz[1]+y},${xyz[2]+z}`);if(!ids)continue;
    for(const j of ids){if(j<=i||this.neighbors[i].has(j))continue;let delta=sub(p,this.p[j]),l=Math.hypot(...delta);let repelRadius=Math.min(cell,(localEdge[i]+localEdge[j])*.55);if(l<1e-7||l>=repelRadius)continue;let f=(repelRadius-l)/l*.06;for(let q=0;q<3;q++){displacement[i][q]+=delta[q]*f;displacement[j][q]-=delta[q]*f;}}
   }
  }
  for(let i=0;i<n;i++)if(!this.anchor[i]){
   let p=this.p[i],avg=[0,0,0];for(const j of this.neighbors[i])for(let q=0;q<3;q++)avg[q]+=(this.p[j][q]-p[q])/this.neighbors[i].size;
   let normalComponent=dot(avg,this.normal[i]);
   for(let q=0;q<3;q++){let tangent=avg[q]-normalComponent*this.normal[i][q];p[q]+=clamp(displacement[i][q],-localEdge[i]*.12,localEdge[i]*.12)+tangent*.025+normalComponent*this.normal[i][q]*.1;}
  }
  // Preserve an injective horizontal chart in the stable single-cup mode.
  // This is a growth constraint, not a fitted target shape: radial distance
  // and height still come from the current force solve. It prevents overhangs.
  for(let i=0;i<n;i++)if(!this.anchor[i]){let r=Math.hypot(this.p[i][0],this.p[i][2]);this.p[i][0]=r*Math.cos(this.chartAngle[i]);this.p[i][2]=r*Math.sin(this.chartAngle[i]);}
  const inverted=()=>this.f.filter(([a,b,c])=>{let A=this.p[a],B=this.p[b],C=this.p[c];return (B[2]-A[2])*(C[0]-A[0])-(B[0]-A[0])*(C[2]-A[2])<1e-10;});
  for(let pass=0;pass<10;pass++){let bad=inverted();if(!bad.length)break;this.orientationBacktracks+=bad.length;for(let f of bad)for(let i of f)this.p[i]=previous[i].slice();}
  if(inverted().length)this.p=previous;
  this.frame++;if(this.frame%4===0&&this.p.length<6500)this.remesh();this.attributes();return this;
 }
 remesh(){
  const split=new Map();const max=this.o.detail*1.6;
  for(const e of this.edges){if(Math.hypot(...sub(this.p[e.i],this.p[e.j]))<max)continue;if(this.anchor[e.i]&&this.anchor[e.j])continue;
   let a=e.i,b=e.j,i=this.p.length;split.set(e.key,i);this.p.push(this.p[a].map((v,q)=>(v+this.p[b][q])*.5));this.chartAngle.push(Math.atan2(this.p[i][2],this.p[i][0]));this.anchor.push(false);this.birth.push(this.frame);this.seedRadius.push((this.seedRadius[a]+this.seedRadius[b])*.5);this.group.push(this.group[a]);this.rest.set(a<i?`${a}:${i}`:`${i}:${a}`,e.r*.5);this.rest.set(b<i?`${b}:${i}`:`${i}:${b}`,e.r*.5);
  }
  if(!split.size)return;const key=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;let faces=[];
  for(const [a,b,c] of this.f){let ab=split.get(key(a,b)),bc=split.get(key(b,c)),ca=split.get(key(c,a));let count=[ab,bc,ca].filter(v=>v!==undefined).length;
   if(count===0)faces.push([a,b,c]);
   else if(count===3)faces.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]);
   else if(count===1){if(ab!==undefined)faces.push([a,ab,c],[ab,b,c]);else if(bc!==undefined)faces.push([b,bc,a],[bc,c,a]);else faces.push([c,ca,b],[ca,a,b]);}
   else {if(ab===undefined)faces.push([c,ca,bc],[a,b,ca],[b,bc,ca]);else if(bc===undefined)faces.push([a,ab,ca],[b,c,ab],[c,ca,ab]);else faces.push([b,bc,ab],[c,a,bc],[a,ab,bc]);}
  }
  this.f=faces;this.splits+=split.size;this.topology();
 }
 snapshot(){return{frame:this.frame,positions:new Float32Array(this.p.flat()),indices:new Uint32Array(this.f.flat()),masks:new Float32Array(this.masks),birth:new Float32Array(this.birth),groups:new Uint8Array(this.group),stats:this.stats()};}
 stats(){let bounds=[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]],area=0;for(const p of this.p)for(let q=0;q<3;q++){bounds[0][q]=Math.min(bounds[0][q],p[q]);bounds[1][q]=Math.max(bounds[1][q],p[q]);}for(const [a,b,c]of this.f){let u=sub(this.p[b],this.p[a]),v=sub(this.p[c],this.p[a]);area+=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])*.5;}return{vertices:this.p.length,triangles:this.f.length,splits:this.splits,area,bounds,frame:this.frame,orientationBacktracks:this.orientationBacktracks};}
}
