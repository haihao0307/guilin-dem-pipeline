import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {courtDimensions,installContext} from '../context.mjs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
test('stone closure is exact and does not duplicate structs or functions',()=>{
 const stone=read('../mothers/context-stone.glsl'),base=read('../mothers/kaopu-original.glsl');
 const evidence=JSON.parse(read('../provenance/context-ground-sources.json'));
 assert.equal(crypto.createHash('sha256').update(stone).digest('hex'),evidence.sha256);
 assert.equal(evidence.unchangedFunctionBodies,true);
 assert.equal(evidence.sourceCommit,'1f46ba78170752a07086caa3e66c87f2fa4c7fcf');
 const full=base+'\n'+stone,names=[...full.matchAll(/^\w+\s+(\w+)\([^\n]*\)\s*\{/gm)].map(x=>x[1]);
 assert.equal(new Set(names).size,names.length);assert.equal(full.split('struct KpSurface {').length-1,1);
});
test('courts replace placeholder, preserve metre scale, and follow selected buildings',async()=>{
 const context=new THREE.Group(),scene=new THREE.Scene();scene.add(context);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(700,500),new THREE.MeshStandardMaterial()),grid=new THREE.GridHelper(500,50);context.add(ground,grid);
 const objects=[0,1,2].map(i=>{const size=new THREE.Vector3(10+i*5,20+i*10,12+i*3),group=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(...size.toArray()),new THREE.MeshStandardMaterial());group.add(mesh);group.position.set(i*40, size.y/2,2);scene.add(group);return {size,group,mesh,entry:{id:'test-'+i}};});
 scene.updateMatrixWorld(true);let hook,requests=0;
 const priorWindow=globalThis.window,priorFetch=globalThis.fetch;
 globalThis.window={__KAOPU_TRIAL__:{setContextHook:h=>hook=h}};
 globalThis.fetch=async()=>({ok:true,text:async()=>read('../mothers/context-stone.glsl')});
 try{
  const r=await installContext({THREE,context,ground,grid,objects,requestRender:()=>requests++,source:read('../mothers/kaopu-original.glsl')});
  assert.equal(context.children.length,3);assert.equal(ground.parent,null);assert.equal(grid.parent,null);
  assert.equal(r.plants.count,0);assert.equal(r.demDownloaded,false);assert.equal(r.surveyed,false);
  for(let i=0;i<3;i++){
   const pad=context.children[i],d=courtDimensions(objects[i].size);assert.deepEqual(pad.position.toArray(),[i*40,-.055,2]);assert.equal(pad.children.length,2);
   const b=new THREE.Box3().setFromObject(pad),size=b.getSize(new THREE.Vector3());assert.ok(Math.abs(size.x-d.width)<1e-5);assert.ok(Math.abs(size.z-d.depth)<1e-5);
   for(const mesh of pad.children){assert.equal(mesh.receiveShadow,true);const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};mesh.material.onBeforeCompile(shader);assert.ok(shader.fragmentShader.indexOf('KpSurface court=')<shader.fragmentShader.indexOf('roughnessFactor=court.roughness'));assert.ok(shader.fragmentShader.includes('normal=courtBump(-vViewPosition,normal,court.height*courtResolved)'));}
  }
  objects[0].group.visible=objects[2].group.visible=false;hook();assert.deepEqual(context.children.map(x=>x.visible),[false,true,false]);assert.ok(requests>=2);
 }finally{globalThis.window=priorWindow;globalThis.fetch=priorFetch;}
});
