// Simulate the original solver at its native 60 Hz, then interpolate only the
// school drawing pose between the last two accepted states. The original
// instrument is updated once per frame, including its frozen eye controller.
export function interpolateLegacyPresentation(api){
 const r=api.renderer,step=1/60,advance=r.advance.bind(r),upload=r.uploadPoses.bind(r);
 let remaining=0,school=null,mode=null,previous=null,current=null,saved=null,alpha=0;
 const snapshot=()=>({fish:r.school.fish.map(f=>({p:f.p.slice(),yaw:f.yaw,pitch:f.pitch,roll:f.roll}))});
 const modeKey=()=>String(r.state.school)+':'+r.state.mode;
 function initialize(){school=r.school;mode=modeKey();previous=current=snapshot();remaining=0;alpha=0;}
 r.advance=dt=>{
  if(school!==r.school||mode!==modeKey())initialize();
  const translating=r.state.school&&!['REST','IDLE','FIN_FAN','JAW','EYE_TRACK'].includes(r.state.mode);
  if(translating){const rate=r.state.speed*Math.max(0,Math.min(1.6,r.state.amplitude));remaining=r.school.accumulator+Math.min(.12,Math.max(0,dt))*rate;r.school.accumulator=0;
   while(remaining+1e-12>=step){previous=current;api.school.update(r.school,step,1);current=snapshot();remaining-=step;}
   r.school.accumulator=remaining;alpha=Math.max(0,Math.min(1,remaining/step));
  }else {alpha=1;previous=current=snapshot();}
  // Identical instrument options and delta to the original r.advance. Do not
  // repeatedly materialize its dense surface fields at each school substep.
  for(const i of r.state.school?r.actors.map((_,j)=>j):[r.state.selected]){const f=r.school.fish[i],options={...r.state,speed:r.state.speed*f.variant.tempo,amplitude:r.state.amplitude*(translating?f.gaitAmplitude:1),gaitFrequencyScale:translating?f.gaitFrequency:1,eyeYawOffset:r.state.eyeYawOffset+f.variant.eyeOffset,eyeSeed:90401+i*7411};api.instrument.update(r.actors[i],dt,options);}
 };
 const displayFish=[];
 function restore(){if(!saved)return;for(let i=0;i<r.actors.length;i++){const f=r.school.fish[i],s=saved.fish[i];f.p=s.p;f.yaw=s.yaw;f.pitch=s.pitch;f.roll=s.roll;}saved=null;}
 r.uploadPoses=()=>{if(school!==r.school||mode!==modeKey())initialize();if(!r.state.school)return upload();restore();saved={fish:r.school.fish.map(f=>({p:f.p,yaw:f.yaw,pitch:f.pitch,roll:f.roll}))};
  for(let i=0;i<r.actors.length;i++){const f=r.school.fish[i],a=previous.fish[i],b=current.fish[i];f.p=a.p.map((v,k)=>v+(b.p[k]-v)*alpha);f.yaw=a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*alpha;f.pitch=a.pitch+(b.pitch-a.pitch)*alpha;f.roll=a.roll+(b.roll-a.roll)*alpha;displayFish[i]={p:f.p.slice(),yaw:f.yaw,pitch:f.pitch,roll:f.roll};}
  return upload();
 };
 return {restore,get alpha(){return alpha;},get displayFish(){return displayFish;},get displayFields(){return r.actors.map(h=>h.state.field);},get accepted(){return current;},dispose(){restore();r.advance=advance;r.uploadPoses=upload;}};
}
