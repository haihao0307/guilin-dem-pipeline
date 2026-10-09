/** Independent task-space candidate. Self-authored; SOMA is a rig teacher,
 * not an executed motion planner. Metres/Z-up/-Y forward. Immutable native
 * rest identity; full CSR remains owned by AnimatedHuman. */
import {NativeRig,math} from './NativeRig.mjs';
import {bindFistReference,applyFistReference} from './FistReference.mjs';
const {clamp,smooth,add,sub,scale,dot,cross,norm,unit,lerp,pos,rotation,mv,axisRotation,basisRotation,DEG}=math;
export const TASKS=['open','fist','pinch','grasp','carry','reach-turn'];
const transform=(m,p)=>add(mv(rotation(m),p),pos(m));
export class HandBodyCoordinator extends NativeRig {
 constructor(options){super(options);this.fistReference=bindFistReference(this);this.result.schema='native-hand-body/1';this.result.source='self-authored task IK + SOMA-inspired segment twist distribution';this.floorOffset=options.floorOffset??-Math.min(...this.restP.map(p=>p[2]));this.finger={};this.previousGrip=false;for(const s of ['L','R'])for(let f=1;f<=5;f++){
 const ids=[1,2,3].map(k=>this.index.get(`finger${f}-${k}.${s}`));const p=ids.map(j=>this.restP[j]);this.finger[s+f]={ids,tip:add(p[2],scale(sub(p[2],p[1]),.78)),axes:ids.map((j,k)=>unit(cross(unit(k<2?sub(p[k+1],p[k]):sub(p[2],p[1])),this.hand[s].palm)))};
 }};
 tip(side,finger){const f=this.finger[side+finger];return transform(this.skinMatrices[f.ids[2]],f.tip);}
 fingerPose(side,finger,angles,spread=0){const f=this.finger[side+finger];f.ids.forEach((j,k)=>this.rotationDeltas[j]=add(scale(f.axes[k],angles[k]),k===0?scale(this.hand[side].palm,spread):[0,0,0]));}
 evaluate(seconds,{task='grasp',duration=6,side='L',target=null,objectId='hand-prop',amount=1,twistDegrees=task==='reach-turn'?35:0,poseOutput=false,contactOffsets=null,fistTension='tight'}={}){
 if(contactOffsets&&Object.values(contactOffsets).some(v=>!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite)))throw Error('Invalid contact offsets');
 if(!['tight','loose'].includes(fistTension)||!TASKS.includes(task)||!Number.isFinite(seconds)||!Number.isFinite(duration)||!(duration>0)||!Number.isFinite(amount)||!Number.isFinite(twistDegrees)||(target&&(!Array.isArray(target)||target.length!==3||!target.every(Number.isFinite)))||!['L','R'].includes(side))throw Error('Invalid hand-body task');
 const u=clamp(seconds/duration,0,1),reach=smooth(u/.27)*(1-smooth((u-.79)/.21)),close=smooth((u-.20)/.2)*(1-smooth((u-.68)/.16)),lift=smooth((u-.40)/.16)*(1-smooth((u-.61)/.14)),h=this.stature;
 const active=task==='carry'?['L','R']:[side],a=clamp(amount,0,1),grasp=['grasp','carry'].includes(task),closure=(['open','reach-turn'].includes(task)?0:task==='fist'?reach:close)*a;
 const phase=u<.2?'approach':u<.4?'close':u<.6?'hold':u<.8?'release':'recover';
 for(const v of this.rotationDeltas)v.fill(0);this.rootTranslation.fill(0);
 // Task-dependent hip/chest/shoulder participation, with fixed planted feet.
 const yaw=-(task==='reach-turn'?42:task==='carry'?0:10)*(side==='L'?1:-1)*reach;
 this.setRotation('root',0,0,yaw*.32);for(const name of ['spine05','spine04','spine03','spine02','spine01'])this.setRotation(name,reach*(task==='carry'?2:1),0,yaw*.136);
 for(const s of active){const sign=s==='L'?1:-1;this.setRotation('clavicle.'+s,0,sign*reach*3,-sign*reach*5);this.setRotation('shoulder01.'+s,reach*2,0,-sign*reach*4);
 for(let f=1;f<=5;f++){const curls=f===1?[22,34,28]:task==='fist'?[80,95,65]:[65,82,48];if(task==='pinch'&&f>2)curls.splice(0,3,13,18,10);this.fingerPose(s,f,curls.map(v=>v*closure),task==='open'?(f-3)*5*reach:0);}
 // Thumb opposition is a distinct DOF, not the same curl as four fingers.
 const thumb=this.index.get('finger1-1.'+s);this.rotationDeltas[thumb]=add(this.rotationDeltas[thumb],scale(this.hand[s].forward,sign*35*closure));
 for(let k=1;k<=4;k++)this.setRotation(`metacarpal${k}.${s}`,...scale(this.hand[s].forward,sign*(k-1)*1.2*closure));
 }
 if(task==='fist')for(const s of active)applyFistReference(this,s,closure,{tension:fistTension});
 this.fk();
 // Keep ankle targets invariant under torso/hip motion.
 let footError=0;for(const s of ['L','R']){const l=this.limbs['leg'+s],hip=pos(this.posedMatrices[l.a]);this.solveLimb(l,this.restP[l.c],add(hip,[0,-h*.3,-h*.1]),.9999);this.orientSkin(l.c,[1,0,0,0,1,0,0,0,1]);footError=Math.max(footError,norm(sub(pos(this.posedMatrices[l.c]),this.restP[l.c])));}
 const objectPosition=target||[(task==='carry'?0:(side==='L'?1:-1)*h*.12),-h*.21,h*(.61+.07*lift)-this.floorOffset];
 const hands={};for(const s of active){const sign=s==='L'?1:-1,l=this.limbs['arm'+s],shoulder=pos(this.posedMatrices[l.a]);
 const goal=contactOffsets?.[s]?add(objectPosition,contactOffsets[s]):task==='carry'?add(objectPosition,[sign*h*.090,-h*.026,h*.035]):task==='reach-turn'?[sign*h*.27,-h*.20,h*.71-this.floorOffset]:add(objectPosition,grasp?[sign*h*.006,h*.043,h*.025]:[0,h*.035,0]);
 const handTarget=lerp(this.restP[l.c],goal,reach);if(task==='grasp')handTarget[2]+=h*.10*reach*(1-close);const solved=this.solveLimb(l,handTarget,add(shoulder,[sign*h*.23,0,-h*.23]),.995);
 // Forearm helper receives part of axial roll. Wrist receives the residual
 // absolute orientation, so hand task orientation does not double-rotate.
 const helper=this.index.get('lowerarm02.'+s),axis=unit(sub(pos(this.posedMatrices[l.c]),pos(this.posedMatrices[l.b]))),roll=clamp(twistDegrees,-70,70)*reach*DEG;
 if(helper!==undefined)this.rotateSubtree(helper,axisRotation(axis,roll*.55));
 const forward=unit(lerp(this.hand[s].forward,task==='carry'?[0,-1,-.15]:[0,-1,.08],reach));
 const palm=mv(axisRotation(forward,roll),unit(lerp(this.hand[s].palm,task==='carry'?[-sign,0,0]:[0,0,-1],reach)));this.orientSkin(l.c,basisRotation(this.hand[s].forward,this.hand[s].palm,forward,palm));
 hands[s]={target:handTarget,position:pos(this.posedMatrices[l.c]),targetErrorM:norm(sub(pos(this.posedMatrices[l.c]),handTarget)),reachClamped:solved.clamped,palmMatrix:Array.from(this.posedMatrices[l.c]),twistHelperRadians:roll*.55};
 }
 // Small CCD pinching correction using actual shape-specific segment axes.
 // Skeleton-tip contact is a proxy; never claim skin-surface contact.
 if(task==='pinch'&&closure>.001)for(const s of active){const corrections=new Map();for(let iteration=0;iteration<22;iteration++)for(const f of [1,2])for(const j of this.finger[s+f].ids.slice().reverse()){
 const axes=[this.finger[s+f].axes[this.finger[s+f].ids.indexOf(j)]];if(j===this.finger[s+f].ids[0])axes.push(this.hand[s].palm,this.hand[s].forward);
 for(let ai=0;ai<axes.length;ai++){const other=this.tip(s,f===1?2:1),tip=this.tip(s,f);if(norm(sub(other,tip))<h*.0025)continue;const pivot=pos(this.posedMatrices[j]),axis=mv(rotation(this.skinMatrices[this.parents[j]]),axes[ai]),v=sub(tip,pivot),w=sub(other,pivot),key=j+':'+ai,previous=corrections.get(key)||0;const proposed=clamp(Math.atan2(dot(axis,cross(v,w)),dot(v,w)-dot(v,axis)*dot(w,axis)),-.07,.07)*closure,next=clamp(previous+proposed,-.65,.65);corrections.set(key,next);this.rotateSubtree(j,axisRotation(axis,next-previous));}
 }}
 if(task==='fist'&&closure>.001)for(const s of active){
 // Small shape-clearance correction after the CC0 reference. Preserve the
 // independent finger axes and metacarpal cup; do not solve a tip-only goal.
 const w=rotation(this.skinMatrices[this.index.get('wrist.'+s)]),axis=mv(w,this.hand[s].forward);
 this.rotateSubtree(this.finger[s+'1'].ids[0],axisRotation(axis,(s==='L'?1:-1)*-12*DEG*closure*closure));
 }

