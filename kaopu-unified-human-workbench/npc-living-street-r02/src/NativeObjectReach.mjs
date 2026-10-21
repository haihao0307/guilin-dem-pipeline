/** Contact reach with the retained native two-link elbow/forearm-roll solve.
 * The source body, every joint and all skin influences remain unchanged.
 * The returned pose still needs real prop contact and finite-force transport.
 */
import {THREE} from './NativeBinding.mjs';
import {math} from './NativeRig.mjs';
import {minimumBagTurn,angularReachIntervals,limbMeasure,PICKUP_REACH_RULES} from './PickupReachGeometry.mjs';
const {add,sub,scale,dot,cross,norm,unit,lerp,pos,rotation,mv,mm3,axisRotation,clamp,DEG}=math;
function blendRotation(a,b,t){
  const matrix=r=>new THREE.Matrix4().set(r[0],r[1],r[2],0,r[3],r[4],r[5],0,r[6],r[7],r[8],0,0,0,0,1),
    qa=new THREE.Quaternion().setFromRotationMatrix(matrix(a)),qb=new THREE.Quaternion().setFromRotationMatrix(matrix(b)),
    e=new THREE.Matrix4().makeRotationFromQuaternion(qa.slerp(qb,clamp(t,0,1)).normalize()).elements;
  return[e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]];
}

export function minimumFreePalmRoll(A,B,F,axis,upper,lower){
  const parallelB=scale(axis,dot(axis,B)),perpendicularB=sub(B,parallelB),sineB=cross(axis,B),
    parallelF=scale(axis,dot(axis,F)),perpendicularF=sub(F,parallelF),sineF=cross(axis,F);
  return angularReachIntervals({upper,lower,
    d2:[dot(A,A)+dot(B,B)-2*dot(A,parallelB),-2*dot(A,perpendicularB),-2*dot(A,sineB)],
    u:[dot(A,parallelF)-dot(B,F),dot(A,perpendicularF),dot(A,sineF)],
    measure:t=>{const R=axisRotation(axis,t);return limbMeasure(sub(A,mv(R,B)),mv(R,F),upper,lower);}});
}

export function solveNativeObjectReach(motion,world,{side='R',turn=0,palmRoll=0,orientationWeight=1,allowYaw=false,allowFreeRoll=false}={}){
  const rig=motion.rig,tools=motion.tools,limb=rig.limbs['arm'+side],sign=side==='L'?1:-1,
    local=motion._native(world),shoulder=pos(rig.posedMatrices[limb.a]),
    restOffset=sub(tools.palmRest(side),rig.restP[limb.c]),upright=motion._contactHandRotation(side,0,1,true);
  let actualTurn=turn,yawBoundary=null;
  if(allowYaw&&orientationWeight>=.999&&Math.abs(palmRoll)<1e-12){
    // Rotate the actual shoulder-to-palm relation into the desired object
    // frame; the existing quartic returns the nearest feasible yaw delta.
    const relative=mv(axisRotation([0,0,1],-turn),sub(local,shoulder));
    yawBoundary=minimumBagTurn(relative,mv(upright,restOffset),sign,limb.upper,limb.lower);
    if(yawBoundary.angle!==null)actualTurn+=yawBoundary.angle;
  }
  const uprightDesired=motion._contactHandRotation(side,actualTurn,1,true),
    // A held prop is free to rotate with the complete native hand. Roll the
    // fingers toward their natural downward carry direction after clearing
    // the counter, instead of forcing a horizontal wrist at a low bag.
    desired=mm3(axisRotation(unit(mv(uprightDesired,rig.hand[side].palm)),palmRoll),uprightDesired);
  let wanted=blendRotation(rotation(rig.skinMatrices[limb.c]),desired,orientationWeight),freeRollBoundary=null;
  if(allowFreeRoll){
    // Before any object is touched, select the smallest actual roll that
    // satisfies the same immutable-bone reach and wrist cone. The complete
    // hand's rotation-invariant envelope sets the approach clearance.
    const axis=unit(mv(wanted,rig.hand[side].palm));
    freeRollBoundary=minimumFreePalmRoll(sub(local,shoulder),mv(wanted,restOffset),unit(mv(wanted,rig.hand[side].forward)),axis,limb.upper,limb.lower);
    if(freeRollBoundary.angle!==null)wanted=mm3(axisRotation(axis,freeRollBoundary.angle),wanted);
  }
  const F=unit(mv(wanted,rig.hand[side].forward));
  let wrist=sub(local,mv(wanted,restOffset)),solution=null,roll=0;
  for(let i=0;i<4;i++){
    const currentShoulder=pos(rig.posedMatrices[limb.a]),L=limb.upper+limb.lower,
      naturalPole=add(currentShoulder,[sign*L*.66,-L*.03,-L*.32]),
      pole=lerp(naturalPole,sub(wrist,scale(F,limb.lower)),allowFreeRoll?1:orientationWeight);
    solution=rig.solveLimb(limb,wrist,pole,PICKUP_REACH_RULES.sourceSolveExtension);
    const elbow=pos(rig.posedMatrices[limb.b]),D=unit(sub(pos(rig.posedMatrices[limb.c]),elbow)),
      oldN=mv(rotation(rig.skinMatrices[limb.c]),rig.hand[side].palm),desiredN=mv(wanted,rig.hand[side].palm),
      aN=unit(sub(oldN,scale(D,dot(oldN,D)))),bN=unit(sub(desiredN,scale(D,dot(desiredN,D))));
    roll=Math.atan2(dot(D,cross(aN,bN)),dot(aN,bN));
    rig.rotateSubtree(limb.b,axisRotation(D,roll),elbow);rig.orientSkin(limb.c,wanted);
    const error=sub(local,tools.samplePalm(side));if(norm(error)<.00020||solution.clamped)break;wrist=add(wrist,error);
  }
  const forearm=unit(sub(pos(rig.posedMatrices[limb.c]),pos(rig.posedMatrices[limb.b]))),
    handForward=unit(mv(rotation(rig.skinMatrices[limb.c]),rig.hand[side].forward)),
    wristBendDegrees=Math.acos(clamp(dot(forearm,handForward),-1,1))/DEG;
  return {...solution,wristBendDegrees,forearmDirection:forearm,handForwardNative:handForward,
    actualPalmErrorM:norm(sub(local,tools.samplePalm(side))),rollRadians:roll,objectTurnRadians:actualTurn,objectPalmRollRadians:palmRoll,
    yawBoundary,freeRollBoundary,freeApproachRollRadians:freeRollBoundary?.angle??null,originalCoupledElbowRoll:true,wristGateDegrees:PICKUP_REACH_RULES.wristGateDegrees,
    wristWithinGate:wristBendDegrees<PICKUP_REACH_RULES.wristGateDegrees};
}
