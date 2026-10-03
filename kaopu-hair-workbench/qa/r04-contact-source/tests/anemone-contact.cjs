'use strict';
/* Narrow CPU contract fixtures for the original discrete-time capsule kernel.
 * This is not temporal CCD, a 360-chain animation benchmark, browser QA, or
 * evidence of acceptable motion/visual quality. Small ContactSystem states
 * deliberately bypass C.validate's UI-only count minimum of 120 for speed.
 * The one dense root test uses an actual supported UI count/radius input.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const C=require('../src/anemone-core.js');
const K=require('../src/anemone-contact.js');
const B=require('../src/anemone-body.js');
const started=performance.now(),groups=[],failures=[],evidence={};
let checks=0;
const check=(value,message)=>{assert(value,message);checks++;};
const near=(actual,expected,tolerance,message)=>check(Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance,`${message}: ${actual} versus ${expected} (tolerance ${tolerance})`);
function group(name,run){const before=checks;try{run();groups.push({name,passed:true,checks:checks-before});}catch(error){groups.push({name,passed:false,checks:checks-before});failures.push({name,error:error.message});}}
const add=(a,b)=>a.map((x,k)=>x+b[k]);
const sub=(a,b)=>a.map((x,k)=>x-b[k]);
const mul=(a,s)=>a.map(x=>x*s);
const dot=(a,b)=>a.reduce((sum,x,k)=>sum+x*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp01=x=>Math.max(0,Math.min(1,x));
const pointSegment=(point,a,b)=>{const u=sub(b,a),uu=dot(u,u),t=uu?clamp01(dot(sub(point,a),u)/uu):0;return {t,distance:Math.hypot(...sub(point,add(a,mul(u,t))))};};
// Independent active-set oracle: four finite boundary minima plus the
// unconstrained interior minimum computed with cross products. It neither
// calls the production closest routine nor samples endpoints as a substitute
// for continuous finite-segment distance.
function referenceDistance(a,b,c,d){
 const candidates=[pointSegment(a,c,d).distance,pointSegment(b,c,d).distance,pointSegment(c,a,b).distance,pointSegment(d,a,b).distance];
 const u=sub(b,a),v=sub(d,c),w=sub(c,a),n=cross(u,v),nn=dot(n,n);
 if(nn>0){const s=dot(cross(w,v),n)/nn,t=dot(cross(w,u),n)/nn;if(s>=0&&s<=1&&t>=0&&t<=1)candidates.push(Math.hypot(...sub(add(a,mul(u,s)),add(c,mul(v,t)))));}
 return Math.min(...candidates);
}
function query(a,b,c,d){const positions=new Float64Array([...a,...b,...c,...d]),out={};check(K.closest(positions,0,3,6,9,out)===out,'closest uses caller-owned output');return out;}
function verifyClosest(a,b,c,d,label,expected,tolerance=2e-10){
 const q=query(a,b,c,d),oracle=referenceDistance(a,b,c,d);
 check(q.s>=0&&q.s<=1&&q.t>=0&&q.t<=1,label+': finite segment parameters');
 for(const key of ['s','t','x','y','z','distance','ux','uy','uz','vx','vy','vz'])check(Number.isFinite(q[key]),label+': finite '+key);
 near(q.distance,oracle,tolerance,label+': independent active-set distance');
 if(expected!==undefined)near(q.distance,expected,tolerance,label+': analytic distance');
 const delta=sub(add(a,mul(sub(b,a),q.s)),add(c,mul(sub(d,c),q.t)));
 for(let k=0;k<3;k++)near(q[['x','y','z'][k]],delta[k],tolerance,label+': closest-point witness '+k);
 near(Math.hypot(q.x,q.y,q.z),q.distance,tolerance,label+': witness norm');
 for(const [aa,bb,cc,dd]of [[c,d,a,b],[b,a,c,d],[a,b,d,c]])near(query(aa,bb,cc,dd).distance,oracle,tolerance,label+': swap/reversal invariance');
 return q;
}
group('finite closest segments: crossing, shallow, parallel, collinear, and collapsed',()=>{
 const radians=5*Math.PI/180,co=Math.cos(radians),si=Math.sin(radians);
 const cases=[
  {name:'X crossing with distant endpoints',p:[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0]],d:0,s:.5,t:.5},
  {name:'5 degree interior crossing',p:[[-2,0,0],[2,0,0],[-2*co,-2*si,0],[2*co,2*si,0]],d:0,s:.5,t:.5},
  {name:'5 degree skew interior closest points',p:[[-2,0,0],[2,0,0],[-2*co,-2*si,.0017],[2*co,2*si,.0017]],d:.0017,s:.5,t:.5},
  {name:'finite endpoint clamping',p:[[0,0,0],[1,0,0],[2,1,0],[2,2,0]],d:Math.SQRT2,s:1,t:0},
  {name:'parallel overlapping intervals',p:[[0,0,0],[2,0,0],[.5,.03,0],[1.5,.03,0]],d:.03},
  {name:'parallel disjoint intervals',p:[[0,0,0],[1,0,0],[2,.3,0],[3,.3,0]],d:Math.hypot(1,.3)},
  {name:'collinear overlap',p:[[0,0,0],[2,0,0],[.5,0,0],[1.5,0,0]],d:0},
  {name:'collinear disjoint',p:[[0,0,0],[1,0,0],[2,0,0],[3,0,0]],d:1},
  {name:'first segment is a point',p:[[.4,.03,0],[.4,.03,0],[0,0,0],[1,0,0]],d:.03,s:0,t:.4},
  {name:'second segment is a point',p:[[0,0,0],[1,0,0],[.4,.03,0],[.4,.03,0]],d:.03,s:.4,t:0},
  {name:'two distinct points',p:[[0,0,0],[0,0,0],[1,2,3],[1,2,3]],d:Math.sqrt(14),s:0,t:0},
  {name:'two coincident points',p:[[1,2,3],[1,2,3],[1,2,3],[1,2,3]],d:0,s:0,t:0}
 ];
 for(const fixture of cases){const q=verifyClosest(...fixture.p,fixture.name,fixture.d);if(fixture.s!==undefined)near(q.s,fixture.s,2e-10,fixture.name+': expected s');if(fixture.t!==undefined)near(q.t,fixture.t,2e-10,fixture.name+': expected t');}
 check(Math.min(...cases[0].p.slice(0,2).flatMap(a=>cases[0].p.slice(2).map(b=>Math.hypot(...sub(a,b)))))>1,'X fixture cannot pass with endpoint-only distance');
 for(const scale of [.001,1,1000]){const translated=cases[2].p.map(p=>add(mul(p,scale),[-4.2,1.6,-.13]));verifyClosest(...translated,'scaled translated shallow crossing',.0017*scale,Math.max(2e-10,scale*2e-10));}
 evidence.analyticClosestCases=cases.length+3;
});
group('seeded closest distances against independent finite-segment oracle',()=>{
 let seed=314159;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let i=0;i<180;i++){const points=Array.from({length:4},()=>Array.from({length:3},()=>random()*4-2));if(i%17===0)points[1]=points[0].slice();if(i%29===0)points[3]=points[2].slice();verifyClosest(...points,'seeded segment pair '+i);}
 evidence.seededClosestCases=180;
});
// Minimal disconnected segment fixture for the actual hash enumeration API.
// It is not used as a solver or as a substitute for a real ContactSystem.
function segmentFixture(segments){
 const s=Object.create(K.ContactSystem.prototype),n=segments.length;
 Object.assign(s,{M:n,positions:new Float64Array(n*6),segmentA:new Int32Array(n),segmentB:new Int32Array(n),radius:new Float64Array(n),chain:new Int32Array(n),local:new Int32Array(n),restLength:new Float64Array(n),cellSize:.12,buckets:new Map(),activeBuckets:[],seen:new Int32Array(n),gridBounds:new Int32Array(n*6),segmentBounds:new Float64Array(n*6)});
 segments.forEach((v,i)=>{s.positions.set([...v.a,...v.b],i*6);s.segmentA[i]=2*i;s.segmentB[i]=2*i+1;s.radius[i]=v.radius??.02;s.chain[i]=v.chain??i;s.local[i]=v.local??0;s.restLength[i]=v.restLength??.01;});return s;
}
const endpoint=(s,node)=>Array.from(s.positions.subarray(node*3,node*3+3));
// Production roots have a fixed, uniform rest length within each chain.
// This independent predicate uses that contract, never current geometric length.
const expectedExcluded=(s,i,j)=>s.chain[i]===s.chain[j]&&Math.max(0,Math.abs(s.local[i]-s.local[j])-1)*s.restLength[i]<=s.radius[i]+s.radius[j]+K.SKIN;
function compareHashWithBrute(s,label,extra=0){
 const expected=new Map(),enumerated=new Map(),actualNear=new Map();let brutePairs=0;
 for(let i=0;i<s.M;i++)for(let j=i+1;j<s.M;j++){
  if(expectedExcluded(s,i,j))continue;brutePairs++;
  const distance=referenceDistance(endpoint(s,s.segmentA[i]),endpoint(s,s.segmentB[i]),endpoint(s,s.segmentA[j]),endpoint(s,s.segmentB[j]));
  if(distance<=s.radius[i]+s.radius[j]+K.SKIN+extra)expected.set(i+':'+j,distance);
 }
 const stats=s.pairs((i,j)=>{
  const key=i+':'+j;check(i<j,label+': ordered unique pair');check(!enumerated.has(key),label+': no duplicate pair');check(!expectedExcluded(s,i,j),label+': material-neighbor exclusion');
  const q={};K.closest(s.positions,s.segmentA[i]*3,s.segmentB[i]*3,s.segmentA[j]*3,s.segmentB[j]*3,q);
  const oracle=referenceDistance(endpoint(s,s.segmentA[i]),endpoint(s,s.segmentB[i]),endpoint(s,s.segmentA[j]),endpoint(s,s.segmentB[j]));
  near(q.distance,oracle,2e-10,label+': every emitted distance agrees with independent oracle');enumerated.set(key,q.distance);
  if(q.distance<=s.radius[i]+s.radius[j]+K.SKIN+extra)actualNear.set(key,q.distance);
 },extra);
 check(expected.size>0,label+': fixture has contacts or skin-near pairs');
 assert.deepEqual([...actualNear.keys()].sort(),[...expected.keys()].sort(),label+': full hash misses no brute-force near pair');checks++;
 for(const [key,distance]of expected)near(enumerated.get(key),distance,2e-10,label+': required near-pair distance '+key);
 check(stats.checked===enumerated.size,label+': reported candidate count is exact');
 return {name:label,segments:s.M,brutePairs,nearPairs:expected.size,hashCandidates:enumerated.size,extra};
}
group('full spatial hash versus all finite pairs on small geometric scenes',()=>{
 const co=Math.cos(5*Math.PI/180),si=Math.sin(5*Math.PI/180);
 const geometric=segmentFixture([
  {a:[-1,0,0],b:[1,0,0]},
  {a:[0,-1,0],b:[0,1,0]},
  {a:[-co,-si,.018],b:[co,si,.018]},
  {a:[-.7,.04,0],b:[.7,.04,0]},
  {a:[-.4,0,0],b:[.4,0,0]},
  {a:[.6,.005,0],b:[1.2,.005,0]},
  {a:[.12,-.12,.012],b:[.12,-.12,.012],radius:.025},
  {a:[.1,-.12,.015],b:[.14,-.12,.015],radius:.015},
  {a:[-.2401,-.12,-.12],b:[-.0001,-.12,-.12],radius:.006},
  {a:[-.12,-.1201,-.109],b:[-.12,-.12,-.109],radius:.006},
  {a:[2,2,2],b:[2.1,2.1,2.1]}
 ]);
 evidence.hashScenes=[compareHashWithBrute(geometric,'crossing/parallel/collinear/collapsed/negative cells')];
 let seed=271828;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const randomSegments=Array.from({length:24},()=>({a:Array.from({length:3},()=>random()*.6-.3),b:Array.from({length:3},()=>random()*.6-.3),radius:.006+random()*.034}));
 const randomScene=segmentFixture(randomSegments);
 evidence.hashScenes.push(compareHashWithBrute(randomScene,'seeded 24-segment scene'));
 evidence.hashScenes.push(compareHashWithBrute(randomScene,'seeded contact buffer',.012));
 // Move the existing fixture across cells to exercise hash clearing/rebuild.
 for(let k=0;k<randomScene.positions.length;k+=3){randomScene.positions[k]+=.731;randomScene.positions[k+1]-=.247;randomScene.positions[k+2]+=.119;}
 evidence.hashScenes.push(compareHashWithBrute(randomScene,'reused hash after translation'));
 const boundary=segmentFixture([{a:[-.05,0,0],b:[.05,0,0],radius:.01},{a:[-.05,.023,0],b:[.05,.023,0],radius:.01}]);
 evidence.hashScenes.push(compareHashWithBrute(boundary,'exact sum of radii plus skin boundary'));
});
group('production ContactSystem hashed and brute measurements agree',()=>{
 const s=new K.ContactSystem({...C.DEFAULTS,count:4});
 for(let c=0;c<s.roots.length;c++){const angle=c*Math.PI/4;for(let j=0;j<=s.S;j++){const t=(j/s.S-.5)*.8,k=(c*(s.S+1)+j)*3;s.positions[k]=Math.cos(angle)*t;s.positions[k+1]=.8+Math.sin(angle)*t;s.positions[k+2]=c*.008;}}
 const hashed=s.measure(),brute=s.measure({brute:true});
 check(brute.contactViolations>0,'crossed actual ContactSystem has detectable violations');
 for(const key of ['maxPenetration','skinDeficit'])near(hashed[key],brute[key],1e-12,'hashed/brute '+key);
 check(hashed.contactViolations===brute.contactViolations,'hashed/brute violation count agrees');
 evidence.hashScenes.push(compareHashWithBrute(s,'4 real chains with nonlocal crossings'));
 evidence.crossedMetrics={maxPenetration:brute.maxPenetration,skinDeficit:brute.skinDeficit,contactViolations:brute.contactViolations};
});
group('fixed roots and fixed rest lengths survive length projection',()=>{
 const s=new K.ContactSystem({...C.DEFAULTS,count:2}),rest=Array.from(s.restLength),target=Array.from(s.target),roots=s.roots.map(r=>[r.x,r.y,r.z]);
 for(let c=0;c<s.roots.length;c++)for(let j=1;j<=s.S;j++){const k=(c*(s.S+1)+j)*3,u=j/s.S;s.positions[k]+=.018*Math.sin(u*Math.PI*1.6);s.positions[k+1]+=.08*u;s.positions[k+2]+=.01*u*u;}
 const before=s.measure({skipContacts:true});check(before.lengthRelative>.1,'length fixture starts with meaningful error');
 for(let iteration=0;iteration<4;iteration++)s.projectLengths();
 const after=s.measure({skipContacts:true});check(after.lengthRelative<1e-10,'length projection reaches strict segment residual');check(after.arcRelative<1e-10,'length projection reaches strict arc residual');
 for(let c=0;c<s.roots.length;c++){assert.deepEqual(endpoint(s,c*(s.S+1)),roots[c],'root position is bitwise unchanged');checks++;check(s.inverseMass[c*(s.S+1)]===0,'root inverse mass remains zero');}
 assert.deepEqual(Array.from(s.restLength),rest,'projection must not repair errors by rewriting rest lengths');checks++;
 assert.deepEqual(Array.from(s.target),target,'projection leaves kinematic target untouched');checks++;
 check(after.finite&&after.rootError===0,'projected coordinates finite with exact roots');
 evidence.lengthProjection={calls:4,before:before.lengthRelative,after:after.lengthRelative,arcRelative:after.arcRelative,rootError:after.rootError};
});
function oneBend(excess,scale=1){
 const s=new K.ContactSystem({...C.DEFAULTS,count:1}),r=s.roots[0],length=r.length/s.S,limit=2*Math.asin(Math.min(.95,length/(4*r.radius))),angle=limit+excess;
 r.normal=[0,1,0];s.positions.set([r.x,r.y,r.z],0);
 for(let j=1;j<=s.S;j++){const direction=j===1?[0,1,0]:[Math.sin(angle),Math.cos(angle),0];for(let k=0;k<3;k++)s.positions[j*3+k]=s.positions[(j-1)*3+k]+length*scale*direction[k];}
 return {s,limit};
}
group('actual normalized joint-angle gate and bend projection',()=>{
 const projected=[];
 for(const scale of [.6,1,1.8]){
  const {s,limit}=oneBend(.025,scale),root=endpoint(s,0),before=s.measure({skipContacts:true});
  near(before.bendViolation,.025,2e-12,'bend excess is angle-based, independent of segment scale '+scale);
  check(!s.validShape(before),'excess bend fails shape gate at scale '+scale);s.projectBends();
  const after=s.measure({skipContacts:true});check(after.bendViolation>=0&&after.bendViolation<.001,'projection reduces the same normalized-angle residual at scale '+scale);
  assert.deepEqual(endpoint(s,0),root,'bend projection keeps fixed root');checks++;
  check(after.finite,'bend projection stays finite');projected.push({scale,limit,before:before.bendViolation,after:after.bendViolation});
 }
 const below=oneBend(-.0001).s,allowed=oneBend(.0099).s,rejected=oneBend(.0101).s;
 near(below.measure().bendViolation,0,1e-12,'curvature limit boundary has no artificial excess');
 check(allowed.validShape(allowed.measure()),'measured bend just within 0.01-radian gate accepted');
 check(!rejected.validShape(rejected.measure()),'measured bend just beyond 0.01-radian gate rejected');
 evidence.bendProjection=projected;
});
group('different-chain neighbors never receive same-chain exclusions',()=>{
 const s=segmentFixture([{a:[-1,0,0],b:[1,0,0],chain:0,local:0},{a:[0,-1,0],b:[0,1,0],chain:1,local:0},{a:[-1,.001,0],b:[1,.001,0],chain:2,local:1}]);
 check(!s.localExcluded(0,1)&&!s.localExcluded(0,2)&&!s.localExcluded(1,2),'same or adjacent local indices across chains are eligible');
 const result=compareHashWithBrute(s,'different-chain material neighbors');check(result.nearPairs===3,'all three different-chain contacts checked');
});
group('same-chain exclusion has fixed material-arclength boundary',()=>{
 const s=segmentFixture(Array.from({length:6},(_,i)=>({a:[i*.01,0,0],b:[(i+1)*.01,0,0],radius:.0085,chain:0,local:i,restLength:.01})));
 near(s.radius[0]+s.radius[3]+K.SKIN,.02,1e-15,'fixture exclusion threshold');
 check(s.localExcluded(0,1),'adjacent same-chain segments excluded');check(s.localExcluded(0,2),'sub-threshold material gap excluded');
 check(s.localExcluded(0,3)&&s.localExcluded(3,0),'exact material-arclength boundary excluded symmetrically');
 check(!s.localExcluded(0,4)&&!s.localExcluded(4,0),'first beyond-boundary pair remains eligible');
 const before=Array.from({length:6},(_,i)=>s.localExcluded(0,i));
 // Folding all geometry onto one X must not expand material exclusions.
 for(let i=0;i<s.M;i++)s.positions.set(i%2?[-.1,0,0,.1,0,0]:[0,-.1,0,0,.1,0],i*6);
 assert.deepEqual(Array.from({length:6},(_,i)=>s.localExcluded(0,i)),before,'deformed distances cannot rewrite fixed material neighborhood');checks++;
 const result=compareHashWithBrute(s,'folded same-chain beyond local boundary');check(result.nearPairs===3,'three nonlocal folded contacts retained');
 const {s:curved}=oneBend(.03);check(curved.measure().bendViolation>.0299,'local-neighbor exclusions do not waive the curvature gate');
 check(!curved.validShape(curved.measure()),'excess local curvature is independently rejected');
});
group('root-density feasibility rejects atomically and legal roots attach to actual mesh',()=>{
 const state={...C.DEFAULTS,count:120,thickness:.015},layout=K.legalRoots(state);
 check(layout.roots.length===120&&layout.minClearance>=K.SKIN-.0001,'legal supported density has skin-separated roots');
 for(const r of layout.roots){near(r.y,C.discAttachment(r.x,r.z),1e-12,'root uses actual disc triangle height');near(Math.hypot(...r.normal),1,1e-12,'root has unit attachment normal');}
 const old=new K.ContactSystem({...C.DEFAULTS,count:2}),oldPositions=Array.from(old.positions),oldRoots=JSON.stringify(old.roots),attempt={...C.DEFAULTS,count:560,thickness:.045},input=JSON.stringify(attempt);
 let error;try{new K.ContactSystem(attempt);}catch(caught){error=caught;}
 check(error&&error.code==='ROOT_LAYOUT_INFEASIBLE','unsupported count/radius density throws explicit feasibility code');
 check(Number.isFinite(error.minClearance)&&error.minClearance<K.SKIN-.0001,'rejection carries measured failed root clearance');
 check(Number.isInteger(error.iterations)&&error.iterations>0,'rejection carries root-layout iteration count');
 assert.deepEqual(Array.from(old.positions),oldPositions,'failed replacement cannot mutate previous legal coordinates');checks++;
 check(JSON.stringify(old.roots)===oldRoots,'failed replacement cannot mutate previous legal roots');check(JSON.stringify(attempt)===input,'rejected caller state is unchanged');
 evidence.rootRejection={code:error.code,minClearance:error.minClearance,iterations:error.iterations,legalMinimum:layout.minClearance};
});
group('bodyChecked is truthful and real body collider is measured/projected when injected',()=>{
 const bare=new K.ContactSystem({...C.DEFAULTS,count:2});check(bare.measure().bodyChecked===false,'no body means bodyChecked=false');check(bare.valid(bare.measure({skipBody:true})),'absent optional collider does not invent a body-check requirement');
 const body=new B.BodyCollider(),calls={measure:0,project:0},injected={measure(system){calls.measure++;return body.measure(system);},project(system){calls.project++;return body.project(system);}};
 const s=new K.ContactSystem({...C.DEFAULTS,count:2},{body:injected}),initial=s.measure();
 check(initial.bodyChecked===true&&initial.bodyCheckedSegments===s.M,'real injected mesh measures all segments');
 check(initial.bodyTriangles===6528&&initial.bodyDegenerateTriangles===96,'injected collider uses exact shared body mesh contract');
 check(initial.bodyPenetration<2e-6&&initial.bodyRawPenetration>.02&&initial.bodySocketExclusions>0,'legal sockets report raw overlap separately from forbidden penetration');
 const measuredBeforeSkip=calls.measure,uncheckedBody=s.measure({skipBody:true});
 check(uncheckedBody.bodyChecked===false&&calls.measure===measuredBeforeSkip,'skipBody truthfully marks unavailable check and avoids actual body query');
 check(uncheckedBody.contactsChecked&&s.validShape(uncheckedBody),'shape-only precheck remains available with pair checks retained');
 check(!s.valid(uncheckedBody),'injected but unchecked body can never pass final validity');
 const uncheckedBoth=s.measure({skipBody:true,skipContacts:true});check(!uncheckedBoth.bodyChecked&&!uncheckedBoth.contactsChecked&&!s.valid(uncheckedBoth),'neither omitted check can be mistaken for final acceptance');
 const step=s.step(1/30,{maxSweeps:4,targetStrength:0});
 check(calls.project>0&&calls.measure>=3,'step calls body projector and final body measurement');
 check(step.accepted&&step.sweeps===1&&step.bodyChecked&&step.bodyPenetration<2e-6,'single stationary injected-body step passes first-sweep final measured shape');
 const omitted=s.measure({skipContacts:true});check(!omitted.contactsChecked&&omitted.maxPenetration===null&&omitted.contactViolations===null,'skipped contact metrics explicitly unavailable');check(!s.valid(omitted),'unchecked contact metrics can never pass final validity');
 check(omitted.bodyChecked===true,'skipping pair queries does not skip injected body measurement');
 // One distal material segment enters the real closed body, outside any root socket.
 const tip=s.S*3;s.positions.set([0,.2,0],tip);s.positions.set([.01,.2,0],tip-3);
 const penetrated=s.measure({skipContacts:true});check(penetrated.bodyChecked&&penetrated.bodyPenetration>.19,'deep distal real-body penetration is reported');
 check(penetrated.bodyInsideSegments>0&&!s.validShape(penetrated),'body penetration fails shape gate');
 evidence.body={initialCheckedSegments:initial.bodyCheckedSegments,initialPenetration:initial.bodyPenetration,rawPenetration:initial.bodyRawPenetration,stationaryStepAccepted:step.accepted,deepDistalPenetration:penetrated.bodyPenetration,calls};
});
const source=fs.readFileSync(path.join(__dirname,'../src/anemone-contact.js'));
console.log(JSON.stringify({passed:failures.length===0,checks,groups,failures,scope:'CPU finite-segment geometry, complete small-scene spatial hash, fixed-root/rest-length and normalized-angle projections, material exclusions, density rejection, injected shared body; no temporal CCD, population animation, browser, or visual acceptance claim',sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),elapsedMs:performance.now()-started,evidence},null,2));
if(failures.length)process.exitCode=1;
