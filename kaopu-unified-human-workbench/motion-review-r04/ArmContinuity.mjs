import {NativeRig,math} from '../full/hand-body-r01/NativeRig.mjs';
const {sub,add,scale,dot,cross,norm,unit,pos,rotation,mv,basisRotation,lerp,smooth,clamp}=math;

/** The capture supplies elbow positions, but does not define native humeral roll.
 * Fit a complete two-vector frame instead of accumulating shortest-arc rotations.
 * This changes rotations only; the authored hierarchy and all helper bones stay.
 */
export class ArmContinuity {
 constructor(binding){this.rig=new NativeRig({...binding.rig,stature:binding.height});this.height=binding.height;this.previous={};this.report={mode:'native segment + bend-plane calibration',maxWristBendDegrees:0,maxEndpointChangeM:0};}
 apply(frame,{gesture=false}={}){
  const r=this.rig;
  for(let j=0;j<r.count;j++){
   const m=frame.posedMatrices[j],inv=r.inverseRest[j],out=r.skinMatrices[j];r.posedMatrices[j].set(m);
   for(let a=0;a<3;a++){for(let b=0;b<3;b++)out[a*4+b]=m[a*4]*inv[b]+m[a*4+1]*inv[4+b]+m[a*4+2]*inv[8+b];out[a*4+3]=m[a*4]*inv[3]+m[a*4+1]*inv[7]+m[a*4+2]*inv[11]+m[a*4+3];}
  }
  for(const s of ['L','R']){
   const l=r.limbs['arm'+s],A=pos(r.posedMatrices[l.a]),B=pos(r.posedMatrices[l.b]),C=pos(r.posedMatrices[l.c]);
   const U=unit(sub(B,A)),F=unit(sub(C,B)),u0=unit(sub(r.restP[l.b],r.restP[l.a])),f0=unit(sub(r.restP[l.c],r.restP[l.b]));
   const n0=unit(cross(u0,f0)),measured=cross(U,F),bend=norm(measured);
   const root=rotation(r.skinMatrices[r.index.get('root')]);
   // A nearly straight elbow has no reliable bend plane. Preserve a transported
   // anatomical plane there; do not let tiny source noise flip the whole arm.
   let fallback=mv(root,n0);fallback=unit(sub(fallback,scale(U,dot(fallback,U))));
   if(this.previous[s]){const old=this.previous[s];fallback=unit(sub(old,scale(U,dot(old,U))),fallback);}
   let N=bend>.0001?unit(measured):fallback;
   const reliability=smooth(clamp((bend-.025)/.11,0,1));N=unit(lerp(fallback,N,reliability));this.previous[s]=N;
   r.orientSkin(l.a,basisRotation(u0,n0,U,N));
   r.orientSkin(l.b,basisRotation(f0,n0,F,N));
   const beforeHand=rotation(r.skinMatrices[l.c]),g=r.hand[s];
   let palm=gesture?mv(beforeHand,g.palm):mv(root,[s==='L'?-1:1,0,0]);
   palm=unit(sub(palm,scale(F,dot(palm,F))));
   // Unmeasured wrist/finger channels never impose an extreme bent wrist.
   // Native wrist is aligned with the solved forearm; finger curl is separate.
   r.orientSkin(l.c,basisRotation(g.forward,g.palm,F,palm));
   const actualForward=unit(mv(rotation(r.skinMatrices[l.c]),g.forward));this.report.maxWristBendDegrees=Math.max(this.report.maxWristBendDegrees,Math.acos(clamp(dot(actualForward,F),-1,1))*180/Math.PI);
   this.report.maxEndpointChangeM=Math.max(this.report.maxEndpointChangeM,norm(sub(pos(r.posedMatrices[l.c]),C)));
  }
  return {...frame,posedMatrices:r.posedMatrices,skinMatrices:r.skinMatrices,armCalibration:this.report};
 }
}

/** One constant heading transform for the entire source, including its root
 * path. Never rotate just the actor while leaving footsteps in source space. */
export function canonicalSource(source){
 const n=source.names,first=source.points[0],L=first[n.indexOf('lhipjoint')],R=first[n.indexOf('rhipjoint')];
 if(!L||!R)throw Error('Source pelvis landmarks missing');
 const yaw=Math.atan2(L[2]-R[2],L[0]-R[0]),c=Math.cos(yaw),s=Math.sin(yaw),ox=(L[0]+R[0])*.5,oz=(L[2]+R[2])*.5;
 return {...source,points:source.points.map(f=>f.map(([x,y,z])=>{x-=ox;z-=oz;return[c*x+s*z,y,-s*x+c*z];})),headingCalibration:{radians:yaw,origin:[ox,oz],sourceUnmodified:true,method:'initial pelvis left-right axis, applied to every frame and root path'}};
}
