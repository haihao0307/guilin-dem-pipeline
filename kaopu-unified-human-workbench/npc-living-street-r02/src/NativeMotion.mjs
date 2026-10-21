/**
 * Complete native R07 body execution for the living courtyard.
 *
 * All motion uses the retained 104 rigid bones and full CSR skin. The only
 * renderer submission is poseTools.commit() at the end of update(). Foot and
 * palm corrections sample the live weighted skin before that submission.
 * This is geometric IK with an explicitly assisted grasp; it does not claim
 * joint torques, friction, collision-free skin, or a physical human controller.
 *
 * Coordinates: inputs/outputs are world metres, Y-up; NativeRig is Z-up.
 * Facing yaw=0 is world +Z. R is the person's anatomical right (local -X).
 * For sit/sitting/stand, x,z denote the seat centre. A standing endpoint is
 * seatApproachOffset metres in front of it, matching the navigator's stop.
 *
 * target = real SOURCE palm-surface point for pickup and buying.
 * trade with gripTarget = retrieve at gripTarget, deliver to target.
 * eat with gripTarget = retrieve at gripTarget, deliver to mouth approach.
 * The caller owns objects/constraints/inventory and must independently verify
 * that an acquired object followed the palm and reached completionTarget.
 */
import {math} from './NativeRig.mjs';
import {seatRootOffset} from './SeatMotionPath.mjs';
import {NativeCapturedPickup} from './NativeCapturedPickup.mjs';
import {breadTransportGoal} from './BreadTransportPath.mjs';

const {clamp,smooth,add,sub,scale,dot,cross,norm,unit,lerp,pos,mv,rotation,axisRotation,basisRotation,mm3,tr,DEG}=math;
const SIDES=['L','R'];
const RECOVERY_SECONDS=.40;
const mix=(a,b,t)=>a+(b-a)*t;
const array=p=>p?.toArray?p.toArray():p&&'x' in p?[p.x,p.y,p.z]:Array.from(p||[]);
const finite3=p=>p?.length===3&&p.every(Number.isFinite);
const transform=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[2]*p[2]+m[3],m[4]*p[0]+m[5]*p[1]+m[6]*p[2]+m[7],m[8]*p[0]+m[9]*p[1]+m[10]*p[2]+m[11]];
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
function blendRotationVector(a,b,t) {
  const quaternion=v=>{const angle=norm(v)*DEG,s=angle>1e-10?Math.sin(angle*.5)/norm(v):.5*DEG;return [v[0]*s,v[1]*s,v[2]*s,Math.cos(angle*.5)];};
  const qa=quaternion(a),qb=quaternion(b);let cosine=qa.reduce((sum,x,i)=>sum+x*qb[i],0);
  if(cosine<0){for(let i=0;i<4;i++)qb[i]*=-1;cosine=-cosine;}
  let wa=1-t,wb=t;
  if(cosine<.9999){const theta=Math.acos(clamp(cosine,-1,1)),s=Math.sin(theta);wa=Math.sin((1-t)*theta)/s;wb=Math.sin(t*theta)/s;}
  const q=qa.map((v,i)=>v*wa+qb[i]*wb),length=Math.hypot(...q);for(let i=0;i<4;i++)q[i]/=length;
  const s=Math.hypot(q[0],q[1],q[2]);return s<1e-10?[0,0,0]:scale(q.slice(0,3),2*Math.atan2(s,q[3])/(s*DEG));
}

export class NativeMotion {
  constructor(actor) {
    if(!actor?.poseTools||actor.rig?.count!==104)throw Error('NativeMotion requires the complete R07 actor and its 104-bone poseTools');
    this.actor=actor;this.rig=actor.rig;this.tools=actor.poseTools;
    this.height=actor.binding.height;this.baseFloorOffset=actor.binding.floorOffset;this.floorOffset=this.baseFloorOffset;this.soleLift=0;
    if(!actor.motionLibrary?.ready)throw Error('The existing R04/R05 motion library has not been prepared');
    this.library=actor.motionLibrary;this.captureFeet={};this.freeSettle=1;
    this.groundPelvisDrop=0;
    this.side='R';actor.setSide('R');
    this.phase=.30;this.lastInput=null;this.lastMode=null;this.lastProgress=0;this.lastFeet=null;this.stepState={};
    this.seatFactor=0;this.standStart=1;
    this.lastActionPose=null;this.recoveryPose=null;this.recoveryTime=1;
    this.settleTime=1;this.settleFrom=null;this.walkWeight=0;this.lastReport=null;
    this.footDefs=Object.fromEntries(this.tools.feet.map(f=>[f.side,f]));
    this.rootIndex=this.rig.index.get('root');this.headIndex=this.rig.index.get('head');
    const rHip=this.rig.restP[this.rig.limbs.legR.a],lHip=this.rig.restP[this.rig.limbs.legL.a];
    this.hipCenter=scale(add(rHip,lHip),.5);
    this.bagRest=[rHip[0]-this.height*.073,rHip[1]-this.height*.035,rHip[2]-this.height*.014];
    this._selectSurfaceSupports();
    this.pickup=new NativeCapturedPickup(this);
    this.contract={version:'native-life-motion/2',motionLibrary:this.library.report,nativeBones:104,side:'R',units:'metres',
      palmToleranceM:.012,footToleranceM:.015,boneLengthToleranceM:.00001,
      seatApproachOffsetM:.65,assistedGrip:true,skinCollisionGuarantee:false,
      sourceContactProgress:[.30,.55],transferProgress:[.55,1],
      seatSupport:'sampled posterior native skin; foot surface IK',
      completion:'end pose only; caller must also verify actual object transport'};
    this.reset();
  }

