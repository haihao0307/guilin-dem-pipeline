/** Connect to a separate KAOPU/THREE function-generated shape adapter; no renderer dependency. */
import {DrivingPhysics} from './driving-physics.mjs';
export function createDrivingBridge(parameters, adapter) {
 if(typeof adapter?.setPhysicsState!=='function')throw new TypeError('adapter.setPhysicsState required');
 let physics=new DrivingPhysics(parameters);
 const frozenParameters=physics.p;
 const validateConfiguration=candidate=>{if(typeof adapter.validatePhysicsConfiguration==='function')adapter.validatePhysicsConfiguration(candidate.p);};
 validateConfiguration(physics);
 const sync=state=>{
  try {adapter.setPhysicsState(state);return state;}
  catch(error){physics.setPaused(true);throw error;}
 };
 sync(physics.snapshot());
 return {
  get physics(){return physics;},
  frame(elapsedS){return sync(physics.advance(elapsedS));},
  controls(patch){return physics.setControls(patch);},
  pause(flag=true){physics.setPaused(flag);return sync(physics.snapshot());},
  reset(initial={}){
   const candidate=new DrivingPhysics(frozenParameters);
   const state=candidate.reset(initial);
   validateConfiguration(candidate);
   // A well-behaved adapter validates before rendering; commit only after it accepts the state.
   adapter.setPhysicsState(state);
   physics=candidate;
   return state;
  },
  snapshot(){return physics.snapshot();}
 };
}
