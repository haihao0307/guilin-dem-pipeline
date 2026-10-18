/** Deterministic mechanism phase control. No force, adhesion or vehicle-speed claim. */
export function createPlayback({apply,requestRender,isRenderPending=()=>false,now=()=>performance.now(),schedule=fn=>setTimeout(fn,20),cancel=id=>clearTimeout(id)}){
 let phase=0,speed=10,playing=false,timer=null,last=0,steps=0;const tau=Math.PI*2;
 const publish=()=>{apply(phase);requestRender();};
 const tick=()=>{timer=null;if(!playing)return;const t=now();if(!isRenderPending()){const dt=Math.min(.1,Math.max(0,(t-last)/1000));phase=(phase+dt*speed*Math.PI/180)%tau;steps++;publish();}last=t;timer=schedule(tick);};
 const pause=()=>{playing=false;if(timer!==null)cancel(timer);timer=null;};
 return {play(){if(playing)return;playing=true;last=now();timer=schedule(tick);},pause,step(degrees=5){if(!Number.isFinite(degrees)||Math.abs(degrees)>30)throw RangeError('step ±30° max');pause();phase=((phase+degrees*Math.PI/180)%tau+tau)%tau;steps++;publish();},reset(){pause();phase=0;publish();},setSpeed(v){if(!Number.isFinite(v)||v<1||v>30)throw RangeError('phase speed 1–30 degrees/s');speed=v;},setPhase(v){if(!Number.isFinite(v))throw TypeError('finite phase');pause();phase=((v%tau)+tau)%tau;publish();},get state(){return {phase,phaseDegrees:phase*180/Math.PI,speedDegreesPerSecond:speed,playing,steps,timePolicy:'GPU-backpressure bounded phase-time; not real vehicle speed'};}};
}
