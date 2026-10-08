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
    assert.equal(room.proof.roofCutaway,true);
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
    assert.ok(bounds.max.z<=7.70);
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

test('Only the two chosen stations get rooms by default',()=>{
  for(const index of [1,2,3,4,6,7,8]){
    const room=createStationRoom({index});assert.equal(room.proof.enabled,false);assert.equal(room.group.children.length,0);room.dispose();
  }
  const explicit=createStationRoom({index:2},{variant:'staff-tea-corner'});assert.equal(explicit.proof.enabled,true);explicit.dispose();
  assert.throws(()=>createStationRoom({index:0},{variant:'unexpected'}),/Unknown station room variant/);
});
