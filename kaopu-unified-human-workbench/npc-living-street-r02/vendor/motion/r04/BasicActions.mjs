import {lockFiniteSupport} from './SupportLock.mjs';
import {smoothPoseCache} from './CapturedCycles.mjs';
import {NativeRig,math} from '../../../src/NativeRig.mjs';
import {ArmContinuity} from './ArmContinuity.mjs';
import {THREE} from '../../../src/NativeBinding.mjs';
import guide from './GUIDE.json' with {type:'json'};
const {add,sub,scale,norm,unit,pos,rotation,mv,smooth,clamp,basisRotation}=math;
const wait=()=>new Promise(r=>setTimeout(r,0));

/** Authored single-person poses on the SAME native rest skeleton. Squat timing
 * uses the recorded envelope; idle/turning are explicitly authored, not Mixamo.
 */
export class BasicActions {
 constructor(binding){this.binding=binding;this.rig=new NativeRig({...binding.rig,stature:binding.height});this.arms=new ArmContinuity(binding);this.H=binding.height;this.floor=-binding.floorOffset;this.soles={};
  for(const s of ['L','R']){const pts=[];for(let i=0;i<binding.N;i++){if(binding.positions[i*3+2]>this.floor+this.H*.13)continue;let w=0;for(let k=0;k<binding.range[i*2+1];k++){const slot=(binding.range[i*2]+k)*8;if(/^(foot|toe)/.test(binding.names[binding.packed[slot+3]])&&binding.names[binding.packed[slot+3]].endsWith('.'+s))w+=binding.packed[slot+4];}if(w>.65)pts.push(Array.from(binding.positions.slice(i*3,i*3+3)));}this.soles[s]=pts;}
 }
 envelope(u,part){const a=guide.crouch,p=a.indexOf(1),x=part==='down'?clamp(u,0,1)*p:part==='up'?p+clamp(u,0,1)*(a.length-1-p):clamp(u,0,1)*(a.length-1),k=Math.floor(x);return a[k]+(a[Math.min(k+1,a.length-1)]-a[k])*(x-k);}
 pose(task,t,duration){const r=this.rig,h=this.H;for(const d of r.rotationDeltas)d.fill(0);r.rootTranslation=[0,0,0];
  const isSquat=task.startsWith('squat')||task==='stand-up',q=isSquat?this.envelope(t/duration,task==='squat-down'?'down':task==='stand-up'?'up':'both'):0;
  const breathing=task==='idle-breathe'?Math.sin(t*Math.PI*2/duration):0;
  r.rootTranslation=[0,h*.013*q,-h*(.008+.325*q)];
  r.setRotation('root',16*q,0,0);r.setRotation('spine04',9*q+breathing*.25,0,0);r.setRotation('spine03',9*q+breathing*.2,0,0);
  // Symmetric clavicular relaxation is bounded and independent of body shape.
  for(const s of ['L','R'])r.setRotation('clavicle.'+s,0,(s==='L'?1:-1)*4,0);
  r.fk();
  const feet={};
  for(const s of ['L','R']){const sign=s==='L'?1:-1,l=r.limbs['leg'+s],rest=r.restP[l.c],target=[sign*h*(.085+.042*q),rest[1],rest[2]];
   const hip=pos(r.posedMatrices[l.a]);r.solveLimb(l,target,add(hip,[sign*h*.08,-h*.45,-h*.12]),.9999);r.orientSkin(l.c,math.axisRotation([0,0,1],-sign*.035));feet[s]={weight:1,planted:true,target};
  }
  for(const s of ['L','R']){const sign=s==='L'?1:-1,l=r.limbs['arm'+s],A=pos(r.posedMatrices[l.a]),knee=pos(r.posedMatrices[r.limbs['leg'+s].b]);
   const relaxed=[sign*h*.145,-h*.025,this.floor+h*.51],crouched=add(knee,[sign*h*.045,-h*.005,h*.09]);
   const target=math.lerp(relaxed,crouched,smooth(q));r.solveLimb(l,target,add(A,[sign*h*.10,h*.045,-h*.28]),.995);
  }
  const frame=this.arms.apply({posedMatrices:r.posedMatrices,skinMatrices:r.skinMatrices},{gesture:false});
  const out=this.arms.rig;
  for(const s of ['L','R'])for(let f=1;f<=5;f++)for(let k=1;k<=3;k++){
   const j=out.index.get(`finger${f}-${k}.${s}`),next=out.index.get(`finger${f}-${Math.min(3,k+1)}.${s}`),prev=out.index.get(`finger${f}-${Math.max(1,k-1)}.${s}`),D=unit(sub(out.restP[next],out.restP[prev])),axis=unit(math.cross(D,out.hand[s].palm)),angle=(f===1?[5,8,6]:[10,17,11])[k-1];out.rotateSubtree(j,math.axisRotation(mv(rotation(out.skinMatrices[j]),axis),angle*Math.PI/180));
  }
  // Root-neutral breathing does not slide feet or stretch bones.
  return {...frame,footContacts:feet,metrics:{task,crouch:q,source:isSquat?'CMU22_14 envelope + authored fixed-length posture':'authored native single-person posture',boneLengths:out.validate(),armCalibration:this.arms.report}};
 }
}

