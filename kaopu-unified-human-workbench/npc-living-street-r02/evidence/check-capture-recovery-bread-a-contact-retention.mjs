/** Geometry-only retention of A's existing middle-finger contact interval.
 * No body, prop, support, contact-count threshold or production source edit.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createMotionRecoveryFixture} from './NativeMotionRecoveryFixture.mjs';
import {fitCylinderGrasp,applyNativeFittedGrip} from '../src/ActorAdapter.mjs';
import {ellipsoidSurfaceDistance} from '../src/ItemWorld.mjs';
import {math} from '../src/NativeRig.mjs';
const {sub,scale,dot,cross,norm,unit}=math,root=globalThis.__CAPTURE_QA_ROOT__;
const sourcePath='evidence/capture-recovery-source/SurfaceContact.mjs',sourceBytes=fs.readFileSync(path.join(root,sourcePath));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(sha(sourceBytes)!=='30a6cd8afccbdbfe773462adc2041ee8a2f0635f4f1dc94ef223768b21748d21')throw Error('Original finger domain source changed');
if(!sourceBytes.toString().includes('hi:k===1?90:105'))throw Error('Original native joint upper domain missing');
const actor=await createMotionRecoveryFixture('A',{shoes:false,prepare:false}),r=actor.rig,b=actor.binding;
const shape={kind:'ellipsoid',halfExtentsM:[.045,.035,.075],physicalHalfExtentsM:[.075,.035,.045],contactYawRadians:Math.PI/2,gripHeight:0};
const baseAngles=[60,76,45],sourceUpperAngles=[90,105,105],maximumFactor=1;
const results=[];
for(const side of ['L','R']){
 const fit=fitCylinderGrasp({rig:r,binding:b,fingers:actor.fixture.fingers,patch:actor.fixture.patches[side],handVertices:actor.fixture.handSurfaceVertices[side],side,shape});
 const frame=r.hand[side],sign=side==='L'?1:-1,across=unit(cross(frame.forward,frame.palm)),ids=actor.fixture.handSurfaceVertices[side];
 const digitVertices=Array.from({length:5},(_,f)=>ids.filter(id=>{
  const start=b.displayRange[id*4],count=b.displayRange[id*4+1];
  for(let k=0;k<count;k++)if(r.names[b.displayPacked[(start+k)*8+3]].startsWith(`finger${f+1}-`)&&b.displayPacked[(start+k)*8+4]>1e-6)return true;
  return false;
 }));
 const evaluate=(closure,amount=1)=>{
  for(const delta of r.rotationDeltas)delta.fill(0);r.rootTranslation.fill(0);
  // This public production pose function has an admissibility early-return.
  // A local provisional record enables geometry evaluation only; the actor's
  // live fit is never changed or used for any task/physics/receipt.
  applyNativeFittedGrip(r,actor.fixture.fingers,{...fit,closure,admissible:true},side,amount);
  r.fk();b.animate(r.skinMatrices);const anchor=actor.poseTools.samplePalm(side),distances=new Map();
  let min=Infinity,deepest=null,maximumRadius=0;
  for(const id of ids){
   const delta=sub(actor.poseTools.sampleVertex(id),anchor),local=[sign*dot(delta,frame.forward),-sign*dot(delta,across),dot(delta,frame.palm)-shape.halfExtentsM[2]],d=ellipsoidSurfaceDistance(local,shape.halfExtentsM);
   distances.set(id,d);maximumRadius=Math.max(maximumRadius,norm(delta));
   if(d<min){min=d;deepest={id,gripFrame:local};}
  }
  return{minimumSignedDistanceM:min,deepest,maximumPalmRadiusM:maximumRadius,
   fingerMinimumSignedDistanceM:digitVertices.map(v=>Math.min(...v.map(id=>distances.get(id)))),
   fingerNearVertexCounts:digitVertices.map(v=>v.filter(id=>Math.abs(distances.get(id))<=.003).length),
   middleFingerNearVertices:digitVertices[2].filter(id=>Math.abs(distances.get(id))<=.003).map(id=>({id,signedDistanceM:distances.get(id)})),
   boneLengthErrorM:r.validate().maxBoneLengthError};
 };
 const baseline=evaluate(fit.closure),candidateClosure=fit.closure.slice(),search=[];
 if(fit.closure[2]!==1||baseline.fingerNearVertexCounts[2]>=3)throw Error('Expected only the observed A saturated middle-finger condition');
 let accepted=1,lastExit=null,previous=null;
 // Reuse the original forty bounded scalar curl intervals. Retain the last
 // real surface exit, which the old global-penetration-only stop missed.
 // This is the existing native curl curve, with no new angle or joint range.
 for(let k=0;k<=40;k++){
  const t=k/40,c=fit.closure.slice();c[2]=t;const test=evaluate(c),gap=test.fingerMinimumSignedDistanceM[2];
  const row={factor:t,minimumSignedDistanceM:test.minimumSignedDistanceM,middleGapM:gap,middleNear:test.fingerNearVertexCounts[2]};search.push(row);
  if(previous&&previous.middleGapM<=0&&gap>0&&previous.minimumSignedDistanceM>=-.0011&&test.minimumSignedDistanceM>=-.0011)lastExit=[previous.factor,t];
  previous=row;
 }
 if(lastExit){let [lo,hi]=lastExit;for(let k=0;k<24;k++){const t=(lo+hi)*.5,c=fit.closure.slice();c[2]=t;if(evaluate(c).fingerMinimumSignedDistanceM[2]<=0)lo=t;else hi=t;}accepted=(lo+hi)*.5;}
 candidateClosure[2]=accepted;
 const closed=evaluate(candidateClosure),trajectory=Array.from({length:21},(_,i)=>({amount:i/20,...evaluate(candidateClosure,i/20)}));
 const touching=closed.fingerNearVertexCounts.slice(1).filter(n=>n>=3).length,minPath=Math.min(...trajectory.map(x=>x.minimumSignedDistanceM));
 const gates={originalNativeJointDomain:baseAngles.every((v,i)=>v*accepted<=sourceUpperAngles[i]+1e-12),originalFullHandTrajectoryEnvelope:minPath>=-.0011,
  originalThreeFingerContactCount:touching>=3,originalEachFingerCurlMinimum:candidateClosure.slice(1).every(x=>x>=.05),realThumbContact:closed.fingerNearVertexCounts[0]>=3,
  actualBoneLengths:trajectory.every(x=>x.boneLengthErrorM<=.00001),otherFingerValuesUnchanged:candidateClosure.every((x,i)=>i===2||x===fit.closure[i])};
 results.push({side,baselineFit:fit,baseline,evaluatedHandVertices:ids.length,maximumFactor,search,lastExitBracket:lastExit,candidateClosure,finalMiddleJointDegrees:baseAngles.map(x=>x*accepted),closed,
  trajectory:trajectory.map(({middleFingerNearVertices,deepest,...row})=>row),minimumTrajectorySignedDistanceM:minPath,touchingNonThumbFingers:touching,gates,passed:Object.values(gates).every(Boolean)});
}
const report={schema:'native-bread-A-existing-contact-retention-candidate/1',actor:'A',release:false,rendered:false,physicalReceipt:false,
 sourceHashes:globalThis.__CAPTURE_QA_SOURCE_HASHES__,source:{repository:'haihao0307/guilin-dem-pipeline',commit:'4de5f1d420a43355014bc1e6e572dd9c25058eb8',path:'kaopu-unified-human-workbench/motion-review-r04/SurfaceContact.mjs',localPath:sourcePath,bytes:sourceBytes.length,sha256:sha(sourceBytes),gitBlob:'de7f426a46f9a14360fc9040334312c2520c3f45',line:31},
 intervention:'Only the middle finger retains the last real surface contact on the unchanged existing t in [0,1] and [60,76,45] native curl curve. Original forty calibration intervals bracket that surface exit; scalar bisection refines it. All other fingers, real palm support, full hand, ellipsoid dimensions, all collision gates and the three-finger requirement remain identical. The rejected original-domain-extension candidate is retained separately.',
 shape,baseAngles,sourceUpperAngles,maximumFactor,results,passed:results.every(x=>x.passed),
 scope:'Complete canonical native hand/full CSR neutral geometry and 21 measured opening-to-closing states. This candidate has no arm approach, real ItemWorld transport, transaction, GNM mouth, shoes or visual acceptance.'};
const file=path.join(root,'evidence/BREAD_A_EXISTING_CONTACT_RETENTION_CANDIDATE.json');fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({file,passed:report.passed,rows:results.map(x=>({side:x.side,factor:x.candidateClosure[2],degrees:x.finalMiddleJointDegrees,middleGapM:x.closed.fingerMinimumSignedDistanceM[2],fingerCounts:x.closed.fingerNearVertexCounts,minPath:x.minimumTrajectorySignedDistanceM,gates:x.gates}))}));
