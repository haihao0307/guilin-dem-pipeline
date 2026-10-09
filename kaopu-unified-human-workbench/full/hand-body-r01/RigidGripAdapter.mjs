/** RigidObjectWorld lifecycle adapter, independent of its implementation.
 * Caller supplies ONE object-origin target in world Y-up metres. The target
 * must already include the calibrated grasp-to-object transform. Never feed
 * a palm origin directly. No loads/skin collisions/physical grasp are implied.
 */
const valid=p=>p&&Array.isArray(p.position)&&p.position.length===3&&p.position.every(Number.isFinite)&&Array.isArray(p.rotation)&&p.rotation.length===4&&p.rotation.every(Number.isFinite)&&Math.abs(Math.hypot(...p.rotation)-1)<1e-5;
const mul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
export class RigidGripAdapter{
 constructor(world,{id,fixedStep=1/120,maxAlignmentErrorM=.02}={}){if(!world||typeof id!=='string'||!id||!Number.isFinite(fixedStep)||fixedStep<=0||Math.abs(fixedStep-world.options.fixedStep)>1e-10)throw Error('Explicit world, id and matching fixed step required');this.world=world;this.id=id;this.dt=fixedStep;this.maxAlignmentErrorM=maxAlignmentErrorM;this.held=false;this.lastTime=null;this.events=[];}
 step({time,grip,objectWorldPose}){
  if(!Number.isFinite(time)||!valid(objectWorldPose))throw Error('Finite time and unit world object-origin pose required');
  if(this.lastTime!==null&&Math.abs(time-this.lastTime-this.dt)>1e-7)throw Error('Discontinuous grip time; reset world and adapter before seek');
  if(this.world.paused)throw Error('Resume world before advancing grip adapter');
  let event=null;
  if(grip&&!this.held){const p=this.world.getTransform(this.id),error=Math.hypot(...p.position.map((v,k)=>v-objectWorldPose.position[k]));if(error>this.maxAlignmentErrorM)throw Error('Align object before grabbing; refusing teleport');this.world.grab(this.id);this.held=true;event='grab';}
  if(this.held)this.world.setKinematicTarget(this.id,objectWorldPose);
  const result=this.world.step(this.dt);
  if(this.held&&!grip){this.world.release(this.id);this.held=false;event='release';}
  this.lastTime=time;if(event)this.events.push({event,time,id:this.id});return{...result,event,object:this.world.getTransform(this.id)};
 }
 reset(){if(this.held)throw Error('Reset physics world first and construct a fresh adapter for held objects');this.lastTime=null;this.events=[];}
}
export function nativeObjectPose(position,{floorOffset=0,rotation=[0,0,0,1]}={}){if(!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite)||!Number.isFinite(floorOffset))throw Error('Invalid native origin');const c=[-Math.SQRT1_2,0,0,Math.SQRT1_2],ci=[Math.SQRT1_2,0,0,Math.SQRT1_2];const p={position:[position[0],position[2]+floorOffset,-position[1]],rotation:mul(mul(c,rotation),ci)};if(!valid(p))throw Error('Invalid native rotation');return p;}
