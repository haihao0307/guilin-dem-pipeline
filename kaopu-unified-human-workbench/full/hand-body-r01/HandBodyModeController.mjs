/** UI/scene-free adapter for the existing human overview.
 * It never creates a renderer, canvas, human, mesh, camera or physics world. */
import {HandBodyCoordinator,TASKS} from './HandBodyCoordinator.mjs';
import {calibrateSphereGrasp} from './SurfaceGraspCalibration.mjs';
export class HandBodyModeController {
 constructor({human,applyFrame=null,onFrame=null}={}){
  if(!human?.rig||typeof human.animate!=='function')throw Error('An existing full-CSR AnimatedHuman is required');
  this.human=human;this.applyFrame=applyFrame||((frame)=>human.animate(frame.skinMatrices));this.onFrame=onFrame;this.rig=new HandBodyCoordinator({...human.rig,stature:human.height,floorOffset:human.floorOffset});this.calibration=null;this.task='fist';this.tension='reference';this.time=0;this.duration=6;this.playing=false;this.sequence=null;this.sequenceIndex=0;this.frame=null;
 }
 select(task,{tension='reference',duration=6,play=false}={}){
  if(!TASKS.includes(task)||!['reference','loose'].includes(tension)||!Number.isFinite(duration)||duration<=0)throw Error('Invalid hand-body mode');
  this.task=task;this.tension=tension;this.duration=duration;this.time=0;this.playing=play;this.sequence=null;this.rig.previousGrip=false;return this.sample(0);
 }
 playSequence(tasks=['open','fist','carry','reach-turn']){
  if(!Array.isArray(tasks)||!tasks.length||tasks.some(t=>!TASKS.includes(t)))throw Error('Invalid hand-body sequence');
  this.select(tasks[0],{play:true});this.sequence=tasks.slice();this.sequenceIndex=0;return this.frame;
 }
 sample(time=this.time){
  if(!Number.isFinite(time))throw Error('Invalid animation time');this.time=Math.max(0,Math.min(this.duration,time));
  if(this.task==='grasp'&&!this.calibration)this.calibration=calibrateSphereGrasp(this.human,this.rig);
  const frame=this.rig.evaluate(this.time,{task:this.task,duration:this.duration,fistTension:this.tension,poseOutput:true,contactOffsets:this.task==='grasp'?{L:this.calibration.offset}:null});
  this.applyFrame(frame);this.frame=frame;this.onFrame?.(frame,{playing:this.playing,time:this.time,task:this.task,objectMode:'authored-target',objectVisible:['grasp','carry'].includes(this.task)});return frame;
 }
 update(dt){
  if(!Number.isFinite(dt)||dt<0)throw Error('Invalid animation delta');if(!this.playing)return this.frame||this.sample();
  let next=this.time+Math.min(dt,.05);
  if(next>this.duration){if(this.sequence&&this.sequenceIndex+1<this.sequence.length){this.task=this.sequence[++this.sequenceIndex];next=0;this.rig.previousGrip=false;}else{next=this.duration;this.playing=false;}}
  return this.sample(next);
 }
 pause(){this.playing=false;}
 resume(){this.playing=true;}
 reset(){this.playing=false;this.sequence=null;this.rig.previousGrip=false;return this.sample(0);}
 dispose(){this.playing=false;this.onFrame=null;this.frame=null;this.calibration=null;/* human ownership remains with the overview */}
}
