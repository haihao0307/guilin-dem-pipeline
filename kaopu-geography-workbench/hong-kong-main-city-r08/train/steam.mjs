/** R08 authored game exhaust: existing twin mouths and existing cylinder drains.
 * Visual transport only. Does not change DrivingPhysics, geometry, fuel or water.
 * No textures, timers, random wall-clock seeds, physics substitute, or pre-aged cloud.
 */
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const hash=n=>{let x=(n|0)^0x9e3779b9;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return ((x^(x>>>15))>>>0)/4294967296;};
const finite=(x,fallback=0)=>Number.isFinite(x)?x:fallback;
export const STEAM_DESIGN=Object.freeze({revision:'R08_DRIVE_LINKED_EXHAUST_1',mainLifeS:8,sideLifeS:2.6,purgeDurationS:3,launchDurationS:6,defaultCapacity:384,fluidSimulation:false,sideRole:'existing authored cylinder-drain candidates, game-visual discharge only'});

/** Read exact declared drain locations from the retained assembly, not a new A6.
 * Converts each owner's native frame to train.root native frame, without edits.
 */
export function resolveRetainedSideSockets(T,train){
 if(!train?.root)throw Error('Retained train.root required');
 train.root.updateMatrixWorld(true);
 const inv=new T.Matrix4().copy(train.root.matrixWorld).invert(),result=[],ids=new Set();
 train.root.traverse(owner=>{
  if(owner.userData?.mother!=='boiler-service-plumbing'||!Array.isArray(owner.userData.ports))return;
  const matrix=new T.Matrix4().multiplyMatrices(inv,owner.matrixWorld);
  for(const port of owner.userData.ports){
   if(!/^(left|right)-drain$/.test(port.id))continue;
   if(ids.has(port.id))throw Error('Duplicate retained drain '+port.id);ids.add(port.id);
   const position=new T.Vector3(...port.positionM).applyMatrix4(matrix),side=Math.sign(port.positionM[1]);
   // The retained union mouth points forward. The authored jet fans outwards,
   // never backwards toward the cab. This is not a solved condensate trajectory.
   const direction=new T.Vector3(.72,side,0).transformDirection(matrix);
   result.push({id:port.id,positionM:position.toArray(),direction:direction.toArray(),source:'retained boiler-service-plumbing port',functionUnverified:port.physicalDrainState==null});
  }
 });
 if(result.length!==2||!result.some(p=>p.positionM[1]>0)||!result.some(p=>p.positionM[1]<0))throw Error('Expected the two retained left/right cylinder-drain ports');
 return result.sort((a,b)=>a.positionM[1]-b.positionM[1]);
}

/** Same native X-forward/Y-left/Z-up -> host Y-up transform as train/install. */
export function nativeToWorld(vector,pose,direction=false){
 const yaw=Math.atan2(pose.f[2],pose.f[0]),grade=Math.atan(pose.grade||0),c=Math.cos(yaw),s=Math.sin(yaw),cg=Math.cos(grade),sg=Math.sin(grade),[x,y,z]=vector,u=cg*x-sg*z;
 return[c*u+s*y+(direction?0:pose.p[0]),sg*x+cg*z+(direction?0:pose.p[1]),s*u-c*y+(direction?0:pose.p[2])];
}
function readState(state,exhaust){
 for(const k of ['timeS','positionM','speedMps'])if(!Number.isFinite(state?.[k]))throw Error('Finite DrivingPhysics '+k+' required');
 const phase=exhaust?.phase??'running';if(!['ready','purge','launch','running','stopping'].includes(phase))throw Error('Unknown exhaust phase: '+phase);
 return{t:state.timeS,d:state.positionM,v:state.speedMps,a:finite(state.accelerationMps2),throttle:clamp(finite(state.controls?.throttle)),brake:clamp(finite(state.controls?.brake)),pressure:clamp((finite(state.boilerPressurePa)-120000)/1680000),flow:Math.max(0,finite(state.diagnostics?.steamFlowKgS)),phase,phaseElapsed:Math.max(0,finite(exhaust?.phaseElapsedS)),purgeDuration:Math.max(.1,finite(exhaust?.purgeDurationS,3)),launchDuration:Math.max(.1,finite(exhaust?.launchDurationS,6)),resetId:exhaust?.resetId??null};
}
export function evaluateEmission(s){
 const load=clamp(s.flow/9+s.throttle*.35+Math.max(0,s.a*Math.sign(s.v||1))*.3),purge=s.phase==='purge'?( .68+.32*smooth(0,.3,s.phaseElapsed))*(1-.22*smooth(s.purgeDuration-.55,s.purgeDuration,s.phaseElapsed)):0;
 const launch=s.phase==='launch'?.62*(1-smooth(0,s.launchDuration,s.phaseElapsed)):0;
 // Coasting downhill does not fabricate a power exhaust or braking release.
 const accelerating=clamp(s.a*Math.sign(s.v||1)/.28)*s.throttle*.28;
 const braking=clamp(Math.abs(s.v)/1.2)*s.brake*(.14+.31*clamp(-s.a*Math.sign(s.v||1)/.45));
 return{main: s.pressure*(.16+.84*load),side:s.pressure*clamp(Math.max(purge,launch,accelerating,braking)),load,purge,launch,braking,accelerating};
}
function between(a,b,t){
 const u=clamp((t-a.t)/(b.t-a.t||1)),r={...b,t};
 for(const k of ['d','v','a','throttle','brake','pressure','flow'])r[k]=mix(a[k],b[k],u);
 // Preserve phase boundaries when a low frame rate straddles the host transition.
 const phaseStart=b.t-b.phaseElapsed;
 if(a.phase!==b.phase&&t<phaseStart-1e-9){r.phase=a.phase;r.phaseElapsed=a.phaseElapsed+t-a.t;r.purgeDuration=a.purgeDuration;r.launchDuration=a.launchDuration;}
 else r.phaseElapsed=Math.max(0,b.phaseElapsed+t-b.t);
 return r;
}

