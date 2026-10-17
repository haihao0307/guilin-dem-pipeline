// Binds to the inspected, real Session API without changing any protected game file.
import {Session,replay,TICK_HZ,FRONT_X} from '../../voxel-train-study/game/session.mjs';
import {ADAPTER_SCHEMA,TickCrossing,validateSensors,sessionFrame,objectMatrix,jointReport} from './adapter.mjs';
export const SESSION_CONTRACT=Object.freeze({version:1,tickHz:TICK_HZ,frontX:FRONT_X,unit:'metre',legacyForward:'X'});
const bound=new WeakSet();
const inputsEqual=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function attachAssembly(session,{readSensors=null,crossing=null,sensorEvents=[]}={}){
  if(!(session instanceof Session))throw new TypeError('the existing Session instance is required');
  if(bound.has(session))throw new Error('assembly already attached');
  if(readSensors!==null&&typeof readSensors!=='function')throw new TypeError('readSensors must be a function');
  if(crossing?.input&&!readSensors)throw new TypeError('saved live state needs a sensor provider');
  const channel=crossing||new TickCrossing({tickHz:TICK_HZ});
  if(channel.tickHz!==TICK_HZ||channel.tick!==session.tick)throw new RangeError('late binding needs a matching saved crossing state');
  sessionFrame(session.view(),SESSION_CONTRACT);
  const own=Object.getOwnPropertyDescriptor(session,'step'),original=session.step,events=sensorEvents.map(e=>({tick:e.tick,input:{...e.input}}));
  let disposed=false;
  const record=(tick,input)=>{if(!events.length||!inputsEqual(events.at(-1).input,input))events.push({tick,input:{...input}});};
  if(readSensors&&channel.input===null){const input=validateSensors(readSensors(session.tick,session.view()));channel.consume(session.tick,input);record(session.tick,input);}
  function wrappedStep(){
    // Sample before the real step; no invalid/partial input can advance this adapter.
    const nextTick=this.tick+1,input=readSensors?validateSensors(readSensors(nextTick,this.view())):null;
    const result=original.call(this);
    if(input){channel.consume(this.tick,input);record(this.tick,input);}
    else{channel.tick=this.tick;channel.state={...channel.state,worldTime:this.tick/TICK_HZ};}
    return result;
  }
  session.step=wrappedStep;bound.add(session);
  return {session,channel,
    snapshot(){return {frame:sessionFrame(session.view(),SESSION_CONTRACT),crossing:channel.outputs(),authorityInterlockInstalled:false};},
    joint(a,b,rule){const v=session.view();return jointReport(objectMatrix(a,v,SESSION_CONTRACT),objectMatrix(b,v,SESSION_CONTRACT),rule);},
    save(){return {schema:ADAPTER_SCHEMA,session:session.replayPacket(),crossing:channel.save(),sensorEvents:events.map(e=>({tick:e.tick,input:{...e.input}}))};},
    dispose(){if(disposed)return;if(session.step!==wrappedStep)throw new Error('step changed by another owner; refusing to overwrite');
      if(own)Object.defineProperty(session,'step',own);else delete session.step;bound.delete(session);disposed=true;}
  };
}
export function restoreAssembly(packet,{readSensors=null}={}){
  if(packet?.schema!==ADAPTER_SCHEMA||packet.session?.version!==1||!Number.isSafeInteger(packet.session.ticks)||packet.session.ticks<0||packet.session.ticks>180000||
    !Array.isArray(packet.session.inputs)||packet.session.inputs.length>50000||!Array.isArray(packet.sensorEvents)||packet.sensorEvents.length>180001)throw new TypeError('invalid assembly save');
  for(const input of packet.session.inputs){if(!Number.isSafeInteger(input.tick)||input.tick<0||input.tick>packet.session.ticks||!Number.isSafeInteger(input.sequence)||input.sequence<1)throw new TypeError('invalid saved command');}
  const channel=TickCrossing.restore(packet.crossing),check=new TickCrossing({tickHz:TICK_HZ,...channel.config});
  if(channel.tick!==packet.session.ticks)throw new RangeError('crossing/session save tick mismatch');
  // Reconstruct sidecar state from detector events rather than trusting a forged green save.
  let index=0,current=null,prior=-1;
  for(const e of packet.sensorEvents){if(!Number.isSafeInteger(e.tick)||e.tick<0||e.tick<=prior||e.tick>channel.tick)throw new TypeError('invalid detector event order');validateSensors(e.input);prior=e.tick;}
  if(packet.sensorEvents.length&&packet.sensorEvents[0].tick!==0)throw new TypeError('detector history must begin at binding tick zero');
  if(packet.sensorEvents.length){for(let tick=0;tick<=channel.tick;tick++){
    if(packet.sensorEvents[index]?.tick===tick)current=packet.sensorEvents[index++].input;
    check.consume(tick,current);
  }}else{check.tick=channel.tick;check.state.worldTime=channel.tick/TICK_HZ;}
  if(JSON.stringify(check.save())!==JSON.stringify(channel.save()))throw new RangeError('crossing state does not match detector history');
  const session=replay(packet.session);
  // Without a fresh sensor provider, restore remains inspection-only, never silently live.
  if(!readSensors){return {session,channel,snapshot:()=>({frame:sessionFrame(session.view(),SESSION_CONTRACT),crossing:{roadProceed:false,railProceed:false,fault:true,unresolved:'restored; live detectors not rebound'},authorityInterlockInstalled:false}),inspectionOnly:true};}
  return attachAssembly(session,{readSensors,crossing:channel,sensorEvents:packet.sensorEvents});
}
// The exposed wheel Groups are metadata helpers and are not attached to root.
// Use actual batch+instance handles; never infer wheel identity from material names.
export function legacySteamWheelHandles(steam){
  if(steam?.proof?.wheelArrangement!=='2-8-0'||!Array.isArray(steam.wheels))throw new TypeError('inspected legacy WD-inspired API required; not Scotsman or No.28');
  return steam.wheels.map((wheel,index)=>{
    const d=wheel.userData;
    if(!d?.batch?.isInstancedMesh||!Number.isSafeInteger(d.instance)||!Number.isFinite(d.radius)||d.radius<=0||![-1,1].includes(d.sign))throw new TypeError('invalid exposed wheel descriptor');
    return {id:`legacy-wd/${d.kind}/${index}`,sourceModel:'legacy-wd-inspired-2-8-0',kind:d.kind,radius:d.radius,side:d.sign,
      rotating:{object:d.batch,instanceIndex:d.instance},support:{object:steam.root},
      rule:{kind:'axle-revolute',anchorA:[0,0,0],anchorB:wheel.position.toArray(),axisA:[0,0,1],axisB:[0,0,1],toleranceMetres:1e-5,toleranceRadians:1e-5},
      limitations:['support anchor only','axleboxes/springs/brake shoes not separate semantic joints']};
  });
}
