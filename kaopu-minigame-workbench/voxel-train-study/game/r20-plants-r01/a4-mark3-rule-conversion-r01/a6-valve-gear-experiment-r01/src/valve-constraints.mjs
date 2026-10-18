/**
 * Independent, dimension-explicit outside Walschaerts topology experiment.
 * It does not edit, monkey-patch, or replace the released A6 R02 renderer.
 * Coordinates here are [y,z], metres. Wheel phase is the R02 crank phase.
 * This solves constraints, not steam events, historical A4 timing, or forces.
 */
export const VALVE_EXPERIMENT_VERSION = 'a6-outside-valve-constraint-experiment/1';
const TAU=2*Math.PI;
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const norm=a=>Math.hypot(...a);
const distance=(a,b)=>norm(sub(a,b));
const rotate=(p,t)=>[Math.cos(t)*p[0]-Math.sin(t)*p[1],Math.sin(t)*p[0]+Math.cos(t)*p[1]];
const maxAbs=a=>Math.max(...a.map(Math.abs));
const finite=(v,name)=>{if(!Number.isFinite(v))throw new TypeError(`${name} must be finite`);return v;};

export const PRIMARY_LOCKS=Object.freeze({wheelTreadDiameterM:2.032,crankRadiusM:.3302,pistonStrokeM:.6604,driverAxisZM:Object.freeze([3.5814,5.7912,8.001])});

/** Candidate dimensions are deliberately separate from the primary locks. */
export const CANDIDATE_DIMENSIONS=Object.freeze({
  eccentricPitchRadiusM:.145,eccentricReferenceAngleRad:Math.PI/2,
  eccentricRodLengthM:2.36,expansionTailRadiusM:.30,
  trunnionY:1.58,trunnionZ:3.55,valveHeightM:1.82,
  combinationUpperArmM:.08,combinationLowerArmM:.72,
  referenceValveZ:2.25,referenceCrossheadZ:2.49,
  referenceExpansionDieAngleRad:-.12,
  referenceLiftingDieBehindExpansionDieM:.40,
  expansionSlotLimitsRad:Object.freeze([-.28,.28]),
  radiusRodSupportSlotLimitsM:Object.freeze([-.46,-.075]),
});

/** Exact circle intersection, with a fixed, non-toggling assembly branch. */
function rocker(model,theta){
  const p=model.dimensions,E=add(model.O,rotate(model.eccentricReference,theta)),v=sub(E,model.Q),d=norm(v),u=mul(v,1/d);
  const a=(p.expansionTailRadiusM**2-p.eccentricRodLengthM**2+d*d)/(2*d),h2=p.expansionTailRadiusM**2-a*a;
  if(h2<=1e-12)throw new Error(`Unreachable or toggling eccentric loop at ${theta}`);
  const T=add(model.Q,add(mul(u,a),mul([-u[1],u[0]],Math.sqrt(h2)))),w=sub(T,model.Q);
  return {E,T,beta:Math.atan2(-w[1],-w[0]),circleMarginM:Math.min(p.eccentricRodLengthM+p.expansionTailRadiusM-d,d-Math.abs(p.eccentricRodLengthM-p.expansionTailRadiusM))};
}

