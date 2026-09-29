import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as A from '../src/instrument.js';
const examples=JSON.parse(await readFile(new URL('../src/scores.json',import.meta.url)));
let count=0;function check(name,fn){fn();count++;console.log('PASS',name);}
for(const [kind,score] of Object.entries(examples)){
 const a=A.buildScore(score),metrics=A.measure(a.root,score),hash=A.fingerprint(a.root);
 check(kind+' typed grammar',()=>assert.equal(a.kind,kind));
 check(kind+' short score',()=>assert(metrics.scoreBytes<=80));
 check(kind+' detailed actual surface',()=>assert(metrics.triangles>80000));
 check(kind+' finite generated data',()=>a.root.traverse(o=>{if(o.geometry)for(const at of Object.values(o.geometry.attributes))for(const v of at.array)assert(Number.isFinite(v));}));
 check(kind+' independent actual-output replay',()=>assert(A.verifyReplay(a)));
 check(kind+' output mutation detected',()=>{let mesh;a.root.traverse(o=>{if(!mesh&&o.isMesh)mesh=o;});mesh.geometry.attributes.position.array[0]+=.01;assert.notEqual(A.fingerprint(a.root),hash);});
 A.dispose(a.root);
}
for(const score of ['', 'K2|B','K3|F','K3|B,100','K3|B,2.7,1,1,-1','K3|E,2,70','K3|T#f00','K3|B;alert(1)','K3|B,2,1,1,.025,2.5'])check('reject '+score,()=>assert.throws(()=>A.parseScore(score)));
check('defaults well defined',()=>assert.deepEqual(A.parseScore('K3|B').p,[2.7,1,1,.025,41]));
const src=await readFile(new URL('../src/instrument.js',import.meta.url),'utf8');check('no reference/example/browser dependencies in pure generator',()=>{assert(!/document\.|fetch\(|examples\.json|data:image|GLTFLoader|ObjectLoader/.test(src));});
console.log('UNIT_CHECKS',count);
