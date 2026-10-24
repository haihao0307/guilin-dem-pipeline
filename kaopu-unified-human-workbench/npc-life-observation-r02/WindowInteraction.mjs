import * as CANNON from './vendor/cannon-es.js';

const arr=v=>[v.x,v.y,v.z];
const vec=v=>new CANNON.Vec3(...v);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x,0,1);return x*x*x*(10+x*(-15+6*x));};
const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*smooth(t));
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const scale=(a,s)=>a.map(x=>x*s);
const degrees=x=>x*180/Math.PI;
const quaternion=angle=>new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0,1,0),angle);
const rotated=(q,p)=>arr(q.vmult(vec(p)));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};

const pivot=[.64,1.20,.55],closedAngle=0,openAngle=-35*Math.PI/180;
const leafCentre=[.37,1.4275,.55],handleCentre=[.19,1.20,.44];
const box=(id,position,half,appearance,angle=0)=>({id,kind:'box',position,half,halfExtents:half,quaternion:quaternion(angle).toArray(),appearance,material:appearance});
const openStopPoint=add(pivot,rotated(quaternion(openAngle),[-.50,.49,-.034]));
const blockerPoint=add(pivot,rotated(quaternion(openAngle/2),[-.50,.49,0]));

/** Metres, radians, kilograms, newtons. The visible window reads these same
 * collision descriptors. This is an authored, unlatched utility window with
 * a deliberately thick cylindrical assistive handle, not a standard product. */
export const WINDOW_DIM=freeze({
  id:'window-01',pivot,closedAngle,openAngle,angleRangeDeg:[0,-35],
  leafCentre,leafWidth:.54,leafBottomY:1.075,leafTopY:1.78,leafHeight:.705,
  leafThickness:.036,massKg:1.2,handleCentre,handleRadius:.032,handleHeight:.14,
  radius:.032,height:.14,handleLocal:sub(handleCentre,leafCentre),
  handleAnchorLocal:sub(add(handleCentre,[0,0,-.032]),leafCentre),
  maxGripForcePerAxisN:24,contactToleranceM:.012,maxHandleLeadM:.0012,
  approachPrePositionSeconds:1.15,approachContactEntrySeconds:.65,
  gripBreakDistanceM:.035,targetToleranceRad:2*Math.PI/180,
  releaseToleranceRad:.8*Math.PI/180,settledAngularSpeedRadS:.05,
  stableSeconds:.6,withdrawSeconds:.9,withdrawNormalDistanceM:.12,withdrawVerticalOffsetM:-.10,withdrawTableMarginM:.15,
  restSeconds:.65,swingTimeoutSeconds:15,
  leafParts:[
    box('leaf-left-rail',[-.2525,0,0],[.0175,.3525,.018],'frame'),
    box('leaf-right-rail',[.2525,0,0],[.0175,.3525,.018],'frame'),
    box('leaf-bottom-rail',[0,-.335,0],[.235,.0175,.018],'frame'),
    box('leaf-top-rail',[0,.335,0],[.235,.0175,.018],'frame'),
    box('leaf-pane',[0,0,0],[.235,.3175,.006],'glass'),
    {id:'handle',kind:'cylinder',position:sub(handleCentre,leafCentre),radius:.032,height:.14,segments:24,quaternion:[0,0,0,1],appearance:'handle',material:'handle'},
    box('handle-lower-mount',[-.18,-.2775,-.041],[.011,.010,.037],'handle'),
    box('handle-upper-mount',[-.18,-.1775,-.041],[.011,.010,.037],'handle')
  ],
  staticParts:[
    box('frame-left-post',[.072,1.4275,.55],[.012,.3765,.024],'fixed-frame'),
    box('frame-right-post',[.668,1.4275,.55],[.012,.3765,.024],'fixed-frame'),
    box('frame-sill',[.37,1.051,.55],[.31,.012,.024],'fixed-frame'),
    box('frame-header',[.37,1.804,.55],[.31,.012,.024],'fixed-frame'),
    box('closed-stop',[.14,1.69,.584],[.035,.030,.014],'stop'),
    box('open-stop',openStopPoint,[.035,.030,.014],'stop',openAngle)
  ],
  blocker:box('window-blocker',blockerPoint,[.045,.050,.020],'blocker',openAngle/2),
  assumptions:{assistedPointGrip:true,fingerFriction:false,fullBodyDynamics:false,
    directWindowAnimation:false,hingeMotor:false,standardWindowDimensions:false}
});

const shape=part=>part.kind==='cylinder'
  ?new CANNON.Cylinder(part.radius,part.radius,part.height,part.segments)
  :new CANNON.Box(vec(part.half));
const qFrom=p=>new CANNON.Quaternion(...p);
const terminal=phase=>['idle','done','failed','cancelled'].includes(phase);

/** One contact-driven window resource inside the host's one Cannon world.
 * Only reset() may write the leaf pose; tasks drive a bounded P2P grip. */
