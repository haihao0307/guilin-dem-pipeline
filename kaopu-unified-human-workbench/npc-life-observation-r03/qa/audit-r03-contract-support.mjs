/** Deliberately small deterministic clock / WebGL fixtures. No browser claim. */
export function fakeTime(){
  let time=0,next=1;const timers=new Map();
  const api={now:()=>time,setTimer:(callback,ms)=>{const id=next++;timers.set(id,{at:time+ms,callback});return id;},clearTimer:id=>timers.delete(id),
    elapse:(ms,{fire=true}={})=>{time+=ms;if(fire)api.runDue();},
    runDue:()=>{let count=0;while(true){const item=[...timers].filter(([,t])=>t.at<=time).sort((a,b)=>a[1].at-b[1].at)[0];if(!item)break;if(++count>1000)throw Error('Fixture timer loop');timers.delete(item[0]);item[1].callback();}},
    pending:()=>timers.size};return api;
}
export function fakeGL(){
  let next=0,lost=false;const fences=new Map(),deleted=[];
  const gl={SYNC_GPU_COMMANDS_COMPLETE:1,WAIT_FAILED:2,TIMEOUT_EXPIRED:3,CONDITION_SATISFIED:4,
    fenceSync(){const fence={id:++next};fences.set(fence,gl.TIMEOUT_EXPIRED);return fence;},
    clientWaitSync:f=>fences.get(f),deleteSync:f=>{deleted.push(f);fences.delete(f);},flush(){},isContextLost:()=>lost,
    signalAll:()=>{for(const f of fences.keys())fences.set(f,gl.CONDITION_SATISFIED);},
    failAll:()=>{for(const f of fences.keys())fences.set(f,gl.WAIT_FAILED);},lose:()=>{lost=true;},
    pending:()=>fences.size,deleted};
  const viewer={renderer:{getContext:()=>gl,info:{render:{frame:0}}},render(){viewer.renderer.info.render.frame++;}};
  return {gl,viewer};
}
export async function microtasks(){for(let i=0;i<6;i++)await Promise.resolve();}
