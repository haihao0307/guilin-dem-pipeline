import {createCapturedActivityController} from './CapturedController.mjs';
import {NativeRig,math} from '../../../src/NativeRig.mjs';
import {THREE} from '../../../src/NativeBinding.mjs';
const {add,sub,scale,dot,norm,unit,lerp,pos,rotation,mv,smooth,clamp}=math;
const delay=()=>new Promise(r=>setTimeout(r,0)),copy=p=>({q:p.q.slice(),p:p.p.slice()});
const row=m=>m.clone().transpose().toArray();
function blend(a,b,t,displacement=null,root=0){const q=a.q.slice(),p=a.p.slice();for(let j=0;j<q.length;j+=4)THREE.Quaternion.slerpFlat(q,j,a.q,j,b.q,j,t);for(let j=0;j<p.length;j++)p[j]+=((b.p[j]+(displacement&&j>=root*3&&j<root*3+3?displacement[j-root*3]:0))-p[j])*t;return{q,p};}
/** A stride is chosen from a moving portion of a capture. The final interval
 * overlaps recorded pre-start context, not an artificial stop. The runtime
 * accumulates travel instead of teleporting at each repeat. */
export async function buildCapturedClip(human,rowDef,source,sampler,{alive=()=>true,notify=()=>{},decorate=x=>x}={}){
 const start=performance.now(),ctl=createCapturedActivityController(human,source),motion=ctl.motion;motion.referenceFrame=source.referenceFrame??motion.referenceFrame;
 motion.rig.exportNativePose=()=>{};
 const looping=!!rowDef.continuous,def=source.cycle,limit=looping?def.endFrame:source.points.length-1,raw=[],contacts=[],root=human.rig.parents.findIndex(x=>x<0);
 for(let i=0;i<=limit;i++){if(!alive())throw Error('CANCELLED');const result=decorate(ctl.evaluate(i/source.fps));raw.push(sampler.pack(result.posedMatrices));contacts.push(structuredClone(result.footContacts));if(i%32===0){notify(`准备 ${rowDef.label} · ${Math.round(i/limit*100)}% · 原始动作采样`);await delay();}}
 let frames,duration,displacement=[0,0,0],weights=[];
 if(looping){const {startFrame:a,endFrame:b,tailBlendFrames:B}=def,N=b-a;displacement=[0,1,2].map(k=>k===2?0:raw[b].p[root*3+k]-raw[a].p[root*3+k]);frames=[];
  for(let i=0;i<=N;i++){const w=smooth((i-(N-B))/B),other=a+i-N;frames.push(w>0?blend(raw[a+i],raw[other],w,displacement,root):copy(raw[a+i]));weights.push(Object.fromEntries(['L','R'].map(s=>[s,(contacts[a+i][s].weight||0)*(1-w)+(w>0?(contacts[other][s].weight||0)*w:0)])));}
  duration=N/source.fps;
 }else{frames=raw;duration=(frames.length-1)/source.fps;weights=contacts.map(c=>({L:c.L.weight||0,R:c.R.weight||0}));}
 smoothPoseCache(frames,looping,displacement,root);
 const before=performance.now(),support=looping?stabilizeCyclicSupport(frames,weights,displacement,human,sampler,motion.foot):{mode:'retained source support solver'};
 if(looping){const prior=frames.map(f=>{sampler.apply(f);return ['L','R'].map(s=>sampler.world[human.names.indexOf('foot.'+s)].elements.slice(12,15));});smoothPoseCache(frames,true,displacement,root);let drift=0;frames.forEach((f,i)=>{sampler.apply(f);['L','R'].forEach((s,k)=>{if(weights[i][s]>.99){const a=sampler.world[human.names.indexOf('foot.'+s)].elements;drift=Math.max(drift,Math.hypot(...[0,1,2].map(q=>a[12+q]-prior[i][k][q])));}});});support.postFilterMaxPlantedAnkleShiftM=drift;}
 const bytes=frames.reduce((n,f)=>n+f.q.byteLength+f.p.byteLength,0),N=frames.length-1,angle=(a,b)=>{let d=0;for(let j=0;j<4;j++)d+=a[j]*b[j];return 2*Math.acos(clamp(Math.abs(d)/(Math.hypot(...a)*Math.hypot(...b)),-1,1));};let seamDegrees=0,maxStepDegrees=0,seamRootM=0;
 if(looping){for(let j=0;j<human.names.length;j++){seamDegrees=Math.max(seamDegrees,angle(frames[0].q.subarray(j*4,j*4+4),frames[N].q.subarray(j*4,j*4+4))*180/Math.PI);for(let i=1;i<=N;i++)maxStepDegrees=Math.max(maxStepDegrees,angle(frames[i-1].q.subarray(j*4,j*4+4),frames[i].q.subarray(j*4,j*4+4))*180/Math.PI);}for(let k=0;k<3;k++)seamRootM=Math.max(seamRootM,Math.abs(frames[N].p[root*3+k]-frames[0].p[root*3+k]-displacement[k]));}
 return{row:rowDef,duration,fps:source.fps,frames,objects:new Array(frames.length).fill(null),prepareMS:performance.now()-start,bytes,modelComputes:0,sourceLocalOffsetErrorM:sampler.localError,continuous:looping,displacement,rootIndex:root,origin:Array.from(frames[0].p.subarray(root*3,root*3+3)),contactWeights:weights,footInfo:motion.foot,metrics:{sourceClip:source.clip,cycle:def||null,continuous:looping,support,cycleTravelM:norm(displacement),nominalSpeedMPS:looping?norm(displacement)/duration:0,seamDegrees,seamRootM,maxStepDegrees,supportPreparationMS:performance.now()-before,sourceFingerThumbCaptured:false}};
}
function stabilizeCyclicSupport(frames,weights,D,human,sampler,feet){
 const N=frames.length-1,rest=new NativeRig({...human.rig,stature:human.height}),snapshots=frames.slice(0,N).map(f=>{sampler.apply(f);return sampler.world.map(row);}),plans={L:new Array(N),R:new Array(N)};
 const posed=(i,s)=>{const n=((i%N)+N)%N,j=rest.index.get('foot.'+s),p=pos(snapshots[n][j]);return add(p,scale(D,Math.floor(i/N)));};
 const skinRotation=(i,j)=>{const m=new THREE.Matrix4().fromArray(snapshots[((i%N)+N)%N][j]).transpose();m.multiply(sampler.inverse[j]);const a=m.elements;return[a[0],a[4],a[8],a[1],a[5],a[9],a[2],a[6],a[10]];};
 for(const s of ['L','R']){const active=weights.slice(0,N).map(w=>w[s]>.01),starts=[];for(let i=0;i<N;i++)if(active[i]&&!active[(i-1+N)%N])starts.push(i);if(!starts.length&&active.some(Boolean))starts.push(0);
  for(const start of starts){let end=start;while(end<start+N&&active[end%N])end++;const mid=Math.min(end-1,start+Math.floor((end-start)*.45)),j=rest.index.get('foot.'+s),R=skinRotation(mid,j),a=posed(mid,s),f=feet[s],heel=add(a,mv(R,f.heelPivot)),toe=add(a,mv(R,f.toePivot));for(let t=start;t<end;t++){const i=t%N,shift=scale(D,Math.floor(t/N));plans[s][i]={heel:sub(heel,shift),toe:sub(toe,shift),weight:weights[i][s]};}}
 }
 let maxPlantErrorM=0,maxReachErrorM=0,maxBoneLengthErrorM=0;const contactSamples=[];
 for(let i=0;i<N;i++){
  const mats=snapshots[i];for(let j=0;j<rest.count;j++){rest.posedMatrices[j].set(mats[j]);const skin=new THREE.Matrix4().fromArray(mats[j]).transpose().multiply(sampler.inverse[j]).transpose().toArray();rest.skinMatrices[j].set(skin);}
  const targets={};for(const s of ['L','R']){const plan=plans[s][i];if(!plan)continue;const limb=rest.limbs['leg'+s],R=rotation(rest.skinMatrices[limb.c]),f=feet[s],heel=mv(R,f.heelPivot),toe=mv(R,f.toePivot),u=smooth((heel[2]-toe[2]+.014)/.028),target=lerp(sub(plan.heel,heel),sub(plan.toe,toe),u),current=pos(rest.posedMatrices[limb.c]);const low=Math.min(...f.points.map(p=>mv(R,sub(p,f.ankle))[2]));target[2]=-human.floorOffset-low;targets[s]={target:lerp(current,target,plan.weight),R,weight:plan.weight,pole:pos(rest.posedMatrices[limb.b])};}
  let drop=0;for(const [s,p]of Object.entries(targets)){const l=rest.limbs['leg'+s],hip=pos(rest.posedMatrices[l.a]),v=sub(hip,p.target),reach=(l.upper+l.lower)*.9985,xy=v[0]**2+v[1]**2;if(xy<reach*reach)drop=Math.max(drop,v[2]-Math.sqrt(reach*reach-xy));}drop=clamp(drop,0,human.height*.06);
  if(drop>0)for(const collection of [rest.posedMatrices,rest.skinMatrices])for(const m of collection)m[11]-=drop;
  for(const [s,p]of Object.entries(targets)){const l=rest.limbs['leg'+s],solved=rest.solveLimb(l,p.target,sub(p.pole,[0,0,drop]),.9985);rest.orientSkin(l.c,p.R);const err=norm(sub(pos(rest.posedMatrices[l.c]),p.target));maxReachErrorM=Math.max(maxReachErrorM,solved.reachError);if(p.weight>.99)maxPlantErrorM=Math.max(maxPlantErrorM,err);}
  frames[i]=sampler.pack(rest.posedMatrices);sampler.apply(frames[i]);maxBoneLengthErrorM=Math.max(maxBoneLengthErrorM,sampler.boneError());if(i%12===0)contactSamples.push({phase:i/N,left:weights[i].L,right:weights[i].R,pelvisDropM:drop});
 }
 frames[N]=copy(frames[0]);const root=human.rig.parents.findIndex(x=>x<0);for(let k=0;k<3;k++)frames[N].p[root*3+k]+=D[k];
 return{mode:'cyclic heel/toe support IK after overlap',maxPlantErrorM,maxReachErrorM,maxBoneLengthErrorM,contactSamples,limitations:'flat floor; estimated native sole pivots; post-filter residual separately measured; not rigid-body dynamics or exhaustive skin collision'};
}
/** Short offline low-pass, quaternion hemisphere consistent. Cyclic root is
 * unwrapped before filtering. Original source arrays are never overwritten. */