function joints(model,theta,x){
  const p=model.dimensions,[slotAngle,valveZ,combinationAngle]=x,rk=rocker(model,theta),beta=rk.beta-model.beta0;
  const localD=add(model.curveCenter,rotate(mul(model.curveCenter,-1),slotAngle)),D=add(model.Q,rotate(localD,beta));
  const V=[p.valveHeightM,valveZ],u=[Math.cos(combinationAngle),Math.sin(combinationAngle)];
  const A=add(V,mul(u,p.combinationUpperArmM)),U=sub(V,mul(u,p.combinationLowerArmM));
  const P=add(model.O,rotate([model.radius,0],theta));
  const C=[model.O[0],P[1]-Math.sqrt(model.mainRodLengthM**2-(P[0]-model.O[0])**2)];
  const t=mul(sub(A,D),1/model.radiusRodLengthM),h=sub(model.H,D);
  return {...rk,beta,D,V,A,U,C,P,Q:model.Q,H:model.H,slotAngle,combinationAngle,supportCoordinateM:dot(t,h),radiusRodDirection:t};
}
function residual(model,theta,x){
  const j=joints(model,theta,x),a=sub(j.A,j.D),u=sub(j.U,j.C);
  return [(dot(a,a)-model.radiusRodLengthM**2)/model.radiusRodLengthM,(dot(u,u)-model.unionLengthM**2)/model.unionLengthM,cross(j.radiusRodDirection,sub(model.H,j.D))];
}
function solveLinear(A,b){
  const m=A.map((row,i)=>[...row,b[i]]);let minPivot=Infinity;
  for(let k=0;k<3;k++){
    let pivot=k;for(let i=k+1;i<3;i++)if(Math.abs(m[i][k])>Math.abs(m[pivot][k]))pivot=i;
    [m[k],m[pivot]]=[m[pivot],m[k]];minPivot=Math.min(minPivot,Math.abs(m[k][k]));
    if(Math.abs(m[k][k])<1e-11)throw Error('Valve constraint Jacobian is singular');
    for(let i=k+1;i<3;i++){const f=m[i][k]/m[k][k];for(let j=k;j<4;j++)m[i][j]-=f*m[k][j];}
  }
  const x=[0,0,0];for(let i=2;i>=0;i--){let s=m[i][3];for(let j=i+1;j<3;j++)s-=m[i][j]*x[j];x[i]=s/m[i][i];}
  return {x,minPivot};
}
function solve(model,theta,seed){
  let x=[...seed],minimumPivot=Infinity;
  for(let iteration=0;iteration<24;iteration++){
    const f=residual(model,theta,x),error=maxAbs(f);
    if(error<2e-13)return {x,residualM:error,iterations:iteration,minimumPivot};
    const h=1e-6,J=Array.from({length:3},()=>[0,0,0]);
    for(let k=0;k<3;k++){
      const a=[...x],b=[...x];a[k]+=h;b[k]-=h;
      const fa=residual(model,theta,a),fb=residual(model,theta,b);
      for(let row=0;row<3;row++)J[row][k]=(fa[row]-fb[row])/(2*h);
    }
    const step=solveLinear(J,f.map(v=>-v));minimumPivot=Math.min(minimumPivot,step.minPivot);
    let accepted=false;
    for(let factor=1;factor>=1/1024;factor/=2){
      const candidate=x.map((v,i)=>v+factor*step.x[i]);
      if(maxAbs(residual(model,theta,candidate))<error){x=candidate;accepted=true;break;}
    }
    if(!accepted)throw Error(`Valve root failed to decrease residual at ${theta}`);
  }
  throw Error(`Valve root did not converge at ${theta}`);
}