/** Renderer-free fixed-birth clock, suitable for CPU timing and replay tests. */
export function createSteamSimulation({route,nativeSockets,nativeSideSockets=[],capacity=384,intensity=1.6}={}){
 if(typeof route?.sample!=='function'||!Array.isArray(nativeSockets)||nativeSockets.length!==2)throw Error('Existing route and exactly two main exhaust sockets required');
 if(!Number.isInteger(capacity)||capacity<48||capacity>2048)throw Error('Steam capacity must be an integer in [48,2048]');
 const valid=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
 if(!nativeSockets.every(valid)||!nativeSideSockets.every(p=>valid(p.positionM)&&valid(p.direction)))throw Error('Finite native exhaust socket coordinates required');
 const mainCapacity=Math.floor(capacity*2/3/2)*2,sideCapacity=capacity-mainCapacity,mainRate=mainCapacity/2/STEAM_DESIGN.mainLifeS,sideRate=Math.min(20,sideCapacity/2/STEAM_DESIGN.sideLifeS),particles=Array(capacity).fill(null),centres=new Float32Array(capacity*3),shapes=new Float32Array(capacity*4),details=new Float32Array(capacity*4);
 const sides=[nativeSideSockets.filter(p=>p.positionM[1]<0),nativeSideSockets.filter(p=>p.positionM[1]>0)];
 let previous=null,origin=0,mainTick=0,sideTick=0,mainHead=0,sideHead=0,serial=0,resets=0,lastStats=null,enabled=true;
 function setIntensity(value){if(!Number.isFinite(value)||value<0||value>3)throw Error('Steam intensity in [0,3]');intensity=value;}
 setIntensity(intensity);
 function reset(){particles.fill(null);centres.fill(0);shapes.fill(0);details.fill(0);previous=null;mainTick=sideTick=mainHead=sideHead=serial=0;resets++;}
 function emit(t,index,kind,s){
  const emission=evaluateEmission(s),strength=kind?emission.side:emission.main;if(strength<.002)return;
  const group=sides[index],port=kind?group[Math.floor(sideTick)%group.length]:null;if(kind&&!port)return;
  const native=kind?port.positionM:nativeSockets[index],pose=route.sample(s.d),position=nativeToWorld(native,pose),forward=nativeToWorld([1,0,0],pose,true),seed=(kind?1000003+sideTick*7:mainTick*7)+index,jitter=hash(seed+100);
  const direction=kind?nativeToWorld(port.direction,pose,true):[0,1,0];
  const slot=kind?mainCapacity+(sideHead++%sideCapacity):mainHead++%mainCapacity;
  particles[slot]={born:t,kind,position,forward,direction,speed:s.v,strength,load:emission.load,seed,sourceId:kind?port.id:'main-'+index,life:kind?STEAM_DESIGN.sideLifeS:STEAM_DESIGN.mainLifeS,width:.86+.28*jitter,swirl:hash(seed+700)*Math.PI*2};
 }
 function update(state,options={}){
  enabled=options.enabled!==false;const current=readState(state,options.exhaust);
  const dt=previous?current.t-previous.t:0,teleport=previous&&Math.abs(current.d-previous.d)>Math.max(25,(Math.abs(current.v)+Math.abs(previous.v))*.5*Math.max(0,dt)+3);
  if(previous&&(dt< -1e-9||current.resetId!==previous.resetId||teleport))reset();
  if(!previous){origin=current.t;previous={...current};}
  // At most the visible lifetime is reconstructed after a long clock gap. No
  // wall-clock catch-up, birth timer, or memory history can grow without bound.
  mainTick=Math.max(mainTick,Math.ceil(Math.max(0,current.t-origin-STEAM_DESIGN.mainLifeS)*mainRate));
  sideTick=Math.max(sideTick,Math.ceil(Math.max(0,current.t-origin-STEAM_DESIGN.sideLifeS)*sideRate));
  if(current.t>previous.t+1e-10){
   while(origin+mainTick/mainRate<=current.t+1e-9){const t=origin+mainTick/mainRate,s=between(previous,current,t);for(let i=0;i<2;i++)emit(t,i,0,s);mainTick++;}
   while(origin+sideTick/sideRate<=current.t+1e-9){const t=origin+sideTick/sideRate,s=between(previous,current,t);for(let i=0;i<2;i++)emit(t,i,1,s);sideTick++;}
  }
  centres.fill(0);shapes.fill(0);details.fill(0);
  let alive=0,mainAlive=0,sideAlive=0,maximumRadius=0;
  for(let i=0;i<capacity;i++){
   const p=particles[i],offset=i*4;if(!p){shapes[offset+2]=0;continue;}
   const age=current.t-p.born,u=age/p.life;if(age<0||u>=1){particles[i]=null;shapes[offset+2]=0;continue;}
   const h=hash(p.seed+500),turn=p.swirl+age*(.65+h*.4),phase=age*Math.PI*1.1+p.swirl;
   let x,y,z,radius,alpha,aspect;
   if(p.kind){
    // Outward/forward low jet, then a little buoyancy after clearing the body.
    const travel=(2.7+.9*p.strength)*(1-Math.exp(-age/1.1)),rise=.045*age+.12*age*age;
    x=p.position[0]+p.direction[0]*travel+p.forward[0]*p.speed*.12*age;
    y=p.position[1]+p.direction[1]*travel+rise;
    z=p.position[2]+p.direction[2]*travel+p.forward[2]*p.speed*.12*age;
    radius=(.085+.25*age+.07*age*age)*p.width;aspect=.82+.15*u;
    alpha=.105*p.strength*smooth(0,.075,age)*(1-smooth(.30,1,u));
   }else{
    const swell=smooth(0,1.7,age),swirl=(.045+.18*age)*swell,rise=1.15*age+.6*(1-Math.exp(-age*1.8));
    x=p.position[0]+.32*age+p.forward[0]*p.speed*.17*(1-Math.exp(-age/.85))+Math.cos(turn)*swirl;
    y=p.position[1]+rise+Math.sin(phase)*.075*swell;
    z=p.position[2]+.11*age+p.forward[2]*p.speed*.17*(1-Math.exp(-age/.85))+Math.sin(turn)*swirl;
    radius=(.18+.31*age+.018*age*age)*p.width*(.88+.28*p.load);aspect=1.08+.15*Math.sin(p.swirl);
    alpha=(.045+.065*p.strength)*smooth(0,.14,age)*Math.pow(1-u,1.35)*(1-.20*smooth(.35,.8,u));
   }
   centres.set([x,y,z],i*3);shapes.set([radius,hash(p.seed+19),enabled?alpha*intensity:0,age],offset);details.set([aspect,p.swirl+age*.065,p.kind,u],offset);
   if(alpha*intensity>.0001){alive++;if(p.kind)sideAlive++;else mainAlive++;maximumRadius=Math.max(maximumRadius,radius);}
  }
  previous={...current};const emission=evaluateEmission(current);
  lastStats={enabled:enabled&&intensity>0,capacity,alivePuffs:enabled?alive:0,mainAlivePuffs:enabled?mainAlive:0,sideAlivePuffs:enabled?sideAlive:0,intensity,sourceSocketCount:nativeSockets.length,sideSocketCount:nativeSideSockets.length,source:'retained twin hollow mouths and retained cylinder-drain candidates',worldTimeS:current.t,phase:current.phase,phaseElapsedS:current.phaseElapsed,emission,steamFlowKgS:current.flow,boilerPressurePa:state.boilerPressurePa,maximumRadiusM:maximumRadius,deterministic:true,simulationTimeOnly:true,fluidSimulation:false,warmStartVisualEnvelope:false,originalGeometryModified:false,depthTest:true,depthWrite:false,resetCount:resets,perFrameParticleBound:capacity,drawCalls:1,gpuAttributeBytes:centres.byteLength+shapes.byteLength+details.byteLength};
  return lastStats;
 }
 return{capacity,centres,shapes,details,update,reset,setIntensity,stats:()=>lastStats,inspectParticles:()=>particles.filter(Boolean).map(p=>({...p,position:p.position.slice(),direction:p.direction.slice(),forward:p.forward.slice()}))};
}

