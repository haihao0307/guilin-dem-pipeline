import {THREE,NativeBinding,RigidPoseSampler} from '../motion/kaopu-unified-human-workbench/motion-review-r01/Core.mjs';
import {CATALOGUE} from '../motion/kaopu-unified-human-workbench/motion-review-r01/Catalogue.mjs';
import {createCapturedActivityController} from '../motion/kaopu-unified-human-workbench/full/activity-r01/CapturedActivityController.mjs';
import {HandBodyModeController} from '../motion/kaopu-unified-human-workbench/full/hand-body-r01/HandBodyModeController.mjs';
import {createBoxingRig} from '../motion/kaopu-unified-human-workbench/full/boxing-r03/MotionR03.mjs';
import walk from '../motion/kaopu-unified-human-workbench/full/activity-r01/CMU-WALK-SOURCE.json';
import run from '../motion/kaopu-unified-human-workbench/full/activity-r01/16_57-SOURCE.json';
import jump from '../motion/kaopu-unified-human-workbench/full/activity-r01/16_01-SOURCE.json';
export {THREE};
export const ACTIONS=CATALOGUE.filter(r=>r.playable&&['capture','hand','excerpt'].includes(r.kind));
const sources={walk,run,jump};
export class NativeActions{
 constructor(model,viewer){this.model=model;this.viewer=viewer;this.binding=new NativeBinding(model,viewer);this.sampler=new RigidPoseSampler(this.binding.rig);this.rest=this.sampler.pack(this.binding.rig.restMatrices);this.binding.activate();this.cache=new Map();this.atRest();}
 atRest(){this.pose=this.rest;this.binding.animate(this.sampler.apply(this.rest));}
 async clip(id){if(this.cache.has(id))return this.cache.get(id);const row=ACTIONS.find(r=>r.id===id);if(!row)throw Error('未登记的人物总台原动作：'+id);const h=this.binding;let controller,sample,duration=row.duration,fps=60;
  if(row.kind==='capture'){controller=createCapturedActivityController(h,sources[row.sourceKey]);duration=controller.duration;fps=sources[row.sourceKey].fps;sample=t=>controller.evaluate(t);}
  else if(row.kind==='hand'){controller=new HandBodyModeController({human:h,applyFrame:()=>{}});controller.select(row.task,{tension:row.tension});sample=t=>controller.sample(t);}
  else{controller=createBoxingRig({...h.rig,stature:h.height,floorOffset:h.floorOffset});sample=t=>controller.evaluate(t+(row.offset||0),{programId:row.programId,fighter:row.role,poseOutput:false});}
  const frames=[],objects=[],N=Math.ceil(duration*fps)+1;this.sampler.localError=0;const start=performance.now();
  for(let i=0;i<N;i++){const f=sample(Math.min(duration,i/fps));if(!f.posedMatrices?.every(m=>Array.from(m).every(Number.isFinite)))throw Error('原动作含无效矩阵 '+id);frames.push(this.sampler.pack(f.posedMatrices));objects.push(f.object?structuredClone(f.object):null);if(i%90===0)await new Promise(r=>setTimeout(r,0));}
  controller.dispose?.();const clip={id,row,duration,fps,frames,objects,sourceLocalError:this.sampler.localError,prepareMS:performance.now()-start};this.cache.set(id,clip);return clip;
 }
 sample(clip,t){const x=Math.min(clip.frames.length-1,Math.max(0,t*clip.fps)),i=Math.floor(x);const pose=this.sampler.interpolate(clip.frames[i],clip.frames[Math.min(i+1,clip.frames.length-1)],x-i);this.pose={q:pose.q.slice(),p:pose.p.slice()};this.sampler.apply(pose);return{skin:this.sampler.skin.map(m=>Array.from(m)),world:this.sampler.world.map(m=>m.clone().transpose().toArray()),object:clip.objects[i],boneErrorM:this.sampler.boneError()};}
 packet(){const b=this.binding;return{version:'R05-native-CSR/1',positions:Array.from(b.positions),faces:Array.from(b.faces),bodyCount:this.model.bodyCount,range:Array.from(b.range),packed:Array.from(b.packed),rig:b.rig,sourceCommit:'9b6644b3210e5ee5f9b4e7fbb583dec98e90b285'};}
}
