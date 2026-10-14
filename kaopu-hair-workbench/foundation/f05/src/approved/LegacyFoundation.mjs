/** F01. Original KAOPU implementation. Metres, Y-up, Z-front.
 * Shape/reference state is never overwritten by simulation state.
 * Growth is an authored continuous field, not measured biological follicles.
 */
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const V=(p,i)=>[p[3*i],p[3*i+1],p[3*i+2]];
export const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const len=a=>Math.hypot(a[0],a[1],a[2]);
export const unit=a=>mul(a,1/(len(a)||1));
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
export function random(seed){let s=seed>>>0;return()=>{s=(s+0x6d2b79f5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export function signature(a){let h=2166136261;for(const n of a){h=Math.imul(h^Math.round(n*1e7),16777619);}return(h>>>0).toString(16);}
export const REGIONS=['前额','左颞／耳周','右颞／耳周','冠部','后脑枕部','后颈'];
export const PALETTE=['#deb784','#7ec5c6','#9cb0dc','#b3c79d','#7aa7c6','#cc9ead'];
const knots=[[0,.3545],[.34,.355],[.59,.350],[.78,.337],[.99,.316],[1.12,.310],[1.31,.329],[1.53,.328],[1.71,.315],[1.99,.293],[2.27,.270],[2.63,.253],[Math.PI,.249]];
export function hairline(theta,front=0,nape=0){
 const t=Math.abs(theta);let j=0;while(j<knots.length-2&&t>knots[j+1][0])j++;
 const slope=i=>{if(i===0||i===knots.length-1)return 0;const a=(knots[i][1]-knots[i-1][1])/(knots[i][0]-knots[i-1][0]),b=(knots[i+1][1]-knots[i][1])/(knots[i+1][0]-knots[i][0]);return a*b<=0?0:2*a*b/(a+b);};
 const [a,x]=knots[j],[b,y]=knots[j+1],u=clamp((t-a)/(b-a)),u2=u*u,u3=u2*u;
 return (2*u3-3*u2+1)*x+(u3-2*u2+u)*(b-a)*slope(j)+(-2*u3+3*u2)*y+(u3-u2)*(b-a)*slope(j+1)+front*.001*(1-smooth((t-.6)/.6))+nape*.001*smooth((t-2)/.7);
}
export function growth(p,recipe=DEFAULT){
 const theta=Math.atan2(p[0],p[2]-.015),base=p[1]-hairline(theta,recipe.frontMM,recipe.napeMM);
 // Explicit ear no-growth volume. This is authored to this native topology.
 const x=(Math.abs(p[0])-.090)/.020,y=(p[1]-.289)/.034,z=(p[2]-.001)/.024;
 return Math.min(base,(Math.sqrt(x*x+y*y+z*z)-1)*.020);
}
export function region(p){if(p[1]>.382)return 3;if(p[2]<-.025)return p[1]<.292?5:4;if(p[2]>.067)return 0;return p[0]>0?1:2;}
export function normalArray(p,tr){const n=new Float32Array(p.length);for(let i=0;i<tr.length;i+=3){const a=V(p,tr[i]),b=V(p,tr[i+1]),c=V(p,tr[i+2]),v=cross(sub(b,a),sub(c,a));for(let j=0;j<3;j++)for(let k=0;k<3;k++)n[tr[i+j]*3+k]+=v[k];}for(let i=0;i<n.length/3;i++)n.set(unit(V(n,i)),3*i);return n;}
export function point(head,f,b,array=head.positions){let p=[0,0,0];for(let k=0;k<3;k++)p=add(p,mul(V(array,head.triangles[3*f+k]),b[k]));return p;}
export const DEFAULT=Object.freeze({schema:'kaopu/hair-recipe@1',version:'F01',topology:'d79ab67c6e6f5e361a4adbaf484190a00ccce33b77ca82f780de4e2816d27685',seed:20261013,frontMM:0,napeMM:0,partMM:0,lengthMM:235,regionalLengths:[1,.94,.94,1.03,.92,.70],rootAngle:26,curl:0,density:1,stiffness:.56,damping:5,gravity:1,wind:0,color:'#624737',referenceStatus:'structural-demo-not-photo-reconstructed'});
export function validate(raw){if(!raw||raw.schema!==DEFAULT.schema||raw.topology!==DEFAULT.topology)throw Error('方案版本或人物拓扑不匹配');const r={...DEFAULT,...structuredClone(raw)};const ranges={frontMM:[-4,4],napeMM:[-6,6],partMM:[-24,24],lengthMM:[120,320],rootAngle:[20,55],curl:[0,1],density:[.2,1],stiffness:[.15,1],damping:[1,12],gravity:[0,1.5],wind:[0,1]};for(const[k,[a,b]]of Object.entries(ranges))if(!Number.isFinite(r[k])||r[k]<a||r[k]>b)throw Error('参数超出已支持范围：'+k);if(r.seed!==DEFAULT.seed)throw Error('根点种子不匹配');if(!Array.isArray(r.regionalLengths)||r.regionalLengths.length!==6||r.regionalLengths.some(x=>!Number.isFinite(x)||x<.5||x>1.2))throw Error('区域长度无效');if(!/^#[0-9a-f]{6}$/i.test(r.color))throw Error('发色无效');return r;}
export function clipTriangle(head,f,recipe=DEFAULT,margin=0){
 const ids=head.triangles.slice(3*f,3*f+3);if(ids.some(i=>head.components[i]!==0))return[];
 if(ids.every(i=>head.positions[3*i+1]<.228))return[];
 const vertex=b=>{const p=point(head,f,b);return{p,b,s:growth(p,recipe)+margin};};
 const subdiv=ids.some(i=>Math.abs(growth(V(head.positions,i),recipe))<.019)?4:1,polys=[];
 for(let i=0;i<subdiv;i++)for(let j=0;j<subdiv-i;j++){
  const coords=[[i,j],[i+1,j],[i,j+1]],sets=[coords];if(i+j<subdiv-1)sets.push([[i+1,j],[i+1,j+1],[i,j+1]]);
  for(const arr of sets){const tri=arr.map(([a,b])=>vertex([1-(a+b)/subdiv,a/subdiv,b/subdiv]));let poly=[];
   for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3];if(a.s>=0)poly.push(a);if((a.s>=0)!==(b.s>=0)){// bisect the same field used to activate roots
    let lo=0,hi=1;for(let n=0;n<16;n++){const t=(lo+hi)/2,q=mix(a.p,b.p,t);if((growth(q,recipe)+margin>=0)===(a.s>=0))lo=t;else hi=t;}const t=(lo+hi)/2;poly.push({p:mix(a.p,b.p,t),b:mix(a.b,b.b,t),s:0});}}
   if(poly.length>=3){const contour=poly.filter(v=>Math.abs(v.s)<1e-10);for(let k=1;k<poly.length-1;k++)polys.push({f,v:[poly[0],poly[k],poly[k+1]],contour:k===1?contour:[]});}
  }
 }return polys;
}
export function makeDomain(head,recipe=DEFAULT,margin=0){const cells=[],boundary=[];let area=0;for(let f=0;f<head.triangles.length/3;f++){for(const cell of clipTriangle(head,f,recipe,margin)){const[a,b,c]=cell.v.map(v=>v.p),s=len(cross(sub(b,a),sub(c,a)))*.5;if(s<1e-14)continue;area+=s;cell.area=s;cell.cdf=area;cells.push(cell);if(cell.contour.length===2)boundary.push(...cell.contour.map(v=>({f,b:v.b,p:v.p})));}}return{cells,boundary,area};}
export function makeRoots(head,count=2400){const domain=makeDomain(head,DEFAULT,.008),rnd=random(DEFAULT.seed),roots=[];for(let i=0;i<count;i++){const u=rnd()*domain.area;let l=0,h=domain.cells.length-1;while(l<h){const mid=(l+h)>>1;if(domain.cells[mid].cdf<u)l=mid+1;else h=mid;}const c=domain.cells[l],s=Math.sqrt(rnd()),a=1-s,b=s*(1-rnd()),w=[a,b,1-a-b],bc=[0,0,0];for(let j=0;j<3;j++)for(let k=0;k<3;k++)bc[k]+=w[j]*c.v[j].b[k];const p=point(head,c.f,bc);roots.push({id:i,f:c.f,b:bc,p,region:region(p),threshold:rnd()});}return roots;}
export function activeRoot(root,r){return growth(root.p,r)>=-1e-8&&root.threshold<r.density;}
// Neck-blended test pose on the SAME mesh; not a production skeleton clip.
const PIVOT=[0,.248,.015];
export function turn(p,yaw=0,nod=0){if(yaw===0&&nod===0)return p;const w=smooth((p[1]-.175)/.080),x=p[0],y=p[1]-PIVOT[1],z=p[2]-PIVOT[2],a=yaw*w,b=nod*w,cy=Math.cos(a),sy=Math.sin(a),cx=Math.cos(b),sx=Math.sin(b),xx=cy*x+sy*z,zz=-sy*x+cy*z;return[xx,cx*y-sx*zz+PIVOT[1],sx*y+cx*zz+PIVOT[2]];}
export function inverseTurn(p,yaw=0,nod=0){if(yaw===0&&nod===0)return p;let guess=p;for(let i=0;i<4;i++){const w=smooth((guess[1]-.175)/.080),a=-yaw*w,b=-nod*w,cb=Math.cos(b),sb=Math.sin(b),ca=Math.cos(a),sa=Math.sin(a),y=p[1]-PIVOT[1],z=p[2]-PIVOT[2],yy=cb*y-sb*z,zz=sb*y+cb*z;guess=[ca*p[0]+sa*zz,yy+PIVOT[1],-sa*p[0]+ca*zz+PIVOT[2]];}return guess;}
export class DistanceField{
 constructor(meta,values){this.meta=meta;this.values=values;}
 value(p){const m=this.meta,mi=m.min,ds=m.dims,h=m.step,qx=(p[0]-mi[0])/h,qy=(p[1]-mi[1])/h,qz=(p[2]-mi[2])/h;
 if(qx<0||qy<0||qz<0||qx>ds[0]-1||qy>ds[1]-1||qz>ds[2]-1)return .05;
 const ix=Math.min(Math.floor(qx),ds[0]-2),iy=Math.min(Math.floor(qy),ds[1]-2),iz=Math.min(Math.floor(qz),ds[2]-2),fx=qx-ix,fy=qy-iy,fz=qz-iz,w=ds[0],wh=w*ds[1],i=iz*wh+iy*w+ix,v=this.values;
 const a=(v[i]*(1-fx)+v[i+1]*fx)*(1-fy)+(v[i+w]*(1-fx)+v[i+w+1]*fx)*fy,b=(v[i+wh]*(1-fx)+v[i+wh+1]*fx)*(1-fy)+(v[i+wh+w]*(1-fx)+v[i+wh+w+1]*fx)*fy;return a*(1-fz)+b*fz;}

 normal(p){const h=this.meta.step*.5;return unit([this.value(add(p,[h,0,0]))-this.value(add(p,[-h,0,0])),this.value(add(p,[0,h,0]))-this.value(add(p,[0,-h,0])),this.value(add(p,[0,0,h]))-this.value(add(p,[0,0,-h]))]);}
 project(p,clearance,yaw=0,nod=0){let q=inverseTurn(p,yaw,nod),d=this.value(q);if(d>=clearance)return p;for(let i=0;i<3&&d<clearance;i++){q=add(q,mul(this.normal(q),clearance-d+.00003));d=this.value(q);}return turn(q,yaw,nod);}
}
export function makeGuides(head,roots,normals,sdf,recipe=DEFAULT,query=null){
 const candidates=roots.filter(r=>growth(r.p,recipe)>.003),guides=[],count=128,segments=32;
 for(let g=0;g<count;g++){
  const root=candidates[Math.floor(g*candidates.length/count)],p0=root.p,n=unit(point(head,root.f,root.b,normals)),L=recipe.lengthMM*.001*recipe.regionalLengths[root.region],ds=L/segments;
  const side=root.p[0]>=recipe.partMM*.001?1:-1;let p=p0.slice(),direction;
  const target=[side*.8,-.6,-.18],tan=unit(sub(target,mul(n,dot(target,n))));direction=unit(add(mul(tan,Math.cos(recipe.rootAngle*Math.PI/180)),mul(n,Math.sin(recipe.rootAngle*Math.PI/180))));
  const arr=[...p0];
  for(let j=1;j<=segments;j++){
   if(j>1){let down=[0,-1,0];const near=sdf.value(p),normal=sdf.normal(p),onScalp=p[1]>.283&&near<.021,away=Math.exp(-Math.abs(p[0]-recipe.partMM*.001)/.040);
    if(onScalp){const desire=[side*(.35+away*.8),-.9,-.14],tangent=unit(sub(desire,mul(normal,dot(desire,normal))));down=unit(add(tangent,mul(normal,.09)));}
    else{down=[side*.04,-1,root.region===0?.12:-.07];const free=smooth((.29-p[1])/.10),phase=j*.35+root.id*.23;down[0]+=recipe.curl*free*.42*Math.sin(phase);down[2]+=recipe.curl*free*.42*Math.cos(phase);}
    direction=unit(mix(direction,unit(down),.38));
   }
   let next=add(p,mul(direction,ds));const clearance=j===1?.0012:.003;
   next=sdf.project(next,clearance);if(query){const hit=query.nearest(next);if(dot(sub(next,hit.p),hit.n)<.0012)next=add(hit.p,mul(hit.n,.0015));}
   direction=unit(sub(next,p));p=next;arr.push(...p);
  }
  // Actual arc lengths are saved, never confused with straight-line tip distance.
  const lengths=[];for(let j=0;j<segments;j++)lengths.push(len(sub(arr.slice((j+1)*3,(j+2)*3),arr.slice(j*3,(j+1)*3))));
  guides.push({rootId:root.id,region:root.region,rest:new Float64Array(arr),lengths:new Float64Array(lengths),actualLength:lengths.reduce((a,b)=>a+b,0)});
 }return{guides,segments,recipe:structuredClone(recipe),rootSignature:signature(roots.flatMap(r=>[r.f,...r.b]))};
}
/** A compliant position solver. No sine animation is applied to hair vertices.
 * Distance XPBD multipliers + vector rest-curvature XPBD + a weak explicit
 * target support constraint. The support is an ARTISTIC grooming constraint,
 * not a recovered stress-free physical material from a photograph.
 */
export class HairSolver{
 constructor(groom,sdf){this.groom=groom;this.sdf=sdf;this.nodes=groom.segments+1;this.n=groom.guides.length*this.nodes;this.rest=new Float64Array(this.n*3);groom.guides.forEach((g,i)=>this.rest.set(g.rest,i*this.nodes*3));this.x=this.rest.slice();this.prev=this.x.slice();this.v=new Float64Array(this.x.length);this.target=this.x.slice();this.distanceLambda=new Float64Array(this.n);this.curveLambda=new Float64Array(this.x.length);this.targetLambda=new Float64Array(this.x.length);this.time=0;this.steps=0;this.yaw=0;this.nod=0;this.maxError=0;this.contacts=0;this.motion='still';this.recipe=groom.recipe;this.lastMs=0;}
 reset(){this.x.set(this.rest);this.prev.set(this.rest);this.target.set(this.rest);this.v.fill(0);this.time=0;this.yaw=0;this.nod=0;this.maxError=0;this.contacts=0;}
 pose(t){const m=this.motion;return m==='turn'?[.32*Math.sin(t*1.4),0]:m==='nod'?[.09*Math.sin(t*.8),.22*(.5-.5*Math.cos(t*1.2))]:m==='shake'?[.40*Math.sin(t*3.2),.04*Math.sin(t*2)]:[0,0];}
 step(dt=1/60){const started=performance.now(),r=this.recipe,N=this.nodes,seg=N-1;this.time+=dt;[this.yaw,this.nod]=this.pose(this.time);this.prev.set(this.x);this.contacts=0;
  for(let i=0;i<this.n;i++){const q=turn(V(this.rest,i),this.yaw,this.nod);this.target.set(q,i*3);const j=i%N;if(j<2){this.x.set(q,i*3);continue;}const free=j/seg,damp=Math.exp(-r.damping*dt),wind=r.wind*16*(.7+.3*Math.sin(this.time*2.1+i*.017));for(let k=0;k<3;k++){let a=k===1?-9.81*r.gravity:k===0?wind:.25*wind;this.v[3*i+k]=this.v[3*i+k]*damp+a*dt;this.x[3*i+k]+=this.v[3*i+k]*dt;}}
  this.distanceLambda.fill(0);this.curveLambda.fill(0);this.targetLambda.fill(0);
  const lengthAlpha=1e-10/(dt*dt),curveAlpha=(.00000012/(r.stiffness*r.stiffness))/(dt*dt),x=this.x;
  const w=i=>i%N<2?0:1;
  for(let iter=0;iter<6;iter++){
   // Rest curvature: x(i-1)-2*x(i)+x(i+1), rotated with the target head.
   for(let g=0;g<this.groom.guides.length;g++)for(let j=2;j<N-1;j++){const i=g*N+j,a=i-1,b=i+1,wa=w(a),wc=w(i),wb=w(b),den=wa+4*wc+wb+curveAlpha;for(let k=0;k<3;k++){const C=x[3*a+k]-2*x[3*i+k]+x[3*b+k]-(this.target[3*a+k]-2*this.target[3*i+k]+this.target[3*b+k]),li=i*3+k,dl=(-C-curveAlpha*this.curveLambda[li])/den;this.curveLambda[li]+=dl;x[3*a+k]+=wa*dl;x[3*i+k]-=2*wc*dl;x[3*b+k]+=wb*dl;}}
   // Weak, configurable target support; allows gravity/wind/inertia to depart.
   for(let i=0;i<this.n;i++){const j=i%N;if(j<2)continue;const a=(.0002*(.3+j/seg)/r.stiffness)/(dt*dt);for(let k=0;k<3;k++){const t=3*i+k,dl=(-(x[t]-this.target[t])-a*this.targetLambda[t])/(1+a);this.targetLambda[t]+=dl;x[t]+=dl;}}
   // Alternate forward/backward passes improve propagation toward the root.
   for(let g=0;g<this.groom.guides.length;g++)for(let q=0;q<seg;q++){const j=iter%2?seg-1-q:q,a=g*N+j,b=a+1,wa=w(a),wb=w(b);if(wa+wb===0)continue;const d=[x[3*b]-x[3*a],x[3*b+1]-x[3*a+1],x[3*b+2]-x[3*a+2]],l=len(d);if(l<1e-10)continue;const dl=(-(l-this.groom.guides[g].lengths[j])-lengthAlpha*this.distanceLambda[a])/(wa+wb+lengthAlpha);this.distanceLambda[a]+=dl;for(let k=0;k<3;k++){const v=d[k]/l*dl;x[3*a+k]-=wa*v;x[3*b+k]+=wb*v;}}
   if(iter===2||iter===5||iter===8){for(let i=0;i<this.n;i++){const j=i%N;if(j<2)continue;const p=V(x,i),q=this.sdf.project(p,.0018,this.yaw,this.nod);if(len(sub(q,p))>1e-7){this.contacts++;x.set(q,3*i);} // finite-radius nodal guard
    if(j>2){const a=V(x,i-1),b=V(x,i),mid=mul(add(a,b),.5),out=this.sdf.project(mid,.0018,this.yaw,this.nod),d=sub(out,mid);if(len(d)>1e-7){this.contacts++;x.set(add(a,d),3*(i-1));x.set(add(b,d),3*i);}}
   }}
  }
  // Inextensible forward sweep (root-to-tip constraint ordering). Collision
  // residual is independently audited; this is not a swept-contact guarantee.
  for(let g=0;g<this.groom.guides.length;g++)for(let j=2;j<N;j++){const i=g*N+j,a=V(x,i-1),b=V(x,i),v=unit(sub(b,a));x.set(add(a,mul(v,this.groom.guides[g].lengths[j-1])),3*i);}
  this.maxError=0;for(let g=0;g<this.groom.guides.length;g++)for(let j=0;j<N;j++){const i=g*N+j;if(j<2){x.set(V(this.target,i),i*3);this.v.fill(0,i*3,i*3+3);}else{for(let k=0;k<3;k++)this.v[3*i+k]=clamp((x[3*i+k]-this.prev[3*i+k])/dt,-3,3);}if(j>0){const l=len(sub(V(x,i),V(x,i-1))),rest=this.groom.guides[g].lengths[j-1];this.maxError=Math.max(this.maxError,Math.abs(l/rest-1));}}
  this.steps++;this.lastMs=performance.now()-started;return this.lastMs;
 }
 report(){let drift=0;for(let i=0;i<this.n;i+=this.nodes)drift=Math.max(drift,len(sub(V(this.x,i),V(this.target,i))));return{steps:this.steps,seconds:this.time,rootDriftMM:drift*1000,maxSegmentRelativeError:this.maxError,contactsLastStep:this.contacts,solverMs:this.lastMs,finite:this.x.every(Number.isFinite),guideCount:this.groom.guides.length,nodesPerGuide:this.nodes,pose:[this.yaw,this.nod],selfCollision:false,collisionMethod:'native-skin sampled SDF; endpoints + midpoints; not swept CCD',designSupport:'explicit artistic target constraint, not inferred material',bounds:this.sdf.meta};}
}
