import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {ThumbContact} from '../../../kaopu-unified-human-workbench/motion-review-r02/ThumbContact.mjs';
import {BoxingRig} from '../../../kaopu-unified-human-workbench/full/boxing-r03/MotionR03.mjs';
import {BOXING_PROGRAMS} from '../../../kaopu-unified-human-workbench/full/boxing-r03/MotionPrograms.mjs';
import {RigidPoseSampler} from '../../../kaopu-unified-human-workbench/motion-review-r01/Core.mjs';
if(!process.argv[2])throw Error('Usage: node test-thumb.mjs native-r04.json [report.json]. Fixture is exported by .github/workflows/motion-r02-hand-fixture.yml; not an imported product model.');
const bytes=fs.readFileSync(process.argv[2]),h=JSON.parse(bytes);assert.equal(h.sourceBuild,'773f717b38ff5adf776c99fc30f06c113b4727a6');h.names=h.rig.names;
const th=new ThumbContact(h),sampler=new RigidPoseSampler(h.rig),report={environment:'Node numerical test on fully initialized original R04 native fixture; not GPU/contact-force certification',fixtureSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),checks:[],thumbMaxErrorM:0,nonThumbMaxDifference:0,minOutsideOffsetM:Infinity,maxBoneErrorM:0,frames:0};
for(const program of BOXING_PROGRAMS){const rig=new BoxingRig({...h.rig,stature:h.height,floorOffset:h.floorOffset});for(const fighter of [0,1])for(const t of [0,1,2.1,3.5,5,7,9,11,13,15.8]){
 const f=rig.evaluate(t,{programId:program.id,fighter,poseOutput:false}),old=f.posedMatrices.map(m=>Array.from(m)),out=th.repair(f,{kind:'boxing'},t);report.frames++;
 for(let j=0;j<h.names.length;j++){if(h.names[j].startsWith('finger1-'))continue;for(let k=0;k<16;k++)report.nonThumbMaxDifference=Math.max(report.nonThumbMaxDifference,Math.abs(old[j][k]-out.posedMatrices[j][k]));}
 sampler.apply(sampler.pack(out.posedMatrices));report.maxBoneErrorM=Math.max(report.maxBoneErrorM,sampler.boneError());for(const thumb of out.thumbReport){report.thumbMaxErrorM=Math.max(report.thumbMaxErrorM,thumb.goalErrorM);report.minOutsideOffsetM=Math.min(report.minOutsideOffsetM,thumb.outsideOffsetM);}
 }report.checks.push(program.id);}
report.pass=report.thumbMaxErrorM<1e-4&&report.maxBoneErrorM<1e-6&&report.nonThumbMaxDifference===0&&report.minOutsideOffsetM>0;
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));assert(report.pass,'Thumb/native bone regression');