export function createValveConstraintModel(overrides={}){
  const p={...CANDIDATE_DIMENSIONS,...overrides};
  for(const [k,v]of Object.entries(p))if(typeof v==='number')finite(v,k);
  for(const key of Object.keys(overrides))if(!(key in CANDIDATE_DIMENSIONS))throw Error(`Unknown or primary-locked parameter: ${key}`);
  if(p.referenceCrossheadZ!==2.49)throw Error('R02 interface locks referenceCrossheadZ=2.49 m and the existing main rod length');
  for(const key of ['eccentricPitchRadiusM','eccentricRodLengthM','expansionTailRadiusM','combinationUpperArmM','combinationLowerArmM'])if(p[key]<=0)throw Error(`${key} must be positive`);
  for(const key of ['expansionSlotLimitsRad','radiusRodSupportSlotLimitsM'])if(!Array.isArray(p[key])||p[key].length!==2||!p[key].every(Number.isFinite)||p[key][0]>=p[key][1])throw Error(`Invalid ${key}`);
  const model={version:VALVE_EXPERIMENT_VERSION,dimensions:p,primaryDimensions:PRIMARY_LOCKS,O:[1.016,5.7912],Q:[p.trunnionY,p.trunnionZ],radius:.3302,
    historicalA4Dimensions:false,actualValveEventsSolved:false,fullVehicleApproval:false,renderGeometryProvided:false};
  model.mainRodLengthM=Math.hypot(model.O[1]-p.referenceCrossheadZ,model.radius);
  model.eccentricReference=[p.eccentricPitchRadiusM*Math.cos(p.eccentricReferenceAngleRad),p.eccentricPitchRadiusM*Math.sin(p.eccentricReferenceAngleRad)];
  model.physicalReturnCrankLengthM=distance(model.eccentricReference,[model.radius,0]);
  const A0=[p.valveHeightM+p.combinationUpperArmM,p.referenceValveZ],U0=[p.valveHeightM-p.combinationLowerArmM,p.referenceValveZ],C0=[model.O[0],p.referenceCrossheadZ];
  model.curveCenter=sub(A0,model.Q);model.radiusRodLengthM=norm(model.curveCenter);model.slotRadiusM=model.radiusRodLengthM;model.unionLengthM=distance(U0,C0);
  model.beta0=rocker(model,0).beta;
  const D0=add(model.Q,add(model.curveCenter,rotate(mul(model.curveCenter,-1),p.referenceExpansionDieAngleRad)));
  model.H=sub(D0,mul(sub(A0,D0),p.referenceLiftingDieBehindExpansionDieM/model.radiusRodLengthM));
  model.referenceUnknowns=[p.referenceExpansionDieAngleRad,p.referenceValveZ,0];
  if(maxAbs(residual(model,0,model.referenceUnknowns))>1e-12)throw Error('Reference dimensions do not close');
  // Numerical branch seeds only. They contain three scalar root unknowns, not
  // render vertices or interpolated motion. Every requested pose is re-solved.
  model.seedStepRad=Math.PI/180;model.branchSeeds=[model.referenceUnknowns];
  let x=model.referenceUnknowns;
  for(let i=1;i<=360;i++){x=solve(model,i*model.seedStepRad,x).x;model.branchSeeds.push(x);}
  model.rawCycleClosure=distance(x,model.referenceUnknowns);
  model.constraintGraph={
    ground:['driver-axis O','expansion-link trunnion Q','fixed-setting lifting-arm die H','piston horizontal guide','valve horizontal guide'],
    rigidLinks:['return crank P–E, rigid to wheel','eccentric rod E–T','expansion link with trunnion Q, tail T and curved slot','radius rod D–A with rear straight support slot','three-pin combination lever A–V–U','union link C–U','piston rod/crosshead C','valve crosshead V'],
    slidingJoints:['D follows the rotating expansion-link circular slot','fixed H slides inside the radius rod rear straight slot','C and V follow their distinct fixed horizontal guides'],
    control:'H remains fixed for this one reverser setting; the reverser reach rod is not oscillated',
  };
  return model;
}

export function evaluateValveConstraints(model,phaseRad){
  finite(phaseRad,'phaseRad');let theta=((phaseRad%TAU)+TAU)%TAU;if(theta<1e-12||TAU-theta<1e-12)theta=0;
  const index=Math.min(359,Math.floor(theta/model.seedStepRad)),solution=theta===0?{x:[...model.referenceUnknowns],residualM:0,iterations:0}:solve(model,theta,model.branchSeeds[index]);
  const j=joints(model,theta,solution.x),p=model.dimensions;
  const checks={
    eccentricRodLengthErrorM:Math.abs(distance(j.E,j.T)-p.eccentricRodLengthM),
    expansionTailRadiusErrorM:Math.abs(distance(j.Q,j.T)-p.expansionTailRadiusM),
    radiusRodLengthErrorM:Math.abs(distance(j.D,j.A)-model.radiusRodLengthM),
    unionLengthErrorM:Math.abs(distance(j.U,j.C)-model.unionLengthM),
    combinationUpperLengthErrorM:Math.abs(distance(j.A,j.V)-p.combinationUpperArmM),
    combinationLowerLengthErrorM:Math.abs(distance(j.U,j.V)-p.combinationLowerArmM),
    returnCrankLengthErrorM:Math.abs(distance(j.P,j.E)-model.physicalReturnCrankLengthM),
    mainRodLengthErrorM:Math.abs(distance(j.P,j.C)-model.mainRodLengthM),
    liftingDieLineErrorM:Math.abs(cross(j.radiusRodDirection,sub(model.H,j.D))),
    expansionSlotMarginRad:Math.min(j.slotAngle-p.expansionSlotLimitsRad[0],p.expansionSlotLimitsRad[1]-j.slotAngle),
    liftingSlotMarginM:Math.min(j.supportCoordinateM-p.radiusRodSupportSlotLimitsM[0],p.radiusRodSupportSlotLimitsM[1]-j.supportCoordinateM),
  };
  if(checks.expansionSlotMarginRad<0||checks.liftingSlotMarginM<0)throw Error(`Valve mechanical slot limit exceeded at phase ${theta}`);
  return {phaseRad:theta,joints:j,unknowns:solution.x,residualM:solution.residualM,iterations:solution.iterations,checks};
}

