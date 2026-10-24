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
import pickupSource from '../vendor/motion/r04/115_06-SOURCE.json' with {type:'json'};

const source=canonicalSource(walkSource);
const pickup=canonicalSource(pickupSource);
const pickupHand=pickupSource.names.indexOf('rhand');
const pickupContactFrame=pickupSource.points.reduce((best,row,i)=>row[pickupHand][1]<pickupSource.points[best][pickupHand][1]?i:best,0);
if(pickupSource.points.length!==357||pickupSource.fps!==120||pickupContactFrame!==99)throw Error('The locked complete CMU115_06 pickup source changed');
const clone=p=>({q:p.q.slice(),p:p.p.slice()});
const SOURCE_LOCK=Object.freeze({
  motionR04:'4de5f1d420a43355014bc1e6e572dd9c25058eb8',
  continuityR05:'8d0860881f34cd6d459b1099028f56dfc7b70a2c',
  capture:'CMU 16_15',cycleFrames:[174,315],sourceFPS:120,
  pickup:{capture:'CMU 115_06',sourceFrames:357,frameRange:[0,356],contactFrame:pickupContactFrame,
    contactSelection:'minimum original right-hand height; fixed before retarget/contact adaptation',referenceFrame:160,
    sourceSHA256:'db828741220e22f0929eefd2f887f3659039844de8d0a11a89e3c0ad62682b8d',
    sourceFingerMotionCaptured:false,loop:false},
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
    const pickupArms=new ArmContinuity(this.binding);
    this.pickup=await buildCapturedClip(this.binding,{id:'pickup-capture-11506',kind:'captured',label:'原有完整拾取捕捉',continuous:false},pickup,this.sampler,{
      notify,decorate:frame=>pickupArms.apply(frame,{gesture:false})
    });
    if(this.pickup.frames.length!==357||this.pickup.contactWeights.length!==357)throw Error('Complete pickup retarget must retain all357 source frames');
    this.pickup.contactFrame=pickupContactFrame;
    this.ready=true;
    this.report={...SOURCE_LOCK,actor:this.actor.id,prepareMS:performance.now()-started,
      nativeBones:this.binding.names.length,sourceVertexCount:this.binding.N,
      walk:{duration:this.walk.duration,frames:this.walk.frames.length,bytes:this.walk.bytes,metrics:this.walk.metrics},
      idle:{duration:this.idle.duration,frames:this.idle.frames.length,metrics:this.idle.metrics},
      pickup:{duration:this.pickup.duration,frames:this.pickup.frames.length,bytes:this.pickup.bytes,metrics:this.pickup.metrics,
        contactFrame:pickupContactFrame,referenceFrame:pickup.referenceFrame,headingCalibration:pickup.headingCalibration,
        originalContacts:pickup.contacts,adaptation:'source full-body/leg retarget retained; actual shoes and cylinder contact are solved by NativeCapturedPickup'},
      limitations:['retargeted captured gait, not a full-body dynamic balance solver','navigation determines world path','shoe/ground contacts verified after assembly']};
    return this;
  }
  sample(mode,{dt,distance=0}={}){
    if(!this.ready)throw Error('Existing native motion library must finish preparation');
    if(mode==='pickup')throw Error('Pickup requires explicit non-looping source-frame sampling and actual acquisition gate');
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
  samplePickup(sourceFrame){
    if(!this.ready||!this.pickup)throw Error('Complete captured pickup is not prepared');
    const x=Math.max(0,Math.min(356,sourceFrame)),a=Math.floor(x),b=Math.min(356,a+1),t=x-a;
    const pose=this.sampler.interpolate(this.pickup.frames[a],this.pickup.frames[b],t),skin=this.sampler.apply(pose);
    const contacts=Object.fromEntries(['L','R'].map(s=>[s,this.pickup.contactWeights[a][s]*(1-t)+this.pickup.contactWeights[b][s]*t]));
    return{pose,skin,world:this.sampler.world,contacts,report:{source:'R04 full CMU115_06 native retarget',sourceFrame:x,sourceFrames:[a,b],sourceTime:x/120,frameRange:[0,356],contactFrame:pickupContactFrame,contacts,continuous:false}};
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