  /** Simulation reset releases all prior world and velocity history. Prepared
   * source clips and the original full native actor remain reusable. */
  reset() {
    this.pickup?.reset();
    this.captureFeet={};this.captureAwaitSwing={L:true,R:true};this.freeSettle=1;this.freeSettleFrom=null;
    this.groundPelvisDrop=0;this.phase=.30;this.lastInput=null;this.lastMode=null;this.lastProgress=0;
    this.lastFeet=null;this.stepState={};this.seatStartFeet=null;this.seatFactor=0;this.standStart=1;
    this.lastActionPose=null;this.recoveryPose=null;this.recoveryTime=1;this.settleTime=1;this.settleFrom=null;this.walkWeight=0;this.lastReport=null;
    this.library.mode=null;this.library.elapsed=0;this.library.previous=null;this.library.past=null;this.library.previousDt=1/60;
    this.library.lastContacts={L:1,R:1};this.library.continuity.transition=null;this.library.continuity.phase=0;
    this.library.arms.previous={};this.library.basic.arms.previous={};
    this.tools.clear({side:this.side,grip:0,handActive:false});
    const nativeIdle=this.library.basicPose(0).pose;
    for(const name of this.rig.names)this.rig.setRotation(name,...nativeIdle[name].rotation);
    this.rig.rootTranslation.splice(0,3,...nativeIdle.root.translation);this.rig.fk();
    return this;
  }

  /** Real per-body, per-shoe planning calibration, not an acquisition receipt. */
  assessPickupStance() {return this.pickup.assess();}

  /** Capability is measured on this person's actual native arm, body, shoes,
   * palm patch and the scene's actual moving handle path. It is not a stature
   * threshold or a promise that a generic preset can reach every fixture. */
  assessCapabilities({spots,getInteractionTarget}) {
    if(!spots||typeof getInteractionTarget!=='function')throw Error('Capability assessment requires actual scene fixtures');
    const rig=this.rig,root=this.actor.root;
    const saved={skin:rig.skinMatrices.map(m=>m.slice()),posed:rig.posedMatrices.map(m=>m.slice()),deltas:rig.rotationDeltas.map(v=>v.slice()),translation:rig.rootTranslation.slice(),position:root.position.toArray(),rotation:[root.rotation.x,root.rotation.y,root.rotation.z]};
    const originalCommit=this.tools.commit,results={};this.tools.commit=()=>{};
    try {
      for(const [mode,id] of [['window','windowA'],['water','planterA']]){
        this.reset();const spot=spots[id],samples=[];
        if(!spot)throw Error('Missing capability fixture '+id);
        for(const targetOpen of mode==='window'?[true,false]:[true])for(let i=0;i<=12;i++){
          const u=i/12,target=array(getInteractionTarget(id,u,targetOpen)),r=this.update({mode,progress:.3+.7*u,dt:1/60,x:spot.stand[0],z:spot.stand[2],yaw:spot.yaw,target});
          samples.push({progress:u,targetOpen,target,palm:r.palm,errorM:r.contactErrorM,footErrorM:r.footErrorM,boneLengthErrorM:r.boneLengthErrorM,poseValid:r.poseValid,contactReady:r.contactReady,reachClamped:r.reachClamped,adaptation:r.contactAdaptation});
        }
        results[mode]={fixture:id,capable:samples.every(s=>s.poseValid&&s.contactReady),maximumPalmErrorM:Math.max(...samples.map(s=>s.errorM)),maximumFootErrorM:Math.max(...samples.map(s=>s.footErrorM)),samples};
      }
    } finally {
      this.reset();this.tools.commit=originalCommit;
      for(let j=0;j<rig.count;j++){rig.skinMatrices[j].set(saved.skin[j]);rig.posedMatrices[j].set(saved.posed[j]);rig.rotationDeltas[j].splice(0,3,...saved.deltas[j]);}
      rig.rootTranslation.splice(0,3,...saved.translation);root.position.set(...saved.position);root.rotation.set(...saved.rotation);root.updateMatrixWorld(true);
      this.tools.commit({side:this.side,grip:0});
    }
    this.actor.motionCapabilities={...(this.actor.motionCapabilities||{}),window:!!results.window.capable,water:!!results.water.capable};
    this.actor.motionCapabilityReport={schema:'native-actual-fixture-reach/1',actor:this.actor.id,nativeBones:104,shoeSource:this.actor.footwear?.source||null,criteria:{palmToleranceM:.012,footToleranceM:.015,boneLengthToleranceM:.00001},results};
    return this.actor.motionCapabilities;
  }

  /** One-time selection on the person's actual generated surface. */
  _selectSurfaceSupports() {
    const hip=this.hipCenter,H=this.height,half=Math.abs(this.rig.restP[this.rig.limbs.legL.a][0]-this.rig.restP[this.rig.limbs.legR.a][0])*.5;
    const head=this.rig.restP[this.headIndex],mouthGuess=add(head,[0,-H*.047,-H*.019]);
    const best={L:{score:Infinity,id:-1},R:{score:Infinity,id:-1}};
    let mouth={score:Infinity,id:-1};
    for(let id=0;id<this.actor.binding.N;id++) {
      const p=this.tools.restVertex(id);
      if(Math.abs(p[0]-head[0])<H*.025&&Math.abs(p[2]-mouthGuess[2])<H*.025&&p[1]<head[1]) {
        const score=(p[0]-mouthGuess[0])**2*3+(p[1]-mouthGuess[1])**2+(p[2]-mouthGuess[2])**2*2;
        if(score<mouth.score)mouth={score,id};
      }
      if(p[1]<hip[1]+H*.018||p[2]>hip[2]+H*.01||p[2]<hip[2]-H*.11)continue;
      const side=p[0]>=0?'L':'R',sign=side==='L'?1:-1;
      const goal=[sign*half*.68,hip[1]+H*.063,hip[2]-H*.048];
      const score=(p[0]-goal[0])**2+(p[1]-goal[1])**2+(p[2]-goal[2])**2*1.7;
      if(score<best[side].score)best[side]={score,id};
    }
    if(best.L.id<0||best.R.id<0)throw Error('Native posterior seat supports could not be derived');
    this.seatSupportIds=SIDES.map(s=>best[s].id);
    this.seatRest=scale(this.seatSupportIds.map(id=>this.tools.restVertex(id)).reduce(add,[0,0,0]),.5);
    this.seatRestWorldY=this.floorOffset+this.seatRest[2];
    this.mouthVertex=mouth.id;this.mouthRest=mouth.id>=0?this.tools.restVertex(mouth.id):mouthGuess;
  }

