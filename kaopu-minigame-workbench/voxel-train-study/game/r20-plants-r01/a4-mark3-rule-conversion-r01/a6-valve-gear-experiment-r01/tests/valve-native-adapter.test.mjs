import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildLocomotiveMechanics} from '../../student-native-r01/src/locomotive-mechanics.mjs';
import {buildDrivingWheel} from '../../student-native-r01/src/driving-wheel.mjs';
import {correctA6Mechanics} from '../../a6-native-r02/src/a6-motion-corrections.mjs';
import {createA6MotionModel,transformA6Point,inspectA6MeshSurfacePair} from '../../a6-native-r02/src/a6-motion.mjs';
import {createValveNativeAdapter,evaluateValveNativeAdapter} from '../src/valve-native-adapter.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const source=buildLocomotiveMechanics(),sourceHash=hash(source.parts),base=createA6MotionModel({mechanics:correctA6Mechanics(source).mechanics,wheel:buildDrivingWheel()}),baseHash=hash(base.sourceMechanics.parts),adapter=createValveNativeAdapter({baseModel:base});
assert.equal(adapter.mechanics.parts.length,338);assert.deepEqual(adapter.mechanics.parts.map(p=>p.name),base.sourceMechanics.parts.map(p=>p.name));
assert.equal(adapter.supplementalParts.length,12);assert.equal(adapter.movingPartNames.length,22);assert.equal(adapter.corrections.length,20);
const total=[...adapter.mechanics.parts,...base.supplementalParts,...adapter.supplementalParts];
assert.equal(total.length,354);assert.equal(new Set(total.map(p=>p.name)).size,total.length);
const unit=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],start=evaluateValveNativeAdapter(adapter,0);
for(const matrix of Object.values(start.partTransforms))assert.deepEqual(matrix,unit);
assert.deepEqual(evaluateValveNativeAdapter(adapter,2*Math.PI),start);
for(const [key,value]of Object.entries(adapter.finiteSlotChecks))if(key.endsWith('GapM')||key.endsWith('GapRad'))assert(value>0,`${key} has no finite clearance`);
const near=(a,b,t=1e-10)=>assert(Math.abs(a-b)<t,`${a} != ${b}`),byName=new Map(total.map(p=>[p.name,p]));
let maxFrameEndpointErrorM=0,maxRigidDistanceErrorM=0;
const localChecks=[];
const transformed=(part,matrix)=>({...part,positions:part.positions.flatMap((v,i)=>i%3?[]:transformA6Point(matrix,part.positions.slice(i,i+3)))});
for(let i=0;i<=360;i++){
  const pose=evaluateValveNativeAdapter(adapter,i*Math.PI/180),j=pose.joints;
  for(const d of adapter.descriptors){
    const matrix=pose.partTransforms[d.name],p=d.part.positions,a=p.slice(0,3),b=p.slice(-3),aa=transformA6Point(matrix,a),bb=transformA6Point(matrix,b);
    const error=Math.abs(Math.hypot(...aa.map((v,k)=>v-bb[k]))-Math.hypot(...a.map((v,k)=>v-b[k])));maxRigidDistanceErrorM=Math.max(maxRigidDistanceErrorM,error);assert(error<1e-12);
    for(let k=0;k<p.length;k+=Math.max(3,3*Math.floor(p.length/90))){if(k+2>=p.length)break;const q=transformA6Point(matrix,p.slice(k,k+3));for(let axis=0;axis<3;axis++)assert(q[axis]>=d.continuousBounds.min[axis]-1e-10&&q[axis]<=d.continuousBounds.max[axis]+1e-10,`${d.name} exceeded analytical whole-cycle envelope`);}
    if(d.kind==='link')for(const key of[d.a,d.b]){
      const a0=[d.side*d.plane,...adapter.reference[key]],target=[d.side*d.plane,...j[key]],q=transformA6Point(matrix,a0),e=Math.hypot(...q.map((v,k)=>v-target[k]));maxFrameEndpointErrorM=Math.max(maxFrameEndpointErrorM,e);assert(e<2e-12,`${d.name} disconnected ${key}`);
    }
  }
  // Full finite die, slot, pin and actual valve guide meshes, not point proxies.
  if(i%5===0)for(const side of[-1,1])for(const [a,b]of[
    [`radius-rod-${side}`,`valve-experiment-expansion-die-${side}`],
    [`slotted-expansion-link-${side}`,`valve-experiment-expansion-die-${side}`],
    [`radius-rod-${side}`,`valve-experiment-lifting-die-${side}`],
    [`reverser-lifting-link-${side}`,`valve-experiment-lifting-die-${side}`],
    [`valve-rod-crosshead-${side}`,`valve-experiment-valve-crosshead-guide-${side}`],
    [`slotted-expansion-link-${side}`,`expansion-link-trunnion-${side}`],
  ]){
    const pa=pose.partTransforms[a]?transformed(byName.get(a),pose.partTransforms[a]):byName.get(a),pb=pose.partTransforms[b]?transformed(byName.get(b),pose.partTransforms[b]):byName.get(b),hit=inspectA6MeshSurfacePair(pa,pb);
    if(hit.surfaceWitness)localChecks.push({phaseDegrees:i,...hit});
  }
}
assert.equal(hash(source.parts),sourceHash);assert.equal(hash(base.sourceMechanics.parts),baseHash);
const moduleHashes=Object.fromEntries(['valve-constraints.mjs','valve-native-adapter.mjs','valve-native-primitives.mjs'].map(name=>[name,createHash('sha256').update(fs.readFileSync(path.join(root,'src',name))).digest('hex')]));
const report={schema:'finite-valve-adapter-contract/1',moduleHashes,componentCount:354,inheritedNames:338,newValveComponents:12,basePistonComponents:4,sameNameGeometryRevisions:20,valveMovingParts:22,poses:361,maxFrameEndpointErrorM,maxRigidDistanceErrorM,finiteSlotChecks:adapter.finiteSlotChecks,localFiniteInterfaceWitnesses:localChecks,sourceArraysUnchanged:true,fullVehicleApproval:false};
fs.writeFileSync(path.join(root,'docs/FINITE_ADAPTER_CONTRACT.json'),JSON.stringify(report,null,2)+'\n');
const ledger={schema:'a6-finite-valve-design-ledger/1',moduleHashes,designStatus:'design candidate; primary chassis locks retained; historical gear dimensions unresolved',primaryLocks:adapter.constraints.primaryDimensions,dimensions:adapter.constraints.dimensions,finiteSections:adapter.design,derived:{mainRodLengthM:adapter.constraints.mainRodLengthM,physicalReturnCrankLengthM:adapter.constraints.physicalReturnCrankLengthM,radiusRodLengthM:adapter.constraints.radiusRodLengthM,unionLengthM:adapter.constraints.unionLengthM,H:adapter.constraints.H},corrections:adapter.corrections,supplementalParts:adapter.supplementalParts.map(p=>({name:p.name,metadata:p.metadata,vertices:p.positions.length/3,triangles:p.indices.length/3})),jointSnapshots:[0,90,180,270,360].map(deg=>({phaseDegrees:deg,...evaluateValveNativeAdapter(adapter,deg*Math.PI/180).joints})),finiteSlotChecks:adapter.finiteSlotChecks,unresolved:adapter.unresolvedSubsystems};
fs.writeFileSync(path.join(root,'docs/FINITE_VALVE_DESIGN_LEDGER.json'),JSON.stringify(ledger,null,2)+'\n');
console.log(JSON.stringify(report));
assert.equal(localChecks.length,0,'A finite working interface still intersects; evidence saved');
