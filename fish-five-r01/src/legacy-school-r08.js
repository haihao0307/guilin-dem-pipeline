// R14's measured fish, source geometry, habitat and instrument remain intact.
// Only its exposed school update is adapted to the shared local-interaction model.
export const BARRACUDA_SCHOOL_R08=Object.freeze({
 speed:.32,burst:.64,maxTurn:.28,maxAngularAcceleration:.34,
 maxAcceleration:.20,turnResponse:1.0,neighborCount:8,preferredGap:.07,gap:.035,
 bounds:[7,2.8,5],maxPitch:.24,maxRoll:.11,
 provenance:'ENGINEERING_CANDIDATE; world length/s; original source length and measured animated OBB retained'
});
export function installLegacySchool(api){
 const kernel=globalThis.FishSchoolingR08;
 if(!kernel)throw Error('Shared collective motion kernel missing');
 const native=api.school,r=api.renderer,resetAll=r.resetAll.bind(r);
 let current=null,simulation=null,views=null;
 const options={mode:'cruise',pointer:null,pointerRay:null,disturbance:null},disturbance={point:null,strength:0};
 function ensure(s){
  if(current===s)return simulation;
  current=s;
  views=s.fish.map(f=>({position:f.p,velocity:f.v,yaw:f.yaw,pitch:f.pitch,roll:f.roll,
   speed:Math.hypot(...f.v),turnRate:f.turnRate||0,threat:f.panic||0,length:f.variant.scale[0],
   half:native.SETTINGS.bodyHalfExtent.map((v,k)=>v*f.variant.scale[k]),previousVelocity:f.v.slice()}));
  simulation=kernel.create(views,BARRACUDA_SCHOOL_R08,90401);
  // Initial placement is prepared before the first visible frame. Runtime
  // contact handling must never teleport the accepted trajectory to make room.
  kernel.initialize(simulation,{gap:.24*simulation.length});
  for(let i=0;i<views.length;i++){const f=s.fish[i],v=views[i];f.yaw=v.yaw;f.pitch=v.pitch;f.roll=v.roll;f.axes=native.rotation(f,true);}
  s.mathR08=simulation;
  return simulation;
 }
 function step(s,dt){
  const sim=ensure(s),input=s.interaction;
  input.active+=((input.ray?1:0)-input.active)*(1-Math.exp(-dt*5));
  input.burst*=Math.exp(-dt*2.4);
  options.mode=({GLIDE:'hover',BURST:'burst',TURN_LEFT:'turn',TURN_RIGHT:'turn',REST:'rest'})[r.state.mode]||'cruise';
  options.pointerRay=input.ray;
  disturbance.point=input.burstPoint;disturbance.strength=input.burst;
  options.disturbance=input.burstPoint?disturbance:null;
  kernel.step(sim,dt,options);
  for(let i=0;i<views.length;i++){
   const v=views[i],f=s.fish[i];
   f.yaw=v.yaw;f.pitch=v.pitch;f.roll=v.roll;f.speed=v.speed;
   f.turnRate=f.yawRate=v.turnRate;f.panic=v.threat||0;f.directExposure=v.directExposure||0;
   // Preserve the accepted native gait limits and exponential response. School
   // speed/effort supplies the input; no new fin weights or surface approximation.
   const ratio=Math.max(.6,Math.min(1.5,v.speed/(.34*f.variant.size)));
   const frequency=Math.max(.78,Math.min(1.28,ratio**.58));
   let accelerationSquared=0;
   for(let k=0;k<3;k++){const component=(f.v[k]-v.previousVelocity[k])/Math.max(dt,1e-6);f.acceleration[k]=component;accelerationSquared+=component*component;v.previousVelocity[k]=f.v[k];}
   const acceleration=Math.sqrt(accelerationSquared);
   const amplitude=Math.max(.94,Math.min(1.18,.88+.16*ratio+.22*acceleration));
   const gain=1-Math.exp(-dt*2.4);
   f.gaitFrequency+=(frequency-f.gaitFrequency)*gain;f.gaitAmplitude+=(amplitude-f.gaitAmplitude)*gain;
   f.axes=native.rotation(f,true);f.half=v.half;
   if(v.neighborIds)f.neighborIds=v.neighborIds;
  }
  s.time=sim.time;s.steps++;
  s.minClearance=sim.contact.minimumClearance+sim.params.gap;
 }
 function update(s,delta,speed=1){
  s.accumulator+=Math.min(.12,Math.max(0,delta))*speed;
  while(s.accumulator+1e-12>=1/60){s.accumulator-=1/60;step(s,1/60);}
  return s;
 }
 api.school={...native,update};
 ensure(r.school);
 // The drawing interpolator must snapshot the already prepared reset state,
 // rather than blend an unsafe original packing into the new initial packing.
 r.resetAll=()=>{resetAll();ensure(r.school);};
 const result={kernel:'PARAMETERIZED_LOCAL_INTERACTION_R08',params:BARRACUDA_SCHOOL_R08,
  get simulation(){return ensure(r.school);},get views(){ensure(r.school);return views;},
  snapshot(){return kernel.snapshot(ensure(r.school));},
  dispose(){api.school=native;r.resetAll=resetAll;current=simulation=views=null;}};
 api.schoolR08=result;
 return result;
}
