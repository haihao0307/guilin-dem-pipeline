const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const c={console};c.window=c;vm.createContext(c);for(const f of ['scene.js','dynamic.js','outside_valve_solver.js','valve-dynamic.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,f),'utf8'),c);
const D=c.DYNAMIC,S=c.SCENE,solver=D.outsideValveSolver;
let maxInverse=0,maxBounds=0,checks=0,maxClosure=0,moving=S.parts.filter(p=>D.isOutsideValve(p));assert.equal(moving.length,46);
for(let k=0;k<=144;k++){
 const theta=2*Math.PI*k/144,poses=D.outsideValvePose(theta);maxClosure=Math.max(maxClosure,poses.left.maxEquationResidual,poses.right.maxEquationResidual);
 for(const part of S.parts){const f=D.valveFrame(part,theta,{mode:'candidate',beta:.126});if(!f)continue;const bb=D.bounds(part,theta,{mode:'candidate',beta:.126});
  assert.equal(D.valveFrame(part,theta,{mode:'baseline',beta:.11}),null);
  for(let i=0;i<8;i++){let p=[0,1,2].map(j=>i&(1<<j)?part.aabb_max[j]:part.aabb_min[j]),q=D.valvePoint(p,f),back=D.valvePoint(q,f,true);maxInverse=Math.max(maxInverse,...back.map((v,j)=>Math.abs(v-p[j])));for(let j=0;j<3;j++)maxBounds=Math.max(maxBounds,bb[0][j]-q[j],q[j]-bb[1][j]);checks++;}
 }
}
// Central mechanism and chest stationary parts deliberately receive no new motion.
for(const part of S.parts.filter(p=>p.id.includes('gresley')||p.id.startsWith('valve/middle_')||p.id.endsWith('chest_pressure_shell')))assert(!D.isOutsideValve(part));
const out={pass:Math.max(maxInverse,maxBounds,maxClosure)<1e-10,moving_fields:46,gear_fields:36,chest_fields:10,rigid_corner_checks:checks,max_inverse_error_m:maxInverse,max_bounds_error_m:maxBounds,max_equation_residual:maxClosure,baseline_valve_motion:'frozen unchanged',middle_valve_motion:'frozen explicit broken control chain',whole_mechanical_acceptance:false};fs.writeFileSync(path.join(__dirname,'OUTSIDE_VALVE_INTEGRATION_QA.json'),JSON.stringify(out,null,2));console.log(out);assert(out.pass);
