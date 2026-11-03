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

const {clamp,smooth,add,sub,scale,dot,norm,unit,lerp,pos,mv,rotation,axisRotation,basisRotation,DEG}=math;
const SIDES=['L','R'];
const RECOVERY_SECONDS=.40;
const mix=(a,b,t)=>a+(b-a)*t;
const mod=x=>((x%1)+1)%1;
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
    this.height=actor.binding.height;this.floorOffset=actor.binding.floorOffset;
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
    this.contract={version:'native-life-motion/1',nativeBones:104,side:'R',units:'metres',
      palmToleranceM:.012,footToleranceM:.015,boneLengthToleranceM:.00001,
      seatApproachOffsetM:.65,assistedGrip:true,skinCollisionGuarantee:false,
      sourceContactProgress:[.30,.55],transferProgress:[.55,1],
      seatSupport:'sampled posterior native skin; foot surface IK',
      completion:'end pose only; caller must also verify actual object transport'};
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
  bagAnchor() {return this._world(transform(this.rig.skinMatrices[this.rootIndex],this.bagRest));}
  _direction(native,yaw) {
    const c=Math.cos(yaw),s=Math.sin(yaw);
    return [c*native[0]-s*native[1],native[2],-s*native[0]-c*native[1]];
  }
  _restFoot(side,x,z,yaw,forwardOffset=0,lift=0) {
    const p=this.footDefs[side].rest,c=Math.cos(yaw),s=Math.sin(yaw),front=-p[1]+forwardOffset;
    return [x+c*p[0]+s*front,lift,z-s*p[0]+c*front];
  }

  _footTargets({mode,x,z,yaw,dt,distance,seatT,seatApproachOffset}) {
    const targets={},H=this.height;
    if(['sit','sitting','stand'].includes(mode)) {
      // Two short, explicitly lifted steps close the .65 m navigation gap.
      // Feet then stay planted while the pelvis lowers onto the actual seat.
      const close=Math.min(.30,seatApproachOffset),span=seatApproachOffset-close;
      for(const [i,side]of SIDES.entries()) {
        const t=clamp((seatT-i*.14)/.14,0,1),offset=seatApproachOffset-span*smooth(t);
        targets[side]={world:this._restFoot(side,x,z,yaw,offset,Math.sin(Math.PI*t)*H*.026),yaw,planted:t===0||t===1};
      }
      this.stepState={};
      return targets;
    }
    if(mode==='walk'&&distance>.000001) {
      const stride=H*.44,stance=.60;
      this.phase+=Math.min(distance,H*.3)/stride;
      for(const [i,side]of SIDES.entries()) {
        const p=mod(this.phase+i*.5),swing=p>=stance;
        let state=this.stepState[side];
        if(!state) {
          const foot=this.lastFeet?.[side]?.position||this._restFoot(side,x,z,yaw);
          state=this.stepState[side]={plant:foot.slice(),plantYaw:yaw,swing:false,start:foot.slice(),startT:0,last:foot.slice()};
        }
        if(swing) {
          const t=(p-stance)/(1-stance);
          if(!state.swing){state.start=state.last.slice();state.startT=t;state.swing=true;}
          const q=clamp((t-state.startT)/Math.max(.02,1-state.startT),0,1);
          // Predict the landing point from remaining *distance*, not elapsed
          // time. At constant heading the intended landing point stays fixed.
          const end=this._restFoot(side,x,z,yaw,(1-p)*stride+stride*.25);
          const world=lerp(state.start,end,smooth(q));world[1]=Math.sin(Math.PI*q)*H*.038;
          state.last=world;targets[side]={world,yaw,planted:false};
        } else {
          if(state.swing){state.plant=state.last.slice();state.plant[1]=0;state.plantYaw=yaw;state.swing=false;}
          state.last=state.plant.slice();targets[side]={world:state.plant.slice(),yaw:state.plantYaw,planted:true};
        }
      }
      return targets;
    }
    if(mode==='walk'&&this.lastFeet) {
      for(const side of SIDES)targets[side]={world:this.lastFeet[side].target.slice(),yaw:this.lastFeet[side].yaw,planted:this.lastFeet[side].planted};
      return targets;
    }
    this.stepState={};
    for(const side of SIDES) {
      let world=this._restFoot(side,x,z,yaw);
      if(this.settleFrom&&this.settleTime<.24) {
        const q=clamp(this.settleTime/.24,0,1),from=this.settleFrom[side];
        world=lerp(from,world,smooth(q));world[1]=Math.max(0,world[1])+Math.sin(Math.PI*q)*H*.019;
      }
      targets[side]={world,yaw,planted:this.settleTime>=.24};
    }
    return targets;
  }

  _solveFoot(side,goal,yaw) {
    const rig=this.rig,limb=rig.limbs['leg'+side],foot=this.footDefs[side];
    const local=this._native(goal.world),rotation=axisRotation([0,0,1],angleDelta(yaw,goal.yaw));
    const offset=sub(foot.rest,rig.restP[limb.c]);
    let ankle=sub(local,mv(rotation,offset)),solved;
    for(let i=0;i<4;i++) {
      const hip=pos(rig.posedMatrices[limb.a]);
      const pole=add(hip,[side==='L'?.015:-.015,-this.height*.42,-this.height*.045]);
      solved=rig.solveLimb(limb,ankle,pole,.9999);rig.orientSkin(limb.c,rotation);
      const error=sub(local,this.tools.sampleVertex(foot.id));
      if(norm(error)<.00020)break;
      ankle=add(ankle,error);
    }
    const position=this._world(this.tools.sampleVertex(foot.id));
    return {position,target:goal.world.slice(),yaw:goal.yaw,planted:goal.planted,
      surfaceErrorM:norm(sub(position,goal.world)),heightM:position[1],reachClamped:!!solved?.clamped,
      anchorVertex:foot.id};
  }

  _restArms({walk,yaw,time=0,crouch=0}) {
    for(const side of SIDES) {
      const limb=this.rig.limbs['arm'+side],sign=side==='L'?1:-1;
      const shoulder=pos(this.rig.posedMatrices[limb.a]),L=limb.upper+limb.lower;
      const swing=walk*Math.sin(this.phase*Math.PI*2+(side==='L'?0:Math.PI));
      const delta=lerp([sign*L*.17,-L*.055+swing*L*.24,-L*.93],[sign*L*.12,-L*.20,-L*.35],crouch);
      const target=add(shoulder,delta);
      this.rig.solveLimb(limb,target,add(shoulder,[sign*L*.55,L*.025,-L*.42]),.995);
      this.rig.orientSkin(limb.c,basisRotation(this.rig.hand[side].forward,this.rig.hand[side].palm,[0,0,-1],[-sign,0,0]));
    }
  }

  _reach(world,side='R',turn=0,orientationWeight=1) {
    const rig=this.rig,limb=rig.limbs['arm'+side],sign=side==='L'?1:-1;
    const turnRotation=axisRotation([0,0,1],turn);
    const handForward=unit(lerp([0,0,-1],mv(turnRotation,[sign,0,0]),orientationWeight));
    const handPalm=unit(lerp([-sign,0,0],mv(turnRotation,[0,-1,0]),orientationWeight));
    const local=this._native(world),handRotation=basisRotation(rig.hand[side].forward,rig.hand[side].palm,handForward,handPalm);
    let wrist=sub(local,mv(handRotation,sub(this.tools.palmRest(side),rig.restP[limb.c]))),solved;
    const shoulder=pos(rig.posedMatrices[limb.a]),L=limb.upper+limb.lower;
    const pole=add(shoulder,[sign*L*.66,-L*.03,-L*.32]);
    for(let i=0;i<4;i++) {
      solved=rig.solveLimb(limb,wrist,pole,.997);rig.orientSkin(limb.c,handRotation);
      const error=sub(local,this.tools.samplePalm(side));
      if(norm(error)<.00025)break;
      wrist=add(wrist,error);
    }
    return solved;
  }

  update({dt=0,time=0,x=0,z=0,yaw=0,mode='idle',progress=0,target=null,gripTarget=null,seatY=.46,grip=null,seatApproachOffset=.65,mouthGripDepthM=.164,mouthClearanceM=.012}={}) {
    if(![dt,time,x,z,yaw,progress,seatY,seatApproachOffset,mouthGripDepthM,mouthClearanceM].every(Number.isFinite))throw Error('NativeMotion received non-finite frame parameters');
    if(!['idle','walk','sit','sitting','stand','pickup','trade','eat'].includes(mode))throw Error('Unknown native motion mode '+mode);
    dt=clamp(dt,0,.20);const p=clamp(progress,0,1),H=this.height,rig=this.rig;
    const worldTarget=target===null?null:array(target),sourceGrip=gripTarget===null?null:array(gripTarget);
    if((worldTarget&&!finite3(worldTarget))||(sourceGrip&&!finite3(sourceGrip)))throw Error('NativeMotion requires finite world contact points');
    const changed=mode!==this.lastMode;
    let distance=mode==='walk'&&this.lastInput?Math.hypot(x-this.lastInput.x,z-this.lastInput.z):0;
    const teleported=distance>H*.45||this.lastInput&&Math.abs(angleDelta(this.lastInput.yaw,yaw))>1.2;
    if(teleported){distance=0;this.stepState={};this.lastFeet=null;}
    if(changed) {
      this.settleTime=0;this.settleFrom=this.lastFeet?Object.fromEntries(SIDES.map(s=>[s,this.lastFeet[s].position.slice()])):null;
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
    if(mode==='stand'&&(changed||p<this.lastProgress-.0001))
      this.standStart=['sit','sitting','stand'].includes(this.lastMode)?this.seatFactor:1;
    const seated=['sit','sitting','stand'].includes(mode),seatT=mode==='sitting'?1:mode==='stand'?this.standStart*(1-p):p;
    const qSeat=seated?smooth((seatT-.28)/.72):0;
    let rootX=x,rootZ=z;
    if(seated) {
      const close=Math.min(.30,seatApproachOffset),shuffles=(smooth(seatT/.14)+smooth((seatT-.14)/.14))*.5;
      const offset=mix(seatApproachOffset,close,shuffles)*(1-qSeat);
      rootX+=Math.sin(yaw)*offset;rootZ+=Math.cos(yaw)*offset;
    }
    if(this.lastReport&&changed&&Math.hypot(rootX-this.lastReport.rootWorld[0],rootZ-this.lastReport.rootWorld[2])>H*.08) {
      // Explicit simulation reset/fixture jump is allowed to relocate a body.
      // Do not drag a previous scene's planted feet behind the new location.
      this.lastFeet=null;this.settleFrom=null;this.stepState={};
    }
    this.actor.root.position.set(rootX,this.floorOffset,rootZ);this.actor.root.rotation.set(0,yaw,0);
    this.actor.root.updateMatrixWorld(true);
    const action=['pickup','trade','eat'].includes(mode),contactPhase=action&&p>=.30&&p<=.55;
    const closure=Number.isFinite(grip)?clamp(grip,0,1):action?smooth((p-.30)/.18):0;
    this.tools.clear({side:this.side,grip:closure,handActive:action});
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
      const required=this.floorOffset+shoulder[2]-goalY-arm*.78-trunk*(1-Math.cos(55*DEG));
      const maximumDrop=this.floorOffset+this.hipCenter[2]-Math.max(.18,H*.105);
      const down=clamp(required,H*.28,maximumDrop);
      const crouch=p<=.75?smooth(p/.20):1-smooth((p-.75)/.25);
      crouchWeight=crouch;rootDrop=down*crouch;rootFore=-H*.012*crouch;lean=55*crouch;
    }
    if(mode==='trade') {
      const counterReach=sourceGrip?smooth((p-.55)/.40):sourceEnvelope;
      const counterY=worldTarget?.[1]??.95;
      rootDrop=(H*.032+Math.max(0,.95-counterY)*1.1)*counterReach;
      rootFore=H*.047*counterReach;lean=31*counterReach;
    }
    if(mode==='eat')lean=2*smooth((p-.55)/.30);
    rig.rootTranslation[1]=-rootFore;rig.rootTranslation[2]=-rootDrop;
    // Forward reach is primarily a hip/lower-spine hinge. Spreading the same
    // angle across five high joints barely moves the shoulder and made real
    // native arms miss the low bottle despite a visually bent head.
    const hinge=action?.88:.62;
    rig.setRotation('spine05',lean*hinge,0,0);rig.setRotation('spine03',lean*(1-hinge)*.5,0,0);rig.setRotation('spine01',lean*(1-hinge)*.5,0,0);
    if(!action&&!seated)rig.setRotation('neck01',Math.sin(time*.8)*.7,0,Math.sin(time*.37)*2.5);
    if(mode==='eat')rig.setRotation('neck01',6*smooth((p-.55)/.30),0,0);
    rig.fk();
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
    const mouthSurface=this._world(this.mouthVertex>=0?this.tools.sampleVertex(this.mouthVertex):transform(rig.skinMatrices[this.headIndex],this.mouthRest));
    const forward=[Math.sin(yaw),0,Math.cos(yaw)];
    // For eating, turn the palm toward the face. The food fits between palm
    // and face; its far surface approaches the mouth while the hand stays
    // outside. ItemWorld supplies the real held-food depth and checks it.
    const handTurn=mode==='eat'?Math.PI*smooth((p-.55)/.37):0;
    const mouth=add(mouthSurface,scale(forward,Math.max(0,mouthGripDepthM)+Math.max(0,mouthClearanceM)));
    let sourceTarget=null,completionTarget=null,goal=null,solution=null,stage=mode;
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
      else {
        const t=smooth((p-.55)/.45);goal=lerp(sourceTarget,completionTarget,t);
        goal[1]+=Math.sin(Math.PI*t)*H*.065;
        stage=p<.96?'transport':mode==='eat'?'at-mouth':mode==='trade'&&sourceGrip?'at-counter':'at-bag';
      }
      solution=this._reach(goal,this.side,handTurn,smooth(p/.30));
    }
    const checked=rig.validate(),palm=this._world(this.tools.samplePalm(this.side));
    const palmNormal=this._direction(unit(mv(rotation(rig.skinMatrices[rig.limbs['arm'+this.side].c]),rig.hand[this.side].palm)),yaw);
    const footErrorM=Math.max(...SIDES.map(s=>feet[s].surfaceErrorM));
    const poseValid=checked.finite&&checked.maxBoneLengthError<=.00001&&footErrorM<=.015;
    const contactErrorM=sourceTarget?norm(sub(palm,sourceTarget)):0;
    const activeGoalErrorM=goal?norm(sub(palm,goal)):0;
    const completionErrorM=completionTarget?norm(sub(palm,completionTarget)):null;
    const contactReady=contactPhase&&poseValid&&contactErrorM<=.012;
    const endPoseReady=action?p>=.96&&poseValid&&completionErrorM<=.014:
      seated?poseValid&&(mode==='stand'?p>=.98:seatT>=.98&&seatErrorM<=.012):poseValid;
    // The only GPU submission in the execution path.
    this.tools.commit({side:this.side,grip:closure,target:goal,solution});
    const report={mode,progress:p,stage,side:this.side,palm,palmNormal,
      gripCenter:add(palm,scale(palmNormal,this.actor.graspReport?.shape?.radius||.032)),
      bagTarget,mouth,mouthSurface,mouthApproachClearanceM:mouthGripDepthM+mouthClearanceM,mouthGripDepthM,mouthClearanceM,
      sourceTarget,completionTarget,contactErrorM,activeGoalErrorM,completionErrorM,
      contactPhase,contactReady,endPoseReady,completed:endPoseReady,
      sourceContactOnly:contactReady,objectTransportVerified:false,
      feet,footErrorM,seatSupport,seatErrorM,seatSupportVertexIds:this.seatSupportIds,
      boneLengthErrorM:checked.maxBoneLengthError,orthogonalityError:checked.maxOrthogonalityError,
      finite:checked.finite&&finite3(palm)&&SIDES.every(s=>finite3(feet[s].position)),
      poseValid,reachClamped:!!solution?.clamped,grip01:closure,
      graspAdmissible:!!this.actor.graspReport?.sides?.[this.side]?.admissible,
      rootWorld:[rootX,this.floorOffset,rootZ],pelvisWorld:this._world(pos(rig.posedMatrices[this.rootIndex])),seatFactor:seated?seatT:0,
      phase:this.phase,distanceStepM:distance,assistedGrip:true,recoveryProgress:clamp(this.recoveryTime/RECOVERY_SECONDS,0,1),
      limitations:['rigid-bone IK and native linear skinning','sampled foot/palm/seat anchors, not continuous skin collision','object transport and force constraints verified separately']};
    this.lastInput={x:rootX,z:rootZ,yaw};this.lastMode=mode;this.lastProgress=p;this.seatFactor=seated?seatT:0;this.lastFeet=feet;this.lastReport=report;
    if(action)this.lastActionPose=rig.exportNativePose();
    return report;
  }
}

export default NativeMotion;
