/** Complete CMU115_06 pickup, with explicit actual-object acquisition gating.
 * Source body/legs are retargeted at all357 frames by the original controller.
 * The small upright bottle adds an actual hip-axis hinge, original coupled
 * elbow/forearm-roll solve, full native finger fit and original-shoe grounding.
 * No inventory, ownership, item transform or physical success is written here.
 */
import {THREE} from './NativeBinding.mjs';
import {math} from './NativeRig.mjs';
import {PICKUP_REACH_RULES,verticalReach,minimumHingeForHeight,minimumBagTurn,minimumVerticalPalmClearance} from './PickupReachGeometry.mjs';
import {nativeEntryAnchor,planNativePickupEntry,routeNativePickupFoot} from './NativePickupFootEntry.mjs';
const {add,sub,scale,dot,cross,norm,unit,lerp,pos,rotation,mv,tr,mm3,axisRotation,basisRotation,clamp,smooth,DEG}=math;
const SIDES=['L','R'],CONTACT_FRAME=99,LAST_FRAME=356,FPS=120;
const transform=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[2]*p[2]+m[3],m[4]*p[0]+m[5]*p[1]+m[6]*p[2]+m[7],m[8]*p[0]+m[9]*p[1]+m[10]*p[2]+m[11]];
const finite=p=>p.length===3&&p.every(Number.isFinite);
const clonePose=p=>({q:p.q.slice(),p:p.p.slice()});
function blendRotation(a,b,t){
 const matrix=r=>new THREE.Matrix4().set(r[0],r[1],r[2],0,r[3],r[4],r[5],0,r[6],r[7],r[8],0,0,0,0,1);
 const qa=new THREE.Quaternion().setFromRotationMatrix(matrix(a)),qb=new THREE.Quaternion().setFromRotationMatrix(matrix(b));
 const e=new THREE.Matrix4().makeRotationFromQuaternion(qa.slerp(qb,t).normalize()).elements;
 return[e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]];
}
function saveRig(r){return{skin:r.skinMatrices.map(x=>x.slice()),posed:r.posedMatrices.map(x=>x.slice()),deltas:r.rotationDeltas.map(x=>x.slice()),root:r.rootTranslation.slice()};}
function restoreRig(r,s){for(let j=0;j<r.count;j++){r.skinMatrices[j].set(s.skin[j]);r.posedMatrices[j].set(s.posed[j]);r.rotationDeltas[j].splice(0,3,...s.deltas[j]);}r.rootTranslation.splice(0,3,...s.root);}

