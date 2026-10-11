import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../vendor/three.module.js';
import {createRailGeometry} from '../wheel-rail-profile.mjs';
const make=limit=>createRailGeometry(T,{lengthM:488,centerXM:-8,centerZM:.752425,...(limit?{maxSegmentLengthM:limit}:{})});
test('continuous profiled rail bounds every raster triangle to 8m longitudinal span',()=>{
 const g=make(),p=g.attributes.position;assert.equal(g.userData.longitudinalSegments,61);
 for(let i=0;i<g.index.count;i+=3){const xs=[0,1,2].map(j=>p.getX(g.index.getX(i+j)));assert(Math.max(...xs)-Math.min(...xs)<=8+1e-6);}
 assert.equal(g.index.count/3,15620);g.dispose();
});
test('partition preserves the same rail solid and ray intersections',()=>{
 const old=make(488),current=make();assert.deepEqual(current.boundingBox,old.boundingBox);
 const meshes=[old,current].map(g=>new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}))),ray=new T.Raycaster();
 for(const x of[-251.9,-200.5,-100.7,-8,0,100.3,235.9])for(const z of[.69,.72,.752425,.78,.81]){
  ray.set(new T.Vector3(x,1,z),new T.Vector3(0,-1,0));const hits=meshes.map(m=>ray.intersectObject(m,false));assert.equal(hits[0].length>0,hits[1].length>0);
  if(hits[0].length)assert(Math.abs(hits[0][0].point.y-hits[1][0].point.y)<1e-12);
 }
 for(const g of[old,current])g.dispose();for(const m of meshes)m.material.dispose();
});
