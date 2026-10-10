/** Read-only independent mechanics review. Does not modify candidate source files. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {contract,evaluate,nominalRollingContact} from './three-cylinder.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const d=JSON.parse(fs.readFileSync(path.join(root,'design.json'),'utf8'));
const r=d.strokeM/2,L=d.rodPinCentresM,R=d.wheel.diameterM/2;
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} differs from ${b} by ${Math.abs(a-b)}, tolerance ${t}`);
const state=(theta,omega,alpha=0,time=0)=>({worldTimeS:time,commonThetaRad:theta,omegaRadS:omega,alphaRadS2:alpha});

// Independent solution of d/dt(|S-P|^2)=0 and d²/dt²(|S-P|²)=0.
// It deliberately does not reuse the source's x', x'' or loads formulas.
function independentCylinder(c,theta,omega,alpha,F,m) {
  const t=theta+c.crankPhaseRad;
  const P=[r*Math.cos(t),0,r*Math.sin(t)];
  const pv=[-r*Math.sin(t)*omega,0,r*Math.cos(t)*omega];
  const pa=[-r*Math.cos(t)*omega*omega-r*Math.sin(t)*alpha,0,-r*Math.sin(t)*omega*omega+r*Math.cos(t)*alpha];
  const q=Math.sqrt(L*L-P[2]*P[2]);
  const x=P[0]+q;
  const v=pv[0]-P[2]*pv[2]/q;
  const relativeV=[v-pv[0],0,-pv[2]];
  const a=pa[0]-(P[2]*pa[2]+dot(relativeV,relativeV))/q;
  const transmitted=F-m*a;
  const forceOnCrank=[transmitted,0,-transmitted*P[2]/q];
  const physicalTorque=cross(P,forceOnCrank);
  const torqueAlongPositiveTheta=-physicalTorque[1];
  const power=dot(physicalTorque,[0,-omega,0]);
  const frameForce=[-m*a,0,0];
  const moment=cross([x,c.axisYM,0],frameForce);
  return {x,v,a,torque:torqueAlongPositiveTheta,power,frameForce,yaw:moment[2],pistonPower:F*v,kineticRate:m*a*v};
}
function independentAll(design,theta,omega,alpha,forces,masses) {
  const cs=design.cylinders.map((c,i)=>independentCylinder(c,theta,omega,alpha,forces[i],masses[i]));
  const sum=f=>cs.reduce((s,c)=>s+f(c),0);
  return {cs,force:sum(c=>c.frameForce[0]),yaw:sum(c=>c.yaw),torque:sum(c=>c.torque),power:sum(c=>c.power),pistonPower:sum(c=>c.pistonPower),kineticRate:sum(c=>c.kineticRate)};
}
const review={scope:'Independent geometry, velocity sign, differentiated constraint, 3D torque/moment, and power audit of FH88 original SI prescribed-motion candidate only.',dateUTC:new Date().toISOString(),groups:[]};
const add=(name,details)=>review.groups.push({name,pass:true,...details});

const datum=contract(d);
close(datum.railInnerFaceYM[1]-datum.railInnerFaceYM[0],1.435,1e-14);
for (let i=0;i<2;i++) {
  const side=i?1:-1;
  close(datum.railHeadCentreYM[i],side*(1.435/2+0.07/2),1e-14);
  close(datum.nominalRollingCircleYM[i],side*.7525,1e-14);
  const outerWheelFace=side*(.7525+.045);
  close(Math.abs(d.cylinders.find(c=>c.id===(i?'left':'right')).axisYM-outerWheelFace),.11,1e-14);
}
add('Rail-head inner faces, rolling centres and outside axial stack derived independently',{gaugeM:1.435,rollingCircleYM:[-.7525,.7525],outerWheelFacesYM:[-.7975,.7975],outsideCylinderYM:[-.9075,.9075]});

for(const speed of [-33.333333333333336,-1,0,1,33.333333333333336]) {
  const omega=-speed/R;
  const spinVelocity=cross([0,-omega,0],[0,0,-R]);
  const directVelocity=speed+spinVelocity[0];
  const k=nominalRollingContact(d,{bodySpeedMS:speed,omegaRadS:omega,bodyXM:7});
  close(k.contactPointLongitudinalVelocityMS,directVelocity,1e-13);
  assert.equal(k.pureRolling,true);
}
const wrongSpin=nominalRollingContact(d,{bodySpeedMS:20,omegaRadS:20/R});
assert.equal(wrongSpin.pureRolling,false);close(wrongSpin.contactPointLongitudinalVelocityMS,40,1e-13);
add('Rolling direction verified from angular-velocity vector cross bottom radius',{positiveThetaAxis:'negative global Y',correctForwardOmegaSign:'negative',negativeExample:{speedMS:20,incorrectOmegaRadS:20/R,resultSlipMS:wrongSpin.contactPointLongitudinalVelocityMS,pureRolling:wrongSpin.pureRolling}});

const torqueSign=evaluate(d,state(Math.PI/2,-2),[1000,0,0],[0,0,0]);
close(torqueSign.shaftTorqueNm,-355.5,1e-10);
close(torqueSign.shaftPowerW,711,1e-10);
add('Explicit quarter-turn torque sign sanity check',{thetaRad:Math.PI/2,omegaRadS:-2,externalForcesN:[1000,0,0],massesKg:[0,0,0],generalizedTorqueAlongPositiveThetaNm:torqueSign.shaftTorqueNm,physicalGlobalYTorqueNm:-torqueSign.shaftTorqueNm,shaftPowerW:torqueSign.shaftPowerW,meaning:'Positive theta is around negative Y. At the top crank pin, a positive-X piston force gives positive physical Y torque, negative generalized torque, and positive shaft power with forward negative omega.'});

let max={positionM:0,velocityMS:0,accelerationMS2:0,torqueNm:0,powerW:0,aggregatePowerW:0,inertialForceN:0,yawNm:0};
const forces=[97000,-44000,23000],masses=[83,61,107];
const operatingCases=[[0,0],[-35.08771929824562,0],[-12,.7],[7,-2.1],[0,3]];
for(const [omega,alpha] of operatingCases)for(let i=0;i<=720;i++) {
  const theta=2*Math.PI*i/720;
  const a=independentAll(d,theta,omega,alpha,forces,masses);
  const k=evaluate(d,state(theta,omega,alpha),forces,masses);
  for(let j=0;j<3;j++) {
    const x=k.cylinders[j].kinematicsAndLoads,b=a.cs[j];
    max.positionM=Math.max(max.positionM,Math.abs(x.axisCoordinateM-b.x));
    max.velocityMS=Math.max(max.velocityMS,Math.abs(x.velocityMS-b.v));
    max.accelerationMS2=Math.max(max.accelerationMS2,Math.abs(x.accelerationMS2-b.a));
    max.torqueNm=Math.max(max.torqueNm,Math.abs(x.torqueNm-b.torque));
    max.powerW=Math.max(max.powerW,Math.abs(x.crankPowerW-b.power));
    close(k.cylinders[j].localThetaRad,theta+d.cylinders[j].crankPhaseRad,1e-14);
    close(k.cylinders[j].crankPinWorldM[1],d.cylinders[j].axisYM,1e-14);
    close(k.cylinders[j].crossheadPinWorldM[1],d.cylinders[j].axisYM,1e-14);
  }
  max.inertialForceN=Math.max(max.inertialForceN,Math.abs(a.force-k.sliderInertialNetFrameForceXN));
  max.yawNm=Math.max(max.yawNm,Math.abs(a.yaw-k.sliderInertialYawCoupleNm));
  max.aggregatePowerW=Math.max(max.aggregatePowerW,Math.abs(a.pistonPower-a.kineticRate-k.shaftPowerW));
  close(k.shaftTorqueNm,a.torque,1e-8);close(k.shaftPowerW,a.power,1e-7);
}
assert.ok(max.accelerationMS2<1e-9&&max.powerW<1e-7&&max.aggregatePowerW<1e-7&&max.inertialForceN<1e-7&&max.yawNm<1e-7);
add('Independent differentiated rod constraints and 3D cross products agree for unequal masses and nonzero acceleration',{states:operatingCases.length*721,operatingCases:operatingCases.map(([omega,alpha])=>({omegaRadS:omega,alphaRadS2:alpha})),maximumAbsoluteDiscrepancy:max});

// A finite-time energy derivative additionally checks power without reusing m*a*v.
const KE=t=> {
  const theta=.71-12*t+.5*.7*t*t,omega=-12+.7*t;
  return independentAll(d,theta,omega,.7,forces,masses).cs.reduce((s,c,i)=>s+.5*masses[i]*c.v*c.v,0);
};
const h=1e-5;
const numericalEnergyRate=(KE(-2*h)-8*KE(-h)+8*KE(h)-KE(2*h))/(12*h);
const energyState=evaluate(d,state(.71,-12,.7),forces,masses);
close(energyState.sliderKineticEnergyRateW,numericalEnergyRate,.001);
close(energyState.externalPistonPowerW-energyState.shaftPowerW,numericalEnergyRate,.001);
add('Five-point finite-time derivative of total slider kinetic energy',{stepS:h,finiteDifferenceEnergyRateW:numericalEnergyRate,reportedEnergyRateW:energyState.sliderKineticEnergyRateW,absoluteResidualW:Math.abs(energyState.externalPistonPowerW-energyState.shaftPowerW-numericalEnergyRate)});

const omega=-(120/3.6)/R;
let peakNet=0,peakYaw=0,netTheta=0,yawTheta=0,maxIndependentNetDiscrepancy=0,maxIndependentYawDiscrepancy=0;
for(let i=0;i<=65536;i++) {
  const theta=i*2*Math.PI/65536,a=independentAll(d,theta,omega,0,[0,0,0],[80,80,80]);
  if(Math.abs(a.force)>peakNet){peakNet=Math.abs(a.force);netTheta=theta;}
  if(Math.abs(a.yaw)>peakYaw){peakYaw=Math.abs(a.yaw);yawTheta=theta;}
  // Cross-check source on a subset; maxima come from independent constraint equations.
  if(i%32===0) {
    const k=evaluate(d,state(theta,omega),[0,0,0],[80,80,80]);
    maxIndependentNetDiscrepancy=Math.max(maxIndependentNetDiscrepancy,Math.abs(a.force-k.sliderInertialNetFrameForceXN));
    maxIndependentYawDiscrepancy=Math.max(maxIndependentYawDiscrepancy,Math.abs(a.yaw-k.sliderInertialYawCoupleNm));
  }
}
assert.ok(peakNet>.126&&peakNet<.128&&peakYaw>56314&&peakYaw<56315);
add('Independent 65,537-angle 120 km/h sensitivity sweep',{massPerCylinderKg:80,massesAreIllustrativeOnly:true,realDesignMasses:d.cylinders.map(c=>c.equivalentReciprocatingMassKg),omegaRadS:omega,peakNetLongitudinalN:peakNet,peakYawNm:peakYaw,netPeakThetaRad:netTheta,yawPeakThetaRad:yawTheta,maximumSourceComparisonResidualN:maxIndependentNetDiscrepancy,maximumSourceComparisonResidualNm:maxIndependentYawDiscrepancy,interpretation:'Very small longitudinal sum does not imply balancing: the large yaw couple remains. Slider inertia only.'});

const allInPhase=structuredClone(d);allInPhase.cylinders.forEach(c=>c.crankPhaseRad=0);
const quarterPhased=structuredClone(d);quarterPhased.cylinders.forEach((c,i)=>c.crankPhaseRad=i*Math.PI/2);
const synchronous=independentAll(allInPhase,0,omega,0,[0,0,0],[80,80,80]);
const quarter=independentAll(quarterPhased,0,omega,0,[0,0,0],[80,80,80]);
const unequal=independentAll(d,0,omega,0,[0,0,0],[88,80,80]);
assert.ok(Math.abs(synchronous.force)>100000&&Math.abs(quarter.force)>3000&&Math.abs(unequal.force)>3000);
const rejectedGauge=structuredClone(d);rejectedGauge.track.nominalGaugeM=1.505;
assert.throws(()=>contract(rejectedGauge),/AXIAL_STACK/);
// Record current API behavior; alternative phases are accepted as supplied, not rejected.
assert.doesNotThrow(()=>contract(quarterPhased));
const timeA=evaluate(d,state(.7,-12,.4,0),forces,masses),timeB=evaluate(d,state(.7,-12,.4,999),forces,masses);
assert.deepEqual(timeA.cylinders,timeB.cylinders);
add('Negative controls detect wrong rolling sign, wrong gauge convention, altered phases and unequal masses',{wrongGaugeRejected:true,allInPhaseNetAtTheta0N:synchronous.force,quarterPhasedNetAtTheta0N:quarter.force,unequalMassesKg:[88,80,80],unequalMassNetAtTheta0N:unequal.force,explicitAlternativePhasesAcceptedByAPI:true,phaseGuardObservation:'contract validates finite phases but does not lock 0/120/240. The shipped design has that choice. If immutable fixed-design identity is intended, add a separate phase contract guard; do not claim existing tests reject quarter-cycle phase arrays.',worldTimeRole:'metadata only; theta, omega and alpha are prescribed boundary values, not integrated or cross-validated against time'});

// Independent r x F about two origins; use unequal masses to make the transport term visible.
const referenceState=evaluate(d,state(.71,-12,.7),forces,masses);
const origin=referenceState.momentReferencePointM,offset=[1.2,.31,-.4];
const newOrigin=origin.map((v,i)=>v+offset[i]);
function momentsAbout(o) {
  return referenceState.cylinders.reduce((sum,c)=> {
    const lever=c.crossheadPinWorldM.map((v,i)=>v-o[i]);
    const moment=cross(lever,[c.sliderInertialReactionOnFrameXN,0,0]);
    return sum.map((v,i)=>v+moment[i]);
  },[0,0,0]);
}
const M= momentsAbout(origin),Mnew=momentsAbout(newOrigin);
const translationMoment=cross(offset,[referenceState.sliderInertialNetFrameForceXN,0,0]);
const transported=M.map((v,i)=>v-translationMoment[i]);
Mnew.forEach((v,i)=>close(v,transported[i],1e-9));
close(M[2],referenceState.sliderInertialYawCoupleNm,1e-9);
close(Mnew[2],M[2]+offset[1]*referenceState.sliderInertialNetFrameForceXN,1e-9);
close(Mnew[1],-offset[2]*referenceState.sliderInertialNetFrameForceXN,1e-9);
assert.ok(Math.abs(translationMoment[2])>100);
add('Reference point transport checked using direct world-space r cross F',{originalOriginM:origin,newOriginM:newOrigin,totalSliderReactionXN:referenceState.sliderInertialNetFrameForceXN,originalMomentNm:M,newDirectMomentNm:Mnew,transportedMomentNm:transported,law:'M(O + delta) = M(O) - delta cross F_total; yaw changes by +delta_y * F_x, pitch by -delta_z * F_x.',wrongTransportSignWouldChangeYawNm:2*Math.abs(translationMoment[2])});

const cyclic=structuredClone(d);
cyclic.cylinders.forEach((c,i)=>c.crankPhaseRad=d.cylinders[(i+1)%3].crankPhaseRad);
let cyclicForceResidual=0,cyclicTimeShiftYawResidual=0,cyclicSameThetaYawDifference=0,originalPeak=0,cyclicPeak=0;
for(let i=0;i<1440;i++) {
  const theta=2*Math.PI*i/1440;
  const original=evaluate(d,state(theta,omega),[0,0,0],[80,80,80]);
  const permuted=evaluate(cyclic,state(theta,omega),[0,0,0],[80,80,80]);
  const shifted=evaluate(d,state(theta+2*Math.PI/3,omega),[0,0,0],[80,80,80]);
  cyclicForceResidual=Math.max(cyclicForceResidual,Math.abs(original.sliderInertialNetFrameForceXN-permuted.sliderInertialNetFrameForceXN));
  cyclicTimeShiftYawResidual=Math.max(cyclicTimeShiftYawResidual,Math.abs(shifted.sliderInertialYawCoupleNm-permuted.sliderInertialYawCoupleNm));
  cyclicSameThetaYawDifference=Math.max(cyclicSameThetaYawDifference,Math.abs(original.sliderInertialYawCoupleNm-permuted.sliderInertialYawCoupleNm));
  originalPeak=Math.max(originalPeak,Math.abs(original.sliderInertialYawCoupleNm));
  cyclicPeak=Math.max(cyclicPeak,Math.abs(permuted.sliderInertialYawCoupleNm));
}
assert.ok(cyclicForceResidual<1e-8&&cyclicTimeShiftYawResidual<1e-8&&cyclicSameThetaYawDifference>50000);
close(originalPeak,cyclicPeak,1e-8);
add('Cyclic phase reassignment distinguished from fixed-angle invariance',{equalMassesKg:[80,80,80],cyclicPhaseChoiceDegrees:[120,240,0],fixedAngleNetForceMaxDifferenceN:cyclicForceResidual,yawTimeShiftMaxDifferenceNm:cyclicTimeShiftYawResidual,timeShiftRule:'yaw_cyclic(theta) = yaw_original(theta + 120 degrees); for constant omega, time shift is (2*pi/3)/omega. Negative omega makes that a negative time shift.',fixedAngleYawMaxDifferenceNm:cyclicSameThetaYawDifference,fullCycleOriginalPeakAbsYawNm:originalPeak,fullCycleCyclicPeakAbsYawNm:cyclicPeak,limits:'Fixed-angle force invariance here depends on equal masses. Yaw at fixed angle is generally different; only its phase-shifted waveform and full-cycle peak are invariant. For nonzero alpha, this is an instantaneous theta shift at matching omega and alpha, not a global constant time shift.'});

// Mirror the physical layout while retaining right/inside/left contract names.
const mirrored=structuredClone(d);
mirrored.cylinders=d.cylinders.map(c=>({...c,id:c.id==='left'?'right':c.id==='right'?'left':'inside',axisYM:-c.axisYM}));
let mirrorForceResidual=0,mirrorYawResidual=0,mirrorTorqueResidual=0;
for(let i=0;i<=720;i++) {
  const theta=2*Math.PI*i/720,a=evaluate(d,state(theta,-12,.7),forces,masses),b=evaluate(mirrored,state(theta,-12,.7),forces,masses);
  mirrorForceResidual=Math.max(mirrorForceResidual,Math.abs(a.sliderInertialNetFrameForceXN-b.sliderInertialNetFrameForceXN));
  mirrorYawResidual=Math.max(mirrorYawResidual,Math.abs(a.sliderInertialYawCoupleNm+b.sliderInertialYawCoupleNm));
  mirrorTorqueResidual=Math.max(mirrorTorqueResidual,Math.abs(a.shaftTorqueNm-b.shaftTorqueNm));
}
assert.ok(mirrorForceResidual<1e-10&&mirrorYawResidual<1e-10&&mirrorTorqueResidual<1e-10);
const reindex=[2,0,1],reordered=structuredClone(d);reordered.cylinders=reindex.map(i=>d.cylinders[i]);
const orderA=evaluate(d,state(.71,-12,.7),forces,masses),orderB=evaluate(reordered,state(.71,-12,.7),reindex.map(i=>forces[i]),reindex.map(i=>masses[i]));
close(orderA.sliderInertialNetFrameForceXN,orderB.sliderInertialNetFrameForceXN,1e-9);close(orderA.sliderInertialYawCoupleNm,orderB.sliderInertialYawCoupleNm,1e-9);close(orderA.shaftPowerW,orderB.shaftPowerW,1e-9);
add('Left-right mirror reverses yaw and pure cylinder-list reindex preserves aggregates',{mirrorUsesPhysicalMassAndForceWithEachCylinder:true,maxMirrorForceDifferenceN:mirrorForceResidual,maxMirrorYawSumNm:mirrorYawResidual,maxMirrorTorqueDifferenceNm:mirrorTorqueResidual,permutation:'Cylinder list, forces and masses were all reindexed together, unlike reassigning phases at fixed axial stations.'});

review.allPassed=true;review.groupCount=review.groups.length;
fs.writeFileSync(path.join(root,'INDEPENDENT_REVIEW_RESULTS.json'),JSON.stringify(review,null,2)+'\n');
console.log(JSON.stringify(review,null,2));