  _world(local) {return this.tools.toWorld(local).toArray();}
  _native(world) {return this.tools.toLocal(world);}
  _mouthSurface() {return this._world(this.tools.sampleMouth?this.tools.sampleMouth():this.mouthVertex>=0?this.tools.sampleVertex(this.mouthVertex):transform(this.rig.skinMatrices[this.headIndex],this.mouthRest));}
  bagAnchor() {return this._world(transform(this.rig.skinMatrices[this.rootIndex],this.bagRest));}
  _direction(native,yaw) {
    const c=Math.cos(yaw),s=Math.sin(yaw);
    return [c*native[0]-s*native[1],native[2],-s*native[0]-c*native[1]];
  }
  _restFoot(side,x,z,yaw,forwardOffset=0,lift=0) {
    const p=this.footDefs[side].rest,c=Math.cos(yaw),s=Math.sin(yaw),front=-p[1]+forwardOffset;
    return [x+c*p[0]+s*front,this.soleLift+lift,z-s*p[0]+c*front];
  }

  /** Full captured gait/idle poses, not a sinusoidal leg substitute. Navigation
   * supplies travel while source contact phases keep support feet in world
   * space. The actual retained skin is sampled again after contact correction.
   */
  _sourceLocomotion({dt,time,x,z,yaw,mode,distance,changed}) {
    const rig=this.rig,H=this.height;
    if(changed){this.captureFeet={};this.captureAwaitSwing={L:true,R:true};this.freeSettle=0;this.freeSettleFrom=this.lastFeet?Object.fromEntries(SIDES.map(s=>[s,{position:this.lastFeet[s].position.slice(),sole:this.lastFeet[s].soleMinimumWorldYM,planted:this.lastFeet[s].planted}])):null;}
    this.freeSettle+=dt;
    this.actor.root.position.set(x,this.floorOffset,z);this.actor.root.rotation.set(0,yaw,0);this.actor.root.updateMatrixWorld(true);
    const source=this.library.sample(mode,{dt,distance});
    for(let j=0;j<rig.count;j++){
      rig.skinMatrices[j].set(source.skin[j]);const e=source.world[j].elements,m=rig.posedMatrices[j];
      for(let a=0;a<4;a++)for(let b=0;b<4;b++)m[a*4+b]=e[b*4+a];
    }
    const rootPosition=pos(rig.posedMatrices[this.rootIndex]);rig.rootTranslation.splice(0,3,...sub(rootPosition,rig.restP[this.rootIndex]));
    const goals={},feet={};
    for(const [i,side]of SIDES.entries()) {
      const foot=this.footDefs[side],raw=this._world(this.tools.sampleVertex(foot.id));
      const sourceRotation=rotation(rig.skinMatrices[rig.limbs['leg'+side].c]);
      let world=raw.slice(),plantYaw=yaw,planted=source.contacts[side]>.65,soleHeight=Math.max(0,this._soleMinimum(side));
      if(mode==='walk') {
        // The R05 transition starts in the preceding idle pose. Its initial
        // double support is not a new captured step, so wait for each foot's
        // first actual swing before fixing a new world-space stance anchor.
        if(source.contacts[side]<.25)this.captureAwaitSwing[side]=false;
        let anchor=this.captureFeet[side];
        if(planted&&!anchor&&!this.captureAwaitSwing[side])anchor=this.captureFeet[side]={world:raw.slice(),yaw};
        if(anchor&&source.contacts[side]<.25){delete this.captureFeet[side];anchor=null;}
        if(anchor&&planted){world[0]=anchor.world[0];world[2]=anchor.world[2];plantYaw=anchor.yaw;}
      } else if(this.freeSettleFrom&&this.freeSettle<.42) {
        const q=clamp((this.freeSettle-i*.18)/.20,0,1),from=this.freeSettleFrom[side],lift=Math.sin(Math.PI*q)*H*.028;
        world=lerp(from.position,raw,smooth(q));world[1]+=lift;planted=q===0?from.planted:q===1;
        soleHeight=mix(Math.max(0,from.sole||0),soleHeight,smooth(q))+lift;
      }
      // Retain the source's heel/toe roll. A support foot keeps its world
      // heading as the navigator turns; the next swing adopts the new heading.
      const R=mm3(axisRotation([0,0,1],angleDelta(yaw,plantYaw)),sourceRotation);
      goals[side]={world,yaw:plantYaw,planted,rotation:R,soleHeight};
    }
    // A support footprint constrains the pelvis as well as the ankle. The
    // R05 transition can otherwise ask a nearly straight native leg to reach
    // below the floor. Preserve every bone length and lower the entire rigid
    // skeleton only enough for the measured support geometry to be reachable.
    let requiredDrop=0;
    for(const side of SIDES){
      const goal=goals[side];if(!goal.planted)continue;
      const l=rig.limbs['leg'+side],hip=pos(rig.posedMatrices[l.a]),knee=pos(rig.posedMatrices[l.b]),ankle=pos(rig.posedMatrices[l.c]);
      const local=this._native(goal.world),offset=mv(goal.rotation,sub(this.footDefs[side].rest,rig.restP[l.c]));
      const desired=sub(local,offset),soleToAnkle=this._soleMinimum(side)-this.floorOffset-ankle[2];
      desired[2]=-this.floorOffset-soleToAnkle;
      const length=(norm(sub(hip,knee))+norm(sub(knee,ankle)))*.998;
      const horizontal=(desired[0]-hip[0])**2+(desired[1]-hip[1])**2;
      if(horizontal<length*length)requiredDrop=Math.max(requiredDrop,hip[2]-desired[2]-Math.sqrt(length*length-horizontal));
    }
    this.groundPelvisDrop=Math.max(clamp(requiredDrop,0,H*.12),this.groundPelvisDrop*Math.exp(-dt/.12));
    if(this.groundPelvisDrop>1e-7){for(let j=0;j<rig.count;j++){rig.posedMatrices[j][11]-=this.groundPelvisDrop;rig.skinMatrices[j][11]-=this.groundPelvisDrop;}rig.rootTranslation[2]-=this.groundPelvisDrop;}
    for(const side of SIDES)feet[side]=this._solveFoot(side,goals[side],yaw);
    const checked=rig.validate(),footErrorM=Math.max(...SIDES.map(s=>feet[s].surfaceErrorM));
    const palm=this._world(this.tools.samplePalm(this.side));
    const palmNormal=this._direction(unit(mv(rotation(rig.skinMatrices[rig.limbs['arm'+this.side].c]),rig.hand[this.side].palm)),yaw);
    const handForward=this._direction(unit(mv(rotation(rig.skinMatrices[rig.limbs['arm'+this.side].c]),rig.hand[this.side].forward)),yaw),handCylinderAxis=scale(unit(cross(handForward,palmNormal)),this.side==='L'?-1:1);
    const bagTarget=this.bagAnchor(),mouthSurface=this._mouthSurface();
    const poseValid=checked.finite&&checked.maxBoneLengthError<=.00001&&footErrorM<=.015;
    this.tools.commit({side:this.side,grip:0});this.library.finalPose();
    const report={mode,progress:0,stage:mode,side:this.side,palm,palmNormal,handForward,handCylinderAxis,
      gripCenter:add(palm,scale(palmNormal,this.actor.graspReport?.shape?.radius||.032)),
      bagTarget,mouth:mouthSurface,mouthSurface,sourceTarget:null,completionTarget:null,
      contactErrorM:0,activeGoalErrorM:0,completionErrorM:null,contactPhase:false,contactReady:false,
      endPoseReady:poseValid,completed:poseValid,sourceContactOnly:false,objectTransportVerified:false,
      feet,footErrorM,seatSupport:null,seatErrorM:null,seatSupportVertexIds:this.seatSupportIds,
      boneLengthErrorM:checked.maxBoneLengthError,orthogonalityError:checked.maxOrthogonalityError,
      finite:checked.finite&&finite3(palm),poseValid,reachClamped:SIDES.some(s=>feet[s].reachClamped),grip01:0,
      graspAdmissible:!!this.actor.graspReport?.sides?.[this.side]?.admissible,
      rootWorld:[x,this.floorOffset,z],pelvisWorld:this._world(pos(rig.posedMatrices[this.rootIndex])),seatFactor:0,
      phase:this.library.elapsed,distanceStepM:distance,assistedGrip:true,recoveryProgress:1,
      soleLiftM:this.soleLift,groundPelvisDropM:this.groundPelvisDrop,motionSource:source.report,
      limitations:['existing native captured motion retargeted to this complete generated body','flat-floor world contact adaptation; no full-body torque or continuous skin collision guarantee']};
    this.lastInput={x,z,yaw};this.lastMode=mode;this.lastProgress=0;this.seatFactor=0;this.lastFeet=feet;this.lastReport=report;
    return report;
  }

