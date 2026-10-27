'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const M = require('./material-waves.js'), createCoordinates = require('./rigid-coordinates.js');
const root = path.resolve(__dirname, '..');
const protectedNames = ['scene.js','dynamic.js','outside_valve_solver.js','valve-dynamic.js','gresley_solver.js','gresley-dynamic.js','stack-fields.js','stack-dynamic.js','app.js','controls.js','index.html'];
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const protectedBefore = Object.fromEntries(protectedNames.map(n => [n,hash(fs.readFileSync(path.join(root,n)))]));
const context = {console}; context.window = context; vm.createContext(context);
for (const name of ['scene.js','dynamic.js','outside_valve_solver.js','valve-dynamic.js','gresley_solver.js','topology-parameters.js','side_offset_solver.js','gresley-dynamic.js','stack-fields.js','stack-dynamic.js','middle-chest-fields.js','middle-chest-dynamic.js','frame-support-fields.js','frame-support-dynamic.js','outer-crosshead.js','outer-crosshead-adapter.js']) vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});
const S = context.SCENE, D = context.DYNAMIC, coordinates = createCoordinates(S,D);
const sceneBefore = hash(JSON.stringify(S)), glslBefore = D.glsl;
let seed=0xa4c0ffee;
const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0), norm=a=>Math.hypot(...a), unit=a=>a.map(v=>v/norm(a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const angleBetween=(a,b)=>Math.atan2(norm(cross(a,b)),dot(a,b));
const error=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
const report={status:'PASS',scope:'R29 integrated appearance CPU mathematics and local coordinates; browser compilation/rendering still NOT RUN here.',
  shaderCompile:{status:'NOT_RUN',reason:'No shader compiler or browser used; GLSL generation identity is tested, not driver acceptance.'},
  geometryDisplacement:0,mechanicalAcceptance:false,independentMaterialTime:false,
  gradient:{samples:0,maximumAbsoluteError:0},bounds:{samples:0,maximumNormalAngleRadians:0,maximumNormalBoundExcess:0,maximumAdversarialLimiterAngleRadians:0},
  coordinates:{samples:0,maximumReferenceRecoveryError:0,maximumAdvectionHeightError:0,maximumWorldGradientError:0,kinds:{},wheelAxles:[],wheelAngularAgreementError:0},
  assignment:{counts:{},basisCounts:{},unassignedPresets:['brass','water','glass']},materials:{},protectedSourceSha256:protectedBefore};
const identity=[[1,0,0],[0,1,0],[0,0,1]];
for (const name of M.names) {
  const m=M.presets[name],b=M.bounds(name); report.materials[name]=b;
  assert(b.height<=0.00014+1e-15); assert(b.normalAngleRadians<=Math.atan(.025)+1e-15);
  for (let sample=0;sample<450;sample++) {
    const p=[0,1,2].map(()=>12*random()-6),eps=1e-7;
    const w=M.waveValueGradient(p,name);
    assert(Math.abs(w.height)<=b.height+1e-14); assert(norm(w.gradient)<=b.gradient+1e-14);
    for(let j=0;j<3;j++) {
      const lo=p.slice(),hi=p.slice();lo[j]-=eps;hi[j]+=eps;
      const fd=(M.waveValueGradient(hi,name).height-M.waveValueGradient(lo,name).height)/(2*eps);
      const e=Math.abs(fd-w.gradient[j]); report.gradient.maximumAbsoluteError=Math.max(report.gradient.maximumAbsoluteError,e);assert(e<2e-9);
    }
    report.gradient.samples++;
    const n=unit([random()-.5,random()-.5,random()-.5]);
    const shading=M.shadingSample(p,n,identity,name);
    const angle=angleBetween(n,shading.normal);
    report.bounds.maximumNormalAngleRadians=Math.max(report.bounds.maximumNormalAngleRadians,angle);
    report.bounds.maximumNormalBoundExcess=Math.max(report.bounds.maximumNormalBoundExcess,angle-b.normalAngleRadians);
    assert(angle<=b.normalAngleRadians+5e-8); assert(Math.abs(norm(shading.normal)-1)<1e-14);
    assert.equal(shading.geometryDisplacement,0); assert(Math.abs(shading.roughness-m.roughness)<=m.roughnessVariation+1e-14);
    shading.albedo.forEach((v,j)=>assert(Math.abs(v-m.albedo[j])<=m.albedo[j]*m.albedoVariation+1e-14));
    const disabled=M.shadingSample(p,n,identity,name,0); assert(error(disabled.normal,n)<1e-14); assert(disabled.virtualHeight===0);
    // Exercise the limiter beyond any preset's small analytic gradient.
    const largeGradient=[1000*(random()-.5),1000*(random()-.5),1000*(random()-.5)];
    const limited=M.perturbNormal(n,largeGradient,m.maxSlope);
    const largeAngle=angleBetween(n,limited);
    report.bounds.maximumAdversarialLimiterAngleRadians=Math.max(report.bounds.maximumAdversarialLimiterAngleRadians,largeAngle);
    assert(largeAngle<=b.normalAngleRadians+5e-8);
    report.bounds.samples++;
  }
}
function forwardReference(part,p,theta,installation) {
  if(part.group==='wheel') {
    const axle=Number(part.id.match(/axle(\d+)/)[1]),center=coordinates.wheelCenters.get(axle);
    const a=-(D.wheelTheta(theta,axle)-D.referenceTheta),c=Math.cos(a),s=Math.sin(a),y=p[1]-center[0],z=p[2]-center[1];
    return [p[0],center[0]+c*y-s*z,center[1]+s*y+c*z];
  }
  if(part.source==='stack') return D.gresleySolver.transformPoint(p,D.gresleySolver.transformFor(part.frameSourceId,theta));
  if(D.isCentralControl(part)) {const f=D.gresleyFrame(part,theta,installation);return f?D.gresleySolver.transformPoint(p,f):p.slice();}
  if(D.isOutsideValve(part)) return D.valvePoint(p,D.valveFrame(part,theta,installation));
  return D.transform(p,theta,D.classify(part),false,installation);
}
const wheelAxles=new Set();
for(const installation of [D.snapshot({mode:'baseline'}),D.snapshot({mode:'candidate',beta:.126})]) {
  for(const Time of [-.4,0,.7,2.3,2*Math.PI]) {
    // The exact same T -> Location -> Object snapshot drives mechanics and map.
    const state=D.state(Time,{origin:[0,0,0]},{initialTheta:.4,angularSpeed:1,installation});
    const theta=state.theta;
    for(const part of S.parts) {
      const frame=coordinates.frame(part,theta,state.installation),m=M.assignMaterial(part);
      report.coordinates.kinds[frame.kind]=(report.coordinates.kinds[frame.kind]||0)+1;
      const p=part.aabb_min.map((v,j)=>v+(part.aabb_max[j]-v)*(0.23+0.54*random()));
      const world=forwardReference(part,p,theta,state.installation),local=frame.local(world),expected=p.map((v,j)=>v-frame.origin[j]);
      const e=error(local,expected);report.coordinates.maximumReferenceRecoveryError=Math.max(report.coordinates.maximumReferenceRecoveryError,e);assert(e<2e-13);
      const a=M.waveValueGradient(local,m.preset),b=M.waveValueGradient(expected,m.preset);
      const heightError=Math.abs(a.height-b.height);report.coordinates.maximumAdvectionHeightError=Math.max(report.coordinates.maximumAdvectionHeightError,heightError);assert(heightError<2e-15);
      const gw=[0,1,2].map(j=>frame.rows.reduce((s,r,k)=>s+r[j]*a.gradient[k],0)),eps=2e-7;
      for(let j=0;j<3;j++) {
        const lo=world.slice(),hi=world.slice();lo[j]-=eps;hi[j]+=eps;
        const fd=(M.waveValueGradient(frame.local(hi),m.preset).height-M.waveValueGradient(frame.local(lo),m.preset).height)/(2*eps);
        const ge=Math.abs(fd-gw[j]);report.coordinates.maximumWorldGradientError=Math.max(report.coordinates.maximumWorldGradientError,ge);assert(ge<2e-9);
      }
      if(part.group==='wheel') {
        wheelAxles.add(frame.axle);const center=coordinates.wheelCenters.get(frame.axle);
        const originalAngle=Math.atan2(p[1]-center[0],p[2]-center[1])-.4;
        const movingAngle=Math.atan2(world[1]-center[0],world[2]-center[1])-frame.parameterTheta;
        const ae=Math.max(Math.abs(Math.cos(originalAngle)-Math.cos(movingAngle)),Math.abs(Math.sin(originalAngle)-Math.sin(movingAngle)));
        report.coordinates.wheelAngularAgreementError=Math.max(report.coordinates.wheelAngularAgreementError,ae);assert(ae<2e-13);
        assert(D.scalar(part).includes(`${part.glsl_function}_parameterized(p,.4+(timeTheta-.4)*`));
      }
      report.coordinates.samples++;
    }
  }
}
report.coordinates.wheelAxles=[...wheelAxles].sort();assert.equal(report.coordinates.wheelAxles.length,6);
assert.equal(S.parts.length,687);
for(const part of S.parts) {
  const a=M.assignMaterial(part);report.assignment.counts[a.preset]=(report.assignment.counts[a.preset]||0)+1;
  report.assignment.basisCounts[a.basis]=(report.assignment.basisCounts[a.basis]||0)+1;
}
assert.equal(M.assignMaterial({id:'connections/cold_water_pipe_and_flexible_hose_wall',group:'connections'}).preset,'neutral');
assert.equal(M.assignMaterial({id:'trucks/cartazzi_bronze_wedge_left',group:'trucks'}).preset,'neutral');
assert.equal(M.assignMaterial({id:'actuation/left_oil_cup',group:'actuation'}).preset,'neutral');
for(const name of ['brass','water','glass']) assert.equal(report.assignment.counts[name]||0,0);
assert.equal(M.assignMaterial({id:'unknown/not_evidenced',group:'new_group'}).preset,'neutral');
assert.equal(fs.readFileSync(path.join(__dirname,'material-waves.glsl'),'utf8'),M.generateGLSL());
assert(!/uniform\s+float\s+(?:time|theta)|sampler|texture\s*\(/i.test(M.generateGLSL()));
assert.equal(hash(JSON.stringify(S)),sceneBefore); assert.equal(D.glsl,glslBefore);
for(const n of protectedNames)assert.equal(hash(fs.readFileSync(path.join(root,n))),protectedBefore[n]);
report.protectedSourcesUnchanged=true;
fs.writeFileSync(path.join(__dirname,'MATERIAL_WAVE_QA.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'MATERIAL_ASSIGNMENTS.json'),JSON.stringify(S.parts.map(part=>({id:part.id,...M.assignMaterial(part)})),null,2)+'\n');
console.log(JSON.stringify(report,null,2));