 for(const s of active){hands[s].thumbIndexGapM=norm(sub(this.tip(s,1),this.tip(s,2)));hands[s].tips=Array.from({length:5},(_,f)=>this.tip(s,f+1));}
 const grip=grasp&&u>=.4&&u<.68;const event=grip&&!this.previousGrip?'grab':!grip&&this.previousGrip?'release':null;this.previousGrip=grip;
 this.result.hands=hands;this.result.object={id:objectId,position:objectPosition,grip,event,mode:'kinematic target; no force feedback',shape:task==='grasp'?'sphere':'box',radius:h*.015,halfExtentsNative:task==='grasp'?[h*.015,h*.015,h*.015]:[h*.23/3.4,h*.16/3.4,h*.18/3.4],graspOffsets:contactOffsets|| (task==='carry'?{L:[h*.090,-h*.026,h*.035],R:[-h*.090,-h*.026,h*.035]}:{[side]:[(side==='L'?1:-1)*h*.006,h*.043,h*.025]})};
 this.result.state={task,phase,progress:u,reach,closure,space:'native-local-z-up',poseCorrectives:false,fistTension,handPoseSource:task==='fist'?'MakeHuman fight03 CC0, shape-frame adapted + small thumb clearance correction':'self-authored experimental'};this.metrics={maxFootErrorM:footError,maxHandErrorM:Math.max(...Object.values(hands).map(x=>x.targetErrorM)),shapeEvaluationsPerFrame:0,boneCount:this.count};this.result.metrics=this.metrics;
 if(poseOutput)this.exportNativePose(this.pose);return this.result;
 }
}
