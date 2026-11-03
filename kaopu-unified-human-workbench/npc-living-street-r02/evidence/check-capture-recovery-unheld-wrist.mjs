/** Read-only native wrist comparison at four observed descent/contact frames.
 * No new pickup chain and no candidate pose or production parameter changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createMotionRecoveryFixture} from './NativeMotionRecoveryFixture.mjs';
import {limbMeasure} from '../src/PickupReachGeometry.mjs';
import {math} from '../src/NativeRig.mjs';
const {sub,dot,norm,unit,pos,rotation,mv,clamp,DEG}=math,root=globalThis.__CAPTURE_QA_ROOT__,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>{const bytes=fs.readFileSync(path.join(root,p));return{data:JSON.parse(bytes),path:p,bytes:bytes.length,sha256:sha(bytes)};};
const prefix='evidence/CAPTURE_RECOVERY_CHAIN_SIX_FINAL',cache=read(prefix+'_ENTRY_CONTACT_POSES.json'),trace=read(prefix+'_TRACE.json'),csr=read(prefix+'_DISPLAY_CSR.json');
const actor=await createMotionRecoveryFixture('D',{shoes:false,prepare:true,notify:console.log}),r=actor.rig,b=actor.binding,l=r.limbs.armR,cachedBinding=csr.data.bindings.D;
for(const [name,array]of [['displayRange',b.displayRange],['displayPacked',b.displayPacked]]){
 if(array.length!==cachedBinding[name].length||array.some((x,i)=>x!==cachedBinding[name][i]))throw Error('Original complete native '+name+' differs from actual cached transaction');
}
const sourceFrames=[79.6,89.6,97.6,99],states=[],measurements=[];
const currentMatrixCopy=()=>({skinMatrices:r.skinMatrices.map(x=>Array.from(x)),posedMatrices:r.posedMatrices.map(x=>Array.from(x))});
const cameraVertexIds=[];
for(let id=0;id<b.N;id++){
 const start=b.displayRange[id*4],count=b.displayRange[id*4+1];let weight=0;
 for(let n=0;n<count;n++){const k=(start+n)*8,name=r.names[b.displayPacked[k+3]];if(/^(lowerarm|wrist|finger|metacarpal)/.test(name)&&name.endsWith('.R'))weight+=b.displayPacked[k+4];}
 if(weight>.5)cameraVertexIds.push(id);
}
function geometry(label,frame,observed,sourceReport){
 const positions=[];for(let id=0;id<b.N;id++)positions.push(...actor.poseTools.sampleVertex(id));
 const shoulder=pos(r.posedMatrices[l.a]),elbow=pos(r.posedMatrices[l.b]),wrist=pos(r.posedMatrices[l.c]),
   F=unit(mv(rotation(r.skinMatrices[l.c]),r.hand.R.forward)),N=unit(mv(rotation(r.skinMatrices[l.c]),r.hand.R.palm)),D=unit(sub(wrist,elbow)),V=sub(wrist,shoulder),
   wristDegrees=Math.acos(clamp(dot(D,F),-1,1))/DEG,best=limbMeasure(V,F,l.upper,l.lower,{extension:.999});
 const state={id:`D-${label}-${frame.toFixed(1)}`,label,sourceFrame:frame,observedFrame:observed.frame,
  positions,...currentMatrixCopy(),rootTranslation:r.rootTranslation.slice(),
  joints:{shoulder,elbow,wrist},handForwardNative:F,palmNormalNative:N,
  wristDegrees,fixedShoulderWristForwardMinimumWristDegrees:best.wristDegrees,
  reachRatio:norm(V)/(l.upper+l.lower),upperLengthM:l.upper,lowerLengthM:l.lower,
  actualPalm:actor.poseTools.samplePalm('R'),validation:r.validate(),sourceReport};
 states.push(state);return state;
}
for(const sourceFrame of sourceFrames){
 const cached=cache.data.states.find(x=>x.actor==='D'&&Math.abs(x.sourceFrame-sourceFrame)<1e-8);
 if(!cached)throw Error('Requested measured source event missing '+sourceFrame);
 const observed=trace.data.find(x=>x.actor==='D'&&x.frame===cached.frame);
 for(let j=0;j<104;j++){r.skinMatrices[j].set(cached.skinMatrices[j]);r.posedMatrices[j].set(cached.posedMatrices[j]);}
 r.rootTranslation.splice(0,3,...cached.rootTranslation);
 const actual=geometry('actual-adapted',sourceFrame,cached,observed.report.motionSource);
 actual.actualReport={wristDegrees:observed.report.capturedPickup.wristDegrees,grip:observed.report.grip01,
  reachClamped:observed.report.reachClamped,wristGateActive:observed.report.capturedPickup.wristGateActive,
  contactPhase:observed.report.contactPhase,attached:observed.report.capturedPickup.acquisitionInput,
  activeGoalErrorM:observed.report.activeGoalErrorM,hingeDegrees:observed.report.capturedPickup.hingeDegrees,
  rootMatrix:cached.rootMatrix,rootWorld:cached.rootWorld};
 const source=actor.motion.pickup._source(sourceFrame),original=geometry('original-retarget',sourceFrame,cached,source.report);
 measurements.push({sourceFrame,observedFrame:cached.frame,
  actualWristDegrees:actual.wristDegrees,actualReportedWristDegrees:actual.actualReport.wristDegrees,
  sourceWristDegrees:original.wristDegrees,actualReachRatio:actual.reachRatio,sourceReachRatio:original.reachRatio,
  actualBestFixedWristDegrees:actual.fixedShoulderWristForwardMinimumWristDegrees,
  actualReachClamped:actual.actualReport.reachClamped,activeGoalErrorM:actual.actualReport.activeGoalErrorM,
  held:actual.actualReport.attached,wristGateActive:actual.actualReport.wristGateActive,
  shoulderDeltaNative:sub(actual.joints.shoulder,original.joints.shoulder),elbowDeltaNative:sub(actual.joints.elbow,original.joints.elbow),wristDeltaNative:sub(actual.joints.wrist,original.joints.wrist)});
}
const out=path.join(root,'evidence/pickup-unheld-wrist-r02');fs.mkdirSync(out,{recursive:true});
const data={schema:'actual-and-original-native-wrist-geometry/1',actor:'D',release:false,bodyVertexCount:b.N,faces:cachedBinding.faces,cameraVertexIds,
 displayCSRMatchesActualCache:true,coordinateSystem:'native right-handed Z-up; every actual body triangle retained, camera ROI only crops the view',
 sourceHashes:globalThis.__CAPTURE_QA_SOURCE_HASHES__,inputs:[cache,trace,csr].map(({data,...info})=>info),
 sourceMeaning:'The same original full357-frame CMU115_06 retarget plus its retained ArmContinuity decoration, sampled at the exact observed indices. Raw source comparison has no extra cylinder-contact hip hinge, shoe grounding or finger closure.',
 actualMeaning:'Copied from all104 actual native matrices of the completed six-actor seven-bottle transaction, before its corresponding physics step; no re-solving or replacement.',
 selection:'Actual fixed source79.6, peak unheld89.6, last down97.6 and actual contact99. No visual pose search.',
 measurements,states};
const bytes=Buffer.from(JSON.stringify(data)),file=path.join(out,'D_NATIVE_WRIST_COMPARISON.json');fs.writeFileSync(file,bytes);
const report={schema:'native-unheld-wrist-readonly-rca/1',actor:'D',release:false,productionEdited:false,
 scope:'Actual complete native body/hand geometry and original same-frame retarget. The retained held65 gate is not asserted as an original unheld-source rule. No candidate or new physical chain.',
 inputs:data.inputs,sourceHashes:data.sourceHashes,sourceMeaning:data.sourceMeaning,selection:data.selection,measurements,
 conclusion:'At the measured worst unheld frame, the observed elbow already nearly attains the best possible wrist angle for its fixed shoulder, wrist and hand-forward direction. The adapter requested a nearly fully extended arm before the contact pose; it is not evidence that changing only the elbow pole would repair the posture.',
 geometry:{path:path.relative(root,file),bytes:bytes.length,sha256:sha(bytes)},displayCSRMatchesActualCache:true};
fs.writeFileSync(path.join(out,'D_UNHELD_WRIST_RCA.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({geometry:report.geometry,measurements}));
