import assert from 'node:assert/strict';
import * as A from '../src/instrument.js';
const b=A.buildScore('K3|B'),fur=b.root.getObjectByName('seeded-groomed-fur').geometry,p=fur.attributes.position,n=fur.attributes.normal;
let tested=0;for(let i=0;i<p.count;i+=9){const base=new A.THREE.Vector3().fromBufferAttribute(p,i).add(new A.THREE.Vector3().fromBufferAttribute(p,i+1)).multiplyScalar(.5),tip=new A.THREE.Vector3().fromBufferAttribute(p,i+8),normal=new A.THREE.Vector3().fromBufferAttribute(n,i);assert(tip.sub(base).dot(normal)>0,'hair goes inside body');tested++;}A.dispose(b.root);
const e=A.buildScore('K3|E');assert(e.root.getObjectByName('surface-fitted-avian-coverts').count===1250);assert(!e.root.getObjectByName('body-coverts'));A.dispose(e.root);
console.log('COVERING_GATES',tested,'outward strands; 1250 surface-fitted coverts');
