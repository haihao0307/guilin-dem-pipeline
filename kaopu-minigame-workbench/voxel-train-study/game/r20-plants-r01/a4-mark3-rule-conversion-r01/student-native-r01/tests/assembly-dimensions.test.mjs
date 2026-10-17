import assert from 'node:assert/strict';
import {A4_DIMENSIONS as D} from '../src/dimensions.mjs';
import {buildDrivingWheel} from '../src/driving-wheel.mjs';
import {buildLocomotiveMechanics} from '../src/locomotive-mechanics.mjs';
const wheel=buildDrivingWheel(),mechanics=buildLocomotiveMechanics();
assert.equal(wheel.parameters.crankRadius,D.cylinderStroke/2);
assert.equal(mechanics.parameters.crankRadius,wheel.parameters.crankRadius);
assert.deepEqual(mechanics.parameters.axisZ,D.axisZ);
const pin=wheel.parts.find(p=>p.name==='crank-pin');
const ys=pin.positions.filter((_,i)=>i%3===1),zs=pin.positions.filter((_,i)=>i%3===2);
const y=(Math.min(...ys)+Math.max(...ys))/2,z=(Math.min(...zs)+Math.max(...zs))/2;
for(let i=0;i<3;i++){
 const centre=mechanics.parameters.derived.drivingCrankCenters[i];
 assert(Math.abs(centre[1]-(D.driveDiameter/2+y))<1e-12);
 assert(Math.abs(centre[2]-(D.axisZ[D.driveAxisIndices[i]]+z))<1e-12);
}
assert.equal(mechanics.parameters.drivingSpringLeaves,D.driveSpringLeaves);
assert.equal(mechanics.parameters.trailingSpringLeaves,D.trailingSpringLeaves);
console.log(JSON.stringify({pass:true,threeStaticCrankCentresAgree:true,phaseOrMotionSolved:false,diameter:D.driveDiameter,crankRadius:wheel.parameters.crankRadius}));
