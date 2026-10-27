'use strict';
const path=require('path'),fs=require('fs');
const SP=require('./steam-path.original.js'),C=SP.create(),packet=require('./load-original-samples')();
const F=Math.fround,A=(a,b)=>F(F(a)+F(b)),S=(a,b)=>F(F(a)-F(b)),M=(a,b)=>F(F(a)*F(b)),D=(a,b)=>F(F(a)/F(b)),sq=a=>M(a,a),sqrt=a=>F(Math.sqrt(F(a))),min=(...x)=>Math.min(...x.map(F)),max=(...x)=>Math.max(...x.map(F)),clamp=(x,a,b)=>min(max(x,a),b),v=a=>a.map(F),add=(a,b)=>a.map((x,i)=>A(x,b[i])),sub=(a,b)=>a.map((x,i)=>S(x,b[i])),mul=(a,s)=>a.map(x=>M(x,s)),dot=(a,b)=>A(A(M(a[0],b[0]),M(a[1],b[1])),M(a[2],b[2])),norm=a=>sqrt(dot(a,a)),unit=a=>mul(a,D(1,norm(a)));
const sin=x=>F(Math.sin(F(x))),cos=x=>F(Math.cos(F(x))),acos=x=>F(Math.acos(F(x))),tan=x=>F(Math.tan(F(x))),atan2=(y,x)=>F(Math.atan2(F(y),F(x)));
function poly(b){const b2=sq(b);return [M(b,A(1,M(b2,A(D(-1,6),M(b2,S(D(1,120),D(b2,5040))))))), A(1,M(b2,A(-.5,M(b2,S(D(1,24),D(b2,720))))))];}
function point(p,beta,algebraic){if(Array.isArray(p))return v(p);const b=p.side===1?F(beta):0,[s,c]=algebraic?poly(b):[sin(b),cos(b)];return[A([-.82,0,.82][p.side],p.x),A(A(1.016,M(p.station,s)),M(p.r,c)),S(M(p.station,c),M(p.r,s))];}
function fillet(a,b,c,bend,algebraic){const u=unit(sub(a,b)),w=unit(sub(c,b)),co=clamp(dot(u,w),-.999999,.999999);let tanHalf,cosHalf;if(algebraic){cosHalf=sqrt(M(.5,A(1,co)));tanHalf=D(sqrt(M(.5,S(1,co))),cosHalf);}else{const half=M(acos(co),.5);cosHalf=cos(half);tanHalf=tan(half);}
 const t=min(D(bend,tanHalf),M(.35,min(norm(sub(a,b)),norm(sub(c,b))))),r=M(t,tanHalf),center=add(b,mul(unit(add(u,w)),D(t,cosHalf))),start=add(b,mul(u,t)),end=add(b,mul(w,t)),e=unit(sub(start,center)),f=unit(sub(sub(end,center),mul(e,dot(sub(end,center),e)))),en=unit(sub(end,center));return{start,end,center,e,f,r,angle:acos(clamp(dot(en,e),-1,1)),ca:dot(en,e),sa:dot(en,f)};
}
function segment(p,a,b){const d=sub(b,a),t=clamp(D(dot(sub(p,a),d),dot(d,d)),0,1);return norm(sub(sub(p,a),mul(d,t)));}
function arc(p,f,algebraic){const q=sub(p,f.center);if(algebraic){const x=dot(q,f.e),y=dot(q,f.f),rho=sqrt(A(sq(x),sq(y)));let d=min(norm(sub(q,mul(f.e,f.r))),norm(sub(q,mul(add(mul(f.e,f.ca),mul(f.f,f.sa)),f.r))));if(y>=0&&S(M(x,f.sa),M(y,f.ca))>=0&&rho>0){const dir=mul(add(mul(f.e,x),mul(f.f,y)),D(f.r,rho));d=min(d,norm(sub(q,dir)));}return d;}
 const a=atan2(dot(q,f.f),dot(q,f.e));let d=min(norm(sub(q,mul(f.e,f.r))),norm(sub(q,mul(add(mul(f.e,cos(f.angle)),mul(f.f,sin(f.angle))),f.r))));if(a>=0&&a<=f.angle)d=min(d,norm(sub(q,mul(add(mul(f.e,cos(a)),mul(f.f,sin(a))),f.r))));return d;
}
function pathDistance(p,pts,bend,algebraic){if(pts.length===2)return segment(p,pts[0],pts[1]);const cs=pts.slice(1,-1).map((b,i)=>fillet(pts[i],b,pts[i+2],bend,algebraic));let d=F(1e10);for(let i=0;i<pts.length-1;i++)d=min(d,segment(p,i===0?pts[0]:cs[i-1].end,i===pts.length-2?pts.at(-1):cs[i].start));for(const f of cs)d=min(d,arc(p,f,algebraic));return d;}
function scalar(n,p,beta,algebraic=false){
 if(n.op==='box'){const q=p.map((x,i)=>S(Math.abs(S(x,n.c[i])),n.h[i]));return A(norm(q.map(x=>max(x,0))),min(max(...q),0));}
 if(n.op==='capsule'||n.op==='cylinder'){const a=point(n.a,beta,algebraic),b=point(n.b,beta,algebraic),d=sub(b,a),l=norm(d),u=mul(d,D(1,l)),q=sub(p,a),t=dot(q,u);return n.op==='cylinder'?max(S(norm(sub(q,mul(u,t))),n.r),-t,S(t,l)):S(segment(p,a,b),n.r);}
 if(n.op==='path'||n.op==='tube'){const pts=n.points.map(q=>point(q,beta,algebraic)),d=pathDistance(p,pts,n.bend,algebraic);if(n.op==='path')return S(d,n.r);return max(S(d,n.ro),S(n.ri,d),-dot(sub(p,pts[0]),unit(sub(pts[1],pts[0]))),dot(sub(p,pts.at(-1)),unit(sub(pts.at(-1),pts.at(-2)))));}
 if(n.op==='hexY'){const q=sub(p,n.c);return max(S(max(Math.abs(q[0]),Math.abs(A(M(.5,q[0]),M(.8660254037844386,q[2]))),Math.abs(A(M(-.5,q[0]),M(.8660254037844386,q[2])))),n.apothem),S(n.lo,p[1]),S(p[1],n.hi));}
 if(n.op==='lens'){const q=sub(p,n.c),xz=sqrt(A(sq(q[0]),sq(q[2]))),xy=[D(S(xz,n.major),n.radial),D(q[1],n.half)];return M(min(n.radial,n.half),S(sqrt(A(sq(xy[0]),sq(xy[1]))),1));}
 if(n.op==='union')return min(...n.nodes.map(x=>scalar(x,p,beta,algebraic)));
 if(n.op==='subtract')return max(scalar(n.a,p,beta,algebraic),-scalar(n.b,p,beta,algebraic));
 throw new Error(n.op);
}
const reports=[];for(const algebraic of [false,true]){const rows=packet.samples.map(s=>{const n=s.kind==='part'?C.byId[s.id].ast:C.hostCuts[s.id].ast,actual=scalar(n,v(s.point),F(s.beta),algebraic);return {...s,actual,error:Math.abs(actual-s.expectedCPU)};});reports.push({model:algebraic?'Float32, polynomial beta and algebraic fillets/arcs':'Float32, accurately rounded native trig',samples:rows.length,maxError:Math.max(...rows.map(r=>r.error)),over4micron:rows.filter(r=>r.error>4e-6).length,nonfinite:rows.filter(r=>!Number.isFinite(r.actual)).length,worst:rows.sort((a,b)=>b.error-a.error).slice(0,5),centerWitnesses:rows.filter(r=>r.kind==='cut'&&r.id==='actuation/middle_cylinder_wall'&&r.point[0]===.1)});}
const report={limits:'CPU explicit binary32 operation model, not GPU execution. Native trig modeled as accurately rounded Math trig, not actual driver approximations.',reports};if(require.main===module){fs.writeFileSync(path.join(__dirname,'FLOAT32_MODEL_QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
module.exports={point,scalar,poly,fillet,pathDistance};