export function createHostSteam(T,options={}){
 const simulation=createSteamSimulation(options),base=new T.PlaneGeometry(2,2),geometry=new T.InstancedBufferGeometry();
 geometry.index=base.index;geometry.attributes.position=base.attributes.position;geometry.attributes.uv=base.attributes.uv;geometry.instanceCount=simulation.capacity;
 for(const[name,array,size]of[['puffCenter',simulation.centres,3],['puffShape',simulation.shapes,4],['puffDetail',simulation.details,4]])geometry.setAttribute(name,new T.InstancedBufferAttribute(array,size).setUsage(T.DynamicDrawUsage));
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,toneMapped:false,uniforms:{steamTint:{value:new T.Color('#e8efed')}},vertexShader:`
 attribute vec3 puffCenter;attribute vec4 puffShape;attribute vec4 puffDetail;
 varying vec2 q;varying vec4 shape;varying vec4 detail;varying float viewDistance;
 void main(){q=uv*2.-1.;shape=puffShape;detail=puffDetail;vec4 p=modelViewMatrix*vec4(puffCenter,1.);viewDistance=length(p.xyz);float c=cos(puffDetail.y),s=sin(puffDetail.y);vec2 xy=position.xy*vec2(1.,puffDetail.x);p.xy+=mat2(c,-s,s,c)*xy*puffShape.x;gl_Position=projectionMatrix*p;}
 `,fragmentShader:`
 precision highp float;varying vec2 q;varying vec4 shape;varying vec4 detail;varying float viewDistance;uniform vec3 steamTint;
 float hash2(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32+shape.y*13.);return fract(p.x*p.y);}
 float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash2(i),hash2(i+vec2(1.,0.)),f.x),mix(hash2(i+vec2(0.,1.)),hash2(i+1.),f.x),f.y);}
 void main(){
  if(shape.z<.00005)discard;
  vec2 drift=vec2(shape.w*.045,-shape.w*.072),warp=vec2(noise2(q*2.2+drift),noise2(q*2.2+8.+drift))-.5;
  vec2 p=q+warp*.25;float r=length(p);float low=noise2(p*2.5+drift),fine=noise2(p*6.2-drift*.7),density=.60+.26*low+.14*fine;
  float edge=.86+.14*low,aa=max(fwidth(r),.015),envelope=1.-smoothstep(edge-.42,edge+aa,r);
  float alpha=envelope*density*shape.z*smoothstep(.35,1.6,viewDistance);
  if(alpha<.0005)discard;
  // Authored soft self-shading; not a solved volumetric lighting field.
  float light=.79+.16*low+.05*smoothstep(-.8,.7,p.y);vec3 tint=mix(steamTint*light,steamTint,.12+detail.z*.10);
  gl_FragColor=vec4(tint,alpha);
 }
 `});
 const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=8;mesh.name='R08 twin-main and paired side-drain game steam';
 function update(state,opts){const result=simulation.update(state,opts);mesh.visible=result.enabled&&result.alivePuffs>0;for(const key of ['puffCenter','puffShape','puffDetail'])geometry.attributes[key].needsUpdate=true;return result;}
 return{mesh,update,setIntensity:simulation.setIntensity,reset:simulation.reset,stats:simulation.stats,dispose(){geometry.dispose();base.dispose();material.dispose();}};
}