export function validateValveConstraintCycle(model,{samples=1440}={}){
  if(!Number.isInteger(samples)||samples<360)throw Error('samples must be an integer >=360');
  const ranges=Object.fromEntries(['valveZ','crossheadZ','expansionDieAngleRad','liftingDieCoordinateM','expansionBodyAngleRad','combinationAngleRad'].map(k=>[k,[Infinity,-Infinity]]));
  let maxConstraintErrorM=0,minExpansionSlotMarginRad=Infinity,minLiftingSlotMarginM=Infinity,minFourBarCircleMarginM=Infinity;
  for(let i=0;i<=samples;i++){
    const q=evaluateValveConstraints(model,i*TAU/samples),j=q.joints;
    maxConstraintErrorM=Math.max(maxConstraintErrorM,q.residualM,...Object.entries(q.checks).filter(([k])=>k.endsWith('ErrorM')).map(([,v])=>v));
    minExpansionSlotMarginRad=Math.min(minExpansionSlotMarginRad,q.checks.expansionSlotMarginRad);
    minLiftingSlotMarginM=Math.min(minLiftingSlotMarginM,q.checks.liftingSlotMarginM);
    minFourBarCircleMarginM=Math.min(minFourBarCircleMarginM,j.circleMarginM);
    const values=[j.V[1],j.C[1],j.slotAngle,j.supportCoordinateM,j.beta,j.combinationAngle];
    Object.keys(ranges).forEach((key,k)=>{ranges[key][0]=Math.min(ranges[key][0],values[k]);ranges[key][1]=Math.max(ranges[key][1],values[k]);});
  }
  const strokeM=ranges.crossheadZ[1]-ranges.crossheadZ[0],valveTravelM=ranges.valveZ[1]-ranges.valveZ[0];
  return {schema:'a6-valve-constraint-cycle/1',status:'fixed-reverser-setting design kinematic candidate',samples:samples+1,
    constraintCyclePass:maxConstraintErrorM<1e-10&&model.rawCycleClosure<1e-10&&minExpansionSlotMarginRad>0&&minLiftingSlotMarginM>0&&Math.abs(strokeM-.6604)<1e-10,
    maxConstraintErrorM,rawRootCycleClosure:model.rawCycleClosure,pistonStrokeM:strokeM,pistonStrokeErrorM:strokeM-.6604,valveTravelM,
    minExpansionSlotMarginRad,minLiftingSlotMarginM,minFourBarCircleMarginM,ranges,
    finiteDieBlocksValidated:false,allMeshesSweepValidated:false,actualValveEventsSolved:false,historicalA4Timing:false,fullVehicleApproval:false,
    limits:['Point joint constraints only; finite die-block, bearing and slot clearances still require native solid design and swept tests.','No valve lap, lead, port width, cutoff or admission mode has been inferred.','The fixed reverser setting has no numerical cutoff claim.','Left/right phase and inside/Gresley conjugated mechanism are unresolved.','This experiment does not change the frozen R02 page or its six collision reports.']};
}
