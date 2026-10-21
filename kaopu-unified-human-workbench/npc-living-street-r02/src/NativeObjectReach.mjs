/** Contact reach with the retained native two-link elbow/forearm-roll solve.
 * The source body, every joint and all skin influences remain unchanged.
 * The returned pose still needs real prop contact and finite-force transport.
 */
import {THREE} from './NativeBinding.mjs';
import {math} from './NativeRig.mjs';
import {minimumBagTurn,PICKUP_REACH_RULES} from './PickupReachGeometry.mjs';
const {add,sub,scale,dot,cross,norm,unit,lerp,pos,rotation,mv,axisRotation,clamp,DEG}=math;
function blendRotation(a,b,t){
  const matrix=r=>new THREE.Matrix4().set(r[0],r[1],r[2],0,r[3],r[4],r[5],0,r[6],r[7],r[8],0,0,0,0,1),
    qa=new THREE.Quaternion().setFromRotationMatrix(matrix(a)),qb=new THREE.Quaternion().setFromRotationMatrix(matrix(b)),
    e=new THREE.Matrix4().makeRotationFromQuaternion(qa.slerp(qb,clamp(t,0,1)).normalize()).elements;
  return[e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]];
}

export function solveNativeObjectReach(motion,world,{side='R',turn=0,orientationWeight=1,allowYaw=false}={}){
  const rig=motion.rig,tools=motion.tools,limb=rig.limbs['arm'+side],sign=side==='L'?1:-1,
    local=motion._native(world),shoulder=pos(rig.posedMatrices[limb.a]),
    restOffset=sub(tools.palmRest(side),rig.restP[limb.c]),upright=motion._contactHandRotation(side,0,1,true);
  let actualTurn=turn,yawBoundary=null;
  if(allowYaw&&orientationWeight>=.999){
    // Rotate the actual shoulder-to-palm relation into the desired object
    // frame; the existing quartic returns the nearest feasible yaw delta.
    const relative=mv(axisRotation([0,0,1],-turn),sub(local,shoulder));
    yawBoundary=minimumBagTurn(relative,mv(upright,restOffset),sign,limb.upper,limb.lower);
    if(yawBoundary.angle!==null)actualTurn+=yawBoundary.angle;
  }
  const desired=motion._contactHandRotation(side,actualTurn,1,true),
    wanted=blendRotation(rotation(rig.skinMatrices[limb.c]),desired,orientationWeight),
    F=unit(mv(wanted,rig.hand[side].forward));
  let wrist=sub(local,mv(wanted,restOffset)),solution=null,roll=0;
  for(let i=0;i<4;i++){
    const currentShoulder=pos(rig.posedMatrices[limb.a]),L=limb.upper+limb.lower,
      naturalPole=add(currentShoulder,[sign*L*.66,-L*.03,-L*.32]),
      pole=lerp(naturalPole,sub(wrist,scale(F,limb.lower)),orientationWeight);
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
    actualPalmErrorM:norm(sub(local,tools.samplePalm(side))),rollRadians:roll,objectTurnRadians:actualTurn,
    yawBoundary,originalCoupledElbowRoll:true,wristGateDegrees:PICKUP_REACH_RULES.wristGateDegrees,
    wristWithinGate:wristBendDegrees<PICKUP_REACH_RULES.wristGateDegrees};
}