export function smoothPoseCache(frames,cyclic,D,root){
 const N=frames.length-(cyclic?1:0),K=[1,8,28,56,70,56,28,8,1];
 for(let pass=0;pass<2;pass++){const src=frames.slice(0,N);for(let i=0;i<N;i++){
  const q=new Float32Array(src[i].q.length),p=new Float32Array(src[i].p.length);
  for(let d=-4;d<=4;d++){const raw=i+d,j=cyclic?((raw%N)+N)%N:clamp(raw,0,N-1),offset=cyclic?Math.floor(raw/N):0,w=K[d+4]/256;
   for(let a=0;a<q.length;a+=4){let sign=0;for(let b=0;b<4;b++)sign+=src[i].q[a+b]*src[j].q[a+b];for(let b=0;b<4;b++)q[a+b]+=src[j].q[a+b]*w*(sign<0?-1:1);}
   for(let a=0;a<p.length;a++)p[a]+=(src[j].p[a]+(a>=root*3&&a<root*3+3?D[a-root*3]*offset:0))*w;
  }
  for(let a=0;a<q.length;a+=4){const n=Math.hypot(q[a],q[a+1],q[a+2],q[a+3]);for(let b=0;b<4;b++)q[a+b]/=n;}frames[i]={q,p};
 }}
 if(cyclic){frames[N]=copy(frames[0]);for(let k=0;k<3;k++)frames[N].p[root*3+k]+=D[k];}
}

