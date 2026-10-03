'use strict';
// Focused, dependency-free test: node full-cluster/tests/safe-layout.cjs
const assert=require('node:assert/strict');
const S=require('../src/anemone-safe-layout.js');
const Legacy=require('../../baselines/r03-restored/src/anemone-core.js');
const Regional=require('../src/anemone-current.js');
const state={...S.DEFAULTS};
const started=performance.now(),certificate=S.certificate(state),certificateMs=performance.now()-started;
const near=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
assert.equal(certificate.certified,true);
assert.equal(certificate.renderRings,43);
assert.equal(certificate.renderSegments,42);
assert.equal(certificate.solverSegments,28);
near(certificate.allowedAmplitude,.06302649444678007);
near(certificate.flow.effectiveScale,.15);
// Reproduction targets come from the independent Python capsule/triangle audit.
near(certificate.interTentacle.minStaticClearance,.019935346228229046);
near(certificate.interTentacle.minMotionClearance,.003142963979374039);
near(certificate.interTentacle.minPrefixRatio,.07668717618925687);
assert.equal(certificate.interTentacle.examinedPairs,327475);
near(certificate.selfContact.minStaticClearance,.026191844955858645);
near(certificate.selfContact.minMotionClearance,.02297661913066633);
assert.equal(certificate.selfContact.examinedPairs,153081);
near(certificate.body.minStaticClearance,.005889590673000926);
near(certificate.body.minMotionClearance,.005875324329330721);
assert.equal(certificate.body.socketSegments,3);
assert.deepEqual(certificate.body.worst,{tentacle:227,segment:3});
for(const check of [certificate.interTentacle,certificate.selfContact,certificate.body]) {
  assert.ok(check.reservedMotionClearance>0);
  near(check.reservedMotionClearance,check.minMotionClearance-certificate.numericalMargin);
}
assert.ok(certificate.localBendGuard.minRadiusMargin>.1);
assert.ok(certificate.localBendGuard.minAngleMargin>.4);
assert.ok(certificate.localBendGuard.maxTurnBoundRadians<.14);
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
for(const key of ['current','direction','frequency','turbulence']) {
  assert.throws(()=>S.validate({...state,[key]:NaN}));
  assert.throws(()=>S.validate({...state,[key]:Infinity}));
}
assert.throws(()=>S.validate({...state,current:1.001}));
assert.throws(()=>S.validate({...state,paused:'false'}));
assert.throws(()=>S.validate(null));
assert.throws(()=>S.solve(state,[...roots],0),/未认证的根部几何/);
for(const time of [-1000,-.01,NaN,Infinity,1e6+.1,Number.MAX_VALUE]){const out=new Float32Array(roots.length*(S.SEGMENTS+1)*4);out.fill(123);assert.throws(()=>S.solve(state,roots,time,out),/时间/);assert.ok(out.every(x=>x===123),'invalid time rejects without writing output');}
assert.ok(Object.isFrozen(roots)&&roots.every(Object.isFrozen),'certified roots cannot be mutated');
assert.throws(()=>S.solve(state,roots,0,new Float32Array(4)),/输出缓冲区/);
assert.deepEqual(S.validate(state),state);

