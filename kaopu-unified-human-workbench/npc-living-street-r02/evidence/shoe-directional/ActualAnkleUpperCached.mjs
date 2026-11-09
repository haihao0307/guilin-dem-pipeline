/** Bounded single-pose experiment. Not imported by production. */
import {MeshContact} from '../../vendor/appearance/cloth-adapted/mesh-contact.mjs';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],xyz=(p,i)=>[p[i*3],p[i*3+1],p[i*3+2]];
const mul=(a,b)=>Array.from({length:9},(_,i)=>{const r=Math.floor(i/3),c=i%3;return a[r*3]*b[c]+a[r*3+1]*b[c+3]+a[r*3+2]*b[c+6];});
const smooth=u=>{const x=clamp(u);return{v:x*x*x*(10+x*(-15+6*x)),d:30*x*x*(1-x)*(1-x)};};
function tensor(rows){const H=9,A=12,values=Array.from({length:H},()=>new Float64Array(A)),wrap=i=>(i%A+A)%A,cell=t=>((t/(2*Math.PI))%1+1)%1*A;
 const basis=u=>{const v=1-u;return{w:[v*v*v/6,(3*u*u*u-6*u*u+4)/6,(-3*u*u*u+3*u*u+3*u+1)/6,u*u*u/6],d:[-v*v/2,(9*u*u-12*u)/6,(-9*u*u+6*u+3)/6,u*u/2]};};
 for(const [h,a,v]of rows){const i=Math.min(H-2,Math.floor(clamp(h)*(H-1))),j=Math.floor(cell(a));for(let x=i-1;x<=i+2;x++)for(let y=j-1;y<=j+2;y++)values[clamp(x,0,H-1)][wrap(y)]=Math.max(values[clamp(x,0,H-1)][wrap(y)],v);}
 return{values:values.map(x=>Array.from(x)),sample(h,a){const x=clamp(h)*(H-1),i=Math.min(H-2,Math.floor(x)),y=cell(a),j=Math.floor(y),b=basis(x-i),c=basis(y-j);let value=0,dh=0,da=0;
  for(let n=0;n<4;n++)for(let k=0;k<4;k++){const v=values[clamp(i+n-1,0,H-1)][wrap(j+k-1)];value+=v*b.w[n]*c.w[k];dh+=v*b.d[n]*c.w[k];da+=v*b.w[n]*c.d[k];}
  return{value,dh:dh*(H-1),da:da*A/(2*Math.PI)};}};
}
export function createActualAnkleUpperCached(actor,fit,bodyInFootRest,cache){
 if(!cache)throw Error("Explicit per-immutable-fit cache required");if(cache.fit&&cache.fit!==fit)throw Error("Cache belongs to a different fit");if(cache.actor&&cache.actor!==actor)throw Error("Cache belongs to a different actor");cache.fit=fit;cache.actor=actor;
 const {foot,field:base,model}=fit,S=fit.scaleM,body=new MeshContact(bodyInFootRest,actor.nativeSource.faces),neutral=(cache.neutral||(cache.neutral=new MeshContact(actor.nativeSource.positions,actor.nativeSource.faces))),cx=-base.mirror*base.centerR/S,cz=-base.centerF/S,r1=foot.length*.7/S;
 const native=p=>{const r=base.mirror*p[0]*S+base.centerR,f=p[2]*S+base.centerF;return[foot.foot[0]+foot.right[0]*r+foot.forward[0]*f,foot.foot[1]+foot.right[1]*r+foot.forward[1]*f,p[1]*S+base.baseZ];};
 const allowed=new Set(actor.rig.names.map((name,i)=>new RegExp('^(lowerleg0[12]|foot|toe[^.]+)\\.'+foot.side+'$').test(name)?i:-1));allowed.delete(-1);
 function ownTriangle(face){for(let k=0;k<3;k++){const id=actor.nativeSource.faces[face+k];for(let n=0;n<actor.binding.displayRange[id*4+1];n++){const q=(actor.binding.displayRange[id*4]+n)*8;if(actor.binding.displayPacked[q+4]>0&&!allowed.has(actor.binding.displayPacked[q+3]))return false;}}return true;}
 function exit(origin,direction){let best=Infinity,hit=null;const stack=[0],P=body.p,I=body.faces;
  while(stack.length){const node=body.nodes[stack.pop()],b=node.box;let lo=0,hi=best;for(let k=0;k<3;k++){if(Math.abs(direction[k])<1e-14){if(origin[k]<b[k]||origin[k]>b[k+3]){hi=-1;break;}}else{let a=(b[k]-origin[k])/direction[k],c=(b[k+3]-origin[k])/direction[k];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);}}if(hi<lo)continue;
   if(node.left>=0){stack.push(node.left,node.right);continue;}
   for(let k=node.lo;k<node.hi;k++){const f=body.tri[k],a=xyz(P,I[f]),u=sub(xyz(P,I[f+1]),a),v=sub(xyz(P,I[f+2]),a),n=cross(u,v),out=dot(n,direction);if(out<=1e-14)continue;const h=cross(direction,v),den=dot(u,h);if(Math.abs(den)<1e-20)continue;const s=sub(origin,a),b=dot(s,h)/den;if(b<0||b>1)continue;const q=cross(s,u),c=dot(direction,q)/den;if(c<0||b+c>1)continue;const t=dot(v,q)/den;if(t>=0&&t<best){best=t;hit={distance:t,cosine:out/Math.hypot(...n),face:f};}}
  }return hit;
 }
 const samples=cache.samples||[],vertices=new Set(),edges=new Set();let ymax=cache.ymax||0,soleCeiling=cache.soleCeiling??-Infinity;
 if(!cache.samples){
 for(const part of model.parts){const P=part.geometry.attributes.position.array,I=part.geometry.index.array;
  if(/sole|heel|rubber|welt/.test(part.id+' '+part.role))for(let i=1;i<P.length;i+=3)soleCeiling=Math.max(soleCeiling,P[i]);
  if(!/^canvas-(quarter-|rounded-vamp|independent-tongue)/.test(part.id))continue;
  for(const g of part.geometry.groups.filter(g=>g.materialIndex===1))for(let k=g.start;k<g.start+g.count;k+=3){const ids=[I[k],I[k+1],I[k+2]],p=ids.map(i=>xyz(P,i));
   for(let j=0;j<3;j++){const key=part.id+'/'+ids[j];if(!vertices.has(key)){vertices.add(key);samples.push({p:p[j],part:part.id,kind:'vertex',vertex:ids[j]});}}
   samples.push({p:[0,1,2].map(j=>(p[0][j]+p[1][j]+p[2][j])/3),part:part.id,kind:'center',triangle:k/3});
   for(let j=0;j<3;j++){const n=(j+1)%3,a=ids[j],b=ids[n],key=part.id+'/'+Math.min(a,b)+'/'+Math.max(a,b);if(!edges.has(key)){edges.add(key);samples.push({p:p[j].map((v,c)=>(v+p[n][c])*.5),part:part.id,kind:'edge',edge:[a,b]});}}
  }
 }
 for(const s of samples)ymax=Math.max(ymax,s.p[1]);cache.samples=samples;cache.ymax=ymax;cache.soleCeiling=soleCeiling;
 }
 const heightBand=model.last.style.sole,q=new Float64Array(4),qn=new Float64Array(4),measured=[],failures=[];let r0=Infinity,minimumBefore=Infinity,minimumNeutral=Infinity;
 for(const s of samples){const p=s.p,nativePoint=s.nativePoint||(s.nativePoint=native(p)),f=body.nearest(...nativePoint);body.evaluate(f,...nativePoint,q);if(s.neutralResult)qn.set(s.neutralResult);else{neutral.sample(...nativePoint,qn);s.neutralResult=Float64Array.from(qn);}minimumBefore=Math.min(minimumBefore,q[0]);minimumNeutral=Math.min(minimumNeutral,qn[0]);
  const target=Math.min(base.report.clearanceTargetM,qn[0]);if(q[0]>=.001)continue;
  if(!ownTriangle(f)){failures.push({sample:s,reason:'actual obstruction is not exclusively the same native lowerleg/foot/toe',bodyFace:f/3,distanceM:q[0]});continue;}
  const x=p[0]-cx,z=p[2]-cz,r=Math.hypot(x,z),height=smooth((p[1]-soleCeiling)/heightBand).v;
  if(r<1e-7||r>=r1||height<=0){failures.push({sample:s,reason:'outside fixed-sole/local ankle support',distanceM:q[0]});continue;}
  const direction=[(foot.right[0]*base.mirror*x+foot.forward[0]*z)/r,(foot.right[1]*base.mirror*x+foot.forward[1]*z)/r,0];let move;
  if(q[0]<0){const hit=exit(nativePoint,direction);if(!hit||hit.cosine<=.05||!ownTriangle(hit.face)){failures.push({sample:s,reason:'no same-foot directed original-surface exit',distanceM:q[0],hit});continue;}move=hit.distance+target/hit.cosine;}
  else{const cosine=dot(direction,Array.from(q.subarray(1)));if(cosine<=.05){failures.push({sample:s,reason:'radial increase cannot recover actual native margin',distanceM:q[0],cosine});continue;}move=(target-q[0])/cosine;}
  measured.push({...s,r,height,move,initialM:q[0],neutralM:qn[0],targetM:target,bodyFace:f/3});r0=Math.min(r0,r);
 }
 if(failures.length)return{constructed:false,report:{schema:'actual-native-ankle-upper-candidate/1',failures,measured:measured.length,minimumBefore,minimumNeutral,soleCeiling,heightBand}};
 if(!measured.length)r0=r1*.25;
 const radial=r=>{const low=r<r0,u=low?r/r0:(r-r0)/(r1-r0),q=smooth(u);return low?{g:q.v,dg:q.d/r0}:{g:1-q.v,dg:-q.d/(r1-r0)};};
 const requirements=measured.map(s=>[s.p[1]/ymax,Math.atan2(s.p[0]-cx,s.p[2]-cz),s.move/(S*s.height*radial(s.r).g)]),envelope=tensor(requirements),maximum=Math.max(...envelope.values.flat()),radialDerivativeLowerBound=1-maximum*1.875/(r1-r0);
 const report={schema:'actual-native-ankle-upper-candidate/1',scope:'one actual pose, original same-foot full-CSR body displacement relative to native foot; no production import',driver:'complete current body inverse-transformed by actual foot skin matrix versus the original neutral body',allBodyVertices:actor.nativeSource.bodyCount,allBodyTriangles:actor.nativeSource.faces.length/3,samples:samples.length,measured:measured.length,minimumBefore,minimumNeutral,soleCeiling,heightBand,radialSupportMm:[r0,r1],heightRangeMm:ymax,maximumRadialFieldMm:maximum,radialDerivativeLowerBound,controls:envelope.values,largest:measured.slice().sort((a,b)=>b.move-a.move).slice(0,10),yChangeMm:0,soleIsFixed:true};
 if(!(radialDerivativeLowerBound>0))return{constructed:false,report:{...report,reason:'positive radial Jacobian bound rejected'}};
 const field={...base,report:{...base.report,dynamicUpperCandidate:report},evaluate(p){const q=base.evaluate(p),y=q.p[1],h=smooth((y-soleCeiling)/heightBand);if(h.v===0)return q;
  const x=q.p[0]-cx,z=q.p[2]-cz,r=Math.hypot(x,z);if(r<1e-10||r>=r1)return q;const e=envelope.sample(y/ymax,Math.atan2(x,z)),d=e.value*h.v;if(d===0)return q;
  const dy=e.dh/ymax*h.v+e.value*h.d/heightBand,da=e.da*h.v,a=radial(r),f=1+d*a.g/r,R=d*(a.dg*r-a.g)/(r*r*r),Y=dy*a.g/r,A=da*a.g/(r*r*r),dx=R*x+A*z,dz=R*z-A*x;
  const J=[f+x*dx,Y*x,x*dz,0,1,0,z*dx,Y*z,f+z*dz];return{p:[cx+x*f,y,cz+z*f],j:mul(J,q.j)};
 }};
 return{constructed:true,field,report};
}