  _footTargets({mode,x,z,yaw,dt,distance,seatT,seatApproachOffset}) {
    const targets={},H=this.height;
    if(['sit','sitting','stand'].includes(mode)) {
      // Two short, explicitly lifted steps close the .65 m navigation gap.
      // Feet then stay planted while the pelvis lowers onto the actual seat.
      const close=Math.min(.30,seatApproachOffset),span=seatApproachOffset-close;
      for(const [i,side]of SIDES.entries()) {
        const t=clamp((seatT-i*.14)/.14,0,1),offset=seatApproachOffset-span*smooth(t);
        const start=this.seatStartFeet?.[side]||this._restFoot(side,x,z,yaw,seatApproachOffset);
        const end=this._restFoot(side,x,z,yaw,close),world=lerp(start,end,smooth(t));
        // Start at the actual last world foot pose. Neither entering a seat
        // nor reversing a half-sit teleports the feet to a nominal footprint.
        world[1]=this.soleLift+Math.sin(Math.PI*t)*H*.018;
        targets[side]={world,yaw,planted:t===0||t===1};
      }
      this.stepState={};
      return targets;
    }
    this.stepState={};
    for(const side of SIDES) {
      let world=this._restFoot(side,x,z,yaw);
      if(this.settleFrom&&this.settleTime<.24) {
        const q=clamp(this.settleTime/.24,0,1),from=this.settleFrom[side];
        world=lerp(from,world,smooth(q));world[1]=Math.max(0,world[1])+Math.sin(Math.PI*q)*H*.019;
      }
      // Pickup retains the original R04 BasicActions anatomical knee plane.
      // A small fixed lateral pole projects inward when the hips are low and
      // the feet are outside them; on the short body it crossed both knees.
      const kneePoleOffset=mode==='pickup'?[(side==='L'?1:-1)*H*.08,-H*.45,-H*.12]:null;
      targets[side]={world,yaw,planted:this.settleTime>=.24,kneePoleOffset};
    }
    return targets;
  }

  _soleMinimum(side) {
    const limb=this.rig.limbs['leg'+side],points=this.actor.footwear?.perSide?.[side]?.solePointsNative;
    if(points?.length){const m=this.rig.skinMatrices[limb.c];let low=Infinity;
      if(ArrayBuffer.isView(points)||typeof points[0]==='number')for(let k=0;k<points.length;k+=3)low=Math.min(low,m[8]*points[k]+m[9]*points[k+1]+m[10]*points[k+2]+m[11]);
      else for(const v of points)low=Math.min(low,m[8]*v[0]+m[9]*v[1]+m[10]*v[2]+m[11]);
      return this.floorOffset+low;
    }
    const ids=this.tools.soleSurfaceIds?.[side]||[this.footDefs[side].id];let low=Infinity;
    for(const id of ids)low=Math.min(low,this.floorOffset+this.tools.sampleVertex(id)[2]);
    return low-this.soleLift;
  }

