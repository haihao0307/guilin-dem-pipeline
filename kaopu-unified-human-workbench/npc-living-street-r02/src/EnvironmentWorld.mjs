/** Contact-gated operation of the scene's original window and fixed water valve.
 * Geometry owns the handle paths. The native palm must reach the current
 * visible handle before a further transform opens or closes the valve. An
 * already open valve keeps flowing if the task is cancelled; another eligible
 * resident must physically close it. Cancellation never snaps its angle.
 * These are assisted kinematic mechanisms, not a pressure/fluid simulation.
 */
const clamp=v=>Math.max(0,Math.min(1,v));
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const plain=p=>({x:p[0],y:p[1],z:p[2]});

export class EnvironmentWorld {
  constructor({sim,courtyard}){this.sim=sim;this.courtyard=courtyard;this.reset();}
  reset(){
    this.runSequence=this.sim.runSequence;this.records=new Map();this.history=[];this.clock=0;
    this.courtyard.setWindowProgress(this.sim.environment.windowProgress);
    this.courtyard.setWatering(0);this.sim.environment.watering=0;
  }
  _sync(){
    if(this.runSequence!==this.sim.runSequence)this.reset();
    for(const [id,r]of this.records){
      const task=this.sim.actor(id)?.task;
      if(task?.token===r.token)continue;
      this.history.push({...r,endedAt:this.clock});if(this.history.length>30)this.history.shift();this.records.delete(id);
    }
  }
  motionInput(state){
    this._sync();const t=state.task;
    if(t?.phase!=='interact'||!['window','water'].includes(t.kind))return {};
    let r=this.records.get(state.id);
    if(!r){
      r={actorId:state.id,token:t.token,kind:t.kind,targetId:t.targetId,targetOpen:t.targetOpen,closeOnly:!!t.closeOnly,
        progress:0,age:0,moved:0,contactSamples:0,contactSeconds:0,maximumContactErrorM:0,
        initialWindow:this.sim.environment.windowProgress,initialMoisture:this.sim.environment.plantMoisture,initialWatering:this.sim.environment.watering,
        finalEvidence:null,emitted:false};
      this.records.set(state.id,r);
    }
    const target=this.courtyard.getInteractionTarget(t.targetId);
    return {mode:t.kind,progress:r.progress,target:plain(target),grip:r.progress>=.30?1:0};
  }
  update(dt,reports){
    this._sync();this.clock+=dt;const receipts=[];
    for(const [id,r]of this.records){
      if(r.emitted)continue;const state=this.sim.actor(id),t=state?.task,m=reports[id];if(!t)continue;
      r.age+=dt;
      const actual=this.courtyard.getInteractionTarget(r.targetId),p=m?.palm;
      const error=Array.isArray(p)&&p.every(Number.isFinite)?distance(p,actual):Infinity;
      const touch=m?.finite&&m?.poseValid&&m?.contactReady&&error<=.020;
      if(r.progress<.30)r.progress=Math.min(.30,r.progress+dt/.85);
      else if(touch){
        r.contactSamples++;r.contactSeconds+=dt;r.maximumContactErrorM=Math.max(r.maximumContactErrorM,error);
        r.progress=Math.min(1,r.progress+dt/(r.kind==='water'?5.5:3.2));
        const u=clamp((r.progress-.30)/.70);
        if(r.kind==='window'){
          const target=r.targetOpen?1:0,value=r.initialWindow+(target-r.initialWindow)*u;
          this.sim.environment.windowProgress=value;this.courtyard.setWindowProgress(value);r.moved=Math.abs(value-r.initialWindow);
        }else{
          // Open, hold with native contact, then close the same physical valve.
          const opening=r.closeOnly?r.initialWatering*(1-u):u<.25?u/.25:u>.78?(1-u)/.22:1;
          this.sim.environment.watering=clamp(opening);this.courtyard.setWatering(opening);
          if(opening>.5)r.moved+=dt;
        }
      }
      if(r.progress>=.999&&touch&&m?.completed&&t.progress>=.98&&r.contactSamples>=3&&(r.kind!=='water'||r.closeOnly||r.moved>=1.5)){
        r.emitted=true;r.finalEvidence={executor:'native-palm-to-authored-mechanism',kind:r.kind,
          nativePalmRequired:true,clockOnlyCompletion:false,closeOnly:r.closeOnly,contactSamples:r.contactSamples,
          contactSeconds:r.contactSeconds,maximumContactErrorM:r.maximumContactErrorM,
          finalContactErrorM:error,actualHandle:actual,actualPalm:p.slice(),finalWindowProgress:this.sim.environment.windowProgress,
          wateringSeconds:r.kind==='water'?r.moved:0,geometry:this.courtyard.environmentReport()};
        receipts.push({id,token:r.token,success:true,evidence:r.finalEvidence});
      }else if(r.age>24){
        r.emitted=true;receipts.push({id,token:r.token,success:false,reason:'没有形成稳定的把手接触，这次操作先停下',
          evidence:{executor:'native-mechanism-contact-rejected',kind:r.kind,age:r.age,progress:r.progress,contactErrorM:Number.isFinite(error)?error:null}});
      }
    }
    return receipts;
  }
  snapshot(){return {clock:this.clock,actions:[...this.records.values()],history:this.history,
    geometry:this.courtyard.environmentReport(),scope:'real native-palm contact gates authored window and valve transforms; water flow is a visible indicator, no fluid dynamics claim'};}
}
