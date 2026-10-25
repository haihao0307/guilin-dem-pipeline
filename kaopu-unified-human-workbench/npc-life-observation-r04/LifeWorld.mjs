import * as CANNON from './vendor/cannon-es.js';
import {WindowInteraction} from './WindowInteraction.mjs';
import {detachState,summarizeAudit} from './StateSnapshot.mjs';

// Dimensions are metres. The visible station is built from these same values.
export const DIM = Object.freeze({ tableTop: 1.02, tableHalf: [.62, .035, .23], tableCentre: [0, .985, .52], radius: .032, height: .14, gripHeight: 0, mass: .22, maxGripForcePerAxisN:24, maxGripTorquePerAxisNm:.8, gripStiffness:1e7, gripRelaxation:4, source: [0, 1.0908, .37], target: [0, 1.0908, .44], alternateTarget: [-.06, 1.0908, .40], bottleApproachLiftM:.04, bottleWithdrawLiftM:.03, bottleWithdrawMinimumM:.14, bottleWithdrawTableMarginM:.19 });
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10)};
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const arr=v=>[v.x,v.y,v.z];
const offset=(p,d)=>p.map((x,i)=>x+d[i]);
const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*smooth(t));

/** Shared authoritative rigid-body world. There is no animation-owned prop pose. */
export class LifeWorld {
  constructor(actors,{onEvent=()=>{}}={}){
    this.actors=actors;this.onEvent=onEvent;this.time=0;this.events=[];this.reservedBy=null;this.heldBy=null;this.grip=null;this.supportEnabled=true;this.target=DIM.target.slice();this.targetRevision=0;this.supportRevision=0;this.nextTask=0;this.lastReleasedTaskToken=null;this.autonomous=false;
    this.world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.81,0)});
    this.world.solver.iterations=24;this.world.solver.tolerance=1e-7;
    const surface=new CANNON.Material('wood'),item=new CANNON.Material('storage-bottle');
    this.world.addContactMaterial(new CANNON.ContactMaterial(surface,item,{friction:.65,restitution:.01,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
    this.floor=new CANNON.Body({mass:0,material:surface,shape:new CANNON.Box(new CANNON.Vec3(4,.05,3)),position:new CANNON.Vec3(0,-.05,0)});
    this.table=new CANNON.Body({mass:0,material:surface,shape:new CANNON.Box(new CANNON.Vec3(...DIM.tableHalf)),position:new CANNON.Vec3(...DIM.tableCentre)});
    this.bottle=new CANNON.Body({mass:DIM.mass,material:item,shape:new CANNON.Cylinder(DIM.radius,DIM.radius,DIM.height,24),position:new CANNON.Vec3(...DIM.source),linearDamping:.06,angularDamping:.18});
    this.world.addBody(this.floor);this.world.addBody(this.table);this.world.addBody(this.bottle);
    this.agents=new Map(actors.map((actor,i)=>[actor.id,{actor,id:actor.id,role:i===0?'整理员':i===1?'协助员':'复核员',phase:'idle',phaseTime:0,task:null,result:null,handTarget:null,gripValue:0,stable:0,maxContactError:0,firstContactError:null,history:[],cancelCount:0,generation:0}]));
    this.handBodies=new Map(actors.map(actor=>{const b=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,collisionFilterGroup:0,collisionFilterMask:0,shape:new CANNON.Sphere(.009)});this.world.addBody(b);return[actor.id,b]}));
    this.audit={maxOwners:0,maxGripConstraints:0,contacts:[],tasks:[],poses:[],worldChangedTests:[],cancellations:[],physicsSteps:0};
    this.review={phase:'待观察',checked:false,reason:'尚未发现已释放且稳定的收纳物品'};
    this.window = new WindowInteraction(this);
    this.emit('world-ready',null,{engine:'cannon-es@0.20.0',gravity:9.81,massKg:DIM.mass,assistedGrip:true});
  }
  emit(type,id,data={}){const event={t:+this.time.toFixed(3),type,actor:id,...data};this.events.push(event);if(this.events.length>160)this.events.shift();this.onEvent(event);return event}
  change(a,phase){a.phase=phase;a.phaseTime=0;a.stable=0;a.startHand=a.handTarget?.slice()||this.hand(a);a.history.push(phase);this.emit('phase',a.id,{phase,taskToken:a.task?.token||a.result?.taskToken||null});}
  hand(a){const p=a.actor.handAnchor();return Array.isArray(p)?p.slice():[p.x,p.y,p.z]}
  contactAnchor(){const p=this.bottle.pointToWorldFrame(new CANNON.Vec3(0,DIM.gripHeight,-DIM.radius));return arr(p)}
  targetAnchor(height=0){return offset(this.target,[0,height+DIM.gripHeight,-DIM.radius])}
  request(id,reason='manual'){
    const a=this.agents.get(id);if(!a)throw Error('Unknown actor '+id);
    if(!['idle','done','failed','cancelled'].includes(a.phase)||a.retraction||a.actor.hasRecovery?.()||this.window?.ownsActor(id))return false;
    const serial=++this.nextTask;a.generation++;
    a.result=null;a.retraction=null;a.history=[];a.poseSamplePhase=null;a.withdrawNextPoseAt=.1;a.withdrawEndRecorded=false;a.maxContactError=0;a.firstContactError=null;a.started=this.time;
    a.task={id:'bottle-task-'+serial,taskId:'bottle-task-'+serial,token:id+':bottle:'+serial,generation:a.generation,skill:'place-in-zone',object:'bottle-01',objectId:'bottle-01',reason,targetRevision:this.targetRevision,supportRevision:this.supportRevision,requestedAt:this.time};
    a.gripValue=0;a.handTarget=this.hand(a);this.change(a,'waiting');this.emit('requested',a.id,{...a.task});return true;
  }
  startIdentityPlan(){this.autonomous=true;this.review={phase:'等待整理完成',checked:false,reason:'读取同一物理世界'};this.request(this.actors[0].id,'role:tidier');this.request(this.actors[1].id,'role:helper');this.emit('plan',null,{roles:['整理员负责收纳','协助员等待同物使用权','复核员读取释放/支撑/稳定结果']});}
  acquire(a){if(this.reservedBy&&this.reservedBy!==a.id)return false;this.reservedBy=a.id;this.emit('reserve',a.id,{object:'bottle-01',taskToken:a.task.token});return true}
  attach(a){
    if(this.grip||this.heldBy||this.reservedBy!==a.id)throw Error('Grip invariant violated');
    if(a.actor.configureGrasp && !a.actor.graspReport?.sides?.[a.actor.side]?.admissible)throw Error('Native grasp geometry has not been accepted');
    const palm=this.hand(a),contact=this.contactAnchor(),error=dist(palm,contact);
    if(error>.012)return false; // Geometry measured after current IK. No timer-only latch.
    const body=this.handBodies.get(a.id);body.position.set(...palm);body.quaternion.set(0,0,0,1);body.velocity.set(0,0,0);
    this.grip=new CANNON.LockConstraint(body,this.bottle,{maxForce:24});this.world.addConstraint(this.grip);this.heldBy=a.id;a.firstContactError=error;this.audit.contacts.push({id:a.id,taskToken:a.task.token,errorM:error,time:this.time});this.emit('contact-and-grip',a.id,{taskToken:a.task.token,measuredSurfaceErrorM:error,constraints:1,mode:'finite-force-assisted-grip'});return true;
  }
  release(a,reason){const wasGripped=this.heldBy===a.id||a.gripValue>0;if(this.heldBy===a.id&&this.grip){this.world.removeConstraint(this.grip);this.grip=null;this.heldBy=null;this.bottle.wakeUp();this.lastReleasedTaskToken=a.task?.token||a.result?.taskToken||null;this.invalidateReview('物品已由新的任务释放，等待重新确认稳定结果');this.emit('release',a.id,{reason,taskToken:this.lastReleasedTaskToken,position:arr(this.bottle.position),velocity:arr(this.bottle.velocity)});}a.gripValue=0;if(wasGripped)a.actor.setReach(this.hand(a),0);}
  gripConstraintCount(){return this.grip ? 1 : 0;}
  actorBusy(id){
    const a=this.agents.get(id);
    return !!a && (!['idle','done','failed','cancelled'].includes(a.phase)||!!a.retraction||!!a.actor.hasRecovery?.());
  }
  bottleWithdrawal(a){
    const from=this.hand(a),to=offset(from,[0,DIM.bottleWithdrawLiftM,-DIM.bottleWithdrawMinimumM]);
    // The whole open hand sweeps forward during native rest interpolation.
    // Use the actual table edge and the measured allowance for all three rigs,
    // including mid-lift cancellation and the paired right-hand station.
    this.table.updateAABB();
    const tableRearZ=this.table.aabb.lowerBound.z;
    const safePalmZ=tableRearZ-DIM.bottleWithdrawTableMarginM;
    to[2]=Math.min(to[2],safePalmZ);
    const plan={from,to,tableRearZ,safePalmZ};
    this.emit('bottle-withdrawal-planned',a.id,{...plan,taskToken:a.task?.token||a.result?.taskToken||null});
    return plan;
  }
  beginRecovery(a,{withdraw=true}={}){
    if(withdraw){
      a.retraction={stage:'withdraw',...this.bottleWithdrawal(a),time:0,nextPoseAt:.1};
      this.samplePose(a,'withdraw-start');
    }else if(a.actor.beginRest){
      a.actor.beginRest({duration:.65});
      a.retraction={stage:'rest',time:0,nextPoseAt:.1};
      this.samplePose(a,'rest-start');
    }else{
      a.actor.rest();a.retraction=null;
    }
  }
  updateRecovery(a,dt){
    const r=a.retraction;
    if(!r)return;
    r.time+=dt;
    if(r.stage==='withdraw'){
      this.drive(a,mix(r.from,r.to,r.time/.9),0);
      if(r.time+1e-9>=r.nextPoseAt||r.time>=.9){
        this.samplePose(a,r.time>=.9?'withdraw-end':'withdraw');r.nextPoseAt=r.time+.1;
      }
      if(r.time>=.9){
        this.emit('hand-withdrawn',a.id,{objectUnconstrained:true,taskToken:a.task?.token||a.result?.taskToken||null});
        this.beginRecovery(a,{withdraw:false});
      }
    }else{
      const complete=a.actor.updateRecovery?.(dt) ?? true;
      if(r.time+1e-9>=r.nextPoseAt||complete){
        this.samplePose(a,complete?'rest-end':'rest');r.nextPoseAt=r.time+.1;
      }
      if(complete){
        a.retraction=null;a.handTarget=this.hand(a);a.gripValue=0;
        this.emit('hand-at-rest',a.id,{skill:'place-in-zone',taskToken:a.task?.token||a.result?.taskToken||null,restPoseErrorRad:a.actor.diagnostics?.().restPoseErrorRad??null});
      }
    }
  }
  finish(a,result,detail){
    const priorPhase=a.phase,task=a.task;
    this.release(a,result);
    if(this.reservedBy===a.id)this.reservedBy=null;
    a.result={result,detail,taskId:task?.id,taskToken:task?.token,generation:task?.generation,dependencies:this.resultDependencies(task?.token),duration:this.time-a.started,contactM:a.firstContactError,maxHoldErrorM:a.maxContactError,phases:a.history.slice()};
    this.audit.tasks.push({id:a.id,...a.result});
    if(!['idle','waiting','done','failed','cancelled'].includes(priorPhase)){
      this.beginRecovery(a,{withdraw:!(priorPhase==='verify'&&a.phaseTime>=.9)});
    }
    this.change(a,result==='completed'||result==='already-sorted'?'done':'failed');
    a.task=null;this.emit('task-result',a.id,a.result);
  }
  cancel(id,{expectedTaskToken}={}){
    if(this.window?.ownsActor(id))return this.window.cancel(id,{expectedTaskToken});
    const a=this.agents.get(id);
    if(!a||['idle','done','failed','cancelled'].includes(a.phase))return false;
    if(expectedTaskToken!==undefined&&a.task?.token!==expectedTaskToken)return false;
    const was=a.phase,task=a.task;
    this.release(a,'cancelled');
    if(was!=='waiting')this.beginRecovery(a);
    if(this.reservedBy===id)this.reservedBy=null;
    a.generation++;a.task=null;a.result={result:'cancelled',taskId:task?.id,taskToken:task?.token,generation:task?.generation,dependencies:this.resultDependencies(task?.token),detail:'已移除握持约束与占用；物品继续进行刚体模拟，人物完成撤手回位'};
    a.cancelCount++;this.change(a,'cancelled');
    this.audit.cancellations.push({id,taskToken:task?.token,phase:was,constraints:this.gripConstraintCount(),reservedBy:this.reservedBy,heldBy:this.heldBy});
    this.emit('cancelled',id,{from:was,taskToken:task?.token});return true;
  }
  setSupport(enabled){const changed=this.supportEnabled!==enabled;this.supportEnabled=enabled;this.table.collisionResponse=enabled;this.table.collisionFilterMask=enabled?-1:0;this.bottle.wakeUp();if(changed)this.supportRevision++;this.audit.worldChangedTests.push({test:'support',enabled,time:this.time});this.emit('support-changed',null,{enabled,supportRevision:this.supportRevision});if(changed)this.invalidateReview('支撑状态已改变，需要重新复核',{environmentChanged:true});}
  // Both observation targets leave space for the open hand beside the window handle.
  moveTarget(){this.target=(dist(this.target,DIM.target)<.001?DIM.alternateTarget:DIM.target).slice();this.targetRevision++;this.emit('target-moved',null,{target:this.target.slice(),revision:this.targetRevision});this.invalidateReview('收纳区域已改变，需要重新复核',{environmentChanged:true});}
  reset(){this.window?.reset();for(const a of this.agents.values())this.cancel(a.id);this.reservedBy=this.heldBy=null;this.setSupport(true);this.target=DIM.target.slice();this.targetRevision++;this.bottle.position.set(...DIM.source);this.bottle.quaternion.set(0,0,0,1);this.bottle.velocity.set(0,0,0);this.bottle.angularVelocity.set(0,0,0);this.bottle.force.set(0,0,0);this.bottle.torque.set(0,0,0);this.bottle.wakeUp();for(const a of this.agents.values()){a.actor.rest();a.phase='idle';a.retraction=null;a.task=null;a.result=null;a.handTarget=null;a.gripValue=0;a.generation++;}this.lastReleasedTaskToken=null;this.autonomous=false;this.review={phase:'待观察',checked:false,reason:'新一轮'};this.emit('reset',null,{explicitUserSetup:true});}
  resultDependencies(taskToken=this.lastReleasedTaskToken){return {objectId:'bottle-01',targetRevision:this.targetRevision,supportRevision:this.supportRevision,taskToken:taskToken??null};}
  invalidateReview(reason,{environmentChanged=false}={}){
    const previous=this.review,wasChecked=previous.checked;
    this.review={...previous,checked:false,stable:0,dependencies:null};
    if(wasChecked||(this.autonomous&&environmentChanged)){this.review.phase='需重新复核';this.review.reason=reason;}
    if(wasChecked){this.review.invalidatedDependencies=previous.dependencies||null;this.emit('review-invalidated',this.actors[2]?.id,{worldMeasurements:true,reason,previousDependencies:previous.dependencies||null,dependencies:this.resultDependencies()});}
  }
  updateReview(dt){
    if(!this.autonomous)return;
    const dependencies=this.resultDependencies(),prior=this.review.dependencies;
    if(this.review.checked&&prior&&(prior.targetRevision!==dependencies.targetRevision||prior.supportRevision!==dependencies.supportRevision||prior.taskToken!==dependencies.taskToken))this.invalidateReview('任务或环境版本已改变，需要重新复核');
    if(this.goal()){
      this.review.stable=(this.review.stable||0)+dt;
      if(this.review.stable>.6&&!this.review.checked){this.review={phase:'复核完成',checked:true,reason:'已释放 + 目标区域 + 真实支撑 + 稳定速度',t:this.time,dependencies};this.emit('review-confirmed',this.actors[2]?.id,{worldMeasurements:true,dependencies});}
    }else this.invalidateReview('物品位置、支撑或稳定状态已改变');
  }
  support(){return this.supportEnabled&&this.world.contacts.some(c=>(c.bi===this.bottle&&c.bj===this.table)||(c.bj===this.bottle&&c.bi===this.table));}
  settled(){return this.support()&&this.bottle.velocity.length()<.018&&this.bottle.angularVelocity.length()<.09;}
  inside(){return Math.hypot(this.bottle.position.x-this.target[0],this.bottle.position.z-this.target[2])<.052&&Math.abs(this.bottle.position.y-DIM.height/2-DIM.tableTop)<.012;}
  goal(){return !this.heldBy&&!this.grip&&this.inside()&&this.settled();}
  samplePose(a,stage=a.phase){
    if(!a.actor.diagnostics)return;
    const solidCylinders=[this.window.handleCylinder()];
    const d=a.actor.diagnostics({tableTopY:DIM.tableTop,
      tableBounds:{minX:DIM.tableCentre[0]-DIM.tableHalf[0],maxX:DIM.tableCentre[0]+DIM.tableHalf[0],minZ:DIM.tableCentre[2]-DIM.tableHalf[2],maxZ:DIM.tableCentre[2]+DIM.tableHalf[2]},
      bottle:{position:this.bottle.position,quaternion:this.bottle.quaternion,radius:DIM.radius,height:DIM.height},
      solidBoxes:this.window.solidBoxes(),solidCylinders});
    const keys=['grip01','palm','handErrorM','reachClamped','boneLengthErrorM','footSurfaceErrorM','footWorldYM','fingerAnchors','handTableSampleCount','handTableClearanceM','bottleMaxPenetrationM','bottlePenetratingVertexCount','bottleDeepestPointWorld','restPoseErrorRad','finite','solidMaxPenetrationM','solidMinimumSignedDistanceM','solidSampleCount','solidEvaluationCount','solidDeepest','solidParts','solidByBox','solidByCylinder','solidDiagnosticScope'];
    this.audit.poses.push({id:a.id,operatedObjectId:'bottle-01',taskToken:a.task?.token||a.result?.taskToken||null,taskStartedTime:a.started,phase:a.phase,stage,time:this.time,
      supportEnabled:this.supportEnabled,heldBy:this.heldBy,bottle:arr(this.bottle.position),bottleQuaternion:this.bottle.quaternion.toArray(),solidCylinders,
      ...Object.fromEntries(keys.map(k=>[k,d[k]]))});
    if(this.audit.poses.length>512)this.audit.poses.shift();
  }
  drive(a,target,grip){a.handTarget=target;a.gripValue=grip;a.actor.setReach(target,grip);const p=this.hand(a),body=this.handBodies.get(a.id);body.position.set(...p);body.velocity.set(0,0,0);body.angularVelocity.set(0,0,0);if(!a.retraction&&a.poseSamplePhase!==a.phase){a.poseSamplePhase=a.phase;this.samplePose(a);}return dist(p,target)}
  tick(dt){
    this.time+=dt;this.audit.physicsSteps++;
    for(const a of this.agents.values()){
      if(this.window?.ownsActor(a.id))continue;
      a.phaseTime+=dt;const t=a.phaseTime;
      if(a.retraction){this.updateRecovery(a,dt);continue;}
      if(['idle','done','failed','cancelled'].includes(a.phase))continue;
      if(a.phase==='waiting'){
        if(this.goal()){this.finish(a,'already-sorted','物品已由另一人放稳，无需重复执行');continue;}
        if(this.acquire(a)){
          const target=this.contactAnchor(),reach=a.actor.reachability?.(target);if(reach&&(reach.reachable===false||reach.errorM>.025)){this.finish(a,'unreachable','目标超出当前体型的可达范围');continue;}
          this.change(a,'approach');
        }
        continue;
      }
      if(a.phase==='approach'){
        const goal=this.contactAnchor(),progress=smooth(t/1.4),target=mix(a.startHand,goal,t/1.4);
        // Lift the open native hand over the actual table edge before contact.
        // The arc keeps the original endpoints and zero endpoint velocities.
        target[1]+=DIM.bottleApproachLiftM*4*progress*(1-progress);
        this.drive(a,target,0);
        if(t>=1.4&&dist(this.hand(a),goal)<.012){this.change(a,'close');}
        else if(t>4)this.finish(a,'contact-failed','表皮手掌没有进入接触容差');
      }else if(a.phase==='close'){
        this.drive(a,this.contactAnchor(),clamp(t/.65,0,1));
        if(t>.65&&this.attach(a)){a.liftTarget=offset(this.hand(a),[0,.14,0]);this.change(a,'lift');}
        else if(t>2)this.finish(a,'contact-failed','闭指后接触仍不成立');
      }else if(a.phase==='lift'){
        this.drive(a,mix(a.startHand,a.liftTarget,t/1.5),1);
        if(t>=1.5&&this.bottle.position.y>DIM.source[1]+.105)this.change(a,'transfer');
        else if(t>4)this.finish(a,'lift-failed','有限握持力未将物品抬离桌面');
      }else if(a.phase==='transfer'){
        const target=this.targetAnchor(.14);this.drive(a,mix(a.startHand,target,t/1.6),1);
        if(t>=1.6&&dist(arr(this.bottle.position),offset(this.target,[0,.14,0]))<.028)this.change(a,'lower');
        else if(t>4)this.finish(a,'transfer-failed','物品实际位置未到目标上方');
      }else if(a.phase==='lower'){
        const target=this.targetAnchor(.004);this.drive(a,mix(a.startHand,target,t/1.4),1);
        const error=dist(this.contactAnchor(),this.hand(a));
        if(t>=1.4&&error<.015&&this.bottle.position.y<DIM.tableTop+DIM.height/2+.025){this.samplePose(a,'lower-end');this.release(a,'place');a.retreat=this.bottleWithdrawal(a).to;this.change(a,'verify');this.samplePose(a,'withdraw-start');a.withdrawNextPoseAt=.1;a.withdrawEndRecorded=false;}
        else if(t>4)this.finish(a,'place-failed','物品没有靠近实际放置表面');
      }else if(a.phase==='verify'){
        this.drive(a,mix(a.startHand,a.retreat,t/.9),0);
        if(t>=.9&&!a.withdrawEndRecorded){this.samplePose(a,'withdraw-end');a.withdrawEndRecorded=true;}
        else if(t<.9&&t+1e-9>=a.withdrawNextPoseAt){this.samplePose(a,'withdraw');a.withdrawNextPoseAt=t+.1;}
        a.stable=this.goal()?a.stable+dt:0;
        if(a.stable>.6&&t>=.9)this.finish(a,'completed','已松手；物品在目标区内受到桌面支撑，速度连续低于阈值');
        else if(this.bottle.position.y<.2||t>4)this.finish(a,'world-result-failed',this.supportEnabled?'物品未在目标区域稳定落下':'支撑面已移开，物品下落，任务失败');
      }
      if(this.heldBy===a.id){const error=dist(this.contactAnchor(),this.hand(a));a.maxContactError=Math.max(a.maxContactError,error);if(error>.07)this.finish(a,'grip-broken','握持接触误差超过 7 cm，释放物品');}
    }
    // Cannon 0.20 GSSolver clamps its impulse lambda to equation min/maxForce.
    // Convert N and N*m to step impulses explicitly; otherwise 24 means 2880 N
    // at 120 Hz. Update even on the first attach step and when single-stepping.
    if(this.grip)this.grip.equations.forEach((e,i)=>{
      // Cannon creates generic equations with 1/60s SPOOK coefficients. Use
      // this world's actual step while retaining the same stiffness/relaxation.
      e.setSpookParams(DIM.gripStiffness,DIM.gripRelaxation,dt);
      const impulse=(i<3?DIM.maxGripForcePerAxisN:DIM.maxGripTorquePerAxisNm)*dt;
      e.minForce=-impulse;e.maxForce=impulse;
    });
    this.window?.preStep(dt);
    this.world.step(dt);
    this.window?.postStep(dt);
    this.updateReview(dt);
    this.audit.maxOwners=Math.max(this.audit.maxOwners,this.heldBy?1:0);this.audit.maxGripConstraints=Math.max(this.audit.maxGripConstraints,this.gripConstraintCount());
    if(this.gripConstraintCount()>1||((this.grip===null)!==(this.heldBy===null)))throw Error('Bottle ownership invariant failed');
    if(this.heldBy && this.window?.heldBy===this.heldBy)throw Error('One actor cannot hold two resources');
  }
  snapshot({includeAudit=true}={}){
    const state=detachState({schema:'kaopu/life-world@2',version:'NPC-LIFE-OBSERVATION-R04',
      time:+this.time.toFixed(3),physics:'cannon-es@0.20.0; fixed 1/120s',
      object:{id:'bottle-01',position:arr(this.bottle.position),quaternion:[this.bottle.quaternion.x,this.bottle.quaternion.y,this.bottle.quaternion.z,this.bottle.quaternion.w],massKg:this.bottle.mass,shape:{kind:'cylinder',radiusM:DIM.radius,heightM:DIM.height},velocity:arr(this.bottle.velocity),angularVelocity:arr(this.bottle.angularVelocity),reservedBy:this.reservedBy,heldBy:this.heldBy,constraintCount:this.gripConstraintCount(),supported:this.support(),settled:this.settled(),insideTarget:this.inside(),supportEnabled:this.supportEnabled},
      target:this.target,targetRevision:this.targetRevision,supportRevision:this.supportRevision,
      agents:[...this.agents.values()].map(a=>({id:a.id,role:a.role,phase:a.phase,generation:a.generation,task:a.task,
        recovery:a.retraction?{action:a.retraction.stage==='rest'?'return-to-rest':'withdraw-open-hand',progress:Math.min(1,a.retraction.time/(a.retraction.stage==='rest'?.65:.9))}:null,
        result:a.result,hand:this.hand(a),requested:a.handTarget,grip:a.gripValue,contactErrorM:this.heldBy===a.id?dist(this.hand(a),this.contactAnchor()):null,measurements:a.actor.measurements,identity:a.actor.identity,binding:a.actor.binding?.report})),
      review:this.review,...(includeAudit?{audit:this.audit}:{auditSummary:summarizeAudit(this.audit,this.events.length)}),
      events:includeAudit?this.events:this.events.slice(-10),
      constraints:{structural:this.window?.hinge?1:0,bottleGrip:this.gripConstraintCount(),windowGrip:this.window?.grip?1:0,total:this.world.constraints.length},
      scope:{fullBodyDynamics:false,fingerFrictionSimulation:false,assistedGrip:true,networkMultiplayer:false,roomNavigation:false}});
    state.window=this.window?.snapshot({includeAudit});return state;
  }
}