export class NativeCapturedPickup {
 constructor(motion){this.motion=motion;this.actor=motion.actor;this.rig=motion.rig;this.tools=motion.tools;this.library=motion.library;this.template=null;this.reset();}
 reset(){this.phase=null;this.elapsed=0;this.sourceFrame=0;this.attached=false;this.lastProgress=0;this.target=null;this.entry=null;this.lastHinge=0;this.lastReport=null;this.lastTransportGoal=null;this.lastCarryClearance=0;return this;}
 _root(x,z,yaw){const m=this.motion;this.actor.root.position.set(x,m.floorOffset,z);this.actor.root.rotation.set(0,yaw,0);this.actor.root.updateMatrixWorld(true);}
 _syncTranslation(){const r=this.rig;this.rig.rootTranslation.splice(0,3,...sub(pos(r.posedMatrices[this.motion.rootIndex]),r.restP[this.motion.rootIndex]));}
 _source(frame){
  const s=this.library.samplePickup(frame),r=this.rig;
  for(let j=0;j<r.count;j++){r.skinMatrices[j].set(s.skin[j]);const e=s.world[j].elements;for(let a=0;a<4;a++)for(let b=0;b<4;b++)r.posedMatrices[j][a*4+b]=e[b*4+a];}
  this._syncTranslation();return s;
 }
 _applyPacked(pose){
  const sampler=this.library.sampler,skin=sampler.apply(pose),r=this.rig;
  for(let j=0;j<r.count;j++){r.skinMatrices[j].set(skin[j]);const e=sampler.world[j].elements;for(let a=0;a<4;a++)for(let b=0;b<4;b++)r.posedMatrices[j][a*4+b]=e[b*4+a];}this._syncTranslation();
 }
 _hips(){const r=this.rig,L=pos(r.posedMatrices[r.limbs.legL.a]),R=pos(r.posedMatrices[r.limbs.legR.a]);return{L,R,pivot:scale(add(L,R),.5),axis:unit(sub(L,R))};}
 _handRotation(turn=0,side='R'){
  const r=this.rig,sign=side==='L'?1:-1,turnR=axisRotation([0,0,1],turn);
  // ActorAdapter.orientFor: displayed palm +Z, L fingers +X/R fingers -X.
  return basisRotation(r.hand[side].forward,r.hand[side].palm,mv(turnR,[sign,0,0]),mv(turnR,[0,-1,0]));
 }
 _hinge(angle){
  if(Math.abs(angle)<1e-12)return;
  const r=this.rig,{pivot,axis}=this._hips(),legs=new Map();
  for(const side of SIDES)for(const j of r.descendants[r.limbs['leg'+side].a])legs.set(j,{p:r.posedMatrices[j].slice(),s:r.skinMatrices[j].slice()});
  r.rotateSubtree(this.motion.rootIndex,axisRotation(axis,angle),pivot);
  // Both real hip joints lie on this axis. Restoring their entire native leg
  // subtrees retains captured hip/knee/ankle positions and fixed bone lengths.
  for(const [j,s]of legs){r.posedMatrices[j].set(s.p);r.skinMatrices[j].set(s.s);}this._syncTranslation();
 }
 _fingers(amount){
  const r=this.rig,side='R',hand=r.limbs.armR.c,wrist=rotation(r.skinMatrices[hand]);
  const selected=j=>r.names[j]==='metacarpal1.R'||r.names[j].startsWith('finger')&&r.names[j].endsWith('.R');
  for(const j of r.order)if(selected(j)){r.rotationDeltas[j].fill(0);r.orientSkin(j,wrist);}
  this.tools.applyGrip(side,amount);
  // Original InteractionRig.fingers composition: append native local deltas
  // to captured matrices, never run a global FK that erases captured limbs.
  // Include the original fitted thenar/metacarpal fallback before its thumb
  // descendants. Omitting it silently changes the calibrated full-hand fit.
  for(const j of r.order)if(selected(j)){const delta=r.rotationDeltas[j],angle=norm(delta);if(angle>0)r.rotateSubtree(j,axisRotation(mv(rotation(r.skinMatrices[j]),unit(delta)),angle*DEG));}
 }
 _reach(localGoal,turn=0,reach=1,coupledReach=reach){
  const r=this.rig,l=r.limbs.armR,H=this.motion.height,desired=this._handRotation(turn),wanted=blendRotation(rotation(r.skinMatrices[l.c]),desired,clamp(reach,0,1)),F=unit(mv(wanted,r.hand.R.forward));
  let wrist=sub(localGoal,mv(wanted,sub(this.tools.palmRest('R'),r.restP[l.c]))),solution=null,roll=0;
  for(let i=0;i<4;i++){
   const shoulder=pos(r.posedMatrices[l.a]),pole=lerp(add(shoulder,[-H*.15,H*.045,-H*.27]),sub(wrist,scale(F,l.lower)),coupledReach);
   solution=r.solveLimb(l,wrist,pole,PICKUP_REACH_RULES.sourceSolveExtension);
   const elbow=pos(r.posedMatrices[l.b]),D=unit(sub(pos(r.posedMatrices[l.c]),elbow)),oldN=mv(rotation(r.skinMatrices[l.c]),r.hand.R.palm),desiredN=mv(wanted,r.hand.R.palm),aN=unit(sub(oldN,scale(D,dot(oldN,D)))),bN=unit(sub(desiredN,scale(D,dot(desiredN,D))));
   roll=Math.atan2(dot(D,cross(aN,bN)),dot(aN,bN));r.rotateSubtree(l.b,axisRotation(D,roll),elbow);r.orientSkin(l.c,wanted);
   const error=sub(localGoal,this.tools.samplePalm('R'));if(norm(error)<.00020||solution.clamped)break;wrist=add(wrist,error);
  }
  const D=unit(sub(pos(r.posedMatrices[l.c]),pos(r.posedMatrices[l.b]))),actualForward=unit(mv(rotation(r.skinMatrices[l.c]),r.hand.R.forward));
  return{...solution,wristBendDegrees:Math.acos(clamp(dot(D,actualForward),-1,1))/DEG,forearmDirection:D,handForwardNative:actualForward,rollRadians:roll,actualPalmErrorM:norm(sub(localGoal,this.tools.samplePalm('R'))),originalCoupledElbowRoll:true};
 }
 _armLocals(){
  const r=this.rig,l=r.limbs.armR,hand=new Set(r.descendants[l.c]);
  // NativeRig.exportNativePose uses these same parent-relative native skin
  // rotations. Include the original upper/lower-arm helper bones, stopping
  // at the wrist so the separately fitted full finger hierarchy is retained.
  return r.descendants[l.a].filter(j=>j===l.c||!hand.has(j)).map(j=>({j,
   rotation:mm3(tr(rotation(r.skinMatrices[r.parents[j]])),rotation(r.skinMatrices[j]))}));
 }
 _approach(weight){
  const r=this.rig,l=r.limbs.armR,current=this._armLocals(),target=this.template.contactArm;
  // Empty hands need not reach the final bottle point before contact. Blend
  // native LOCAL joint rotations over the original source descent, as the
  // retained RigidPoseSampler does, rather than selecting a discontinuous
  // maximum feasible Cartesian target each frame. Immutable rest bone lengths
  // and every current captured body/leg frame remain intact.
  for(let i=0;i<current.length;i++){
   const {j,rotation:local}=current[i];if(target[i].j!==j)throw Error('Captured contact arm hierarchy changed');
   r.orientSkin(j,mm3(rotation(r.skinMatrices[r.parents[j]]),blendRotation(local,target[i].rotation,weight)));
  }
  const D=unit(sub(pos(r.posedMatrices[l.c]),pos(r.posedMatrices[l.b]))),F=unit(mv(rotation(r.skinMatrices[l.c]),r.hand.R.forward));
  const goal=this.tools.samplePalm('R').slice(),wristBendDegrees=Math.acos(clamp(dot(D,F),-1,1))/DEG;
  return{goal,weight,solution:{wristBendDegrees,clamped:false,actualPalmErrorM:0,originalCapturedLocalArmTransition:true},
   interpolation:{weight,method:'source-time smooth local native joint SLERP to the measured contact99 arm; no empty-hand Cartesian contact constraint',originalSourceFrame:this.sourceFrame,contactFrame:99,localJointCount:current.length}};
 }
 _shoeGoals(contacts,yaw,entry=null){
  const m=this.motion,r=this.rig,goals={};
  for(const [i,side]of SIDES.entries()){
   const l=r.limbs['leg'+side],hip=pos(r.posedMatrices[l.a]),knee=pos(r.posedMatrices[l.b]),ankle=pos(r.posedMatrices[l.c]),line=unit(sub(ankle,hip));
   const raw=m._world(this.tools.sampleVertex(m.footDefs[side].id)),R=rotation(r.skinMatrices[l.c]);
   const bend=sub(sub(knee,hip),scale(line,dot(sub(knee,hip),line))),poleOffset=scale(unit(bend,side==='L'?[.1,-1,0]:[-.1,-1,0]),m.height);
   let world=raw.slice(),planted=contacts[side]>.65,soleHeight=planted?0:Math.max(0,m._soleMinimum(side)),goalR=R;
   let routing=null;
   if(entry){const step=routeNativePickupFoot(entry.plan,entry,m,side,this.elapsed,yaw,blendRotation);
    world=step.position;planted=step.planted;soleHeight=step.soleHeight;goalR=step.rotation;routing=step.routing;
   }
   goals[side]={world,yaw,rotation:goalR,planted,soleHeight,kneePoleOffset:poleOffset,sourceContactWeight:contacts[side],entryRouting:routing};
  }
  return goals;
 }
 _ground(contacts,yaw,entry=null){
  const m=this.motion,r=this.rig,goals=this._shoeGoals(contacts,yaw,entry);let drop=0;
  for(const side of SIDES){
   const l=r.limbs['leg'+side],hip=pos(r.posedMatrices[l.a]),ankle=pos(r.posedMatrices[l.c]),goal=goals[side],local=m._native(goal.world),offset=mv(goal.rotation,sub(m.footDefs[side].rest,r.restP[l.c])),desired=sub(local,offset);
   const oldR=rotation(r.skinMatrices[l.c]);r.orientSkin(l.c,goal.rotation);const low=m._soleMinimum(side)-m.floorOffset-ankle[2];r.orientSkin(l.c,oldR);
   desired[2]=(goal.planted?0:goal.soleHeight)-m.floorOffset-low;
   const reach=(l.upper+l.lower)*PICKUP_REACH_RULES.sourceSupportExtension,xy=(hip[0]-desired[0])**2+(hip[1]-desired[1])**2;
   if(xy<reach*reach)drop=Math.max(drop,hip[2]-desired[2]-Math.sqrt(reach*reach-xy));
  }
  drop=clamp(drop,0,m.height*PICKUP_REACH_RULES.sourceMaximumPelvisDropOfHeight);
  if(drop>1e-9){for(const list of[r.posedMatrices,r.skinMatrices])for(const matrix of list)matrix[11]-=drop;this._syncTranslation();}
  const feet={};for(const side of SIDES){feet[side]=m._solveFoot(side,goals[side],yaw);feet[side].sourceContactWeight=contacts[side];feet[side].sourceKneePlaneRetained=true;if(goals[side].entryRouting)feet[side].entryRouting=goals[side].entryRouting;}
  return{feet,pelvisSupportDropM:drop,goals};
 }
 _groundedSource(frame,yaw=Math.PI){const s=this._source(frame),g=this._ground(s.contacts,yaw);return{source:s,...g};}

