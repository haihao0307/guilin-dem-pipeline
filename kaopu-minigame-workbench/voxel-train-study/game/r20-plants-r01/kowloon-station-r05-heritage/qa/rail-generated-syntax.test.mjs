import test from 'node:test';
import assert from 'node:assert/strict';
import {stationRailWGSL,stationRailCurves,STATION_RAIL} from '../native-station-rail.mjs';

test('analytic rail emitter delimits every signed number, preserving subtraction of negative centres',()=>{
 const shader=stationRailWGSL();
 assert.ok(shader.includes('(q.y-(-0.305))'));
 assert.doesNotMatch(shader,/--|\+\+/);
 for(const m of stationRailCurves())if(m.type==='arc'&&m.center[1]<0){
  const value=Math.abs(m.center[1])<1e-13?'0.':Number.isInteger(m.center[1])?m.center[1]+'.':String(m.center[1]);
  assert.ok(shader.includes('('+value+')'));
 }
 assert.equal(STATION_RAIL.heightM,.15875);
});

import {WGSL} from '../receiver.mjs';
test('complete assembled station WGSL contains no ambiguous signed numeric token',()=>{
 assert.doesNotMatch(WGSL.replace(/\/\/[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,''),/--(?=\d)|\+\+(?=\d)/);
});

