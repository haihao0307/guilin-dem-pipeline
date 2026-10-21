import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {selectRayInstances} from '../whole-building-floor-study-r01/renderer.mjs';
import {prepareTileFrame,prepareTileFrustum} from '../whole-building-ground-r01/tile-visibility.mjs';
test('secondary rays retain off-primary-camera objects instead of inheriting invalid screen-tile rejection',()=>{
 const frame=prepareTileFrame({eye:[0,0,5],target:[0,0,0],fov:Math.PI/3,width:128,height:128}),tile=prepareTileFrustum(frame,{x:0,y:0,width:128,height:128});
 const front={id:'front',bounds:{min:[-.1,-.1,-.1],max:[.1,.1,.1]}},behind={id:'behind-camera',bounds:{min:[-.1,-.1,9.9],max:[.1,.1,10.1]}},unknown={id:'unculled'},instances=[front,behind,unknown];
 assert.deepEqual(selectRayInstances(instances,{primaryRay:true,cullTiles:true,tile}).map(i=>i.id),['front','unculled']);
 assert.strictEqual(selectRayInstances(instances,{primaryRay:false,cullTiles:true,tile}),instances);
 assert.strictEqual(selectRayInstances(instances,{primaryRay:true,cullTiles:false,tile}),instances);
});
test('secondary shade explicitly resets all prior optical result samplers before writing those same result targets',()=>{
 const s=readFileSync(new URL('../whole-building-floor-study-r01/renderer.mjs',import.meta.url),'utf8');
 assert.match(s,/else\{for\(const \[name,unit\]of \[\['uTransmittedColor',4\],\['uReflectedColor',5\],\['uOpticalWeight',6\]\]\)this\.bindTexture\(this\.shadeProgram,name,unit,this\.sourceTexture\);\}/);
 assert.equal((s.match(/primaryRay:rayMode===0/g)||[]).length,2);
 assert.match(s,/locked=primary/);assert.match(s,/while\(this\.buffers\[next\]===locked\)/);
 // Source assertions check scheduling intent, not browser GL feedback validation.
});
