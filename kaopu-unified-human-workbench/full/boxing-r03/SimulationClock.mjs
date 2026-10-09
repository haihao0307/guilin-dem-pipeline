/** Shared pair clock. Backlog is observable, never replaced by larger physics steps. */
export class SimulationClock {
  constructor({fixedStep=1/120,maxStepsPerFrame=24,speed=1.14}={}) {
    if(!(fixedStep>0&&fixedStep<=1/120&&Number.isInteger(maxStepsPerFrame)&&maxStepsPerFrame>0))throw Error('Invalid fixed-step clock');
    this.fixedStep=fixedStep;this.maxStepsPerFrame=maxStepsPerFrame;this.speed=speed;
    this.reset();
  }
  reset(canonicalTime=0){if(!(Number.isFinite(canonicalTime)&&canonicalTime>=0))throw Error('Invalid time');this.time=canonicalTime;this.physicalTime=0;this.backlog=0;this.steps=0;this.paused=false;this.discardedByExplicitPause=0;}
  setSpeed(value){if(!(Number.isFinite(value)&&value>0&&value<=2))throw Error('Invalid playback speed');this.speed=value;}
  setPaused(value){this.paused=!!value;if(this.paused){this.discardedByExplicitPause+=this.backlog;this.backlog=0;}}
  advance(wallSeconds,step){
    if(!(Number.isFinite(wallSeconds)&&wallSeconds>=0))throw Error('Invalid elapsed time');
    if(this.paused)return 0;
    this.backlog+=wallSeconds;let count=0;
    while(this.backlog+1e-12>=this.fixedStep&&count<this.maxStepsPerFrame){
      const previousTime=this.time;this.time+=this.fixedStep*this.speed;this.physicalTime+=this.fixedStep;
      step({dt:this.fixedStep,time:this.time,previousTime,physicalTime:this.physicalTime,speed:this.speed});
      this.backlog=Math.max(0,this.backlog-this.fixedStep);this.steps++;count++;
    }
    return count;
  }
  diagnostics(){return {fixedStep:this.fixedStep,canonicalTime:this.time,physicalTime:this.physicalTime,backlogSeconds:this.backlog,steps:this.steps,speed:this.speed,paused:this.paused,droppedSteps:0,discardedByExplicitPause:this.discardedByExplicitPause};}
}
