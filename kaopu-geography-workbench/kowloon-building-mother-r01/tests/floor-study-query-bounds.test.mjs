import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {prismDistance,localPoint} from './floor-study-prism-reference.mjs';
import {buildHitQueryBoundedAssemblyGLSL,OLD,NEW} from '../whole-building-floor-study-r01/bounded-hit-query.mjs';
const root=new URL('..',import.meta.url).pathname.replace(/\/$/,'');
const {deriveMeasuredCase}=await import(root+'/r07/cases.mjs');
const {controllerFor}=await import(root+'/whole-building-ground-r01/controller.mjs');
const {deriveEvidenceFloorPlan,finitePrism}=await import(root+'/whole-building-floor-study-r01/floor-layout.mjs');
const {packAssemblyDescriptors,ASSEMBLY_SCHEMA}=await import(root+'/r07/assemblies.mjs');
const {buildBoundedAssemblyGLSL}=await import(root+'/whole-building-mobile-r01/bounded-assembly.mjs');
const read=p=>JSON.parse(fs.readFileSync(p));
const measured=deriveMeasuredCase(read(root+'/../hk-three-buildings-r01/geometry/B359971994401063C0.score.json'));
const base=controllerFor('kcc').derive(measured,read(root+'/r07/sources/official-footprints.json'));
const study=deriveEvidenceFloorPlan(base,measured,{registration:read(root+'/whole-building-floor-study-r01/sources/plan-registration.json')});
const specs=study.evidenceModel.archetypes.map(a=>a.spec??a);
const rect=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]];
const world=(r,q)=>[0,1,2].map(i=>r.origin[i]+r.u[i]*q[0]+r.v[i]*q[1]+r.w[i]*q[2]);
let serial=3100;const prism=(name,loops,range,opts={})=>({...finitePrism(name,loops,range,opts),objectId:serial++});
const box=(name,x0,x1,y0,y1,z0,z1,role=10)=>prism(name,[rect(x0,z0,x1,z1)],[y0,y1],{materialRole:role});
const counters={queries:0,baselineDistances:0,prunedDistances:0,skipped:0};
function query(P,p,pruned,distance=prismDistance,local=localPoint,round=x=>x){let best=round(1e20),index=-1,skipped=0;for(let k=0;k<P.length;k++){const r=P[k],q=local(p,r),mid=round(round(r.range[0]+r.range[1])*.5),half=round(round(r.range[1]-r.range[0])*.5),cap=round(Math.abs(round(q[2]-mid))-half),threshold=round(best-round(1e-8));if(pruned&&Math.min(cap,0)>=threshold){skipped++;continue;}const d=distance(r,p);if(d<threshold){best=d;index=k;}}return{distance:best,index,objectId:P[index]?.objectId??0,materialRole:P[index]?.materialRole??0,local:p,skipped};}
function check(P,p,options=[]){const a=query(P,p,false,...options),b=query(P,p,true,...options);counters.queries++;counters.baselineDistances+=P.length;counters.prunedDistances+=P.length-b.skipped;counters.skipped+=b.skipped;assert.deepEqual({...b,skipped:0},{...a,skipped:0},JSON.stringify({p,a,b}));return {a,b};}
let seed=0x70bee;function rnd(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/2**32;}

// Float32 arithmetic mirror of the frozen GLSL evaluator, not a GPU test.
const f=Math.fround,plus=(a,b)=>f(a+b),minus=(a,b)=>f(a-b),times=(a,b)=>f(a*b),divide=(a,b)=>f(a/b);
const dot=(a,b)=>a.reduce((s,v,i)=>plus(s,times(v,b[i])),0),vecsub=(a,b)=>a.map((v,i)=>minus(v,b[i]));
const local32=(p,r)=>{const q=vecsub(p,r.origin);return [dot(q,r.u),dot(q,r.v),dot(q,r.w)];};
function distance32(r,p){const q=local32(p,r);let outer=false,hole=false,nearest=f(1e20);for(let loop=0;loop<r.loops.length;loop++){const l=r.loops[loop];let inside=false;for(let j=0;j<l.length;j++){const a=l[(j+l.length-1)%l.length],b=l[j],ab=vecsub(b,a),ap=vecsub(q.slice(0,2),a),t=Math.max(0,Math.min(1,divide(dot(ap,ab),dot(ab,ab)))),delta=ap.map((v,i)=>minus(v,times(ab[i],t)));nearest=Math.min(nearest,dot(delta,delta));if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<plus(divide(times(minus(b[0],a[0]),minus(q[1],a[1])),minus(b[1],a[1])),a[0]))inside=!inside;}if(loop===0)outer=inside;else hole=hole||inside;}const d=times(f(Math.sqrt(nearest)),outer&&!hole?-1:1),h=minus(Math.abs(minus(q[2],times(plus(r.range[0],r.range[1]),.5))),times(minus(r.range[1],r.range[0]),.5)),aa=Math.max(d,0),bb=Math.max(h,0);return plus(f(Math.sqrt(plus(times(aa,aa),times(bb,bb)))),Math.min(Math.max(d,h),0));}
function f32Primitive(r){return {...r,origin:r.origin.map(f),u:r.u.map(f),v:r.v.map(f),w:r.w.map(f),range:r.range.map(f),loops:r.loops.map(l=>l.map(p=>p.map(f)))};}