  _solveFoot(side,goal,yaw) {
    const rig=this.rig,limb=rig.limbs['leg'+side],foot=this.footDefs[side];
    const local=this._native(goal.world),rotation=goal.rotation||axisRotation([0,0,1],angleDelta(yaw,goal.yaw));
    const poleOffset=goal.kneePoleOffset||[side==='L'?.015:-.015,-this.height*.42,-this.height*.045];
    const offset=sub(foot.rest,rig.restP[limb.c]);
    let ankle=sub(local,mv(rotation,offset)),solved;
    for(let i=0;i<4;i++) {
      const hip=pos(rig.posedMatrices[limb.a]);
      const pole=add(hip,poleOffset);
      solved=rig.solveLimb(limb,ankle,pole,.9999);rig.orientSkin(limb.c,rotation);
      const error=sub(local,this.tools.sampleVertex(foot.id));
      if(norm(error)<.00020)break;
      ankle=add(ankle,error);
    }
    // A single heel vertex cannot certify a whole planted shoe. Inspect the
    // real shoe sole vertices when available, otherwise every calibrated
    // native foot/toe surface vertex. Shoe geometry is not a visual proxy.
    const ground=goal.planted?0:Math.max(0,goal.soleHeight??goal.world[1]-this.soleLift);
    let low=this._soleMinimum(side),correction=0;
    for(let k=0;k<3;k++){
      const error=ground-low;if(Math.abs(error)<.00035)break;
      // Preserve the source heel/toe angle and solve the same fixed bone
      // lengths at the measured sole height. No body mesh warp is applied.
      ankle[2]+=error;correction+=error;
      const hip=pos(rig.posedMatrices[limb.a]),pole=add(hip,poleOffset);
      solved=rig.solveLimb(limb,ankle,pole,.9999);rig.orientSkin(limb.c,rotation);low=this._soleMinimum(side);
    }
    const position=this._world(this.tools.sampleVertex(foot.id)),target=goal.world.slice();target[1]+=correction;
    return {position,target,yaw:goal.yaw,planted:goal.planted,
      surfaceErrorM:Math.max(norm(sub(position,target)),Math.abs(low-ground)),heightM:position[1],reachClamped:!!solved?.clamped,
      anchorVertex:foot.id,soleMinimumWorldYM:low,soleTargetWorldYM:ground,
      soleMeasurement:this.actor.footwear?.perSide?.[side]?.solePointsNative?'original shoe sole geometry':'all weighted native foot/toe surface vertices'};
  }

  _restArms({walk,yaw,time=0,crouch=0}) {
    const source=this.library.basicPose(crouch).rig;
    for(const side of SIDES) {
      const limb=this.rig.limbs['arm'+side],sign=side==='L'?1:-1;
      const shoulder=pos(this.rig.posedMatrices[limb.a]),parent=this.rig.parents[limb.a];
      const delta=mm3(rotation(this.rig.skinMatrices[parent]),tr(rotation(source.skinMatrices[parent])));
      const A=pos(source.posedMatrices[limb.a]),B=pos(source.posedMatrices[limb.b]),C=pos(source.posedMatrices[limb.c]);
      const target=add(shoulder,mv(delta,sub(C,A))),pole=add(shoulder,mv(delta,scale(sub(B,A),2)));
      this.rig.solveLimb(limb,target,pole,.995);
    }
    this._calibrateArms(false);
  }

  _calibrateArms(gesture){
    const frame=this.library.arms.apply({posedMatrices:this.rig.posedMatrices,skinMatrices:this.rig.skinMatrices},{gesture});
    for(const side of SIDES)for(const j of this.rig.descendants[this.rig.limbs['arm'+side].a]){
      this.rig.posedMatrices[j].set(frame.posedMatrices[j]);this.rig.skinMatrices[j].set(frame.skinMatrices[j]);
    }
  }

  _contactHandRotation(side='R',turn=0,orientationWeight=1,objectContact=false) {
    const rig=this.rig,sign=side==='L'?1:-1;
    const turnRotation=axisRotation([0,0,1],turn);
    const handForward=unit(lerp([0,0,-1],mv(turnRotation,objectContact?[sign,0,0]:[sign*.35,0,-1]),orientationWeight));
    const handPalm=unit(lerp([-sign,0,0],mv(turnRotation,[0,-1,0]),orientationWeight));
    return basisRotation(rig.hand[side].forward,rig.hand[side].palm,handForward,handPalm);
  }

  _fitContactTrunk(world,{weight=1,maxExtraDegrees=30}={}) {
    const rig=this.rig,limb=rig.limbs.armR,j=rig.index.get('spine05'),base=rig.rotationDeltas[j].slice();
    const hand=this._contactHandRotation('R'),wrist=sub(this._native(world),mv(hand,sub(this.tools.palmRest('R'),rig.restP[limb.c])));
    const limit=(limb.upper+limb.lower)*.974;
    const distance=angle=>{rig.setRotation('spine05',base[0]+angle,base[1],base[2]);rig.fk();return norm(sub(wrist,pos(rig.posedMatrices[limb.a])));};
    let best=0,score=distance(0),previous=0;
    if(score>limit)for(let a=5;a<=maxExtraDegrees;a+=5){const d=distance(a);if(d<score){best=a;score=d;}if(d<=limit){let lo=previous,hi=a;for(let n=0;n<5;n++){const mid=(lo+hi)*.5;if(distance(mid)<=limit)hi=mid;else lo=mid;}best=hi;break;}previous=a;}
    const extra=best*clamp(weight,0,1);distance(extra);return {extraDegrees:extra,wristDistanceM:norm(sub(wrist,pos(rig.posedMatrices[limb.a]))),armLengthM:limb.upper+limb.lower,withinReach:score<=limit};
  }

  _reach(world,side='R',turn=0,orientationWeight=1,objectContact=false) {
    const rig=this.rig,limb=rig.limbs['arm'+side],sign=side==='L'?1:-1;
    const local=this._native(world),handRotation=this._contactHandRotation(side,turn,orientationWeight,objectContact);
    let wrist=sub(local,mv(handRotation,sub(this.tools.palmRest(side),rig.restP[limb.c]))),solved;
    const shoulder=pos(rig.posedMatrices[limb.a]),L=limb.upper+limb.lower;
    const pole=add(shoulder,[sign*L*.66,-L*.03,-L*.32]);
    for(let i=0;i<4;i++) {
      solved=rig.solveLimb(limb,wrist,pole,.997);this._calibrateArms(true);rig.orientSkin(limb.c,handRotation);
      const error=sub(local,this.tools.samplePalm(side));
      if(norm(error)<.00025)break;
      wrist=add(wrist,error);
    }
    return solved;
  }

