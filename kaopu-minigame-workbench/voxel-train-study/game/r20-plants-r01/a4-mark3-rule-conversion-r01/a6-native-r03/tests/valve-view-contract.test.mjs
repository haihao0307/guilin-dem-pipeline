import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildLocomotiveMechanics} from '../../student-native-r01/src/locomotive-mechanics.mjs';
import {buildDrivingWheel} from '../../student-native-r01/src/driving-wheel.mjs';
import {correctA6Mechanics} from '../src/a6-motion-corrections.mjs';
import {createA6MotionModel,evaluateA6Motion} from '../src/a6-motion.mjs';
import {createValveNativeAdapter,evaluateValveNativeAdapter} from '../../a6-valve-gear-experiment-r01/src/valve-native-adapter.mjs';
const base=createA6MotionModel({mechanics:correctA6Mechanics(buildLocomotiveMechanics()).mechanics,wheel:buildDrivingWheel()});
const adapter=createValveNativeAdapter({baseModel:base});
const parts=[...adapter.mechanics.parts,...base.supplementalParts,...adapter.supplementalParts];
assert.equal(new Set(parts.map(p=>p.name)).size,parts.length);
assert.deepEqual(adapter.mechanics.parts.map(p=>p.name).sort(),base.sourceMechanics.parts.map(p=>p.name).sort());
const baseMoving=new Set(base.movingPartNames);
assert.deepEqual(adapter.movingPartNames.filter(n=>baseMoving.has(n)),[],'Unexpected competing transform owners');
const names=new Set(parts.map(p=>p.name));
for(let i=0;i<=360;i++){
 const phase=i*Math.PI/180,core=evaluateA6Motion(base,phase),valve=evaluateValveNativeAdapter(adapter,phase);
 for(const [name,matrix] of Object.entries({...base.staticPartTransforms,...core.partTransforms,...adapter.staticPartTransforms,...valve.partTransforms})){
  assert(names.has(name),`Missing rendered part ${name}`);assert.equal(matrix.length,16);assert(matrix.every(Number.isFinite));
 }
 assert(valve.residualM<1e-10);
}
const view=fs.readFileSync(new URL('../view.mjs',import.meta.url),'utf8');
assert(view.includes('...valveAdapter.mechanics.parts'));assert(view.includes('...valveAdapter.supplementalParts'));assert(view.includes('...valveAdapter.movingPartNames'));assert(view.includes('...currentValvePose.partTransforms'));
console.log(JSON.stringify({status:'PASS',inheritedParts:adapter.mechanics.parts.length,totalParts:parts.length,baseMoving:base.movingPartNames.length,valveMoving:adapter.movingPartNames.length,scope:'Renderer ownership and named-part coverage, not collision approval'}));
