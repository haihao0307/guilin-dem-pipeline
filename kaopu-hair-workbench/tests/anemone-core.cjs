const assert=require('assert'),crypto=require('crypto'),C=require('../src/anemone-core.js');
const hash=a=>crypto.createHash('sha256').update(Buffer.from(a.buffer)).digest('hex');const s={...C.DEFAULTS};let checks=0;
function check(v,msg){assert(v,msg);checks++;}
const roots=C.roots(s),p=C.solve(s,roots,0),q=C.solve(s,roots,3);check(hash(p)!==hash(q),'current motion changes distal vertices');check(hash(p)===hash(C.solve(s,C.roots(s),0)),'seed deterministic');
for(const time of [0,1,10,500,10000]){const m=C.metrics(s,roots,C.solve(s,roots,time));check(m.finite,'finite geometry');check(m.rootError<1e-6,'root anchored');check(m.attachmentError<1e-6,'roots on actual disc triangles');check(m.lengthError<1e-5,'polyline arclength preserved');}
for(const count of [120,560])for(const current of [0,1])for(const length of [.35,1.05]){const state={...s,count,current,length},r=C.roots(state),m=C.metrics(state,r,C.solve(state,r,32));check(m.finite&&m.rootError<1e-6&&m.lengthError<1e-5,'bounded extreme geometry');}
const still={...s,current:0,turbulence:0},rs=C.roots(still);check(hash(C.solve(still,rs,0))===hash(C.solve(still,rs,10)),'zero current/noise is static');check(hash(C.solve({...s,seed:74},C.roots({...s,seed:74}),0))!==hash(p),'seed changes roots');
const curved=C.roots(still),cd=C.solve(still,curved,0);let ratio=0;for(let i=0;i<curved.length;i++){const b=i*(C.SEGMENTS+1)*4,e=b+C.SEGMENTS*4;ratio+=Math.hypot(cd[e]-cd[b],cd[e+1]-cd[b+1],cd[e+2]-cd[b+2])/curved[i].length;}ratio/=curved.length;check(ratio<.95,'static rest centerlines are genuinely curved rather than straight tilted rods');
assert.throws(()=>C.validate({...s,count:9999}));checks++;console.log(JSON.stringify({passed:true,checks,baseline:C.metrics(s,roots,p),hash:hash(p)},null,2));
