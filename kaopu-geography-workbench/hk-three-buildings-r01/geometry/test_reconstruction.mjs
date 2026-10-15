import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {reconstructBuffers,buildGeometry,validateScore} from './reconstruct.mjs';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const threePath=process.env.THREE_MODULE||path.resolve(here,'../viewer/vendor/three.module.js');
const THREE=await import(pathToFileURL(threePath));
const manifest=JSON.parse(fs.readFileSync(path.join(here,'buildings.json'),'utf8'));
const reports=[];
function hash(data){return createHash('sha256').update(new Uint8Array(data.positions.buffer)).update(new Uint8Array(data.normals.buffer)).digest('hex');}
function assert(value,message){if(!value)throw new Error(message);}
for(const b of manifest.buildings){
  const score=JSON.parse(fs.readFileSync(path.join(here,`${b.id}.score.json`),'utf8'));
  const a=reconstructBuffers(score,THREE),again=reconstructBuffers(score,THREE),geometry=buildGeometry(score,THREE);
  assert(hash(a)===hash(again),'Non-deterministic geometry');
  assert(a.positions.every(Number.isFinite)&&a.normals.every(Number.isFinite),'Non-finite buffers');
  const changed=structuredClone(score);changed.edits.scaleHeight=1.1;const edited=buildGeometry(changed,THREE);
  assert(Math.abs(edited.boundingBox.max.y-geometry.boundingBox.max.y*1.1)<1e-4,'Coherent height edit failed');
  const invalid=structuredClone(score);invalid.edits.scaleHeight=0;let rejected=false;try{validateScore(invalid);}catch{rejected=true;}assert(rejected,'Invalid edit accepted');
  const wrongVersion=structuredClone(score);wrongVersion.reconstruction.version='9';rejected=false;try{validateScore(wrongVersion);}catch{rejected=true;}assert(rejected,'Unknown generator version accepted');
  const min=geometry.boundingBox.min.toArray(),max=geometry.boundingBox.max.toArray();
  const report={id:b.id,reconstructedTriangles:a.positions.length/9,recipeOperations:score.reconstruction.operations.length,bounds:{min,max,size:max.map((v,i)=>v-min[i])},geometrySha256:hash(a),repeatHashIdentical:true,heightScale110PercentTestPassed:true,invalidScaleRejected:true,unknownVersionRejected:true,generatedBufferBytes:a.positions.byteLength+a.normals.byteLength,sourceMeshReadAtRuntime:false,patches:a.patches};
  reports.push(report);fs.writeFileSync(path.join(here,`${b.id}.reconstructed-preview.json`),JSON.stringify({positions:Array.from(a.positions),normals:Array.from(a.normals),groups:a.groups}));
  geometry.dispose();edited.dispose();
}
fs.writeFileSync(path.join(here,'runtime-tests.json'),JSON.stringify({generator:'0.1.0',platform:process.version,tests:reports},null,2));
console.log(JSON.stringify(reports.map(r=>({id:r.id,triangles:r.reconstructedTriangles,deterministic:r.repeatHashIdentical,bytes:r.generatedBufferBytes}))));
