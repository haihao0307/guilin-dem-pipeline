import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {selectRayInstances,glassMayIntersectTile} from '../whole-building-floor-study-r01/renderer.mjs';
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

import {deriveAperture,apertureGlassInterval} from '../r07/apertures.mjs';
test('primary glass tile exclusion never rejects sampled analytic glass hits including rotated and inside cameras',()=>{
 let hits=0,rejected=0;
 for(const openT of [0,.35,1]){const a=deriveAperture({instanceId:1,width:1.2,height:1.4,openT,host:{origin:[0,0,0],u:[1,0,0],v:[0,1,0],w:[0,0,1],nodeId:'test-host'}}),pane=a.primitives.find(p=>p.part==='glass');
 for(const eye of [[0,0,3],[2,1,3],[-2,0,.03],pane.origin]){const f=prepareTileFrame({eye,target:eye===pane.origin?[1,0,0]:[0,0,0],fov:Math.PI/3,width:32,height:32});
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){const uv=[(2*(x+.5)-32)/32,(2*(y+.5)-32)/32],d=f.forward.map((v,i)=>v+f.tanHalfFov*(uv[0]*f.right[i]+uv[1]*f.up[i])),L=Math.hypot(...d),rd=d.map(v=>v/L),hit=apertureGlassInterval(a,pane.objectId,eye,rd);const tile=prepareTileFrustum(f,{x:Math.floor(x/8)*8,y:Math.floor(y/8)*8,width:8,height:8}),keep=glassMayIntersectTile([pane.bounds],tile);if(hit.hit){hits++;assert.ok(keep);}if(!keep)rejected++;}
 }}assert.ok(hits>100);assert.ok(rejected>100);
});
test('missing glass bound fails open and absent glass can skip optics',()=>{const t=prepareTileFrustum(prepareTileFrame({eye:[0,0,3],target:[0,0,0],fov:1,width:128,height:128}),{x:0,y:0,width:128,height:128});assert.equal(glassMayIntersectTile([null],t),true);assert.equal(glassMayIntersectTile([],t),false);});