const zero={...state,current:0,turbulence:0};
const rest=S.solve(zero,roots,0),restLater=S.solve(zero,roots,10000);
assert.deepEqual(rest,restLater,'zero current/turbulence stays at the certified rest geometry');
assert.equal(S.certificate(zero).flow.effectiveScale,1);
assert.equal(S.certificate(zero).flow.effectiveAmplitude,0);
const Q=[0];for(let j=1;j<=S.SEGMENTS;j++)Q[j]=Q[j-1]+Math.pow((j-.5)/S.SEGMENTS,2)/S.SEGMENTS;
let maxLengthError=0,maxObservedDisplacement=0,maxTipMotion=0,sampledStates=0;
for(const parameters of [state,{...state,current:1,turbulence:.8,direction:-180,frequency:.9},
  {...state,current:.01,turbulence:.01,direction:180,frequency:.08},{...state,current:0,turbulence:.8}]) {
  const f=S.certificate(parameters).flow;
  assert.ok(f.effectiveAmplitude<=certificate.allowedAmplitude+1e-15);
  assert.ok(f.effectiveScale>0&&f.effectiveScale<=1);
  const K=f.effectiveAmplitude/(1-f.effectiveAmplitude/2);
  for(const time of [0,.01,1,8,14,27.3,1000,1e6]) {
    const out=S.solve(parameters,roots,time),metrics=S.metrics(parameters,roots,out);
    assert.equal(metrics.finite,true);assert.equal(metrics.tentacles,240);
    assert.ok(metrics.rootError<1e-6);assert.ok(metrics.attachmentError<1e-12);
    assert.ok(metrics.lengthError<2e-6);maxLengthError=Math.max(maxLengthError,metrics.lengthError);
    for(let i=0;i<roots.length;i++)for(let j=0;j<=S.SEGMENTS;j++) {
      const k=(i*(S.SEGMENTS+1)+j)*4,displacement=Math.hypot(out[k]-rest[k],out[k+1]-rest[k+1],out[k+2]-rest[k+2]);
      assert.ok(displacement<=K*roots[i].length*Q[j]+1e-6,'sample obeys its analytic prefix envelope');
      maxObservedDisplacement=Math.max(maxObservedDisplacement,displacement);
      if(j===S.SEGMENTS)maxTipMotion=Math.max(maxTipMotion,displacement);
    }
    sampledStates++;
  }
}
assert.ok(maxTipMotion>.002,'bounded regional flow remains visibly nonzero');
const frameA=S.solve(state,roots,0),frameB=S.solve(state,roots,17);
assert.notDeepEqual(frameA,frameB,'runtime does not freeze the curve');
const differences=roots.map((r,i)=>{
  const k=(i*(S.SEGMENTS+1)+S.SEGMENTS)*4;
  return [frameB[k]-frameA[k],frameB[k+2]-frameA[k+2]];
});
assert.ok(new Set(differences.map(v=>v.map(x=>x.toFixed(5)).join(','))).size>100,'motion retains regional variation');
// Independently reconstruct one entire tube from the unchanged regional field.
const sampleState={...state,direction:-79,current:.92,turbulence:.73},time=23.7,frame=S.solve(sampleState,roots,time);
const scale=S.certificate(sampleState).flow.effectiveScale,d=sampleState.direction*Math.PI/180;
for(const id of [0,71,176,239]) {
  const r=roots[id];let x=r.x,y=r.y,z=r.z;
  for(let j=1;j<=S.SEGMENTS;j++) {
    const u=(j-.5)/S.SEGMENTS,flow=Regional.sampleFlow(sampleState,r.x,r.z,u,time);
    const h=r.heading+.16*Math.sin(u*2.7+r.phase),bend=r.lean+r.curve*Math.pow(u,.82);
    const vx=Math.cos(h)*Math.sin(bend)+u*u*scale*(Math.cos(d)*flow.streamwise*.7-Math.sin(d)*flow.crosswise*.5);
    const vz=Math.sin(h)*Math.sin(bend)+u*u*scale*(Math.sin(d)*flow.streamwise*.7+Math.cos(d)*flow.crosswise*.5);
    const vy=Math.cos(bend),step=r.length/S.SEGMENTS/Math.hypot(vx,vy,vz);
    x+=vx*step;y+=vy*step;z+=vz*step;
    const k=(id*(S.SEGMENTS+1)+j)*4;
    near(frame[k],Math.fround(x),0);near(frame[k+1],Math.fround(y),0);near(frame[k+2],Math.fround(z),0);
  }
}
const buffer=new Float32Array(frame.length);
assert.equal(S.solve(state,roots,3,buffer),buffer,'caller output buffer is reused');
console.log(JSON.stringify({ok:true,certificateMs,sampledStates,maxLengthError,maxObservedDisplacement,
  defaultEffectiveScale:certificate.flow.effectiveScale,interTentacleBound:certificate.interTentacle.reservedMotionClearance,
  selfContactBound:certificate.selfContact.reservedMotionClearance,bodyBound:certificate.body.reservedMotionClearance,
  localBendRadiusMargin:certificate.localBendGuard.minRadiusMargin},null,2));
