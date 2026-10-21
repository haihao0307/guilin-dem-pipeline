/** One fixed actual-source body posture. This is not a physical transaction. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {THREE} from '../src/NativeBinding.mjs';
import {createMotionRecoveryFixture} from './NativeMotionRecoveryFixture.mjs';
import {fitCylinderGrasp} from '../src/ActorAdapter.mjs';
import {solveNativeObjectReach} from '../src/NativeObjectReach.mjs';
import {ItemWorld,ITEM_PHYSICS,ellipsoidSurfaceDistance} from '../src/ItemWorld.mjs';
import {LifeSimulation} from '../src/LifeSimulation.mjs';
import {STREET_LAYOUT} from '../src/WorldLayout.mjs';
import {math} from '../src/NativeRig.mjs';
const {pos,sub,norm,rotation,mv,unit,cross,scale}=math,root=globalThis.__CAPTURE_QA_ROOT__;
const tracePath=path.join(root,'evidence/NATIVE_BREAD_TRANSPORT_D_FIRST_TRACE.json'),traceBytes=fs.readFileSync(tracePath),trace=JSON.parse(traceBytes);
const observed=trace.reduce((a,b)=>Math.abs(a.report.progress-.48)<=Math.abs(b.report.progress-.48)?a:b),old=observed.report;
const actor=await createMotionRecoveryFixture('D',{notify:console.log}),shape={kind:'ellipsoid',halfExtentsM:[.045,.035,.075],gripHeight:0},sides={};
for(const side of ['L','R'])sides[side]=fitCylinderGrasp({rig:actor.rig,binding:actor.binding,fingers:actor.fixture.fingers,patch:actor.fixture.patches[side],handVertices:actor.fixture.handSurfaceVertices[side],side,shape});
const fit={profile:'bread',shape,sides,admissible:['L','R'].every(s=>sides[s].admissible)};actor.graspProfiles.bread=fit;actor.selectGrasp('bread');actor.motion.reset();
const target=[3.475,1.0349949,-.49],bodyReport=actor.motion.update({dt:0,time:observed.time,x:old.rootWorld[0],z:old.rootWorld[2],yaw:Math.PI,mode:'trade',progress:.48,target,grip:1,graspProfile:'bread'});
const before=actor.rig.posedMatrices.map(m=>Array.from(m)),solution=solveNativeObjectReach(actor.motion,target,{side:'R',turn:Math.PI/2,orientationWeight:1,allowYaw:false});
actor.poseTools.commit({side:'R',grip:1,target,solution});
const body=actor.rig,hand=body.limbs.armR,handR=rotation(body.skinMatrices[hand.c]);
const n=actor.motion._direction(unit(mv(handR,body.hand.R.palm)),Math.PI),F=actor.motion._direction(unit(mv(handR,body.hand.R.forward)),Math.PI),Y=unit(cross(F,n)),X=scale(F,-1);
const sim=new LifeSimulation({initialBottles:[],actors:[{...new LifeSimulation().actor('D'),x:old.rootWorld[0],z:old.rootWorld[2],yaw:Math.PI}]}),world=new ItemWorld({THREE,scene:new THREE.Scene(),sim,courtyard:{colliders:STREET_LAYOUT.colliders,shop:{bread:[]},recycle:{top:.85}},actors:[actor]});
const fixtures=world.world.bodies.filter(b=>/^bakery-(counter|tray|serving-board)$/.test(b._itemFixture||''));for(const fixture of fixtures)fixture.updateAABB();
const center=new THREE.Vector3(...observed.item.position),inverseQ=new THREE.Quaternion(...observed.item.quaternion).invert();
let minimum=Infinity,deepest=null,penetration=0,fixtureWitness=null;
for(const id of actor.fixture.handSurfaceVertices.R){
 const p=actor.poseTools.toWorld(actor.poseTools.sampleVertex(id)),local=p.clone().sub(center).applyQuaternion(inverseQ),sdf=ellipsoidSurfaceDistance(local.toArray(),ITEM_PHYSICS.breadHalfExtentsM);
 if(sdf<minimum){minimum=sdf;deepest={id,world:p.toArray(),actualObjectLocal:local.toArray()};}
 for(const b of fixtures){const lo=b.aabb.lowerBound,hi=b.aabb.upperBound;if(p.x>lo.x&&p.x<hi.x&&p.y>lo.y&&p.y<hi.y&&p.z>lo.z&&p.z<hi.z){const d=Math.min(p.x-lo.x,hi.x-p.x,p.y-lo.y,hi.y-p.y,p.z-lo.z,hi.z-p.z);if(d>penetration){penetration=d;fixtureWitness={id,fixture:b._itemFixture,point:p.toArray()};}}}
}
const armSubtree=new Set(body.descendants[hand.a]);let bodyChange=0;for(let j=0;j<body.count;j++)if(!armSubtree.has(j))for(let k=0;k<16;k++)bodyChange=Math.max(bodyChange,Math.abs(before[j][k]-body.posedMatrices[j][k]));
const palm=actor.poseTools.toWorld(actor.poseTools.samplePalm('R')).toArray(),validation=body.validate();
const report={schema:'native-bread-side-grasp-fixed-posture/1',actor:'D',rendered:false,physicalReceipt:false,release:false,
 scope:'One quarter-turn hand candidate on the true source-contact body conditions; complete canonical native hand/CSR, actual physical ellipsoid dimensions and real fixture AABBs. No new chain, object motion, eating, GNM mouth or shoe acceptance.',
 sourceHashes:globalThis.__CAPTURE_QA_SOURCE_HASHES__,trace:{path:path.relative(root,tracePath),sha256:crypto.createHash('sha256').update(traceBytes).digest('hex'),frame:observed.frame,time:observed.time,observedProgress:old.progress,evaluatedProgress:.48,reason:'Nearest existing source-contact trace frame; both lie on the unchanged full trade source envelope'},
 body:{rootWorld:actor.root.position.toArray(),sourceRootWorld:old.rootWorld,pelvisWorld:bodyReport.pelvisWorld,sourcePelvisWorld:old.pelvisWorld,pelvisErrorM:norm(sub(bodyReport.pelvisWorld,old.pelvisWorld)),unchangedOutsideActualArmMax:bodyChange,feet:bodyReport.feet,validation},
 actualObject:{position:observed.item.position,quaternion:observed.item.quaternion,halfExtentsM:ITEM_PHYSICS.breadHalfExtentsM.slice(),transformChanged:false},
 grip:{turnRadians:Math.PI/2,fitHalfExtentsM:shape.halfExtentsM,physicalDimensionsUnchanged:true,axes:{X,Y,Z:n,handForward:F},target,palm,palmErrorM:norm(sub(palm,target)),solution,fit},
 measured:{fullHandVertices:actor.fixture.handSurfaceVertices.R.length,minimumActualEllipsoidSignedDistanceM:minimum,deepest,maximumHandFixturePenetrationM:penetration,fixtureWitness,fixtures:fixtures.map(b=>({id:b._itemFixture,min:b.aabb.lowerBound.toArray(),max:b.aabb.upperBound.toArray()}))},
 gates:{bothNativeFits:fit.admissible,originalStrictWrist:solution.wristBendDegrees<65&&!solution.clamped,realPalmContact:norm(sub(palm,target))<=.012,fullHandOriginalContactEnvelope:minimum>=-.0011,actualFixtureClearance:penetration<=.004,nativeBoneLength:validation.maxBoneLengthError<=.00001,bodyOutsideArmUnchanged:bodyChange===0},
 mouthFollowup:{verified:false,finalHandTurnRadians:Math.PI,requiredStartTurnRadians:Math.PI/2,physicalGripDepthM:.15,mouthClearanceM:.012,condition:'Final palm normal points toward the actual mouth; any additional yaw invalidates this scalar depth construction and requires actual ellipsoid-mouth verification'}};
report.passed=Object.values(report.gates).every(Boolean);const file=path.join(root,'evidence/BREAD_SIDE_GRASP_D_FIXED_CANDIDATE.json');fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({file,passed:report.passed,gates:report.gates,wristDegrees:solution.wristBendDegrees,minimumHandSDFM:minimum,fixturePenetrationM:penetration,palmErrorM:report.grip.palmErrorM,bodyErrorM:report.body.pelvisErrorM}));