 /** Pure planning/measurement on the current actual actor/shoes. It saves and
  * restores the full rig and render root; success grants no physical receipt. */
 assess(){
  const m=this.motion,r=this.rig,root=this.actor.root,saved=saveRig(r),position=root.position.toArray(),rotationEuler=[root.rotation.x,root.rotation.y,root.rotation.z],oldSide=this.actor.side,oldProfile=this.actor.graspReport?.profile,oldFloor=m.floorOffset,oldLift=m.soleLift;
  const report={schema:'native-pickup-stance/1',actor:this.actor.id,passed:false,rootOffsetXZ:[0,.43],yaw:Math.PI,bottleRadiusM:.032,bottleHeightM:.14,contactHeightM:.07,source:{clip:'115_06',frames:357,contactFrame:99},rules:PICKUP_REACH_RULES,physicalReceipt:false};
  try{
   this.tools.selectGrasp?.('bottle');m.soleLift=Math.max(0,Number(this.actor.footwear?.soleLiftM)||0);m.floorOffset=m.baseFloorOffset+m.soleLift;this._root(0,0,Math.PI);
   const start=this._groundedSource(0),startHip=this._hips().pivot[2];
   const contact=this._groundedSource(CONTACT_FRAME),hips=this._hips(),limb=r.limbs.armR,shoulder=pos(r.posedMatrices[limb.a]),hand=this._handRotation(),offset=mv(hand,sub(this.tools.palmRest('R'),r.restP[limb.c])),vertical=verticalReach(limb.upper,limb.lower,[-1,0,0]);
   const hinge=minimumHingeForHeight(shoulder,hips.pivot,hips.axis,.07-m.floorOffset-offset[2],vertical.dropM);
   if(hinge.angle===null)throw Error('Actual captured stance has no bounded hip-axis ground-contact solution');
   this._hinge(hinge.angle);const movedShoulder=pos(r.posedMatrices[limb.a]),desiredPalm=add(add(movedShoulder,vertical.V),offset),relative=m._world(desiredPalm),target=[0,.07,.032];
   report.rootOffsetXZ=[target[0]-relative[0],target[2]-relative[2]];
   this._root(report.rootOffsetXZ[0],report.rootOffsetXZ[1],Math.PI);
   const corrected=this._groundedSource(CONTACT_FRAME);this._fingers(1);this._hinge(hinge.angle);
   const contactSourcePalm=this.tools.samplePalm('R').slice(),solution=this._reach(m._native(target),0,1),palm=m._world(this.tools.samplePalm('R')),checked=r.validate();
   const contactArm=this._armLocals(),contactPose={palm,target,errorM:norm(sub(palm,target)),wristBendDegrees:solution.wristBendDegrees,reachClamped:solution.clamped,feet:corrected.feet,boneLengthErrorM:checked.maxBoneLengthError,finite:checked.finite,rootWorld:root.position.toArray(),rootTranslation:r.rootTranslation.slice(),hipHingeDegrees:hinge.angle/DEG,sourceSupportDropM:corrected.pelvisSupportDropM,sourceHipZ:hips.pivot[2],shoulder:m._world(pos(r.posedMatrices[limb.a])),elbow:m._world(pos(r.posedMatrices[limb.b])),wrist:m._world(pos(r.posedMatrices[limb.c]))};
   const end=this._groundedSource(LAST_FRAME),endHip=this._hips().pivot[2],bag=sub(m._native(m.bagAnchor()),pos(r.posedMatrices[limb.a])),turn=minimumBagTurn(bag,offset,-1,limb.upper,limb.lower);
   if(turn.angle===null)throw Error('Actual bag has no upright-cylinder coupled-wrist solution within+/-90deg');
   this._fingers(1);const bagWorld=m.bagAnchor(),bagSolution=this._reach(m._native(bagWorld),turn.angle,1),bagError=norm(sub(this.tools.samplePalm('R'),m._native(bagWorld)));
   report.measured={...contactPose,verticalReach:vertical,hipHeightEquation:hinge,bagTurnDegrees:turn.angle/DEG,bagTurnGeometry:turn,bagTarget:bagWorld,bagPalmErrorM:bagError,bagWristDegrees:bagSolution.wristBendDegrees,bagFeet:end.feet,sourceHipStartZ:startHip,sourceHipEndZ:endHip};
   report.passed=checked.finite&&checked.maxBoneLengthError<.00001&&contactPose.errorM<=.012&&!solution.clamped&&solution.wristBendDegrees<65&&bagError<=.012&&!bagSolution.clamped&&bagSolution.wristBendDegrees<65&&[corrected,end].every(x=>SIDES.every(s=>x.feet[s].surfaceErrorM<=.015&&x.feet[s].soleMinimumWorldYM>=-.003&&(!x.feet[s].planted||Math.abs(x.feet[s].soleMinimumWorldYM)<=.003)));
   this.template={hinge:hinge.angle,turn:turn.angle,contactSourcePalm,contactArm,startHip,contactHip:hips.pivot[2],endHip,offset:offset.slice(),stance:report};
  }catch(error){report.error=String(error?.stack||error);this.template=null;}
  finally{restoreRig(r,saved);root.position.set(...position);root.rotation.set(...rotationEuler);root.updateMatrixWorld(true);m.floorOffset=oldFloor;m.soleLift=oldLift;if(oldProfile)this.tools.selectGrasp?.(oldProfile);if(oldSide)this.actor.setSide(oldSide);this.tools.commit({side:oldSide||'R',grip:m.lastReport?.grip01||0,target:m.lastReport?.activeGoal||null});}
  this.actor.pickupStance=report;this.actor.motionCapabilities={...(this.actor.motionCapabilities||{}),pickupStance:report};return report;
 }
 _start({x,z,yaw,target,progress}){
  if(!this.template)this.assess();if(!this.template?.stance.passed)throw Error('NPC '+this.actor.id+' has no measured native pickup stance: '+(this.actor.pickupStance?.error||'contact gate'));
  const m=this.motion,r=this.rig,oldPosition=this.actor.root.position.toArray(),oldYaw=this.actor.root.rotation.y,previous=saveRig(r),previousFeet=m.lastFeet;
  this._root(x,z,yaw);const R=axisRotation([0,0,1],oldYaw-yaw),translation=m._native(oldPosition);
  // Re-express the real previous WORLD pose in the new navigation root. This
  // ordinary final turn preserves old foot support rather than teleporting it.
  for(const matrices of[r.posedMatrices,r.skinMatrices])for(const matrix of matrices){const old=matrix.slice(),p=add(mv(R,pos(old)),translation);for(let row=0;row<3;row++)for(let c=0;c<3;c++)matrix[row*4+c]=R[row*3]*old[c]+R[row*3+1]*old[4+c]+R[row*3+2]*old[8+c];matrix[3]=p[0];matrix[7]=p[1];matrix[11]=p[2];}
  this._syncTranslation();const packed=clonePose(this.library.sampler.pack(r.posedMatrices)),feet={};
  for(const side of SIDES){const p=previousFeet?.[side]?.position||m._world(this.tools.sampleVertex(m.footDefs[side].id));feet[side]={position:p.slice(),planted:previousFeet?.[side]?.planted??true,sole:previousFeet?.[side]?.soleMinimumWorldYM??m._soleMinimum(side),rotation:rotation(r.skinMatrices[r.limbs['leg'+side].c]),anchorNative:nativeEntryAnchor(m,side)};}
  const first=this._groundedSource(0,yaw),destinationFeet={};for(const side of SIDES)destinationFeet[side]={position:first.feet[side].position.slice(),sole:first.feet[side].soleMinimumWorldYM,rotation:rotation(r.skinMatrices[r.limbs['leg'+side].c]),anchorNative:nativeEntryAnchor(m,side)};
  this.entry={packed,feet,destinationFeet};this.entry.plan=planNativePickupEntry(this.entry,m,yaw);this.phase='entry';this.elapsed=0;this.sourceFrame=0;this.attached=false;this.target=target.slice();this.lastProgress=progress;this.lastHinge=0;this.lastTransportGoal=null;this.lastCarryClearance=0;this._applyPacked(packed);
 }
 update({dt,time,x,z,yaw,progress,target,grip,pickupAttached=false}){
  const m=this.motion,r=this.rig;
  const newTransaction=!this.phase||m.lastMode!=='pickup'||progress<this.lastProgress-.10||this.target&&norm(sub(target,this.target))>.08;
  if(newTransaction)this._start({x,z,yaw,target,progress});
  this.lastProgress=progress;this.target=target.slice();this._root(x,z,yaw);
  if(this.phase==='entry'){this.elapsed+=dt;if(this.elapsed>=this.entry.plan.duration){this.phase='down';this.elapsed-=this.entry.plan.duration;}}
  else if(this.phase==='down'){this.elapsed+=dt;if(this.elapsed>=CONTACT_FRAME/FPS){this.phase='contact-hold';this.elapsed=0;}}
  else if(this.phase==='contact-hold'&&pickupAttached){this.attached=true;this.phase='leave';this.elapsed=0;}
  else if(this.phase==='leave'){if(pickupAttached)this.elapsed+=dt;if(this.elapsed>=(LAST_FRAME-CONTACT_FRAME)/FPS){this.phase='at-bag';this.elapsed=0;}}
  this.sourceFrame=this.phase==='entry'?0:this.phase==='down'?clamp(this.elapsed*FPS,0,CONTACT_FRAME):this.phase==='contact-hold'?CONTACT_FRAME:this.phase==='leave'?clamp(CONTACT_FRAME+this.elapsed*FPS,CONTACT_FRAME,LAST_FRAME):LAST_FRAME;
  const source=this._source(this.sourceFrame);
  if(this.phase==='entry'){const sourcePacked=clonePose(source.pose),q=smooth(this.elapsed/this.entry.plan.duration);this._applyPacked(this.library.sampler.interpolate(this.entry.packed,sourcePacked,q));}
  const grounded=this._ground(source.contacts,yaw,this.phase==='entry'?this.entry:null),hips=this._hips(),limb=r.limbs.armR;
  const closure=Number.isFinite(grip)?clamp(grip,0,1):this.attached?1:0;this._fingers(closure);
  const rawPalm=this.tools.samplePalm('R').slice(),localTarget=m._native(target),T=this.template;
  const rise=clamp((hips.pivot[2]-T.contactHip)/Math.max(1e-8,T.endHip-T.contactHip),0,1),carry=this.attached?smooth(rise):0;
  let hinge=0,turn=0,reach=0,goal=null,solution=null,transportReach=null,carryClearanceM=0,approachGeometry=null;
  if(this.phase==='entry'){goal=rawPalm;}
  else if(!this.attached){
   // The additional ground-bottle hinge is an adapter, not captured motion.
   // Distribute it over the original 0..99 descent time. Applying another
   // smooth envelope to the source's rapidly falling hips compressed almost
   // the entire extra hinge into ~0.15 s and whipped the empty hand downward.
   // The actual captured hips/legs and exact frame99 contact angle are unchanged.
   hinge=T.hinge*smooth(this.sourceFrame/CONTACT_FRAME);this._hinge(hinge);
   if(this.phase==='contact-hold'){reach=1;goal=localTarget;solution=this._reach(goal,0,1);}
   else{const approach=this._approach(smooth(this.sourceFrame/CONTACT_FRAME));reach=approach.weight;goal=approach.goal;solution=approach.solution;approachGeometry=approach.interpolation;}
  }else{
   turn=T.turn*carry;hinge=T.hinge*(1-carry);
   // The original box capture supplies all body/leg frames and its hand-rise
   // displacement. As those actual hips rise, a small bottle continuously
   // gathers to the existing bag instead of following the box behind a bench.
   this._hinge(hinge);const raw=this.tools.samplePalm('R'),bag=m._native(m.bagAnchor());
   goal=lerp(add(localTarget,sub(raw,T.contactSourcePalm)),bag,carry);
   const shoulder=pos(r.posedMatrices[limb.a]),offset=mv(this._handRotation(turn),sub(this.tools.palmRest('R'),r.restP[limb.c])),F=mv(axisRotation([0,0,1],turn),[-1,0,0]);
   // Source box-carry frames do not all admit the final bag's fixed cylinder
   // yaw. Carry above that exact bag by the minimum analytically required
   // vertical clearance, then return to its original point at source356.
   // No arbitrary offset, angular sampling or permissive wrist fallback.
   transportReach=minimumVerticalPalmClearance(sub(sub(goal,shoulder),offset),F,limb.upper,limb.lower);
   carryClearanceM=transportReach.liftM??0;goal=add(goal,[0,0,carryClearanceM]);reach=1;solution=this._reach(goal,turn,1);
  }
  const checked=r.validate(),palm=m._world(this.tools.samplePalm('R')),handR=rotation(r.skinMatrices[limb.c]),palmNormal=m._direction(unit(mv(handR,r.hand.R.palm)),yaw),handForward=m._direction(unit(mv(handR,r.hand.R.forward)),yaw),handCylinderAxis=unit(cross(handForward,palmNormal));
  const bagTarget=m.bagAnchor(),worldGoal=m._world(goal),footErrorM=Math.max(...SIDES.map(s=>grounded.feet[s].surfaceErrorM)),contactErrorM=norm(sub(palm,target)),activeGoalErrorM=norm(sub(palm,worldGoal)),completionErrorM=norm(sub(palm,bagTarget));
  const wristGateActive=reach>.999&&closure>.999,feetValid=SIDES.every(s=>grounded.feet[s].soleMinimumWorldYM>=-.003&&(!grounded.feet[s].planted||Math.abs(grounded.feet[s].soleMinimumWorldYM)<=.003));
  const approachAdmissible=!approachGeometry||reach<=1e-10||!solution?.clamped&&solution?.wristBendDegrees<65;
  const poseValid=checked.finite&&checked.maxBoneLengthError<=.00001&&footErrorM<=.015&&feetValid&&approachAdmissible&&(!transportReach||transportReach.feasible)&&(!wristGateActive||solution?.wristBendDegrees<65),contactPhase=this.phase==='contact-hold'&&!this.attached,contactReady=contactPhase&&poseValid&&contactErrorM<=.012;
  const completed=this.phase==='at-bag'&&pickupAttached&&poseValid&&completionErrorM<=.014;
  const carryClearanceSpeedMPS=this.attached&&dt>0?(carryClearanceM-this.lastCarryClearance)/dt:0,transportPalmGoalSpeedMPS=this.attached&&this.lastTransportGoal&&dt>0?norm(sub(worldGoal,this.lastTransportGoal))/dt:0;
  if(this.attached){this.lastCarryClearance=carryClearanceM;this.lastTransportGoal=worldGoal.slice();}
  const report={mode:'pickup',progress,stage:this.phase,side:'R',palm,palmNormal,handForward,handCylinderAxis,
   gripCenter:add(palm,scale(palmNormal,.032)),sourceTarget:target.slice(),completionTarget:bagTarget,bagTarget,activeGoal:worldGoal,contactErrorM,activeGoalErrorM,completionErrorM,
   contactPhase,contactReady,endPoseReady:completed,completed,sourceContactOnly:contactReady,objectTransportVerified:false,
   feet:grounded.feet,footErrorM,boneLengthErrorM:checked.maxBoneLengthError,orthogonalityError:checked.maxOrthogonalityError,finite:checked.finite&&finite(palm),poseValid,reachClamped:!!solution?.clamped,grip01:closure,graspAdmissible:!!this.actor.graspReport?.sides?.R?.admissible,
   rootWorld:[x,m.floorOffset,z],rootTranslation:r.rootTranslation.slice(),pelvisWorld:m._world(pos(r.posedMatrices[m.rootIndex])),soleLiftM:m.soleLift,seatFactor:0,
   motionSource:{base:'R04 full CMU115_06,357frames/104nativebones',frame:this.sourceFrame,sourceFrames:source.report.sourceFrames,contactFrame:99,phase:this.phase,contacts:source.contacts,originalBodyAndLegsRetained:true,contact:'source R03/R04 coupled elbow/roll plus measured hip-axis/cylinder/shoe adapter'},
   capturedPickup:{phase:this.phase,sourceFrame:this.sourceFrame,sourceTime:this.sourceFrame/FPS,acquisitionInput:!!pickupAttached,acquisitionLatched:this.attached,ownershipWritten:false,hingeDegrees:hinge/DEG,bagTurnDegrees:turn/DEG,sourceHipRise:rise,carryWeight:carry,pelvisSupportDropM:grounded.pelvisSupportDropM,wristDegrees:solution?.wristBendDegrees??null,wristGateActive,reachGeometryFeasible:transportReach?transportReach.feasible:true,approachWeight:reach,approachAdmissible,approachGeometry,entryOrder:this.phase==='entry'?this.entry.plan.order:null,carryClearanceM,carryClearanceSpeedMPS,transportPalmGoalSpeedMPS,carryClearanceGeometry:transportReach,fullSourceFrameRange:[0,356],sourceFrameCount:357},
   contactAdaptation:{hipHingeDegrees:hinge/DEG,bagTurnDegrees:turn/DEG,wristBendDegrees:solution?.wristBendDegrees??null,originalCoupledElbowRoll:true},assistedGrip:true,distanceStepM:0,phase:0,
   limitations:['complete retained linear native skin,not self-collision-free muscles','original full shoe sole plus native palm geometric constraints','finite-force item transport and inventory independently owned by ItemWorld']};
  this.tools.commit({side:'R',grip:closure,target:worldGoal,solution});m.lastInput={x,z,yaw};m.lastMode='pickup';m.lastProgress=progress;m.lastFeet=grounded.feet;m.lastReport=report;m.lastActionPose=r.exportNativePose();m.library.finalPose();
  this.lastHinge=hinge;this.lastReport=report;return report;
 }
}
