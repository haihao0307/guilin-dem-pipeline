import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createStationRoom} from './station-room.mjs';

test('Station room variants keep the boarding corridor open and have bounded geometry',()=>{
  const signatures=[];
  for(const index of [0,5]){
    const room=createStationRoom({index});
    assert.equal(room.proof.enabled,true);
    assert.equal(room.proof.frontOpen,true);
    assert.equal(room.proof.windowOpen,true);
    assert.equal(room.proof.roofCutaway,false);
    assert.equal(room.proof.completeRoof,true);
    assert.deepEqual(room.proof.teaItems,['kettle','cup-1','cup-2','enamel-water-jug']);
    assert.equal(room.proof.floorY,.82);
    let triangles=0,calls=0,disposedGeometry=0,disposedMaterial=0;
    room.group.traverse(o=>{
      if(!o.isMesh)return;
      calls++;triangles+=o.geometry.index.count/3;
      for(const value of o.geometry.attributes.position.array)assert.ok(Number.isFinite(value));
      o.geometry.addEventListener('dispose',()=>disposedGeometry++);
      o.material.addEventListener('dispose',()=>disposedMaterial++);
    });
    assert.ok(triangles<5000,`${triangles} triangles`);assert.ok(calls<=4,`${calls} calls`);
    assert.equal(room.proof.triangles,triangles);assert.equal(room.proof.drawCalls,calls);
    const bounds=new THREE.Box3().setFromObject(room.group);
    assert.ok(bounds.min.z>=5.49,`Room intrudes into boarding corridor: ${bounds.min.z}`);
    assert.ok(bounds.max.z<=7.72);
    assert.ok(bounds.min.x>=-23.78&&bounds.max.x<=-20.22);
    // A room's world frame follows its parent once, with no baked scrolling transform.
    const station=new THREE.Group();station.position.x=347.8;station.add(room.group);station.updateMatrixWorld(true);
    assert.ok(Math.abs(room.group.getWorldPosition(new THREE.Vector3()).x-325.8)<1e-8);
    signatures.push(room.group.children[0].geometry.attributes.position.count);
    room.dispose();room.dispose();
    assert.equal(disposedGeometry,calls);assert.equal(disposedMaterial,calls);
    assert.equal(room.group.children.length,0);
  }
  assert.notEqual(...signatures,'City and staff room should not be identical assemblies');
});

test('The full roof covers the room and the tea service remains visible through real windows',()=>{
  for(const index of [0,5]){
    const room=createStationRoom({index});room.group.updateMatrixWorld(true);
    const shell=room.group.children[0],service=room.group.children[1];
    const ray=new THREE.Raycaster();
    for(const x of [-1.45,-.80,0,.8,1.45])for(const z of [-.90,-.30,.30,.90]){
      ray.set(new THREE.Vector3(-22+x,4,6.55+z),new THREE.Vector3(0,-1,0));
      const hit=ray.intersectObject(shell)[0];
      assert.ok(hit&&hit.point.y>2.65,`Roof gap at ${x}, ${z}`);
    }
    // This is the actual room-view camera used in the browser visual check.
    const camera=new THREE.Vector3(-15.8,4.6,11.8),p=service.geometry.attributes.position;
    let visible=0;
    for(let i=0;i<p.count;i+=4){
      const target=new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)).add(room.group.position);
      ray.set(camera,target.clone().sub(camera).normalize());
      const hit=ray.intersectObject(shell)[0];
      if(!hit||hit.distance>camera.distanceTo(target)-.015)visible++;
    }
    assert.ok(visible>30,`Tea service hidden by intact roof or walls: ${visible} visible samples`);
    room.dispose();
  }
});

test('Only the two chosen stations get rooms by default',()=>{
  for(const index of [1,2,3,4,6,7,8]){
    const room=createStationRoom({index});assert.equal(room.proof.enabled,false);assert.equal(room.group.children.length,0);room.dispose();
  }
  const explicit=createStationRoom({index:2},{variant:'staff-tea-corner'});assert.equal(explicit.proof.enabled,true);explicit.dispose();
  assert.throws(()=>createStationRoom({index:0},{variant:'unexpected'}),/Unknown station room variant/);
});
