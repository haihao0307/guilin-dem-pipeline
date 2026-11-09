// Read-only state inspection. None of these functions changes a solver value.
export async function digest(value){
  const bytes=typeof value==='string'?new TextEncoder().encode(value):
    ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
export async function typed(values,Type){
  const a=Type.from(values);
  return {type:Type.name,length:a.length,bytes:a.byteLength,sha256:await digest(a)};
}
export async function initialState(world,waist,origin,target){
  const solvers=[];
  for(let i=0;i<world.solvers.length;i++){
    const s=world.solvers[i],r={id:i?'P01':'T01'};
    for(const k of ['p','v','old','w','mass'])r[k]=await typed(s[k],Float64Array);
    for(const k of ['map','faces','pins'])r[k]=await typed(s[k],Int32Array);
    r.output=await typed(s.output,Float32Array);
    r.edges={rowLayout:['a','b','sourceRest','targetRest','rest','lambda'],...await typed(s.edges.flatMap(e=>[e.a,e.b,e.sourceRest,e.targetRest,e.rest,e.lambda]),Float64Array)};
    r.bends={rowLayout:['a','b','c','d','rest','lambda'],...await typed(s.bends.flatMap(e=>[e.a,e.b,e.c,e.d,e.rest,e.lambda]),Float64Array)};
    r.seamPairs=await typed(s.seamPairs.flat(),Int32Array);
    solvers.push(r);
  }
  const frames=[];
  for(let i=1;i<=48;i++){
    const f=Math.min(1,i/32),p=Float32Array.from(target,(v,k)=>origin[k]+(v-origin[k])*f);
    frames.push({frame:i,fitFraction:f,...await typed(p,Float32Array)});
  }
  return {
    schema:'r02-original-full-cloth-fit-initial-hashes/1',
    littleEndian:new Uint8Array(new Uint16Array([1]).buffer)[0]===1,
    constructorBody:'originYupM',sameAsControlledWasm:true,
    body:{positions:await typed(world.actor.positions,Float64Array),native:await typed(world.actor.native,Float64Array),faces:await typed(world.body.faces,Int32Array)},
    solvers,
    waist:{rowsSHA256:await digest(JSON.stringify(waist.rows)),previous:await typed(waist.previous,Float64Array),target:await typed(waist.target,Float64Array)},
    sourceWorkerTargets:{origin:await typed(origin,Float32Array),target:await typed(target,Float32Array),frames},
  };
}
export function differences(actual,expected,prefix=''){
  const out=[];
  if(expected&&typeof expected==='object'){
    if(!actual||typeof actual!=='object')return [{path:prefix,expected,actual}];
    for(const key of Object.keys(expected))out.push(...differences(actual[key],expected[key],prefix?prefix+'.'+key:key));
    for(const key of Object.keys(actual))if(!(key in expected))out.push({path:prefix+'.'+key,unexpected:actual[key]});
  }else if(actual!==expected)out.push({path:prefix,expected,actual});
  return out;
}
export function particleSafety(world,gpu,rejectedState=null){
  const result=[];
  for(let g=0;g<2;g++){
    const s=world.solvers[g],offset=g?world.solvers[0].count:0;
    const get=(id,k)=>rejectedState?rejectedState[(offset+id)*12+k]:s.p[id*3+k];
    let min=Infinity,max=-Infinity,nonFinite=0,outsideEngineeringGuard=0,worst=null,originalPaperMax=0;
    for(const e of s.edges){
      const length=Math.hypot(get(e.a,0)-get(e.b,0),get(e.a,1)-get(e.b,1),get(e.a,2)-get(e.b,2)),ratio=length/e.rest;
      if(!Number.isFinite(ratio))nonFinite++;
      if(ratio<min)min=ratio;
      if(ratio>max){max=ratio;worst={a:e.a,b:e.b,lengthM:length,currentRestM:e.rest,sourceRestM:e.sourceRest,targetRestM:e.targetRest,ratio};}
      originalPaperMax=Math.max(originalPaperMax,length/(e.sourceRest||e.rest));
      if(ratio<.9||ratio>1.12)outsideEngineeringGuard++;
    }
    if(rejectedState){
      for(let i=offset*12;i<(offset+s.count)*12;i++)if(!Number.isFinite(rejectedState[i]))nonFinite++;
    }else for(const name of ['p','v','old'])for(const v of s[name])if(!Number.isFinite(v))nonFinite++;
    result.push({id:g?'P01':'T01',particles:s.count,originalVertices:s.output.length/3,faces:s.faces.length/3,edges:s.edges.length,bends:s.bends.length,pins:s.pins.length,minEdgeStretch:min,maxEdgeStretch:max,originalPaperMaxEdgeStretch:originalPaperMax,nonFinite,outsideEngineeringGuard,engineeringGuardRange:[.9,1.12],sourceStopCeiling:1.45,sourceCeilingExceeded:max>1.45,worst});
  }
  return {state:rejectedState?'actual-original-gpu-rejected-state':'last-committed-original-gpu-state',restReference:'Current original CPU edge.rest; after rollback it may retain the attempted fitting fraction, independently of committed positions.',items:result,safetyTrips:world.safetyTrips,rollbacks:gpu?.metrics.rollbacks??0,validationError:gpu?.validationError??null,deviceLost:gpu?.lost??null};
}
export function saveCommitted(world){
  return {body:Array.from(world.actor.positions),elapsed:world.elapsed,frameSequence:world.frameSequence,solvers:world.solvers.map(s=>({p:Array.from(s.p),v:Array.from(s.v),old:Array.from(s.old),time:s.time,steps:s.steps}))};
}
export function rollbackDifference(world,previous){
  let body=0,p=0,v=0,old=0;
  world.actor.positions.forEach((x,i)=>body=Math.max(body,Math.abs(x-previous.body[i])));
  world.solvers.forEach((s,k)=>{for(let i=0;i<s.p.length;i++){p=Math.max(p,Math.abs(s.p[i]-previous.solvers[k].p[i]));v=Math.max(v,Math.abs(s.v[i]-previous.solvers[k].v[i]));old=Math.max(old,Math.abs(s.old[i]-previous.solvers[k].old[i]));}});
  return {bodyMaxDifferenceM:body,positionMaxDifferenceM:p,velocityMaxDifference:v,oldPositionMaxDifferenceM:old,elapsedUnchanged:world.elapsed===previous.elapsed,frameSequenceUnchanged:world.frameSequence===previous.frameSequence,solverStepsUnchanged:world.solvers.every((s,i)=>s.steps===previous.solvers[i].steps),solverTimesUnchanged:world.solvers.every((s,i)=>s.time===previous.solvers[i].time),scope:'CPU committed body/position/velocity/old/time only; no claim that CPU edge.rest or all GPU memory was compared'};
}