export class WindowInteraction {
  constructor(hostLifeWorld){
    this.host=hostLifeWorld;this.world=hostLifeWorld.world;this.reservedBy=null;
    this.heldBy=null;this.grip=null;this.blocked=false;this.revision=0;this.sequence=0;
    this.nextTask=0;this.targetAngle=null;this.events=[];
    this.audit={contacts:[],tasks:[],cancellations:[],obstructions:[],poses:[],maxOwners:0,
      maxGripConstraints:0,maxGripForcePerAxisN:0,maxObstructionForceN:0,physicsSteps:0};
    const material=new CANNON.Material('utility-window'),fixture=new CANNON.Material('window-frame');
    this.world.addContactMaterial(new CANNON.ContactMaterial(material,fixture,
      {friction:.5,restitution:0,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
    this.leaf=new CANNON.Body({mass:WINDOW_DIM.massKg,material,position:vec(WINDOW_DIM.leafCentre),
      linearDamping:.1,angularDamping:.8});
    for(const part of WINDOW_DIM.leafParts)this.leaf.addShape(shape(part),vec(part.position),qFrom(part.quaternion));
    this.world.addBody(this.leaf);
    this.anchorBody=new CANNON.Body({mass:0,position:vec(WINDOW_DIM.pivot)});
    this.world.addBody(this.anchorBody);
    this.hinge=new CANNON.HingeConstraint(this.anchorBody,this.leaf,{pivotA:new CANNON.Vec3(),
      pivotB:vec(sub(WINDOW_DIM.pivot,WINDOW_DIM.leafCentre)),axisA:new CANNON.Vec3(0,1,0),
      axisB:new CANNON.Vec3(0,1,0),maxForce:1e6,collideConnected:false});
    this.world.addConstraint(this.hinge);
    this.staticBodies=WINDOW_DIM.staticParts.map(part=>{
      const body=new CANNON.Body({mass:0,material:fixture,shape:shape(part),position:vec(part.position),quaternion:qFrom(part.quaternion)});
      body.windowPartId=part.id;this.world.addBody(body);return body;
    });
    const bp=WINDOW_DIM.blocker;
    this.blocker=new CANNON.Body({mass:0,material:fixture,shape:shape(bp),position:vec(bp.position),
      quaternion:qFrom(bp.quaternion),collisionResponse:false,collisionFilterMask:0});
    this.blocker.windowPartId=bp.id;this.world.addBody(this.blocker);
    this.agents=new Map(this.host.actors.map(actor=>[actor.id,{id:actor.id,actor,side:'L',phase:'idle',
      phaseTime:0,task:null,result:null,recovery:null,handTarget:null,gripValue:0,stable:0,
      generation:0,history:[],maxContactErrorM:0,firstContactErrorM:null,usedHand:false,approach:null}]));
    this.emit('ready',null,{hingeCount:1,assistedPointGrip:true,maxGripForcePerAxisN:24});
  }
  emit(type,id,data={}){
    const event={type:'window-'+type,actor:id,time:this.host.time,windowEventSeq:++this.sequence,
      windowRevision:this.revision,object:'window-01',...data};
    this.events.push(event);if(this.events.length>160)this.events.shift();
    this.host.emit(event.type,id,{...data,object:'window-01',windowEventSeq:event.windowEventSeq,windowRevision:this.revision});
    return event;
  }
  change(a,phase){a.phase=phase;a.phaseTime=0;a.stable=0;a.history.push(phase);this.revision++;
    this.emit('phase',a.id,{phase,taskToken:a.task?.token||a.result?.taskToken||null});}
  angle(){const axis=this.leaf.quaternion.vmult(new CANNON.Vec3(1,0,0));return Math.atan2(-axis.z,axis.x);}
  angularSpeed(){return this.leaf.angularVelocity.dot(new CANNON.Vec3(0,1,0));}
  handleCenter(){return arr(this.leaf.pointToWorldFrame(vec(WINDOW_DIM.handleLocal)));}
  handleCylinder(){
    const i=WINDOW_DIM.leafParts.findIndex(part=>part.id==='handle');
    return {id:'window-handle-01',position:arr(this.leaf.pointToWorldFrame(this.leaf.shapeOffsets[i])),
      quaternion:this.leaf.quaternion.mult(this.leaf.shapeOrientations[i]).toArray(),
      radius:WINDOW_DIM.handleRadius,height:WINDOW_DIM.handleHeight};
  }
  otherCylinders(){
    // A controller-only host may contain no bottle. An empty list means there
    // is no such body in that world; production reads its actual collision shape.
    const body=this.host.bottle;if(!body)return [];
    const i=body.shapes.findIndex(s=>s.type===CANNON.Shape.types.CYLINDER),s=body.shapes[i];
    if(!s||s.radiusTop!==s.radiusBottom)throw Error('Window obstacle diagnostics require the actual equal-radius bottle cylinder');
    return [{id:'bottle-01',position:arr(body.pointToWorldFrame(body.shapeOffsets[i])),
      quaternion:body.quaternion.mult(body.shapeOrientations[i]).toArray(),radius:s.radiusTop,height:s.height}];
  }
  handleAnchor(){return arr(this.leaf.pointToWorldFrame(vec(WINDOW_DIM.handleAnchorLocal)));}
  frame(side='L'){return {palm:rotated(this.leaf.quaternion,[0,0,1]),
    forward:rotated(this.leaf.quaternion,[side==='L'?1:-1,0,0]),
    quaternion:this.leaf.quaternion.toArray(),angleRad:this.angle()};}
  pose(){return {position:arr(this.leaf.position),quaternion:this.leaf.quaternion.toArray()};}
  solidBoxes(){
    const result=[];
    const include=(body,parts)=>body.shapes.forEach((s,i)=>{
      if(s.type!==CANNON.Shape.types.BOX)return;
      const q=body.quaternion.mult(body.shapeOrientations[i]);
      result.push({id:parts?.[i]?.id||body.windowPartId||'table',
        position:arr(body.pointToWorldFrame(body.shapeOffsets[i])),quaternion:q.toArray(),halfExtents:arr(s.halfExtents)});
    });
    include(this.leaf,WINDOW_DIM.leafParts);for(const body of this.staticBodies)include(body);
    if(this.blocked)include(this.blocker);
    if(this.host.table&&this.host.supportEnabled!==false&&this.host.table.collisionResponse!==false)
      include(this.host.table,[{id:'table-top'}]);
    return result;
  }
  hand(a){const p=a.actor.handAnchor(a.side);return Array.isArray(p)?p.slice():arr(p);}
  ownsActor(id){const a=this.agents.get(id);return !!a&&(!terminal(a.phase)||!!a.recovery);}
  busy(){return [...this.agents.values()].some(a=>this.ownsActor(a.id));}
  goal(angle){return !this.grip&&!this.heldBy&&Math.abs(this.angle()-angle)<WINDOW_DIM.targetToleranceRad
    &&Math.abs(this.angularSpeed())<WINDOW_DIM.settledAngularSpeedRadS;}
  request(id,operation,reason='manual'){
    if(!['open','close'].includes(operation))throw Error('Window operation must be open or close');
    const a=this.agents.get(id);if(!a)throw Error('Unknown window actor '+id);
    if(this.ownsActor(id)||this.host.actorBusy?.(id))return false;
    const serial=++this.nextTask;a.side=a.actor.side||'L';a.generation++;a.result=null;a.recovery=null;a.handTarget=null;a.approach=null;
    a.gripValue=0;a.history=[];a.maxContactErrorM=0;a.firstContactErrorM=null;a.usedHand=false;
    a.started=this.host.time;a.stuckSeconds=0;a.obstructionSeconds=0;
    a.task={id:'window-task-'+serial,taskId:'window-task-'+serial,token:id+':window:'+serial,
      generation:a.generation,operation,skill:'set-window-angle',objectId:'window-01',reason,
      targetAngleRad:operation==='open'?WINDOW_DIM.openAngle:WINDOW_DIM.closedAngle,
      requestedRevision:this.revision,requestedAt:this.host.time};
    this.change(a,'waiting');this.emit('requested',id,{...a.task});return true;
  }
  acquire(a){if(this.reservedBy&&this.reservedBy!==a.id)return false;a.side=a.actor.side||'L';
    this.reservedBy=a.id;this.targetAngle=a.task.targetAngleRad;this.revision++;
    this.emit('reserved',a.id,{taskToken:a.task.token,operation:a.task.operation});return true;}
  syncHandBody(a){
    const palm=this.hand(a),body=this.host.handBodies.get(a.id);
    body.position.set(...palm);body.velocity.set(0,0,0);body.angularVelocity.set(0,0,0);
    return palm;
  }
  drive(a,target,grip,frame=this.frame(a.side)){
    a.handTarget=target.slice();a.gripValue=grip;a.usedHand=true;
    a.actor.setReach(target,grip,a.side,frame);
    const palm=this.syncHandBody(a);
    return distance(palm,target);
  }
  beginApproach(a){
    const anchor=this.handleAnchor(),frame=this.frame(a.side);
    if(!(frame.palm[2]>0))throw Error('Window approach requires a +Z-facing palm in this fixed work station');
    // Enter along the already measured withdrawal path in reverse. The low
    // pose clears the rail; local quaternion motion reaches it from native rest.
    let normalDistanceM=WINDOW_DIM.withdrawNormalDistanceM,tableRearZ=null,safePalmZ=null;
    if(this.host.table){this.host.table.updateAABB();tableRearZ=this.host.table.aabb.lowerBound.z;
      safePalmZ=tableRearZ-WINDOW_DIM.withdrawTableMarginM;
      normalDistanceM=Math.max(normalDistanceM,(anchor[2]-safePalmZ)/frame.palm[2]);}
    const preTarget=add(add(anchor,scale(frame.palm,-normalDistanceM)),[0,WINDOW_DIM.withdrawVerticalOffsetM,0]);
    const reach=a.actor.reachability?.(preTarget,a.side,frame);
    if(reach&&(reach.reachable===false||reach.errorM>.00035)){
      this.finish(a,'unreachable','安全接近姿态超出当前完整人物手臂可达范围');return;
    }
    a.approach={segment:'native-pose-transition',elapsed:0,preTarget,frame,normalDistanceM,tableRearZ,safePalmZ,
      prePositionSeconds:WINDOW_DIM.approachPrePositionSeconds,contactEntrySeconds:WINDOW_DIM.approachContactEntrySeconds,
      entryStart:null,entryFrom:null,nextPoseAt:.1};
    this.change(a,'approach');a.usedHand=true;a.handTarget=null;a.gripValue=0;
    a.actor.beginReachTransition(preTarget,{duration:WINDOW_DIM.approachPrePositionSeconds,side:a.side,frame});
    this.syncHandBody(a);this.samplePose(a,'approach-start');
  }
  approachState(a){const p=a.approach;if(!p||a.phase!=='approach')return null;
    return {segment:p.segment,elapsed:p.elapsed,prePositionSeconds:p.prePositionSeconds,contactEntrySeconds:p.contactEntrySeconds,
      normalDistanceM:p.normalDistanceM,tableRearZ:p.tableRearZ,safePalmZ:p.safePalmZ,preTarget:p.preTarget.slice(),
      entryStart:p.entryStart,entryFrom:p.entryFrom?.slice()??null,requestedPalm:a.handTarget?.slice()??null};
  }
  geometry(a){if(!a.actor.diagnostics)return {nativeGeometryMeasured:false};
    const operated=this.handleCylinder(),solidCylinders=this.otherCylinders();
    const d=a.actor.diagnostics({bottle:operated,solidBoxes:this.solidBoxes(),solidCylinders});
    return {nativeGeometryMeasured:true,operatedObjectId:operated.id,solidCylinders,handErrorM:d.handErrorM,reachClamped:d.reachClamped,
      boneLengthErrorM:d.boneLengthErrorM,footSurfaceErrorM:d.footSurfaceErrorM,footWorldYM:d.footWorldYM,
      maxHandlePenetrationM:d.bottleMaxPenetrationM,penetratingVertexCount:d.bottlePenetratingVertexCount,
      graspAdmissible:d.graspAdmissible,restPoseErrorRad:d.restPoseErrorRad,finite:d.finite,
      solidMaxPenetrationM:d.solidMaxPenetrationM,solidSampleCount:d.solidSampleCount,
      solidDeepest:d.solidDeepest,solidParts:d.solidParts,solidByBox:d.solidByBox,solidByCylinder:d.solidByCylinder};
  }
  samplePose(a,stage,measured=null){
    if(!a.actor.diagnostics)return;
    const record={id:a.id,taskToken:a.task?.token||a.result?.taskToken||null,
      operation:a.task?.operation||a.result?.operation||null,phase:a.phase,stage,time:this.host.time,physicsStep:this.audit.physicsSteps,
      approach:this.approachState(a),
      angleDeg:degrees(this.angle()),quaternion:this.leaf.quaternion.toArray(),handleAnchor:this.handleAnchor(),
      palm:this.hand(a),contactErrorM:distance(this.hand(a),this.handleAnchor()),grip:a.gripValue,
      heldBy:this.heldBy,gripConstraintCount:this.grip?1:0,hingeConstraintCount:this.world.constraints.includes(this.hinge)?1:0,
      recovery:a.recovery?{phase:a.recovery.phase,elapsed:a.recovery.time,
        mode:a.recovery.mode,noContact:a.recovery.noContact,sourcePhase:a.recovery.sourcePhase,reason:a.recovery.reason,
        normalDistanceM:a.recovery.normalDistanceM,tableRearZ:a.recovery.tableRearZ,safePalmZ:a.recovery.safePalmZ,
        progress:Math.min(1,a.recovery.time/(a.recovery.phase==='withdraw'?WINDOW_DIM.withdrawSeconds:WINDOW_DIM.restSeconds))}:null,
      ...(measured||this.geometry(a))};
    this.audit.poses.push(record);if(this.audit.poses.length>256)this.audit.poses.shift();
  }
  attach(a){
    if(this.grip||this.heldBy||this.reservedBy!==a.id)throw Error('Window interaction ownership invariant violated');
    if(a.actor.configureGrasp&&!a.actor.graspReport?.sides?.[a.side]?.admissible)
      throw Error('Native window handle grasp calibration has not been accepted');
    const palm=this.hand(a),handle=this.handleAnchor(),error=distance(palm,handle);
    if(error>WINDOW_DIM.contactToleranceM)return false;
    const body=this.host.handBodies.get(a.id);body.position.set(...palm);body.velocity.set(0,0,0);
    this.grip=new CANNON.PointToPointConstraint(body,new CANNON.Vec3(),this.leaf,
      vec(WINDOW_DIM.handleAnchorLocal),WINDOW_DIM.maxGripForcePerAxisN);
    for(const e of this.grip.equations)e.setSpookParams(1e8,2,1/120);
    this.world.addConstraint(this.grip);this.heldBy=a.id;a.firstContactErrorM=error;
    const evidence={id:a.id,taskToken:a.task.token,operation:a.task.operation,time:this.host.time,
      palm,handleAnchor:handle,errorM:error,angleDeg:degrees(this.angle()),...this.geometry(a)};
    this.audit.contacts.push(evidence);a.lastPoseAngle=this.angle();this.samplePose(a,'contact',evidence);this.revision++;
    this.emit('contact-and-grip',a.id,{...evidence,mode:'finite-force-assisted-point-grip',gripConstraintCount:1,hingeConstraintCount:1});
    return true;
  }
  release(a,reason,dropReservation=false){
    if(this.heldBy===a.id&&this.grip){this.world.removeConstraint(this.grip);this.grip=null;this.heldBy=null;
      this.samplePose(a,'release');
      this.leaf.wakeUp();this.revision++;this.emit('released',a.id,{reason,taskToken:a.task?.token||a.result?.taskToken,
        angleDeg:degrees(this.angle()),angularVelocityRadS:this.angularSpeed(),gripConstraintCount:0,hingeConstraintCount:1});}
    a.gripValue=0;if(dropReservation&&this.reservedBy===a.id){this.reservedBy=null;this.revision++;}
  }
  beginWithdrawal(a){
    if(!a.usedHand)return;
    const from=this.hand(a),frame=this.frame(a.side);
    if(!(frame.palm[2]>0))throw Error('Window withdrawal requires a +Z-facing palm in this fixed work station');
    let normalDistanceM=WINDOW_DIM.withdrawNormalDistanceM,tableRearZ=null,safePalmZ=null;
    const table=this.host.table;
    if(table){
      // The existing table also defines this fixed station's safety plane when
      // support is disabled; solidBoxes() still excludes its disabled collider.
      table.updateAABB();tableRearZ=table.aabb.lowerBound.z;
      safePalmZ=tableRearZ-WINDOW_DIM.withdrawTableMarginM;
    }
    const noContact=a.firstContactErrorM===null,sourcePhase=a.result?.sourcePhase,reason=a.result?.result;
    if(noContact&&safePalmZ!==null&&from[2]<=safePalmZ){
      // An early approach may already be behind the safe plane. Another down
      // and back Cartesian reach can be unreachable; return from its real pose.
      a.handTarget=null;
      a.recovery={phase:'rest',mode:'direct-rest-no-contact',noContact,sourcePhase,reason,
        time:0,nextPoseAt:.1,from,to:null,frame,normalDistanceM:0,tableRearZ,safePalmZ};
      a.actor.beginRest({duration:WINDOW_DIM.restSeconds});
      this.emit('direct-rest',a.id,{taskToken:a.result?.taskToken,mode:a.recovery.mode,
        noContact,sourcePhase,reason,from,target:null,targetKind:'native-rest-pose',tableRearZ,safePalmZ});
      this.samplePose(a,'rest-start');return;
    }
    if(table&&this.host.supportEnabled!==false&&table.collisionResponse!==false){
      normalDistanceM=Math.max(normalDistanceM,(from[2]-safePalmZ)/frame.palm[2]);
    }
    const to=add(add(from,scale(frame.palm,-normalDistanceM)),[0,WINDOW_DIM.withdrawVerticalOffsetM,0]);
    if(!to.every(Number.isFinite))throw Error('Window withdrawal produced a non-finite environment-derived exit');
    a.recovery={phase:'withdraw',mode:'withdraw-then-rest',noContact,sourcePhase,reason,
      time:0,nextPoseAt:.1,from,to,frame,normalDistanceM,tableRearZ,safePalmZ};
    this.emit('withdrawal-planned',a.id,{taskToken:a.result?.taskToken,from,to,normalDistanceM,tableRearZ,safePalmZ});
    this.drive(a,from,0,frame);this.samplePose(a,'withdraw-start');
  }
  recover(a,dt){
    const r=a.recovery;if(!r)return;
    if(r.phase==='withdraw'){
      r.time+=dt;this.drive(a,mix(r.from,r.to,r.time/WINDOW_DIM.withdrawSeconds),0,r.frame);
      if(r.time+1e-10>=r.nextPoseAt&&r.time+1e-10<WINDOW_DIM.withdrawSeconds){
        this.samplePose(a,'withdraw-transition');r.nextPoseAt+=.1;
      }
      if(r.time+1e-10>=WINDOW_DIM.withdrawSeconds){
        this.samplePose(a,'withdraw-end');
        this.emit('hand-withdrawn',a.id,{taskToken:a.result?.taskToken,withdrawSeconds:r.time,
          clearanceM:distance(this.hand(a),this.handleAnchor()),gripConstraintCount:this.grip?1:0,
          thisActorHasGrip:this.heldBy===a.id});
        if(a.actor.beginRest){a.actor.beginRest({duration:WINDOW_DIM.restSeconds});r.phase='rest';r.time=0;r.nextPoseAt=.1;this.samplePose(a,'rest-start');}
        else {a.actor.rest?.();a.recovery=null;this.emit('restored',a.id,{nativeRecoveryImplemented:false});}
      }
    }else{
      r.time+=dt;const done=a.actor.updateRecovery?.(dt);
      if(r.time+1e-10>=r.nextPoseAt&&!done){this.samplePose(a,'rest-transition');r.nextPoseAt+=.1;}
      if(done||a.actor.hasRecovery?.()===false){a.recovery=null;this.samplePose(a,'rest');
        this.emit('restored',a.id,{taskToken:a.result?.taskToken,mode:r.mode,noContact:r.noContact,
          sourcePhase:r.sourcePhase,reason:r.reason,nativeRecoveryImplemented:true,...this.geometry(a)});}
    }
  }
  finish(a,result,detail){
    const task=a.task,sourcePhase=a.phase;if(!task)return;
    this.release(a,result,true);
    a.result={result,detail,operation:task.operation,taskId:task.id,taskToken:task.token,
      targetAngleDeg:degrees(task.targetAngleRad),actualAngleDeg:degrees(this.angle()),
      angularVelocityRadS:this.angularSpeed(),settleSeconds:a.stable||0,duration:this.host.time-a.started,
      firstContactErrorM:a.firstContactErrorM,maxContactErrorM:a.maxContactErrorM,sourcePhase,
      released:true,gripConstraintCount:0,hingeConstraintCount:this.world.constraints.includes(this.hinge)?1:0,
      phases:a.history.slice(),windowRevision:this.revision};
    this.audit.tasks.push({id:a.id,...a.result});a.task=null;
    this.change(a,['completed','already-at-target'].includes(result)?'done':'failed');
    this.beginWithdrawal(a);this.emit('task-result',a.id,a.result);
  }
  cancel(id){
    const a=this.agents.get(id);if(!a||terminal(a.phase))return false;
    const task=a.task,from=a.phase;this.release(a,'cancelled',true);a.generation++;
    a.result={result:'cancelled',detail:'辅助点约束和预约已移除；铰链与刚体运动继续',operation:task?.operation,
      taskId:task?.id,taskToken:task?.token,actualAngleDeg:degrees(this.angle()),angularVelocityRadS:this.angularSpeed(),
      firstContactErrorM:a.firstContactErrorM,sourcePhase:from,
      gripConstraintCount:0,hingeConstraintCount:this.world.constraints.includes(this.hinge)?1:0};
    a.task=null;this.change(a,'cancelled');this.beginWithdrawal(a);
    const evidence={id,from,time:this.host.time,...a.result,reservedBy:this.reservedBy,heldBy:this.heldBy};
    this.audit.cancellations.push(evidence);this.emit('cancelled',id,evidence);return true;
  }
  setBlocked(enabled){
    this.blocked=!!enabled;this.blocker.collisionResponse=this.blocked;this.blocker.collisionFilterMask=this.blocked?-1:0;
    this.leaf.wakeUp();this.revision++;this.emit('blocker-changed',null,{enabled:this.blocked,
      blockerId:WINDOW_DIM.blocker.id,bodyId:this.blocker.id,position:arr(this.blocker.position),physicalCollider:true});
  }
  reset(){
    for(const a of this.agents.values())this.cancel(a.id);
    if(this.grip){this.world.removeConstraint(this.grip);this.grip=null;}
    this.reservedBy=this.heldBy=null;this.targetAngle=null;this.setBlocked(false);
    this.leaf.position.set(...WINDOW_DIM.leafCentre);this.leaf.quaternion.set(0,0,0,1);
    this.leaf.velocity.set(0,0,0);this.leaf.angularVelocity.set(0,0,0);this.leaf.force.set(0,0,0);this.leaf.torque.set(0,0,0);
    this.leaf.aabbNeedsUpdate=true;this.leaf.wakeUp();
    for(const a of this.agents.values()){a.actor.rest?.();a.phase='idle';a.phaseTime=0;a.task=null;a.result=null;
      a.recovery=null;a.handTarget=null;a.gripValue=0;a.usedHand=false;a.approach=null;}
    this.revision++;this.emit('reset',null,{explicitUserSetup:true,hingeConstraintCount:1});
  }
  preStep(dt){
    for(const a of this.agents.values()){
      if(a.recovery){this.recover(a,dt);continue;}
      if(terminal(a.phase))continue;a.phaseTime+=dt;const t=a.phaseTime;
      if(a.phase==='waiting'){
        if(!this.acquire(a))continue;
        if(this.goal(a.task.targetAngleRad)){a.noInteraction=true;this.change(a,'verify');continue;}
        const frame=this.frame(a.side),reach=a.actor.reachability?.(this.handleAnchor(),a.side,frame);
        if(reach&&(reach.reachable===false||reach.errorM>.025)){this.finish(a,'unreachable','把手超出当前完整人物手臂可达范围');continue;}
        a.noInteraction=false;this.beginApproach(a);
      }else if(a.phase==='approach'){
        const p=a.approach;p.elapsed=t;
        if(p.segment==='native-pose-transition'){
          const complete=a.actor.updateReachTransition(dt);a.handTarget=null;this.syncHandBody(a);
          if(complete){p.segment='contact-entry';p.entryStart=t;p.entryFrom=this.hand(a);
            this.samplePose(a,'approach-transition');p.nextPoseAt=t+.1;}
        }else this.drive(a,mix(p.entryFrom,this.handleAnchor(),(t-p.entryStart)/WINDOW_DIM.approachContactEntrySeconds),0);
        if(p.entryStart!==null&&t-p.entryStart+1e-10>=WINDOW_DIM.approachContactEntrySeconds&&
          distance(this.hand(a),this.handleAnchor())<=WINDOW_DIM.contactToleranceM){
          this.samplePose(a,'approach-end');this.change(a,'close-grip');
        }else if(t>4)this.finish(a,'contact-failed','真实掌面未到达把手接触门槛');
        else if(t+1e-10>=p.nextPoseAt){this.samplePose(a,'approach-transition');p.nextPoseAt=t+.1;}
      }else if(a.phase==='close-grip'){
        this.drive(a,this.handleAnchor(),clamp(t/.65,0,1));
        if(t>=.65&&this.attach(a)){a.startAngle=this.angle();a.stuckReference=this.angle();a.stuckSeconds=0;a.obstructionSeconds=0;this.change(a,'swing');}
        else if(t>2)this.finish(a,'contact-failed','闭指后仍未建立实际把手接触');
      }else if(a.phase==='swing'){
        const actual=this.angle(),planned=a.startAngle+(a.task.targetAngleRad-a.startAngle)*smooth(t/3.4);
        const lever=Math.hypot(WINDOW_DIM.handleAnchorLocal[0]-.27,WINDOW_DIM.handleAnchorLocal[2]);
        const lead=WINDOW_DIM.maxHandleLeadM/lever;
        const commanded=clamp(planned,actual-lead,actual+lead);
        const target=add(WINDOW_DIM.pivot,rotated(quaternion(commanded),
          sub(add(WINDOW_DIM.handleCentre,[0,0,-WINDOW_DIM.handleRadius]),WINDOW_DIM.pivot)));
        this.drive(a,target,1);
        if(t>WINDOW_DIM.swingTimeoutSeconds)this.finish(a,'motion-failed','有限辅助力未在时限内达到真实目标角度');
      }
    }
    if(this.grip)for(const e of this.grip.equations){const impulse=WINDOW_DIM.maxGripForcePerAxisN*dt;
      e.minForce=-impulse;e.maxForce=impulse;e.setSpookParams(1e8,2,dt);}
  }
  obstruction(){const contacts=this.blocked?this.world.contacts.filter(c=>c.enabled!==false&&
    ((c.bi===this.leaf&&c.bj===this.blocker)||(c.bj===this.leaf&&c.bi===this.blocker))):[];
    return {contactCount:contacts.length,forceN:contacts.reduce((n,c)=>n+Math.max(0,c.multiplier||0),0),
      bodyId:this.blocker.id,blockerId:WINDOW_DIM.blocker.id};}
  postStep(dt){
    this.audit.physicsSteps++;const obstruction=this.obstruction();
    this.audit.maxObstructionForceN=Math.max(this.audit.maxObstructionForceN,obstruction.forceN);
    const gripForce=this.grip?this.grip.equations.map(e=>e.multiplier||0):[0,0,0];
    this.audit.maxGripForcePerAxisN=Math.max(this.audit.maxGripForcePerAxisN,...gripForce.map(Math.abs));
    for(const a of this.agents.values()){
      if(a.phase==='swing'&&a.task){
        if(Math.abs(this.angle()-a.lastPoseAngle)>=5*Math.PI/180){this.samplePose(a,'swing');a.lastPoseAngle=this.angle();}
        const error=distance(this.hand(a),this.handleAnchor());a.maxContactErrorM=Math.max(a.maxContactErrorM,error);
        if(error>WINDOW_DIM.gripBreakDistanceM){this.finish(a,'grip-broken','实际手掌与把手分离，已释放辅助点约束');continue;}
        if(Math.abs(this.angle()-a.stuckReference)>.004){a.stuckReference=this.angle();a.stuckSeconds=0;}else a.stuckSeconds+=dt;
        a.obstructionSeconds=obstruction.contactCount?a.obstructionSeconds+dt:0;
        if(a.obstructionSeconds>.65&&a.stuckSeconds>.65&&Math.abs(this.angle()-a.task.targetAngleRad)>WINDOW_DIM.targetToleranceRad){
          const evidence={id:a.id,time:this.host.time,taskToken:a.task.token,angleDeg:degrees(this.angle()),
            targetAngleDeg:degrees(a.task.targetAngleRad),stuckSeconds:a.stuckSeconds,
            contactSeconds:a.obstructionSeconds,...obstruction,forcePerAxisN:gripForce.slice()};
          this.audit.obstructions.push(evidence);this.emit('obstructed',a.id,evidence);
          this.finish(a,'blocked','真实挡块接触持续阻止窗扇转到目标角度');continue;
        }
        if(Math.abs(this.angle()-a.task.targetAngleRad)<WINDOW_DIM.releaseToleranceRad&&
          Math.abs(this.angularSpeed())<WINDOW_DIM.settledAngularSpeedRadS){
          this.release(a,'goal-angle-reached');this.drive(a,this.hand(a),0);this.change(a,'verify');
        }
      }else if(a.phase==='verify'&&a.task){
        a.stable=this.goal(a.task.targetAngleRad)?a.stable+dt:0;
        if(a.stable>=WINDOW_DIM.stableSeconds)this.finish(a,a.noInteraction?'already-at-target':'completed',
          '已移除手部约束；实际目标角度与低角速度连续通过验证');
        else if(a.phaseTime>4)this.finish(a,'world-result-failed','松手后真实窗扇未在目标角度稳定');
      }
    }
    const grips=this.grip&&this.world.constraints.includes(this.grip)?1:0;
    this.audit.maxOwners=Math.max(this.audit.maxOwners,this.heldBy?1:0);
    this.audit.maxGripConstraints=Math.max(this.audit.maxGripConstraints,grips);
    if(grips>1||((this.grip===null)!==(this.heldBy===null))||!this.world.constraints.includes(this.hinge))
      throw Error('Window grip/hinge invariant violated');
  }
  snapshot(){const angle=this.angle(),obstruction=this.obstruction();
    return {schema:'kaopu/window-interaction@1',revision:this.revision,sequence:this.sequence,
      object:{id:'window-01',angleDeg:degrees(angle),angleRad:angle,angularVelocityRadS:this.angularSpeed(),
        position:arr(this.leaf.position),quaternion:this.leaf.quaternion.toArray(),reservedBy:this.reservedBy,heldBy:this.heldBy,
        gripConstraintCount:this.grip?1:0,hingeConstraintCount:this.world.constraints.includes(this.hinge)?1:0,
        blocked:this.blocked,obstruction,goalOpen:this.goal(WINDOW_DIM.openAngle),goalClosed:this.goal(WINDOW_DIM.closedAngle),
        targetAngleDeg:this.targetAngle===null?null:degrees(this.targetAngle),
        settled:Math.abs(this.angularSpeed())<WINDOW_DIM.settledAngularSpeedRadS,
        handleCentre:this.handleCenter(),handleAnchor:this.handleAnchor(),
        forcePerAxisN:this.grip?this.grip.equations.map(e=>e.multiplier||0):[0,0,0],
        maxGripForcePerAxisN:WINDOW_DIM.maxGripForcePerAxisN},
      agents:[...this.agents.values()].map(a=>({id:a.id,side:a.side,phase:a.phase,task:a.task,result:a.result,
        approach:this.approachState(a),
        recovery:a.recovery?{phase:a.recovery.phase,normalDistanceM:a.recovery.normalDistanceM,tableRearZ:a.recovery.tableRearZ,
          mode:a.recovery.mode,noContact:a.recovery.noContact,sourcePhase:a.recovery.sourcePhase,reason:a.recovery.reason,
          safePalmZ:a.recovery.safePalmZ,target:a.recovery.to?.slice()??null,
          progress:Math.min(1,a.recovery.time/(a.recovery.phase==='withdraw'?WINDOW_DIM.withdrawSeconds:WINDOW_DIM.restSeconds))}:null,
        hand:this.hand(a),requested:a.handTarget,grip:a.gripValue,contactErrorM:this.heldBy===a.id?distance(this.hand(a),this.handleAnchor()):null})),
      audit:this.audit,events:this.events,scope:WINDOW_DIM.assumptions};
  }
}