test('proposal edits mapField only; all ray acceptance, normal, burial, identity, 1e-8 ordering stay intact',()=>{const s=buildBoundedAssemblyGLSL(specs[0]),p=buildHitQueryBoundedAssemblyGLSL(specs[0]);assert.equal(p.replace('uniform bool uPruneHitQueries;\n','').replace(NEW,OLD),s);assert.ok(p.includes('if(found)h=mapField(ro+rd*t);return found;'));assert.ok(p.includes('if(d<h.distance-1e-8)'));assert.equal(study.evidenceModel.counts.primitives,132);assert.deepEqual(specs.map(s=>s.primitives.length),[90,42]);});

test('inside slab-wall overlap still chooses deeper negative distance, not first or last ray face',()=>{const P=[box('slab',-4,4,-.2,0,-4,4,10),box('wall',-.1,.1,-.3,2,-3,3,12),box('far',8,9,0,2,8,9,11)];for(const p of [[0,-.05,0],[0,0,0],[.1,0,0],[0,1,0],[.10000000001,1,0],[-.1,-.1,-3]])check(P,p);const {a,b}=check(P,[0,-.05,0]);assert.equal(a.index,1);assert.ok(a.distance<0);assert.ok(b.skipped>0);});

test('exact ties and within / beyond 1e-8 retain original ordered owner and role',()=>{const a=box('earlier',-1,1,-1,0,-1,1,10),b=box('later same',-1,1,-1,0,-1,1,12);assert.equal(check([a,b],[0,0,0]).a.index,0);for(const delta of [0,5e-9,1e-8,2e-8]){const c=box('later near',-1,1,-1,delta,-1,1,14),r=check([a,c],[0,0,0]).a;assert.equal(r.index,delta>1e-8?1:0);}});

test('inside a hollow plan, hole/outer boundaries, concavity, cap and side ties',()=>{const P=[prism('hole',[rect(-3,-3,3,3),rect(-1,-1,1,1)],[-.2,.2]),prism('concave',[[[-3,-3],[0,-3],[0,0],[3,0],[3,3],[-3,3]]],[-.1,.5],{materialRole:12})];for(const y of [-.2,-.1,0,.2,.5])for(const x of [-3,-1,-1+1e-10,0,1-1e-10,1,3])for(const z of [-3,-1,0,1,3])check(P,[x,y,z]);});

test('actual 132-prism fixture: vertices, cap/edge neighborhoods and randomized interior/exterior',()=>{for(const s of specs){const P=s.primitives;for(const r of P){for(const l of r.loops)for(let i=0;i<l.length;i++){const a=l[i],b=l[(i+1)%l.length];for(const h of [r.range[0],(r.range[0]+r.range[1])/2,r.range[1]])for(const qxy of [a,[(a[0]+b[0])/2,(a[1]+b[1])/2]]){const p=world(r,[...qxy,h]);check(P,p);for(const e of [-1e-8,1e-8])check(P,p.map((v,j)=>v+r.w[j]*e));}}}for(let i=0;i<1500;i++){const p=[0,1,2].map(a=>s.bounds.min[a]-1+rnd()*(s.bounds.max[a]-s.bounds.min[a]+2));check(P,p);}}});

test('Float32 mirror keeps exact distance, owner, material, local tuple at actual near-boundary inputs',()=>{for(const s of specs){packAssemblyDescriptors(s);const P=s.primitives.map(f32Primitive);for(const r of P){for(const l of r.loops)for(let i=0;i<l.length;i++){const a=l[i],b=l[(i+1)%l.length],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];for(const h of [r.range[0],r.range[1]])for(const xy of [a,mid])for(const e of [-2e-6,0,2e-6])check(P,world(r,[...xy,h]).map((v,j)=>f(v+r.w[j]*e)),[distance32,local32,f]);}}for(let i=0;i<1000;i++)check(P,[0,1,2].map(a=>f(s.bounds.min[a]-1+rnd()*(s.bounds.max[a]-s.bounds.min[a]+2))),[distance32,local32,f]);}});

test('all signed prism composition cases dominate min(cap,0), including tiny Float32 cap values',()=>{for(let i=0;i<100000;i++){const d=f((rnd()-.5)*10**(-45+rnd()*48)),h=f((rnd()-.5)*10**(-45+rnd()*48)),aa=Math.max(d,0),bb=Math.max(h,0),result=plus(f(Math.sqrt(plus(times(aa,aa),times(bb,bb)))),Math.min(Math.max(d,h),0));assert.ok(result>=Math.min(h,0));}});

test('write operation counts only, not a GPU timing claim',()=>{fs.writeFileSync('/tmp/floor-hit-query-check.json',JSON.stringify({fixturePrimitives:132,split:[90,42],...counters,skippedPercent:100*counters.skipped/counters.baselineDistances,gpuExecuted:false,gpuSpeedClaim:false},null,2));console.log(JSON.stringify(counters));assert.ok(counters.skipped>0);});
