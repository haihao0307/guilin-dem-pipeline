import * as CANNON from './vendor/cannon-es.js';

// Dimensions are metres. The visible station is built from these same values.
export const DIM = Object.freeze({ tableTop: .95, tableHalf: [.62, .035, .23], tableCentre: [0, .915, .52], radius: .032, height: .14, gripHeight: .048, mass: .22, maxGripForcePerAxisN:24, maxGripTorquePerAxisNm:.8, source: [0, 1.0208, .37], target: [.10, 1.0208, .44] });
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10)};
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const arr=v=>[v.x,v.y,v.z];
const offset=(p,d)=>p.map((x,i)=>x+d[i]);
const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*smooth(t));

/** Shared authoritative rigid-body world. There is no animation-owned prop pose. */
export class LifeWorld {
  constructor(actors,{onEvent=()=>{}}={}){
    this.actors=actors;this.onEvent=onEvent;this.time=0;this.events=[];this.reservedBy=null;this.heldBy=null;this.grip=null;this.supportEnabled=true;this.target=DIM.target.slice();this.targetRevision=0;this.autonomous=false;
    this.world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.81,0)});
    this.world.solver.iterations=24;this.world.solver.tolerance=1e-7;
    const surface=new CANNON.Material('wood'),item=new CANNON.Material('storage-bottle');
    this.world.addContactMaterial(new CANNON.ContactMaterial(surface,item,{friction:.65,restitution:.01,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
    this.floor=new CANNON.Body({mass:0,material:surface,shape:new CANNON.Box(new CANNON.Vec3(4,.05,3)),position:new CANNON.Vec3(0,-.05,0)});
    this.table=new CANNON.Body({mass:0,material:surface,shape:new CANNON.Box(new CANNON.Vec3(...DIM.tableHalf)),position:new CANNON.Vec3(...DIM.tableCentre)});
    this.bottle=new CANNON.Body({mass:DIM.mass,material:item,shape:new CANNON.Cylinder(DIM.radius,DIM.radius,DIM.height,24),position:new CANNON.Vec3(...DIM.source),linearDamping:.06,angularDamping:.18});
    this.world.addBody(this.floor);this.world.addBody(this.table);this.world.addBody(this.bottle);
    this.agents=new Map(actors.map((actor,i)=>[actor.id,{actor,id:actor.id,role:i===0?'整理员':i===1?'协助员':'复核员',phase:'idle',phaseTime:0,task:null,result:null,handTarget:null,gripValue:0,stable:0,maxContactError:0,firstContactError:null,history:[],cancelCount:0}]));
    this.handBodies=new Map(actors.map(actor=>{const b=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,collisionFilterGroup:0,collisionFilterMask:0,shape:new CANNON.Sphere(.009)});this.world.addBody(b);return[actor.id,b]}));
    this.audit={maxOwners:0,maxGripConstraints:0,contacts:[],tasks:[],worldChangedTests:[],cancellations:[],physicsSteps:0};
    this.review={phase:'待观察',checked:false,reason:'尚未发现已释放且稳定的收纳物品'};
    this.emit('world-ready',null,{engine:'cannon-es@0.20.0',gravity:9.81,massKg:DIM.mass,assistedGrip:true});
  }
  emit(type,id,data={}){const event={t:+this.time.toFixed(3),type,actor:id,...data};this.events.push(event);if(this.events.length>160)this.events.shift();this.onEvent(event);return event}
  change(a,phase){a.phase=phase;a.phaseTime=0;a.stable=0;a.startHand=a.handTarget?.slice()||this.hand(a);a.history.push(phase);this.emit('phase',a.id,{phase});}
  hand(a){const p=a.actor.handAnchor();return Array.isArray(p)?p.slice():[p.x,p.y,p.z]}
  contactAnchor(){const p=this.bottle.pointToWorldFrame(new CANNON.Vec3(0,DIM.gripHeight,-DIM.radius));return arr(p)}
  targetAnchor(height=0){return offset(this.target,[0,height+DIM.gripHeight,-DIM.radius])}
  request(id,reason='manual'){
    const a=this.agents.get(id);if(!a)throw Error('Unknown actor '+id);
    if(!['idle','done','failed','cancelled'].includes(a.phase))return false;
    a.result=null;a.history=[];a.maxContactError=0;a.firstContactError=null;a.started=this.time;a.task={skill:'place-in-zone',object:'bottle-01',reason,targetRevision:this.targetRevision};a.gripValue=0;a.handTarget=this.hand(a);this.change(a,'waiting');return true;
  }
  startIdentityPlan(){this.autonomous=true;this.review={phase:'等待整理完成',checked:false,reason:'读取同一物理世界'};this.request(this.actors[0].id,'role:tidier');this.request(this.actors[1].id,'role:helper');this.emit('plan',null,{roles:['整理员负责收纳','协助员等待同物使用权','复核员读取释放/支撑/稳定结果']});}
  acquire(a){if(this.reservedBy&&this.reservedBy!==a.id)return false;this.reservedBy=a.id;this.emit('reserve',a.id,{object:'bottle-01'});return true}
  attach(a){
    if(this.grip||this.heldBy||this.reservedBy!==a.id)throw Error('Grip invariant violated');
    const palm=this.hand(a),contact=this.contactAnchor(),error=dist(palm,contact);
    if(error>.012)return false; // Geometry measured after current IK. No timer-only latch.
    const body=this.handBodies.get(a.id);body.position.set(...palm);body.quaternion.set(0,0,0,1);body.velocity.set(0,0,0);
    this.grip=new CANNON.LockConstraint(body,this.bottle,{maxForce:24});this.world.addConstraint(this.grip);this.heldBy=a.id;a.firstContactError=error;this.audit.contacts.push({id:a.id,errorM:error,time:this.time});this.emit('contact-and-grip',a.id,{measuredSurfaceErrorM:error,constraints:1,mode:'finite-force-assisted-grip'});return true;
  }
  release(a,reason){if(this.heldBy===a.id&&this.grip){this.world.removeConstraint(this.grip);this.grip=null;this.heldBy=null;this.bottle.wakeUp();this.emit('release',a.id,{reason,position:arr(this.bottle.position),velocity:arr(this.bottle.velocity)});}a.gripValue=0;a.actor.setReach(this.hand(a),0);}
  finish(a,result,detail){this.release(a,result);if(this.reservedBy===a.id)this.reservedBy=null;a.result={result,detail,duration:this.time-a.started,contactM:a.firstContactError,maxHoldErrorM:a.maxContactError,phases:a.history.slice()};this.audit.tasks.push({id:a.id,...a.result});this.change(a,result==='completed'||result==='already-sorted'?'done':'failed');a.task=null;this.emit('task-result',a.id,a.result);}
  cancel(id){const a=this.agents.get(id);if(!a||['idle','done','failed','cancelled'].includes(a.phase))return false;const was=a.phase;this.release(a,'cancelled');if(this.reservedBy===id)this.reservedBy=null;a.task=null;a.result={result:'cancelled',detail:'已移除握持约束与占用；物品继续进行刚体模拟'};a.cancelCount++;this.change(a,'cancelled');this.audit.cancellations.push({id,phase:was,constraints:this.world.constraints.length,reservedBy:this.reservedBy,heldBy:this.heldBy});this.emit('cancelled',id,{from:was});return true}
  setSupport(enabled){this.supportEnabled=enabled;this.table.collisionResponse=enabled;this.table.collisionFilterMask=enabled?-1:0;this.bottle.wakeUp();this.audit.worldChangedTests.push({test:'support',enabled,time:this.time});this.emit('support-changed',null,{enabled});}
  moveTarget(){this.target[0]=this.target[0]>.05?-.12:.12;this.targetRevision++;this.emit('target-moved',null,{target:this.target.slice(),revision:this.targetRevision});}
  reset(){for(const a of this.agents.values())this.cancel(a.id);this.reservedBy=this.heldBy=null;this.setSupport(true);this.target=DIM.target.slice();this.targetRevision++;this.bottle.position.set(...DIM.source);this.bottle.quaternion.set(0,0,0,1);this.bottle.velocity.set(0,0,0);this.bottle.angularVelocity.set(0,0,0);this.bottle.force.set(0,0,0);this.bottle.torque.set(0,0,0);this.bottle.wakeUp();for(const a of this.agents.values()){a.actor.rest();a.phase='idle';a.task=null;a.result=null;a.handTarget=null;a.gripValue=0;}this.autonomous=false;this.review={phase:'待观察',checked:false,reason:'新一轮'};this.emit('reset',null,{explicitUserSetup:true});}
  support(){return this.supportEnabled&&this.world.contacts.some(c=>(c.bi===this.bottle&&c.bj===this.table)||(c.bj===this.bottle&&c.bi===this.table));}
  settled(){return this.support()&&this.bottle.velocity.length()<.018&&this.bottle.angularVelocity.length()<.09;}
  inside(){return Math.hypot(this.bottle.position.x-this.target[0],this.bottle.position.z-this.target[2])<.052&&Math.abs(this.bottle.position.y-DIM.height/2-DIM.tableTop)<.012;}
  goal(){return !this.heldBy&&!this.grip&&this.inside()&&this.settled();}
  drive(a,target,grip){a.handTarget=target;a.gripValue=grip;a.actor.setReach(target,grip);const p=this.hand(a),body=this.handBodies.get(a.id);body.position.set(...p);body.velocity.set(0,0,0);body.angularVelocity.set(0,0,0);return dist(p,target)}
  tick(dt){
    this.time+=dt;this.audit.physicsSteps++;
    for(const a of this.agents.values()){
      a.phaseTime+=dt;const t=a.phaseTime;
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
        const goal=this.contactAnchor();this.drive(a,mix(a.startHand,goal,t/1.4),0);
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
        if(t>=1.4&&error<.015&&this.bottle.position.y<DIM.tableTop+DIM.height/2+.025){this.release(a,'place');a.retreat=offset(this.hand(a),[0,.03,-.14]);this.change(a,'verify');}
        else if(t>4)this.finish(a,'place-failed','物品没有靠近实际放置表面');
      }else if(a.phase==='verify'){
        this.drive(a,mix(a.startHand,a.retreat,t/.9),0);
        a.stable=this.goal()?a.stable+dt:0;
        if(a.stable>.6)this.finish(a,'completed','已松手；物品在目标区内受到桌面支撑，速度连续低于阈值');
        else if(this.bottle.position.y<.2||t>4)this.finish(a,'world-result-failed',this.supportEnabled?'物品未在目标区域稳定落下':'支撑面已移开，物品下落，任务失败');
      }
      if(this.heldBy===a.id){const error=dist(this.contactAnchor(),this.hand(a));a.maxContactError=Math.max(a.maxContactError,error);if(error>.07)this.finish(a,'grip-broken','握持接触误差超过 7 cm，释放物品');}
    }
    // Cannon 0.20 GSSolver clamps its impulse lambda to equation min/maxForce.
    // Convert N and N*m to step impulses explicitly; otherwise 24 means 2880 N
    // at 120 Hz. Update even on the first attach step and when single-stepping.
    if(this.grip)this.grip.equations.forEach((e,i)=>{const impulse=(i<3?DIM.maxGripForcePerAxisN:DIM.maxGripTorquePerAxisNm)*dt;e.minForce=-impulse;e.maxForce=impulse;});
    this.world.step(dt);
    if(this.autonomous){if(this.goal()){this.review.stable=(this.review.stable||0)+dt;if(this.review.stable>.6&&!this.review.checked){this.review={phase:'复核完成',checked:true,reason:'已释放 + 目标区域 + 真实支撑 + 稳定速度',t:this.time};this.emit('review-confirmed',this.actors[2]?.id,{worldMeasurements:true});}}else{const changed=this.review.checked;this.review.stable=0;this.review.checked=false;if(changed){this.review.phase='需重新复核';this.review.reason='物品位置、支撑或稳定状态已改变';this.emit('review-invalidated',this.actors[2]?.id,{worldMeasurements:true});}}}
    this.audit.maxOwners=Math.max(this.audit.maxOwners,this.heldBy?1:0);this.audit.maxGripConstraints=Math.max(this.audit.maxGripConstraints,this.world.constraints.length);
    if(this.world.constraints.length>1||((this.grip===null)!==(this.heldBy===null)))throw Error('Shared ownership invariant failed');
  }
  snapshot(){return{version:'NPC-LIFE-OBSERVATION-R01',time:+this.time.toFixed(3),physics:'cannon-es@0.20.0; fixed 1/120s',object:{id:'bottle-01',position:arr(this.bottle.position),velocity:arr(this.bottle.velocity),angularVelocity:arr(this.bottle.angularVelocity),reservedBy:this.reservedBy,heldBy:this.heldBy,constraintCount:this.world.constraints.length,supported:this.support(),settled:this.settled(),insideTarget:this.inside(),supportEnabled:this.supportEnabled},target:this.target.slice(),agents:[...this.agents.values()].map(a=>({id:a.id,role:a.role,phase:a.phase,result:a.result,hand:this.hand(a),requested:a.handTarget,grip:a.gripValue,contactErrorM:this.heldBy===a.id?dist(this.hand(a),this.contactAnchor()):null,measurements:a.actor.measurements,identity:a.actor.identity,binding:a.actor.binding?.report})),review:this.review,audit:this.audit,events:this.events,scope:{fullBodyDynamics:false,fingerFrictionSimulation:false,assistedGrip:true,networkMultiplayer:false,roomNavigation:false}};}
}
