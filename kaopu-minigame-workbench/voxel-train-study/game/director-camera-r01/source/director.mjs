// Original deterministic KAOPU camera-only score runner. No model or texture imports.
export const SCHEMA='kaopu.director.camera/1';
const clone=x=>structuredClone(x), mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function validateScore(s){
 if(s?.schema!==SCHEMA||!Array.isArray(s.keys)||s.keys.length<2)throw Error('invalid-score');
 let previous=-Infinity;
 for(const k of s.keys){if(!Number.isFinite(k.t)||k.t<=previous||![k.position,k.target].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))||!Number.isFinite(k.fov)||k.fov<5||k.fov>90)throw Error('invalid-key');previous=k.t;}
 if(s.keys[0].t!==0)throw Error('score-must-start-at-zero');return true;
}
export function sampleScore(score,t){
 validateScore(score);if(!Number.isFinite(t))throw Error('invalid-time');
 t=Math.max(0,Math.min(score.keys.at(-1).t,t));let i=score.keys.findIndex(k=>k.t>t)-1;if(i<0)i=score.keys.length-2;
 const a=score.keys[i],b=score.keys[i+1],u=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))),s=u*u*(3-2*u);
 return {time:t,segment:i,position:mix(a.position,b.position,s),target:mix(a.target,b.target,s),fov:a.fov+(b.fov-a.fov)*s,label:a.label};
}
export function createDirector({score,readPose,writePose,boundPose,inspect=()=>({safe:true}),onStop=()=>{}}){
 validateScore(score);let active=false,startElapsed=0,saved=null,lastElapsed=-Infinity,reason='idle',samples=0;
 function stop(why='user'){if(!active)return false;active=false;reason=why;writePose(clone(saved));onStop(why);return true;}
 return {
  start(worldElapsed){if(!Number.isFinite(worldElapsed))throw Error('invalid-world-time');if(active)return false;saved=clone(readPose());startElapsed=worldElapsed;lastElapsed=worldElapsed;active=true;reason='playing';samples=0;return true;},
  update(view){if(!active)return null;const elapsed=view?.elapsed;if(!Number.isFinite(elapsed)||elapsed<lastElapsed){stop('invalid-world-time');return null;}lastElapsed=elapsed;
   const t=elapsed-startElapsed;if(t>=score.keys.at(-1).t){stop('completed');return null;}
   const p=sampleScore(score,t),safe=boundPose(p.position,p.target);if(!safe){stop('unsafe-native-pose');return null;}
   const final={...p,position:safe.position,target:safe.target};const check=inspect(final);if(check.safe===false){stop('collision');return null;}
   writePose(final);samples++;return {...final,check};},
  stop,state:()=>({active,startElapsed,lastElapsed,reason,samples,worldMutation:false}),dispose(){stop('disposed');saved=null;}
 };
}
