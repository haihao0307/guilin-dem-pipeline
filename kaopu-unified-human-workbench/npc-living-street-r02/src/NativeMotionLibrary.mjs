/** Adapter for the project's existing R04/R05 native motion workbenches.
 * Actual CMU16_15 capture, full 104-bone retarget, original cyclic support,
 * arm bend-plane calibration and R05 inertial transitions are reused here.
 * Navigation owns world travel; the capture supplies the native gait pose.
 */
import {THREE,RigidPoseSampler} from './NativeBinding.mjs';
import {BasicActions,buildBasicClip} from '../vendor/motion/r04/BasicActions.mjs';
import {ArmContinuity,canonicalSource} from '../vendor/motion/r04/ArmContinuity.mjs';
import {buildCapturedClip} from '../vendor/motion/r04/CapturedCycles.mjs';
import {MotionContinuity} from '../vendor/motion/r05/Continuity.mjs';
import walkSource from '../vendor/motion/r04/16_15-SOURCE.json' with {type:'json'};

const source=canonicalSource(walkSource);
const clone=p=>({q:p.q.slice(),p:p.p.slice()});
const SOURCE_LOCK=Object.freeze({
  motionR04:'4de5f1d420a43355014bc1e6e572dd9c25058eb8',
  continuityR05:'8d0860881f34cd6d459b1099028f56dfc7b70a2c',
  capture:'CMU 16_15',cycleFrames:[174,315],sourceFPS:120,
  mode:'existing complete native pose library + world contact adapter',
  noExternalHumanMesh:true,noWeightsTruncated:true
});

export class NativeMotionLibrary {
  constructor(actor){
    this.actor=actor;this.binding=actor.binding;this.sampler=new RigidPoseSampler(actor.binding.rig);
    this.basic=new BasicActions(actor.binding);this.arms=new ArmContinuity(actor.binding);
    this.continuity=new MotionContinuity(actor.binding);this.mode=null;this.elapsed=0;
    this.previous=null;this.past=null;this.previousDt=1/60;this.lastContacts={L:1,R:1};
    this.lastReport=null;this.ready=false;
  }
  async prepare(notify=()=>{}){
    const started=performance.now();
    const walkRow={id:'walk-loop',kind:'captured',label:'原有连续步行',continuous:true};
    this.walk=await buildCapturedClip(this.binding,walkRow,source,this.sampler,{
      notify,decorate:frame=>this.arms.apply(frame,{gesture:false})
    });
    const review={binding:this.binding,sampler:this.sampler,generation:1,status:notify};
    this.idle=await buildBasicClip(review,{id:'idle',kind:'basic',task:'idle-breathe',label:'原有自然站立',duration:3.6,continuous:true},1);
    this.ready=true;
    this.report={...SOURCE_LOCK,actor:this.actor.id,prepareMS:performance.now()-started,
      nativeBones:this.binding.names.length,sourceVertexCount:this.binding.N,
      walk:{duration:this.walk.duration,frames:this.walk.frames.length,bytes:this.walk.bytes,metrics:this.walk.metrics},
      idle:{duration:this.idle.duration,frames:this.idle.frames.length,metrics:this.idle.metrics},
      limitations:['retargeted captured gait, not a full-body dynamic balance solver','navigation determines world path','shoe/ground contacts verified after assembly']};
    return this;
  }
  sample(mode,{dt,distance=0}={}){
    if(!this.ready)throw Error('Existing native motion library must finish preparation');
    const selected=mode==='walk'?'walk':'idle';
    if(selected!==this.mode){
      const current=this.sampler.pack(this.actor.rig.posedMatrices);
      this.continuity.configure(this[selected],{previous:current,past:this.past||current,
        dt:Math.max(1/120,this.previousDt),contacts:this.lastContacts,rootMode:'in-place',
        method:'inertial',blend:true,support:true});
      this.elapsed=0;this.mode=selected;
    } else {
      const nominal=this.walk.metrics.nominalSpeedMPS;
      // Advancing by actual travelled distance keeps gait speed tied to the
      // navigator, including slow arrivals and waits behind another person.
      this.elapsed+=selected==='walk'?distance/Math.max(.05,nominal):dt;
    }
    const p=this.continuity.sample(this.elapsed),skin=this.sampler.apply(p);
    const contacts=this.continuity.contacts(this[selected],this.elapsed+this.continuity.phase);
    this.lastContacts=contacts;this.previousDt=dt||1/60;
    this.lastReport={source:selected==='walk'?'R04 CMU16_15 cyclic retarget':'R04 BasicActions idle-breathe',
      sourceTime:this.elapsed,contacts,continuity:this.continuity.report(this.elapsed)};
    return {pose:p,skin,world:this.sampler.world,contacts,report:this.lastReport};
  }
  finalPose(){
    this.past=this.previous;this.previous=clone(this.sampler.pack(this.actor.rig.posedMatrices));
  }
  invalidate(){this.mode=null;}
  crouchEnvelope(progress,part='down'){return this.basic.envelope(progress,part);}
  basicPose(crouch=0){
    // The library's recorded crouch envelope supplies timing; the caller may
    // subsequently solve the real prop/seat/feet constraints on this pose.
    const frame=this.basic.pose(crouch>0?'squat-down':'idle',crouch,1),rig=this.basic.arms.rig;
    const root=rig.index.get('root'),m=rig.posedMatrices[root],rest=rig.restP[root];
    rig.rootTranslation=[m[3]-rest[0],m[7]-rest[1],m[11]-rest[2]];
    return {frame,pose:rig.exportNativePose(),rig};
  }
}

export async function prepareActorMotion(actor,notify=()=>{}){
  if(actor.motionLibrary)return actor.motionLibrary;
  actor.motionLibrary=await new NativeMotionLibrary(actor).prepare(notify);
  return actor.motionLibrary;
}
export {SOURCE_LOCK as NATIVE_MOTION_SOURCE};
