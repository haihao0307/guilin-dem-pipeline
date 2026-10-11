import test from 'node:test';import assert from 'node:assert/strict';import{pathToFileURL}from'node:url';
import{writeRescueLineGeometry}from'../rescue-gameplay-view.mjs';
const THREE=await import(process.env.NATIVE_HOST_THREE_FILE?pathToFileURL(process.env.NATIVE_HOST_THREE_FILE).href:new URL('../../../../vendor/three.module.js',import.meta.url).href);
test('actual same-host Three r170 guide buffer can shrink, grow, clear and reuse safely',()=>{assert.equal(THREE.REVISION,'170');const g=new THREE.BufferGeometry();let attribute=null;for(const n of [72,39,18,2,0,1,3,64,128,9]){const points=Array.from({length:n},(_,i)=>[i*.1,20+i*.02,-i*.03]),r=writeRescueLineGeometry({THREE,geometry:g,points});if(!attribute)attribute=g.getAttribute('position');assert.equal(g.getAttribute('position'),attribute);assert.equal(r.livePoints,n);assert.equal(g.drawRange.count,n);assert(Number.isFinite(g.boundingSphere.radius));assert([...g.getAttribute('position').array].every(Number.isFinite));for(let i=0;i<n;i++)assert(Math.abs(g.getAttribute('position').getX(i)-points[i][0])<1e-5);assert.equal(g.getAttribute('lineDistance').count,attribute.count);}g.dispose();});
test('actual r170 guide lengths never draw stale tail geometry after a short selection',()=>{const g=new THREE.BufferGeometry();writeRescueLineGeometry({THREE,geometry:g,points:[[0,0,0],[50,0,0],[50,0,100]]});const r=writeRescueLineGeometry({THREE,geometry:g,points:[[0,0,0],[3,0,0],[3,0,4]]});assert.equal(r.length,7);assert.equal(g.drawRange.count,3);assert.equal(g.getAttribute('lineDistance').getX(2),7);assert(g.boundingSphere.radius<3);g.dispose();});

import {makeRescueDirectorCue} from '../rescue-gameplay-view.mjs';
import {makeBuildingRecipe} from '../building-plan.mjs';
import {makeRescueContract} from '../rescue-contract.mjs';
import {createCityRescueGame} from '../rescue-gameplay.mjs';
test('actual host perspective keeps all declared heads and route points above the HUD',()=>{
 const game=createCityRescueGame({contract:makeRescueContract(makeBuildingRecipe())});
 for(const [width,height] of [[900,700],[390,844],[1280,720],[900,500]])for(const event of [null,{type:'selection',personId:'east-neighbour',anchorId:'half-8',mode:'front'},{type:'rescue-started',personId:'east-neighbour',anchorId:'half-7',mode:'front'},{type:'selection',personId:'east-neighbour',anchorId:'W7-home',mode:'borrowed'}]){
  const cue=makeRescueDirectorCue(game,game.snapshot(),event,{width,height,fov:43}),camera=new THREE.PerspectiveCamera(43,width/height,.05,180);camera.position.fromArray(cue.position);camera.lookAt(new THREE.Vector3(...cue.lookAt));camera.updateMatrixWorld(true);const r=cue.safeScreenRect;
  for(const p of cue.fitPoints){const v=new THREE.Vector3(...p).project(camera),x=(v.x+1)/2,y=(1-v.y)/2;assert(x>=r.left-1e-6&&x<=r.right+1e-6&&y>=r.top-1e-6&&y<=r.bottom+1e-6,JSON.stringify({width,height,event,p,x,y,r}));assert(v.z>-1&&v.z<1);}
 }
});

test('both real success states retain two rooftop residents and the actual crew above desktop/mobile HUD',()=>{
 for(const order of [[['east-neighbour','half-7','front'],['west-neighbour','landing-8','stairs']],[['west-neighbour','landing-8','stairs'],['east-neighbour','W7-home','borrowed']]]){
  const game=createCityRescueGame({contract:makeRescueContract(makeBuildingRecipe())});game.command({type:'start'});
  for(const [personId,anchorId,mode]of order){if(game.snapshot().rope.state==='deployed'){assert(game.command({type:'recover'}).accepted);game.update(game.snapshot().operation.end);}assert(game.command({type:'rescue',personId,anchorId,mode}).accepted);game.update(game.snapshot().operation.end);}
  const snapshot=game.snapshot();assert.equal(snapshot.status,'succeeded');assert(snapshot.actors.filter(a=>a.id!=='crew').every(a=>a.isSafe));
  for(const [width,height]of [[900,700],[390,844],[1280,720],[900,500]]){
   const cue=makeRescueDirectorCue(game,snapshot,{type:'success'},{width,height,fov:43});assert.equal(cue.cameraIntent,'rescue-success');assert.deepEqual(new Set(cue.subjects.map(a=>a.id)),new Set(snapshot.actors.map(a=>a.id)));assert(cue.nodeIds.includes('roof'));
   const camera=new THREE.PerspectiveCamera(43,width/height,.05,180);camera.position.fromArray(cue.position);camera.lookAt(new THREE.Vector3(...cue.lookAt));camera.updateMatrixWorld(true);const r=cue.safeScreenRect;
   for(const p of cue.fitPoints){const v=new THREE.Vector3(...p).project(camera),x=(v.x+1)/2,y=(1-v.y)/2;assert(x>=r.left-1e-6&&x<=r.right+1e-6&&y>=r.top-1e-6&&y<=r.bottom+1e-6,JSON.stringify({order,width,height,p,x,y,r}));assert(v.z>-1&&v.z<1);}
  }
 }
});
