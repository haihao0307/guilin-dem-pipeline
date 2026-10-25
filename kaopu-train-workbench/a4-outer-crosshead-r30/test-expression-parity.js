/* Standalone, dependency-free test of emitted GLSL expressions.
 * Parses the emitted source, NOT the input AST, into an independent evaluator.
 * Float32 is an arithmetic emulation, NOT actual GPU numerical verification.
 */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const API=require('./outer-crosshead'),C=API.create();
function compileExpression(source){
 const tok=source.match(/(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?|[A-Za-z_]\w*|[-+*/(),.]/gi)||[];let i=0;
 const peek=()=>tok[i],take=()=>tok[i++],expect=s=>assert.strictEqual(take(),s);
 function atom(){let t=take(),node;if(t==='-')node={op:'neg',a:atom()};else if(t==='('){node=expr();expect(')');}else if(/^\d|^\.\d/.test(t))node={op:'constant',value:Number(t)};else if(peek()==='('){take();let args=[];if(peek()!==')')do{args.push(expr());if(peek()!==',')break;take();}while(true);expect(')');node={op:'call',name:t,args};}else node={op:'variable',name:t};
  while(peek()==='.'){take();node={op:'swizzle',a:node,axes:take()};}return node;}
 function expr(){let a=atom();while(peek()==='-'||peek()==='+'){const op=take(),b=atom();a={op,a,b};}return a;}
 const node=expr();assert.strictEqual(i,tok.length,'Unparsed emitted GLSL tokens');return node;
}
function evaluator(float32){
 const R=float32?Math.fround:x=>x,A=(a,b)=>R(a+b),S=(a,b)=>R(a-b),M=(a,b)=>R(a*b),V=v=>v.map(R);
 const minus=(a,b)=>Array.isArray(a)?a.map((v,i)=>S(v,b[i])):S(a,b);
 const plus=(a,b)=>Array.isArray(a)?a.map((v,i)=>A(v,b[i])):A(a,b);
 const dot=(a,b)=>a.reduce((s,v,i)=>A(s,M(v,b[i])),R(0));
 const length=a=>R(Math.sqrt(dot(a,a))),max=(...a)=>R(Math.max(...a)),min=(...a)=>R(Math.min(...a));
 const calls={vec3:(...a)=>V(a.length===1?[a[0],a[0],a[0]]:a),max,min,length,
  ocRoundBox:(p,c,h,r)=>{const q=p.map((v,i)=>S(Math.abs(S(v,c[i])),S(h[i],r)));return S(A(length(q.map(v=>max(v,0))),min(max(...q),0)),r);},
  ocCylinder:(q,axis,lo,hi,r)=>max(S(length(q.filter((v,i)=>i!==axis)),r),max(S(lo,q[axis]),S(q[axis],hi))),
  ocCapsule:(p,a,b,r)=>{const d=minus(b,a),w=minus(p,a),den=dot(d,d),t=den>0?max(0,min(1,R(dot(w,d)/den))):0;return S(length(w.map((v,i)=>S(v,M(d[i],t)))),r);}
 };
 function run(n,q){
  if(n.op==='constant')return R(n.value);
  if(n.op==='variable'){assert.strictEqual(n.name,'q');return q;}
  if(n.op==='neg'){const a=run(n.a,q);return Array.isArray(a)?a.map(v=>R(-v)):R(-a);}
  if(n.op==='-')return minus(run(n.a,q),run(n.b,q));
  if(n.op==='+')return plus(run(n.a,q),run(n.b,q));
  if(n.op==='swizzle'){const a=run(n.a,q);return n.axes.split('').map(c=>a['xyz'.indexOf(c)]);}
  if(n.op==='call'){assert(calls[n.name],'Unknown emitted GLSL function '+n.name);return calls[n.name](...n.args.map(a=>run(a,q)));}
  throw Error('Unexpected expression '+n.op);
 }
 return{run,referencePoint:(world,origin)=>world.map((v,i)=>S(R(v),R(origin[i])))};
}
const double=evaluator(false),float=evaluator(true),compiled=new Map();
for(const part of C.parts){const pattern=new RegExp('float '+part.glsl_function+'\\(vec3 p\\)\\{vec3 q=p-vec3\\(([^;]+)\\);return (.+);\\}');const m=C.source.match(pattern);assert(m);const origin=m[1].split(',').map(Number);assert.deepStrictEqual(origin,part.origin);compiled.set(part.id,{tree:compileExpression(m[2]),origin});}
let seed=46171211;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
let samples=0,maxDoubleError=0,maxFloat32Error=0,nearBoundarySignDifferences=0,unsafeSignDifferences=0,maxLipschitzRatio=0,boundsViolations=0;
function check(part,world){const {tree,origin}=compiled.get(part.id),cpu=C.referenceScalar(part.id,world),d=double.run(tree,double.referencePoint(world,origin)),f=float.run(tree,float.referencePoint(world,origin));assert(Number.isFinite(cpu)&&Number.isFinite(d)&&Number.isFinite(f));maxDoubleError=Math.max(maxDoubleError,Math.abs(cpu-d));maxFloat32Error=Math.max(maxFloat32Error,Math.abs(cpu-f));if((cpu<0)!==(f<0)){if(Math.max(Math.abs(cpu),Math.abs(f))<4e-6)nearBoundarySignDifferences++;else unsafeSignDifferences++;}samples++;}
function prove(node,subtractVoid=false){
 if(node.op==='roundBox'){assert(node.h.every(v=>v>0)&&node.r>=0&&node.h.every(v=>node.r<=v));return 'Euclidean box SDF with radius: 1-Lipschitz.';}
 if(node.op==='cylinder'){assert(node.hi>node.lo&&node.r>0);return 'Max of radial Euclidean distance and normalized axial half-spaces: 1-Lipschitz.';}
 if(node.op==='capsule'){assert(node.r>0);return 'Distance to finite segment minus radius: 1-Lipschitz.';}
 if(node.op==='throughBore'){assert(subtractVoid&&node.r>0);return 'Distance to an infinite axis line minus radius: 1-Lipschitz; used only as subtracted bore.';}
 if(node.op==='subtract'){prove(node.a,subtractVoid);prove(node.b,true);return 'max(a,-b) preserves the max of the operand Lipschitz bounds.';}
 assert(['union','intersect'].includes(node.op));node.nodes.forEach(n=>prove(n,subtractVoid));return 'min/max preserves the max of the operand Lipschitz bounds.';
}
for(const part of C.parts){
 prove(part.ast);const b=API.bounds(part.ast),size=b[1].map((v,j)=>v-b[0][j]);
 for(let i=0;i<600;i++){
  const q=b[0].map((v,j)=>v+(random()*1.2-.1)*size[j]),other=q.map(v=>v+(random()-.5)*.004),world=q.map((v,j)=>v+part.origin[j]);check(part,world);
  const a=API.scalar(part.ast,q),z=API.scalar(part.ast,other),distance=Math.hypot(...q.map((v,j)=>v-other[j]));if(distance>0)maxLipschitzRatio=Math.max(maxLipschitzRatio,Math.abs(a-z)/distance);
  if(q.some((v,j)=>v<b[0][j]-1e-12||v>b[1][j]+1e-12)&&a<0)boundsViolations++;
 }
 // Include AABB corners and centre, nominal pin/bore/wall surfaces, not only bulk points.
 const qs=[[0,0,0],[0,.012,0],[0,.01215,0],[0,.0135,0],[.025,0,.0145],[.025,.026,0],[0,.016,.046],[0,.0162,.046],[0,0,.0445],[0,0,.053],[.052,0,.0105]];
 for(let k=0;k<8;k++)qs.push([0,1,2].map(j=>k&(1<<j)?b[1][j]:b[0][j]));
 for(const q of qs)check(part,q.map((v,j)=>v+part.origin[j]));
}
assert(maxDoubleError<2e-13);assert(maxFloat32Error<4e-6);assert.strictEqual(unsafeSignDifferences,0);assert(maxLipschitzRatio<=1+2e-10);assert.strictEqual(boundsViolations,0);
const report={version:C.version,status:'PASS emitted-expression parser parity and analytic bound checks; GPU still separate',sourceSHA256:crypto.createHash('sha256').update(C.source).digest('hex'),fields:C.parts.length,samples,maxCPUvsEmittedDoubleError_m:maxDoubleError,maxCPUvsEmulatedFloat32Error_m:maxFloat32Error,nearBoundarySignDifferences,unsafeSignDifferences,maxRandomPairLipschitzRatio:maxLipschitzRatio,outsideSupportNegativeSamples:boundsViolations,certifiedScalarLipschitz:1,manifestLipschitz:1.000002,boundProof:['Every scalar primitive is 1-Lipschitz in Euclidean XYZ.','Finite min/max and negation retain a 1-Lipschitz bound; holes are the identical subtracted expression in CPU and GLSL.','Rigid outside-valve inverse matrices preserve Euclidean norm.','The support AABB is composed from analytic primitive supports; subtraction cannot enlarge a solid; intersection takes intersected supports.','Manifest 1.000002 adds a numerical guard, not an additional physical clearance.'],notClaimed:['Float32 emulation is not execution of a GPU shader.','Random-pair checks are supplementary checks, not the analytic Lipschitz proof.','Actual compiled WebGL output must be checked in the integrated whole scene.']};
fs.writeFileSync(path.join(__dirname,'EXPRESSION_PARITY_QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
