import {NativeRig,math} from '../../../src/NativeRig.mjs';
const {add,sub,scale,dot,norm,unit,pos,rotation,mv,lerp,smooth,clamp,axisRotation,mm3}=math;
const row=m=>m.clone().transpose().toArray();

/** Reconstruct finite foot-contact runs using a mid-stance sole reference.
 * Locking the ankle at the first 1% of a contact ramp instead would pin an
 * airborne heel and create a discontinuity at release. Preserve heel/toe roll.
 */
export function lockFiniteSupport(frames,weights,binding,sampler,footInfo){
 const r=new NativeRig({...binding.rig,stature:binding.height}),snapshots=frames.map(f=>{sampler.apply(f);return{world:sampler.world.map(row),skin:sampler.skin.map(m=>m.slice())};}),plans={L:[],R:[]};
 for(const s of ['L','R']){
  let i=0;while(i<frames.length){if(weights[i][s]<.01){i++;continue;}const start=i;while(i<frames.length&&weights[i][s]>=.01)i++;const end=i,fully=[];for(let k=start;k<end;k++)if(weights[k][s]>.98)fully.push(k);const mid=fully.length?fully[Math.floor(fully.length*.45)]:Math.floor((start+end-1)*.5),l=r.limbs['leg'+s],m=snapshots[mid],A=pos(m.world[l.c]),R=rotation(m.skin[l.c]),f=footInfo[s],forward=mv(R,sub(f.toe,f.ankle));
   const lock={heel:add(A,mv(R,f.heelPivot)),toe:add(A,mv(R,f.toePivot)),yaw:Math.atan2(forward[1],forward[0])};for(let k=start;k<end;k++)plans[s][k]=lock;
  }
 }
 let maxPlantErrorM=0,maxReachErrorM=0,maxPelvisDropM=0,maxSoleFloorErrorM=0;
 for(let i=0;i<frames.length;i++){
  for(let j=0;j<r.count;j++){r.posedMatrices[j].set(snapshots[i].world[j]);r.skinMatrices[j].set(snapshots[i].skin[j]);}
  const targets={};
  for(const s of ['L','R']){const lock=plans[s][i];if(!lock)continue;const w=weights[i][s],l=r.limbs['leg'+s],f=footInfo[s],R=rotation(r.skinMatrices[l.c]),forward=mv(R,sub(f.toe,f.ankle)),yaw=Math.atan2(forward[1],forward[0]),dyaw=Math.atan2(Math.sin(lock.yaw-yaw),Math.cos(lock.yaw-yaw)),orient=mm3(axisRotation([0,0,1],dyaw*w),R),heel=mv(orient,f.heelPivot),toe=mv(orient,f.toePivot),roll=smooth((heel[2]-toe[2]+.014)/.028),p=lerp(sub(lock.heel,heel),sub(lock.toe,toe),roll),A=pos(r.posedMatrices[l.c]);
   const minOffset=Math.min(...f.points.map(p=>mv(orient,sub(p,f.ankle))[2]));p[2]=-binding.floorOffset-minOffset;
   targets[s]={p:lerp(A,p,w),R:orient,pole:pos(r.posedMatrices[l.b]),weight:w,minOffset};
  }
  let drop=0;for(const [s,t] of Object.entries(targets)){const l=r.limbs['leg'+s],h=pos(r.posedMatrices[l.a]),v=sub(h,t.p),reach=(l.upper+l.lower)*.992,xy=v[0]*v[0]+v[1]*v[1];if(xy<reach*reach)drop=Math.max(drop,v[2]-Math.sqrt(reach*reach-xy));}
  drop=clamp(drop,0,binding.height*.12);maxPelvisDropM=Math.max(maxPelvisDropM,drop);
  if(drop>0)for(const matrices of [r.posedMatrices,r.skinMatrices])for(const m of matrices)m[11]-=drop;
  for(const [s,t] of Object.entries(targets)){const l=r.limbs['leg'+s],solved=r.solveLimb(l,t.p,sub(t.pole,[0,0,drop]),.992);r.orientSkin(l.c,t.R);maxReachErrorM=Math.max(maxReachErrorM,solved.reachError);if(t.weight>.99){maxPlantErrorM=Math.max(maxPlantErrorM,norm(sub(pos(r.posedMatrices[l.c]),t.p)));maxSoleFloorErrorM=Math.max(maxSoleFloorErrorM,Math.abs(pos(r.posedMatrices[l.c])[2]+t.minOffset+binding.floorOffset));}}
  frames[i]=sampler.pack(r.posedMatrices);
 }
 return{mode:'finite mid-stance heel/toe anchors + pelvis reach correction',maxPlantErrorM,maxReachErrorM,maxPelvisDropM,maxSoleFloorErrorM};
}

