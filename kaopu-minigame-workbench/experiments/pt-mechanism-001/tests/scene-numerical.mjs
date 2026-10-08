import * as THREE from '../vendor/three.module.js';
import {createGallery} from '../scene.js';
import {rotateToTarget} from '../core.js';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
// Drawing calls are stubbed; this validates geometry/rays, NOT appearance.
const noop=()=>{};
globalThis.document={createElement(tag){assert.equal(tag,'canvas');return {width:0,height:0,getContext(){return new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});}};}};
const gallery=createGallery(THREE), checks=[];
const test=(name,fn)=>{fn();checks.push(name);};
test('Scene builds using real Three r170 geometry',()=>assert.equal(gallery.scene.type,'Scene'));
let triangles=0,meshes=0,nonFinite=0,shadowLights=0;
gallery.scene.traverse(o=>{if(o.isLight&&o.castShadow)shadowLights++;if(o.isMesh){meshes++;const a=o.geometry.attributes.position.array;for(const x of a)if(!Number.isFinite(x))nonFinite++;triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;}});
test('All authored position values are finite',()=>assert.equal(nonFinite,0));
test('Exactly two shadow-casting lights',()=>assert.equal(shadowLights,2));
test('Camera target is outside plinth collider',()=>{const p=gallery.focusTarget.getWorldPosition(new THREE.Vector3());for(const b of gallery.collisionBoxes){const box=new THREE.Box3(new THREE.Vector3(...b.min),new THREE.Vector3(...b.max));assert(!box.containsPoint(p));}});
function viewAt(x,z){const c=new THREE.PerspectiveCamera(53,1.44,.06,60);c.position.set(x,1.65,z);const t=gallery.focusTarget.getWorldPosition(new THREE.Vector3()),r=rotateToTarget(c.position,t);c.rotation.set(r.pitch,r.yaw,0,'YXZ');c.updateMatrixWorld();gallery.scene.updateMatrixWorld(true);const p=t.clone().project(c);const ray=new THREE.Raycaster(c.position,t.clone().sub(c.position).normalize(),0,c.position.distanceTo(t)-.08);return {projected:p.toArray(),blockedBy:ray.intersectObjects(gallery.occluders,true).map(h=>h.object.name||h.object.type)};}
const entrance=viewAt(1.3,1.8),observation=viewAt(1.3,-2.6);
test('Entrance camera points directly at target',()=>assert(Math.hypot(...entrance.projected.slice(0,2))<1e-10));
test('Observation ray is unobstructed at test position',()=>assert.deepEqual(observation.blockedBy,[]));
function phaseSnapshot(n){gallery.applyPhase(n);gallery.scene.updateMatrixWorld(true);const a=[];gallery.focusTarget.traverse(o=>a.push(...o.matrixWorld.elements));return a;}
const phase0=phaseSnapshot(0),phase1=phaseSnapshot(1),phase1Again=phaseSnapshot(1),phase2=phaseSnapshot(2);
test('Scene phase changes actual geometry transforms',()=>{assert.notDeepEqual(phase0,phase1);assert.notDeepEqual(phase1,phase2);});
test('Applying same phase is idempotent',()=>assert.deepEqual(phase1,phase1Again));
test('Returning to phase zero restores exact transforms',()=>assert.deepEqual(phase0,phaseSnapshot(0)));
const result={passed:true,scope:'Geometry and ray mathematics with stubbed Canvas2D drawing; NO render, texture, shader, audio, or visual QA',checks,meshCount:meshes,triangleCount:triangles,shadowLights,entrance,observation};writeFileSync(new URL('./scene-numerical-results.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
