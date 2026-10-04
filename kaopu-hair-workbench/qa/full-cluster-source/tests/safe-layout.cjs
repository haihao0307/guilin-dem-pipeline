'use strict';
// Dependency-free actual-kernel certification, including the continuous yaw
// interval. Run: node full-cluster/tests/safe-layout.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const S=require('../src/anemone-safe-layout.js');
const Legacy=require('../../baselines/r03-restored/src/anemone-core.js');
const Regional=require('../src/anemone-current.js');
const state={...S.DEFAULTS};
const near=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const started=performance.now(),certificate=S.certificate(state),certificateMs=performance.now()-started;
const auditedAt=performance.now(),audit=S.auditCertificate(),auditMs=performance.now()-auditedAt;
const evidence=JSON.parse(fs.readFileSync(path.join(__dirname,'../qa/yaw-certificate.json'),'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
for(const [relative,expected] of Object.entries(evidence.sourceSha256)) {
  assert.equal(sha(fs.readFileSync(path.resolve(__dirname,'../..',relative))),expected,`certificate source binding: ${relative}`);
}
const rendererSource=fs.readFileSync(path.join(__dirname,'../src/anemone-renderer.js'),'utf8');
const vertex=rendererSource.match(/const vertex=`([\s\S]*?)`;/)[1];
const bodyMesh=rendererSource.match(/function bodyMesh\(\)\{([\s\S]*?)\n\}/)[0];
const tubeMesh=rendererSource.match(/const params=\[\],indices=\[\],rings=42,sides=12;[^\n]+/)[0];
assert.equal(sha(vertex+'\n'+bodyMesh+'\n'+tubeMesh),evidence.rendererGeometrySha256,'actual renderer ring, cap, body, frame and mesh contract is source-bound');
assert.deepEqual(audit,evidence.audit,'full artifact is independently reproduced by the actual kernel');
assert.equal(audit.kernelFingerprint,S.kernelFingerprint());
const {flow,kernelFingerprint,...runtimeSummary}=certificate;
assert.deepEqual(runtimeSummary,audit.summary,'lightweight runtime evidence matches the full offline audit');
assert.equal(certificate.version,'bounded-shared-yaw-2');
assert.equal(certificate.certified,true);
assert.equal(certificate.renderRings,43);
assert.equal(certificate.renderSegments,42);
assert.equal(certificate.solverSegments,28);
near(certificate.allowedAmplitude,.02);
near(certificate.flow.effectiveScale,.02/certificate.flow.rawAmplitude);
assert.deepEqual(certificate.yawRange,[-.3,.6]);
assert.equal(certificate.thetaSampleCount,46);
near(certificate.thetaGridStep,.02);

// Every original finite audit target is retained. These are the previous
// independent Python capsule/triangle results, not relaxed new expectations.
const baseline=audit.baseline;
near(baseline.allowedAmplitude,.06302649444678007);
near(baseline.interTentacle.minStaticClearance,.019935346228229046);
near(baseline.interTentacle.minMotionClearance,.003142963979374039);
near(baseline.interTentacle.minPrefixRatio,.07668717618925687);
assert.equal(baseline.interTentacle.examinedPairs,327475);
near(baseline.selfContact.minStaticClearance,.026191844955858645);
near(baseline.selfContact.minMotionClearance,.02297661913066633);
assert.equal(baseline.selfContact.examinedPairs,153081);
near(baseline.body.minStaticClearance,.005889590673000926);
near(baseline.body.minMotionClearance,.005875324329330721);
assert.equal(baseline.body.socketSegments,3);
assert.deepEqual(baseline.body.worst,{tentacle:227,segment:3});
assert.ok(baseline.localBendGuard.minRadiusMargin>.1);
assert.ok(baseline.localBendGuard.minAngleMargin>.4);
assert.ok(baseline.localBendGuard.maxTurnBoundRadians<.14);

// Independent initial audit used Float32-reconstructed rest tangents; the new
// analytic-heading kernel must agree within 1e-6, then earn its own exact bounds.
near(certificate.interTentacle.minMotionClearance,.003692910697356693,1e-6);
near(certificate.body.minMotionClearance,.005844331704013637,1e-6);
near(certificate.selfContact.minMotionClearance,.026167131086901115,1e-6);
for(const check of [certificate.interTentacle,certificate.selfContact,certificate.body]) {
  assert.ok(check.reservedMotionClearance>0);
  near(check.reservedMotionClearance,check.minMotionClearance-certificate.numericalMargin);
}
for(let i=0;i<audit.samples.length;i++) {
  const sample=audit.samples[i];near(sample.theta,-.3+.02*i);
  assert.ok(sample.interTentacle.reservedMotionClearance>0);
  assert.ok(sample.interTentacle.excludedMotionGapLowerBound>0,'broad-phase omitted pairs also have a positive continuous bound');
  assert.ok(sample.selfContact.reservedMotionClearance>0);
  if(i)near(sample.theta-audit.samples[i-1].theta,.02);
}
assert.equal(certificate.body.socketSegments,3);
assert.deepEqual(certificate.body.worst,{tentacle:227,segment:3});
assert.ok(certificate.localBendGuard.minRadiusMargin>.15);
assert.ok(certificate.localBendGuard.minAngleMargin>.4);
assert.ok(certificate.localBendGuard.maxTurnBoundRadians<.1);
assert.match(certificate.localBendGuard.scope,/not a proof/);
assert.ok(certificate.limitations.some(s=>s.includes('watertight')));

const roots=S.roots(state),oldRoots=Legacy.roots({...Legacy.DEFAULTS,count:240});
assert.equal(roots.length,240);
assert.ok(Object.isFrozen(roots)&&roots.every(Object.isFrozen));
assert.throws(()=>{roots[0].radius=.001;},TypeError);
assert.equal(S.roots({...state,direction:-180}),roots);
for(let i=0;i<roots.length;i++) {
  const r=roots[i];
  assert.equal(r.length,oldRoots[i].length,'original individual length preserved');
  assert.equal(r.radius,oldRoots[i].radius,'original individual radius preserved');
  assert.equal(r.variation,oldRoots[i].variation,'all original RNG draws consumed');
  near(r.a,i*2.399963229728653,0);
  assert.equal(r.heading,r.a);assert.equal(r.phase,-1.35);assert.equal(r.curve,.7);assert.equal(r.lean,.23);
  near(r.y,S.discAttachment(r.x,r.z),0);
}
for(const [key,value]of [['count',241],['count',240.1],['length',.701],['thickness',.031],['curvature',.9],['seed',74]]) {
  const rejected={...state,[key]:value},copy={...rejected};
  assert.throws(()=>S.validate(rejected),/未认证的初始几何/);
  assert.throws(()=>S.roots(rejected),/未认证的初始几何/);
  assert.deepEqual(rejected,copy,'rejection does not silently rewrite the requested geometry');
}
for(const key of ['current','direction','frequency','turbulence','swayAmplitude','flowSpeed']) {
  for(const value of [NaN,Infinity,-Infinity,'1',null,undefined])assert.throws(()=>S.validate({...state,[key]:value}));
}
for(const [key,value] of [['swayAmplitude',-1e-10],['swayAmplitude',1+1e-10],['flowSpeed',-1e-10],['flowSpeed',6+1e-10]])assert.throws(()=>S.validate({...state,[key]:value}));
assert.throws(()=>S.validate({...state,current:1.001}));
assert.throws(()=>S.validate({...state,paused:'false'}));
assert.throws(()=>S.validate(null));
assert.throws(()=>S.solve(state,[...roots],0),/未认证的根部几何/);
for(const time of [-1000,-.01,NaN,Infinity,1e6+.1,Number.MAX_VALUE]) {
  const out=new Float32Array(roots.length*(S.SEGMENTS+1)*4);out.fill(123);
  assert.throws(()=>S.solve(state,roots,time,out),/时间/);assert.ok(out.every(x=>x===123),'invalid time rejects without writing output');
}
for(const invalid of [{...state,swayAmplitude:2},{...state,flowSpeed:-1},{...state,count:241}]) {
  const out=new Float32Array(roots.length*(S.SEGMENTS+1)*4);out.fill(123);
  assert.throws(()=>S.solve(invalid,roots,0,out));assert.ok(out.every(x=>x===123),'invalid state rejects atomically before output mutation');
}
assert.throws(()=>S.solve(state,roots,0,new Float32Array(4)),/输出缓冲区/);
assert.deepEqual(S.validate(state),state);
assert.notEqual(S.validate(state),state,'validated state is a copy');
const legacyParams={...state};delete legacyParams.swayAmplitude;delete legacyParams.flowSpeed;
assert.throws(()=>S.validate(legacyParams));
const migrated=S.migrateLegacyParams(legacyParams);
assert.deepEqual(migrated,{...legacyParams,swayAmplitude:0,flowSpeed:1});
assert.ok(!('swayAmplitude'in legacyParams),'migration does not mutate input');
assert.throws(()=>S.migrateLegacyParams(state));
assert.throws(()=>S.migrateLegacyParams({...legacyParams,swayAmplitude:0}));
assert.throws(()=>S.migrateLegacyParams({...legacyParams,count:241}));

const zero={...state,current:0,turbulence:0,swayAmplitude:0};
const rest=S.solve(zero,roots,0),restLater=S.solve(zero,roots,10000);
assert.deepEqual(rest,restLater,'all motion amplitudes at zero preserve the exact rest shape');
// Regional.solve with the certified roots reproduces the pre-change rest data.
assert.deepEqual(rest,Regional.solve(zero,roots,0),'zero-flow shape is byte-for-byte unchanged');
assert.deepEqual(rest,S.solve({...zero,swayAmplitude:1},roots,0),'time-zero yaw is exactly zero');
assert.equal(S.certificate(zero).flow.effectiveScale,1);
assert.equal(S.certificate(zero).flow.effectiveAmplitude,0);
const phase=Math.asin(-1/3),maxTime=(Math.PI/2-phase)/.65,minTime=(Math.PI*1.5-phase)/.65;
for(const amplitude of [0,.001,.25,.5,1])for(const speed of [0,.2,1,2,4,6]) {
  const p={...state,swayAmplitude:amplitude,flowSpeed:speed};
  assert.equal(S.swayAngle(p,0),0);
  near(S.swayAngle(p,maxTime),.6*amplitude);near(S.swayAngle(p,minTime),-.3*amplitude);
  for(const time of [0,.1,3,9,17,1000,1e6]) {
    const angle=S.swayAngle(p,time);assert.ok(angle>=-.3*amplitude-1e-15&&angle<=.6*amplitude+1e-15);
    assert.deepEqual(S.solve(p,roots,time),S.solve({...p,flowSpeed:1},roots,time),'speed changes only the host clock rate, never the pose at a fixed motion time');
  }
}
for(const frequency of [.08,.42,.9])near(S.swayAngle({...state,frequency},2),S.swayAngle(state,2),0);
assert.deepEqual(S.solve({...zero,swayAmplitude:1,frequency:.08},roots,2),S.solve({...zero,swayAmplitude:1,frequency:.9},roots,2),'local frequency never controls common sway');

const Q=[0],Y=[0];
for(let j=1;j<=S.SEGMENTS;j++) {
  const u=(j-.5)/S.SEGMENTS;Q[j]=Q[j-1]+u*u/S.SEGMENTS;
  Y[j]=Y[j-1]+u*u*Math.sin(.23+.7*Math.pow(u,.82))/S.SEGMENTS;
}
let maxLengthError=0,maxObservedDisplacement=0,maxTipMotion=0,sampledStates=0;
for(const parameters of [state,{...state,current:1,turbulence:.8,direction:-180,frequency:.9},
  {...state,current:.01,turbulence:.01,direction:180,frequency:.08,swayAmplitude:.3},
  {...state,current:0,turbulence:.8,swayAmplitude:0},{...state,current:0,turbulence:0}]) {
  const f=S.certificate(parameters).flow;
  assert.ok(f.effectiveAmplitude<=certificate.allowedAmplitude+1e-15);
  assert.ok(f.effectiveScale>0&&f.effectiveScale<=1);
  const K=f.effectiveAmplitude/(1-f.effectiveAmplitude/2);
  for(const time of [0,.01,1,8,14,27.3,1000,1e6,maxTime,minTime]) {
    const out=S.solve(parameters,roots,time),metrics=S.metrics(parameters,roots,out),theta=S.swayAngle(parameters,time);
    const yawOnly=S.solve({...parameters,current:0,turbulence:0},roots,time);
    assert.equal(metrics.finite,true);assert.equal(metrics.tentacles,240);
    assert.ok(metrics.rootError<1e-6);assert.ok(metrics.attachmentError<1e-12);
    assert.ok(metrics.lengthError<2e-6);maxLengthError=Math.max(maxLengthError,metrics.lengthError);
    for(let i=0;i<roots.length;i++)for(let j=0;j<=S.SEGMENTS;j++) {
      const k=(i*(S.SEGMENTS+1)+j)*4;
      const delta=(a,b)=>Math.hypot(a[k]-b[k],a[k+1]-b[k+1],a[k+2]-b[k+2]);
      const displacement=delta(out,rest);
      assert.ok(delta(out,yawOnly)<=K*roots[i].length*Q[j]+1e-6,'regional perturbation obeys the original normalized-prefix bound around the yaw pose');
      assert.ok(displacement<=(Math.abs(theta)*Y[j]+K*Q[j])*roots[i].length+1e-6,'combined yaw/local analytic prefix envelope');
      if(j) {
        const edge=Math.hypot(out[k]-out[k-4],out[k+1]-out[k-3],out[k+2]-out[k-2]);
        assert.ok(Math.abs(edge-roots[i].length/S.SEGMENTS)<3e-7,'each individual segment retains its original length');
      }
      maxObservedDisplacement=Math.max(maxObservedDisplacement,displacement);
      if(j===S.SEGMENTS)maxTipMotion=Math.max(maxTipMotion,displacement);
    }
    sampledStates++;
  }
}
assert.ok(maxTipMotion>.09,'new common sway produces substantial certified displacement');
const frameA=S.solve(state,roots,0),frameB=S.solve(state,roots,17);
assert.notDeepEqual(frameA,frameB,'runtime does not freeze the curve');
const differences=roots.map((r,i)=>{const k=(i*(S.SEGMENTS+1)+S.SEGMENTS)*4;return [frameB[k]-frameA[k],frameB[k+2]-frameA[k+2]];});
assert.ok(new Set(differences.map(v=>v.map(x=>x.toFixed(5)).join(','))).size>100,'motion retains regional variation');
const localState={...state,swayAmplitude:0};
assert.notDeepEqual(S.solve(localState,roots,0),S.solve(localState,roots,17),'zero common sway preserves nonzero regional fallback');

// Independently reconstruct full tubes. The correct right-handed Y sign and
// single common theta are tested separately from the production solve function.
const sampleState={...state,direction:-79,current:.92,turbulence:.73},time=23.7,frame=S.solve(sampleState,roots,time);
const scale=S.certificate(sampleState).flow.effectiveScale,d=sampleState.direction*Math.PI/180;
const theta=sampleState.swayAmplitude*(.15+.45*Math.sin(Math.asin(-1/3)+.65*time));
for(const id of [0,71,176,239]) {
  const r=roots[id];let x=r.x,y=r.y,z=r.z;
  for(let j=1;j<=S.SEGMENTS;j++) {
    const u=(j-.5)/S.SEGMENTS,flow=Regional.sampleFlow(sampleState,r.x,r.z,u,time);
    const h=r.heading+.16*Math.sin(u*2.7+r.phase)-theta*u*u,bend=r.lean+r.curve*Math.pow(u,.82);
    const vx=Math.cos(h)*Math.sin(bend)+u*u*scale*(Math.cos(d)*flow.streamwise*.7-Math.sin(d)*flow.crosswise*.5);
    const vz=Math.sin(h)*Math.sin(bend)+u*u*scale*(Math.sin(d)*flow.streamwise*.7+Math.cos(d)*flow.crosswise*.5);
    const vy=Math.cos(bend),step=r.length/S.SEGMENTS/Math.hypot(vx,vy,vz);
    x+=vx*step;y+=vy*step;z+=vz*step;
    const k=(id*(S.SEGMENTS+1)+j)*4;
    near(frame[k],Math.fround(x),0);near(frame[k+1],Math.fround(y),0);near(frame[k+2],Math.fround(z),0);
  }
}

// Actual renderer contract: its Float32 joint texture, Float32 mesh parameter,
// texture-supplied radius/length, 43-ring cap mapping, and normalized frame.
// A triangle strip is a convex combination of its ring vertices, so enclosing
// all vertices of both rings in the same convex capsule encloses every triangle.
assert.match(vertex,/float capLength=radius\/curveLength/);
assert.match(vertex,/world=p\+ring\*radius\*profile/);
assert.match(vertex,/center\(min\(j\+1,28\),id\)-center\(max\(j-1,0\),id\)/);
const distanceToSegment=(p,a,b)=>{
  const v=b.map((n,i)=>n-a[i]),w=p.map((n,i)=>n-a[i]),vv=v.reduce((s,n)=>s+n*n,0);
  const t=Math.max(0,Math.min(1,w.reduce((s,n,i)=>s+n*v[i],0)/vv));
  return Math.hypot(...p.map((n,i)=>n-a[i]-t*v[i]));
};
function renderRings(data,id,shaderInputs) {
  const r=roots[id],base=id*29*4,read=j=>[data[base+Math.max(0,Math.min(28,j))*4],data[base+Math.max(0,Math.min(28,j))*4+1],data[base+Math.max(0,Math.min(28,j))*4+2]];
  const radius=shaderInputs?data[base+3]:r.radius,length=shaderInputs?data[base+28*4+3]:r.length,capLength=radius/length;
  return Array.from({length:43},(_,k)=>{
    const param=shaderInputs?Math.fround(k/42):k/42;
    const s=param<.85?param/.85*(1-capLength):1-capLength+capLength*(param-.85)/.15,v=s*28,j=Math.floor(v),f=v-j;
    const a=read(j),b=read(j+1),center=a.map((x,i)=>x*(1-f)+b[i]*f),cap=Math.max(0,Math.min(1,(s-(1-capLength))/capLength));
    const rr=radius*(1-.1*s)*(1+.07*Math.exp(-Math.pow((s-.9)/.06,2)))*Math.sqrt(Math.max(0,1-cap*cap));
    const start=read(j-1),end=read(j+1),t=end.map((x,i)=>x-start[i]),norm=Math.hypot(...t);t.forEach((x,i)=>t[i]=x/norm);
    let n,bn;if(t[2]<-.99999){n=[0,-1,0];bn=[-1,0,0];}else{const q=1/(1+t[2]);n=[1-t[0]*t[0]*q,-t[0]*t[1]*q,-t[0]];bn=[-t[0]*t[1]*q,1-t[1]*t[1]*q,-t[1]];}
    return {center,radius:rr,vertices:Array.from({length:13},(_,side)=>{const angle=Math.fround(side/12*Math.PI*2);return center.map((x,i)=>x+(bn[i]*Math.cos(angle)+n[i]*Math.sin(angle))*rr);})};
  });
}
// Emulate single-precision arithmetic as well as uploaded inputs. GPU transcendental
// implementations are not promised bit-identical; the certificate retains its
// separate 1e-5 engineering reserve and does not certify local cap manifold quality.
function float32Rings(data,id) {
  const f=Math.fround,add=(a,b)=>f(f(a)+f(b)),sub=(a,b)=>f(f(a)-f(b)),mul=(a,b)=>f(f(a)*f(b)),div=(a,b)=>f(f(a)/f(b));
  const base=id*29*4,read=j=>[0,1,2].map(k=>data[base+Math.max(0,Math.min(28,j))*4+k]);
  const radius=data[base+3],length=data[base+28*4+3],capLength=div(radius,length);
  return Array.from({length:43},(_,k)=>{
    const param=f(k/42),oneMinus=sub(1,capLength);
    const s=param<f(.85)?mul(div(param,.85),oneMinus):add(oneMinus,div(mul(capLength,sub(param,.85)),.15));
    const v=mul(s,28),j=Math.floor(v),fraction=sub(v,j),a=read(j),b=read(j+1);
    const center=a.map((x,i)=>add(mul(x,sub(1,fraction)),mul(b[i],fraction)));
    const cap=Math.max(0,Math.min(1,div(sub(s,oneMinus),capLength)));
    const t0=div(sub(s,.9),.06),bump=add(1,mul(.07,f(Math.exp(-mul(t0,t0)))));
    const profile=mul(mul(sub(1,mul(.1,s)),bump),f(Math.sqrt(Math.max(0,sub(1,mul(cap,cap))))));
    const rr=mul(radius,profile),start=read(j-1),end=read(j+1),t=end.map((x,i)=>sub(x,start[i]));
    const norm=f(Math.sqrt(add(add(mul(t[0],t[0]),mul(t[1],t[1])),mul(t[2],t[2]))));
    t.forEach((x,i)=>t[i]=div(x,norm));
    let n,bn;if(t[2]<f(-.99999)){n=[0,-1,0];bn=[-1,0,0];}else{
      const q=div(1,add(1,t[2]));n=[sub(1,mul(mul(t[0],t[0]),q)),-mul(mul(t[0],t[1]),q),-t[0]];
      bn=[-mul(mul(t[0],t[1]),q),sub(1,mul(mul(t[1],t[1]),q)),-t[1]];
    }
    return {center,radius:rr,cap,vertices:Array.from({length:13},(_,side)=>{
      const angle=f(side/12*Math.PI*2),cos=f(Math.cos(angle)),sin=f(Math.sin(angle));
      return center.map((x,i)=>add(x,mul(mul(add(mul(bn[i],cos),mul(n[i],sin)),radius),profile)));
    })};
  });
}
let maxCapsuleRoundingExcess=0;
for(const time of [0,maxTime,minTime,23.7]) {
  const data=S.solve(state,roots,time);
  for(let id=0;id<roots.length;id++) {
    const nominal=renderRings(data,id,false),inputRounded=renderRings(data,id,true),actual=float32Rings(data,id);
    for(let k=0;k<42;k++) {
      const radius=Math.max(nominal[k].radius,nominal[k+1].radius);
      for(const ring of [inputRounded[k],inputRounded[k+1],actual[k],actual[k+1]])for(const vertex of ring.vertices) {
        const excess=distanceToSegment(vertex,nominal[k].center,nominal[k+1].center)-radius;
        maxCapsuleRoundingExcess=Math.max(maxCapsuleRoundingExcess,excess);
        assert.ok(excess<certificate.numericalMargin/4,'actual rounded renderer strip/cap vertices fit the audited capsule plus a fraction of reserve');
      }
    }
    assert.ok(nominal[42].radius<1e-7,'nominal terminal cap reaches the centerline');
    assert.ok(actual[42].cap>1-3e-6,'Float32 end cap reaches unity within reserve; cap topology is not certified');
  }
}
const buffer=new Float32Array(frame.length);
assert.equal(S.solve(state,roots,3,buffer),buffer,'caller output buffer is reused');
console.log(JSON.stringify({ok:true,certificateMs,auditMs,sampledStates,maxLengthError,maxObservedDisplacement,maxCapsuleRoundingExcess,
  defaultEffectiveScale:certificate.flow.effectiveScale,interTentacleBound:certificate.interTentacle.reservedMotionClearance,
  selfContactBound:certificate.selfContact.reservedMotionClearance,bodyBound:certificate.body.reservedMotionClearance,
  localBendRadiusMargin:certificate.localBendGuard.minRadiusMargin},null,2));
