// Simulate the original solver at its native 60 Hz, then interpolate only the
// drawing pose between the last two accepted states. Never feed a display pose
// back into collision, steering, source fields or the frozen eye controller.
export function interpolateLegacyPresentation(api){
 const r=api.renderer,step=1/60,advance=r.advance.bind(r),upload=r.uploadPoses.bind(r);
 let remaining=0,school=null,mode=null,previous=null,current=null,saved=null,alpha=0;
 const snapshot=()=>({fish:r.school.fish.map(f=>({p:f.p.slice(),yaw:f.yaw,pitch:f.pitch,roll:f.roll})),fields:r.actors.map(h=>h.state.field.slice())});
 function initialize(){school=r.school;mode=r.state.school;previous=current=snapshot();remaining=0;alpha=0;}
 r.advance=dt=>{if(school!==r.school||mode!==r.state.school)initialize();remaining+=Math.min(.12,Math.max(0,dt));while(remaining+1e-10>=step){previous=current;advance(step);current=snapshot();remaining-=step;}alpha=Math.max(0,Math.min(1,remaining/step));};
 const fields=r.actors.map(h=>new Float32Array(h.state.field.length)),displayFish=[];
 function restore(){if(!saved)return;for(let i=0;i<r.actors.length;i++){const f=r.school.fish[i],s=saved.fish[i];f.p=s.p;f.yaw=s.yaw;f.pitch=s.pitch;f.roll=s.roll;r.actors[i].state.field=saved.fields[i];}saved=null;}
 r.uploadPoses=()=>{if(school!==r.school||mode!==r.state.school)initialize();if(!r.state.school)return upload();restore();saved={fish:r.school.fish.map(f=>({p:f.p,yaw:f.yaw,pitch:f.pitch,roll:f.roll})),fields:r.actors.map(h=>h.state.field)};
  for(let i=0;i<r.actors.length;i++){const f=r.school.fish[i],a=previous.fish[i],b=current.fish[i];f.p=a.p.map((v,k)=>v+(b.p[k]-v)*alpha);f.yaw=a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*alpha;f.pitch=a.pitch+(b.pitch-a.pitch)*alpha;f.roll=a.roll+(b.roll-a.roll)*alpha;displayFish[i]={p:f.p.slice(),yaw:f.yaw,pitch:f.pitch,roll:f.roll};for(let k=0;k<fields[i].length;k++)fields[i][k]=previous.fields[i][k]+(current.fields[i][k]-previous.fields[i][k])*alpha;r.actors[i].state.field=fields[i];}
  return upload();
 };
 return {restore,get alpha(){return alpha;},get displayFish(){return displayFish;},get displayFields(){return fields;},get accepted(){return current;},dispose(){restore();r.advance=advance;r.uploadPoses=upload;}};
}
