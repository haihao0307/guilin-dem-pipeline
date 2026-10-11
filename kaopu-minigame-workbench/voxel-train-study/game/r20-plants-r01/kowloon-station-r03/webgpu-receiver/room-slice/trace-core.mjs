/**
 * Pure resumable WGSL traversal candidate; no bindings, passes, or scene edits.
 * Original receiver SHA-256:
 * 1352b6653bcb042e56fa3e6226acd6949bab1317ba610b289e7a11740407ce23
 *
 * `previous` is (previous sample t, previous sample d, regular sample count, 0).
 * Limits are absolute lifetime counters, never extra per-dispatch allowances.
 * Keep the full Hit and previous vector on GPU between traversal dispatches.
 */
export const RESUMABLE_TRACE_WGSL = String.raw`
struct Hit { t:f32,hit:bool,exhausted:bool,steps:u32,localSteps:u32,field:RoomField };
struct TraceProgress { h:Hit,previous:vec4<f32> };

fn traceStart(ro:vec3<f32>)->Hit{
 // A fresh ray is unresolved, so it is eligible for traceProgress.
 return Hit(.001,false,true,0u,0u,rawField(1e4,0,ro));
}

fn traceProgress(ro:vec3<f32>,rd:vec3<f32>,farT:f32,start:Hit,previous:vec4<f32>,regularLimit:u32,totalLimit:u32)->TraceProgress{
 // A terminal hit or true miss cannot become unresolved on a later dispatch.
 if(start.hit||!start.exhausted){return TraceProgress(start,previous);}
 var t=start.t;var prevT=previous.x;var prevD=previous.y;var f=start.field;
 var regularSteps=u32(previous.z);var localSteps=start.localSteps;
 let interval=clothRayInterval(ro,rd);let totalBound=min(totalLimit,1024u);
 var i=start.steps;
 for(;i<totalBound;i++){
 if(t>farT){return TraceProgress(Hit(farT,false,false,i,localSteps,rawField(1e4,0,ro+rd*farT)),vec4<f32>(prevT,prevD,f32(regularSteps),0.));}
 let local=u.clothLocalBudget>0u&&t>=interval.x&&t<=interval.y;
 if(local){if(localSteps>=min(u.clothLocalBudget,512u)){return TraceProgress(Hit(t,false,true,i,localSteps,f),vec4<f32>(prevT,prevD,f32(regularSteps),0.));}localSteps++;}else{if(regularSteps>=regularLimit){return TraceProgress(Hit(t,false,true,i,localSteps,f),vec4<f32>(prevT,prevD,f32(regularSteps),0.));}regularSteps++;}
 let sample=sceneSample(ro+rd*t);f=sample.field;if(u.clothLocalBudget>0u&&!local){f=sample.other;}let eps=.000008+t*.000001;
 if(abs(f.d)<eps){return TraceProgress(Hit(t,true,false,i+1u,localSteps,f),vec4<f32>(prevT,prevD,f32(regularSteps),0.));}if(f.d<0. && prevD>0.){var a=prevT;var b=t;for(var j=0;j<9;j++){let m=(a+b)*.5;let d=sceneField(ro+rd*m).d;if(d>0.){a=m;}else{b=m;}}t=(a+b)*.5;return TraceProgress(Hit(t,true,false,i+1u,localSteps,sceneField(ro+rd*t)),vec4<f32>(prevT,prevD,f32(regularSteps),0.));}
 prevT=t;prevD=f.d;var advance=clamp(abs(f.d)*.48,.000006,.55);if(local&&f.id==8){let possible=clothEmptyIntervalStep(ro+rd*t,rd);if(possible>advance){let other=sample.other;advance=max(advance,min(possible,clamp(abs(other.d)*.48,.000006,.55)));}}if(u.clothLocalBudget>0u&&interval.x<=interval.y&&t<interval.x){advance=min(advance,interval.x-t);}t+=advance;}
 return TraceProgress(Hit(t,false,true,i,localSteps,f),vec4<f32>(prevT,prevD,f32(regularSteps),0.));
}

// Legacy callers, including secondary rays, keep their exact original budgets.
fn traceWorld(ro:vec3<f32>,rd:vec3<f32>,farT:f32)->Hit{
 return traceProgress(ro,rd,farT,traceStart(ro),vec4<f32>(.001,1.,0.,0.),180u,692u).h;
}
`;
