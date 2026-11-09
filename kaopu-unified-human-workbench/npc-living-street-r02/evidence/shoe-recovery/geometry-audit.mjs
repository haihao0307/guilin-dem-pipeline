/** Exact current original inner triangles. Numerical diagnostic only. */
export const v=(p,i)=>[p[i*3],p[i*3+1],p[i*3+2]];
export const sub=(a,b)=>a.map((x,k)=>x-b[k]);
export const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm=a=>Math.hypot(...a);
const add=(a,b)=>a.map((x,k)=>x+b[k]),mul=(a,s)=>a.map(x=>x*s);
const bounds=rows=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const t of rows)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],t.lo[k]);hi[k]=Math.max(hi[k],t.hi[k]);}return{lo,hi};};
const boxDistance=(p,n)=>p.reduce((s,x,k)=>s+Math.max(n.lo[k]-x,0,x-n.hi[k])**2,0);
function nearestTriangle(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
 if(d1<=0&&d2<=0)return{point:a,bary:[1,0,0]};
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return{point:b,bary:[0,1,0]};
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const t=d1/(d1-d3);return{point:add(a,mul(ab,t)),bary:[1-t,t,0]};}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return{point:c,bary:[0,0,1]};
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const t=d2/(d2-d6);return{point:add(a,mul(ac,t)),bary:[1-t,0,t]};}
 const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const t=(d4-d3)/((d4-d3)+(d5-d6));return{point:add(b,mul(sub(c,b),t)),bary:[0,1-t,t]};}
 const den=va+vb+vc;if(Math.abs(den)<1e-28){const candidates=[a,b,c].map((q,i)=>({point:q,bary:[+(i===0),+(i===1),+(i===2)]}));return candidates.sort((x,y)=>dot(sub(p,x.point),sub(p,x.point))-dot(sub(p,y.point),sub(p,y.point)))[0];}
 const u=vb/den,w=vc/den;return{point:add(add(a,mul(ab,u)),mul(ac,w)),bary:[1-u-w,u,w]};
}
export function buildSurface(fit,kind='upper'){
 const triangles=[];
 for(const part of fit.model.parts){
  const g=part.geometry,P=g.attributes.position.array,N=g.attributes.normal.array,I=g.index.array;
  if(kind==='upper'&&!/^canvas-(quarter-|rounded-vamp|independent-tongue)/.test(part.id))continue;
  if(kind==='insole'&&part.id!=='insole')continue;
  const groups=kind==='upper'?g.groups.filter(x=>x.materialIndex===1):[{start:0,count:I.length}];
  for(const group of groups)for(let k=group.start;k<group.start+group.count;k+=3){
   const ids=[I[k],I[k+1],I[k+2]],points=ids.map(i=>v(P,i)),normals=ids.map(i=>v(N,i));
   if(kind==='insole'&&normals.reduce((s,n)=>s+n[1],0)<1)continue;
   const area=norm(cross(sub(points[1],points[0]),sub(points[2],points[0])));if(area<=1e-12)continue;
   const lo=[0,1,2].map(j=>Math.min(...points.map(p=>p[j]))),hi=[0,1,2].map(j=>Math.max(...points.map(p=>p[j])));
   triangles.push({part:part.id,triangle:k/3,ids,points,normals,lo,hi,center:lo.map((x,j)=>(x+hi[j])*.5)});
  }
 }
 function build(rows){const box=bounds(rows);if(rows.length<=10)return{...box,rows};const axis=box.hi.map((x,i)=>x-box.lo[i]).reduce((best,x,i,a)=>x>a[best]?i:best,0);rows.sort((a,b)=>a.center[axis]-b.center[axis]);const mid=rows.length>>1;return{...box,left:build(rows.slice(0,mid)),right:build(rows.slice(mid))};}
 const root=build(triangles.slice());
 function nearest(p){let best=Infinity,result=null;const stack=[root];while(stack.length){const n=stack.pop();if(boxDistance(p,n)>best)continue;
  if(n.rows){for(const t of n.rows){const q=nearestTriangle(p,...t.points),delta=sub(p,q.point),d=dot(delta,delta);if(d<best){best=d;const normal=[0,1,2].map(k=>q.bary.reduce((s,b,i)=>s+b*t.normals[i][k],0)),length=norm(normal);result={...q,part:t.part,triangle:t.triangle,ids:t.ids,normal:normal.map(x=>x/length),distanceMm:Math.sqrt(d),signedDistanceMm:(dot(delta,normal)>=0?1:-1)*Math.sqrt(d)};}}}
  else{const a=boxDistance(p,n.left),b=boxDistance(p,n.right);if(a<b){stack.push(n.right,n.left);}else stack.push(n.left,n.right);}}
  return result;
 }
 return{triangles,nearest};
}

export function inspectOrientation(fit){
 const affected=[],byPart={};let rawNormalOver90=0,total=0;
 for(let j=0;j<fit.model.parts.length;j++){
  const part=fit.model.parts[j],source=fit.sourceModel.parts[j],P=part.geometry.attributes.position.array,O=source.geometry.attributes.position.array,I=part.geometry.index.array;
  for(let k=0;k<I.length;k+=3){const ids=[I[k],I[k+1],I[k+2]],old=ids.map(i=>v(O,i)),now=ids.map(i=>v(P,i)),n0=cross(sub(old[1],old[0]),sub(old[2],old[0])),n1=cross(sub(now[1],now[0]),sub(now[2],now[0])),a0=norm(n0),a1=norm(n1);total++;
   if(a0<=1e-10||a1<=1e-10)continue;
   const raw=dot(n0,n1)/a0/a1;if(raw<0)rawNormalOver90++;
   const center=[0,1,2].map(q=>old.reduce((s,p)=>s+p[q],0)/3),J=fit.field.evaluate(center).j,expected=fit.field.normal(n0,J),cosine=dot(expected,n1)/a1;
   if(cosine<=0){byPart[part.id]=(byPart[part.id]||0)+1;affected.push({part:part.id,triangle:k/3,ids,sourcePointsMm:old,actualPointsMm:now,sourceAreaMm2:a0*.5,actualAreaMm2:a1*.5,rawNormalCosine:raw,transportedCentroidNormalCosine:cosine,sourceNormal:n0.map(x=>x/a0),actualNormal:n1.map(x=>x/a1),transportedNormal:expected,jacobian:J,jacobianDeterminant:J[0]*(J[4]*J[8]-J[5]*J[7])-J[1]*(J[3]*J[8]-J[5]*J[6])+J[2]*(J[3]*J[7]-J[4]*J[6]),vertexTransportCosines:old.map(p=>dot(fit.field.normal(n0,fit.field.evaluate(p).j),n1)/a1)});}
  }
 }
 return{totalTriangles:total,rawNormalOver90,transportedNormalDisagreements:affected.length,byPart,affected,
  interpretation:'Centroid differential/straight triangle orientation disagreement is a discretization diagnostic. Positive continuous-map determinant and raw >90deg rotation are separate. No triangle intersection claim is made from this dot test alone.'};
}
