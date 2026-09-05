import * as T from './vendor/three.module.js';
// Production motion authority: poses + explicit actuators + four source-calibrated axes.
// Curves preserve existing mechanical playback; physical linkage reconstruction is a separate task.
export class MotionSystem {
 constructor(nodes,definition,readBlock){
  this.nodes=nodes;this.definition=definition;
  this.curves=definition.curves.map(c=>({...c,times:readBlock(c.timeBlock),values:readBlock(c.valueBlock)}));
  this.controllers=Object.fromEntries(Object.entries(definition.actuators).map(([id,a])=>[id,{...a,value:NaN}]));
  this.spindles=definition.rotors.map(r=>({id:r.node,engine:r.engine,node:nodes[r.node],axis:new T.Vector3().fromArray(r.axis),base:new T.Quaternion().fromArray(r.base)}));
  this.angles=[0,0,0,0];this.speeds=[0,0,0,0];this.q=new T.Quaternion();this.spinQ=new T.Quaternion();
 }
 sample(binding,time){
  const c=this.curves[binding.curve],ts=c.times,v=c.values,n=this.nodes[binding.node];let lo=0,hi=ts.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(ts[mid]<=time)lo=mid;else hi=mid;}
  const u=T.MathUtils.clamp((time-ts[lo])/(ts[hi]-ts[lo]||1),0,1);
  if(binding.path==='rotation')n.quaternion.fromArray(v,lo*4).slerp(this.q.fromArray(v,hi*4),u);
  else{const out=binding.path==='translation'?n.position:n.scale;out.set(T.MathUtils.lerp(v[lo*3],v[hi*3],u),T.MathUtils.lerp(v[lo*3+1],v[hi*3+1],u),T.MathUtils.lerp(v[lo*3+2],v[hi*3+2],u));}
 }
 set(id,progress){
  if(!Number.isFinite(progress)||progress<0||progress>1)throw RangeError('Actuator progress must be within [0,1]');
  const a=this.controllers[id];if(!a)throw Error('Unknown actuator '+id);
  if(Math.abs(progress-a.value)<=1e-5)return;
  for(const binding of a.bindings)this.sample(binding,progress*a.sourceSeconds);a.value=progress;
 }
 spin(dt,rpm){
  if(!Number.isFinite(dt)||dt<0||rpm.length!==4||rpm.some(r=>!Number.isFinite(r)))throw RangeError('Invalid rotor input');
  for(const s of this.spindles){this.speeds[s.engine]=rpm[s.engine];this.angles[s.engine]+=dt*rpm[s.engine]*Math.PI/30;this.spinQ.setFromAxisAngle(s.axis,this.angles[s.engine]%(2*Math.PI));s.node.quaternion.copy(s.base).multiply(this.spinQ);}
 }
 reset(){this.angles.fill(0);this.speeds.fill(0);for(const a of Object.values(this.controllers))a.value=NaN;this.set('gear',1);this.set('bay',0);this.spin(0,this.speeds);}
 summary(){return {schema:this.definition.schema,gearBindings:this.controllers.gear.bindings.length,bayBindings:this.controllers.bay.bindings.length,curves:this.curves.length,rotorControllers:4,sourceTrackTable:false,kinematicCalibration:false};}
}