  update({dt=0,time=0,x=0,z=0,yaw=0,mode='idle',progress=0,target=null,gripTarget=null,seatY=.46,grip=null,seatApproachOffset=.65,standStartFactor=null,mouthGripDepthM=.09,mouthClearanceM=.012,graspProfile=null,buyClearance=null,pickupAttached=false}={}) {
    if(![dt,time,x,z,yaw,progress,seatY,seatApproachOffset,mouthGripDepthM,mouthClearanceM].every(Number.isFinite))throw Error('NativeMotion received non-finite frame parameters');
    if(!['idle','walk','sit','sitting','stand','pickup','trade','eat','window','water'].includes(mode))throw Error('Unknown native motion mode '+mode);
    if(standStartFactor!==null&&!Number.isFinite(standStartFactor))throw Error('Invalid native stand-start factor');
    dt=clamp(dt,0,.20);const p=clamp(progress,0,1),H=this.height,rig=this.rig;
    const worldTarget=target===null?null:array(target),sourceGrip=gripTarget===null?null:array(gripTarget);
    if(graspProfile!==null)this.tools.selectGrasp?.(graspProfile);
    if((worldTarget&&!finite3(worldTarget))||(sourceGrip&&!finite3(sourceGrip)))throw Error('NativeMotion requires finite world contact points');
    const changed=mode!==this.lastMode;
    this.soleLift=Math.max(0,Number(this.actor.footwear?.soleLiftM)||0);this.floorOffset=this.baseFloorOffset+this.soleLift;
    this.seatRestWorldY=this.floorOffset+this.seatRest[2];
    let distance=mode==='walk'&&this.lastInput?Math.hypot(x-this.lastInput.x,z-this.lastInput.z):0;
    const freeRelocation=changed&&['idle','walk'].includes(mode)&&this.lastInput&&Math.hypot(x-this.lastInput.x,z-this.lastInput.z)>H*.08;
    const rootStep=this.lastInput?Math.hypot(x-this.lastInput.x,z-this.lastInput.z):0;
    const normalPickupArrival=changed&&mode==='pickup'&&rootStep<=H*.08;
    const teleported=rootStep>H*.45||freeRelocation||!normalPickupArrival&&this.lastInput&&Math.abs(angleDelta(this.lastInput.yaw,yaw))>1.2;
    if(teleported){distance=0;this.stepState={};this.captureFeet={};this.lastFeet=null;this.library.invalidate();}
    if(mode==='walk'||mode==='idle')return this._sourceLocomotion({dt,time,x,z,yaw,mode,distance,changed});
    this.library.invalidate();this.captureFeet={};
    if(mode==='pickup'){
      if(!worldTarget)throw Error('Captured pickup requires the actual bottle palm-surface target');
      return this.pickup.update({dt,time,x,z,yaw,progress:p,target:worldTarget,grip,pickupAttached});
    }
    if(changed) {
      this.settleTime=0;this.settleFrom=this.lastFeet?Object.fromEntries(SIDES.map(s=>[s,this.lastFeet[s].position.slice()])):null;
      if(mode==='sit'&&this.lastMode!=='stand')this.seatStartFeet=this.lastFeet?Object.fromEntries(SIDES.map(s=>[s,this.lastFeet[s].position.slice()])):null;
      if(mode!=='walk')this.stepState={};
      else {this.phase=.30;this.stepState={};}
      if(['pickup','trade','eat'].includes(this.lastMode)&&!['pickup','trade','eat'].includes(mode)&&this.lastActionPose) {
        this.recoveryPose=this.lastActionPose;this.recoveryTime=0;
      }
    }
    this.settleTime+=dt;
    this.walkWeight=mix(this.walkWeight,mode==='walk'&&distance>1e-6?1:0,Math.min(1,dt*9));
    // An interrupt can reverse a half-finished sit. A repeated interrupt may
    // also restart stand progress at zero. Preserve the last real seat factor
    // in either case instead of snapping the body to the fully seated pose.
    if(mode==='stand'&&Number.isFinite(standStartFactor))this.standStart=clamp(standStartFactor,0,1);
    else if(mode==='stand'&&(changed||p<this.lastProgress-.0001))
      this.standStart=['sit','sitting','stand'].includes(this.lastMode)?this.seatFactor:1;
    const seated=['sit','sitting','stand'].includes(mode),seatT=mode==='sitting'?1:mode==='stand'?this.standStart*(1-p):p;
    const qSeat=seated?smooth((seatT-.28)/.72):0;
    let rootX=x,rootZ=z;
    if(seated) {
      const offset=seatRootOffset(seatT,seatApproachOffset);
      rootX+=Math.sin(yaw)*offset;rootZ+=Math.cos(yaw)*offset;
    }
    if(this.lastReport&&changed&&Math.hypot(rootX-this.lastReport.rootWorld[0],rootZ-this.lastReport.rootWorld[2])>H*.08) {
      // Explicit simulation reset/fixture jump is allowed to relocate a body.
      // Do not drag a previous scene's planted feet behind the new location.
      this.lastFeet=null;this.settleFrom=null;this.seatStartFeet=null;this.stepState={};
    }
    this.actor.root.position.set(rootX,this.floorOffset,rootZ);this.actor.root.rotation.set(0,yaw,0);
    this.actor.root.updateMatrixWorld(true);
    const environmentAction=mode==='window'||mode==='water';
    const action=['pickup','trade','eat'].includes(mode),contactPhase=environmentAction?p>=.30:action&&p>=.30&&p<=.55;
    const closure=Number.isFinite(grip)?clamp(grip,0,1):action?smooth((p-.30)/.18):0;
    this.tools.clear({side:this.side,grip:closure,handActive:action});
    const crouchProgress=mode==='pickup'?(p<=.75?clamp(p/.20,0,1):1-clamp((p-.75)/.25,0,1)):0;
    const basic=this.library.basicPose(crouchProgress);
    for(const name of rig.names)rig.setRotation(name,...basic.pose[name].rotation);
    if(action)this.tools.applyGrip(this.side,closure);
    let lean=0,rootDrop=0,rootFore=0,crouchWeight=0;
    const sourceEnvelope=p<=.55?smooth(p/.30):1-smooth((p-.55)/.40);
    if(mode==='walk'||this.walkWeight>.001) {
      rootDrop=H*this.walkWeight*(.037+.004*Math.cos(this.phase*Math.PI*4));
      lean=3*this.walkWeight;
      rig.rootTranslation[0]=Math.sin(this.phase*Math.PI*2)*H*.006*this.walkWeight;
    }
    if(seated) {
      rootDrop=(this.seatRestWorldY-seatY)*qSeat;
      lean=Math.sin(Math.PI*qSeat)*22+qSeat*3;
      rootDrop+=Math.sin(Math.PI*clamp(seatT/.28,0,1))*H*.034;
    }
    if(mode==='pickup') {
      const shoulder=rig.restP[rig.limbs.armR.a],arm=rig.limbs.armR.upper+rig.limbs.armR.lower;
      const goalY=worldTarget?.[1]??.10,trunk=shoulder[2]-this.hipCenter[2];
      const required=this.floorOffset+shoulder[2]-goalY-arm*.78-trunk*(1-Math.cos(34*DEG));
      // Preserve the source R04 squat depth (.008 + .325 of stature).
      // Lowering the pelvis further to satisfy a low hand target folded the
      // thighs into one another. The existing bounded trunk reach supplies
      // the remaining distance without changing fixed native leg lengths.
      const maximumDrop=Math.min(H*(.008+.325),this.floorOffset+this.hipCenter[2]-Math.max(.18,H*.105));
      const down=clamp(required,H*.28,maximumDrop);
      const crouch=this.library.crouchEnvelope(crouchProgress,'down');
      crouchWeight=crouch;rootDrop=down*crouch;rootFore=-H*.013*crouch;lean=34*crouch;
    }
    if(mode==='trade') {
      const counterReach=sourceGrip?smooth((p-.55)/.40):sourceEnvelope;
      const counterY=worldTarget?.[1]??.95;
      rootDrop=(H*.032+Math.max(0,.95-counterY)*1.1)*counterReach;
      rootFore=H*.047*counterReach;lean=31*counterReach;
    }
    if(mode==='eat')lean=2*smooth((p-.55)/.30);
    if(environmentAction){lean=8*smooth(p/.30);rootDrop=H*.012*smooth(p/.30);}
    rig.rootTranslation[1]=-rootFore;rig.rootTranslation[2]=-rootDrop;
    // Forward reach is primarily a hip/lower-spine hinge. Spreading the same
    // angle across five high joints barely moves the shoulder and made real
    // native arms miss the low bottle despite a visually bent head.
    const hinge=action?.88:.62;
    if(mode!=='pickup'){rig.setRotation('spine05',lean*hinge,0,0);rig.setRotation('spine03',lean*(1-hinge)*.5,0,0);rig.setRotation('spine01',lean*(1-hinge)*.5,0,0);}
    if(!action&&!seated)rig.setRotation('neck01',Math.sin(time*.8)*.7,0,Math.sin(time*.37)*2.5);
    if(mode==='eat')rig.setRotation('neck01',6*smooth((p-.55)/.30),0,0);
    rig.fk();
    let contactAdaptation=null;
    if(mode==='pickup'&&worldTarget){
      const currentBag=this.bagAnchor(),t=p<=.55?0:smooth((p-.55)/.20),contactGoal=lerp(worldTarget,currentBag,t);
      contactAdaptation=this._fitContactTrunk(contactGoal,{weight:smooth(p/.20),maxExtraDegrees:35});
    } else if(environmentAction&&worldTarget)contactAdaptation=this._fitContactTrunk(worldTarget,{weight:smooth(p/.30),maxExtraDegrees:40});
    const footGoals=this._footTargets({mode,x,z,yaw,dt,distance,seatT,seatApproachOffset});
    let feet={};
    for(const side of SIDES)feet[side]=this._solveFoot(side,footGoals[side],yaw);
    let seatSupport=null,seatErrorM=null;
    if(seated) {
      const goalY=mix(this.seatRestWorldY,seatY,qSeat)-Math.sin(Math.PI*clamp(seatT/.28,0,1))*H*.034;
      // Rotating real upper legs also moves blended posterior skin. Correct
      // the pelvis using that skin support and re-solve both planted legs.
      for(let k=0;k<4;k++) {
        const local=scale(this.seatSupportIds.map(id=>this.tools.sampleVertex(id)).reduce(add,[0,0,0]),.5);
        seatSupport=this._world(local);const error=goalY-seatSupport[1];
        if(Math.abs(error)<.0004)break;
        rig.rootTranslation[2]+=clamp(error,-H*.06,H*.06);
        rig.fk();for(const side of SIDES)feet[side]=this._solveFoot(side,footGoals[side],yaw);
      }
      seatSupport=this._world(scale(this.seatSupportIds.map(id=>this.tools.sampleVertex(id)).reduce(add,[0,0,0]),.5));
      seatErrorM=Math.abs(seatSupport[1]-seatY);
    }
    this._restArms({walk:this.walkWeight,yaw,time,crouch:crouchWeight});
    if(this.recoveryPose&&!action&&!seated&&this.recoveryTime<RECOVERY_SECONDS) {
      this.recoveryTime=Math.min(RECOVERY_SECONDS,this.recoveryTime+dt);
      const t=smooth(this.recoveryTime/RECOVERY_SECONDS),targetPose=rig.exportNativePose();
      for(const name of rig.names) {
        const mixed=blendRotationVector(this.recoveryPose[name].rotation,targetPose[name].rotation,t);
        rig.setRotation(name,...mixed);
      }
      rig.rootTranslation.splice(0,3,...lerp(this.recoveryPose.root.translation,targetPose.root.translation,t));
      rig.fk();
      // Re-apply foot constraints after the rigid local-rotation SLERP. This
      // restores a hand/torso smoothly without stretching bones or sliding
      // planted feet as a side effect of interpolated skin matrices.
      for(const side of SIDES)feet[side]=this._solveFoot(side,footGoals[side],yaw);
    }
    const bagTarget=this._world(transform(rig.skinMatrices[this.rootIndex],this.bagRest));
    const mouthSurface=this._mouthSurface();
    const forward=[Math.sin(yaw),0,Math.cos(yaw)];
    // For eating, turn the palm toward the face. The food fits between palm
    // and face; its far surface approaches the mouth while the hand stays
    // outside. ItemWorld supplies the real held-food depth and checks it.
    const handTurn=mode==='eat'?Math.PI*smooth((p-.55)/.37):0;
    const mouth=add(mouthSurface,scale(forward,Math.max(0,mouthGripDepthM)+Math.max(0,mouthClearanceM)));
    let sourceTarget=null,completionTarget=null,goal=null,solution=null,stage=mode;
    if(environmentAction){
      if(!worldTarget)throw Error('Native '+mode+' requires the real moving fixture handle');
      sourceTarget=worldTarget;completionTarget=worldTarget;
      const relaxed=this._world(this.tools.samplePalm(this.side));
      goal=lerp(relaxed,worldTarget,smooth(p/.30));stage=p<.30?'approach-handle':p<.96?'follow-handle':'at-handle';
      solution=this._reach(goal,this.side,0,smooth(p/.30));
    }
    if(action) {
      const relaxed=this._world(this.tools.samplePalm(this.side));
      sourceTarget=sourceGrip||worldTarget||(mode==='eat'?bagTarget:null);
      if(!sourceTarget)throw Error('Native '+mode+' needs a real source palm contact target');
      completionTarget=mode==='eat'?mouth:mode==='trade'&&sourceGrip?(worldTarget||bagTarget):bagTarget;
      if(p<.30){const approach=mode==='pickup'?smooth((p-.20)/.10):smooth(p/.30);goal=lerp(relaxed,sourceTarget,approach);stage='approach-source';}
      else if(p<=.55){goal=sourceTarget.slice();stage='source-contact';}
      else if(mode==='pickup') {
        // Lift to the actual low waist while still crouched; then rise with
        // the hand at that waist. Standing first would leave a real short arm
        // unable to follow the low bottle during the middle of the transfer.
        const t=smooth((p-.55)/.20);goal=lerp(sourceTarget,bagTarget,t);
        if(p<.75)goal[1]+=Math.sin(Math.PI*t)*H*.045;
        stage=p<.75?'lift-to-bag':p<.96?'rise-with-item':'at-bag';
      }
      else if(mode==='trade'&&!sourceGrip&&graspProfile==='bread') {
        ({goal,stage}=breadTransportGoal(sourceTarget,bagTarget,p,buyClearance));
      } else {
        const t=smooth((p-.55)/.45);goal=lerp(sourceTarget,completionTarget,t);
        goal[1]+=Math.sin(Math.PI*t)*H*.065;
        stage=p<.96?'transport':mode==='eat'?'at-mouth':mode==='trade'&&sourceGrip?'at-counter':'at-bag';
      }
      solution=this._reach(goal,this.side,handTurn,smooth(p/.30),true);
    }
    const checked=rig.validate(),palm=this._world(this.tools.samplePalm(this.side));
    const palmNormal=this._direction(unit(mv(rotation(rig.skinMatrices[rig.limbs['arm'+this.side].c]),rig.hand[this.side].palm)),yaw);
    const handForward=this._direction(unit(mv(rotation(rig.skinMatrices[rig.limbs['arm'+this.side].c]),rig.hand[this.side].forward)),yaw),handCylinderAxis=scale(unit(cross(handForward,palmNormal)),this.side==='L'?-1:1);
    const footErrorM=Math.max(...SIDES.map(s=>feet[s].surfaceErrorM));
    const poseValid=checked.finite&&checked.maxBoneLengthError<=.00001&&footErrorM<=.015;
    const contactErrorM=sourceTarget?norm(sub(palm,sourceTarget)):0;
    const activeGoalErrorM=goal?norm(sub(palm,goal)):0;
    const completionErrorM=completionTarget?norm(sub(palm,completionTarget)):null;
    const contactReady=contactPhase&&poseValid&&contactErrorM<=.012;
    const endPoseReady=environmentAction?p>=.96&&poseValid&&contactErrorM<=.018:action?p>=.96&&poseValid&&completionErrorM<=.014:
      seated?poseValid&&(mode==='stand'?p>=.98:seatT>=.98&&seatErrorM<=.012):poseValid;
    // The only GPU submission in the execution path.
    this.tools.commit({side:this.side,grip:closure,target:goal,solution});
    const report={mode,progress:p,stage,side:this.side,palm,palmNormal,handForward,handCylinderAxis,
      gripCenter:add(palm,scale(palmNormal,this.actor.graspReport?.shape?.radius||.032)),
      bagTarget,mouth,mouthSurface,mouthSupport:this.tools.mouthSupport||null,mouthApproachClearanceM:mouthGripDepthM+mouthClearanceM,mouthGripDepthM,mouthClearanceM,graspProfile,
      sourceTarget,completionTarget,contactErrorM,activeGoalErrorM,completionErrorM,
      contactPhase,contactReady,endPoseReady,completed:endPoseReady,
      sourceContactOnly:contactReady,objectTransportVerified:false,
      feet,footErrorM,seatSupport,seatErrorM,seatSupportVertexIds:this.seatSupportIds,
      boneLengthErrorM:checked.maxBoneLengthError,orthogonalityError:checked.maxOrthogonalityError,
      finite:checked.finite&&finite3(palm)&&SIDES.every(s=>finite3(feet[s].position)),
      poseValid,reachClamped:!!solution?.clamped,grip01:closure,
      graspAdmissible:!!this.actor.graspReport?.sides?.[this.side]?.admissible,
      rootWorld:[rootX,this.floorOffset,rootZ],pelvisWorld:this._world(pos(rig.posedMatrices[this.rootIndex])),seatFactor:seated?seatT:0,
      soleLiftM:this.soleLift,motionSource:{base:'R04 BasicActions native posture and arm bend-plane calibration',contact:'world-space full-skin constraint adapter',squatTiming:'existing CMU22_14 measured height envelope'},
      contactAdaptation,
      phase:this.phase,distanceStepM:distance,assistedGrip:true,recoveryProgress:clamp(this.recoveryTime/RECOVERY_SECONDS,0,1),
      limitations:['rigid-bone IK and native linear skinning','sampled foot/palm/seat anchors, not continuous skin collision','object transport and force constraints verified separately']};
    this.lastInput={x:rootX,z:rootZ,yaw};this.lastMode=mode;this.lastProgress=p;this.seatFactor=seated?seatT:0;this.lastFeet=feet;this.lastReport=report;
    if(action||environmentAction)this.lastActionPose=rig.exportNativePose();
    this.library.finalPose();
    return report;
  }
}

export default NativeMotion;
