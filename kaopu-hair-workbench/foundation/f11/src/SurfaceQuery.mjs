/** Reuse of the existing L03 neutral-triangle query, without teacher grooms or model assets.
 * Source: c89ebc4da8d24ef3decfad85336c5dffb2c471c8 / fusion/r14-l03/src/TeacherGroomBinding.js.
 * Segment centerlines only; not a finite-radius/dynamic solver. */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const unit=a=>mul(a,1/(Math.hypot(...a)||1));
const xyz=(p,i)=>[p[i*3],p[i*3+1],p[i*3+2]];
function rng(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function baryPoint(positions,triangles,t,b){const p=[0,0,0];for(let k=0;k<3;k++){const v=triangles[t*3+k]*3;for(let d=0;d<3;d++)p[d]+=positions[v+d]*b[k];}return p;}
export function teacherVertexNormals(model,positions=model.template){const n=new Float32Array(positions.length),tr=model.triangles;for(let t=0;t<tr.length;t+=3){const a=xyz(positions,tr[t]),b=xyz(positions,tr[t+1]),c=xyz(positions,tr[t+2]),v=cross(sub(b,a),sub(c,a));for(let k=0;k<3;k++)for(let d=0;d<3;d++)n[tr[t+k]*3+d]+=v[d];}for(let v=0;v<n.length;v+=3){const l=Math.hypot(n[v],n[v+1],n[v+2])||1;n[v]/=l;n[v+1]/=l;n[v+2]/=l;}return n;}
function frame(model,p,n,t,b){const root=baryPoint(p,model.triangles,t,b),normal=unit(baryPoint(n,model.triangles,t,b)),a=xyz(p,model.triangles[t*3]),e=sub(xyz(p,model.triangles[t*3+1]),a);const u=unit(sub(e,mul(normal,dot(e,normal)))),v=unit(cross(normal,u));return {root,u,v,n:normal,edge:Math.hypot(...e)};}
function closestTriangle(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return {p:a,b:[1,0,0]};
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return {p:b,b:[0,1,0]};
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return {p:add(a,mul(ab,v)),b:[1-v,v,0]};}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return {p:c,b:[0,0,1]};
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return {p:add(a,mul(ac,w)),b:[1-w,0,w]};}
 const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/(d4-d3+d5-d6);return {p:add(b,mul(sub(c,b),w)),b:[0,1-w,w]};}
 const den=1/(va+vb+vc),v=vb*den,w=vc*den;return {p:add(a,add(mul(ab,v),mul(ac,w))),b:[1-v-w,v,w]};
}
/** Dependency-free neutral-skin BVH, used once while binding. */
export class TeacherSkinBVH{
 constructor(model,positions=model.template,allowed=null,components=[0]){const allowedComponents=new Set(components);this.model=model;this.positions=positions;this.faces=[];const tr=model.triangles;for(let t=0;t<tr.length/3;t++){if(allowed&&!allowed.has(t))continue;if([0,1,2].some(k=>!allowedComponents.has(model.componentId[tr[t*3+k]])))continue;const a=xyz(positions,tr[t*3]),b=xyz(positions,tr[t*3+1]),c=xyz(positions,tr[t*3+2]);this.faces.push({t,a,b,c,n:unit(cross(sub(b,a),sub(c,a))),min:a.map((x,k)=>Math.min(x,b[k],c[k])),max:a.map((x,k)=>Math.max(x,b[k],c[k])),center:a.map((x,k)=>(x+b[k]+c[k])/3)});}this.root=this.build(this.faces);}
 build(f){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const a of f)for(let k=0;k<3;k++){min[k]=Math.min(min[k],a.min[k]);max[k]=Math.max(max[k],a.max[k]);}const node={min,max};if(f.length<=12){node.faces=f;return node;}let axis=0;for(let k=1;k<3;k++)if(max[k]-min[k]>max[axis]-min[axis])axis=k;f.sort((a,b)=>a.center[axis]-b.center[axis]);const mid=f.length>>1;node.left=this.build(f.slice(0,mid));node.right=this.build(f.slice(mid));return node;}
 segmentHit(a,b){const d=sub(b,a);let answer=null,best=1;const box=node=>{let lo=0,hi=best;for(let k=0;k<3;k++){if(Math.abs(d[k])<1e-16){if(a[k]<node.min[k]||a[k]>node.max[k])return false;}else{let x=(node.min[k]-a[k])/d[k],y=(node.max[k]-a[k])/d[k];if(x>y){const t=x;x=y;y=t;}lo=Math.max(lo,x);hi=Math.min(hi,y);if(lo>hi)return false;}}return true;};const visit=node=>{if(!box(node))return;if(node.faces){for(const f of node.faces){const e1=sub(f.b,f.a),e2=sub(f.c,f.a),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-16)continue;const inv=1/det,uvec=sub(a,f.a),u=dot(uvec,h)*inv;if(u<0||u>1)continue;const q=cross(uvec,e1),v=dot(d,q)*inv;if(v<0||u+v>1)continue;const t=dot(e2,q)*inv;if(t>=0&&t<=best){best=t;answer={t,point:add(a,mul(d,t)),normal:f.n,triangle:f.t};}}}else{visit(node.left);visit(node.right);}};visit(this.root);return answer;}
 nearest(p){let best=null,distance=Infinity;const box=n=>{let v=0;for(let k=0;k<3;k++)v+=(p[k]<n.min[k]?n.min[k]-p[k]:p[k]>n.max[k]?p[k]-n.max[k]:0)**2;return v;};const visit=node=>{if(box(node)>distance)return;if(node.faces){for(const f of node.faces){const q=closestTriangle(p,f.a,f.b,f.c),d=dot(sub(p,q.p),sub(p,q.p));if(d<distance){distance=d;best={...q,t:f.t,n:f.n,distance:Math.sqrt(d)};}}}else{const a=box(node.left),b=box(node.right);if(a<b){visit(node.left);visit(node.right);}else{visit(node.right);visit(node.left);}}};visit(this.root);return best;}
}
