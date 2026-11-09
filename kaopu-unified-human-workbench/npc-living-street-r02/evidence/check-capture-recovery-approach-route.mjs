/** Isolated D source descent after the actual recorded walk boundary.
 * Native matrices and hand skin are real; acquisition is explicitly false and
 * this geometry probe creates no physical or logical receipt.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createMotionRecoveryFixture} from './NativeMotionRecoveryFixture.mjs';
import {math} from '../src/NativeRig.mjs';
const {pos,sub,unit,dot,clamp,rotation,mv,tr,mm3,norm,DEG}=math,root=globalThis.__CAPTURE_QA_ROOT__;
const rotationAngle=(a,b)=>{const q=mm3(tr(a),b);return Math.acos(clamp((q[0]+q[4]+q[8]-1)/2,-1,1));};
const boundary=JSON.parse(fs.readFileSync(path.join(root,'evidence/CAPTURE_ENTRY_BOUNDARIES_CED.json'))),source=boundary.observations.find(x=>x.actor==='D'&&x.stage==='before');
const actor=await createMotionRecoveryFixture('D',{notify:console.log}),m=actor.motion,r=actor.rig,l=r.limbs.armR;
const stance=m.assessPickupStance();if(!stance.passed)throw Error('Native stance invalid');
for(let j=0;j<104;j++){r.skinMatrices[j].set(source.skinMatrices[j]);r.posedMatrices[j].set(source.posedMatrices[j]);r.rotationDeltas[j].splice(0,3,...source.rotationDeltas[j]);}r.rootTranslation.splice(0,3,...source.rootTranslation);
actor.root.position.set(...source.rootWorld);actor.root.rotation.set(0,source.rootYaw,0);actor.root.updateMatrixWorld(true);m.lastInput=structuredClone(source.lastInput);m.lastFeet=structuredClone(source.lastFeet);m.lastMode=source.lastMode;m.lastReport=structuredClone(source.lastReport);m.pickup.reset();
const rows=[],poses=[],cameraVertexIds=[];let oldPalm=null,oldWeight=null,oldRotation=null;
for(let v=0;v<actor.binding.N;v++){let w=0;for(let k=0;k<actor.binding.displayRange[v*4+1];k++){const j=(actor.binding.displayRange[v*4]+k)*8,name=r.names[actor.binding.displayPacked[j+3]];if(/^(lowerarm|wrist|finger|metacarpal)/.test(name)&&name.endsWith('.R'))w+=actor.binding.displayPacked[j+4];}if(w>.5)cameraVertexIds.push(v);}
for(let frame=0;frame<120;frame++){
 const progress=Math.min(.48,frame/60/3.2),grip=clamp((progress-.30)/.16,0,1),report=m.update({...source.input,mode:'pickup',dt:1/60,time:(source.frame+frame+1)/60,progress,grip,graspProfile:'bottle',pickupAttached:false});
 if(report.stage==='entry')continue;
 const palm=actor.poseTools.samplePalm('R').slice(),F=unit(mv(rotation(r.skinMatrices[l.c]),r.hand.R.forward)),D=unit(sub(pos(r.posedMatrices[l.c]),pos(r.posedMatrices[l.b]))),actualWrist=Math.acos(clamp(dot(F,D),-1,1))/DEG;
 const row={localFrame:frame,sourceFrame:report.capturedPickup.sourceFrame,phase:report.stage,grip,hipHingeDegrees:report.capturedPickup.hingeDegrees,actualWristDegrees:actualWrist,reportedWristDegrees:report.capturedPickup.wristDegrees,actualPalmErrorM:report.activeGoalErrorM,contactErrorM:report.contactErrorM,
  poseValid:report.poseValid,reachClamped:report.reachClamped,approachWeight:report.capturedPickup.approachWeight,geometry:report.capturedPickup.approachGeometry,
  maximumBoneLengthErrorM:report.boneLengthErrorM,feet:report.feet,palmNative:palm,handRotation:rotation(r.skinMatrices[l.c]),palmStepM:oldPalm?norm(sub(palm,oldPalm)):0,handRotationStepRadians:oldRotation?rotationAngle(oldRotation,rotation(r.skinMatrices[l.c])):0,weightStep:oldWeight===null?0:report.capturedPickup.approachWeight-oldWeight};
 rows.push(row);oldPalm=palm;oldWeight=row.approachWeight;oldRotation=row.handRotation;
 poses.push({id:'D-candidate-'+row.sourceFrame.toFixed(1),label:'candidate-approach',sourceFrame:row.sourceFrame,observedFrame:source.frame+frame,positions:Array.from({length:actor.binding.N},(_,v)=>actor.poseTools.sampleVertex(v)).flat(),skinMatrices:r.skinMatrices.map(x=>Array.from(x)),posedMatrices:r.posedMatrices.map(x=>Array.from(x)),rootTranslation:r.rootTranslation.slice(),
  joints:{shoulder:pos(r.posedMatrices[l.a]),elbow:pos(r.posedMatrices[l.b]),wrist:pos(r.posedMatrices[l.c])},handForwardNative:F,wristDegrees:actualWrist,reachRatio:norm(sub(pos(r.posedMatrices[l.c]),pos(r.posedMatrices[l.a])))/(l.upper+l.lower),report});
 if(report.stage==='contact-hold')break;
}
let previousSourcePalm=null,previousSourceRotation=null;
for(const row of rows){m.pickup._source(row.sourceFrame);const p=actor.poseTools.samplePalm('R').slice(),R=rotation(r.skinMatrices[l.c]);row.originalSource={palm:p,palmStepM:previousSourcePalm?norm(sub(p,previousSourcePalm)):0,handRotationStepRadians:previousSourceRotation?rotationAngle(previousSourceRotation,R):0};previousSourcePalm=p;previousSourceRotation=R;}
const selected=[0,20,40,60,80,99].map(f=>poses.reduce((a,b)=>Math.abs(a.sourceFrame-f)<=Math.abs(b.sourceFrame-f)?a:b)),states=[];
for(const s of selected){states.push(s);m.pickup._source(s.sourceFrame);const F=unit(mv(rotation(r.skinMatrices[l.c]),r.hand.R.forward)),D=unit(sub(pos(r.posedMatrices[l.c]),pos(r.posedMatrices[l.b])));states.push({id:'D-original-'+s.sourceFrame.toFixed(1),label:'original-retarget',sourceFrame:s.sourceFrame,positions:Array.from({length:actor.binding.N},(_,v)=>actor.poseTools.sampleVertex(v)).flat(),joints:{shoulder:pos(r.posedMatrices[l.a]),elbow:pos(r.posedMatrices[l.b]),wrist:pos(r.posedMatrices[l.c])},handForwardNative:F,wristDegrees:Math.acos(clamp(dot(D,F),-1,1))/DEG,reachRatio:norm(sub(pos(r.posedMatrices[l.c]),pos(r.posedMatrices[l.a])))/(l.upper+l.lower)});}
const out=path.join(root,'evidence/pickup-unheld-wrist-r02'),tag=process.env.RUN_TAG||'BOUNDED_1';fs.mkdirSync(out,{recursive:true});
const summary={schema:'native-captured-empty-hand-approach-candidate/1',actor:'D',sourceHashes:globalThis.__CAPTURE_QA_SOURCE_HASHES__,scope:'Actual native geometry after a frozen real walk boundary; source phases/dt are executed, test input acquisition remains false. No new physical transport, inventory receipt, food, or browser claim.',
 maxActualWristDegrees:Math.max(...rows.map(x=>x.actualWristDegrees)),maxGoalErrorM:Math.max(...rows.map(x=>x.actualPalmErrorM)),maxPalmStepM:Math.max(...rows.map(x=>x.palmStepM)),maxWeightStep:Math.max(...rows.map(x=>Math.abs(x.weightStep))),maxHandRotationStepRadians:Math.max(...rows.map(x=>x.handRotationStepRadians)),sourceMaxPalmStepM:Math.max(...rows.map(x=>x.originalSource.palmStepM)),sourceMaxHandRotationStepRadians:Math.max(...rows.map(x=>x.originalSource.handRotationStepRadians)),
 invalid:rows.filter(x=>!x.poseValid).length,reachClamped:rows.filter(x=>x.reachClamped).length,contact:rows.at(-1),rows};summary.passed=summary.invalid===0&&summary.reachClamped===0&&summary.maxActualWristDegrees<65&&summary.contact.phase==='contact-hold'&&summary.contact.contactErrorM<=.012;
fs.writeFileSync(path.join(out,'D_APPROACH_'+tag+'.json'),JSON.stringify(summary,null,2)+'\n');fs.writeFileSync(path.join(out,'D_APPROACH_'+tag+'_GEOMETRY.json'),JSON.stringify({schema:'native-approach-source-comparison/1',cameraVertexIds,faces:Array.from(actor.nativeSource.faces),sourceFrames:selected.map(s=>s.sourceFrame),states}));
console.log(JSON.stringify({...summary,rows:rows.length,contact:{...summary.contact,feet:undefined}}));if(!summary.passed)process.exitCode=2;
