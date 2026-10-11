/** Experimental geometry-constrained locomotion on the original 104-bone rig.
 * No alternate mesh, capture repetition, autonomous clock or physics claim.
 * Host positions/support samples share worldRoot coordinates in metres. */
import {NativeRig,math} from './sources/full/hand-body-r01/NativeRig.mjs';
const {pos,rotation,mv,mm3,axisRotation}=math;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
const lerp=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
const yawDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const rotate=(p,h)=>[Math.cos(h)*p[0]+Math.sin(h)*p[2],p[1],-Math.sin(h)*p[0]+Math.cos(h)*p[2]];
export const nativeToWorld=(p,root,heading,floorOffset)=>{const q=rotate([p[0],p[2]+floorOffset,-p[1]],heading);return q.map((x,i)=>x+root[i]);};
export const worldToNative=(p,root,heading,floorOffset)=>{const q=rotate(p.map((x,i)=>x-root[i]),-heading);return [q[0],-q[2],q[1]-floorOffset];};
export function createSupportWalker({human,standingFrame,soleIndices,sampleSupport,maxRise=.23,maxDrop=.43}={}) {
  if(typeof sampleSupport!=='function')throw Error('Real floor/tread support sampler required for continuous native walk');
  const h=human.height,rig=new NativeRig({names:human.names,parents:human.rig.parents,restMatrices:human.rig.restMatrices,stature:h}),stride=h*.36,duty=.60,calibration={};
  human.animate(standingFrame.skinMatrices);
  for(const side of ['L','R']){
    if(!soleIndices?.[side]?.length)throw Error('Original CSR sole indices missing');
    const points=soleIndices[side].map(i=>human.sampleVertex(i)),bottom=Math.min(...points.map(p=>p[2])),low=points.filter(p=>p[2]<=bottom+.002),contact=[0,0,bottom];
    for(const p of low){contact[0]+=p[0]/low.length;contact[1]+=p[1]/low.length;}
    const ankle=pos(standingFrame.posedMatrices[rig.index.get('foot.'+side)]);
    calibration[side]={contact,soleBandIndices:soleIndices[side].filter((_,i)=>points[i][2]<=bottom+.01),footprint:points.filter(p=>p[2]<=bottom+.035).map(p=>p.map((x,i)=>x-contact[i])),ankleOffset:ankle.map((x,i)=>x-contact[i]),footRotation:rotation(standingFrame.skinMatrices[rig.index.get('foot.'+side)])};
  }
  let state={distance:0,phaseOrigin:0,previous:null,heading:0,feet:null},latest=null;
  const support=(x,z,referenceY)=>{const p=sampleSupport({x,z,referenceY,maxRise,maxDrop});if(!p||!Number.isFinite(p.y)||!Array.isArray(p.normal)||p.normal.length!==3||!p.normal.every(Number.isFinite)||p.normal[1]<.999||p.y-referenceY>maxRise+1e-6||referenceY-p.y>maxDrop+1e-6)return null;return p;};
  function samplePath(trajectory,distance){
    const points=trajectory.points;let left=Math.max(0,Math.min(trajectory.totalLength,distance));
    for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(...b.map((x,k)=>x-a[k]));if(left<=length||i===points.length-1){const t=length?Math.min(1,left/length):0;return{point:lerp(a,b,t),heading:Math.atan2(b[0]-a[0],b[2]-a[2])};}left-=length;}
    throw Error('Actual path has no usable segment');
  }
  function fitFoot(side,point,heading,surface){
    if(!surface.bounds)return {point};
    const b=surface.bounds,clampTo=(p)=>[clamp(p[0],b.x0+.025,b.x1-.025),surface.y,clamp(p[2],b.z0+.025,b.z1-.025)],center=[(b.x0+b.x1)/2,surface.y,(b.z0+b.z1)/2];
    const initial=clampTo(point),candidates=[initial,[initial[0],surface.y,center[2]],[center[0],surface.y,initial[2]],center];
    // Add positions along this actual tread; never create a height or extend it.
    for(const fraction of [.2,.8,.35,.65])candidates.push([initial[0],surface.y,b.z0+(b.z1-b.z0)*fraction],[b.x0+(b.x1-b.x0)*fraction,surface.y,initial[2]]);
    let best=null;
    for(const c of candidates){let supported=0,blocked=false;for(const delta of calibration[side].footprint){const q=rotate([delta[0],delta[2],-delta[1]],heading),p=c.map((x,i)=>x+q[i]),s=sampleSupport({x:p[0],z:p[2],referenceY:surface.y,maxRise,maxDrop});if(!s)continue;if(p[1]-s.y<-.008){blocked=true;break;}if(Math.abs(s.y-surface.y)<.008)supported++;}const coverage=supported/calibration[side].footprint.length;if(blocked||coverage<.3)continue;const error=Math.hypot(c[0]-point[0],c[2]-point[2]);if(!best||error<best.error)best={point:c,coverage,error};}
    return best;
  }
  function footTarget(side,root,heading,referenceY,lead,previousY=referenceY,trajectory=null){
    const lateral=calibration[side].contact[0];
    for(const shortening of [1,.72,.44,.2,0]){
      const future=trajectory?samplePath(trajectory,trajectory.distanceAlong+lead*shortening):{point:root,heading},p=rotate([lateral,0,trajectory?0:lead*shortening],future.heading),x=future.point[0]+p[0],z=future.point[2]+p[2],surface=support(x,z,referenceY);
      if(!surface||surface.y-previousY>maxRise*2+1e-6||previousY-surface.y>maxDrop+1e-6)continue;
      const fit=fitFoot(side,[x,surface.y,z],future.heading,surface);if(!fit)continue;
      return {point:fit.point,heading:future.heading,supportId:surface.supportId||null,footprintSupportFraction:fit.coverage??null};
    }
    throw Error('No actual support for '+side+' foot; route or step exceeds bounds');
  }
  function initialize(root,heading){
    const feet={};for(const side of ['L','R']){const p=nativeToWorld(calibration[side].contact,root,heading,human.floorOffset),s=support(p[0],p[2],root[1]);if(!s)throw Error('Initial native '+side+' sole has no real support');feet[side]={point:[p[0],s.y,p[2]],heading,supportId:s.supportId||null,swing:null,cycle:0};}return feet;
  }
  function evaluate({elapsed,actor}) {
    if(!Number.isFinite(elapsed)||elapsed<0||!actor?.position?.every(Number.isFinite))throw Error('Finite host locomotion frame required');
    if(state.previous&&elapsed<state.previous.elapsed)throw Error('Native locomotion rewind requires a new actor');
    const old=state;state=structuredClone(state);
    try{
      const root=actor.position,desiredHeading=Math.hypot(actor.direction[0],actor.direction[2])>1e-9?Math.atan2(actor.direction[0],actor.direction[2]):state.heading;
      const dt=state.previous?elapsed-state.previous.elapsed:0,displacement=state.previous?Math.hypot(...root.map((x,i)=>x-state.previous.root[i])):0;
      const heading=state.previous?state.heading+clamp(yawDelta(desiredHeading,state.heading),-dt*2.5,dt*2.5):desiredHeading;
      if(displacement>h*.18+1e-8)throw Error('Host path frame skipped too far; advance continuous small steps');
      if(actor.moving){if(state.previous&&!state.previous.moving)state.phaseOrigin=state.distance;state.distance+=displacement;}
      if(!state.feet)state.feet=initialize(root,heading);
      const phase=(state.distance-state.phaseOrigin)/stride,plans={},footContacts={};
      const footError=side=>{const f=state.feet[side],q=rotate([calibration[side].contact[0],0,0],desiredHeading);return Math.hypot(f.point[0]-root[0]-q[0],f.point[2]-root[2]-q[2],(f.point[1]-root[1])*1.4);};
      let active=['L','R'].find(side=>state.feet[side].swing);
      if(active){
        const foot=state.feet[active],s=foot.swing;
        s.u=Math.max(s.u,actor.moving?clamp((state.distance-s.startDistance)/(h*.11)):clamp(s.u+dt/.24));
        // The other planted foot cannot be dragged along a tight landing turn.
        // Finish the already airborne step early before releasing that support.
        const supportSide=active==='L'?'R':'L';
        if(actor.moving&&footError(supportSide)>h*.23&&s.u>.55)s.u=1;
        const u=smooth(s.u),point=lerp(s.from,s.target.point,u),lift=(h*.04+Math.max(0,s.target.point[1]-s.from[1])*.35)*Math.sin(Math.PI*s.u)**2;
        point[1]+=lift;foot.point=point;foot.heading=s.fromHeading+yawDelta(s.target.heading,s.fromHeading)*u;
        if(s.u>=1){foot.point=[...s.target.point];foot.heading=s.target.heading;foot.supportId=s.target.supportId;foot.swing=null;state.lastSide=active;active=null;}
      }
      if(!active&&actor.moving&&Math.max(footError('L'),footError('R'))>h*.10){
        const left=footError('L'),right=footError('R'),side=Math.abs(left-right)<h*.03?(state.lastSide==='L'?'R':'L'):(left>right?'L':'R'),foot=state.feet[side];
        const target=footTarget(side,root,desiredHeading,root[1],h*.16,foot.point[1],actor.trajectory||null);
        foot.swing={from:[...foot.point],fromHeading:foot.heading,target,u:0,startDistance:state.distance};active=side;
      }
      for(const side of ['L','R']){
        const foot=state.feet[side],offset=rotate([calibration[side].ankleOffset[0],calibration[side].ankleOffset[2],-calibration[side].ankleOffset[1]],foot.heading),ankle=foot.point.map((x,i)=>x+offset[i]);
        plans[side]={target:worldToNative(ankle,root,heading,human.floorOffset),orientation:mm3(axisRotation([0,0,1],yawDelta(foot.heading,heading)),calibration[side].footRotation)};
        footContacts[side]={planted:!foot.swing,weight:foot.swing?0:1,worldSole:[...foot.point],supportId:foot.supportId,swingProgress:foot.swing?.u??null};
      }
      // Preserve the original standing torso/arms and all shape-specific rest bones.
      for(let j=0;j<rig.count;j++){rig.posedMatrices[j].set(standingFrame.posedMatrices[j]);rig.skinMatrices[j].set(standingFrame.skinMatrices[j]);}
      rig.rootTranslation=[...standingFrame.rootTranslation];
      let pelvisDrop=0;
      for(const side of ['L','R']){const limb=rig.limbs['leg'+side],hip=pos(rig.posedMatrices[limb.a]),target=plans[side].target,reach=(limb.upper+limb.lower)*.993,xy=(hip[0]-target[0])**2+(hip[1]-target[1])**2;if(xy>=reach**2)throw Error('Native foot target exceeds leg reach');pelvisDrop=Math.max(pelvisDrop,hip[2]-target[2]-Math.sqrt(reach**2-xy));}
      pelvisDrop=clamp(pelvisDrop,0,h*.16);
      if(pelvisDrop){for(const matrices of [rig.posedMatrices,rig.skinMatrices])for(const m of matrices)m[11]-=pelvisDrop;rig.rootTranslation[2]-=pelvisDrop;}
      let maxReachError=0;
      for(const side of ['L','R']){const limb=rig.limbs['leg'+side],hip=pos(rig.posedMatrices[limb.a]),plan=plans[side],result=rig.solveLimb(limb,plan.target,[hip[0],hip[1]-h*.35,hip[2]-h*.1],.995);rig.orientSkin(limb.c,plan.orientation);maxReachError=Math.max(maxReachError,result.reachError);footContacts[side].ankleErrorM=result.reachError;}
      if(maxReachError>.025)throw Error('Native step cannot preserve support within 25mm reach tolerance: '+JSON.stringify({maxReachError,pelvisDrop,feet:footContacts,plans}));
      if(actor.moving)for(const side of ['L','R']){const index=rig.index.get('upperarm01.'+side),angle=Math.sin(phase*Math.PI*2+(side==='L'?Math.PI:0))*.12;rig.rotateSubtree(index,axisRotation([1,0,0],angle));}
      const validation=rig.validate();if(!validation.finite||validation.maxBoneLengthError>1e-6)throw Error('Native bone length or finite transform validation failed');
      const metrics={...validation,maxReachError,pelvisDrop,strideM:stride,distanceM:state.distance,phase,stepUpLimitM:maxRise,stepDownLimitM:maxDrop};
      state.previous={elapsed,root:[...root],moving:actor.moving};state.heading=heading;
      latest={schema:'native-rescue-support-walk/1',heading,posedMatrices:rig.posedMatrices,skinMatrices:rig.skinMatrices,rootTranslation:rig.rootTranslation,footContacts,metrics,source:'Original NativeRig 104-bone FK/IK; distance-driven support-foot adapter',state:{pose:actor.pose,quality:'experimental; source geometry, CPU constraints and integrated visual review are separate'}};
      return latest;
    }catch(error){state=old;throw error;}
  }
  return {evaluate,rig,calibration,reset(){state={distance:0,phaseOrigin:0,previous:null,heading:0,feet:null};latest=null;},report(){return {schema:'native-rescue-support-walk/1',distanceM:state.distance,metrics:latest?.metrics||null,feet:latest?.footContacts||null,originalBoneCount:rig.count,originalSoleCounts:{L:soleIndices.L.length,R:soleIndices.R.length},independentClock:false,loopedCapture:false,supportSearchWindow:{aboveRootM:maxRise,belowRootM:maxDrop},footTransferLimits:{upM:maxRise*2,downM:maxDrop},physics:false,visualAcceptance:false};}};
}
