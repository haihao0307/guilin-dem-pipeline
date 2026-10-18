// Explicit frame driver, with no global hooks, RAF, renderer or style mutation.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const positive=(x,name)=>{if(!Number.isFinite(x)||x<0)throw Error('Invalid '+name);return x;};

export class RuntimeController {
 constructor(ports){
  for(const name of ['advanceMotion','updatePose','simulate','prepareMotion','prepareContacts','invalidateShadows'])if(typeof ports[name]!=='function')throw Error('Missing runtime port: '+name);
  this.ports=ports;this.quality=1;this.frameMS=16.67;this.accumulator=0;this.frames=0;this.steps=0;this.droppedSeconds=0;this.projectedPixels=Infinity;this.disposed=false;this.fastSolve=false;
 }
 setProjectedPixels(pixels){positive(pixels,'projected size');this.projectedPixels=pixels;}
 observeFrame(ms){
  positive(ms,'frame time');this.frameMS=this.frameMS*.94+ms*.06;
  if(this.frameMS>19)this.quality=Math.max(.38,this.quality*.98);
  else if(this.frameMS<13)this.quality=Math.min(1,this.quality+.003);
  if(this.quality<.70)this.fastSolve=true;else if(this.quality>.92)this.fastSolve=false;
  this.ports.setSolveBudget?.({fastSolve:this.fastSolve,quality:this.quality});
  return this.quality;
 }
 advance(seconds,{speed=1,paused=false}={}){
  if(this.disposed)throw Error('Runtime disposed');positive(seconds,'dt');positive(speed,'speed');
  if(paused)return false;
  const dt=Math.min(.1,seconds);this.droppedSeconds+=seconds-dt;
  // Animation runs on every accepted frame, independently of solver cadence.
  this.ports.advanceMotion(dt*speed);this.ports.updatePose(dt);
  this.accumulator+=dt;const near=clamp((this.projectedPixels-80)/280,0,1),hz=15+45*near;
  let changed=false;
  if(this.accumulator+1e-12>=1/hz){const h=Math.min(.1,this.accumulator);this.ports.simulate(h);this.droppedSeconds+=this.accumulator-h;this.accumulator=0;this.steps++;changed=true;}
  this.frames++;return changed;
 }
 prepareRender(){
  if(this.disposed)throw Error('Runtime disposed');
  this.ports.prepareMotion();this.ports.prepareContacts();
  // Off-screen surface passes may consume the shadow dirty flag.
  this.ports.invalidateShadows();
 }
 report(){return{frames:this.frames,steps:this.steps,quality:this.quality,frameMS:this.frameMS,fastSolve:this.fastSolve,droppedSeconds:this.droppedSeconds,farPhysicsTargetHz:15,meshSubstitution:false,ownsStyle:false};}
 dispose(){if(this.disposed)return;this.disposed=true;this.ports.release?.();}
}
