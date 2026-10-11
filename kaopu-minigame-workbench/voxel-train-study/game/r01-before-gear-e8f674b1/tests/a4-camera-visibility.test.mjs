import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import {CAMERA_PRESETS,getCameraPreset,boundCameraPose} from '../camera-presets.mjs';
import {verticalFov} from '../anchored-zoom.mjs';
import {streetVisibilityProbe} from './camera-visibility.mjs';

const photoIds=['leftSide','rightSide','tailBrand'];
test('Photography presets frame every focus-bound corner in both real layout projections',()=>{
 for(const id of photoIds)for(const [layout,aspect] of [['landscape',16/9],['portrait',9/16]]){
  const p=getCameraPreset(id,layout),safe=boundCameraPose(p.position,p.target);
  const camera=new THREE.PerspectiveCamera(verticalFov(aspect,p.projection),aspect,.08,320);
  camera.zoom=p.zoom;camera.position.fromArray(safe.position);camera.lookAt(new THREE.Vector3(...safe.target));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const {min,max}=p.focusBounds;let extentX=0;
  for(const x of[min[0],max[0]])for(const y of[min[1],max[1]])for(const z of[min[2],max[2]]){
   const v=new THREE.Vector3(x,y,z).project(camera);
   assert(Math.abs(v.x)<.99&&Math.abs(v.y)<.99&&v.z>-1&&v.z<1,JSON.stringify({id,layout,point:[x,y,z],ndc:v.toArray()}));
   extentX=Math.max(extentX,Math.abs(v.x));
  }
  assert(extentX>.35,'The subject must remain readable, rather than a distant dot');
 }
 assert(CAMERA_PRESETS.leftSide.landscape.position[2]>0);
 assert(CAMERA_PRESETS.rightSide.landscape.position[2]<0);
 for(const id of ['leftSide','rightSide'])for(const layout of ['landscape','portrait']){const p=getCameraPreset(id,layout),aspect=layout==='landscape'?16/9:9/16,hfov=2*Math.atan(Math.tan(verticalFov(aspect,p.projection)*Math.PI/360)/p.zoom*aspect)*180/Math.PI;assert(hfov>=35&&hfov<=55);assert.equal(CAMERA_PRESETS[id].visibility,'open-track');assert.equal(p.zoom,1);}
 for(const id of ['leftSide','rightSide']){
  assert(CAMERA_PRESETS[id].focusBounds.min[0]<=-16.65);
  assert(CAMERA_PRESETS[id].focusBounds.max[0]>=5);
 }
});

test('Visibility test detects actual triangles from both sides and ignores objects beyond the target',()=>{
 const root=new THREE.Group(),material=new THREE.MeshBasicMaterial({side:THREE.FrontSide});
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),material);root.add(mesh);
 const probe=streetVisibilityProbe(root);
 try{
  assert.equal(probe.firstHit([0,0,5],[0,0,-5]).kind,'submitted-triangle');
  assert.equal(probe.firstHit([0,0,-5],[0,0,5]).kind,'submitted-triangle');
  assert.equal(probe.firstHit([0,0,5],[0,0,2]),null);
  assert.equal(probe.firstHit([4,0,5],[4,0,-5]),null);
 }finally{probe.dispose();}
 assert.equal(material.side,THREE.FrontSide);mesh.geometry.dispose();material.dispose();
});

test('Visibility accounts for cloth shader displacement without mutating live geometry',async()=>{
 const {CLOTH_POSITION}=await import('../street/batch-materials.mjs');
 assert.match(CLOTH_POSITION,/transformed\.x\+=sin\(stPhase\)\*stMotion\.z\*\.35\*stMotion\.x/);
 assert.match(CLOTH_POSITION,/transformed\.z\+=sin\(stPhase\+\.3\)\*stMotion\.z\*stMotion\.x\*stMotion\.x/);
 const root=new THREE.Group(),g=new THREE.PlaneGeometry(2,2),material=new THREE.MeshBasicMaterial();
 const values=new Float32Array(g.attributes.position.count*4);
 for(let i=0;i<g.attributes.position.count;i++)values.set([1,0,3,1],i*4);
 g.setAttribute('stMotion',new THREE.BufferAttribute(values,4));root.add(new THREE.Mesh(g,material));
 const original=Array.from(g.attributes.position.array),probe=streetVisibilityProbe(root,0);
 try{assert.equal(probe.firstHit([0,0,5],[0,0,.5]).kind,'submitted-triangle');assert.deepEqual(Array.from(g.attributes.position.array),original);}
 finally{probe.dispose();g.dispose();material.dispose();}
});
