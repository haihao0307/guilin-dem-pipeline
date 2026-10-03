'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const C=require('../src/anemone-core.js'),B=require('../src/anemone-body.js');let checks=0;
const check=(value,message)=>{assert(value,message);checks++;};
const near=(a,b,tolerance,message)=>check(Math.abs(a-b)<=tolerance,`${message}: ${a} versus ${b}`);
const hash=a=>crypto.createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const geometry=B.mesh(),hashes=Object.fromEntries(['positions','normals','indices'].map(k=>[k,hash(geometry[k])]));
// Capture the old generator independently. Its exact arrays are the renderer
// contract; fixed hashes below remain useful in small source-only bundles.
const baseline=path.join(__dirname,'../baselines/r03/src/anemone-renderer.js');
if(fs.existsSync(baseline)){const source=fs.readFileSync(baseline,'utf8'),start=source.indexOf('function bodyMesh()'),end=source.indexOf('\nclass Renderer',start),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);};const old=vm.runInNewContext(source.slice(start,end)+'\nbodyMesh()',{C,cross,norm,Float32Array,Uint16Array});for(const key of ['positions','normals','indices'])check(hash(old[key])===hashes[key],`byte-identical r03 ${key}`);}
for(const [key,expected]of Object.entries({positions:'9ce1962183c482ab587610b8d54e91080833654d43b16e33d19c525c21c6ab13',normals:'8c284bdf153e31e112ba369d394ede0e3699e35edfccbe3318e21d7299268279',indices:'ee49c26432f8306530238bec4474787f50310ab40685efef9af6836bd49e87b4'}))check(hashes[key]===expected,'fixed r03 '+key+' hash');
check(geometry.positions instanceof Float32Array&&geometry.normals instanceof Float32Array&&geometry.indices instanceof Uint16Array,'render array types preserved');
check(geometry.indices.length/3===6624,'all 6624 body render triangles retained');
const bvh=new B.TriangleBVH(geometry),body=new B.BodyCollider(geometry);
check(bvh.triangles.length===6528&&bvh.degenerateTriangles===96,'only zero-area center triangles excluded from collision acceleration');
const tri=[[0,0,0],[1,0,0],[0,0,1]];
let q=B.segmentTriangle([.2,1,.2],[.2,-1,.2],...tri);near(q.distance,0,1e-12,'endpoints-outside finite segment crosses triangle');near(q.t,.5,1e-12,'crossing lies within finite segment');
q=B.segmentTriangle([1.1,0,.2],[1.1,.5,.2],...tri);near(q.distance,Math.sqrt(.045),1e-12,'closest triangle edge is tested');near(q.surface[0],.95,1e-12,'edge contact point x');near(q.surface[2],.05,1e-12,'edge contact point z');
q=B.segmentTriangle([-1,.2,.2],[2,.2,.2],...tri);near(q.distance,.2,1e-12,'parallel face overlap with both endpoint projections outside triangle');
q=B.segmentTriangle([-.2,.3,-.2],[-.2,.4,-.2],...tri);near(q.distance,Math.sqrt(.17),1e-12,'closest triangle vertex is tested');
q=B.segmentTriangle([.2,.4,.2],[.2,.4,.2],...tri);near(q.distance,.4,1e-12,'collapsed segment remains a point query');
// Independent dense point-triangle samples validate the analytic tapered query.
let seed=271828;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let test=0;test<40;test++){const a=[random()*3-1,random()*2-1,random()*3-1],b=[random()*3-1,random()*2-1,random()*3-1],r0=random()*.15-.02,r1=random()*.15;const exact=B.segmentTriangle(a,b,...tri,r0,r1);let sampled=Infinity;for(let j=0;j<=2000;j++){const t=j/2000,p=a.map((x,k)=>x+(b[k]-x)*t),s=B.pointTriangle(p,...tri),clear=Math.hypot(...p.map((x,k)=>x-s[k]))-r0-(r1-r0)*t;sampled=Math.min(sampled,clear);}check(exact.clearance<=sampled+1e-10&&sampled-exact.clearance<.002,'analytic tapered capsule distance agrees with independent dense samples');}
q=B.pointTriangle([.5,.3,0],[0,0,0],[0,0,0],[1,0,0]);near(q[0],.5,1e-12,'degenerate point-triangle falls back to finite edge');near(q[1],0,1e-12,'degenerate point-triangle remains finite');
// Verify the optimized broad phase against the complete signed finite query.
for(let test=0;test<120;test++){const a=[random()*3-1.5,random()*1.3-.3,random()*3-1.5],b=[a[0]+random()*.4-.2,a[1]+random()*.4-.2,a[2]+random()*.4-.2],r=random()*.05;if(!bvh.mayTouch(a,b,r)&&!bvh.inside(a.map((x,k)=>(x+b[k])/2))){const full=bvh.capsule(a,b,r,{maxSamples:12});check(full.upperPenetration<=1e-8,'supporting-plane broad phase never drops a true contact');}}
q=bvh.signedPoint([0,.2,0]);check(q.inside&&q.signedDistance<-.19,'deep interior point cannot escape a near-surface AABB query');
q=bvh.signedPoint([0,-.05,0]);check(!q.inside&&q.signedDistance>.049,'closed bottom distinguishes outside');
q=bvh.capsule([0,-.2,0],[0,.8,0],.02);check(q.inside&&q.intersections===2&&q.upperPenetration>.259,'endpoints-outside body crossing detected');check(q.errorBound<2e-6,'crossing depth certified within tolerance');
q=bvh.capsule([0,.2,0],[.1,.2,0],.02,{maxSamples:8});check(q.inside&&q.upperPenetration>=.22,'deep wholly interior segment detected');check(q.errorBound>0&&q.upperPenetration>=q.penetration,'exhausted depth refinement exposes conservative bound, never false zero');
q=bvh.capsule([0,-.1,0],[0,-.05,0],.02);near(q.clearance,.03,1e-12,'bottom finite capsule clearance');
q=bvh.capsule([0,-.01,0],[.1,-.01,0],.02);check(q.upperPenetration>.00999,'closed bottom surface blocks a capsule');
// TEST_FIXTURE_ONLY: a closed box is never imported by production geometry.
const TEST_FIXTURE_ONLY={positions:new Float32Array([-1,-1,-1,1,-1,-1,1,1,-1,-1,1,-1,-1,-1,1,1,-1,1,1,1,1,-1,1,1]),indices:new Uint16Array([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5])};
const cube=new B.TriangleBVH(TEST_FIXTURE_ONLY);q=cube.capsule([-2,0,0],[2,0,0],.1);check(q.intersections===2&&q.inside,'box crossing has both external endpoints and two finite intersections');near(q.penetration,1.1,1e-10,'box crossing reaches deepest center point');
for(const point of [[0,0,0],[.9,.9,.9],[-.9,-.9,-.9]])check(cube.signedPoint(point).inside,'box signed-inside positive on interior');for(const point of [[0,2,0],[2,0,0],[0,0,-2]])check(!cube.signedPoint(point).inside,'box signed-inside negative on exterior');
// A single isolated segment with a nonzero material index never becomes a root.
const makeSystem=(a,b,{local=0,root=null,radius=.03,restLength=.04,inverseMass=[0,1]}={})=>({positions:new Float64Array([...a,...b]),segmentA:new Int32Array([0]),segmentB:new Int32Array([1]),radius:new Float64Array([radius]),roots:[root||{x:a[0],y:a[1],z:a[2],radius}],chain:new Int32Array([0]),local:new Int32Array([local]),restLength:new Float64Array([restLength]),inverseMass:new Float64Array(inverseMass)});
const x=.3,z=.1,y=C.discAttachment(x,z),normal=bvh.nearestPoint([x,y,z]).normal,root={x,y,z,radius:.03,normal},p=[x,y,z],along=d=>p.map((v,k)=>v+normal[k]*d);
let system=makeSystem(p,along(.04),{root});let m=body.measure(system);check(m.bodyChecked&&m.bodyPenetration<2e-6,'root attaches to actual mesh within permitted socket');check(m.bodyRawPenetration>.0299&&m.bodySocketExclusions===1,'raw root capsule overlap retained and socket exclusion explicit');
const original=Array.from(system.positions);body.project(system);check(original.every((x,i)=>system.positions[i]===x),'legal attached root requires no projection');
system=makeSystem(p,along(-.002),{root,restLength:.005});m=body.measure(system);check(m.bodyPenetration<2e-6&&m.bodyDeepestCenterlineEntry>=.0019,'shallow root entry permitted and reported');
system=makeSystem(p,along(-.012),{root,restLength:.005});m=body.measure(system);check(m.bodyPenetration>.03,'root entry deeper than .25R rejected');
system=makeSystem(along(.05),along(-.02),{root,local:3});m=body.measure(system);check(m.bodyPenetration>.04&&m.bodySocketExclusions===0,'distal return cannot use root socket');
const other=[.7,C.discAttachment(.7,.1),.1];system=makeSystem(other,[other[0],other[1]+.01,other[2]],{root,restLength:.01});m=body.measure(system);check(m.bodyPenetration>.0299&&m.bodySocketExclusions===0,'arclength alone cannot grant a different spatial socket');
system=makeSystem(p,[p[0]+.09,p[1],p[2]],{root,restLength:.01});m=body.measure(system);check(m.bodyPenetration>.015,'root tangent-cylinder lateral bound is enforced');
system=makeSystem([0,.2,0],[.1,.2,0],{root,local:5,inverseMass:[1,1]});m=body.measure(system);check(m.bodyPenetration>.21&&m.bodySocketExclusions===0,'isolated deep distal segment reported without socket');
for(let i=0;i<12;i++)body.project(system);m=body.measure(system);check(m.bodyPenetration<1e-5,'projection moves a deeply interior free segment out of the exact body');
check(system.positions.every(Number.isFinite),'body projection remains finite');
// The real ContactSystem uses cumulative rest arclength and exact mesh normals.
const Contact=require('../src/anemone-contact.js');const production=new Contact.ContactSystem({...C.DEFAULTS,count:120},{body});m=body.measure(production);check(m.bodyChecked&&m.bodyPenetration<2e-6,'120 real initialized chains pass body collision');check(m.bodySocketExclusions>=120,'real sockets are reported separately');
console.log(JSON.stringify({passed:true,checks,meshHashes:hashes,bodyMetrics:m},null,2));
