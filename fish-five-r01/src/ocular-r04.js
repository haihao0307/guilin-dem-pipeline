// R04 gaze controller. No geometry, material, pupil, body, or legacy mutation.
// Angular/temporal settings are conservative presentation parameters. Fish eye
// coordination is species-dependent; source labels do not calibrate physiology.
const IDS=new Set(['barracuda','herring','tuna-yellow-label','tuna-blue-label','colorful','picasso']);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const unit=(v,fallback=[0,0,1])=>{const n=Math.hypot(...v);return n>1e-10?v.map(x=>x/n):fallback.slice();};
function noise(seed,cycle,salt){let x=(seed+Math.imul(cycle+1,0x9e3779b9)+Math.imul(salt,0x85ebca6b))|0;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return((x^(x>>>16))>>>0)/4294967296;}
function projected(v,axis,fallback){return unit(v.map((x,k)=>x-axis[k]*dot(v,axis)),fallback);}
function basisFor(eye,other){
  const side=eye.side===-1?-1:1,frame=eye.sourceFrame||{x:eye.tangent||[side,0,0],y:eye.up||[0,1,0],normal:eye.normal||eye.outwardNormal||[0,0,side]};
  const axes=[unit(frame.x),unit(frame.y,[0,1,0]),unit(frame.normal)],radii=eye.localRadii;
  const center=eye.center||eye.globeCenterM||[0,0,side*.05],opposite=other?.center||other?.globeCenterM;
  let optic;
  if(eye.opticAxis)optic=unit(axes[0].map((_,k)=>axes[0][k]*eye.opticAxis[0]+axes[1][k]*eye.opticAxis[1]+axes[2][k]*eye.opticAxis[2]));
  else if(radii&&Math.max(...radii)/Math.min(...radii)<1.2&&opposite)optic=unit(center.map((x,k)=>x-opposite[k]));
  else optic=axes[2];
  const anterior=projected([-1,0,0],optic,[side,0,0]),up=projected([0,1,0],optic,[0,1,0]);
  // Orthogonalize pitch direction as well; retain dorsal sign on both sides.
  const vertical=unit(up.map((x,k)=>x-anterior[k]*dot(up,anterior)),[0,1,0]);
  const local=v=>axes.map(a=>dot(a,v));
  return {optic,anterior,up:vertical,localOptic:local(optic),localAnterior:local(anterior),localUp:local(vertical),center:center.slice(),frame:axes};
}
function limitsFor(eye){
  // Existing KFE eyes provide a spherical iris radius; score eyes use the
  // unchanged shader iris-domain outer threshold .81 on a unit sphere, which
  // is then scaled by the fixed measured source ellipsoid. Rotation does not
  // translate or resize that outer surface.
  const R=eye.globeRadiusM||eye.radius||1,irisRatio=eye.irisRadiusM?clamp(eye.irisRadiusM/R,0,.9999):.81;
  const frontMargin=Math.PI/2-Math.asin(irisRatio)-.08;
  const corneaMargin=eye.corneaRadiusM?Math.asin(clamp(eye.corneaRadiusM*Math.sin(Math.PI*.30)/R,0,1))-Math.asin(irisRatio)-.02:Infinity;
  const cap=Math.max(0,Math.min(.18,frontMargin,corneaMargin));
  const yaw=Math.min(cap,eye.gazeSafeYawLimit??Infinity),pitch=Math.min(.075,cap*.075/.18,eye.gazeSafePitchLimit??Infinity);
  return {yaw,pitch,cone:cap,irisRatio,frontMargin,corneaMargin:Number.isFinite(corneaMargin)?corneaMargin:null,geometryBasis:eye.irisRadiusM?'existing KFE iris/globe/cornea ratio':'unchanged score shader iris domain .81 + fixed measured ellipsoid',speciesCalibration:'UNKNOWN'};
}
export function create(id,seed=90401,actorIndex=0,measuredEyes=[]){
  if(!IDS.has(id))throw Error('Unknown ocular source: '+id);
  if(!Number.isFinite(seed)||!Number.isFinite(actorIndex))throw Error('Ocular controller requires a finite seed and actor index');
  if(!Array.isArray(measuredEyes))throw Error('Measured eyes must be an array');
  const sourceSeed=Array.from(id).reduce((v,ch)=>Math.imul(v^ch.charCodeAt(0),16777619),2166136261);
  const actorSeed=(seed+sourceSeed+Math.imul(actorIndex+1,7411))|0;
  const eyes=[-1,1].map((side,index)=>{
    const descriptor=measuredEyes.find(e=>e.side===side)||{side},other=measuredEyes.find(e=>e.side!==side),eyeSeed=(actorSeed+index*13007)|0;
    return {side,seed:eyeSeed,cycle:-1,nextAt:.18+noise(eyeSeed,0,1)*.75,started:0,travel:.2,fromYaw:0,fromPitch:0,targetYaw:0,targetPitch:0,yaw:0,pitch:0,yawVelocity:0,pitchVelocity:0,yawAcceleration:0,pitchAcceleration:0,phase:'hold',basis:basisFor(descriptor,other),limits:limitsFor(descriptor)};
  });
  return {id,seed,actorIndex,actorSeed,time:0,rest:false,eyes,output:{leftYaw:0,leftPitch:0,rightYaw:0,rightPitch:0,yaw:0,pitch:0}};
}
function boundedTarget(yaw,pitch,limits){
  const y=limits.yaw>0?yaw/limits.yaw:0,p=limits.pitch>0?pitch/limits.pitch:0,scale=Math.max(1,Math.hypot(y,p));
  return [limits.yaw>0?yaw/scale:0,limits.pitch>0?pitch/scale:0];
}
function startScan(c,e,at,input){
  e.cycle++;e.fromYaw=e.targetYaw;e.fromPitch=e.targetPitch;
  const sharedCycle=Math.floor(at/4.7),sharedYaw=(noise(c.actorSeed,sharedCycle,71)*2-1),sharedPitch=(noise(c.actorSeed,sharedCycle,72)*2-1),home=noise(e.seed,e.cycle,2)<.16;
  let yaw=home?e.limits.yaw*.035*(noise(e.seed,e.cycle,3)*2-1):e.limits.yaw*(sharedYaw*.25+(noise(e.seed,e.cycle,3)*2-1)*.75),pitch=home?e.limits.pitch*.04*(noise(e.seed,e.cycle,4)*2-1):e.limits.pitch*(sharedPitch*.2+(noise(e.seed,e.cycle,4)*2-1)*.8);
  // Attention is sampled once at scan onset. Moving input never retargets a
  // saccade halfway through, or moves a supposedly fixed eye continuously.
  if(input.pointerLocal?.length===3&&input.pointerLocal.every(Number.isFinite)){
    const b=e.basis,ray=unit(input.pointerLocal.map((x,k)=>x-b.center[k]),b.optic),front=dot(ray,b.optic);
    if(front>.2){yaw=yaw*.75+clamp(Math.atan2(dot(ray,b.anterior),front),-e.limits.yaw,e.limits.yaw)*.25;pitch=pitch*.75+clamp(Math.atan2(dot(ray,b.up),front),-e.limits.pitch,e.limits.pitch)*.25;}
  }
  if(Number.isFinite(input.turnRate))yaw+=clamp(-input.turnRate*.025,-.025,.025);
  [e.targetYaw,e.targetPitch]=boundedTarget(yaw,pitch,e.limits);
  const distance=Math.hypot(e.targetYaw-e.fromYaw,e.targetPitch-e.fromPitch);
  // Quintic ease has maximum slope 1.875. The duration therefore guarantees
  // a vector angular speed <=1.65 rad/s even for a full-range opposite scan.
  e.travel=Math.max(.18+.07*noise(e.seed,e.cycle,5)+distance*.45,1.875*distance/1.65);
  e.started=at;e.nextAt=at+e.travel+1.15+noise(e.seed,e.cycle,6)*2.45;
}
function evaluate(e,time){
  const u=clamp((time-e.started)/e.travel,0,1),ease=u*u*u*(10+u*(-15+6*u)),slope=30*u*u*(1-u)*(1-u)/e.travel,acceleration=60*u*(1-u)*(1-2*u)/(e.travel*e.travel);
  const dy=e.targetYaw-e.fromYaw,dp=e.targetPitch-e.fromPitch;
  e.yaw=e.fromYaw+dy*ease;e.pitch=e.fromPitch+dp*ease;e.yawVelocity=dy*slope;e.pitchVelocity=dp*slope;e.yawAcceleration=dy*acceleration;e.pitchAcceleration=dp*acceleration;e.phase=u>=1?'hold':'saccade';
}
function output(c){const left=c.eyes[0],right=c.eyes[1],o=c.output;o.leftYaw=left.yaw;o.leftPitch=left.pitch;o.rightYaw=right.yaw;o.rightPitch=right.pitch;o.yaw=(left.yaw+right.yaw)*.5;o.pitch=(left.pitch+right.pitch)*.5;return o;}
export function update(c,dt,input={}){
  // Pause has priority over mode changes: holding a paused pose is exact.
  if(input.paused||!Number.isFinite(dt)||dt<=0)return c.output;
  if(String(input.mode||'cruise').toLowerCase()==='rest'){
    if(!c.rest)for(const e of c.eyes){e.fromYaw=e.targetYaw=e.yaw=0;e.fromPitch=e.targetPitch=e.pitch=0;e.yawVelocity=e.pitchVelocity=e.yawAcceleration=e.pitchAcceleration=0;e.started=c.time;e.nextAt=c.time+.18+noise(e.seed,e.cycle+1,9)*.9;e.phase='hold';}
    c.rest=true;return output(c);
  }
  c.rest=false;const end=c.time+Math.min(dt,.5);
  // Catch all events inside the accepted interval using exact event times.
  // Thus fixed/variable dt produces the same unforced seeded trajectory.
  for(const e of c.eyes){while(e.nextAt<=end+1e-12)startScan(c,e,e.nextAt,input);evaluate(e,end);}
  c.time=end;return output(c);
}
export function angles(c,side){const e=c.eyes[side===-1?0:1];return {yaw:e.yaw,pitch:e.pitch};}
export function eyeBasis(c,side){return c.eyes[side===-1?0:1].basis;}
export function snapshot(c){return {id:c.id,seed:c.seed,actorIndex:c.actorIndex,time:c.time,rest:c.rest,output:{...c.output},eyes:c.eyes.map(e=>({side:e.side,cycle:e.cycle,nextAt:e.nextAt,started:e.started,travel:e.travel,yaw:e.yaw,pitch:e.pitch,yawVelocity:e.yawVelocity,pitchVelocity:e.pitchVelocity,yawAcceleration:e.yawAcceleration,pitchAcceleration:e.pitchAcceleration,phase:e.phase,limits:{...e.limits}}))};}
export const VERSION='R04_OCULAR_1';
