import './run-original-recovery-node.mjs';
import * as T from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {restoreOriginal} from '../src/original-chassis-recovery.mjs';
import {registerWheelEnvelopeDisplay,DISPLAY_WHEEL_REFERENCES} from '../src/source-display-datums.mjs';
const report=[];
for(const key of ['a4','mark3']){
 const source=await restoreOriginal(key),rootLocal=source.root.matrix.elements.slice(),nodeLocal=source.nodes.map(n=>n.matrix.elements.slice());
 const display=registerWheelEnvelopeDisplay(T,source);display.updateMatrixWorld(true);
 assert.deepEqual(source.root.matrix.elements,rootLocal);assert.deepEqual(source.nodes.map(n=>n.matrix.elements.slice()),nodeLocal);
 const box=new T.Box3().setFromObject(source.nodes[DISPLAY_WHEEL_REFERENCES[key].node],true);assert.ok(Math.abs(box.min.y)<1e-8);
 assert.equal(display.userData.physicalRailDatumCertified,false);assert.deepEqual(source.root.scale.toArray(),[1,1,1]);
 report.push({source:key,baseline:display.userData,displayWheelMinimumY:box.min.y,allSourceLocalTransformsUnchanged:true});
}
await fs.writeFile(new URL('../qa/DISPLAY_REGISTRATION.json',import.meta.url),JSON.stringify({status:'PASS',report},null,2));console.log('PASS measured wheel-envelope display-only registration; not metric/rail calibration');