export async function buildBasicClip(review,row,ticket){
 const begin=performance.now(),solver=new BasicActions(review.binding),fps=60,count=Math.round(row.duration*fps),frames=[];
 for(let i=0;i<=count;i++){if(ticket!==review.generation)throw Error('CANCELLED');const f=solver.pose(row.task,i/fps,row.duration);frames.push(review.sampler.pack(f.posedMatrices));if(i%60===0){review.status('准备单人动作 '+row.label);await wait();}}
 if(row.continuous)frames[count]={q:frames[0].q.slice(),p:frames[0].p.slice()};
 return{row,duration:row.duration,fps,frames,objects:frames.map(()=>null),continuous:!!row.continuous,displacement:[0,0,0],rootIndex:review.binding.rig.parents.findIndex(p=>p<0),prepareMS:performance.now()-begin,modelComputes:0,bytes:frames.reduce((n,f)=>n+f.q.byteLength+f.p.byteLength,0),metrics:{singlePerson:true,source:'authored poses; recorded squat height envelope',noObjectInteraction:true,armCalibration:solver.arms.report}};
}

/** A walking turn follows the existing captured gait around a curved root
 * path. This is not a new captured pivot. Stationary foot anchors are solved
 * after rotating the body; a torso-only spin is never used as a turn. */
export function curveWalkClip(clip,binding,sampler,sign){
 const turnCycles=4,duration=clip.duration*turnCycles,N=(clip.frames.length-1)*turnCycles,frames=[],root=clip.rootIndex;
 const d=clip.displacement,total=norm(d),heading=Math.atan2(d[1],d[0]),rootOrigin=Array.from(clip.frames[0].p.subarray(root*3,root*3+3));
 for(let i=0;i<=N;i++){
  const cycle=Math.min(turnCycles-1,Math.floor(i/(clip.frames.length-1))),k=i-cycle*(clip.frames.length-1),a=clip.frames[k],phase=i/N,yaw=sign*Math.PI/2*smooth(phase),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),yaw),out={q:a.q.slice(),p:a.p.slice()},qr=new THREE.Quaternion().fromArray(out.q,root*4).premultiply(q);qr.toArray(out.q,root*4);
  // Integrate travel, with recorded per-frame stride progress along the path.
  const distance=(cycle+Math.min(1,k/(clip.frames.length-1)))*total,steps=80;let x=0,y=0;
  for(let j=0;j<steps;j++){const u=phase*(j+.5)/steps,angle=heading+sign*Math.PI/2*smooth(u);x+=Math.cos(angle)*distance/steps;y+=Math.sin(angle)*distance/steps;}
  const residual=new THREE.Vector3(a.p[root*3]-rootOrigin[0]-d[0]*k/(clip.frames.length-1),a.p[root*3+1]-rootOrigin[1]-d[1]*k/(clip.frames.length-1),0).applyQuaternion(q);
  out.p[root*3]=rootOrigin[0]+x+residual.x;out.p[root*3+1]=rootOrigin[1]+y+residual.y;frames.push(out);
 }
 const weights=frames.map((_,i)=>clip.contactWeights[i%(clip.frames.length-1)]),support=lockFiniteSupport(frames,weights,binding,sampler,clip.footInfo);
 const before=frames.map(f=>{sampler.apply(f);return['L','R'].map(s=>sampler.world[binding.names.indexOf('foot.'+s)].elements.slice(12,15));});
 smoothPoseCache(frames,false,[0,0,0],root);
 let residual=0;frames.forEach((f,i)=>{sampler.apply(f);['L','R'].forEach((s,j)=>{if(weights[i][s]>.99){const p=sampler.world[binding.names.indexOf('foot.'+s)].elements;residual=Math.max(residual,Math.hypot(...[0,1,2].map(k=>p[12+k]-before[i][j][k])));}});});support.postFilterMaxPlantedAnkleShiftM=residual;
 return{...clip,frames,duration,continuous:false,displacement:[0,0,0],bytes:frames.reduce((n,f)=>n+f.q.byteLength+f.p.byteLength,0),metrics:{...clip.metrics,turnDegrees:sign*90,turnSupport:support,source:'existing CMU16_15 cycle + authored curved root path + planted-foot IK',limitations:'walking turn; not a captured in-place pivot; flat floor only'}};
}

